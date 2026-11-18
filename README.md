# Clock front end

Mobile-first GitHub Pages front end for a public time/earnings tracker.

## Files
- index.html — live status, pay-week total, admin unlock, recent shifts
- reports.html — day/week/month/year reports
- style.css — responsive UI
- app.js — main screen and admin-session behavior
- reports.js — reports client
- config.js — Cloudflare Worker API URL

## Before it works with live data
Deploy the Cloudflare Worker + D1 backend, then replace `API_URL` in `config.js`.

The future Worker API expected by this front end is:
- GET /api/status
- GET /api/report?period=day|week|month|year
- POST /api/login
- POST /api/clock-in
- POST /api/clock-out

Protected POSTs use `Authorization: Bearer <session token>` automatically after login.
