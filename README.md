# Maqar (مقر)

Real-estate platform for buyers, owners and sales agents. pnpm + Turborepo monorepo.

**[docs/project-contract.md](docs/project-contract.md) is the project contract.** Every feature, rule and decision lives there, and anything new is added there first. [docs/phases.md](docs/phases.md) is the build plan: one vertical feature per phase, each finished green before the next.

## Layout

| Path | Package | What |
|---|---|---|
| `apps/demo` | `@maqar/demo` | Next.js front-end demo (mobile layout, all data in localStorage) |
| `apps/mobile` | `@maqar/mobile` | Expo (SDK 58, Expo Router) app for iOS and Android |
| `apps/api` | `@maqar/api` | NestJS 12 API, MySQL through Drizzle ORM |
| `packages/shared` | `@maqar/shared` | Enums, labels, API types and formatters used by api and mobile |
| `packages/tsconfig` | `@maqar/tsconfig` | Shared TypeScript configs |

## Requirements

- Node 22+
- pnpm 12 (`corepack enable` picks the version from `package.json`)
- MySQL 8 for the API

## Commands

Run from the repo root:

```sh
pnpm install
pnpm dev          # every app
pnpm build
pnpm lint
pnpm typecheck
pnpm test         # unit + UI tests (api: vitest, mobile: Jest + Testing Library)
pnpm test:e2e     # api e2e against the maqar_test database
```

One app:

```sh
pnpm --filter @maqar/demo dev      # http://localhost:3210
pnpm --filter @maqar/mobile dev    # Expo dev server
pnpm --filter @maqar/api dev       # NestJS in watch mode, http://localhost:4010/v1 (docs at /docs)
```

## Environment

One `.env` at the repo root is used by every app. Tests read the root `.env.test` instead.

```sh
cp .env.example .env
```

Create `.env.test` next to it with the same variables and test values:

```sh
NODE_ENV=test
PORT=4001
DATABASE_URL=mysql://root:<password>@localhost:3306/maqar_test
EXPO_PUBLIC_API_URL=http://localhost:4001/v1
```

## API database

```sh
pnpm --filter @maqar/api db:generate     # SQL migrations from src/db/schema.ts
pnpm --filter @maqar/api db:migrate
pnpm --filter @maqar/api db:studio
```
