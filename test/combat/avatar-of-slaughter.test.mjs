// test/combat/avatar-of-slaughter.test.mjs
//
// module/combat/avatar-of-slaughter.mjs (wdbc-sk8s) — раз за бой, трата 1
// Очка Бесчестия, тест W−10 цели, провал метит цель на −20 (следствие —
// rules/library/avatar-of-slaughter.mjs + предикат, см.
// test/rules/avatar-of-slaughter-rule.test.mjs).

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { hasAvatarOfSlaughter, avatarOfSlaughterAvailable, applyAvatarOfSlaughter }
  from "../../module/combat/avatar-of-slaughter.mjs";

function berserker({ hasTrait = true, fate = 3 } = {}) {
  const flags = {};
  const data = {
    name: "Берсерк",
    items: hasTrait ? [{ type: "trait", name: "Avatar of Slaughter / Аватар Резни" }] : [],
    system: { fate: { value: fate, max: 5 } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
  data.update = async patch => {
    if (patch["system.fate.value"] !== undefined) data.system.fate.value = patch["system.fate.value"];
  };
  return data;
}

function target(wpTotal = 40) {
  const flags = {};
  return {
    name: "Жертва",
    uuid: "Actor.target1",
    system: { characteristics: { wp: { total: wpTotal } } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
}

afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("hasAvatarOfSlaughter / avatarOfSlaughterAvailable", () => {
  it("определяет владение Чертой", () => {
    expect(hasAvatarOfSlaughter(berserker({ hasTrait: true }))).toBe(true);
    expect(hasAvatarOfSlaughter(berserker({ hasTrait: false }))).toBe(false);
  });
  it("раз за бой — второй раз недоступно", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const b = berserker();
    expect(avatarOfSlaughterAvailable(b)).toBe(true);
    await applyAvatarOfSlaughter(b, target());
    expect(avatarOfSlaughterAvailable(b)).toBe(false);
  });
});

describe("applyAvatarOfSlaughter", () => {
  it("тратит 1 Очко Бесчестия независимо от исхода теста", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const b = berserker({ fate: 2 });
    captured.nextRoll = 99; // почти наверняка провал против разумного порога
    await applyAvatarOfSlaughter(b, target(40));
    expect(b.system.fate.value).toBe(1);
  });

  it("провал теста W−10 цели — метит её флагом", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const b = berserker();
    const t = target(40); // порог 30
    captured.nextRoll = 90; // 90 > 30 — провал
    await applyAvatarOfSlaughter(b, t);
    expect(t.getFlag("warhammer-dbc", "avatarOfSlaughterMark")).toEqual({ berserkerUuid: b.uuid });
    expect(captured.chat[0].content).toContain("Провал");
  });

  it("успешный тест — метка не ставится", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const b = berserker();
    const t = target(40); // порог 30
    captured.nextRoll = 10; // 10 <= 30 — успех
    await applyAvatarOfSlaughter(b, t);
    expect(t.getFlag("warhammer-dbc", "avatarOfSlaughterMark")).toBeUndefined();
    expect(captured.chat[0].content).toContain("Устояла");
  });

  it("без Очков Бесчестия — не уходит в минус", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const b = berserker({ fate: 0 });
    captured.nextRoll = 50;
    await applyAvatarOfSlaughter(b, target());
    expect(b.system.fate.value).toBe(0);
  });

  it("без цели — ничего не делает", async () => {
    const b = berserker();
    await expect(applyAvatarOfSlaughter(b, null)).resolves.toBeUndefined();
  });
});
