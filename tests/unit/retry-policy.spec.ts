import { describe, expect, it } from "vitest";
import { backoffMs, isTransientFailure } from "../../src/worker/delivery";

describe("delivery retry policy", () => {
  it("marks transient failure for network/unknown status", () => {
    expect(isTransientFailure()).toBe(true);
  });

  it("marks transient failure for 5xx and 429", () => {
    expect(isTransientFailure(500)).toBe(true);
    expect(isTransientFailure(503)).toBe(true);
    expect(isTransientFailure(429)).toBe(true);
  });

  it("marks non-transient for normal 4xx errors", () => {
    expect(isTransientFailure(400)).toBe(false);
    expect(isTransientFailure(404)).toBe(false);
  });

  it("uses exponential backoff with cap", () => {
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(2)).toBe(2000);
    expect(backoffMs(3)).toBe(4000);
    expect(backoffMs(10)).toBe(30000);
  });
});
