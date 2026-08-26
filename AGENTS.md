<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ResearchRanker Agent Operating Rules

## Mission
Maintain and extend ResearchRanker as a reliable research-discovery and journal-evaluation web application. Preserve working behavior unless the requested task explicitly requires a change.

## Project baseline
- Framework: Next.js 16.x with React 19 and TypeScript.
- Styling: Tailwind CSS v4.
- Authentication: Clerk.
- Persistence: Upstash Redis for user-specific library data.
- Search/data sources currently include Crossref, OpenAlex, PubMed, and a local SCImago CSV.
- AI functionality currently includes article summarization.
- The app includes dashboard, search wizard, results, journal pages, Iraqi journals, library actions, exports, and legal PDF/Open Access checks.

## Non-negotiable safety rules
1. Never expose secrets, API keys, tokens, environment variables, cookies, or credentials in source control, logs, screenshots, comments, issues, or pull requests.
2. Never commit `.env*` files containing secrets.
3. Never weaken authentication or authorization to make a feature easier to implement.
4. Never destroy or overwrite production user data without explicit approval.
5. Never remove an existing working feature unless the task explicitly requires it.
6. Never claim a journal is Q1/Q2/Q3/Q4 from a weak title match. Prefer exact ISSN matching or strong verified metadata.
7. Treat ambiguous journal matches as unverified and surface that uncertainty in the UI/API.
8. Prefer legal Open Access links. Do not implement piracy or bypass publisher access controls.
9. Do not fabricate research metadata, DOI values, journal metrics, indexing status, citations, or publisher information.

## Change workflow
Before editing:
1. Inspect the relevant existing files and call graph.
2. Identify the smallest safe set of files required for the change.
3. Preserve current public routes and API contracts unless migration is intentional.
4. Read relevant Next.js 16 guidance from the installed docs when touching routing, server/client boundaries, middleware/proxy behavior, caching, or async request APIs.

During implementation:
1. Keep TypeScript types explicit for external API payloads and internal normalized models.
2. Validate external responses defensively; assume fields can be missing or malformed.
3. Keep server-only secrets and filesystem access out of Client Components.
4. Avoid unnecessary dependencies.
5. Prefer small reusable components over large duplicated pages.
6. Keep Arabic RTL support and English research terminology readable.
7. Preserve current user-specific Clerk/Redis key isolation.
8. For journal verification, prioritize exact ISSN; then exact normalized title; otherwise return unverified/manual-check status.
9. For external APIs, handle timeout, non-2xx responses, empty results, and rate limits gracefully.

Before completion:
1. Run the production build.
2. Run lint when available and relevant.
3. Fix all introduced TypeScript/build errors.
4. Review the diff for leaked secrets or accidental unrelated changes.
5. Summarize what changed, what was tested, and any remaining limitations.

## Git discipline
- Never develop directly on `main` for agent-driven changes unless explicitly instructed.
- Use a dedicated branch for each meaningful task.
- Keep commits focused and descriptive.
- Prefer a pull request into `main` after validation.
- Do not force-push or rewrite shared history without explicit approval.

## ResearchRanker product constraints
- Search quality and metadata correctness are more important than returning a large number of results.
- Arabic search expansion may improve discovery, but must not alter stored source metadata.
- SCImago quartile matching must remain conservative.
- OpenAlex/Crossref/PubMed metadata should be normalized but source provenance should remain traceable.
- PDF/Open Access checks should prefer verified legal sources and clearly distinguish direct PDF from landing pages.
- User library operations must remain scoped to the authenticated Clerk user.
- Any future journal recommendation score must expose why a journal was recommended rather than returning an opaque score alone.

## Stop conditions
Stop and request explicit approval before:
- deleting production data;
- changing authentication provider or identity model;
- changing billing/payment behavior;
- rotating or replacing credentials;
- destructive database migrations;
- making a previously private dataset public;
- removing a major working feature;
- changing the production domain or deployment ownership.
