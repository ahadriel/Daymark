# Daymark

A calm, local-first daily planner for turning a noisy list into a clear plan. Daymark keeps tasks in this browser, needs no account, and is designed to work as a static GitHub Pages site.

## What it does

- Add, complete, search, filter, and clear tasks
- See a live completion ring and task counts
- Keep your list in browser storage on this device
- Use `Ctrl/⌘ + K` to jump to search
- Use the responsive layout on desktop and mobile

## Run locally

Requires Node.js 20.19+ or 22.12+ and pnpm 10.

```sh
pnpm install
pnpm dev
```

Create a production build with `pnpm build`; preview it with `pnpm preview`.

## GitHub Pages

The Vite base path is `/Daymark/`, matching the repository name. The included GitHub Actions workflow builds on pushes to `main` and publishes `dist` to GitHub Pages. In the repository settings, set Pages source to **GitHub Actions**.

Tasks are stored in local browser storage and do not sync across devices or browsers. Clearing site data removes them.
