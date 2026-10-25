// test/combat/attack-iron-garden.test.mjs
//
// Железный Сад / Iron Garden (Таланты Механикума, Sahara 3-cc96 п.10; DoomBC —
// Основная книга): несколько одноимённых мехадендритов атакуют в рукопашной как
// одно оружие со свойством Multi-strike (X), X — число дендритов.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { ironGardenRating, isMechadendriteWeapon, hasIronGarden } from "../../module/rules/iron-garden.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const hits = () => [...card().matchAll(/data-damage="(\d+)"/g)].length;
const garden = () => ({ id: "ig", type: "talent", name: "Iron Garden / Железный Сад", system: {} });

/** Дендрит-лезвие: рукопашное оружие раздела «Мехадендриты» (profileLabel). */
const dendrite = (id, extra = {}) => ({
  ...weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "1р", damage: "1d10", profileLabel: "Мехадендрит" }),
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
