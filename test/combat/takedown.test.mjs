// test/combat/takedown.test.mjs
//
// Takedown / Вырубание (гл. 3) и That's Not All / Ещё Не Всё: кнопка «сбить с
// ног» в карточке урона при успешном Оглушении, метка запрета Вскочить и её
// снятие. Читатель метки («Встать» стоит +1 ОД) — test/combat/takedown-standup.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { takedownKnockdown, takedownSection, applyTakedownRelay, TAKEDOWN_CARD_FLAG } from "../../module/combat/takedown.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";
import { LEAP_UP_DENIED_FLAG } from "../../module/rules/takedown.mjs";
import { conditionRemoveFields } from "../../module/sheets/tabs/conditions.mjs";

const ch = total => ({ total, bonus: Math.floor(total / 10) });
const talentItem = name => ({ type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });
const TAKEDOWN = "Takedown / Вырубание";
const THATS_NOT_ALL = "That's Not All / Ещё Не Всё";

/** Персонаж, достаточный для applyDamageToActor и наложения «Повален». */
function person({ talents = [], items = [], name = "Носитель", uuid = "Actor.p1", conditions = {}, isOwner = true } = {}) {
  const store = {};
  const list = [...talents.map(talentItem), ...items];
  list.contents = list;
  list.get = id => list.find(i => i.id === id) ?? null;
  return {
    id: uuid.replace("Actor.", ""), name, type: "character", uuid, isOwner, updates: [], _store: store,
    system: {
      absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
      characteristics: { s: ch(50), t: ch(40), wp: ch(40), ag: ch(40), int: ch(40) },
      wounds: { value: 20, critical: 0, max: 20 }, fate: { value: 2 }, cover: { ap: 0 },
      armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
      actionPoints: { value: 2, max: 2 }, conditions: { ...conditions }, fatigue: { value: 0, max: 10 }, patronGod: "", size: 4
    },
    items: list, effects: Object.assign([], { contents: [] }),
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, v) => { store[`${scope}.${key}`] = v; },
    unsetFlag: async (scope, key) => { delete store[`${scope}.${key}`]; },
    getActiveTokens: () => [],
    async update(data) {
      this.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.([^.]+)\.(.+)$/);
        if (m) { store[`${m[1]}.${m[2]}`] = value; continue; }
        const keys = path.split(".").slice(1);
        let node = this.system;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    },
    async updateEmbeddedDocuments() { return []; }
  };
}

let msgSeq = 0;
function fakeMessage({ isOwner = true } = {}) {
  return {
    // Уникальный id: локальная метка card-once.mjs живёт в модуле и переживает тесты.
    id: `m-takedown-${++msgSeq}`, isOwner, flags: {},
    getFlag(ns, k) { return this.flags[ns]?.[k]; },
    async setFlag(ns, k, v) { (this.flags[ns] ??= {})[k] = v; }
  };
}

const immunityTo = condKey => ({
  type: "trait", name: `Иммунитет ${condKey}`, system: {}, getFlag: () => undefined,
  flags: { "warhammer-dbc": { mechanics: [{ operator: "AND", entries: [
    { id: "i1", kind: "condition", condKey, condMode: "immunity", when: { negate: false, conditions: [] } }] }] } }
});

const stunHit = (over = {}) => ({
  rawDamage: 5, penetration: 0, damageType: "impact", hitLocation: "Голова",
  attackerName: "Атакующий", weaponName: "Булава", melee: true, stunManeuver: true, attackerUuid: "Actor.atk", ...over
});
const chatText = () => captured.chat.map(m => m.content ?? "").join("\n");

let registry;
let prevFromUuid;
beforeEach(() => {
  resetCaptured();
  registry = {};
  prevFromUuid = globalThis.fromUuid;
  globalThis.fromUuid = async uuid => registry[uuid] ?? null;
  globalThis.game.user = { isGM: false };
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; delete globalThis.game.combat; });

describe("Кнопка «сбить с ног» в карточке урона", () => {
  it("успешное Оглушение + Талант у атакующего → кнопка с uuid обеих сторон", async () => {
    const attacker = person({ talents: [TAKEDOWN], uuid: "Actor.atk", name: "Громила" });
    registry["Actor.atk"] = attacker;
    const target = person({ uuid: "Actor.tgt", name: "Цель" });
    await applyDamageToActor(target, stunHit());

    expect(target.system.conditions.stunned).toBe(true);   // Оглушение наложилось
    const html = chatText();
    expect(html).toContain("wh-takedown-btn");
    expect(html).toContain('data-attacker-uuid="Actor.atk"');
    expect(html).toContain('data-target-uuid="Actor.tgt"');
  });

  it("атакующий без Таланта — кнопки нет", async () => {
    registry["Actor.atk"] = person({ uuid: "Actor.atk" });
    await applyDamageToActor(person({ uuid: "Actor.tgt" }), stunHit());
    expect(chatText()).not.toContain("wh-takedown-btn");
  });

  it("Оглушение не наложилось (иммунитет) — кнопки нет", async () => {
    registry["Actor.atk"] = person({ talents: [TAKEDOWN], uuid: "Actor.atk" });
    const target = person({ uuid: "Actor.tgt", items: [immunityTo("stunned")] });
    await applyDamageToActor(target, stunHit());
    expect(target.system.conditions.stunned).toBeFalsy();
    expect(chatText()).not.toContain("wh-takedown-btn");
  });

  it("урон поглощён целиком — Оглушения нет, кнопки нет", async () => {
    registry["Actor.atk"] = person({ talents: [TAKEDOWN], uuid: "Actor.atk" });
    const target = person({ uuid: "Actor.tgt" });
    target.system.absorption.toughnessBonus = 20;
    await applyDamageToActor(target, stunHit({ rawDamage: 3 }));
    expect(chatText()).not.toContain("wh-takedown-btn");
  });

  it("обычное попадание (не приём Оглушить) — кнопки нет, даже у носителя Таланта", async () => {
    registry["Actor.atk"] = person({ talents: [TAKEDOWN], uuid: "Actor.atk" });
    await applyDamageToActor(person({ uuid: "Actor.tgt" }), stunHit({ stunManeuver: false }));
    expect(chatText()).not.toContain("wh-takedown-btn");
  });

  it("цель уже лежит — сбивать некого, кнопки нет", async () => {
    registry["Actor.atk"] = person({ talents: [TAKEDOWN], uuid: "Actor.atk" });
    const target = person({ uuid: "Actor.tgt", conditions: { prone: true } });
    expect(await takedownSection("Actor.atk", target)).toBe("");
  });
});

describe("Нажатие кнопки: цель падает, метка — только от «Ещё Не Всё»", () => {
  it("с одним Вырубанием: Повален наложен, метки Вскочить нет", async () => {
    const attacker = person({ talents: [TAKEDOWN], uuid: "Actor.atk" });
    const target = person({ uuid: "Actor.tgt", name: "Цель" });
    registry["Actor.atk"] = attacker; registry["Actor.tgt"] = target;
    const done = await takedownKnockdown(fakeMessage(), "Actor.atk", "Actor.tgt");

    expect(done).toBe(true);
    expect(target.system.conditions.prone).toBe(true);
    expect(target.getFlag("warhammer-dbc", LEAP_UP_DENIED_FLAG)).toBeUndefined();
    expect(chatText()).toContain("сбит(а) с ног");
  });

  it("с «Ещё Не Всё»: Повален и метка запрета Вскочить одним обновлением", async () => {
    const attacker = person({ talents: [TAKEDOWN, THATS_NOT_ALL], uuid: "Actor.atk" });
    const target = person({ uuid: "Actor.tgt" });
    registry["Actor.atk"] = attacker; registry["Actor.tgt"] = target;
    await takedownKnockdown(fakeMessage(), "Actor.atk", "Actor.tgt");

    expect(target.system.conditions.prone).toBe(true);
    expect(target.getFlag("warhammer-dbc", LEAP_UP_DENIED_FLAG)).toBe(true);
    const patch = target.updates.at(-1);
    expect(patch["system.conditions.prone"]).toBe(true);
    expect(patch[`flags.warhammer-dbc.${LEAP_UP_DENIED_FLAG}`]).toBe(true);
    expect(chatText()).toContain("+1 ОД");
  });

  it("иммунитет к «Повален» — ни Состояния, ни метки", async () => {
    const attacker = person({ talents: [TAKEDOWN, THATS_NOT_ALL], uuid: "Actor.atk" });
    const target = person({ uuid: "Actor.tgt", items: [immunityTo("prone")] });
    registry["Actor.atk"] = attacker; registry["Actor.tgt"] = target;
    await takedownKnockdown(fakeMessage(), "Actor.atk", "Actor.tgt");

    expect(target.system.conditions.prone).toBeFalsy();
    expect(target.getFlag("warhammer-dbc", LEAP_UP_DENIED_FLAG)).toBeUndefined();
  });

  it("раз на карточку: второй клик ничего не делает", async () => {
    const attacker = person({ talents: [TAKEDOWN, THATS_NOT_ALL], uuid: "Actor.atk" });
    const target = person({ uuid: "Actor.tgt" });
    registry["Actor.atk"] = attacker; registry["Actor.tgt"] = target;
    const msg = fakeMessage();
    expect(await takedownKnockdown(msg, "Actor.atk", "Actor.tgt")).toBe(true);
    const updates = target.updates.length;
    expect(await takedownKnockdown(msg, "Actor.atk", "Actor.tgt")).toBe(false);
    expect(target.updates.length).toBe(updates);
  });

  it("у атакующего нет Таланта — отказ, цель не тронута", async () => {
    const attacker = person({ uuid: "Actor.atk" });
    const target = person({ uuid: "Actor.tgt" });
    registry["Actor.atk"] = attacker; registry["Actor.tgt"] = target;
    expect(await takedownKnockdown(fakeMessage(), "Actor.atk", "Actor.tgt")).toBe(false);
    expect(target.updates).toEqual([]);
  });

  it("чужой игрок (не владелец атакующего, не ГМ) — отказ", async () => {
    const attacker = person({ talents: [TAKEDOWN], uuid: "Actor.atk", isOwner: false });
    const target = person({ uuid: "Actor.tgt" });
    registry["Actor.atk"] = attacker; registry["Actor.tgt"] = target;
    expect(await takedownKnockdown(fakeMessage(), "Actor.atk", "Actor.tgt")).toBe(false);
    expect(target.updates).toEqual([]);
  });

  it("ГМ может нажать за любого", async () => {
    globalThis.game.user = { isGM: true };
    const attacker = person({ talents: [TAKEDOWN], uuid: "Actor.atk", isOwner: false });
    const target = person({ uuid: "Actor.tgt" });
    registry["Actor.atk"] = attacker; registry["Actor.tgt"] = target;
    expect(await takedownKnockdown(fakeMessage(), "Actor.atk", "Actor.tgt")).toBe(true);
    expect(target.system.conditions.prone).toBe(true);
  });

  it("ключ отметки карточки внесён в белый список сокета", () => {
    expect(CARD_ONCE_FLAGS).toContain(TAKEDOWN_CARD_FLAG);
  });
});

describe("Игрок не владеет целью: правку делает Мастер через сокет", () => {
  let emitted;
  let prevSocket, prevUsers;
  beforeEach(() => {
    emitted = [];
    prevSocket = globalThis.game.socket; prevUsers = globalThis.game.users;
    globalThis.game.socket = { emit: (_channel, payload) => emitted.push(payload) };
    globalThis.game.users = { activeGM: { id: "gm" } };
    globalThis.game.user = { isGM: false, id: "u-player" };
  });
  afterEach(() => { globalThis.game.socket = prevSocket; globalThis.game.users = prevUsers; });

  const duo = ({ attackerTalents = [TAKEDOWN], targetOver = {} } = {}) => {
    const attacker = person({ talents: attackerTalents, uuid: "Actor.atk" });
    const target = person({ uuid: "Actor.tgt", isOwner: false, ...targetOver });
    registry["Actor.atk"] = attacker; registry["Actor.tgt"] = target;
    return { attacker, target };
  };

  it("клик игрока: в цель сам не пишет, просит ГМа, карточка помечена", async () => {
    const { target } = duo();
    const msg = fakeMessage();
    expect(await takedownKnockdown(msg, "Actor.atk", "Actor.tgt")).toBe(true);
    expect(target.updates).toEqual([]);
    expect(emitted).toEqual([{ action: "takedownKnockdown", userId: "u-player", attackerUuid: "Actor.atk", targetUuid: "Actor.tgt" }]);
  });

  it("ГМа в игре нет — отказ, карточка не помечена", async () => {
    globalThis.game.users = { activeGM: null };
    const { target } = duo();
    expect(await takedownKnockdown(fakeMessage(), "Actor.atk", "Actor.tgt")).toBe(false);
    expect(emitted).toEqual([]);
    expect(target.updates).toEqual([]);
  });

  it("ГМ по запросу сбивает цель и ставит метку «Ещё Не Всё»", async () => {
    const { attacker, target } = duo({ attackerTalents: [TAKEDOWN, THATS_NOT_ALL], targetOver: { conditions: { stunned: true } } });
    attacker.testUserPermission = () => true;
    await applyTakedownRelay({ attackerUuid: "Actor.atk", targetUuid: "Actor.tgt" }, { isGM: false });
    expect(target.system.conditions.prone).toBe(true);
    expect(target.getFlag("warhammer-dbc", LEAP_UP_DENIED_FLAG)).toBe(true);
  });

  it("ГМ отклоняет запрос того, кто не владеет атакующим", async () => {
    const { attacker, target } = duo({ targetOver: { conditions: { stunned: true } } });
    attacker.testUserPermission = () => false;
    await applyTakedownRelay({ attackerUuid: "Actor.atk", targetUuid: "Actor.tgt" }, { isGM: false });
    expect(target.updates).toEqual([]);
  });

  it("ГМ отклоняет запрос по цели, которая не Оглушена", async () => {
    const { attacker, target } = duo();
    attacker.testUserPermission = () => true;
    await applyTakedownRelay({ attackerUuid: "Actor.atk", targetUuid: "Actor.tgt" }, { isGM: false });
    expect(target.updates).toEqual([]);
  });

  it("ГМ отклоняет запрос атакующего без Вырубания", async () => {
    const { attacker, target } = duo({ attackerTalents: [], targetOver: { conditions: { stunned: true } } });
    attacker.testUserPermission = () => true;
    await applyTakedownRelay({ attackerUuid: "Actor.atk", targetUuid: "Actor.tgt" }, { isGM: false });
    expect(target.updates).toEqual([]);
  });
});

describe("Метка снимается вместе с «Повален»", () => {
  it("conditionRemoveFields('prone') гасит и метку запрета Вскочить", () => {
    const fields = conditionRemoveFields("prone");
    expect(fields["system.conditions.prone"]).toBe(false);
    expect(fields[`flags.warhammer-dbc.-=${LEAP_UP_DENIED_FLAG}`]).toBeNull();
  });
  it("прочие Состояния метку не трогают", () => {
    expect(Object.keys(conditionRemoveFields("stunned")).some(k => k.includes(LEAP_UP_DENIED_FLAG))).toBe(false);
  });
});
