// Мимик и Непримечательный: штраф чужому тесту против носителя (Разобрать b73dj).
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { TARGET_SOCIAL_TALENT_RULES, isMimic, isUnremarkable } from "../../module/rules/library/target-social-talents.mjs";

const withTalent = name => ({ items: [{ type: "talent", name, system: {} }] });
describe("Мимик и Непримечательный", () => {
  it("носители распознаются", () => {
    expect(isMimic(withTalent("Mimic / Мимик"))).toBe(true);
    expect(isUnremarkable(withTalent("Unremarkable / Непримечательный"))).toBe(true);
    expect(isMimic(withTalent("Unremarkable"))).toBe(false);
  });
  it("правила — галочки против цели-носителя", () => {
    const [mimic, unrem] = TARGET_SOCIAL_TALENT_RULES;
    expect(mimic.effects[0]).toMatchObject({ value: -10, askOnly: true, target: "skill:scrutiny" });
    expect(unrem.effects[0].value).toBe(-20);
    const actor = { items: [], system: {} };
    const m = resolveTest({ actor, kind: "skill", skill: "scrutiny", targetActor: withTalent("Mimic / Мимик") }).mods;
    expect(m.map(x => x.ruleId)).toContain("talent.mimic.scrutiny");
    const u = resolveTest({ actor, kind: "skill", skill: "awareness", targetActor: withTalent("Unremarkable / Непримечательный") }).mods;
    expect(u.find(x => x.ruleId === "talent.unremarkable.identify")?.value).toBe(-20);
    expect(resolveTest({ actor, kind: "skill", skill: "scrutiny", targetActor: withTalent("Other") }).mods).toEqual([]);
  });
});
