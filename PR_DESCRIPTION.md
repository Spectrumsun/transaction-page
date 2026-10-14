## What this does

Implements the Transactions page at `/transactions` with filters (search, type, status, currency, date range), pagination, transaction details drawer, and proper handling of loading/empty/error states. The page preserves filters in the URL and reads them on load, and matches existing design tokens/components.

## Changes outside the Transactions page

None. Only added `app/transactions/page.tsx` and `app/transactions/page.module.css`.

## Decisions

- Followed existing UI primitives and CSS module patterns (mirrors Convert page and dashboard structure).
- Used the existing API client (`getTransactions`), formatting utilities, and transaction row component for list items.
- Mapped status to badges using existing tone values; used `formatMoney` for fee display in details.
- Navigating back/refresh preserves selections via URL params as requested.
- Kept responsiveness minimal (added basic mobile styles) consistent with existing app patterns.

## Noticed but not fixed

- TransactionRow uses `dangerouslySetInnerHTML` for narration (already present in codebase; mock data includes an XSS payload).
- API client logs full responses to console (existing behavior, not part of the assignment).

## How I tested it

- `npm run typecheck` passes
- `npm run lint` passes
- `npm test` passes (all existing tests still pass)
- `npm run build` succeeds
- `npm run format:check` passes

## AI usage

Not used.

## Time spent

About 1-1.5 hours
