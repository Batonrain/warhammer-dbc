// test/combat/spatial-instability.test.mjs
//
// Пространственная Нестабильность (wdbc-1rno.8): откат 12−Cor.b ч, субмутации.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  spatialCooldownSeconds, spatialSubKind, extendTempGrant, dreamPause, dreamResume, veilPierceAllows,
  SPATIAL_GRANT_FLAG, SPATIAL_COOLDOWN_FLAG
} from "../../module/rules/spatial-instability.mjs";
import {
  spatialCooldownLeft, returnToReality, extendSpatialInstability, warpDominionTest, hatredThroughVeil
} from "../../module/combat/spatial-instability.mjs";
import { ELITE_SCRIPT_API } from "../../module/combat/elite-api/index.mjs";

const SI = packDocById("packs-src/mutations/Общие_мутации", "snC2SuoOr50nguld");

function mkActor({ cor = 3, infamy = 2, granted = true } = {}) {
  const flags = {};
  const items = granted ? [{ id: "inc", name: "Incorporeal / Бесплотный", type: "trait", system: {},
    flags: { "warhammer-dbc": { [SPATIAL_GRANT_FLAG]: "Actor.A",
      tempGrant: { unit: "round", combatId: "c", expiresAtRound: 5 } } } }] : [];
  const a = {
    id: "A", uuid: "Actor.A", name: "Мутант", type: "character", isOwner: true,
    system: { corruptionBonus: cor, characteristics: { wp: { total: 40 } }, fate: { value: infamy, max: 5 } },
    items: Object.assign(items, { contents: items, get: id => items.find(i => i.id === id) }),
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; }, unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async () => {},
    updateEmbeddedDocuments: async (_t, ups) => {
      for (const u of ups) {
        const it = items.find(i => i.id === u._id);
        if (u["flags.warhammer-dbc.tempGrant"]) it.flags["warhammer-dbc"].tempGrant = u["flags.warhammer-dbc.tempGrant"];
      }
    },
    deleteEmbeddedDocuments: async (_t, ids) => { for (const id of ids) items.splice(items.findIndex(i => i.id === id), 1); }
  };
  return a;
}
const mkItem = label => {
  const flags = {};
  return { system: { submutation: { label } }, getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; } };
};

beforeEach(() => resetCaptured());

describe("арифметика", () => {
  it("откат (12−Cor.b) часов, не меньше нуля", () => {
    expect(spatialCooldownSeconds(3)).toBe(9 * 3600);
    expect(spatialCooldownSeconds(14)).toBe(0);
  });
  it("строки субмутаций", () => {
    expect(["1", "2-3", "4-5", "6", "7", "8", "9", "10", ""].map(spatialSubKind))
      .toEqual(["extend", "fly", "fear", "dream", "destroyer", "hatred", "warpPower", "breach", ""]);
  });
  it("продление и сон", () => {
    expect(extendTempGrant({ unit: "round", expiresAtRound: 4 }, 3).expiresAtRound).toBe(7);
    expect(extendTempGrant({ unit: "worldTime" }, 3)).toBeNull();
    const p = dreamPause({ unit: "round", expiresAtRound: 6 }, 4);
    expect(p.left).toBe(2);
    expect(dreamResume(p.tempGrant, 9, p.left).expiresAtRound).toBe(11);
  });
  it("пробой Завесы — только рукопашная и только по той цели", () => {
    const f = { targetUuid: "Actor.T", melee: true };
    expect(veilPierceAllows(f, "Actor.T", true)).toBe(true);
    expect(veilPierceAllows(f, "Actor.T", false)).toBe(false);
    expect(veilPierceAllows(f, "Actor.X", true)).toBe(false);
  });
});

describe("кнопки", () => {
  it("откат по worldTime на предмете", async () => {
    const item = mkItem("2-3");
    globalThis.game.time ??= {};
    game.time.worldTime = 1000;
    expect(spatialCooldownLeft(item, mkActor())).toBe(0);
    await item.setFlag(null, SPATIAL_COOLDOWN_FLAG, 1000);
    expect(spatialCooldownLeft(item, mkActor(), 1000 + 3600)).toBe(8 * 3600);
  });
  it("продление: −1 Очко Бесчестия, +Cor.b Раундов", async () => {
    const a = mkActor({ cor: 3 });
    const r = await extendSpatialInstability(a, mkItem("1"), []);
    expect(r).toBe(8);
    expect(a.items[0].flags["warhammer-dbc"].tempGrant.expiresAtRound).toBe(8);
  });
  it("кнопка чужой субмутации ничего не делает", async () => {
    expect(await extendSpatialInstability(mkActor(), mkItem("8"), [])).toBeNull();
    expect(await warpDominionTest(mkActor(), mkItem("1"))).toBeNull();
  });
  it("Власть над Варпом: тест W−30", async () => {
    captured.nextRoll = 5;
    expect(await warpDominionTest(mkActor(), mkItem("9"))).toBe(true);
    captured.nextRoll = 20;
    expect(await warpDominionTest(mkActor(), mkItem("9"))).toBe(false);
  });
  it("Ненависть сквозь Завесу: без Hatred против цели — отказ", async () => {
    expect(await hatredThroughVeil(mkActor(), { uuid: "Actor.T", name: "Т", items: [] }, mkItem("8"))).toBeNull();
  });
  it("возврат в реальность снимает Бесплотность", async () => {
    const a = mkActor();
    expect(await returnToReality(a)).toBe(1);
    expect(a.items.length).toBe(0);
  });
});

describe("пак", () => {
  it("кнопки на мутации и помощники видны скриптам", () => {
    const scripts = SI.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).filter(e => e.kind === "script");
    const calls = ["activateSpatialInstability", "returnToReality", "extendSpatialInstability", "toggleDreamWalk",
                   "hatredThroughVeil", "warpDominionTest", "breachTheVeil"];
    for (const c of calls) {
      expect(scripts.some(e => e.code.includes(`${c}(`)), c).toBe(true);
      expect(typeof ELITE_SCRIPT_API[c], c).toBe("function");
    }
  });
});
