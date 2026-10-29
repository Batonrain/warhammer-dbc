// test/combat/beyond-human.test.mjs
//
// За Гранью Человека, вторая половина (стр. 62, combat/beyond-human.mjs):
// «оставить первый результат» переброса за Очко. Данные карточки, возврат
// Очка, гашение карточки переброса; стыковка с hooks.mjs — по исходникам, как в
// test/combat/card-once.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  BEYOND_HUMAN_FLAG, beyondHumanRerollData, beyondHumanDataOf, keepFirstButtonHtml,
  voidedContent, keepFirstResult
} from "../../module/combat/beyond-human.mjs";

const NS = "warhammer-dbc";

const bh = aptSource => ({ type: "talent", name: "Beyond Human / За Гранью Человека", system: { aptSource } });
function fakeActor({ talent = "ws", fate = 2, fateMax = 5 } = {}) {
  const updates = [];
  const actor = {
    uuid: "Actor.a1", name: "Тестовый", isOwner: true, type: "character",
    items: talent ? [bh(talent)] : [],
    system: { fate: { value: fate, max: fateMax }, alignment: "renegade" },
    getFlag: () => undefined,
    async update(u) { updates.push(u); },
    updates
  };
  return actor;
}
let seq = 0;
function fakeMessage(flags = {}, { isOwner = true } = {}) {
  return {
    id: `bh${++seq}`, isOwner, flags: { [NS]: { ...flags } }, content: "<div class=\"wh-roll-result\"><button>x</button></div>",
    speaker: {}, updates: [],
    getFlag(ns, k) { return this.flags[ns]?.[k]; },
    async setFlag(ns, k, v) { (this.flags[ns] ??= {})[k] = v; },
    async update(u) { this.updates.push(u); if (u.content) this.content = u.content; }
  };
}

let prev;
beforeEach(() => {
  resetCaptured();
  prev = { socket: game.socket, users: game.users, user: game.user, fromUuid: globalThis.fromUuid };
  game.socket = { emit() {} };
  game.users = Object.assign([], { activeGM: { id: "gm" } });
  game.user = { id: "u1" };
});
afterEach(() => { Object.assign(game, prev); globalThis.fromUuid = prev.fromUuid; });

describe("За Гранью Человека: данные карточки переброса", () => {
  it("нет Таланта на эту Характеристику — данных нет, кнопки не будет", () => {
    expect(beyondHumanRerollData(fakeActor({ talent: "bs" }), { charKey: "ws", firstRv: 40, threshold: 50 })).toBeNull();
    expect(beyondHumanRerollData(fakeActor({ talent: null }), { charKey: "ws", firstRv: 40, threshold: 50 })).toBeNull();
  });

  it("своё Очко: данные помнят, что вернуть, и откуда оно списано", () => {
    const data = beyondHumanRerollData(fakeActor(), { charKey: "ws", firstRv: 40, threshold: 50,
      spend: { tempSpent: 1, poolSpent: 0, tempSource: "Глас Божий", tempRestriction: "" } });
    expect(data).toMatchObject({ charKey: "ws", firstRv: 40, threshold: 50, own: true, temp: true, tempSource: "Глас Божий" });
  });

  it("Очко Чемпиона: первый результат оставить можно, вернуть нечего", () => {
    const data = beyondHumanRerollData(fakeActor(), { charKey: "ws", firstRv: 40, threshold: 50, spend: null });
    expect(data.own).toBe(false);
  });

  it("данные читаются и из флага теста, и из опций атаки", () => {
    const data = { actorUuid: "Actor.a1", charKey: "ws", firstRv: 12 };
    expect(beyondHumanDataOf(fakeMessage({ [BEYOND_HUMAN_FLAG]: data }))).toEqual(data);
    expect(beyondHumanDataOf(fakeMessage({ attack: { opts: { [BEYOND_HUMAN_FLAG]: data } } }))).toEqual(data);
    expect(beyondHumanDataOf(fakeMessage({}))).toBeNull();
  });
});

describe("За Гранью Человека: кнопка и гашение карточки", () => {
  it("кнопка называет первый результат; на использованной карточке отключена", () => {
    const html = keepFirstButtonHtml({ actorUuid: "Actor.a1", firstRv: 37, own: true });
    expect(html).toContain("wh-beyond-human-keep-btn");
    expect(html).toContain("(37)");
    expect(html).not.toMatch(/\sdisabled/);
    expect(keepFirstButtonHtml({ actorUuid: "Actor.a1", firstRv: 37, own: true }, { used: true })).toMatch(/\sdisabled/);
    expect(keepFirstButtonHtml(null)).toBe("");
  });

  it("гашение: пометка сверху, все кнопки отключены", () => {
    const out = voidedContent(`<div><button class="a">1</button><button>2</button></div>`);
    expect(out).toContain("Аннулировано");
    expect(out.match(/<button disabled/g)).toHaveLength(2);
  });
});

describe("За Гранью Человека: оставить первый результат", () => {
  const data = (extra = {}) => ({ actorUuid: "Actor.a1", charKey: "ws", firstRv: 30, threshold: 50, own: true, temp: false, ...extra });

  it("возвращает потраченное Очко, гасит карточку и объявляет первый результат", async () => {
    const actor = fakeActor({ fate: 1 });
    globalThis.fromUuid = async () => actor;
    const message = fakeMessage({ [BEYOND_HUMAN_FLAG]: data() });
    expect(await keepFirstResult(message)).toBe(true);
    expect(actor.updates).toEqual([{ "system.fate.value": 2 }]);
    expect(message.content).toContain("Аннулировано");
    expect(captured.chat.at(-1)?.content ?? "").toContain("Переброс аннулирован");
    expect(message.flags[NS].beyondHumanKept).toBe(true);
  });

  it("второй клик ничего не возвращает повторно", async () => {
    const actor = fakeActor({ fate: 1 });
    globalThis.fromUuid = async () => actor;
    const message = fakeMessage({ [BEYOND_HUMAN_FLAG]: data() });
    await keepFirstResult(message);
    expect(await keepFirstResult(message)).toBe(false);
    expect(actor.updates).toHaveLength(1);
  });

  it("Очко Чемпиона: карточка гасится, а Очко у персонажа не растёт", async () => {
    const actor = fakeActor({ fate: 1 });
    globalThis.fromUuid = async () => actor;
    const message = fakeMessage({ [BEYOND_HUMAN_FLAG]: data({ own: false }) });
    expect(await keepFirstResult(message)).toBe(true);
    expect(actor.updates).toEqual([]);
    expect(message.content).toContain("Аннулировано");
  });

  it("не владелец персонажа — отказ, ничего не меняется", async () => {
    const actor = fakeActor({ fate: 1 });
    actor.isOwner = false;
    globalThis.fromUuid = async () => actor;
    const message = fakeMessage({ [BEYOND_HUMAN_FLAG]: data() });
    expect(await keepFirstResult(message)).toBe(false);
    expect(actor.updates).toEqual([]);
  });

  it("Талант на другую Характеристику — отказ", async () => {
    const actor = fakeActor({ talent: "bs", fate: 1 });
    globalThis.fromUuid = async () => actor;
    const message = fakeMessage({ [BEYOND_HUMAN_FLAG]: data({ charKey: "ws" }) });
    expect(await keepFirstResult(message)).toBe(false);
    expect(actor.updates).toEqual([]);
  });
});

// ── Стыковка по исходникам ────────────────────────────────────────────────
const ROOT  = path.resolve(import.meta.dirname, "../..");
const HOOKS = fs.readFileSync(path.join(ROOT, "module/hooks.mjs"), "utf8");

describe("стыковка: меню Очков и карточки (hooks.mjs)", () => {
  it("переброс теста кладёт данные в флаги новой карточки", () => {
    const at = HOOKS.indexOf("const bhTest");
    expect(at).toBeGreaterThan(0);
    expect(HOOKS.slice(at, at + 400)).toMatch(/beyondHumanRerollData\(actor/);
    expect(HOOKS).toMatch(/\[BEYOND_HUMAN_FLAG\]: bhTest/);
  });

  it("переброс атаки несёт данные в опциях, старая метка сбрасывается", () => {
    const at = HOOKS.indexOf("const bhAtk");
    expect(at).toBeGreaterThan(0);
    expect(HOOKS.slice(at, at + 900)).toMatch(/delete atkOpts\[BEYOND_HUMAN_FLAG\]/);
    expect(HOOKS.slice(at, at + 900)).toMatch(/\[BEYOND_HUMAN_FLAG\]: bhAtk/);
  });

  it("Очко Чемпиона не возвращается: spend для него — null", () => {
    expect(HOOKS).toMatch(/spend: champion \? null : reroll1/g);
  });

  it("кнопка «оставить первый» гаснет по отметке, что ставит обработчик", () => {
    const at = HOOKS.indexOf("keepFirstButtonHtml(bhData");
    expect(HOOKS.slice(at, at + 200)).toMatch(/cardOnceUsed\(message, "beyondHumanKept"\)/);
  });

  it("Мастерство: пункт меню гаснет по отметке и зовёт обработчик с сообщением", () => {
    const at = HOOKS.indexOf("const masteryOffer");
    expect(HOOKS.slice(at, at + 250)).toMatch(/!cardOnceUsed\(message, "masteryAutoSuccessUsed"\)/);
    const click = HOOKS.indexOf("btnMastery?.addEventListener");
    expect(HOOKS.slice(click, click + 400)).toMatch(/masteryAutoSuccessOnCard\(actor, skillTest, message\)/);
  });
});
