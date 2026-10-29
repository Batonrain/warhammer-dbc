// test/apps/ritual-availability.test.mjs
//
// wdbc-zaesd (23.10.2026): Редкость Записи Ритуала — это system.record Ритуала.
// Книга (core.json, «Анатомия ритуала»): «X в Записи отображает Редкость ритуала
// аналогична Редкости снаряжения — записи можно добывать реквизицией и торговлей».
// Обозреватель компендиумов держит Редкость узла в поле `availability`, и для
// Ритуалов оно берётся из record — иначе ни потолок «не выше R3», ни сумма
// «Редкость 11» стартовых Записей Демонолога посчитать нечем.
//
// record = 0 — у Ритуала нет требования «Запись» вовсе (51 из 140 в паке; один
// книжный «Запись (0)» неотличим от них), Редкости у такого нет: null, а не
// «R 0 Дефицит».

import { describe, it, expect } from "vitest";
import { indexAvailability, normalizePick } from "../../module/apps/compendium-filters.mjs";
import { budgetReady, budgetFits } from "../../module/rules/pick-budget.mjs";
import { packDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

describe("indexAvailability: Редкость узла Обозревателя", () => {
  it("у Ритуала это Запись (system.record)", () => {
    expect(indexAvailability({ type: "ritual", system: { record: 3 } })).toBe(3);
    expect(indexAvailability({ type: "ritual", system: { record: 5 } })).toBe(5);
  });

  it("Ритуал без Записи (record 0 или нет поля) — Редкости нет", () => {
    expect(indexAvailability({ type: "ritual", system: { record: 0 } })).toBeNull();
    expect(indexAvailability({ type: "ritual", system: {} })).toBeNull();
    expect(indexAvailability({ type: "ritual" })).toBeNull();
  });

  it("у остального — собственное system.availability как было, включая законный 0", () => {
    expect(indexAvailability({ type: "weapon", system: { availability: 2 } })).toBe(2);
    expect(indexAvailability({ type: "weapon", system: { availability: 0 } })).toBe(0);
    expect(indexAvailability({ type: "implant", system: { availability: null } })).toBeNull();
    expect(indexAvailability({ type: "gear", system: {} })).toBeUndefined();
  });

  it("record у НЕ-Ритуала не подменяет Редкость", () => {
    expect(indexAvailability({ type: "gear", system: { record: 4 } })).toBeUndefined();
  });
});

describe("Записи для Демонолога: потолок R3 и сумма 11", () => {
  const node = (record) => ({ type: "ritual", availability: indexAvailability({ type: "ritual", system: { record } }) });
  // Потолок R3 + нижняя граница 1 по Записи — unrated-availability.test.mjs («Ритуал без Записи…»).
  const pick = normalizePick({
    pack: "rituals", filters: { maxAvailability: 3, minAvailability: 1 },
    budget: { mode: "availability", value: 11 }
  });

  it("бюджет в Обозревателе — сумма Редкости, не штуки", () => {
    expect(pick.budget).toEqual({ mode: "availability", value: 11 });
    const three = [node(3), node(3), node(3)];
    expect(budgetFits(three, node(3), pick.budget)).toBe(false);   // 12 > 11
    expect(budgetFits(three, node(2), pick.budget)).toBe(true);    // 11
    expect(budgetReady([...three, node(2)], pick.budget)).toBe(true);
  });
});

// Сверка с настоящим паком: у каждого Ритуала с record>0 узел получает ту же
// Редкость, что и в книге; ни один Ритуал не теряет Запись при подстановке.
describe("данные: Ритуалы пака", () => {
  it("Редкость узла равна record у всех Ритуалов с Записью, у остальных её нет", () => {
    const docs = packDocuments("rituals", "ritual");
    expect(docs.length).toBeGreaterThan(100);
    let withRecord = 0;
    for (const { doc } of docs) {
      const rec = Number(doc.system?.record) || 0;
      const av = indexAvailability({ type: doc.type, system: doc.system });
      if (rec > 0) { withRecord++; expect(av, doc.name).toBe(rec); }
      else expect(av, doc.name).toBeNull();
    }
    // 140 Ритуалов: 51 без Записи, 89 с Записью R1..R5 (16/15/30/18/10).
    expect(withRecord).toBe(89);
  }, PACK_SCAN_TIMEOUT);
});
