// test/sheets/character-v2.test.mjs
//
// Лист персонажа на ApplicationV2 (wdbc-ff4.10.10) и два производных от него:
// Демон и Демон-Принц. Их пришлось перевести тем же коммитом — они наследуются
// от WarhammerCharacterSheet, и после смены базы V2 не позвал бы у них ни
// getData, ни activateListeners.
//
// Договор класса с шаблоном — в describeV2Sheet. Разметка персонажа разложена
// по частям (шапка, полоса Бесчестия и вкладка на файл), поэтому договор
// принимает список. У производных листов сверяется только их СВОЯ разметка:
// части листа персонажа они подключают, но действия к ним объявлены у предка,
// а ApplicationV2 склеивает DEFAULT_OPTIONS по цепочке наследования сам.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { sheetOf, captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";

const { WarhammerCharacterSheet } = await import("../../module/sheets/actor-sheet.mjs");
const { WarhammerDaemonSheet }    = await import("../../module/sheets/daemon-sheet.mjs");
const { WarhammerDemonPrinceSheet } = await import("../../module/sheets/demon-prince-sheet.mjs");

const PART = n => `templates/actor/parts/${n}.hbs`;

describeV2Sheet(WarhammerCharacterSheet, {
  sheet: "module/sheets/actor-sheet.mjs",
  template: ["templates/actor/character-sheet.hbs",
    ...["header", "infamy-strip", "tab-stats", "tab-combat", "tab-abilities", "tab-psy",
        "tab-tech", "tab-nav", "tab-gear", "tab-advance", "tab-notes", "tab-effects",
        "tab-possession", "tab-haemonculus"].map(PART)]
});

describeV2Sheet(WarhammerDaemonSheet, {
  sheet: "module/sheets/daemon-sheet.mjs",
  template: "templates/actor/daemon-sheet.hbs"
});

describeV2Sheet(WarhammerDemonPrinceSheet, {
  sheet: "module/sheets/demon-prince-sheet.mjs",
  template: "templates/actor/demon-prince-sheet.hbs"
});

describe("слоты Расы и Субрасы", () => {
  it("слоты расы объявлены действиями листа", () => {
    const actions = Object.keys(WarhammerCharacterSheet.DEFAULT_OPTIONS.actions);

    expect(actions).toEqual(expect.arrayContaining([
      "racePick", "raceOpen", "raceClear", "raceApply",
      "subracePick", "subraceOpen", "subraceClear"
    ]));
  });

  // Ревью предыдущей задачи (wdbc-n1k): applySubrace отклоняет субрасу с чужим
  // родителем, но эта ветка не была проверена ни одним тестом. Дроп субрасы на
  // лист — новый путь в неё, поэтому проверка ставится рядом с приёмом дропа.
  it("субраса друкхари, роняемая на азурианина, отклоняется без изменений листа", async () => {
    resetCaptured();
    const sheet = sheetOf(WarhammerCharacterSheet, {
      characteristics: {}, skills: {}, groupSkills: {}, race: "azuriane"
    });
    const updates = [];
    sheet.actor.update = async data => { updates.push(data); };
    globalThis.Item.implementation = {
      fromDropData: async () => ({ type: "subrace", system: { key: "truebornDrukhari" } })
    };

    await WarhammerCharacterSheet.prototype._onDropItem.call(sheet, {}, {});

    expect(updates).toEqual([]);
    expect(captured.warnings.some(w => /Истиннорожд.+Друкхари.+Азуриане/.test(w))).toBe(true);
  });
});

describe("производные листы не наследуют чужой шаблон", () => {
  // PARTS, в отличие от DEFAULT_OPTIONS, по цепочке классов не склеивается:
  // каждый лист объявляет свой. Ключ у всех один и тот же — если Foundry
  // когда-нибудь начнёт их склеивать, свой шаблон всё равно перекроет чужой.
  it("у каждого листа своя разметка под общим ключом", () => {
    const tpl = cls => cls.PARTS.body.template;

    expect(tpl(WarhammerCharacterSheet)).toContain("character-sheet.hbs");
    expect(tpl(WarhammerDaemonSheet)).toContain("daemon-sheet.hbs");
    expect(tpl(WarhammerDemonPrinceSheet)).toContain("demon-prince-sheet.hbs");
  });

  it("вкладки производных — свои, короче персонажьих", () => {
    const ids = cls => cls.TABS.primary.tabs.map(t => t.id);

    expect(ids(WarhammerCharacterSheet)).toContain("effects");
    expect(ids(WarhammerDaemonSheet)).toContain("daemonlore");
    expect(ids(WarhammerDaemonSheet)).not.toContain("effects");
    expect(ids(WarhammerDemonPrinceSheet)).toContain("apotheosis");
  });
});

describe("_prepareContext", () => {
  const ctxOf = (cls, system = {}) => {
    const sheet = sheetOf(cls, { characteristics: {}, skills: {}, groupSkills: {}, ...system });
    sheet.actor.items.contents = sheet.actor.items;
    return cls.prototype._prepareContext.call(sheet, {});
  };

  it("лист персонажа собирает контекст целиком и открывается на ПОКАЗАТЕЛЯХ", async () => {
    const ctx = await ctxOf(WarhammerCharacterSheet);

    expect(ctx.tab).toBe("stats");
    expect(ctx.skillsCol1.length).toBeGreaterThan(0);   // из buildGetData
    expect(ctx.chars.length).toBeGreaterThan(0);        // из characterContext
  });

  // У демонов Inf — не Общение, а Бесчестие: подпись меняется поверх общего
  // контекста, значит производный лист свой _prepareContext всё-таки зовёт.
  it("у демона характеристика Inf подписана Бесчестием", async () => {
    const ctx = await ctxOf(WarhammerDaemonSheet, { allegiance: "khorne" });

    expect(ctx.chars.find(c => c.key === "inf").label).toBe("Бесчестие");
    expect(ctx.daemon.canPsyker).toBe(false);           // Кхорн ненавидит колдовство
    expect(ctx.showPatronPicker).toBe(false);
  });
});
