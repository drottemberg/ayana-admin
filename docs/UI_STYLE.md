# Ayana Admin UI style

Keep new screens consistent with the existing Ayana Admin interface. Before building a page or module, inspect a nearby page for the same kind of content and reuse its components, spacing, typography, colors, and interaction patterns.

## Lists and tables

- Use `DataTableAsync` for standard entity lists so search, filters, URL state, pagination, row actions, and table styling stay consistent.
- For a purpose-built table, follow `src/components/data-table.tsx`: place it in a `rounded-lg border bg-card` container with `overflow-hidden`, use `TableHeader` with `bg-muted/40`, and use the shared `Table`, `TableRow`, `TableHead`, and `TableCell` components.
- Keep table headings, cell spacing, empty states, numeric alignment, and pagination consistent with nearby lists. Use the shared `TablePagination` component.
- Make related records navigable with `Link` from `react-router-dom`. Link order codes to `/orders/:orderId` and users to `/users/:userId`; show a readable name when available and the ID as the fallback.

## Pages and details

- Use the shared `PageHeader`, `Card`, `DetailPageLayout`, and form controls instead of inventing page-specific structures.
- Use existing theme tokens such as `border-border`, `bg-card`, `bg-muted`, `text-muted-foreground`, and the standard semantic badge/button variants.
- Match existing page padding and responsive breakpoints. Check both narrow and wide layouts for overflow.
- Keep labels, empty states, and action placement aligned with similar screens. Avoid adding explanatory implementation notes to the product UI.

## Before finishing a UI change

Compare the result with an existing screen of the same type and confirm that links, empty states, loading states, spacing, and responsive behavior follow the established patterns. Document new reusable patterns here so later screens can follow them.
