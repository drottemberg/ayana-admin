# Ayana Admin

Ayana's admin frontend, built on the existing `gkManager-web` foundation and integrated with the Ayana backend.

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

## Production deployment

Pushing to the `production` branch runs `.github/workflows/deploy.yml`. The
workflow builds the Vite app with the production Ayana API and Socket.IO URLs,
then uploads `dist/` to `/data/project/ayana-admin` on the production server.
The GitHub repository needs the `SSH_PRIVATE_KEY` secret used by the backend
deployment workflow. The production web server should serve that directory for
`admin.ayana.club` and route unknown paths to `index.html` for client-side
routing.
