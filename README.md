# AccessRelay

**Know what has been checked along a complete campus service journey.**

AccessRelay is a hackathon prototype for dated accessibility observations: not just whether a ramp exists, but whether anyone's actually checked it recently, and whether a claimed repair ever got verified. Built for the Assistive Technology & Accessibility track at HSC–VBYLD 2027.

> **Synthetic demo.** Every place, observation and actor here is made up. This isn't navigation, isn't an accessibility certification, and isn't a safety guarantee. We haven't run a beneficiary pilot yet, and the actor selector is a simulation, not real authentication.

## The Relay Rule

AccessRelay's central rule is that **no actor can close their own leg of the relay, and evidence must be re-passed before it goes stale.** A visitor reports a barrier, staff can only *claim* a fix (never verify it), and a separate reviewer must recheck it before it counts as clear. A known barrier never disappears just because time passed, and an old "clear" expires into "needs a fresh check" rather than staying trusted forever. The prototype explores a chain of custody for accessibility evidence rather than a map of static ratings.

## Run locally

Install Node.js 22 or later. No third-party dependencies, no API keys, no database, nothing extra to install.

```sh
git clone https://github.com/BhasPROcoder/access-relay.git
cd access-relay
node scripts/serve.mjs
```

Open **http://127.0.0.1:4173**. Use the server instead of opening `index.html` directly, or the module imports won't load. Set `PORT` if you want a different one (defaults to `4173`). No secrets needed. It only listens on loopback, and only serves files on an explicit allowlist.

```sh
node --test
node --check src/app.js
node --check src/domain.js
```

With npm available, equivalent shortcuts are `npm start`, `npm test`, and `npm run check`.

## Working features

- Three fictional service journeys with clear, blocked, unknown and stale observations.
- A barrier stays open until someone other than the person who claimed the fix checks it.
- Simulated independent review either restores a current observation or reopens the barrier.
- Local action history, refresh persistence, reset and print view.
- Every control works from the keyboard, and status never depends on color alone.
- A service worker caches the app after your first successful load on localhost or HTTPS, so later visits still work offline. Offline data is still dated though, so check freshness before you trust it.
- A campus-priority banner that identifies which current barrier affects the most journeys, without claiming that one repair will restore an otherwise uncertain journey.
- A collapsed demo panel for previewing evidence expiry, plus an overdue flag for repair claims awaiting recheck for more than four hours.
- A verdict-first journey summary explaining the uncertain checkpoints, next actions and responsible owner.
- An optional comfort mode with larger text, wider spacing and reduced motion.
- A downloadable JSON copy of accepted browser-local verification events, clearly labelled as simulated and not tamper-proof.

## Try the demo

1. Choose **Visit the library**: the ramp is blocked and the desk has not been checked.
2. Switch to **Facilities staff** and claim the ramp repair. It remains pending.
3. Notice that staff see only the repair action allowed for their role.
4. Switch to **Independent reviewer**, then pass or fail the recheck.
5. Check the desk too: fixing the ramp alone doesn't make the whole journey usable.
6. Compare the administration journey's expired evidence with the current student-support fixture.

## Repository structure

```text
access-relay/
├── .github/workflows/ci.yml     # syntax and domain tests
├── data/journeys.json          # synthetic, relative-time fixtures
├── doc/                        # supporting review material
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
│   ├── DEMO_SCRIPT.md
│   └── assets/                # draft deck and final deliverable location
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

This is a browser-local prototype. There's **no backend, no secure identity, no cross-device sync, no tamper-proof audit log.** Anyone with access to the device can edit local storage. A real deployment would need server-enforced permissions, a genuine independent-reviewer identity, consent, an institution that actually owns the data, and real beneficiary testing before anyone relies on it. Updating the cached code needs a cache-version bump and a reload. And this was never built for emergency response, so please don't use it for that.

We're not the first to work on this. [Sugamya Bharat](https://crcsundernagar.nic.in/service/sugamya-bharat-app-sba/), [Wheelmap](https://news.wheelmap.org/en/FAQ/), [Project Sidewalk](https://makeabilitylab.cs.washington.edu/project/sidewalk/) and [RampMyCity](https://rampmycity.com/) already do real work here. What we think might be different: evidence freshness at the service level, plus a repair-and-recheck handover instead of a single static pin. That's still just a hypothesis until we validate it against actual users and competitors. We're not claiming absolute novelty.

## Submission readiness

This code is a starting point, not a finished competition entry. A draft pitch deck is included, but state and campus details, team information, official-template compliance, real validation, the signed declaration and the recorded video still need to be completed and checked separately. Video working files remain local and are intentionally excluded from Git. Use the [submission checklist](submission/CHECKLIST.md) for that. **Never commit student IDs, government IDs, signatures, completed declarations or credentials.**

## Attribution and license

MIT licensed, see [LICENSE](LICENSE). We didn't include any third-party runtime libraries, fonts, images or copied implementations. AI did a substantial amount of this first implementation and these docs. See [AI usage](docs/AI_USAGE.md) for the honest version of that story. Every team member still needs to actually understand what they're submitting.
