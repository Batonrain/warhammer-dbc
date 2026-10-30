// test/combat/running-throw.test.mjs
//
// Running Throw / Бросок на Бегу (Талант Метания, Sahara 3-8318): раз в Ход, двигаясь, Acrobatics−10 → дополнительный
// бросок метательным оружием или гранатой (не бомбой) свободным действием; Rng S.b×2; Атакой Хода не считается.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import {
  offerRunningThrow, resolveRunningThrowClick, runningThrowWeapons, runningThrowThreshold
} from "../../module/combat/running-throw.mjs";
import { activateFreeShot, freeShotBlockReason, consumeFreeShot } from "../../module/combat/free-shot.mjs";
import { markMovedThisTurn } from "../../module/combat/movement-actions.mjs";
import { RUNNING_THROW_USED_FLAG, RUNNING_THROW_PENDING_FLAG } from "../../module/rules/throwing-talents.mjs";
import { freeShotLocksAim, freeShotCountsAsAttack, freeShotRofModes } from "../../module/rules/run-and-gun.mjs";
import { TURN_SCOPED_FLAGS } from "../../module/rules/turn-flags.mjs";

const NS = "warhammer-dbc";
const KEY = "throwing.core.runningThrow";
const byKey = {
  id: "k", name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { [NS]: { mechanics: [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: KEY, label: "" }] }] } }
};
const byName = { id: "n", name: "Running Throw / Бросок на Бегу", type: "talent", system: {} };

const knife = (extra = {}, id = "knife") => weaponFor({
  weaponClass: "thrown", weaponType: "lowtech", rof_single: 1, rof_semi: 0, rof_full: 0, weight: 0.2, damage: "1d5",
  damageType: "rending", magazineCur: 1, magazineMax: 1, equipped: true, ...extra
}, { id, name: "Метательный нож" });
const grenade = () => knife({ weaponType: "grenade", equipped: false }, "gren");
const bomb = () => knife({ weaponType: "explosive", equipped: false }, "bomb");

function who(items, { acro = 60 } = {}) {
  const a = actorFor({
    items, characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(50) },
    skills: { acrobatics: { total: acro } }, fatigue: { value: 0 }, aiming: "none"
  });
  a.uuid = "Actor.runner"; a.name = "Бегун"; a.type = "character"; a.isOwner = true;
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  a.update = async () => {};
  a.store = store;
  store[`${NS}.movedThisTurn`] = true;       // карточка предлагается на первом Движении Хода
  return a;
}

let registry, prevFromUuid;
/** Дождаться, пока асинхронная цепочка (fromUuid → import → окно) дойдёт до условия. */
async function until(cond) { for (let i = 0; i < 400 && !cond(); i++) await new Promise(r => setTimeout(r, 5)); }
const chat = () => captured.chat.map(m => m.content ?? "").join("\n");
beforeEach(() => {
  resetCaptured(); setTargets([]);
  registry = {};
  prevFromUuid = globalThis.fromUuid;
  globalThis.fromUuid = async uuid => registry[uuid] ?? null;
  globalThis.game.combat = { started: true, id: "c1", round: 1 };
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; globalThis.game.combat = undefined; });

describe("оружие и порог", () => {
  it("экипированное метательное предпочтительнее; нет такого — всё метательное; бомба не годится никогда", () => {
    const a = who([knife(), grenade(), bomb(), byName]);
    expect(runningThrowWeapons(a).map(i => i.id)).toEqual(["knife"]);
    const b = who([grenade(), bomb(), byName]);
    expect(runningThrowWeapons(b).map(i => i.id)).toEqual(["gren"]);
    expect(runningThrowWeapons(who([bomb()]))).toEqual([]);
  });
  it("порог Acrobatics−10", () => {
    expect(runningThrowThreshold(who([byName], { acro: 60 })).threshold).toBe(50);
  });
});

describe("правила бесплатного броска", () => {
  it("Избирательный не запирается; считается не Атакой; режимы single/full", () => {
    expect(freeShotLocksAim("runningThrow")).toBe(false);
    expect(freeShotCountsAsAttack("runningThrow")).toBe(false);
    expect(freeShotRofModes("runningThrow")).toEqual(["single", "full"]);
  });
  it("флаги зарегистрированы как привязанные к Ходу", () => {
    expect(Object.keys(TURN_SCOPED_FLAGS)).toEqual(expect.arrayContaining([RUNNING_THROW_USED_FLAG, RUNNING_THROW_PENDING_FLAG]));
  });
});

describe("предложение на первом Движении", () => {
  it("с Талантом в бою — карточка с кнопкой", async () => {
    const a = who([knife(), byName]);
    await offerRunningThrow(a);
    expect(chat()).toContain("wh-running-throw-btn");
    expect(chat()).toContain('data-actor-uuid="Actor.runner"');
  });
  it("Талант опознаётся по ключу Возможности", async () => {
    await offerRunningThrow(who([knife(), byKey]));
    expect(chat()).toContain("wh-running-throw-btn");
  });
  it("без Таланта, вне боя, после использованной попытки — тишина", async () => {
    await offerRunningThrow(who([knife()]));
    globalThis.game.combat = undefined;
    await offerRunningThrow(who([knife(), byName]));
    globalThis.game.combat = { started: true, id: "c1", round: 1 };
    const used = who([knife(), byName]);
    used.store[`${NS}.${RUNNING_THROW_USED_FLAG}`] = true;
    await offerRunningThrow(used);
    expect(captured.chat).toHaveLength(0);
  });
  it("markMovedThisTurn предлагает на ПЕРВОМ Движении Хода и молчит на втором", async () => {
    const a = who([knife(), byName]);
    delete a.store[`${NS}.movedThisTurn`];
    await markMovedThisTurn(a);
    expect(captured.chat).toHaveLength(1);
    await markMovedThisTurn(a);
    expect(captured.chat).toHaveLength(1);
  });
});

describe("клик «Бросок на Бегу»", () => {
  const setup = (items, opts) => { const a = who(items, opts); registry[a.uuid] = a; return a; };

  it("Успех: попытка потрачена, метка взведена, кнопки всего подходящего оружия", async () => {
    const a = setup([knife(), byName], { acro: 60 });
    captured.dice = [30];                                   // порог 50, 30 — успех
    expect(await resolveRunningThrowClick(a.uuid)).toBe(true);
    expect(a.store[`${NS}.${RUNNING_THROW_USED_FLAG}`]).toBe(true);
    expect(a.store[`${NS}.${RUNNING_THROW_PENDING_FLAG}`]).toBe(true);
    expect(chat()).toContain('data-kind="runningThrow"');
    expect(chat()).toContain('data-item-id="knife"');
  });
  it("Провал: попытка потрачена, метки броска нет, кнопок оружия нет", async () => {
    const a = setup([knife(), byName], { acro: 60 });
    captured.dice = [80];
    expect(await resolveRunningThrowClick(a.uuid)).toBe(true);
    expect(a.store[`${NS}.${RUNNING_THROW_USED_FLAG}`]).toBe(true);
    expect(a.store[`${NS}.${RUNNING_THROW_PENDING_FLAG}`]).toBeUndefined();
    expect(chat()).not.toContain('data-kind="runningThrow"');
  });
  it("порог на границе: ровно 50 — успех, 51 — провал", async () => {
    const a = setup([knife(), byName], { acro: 60 });
    captured.dice = [50];
    await resolveRunningThrowClick(a.uuid);
    expect(a.store[`${NS}.${RUNNING_THROW_PENDING_FLAG}`]).toBe(true);
    const b = setup([knife(), byName], { acro: 60 }); b.uuid = "Actor.b"; registry[b.uuid] = b;
    captured.dice = [51];
    await resolveRunningThrowClick(b.uuid);
    expect(b.store[`${NS}.${RUNNING_THROW_PENDING_FLAG}`]).toBeUndefined();
  });
  it("второй клик в тот же Ход — отказ, кубы не бросаются", async () => {
    const a = setup([knife(), byName]);
    captured.dice = [30, 30];
    await resolveRunningThrowClick(a.uuid);
    const n = captured.chat.length;
    expect(await resolveRunningThrowClick(a.uuid)).toBe(false);
    expect(captured.chat.length).toBe(n);
  });
  it("нет метательного оружия (только бомба) — попытка не тратится", async () => {
    const a = setup([bomb(), byName]);
    captured.dice = [30];
    expect(await resolveRunningThrowClick(a.uuid)).toBe(false);
    expect(a.store[`${NS}.${RUNNING_THROW_USED_FLAG}`]).toBeUndefined();
    expect(captured.chat).toHaveLength(0);
  });
  it("карточка с прошлого Хода (в этом Ходу движения не было) — отказ, попытка не тратится", async () => {
    const a = setup([knife(), byName]);
    delete a.store[`${NS}.movedThisTurn`];
    captured.dice = [30];
    expect(await resolveRunningThrowClick(a.uuid)).toBe(false);
    expect(a.store[`${NS}.${RUNNING_THROW_USED_FLAG}`]).toBeUndefined();
    expect(captured.chat).toHaveLength(0);
  });
  it("вне боя — отказ", async () => {
    const a = setup([knife(), byName]);
    globalThis.game.combat = undefined;
    expect(await resolveRunningThrowClick(a.uuid)).toBe(false);
  });
  it("реальная граната пака (rof_single 0) тоже подходит и получает кнопку", async () => {
    const a = setup([knife({ weaponType: "grenade", rof_single: 0, equipped: true }, "frag"), byName]);
    captured.dice = [30];
    await resolveRunningThrowClick(a.uuid);
    expect(chat()).toContain('data-item-id="frag"');
  });
  it("без Таланта — отказ", async () => {
    const a = setup([knife()]);
    expect(await resolveRunningThrowClick(a.uuid)).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("сам бросок: activateFreeShot → окно атаки", () => {
  const setup = items => { const a = who(items); registry[a.uuid] = a; return a; };
  const dialog = () => captured.dialog?.content ?? "";

  it("без метки взведённого броска — отказ (окно не открывается)", async () => {
    const a = setup([knife(), byName]);
    await activateFreeShot(a.uuid, "runningThrow", "knife");
    expect(captured.dialog).toBeFalsy();
  });
  it("бомбой нельзя — окно не открывается", async () => {
    const a = setup([bomb(), byName]);
    a.store[`${NS}.${RUNNING_THROW_PENDING_FLAG}`] = true;
    await activateFreeShot(a.uuid, "runningThrow", "bomb");
    expect(captured.dialog).toBeFalsy();
  });
  it("окно открывается, дальность S.b×2 = 8 м вместо S.b×3 = 12 м", async () => {
    // range>0 нужен лишь затем, чтобы окно показало блок дальностей; у метательного Rng всё равно считается от S.b
    const a = setup([knife({ range: 1 }), byName]);
    a.store[`${NS}.${RUNNING_THROW_PENDING_FLAG}`] = true;
    const p = activateFreeShot(a.uuid, "runningThrow", "knife");
    await until(() => captured.dialog);
    expect(dialog()).toContain("Rng = 8м");
    captured.dismiss();
    await p;
    resetCaptured();
    const { showAttackDialog } = await import("../../module/sheets/attack-dialog.mjs");
    const q = showAttackDialog(a, a.items.get("knife"));
    expect(captured.dialog.content).toContain("Rng = 12м");
    captured.dismiss();
    await q;
  });
  it("бросок: ОД не списываются, метка снимается, Атакой Хода не считается", async () => {
    const a = setup([knife(), byName]);
    a.system.actionPoints = { value: 2, max: 2 };
    a.store[`${NS}.${RUNNING_THROW_PENDING_FLAG}`] = true;
    const spent = [];
    a.update = async d => spent.push(d);
    const p = activateFreeShot(a.uuid, "runningThrow", "knife");
    await until(() => captured.dialog);
    captured.dice = [10, 3];
    await captured.press("roll", fakeForm({ "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "" }, {}));
    await p;
    expect(a.store[`${NS}.${RUNNING_THROW_PENDING_FLAG}`]).toBeUndefined();
    expect(a.store[`${NS}.attackActionsThisTurn`]).toBeUndefined();
    expect(spent.some(d => "system.actionPoints.value" in d)).toBe(false);
    expect(chat()).toContain("Метательный нож");
  });
  it("freeShotBlockReason и consumeFreeShot", async () => {
    const a = setup([knife(), byName]);
    expect(freeShotBlockReason(a, "runningThrow")).toContain("Бросок на Бегу");
    a.store[`${NS}.${RUNNING_THROW_PENDING_FLAG}`] = true;
    expect(freeShotBlockReason(a, "runningThrow")).toBe("");
    await consumeFreeShot(a, "runningThrow");
    expect(a.store[`${NS}.${RUNNING_THROW_PENDING_FLAG}`]).toBeUndefined();
  });
});
