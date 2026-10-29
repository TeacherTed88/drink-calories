# Beermaxxing 🍺

A tap-to-count alcohol calorie tracker built for Guangzhou convenience-store beer
shelves. Static PWA — no backend, no build step, hosts free on GitHub Pages.

## Features
- 58 drinks: Guangzhou 7-Eleven / 美宜佳 beer shelf (500/600/640/980 ml cans &
  bottles), spirits, wine — every entry at real package sizes
- Search/filter box (matches English + Chinese names)
- Week view: per-day totals, bar chart, auto-archived history for week-over-week comparison
- Per-user accounts (name + password, salted SHA-256, stored on-device only)
- Works offline once loaded; installable to home screen

## Deploy
Push this folder to GitHub and enable Pages (Settings → Pages → Deploy from
branch → main /(root)). The app lives at `https://<you>.github.io/drink-calories/`.

## Architecture
| File | Layer |
|---|---|
| `js/drinks.js` | Data — canonical drink list (indexes 0–22 are frozen) |
| `js/core.js` | Pure logic — totals, week rollover, legacy migration (unit-tested) |
| `js/storage.js` | Persistence — only module touching localStorage (fail-soft) |
| `js/auth.js` | Client-side auth — salted SHA-256, typed errors |
| `js/ui.js` | DOM rendering — receives state + actions, no storage knowledge |
| `js/app.js` | Orchestrator — wires the layers |

## Tests
Open `/tests.html` on the deployed site (requires https for WebCrypto).
