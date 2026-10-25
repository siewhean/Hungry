export enum PostHogPersistedProperty {
  Queue = "queue",
}
type FlagValue = boolean | string;

/**
 * Stand-in for posthog-react-native in node tests. Tests can set
 * `PostHogStub.flags` (undefined means "not loaded yet") and read
 * `PostHogStub.captured`.
 */
export default class PostHogStub {
  static flags: Record<string, FlagValue> | undefined;
  static captured: { event: string; properties?: Record<string, unknown> }[] = [];
  static listeners = new Set<() => void>();
  static options: Record<string, unknown>[] = [];
  static queue: unknown[] = [];
  static optedOut = false;
  static requests = 0;
  static distinctUserId: string | undefined;
  static latest: PostHogStub | undefined;

  constructor(_key: string, options: Record<string, unknown>) {
    PostHogStub.options.push(options);
    PostHogStub.latest = this;
  }
  fetch(_url: string, _options: unknown) {
    PostHogStub.requests += 1;
    return Promise.resolve({ status: 200, text: async () => "{}", json: async () => ({}) });
  }
  optIn(): Promise<void> {
    PostHogStub.optedOut = false;
    return Promise.resolve();
  }
  optOut(): Promise<void> {
    PostHogStub.optedOut = true;
    return Promise.resolve();
  }
  setPersistedProperty(_key: PostHogPersistedProperty, value: unknown[]): void {
    PostHogStub.queue = value;
  }

  static loadFlags(flags: Record<string, FlagValue> | undefined): void {
    PostHogStub.flags = flags;
    for (const listener of PostHogStub.listeners) listener();
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    PostHogStub.captured.push({ event, properties });
  }

  identify(userId: string, _properties?: Record<string, unknown>): void {
    PostHogStub.distinctUserId = userId;
  }

  reset(): void {
    PostHogStub.distinctUserId = undefined;
  }

  register(_properties: Record<string, unknown>): Promise<void> {
    return Promise.resolve();
  }

  getFeatureFlags(): Record<string, FlagValue> | undefined {
    return PostHogStub.flags;
  }

  getFeatureFlagResult(
    key: string,
    options?: { sendEvent?: boolean },
  ): { key: string; enabled: boolean; variant?: string } | undefined {
    const value = PostHogStub.flags?.[key];
    if (options?.sendEvent !== false) {
      this.capture("$feature_flag_called", { $feature_flag: key, $feature_flag_response: value });
    }
    if (value === undefined) return undefined;
    return typeof value === "string"
      ? { key, enabled: true, variant: value }
      : { key, enabled: value };
  }

  getFeatureFlag(key: string): FlagValue | undefined {
    const result = this.getFeatureFlagResult(key);
    return result?.variant ?? result?.enabled;
  }

  onFeatureFlags(callback: () => void): () => void {
    PostHogStub.listeners.add(callback);
    return () => PostHogStub.listeners.delete(callback);
  }
}
