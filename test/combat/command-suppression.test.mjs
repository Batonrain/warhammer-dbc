// test/combat/command-suppression.test.mjs
//
// Рисовка (Талант «Рукопашных», Sahara 3-8dc5): «цели до начала его следующего Хода теряют все
// преимущества Командования и не могут получать новых». Метка commandSuppressed на цели:
// над ней нет узлов командования, бонус Команды до броска не доходит, Концентрация Огня не
// работает; метка снимается в начале следующего Хода Рисующегося и с концом боя.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { resetCaptured, captured } from "../support/foundry-stub.mjs";
import {
  commandNodesFor, expireCommandsAtTurnStart, clearCommandsOnCombatEnd, suppressCommandOf, commandSuppressedActive,
  applyRelayedCommandUpdate
} from "../../module/combat/command-state.mjs";
import { COMMAND_SUPPRESSED_FLAG } from "../../module/rules/command-suppression.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";

function doc(uuid, type, system, extra = {}) {
  const flags = {};
  return {
    uuid, type, name: uuid, isOwner: true, items: [], system, flags, updates: [],
    getFlag: (_ns, k) => flags[k],
    async setFlag(_ns, k, v) { flags[k] = v; },
    async unsetFlag(_ns, k) { delete flags[k]; },
    async update(u) {
      this.updates.push(u);
      for (const [path, v] of Object.entries(u)) {
        if (path.startsWith("flags.warhammer-dbc.")) {
          const k = path.split(".").pop();
          if (k.startsWith("-=")) delete flags[k.slice(2)]; else flags[k] = v;
        }
      }
    },
    ...extra
  };
}

let soldier, sarge, showoff, squad, realFromUuidSync, realActors, realCombat;

beforeEach(() => {
  resetCaptured();
  soldier = doc("Actor.s", "character", {
    characteristics: { wp: { total: 30 }, per: { bonus: 4 }, ag: { total: 35 } }, conditions: {} });
  sarge = doc("Actor.c", "character", {
    characteristics: { wp: { total: 50 }, fel: { bonus: 4 } }, conditions: {},
    command: { presence: {}, shortCommand: {}, detailCommand: {} } });
  showoff = doc("Actor.show", "character", { characteristics: { fel: { bonus: 3 } }, conditions: {} });
  squad = doc("Actor.sq", "squad", {
    posts: { commander: { uuid: "Actor.c" } },
    members: [{ id: "m1", uuid: "Actor.s" }],
    presence: { active: true, benefit: "morale" },
    shortCommand: { active: true, key: "inspire", successes: 3, giverUuid: "Actor.c", combatId: "cb", round: 1 },
    detailCommand: { active: false, picks: [] }
  });
  realFromUuidSync = globalThis.fromUuidSync;
  realActors = game.actors; realCombat = game.combat;
  const map = { "Actor.s": soldier, "Actor.c": sarge, "Actor.sq": squad, "Actor.show": showoff };
  globalThis.fromUuidSync = u => map[u] ?? null;
  game.actors = [soldier, sarge, showoff, squad];
  game.combat = { id: "cb", round: 3, combatant: null, combatants: [{ actor: soldier }, { actor: showoff }] };
  game.user.id = "u1";
  globalThis.ChatMessage = { create: async m => captured.chat.push(m), getSpeaker: () => ({}) };
});

afterEach(() => {
  globalThis.fromUuidSync = realFromUuidSync;
  game.actors = realActors; game.combat = realCombat;
});

const modsOf = () => resolveTest({ actor: soldier, kind: "attack", isMelee: false }).autoMods.filter(m => m.ruleId?.startsWith("command."));

describe("цель Рисовки не получает Командования", () => {
  it("до метки Команда бойца действует (контроль теста)", () => {
    expect(commandNodesFor(soldier)).toHaveLength(1);
    expect(modsOf().length).toBeGreaterThan(0);
  });
  it("после победы Рисующегося: узлов нет, бонус Команды до броска не доходит", async () => {
    await suppressCommandOf(soldier, showoff);
    expect(soldier.getFlag("warhammer-dbc", COMMAND_SUPPRESSED_FLAG)).toEqual({ giverUuid: "Actor.show", combatId: "cb", round: 3 });
    expect(commandSuppressedActive(soldier)).toBe(true);
    expect(commandNodesFor(soldier)).toEqual([]);
    expect(modsOf()).toEqual([]);
  });
  it("уже объявленная Концентрация Огня снимается вместе с Командованием", async () => {
    await soldier.setFlag("warhammer-dbc", "focusFire", { weaponName: "Меч", with: [] });
    await suppressCommandOf(soldier, showoff);
    expect(soldier.getFlag("warhammer-dbc", "focusFire")).toBeUndefined();
  });
  it("метка из прошлого боя не действует", async () => {
    await suppressCommandOf(soldier, showoff);
    game.combat = { id: "cb2", round: 1, combatants: [] };
    expect(commandSuppressedActive(soldier)).toBe(false);
    expect(commandNodesFor(soldier)).toHaveLength(1);
  });
  it("цель без права записи (чужой актор) — правка уходит ГМу по сокету", async () => {
    const emitted = [];
    const realSocket = game.socket;
    game.socket = { emit: (ch, payload) => emitted.push({ ch, payload }) };
    soldier.isOwner = false;
    await suppressCommandOf(soldier, showoff);
    game.socket = realSocket;
    expect(emitted).toHaveLength(1);
    expect(emitted[0].payload.action).toBe("commandUpdate");
    expect(Object.keys(emitted[0].payload.update)[0]).toContain(COMMAND_SUPPRESSED_FLAG);
  });
});

describe("срок: до начала следующего Хода Рисующегося", () => {
  it("его собственный Ход в том же Раунде, чужой Ход и Раунд позже — метка держится до Хода Рисующегося", async () => {
    await suppressCommandOf(soldier, showoff);
    await expireCommandsAtTurnStart({ id: "cb", round: 3, combatant: { actor: showoff }, combatants: game.combat.combatants });
    expect(commandSuppressedActive(soldier)).toBe(true);
    await expireCommandsAtTurnStart({ id: "cb", round: 4, combatant: { actor: soldier }, combatants: game.combat.combatants });
    expect(commandSuppressedActive(soldier)).toBe(true);   // Ход самой цели метку не снимает
    await expireCommandsAtTurnStart({ id: "cb", round: 4, combatant: { actor: sarge }, combatants: game.combat.combatants });
    expect(commandSuppressedActive(soldier)).toBe(true);   // Ход постороннего — тоже
  });
  it("Ход Рисующегося в следующем Раунде — метка снята, Командование возвращается", async () => {
    await suppressCommandOf(soldier, showoff);
    game.combat = { id: "cb", round: 4, combatant: { actor: showoff }, combatants: game.combat.combatants };
    await expireCommandsAtTurnStart(game.combat);
    expect(soldier.getFlag("warhammer-dbc", COMMAND_SUPPRESSED_FLAG)).toBeUndefined();
    expect(commandNodesFor(soldier)).toHaveLength(1);
  });
  it("метка на токене сцены вне списка бойцов боя тоже снимается", async () => {
    const stray = doc("Actor.stray", "character", { conditions: {} });
    await suppressCommandOf(stray, showoff);
    const combat = { id: "cb", round: 4, combatant: { actor: showoff }, combatants: [{ actor: showoff }],
      scene: { tokens: [{ actor: stray }] } };
    game.combat = combat;
    await expireCommandsAtTurnStart(combat);
    expect(stray.getFlag("warhammer-dbc", COMMAND_SUPPRESSED_FLAG)).toBeUndefined();
  });
  it("конец боя снимает метку", async () => {
    await suppressCommandOf(soldier, showoff);
    await clearCommandsOnCombatEnd({ combatants: [{ actor: soldier }] });
    expect(soldier.getFlag("warhammer-dbc", COMMAND_SUPPRESSED_FLAG)).toBeUndefined();
  });
});

describe("ГМ-релей правки командования", () => {
  it("метку запрета ГМ принимает (игрок цели не владеет)", async () => {
    await applyRelayedCommandUpdate({ uuid: "Actor.s", update: { [`flags.warhammer-dbc.${COMMAND_SUPPRESSED_FLAG}`]: { giverUuid: "Actor.show", combatId: "cb", round: 3 } } });
    expect(commandSuppressedActive(soldier)).toBe(true);
  });
  it("чужие поля сокет по-прежнему отклоняет", async () => {
    await applyRelayedCommandUpdate({ uuid: "Actor.s", update: { "flags.warhammer-dbc.somethingElse": 1 } });
    expect(soldier.getFlag("warhammer-dbc", "somethingElse")).toBeUndefined();
  });
});
