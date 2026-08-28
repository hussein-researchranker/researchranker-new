# ResearchRanker

ResearchRanker is a Next.js research discovery and evidence-management platform. It combines scholarly search, journal intelligence, saved libraries, screening workflows, open-access checks, citation utilities, and AI-assisted synthesis.

## Core stack

- Next.js 16 and React 19
- Clerk authentication
- Upstash Redis for user libraries, saved searches, and alerts
- Crossref, OpenAlex, PubMed/NCBI, Unpaywall, and a server-side SCImago snapshot
- Gemini for authenticated AI summaries and library-grounded assistance

## Local setup

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Before running authenticated or data-backed features, configure the required environment variables in `.env.local`:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
GEMINI_API_KEY=
UNPAYWALL_EMAIL=
```

Do not commit secrets or production credentials.

## Quality checks

Run the same core checks used by CI:

```bash
npm run lint
npm run typecheck
npm run build
```

Or run all three with:

```bash
npm run check
```

## Important routes

- `/search` and `/advanced-search` — research discovery
- `/results` — ranked and verified result review
- `/article` — DOI-level metadata and trust signals
- `/library` — saved evidence workspace and screening
- `/library/export` — standards-oriented export
- `/iraqi-journals` — Iraqi journal explorer
- `/dashboard` — researcher workspace overview
- `/api/health` — deployment and Redis health signal

## Academic reliability

ResearchRanker distinguishes verified journal evidence from unverified metadata. Quartiles and indexing claims should only be treated as verified when the platform has strong journal-identification evidence. Researchers should still check publisher and indexing records before making publication, promotion, or accreditation decisions.

AI outputs are assistance only. They must not be treated as primary evidence and should be checked against the underlying article text.

## Deployment

The production project is hosted on Vercel and linked to the repository's `main` branch. GitHub Actions performs linting, TypeScript checks, and a production build before changes should be promoted.
