// test/combat/noise-marine.test.mjs
//
// Шумовой Десантник (Sahara 1-54b9), Foundry-обвязка module/combat/noise-marine.mjs:
//   Боль Это Наслаждение в конвейере урона (damage.mjs); Песнь Отчаянья (тумблер и выбор оружия);
//   Нектар Богов (зависимость от последнего наркотика); Дистиллированная Мука (журнал, доза);
//   ГМ-релей Спой Мне! и Стены Диссонанса (gm-relay.mjs::checkTargetWrite).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import {
  painIsPleasureTurnEnd, clearPainIsPleasure, toggleDirgeOfDespair, dirgeAffects, dirgeActive,
  nectarOfTheGodsOnDose, DIRGE_FLAG, performNoiseMarineWrite, resolveSingForMe
} from "../../module/combat/noise-marine.mjs";
import { knownDrugNames, distilledDoseData, noteDrugTaken } from "../../module/combat/distilled-torment.mjs";
import { checkTargetWrite } from "../../module/combat/gm-relay.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";

const NS = "warhammer-dbc";
const PAIN = "Pain Is Pleasure / Боль Это Наслаждение";
const talent = name => ({ type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });
const rawWeapon = name => ({ type: "weapon", name, system: {}, flags: {}, getFlag: () => undefined });

function hero({ items = [], wounds = 20, fatigue = 0, cor = 4, fate = 2, uuid = "Actor.hero", flags = {} } = {}) {
  const store = { ...flags };
  const list = [...items];
  list.contents = list;
  list.get = id => list.find(i => i.id === id) ?? null;
  const effects = []; effects.contents = effects;
  const a = {
    id: uuid.replace("Actor.", ""), name: "Шумовой", type: "character", uuid, isToken: false, _store: store,
    system: {
      absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
      characteristics: { t: { bonus: 4, total: 40 }, wp: { bonus: 3, total: 30 }, int: { bonus: 5, total: 50 } },
      wounds: { value: wounds, critical: 0, max: 20 }, fatigue: { value: fatigue, max: 8 },
      corruptionBonus: cor, fate: { value: fate, max: 5 }, cover: { ap: 0 }, incomingDamageReduction: 0,
      armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
      actionPoints: { value: 2, max: 2 }, conditions: {}
    },
    items: list, effects,
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, v) => { store[`${scope}.${key}`] = v; },
    unsetFlag: async (scope, key) => { delete store[`${scope}.${key}`]; },
    getActiveTokens: () => [],
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.([^.]+)\.(.+)$/);
        if (m) { store[`${m[1]}.${m[2]}`] = value; continue; }
        const keys = path.split(".").slice(1);
        let node = this.system;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    },
    async deleteEmbeddedDocuments() {}
  };
  return a;
}

const damage = (over = {}) => ({
  rawDamage: 5, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Тестовое оружие", ...over
});

const inCombat = (actor, { current = null } = {}) => {
  const combatant = { actor: current ?? actor };
  globalThis.game.combat = { id: "c1", round: 1, started: true, combatant, combatants: [{ actor }] };
  globalThis.game.combats = [globalThis.game.combat];
};

const realGetProperty = globalThis.foundry.utils.getProperty;
beforeEach(() => {
  resetCaptured();
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
});
afterEach(() => {
  globalThis.foundry.utils.getProperty = realGetProperty;
  globalThis.game.combat = undefined; delete globalThis.game.combats; delete globalThis.fromUuid;
});

describe("Боль Это Наслаждение в конвейере урона", () => {
  it("непоглощённый урон в чужой Ход: −1 Усталости, +10 на все тесты, срок — 1 конец Хода", async () => {
    const a = hero({ items: [talent(PAIN)], fatigue: 2 });
    inCombat(a, { current: { uuid: "Actor.enemy" } });
    await applyDamageToActor(a, damage());
    expect(a.system.fatigue.value).toBe(1);
    expect(a._store[`${NS}.painIsPleasure`]).toEqual({ stacks: 1, ends: 1, combatId: "c1" });
    const mods = resolveTest({ actor: a, kind: "skill", skill: "stealth", char: "ag" }).autoMods;
    expect(mods.filter(m => m.value === 10)).toHaveLength(1);
    expect(captured.chat.at(-1).content).toContain("Боль Это Наслаждение");
  });

  it("в свой Ход срок — 2 конца Хода; копится до +30 и дальше не растёт", async () => {
    const a = hero({ items: [talent(PAIN)], wounds: 40 });
    a.system.wounds.max = 40;
    inCombat(a);
    for (let i = 0; i < 4; i++) await applyDamageToActor(a, damage());
    expect(a._store[`${NS}.painIsPleasure`]).toEqual({ stacks: 3, ends: 2, combatId: "c1" });
    const mods = resolveTest({ actor: a, kind: "skill", skill: "stealth", char: "ag" }).autoMods;
    expect(mods.map(m => m.value)).toContain(30);
  });

  it("конец Хода убавляет, второй снимает; конец боя снимает всё", async () => {
    const a = hero({ items: [talent(PAIN)] });
    inCombat(a);
    await applyDamageToActor(a, damage());
    await painIsPleasureTurnEnd(a);
    expect(a._store[`${NS}.painIsPleasure`]?.ends).toBe(1);
    await painIsPleasureTurnEnd(a);
    expect(a._store[`${NS}.painIsPleasure`]).toBeUndefined();
    await applyDamageToActor(a, damage());
    await clearPainIsPleasure(globalThis.game.combat);
    expect(a._store[`${NS}.painIsPleasure`]).toBeUndefined();
  });

  it("урон поглощён целиком — ни Усталости, ни бонуса", async () => {
    const a = hero({ items: [talent(PAIN)], fatigue: 2 });
    a.system.absorption.body = 20;
    inCombat(a);
    await applyDamageToActor(a, damage());
    expect(a.system.fatigue.value).toBe(2);
    expect(a._store[`${NS}.painIsPleasure`]).toBeUndefined();
  });

  it("вне боя Усталость снимается, бонуса к тестам нет; без Таланта — ничего", async () => {
    const a = hero({ items: [talent(PAIN)], fatigue: 1 });
    await applyDamageToActor(a, damage());
    expect(a.system.fatigue.value).toBe(0);
    expect(a._store[`${NS}.painIsPleasure`]).toBeUndefined();
    const plain = hero({ fatigue: 1 });
    inCombat(plain);
    await applyDamageToActor(plain, damage());
    expect(plain.system.fatigue.value).toBe(1);
    expect(plain._store[`${NS}.painIsPleasure`]).toBeUndefined();
  });
});

describe("Песнь Отчаянья", () => {
  it("тумблер включает и выключает флаг до начала следующего Хода", async () => {
    const a = hero({ items: [talent("Dirge of Despair / Песнь Отчаянья")] });
    await toggleDirgeOfDespair(a);
    expect(dirgeActive(a)).toBe(true);
    await toggleDirgeOfDespair(a);
    expect(dirgeActive(a)).toBe(false);
  });

  it("действует только на звуковое оружие", () => {
    const a = hero({ items: [talent("Dirge of Despair / Песнь Отчаянья")], flags: { [`${NS}.${DIRGE_FLAG}`]: true } });
    expect(dirgeAffects(a, rawWeapon("Sonic Blaster / Звуковой Бластер"))).toBe(true);
    expect(dirgeAffects(a, rawWeapon("Bolter / Болтер"))).toBe(false);
    expect(dirgeAffects(hero(), rawWeapon("Sonic Blaster"))).toBe(false);
  });
});

describe("ГМ-релей: Спой Мне! и Стена Диссонанса", () => {
  const singer = hero({ items: [talent("Sing For Me! / Спой Мне!")], uuid: "Actor.singer" });
  const wall = hero({ items: [talent("Wall of Discord / Стена Диссонанса")], uuid: "Actor.wall" });
  const plain = hero({ uuid: "Actor.plain" });
  const worshipper = hero({ uuid: "Actor.cultist" });
  worshipper.items.push({ type: "trait", name: "Метка", system: {}, flags: { [NS]: { mechanics: [{ id: "g", operator: "AND",
    entries: [{ id: "e", kind: "capability", capabilityKey: "dreadWail.immune" }] }] } }, getFlag: () => undefined });

  it("урон Спой Мне!: только целое 2…20 и только носителю Таланта", () => {
    expect(checkTargetWrite({ kind: "singForMeDamage", amount: 13 }, { initiatorOwned: true, initiator: singer }).ok).toBe(true);
    expect(checkTargetWrite({ kind: "singForMeDamage", amount: 21 }, { initiatorOwned: true, initiator: singer }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "singForMeDamage", amount: 13.5 }, { initiatorOwned: true, initiator: singer }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "singForMeDamage", amount: 13 }, { initiatorOwned: true, initiator: plain }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "singForMeDamage", amount: 13, extra: 1 }, { initiatorOwned: true, initiator: singer }).ok).toBe(false);
  });

  it("награда Спой Мне!: сам палач или поклонник Слаанеш, чужой — нет", () => {
    expect(checkTargetWrite({ kind: "singForMeBoon" }, { initiatorOwned: true, initiator: singer, target: singer }).ok).toBe(true);
    expect(checkTargetWrite({ kind: "singForMeBoon" }, { initiatorOwned: true, initiator: singer, target: worshipper }).ok).toBe(true);
    expect(checkTargetWrite({ kind: "singForMeBoon" }, { initiatorOwned: true, initiator: singer, target: plain }).ok).toBe(false);
  });

  it("отброс Стены: токен и точка, только носителю Таланта", () => {
    const op = { kind: "wallPush", tokenUuid: "Scene.s.Token.t", x: 300, y: 400 };
    expect(checkTargetWrite(op, { initiatorOwned: true, initiator: wall }).ok).toBe(true);
    expect(checkTargetWrite(op, { initiatorOwned: true, initiator: plain }).ok).toBe(false);
    expect(checkTargetWrite({ ...op, x: "боль" }, { initiatorOwned: true, initiator: wall }).ok).toBe(false);
  });

  it("исполнение: урон Ранами, награда Бесчестием и снятием Усталости, отброс в пределах дальности", async () => {
    const victim = hero({ wounds: 20 });
    await performNoiseMarineWrite(victim, { kind: "singForMeDamage", amount: 7 }, singer);
    expect(victim.system.wounds.value).toBe(13);

    const tired = hero({ fatigue: 3, fate: 1 });
    await performNoiseMarineWrite(tired, { kind: "singForMeBoon" }, singer);
    expect(tired.system.fatigue.value).toBe(0);
    expect(tired.system.fate.value).toBe(2);

    const moves = [];
    const tokenDoc = { x: 0, y: 0, parent: { grid: { size: 100, distance: 2 } }, actor: victim,
      async update(d, o) { moves.push([d, o]); } };
    globalThis.fromUuid = async () => tokenDoc;
    await performNoiseMarineWrite(victim, { kind: "wallPush", tokenUuid: "T", x: 600, y: 0 }, wall);
    expect(moves).toEqual([[{ x: 600, y: 0 }, { animate: false }]]);
    await performNoiseMarineWrite(victim, { kind: "wallPush", tokenUuid: "T", x: 6000, y: 0 }, wall);
    expect(moves).toHaveLength(1);
  });
});

describe("Нектар Богов", () => {
  const NECTAR = "Nectar Of The Gods / Нектар Богов";
  const drug = (name, category = "narcotic") => ({ type: "drug", name, system: { drugCategory: category, addiction: { hasAddiction: true, frequency: "12 часов", testChar: "t" } } });

  it("доза наркотика: сразу зависим от него, зависимость от прежнего снята", async () => {
    const a = hero({ items: [talent(NECTAR)], flags: {
      [`${NS}.drugWithdrawal`]: { "Старый": { addicted: true, name: "Старый", lastDose: 0, doneTo: 0, tested: 0, addiction: {} } } } });
    await nectarOfTheGodsOnDose(a, drug("Новый"));
    const entries = a._store[`${NS}.drugWithdrawal`];
    expect(entries["Новый"].addicted).toBe(true);
    expect(entries["Старый"] ?? null).toBeNull();
  });

  it("без Таланта и для не-наркотика (медицина) — ничего", async () => {
    const plain = hero();
    await nectarOfTheGodsOnDose(plain, drug("Новый"));
    expect(plain._store[`${NS}.drugWithdrawal`]).toBeUndefined();
    const nectar = hero({ items: [talent(NECTAR)] });
    await nectarOfTheGodsOnDose(nectar, drug("Бинт", "medicine"));
    expect(nectar._store[`${NS}.drugWithdrawal`]).toBeUndefined();
  });
});

describe("Дистиллированная Мука", () => {
  it("журнал принятых: вечный флаг, лист, недельный журнал и зависимости — без повторов", async () => {
    const a = hero({ items: [talent("Distilled Torment / Дистиллированная Мука"), { type: "drug", name: "Рекаф", system: {} }], flags: {
      [`${NS}.drugsTaken`]: { "Тиск": true },
      [`${NS}.drugDoses`]: { "Рекаф": [1], "Смах": [2] },
      [`${NS}.drugWithdrawal`]: { "Сатрофин": { addicted: true, name: "Сатрофин" } } } });
    expect(knownDrugNames(a)).toEqual(["Рекаф", "Сатрофин", "Смах", "Тиск"]);
    await noteDrugTaken(a, { name: "Лхо" });
    expect(a._store[`${NS}.drugsTaken`]).toEqual({ "Лхо": true });
    const plain = hero();
    await noteDrugTaken(plain, { name: "Лхо" });
    expect(plain._store[`${NS}.drugsTaken`]).toBeUndefined();
  });

  it("доза: один экземпляр, выбранный Приём, метка происхождения, чужой _id убран", () => {
    const data = distilledDoseData({ _id: "abc", name: "Рекаф", type: "drug", system: { quantity: 9, deliveryMethod: "liquid", activeEffect: { isActive: true } } }, "smoke");
    expect(data._id).toBeUndefined();
    expect(data.system.quantity).toBe(1);
    expect(data.system.deliveryMethod).toBe("smoke");
    expect(data.system.activeEffect.isActive).toBe(false);
    expect(data.flags[NS].distilledTorment).toBe(true);
  });
});

describe("Спой Мне!: встречный тест и награда", () => {
  const singerActor = () => {
    const a = hero({ items: [talent("Sing For Me! / Спой Мне!")], uuid: "Actor.singer", fatigue: 4, fate: 1 });
    a.system.skills = { interrogate: { rank: "trained" } };
    return a;
  };

  it("успех: жертва получает 2d10 урона, палач и наблюдатель — Очко Бесчестия и снятие всей Усталости", async () => {
    const singer = singerActor();
    const onlooker = hero({ uuid: "Actor.cultist", fatigue: 2, fate: 0 });
    const victim = hero({ uuid: "Actor.victim", wounds: 20 });
    captured.dice = [10, 90, 4, 6];     // палач 10 (успех), жертва 90 (провал), 2d10 = 4 + 6
    const res = await resolveSingForMe(singer, victim, { onlookers: [onlooker] });
    expect(res.success).toBe(true);
    expect(victim.system.wounds.value).toBe(10);
    expect(singer.system.fate.value).toBe(2);
    expect(singer.system.fatigue.value).toBe(0);
    expect(onlooker.system.fate.value).toBe(1);
    expect(onlooker.system.fatigue.value).toBe(0);
    expect(captured.chat.at(-1).content).toContain("Спой Мне!");
  });

  it("провал: жертва всё равно получает урон, награды нет", async () => {
    const singer = singerActor();
    const victim = hero({ uuid: "Actor.victim", wounds: 20 });
    captured.dice = [95, 5, 3, 3];      // палач 95 (провал), жертва 5 (успех)
    const res = await resolveSingForMe(singer, victim, {});
    expect(res.success).toBe(false);
    expect(victim.system.wounds.value).toBe(14);
    expect(singer.system.fate.value).toBe(1);
    expect(singer.system.fatigue.value).toBe(4);
  });
});
