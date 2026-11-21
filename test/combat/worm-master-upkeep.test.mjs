// test/combat/worm-master-upkeep.test.mjs
//
// Sahara 584-1d5-r: Повелитель Червей — «каждый Ход в бою, пока хотя бы один
// Рой активен, должен либо тратить полудействие, либо получать 1d5
// непоглощаемого R урона. Может рассеять любое число Роёв за свободное
// действие». Раньше это вёл стол; теперь карточка в начале Хода и кнопки.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { wormUpkeepTurnStart, wormUpkeep, dismissWormSwarms } from "../../module/combat/worm-master.mjs";

const NS = "warhammer-dbc";

function master({ wounds = 15 } = {}) {
  const a = {
    uuid: "Actor.king", name: "Король", type: "character", isOwner: true,
    items: [{ type: "trait", name: "Worm Master / Повелитель Червей" }],
    system: { corruptionBonus: 3, wounds: { value: wounds, max: 20, critical: 0 } },
    getFlag: () => undefined
  };
  a.update = async changes => {
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split("."); let node = a;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = value;
    }
    return a;
  };
  return a;
}

function swarm(masterUuid, log) {
  const s = {
    uuid: `Actor.swarm${log.length}`, name: "Рой", flags: { [NS]: { wormMasterUuid: masterUuid } },
    getFlag: (scope, key) => s.flags[scope]?.[key],
    getActiveTokens: () => s.tokens,
    delete: async () => { log.push(`actor:${s.uuid}`); }
  };
  s.tokens = [{ delete: async () => { log.push(`token:${s.uuid}`); } }];
  return s;
}

const lastCard = () => String(captured.chat.at(-1)?.content ?? "");

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { isGM: true, id: "gm" };
  globalThis.game.combat = { started: true, id: "c1", round: 1 };
  globalThis.game.actors = [];
});

describe("Повелитель Червей: поддержание Роя", () => {
  it("в начале Хода при активном Рое — карточка с тремя кнопками", async () => {
    const king = master();
    globalThis.game.actors = [swarm(king.uuid, [])];
    expect(await wormUpkeepTurnStart(king)).toBe(true);
    expect(lastCard()).toContain("wh-worm-upkeep-btn");
    expect(lastCard()).toContain('data-mode="half"');
    expect(lastCard()).toContain('data-mode="damage"');
    expect(lastCard()).toContain('data-mode="dismiss"');
  });

  it("без Роя, без Черты или вне боя — карточки нет", async () => {
    const king = master();
    expect(await wormUpkeepTurnStart(king)).toBe(false);
    globalThis.game.actors = [swarm(king.uuid, [])];
    expect(await wormUpkeepTurnStart({ ...king, items: [] })).toBe(false);
    globalThis.game.combat = null;
    expect(await wormUpkeepTurnStart(king)).toBe(false);
    expect(captured.chat).toEqual([]);
  });

  it("«1d5 R»: Раны теряются без поглощения", async () => {
    const king = master({ wounds: 15 });
    globalThis.game.actors = [swarm(king.uuid, [])];
    captured.nextRoll = 4;
    expect(await wormUpkeep(king, "damage")).toBe(true);
    expect(captured.rolls).toContain("1d5");
    expect(king.system.wounds.value).toBe(11);
  });

  it("рассеять: токены и акторы своих Роёв удаляются, чужие остаются", async () => {
    const king = master();
    const log = [];
    const mine = swarm(king.uuid, log);
    const other = swarm("Actor.other", log);
    globalThis.game.actors = [mine, other];
    expect(await dismissWormSwarms(king)).toBe(1);
    expect(log).toEqual([`token:${mine.uuid}`, `actor:${mine.uuid}`]);
  });
});
