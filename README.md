# Steven 5x5

Phone workout logger for a 3-day 5×5 rotation. One page, works offline after the first load, and keeps every log on the phone (`localStorage` only, no account).

**https://specadeso.github.io/steven-workout-app/**

## Add to Home Screen

iPhone: open the URL in Safari → Share → Add to Home Screen.

Android: open the URL in Chrome → menu → Install app / Add to Home Screen.

## Session

1. Home shows the next workout (A → B → C → A). Switch the day before starting.
2. Precor StretchTrainer, 5 or 10 minutes (5 highlighted). Start, pause, or skip. Begin every workout with 5–10 minutes here.
3. Three lifts, 5×5. Log weight and reps (reps start at 5). A rest timer starts after each set (default 90s; 60 / 90 / 180; skip or +30s).
4. Optional finisher: Run, Row, or Jump rope. Timer and Done, or skip.
5. 15 minute cooldown with stretches and rolling. Checklist is optional. Finish workout saves the session.

If all 5 sets were 5 reps, the next session suggests +5 lb for that exercise. If any set missed 5, it suggests the same weight.

| Day | Lifts |
|-----|--------|
| A | Barbell squat, Barbell bench press, Preacher curls |
| B | Barbell deadlift, Overhead press, Back extensions |
| C | Kettlebell swings, Decline bench sit-ups, Barbell squat |

## Data

New logs use the `sl5x5-v1` storage prefix. Older logs on the phone are left untouched. Clearing site data erases history. Nothing is synced.

## Local preview

```bash
cd /workspace/steven-workout-app
python3 -m http.server 8765
```
