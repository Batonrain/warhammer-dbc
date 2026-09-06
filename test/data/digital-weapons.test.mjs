// test/data/digital-weapons.test.mjs
//
// Пальцевое оружие (wdbc-9dg8 A). Собственный special этих предметов — прямая
// цитата книги: «Умещается в перстень. Можно надеть на каждый палец руки,
// кроме большого, и стрелять одновременно с оружием в этой руке и друг с
// другом». То есть руки такой перстень не занимает вообще.
//
// Пока это жило только текстом, бюджет рук считал перстень обычным пистолетом:
// четыре пальцевых лазера на одной кисти система не давала надеть — «занято 4
// руки из 2», хотя по книге в той же руке ещё и меч держат.
//
// Сторож смотрит с двух сторон, чтобы правку нельзя было потерять при
// добавлении новых предметов: у кого текст про перстень — у того обязано быть
// свойство digital, и наоборот.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { WEAPON_PROPERTIES } from "../../module/constants/weapon-properties.mjs";
import { aggregateAuto, resolveWeaponPropsList } from "../../module/combat/weapon-properties.mjs";

const WEAPONS_DIR = path.join(fileURLToPath(new URL("../..", import.meta.url)), "packs-src", "weapons");

function listJson(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listJson(p));
    else if (e.name.endsWith(".json") && e.name !== "_Folder.json") out.push(p);
  }
  return out;
}

const weapons = listJson(WEAPONS_DIR)
  .map(file => ({ file, doc: JSON.parse(fs.readFileSync(file, "utf8")) }))
  .filter(w => w.doc?.type === "weapon");

const propKeys = w => (w.doc.system?.weaponProps ?? []).map(p => p.key);
const isRingText = w => /перстн|перстень/i.test(String(w.doc.system?.special ?? ""));

describe("свойство digital зарегистрировано", () => {
  it("«Пальцевое» есть в реестре свойств и снимает занятость руки", () => {
    expect(WEAPON_PROPERTIES.digital).toBeTruthy();
    expect(aggregateAuto(resolveWeaponPropsList([{ key: "digital" }])).digital).toBe(true);
  });
});

describe("пальцевое оружие в паках", () => {
  it("предметы с текстом про перстень вообще есть (тест не разбирает пустоту)", () => {
    expect(weapons.filter(isRingText).length).toBeGreaterThanOrEqual(9);
  });

  it("у каждого «умещается в перстень» проставлено свойство Пальцевое", () => {
    const missing = weapons.filter(w => isRingText(w) && !propKeys(w).includes("digital"))
      .map(w => w.doc.name);
    expect(missing).toEqual([]);
  });

  it("свойство Пальцевое не проставлено там, где книга про перстень не говорит", () => {
    const extra = weapons.filter(w => propKeys(w).includes("digital") && !isRingText(w))
      .map(w => w.doc.name);
    expect(extra).toEqual([]);
  });
});
