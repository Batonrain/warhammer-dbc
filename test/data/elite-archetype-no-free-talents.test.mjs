// test/data/elite-archetype-no-free-talents.test.mjs
//
// Сверка Главы 3 «Элитные архетипы» (03.11.2026): Дополнительные Таланты
// архетипа в книге ПОКУПАЮТСЯ за опыт отдельно («Дополнительные Таланты …
// изучаются отдельно и требуют траты опыта, как любые обычные Таланты»), а
// Конструктор архетипа выдавал их все сразу при покупке с cost:0/granted:true
// (живая проверка: Шумовой Десантник — 7 Талантов даром, Мейстер — 5 Стадий
// Пакта даром). Решение владельца: убрать выдачу у всех, включая Пакты.
//
//  1. Ни одна запись Конструктора архетипа не выдаёт Талант из его
//     system.talents (Дополнительные Таланты).
//  2. СТАРТОВЫЕ Таланты из «Преимуществ» (Hatred, Peer, Exotic Weapon Training
//     и т. п.) по-прежнему выдаются — защита от перегиба при чистке.
//  3. Стадии Пакта покупаются по цене книги: 750 / 1000 / 1000 / 1500 / 2000.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixedTalentCost, talentCostXP, charAptitudeSet } from "../../module/constants/advancement.mjs";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ELITE_DIR = join(ROOT, "packs-src/elite-archetypes");

function jsonFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...jsonFiles(p));
    else if (e.name.endsWith(".json") && e.name !== "_Folder.json") out.push(p);
  }
  return out;
}

const archetypes = jsonFiles(ELITE_DIR).map(p => JSON.parse(readFileSync(p, "utf8")));
const byName = part => archetypes.find(a => a.name.startsWith(part));
const groupsOf = doc => doc?.flags?.["warhammer-dbc"]?.mechanics ?? [];

/** Все записи Конструктора архетипа, включая вложенные подгруппы. */
function* entriesOf(doc) {
  function* walk(entries) {
    for (const e of entries ?? []) {
      if (e.kind === "group" && e.group) yield* walk(e.group.entries);
      else yield e;
    }
  }
  for (const g of groupsOf(doc)) yield* walk(g.entries);
}

const enHalf = s => String(s ?? "").split("/")[0].replace(/\s+/g, " ").trim().toLowerCase();

describe("Дополнительные Таланты архетипа не выдаются при покупке", () => {
  const withExtra = archetypes.filter(a => (a.system?.talents ?? []).length);

  it("в паке есть архетипы с Дополнительными Талантами (тест не пустой)", () => {
    expect(withExtra.length).toBeGreaterThan(40);
  });

  for (const doc of withExtra) {
    it(`${doc.name}: ни одной выдачи Таланта из system.talents`, () => {
      const extra = new Set(doc.system.talents.map(enHalf));
      const granted = [...entriesOf(doc)]
        .filter(e => e.kind === "talent" && extra.has(enHalf(e.sourceName)))
        .map(e => e.sourceName);
      expect(granted).toEqual([]);
    });
  }
});

describe("стартовые Таланты из «Преимуществ» по-прежнему выдаются", () => {
  const has = (arch, re) => [...entriesOf(byName(arch))].some(e => e.kind === "talent" && re.test(e.sourceName ?? ""));

  it.each([
    ["Noise Marine",       /Exotic Weapon Training/],
    ["Noise Marine",       /Heightened Senses/],
    ["Noise Marine",       /Resistance/],
    ["Plague Marine",      /Exotic Weapon Training/],
    ["Rubric Sorcerer",    /Peer/],
    ["Dark Apostle",       /Hatred/],
    ["Lord Discordant",    /Hatred/],
    ["Herald",             /Peer/],
    ["Veteran of the Long War", /Hatred/],
    ["Secutor",            /Hatred/],
    ["Warpsmith",          /Mechadendrite Use/],
    ["Warpsmith",          /Strange Technique/],
    ["Warlock",            /Blasphemous Incantation/]
  ])("%s: %s", (arch, re) => {
    expect(has(arch, re)).toBe(true);
  });
});

describe("Стадии Пакта стоят по книге", () => {
  const COST = { 1: 750, 2: 1000, 3: 1000, 4: 1500, 5: 2000 };
  const NAMES = n => [
    `Pact Stage ${n} / Стадия Пакта ${n}`,                      // Вампир
    `Maester Pact Stage ${n} / Стадия Пакта ${n} (Мейстер)`,
    `Revenant Pact Stage ${n} / Стадия Пакта ${n} (Ревенант)`,
    `Cogitor Pact Stage ${n} / Стадия Пакта ${n} (Когитор)`
  ];

  for (const [n, cost] of Object.entries(COST)) {
    it(`Стадия ${n} = ${cost} xp у всех четырёх Пактов`, () => {
      for (const name of NAMES(n)) expect(fixedTalentCost(name), name).toBe(cost);
    });
  }

  it("цена не зависит ни от склонностей, ни от уровня Таланта", () => {
    const apts = charAptitudeSet([]);
    expect(talentCostXP(1, [], apts, "enemy", { name: "Maester Pact Stage 5 / Стадия Пакта 5 (Мейстер)" })).toBe(2000);
    expect(talentCostXP(3, [], apts, "ally",  { name: "Pact Stage 1 / Стадия Пакта 1" })).toBe(750);
  });

  it("обычные Таланты затронуты не были", () => {
    expect(fixedTalentCost("Ambidextrous / Амбидекстр")).toBeNull();
    expect(fixedTalentCost("Pact Stage 6 / Стадия Пакта 6")).toBeNull();
  });
});
