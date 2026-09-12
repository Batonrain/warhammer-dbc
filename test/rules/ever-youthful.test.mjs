// test/rules/ever-youthful.test.mjs
//
// Ever-Youthful / Вечно Юный (wdbc-1rno, Слаанеш): личный (без ауры)
// иммунитет к негативным эффектам дисциплины Биомантия — та же схема, что
// rules/fatalism.mjs, только без геометрии сцены.

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { everYouthfulBlocksPower } from "../../module/rules/ever-youthful.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function grantEverYouthfulTo(bearer) {
  clearRuleSources();
  registerRuleSource("test", a => a === bearer
    ? [{ id: "test.everYouthful", when: {}, effects: [{ kind: "grantFlag", target: "gift.slaanesh.everYouthful" }] }]
    : []);
}

describe("everYouthfulBlocksPower", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("Дар + дисциплина Биомантия — гасит", () => {
    const bearer = {};
    grantEverYouthfulTo(bearer);
    expect(everYouthfulBlocksPower(bearer, "biomancy")).toBe(true);
  });

  it("Дар, но другая дисциплина — не гасит", () => {
    const bearer = {};
    grantEverYouthfulTo(bearer);
    expect(everYouthfulBlocksPower(bearer, "divination")).toBe(false);
    expect(everYouthfulBlocksPower(bearer, "")).toBe(false);
  });

  it("без Дара — не гасит, даже Биомантию", () => {
    clearRuleSources();
    expect(everYouthfulBlocksPower({}, "biomancy")).toBe(false);
  });

  it("регистр дисциплины не важен", () => {
    const bearer = {};
    grantEverYouthfulTo(bearer);
    expect(everYouthfulBlocksPower(bearer, "Biomancy")).toBe(true);
  });

  it("без актора — не падает, false", () => {
    clearRuleSources();
    expect(everYouthfulBlocksPower(null, "biomancy")).toBe(false);
  });
});
