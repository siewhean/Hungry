interface ExchangeAttempt {
  client: object;
  code: string;
  generation: number;
  promise: Promise<void>;
}
/** Keep only the successful, still-current exchange, so update failures can retry. */
export function createRecoveryCodeExchange() {
  let attempt: ExchangeAttempt | undefined;
  return async (
    client: object,
    code: string,
    generation: number,
    getGeneration: () => number,
    exchange: () => Promise<void>,
  ) => {
    if (attempt?.client === client && attempt.code === code && attempt.generation === generation)
      return attempt.promise;
    const current: ExchangeAttempt = { client, code, generation, promise: Promise.resolve() };
    current.promise = exchange()
      .then(() => {
        if (generation !== getGeneration())
          throw new Error("Recovery session changed. Request a new reset email.");
      })
      .catch((error: unknown) => {
        if (attempt === current) attempt = undefined;
        throw error;
      });
    attempt = current;
    return current.promise;
  };
}
