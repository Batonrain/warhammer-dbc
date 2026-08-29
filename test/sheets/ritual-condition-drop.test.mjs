// test/sheets/ritual-condition-drop.test.mjs
//
// Пилюля состояния из карточки успешного Ритуала (module/apps/ritual-cast.mjs)
// перетаскивается ГМом на лист актора, которому она принадлежит —
// module/sheets/actor-sheet.mjs, WarhammerCharacterSheet._onDrop перехватывает
// свой тип payload ("wh-condition") до штатной обработки Item/Actor-дропов.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, sheetOf } from "../support/foundry-stub.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";

beforeEach(() => resetCaptured());

function dropEvent(payload) {
  return {
    dataTransfer: { getData: () => JSON.stringify(payload) },
    preventDefault: () => {}
  };
}

describe("перенос состояния Ритуала на лист (WarhammerCharacterSheet._onDrop)", () => {
  it("известный ключ без уровня — накладывает состояние", async () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { characteristics: {}, skills: {}, groupSkills: {} });
    const updates = [];
    sheet.actor.update = async data => { updates.push(data); };

    await WarhammerCharacterSheet.prototype._onDrop.call(sheet, dropEvent({ type: "wh-condition", key: "prone" }));

    expect(updates).toEqual([{ "system.conditions.prone": true }]);
  });

  it("состояние со счётчиком переносит и уровень", async () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { characteristics: {}, skills: {}, groupSkills: {} });
    const updates = [];
    sheet.actor.update = async data => { updates.push(data); };

    await WarhammerCharacterSheet.prototype._onDrop.call(sheet, dropEvent({ type: "wh-condition", key: "blinded", level: 3 }));

    expect(updates).toEqual([{ "system.conditions.blinded": true, "system.conditions.blindedRounds": 3 }]);
  });

  it("неизвестный ключ состояния — ничего не пишет", async () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { characteristics: {}, skills: {}, groupSkills: {} });
    const updates = [];
    sheet.actor.update = async data => { updates.push(data); };

    await WarhammerCharacterSheet.prototype._onDrop.call(sheet, dropEvent({ type: "wh-condition", key: "notARealCondition" }));

    expect(updates).toEqual([]);
  });

  it("битый payload (не JSON) не роняет обработчик", async () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { characteristics: {}, skills: {}, groupSkills: {} });
    sheet.actor.update = async () => { throw new Error("не должно вызываться"); };
    const ev = { dataTransfer: { getData: () => "не json" }, preventDefault: () => {} };

    await expect(WarhammerCharacterSheet.prototype._onDrop.call(sheet, ev)).resolves.not.toThrow();
  });
});
