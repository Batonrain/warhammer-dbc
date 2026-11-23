// Живой Стяг (Черта Герольда, Разобрать lg5r8).
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { hasLivingBanner, livingBannerSkill, livingBannerRecipients } from "../../module/rules/living-banner.mjs";
import { checkTargetWrite } from "../../module/combat/gm-relay.mjs";

const herald = { uuid: "Actor.h", items: [{ type: "trait", name: "Living Banner / Живой Стяг" }],
  system: { skills: { command: { total: 45 }, charm: { total: 50 } } } };

describe("Живой Стяг", () => {
  it("узнаёт Черту", () => expect(hasLivingBanner(herald)).toBe(true));
  it("бросает лучший из Command/Charm", () => {
    expect(livingBannerSkill(herald).key).toBe("charm");
    expect(livingBannerSkill({ system: { skills: { command: { total: 60 }, charm: { total: 50 } } } }).key).toBe("command");
  });
  it("Очко возвращают только тем, у кого есть потраченные", () => {
    const a = { v: 1, m: 3 }, b = { v: 3, m: 3 };
    expect(livingBannerRecipients([a, b], { value: x => x.v, max: x => x.m })).toEqual([a]);
  });
  it("ГМ-реле: только с Чертой у инициатора и без лишних полей", () => {
    expect(checkTargetWrite({ kind: "livingBannerBoon" }, { initiatorOwned: true, initiator: herald }).ok).toBe(true);
    expect(checkTargetWrite({ kind: "livingBannerBoon", amount: 5 }, { initiatorOwned: true, initiator: herald }).ok).toBe(false);
    expect(checkTargetWrite({ kind: "livingBannerBoon" }, { initiatorOwned: true, initiator: { items: [] } }).ok).toBe(false);
  });
});
