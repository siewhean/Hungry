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

  static loadFlags(flags: Record<string, FlagValue> | undefined): void {
    PostHogStub.flags = flags;
    for (const listener of PostHogStub.listeners) listener();
  }

  capture(event: string, properties?: Record<string, unknown>): void {
    PostHogStub.captured.push({ event, properties });
  }

  identify(_userId: string, _properties?: Record<string, unknown>): void {}

  reset(): void {}

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
