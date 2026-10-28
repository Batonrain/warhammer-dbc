// test/combat/pin-down.test.mjs
//
// Pin Down / Прижать (Пугилист, стр. 62; Sahara 3-eddb): держа врага в Борьбе
// 2+ руками, раз в Ход за свободное действие — Сжать; цель получает штраф на
// физические действия (<T.b + Размер×3 персонажа> − <T.b + Размер×3 цели>) × 5
// (минимум 0), а атаки по самому персонажу не получают +20 за Борьбу.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { _doPinDown, _resolveTakeoverSuccess, GRAPPLE_HANDS_FLAG } from "../../module/combat/grapple.mjs";
import { pinDownPenaltyValue, pinDownHoldOf, PIN_DOWN_FLAG } from "../../module/rules/pugilist-talents.mjs";
import { situationalRules } from "../../module/rules/situational.mjs";
import { TURN_SCOPED_FLAG_KEYS, turnStartFlagClears } from "../../module/rules/turn-flags.mjs";

const PIN = { id: "pd", name: "Pin Down / Прижать", type: "talent", system: {} };
const NS = "warhammer-dbc";

function wrestler(name, uuid, { tb = 4, size = 4, items = [], grappling = true } = {}) {
  const flags = {};
  const a = actorFor({ items, size, conditions: { grappling },
    characteristics: { t: { total: tb * 10, bonus: tb }, s: { total: 40, bonus: 4 } } });
  a.name = name; a.uuid = uuid; a.id = uuid;
  a.getFlag = (_s, k) => flags[k];
  a.setFlag = async (_s, k, v) => { flags[k] = v; };
  a.unsetFlag = async (_s, k) => { delete flags[k]; };
  // Запись в партнёра идёт общим update по путям flags.* (combat/gm-relay.mjs::writeToTarget) — как у настоящего документа.
  a.update = async changes => {
    for (const [p, v] of Object.entries(changes)) {
      let m = p.match(/^flags\.[^.]+\.-=(.+)$/);
      if (m) { delete flags[m[1]]; continue; }
      m = p.match(/^flags\.[^.]+\.(.+)$/);
      if (m) flags[m[1]] = v;
    }
  };
  a._flags = flags;
  return a;
}

beforeEach(() => resetCaptured());

describe("pinDownPenaltyValue: (масса персонажа − масса цели) × 5, минимум 0", () => {
  it("T.b 5 Размер 4 против T.b 3 Размер 3: (5+12) − (3+9) = 5 → 25", () => {
    expect(pinDownPenaltyValue(wrestler("а", "A", { tb: 5, size: 4 }), wrestler("б", "B", { tb: 3, size: 3 }))).toBe(25);
  });
  it("цель тяжелее — 0, не отрицательный", () => {
    expect(pinDownPenaltyValue(wrestler("а", "A", { tb: 3, size: 3 }), wrestler("б", "B", { tb: 5, size: 5 }))).toBe(0);
  });
});

describe("_doPinDown", () => {
  function pair({ hands = 2, talent = true, tb = 5, size = 4 } = {}) {
    const me = wrestler("Прижимающий", "Actor.me", { tb, size, items: talent ? [PIN] : [] });
    const foe = wrestler("Жертва", "Actor.foe", { tb: 3, size: 3 });
    me._flags[GRAPPLE_HANDS_FLAG] = hands;
    me._flags.grapplePartnerUuid = foe.uuid;
    globalThis.fromUuidSync = uuid => (uuid === foe.uuid ? foe : uuid === me.uuid ? me : null);
    return { me, foe };
  }

  it("2 руки: метка на прижимающем, Сжатие +1 на цели, карточка со штрафом", async () => {
    const { me, foe } = pair();
    await _doPinDown(me);
    expect(me.getFlag(NS, PIN_DOWN_FLAG)).toBe(25);
    expect(foe.getFlag(NS, "grappleSqueezePending")).toBe(1);
    expect(captured.chat.at(-1).content).toContain("−25");
  });

  it("одной рукой нельзя", async () => {
    const { me } = pair({ hands: 1 });
    await _doPinDown(me);
    expect(pinDownHoldOf(me)).toBeUndefined();
    expect(captured.warnings.some(w => w.includes("2 руками"))).toBe(true);
  });

  it("раз в Ход: повтор отклонён, метка и счётчик не растут", async () => {
    const { me, foe } = pair();
    await _doPinDown(me);
    await _doPinDown(me);
    expect(foe.getFlag(NS, "grappleSqueezePending")).toBe(1);
    expect(captured.warnings.some(w => w.includes("раз в Ход"))).toBe(true);
  });

  it("штраф 0 всё равно ставит метку (атаки по прижимающему без +20; повтор запрещён)", async () => {
    const { me } = pair({ tb: 1, size: 1 });
    await _doPinDown(me);
    expect(pinDownHoldOf(me)).toBe(0);
  });

  it("без Таланта ничего не делает", async () => {
    const { me, foe } = pair({ talent: false });
    await _doPinDown(me);
    expect(pinDownHoldOf(me)).toBeUndefined();
    expect(foe.getFlag(NS, "grappleSqueezePending")).toBeUndefined();
  });
});

describe("штраф цели в situationalRules; сброс метки Хода", () => {
  it("цель прижата: −25 на атаку и на Атлетику; на не-физические (Эрудиция) не действует", () => {
    const me = wrestler("Прижимающий", "Actor.me");
    const foe = wrestler("Жертва", "Actor.foe");
    me._flags[PIN_DOWN_FLAG] = 25;
    foe._flags.grapplePartnerUuid = me.uuid;
    globalThis.fromUuidSync = uuid => (uuid === me.uuid ? me : null);
    const find = ctx => situationalRules(foe, ctx).find(r => r.id === "situational.pinDown");
    expect(find({ kind: "attack" })?.effects[0].value).toBe(-25);
    expect(find({ kind: "skill", skill: "athletics" })?.effects[0].value).toBe(-25);
    expect(find({ kind: "skill", skill: "lore" })).toBeUndefined();
  });

  it("без прижимающего или с нулевым штрафом правила нет", () => {
    const foe = wrestler("Жертва", "Actor.foe");
    foe._flags.grapplePartnerUuid = "Actor.me";
    globalThis.fromUuidSync = () => null;
    expect(situationalRules(foe, { kind: "attack" }).find(r => r.id === "situational.pinDown")).toBeUndefined();
  });

  it("метка снимается в начале Хода прижимающего (в реестре Ход-флагов)", () => {
    expect(TURN_SCOPED_FLAG_KEYS).toContain(PIN_DOWN_FLAG);
  });

  it("нулевая метка (штраф 0) тоже снимается в начале Хода — иначе «раз в Ход» висит до конца Захвата", () => {
    const me = wrestler("Прижимающий", "Actor.me");
    me._flags[PIN_DOWN_FLAG] = 0;
    expect(turnStartFlagClears(me)).toEqual({ [`flags.${NS}.-=${PIN_DOWN_FLAG}`]: null });
  });

  it("Перехватить Контроль: бывший прижимающий больше не держит — метка с него снимается", async () => {
    const me = wrestler("Прижимающий", "Actor.me");
    const foe = wrestler("Жертва", "Actor.foe");
    me._flags[PIN_DOWN_FLAG] = 0;
    me._flags.grapplePartnerUuid = foe.uuid;
    foe._flags.grapplePartnerUuid = me.uuid;
    globalThis.fromUuidSync = uuid => (uuid === foe.uuid ? foe : uuid === me.uuid ? me : null);
    await _resolveTakeoverSuccess(foe);
    expect(me._flags.grappleRole).toBe("target");
    expect(pinDownHoldOf(me)).toBeUndefined();
  });
});
