// test/apps/armour-history.test.mjs
//
// wdbc-sg57: часть записей PA_TABLES (module/constants/power-armour-lore.mjs)
// несёт def.mech — testMod/cohesion/corruption записи Конструктора. setArmourEntry
// обязан положить их в СВОЮ группу flags.warhammer-dbc.mechanics (не затирая
// группы, которые GM мог добавить вручную), clearArmourHistory — снять обе.

import "../support/foundry-stub.mjs";
import { stubDocument } from "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { setArmourEntry, clearArmourHistory } from "../../module/apps/armour-history.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { PA_TABLES } from "../../module/constants/power-armour-lore.mjs";

function armorItem(over = {}) {
  return stubDocument({
    id: "armor1", name: "Тестовая Броня", type: "armor", isOwner: true,
    system: { armorType: "power", history: {} }, flags: {}, ...over
  });
}

describe("setArmourEntry: числовая часть особенности (wdbc-sg57)", () => {
  it("кладёт testMod-записи «Пусть враг знает» в группу armour-history", async () => {
    const item = armorItem();
    await setArmourEntry(item, "history", "Пусть враг знает");
    const rules = rulesFromItemMechanics([item]);
    const targets = rules.map(r => r.effects[0].target).sort();
    expect(targets).toEqual(["skill:command", "skill:stealth"]);
    const stealthRule = rules.find(r => r.effects[0].target === "skill:stealth");
    expect(stealthRule.effects[0].value).toBe(-20);
    const commandRule = rules.find(r => r.effects[0].target === "skill:command");
    expect(commandRule.effects[0].value).toBe(10);
  });

  it("char-scope testMod резолвится по правильной характеристике (не по дефолту ag)", async () => {
    const item = armorItem();
    await setArmourEntry(item, "history", "Твоя сила станет легендой");
    const rules = rulesFromItemMechanics([item]);
    expect(rules).toHaveLength(1);
    expect(rules[0].effects[0]).toMatchObject({ kind: "rollBonus", target: "char:s", value: 10 });
  });

  it("запись без def.mech (Наслаждение смертью) не создаёт группу вовсе", async () => {
    const item = armorItem();
    await setArmourEntry(item, "history", "Наслаждение смертью");
    const groups = item.flags["warhammer-dbc"]?.mechanics ?? [];
    expect(groups.find(g => g.id === "armour-history")).toBeUndefined();
  });

  it("не трогает группу Механики, добавленную GM вручную через Конструктор", async () => {
    const item = armorItem({
      flags: { "warhammer-dbc": { mechanics: [{ id: "gm-manual", operator: "AND", entries: [
        { id: "x", kind: "testMod", modScope: "skill", skillKey: "athletics", modValueMode: "flat", value: 5, label: "Ручная правка GM" }
      ] }] } }
    });
    await setArmourEntry(item, "history", "Твоя сила станет легендой");
    const groups = item.flags["warhammer-dbc"].mechanics;
    expect(groups.find(g => g.id === "gm-manual")).toBeDefined();
    expect(groups.find(g => g.id === "armour-history")).toBeDefined();
    expect(groups).toHaveLength(2);
  });

  it("повторный выбор заменяет старую группу armour-history, не дублирует", async () => {
    const item = armorItem();
    await setArmourEntry(item, "history", "Твоя сила станет легендой");
    await setArmourEntry(item, "history", "Пусть враг знает");
    const groups = item.flags["warhammer-dbc"].mechanics.filter(g => g.id === "armour-history");
    expect(groups).toHaveLength(1);
    const rules = rulesFromItemMechanics([item]);
    expect(rules.map(r => r.effects[0].target).sort()).toEqual(["skill:command", "skill:stealth"]);
  });

  it("вторая особенность («two») кладётся в отдельную группу armour-history-second", async () => {
    const item = armorItem();
    await setArmourEntry(item, "history", "Твоя сила станет легендой");
    await setArmourEntry(item, "scars", "Потрёпанный войной", { second: true });
    const rules = rulesFromItemMechanics([item]);
    const targets = rules.map(r => r.effects[0].target).sort();
    expect(targets).toEqual(["char:s", "skill:charm", "skill:intimidate"]);
  });

  it("clearArmourHistory снимает обе группы", async () => {
    const item = armorItem();
    await setArmourEntry(item, "history", "Твоя сила станет легендой");
    await setArmourEntry(item, "scars", "Потрёпанный войной", { second: true });
    await clearArmourHistory(item);
    const rules = rulesFromItemMechanics([item]);
    expect(rules).toEqual([]);
  });

  it("cohesion-запись («Кровь брата») попадает в Механику как kind:cohesion", async () => {
    const item = armorItem();
    await setArmourEntry(item, "scars", "Кровь брата");
    const entry = item.flags["warhammer-dbc"].mechanics
      .find(g => g.id === "armour-history").entries[0];
    expect(entry).toMatchObject({ kind: "cohesion", cohesionRole: "any", cohesionValue: "10", op: "add" });
  });

  it("corruption-запись («Порча Варпа») попадает в Механику как kind:corruption", async () => {
    const item = armorItem();
    await setArmourEntry(item, "legend", "Порча Варпа");
    const entry = item.flags["warhammer-dbc"].mechanics
      .find(g => g.id === "armour-history").entries[0];
    expect(entry).toMatchObject({ kind: "corruption", corruptionValue: "10", op: "add" });
  });
});

describe("PA_TABLES.mech: все char-scope testMod используют rerollChar, не charKey", () => {
  it("та же ловушка, что чинилась в packs-src (wdbc-sg57) — здесь не повторена", () => {
    for (const table of Object.values(PA_TABLES)) {
      for (const entry of table.entries) {
        for (const m of entry.mech ?? []) {
          if (m.kind === "testMod" && m.modScope === "char") {
            expect(m.rerollChar, `${entry.name}: rerollChar должен быть задан`).toBeTruthy();
          }
        }
      }
    }
  });
});
