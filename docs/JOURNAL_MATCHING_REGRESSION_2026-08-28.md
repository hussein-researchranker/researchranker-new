# ResearchRanker journal matching regression policy — 2026-08-28

ResearchRanker must not assign a SCImago quartile from weak journal-identification evidence. The production global-search route now uses the same pure matching module exercised by unit tests.

## Evidence order

1. A valid normalized 8-character ISSN exact match is the strongest evidence and takes precedence over title evidence.
2. A normalized journal-title exact match is accepted when no ISSN match is available.
3. A strict token match is accepted only when both sides contain at least two meaningful title tokens, at least two tokens are shared, and Jaccard token similarity is at least 0.92.
4. Otherwise no SCImago match is returned and the quartile remains unverified.

## Safety corrections

- ISSN punctuation and internal spacing are normalized, but malformed/short identifiers are rejected instead of participating in exact matching.
- A single generic word such as `medicine` can no longer produce a strict-token quartile match by itself.
- Weak partial title overlaps continue to return no match.

## Regression coverage

`tests/journal-matching.test.mjs` covers:

- punctuation/spacing-insensitive valid ISSN matching;
- rejection of malformed short ISSNs;
- ISSN precedence over a competing exact title;
- normalized exact-title matching;
- accepted high-confidence multi-token matching;
- rejection of weak token overlap;
- rejection of one-token generic false positives;
- rejection when both journal title and ISSN evidence are absent.

The suite runs through `npm run test:unit` in permanent CI together with dependency audit, ESLint, TypeScript, and the production build.
