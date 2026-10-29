// test/combat/hamstring.test.mjs
//
// Hamstring / Подрезать Сухожилья (Рукопашные, Sahara 3-8dc5): Избирательная
// рукопашная атака в Ногу с непоглощённым уроном → кнопка встречного теста A+0 vs
// A+0; победа — Повален, 5+ Успехов — долг полудействия на цели (через ГМ-релей).
// Не работает с Быстрой/Молниеносной Атакой. Раз в Ход (Раунд).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { resolveHamstringSuccess, HAMSTRING_CONTEST } from "../../module/combat/hamstring.mjs";
import { checkTargetWrite, performTargetWrite } from "../../module/combat/gm-relay.mjs";
import { DEVOURER_OF_TIME_AP_DEBT_FLAG } from "../../module/combat/devourer-of-time.mjs";
import { markCapabilityUsed } from "../../module/rules/cooldown.mjs";
import { hamstringArmed, hamstringOffered, HAMSTRING_ROUND_FLAG } from "../../module/rules/melee-talents.mjs";

const ch = total => ({ total, bonus: Math.floor(total / 10) });
const talentItem = name => ({ type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });
const HAMSTRING = "Hamstring / Подрезать Сухожилья";

function person({ talents = [], name = "Персонаж", uuid = "Actor.p1", conditions = {}, isOwner = true } = {}) {
  const store = {};
  const list = [...talents.map(talentItem)];
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
      for (const [p, value] of Object.entries(data)) {
        const m = p.match(/^flags\.([^.]+)\.(.+)$/);
        if (m) { store[`${m[1]}.${m[2]}`] = value; continue; }
        const keys = p.split(".").slice(1);
        let node = this.system;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    },
    async updateEmbeddedDocuments() { return []; }
  };
}

const legHit = (over = {}) => ({
  rawDamage: 12, penetration: 0, damageType: "rending", hitLocation: "Левая Нога",
  attackerName: "Атакующий", weaponName: "Меч", melee: true, hamstring: true, attackerUuid: "Actor.atk", ...over
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

describe("встречный тест", () => {
  it("встречный тест — A vs A, одна характеристика", () => {
    expect(HAMSTRING_CONTEST.defaultChar).toBe("ag");
    expect(HAMSTRING_CONTEST.allowedChars).toEqual(["ag"]);
  });
});

describe("hamstringArmed: что включает метку на атаке", () => {
  const talented = person({ talents: [HAMSTRING] });
  const base = { isMelee: true, hit: true, aimValue: "leg", technique: "standard" };
  it("Избирательная в Ногу рукопашной с Талантом — да", () => {
    expect(hamstringArmed(talented, base)).toBe(true);
  });
  it("без Таланта — нет", () => { expect(hamstringArmed(person(), base)).toBe(false); });
  it("не в Ногу (рука/голова/не Избирательная) — нет", () => {
    for (const aimValue of ["arm", "head", "", undefined]) expect(hamstringArmed(talented, { ...base, aimValue })).toBe(false);
  });
  it("Быстрая и Молниеносная Атака — нет", () => {
    expect(hamstringArmed(talented, { ...base, technique: "swift" })).toBe(false);
    expect(hamstringArmed(talented, { ...base, technique: "lightning" })).toBe(false);
  });
  it("стрелковая атака и промах — нет", () => {
    expect(hamstringArmed(talented, { ...base, isMelee: false })).toBe(false);
    expect(hamstringArmed(talented, { ...base, hit: false })).toBe(false);
  });
});

describe("hamstringOffered: кнопка при уроне", () => {
  const a = person({ talents: [HAMSTRING] });
  const ok = { armed: true, net: 4, targetProne: false, roundAvailable: true };
  it("всё сошлось — да", () => { expect(hamstringOffered(a, ok)).toBe(true); });
  it("урон поглощён (0) — нет", () => { expect(hamstringOffered(a, { ...ok, net: 0 })).toBe(false); });
  it("цель уже Ничком — нет", () => { expect(hamstringOffered(a, { ...ok, targetProne: true })).toBe(false); });
  it("Раунд израсходован — нет", () => { expect(hamstringOffered(a, { ...ok, roundAvailable: false })).toBe(false); });
  it("метки на атаке не было — нет", () => { expect(hamstringOffered(a, { ...ok, armed: false })).toBe(false); });
});

describe("Кнопка в карточке урона", () => {
  it("метка + Талант + непоглощённый урон → кнопка с uuid обеих сторон", async () => {
    registry["Actor.atk"] = person({ talents: [HAMSTRING], uuid: "Actor.atk", name: "Атакующий" });
    const target = person({ uuid: "Actor.vic", name: "Жертва" });
    await applyDamageToActor(target, legHit());
    const html = chatText();
    expect(html).toContain("wh-hamstring-btn");
    expect(html).toContain('data-attacker-uuid="Actor.atk"');
    expect(html).toContain('data-target-uuid="Actor.vic"');
  });
  it("без метки атаки (не Избирательная/не в Ногу) — кнопки нет", async () => {
    registry["Actor.atk"] = person({ talents: [HAMSTRING], uuid: "Actor.atk" });
    await applyDamageToActor(person({ uuid: "Actor.vic" }), legHit({ hamstring: false }));
    expect(chatText()).not.toContain("wh-hamstring-btn");
  });
  it("у атакующего нет Таланта — кнопки нет", async () => {
    registry["Actor.atk"] = person({ uuid: "Actor.atk" });
    await applyDamageToActor(person({ uuid: "Actor.vic" }), legHit());
    expect(chatText()).not.toContain("wh-hamstring-btn");
  });
  it("урон поглощён полностью — кнопки нет", async () => {
    registry["Actor.atk"] = person({ talents: [HAMSTRING], uuid: "Actor.atk" });
    const t = person({ uuid: "Actor.vic" });
    t.system.absorption.toughnessBonus = 50; t.system.absorption.leftLeg = 50;
    await applyDamageToActor(t, legHit({ rawDamage: 3 }));
    expect(chatText()).not.toContain("wh-hamstring-btn");
  });
  it("цель уже Ничком — кнопки нет", async () => {
    registry["Actor.atk"] = person({ talents: [HAMSTRING], uuid: "Actor.atk" });
    await applyDamageToActor(person({ uuid: "Actor.vic", conditions: { prone: true } }), legHit());
    expect(chatText()).not.toContain("wh-hamstring-btn");
  });
  it("раз в Раунд: после использования в этом Раунде кнопки нет", async () => {
    globalThis.game.combat = { started: true, round: 3, id: "c1" };
    const atk = person({ talents: [HAMSTRING], uuid: "Actor.atk" });
    registry["Actor.atk"] = atk;
    await markCapabilityUsed(atk, HAMSTRING_ROUND_FLAG, "round");
    await applyDamageToActor(person({ uuid: "Actor.vic" }), legHit());
    expect(chatText()).not.toContain("wh-hamstring-btn");
  });
});

describe("Победа во встречном тесте", () => {
  it("Успех — цель Ничком, долга полудействия нет", async () => {
    const atk = person({ talents: [HAMSTRING], uuid: "Actor.atk" });
    const target = person({ uuid: "Actor.vic", name: "Жертва" });
    await resolveHamstringSuccess(atk, { deg: 2, target });
    expect(target.system.conditions.prone).toBe(true);
    expect(target.getFlag("warhammer-dbc", DEVOURER_OF_TIME_AP_DEBT_FLAG)).toBeUndefined();
  });
  it("4 Успеха — ещё без долга; 5 Успехов — долг 1 ОД", async () => {
    const atk = person({ talents: [HAMSTRING], uuid: "Actor.atk" });
    const t4 = person({ uuid: "Actor.v4" });
    await resolveHamstringSuccess(atk, { deg: 4, target: t4 });
    expect(t4.getFlag("warhammer-dbc", DEVOURER_OF_TIME_AP_DEBT_FLAG)).toBeUndefined();
    const t5 = person({ uuid: "Actor.v5" });
    await resolveHamstringSuccess(atk, { deg: 5, target: t5 });
    expect(t5.system.conditions.prone).toBe(true);
    expect(t5.getFlag("warhammer-dbc", DEVOURER_OF_TIME_AP_DEBT_FLAG)).toBe(1);
  });
  it("долг складывается с уже висящим (Пожиратель Времени)", async () => {
    const atk = person({ talents: [HAMSTRING], uuid: "Actor.atk" });
    const t = person({ uuid: "Actor.v" });
    await t.setFlag("warhammer-dbc", DEVOURER_OF_TIME_AP_DEBT_FLAG, 1);
    await resolveHamstringSuccess(atk, { deg: 6, target: t });
    expect(t.getFlag("warhammer-dbc", DEVOURER_OF_TIME_AP_DEBT_FLAG)).toBe(2);
  });
});

describe("ГМ-релей: запись apDebt", () => {
  const ctx = { initiatorOwned: true, initiator: person({ talents: [HAMSTRING] }) };
  it("с Талантом у инициатора и без полезной нагрузки — допустима", () => {
    expect(checkTargetWrite({ kind: "apDebt" }, ctx)).toEqual({ ok: true });
  });
  it("без Таланта — отказ", () => {
    expect(checkTargetWrite({ kind: "apDebt" }, { initiatorOwned: true, initiator: person() }).ok).toBe(false);
  });
  it("лишнее поле (клиент пытается задать число) — отказ", () => {
    expect(checkTargetWrite({ kind: "apDebt", amount: 99 }, ctx).ok).toBe(false);
  });
  it("просящий не владеет инициатором — отказ", () => {
    expect(checkTargetWrite({ kind: "apDebt" }, { ...ctx, initiatorOwned: false }).ok).toBe(false);
  });
  it("исполнение прибавляет ровно 1", async () => {
    const t = person({ uuid: "Actor.v" });
    await performTargetWrite(t, { kind: "apDebt" });
    await performTargetWrite(t, { kind: "apDebt" });
    expect(t.getFlag("warhammer-dbc", DEVOURER_OF_TIME_AP_DEBT_FLAG)).toBe(2);
  });
});
