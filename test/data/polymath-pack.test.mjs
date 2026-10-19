// test/data/polymath-pack.test.mjs
//
// Полимат (мутация, DoomBC стр. 440-452): «+10 на все тесты Крафта и тесты
// Исследований», крит на таком тесте — 1d5 Усталости и ещё один тест.
// Решение владельца 04.10.2026 (Sahara 10-cf72, выравнивание с Инновацией):
// «Исследования» живут только в Мастерской Крафта, а не на Навыке «Запретные
// Знания»; ручной путь остаётся для Ремесла (Trade) вместе с критом.

import { describe, it, expect } from "vitest";
import { packDocuments } from "../support/pack-docs.mjs";

const doc = packDocuments("mutations", "mutation").map(d => d.doc).find(d => d.name.startsWith("Polymath"));
const entries = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries);

describe("Полимат: пак", () => {
  it("ручное +10 и крит остаются только на Ремесле (Trade)", () => {
    const testMods = entries.filter(e => e.kind === "testMod");
    expect(testMods.map(e => [e.skillKey, e.value])).toEqual([["trade", 10]]);
    const crits = entries.filter(e => e.kind === "script" && e.scriptTrigger === "critSuccess");
    expect(crits.map(e => e.skillKey)).toEqual(["trade"]);
  });

  it("на Запретные Знания вне Мастерской ничего не висит", () => {
    expect(entries.filter(e => e.skillKey === "forbiddenLore")).toEqual([]);
  });

  it("возможность мутации на месте — Мастерская читает Полимата по имени предмета", () => {
    expect(entries.some(e => e.kind === "capability" && e.capabilityKey === "mutation.polymath")).toBe(true);
  });
});
