# Data model and provenance

All data in `data/journeys.json` was authored as synthetic fixtures for this prototype. It is not a real campus map or a field audit. Do not use it to travel.

| Entity | Fields |
|---|---|
| Journey | id, name, purpose, fictional owner, ordered segment IDs |
| Segment fixture | id, name, detail, status, ageHours, validHours |
| Runtime observation | observedAt, expiresAt, status |
| Repair claim | demo actor, timestamp |
| Event | segmentId, type, actor, optional recheck result, timestamp |

Relative fixture ages are converted at the first load/reset. Refresh replays saved actions against the original start time; it does not refresh stale evidence. The fixture narrative is fixed context, while the displayed workflow status changes.

No names, phone numbers, precise user locations, diagnoses, disability certificates or IDs are required. Demo history remains in this browser's localStorage and can be reset. For a public/shared computer, reset after use or clear site data. No analytics or external API requests are included.

Future field observations require permission, clear dates, a named institutional role and agreed retention. Avoid photos containing people or identity details. The current configurable validity periods are demo choices, not official accessibility standards.
