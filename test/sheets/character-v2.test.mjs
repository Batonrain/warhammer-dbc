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
import fs from "node:fs";
import path from "node:path";
import "../support/foundry-stub.mjs";
import { sheetOf, captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describeV2Sheet } from "../support/v2-sheet-contract.mjs";

const readTemplate = p => fs.readFileSync(path.resolve(import.meta.dirname, "../..", p), "utf8");

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
      "subracePick", "subraceOpen", "subraceClear", "subraceApply"
    ]));
  });

  // Раунд правок 1 (wdbc-n1k), находка 2: состояние «ключ есть, носителя
  // нет» было тупиком для субрасы — у расы такое же состояние чинится
  // кнопкой «Применить» (raceApply), а у субрасы её не было вовсе.
  it("subraceApply зовёт applySubrace ключом текущей субрасы", async () => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      characteristics: {}, skills: {}, groupSkills: {}, race: "azuriane", subrace: "eldanar"
    });
    sheet.isEditable = true;
    const updates = [];
    sheet.actor.update = async data => { updates.push(data); };

    await WarhammerCharacterSheet.DEFAULT_OPTIONS.actions.subraceApply.call(sheet);

    expect(updates.some(u => u["system.subrace"] === "eldanar")).toBe(true);
  });

  // Раунд правок 1, находка 3: для расы без субрас слот и свободный ввод
  // сосуществовали и дублировали друг друга. Слот субрасы теперь рисуется
  // только внутри {{#if hasSubraces}}, свободный ввод — только в {{else}}.
  it("для расы без субрас слот субрасы не отрисовывается — только свободный ввод", () => {
    const header = readTemplate("templates/actor/parts/header.hbs");
    const start = header.indexOf("{{#if hasSubraces}}");
    expect(start).toBeGreaterThan(-1);

    // Внутри hasSubraces-блока есть свои вложенные {{#if}}/{{else}}/{{/if}}
    // (applied/не applied у самого слота) — наивный «нежадный» regex цепляет
    // ПЕРВЫЙ попавшийся else/endif, то есть вложенный, а не внешний. Ищем
    // границы внешнего блока по глубине вложенности.
    const tokenRe = /{{#if [^}]*}}|{{else}}|{{\/if}}/g;
    tokenRe.lastIndex = start + "{{#if hasSubraces}}".length;
    let depth = 0, elseIdx = -1, endIdx = -1, m;
    while ((m = tokenRe.exec(header))) {
      if (m[0].startsWith("{{#if")) depth++;
      else if (m[0] === "{{else}}") { if (depth === 0 && elseIdx === -1) elseIdx = m.index; }
      else if (m[0] === "{{/if}}") {
        if (depth === 0) { endIdx = m.index; break; }
        depth--;
      }
    }
    expect(elseIdx).toBeGreaterThan(-1);
    expect(endIdx).toBeGreaterThan(elseIdx);

    const thenPart = header.slice(start, elseIdx);
    const elsePart = header.slice(elseIdx, endIdx);

    expect(thenPart).toContain('data-slot="subrace"');
    expect(thenPart).not.toContain('name="system.subrace"');
    expect(elsePart).toContain('name="system.subrace"');
    expect(elsePart).not.toContain('data-slot="subrace"');
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

  // Находка C1 общего ревью (wdbc-n1k): дроп брал ключ отдельно от кэша
  // (`system.key || ""`) и падал в пустую строку, если ГМ не заполнил поле —
  // а пустой ключ на пути применения означает «снять расу»: дроп молча стирал
  // носителя, все расовые Черты, субрасу и Прошлое. Через пикер та же запись
  // работала: кэш индексирует её под id документа. Дроп обязан читать ключ
  // тем же правилом (raceKeyOf), что и кэш.
  it("раса без system.key на дропе берёт ключ по id документа, а не снимает расу", async () => {
    resetCaptured();
    const sheet = sheetOf(WarhammerCharacterSheet, {
      characteristics: { ws: { base: 30 } }, skills: {}, groupSkills: {}, race: "human"
    });
    const updates = [];
    sheet.actor.update = async data => { updates.push(data); };
    globalThis.Item.implementation = {
      fromDropData: async () => ({ type: "race", id: "astartes", name: "Астартес", system: { key: "" } })
    };

    await WarhammerCharacterSheet.prototype._onDropItem.call(sheet, {}, {});

    // clearRace внутри applyRace пишет транзитное "" первым шагом (снимает
    // ПРЕЖНЮЮ расу) — финальное значение перезаписывается следом тем же
    // update-вызовом, который несёт настоящий ключ.
    const raceUpdates = updates.filter(u => "system.race" in u);
    expect(raceUpdates.at(-1)["system.race"]).toBe("astartes");
  });

  it("раса без ключа и без id — явный отказ, лист не меняется", async () => {
    resetCaptured();
    const sheet = sheetOf(WarhammerCharacterSheet, {
      characteristics: {}, skills: {}, groupSkills: {}, race: "human"
    });
    const updates = [];
    sheet.actor.update = async data => { updates.push(data); };
    globalThis.Item.implementation = {
      fromDropData: async () => ({ type: "race", id: "", name: "Повреждённый предмет", system: { key: "" } })
    };

    await WarhammerCharacterSheet.prototype._onDropItem.call(sheet, {}, {});

    expect(updates).toEqual([]);
    expect(captured.errors.length).toBeGreaterThan(0);
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
