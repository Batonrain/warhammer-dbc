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

/**
 * Актор ровно с тем, что трогает запись «Состояние». Эффекты нужны потому,
 * что наложение СО СРОКОМ вешает штатную Duration на эффект-иконку
 * (wdbc-uqco, combat/condition-effects.mjs) — без них проверялась бы половина.
 */
function makeActor({ conditions = {}, tBonus = 4, items = [] } = {}) {
  const updates = [];
  const actor = {
    name: "Подставной", updates, items, effects: [],
    system: { conditions, characteristics: { t: { bonus: tBonus } } },
    update: async data => { updates.push(data); },
    createEmbeddedDocuments: async (_type, docs) => {
      actor.effects.push(...docs.map(d => ({ ...d, getFlag: (sc, k) => d.flags?.[sc]?.[k] })));
      return docs;
    }
  };
  return actor;
}

/** Предмет-источник с записями Механики (для иммунитета у самого владельца). */
const itemWith = (entries) => ({
  name: "Источник", flags: { [FLAG]: { mechanics: [{ id: "g", operator: "AND", entries }] } }
});

const source = { id: "src", name: "Источник", system: {}, flags: {} };

describe("describeMechEntry: запись «Состояние»", () => {
  it("сила показывается там, где она есть — у Состояния с уровнями", () => {
    expect(describeMechEntry(entry({ condKey: "bleeding", condMode: "apply", condLevel: "1" })))
      .toBe("Состояние: наложить «Кровотечение» (уровней: 1)");
  });

  it("срок показывается словами и своими единицами", () => {
    expect(describeMechEntry(entry({ condKey: "stunned", condDurationValue: "2", condDurationUnit: "rounds" })))
      .toBe("Состояние: наложить «Оглушение» (на 2 раунда)");
    expect(describeMechEntry(entry({ condKey: "poisoned", condDurationValue: "10", condDurationUnit: "minutes" })))
      .toBe("Состояние: наложить «Отравление» (на 10 минут)");
  });

  it("сила и срок вместе — два разных вопроса в одной подписи", () => {
    expect(describeMechEntry(entry({
      condKey: "bleeding", condLevel: "2", condDurationValue: "1", condDurationUnit: "hours"
    }))).toBe("Состояние: наложить «Кровотечение» (уровней: 2, на 1 час)");
  });

  it("запись, заведённая до появления сроков, читается как «столько-то раундов»", () => {
    // Обратная совместимость: у Состояния со счётчиком «раунды» condLevel и
    // БЫЛ сроком — выразить его иначе как в Раундах было нечем. Признак такой
    // записи — ОТСУТСТВИЕ ключа единицы, поэтому запись собирается вручную,
    // а не через blankMechEntry (тот ключ уже кладёт).
    const legacy = { id: "e", kind: "condition", condKey: "stunned", condMode: "apply", condLevel: "2" };
    expect(describeMechEntry(legacy)).toBe("Состояние: наложить «Оглушение» (на 2 раунда)");
  });

  it("новая запись с пустой единицей срока НЕ получает его втихую (wdbc-5zu5)", () => {
    expect(describeMechEntry(entry({ condKey: "stunned", condDurationUnit: "" })))
      .toBe("Состояние: наложить «Оглушение»");
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
  it("«Наложить» со сроком пишет флаг, счётчик и вешает Duration на иконку", async () => {
    const actor = makeActor();
    await applyMechEntry(actor, entry({
      condKey: "stunned", condDurationValue: "3", condDurationUnit: "rounds"
    }), source);
    expect(actor.updates).toEqual([{
      "system.conditions.stunned": true, "system.conditions.stunnedRounds": 3
    }]);
    expect(actor.effects).toHaveLength(1);
    expect(actor.effects[0].duration).toEqual({ value: 3, units: "rounds" });
  });

  it("срок — формула бонуса характеристики, как «Рейтинг» у Черты", async () => {
    const actor = makeActor({ tBonus: 5 });
    await applyMechEntry(actor, entry({
      condKey: "stunned", condDurationValue: "t", condDurationUnit: "rounds"
    }), source);
    expect(actor.updates[0]["system.conditions.stunnedRounds"]).toBe(5);
    expect(actor.effects[0].duration).toEqual({ value: 5, units: "rounds" });
  });

  it("сила у Состояния с уровнями — своё поле, и эффекта без срока не заводится", async () => {
    const actor = makeActor({ tBonus: 3 });
    await applyMechEntry(actor, entry({ condKey: "bleeding", condLevel: "t" }), source);
    expect(actor.updates).toEqual([{
      "system.conditions.bleeding": true, "system.conditions.bleedingLevel": 3
    }]);
    expect(actor.effects).toEqual([]);
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
    await applyMechEntry(actor, entry({ condKey: "stunned", condDurationValue: "2", condDurationUnit: "rounds" }), source);
    expect(actor.updates).toEqual([]);
  });

  it("иммунитет к другому Состоянию наложению не мешает", async () => {
    const immune = itemWith([{ id: "i", kind: "condition", condKey: "blinded", condMode: "immunity" }]);
    const actor = makeActor({ items: [immune] });
    await applyMechEntry(actor, entry({
      condKey: "stunned", condDurationValue: "2", condDurationUnit: "rounds"
    }), source);
    expect(actor.updates.length).toBe(1);
    expect(actor.effects).toHaveLength(1);
  });

  it("иммунитет гасит и эффект срока, не только флаг", async () => {
    const immune = itemWith([{ id: "i", kind: "condition", condKey: "stunned", condMode: "immunity" }]);
    const actor = makeActor({ items: [immune] });
    await applyMechEntry(actor, entry({
      condKey: "stunned", condDurationValue: "2", condDurationUnit: "rounds"
    }), source);
    expect(actor.updates).toEqual([]);
    expect(actor.effects).toEqual([]);
  });
});
