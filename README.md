# LeetRepeat

LeetRepeat is a Chrome extension that applies spaced repetition to LeetCode problems, helping users retain problem-solving skills over time.

## Features

- Tracks solved LeetCode problems automatically
- Schedules revision reminders at 7, 30, and 90 days
- Progressive revision system (no reset on re-solving)
- Chrome notifications with direct problem access
- Dashboard with:
  - Due problems
  - Overdue problems
  - Upcoming revisions
- Mark problems as revised

## Tech Stack

- JavaScript (Chrome Extension APIs)
- Chrome Storage API
- Chrome Alarms API
- Chrome Notifications API

## How It Works

1. Detects "Accepted" submissions on LeetCode
2. Stores problem metadata
3. Schedules revision reminders
4. Tracks revision progress
5. Displays categorized dashboard

## Installation

1. Clone the repo
2. Open Chrome → `chrome://extensions/`
3. Enable Developer Mode
4. Click "Load unpacked"
5. Select the project folder

## Future Improvements

- Difficulty-based scheduling
- Adaptive intervals (Anki-style)
- Sync across devices
- Analytics dashboard

## License

MIT License