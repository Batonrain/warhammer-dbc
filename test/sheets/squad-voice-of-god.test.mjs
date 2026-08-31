// test/sheets/squad-voice-of-god.test.mjs
//
// Voice of God/Глас Божий (module/combat/voice-of-god.mjs, wdbc-sk8s) —
// интеграционная проверка через настоящий WarhammerSquadSheet::_executeCommand
// (kind:"short", ключ "personal"), тот же приём фикстур, что
// test/sheets/squad-roll.test.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { WarhammerSquadSheet } from "../../module/sheets/squad-sheet.mjs";
import { tempInfamyAmount } from "../../module/rules/temp-infamy.mjs";

function squadActor(over = {}) {
  const flags = {};
  const data = {
    name: "Копьё Императора", uuid: "Actor.sq1", isOwner: true, img: "sq.png",
    system: {
      posts: {}, members: [], risk: 4,
      cohesion: { value: 0, base: 0, start: 0 },
      derived: { cohesion: 0 },
      shortCommand: {},
      ...over
    },
    getFlag: (scope, key) => key.split(".").reduce((o, k) => o?.[k], flags[scope]),
    setFlag: async (scope, key, value) => {
      flags[scope] ??= {};
      const parts = key.split(".");
      let node = flags[scope];
      for (const k of parts.slice(0, -1)) node = (node[k] ??= {});
      node[parts.at(-1)] = value;
    }
  };
  data.update = async patch => {
    for (const [path, value] of Object.entries(patch)) {
      const parts = path.split(".");
      let cur = data;
      for (const p of parts.slice(0, -1)) { cur[p] ??= {}; cur = cur[p]; }
      cur[parts.at(-1)] = value;
    }
  };
  return data;
}

function sheetLike(actor, extra = {}) {
  return Object.assign(Object.create(WarhammerSquadSheet.prototype),
    { actor, isEditable: true, tabGroups: { primary: "roster" } }, extra);
}

function commanderPers({ hasVoiceOfGod = true, infBonus = 4 } = {}) {
  const flags = {};
  return {
    name: "Командир", img: "cmd.png", type: "character",
    items: hasVoiceOfGod ? [{ type: "talent", name: "Voice of God / Глас Божий" }] : [],
    system: {
      characteristics: { fel: { total: 45, bonus: 4 }, wp: { total: 40 }, int: { total: 38 }, inf: { bonus: infBonus } },
      skills: { command: { total: 50 }, logic: { total: 40 } },
      wounds: { value: 8, max: 12 }
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
}

function subordinate() {
  const flags = {};
  return {
    name: "Подчинённый", type: "character",
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; }
  };
}

const realFromUuidSync = globalThis.fromUuidSync;
const resolveAs = map => { globalThis.fromUuidSync = uuid => map[uuid] ?? null; };

beforeEach(resetCaptured);
afterEach(() => { globalThis.fromUuidSync = realFromUuidSync; });

describe("_executeCommand: Voice of God/Глас Божий на успешной Личной Команде", () => {
  it("Командир с Талантом, Риск 4+, лимит не исчерпан — получатель получает временное Очко Бесчестия", async () => {
    const cmdDoc = commanderPers();
    const recDoc = subordinate();
    resolveAs({ "Actor.cmd": cmdDoc, "Actor.rec": recDoc });
    const actor = squadActor({
      posts: { commander: { uuid: "Actor.cmd" } },
      shortCommand: { recipientUuid: "Actor.rec" }
    });
    captured.nextRoll = 10; // успех против порога 50
    await WarhammerSquadSheet.prototype._executeCommand.call(
      sheetLike(actor), "short", "commander", 50, { shortKey: "personal" }
    );

    expect(captured.chat[0].content).toContain("Глас Божий");
    expect(captured.chat[0].content).toContain("Подчинённый");
    expect(tempInfamyAmount(recDoc)).toBe(1);
  });

  it("без Таланта у Командира — Глас Божий не срабатывает", async () => {
    const cmdDoc = commanderPers({ hasVoiceOfGod: false });
    const recDoc = subordinate();
    resolveAs({ "Actor.cmd": cmdDoc, "Actor.rec": recDoc });
    const actor = squadActor({
      posts: { commander: { uuid: "Actor.cmd" } },
      shortCommand: { recipientUuid: "Actor.rec" }
    });
    captured.nextRoll = 10;
    await WarhammerSquadSheet.prototype._executeCommand.call(
      sheetLike(actor), "short", "commander", 50, { shortKey: "personal" }
    );

    expect(captured.chat[0].content).not.toContain("Глас Божий");
    expect(tempInfamyAmount(recDoc)).toBe(0);
  });

  it("Риск < 4 — не срабатывает", async () => {
    const cmdDoc = commanderPers();
    const recDoc = subordinate();
    resolveAs({ "Actor.cmd": cmdDoc, "Actor.rec": recDoc });
    const actor = squadActor({
      risk: 2,
      posts: { commander: { uuid: "Actor.cmd" } },
      shortCommand: { recipientUuid: "Actor.rec" }
    });
    captured.nextRoll = 10;
    await WarhammerSquadSheet.prototype._executeCommand.call(
      sheetLike(actor), "short", "commander", 50, { shortKey: "personal" }
    );

    expect(tempInfamyAmount(recDoc)).toBe(0);
  });

  it("не Личная Команда (другой ключ) — не срабатывает даже при выполненных условиях", async () => {
    const cmdDoc = commanderPers();
    const recDoc = subordinate();
    resolveAs({ "Actor.cmd": cmdDoc, "Actor.rec": recDoc });
    const actor = squadActor({
      posts: { commander: { uuid: "Actor.cmd" } },
      shortCommand: { recipientUuid: "Actor.rec" }
    });
    captured.nextRoll = 10;
    await WarhammerSquadSheet.prototype._executeCommand.call(
      sheetLike(actor), "short", "commander", 50, { shortKey: "inspire" }
    );

    expect(tempInfamyAmount(recDoc)).toBe(0);
  });

  it("Координатор (не Командир) отдаёт Команду — не срабатывает", async () => {
    const coDoc = commanderPers();
    const recDoc = subordinate();
    resolveAs({ "Actor.co": coDoc, "Actor.rec": recDoc });
    const actor = squadActor({
      posts: { coordinator: { uuid: "Actor.co" } },
      shortCommand: { recipientUuid: "Actor.rec" }
    });
    captured.nextRoll = 10;
    await WarhammerSquadSheet.prototype._executeCommand.call(
      sheetLike(actor), "short", "coordinator", 50, { shortKey: "personal" }
    );

    expect(tempInfamyAmount(recDoc)).toBe(0);
  });

  it("нет структурного получателя (пусто) — не падает, просто не выдаёт", async () => {
    const cmdDoc = commanderPers();
    resolveAs({ "Actor.cmd": cmdDoc });
    const actor = squadActor({ posts: { commander: { uuid: "Actor.cmd" } } });
    captured.nextRoll = 10;
    await expect(WarhammerSquadSheet.prototype._executeCommand.call(
      sheetLike(actor), "short", "commander", 50, { shortKey: "personal" }
    )).resolves.toBeUndefined();
  });
});
