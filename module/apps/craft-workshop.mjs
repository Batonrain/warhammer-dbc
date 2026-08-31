// ════════════════════════════════════════════════════════════════════════
//  Мастерская: Крафт и Исследования (Warhammer DBC).
//  • Несколько параллельных проектов (сворачиваемые панели, «+ добавить»).
//  • Крафтер — из персонажей с галочкой «Доступен для крафта»; навыки теста
//    выбираются вручную из его реальных Ремесла/Знаний.
//  • Комбинированный тест: ОДИН Предел (ведущий навык + бонусы рангов остальных)
//    и одна проверка; редкость+качество→сложность и Банк (из таблицы категорий).
//  • Ассистенты дают доп. Успехи; смена авто-начисляет Усталость крафтеру.
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
import { diceModeFor } from "../rules/test-kind.mjs";
import { pickReroll } from "../rules/reroll-pick.mjs";
import { critLineHtml } from "../rules/test-kind-widget.mjs";
import { criticalOutcome } from "../rules/roll-outcome.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** Персонаж, которым владеет игрок (не ГМ) — такой всегда доступен для крафта,
 *  вне зависимости от чекбокса «Доступен для крафта» (тот остаётся ручным
 *  переключателем для НПС). */
function _hasPlayerOwner(actor) {
  return game.users.some(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
}

function _crafterChoices() {
  return game.actors
    .filter(a => a.type === "character" && (a.system?.craftAvailable || _hasPlayerOwner(a))
                 && (game.user.isGM || a.isOwner))
    .map(a => ({ id: a.id, name: a.name }))
    .sort((x, y) => x.name.localeCompare(y.name, "ru"));
}

function _newProject() {
  return {
    id: foundry.utils.randomID(8),
    title: "", collapsed: false,
    mode: "craft",
    crafterId: _crafterChoices()[0]?.id || "",
    categoryKey: CRAFT_CATEGORIES[3].key,
    rarity: 1, quality: "common", toolKey: "common",
    gmMod: 0, assistants: 0, baseBank: null, improve: false, monotony: false, machineSize: 0,
    // Кубик смены (Преимущество/Помеха, стр. 26) — Сложность у Крафта уже
    // есть своя («Модификатор ГМа»), второй дропдаун не заводим.
    diceMode: "normal",
    researchKind: "blueprint",
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
    this.projects = [_newProject()];
  }

  _proj(pid) { return this.projects.find(p => p.id === pid) || null; }
  _crafter(proj) { return game.actors.get(proj.crafterId) || null; }
  _reqs(proj, category) {
    if (proj.mode === "research") return [{ group: "forbiddenLore" }];
    return category?.req || [];
  }

  _resolve(proj) {
    const isResearch = proj.mode === "research";
    const crafter = this._crafter(proj);
    const category = CRAFT_CATEGORIES.find(c => c.key === proj.categoryKey);
    const available = buildAvailableSkills(crafter, isResearch);
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
      machineNote: isMachine, machineSize, crafter, isResearch };
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

  _projectVM(proj) {
    const R = this._resolve(proj);
    const crafterName = R.crafter?.name || "";
    const catLabel = proj.mode === "research" ? "Исследование"
      : proj.mode === "bio" ? (proj.bioImplant || "Ферментный Чан")
      : (R.category?.label || "");
    const accum = proj.project.accumulated;
    const pct = Math.max(0, Math.min(100, Math.round((accum / R.bank) * 100)));

    const testRows = R.slots.map((s, i) => {
      const row = R.combined.rows[i] || {};
      return { idx: i, options: s.options, suggestion: s.suggestion,
        total: row.total, rankBonus: row.rankBonus, synergy: row.synergy, isPrimary: row.isPrimary, contrib: row.contrib };
    });

    const limit = R.combined.limit;
    return {
      id: proj.id, collapsed: proj.collapsed,
      title: proj.title, autoTitle: `${proj.mode === "research" ? "Исследование" : proj.mode === "bio" ? "Биолаборатория" : "Крафт"}${crafterName ? " · " + crafterName : ""}${catLabel ? " · " + catLabel : ""}`,
      summary: proj.mode === "bio"
        ? `цикл ${proj.bioCycle || 0}`
        : `${accum}/${R.bank}`,
      isCraft: proj.mode === "craft", isResearch: proj.mode === "research",
      isBio: proj.mode === "bio", bio: proj.mode === "bio" ? this._bioVM(proj) : null,

      crafters: _crafterChoices(), crafterId: proj.crafterId, hasCrafter: !!R.crafter,
      noCrafters: _crafterChoices().length === 0,

      categories: CRAFT_CATEGORIES.map(c => ({ key: c.key, label: c.label, icon: craftIcon(c.icon), selected: c.key === proj.categoryKey })),
      categoryAlt: R.category?.alt || "",
      researchKinds: RESEARCH_KINDS.map(k => ({ ...k, selected: k.key === proj.researchKind })),

      rarity: proj.rarity,
      rarityOptions: RARITY_ORDER.map(v => ({ v, l: RARITY_LABELS[String(v)], selected: v === proj.rarity })),
      qualityOptions: Object.entries(CRAFT_QUALITY).map(([k, q]) => ({ k, label: q.label, mult: q.bankMult, selected: k === proj.quality })),
      tools: CRAFT_TOOLS.map(t => ({ ...t, selected: t.key === proj.toolKey })),

      gmMod: proj.gmMod, assistants: proj.assistants, improve: proj.improve, monotony: proj.monotony,
      diceMode: proj.diceMode || "normal",
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
      icoSolution: craftIcon("solution"), icoTemplate: craftIcon("template")
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
    el.querySelector("[data-act=add-project]")?.addEventListener("click", () => { this.projects.push(_newProject()); this.render(false); });
    on("[data-act=toggle]", "click", e => upd(e.currentTarget, p => p.collapsed = !p.collapsed));
    on("[data-act=remove]", "click", e => { const pid = pidOf(e.currentTarget); if (this.projects.length > 1) { this.projects = this.projects.filter(p => p.id !== pid); this.render(false); } });
    on("[name=ptitle]", "change", e => upd(e.currentTarget, p => p.title = e.target.value));

    on("[data-mode]", "click", e => upd(e.currentTarget, p => { p.mode = e.currentTarget.dataset.mode; p.skillChoices = {}; p.baseBank = null; }));
    on("[name=crafter]", "change", e => upd(e.currentTarget, p => { p.crafterId = e.target.value; p.skillChoices = {}; }));
    on("[data-cat]", "click", e => upd(e.currentTarget, p => { p.categoryKey = e.currentTarget.dataset.cat; p.skillChoices = {}; p.baseBank = null; }));
    on("[data-slot]", "change", e => upd(e.currentTarget, p => p.skillChoices[Number(e.currentTarget.dataset.slot)] = e.target.value));

    on("[name=research-kind]", "change", e => upd(e.currentTarget, p => p.researchKind = e.target.value));
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

    // Биолаборатория
    on("[name=vat]", "change", e => upd(e.currentTarget, p => p.vatKey = e.target.value));
    on("[name=bio-target]", "change", e => upd(e.currentTarget, p => p.bioTarget = e.target.value));
    on("[name=bio-skill]", "change", e => upd(e.currentTarget, p => p.bioSkill = e.target.value));
    on("[name=bio-implant]", "change", e => upd(e.currentTarget, p => { p.bioImplant = e.target.value; p.bioCycle = 0; p.bioLog = []; }));
    on("[data-act=bio-cycle]", "click", e => this._rollCycle(pidOf(e.currentTarget)));
    on("[data-act=bio-reset]", "click", e => upd(e.currentTarget, p => { p.bioCycle = 0; p.bioLog = []; }));

    on("[data-act=shift]", "click", e => this._rollShift(pidOf(e.currentTarget)));
    on("[data-act=reset]", "click", e => upd(e.currentTarget, p => p.project = { accumulated: 0, shifts: 0, fatigue: 0 }));
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
    // Каждый ассистент даёт +1 Успех И +10 к проверке крафта.
    const assist = Math.max(0, Number(proj.assistants || 0));
    const assistBonus = assist * 10;
    const limit = R.combined.limit + mono + assistBonus;

    // Комбинированный тест — ОДНА проверка против наименьшего/итогового Предела
    // (свой книжный расчёт, не общий combinedThreshold — см. computeCombined).
    // Кубик смены (Преимущество/Помеха) — тот же приём, что и везде.
    const diceMode = diceModeFor(proj.diceMode);
    const rollCount = diceMode ? diceMode.rolls : 1;
    const rolls = [];
    for (let i = 0; i < rollCount; i++) rolls.push(await new Roll("1d100").evaluate());
    const picked = pickReroll(rolls.map(r => r.total), diceMode?.mode);
    const roll = rolls[picked.index];
    const rv = picked.value, dos = degreesOfSuccess(rv, limit);
    const diceNote = diceMode
      ? `<div class="wh-craft-roll-line">${proj.diceMode === "advantage" ? "Преимущество" : "Помеха"}: отброшено ${picked.dropped.join(", ")}</div>`
      : "";
    const critLine = critLineHtml(criticalOutcome(rv, resolveTest({ actor: crafter, kind: "skill" }).crit));

    const gain = Math.max(0, dos) + assist;
    proj.project.shifts += 1;
    proj.project.fatigue += 1;
    proj.project.accumulated += gain;
    const done = proj.project.accumulated >= R.bank;

    try {
      const fat = crafter.system.fatigue?.value || 0;
      await crafter.update({ "system.fatigue.value": fat + 1 });
    } catch (e) { console.warn("warhammer-dbc | craft fatigue", e); }

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
          ${assist ? `<div class="wh-craft-roll-line ok">Ассистенты (${assist}): +${assistBonus} к тесту, +${assist} успеха</div>` : ""}
          <div class="wh-craft-msg-sum ${gain > 0 ? "ok" : "fail"}">Итог смены: <b>+${gain}</b> · Прогресс: <b>${proj.project.accumulated}</b>/${R.bank}${done ? " · <b style='color:#8cf0a0'>ГОТОВО!</b>" : ""}</div>
          <div class="wh-craft-msg-foot">Смена №${proj.project.shifts} · Усталость +1 (крафтеру)${mono ? " · монотонность −30" : ""}</div>
        </div>`,
      rolls: [roll], sound: CONFIG.sounds.dice
    }, rollMode);
    await ChatMessage.create(msg);
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
