# Web Package

## Decision

Build `packages/web` with Next.js.

## Context

Ultrahope user experience flow:
1. Discover Ultrahope on Product Hunt or X
2. Visit the website
3. Want to try it
4. Create an account
5. Download the CLI
6. Authenticate via Device Flow

## Why Next.js

- **Account management** — signup, login, profile
- **Billing flow** — Polar.sh integration
- **Device Flow** — `/device` verification page
- **API Playground** — interactive UI to try the API
- **SSR/dynamic features** — static site is insufficient for the requirements above

Astro was considered, but the number of dynamic features led us to choose Next.js.

## Scope

- Landing page
- `/device` — Device Flow verification page
- Pricing / billing
- Docs
- API Playground
- Account management
