// test/apps/mechanics-condition-entry.test.mjs
//
// Вид записи «Состояние» в Конструкторе (wdbc-tl0f): наложить / снять /
// иммунитет / смягчение. Разовые режимы (apply/remove) применяются к владельцу
// через ту же единую точку, что весь остальной код (wdbc-fejd); живые
// (immunity/mitigate) при получении предмета не пишут ничего.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { blankMechEntry, describeMechEntry, applyMechEntry } from "../../module/apps/mechanics.mjs";

const FLAG = "warhammer-dbc";

const entry = (over = {}) => ({ ...blankMechEntry("condition"), ...over });

/** Актор ровно с тем, что трогает запись «Состояние». */
function makeActor({ conditions = {}, tBonus = 4, items = [] } = {}) {
  const updates = [];
  return {
    name: "Подставной", updates, items,
    system: { conditions, characteristics: { t: { bonus: tBonus } } },
    update: async data => { updates.push(data); }
  };
}

/** Предмет-источник с записями Механики (для иммунитета у самого владельца). */
const itemWith = (entries) => ({
  name: "Источник", flags: { [FLAG]: { mechanics: [{ id: "g", operator: "AND", entries }] } }
});

const source = { id: "src", name: "Источник", system: {}, flags: {} };

describe("describeMechEntry: запись «Состояние»", () => {
  it("наложение со счётчиком показывает единицу счётчика", () => {
    expect(describeMechEntry(entry({ condKey: "stunned", condMode: "apply", condLevel: "2" })))
      .toBe("Состояние: наложить «Оглушение» (раундов: 2)");
    expect(describeMechEntry(entry({ condKey: "bleeding", condMode: "apply", condLevel: "1" })))
      .toBe("Состояние: наложить «Кровотечение» (уровней: 1)");
  });

  it("у Состояния без счётчика величины в подписи нет", () => {
    expect(describeMechEntry(entry({ condKey: "prone", condMode: "apply" })))
      .toBe("Состояние: наложить «Повален»");
  });

  it("остальные три режима подписаны своими словами", () => {
    expect(describeMechEntry(entry({ condKey: "bleeding", condMode: "remove" })))
      .toBe("Состояние: снять «Кровотечение»");
    expect(describeMechEntry(entry({ condKey: "blinded", condMode: "immunity" })))
      .toBe("Состояние: иммунитет к «Ослеплён» — не накладывается ничем");
    expect(describeMechEntry(entry({ condKey: "prone", condMode: "mitigate", condMitigate: "half" })))
      .toBe("Состояние: «Повален» — половина штрафа");
  });

  it("незаполненная запись говорит об этом, а не притворяется рабочей", () => {
    expect(describeMechEntry(entry({ condKey: "" }))).toBe("Состояние: (не выбрано)");
  });
});

describe("applyMechEntry: разовые режимы", () => {
  it("«Наложить» пишет флаг Состояния и его счётчик", async () => {
    const actor = makeActor();
    await applyMechEntry(actor, entry({ condKey: "stunned", condLevel: "3" }), source);
    expect(actor.updates).toEqual([{
      "system.conditions.stunned": true, "system.conditions.stunnedRounds": 3
    }]);
  });

  it("величина — формула бонуса характеристики, как «Рейтинг» у Черты", async () => {
    const actor = makeActor({ tBonus: 5 });
    await applyMechEntry(actor, entry({ condKey: "stunned", condLevel: "t" }), source);
    expect(actor.updates[0]["system.conditions.stunnedRounds"]).toBe(5);
  });

  it("у Состояния без счётчика пишется только флаг", async () => {
    const actor = makeActor();
    await applyMechEntry(actor, entry({ condKey: "prone" }), source);
    expect(actor.updates).toEqual([{ "system.conditions.prone": true }]);
  });

  it("«Снять» гасит флаг и обнуляет счётчик", async () => {
    const actor = makeActor({ conditions: { bleeding: true, bleedingLevel: 3 } });
    await applyMechEntry(actor, entry({ condKey: "bleeding", condMode: "remove" }), source);
    expect(actor.updates).toEqual([{
      "system.conditions.bleeding": false, "system.conditions.bleedingLevel": 0
    }]);
  });
});

describe("applyMechEntry: живые режимы ничего не пишут", () => {
  it("«Иммунитет» и «Смягчить штраф» при получении предмета молчат", async () => {
    for (const condMode of ["immunity", "mitigate"]) {
      const actor = makeActor();
      await applyMechEntry(actor, entry({ condKey: "stunned", condMode }), source);
      expect(actor.updates).toEqual([]);
    }
  });

  it("незаполненный ключ Состояния ничего не делает", async () => {
    const actor = makeActor();
    await applyMechEntry(actor, entry({ condKey: "" }), source);
    expect(actor.updates).toEqual([]);
  });
});

describe("applyMechEntry: наложение уважает иммунитет самого получателя", () => {
  it("предмет не может наложить Состояние, к которому владелец невосприимчив", async () => {
    const immune = itemWith([{ id: "i", kind: "condition", condKey: "stunned", condMode: "immunity" }]);
    const actor = makeActor({ items: [immune] });
    await applyMechEntry(actor, entry({ condKey: "stunned", condLevel: "2" }), source);
    expect(actor.updates).toEqual([]);
  });

  it("иммунитет к другому Состоянию наложению не мешает", async () => {
    const immune = itemWith([{ id: "i", kind: "condition", condKey: "blinded", condMode: "immunity" }]);
    const actor = makeActor({ items: [immune] });
    await applyMechEntry(actor, entry({ condKey: "stunned", condLevel: "2" }), source);
    expect(actor.updates.length).toBe(1);
  });
});
