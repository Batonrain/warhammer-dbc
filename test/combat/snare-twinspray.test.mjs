// test/combat/snare-twinspray.test.mjs
// Книга: Связывающее — связанная цель повторяет тест (A или S −10×X) за полное
// действие, союзник режет путы; Спаренное + Спрей — отмена −20, а на 3+ Провала
// цель получает 2 попадания.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, char } from "../support/combat-fixtures.mjs";
import { snareEscapeButtonsHtml, resolveSnareButton, bondCutters, isBladeWeapon } from "../../module/combat/snare.mjs";
import { _performSprayCancel } from "../../module/combat/defense.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

function bound() {
  const updates = [];
  const a = actorFor({ conditions: { helpless: true }, characteristics: { ag: char(40), s: char(40) } });
  a.update = async u => { updates.push(u); };
  a.updates = updates;
  a.uuid = "Actor.bound";
  return a;
}

describe("Связывающее: кнопки освобождения", () => {
  it("две кнопки теста (A и S, штраф −10×X) и кнопка «перерезать путы»", () => {
    const html = snareEscapeButtonsHtml("Actor.bound", 2);
    expect(html).toContain('data-char="ag"');
    expect(html).toContain('data-char="s"');
    expect(html).toContain("Ловкость−20");
    expect(html).toContain('data-kind="cut"');
  });

  it("успех теста снимает Беспомощность", async () => {
    const a = bound();
    captured.dice = [5];
    await resolveSnareButton(a, { kind: "escape", char: "ag", rating: 1 });
    expect(a.updates.some(u => u["system.conditions.helpless"] === false)).toBe(true);
    expect(card()).toContain("путы порваны");
  });

  it("провал — остаётся связана", async () => {
    const a = bound();
    captured.dice = [99];
    await resolveSnareButton(a, { kind: "escape", char: "s", rating: 1 });
    expect(a.updates.length).toBe(0);
    expect(card()).toContain("остаётся связана");
  });

  it("союзник режет путы без теста", async () => {
    const a = bound();
    await resolveSnareButton(a, { kind: "cut" });
    expect(a.updates.some(u => u["system.conditions.helpless"] === false)).toBe(true);
    expect(card()).toContain("перерезаны");
  });
});

describe("Связывающее: кто может перерезать путы (решение владельца 13.11.2026)", () => {
  const bound = { id: "b", x: 0, y: 0, width: 1, height: 1, disposition: 1 };
  const at = (id, x, over = {}) => ({ id, name: id, x, y: 0, width: 1, height: 1, disposition: 1, blade: true, ...over });

  it("сосед в базовом контакте с клинком — подходит", () => {
    expect(bondCutters(bound, [at("ally", 100)])).toEqual(["ally"]);
  });
  it("без клинка, далеко или это сам связанный — не подходит", () => {
    expect(bondCutters(bound, [at("noBlade", 100, { blade: false })])).toEqual([]);
    expect(bondCutters(bound, [at("far", 500)])).toEqual([]);
    expect(bondCutters(bound, [at("b", 100)])).toEqual([]);
  });
  it("враждебный по диспозиции не режет", () => {
    expect(bondCutters(bound, [at("foe", 100, { disposition: -1 })])).toEqual([]);
    expect(bondCutters(bound, [at("neutral", 100, { disposition: 0 })])).toEqual(["neutral"]);
  });
  it("клинок — рукопашное оружие с Режущим уроном", () => {
    expect(isBladeWeapon({ system: { weaponClass: "melee", damageType: "rending" } })).toBe(true);
    expect(isBladeWeapon({ system: { weaponClass: "melee", damageType: "impact" } })).toBe(false);
    expect(isBladeWeapon({ system: { weaponClass: "ranged", damageType: "rending" } })).toBe(false);
  });
});

describe("Спаренное + Спрей: отмена попадания", () => {
  function target() { return actorFor({ characteristics: { ag: char(60) } }); }

  it("удвоенный расход — штраф −20 виден в разбивке", async () => {
    captured.dice = [10];
    await _performSprayCancel(target(), { doubled: true });
    expect(card()).toContain("Спаренное: удвоенный расход");
  });

  it("3+ Провала при удвоении — 2 попадания", async () => {
    captured.dice = [99];
    await _performSprayCancel(target(), { doubled: true });
    expect(card()).toContain("2 попадания");
  });

  it("без удвоения — ни штрафа, ни двойного попадания", async () => {
    captured.dice = [99];
    await _performSprayCancel(target(), { doubled: false });
    expect(card()).not.toContain("Спаренное");
  });
});
