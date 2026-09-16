// test/apps/maggot-parasite.test.mjs
import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

const requestControlOwnership = vi.fn(async () => ({ ok: true }));
const requestRevokeControlOwnership = vi.fn(async () => ({ ok: true }));
vi.mock("../../module/apps/actor-control.mjs", () => ({
  requestControlOwnership: (...args) => requestControlOwnership(...args),
  requestRevokeControlOwnership: (...args) => requestRevokeControlOwnership(...args)
}));

const setDeceased = vi.fn(async () => {});
vi.mock("../../module/sheets/tabs/body.mjs", () => ({
  setDeceased: (...args) => setDeceased(...args)
}));

import {
  becomeParasiteHostButtonHtml, becomeParasiteHost, captureNewHost, checkAbandonedHostDeath
} from "../../module/apps/maggot-parasite.mjs";
import { ABANDONED_HOST_DEATH_FLAG } from "../../module/rules/maggot-parasite.mjs";

function giftItem(overrides = {}) {
  const flags = { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "gift.nurgle.maggotParasite", label: "" }
  ] }] } };
  return {
    id: "gift-1", name: "Maggot Parasite / Опарыш-Паразит", type: "mutation", system: {},
    flags,
    getFlag: (scope, key) => flags[scope]?.[key],
    setFlag: async (scope, key, value) => { flags[scope] ??= {}; flags[scope][key] = value; },
    toObject: () => ({ id: "gift-1", name: "Maggot Parasite / Опарыш-Паразит", type: "mutation", system: {}, flags, _id: "gift-1" }),
    ...overrides
  };
}

function hostActor(overrides = {}) {
  const flags = {};
  const updates = [];
  const createdItems = [];
  const deletedItemIds = [];
  const a = {
    id: "host-1", name: "Носитель", uuid: "Actor.host",
    system: { characteristics: { s: { value: 30 }, t: { value: 30 }, a: { value: 30 } }, wounds: { value: 0, max: 12 } },
    items: [],
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    update: async data => { updates.push(data); return data; },
    createEmbeddedDocuments: async (type, docs) => { createdItems.push(...docs); return docs; },
    deleteEmbeddedDocuments: async (type, ids) => { deletedItemIds.push(...ids); },
    updates, createdItems, deletedItemIds,
    ...overrides
  };
  return a;
}

beforeEach(() => {
  resetCaptured();
  game.time = { worldTime: 1000 };
  requestControlOwnership.mockClear();
  requestRevokeControlOwnership.mockClear();
  setDeceased.mockClear();
  globalThis.game.user = { id: "player-1", isGM: false };
  globalThis.game.users = { find: () => undefined, get: () => undefined };
});

describe("becomeParasiteHostButtonHtml", () => {
  it("предмет Опарыша, не превращён — кнопка активна", () => {
    const html = becomeParasiteHostButtonHtml(giftItem());
    expect(html).toContain("maggot-parasite-become-btn");
    expect(html).not.toContain("disabled");
    expect(html).toContain("не превращено");
  });
  it("уже превращён — кнопка disabled, статус показан", () => {
    const item = giftItem();
    item.getFlag = (scope, key) => (key === "maggotParasiteTransformed" ? true : undefined);
    const html = becomeParasiteHostButtonHtml(item);
    expect(html).toContain("disabled");
    expect(html).toContain("уже превращено");
  });
  it("другой предмет — пусто", () => {
    expect(becomeParasiteHostButtonHtml({ type: "mutation", name: "Другое", flags: {} })).toBe("");
  });
});

describe("becomeParasiteHost", () => {
  it("S/T/A→10, Раны.max→7, флаг превращения ставится", async () => {
    const actor = hostActor();
    const item = giftItem();
    await becomeParasiteHost(actor, item);

    expect(actor.updates.at(-1)).toEqual({
      "system.characteristics.s.value": 10, "system.characteristics.t.value": 10,
      "system.characteristics.a.value": 10, "system.wounds.max": 7
    });
    expect(item.getFlag("warhammer-dbc", "maggotParasiteTransformed")).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Опарыш поглощает тело");
  });
});

describe("captureNewHost", () => {
  it("нет цели — ничего не меняет, не падает", async () => {
    const oldHost = hostActor();
    await captureNewHost(oldHost, null);
    expect(oldHost.updates.length).toBe(0);
  });

  it("успех — переносит предмет, характеристики, владение, активный лист, ставит таймер 7ч на старое тело", async () => {
    const gift = giftItem();
    const oldHost = hostActor({ items: [gift] });
    const target = hostActor({ id: "host-2", name: "Цель", uuid: "Actor.target" });
    globalThis.game.users.find = () => ({ id: "player-1" });
    globalThis.game.users.get = id => (id === "player-1" ? { update: async d => { globalThis.game.users._updated = d; } } : undefined);

    await captureNewHost(oldHost, target);

    expect(target.createdItems.length).toBe(1);
    expect(target.createdItems[0].name).toBe("Maggot Parasite / Опарыш-Паразит");
    expect(oldHost.deletedItemIds).toEqual(["gift-1"]);

    expect(requestControlOwnership).toHaveBeenCalledWith(target, oldHost);
    expect(requestRevokeControlOwnership).toHaveBeenCalledWith(oldHost, oldHost);
    expect(globalThis.game.users._updated).toEqual({ character: "host-2" });

    expect(target.updates.at(-1)).toMatchObject({ "system.characteristics.s.value": 10, "system.wounds.max": 7 });
    expect(oldHost.getFlag("warhammer-dbc", ABANDONED_HOST_DEATH_FLAG)).toBe(1000 + 7 * 3600);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Опарыш захватил новое тело");
  });

  it("не ГМ и не сам игрок-владелец — активный лист не меняется, предупреждение", async () => {
    const oldHost = hostActor();
    const target = hostActor({ id: "host-2", uuid: "Actor.target" });
    globalThis.game.users.find = () => ({ id: "someone-else" });

    await captureNewHost(oldHost, target);

    expect(captured.warnings.some(w => w.includes("Сменить активный лист"))).toBe(true);
  });
});

describe("checkAbandonedHostDeath", () => {
  it("до дедлайна — молчит", async () => {
    const actor = hostActor();
    await actor.setFlag("warhammer-dbc", ABANDONED_HOST_DEATH_FLAG, 1000 + 7 * 3600);
    await checkAbandonedHostDeath(actor, 1000 + 7 * 3600 - 1);
    expect(setDeceased).not.toHaveBeenCalled();
  });

  it("на дедлайне — снимает флаг, констатирует смерть", async () => {
    const actor = hostActor();
    await actor.setFlag("warhammer-dbc", ABANDONED_HOST_DEATH_FLAG, 1000 + 7 * 3600);
    await checkAbandonedHostDeath(actor, 1000 + 7 * 3600);
    expect(setDeceased).toHaveBeenCalledWith(actor, true);
    expect(actor.getFlag("warhammer-dbc", ABANDONED_HOST_DEATH_FLAG)).toBeUndefined();
  });
});
