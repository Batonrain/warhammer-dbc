// test/apps/multiple-eyes-submutation-mechanics.test.mjs
//
// wdbc-1rno: субмутации 2 (Фасетчатые Глаза → +20 Awareness), 3 (Паучьи
// Глаза → Талант Independent Targeting) и 5 (Обычные → +10/+20 Awareness)
// мутации Multiple Eyes/Множественные Глаза заведены Механикой самого
// предмета — тот же приём when.submutations, что у Tentacle/Щупальце
// и Strange Tongue/Странный Язык.
//
// wdbc-5inv (10.09.2026): субмутация 1 (Псевдонавигатор) добавлена честной
// capability-заглушкой без читателя — навигация корабля через Варп не
// смоделирована в системе (играется мастером), тот же паттерн, что Rootbound
// у Extra Arm-7.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";

const multipleEyes = packDocById("packs-src/mutations/Общие_мутации", "QNkitLzwFw8vE4Gn");
const mechEntries = multipleEyes.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const withSub = mechEntries.filter(e => (e.when?.submutations ?? []).length);

describe("Multiple Eyes/Множественные Глаза: Механика субмутаций 2, 3 и 5 — данные согласованы", () => {
  it("1 (Псевдонавигатор) — честная capability-заглушка без читателя", () => {
    const e = withSub.find(x => x.when.submutations.includes("1"));
    expect(e.kind).toBe("capability");
    expect(e.capabilityKey).toBe("mutation.multipleEyes.pseudoNavigator");
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

});
