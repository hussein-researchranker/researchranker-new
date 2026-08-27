# Research Platform V2

This branch evolves ResearchRanker from a search interface into a researcher workspace.

## Architecture

- **Library V2**: collections, tags, notes, favourites, reading status, BibTeX/RIS/Zotero export.
- **Saved searches**: persistent queries with transparent relevance-scored rechecks.
- **Systematic review workspace**: Include/Exclude/Maybe screening, exclusion reasons, review counts and extraction-ready metadata.
- **Grounded AI**: library-only synthesis with source identifiers for every substantive claim.
- **Article evidence page**: bibliographic metadata, OA status, Crossref relations, provenance, AI summary and links.
- **Relationship graph**: OpenAlex references, cited-by works and related works.
- **Journal finder**: evidence-aware candidate journal discovery with explicit caveats where APC/review-time/quartile evidence is unavailable.
- **Trust layer**: provenance, Crossref/OpenAlex resolution signals and update/relation metadata.
- **Infrastructure**: Frankfurt primary function region with European failover, aligned with Upstash Redis.

## Safety principles

1. Never present an unverified quartile as verified.
2. Never infer APC or review time without a source.
3. Ground AI synthesis only in user-selected library records.
4. Preserve provenance and verification timestamps.
5. Treat relationship graphs and relevance scores as discovery aids, not quality judgments.
