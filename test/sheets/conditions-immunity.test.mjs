// Иммунитет к Состоянию (wdbc-tl0f) в ЕДИНОЙ ТОЧКЕ наложения (wdbc-fejd):
// раз все ~20 мест системы собирают пару «флаг+счётчик» через эти функции,
// достаточно спросить иммунитет здесь — и он погасит ЛЮБОЙ путь наложения,
// а не только тот, для которого его писали (в отличие от прежнего иммунитета
// к СВОЙСТВУ ОРУЖИЯ, weaponPropertyImmunity.*).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { conditionApplyFields, conditionAdjustFields, addCondition,
         conditionRemoveFields, removeCondition }
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

// ── wdbc-d9dp: диалог «Добавить состояние» продавливал иммунитет ────────────
// Найдено живой проверкой wdbc-tl0f: через иконку токена и через выдачу
// предмета иммунитет держал, а кнопкой «+» на листе ГМ мог наложить то же
// Состояние вручную — диалог собирал патч, не спрашивая актора.
import { captured, fakeForm } from "../support/foundry-stub.mjs";
import { showAddConditionDialog } from "../../module/sheets/tabs/conditions.mjs";

describe("showAddConditionDialog: иммунитет", () => {
  it("выбранное вручную Состояние не накладывается, если к нему иммунитет", async () => {
    const actor = makeActor({ items: [immunityItem("stunned")] });
    showAddConditionDialog(actor);

    await captured.press("add", fakeForm({}, {
      ".add-cond-cb:checked": [{ dataset: { condition: "stunned" } }]
    }));

    expect(actor.updates).toEqual([]);
  });

  it("остальные Состояния той же галочкой накладываются как раньше", async () => {
    const actor = makeActor({ items: [immunityItem("stunned")] });
    showAddConditionDialog(actor);

    await captured.press("add", fakeForm({}, {
      ".add-cond-cb:checked": [{ dataset: { condition: "prone" } }]
    }));

    expect(actor.updates).toEqual([{ "system.conditions.prone": true }]);
  });

  it("Состояние с иммунитетом видно в списке, но выбрать его нельзя — причина названа", () => {
    const actor = makeActor({ items: [immunityItem("stunned")] });
    showAddConditionDialog(actor);

    // Молча спрятать было бы хуже: ГМ решил бы, что Состояние потерялось.
    expect(captured.dialog.content).toContain('data-condition="stunned"');
    expect(captured.dialog.content).toMatch(/data-condition="stunned"[^>]*disabled/);
    expect(captured.dialog.content).toContain("иммунитет");
  });
});

// ── wdbc-5uae: метки проходят через ту же единую точку ──────────────────────

describe("метки в единой точке наложения/снятия", () => {
  it("снятие метки гасит ИСТОЧНИК, а не отражение", () => {
    // Записанное в system.conditions производные данные вернут обратно на
    // первом же пересчёте — снимать надо там, где метка на самом деле лежит.
    expect(conditionRemoveFields("inRage")).toEqual({ "system.inRage": false });
    expect(conditionRemoveFields("running")).toEqual({ [`flags.${FLAG}.-=running`]: null });
  });

  it("книжное Состояние снимается как снималось", () => {
    expect(conditionRemoveFields("prone")).toEqual({ "system.conditions.prone": false });
  });

  it("метку нельзя наложить вручную — её включает своё действие", () => {
    const actor = makeActor();
    expect(conditionApplyFields("inRage", null, actor)).toEqual({});
    expect(conditionAdjustFields(actor, "running", 1)).toEqual({});
  });

  it("removeCondition доводит снятие метки до актора", async () => {
    const actor = makeActor();
    await removeCondition(actor, "inRage");
    expect(actor.updates).toEqual([{ "system.inRage": false }]);
  });

  it("диалог «Добавить состояние» меток не предлагает", () => {
    const actor = makeActor();
    showAddConditionDialog(actor);
    for (const key of ["inRage", "running", "marked", "shieldUp"]) {
      expect(captured.dialog.content).not.toContain(`data-condition="${key}"`);
    }
    // Книжные при этом на месте — фильтр не срезал лишнего.
    expect(captured.dialog.content).toContain('data-condition="stunned"');
  });
});
