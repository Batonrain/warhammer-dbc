// test/apps/tentacle-submutation-mechanics.test.mjs
//
// wdbc-vkwe (продолжение): субмутации 2-3 (Бронированное → Natural Armour 3)
// и 8 (Могучее → +10 S, Трейт Unnatural S(+2)) мутации Tentacle/Щупальце
// заведены Механикой самого предмета (packs-src/mutations/Общие_мутации/
// Tentacle___Щупальце_....json, flags.warhammer-dbc.mechanics) — по тому же
// приёму, что и «Животный Гибрид» (см. doombc-submutations,
// mechanics-submutation-when.test.mjs). Здесь — не повтор общего механизма
// entryWhenOk (он уже проверен там), а страж на РЕАЛЬНЫЕ данные: подписи
// строк в when.submutations обязаны существовать в разобранной таблице
// СУБМУТАЦИИ самого предмета — иначе правка текста benefit без обновления
// Механики (или наоборот) молча выключит запись навсегда, и тест этого не
// заметит никаким другим путём.
//
// wdbc-nc8q: субмутация 1 (Длинное) добавила четвёртую запись — capability-
// флаг mutation.tentacle.longReach без числового эффекта (растяжение до 15м
// + подъём союзника — ситуативное действие ГМа, не число, см.
// module/constants/capabilities.mjs).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { parseSubmutations } from "../../module/rules/submutations.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const TENTACLE_PATH = path.join(ROOT,
  "packs-src/mutations/Общие_мутации/Tentacle___Щупальце_nUfrCbj7cIAEWope.json");

const tentacle = JSON.parse(fs.readFileSync(TENTACLE_PATH, "utf8"));
const submutations = parseSubmutations(tentacle.system.benefit);
const mechEntries = tentacle.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const withSub = mechEntries.filter(e => (e.when?.submutations ?? []).length);

describe("Tentacle/Щупальце: Механика субмутаций 1, 2-3 и 8 — данные согласованы", () => {
  it("в таблице СУБМУТАЦИИ реально есть строки 1 (Длинное), 2-3 (Бронированное) и 8 (Могучее)", () => {
    const labels = submutations.entries.map(e => e.label);
    expect(labels).toContain("1");
    expect(labels).toContain("2-3");
    expect(labels).toContain("8");
  });

  it("каждая запись Механики с when.submutations ссылается на существующую строку таблицы", () => {
    const knownLabels = new Set(submutations.entries.map(e => e.label));
    const offenders = withSub.flatMap(e => e.when.submutations.filter(l => !knownLabels.has(l)));
    expect(offenders).toEqual([]);
  });

  it("нашлись ровно 4 записи Механики, гейтованные субмутацией (capability-флаг + броня + характеристика + трейт)", () => {
    expect(withSub).toHaveLength(4);
  });

  it("1 (Длинное) даёт только capability-флаг без числового эффекта", () => {
    const e = withSub.find(x => x.when.submutations.includes("1"));
    expect(e.kind).toBe("capability");
    expect(e.capabilityKey).toBe("mutation.tentacle.longReach");
  });

  it("2-3 (Бронированное) даёт Трейт Natural Armour с рейтингом 3", () => {
    const e = withSub.find(x => x.when.submutations.includes("2-3"));
    expect(e.kind).toBe("trait");
    expect(e.sourceName).toMatch(/Natural Armour/);
    expect(e.sourceHasRating).toBe(true);
    expect(e.rating).toBe(3);
  });

  it("8 (Могучее) даёт +10 S характеристикой и Трейт Unnatural S с рейтингом 2", () => {
    const charEntry = withSub.find(x => x.kind === "characteristic" && x.when.submutations.includes("8"));
    expect(charEntry.charKey).toBe("s");
    expect(charEntry.op).toBe("add");
    expect(charEntry.value).toBe(10);

    const traitEntry = withSub.find(x => x.kind === "trait" && x.when.submutations.includes("8"));
    expect(traitEntry.sourceName).toMatch(/Unnatural Strength/);
    expect(traitEntry.sourceHasRating).toBe(true);
    expect(traitEntry.rating).toBe(2);
  });

  it("entryWhenOk включает запись 2-3 только когда именно эта строка выпала на предмете", () => {
    const e = withSub.find(x => x.when.submutations.includes("2-3"));
    expect(entryWhenOk(null, e, { system: { submutation: { label: "2-3" } } })).toBe(true);
    expect(entryWhenOk(null, e, { system: { submutation: { label: "8" } } })).toBe(false);
    expect(entryWhenOk(null, e, { system: { submutation: { label: "" } } })).toBe(false);
  });
});
