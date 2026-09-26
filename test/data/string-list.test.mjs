// test/data/string-list.test.mjs
//
// Свойства брони, пути отравления и снимаемые модификацией свойства — списки
// строк-ключей. Прежняя схема ArrayField(ObjectField) превращала их в {} в
// живой игре (wdbc-x1nz.2.81). Схема исправлена; испорченное migrateData
// метит LOST_KEY, мировая миграция берёт ключи из компендиума-источника.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { repairStringList, LOST_KEY } from "../../module/data/string-list.mjs";
import { restoredStringList } from "../../module/migrations/string-list-restore.mjs";
import { ArmorData } from "../../module/data/item/armor.mjs";
import { DrugData } from "../../module/data/item/drug.mjs";
import { WeaponModData } from "../../module/data/item/weapon-mod.mjs";

describe("repairStringList", () => {
  it("строки остаются, {} от старой схемы — метка, прочее выбрасывается", () => {
    expect(repairStringList(["hard", {}, "soft", null, 3])).toEqual(["hard", LOST_KEY, "soft"]);
    expect(repairStringList(["sealed"])).toEqual(["sealed"]);
    expect(repairStringList(undefined)).toBeUndefined();
  });
});

describe("migrateData трёх типов", () => {
  it("броня: испорченные свойства помечены, целые сохранены", () => {
    expect(new ArmorData({ properties: [{}, {}] }).toObject().properties).toEqual([LOST_KEY, LOST_KEY]);
    expect(new ArmorData({ properties: ["soft", "sealed"] }).toObject().properties).toEqual(["soft", "sealed"]);
  });
  it("препарат и модификация оружия — тем же приёмом", () => {
    expect(new DrugData({ poisonVector: [{}] }).toObject().poisonVector).toEqual([LOST_KEY]);
    const mod = new WeaponModData({ effects: { removeProps: [{}, "reliable"], mechRemoveProps: ["x"] } }).toObject();
    expect(mod.effects.removeProps).toEqual([LOST_KEY, "reliable"]);
    expect(mod.effects.mechRemoveProps).toEqual(["x"]);
  });
});

describe("restoredStringList", () => {
  it("меток нет — не трогать", () => {
    expect(restoredStringList(["soft"], ["hard"])).toBeNull();
  });
  it("есть источник — его ключи целиком", () => {
    expect(restoredStringList([LOST_KEY, LOST_KEY], ["hard", "sealed"])).toEqual(["hard", "sealed"]);
  });
  it("источника нет — метки сняты, уцелевшее осталось", () => {
    expect(restoredStringList([LOST_KEY, "soft"], null)).toEqual(["soft"]);
  });
});
