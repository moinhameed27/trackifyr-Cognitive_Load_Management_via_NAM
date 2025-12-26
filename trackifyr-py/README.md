# Activity Tracker

Simple Python script to track mouse and keyboard activity and generate 10-minute summaries.

## Installation

Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

Run the activity tracker:

```bash
python activity_tracker.py
```

The script will:
- Track all mouse movements and clicks
- Track all keyboard presses
- Generate a summary every 10 minutes showing:
  - Total time period
  - Active time (estimated)
  - Activity percentage
  - Number of mouse and keyboard events

Press `Ctrl+C` to stop tracking.

## Output Example

```
============================================================
ACTIVITY SUMMARY - 2024-01-15 14:30:00
============================================================
Time Period: 10 minutes
Total Time: 600.00 seconds (10.00 minutes)
Active Time: 45.30 seconds (0.76 minutes)
Activity Percentage: 7.55%
Mouse Events: 234
Keyboard Events: 219
Total Events: 453
============================================================
```


