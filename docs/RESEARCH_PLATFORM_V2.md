# Research Platform V2

ResearchRanker V2 evolves the application from a search interface into a researcher workspace.

## Architecture

- **Library V2**: collections, tags, notes, favourites, reading status, BibTeX/RIS/Zotero-oriented export.
- **Saved searches**: persistent queries with transparent relevance-scored rechecks.
- **Systematic review workspace**: Include/Exclude/Maybe screening, exclusion reasons, full-text tracking, duplicate detection, review counts, PRISMA progress, and extraction-ready metadata.
- **Grounded AI**: library-only synthesis with source identifiers for every substantive claim.
- **Article evidence page**: bibliographic metadata, identifiers, OA status, saved journal intelligence, Crossref relations, OpenAlex retraction signal, provenance, AI summary, and links.
- **Relationship graph**: OpenAlex references, cited-by works, related works, author frequency, and timeline views.
- **Journal finder**: evidence-aware candidate journal discovery with explicit caveats where APC/review-time/quartile evidence is unavailable.
- **Trust layer**: provenance, Crossref/OpenAlex resolution signals, retraction/update metadata, and verification timestamps.
- **Mobile UX**: dedicated bottom navigation for core researcher workflows.
- **Infrastructure**: Frankfurt primary function region with European failover, aligned with Upstash Redis.

## Safety principles

1. Never present an unverified quartile as verified.
2. Never infer APC or review time without a source.
3. Ground AI synthesis only in user-selected library records.
4. Preserve provenance and verification timestamps.
5. Treat relationship graphs and relevance scores as discovery aids, not quality judgments.
6. Do not auto-delete duplicates or infer systematic-review counts that were not recorded.

## Release validation

The V2 application build was validated with `npm ci` and `npm run build` in GitHub Actions before promotion to `main`.
