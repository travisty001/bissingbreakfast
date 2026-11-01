# Bissing House V3 design preview

This is a **design preview**, not a production-ready replacement. The guest ordering and kitchen dashboard retain their existing behavior and have a shared Victorian-inspired visual refresh with an animated logo. The production ordering API is intercepted in preview mode, so submitting an order only creates a simulated confirmation. SMS controls cannot affect real recipients. The dashboard displays no real orders.

Run: `npm ci && npm run dev -- --host 127.0.0.1`

Visit `/bissing`, `/basgall`, `/tearose`, and `/admin` on the Vite local address.

Never deploy this branch. The API guard defaults to mock mode in both development and build. Real API access would require deliberately setting `VITE_ENABLE_LIVE_API=true` when building, which is **not recommended** until integration testing is complete.

This first visual pass is for reviewing the palette, typography, layout and logo effect. It does not claim end-to-end SMS delivery testing or full redesign completion.
