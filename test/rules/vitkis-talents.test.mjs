// Виткис: Провидец Войны и Таланты поверх него (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  warSeerMaxSplits, harderTheyFallDeg, bloodFeudPersistent, warSeerDeg, mergeWarSeer,
  warSeerAtTurnStart, warSeerDamage, warSeerEvasionMod, witchslayerArmed, vitkisRules
} from "../../module/rules/vitkis-talents.mjs";

const NS = "warhammer-dbc";
const it_ = (type, name, system = {}) => ({ type, name, system });
const target = { uuid: "Actor.t", id: "t", name: "Цель", items: [], system: { size: 2 } };
const vitkis = (items = [], entries = [], extra = {}) => ({
  uuid: "Actor.v", id: "v", name: "Виткис",
  items: [it_("trait", "War Seer / Провидец Войны"), ...items],
  system: { characteristics: { per: { total: 43 } } },
  flags: { [NS]: { warSeer: { combatId: "c1", entries }, ...extra } }
});
const e = (effect, deg, more = {}) => ({ targetUuid: "Actor.t", targetId: "t", targetName: "Цель", effect, deg, ...more });

describe("Провидец Войны — чтение записей", () => {
  it("Успехи берутся только своего боя и своей цели", () => {
    const v = vitkis([], [e("hit", 3)]);
    expect(warSeerDeg(v, target, "hit", "c1")).toBe(3);
    expect(warSeerDeg(v, target, "hit", "c2")).toBe(0);
    expect(warSeerDeg(v, { uuid: "Actor.x", id: "x" }, "hit", "c1")).toBe(0);
  });
  it("урон — только рукопашной, Избегание цели — −3×Успехи", () => {
    const v = vitkis([], [e("dmg", 2), e("evade", 2)]);
    expect(warSeerDamage(v, target, { isMelee: true, combatId: "c1" })).toBe(2);
    expect(warSeerDamage(v, target, { isMelee: false, combatId: "c1" })).toBe(0);
    expect(warSeerEvasionMod(target, v, "c1")).toBe(-6);
  });
  it("источник правил: +3×Успехи рукопашной, +5× во встречном WS, приказы — галочкой", () => {
    const v = vitkis([], [e("hit", 2), e("opposed", 1), e("orders", 2)]);
    const melee = vitkisRules(v, { targetActor: target, isMelee: true }, "c1");
    expect(melee.find(r => r.id === "vitkis.warSeer.hit").effects[0].value).toBe(6);
    const contest = vitkisRules(v, { targetActor: target, contest: true, char: "ws" }, "c1");
    expect(contest.find(r => r.id === "vitkis.warSeer.opposed").effects[0].value).toBe(5);
    const order = melee.find(r => r.id.startsWith("vitkis.warSeer.orders"));
    expect(order.effects[0]).toMatchObject({ target: "skill:command", value: 10 });
    expect(order.effects[0].auto).toBeUndefined();
  });
});

describe("Таланты Виткиса", () => {
  it("Разделённое Видение — P.b разделений", () => {
    expect(warSeerMaxSplits(vitkis())).toBe(1);
    expect(warSeerMaxSplits(vitkis([it_("talent", "Split Vision / Разделённое Видение")]))).toBe(4);
  });
  it("Тем Больнее Им Падать — ×Размер больше 1", () => {
    expect(harderTheyFallDeg(vitkis(), 3, target)).toBe(3);
    expect(harderTheyFallDeg(vitkis([it_("talent", "Harder They Fall")]), 3, target)).toBe(6);
    expect(harderTheyFallDeg(vitkis([it_("talent", "Harder They Fall")]), 3, { system: { size: 1 } })).toBe(3);
  });
  it("Кровная Вражда — постоянный эффект против Ненавистного (Все!)", () => {
    const hatred = it_("talent", "Hatred / Ненависть", { targets: [{ kind: "all", name: "Все!" }] });
    expect(bloodFeudPersistent(vitkis([it_("talent", "Blood Feud"), hatred]), target)).toBe(true);
    expect(bloodFeudPersistent(vitkis([it_("talent", "Blood Feud")]), target)).toBe(false);
  });
  it("слияние: временные уходят, постоянные остаются; замена только большими Успехами", () => {
    const prev = [e("hit", 3, { persistent: true }), e("dmg", 2)];
    expect(mergeWarSeer(prev, [e("hit", 2)])).toEqual([e("hit", 3, { persistent: true })]);
    expect(mergeWarSeer(prev, [e("hit", 4)])).toEqual([e("hit", 4)]);
    expect(warSeerAtTurnStart({ combatId: "c1", entries: prev }).entries).toEqual([prev[0]]);
    expect(warSeerAtTurnStart({ combatId: "c1", entries: [e("dmg", 1)] })).toBeNull();
  });
  it("Книга Битвы — штраф атакам цели по Виткису", () => {
    const v = vitkis([it_("talent", "Book of Battle / Книга Битвы")], [{ ...e("dmg", 2), book: true }]);
    const r = vitkisRules(target, { targetActor: v }, "c1");
    expect(r.find(x => x.id === "vitkis.bookOfBattle").effects[0].value).toBe(-6);
  });
  it("Убийца Ведьм — метка только для рукопашной", () => {
    const v = vitkis([], [], { witchslayerNext: true });
    expect(witchslayerArmed(v, { isMelee: true })).toBe(true);
    expect(witchslayerArmed(v, { isMelee: false })).toBe(false);
  });
});
