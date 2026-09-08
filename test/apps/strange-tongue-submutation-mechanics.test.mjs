// test/apps/strange-tongue-submutation-mechanics.test.mjs
//
// wdbc-1rno: субмутации 6 (Щупальце → Multiple Arms(+1) + testMod Athletics)
// и 8 (Зубастый → integralAttack на новый предмет-оружие Toothy Tongue)
// мутации Strange Tongue/Странный Язык заведены Механикой самого предмета —
// тот же приём when.submutations, что у Tentacle/Щупальце (см.
// tentacle-submutation-mechanics.test.mjs). Страж на РЕАЛЬНЫЕ данные:
// подписи строк в when.submutations обязаны существовать в разобранной
// таблице СУБМУТАЦИИ самого предмета.

import { describe, it, expect } from "vitest";
import { parseSubmutations } from "../../module/rules/submutations.mjs";
import { entryWhenOk } from "../../module/rules/mech-when.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const strangeTongue = packDocById("packs-src/mutations/Общие_мутации", "7cchLXBNvN31QfzY");
const toothyTongue = packDocById("packs-src/weapons/Интегральные_атаки", "sTn9BiteFangXq2K");
const submutations = parseSubmutations(strangeTongue.system.benefit);
const mechEntries = strangeTongue.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
const withSub = mechEntries.filter(e => (e.when?.submutations ?? []).length);

describe("Strange Tongue/Странный Язык: Механика субмутаций 6 и 8 — данные согласованы", () => {
  it("в таблице СУБМУТАЦИИ реально есть строки 6 (Щупальце) и 8 (Зубастый)", () => {
    const labels = submutations.entries.map(e => e.label);
    expect(labels).toContain("6");
    expect(labels).toContain("8");
  });

  it("каждая запись Механики с when.submutations ссылается на существующую строку таблицы", () => {
    const knownLabels = new Set(submutations.entries.map(e => e.label));
    const offenders = withSub.flatMap(e => e.when.submutations.filter(l => !knownLabels.has(l)));
    expect(offenders).toEqual([]);
  });

  it("нашлись ровно 3 записи Механики, гейтованные субмутацией (6: trait+testMod; 8: integralAttack)", () => {
    expect(withSub).toHaveLength(3);
  });

  it("6 (Щупальце) даёт Трейт Multiple Arms(+1) и +10 Athletics", () => {
    const traitEntry = withSub.find(x => x.kind === "trait" && x.when.submutations.includes("6"));
    expect(traitEntry.sourceName).toMatch(/Multiple Arms/);
    expect(traitEntry.sourceHasRating).toBe(true);
    expect(traitEntry.rating).toBe(1);

    const modEntry = withSub.find(x => x.kind === "testMod" && x.when.submutations.includes("6"));
    expect(modEntry.skillKey).toBe("athletics");
    expect(modEntry.value).toBe(10);
  });

  it("8 (Зубастый) даёт integralAttack на реальный предмет-оружие Toothy Tongue", () => {
    const e = withSub.find(x => x.kind === "integralAttack" && x.when.submutations.includes("8"));
    expect(e.equipSourceUuid).toBe(`Compendium.warhammer-dbc.weapons.Item.${toothyTongue._id}`);
  });

  it("предмет-оружие Toothy Tongue несёт книжный профиль 1d5 Rending, Pen 0", () => {
    expect(toothyTongue.system.damage).toBe("1d5");
    expect(toothyTongue.system.damageType).toBe("rending");
    expect(toothyTongue.system.penetration).toBe(0);
    expect(toothyTongue.system.weaponClass).toBe("melee");
  });

  it("entryWhenOk включает запись субмутации 6 только когда именно она выпала на предмете", () => {
    const e = withSub.find(x => x.when.submutations.includes("6"));
    expect(entryWhenOk(null, e, { system: { submutation: { label: "6" } } })).toBe(true);
    expect(entryWhenOk(null, e, { system: { submutation: { label: "8" } } })).toBe(false);
    expect(entryWhenOk(null, e, { system: { submutation: { label: "" } } })).toBe(false);
  });
});
