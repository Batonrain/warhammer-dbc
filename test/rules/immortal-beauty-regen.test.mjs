// Бессмертная Красота / Immortal Beauty (Дар Слаанеш, wdbc-1rno): book —
// «Когда он тяжело или критически ранен... он получает Трейт Regeneration (1)».
// Была помечена capability-заглушкой с явной пометкой «гейт по тиру Ран не
// поддержан entry.when» — та пометка устарела: when.woundTier существует и
// уже применяется в паке (Толстокожий/Thick_Skinned, тот же приём). Мигрирована
// на реальную запись kind:"trait" (Regeneration/Регенерация, rating "1") под
// when.woundTier:["heavy","dying"] — тот же список, что в примере из шапки
// module/rules/predicates.mjs («Тяжело раненный или хуже»).
// Остаток (потеря части тела как отдельный триггер, инопородный, косметическое
// заживление при лёгком ранении) сознательно НЕ смоделирован — остаётся текстом.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";

const SYSTEM = "warhammer-dbc";
const actorWith = tier => ({ system: { wounds: { tier } } });

describe("Immortal Beauty: Regeneration(1) по тиру Ран (wdbc-1rno)", () => {
  const doc = JSON.parse(readFileSync(
    "packs-src/mutations/Дары_Богов/Слаанеш/Immortal_Beauty___Бессмертная_Красота_sBzuRTFAO2ZN2Kmt.json", "utf8"));
  const mechanics = doc.flags[SYSTEM].mechanics;
  const regenGroup = mechanics.find(g => g.entries.some(e => e.kind === "trait"));
  const entry = regenGroup?.entries.find(e => e.kind === "trait");

  it("запись найдена и несёт правильный Трейт/рейтинг", () => {
    expect(entry).toBeDefined();
    expect(entry.sourceName).toBe("Regeneration / Регенерация (X)");
    expect(entry.sourceHasRating).toBe(true);
    expect(entry.rating).toBe("1");
  });

  it("Здоров/Легко ранен — условие НЕ пройдено", () => {
    expect(entryWhenOk(actorWith("healthy"), entry)).toBe(false);
    expect(entryWhenOk(actorWith("light"), entry)).toBe(false);
  });

  it("Тяжело ранен/При смерти — условие пройдено", () => {
    expect(entryWhenOk(actorWith("heavy"), entry)).toBe(true);
    expect(entryWhenOk(actorWith("dying"), entry)).toBe(true);
  });
});
