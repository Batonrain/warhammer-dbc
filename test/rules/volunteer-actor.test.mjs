// test/rules/volunteer-actor.test.mjs
import { describe, it, expect } from "vitest";
import {
  scheduleMimicWireSurgery, isMimicWireSurgeryReady,
  MIMIC_WIRE_SURGERY_DURATION
} from "../../module/rules/volunteer-actor.mjs";

describe("scheduleMimicWireSurgery / isMimicWireSurgeryReady", () => {
  it("дедлайн — +16ч от текущего worldTime", () => {
    expect(scheduleMimicWireSurgery(1000)).toBe(1000 + MIMIC_WIRE_SURGERY_DURATION);
  });
  it("готово — ровно на дедлайне и позже", () => {
    expect(isMimicWireSurgeryReady(1000, 999)).toBe(false);
    expect(isMimicWireSurgeryReady(1000, 1000)).toBe(true);
    expect(isMimicWireSurgeryReady(1000, 2000)).toBe(true);
  });
  it("нет дедлайна — не готово, не падает", () => {
    expect(isMimicWireSurgeryReady(null, 999999)).toBe(false);
    expect(isMimicWireSurgeryReady(undefined, 999999)).toBe(false);
  });
});
