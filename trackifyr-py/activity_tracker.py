"""
Simple Activity Tracker
Tracks mouse and keyboard activity and provides 10-second summaries
"""

import time
import sys
import io
from contextlib import redirect_stderr
from datetime import datetime
from threading import Thread, Lock
from pynput import mouse, keyboard
try:
    import pyautogui
    PYAutoGUI_AVAILABLE = True
except ImportError:
    PYAutoGUI_AVAILABLE = False

# Create a filtered stderr writer to suppress pynput errors
class FilteredStderr:
    def __init__(self, original_stderr):
        self.original_stderr = original_stderr
        self.buffer = ""
        self.suppress_next = False
    
    def write(self, s):
        self.buffer += s
        # Check if this is a pynput error we want to suppress
        if "Unhandled exception in listener callback" in self.buffer:
            self.suppress_next = True
        
        # If we have a complete line, process it
        if "\n" in self.buffer:
            lines = self.buffer.split("\n")
            for line in lines[:-1]:
                # Suppress pynput-related errors
                if not (self.suppress_next or 
                       ("pynput" in line.lower() and 
                        ("NotImplementedError" in line or 
                         "TypeError" in line or 
                         "_ThreadHandle" in line or
                         "Traceback" in line))):
                    self.original_stderr.write(line + "\n")
                # Reset suppress flag after processing a traceback block
                if line.strip() == "" and self.suppress_next:
                    self.suppress_next = False
            self.buffer = lines[-1]
    
    def flush(self):
        if self.buffer and not self.suppress_next:
            if not ("pynput" in self.buffer.lower() and 
                   ("NotImplementedError" in self.buffer or 
                    "TypeError" in self.buffer)):
                self.original_stderr.write(self.buffer)
        self.original_stderr.flush()
        self.buffer = ""
        self.suppress_next = False

# Store original stderr
_original_stderr = sys.stderr

class ActivityTracker:
    def __init__(self, interval_seconds=10):
        self.interval_seconds = interval_seconds
        
        # Activity tracking variables
        self.mouse_events = 0
        self.keyboard_events = 0
        self.start_time = None
        self.last_activity_time = None
        self.is_active = False
        
        # Track active seconds (set of second timestamps)
        self.active_seconds = set()
        
        # Thread safety
        self.lock = Lock()
        
        # Listeners
        self.mouse_listener = None
        self.keyboard_listener = None
        
        # Mouse polling (for Windows compatibility)
        self.last_mouse_pos = None
        self.mouse_polling_thread = None
        self.polling_active = False
        
    def on_mouse_move(self, x, y):
        """Track mouse movement - called on every mouse movement"""
        try:
            current_time = time.time()
            current_second = int(current_time)
            # Use lock for thread safety
            with self.lock:
                self.mouse_events += 1
                # Mark the current second as active (using integer timestamp)
                self.active_seconds.add(current_second)
                self.last_activity_time = current_time
                self.is_active = True
        except Exception:
            pass  # Silently ignore errors
    
    def on_mouse_click(self, x, y, button, pressed):
        """Track mouse clicks - both press and release"""
        try:
            # Track both press and release as activity
            current_time = time.time()
            current_second = int(current_time)
            with self.lock:
                self.mouse_events += 1
                # Mark the current second as active (using integer timestamp)
                self.active_seconds.add(current_second)
                self.last_activity_time = current_time
                self.is_active = True
        except Exception:
            pass  # Silently ignore errors
    
    def poll_mouse_position(self):
        """Poll mouse position to detect movement (Windows compatibility)"""
        mouse_controller = mouse.Controller()
        while self.polling_active:
            try:
                # Get current mouse position using pynput
                current_pos = mouse_controller.position
                
                with self.lock:
                    if self.last_mouse_pos is None:
                        self.last_mouse_pos = current_pos
                    elif self.last_mouse_pos != current_pos:
                        # Mouse moved!
                        self.mouse_events += 1
                        current_time = time.time()
                        current_second = int(current_time)
                        self.active_seconds.add(current_second)
                        self.last_activity_time = current_time
                        self.is_active = True
                        self.last_mouse_pos = current_pos
                
                time.sleep(0.1)  # Check every 100ms
            except Exception:
                time.sleep(0.1)
    
    def on_key_press(self, key):
        """Track keyboard presses"""
        try:
            with self.lock:
                self.keyboard_events += 1
                current_time = time.time()
                # Mark the current second as active (using integer timestamp)
                current_second = int(current_time)
                self.active_seconds.add(current_second)
                self.last_activity_time = current_time
                self.is_active = True
        except Exception:
            pass  # Silently ignore errors
    
    def calculate_activity_percentage(self, active_time, total_time):
        """Calculate activity percentage"""
        if total_time == 0:
            return 0.0
        return (active_time / total_time) * 100
    
    def generate_summary(self, session_start, session_end):
        """Generate and print activity summary"""
        with self.lock:
            total_time = session_end - session_start
            
            # Count active seconds within the session period
            # Use floor for start and ceil for end to include partial seconds
            session_start_second = int(session_start)
            session_end_second = int(session_end) + 1  # Include the second that session_end falls in
            
            # Count how many seconds in the session had activity
            active_seconds_count = 0
            for second in range(session_start_second, session_end_second):
                if second in self.active_seconds:
                    active_seconds_count += 1
            
            # Active time is the number of active seconds
            active_time = active_seconds_count
            
            # Calculate activity percentage
            activity_percentage = self.calculate_activity_percentage(active_time, total_time)
            
            print("\n" + "="*60)
            print(f"ACTIVITY SUMMARY - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print("="*60)
            print(f"Time Period: {self.interval_seconds} seconds")
            print(f"Total Time: {total_time:.2f} seconds")
            print(f"Active Seconds: {active_seconds_count} seconds")
            print(f"Activity Percentage: {activity_percentage:.2f}%")
            print(f"Mouse Events: {self.mouse_events}")
            print(f"Keyboard Events: {self.keyboard_events}")
            print(f"Total Events: {self.mouse_events + self.keyboard_events}")
            print("="*60 + "\n")
            
            # Reset counters and active seconds for next interval
            self.mouse_events = 0
            self.keyboard_events = 0
            self.active_seconds.clear()
    
    def start_tracking(self):
        """Start tracking mouse and keyboard activity"""
        print(f"Starting activity tracker...")
        print(f"Summary will be generated every {self.interval_seconds} seconds")
        print("Press Ctrl+C to stop tracking\n")
        
        # Filter stderr to suppress pynput internal errors
        sys.stderr = FilteredStderr(_original_stderr)
        
        # Start mouse tracking using both listener and polling
        mouse_tracking_active = False
        
        # Try event-based listener first
        try:
            self.mouse_listener = mouse.Listener(
                on_move=self.on_mouse_move,
                on_click=self.on_mouse_click,
                suppress=False
            )
            self.mouse_listener.start()
            time.sleep(0.3)
            if hasattr(self.mouse_listener, 'running') and self.mouse_listener.running:
                mouse_tracking_active = True
                print("Mouse tracking (listener): Active")
        except Exception as e:
            print(f"Mouse tracking (listener): Failed ({str(e)})")
            self.mouse_listener = None
        
        # Also start polling method for better Windows compatibility
        try:
            self.polling_active = True
            self.mouse_polling_thread = Thread(target=self.poll_mouse_position, daemon=True)
            self.mouse_polling_thread.start()
            if not mouse_tracking_active:
                print("Mouse tracking (polling): Active")
            else:
                print("Mouse tracking (polling): Active (backup method)")
        except Exception as e:
            print(f"Mouse tracking (polling): Failed ({str(e)})")
            self.polling_active = False
        
        # Start keyboard listener with error suppression
        try:
            self.keyboard_listener = keyboard.Listener(
                on_press=self.on_key_press,
                suppress=False
            )
            self.keyboard_listener.start()
            print("Keyboard tracking: Active")
        except Exception as e:
            print(f"Keyboard tracking: Failed to start ({str(e)})")
            print("Note: Keyboard tracking may require administrator privileges on Windows")
            self.keyboard_listener = None
        
        # Keep filtered stderr active to suppress ongoing pynput errors
        
        print()  # Empty line for readability
        
        # Main tracking loop
        try:
            while True:
                self.start_time = time.time()
                time.sleep(self.interval_seconds)
                session_end = time.time()
                self.generate_summary(self.start_time, session_end)
        except KeyboardInterrupt:
            print("\n\nStopping activity tracker...")
            self.stop_tracking()
    
    def stop_tracking(self):
        """Stop tracking and cleanup"""
        # Stop polling
        self.polling_active = False
        if self.mouse_polling_thread:
            self.mouse_polling_thread.join(timeout=1.0)
        
        try:
            if self.mouse_listener:
                self.mouse_listener.stop()
        except Exception:
            pass
        try:
            if self.keyboard_listener:
                self.keyboard_listener.stop()
        except Exception:
            pass
        # Restore original stderr
        sys.stderr = _original_stderr
        print("Activity tracker stopped.")

def main():
    """Main function to run the activity tracker"""
    tracker = ActivityTracker(interval_seconds=10)
    tracker.start_tracking()

if __name__ == "__main__":
    main()

