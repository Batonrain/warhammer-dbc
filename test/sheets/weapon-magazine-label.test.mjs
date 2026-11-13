// test/sheets/weapon-magazine-label.test.mjs
//
// Колонка магазина в таблицах оружия листа (вкладки БОЙ и СНАРЯЖЕНИЕ) писала
// «0 / 0» у оружия без магазина: интегральных атак существ, гранат, ракет,
// бомб. Теперь у такого оружия «—», у оружия с «∞» в особенностях «∞»
// (как в окне атаки), у обычного — «текущий / максимум». Документы — настоящие
// JSON из packs-src.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";
import { sheetOf } from "../support/foundry-stub.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";
import { buildGetData } from "../../module/sheets/sheet-helpers.mjs";

const IMPERIAL = "packs-src/weapons/Имперское/Стрелковое";
const DOCS = {
  frag:      packDocById(`${IMPERIAL}/Гранаты`, "vmWiEiuIfIRfNkWW"),
  disposable: packDocById(`${IMPERIAL}/Ракетные_установки`, "Kg1I7qD7hci0tYL5"),
  launcher:  packDocById(`${IMPERIAL}/Ракетные_установки`, "XvejIKa4CEmTgxqh"),
  blaster:   packDocById(`${IMPERIAL}/Плазменное`, "jVw3g35AkTtVKnsk"),
  aeldariGrenade: packDocById("packs-src/weapons/Азуриане/Стрелковое/Гранаты_и_бомбы", "u0CX6mFuQ2XyJVz0"),
  doomfire:  packDocById("packs-src/weapons/Друкхари/Атаки_существ/Житель_Бездны", "t5qXh2CZoAr7rBER")
};

const itemOf = doc => ({
  id: doc._id, name: doc.name, type: "weapon",
  system: { ...structuredClone(doc.system), equipped: true },
  getFlag: () => undefined
});

const ctxOf = docs => {
  const sheet = sheetOf(WarhammerCharacterSheet, {
    items: docs.map(itemOf), characteristics: {}, skills: {}, groupSkills: {}
  });
  sheet.actor.items.contents = sheet.actor.items;
  return buildGetData(sheet.actor);
};

const SRC = name => fs.readFileSync(
  path.resolve(import.meta.dirname, `../../templates/actor/parts/${name}`), "utf8");

describe("контекст БОЯ: подпись магазина", () => {
  const ctx = ctxOf(Object.values(DOCS));
  const row = doc => [...ctx.combatMeleeWeapons, ...ctx.combatRangedWeapons].find(w => w.id === doc._id);

  it("без магазина (интегральная атака, аэльдарская граната 0/0) — «—»", () => {
    expect(row(DOCS.doomfire).magLabel).toBe("—");
    expect(row(DOCS.aeldariGrenade).magLabel).toBe("—");
  });

  it("расходуемое с магазином 1/1 (имперская граната, Одноразовая Ракетница) — «—»", () => {
    expect(row(DOCS.frag).magLabel).toBe("—");
    expect(row(DOCS.disposable).magLabel).toBe("—");
  });

  it("∞ в особенностях — «∞»", () => {
    expect(row(DOCS.blaster).magLabel).toBe("∞");
  });

  it("обычное оружие с магазином — подписи нет, счёт остаётся", () => {
    const launcher = row(DOCS.launcher);
    expect(launcher.magLabel).toBe("");
    expect(launcher.magazineMax).toBeGreaterThan(0);
  });
});

describe("контекст СНАРЯЖЕНИЯ: подпись магазина", () => {
  const ctx = ctxOf(Object.values(DOCS));
  const row = doc => ctx.gearWeapons.find(w => w.id === doc._id);

  it("тот же набор: «—», «—», «∞», пусто", () => {
    expect(row(DOCS.doomfire).magLabel).toBe("—");
    expect(row(DOCS.frag).magLabel).toBe("—");
    expect(row(DOCS.blaster).magLabel).toBe("∞");
    expect(row(DOCS.launcher).magLabel).toBe("");
  });
});

describe("шаблоны читают подпись", () => {
  it("вкладка БОЙ: подпись вместо «текущий / максимум»", () => {
    const src = SRC("tab-combat.hbs");
    const block = src.slice(src.indexOf('<div class="rwc-mag-block'));
    const head = block.slice(0, block.indexOf("</div>"));
    expect(head).toContain("{{w.magLabel}}");
    expect(head).toContain("{{w.magazineCur}}");
  });

  it("вкладка СНАРЯЖЕНИЕ: подпись вместо «текущий/максимум»", () => {
    expect(SRC("tab-gear.hbs")).toMatch(/\{\{#if w\.magLabel\}\}\{\{w\.magLabel\}\}\{\{else\}\}\{\{w\.magazineCur\}\}\/\{\{w\.magazineMax\}\}\{\{\/if\}\}/);
  });
});
