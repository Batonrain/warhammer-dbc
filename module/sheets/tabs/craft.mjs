// module/sheets/tabs/craft.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Вкладка КРАФТ листа персонажа (wdbc-42a6): пользователь попросил перенести
//  «Крафт/Исследования» из отдельного окна («Мастерская», сцен-контролы →
//  Doom BC) в саму вкладку листа. Отдельное окно НЕ убрано — это оказался
//  партийный инструмент без привязки к одному актору (крафтер и ассистенты
//  выбираются из ЛЮБОГО актора мира, окно живёт независимо от того, открыт ли
//  вообще чей-то лист) — см. заголовок module/apps/craft-workshop.mjs. Вкладка
//  здесь — второй, более удобный для «крафчу лично я» случая вход в ТОТ ЖЕ
//  движок, а не переработанная логика.
//
//  Расчёт (Предел, Банк, циклы биолаборатории, бросок смены) — методы
//  CraftWorkshop.prototype, вызванные на облегчённой модели этой вкладки
//  (Object.create(CraftWorkshop.prototype), как уже делают юнит-тесты
//  test/apps/craft-workshop*.test.mjs) — не копия, тот же код. Бонусы вроде
//  wdbc-6nl9 (Лаборатория Гемункула) и wdbc-elng (полиморфные бонусы) читаются
//  оттуда же и подхватываются тут автоматически, без дублирования.
//
//  Состояние (список проектов) живёт НА ЛИСТЕ (sheet._craftModel), как уже
//  устроены прочие «окно, не актор» поля (_panelCollapse, _bodySubtab и т.п.)
//  — не в system актора: то же самое, что было у отдельного окна раньше
//  (проекты и там не сохранялись, жили только в памяти открытого окна), просто
//  теперь живут, пока открыт этот лист, а не пока открыт браузер вообще. Новый
//  проект на вкладке по умолчанию предлагает крафтером владельца ЭТОГО листа
//  (если он вообще доступен для крафта) — единственное отличие от окна, где
//  дефолт — первый по алфавиту.
// ════════════════════════════════════════════════════════════════════════════

import { CraftWorkshop, newCraftProject } from "../../apps/craft-workshop.mjs";
import { RESEARCH_JOURNAL_FLAG } from "../../rules/research-findings.mjs";
import { on } from "../../helpers/utils.mjs";

/** Модель вкладки — та же форма данных, что у CraftWorkshop.projects, но своя
 *  на каждый лист. Ленивая: создаётся при первом обращении и переживает
 *  последующие ре-рендеры того же листа (Foundry создаёт новый экземпляр
 *  класса листа при каждом открытии окна — тогда модель, как и раньше у
 *  отдельного окна между полными релоадами страницы, начинается заново). */
function craftModel(sheet) {
  if (!sheet._craftModel) {
    const model = Object.create(CraftWorkshop.prototype);
    model.projects = [newCraftProject(sheet.actor?.id)];
    model.render = (force) => sheet.render(force);
    sheet._craftModel = model;
  }
  return sheet._craftModel;
}

/** Контекст для tab-craft.hbs. Поля с префиксом craft*, чтобы не столкнуться
 *  с одноимёнными ключами других вкладок листа (projects/materials — слишком
 *  общие названия для общего объекта контекста листа). */
export async function craftTabContext(sheet) {
  const model = craftModel(sheet);
  const ctx = await CraftWorkshop.prototype._prepareContext.call(model, {});
  // Журнал Исследований (module/rules/research-findings.mjs) — ТОЛЬКО здесь,
  // не в отдельном окне «Мастерская»: журнал принадлежит одному актору
  // (владельцу этого листа), а окно — партийный инструмент без одного
  // владельца (см. заголовок module/apps/craft-workshop.mjs). Новое сверху.
  const journal = sheet.actor?.getFlag?.("warhammer-dbc", RESEARCH_JOURNAL_FLAG) ?? [];
  const craftResearchJournal = [...journal].reverse().map(j => ({
    ...j, hasItem: !!j.itemId && !!sheet.actor?.items?.get(j.itemId)
  }));
  return {
    craftProjects: ctx.projects,
    craftMultiple: ctx.multiple,
    craftMaterials: ctx.materials,
    craftResearchJournal,
    icoCraft: ctx.icoCraft, icoResearch: ctx.icoResearch, icoCrafter: ctx.icoCrafter,
    icoTools: ctx.icoTools, icoShift: ctx.icoShift, icoQuality: ctx.icoQuality,
    icoMaterial: ctx.icoMaterial, icoBio: ctx.icoBio, icoBiomass: ctx.icoBiomass,
    icoSolution: ctx.icoSolution, icoTemplate: ctx.icoTemplate, icoTeach: ctx.icoTeach
  };
}

/**
 * Обработчики вкладки — один в один повтор CraftWorkshop._onRender (тот же
 * набор селекторов/действий), но нацелены на кусок DOM самого листа
 * (`[data-tab="craft"]`, а не на всё окно — оно тут одно на весь лист) и
 * дёргают ре-рендер ЛИСТА, а не отдельного окна.
 */
export function activateCraftListeners(root, sheet) {
  // `[data-tab="craft"]` в одиночку находит навигационную ссылку вкладки
  // (`<a data-tab="craft">` в nav.sheet-tabs), она идёт раньше в DOM, чем
  // содержимое (`<div class="tab craft-tab" data-tab="craft">`) — querySelector
  // молча брал пустую ссылку, и ни один обработчик внутри вкладки не вешался
  // (найдено живой проверкой wdbc-42a6). `.tab` сужает до контентного узла.
  const craftRoot = root.querySelector('.tab[data-tab="craft"]');
  if (!craftRoot) return;
  const model = craftModel(sheet);
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const pidOf = (t) => t.closest("[data-pid]")?.dataset.pid;
  const upd = (t, mut) => { const p = model._proj(pidOf(t)); if (!p) return; mut(p); sheet.render(false); };

  on(craftRoot, "[data-act=add-project]", "click", () => {
    model.projects.push(newCraftProject(sheet.actor?.id));
    sheet.render(false);
  });
  on(craftRoot, "[data-act=toggle]", "click", e => upd(e.currentTarget, p => p.collapsed = !p.collapsed));
  on(craftRoot, "[data-act=remove]", "click", e => {
    const pid = pidOf(e.currentTarget);
    if (model.projects.length > 1) { model.projects = model.projects.filter(p => p.id !== pid); sheet.render(false); }
  });
  on(craftRoot, "[name=ptitle]", "change", e => upd(e.currentTarget, p => p.title = e.target.value));

  on(craftRoot, "[data-mode]", "click", e => upd(e.currentTarget, p => { p.mode = e.currentTarget.dataset.mode; p.skillChoices = {}; p.baseBank = null; }));
  on(craftRoot, "[name=crafter]", "change", e => upd(e.currentTarget, p => { p.crafterId = e.target.value; p.skillChoices = {}; }));
  on(craftRoot, "[data-cat]", "click", e => upd(e.currentTarget, p => { p.categoryKey = e.currentTarget.dataset.cat; p.skillChoices = {}; p.baseBank = null; }));
  on(craftRoot, "[data-slot]", "change", e => upd(e.currentTarget, p => p.skillChoices[Number(e.currentTarget.dataset.slot)] = e.target.value));

  on(craftRoot, "[name=research-kind]", "change", e => upd(e.currentTarget, p => { p.researchKind = e.target.value; p.skillChoices = {}; }));
  on(craftRoot, "[name=psychic-result-type]", "change", e => upd(e.currentTarget, p => p.psychicResultType = e.target.value));
  on(craftRoot, "[name=study-target]", "change", e => upd(e.currentTarget, p => p.studyTarget = e.target.value));
  on(craftRoot, "[name=rarity]", "change", e => upd(e.currentTarget, p => { p.rarity = num(e.target.value); p.baseBank = null; }));
  on(craftRoot, "[name=quality]", "change", e => upd(e.currentTarget, p => p.quality = e.target.value));
  on(craftRoot, "[name=tool]", "change", e => upd(e.currentTarget, p => p.toolKey = e.target.value));
  on(craftRoot, "[name=basebank]", "change", e => upd(e.currentTarget, p => p.baseBank = num(e.target.value, 1)));
  on(craftRoot, "[name=machinesize]", "change", e => upd(e.currentTarget, p => p.machineSize = Math.max(0, num(e.target.value))));
  on(craftRoot, "[name=gmmod]", "change", e => upd(e.currentTarget, p => p.gmMod = num(e.target.value)));
  on(craftRoot, "[name=assistants]", "change", e => upd(e.currentTarget, p => p.assistants = Math.max(0, num(e.target.value))));
  on(craftRoot, "[name=improve]", "change", e => upd(e.currentTarget, p => p.improve = e.target.checked));
  on(craftRoot, "[name=monotony]", "change", e => upd(e.currentTarget, p => p.monotony = e.target.checked));
  on(craftRoot, "[name=hookup]", "change", e => upd(e.currentTarget, p => p.hookUp = e.target.checked));
  on(craftRoot, "[name=dicemode]", "change", e => upd(e.currentTarget, p => p.diceMode = e.target.value));
  on(craftRoot, "[name=slowshift]", "change", e => upd(e.currentTarget, p => p.slowShift = e.target.checked));
  on(craftRoot, "[name=assistant-actor]", "change", e => upd(e.currentTarget, p => p.assistantId = e.target.value));
  on(craftRoot, "[name=torrent-weapon]", "change", e => upd(e.currentTarget, p => p.torrentWeaponUuid = e.target.value));

  // Биолаборатория
  on(craftRoot, "[name=vat]", "change", e => upd(e.currentTarget, p => p.vatKey = e.target.value));
  on(craftRoot, "[name=bio-target]", "change", e => upd(e.currentTarget, p => p.bioTarget = e.target.value));
  on(craftRoot, "[name=bio-skill]", "change", e => upd(e.currentTarget, p => p.bioSkill = e.target.value));
  on(craftRoot, "[name=bio-implant]", "change", e => upd(e.currentTarget, p => { p.bioImplant = e.target.value; p.bioCycle = 0; p.bioLog = []; }));
  on(craftRoot, "[data-act=bio-cycle]", "click", e => model._rollCycle(pidOf(e.currentTarget)));
  on(craftRoot, "[data-act=bio-reset]", "click", e => upd(e.currentTarget, p => { p.bioCycle = 0; p.bioLog = []; }));

  on(craftRoot, "[data-act=shift]", "click", e => model._rollShift(pidOf(e.currentTarget)));
  on(craftRoot, "[data-act=reset]", "click", e => upd(e.currentTarget, p => p.project = { accumulated: 0, shifts: 0, fatigue: 0 }));

  // Обучение (книга, стр. 22).
  on(craftRoot, "[name=training-target]", "change", e => upd(e.currentTarget, p => p.trainingTarget = e.target.value));
  on(craftRoot, "[name=social-key]", "change", e => upd(e.currentTarget, p => p.socialKey = e.target.value));
  on(craftRoot, "[name=student-add]", "change", e => upd(e.currentTarget, p => {
    if (e.target.value) p.students = [...(p.students || []), { id: e.target.value, testKey: "char:int" }];
  }));
  on(craftRoot, "[data-act=remove-student]", "click", e => upd(e.currentTarget, p => {
    const idx = Number(e.currentTarget.dataset.sidx);
    p.students = (p.students || []).filter((_, i) => i !== idx);
  }));
  on(craftRoot, "[data-sidx] [name=student-test]", "change", e => upd(e.currentTarget, p => {
    const idx = Number(e.currentTarget.closest("[data-sidx]")?.dataset.sidx);
    if (p.students?.[idx]) p.students[idx].testKey = e.target.value;
  }));
  on(craftRoot, "[data-act=session]", "click", e => model._rollTrainingSession(pidOf(e.currentTarget)));
  on(craftRoot, "[data-act=finish-course]", "click", e => model._finishTrainingCourse(pidOf(e.currentTarget)));

  // Журнал Исследований: открыть предмет-находку на листе.
  on(craftRoot, "[data-act=open-finding]", "click", e => {
    const item = sheet.actor?.items?.get(e.currentTarget.dataset.itemId);
    item?.sheet?.render(true);
  });
}
