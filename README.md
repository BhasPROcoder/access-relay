# AccessRelay

**Know what has been checked along a complete campus service journey.**

AccessRelay is an open-source hackathon prototype for dated accessibility observations, barrier reporting, repair claims and independent rechecks. Intended theme: **Assistive Technology & Accessibility**, HSC–VBYLD 2027.

> **Synthetic demo:** places, observations and actors are fictional. This is not navigation, accessibility certification or a safety guarantee. No beneficiary pilot has been completed. The actor selector is a simulation, not authentication.

## Run locally

Install Node.js 22 or later. No third-party dependencies, API keys, database or install step are required.

```sh
git clone https://github.com/BhasPROcoder/accessrelay.git
cd accessrelay
node scripts/serve.mjs
```

Open **http://127.0.0.1:4173**. Use the server rather than opening `index.html` directly. Optional environment variable: `PORT` (default `4173`). No secrets are needed. The server listens on loopback only and serves an explicit allowlist of public files.

```sh
node --test
node --check src/app.js
node --check src/domain.js
```

With npm available, equivalent shortcuts are `npm start`, `npm test`, and `npm run check`.

## Working features

- Three fictional service journeys with clear, blocked, unknown and stale observations.
- A barrier stays unresolved when staff merely claim a repair.
- Simulated independent review either restores a current observation or reopens the barrier.
- Local action history, refresh persistence, reset and print view.
- Keyboard-operable controls and status text that does not rely on color.
- Service-worker cache for subsequent offline visits after a successful first load on localhost/HTTPS. Offline data remains dated; check freshness before use.

## Try the demo

1. Choose **Visit the library**: the ramp is blocked and the desk has not been checked.
2. Switch to **Facilities staff** and claim the ramp repair. It remains pending.
3. Try rechecking as staff: the rule rejects it.
4. Switch to **Independent reviewer**, then pass or fail the recheck.
5. Check the desk separately: fixing the ramp alone does not establish a complete journey.
6. Compare the administration journey's expired evidence with the current student-support fixture.

## Repository structure

```text
accessrelay/
├── .github/workflows/ci.yml     # syntax and domain tests
├── data/journeys.json          # synthetic, relative-time fixtures
├── docs/
│   ├── ARCHITECTURE.md         # technical design and Mermaid diagram
│   ├── DATA.md                 # data model and provenance
│   ├── VALIDATION.md           # test evidence and manual checklist
│   └── AI_USAGE.md             # actual assistance and limitations
├── scripts/serve.mjs           # dependency-free local server
├── src/
│   ├── app.js                 # browser interface
│   ├── domain.js              # pure workflow rules
│   └── styles.css
├── submission/
│   ├── CHECKLIST.md           # public packaging checklist, no IDs
│   └── DEMO_SCRIPT.md
├── tests/domain.test.js
├── index.html
├── sw.js
├── package.json
├── CONTRIBUTING.md
├── SECURITY.md
└── LICENSE
```

## Design and limits

See [technical design](docs/ARCHITECTURE.md), [sample-data notes](docs/DATA.md), [validation](docs/VALIDATION.md) and [security](SECURITY.md).

This is a browser-local prototype: there is **no backend, secure identity, cross-device synchronization or tamper-proof audit log**. Local storage can be edited by the device owner. A real deployment needs server-enforced permissions, an independent reviewer identity, consent, institutional ownership and beneficiary testing. Cached code updates require a cache version change and reload. The app is not designed for emergency response.

Accessibility mapping and reporting already exist. Relevant alternatives include [Sugamya Bharat](https://crcsundernagar.nic.in/service/sugamya-bharat-app-sba/), [Wheelmap](https://news.wheelmap.org/en/FAQ/), [Project Sidewalk](https://makeabilitylab.cs.washington.edu/project/sidewalk/) and [RampMyCity](https://rampmycity.com/). Our proposed distinction—service-level evidence freshness plus repair/recheck handover—still needs user and competitor validation. No absolute novelty claim is made.

## Submission readiness

The code is a starting prototype, not a completed competition entry. State/campus, team details, official-template presentation, actual validation, signed declaration and any video must be prepared separately. Use the [submission checklist](submission/CHECKLIST.md). **Never commit student IDs, government IDs, signatures, completed declarations or credentials.**

## Attribution and license

MIT licensed; see [LICENSE](LICENSE). No third-party runtime libraries, fonts, images or copied project implementations are included. AI substantially assisted this initial implementation and documentation; see [AI usage](docs/AI_USAGE.md). Team members must review and understand their submission.
