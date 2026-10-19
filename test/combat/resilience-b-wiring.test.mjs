// test/combat/resilience-b-wiring.test.mjs
//
// Таланты Стойкости (глава 3, пакет B): проводка — кнопки листа, пункт «Значимый
// персонаж», хуки смены Хода, данные паков и реестр Возможностей.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sheetOf, resetCaptured } from "../support/foundry-stub.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { TURN_SCOPED_FLAGS } from "../../module/rules/turn-flags.mjs";
import { RESILIENCE_TALENTS } from "../../module/rules/resilience-talents.mjs";

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

  it("пункт есть в меню Персонажа, Демона, Принца Демона и Миньона", () => {
    const src = read("module/sheets/actor-sheet.mjs");
    expect(src.match(/\.\.\.this\._notableEntries\(\)/g)?.length).toBe(4);
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

describe("данные паков и реестр Возможностей", () => {
  const FOLDER = "packs-src/talents/Стойкость";
  const PACK_B = ["headGuard", "hellishResilience", "eyeOfTheGods", "hunkerDown", "ablativeHardening"];

  const docOf = key => {
    const name = fs.readdirSync(path.join(ROOT, FOLDER)).find(n => n.includes(RESILIENCE_TALENTS[key].name.replace(/ /g, "_")));
    return JSON.parse(read(`${FOLDER}/${name}`));
  };

  for (const key of PACK_B) {
    it(`${RESILIENCE_TALENTS[key].name}: запись Конструктора, notes «МЕХАНИЗИРОВАНО», читатель в реестре`, () => {
      const doc = docOf(key);
      const entries = doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
      expect(entries).toHaveLength(1);
      expect(entries[0].kind).toBe("capability");
      expect(entries[0].capabilityKey).toBe(RESILIENCE_TALENTS[key].key);
      expect(entries[0].capabilityMode).toBe("flag");
      expect(entries[0].id).toMatch(/^[A-Za-z0-9]{16}$/);
      expect(doc.system.notes).toMatch(/^МЕХАНИЗИРОВАНО/);
      const cap = CAPABILITIES[RESILIENCE_TALENTS[key].key];
      expect(cap.reader).toBeTruthy();
      expect(cap.label).toMatch(/^Реализовано/);
    });
  }

  it("файлы, названные читателями, существуют", () => {
    for (const key of PACK_B) {
      const reader = CAPABILITIES[RESILIENCE_TALENTS[key].key].reader;
      for (const file of reader.match(/module\/[\w/.-]+\.mjs/g)) {
        expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true);
      }
    }
  });
});
