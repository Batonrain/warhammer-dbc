// test/rules/bronze-myrmidon.test.mjs
//
// wdbc-1rno.1: hasActiveMachineTrait/redirectHitLocationForMachine — без
// Foundry, actor — plain object с .items.

import { describe, it, expect } from "vitest";
import { hasActiveMachineTrait, redirectHitLocationForMachine }
  from "../../module/rules/bronze-myrmidon.mjs";

const actorWith = (items) => ({ items });

describe("hasActiveMachineTrait", () => {
  it("нет предметов — false", () => {
    expect(hasActiveMachineTrait(actorWith([]))).toBe(false);
  });

  it("есть Трейт Machine — true", () => {
    expect(hasActiveMachineTrait(actorWith([{ type: "trait", name: "Machine / Машина (4)" }]))).toBe(true);
  });

  it("похожий по началу английского имени Талант (Machine Empathy) НЕ совпадает — false", () => {
    expect(hasActiveMachineTrait(actorWith([{ type: "trait", name: "Machine Empathy" }]))).toBe(false);
  });

  it("Трейт с другим именем — false", () => {
    expect(hasActiveMachineTrait(actorWith([{ type: "trait", name: "Unnatural Toughness" }]))).toBe(false);
  });

  it("предмет другого типа с именем Machine — не считается (не kind trait)", () => {
    expect(hasActiveMachineTrait(actorWith([{ type: "talent", name: "Machine" }]))).toBe(false);
  });

  it("null/undefined актор — false, не бросает", () => {
    expect(hasActiveMachineTrait(null)).toBe(false);
    expect(hasActiveMachineTrait(undefined)).toBe(false);
  });
});

describe("redirectHitLocationForMachine", () => {
  const withMachine = actorWith([{ type: "trait", name: "Machine / Машина (4)" }]);
  const withoutMachine = actorWith([]);

  it("без Трейта — метка не меняется", () => {
    expect(redirectHitLocationForMachine("Сочленение / Шея", withoutMachine)).toBe("Сочленение / Шея");
    expect(redirectHitLocationForMachine("Глаз (Голова)", withoutMachine)).toBe("Глаз (Голова)");
  });

  it("с Трейтом — Сочленение/Шея → Рука", () => {
    expect(redirectHitLocationForMachine("Сочленение / Шея", withMachine)).toBe("Рука");
  });

  it("с Трейтом — Глаз (Голова) → Голова", () => {
    expect(redirectHitLocationForMachine("Глаз (Голова)", withMachine)).toBe("Голова");
  });

  it("с Трейтом — прочие метки не трогаются", () => {
    expect(redirectHitLocationForMachine("Торс", withMachine)).toBe("Торс");
    expect(redirectHitLocationForMachine("Голова", withMachine)).toBe("Голова");
  });
});
