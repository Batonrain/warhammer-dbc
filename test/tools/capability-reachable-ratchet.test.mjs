// test/tools/capability-reachable-ratchet.test.mjs
//
// ХРАПОВИК ДОСЯГАЕМОСТИ ВОЗМОЖНОСТЕЙ (wdbc-3jlm, найдено живой проверкой
// 07.09.2026).
//
// У возможности две половины: ЧИТАТЕЛЬ в коде (кто-то спрашивает hasRuleFlag)
// и ВЫДАЧА — предмет в packs-src с записью Конструктора kind:"capability" либо
// правило в module/rules/library/* с effects grantFlag. Пока есть только одна
// половина, механика не работает НИ У КОГО, и заметить это тестами нельзя:
// код правильный, тесты зелёные, а за столом ничего не происходит.
//
// Ровно так вышло с Талантом «Два Оружия»: модуль rules/dual-wield.mjs, окно
// атаки, списание одного ОД на пару ударов — всё было написано и покрыто
// пятнадцатью тестами, но сам Талант в компендиуме записи «Возможность» не
// нёс, и галочка «Обе руки» не появлялась ни у кого. Поймала только живая
// проверка.
//
// Замер на 07.09.2026: 69 возможностей из 253 имеет читателя и не выдаётся
// ничем. Это долг, а не норма: у части «выдача» задумана снаружи (эффект,
// который ГМ ставит руками), но у большинства — просто не дописана.
//
// Число только вниз (toBeLessThanOrEqual). Новая возможность с читателем и
// без выдачи ломает тест — и это правильно: писать читателя, к которому
// невозможно прийти из игры, значит писать мёртвый код.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Текущий долг. Двигать ТОЛЬКО вниз и только вместе с реальной выдачей. */
const DEBT = 69;

function walk(dir, onFile) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    // Книги — журнальные тексты, записей Конструктора в них нет.
    if (e.isDirectory()) { if (e.name !== "books" && e.name !== "node_modules") walk(p, onFile); }
    else onFile(p);
  }
}

/** Ключи, выдаваемые предметами: flags.warhammer-dbc.mechanics[].entries[].capabilityKey. */
function grantedByPacks() {
  const keys = new Set();
  const scan = o => {
    if (Array.isArray(o)) o.forEach(scan);
    else if (o && typeof o === "object") {
      if (o.capabilityKey) keys.add(String(o.capabilityKey));
      Object.values(o).forEach(scan);
    }
  };
  walk(path.join(ROOT, "packs-src"), p => {
    if (!p.endsWith(".json")) return;
    try { scan(JSON.parse(fs.readFileSync(p, "utf8"))?.flags); } catch { /* не наш файл */ }
  });
  return keys;
}

/** Ключи, выдаваемые правилами в коде: effects: [{ kind: "grantFlag", target: "…" }]. */
function grantedByCode() {
  const keys = new Set();
  walk(path.join(ROOT, "module"), p => {
    if (!p.endsWith(".mjs")) return;
    const src = fs.readFileSync(p, "utf8");
    for (const m of src.matchAll(/target:\s*"([\w.\-]+)"/g)) keys.add(m[1]);
  });
  return keys;
}

describe("возможности с читателем должны быть достижимы из игры", () => {
  const withReader = Object.entries(CAPABILITIES)
    .filter(([, v]) => String(v?.reader ?? "").trim() !== "")
    .map(([k]) => k);

  it("реестр и паки вообще разобраны — иначе тест зелен от пустоты", () => {
    expect(withReader.length).toBeGreaterThan(100);
    expect(grantedByPacks().size).toBeGreaterThan(100);
  });

  it("число недостижимых возможностей не растёт", () => {
    const packs = grantedByPacks();
    const code  = grantedByCode();
    const unreachable = withReader.filter(k => !packs.has(k) && !code.has(k));

    expect(unreachable.length, `недостижимы:\n${unreachable.join("\n")}`)
      .toBeLessThanOrEqual(DEBT);
  });

  it("вся ветка «Два оружия», у которой есть читатель, выдаётся Талантами", () => {
    // Именной случай, из-за которого храповик и заведён: код был, выдачи не
    // было, и ни один игрок галочку «Обе руки» не видел.
    const packs = grantedByPacks();
    const dual = withReader.filter(k => k.startsWith("dualWield."));
    expect(dual.length).toBeGreaterThan(0);
    expect(dual.filter(k => !packs.has(k))).toEqual([]);
  });
});
