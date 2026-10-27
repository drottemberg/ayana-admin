# Ayana Admin UI style

Keep new screens consistent with the existing Ayana Admin interface. Before building a page or module, inspect a nearby page for the same kind of content and reuse its components, spacing, typography, colors, and interaction patterns.

## Lists and tables

- Use `DataTableAsync` for standard entity lists so search, filters, URL state, pagination, row actions, and table styling stay consistent.
- Put list scoping controls (such as Customer and Location) in the `DataTableAsync` filter bar. Do not add a separate selector above a general list when the value is a list filter; use its async `queryFn` for searchable, paginated options and let the shared table keep the filter in the URL.
- Use `AppDrawer` for create/edit forms opened from a list or detail page. Do not use a `Dialog`/modal for those forms; follow the existing drawer width, header, scrollable body, and fixed footer patterns.
- For a purpose-built table, follow `src/components/data-table.tsx`: place it in a `rounded-lg border bg-card` container with `overflow-hidden`, use `TableHeader` with `bg-muted/40`, and use the shared `Table`, `TableRow`, `TableHead`, and `TableCell` components.
- Keep table headings, cell spacing, empty states, numeric alignment, and pagination consistent with nearby lists. Use the shared `TablePagination` component.
- Make related records navigable with `Link` from `react-router-dom`. Link order codes to `/orders/:orderId` and users to `/users/:userId`; show a readable name when available and the ID as the fallback.

## Pages and details

- Use the shared `PageHeader`, `Card`, `DetailPageLayout`, and form controls instead of inventing page-specific structures.
- Use existing theme tokens such as `border-border`, `bg-card`, `bg-muted`, `text-muted-foreground`, and the standard semantic badge/button variants.
- For deleted records, keep the row visible when the Deleted status filter is selected, clearly label it Deleted, and hide actions that target active records. Keep Disabled and Deleted visually distinct.
- When a price is discounted, preserve and show the original price, applied price, discount percentage, and named source in purchase history. Do not rely on the current partnership record to reconstruct an old order.
- Match existing page padding and responsive breakpoints. Check both narrow and wide layouts for overflow.
- Keep labels, empty states, and action placement aligned with similar screens. Avoid adding explanatory implementation notes to the product UI.

## Before finishing a UI change

Compare the result with an existing screen of the same type and confirm that links, empty states, loading states, spacing, and responsive behavior follow the established patterns. Document new reusable patterns here so later screens can follow them.
