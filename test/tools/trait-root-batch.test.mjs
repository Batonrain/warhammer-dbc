// test/tools/trait-root-batch.test.mjs
//
// Шаг 3, Черты корня папки (18.11.2026). Семь Черт скакуна уже работали в
// верховом бою (rules/mount.mjs ищет их по таблице MOUNT_TRAIT_DEFS), но
// замер их не видел и заметки писали «не смоделировано». Сторожим обе стороны:
// замер узнаёт имена из поля `names: [...]`, а верховой бой — сами Черты пака.

import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { analyzeCoverage } from "../../tools/automation-coverage.mjs";
import { mountTraits } from "../../module/rules/mount.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const TRAITS = path.join(ROOT, "packs-src", "traits");
const load = (prefix) => {
  const f = fs.readdirSync(TRAITS).find(n => n.startsWith(prefix));
  return JSON.parse(fs.readFileSync(path.join(TRAITS, f), "utf8"));
};
const asItem = d => ({ id: d._id, name: d.name, type: d.type, system: d.system, flags: d.flags });

const MOUNT = {
  Ablative_Plating: "ablativePlating", All_Terrain: "allTerrain", Blades__X: "blades",
  Maneuverable: "maneuverable", Stand___: "stand", Unruly: "unruly", War_Trained: "warTrained"
};

let cov;
beforeAll(async () => { cov = await analyzeCoverage(); }, 60_000);

describe("Черты корня: верховой бой", () => {
  for (const [prefix, key] of Object.entries(MOUNT)) {
    it(`${prefix}: верховой бой находит Черту пака, замер её видит`, () => {
      const d = load(prefix);
      expect(key in mountTraits({ items: [asItem(d)] })).toBe(true);
      const row = cov.items.find(i => i.name === d.name);
      expect(row.ways).toContain("byName");
      expect(["auto", "partial"]).toContain(row.bucket);
      expect(d.system.notes).not.toMatch(/^Не смоделировано/);
    });
  }
});

describe("Утончённый Бой", () => {
  it("даёт переброс атаки (галочка в окне) и Избегания (кнопка на карточке защиты)", () => {
    const rules = rulesFromItemMechanics([asItem(load("Sophisticated_Combat"))]);
    const fx = rules.flatMap(r => r.effects ?? []).filter(e => e.kind === "rollMode");
    expect(fx.map(e => e.target).sort()).toEqual(["attack", "evasion"]);
    expect(fx.every(e => e.mode === "keepBest")).toBe(true);
  });
});
