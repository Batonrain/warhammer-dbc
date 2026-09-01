import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { demonsInHeraldLocus, applyTouchedByFates } from "../../module/rules/daemon-locus.mjs";

function daemonActor({ name, allegiance, rank, hasTrait = false, fate = { value: 0, max: 3 } }) {
  const items = hasTrait
    ? [{ type: "trait", name: "Touched by the Fates / Избранный Судьбой (1)" }]
    : [];
  const updates = [];
  return {
    name, type: "daemon",
    system: { allegiance, rank, fate },
    items,
    createEmbeddedDocuments: async (_type, data) => { items.push(...data.map(d => ({ type: "trait", name: d.name }))); },
    update: async data => { updates.push(data); Object.assign(fate, { value: data["system.fate.value"] ?? fate.value }); },
    _updates: updates
  };
}

function token(id, actor, x = 0, y = 0) {
  return { id, actor, x, y, width: 1, height: 1, elevation: 0 };
}

afterEach(() => {
  delete globalThis.canvas;
  delete globalThis.game;
  delete globalThis.ui;
  delete globalThis.ChatMessage;
});

describe("demonsInHeraldLocus (стр. 27, ½W м, тот же Бог, рангом ниже)", () => {
  it("собирает демонов того же Бога рангом ниже в радиусе ½W, отсеивает остальных", () => {
    const herald = daemonActor({ name: "Герольд", allegiance: "khorne", rank: "herald" });
    const heraldToken = token("herald-tok", herald, 0, 0);
    herald.getActiveTokens = () => [heraldToken];

    const near = daemonActor({ name: "Ближний Ужас", allegiance: "khorne", rank: "lesser" });
    const far  = daemonActor({ name: "Дальний Ужас", allegiance: "khorne", rank: "lesser" });
    const otherGod = daemonActor({ name: "Чужой Бог", allegiance: "nurgle", rank: "lesser" });
    const tooHighRank = daemonActor({ name: "Высший демон", allegiance: "khorne", rank: "greater" });
    const notDaemon = { type: "character", system: {} };

    // W.total=40 → радиус 20м. grid.size=100px/клетка=1м.
    globalThis.canvas = {
      scene: {
        grid: { size: 100, distance: 1 },
        tokens: [
          heraldToken,
          token("t-near", near, 1000, 0),    // 10м (px = м×size) — в радиусе
          token("t-far", far, 3000, 0),      // 30м — вне радиуса (20м)
          token("t-god", otherGod, 500, 0),
          token("t-rank", tooHighRank, 500, 0),
          token("t-nd", notDaemon, 500, 0)
        ]
      }
    };
    herald.system.characteristics = { w: { total: 40 } };

    const result = demonsInHeraldLocus(herald);
    expect(result).toEqual([near]);
  });

  it("нет активного токена герольда — пустой список", () => {
    const herald = daemonActor({ name: "Герольд", allegiance: "khorne", rank: "herald" });
    herald.getActiveTokens = () => [];
    herald.system.characteristics = { w: { total: 40 } };
    globalThis.canvas = { scene: { grid: { size: 100, distance: 1 }, tokens: [] } };
    expect(demonsInHeraldLocus(herald)).toEqual([]);
  });
});

describe("applyTouchedByFates (Локус Фанатизма, стр. 28, wdbc-smc)", () => {
  function setupChat() {
    const posted = [];
    globalThis.ChatMessage = {
      applyRollMode: data => data,
      getSpeaker: ({ actor } = {}) => ({ alias: actor?.name }),
      create: async data => { posted.push(data); }
    };
    globalThis.game = {
      ...globalThis.game,
      settings: { get: () => "roll" },
      packs: {
        get: () => ({
          getIndex: async () => [{ _id: "tbf-id", name: "Touched by the Fates / Избранный Судьбой (X)" }],
          getDocument: async () => ({ toObject: () => ({ _id: "tbf-id", type: "trait", name: "Touched by the Fates / Избранный Судьбой (1)" }) })
        })
      }
    };
    return posted;
  }

  it("нет целей в радиусе — предупреждает и ничего не делает", async () => {
    const warned = [];
    globalThis.ui = { notifications: { warn: msg => warned.push(msg) } };
    const herald = daemonActor({ name: "Герольд", allegiance: "khorne", rank: "herald" });
    herald.getActiveTokens = () => [];
    herald.system.characteristics = { w: { total: 40 } };
    globalThis.canvas = { scene: { grid: { size: 100, distance: 1 }, tokens: [] } };

    const applied = await applyTouchedByFates(herald);
    expect(applied).toBe(false);
    expect(warned).toHaveLength(1);
  });

  it("выдаёт Трейт демону без него, восстанавливает Очко Судьбы демону с ним", async () => {
    const posted = setupChat();
    const herald = daemonActor({ name: "Герольд", allegiance: "khorne", rank: "herald" });
    const heraldToken = token("herald-tok", herald, 0, 0);
    herald.getActiveTokens = () => [heraldToken];
    herald.system.characteristics = { w: { total: 40 } };

    const fresh = daemonActor({ name: "Свежий Ужас", allegiance: "khorne", rank: "lesser" });
    const already = daemonActor({ name: "Уже Избранный", allegiance: "khorne", rank: "lesser", hasTrait: true, fate: { value: 1, max: 3 } });

    globalThis.canvas = {
      scene: {
        grid: { size: 100, distance: 1 },
        tokens: [heraldToken, token("t1", fresh, 5, 0), token("t2", already, 5, 0)]
      }
    };

    const applied = await applyTouchedByFates(herald);
    expect(applied).toBe(true);
    expect(fresh.items.some(i => i.name.includes("Touched by the Fates"))).toBe(true);
    expect(already.system.fate.value).toBe(2);
    expect(posted).toHaveLength(1);
  });
});
