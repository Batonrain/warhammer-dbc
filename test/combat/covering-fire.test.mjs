// test/combat/covering-fire.test.mjs
//
// Covering Fire / Прикрывающий Огонь (Стрелок; Sahara 3-5fbf, решения владельца
// 24.10.2026, вариант «В»): после Выхода из Боя — бесплатная очередь по одному из
// бывших противников со штрафом −20; тест Подавления +10 / +0 (короткая / длинная)
// — на ВСЕХ бывших противников, когда они пытаются Натиском достать стрелка.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { coveringFireWeapon, offerCoveringFire, applyCoveringFireMarks, coveringFireShootersFor,
  coveringFireChargeCheck, activateCoveringFire } from "../../module/combat/covering-fire.mjs";
import { coveringFireSuppressionMod, COVERING_FIRE_OFFER_FLAG, COVERING_FIRE_MARKS_FLAG,
  COVERING_FIRE_PENALTY } from "../../module/rules/gunner-talents.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const COVER = { key: "rangedCore.core.coveringFire", name: "Covering Fire / Прикрывающий Огонь" };
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "t-" + name, name, type: "talent", system: {} });

/** Токен-документ: ровно те поля, что читает enemyContactTokenDocs (x/y/размер/disposition) + uuid. */
function tokenDoc({ id, x = 0, y = 0, disposition = -1, actor = { type: "character", system: {} } }) {
  const d = { id, uuid: "Scene.s.Token." + id, name: "Враг " + id, x, y, width: 2, height: 2, disposition, actor };
  // setTarget — как у настоящего Token (combat/aim.mjs): Foundry v14 убрала User#updateTokenTargets.
  d.object = { id, uuid: d.uuid, targetedBy: null, setTarget(state, opts = {}) { this.targetedBy = state ? { opts } : null; } };
  return d;
}
function who(items, { token = null } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", wp: 40 });
  a.uuid = "Actor.shooter"; a.name = "Стрелок"; a.type = "character";
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  a.update = async () => {};
  a.store = store;
  a.getActiveTokens = () => (token ? [token] : []);
  return a;
}
const rifle = (extra = {}) => weaponFor({ weaponClass: "basic", equipped: true, grips: "2р", rof_semi: 3, rof_full: 6, ...extra }, { id: "rifle", name: "Лазган" });

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
  globalThis.canvas = { tokens: { placeables: [] } };
});
afterEach(() => { globalThis.game.combat = undefined; });

describe("оружие и предложение", () => {
  it("нужен Талант и экипированный Пистолет/Ручное оружие, не длинная винтовка", () => {
    const w = rifle();
    expect(coveringFireWeapon(who([w, byName(COVER.name)]))).toBe(w);
    expect(coveringFireWeapon(who([w, byKey(COVER.key)]))).toBe(w);
    expect(coveringFireWeapon(who([w]))).toBeNull();
    expect(coveringFireWeapon(who([rifle({ weaponProps: [{ key: "longRifle" }] }), byName(COVER.name)]))).toBeNull();
    expect(coveringFireWeapon(who([rifle({ weaponClass: "heavy" }), byName(COVER.name)]))).toBeNull();
  });

  it("враги в контакте запоминаются на стрелке, по кнопке на каждого", async () => {
    const me = tokenDoc({ id: "me", x: 0, y: 0, disposition: 1 });
    const foe1 = tokenDoc({ id: "f1", x: 2, y: 0 });
    const foe2 = tokenDoc({ id: "f2", x: 0, y: 2 });
    const far = tokenDoc({ id: "far", x: 50, y: 50 });
    const ally = tokenDoc({ id: "ally", x: 2, y: 2, disposition: 1 });
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [me, foe1, foe2, far, ally].map(d => ({ document: d })) } };
    const a = who([rifle(), byName(COVER.name)], { token: me });
    const html = await offerCoveringFire(a);
    expect((html.match(/wh-covering-fire-btn/g) ?? []).length).toBe(2);
    expect(a.store[`warhammer-dbc.${COVERING_FIRE_OFFER_FLAG}`].map(e => e.tokenUuid).sort())
      .toEqual([foe1.uuid, foe2.uuid].sort());
  });

  it("без Таланта или без врагов в контакте — предложения нет", async () => {
    const me = tokenDoc({ id: "me", disposition: 1 });
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [{ document: me }] } };
    expect(await offerCoveringFire(who([rifle(), byName(COVER.name)], { token: me }))).toBe("");
    expect(await offerCoveringFire(who([rifle()], { token: me }))).toBe("");
  });
});

describe("метки Подавления: на ВСЕХ бывших противников", () => {
  const seed = async mode => {
    const a = who([rifle(), byName(COVER.name)]);
    a.store[`warhammer-dbc.${COVERING_FIRE_OFFER_FLAG}`] = [
      { tokenUuid: "Scene.s.Token.f1", actorUuid: "Actor.f1", name: "Враг 1" },
      { tokenUuid: "Scene.s.Token.f2", actorUuid: "Actor.f2", name: "Враг 2" }
    ];
    await applyCoveringFireMarks(a, mode);
    return a;
  };

  it("короткая очередь: +10 обоим, предложение снято", async () => {
    const a = await seed("semi");
    const marks = a.store[`warhammer-dbc.${COVERING_FIRE_MARKS_FLAG}`];
    expect(Object.keys(marks)).toHaveLength(2);
    expect(Object.values(marks).map(m => m.mod)).toEqual([10, 10]);
    expect(a.store[`warhammer-dbc.${COVERING_FIRE_OFFER_FLAG}`]).toBeUndefined();
  });

  it("длинная очередь: +0", async () => {
    const a = await seed("full");
    expect(Object.values(a.store[`warhammer-dbc.${COVERING_FIRE_MARKS_FLAG}`]).map(m => m.mod)).toEqual([0, 0]);
  });

  it("модификатор и штраф", () => {
    expect(coveringFireSuppressionMod("semi")).toBe(10);
    expect(coveringFireSuppressionMod("full")).toBe(0);
    expect(COVERING_FIRE_PENALTY).toBe(-20);
  });

  it("без предложения метки не появляются", async () => {
    const a = who([rifle(), byName(COVER.name)]);
    await applyCoveringFireMarks(a, "semi");
    expect(a.store[`warhammer-dbc.${COVERING_FIRE_MARKS_FLAG}`]).toBeUndefined();
  });
});

describe("Натиск бывшего противника", () => {
  function enemy(tokenUuid, actorUuid) {
    const e = actorFor({ items: [], wp: 40 });
    e.uuid = actorUuid; e.name = "Враг"; e.type = "character";
    e.system.conditions = { pinned: false };
    const flags = {};
    e.getFlag = (s, k) => flags[`${s}.${k}`];
    e.setFlag = async (s, k, v) => { flags[`${s}.${k}`] = v; };
    e.update = async () => {};
    e.getActiveTokens = () => [{ uuid: tokenUuid }];
    return e;
  }
  function shooterWithMarks(marks) {
    const s = who([]);
    s.store[`warhammer-dbc.${COVERING_FIRE_MARKS_FLAG}`] = marks;
    return s;
  }

  it("стрелки с меткой на этого врага находятся по токену", () => {
    const e = enemy("Scene.s.Token.f1", "Actor.f1");
    const s = shooterWithMarks({ "Scene.s.Token.f1": { mod: 10, actorUuid: "Actor.f1", name: "Враг" } });
    globalThis.game.combat = { combatants: [{ actor: s }] };
    expect(coveringFireShootersFor(e)).toEqual([{ shooter: s, mod: 10 }]);
    expect(coveringFireShootersFor(enemy("Scene.s.Token.other", "Actor.other"))).toEqual([]);
  });

  it("Натиск на стрелка: тест Подавления бросается, 'нет' — не бросается", async () => {
    const e = enemy("Scene.s.Token.f1", "Actor.f1");
    const s = shooterWithMarks({ "Scene.s.Token.f1": { mod: 10, actorUuid: "Actor.f1", name: "Враг" } });
    globalThis.game.combat = { combatants: [{ actor: s }] };
    captured.confirmAnswer = false;
    captured.nextRoll = 10;
    await coveringFireChargeCheck(e);
    expect(captured.chat.length).toBe(0);
    captured.confirmAnswer = true;
    await coveringFireChargeCheck(e);
    expect(captured.chat.length).toBeGreaterThan(0);
    expect(captured.chat.at(-1).content).toContain("Прикрывающий Огонь");
  });

  it("без меток — молча ничего", async () => {
    globalThis.game.combat = { combatants: [{ actor: who([]) }] };
    await coveringFireChargeCheck(enemy("Scene.s.Token.f1", "Actor.f1"));
    expect(captured.chat.length).toBe(0);
  });
});

describe("окно атаки и кнопка", () => {
  it("кнопка без предложения — предупреждение", async () => {
    const a = who([rifle(), byName(COVER.name)]);
    globalThis.fromUuid = async () => a;
    await activateCoveringFire(a.uuid, "Scene.s.Token.f1");
    expect(captured.warnings.some(w => w.includes("Прикрывающий Огонь"))).toBe(true);
  });

  it("окно: только Короткая/Длинная очередь и строка штрафа −20 в разборе", () => {
    const w = rifle({ rof_single: 1 });
    const a = who([w, byName(COVER.name)]);
    showAttackDialog(a, w, { freeShot: "coveringFire" });
    const html = captured.dialog.content;
    expect(html).toContain('value="semi"');
    expect(html).toContain('value="full"');
    expect(html).not.toContain('value="single"');
    expect(html).not.toContain('value="suppression"');
  });
});
