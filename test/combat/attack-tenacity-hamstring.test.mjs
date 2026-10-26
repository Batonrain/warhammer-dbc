// test/combat/attack-tenacity-hamstring.test.mjs
//
// Упорство и Подрезать Сухожилья (Рукопашные, Sahara 3-8dc5) на уровне карточки атаки:
// кнопка повтора (Упорство) и метка data-hamstring (Подрезать Сухожилья). Условия
// кнопок — чистые функции rules/melee-talents.mjs; метка урона — combat/damage.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { tenacityOffered, tenacityAvailable, tenacityNeedsConfirm, MELEE_DAMAGE_DEALT_FLAG, MELEE_DAMAGE_APPLIED_FLAG } from "../../module/rules/melee-talents.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";
import { TENACITY_CARD_FLAG, confirmTenacityRepeat } from "../../module/combat/tenacity.mjs";
import { TURN_SCOPED_FLAG_KEYS } from "../../module/rules/turn-flags.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const TENACITY = { key: "meleeCore.core.tenacity", name: "Tenacity / Упорство" };
const HAMSTRING = { key: "meleeCore.core.hamstring", name: "Hamstring / Подрезать Сухожилья" };

beforeEach(() => { resetCaptured(); setTargets([]); });

/** actorFlags — значения getFlag актора (attackActionsThisTurn и т.п.). */
async function swing(items, { roll = 20, aim = null, opts = {}, actorFlags = {} } = {}) {
  const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });
  w.uuid = "Item.sword";
  const actor = actorFor({ items: [w, ...items],
    characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) } });
  actor.uuid = "Actor.fighter";
  actor.getFlag = (scope, key) => actorFlags[key];
  captured.dice = [roll, 5, 5, 5, 5, 5];
  await _executeAttackRoll(actor, w, "ws", 45, "melee", aim, { baseKey: "standard", ...opts });
}

describe("данные пака", () => {
  it("Упорство несёт запись Конструктора с ключом возможности", () => {
    const doc = packDocById("packs-src/talents/Рукопашные", "QMoBdgPHVGHNyuS7");
    const keys = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain(TENACITY.key);
  });
  it("служебные ключи зарегистрированы", () => {
    expect(CARD_ONCE_FLAGS).toContain(TENACITY_CARD_FLAG);
    expect(TURN_SCOPED_FLAG_KEYS).toContain(MELEE_DAMAGE_DEALT_FLAG);
  });
});

describe("Упорство: кнопка на карточке рукопашной атаки", () => {
  it("единственная одиночная атака (счётчик 1), даже при промахе — кнопка с оружием, Базой и Приёмом", async () => {
    await swing([byKey(TENACITY.key)], { roll: 90, actorFlags: { attackActionsThisTurn: 1 },
      opts: { techniqueOpts: { technique: "thrust" } } });
    expect(card()).toContain("wh-tenacity-btn");
    expect(card()).toContain('data-attacker-uuid="Actor.fighter"');
    expect(card()).toContain('data-weapon-uuid="Item.sword"');
    expect(card()).toContain('data-base="standard"');
    expect(card()).toContain('data-technique="thrust"');
  });
  it("по имени (Талант без записи Конструктора) — то же", async () => {
    await swing([byName(TENACITY.name)], { actorFlags: { attackActionsThisTurn: 1 } });
    expect(card()).toContain("wh-tenacity-btn");
  });
  it("вторая атака Хода — кнопки нет", async () => {
    await swing([byKey(TENACITY.key)], { actorFlags: { attackActionsThisTurn: 2 } });
    expect(card()).not.toContain("wh-tenacity-btn");
  });
  it("Быстрая Атака (не одиночная) — кнопки нет", async () => {
    await swing([byKey(TENACITY.key)], { actorFlags: { attackActionsThisTurn: 1 }, opts: { isSwift: true } });
    expect(card()).not.toContain("wh-tenacity-btn");
  });
  it("пара Обеих Рук — кнопки нет", async () => {
    await swing([byKey(TENACITY.key)], { actorFlags: { attackActionsThisTurn: 1 }, opts: { isDual: true } });
    expect(card()).not.toContain("wh-tenacity-btn");
  });
  it("вторая атака Сабли и вторая рука пары — кнопки нет", async () => {
    await swing([byKey(TENACITY.key)], { actorFlags: { attackActionsThisTurn: 1 }, opts: { sabreSecondAttackIsSecond: true } });
    expect(card()).not.toContain("wh-tenacity-btn");
  });
  it("сам повтор Упорства нового повтора не порождает", async () => {
    await swing([byKey(TENACITY.key)], { actorFlags: { attackActionsThisTurn: 1 }, opts: { techniqueOpts: { tenacityRepeat: true } } });
    expect(card()).not.toContain("wh-tenacity-btn");
  });
  it("без Таланта — кнопки нет", async () => {
    await swing([], { actorFlags: { attackActionsThisTurn: 1 } });
    expect(card()).not.toContain("wh-tenacity-btn");
  });
});

describe("Упорство: чистые условия", () => {
  const a = actorFor({ items: [byKey(TENACITY.key)] });
  it("tenacityAvailable: урон уже нанесён или атак больше одной — закрыто", () => {
    expect(tenacityAvailable(a, { attacksThisTurn: 1, damageDealt: false })).toBe(true);
    expect(tenacityAvailable(a, { attacksThisTurn: 1, damageDealt: true })).toBe(false);
    expect(tenacityAvailable(a, { attacksThisTurn: 2, damageDealt: false })).toBe(false);
    expect(tenacityAvailable(actorFor({}), { attacksThisTurn: 1, damageDealt: false })).toBe(false);
  });
  it("tenacityOffered: нужна рукопашная и Талант", () => {
    const ok = { isMelee: true, technique: "standard", dual: false, attacksThisTurn: 1, tenacityChild: false };
    expect(tenacityOffered(a, ok)).toBe(true);
    expect(tenacityOffered(a, { ...ok, isMelee: false })).toBe(false);
    expect(tenacityOffered(a, { ...ok, technique: "lightning" })).toBe(false);
  });
});

describe("Упорство: метка «нанесла урон» при применении урона", () => {
  let registry; let prevFromUuid;
  beforeEach(() => { registry = {}; prevFromUuid = globalThis.fromUuid; globalThis.fromUuid = async u => registry[u] ?? null; });
  afterEach(() => { globalThis.fromUuid = prevFromUuid; });
  const victim = () => {
    const ch = total => ({ total, bonus: Math.floor(total / 10) });
    const store = {};
    return {
      id: "v", name: "Жертва", type: "character", uuid: "Actor.v", isOwner: true,
      system: {
        absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
        characteristics: { s: ch(50), t: ch(40), wp: ch(40), ag: ch(40), int: ch(40) },
        wounds: { value: 20, critical: 0, max: 20 }, fate: { value: 2 }, cover: { ap: 0 },
        armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
        actionPoints: { value: 2, max: 2 }, conditions: {}, fatigue: { value: 0, max: 10 }, patronGod: "", size: 4
      },
      items: Object.assign([], { contents: [], get: () => null }), effects: Object.assign([], { contents: [] }),
      getFlag: (s, k) => store[`${s}.${k}`], setFlag: async (s, k, v) => { store[`${s}.${k}`] = v; },
      getActiveTokens: () => [], async update() {}, async updateEmbeddedDocuments() { return []; }
    };
  };
  const fighter = () => {
    const store = {};
    return {
      id: "f", name: "Боец", type: "character", uuid: "Actor.f",
      items: Object.assign([byKey(TENACITY.key)], { get: () => null }),
      getFlag: (s, k) => store[`${s}.${k}`], setFlag: async (s, k, v) => { store[`${s}.${k}`] = v; }
    };
  };
  it("рукопашный урон прошёл — метка стоит", async () => {
    const f = fighter(); registry["Actor.f"] = f;
    await applyDamageToActor(victim(), { rawDamage: 12, penetration: 0, damageType: "rending", hitLocation: "Торс",
      melee: true, attackerName: "Боец", attackerUuid: "Actor.f" });
    expect(f.getFlag("warhammer-dbc", MELEE_DAMAGE_DEALT_FLAG)).toBe(true);
  });
  it("урон поглощён — метки нет", async () => {
    const f = fighter(); registry["Actor.f"] = f;
    const v = victim(); v.system.absorption.toughnessBonus = 50; v.system.absorption.body = 50;
    await applyDamageToActor(v, { rawDamage: 3, penetration: 0, damageType: "rending", hitLocation: "Торс",
      melee: true, attackerName: "Боец", attackerUuid: "Actor.f" });
    expect(f.getFlag("warhammer-dbc", MELEE_DAMAGE_DEALT_FLAG)).toBeUndefined();
  });
  it("стрелковый урон метку не ставит", async () => {
    const f = fighter(); registry["Actor.f"] = f;
    await applyDamageToActor(victim(), { rawDamage: 12, penetration: 0, damageType: "rending", hitLocation: "Торс",
      melee: false, attackerName: "Боец", attackerUuid: "Actor.f" });
    expect(f.getFlag("warhammer-dbc", MELEE_DAMAGE_DEALT_FLAG)).toBeUndefined();
  });
});

describe("Подрезать Сухожилья: метка на кнопке урона карточки атаки", () => {
  it("Избирательная в Ногу с Талантом — data-hamstring=1", async () => {
    await swing([byKey(HAMSTRING.key)], { aim: { value: "leg", label: "Нога" } });
    expect(card()).toContain('data-hamstring="1"');
  });
  it("не в Ногу — 0", async () => {
    await swing([byKey(HAMSTRING.key)], { aim: { value: "arm", label: "Рука" } });
    expect(card()).toContain('data-hamstring="0"');
  });
  it("Быстрая Атака в Ногу — 0", async () => {
    await swing([byKey(HAMSTRING.key)], { aim: { value: "leg", label: "Нога" }, opts: { isSwift: true } });
    expect(card()).not.toContain('data-hamstring="1"');
  });
  it("без Таланта — 0", async () => {
    await swing([], { aim: { value: "leg", label: "Нога" } });
    expect(card()).not.toContain('data-hamstring="1"');
  });
});

// ── Решение владельца 26.10.2026: подтверждение повтора, пока урон по попавшей атаке не применён ──
describe("Упорство: подтверждение, если урон по попавшей атаке ещё не применён", () => {
  it("чистое условие: попала и урон не применён — спрашивать; промах или урон применён — нет", () => {
    expect(tenacityNeedsConfirm({ hit: true, damageApplied: false })).toBe(true);
    expect(tenacityNeedsConfirm({ hit: true, damageApplied: true })).toBe(false);
    expect(tenacityNeedsConfirm({ hit: false, damageApplied: false })).toBe(false);
  });
  it("кнопка несёт признак попадания: попала — data-hit=1, промах — 0", async () => {
    await swing([byKey(TENACITY.key)], { roll: 10, actorFlags: { attackActionsThisTurn: 1 } });
    expect(card()).toContain('data-hit="1"');
    resetCaptured();
    await swing([byKey(TENACITY.key)], { roll: 90, actorFlags: { attackActionsThisTurn: 1 } });
    expect(card()).toContain('data-hit="0"');
  });
  it("диалог: текст спрашивает про повтор; «Да» — повторять, «Отмена» — нет", async () => {
    captured.confirmAnswer = true;
    expect(await confirmTenacityRepeat({ hit: true, damageApplied: false })).toBe(true);
    expect(captured.dialog.content).toContain("Урон по этой атаке ещё не применён");
    captured.dialog = null; captured.confirmAnswer = false;
    expect(await confirmTenacityRepeat({ hit: true, damageApplied: false })).toBe(false);
    expect(captured.dialog).not.toBeNull();
  });
  it("без условия диалог не открывается и повтор разрешён", async () => {
    captured.dialog = null; captured.confirmAnswer = false;
    expect(await confirmTenacityRepeat({ hit: false, damageApplied: false })).toBe(true);
    expect(await confirmTenacityRepeat({ hit: true, damageApplied: true })).toBe(true);
    expect(captured.dialog).toBeNull();
  });
  it("служебный ключ «урон применён» в реестре Хода", () => {
    expect(TURN_SCOPED_FLAG_KEYS).toContain(MELEE_DAMAGE_APPLIED_FLAG);
  });

  describe("метка «урон по этой карточке применён»", () => {
    let registry; let prevFromUuid;
    beforeEach(() => { registry = {}; prevFromUuid = globalThis.fromUuid; globalThis.fromUuid = async u => registry[u] ?? null; });
    afterEach(() => { globalThis.fromUuid = prevFromUuid; });
    const mk = () => {
      const store = {};
      return {
        id: "v", name: "Жертва", type: "character", uuid: "Actor.v", isOwner: true,
        system: {
          absorption: { head: 0, body: 50, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 50, propFlags: {}, armorOnly: {} },
          characteristics: { s: { total: 50, bonus: 5 }, t: { total: 40, bonus: 4 }, wp: { total: 40, bonus: 4 }, ag: { total: 40, bonus: 4 }, int: { total: 40, bonus: 4 } },
          wounds: { value: 20, critical: 0, max: 20 }, fate: { value: 2 }, cover: { ap: 0 },
          armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
          actionPoints: { value: 2, max: 2 }, conditions: {}, fatigue: { value: 0, max: 10 }, patronGod: "", size: 4
        },
        items: Object.assign([], { contents: [], get: () => null }), effects: Object.assign([], { contents: [] }),
        getFlag: (s, k) => store[`${s}.${k}`], setFlag: async (s, k, v) => { store[`${s}.${k}`] = v; },
        getActiveTokens: () => [], async update() {}, async updateEmbeddedDocuments() { return []; }
      };
    };
    const fighter = () => {
      const store = {};
      return {
        id: "f", name: "Боец", type: "character", uuid: "Actor.f",
        items: Object.assign([byKey(TENACITY.key)], { get: () => null }),
        getFlag: (s, k) => store[`${s}.${k}`], setFlag: async (s, k, v) => { store[`${s}.${k}`] = v; }
      };
    };
    const apply = (f, extra) => { registry["Actor.f"] = f;
      return applyDamageToActor(mk(), { rawDamage: 3, penetration: 0, damageType: "rending", hitLocation: "Торс",
        melee: true, attackerName: "Боец", attackerUuid: "Actor.f", ...extra }); };
    it("урон поглощён целиком — «нанесла урон» не стоит, а «применён» стоит с id карточки", async () => {
      const f = fighter();
      await apply(f, { sourceMessageId: "msg1" });
      expect(f.getFlag("warhammer-dbc", MELEE_DAMAGE_DEALT_FLAG)).toBeUndefined();
      expect(f.getFlag("warhammer-dbc", MELEE_DAMAGE_APPLIED_FLAG)).toBe("msg1");
    });
    it("стрелковый урон или урон без карточки метку не ставит", async () => {
      const f = fighter();
      await apply(f, { sourceMessageId: "msg1", melee: false });
      await apply(f, { sourceMessageId: "" });
      expect(f.getFlag("warhammer-dbc", MELEE_DAMAGE_APPLIED_FLAG)).toBeUndefined();
    });
  });
});
