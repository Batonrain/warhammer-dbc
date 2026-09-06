// test/rules/ability-by-key.test.mjs
//
// Опознание способности по КЛЮЧУ рядом с опознанием по имени (wdbc-iadw).
//
// Было: hasFrenzy(actor) = «есть предмет типа talent с именем Frenzy». Имя —
// договор, который держится ни на чём: переименовали в компендиуме, и Талант
// молча перестал работать (AGENTS.md приводит это на своём же примере, «Sure
// Stitch» вместо «Sure Strike»).
//
// Стало: сперва имя, потом ключ Возможности. Порядок такой, а не обратный, по
// двум причинам. Во-первых, приём проекта — новое живёт РЯДОМ со старым, ни
// один шаг не начинается с удаления работающего кода. Во-вторых, цена: проверка
// имени идёт по разобранному кэшу (rules/predicates.mjs) и почти бесплатна, а
// hasRuleFlag вне пересчёта листа собирает все правила актора заново. В обычном
// случае, когда имя на месте, до сборки правил дело не доходит вовсе.
//
// Ключ спасает ровно тогда, когда имя разошлось: переименовали, перевели,
// добавили специализацию в скобках.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hasAbility } from "../../module/rules/ability-by-key.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();
const restore = () => { clearRuleSources(); for (const [k, fn] of DEFAULT_SOURCES) registerRuleSource(k, fn); };

/** Предмет с записью Конструктора «Возможность» — как он лежит в паке. */
const withCapability = (item, key) => ({
  ...item,
  flags: { "warhammer-dbc": { mechanics: [{
    id: "grp1", operator: "AND",
    entries: [{ id: "e1", kind: "capability", capabilityKey: key, when: { negate: false, conditions: [] } }]
  }] } }
});

const actorOf = (...items) => ({ type: "character", system: { characteristics: {} }, items });

beforeEach(restore);
afterEach(restore);

describe("hasAbility — имя или ключ", () => {
  it("находит по имени, когда ключа на предмете нет", () => {
    const actor = actorOf({ id: "1", type: "talent", name: "Frenzy / Ярость" });
    expect(hasAbility(actor, "ability.frenzy", "Frenzy", "talent")).toBe(true);
  });

  it("находит по ключу, когда предмет ПЕРЕИМЕНОВАЛИ", () => {
    // Ровно тот случай, ради которого всё затевалось: в компендиуме поправили
    // название по книге, и старое имя больше не совпадает.
    const renamed = withCapability(
      { id: "1", type: "talent", name: "Berserk Fury / Берсеркова Ярость" }, "ability.frenzy");
    expect(hasAbility(actorOf(renamed), "ability.frenzy", "Frenzy", "talent")).toBe(true);
  });

  it("чужой предмет не отвечает ни по имени, ни по ключу", () => {
    const other = withCapability({ id: "1", type: "talent", name: "Snapshot" }, "ability.snapshot");
    expect(hasAbility(actorOf(other), "ability.frenzy", "Frenzy", "talent")).toBe(false);
  });

  it("тип предмета учитывается у имени", () => {
    // Оружие с именем «Frenzy» не делает персонажа берсерком.
    const weapon = { id: "1", type: "weapon", name: "Frenzy" };
    expect(hasAbility(actorOf(weapon), "ability.frenzy", "Frenzy", "talent")).toBe(false);
  });

  it("несколько допустимых типов — список", () => {
    const trait = { id: "1", type: "trait", name: "Frenzy" };
    expect(hasAbility(actorOf(trait), "ability.frenzy", "Frenzy", ["talent", "trait"])).toBe(true);
  });

  it("ключ работает независимо от типа носителя", () => {
    // Возможность выдаётся правилом или любым предметом — тип носителя здесь
    // не при чём. Это и есть развязка кода с названиями и видами предметов.
    const mutation = withCapability({ id: "1", type: "mutation", name: "Что угодно" }, "ability.frenzy");
    expect(hasAbility(actorOf(mutation), "ability.frenzy", "Frenzy", "talent")).toBe(true);
  });

  it("нет актора или нет предметов — нет способности", () => {
    expect(hasAbility(null, "ability.frenzy", "Frenzy", "talent")).toBe(false);
    expect(hasAbility(actorOf(), "ability.frenzy", "Frenzy", "talent")).toBe(false);
  });

  it("пустой ключ не ломает проверку по имени", () => {
    const actor = actorOf({ id: "1", type: "talent", name: "Frenzy" });
    expect(hasAbility(actor, "", "Frenzy", "talent")).toBe(true);
  });
});

describe("hasAbility не платит за ключ, когда имя на месте", () => {
  it("совпадение по имени не запускает сборку правил", () => {
    // Проверка имени идёт по кэшу разбора и почти бесплатна; сборка правил
    // вне пересчёта листа обходит все предметы и все записи их Конструктора.
    // Если порядок перевернуть, каждая проверка способности в бою станет
    // полным обходом — а таких проверок за одну атаку десятки.
    let sourceCalls = 0;
    clearRuleSources();
    registerRuleSource("счётчик", () => { sourceCalls++; return []; });

    const actor = actorOf({ id: "1", type: "talent", name: "Frenzy / Ярость" });
    expect(hasAbility(actor, "ability.frenzy", "Frenzy", "talent")).toBe(true);
    expect(sourceCalls).toBe(0);

    // А вот когда имя не совпало — к ключу обращаемся.
    expect(hasAbility(actor, "ability.snapshot", "Snapshot", "talent")).toBe(false);
    expect(sourceCalls).toBeGreaterThan(0);
  });
});
