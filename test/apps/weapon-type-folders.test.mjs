// test/apps/weapon-type-folders.test.mjs
//
// wdbc: архетипы Noble/Numen задают «Тип» оружия целой веткой Рукопашное/
// Стрелковое (книжное «1 любое оружие ближнего боя R1/R2/R3», не конкретный
// тип) — до этой правки ITEM_FILTERS.folderId сравнивал строго один-в-один,
// а предметы лежат только в листьях, поэтому ветка целиком не находила НИ
// ОДНОГО предмета (не просто пустая метка «()» в описании — реальный пустой
// список в Обозревателе). coreWeaponTypeFolders/weaponTypeFolderIds
// (module/apps/compendium-browser.mjs) закрывают это: ветка — валидный пункт
// выбора («— любое»), который раскрывается в список листьев на фильтре.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { coreWeaponTypeFolders, weaponTypeFolderIds } from "../../module/apps/compendium-browser.mjs";

function folder(id, name, parent) {
  return { id, name, folder: parent };
}

function setWeaponsPack(folders) {
  game.packs = new Map();
  game.packs.set("warhammer-dbc.weapons", { folders: { contents: folders } });
}

const CORE_ID     = "core0000000000ab";
const MELEE_ID    = "melee000000000cd";
const RANGED_ID   = "ranged00000000ef";
const POWER_ID    = "power000000000gh";
const CHAIN_ID    = "chain000000000ij";
const BOLTER_ID   = "bolter00000000kl";
const ASTARTES_ID = "astartes000000mn";
// Decoy: race branch reuses the same folder NAME "Рукопашное" under a
// different top-level root — must not be confused with the core branch.
const ASTARTES_MELEE_ID = "amelee00000000qr";

const ALL_FOLDERS = [
  folder(CORE_ID, "Имперское", null),
  folder(MELEE_ID, "Рукопашное", CORE_ID),
  folder(RANGED_ID, "Стрелковое", CORE_ID),
  folder(POWER_ID, "Силовое", MELEE_ID),
  folder(CHAIN_ID, "Цепное", MELEE_ID),
  folder(BOLTER_ID, "Болтерное", RANGED_ID),
  folder(ASTARTES_ID, "Астартес", null),
  folder(ASTARTES_MELEE_ID, "Рукопашное", ASTARTES_ID)
];

describe("coreWeaponTypeFolders", () => {
  it("включает и листья, и саму ветку целиком («— любое»)", () => {
    setWeaponsPack(ALL_FOLDERS);
    const list = coreWeaponTypeFolders();
    const names = list.map(f => f.name);
    expect(names).toContain("Рукопашное — любое");
    expect(names).toContain("Стрелковое — любое");
    expect(names).toContain("Силовое (Рукопашное)");
    expect(names).toContain("Болтерное (Стрелковое)");
    // Ветка расы с тем же именем не должна попасть в список вовсе.
    expect(list.some(f => f.id === ASTARTES_MELEE_ID)).toBe(false);
  });

  it("без пака/без «Имперское» отдаёт пустой список", () => {
    game.packs = new Map();
    expect(coreWeaponTypeFolders()).toEqual([]);
  });
});

describe("weaponTypeFolderIds", () => {
  it("для конкретного листа возвращает его же id", () => {
    setWeaponsPack(ALL_FOLDERS);
    expect(weaponTypeFolderIds(POWER_ID)).toEqual([POWER_ID]);
  });

  it("для ветки целиком возвращает id всех её листьев", () => {
    setWeaponsPack(ALL_FOLDERS);
    const ids = weaponTypeFolderIds(MELEE_ID);
    expect(ids.sort()).toEqual([CHAIN_ID, POWER_ID].sort());
  });

  it("не путает ветку корбука с одноимённой веткой другой расы", () => {
    setWeaponsPack(ALL_FOLDERS);
    // Тот же id, что у расовой "Рукопашное", а не у корбучной — не наша ветка,
    // должен просто вернуться как обычный (пустой) лист.
    expect(weaponTypeFolderIds(ASTARTES_MELEE_ID)).toEqual([ASTARTES_MELEE_ID]);
  });

  it("пусто/не задано → пустой список", () => {
    setWeaponsPack(ALL_FOLDERS);
    expect(weaponTypeFolderIds("")).toEqual([]);
    expect(weaponTypeFolderIds(null)).toEqual([]);
  });
});
