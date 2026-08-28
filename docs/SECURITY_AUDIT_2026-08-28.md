# ResearchRanker security and release audit — 2026-08-28

## Baseline

The latest `main` revision passed the existing GitHub Actions production build before this audit. Production deployment remains operational on the last successful Vercel release, while newer deployment attempts are affected by the Vercel build-rate limit.

## Fixed in this hardening batch

1. **AI summary authorization** — `/api/ai/summarize` now requires a Clerk user session before a paid Gemini request can be made.
2. **AI abuse controls** — per-user Redis-backed fixed-window rate limits were added to both AI endpoints.
3. **AI request timeouts** — Gemini calls now have explicit server-side timeouts to avoid long-running function requests.
4. **Provider error containment** — raw upstream provider error messages are no longer returned directly to clients.
5. **Stored article input bounds** — saved library fields and URLs are normalized and length-limited before Redis storage.
6. **Private library caching** — library-list responses explicitly use private no-store caching and no longer expose raw Redis exception text.
7. **Browser security headers** — baseline anti-sniffing, frame, referrer, and browser-permission headers were added globally.
8. **CI gates** — lint and TypeScript checks now run before the Next.js build, and CI covers all `agent/**` branches.
9. **Operational documentation** — the default starter README was replaced with project-specific setup, quality, reliability, and deployment documentation.

## Remaining priorities

### High priority

- Add request-cost controls to public scholarly-search endpoints. The global search path can perform multiple upstream calls and should eventually have IP/session throttling and stricter result caps.
- Correct the client-side quartile filter so a Q1/Q2/Q3/Q4 selection excludes unverified records instead of keeping them in the selected result set.
- Add unit tests for journal-identification confidence rules and regression tests for ISSN/title matching.

### Medium priority

- Replace set-based full-library reads with a paginated/sorted index. Current library and saved-search list endpoints use `SMEMBERS` followed by `MGET`, which will become inefficient for very large accounts.
- Refactor the very large `app/advanced-search/page.tsx` and `app/api/global-search/route.ts` files into smaller modules with isolated tests.
- Preprocess the SCImago CSV into a compact indexed server artifact instead of parsing a large CSV on cold starts.
- Add end-to-end tests for sign-in, search, save, library update, export, and AI authorization flows.

### Release process

Do not merge this batch to `main` until GitHub CI is green. Once Vercel's build-rate limit clears, merge or fast-forward the reviewed branch and verify `/api/health`, `/search`, `/results`, `/library`, and `/iraqi-journals` on the new production deployment.
