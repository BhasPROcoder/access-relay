# Validation

## Automated checks

Run `node --test`. The domain suite checks fixture aggregation; expiry boundary; missing segments; barrier persistence; repair-claim immutability; independent demo actor requirement; prohibition of bypassing rechecks; pass/fail rechecks; and rejection of invalid actions.

Run `npm run check` if npm is installed, or `node --check` against each JavaScript file. CI runs syntax checks and tests with Node 22.

## Manual acceptance checklist

- [ ] All three journeys render at desktop and mobile widths.
- [ ] Tab order, visible focus, labels and status announcements work with keyboard and a screen reader.
- [ ] Staff cannot verify its own claim through the demo rules; reviewer can pass/fail it.
- [ ] Library remains unknown until the desk is observed even after fixing the ramp.
- [ ] Refresh preserves history and original observation age; reset restores fixtures.
- [ ] After successful initial load and service-worker activation, reload offline and see a dated cached journey.
- [ ] Print preview contains the synthetic-data warning and the full selected journey.
- [ ] No unexpected network calls, IDs, secrets or personal records.

Unchecked items are not claims of completion. No beneficiary trial, external security audit or conformance certification has been performed.
