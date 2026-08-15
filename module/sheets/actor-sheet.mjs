import { activateEliteListeners } from "./elite-picker.mjs";
import { activateHaemonculusListeners } from "./tabs/haemonculus.mjs";
import { openItemPicker, talentCategory } from "./item-picker.mjs";
import { openGearPicker } from "./gear-picker.mjs";
// module/sheets/actor-sheet.mjs

import { CHARACTERISTICS, SKILL_RANKS } from "../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF }    from "../constants/skills.mjs";
import { ITEM_TYPES, GEAR_ITEM_TYPES } from "../constants/items.mjs";
import { _degWord, splitTopLevel } from "../helpers/utils.mjs";
import { showCreationWizard, ruSpec } from "../apps/creation.mjs";
import { buildSkillDisplay, buildGetData } from "./sheet-helpers.mjs";
import { characterContext, charLabel } from "./character-context.mjs";
import { showAttackDialog, showAttackDialogNoWeapon } from "./attack-dialog.mjs";
import { rollMutationOrGift, openMutationPicker } from "./tabs/mutations.mjs";
import { createDisorderItem, activateDisorderListeners } from "./tabs/disorders.mjs";
import { activateDiseaseListeners } from "./tabs/diseases.mjs";
import { fatiguePenalty, activateConditionsListeners } from "./tabs/conditions.mjs";
import { painChatMsg } from "./tabs/pain.mjs";
import { applyHealing } from "./tabs/healing.mjs";
import { activateDrugListeners } from "./tabs/drugs.mjs";
import { activatePsychicListeners, activateNavigatorPower, executePsychotest,
         resolvePsyCastAttr, rollPsyWpTest, rollPsyniscience, showManifestDialog,
         wirePsyManifestPreview } from "./tabs/psychic.mjs";
import { activateTechListeners, activateTechMiracle, techGenResource } from "./tabs/tech.mjs";
import { activateGearListeners } from "./tabs/gear.mjs";
import { activateAspirationListeners } from "./tabs/aspirations.mjs";
import { activateRitualListeners } from "./tabs/rituals.mjs";
import { activatePathListeners } from "./tabs/paths.mjs";
import { activateCombatListeners } from "./tabs/combat.mjs";
import { activateBodyListeners } from "./tabs/body.mjs";
import { activatePossessionListeners } from "./tabs/possession.mjs";
import { activateAdvanceListeners } from "./tabs/advance.mjs";
import { activateItemContextMenu } from "./context-menu.mjs";
import { _resolveSoulBurn }                 from "../hooks.mjs";
import { _performDodge, _performParry }    from "../combat/defense.mjs";
import { openRigManager }                   from "../apps/rig-manager.mjs";
import { infamyContext, changeInfamy, restoreInfamy, spendInfamy } from "../apps/infamy-points.mjs";
import { promptStatAdd } from "../apps/stat-log.mjs";
import { CHAOS_PATRONS, chaosPatronMeta } from "../constants/chaos-patron.mjs";
import { applyArchetype } from "../apps/archetypes.mjs";
import { homeworldRollMods, matchesContext } from "../constants/homeworlds.mjs";
import { ruleRollModsHtml } from "../rules/roll-mods.mjs";
import { specOptions, matchSpec, specDef } from "../constants/skill-specializations.mjs";
import { applyHomeworld, actorHomeworldKey } from "../apps/homeworlds.mjs";
import { applyDivination } from "../apps/divinations.mjs";
import { activateRaceListeners } from "../apps/races.mjs";
import { grantAstartesImplants } from "../apps/astartes-implants.mjs";
import { HELMETLESS_FEL_BONUS } from "../constants/power-armour-lore.mjs";
import { isFeatureEnabled } from "../constants/features.mjs";

// Псевдонимы коротких имён талантов из данных рас/архетипов → имена в библиотеке
// (по англ. части, в нижнем регистре). Покрывает расхождения «Minion» →
// «Minion of Chaos», дефисы, мн.ч. и опечатки.
const TALENT_ALIAS = {
  "minion":               "minion of chaos",
  "erudite infernal":     "erudite-infernal",
  "clues from the crowd": "clues from the crowds",
  "sure stitch":          "sure strike"
};
// Разделители вариантов выбора в данных: « или » и «/».
const TALENT_CHOICE_SEP = /\s+или\s+|\s*\/\s*/i;

export class WarhammerCharacterSheet extends foundry.appv1.sheets.ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["warhammer-dbc","sheet","actor","character","wh-holo"],
      template: "systems/warhammer-dbc/templates/actor/character-sheet.hbs",
      width: 840, height: 920,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }]
    });
  }

  _savedScrollTops = {};
  _geneSeedOpen = false;
  _combatCollapse = { stance: false, tech: false };
  // Свёрнутые категории вкладки снаряжения (ключ категории → свёрнута?).
  _gearCollapse = {};
  // Носители (оружие/броня), у которых свёрнут список установленных улучшений.
  _gearHostCollapse = new Set();
  _wizardPrompted = false;

  _saveScrollPositions() {
    if (!this.element?.length) return;
    this.element.find(".sheet-body, .skills-advance-scroll").each((i, el) => {
      this._savedScrollTops[i] = el.scrollTop;
    });
  }

  _restoreScrollPositions() {
    if (!this.element?.length) return;
    this.element.find(".sheet-body, .skills-advance-scroll").each((i, el) => {
      if (this._savedScrollTops[i] !== undefined) el.scrollTop = this._savedScrollTops[i];
    });
  }

  async render(force = false, options = {}) {
    this._saveScrollPositions();
    return super.render(force, options);
  }

  // Показать/скрыть под-строки установленных улучшений конкретного носителя
  // (оружия/брони) на вкладке снаряжения. Строки-описания при сворачивании
  // прячутся; при разворачивании остаются скрытыми (раскрываются кнопкой ▸).
  _applyGearHostCollapse(html, hid) {
    const collapsed = !!this._gearHostCollapse?.has(hid);
    html.find(`.gear-modsub-row[data-host-id="${hid}"]`).css("display", collapsed ? "none" : "");
    if (collapsed) html.find(`.ability-detail-row[data-host-id="${hid}"]`).css("display", "none");
    html.find(`.gear-mods-toggle[data-host-id="${hid}"]`).toggleClass("collapsed", collapsed);
  }

  // ── getData ───────────────────────────────────────────────────────────────

  getData() {
    const context = super.getData();

    // Контекст шаблона собирают два модуля: sheet-helpers.mjs — списки вкладок,
    // character-context.mjs — самого персонажа. Здесь остаётся только то, что
    // знает окно, а не актор.
    Object.assign(context, buildGetData(this.actor), characterContext(this.actor));

    // ── Сворачивание секций: состояние окна, переживает перерисовку ─────────
    context.combatStanceCollapsed = !!this._combatCollapse?.stance;
    context.combatTechCollapsed   = !!this._combatCollapse?.tech;
    context.gearCollapse = this._gearCollapse || {};

    // ── Очки Бесчестия (корбук 438): доступны Хаоситам ─────────────────────
    // Путь к счётчику и его максимум задают геттеры листа: у Демон-Принца это
    // не Судьба, а собственные ОБ, поэтому расчёт остаётся здесь.
    if (context.isHeretic && this._infamyEnabled) {
      const ip = Math.max(0, Number(foundry.utils.getProperty(this.actor, this._infamyPath)) || 0);
      context.infamy = infamyContext(this.actor, this._infamyKey,
        { ip, ipMax: this._infamyMax, showCounter: this._infamyShowCounter });
      context.chaosPatron = chaosPatronMeta(this._infamyKey);
      // Отметка радиокнопки — по ХРАНИМОМУ полю, а не по _infamyKey: тот
      // подставляет Неделимого, когда Бог не выбран, и селектор показывал бы
      // выбранным то, чего в акторе нет (wdbc-osz).
      const patronChosen = this.actor.system.patronGod || "";
      context.chaosPatrons = CHAOS_PATRONS.map(p => ({ ...p, selected: p.key === patronChosen,
        favor: Number(foundry.utils.getProperty(this.actor, `system.patronFavor.${p.key}`)) || 0 }));
      // Селектор Бога в ЗАПИСЯХ — только там, где патрон не выбирается иначе.
      // У Демон-Принца патрон = «Патрон» в шапке (allegiance) → селектор скрыт.
      context.showPatronPicker = this._showPatronPicker;
    }

    return context;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Штраф усталости для броска.
   * Освобождены: T, Inf, Cog
   */
  /**
   * Категория таланта для расчёта цены: раса может делать талант всегда
   * Дружественным (Total Recall у Астартес), иначе решает культура легиона.
   */
  _talentCat(name, folder = "") {
    return talentCategory(this.actor, name, folder);
  }

  /**
   * Снятый шлем силовой брони: +5 ко всем тестам на основе Товарищества.
   * Правило безусловное, поэтому применяется само, а не галочкой в диалоге.
   */
  _getHelmetlessBonus(charKey) {
    if (!this.actor.system.helmetlessActive) return 0;
    return (charKey ?? "").toLowerCase() === "fel" ? HELMETLESS_FEL_BONUS : 0;
  }

  _getFatiguePenalty(charKey) {
    return fatiguePenalty(this.actor, charKey);
  }

  /**
   * Определяет актора-цель для «Применить на другом».
   * Приоритет: нацеленные токены (target), иначе выделенные (controlled).
   * Токены самого применяющего исключаются. Требуется ровно одна цель.
   */
  _resolveOtherTargetActor() {
    const targets = [...(game.user.targets ?? [])];
    let candidates = targets.length ? targets : [...(canvas.tokens?.controlled ?? [])];
    candidates = candidates.filter(t => {
      const a = t.actor ?? t.document?.actor;
      return a && a.id !== this.actor.id;
    });

    if (candidates.length === 0) {
      ui.notifications.warn("🎯 Нацельтесь на токен цели (или выделите его), чтобы применить препарат на другом.");
      return null;
    }
    if (candidates.length > 1) {
      ui.notifications.warn("🎯 Выберите ровно одну цель (один нацеленный/выделенный токен).");
      return null;
    }
    const actor = candidates[0].actor ?? candidates[0].document?.actor;
    if (!actor) {
      ui.notifications.warn("Не удалось определить актора цели.");
      return null;
    }
    return actor;
  }

  // Модификаторы характеристик от препаратов теперь применяются централизованно
  // в WarhammerActor.prepareDerivedData() — они уже входят в char.total, поэтому
  // отдельно в бросках их прибавлять НЕ нужно (иначе двойной учёт).

  /**
   * Навешивает на корень листа классы темы: раса / мировоззрение / класс.
   * Используется CSS для акцентов и баннера (wh-align-*, wh-race-*, wh-class-*).
   */
  _applyThemeClasses() {
    const root = this.element;
    if (!root?.length) return;
    const sys = this.actor.system;
    const cls = sys.isTechpriest ? "techpriest" : (sys.isPsyker ? "psyker" : "adept");
    root.removeClass((i, c) => (c.match(/wh-(align|race|class)-\S+/g) || []).join(" "));
    root.addClass(`wh-align-${sys.alignment || "loyalist"} wh-race-${sys.race || "none"} wh-class-${cls}`);
  }

  /** Создаёт Черты из списка {name,benefit,rating,hasRating,effects}, пропуская существующие по имени. */
  async _createTraitsFromList(list, source = "") {
    if (!Array.isArray(list) || !list.length) return 0;
    const existing = new Set(this.actor.items.filter(i => i.type === "trait").map(i => i.name));
    const toCreate = list.filter(t => t?.name && !existing.has(t.name)).map(t => ({
      name: t.name,
      type: "trait",
      system: {
        benefit:   t.benefit || "",
        source,
        hasRating: t.hasRating || false,
        rating:    t.rating || 0,
        effects: { charBonusStat:"", charBonusValue:0, armourAll:0, fearRating:0, sizeMod:0, ...(t.effects || {}) }
      }
    }));
    if (toCreate.length) await this.actor.createEmbeddedDocuments("Item", toCreate);
    return toCreate.length;
  }

  /**
   * Создаёт Таланты по списку имён. Полное описание/уровень/Бог подтягивается из
   * библиотеки талантов по совпадению английской части имени; скобочная часть
   * («Resistance (Cold, Heat)») идёт в Специализацию. Дубликаты — по имени+спец.
   */
  async _createTalentsFromList(list, source = "") {
    if (!Array.isArray(list) || !list.length) return 0;
    const keyOf    = (n, s) => `${n}|${s || ""}`;
    const existing = new Set(this.actor.items.filter(i => i.type === "talent")
      .map(i => keyOf(i.name, i.system?.specialization)));
    let lib = [];
    try {
      const pack = game.packs.get("warhammer-dbc.talents");
      if (pack) lib = await pack.getDocuments();
    } catch(e) { /* библиотека недоступна — создадим заглушки */ }
    const norm  = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const byEng = new Map();
    for (const d of lib) byEng.set(norm(d.name.split("/")[0]), d);
    const toCreate = [];
    const seen = new Set();
    for (const raw of list) {
      if (!raw) continue;
      const m        = String(raw).match(/^([^(]+?)\s*(?:\(([^)]*)\))?\s*$/);
      const baseName = (m ? m[1] : raw).trim();
      const spec     = (m && m[2]) ? m[2].trim() : "";
      const hit      = byEng.get(norm(baseName)) || byEng.get(TALENT_ALIAS[norm(baseName)] || "\0");
      const fullName = hit ? hit.name : String(raw);
      const key      = keyOf(fullName, spec);
      if (existing.has(key) || seen.has(key)) continue;
      seen.add(key);
      if (hit) {
        const sys = foundry.utils.deepClone(hit.system);
        if (spec) sys.specialization = spec;
        if (source) sys.notes = `Стартовый талант: ${source}`;
        toCreate.push({ name: fullName, type: "talent", img: hit.img, system: sys });
      } else {
        toCreate.push({ name: String(raw), type: "talent", system: {
          tier: 1, specialization: spec,
          benefit: source ? `Стартовый талант (${source}) — уточните выбор вручную.` : ""
        }});
      }
    }
    if (toCreate.length) await this.actor.createEmbeddedDocuments("Item", toCreate);
    return toCreate.length;
  }

  /**
   * Применяет стартовые таланты (список строк/строк-через-запятую). Записи-выборы
   * «X или Y» и «(любые N)» собираются в один диалог выбора; всё остальное
   * создаётся сразу. Возвращает число созданных талантов.
   */
  async _applyStartingTalents(rawList, source = "") {
    const entries = [];
    for (const r of (rawList || [])) for (const e of splitTopLevel(String(r))) entries.push(e);
    // Отсев «строительных» записей (не таланты): ассигнования опыта и счётчики
    // вида «1000 xp на Психосилы», «12 Талантов 1 уровня».
    const real = entries.filter(e => !/\d\s*(xp|хр)/i.test(e) && !/талант/i.test(e));
    if (!real.length) return 0;

    // Опции специализаций берём из библиотеки талантов.
    let lib = [];
    try { const p = game.packs.get("warhammer-dbc.talents"); if (p) lib = await p.getDocuments(); } catch(e) {}
    const norm   = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const byEng  = new Map(); for (const d of lib) byEng.set(norm(d.name.split("/")[0]), d);
    const find   = base => byEng.get(norm(base)) || byEng.get(TALENT_ALIAS[norm(base)] || "\0");
    // Перевод часто-английских специализаций (чувства, типы оружия, сопротивления…),
    // если компендиум ещё засеян по-английски.
    const optsOf = base => {
      const s = find(base)?.system?.specialization || "";
      if (!s || /люб|кажд|для каждого|организац/i.test(s)) return null;
      return s.split(",").map(x => ruSpec(x.trim())).filter(Boolean);
    };

    const fixed = [], choices = [];
    for (const e of real) {
      if (TALENT_CHOICE_SEP.test(e)) {
        choices.push({ type: "or", raw: e, options: e.split(TALENT_CHOICE_SEP).map(s => s.trim()).filter(Boolean) });
      } else {
        const m = e.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
        if (m && /люб/i.test(m[2])) {
          const count = parseInt((m[2].match(/\d+/) || ["1"])[0], 10) || 1;
          choices.push({ type: "wild", raw: e, base: m[1].trim(), count, opts: optsOf(m[1].trim()) });
        } else fixed.push(e);
      }
    }

    // Локализатор: «English (спец.) — Русское» по данным компендиума талантов.
    const nameOf = raw => {
      const m = String(raw).match(/^(.*?)\s*(\([^)]*\))?\s*$/);
      const base = (m ? m[1] : raw).trim();
      const spec = m && m[2] ? " " + m[2] : "";
      const d = find(base);
      if (!d) return String(raw);
      const parts = String(d.name).split("/");
      const ru = parts.length > 1 ? parts[1].trim() : "";
      return ru ? `${base}${spec} — ${ru}` : `${base}${spec}`;
    };

    const chosen = await this._promptTalentChoices(choices, nameOf);
    return await this._createTalentsFromList([...fixed, ...chosen], source);
  }

  _openItemPicker(kind) {
    return openItemPicker(this.actor, kind);
  }

  /** Диалог выбора для «или»/«любые N». Резолвится массивом строк-имён талантов. */
  _promptTalentChoices(choices, nameOf = (s => String(s))) {
    if (!choices || !choices.length) return Promise.resolve([]);
    const esc = s => String(s).replace(/"/g, "&quot;");
    const rows = choices.map((c, i) => {
      if (c.type === "or") {
        const opts = c.options.map(o => `<option value="${esc(o)}">${esc(nameOf(o))}</option>`).join("");
        return `<div class="atk-dlg-row wtc-row"><label class="wtc-lbl">Выбор:</label><select class="wtc-sel" data-ci="${i}" data-cj="0">${opts}</select></div>`;
      }
      // wild
      let inputs = "";
      for (let j = 0; j < c.count; j++) {
        if (c.opts) {
          const opts = c.opts.map(o => `<option value="${esc(o)}">${o}</option>`).join("");
          inputs += `<select class="wtc-sel wtc-mini" data-ci="${i}" data-cj="${j}">${opts}</select>`;
        } else {
          inputs += `<input type="text" class="wtc-inp" data-ci="${i}" data-cj="${j}" placeholder="специализация"/>`;
        }
      }
      return `<div class="atk-dlg-row wtc-row"><label class="wtc-lbl">${nameOf(c.base)} <span class="wtc-x">×${c.count}</span></label><div class="wtc-inputs">${inputs}</div></div>`;
    }).join("");

    return new Promise(resolve => {
      new Dialog({
        title: "Выбор стартовых талантов",
        content: `<form class="wh-talent-choices"><p class="wtc-hint">Уточните таланты-выборы:</p>${rows}</form>`,
        buttons: {
          ok: {
            label: "Применить",
            callback: html => {
              const result = [];
              html.find("[data-ci]").each((_, el) => {
                const c = choices[Number(el.dataset.ci)];
                const v = String(el.value || "").trim();
                if (!v) return;
                result.push(c.type === "wild" ? `${c.base} (${v})` : v);
              });
              resolve(result);
            }
          }
        },
        default: "ok",
        close: () => resolve([])
      }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-talent-dialog"], width: 480 }).render(true);
    });
  }


  _openGearPicker() {
    return openGearPicker(this.actor);
  }

  /** Создаёт предмет-расстройство на акторе из записи библиотеки (без дублей по имени). */
  async _createDisorderItem(entry) {
    return createDisorderItem(this.actor, entry);
  }

  // ── Очки Бесчестия (корбук 438) — переопределяется листом Демон-Принца ────
  // Хаосит: пул = поле «Очки Бесчестья» в шапке (system.fate), счётчик в полосе
  // скрыт; тема/сигил — по выбранному Богу-покровителю (system.patronGod).
  get _infamyEnabled() { return true; }
  get _showPatronPicker() { return true; }   // Демон-Принц переопределяет на false (патрон в шапке)
  get _infamyPath() { return "system.fate.value"; }
  get _infamyMax()  { return Math.max(0, Number(this.actor.system.fate?.max) || 0); }
  get _infamyShowCounter() { return false; }
  get _infamyKey()  { return this.actor.system.patronGod || "undivided"; }
  _infamyMeta()     { const p = chaosPatronMeta(this._infamyKey); return { gc: p.color, gc2: p.gc2, sigil: p.sigil }; }
  _ipChange(delta)  { return changeInfamy(this.actor, this._infamyPath, this._infamyMax, delta); }
  _ipRestore()      { return restoreInfamy(this.actor, this._infamyPath, this._infamyMax, this._infamyMeta()); }
  _ipSpend(key)     { return spendInfamy(this.actor, key, { godKey: this._infamyKey, ipFullPath: this._infamyPath, ipMax: this._infamyMax, meta: this._infamyMeta() }); }

  // ── Слушатели ─────────────────────────────────────────────────────────────
  //
  // Расчёт отсюда вынесен: остались вызовы `activate*Listeners` модулей и три
  // вещи, которым место именно здесь.
  //
  // 1. Состояние ОКНА, а не актора: прокрутка, свёртка Стоек/Приёмов, категорий
  //    Снаряжения, улучшений под носителем, гайда имплантов и Путей, тема листа,
  //    раскрытие строки описания, зрачок Третьего Глаза, драг предметов. Всё это
  //    живёт до закрытия листа и в актора не пишется.
  // 2. Точки входа диалогов листа: Мастер создания, пикеры, броски
  //    характеристики и навыка, «+» показателей, Очки Бесчестия. Диалог —
  //    часть листа; модулю он приходит колбэком (так же его зовёт HUD).
  // 3. Одна строка на источник бонусов: Родной мир, Архетип, Прорицание — сам
  //    расчёт в apps/.

  activateListeners(html) {
    requestAnimationFrame(() => { this._restoreScrollPositions(); });
    super.activateListeners(html);

    // ── Элитный архетип в шапке ───────────────────────────────────────────
    activateEliteListeners(html, this.actor);

    // ── Происхождение (Родные миры) ───────────────────────────────────────
    // Смена мира снимает всё, что дал прежний, и выдаёт новое (с диалогом
    // выбора, если мир его требует). Сам <select> не привязан к system.*.
    html.find(".hw-select").on("change", ev => applyHomeworld(this.actor, ev.currentTarget.value));
    html.find(".arch-select").on("change", ev => applyArchetype(this.actor, ev.currentTarget.value));
    html.find(".dv-select").on("change", ev => applyDivination(this.actor, ev.currentTarget.value));

    // ── Вкладка ГЕМУНКУЛ ──────────────────────────────────────────────────
    activateHaemonculusListeners(html, this.actor);

    // Очки Бесчестия (общая полоса infamy-strip)
    if (this.isEditable) {
      html.find(".dp-ip-minus").click(() => this._ipChange(-1));
      html.find(".dp-ip-plus").click(() => this._ipChange(+1));
      html.find(".dp-ip-restore").click(() => this._ipRestore());
      html.find(".dp-ip-spend").click(ev => this._ipSpend(ev.currentTarget.dataset.ability));
    }

    // ── Визуальная темизация листа по расе / мировоззрению / классу ─────────
    this._applyThemeClasses();

    // ── Третий Глаз навигатора: зрачок следит за курсором ──────────────────
    const eyeMove = html.find(".nav-eye-move")[0];
    const eyeSvg  = html.find(".nav-eye")[0];
    if (eyeMove && eyeSvg) {
      const rootEl = this.element?.[0] || html[0];
      const MAX = 11; // user-units (svg)
      const onEye = (ev) => {
        const r = eyeSvg.getBoundingClientRect();
        if (!r.width) return;
        let dx = (ev.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dy = (ev.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        eyeMove.style.transform = `translate(${(dx * MAX).toFixed(2)}px, ${(dy * MAX).toFixed(2)}px)`;
      };
      rootEl?.addEventListener("mousemove", onEye);
    }

    // ── Бой: свернуть/развернуть Стойки и Приёмы (без ре-рендера) ──────────
    html.find(".combat-collapse-head[data-collapse]").on("click", ev => {
      const key = ev.currentTarget.dataset.collapse;
      if (!this._combatCollapse) this._combatCollapse = {};
      this._combatCollapse[key] = !this._combatCollapse[key];
      ev.currentTarget.closest(".combat-collapsible")?.classList.toggle("collapsed", this._combatCollapse[key]);
    });

    // ── Снаряжение: свернуть/развернуть категорию (без ре-рендера; доступно и
    //    наблюдателям — потому размещено до проверки прав редактирования) ─────
    html.find(".gear-cat-head[data-gear-cat]").on("click", ev => {
      if (ev.target.closest("button, select, input, a")) return; // не по контролам внутри
      const key = ev.currentTarget.dataset.gearCat;
      if (!this._gearCollapse) this._gearCollapse = {};
      this._gearCollapse[key] = !this._gearCollapse[key];
      ev.currentTarget.closest(".gear-cat")?.classList.toggle("collapsed", this._gearCollapse[key]);
    });

    // ── Снаряжение: свернуть/развернуть улучшения под носителем ──────────────
    if (!this._gearHostCollapse) this._gearHostCollapse = new Set();
    // Восстанавливаем состояние после ре-рендера.
    for (const hid of this._gearHostCollapse) this._applyGearHostCollapse(html, hid);
    html.find(".gear-mods-toggle[data-host-id]").on("click", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const hid = ev.currentTarget.dataset.hostId;
      if (this._gearHostCollapse.has(hid)) this._gearHostCollapse.delete(hid);
      else this._gearHostCollapse.add(hid);
      this._applyGearHostCollapse(html, hid);
    });

    // ── Драг предметов из листа (напр. оружие → «Осквернение» в Завесе) ─────
    html.find(".item-row[data-item-id]").each((i, el) => {
      const id = el.dataset.itemId;
      const item = this.actor.items.get(id);
      if (!item) return;
      el.setAttribute("draggable", "true");
      el.addEventListener("dragstart", ev => {
        ev.stopPropagation();
        ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "Item", uuid: item.uuid }));
        ev.dataTransfer.effectAllowed = "copy";
      });
    });

    if (!this.isEditable) return;

    // ── Мастер создания персонажа (только по кнопке) ────────────────────────
    // Черты, стартовые таланты и тема листа остаются здесь: их зовут и кнопки
    // «Применить расу»/«Применить легион». Органы Геносемени переехали к своему
    // синку в apps/astartes-implants.mjs, но приходят тем же колбэком.
    html.find(".char-wizard-btn").click(ev => {
      ev.preventDefault();
      showCreationWizard(this.actor, {
        createTraits:          (list, source) => this._createTraitsFromList(list, source),
        applyStartingTalents:  (raw, source)  => this._applyStartingTalents(raw, source),
        grantAstartesImplants: ()             => grantAstartesImplants(this.actor),
        applyTheme:            ()             => this._applyThemeClasses()
      });
    });

    // Раскрытие описания таланта/черты/мутации в выпадающей строке под основной.
    // Строка описания всегда идёт СЛЕДУЮЩИМ <tr> сразу за строкой с кнопкой —
    // берём её так, а не поиском по data-item-id: на одном листе таблицы
    // талантов, черт, имплантов и органов Геносемени независимы, и если бы
    // где-то совпал id, раскрытие по атрибуту открыло бы сразу все совпадения.
    html.find(".ability-detail-toggle").on("click", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const row = $(ev.currentTarget).closest("tr").next(".ability-detail-row");
      const shown = row.toggle().is(":visible");
      ev.currentTarget.textContent = shown ? "▾" : "▸";
      ev.currentTarget.closest("tr")?.classList.toggle("ability-row-open", shown);
    });

    // ── Раса, Прошлое и легион ──────────────────────────────────────────────
    // Разбор строк книг остаётся на листе и уходит в модуль колбэками: те же
    // две функции зовёт Мастер создания персонажа.
    activateRaceListeners(html, this.actor, {
      createTraits:         (list, source) => this._createTraitsFromList(list, source),
      applyStartingTalents: (raw, source)  => this._applyStartingTalents(raw, source)
    });

    // Сворачивание гайда имплантов (состояние держится между перерисовками)
    if (this._geneSeedOpen) {
      html.find(".gene-organs").removeClass("collapsed");
      html.find(".gene-toggle-btn").text("▾ Импланты");
    }
    html.find(".gene-toggle-btn").click(ev => {
      ev.preventDefault();
      this._geneSeedOpen = !this._geneSeedOpen;
      html.find(".gene-organs").toggleClass("collapsed", !this._geneSeedOpen);
      ev.currentTarget.textContent = (this._geneSeedOpen ? "▾" : "▸") + " Импланты";
    });

    // Длительность теперь бросается автоматически при применении препарата.

    // ── Страх / Безумие / Порча и Болезни ──────────────────────────────────
    activateDisorderListeners(html, this.actor, {
      rollCharacteristic: (label, abbr, threshold, charKey) =>
        this._rollCharacteristic(label, abbr, threshold, charKey)
    });
    activateDiseaseListeners(html, this.actor);

    // ── Кнопки «+» показателей: Безумие/Порча (число или XdY+Z), Опыт,
    //    Благосклонность Бога-покровителя (ЗАПИСИ) — общий диалог+лог в чат ──
    html.find(".stat-add-btn").click(async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const stat = ev.currentTarget.dataset.stat;
      if (stat === "insanity") {
        await promptStatAdd(this.actor, { label: "Безумие", path: "system.insanity.value", allowDice: true });
      } else if (stat === "corruption") {
        await promptStatAdd(this.actor, { label: "Порча", path: "system.corruption.value", allowDice: true });
      } else if (stat === "xpTotal") {
        await promptStatAdd(this.actor, { label: "Опыт (Всего)", path: "system.experience.total" });
      } else if (stat === "patronFavor") {
        const god = ev.currentTarget.dataset.god;
        const meta = chaosPatronMeta(god);
        await promptStatAdd(this.actor, { label: `Благосклонность — ${meta.label}`, path: `system.patronFavor.${god}` });
      }
    });

    // ── Инициатива ────────────────────────────────────────────────────────
    html.find(".initiative-roll-btn").click(async () => {
      // initiativeMod уже учтён формулой через @initiativeMod (см. CONFIG.Combat.initiative)
      if (!this.actor.inCombat) {
        ui.notifications.warn(`${this.actor.name} не участвует в бою — добавьте токен в трекер инициативы.`);
        return;
      }
      await this.actor.rollInitiative({ createCombatants: false, rerollInitiative: true });
    });

    // ── Бросок характеристики ─────────────────────────────────────────────
    html.find(".char-roll").click(ev => {
      const key   = ev.currentTarget.dataset.char;
      if (key === "pf") {                       // Фактор Прибыли — не характеристика
        const pf = Number(this.actor.system.aspirations?.profitFactor) || 0;
        this._rollCharacteristic("Фактор Прибыли", "PF", pf, "pf", true);
        return;
      }
      const meta  = CHARACTERISTICS[key];
      const total = this.actor.system.characteristics[key]?.total ?? 0;
      this._rollCharacteristic(charLabel(key, this.actor.system.alignment), meta.abbr, total, key);
    });

    // ── Навыки ────────────────────────────────────────────────────────────
    html.find(".skill-roll").click(ev => {
      const isGroup = ev.currentTarget.dataset.group === "true";
      if (isGroup) {
        const groupKey = ev.currentTarget.dataset.groupkey;
        const idx      = parseInt(ev.currentTarget.dataset.index);
        const entry    = this.actor.system.groupSkills?.[groupKey]?.[idx];
        const def      = GROUP_SKILLS_DEF[groupKey];
        if (!entry || !def) return;
        this._rollSkill(`${def.label}: ${entry.specialty}`, entry.total ?? -20, entry.char || def.char,
          { group: groupKey, specialty: entry.specialty });
      } else {
        const key = ev.currentTarget.dataset.skill;
        const def = SKILLS_DEF[key];
        const sk  = this.actor.system.skills?.[key];
        this._rollSkill(def?.label ?? key, sk?.total ?? -20, def?.char ?? "ag", { skill: key });
      }
    });

    // ── Вкладка РАЗВИТИЕ ──────────────────────────────────────────────────
    // Выбор специализации остаётся тут: пикер — часть листа, а не вкладки.
    activateAdvanceListeners(html, this.actor, {
      addGroupSkill: groupKey => this._addGroupSkill(groupKey)
    });

    // ── Снаряжение ────────────────────────────────────────────────────────
    html.find(".add-item-btn").click(() => { this._showAddItemDialog(); });
    html.find(".rig-open-btn").click(() => { openRigManager(this.actor); });

    // Добавление Черт/Талантов — через пикер с листа (группировка по типам,
    // поиск, описание по стрелке). ПКМ — создать пустую (для своих/книжных).
    html.find(".trait-add-btn").on("click", ev => { ev.preventDefault(); this._openItemPicker("trait"); });
    html.find(".trait-add-btn").on("contextmenu", async ev => {
      ev.preventDefault();
      const item = await Item.create({ name: "Новая черта", type: "trait" }, { parent: this.actor });
      item?.sheet?.render(true);
    });
    html.find(".talent-add-btn").on("click", ev => { ev.preventDefault(); this._openItemPicker("talent"); });
    html.find(".talent-add-btn").on("contextmenu", async ev => {
      ev.preventDefault();
      const item = await Item.create({ name: "Новый талант", type: "talent" }, { parent: this.actor });
      item?.sheet?.render(true);
    });

    // ＋ мутация / ＋ Дар — выбор КОНКРЕТНОЙ записи из таблиц книги.
    html.find(".gear-lib-btn").click(ev => { ev.preventDefault(); this._openGearPicker(); });

    // ＋ Мутация/Дар — общий пул (см. tabs/mutations.mjs): выбор ЛЮБОЙ
    // записи из Общих Мутаций ИЛИ Даров любого Бога, не только покровителя.
    html.find(".mutgift-add-btn").click(async ev => {
      ev.preventDefault();
      if (ev.shiftKey) {   // Shift — пустая мутация с нуля
        const item = await Item.create({ name: "Новая мутация", type: "mutation" }, { parent: this.actor });
        return item?.sheet?.render(true);
      }
      openMutationPicker(this.actor);
    });

    // 🎲 Бросок по общему пулу (Общие Мутации ИЛИ Дар Бога — тип выбирается в
    // диалоге). Бросок можно сдвинуть на ±Inf.b (если результат не от
    // Провала) — спрашиваем модификатор.
    html.find(".mutgift-roll-btn").click(async ev => {
      ev.preventDefault();
      await rollMutationOrGift(this.actor);
    });

    // ── Стремления и Пути Аэльдари ─────────────────────────────────────────
    activateAspirationListeners(html, this.actor);
    activatePathListeners(html, this.actor);

    // ── Ритуалы (стр. 393-425) ─────────────────────────────────────────────
    activateRitualListeners(html, this.actor);

    // Сворачивание панели Путей (состояние держится между перерисовками)
    if (this._pathsOpen === false) {
      html.find(".paths-collapse").addClass("collapsed");
      html.find(".paths-toggle-btn").text("▸ Пути");
    }
    html.find(".paths-toggle-btn").click(ev => {
      ev.preventDefault();
      const nowOpen = this._pathsOpen === false; // был свёрнут → разворачиваем
      this._pathsOpen = nowOpen;
      html.find(".paths-collapse").toggleClass("collapsed", !nowOpen);
      ev.currentTarget.textContent = (nowOpen ? "▾" : "▸") + " Пути";
    });

    activatePsychicListeners(html, this.actor, {
      rollSkill: (label, target, charKey, opts) => this._rollSkill(label, target, charKey, opts),
      resolveSoulBurn: _resolveSoulBurn
    });

    activateTechListeners(html, this.actor, {
      rollSkill: (label, target, charKey, opts) => this._rollSkill(label, target, charKey, opts)
    });

    activateGearListeners(html, this.actor);

    // ── Вкладка БОЙ ───────────────────────────────────────────────────────
    activateCombatListeners(html, this.actor);

    // ── Контекстное меню предметов ────────────────────────────────────────
    activateItemContextMenu(html, this.actor);

    // ── Препараты ─────────────────────────────────────────────────────────────
    activateDrugListeners(html, this.actor, {
      resolveOtherTargetActor: () => this._resolveOtherTargetActor()
    });
    // ── Состояния и Усталость ─────────────────────────────────────────────
    activateConditionsListeners(html, this.actor);

    // ── Вкладка ТЕЛО ──────────────────────────────────────────────────────
    activateBodyListeners(html, this.actor);

    // ── Вкладка ОДЕРЖИМОСТЬ ───────────────────────────────────────────────
    activatePossessionListeners(html, this.actor);
  }

  // ── Диалог атаки ─────────────────────────────────────────────────────────

  // Сам диалог живёт в attack-dialog.mjs. Точки входа остаются здесь: их зовут
  // кнопки листа и HUD (module/apps/hud.mjs) — через actor.sheet.
  _showAttackDialog(item, techniqueOpts = {}) {
    return showAttackDialog(this.actor, item, techniqueOpts);
  }

  _showAttackDialogNoWeapon(techDef) {
    return showAttackDialogNoWeapon(this.actor, techDef);
  }

  // ── Добавление предмета ───────────────────────────────────────────────────

  _showAddItemDialog() {
    // Только снаряжение — без талантов/черт/психосил/расстройств и пр.
    const options = GEAR_ITEM_TYPES
      .map(type => `<option value="${type}">${ITEM_TYPES[type]}</option>`).join("");
    new Dialog({
      title: "Добавить предмет",
      content: `<form style="padding:8px;">
        <select id="new-item-type" class="wh-add-item-select" style="width:100%;padding:5px 6px;
          background:#0c2418;color:#d8ffe8;border:1px solid #2f9e6a;
          font-family:inherit;font-size:1em;">${options}</select>
      </form>`,
      buttons: {
        create: {
          icon: '<i class="fas fa-plus"></i>', label: "Создать",
          callback: async html => {
            const type  = html.find("#new-item-type").val();
            const label = ITEM_TYPES[type] || "Новый предмет";
            await Item.create({ name: `New ${label}`, type }, { parent: this.actor });
          }
        },
        cancel: { label: "Отмена" }
      },
      default: "create"
    }, { classes: ["dialog","wh-add-item-dialog","warhammer-dbc","wh-holo"], width: 320 }).render(true);
  }

  // ── Диалоги броска ────────────────────────────────────────────────────────

  async _addGroupSkill(groupKey) {
    const def = GROUP_SKILLS_DEF[groupKey];
    if (!def) return;
    const picked = await this._showSpecPicker(groupKey, def);
    if (!picked?.specialty) return;

    const entries = foundry.utils.deepClone(this.actor.system.groupSkills?.[groupKey] ?? []);
    const entry = { specialty: picked.specialty, rank: "untrained", cost: 0, total: -20 };
    // Ключ каталога — на него ссылаются механики; своя специализация без ключа.
    if (picked.specKey) entry.specKey = picked.specKey;
    // Своя Характеристика специализации (Operate(Voidship) — Интеллект).
    const sd = picked.specKey ? specDef(groupKey, picked.specKey) : null;
    if (sd?.char) entry.char = sd.char;
    entries.push(entry);
    this.actor.update({ [`system.groupSkills.${groupKey}`]: entries });
  }

  /**
   * Выбор специализации Группы Навыков: список из книги (стр. 58-61) плюс
   * своя. У специализаций с подстановкой (<Регион>, <Раса>) спрашиваем,
   * чем её заполнить.
   */
  _showSpecPicker(groupKey, def) {
    const opts = specOptions(groupKey);
    const esc = x => String(x ?? "").replace(/[&<>"]/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const rows = opts.map(o =>
      `<option value="${esc(o.key)}" data-free="${o.free ? 1 : 0}">${esc(o.display)}</option>`).join("");

    return new Promise(resolve => {
      let done = false;
      new Dialog({
        title: `${def.label}: специализация`,
        content: `<form class="wh-spec-picker">
          <div class="spec-row"><label>Из книги</label>
            <select id="spec-key"><option value="">— своя —</option>${rows}</select></div>
          <div class="spec-row" id="spec-fill-row" style="display:none;">
            <label id="spec-fill-label">Уточнение</label>
            <input type="text" id="spec-fill" placeholder="Например: Коронус"/></div>
          <div class="spec-row" id="spec-own-row"><label>Своя</label>
            <input type="text" id="spec-own" placeholder="Название специализации"/></div>
          <div class="spec-hint" id="spec-hint"></div>
        </form>`,
        buttons: {
          ok: { icon: '<i class="fas fa-check"></i>', label: "Добавить", callback: h => {
            if (done) return; done = true;
            const key = String(h.find("#spec-key").val() || "");
            if (!key) return resolve({ specialty: String(h.find("#spec-own").val() || "").trim() });
            const sd = specDef(groupKey, key);
            let specialty = sd?.label || key;
            if (sd?.free) {
              const fill = String(h.find("#spec-fill").val() || "").trim();
              // «Xenos (<Раса>)» + «Eldar» → «Xenos (Eldar)»
              specialty = fill ? specialty.replace(/<[^>]*>/, fill) : specialty.replace(/\s*\(<[^>]*>\)/, "");
            }
            resolve({ specialty, specKey: key });
          }},
          cancel: { label: "Отмена", callback: () => { if (!done) { done = true; resolve(null); } } }
        },
        default: "ok",
        render: h => {
          const upd = () => {
            const opt = h.find("#spec-key")[0].selectedOptions[0];
            const key = String(h.find("#spec-key").val() || "");
            const free = opt?.dataset.free === "1";
            h.find("#spec-fill-row").toggle(free);
            h.find("#spec-own-row").toggle(!key);
            const sd = key ? specDef(groupKey, key) : null;
            const bits = [];
            if (sd?.char)  bits.push(`Характеристика: ${CHARACTERISTICS[sd.char]?.abbr || sd.char}`);
            if (sd?.chars) bits.push(`Часто используемые: ${sd.chars.map(c => CHARACTERISTICS[c]?.abbr || c).join(", ")}`);
            if (sd?.psykerOnly) bits.push("Только для псайкеров");
            if (sd?.combines)   bits.push("Заменяет каждое из входящих знаний и двигается как одно");
            h.find("#spec-hint").text(bits.join(" · "));
          };
          h.find("#spec-key").on("change", upd); upd();
        },
        close: () => { if (!done) { done = true; resolve(null); } }
      }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-spec-dialog"], width: 460 }).render(true);
    });
  }

  /**
   * Галочки Особенности Происхождения для диалога броска.
   * Модификатор не применяется молча: игрок сам решает, уместен ли он здесь.
   *
   * Выключенная подсистема убирает Происхождение и отсюда: иначе выбор пропадал
   * из шапки листа (homeworldSheetContext), а галочки Особенности у персонажа с
   * уже применённым Происхождением оставались в диалоге броска.
   */
  _homeworldModsHtml(context) {
    if (!isFeatureEnabled("homeworlds")) return { html: "", mods: [] };
    const mods = homeworldRollMods(actorHomeworldKey(this.actor), context);
    if (!mods.length) return { html: "", mods };
    const rows = mods.map((m, i) => {
      const sign = m.value > 0 ? `+${m.value}` : (m.value < 0 ? `${m.value}` : "");
      return `<label class="attack-mod-check hw-roll-mod">
        <input type="checkbox" class="hw-mod" data-idx="${i}" data-value="${m.value || 0}"
               ${m.halvePenalty ? 'data-halve="1"' : ""}/>
        <span>${m.label}${sign ? ` <b>(${sign})</b>` : ""}</span></label>`;
    }).join("");
    return {
      mods,
      html: `<div class="atk-dlg-modifiers hw-mods">
        <div class="atk-mods-title">Родной мир — ${mods[0].world}</div>
        <div class="atk-mods-list">${rows}</div></div>`
    };
  }

  /**
   * Галочки ситуативных модификаторов, объявленных прямо на предметах актора
   * (flags.warhammer-dbc.rollMods — тот же формат записей, что и у
   * HOMEWORLDS[].rollMods: {when, value, label, halvePenalty}). Заполняется
   * записью kind:"rollmod" Конструктора (module/apps/mechanics.mjs) при
   * получении предмета. Один блок на предмет-источник, чтобы игрок видел,
   * откуда галочка.
   */
  _itemRollModsHtml(context) {
    const groups = [];
    for (const it of this.actor.items) {
      const mods = it.getFlag("warhammer-dbc", "rollMods");
      if (!Array.isArray(mods) || !mods.length) continue;
      const hits = mods.filter(m => matchesContext(m.when, context));
      if (hits.length) groups.push({ item: it, mods: hits });
    }
    if (!groups.length) return { html: "", mods: [] };
    const allMods = [];
    let idx = 0;
    const blocks = groups.map(g => {
      const rows = g.mods.map(m => {
        const gi = idx++;
        allMods.push(m);
        const sign = m.value > 0 ? `+${m.value}` : (m.value < 0 ? `${m.value}` : "");
        return `<label class="attack-mod-check item-roll-mod">
          <input type="checkbox" class="item-mod" data-idx="${gi}" data-value="${m.value || 0}"
                 ${m.halvePenalty ? 'data-halve="1"' : ""}/>
          <span>${m.label}${sign ? ` <b>(${sign})</b>` : ""}</span></label>`;
      }).join("");
      return `<div class="atk-dlg-modifiers item-mods">
        <div class="atk-mods-title">${g.item.name}</div>
        <div class="atk-mods-list">${rows}</div></div>`;
    }).join("");
    return { mods: allMods, html: blocks };
  }

  // Галочки от реестра правил: разметку читает и диалог атаки, поэтому она
  // живёт в rules/roll-mods.mjs.
  _ruleRollModsHtml(context) {
    return ruleRollModsHtml(this.actor, context);
  }

  _showSkillRollDialog(label, baseTotal, defaultChar, hideCharSelect = false, rollContext = null) {
    return new Promise(resolve => {
      let resolved = false;
      const rollCtx = { kind: "skill", char: defaultChar, ...(rollContext || {}) };
      const hw = this._homeworldModsHtml(rollCtx);
      const im = this._itemRollModsHtml(rollCtx);
      const rl = this._ruleRollModsHtml(rollCtx);
      const defaultCharTotal = this.actor.system.characteristics[defaultChar]?.total ?? 0;
      const rankBonus        = baseTotal - defaultCharTotal;
      const charOptions = Object.entries(CHARACTERISTICS).map(([key, meta]) => {
        const v = this.actor.system.characteristics[key]?.total ?? 0;
        return `<option value="${key}" ${key === defaultChar ? "selected" : ""}>${meta.abbr} — ${meta.label} (${v})</option>`;
      }).join("");

      const dialog = new Dialog({
        title: `Проверка: ${label}`,
        content: `
          <form class="wh-skill-roll-form">
            <div class="roll-dlg-header"><span>${label}</span></div>
            ${hideCharSelect ? "" : `<div class="roll-dlg-row">
              <label>Бросок с:</label>
              <select id="skill-char-select">${charOptions}</select>
            </div>`}
            <div class="roll-dlg-row">
              <label>Цель:</label>
              <input id="skill-target" type="number" value="${baseTotal}"/>
            </div>
            <div class="roll-dlg-row">
              <label>Модификатор:</label>
              <input id="skill-modifier" type="number" value="0"/>
            </div>
            ${hw.html}
            ${im.html}
            ${rl.html}
          </form>`,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок",
            callback: html => {
              if (!resolved) {
                resolved = true;
                let modifier = parseInt(html.find("#skill-modifier").val()) || 0;
                // Особенности родного мира: плюсы складываются, «Закалка»
                // Схолы Прогениум ополовинивает итоговый штраф.
                let halve = false;
                html.find(".hw-mod:checked").each((_, cb) => {
                  modifier += parseInt(cb.dataset.value) || 0;
                  if (cb.dataset.halve === "1") halve = true;
                });
                // Ситуативные модификаторы предметов (Черты/Таланты/etc. со
                // скрипт-записанным flags.warhammer-dbc.rollMods) — та же логика.
                html.find(".item-mod:checked").each((_, cb) => {
                  modifier += parseInt(cb.dataset.value) || 0;
                  if (cb.dataset.halve === "1") halve = true;
                });
                // Реестр правил (module/rules/) — та же логика.
                html.find(".rule-mod:checked").each((_, cb) => {
                  modifier += parseInt(cb.dataset.value) || 0;
                  if (cb.dataset.halve === "1") halve = true;
                });
                if (halve && modifier < 0) modifier = -Math.floor(Math.abs(modifier) / 2);
                resolve({
                  charKey:  html.find("#skill-char-select").val(),
                  target:   parseInt(html.find("#skill-target").val())   || 0,
                  modifier
                });
              }
            }
          },
          cancel: {
            label: "Отмена",
            callback: () => { if (!resolved) { resolved = true; resolve(null); } }
          }
        },
        default: "roll",
        render: html => {
          html.find("#skill-char-select").on("change", ev => {
            html.find("#skill-target").val(
              (this.actor.system.characteristics[ev.currentTarget.value]?.total ?? 0) + rankBonus
            );
          });
        },
        close: () => { if (!resolved) { resolved = true; resolve(null); } }
      }, { classes: ["dialog","wh-roll-dialog-window"], width: 340 });
      dialog.render(true);
    });
  }

  // ── Бросок навыка ─────────────────────────────────────────────────────────

  async _rollSkill(label, baseTotal, defaultChar, rollContext = null) {
    const result = await this._showSkillRollDialog(label, baseTotal, defaultChar, false, rollContext);
    if (!result) return;
    const { charKey, target, modifier } = result;

    const fatiguePenalty = this._getFatiguePenalty(defaultChar);
    // Снятый шлем: +5 ко всем тестам на основе Товарищества.
    const helmetBonus = this._getHelmetlessBonus(charKey);

    // Мод препаратов уже входит в target (через char.total → итог навыка)
    const eff      = target + modifier + fatiguePenalty + helmetBonus;
    const roll     = await new Roll("1d100").evaluate();
    const rv       = roll.total;
    const charAbbr = CHARACTERISTICS[charKey]?.abbr ?? charKey;
    const rollMode = game.settings.get("core", "rollMode");
    const deg      = Math.floor(Math.abs(rv <= eff ? eff - rv : rv - eff) / 10) + 1;
    const outcome  = rv <= eff
      ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`;
    const modStr   = modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";

    const messageData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${label}</div>
          <div class="roll-threshold">
            ${charAbbr}: <b>${target}</b>${modStr}
            ${fatiguePenalty !== 0 ? ` − 10 (😓 Усталость)` : ""}
            ${helmetBonus !== 0 ? ` + ${helmetBonus} (шлем снят)` : ""}
            → Порог: <b>${eff}</b>
          </div>
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">${outcome}</div>
        </div>`,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode);

    await ChatMessage.create(messageData);
  }

  /** Расчёт и применение лечения к пациенту + сообщение в чат. */
  async _applyHealing(patient, { mode, care, mod, bonus }) {
    return applyHealing(this.actor, patient, { mode, care, mod, bonus });
  }

  /** Краткое сообщение о Боли в чат. */
  async _painChatMsg(text) {
    return painChatMsg(this.actor, text);
  }

  // ── Бросок характеристики ─────────────────────────────────────────────────

  async _rollCharacteristic(label, abbr, threshold, charKey, hideCharSelect = false) {
    const result = await this._showSkillRollDialog(label, threshold, charKey, hideCharSelect);
    if (!result) return;
    const { target, modifier } = result;

    const fatiguePenalty = this._getFatiguePenalty(charKey);
    // Снятый шлем: +5 ко всем тестам на основе Товарищества.
    const helmetBonus = this._getHelmetlessBonus(charKey);

    // Мод препаратов уже входит в target (через char.total)
    const eff      = target + modifier + fatiguePenalty + helmetBonus;
    const roll     = await new Roll("1d100").evaluate();
    const rv       = roll.total;
    const rollMode = game.settings.get("core", "rollMode");
    const deg      = Math.floor(Math.abs(rv <= eff ? eff - rv : rv - eff) / 10) + 1;
    const outcome  = rv <= eff
      ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`;
    const modStr   = modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";

    const messageData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${abbr} — ${label}</div>
          <div class="roll-threshold">
            Цель: <b>${target}</b>${modStr}
            ${fatiguePenalty !== 0 ? ` − 10 (😓 Усталость)` : ""}
            ${helmetBonus !== 0 ? ` + ${helmetBonus} (шлем снят)` : ""}
            → Порог: <b>${eff}</b>
          </div>
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">${outcome}</div>
        </div>`,
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode);

    await ChatMessage.create(messageData);
  }

  _degWord(n) { return _degWord(n); }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ПСАЙКАНА
  // ══════════════════════════════════════════════════════════════════════════

  _resolvePsyCastAttr(sys) {
    return resolvePsyCastAttr(this.actor, sys);
  }

  _showManifestDialog(item) {
    return showManifestDialog(this.actor, item);
  }

  _wirePsyManifestPreview(html, meta) {
    return wirePsyManifestPreview(html, meta);
  }

  async _executePsychotest(item, opts) {
    return executePsychotest(this.actor, item, opts);
  }

  _rollPsyniscience() {
    return rollPsyniscience(this.actor, (label, target, charKey, opts) => this._rollSkill(label, target, charKey, opts));
  }

  /** Тест W + PR×5 (для Пси-капюшона и Выжигания Души). */
  async _rollPsyWpTest(label, note) {
    return rollPsyWpTest(this.actor, label, note);
  }

  /** Применение Силы навигатора: простой тест характеристики (без Феноменов/Прорывов). */
  async _activateNavigatorPower(item) {
    return activateNavigatorPower(this.actor, item);
  }

  /** Активация Техночуда: Когниция + Энергия + тест Tech-Use (Ментальное) + урон. */
  async _activateTechMiracle(item) {
    return activateTechMiracle(this.actor, item);
  }

  // ── Генерация Когниции/Энергии от имплантов Кибернетики Механикум ──────────
  async _techGenResource(item, opts) {
    return techGenResource(this.actor, item, opts);
  }

}

