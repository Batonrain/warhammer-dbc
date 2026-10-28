// test/combat/gm-relay.test.mjs
//
// Запись в чужого актора-цель через ГМа (Sahara riding-the-momentum, п. 2):
// Захват, Повал, Жокей и Удушение раньше писали в цель с клиента игрока и
// падали на правах Foundry — уже после записи на самого игрока.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  checkTargetWrite, writeToTarget, applyTargetWriteRelay, performTargetWrite,
  TARGET_WRITE_ACTION, RELAY_TARGET_FLAGS, RELAY_TARGET_CONDITIONS
} from "../../module/combat/gm-relay.mjs";
import { PARTNER_FLAG, ROLE_FLAG, GRAPPLE_HANDS_FLAG, GRAPPLE_HELD_HANDS_FLAG, SQUEEZE_PENDING_FLAG, SQUEEZE_ACTIVE_FLAG,
  resolveGrappleSuccess, endGrapple } from "../../module/combat/grapple.mjs";
import { JOCKEY_RIDING_FLAG, JOCKEY_MOUNTED_FLAG, resolveJockeySuccess } from "../../module/combat/jockey.mjs";
import { PIN_DOWN_FLAG } from "../../module/rules/pugilist-talents.mjs";
import { GRAPPLE_TAIL_FLAG } from "../../module/rules/naga-traits.mjs";
import { LEAP_UP_DENIED_FLAG } from "../../module/rules/takedown.mjs";
import { resolveKnockdownSuccess } from "../../module/combat/knockdown.mjs";
import { resolveRoundhouseSuccess } from "../../module/combat/roundhouse.mjs";
import { resolveBulldozeSuccess } from "../../module/combat/bulldoze.mjs";
import { applyChokehold } from "../../module/combat/grapple-talents.mjs";
import { INSPIRED_WRATH_FLAG } from "../../module/rules/inspire-wrath.mjs";
import { conditionApplyFields, conditionRemoveFields } from "../../module/sheets/tabs/conditions.mjs";
import { CONDITIONS_DEF } from "../../module/constants/conditions.mjs";

const NS = "warhammer-dbc";
// Владение проверяется ИМЕННО по просящему: заглушка отвечает «да» только пользователю REQUESTER (ревью, В5).
const REQUESTER = { id: "u-req", isGM: false };
const ME = { uuid: "Actor.me", name: "Игрок", items: [], testUserPermission: (user, level) => user === REQUESTER && level === "OWNER" };
const INSPIRE = { type: "talent", name: "Inspire Wrath / Вдохновить Гнев", system: {}, flags: {} };

describe("список допустимых флагов совпадает с кодом Захвата/Жокея", () => {
  it("каждое имя флага, которым пользуются приёмы, разрешено релеем", () => {
    for (const f of [PARTNER_FLAG, ROLE_FLAG, GRAPPLE_HANDS_FLAG, GRAPPLE_HELD_HANDS_FLAG, SQUEEZE_PENDING_FLAG,
      SQUEEZE_ACTIVE_FLAG, PIN_DOWN_FLAG, GRAPPLE_TAIL_FLAG, JOCKEY_RIDING_FLAG, JOCKEY_MOUNTED_FLAG, LEAP_UP_DENIED_FLAG]) {
      expect(RELAY_TARGET_FLAGS).toContain(f);
    }
  });

  it("Состояния, которые накладывают эти приёмы, существуют в реестре", () => {
    for (const c of RELAY_TARGET_CONDITIONS) expect(CONDITIONS_DEF[c]).toBeTruthy();
  });

  it("патчи наложения и снятия Захвата/Ничком целиком проходят проверку", () => {
    const fields = { ...conditionApplyFields("grappling"), ...conditionApplyFields("prone"),
      ...conditionRemoveFields("grappling"), ...conditionRemoveFields("prone") };
    expect(checkTargetWrite({ kind: "update", data: fields }, { initiatorOwned: true })).toEqual({ ok: true });
  });
});

describe("checkTargetWrite", () => {
  const own = { initiatorOwned: true, initiator: { items: [INSPIRE] } };

  it("флаги и Состояния Захвата — можно", () => {
    expect(checkTargetWrite({ kind: "update", data: {
      "system.conditions.grappling": true, [`flags.${NS}.${PARTNER_FLAG}`]: "Actor.x",
      [`flags.${NS}.-=${ROLE_FLAG}`]: null } }, own).ok).toBe(true);
  });

  it("чужое поле (раны, характеристики, неизвестный флаг) — нельзя", () => {
    for (const data of [
      { "system.wounds.value": 0 },
      { "system.conditions.dead": true },
      { [`flags.${NS}.somethingElse`]: 1 },
      { [`flags.${NS}.-=${ROLE_FLAG}`]: 5 },
      { "system.conditions.grappling": "yes" },
      { name: "Взлом" }
    ]) expect(checkTargetWrite({ kind: "update", data }, own).ok).toBe(false);
  });

  it("не владеющий инициатором просящий — отказ при любом виде", () => {
    const stranger = { initiatorOwned: false, initiator: { items: [INSPIRE] } };
    expect(checkTargetWrite({ kind: "addFatigue", amount: 1 }, stranger).ok).toBe(false);
    expect(checkTargetWrite({ kind: "update", data: { "system.conditions.prone": true } }, stranger).ok).toBe(false);
  });

  it("Усталость: целое 1…20", () => {
    expect(checkTargetWrite({ kind: "addFatigue", amount: 3 }, own).ok).toBe(true);
    for (const amount of [0, -1, 21, 1.5, "x"]) expect(checkTargetWrite({ kind: "addFatigue", amount }, own).ok).toBe(false);
  });

  it("Вдохновить Гнев: по сокету идёт только цель Ненависти, и только от носителя Inspire Wrath", () => {
    const target = { kind: "faction", ref: "xenos", value: "", name: "Ксеносы", img: "" };
    expect(checkTargetWrite({ kind: "inspireHatred", target }, own).ok).toBe(true);
    expect(checkTargetWrite({ kind: "inspireHatred", target }, { initiatorOwned: true, initiator: { items: [] } }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "inspireHatred", target: { kind: "all" } }, own).ok).toBe(true);
    // чужие поля, вложенные объекты, лишние виды и длинные строки — отказ
    for (const bad of [null, {}, { kind: "actorType", value: "vehicle" }, { kind: "faction", effects: [] },
      { kind: "faction", name: { x: 1 } }, { kind: "faction", name: "я".repeat(201) }, []]) {
      expect(checkTargetWrite({ kind: "inspireHatred", target: bad }, own).ok).toBe(false);
    }
  });

  it("старый вид createItem (целый предмет от клиента) больше не принимается", () => {
    const item = { type: "talent", name: "Hatred", effects: [{ name: "подложенный" }],
      system: { targets: [{ kind: "all" }] }, flags: { [NS]: { [INSPIRED_WRATH_FLAG]: { sourceUuid: "Actor.me" } } } };
    expect(checkTargetWrite({ kind: "createItem", item }, own).ok).toBe(false);
  });

  it("неизвестный вид и пустая правка — отказ", () => {
    expect(checkTargetWrite({ kind: "delete" }, own).ok).toBe(false);
    expect(checkTargetWrite({ kind: "update", data: {} }, own).ok).toBe(false);
    expect(checkTargetWrite(null, own).ok).toBe(false);
  });
});

describe("writeToTarget", () => {
  let prev;
  const emitted = [];
  beforeEach(() => {
    resetCaptured(); emitted.length = 0;
    prev = { socket: globalThis.game.socket, users: globalThis.game.users, user: globalThis.game.user };
    globalThis.game.socket = { emit: (_c, payload) => emitted.push(payload) };
    globalThis.game.users = { activeGM: { id: "gm" } };
    globalThis.game.user = { id: "u1", isGM: false };
  });
  afterEach(() => { Object.assign(globalThis.game, prev); });

  const target = (isOwner) => {
    const t = { uuid: "Actor.t", name: "Цель", isOwner, updates: [], update: async d => { t.updates.push(d); } };
    return t;
  };
  const op = { kind: "update", data: { "system.conditions.prone": true } };

  it("владелец цели пишет сам, сокет не нужен", async () => {
    const t = target(true);
    expect(await writeToTarget(t, op, ME)).toBe(true);
    expect(t.updates).toEqual([op.data]);
    expect(emitted).toEqual([]);
  });

  it("ГМ пишет сам, даже если не владелец", async () => {
    globalThis.game.user = { id: "gm", isGM: true };
    const t = target(false);
    await writeToTarget(t, op, ME);
    expect(t.updates).toEqual([op.data]);
  });

  it("чужая цель — запрос уходит активному ГМу, локально ничего не пишется", async () => {
    const t = target(false);
    expect(await writeToTarget(t, op, ME)).toBe(true);
    expect(t.updates).toEqual([]);
    expect(emitted).toEqual([{ action: TARGET_WRITE_ACTION, userId: "u1", initiatorUuid: "Actor.me", targetUuid: "Actor.t", op }]);
  });

  it("чужая цель и ГМа нет в игре — false и предупреждение, запрос не отправляется", async () => {
    globalThis.game.users = { activeGM: null };
    const t = target(false);
    expect(await writeToTarget(t, op, ME)).toBe(false);
    expect(emitted).toEqual([]);
    expect(captured.warnings.at(-1)).toContain("Мастера нет");
  });
});

describe("applyTargetWriteRelay (ГМ)", () => {
  const prevFrom = globalThis.fromUuid;
  afterEach(() => { globalThis.fromUuid = prevFrom; });

  function world(initiator, target) {
    globalThis.fromUuid = async uuid => (uuid === initiator.uuid ? initiator : uuid === target.uuid ? target : null);
  }
  const target = () => { const t = { uuid: "Actor.t", name: "Цель", updates: [], update: async d => { t.updates.push(d); } }; return t; };

  it("допустимая запись от владельца инициатора применяется", async () => {
    const t = target(); world(ME, t);
    const op = { kind: "update", data: { "system.conditions.prone": true } };
    expect(await applyTargetWriteRelay({ initiatorUuid: ME.uuid, targetUuid: t.uuid, op }, REQUESTER)).toBe(true);
    expect(t.updates).toEqual([op.data]);
  });

  it("чужой пользователь (не тот, кто владеет инициатором) — отказ: проверяется именно просящий", async () => {
    const t = target(); world(ME, t);
    const op = { kind: "update", data: { "system.conditions.prone": true } };
    expect(await applyTargetWriteRelay({ initiatorUuid: ME.uuid, targetUuid: t.uuid, op }, { id: "u-other", isGM: false })).toBe(false);
    expect(t.updates).toEqual([]);
  });

  it("просящий не владеет инициатором — отказ, цель не тронута", async () => {
    const t = target();
    world({ ...ME, testUserPermission: () => false }, t);
    const op = { kind: "update", data: { "system.conditions.prone": true } };
    expect(await applyTargetWriteRelay({ initiatorUuid: ME.uuid, targetUuid: t.uuid, op }, REQUESTER)).toBe(false);
    expect(t.updates).toEqual([]);
  });

  it("путь вне списка — отказ", async () => {
    const t = target(); world(ME, t);
    const op = { kind: "update", data: { "system.wounds.value": 0 } };
    expect(await applyTargetWriteRelay({ initiatorUuid: ME.uuid, targetUuid: t.uuid, op }, REQUESTER)).toBe(false);
    expect(t.updates).toEqual([]);
  });

  it("inspireHatred: ГМ сам собирает предмет — клиентских эффектов и Механики в нём нет", async () => {
    const created = [];
    const t = { uuid: "Actor.t", name: "Цель", update: async () => {}, createEmbeddedDocuments: async (type, docs) => { created.push([type, docs]); } };
    const initiator = { ...ME, items: [INSPIRE] };
    const prevFrom = globalThis.fromUuid;
    globalThis.fromUuid = async uuid => (uuid === initiator.uuid ? initiator : uuid === t.uuid ? t : null);
    const target = { kind: "all", ref: "", value: "", name: "Все!", img: "", evil: undefined };
    delete target.evil;
    const op = { kind: "inspireHatred", target, item: { effects: [{ name: "подложенный" }], flags: { [NS]: { mechanics: [{ x: 1 }] } } } };
    expect(await applyTargetWriteRelay({ initiatorUuid: ME.uuid, targetUuid: t.uuid, op }, REQUESTER)).toBe(true);
    globalThis.fromUuid = prevFrom;
    expect(created).toHaveLength(1);
    const [type, docs] = created[0];
    expect(type).toBe("Item");
    expect(docs).toHaveLength(1);
    expect(docs[0].effects).toBeUndefined();
    expect(docs[0].flags[NS].mechanics).toBeUndefined();
    expect(docs[0].system.targets).toEqual([target]);
    expect(docs[0].flags[NS][INSPIRED_WRATH_FLAG]).toEqual({ sourceUuid: "Actor.me", sourceName: "Игрок" });
  });
});

describe("приёмы действительно ходят через релей к чужой цели", () => {
  let prev;
  const emitted = [];
  beforeEach(() => {
    resetCaptured(); emitted.length = 0;
    prev = { socket: globalThis.game.socket, users: globalThis.game.users, user: globalThis.game.user, settings: globalThis.game.settings };
    globalThis.game.socket = { emit: (_c, payload) => emitted.push(payload) };
    globalThis.game.users = { activeGM: { id: "gm" } };
    globalThis.game.user = { id: "u1", isGM: false };
    globalThis.game.settings = { get: () => "roll" };
    globalThis.fromUuidSync = () => null;
  });
  afterEach(() => { Object.assign(globalThis.game, prev); });

  function fighter(name, uuid, isOwner) {
    const flags = {}, updates = [];
    return {
      id: uuid, uuid, name, isOwner, items: [], updates, _flags: flags,
      system: { size: 3, conditions: {}, characteristics: {}, meleeStance: "standard", fatigue: { value: 0 } },
      getFlag: (_s, k) => flags[k],
      setFlag: async (_s, k, v) => { flags[k] = v; },
      unsetFlag: async (_s, k) => { delete flags[k]; },
      update: async d => { updates.push(d); }
    };
  }

  it("Захват чужого NPC: игрок пишет себя, цель получает запрос ГМу", async () => {
    const me = fighter("Игрок", "Actor.me", true), foe = fighter("NPC", "Actor.foe", false);
    await resolveGrappleSuccess(me, { target: foe, margin: 1, deg: 1 });
    expect(foe.updates).toEqual([]);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].targetUuid).toBe("Actor.foe");
    expect(emitted[0].op.data["system.conditions.grappling"]).toBe(true);
    expect(emitted[0].op.data[`flags.${NS}.${PARTNER_FLAG}`]).toBe("Actor.me");
    expect(me.updates).toHaveLength(1);
    expect(checkTargetWrite(emitted[0].op, { initiatorOwned: true }).ok).toBe(true);
  });

  it("Захват чужого NPC без ГМа в игре: игрок в Захват в одиночку НЕ попадает", async () => {
    globalThis.game.users = { activeGM: null };
    const me = fighter("Игрок", "Actor.me", true), foe = fighter("NPC", "Actor.foe", false);
    await resolveGrappleSuccess(me, { target: foe, margin: 1, deg: 1 });
    expect(me.updates).toEqual([]);
    expect(emitted).toEqual([]);
  });

  it("Повалить чужого NPC уходит ГМу как Состояние «Ничком»", async () => {
    const me = fighter("Игрок", "Actor.me", true), foe = fighter("NPC", "Actor.foe", false);
    await resolveKnockdownSuccess(me, { deg: 1, target: foe });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].op.data["system.conditions.prone"]).toBe(true);
    expect(foe.updates).toEqual([]);
  });

  // Пинок с Разворота и Напролом писали «Ничком» прямо в цель: у игрока — «lacks permission», и карточки не было.
  it("Пинок с Разворота по чужому NPC: «Ничком» уходит ГМу, карточка с дальностью есть", async () => {
    const me = fighter("Игрок", "Actor.me", true), foe = fighter("NPC", "Actor.foe", false);
    me.system.characteristics = { s: { bonus: 4 } };
    foe.update = async () => { throw new Error("lacks permission"); };
    await resolveRoundhouseSuccess(me, { deg: 3, target: foe });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].op.data["system.conditions.prone"]).toBe(true);
    expect(checkTargetWrite(emitted[0].op, { initiatorOwned: true }).ok).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Пинок с Разворота");
  });

  it("Напролом на 5+ по чужому NPC: «Ничком» уходит ГМу, карточка есть", async () => {
    const me = fighter("Игрок", "Actor.me", true), foe = fighter("NPC", "Actor.foe", false);
    foe.update = async () => { throw new Error("lacks permission"); };
    await resolveBulldozeSuccess(me, { deg: 5, target: foe });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].op.data["system.conditions.prone"]).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Напролом");
  });

  it("Жокей: метка на чужой цели — запрос ГМу, на себя — сразу", async () => {
    const me = fighter("Жокей", "Actor.me", true), foe = fighter("Великан", "Actor.foe", false);
    await resolveJockeySuccess(me, { target: foe });
    expect(me._flags[JOCKEY_RIDING_FLAG]).toBe("Actor.foe");
    expect(emitted[0].op.data[`flags.${NS}.${JOCKEY_MOUNTED_FLAG}`]).toBe("Actor.me");
  });

  it("Жокей без ГМа: наездник не повисает на цели, которой метку не поставить", async () => {
    globalThis.game.users = { activeGM: null };
    const me = fighter("Жокей", "Actor.me", true), foe = fighter("Великан", "Actor.foe", false);
    await resolveJockeySuccess(me, { target: foe });
    expect(me._flags[JOCKEY_RIDING_FLAG]).toBeUndefined();
  });

  it("Удушение чужого NPC: Усталость уходит ГМу", async () => {
    const me = fighter("Игрок", "Actor.me", true), foe = fighter("NPC", "Actor.foe", false);
    await applyChokehold(me, foe, 2, "Сжать");
    expect(emitted).toHaveLength(1);
    expect(emitted[0].op).toEqual({ kind: "addFatigue", amount: 2 });
  });

  it("конец Захвата снимает метки с чужого партнёра через ГМа", async () => {
    const me = fighter("Игрок", "Actor.me", true), foe = fighter("NPC", "Actor.foe", false);
    me._flags[PARTNER_FLAG] = "Actor.foe";
    globalThis.fromUuidSync = uuid => (uuid === "Actor.foe" ? foe : null);
    await endGrapple(me);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].op.data["system.conditions.grappling"]).toBe(false);
    expect(checkTargetWrite(emitted[0].op, { initiatorOwned: true }).ok).toBe(true);
  });
});

describe("performTargetWrite", () => {
  it("неизвестный вид ничего не делает", async () => {
    expect(await performTargetWrite({ update: () => { throw new Error("не должно быть вызвано"); } }, { kind: "?" })).toBeNull();
  });
});

// Урон приёмов по чужому NPC (Sahara npc-applydamagetoactor): Заломить, Укус, Хруст, Повалить на 5+ раньше писали урон
// в цель прямо с клиента игрока и падали на правах Foundry. Теперь урон считает и применяет ГМ — kind "applyDamage".
describe("applyDamage: урон приёма через ГМа", () => {
  const dmg = (over = {}) => ({
    rawDamage: 9, penetration: 0, damageType: "impact", damageSubtype: "crushing", ignoreArmour: true,
    hitLocation: "Торс", melee: true, attackerName: "Игрок", attackerUuid: "Actor.me", weaponName: "Заломить", ...over
  });
  const own = { initiatorOwned: true, initiator: { uuid: "Actor.me", items: [] }, partners: true };

  it("допустимый урон Борьбы от владельца инициатора — можно", () => {
    expect(checkTargetWrite({ kind: "applyDamage", source: "grapple", damage: dmg() }, own).ok).toBe(true);
    expect(checkTargetWrite({ kind: "applyDamage", source: "contact", damage: dmg({ primitive: true, ignoreArmour: false, weaponName: "Повалить" }) },
      { ...own, partners: false }).ok).toBe(true);
  });

  it("не владелец инициатора — отказ", () => {
    expect(checkTargetWrite({ kind: "applyDamage", source: "grapple", damage: dmg() }, { ...own, initiatorOwned: false }).ok).toBe(false);
  });

  it("источник «grapple» требует, чтобы цель была партнёром инициатора по Борьбе", () => {
    expect(checkTargetWrite({ kind: "applyDamage", source: "grapple", damage: dmg() }, { ...own, partners: false }).ok).toBe(false);
  });

  it("чужие поля, неверные типы, чужой атакующий и непомерные числа — отказ", () => {
    for (const bad of [
      dmg({ evil: 1 }), dmg({ rawDamage: "9" }), dmg({ rawDamage: -1 }), dmg({ rawDamage: 5000 }), dmg({ penetration: 99 }),
      dmg({ damageType: "godmode" }), dmg({ melee: false }), dmg({ attackerUuid: "Actor.other" }),
      dmg({ weaponName: "я".repeat(300) }), dmg({ ignoreDomeShields: true }), dmg({ rawDamage: NaN })
    ]) expect(checkTargetWrite({ kind: "applyDamage", source: "grapple", damage: bad }, own).ok).toBe(false);
    expect(checkTargetWrite({ kind: "applyDamage", source: "grapple", damage: null }, own).ok).toBe(false);
    expect(checkTargetWrite({ kind: "applyDamage", source: "nowhere", damage: dmg() }, own).ok).toBe(false);
    // «contact» не игнорирует броню, не пробивает и не бьёт выше потолка Повалить
    const contact = d => checkTargetWrite({ kind: "applyDamage", source: "contact", damage: d }, { ...own, partners: false }).ok;
    expect(contact(dmg({ ignoreArmour: true }))).toBe(false);
    expect(contact(dmg({ ignoreArmour: false, penetration: 3 }))).toBe(false);
    expect(contact(dmg({ ignoreArmour: false, rawDamage: 26 }))).toBe(false);
    expect(contact(dmg({ ignoreArmour: false, rawDamage: 25, primitive: true }))).toBe(true);
  });

  it("выстраивание: приёмы идут через dealDamageToTarget, а не прямо в applyDamageToActor", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const read = rel => fs.readFileSync(path.join(path.resolve(import.meta.dirname, "../.."), rel), "utf8");
    const g = read("module/combat/grapple.mjs");
    expect(g).not.toMatch(/applyDamageToActor\(partner/);
    expect((g.match(/dealDamageToTarget\(partner/g) ?? []).length).toBe(4);
    const k = read("module/combat/knockdown.mjs");
    expect(k).not.toMatch(/applyDamageToActor\(target/);
    expect(k).toMatch(/dealDamageToTarget\(target/);
  });

  it("чужая цель: игрок отправляет запрос ГМу, локально урон не считается", async () => {
    const emitted = [];
    const prev = { socket: globalThis.game.socket, users: globalThis.game.users, user: globalThis.game.user };
    globalThis.game.socket = { emit: (_c, payload) => emitted.push(payload) };
    globalThis.game.users = { activeGM: { id: "gm" } };
    globalThis.game.user = { id: "u1", isGM: false };
    try {
      const { dealDamageToTarget } = await import("../../module/combat/gm-relay.mjs");
      const foe = { uuid: "Actor.foe", name: "NPC", isOwner: false, update: async () => { throw new Error("писать нельзя"); } };
      expect(await dealDamageToTarget(foe, dmg(), ME, "grapple")).toBe(true);
      expect(emitted).toHaveLength(1);
      expect(emitted[0].op).toEqual({ kind: "applyDamage", source: "grapple", damage: dmg() });
      expect(emitted[0].targetUuid).toBe("Actor.foe");
    } finally { Object.assign(globalThis.game, prev); }
  });
});
