// Инзорцист: печати, Инзорцизм, Метка Поработителя (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  demonInfOf, sealRitualTurns, sealTPenalty, sealsTPenalty, insorcismHeadDamage, levyMax,
  banishCooldownSeconds, sealBarredRemaining, insorcistAnchorsInstability, markDetectionNeed,
  sealMatchesName, summonStaySeconds, sealsOf, hasInsorcism, HOUR, DAY, MONTH
} from "../../module/rules/insorcist-talents.mjs";
import { hatredTargetsOf } from "../../module/rules/predicates.mjs";
import { anyTargetMatches } from "../../module/rules/talent-targets.mjs";

const NS = "warhammer-dbc";

describe("Печать Имени", () => {
  it("Inf и Inf.b демона", () => {
    expect(demonInfOf({ system: { characteristics: { inf: { total: 45, bonus: 4 } } } })).toEqual({ inf: 45, infB: 4 });
    expect(demonInfOf({ system: { characteristics: { inf: { total: 37 } } } })).toEqual({ inf: 37, infB: 3 });
    expect(demonInfOf({ system: {} })).toEqual({ inf: 0, infB: 0 });
  });
  it("ритуал W.b + Inf.b Ходов", () => {
    expect(sealRitualTurns(4, 3)).toBe(7);
    expect(sealRitualTurns(0, 0)).toBe(1);
  });
  it("T −Inf.b, без Inf — −1", () => {
    expect(sealTPenalty({ inf: 45, infB: 4 })).toBe(4);
    expect(sealTPenalty({ inf: 0, infB: 0 })).toBe(1);
    expect(sealsTPenalty([{ inf: 45, infB: 4 }, { inf: 0 }])).toBe(5);
  });
  it("печати читаются из флага копией", () => {
    const a = { flags: { [NS]: { insorcistSeals: [{ id: "a", name: "X" }] } } };
    const s = sealsOf(a);
    s[0].name = "Y";
    expect(a.flags[NS].insorcistSeals[0].name).toBe("X");
    expect(sealsOf({})).toEqual([]);
  });
});

describe("Инзорцизм", () => {
  it("урон в голову и свита — только Inf 31+", () => {
    expect(insorcismHeadDamage({ inf: 30, infB: 3 })).toBe(0);
    expect(insorcismHeadDamage({ inf: 31, infB: 3 })).toBe(3);
    expect(levyMax({ inf: 52, infB: 5 })).toBe(5);
    expect(levyMax({ inf: 20, infB: 2 })).toBe(0);
  });
  it("срок пребывания W.b суток, запрет после изгнания W.b+Inf.b часов/месяцев", () => {
    expect(summonStaySeconds(4)).toBe(4 * DAY);
    expect(banishCooldownSeconds(4, { infB: 3 })).toBe(7 * HOUR);
    expect(banishCooldownSeconds(4, { infB: 3 }, { severe: true })).toBe(7 * MONTH);
    expect(sealBarredRemaining({ bannedUntil: 1000 }, 400)).toBe(600);
    expect(sealBarredRemaining({ bannedUntil: 1000 }, 2000)).toBe(0);
  });
  it("Нестабильность проходит сама не дальше W м", () => {
    expect(insorcistAnchorsInstability(30, 40)).toBe(true);
    expect(insorcistAnchorsInstability(41, 40)).toBe(false);
    expect(insorcistAnchorsInstability(null, 40)).toBe(true);
  });
  it("имя печати сравнивается по половинам", () => {
    expect(sealMatchesName({ name: "Bloodletter / Кровопускатель" }, "Кровопускатель")).toBe(true);
    expect(sealMatchesName({ name: "Кровопускатель" }, "Bloodletter / Кровопускатель")).toBe(true);
    expect(sealMatchesName({ name: "Плагбеарер" }, "Кровопускатель")).toBe(false);
  });
  it("Черта опознаётся по имени", () => {
    expect(hasInsorcism({ items: [{ type: "trait", name: "Insorcism / Инзорцизм" }] })).toBe(true);
    expect(hasInsorcism({ items: [{ type: "talent", name: "Insorcism / Инзорцизм" }] })).toBe(false);
  });
});

describe("Метка Поработителя", () => {
  it("порог Пси-Чутья по сильнейшей печати", () => {
    expect(markDetectionNeed([])).toBe(3);
    expect(markDetectionNeed([{ inf: 30 }])).toBe(3);
    expect(markDetectionNeed([{ inf: 31 }])).toBe(2);
    expect(markDetectionNeed([{ inf: 50 }, { inf: 60 }])).toBe(1);
    expect(markDetectionNeed([{ inf: 71 }])).toBe(0);
  });
  it("демон ненавидит носителя Метки, не всех подряд", () => {
    const daemon = { type: "daemon", items: [] };
    const marked = { type: "character", items: [{ type: "trait", name: "Mark of Subjugator / Метка Поработителя" }] };
    const plain = { type: "character", items: [] };
    const t = hatredTargetsOf(daemon);
    expect(anyTargetMatches(t, { targetActor: marked }, new Map())).toBe(true);
    expect(anyTargetMatches(t, { targetActor: plain }, new Map())).toBe(false);
    expect(hatredTargetsOf(plain)).toEqual([]);
  });
});
