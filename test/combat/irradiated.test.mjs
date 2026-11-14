// test/combat/irradiated.test.mjs
//
// Облучённый / Irradiated (Дар Нургла, wdbc-1rno): аура 3 м бьёт попаданием
// Рад(1d10) в начале Хода каждой жертвы; носитель сам неуязвим к радиации.
// Задача Sahara «rad»: пробитие — Cor.b носителя − поглощение торса > 0, а
// пробитое попадание — это ровно Rad (X) книги (combat/radiation.mjs::
// applyRadHit): 1d10 урона в T без теста и без Состояния «Радиация».

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import {
  radAuraBreach, canTakeRadiation, irradiatedSourcesNear,
  processIrradiatedTurnStart, IRRADIATED
} from "../../module/combat/irradiated.mjs";
import { COMBAT_RAD_FLAG } from "../../module/rules/radiation-combat.mjs";

function giftItems(key) {
  return key ? [{
    id: "gift", type: "mutation", name: "Irradiated",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  }] : [];
}

/** Актор жертвы + носители Дара рядом (все в одной клетке — проверяется не геометрия). */
function scene({ victimGift = null, victimImmune = false, ap = 0, tb = 0, tTotal = 40,
                 sources = [], conditions = {} } = {}) {
  const items = giftItems(victimGift);
  if (victimImmune) items.push({
    id: "imm", type: "trait", name: "Иммунитет",
    flags: { "warhammer-dbc": { mechanics: [{ id: "gi", operator: "AND", entries: [
      { id: "ei", kind: "condition", condKey: "radiation", condMode: "immunity" }
    ] }] } }
  });
  const updates = [];
  const flags = {};
  const victim = {
    name: "Жертва", type: "character", uuid: "Actor.victim", isOwner: true,
    system: {
      conditions: { ...conditions },
      absorption: { body: ap + tb, toughnessBonus: tb },
      characteristics: { t: { total: tTotal } },
      charLoss: { t: 0 }, charLossAt: {}
    },
    items: Object.assign(items.slice(), { contents: items }),
    updates,
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async patch => {
      updates.push(patch);
      for (const [path, value] of Object.entries(patch)) {
        const m = path.match(/^flags.warhammer-dbc.(.+)$/);
        if (m) flags[m[1]] = value;
        else if (path === "system.charLoss.t") victim.system.charLoss.t = value;
      }
    }
  };
  const tokens = [];
  const self = { id: "self", hidden: false, actor: victim, x: 0, y: 0, width: 1, height: 1 };
  tokens.push(self);
  sources.forEach((s, i) => {
    const si = giftItems(s.gift === undefined ? IRRADIATED : s.gift);
    tokens.push({
      id: `s${i}`, hidden: false, x: 0, y: 0, width: 1, height: 1,
      actor: {
        name: s.name ?? `Чемпион ${i}`, type: "character",
        system: { corruptionBonus: s.corB ?? 0 },
        items: Object.assign(si.slice(), { contents: si })
      }
    });
  });
  const parent = { tokens: Object.assign(tokens.slice(), { contents: tokens }), grid: { size: 100, distance: 1, type: 0 } };
  for (const t of tokens) t.parent = parent;
  return { victim, token: self };
}

describe("radAuraBreach", () => {
  // Расчёт пробития книги: Cor.b как урон против AP торса ×2, T.b игнорируется.
  const soak = (ap, tb = 0) => ({ body: ap + tb, toughnessBonus: tb });

  it("Cor.b больше удвоенного AP — броня пробита", () => {
    expect(radAuraBreach(8, soak(3))).toEqual({ armorAP: 3, breachAbsorption: 6, breached: true });
  });
  it("Cor.b ровно равно удвоенному AP — не пробито (остаток должен быть > 0)", () => {
    expect(radAuraBreach(6, soak(3)).breached).toBe(false);
    expect(radAuraBreach(7, soak(3)).breached).toBe(true);
  });
  it("T.b цели не мешает: без брони Cor.b 3 против T.b 3 — пробито (по обычному поглощению было бы 3−3=0)", () => {
    expect(radAuraBreach(3, soak(0, 3))).toEqual({ armorAP: 0, breachAbsorption: 0, breached: true });
  });
  it("T.b цели не помогает: AP 6, T.b 4, Cor.b 12 — AP×2=12, пробития нет (по AP+T.b было бы 12−10=2)", () => {
    expect(radAuraBreach(12, soak(6, 4))).toEqual({ armorAP: 6, breachAbsorption: 12, breached: false });
  });
  it("Cor.b носителя 0 — не пробивает никогда", () => {
    expect(radAuraBreach(0, soak(0)).breached).toBe(false);
  });
  it("нет данных о поглощении — броня считается нулевой", () => {
    expect(radAuraBreach(2, undefined)).toEqual({ armorAP: 0, breachAbsorption: 0, breached: true });
  });
});

describe("canTakeRadiation", () => {
  it("существо с уроном в Характеристики — да, техника без него — нет", () => {
    expect(canTakeRadiation({ system: { charLoss: { t: 0 } } })).toBe(true);
    expect(canTakeRadiation({ system: { conditions: {} } })).toBe(false);
  });
});

describe("irradiatedSourcesNear", () => {
  it("видит только носителей Дара, посторонних рядом не считает", () => {
    const { token } = scene({ sources: [{ corB: 4 }, { gift: null }] });
    expect(irradiatedSourcesNear(token)).toHaveLength(1);
  });
});

describe("processIrradiatedTurnStart", () => {
  // captured.dice — очередь выпадающих кубов заглушки: единственный куб —
  // Рад(1d10); теста сопротивления при попадании у ауры больше нет.
  beforeEach(() => {
    resetCaptured(); captured.dice = [];
    globalThis.game.time = { worldTime: 1000 };
    globalThis.game.combats = [];
  });

  it("броня пробита — 1d10 урона в T без теста, Состояние Радиации не копится", async () => {
    const { victim, token } = scene({ tTotal: 40, sources: [{ corB: 10 }] });
    captured.dice = [6];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.system.charLoss.t).toBe(6);
    expect(captured.rolls).toEqual(["1d10"]);
    expect(victim.updates.some(u => Object.keys(u).some(k => k.startsWith("system.conditions")))).toBe(false);
    expect(captured.chat.some(c => String(c.content).includes("урон в T без теста"))).toBe(true);
  });

  it("пробитие не зависит от выпавшего Рад: AP 2, Cor.b 5 — пробито, урон равен выпавшему", async () => {
    const { victim, token } = scene({ ap: 2, tb: 4, sources: [{ corB: 5 }] });
    captured.dice = [9];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.system.charLoss.t).toBe(9);
  });

  it("Cor.b ровно равно удвоенному AP — не пробито: ни броска, ни урона, в чате «не пробита»", async () => {
    const { victim, token } = scene({ ap: 3, tb: 9, sources: [{ corB: 6 }] });
    captured.dice = [7];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.system.charLoss.t).toBe(0);
    expect(captured.dice).toEqual([7]);
    expect(captured.chat.some(c => String(c.content).includes("броня не пробита"))).toBe(true);
  });

  it("броня держит Cor.b целиком — кубик Рад не тратится", async () => {
    const { victim, token } = scene({ ap: 50, sources: [{ corB: 3 }] });
    captured.dice = [1];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.system.charLoss.t).toBe(0);
    expect(captured.dice).toEqual([1]);
  });

  it("в бою урон идёт в счётчик «10+ за бой» (общий с радиевым оружием)", async () => {
    const { victim, token } = scene({ sources: [{ corB: 10 }] });
    globalThis.game.combats = [{ id: "c1", started: true, combatants: [{ actor: victim }] }];
    captured.dice = [6];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.getFlag("warhammer-dbc", COMBAT_RAD_FLAG)).toEqual({ combatId: "c1", amount: 6 });
  });

  it("сам носитель Дара своей аурой не облучается", async () => {
    const { victim, token } = scene({ victimGift: IRRADIATED, sources: [{ corB: 10 }] });
    await processIrradiatedTurnStart(victim, token);
    expect(victim.system.charLoss.t).toBe(0);
    expect(captured.rolls).toEqual([]);
  });

  it("объявленный иммунитет к Радиации гасит весь эффект", async () => {
    const { victim, token } = scene({ victimImmune: true, sources: [{ corB: 10 }] });
    captured.dice = [5];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.system.charLoss.t).toBe(0);
    expect(captured.rolls).toEqual([]);
    expect(captured.chat).toEqual([]);
  });

  it("жертва без Характеристики T (Техника/Орда) — аура её не трогает", async () => {
    const { victim, token } = scene({ sources: [{ corB: 10 }] });
    delete victim.system.charLoss;
    captured.dice = [5];
    await processIrradiatedTurnStart(victim, token);
    expect(captured.rolls).toEqual([]);
    expect(captured.chat).toEqual([]);
  });

  it("носителей рядом нет — ничего не происходит", async () => {
    const { victim, token } = scene({ sources: [{ gift: null }] });
    await processIrradiatedTurnStart(victim, token);
    expect(victim.system.charLoss.t).toBe(0);
    expect(captured.rolls).toEqual([]);
  });

  it("два носителя рядом — два независимых попадания, урон складывается", async () => {
    const { victim, token } = scene({ sources: [{ corB: 10 }, { corB: 10 }] });
    captured.dice = [6, 3];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.system.charLoss.t).toBe(9);
  });

  it("два носителя с разным Cor.b — бьёт только тот, чей Cor.b пробил броню", async () => {
    const { victim, token } = scene({ ap: 3, tb: 6, sources: [{ corB: 6 }, { corB: 7 }] });
    captured.dice = [5];
    await processIrradiatedTurnStart(victim, token);
    expect(victim.system.charLoss.t).toBe(5);
    expect(captured.rolls).toHaveLength(1);
  });
});
