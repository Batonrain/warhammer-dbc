// test/apps/legacy-weapon-soulbound-hatred-activate.test.mjs
//
// activateSoulboundLegacyBonus / activateLegacyHatredShield (module/apps/
// legacy-weapon.mjs) — Душесвязанное/skilled 7-7 и Щит Ненависти/vigilant
// 9-9 (wdbc-1rno.35, стр. 427): свободное действие/Реакция с кнопки листа
// оружия, до сих пор системе не хватало.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { activateSoulboundLegacyBonus, activateLegacyHatredShield, legacyHatredShieldArms } from "../../module/apps/legacy-weapon.mjs";

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});

function actor({ wpTotal = 40, wpBonus = 4, infBonus = 5, pr = 0, reactions = 1, type = "character" } = {}) {
  const flags = {};
  const a = {
    id: "a1", uuid: "Actor.a1", name: "Носитель", type,
    system: {
      characteristics: { wp: { total: wpTotal, bonus: wpBonus }, inf: { bonus: infBonus, total: infBonus * 10 } },
      psyker: { currentRating: pr },
      reactions: { value: reactions }
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; },
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".");
        let node = a;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  return a;
}

function weapon(mutationName, owner) {
  return {
    id: "w1", name: "Клинок", type: "weapon",
    system: { weaponClass: "melee", legacy: { active: true, mutations: [{ name: mutationName }] } },
    actor: owner
  };
}

describe("activateSoulboundLegacyBonus — мирная ветка (тест W+0)", () => {
  it("успех — заряжает флаг ½W.b(окр.▲)", async () => {
    const a = actor({ wpTotal: 40, wpBonus: 4 }); // ½×4=2
    const w = weapon("Душесвязанное", a);
    captured.dice = [30]; // 1d100=30 ≤ 40 — успех
    await activateSoulboundLegacyBonus(w);
    expect(a.getFlag("warhammer-dbc", "legacySoulboundBonus")).toEqual({ weaponId: "w1", bonus: 2, willJam: false });
  });

  it("провал — флаг не ставится", async () => {
    const a = actor({ wpTotal: 40, wpBonus: 4 });
    const w = weapon("Душесвязанное", a);
    captured.dice = [50]; // 50 > 40 — провал
    await activateSoulboundLegacyBonus(w);
    expect(a.getFlag("warhammer-dbc", "legacySoulboundBonus")).toBeUndefined();
  });

  it("нет владельца — предупреждает, не катает", async () => {
    const w = weapon("Душесвязанное", null);
    await activateSoulboundLegacyBonus(w);
    expect(captured.chat.length).toBe(0);
  });

  it("нет Мутации на оружии — ничего не делает", async () => {
    const a = actor();
    const w = weapon("Другая Мутация", a);
    captured.dice = [1];
    await activateSoulboundLegacyBonus(w);
    expect(a.getFlag("warhammer-dbc", "legacySoulboundBonus")).toBeUndefined();
    expect(captured.chat.length).toBe(0);
  });
});

describe("activateSoulboundLegacyBonus — психическая ветка (Психотест W+5×ПС)", () => {
  it("нет Рейтинга Психосил — предупреждает, не катает", async () => {
    const a = actor({ pr: 0 });
    const w = weapon("Душесвязанное", a);
    await activateSoulboundLegacyBonus(w, { psychic: true });
    expect(captured.chat.length).toBe(0);
  });

  it("успех без дубля/99 — заряжает эPR, willJam:false", async () => {
    const a = actor({ wpTotal: 40, pr: 3 }); // порог 40+15=55
    const w = weapon("Душесвязанное", a);
    captured.dice = [30]; // ≤55, не дубль, не 99
    await activateSoulboundLegacyBonus(w, { psychic: true });
    expect(a.getFlag("warhammer-dbc", "legacySoulboundBonus")).toEqual({ weaponId: "w1", bonus: 3, willJam: false });
  });

  it("успешный дубль (22) — заряжает бонус, willJam:true", async () => {
    const a = actor({ wpTotal: 40, pr: 3 }); // порог 55
    const w = weapon("Душесвязанное", a);
    captured.dice = [22]; // ≤55 успех, 22%11===0 — дубль
    await activateSoulboundLegacyBonus(w, { psychic: true });
    expect(a.getFlag("warhammer-dbc", "legacySoulboundBonus")).toEqual({ weaponId: "w1", bonus: 3, willJam: true });
  });

  it("голая 99 — Феномен в карточке даже при провале, но флаг не ставится (нет будущего выстрела, к которому привязать Заклин)", async () => {
    const a = actor({ wpTotal: 10, pr: 1 }); // порог 10+5=15
    const w = weapon("Душесвязанное", a);
    captured.dice = [99]; // 99 > 15 — провал, но rv===99 — Феномен
    await activateSoulboundLegacyBonus(w, { psychic: true });
    expect(a.getFlag("warhammer-dbc", "legacySoulboundBonus")).toBeUndefined();
    expect(captured.chat.at(-1).content).toContain("Феномен");
  });
});

describe("legacyHatredShieldArms", () => {
  it("двуручное (2р) — обе руки", () => {
    const w = weapon("Щит Ненависти", null);
    w.system.grips = "2р";
    expect(legacyHatredShieldArms(w)).toEqual(["leftArm", "rightArm"]);
  });

  it("одноручное, heldHand=left — левая рука", () => {
    const flags = { heldHand: "left" };
    const w = weapon("Щит Ненависти", null);
    w.system.grips = "1р";
    w.getFlag = (_s, k) => flags[k];
    expect(legacyHatredShieldArms(w)).toEqual(["leftArm"]);
  });

  it("одноручное, heldHand=right — правая рука", () => {
    const flags = { heldHand: "right" };
    const w = weapon("Щит Ненависти", null);
    w.system.grips = "1р";
    w.getFlag = (_s, k) => flags[k];
    expect(legacyHatredShieldArms(w)).toEqual(["rightArm"]);
  });

  it("одноручное, heldHand не выставлен — честный дефолт «правая»", () => {
    const w = weapon("Щит Ненависти", null);
    w.system.grips = "1р";
    w.getFlag = () => undefined;
    expect(legacyHatredShieldArms(w)).toEqual(["rightArm"]);
  });
});

describe("activateLegacyHatredShield", () => {
  it("свой Ход, есть Реакция — ставит флаг {weaponId, bonus, arms}, тратит Реакцию", async () => {
    const a = actor({ infBonus: 5, reactions: 1, type: "character" }); // ½×5=2.5→3
    const w = weapon("Щит Ненависти", a);
    globalThis.game.combat = { started: true, combatant: { actor: a } };
    await activateLegacyHatredShield(w);
    expect(a.getFlag("warhammer-dbc", "legacyHatredShield")).toEqual({ weaponId: "w1", bonus: 3, arms: ["rightArm"] });
    expect(a.system.reactions.value).toBe(0);
  });

  it("не свой Ход — предупреждает, не ставит флаг", async () => {
    const a = actor();
    const other = actor({ type: "character" });
    other.id = "a2"; other.uuid = "Actor.a2";
    const w = weapon("Щит Ненависти", a);
    globalThis.game.combat = { started: true, combatant: { actor: other } };
    await activateLegacyHatredShield(w);
    expect(a.getFlag("warhammer-dbc", "legacyHatredShield")).toBeUndefined();
  });

  it("нет Реакции — предупреждает, не ставит флаг", async () => {
    const a = actor({ reactions: 0 });
    const w = weapon("Щит Ненависти", a);
    globalThis.game.combat = { started: true, combatant: { actor: a } };
    await activateLegacyHatredShield(w);
    expect(a.getFlag("warhammer-dbc", "legacyHatredShield")).toBeUndefined();
  });

  it("щит уже поднят — второй клик не тратит повторно", async () => {
    const a = actor({ infBonus: 5, reactions: 2 });
    const w = weapon("Щит Ненависти", a);
    globalThis.game.combat = { started: true, combatant: { actor: a } };
    await activateLegacyHatredShield(w);
    await activateLegacyHatredShield(w);
    expect(a.system.reactions.value).toBe(1); // потрачено ровно один раз
  });
});
