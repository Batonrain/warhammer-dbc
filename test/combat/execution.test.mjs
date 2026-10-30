// test/combat/execution.test.mjs
//
// Черта «Казнь» Мастера Казней, Foundry-обвязка (Sahara fear-2, решение владельца 30.10.2026 — автоматизировать
// всё). Кнопка «Казнь: ещё атака» на карточке рукопашной атаки двуручным оружием в двуручном хвате; клик —
// диалог ГМа «достойна ли цель» (Inf определяет число доп. атак: 30–59 — 2, 60–79 — 3, 80+ — 4), потом окно атаки
// «той же Базой и Обычной Атакой» за свободное действие; серия — раз в Раунд, по одной цели; «не убил» = смерть
// цели не констатирована. Серия записывается на «Бросок!» окна, не на клик: закрытое окно ничего не съедает.
// Актор — настоящая схема, Черта и оружие — документы настоящего пака.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import {
  EXECUTION_CARD_FLAG, EXECUTION_SERIES_FLAG, executionOfferHtml, startExecutionFollow,
  executionPayProblem, commitExecutionStep
} from "../../module/combat/execution.mjs";
import { trophyWorthyDecision } from "../../module/combat/trophy-kill.mjs";
import { freeMeleeFlags, freeAttackLockProblem } from "../../module/rules/melee-talents.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function packDoc(dir, idTail) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => {
    const p = path.join(d, f.name);
    return f.isDirectory() ? walk(p) : (f.name.endsWith(`_${idTail}.json`) ? [p] : []);
  });
  const [file] = walk(path.join(ROOT, "packs-src", dir));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
const EXECUTION = () => packDoc("traits", "OWulIfHDWHU1DvxB");

function makeActor({ docs = [], uuid = "Actor.k", name = "Мастер Казней", infBase = 0, deceased = false } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.inf.base = infBase;
  const items = docs.map((d, i) => ({ id: `i${i}`, name: d.name, type: d.type, system: d.system, flags: d.flags ?? {}, getFlag: () => undefined }));
  items.get = () => null;
  const store = deceased ? { deceased: true } : {};
  const dialogs = [];
  const actor = {
    type: "character", name, uuid, system, items, isOwner: true, flagsStore: store,
    getFlag: (s, k) => store[k], setFlag: async (s, k, v) => { store[k] = v; }, unsetFlag: async (s, k) => { delete store[k]; },
    sheet: { _showAttackDialog: async (weapon, opts) => { dialogs.push({ weapon, opts }); } }, dialogs,
    async update() {}
  };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return actor;
}
const sword = (grips = "2р (1р)") => ({ uuid: "Item.sword", name: "Двуручный меч", system: { weaponClass: "melee", grips } });

let registry, prevFromUuid;
beforeEach(() => {
  resetCaptured();
  registry = {};
  prevFromUuid = globalThis.fromUuid;
  globalThis.fromUuid = async u => registry[u] ?? null;
  globalThis.game.combat = { id: "cb", round: 2, started: true };
  globalThis.game.user = { id: "u", isGM: true, targets: new Set() };
  globalThis.canvas = { tokens: { placeables: [] } };
});
afterEach(() => {
  globalThis.fromUuid = prevFromUuid;
  globalThis.game.combat = undefined;
  globalThis.game.user = {};
  delete globalThis.canvas;
});

const target = (patch = {}) => makeActor({ uuid: "Actor.v", name: "Чемпион", infBase: 55, ...patch });
const offer = (actor, over = {}) => executionOfferHtml(actor, {
  isMelee: true, weapon: sword(), gripKey: "2р", defender: target(), defenderTokenUuid: "Scene.s.Token.v", baseKey: "standard", ...over
});

describe("кнопка «Казнь» на карточке рукопашной атаки", () => {
  it("носитель Черты, двуручное оружие в двуручном хвате, цель жива, идёт бой — кнопка есть, с адресами", () => {
    const html = offer(makeActor({ docs: [EXECUTION()] }));
    expect(html).toContain("wh-execution-btn");
    expect(html).toContain('data-attacker-uuid="Actor.k"');
    expect(html).toContain('data-weapon-uuid="Item.sword"');
    expect(html).toContain('data-target-uuid="Actor.v"');
    expect(html).toContain('data-target-token-uuid="Scene.s.Token.v"');
    expect(html).toContain('data-base="standard"');
  });

  it("без Черты, не двуручное оружие / не двуручный хват, не рукопашная, нет цели, вне боя — кнопки нет", () => {
    const holder = makeActor({ docs: [EXECUTION()] });
    expect(offer(makeActor())).toBe("");
    expect(offer(holder, { weapon: sword("1р (2р)") })).toBe("");
    expect(offer(holder, { gripKey: "1р" })).toBe("");
    expect(offer(holder, { isMelee: false })).toBe("");
    expect(offer(holder, { defender: null })).toBe("");
    globalThis.game.combat = undefined;
    expect(offer(holder)).toBe("");
  });

  it("цель уже мертва (смерть констатирована) — «не убил» не выполнено, кнопки нет", () => {
    expect(offer(makeActor({ docs: [EXECUTION()] }), { defender: target({ deceased: true }) })).toBe("");
  });

  it("серия идёт: кнопка показывает, сколько атак осталось; исчерпана или другая цель — кнопки нет", async () => {
    const holder = makeActor({ docs: [EXECUTION()] });
    await holder.setFlag("warhammer-dbc", EXECUTION_SERIES_FLAG, { combatId: "cb", round: 2, targetUuid: "Actor.v", total: 3, used: 1 });
    expect(offer(holder)).toContain("осталось 2");
    await holder.setFlag("warhammer-dbc", EXECUTION_SERIES_FLAG, { combatId: "cb", round: 2, targetUuid: "Actor.v", total: 3, used: 3 });
    expect(offer(holder)).toBe("");
    await holder.setFlag("warhammer-dbc", EXECUTION_SERIES_FLAG, { combatId: "cb", round: 2, targetUuid: "Actor.other", total: 3, used: 1 });
    expect(offer(holder)).toBe("");
    // прошлый Раунд — серия не в счёт
    await holder.setFlag("warhammer-dbc", EXECUTION_SERIES_FLAG, { combatId: "cb", round: 1, targetUuid: "Actor.other", total: 3, used: 3 });
    expect(offer(holder)).toContain("wh-execution-btn");
  });

  it("флаг отметки «раз на карточку» зарегистрирован", () => {
    expect(EXECUTION_CARD_FLAG).toBe("executionUsed");
  });
});

describe("диалог ГМа «достойна ли цель»", () => {
  it("«Достойна» отдаёт Inf из поля; «Не достойна» — null", async () => {
    const p = trophyWorthyDecision({ victimName: "Чемпион", inf: 55, askInf: true });
    await new Promise(r => setTimeout(r, 0));
    expect(captured.dialog.content).toContain("Inf цели");
    await captured.press("ok", fakeForm({ "#trophy-worthy-inf": "72" }));
    expect(await p).toEqual({ inf: 72 });
    const p2 = trophyWorthyDecision({ victimName: "Чемпион", inf: 55, askInf: true });
    await new Promise(r => setTimeout(r, 0));
    await captured.press("no", fakeForm({}));
    expect(await p2).toBe(null);
  });
});

describe("startExecutionFollow: клик по кнопке", () => {
  const click = (attacker, over = {}) => startExecutionFollow(attacker, sword(), {
    targetUuid: "Actor.v", targetTokenUuid: "Scene.s.Token.v", baseKey: "standard", messageId: "m1",
    decide: async () => ({ inf: 55 }), ...over
  });

  it("ГМ признал цель достойной (Inf 55): окно атаки — та же База, Обычная Атака, свободная; серия не записана до «Бросок!»", async () => {
    const attacker = makeActor({ docs: [EXECUTION()] });
    registry["Actor.v"] = target();
    expect(await click(attacker)).toBe(true);
    expect(attacker.dialogs).toHaveLength(1);
    const { opts } = attacker.dialogs[0];
    expect(opts).toMatchObject({ forceBase: "standard", technique: "standard", executionFollow: true });
    expect(opts.payOnRoll).toMatchObject({ label: "Казнь", cardId: "m1", cardKey: EXECUTION_CARD_FLAG, execution: { targetUuid: "Actor.v", total: 2 } });
    expect(attacker.flagsStore[EXECUTION_SERIES_FLAG]).toBeUndefined();
  });

  it("число доп. атак по Inf из диалога: 65 → 3, 85 → 4", async () => {
    for (const [inf, total] of [[65, 3], [85, 4]]) {
      const attacker = makeActor({ docs: [EXECUTION()] });
      registry["Actor.v"] = target();
      await click(attacker, { decide: async () => ({ inf }) });
      expect(attacker.dialogs[0].opts.payOnRoll.execution.total).toBe(total);
    }
  });

  it("ГМ: «не достойна» — окна нет", async () => {
    const attacker = makeActor({ docs: [EXECUTION()] });
    registry["Actor.v"] = target();
    expect(await click(attacker, { decide: async () => null })).toBe(false);
    expect(attacker.dialogs).toHaveLength(0);
  });

  it("Inf ниже 30 — одна дополнительная атака: окно есть, total 1", async () => {
    const attacker = makeActor({ docs: [EXECUTION()] });
    registry["Actor.v"] = target();
    expect(await click(attacker, { decide: async () => ({ inf: 20 }) })).toBe(true);
    expect(attacker.dialogs[0].opts.payOnRoll.execution.total).toBe(1);
  });

  it("цель мертва — окна нет; диалог ГМа даже не открывается", async () => {
    const attacker = makeActor({ docs: [EXECUTION()] });
    registry["Actor.v"] = target({ deceased: true });
    let asked = false;
    expect(await click(attacker, { decide: async () => { asked = true; return { inf: 55 }; } })).toBe(false);
    expect(asked).toBe(false);
    expect(attacker.dialogs).toHaveLength(0);
  });

  it("серия жива: диалог ГМа не повторяется, число берётся из записи", async () => {
    const attacker = makeActor({ docs: [EXECUTION()] });
    registry["Actor.v"] = target();
    await attacker.setFlag("warhammer-dbc", EXECUTION_SERIES_FLAG, { combatId: "cb", round: 2, targetUuid: "Actor.v", total: 3, used: 1 });
    let asked = false;
    expect(await click(attacker, { decide: async () => { asked = true; return { inf: 5 }; } })).toBe(true);
    expect(asked).toBe(false);
    expect(attacker.dialogs[0].opts.payOnRoll.execution.total).toBe(3);
  });

  it("цель выцеливается на сцене: токен цели становится целью пользователя", async () => {
    const attacker = makeActor({ docs: [EXECUTION()] });
    registry["Actor.v"] = target();
    const calls = [];
    const token = { document: { uuid: "Scene.s.Token.v" }, actor: { uuid: "Actor.v" }, setTarget: (...a) => calls.push(a) };
    globalThis.canvas.tokens.placeables = [token];
    await click(attacker);
    expect(calls.at(-1)[0]).toBe(true);
  });
});

describe("серия записывается на «Бросок!» (commitExecutionStep) и закрывает лишнее", () => {
  const exec = { targetUuid: "Actor.v", total: 2 };

  it("первая доп. атака создаёт серию (used 1), вторая — used 2, третья — отказ (исчерпано)", async () => {
    const a = makeActor({ docs: [EXECUTION()] });
    expect(executionPayProblem(a, exec)).toBe("");
    expect(await commitExecutionStep(a, exec)).toBe(true);
    expect(a.flagsStore[EXECUTION_SERIES_FLAG]).toEqual({ combatId: "cb", round: 2, targetUuid: "Actor.v", total: 2, used: 1 });
    expect(await commitExecutionStep(a, exec)).toBe(true);
    expect(a.flagsStore[EXECUTION_SERIES_FLAG].used).toBe(2);
    expect(executionPayProblem(a, exec)).toContain("исчерпан");
    expect(await commitExecutionStep(a, exec)).toBe(false);
    expect(a.flagsStore[EXECUTION_SERIES_FLAG].used).toBe(2);
  });

  it("другая цель в том же Раунде — отказ, серия не тронута", async () => {
    const a = makeActor({ docs: [EXECUTION()] });
    await commitExecutionStep(a, exec);
    expect(executionPayProblem(a, { targetUuid: "Actor.other", total: 4 })).toContain("раз в Раунд");
    expect(await commitExecutionStep(a, { targetUuid: "Actor.other", total: 4 })).toBe(false);
    expect(a.flagsStore[EXECUTION_SERIES_FLAG].targetUuid).toBe("Actor.v");
  });

  it("новый Раунд — серия начинается заново", async () => {
    const a = makeActor({ docs: [EXECUTION()] });
    await commitExecutionStep(a, exec);
    await commitExecutionStep(a, exec);
    globalThis.game.combat = { id: "cb", round: 3, started: true };
    expect(executionPayProblem(a, exec)).toBe("");
    expect(await commitExecutionStep(a, exec)).toBe(true);
    expect(a.flagsStore[EXECUTION_SERIES_FLAG]).toMatchObject({ round: 3, used: 1 });
  });
});

describe("окно атаки: Казнь — свободное действие с тем же Приёмом", () => {
  it("executionFollow снимает ОД и лимит Атак (freeMeleeFlags)", () => {
    expect(freeMeleeFlags({ executionFollow: true })).toEqual({ noAp: true, uncounted: true, skipChargeGate: true });
  });
  it("База — та же, Приём — только Обычная Атака; иначе отказ с причиной", () => {
    const opts = { executionFollow: true, forceBase: "charge" };
    expect(freeAttackLockProblem(opts, { baseKey: "charge", maneuverKey: "standard" })).toBe("");
    expect(freeAttackLockProblem(opts, { baseKey: "fullatk", maneuverKey: "standard" })).toContain("Казнь");
    expect(freeAttackLockProblem(opts, { baseKey: "charge", maneuverKey: "swift" })).toContain("Обычная Атака");
  });
});
