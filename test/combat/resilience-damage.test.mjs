// test/combat/resilience-damage.test.mjs
//
// Таланты Стойкости (глава 3, пакет A) в боевых путях:
//   Настоящая Выдержка — applyDamageToActor режет непоглощённый урон на T.b,
//     пока Раны ниже 0 (в т.ч. пересекающее ноль попадание, но до −1 минимум);
//   Укреплённая Душа — +½ I.b к поглощению варп-оружия, −½ I.b кубиков
//     Выжигания Души (минимум один);
//   Пожиратель Змей — урон Toxic вдвое меньше (окр.▲);
//   Сопротивление — теги теста сопротивления (Toxic: poisonTest/stunTest).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

const { _executeSoulBurn, _applyWeaponPropEffect } = await import("../../module/hooks.mjs");

const talent = name => ({ type: "talent", name, system: {}, flags: {} });

function characterActor({ wounds = 20, critical = 0, tb = 4, wpb = 3, ib = 5, items = [] } = {}) {
  const updates = [];
  return {
    id: "char1", name: "Стойкий", type: "character", uuid: "Actor.char1", updates,
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      characteristics: { t: { bonus: tb, total: tb * 10 }, wp: { bonus: wpb, total: wpb * 10 }, int: { bonus: ib, total: ib * 10 } },
      wounds: { value: wounds, critical, max: 20 }
    },
    items: Object.assign([...items], { contents: [] }),
    getFlag: () => undefined,
    async update(data) {
      updates.push(data);
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 10, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

beforeEach(resetCaptured);

describe("Настоящая Выдержка: урон −T.b, пока Раны ниже 0", () => {
  const grit = [talent("True Grit / Настоящая Выдержка")];

  it("уже в минусе: 10 урона − T.b 4 = 6, крит. Раны 2 → 8", async () => {
    const a = characterActor({ wounds: 0, critical: 2, items: grit });
    await applyDamageToActor(a, damage());
    expect(a.system.wounds.critical).toBe(8);
    expect(captured.chat.at(-1).content).toContain("Настоящая Выдержка");
  });

  it("уже в минусе: минимум 1 урона", async () => {
    const a = characterActor({ wounds: 0, critical: 2, items: grit });
    await applyDamageToActor(a, damage({ rawDamage: 3 }));
    expect(a.system.wounds.critical).toBe(3);
  });

  it("пересекающее ноль попадание: Раны всё равно опускаются минимум до −1", async () => {
    // 8 Ран, урон 10: без Таланта −2 (крит. 2); с Талантом −T.b дал бы 6 < 9, но до −1 нужно 9 → крит. 1
    const a = characterActor({ wounds: 8, critical: 0, items: grit });
    await applyDamageToActor(a, damage());
    expect(a.system.wounds.value).toBe(0);
    expect(a.system.wounds.critical).toBe(1);
  });

  it("пересекающее ноль попадание с запасом: урон режется целиком на T.b", async () => {
    const a = characterActor({ wounds: 2, critical: 0, items: grit });
    await applyDamageToActor(a, damage());
    expect(a.system.wounds.critical).toBe(4);   // 10 − 4 = 6, 6 − 2 Раны = 4
  });

  it("Раны в плюсе и попадание ноль не пересекает — Выдержка не действует", async () => {
    const a = characterActor({ wounds: 15, critical: 0, items: grit });
    await applyDamageToActor(a, damage());
    expect(a.system.wounds.value).toBe(5);
  });

  it("без Таланта пересекающее ноль попадание бьёт полным уроном", async () => {
    const a = characterActor({ wounds: 8, critical: 0 });
    await applyDamageToActor(a, damage());
    expect(a.system.wounds.critical).toBe(2);
  });

  it("без Таланта в минусе урон не режется", async () => {
    const a = characterActor({ wounds: 0, critical: 2 });
    await applyDamageToActor(a, damage());
    expect(a.system.wounds.critical).toBe(12);
  });
});

describe("Укреплённая Душа: поглощение варп-оружия", () => {
  it("W.b 3 + ½I.b (I.b 5 → 3): 10 урона − 6 = 4", async () => {
    const a = characterActor({ items: [talent("Hardened Soul / Укреплённая Душа")] });
    await applyDamageToActor(a, damage({ warpSoak: true }));
    expect(a.system.wounds.value).toBe(16);
    expect(captured.chat.at(-1).content).toContain("Укреплённая Душа +3");
  });

  it("без Таланта: 10 − W.b 3 = 7", async () => {
    const a = characterActor();
    await applyDamageToActor(a, damage({ warpSoak: true }));
    expect(a.system.wounds.value).toBe(13);
  });

  it("обычное (не варп) оружие прибавки не получает", async () => {
    const a = characterActor({ items: [talent("Hardened Soul / Укреплённая Душа")] });
    await applyDamageToActor(a, damage());
    expect(a.system.wounds.value).toBe(10);
  });
});

describe("Выжигание Души против Укреплённой Души", () => {
  const caster = () => ({
    id: "psy1", name: "Псайкер", uuid: "Actor.psy1", type: "character", items: [], getFlag: () => undefined,
    system: { characteristics: { wp: { total: 60 } }, psyker: { currentRating: 2 } }
  });
  // псайкер бросает 10 (успех, 7 Успехов при W+tPR×5 = 70), цель — 90 (провал при 30)
  async function burn(target) {
    captured.dice = [10, 90, 1, 1, 1, 1, 1, 1, 1];
    await _executeSoulBurn(caster(), target);
    return captured.rolls.filter(f => /d10$/.test(f) && f !== "1d100");
  }
  const victim = items => ({
    ...characterActor({ ib: 6, items }), system: {
      ...characterActor({ ib: 6 }).system,
      characteristics: { wp: { total: 30 }, int: { bonus: 6 } }, psyker: { currentRating: 0 }
    }
  });

  it("без Таланта: 7 кубиков (по Успеху)", async () => {
    const formulas = await burn(victim([]));
    expect(formulas).toEqual(["7d10"]);
  });

  it("с Талантом: ½ I.b (I.b 6 → 3) кубиков сняты — 4d10", async () => {
    const formulas = await burn(victim([talent("Hardened Soul / Укреплённая Душа")]));
    expect(formulas).toEqual(["4d10"]);
    expect(captured.chat.at(-1).content).toContain("Укреплённая Душа: −3 куб.");
  });

  it("минимум один кубик: 1 чистый Успех против ½ I.b 3 остаётся 1d10", async () => {
    // псайкер 60 при пороге 70 — 2 ст.; цель 55 при пороге 60 — 1 ст.; чистый Успех один
    captured.dice = [60, 55, 5];
    const t = victim([talent("Hardened Soul / Укреплённая Душа")]);
    t.system.characteristics.wp.total = 60;
    await _executeSoulBurn(caster(), t);
    expect(captured.rolls.filter(f => /^\d+d10$/.test(f))).toEqual(["1d10"]);
    expect(captured.chat.at(-1).content).not.toContain("Укреплённая Душа: −");
  });

  it("Успехи цели сводят выжигание на нет — кубиков нет вовсе", async () => {
    captured.dice = [64, 31, 1, 1];   // псайкер 1 ст., цель 3 ст.
    const t = victim([talent("Hardened Soul / Укреплённая Душа")]);
    t.system.characteristics.wp.total = 60;
    await _executeSoulBurn(caster(), t);
    expect(captured.rolls.filter(f => /^\d+d10$/.test(f))).toEqual([]);
  });
});

describe("Пожиратель Змей и Сопротивление: Toxic (_applyWeaponPropEffect)", () => {
  afterEach(() => { delete globalThis.fromUuid; });

  function victimActor(items = []) {
    const a = {
      uuid: "Actor.snake1", name: "Цель", isOwner: true, type: "character", items, getFlag: () => undefined,
      system: { characteristics: { t: { total: 50, bonus: 5 } }, patronGod: "", wounds: { value: 30, critical: 0, max: 30 }, conditions: {} },
      async update(c) {
        if (c["system.wounds.value"] !== undefined) this.system.wounds.value = c["system.wounds.value"];
      }
    };
    return a;
  }
  const toxic = over => ({
    wpForceActorUuid: "Actor.snake1", wpLabel: "Токсичное", wpKey: "toxic",
    wpCondition: "poisoned", wpTestChar: "t", wpDeg: "0", wpDamage: "1d10", ...over
  });

  it("урон яда вдвое меньше (окр.▲): 7 → 4", async () => {
    const a = victimActor([talent("Snake Eater / Пожиратель Змей")]);
    globalThis.fromUuid = async () => a;
    captured.dice = [99, 7];   // тест T провален (99 > 50), урон 1d10 = 7
    await _applyWeaponPropEffect(toxic({}));
    expect(a.system.wounds.value).toBe(26);   // 30 − 4
    expect(captured.chat.at(-1).content).toContain("Пожиратель Змей: 7 → 4");
  });

  it("без Таланта урон полный", async () => {
    const a = victimActor();
    globalThis.fromUuid = async () => a;
    captured.dice = [99, 7];
    await _applyWeaponPropEffect(toxic({}));
    expect(a.system.wounds.value).toBe(23);
  });

  it("урон не-яда (Flame) Пожиратель Змей не режет", async () => {
    const a = victimActor([talent("Snake Eater / Пожиратель Змей")]);
    globalThis.fromUuid = async () => a;
    captured.dice = [99, 7];
    await _applyWeaponPropEffect(toxic({ wpCondition: "burning", wpLabel: "Огонь", wpKey: "flame" }));
    expect(a.system.wounds.value).toBe(23);
  });

  it("Сопротивление (Poison): +10 к Порогу теста против яда; на Оглушение — нет", async () => {
    const a = victimActor([{ type: "talent", name: "Resistance / Сопротивление", system: { specialization: "Poison" }, flags: {} }]);
    globalThis.fromUuid = async () => a;
    captured.dice = [50, 3];
    await _applyWeaponPropEffect(toxic({}));
    expect(captured.chat.at(-1).content).toContain("<label>Порог</label><b>60</b>");   // 50 + 10
    captured.dice = [50];
    await _applyWeaponPropEffect(toxic({ wpCondition: "stunned", wpLabel: "Оглушающее", wpKey: "concussive", wpDamage: "" }));
    expect(captured.chat.at(-1).content).toContain("<label>Порог</label><b>50</b>");
  });

  it("Сопротивление (Stun): +10 на тест против Оглушения", async () => {
    const a = victimActor([{ type: "talent", name: "Resistance / Сопротивление", system: { specialization: "Stun" }, flags: {} }]);
    globalThis.fromUuid = async () => a;
    captured.dice = [50];
    await _applyWeaponPropEffect(toxic({ wpCondition: "stunned", wpLabel: "Оглушающее", wpKey: "concussive", wpDamage: "" }));
    expect(captured.chat.at(-1).content).toContain("<label>Порог</label><b>60</b>");
  });
});
