---
paths: ["apps/web/src/components/**", "apps/web/src/pages/**", "apps/web/src/routes/**", "apps/web/src/hooks/**"]
---
# Frontend Rules

## Component patterns

- Functional components only — no class components
- State: local state via hooks; lift to a store (zustand/jotai/context) only for truly shared state
- Memoize expensive work with `useMemo` / `useCallback`; never sprinkle them defensively
- `PascalCase` for components, `camelCase` for hooks (`useXxx`) and utilities
- Extract logic from components into custom hooks once a component crosses ~150 lines

## Async & loading

- Every async operation handles three states: loading, error, empty/success
- Loading states show a meaningful indicator — never a blank screen
- Error states include a recovery action (retry, navigate, clear instruction)
- Fetch with `@tanstack/react-query` (or similar) — never `useEffect(() => fetch(...))`

## Accessibility

- Semantic HTML first: `<button>`, `<nav>`, `<main>`, `<article>` over `<div>`
- ARIA labels on interactive elements without visible text
- Full keyboard navigation — every interactive control reachable and operable via keys
- Color contrast meets WCAG AA (4.5:1 for normal text)

## Styling

- CSS modules or Tailwind — avoid global stylesheets and class name collisions
- Mobile-first responsive design
- No inline styles except for genuinely dynamic values (computed positions, sizes)

## Testing

- Test rendering and user interaction, not internal implementation
- Prefer `screen.getByRole` / `getByLabelText` over `getByTestId`
- Mock network at the request boundary (msw), not internal functions
