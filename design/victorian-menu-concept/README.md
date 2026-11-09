# Victorian menu concept — prototype only

Approved direction: Victorian ornament, the Bissing House website palette, a solid cream background and off-white panels. No room photographs.

Open `index.html` directly in a browser, or from the repository root run:

```sh
python3 -m http.server 8082 --directory design/victorian-menu-concept --bind 127.0.0.1
```

Then visit http://127.0.0.1:8082. This serves only the concept directory on your computer.

## Scope

This is an independent clickable design study, not the production React menu. It includes one/two guest selection, conditional egg preparation and toppings, missing-choice feedback, review/edit, sample confirmation, Continental and closed-hours previews. The displayed room is illustrative. Continental behavior is a proposal, not a production change.

No orders are sent, stored or notified. There are no Firebase or order API calls. The logo and Tailwind styling are external assets and require internet access. Selections exist only in page memory.

## Source and validation

Preserved from approved `Bissing_Menu_Concept_Only.zip`, version 5, without modifying its HTML.
HTML SHA-256: `3a77b823b85f82feccd3fe492ef21663937ed4e75a590c91431b4f91a35fe3e9`.

Checked: inline JavaScript syntax; concept label present; no room-photo references; no fetch, XMLHttpRequest, sendBeacon, Firebase or /api/ calls. Core interactions were previously exercised in the design preview; this archival commit does not change behavior.

## Deployment boundary

This directory is outside `src`, `public` and `dist`; it is not imported by the app. Firebase Hosting uses `dist` and Vite's existing entry remains unchanged. No active `.github/workflows` files exist on the base commit; the root `github-actions-demo.yml` is not an active workflow. External provider-side automation was not independently audited. This commit carries `[skip ci]` and does not request deployment. Do not merge this concept into the live ordering flow without a separate implementation review.

Base: `main` at `8863c8d535f6f77f40e3d2a42eb1fcf1e75a72a9`.
