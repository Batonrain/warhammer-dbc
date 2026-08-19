// module/apps/character-wizard.mjs
// ════════════════════════════════════════════════════════════════════════
//  Единый Мастер создания персонажа — пять этапов в одном окне вместо
//  каскада независимых диалогов (было: showCreationWizard в creation.mjs +
//  отдельные диалоги Талантов/Навыков/Конструктора). Живёт поверх уже
//  существующего актора: character-start.mjs заводит пустой лист и сразу
//  открывает этого Мастера на нём; на готовом персонаже Мастера можно
//  перезапустить пунктом «Перезапустить мастера создания» в window.controls
//  листа (module/sheets/actor-sheet.mjs).
//
//  Каждый этап пишет свои данные на актора по «Далее» — гранты (раса,
//  субраса, легион) и броски совершаются в момент подтверждения шага, а не
//  одним патчем в самом конце.
//
//  Этапы 2-5 пока заглушки — реализуются следующими итерациями (см. план
//  «Единый мастер создания персонажа», доступен в памяти сессии).
// ════════════════════════════════════════════════════════════════════════

const { Application } = foundry.appv1.api;

import { disabledRaceKeys }      from "../constants/features.mjs";
import { raceGroupList, subracesOf, raceDef } from "./race-library.mjs";
import { applyRace, applySubrace, applyLegion, applyYnnari, applyHarlequin,
         actorRaceItem, actorSubraceItem }    from "./races.mjs";
import { buildLegionOptions, buildChapterOptions,
         buildCultureLegionOptions }          from "../constants/legions.mjs";
import { applyHomeworld, homeworldSheetContext, needsIntBonusChoice } from "./homeworlds.mjs";
import { applyDivination, divinationSheetContext } from "./divinations.mjs";
import { characterContext }      from "../sheets/character-context.mjs";
import { CHARACTERISTICS, APTITUDES } from "../constants/characteristics.mjs";
import { CREATION_ROLL_CHARS, creationBonusRolls, rollCharSet, creationCharSum,
         rollFormula, APT_CHAR_KEYS, APT_OTHER_KEYS, APT_PICK, resolveCreation,
         grantCreationSkills, grantMechanicusImplants, grantSkitariiWarPlate,
         ruSpec } from "./creation.mjs";
import { startingInfamyFormula } from "../rules/starting-infamy.mjs";
import { ASPIRATION_TABLES } from "../constants/aspirations.mjs";
import { aspirationOptions, aspirationByKey } from "./aspirations.mjs";
import { activateAspirationListeners } from "../sheets/tabs/aspirations.mjs";
import { START_LEVELS, START_CAP, startLevelValues } from "../constants/start-levels.mjs";
import { resolveCultureFx } from "../constants/legions.mjs";
import { splitTopLevel } from "../helpers/utils.mjs";
import { archetypeEntries, archetypesForRace, applyArchetype, actorArchetypeItem } from "./archetypes.mjs";
import { withMechCollector, describeMechEntry } from "./mechanics.mjs";
import { TALENT_ALIAS, TALENT_CHOICE_SEP } from "../sheets/actor-sheet.mjs";
import { esc } from "../helpers/utils.mjs";
import { openCompendiumBrowser } from "./compendium-browser.mjs";
import { actorFactionsContext, activateFactionFieldListeners } from "./actor-factions.mjs";

export const WIZARD_STEPS = [
  { id: "origin",          label: "Происхождение" },
  { id: "characteristics", label: "Характеристики" },
  { id: "archetype",       label: "Архетип" },
  { id: "aspirations",     label: "Стремления" },
  { id: "gear",            label: "Снаряжение" }
];

export class CharacterWizard extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["warhammer-dbc", "wh-holo", "wh-char-wizard"],
      template: "systems/warhammer-dbc/templates/apps/character-wizard.hbs",
      width: 620, height: 760, resizable: true,
      scrollY: [".wiz-step-body"]
    });
  }

  constructor(actor, options = {}) {
    super(options);
    this.actorId = actor.id;
    this.options.id = "wh-char-wizard-" + actor.id;
    this.stepIndex = 0;
    // Поле Фракции (activateFactionFieldListeners, ./actor-factions.mjs)
    // создаёт/удаляет embedded-предмет само, без обратного вызова к нам —
    // без этих хуков новая фишка не появилась бы в форме шага до следующего
    // «ручного» render() от чего-то другого.
    const onFactionItemChange = item => { if (item?.parent?.id === this.actorId && item.type === "faction") this.render(false); };
    this._factionHookIds = [
      { hook: "createItem", id: Hooks.on("createItem", onFactionItemChange) },
      { hook: "deleteItem", id: Hooks.on("deleteItem", onFactionItemChange) }
    ];
    // Снимок «поле было пустым до Мастера» — берётся ОДИН раз, до первой
    // выдачи расы на Этапе 1 (та уже пишет часть суммы в те же поля), и
    // используется на Этапе 2: без снимка «пусто ли» перестало бы отличать
    // новый лист от персонажа, которого просто открыли Мастером повторно.
    this._wasEmpty = null;
    // Состояние Этапа 2 (метод «Генерация») — переживает render() внутри
    // шага, но не должно переживать возврат на Этап 1 и повторный заход.
    this.charSets = null;
    this.activeSetIdx = 0;
    this.charAssign = {};
    this.armedVi = null;
    this.pickedApts = new Set();
    // Состояние Этапа 4 — выбор уровня стартовой игры (Стремления пишутся
    // сразу через activateAspirationListeners, своего состояния не требуют).
    this.startLevelKey = START_LEVELS[0].key;
    this.startExtraXp = 0;
    this.startExtraInf = 0;
    this.startExtraCor = 0;
    // Этап 3: библиотека Талантов (для подписи специализаций) грузится
    // один раз лениво; выборы-развилки — прямо в форме шага, а не в
    // отдельном диалоге (см. _archTalentChoices/_confirmArchetype).
    this._talentLib = null;
    this._talentLibLoading = false;
    this.talentPicks = {};
    // Диалоги ИЛИ/спец-выбора Конструктора (mechanics.mjs) при выдаче
    // архетипа собираются сюда вместо всплывающих Dialog — см. _mechCollector.
    // Бюджетные покупки (Психосилы/Техночудеса) коллектор не перехватывает,
    // остаются отдельным окном (Обозреватель компендиумов).
    this.pendingMechChoices = [];
    this._confirmingArchetype = false;
    this._isClosing = false;
    // Этап 5: выбор текстового снаряжения (arch.gear/race.gear и т.п.) —
    // gearPicks хранит выбранную ЭТИКЕТКУ (не предмет) на каждую группу
    // выбора; сами предметы резолвятся на подтверждении, см. _confirmGear.
    this.gearPicks = {};
    this._confirmingGear = false;
    this._gearDone = false;
    // Родной мир с выбором «N специализаций = Int.b×2» (Исследовательская
    // станция) нельзя применить прямо на Этапе 1 — Интеллект появляется
    // только на Этапе 2, диалог показал бы «доступно 0». Ключ мира копится
    // здесь и по-настоящему применяется по подтверждению Этапа 2 (см.
    // _onNext), когда Int.b уже посчитан.
    this._pendingHomeworldKey = null;
  }

  get actor() { return game.actors.get(this.actorId); }
  get title() { return `Мастер создания — ${this.actor?.name || ""}`; }
  get step()  { return WIZARD_STEPS[this.stepIndex]; }

  getData() {
    const actor = this.actor;
    if (!actor) return { missing: true };
    const sys = actor.system;
    const cc  = characterContext(actor);

    const offRaces = disabledRaceKeys();
    const raceGroups = raceGroupList().map(g => ({
      label: g.label,
      races: g.races.filter(r => r.key === sys.race || !offRaces.includes(r.key))
        .map(r => ({ key: r.key, label: r.label, selected: r.key === sys.race }))
    })).filter(g => g.races.length);
    const subraceOpts = subracesOf(sys.race).map(s =>
      ({ key: s.key, label: s.label, selected: s.key === sys.subrace }));
    const isAstartes = sys.race === "astartes";

    return {
      missing: false,
      name: actor.name,
      steps: WIZARD_STEPS.map((s, i) => ({ ...s, active: i === this.stepIndex, done: i < this.stepIndex })),
      stepId: this.step.id,
      stepLabel: this.step.label,
      isFirstStep: this.stepIndex === 0,
      isLastStep:  this.stepIndex === WIZARD_STEPS.length - 1,

      raceGroups, subraceOpts,
      hasSubrace: subraceOpts.length > 0,
      isAstartes,
      legionOptions:  isAstartes ? buildLegionOptions(sys.geneSeed?.legion || "") : "",
      chapterOptions: isAstartes ? buildChapterOptions(sys.geneSeed?.legion || "", sys.geneSeed?.chapter || "") : "",
      cultureOptions: isAstartes ? buildCultureLegionOptions(sys.geneSeed?.cultureLegion || "") : "",
      alignment: sys.alignment || "loyalist",

      isAeldari: cc.isAeldari, isYnnari: cc.isYnnari, isHarlequin: cc.isHarlequin, isDrukhari: cc.isDrukhari,
      showWorldOrigin: cc.showWorldOrigin,
      worldOptions: cc.worldOptions, bandOptions: cc.bandOptions,
      drukhariFactionOptions: cc.drukhariFactionOptions, drukhariDistrictOptions: cc.drukhariDistrictOptions,
      masqueOptions: cc.masqueOptions,
      ynnariPastOptions: cc.ynnariPastOptions, harlequinPastOptions: cc.harlequinPastOptions,
      ynnariPast: sys.ynnariPast || "", harlequinPast: sys.harlequinPast || "",

      homeworld:  this._homeworldStepContext(),
      divination: divinationSheetContext(actor),
      ...actorFactionsContext(actor),

      ...(this.step.id === "characteristics" ? this._charStepContext() : {}),
      ...(this.step.id === "archetype" ? this._archetypeStepContext() : {}),
      ...(this.step.id === "aspirations" ? this._aspirationsStepContext() : {}),
      ...(this.step.id === "gear" ? this._gearStepContext() : {}),
      // «Далее» с Этапа 2 ждёт полного выбора Склонностей — иначе цена
      // покупок и возврат за совпавшую выдачу считались бы не по тем данным.
      // На Этапе 3 «Далее»/«Назад» блокируются, пока идёт применение Механики
      // архетипа (в т.ч. пока не отвечены собранные в форму ИЛИ/спец-выборы) —
      // прерывать это на середине означало бы бросить актора частично выданным.
      // На Этапе 5 «Готово» блокируется, пока резолвятся предметы снаряжения.
      nextDisabled: (this.step.id === "characteristics" && !this._aptReady())
        || this._confirmingArchetype,
      finishDisabled: this._confirmingGear,
      backDisabled: this.stepIndex === 0 || this._confirmingArchetype || this._confirmingGear,
      confirmingArchetype: this._confirmingArchetype,
      confirmingGear: this._confirmingGear,
      pendingMechChoices: this.pendingMechChoices.map(r => r.type === "or"
        ? { type: "or", key: r.key, itemName: r.itemName,
            options: r.options.map((o, idx) => ({ idx, label: o.label })) }
        : { type: "spec", key: r.key, skillLabel: r.skillLabel, need: r.need, many: r.need > 1,
            choices: r.choices.map((c, idx) => ({ idx, label: c.display, picked: r.picked.includes(idx) })),
            pickedCount: r.picked.length })
    };
  }

  /**
   * Контекст дропдауна Родного мира для Этапа 1. Обычный
   * `homeworldSheetContext` метит «выбрано» по реально гранту (embedded-
   * предмету) — а мир с Int-зависимым выбором намеренно повисает
   * неприменённым до Этапа 2 (см. _pendingHomeworldKey), поэтому здесь
   * подменяем «выбрано» на отложенный ключ, чтобы селект не откатывался
   * обратно на «— не выбрано —» после выбора игрока.
   */
  _homeworldStepContext() {
    const ctx = homeworldSheetContext(this.actor);
    if (!ctx) return ctx;
    if (this._pendingHomeworldKey) {
      const key = this._pendingHomeworldKey;
      return {
        ...ctx, current: key,
        options: ctx.options.map(o => ({ ...o, selected: o.key === key })),
        deferredNote: "Этот мир даёт выбор специализаций по Интеллекту — уточнится сразу после Этапа 2 («Характеристики»), когда станет известен бонус Интеллекта."
      };
    }
    return ctx;
  }

  // ── Этап 3: Архетип, Умения/Таланты, Раны ────────────────────────────────

  _archetypeStepContext() {
    const sys = this.actor.system;
    const entries = archetypesForRace(sys.race || "human");
    const grouped = {};
    for (const [k, a] of entries) (grouped[a.group || ""] ??= []).push({ key: k, name: a.name, selected: k === sys.archetype });
    const archGroups = Object.entries(grouped).map(([g, opts]) => ({ label: g, opts }));
    const arch = archetypeEntries()[sys.archetype];
    this._ensureTalentLib();
    const { fixed, choices } = this._archTalentChoices();
    return {
      archGroups,
      hasArchetypes: entries.length > 0,
      archKey: sys.archetype || "",
      archDesc: arch?.desc || "",
      archNote: !entries.length
        ? "Для этой расы архетип не выбирается (Аэльдари используют Пути; Сслиты — без архетипа)."
        : "",
      talentFixedNames: fixed.map(e => this._talentNameOf(e)),
      talentChoiceRows: choices.map((c, i) => this._talentChoiceRow(c, i)),
      // Покупка Техночудес/Психосил уже устроена в самой Механике архетипа
      // (kind:"equipment", equipCategoryPack:"psychic-powers"/"tech-powers",
      // бюджет в опыте) и применяется applyArchetype синхронно
      // (SKIP_MECHANICS_HOOK, как у applyRace). Простые ИЛИ/спец-выборы
      // Конструктора (Навык/Талант на выбор) собираются прямо в форму этого
      // шага через withMechCollector — см. pendingMechChoices ниже; они
      // появляются по одному, по мере того как Конструктор до них доходит.
      // Бюджетный Обозреватель компендиумов (Психосилы/Техночудеса/снаряжение
      // по бюджету) коллектор не перехватывает — этому нужен полноценный
      // экран, он остаётся отдельным окном, но теперь корректно дождётся его
      // сама «Далее».
      archPendingNote: (arch && !this.pendingMechChoices.length)
        ? "Если у архетипа есть покупки по бюджету (Психосилы/Техночудеса/снаряжение) — откроется отдельным окном сразу после «Далее»."
        : ""
    };
  }

  async _ensureTalentLib() {
    if (this._talentLib || this._talentLibLoading) return;
    this._talentLibLoading = true;
    try {
      const pack = game.packs.get("warhammer-dbc.talents");
      this._talentLib = pack ? await pack.getDocuments() : [];
    } catch (e) { this._talentLib = []; }
    this._talentLibLoading = false;
    if (this.step.id === "archetype") this.render(false);
  }

  /** Тот же разбор, что в actor-sheet.mjs:_applyStartingTalents, но без диалога — раскладка на fixed/choices. */
  _archTalentChoices() {
    const sys = this.actor.system;
    const archKey = sys.archetype || "";
    if (!archKey) return { fixed: [], choices: [] };
    const { race, arch, sub, past } = resolveCreation({
      raceKey: sys.race, subraceKey: sys.subrace, archKey,
      ynnariPast: sys.ynnariPast, harlequinPast: sys.harlequinPast
    });
    const cultFx = sys.geneSeed?.legion
      ? resolveCultureFx(sys.geneSeed.cultureLegion || sys.geneSeed.legion,
                          sys.geneSeed.cultureChapter || sys.geneSeed.chapter)
      : null;
    const talRaw = [].concat(
      race?.talents ? splitTopLevel(race.talents) : [],
      past?.talents ? splitTopLevel(past.talents) : [],
      sub?.talents  ? splitTopLevel(sub.talents)  : [],
      arch?.talents ? [arch.talents] : [],
      cultFx?.grantTalents || []
    );
    const entries = [];
    for (const r of talRaw) for (const e of splitTopLevel(String(r))) entries.push(e);
    const real = entries.filter(e => !/\d\s*(xp|хр)/i.test(e) && !/талант/i.test(e));

    const fixed = [], choices = [];
    for (const e of real) {
      if (TALENT_CHOICE_SEP.test(e)) {
        choices.push({ type: "or", raw: e, options: e.split(TALENT_CHOICE_SEP).map(s => s.trim()).filter(Boolean) });
      } else {
        const m = e.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
        if (m && /люб/i.test(m[2])) {
          const count = parseInt((m[2].match(/\d+/) || ["1"])[0], 10) || 1;
          choices.push({ type: "wild", raw: e, base: m[1].trim(), count, opts: this._talentSpecOpts(m[1].trim()) });
        } else fixed.push(e);
      }
    }
    return { fixed, choices };
  }

  _talentFind(base) {
    const norm = s => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
    const lib = this._talentLib || [];
    const byEng = new Map(); for (const d of lib) byEng.set(norm(d.name.split("/")[0]), d);
    return byEng.get(norm(base)) || byEng.get(TALENT_ALIAS[norm(base)] || "\0");
  }

  _talentSpecOpts(base) {
    const s = this._talentFind(base)?.system?.specialization || "";
    if (!s || /люб|кажд|для каждого|организац/i.test(s)) return null;
    return s.split(",").map(x => ruSpec(x.trim())).filter(Boolean);
  }

  /** «English (спец.) — Русское» по данным библиотеки, как в старом диалоге выбора. */
  _talentNameOf(raw) {
    const m = String(raw).match(/^(.*?)\s*(\([^)]*\))?\s*$/);
    const base = (m ? m[1] : raw).trim();
    const spec = m && m[2] ? " " + m[2] : "";
    const d = this._talentFind(base);
    if (!d) return String(raw);
    const parts = String(d.name).split("/");
    const ru = parts.length > 1 ? parts[1].trim() : "";
    return ru ? `${base}${spec} — ${ru}` : `${base}${spec}`;
  }

  _talentChoiceRow(c, i) {
    if (c.type === "or") {
      return {
        i, type: "or",
        options: c.options.map(o => ({ value: o, label: this._talentNameOf(o) })),
        picked: this.talentPicks[`${i}:0`] || ""
      };
    }
    return {
      i, type: "wild",
      label: this._talentNameOf(c.base), count: c.count, base: c.base,
      slots: Array.from({ length: c.count }, (_, j) => ({
        j, opts: c.opts, picked: this.talentPicks[`${i}:${j}`] || ""
      }))
    };
  }

  /** Выборы «или»/«любые N» из формы шага → готовые строки-имена для _createTalentsFromList. */
  _resolvedTalentChoices() {
    const { choices } = this._archTalentChoices();
    const result = [];
    choices.forEach((c, i) => {
      if (c.type === "or") {
        const v = this.talentPicks[`${i}:0`];
        if (v) result.push(v);
      } else {
        for (let j = 0; j < c.count; j++) {
          const v = this.talentPicks[`${i}:${j}`];
          if (v) result.push(`${c.base} (${v})`);
        }
      }
    });
    return result;
  }

  /**
   * Собирает ИЛИ/спец-выборы Конструктора в форму шага вместо всплывающих
   * Dialog: каждый вызов кладёт запись в pendingMechChoices и перерисовывает
   * шаг, а промис резолвится только когда сама форма (через _resolveMechChoice)
   * получит от игрока ответ. applyGroupEntries внутри applyArchetype идёт
   * строго последовательно (for…of await), поэтому следующий выбор (если
   * есть) появится в форме только после того, как отвечен предыдущий.
   */
  _mechCollector() {
    // Окно могли закрыть, пока applyArchetype ещё внутри цепочки await —
    // это НЕ отменяет сам промис (JS не умеет отменять чужой await), и
    // следующий выбор Конструктора всё равно попробует прийти в коллектор.
    // Без этой проверки он лёг бы в pendingMechChoices и звал render()
    // закрытого приложения, а его resolve никто и никогда не вызвал бы —
    // Конструктор навсегда завис бы на середине выдачи.
    const push = (row) => this._isClosing
      ? Promise.resolve(row.type === "spec" && row.need > 1 ? [] : null)
      : new Promise(resolve => {
          row.resolve = resolve;
          this.pendingMechChoices.push(row);
          this.render(false);
        });
    return {
      choose: (item, entries) => push({
        type: "or", key: entries.map(e => e.id).join(","),
        itemName: item.name,
        options: entries.map(e => ({ entry: e, label: describeMechEntry(e) }))
      }),
      chooseSpec: (skillLabel, choices, need) => push({
        type: "spec", key: skillLabel + ":" + choices.map(c => c.key).join(","),
        skillLabel, choices, need, picked: []
      })
    };
  }

  /** Ответ на строку из pendingMechChoices — снимает её из очереди и резолвит промис Конструктора. */
  _resolveMechChoice(key, value) {
    const i = this.pendingMechChoices.findIndex(r => r.key === key);
    if (i < 0) return;
    const [row] = this.pendingMechChoices.splice(i, 1);
    row.resolve(value);
    this.render(false);
  }

  /**
   * Закрепляет Этап 3: кладёт архетип предметом (applyArchetype ждёт его
   * Механику СИНХРОННО — характеристики/Таланты/Навыки/снаряжение и покупки
   * по бюджету, включая Психосилы/Техночудеса через kind:"equipment", что бы
   * ГМ ни настроил на вкладке МЕХАНИКА; их диалоги/Обозреватель компендиумов
   * всплывают по очереди, «Далее» ждёт всех), плюс старый текстовый путь
   * (arch.trait/talents/gear, навыки культуры легиона) — тот же набор, что
   * раньше выдавал applyCreation целиком. Бросок Ран —
   * по формуле архетипа, один раз (снимок _wasEmpty.wounds с Этапа 1).
   */
  async _confirmArchetype() {
    const actor = this.actor;
    const sys = actor.system;
    const archKey = sys.archetype || "";
    if (!archKey) return;

    if (!actorArchetypeItem(actor)) {
      this._confirmingArchetype = true;
      try {
        await withMechCollector(this._mechCollector(), () => applyArchetype(actor, archKey));
      } finally {
        this._confirmingArchetype = false;
      }
    }

    const { race, arch } = resolveCreation({
      raceKey: sys.race, subraceKey: sys.subrace, archKey,
      ynnariPast: sys.ynnariPast, harlequinPast: sys.harlequinPast
    });
    const createTraits = (list, source) => actor.sheet?._createTraitsFromList?.(list, source);

    if (arch?.trait) await createTraits([arch.trait], `Архетип: ${arch.name}`);
    if (arch?.grantsImplants) await grantMechanicusImplants(actor);
    else if (arch?.grantsWarPlate) await grantSkitariiWarPlate(actor);

    const flagUpdates = {};
    if (arch?.isPsyker)     flagUpdates["system.isPsyker"]     = true;
    if (arch?.isTechpriest) flagUpdates["system.isTechpriest"] = true;
    if (arch?.psykerClass)  flagUpdates["system.psyker.class"] = arch.psykerClass;
    if (Object.keys(flagUpdates).length) await actor.update(flagUpdates);

    const cultFx = sys.geneSeed?.legion
      ? resolveCultureFx(sys.geneSeed.cultureLegion || sys.geneSeed.legion,
                          sys.geneSeed.cultureChapter || sys.geneSeed.chapter)
      : null;
    // Таланты-развилки уже выбраны прямо в форме шага (talentPicks) — здесь
    // только собираем результат и создаём предметы, без отдельного диалога.
    const { fixed } = this._archTalentChoices();
    const chosen = this._resolvedTalentChoices();
    const srcLabel = `${race?.label || sys.race}${arch ? ` / ${arch.name}` : ""}`;
    if (fixed.length || chosen.length) await actor.sheet?._createTalentsFromList?.([...fixed, ...chosen], srcLabel);
    // Навыки культуры легиона: сам выбор (какой легион/орден/культура) уже
    // сделан на Этапе 1 (селекты вкладки «Записи», те же поля) — здесь только
    // выдача по уже выбранной культуре. Диалог-развилка внутри grantCreationSkills
    // на практике не всплывает: ни в одном grantSkills легиона/ордена нет
    // строки с «или»/«/» (проверено по всем LEGIONS) — оставлен как
    // защитный путь на случай, если ГМ когда-нибудь заведёт такую запись.
    if (cultFx) await grantCreationSkills(actor, { race: { skills: (cultFx.grantSkills || []).join(", ") } });

    // Живая проверка ПОВЕРХ снимка _wasEmpty: снимок берётся один раз на
    // весь мастер, а бросок формулы даёт КАЖДЫЙ РАЗ новое число — без этой
    // проверки повторное подтверждение того же экземпляра Мастера (напр.
    // «Назад» и снова «Далее») перебрасывало бы Раны заново.
    if (this._wasEmpty?.wounds && (actor.system.wounds?.max || 0) === 0) {
      const w = await rollFormula(actor, arch?.wounds, "Стартовые Раны");
      if (w) await actor.update({ "system.wounds.max": w, "system.wounds.value": w });
    }
  }

  // ── Этап 4: Стремления и Уровень стартовой игры ──────────────────────────

  _aspirationsStepContext() {
    const actor = this.actor;
    const sys = actor.system;
    const aspirRaw = Array.isArray(sys.aspirations?.slots) ? sys.aspirations.slots : [];
    const aspirationSlots = ASPIRATION_TABLES.map((t, idx) => {
      const a = aspirRaw[idx];
      const options = aspirationOptions(t.key).map(e => ({ id: e.key, name: e.name, mods: e.mods }));
      if (a && a.custom) return { idx, label: t.label, options, custom: true, id: "", name: a.name || "", mods: a.mods || "" };
      const e = aspirationByKey(a?.id || a);
      return { idx, label: t.label, options, custom: false, id: a?.id || a || "", name: e?.name || "", mods: e?.mods || "" };
    });

    return {
      aspirationSlots,
      startLevels: START_LEVELS.map(l => ({ ...l, selected: l.key === this.startLevelKey })),
      startCap: START_CAP,
      startExtraXp: this.startExtraXp, startExtraInf: this.startExtraInf, startExtraCor: this.startExtraCor,
      startIsAstartes: sys.race === "astartes",
      // Уже применяли Уровень старта на этом персонаже раньше (опыт не пуст) —
      // предупреждаем, а не молча копим бонусы Влияния/Порчи ещё раз поверх.
      startAlreadyApplied: (Number(sys.experience?.total) || 0) > 0
    };
  }

  /**
   * Закрепляет Этап 4: опыт по колонке своей расы, бонусы к Влиянию/Порче —
   * поверх уже брошенных (капается по START_CAP), как в старом Мастере. Не
   * трогает, если опыт уже когда-то выдавался — повторный запуск не должен
   * молча копить бонусы ещё раз.
   */
  async _confirmAspirations() {
    const actor = this.actor;
    const sys = actor.system;
    if ((Number(sys.experience?.total) || 0) > 0) return;

    const start = startLevelValues({
      level: this.startLevelKey, astartes: sys.race === "astartes",
      extraXp: this.startExtraXp, extraInf: this.startExtraInf, extraCor: this.startExtraCor
    });
    if (!start) return;
    const cap = v => Math.max(0, Math.min(START_CAP, Math.round(v)));
    await actor.update({
      "system.experience.total":   start.xp,
      "system.experience.current": start.xp,
      "system.characteristics.inf.base": cap((Number(sys.characteristics?.inf?.base) || 0) + start.infamy),
      "system.corruption.value":   cap((Number(sys.corruption?.value) || 0) + start.corruption)
    });
  }

  // ── Этап 2: Характеристики (метод «Генерация») ──────────────────────────

  _ensureCharState() {
    if (this.charSets) return;
    const bonus = creationBonusRolls(this.actor.system.race);
    this.charSets = [rollCharSet(bonus), rollCharSet(bonus)];
    this.activeSetIdx = 0;
    this.charAssign = {};
    this.armedVi = null;
    this.pickedApts = new Set(this.actor.system.aptitudes || []);
  }

  /** База характеристик расы+Прошлого+субрасы — БЕЗ архетипа: тот выбирается только на Этапе 3. */
  _charSum() {
    const sys = this.actor.system;
    const race = raceDef(sys.race);
    const pastKey = sys.race === "ynnari" ? sys.ynnariPast : sys.race === "harlequin" ? sys.harlequinPast : "";
    const past = pastKey ? raceDef(pastKey) : null;
    const sub  = subracesOf(sys.race).find(s => s.key === sys.subrace) || null;
    return creationCharSum({ race, past, arch: null, sub });
  }

  _charValues() {
    const vals = this.charSets[this.activeSetIdx]?.vals || [];
    const out = {};
    for (const k of CREATION_ROLL_CHARS) {
      const vi = this.charAssign[k];
      out[k] = (vi != null) ? (vals[vi] ?? 0) : 0;
    }
    return out;
  }

  _aptReady() {
    return APT_CHAR_KEYS.filter(k => this.pickedApts.has(k)).length === APT_PICK.char
        && APT_OTHER_KEYS.filter(k => this.pickedApts.has(k)).length === APT_PICK.other;
  }

  _charStepContext() {
    this._ensureCharState();
    const sum  = this._charSum();
    const vals = this.charSets[this.activeSetIdx]?.vals || [];
    const used = new Set(Object.values(this.charAssign).filter(v => v != null));

    const aptRow = (keys, want) => {
      const on = keys.filter(k => this.pickedApts.has(k)).length;
      return {
        want, on,
        full: on === want,
        items: keys.map(k => ({
          key: k, label: APTITUDES[k], checked: this.pickedApts.has(k),
          disabled: !this.pickedApts.has(k) && on >= want
        }))
      };
    };

    return {
      charSets: this.charSets.map((s, i) => ({ index: i, active: i === this.activeSetIdx, sum: s.sum, vals: s.vals })),
      charChips: vals.map((v, vi) => ({ vi, val: v, armed: vi === this.armedVi }))
        .filter(c => !used.has(c.vi)),
      charSlots: CREATION_ROLL_CHARS.map(k => {
        const base = sum[k] || 0;
        const vi = this.charAssign[k];
        const has = vi != null;
        const val = has ? (vals[vi] ?? 0) : 0;
        return { key: k, abbr: CHARACTERISTICS[k].abbr, label: CHARACTERISTICS[k].label, base, val, has, total: base + val, vi };
      }),
      aptChar:  aptRow(APT_CHAR_KEYS, APT_PICK.char),
      aptOther: aptRow(APT_OTHER_KEYS, APT_PICK.other),
      aptReady: this._aptReady()
    };
  }

  _assignChar(k, vi) {
    if (vi == null || Number.isNaN(vi)) return;
    for (const c of CREATION_ROLL_CHARS) if (c !== k && this.charAssign[c] === vi) delete this.charAssign[c];
    this.charAssign[k] = vi;
    this.armedVi = null;
  }

  _toggleApt(key) {
    const group = APT_CHAR_KEYS.includes(key) ? APT_CHAR_KEYS : APT_OTHER_KEYS;
    const want  = group === APT_CHAR_KEYS ? APT_PICK.char : APT_PICK.other;
    if (this.pickedApts.has(key)) { this.pickedApts.delete(key); return; }
    const on = group.filter(k => this.pickedApts.has(k)).length;
    if (on < want) this.pickedApts.add(key);
  }

  /**
   * Закрепляет Этап 2: итоговая база = сумма расы/Прошлого/субрасы (без
   * архетипа — он ещё не выбран) + раскиданный бросок, но только в поля,
   * пустые ДО Мастера (снимок _wasEmpty из _confirmOrigin). Бесчестие кидает
   * формулу «19+1d5» (или расовую) тем же правилом, что и старый Мастер.
   */
  async _confirmCharacteristics() {
    const actor = this.actor;
    if (!this._aptReady()) return false;
    if (this._wasEmpty) {
      const sum = this._charSum();
      const rolls = this._charValues();
      const updates = { "system.aptitudes": [...this.pickedApts] };
      for (const k of CREATION_ROLL_CHARS) {
        if (this._wasEmpty[k]) updates[`system.characteristics.${k}.base`] = (sum[k] || 0) + (rolls[k] || 0);
      }
      await actor.update(updates);

      // Та же живая проверка поверх снимка, что и у Ран — бросок не должен
      // повториться при повторном подтверждении того же шага.
      if (this._wasEmpty.inf && (actor.system.characteristics?.inf?.base || 0) === 0) {
        const infv = await rollFormula(actor, startingInfamyFormula(sum.inf, true), "Стартовое Бесчестие");
        if (infv) await actor.update({ "system.characteristics.inf.base": infv });
      }
    } else {
      await actor.update({ "system.aptitudes": [...this.pickedApts] });
    }
    return true;
  }

  // ── Этап 5: Снаряжение (текстовые arch.gear/race.gear и т.п.) ───────────

  /**
   * Разбивка варианта на выбор с учётом вложенных скобок — тот же приём,
   * что был у отключённого grantCreationGear, БЕЗ «;»: в реальных текстах
   * gear «;» — доп. разделитель ВЕРХНЕГО уровня (как запятая), а не «или»
   * (см. запись фонового агента про конвертацию снаряжения в Механику —
   * пример «Splinter Swarm Pistol; Loud Hailer (Best.Q); Translator Rod» —
   * это три РАЗНЫХ предмета «И», не выбор «ИЛИ»). Старый grantCreationGear
   * трактовал «;» как выбор — это унаследованная неточность, здесь не
   * повторяем.
   */
  _splitGearChoice(str) {
    const out = []; let d = 0, cur = "", i = 0;
    while (i < str.length) {
      const ch = str[i];
      if (ch === "(") d++; else if (ch === ")") d--;
      if (d === 0 && ch === "/") { out.push(cur); cur = ""; i++; continue; }
      const m = (d === 0) ? str.slice(i).match(/^\s+или\s+/) : null;
      if (m) { out.push(cur); cur = ""; i += m[0].length; continue; }
      cur += ch; i++;
    }
    if (cur.trim()) out.push(cur);
    // Хвостовая «,» перед следующим «или» — часть той же цепочки выбора
    // («A или B, или C»), не разделитель вариантов; чистим её здесь, а не
    // на входе, чтобы не путать с «,» из _splitGearTopLevel.
    return out.map(s => s.trim().replace(/,+$/, "").trim()).filter(Boolean);
  }

  /**
   * Разбивка верхнего уровня на отдельные предметы: «,» и «;» — оба уровня
   * «И», с учётом скобок. Исключение: «,» ПЕРЕД «или» — это не новый предмет,
   * а хвост той же цепочки выбора (естественный русский список «A или B, или
   * C» = «A или B или C») — реальный текст расы Друкхари содержит именно
   * такую запись («Xenomesh Armour (Good.Q) или Kabalite Armour, или
   * Wychsuit»); без этого исключения «или Wychsuit» отрывался бы отдельным
   * лже-предметом верхнего уровня, а Wychsuit пропадал бы из выбора брони.
   */
  _splitGearTopLevel(str) {
    const out = []; let d = 0, cur = "";
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "(") d++; else if (ch === ")") d = Math.max(0, d - 1);
      if ((ch === "," || ch === ";") && d === 0) {
        if (ch === "," && /^\s*или\s+/.test(s.slice(i + 1))) { cur += ch; continue; }
        out.push(cur); cur = "";
      }
      else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out.map(s => s.trim()).filter(Boolean);
  }

  /** Раскладка текста снаряжения на layout (фикс/выбор) + сами группы выбора. Без резолва в предметы. */
  _gearLayout() {
    const sys = this.actor.system;
    const { race, arch, sub, past } = resolveCreation({
      raceKey: sys.race, subraceKey: sys.subrace, archKey: sys.archetype,
      ynnariPast: sys.ynnariPast, harlequinPast: sys.harlequinPast
    });
    const raw = [arch?.gear, race?.gear, past?.gear, sub?.gear].filter(Boolean).join(", ");
    const entries = raw.trim() ? this._splitGearTopLevel(raw) : [];
    const layout = [], choiceDefs = [];
    for (const e of entries) {
      const parts = this._splitGearChoice(e);
      if (parts.length > 1) { layout.push({ ci: choiceDefs.length }); choiceDefs.push(parts); }
      else layout.push({ fixed: e });
    }
    return { layout, choiceDefs, isAstartes: sys.race === "astartes" };
  }

  _gearStepContext() {
    const { layout, choiceDefs, isAstartes } = this._gearLayout();
    return {
      gearFixed: layout.filter(x => x.fixed != null).map(x => x.fixed),
      gearChoices: choiceDefs.map((opts, ci) => ({
        ci, options: opts, picked: this.gearPicks[ci] ?? opts[0]
      })),
      gearIsAstartes: isAstartes,
      gearDone: this._gearDone,
      hasGear: layout.length > 0 || isAstartes
    };
  }

  /**
   * Резолвит выбранные строки снаряжения в реальные предметы: сперва точное
   * совпадение имени в компендиумах (без нечёткого угадывания — та часть
   * старого grantCreationGear признана ненадёжной и сюда сознательно не
   * перенесена), а для всего, что не нашлось один-в-один, спрашивает игрока
   * через Обозреватель компендиумов — по одному, по очереди.
   */
  async _confirmGear() {
    const actor = this.actor;
    if (this._gearDone) return;
    this._confirmingGear = true;
    this.render(false);
    try {
      const { layout, choiceDefs } = this._gearLayout();
      const resolved = layout.map(x => x.fixed != null ? x.fixed : (this.gearPicks[x.ci] ?? choiceDefs[x.ci][0]));

      const packNames = ["weapons", "armor", "gear", "ammunition", "shields", "tools", "armour-systems"];
      const packs = packNames.map(p => game.packs.get(`warhammer-dbc.${p}`)).filter(Boolean);
      const index = new Map();
      const norm = s => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      for (const pk of packs) for (const e of await pk.getIndex()) {
        for (const part of String(e.name).split("/")) { const k = norm(part); if (k && !index.has(k)) index.set(k, { pack: pk, id: e._id }); }
      }
      const clean = txt => String(txt).replace(/^\s*\d+×?\s*/, "").replace(/^l\.\s*/i, "").replace(/\([^)]*\)/g, "")
        .replace(/\bдо\s*R\s*\d+\b/gi, "").replace(/\b(Best|Good|Common|Poor)\.?Q\b/gi, "").trim();

      // done[r] — по КОНКРЕТНОЙ строке (индексу resolved), не общим флагом:
      // иначе один успешный ручной выбор красил бы «сделано» и все строки,
      // которые игрок в Обозревателе просто закрыл крестиком (пропустил).
      const toCreate = [];
      const done = resolved.map(() => false);
      const manualIdx = [];
      resolved.forEach((r, i) => {
        if (/\bлюб/i.test(r) || /модификац|доз|магазин|\bR\d\b\s*$/i.test(r)) return; // абстрактное — вручную, как раньше
        const k = norm(clean(r));
        const ref = k ? index.get(k) : null;
        if (ref) { toCreate.push({ i, ref }); return; }
        manualIdx.push(i);
      });
      if (toCreate.length) {
        const docs = await Promise.all(toCreate.map(({ ref }) => ref.pack.getDocument(ref.id)));
        const objs = [];
        toCreate.forEach(({ i }, idx) => { if (docs[idx]) { objs.push(docs[idx].toObject()); done[i] = true; } });
        if (objs.length) await actor.createEmbeddedDocuments("Item", objs);
      }

      // Точных совпадений не нашлось — спрашиваем игрока по очереди, а не
      // угадываем: тот же Обозреватель, что и для бюджетных покупок.
      for (const i of manualIdx) {
        const uuid = await openCompendiumBrowser(false, { count: 1, prompt: `Стартовое снаряжение: ${resolved[i]}` });
        if (!uuid) continue;
        const doc = await fromUuid(uuid).catch(() => null);
        if (doc) { await actor.createEmbeddedDocuments("Item", [doc.toObject()]); done[i] = true; }
      }

      const rows = resolved.map((r, i) =>
        `<li${done[i] ? ' style="color:#4dffa6;"' : ''}>${done[i] ? "✓ " : "▫ "}${esc(r)}</li>`
      ).join("");
      ChatMessage.create({
        content: `<div class="wh-roll-result"><div class="roll-header">🎒 Стартовое снаряжение — ${esc(actor.name)}</div>
          <ul style="margin:4px 0;padding-left:16px;font-size:.9em;">${rows || "<li>—</li>"}</ul>
          <div style="font-size:.8em;opacity:.7;margin-top:4px;">✓ — добавлено на лист. ▫ — не выбрано (пропущено/абстрактно) — выдайте вручную.</div></div>`,
        whisper: ChatMessage.getWhisperRecipients?.("GM") || [],
        speaker: { alias: actor.name }
      });

      this._gearDone = true;
    } finally {
      this._confirmingGear = false;
      this.render(false);
    }
  }

  activateListeners(html) {
    super.activateListeners(html);
    const el = html[0] ?? html;
    const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach(n => n.addEventListener(ev, fn));

    on("[data-action='wizBack']",   "click", () => { if (!this._confirmingArchetype) this._goStep(this.stepIndex - 1); });
    on("[data-action='wizNext']",   "click", () => this._onNext());
    on("[data-action='wizFinish']", "click", async () => {
      if (this._confirmingGear) return;
      if (this.step.id === "gear" && !this._gearDone) await this._confirmGear();
      // _confirmGear() кончает своим render(false) (снять «Применяется…»),
      // который сам не awaited — вызванный сразу вслед close() иногда
      // проигрывал этой гонке: рендер из finally долетал ПОСЛЕ close() и
      // окно фактически оставалось открытым. Даём кадру осесть перед close().
      await new Promise(r => setTimeout(r, 0));
      this.close();
    });
    on(".wiz-gear-sel", "change", ev => {
      this.gearPicks[Number(ev.currentTarget.dataset.ci)] = ev.currentTarget.value;
    });

    on(".wiz-name-inp",  "change", ev => this.actor.update({ name: ev.currentTarget.value || "Новый персонаж" }));
    on(".wiz-race-sel",  "change", ev => this.actor.update({ "system.race": ev.currentTarget.value, "system.subrace": "" }).then(() => this.render(false)));
    on(".wiz-subrace-sel", "change", ev => this.actor.update({ "system.subrace": ev.currentTarget.value }));
    on(".wiz-align-sel", "change", ev => this.actor.update({ "system.alignment": ev.currentTarget.value }));

    on(".wiz-legion-sel", "change", ev => this.actor.update({ "system.geneSeed.legion": ev.currentTarget.value, "system.geneSeed.chapter": "" }).then(() => this.render(false)));
    on(".wiz-chapter-sel", "change", ev => this.actor.update({ "system.geneSeed.chapter": ev.currentTarget.value }));
    on(".wiz-cult-sel",    "change", ev => this.actor.update({ "system.geneSeed.cultureLegion": ev.currentTarget.value }));

    on(".wiz-hw-sel", "change", ev => {
      const key = ev.currentTarget.value;
      if (key && needsIntBonusChoice(key)) {
        // Диалог выбора специализаций отложен до Этапа 2 (см. _onNext) —
        // на Этапе 1 Интеллект ещё не посчитан, «доступно» показало бы 0.
        this._pendingHomeworldKey = key;
        this.render(false);
        return;
      }
      this._pendingHomeworldKey = null;
      applyHomeworld(this.actor, key).then(() => this.render(false));
    });
    on(".wiz-dv-sel", "change", ev => applyDivination(this.actor, ev.currentTarget.value).then(() => this.render(false)));
    // Фракция — переиспользуем как есть (дроп + кнопка «＋», Обозреватель компендиумов).
    activateFactionFieldListeners(html, this.actor);

    on(".wiz-world-sel", "change", ev => this.actor.update({ "system.world": ev.currentTarget.value }));
    on(".wiz-band-sel",  "change", ev => this.actor.update({ "system.band": ev.currentTarget.value }));
    on(".wiz-drukhari-faction-sel", "change", ev => this.actor.update({ "system.drukhariFaction": ev.currentTarget.value }));
    on(".wiz-drukhari-district-sel", "change", ev => this.actor.update({ "system.drukhariDistrict": ev.currentTarget.value }));
    on(".wiz-masque-sel", "change", ev => this.actor.update({ "system.harlequinMasque": ev.currentTarget.value }));
    on(".wiz-ynnari-past-sel",     "change", ev => this.actor.update({ "system.ynnariPast": ev.currentTarget.value }).then(() => this.render(false)));
    on(".wiz-harlequin-past-sel",  "change", ev => this.actor.update({ "system.harlequinPast": ev.currentTarget.value }).then(() => this.render(false)));

    // ── Этап 2: наборы, раскладка по слотам (клик и drag&drop), Склонности ──
    on(".wiz-set", "click", ev => {
      if (ev.target.closest(".wiz-set-reroll")) return;
      const si = Number(ev.currentTarget.dataset.set);
      if (si === this.activeSetIdx) return;
      this.activeSetIdx = si;
      this.charAssign = {};
      this.armedVi = null;
      this.render(false);
    });
    on(".wiz-set-reroll", "click", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const si = Number(ev.currentTarget.dataset.set);
      this.charSets[si] = rollCharSet(creationBonusRolls(this.actor.system.race));
      if (si === this.activeSetIdx) { this.charAssign = {}; this.armedVi = null; }
      this.render(false);
    });
    on(".wiz-chip", "click", ev => {
      const vi = Number(ev.currentTarget.dataset.vi);
      this.armedVi = (this.armedVi === vi) ? null : vi;
      this.render(false);
    });
    on(".wiz-slot", "click", ev => {
      const k = ev.currentTarget.dataset.char;
      if (this.armedVi != null) { this._assignChar(k, this.armedVi); this.render(false); return; }
      if (this.charAssign[k] != null) { delete this.charAssign[k]; this.render(false); }
    });
    on(".wiz-chip[draggable], .ws-chip[draggable]", "dragstart", ev => {
      ev.dataTransfer.setData("text/plain", String(ev.currentTarget.dataset.vi));
      ev.dataTransfer.effectAllowed = "move";
    });
    on(".wiz-slot", "dragover", ev => ev.preventDefault());
    on(".wiz-slot", "drop", ev => {
      ev.preventDefault();
      this._assignChar(ev.currentTarget.dataset.char, Number(ev.dataTransfer.getData("text/plain")));
      this.render(false);
    });
    on(".wiz-chips-pool", "dragover", ev => ev.preventDefault());
    on(".wiz-chips-pool", "drop", ev => {
      ev.preventDefault();
      const vi = Number(ev.dataTransfer.getData("text/plain"));
      const k = CREATION_ROLL_CHARS.find(c => this.charAssign[c] === vi);
      if (k) { delete this.charAssign[k]; this.render(false); }
    });
    on(".wiz-char-auto", "click", ev => {
      ev.preventDefault();
      this.charAssign = {};
      CREATION_ROLL_CHARS.forEach((k, i) => { this.charAssign[k] = i; });
      this.armedVi = null;
      this.render(false);
    });
    on(".wiz-char-clear", "click", ev => {
      ev.preventDefault();
      this.charAssign = {}; this.armedVi = null;
      this.render(false);
    });
    on(".wiz-apt", "change", ev => { this._toggleApt(ev.currentTarget.value); this.render(false); });

    // ── Этап 3: ИЛИ/спец-выборы Конструктора, собранные в форму шага ──
    on(".wiz-mech-or-sel", "change", ev => {
      const key = ev.currentTarget.dataset.key;
      const row = this.pendingMechChoices.find(r => r.key === key);
      if (row) this._resolveMechChoice(key, row.options[Number(ev.currentTarget.value)]?.entry ?? null);
    });
    on(".wiz-mech-spec-radio", "change", ev => {
      const key = ev.currentTarget.dataset.key;
      const row = this.pendingMechChoices.find(r => r.key === key);
      if (row) this._resolveMechChoice(key, row.choices[Number(ev.currentTarget.value)] ?? null);
    });
    on(".wiz-mech-spec-check", "change", ev => {
      const key = ev.currentTarget.dataset.key;
      const idx = Number(ev.currentTarget.dataset.idx);
      const row = this.pendingMechChoices.find(r => r.key === key);
      if (!row) return;
      if (ev.currentTarget.checked) { if (!row.picked.includes(idx)) row.picked.push(idx); }
      else row.picked = row.picked.filter(i => i !== idx);
      this.render(false);
    });
    on(".wiz-mech-spec-confirm", "click", ev => {
      const key = ev.currentTarget.dataset.key;
      const row = this.pendingMechChoices.find(r => r.key === key);
      if (row) this._resolveMechChoice(key, row.picked.map(i => row.choices[i]));
    });
    on(".wiz-mech-skip", "click", ev => {
      const many = ev.currentTarget.dataset.many === "1";
      this._resolveMechChoice(ev.currentTarget.dataset.key, many ? [] : null);
    });

    // ── Этап 3: выбор архетипа + Таланты-развилки прямо в форме шага ──
    on(".wiz-arch-sel", "change", ev => {
      this.talentPicks = {};
      this.actor.update({ "system.archetype": ev.currentTarget.value }).then(() => this.render(false));
    });
    on(".wiz-talent-pick", "change", ev => {
      const { ci, cj } = ev.currentTarget.dataset;
      const v = ev.currentTarget.value.trim();
      if (v) this.talentPicks[`${ci}:${cj}`] = v; else delete this.talentPicks[`${ci}:${cj}`];
    });

    // ── Этап 4: Стремления (переиспользуем как есть) + Уровень стартовой игры ──
    activateAspirationListeners(html, this.actor);
    on(".wiz-start-level", "change", ev => { this.startLevelKey = ev.currentTarget.value; this.render(false); });
    on(".wiz-start-xp",  "change", ev => { this.startExtraXp  = parseInt(ev.currentTarget.value)  || 0; });
    on(".wiz-start-inf", "change", ev => { this.startExtraInf = parseInt(ev.currentTarget.value) || 0; });
    on(".wiz-start-cor", "change", ev => { this.startExtraCor = parseInt(ev.currentTarget.value) || 0; });
  }

  _goStep(i) {
    this.stepIndex = Math.max(0, Math.min(WIZARD_STEPS.length - 1, i));
    this.render(false);
  }

  /**
   * Закрытие окна с зависшими выборами Конструктора не должно морозить их
   * промисы навечно — ни уже лежащие в pendingMechChoices, ни те, что
   * попросятся у коллектора ПОСЛЕ закрытия (applyArchetype всё ещё в
   * работе, JS не отменяет чужой await): _isClosing переводит _mechCollector
   * в режим «пропустить» для всех последующих запросов тоже.
   */
  async close(options) {
    this._isClosing = true;
    for (const row of this.pendingMechChoices.splice(0)) row.resolve(row.type === "spec" && row.need > 1 ? [] : null);
    for (const { hook, id } of this._factionHookIds.splice(0)) Hooks.off(hook, id);
    return super.close(options);
  }

  async _onNext() {
    if (this._confirmingArchetype) return; // защита от повторного клика, пока ждём Конструктор
    if (this.step.id === "origin") await this._confirmOrigin();
    if (this.step.id === "characteristics") {
      const ok = await this._confirmCharacteristics();
      if (!ok) { ui.notifications?.warn("Выберите Склонности — ровно 4 Характеристики и 4 прочих."); return; }
      // Родной мир с Int-зависимым выбором специализаций (см. Этап 1) —
      // применяем именно сейчас, Интеллект уже посчитан.
      if (this._pendingHomeworldKey) {
        const key = this._pendingHomeworldKey;
        this._pendingHomeworldKey = null;
        await applyHomeworld(this.actor, key);
      }
    }
    if (this.step.id === "archetype") await this._confirmArchetype();
    if (this.step.id === "aspirations") await this._confirmAspirations();
    this._goStep(this.stepIndex + 1);
  }

  /**
   * Закрепляет выбор Этапа 1: раса/субраса/легион/Прошлое были только
   * зеркальными полями (`system.race` и т.п.) — здесь они превращаются в
   * настоящие выдачи (embedded-предметы, Черты, характеристики расы), как
   * при нажатии «Применить» в шапке листа. Родной мир и Предсказание уже
   * применены — их дропдауны пишут сразу по выбору, как и на самом листе.
   */
  async _confirmOrigin() {
    const actor = this.actor;
    const sys = actor.system;
    const createTraits = (list, source) => actor.sheet?._createTraitsFromList?.(list, source);

    // Снимок ДО applyRace: та пишет расовую часть суммы в те же поля, и без
    // снимка Этап 2 больше не отличил бы «персонаж только создаётся» от
    // «Мастер просто перезапустили на уже развитом персонаже».
    if (!this._wasEmpty) {
      const chars = actor.system.characteristics;
      this._wasEmpty = {};
      for (const k of [...CREATION_ROLL_CHARS, "inf"]) this._wasEmpty[k] = (chars[k]?.base || 0) === 0;
      this._wasEmpty.wounds = (actor.system.wounds?.max || 0) === 0;
    }

    if (sys.race && !actorRaceItem(actor)) await applyRace(actor, sys.race);
    if (sys.subrace && !actorSubraceItem(actor)) await applySubrace(actor, sys.subrace);
    if (sys.race === "astartes" && sys.geneSeed?.legion) await applyLegion(actor, { createTraits });
    if (sys.race === "ynnari" && sys.ynnariPast) await applyYnnari(actor, { createTraits });
    if (sys.race === "harlequin" && sys.harlequinPast) await applyHarlequin(actor, { createTraits });

    // Азуриане — псайкеры (трейт Psyker, «Древнее Мастерство»); то же для
    // Иннари/Арлекина с Прошлым Азуриан. Флаг зависит от расы, а не от
    // архетипа — потому и здесь, а не в _confirmArchetype.
    const pastKey = sys.race === "ynnari" ? sys.ynnariPast : sys.race === "harlequin" ? sys.harlequinPast : "";
    if (sys.race === "azuriane" || pastKey === "azuriane") await actor.update({ "system.isPsyker": true });
  }
}

export function openCharacterWizard(actor) {
  if (!actor) return null;
  const app = new CharacterWizard(actor);
  app.render(true);
  return app;
}
