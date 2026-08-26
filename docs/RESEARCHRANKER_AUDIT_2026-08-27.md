# ResearchRanker Baseline Audit

Date: 2026-08-27
Branch reviewed: `main`
Audit type: static source and architecture review

## Executive summary

ResearchRanker has a solid functional prototype: Next.js 16, Clerk, Upstash Redis, Crossref/OpenAlex/PubMed discovery, conservative SCImago matching in the current global search, Gemini summaries, user library storage, Open Access checks, and Iraqi-journal filtering. The current production build is deployable, but the application still has several production-hardening gaps.

The highest-priority problem is authentication enforcement. The root `proxy.ts` invokes `clerkMiddleware()` but does not itself protect routes. Current Clerk behavior is opt-in: routes remain public unless protected close to the resource. The library endpoints correctly call `auth()` and reject unauthenticated users, but the AI summarization, global search, legacy search, PDF check, news endpoints, and main product pages do not enforce authentication themselves. This is inconsistent with a login-first product and exposes AI/API capacity to anonymous use.

The second major correctness problem is the legacy PubMed endpoint. `/api/search` still uses an approximate partial-title SCImago match that can assign a quartile to the wrong journal. The large `/advanced-search` page still calls this legacy API. The newer `/api/global-search` implementation is much safer because it prioritizes exact ISSN, exact normalized title, and a strict token threshold.

## Findings

| ID | Severity | Area | Finding | Risk | Recommended action |
|---|---|---|---|---|---|
| RR-001 | Critical | Authentication | `proxy.ts` calls `clerkMiddleware()` without route protection. Product pages and several API endpoints also lack `auth.protect()` / explicit `auth()` checks. | Anonymous users can reach product pages and invoke server endpoints; Gemini usage can be abused and product behavior does not match login-first intent. | Protect each sensitive page and API route close to the resource. Keep only intentional public routes public. |
| RR-002 | High | Journal correctness | Legacy `/api/search` uses partial `includes()` title matching and labels those results `Approximate title match`, while still copying SCImago quartile/SJR/H-index. `/advanced-search` still calls this route. | False Q1/Q2/Q3/Q4 assignments are possible. | Remove approximate quartile assignment. Reuse the strict ISSN/exact-title logic from `global-search`, or retire the legacy route/page. |
| RR-003 | High | AI cost / abuse | `/api/ai/summarize` has no authentication, per-user quota, or rate limit. | Anonymous or automated traffic can consume Gemini quota/cost and degrade service. | Require Clerk auth and add per-user/IP rate limiting in Redis before the Gemini call. |
| RR-004 | High | External API load | `global-search` can return up to 100 Crossref items and then calls OpenAlex concurrently for every unmatched DOI through `Promise.all`. | Burst traffic can trigger OpenAlex/Crossref limits and serverless resource pressure. | Add bounded concurrency, request timeouts, retries with backoff, and caching. Reduce default maximum results. |
| RR-005 | Medium | Privacy / configuration | A personal contact email is hard-coded in OpenAlex/Crossref User-Agent strings and used as the Unpaywall fallback. The repository is public. | Avoidable personal identifier exposure and configuration duplication. | Move all contact identity to a server-side environment variable such as `RESEARCHRANKER_CONTACT_EMAIL`; do not use a personal literal in source. |
| RR-006 | Medium | Scientific integrity | Gemini instructions explicitly tell the model to infer objectives and methodology when not stated. | Summaries can present inferred study design/objectives as if extracted from the paper. | Distinguish `explicit` vs `inferred`, add confidence/provenance fields, and prefer `not stated in abstract` for methodology that is not actually present. |
| RR-007 | Medium | Input validation | Global search year parsing accepts arbitrary numeric values and does not reject `fromYear > toYear`; query/field values are only lightly normalized. | External API failures, confusing results, and unnecessary load. | Validate ranges, allowed field enum, DOI shape, and bounded query length before external calls. |
| RR-008 | Medium | Library scalability | User library IDs and stored article payloads are client-controlled and there is no quota. `list` loads every saved ID and performs one large `mget`. | A single authenticated account can create oversized keys/payloads or a very large library, causing Redis cost/latency. | Canonicalize/hash IDs, cap field lengths, add a per-user item quota, and paginate list results. |
| RR-009 | Medium | Source-of-truth integrity | Library save accepts client-provided quartile, indexing status, SJR, H-index, publisher, ISSN, and match confidence without server-side re-verification. | Saved records can contain stale or forged verification metadata. | Store provenance and verification timestamp; for verified status, persist only values produced/validated server-side. |
| RR-010 | Medium | Performance | `public/scimagojr.csv` is about 11.2 MB and is parsed on server cold start. It is also publicly downloadable because it is under `public/`. | Larger deployment footprint, repeated cold-start parsing, unnecessary public exposure. | Move server-only ranking data outside `public/` and preprocess into a compact lookup structure keyed by normalized ISSN/title. |
| RR-011 | Medium | Maintainability | `app/advanced-search/page.tsx` is ~92 KB and duplicates search, citation, library, AI, news, export, and filtering logic. | High regression risk and difficult maintenance. | Decompose into typed modules/components and converge on the modern `/search` -> `/results` flow. |
| RR-012 | Medium | Testing / CI | No GitHub Actions workflow is present. `package.json` has build and lint scripts but no explicit `typecheck` or test script. | Regressions depend primarily on Vercel build detection; correctness logic has no automated coverage. | Add `typecheck`, unit tests for journal matching/normalization, API validation tests, and CI on pull requests. |
| RR-013 | Low | Dead code | `ArticleResultCard.tsx` and `SearchResults.tsx` return `null`. | Confusion and architecture drift. | Remove them if unused or implement them as the shared result components. |
| RR-014 | Low | Product completeness | `/journals` is still a placeholder slider and the dashboard news cards describe future functionality. | UI advertises unfinished capabilities. | Mark explicitly as beta/coming soon or complete the feature before production marketing. |
| RR-015 | Low | Documentation | `README.md` is still the default create-next-app README and does not document required environment variables, APIs, deployment, security model, or data provenance. | Poor reproducibility and risky future maintenance. | Replace with project-specific setup, environment-variable names, architecture, deployment, and data-refresh procedures. |
| RR-016 | Low | Future-proofing | `/results` hard-codes `toYear: "2026"`. | Searches silently become stale in future years. | Use `new Date().getFullYear()` or a validated user-selected year. |
| RR-017 | Low | Metadata / localization | Root layout uses `lang="en"` while most primary UI is Arabic/RTL. | Accessibility and search/assistive metadata are less accurate. | Set language/direction intentionally per product locale or page. |

## Positive controls already present

- `.env*` files are ignored by Git.
- Upstash Redis is initialized lazily and secrets remain server-side.
- Library save/list/delete endpoints explicitly derive Clerk `userId` and namespace Redis keys per user.
- Current `global-search` SCImago matching is conservative: exact ISSN first, exact normalized title next, then a strict token similarity threshold.
- Results UI only labels Q1-Q4 as `Verified` when the match-confidence value indicates a strict match.
- PDF/Open Access checks use Unpaywall and distinguish direct PDF from landing-page availability.
- External source links are opened with `noopener,noreferrer` in the main results UI.
- Current Vercel deployment status for the baseline `main` commit was successful during this audit.

## Priority remediation plan

### Phase 1 — Security gate

1. Protect product pages and sensitive API routes with Clerk resource-level checks.
2. Add Redis-backed rate limiting to AI and search endpoints.
3. Remove the hard-coded personal contact email from server source.
4. Add bounded request sizes and external API timeouts.

Exit criterion: anonymous requests cannot invoke paid/sensitive endpoints, signed-in functionality remains intact, and Vercel build succeeds.

### Phase 2 — Journal verification unification

1. Extract one shared server-only SCImago matching module.
2. Make exact ISSN the primary verification path.
3. Remove quartile assignment from approximate legacy title matches.
4. Migrate or retire `/api/search` and `/advanced-search`.
5. Add unit tests for similar journal names, multiple ISSNs, missing source metadata, and false-positive cases.

Exit criterion: there is one journal-verification policy across all product surfaces.

### Phase 3 — Reliability and performance

1. Preprocess SCImago data to a compact server-only index.
2. Limit concurrent OpenAlex requests.
3. Add timeout/backoff behavior for Crossref/OpenAlex/PubMed/Unpaywall/Gemini.
4. Validate all search request parameters.
5. Paginate/limit the Redis library.

### Phase 4 — Scientific-output quality

1. Redesign AI summary schema to distinguish extracted facts from inference.
2. Improve citation generation or adopt a tested CSL-compatible approach.
3. Persist source provenance and verification timestamps with library records.
4. Verify the Iraqi journal dataset from authoritative sources before marking any entry as classified.

### Phase 5 — Engineering hygiene

1. Add `npm run typecheck`.
2. Add tests and GitHub Actions PR CI.
3. Refactor the 92 KB legacy client page.
4. Remove dead stubs.
5. Replace the default README with operational documentation.

## Scope limitations

This audit reviewed repository source and deployment status. It did not execute a penetration test, inspect Vercel/Clerk/Upstash account configuration, run `npm audit`, inspect production logs, test external APIs under load, or validate every Iraqi journal record against current live indexing databases. Those require separate runtime/account-level checks.

## Recommended next pull request

The first production code PR should address **RR-001, RR-003, RR-005, and RR-007**: authentication, rate limiting, contact-email configuration, and request validation. These changes have the highest security value while keeping feature behavior stable for authenticated users.
