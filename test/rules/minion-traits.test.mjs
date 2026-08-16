// test/rules/minion-traits.test.mjs
//
// Таблица Трейтов Миньонов (корбук стр. 112). В PDF она свёрстана колонками и
// разметкой не размечена, поэтому в данные перенесена руками — тем важнее
// проверить форму записи и связь с компендиумом.
//
// Главная проверка здесь — последняя: у каждого Трейта таблицы есть предмет в
// паке. Иначе генератор предлагал бы слуге то, чего в мире нет, и записывал бы
// строку вместо Трейта с описанием и эффектами.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { MINION_TRAITS, MANDATORY_BY_GROUP, THRALL_WYRD } from "../../module/constants/minion-traits.mjs";
import { traitEntry, traitAvailability, availableTraits, mandatoryTraits } from "../../module/rules/minion-build.mjs";

const root = path.resolve(import.meta.dirname, "../..");

/** Все Трейты пака: имя документа из каждого JSON packs-src/traits. */
function packTraitNames() {
  const dir = path.join(root, "packs-src/traits");
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f =>
    f.isDirectory() ? walk(path.join(d, f.name)) : (f.name.endsWith(".json") && f.name !== "_Folder.json" ? [path.join(d, f.name)] : []));
  return walk(dir).map(file => JSON.parse(fs.readFileSync(file, "utf8")).name);
}

describe("таблица Трейтов Миньонов", () => {
  it("у каждой записи есть цена, четыре группы и три уровня", () => {
    const broken = Object.entries(MINION_TRAITS).filter(([, def]) =>
      typeof def.cost !== "number"
      || ["human", "beast", "machine", "daemon"].some(g => !(g in def.groups))
      || ["lesser", "standard", "greater"].some(t => !(t in def.tiers)));
    expect(broken.map(([name]) => name)).toEqual([]);
  });

  it("обязательные Трейты — ровно те, что назвала книга", () => {
    expect(MANDATORY_BY_GROUP).toEqual([
      { group: "daemon", name: "Daemonic" },
      { group: "machine", name: "Machine" }
    ]);
    expect(mandatoryTraits("daemon")).toEqual(["Daemonic"]);
    expect(mandatoryTraits("human")).toEqual([]);
  });

  it("Тралл-Вирд считает максимум и требование по своей паре", () => {
    expect(THRALL_WYRD).toEqual({ name: "Thrall-Wyrd", masterChar: "wp", reqSkill: "Forbidden Lore (Psykers)" });
  });
});

describe("доступность Трейта паре «группа + сила»", () => {
  it("группа решает, кому Трейт вообще положен", () => {
    expect(traitAvailability("Daemonic Armament", "daemon", "greater").allowed).toBe(true);
    const denied = traitAvailability("Daemonic Armament", "human", "greater");
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/недоступен/);
  });

  it("сила решает, с какого уровня и с каким Рейтингом", () => {
    expect(traitAvailability("Bite", "beast", "lesser").rating).toBe(1);
    expect(traitAvailability("Bite", "beast", "greater").rating).toBe(4);
    // Warp Weapon книга открывает только Высшему.
    expect(traitAvailability("Warp Weapon", "daemon", "standard").allowed).toBe(false);
    expect(traitAvailability("Warp Weapon", "daemon", "greater").allowed).toBe(true);
  });

  // Орда строится как Низший, Превосходящий — как Высший: доступность Трейтов
  // берётся у того уровня, по которому идёт сборка, а не у самого названия.
  it("Орда берёт доступность Низшего, Превосходящий — Высшего", () => {
    expect(traitAvailability("Warp Weapon", "daemon", "horde").allowed).toBe(false);
    expect(traitAvailability("Warp Weapon", "daemon", "superior").allowed).toBe(true);
  });

  it("недостатки возвращают очко, Размер бесплатен", () => {
    expect(traitAvailability("Warp Instability", "human", "lesser").cost).toBe(-1);
    expect(traitAvailability("Blind", "human", "lesser").cost).toBe(-1);
    expect(traitAvailability("Size", "human", "lesser").cost).toBe(0);
  });

  it("обязательный Трейт помечен как обязательный", () => {
    expect(traitAvailability("Daemonic", "daemon", "lesser").mandatory).toBe(true);
    expect(traitAvailability("Daemonic", "human", "lesser").mandatory).toBe(false);
  });

  // «Daemonic» не должен перехватывать «Daemonic Presence»: ищем самое длинное
  // совпадение, иначе цена и Рейтинг подставлялись бы от другого Трейта.
  it("имя из компендиума узнаётся, и длинное не путается с коротким", () => {
    expect(traitEntry("Daemonic Presence / Демоническое Присутствие").key).toBe("Daemonic Presence");
    expect(traitEntry("Daemonic / Демонический").key).toBe("Daemonic");
    expect(traitEntry("Меткий Выстрел")).toBeNull();
  });

  it("список доступного растёт вместе с силой", () => {
    const lesser  = availableTraits("daemon", "lesser").length;
    const greater = availableTraits("daemon", "greater").length;
    expect(greater).toBeGreaterThan(lesser);
  });
});

describe("связь таблицы с компендиумом", () => {
  it("у каждого Трейта таблицы есть предмет в паке", () => {
    const names = packTraitNames();
    const missing = Object.keys(MINION_TRAITS).filter(key => !names.some(n => n.includes(key)));
    expect(missing).toEqual([]);
  });
});
