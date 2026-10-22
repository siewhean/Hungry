import assert from "node:assert/strict";
import test from "node:test";
import { changePasswordValidation } from "./changePasswordValidation";
import { createExclusiveOperation } from "./exclusiveOperation";
import { isVerificationCode, remainingCooldownSeconds } from "./verificationCode";

test("actual RHF adapters ignore form values and enforce required label and minimum length", () => {
  const formValues = { currentPassword: "", newPassword: "Aa1!", confirmPassword: "Aa1!" };
  assert.equal(
    Reflect.apply(changePasswordValidation.currentPassword.validate, undefined, ["", formValues]),
    "Current password is required",
  );
  assert.equal(
    Reflect.apply(changePasswordValidation.newPassword.validate, undefined, ["Aa1!", formValues]),
    "Password must be at least 12 characters",
  );
});

test("same-turn repeated keyboard/tap submits invoke one operation and failure unlocks retry", async () => {
  const states: boolean[] = [];
  const run = createExclusiveOperation((state) => states.push(state));
  let finish!: () => void;
  let calls = 0;
  const operation = () => {
    calls += 1;
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  };
  const first = run(operation);
  await run(operation);
  assert.equal(calls, 1);
  finish();
  await first;
  await assert.rejects(
    run(async () => {
      throw new Error("Offline");
    }),
    /Offline/,
  );
  await run(async () => {
    calls += 1;
  });
  assert.equal(calls, 2);
  assert.deepEqual(states, [true, false, true, false, true, false]);
});

test("verification requires exactly eight digits and cooldown catches up after background time", () => {
  for (const invalid of ["123456", "1234567", "123456789", "abcdefgh"])
    assert.equal(isVerificationCode(invalid), false);
  assert.equal(isVerificationCode("12345678"), true);
  assert.equal(remainingCooldownSeconds(60000, 0), 60);
  assert.equal(remainingCooldownSeconds(60000, 59700), 1);
  assert.equal(remainingCooldownSeconds(60000, 120000), 0);
});

test("recovery retries reuse exchanged code after update failure and retire with generation", async () => {
  const { createRecoveryCodeExchange } = await import("./recoveryCodeExchange");
  const exchange = createRecoveryCodeExchange();
  const client = {};
  let generation = 1;
  let exchanges = 0;
  const perform = async () => {
    exchanges += 1;
  };
  await exchange(client, "one-use-code", generation, () => generation, perform);
  // The updateUser step can reject without invalidating the successful exchange.
  await assert.rejects(Promise.reject(new Error("Update offline")), /offline/);
  await exchange(client, "one-use-code", generation, () => generation, perform);
  assert.equal(exchanges, 1);
  generation += 1;
  await exchange(client, "one-use-code", generation, () => generation, perform);
  assert.equal(exchanges, 2);
});

test("failed recovery exchange is retryable and a retired in-flight exchange rejects", async () => {
  const { createRecoveryCodeExchange } = await import("./recoveryCodeExchange");
  const exchange = createRecoveryCodeExchange();
  const client = {};
  let generation = 1;
  await assert.rejects(
    exchange(
      client,
      "code",
      generation,
      () => generation,
      async () => {
        throw new Error("Offline");
      },
    ),
    /Offline/,
  );
  let finish!: () => void;
  const pending = exchange(
    client,
    "code",
    generation,
    () => generation,
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  generation += 1;
  finish();
  await assert.rejects(pending, /session changed/);
});

test("deletion outcomes distinguish unknown, processing, absent and confirmed cancellation", async () => {
  const { parseDeletionStatus, isDeletionCancellationConfirmed } =
    await import("./accountDeletionOutcomes");
  assert.equal(parseDeletionStatus(null), null);
  assert.throws(() => parseDeletionStatus({}), /confirm/);
  assert.equal(
    parseDeletionStatus({ status: "processing", scheduledFor: new Date().toISOString() })?.status,
    "processing",
  );
  assert.equal(isDeletionCancellationConfirmed({ outcome: "processing" }), false);
  assert.equal(isDeletionCancellationConfirmed({ outcome: "not_pending" }), false);
  assert.equal(isDeletionCancellationConfirmed({ outcome: "cancelled" }), true);
});
