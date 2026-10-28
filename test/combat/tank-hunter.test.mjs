// test/combat/tank-hunter.test.mjs
//
// Tank Hunter / Охотник на Танки (Талант Стрелка, Sahara 3-5fbf; решения
// владельца 24.10.2026): модель техники = актор-источник; кнопка «Опознать
// модель» на карточке атаки по технике; Common Lore (War)−10 → +2×I.b к Pen
// стрелкового оружия против этой модели до конца боя; 1–3 Провала — можно
// попробовать в следующий Ход, 4+ — до конца боя не вспомнить; память на
// акторе стрелка, чистится по концу боя.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import {
  tankHunterForAttack, resolveTankHunterClick, clearTankHunterMemory
} from "../../module/combat/tank-hunter.mjs";
import {
  TANK_HUNTER_FLAG, tankHunterOutcome, tankHunterRemember, tankHunterModelState, tankHunterPenBonus
} from "../../module/rules/tank-hunter.mjs";
import { TURN_SCOPED_FLAGS } from "../../module/rules/turn-flags.mjs";

const NS = "warhammer-dbc";
const TH_KEY = "rangedCore.core.tankHunter";
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { [NS]: { mechanics: [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = { id: "n", name: "Tank Hunter / Охотник на Танки", type: "talent", system: {} };

function shooter(items = [], { lore = 50 } = {}) {
  const a = actorFor({
    items,
    characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35), int: char(40) },
    groupSkills: { commonLore: [{ specialty: "War", specKey: "war", rank: "trained", total: lore }] }
  });
  a.uuid = "Actor.shooter"; a.isOwner = true;
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  // как Foundry: вложенные объекты СЛИВАЮТСЯ, а не заменяются
  a.setFlag = async (s, k, v) => {
    const key = `${s}.${k}`, old = store[key];
    const deep = (x, y) => {
      const out = { ...x };
      for (const [kk, vv] of Object.entries(y)) out[kk] = (vv && typeof vv === "object" && out[kk] && typeof out[kk] === "object") ? deep(out[kk], vv) : vv;
      return out;
    };
    store[key] = (old && typeof old === "object" && v && typeof v === "object") ? deep(old, v) : v;
  };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  a.store = store;
  return a;
}
const tank = (id = "tank-1") => ({ id, uuid: `Actor.${id}`, name: "Леман Русс", type: "vehicle", system: {} });
const inCombat = actor => {
  globalThis.game.combats = [{ id: "combat-1", started: true, combatants: [{ actor }] }];
};
const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
  globalThis.game.combats = [];
});

describe("чистые правила", () => {
  it("исход: успех — опознана; 1–3 Провала — повтор; 4+ — потеряна", () => {
    expect(tankHunterOutcome({ success: true, failureDegrees: 0 })).toBe("known");
    expect(tankHunterOutcome({ success: false, failureDegrees: 1 })).toBe("retry");
    expect(tankHunterOutcome({ success: false, failureDegrees: 3 })).toBe("retry");
    expect(tankHunterOutcome({ success: false, failureDegrees: 4 })).toBe("lost");
  });

  it("память: чужой бой не считается; запись не мутирует прежнюю", () => {
    const m0 = { combatId: "c1", models: { a: "known" } };
    const m1 = tankHunterRemember(m0, { combatId: "c1", modelId: "b", state: "lost" });
    expect(m1.models).toEqual({ a: "known", b: "lost" });
    expect(m0.models).toEqual({ a: "known" });
    expect(tankHunterModelState(m1, { combatId: "c2", modelId: "a" })).toBe("");
    expect(tankHunterRemember(m1, { combatId: "c2", modelId: "z", state: "known" }).models).toEqual({ z: "known" });
  });

  it("Pen: 2×I.b только против опознанной модели, стрелковым оружием", () => {
    const actor = shooter([byName]);
    const memory = { combatId: "c1", models: { "tank-1": "known" } };
    const ctx = { isMelee: false, targetActor: tank(), combatId: "c1", memory, intBonus: 4 };
    expect(tankHunterPenBonus(actor, ctx)).toBe(8);
    expect(tankHunterPenBonus(actor, { ...ctx, isMelee: true })).toBe(0);
    expect(tankHunterPenBonus(actor, { ...ctx, targetActor: tank("tank-2") })).toBe(0);   // другая модель
    expect(tankHunterPenBonus(actor, { ...ctx, combatId: "c2" })).toBe(0);                // другой бой
    expect(tankHunterPenBonus(actor, { ...ctx, targetActor: { id: "x", type: "character" } })).toBe(0);
    expect(tankHunterPenBonus(shooter([]), ctx)).toBe(0);
    expect(tankHunterPenBonus(actor, { ...ctx, memory: { combatId: "c1", models: { "tank-1": "lost" } } })).toBe(0);
  });

  it("метка «пытался в этом Ходу» живёт до начала следующего Хода", () => {
    expect(TURN_SCOPED_FLAGS).toHaveProperty("tankHunterThisTurn");
  });
});

describe("предложение кнопки и Pen на атаке", () => {
  it("Талант (ключ и имя) + бой + техника → есть предложение; без боя, без Таланта, не-техника, рукопашная → нет", () => {
    for (const t of [byKey(TH_KEY), byName]) {
      const a = shooter([t]); inCombat(a);
      expect(tankHunterForAttack(a, { isMelee: false, targetActor: tank() }).offer).toMatchObject({ modelId: "tank-1" });
    }
    globalThis.game.combats = [];
    const a = shooter([byName]);
    expect(tankHunterForAttack(a, { isMelee: false, targetActor: tank() }).offer).toBeNull();   // боя нет
    inCombat(a);
    expect(tankHunterForAttack(a, { isMelee: true, targetActor: tank() }).offer).toBeNull();
    expect(tankHunterForAttack(a, { isMelee: false, targetActor: { id: "m", type: "character" } }).offer).toBeNull();
    const b = shooter([]); inCombat(b);
    expect(tankHunterForAttack(b, { isMelee: false, targetActor: tank() }).offer).toBeNull();
  });

  it("попытка уже была в этом Ходу → предложения нет", () => {
    const a = shooter([byName]); inCombat(a);
    a.store[`${NS}.tankHunterThisTurn`] = true;
    expect(tankHunterForAttack(a, { isMelee: false, targetActor: tank() }).offer).toBeNull();
  });

  it("карточка атаки по технике несёт кнопку «Опознать модель»; по человеку — нет", async () => {
    const a = shooter([byName]); inCombat(a);
    const gun = weaponFor({ damage: "1d10", penetration: 4 });
    setTargets([tank()]);
    captured.dice = [20, 5];
    await _executeAttackRoll(a, gun, "bs", 45, "single", null, {});
    expect(card()).toContain("wh-tank-hunter-btn");
    expect(card()).toContain('data-target-uuid="Actor.tank-1"');
    resetCaptured();
    setTargets([{ id: "m", uuid: "Actor.m", type: "character", name: "Человек" }]);
    captured.dice = [20, 5];
    await _executeAttackRoll(a, gun, "bs", 45, "single", null, {});
    expect(card()).not.toContain("wh-tank-hunter-btn");
  });
});

describe("клик «Опознать модель»", () => {
  const setup = (lore = 50) => {
    const a = shooter([byName], { lore }); inCombat(a);
    const t = tank();
    globalThis.fromUuid = async uuid => ({ [a.uuid]: a, [t.uuid]: t })[uuid] ?? null;
    return { a, t };
  };

  it("успех: модель опознана, память боя записана, попытка потрачена", async () => {
    const { a } = setup(50);
    captured.dice = [30];           // порог 50−10 = 40, 30 — успех
    expect(await resolveTankHunterClick("Actor.shooter", "Actor.tank-1")).toBe("known");
    expect(a.store[`${NS}.${TANK_HUNTER_FLAG}`]).toEqual({ combatId: "combat-1", models: { "tank-1": "known" } });
    expect(a.store[`${NS}.tankHunterThisTurn`]).toBe(true);
    expect(card()).toContain("+8 к Pen");     // I.b = 4
  });

  it("порог: Common Lore (War) − 10", async () => {
    setup(50);
    captured.dice = [41];           // 41 > 40 — провал на 1 степень
    expect(await resolveTankHunterClick("Actor.shooter", "Actor.tank-1")).toBe("retry");
  });

  it("1–3 Провала: память не пишется, но попытка этого Хода потрачена", async () => {
    const { a } = setup(50);
    captured.dice = [60];           // 20 сверх порога → 3 степени провала
    expect(await resolveTankHunterClick("Actor.shooter", "Actor.tank-1")).toBe("retry");
    expect(a.store[`${NS}.${TANK_HUNTER_FLAG}`]).toBeUndefined();
    expect(a.store[`${NS}.tankHunterThisTurn`]).toBe(true);
  });

  it("4+ Провала: модель потеряна до конца боя", async () => {
    const { a } = setup(50);
    captured.dice = [90];           // 50 сверх порога → 6 степеней
    expect(await resolveTankHunterClick("Actor.shooter", "Actor.tank-1")).toBe("lost");
    expect(a.store[`${NS}.${TANK_HUNTER_FLAG}`].models["tank-1"]).toBe("lost");
    // потерянная модель больше не предлагается
    expect(tankHunterForAttack(a, { isMelee: false, targetActor: tank() }).offer).toBeNull();
  });

  it("повторный клик в тот же Ход ничего не бросает", async () => {
    const { a } = setup(50);
    a.store[`${NS}.tankHunterThisTurn`] = true;
    captured.dice = [1];
    await resolveTankHunterClick("Actor.shooter", "Actor.tank-1");
    expect(a.store[`${NS}.${TANK_HUNTER_FLAG}`]).toBeUndefined();
    expect(captured.chat).toHaveLength(0);
  });

  it("вне боя опознать нельзя", async () => {
    const { a } = setup(50);
    globalThis.game.combats = [];
    captured.dice = [1];
    await resolveTankHunterClick("Actor.shooter", "Actor.tank-1");
    expect(a.store[`${NS}.tankHunterThisTurn`]).toBeUndefined();
    expect(captured.chat).toHaveLength(0);
  });
});

describe("память прошлого боя", () => {
  it("опознание в новом бою не тащит модели из старого, оставшиеся во флаге", async () => {
    const a = shooter([byName]);
    globalThis.game.combats = [{ id: "combat-2", started: true, combatants: [{ actor: a }] }];
    a.store[`${NS}.${TANK_HUNTER_FLAG}`] = { combatId: "combat-1", models: { "tank-X": "known" } };
    globalThis.fromUuid = async uuid => ({ [a.uuid]: a, ["Actor.tank-1"]: tank() })[uuid] ?? null;
    captured.dice = [30];
    await resolveTankHunterClick("Actor.shooter", "Actor.tank-1");
    expect(a.store[`${NS}.${TANK_HUNTER_FLAG}`]).toEqual({ combatId: "combat-2", models: { "tank-1": "known" } });
  });
});

describe("Pen на атаке и конец боя", () => {
  it("после опознания Pen карточки выше на 2×I.b; для другой модели — нет", async () => {
    const a = shooter([byName]); inCombat(a);
    a.store[`${NS}.${TANK_HUNTER_FLAG}`] = { combatId: "combat-1", models: { "tank-1": "known" } };
    const gun = () => weaponFor({ damage: "1d10", penetration: 4 });
    setTargets([tank("tank-1")]);
    captured.dice = [20, 5];
    await _executeAttackRoll(a, gun(), "bs", 45, "single", null, {});
    expect(card()).toContain("Охотник на Танки: +8 к Pen");
    resetCaptured();
    setTargets([tank("tank-2")]);
    captured.dice = [20, 5];
    await _executeAttackRoll(a, gun(), "bs", 45, "single", null, {});
    expect(card()).not.toContain("Охотник на Танки: +");
  });

  it("конец боя стирает память", async () => {
    const a = shooter([byName]); inCombat(a);
    a.store[`${NS}.${TANK_HUNTER_FLAG}`] = { combatId: "combat-1", models: { "tank-1": "known" } };
    await clearTankHunterMemory({ combatants: [{ actor: a }] });
    expect(a.store[`${NS}.${TANK_HUNTER_FLAG}`]).toBeUndefined();
  });
});
