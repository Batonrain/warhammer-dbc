// test/data/damage-subtype-parent.test.mjs
//
// Подвид урона (I(Cr)/X(Fr)/E(El)/E(Fl)/E(Ls)/C(Tx)) уточняет СВОЙ широкий
// тип: flame — это energy, crushing — impact и т.д. (DAMAGE_SUBTYPES.parent,
// module/constants/items.mjs). Подвид при чужом типе — ошибка данных: броня
// и иммунитеты смотрят и на тип, и на подвид, и попадание «энергетическое
// дробящее» ведёт себя ни как одно, ни как другое.
//
// Так было у Сверхъестественного Щита (energy + crushing, книга: «наносит
// 1d10+PR I(Cr) урона»): заполняя 64 силы, агент по контенту обещал сверять
// тип с подвидом и пропустил (wdbc-9zpt, 23.09.2026). Тест ловит это у любого
// предмета: оружие и его профили, психосилы и их профили, техночудеса,
// боеприпасы с заменой типа, встречные атаки Конструктора.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DAMAGE_SUBTYPES } from "../../module/constants/items.mjs";

const ROOT = path.join(fileURLToPath(new URL("../..", import.meta.url)), "packs-src");

function listJson(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "books") out.push(...listJson(p)); }
    else if (e.name.endsWith(".json")) out.push(p);
  }
  return out;
}

/** Все пары {где, тип, подвид} предмета, у которых подвид задан. */
function subtypePairs(doc) {
  const out = [];
  const s = doc?.system ?? {};
  const push = (where, type, sub) => { if (sub) out.push({ where, type, sub }); };
  push("system", s.damageType, s.damageSubtype);
  (Array.isArray(s.profiles) ? s.profiles : []).forEach((p, i) =>
    push(`profiles[${i}]`, p?.damageType || s.damageType, p?.damageSubtype));
  // Боеприпас: подвид взамен без замены типа уточняет тип оружия — сверить нечем.
  if (s.damageTypeOverride) push("ammo override", s.damageTypeOverride, s.damageSubtypeOverride);
  const walk = entries => {
    for (const e of entries ?? []) {
      if (e?.kind === "group") walk(e.group?.entries);
      else if (e?.kind === "counterAttack") push(`counterAttack ${e.id}`, e.ccDamageType, e.ccDamageSubtype);
    }
  };
  for (const g of doc?.flags?.["warhammer-dbc"]?.mechanics ?? []) walk(g.entries);
  return out;
}

describe("подвид урона совпадает со своим типом (DAMAGE_SUBTYPES.parent)", () => {
  it("во всех packs-src", () => {
    const bad = [];
    for (const file of listJson(ROOT)) {
      let doc;
      try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
      for (const { where, type, sub } of subtypePairs(doc)) {
        const def = DAMAGE_SUBTYPES[sub];
        if (!def) bad.push(`${path.relative(ROOT, file)} ${where}: неизвестный подвид «${sub}»`);
        else if (def.parent !== type) bad.push(`${path.relative(ROOT, file)} ${where}: ${type} + ${sub} (нужен ${def.parent})`);
      }
    }
    expect(bad).toEqual([]);
  });
});
