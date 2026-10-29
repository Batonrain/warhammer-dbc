// test/combat/resilience-b-wiring.test.mjs
//
// Таланты Стойкости (глава 3, пакет B): проводка — кнопки листа, пункт «Значимый
// персонаж», хуки смены Хода. Ключи Возможностей на Талантах пака —
// test/rules/talent-capability-stale-copy.test.mjs (таблица RESILIENCE_TALENTS).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sheetOf, resetCaptured } from "../support/foundry-stub.mjs";
import { TURN_SCOPED_FLAGS } from "../../module/rules/turn-flags.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = p => fs.readFileSync(path.join(ROOT, p), "utf8");

const { WarhammerCharacterSheet } = await import("../../module/sheets/actor-sheet.mjs");

beforeEach(resetCaptured);
afterEach(() => { delete globalThis.game.user.isGM; });

describe("«Значимый персонаж» в «Настройках листа» (Взор Богов)", () => {
  it("ГМ видит пункт, игрок — нет", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { type: "character" });
    globalThis.game.user.isGM = false;
    expect(sheet._notableEntries()).toEqual([]);
    globalThis.game.user.isGM = true;
    const [entry] = sheet._notableEntries();
    expect(entry.label).toContain("Значимый персонаж");
    expect(entry.checkbox).toBe(true);
    expect(entry.checked).toBe(false);
  });

  it("клик ставит флаг notableCharacter, повторный — снимает", async () => {
    globalThis.game.user.isGM = true;
    const sheet = sheetOf(WarhammerCharacterSheet, { type: "character" });
    const set = [], unset = [];
    sheet.actor.setFlag = async (s, k, v) => { set.push([s, k, v]); };
    sheet.actor.unsetFlag = async (s, k) => { unset.push([s, k]); };
    await sheet._notableEntries()[0].onClick();
    expect(set).toEqual([["warhammer-dbc", "notableCharacter", true]]);
    sheet.actor.flags = { "warhammer-dbc": { notableCharacter: true } };
    const [on] = sheet._notableEntries();
    expect(on.checked).toBe(true);
    await on.onClick();
    expect(unset).toEqual([["warhammer-dbc", "notableCharacter"]]);
  });
});

describe("кнопки листа и хуки", () => {
  it("вкладка БОЙ: кнопка «Залегание» только носителю, обработчик навешен", () => {
    expect(read("templates/actor/parts/tab-combat.hbs")).toMatch(/\{\{#if hasHunkerDown\}\}[\s\S]*hunker-down-btn/);
    expect(read("module/sheets/tabs/combat.mjs")).toContain('".hunker-down-btn"');
    expect(read("module/sheets/character-context.mjs")).toContain("context.hasHunkerDown");
  });

  it("вкладка СНАРЯЖЕНИЕ: «Обслужить (1 ч)» только носителю, обработчик навешен", () => {
    expect(read("templates/actor/parts/tab-gear.hbs")).toMatch(/\{\{#if a\.canHarden\}\}[\s\S]*armor-hardening-btn/);
    expect(read("module/sheets/tabs/gear.mjs")).toContain('".armor-hardening-btn"');
    expect(read("module/sheets/sheet-helpers.mjs")).toContain('canHarden: hasResilienceTalent(actor, "ablativeHardening")');
  });

  it("смена Хода: сброс окна Взора Богов и счётчик Адской Живучести; конец боя чистит эффект", () => {
    const hooks = read("module/hooks.mjs");
    expect(hooks).toContain("await hellishResilienceTurnEnd(prevActor);");
    expect(hooks).toContain("await resetEyeOfTheGodsWindow(nextCombatant.actor);");
    expect(hooks).toContain("await clearHellishResilience(combat);");
  });

  it("метка Залегания гасится в начале следующего Хода", () => {
    expect(TURN_SCOPED_FLAGS.hunkerDown).toBeTruthy();
  });
});
