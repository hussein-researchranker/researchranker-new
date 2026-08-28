# ResearchRanker global search guardrails — 2026-08-28

This release-hardening change bounds the cost and abuse surface of the public scholarly search route without requiring users to sign in.

## Controls

- Public search is limited to 30 requests per 10-minute fixed window per best-effort client fingerprint.
- The client fingerprint is SHA-256-derived from proxy IP headers plus basic request metadata; raw IP addresses are not stored in the rate-limit key.
- Search queries are limited to 500 normalized characters.
- Unknown field filters fall back to `all` rather than being forwarded as arbitrary field values.
- Publication year inputs are clamped to a safe range and inverted ranges are rejected.
- Crossref result requests are capped at 50 records per request.
- OpenAlex fallback enrichment is capped at 12 unmatched DOI-bearing records per search request.
- Crossref and OpenAlex outbound requests have a 12-second timeout.
- Rate-limit responses return HTTP 429 with standard retry/rate metadata.
- Redis/rate-limit unavailability fails closed with HTTP 503 instead of silently allowing unbounded upstream traffic.
- Upstream timeouts return HTTP 504.
- Successful search responses are marked `private, no-store` and include rate-limit metadata.

## Automated regression coverage

The project now uses Node's built-in test runner for search guardrail policies. Tests cover query normalization and size limits, allowed search fields, result caps, year validation, hashed client keys, and OpenAlex enrichment caps. `npm run test:unit` is part of the permanent GitHub CI pipeline alongside dependency audit, ESLint, TypeScript, and the production build.

## Release dependency

This branch is stacked on the security-hardening branch because it reuses the Redis-backed `checkRateLimit` helper introduced there. It should be merged only after the security-hardening change, or rebased once that change reaches `main`.
