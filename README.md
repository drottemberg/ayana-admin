# Ayana Admin

Frontend based on the existing `gkManager-web` application. The project has been copied into the `ayana-admin` repository; Ayana-specific feature and API adaptation is planned as a later step.

## Requirements

- Node.js 22 (Volta is configured in `package.json`)
- npm

## Install and run

```bash
npm ci
npm run dev
```

The development server runs at `http://localhost:5173` by default.

## Scripts

- `npm run dev` — start Vite
- `npm run build` — type-check and build the production bundle
- `npm run preview` — preview the production bundle
- `npm run lint` — run ESLint
- `npm run mock:api` — start the copied gkManager mock API on port 3001

The copied frontend still uses the API contract and visual identity from `gkManager-web`. The Ayana backend integration and feature adaptation are not part of this initial copy.
