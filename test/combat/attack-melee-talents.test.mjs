// test/combat/attack-melee-talents.test.mjs
//
// Таланты «Рукопашные» главы 3 (Sahara 3-8dc5), та часть, что живёт в
// combat/attack.mjs: Терзатель Плоти, Раптор. Логика — rules/melee-talents.mjs.
//
// Каждый Талант опознаётся двумя путями: по ключу Возможности (имя предмета
// испорчено) и по имени (Талант куплен до записи Конструктора — снимок).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const damages = () => [...card().matchAll(/data-damage="(\d+)"/g)].map(m => Number(m[1]));

const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }
});
const talentByName = name => ({ id: "t-" + name, name, type: "talent", system: {} });

const FLESH = { key: "meleeCore.core.fleshRender", name: "Flesh Render / Терзатель Плоти" };

// S.b 0 и WS.b 4: слагаемые Силы не мешают арифметике кубиков.
const fighter = items => actorFor({
  items, characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) }
});

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

// ── Raptor ──────────────────────────────────────────────────────────────────

describe("Раптор: Натиск в полёте — +1d10 на 2+ Успехах и ещё +1d10 на 4+", () => {
  const RAPTOR = { key: "meleeCore.core.raptor", name: "Raptor / Раптор" };
  const blade = () => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });

  /** Бросок атаки `roll` при пороге 45; урон 1d10 = 3, потом добавочные кубы 6 и 7. */
  async function charge(items, { roll, altitude = "low", baseKey = "charge", weapon = blade() } = {}) {
    const actor = actorFor({
      items: [weapon, ...items], movement: { altitude },
      characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) }
    });
    captured.dice = [roll, 3, 6, 7];
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { baseKey });
    return damages();
  }

  it("без Таланта в полёте Натиск бьёт обычным кубом", async () => {
    expect(await charge([], { roll: 10 })).toEqual([3]);
  });

  it("1 Успех: Талант ещё ничего не добавляет", async () => {
    expect(await charge([talentByName(RAPTOR.name)], { roll: 44 })).toEqual([3]);
  });

  it("2 Успеха: +1d10", async () => {
    expect(await charge([talentByName(RAPTOR.name)], { roll: 35 })).toEqual([3 + 6]);
  });

  it("4 Успеха: +2d10 (+1d10 на 2+ и ещё +1d10 на 4+)", async () => {
    expect(await charge([talentByKey(RAPTOR.key)], { roll: 15 })).toEqual([3 + 6 + 7]);
  });

  it("на земле — Талант молчит", async () => {
    expect(await charge([talentByName(RAPTOR.name)], { roll: 15, altitude: "landed" })).toEqual([3]);
  });

  it("не Натиском (Стандартная База) — Талант молчит", async () => {
    expect(await charge([talentByName(RAPTOR.name)], { roll: 15, baseKey: "standard" })).toEqual([3]);
  });

  it("в карточке названа причина", async () => {
    await charge([talentByName(RAPTOR.name)], { roll: 15 });
    expect(card()).toContain("Раптор");
  });
});

// ── Flesh Render ────────────────────────────────────────────────────────────

describe("Терзатель Плоти: +2 кубика вместо +1 у Рвущего рукопашного, отбросить два наименьших", () => {
  const chainsword = (props = [{ key: "tearing" }]) => weaponFor({
    weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10", weaponProps: props
  });
  async function swing(items, weapon) {
    const actor = fighter([weapon, ...items]);
    // Бросок 20 — попадание; потом кубы урона по очереди.
    captured.dice = [20, 2, 9, 4, 7];
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});
  }

  it("без Таланта Рвущее — 2 куба, оставить лучший: из [2,9] берётся 9", async () => {
    await swing([], chainsword());
    expect(damages()).toEqual([9]);
  });

  it("с Талантом по ключу — 3 куба, оставить лучший: из [2,9,4] берётся 9; формула 3d10kh1", async () => {
    await swing([talentByKey(FLESH.key)], chainsword());
    expect(damages()).toEqual([9]);
    // Остался неиспользованным только последний куб очереди — 4 куба не бросали.
    expect(captured.dice).toEqual([7]);
  });

  it("по имени (Талант без записи Конструктора) — те же 3 куба", async () => {
    await swing([talentByName(FLESH.name)], chainsword());
    expect(captured.dice).toEqual([7]);
  });

  it("лучший из ТРЁХ: [2,4,9] даёт 9, а не лучший из двух", async () => {
    const weapon = chainsword();
    const actor = fighter([weapon, talentByName(FLESH.name)]);
    captured.dice = [20, 2, 4, 9];
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});
    expect(damages()).toEqual([9]);
  });

  it("без свойства Tearing у оружия Талант ничего не добавляет", async () => {
    await swing([talentByName(FLESH.name)], chainsword([]));
    // 1 куб: берётся 2, остальные не тронуты.
    expect(damages()).toEqual([2]);
    expect(captured.dice).toEqual([9, 4, 7]);
  });

  it("стрелковое оружие с Tearing не получает: Талант рукопашный", async () => {
    const gun = weaponFor({ damage: "1d10", penetration: 0, weaponProps: [{ key: "tearing" }] });
    const actor = fighter([gun, talentByName(FLESH.name)]);
    captured.dice = [20, 2, 9, 4, 7];
    await _executeAttackRoll(actor, gun, "bs", 45, "single", null, {});
    expect(captured.dice).toEqual([4, 7]);
  });

  it("в карточке названа причина", async () => {
    await swing([talentByName(FLESH.name)], chainsword());
    expect(card()).toContain("Терзатель Плоти");
  });
});
