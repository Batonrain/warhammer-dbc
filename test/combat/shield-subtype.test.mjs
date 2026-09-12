// test/combat/shield-subtype.test.mjs
//
// Нерушимая Лента / Морозное Сердце (wdbc-q0q8): Конструктор kind:"shieldSubtype"
// на предмете type:"forcefield", читается напрямую combat/damage.mjs::
// _rollActiveShield (не через синтетический ActiveEffect на акторе).
//   mode:"exclude"  — щит вообще не рассматривается против этого подвида урона.
//   mode:"override" — на бросок ПРОТИВ этого подвида рейтинг щита заменяется.
// Плюс особая перегрузка (overloadDamageFormula/overloadFatigueFormula) —
// доп. непоглощаемый урон и Усталость сверх обычного «щит выключился».

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";

function shieldItem({
  currentRating = 25, overloadThreshold = 0, mechanics = [],
  overloadDamageFormula = "", overloadFatigueFormula = "", overloadRepairTest = ""
} = {}) {
  return {
    id: "shield1", type: "forcefield",
    system: {
      equipped: true, status: "active", currentRating, overloadThreshold,
      shieldType: "deflector", shieldNature: "warp",
      overloadDamageFormula, overloadFatigueFormula, overloadRepairTest
    },
    flags: { "warhammer-dbc": { mechanics } },
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; },
    async update(data) {
      if (data["system.status"]        !== undefined) this.system.status        = data["system.status"];
      if (data["system.equipped"]      !== undefined) this.system.equipped      = data["system.equipped"];
      if (data["system.currentRating"] !== undefined) this.system.currentRating = data["system.currentRating"];
    }
  };
}

function characterActor(shield) {
  const items = [shield];
  return {
    id: "char1", name: "Носитель щита", type: "character",
    system: {
      absorption: { body: 0, toughnessBonus: 0, propFlags: {} },
      // wp.bonus высокий нарочно: fatigueThreshold(actor) = tb+wb — держим порог
      // выше добавляемой Усталости, чтобы addFatigue не пыталась наложить
      // Оглушение (не про это тест).
      characteristics: { wp: { bonus: 20 } },
      fatigue: { value: 0, max: 10 },
      wounds: { value: 20, critical: 0, max: 20 }
    },
    items: Object.assign([...items], { contents: items }),
    async update(data) {
      if (data["system.wounds.value"]    !== undefined) this.system.wounds.value    = data["system.wounds.value"];
      if (data["system.wounds.critical"] !== undefined) this.system.wounds.critical = data["system.wounds.critical"];
      if (data["system.fatigue.value"]   !== undefined) this.system.fatigue.value   = data["system.fatigue.value"];
    }
  };
}

const damage = (over = {}) => ({
  rawDamage: 15, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Враг", weaponName: "Оружие", ...over
});

const excludeCrushing = [{
  id: "g1", operator: "AND",
  entries: [{ id: "e1", kind: "shieldSubtype", shieldSubtypeMode: "exclude", shieldSubtypeKey: "crushing" }]
}];

const overrideFlame = [{
  id: "g1", operator: "AND",
  entries: [{ id: "e1", kind: "shieldSubtype", shieldSubtypeMode: "override", shieldSubtypeKey: "flame", shieldSubtypeRatingMax: 75 }]
}];

beforeEach(resetCaptured);

describe("kind:\"shieldSubtype\" — Нерушимая Лента (exclude)", () => {
  it("подвид совпал с exclude — щит вообще не рассматривается, урон проходит даже при удачном броске", async () => {
    const actor = characterActor(shieldItem({ currentRating: 99, mechanics: excludeCrushing }));
    captured.dice = [1]; // 1 ≤ 99 блокировал бы, если бы щит катился
    await applyDamageToActor(actor, damage({ damageSubtype: "crushing" }));

    expect(captured.rolls.length).toBe(0); // щит не катился вовсе
    expect(actor.system.wounds.value).toBeLessThan(20);
  });

  it("другой подвид — щит рассматривается как обычно, блокирует", async () => {
    const actor = characterActor(shieldItem({ currentRating: 99, mechanics: excludeCrushing }));
    captured.dice = [1];
    await applyDamageToActor(actor, damage({ damageSubtype: "flame" }));

    expect(actor.system.wounds.value).toBe(20);
  });

  it("без damageSubtype вовсе — exclude не про этот подвид, щит рассматривается как обычно", async () => {
    const actor = characterActor(shieldItem({ currentRating: 99, mechanics: excludeCrushing }));
    captured.dice = [1];
    await applyDamageToActor(actor, damage({ damageSubtype: "" }));

    expect(actor.system.wounds.value).toBe(20);
  });
});

describe("kind:\"shieldSubtype\" — Морозное Сердце (override)", () => {
  it("подвид совпал с override — рейтинг заменяется (25 → 75), бросок 50 блокирован", async () => {
    const actor = characterActor(shieldItem({ currentRating: 25, mechanics: overrideFlame }));
    captured.dice = [50]; // > 25 (обычный рейтинг), ≤ 75 (override)
    await applyDamageToActor(actor, damage({ damageSubtype: "flame" }));

    expect(actor.system.wounds.value).toBe(20); // аннулировано
  });

  it("другой подвид — обычный рейтинг (25), тот же бросок 50 не блокирован", async () => {
    const actor = characterActor(shieldItem({ currentRating: 25, mechanics: overrideFlame }));
    captured.dice = [50];
    await applyDamageToActor(actor, damage({ damageSubtype: "toxic" }));

    expect(actor.system.wounds.value).toBeLessThan(20);
  });
});

describe("Особая перегрузка щита (overloadDamageFormula/overloadFatigueFormula)", () => {
  it("перегрузка бьёт доп. непоглощаемым уроном и Усталостью сверх обычного выключения", async () => {
    const actor = characterActor(shieldItem({
      currentRating: 25, overloadThreshold: 50,
      overloadDamageFormula: "1d5", overloadFatigueFormula: "1d5-1"
    }));
    // rv=10: ≤25 (блокирован), ≤50 (перегрузка) → щит поглотил и перегрузился.
    // Следующие два броска — доп. урон (1d5) и доп. усталость (1d5-1).
    captured.dice = [10, 4, 4];
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));

    expect(actor.system.wounds.value).toBe(20 - 4); // попадание аннулировано щитом, но перегрузка бьёт напрямую
    expect(actor.system.fatigue.value).toBe(3);      // 4-1
  });

  it("без формул — перегрузка выключает щит как раньше, без доп. урона/усталости", async () => {
    const actor = characterActor(shieldItem({ currentRating: 25, overloadThreshold: 50 }));
    captured.dice = [10];
    await applyDamageToActor(actor, damage({ rawDamage: 15 }));

    expect(actor.system.wounds.value).toBe(20);
    expect(actor.system.fatigue.value).toBe(0);
  });
});
