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
    // toggle-rows — часть внутри части: вкладка Способностей подключает её под
    // каждой способностью с подспособностями (Локус Герольда). Кнопка вкл./выкл.
    // живёт только там, и без этой строки договор «каждый обработчик кем-то
    // вызывается» считал бы её мёртвой.
    ...["header", "infamy-strip", "tab-stats", "tab-combat", "tab-abilities", "toggle-rows",
        "tab-psy", "tab-tech", "tab-nav", "tab-gear", "tab-advance", "tab-notes", "tab-effects",
        "tab-possession", "tab-haemonculus", "tab-social"].map(PART)]
});

describeV2Sheet(WarhammerDaemonSheet, {
  sheet: "module/sheets/daemon-sheet.mjs",
  // Вкладку СОЦИУМ демон подключает частью — «+» Миньонов живёт там.
  template: ["templates/actor/daemon-sheet.hbs", PART("tab-social")]
});

describeV2Sheet(WarhammerDemonPrinceSheet, {
  sheet: "module/sheets/demon-prince-sheet.mjs",
  template: ["templates/actor/demon-prince-sheet.hbs", PART("tab-social")]
});

describe("окно листа", () => {
  // Foundry по умолчанию титулует окно как «<тип документа>: <имя>», а тип
  // берёт из ключа TYPES.Actor.character. В мире на английском ключ не
  // переводится и в заголовке стоит сам ключ. Имени персонажа достаточно.
  it("в заголовке только имя персонажа", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { characteristics: {}, skills: {}, groupSkills: {} });
    sheet.actor.name = "Астартес";

    expect(sheet.title).toBe("Астартес");
  });

  it("стартовое окно не уже 960 точек", () => {
    expect(WarhammerCharacterSheet.DEFAULT_OPTIONS.position.width).toBeGreaterThanOrEqual(960);
  });
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

  // Свободный ввод субрасы убран (wdbc-4w4): слот стоит всегда, как у расы, а
  // выбор идёт только через пикер и дроп — оба сверяют родительскую расу. Пока
  // ввод существовал, вписать в него можно было что угодно, минуя сверку.
  it("слот субрасы рисуется всегда, свободного ввода больше нет", () => {
    const header = readTemplate("templates/actor/parts/header.hbs");

    expect(header).toContain('data-slot="subrace"');
    expect(header).not.toContain('name="system.subrace"');
    expect(header.indexOf("{{#if hasSubraces}}")).toBe(-1);
  });

  // Раса без субрас (Астартес) и раса, ещё не выбранная, — состояния, в которых
  // пикер откажет. Слот показывает причину заранее вместо кнопки-приглашения.
  it("пустой слот показывает причину, когда выбирать нечего", () => {
    const header = readTemplate("templates/actor/parts/header.hbs");
    const slot = header.slice(header.indexOf('data-slot="subrace"'));

    expect(slot).toContain("{{#if subraceHint}}");
    expect(slot.slice(0, slot.indexOf('data-action="subracePick"'))).toContain("wh-slot-none");
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

  // Жалоба игрока: покупка Элитного архетипа не попадала в блок «Опыт».
  // Причина — дроп предмета прямо на лист (в обход elite-picker.mjs) шёл
  // обычным созданием предмета: paidCost оставался умолчанием 0, множитель за
  // уже взятые архетипы не считался, опыт не списывался. Дроп обязан идти
  // через buyEliteArchetype — тем же путём, что кнопка пикера.
  it("Элитный архетип, брошенный на лист напрямую, покупается через buyEliteArchetype", async () => {
    resetCaptured();
    const sheet = sheetOf(WarhammerCharacterSheet, {
      characteristics: {}, skills: {}, groupSkills: {},
      experience: { total: 500, current: 500 }
    });
    const updates = [];
    sheet.actor.update = async data => { updates.push(data); };
    globalThis.Item.implementation = {
      fromDropData: async () => ({
        type: "eliteArchetype", name: "Испытанный Инквизитор",
        system: { cost: 300, requirements: { primary: [], secondary: [] } },
        toObject() { return foundry.utils.deepClone({ ...this, toObject: undefined }); }
      })
    };

    await WarhammerCharacterSheet.prototype._onDropItem.call(sheet, {}, {});

    // paidCost посчитан (множитель ×1 — первый архетип) и лёг на созданный
    // предмет: голый дроп оставил бы его умолчанием 0.
    expect(captured.created.length).toBe(1);
    expect(captured.created[0].system.paidCost).toBe(300);
    // Списание ушло в журнал опыта актора, а не потерялось.
    const logUpdate = updates.find(u => "system.experience.log" in u);
    expect(logUpdate?.["system.experience.log"]?.at(-1)?.amount).toBe(-300);
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

  // wdbc: Лоялист/Ренегат с per-actor оверрайдом «Покровительство»/«Смешанная»
  // не мог выбрать Бога вовсе — панель жила строго внутри isHeretic, а цена
  // Продвижения при этом молча считалась «Нейтрально» по всем категориям
  // (найдено живым тестированием после восстановления доступа к песочнице).
  it("не-Хаосит с оверрайдом «Покровительство» всё равно видит выбор Бога", async () => {
    const ctx = await ctxOf(WarhammerCharacterSheet, { alignment: "loyalist", pricingModeOverride: "patronage" });

    expect(ctx.isHeretic).toBe(false);
    expect(ctx.showPatronPicker).toBe(true);
    expect(ctx.chaosPatrons?.length).toBeGreaterThan(0);
    expect(ctx.infamy).toBeUndefined();   // Инфейми остаётся строго Хаоситским
  });

  it("не-Хаосит без оверрайда Покровительства/Смешанной — панель Бога скрыта", async () => {
    const ctx = await ctxOf(WarhammerCharacterSheet, { alignment: "loyalist" });

    expect(ctx.showPatronPicker).toBeUndefined();
    expect(ctx.chaosPatrons).toBeUndefined();
  });
});

// wdbc-unpb: Система продвижения — один каскадный пункт меню настроек листа,
// тем же приёмом, что уже даёт _alignmentSubmenu() для Мировоззрения.
describe("_advancePricingSubmenu", () => {
  it("оборачивает мьютекс-пункты в один каскадный пункт с меткой-эмодзи", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { pricingModeOverride: "" });

    const submenu = sheet._advancePricingSubmenu();

    expect(submenu.cls).toBe("wh-ctx-pricing");
    expect(submenu.label).toBe("📈 Система продвижения");
    expect(Array.isArray(submenu.submenu)).toBe(true);
    expect(submenu.submenu.length).toBeGreaterThan(1);
  });

  it("пункты подменю — короткие метки без повторного 'Система продвижения:' (было дублирование при плоском списке)", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { pricingModeOverride: "" });

    const entries = sheet._advancePricingEntries();

    for (const e of entries) expect(e.label).not.toMatch(/^Система продвижения:/);
  });

  it("текущий выбор актора отмечен галочкой в подменю, остальные — нет", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { pricingModeOverride: "patronage" });

    const entries = sheet._advancePricingSubmenu().submenu;

    const checkedCount = entries.filter(e => e.checked).length;
    expect(checkedCount).toBe(1);
    expect(entries.find(e => e.cls === "wh-ctx-pricing-patronage").checked).toBe(true);
  });
});
