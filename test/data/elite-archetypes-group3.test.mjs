// test/data/elite-archetypes-group3.test.mjs
//
// Сверка Главы 3 «Элитные архетипы», группа 3 (03.11.2026): Скульптор Плоти,
// Король Червей, Кузнец Крови, Архимаг, Чернокнижник, Одержимый. Сторожа по
// данным packs-src — то, что аудит нашёл у этих шести и что молча вернётся
// при следующей правке записи:
//   • «+N Cor» из «Преимуществ» — запись Конструктора kind:"corruption";
//   • «Не может потерять покровительство» — capability patron.locked.<бог>
//     (тот же замок, что у субрас Зверолюда);
//   • Чернокнижник получает Psy Rating (2) от Dark Arts и стартовый Талант
//     Blasphemous Incantation;
//   • Регенерация Короля Червей — формула, которую разбирает Конструктор;
//   • Одержимый — не заготовка: цена 1500 xp и +3d5 Cor.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mechFormulaTotal } from "../../module/rules/mech-formula.mjs";

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
const docs = jsonFiles(ELITE_DIR).map(p => JSON.parse(readFileSync(p, "utf8")));
const byName = part => {
  const hit = docs.filter(d => d.name.startsWith(`${part} /`));
  expect(hit.length, `архетип «${part}»`).toBe(1);
  return hit[0];
};
const entriesOf = doc => (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries ?? []);

describe("«+N Cor» архетипов группы 3 заведено в Конструктор", () => {
  const CASES = [
    ["Flesh Sculptor", "6"], ["King of Worms", "7"], ["Blood Smith", "8"],
    ["Archmage", "9"], ["Warlock", "1d5"], ["Possessed", "3d5"]
  ];
  for (const [name, value] of CASES) {
    it(`${name}: Порча +${value}`, () => {
      const corr = entriesOf(byName(name)).filter(e => e.kind === "corruption");
      expect(corr.map(e => e.corruptionValue)).toEqual([value]);
    });
  }
});

describe("«Не может потерять покровительство» у четырёх культовых Богов", () => {
  const CASES = [
    ["Flesh Sculptor", "slaanesh"], ["King of Worms", "nurgle"],
    ["Blood Smith", "khorne"], ["Archmage", "tzeentch"]
  ];
  for (const [name, god] of CASES) {
    it(`${name}: patron.locked.${god}`, () => {
      const keys = entriesOf(byName(name)).filter(e => e.kind === "capability").map(e => e.capabilityKey);
      expect(keys).toContain(`patron.locked.${god}`);
    });
  }
  it("у Чернокнижника (Бог Неделимый) замка нет", () => {
    const keys = entriesOf(byName("Warlock")).filter(e => e.kind === "capability").map(e => e.capabilityKey);
    expect(keys.filter(k => String(k).startsWith("patron.locked."))).toEqual([]);
  });
});

describe("Чернокнижник: стартовые Таланты из «Преимуществ»", () => {
  const talents = entriesOf(byName("Warlock")).filter(e => e.kind === "talent");
  it("Psy Rating с рейтингом 2 (Dark Arts работает «аналогично Psyker (PR2)»)", () => {
    const pr = talents.find(e => /Psy Rating/.test(e.sourceName));
    expect(pr?.rating).toBe(2);
  });
  it("Blasphemous Incantation выдаётся самим архетипом", () => {
    expect(talents.some(e => /Blasphemous/.test(e.sourceName))).toBe(true);
  });
});

describe("Король Червей: Регенерация ½Cor.b (окр.▲) считается", () => {
  const reg = entriesOf(byName("King of Worms")).find(e => e.kind === "trait" && /Regeneration/.test(e.sourceName));
  it("рейтинг — формула, а не книжная запись", () => {
    // Бонус Порчи 3 → ½ окр.▲ = 2; книжная запись «½Cor.b, окр.▲» давала бы 0.
    expect(mechFormulaTotal(String(reg.rating), { cor: 3 })).toBe(2);
    expect(mechFormulaTotal(String(reg.rating), { cor: 4 })).toBe(2);
    expect(mechFormulaTotal(String(reg.rating), { cor: 5 })).toBe(3);
  });
});

describe("Одержимый — не заготовка", () => {
  const poss = byName("Possessed");
  it("цена 1500 xp, раса «Любая»", () => {
    expect(poss.system.cost).toBe(1500);
    expect(poss.system.race).toBe("Любая");
  });
  it("Становление и Преимущества записаны в карточку", () => {
    expect(poss.system.notes).toMatch(/Становление/);
    expect(poss.system.description).toMatch(/Некоторым последователям Хаоса/);
  });
});
