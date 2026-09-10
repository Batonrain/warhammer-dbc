// test/apps/tail-submutation-mechanics.test.mjs
//
// wdbc-5inv: субмутация 8 (Скорпионий Хвост, только khorne) мутации
// Tail/Хвост заведена Механикой самого предмета (packs-src/mutations/
// Общие_мутации/Tail___Хвост_....json, flags.warhammer-dbc.mechanics) —
// тот же приём, что и submutations-гейт у Tentacle/Animal Hybrid: три
// Трейта (Natural Armour(4), Deadly Natural Weapons, Toxic(0)) рядом с
// БЕЗУСЛОВНОЙ базовой записью tail-kick (Пинок-профиль), не заменяя её —
// строки 1 (Булава) и 9 (Хвост-Рука) требуют смены/добавления хвата и
// оставлены текстом (открытый вопрос negateSub, см. заметки тикета).
//
// Deadly Natural Weapons/Toxic здесь — то же честное ограничение, что уже
// зафиксировано в notes самих Трейтов (packs-src/traits/Toxic..., .../
// Deadly_Natural_Weapons...): «канала изменить свойство ЧУЖОГО оружия нет» —
// запись даёт персонажу Трейт, а не переписывает already-granted tail-kick
// weapon item. Тот же паттерн, что «Животный Гибрид» (hybrid-cat-claws).

import { describe, it, expect } from "vitest";
import path from "node:path";

import { parseSubmutations } from "../../module/rules/submutations.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";
import { packDocByFileHint } from "../support/pack-doc.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const TAIL_PATH = path.join(ROOT,
  "packs-src/mutations/Общие_мутации/Tail___Хвост_F7iMcjy64r5w52bz.json");

const tail = packDocByFileHint(TAIL_PATH);
const submutations = parseSubmutations(tail.system.benefit);
const mechEntries = tail.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const withSub = mechEntries.filter(e => (e.when?.submutations ?? []).length);

describe("Tail/Хвост: Механика субмутации 8 (Скорпионий Хвост, khorne) согласована", () => {
  it("в таблице СУБМУТАЦИИ реально есть строка 8", () => {
    expect(submutations.entries.map(e => e.label)).toContain("8");
  });

  it("каждая запись Механики с when.submutations ссылается на существующую строку таблицы", () => {
    const knownLabels = new Set(submutations.entries.map(e => e.label));
    const offenders = withSub.flatMap(e => e.when.submutations.filter(l => !knownLabels.has(l)));
    expect(offenders).toEqual([]);
  });

  it("нашлись ровно 3 записи Механики, гейтованные строкой 8", () => {
    expect(withSub).toHaveLength(3);
    expect(withSub.every(e => e.kind === "trait")).toBe(true);
  });

  it("все три гейтованы ТОЛЬКО khorne (книга: '[только для последователей: khorne]')", () => {
    for (const e of withSub) {
      expect(e.when.patronGod).toEqual(["khorne"]);
      expect(e.when.negatePatronGod).toBe(false);
    }
  });

  it("Natural Armour с рейтингом 4", () => {
    const e = withSub.find(x => /Natural Armour/.test(x.sourceName));
    expect(e.sourceHasRating).toBe(true);
    expect(e.rating).toBe(4);
  });

  it("Deadly Natural Weapons без рейтинга (тот же честный предел, что у Trait'а)", () => {
    const e = withSub.find(x => /Deadly Natural Weapons/.test(x.sourceName));
    expect(e.sourceHasRating).toBe(false);
  });

  it("Toxic с рейтингом 0 (книга: Toxic (0))", () => {
    const e = withSub.find(x => /Toxic/.test(x.sourceName));
    expect(e.sourceHasRating).toBe(true);
    expect(e.rating).toBe(0);
  });

  it("entryWhenOk включает запись только когда выпала строка 8 И персонаж — khornit", () => {
    const e = withSub[0];
    const item = { system: { submutation: { label: "8" } } };
    const khornit = { system: { patronGod: "khorne" } };
    const nurglite = { system: { patronGod: "nurgle" } };
    expect(entryWhenOk(khornit, e, item)).toBe(true);
    expect(entryWhenOk(nurglite, e, item)).toBe(false);
    expect(entryWhenOk(khornit, e, { system: { submutation: { label: "2-3" } } })).toBe(false);
    expect(entryWhenOk(khornit, e, { system: { submutation: { label: "" } } })).toBe(false);
  });

  it("базовая запись tail-kick остаётся безусловной (не гейтована строкой 8)", () => {
    const base = mechEntries.find(e => e.id === "tail-kick");
    expect(base.kind).toBe("integralAttack");
    expect(base.when?.submutations ?? []).toEqual([]);
  });
});
