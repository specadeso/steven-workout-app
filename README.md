# Steven Workout PWA

Phone-first workout logger for Steven’s home program (Push / Pull / Legs / Full). Works offline after first load; all logs stay on the device via `localStorage`.

## Open (public HTTPS)

**https://specadeso.github.io/steven-workout-app/**

> **Caveat:** This URL is a **localhost.run tunnel** to the box’s static server (not permanent GitHub Pages / Netlify). The subdomain can change if the tunnel restarts. For a durable `*.github.io` / Surge / Cloudflare Pages URL, Steven needs to authenticate `gh` or a static host on this box (see below).

Restart tunnel + server on the box:
```bash
/workspace/steven-workout-app/start-server.sh
/workspace/steven-workout-app/start-tunnel.sh   # prints new URL if rotated
```

## Add to Home Screen

### iPhone (Safari)
1. Open the URL in **Safari** (not Chrome).
2. Tap **Share** → **Add to Home Screen**.
3. Confirm name → **Add**.

### Android (Chrome)
1. Open the URL in **Chrome**.
2. Tap **⋮** → **Install app** / **Add to Home Screen**.
3. Confirm.

## Features
- Suggested session from near-term schedule (or pick A–D Full/Short anytime)
- Required StretchTrainer block (15:00 timer + checkbox) before lifts
- Set logging with weight / reps, previous weights, rest timer (default 90s)
- History of past sessions
- Dark UI, large tap targets, no login

## Data
Logs and settings live in **this phone’s browser storage only**. Not synced to the cloud. Clearing site data or removing the home-screen app can erase history. Use **Settings → Export history** for a JSON backup.

## Near-term schedule (seeded)
| Date | Session |
|------|---------|
| Fri Sep 25, 2026 | FULL A Push |
| Sun Sep 27 | FULL B Pull |
| Mon Sep 28 | FULL C Legs |
| Wed Sep 30 | FULL D Full-body |
| Fri Oct 2 | SHORT A Push |
| Sun Oct 4 | SHORT B Pull |
| Tue Oct 6 | FULL C Legs |
| Wed Oct 7 | SHORT D Circuit |

## Local develop
```bash
cd /workspace/steven-workout-app
python3 -m http.server 8765
```

## Durable hosting blocker (for Grok Bot → Steven)
Tried in order; all need Steven’s login on this box:
1. **GitHub Pages** — `gh` not logged in; GitHub MCP `needsAuth`
2. **Surge.sh** — CLI works but rejects disposable emails; needs a real email + Surge account (or token)
3. **Netlify / Cloudflare Pages / ngrok / cloudflared quick tunnels** — auth required or rate-limited (CF 429)

**Hand the box to Steven** and run one of:
- `gh auth login` then create repo + `gh pages` / Actions, **or**
- `npx surge /workspace/steven-workout-app steven-workout.surge.sh` with a real email, **or**
- Netlify/Cloudflare login + drag-drop `/workspace/steven-workout-app`

## Files
- `index.html` / `styles.css` / `app.js` — UI + logic
- `manifest.json` / `sw.js` — PWA install + offline shell
- `icons/` — app icons
- `start-server.sh` / `start-tunnel.sh` — keep public URL alive
