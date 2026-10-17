// test/rules/combat-formation.test.mjs
//
// Боевое Построение, раздача соратникам (стр. 62): отметка на листе соратника
// даёт +1 к Инициативе (лист) и I.b вместо A.b (rules/initiative.mjs);
// кнопка Таланта ставит отметку выбранным токенам (combat/combat-formation.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import {
  COMBAT_FORMATION_FLAG, sharedFormation, sharedFormationInitBonus, formationRecipients
} from "../../module/rules/combat-formation.mjs";
import { shareCombatFormation, clearCombatFormationOnCombatEnd } from "../../module/combat/combat-formation.mjs";

const NS = "warhammer-dbc";

const flagged = (uuid, mark) => ({
  uuid, name: uuid, isOwner: true,
  getFlag: (ns, key) => (ns === NS && key === COMBAT_FORMATION_FLAG ? mark : undefined)
});

describe("отметка Построения", () => {
  it("читается из флага листа", () => {
    expect(sharedFormation(flagged("A", { from: "C", name: "Командир" }))).toEqual({ from: "C", name: "Командир" });
    expect(sharedFormation(flagged("A", undefined))).toBeNull();
    expect(sharedFormation(null)).toBeNull();
  });

  it("+1 к Инициативе только при отметке", () => {
    expect(sharedFormationInitBonus(flagged("A", { from: "C" }))).toBe(1);
    expect(sharedFormationInitBonus(flagged("A", undefined))).toBe(0);
  });

  it("получатели: без самого носителя, без повторов, без тех, кто уже знает его план", () => {
    const carrier = { uuid: "C" };
    const list = formationRecipients(carrier, [
      flagged("C"), flagged("A"), flagged("A"), flagged("B", { from: "C" }), flagged("D", { from: "X" })
    ]);
    expect(list.map(a => a.uuid)).toEqual(["A", "D"]);
  });
});

describe("лист соратника", () => {
  function characterWith(flagValue) {
    const system = new ACTOR_DATA_MODELS.character({}).toObject();
    system.characteristics.ag.base = 40;
    const actor = { type: "character", uuid: "Actor.al1", name: "Союзник", system,
                    items: Object.assign([], { get: () => null }),
                    getFlag: (ns, key) => (ns === NS && key === COMBAT_FORMATION_FLAG ? flagValue : undefined) };
    WarhammerActor.prototype.prepareDerivedData.call(actor);
    return system;
  }

  it("отметка добавляет +1 к вкладу Талантов в Инициативу", () => {
    const base = characterWith(undefined).talentInitMod;
    expect(characterWith({ from: "Actor.cf", name: "Командир" }).talentInitMod).toBe(base + 1);
  });
});

describe("кнопка Таланта", () => {
  let prev;
  beforeEach(() => {
    resetCaptured();
    prev = { user: game.user, socket: game.socket, users: game.users };
    game.socket = { emit() {} };
    game.users = Object.assign([], { activeGM: { id: "gm" } });
  });
  afterEach(() => Object.assign(game, prev));

  const carrier = () => ({ uuid: "Actor.cf", name: "Командир", getActiveTokens: () => [] });
  const ally = (name, isOwner = true) => {
    const updates = [];
    return { uuid: `Actor.${name}`, name, isOwner, getFlag: () => undefined, update: async u => { updates.push(u); }, updates };
  };

  it("без выбранных токенов — предупреждение, ничего не ставится", async () => {
    game.user = { id: "u1", targets: new Set() };
    expect(await shareCombatFormation(carrier())).toBe(0);
    expect(captured.warnings.at(-1)).toMatch(/клавиша T/);
  });

  it("выбранным токенам ставится отметка с именем носителя", async () => {
    const a = ally("Ольга"), b = ally("Иван");
    game.user = { id: "u1", targets: new Set([{ actor: a }, { actor: b }]) };
    expect(await shareCombatFormation(carrier())).toBe(2);
    expect(a.updates).toEqual([{ [`flags.${NS}.${COMBAT_FORMATION_FLAG}`]: { from: "Actor.cf", name: "Командир" } }]);
    expect(b.updates).toHaveLength(1);
  });

  it("чужой лист без прав: правку просит у ГМа сокетом, а не пишет сам", async () => {
    const emitted = [];
    game.socket = { emit: (ch, d) => emitted.push(d) };
    game.user = { id: "u1", targets: new Set([{ actor: ally("Чужой", false) }]) };
    expect(await shareCombatFormation(carrier())).toBe(1);
    expect(emitted[0]).toMatchObject({ action: "commandUpdate", uuid: "Actor.Чужой" });
    expect(Object.keys(emitted[0].update)[0]).toMatch(/combatFormation$/);
  });

  it("конец боя снимает отметку со всех участников", async () => {
    const cleared = [];
    const mk = (uuid, marked) => ({ actor: {
      getFlag: () => (marked ? { from: "C" } : undefined),
      unsetFlag: async (ns, key) => { cleared.push([uuid, ns, key]); }
    } });
    await clearCombatFormationOnCombatEnd({ combatants: [mk("A", true), mk("B", false), mk("C", true)] });
    expect(cleared.map(c => c[0])).toEqual(["A", "C"]);
    expect(cleared[0].slice(1)).toEqual([NS, COMBAT_FORMATION_FLAG]);
  });
});
