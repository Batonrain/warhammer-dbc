// Дикий Псайкер: Щит Цепей и Таланты (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  chainShieldMax, chainShieldValue, chainShieldRegen, chainShieldTurnStart, chainShieldHit,
  chainScarsReduce, deathEaterMod, alacritySkillDelta, applyAlacritySkills, alacrityFlightSpd,
  rejectionWeeks, SECONDS_PER_WEEK, hasShieldOfChains, hasHeartFire
} from "../../module/rules/wild-psyker-talents.mjs";

const NS = "warhammer-dbc";
const psyker = ({ pr = 4, tpr = 3, pool = 0, down = false, flags = {}, wp = 50, ag = 30, items = [] } = {}) => ({
  items: [{ type: "trait", name: "Shield of Chains / Щит Цепей" }, ...items],
  system: {
    psyker: { rating: pr, currentRating: tpr },
    resourcePools: { chainShield: pool },
    characteristics: { wp: { total: wp, bonus: Math.floor(wp / 10) }, ag: { total: ag, bonus: Math.floor(ag / 10) } }
  },
  flags: { [NS]: { chainShieldDown: down, ...flags } }
});

describe("Щит Цепей: числа", () => {
  it("максимум бPR×3, значение прижато к нему", () => {
    expect(chainShieldMax(psyker({ pr: 4 }))).toBe(12);
    expect(chainShieldValue(psyker({ pr: 4, pool: 40 }))).toBe(12);
    expect(hasShieldOfChains(psyker())).toBe(true);
    expect(hasShieldOfChains({ items: [] })).toBe(false);
  });
  it("регенерация по Завесе: <0 — 0, 0..2 — тPR, 3+ — бPR", () => {
    const a = psyker({ pr: 5, tpr: 2 });
    expect(chainShieldRegen(a, -1)).toBe(0);
    expect(chainShieldRegen(a, 0)).toBe(2);
    expect(chainShieldRegen(a, 3)).toBe(5);
  });
  it("отключённый Щит включается только на полном запасе", () => {
    let r = chainShieldTurnStart(psyker({ pr: 4, tpr: 3, pool: 5, down: true }), 0);
    expect(r).toMatchObject({ before: 5, after: 8, down: true });
    r = chainShieldTurnStart(psyker({ pr: 4, tpr: 3, pool: 10, down: true }), 0);
    expect(r).toMatchObject({ after: 12, down: false, wasDown: true });
  });
});

describe("Щит Цепей: попадание", () => {
  it("AP бPR (минус Pen) + W.b, остаток — Ранам Щита", () => {
    const h = chainShieldHit({ damage: 15, penetration: 2, pr: 4, wb: 5, pool: 12 });
    expect(h).toMatchObject({ effAp: 2, soak: 7, net: 8, after: 4, broke: false });
  });
  it("лишний урон пропадает, Щит отключается", () => {
    const h = chainShieldHit({ damage: 30, penetration: 0, pr: 4, wb: 5, pool: 5 });
    expect(h).toMatchObject({ net: 21, after: 0, broke: true, wasted: 16 });
  });
  it("Иссушающий Заряд удваивает AP и W.b", () => {
    const h = chainShieldHit({ damage: 20, penetration: 0, pr: 4, wb: 5, pool: 12, boosted: true });
    expect(h).toMatchObject({ ap: 8, wb: 10, net: 2 });
  });
});

describe("Таланты", () => {
  it("Шрамы Цепей: урон минус Успехи, не ниже 0", () => {
    expect(chainScarsReduce(5, 2)).toBe(3);
    expect(chainScarsReduce(1, 4)).toBe(0);
  });
  it("Пожиратель Смерти: +5 за каждого умершего после первого", () => {
    expect(deathEaterMod(1)).toBe(0);
    expect(deathEaterMod(4)).toBe(15);
  });
  it("Цепи Стремительности: W вместо A и Hoverer ×2 только пока метка", () => {
    const on = psyker({ wp: 55, ag: 30, flags: { chainsOfAlacrity: 1 } });
    expect(alacritySkillDelta(on)).toBe(25);
    expect(alacritySkillDelta(psyker({ wp: 55, ag: 30 }))).toBe(0);
    const skills = { dodge: { total: 40 }, acrobatics: { total: 35 }, awareness: { total: 20 } };
    applyAlacritySkills(on, skills, on.system.characteristics);
    expect(skills).toMatchObject({ dodge: { total: 65 }, acrobatics: { total: 60 }, awareness: { total: 20 } });
    expect(alacrityFlightSpd(on, 5)).toBe(10);
    expect(alacrityFlightSpd(on, null)).toBe(null);
  });
  it("Отторжение Цепей: целые недели", () => {
    expect(rejectionWeeks(0, SECONDS_PER_WEEK * 2.5)).toEqual({ weeks: 2, next: SECONDS_PER_WEEK * 2 });
    expect(rejectionWeeks(100, 50).weeks).toBe(0);
  });
  it("опознание Таланта по имени", () => {
    expect(hasHeartFire({ items: [{ type: "talent", name: "Heart Fire / Пламя Сердца" }] })).toBe(true);
  });
});
