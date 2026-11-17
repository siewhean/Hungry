# Playbook: Design Handoff

## Gemini -> Codex handoff contract

For any UI task, Gemini should provide:

1. target task IDs
2. screen/component names
3. exact visual delta
4. spacing/type/color/token rules
5. interaction/motion notes
6. acceptance criteria
7. source artifact path

Codex should then:

1. implement only that scoped delta
2. verify against source artifact
3. run verification bundle if code changed materially
4. update `tasks/backlog.md` and `tasks/session-log.md`

## If design is missing

Stop and create/approve design first.

