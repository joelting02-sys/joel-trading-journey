# JOEL · Trading Journal

Trading journal and analytics dashboard built with React, TypeScript, Vite, TailwindCSS, Chart.js, Zustand, and Supabase.

## Local development

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
```

## Cloudflare Pages deployment

Production deploys are handled by `.github/workflows/deploy-pages.yml` on every push to `main`.

The repository must have these GitHub Actions secrets configured:

- `CLOUDFLARE_API_TOKEN`: token with Cloudflare Pages edit permission
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID that owns the Pages project

The workflow runs `pnpm install --frozen-lockfile`, type-checks, builds `dist`, then uploads it to the `joel-trading-journey` Pages project. It also supports manual runs from the GitHub Actions tab.

## App architecture

- `src/pages/Analytics.tsx`: risk-first analytics dashboard
- `src/utils/analytics.ts`: net P&L and account-aware metrics
- `src/utils/drawdown.ts`: equity-based drawdown and underwater periods
- `functions/api/`: Cloudflare Pages Functions for API proxy routes
