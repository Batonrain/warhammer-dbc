// test/rules/talent-capability-stale-copy.test.mjs
//
// Приёмка #554, E1. PR дописал ключ Возможности в уже существовавшие файлы
// Талантов, а у живых персонажей лежат копии БЕЗ этой записи — до «Обновить
// мир» и без миграции. Читатель, который спрашивает только ключ, у такого
// персонажа молчит, хотя соседний читатель того же Таланта (по имени) работает:
// у Древнего Воина −1 Редкости есть, а +10 Лояльности Миньону-Астартес — нет.
//
// Поэтому актор здесь собирается из НАСТОЯЩЕГО документа пака, у которого
// снята механика — ровно как старая копия у персонажа.
//
// Ключи не перечисляются руками: их собирает разбор module/ — все вызовы
// hasTalentCapability и все таблицы { key, name }, по которым код опознаёт
// Талант (MELEE_TALENTS, TAKEDOWN…). Для строки таблицы договор тот же:
// Талант пака несёт ключ и носит имя из таблицы, иначе копия без ключа молчит.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { hasTalentCapability } from "../../module/rules/ability-by-key.mjs";
import { itemHasName } from "../../module/rules/predicates.mjs";
import { FEARLESS_CAP } from "../../module/rules/courage-talents.mjs";
import { BLACK_MANTLE_KEY } from "../../module/rules/radiation-scene.mjs";
import { TEMPERED_COCOON_CAP, TASTE_THE_SOUL_CAP, situationalRules } from "../../module/rules/situational.mjs";
import { minionLoyalty, minionCapacity } from "../../module/rules/minion-build.mjs";
import {
  isForesightItem, isBladeJugglerItem, isWarCryItem
} from "../../module/apps/talent-actions.mjs";
import { isBlackMantleItem } from "../../module/apps/black-mantle.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const TALENTS = path.join(ROOT, "packs-src", "talents");

/** Документ Таланта из пака, несущий этот ключ (поиск по тексту файла — дёшево и без разбора всего пака). */
const packTalentWith = (() => {
  const files = fs.readdirSync(TALENTS, { recursive: true }).filter(f => String(f).endsWith(".json"));
  const cache = new Map();
  return key => {
    if (cache.has(key)) return cache.get(key);
    const needle = `"capabilityKey": "${key}"`;
    for (const f of files) {
      const raw = fs.readFileSync(path.join(TALENTS, f), "utf8");
      if (!raw.includes(needle)) continue;
      const doc = JSON.parse(raw);
      if (doc.type !== "talent") continue;
      cache.set(key, doc);
      return doc;
    }
    throw new Error(`в паке Талантов нет носителя ${key}`);
  };
})();

/** Копия Таланта у старого персонажа: имя то же, записи Конструктора ещё нет. */
const staleCopy = key => ({ ...packTalentWith(key), _id: undefined, id: "stale", flags: {} });
const actorWith = (...items) => ({ type: "character", system: { characteristics: {} }, items });

/** Исходники module/ — путь и текст. */
const MODULE_SOURCES = fs.readdirSync(path.join(ROOT, "module"), { recursive: true })
  .filter(f => String(f).endsWith(".mjs"))
  .map(f => ({ rel: `module/${String(f).split(path.sep).join("/")}`, text: fs.readFileSync(path.join(ROOT, "module", f), "utf8") }));

const STRING_CONST = /const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g;

/**
 * Ключи всех вызовов hasTalentCapability(actor, КЛЮЧ) в module/ — литерал или
 * строковая константа (своя или экспортированная другим модулем). Список
 * собирается из кода, а не руками: новый читатель попадает под проверку сам.
 */
function talentCapabilityKeys() {
  const exported = new Map();
  for (const { text } of MODULE_SOURCES)
    for (const m of text.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) exported.set(m[1], m[2]);
  const keys = new Map(); // ключ → файл первого читателя
  const unresolved = [];
  for (const { rel, text } of MODULE_SOURCES) {
    const own = new Map([...text.matchAll(STRING_CONST)].map(m => [m[1], m[2]]));
    for (const m of text.matchAll(/(?<!function\s)hasTalentCapability\([^,()]+,\s*("[^"]*"|[A-Za-z_$][\w$]*)\s*\)/g)) {
      const key = m[1].startsWith("\"") ? m[1].slice(1, -1) : own.get(m[1]) ?? exported.get(m[1]);
      if (key) { if (!keys.has(key)) keys.set(key, rel); } else unresolved.push(`${rel}: ${m[1]}`);
    }
  }
  return { keys, unresolved };
}

/**
 * Строки таблиц `{ key: "ключ", name: "Имя" }` (MELEE_TALENTS, TAKEDOWN…) в
 * модулях, которые опознают Талант по `t.name` — через hasAbility или
 * itemHasName. Имя — запасной путь для копии без ключа, ключ — основной.
 */
function tableRows() {
  const rows = [];
  for (const { rel, text } of MODULE_SOURCES) {
    if (!/(?:hasAbility|itemHasName)\([^)]*\.name\b/.test(text)) continue;
    for (const m of text.matchAll(/\{\s*key:\s*"([^"]*)",\s*name:\s*"([^"]+)"/g)) rows.push({ key: m[1], name: m[2], rel });
  }
  return rows;
}

/**
 * Строки таблиц, у которых в паке нет Таланта-носителя ключа, — и почему это
 * законно. Закрытый список: новая строка без носителя роняет тест.
 */
const TABLE_ROWS_WITHOUT_CARRIER = {
  // Громыхатель механизирован записью kind:"reroll" (wdbc-u0by), а строку
  // RESILIENCE_TALENTS.thumper код не опрашивает вовсе.
  "resilience.core.thumper": "механизирован kind:\"reroll\" (wdbc-u0by), строку таблицы никто не опрашивает"
};

const { keys: KEYS, unresolved: UNRESOLVED } = talentCapabilityKeys();
// Читатели другой формы — имя передано в вызове, а не взято из реестра:
// itemIs(i, "talent", BLACK_MANTLE_KEY, "Black Mantle") и
// actorHasCapability(actor, TASTE_THE_SOUL_CAP, "Taste the Soul").
KEYS.set(BLACK_MANTLE_KEY, "module/apps/black-mantle.mjs");
KEYS.set(TASTE_THE_SOUL_CAP, "module/rules/situational.mjs");
const TABLE_ROWS = tableRows();

describe("разбор кода находит всех читателей", () => {
  it("hasTalentCapability: каждый ключ распознан, ключей не меньше 26", () => {
    // Порог ловит сузившийся разбор: сторож, проверяющий меньше ключей, зелёный.
    expect(UNRESOLVED, "ключ в вызове не литерал и не строковая константа — научите разбор").toEqual([]);
    expect(KEYS.size).toBeGreaterThanOrEqual(26);
    expect([...KEYS.keys()]).toEqual(expect.arrayContaining(["geneseed.core.letItFlow", FEARLESS_CAP]));
  });

  it("таблицы {key, name}: не меньше 150 строк из 20 модулей", () => {
    expect(TABLE_ROWS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(TABLE_ROWS.map(r => r.rel)).size).toBeGreaterThanOrEqual(20);
    expect(TABLE_ROWS.map(r => r.key)).toEqual(expect.arrayContaining(["meleeCore.core.savior", "meleeCore.core.takedown"]));
  });
});

describe("таблицы {key, name}: Талант пака несёт ключ и носит это имя", () => {
  it("у каждой строки есть Талант-носитель ключа с тем же именем", () => {
    const bad = [];
    for (const { key, name, rel } of TABLE_ROWS) {
      if (key in TABLE_ROWS_WITHOUT_CARRIER) continue;
      let doc = null;
      try { doc = packTalentWith(key); } catch { /* нет носителя */ }
      if (!doc) bad.push(`${key} («${name}», ${rel}) — в паке Талантов нет носителя`);
      else if (!itemHasName(doc, name)) bad.push(`${key} — носитель «${doc.name}», а таблица ${rel} зовёт его «${name}»`);
    }
    expect(bad, "ключ ушёл с Таланта пака или имя разошлось: копия без ключа не опознается").toEqual([]);
  });

  it("строка-исключение без носителя всё ещё без носителя", () => {
    const stale = Object.keys(TABLE_ROWS_WITHOUT_CARRIER).filter(key => {
      try { return !!packTalentWith(key); } catch { return false; }
    });
    expect(stale, "у ключа появился носитель — уберите строку из TABLE_ROWS_WITHOUT_CARRIER").toEqual([]);
  });
});

describe("hasTalentCapability: Талант опознаётся и у копии без ключа", () => {
  for (const [key, rel] of KEYS) {
    it(`${key} (${rel}) — по имени из пака`, () => {
      expect(hasTalentCapability(actorWith(staleCopy(key)), key)).toBe(true);
    });
  }

  it("без Таланта — нет", () => {
    expect(hasTalentCapability(actorWith(), FEARLESS_CAP)).toBe(false);
  });

  it("одноимённая Черта не считается Талантом", () => {
    expect(hasTalentCapability(actorWith({ ...staleCopy(FEARLESS_CAP), type: "trait" }), FEARLESS_CAP)).toBe(false);
  });
});

describe("читатели, знавшие только ключ, у копии без ключа", () => {
  const master = items => ({
    system: { characteristics: { fel: { total: 40 }, wp: { total: 35 }, per: { total: 31 }, int: { total: 50 }, inf: { total: 60 } } },
    items
  });

  it("Древний Воин: +10 Лояльности Миньону-Астартес", () => {
    expect(minionLoyalty(master([staleCopy("arsenal.core.ancientWarrior")]), "human", { astartes: true })).toBe(50);
  });

  it("Лорд Хаоса: +50% к числу Миньонов", () => {
    expect(minionCapacity(master([staleCopy("minion.core.lordOfChaos")]), ["human"])).toBe(6);
  });

  it("Закалённый Кокон: +10 на тест против жара", () => {
    const a = { type: "character", system: { characteristics: { per: { total: 40 } } }, items: [staleCopy(TEMPERED_COCOON_CAP)] };
    const sum = situationalRules(a, { heatTest: true }).flatMap(r => r.effects ?? [])
      .reduce((s, e) => s + (Number(e.value) || 0), 0);
    expect(sum).toBe(10);
  });

  it("Испробовать Душу: +½ P на тест Омофагеи", () => {
    const a = { type: "character", system: { characteristics: { per: { total: 41 } } }, items: [staleCopy(TASTE_THE_SOUL_CAP)] };
    const sum = situationalRules(a, { omophageaTest: true }).flatMap(r => r.effects ?? [])
      .reduce((s, e) => s + (Number(e.value) || 0), 0);
    expect(sum).toBe(21);
  });

  it("кнопки на листе Таланта: Предусмотрительность, Жонглёр Клинком, Боевой Клич, Чёрная Мантия", () => {
    expect(isForesightItem(staleCopy("sage.core.foresight"))).toBe(true);
    expect(isBladeJugglerItem(staleCopy("rogue.core.bladeJuggler"))).toBe(true);
    expect(isWarCryItem(staleCopy("social.core.warCry"))).toBe(true);
    expect(isBlackMantleItem(staleCopy(BLACK_MANTLE_KEY))).toBe(true);
  });
});

describe("окно атаки: Отравитель и Болтерная Муштра — не только по ключу", () => {
  const src = fs.readFileSync(path.join(ROOT, "module/combat/attack.mjs"), "utf8");
  it("attack.mjs опознаёт оба Таланта через hasTalentCapability", () => {
    expect(src).not.toMatch(/hasRuleFlag\(actor, POISONER_CAP\)/);
    expect(src).not.toMatch(/hasRuleFlag\(actor, "weaponsmith\.core\.bolterDrill"\)/);
    expect(src).toMatch(/hasTalentCapability\(actor, POISONER_CAP\)/);
    expect(src).toMatch(/hasTalentCapability\(actor, "weaponsmith\.core\.bolterDrill"\)/);
  });
  it("Болтерная Муштра без ключа опознаётся по имени", () => {
    expect(hasTalentCapability(actorWith(staleCopy("weaponsmith.core.bolterDrill")), "weaponsmith.core.bolterDrill")).toBe(true);
  });
});
