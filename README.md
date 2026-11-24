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

UI implementation conventions are documented in [`docs/UI_STYLE.md`](docs/UI_STYLE.md).

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
The repository needs an Actions secret named `SSH_PRIVATE_KEY` containing the
unencrypted private deploy key authorized on the production server (not its
`.pub` file). Raw PEM/OpenSSH text, escaped `\n` line breaks, or Base64-encoded
PEM are accepted. The production web server should serve that directory for
`admin.ayana.club` and route unknown paths to `index.html` for client-side
routing.

## Mobile app (Capacitor)

The separate `club.ayana.admin` iOS and Android app packages this Vite frontend.
Vite loads `.env`, `.env.production`, and the matching mode-specific files during
builds. Copy `.env.production.example` to `.env.production` for native production
builds, or set the `VITE_*` values in your local env files. Build and open a native
project with `npm run cap:ios` or `npm run cap:android`; run `npm run cap:sync`
after changing native plugins or configuration. Regenerate branded launcher and
splash assets with `npm run cap:assets`.

Register `club.ayana.admin` in Capgo once and configure `CAPGO_TOKEN` as a GitHub
Actions secret in this repository. The production deploy workflow uploads Vite
bundles to its `production` channel. OTA updates change web assets only; native plugin,
permission, or configuration changes require a new store build.
