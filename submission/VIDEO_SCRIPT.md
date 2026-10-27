# Demo video script — 3:00 target

I can't record screen+voice myself (no camera/mic/video tool in this session), so this
is the shot list and narration to read while you record. Full word count is tight for
145 wpm at 3:00 (≈435 words); this script runs under that on purpose so you have slack
for pauses and the live clicks.

## How to actually record this, fast

1. **Windows Game Bar (zero install, built into Windows 11):** `Win+G`, click the
   camera-shaped capture widget, pick your mic, hit record. No OBS setup needed.
2. Run `node scripts/serve.mjs` first and have `http://127.0.0.1:4173` already loaded
   and reset (click **Reset demo**) before you hit record.
3. Zoom the browser to 110–125% so judges watching on a phone can read text.
4. Close notifications, hide the bookmarks bar, use a quiet room. Record 5 seconds of
   silence at the start so you can noise-reduce later if needed.
5. **One clean take beats a perfectly edited one at this point in the clock.** If a
   step goes wrong, don't stop, just say "let me show that again" and redo that one
   beat, you can cut the retry out in one quick edit afterward (or leave it if you're
   out of time, a visible retry is not a disqualifier, going over the time limit is).
6. If you have *any* time left after a good take, add captions (YouTube auto-captions,
   cleaned up, are faster than typing your own).

## Shot list and narration (3:00)

| # | Time | Visual | Narration |
|---|---|---|---|
| 1 | 0:00–0:10 | Title card: "AccessRelay" over the warm cover slide, or the live app's hero section | "Nobody visits a building. They visit a service, gate, ramp, lift, counter, and today's maps only ever tell you about the building." |
| 2 | 0:10–0:22 | Problem slide or the app's synthetic-demo notice | "A two-year-old 'accessible' sticker and a lift that broke this morning look identical on every map that exists. AccessRelay tracks freshness, not just presence, and every place here is fictional." |
| 3 | 0:22–0:32 | Click into "Visit the library" journey | "Meet the library journey. Four segments: gate, ramp, door, desk. Watch what happens when time passes." |
| 4 | 0:32–1:12 | Open **Demo controls**, simulate evidence ageing, then report the **main gate** barrier | "Move the evidence-ageing preview forward, and a current observation becomes 'needs a fresh check.' This changes no stored data. Now I report the main gate, the one checkpoint shared by all three journeys. The Campus Priority banner accurately shows that this barrier affects all three." |
| 5 | 1:12–1:40 | Switch to staff and claim the ramp repair | "Facilities sees only the action allowed for its role and claims the repair. Status stays pending because a claim is not verification. Only a different reviewer can close this leg of the relay." |
| 6 | 1:40–2:05 | Switch to reviewer, fail then pass the recheck; point at the still-unknown desk | "A different reviewer fails it once, the ramp reopens blocked. Then passes it, the ramp clears. But the library desk has never been observed, so the whole journey still isn't done. One fix is never the whole story." |
| 7 | 2:05–2:25 | Click "Download verification history," briefly show the JSON | "Accepted actions can be exported as a browser-local verification history. It is useful evidence for this demo, but identities are simulated and the file is not tamper-proof." |
| 8 | 2:25–2:45 | Impact slide or README features list | "We're not claiming a beneficiary pilot yet. What we are claiming: three honest signals any campus could track from day one, what's currently trustworthy, what's stale, and what's actually been independently verified." |
| 9 | 2:45–3:00 | End card: AccessRelay wordmark, repo link, team names | "AccessRelay, built by Bhaskar Agarwal, Lakshya Seth and Aashi Gupta for HSC–VBYLD 2027. Try it, and tell us where the relay would break on your campus." |

Total narration: ~230 words across 180 seconds, leaving real slack for clicking,
loading and pauses, don't rush to fill dead air.

## What NOT to do

- Don't show the code editor or terminal for more than a couple of seconds, judges
  are not there to read source.
- Don't invent numbers, user counts, or partnerships out loud. Say "synthetic demo
  data" at least once on camera, it's already in the README and the app's own notice.
- Don't go over 3:00. Cut shot 8 first if you're tight, it's the easiest to compress
  into one sentence.
