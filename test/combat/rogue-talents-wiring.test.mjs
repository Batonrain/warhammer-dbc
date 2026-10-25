// test/combat/rogue-talents-wiring.test.mjs
//
// Стыковка Талантов Разбойника (Sahara 3-bfbf) с местами, где их читают:
//   • Бой Вплотную — строка-галочка окна атаки (sheets/attack/mods.mjs);
//   • Уличный Боец — уровень Критического Эффекта от Отрицательных Ран (combat/damage.mjs);
//   • Саботаж — цели прицела в окне атаки, кнопка в hooks.mjs, сокет, Клин у рукопашного на листе;
//   • Жонглёр Клинком — кнопка на листе Таланта и сброс в начале Хода.

import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";

const levels = [];
vi.mock("../../critical-tables.mjs", () => ({
  getCriticalEffect: (_type, _loc, level) => { levels.push(level); return "Тестовый Критический Эффект."; }
}));

const { situationalMods } = await import("../../module/sheets/attack/mods.mjs");
const { applyDamageToActor } = await import("../../module/combat/damage.mjs");
const { CARD_ONCE_FLAGS } = await import("../../module/combat/card-once.mjs");
const { talentActionsHtml, runTalentAction } = await import("../../module/apps/talent-actions.mjs");

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const talent = name => ({ id: `t-${name}`, name, type: "talent", system: {} });

beforeEach(() => { resetCaptured(); levels.length = 0; });

describe("Бой Вплотную: строка окна атаки", () => {
  function args(over = {}) {
    return {
      actor: { items: [], system: { size: 0 } }, attackCtx: {}, attackerToken: null, gripRange: null,
      hasFatigue: false, hasLostEyes: false, isBlinded: false, isMelee: true, measured: null,
      targetHelpless: false, targetToken: null, weapon: null, wProps: [], wp: {}, ...over
    };
  }
  const defender = (items = []) => ({ id: "d", name: "Разбойник", uuid: "Actor.d", items, system: { size: 0 } });
  const knifeItem = () => weaponFor({ weaponClass: "melee", meleeCategory: "Нож", equipped: true, range: 1 }, { id: "k" });
  const sword = () => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", equipped: true, range: 3, grips: "1р" }, { id: "s", name: "Меч" });
  const row = res => res.commonMods.find(m => m.label.startsWith("Бой Вплотную"));

  it("цель-носитель с ножом, нападающий с мечом Rng 3: −10 и снятие +5 длины, галочка снята по умолчанию", () => {
    const res = situationalMods(args({
      attackCtx: { targetActor: defender([talent("Close Quarters / Бой Вплотную"), knifeItem()]) },
      weapon: sword()
    }));
    const r = row(res);
    expect(r).toBeTruthy();
    expect(r.autoCheck).toBe(false);
    expect(r.value).toBeLessThanOrEqual(-10);
  });
  it("стрелок с дальнобойным оружием тоже штрафуется на −10 (Rng больше 2)", () => {
    const res = situationalMods(args({
      isMelee: false,
      attackCtx: { targetActor: defender([talent("Close Quarters / Бой Вплотную")]) },
      weapon: weaponFor({ weaponClass: "basic", range: 30 })
    }));
    expect(row(res)?.value).toBe(-10);
  });
  it("у цели нет Таланта или она вооружена мечом — строки нет", () => {
    expect(row(situationalMods(args({ attackCtx: { targetActor: defender([knifeItem()]) }, weapon: sword() })))).toBeUndefined();
    expect(row(situationalMods(args({
      attackCtx: { targetActor: defender([talent("Close Quarters / Бой Вплотную"), sword()]) }, weapon: sword() })))).toBeUndefined();
  });
});

describe("Уличный Боец: Критический урон от Отрицательных Ран", () => {
  function victim() {
    const flags = {};
    return {
      id: "v", name: "Жертва", type: "character", uuid: "Actor.v",
      system: { absorption: { body: 0, toughnessBonus: 0, propFlags: {} }, wounds: { value: 0, critical: 3, max: 20 } },
      items: Object.assign([], { contents: [] }),
      async update(d) { if (d["system.wounds.critical"] !== undefined) this.system.wounds.critical = d["system.wounds.critical"]; },
      getFlag: (s, k) => flags[`${s}.${k}`], async setFlag(s, k, v) { flags[`${s}.${k}`] = v; },
      async unsetFlag(s, k) { delete flags[`${s}.${k}`]; }
    };
  }
  async function strike({ talented, weapon }) {
    const attacker = actorFor({ items: talented ? [talent("Street Fighting / Уличный Боец")] : [],
      characteristics: { ws: { total: 50, bonus: 5 } } });
    attacker.uuid = "Actor.atk";
    weapon.uuid = "Item.w";
    globalThis.fromUuid = async uuid => (uuid === attacker.uuid ? attacker : uuid === weapon.uuid ? weapon : null);
    await applyDamageToActor(victim(), {
      rawDamage: 10, penetration: 0, damageType: "rending", hitLocation: "Торс", attackerName: "Н", weaponName: "Нож",
      attackerUuid: attacker.uuid, weaponUuid: weapon.uuid
    });
    return levels.at(-1);
  }
  const blade = () => weaponFor({ weaponClass: "melee", meleeCategory: "Нож", equipped: true });

  it("нож: уровень строки таблицы растёт на ½WS.b вверх; без Таланта — нет", async () => {
    const base = await strike({ talented: false, weapon: blade() });
    const boosted = await strike({ talented: true, weapon: blade() });
    expect(boosted).toBe(base + 3);
  });
  it("меч: прибавки нет", async () => {
    const base = await strike({ talented: false, weapon: weaponFor({ weaponClass: "melee", meleeCategory: "Меч" }) });
    const sword = await strike({ talented: true, weapon: weaponFor({ weaponClass: "melee", meleeCategory: "Меч" }) });
    expect(sword).toBe(base);
  });
});

describe("Саботаж: стыковка", () => {
  const HOOKS = read("module/hooks.mjs");
  it("окно атаки добавляет цели прицела «Оружие цели»", () => {
    expect(read("module/sheets/attack-dialog.mjs")).toMatch(/sabotageAimEntries\(actor, item, attackCtx\.targetActor/);
  });
  it("кнопка «Саботаж»: гаснет по отметке карточки, ключ в белом списке сокета", () => {
    const at = HOOKS.indexOf('html.querySelectorAll(".wh-sabotage-btn")');
    expect(at).toBeGreaterThan(0);
    const block = HOOKS.slice(at, at + 1500);
    expect(block).toContain('cardOnceUsed(message, "sabotageApplied")');
    expect(block).toContain('runCardOnce(message, "sabotageApplied"');
    expect(CARD_ONCE_FLAGS).toContain("sabotageApplied");
  });
  it("сокет itemUpdate пропускает только system.jammed=true на оружии", () => {
    const main = read("warhammer-dbc.mjs");
    expect(main).toMatch(/k === "system\.jammed" && data\.data\[k\] === true && item\.type === "weapon"/);
  });
  it("лист показывает Клин и у рукопашного оружия", () => {
    expect(read("module/sheets/sheet-helpers.mjs")).toMatch(/jammed:\s+!!s\.jammed,/);
  });
  it("строка РУКОПАШНОГО оружия во вкладке Боя гасит «Атака» по jammed и несёт кнопку Расклина (ревью: без этого «отключено» не работало)", () => {
    const hbs = read("templates/actor/parts/tab-combat.hbs");
    expect(hbs).toMatch(/combat-atk-btn"[^>]*\{\{#if \(or w\.destroyed w\.jammed\)\}\}disabled/);
    expect(hbs).toContain("Отключено — Расклинить");
  });
  it("Критический урон: Боль — Лишь Иллюзия получает уровень уже с прибавкой Уличного Бойца", () => {
    expect(read("module/combat/damage.mjs")).toMatch(/critTalentsHtml\(actor, \{ level: newCritical \+ critFlat/);
  });
});

describe("Жонглёр Клинком: стыковка", () => {
  const item = { id: "bj", name: "Blade Juggler / Жонглёр Клинком", type: "talent", system: {},
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", entries: [{ id: "e", kind: "capability", capabilityKey: "rogue.core.bladeJuggler" }] }] } },
    getFlag(s, k) { return this.flags?.[s]?.[k]; } };
  it("на листе Таланта с ключом Возможности — кнопка действия; у прочих Талантов — нет", () => {
    expect(talentActionsHtml(item, actorFor({}))).toContain('data-talent-action="bladeJuggler"');
    expect(talentActionsHtml({ id: "x", name: "Другое", type: "talent", system: {}, getFlag: () => undefined }, actorFor({}))).toBe("");
  });
  it("действие без экипированного ножа — предупреждение, окно не открывается", async () => {
    const actor = actorFor({});
    actor.name = "Тест";
    expect(await runTalentAction("bladeJuggler", item, actor)).toBe(false);
    expect(captured.dialog).toBeFalsy();
  });
  it("начало Хода снимает метку и «раз в Ход»", () => {
    const HOOKS = read("module/hooks.mjs");
    expect(HOOKS).toMatch(/await clearBladeJuggler\(nextCombatant\.actor\)/);
  });
});
