# Project

React + Vite SaaS web app.

**Stack:** React, TypeScript, Vite, Tailwind CSS, React Router

---

# Commands

```bash
npm run dev       # start dev server
npm run build     # production build
npm run preview   # preview production build
npm run lint      # lint
npm run typecheck # tsc --noEmit
```

---

# Code Philosophy

**Simple > clever.** Write the most boring, obvious solution that works. Do not add abstractions until they are needed twice. If you're unsure whether to extract something, don't.

Priorities (in order):
1. Minimal, clean code — no over-engineering
2. Strong TypeScript types — no `any`, no lying to the compiler
3. Tests for critical logic — not everything needs a test, but nothing scary ships untested
4. Consistent structure — follow existing patterns; don't reinvent conventions mid-project

---

# TypeScript

- Prefer `type` over `interface` for props and local shapes
- Never use `any` — use `unknown` and narrow it
- Avoid type assertions (`as Foo`) unless absolutely necessary and comment why
- Infer return types from functions unless the type is non-obvious or exported
- Use discriminated unions for state machines and API response variants

---

# React

- Functional components only
- One component per file; file name matches component name
- Props type defined directly above the component, not in a separate file
- Prefer composition over prop-drilling — but don't reach for Context for things that only need to go one level deep
- Keep components small. If a component is doing two things, split it
- `useEffect` is a last resort — derive state first, then event handlers, then effects
- Don't memoize (`useMemo`, `useCallback`) unless there's a measured performance reason

---

# Styling

- Tailwind utility classes only — no custom CSS unless Tailwind genuinely can't do it
- Keep class lists readable: break long `className` strings into multiple lines using template literals or `clsx`
- No inline `style={{}}` except for truly dynamic values (e.g. calculated widths, chart colors)
- Dark mode: use Tailwind's `dark:` variant — don't branch in JS

---

# Routing (React Router)

- Route definitions live in `src/router.tsx` (or `src/routes/index.tsx`) — one source of truth
- Use typed `useParams` and `useSearchParams` — define param shapes with types
- Prefer `<Outlet />` for nested layouts, not repeated layout wrappers per page
- Data loading goes in route loaders, not `useEffect` on mount

---

# File Structure

```
src/
  components/     # Reusable UI components (no business logic)
  features/       # Feature-scoped components, hooks, utils
  pages/          # Top-level route components — thin, mostly composition
  hooks/          # Shared custom hooks
  lib/            # Pure utilities, API clients, helpers
  types/          # Shared TypeScript types (sparingly — colocate when possible)
  router.tsx      # Route definitions
  main.tsx        # Entry point
```

- Colocate things that change together — don't spread a feature across 5 folders
- If something is only used in one place, keep it in that file
- Move to `components/` or `hooks/` only when reused in 2+ places

---

# API / Data Fetching

- Fetch in route loaders (React Router) when possible
- Encapsulate `fetch` calls in `src/lib/api.ts` — never call `fetch` raw in a component
- Always handle loading, error, and empty states — no optimistic "it'll be fine"
- Type API responses explicitly — don't trust `response.json()` to be correct

---

# Testing

- Test critical business logic and utilities in `src/lib/`
- Component tests only for non-trivial interaction logic (forms, state machines)
- Don't test implementation details — test behaviour from the user's perspective
- Skip tests for pure presentational components unless they have conditional rendering logic

---

# Do Not

- Do not add a library without asking first
- Do not create wrapper components that just re-export another component
- Do not add comments that explain *what* the code does — only *why* if it's non-obvious
- Do not use barrel `index.ts` re-exports unless the folder has 3+ exports
- Do not leave `console.log` in committed code
- Do not generate placeholder/lorem ipsum content in production components