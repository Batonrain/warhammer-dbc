// test/rules/trait-capability-stale-copy.test.mjs
//
// Приёмка #581: стопка дописала ключи Возможностей в уже существовавшие файлы
// Черт Элитных Архетипов. Читатели этих ключей знали только ключ, а копии у
// живых персонажей лежат БЕЗ записи Конструктора до «Обновить мир» — правило
// молчит. Тот же класс, что test/rules/talent-capability-stale-copy.test.mjs,
// только для Черт: копия опознаётся по имени.
//
// Актор собирается из НАСТОЯЩЕГО документа пака со снятой механикой.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mindImmunityBlocksPower } from "../../module/rules/mind-immunity.mjs";
import { refusesCommand } from "../../module/combat/command-state.mjs";
import { hasWeaponPropertyImmunity } from "../../module/combat/weapon-properties.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ELITE = path.join(ROOT, "packs-src", "traits", "Элитные_архетипы");

/** Черта пака по началу имени файла; проверяет, что пак несёт ключ — иначе имя ни к чему не привязано. */
function packTrait(folder, prefix, key) {
  const dir = path.join(ELITE, folder);
  const doc = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.startsWith(prefix))), "utf8"));
  const keys = (doc.flags?.["warhammer-dbc"]?.mechanics ?? []).flatMap(g => g.entries ?? []).map(e => e.capabilityKey);
  expect(doc.type).toBe("trait");
  expect(keys, `${doc.name} в паке несёт ${key}`).toContain(key);
  return doc;
}

/** Копия Черты у старого персонажа: имя то же, записи Конструктора ещё нет. */
const staleCopy = doc => ({ ...doc, _id: undefined, id: "stale", flags: {} });
const actorWith = (...items) => ({ type: "character", system: { characteristics: {} }, items });

const FROM_BEYOND = () => packTrait("Медуза", "From_Beyond", "psychic.mindImmune");

describe("Черты Элитных Архетипов: копия без ключа опознаётся по имени", () => {
  it("Извне (Медуза): иммунитет к психосилам на разум", () => {
    expect(mindImmunityBlocksPower(actorWith(staleCopy(FROM_BEYOND())), "telepathy", "Мезмеризм")).toBe(true);
  });

  it("Извне: Страх, Подавление, Паника — читатели спрашивают и имя", () => {
    for (const key of ["fear.immune", "suppression.immune", "panic.immune"]) packTrait("Медуза", "From_Beyond", key);
    const src = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
    expect(src("module/combat/fear.mjs")).toMatch(/hasAbility\(actor, FEAR_IMMUNE_FLAG, "Извне", "trait"\)/);
    expect(src("module/combat/suppression.mjs")).toMatch(/hasAbility\(actor, "suppression\.immune", "Извне", "trait"\)/);
    expect(src("module/combat/condition-ticks.mjs")).toMatch(/hasAbility\(actor, "panic\.immune", "Извне", "trait"\)/);
  });

  it("Ни Владыка, Ни Слуга (Моритат): не принимает Командования", () => {
    expect(refusesCommand(actorWith(staleCopy(packTrait("Моритат", "No_Lord", "command.cannotReceive"))))).toBe(true);
  });

  it("Доспех Когтя Варпа и Тело Из Плотеметалла: иммунитет к Haywire", () => {
    for (const [folder, prefix] of [["Коготь_Варпа", "Warp_Talon_Suit"], ["Облитератор", "Fleshmetal_Body"]]) {
      const doc = packTrait(folder, prefix, "weaponPropertyImmunity.haywire");
      expect(hasWeaponPropertyImmunity(actorWith(staleCopy(doc)), "haywire"), doc.name).toBe(true);
      expect(hasWeaponPropertyImmunity(actorWith(staleCopy(doc)), "corrosive"), doc.name).toBe(false);
    }
  });

  it("Владыка Тьмы и Тёмные Искусства: Псайкер всегда Связанный", () => {
    for (const [folder, prefix] of [["Тенеткач", "Lord_of_Darkness"], ["Чернокнижник", "Dark_Arts"]]) {
      const doc = packTrait(folder, prefix, "psyker.alwaysBound");
      const system = new ACTOR_DATA_MODELS.character({}).toObject();
      system.psyker.class = "unbound";
      const items = [{ ...staleCopy(doc), getFlag: () => undefined, effects: [] }];
      items.get = id => items.find(i => i.id === id) ?? null;
      WarhammerActor.prototype.prepareDerivedData.call({ type: "character", name: "Старый", system, items, getFlag: () => undefined });
      expect(system.psyker.class, doc.name).toBe("bound");
    }
  });

  it("без Черты — ничего", () => {
    expect(mindImmunityBlocksPower(actorWith(), "telepathy", "Мезмеризм")).toBe(false);
    expect(refusesCommand(actorWith())).toBe(false);
    expect(hasWeaponPropertyImmunity(actorWith(), "haywire")).toBe(false);
  });
});
