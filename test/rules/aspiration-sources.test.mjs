// test/rules/aspiration-sources.test.mjs
//
// Откуда лист берёт Стремления для выбора (Black Crusade, стр. 22).
//
// Мир читался мимо: список собирался из одного компендиума, и Стремление,
// созданное ГМом прямо в мире, в выпадающем списке не появлялось — молча, без
// ошибки и подсказки. Проверяется именно сведение источников.

import { describe, it, expect } from "vitest";
import { aspirationChoices, findAspiration, worldAspirationKey, WORLD_KEY_PREFIX }
  from "../../module/rules/aspiration-sources.mjs";

/** Запись библиотеки: ключ вида «таблица:номер» проставляет она сама. */
const lib = (key, name, table, mods = "") => ({ key, name, table, mods, description: "" });

/** Предмет-Стремление, заведённый в мире: ключа у него обычно нет. */
const worldItem = (id, name, table, extra = {}) => ({
  id, name, type: "aspiration",
  system: { table, n: 0, mods: "", description: "", key: "", ...extra }
});

describe("источники Стремлений", () => {
  it("библиотека и мир идут одним списком", () => {
    const choices = aspirationChoices(
      [lib("pride:1", "Мастерство", "pride"), lib("pride:2", "Логика", "pride")],
      [worldItem("abc", "Деяния", "pride")],
      "pride");

    expect(choices.map(c => c.name)).toEqual(["Мастерство", "Логика", "Деяния"]);
  });

  it("таблица разделяет: Гордость не показывает Мотивацию", () => {
    const pack = [lib("pride:1", "Мастерство", "pride"), lib("motivation:1", "Месть", "motivation")];
    const world = [worldItem("a", "Деяния", "pride"), worldItem("b", "Миссионерство", "motivation")];

    expect(aspirationChoices(pack, world, "pride").map(c => c.name)).toEqual(["Мастерство", "Деяния"]);
    expect(aspirationChoices(pack, world, "motivation").map(c => c.name)).toEqual(["Месть", "Миссионерство"]);
  });

  // Выбор на листе хранится ключом, а у предмета мира своего ключа обычно нет:
  // без ключа выбранное Стремление не восстановилось бы после перерисовки.
  it("у предмета мира ключ достраивается из id", () => {
    expect(worldAspirationKey(worldItem("abc", "Деяния", "pride"))).toBe(`${WORLD_KEY_PREFIX}abc`);
  });

  it("свой ключ у предмета уважается", () => {
    expect(worldAspirationKey(worldItem("abc", "Деяния", "pride", { key: "pride:99" }))).toBe("pride:99");
  });

  it("одинаковые ключи не задваиваются — побеждает библиотека", () => {
    const choices = aspirationChoices(
      [lib("pride:1", "Мастерство", "pride", "+5 WS")],
      [worldItem("x", "Мастерство своё", "pride", { key: "pride:1" })],
      "pride");

    expect(choices).toHaveLength(1);
    expect(choices[0].mods).toBe("+5 WS");
  });

  it("безымянное Стремление в список не идёт", () => {
    expect(aspirationChoices([], [worldItem("x", "", "pride")], "pride")).toEqual([]);
  });

  it("чужие типы предметов пропускаются", () => {
    const gear = { id: "g", name: "Ботинки", type: "gear", system: { table: "pride" } };
    expect(aspirationChoices([], [gear], "pride")).toEqual([]);
  });

  it("запись находится по ключу из любого источника", () => {
    const pack = [lib("pride:1", "Мастерство", "pride")];
    const world = [worldItem("abc", "Деяния", "pride")];

    expect(findAspiration(pack, world, "pride:1").name).toBe("Мастерство");
    expect(findAspiration(pack, world, `${WORLD_KEY_PREFIX}abc`).name).toBe("Деяния");
    expect(findAspiration(pack, world, "")).toBeNull();
    expect(findAspiration(pack, world, "нет-такого")).toBeNull();
  });

  it("своё Стремление помечено — лист может отличить его от книжного", () => {
    const [entry] = aspirationChoices([], [worldItem("abc", "Деяния", "pride")], "pride");
    expect(entry.world).toBe(true);
  });
});
