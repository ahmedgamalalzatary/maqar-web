# Maqar (مقر)

Real-estate platform for buyers, owners and sales agents. pnpm + Turborepo monorepo.

**[docs/project-contract.md](docs/project-contract.md) is the project contract.** Every feature, rule and decision lives there, and anything new is added there first. [docs/phases.md](docs/phases.md) is the build plan: one vertical feature per phase, each finished green before the next.

## Layout

| Path | Package | What |
|---|---|---|
| `apps/demo` | `@maqar/demo` | Next.js front-end demo (mobile layout, all data in localStorage) |
| `apps/mobile` | `@maqar/mobile` | Expo (SDK 58, Expo Router) app for iOS and Android |
| `apps/api` | `@maqar/api` | NestJS 12 API, MySQL through Drizzle ORM |
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
pnpm test
```

One app:

```sh
pnpm --filter @maqar/demo dev      # http://localhost:3210
pnpm --filter @maqar/mobile dev    # Expo dev server
pnpm --filter @maqar/api dev       # NestJS in watch mode
```

## API database

```sh
cp apps/api/.env.example apps/api/.env   # then set DATABASE_URL
pnpm --filter @maqar/api db:generate     # SQL migrations from src/db/schema.ts
pnpm --filter @maqar/api db:migrate
pnpm --filter @maqar/api db:studio
```
