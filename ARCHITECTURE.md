# SupplyFlow architecture

SupplyFlow is a static browser application backed by Supabase.

## Responsibilities

- `app.js`: application state, calculations, rendering and persistence.
- `interactions.js`: optional animation and keyboard enhancement; no billing logic.
- `styles.css`: structural layout and base components.
- `bill.css`: bill-entry components.
- `theme.css`: visual tokens and ocean-tech presentation.
- `session.css`: authentication and loading states.

## Invariants

- GST is opt-in per row and fixed at 8%.
- Packing is snapshotted on each bill item.
- Rates prefer the saved packing snapshot over current product defaults.
- Database writes use Supabase RPCs for atomic bill operations.
- Motion is progressive enhancement and respects reduced-motion preferences.

Keep business rules out of `interactions.js`, escape user-provided text, and
validate values before invoking database operations.
