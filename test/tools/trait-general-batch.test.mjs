// test/tools/trait-general-batch.test.mjs
//
// Общие Черты, пачка 19.11.2026: Зверь, шаблоны Сверхъестественной
// Характеристики, Мутант, Скакун, Непослушный, Посвящение, Бурильщик.
// Сторожа держат обе стороны: запись в паке и то, что её читает.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { rollModsFromRules } from "../../module/rules/resolve-test.mjs";
import { autoSuccessChecked, ruleRollModsHtml } from "../../module/rules/roll-mods.mjs";
import { unnaturalRating } from "../../module/rules/unnatural-characteristic.mjs";
import { applyUnnaturalChoice, chosenUnnaturalChar, UNNATURAL_PHYSICAL }
  from "../../module/apps/unnatural-choice.mjs";
import { minionCorruption, traitAvailability, availableTraits, traitPointsLeft }
  from "../../module/rules/minion-build.mjs";
import { minionLacksSteed, unrulyRiders } from "../../module/rules/mount.mjs";
import { burrowRatingOf, burrowSpeedOf } from "../../module/rules/flight-speed.mjs";
import { traitTestLabel } from "../../module/combat/trait-test.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".json") ? [path.join(d, e.name)] : []);
}
const traitDocs = walk(path.join(ROOT, "packs-src/traits")).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
const byName = n => traitDocs.find(d => d.name.startsWith(n));
const asItem = d => ({ id: d._id, name: d.name, type: d.type, system: d.system, flags: d.flags });
const entriesOf = d => (d.flags?.["warhammer-dbc"]?.mechanics ?? []).flatMap(g => g.entries ?? []);
const isMemo = e => e.kind === "script" && /^\/\/ Памятка/.test(e.code ?? "");

describe("Зверь: автоуспех Выживания и тест опасности", () => {
  const bestial = byName("Bestial /");

  it("памятки больше нет: галочка и кнопка теста", () => {
    const entries = entriesOf(bestial);
    expect(entries.some(isMemo)).toBe(false);
    expect(entries.find(e => e.kind === "testMod")?.modValueMode).toBe("autoSuccess");
    const scr = entries.find(e => e.kind === "script");
    expect(scr.code).toMatch(/rollTraitTest\(actor/);
    expect(scr.scriptOnPanel).toBe(true);
  });

  it("галочка автоуспеха попадает в тест Выживания, а не в другие", () => {
    const rules = rulesFromItemMechanics([asItem(bestial)]);
    const survival = rollModsFromRules(rules, { kind: "skill", skill: "survival", char: "per" });
    const auto = survival.filter(m => m.autoSuccess);
    expect(auto).toHaveLength(1);
    expect(auto[0].value).toBe(0);
    const other = rollModsFromRules(rules, { kind: "skill", skill: "awareness", char: "per" });
    expect(other.some(m => m.autoSuccess)).toBe(false);
  });

  it("автоуспех засчитывается, только если галочку отметили", () => {
    const mods = [{ ruleId: "a", autoSuccess: true, value: 0 }, { ruleId: "b", value: 10 }];
    expect(autoSuccessChecked(mods, ["a"])).toBe(true);
    expect(autoSuccessChecked(mods, ["b"])).toBe(false);
    expect(autoSuccessChecked(mods, [])).toBe(false);
  });

  it("в окне броска галочка подписана «автоуспех»", () => {
    const { html } = ruleRollModsHtml({ items: [] }, {}, { mods: [{ ruleId: "x", label: "Зверь", value: 0, autoSuccess: true }] });
    expect(html).toContain("(автоуспех)");
    expect(html).toContain('data-rule-id="x"');
  });

  it("подпись теста Черты", () => {
    expect(traitTestLabel("wp", 0)).toBe("WP+0");
    expect(traitTestLabel("ag", -10)).toBe("Ag−10");
  });
});

describe("Сверхъестественная Характеристика: шаблоны с выбором", () => {
  for (const prefix of ["Unnatural Characteristic /", "Unnatural (выбор)"]) {
    const doc = byName(prefix);
    it(`${prefix}: запись «бонус = rating» без Характеристики и скрипт при выдаче`, () => {
      const entries = entriesOf(doc);
      const ch = entries.find(e => e.kind === "characteristic");
      expect(ch).toMatchObject({ field: "bonus", op: "add", value: "rating", charKey: "" });
      const scr = entries.find(e => e.kind === "script");
      expect(scr.scriptOnGrant).toBe(true);
      expect(scr.code).toMatch(/chooseUnnaturalCharacteristic\(item/);
      // До выбора шаблон ничего не даёт.
      expect(unnaturalRating({ items: [asItem(doc)] }, "s")).toBe(0);
    });
  }

  it("выбор пишет Характеристику в запись, и +½X Успехов её видит", () => {
    const doc = structuredClone(byName("Unnatural (выбор)"));
    const groups = doc.flags["warhammer-dbc"].mechanics;
    const { groups: next, found } = applyUnnaturalChoice(groups, "t");
    expect(found).toBe(true);
    expect(chosenUnnaturalChar(next)).toBe("t");
    // исходник не тронут
    expect(chosenUnnaturalChar(groups)).toBe("");
    doc.flags["warhammer-dbc"].mechanics = next;
    doc.system.rating = 4;
    const actor = { items: [asItem(doc)] };
    expect(unnaturalRating(actor, "t")).toBe(4);
    expect(unnaturalRating(actor, "s")).toBe(0);
  });

  it("ИЛИ-ветка не считается выбором", () => {
    const groups = [{ operator: "OR", entries: [{ kind: "characteristic", field: "bonus", charKey: "" }] }];
    expect(applyUnnaturalChoice(groups, "s").found).toBe(false);
  });

  it("«выбор» ограничен S/T/A/P", () => {
    expect(UNNATURAL_PHYSICAL).toEqual(["s", "t", "ag", "per"]);
  });
});

describe("Мутант: Порча Миньона не ниже X×20", () => {
  it("без Мутанта — как раньше", () => {
    expect(minionCorruption("human", [])).toBe(0);
    expect(minionCorruption("daemon")).toBe(100);
  });
  it("Мутант (2) — не ниже 40, демону не снижает", () => {
    expect(minionCorruption("human", [{ name: "Mutant / Мутант", rating: 2 }])).toBe(40);
    expect(minionCorruption("beast", [{ name: "Mutant / Мутант", rating: null }])).toBe(20);
    expect(minionCorruption("daemon", [{ name: "Mutant / Мутант", rating: 2 }])).toBe(100);
  });
});

describe("Скакун: Трейты скакунов открываются только со Steed", () => {
  it("без Steed недоступны и в список не попадают", () => {
    const a = traitAvailability("Unruly", "beast", "standard", []);
    expect(a.allowed).toBe(false);
    expect(a.reason).toMatch(/Steed/);
    expect(availableTraits("beast", "standard", []).some(t => t.name === "All-Terrain")).toBe(false);
  });
  it("со Steed открыты по цене книги", () => {
    const chosen = ["Steed / Скакун"];
    expect(traitAvailability("Unruly", "beast", "standard", chosen)).toMatchObject({ allowed: true, cost: -1 });
    expect(traitAvailability("All-Terrain", "beast", "standard", chosen).cost).toBe(0.5);
    expect(traitAvailability("Ablative Plating", "machine", "lesser", chosen).cost).toBe(1);
    const names = availableTraits("beast", "standard", chosen).map(t => t.name);
    expect(names).toEqual(expect.arrayContaining(["Stand", "War-Trained", "Maneuverable",
      "Blades (1d10+2 R, Pen 0)", "Blades (2d10+2 R, Pen 2, Tearing)"]));
  });
  it("человеку Трейты скакунов не положены и со Steed", () => {
    expect(traitAvailability("Stand", "human", "standard", ["Steed / Скакун"]).allowed).toBe(false);
  });
  it("бюджет: Размер бесплатен, недостаток возвращает очко, ½ считается", () => {
    const left = traitPointsLeft([{ cost: 0 }, { cost: -1 }, { cost: 0.5 }], "standard");
    const base = traitPointsLeft([], "standard");
    expect(left).toBe(base + 0.5);
  });
  it("посадка на Миньона без Steed — предупреждение; Персонажу Трейт не нужен", () => {
    const steed = { type: "minion", items: [{ type: "trait", name: "Steed / Скакун" }] };
    expect(minionLacksSteed({ type: "minion", items: [] })).toBe(true);
    expect(minionLacksSteed(steed)).toBe(false);
    expect(minionLacksSteed({ type: "character", items: [] })).toBe(false);
  });
});

describe("Непослушный: кнопка теста приходит седокам", () => {
  const mount = { uuid: "Actor.m", items: [{ type: "trait", name: "Unruly / Непослушный", system: {} }] };
  const rider = { uuid: "Actor.r", system: { mount: { uuid: "Actor.m" } } };
  const stranger = { uuid: "Actor.s", system: { mount: { uuid: "Actor.x" } } };
  it("только седоки этого скакуна и только с Чертой", () => {
    expect(unrulyRiders(mount, [rider, stranger])).toEqual([rider]);
    expect(unrulyRiders({ ...mount, items: [] }, [rider])).toEqual([]);
  });
});

describe("Посвящение: выбор Бога — ИЛИ из четырёх божественных Трейтов", () => {
  const doc = byName("Dedication /");
  it("группа ИЛИ, каждая запись ссылается на существующую Черту", () => {
    const groups = doc.flags["warhammer-dbc"].mechanics;
    expect(groups).toHaveLength(1);
    expect(groups[0].operator).toBe("OR");
    const ids = new Set(traitDocs.map(d => d._id));
    for (const e of groups[0].entries) {
      expect(e.kind).toBe("trait");
      expect(ids.has(e.sourceUuid.split(".").pop())).toBe(true);
    }
    expect(groups[0].entries).toHaveLength(4);
  });
});

describe("Бурильщик: скорость рытья SPD×X без Размера", () => {
  const items = [{ type: "trait", name: "Burrower / Бурильщик (X)", system: { rating: 2 } }];
  it("X и скорость", () => {
    expect(burrowRatingOf(items)).toBe(2);
    expect(burrowSpeedOf(items, 3)).toBe(6);
    expect(burrowSpeedOf(items, 0)).toBe(1);
    expect(burrowSpeedOf([], 3)).toBeNull();
  });
});

describe("пачка: памяток у этих Черт не осталось", () => {
  for (const n of ["Bestial /", "Burrower /", "Mutant /", "Steed /", "Dedication /"]) {
    it(n, () => expect(entriesOf(byName(n)).some(isMemo)).toBe(false));
  }
});
