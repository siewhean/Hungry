export default class PostHogStub {
  capture(_event: string, _properties?: Record<string, unknown>): void {}

  identify(_userId: string, _properties?: Record<string, unknown>): void {}

  reset(): void {}
}
