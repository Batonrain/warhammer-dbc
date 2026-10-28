// test/combat/attack-iron-garden.test.mjs
//
// Железный Сад / Iron Garden (Таланты Механикума, Sahara 3-cc96 п.10; DoomBC —
// Основная книга): несколько одноимённых мехадендритов атакуют в рукопашной как
// одно оружие со свойством Multi-strike (X), X — число дендритов.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { ironGardenRating, isMechadendriteWeapon, hasIronGarden, ironGardenQuality } from "../../module/rules/iron-garden.mjs";
import { qualityEffects } from "../../module/constants/quality.mjs";
import { weaponThresholdPart } from "../../module/combat/attack-threshold.mjs";
import { handsOccupied, canEquipInHands } from "../../module/rules/hands.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const hits = () => [...card().matchAll(/data-damage="(\d+)"/g)].length;
const garden = () => ({ id: "ig", type: "talent", name: "Iron Garden / Железный Сад", system: {} });

/** Дендрит-лезвие: рукопашное оружие раздела «Мехадендриты» (profileLabel), надетое. */
const dendrite = (id, extra = {}) => ({
  ...weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "1р", damage: "1d10", profileLabel: "Мехадендрит", equipped: true }),
  id, name: "Dendrite Blade / Дендрит Лезвие", ...extra
});

const fighter = items => actorFor({
  items, characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) }
});

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("рейтинг Железного Сада", () => {
  it("два одноимённых мехадендрита — Multi-strike (2); количество предмета тоже считается", () => {
    const a = fighter([garden(), dendrite("d1"), dendrite("d2")]);
    expect(ironGardenRating(a, a.items.get("d1"))).toBe(2);
    const b = fighter([garden(), dendrite("d1", { system: { ...dendrite("x").system, quantity: 3 } })]);
    expect(ironGardenRating(b, b.items.get("d1"))).toBe(3);
  });
  it("снятый или сданный на склад одноимённый дендрит в группу не входит — ни в рейтинг, ни в Качество", () => {
    const off = { ...dendrite("x").system, equipped: false };
    const a = fighter([garden(), dendrite("d1"), dendrite("d2", { system: off })]);
    expect(ironGardenRating(a, a.items.get("d1"))).toBe(0);
    const b = fighter([garden(), dendrite("d1"), dendrite("d2"), dendrite("d3", { system: { ...off, quality: "poor", stored: true } })]);
    expect(ironGardenRating(b, b.items.get("d1"))).toBe(2);
    expect(ironGardenQuality(b, b.items.get("d1"))).toBe("common");
  });
  it("один мехадендрит, чужое имя, обычное оружие, нет Таланта — 0", () => {
    const one = fighter([garden(), dendrite("d1")]);
    expect(ironGardenRating(one, one.items.get("d1"))).toBe(0);
    const mixed = fighter([garden(), dendrite("d1"), dendrite("d2", { name: "Servo-Arm / Серво-Рука" })]);
    expect(ironGardenRating(mixed, mixed.items.get("d1"))).toBe(0);
    const sword = weaponFor({ weaponClass: "melee", damage: "1d10" });
    expect(ironGardenRating(fighter([garden(), sword, { ...sword, id: "s2" }]), sword)).toBe(0);
    const noTalent = fighter([dendrite("d1"), dendrite("d2")]);
    expect(ironGardenRating(noTalent, noTalent.items.get("d1"))).toBe(0);
    expect(hasIronGarden(noTalent)).toBe(false);
    expect(isMechadendriteWeapon(sword)).toBe(false);
  });
});

describe("Железный Сад в рукопашной атаке", () => {
  async function swing(items) {
    const weapon = items.find(i => i.id === "d1");
    const actor = fighter(items);
    captured.dice = [5, 3, 4, 6, 2]; // бросок 5 при пороге 45 — 4 Успеха, потом кубы урона
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});
    return hits();
  }

  it("без Таланта — одно попадание", async () => {
    expect(await swing([dendrite("d1"), dendrite("d2")])).toBe(1);
  });
  it("с Талантом и двумя дендритами — два попадания (Multi-strike 2 на 4 Успехах)", async () => {
    expect(await swing([garden(), dendrite("d1"), dendrite("d2")])).toBe(2);
  });
  it("с Талантом, но один дендрит — одно попадание", async () => {
    expect(await swing([garden(), dendrite("d1")])).toBe(1);
  });
});

// Книга: «Если эти дендриты имеют разное качество, для бросков атаки и урона
// используется наименьшее.» Решение владельца 26.10.2026.
const withQuality = (id, quality, extra = {}) => dendrite(id, { system: { ...dendrite("x").system, quality }, ...extra });

describe("Железный Сад: наименьшее Качество группы", () => {
  const ranks = ["poor", "common", "good", "best"];

  it("ironGardenQuality: наименьшее среди одноимённых; без группы — null", () => {
    const a = fighter([garden(), withQuality("d1", "best"), withQuality("d2", "poor"), withQuality("d3", "good")]);
    expect(ironGardenQuality(a, a.items.get("d1"))).toBe("poor");
    const same = fighter([garden(), withQuality("d1", "good"), withQuality("d2", "good")]);
    expect(ironGardenQuality(same, same.items.get("d1"))).toBe("good");
    const single = fighter([garden(), withQuality("d1", "best")]);
    expect(ironGardenQuality(single, single.items.get("d1"))).toBeNull();
    const noTalent = fighter([withQuality("d1", "best"), withQuality("d2", "poor")]);
    expect(ironGardenQuality(noTalent, noTalent.items.get("d1"))).toBeNull();
    // чужое имя в группу не входит
    const mixed = fighter([garden(), withQuality("d1", "best"), withQuality("d2", "poor", { name: "Servo-Arm / Серво-Рука" })]);
    expect(ironGardenQuality(mixed, mixed.items.get("d1"))).toBeNull();
    expect(ranks.length).toBe(4);
  });

  it("qualityEffects принимает подмену Качества: Best +10/+1 урона превращается в Poor −10", () => {
    const best = withQuality("d1", "best");
    expect(qualityEffects(best).auto).toMatchObject({ testMod: 10, damageMod: 1 });
    expect(qualityEffects(best, "poor").auto).toMatchObject({ testMod: -10 });
    expect(qualityEffects(best, "poor").auto.damageMod).toBeUndefined();
  });

  it("порог атаки берёт наименьшее Качество группы, а не Качество выбранного дендрита", () => {
    const grouped = fighter([garden(), withQuality("d1", "best"), withQuality("d2", "poor")]);
    const alone = fighter([withQuality("d1", "best")]);
    const lone = weaponThresholdPart(alone, alone.items.get("d1"), "ws");
    const group = weaponThresholdPart(grouped, grouped.items.get("d1"), "ws");
    expect(lone - group).toBe(20);   // Best +10 против Poor −10
  });

  it("урон в карточке: Best + Poor бьёт без +1 Best.Q, Best + Best — с ним", async () => {
    const dmg = async items => {
      resetCaptured();
      const actor = fighter(items);
      captured.dice = [5, 3, 4, 6, 2];
      await _executeAttackRoll(actor, items.find(i => i.id === "d1"), "ws", 45, "melee", null, {});
      return [...card().matchAll(/data-damage="(\d+)"/g)].map(m => Number(m[1]));
    };
    const both = await dmg([garden(), withQuality("d1", "best"), withQuality("d2", "best")]);
    const mixedQ = await dmg([garden(), withQuality("d1", "best"), withQuality("d2", "poor")]);
    expect(both.length).toBe(mixedQ.length);
    expect(both.reduce((s, x) => s + x, 0) - mixedQ.reduce((s, x) => s + x, 0)).toBe(both.length);
  });
});

describe("Железный Сад: одна рука на группу", () => {
  it("два одноимённых надетых дендрита с Талантом занимают одну руку, без Таланта — две", () => {
    const eq = (id, extra = {}) => dendrite(id, { system: { ...dendrite("x").system, equipped: true }, ...extra });
    const withTalent = fighter([garden(), eq("d1"), eq("d2")]);
    const without = fighter([eq("d1"), eq("d2")]);
    expect(handsOccupied(withTalent).used).toBe(1);
    expect(handsOccupied(without).used).toBe(2);
  });
  it("второй одноимённый дендрит можно надеть при полных руках; без Таланта — нет", () => {
    const eq = (id, equipped = true) => dendrite(id, { system: { ...dendrite("x").system, equipped } });
    const blade = { ...weaponFor({ weaponClass: "melee", grips: "1р", equipped: true }), id: "sw", name: "Меч" };
    const a = fighter([garden(), eq("d1"), blade, eq("d2", false)]);
    expect(handsOccupied(a).free).toBe(0);
    expect(canEquipInHands(a, a.items.get("d2"))).toBe(true);
    const b = fighter([eq("d1"), blade, eq("d2", false)]);
    expect(canEquipInHands(b, b.items.get("d2"))).toBe(false);
  });
  it("разные дендриты считаются порознь; группа из трёх — одна рука", () => {
    const eq = (id, extra = {}) => dendrite(id, { system: { ...dendrite("x").system, equipped: true }, ...extra });
    const mixed = fighter([garden(), eq("d1"), eq("d2"), eq("d3", { name: "Servo-Arm / Серво-Рука" })]);
    expect(handsOccupied(mixed).used).toBe(2);
    const three = fighter([garden(), eq("d1"), eq("d2"), eq("d3")]);
    expect(handsOccupied(three).used).toBe(1);
  });
});
