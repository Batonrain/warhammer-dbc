// test/data/aspirations-pack.test.mjs
//
// Стремления (корбук стр. 22): три таблицы по d10. Сторож держит два
// расхождения, найденные сверкой 04.10.2026:
//  — Механика записи обязана повторять её же книжную строку модификаторов
//    (иначе лист применяет не то, что написано на нём же);
//  — описание в паке — текст книги, а не пересказ (core.json несёт ту же главу).

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { allPackDocuments, PACKS_SRC } from "../support/pack-docs.mjs";

const docs = allPackDocuments("aspirations")
  .map(({ doc }) => doc)
  .filter(d => d.type === "aspiration");

const CHAR = { Inf: "inf", F: "fel", W: "wp", T: "t", S: "s", I: "int", A: "ag", P: "per", WS: "ws", BS: "bs" };
const SKILL = { Charm: "charm", Commerce: "commerce", Intimidate: "intimidate" };
const sgn = (sign, n) => `${sign === "+" ? "+" : "-"}${n}`;

/** Строка книги → канонический список изменений. */
function fromBookMods(mods) {
  const out = [];
  for (const part of mods.split(/,\s*/)) {
    const m = part.match(/^([+−-])(\d+)\s+(.+)$/);
    if (!m) { out.push(`?${part}`); continue; }
    const [, sign, n, rest] = m;
    if (/^\S+ или \S+$/.test(rest) && !rest.startsWith("на ")) {
      const [a, b] = rest.split(" или ");
      out.push(`or(char:${CHAR[a]}:${sgn(sign, n)}|char:${CHAR[b]}:${sgn(sign, n)})`);
    } else if (CHAR[rest]) out.push(`char:${CHAR[rest]}:${sgn(sign, n)}`);
    else if (rest === "Cor") out.push(`cor:${sgn(sign, n)}`);
    else if (/^Ран[аы]$/.test(rest)) out.push(`wounds:${sgn(sign, n)}`);
    else if (rest === "на тесты Исследований") out.push("cap:craft.researchBonus"); // Для Исследований — только Мастерская, Навыка нет
    else if (rest.startsWith("на тесты ")) out.push(`roll:${SKILL[rest.slice(9)]}:${sgn(sign, n)}`);
    else if (rest.startsWith("доп. снаряжение")) out.push("equipment:1");
    else if (rest.startsWith("Inf.b к стартовому")) out.push("cap:creation.equipPointsPenalty");
    else out.push(`?${part}`);
  }
  return out;
}

/** Механика записи → тот же канонический вид. */
function fromMechanics(doc) {
  const out = [];
  const one = e => {
    if (e.kind === "characteristic") return `char:${e.charKey}:${e.op === "add" ? "+" : "-"}${e.value}`;
    if (e.kind === "corruption") return `cor:${e.op === "subtract" ? "-" : "+"}${e.corruptionValue}`;
    if (e.kind === "wounds") return `wounds:${e.op === "subtract" ? "-" : "+"}${e.woundsValue}`;
    if (e.kind === "rollmod") return `roll:${e.skillKey}:${e.value < 0 ? "-" : "+"}${Math.abs(e.value)}`;
    if (e.kind === "equipment") return `equipment:${e.equipQty}`;
    if (e.kind === "capability") return `cap:${e.capabilityKey}`;
    return `?${e.kind}`;
  };
  for (const g of doc.flags?.["warhammer-dbc"]?.mechanics ?? []) {
    for (const e of g.entries) {
      if (e.kind === "group") out.push(`or(${e.group.entries.map(one).join("|")})`);
      else out.push(one(e));
    }
  }
  return out;
}

// Записи, чья книжная строка не раскладывается на пары «знак число Хар-ка»:
// выбор Характеристик делает игрок при выдаче (флаг charPick).
const CHOICE_AT_GRANT = new Set(["motivation:8"]);
// Дополнительных записей сверх строки модификаторов нет: «Исследования» Инновации
// выражены возможностью Мастерской, не Навыком (решение владельца 04.10.2026).
const EXTRA = {};

describe("Стремления: пак", () => {
  it("30 записей: по 10 в каждой таблице, номера 1..10 без дыр", () => {
    expect(docs).toHaveLength(30);
    for (const t of ["pride", "motivation", "disgrace"]) {
      const ns = docs.filter(d => d.system.table === t).map(d => d.system.n).sort((a, b) => a - b);
      expect(ns).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it("Механика каждой записи повторяет её строку модификаторов", () => {
    for (const d of docs) {
      if (CHOICE_AT_GRANT.has(d.system.key)) continue;
      const want = [...fromBookMods(d.system.mods), ...(EXTRA[d.system.key] ?? [])].sort();
      const got = fromMechanics(d).sort();
      expect({ name: d.name, mech: got }).toEqual({ name: d.name, mech: want });
    }
  });

  it("«Совершенство»: правило выбора вместо готовых записей, +5 одной и −3 двум другим", () => {
    const d = docs.find(x => x.system.key === "motivation:8");
    expect(d.flags["warhammer-dbc"].charPick).toEqual({ plus: 5, minus: 3, minusCount: 2 });
    expect(fromMechanics(d)).toEqual([]);
  });

  it("«Богатство» выбирает из любой категории снаряжения, до Редкости 4", () => {
    const d = docs.find(x => x.system.key === "pride:10");
    const e = d.flags["warhammer-dbc"].mechanics[0].entries.find(x => x.kind === "equipment");
    expect(e).toMatchObject({ equipMode: "choice", equipCategoryPack: "physical", equipMaxAvailability: 4, equipQty: 1 });
  });

  it("описание — текст книги: оно целиком есть в главе корбука (core.json)", () => {
    const core = JSON.parse(fs.readFileSync(path.join(PACKS_SRC, "books", "core.json"), "utf8"));
    const text = JSON.stringify(core)
      .replace(/\\u00a0|\\n/g, " ").replace(/<[^>]+>/g, " ").replace(/\\"/g, '"')
      .replace(/\s+/g, " ");
    // Разрыв слова из PDF («об-ещают») в этой главе вычитан — сравнение строгое.
    const bookNoHyphens = text;
    for (const d of docs) {
      const desc = d.system.description.replace(/\s+/g, " ");
      expect({ name: d.name, inBook: bookNoHyphens.includes(desc) }).toEqual({ name: d.name, inBook: true });
    }
  });
});
