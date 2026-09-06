// test/rules/library/ogryn.test.mjs
//
// wdbc-flai: у расы Огрин, в отличие от Астартес, не было файла правил вовсе —
// и признака «сложен под огринское оружие» взять было неоткуда. Без него
// расчёт rules/ogryn-fit.mjs не отличал бы Огрина от человека и штрафовал бы
// Огрина за его же дубину.

import { describe, it, expect } from "vitest";
import { collectRules } from "../../../module/rules/collect.mjs";
import { hasRuleFlag } from "../../../module/rules/flags.mjs";
import { RACES } from "../../../module/constants/races.mjs";
import { OGRYN_RULES } from "../../../module/rules/library/ogryn.mjs";
import { OGRYN_FIT_FLAG } from "../../../module/rules/ogryn-fit.mjs";

const actor = (over = {}) => ({
  system: { race: "ogryn", size: 1, characteristics: {}, ...over },
  items: []
});

describe("правила расы Огрин", () => {
  it("раса отдаёт правила в сборку", () => {
    expect(RACES.ogryn.rules).toBe(OGRYN_RULES);
  });

  it("у актора расы ogryn собирается признак сложения под огринское оружие", () => {
    expect(collectRules(actor()).map(r => r.id)).toContain("ogryn.bruteWeapons");
  });

  it("возможность реально доезжает до читателя расчёта", () => {
    expect(hasRuleFlag(actor(), OGRYN_FIT_FLAG)).toBe(true);
  });

  it("человеку эта возможность не достаётся", () => {
    expect(hasRuleFlag(actor({ race: "human", size: 0 }), OGRYN_FIT_FLAG)).toBe(false);
  });
});
