// Дар Варп-Зрение в Проявлении вытесняет автоматический «Ослеплён −30» (живая проверка pr-584-ws-30).
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { resolveTest } from "../../module/rules/resolve-test.mjs";

const blindPossessed = manifested => ({
  type: "character",
  system: { possessed: true, possession: { manifested }, conditions: { blinded: true }, characteristics: {} },
  items: [{ type: "talent", name: "Warp Sight / Дар: Варп-Зрение", system: {} }]
});
const blindedIds = actor => {
  const r = resolveTest({ actor, kind: "skill", skill: "awareness", char: "per" });
  return [...r.autoMods, ...r.mods].map(m => m.ruleId).filter(id => String(id).startsWith("conditions.blinded"));
};

describe("Варп-Зрение и Ослепление", () => {
  it("в Проявлении штрафа Ослепления нет", () => {
    expect(blindedIds(blindPossessed(true))).toEqual([]);
  });
  it("без Проявления штраф остаётся", () => {
    expect(blindedIds(blindPossessed(false))).toContain("conditions.blinded");
  });
});
