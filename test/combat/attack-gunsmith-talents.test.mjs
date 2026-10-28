// test/combat/attack-gunsmith-talents.test.mjs
//
// Таланты «Оружейника» и «Стрелка» главы 3 (Sahara 3-9d40 / 3-5fbf), та часть,
// что живёт в combat/attack.mjs и карточке: Шокер, Трепка, Искры, Сварщик,
// Пробивной Удар. Чистая логика — rules/gunsmith-talents.mjs и
// rules/gunner-talents.mjs (там же отдельные тесты ниже).
//
// Каждый Талант проверяется двумя путями опознания: по ключу Возможности (у
// предмета испорчено имя) и по имени (Талант без записи Конструктора — как у
// персонажа, купившего его до появления записи в паке).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { sparksSwap, welderCritLevel, wallopConcussiveRating, isArcWeapon, isGalvanicWeapon,
  WALLOP_RATINGS } from "../../module/rules/gunsmith-talents.mjs";
import { suppressionActionType, needlestormHalfAction, isFlechetteOrNeedleWeapon } from "../../module/rules/gunsmith-talents.mjs";
import { negativeWoundsBonus, crackShotBonus } from "../../module/rules/gunner-talents.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }
});
const talentByName = name => ({ id: "t-" + name, name, type: "talent", system: {} });

const SHOCKER = { key: "weaponsmith.core.shocker", name: "Shocker / Шокер" };
const WALLOP  = { key: "weaponsmith.core.wallop",  name: "Wallop / Трепка" };
const SPARKS  = { key: "weaponsmith.core.sparks",  name: "Sparks / Искры" };
const WELDER  = { key: "weaponsmith.core.welder",  name: "Welder / Сварщик" };
const CRACK   = { key: "rangedCore.core.crackShot", name: "Crack Shot / Пробивной Удар" };

const shooter = items => actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) } });
const HEAD = { value: "head", label: "Голова" };

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

async function shoot(items, weapon, aim, opts = {}) {
  const actor = shooter([weapon, ...items]);
  captured.dice = [23, 6, 4, 4, 4, 4]; // бросок 23 при пороге 45 — попадание; дальше кубики урона
  await _executeAttackRoll(actor, weapon, "bs", 45, "single", aim, opts);
}

// ── Шокер ───────────────────────────────────────────────────────────────────

describe("Шокер: Избирательное попадание Гальваническим в голову → Shocking", () => {
  const galvanic = name => weaponFor({ damage: "1d10", penetration: 0, weaponProps: [] }, { name });

  it("без Таланта свойства Шокирующее нет", async () => {
    await shoot([], galvanic("Galvanic Rifle / Гальваническая Винтовка"), HEAD);
    expect(card()).not.toContain("Шокирующее");
  });

  it("по ключу: голова Гальваническим → Шокирующее", async () => {
    await shoot([talentByKey(SHOCKER.key)], galvanic("Galvanic Rifle / Гальваническая Винтовка"), HEAD);
    expect(card()).toContain("Шокирующее");
  });

  it("по имени (без записи Конструктора): то же", async () => {
    await shoot([talentByName(SHOCKER.name)], galvanic("Galvanic Caster / Гальванический Кастер"), HEAD);
    expect(card()).toContain("Шокирующее");
  });

  it("глаз и сочленение/шея — не срабатывает", async () => {
    await shoot([talentByName(SHOCKER.name)], galvanic("Galvanic Rifle / Гальваническая Винтовка"), { value: "eye", label: "Глаз" });
    expect(card()).not.toContain("Шокирующее");
    resetCaptured();
    await shoot([talentByName(SHOCKER.name)], galvanic("Galvanic Rifle / Гальваническая Винтовка"), { value: "joint", label: "Шея" });
    expect(card()).not.toContain("Шокирующее");
  });

  it("не Избирательная атака — не срабатывает", async () => {
    await shoot([talentByName(SHOCKER.name)], galvanic("Galvanic Rifle / Гальваническая Винтовка"), null);
    expect(card()).not.toContain("Шокирующее");
  });

  it("негальваническое оружие — не срабатывает", async () => {
    await shoot([talentByName(SHOCKER.name)], galvanic("Lasgun / Лазган"), HEAD);
    expect(card()).not.toContain("Шокирующее");
  });

  it("распознавание оружия по названию", () => {
    expect(isGalvanicWeapon({ name: "Galvanic Carbine / Гальванический Карабин" })).toBe(true);
    expect(isGalvanicWeapon({ name: "Lasgun / Лазган" })).toBe(false);
  });
});

// ── Трепка ──────────────────────────────────────────────────────────────────

describe("Трепка: Избирательный выстрел со Scatter с короткой дистанции → Concussive", () => {
  const scatterGun = () => weaponFor({ damage: "1d10", penetration: 0, weaponProps: [{ key: "scatter" }] },
    { name: "Shotgun / Дробовик" });

  it("без Таланта Оглушающего нет", async () => {
    await shoot([], scatterGun(), HEAD, { shortRange: true });
    expect(card()).not.toContain("Оглушающее");
  });

  it("по ключу: голова с короткой дистанции → Оглушающее (0)", async () => {
    await shoot([talentByKey(WALLOP.key)], scatterGun(), HEAD, { shortRange: true });
    expect(card()).toContain("Оглушающее");
    expect(card()).toContain("Трепка");
  });

  it("по имени: рука с короткой дистанции → Оглушающее", async () => {
    await shoot([talentByName(WALLOP.name)], scatterGun(), { value: "arm", label: "Рука" }, { shortRange: true });
    expect(card()).toContain("Оглушающее");
  });

  it("не с короткой дистанции — не срабатывает", async () => {
    await shoot([talentByName(WALLOP.name)], scatterGun(), HEAD, { shortRange: false });
    expect(card()).not.toContain("Оглушающее");
  });

  it("оружие без Scatter — не срабатывает", async () => {
    const plain = weaponFor({ damage: "1d10", penetration: 0, weaponProps: [] }, { name: "Shotgun / Дробовик" });
    await shoot([talentByName(WALLOP.name)], plain, HEAD, { shortRange: true });
    expect(card()).not.toContain("Оглушающее");
  });

  it("не Избирательная — не срабатывает", async () => {
    await shoot([talentByName(WALLOP.name)], scatterGun(), null, { shortRange: true });
    expect(card()).not.toContain("Оглушающее");
  });

  it("рейтинг по части тела: голова 0, торс/нога −1, рука −2; сочленение и глаз — нет", () => {
    expect(WALLOP_RATINGS).toEqual({ head: 0, torso: -1, leg: -1, arm: -2 });
    const actor = shooter([talentByName(WALLOP.name)]);
    const args = aim => ({ isMelee: false, shortRange: true, aimValue: aim, wp: { scatter: true } });
    expect(wallopConcussiveRating(actor, args("head"))).toBe(0);
    expect(wallopConcussiveRating(actor, args("leg"))).toBe(-1);
    expect(wallopConcussiveRating(actor, args("arm"))).toBe(-2);
    expect(wallopConcussiveRating(actor, args("joint"))).toBeNull();
    expect(wallopConcussiveRating(actor, args("eye"))).toBeNull();
  });
});

// ── Искры ───────────────────────────────────────────────────────────────────

describe("Искры: кнопка 2d10 на попадании дугового оружия", () => {
  const arcGun = () => weaponFor({ damage: "2d10", penetration: 0, weaponProps: [] }, { name: "Arc Rifle / Дуговая Винтовка" });

  it("без Таланта кнопки нет", async () => {
    await shoot([], arcGun(), null);
    expect(card()).not.toContain("wh-sparks-btn");
  });

  it("по ключу: кнопка с кубиками урона попадания", async () => {
    await shoot([talentByKey(SPARKS.key)], arcGun(), null);
    expect(card()).toMatch(/class="wh-sparks-btn"[^>]*data-dice="\d+,\d+"/);
  });

  it("по имени: то же", async () => {
    await shoot([talentByName(SPARKS.name)], arcGun(), null);
    expect(card()).toContain("wh-sparks-btn");
  });

  it("не дуговое оружие — кнопки нет", async () => {
    const las = weaponFor({ damage: "2d10", penetration: 0, weaponProps: [] }, { name: "Lasgun / Лазган" });
    await shoot([talentByName(SPARKS.name)], las, null);
    expect(card()).not.toContain("wh-sparks-btn");
  });

  it("замена: наименьший кубик → больший из 2d10, дубль — двух", () => {
    expect(sparksSwap([3, 8], [9, 5])).toEqual({ delta: 6, swaps: [{ from: 3, to: 9 }] });
    expect(sparksSwap([3, 4], [6, 6])).toEqual({ delta: 5, swaps: [{ from: 3, to: 6 }, { from: 4, to: 6 }] });
    // нечего улучшать — урон не падает
    expect(sparksSwap([9, 10], [2, 4])).toEqual({ delta: 0, swaps: [] });
    // дубль, но второй кубик уже не хуже
    expect(sparksSwap([2, 9], [5, 5])).toEqual({ delta: 3, swaps: [{ from: 2, to: 5 }] });
    expect(sparksSwap([], [5, 5])).toEqual({ delta: 0, swaps: [] });
  });

  it("распознавание дугового оружия по названию", () => {
    expect(isArcWeapon({ name: "Arc Pistol / Дуговой Пистолет" })).toBe(true);
    expect(isArcWeapon({ name: "Combi-Arc / Комби Дуговик" })).toBe(true);
    expect(isArcWeapon({ name: "Archaeotech Gun / Арха-ган" })).toBe(false);
  });
});

// ── Сварщик ─────────────────────────────────────────────────────────────────

describe("Сварщик: Избирательный выстрел Мельтой по технике — признак на кнопках урона", () => {
  const melta = () => weaponFor({ damage: "2d10", penetration: 12, weaponProps: [{ key: "melta" }] }, { name: "Meltagun / Мельтаган" });
  const hit = items => shoot(items, melta(), HEAD);

  it("по технике: кнопка урона несёт data-welder=1", async () => {
    setTargets([{ type: "vehicle" }]);
    await hit([talentByKey(WELDER.key)]);
    expect(card()).toMatch(/<button class="wh-apply-dmg-btn[^>]*data-welder="1"/);
  });

  it("по имени: то же", async () => {
    setTargets([{ type: "vehicle" }]);
    await hit([talentByName(WELDER.name)]);
    expect(card()).toMatch(/data-welder="1"/);
  });

  it("без Таланта, против не-техники и без Избирательной — data-welder=0", async () => {
    setTargets([{ type: "vehicle" }]);
    await hit([]);
    expect(card()).toMatch(/data-welder="0"/);
    resetCaptured();
    setTargets([{ type: "character" }]);
    await hit([talentByName(WELDER.name)]);
    expect(card()).toMatch(/data-welder="0"/);
    resetCaptured();
    setTargets([{ type: "vehicle" }]);
    await shoot([talentByName(WELDER.name)], melta(), null);
    expect(card()).toMatch(/data-welder="0"/);
  });

  it("не Мельта — не помечается", async () => {
    setTargets([{ type: "vehicle" }]);
    const las = weaponFor({ damage: "2d10", penetration: 2, weaponProps: [] }, { name: "Lasgun / Лазган" });
    await shoot([talentByName(WELDER.name)], las, HEAD);
    expect(card()).toMatch(/data-welder="0"/);
  });

  it("уровень Критического Эффекта: 1d5+1", () => {
    expect([1, 2, 3, 4, 5].map(welderCritLevel)).toEqual([2, 3, 4, 5, 6]);
  });
});

// ── Пробивной Удар ──────────────────────────────────────────────────────────

describe("Пробивной Удар: +2 к урону, если стрелковая атака уводит Раны в минус", () => {
  const gun = () => weaponFor({ damage: "1d10", penetration: 0 });

  it("карточка несёт величину бонуса только у стрелка с Талантом (ключ и имя)", async () => {
    await shoot([talentByKey(CRACK.key)], gun(), null);
    expect(card()).toMatch(/data-neg-wounds-bonus="2"/);
    resetCaptured();
    await shoot([talentByName(CRACK.name)], gun(), null);
    expect(card()).toMatch(/data-neg-wounds-bonus="2"/);
    resetCaptured();
    await shoot([], gun(), null);
    expect(card()).toMatch(/data-neg-wounds-bonus="0"/);
  });

  it("рукопашная атака бонус не получает", async () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });
    const actor = shooter([sword, talentByName(CRACK.name)]);
    captured.dice = [20, 5];
    await _executeAttackRoll(actor, sword, "ws", 45, "melee", null, {});
    expect(card()).toMatch(/data-neg-wounds-bonus="0"/);
  });

  it("решение при применении: net больше текущих Ран → +2, иначе 0", () => {
    expect(negativeWoundsBonus({ net: 8, value: 5, bonus: 2 })).toBe(2);
    expect(negativeWoundsBonus({ net: 5, value: 5, bonus: 2 })).toBe(0); // ровно до нуля — не в минус
    expect(negativeWoundsBonus({ net: 3, value: 5, bonus: 2 })).toBe(0);
    expect(negativeWoundsBonus({ net: 1, value: 0, bonus: 2 })).toBe(2); // Раны уже на нуле
    expect(negativeWoundsBonus({ net: 0, value: 0, bonus: 2 })).toBe(0); // ничего не прошло
    expect(negativeWoundsBonus({ net: 9, value: 1, bonus: 0 })).toBe(0);
  });

  it("величина зависит от стрелка и атаки", () => {
    const actor = shooter([talentByName(CRACK.name)]);
    expect(crackShotBonus(actor, { isMelee: false })).toBe(2);
    expect(crackShotBonus(actor, { isMelee: true })).toBe(0);
    expect(crackShotBonus(shooter([]), { isMelee: false })).toBe(0);
  });
});

// ── Иглошторм ───────────────────────────────────────────────────────────────

describe("Иглошторм: Подавление Флешетным/Игловым оружием — Полудействие", () => {
  const NEEDLE = { key: "weaponsmith.core.needlestorm", name: "Needlestorm / Иглошторм" };
  const needler = (name = "Needle Pistol / Игловой Пистолет", weaponType = "needler") => weaponFor({ weaponType }, { name });

  it("с Талантом (имя и ключ): Полудействие; без — Полное", () => {
    const w = needler();
    expect(suppressionActionType(shooter([talentByName(NEEDLE.name)]), w)).toBe("Полудействие");
    expect(suppressionActionType(shooter([talentByKey(NEEDLE.key)]), w)).toBe("Полудействие");
    expect(suppressionActionType(shooter([]), w)).toBe("Полное действие");
  });

  it("не игловое и не флешетное оружие — Полное действие", () => {
    expect(suppressionActionType(shooter([talentByName(NEEDLE.name)]), weaponFor({ weaponType: "bolt" }, { name: "Болтер" }))).toBe("Полное действие");
  });

  it("флешетное по названию", () => {
    const w = weaponFor({ weaponType: "exotic" }, { name: "Flechette Rifle / Флешетная Винтовка" });
    expect(isFlechetteOrNeedleWeapon(w)).toBe(true);
    expect(needlestormHalfAction(shooter([talentByName(NEEDLE.name)]), w)).toBe(true);
  });
});
