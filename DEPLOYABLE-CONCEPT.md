# Victorian guest menu — prepared, not deployed

Branch: `design/victorian-menu-concept`. The archived static study remains in `design/victorian-menu-concept/`; the React guest app now implements its cream/off-white background, exact website palette, static logo, Victorian scrollwork, double frames, numbered guests, and review/edit journey. Room photos are not displayed.

## Run safely

Use Node 22 or newer, then `npm ci` and `npm run dev`. Open `http://localhost:5173/?room=Basgall` (also Bissing or TeaRose). Default development mode simulates an open ordering window and submissions, with a visible preview banner. It never sends orders or notification requests to the production ordering API. Do not enable live API settings for design review.

## Build for a future release

`npm run build` produces `dist/` for the existing Firebase Hosting configuration. This command does not publish anything. The production build connects to the existing production API: do not place test orders through `npm run preview` unless network interception is installed. The original backend and admin dashboard are unchanged. No deployment workflow was added.

Current production serving times, meal options, room QR routing, room-level Continental request, replacement-order payload, Hays ordering cutoff, and backend notification behavior remain authoritative. The static study's proposed schedule is not substituted for the actual menu.

## Verification

- `npm run build`
- `npm run lint` (existing AdminDashboard hook/unused-catch warnings)
- `node --test functions/ordering-window.test.js functions/order-flow.test.js functions/sms.test.js functions/telegram.test.js`
- `node tests/victorian-interactions.cjs` after building: mocked network; required choices, two-guest selections, review without submission, edit retention, correct room payload, confirmation, Continental.
- `tests/ordering-browser.cjs` is updated for the review step. Chromium is blocked from starting by this workspace's socket restrictions, so real-browser visual and cutoff checks remain pending. Run with Playwright available and the production preview on port 5177; its API routes are mocked.

Before a future deployment, complete real-browser mobile/desktop review. Nothing in this work authorizes deployment or a merge to main.
