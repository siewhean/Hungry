# Hungry Active Backlog

> Canonical active task surface.
> Update this file first when task status changes.
> Historical narrative stays in `tasks/session-log.md` and `tasks/todo.md`.

| id | owner | area | status | evidence | verification | last_updated | notes |
|---|---|---|---|---|---|---|---|
| SEC-01 | User | Security | Open | `SECURITY.md` | Supabase dashboard toggle confirmed manually | 2026-04-25 | Enable Leaked Password Protection in Supabase dashboard |
| SEC-02 | Codex | Security | Open | `.gitignore` | `git diff -- .gitignore` | 2026-04-25 | Add `supabase/.temp/` ignore rule |
| CLM-04 | Gemini | Merchant Claim | Open | Copy spec page not yet authored | Review against Stall claim flow | 2026-04-25 | CTA + verification explainer copy/spec |
| OCR-DG-01 | Codex | Sprint 10 Done Gate | Open | staging smoke not yet recorded in canonical form | Staging upload -> OCR -> `dishes_draft` evidence | 2026-04-25 | End-to-end OCR under 30s |
| OCR-DG-02 | Codex | Sprint 10 Done Gate | Open | claim CTA code exists; staging proof not recorded here | Telemetry + row insert in staging | 2026-04-25 | Claim flow staging smoke |
| OCR-DG-03 | Codex | Sprint 10 Done Gate | Blocked | Jest tooling issue documented in `tasks/todo.md` | `npm test` fully green in current environment | 2026-04-25 | Node/esbuild environment issue |
| OCR-DG-04 | Codex | Sprint 10 Done Gate | Open | flag logic implemented | Staging/prod flag read verified | 2026-04-25 | `merchantClaimCtaEnabled` OFF prod, ON staging |
| C4 | Gemini | Sprint 11 Features | Open | `tasks/todo.md` Sprint 11 | `npm run typecheck` after implementation | 2026-04-25 | Messaging expansion: group chats, voice notes, location sharing |
| C6 | Gemini | Sprint 11 Features | Open | `tasks/todo.md` Sprint 11 | `npm run typecheck` after implementation | 2026-04-25 | Gamification V2 |
| C7 | Gemini | Sprint 11 Features | Open | `tasks/todo.md` Sprint 11 | `npm run typecheck` after implementation | 2026-04-25 | Carousel overhaul |
| WEB-11 | Codex + User | Marketing Site | Open | `marketing/web/` build already passes | Preview + production deploy verified | 2026-04-25 | Deploy to Vercel and attach domain |
| GRAPHIFY-01 | User | Tooling | Blocked | `tasks/todo.md` session log | Local config edit + Codex restart | 2026-04-25 | Graphify MCP not yet connected in active config |

