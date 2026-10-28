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

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { hasTalentCapability } from "../../module/rules/ability-by-key.mjs";
import { FEARLESS_CAP, FIREMAN_CAP, JADED_CAP, IDOLATER_CAP } from "../../module/rules/courage-talents.mjs";
import {
  FIELD_SURGEON_CAP, RADICAL_TREATMENT_CAP, FAST_STITCHES_CAP, RESTITCHING_CAP, COUNCILIUM_CAP,
  REANIMATE_CAP, POISONER_CAP, SURGICAL_PRECISION_CAP, HOOK_UP_CAP, TORTURER_CAP
} from "../../module/rules/medic-talents.mjs";
import { SPRAYER_CAPABILITY } from "../../module/combat/defense.mjs";
import { BLACK_MANTLE_KEY } from "../../module/rules/radiation-scene.mjs";
import { MEMORY_THIEF_CAP } from "../../module/rules/omophagea.mjs";
import { TEMPERED_COCOON_CAP, TASTE_THE_SOUL_CAP, situationalRules } from "../../module/rules/situational.mjs";
import { UNHOLY_DEVOTION_CAP } from "../../module/rules/unholy-devotion.mjs";
import { SENSE_OF_BALANCE } from "../../module/combat/walker.mjs";
import { BALEARIC_CAPABILITY } from "../../module/rules/throwing-talents.mjs";
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

const KEYS = {
  FEARLESS_CAP, FIREMAN_CAP, JADED_CAP, IDOLATER_CAP,
  FIELD_SURGEON_CAP, RADICAL_TREATMENT_CAP, FAST_STITCHES_CAP, RESTITCHING_CAP, COUNCILIUM_CAP,
  REANIMATE_CAP, POISONER_CAP, SURGICAL_PRECISION_CAP, HOOK_UP_CAP, TORTURER_CAP,
  SPRAYER_CAPABILITY, BLACK_MANTLE_KEY, MEMORY_THIEF_CAP, TEMPERED_COCOON_CAP, TASTE_THE_SOUL_CAP,
  UNHOLY_DEVOTION_CAP, SENSE_OF_BALANCE, BALEARIC_CAPABILITY,
  LET_IT_FLOW: "geneseed.core.letItFlow",
  LORD_OF_CHAOS: "minion.core.lordOfChaos",
  ANCIENT_WARRIOR: "arsenal.core.ancientWarrior"
};

describe("hasTalentCapability: Талант опознаётся и у копии без ключа", () => {
  for (const [name, key] of Object.entries(KEYS)) {
    it(`${name} (${key}) — по имени из пака`, () => {
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
    expect(minionLoyalty(master([staleCopy(KEYS.ANCIENT_WARRIOR)]), "human", { astartes: true })).toBe(50);
  });

  it("Лорд Хаоса: +50% к числу Миньонов", () => {
    expect(minionCapacity(master([staleCopy(KEYS.LORD_OF_CHAOS)]), ["human"])).toBe(6);
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
