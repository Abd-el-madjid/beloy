# BMW Drive Cover — take-home submission

A responsive six-screen insurance enrollment journey built with semantic HTML, CSS, Bootstrap 5.3 and vanilla JavaScript ES modules. No React, Vue, bundler or compilation step is used.

## Run

Serve this folder with any static HTTP server (ES modules do not run reliably from `file://`). For example, from this directory:

```bash
python -m http.server 8000
```

Open http://127.0.0.1:8000.

## Structure

- `index.html` — all six screens in one connected enrollment flow
- `css/tokens.css` — centralized design tokens and theme variables
- `css/styles.css` — reusable styles, responsive layouts and focus states
- `js/app.js` — flow orchestration and screen interactions
- `js/components.js` — reusable UI renderers
- `js/api.js` — browser-side API stub matching the supplied Ardenne Assurance quote/contract contract
- `js/locales/fr.js`, `js/locales/en.js` — French and English copy
- `js/i18n.js`, `js/money.js` — translation and currency utilities

## API stub note

The assignment allows the API responses to be stubbed. This submission folder uses a browser-side stub with the documented package prices, add-ons, eligibility checks, quote expiry, required consents, contract response and payment reference. It is intentionally not a secure production API and contains no secrets. The separately supplied `02-local-server-test` folder contains the Node.js REST mock server and integration tests for local API testing.

## Security boundary

A single-page HTML flow is not inherently insecure. It is a presentation/navigation choice. Browser code and all values sent by the browser are public and must be treated as untrusted. A real backend must independently validate eligibility, pricing, quote expiry, add-ons and consents, and must generate contract/payment references. Never place API secrets, signing keys or privileged credentials in this folder.

The carrier and API in the exercise are fictional; this is a front-end prototype, not a production insurance application.


### Offline assets and libraries
Bootstrap 5.1.1 CSS and its bundle are vendored under `vendor/bootstrap/`; the vehicle illustration is local at `assets/car-electric.svg`. No CDN, Google Fonts, remote images, or runtime external library requests are required. The page uses a system-font stack so it works offline.


### Customize the Figma-based design
Edit `css/tokens.css` for light/dark colors, font, radii and spacing; edit `css/styles.css` for layout; edit `js/locales/fr.js` and `en.js` for text; edit `index.html` for sections and fields. Bootstrap is bundled in `vendor/bootstrap/` (v5.1.1). No CDN is required.

Design note: the layout and visible French copy have been refined against Figma node 2:12785. The original Figma SVG assets could not be downloaded in this environment, so the illustration and background SVGs are locally bundled approximations rather than pixel-exact Figma exports.

### Branding and reusable components

The interface is BMW-inspired, but its custom angular **Drive Cover shield** mark and local favicon are original stand-ins, **not** BMW’s licensed roundel. The system font stack is a freely available substitute for BMW’s proprietary typeface. `js/components.js` contains reusable package cards, option controls, review fields, notices and inline field feedback; `js/app.js` owns navigation, state, validation and API orchestration. All component-facing copy is passed through the FR/EN dictionaries, and the brand colors are configured in `css/tokens.css`. The page meta description is also translated.
