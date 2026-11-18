# Notes for AI coding assistants

- Task: [ASSIGNMENT.md](ASSIGNMENT.md). FSM data model and the three APIs (Query, Data, Skill Service): [docs/FSM_GUIDE.md](docs/FSM_GUIDE.md). Official docs: https://help.sap.com/docs/SAP_FIELD_SERVICE_MANAGEMENT?locale=en-US
- Stack: Next.js 16 App Router, React 19, TypeScript, UI5 Web Components for React 2.x (required for the UI).
- All FSM access goes through `/api/fsm/...` (`src/lib/fsm/client.ts`). Never expose `FSM_CLIENT_SECRET` or the token to the browser, and never call FSM directly from client code.
- The FSM company is shared. Only create, update or delete Tags and Scales named `<NEXT_PUBLIC_CANDIDATE_ID>::…`, Skills that reference those Tags, and Attachments on those Skills (`src/lib/candidate.ts`). Persons and all other data are read-only.
- Proficiency levels come from the Skill Service (`skillSearch`, `skillApi`); `Skill.11` in the Data API has no proficiency field.
- Don't change the write allowlist in `src/app/api/fsm/[...path]/route.ts`.

## Project conventions

- Layers: UI (`src/components`, `src/app`) -> FSM services (`src/lib/fsm/services`) -> proxy. Components call the services; reads go through `useAsyncData` (`src/hooks`), which holds loading, error and reload. Pure rules live in `src/lib/domain` and have no FSM or React imports.
- Names follow the assignment: Skill (FSM Tag), Assignment (FSM Skill), Certificate (FSM Attachment), Level (FSM Proficiency). Only the services know the FSM names.
- Every update and delete goes through a service function that takes an id and re-reads the record from FSM before writing (`requireOwnSkill`, `requireOwnAssignments`). Do not call `skillApi` or `fsmDelete` for writes from anywhere else.
- Dates are `yyyy-MM-dd` strings. Do not parse them with `new Date(string)`; use the helpers in `src/lib/domain/status.ts`.
- Before any FSM behaviour is relied on, check it against the real company with a throwaway `<candidate>::` object and delete it afterwards.
- Run `npm run gate` before every commit. It must pass.
- Tests: unit tests in `tests/unit` (Vitest), `npm run smoke` against the real company. `npm run seed` and `npm run cleanup` manage the demo data.
- Keep code and comments short. Comments explain why, not what. English only, plain ASCII in code and output.
- Decisions and their reasons go to `docs/decisions.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
