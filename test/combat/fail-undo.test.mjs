// test/combat/fail-undo.test.mjs
//
// Sahara task-e30b: последствия провала, которые общий исход теста (rules/kind-outcome.mjs) накладывает сразу при
// броске (Шок Инфернальной Воли, Ступор Гипно-Шрамов), не снимались, если провал потом засчитывали успехом:
// переброс за Очко / «+10» с карточки, «Провал → Очко Бесчестия → Успех» (Змеиный Язык), Хирургия Легиона,
// Мастерство. У Страха откат уже был (failUndo в флагах карточки) — теперь он есть и у остальных тестов
// (вариант А задачи): исход возвращает failUndo, карточка хранит его во флаге, обработчики откатывают.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { resolveKindOutcome } from "../../module/rules/kind-outcome.mjs";
import { revertCardFailure } from "../../module/combat/fear.mjs";
import { cardFailUndo, failUndoLabels, rerollFailUndoPlan } from "../../module/rules/fail-undo.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";
import { spendInfamyForFailSuccess } from "../../module/apps/infamy-fail-success.mjs";
import { legionSurgeryOnCard } from "../../module/combat/legion-surgery.mjs";
import { masteryAutoSuccessOnCard } from "../../module/combat/mastery.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

foundry.utils.getProperty = (object, key) => String(key).split(".").reduce((o, k) => o?.[k], object);

const NS = "warhammer-dbc";
const ROOT = path.resolve(import.meta.dirname, "../..");
const MUTATION = packDocById("packs-src/mutations/Общие_мутации", "vOiGjH4Hhao5ChM1");
const SERPENT = packDocById("packs-src/traits", "d3PBgi3D4Ye4e2Y6");
const DEFAULT_SOURCES = getRuleSources();

/** Актор с Инфернальной Волей и ровно тем, что нужно, чтобы потратить Очко Бесчестия. */
function makeActor({ uuid = "Actor.a1", extraItems = [], fate = 2 } = {}) {
  const a = {
    id: "a1", uuid, name: "Подставной", type: "character", effects: [], updates: [], isOwner: true,
    items: [
      { id: "m1", type: "mutation", name: MUTATION.name, system: structuredClone(MUTATION.system), flags: structuredClone(MUTATION.flags) },
      ...extraItems
    ],
    system: {
      characteristics: { wp: { total: 40 }, fel: { total: 20 }, int: { total: 30 }, t: { total: 35 }, ag: { total: 40, bonus: 4 } },
      fatigue: { value: 0 }, fate: { value: fate, max: 5 }, conditions: { shocked: false },
      patronGod: "khorne", corruption: { value: 0 }, alignment: "renegade"
    },
    flags: { [NS]: {} },
    getFlag(scope, key) { return key.split(".").reduce((o, k) => o?.[k], this.flags[scope]); },
    async setFlag(scope, key, v) { (this.flags[scope] ??= {})[key] = v; },
    async unsetFlag(scope, key) { delete this.flags[scope]?.[key]; },
    async update(data) {
      this.updates.push(data);
      for (const [p, v] of Object.entries(data)) {
        const parts = p.split(".");
        const last = parts.pop();
        let node = this;
        for (const k of parts) node = (node[k] ??= {});
        if (last.startsWith("-=")) delete node[last.slice(2)];
        else node[last] = v;
      }
    },
    async createEmbeddedDocuments(type, docs) {
      const made = docs.map(d => ({ ...d, getFlag: (s, k) => d.flags?.[s]?.[k], delete: async () => {} }));
      a.effects.push(...made);
      return made;
    }
  };
  return a;
}

let seq = 0;
const fakeMessage = (flags = {}) => ({
  id: `fu${++seq}`, isOwner: true, speaker: {}, flags: { [NS]: { ...flags } },
  getFlag(ns, k) { return this.flags[ns]?.[k]; },
  async setFlag(ns, k, v) { (this.flags[ns] ??= {})[k] = v; }
});

const realFromUuid = globalThis.fromUuid;
let prev;
beforeEach(() => {
  resetCaptured();
  prev = { socket: game.socket, users: game.users, user: game.user };
  game.socket = { emit() {} };
  game.users = Object.assign([], { activeGM: { id: "gm" } });
  game.user = { id: "u1" };
});
afterEach(() => {
  globalThis.fromUuid = realFromUuid;
  Object.assign(game, prev);
  clearRuleSources();
  for (const [k, fn] of DEFAULT_SOURCES) registerRuleSource(k, fn);
});

/** Провал на 4 Провала теста Навыка: Шок Инфернальной Воли наложен, откат — в исходе. */
async function failWithShock(actor) {
  captured.nextRoll = 50;   // бросок Шока (строка с Состоянием «Шок»)
  return resolveKindOutcome(actor, { baseEff: 20, rv: 50, ctx: { actor, kind: "skill", skill: "charm", char: "fel" } });
}

describe("исход теста хранит откат наложенных последствий", () => {
  it("Шок Инфернальной Воли: в исходе есть failUndo с Состоянием «Шок»", async () => {
    const a = makeActor();
    const o = await failWithShock(a);
    expect(a.system.conditions.shocked).toBe(true);
    expect(o.failUndo?.infernalWillShock?.conditions).toContain("shocked");
  });

  it("последствий нет (успех, 3 Провала) — failUndo пустой", async () => {
    const a = makeActor();
    const o = await resolveKindOutcome(a, { baseEff: 20, rv: 49, ctx: { actor: a, kind: "skill", skill: "charm", char: "fel" } });
    expect(o.failUndo ?? null).toBeNull();
    const ok = await resolveKindOutcome(a, { baseEff: 60, rv: 10, ctx: { actor: a, kind: "skill", skill: "charm", char: "fel" } });
    expect(ok.failUndo ?? null).toBeNull();
  });

  it("Ступор Гипно-Шрамов при Крит. Провале теста I: откат в исходе", async () => {
    const a = makeActor();
    clearRuleSources();
    registerRuleSource("t", () => [{ id: "h", effects: [{ kind: "grantFlag", target: "trait.hypnoScars" }] }]);
    const o = await resolveKindOutcome(a, { baseEff: 30, rv: 99, ctx: { actor: a, kind: "skill", char: "int" } });
    expect(o.critLine).toContain("Гипно-Шрамы");
    expect(o.failUndo?.hypno?.conditions).toContain("dazed");
  });
});

describe("карточка → откат", () => {
  it("cardFailUndo кладёт uuid бросавшего; пустой откат — null", () => {
    expect(cardFailUndo({ uuid: "Actor.x" }, null)).toBeNull();
    expect(cardFailUndo({ uuid: "Actor.x" }, {})).toBeNull();
    expect(cardFailUndo({ uuid: "Actor.x" }, { hypno: { conditions: ["dazed"] } }))
      .toEqual({ actorUuid: "Actor.x", hypno: { conditions: ["dazed"] } });
    expect(failUndoLabels({ infernalWillShock: {}, hypno: {} }).join(" ")).toMatch(/Шок.*Ступор/);
  });

  it("revertCardFailure снимает Шок, помечает карточку и второй раз ничего не делает", async () => {
    const a = makeActor();
    const o = await failWithShock(a);
    globalThis.fromUuid = async () => a;
    const message = fakeMessage({ failUndo: cardFailUndo(a, o.failUndo) });
    expect(await revertCardFailure(message)).toEqual(["Шок Инфернальной Воли"]);
    expect(a.system.conditions.shocked).toBe(false);
    expect(message.flags[NS].failUndoSettled).toBe(true);
    // Новый Шок от другого события не должен сниматься устаревшим откатом.
    a.system.conditions.shocked = true;
    expect(await revertCardFailure(message)).toEqual([]);
    expect(a.system.conditions.shocked).toBe(true);
  });

  it("карточка без отката (прежние сообщения) — revertCardFailure ничего не делает", async () => {
    expect(await revertCardFailure(fakeMessage())).toEqual([]);
  });

  it("«failUndoSettled» есть в белом списке флагов карточки (ретрансляция ГМу)", () => {
    expect(CARD_ONCE_FLAGS).toContain("failUndoSettled");
  });
});

describe("план отката при «Переброс за Очко»", () => {
  const undo = { actorUuid: "Actor.x", infernalWillShock: { conditions: ["shocked"] } };
  it("переброс удался — снять; провалился снова — передать новой карточке; без порога — ничего", () => {
    expect(rerollFailUndoPlan({ prevFailUndo: undo, hit: true })).toEqual({ revert: true, carry: false });
    expect(rerollFailUndoPlan({ prevFailUndo: undo, hit: false })).toEqual({ revert: false, carry: true });
    expect(rerollFailUndoPlan({ prevFailUndo: undo, hit: null })).toEqual({ revert: false, carry: false });
  });
  it("нет отката или карточка уже закрыта (повторный переброс) — ничего: откат не размножается", () => {
    expect(rerollFailUndoPlan({ prevFailUndo: null, hit: true })).toEqual({ revert: false, carry: false });
    expect(rerollFailUndoPlan({ prevFailUndo: undo, hit: false, settled: true })).toEqual({ revert: false, carry: false });
    expect(rerollFailUndoPlan({ prevFailUndo: undo, hit: true, settled: true })).toEqual({ revert: false, carry: false });
  });
});

describe("откат не трогает то, что висело до броска", () => {
  it("персонаж уже в Шоке (после Страха): новый Шок снят, прежний остался", async () => {
    const a = makeActor();
    a.system.conditions.shocked = true;
    const o = await failWithShock(a);
    expect(o.failUndo?.infernalWillShock?.conditions ?? []).not.toContain("shocked");
    globalThis.fromUuid = async () => a;
    await revertCardFailure(fakeMessage({ failUndo: cardFailUndo(a, o.failUndo) }));
    expect(a.system.conditions.shocked).toBe(true);
  });

  it("Ступор Гипно-Шрамов снимается откатом, уже бывший Ступор — нет", async () => {
    const setup = () => {
      clearRuleSources();
      registerRuleSource("t", () => [{ id: "h", effects: [{ kind: "grantFlag", target: "trait.hypnoScars" }] }]);
    };
    const a = makeActor();
    setup();
    const o = await resolveKindOutcome(a, { baseEff: 30, rv: 99, ctx: { actor: a, kind: "skill", char: "int" } });
    expect(a.system.conditions.dazed).toBeTruthy();
    globalThis.fromUuid = async () => a;
    await revertCardFailure(fakeMessage({ failUndo: cardFailUndo(a, o.failUndo) }));
    expect(a.system.conditions.dazed).toBeFalsy();

    const b = makeActor();
    b.system.conditions.dazed = true;
    const o2 = await resolveKindOutcome(b, { baseEff: 30, rv: 99, ctx: { actor: b, kind: "skill", char: "int" } });
    expect(o2.failUndo ?? null).toBeNull();
  });
});

describe("провал засчитан успехом после карточки — Шок снимается", () => {
  async function shockedVictim() {
    const victim = makeActor({ uuid: "Actor.victim" });
    const o = await failWithShock(victim);
    expect(victim.system.conditions.shocked).toBe(true);
    globalThis.fromUuid = async () => victim;
    return { victim, message: fakeMessage({ failUndo: cardFailUndo(victim, o.failUndo) }) };
  }

  it("«Провал → Очко Бесчестия → Успех» (Змеиный Язык)", async () => {
    const { victim, message } = await shockedVictim();
    const actor = makeActor({ uuid: "Actor.victim",
      extraItems: [{ id: "t0", name: SERPENT.name, type: SERPENT.type, system: SERPENT.system, flags: SERPENT.flags }] });
    globalThis.fromUuid = async () => victim;
    expect(await spendInfamyForFailSuccess(actor, "trait.serpentSTongue", { testLabel: "Очарование", message })).toBe(true);
    expect(victim.system.conditions.shocked).toBe(false);
    expect(captured.chat.at(-1).content).toContain("Шок Инфернальной Воли");
  });

  it("Хирургия Легиона", async () => {
    const { victim, message } = await shockedVictim();
    const medic = makeActor({ uuid: "Actor.medic" });
    expect(await legionSurgeryOnCard(medic, "Медицина", message)).toBe(true);
    expect(victim.system.conditions.shocked).toBe(false);
  });

  it("Мастерство: автоуспех", async () => {
    const { victim, message } = await shockedVictim();
    const master = makeActor({ uuid: "Actor.master",
      extraItems: [{ type: "talent", name: "Mastery / Мастерство", system: { aptSource: "dodge" } }] });
    message.speaker = {};
    const skillTest = { skill: "dodge", char: "ag", label: "Уклонение", success: false, deg: 1, mod: 0 };
    expect(await masteryAutoSuccessOnCard(master, skillTest, message)).toBe(true);
    expect(victim.system.conditions.shocked).toBe(false);
  });
});

describe("стыковка: карточки хранят откат, обработчики его зовут", () => {
  const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

  it("«Переброс за Очко» и «+10» откатывают только когда тест стал успехом", () => {
    const hooks = read("module/hooks.mjs");
    const reroll = hooks.indexOf("const doReroll");
    const bonus = hooks.indexOf("const doBonus");
    expect(hooks.slice(reroll, bonus)).toMatch(/failPlan\.revert[\s\S]{0,200}revertCardFailure\(message\)/);
    expect(hooks.slice(reroll, bonus)).toMatch(/failPlan\.carry[\s\S]{0,300}revertCardFailure\(message, \{ keep: true \}\)/);
    expect(hooks.slice(bonus, bonus + 6000)).toMatch(/outcome\.success[\s\S]{0,200}revertCardFailure\(message\)/);
  });

  it("карточка теста с листа кладёт failUndo во флаги", () => {
    expect(read("module/sheets/actor-sheet.mjs")).toMatch(/cardFailUndo\(effectActor, outcome\.failUndo\)/);
  });

  it("карточки верховых тестов кладут failUndo во флаги", () => {
    const mount = read("module/combat/mount.mjs");
    expect(mount).toContain("cardFailUndo(actor, outcome?.failUndo)");
  });
});
