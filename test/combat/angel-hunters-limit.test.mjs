// test/combat/angel-hunters-limit.test.mjs
//
// wdbc-erp61. Angel Hunters / Охотники на Ангелов: «Раз в Раунд» перебросить
// тест против Космодесантника; Йигори в одном Командном Присутствии и в
// пределах видимости друг друга делятся перебросами.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../../module/rules/vision-target.mjs", () => ({
  isTokenInSight: (a, b) => !(a.blind || b.blind)
}));

import { sameCommandPresence } from "../../module/rules/angel-hunters.mjs";
import { angelHuntersSource, commitRerollUse } from "../../module/combat/angel-hunters.mjs";
import { ruleRerollsHtml } from "../../module/rules/roll-mods.mjs";
import { rerollsFromRules } from "../../module/rules/resolve-test.mjs";
import { YIGORI_RULES } from "../../module/rules/library/yigori.mjs";

const KEY = "usageLimits.yigori-angelHunters";
let round = 3;

/** Йигори: Черта, флаги usageLimits/commandedBy, uuid; used — потрачен в текущем Раунде. */
function yigori(id, { used = false, commandedBy = "", trait = true } = {}) {
  const flags = {};
  if (used) flags[KEY] = { scope: "round", used: true, round };
  if (commandedBy) flags.commandedBy = { uuid: commandedBy };
  const items = trait ? [{ type: "trait", name: "Angel Hunters / Охотники на Ангелов", system: {} }] : [];
  const actor = {
    id, uuid: `Actor.${id}`, name: id, isOwner: true, type: "character", system: {}, flags,
    items: Object.assign([...items], { contents: items }),
    getFlag: (_s, k) => flags[k],
    setFlag: vi.fn(async (_s, k, v) => { flags[k] = v; })
  };
  return actor;
}
const token = (actor, extra = {}) => ({ actor, ...extra });

beforeEach(() => {
  round = 3;
  globalThis.game.combat = { round, id: "c1" };
  globalThis.game.actors = Object.assign([], { find: () => null });
  globalThis.game.users = { activeGM: { id: "gm" } };
  globalThis.canvas = { tokens: { placeables: [] }, scene: { grid: { size: 100, distance: 1 } } };
});
afterEach(() => { globalThis.game.combat = null; globalThis.canvas = {}; });

describe("sameCommandPresence", () => {
  it("один Отряд или один командир — да; чужие и сам с собой — нет", () => {
    expect(sameCommandPresence({ uuid: "a", squadId: "S" }, { uuid: "b", squadId: "S" })).toBe(true);
    expect(sameCommandPresence({ uuid: "a", commandedBy: "C" }, { uuid: "b", commandedBy: "C" })).toBe(true);
    expect(sameCommandPresence({ uuid: "a", commandedBy: "b" }, { uuid: "b" })).toBe(true);
    expect(sameCommandPresence({ uuid: "a", squadId: "S" }, { uuid: "b", squadId: "T" })).toBe(false);
    expect(sameCommandPresence({ uuid: "a" }, { uuid: "b" })).toBe(false);
    expect(sameCommandPresence({ uuid: "a", squadId: "S" }, { uuid: "a", squadId: "S" })).toBe(false);
  });
});

describe("правило несёт ограничитель", () => {
  it("rerollsFromRules отдаёт limit", () => {
    const rr = rerollsFromRules(YIGORI_RULES, {});
    expect(rr[0]).toMatchObject({ ruleId: "yigori.angelHunters", limit: "angelHunters" });
  });
});

describe("angelHuntersSource: свой переброс и переброс стаи", () => {
  it("свой не потрачен — берётся свой", () => {
    const a = yigori("A");
    expect(angelHuntersSource(a)).toMatchObject({ uuid: "Actor.A", borrowed: false });
  });

  it("свой потрачен, сосед по Присутствию в видимости с неиспользованным — берётся его", () => {
    const a = yigori("A", { used: true, commandedBy: "Actor.CMD" });
    const b = yigori("B", { commandedBy: "Actor.CMD" });
    globalThis.canvas.tokens.placeables = [token(a), token(b)];
    expect(angelHuntersSource(a)).toMatchObject({ uuid: "Actor.B", borrowed: true, name: "B" });
  });

  it("сосед не в одном Присутствии, вне видимости или тоже потратил — переброса нет", () => {
    const a = yigori("A", { used: true, commandedBy: "Actor.CMD" });
    const other = yigori("B", { commandedBy: "Actor.OTHER" });
    const blind = yigori("C", { commandedBy: "Actor.CMD" });
    const spent = yigori("D", { commandedBy: "Actor.CMD", used: true });
    const noTrait = yigori("E", { commandedBy: "Actor.CMD", trait: false });
    globalThis.canvas.tokens.placeables = [token(a), token(other), token(blind, { blind: true }), token(spent), token(noTrait)];
    expect(angelHuntersSource(a)).toBe(null);
  });

  it("новый Раунд сбрасывает: потраченный в прошлом Раунде снова доступен", () => {
    const a = yigori("A", { used: true });
    globalThis.game.combat = { round: round + 1, id: "c1" };
    expect(angelHuntersSource(a)).toMatchObject({ borrowed: false });
  });

  it("без активного боя Раунд не отследить — переброс доступен", () => {
    const a = yigori("A", { used: true });
    globalThis.game.combat = null;
    expect(angelHuntersSource(a)).toMatchObject({ borrowed: false });
  });
});

describe("диалог броска: радио и трата", () => {
  const ctx = { kind: "attack" };
  const resolvedFor = () => ({ rerolls: rerollsFromRules(YIGORI_RULES, {}) });

  it("свой потрачен, одолженного нет — блока Перебросов нет вовсе", () => {
    const a = yigori("A", { used: true });
    globalThis.canvas.tokens.placeables = [token(a)];
    expect(ruleRerollsHtml(a, ctx, resolvedFor()).html).toBe("");
  });

  it("одолженный показан с именем соседа и несёт ограничитель и источник", () => {
    const a = yigori("A", { used: true, commandedBy: "Actor.CMD" });
    const b = yigori("B", { commandedBy: "Actor.CMD" });
    globalThis.canvas.tokens.placeables = [token(a), token(b)];
    const { html } = ruleRerollsHtml(a, ctx, resolvedFor());
    expect(html).toContain("переброс стаи: B");
    expect(html).toContain('data-limit="angelHunters"');
    expect(html).toContain('data-source-uuid="Actor.B"');
  });

  it("трата своего переброса помечает актора; чужого владельцем — его самого", async () => {
    const a = yigori("A");
    await commitRerollUse(a, { limit: "angelHunters", sourceUuid: "" });
    expect(a.setFlag).toHaveBeenCalledWith("warhammer-dbc", KEY, { scope: "round", used: true, round: 3 });

    const b = yigori("B");
    globalThis.fromUuid = async () => b;
    await commitRerollUse(a, { limit: "angelHunters", sourceUuid: "Actor.B" });
    expect(b.setFlag).toHaveBeenCalledOnce();
  });

  it("чужой переброс, лендером владеет не клиент — уходит ГМу по сокету", async () => {
    const a = yigori("A");
    const b = yigori("B");
    b.isOwner = false;
    globalThis.fromUuid = async () => b;
    const emit = vi.fn();
    globalThis.game.socket = { emit };
    globalThis.game.user = { id: "u1" };
    await commitRerollUse(a, { limit: "angelHunters", sourceUuid: "Actor.B" });
    expect(b.setFlag).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith("system.warhammer-dbc",
      expect.objectContaining({ action: "angelHuntersSpend", lenderUuid: "Actor.B" }));
  });

  it("переброс без ограничителя ничего не отмечает", async () => {
    const a = yigori("A");
    await commitRerollUse(a, { idx: "0" });
    expect(a.setFlag).not.toHaveBeenCalled();
  });
});
