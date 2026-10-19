// ════════════════════════════════════════════════════════════════════════
//  Мастерская: Крафт и Исследования (Warhammer DBC).
//  • Несколько параллельных проектов (сворачиваемые панели, «+ добавить»).
//  • Крафтер — из персонажей с галочкой «Доступен для крафта»; навыки теста
//    выбираются вручную из его реальных Ремесла/Знаний.
//  • Комбинированный тест: ОДИН Предел (ведущий навык + бонусы рангов остальных)
//    и одна проверка; редкость+качество→сложность и Банк (из таблицы категорий).
//  • Ассистенты дают доп. Успехи; смена авто-начисляет Усталость крафтеру.
//
//  Это окно — партийный инструмент, НЕ привязанный к одному актору: крафтер и
//  ассистенты выбираются из ЛЮБОГО актора мира, открывается из сцен-контролов
//  (Doom BC → Мастерская), работает без открытого листа персонажа вовсе.
//  Ровно поэтому вкладка «КРАФТ» на листе персонажа (wdbc-42a6,
//  module/sheets/tabs/craft.mjs) НЕ заменяет это окно, а переиспользует его
//  методы (Object.create(CraftWorkshop.prototype)) на своей отдельной модели —
//  своя вкладка на каждом листе, тот же движок. См. заголовок craft.mjs.
// ════════════════════════════════════════════════════════════════════════

import { CRAFT_CATEGORIES, CRAFT_QUALITY, CRAFT_TOOLS, RARITY_LABELS, RARITY_ORDER,
         RESEARCH_KINDS, CRAFT_MATERIALS, bankFromTable,
         buildAvailableSkills, findSkillOption, suggestOption,
         computeCombined, bankFor, degreesOfSuccess, reqSkillLabel } from "../constants/craft.mjs";
import { craftIcon } from "../constants/craft-icons.mjs";
import { VAT_QUALITY, BIO_TARGET_QUALITY, BIO_TEST_SKILLS, BIO_OUTCOMES,
         VAT_ENTRY_REQ, TEMPLATE_RESEARCH, vatPlan, failQuality,
         templateSuccesses } from "../constants/bio-lab.mjs";
import { bioImplantCatalog } from "../constants/drukhari-bio.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { addFatigue } from "../sheets/tabs/conditions.mjs";
import { diceModeFor } from "../rules/test-kind.mjs";
import { pickReroll } from "../rules/reroll-pick.mjs";
import { critLineHtml } from "../rules/test-kind-widget.mjs";
import { criticalOutcome } from "../rules/roll-outcome.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { hasSlowShiftTalent, cyberpreacherApplies, effectiveDiceMode, slowShiftBonus, polymathBonus, researchBonus, darkMuseAssistBonus, haemonculusLabBonus } from "../rules/craft-advantage.mjs";
import { researchFindingItemData, researchJournalEntry, appendResearchJournal,
         researchKindLabel, RESEARCH_JOURNAL_FLAG, PSYCHIC_RESULT_TYPES } from "../rules/research-findings.mjs";
import { TRAINING_SOCIAL_OPTIONS, TRAINING_SESSIONS_PER_COURSE, buildTeachableTargets, findTeachableTarget,
         buildStudentTestOptions, findStudentTestOption, instructorOption, socialSkillOption } from "../constants/training.mjs";
import { trainingTargetKey, addTrainingEarmark, logCourse, coursesThisMonth,
         studentCapFromBonus, studentMonthlyCap, teacherCombinedLimit, studentBonusFromTeacherCombo,
         trainingXpGain, grantEliteDiscount, TRAINING_EARMARK_FLAG, TRAINING_COURSE_LOG_FLAG,
         TRAINING_ELITE_DISCOUNT_FLAG } from "../rules/training.mjs";
import { hasTeacherTalent, clearMindTeachBonus } from "../rules/training-advantage.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** Персонаж, которым владеет игрок (не ГМ) — такой всегда доступен для крафта,
 *  вне зависимости от чекбокса «Доступен для крафта» (тот остаётся ручным
 *  переключателем для НПС). */
function _hasPlayerOwner(actor) {
  return game.users.some(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
}

function _crafterChoices() {
  // game.actors может быть ещё не готов (ранний вызов контекста листа в
  // тестовой заглушке/до "ready") — тот же приём защиты, что и у остальных
  // мест листа, читающих список акторов мира (actor-sheet.mjs: [...(game.actors ?? [])]).
  return [...(game.actors ?? [])]
    .filter(a => a.type === "character" && (a.system?.craftAvailable || _hasPlayerOwner(a))
                 && (game.user.isGM || a.isOwner))
    .map(a => ({ id: a.id, name: a.name }))
    .sort((x, y) => x.name.localeCompare(y.name, "ru"));
}

/**
 * Новый проект (Крафт/Исследование/Биолаборатория). `preferredCrafterId` —
 * вкладка листа персонажа (wdbc-42a6, module/sheets/tabs/craft.mjs) передаёт
 * сюда владельца листа, чтобы новый проект сразу предлагал ЕГО крафтером,
 * если он вообще доступен для крафта; отдельное окно «Мастерская» вызывает
 * без аргумента — там нет «своего» актора, первый по алфавиту, как раньше.
 */
export function newCraftProject(preferredCrafterId) {
  const choices = _crafterChoices();
  const crafterId = (preferredCrafterId && choices.some(c => c.id === preferredCrafterId))
    ? preferredCrafterId
    : (choices[0]?.id || "");
  return {
    id: foundry.utils.randomID(8),
    title: "", collapsed: false,
    mode: "craft",
    crafterId,
    categoryKey: CRAFT_CATEGORIES[3].key,
    rarity: 1, quality: "common", toolKey: "common",
    gmMod: 0, assistants: 0, baseBank: null, improve: false, monotony: false, machineSize: 0,
    // Кубик смены (Преимущество/Помеха, стр. 26) — Сложность у Крафта уже
    // есть своя («Модификатор ГМа»), второй дропдаун не заводим.
    diceMode: "normal",
    // Медленная Смена (Талант, wdbc-u0by) — «+4ч смены → +30 и Преимущество»,
    // выбор игрока за смену; галочка видна только владельцу Таланта
    // (module/rules/craft-advantage.mjs).
    slowShift: false,
    // Именованный ассистент (wdbc-1rno) — ОДИН актор для проверки Талантов/
    // Даров, зависящих от личности ассистента (Journeyman/Подмастерье,
    // Dark Muse/Тёмная Муза, module/rules/craft-advantage.mjs). Отдельно от
    // assistants (просто счётчик для +10/успех за штуку) — не заменяет его,
    // а дополняет: этот ассистент физически один из assistants, но именно
    // ЕГО инвентарь Талантов/Даров теперь реально проверяется, а не берётся
    // на слово стола.
    assistantId: "",
    researchKind: "blueprint",
    // Итог Исследования (module/rules/research-findings.mjs): какой предмет
    // создать, когда вид находки — «Психосила/ритуал/вязь» (книга называет
    // все три подряд); studyTarget — для какого Навыка «Изучение» (Logic,
    // «вместо создания знаний») служит обоснованием; findingCreated — чтобы
    // предмет/запись в Журнале не создавались повторно при смене после ГОТОВО.
    psychicResultType: PSYCHIC_RESULT_TYPES[0].key,
    studyTarget: "",
    findingCreated: false,
    // Обучение (книга, стр. 22): учитель — то же поле crafterId (общий
    // дропдаун «Крафтер/Учитель»); students — ученики курса, каждый со
    // своим выбором теста (I или Logic); trainingTarget — чему учим (из
    // того, что учитель реально знает, module/constants/training.mjs);
    // socialKey — опциональный combined-тест учителя (Charm/Logic/
    // Intimidate, книжный бонус +5×Успехи ученикам); sessionCount — сеансы
    // ТЕКУЩЕГО курса (8 = можно завершать, module/rules/training.mjs).
    trainingTarget: "",
    socialKey: "",
    students: [],
    sessionCount: 0,
    courseLog: [],
    // Биолаборатория: чан, цель, выбранный имплант и счётчик циклов.
    vatKey: "common", bioTarget: "common", bioSkill: "medicae",
    bioImplant: "", bioAdvanced: false, bioLarge: false, bioHaem: false,
    bioCycle: 0, bioLog: [],
    skillChoices: {},
    project: { accumulated: 0, shifts: 0, fatigue: 0 }
  };
}

export class CraftWorkshop extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "wh-craft-workshop",
    classes: ["warhammer-dbc", "wh-holo", "wh-craft"],
    window: { title: "Мастерская — Крафт и Исследования", resizable: true },
    position: { width: 860, height: 800 }
  };

  static PARTS = {
    body: {
      template: "systems/warhammer-dbc/templates/apps/craft-workshop.hbs",
      root: true, scrollable: [".wh-craft-scroll"]
    }
  };

  constructor(...args) {
    super(...args);
    this.projects = [newCraftProject()];
  }

  _proj(pid) { return this.projects.find(p => p.id === pid) || null; }
  _crafter(proj) { return game.actors?.get(proj.crafterId) || null; }
  _reqs(proj, category) {
    if (proj.mode === "research") {
      // Изучение (книга: Logic «вместо создания знаний») — своя подсказка,
      // остальные виды находки — как раньше, любая Запретная Lore.
      if (proj.researchKind === "lore") return [{ skill: "logic" }];
      return [{ group: "forbiddenLore" }];
    }
    return category?.req || [];
  }

  _resolve(proj) {
    const isResearch = proj.mode === "research";
    const isStudy = isResearch && proj.researchKind === "lore";
    const crafter = this._crafter(proj);
    const category = CRAFT_CATEGORIES.find(c => c.key === proj.categoryKey);
    const available = buildAvailableSkills(crafter, isResearch, isStudy);
    const reqs = this._reqs(proj, category);

    const slots = reqs.map((req, i) => {
      const value = proj.skillChoices[i] ?? suggestOption(available, req);
      return { idx: i, suggestion: reqSkillLabel(req), value,
        options: available.map(o => ({ value: o.value, label: o.label, selected: o.value === value })) };
    });
    const selectedOpts = slots.map(s => findSkillOption(available, s.value));

    const toolMod = (CRAFT_TOOLS.find(t => t.key === proj.toolKey)?.mod) ?? 0;
    // Редкость и Качество НЕ модифицируют бросок (только Банк). К Пределу — инструменты,
    // ГМ-мод и −20 за Улучшение.
    const mods = { toolMod, gmMod: Number(proj.gmMod || 0), improveMod: proj.improve ? -20 : 0 };
    const combined = computeCombined(selectedOpts, mods);

    const tableBank = isResearch ? null : bankFromTable(category, proj.rarity);
    const notCraftable = !isResearch && tableBank === null && proj.baseBank == null;
    const baseBank = proj.baseBank ?? (isResearch ? 20 : (tableBank ?? 10));
    const isMachine = !!category?.machine && !isResearch;
    // Машины: итоговый Банк ×(Размер+1) — раньше подсказка просила учесть это
    // руками (wdbc-5il7), теперь размер вводится тут же и множится сразу.
    const machineSize = isMachine ? Math.max(0, Number(proj.machineSize) || 0) : 0;
    const bank = bankFor(baseBank, proj.quality, proj.improve) * (isMachine ? machineSize + 1 : 1);

    return { category, available, slots, combined, mods, bank, baseBank, tableBank, notCraftable,
      machineNote: isMachine, machineSize, crafter, isResearch, isStudy };
  }


  /** Каталог биоимплантов для выпадашки: имя, редкость и группа —
   * из компендиума warhammer-dbc.implants, см. drukhari-bio.mjs. */
  _bioCatalog() {
    return bioImplantCatalog();
  }

  /** Расчёт партии в чане: ресурсы, время, модификатор, запреты. */
  _bioVM(proj) {
    const catalog = this._bioCatalog();
    const sel = catalog.find(c => c.key === proj.bioImplant) || null;
    const rarity     = sel ? sel.rarity : Number(proj.rarity) || 0;
    const advanced   = sel ? sel.advanced   : !!proj.bioAdvanced;
    const large      = sel ? sel.large      : !!proj.bioLarge;
    const haemonculi = sel ? sel.haemonculi : !!proj.bioHaem;

    const plan = vatPlan({ vatKey: proj.vatKey, target: proj.bioTarget,
                           rarity, advanced, large, haemonculi, gmMod: proj.gmMod });

    // Каталог в выпадашку — сгруппированный.
    const groups = [];
    for (const c of catalog) {
      let g = groups.find(x => x.label === c.group);
      if (!g) groups.push(g = { label: c.group, items: [] });
      g.items.push({ key: c.key, label: `${c.label} (R ${c.rarity})`, selected: c.key === proj.bioImplant });
    }

    return {
      catalogGroups: groups,
      selName: sel ? sel.label : "",
      rarity, advanced, large, haemonculi,
      vats: VAT_QUALITY.map(v => ({ ...v, selected: v.key === proj.vatKey })),
      vatNote: plan.vat.note,
      targets: BIO_TARGET_QUALITY.map(q => ({ ...q, selected: q.key === proj.bioTarget })),
      skills: BIO_TEST_SKILLS.map(k => ({ ...k, selected: k.key === proj.bioSkill })),
      biomass: plan.biomass, solution: plan.solution, freeSolution: plan.freeSolution,
      needTemplate: plan.needTemplate, cycles: plan.cycles, hours: plan.hours,
      mod: plan.mod, modSign: plan.mod >= 0 ? "+" : "",
      rerolls: plan.rerolls, blocks: plan.blocks, blocked: plan.blocks.length > 0,
      cycle: proj.bioCycle || 0,
      cyclePct: plan.cycles ? Math.min(100, Math.round((proj.bioCycle || 0) / plan.cycles * 100)) : 0,
      ripe: (proj.bioCycle || 0) >= plan.cycles,
      log: (proj.bioLog || []).slice(-6).reverse(),
      outcomes: BIO_OUTCOMES,
      entryReq: VAT_ENTRY_REQ,
      tplNote: TEMPLATE_RESEARCH.note, tplSources: TEMPLATE_RESEARCH.sources,
      tplGood: plan.needTemplate ? templateSuccesses("good", rarity, 1) : null,
      tplBest: plan.needTemplate ? templateSuccesses("best", rarity, 1) : null
    };
  }

  /** Ученики курса с разрешёнными акторами (студент может быть удалён из мира — actor:null). */
  _students(proj) {
    return (proj.students || []).map(s => ({ ...s, actor: game.actors?.get(s.id) || null }));
  }

  /**
   * Разрешение курса Обучения — учитель (crafterId), что он может преподавать
   * (buildTeachableTargets — только то, что он реально знает и не выше своего
   * ранга, книга), Trade(Instructor)(I)+10 (+ опциональный combined
   * Charm/Logic/Intimidate), потолок учеников по I.b (10×I.b — Teacher/Учитель).
   */
  _resolveTraining(proj) {
    const teacher = this._crafter(proj);
    const targets = buildTeachableTargets(teacher);
    const target = findTeachableTarget(targets, proj.trainingTarget) || targets[0] || null;
    const instructor = instructorOption(teacher);
    const social = proj.socialKey ? socialSkillOption(teacher, proj.socialKey) : null;
    const teacherLimit = teacherCombinedLimit(instructor, social);
    const teacherTalent = hasTeacherTalent(teacher);
    const intBonus = teacher?.system?.characteristics?.int?.bonus ?? 0;
    const studentCap = studentCapFromBonus(intBonus, teacherTalent);
    return { teacher, targets, target, instructor, social, teacherLimit, teacherTalent, intBonus, studentCap,
      students: this._students(proj) };
  }

  /** Витрина курса Обучения для шаблона (templates/apps/craft-workshop.hbs и tab-craft.hbs). */
  _trainingVM(proj) {
    const T = this._resolveTraining(proj);
    const now = game.time?.worldTime ?? 0;

    const studentRows = T.students.map((s, idx) => {
      const opts = buildStudentTestOptions(s.actor);
      const testKey = s.testKey || opts[0].value;
      const opt = findStudentTestOption(opts, testKey) || opts[0];
      const log = s.actor?.getFlag?.("warhammer-dbc", TRAINING_COURSE_LOG_FLAG);
      const isNpc = s.actor && !(s.actor.type === "character" && _hasPlayerOwner(s.actor)) && s.actor.type !== "minion";
      const cap = studentMonthlyCap(s.actor?.system?.characteristics?.int?.bonus ?? 0,
        { npcUnderTeacherTalent: isNpc && T.teacherTalent, teacherIntBonus: T.intBonus });
      const used = coursesThisMonth(log, "course", now);
      return { idx, id: s.id, name: s.actor?.name || "(удалён)",
        testOptions: opts.map(o => ({ ...o, selected: o.value === testKey })), testKey, total: opt?.total ?? 0,
        monthlyCap: cap, monthlyUsed: used, overMonthlyCap: used >= cap };
    });

    const chosen = new Set(studentRows.map(r => r.id));
    return {
      targets: T.targets.map(t => ({ ...t, selected: !!T.target && t.value === T.target.value })),
      noTargets: T.targets.length === 0, targetLabel: T.target?.label || "",
      socialOptions: [{ key: "", label: "— без комбинирования —" }, ...TRAINING_SOCIAL_OPTIONS]
        .map(o => ({ ...o, selected: o.key === (proj.socialKey || "") })),
      instructorFound: T.instructor.found, instructorTotal: T.instructor.total,
      teacherLimit: T.teacherLimit, teacherTalent: T.teacherTalent,
      studentCap: T.studentCap, studentCount: studentRows.length, overCap: studentRows.length > T.studentCap,
      studentRows,
      studentChoices: _crafterChoices().filter(a => a.id !== proj.crafterId && !chosen.has(a.id)),
      sessionCount: proj.sessionCount || 0, sessionsNeeded: TRAINING_SESSIONS_PER_COURSE,
      sessionPct: Math.min(100, Math.round((proj.sessionCount || 0) / TRAINING_SESSIONS_PER_COURSE * 100)),
      canFinish: (proj.sessionCount || 0) >= TRAINING_SESSIONS_PER_COURSE && studentRows.length > 0 && !!T.teacher,
      courseLog: (proj.courseLog || []).slice(-5).reverse()
    };
  }

  _projectVM(proj) {
    const R = this._resolve(proj);
    const crafterName = R.crafter?.name || "";
    const catLabel = proj.mode === "research" ? "Исследование"
      : proj.mode === "bio" ? (proj.bioImplant || "Ферментный Чан")
      : proj.mode === "training" ? ""
      : (R.category?.label || "");
    const accum = proj.project.accumulated;
    const pct = proj.mode === "training" ? 0 : Math.max(0, Math.min(100, Math.round((accum / R.bank) * 100)));
    const training = proj.mode === "training" ? this._trainingVM(proj) : null;

    const testRows = R.slots.map((s, i) => {
      const row = R.combined.rows[i] || {};
      return { idx: i, options: s.options, suggestion: s.suggestion,
        total: row.total, rankBonus: row.rankBonus, synergy: row.synergy, isPrimary: row.isPrimary, contrib: row.contrib };
    });

    const limit = R.combined.limit;
    const modeLabel = { research: "Исследование", bio: "Биолаборатория", training: "Обучение" }[proj.mode] || "Крафт";
    return {
      id: proj.id, collapsed: proj.collapsed,
      title: proj.title, autoTitle: `${modeLabel}${crafterName ? " · " + crafterName : ""}${catLabel ? " · " + catLabel : ""}`,
      summary: proj.mode === "bio" ? `цикл ${proj.bioCycle || 0}`
        : proj.mode === "training" ? `сеанс ${proj.sessionCount || 0}/${TRAINING_SESSIONS_PER_COURSE}`
        : `${accum}/${R.bank}`,
      isCraft: proj.mode === "craft", isResearch: proj.mode === "research",
      isBio: proj.mode === "bio", bio: proj.mode === "bio" ? this._bioVM(proj) : null,
      isTraining: proj.mode === "training", training,

      crafters: _crafterChoices(), crafterId: proj.crafterId, hasCrafter: !!R.crafter,
      noCrafters: _crafterChoices().length === 0,

      categories: CRAFT_CATEGORIES.map(c => ({ key: c.key, label: c.label, icon: craftIcon(c.icon), selected: c.key === proj.categoryKey })),
      categoryAlt: R.category?.alt || "",
      researchKinds: RESEARCH_KINDS.map(k => ({ ...k, selected: k.key === proj.researchKind })),
      // Итог Исследования (wdbc-research-journal): «Психосила/ритуал/вязь» —
      // уточнить, какой из трёх предметов создать; «Изучение» — для какого
      // Навыка (книга: Logic «вместо создания знаний»), текстом, а не предмет.
      isStudy: R.isStudy,
      showPsychicResultType: proj.mode === "research" && proj.researchKind === "psychic",
      psychicResultTypes: PSYCHIC_RESULT_TYPES.map(t => ({ ...t, selected: t.key === proj.psychicResultType })),
      studyTarget: proj.studyTarget || "",

      rarity: proj.rarity,
      rarityOptions: RARITY_ORDER.map(v => ({ v, l: RARITY_LABELS[String(v)], selected: v === proj.rarity })),
      qualityOptions: Object.entries(CRAFT_QUALITY).map(([k, q]) => ({ k, label: q.label, mult: q.bankMult, selected: k === proj.quality })),
      tools: CRAFT_TOOLS.map(t => ({ ...t, selected: t.key === proj.toolKey })),

      gmMod: proj.gmMod, assistants: proj.assistants, improve: proj.improve, monotony: proj.monotony,
      diceMode: proj.diceMode || "normal",
      // Медленная Смена/Киберпроповедник (wdbc-u0by) — галочка видна только
      // владельцу Таланта; Киберпроповедник ничего не спрашивает — применяется
      // сам, как только категория «Бионика» и Талант у крафтера есть.
      hasSlowShiftTalent: hasSlowShiftTalent(R.crafter),
      slowShift: proj.slowShift,
      cyberpreacherActive: cyberpreacherApplies(R.crafter, proj.categoryKey),
      hasAssistants: (Number(proj.assistants) || 0) > 0,
      // Именованный ассистент (wdbc-1rno) — та же выборка акторов, что и у
      // крафтера, минус сам крафтер (не ассистирует себе).
      assistantChoices: _crafterChoices().filter(a => a.id !== proj.crafterId),
      assistantId: proj.assistantId || "",
      baseBankVal: R.baseBank, machineNote: R.machineNote, machineSize: R.machineSize, notCraftable: R.notCraftable,

      testRows, limit,
      limitCls: limit >= 50 ? "good" : limit >= 20 ? "mid" : "bad",
      toolModVal: R.mods.toolMod, gmModVal: R.mods.gmMod, improveMod: R.mods.improveMod,

      bank: R.bank, accumulated: accum, shifts: proj.project.shifts, fatigue: proj.project.fatigue,
      pct, done: accum >= R.bank
    };
  }

  async _prepareContext(options) {
    return {
      isGM: game.user.isGM,
      projects: this.projects.map(p => this._projectVM(p)),
      multiple: this.projects.length > 1,
      materials: CRAFT_MATERIALS,
      icoCraft: craftIcon("craft"), icoResearch: craftIcon("research"),
      icoCrafter: craftIcon("crafter"), icoTools: craftIcon("tools"),
      icoShift: craftIcon("shift"), icoQuality: craftIcon("quality"), icoMaterial: craftIcon("material"),
      icoBio: craftIcon("bio"), icoBiomass: craftIcon("biomass"),
      icoSolution: craftIcon("solution"), icoTemplate: craftIcon("template"),
      icoTeach: craftIcon("teach")
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
    const pidOf = (t) => t.closest("[data-pid]")?.dataset.pid;
    const on = (sel, evt, fn) => el.querySelectorAll(sel).forEach(n => n.addEventListener(evt, fn));
    const upd = (t, mut) => { const p = this._proj(pidOf(t)); if (!p) return; mut(p); this.render(false); };

    // Проекты: добавить / свернуть / удалить.
    el.querySelector("[data-act=add-project]")?.addEventListener("click", () => { this.projects.push(newCraftProject()); this.render(false); });
    on("[data-act=toggle]", "click", e => upd(e.currentTarget, p => p.collapsed = !p.collapsed));
    on("[data-act=remove]", "click", e => { const pid = pidOf(e.currentTarget); if (this.projects.length > 1) { this.projects = this.projects.filter(p => p.id !== pid); this.render(false); } });
    on("[name=ptitle]", "change", e => upd(e.currentTarget, p => p.title = e.target.value));

    on("[data-mode]", "click", e => upd(e.currentTarget, p => { p.mode = e.currentTarget.dataset.mode; p.skillChoices = {}; p.baseBank = null; }));
    on("[name=crafter]", "change", e => upd(e.currentTarget, p => { p.crafterId = e.target.value; p.skillChoices = {}; }));
    on("[data-cat]", "click", e => upd(e.currentTarget, p => { p.categoryKey = e.currentTarget.dataset.cat; p.skillChoices = {}; p.baseBank = null; }));
    on("[data-slot]", "change", e => upd(e.currentTarget, p => p.skillChoices[Number(e.currentTarget.dataset.slot)] = e.target.value));

    on("[name=research-kind]", "change", e => upd(e.currentTarget, p => { p.researchKind = e.target.value; p.skillChoices = {}; }));
    on("[name=psychic-result-type]", "change", e => upd(e.currentTarget, p => p.psychicResultType = e.target.value));
    on("[name=study-target]", "change", e => upd(e.currentTarget, p => p.studyTarget = e.target.value));
    on("[name=rarity]", "change", e => upd(e.currentTarget, p => { p.rarity = num(e.target.value); p.baseBank = null; }));
    on("[name=quality]", "change", e => upd(e.currentTarget, p => p.quality = e.target.value));
    on("[name=tool]", "change", e => upd(e.currentTarget, p => p.toolKey = e.target.value));
    on("[name=basebank]", "change", e => upd(e.currentTarget, p => p.baseBank = num(e.target.value, 1)));
    on("[name=machinesize]", "change", e => upd(e.currentTarget, p => p.machineSize = Math.max(0, num(e.target.value))));
    on("[name=gmmod]", "change", e => upd(e.currentTarget, p => p.gmMod = num(e.target.value)));
    on("[name=assistants]", "change", e => upd(e.currentTarget, p => p.assistants = Math.max(0, num(e.target.value))));
    on("[name=improve]", "change", e => upd(e.currentTarget, p => p.improve = e.target.checked));
    on("[name=monotony]", "change", e => upd(e.currentTarget, p => p.monotony = e.target.checked));
    on("[name=dicemode]", "change", e => upd(e.currentTarget, p => p.diceMode = e.target.value));
    on("[name=slowshift]", "change", e => upd(e.currentTarget, p => p.slowShift = e.target.checked));
    on("[name=assistant-actor]", "change", e => upd(e.currentTarget, p => p.assistantId = e.target.value));

    // Биолаборатория
    on("[name=vat]", "change", e => upd(e.currentTarget, p => p.vatKey = e.target.value));
    on("[name=bio-target]", "change", e => upd(e.currentTarget, p => p.bioTarget = e.target.value));
    on("[name=bio-skill]", "change", e => upd(e.currentTarget, p => p.bioSkill = e.target.value));
    on("[name=bio-implant]", "change", e => upd(e.currentTarget, p => { p.bioImplant = e.target.value; p.bioCycle = 0; p.bioLog = []; }));
    on("[data-act=bio-cycle]", "click", e => this._rollCycle(pidOf(e.currentTarget)));
    on("[data-act=bio-reset]", "click", e => upd(e.currentTarget, p => { p.bioCycle = 0; p.bioLog = []; }));

    on("[data-act=shift]", "click", e => this._rollShift(pidOf(e.currentTarget)));
    on("[data-act=reset]", "click", e => upd(e.currentTarget, p => p.project = { accumulated: 0, shifts: 0, fatigue: 0 }));

    // Обучение (книга, стр. 22).
    on("[name=training-target]", "change", e => upd(e.currentTarget, p => p.trainingTarget = e.target.value));
    on("[name=social-key]", "change", e => upd(e.currentTarget, p => p.socialKey = e.target.value));
    on("[name=student-add]", "change", e => upd(e.currentTarget, p => {
      if (e.target.value) p.students = [...(p.students || []), { id: e.target.value, testKey: "char:int" }];
    }));
    on("[data-act=remove-student]", "click", e => upd(e.currentTarget, p => {
      const idx = Number(e.currentTarget.dataset.sidx);
      p.students = (p.students || []).filter((_, i) => i !== idx);
    }));
    on("[data-sidx] [name=student-test]", "change", e => upd(e.currentTarget, p => {
      const idx = Number(e.currentTarget.closest("[data-sidx]")?.dataset.sidx);
      if (p.students?.[idx]) p.students[idx].testKey = e.target.value;
    }));
    on("[data-act=session]", "click", e => this._rollTrainingSession(pidOf(e.currentTarget)));
    on("[data-act=finish-course]", "click", e => this._finishTrainingCourse(pidOf(e.currentTarget)));
  }


  /**
   * Один цикл роста: 24 часа в чане и тест в конце. Успех продвигает партию,
   * провал портит качество, критический провал уничтожает её целиком.
   */
  async _rollCycle(pid) {
    const proj = this._proj(pid);
    if (!proj) return;
    const crafter = this._crafter(proj);
    if (!crafter) { ui.notifications?.warn("Сначала выберите крафтера."); return; }

    const vm = this._bioVM(proj);
    if (vm.blocked) { ui.notifications?.warn(vm.blocks[0]); return; }
    if (!proj.bioImplant) { ui.notifications?.warn("Выберите, что выращиваем."); return; }

    // Тест идёт через I: и Medicae, и обе химические связки книга вешает на Интеллект.
    const skillDef = BIO_TEST_SKILLS.find(k => k.key === proj.bioSkill) || BIO_TEST_SKILLS[0];
    const base = crafter.system?.skills?.[skillDef.skills[0]]?.total
              ?? crafter.system?.characteristics?.int?.total ?? 25;
    const limit = Math.max(1, base + vm.mod);

    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total;
    const dos = degreesOfSuccess(rv, limit);

    let outcome, resultQuality = proj.bioTarget, advance = 0;
    if (dos >= 5)       { outcome = BIO_OUTCOMES[0]; advance = 1;
                          if (proj.bioTarget === "poor") resultQuality = "common"; }
    else if (dos >= 1)  { outcome = BIO_OUTCOMES[1]; advance = 1; }
    else if (dos > -5)  { outcome = BIO_OUTCOMES[2]; advance = 1;
                          resultQuality = failQuality(proj.bioTarget); }
    else                { outcome = BIO_OUTCOMES[3]; advance = 0; resultQuality = "—"; }

    proj.bioCycle = outcome.key === "critFail" ? 0 : (proj.bioCycle || 0) + advance;
    proj.bioLog = (proj.bioLog || []).concat([{
      cycle: proj.bioCycle, roll: rv, limit, dos,
      outcome: outcome.label, quality: resultQuality
    }]);

    const qLbl = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" }[resultQuality] || resultQuality;
    const cls = outcome.key.startsWith("crit") ? (dos >= 5 ? "good" : "bad") : (dos >= 1 ? "good" : "mid");
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: crafter }),
      content: `<div class="wh-craft-msg wh-bio-msg">
        <div class="wh-craft-msg-head">${craftIcon("bio")}Цикл роста — ${esc(crafter.name)}</div>
        <div class="wh-bio-msg-what">${proj.bioImplant} · цель ${vm.targets.find(t => t.selected)?.label || ""}</div>
        <div class="wh-craft-msg-roll">1d100 = <b>${rv}</b> против <b>${limit}</b>
          (${skillDef.label} ${vm.modSign}${vm.mod})</div>
        <div class="wh-bio-msg-out ${cls}"><b>${outcome.label}</b> · ${Math.abs(dos)} ст. — итог: <b>${qLbl}</b></div>
        <div class="wh-bio-msg-text">${outcome.text}</div>
        <div class="wh-bio-msg-cycle">Цикл ${proj.bioCycle} из ${vm.cycles}${proj.bioCycle >= vm.cycles ? " — СБОР УРОЖАЯ" : ""}</div>
      </div>`
    });
    this.render(false);
  }

  async _rollShift(pid) {
    const proj = this._proj(pid);
    if (!proj) return;
    const crafter = this._crafter(proj);
    if (!crafter) { ui.notifications?.warn("Сначала выберите крафтера."); return; }
    const R = this._resolve(proj);
    if (R.combined.limit == null) { ui.notifications?.warn("Выберите навык(и) для теста."); return; }

    const mono = proj.monotony ? -30 : 0;
    // Именованный ассистент (wdbc-1rno) — ОДИН актор из assistants, чей
    // инвентарь Талантов/Даров теперь реально проверяется (Journeyman/
    // Подмастерье, Dark Muse/Тёмная Муза), а не берётся на слово стола.
    const assistantActor = proj.assistantId ? game.actors?.get(proj.assistantId) ?? null : null;
    // Каждый ассистент даёт +1 Успех И +10 к проверке крафта — КРОМЕ
    // именованного ассистента с Тёмной Музой: тот даёт +30 (Мастерская —
    // всегда тест Крафта/Исследования, книжное «в тесте крафта») ВМЕСТО
    // обычных +10 за себя, остальные ассистенты (если есть) — как обычно.
    const assist = Math.max(0, Number(proj.assistants || 0));
    const darkMuseBonus = assist > 0 ? darkMuseAssistBonus(assistantActor) : 0;
    const assistBonus = darkMuseBonus > 0 ? Math.max(0, assist - 1) * 10 + darkMuseBonus : assist * 10;
    // Медленная Смена (Талант, wdbc-u0by): +30 при выбранной галочке — тот
    // же принцип, что monotony/assist, «+4ч» на честном слове стола.
    const slowBonus = slowShiftBonus(crafter, proj.slowShift);
    // Polymath / Полимат (wdbc-1rno): +10 безусловно на Крафт И Исследования.
    const polyBonus = polymathBonus(crafter);
    // Лаборатория Гемункула (wdbc-6nl9): +60 безусловно на Крафт И Исследования.
    const labBonus = haemonculusLabBonus(crafter);
    // Инновация (Стремление): +10 только на Исследования.
    const innovationBonus = researchBonus(crafter, proj.mode);
    const limit = R.combined.limit + mono + assistBonus + slowBonus + polyBonus + labBonus + innovationBonus;

    // Комбинированный тест — ОДНА проверка против наименьшего/итогового Предела
    // (свой книжный расчёт, не общий combinedThreshold — см. computeCombined).
    // Кубик смены (Преимущество/Помеха) — тот же приём, что и везде, но с
    // учётом Киберпроповедника/Медленной Смены/Подмастерья (wdbc-u0by/
    // wdbc-1rno, craft-advantage.mjs) — Подмастерье теперь проверяется по
    // настоящему инвентарю именованного ассистента, не по галочке.
    const effMode = effectiveDiceMode(proj.diceMode, crafter, proj.categoryKey, proj.slowShift, assistantActor);
    const diceMode = diceModeFor(effMode);
    const rollCount = diceMode ? diceMode.rolls : 1;
    const rolls = [];
    for (let i = 0; i < rollCount; i++) rolls.push(await new Roll("1d100").evaluate());
    const picked = pickReroll(rolls.map(r => r.total), diceMode?.mode);
    const roll = rolls[picked.index];
    const rv = picked.value, dos = degreesOfSuccess(rv, limit);
    const diceNote = diceMode
      ? `<div class="wh-craft-roll-line">${effMode === "advantage" ? "Преимущество" : "Помеха"}${effMode !== proj.diceMode ? " (Талант)" : ""}: отброшено ${picked.dropped.join(", ")}</div>`
      : "";
    const critLine = critLineHtml(criticalOutcome(rv, resolveTest({ actor: crafter, kind: "skill" }).crit));

    const gain = Math.max(0, dos) + assist;
    const wasDone = proj.project.accumulated >= R.bank;
    proj.project.shifts += 1;
    proj.project.fatigue += 1;
    proj.project.accumulated += gain;
    const done = proj.project.accumulated >= R.bank;

    // Через addFatigue (wdbc-x1nz.2.95): смена работы у порога T.b+W.b роняет
    // мастера без сознания, Саркофаг держит иммунитет — прямой записью ни
    // того, ни другого не было.
    try {
      await addFatigue(crafter, 1);
    } catch (e) { console.warn("warhammer-dbc | craft fatigue", e); }

    // Итог Исследования (module/rules/research-findings.mjs) — ровно один
    // раз, когда Банк заполнился ИМЕННО этой сменой (wasDone предохраняет от
    // повторной выдачи предмета, если игрок продолжает крутить смены после
    // ГОТОВО — findingCreated сам по себе уже защищает, wasDone — на случай
    // восстановления проекта с чужим findingCreated=false после ручной
    // правки Банка).
    let findingNote = "";
    if (proj.mode === "research" && done && !wasDone && !proj.findingCreated) {
      findingNote = await this._finishResearch(proj, crafter, R);
      proj.findingCreated = true;
    }

    const skillList = R.combined.rows.map(r => `${r.label}: ${r.isPrimary ? `<b>${r.total}</b> ведущий` : `+${r.rankBonus} ранг`}${r.synergy ? ` +${r.synergy} синергия` : ""}`).join("; ");
    const rollMode = game.settings.get("core", "rollMode");
    const msg = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: crafter }),
      content: `
        <div class="wh-craft-msg">
          <div class="wh-craft-msg-head">${rollIcon("wrench","#6fe6ff")}${proj.mode === "research" ? "Смена исследования" : "Смена крафта"} — ${esc(crafter.name)}</div>
          <div class="wh-craft-roll-line">${skillList}</div>
          <div class="wh-craft-roll-line ${dos > 0 ? "ok" : "fail"}">Комбинированный тест: <b>${rv}</b> vs Предел ${limit} → ${dos > 0 ? `+${dos} успеха` : `${dos} (провал)`}</div>
          ${diceNote}
          ${critLine}
          ${assist ? `<div class="wh-craft-roll-line ok">Ассистенты (${assist}): +${assistBonus} к тесту, +${assist} успеха${darkMuseBonus ? ` (вкл. Тёмную Музу +${darkMuseBonus})` : ""}</div>` : ""}
          ${polyBonus ? `<div class="wh-craft-roll-line ok">Полимат: +${polyBonus} к тесту</div>` : ""}
          ${labBonus ? `<div class="wh-craft-roll-line ok">Лаборатория Гемункула: +${labBonus} к тесту</div>` : ""}
          ${innovationBonus ? `<div class="wh-craft-roll-line ok">Инновация: +${innovationBonus} к тесту</div>` : ""}
          ${findingNote ? `<div class="wh-craft-roll-line ok">${findingNote}</div>` : ""}
          <div class="wh-craft-msg-sum ${gain > 0 ? "ok" : "fail"}">Итог смены: <b>+${gain}</b> · Прогресс: <b>${proj.project.accumulated}</b>/${R.bank}${done ? " · <b style='color:#8cf0a0'>ГОТОВО!</b>" : ""}</div>
          <div class="wh-craft-msg-foot">Смена №${proj.project.shifts} · Усталость +1 (крафтеру)${mono ? " · монотонность −30" : ""}</div>
        </div>`,
      rolls: [roll], sound: CONFIG.sounds.dice
    }, rollMode);
    await ChatMessage.create(msg);
    this.render(false);
  }

  /**
   * Итог завершённого проекта-Исследования (module/rules/research-findings.mjs):
   * создаёт предмет-знание на крафтере (кроме вида «Изучение» — книга
   * прямо противопоставляет его созданию знания) и всегда дописывает запись
   * в Журнал Исследований (флаг крафтера) — его читает вкладка КРАФТ листа
   * персонажа (module/sheets/tabs/craft.mjs::craftTabContext), а не это
   * окно: «Мастерская» — партийный инструмент без одного актора-владельца.
   * Возвращает короткую строку для карточки смены.
   */
  async _finishResearch(proj, crafter, R) {
    const kind = proj.researchKind;
    const title = proj.title || R.category?.label || "";
    const skillLabel = R.combined.primary?.label || "";

    const itemData = researchFindingItemData({ kind, resultType: proj.psychicResultType, title });
    let itemId = null, itemName = null;
    if (itemData) {
      try {
        const [doc] = await crafter.createEmbeddedDocuments("Item", [itemData]);
        itemId = doc?.id ?? null;
        itemName = doc?.name ?? itemData.name;
      } catch (e) { console.warn("warhammer-dbc | research finding item", e); }
    }

    const entry = researchJournalEntry({ kind, title, skillLabel, studyTarget: proj.studyTarget, itemId, itemName });
    try {
      const log = crafter.getFlag?.("warhammer-dbc", RESEARCH_JOURNAL_FLAG) ?? [];
      await crafter.setFlag("warhammer-dbc", RESEARCH_JOURNAL_FLAG, appendResearchJournal(log, entry));
    } catch (e) { console.warn("warhammer-dbc | research journal", e); }

    return itemName
      ? `Находка — <b>${esc(itemName)}</b> (${esc(researchKindLabel(kind))}) добавлена крафтеру, запись в Журнале Исследований.`
      : `Обоснование Навыка записано в Журнал Исследований${entry.studyTarget ? `: <b>${esc(entry.studyTarget)}</b>` : ""}.`;
  }

  /**
   * Один сеанс обучения (книга, стр. 22): «считается как смена Крафта и для
   * учителя, и для учеников, в т.ч. для Усталости» — Усталость +1 обоим,
   * КРОМЕ учителя с Teacher/Учитель (книга: освобождён). Тест не кидается —
   * только по завершении всего курса (8 сеансов), см. _finishTrainingCourse.
   */
  async _rollTrainingSession(pid) {
    const proj = this._proj(pid);
    if (!proj) return;
    const T = this._resolveTraining(proj);
    if (!T.teacher) { ui.notifications?.warn("Сначала выберите учителя."); return; }
    if (!T.students.length) { ui.notifications?.warn("Добавьте хотя бы одного ученика."); return; }
    if ((proj.sessionCount || 0) >= TRAINING_SESSIONS_PER_COURSE) {
      ui.notifications?.warn("Курс уже отходил все сеансы — завершите его."); return;
    }

    proj.sessionCount = (proj.sessionCount || 0) + 1;
    if (!T.teacherTalent) {
      try { await addFatigue(T.teacher, 1); } catch (e) { console.warn("warhammer-dbc | training fatigue (teacher)", e); }
    }
    for (const s of T.students) {
      if (!s.actor) continue;
      try { await addFatigue(s.actor, 1); } catch (e) { console.warn("warhammer-dbc | training fatigue (student)", e); }
    }
    this.render(false);
  }

  /**
   * Итог курса (8 сеансов): ОДИН combined-тест учителя Trade(Instructor)(I)+10
   * (+ Charm/Logic/Intimidate при выборе), у каждого ученика СВОЙ тест I/Logic.
   * xp = 5×(Успехи учителя + Успехи ученика), Провалы не вычитаются (книга).
   * xp уходит ТОЛЬКО в целевой запас (training.mjs — TRAINING_EARMARK_FLAG),
   * не в system.experience.total: тратится он автоматически и только на
   * покупку именно этой цели (module/sheets/tabs/advance.mjs), излишки сверх
   * цены при покупке теряются — иначе это была бы свободная валюта, а книга
   * прямо ограничивает «только на то, чему учили».
   */
  async _finishTrainingCourse(pid) {
    const proj = this._proj(pid);
    if (!proj) return;
    const T = this._resolveTraining(proj);
    if (!T.teacher) { ui.notifications?.warn("Сначала выберите учителя."); return; }
    if (!T.target) { ui.notifications?.warn("Выберите, чему учим — учитель должен знать это сам."); return; }
    if ((proj.sessionCount || 0) < TRAINING_SESSIONS_PER_COURSE) {
      ui.notifications?.warn(`Нужно ${TRAINING_SESSIONS_PER_COURSE} сеансов, сейчас ${proj.sessionCount || 0}.`); return;
    }
    if (!T.students.length) { ui.notifications?.warn("Нет учеников."); return; }
    if (T.students.length > T.studentCap) {
      ui.notifications?.warn(`Слишком много учеников: максимум ${T.studentCap} (I.b${T.teacherTalent ? " ×10 от Учителя" : ""}).`); return;
    }

    const now = game.time?.worldTime ?? 0;
    // Месячный лимит — ПРОВЕРКА до любых бросков/записей: если хоть один
    // ученик уже выбрал лимит, блокируем ВЕСЬ курс (идёт вместе), не только его часть.
    for (const s of T.students) {
      if (!s.actor) continue;
      const log = s.actor.getFlag?.("warhammer-dbc", TRAINING_COURSE_LOG_FLAG);
      const isNpc = !(s.actor.type === "character" && _hasPlayerOwner(s.actor)) && s.actor.type !== "minion";
      const cap = studentMonthlyCap(s.actor.system?.characteristics?.int?.bonus ?? 0,
        { npcUnderTeacherTalent: isNpc && T.teacherTalent, teacherIntBonus: T.intBonus });
      if (coursesThisMonth(log, "course", now) >= cap) {
        ui.notifications?.warn(`${s.actor.name} уже прошёл(а) максимум курсов в этом месяце (${cap}).`);
        return;
      }
    }

    const mono = proj.monotony ? -30 : 0;
    const socialDef = TRAINING_SOCIAL_OPTIONS.find(o => o.key === proj.socialKey);
    // Teacher/Учитель: освобождён от штрафа за монотонную работу — ТОЛЬКО сам,
    // учеников книга не упоминает.
    const teacherRoll = await new Roll("1d100").evaluate();
    const teacherLimit = T.teacherLimit + (T.teacherTalent ? 0 : mono);
    const teacherDos = degreesOfSuccess(teacherRoll.total, teacherLimit);
    const comboBonus = proj.socialKey ? studentBonusFromTeacherCombo(teacherDos) : 0;

    const lines = [`<div class="wh-craft-roll-line ${teacherDos > 0 ? "ok" : "fail"}">Учитель — Trade(Instructor)(I)+10${socialDef ? ` + ${esc(socialDef.label)}` : ""}: <b>${teacherRoll.total}</b> vs ${teacherLimit} → ${teacherDos > 0 ? `+${teacherDos} успеха` : `${teacherDos} (провал)`}${T.teacherTalent ? " (Учитель: Успехи ×2 в формуле xp)" : ""}</div>`];
    if (comboBonus) lines.push(`<div class="wh-craft-roll-line ok">Комбинированный тест успешен — книжное +5×Успехи даёт ученикам +${comboBonus} к Пределу</div>`);

    const rolls = [teacherRoll];
    const results = [];
    for (const s of T.students) {
      if (!s.actor) continue;
      const opts = buildStudentTestOptions(s.actor);
      const opt = findStudentTestOption(opts, s.testKey) || opts[0];
      const clearMindBonus = clearMindTeachBonus(T.teacher, s.actor);
      const limit = opt.total + comboBonus + clearMindBonus + mono;
      const roll = await new Roll("1d100").evaluate();
      rolls.push(roll);
      const dos = degreesOfSuccess(roll.total, limit);
      const xp = trainingXpGain(teacherDos, dos, { doubleTeacher: T.teacherTalent });

      // Цель «Элитный архетип» (Клэйвекс) — не xp-запас: при успехе курса
      // ученик получает скидку вдвое на архетип, а не накопление xp (ticket
      // wdbc-5yafq). Остальные цели (Навык/Таланту/Характеристика) — как раньше.
      const isArchetype = T.target.kind === "archetype";
      try {
        if (isArchetype) {
          if (xp > 0) {
            const discountLog = s.actor.getFlag?.("warhammer-dbc", TRAINING_ELITE_DISCOUNT_FLAG) ?? [];
            await s.actor.setFlag("warhammer-dbc", TRAINING_ELITE_DISCOUNT_FLAG, grantEliteDiscount(discountLog, T.target.key));
          }
        } else {
          const targetKey = trainingTargetKey(T.target);
          const earmarkLog = s.actor.getFlag?.("warhammer-dbc", TRAINING_EARMARK_FLAG) ?? [];
          await s.actor.setFlag("warhammer-dbc", TRAINING_EARMARK_FLAG, addTrainingEarmark(earmarkLog, targetKey, T.target.label, xp));
        }
        const courseLog = s.actor.getFlag?.("warhammer-dbc", TRAINING_COURSE_LOG_FLAG);
        await s.actor.setFlag("warhammer-dbc", TRAINING_COURSE_LOG_FLAG, logCourse(courseLog, "course", now));
      } catch (e) { console.warn("warhammer-dbc | training earmark/course log", e); }

      results.push({ name: s.actor.name, xp, discount: isArchetype && xp > 0 });
      const outcome = isArchetype
        ? (xp > 0 ? `скидка вдвое на «${esc(T.target.label)}»` : "скидка не получена")
        : `<b>+${xp} xp</b> на «${esc(T.target.label)}»`;
      lines.push(`<div class="wh-craft-roll-line ${dos > 0 ? "ok" : "fail"}">${esc(s.actor.name)} — ${esc(opt.label)}: <b>${roll.total}</b> vs ${limit} → ${dos > 0 ? `+${dos} успеха` : `${dos} (провал)`}${clearMindBonus ? ` (Чистый Разум +${clearMindBonus})` : ""} — ${outcome}</div>`);
    }

    proj.courseLog = [...(proj.courseLog || []), { target: T.target.label, teacherDos, students: results }].slice(-10);
    proj.sessionCount = 0;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: T.teacher }),
      content: `<div class="wh-craft-msg">
        <div class="wh-craft-msg-head">${craftIcon("teach")}Курс обучения завершён — ${esc(T.teacher.name)}, «${esc(T.target.label)}»</div>
        ${lines.join("")}
      </div>`,
      rolls, sound: CONFIG.sounds.dice
    });
    this.render(false);
  }
}

// ── Синглтон-открытие ───────────────────────────────────────────────────────
let _instance = null;
export function openCraftWorkshop() {
  if (!_instance) _instance = new CraftWorkshop();
  _instance.render(true);
  return _instance;
}
