# PTrack Fleet Intelligence (foundation slice)
Run: `npm install && npm run dev`. Verify engine on a CSV: `npm test -- path/to/task.csv`. Modules 3-6 engine checks: `npx tsx scripts/test-modules.ts [real.csv]` (synthetic in-memory fixture, plus KM reconciliation on a real file).
## Architecture
- `src/engine/` pure TypeScript, no UI: `fields.ts` (CSV mapping), `build.ts` (Task Master vs Task History split, timestamp parsing, validation), `kpis.ts` (every KPI with formula, sources, included/excluded). An API adapter can return the same `Row[]` and call `build()` unchanged.
- `src/pages/` Import and Executive Overview. All 8 modules are built: 1 Overview, 2 Trip Analytics, 3 Company/Location, 4 Vehicle, 5 Driver, 6 Employee & Occupancy, 7 Odometer & KM Audit, 8 Employee Activity & Vendor Audit.
- `src/engine/groups.ts` is the single grouping/aggregation logic for modules 3-5 (`groupBy`); `src/engine/occupancy.ts` for module 6. `src/pages/EntityModule.tsx` is one implementation behind both Vehicle and Driver so their numbers cannot drift apart. Shared UI: `components/Kit.tsx` (tiles, tables, drill-down), `components/Filters.tsx`.
## Rules implemented
- Trips = COUNT(DISTINCT Task_ID); history rows kept separately; distance/employees/odometer read once per task.
- Master values come from the latest history row; conflicts across rows are flagged. Blank and "-" are missing, never zero.
- Distance(m)/1000; Odometer KM = end - start; KM_GAP flag = needs review, not proof of misuse.
## Requires PTrack Confirmation
Team_Name = company; Order_ID meaning; Agent_Username/Agent_ID = driver; authoritative status; scheduled date as trip date; employee field for "travelled"; completion-rate denominator; KM-gap threshold (default 10 km, placeholder); required-field policy.
## Not yet built
Exception Management screen, exports beyond CSV, API service interfaces, sync UI, handover document (full).

## Added requiring PTrack confirmation (modules 3-6)
Order_ID / address as 'location' (selectable); Agent_Username as driver; odometer compliance = both readings present and end >= start; avg trip duration = Started at to Successful at; Vehicle/Driver 'Requiring Review' = any warning/critical issue on their tasks; occupancy % and over/under-utilization NOT computed (no capacity field).

## Added from the v11 audit dashboard (Employee Activity tabs + accuracy)
- Employee Activity & Vendor Audit now has: A Employee Activity, B Team Upload, C Location Performance, D Vendor Analytics (`pages/TeamUpload.tsx`, `pages/LocationPerformance.tsx`; engines `engine/teamupload.ts`, `engine/locperf.ts`).
- Exception Management (`/exceptions`, `engine/exceptions.ts`): rule-based findings (missing / reused / identical odometer images, repeated start reading, missing start or success event, modified after completion, suspicious duration, invalid GPS, missing driver/vehicle, odometer audit). Review status is saved in the browser only; export to keep it.
- Parser now also reads `Status updated from X to Y by NAME` and `Successful at NAME`; exact duplicate history rows are counted once.
- Defaults aligned to v11: odometer vs PTrack tolerance 5 km, plausible trip 300 km. Employees travelled defaults to In Cab Employees because Actual_Emp is 1 on ~97% of trips in the sample export (changeable in Settings).
- Employee location rule (v11): PICKUP trip = Pickup_Address, DROP trip = Customer_Address. Order_ID matched it on ~99% (PICKUP) and ~91% (DROP) of the sample file.
- Tests: `npx tsx scripts/test-activity.ts [real.csv]`.

## Audit Plus (from v11): Risk Score, KM Compare & Billing, Status Audit
- `/audit-plus` (`pages/AuditPlus.tsx`, `engine/risk.ts`). Risk score weights/tolerances are the v11 defaults and are editable on screen; scores are review priorities, not proof.
- KM Compare uses PTrack distance vs odometer distance only. v11's Google/OSM map-KM comparison needs an API key + network and is not included.
- Not built (need several dates in the data): Repeat Offenders, vehicle-day KM spikes. Data is kept in browser memory per import; persistent multi-day storage (IndexedDB, append + de-duplicate like v11) is the next step to unlock them.
