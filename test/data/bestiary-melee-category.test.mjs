// test/data/bestiary-melee-category.test.mjs
//
// Рукопашное оружие бестиария несёт meleeCategory (Sahara meleecategory п.3): от неё зависят Мастер Клинка,
// Молот/Топор, выбор Приёмов и Захват (Когти — замена урона Заломить, Кулаки — ответный удар безоружного).
// У 135 из 142 рукопашных предметов NPC поле было пустым, и эти Таланты у них молчали.
//
// Проставлено по одноимённому оружию из packs-src/weapons (и по слову «Sword/Axe/Whip/Staff/Claws» в названии).
// Звери-приспособления без однозначной категории (Копыта, Рога, Хвост, Крылья, Пасти…) остаются пустыми НАМЕРЕННО:
// в списке MELEE_CATEGORIES для них категории нет — не выдумываем.

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { MELEE_CATEGORIES } from "../../module/constants/weapon-categories.mjs";

const bestiaryWeapons = () => allPackDocuments("bestiary")
  .flatMap(d => (d.doc.items ?? []).map(i => ({ actor: d.doc.name, item: i })))
  .filter(({ item }) => item.type === "weapon" && item.system?.weaponClass === "melee");

describe("meleeCategory у рукопашного оружия бестиария", () => {
  it("заполненная категория — из списка категорий кода", () => {
    const bad = bestiaryWeapons()
      .filter(({ item }) => item.system.meleeCategory && !MELEE_CATEGORIES.includes(item.system.meleeCategory))
      .map(({ actor, item }) => `${actor}: ${item.name} → ${item.system.meleeCategory}`);
    expect(bad).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("основные виды оружия NPC получили категорию по названию", () => {
    const want = [
      [/^Claws \/ Когти/, "Когти"], [/^Bite \/ Укус/, "Укус"], [/^Fists \/ Кулаки/, "Кулаки"],
      [/^Sword \/ Меч/, "Меч"], [/^Longsword/, "Меч"], [/^Нож$/, "Нож"], [/^Пилотопор$/, "Топор"],
      [/^Axe of Khorne/, "Топор"], [/^Whip of Khorne/, "Кнут"], [/^Staff of Tzeentch/, "Посох"]
    ];
    const weapons = bestiaryWeapons();
    for (const [re, cat] of want) {
      const hit = weapons.filter(({ item }) => re.test(item.name));
      expect(hit.length, `оружие ${re} есть в бестиарии`).toBeGreaterThan(0);
      for (const { actor, item } of hit) expect(item.system.meleeCategory, `${actor}: ${item.name}`).toBe(cat);
    }
  }, PACK_SCAN_TIMEOUT);

  it("пустых категорий не больше, чем осталось после прохода (потолок — не даёт им вернуться)", () => {
    const empty = bestiaryWeapons().filter(({ item }) => !item.system.meleeCategory);
    expect(empty.length).toBeLessThanOrEqual(44);
  }, PACK_SCAN_TIMEOUT);
});
