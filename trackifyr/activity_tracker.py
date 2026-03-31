"""
Activity Tracker Module
Tracks mouse and keyboard activity and provides interval-based summaries.

Purpose: Monitors user activity (mouse movements, clicks, keyboard presses)
         and generates periodic summaries for cognitive load analysis.

Author: Muhammad Moin U Din (BCSF22M023)
Author: Muhammad Junaid Malik (BCSF22M031)
Author: Muhammad Subhan Ul Haq (BCSF22M043)
"""

import json
import time
import sys
from threading import Thread, Lock
from pynput import mouse, keyboard

DEFAULT_INTERVAL_SECONDS = 10
MOUSE_POLLING_INTERVAL = 0.1

class FilteredStderr:
    """
    Filters stderr output to suppress pynput-related errors on Windows.
    """
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
    """
    Tracks mouse and keyboard activity over time intervals.
    Provides summaries of activity percentage and event counts.
    """
    
    def __init__(self, interval_seconds=DEFAULT_INTERVAL_SECONDS):
        if interval_seconds <= 0:
            raise ValueError("Interval seconds must be greater than 0")
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
            with self.lock:
                self.mouse_events += 1
                self.active_seconds.add(current_second)
                self.last_activity_time = current_time
                self.is_active = True
        except Exception as e:
            print(f"Error tracking mouse movement: {e}", file=sys.stderr)
    
    def on_mouse_click(self, x, y, button, pressed):
        """Track mouse clicks - both press and release"""
        try:
            current_time = time.time()
            current_second = int(current_time)
            with self.lock:
                self.mouse_events += 1
                self.active_seconds.add(current_second)
                self.last_activity_time = current_time
                self.is_active = True
        except Exception as e:
            print(f"Error tracking mouse click: {e}", file=sys.stderr)
    
    def poll_mouse_position(self):
        """Poll mouse position to detect movement (Windows compatibility)"""
        mouse_controller = mouse.Controller()
        while self.polling_active:
            try:
                current_pos = mouse_controller.position
                
                with self.lock:
                    if self.last_mouse_pos is None:
                        self.last_mouse_pos = current_pos
                    elif self.last_mouse_pos != current_pos:
                        self.mouse_events += 1
                        current_time = time.time()
                        current_second = int(current_time)
                        self.active_seconds.add(current_second)
                        self.last_activity_time = current_time
                        self.is_active = True
                        self.last_mouse_pos = current_pos
                
                time.sleep(MOUSE_POLLING_INTERVAL)
            except Exception as e:
                print(f"Error polling mouse position: {e}", file=sys.stderr)
                time.sleep(MOUSE_POLLING_INTERVAL)
    
    def on_key_press(self, key):
        """Track keyboard presses"""
        try:
            with self.lock:
                self.keyboard_events += 1
                current_time = time.time()
                current_second = int(current_time)
                self.active_seconds.add(current_second)
                self.last_activity_time = current_time
                self.is_active = True
        except Exception as e:
            print(f"Error tracking keyboard press: {e}", file=sys.stderr)
    
    def calculate_activity_percentage(self, active_time, total_time):
        """Calculate activity percentage"""
        if total_time <= 0:
            return 0.0
        return min(100.0, max(0.0, (active_time / total_time) * 100))
    
    def generate_summary(self, session_start, session_end):
        """Emit one JSON line per interval (stdout) with the same metrics as before."""
        if session_end <= session_start:
            print("Error: Invalid session time range", file=sys.stderr)
            return
            
        with self.lock:
            total_time = session_end - session_start
            session_start_second = int(session_start)
            session_end_second = int(session_end) + 1
            
            active_seconds_count = sum(
                1 for second in range(session_start_second, session_end_second)
                if second in self.active_seconds
            )
            
            active_time = active_seconds_count
            activity_percentage = self.calculate_activity_percentage(active_time, total_time)
            
            mouse_events = self.mouse_events
            keyboard_events = self.keyboard_events
            
            # Reset counters and active seconds for next interval
            self.mouse_events = 0
            self.keyboard_events = 0
            self.active_seconds.clear()
        
        payload = {
            "timestamp": time.time(),
            "active_seconds": int(active_seconds_count),
            "activity_percentage": float(activity_percentage),
            "mouse_events": int(mouse_events),
            "keyboard_events": int(keyboard_events),
        }
        print(json.dumps(payload), flush=True)
    
    def start_tracking(self):
        """Start tracking mouse and keyboard activity"""
        print(f"Starting activity tracker...", file=sys.stderr)
        print(f"JSON summary every {self.interval_seconds} seconds (stdout, one object per line)", file=sys.stderr)
        print("Press Ctrl+C to stop tracking\n", file=sys.stderr)
        
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
                print("Mouse tracking (listener): Active", file=sys.stderr)
        except Exception as e:
            print(f"Mouse tracking (listener): Failed ({str(e)})", file=sys.stderr)
            self.mouse_listener = None
        
        # Also start polling method for better Windows compatibility
        try:
            self.polling_active = True
            self.mouse_polling_thread = Thread(target=self.poll_mouse_position, daemon=True)
            self.mouse_polling_thread.start()
            if not mouse_tracking_active:
                print("Mouse tracking (polling): Active", file=sys.stderr)
            else:
                print("Mouse tracking (polling): Active (backup method)", file=sys.stderr)
        except Exception as e:
            print(f"Mouse tracking (polling): Failed ({str(e)})", file=sys.stderr)
            self.polling_active = False
        
        # Start keyboard listener with error suppression
        try:
            self.keyboard_listener = keyboard.Listener(
                on_press=self.on_key_press,
                suppress=False
            )
            self.keyboard_listener.start()
            print("Keyboard tracking: Active", file=sys.stderr)
        except Exception as e:
            print(f"Keyboard tracking: Failed to start ({str(e)})", file=sys.stderr)
            print("Note: Keyboard tracking may require administrator privileges on Windows", file=sys.stderr)
            self.keyboard_listener = None
        
        # Keep filtered stderr active to suppress ongoing pynput errors
        
        print(file=sys.stderr)  # Empty line for readability
        
        # Main tracking loop
        try:
            while True:
                self.start_time = time.time()
                time.sleep(self.interval_seconds)
                session_end = time.time()
                self.generate_summary(self.start_time, session_end)
        except KeyboardInterrupt:
            print("\n\nStopping activity tracker...", file=sys.stderr)
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
        print("Activity tracker stopped.", file=sys.stderr)

def main():
    """Main function to run the activity tracker"""
    import argparse

    parser = argparse.ArgumentParser(description="Stream activity metrics as JSON lines on stdout.")
    parser.add_argument(
        "--interval",
        type=float,
        default=float(DEFAULT_INTERVAL_SECONDS),
        metavar="SEC",
        help=f"Seconds between JSON summaries (default: {DEFAULT_INTERVAL_SECONDS})",
    )
    args = parser.parse_args()
    if args.interval <= 0:
        print("Error: --interval must be greater than 0", file=sys.stderr)
        sys.exit(1)

    try:
        tracker = ActivityTracker(interval_seconds=args.interval)
        tracker.start_tracking()
    except KeyboardInterrupt:
        print("\nActivity tracker stopped by user.", file=sys.stderr)
    except Exception as e:
        print(f"Error running activity tracker: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

