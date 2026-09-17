// Бессмертная Красота / Immortal Beauty (Дар Слаанеш, wdbc-1rno): book —
// «Когда он тяжело или критически ранен ИЛИ лишился части тела, он получает
// Трейт Regeneration (1)». Была помечена capability-заглушкой с явной
// пометкой «гейт по тиру Ран не поддержан entry.when» — та пометка устарела:
// when.woundTier существует и уже применяется в паке (Толстокожий/
// Thick_Skinned, тот же приём). Мигрирована на реальную запись kind:"trait"
// (Regeneration/Регенерация, rating "1") под when.woundTier:["heavy","dying"]
// ИЛИ when.condition:[lostHands/…] (when.anyOf:true — «достаточно одного
// гейта», mech-when.mjs) — второй триггер добавлен 17.09.2026 (wdbc-1rno.6),
// когда Состояния потери частей тела (module/constants/conditions.mjs)
// перестали быть честной заглушкой.
// Остаток (косметическое заживление при лёгком ранении) сознательно НЕ
// смоделирован — остаётся текстом.

import { describe, it, expect } from "vitest";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";
import { packDocByFileHint } from "../support/pack-doc.mjs";

const SYSTEM = "warhammer-dbc";
const actorWith = (tier, conditions = {}) => ({ system: { wounds: { tier }, conditions } });

describe("Immortal Beauty: Regeneration(1) по тиру Ран ИЛИ потере части тела (wdbc-1rno, wdbc-1rno.6)", () => {
  const doc = packDocByFileHint("packs-src/mutations/Дары_Богов/Слаанеш/Immortal_Beauty___Бессмертная_Красота_sBzuRTFAO2ZN2Kmt.json");
  const mechanics = doc.flags[SYSTEM].mechanics;
  const regenGroup = mechanics.find(g => g.entries.some(e => e.kind === "trait"));
  const entry = regenGroup?.entries.find(e => e.kind === "trait");

  it("запись найдена и несёт правильный Трейт/рейтинг", () => {
    expect(entry).toBeDefined();
    expect(entry.sourceName).toBe("Regeneration / Регенерация (X)");
    expect(entry.sourceHasRating).toBe(true);
    expect(entry.rating).toBe("1");
  });

  it("Здоров/Легко ранен, нет потерянных частей тела — условие НЕ пройдено", () => {
    expect(entryWhenOk(actorWith("healthy"), entry)).toBe(false);
    expect(entryWhenOk(actorWith("light"), entry)).toBe(false);
  });

  it("Тяжело ранен/При смерти — условие пройдено (тир Ран)", () => {
    expect(entryWhenOk(actorWith("heavy"), entry)).toBe(true);
    expect(entryWhenOk(actorWith("dying"), entry)).toBe(true);
  });

  it("Здоров, но лишился части тела — условие пройдено (второй гейт, wdbc-1rno.6)", () => {
    expect(entryWhenOk(actorWith("healthy", { lostHands: true }), entry)).toBe(true);
    expect(entryWhenOk(actorWith("healthy", { lostEyes: true }), entry)).toBe(true);
  });

  it("Тяжело ранен И лишился части тела — всё ещё пройдено (ИЛИ, не исключающее)", () => {
    expect(entryWhenOk(actorWith("heavy", { lostLegs: true }), entry)).toBe(true);
  });

  it("Ни тира Ран, ни потери части тела — не пройдено", () => {
    expect(entryWhenOk(actorWith("light", {}), entry)).toBe(false);
  });
});
