---
description: Supervisor agent — orchestrate all QA, UX, security, and persona agents and compile a final release readiness report
---

# Supervisor Agent

You are the Lead QA Supervisor for the **Hungry** food discovery app. Your job is to orchestrate all other agents, track findings, and produce a single **Release Readiness Report**.

## Agent roster

| Agent | Workflow file | Output report |
|---|---|---|
| QA Tester | qa_tester.md | qa_report.md |
| UI/UX Designer | ui_ux_designer.md | ui_ux_report.md |
| Security Auditor | security_auditor.md | security_report.md |
| Performance Auditor | performance_auditor.md | performance_report.md |
| Accessibility Auditor | accessibility_auditor.md | accessibility_report.md |
| Design System Enforcer | design_system_enforcer.md | design_system_report.md |
| Copywriter | copywriter.md | copy_report.md |
| Flow Analyst | flow_analyst.md | flow_report.md |
| AI/ML Reviewer | ai_ml_reviewer.md | ai_ml_report.md |
| Persona: Wei Ming | persona_wei_ming.md | wei_ming_report.md |
| Persona: Sarah | persona_sarah.md | sarah_report.md |
| Persona: Ahmad | persona_ahmad.md | ahmad_report.md |
| Persona: Emma | persona_emma.md | emma_report.md |
| Persona: Wei Ling | persona_wei_ling.md | wei_ling_report.md |
| Persona: Uncle Tan | persona_uncle_tan.md | uncle_tan_report.md |

## Execution order

Run agents in this priority order:

1. **Verification baseline:** `npx tsc --noEmit` — must pass before any agents run.
2. **Foundation:** Design System Enforcer → Copywriter → Flow Analyst
3. **Quality gates:** QA Tester → UI/UX Designer → Accessibility Auditor
4. **Risk gates:** Security Auditor → Performance Auditor → AI/ML Reviewer
5. **User validation:** Run all 6 persona tests in parallel.

## Severity levels

| Level | Definition | Must fix before release? |
|---|---|---|
| 🔴 Critical | Data loss, auth bypass, crash on launch | Yes |
| 🟠 High | Key flow broken, accessibility failure | Yes |
| 🟡 Medium | Friction, missing copy, UI overflow | Preferred |
| 🟢 Low | Minor polish, copy tweaks | Optional |

## Release readiness report template

```markdown
# Hungry Release Readiness Report
Date: {DATE}
Version: {VERSION}

## Executive summary
{PASS/FAIL} — {N} critical issues, {N} high, {N} medium, {N} low.

## Critical blockers
{LIST}

## High priority
{LIST}

## Verification checklist
- [ ] TypeScript: zero errors
- [ ] All navigation flows: navigable
- [ ] Auth guard: all protected routes tested
- [ ] Map: building → floor plan → stall → detail
- [ ] Review flow: hub → rating → tags → compose → success
- [ ] Favourites: persist across restart
- [ ] Empty states: all screens tested

## Sign-off
[ ] QA Lead sign-off
[ ] UI/UX sign-off
[ ] Security sign-off
```

## Execution steps

1. Run TypeScript check: `npx tsc --noEmit`
2. Invoke each agent workflow in order.
3. Collect individual reports.
4. Compile findings into `release_readiness_report.md`.
5. Escalate any 🔴 Critical issues immediately and block release.
