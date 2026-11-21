// test/rules/monodevotant.test.mjs
//
// Монозависимый (Черта Миньона): ломка без субстанции — срок 1d10+W.b дней,
// затем −10 ко всем тестам и ещё −5 за каждый следующий день (rules/monodevotant.mjs).

import { describe, it, expect } from "vitest";
import { monodevotantPenalty, monodevotantDaysLeft, monodevotantRules, monodevotantTrait,
         SUBSTANCE_AT_FLAG, GRACE_DAYS_FLAG, NOTICED_FLAG, withdrawalNoticeDue, withdrawalOutcomeUpdate }
  from "../../module/rules/monodevotant.mjs";
import { packDocuments } from "../support/pack-docs.mjs";

const DAY = 86400;
const trait = (at, grace) => ({
  type: "trait", name: "Monodevotant / Монозависимый", system: {},
  flags: { "warhammer-dbc": at === undefined ? {} : { [SUBSTANCE_AT_FLAG]: at, [GRACE_DAYS_FLAG]: grace } }
});

describe("штраф ломки", () => {
  it("без отметки дозы — штрафа нет", () => {
    expect(monodevotantPenalty(undefined, 5, 100 * DAY)).toBe(0);
    expect(monodevotantDaysLeft(null, 5, 100 * DAY)).toBe(null);
  });
  it("до конца срока — 0, в день срока −10, дальше −5 за день", () => {
    expect(monodevotantPenalty(0, 5, 4 * DAY + 100)).toBe(0);
    expect(monodevotantDaysLeft(0, 5, 4 * DAY)).toBe(1);
    expect(monodevotantPenalty(0, 5, 5 * DAY)).toBe(10);
    expect(monodevotantPenalty(0, 5, 6 * DAY)).toBe(15);
    expect(monodevotantPenalty(0, 5, 8 * DAY + 10)).toBe(25);
  });
  it("правило — автоматический −штраф ко всем броскам", () => {
    const rules = monodevotantRules({ items: [trait(0, 3)] }, 4 * DAY);
    expect(rules).toHaveLength(1);
    expect(rules[0].effects[0]).toMatchObject({ kind: "rollBonus", target: "all", value: -15, auto: true });
    expect(monodevotantRules({ items: [trait(0, 3)] }, 2 * DAY)).toEqual([]);
    expect(monodevotantRules({ items: [] }, 99 * DAY)).toEqual([]);
  });
});

describe("Черта в паке", () => {
  it("опознаётся и несёт кнопку «Получил субстанцию» на панели", () => {
    const d = packDocuments("traits", "trait").map(x => x.doc).find(x => x.name.startsWith("Monodevotant"));
    expect(monodevotantTrait({ items: [d] })).toBe(d);
    const e = d.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(x => x.scriptOnPanel);
    expect(e.code).toMatch(/giveMonodevotantSubstance\(actor, item\)/);
  });
});

describe("исход ломки — развилка ГМа (Sahara 582)", () => {
  const noticed = (t, pen) => { t.flags["warhammer-dbc"][NOTICED_FLAG] = pen; return t; };
  it("спрашивается, когда штраф появился или вырос, и не повторяется на той же ступени", () => {
    expect(withdrawalNoticeDue(trait(0, 5), 4 * DAY)).toBe(0);
    expect(withdrawalNoticeDue(trait(0, 5), 5 * DAY)).toBe(10);
    expect(withdrawalNoticeDue(noticed(trait(0, 5), 10), 5 * DAY + 100)).toBe(0);
    expect(withdrawalNoticeDue(noticed(trait(0, 5), 10), 6 * DAY)).toBe(15);
    expect(withdrawalNoticeDue(null, 6 * DAY)).toBe(0);
  });
  it("уходит — связь с хозяином рвётся; умирает — метка смерти; держится — ничего", () => {
    expect(withdrawalOutcomeUpdate("leave")).toEqual({ "system.masterUuid": "" });
    expect(withdrawalOutcomeUpdate("die")).toEqual({ "flags.warhammer-dbc.deceased": true });
    expect(withdrawalOutcomeUpdate("stay")).toBeNull();
  });
});
