// test/combat/rogue-talents.test.mjs
//
// Таланты Разбойника (стр. 62; Sahara 3-bfbf, решения владельца 24.10.2026):
//   Sabotage / Саботаж, Close Quarters / Бой Вплотную, Razor's Edge / На Лезвии
//   Бритвы, Coup de Grace / Ку де Гра, Street Fighting / Уличный Боец,
//   Blade Juggler / Жонглёр Клинком. Riding the Momentum не автоматизирован
//   (см. заметку Таланта в паке).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll, rollExtremeDamage } from "../../module/combat/attack.mjs";
import {
  hasRogueTalent, sabotagePenalty, sabotageEffectKind, sabotageAimEntries, sabotageProfileChoices,
  sabotageWeaponOf, isSabotageAim, razorsEdgeBonus, razorsEdgeEvasionHits, closeQuartersMod,
  coupDeGraceActive, criticalEffectFlatBonus, bladeJugglerPenalty, bladeJugglerMarkAgainst,
  markBladeJuggler, BLADE_JUGGLER_MARK_FLAG, BLADE_JUGGLER_USE_FLAG
} from "../../module/rules/rogue-talents.mjs";
import { applySabotage } from "../../module/combat/sabotage.mjs";
import { startBladeJuggler } from "../../module/combat/blade-juggler.mjs";

const talent = name => ({ id: `t-${name}`, name, type: "talent", system: {} });
const SABOTAGE = talent("Sabotage / Саботаж");
const CLOSE_Q = talent("Close Quarters / Бой Вплотную");
const RAZOR = talent("Razor's Edge / На Лезвии Бритвы");
const COUP = talent("Coup de Grace / Ку де Гра");
const STREET = talent("Street Fighting / Уличный Боец");
const JUGGLER = talent("Blade Juggler / Жонглёр Клинком");

function knife(over = {}, meta = {}) {
  return weaponFor({ weaponClass: "melee", meleeCategory: "Нож", damage: "1d5", damageType: "rending",
    penetration: 0, equipped: true, grips: "1р", ...over }, { id: "knife", name: "Нож", ...meta });
}

/** Актор с рабочими флагами и uuid. */
function body({ items = [], uuid = "Actor.x", name = "Боец", ...system } = {}) {
  const a = actorFor({ items, ...system });
  const store = {};
  a.uuid = uuid; a.name = name; a.id = uuid;
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  a.update = async () => {};
  a.isOwner = true;
  return a;
}

const dmgOf = html => Number(html.match(/class="wh-apply-dmg-btn[^>]*data-damage="(\d+)"/)?.[1]
  ?? html.match(/data-damage="(\d+)"/)?.[1]);
const card = () => captured.chat.map(m => m.content).join("\n");

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});

describe("hasRogueTalent: по имени Таланта или по записи Конструктора", () => {
  it("по имени", () => {
    expect(hasRogueTalent(body({ items: [SABOTAGE] }), "sabotage")).toBe(true);
    expect(hasRogueTalent(body({ items: [] }), "sabotage")).toBe(false);
  });
  it("по ключу Возможности", () => {
    const item = { id: "x", name: "Что-то", type: "talent", system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", entries: [{ id: "e", kind: "capability", capabilityKey: "rogue.core.razorSEdge" }] }] } } };
    expect(hasRogueTalent(body({ items: [item] }), "razorsEdge")).toBe(true);
  });
});

describe("Саботаж: штраф по классу оружия цели", () => {
  const owner = body();
  const w = (system, over = {}) => weaponFor(system, over);
  it("тяжёлое −10, винтовка −20, пистолет −30", () => {
    expect(sabotagePenalty(owner, w({ weaponClass: "heavy" }))).toBe(-10);
    expect(sabotagePenalty(owner, w({ weaponClass: "launcher" }))).toBe(-10);
    expect(sabotagePenalty(owner, w({ weaponClass: "basic" }))).toBe(-20);
    expect(sabotagePenalty(owner, w({ weaponClass: "pistol" }))).toBe(-30);
  });
  it("компактный пистолет (установленный мод Compact) −40", () => {
    const pistol = w({ weaponClass: "pistol" }, { id: "p1" });
    const withMod = body({ items: [pistol, { id: "m", name: "Compact / Компактное", type: "weaponMod", system: { installedOn: "p1" } }] });
    expect(sabotagePenalty(withMod, pistol)).toBe(-40);
  });
  it("рукопашное −30; с хватом П+Л −20; нож −40", () => {
    expect(sabotagePenalty(owner, w({ weaponClass: "melee", meleeCategory: "Меч", grips: "1р" }))).toBe(-30);
    expect(sabotagePenalty(owner, w({ weaponClass: "melee", meleeCategory: "Когти", grips: "П+Л" }))).toBe(-20);
    expect(sabotagePenalty(owner, w({ weaponClass: "melee", meleeCategory: "Нож" }))).toBe(-40);
  });
});

describe("Саботаж: что происходит с оружием", () => {
  it("стрелковое — Клин; электрическое рукопашное — отключение; обычное рукопашное — ничего", () => {
    expect(sabotageEffectKind(weaponFor({ weaponClass: "basic" }))).toBe("jam");
    expect(sabotageEffectKind(weaponFor({ weaponClass: "melee", techClass: "electric" }))).toBe("disable");
    expect(sabotageEffectKind(weaponFor({ weaponClass: "melee", techClass: "none" }))).toBe("none");
  });
  it("комбинированное: выбор профиля; обычное — без выбора", () => {
    expect(sabotageProfileChoices(weaponFor({ weaponClass: "basic" }))).toEqual([]);
    const combo = weaponFor({ weaponClass: "basic", profiles: [{ label: "Подствольник", ownFire: true }, { label: "Приклад", melee: true }] });
    const keys = sabotageProfileChoices(combo).map(c => c.key);
    expect(keys).toEqual(["melee", "base", "fire:0"]);
  });
});

describe("Саботаж: цели прицела", () => {
  const blade = knife();
  const gun = weaponFor({ weaponClass: "basic", equipped: true }, { id: "gun", name: "Лазган" });
  const spare = weaponFor({ weaponClass: "pistol", equipped: false }, { id: "spare", name: "Запасной" });
  const fist = weaponFor({ weaponClass: "melee", equipped: true, meleeCategory: "Кулаки" }, { id: "fist", name: "Кулак", flags: { "warhammer-dbc.integralAttack": true } });
  const defender = body({ items: [gun, spare, fist], uuid: "Actor.d" });

  it("по строке на экипированное настоящее оружие цели, со штрафом в подписи", () => {
    const me = body({ items: [SABOTAGE, blade] });
    const e = sabotageAimEntries(me, blade, defender);
    expect(e.map(x => x.value)).toEqual(["weapon:gun"]);
    expect(e[0].penalty).toBe(-20);
    expect(e[0].label).toContain("Лазган");
    expect(e[0].label).toContain("-20");
  });
  it("нет Таланта / не нож / не рукопашная — строк нет", () => {
    expect(sabotageAimEntries(body({ items: [blade] }), blade, defender)).toEqual([]);
    const sword = knife({ meleeCategory: "Меч" });
    expect(sabotageAimEntries(body({ items: [SABOTAGE, sword] }), sword, defender)).toEqual([]);
    expect(sabotageAimEntries(body({ items: [SABOTAGE, blade] }), blade, defender, { isMelee: false })).toEqual([]);
  });
  it("sabotageWeaponOf читает цель прицела", () => {
    const aim = { value: "weapon:gun" };
    expect(isSabotageAim(aim)).toBe(true);
    expect(sabotageWeaponOf(aim, defender)?.id).toBe("gun");
    expect(sabotageWeaponOf({ value: "joint" }, defender)).toBeNull();
  });
});

describe("applySabotage", () => {
  const post = () => card();
  it("стрелковое: Клин пишется на оружие цели", async () => {
    const gun = weaponFor({ weaponClass: "basic", equipped: true }, { id: "gun", name: "Лазган" });
    const owner = body({ items: [gun], uuid: "Actor.d", name: "Охранник" });
    gun.parent = owner; gun.isOwner = true; gun.uuid = "Item.gun";
    const done = await applySabotage(body({ items: [SABOTAGE] }), gun);
    expect(done).toBe(true);
    expect(gun.system.jammed).toBe(true);
    expect(post()).toContain("заклинило");
  });
  it("электрическое рукопашное отключается, обычное — эффекта нет", async () => {
    const power = weaponFor({ weaponClass: "melee", techClass: "electric", equipped: true }, { id: "pw", name: "Силовой меч" });
    power.isOwner = true; power.uuid = "Item.pw";
    await applySabotage(body(), power);
    expect(power.system.jammed).toBe(true);
    expect(post()).toContain("отключено");
    resetCaptured();
    const plain = weaponFor({ weaponClass: "melee", techClass: "none", equipped: true }, { id: "pl", name: "Палка" });
    plain.isOwner = true;
    await applySabotage(body(), plain);
    expect(plain.system.jammed).toBe(false);
    expect(post()).toContain("Эффекта нет");
  });
  it("комбинированное: выбор рукопашных профилей у обычного клинка — эффекта нет, стрелкового ствола — Клин", async () => {
    const combo = weaponFor({ weaponClass: "basic", equipped: true, techClass: "none",
      profiles: [{ label: "Приклад", melee: true }] }, { id: "cb", name: "Карабин" });
    combo.isOwner = true;
    await applySabotage(body(), combo, { ask: async (_w, choices) => choices.find(c => c.key === "melee") });
    expect(combo.system.jammed).toBe(false);
    await applySabotage(body(), combo, { ask: async (_w, choices) => choices.find(c => c.key === "base") });
    expect(combo.system.jammed).toBe(true);
  });
  it("чужое оружие без Мастера в игре — Клин не записан, карточку не гасим (ревью)", async () => {
    const gun = weaponFor({ weaponClass: "basic", equipped: true }, { id: "g2", name: "Лазган" });
    gun.isOwner = false;
    const prev = globalThis.game.users;
    globalThis.game.users = Object.assign([], { activeGM: null });
    try {
      expect(await applySabotage(body(), gun)).toBe(false);
      expect(gun.system.jammed).toBe(false);
    } finally { globalThis.game.users = prev; }
  });
  it("окно выбора закрыто — ничего", async () => {
    const combo = weaponFor({ weaponClass: "basic", equipped: true, profiles: [{ label: "Приклад", melee: true }] });
    combo.isOwner = true;
    expect(await applySabotage(body(), combo, { ask: async () => null })).toBe(false);
    expect(combo.system.jammed).toBe(false);
  });
});

describe("атака ножом по оружию цели (Саботаж, _executeAttackRoll)", () => {
  it("урона существу нет, на карточке — кнопка «Саботаж», Избегание остаётся", async () => {
    const blade = knife();
    const me = body({ items: [SABOTAGE, blade], uuid: "Actor.me" });
    const gun = weaponFor({ weaponClass: "basic", equipped: true }, { id: "gun", name: "Лазган" });
    const foe = body({ items: [gun], uuid: "Actor.foe" });
    gun.uuid = "Item.gun";
    setTargets([foe]);
    captured.dice = [10, 3, 3];
    await _executeAttackRoll(me, blade, "ws", 60, "melee",
      { value: "weapon:gun", label: "Оружие цели: Лазган (-20)", penalty: -20 }, {});
    const html = card();
    expect(html).toContain("wh-sabotage-btn");
    expect(html).toContain('data-weapon-uuid="Item.gun"');
    expect(html).not.toContain("wh-apply-dmg-btn");
    expect(html).toContain("wh-dodge-btn");
  });
  it("без Таланта та же цель прицела не работает как Саботаж (обычная атака с уроном)", async () => {
    const blade = knife();
    const me = body({ items: [blade], uuid: "Actor.me" });
    const gun = weaponFor({ weaponClass: "basic", equipped: true }, { id: "gun", name: "Лазган" });
    const foe = body({ items: [gun], uuid: "Actor.foe" });
    setTargets([foe]);
    captured.dice = [10, 3, 3];
    await _executeAttackRoll(me, blade, "ws", 60, "melee", { value: "weapon:gun", label: "Оружие цели: Лазган (-20)", penalty: -20 }, {});
    expect(card()).not.toContain("wh-sabotage-btn");
  });
});

describe("На Лезвии Бритвы", () => {
  const withInit = (items, init, uuid) => body({ items, uuid, initiative: init });
  it("+разница Инициатив к урону, максимум +10", () => {
    const blade = knife();
    const me = withInit([RAZOR, blade], 40, "Actor.me");
    expect(razorsEdgeBonus(me, blade, withInit([], 33, "Actor.f"))).toBe(7);
    expect(razorsEdgeBonus(me, blade, withInit([], 10, "Actor.f"))).toBe(10);
    expect(razorsEdgeBonus(me, blade, withInit([], 40, "Actor.f"))).toBe(0);
    expect(razorsEdgeBonus(me, blade, withInit([], 50, "Actor.f"))).toBe(0);
  });
  it("не нож — нет; без Таланта — нет", () => {
    const sword = knife({ meleeCategory: "Меч" });
    expect(razorsEdgeBonus(withInit([RAZOR], 40), sword, withInit([], 10))).toBe(0);
    expect(razorsEdgeBonus(withInit([], 40), knife(), withInit([], 10))).toBe(0);
  });
  it("в бою сравниваются брошенные Инициативы (Combatant), а не хранимые", () => {
    const blade = knife();
    const me = withInit([RAZOR, blade], 0, "Actor.me"); me.id = "A";
    const foe = withInit([], 100, "Actor.f"); foe.id = "B";
    globalThis.game.combat = { combatants: [{ actorId: "A", initiative: 30 }, { actorId: "B", initiative: 24 }] };
    expect(razorsEdgeBonus(me, blade, foe)).toBe(6);
  });
  it("несвязанные копии одного NPC: берётся Инициатива именно этого токена, не первой копии (ревью)", () => {
    const blade = knife();
    const me = withInit([RAZOR, blade], 0, "Actor.me"); me.id = "A";
    const base = withInit([], 0, "Actor.base"); base.id = "BASE";
    const copy1 = Object.assign(withInit([], 0, "Actor.c1"), { id: "BASE", isToken: true, token: { id: "T1" } });
    const copy3 = Object.assign(withInit([], 0, "Actor.c3"), { id: "BASE", isToken: true, token: { id: "T3" } });
    void base;
    globalThis.game.combat = { combatants: [
      { actorId: "A", initiative: 30 },
      { actorId: "BASE", tokenId: "T1", actor: copy1, initiative: 29 },
      { actorId: "BASE", tokenId: "T3", actor: copy3, initiative: 10 }
    ] };
    expect(razorsEdgeBonus(me, blade, copy1)).toBe(1);
    expect(razorsEdgeBonus(me, blade, copy3)).toBe(10);
  });
  it("Избегание: более медленная цель перебивает все Успехи одиночного удара", () => {
    const blade = knife();
    const me = withInit([RAZOR, blade], 40);
    const slow = withInit([], 20);
    expect(razorsEdgeEvasionHits(me, blade, slow, { hitsCount: 1, deg: 3 })).toBe(3);
    expect(razorsEdgeEvasionHits(me, blade, slow, { hitsCount: 1, deg: 1 })).toBeNull();
    expect(razorsEdgeEvasionHits(me, blade, slow, { hitsCount: 3, deg: 3 })).toBeNull();
    expect(razorsEdgeEvasionHits(me, blade, withInit([], 60), { hitsCount: 1, deg: 3 })).toBeNull();
  });
  it("удар: Dmg растёт на разницу, кнопки Избегания несут число Успехов", async () => {
    const run = async (talents, myInit) => {
      resetCaptured();
      const blade = knife();
      const me = withInit([...talents, blade], myInit, "Actor.me");
      const foe = withInit([], 30, "Actor.foe");
      setTargets([foe]);
      captured.dice = [5, 3, 3, 3];
      await _executeAttackRoll(me, blade, "ws", 90, "melee", null, {});
      return card();
    };
    const plain = await run([], 40);
    const razor = await run([RAZOR], 40);
    expect(dmgOf(razor)).toBe(dmgOf(plain) + 10);
    expect(razor).toContain("На Лезвии Бритвы");
    expect(razor).toMatch(/data-hits-count="[2-9]"/);
    expect(plain).not.toContain("На Лезвии Бритвы");
  });
});

describe("Бой Вплотную", () => {
  const armed = items => body({ items: [CLOSE_Q, ...items] });
  it("цель с ножом/пистолетом: −10 при Rng больше 2 и снятие +5 длины", () => {
    const def = armed([knife(), weaponFor({ weaponClass: "pistol", equipped: true }, { id: "pi" })]);
    expect(closeQuartersMod(def, 3, true)).toMatchObject({ value: -15, penalty: -10, lengthCancel: -5 });
    expect(closeQuartersMod(def, 3, false).value).toBe(-10);
    expect(closeQuartersMod(def, 2, true).value).toBe(-5);
    expect(closeQuartersMod(def, 2, false).value).toBe(0);
  });
  it("вооружён мечом — не действует; без Таланта — не действует; безоружный (кулаки) — действует", () => {
    expect(closeQuartersMod(armed([knife({ meleeCategory: "Меч" })]), 5, true).value).toBe(0);
    expect(closeQuartersMod(body({ items: [knife()] }), 5, true).value).toBe(0);
    expect(closeQuartersMod(armed([]), 5, false).value).toBe(-10);
  });
});

describe("Ку де Гра", () => {
  const stunned = { system: { conditions: { stunned: true } } };
  const prone = { system: { conditions: { prone: true } } };
  const standing = { system: { conditions: {} } };
  const me = body({ items: [COUP] });
  it("нож в любом хвате: сочленение/глаз Оглушённой или Лежащей цели", () => {
    const k = knife();
    expect(coupDeGraceActive({ actor: me, weapon: k, aimValue: "joint", targetActor: stunned })).toBe(true);
    expect(coupDeGraceActive({ actor: me, weapon: k, aimValue: "eye", targetActor: prone })).toBe(true);
    expect(coupDeGraceActive({ actor: me, weapon: k, aimValue: "head", targetActor: stunned })).toBe(false);
    expect(coupDeGraceActive({ actor: me, weapon: k, aimValue: "joint", targetActor: standing })).toBe(false);
  });
  it("меч/копьё — только Ближний хват (Бл)", () => {
    const sword = knife({ meleeCategory: "Меч" });
    expect(coupDeGraceActive({ actor: me, weapon: sword, gripKey: "1р", aimValue: "joint", targetActor: stunned })).toBe(false);
    expect(coupDeGraceActive({ actor: me, weapon: sword, gripKey: "Бл", aimValue: "joint", targetActor: stunned })).toBe(true);
    const mace = knife({ meleeCategory: "Булава" });
    expect(coupDeGraceActive({ actor: me, weapon: mace, gripKey: "Бл", aimValue: "joint", targetActor: stunned })).toBe(false);
  });
  it("без Таланта — нет", () => {
    expect(coupDeGraceActive({ actor: body(), weapon: knife(), aimValue: "joint", targetActor: stunned })).toBe(false);
  });
  it("удар: урон ×2, как по Беспомощной", async () => {
    const run = async (talents, aim) => {
      resetCaptured();
      const blade = knife();
      const me2 = body({ items: [...talents, blade], uuid: "Actor.me" });
      const foe = body({ uuid: "Actor.foe" });
      foe.system.conditions = { stunned: true };
      setTargets([foe]);
      captured.dice = [5, 3, 3, 3];
      await _executeAttackRoll(me2, blade, "ws", 90, "melee", aim, {});
      return card();
    };
    const joint = { value: "joint", label: "Сочленение/Шея", penalty: -40 };
    const plain = await run([], joint);
    const coup = await run([COUP], joint);
    expect(dmgOf(coup)).toBe(dmgOf(plain) * 2);
    expect(coup).toContain("Ку де Гра");
    const torso = await run([COUP], { value: "torso", label: "Торс", penalty: -10 });
    expect(torso).not.toContain("Ку де Гра");
  });
});

describe("Уличный Боец: плоская прибавка к уровню Критического Эффекта", () => {
  const fist = weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки" });
  it("½WS.b вверх, максимум +5; нож и кулаки", () => {
    const mk = wsb => body({ items: [STREET], system: undefined, uuid: `Actor.${wsb}`, characteristics: { ws: { total: wsb * 10, bonus: wsb } } });
    expect(criticalEffectFlatBonus(mk(5), knife())).toBe(3);
    expect(criticalEffectFlatBonus(mk(4), fist)).toBe(2);
    expect(criticalEffectFlatBonus(mk(12), knife())).toBe(5);
  });
  it("прочее оружие и актор без Таланта — 0", () => {
    const withTalent = body({ items: [STREET], characteristics: { ws: { total: 50, bonus: 5 } } });
    expect(criticalEffectFlatBonus(withTalent, knife({ meleeCategory: "Меч" }))).toBe(0);
    expect(criticalEffectFlatBonus(body({ characteristics: { ws: { total: 50, bonus: 5 } } }), knife())).toBe(0);
  });
  it("Экстремальный урон: уровень растёт на прибавку", async () => {
    const roll = { total: 10, terms: [{ faces: 10, results: [{ active: true, result: 10 }] }] };
    const wp = { extremeThreshold: 10 };
    const hero = body({ items: [STREET], characteristics: { ws: { total: 50, bonus: 5 } } });
    const blade = knife();
    captured.dice = [2];
    const a = await rollExtremeDamage(roll, { wp: { ...wp }, damageType: "rending", hitLocation: "Торс", attacker: hero, weapon: blade });
    captured.dice = [2];
    const b = await rollExtremeDamage(roll, { wp: { ...wp }, damageType: "rending", hitLocation: "Торс", attacker: body(), weapon: blade });
    expect(a.extremeLevel).toBe(b.extremeLevel + 3);
  });
});

describe("Жонглёр Клинком", () => {
  it("победа меньшим провалом (deg 0) штрафа не даёт (как у Талантов Пугилиста)", async () => {
    const { resolveBladeJugglerSuccess } = await import("../../module/combat/blade-juggler.mjs");
    const me = body(), foe = body({ uuid: "Actor.foe" });
    await resolveBladeJugglerSuccess(me, { target: foe, margin: 2, deg: 0 });
    expect(bladeJugglerMarkAgainst(me, "Actor.foe")).toBe(0);
    await resolveBladeJugglerSuccess(me, { target: foe, margin: 2, deg: 3 });
    expect(bladeJugglerMarkAgainst(me, "Actor.foe")).toBe(10);
  });
  it("штраф = Успехи × 5", () => {
    expect(bladeJugglerPenalty(3)).toBe(15);
    expect(bladeJugglerPenalty(0)).toBe(0);
    expect(bladeJugglerPenalty(-2)).toBe(0);
  });
  it("метка действует только на свою цель", async () => {
    const me = body();
    await markBladeJuggler(me, "Actor.foe", 15);
    expect(bladeJugglerMarkAgainst(me, "Actor.foe")).toBe(15);
    expect(bladeJugglerMarkAgainst(me, "Actor.other")).toBe(0);
  });
  it("атака ножом по помеченной цели: Уклонение и Парирование −N, метка снята", async () => {
    const run = async withMark => {
      resetCaptured();
      const blade = knife();
      const me = body({ items: [JUGGLER, blade], uuid: "Actor.me" });
      const foe = body({ uuid: "Actor.foe" });
      if (withMark) await markBladeJuggler(me, foe.uuid, 15);
      setTargets([foe]);
      captured.dice = [5, 3, 3, 3];
      await _executeAttackRoll(me, blade, "ws", 90, "melee", null, {});
      return { html: card(), me };
    };
    const base = await run(false);
    const marked = await run(true);
    const mod = (h, cls) => Number(h.match(new RegExp(`class="${cls}"[^>]*data-extra-mod="(-?\\d+)"`))?.[1]);
    expect(mod(marked.html, "wh-dodge-btn")).toBe(mod(base.html, "wh-dodge-btn") - 15);
    expect(mod(marked.html, "wh-parry-btn")).toBe(mod(base.html, "wh-parry-btn") - 15);
    expect(marked.me.getFlag("warhammer-dbc", BLADE_JUGGLER_MARK_FLAG)).toBeUndefined();
    expect(marked.html).toContain("Жонглёр Клинком");
  });
  it("переигровка той же атаки (skipAmmo: +10 за Очко, переброс) сохраняет штраф, хотя метка уже снята", async () => {
    const blade = knife();
    const me = body({ items: [JUGGLER, blade], uuid: "Actor.me" });
    const foe = body({ uuid: "Actor.foe" });
    await markBladeJuggler(me, foe.uuid, 15);
    setTargets([foe]);
    captured.dice = [5, 3, 3, 3];
    await _executeAttackRoll(me, blade, "ws", 90, "melee", null, {});
    const stored = captured.chat.at(-1).flags["warhammer-dbc"].attack.opts;
    resetCaptured();
    captured.dice = [5, 3, 3, 3];
    await _executeAttackRoll(me, blade, "ws", 90, "melee", null, { ...stored, forcedRoll: 5, skipAmmo: true });
    expect(card()).toContain("Жонглёр Клинком: Избегания цели от этой атаки −15");
  });
  it("кнопка Таланта: нужен нож, пустая рука и «раз в Ход»", async () => {
    const noKnife = body({ items: [JUGGLER] });
    expect(await startBladeJuggler(noKnife)).toBe(false);
    expect(captured.warnings.some(w => w.includes("нож"))).toBe(true);

    resetCaptured();
    const blade = knife();
    const me = body({ items: [JUGGLER, blade] });
    me.getFlag = (s, k) => (k === BLADE_JUGGLER_USE_FLAG ? true : undefined);
    // «Раз в Ход» существует только в бою (Sahara riding-the-momentum, п. 3).
    globalThis.game.combat = { started: true };
    try {
      expect(await startBladeJuggler(me)).toBe(false);
      expect(captured.warnings.some(w => w.includes("уже использован"))).toBe(true);
    } finally { globalThis.game.combat = undefined; }
  });
  it("вне боя «раз в Ход» не блокирует Талант: залипший флаг игнорируется, новый не ставится", async () => {
    resetCaptured();
    const me = body({ items: [JUGGLER, knife()], uuid: "Actor.me" });
    me.system.characteristics.fel = char(30);
    me.getFlag = (s, k) => (k === BLADE_JUGGLER_USE_FLAG ? true : undefined);
    setTargets([body({ uuid: "Actor.foe" })]);
    globalThis.game.combat = undefined;
    expect(await startBladeJuggler(me)).toBe(true);
    expect(captured.dialog.content).toContain("Deceive(WS)");
    let set = 0;
    me.setFlag = async () => { set++; };
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "ws", "#contest-self": "20", "#contest-mod": "0" }));
    expect(set).toBe(0);
  });
  it("кнопка Таланта: открывает встречный тест Deceive(WS); флаг «раз в Ход» ставится по «Бросок!»", async () => {
    resetCaptured();
    const blade = knife();
    const me = body({ items: [JUGGLER, blade], uuid: "Actor.me" });
    me.system.characteristics.fel = char(30);
    const foe = body({ uuid: "Actor.foe" });
    setTargets([foe]);
    globalThis.game.combat = { started: true };
    try {
      expect(await startBladeJuggler(me)).toBe(true);
      expect(captured.dialog.content).toContain("Deceive(WS)");
      expect(me.getFlag("warhammer-dbc", BLADE_JUGGLER_USE_FLAG)).toBeUndefined();
      await captured.dialog.buttons.roll.callback(fakeHtml({ "#contest-char": "ws", "#contest-self": "20", "#contest-mod": "0" }));
      expect(me.getFlag("warhammer-dbc", BLADE_JUGGLER_USE_FLAG)).toBe(true);
    } finally { globalThis.game.combat = undefined; }
  });
});
