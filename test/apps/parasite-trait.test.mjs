// test/apps/parasite-trait.test.mjs
import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

const captureNewHost = vi.fn(async () => {});
vi.mock("../../module/apps/maggot-parasite.mjs", () => ({
  captureNewHost: (...args) => captureNewHost(...args)
}));

import {
  beginParasiticContactButtonHtml, beginParasiticContact, tearOffParasite,
  completeInfection, endParasiticPossession
} from "../../module/apps/parasite-trait.mjs";
import { PARASITIC_CONTACT_SOURCE_FLAG, POSSESSED_BY_PARASITE_FLAG } from "../../module/rules/parasite-trait.mjs";

/** getFlag/setFlag и update() с точечными путями делят ОДНО хранилище actor.flags — иначе флаг, записанный через update({"flags.scope.key": v}), не увидит getFlag(). */
function makeActor(overrides = {}) {
  const updates = [];
  const actor = {
    id: "actor-1", name: "Жертва", uuid: "Actor.victim",
    system: { conditions: {}, wounds: { value: 10, max: 10, critical: 0 } },
    flags: {},
    getFlag: (scope, key) => actor.flags[scope]?.[key],
    setFlag: async (scope, key, value) => { actor.flags[scope] ??= {}; actor.flags[scope][key] = value; },
    unsetFlag: async (scope, key) => { if (actor.flags[scope]) delete actor.flags[scope][key]; },
    updates,
    ...overrides
  };
  actor.update = async data => {
    updates.push(data);
    for (const [path, value] of Object.entries(data)) {
      if (path.includes("-=")) {
        const key = path.split("-=")[1];
        if (actor.flags["warhammer-dbc"]) delete actor.flags["warhammer-dbc"][key];
        continue;
      }
      const parts = path.split(".");
      let t = actor;
      for (const part of parts.slice(0, -1)) { t[part] ??= {}; t = t[part]; }
      t[parts.at(-1)] = value;
    }
    return data;
  };
  return actor;
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [3];
  game.time = { worldTime: 1000 };
  globalThis.fromUuid = async () => null;
  captureNewHost.mockClear();
});

describe("beginParasiticContactButtonHtml", () => {
  it("предмет-Трейт Parasite — кнопка есть", () => {
    const item = { flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "trait.parasite", label: "" }
    ] }] } } };
    const actor = makeActor();
    expect(beginParasiticContactButtonHtml(item, actor)).toContain("parasite-begin-contact-btn");
  });
  it("другой предмет — пусто", () => {
    expect(beginParasiticContactButtonHtml({ flags: {} }, makeActor())).toBe("");
  });
  it("нет актора — пусто", () => {
    const item = { flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: "trait.parasite", label: "" }
    ] }] } } };
    expect(beginParasiticContactButtonHtml(item, null)).toBe("");
  });
});

describe("beginParasiticContact", () => {
  it("нет цели — предупреждение, ничего не меняет", async () => {
    globalThis.game.user.targets = [];
    const parasite = makeActor({ uuid: "Actor.parasite" });
    await beginParasiticContact(parasite);
    expect(captured.warnings.some(w => w.includes("цел"))).toBe(true);
  });

  it("устанавливает контакт: 1d5 + ручная поправка на броню, флаг источника", async () => {
    const parasite = makeActor({ uuid: "Actor.parasite", name: "Опарыш" });
    const target = makeActor();
    globalThis.game.user.targets = [{ actor: target }];

    await beginParasiticContact(parasite, { armorRounds: 2 });

    expect(target.system.conditions.parasiticContact).toBe(true);
    expect(target.system.conditions.parasiticContactRounds).toBe(3 + 2);
    expect(target.getFlag("warhammer-dbc", PARASITIC_CONTACT_SOURCE_FLAG)).toBe("Actor.parasite");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-parasite-tear-off-btn");
    expect(card).toContain("5"); // 3 + 2 = 5 Ходов
  });
});

describe("tearOffParasite", () => {
  it("снимает контакт, 1d5 непоглощ. Rending в торс", async () => {
    const target = makeActor();
    target.system.conditions = { parasiticContact: true, parasiticContactRounds: 4 };
    await target.setFlag("warhammer-dbc", PARASITIC_CONTACT_SOURCE_FLAG, "Actor.parasite");

    await tearOffParasite(target);

    expect(target.system.conditions.parasiticContact).toBe(false);
    expect(target.getFlag("warhammer-dbc", PARASITIC_CONTACT_SOURCE_FLAG)).toBeUndefined();
    expect(target.system.wounds.value).toBe(7); // 10 - 3 (captured.dice=[3])

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Паразит сорван");
  });
});

describe("completeInfection", () => {
  it("источник не резолвится — снимает контакт, дальше не идёт", async () => {
    const target = makeActor();
    await target.setFlag("warhammer-dbc", PARASITIC_CONTACT_SOURCE_FLAG, "Actor.gone");
    globalThis.fromUuid = async () => null;

    await completeInfection(target);

    expect(target.getFlag("warhammer-dbc", PARASITIC_CONTACT_SOURCE_FLAG)).toBeUndefined();
    expect(captureNewHost).not.toHaveBeenCalled();
  });

  it("паразит — Опарыш-Паразит (capability) — маршрутизирует в captureNewHost", async () => {
    const target = makeActor();
    await target.setFlag("warhammer-dbc", PARASITIC_CONTACT_SOURCE_FLAG, "Actor.parasite");
    const parasite = {
      uuid: "Actor.parasite",
      items: [{ type: "mutation", name: "Maggot Parasite / Опарыш-Паразит", system: {},
        flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
          { id: "e", kind: "capability", capabilityKey: "gift.nurgle.maggotParasite", label: "" }
        ] }] } } }]
    };
    globalThis.fromUuid = async uuid => (uuid === "Actor.parasite" ? parasite : null);

    await completeInfection(target);

    expect(captureNewHost).toHaveBeenCalledWith(parasite, target);
    expect(target.getFlag("warhammer-dbc", POSSESSED_BY_PARASITE_FLAG)).toBeUndefined();
  });

  it("паразит — общий (без Опарыш-capability) — ставит possessedByParasiteUuid", async () => {
    const target = makeActor();
    await target.setFlag("warhammer-dbc", PARASITIC_CONTACT_SOURCE_FLAG, "Actor.medusa");
    const parasite = { uuid: "Actor.medusa", name: "Медуза", items: [] };
    globalThis.fromUuid = async uuid => (uuid === "Actor.medusa" ? parasite : null);

    await completeInfection(target);

    expect(captureNewHost).not.toHaveBeenCalled();
    expect(target.getFlag("warhammer-dbc", POSSESSED_BY_PARASITE_FLAG)).toBe("Actor.medusa");
    expect(captured.chat.at(-1).content).toContain("Заражение завершено");
  });
});

describe("endParasiticPossession", () => {
  it("снимает possessedByParasiteUuid", async () => {
    const target = makeActor();
    await target.setFlag("warhammer-dbc", POSSESSED_BY_PARASITE_FLAG, "Actor.medusa");
    await endParasiticPossession(target);
    expect(target.getFlag("warhammer-dbc", POSSESSED_BY_PARASITE_FLAG)).toBeUndefined();
  });
});
