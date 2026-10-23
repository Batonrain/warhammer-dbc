// test/rules/takedown.test.mjs
//
// Takedown / Вырубание (Рукопашные, гл. 3) и That's Not All / Ещё Не Всё
// (Друкхари): чистая логика module/rules/takedown.mjs + выдача Возможностей
// НАСТОЯЩИМИ документами Талантов из packs-src (ловушка «читатель есть, а
// выдачи нет» — test/tools/capability-reachable-ratchet.test.mjs).

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import {
  hasTakedown, hasThatsNotAll, stunUnrestricted, stunForcedAim,
  leapUpDenied, standUpExtraApCost, LEAP_UP_DENIED_FLAG, TAKEDOWN, THATS_NOT_ALL
} from "../../module/rules/takedown.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

const talent = name => ({ id: `t-${name}`, type: "talent", name });
const bearer = (...names) => ({ type: "character", system: { characteristics: {}, conditions: {} }, items: names.map(talent) });

function talentDoc(prefix) {
  const base = path.join(ROOT, "packs-src", "talents");
  const hits = [];
  for (const d of fs.readdirSync(base, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(base, d.name))) if (f.startsWith(prefix)) hits.push(path.join(base, d.name, f));
  }
  expect(hits, `в packs-src/talents должен быть ровно один ${prefix}*`).toHaveLength(1);
  return JSON.parse(fs.readFileSync(hits[0], "utf8"));
}

/** Носитель Таланта из пака; имя испорчено, чтобы совпасть мог только ключ Возможности. */
function bearerOfDoc(doc) {
  const item = { id: "it1", type: doc.type, name: "ИСПОРЧЕННОЕ ИМЯ", system: { ...(doc.system ?? {}) }, flags: doc.flags };
  return { type: "character", system: { characteristics: {}, conditions: {} }, items: [item] };
}

function lyingActor({ prone = true, flag = false } = {}) {
  return {
    system: { conditions: { prone } },
    getFlag: (scope, key) => (scope === "warhammer-dbc" && key === LEAP_UP_DENIED_FLAG ? flag : undefined)
  };
}

describe("Вырубание: опознание Таланта", () => {
  it("по имени (двуязычному)", () => {
    expect(hasTakedown(bearer("Takedown / Вырубание"))).toBe(true);
    expect(hasTakedown(bearer("Disarm / Обезоруживание"))).toBe(false);
  });
  it("Ещё Не Всё опознаётся по имени и не путается с Вырубанием", () => {
    expect(hasThatsNotAll(bearer("That's Not All / Ещё Не Всё"))).toBe(true);
    expect(hasThatsNotAll(bearer("Takedown / Вырубание"))).toBe(false);
    expect(hasTakedown(bearer("That's Not All / Ещё Не Всё"))).toBe(false);
  });
});

describe("Вырубание: приём Оглушить без ограничений", () => {
  it("без Таланта окно форсирует прицел в Голову, с Талантом — не форсирует", () => {
    expect(stunForcedAim(bearer())).toBe("head");
    expect(stunForcedAim(bearer("Takedown / Вырубание"))).toBeNull();
  });
  it("снятие ограничения по оружию — только у носителя", () => {
    expect(stunUnrestricted(bearer())).toBe(false);
    expect(stunUnrestricted(bearer("Takedown / Вырубание"))).toBe(true);
  });
});

describe("Ещё Не Всё: метка запрета Вскочить и надбавка к цене Встать", () => {
  it("помеченный лежачий — +1 ОД", () => {
    expect(leapUpDenied(lyingActor({ flag: true }))).toBe(true);
    expect(standUpExtraApCost(lyingActor({ flag: true }))).toBe(1);
  });
  it("метка без Состояния «Повален» (осталась после ручного снятия) — не действует", () => {
    expect(standUpExtraApCost(lyingActor({ prone: false, flag: true }))).toBe(0);
  });
  it("лежачий без метки — надбавки нет", () => {
    expect(standUpExtraApCost(lyingActor({ flag: false }))).toBe(0);
  });
  it("актор без getFlag (подставной) не падает", () => {
    expect(standUpExtraApCost({ system: { conditions: { prone: true } } })).toBe(0);
    expect(standUpExtraApCost(null)).toBe(0);
  });
});

describe("Выдача Возможностей настоящими документами пака", () => {
  it("Takedown несёт meleeCore.core.takedown", () => {
    expect(hasRuleFlag(bearerOfDoc(talentDoc("Takedown___")), TAKEDOWN.key)).toBe(true);
    expect(hasTakedown(bearerOfDoc(talentDoc("Takedown___")))).toBe(true);
  });
  it("That's Not All несёт condition.denyLeapUp.afterStunProne", () => {
    const a = bearerOfDoc(talentDoc("That_s_Not_All___"));
    expect(hasRuleFlag(a, THATS_NOT_ALL.key)).toBe(true);
    expect(hasThatsNotAll(a)).toBe(true);
  });
  it("без Талантов Возможностей нет", () => {
    const a = { type: "character", system: { characteristics: {} }, items: [] };
    expect(hasRuleFlag(a, TAKEDOWN.key)).toBe(false);
    expect(hasRuleFlag(a, THATS_NOT_ALL.key)).toBe(false);
  });
});
