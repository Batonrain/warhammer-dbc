// test/tools/race-numbers.test.mjs
//
// Переезд рас не должен изменить НИ ОДНОГО числа на листе. Раньше расовая Черта
// создавалась из констант с готовым значением (charBonusValue: 4), теперь —
// копией из библиотеки с пересчётом по рейтингу. Тест повторяет обе дороги и
// сверяет итог по всем расам сразу.
//
// Зелёный тест здесь и означает «переезд состоялся». Красный — что персонаж
// после обновления получит не ту расу, что была.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { RACES } from "../../module/constants/races.mjs";
import { rescaleTraitByRating } from "../../module/apps/mechanics.mjs";
import { traitEntries } from "../../tools/races-to-pack.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

// Ключ — идентификатор документа, ровно как его достаёт рантайм: сперва
// fromUuid(entry.sourceUuid). Сверять здесь по имени значило бы проверять
// не ту дорогу, по которой Черта поедет на самом деле.
const LIB = new Map(packDocuments("traits", "trait").map(({ doc }) => [doc._id, doc]));

/** Как считалось РАНЬШЕ: Черта создавалась из констант со своими effects. */
function bonusesFromConstants(race) {
  const sum = {};
  for (const t of race.traits || []) {
    const e = t.effects || {};
    if (e.charBonusStat && e.charBonusValue) sum[e.charBonusStat] = (sum[e.charBonusStat] || 0) + e.charBonusValue;
    for (const cb of e.charBonuses || []) if (cb?.stat) sum[cb.stat] = (sum[cb.stat] || 0) + cb.value;
  }
  return sum;
}

/** Как считается ТЕПЕРЬ: копия из библиотеки + пересчёт по рейтингу записи. */
function bonusesFromLibrary(race) {
  const sum = {};
  for (const entry of traitEntries(race)) {
    const src = LIB.get(String(entry.sourceUuid).split(".").pop());
    if (!src) continue;
    const doc = rescaleTraitByRating(structuredClone(src), entry.rating);
    const e = doc.system.effects || {};
    if (e.charBonusStat && e.charBonusValue) sum[e.charBonusStat] = (sum[e.charBonusStat] || 0) + e.charBonusValue;
    for (const cb of e.charBonuses || []) if (cb?.stat) sum[cb.stat] = (sum[cb.stat] || 0) + cb.value;
  }
  return sum;
}

describe("числа рас после переезда", () => {

  it("Астартес: +4 Силы и +4 Стойкости, как в книге", () => {
    expect(bonusesFromLibrary(RACES.astartes)).toMatchObject({ s: 4, t: 4 });
  });

  it("Азуриане: +4 Ловкости и +4 Восприятия", () => {
    expect(bonusesFromLibrary(RACES.azuriane)).toMatchObject({ ag: 4, per: 4 });
  });

  it.each(Object.keys(RACES))("%s: бонусы из библиотеки совпали с прежними", key => {
    expect(bonusesFromLibrary(RACES[key])).toEqual(bonusesFromConstants(RACES[key]));
  });
});
