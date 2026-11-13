# Bissing Breakfast alert-channel migration

Updated: 2026-11-13. Project: `bhbreakfastmenu`.

| Channel | Status | Production behavior |
| --- | --- | --- |
| Telegram | Active route, delivered successfully in prior production tests | Unchanged. Send on new and replacement orders; report failures without blocking order storage. |
| Verizon `vtext.com` | Discontinued | Disabled; no addresses or SMTP path in the active function. |
| T-Mobile `tmomail.net` | Unverified | Disabled pending delivery verification; do not treat SMTP acceptance as proof of delivery. |
| Supported SMS provider | Not configured | No SMS delivery until one is explicitly approved and tested. |

The carrier email-to-text implementation in `functions/sms.js` is a fail-closed, no-network stub. `functions/index.js` no longer loads Nodemailer or binds `SMS_GMAIL_APP_PASSWORD`, and `nodemailer` was removed from production dependencies. The successful order API response retains a `sms` field with `status: disabled` for compatibility. The read-only `/api/admin/sms-status` route reports the current transport states. Telegram secret bindings and the existing menu/order/Firestore logic remain intact.

## Verification and rollback

Run `node --test functions/*.test.js` and `node --check functions/index.js`. Inspect `git diff -- functions` before deploying `firebase deploy --only functions:api --project bhbreakfastmenu`. Test the read-only `/api/admin/sms-status`, `/api/ordering-window`, and `/api/admin/cheat-sheet` endpoints after deployment. Do not create fake guest orders in production. Watch the next real order for a successful Telegram status in logs, with no SMS transport activity.

To roll back application behavior if unrelated functions regress, return to the prior deployed revision using the Firebase/Cloud Run release history; do **not** restore the obsolete carrier gateway without a new, supported provider and approval. Keep the earlier repository revision for historical comparison only. The retired Gmail SMTP secret may be separately decommissioned after confirmation no other systems consume it; no deletion was performed here.
