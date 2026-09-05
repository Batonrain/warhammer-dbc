// Иммунитет к Состоянию (wdbc-tl0f) в ЕДИНОЙ ТОЧКЕ наложения (wdbc-fejd):
// раз все ~20 мест системы собирают пару «флаг+счётчик» через эти функции,
// достаточно спросить иммунитет здесь — и он погасит ЛЮБОЙ путь наложения,
// а не только тот, для которого его писали (в отличие от прежнего иммунитета
// к СВОЙСТВУ ОРУЖИЯ, weaponPropertyImmunity.*).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { conditionApplyFields, conditionAdjustFields, addCondition }
  from "../../module/sheets/tabs/conditions.mjs";

const FLAG = "warhammer-dbc";

const immunityItem = (condKey, over = {}) => ({
  name: "Оберег",
  flags: { [FLAG]: { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "condition", condKey, condMode: "immunity", ...over }
  ] }] } }
});

function makeActor({ items = [], conditions = {} } = {}) {
  const updates = [];
  return {
    name: "Подставной", items, updates,
    system: { conditions, inRage: false },
    update: async data => { updates.push(data); }
  };
}

describe("conditionApplyFields: иммунитет", () => {
  it("без актора спрашивать иммунитет не у кого — патч как раньше", () => {
    expect(conditionApplyFields("stunned", 2)).toEqual({
      "system.conditions.stunned": true, "system.conditions.stunnedRounds": 2
    });
  });

  it("актор с иммунитетом получает ПУСТОЙ патч", () => {
    const actor = makeActor({ items: [immunityItem("stunned")] });
    expect(conditionApplyFields("stunned", 2, actor)).toEqual({});
  });

  it("иммунитет к одному Состоянию не гасит другие", () => {
    const actor = makeActor({ items: [immunityItem("stunned")] });
    expect(conditionApplyFields("prone", null, actor)).toEqual({ "system.conditions.prone": true });
  });

  it("актор без иммунитета — патч как раньше", () => {
    const actor = makeActor();
    expect(conditionApplyFields("stunned", 2, actor)).toEqual({
      "system.conditions.stunned": true, "system.conditions.stunnedRounds": 2
    });
  });
});

describe("conditionAdjustFields: иммунитет гасит накопление, но не снятие", () => {
  it("прибавка уровня невосприимчивому актору не проходит", () => {
    const actor = makeActor({ items: [immunityItem("bleeding")], conditions: { bleedingLevel: 0 } });
    expect(conditionAdjustFields(actor, "bleeding", 1)).toEqual({});
  });

  it("снятие уровня проходит — иначе иммунитет запер бы то, что наложено раньше него", () => {
    const actor = makeActor({
      items: [immunityItem("bleeding")], conditions: { bleeding: true, bleedingLevel: 2 }
    });
    expect(conditionAdjustFields(actor, "bleeding", -1)).toEqual({
      "system.conditions.bleeding": true, "system.conditions.bleedingLevel": 1
    });
  });
});

describe("addCondition: иммунитет доходит и до отправленного обновления", () => {
  it("невосприимчивому актору actor.update не отправляется вовсе", async () => {
    const actor = makeActor({ items: [immunityItem("blinded")] });
    await addCondition(actor, "blinded");
    expect(actor.updates).toEqual([]);
  });

  it("обычному актору — отправляется", async () => {
    const actor = makeActor();
    await addCondition(actor, "blinded");
    expect(actor.updates).toEqual([{ "system.conditions.blinded": true }]);
  });
});

describe("иммунитет считается живьём — гейт «Когда» и снятый предмет", () => {
  it("запись с гейтом «Когда Ярость» не даёт иммунитета вне Ярости", () => {
    const item = immunityItem("stunned", { when: { requireRage: true } });
    const calm = makeActor({ items: [item] });
    expect(conditionApplyFields("stunned", 1, calm)).not.toEqual({});
    calm.system.inRage = true;
    expect(conditionApplyFields("stunned", 1, calm)).toEqual({});
  });

  it("предмет ушёл с актора — иммунитета нет, откатывать нечего", () => {
    const actor = makeActor({ items: [immunityItem("stunned")] });
    expect(conditionApplyFields("stunned", 1, actor)).toEqual({});
    actor.items = [];
    expect(conditionApplyFields("stunned", 1, actor)).not.toEqual({});
  });
});
