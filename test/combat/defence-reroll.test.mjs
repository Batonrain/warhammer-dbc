// test/combat/defence-reroll.test.mjs
//
// Переброс Уклонения и Парирования, брошенных кнопкой на карточке атаки
// (rules/defence-reroll.mjs, combat/defence-reroll.mjs). Окна броска у защиты нет,
// поэтому перебросы Черт и Талантов предлагаются кнопкой на карточке ПРОВАЛЕННОЙ
// защиты; клик повторяет тот же тест без второй Реакции. «Переброс за Очко» из меню
// карточки идёт тем же путём.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { effectAppliesTo } from "../../module/rules/resolve-test.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { defenceRerollsFor, defenceRerollSectionHtml } from "../../module/rules/defence-reroll.mjs";
import { _performDodge, _performParry } from "../../module/combat/defense.mjs";
import { onDefenceRerollClick, rerollDefenceCard } from "../../module/combat/defence-reroll.mjs";

const DEFAULT_SOURCES = getRuleSources();

const evasionReroll = (label = "Соларит", extra = {}) => ({
  id: `test.${label}`, label,
  effects: [{ kind: "rollMode", target: "evasion", mode: "keepBest", rolls: 2, label, ...extra }]
});
const withRules = (...rules) => registerRuleSource("test-defence-reroll", () => rules);

/** Защищающийся: Ag 50 / Dodge 40, WS 45; Реакции 2; флаги — настоящее хранилище. */
function defender(items = []) {
  const a = actorFor({ items, reactions: { value: 2, defenseValue: 0 } });
  const flags = {};
  a.name = "Сибарит"; a.uuid = "Actor.def"; a.type = "character"; a.isOwner = true;
  a.system.skills = { dodge: { total: 40 }, parry: { total: 40, rank: "trained" } };
  a.system.characteristics = { ...a.system.characteristics, ag: { total: 50, bonus: 5 } };
  a.getFlag = (_s, k) => flags[k];
  a.setFlag = async (_s, k, v) => { flags[k] = v; return v; };
  a.update = async changes => {
    for (const [path, v] of Object.entries(changes)) {
      const m = path.match(/^flags\.[^.]+\.(.+)$/);
      if (m) { flags[m[1]] = v; continue; }
      const keys = path.split(".");
      let node = a;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = v;
    }
  };
  return a;
}

/** ChatMessage из того, что ушло в чат: флаги, getFlag/setFlag, владелец. */
function messageFrom(data) {
  const msg = { id: `m${Math.random()}`, flags: structuredClone(data.flags ?? {}), isOwner: true };
  msg.getFlag = (s, k) => msg.flags?.[s]?.[k];
  msg.setFlag = async (s, k, v) => { (msg.flags[s] ??= {})[k] = v; };
  return msg;
}

const last = () => captured.chat.at(-1);
const card = () => last()?.content ?? "";

let prevFromUuid;
beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { ...globalThis.game.user, id: "user-1", isGM: true, targets: new Set() };
  globalThis.game.combat = { started: true, round: 1 };
  prevFromUuid = globalThis.fromUuid;
});
afterEach(() => {
  globalThis.fromUuid = prevFromUuid;
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("область «evasion» — тест Избегания", () => {
  it("ловит Уклонение и Парирование с листа и защиту с карточки, но не другие Навыки", () => {
    expect(effectAppliesTo("evasion", { kind: "skill", skill: "dodge", char: "ag" })).toBe(true);
    expect(effectAppliesTo("evasion", { kind: "skill", skill: "parry", char: "ws" })).toBe(true);
    expect(effectAppliesTo("evasion", { kind: "skill", evasion: true })).toBe(true);
    expect(effectAppliesTo("evasion", { kind: "skill", skill: "awareness", char: "per" })).toBe(false);
    expect(effectAppliesTo("evasion", { kind: "attack", isMelee: true })).toBe(false);
  });

  it("запись Конструктора «Переброс → тест Избегания» становится правилом с этой областью", () => {
    const item = { name: "Solarite / Соларит", type: "talent", system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "reroll", rerollScope: "evasion", rerollMode: "keepBest", label: "Соларит" }] }] } } };
    const rules = rulesFromItemMechanics([item]);
    expect(rules.flatMap(r => r.effects)).toContainEqual(expect.objectContaining({ kind: "rollMode", target: "evasion" }));
  });
});

describe("какие перебросы предлагаются на карточке защиты", () => {
  it("на провале — переброс Избегания; на успехе и на уже переброшенном — нет", () => {
    withRules(evasionReroll());
    const a = defender();
    expect(defenceRerollsFor(a, "dodge", { passed: false }).map(r => r.label)).toEqual(["Соларит"]);
    expect(defenceRerollsFor(a, "parry", { passed: false }).map(r => r.label)).toEqual(["Соларит"]);
    expect(defenceRerollsFor(a, "dodge", { passed: true })).toEqual([]);
    expect(defenceRerollsFor(a, "dodge", { passed: false, rerolled: true })).toEqual([]);
  });

  it("навязанные (who:target) и наказания (keepWorst) не предлагаются", () => {
    withRules(evasionReroll("Локус", { who: "target" }), evasionReroll("Худший", { mode: "keepWorst" }));
    expect(defenceRerollsFor(defender(), "dodge", {})).toEqual([]);
  });

  it("переброс «любого теста» с условием на противника (Охотники на Ангелов) — только против Космодесантника", () => {
    withRules({ id: "ah", label: "Охотники", when: { targetIsAstartes: true },
      effects: [{ kind: "rollMode", target: "all", mode: "keepBest", rolls: 2, label: "Охотники на Ангелов" }] });
    const marine = { uuid: "Actor.m", system: { race: "astartes" }, items: [] };
    const guard = { uuid: "Actor.g", system: { race: "human" }, items: [] };
    expect(defenceRerollsFor(defender(), "dodge", { attackerActor: marine })).toHaveLength(1);
    expect(defenceRerollsFor(defender(), "dodge", { attackerActor: guard })).toHaveLength(0);
  });

  it("кнопки называют тест и источник", () => {
    const html = defenceRerollSectionHtml([{ ruleId: "r1", label: "Соларит" }], "parry");
    expect(html).toContain("wh-defence-reroll-btn");
    expect(html).toContain('data-rule-id="r1"');
    expect(html).toContain("Перебросить Парирование: Соларит");
    expect(defenceRerollSectionHtml([], "dodge")).toBe("");
  });
});

describe("Уклонение: кнопка на карточке и сам переброс", () => {
  it("провал: кнопка переброса и флаг с параметрами теста", async () => {
    withRules(evasionReroll());
    captured.dice = [95];
    await _performDodge(defender(), { extraMod: 0, hitsCount: 2, attackerUuid: "Actor.att" });
    expect(card()).toContain("Уклонение провалено");
    expect(card()).toContain("Перебросить Уклонение: Соларит");
    const test = last().flags["warhammer-dbc"].defenceTest;
    expect(test).toMatchObject({ kind: "dodge", actorUuid: "Actor.def", passed: false, rerolled: false, round: 1 });
    expect(test.opts).toMatchObject({ hitsCount: 2, attackerUuid: "Actor.att" });
  });

  it("успех: кнопки нет", async () => {
    withRules(evasionReroll());
    captured.dice = [10];
    await _performDodge(defender(), { extraMod: 0 });
    expect(card()).toContain("Уклонение успешно");
    expect(card()).not.toContain("wh-defence-reroll-btn");
  });

  it("без переброса у персонажа — кнопки нет", async () => {
    captured.dice = [95];
    await _performDodge(defender(), { extraMod: 0 });
    expect(card()).not.toContain("wh-defence-reroll-btn");
  });

  it("клик: новый бросок остаётся, Реакция не тратится второй раз, второго переброса нет", async () => {
    withRules(evasionReroll());
    const a = defender();
    globalThis.fromUuid = async uuid => (uuid === "Actor.def" ? a : null);
    captured.dice = [95];
    await _performDodge(a, { extraMod: 0, hitsCount: 2 });
    const reactions = a.system.reactions.value;
    const msg = messageFrom(last());
    captured.dice = [10];
    const done = await onDefenceRerollClick(msg, "test.Соларит");
    expect(done).toBe(true);
    expect(card()).toContain("Уклонение успешно");
    expect(card()).toContain("снимает все 2");
    expect(card()).toContain("Переброс: Соларит");
    expect(card()).not.toContain("wh-defence-reroll-btn");
    expect(last().flags["warhammer-dbc"].defenceTest.rerolled).toBe(true);
    expect(a.system.reactions.value).toBe(reactions);
    expect(msg.flags["warhammer-dbc"].defenceRerolled).toBe(true);
  });

  it("второй клик по той же карточке не перебрасывает", async () => {
    withRules(evasionReroll());
    const a = defender();
    globalThis.fromUuid = async uuid => (uuid === "Actor.def" ? a : null);
    captured.dice = [95];
    await _performDodge(a, { extraMod: 0 });
    const msg = messageFrom(last());
    captured.dice = [95];
    await onDefenceRerollClick(msg, "test.Соларит");
    const before = captured.chat.length;
    await onDefenceRerollClick(msg, "test.Соларит");
    expect(captured.chat.length).toBe(before);
  });

  it("карточка из прошлого Раунда не перебрасывается", async () => {
    withRules(evasionReroll());
    const a = defender();
    globalThis.fromUuid = async uuid => (uuid === "Actor.def" ? a : null);
    captured.dice = [95];
    await _performDodge(a, { extraMod: 0 });
    const msg = messageFrom(last());
    globalThis.game.combat = { started: true, round: 2 };
    const before = captured.chat.length;
    await onDefenceRerollClick(msg, "test.Соларит");
    expect(captured.chat.length).toBe(before);
  });

  it("«Переброс за Очко» повторяет ту же защиту, а не голый d100", async () => {
    const a = defender();
    globalThis.fromUuid = async uuid => (uuid === "Actor.def" ? a : null);
    captured.dice = [95];
    await _performDodge(a, { extraMod: 0, hitsCount: 3 });
    const msg = messageFrom(last());
    captured.dice = [10];
    expect(await rerollDefenceCard(msg, "Очко Судьбы")).toBe(true);
    expect(card()).toContain("Уклонение успешно");
    expect(card()).toContain("снимает все 3");
    expect(card()).toContain("Переброс: Очко Судьбы");
  });

  it("не карточка защиты — «Переброс за Очко» идёт старым путём", async () => {
    expect(await rerollDefenceCard(messageFrom({ flags: {} }), "Очко Судьбы")).toBe(false);
  });
});

describe("Парирование: кнопка на карточке и переброс", () => {
  function blade() {
    const w = weaponFor({ weaponClass: "melee", balance: 0, equipped: true });
    w.type = "weapon";
    return w;
  }

  it("провал → кнопка; клик → переброс без второй Реакции", async () => {
    withRules(evasionReroll("Утончённый Бой"));
    const a = defender([blade()]);
    globalThis.fromUuid = async uuid => (uuid === "Actor.def" ? a : null);
    captured.dice = [99];
    await _performParry(a, { extraMod: 0, hitsCount: 1, isMelee: true });
    expect(card()).toContain("Парирование провалено");
    expect(card()).toContain("Перебросить Парирование: Утончённый Бой");
    expect(last().flags["warhammer-dbc"].defenceTest.kind).toBe("parry");
    const reactions = a.system.reactions.value;
    const msg = messageFrom(last());
    captured.dice = [5, 99];
    await onDefenceRerollClick(msg, "test.Утончённый Бой");
    expect(card()).toContain("Парирование успешно");
    expect(card()).toContain("Переброс: Утончённый Бой");
    expect(card()).not.toContain("wh-defence-reroll-btn");
    expect(a.system.reactions.value).toBe(reactions);
  });
});
