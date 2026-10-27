// test/rules/aggression-module.test.mjs
//
// Aggression Module / Модуль Агрессии (Скитарии, корбук «Бионика и Кибернетика»,
// стр. 263-275; Sahara focused-wrath-20-bs, п.3). Книга:
//   «Дает Талант Frenzy, способность совершать Избегания в Ярости без обычных
//    ограничений, и автоматический Успех на тестах для выхода из Ярости.
//    Poor.Q: Уменьшает I на 10, пока установлен.
//    Good.Q: Также дает Таланты Cold Fury и Fire in Blood.
//    Best.Q: Как Good.Q, но также убирает штраф к BS в Ярости.»
//
// Тест берёт НАСТОЯЩИЙ документ из packs-src/implants (форма фикстуры из
// выдуманного JSON не доказывает, что запись в паке жива — урок wdbc-g6cb).
// Качество и «установлен» ставятся поверх настоящего документа.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { abs } from "../../tools/packs.mjs";
import { hasColdFury, isMentalActionBlocked } from "../../module/rules/predicates.mjs";
import { hasAbility } from "../../module/rules/ability-by-key.mjs";
import { hasRuleFlag } from "../../module/rules/flags.mjs";
import { rageRules, RAGE_BS_RULE_ID, RAGE_NO_BS_PENALTY } from "../../module/rules/rage.mjs";
import { isKnownCapability } from "../../module/constants/capabilities.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";

// ── настоящий документ из пака ──────────────────────────────────────────────

function loadModule() {
  const dir = abs("packs-src/implants");
  const found = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isDirectory() || !e.name.endsWith(".json") || e.name.startsWith("_")) continue;
    const file = path.join(e.parentPath ?? e.path, e.name);
    const doc = JSON.parse(fs.readFileSync(file, "utf8"));
    if (/aggression module|модуль агрессии/i.test(doc.name ?? "")) found.push(doc);
  }
  expect(found).toHaveLength(1);
  return found[0];
}

const DOC = loadModule();

/** Модуль Агрессии с заданным Качеством; installed/disabled — флаги предмета, как их ставит лист. */
function moduleItem({ quality = "common", installed = true, disabled = false, nullSuppressed = false } = {}) {
  const flags = {
    ...DOC.flags,
    "warhammer-dbc": { ...DOC.flags["warhammer-dbc"], installed, disabled, nullSuppressed }
  };
  return {
    id: "aggr", type: "implant", name: DOC.name,
    system: { ...DOC.system, quality },
    flags,
    getFlag: (scope, key) => flags[scope]?.[key]
  };
}

const actor = (items = [], { inRage = true } = {}) => ({
  system: { inRage, characteristics: {}, wounds: {}, conditions: {} },
  items
});

const rageBsPenalty = a => resolveTest({ actor: a, kind: "char", char: "bs" })
  .autoMods.filter(m => /Ярост/.test(m.label) && m.value === -20);
const ratesPenaltyOn = (a, char) => resolveTest({ actor: a, kind: "char", char })
  .autoMods.some(m => /Ярост/.test(m.label) && m.value === -20);

describe("Модуль Агрессии: настоящий документ пака", () => {
  it("лежит в Скитариях, несёт запись Конструктора (а не только текст)", () => {
    expect(DOC.system.category).toBe("skitarii");
    const entries = DOC.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(e => e.kind === "capability")).toBe(true);
  });

  it("все ключи записей известны реестру Возможностей (опечатка в ключе молча ничего не даст)", () => {
    for (const e of DOC.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries)) {
      expect(isKnownCapability(e.capabilityKey), e.capabilityKey).toBe(true);
    }
  });

  it("вытесняемый id — настоящий id BS-строки Ярости, а запись Best несёт нужный ключ", () => {
    const ids = rageRules(actor()).map(r => r.id);
    expect(ids).toContain(RAGE_BS_RULE_ID);
    const keys = DOC.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain(RAGE_NO_BS_PENALTY);
  });
});

describe("Модуль Агрессии: Frenzy от импланта (по Качествам)", () => {
  for (const quality of ["poor", "common", "good", "best"]) {
    it(`${quality}: Талант Frenzy есть (hasFrenzyTalent читает ключ ability.frenzy)`, () => {
      const a = actor([moduleItem({ quality })]);
      expect(hasAbility(a, "ability.frenzy", "Frenzy", "talent")).toBe(true);
    });
  }

  it("без импланта Frenzy нет", () => {
    expect(hasAbility(actor(), "ability.frenzy", "Frenzy", "talent")).toBe(false);
  });

  it("неустановленный имплант в сумке Frenzy не даёт", () => {
    const a = actor([moduleItem({ quality: "best", installed: false })]);
    expect(hasAbility(a, "ability.frenzy", "Frenzy", "talent")).toBe(false);
  });
});

describe("Модуль Агрессии: Cold Fury — только Good и Best", () => {
  it("Poor и Common: Cold Fury нет", () => {
    expect(hasColdFury(actor([moduleItem({ quality: "poor" })]))).toBe(false);
    expect(hasColdFury(actor([moduleItem({ quality: "common" })]))).toBe(false);
  });

  it("Good и Best: Cold Fury есть", () => {
    expect(hasColdFury(actor([moduleItem({ quality: "good" })]))).toBe(true);
    expect(hasColdFury(actor([moduleItem({ quality: "best" })]))).toBe(true);
  });

  it("неустановленный, отключённый и подавленный (поле Дискорданта) имплант Cold Fury не даёт", () => {
    expect(hasColdFury(actor([moduleItem({ quality: "good", installed: false })]))).toBe(false);
    expect(hasColdFury(actor([moduleItem({ quality: "good", disabled: true })]))).toBe(false);
    expect(hasColdFury(actor([moduleItem({ quality: "good", nullSuppressed: true })]))).toBe(false);
  });

  it("Cold Fury снимает штраф к F в Ярости и разрешает Ментальные действия", () => {
    const common = actor([moduleItem({ quality: "common" })]);
    const good = actor([moduleItem({ quality: "good" })]);
    expect(ratesPenaltyOn(common, "fel")).toBe(true);
    expect(ratesPenaltyOn(good, "fel")).toBe(false);
    expect(isMentalActionBlocked(common)).toBe(true);
    expect(isMentalActionBlocked(good)).toBe(false);
  });

  it("запись Fire in Blood выдана тоже, но только Good и Best", () => {
    for (const [quality, want] of [["poor", false], ["common", false], ["good", true], ["best", true]]) {
      expect(hasRuleFlag(actor([moduleItem({ quality })]), "berserker.core.fireInBlood"), quality).toBe(want);
    }
  });
});

describe("Модуль Агрессии: штраф BS в Ярости снят только на Best", () => {
  it("Poor, Common, Good — штраф −20 на тест BS остаётся", () => {
    for (const quality of ["poor", "common", "good"]) {
      const a = actor([moduleItem({ quality })]);
      expect(rageBsPenalty(a), quality).toHaveLength(1);
    }
  });

  it("Best — штрафа −20 на тест BS нет", () => {
    expect(rageBsPenalty(actor([moduleItem({ quality: "best" })]))).toHaveLength(0);
  });

  it("Best снимает ТОЛЬКО BS: штраф к I остаётся (Cold Fury снимает F, но не I)", () => {
    const a = actor([moduleItem({ quality: "best" })]);
    expect(ratesPenaltyOn(a, "int")).toBe(true);
    expect(ratesPenaltyOn(a, "fel")).toBe(false);
  });

  it("неустановленный Best (в сумке) штраф BS не снимает", () => {
    expect(rageBsPenalty(actor([moduleItem({ quality: "best", installed: false })]))).toHaveLength(1);
  });

  it("отключённый и подавленный Best штраф BS не снимает", () => {
    expect(rageBsPenalty(actor([moduleItem({ quality: "best", disabled: true })]))).toHaveLength(1);
    expect(rageBsPenalty(actor([moduleItem({ quality: "best", nullSuppressed: true })]))).toHaveLength(1);
  });

  it("вне Ярости записей нет вовсе", () => {
    expect(rageRules(actor([moduleItem({ quality: "best" })], { inRage: false }))).toEqual([]);
  });
});

describe("Модуль Агрессии: окно атаки (строка «Ярость: −20 BS»)", () => {
  const html = () => captured.dialog?.content ?? "";
  const hasRageRow = () => html().includes("<span>Ярость: −20 BS");
  const prevCanvas = globalThis.canvas;
  beforeEach(() => {
    resetCaptured();
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
  });
  afterEach(() => { globalThis.canvas = prevCanvas; });

  function open(weaponClass, items) {
    const weapon = weaponFor({ weaponClass });
    const a = actorFor({ items: [weapon, ...items], fatigue: { value: 0 }, aiming: "none", inRage: true });
    a.type = "character"; a.uuid = "Actor.skitarius"; a.update = async () => {};
    showAttackDialog(a, weapon);
  }

  it("Common и Good: стрельба в Ярости получает −20 BS", () => {
    for (const quality of ["common", "good"]) {
      resetCaptured();
      open("basic", [moduleItem({ quality })]);
      expect(hasRageRow(), quality).toBe(true);
    }
  });

  it("Best: строки −20 BS в окне стрельбы нет", () => {
    open("basic", [moduleItem({ quality: "best" })]);
    expect(hasRageRow()).toBe(false);
  });

  it("Best, но имплант не установлен: строка остаётся", () => {
    open("basic", [moduleItem({ quality: "best", installed: false })]);
    expect(hasRageRow()).toBe(true);
  });
});
