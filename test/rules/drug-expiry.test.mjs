// test/rules/drug-expiry.test.mjs
//
// Срок препарата по игровому времени (Sahara task-3ab7, п.5; решение владельца
// 26.10.2026): Струп «В течение 1 часа» (корбук стр. 284) снимается сам, когда
// Календарь доходит до отметки, а не кнопкой «Эффект завершён».
//
// Поле схемы `gameMinutes` — срок в минутах игрового времени (0 — вручную, как
// у остальных препаратов: текстовый `duration` книга меряет то в Раундах, то в
// минутах, и считать его автоматически нельзя). Отметка пишется в уже
// существовавшее, но пустовавшее поле `activeEffect.expiresAt`.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { expiryAtFor, dueDrugs } from "../../module/rules/drug-expiry.mjs";
import { DrugData } from "../../module/data/item/drug.mjs";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

const scab = () => allPackDocuments("chemistry").map(d => d.doc).find(d => d.name.startsWith("Scab"));

describe("expiryAtFor: отметка конца действия", () => {
  it("минуты игрового времени → секунды worldTime от момента приёма", () => {
    expect(expiryAtFor({ gameMinutes: 60 }, 1000)).toBe(1000 + 3600);
    expect(expiryAtFor({ gameMinutes: 10 }, 0)).toBe(600);
  });
  it("0, пусто, мусор и отрицательное — срока по часам нет (null, не 0)", () => {
    for (const v of [0, undefined, null, "", "abc", -5]) expect(expiryAtFor({ gameMinutes: v }, 1000)).toBeNull();
    expect(expiryAtFor(undefined, 1000)).toBeNull();
  });
});

describe("dueDrugs: чей срок вышел к моменту `to`", () => {
  const item = (active, { isAfterEffect = false, expiresAt = null, type = "drug" } = {}) =>
    ({ type, system: { activeEffect: { isActive: active, isAfterEffect, expiresAt } } });

  it("действует, отметка есть и достигнута — вышел (граница включительно)", () => {
    const due = dueDrugs([item(true, { expiresAt: 4600 })], 4600);
    expect(due).toHaveLength(1);
    expect(dueDrugs([item(true, { expiresAt: 4600 })], 4599)).toHaveLength(0);
  });
  it("без отметки, не действует, идёт пост-эффект или не препарат — не трогаем", () => {
    expect(dueDrugs([item(true)], 9e9)).toHaveLength(0);
    expect(dueDrugs([item(false, { expiresAt: 1 })], 9e9)).toHaveLength(0);
    expect(dueDrugs([item(true, { isAfterEffect: true, expiresAt: 1 })], 9e9)).toHaveLength(0);
    expect(dueDrugs([item(true, { expiresAt: 1, type: "weapon" })], 9e9)).toHaveLength(0);
  });
});

describe("Струп на настоящих данных", () => {
  it("в паке стоит срок 60 минут, и схема его не теряет", () => {
    const doc = scab();
    expect(doc, "Струп в packs-src/chemistry").toBeTruthy();
    expect(doc.system.gameMinutes).toBe(60);
    expect(new DrugData(structuredClone(doc.system)).toObject().gameMinutes).toBe(60);
  }, PACK_SCAN_TIMEOUT);

  it("прочие препараты по умолчанию — вручную (0)", () => {
    expect(new DrugData({}).toObject().gameMinutes).toBe(0);
  });
});
