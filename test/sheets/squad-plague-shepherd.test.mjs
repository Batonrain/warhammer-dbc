// test/sheets/squad-plague-shepherd.test.mjs
//
// Чумной Пастырь/Plague Shepherd (wdbc-w8ws) — интеграционная проверка через
// настоящий WarhammerSquadSheet::_executeCommand, тот же приём фикстур, что
// squad-voice-of-god.test.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { WarhammerSquadSheet } from "../../module/sheets/squad-sheet.mjs";

function squadActor(over = {}) {
  const data = {
    name: "Копьё Заразы", uuid: "Actor.sq1", isOwner: true, img: "sq.png",
    system: {
      posts: {}, members: [], risk: 4,
      cohesion: { value: 0, base: 0, start: 0 },
      derived: { cohesion: 0 },
      shortCommand: {},
      ...over
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

function commanderPers({ hasPlagueShepherd = true } = {}) {
  return {
    name: "Чумной Командир", img: "cmd.png", type: "character",
    items: hasPlagueShepherd ? [{ type: "mutation", name: "Plague Shepherd / Чумной Пастырь" }] : [],
    system: {
      characteristics: { fel: { total: 45, bonus: 4 }, wp: { total: 40 }, int: { total: 38 } },
      skills: { command: { total: 50 }, logic: { total: 40 } },
      wounds: { value: 8, max: 12 }
    },
    getFlag: () => undefined, setFlag: async () => {}
  };
}

function memberDoc({ uuid, patronGod = "nurgle", ablative = 0, ablativeMax = 0 } = {}) {
  const doc = {
    name: `Нурглит ${uuid}`, type: "character",
    system: { characteristics: { wp: { total: 30 }, per: { bonus: 3 } },
              patronGod, wounds: { value: 5, max: 10, ablative, ablativeMax } },
    flags: {},
    getFlag(ns, key) { return this.flags?.[ns]?.[key]; },
    async update(data) {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        let obj = doc;
        for (let i = 0; i < parts.length - 1; i++) obj = (obj[parts[i]] ??= {});
        obj[parts.at(-1)] = v;
      }
    }
  };
  return doc;
}

const realFromUuidSync = globalThis.fromUuidSync;
const resolveAs = map => { globalThis.fromUuidSync = uuid => map[uuid] ?? null; };

beforeEach(resetCaptured);
afterEach(() => { globalThis.fromUuidSync = realFromUuidSync; });

describe("_executeCommand: Чумной Пастырь (wdbc-w8ws)", () => {
  it("успешная Короткая Команда — подчинённые с покровительством Нургла получают Успехи аблативом", async () => {
    const cmdDoc = commanderPers();
    const nurglite = memberDoc({ uuid: "Actor.n1" });
    resolveAs({ "Actor.cmd": cmdDoc, "Actor.n1": nurglite });
    const actor = squadActor({
      posts: { commander: { uuid: "Actor.cmd" } },
      members: [{ id: "m1", uuid: "Actor.n1", name: nurglite.name, type: "character" }]
    });
    captured.nextRoll = 10; // успех против порога 50, глубокий (4 Успеха)
    await WarhammerSquadSheet.prototype._executeCommand.call(
      sheetLike(actor), "short", "commander", 50, { shortKey: "inspire" }
    );

    expect(nurglite.system.wounds.ablative).toBeGreaterThan(0);
    expect(nurglite.system.wounds.ablativeMax).toBe(nurglite.system.wounds.ablative);
    expect(nurglite.getFlag("warhammer-dbc", "plagueShepherdAblative")).toBe(nurglite.system.wounds.ablative);
    expect(captured.chat[0].content).toContain("Чумной Пастырь");
  });

  it("подчинённый без покровительства Нургла — ничего не получает", async () => {
    const cmdDoc = commanderPers();
    const other = memberDoc({ uuid: "Actor.n2", patronGod: "khorne" });
    resolveAs({ "Actor.cmd": cmdDoc, "Actor.n2": other });
    const actor = squadActor({
      posts: { commander: { uuid: "Actor.cmd" } },
      members: [{ id: "m2", uuid: "Actor.n2", name: other.name, type: "character" }]
    });
    captured.nextRoll = 10;
    await WarhammerSquadSheet.prototype._executeCommand.call(
      sheetLike(actor), "short", "commander", 50, { shortKey: "inspire" }
    );

    expect(other.system.wounds.ablative).toBe(0);
    expect(captured.chat[0].content).not.toContain("Чумной Пастырь");
  });

  it("командир без Мутации — ничего не получает", async () => {
    const cmdDoc = commanderPers({ hasPlagueShepherd: false });
    const nurglite = memberDoc({ uuid: "Actor.n3" });
    resolveAs({ "Actor.cmd": cmdDoc, "Actor.n3": nurglite });
    const actor = squadActor({
      posts: { commander: { uuid: "Actor.cmd" } },
      members: [{ id: "m3", uuid: "Actor.n3", name: nurglite.name, type: "character" }]
    });
    captured.nextRoll = 10;
    await WarhammerSquadSheet.prototype._executeCommand.call(
      sheetLike(actor), "short", "commander", 50, { shortKey: "inspire" }
    );

    expect(nurglite.system.wounds.ablative).toBe(0);
    expect(captured.chat[0].content).not.toContain("Чумной Пастырь");
  });

  it("провал теста — ничего не получает", async () => {
    const cmdDoc = commanderPers();
    const nurglite = memberDoc({ uuid: "Actor.n4" });
    resolveAs({ "Actor.cmd": cmdDoc, "Actor.n4": nurglite });
    const actor = squadActor({
      posts: { commander: { uuid: "Actor.cmd" } },
      members: [{ id: "m4", uuid: "Actor.n4", name: nurglite.name, type: "character" }]
    });
    captured.nextRoll = 99; // провал против порога 50
    await WarhammerSquadSheet.prototype._executeCommand.call(
      sheetLike(actor), "short", "commander", 50, { shortKey: "inspire" }
    );

    expect(nurglite.system.wounds.ablative).toBe(0);
  });

  it("не складывается с прошлой командой — второй успех заменяет, а не добавляет", async () => {
    const cmdDoc = commanderPers();
    const nurglite = memberDoc({ uuid: "Actor.n5" });
    resolveAs({ "Actor.cmd": cmdDoc, "Actor.n5": nurglite });
    const actor = squadActor({
      posts: { commander: { uuid: "Actor.cmd" } },
      members: [{ id: "m5", uuid: "Actor.n5", name: nurglite.name, type: "character" }]
    });
    captured.nextRoll = 10;
    await WarhammerSquadSheet.prototype._executeCommand.call(sheetLike(actor), "short", "commander", 50, { shortKey: "inspire" });
    const firstGrant = nurglite.system.wounds.ablative;
    expect(firstGrant).toBeGreaterThan(0);

    captured.nextRoll = 40; // слабее, но всё ещё успех — меньше Успехов
    await WarhammerSquadSheet.prototype._executeCommand.call(sheetLike(actor), "short", "commander", 50, { shortKey: "inspire" });
    expect(nurglite.system.wounds.ablative).toBeLessThan(firstGrant);
  });
});
