import { describe, it, expect } from "vitest";
import {
  isCyberneticExcellence, isMultipleArmsTrait, cyberneticExcellenceTalent,
  cyberneticExcellencePurchases, cyberneticExcellenceCap
} from "../../module/rules/cybernetic-excellence.mjs";

const talent = (name, rating) => ({ type: "talent", name, system: { rating } });
const trait  = (name, rating) => ({ type: "trait", name, system: { rating } });

describe("isCyberneticExcellence / isMultipleArmsTrait", () => {
  it("узнаёт Талант по любой части двуязычного имени", () => {
    expect(isCyberneticExcellence(talent("Cybernetic Excellence / Кибернетическое Превосходство", 1))).toBe(true);
    expect(isCyberneticExcellence(talent("кибернетическое превосходство", 1))).toBe(true);
    expect(isCyberneticExcellence(trait("Cybernetic Excellence", 1))).toBe(false);   // не тот type
    expect(isCyberneticExcellence(talent("Sure Strike / Точный удар", 1))).toBe(false);
  });

  it("узнаёт Трейт Multiple Arms по любой части имени", () => {
    expect(isMultipleArmsTrait(trait("Multiple Arms / Многорукий (X)", 2))).toBe(true);
    expect(isMultipleArmsTrait(trait("многорукий", 2))).toBe(true);
    expect(isMultipleArmsTrait(talent("Multiple Arms", 2))).toBe(false);   // не тот type
  });
});

describe("cyberneticExcellenceTalent / cyberneticExcellencePurchases", () => {
  it("нет Таланта — 0 покупок", () => {
    expect(cyberneticExcellenceTalent([])).toBeNull();
    expect(cyberneticExcellencePurchases([])).toBe(0);
  });

  it("читает system.rating купленного Таланта", () => {
    const items = [talent("Cybernetic Excellence / Кибернетическое Превосходство", 3)];
    expect(cyberneticExcellenceTalent(items)?.name).toContain("Кибернетическое");
    expect(cyberneticExcellencePurchases(items)).toBe(3);
  });

  it("отрицательный/нечисловой рейтинг не проваливается в минус", () => {
    expect(cyberneticExcellencePurchases([talent("Cybernetic Excellence / Кибернетическое Превосходство", -2)])).toBe(0);
    expect(cyberneticExcellencePurchases([talent("Cybernetic Excellence / Кибернетическое Превосходство", "x")])).toBe(0);
  });
});

describe("cyberneticExcellenceCap — ½I.b+1, округление вниз", () => {
  it.each([
    [0, 1], [1, 1], [2, 2], [3, 2], [4, 3], [5, 3], [6, 4]
  ])("I.b=%i → потолок %i", (intBonus, cap) => {
    expect(cyberneticExcellenceCap(intBonus)).toBe(cap);
  });
});
