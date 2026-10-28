// test/combat/attack-berserker-talents.test.mjs
//
// Таланты «Берсерк» главы 3 (Sahara 3-861e), та часть, что живёт в combat/attack.mjs:
// Удар Молота (Hammer Blow) и Неостановимый Натиск (Unstoppable Charge) — свойства
// оружия, зависящие от Базы, выбранной в окне. Логика — rules/berserker-talents.mjs.
//
// Таланты даются двумя путями: записью Конструктора (имя нарочно испорчено) и по
// имени — как у персонажа, купившего Талант до записи в паке.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const penetration = () => Number(card().match(/data-penetration="(-?\d+)"/)?.[1]);
const felling = () => Number(card().match(/data-felling="(\d+)"/)?.[1]);

const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }
});
const talentByName = name => ({ id: "t-" + name, name, type: "talent", system: {} });

const HAMMER = { key: "berserker.core.hammerBlow", name: "Hammer Blow / Удар Молота" };
const UNSTOP = { key: "rider.core.unstoppableCharge", name: "Unstoppable Charge / Неостановимый Натиск" };

const blade = (props = []) => weaponFor({
  weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10", penetration: 1, weaponProps: props
});

// WS 45 → WS.b 4 → ½ (окр.▲) = 2.
const fighter = (items, system = {}) => actorFor({
  items, ...system, characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) }
});

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

async function swing(items, { weapon = blade(), baseKey = "fullatk", system = {} } = {}) {
  const actor = fighter([weapon, ...items], system);
  captured.dice = [20, 5, 5, 5];
  await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { baseKey });
}

describe("Удар Молота: Полная Атака — +½WS.b Pen и Concussive (2)", () => {
  it("без Таланта Pen оружия как есть, Оглушающего нет", async () => {
    await swing([]);
    expect(penetration()).toBe(1);
    expect(card()).not.toContain("Оглушающее");
  });

  it("с Талантом (ключ) на Полной Атаке: Pen +2, свойство Concussive", async () => {
    await swing([talentByKey(HAMMER.key)]);
    expect(penetration()).toBe(3);
    expect(card()).toContain("Оглушающее");
  });

  it("с Талантом (имя, снимок без записи Конструктора) — то же", async () => {
    await swing([talentByName(HAMMER.name)]);
    expect(penetration()).toBe(3);
  });

  it("не Полная Атака (Стандартная, Натиск) — Талант молчит", async () => {
    await swing([talentByName(HAMMER.name)], { baseKey: "standard" });
    expect(penetration()).toBe(1);
    expect(card()).not.toContain("Оглушающее");
    await swing([talentByName(HAMMER.name)], { baseKey: "charge" });
    expect(penetration()).toBe(1);
  });

  it("округление вверх: WS.b 5 → ½ = 2,5 → Pen +3", async () => {
    const weapon = blade();
    const actor = actorFor({
      items: [weapon, talentByName(HAMMER.name)],
      characteristics: { ws: char(55), bs: char(45), s: char(9), t: char(40), ag: char(35) }
    });
    captured.dice = [20, 5];
    await _executeAttackRoll(actor, weapon, "ws", 55, "melee", null, { baseKey: "fullatk" });
    expect(penetration()).toBe(4);
  });

  it("уже имеющееся Оглушающее выше двух не понижается: остаётся (3)", async () => {
    await swing([talentByName(HAMMER.name)], { weapon: blade([{ key: "concussive", rating: 3 }]) });
    expect(card()).toContain("Оглушающее (3)");
  });

  it("в карточке названа причина", async () => {
    await swing([talentByName(HAMMER.name)]);
    expect(card()).toContain("Удар Молота");
  });
});

describe("Неостановимый Натиск: верхом на Натиске — Felling (½WS.b)", () => {
  const mounted = { mount: { uuid: "Actor.horse" } };

  it("без Таланта Felling нет", async () => {
    await swing([], { baseKey: "charge", system: mounted });
    expect(felling()).toBe(0);
  });

  it("верхом, Натиск, Талант (ключ): Felling (2)", async () => {
    await swing([talentByKey(UNSTOP.key)], { baseKey: "charge", system: mounted });
    expect(felling()).toBe(2);
  });

  it("верхом, Натиск, Талант (имя) — то же", async () => {
    await swing([talentByName(UNSTOP.name)], { baseKey: "charge", system: mounted });
    expect(felling()).toBe(2);
  });

  it("пешком — нет", async () => {
    await swing([talentByName(UNSTOP.name)], { baseKey: "charge" });
    expect(felling()).toBe(0);
  });

  it("верхом, но не Натиск — нет", async () => {
    await swing([talentByName(UNSTOP.name)], { baseKey: "standard", system: mounted });
    expect(felling()).toBe(0);
  });

  it("у оружия уже есть Felling (3): берётся большее, не сумма", async () => {
    await swing([talentByName(UNSTOP.name)], {
      baseKey: "charge", system: mounted, weapon: blade([{ key: "felling", rating: 3 }])
    });
    expect(felling()).toBe(3);
  });

  it("в карточке названа причина", async () => {
    await swing([talentByName(UNSTOP.name)], { baseKey: "charge", system: mounted });
    expect(card()).toContain("Неостановимый Натиск");
  });
});
