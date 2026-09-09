// test/apps/multiple-eyes-submutation-mechanics.test.mjs
//
// wdbc-1rno: субмутации 2 (Фасетчатые Глаза → +20 Awareness), 3 (Паучьи
// Глаза → Талант Independent Targeting) и 5 (Обычные → +10/+20 Awareness)
// мутации Multiple Eyes/Множественные Глаза заведены Механикой самого
// предмета — тот же приём when.submutations, что у Tentacle/Щупальце
// и Strange Tongue/Странный Язык.

import { describe, it, expect } from "vitest";
import { parseSubmutations } from "../../module/rules/submutations.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const multipleEyes = packDocById("packs-src/mutations/Общие_мутации", "QNkitLzwFw8vE4Gn");
const submutations = parseSubmutations(multipleEyes.system.benefit);
const mechEntries = multipleEyes.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const withSub = mechEntries.filter(e => (e.when?.submutations ?? []).length);

describe("Multiple Eyes/Множественные Глаза: Механика субмутаций 2, 3 и 5 — данные согласованы", () => {
  it("в таблице СУБМУТАЦИИ реально есть строки 2, 3 и 5", () => {
    const labels = submutations.entries.map(e => e.label);
    expect(labels).toContain("2");
    expect(labels).toContain("3");
    expect(labels).toContain("5");
  });

  it("каждая запись Механики с when.submutations ссылается на существующую строку таблицы", () => {
    const knownLabels = new Set(submutations.entries.map(e => e.label));
    const offenders = withSub.flatMap(e => e.when.submutations.filter(l => !knownLabels.has(l)));
    expect(offenders).toEqual([]);
  });

  it("нашлись ровно 4 записи Механики, гейтованные субмутацией (2: testMod; 3: talent; 5: 2×testMod)", () => {
    expect(withSub).toHaveLength(4);
  });

  it("2 (Фасетчатые Глаза) даёт +20 Awareness", () => {
    const e = withSub.find(x => x.when.submutations.includes("2"));
    expect(e.kind).toBe("testMod");
    expect(e.skillKey).toBe("awareness");
    expect(e.value).toBe(20);
  });

  it("3 (Паучьи Глаза) даёт Талант Independent Targeting", () => {
    const e = withSub.find(x => x.when.submutations.includes("3"));
    expect(e.kind).toBe("talent");
    expect(e.sourceName).toMatch(/Independent Targeting/);
  });

  it("5 (Обычные) даёт два testMod Awareness — +10 и +20, не складываются", () => {
    const entries = withSub.filter(x => x.when.submutations.includes("5"));
    expect(entries).toHaveLength(2);
    expect(entries.map(e => e.value).sort((a, b) => a - b)).toEqual([10, 20]);
    for (const e of entries) {
      expect(e.kind).toBe("testMod");
      expect(e.skillKey).toBe("awareness");
    }
  });

  it("entryWhenOk включает запись субмутации 3 только когда именно она выпала на предмете", () => {
    const e = withSub.find(x => x.when.submutations.includes("3"));
    expect(entryWhenOk(null, e, { system: { submutation: { label: "3" } } })).toBe(true);
    expect(entryWhenOk(null, e, { system: { submutation: { label: "2" } } })).toBe(false);
    expect(entryWhenOk(null, e, { system: { submutation: { label: "" } } })).toBe(false);
  });
});
