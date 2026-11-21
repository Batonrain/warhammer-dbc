// test/rules/soul-binding.test.mjs
// Sahara 581-ddee: Ритуал Связывания Души — пороги встречного теста, деление
// урона Выжигания Души / Варп-Оружия, кнопка на карточке ритуала.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  soulBindingThresholds, splitSoulBondDamage, soulBondPartners, withPartner, isSoulBindingRitual, soulBondRangeKm, SOUL_BOND_FLAG
} from "../../module/rules/soul-binding.mjs";
import { soulBindingButtonHtml, shareSoulBondDamage } from "../../module/combat/soul-binding.mjs";

const who = (wp, flags = {}, extra = {}) => ({ system: { characteristics: { wp: { total: wp } }, wounds: { value: 12, max: 12, critical: 0 } }, flags: { "warhammer-dbc": flags }, ...extra });

describe("встречный тест Связывания", () => {
  it("Ритуалист W−30 +10 за Успех после первого, цель W+0", () => {
    expect(soulBindingThresholds(who(60), who(35), 1)).toEqual({ ritualist: 30, target: 35, extra: 0 });
    expect(soulBindingThresholds(who(60), who(35), 3)).toEqual({ ritualist: 50, target: 35, extra: 20 });
  });
  it("предмет-ритуал узнаётся по имени", () => {
    expect(isSoulBindingRitual({ name: "Rite of Soul Binding / Ритуал Связывания Души" })).toBe(true);
    expect(isSoulBindingRitual({ name: "Rite of Audacity" })).toBe(false);
  });
  it("кнопка карточки несёт Успехи ритуала", () => {
    expect(soulBindingButtonHtml({ uuid: "Actor.r" }, 3)).toContain('data-deg="3"');
  });
  it("радиус связи — сумма W.b, км", () => {
    expect(soulBondRangeKm(who(45), who(32))).toBe(7);
  });
});

describe("связь хранится списком партнёров", () => {
  it("без повторов", () => {
    expect(withPartner(["a"], "a")).toEqual(["a"]);
    expect(withPartner(["a"], "b")).toEqual(["a", "b"]);
    expect(soulBondPartners(who(30, { [SOUL_BOND_FLAG]: ["x"] }))).toEqual(["x"]);
    expect(soulBondPartners(who(30))).toEqual([]);
  });
});

describe("деление урона поровну", () => {
  it("пара: себе большая половина (окр.▲)", () => {
    expect(splitSoulBondDamage(9, 1)).toEqual({ self: 5, shares: [4] });
    expect(splitSoulBondDamage(8, 1)).toEqual({ self: 4, shares: [4] });
  });
  it("нет партнёров или урон 1 — не делится", () => {
    expect(splitSoulBondDamage(9, 0)).toEqual({ self: 9, shares: [] });
    expect(splitSoulBondDamage(1, 1)).toEqual({ self: 1, shares: [] });
  });
  it("Ритуалист с двумя связанными — на троих", () => {
    expect(splitSoulBondDamage(10, 2)).toEqual({ self: 4, shares: [3, 3] });
  });
  it("доля партнёра списывается с его Ран", async () => {
    const partner = who(30, {}, { name: "Миньон", isOwner: true, updates: [] });
    partner.update = async u => partner.updates.push(u);
    const prev = globalThis.fromUuid;
    globalThis.fromUuid = async u => (u === "Actor.m" ? partner : null);
    const victim = who(40, { [SOUL_BOND_FLAG]: ["Actor.m"] }, { name: "Колдун" });
    const res = await shareSoulBondDamage(victim, 9);
    globalThis.fromUuid = prev;
    expect(res.net).toBe(5);
    expect(res.note).toContain("Миньон −4");
    expect(partner.updates[0]["system.wounds.value"]).toBe(8);
  });
});
