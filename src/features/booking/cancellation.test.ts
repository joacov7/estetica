import { describe, it, expect } from "vitest";
import { canModifyByClient } from "./cancellation";

const H = 60 * 60 * 1000;
const now = 1_000_000_000_000;

describe("canModifyByClient", () => {
  it("rejects past or in-progress appointments", () => {
    expect(canModifyByClient(now, now - H, 24)).toBe(false);
    expect(canModifyByClient(now, now, 24)).toBe(false);
  });

  it("allows any future time when the window is 0 or negative", () => {
    expect(canModifyByClient(now, now + 60_000, 0)).toBe(true);
    expect(canModifyByClient(now, now + 60_000, -5)).toBe(true);
  });

  it("allows when outside the free-cancellation window", () => {
    expect(canModifyByClient(now, now + 25 * H, 24)).toBe(true);
    expect(canModifyByClient(now, now + 24 * H, 24)).toBe(true); // exactly at the edge
  });

  it("rejects when inside the window", () => {
    expect(canModifyByClient(now, now + 23 * H, 24)).toBe(false);
    expect(canModifyByClient(now, now + 1 * H, 24)).toBe(false);
  });
});
