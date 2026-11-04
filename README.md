# PTrack Fleet Intelligence (foundation slice)
Run: `npm install && npm run dev`. Verify engine on a CSV: `npm test -- path/to/task.csv`.
## Architecture
- `src/engine/` pure TypeScript, no UI: `fields.ts` (CSV mapping), `build.ts` (Task Master vs Task History split, timestamp parsing, validation), `kpis.ts` (every KPI with formula, sources, included/excluded). An API adapter can return the same `Row[]` and call `build()` unchanged.
- `src/pages/` Import and Executive Overview. Modules 1 (Overview), 2 (Trip Analytics), 7 (Odometer & KM Audit) and 8 (Employee Activity & Vendor Audit) are built. Others are routed but not built.
## Rules implemented
- Trips = COUNT(DISTINCT Task_ID); history rows kept separately; distance/employees/odometer read once per task.
- Master values come from the latest history row; conflicts across rows are flagged. Blank and "-" are missing, never zero.
- Distance(m)/1000; Odometer KM = end - start; KM_GAP flag = needs review, not proof of misuse.
## Requires PTrack Confirmation
Team_Name = company; Order_ID meaning; Agent_Username/Agent_ID = driver; authoritative status; scheduled date as trip date; employee field for "travelled"; completion-rate denominator; KM-gap threshold (default 10 km, placeholder); required-field policy.
## Not yet built
Modules 2-8, Exception Management screen, exports beyond CSV, API service interfaces, sync UI, handover document (full).
