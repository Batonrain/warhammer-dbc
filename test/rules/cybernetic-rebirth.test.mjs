// test/rules/cybernetic-rebirth.test.mjs
//
// Cybernetic Rebirth / Кибернетическое Перерождение (корбук, Механикум):
// «Он получает Трейт Machine(2)». Запись Конструктора kind:"trait" на Таланте
// выдаёт Черту Machine с рейтингом 2 (разовая правка при получении), и броня
// Machine масштабируется под рейтинг (rescaleTraitByRating): AP +2 на всех
// участках, а не шаблонные +3.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { packDocById } from "../support/pack-doc.mjs";
import { rescaleTraitByRating } from "../../module/apps/mechanics.mjs";

const talent = packDocById("packs-src/talents/Механикум", "DBM307JgYFOWAVIt");
const machine = packDocById("packs-src/traits", "a9uOuJE4oCOisx8d");

describe("Кибернетическое Перерождение — данные", () => {
  const entries = (talent.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries);
  const grant = entries.find(e => e.kind === "trait");

  it("несёт одну запись «Черта» — Machine с рейтингом 2", () => {
    expect(entries.filter(e => e.kind === "trait")).toHaveLength(1);
    expect(grant.rating).toBe("2");
    expect(grant.sourceHasRating).toBe(true);
    expect(grant.sourceName).toBe(machine.name);
    expect(grant.sourceUuid).toBe(`Compendium.warhammer-dbc.traits.Item.${machine._id}`);
  });

  it("книга: «Он получает Трейт Machine(2)»", () => {
    const book = fs.readFileSync(path.resolve(import.meta.dirname, "../../packs-src/books/core.json"), "utf8");
    expect(book).toContain("Он получает Трейт Machine(2)");
  });
});

describe("Machine(2): броня масштабируется под рейтинг", () => {
  it("шаблон Machine(3) → AP 2 на всех шести участках, рейтинг-поле двигает выдача", () => {
    const data = rescaleTraitByRating(structuredClone(machine), 2);
    const changes = data.effects.flatMap(e => e.system.changes);
    expect(changes.length).toBeGreaterThan(0);
    for (const ch of changes) expect(ch.value).toBe(2);
  });
});
