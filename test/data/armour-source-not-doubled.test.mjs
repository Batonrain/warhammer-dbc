// test/data/armour-source-not-doubled.test.mjs
//
// У брони должен быть ОДИН источник. Предмет, который выдаёт комплект брони
// записью Конструктора (kind:"equipment" на пак armor), не может вдобавок
// нести собственные очки брони в system.effects.apHead/apBody/apArms/apLegs:
// расчёт листа (module/rules/character.mjs) складывает system.armorBonus
// ПОВЕРХ AP надетой брони, а не берёт максимум, — и защита удваивается.
//
// Так и вышло с Боевыми Латами Скитарии (wdbc-tuh4). Сначала броня вообще не
// приходила; когда починили выдачу и слот в Хирургеоне, живая проверка
// показала на листе 12/14/12/10 вместо книжных 6/7/5/5 — старые ap-поля
// импланта продолжали действовать рядом с новым предметом брони. Персонаж со
// Скитарийскими Латами становился практически неубиваемым, и заметить это
// можно было только глазами на листе.
//
// Тест дешёвый и общий: он ловит эту связку у ЛЮБОГО предмета, а не только у
// Лат.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(fileURLToPath(new URL("../..", import.meta.url)), "packs-src");
const AP_FIELDS = ["apHead", "apBody", "apArms", "apLegs"];

function listJson(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "books") out.push(...listJson(p)); }
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

/** Выдаёт ли предмет комплект брони записью Конструктора. */
function grantsArmour(doc) {
  const groups = doc?.flags?.["warhammer-dbc"]?.mechanics;
  if (!Array.isArray(groups)) return false;
  for (const g of groups) {
    for (const e of g?.entries ?? []) {
      if (e?.kind !== "equipment") continue;
      const pack = String(e.equipCategoryPack ?? "");
      const uuid = String(e.equipSourceUuid ?? "");
      if (pack === "armor" || /\.armor\./.test(uuid)) return true;
    }
  }
  return false;
}

describe("броня считается из одного источника", () => {
  const docs = listJson(ROOT).map(file => {
    try { return { file, doc: JSON.parse(fs.readFileSync(file, "utf8")) }; }
    catch { return null; }
  }).filter(Boolean);

  it("packs-src разобран", () => {
    expect(docs.length).toBeGreaterThan(1000);
  });

  it("выдающий броню предмет не несёт собственных очков брони", () => {
    const doubled = [];
    for (const { doc } of docs) {
      if (!doc?.system || !grantsArmour(doc)) continue;
      const own = AP_FIELDS.filter(f => Number(doc.system?.effects?.[f]) > 0);
      if (own.length) doubled.push(`${doc.name}: и выдаёт броню, и сам даёт ${own.join(", ")}`);
    }
    expect(doubled, doubled.join("\n")).toEqual([]);
  });

  it("Боевые Латы Скитарии — именной случай: броню даёт только предмет", () => {
    const plate = docs.find(({ doc }) => String(doc?.name || "").includes("Боевые Латы Скитарии")
                                      && doc?.type === "implant");
    expect(plate, "имплант Лат пропал из паков").toBeTruthy();
    expect(grantsArmour(plate.doc)).toBe(true);
    for (const f of AP_FIELDS) expect(Number(plate.doc.system?.effects?.[f]) || 0, f).toBe(0);
  });
});
