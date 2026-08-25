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
import { BODY_TYPES }            from "../constants/body-map.mjs";
import { raceGroupList, subracesOf, raceDef } from "./race-library.mjs";
import { applyRace, applySubrace, applyLegion, applyYnnari, applyHarlequin,
         actorRaceItem, actorSubraceItem }    from "./races.mjs";
import { buildLegionOptions, buildChapterOptions,
         buildCultureLegionOptions }          from "../constants/legions.mjs";
import { applyHomeworldPicks, homeworldSheetContext, needsIntBonusChoice, rollRandomHomeworldKey,
         homeworldChoiceBlocksHtml, wireHomeworldChoiceBlocks, readHomeworldChoicePicks } from "./homeworlds.mjs";
import { HOMEWORLD_BY_KEY, hasChoices as homeworldHasChoices } from "../constants/homeworlds.mjs";
import { applyDivinationPicks, divinationSheetContext, rollRandomDivinationKey } from "./divinations.mjs";
import { DIVINATION_BY_KEY, hasChoices as divinationHasChoices } from "../constants/divinations.mjs";
import { grantChoiceBlocksHtml, wireGrantChoiceBlocks, readGrantChoicePicks } from "./origin-shared.mjs";
import { characterContext }      from "../sheets/character-context.mjs";
import { CHARACTERISTICS, APTITUDES } from "../constants/characteristics.mjs";
import { CREATION_ROLL_CHARS, creationBonusRolls, rollCharSet, creationCharSum,
         rollFormula, APT_CHAR_KEYS, APT_OTHER_KEYS, APT_PICK, resolveCreation,
         grantCreationSkills, grantMechanicusImplants, grantMechanicumImplantsTrait,
         grantSkitariiWarPlate, ruSpec } from "./creation.mjs";
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
import { EQUIP_SHOP_ROWS, EQUIP_SHOP_ROW_BY_KEY, EQUIP_SHOP_PACKS, equipPointsTotal, equipPointsLeft,
         canAffordRow, startingAmmoQuantity, SACRIFICE_MOD_COUNT, SACRIFICE_MOD_MAX_AVAILABILITY }
  from "../rules/equip-shop.mjs";
import { ITEM_QUALITY_LIST, capUpgradeQuality, normQuality } from "../constants/quality.mjs";

// Текст расы Астартес («Power Armour Mk III-VII» в race.gear) называет
// ДИАПАЗОН марок, а не одну фиксированную вещь — игрок выбирает одну марку
// внутри диапазона. Имена — ТОЧНЫЕ имена предметов компендиума
// warhammer-dbc.armor (Астартес/Броня/Силовая), сверено с пользователем по
// реальным uuid; порядок — хронологический (по номеру марки), нужен для
// вырезания диапазона «от…до». Держим здесь, а не в constants/, — нужен
// только этому разбору текста снаряжения.
const POWER_ARMOUR_MARKS = [
  { n: "II",   name: "Мк II Крестовый Поход" },
  { n: "III",  name: "Мк III Железный" },
  { n: "IV",   name: "Мк IV Максимус" },
  { n: "V",    name: "Мк V Ереси" },
  { n: "VI",   name: "Мк VI Корвус" },
  { n: "VII",  name: "Мк VII Аквила" },
  { n: "VIII", name: "Мк VIII Странник" },
  { n: "X",    name: "Мк X Примарис" }
];

// «N Стандартные системы» в race.gear Астартес — выбор N штук ИЗ КОНКРЕТНОЙ
// папки компендиума warhammer-dbc.armour-systems (id папки постоянен, как и
// любой id Foundry, сверен с пользователем), а не один произвольный предмет.
const STANDARD_SYSTEMS_FOLDER = "PJGdkJLkUXdx2JTp";

// «L. <Категория>» в gear-тексте (см. _matchLegionCategoryGear) — категория
// текста → id папки компендиума warhammer-dbc.weapons. Проверено на
// «Power Weapon» → «Имперское/Рукопашное/Силовое» (id сверен по packs-src).
// Новую категорию добавлять сюда же строкой, без смены разбора текста.
const LEGION_CATEGORY_FOLDERS = {
  "power weapon": "x3vbtW2ZuzQfcPFG"
};

// Те же типы, что STACKABLE_TYPES в compendium-browser.mjs (quantity вместо N
// раздельных копий) — свой список здесь, а не импорт: тот приватный модулю.
const EQUIP_STACKABLE_TYPES = new Set(["weapon", "gear", "ammo", "drug", "tool"]);

/** Следующая ступень Качества вверх по ITEM_QUALITY_LIST; на «Высшем» и выше остаётся на месте (не выпрыгивает в Arts.Q апгрейдом). */
function nextQuality(q) {
  const i = ITEM_QUALITY_LIST.indexOf(q);
  if (i < 0 || i === ITEM_QUALITY_LIST.length - 1) return q;
  return ITEM_QUALITY_LIST[i + 1];
}

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
    // Бросок Стартового Бесчестия отыгран этой сессией Мастера — см.
    // _confirmCharacteristics: живая проверка "characteristics.inf.base===0"
    // для защиты от повторного броска не годится (raceCharsUpdate внутри
    // applyRace на Этапе 1 УЖЕ пишет расовую базу в то же поле, напр. 19 у
    // Астартес, — бросок выше неё молча ни разу не срабатывал, wdbc-31b).
    this._infamyRolled = false;
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
    // Очки Снаряжения (стр. 24) — пул Inf.b + ручной бонус ГМа, тратится по
    // фиксированной таблице (module/rules/equip-shop.mjs) кнопками прямо на
    // Этапе 5, независимо от текстового снаряжения Расы/Архетипа выше.
    // spent — сколько уже потрачено этой сессией Мастера (не переживает
    // закрытие/переоткрытие, как и остальное состояние шагов).
    this._equipSpent = 0;
    this._equipBonusPoints = 0;
    // Пока идёт одна покупка (Обозреватель компендиумов/диалог выбора уже
    // полученного предмета) — блокируем остальные кнопки лавки, тот же приём,
    // что у _confirmingGear.
    this._confirmingEquipShop = false;
    // Родной мир с выбором «N специализаций = Int.b×2» (Исследовательская
    // станция) нельзя применить прямо на Этапе 1 — Интеллект появляется
    // только на Этапе 2, диалог показал бы «доступно 0». Ключ мира копится
    // здесь и по-настоящему применяется по подтверждению Этапа 2 (см.
    // _onNext), когда Int.b уже посчитан.
    this._pendingHomeworldKey = null;
    // Строки выбора Родного мира (Hatred/Peer/etc, «Общие знания» и т.п.) —
    // раньше показывались всплывающим Dialog (promptChoices, apps/homeworlds.mjs),
    // теперь инлайн в форме шага, тем же принципом, что у Расы/Архетипа/
    // Стремлений. factionTargets — asyncные результаты Обозревателя для
    // пикера цели (wireTargetChoice, apps/target-choice.mjs), их DOM не
    // хранит, поэтому переживают перерисовку только на this.
    this._hwTargetState = { factionTargets: {} };
    // Предсказание с выбором (напр. «Будь благом братьям и погибелью
    // врагам» — Hatred+Peer) — та же инлайн-строка вместо Dialog, отдельное
    // состояние от Родного мира (оба могут ждать ответа одновременно).
    this._pendingDivinationKey = null;
    this._dvTargetState = { factionTargets: {} };
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
      raceChosen: !!sys.race,
      hasSubrace: subraceOpts.length > 0,
      isAstartes,
      // Телосложение (та же вкладка «ЗАПИСИ», см. character-context.mjs) —
      // задаёт маски силуэта на вкладке «ТЕЛО»; у Астартес выбора нет, они
      // всегда мужчины (см. isAstartes-гейт в самом шаблоне).
      bodyTypes: Object.entries(BODY_TYPES).map(([key, label]) =>
        ({ key, label, selected: (sys.bodyType || "male") === key })),
      legionOptions:  isAstartes ? buildLegionOptions(sys.geneSeed?.legion || "") : "",
      chapterOptions: isAstartes ? buildChapterOptions(sys.geneSeed?.legion || "", sys.geneSeed?.chapter || "") : "",
      cultureOptions: isAstartes ? buildCultureLegionOptions(sys.geneSeed?.cultureLegion || "") : "",
      // Культура от банды/ордена — тот же выбор, что и на листе (Заметки,
      // hasCultureOverride в sheet-helpers.mjs), сюда раньше не был перенесён:
      // Мастер предлагал культуру только на уровне легиона целиком (wdbc-k8p).
      hasCultureOverride: isAstartes && !!sys.geneSeed?.cultureLegion,
      cultureChapterOptions: isAstartes
        ? buildChapterOptions(sys.geneSeed?.cultureLegion || "", sys.geneSeed?.cultureChapter || "") : "",
      alignment: sys.alignment || "loyalist",

      isAeldari: cc.isAeldari, isYnnari: cc.isYnnari, isHarlequin: cc.isHarlequin, isDrukhari: cc.isDrukhari,
      showWorldOrigin: cc.showWorldOrigin,
      worldOptions: cc.worldOptions, bandOptions: cc.bandOptions,
      drukhariFactionOptions: cc.drukhariFactionOptions, drukhariDistrictOptions: cc.drukhariDistrictOptions,
      masqueOptions: cc.masqueOptions,
      ynnariPastOptions: cc.ynnariPastOptions, harlequinPastOptions: cc.harlequinPastOptions,
      ynnariPast: sys.ynnariPast || "", harlequinPast: sys.harlequinPast || "",

      homeworld:  this._homeworldStepContext(),
      homeworldChoice: this._homeworldChoiceContext(),
      divination: this._divinationStepContext(),
      divinationChoice: this._divinationChoiceContext(),
      ...actorFactionsContext(actor),

      ...(this.step.id === "characteristics" ? this._charStepContext() : {}),
      ...(this.step.id === "archetype" ? this._archetypeStepContext() : {}),
      ...(this.step.id === "aspirations" ? this._aspirationsStepContext() : {}),
      ...(this.step.id === "gear" ? this._gearStepContext() : {}),
      // «Далее» с Этапа 2 ждёт полного выбора Склонностей — иначе цена
      // покупок и возврат за совпавшую выдачу считались бы не по тем данным.
      // На Этапе 3 «Далее» ЗАБЛОКИРОВАНА, только пока есть строки выбора без
      // ответа (или конфликт между строками — см. _allMechChoicesPicked), ЛИБО
      // пока applyArchetype молча довершает что-то без вопросов (бюджетная
      // покупка и т.п.) — сами строки выбора кнопку не блокируют, отвечать на
      // них и жать «Далее» можно сразу. «Назад» по-прежнему блокирована на
      // всё время применения — прерывать его на середине означало бы бросить
      // актора частично выданным. На Этапе 5 «Готово» блокируется, пока
      // резолвятся предметы снаряжения.
      nextDisabled: (this.step.id === "characteristics" && !this._aptReady())
        // До старта применения — обычная проверка «раса выбрана». После
        // старта system.race читать для этого нельзя (см. _advanceOriginStep):
        // applyRace временно обнуляет его на всё время своей работы, включая
        // паузу на строках выбора — блокировка держится тем же, чем и у
        // Архетипа: строки без ответа/конфликт, либо тихое применение без вопросов.
        || (this.step.id === "origin" && (this._originApplyPromise
              ? (this.pendingMechChoices.length ? !this._allMechChoicesPicked() : this._confirmingOrigin)
              : !this.actor.system.race))
        || (this.step.id === "archetype" && (this.pendingMechChoices.length
              ? !this._allMechChoicesPicked()
              : this._confirmingArchetype)),
      finishDisabled: this._confirmingGear,
      backDisabled: this.stepIndex === 0 || this._confirmingOrigin || this._confirmingArchetype || this._confirmingGear,
      confirmingOrigin: this._confirmingOrigin,
      confirmingArchetype: this._confirmingArchetype,
      confirmingGear: this._confirmingGear,
      originPendingNote: ((this._originApplyPromise || this.actor.system.race) && !this.pendingMechChoices.length)
        ? "Если у Расы/Субрасы есть покупки по бюджету — откроется отдельным окном сразу после «Далее»."
        : "",
      pendingMechChoices: this.pendingMechChoices.map(r => r.type === "or"
        ? { type: "or", key: r.key, itemName: r.itemName, skipped: r.pending?.kind === "skip",
            options: r.options.map((o, idx) => ({
              idx, label: o.label,
              // Тот же Навык уже выбран в ДРУГОЙ ещё не применённой строке —
              // нельзя выбрать его снова здесь (см. _claimedSkillKeys).
              disabled: !!(o.entry?.skillKey && this._claimedSkillKeys(r.key).has(o.entry.skillKey)),
              selected: r.pending?.kind === "pick" && r.pending.value === o.entry
            })) }
        : { type: "spec", key: r.key, skillLabel: r.skillLabel, need: r.need, many: r.need > 1,
            skipped: r.pending?.kind === "skip",
            choices: r.choices.map((c, idx) => ({
              idx, label: c.display, picked: r.picked.includes(idx),
              // Радио (одиночный выбор, need===1) хранит ответ в r.pending, а
              // не в r.picked (тот только для чекбоксов «любые N») — иначе
              // после перерисовки (теперь она случается чаще: строка больше
              // не исчезает сразу по ответу) выбранная радиокнопка визуально
              // сбрасывалась бы, хотя JS-состояние ответ уже помнит.
              checked: r.need === 1 && r.pending?.kind === "pick" && r.pending.value === c
            })),
            pickedCount: r.picked.length })
    };
  }

  /**
   * Контекст дропдауна Родного мира для Этапа 1. Обычный
   * `homeworldSheetContext` метит «выбрано» по реально гранту (embedded-
   * предмету) — а мир с выбором намеренно повисает неприменённым, пока
   * игрок не ответит на строки ниже (см. _pendingHomeworldKey), поэтому
   * здесь подменяем «выбрано» на отложенный ключ, чтобы селект не
   * откатывался обратно на «— не выбрано —» после выбора игрока.
   */
  _homeworldStepContext() {
    const ctx = homeworldSheetContext(this.actor);
    if (!ctx) return ctx;
    if (this._pendingHomeworldKey) {
      const key = this._pendingHomeworldKey;
      return {
        ...ctx, current: key,
        options: ctx.options.map(o => ({ ...o, selected: o.key === key })),
        // Int-зависимый мир (Исследовательская станция) — единственный
        // случай, где строки выбора реально не могут появиться раньше Этапа
        // 2: число специализаций считается от Бонуса Интеллекта, а его ещё
        // нет. Остальные choice-миры показывают строки сразу же, см.
        // _homeworldChoiceContext.
        deferredNote: needsIntBonusChoice(key)
          ? "Этот мир даёт выбор специализаций по Интеллекту — уточнится сразу после Этапа 2 («Характеристики»), когда станет известен бонус Интеллекта."
          : ""
      };
    }
    return ctx;
  }

  /**
   * Строки выбора отложенного Родного мира — инлайн вместо всплывающего
   * Dialog (та же «гайдлайна», что у Расы/Архетипа/Стремлений: игрок видит
   * выбор сразу в форме шага). Int-зависимый мир (needsIntBonusChoice)
   * показывает строки только на Этапе 2, когда Int.b уже посчитан —
   * до этого здесь пусто, а вместо строк — deferredNote выше.
   */
  _homeworldChoiceContext() {
    const key = this._pendingHomeworldKey;
    if (!key) return null;
    const hw = HOMEWORLD_BY_KEY[key];
    if (!hw || !homeworldHasChoices(hw)) return null;
    const needsInt = needsIntBonusChoice(key);
    if (needsInt && this.step.id !== "characteristics") return null;
    if (!needsInt && this.step.id !== "origin") return null;
    return {
      hwLabel: hw.label,
      featureName: hw.feature.name,
      featureDesc: hw.feature.desc,
      blocksHtml: homeworldChoiceBlocksHtml(hw, this.actor)
    };
  }

  /**
   * Контекст дропдауна Предсказания для Этапа 1 — тот же приём, что и у
   * Родного мира выше: пока выбор не отвечен (см. _pendingDivinationKey),
   * подменяем «выбрано» на отложенный ключ.
   */
  _divinationStepContext() {
    const ctx = divinationSheetContext(this.actor);
    if (!ctx) return ctx;
    if (this._pendingDivinationKey) {
      const key = this._pendingDivinationKey;
      return { ...ctx, current: key, options: ctx.options.map(o => ({ ...o, selected: o.key === key })) };
    }
    return ctx;
  }

  /** Строки выбора отложенного Предсказания — инлайн вместо Dialog, см. _homeworldChoiceContext. */
  _divinationChoiceContext() {
    const key = this._pendingDivinationKey;
    if (!key) return null;
    const def = DIVINATION_BY_KEY[key];
    if (!def || !divinationHasChoices(def)) return null;
    return {
      dvText: def.text,
      dvEffect: def.effect,
      blocksHtml: grantChoiceBlocksHtml({ charChoices: def.charChoices, choices: def.choices, actor: this.actor })
    };
  }

  // ── Этап 3: Архетип, Умения/Таланты, Раны ────────────────────────────────

  _archetypeStepContext() {
    const sys = this.actor.system;
    const entries = archetypesForRace(sys.race || "human", {
      subrace: sys.subrace || "",
      pastRace: sys.ynnariPast || ""
    });
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
        ? "Для этой расы архетип не выбирается (Экзодиты используют Пути; для Иннари без Прошлого список пуст)."
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
   * шаг. В отличие от более раннего варианта, дропдаун/чекбоксы строки САМИ
   * промис БОЛЬШЕ НЕ резолвят — они только копят «текущий выбор» в
   * row.pending (см. _setMechPick), а настоящее применение (row.resolve)
   * происходит ЕДИНЫМ пакетом по кнопке «Далее» (_resolveAllPendingMechChoices),
   * не раньше. applyGroupEntries внутри applyArchetype/applyRace идёт строго
   * последовательно (for…of await), поэтому вложенный выбор (если ответ на
   * текущий его раскрывает) появится в форме только после пакетного резолва
   * текущей партии — «Далее» в таком случае просто не переходит на
   * следующий шаг, а показывает новую партию, и его нужно нажать ещё раз.
   */
  _mechCollector() {
    // Окно могли закрыть, пока applyArchetype/applyRace ещё внутри цепочки
    // await — это НЕ отменяет сам промис (JS не умеет отменять чужой await),
    // и следующий выбор Конструктора всё равно попробует прийти в коллектор.
    // Без этой проверки он лёг бы в pendingMechChoices и звал render()
    // закрытого приложения, а его resolve никто и никогда не вызвал бы —
    // Конструктор навсегда завис бы на середине выдачи.
    const push = (row) => this._isClosing
      ? Promise.resolve(row.type === "spec" && row.need > 1 ? [] : null)
      : new Promise(resolve => {
          row.resolve = resolve;
          row.pending = undefined; // ничего не решено — блокирует пакетный резолв
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

  /**
   * Вариант коллектора для Стремлений: там выбор УЖЕ применяется сразу по
   * change дропдауна (activateAspirationListeners общая с листом актора —
   * см. её вызов в _activateListeners), поэтому строка резолвится СРАЗУ по
   * ответу в форме, без ожидания «Далее» — в отличие от _mechCollector выше.
   * Одна строка максимум: у Стремления либо нет Механики с выбором вовсе,
   * либо один простой ИЛИ («Fel+5 или Per+5») — второй вопрос подряд для
   * того же Стремления книгой не встречается.
   */
  _mechCollectorImmediate() {
    const push = (row) => this._isClosing
      ? Promise.resolve(row.type === "spec" && row.need > 1 ? [] : null)
      : new Promise(resolve => {
          row.resolve = resolve;
          this.pendingAspirationChoice = row;
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

  /** Отвечает на строку _mechCollectorImmediate — резолвит сразу, «Далее» ждать не нужно. */
  _resolveAspirationChoice(pending) {
    const row = this.pendingAspirationChoice;
    if (!row) return;
    this.pendingAspirationChoice = null;
    const skipValue = row.type === "spec" && row.need > 1 ? [] : null;
    const value = (!pending || pending.kind === "skip") ? skipValue : pending.value;
    row.resolve(value);
    this.render(false);
  }

  /**
   * Запоминает ТЕКУЩИЙ выбор строки без применения — { kind:"pick", value }
   * для дропдауна/радио и «Готово» многовыбора, { kind:"skip", value:null }
   * для крестика. `undefined` (строка ещё не тронута) намеренно отличается
   * от `{kind:"skip"}` — оба в итоге дают null Конструктору, но только явный
   * skip разрешает пакетный резолв, тогда как нетронутая строка его
   * блокирует (см. _allMechChoicesPicked) — молчание не должно тихо стать
   * пропуском.
   */
  _setMechPick(key, pending) {
    const row = this.pendingMechChoices.find(r => r.key === key);
    if (!row) return;
    row.pending = pending;
    this.render(false);
  }

  /**
   * Ключи Навыков, уже занятые ТЕКУЩИМ (ещё не применённым) выбором ДРУГИХ
   * ИЛИ-строк — не даёт двум строкам одновременно указывать на один Навык
   * (пример пользователя: «Скрытность +0 или Атлетика +0» в одной строке и
   * «Скрытность +10 или Атлетика +10» в другой — выбор Навыка в одной строке
   * убирает его из вариантов другой).
   */
  _claimedSkillKeys(excludeKey) {
    const set = new Set();
    for (const r of this.pendingMechChoices) {
      if (r.key === excludeKey || r.type !== "or" || r.pending?.kind !== "pick") continue;
      const sk = r.pending.value?.skillKey;
      if (sk) set.add(sk);
    }
    return set;
  }

  /**
   * Все ли видимые строки Конструктора имеют явное решение (выбор или
   * пропуск) И ни одна пара ИЛИ-строк не указывает на один и тот же Навык
   * одновременно? Второе — подстраховка поверх disabled-опций в разметке:
   * та просто мешает выбрать конфликт руками, а это ловит его на случай,
   * если выбор одной строки поменялся ПОСЛЕ того, как в другой уже стоял
   * тот же Навык (порядок кликов игрока не гарантирован).
   */
  _allMechChoicesPicked() {
    if (!this.pendingMechChoices.every(r => r.pending !== undefined)) return false;
    const seen = new Set();
    for (const r of this.pendingMechChoices) {
      if (r.type !== "or" || r.pending?.kind !== "pick") continue;
      const sk = r.pending.value?.skillKey;
      if (!sk) continue;
      if (seen.has(sk)) return false;
      seen.add(sk);
    }
    return true;
  }

  /**
   * Пакетный резолв ВСЕХ видимых строк их текущим выбором — вызывается
   * только из «Далее» (_advanceArchetypeStep/_advanceOriginStep), никогда по
   * change конкретной строки. Снимок делается ДО резолва: резолв может
   * синхронно (в той же микрозадаче) вернуть НОВЫЕ строки от applyGroupEntries
   * (вложенный выбор внутри выбранной ветки) — их эта партия не трогает, они
   * останутся в pendingMechChoices для следующего клика «Далее».
   */
  _resolveAllPendingMechChoices() {
    const batch = this.pendingMechChoices.splice(0, this.pendingMechChoices.length);
    for (const row of batch) {
      const p = row.pending;
      if (!p || p.kind === "skip") { row.resolve(row.type === "spec" && row.need > 1 ? [] : null); continue; }
      row.resolve(p.value);
    }
  }

  /**
   * «Далее» на Этапе 3 — конечный автомат вместо одного цельного await:
   * первый клик запускает applyArchetype В ФОНЕ (withMechCollector наполняет
   * pendingMechChoices вместо диалогов, «Далее» тут же снова доступен, если
   * появились строки выбора — см. nextDisabled), каждый следующий клик либо
   * применяет ПАКЕТОМ то, что сейчас стоит в строках (не переходя дальше —
   * это может раскрыть ВЛОЖЕННЫЙ выбор следующим кликом), либо, когда
   * applyArchetype реально завершился и строк больше нет, довершает шаг и
   * возвращает true — сигнал _onNext перейти на следующий Этап.
   */
  async _advanceArchetypeStep() {
    const actor = this.actor;
    const archKey = actor.system.archetype || "";
    if (!archKey) return false;

    if (!this._archetypeApplyPromise && actorArchetypeItem(actor)) {
      // Архетип уже применён в ПРОШЛЫЙ РАЗ (напр. другой экземпляр Мастера,
      // переоткрытый на уже готовом акторе) — новых строк выбора не будет.
      // Проверка _archetypeApplyPromise обязательна: applyArchetype создаёт
      // сам предмет архетипа СРАЗУ, задолго до Mechanics-выборов, так что
      // actorArchetypeItem(actor) становится true уже после первого клика
      // ЭТОЙ сессии — без этого условия второй клик проскакивал сюда мимо
      // pendingMechChoices и бросал 5 незакрытых строк / завершал шаг раньше
      // времени, оставляя applyArchetype висеть в фоне (найдено живой проверкой).
      await this._finishArchetypeStep(archKey);
      return true;
    }

    if (this.pendingMechChoices.length) {
      if (!this._allMechChoicesPicked()) return false; // подстраховка — nextDisabled должен был отловить раньше
      this._resolveAllPendingMechChoices();
      this.render(false);
      return false; // applyArchetype продолжает работу в фоне; следующий клик увидит новую партию либо конец
    }

    if (!this._archetypeApplyPromise) {
      this._confirmingArchetype = true;
      this.render(false); // сразу показать «Применяется…», не дожидаясь первой строки выбора
      this._archetypeApplyPromise = withMechCollector(this._mechCollector(), () => applyArchetype(actor, archKey))
        .finally(() => {
          this._confirmingArchetype = false;
          if (!this._isClosing) this.render(false); // без этого кнопка не «оживёт» сама, когда фон молча закончил
        });
      return false; // дать коллектору шанс наполнить первую партию строк
    }

    if (this._confirmingArchetype) return false; // всё ещё идёт молча (напр. бюджетная покупка в Обозревателе)

    await this._finishArchetypeStep(archKey);
    return true;
  }

  /**
   * Хвост прежнего _confirmArchetype: Черта архетипа, импланты, флаги
   * психайкера/техножреца, Таланты-развилки (уже выбраны прямо в форме шага
   * через talentPicks — здесь только собираем и создаём предметы, без
   * диалога), Навыки культуры легиона, бросок стартовых Ран по формуле
   * архетипа (один раз, снимок _wasEmpty.wounds с Этапа 1).
   */
  async _finishArchetypeStep(archKey) {
    const actor = this.actor;
    const sys = actor.system;
    const { race, arch } = resolveCreation({
      raceKey: sys.race, subraceKey: sys.subrace, archKey,
      ynnariPast: sys.ynnariPast, harlequinPast: sys.harlequinPast
    });
    const createTraits = (list, source) => actor.sheet?._createTraitsFromList?.(list, source);

    if (arch?.trait) await createTraits([arch.trait], `Архетип: ${arch.name}`);
    if (arch?.grantsImplants) {
      await grantMechanicusImplants(actor);
      await grantMechanicumImplantsTrait(actor);
    } else if (arch?.grantsWarPlate) await grantSkitariiWarPlate(actor);

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
    this._archetypeApplyPromise = null; // гигиена — actorArchetypeItem уже делает его неактуальным
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

    const pac = this.pendingAspirationChoice;
    const pendingAspirationChoice = !pac ? null : pac.type === "or"
      ? { type: "or", itemName: pac.itemName,
          options: pac.options.map((o, idx) => ({ idx, label: o.label })) }
      : { type: "spec", skillLabel: pac.skillLabel, need: pac.need, many: pac.need > 1,
          choices: pac.choices.map((c, idx) => ({ idx, label: c.display })) };

    return {
      aspirationSlots,
      pendingAspirationChoice,
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
   * пустые ДО Мастера (снимок _wasEmpty из _advanceOriginStep). Бесчестие кидает
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

      // НЕ живая проверка поверх снимка (как у Ран) — applyRace (Этап 1)
      // пишет расовую базу Влияния в то же поле раньше, чем мы сюда доходим
      // (Астартес: 19), и "всё ещё 0" было бы ложно даже на первом,
      // единственно верном проходе. Защита от повтора — свой отдельный флаг
      // сессии Мастера, не значение поля.
      if (this._wasEmpty.inf && !this._infamyRolled) {
        const infv = await rollFormula(actor, startingInfamyFormula(sum.inf, true), "Стартовое Бесчестие");
        this._infamyRolled = true;
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

  /**
   * По ключевым словам в строке текста снаряжения (английская военная
   * номенклатура архетипов/рас, изредка русский) угадывает ОДИН пак
   * Обозревателя, до которого стоит сузить окно ручного выбора — вместо
   * того чтобы игрок листал вообще все категории ради «Light Bolter».
   * Намеренно НЕ угадывает `type`/`folderId` (более узкие фильтры внутри
   * пака) — при ошибке угадывания там реален жёсткий дедэнд («под условия
   * не подошёл ни один предмет», Обозреватель сам закрывается), а у пака
   * целиком предметов десятки, риск пустой категории на практике нулевой.
   * Не угадал — вернёт null, Обозреватель откроется как раньше, без сужения.
   *
   * Границы слова у кириллицы пишутся lookaround'ами по буквам обоих
   * алфавитов, а не `\b`: `\b` в JS считает словом только ASCII, поэтому
   * `/\bмеч\b/` не совпадает НИ С ЧЕМ — ни «меч», ни «силовой меч» (обе
   * стороны «м»/«ч» тоже не-ASCII, границы нет). Тот же приём ниже у
   * «люб…» и «до R\d».
   */
  _guessGearPack(text) {
    const t = String(text).toLowerCase();
    if (/\b(bolter|pistol|rifle|shotgun|sword|axe|blade|knife|mace|spear|chain\w*|flamer|cannon|gun|launcher|carbine|autogun|lasgun|las\s*pistol|whip|club|hammer|dagger|talon)\b|оруж|пистолет|винтовк|дробовик|(?<![A-Za-zА-Яа-яЁё])меч(?![A-Za-zА-Яа-яЁё])|(?<![A-Za-zА-Яа-яЁё])нож(?![A-Za-zА-Яа-яЁё])|топор|клинок|булав/.test(t)) return "weapons";
    if (/\b(armour|armor|carapace|flak|xenomesh|wychsuit)\b|брон|доспех|(?<![A-Za-zА-Яа-яЁё])латы(?![A-Za-zА-Яа-яЁё])|панцир/.test(t)) return "armor";
    if (/\b(ammo|rounds?|clip|magazine)\b|патрон|обойм|магазин|боеприпас/.test(t)) return "ammunition";
    if (/\bshield\b|(?<![A-Za-zА-Яа-яЁё])щит(?![A-Za-zА-Яа-яЁё])/.test(t)) return "shields";
    if (/\b(toolkit|tool\s*kit)\b|инструмент|набор\s+инструментов/.test(t)) return "tools";
    return null;
  }

  /**
   * «Power Armour Mk X-Y» → список ИМЁН предметов компендиума (не выдуманных,
   * см. POWER_ARMOUR_MARKS) для марок от X до Y включительно — как обычная
   * группа выбора («A или B»), только развёрнутая из диапазона, а не из
   * текста с «или». Не диапазон/непонятная марка — null, строка идёт по
   * обычному пути (см. вызов в _gearLayout).
   */
  _expandPowerArmourMkRange(text) {
    const m = /\bMk\s+([IVXLCDM]+)\s*[-–—]\s*([IVXLCDM]+)\b/i.exec(String(text));
    if (!m) return null;
    const i0 = POWER_ARMOUR_MARKS.findIndex(x => x.n === m[1].toUpperCase());
    const i1 = POWER_ARMOUR_MARKS.findIndex(x => x.n === m[2].toUpperCase());
    if (i0 < 0 || i1 < 0 || i1 < i0) return null;
    return POWER_ARMOUR_MARKS.slice(i0, i1 + 1).map(x => x.name);
  }

  /** «N Стандартные системы» → сколько штук выбрать из папки STANDARD_SYSTEMS_FOLDER; иначе null. */
  _matchStandardSystemsCount(text) {
    const m = /^\s*(\d+)\s+Стандартны[ех]\s+систем/i.exec(String(text));
    return m ? Number(m[1]) : null;
  }

  /**
   * «L. <Категория> (до R<N>, <Кач>.Q)» (пример — Чемпион, «L. Power Weapon
   * (до R3, Good.Q)») — «L.» значит Легион-тир: любой предмет заданной
   * категории редкости не выше N, а ВЫБРАННОМУ экземпляру после выбора
   * нужно проставить Качество и добавить свойство Legion — готового
   * Legion-варианта на каждый силовой тип оружия в компендиуме просто нет
   * (в отличие от, скажем, «Болтер (Астартес)», где Legion уже встроен в
   * сам предмет). Категория определяется папкой компендиума —
   * LEGION_CATEGORY_FOLDERS ниже, пока известна только «Power Weapon».
   * Не совпало (неизвестная категория/формат) — null, строка идёт по
   * обычному пути (см. вызов в _gearLayout).
   */
  _matchLegionCategoryGear(text) {
    const m = /^L\.\s*(.+?)\s*\(до\s*R(\d+),\s*(\w+)\.?Q\)\s*$/i.exec(String(text).trim());
    if (!m) return null;
    const folderId = LEGION_CATEGORY_FOLDERS[m[1].trim().toLowerCase()];
    if (!folderId) return null;
    return { folderId, maxAvailability: Number(m[2]), quality: m[3].toLowerCase() };
  }

  /**
   * «N элементов [Снаряжения/Инструментов] до R<N> (…Качество…)» (пример —
   * Человек, «5 элементов Снаряжения/Инструментов до R1 (2 Good.Q, 1 Best.Q)»)
   * — раньше «/» резался как «А или Б» (_splitGearChoice считает его выбором
   * между ПРЕДМЕТАМИ, а тут это две КАТЕГОРИИ через дробь одного набора) и
   * получалось два обрывка фразы, ни один не совпадал с реальным предметом,
   * а число N терялось — Обозреватель открывался на count:1 (wdbc-ревизия
   * снаряжения, 22.08.2026). Теперь «/» (и «и» — Друкхари/Сслиты пишут через
   * союз) между категориями читается как ИЛИ по смыслу книги: игрок берёт N
   * предметов ЛЮБОГО состава из объединения категорий, не выбор одной штуки
   * из двух половин фразы. Категория не распозналась или её вообще нет
   * («5 элементов до R1» без слов) — общий набор «Снаряжение+Инструменты»,
   * это и есть подразумеваемый смысл голой фразы.
   * Смесь Качества в скобках («2 Good.Q, 1 Best.Q») не проверяется —
   * Обозреватель не считает состав по Качеству отдельно, состав — на совести
   * игрока, как и раньше у ручного подбора.
   */
  _matchGearBudget(text) {
    const m = /^(\d+)\s+элемент\w*\s*(?:([^()]*?)\s+)?до\s*R\s*(-?\d+)/iu.exec(String(text).trim());
    if (!m) return null;
    const count = Number(m[1]);
    const maxAvailability = Number(m[3]);
    const cats = String(m[2] || "");
    const packs = new Set();
    if (/снаряжен/iu.test(cats)) packs.add("gear");
    if (/инструмент/iu.test(cats)) packs.add("tools");
    if (!packs.size) { packs.add("gear"); packs.add("tools"); }
    return { count, maxAvailability, packs: [...packs] };
  }

  /**
   * Ведущее число строки («3 Splinter Pistol», «2 Hekatrix Blade (Best.Q)»)
   * — количество одного и того же ИМЕННОГО предмета, а не группа выбора и не
   * абстрактный бюджет. `clean()` (см. _confirmGear) уже срезает его для
   * поиска имени, но само число раньше нигде не сохранялось — Обозреватель/
   * точное совпадение всегда создавали ровно 1 экземпляр, а не N.
   */
  _matchLeadingCount(text) {
    const m = /^\s*(\d+)\s*[×x]?\s*[А-ЯЁA-Z]/u.exec(String(text));
    return m ? Number(m[1]) : 1;
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
      const mkRange = this._expandPowerArmourMkRange(e);
      if (mkRange) { layout.push({ ci: choiceDefs.length }); choiceDefs.push(mkRange); continue; }
      if (this._matchStandardSystemsCount(e) != null) { layout.push({ fixed: e }); continue; }
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
      hasGear: layout.length > 0 || isAstartes,
      equipShop: this._equipShopContext()
    };
  }

  /**
   * Очки Снаряжения (стр. 24): помимо снаряжения от Расы/Архетипа/Элитного
   * архетипа, персонаж получает Inf.b очков и тратит их по фиксированной
   * таблице. `left` пересчитывается заново при каждом рендере — источник
   * истины сам актор (Inf.b) и накопленный this._equipSpent, а не снимок.
   */
  _equipShopContext() {
    const infBonus = this.actor.system.characteristics?.inf?.bonus ?? 0;
    const total = equipPointsTotal(infBonus, this._equipBonusPoints);
    const left = equipPointsLeft(total, this._equipSpent);
    return {
      infBonus, bonusPoints: this._equipBonusPoints, total, spent: this._equipSpent, left,
      rows: EQUIP_SHOP_ROWS.map(r => ({ ...r, disabled: !canAffordRow(r, left) || this._confirmingEquipShop })),
      sacrificing: this._confirmingEquipShop,
      sacrificeCount: SACRIFICE_MOD_COUNT
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

      // "traits" — в строке снаряжения (Архетип.gear) попадаются не только
      // предметы инвентаря, но и Черты ("Mechanicum Implants" у Технодесантника
      // и т.п.): без пака в индексе точное совпадение не находилось, и такая
      // строка уходила в ручной подбор через Обозреватель — с неугаданным паком
      // (гадалка по ключевым словам не знает про Черты) он открывался на первой
      // попавшейся вкладке (Бестиарий), а сама Черта — не выбор, а то, что
      // положено автоматически.
      const packNames = ["weapons", "armor", "gear", "ammunition", "shields", "tools", "armour-systems", "traits"];
      const packs = packNames.map(p => game.packs.get(`warhammer-dbc.${p}`)).filter(Boolean);
      const index = new Map();
      const norm = s => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      for (const pk of packs) for (const e of await pk.getIndex()) {
        for (const part of String(e.name).split("/")) { const k = norm(part); if (k && !index.has(k)) index.set(k, { pack: pk, id: e._id }); }
      }
      // «(Астартес)» — часть настоящего имени предмета (отличает Легион-версию
      // от обычной), а не квалификатор вроде «(Good.Q)» — не срезаем именно её.
      const clean = txt => String(txt).replace(/^\s*\d+×?\s*/, "").replace(/^l\.\s*/i, "").replace(/\((?!Астартес\))[^)]*\)/g, "")
        .replace(/\s*(?<![A-Za-zА-Яа-яЁё])до\s*R\s*\d+\b/gi, "").replace(/\b(Best|Good|Common|Poor)\.?Q\b/gi, "").trim();

      // Уже на акторе (в т.ч. бильнгвально, «Bolter (Astartes) / Болтер
      // (Астартес)» = «Болтер (Астартес)») — сюда попадает и то, что реально
      // выдано раньше (повторный проход Мастера), и совпадение строк
      // Расы/Архетипа (оба перечисляют один и тот же болтер текстом — тогда
      // «эквип» дублировался бы уже на первом проходе). Ключ — та же norm(),
      // которой резолвится сам предмет, split("/") — обе половины двуязычного
      // имени.
      const onActor = new Set();
      for (const it of actor.items) for (const part of String(it.name).split("/")) {
        const k = norm(part.trim()); if (k) onActor.add(k);
      }

      // done[r] — по КОНКРЕТНОЙ строке (индексу resolved), не общим флагом:
      // иначе один успешный ручной выбор красил бы «сделано» и все строки,
      // которые игрок в Обозревателе просто закрыл крестиком (пропустил).
      const toCreate = [];
      const done = resolved.map(() => false);
      const manualIdx = [];
      const stdSysIdx = [];   // «N Стандартные системы» — свой бюджетный поток, не по одной
      const legionIdx = [];   // «L. <Категория> (до R<N>, <Кач>.Q)» — свой поток с пост-обработкой
      const gearBudgetIdx = []; // «N элементов [Снаряжения/Инструментов] до R<N>» — свой бюджетный поток
      const grantedKeys = new Set();
      resolved.forEach((r, i) => {
        if (this._matchStandardSystemsCount(r) != null) { stdSysIdx.push(i); return; }
        if (this._matchLegionCategoryGear(r)) { legionIdx.push(i); return; }
        if (this._matchGearBudget(r)) { gearBudgetIdx.push(i); return; }
        if (/(?<![A-Za-zА-Яа-яЁё])люб/i.test(r) || /модификац|доз|магазин|\bR\d\b\s*$/i.test(r)) return; // абстрактное — вручную, как раньше
        const k = norm(clean(r));
        const ref = k ? index.get(k) : null;
        if (!ref) { manualIdx.push(i); return; }
        // Предмет уже есть (на акторе или уже поставлен в очередь этим же
        // проходом) — не плодим вторую копию, но строку помечаем «сделано»:
        // формально она удовлетворена, и Обозреватель по ней не откроется.
        if (onActor.has(k) || grantedKeys.has(k)) { done[i] = true; return; }
        grantedKeys.add(k);
        toCreate.push({ i, ref, count: this._matchLeadingCount(r) });
      });
      // Броня, выданная этим же проходом (обычно — выбранная марка силовой
      // брони), — цель авто-подключения «N Стандартных систем» ниже: та же
      // связка installedOn, что и ручная установка на вкладке «Снаряжение»
      // (combat/armor-mods.mjs), просто проставленная сразу, а не оставленная
      // висеть отдельным предметом до первого ручного клика (wdbc-cgu).
      let newArmorId = null;
      if (toCreate.length) {
        const docs = await Promise.all(toCreate.map(({ ref }) => ref.pack.getDocument(ref.id)));
        const objs = [];
        toCreate.forEach(({ i, count }, idx) => {
          const doc = docs[idx];
          if (!doc) return;
          done[i] = true;
          // Ведущее число строки («3 Splinter Pistol») — quantity для расходуемых
          // типов, отдельные копии для остальных; 1 (по умолчанию) — как раньше.
          if (count > 1 && EQUIP_STACKABLE_TYPES.has(doc.type)) {
            const obj = doc.toObject();
            obj.system.quantity = (Number(obj.system.quantity) || 1) * count;
            objs.push(obj);
          } else {
            for (let n = 0; n < count; n++) objs.push(doc.toObject());
          }
        });
        if (objs.length) {
          const created = await actor.createEmbeddedDocuments("Item", objs);
          const armor = created.find(it => it.type === "armor");
          if (armor) newArmorId = armor.id;
        }
      }

      // «N Стандартные системы» — не «предмет за предметом», а один бюджетный
      // выбор N штук из конкретной папки (STANDARD_SYSTEMS_FOLDER), тем же
      // Обозревателем, что и у бюджетных покупок Механики (count>1 → живой
      // счётчик «выбрано X из N» вместо диалога на каждую позицию).
      for (const i of stdSysIdx) {
        const need = this._matchStandardSystemsCount(resolved[i]);
        const picked = await openCompendiumBrowser(false, {
          count: need, pack: "armour-systems", filters: { folderId: STANDARD_SYSTEMS_FOLDER },
          prompt: `Стартовое снаряжение: ${resolved[i]}`
        });
        const uuids = Array.isArray(picked) ? picked : (picked ? [picked] : []);
        if (!uuids.length) continue;
        const docs = await Promise.all(uuids.map(u => fromUuid(u).catch(() => null)));
        const objs = docs.filter(Boolean).map(d => d.toObject());
        // Системы — armorMod (system.installedOn) — подключаются сразу к
        // броне, выданной тем же проходом, если она нашлась. Не нашлась
        // (архетип без своей марки/броня выбирается позже вручную) — предметы
        // всё равно создаются, просто неустановленными, как раньше.
        if (newArmorId) for (const o of objs) o.system.installedOn = newArmorId;
        if (objs.length) { await actor.createEmbeddedDocuments("Item", objs); done[i] = objs.length === need; }
      }

      // «L. <Категория> (до R<N>, <Кач>.Q)» — фильтр по папке+редкости
      // (см. _matchLegionCategoryGear), а после выбора выбранному экземпляру
      // ПРОГРАММНО проставляются Качество и свойство Legion: готового
      // Legion-варианта на каждый тип оружия категории в компендиуме нет
      // (не как у «Болтер (Астартес)», где Legion уже часть самого предмета).
      for (const i of legionIdx) {
        const spec = this._matchLegionCategoryGear(resolved[i]);
        const uuid = await openCompendiumBrowser(false, {
          count: 1, pack: "weapons",
          filters: { folderId: spec.folderId, maxAvailability: spec.maxAvailability },
          prompt: `Стартовое снаряжение: ${resolved[i]}`
        });
        if (!uuid) continue;
        const doc = await fromUuid(uuid).catch(() => null);
        if (!doc) continue;
        const obj = doc.toObject();
        obj.system.quality = spec.quality;
        const props = Array.isArray(obj.system.weaponProps) ? obj.system.weaponProps : [];
        if (!props.some(p => p?.key === "legion")) props.push({ key: "legion" });
        obj.system.weaponProps = props;
        await actor.createEmbeddedDocuments("Item", [obj]);
        done[i] = true;
      }

      // «N элементов [Снаряжения/Инструментов] до R<N>» — не «предмет за
      // предметом», а один бюджетный выбор N штук из общих категорий
      // снаряжения (см. _matchGearBudget) — тем же Обозревателем, что и «N
      // Стандартные системы» выше, но без привязки к одной конкретной папке.
      for (const i of gearBudgetIdx) {
        const budget = this._matchGearBudget(resolved[i]);
        const picked = await openCompendiumBrowser(false, {
          pack: budget.packs, filters: { maxAvailability: budget.maxAvailability },
          count: budget.count,
          prompt: `Стартовое снаряжение: ${resolved[i]}`
        });
        const uuids = Array.isArray(picked) ? picked : (picked ? [picked] : []);
        if (!uuids.length) continue;
        const counts = new Map();
        for (const u of uuids) counts.set(u, (counts.get(u) || 0) + 1);
        const objs = [];
        for (const [uuid, qty] of counts) {
          const doc = await fromUuid(uuid).catch(() => null);
          if (!doc) continue;
          if (qty > 1 && EQUIP_STACKABLE_TYPES.has(doc.type)) {
            const obj = doc.toObject();
            obj.system.quantity = (Number(obj.system.quantity) || 1) * qty;
            objs.push(obj);
          } else {
            for (let n = 0; n < qty; n++) objs.push(doc.toObject());
          }
        }
        if (objs.length) { await actor.createEmbeddedDocuments("Item", objs); done[i] = true; }
      }

      // Точных совпадений не нашлось — спрашиваем игрока по очереди, а не
      // угадываем САМ ПРЕДМЕТ: тот же Обозреватель, что и для бюджетных
      // покупок. Категорию (пак) при этом угадать МОЖНО — сужаем окно до
      // одной вкладки по ключевым словам строки (see _guessGearPack), чтобы
      // не листать вообще все компендиумы ради одной винтовки. Угадываем
      // только ПАК целиком (не type/folderId) — у пака десятки предметов,
      // риск «под фильтр не подошло ничего» и жёсткого дедэнда практически
      // нулевой; при неуверенном угадывании просто не сужаем (как раньше).
      for (const i of manualIdx) {
        const uuid = await openCompendiumBrowser(false, {
          count: 1, pack: this._guessGearPack(resolved[i]),
          prompt: `Стартовое снаряжение: ${resolved[i]}`
        });
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

      await this._grantStartingAmmo();

      this._gearDone = true;
    } finally {
      this._confirmingGear = false;
      this.render(false);
    }
  }

  // ── Очки Снаряжения (стр. 24) ────────────────────────────────────────────

  /** Клик «Купить» по строке таблицы — списывает очки, только если резолв реально что-то дал. */
  async _buyEquipRow(key) {
    const row = EQUIP_SHOP_ROW_BY_KEY[key];
    if (!row || this._confirmingEquipShop) return;
    const { left } = this._equipShopContext();
    if (!canAffordRow(row, left)) return;
    this._confirmingEquipShop = true;
    this.render(false);
    try {
      let ok = false;
      if (row.kind === "buy") ok = await this._equipBuyItems(row);
      else if (row.kind === "quality") ok = await this._equipUpgradeQuality(row);
      else if (row.kind === "special") ok = await this._equipSpecialWeapon(row);
      if (ok) this._equipSpent += row.cost;
    } finally {
      this._confirmingEquipShop = false;
      this.render(false);
    }
  }

  /** Строки "buy" — N предметов заданной Редкости из общих категорий снаряжения. */
  async _equipBuyItems(row) {
    const filters = { maxAvailability: row.maxAvailability };
    if (row.minAvailability != null) filters.minAvailability = row.minAvailability;
    const picked = await openCompendiumBrowser(false, {
      pack: EQUIP_SHOP_PACKS, filters, count: row.count,
      prompt: `Очки Снаряжения: ${row.label}`
    });
    const uuids = Array.isArray(picked) ? picked : (picked ? [picked] : []);
    if (!uuids.length) return false;
    // Расходуемые типы (STACKABLE_TYPES у Обозревателя) могут повторяться —
    // тот же приём, что у бюджетных покупок Механики (mechanics.mjs): схлопнуть
    // в quantity ДО раздачи, иначе повтор создал бы вторую отдельную копию.
    const counts = new Map();
    for (const u of uuids) counts.set(u, (counts.get(u) || 0) + 1);
    const objs = [];
    for (const [uuid, qty] of counts) {
      const doc = await fromUuid(uuid).catch(() => null);
      if (!doc) continue;
      if (qty > 1 && EQUIP_STACKABLE_TYPES.has(doc.type)) {
        const obj = doc.toObject();
        obj.system.quantity = (Number(obj.system.quantity) || 1) * qty;
        objs.push(obj);
      } else {
        for (let i = 0; i < qty; i++) objs.push(doc.toObject());
      }
    }
    if (!objs.length) return false;
    await this.actor.createEmbeddedDocuments("Item", objs);
    return true;
  }

  /** Строки "quality" — поднять Качество уже полученных предметов на row.steps ступеней. */
  async _equipUpgradeQuality(row) {
    const candidates = this.actor.items.filter(it =>
      ["weapon", "armor", "gear", "tool", "ammo", "drug", "forcefield", "cybernetic", "implant"].includes(it.type)
      && (Number(it.system?.availability) || 0) <= row.maxAvailability
      && (row.minAvailability == null || (Number(it.system?.availability) || 0) >= row.minAvailability));
    if (!candidates.length) { ui.notifications.warn("На листе нет подходящих по Редкости предметов для этой траты."); return false; }
    const picked = await this._pickOwnedItems(candidates, row.label, row.count);
    if (!picked.length) return false;
    for (const item of picked) {
      let q = normQuality(item.system.quality);
      for (let i = 0; i < row.steps; i++) q = capUpgradeQuality(nextQuality(q));
      await item.update({ "system.quality": q });
    }
    return true;
  }

  /** Строки "special" — Рунический/Оружие Наследия/Демоническое: лёгкая пометка, доработка — на листе. */
  async _equipSpecialWeapon(row) {
    const candidates = this.actor.items.filter(it =>
      it.type === "weapon" && (Number(it.system?.availability) || 0) <= row.maxAvailability);
    if (!candidates.length) { ui.notifications.warn("На листе нет оружия подходящей Редкости для этой траты."); return false; }
    const picked = await this._pickOwnedItems(candidates, row.label, 1);
    if (!picked.length) return false;
    const item = picked[0];
    const notes = {
      rune: ["system.daemonWeapon.runic", "Рунический — довооружите деталями на листе предмета, если нужно."],
      legacy: ["system.legacyWeapon", "Оружие Наследия — полная История/Характер/Мутации через кнопку «Наследие» на листе предмета."],
      daemonic: ["system.daemonWeapon.bound", "Демоническое — впишите Бога/имя демона/Связывание на листе предмета."]
    }[row.special];
    if (!notes) return false;
    await item.update({ [notes[0]]: true });
    ChatMessage.create({
      content: `<div class="wh-roll-result"><div class="roll-header">Очки Снаряжения — ${esc(this.actor.name)}</div>
        <div class="roll-outcome"><b>${esc(item.name)}</b> помечено: ${esc(row.label)}.</div>
        <div style="font-size:.85em;opacity:.8;">${esc(notes[1])}</div></div>`,
      whisper: ChatMessage.getWhisperRecipients?.("GM") || [],
      speaker: { alias: this.actor.name }
    });
    return true;
  }

  /**
   * Пожертвовать оружием/бронёй/кибернетикой ради 3 модификаций Редкостью не
   * более 2 (стр. 24, отдельно от таблицы очков — своих Очков не стоит).
   */
  async _sacrificeEquip() {
    if (this._confirmingEquipShop) return;
    const candidates = this.actor.items.filter(it => ["weapon", "armor", "cybernetic", "implant"].includes(it.type));
    if (!candidates.length) { ui.notifications.warn("На листе нет оружия/брони/кибернетики для жертвы."); return; }
    this._confirmingEquipShop = true;
    this.render(false);
    try {
      const picked = await this._pickOwnedItems(candidates, "Пожертвовать за 3 модификации (Редкость ≤2)", 1);
      if (!picked.length) return;
      const sacrificed = picked[0];
      const modsPack = sacrificed.type === "armor" ? "armor-mods" : "weapon-mods";
      const uuids = await openCompendiumBrowser(false, {
        pack: modsPack, filters: { maxAvailability: SACRIFICE_MOD_MAX_AVAILABILITY },
        count: SACRIFICE_MOD_COUNT,
        prompt: `Жертва «${sacrificed.name}»: ${SACRIFICE_MOD_COUNT} модификации Редкостью не более ${SACRIFICE_MOD_MAX_AVAILABILITY}`
      });
      const list = Array.isArray(uuids) ? uuids : (uuids ? [uuids] : []);
      if (!list.length) return;
      const docs = await Promise.all(list.map(u => fromUuid(u).catch(() => null)));
      const objs = docs.filter(Boolean).map(d => d.toObject());
      await sacrificed.delete();
      if (objs.length) await this.actor.createEmbeddedDocuments("Item", objs);
    } finally {
      this._confirmingEquipShop = false;
      this.render(false);
    }
  }

  /**
   * Диалог выбора N предметов из уже полученных актором — тот же приём, что
   * `legacyPrompt` в apps/legacy-weapon.mjs (DialogV2.wait), только с чекбоксами
   * вместо текстового поля. Возвращает выбранные документы (может быть меньше
   * need, если игрок отменил или отметил не всё).
   */
  async _pickOwnedItems(items, promptLabel, need = 1) {
    const rows = items.map((it, i) => `<label class="atk-dlg-row" style="display:flex;gap:6px;align-items:center;">
      <input type="checkbox" name="pick" value="${i}"/> ${esc(it.name)}
      <span style="opacity:.6;font-size:.85em;">(R${it.system?.availability ?? 0}${it.system?.quality ? `, ${it.system.quality}` : ""})</span>
    </label>`).join("");
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Очки Снаряжения" },
      classes: ["warhammer-dbc", "wh-holo"],
      content: `<form><div class="atk-dlg-row"><b>${esc(promptLabel)}</b> — отметьте ${need > 1 ? `до ${need}` : "один"}:</div>${rows}</form>`,
      rejectClose: false,
      buttons: [
        { action: "ok", label: "Готово", default: true,
          callback: (_e, button) => [...button.form.querySelectorAll('input[name="pick"]:checked')].map(el => Number(el.value)) },
        { action: "cancel", label: "Отмена", callback: () => [] }
      ]
    });
    const idxs = (result || []).slice(0, need);
    return idxs.map(i => items[i]).filter(Boolean);
  }

  /**
   * Боеприпасы после завершения выбора снаряжения (стр. 24): 4 полных
   * магазина или 20 стандартных — что больше, для каждого оружия на листе.
   * Только оружие, которое реально расходует боеприпас (magazineMax>0) и у
   * которого ещё нет заряженного/подходящего боеприпаса — повторный проход
   * Мастера (напр. переоткрытый на готовом персонаже) не сыплет новыми пачками.
   */
  async _grantStartingAmmo() {
    const actor = this.actor;
    const weapons = actor.items.filter(it => it.type === "weapon" && (Number(it.system?.magazineMax) || 0) > 0);
    if (!weapons.length) return;
    let ammoLib = [];
    try {
      const pack = game.packs.get("warhammer-dbc.ammunition");
      if (pack) ammoLib = await pack.getDocuments();
    } catch (e) { /* пак недоступен — пропускаем автовыдачу молча, не блокируем Готово */ }
    if (!ammoLib.length) return;
    const objs = [];
    for (const w of weapons) {
      const already = actor.items.some(it => it.type === "ammo" &&
        (it.system?.weaponTypes || []).includes(w.system?.weaponType || w.type));
      if (already) continue;
      // «Стандартный» боеприпас — без модификаторов профиля (не спецбоеприпас),
      // подходящий по weaponTypes; первый совпавший, порядок пака — по алфавиту.
      const wt = w.system?.weaponType || "";
      const std = ammoLib.find(a =>
        (a.system.weaponTypes || []).includes(wt) &&
        !a.system.attackMod && !a.system.damageMod && !a.system.penetrationMod && !a.system.rangeMod);
      if (!std) continue;
      const need = startingAmmoQuantity(w.system.magazineMax);
      const obj = std.toObject();
      delete obj._id;
      obj.system.quantity = need;
      objs.push(obj);
    }
    if (objs.length) await actor.createEmbeddedDocuments("Item", objs);
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
      // Лёгкое уведомление ГМ (wdbc-agc) — не блокирует персонажа, просто
      // просит проверить: раньше Мастер завершался молча, и ГМ узнавал о
      // новом персонаже только случайно наткнувшись на него в списке.
      // Не игроку — свою же карточку видеть незачем (whisper только GM).
      if (!game.user.isGM) {
        ChatMessage.create({
          content: `<div class="wh-roll-result"><div class="roll-header">🧙 Создание персонажа завершено</div>
            <div class="roll-outcome">Игрок <b>${esc(game.user.name)}</b> закончил Мастера создания для <b>${esc(this.actor.name)}</b> — стоит проверить.</div></div>`,
          whisper: ChatMessage.getWhisperRecipients?.("GM") || [],
          speaker: { alias: this.actor.name }
        });
      }
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
    on(".wiz-equip-bonus", "change", ev => {
      this._equipBonusPoints = Math.max(0, Number(ev.currentTarget.value) || 0);
      this.render(false);
    });
    on(".wiz-equip-buy", "click", ev => this._buyEquipRow(ev.currentTarget.dataset.rowKey));
    on(".wiz-equip-sacrifice", "click", () => this._sacrificeEquip());

    on(".wiz-name-inp",  "change", ev => this.actor.update({ name: ev.currentTarget.value || "Новый персонаж" }));
    on(".wiz-race-sel",  "change", ev => {
      if (ev.currentTarget.value === "") return; // плейсхолдер «— выбрать —», не настоящая раса
      this.actor.update({ "system.race": ev.currentTarget.value, "system.subrace": "" }).then(() => this.render(false));
    });
    on(".wiz-subrace-sel", "change", ev => this.actor.update({ "system.subrace": ev.currentTarget.value }));
    on(".wiz-align-sel", "change", ev => this.actor.update({ "system.alignment": ev.currentTarget.value }));
    on(".wiz-body-type-sel", "change", ev => this.actor.update({ "system.bodyType": ev.currentTarget.value }));

    on(".wiz-legion-sel", "change", ev => this.actor.update({ "system.geneSeed.legion": ev.currentTarget.value, "system.geneSeed.chapter": "" }).then(() => this.render(false)));
    on(".wiz-chapter-sel", "change", ev => this.actor.update({ "system.geneSeed.chapter": ev.currentTarget.value }));
    on(".wiz-cult-sel",    "change", ev => this.actor.update({ "system.geneSeed.cultureLegion": ev.currentTarget.value, "system.geneSeed.cultureChapter": "" }).then(() => this.render(false)));
    on(".wiz-cult-chapter-sel", "change", ev => this.actor.update({ "system.geneSeed.cultureChapter": ev.currentTarget.value }));

    on(".wiz-hw-sel", "change", async ev => {
      let key = ev.currentTarget.value;
      // «Выбрать случайно» — бросаем СРАЗУ здесь, а не внутри applyHomeworld:
      // тот после броска сам звал бы Dialog для строк выбора выпавшего мира,
      // а нам нужно решить (defer/показать инлайн), какой мир ни выпади бы.
      if (key === "random") key = await rollRandomHomeworldKey();
      this._hwTargetState = { factionTargets: {} };  // сброс на новый мир — старые пикеры цели больше не в силе
      const hw = HOMEWORLD_BY_KEY[key];
      if (key && needsIntBonusChoice(key)) {
        // Строки выбора отложены до Этапа 2 (см. _onNext) — на Этапе 1
        // Интеллект ещё не посчитан, «доступно» показало бы 0.
        this._pendingHomeworldKey = key;
        this.render(false);
        return;
      }
      if (key && hw && homeworldHasChoices(hw)) {
        // Есть выбор (Hatred/пакеты/специализации) — показываем строки инлайн
        // прямо здесь (_homeworldChoiceContext) и применяем на «Далее»
        // (_advanceOriginStep), а не всплывающим Dialog.
        this._pendingHomeworldKey = key;
        this.render(false);
        return;
      }
      this._pendingHomeworldKey = null;
      applyHomeworldPicks(this.actor, key, {}).then(() => this.render(false));
    });
    // Оживляет строки выбора Родного мира, показанные инлайн выше (живой
    // счётчик специализаций, пикер цели Таланта) — html здесь тот же jQuery-
    // корень, что и Dialog-контент у promptChoices, wireHomeworldChoiceBlocks
    // одна на оба случая.
    {
      const hwChoice = this._homeworldChoiceContext();
      if (hwChoice) wireHomeworldChoiceBlocks(html, HOMEWORLD_BY_KEY[this._pendingHomeworldKey], this._hwTargetState);
    }
    on(".wiz-dv-sel", "change", async ev => {
      let key = ev.currentTarget.value;
      if (key === "random") {
        const r = await rollRandomDivinationKey();
        if (!r) return;  // бросок ушёл мимо таблицы — ничего не меняем, как раньше
        key = r.key;
      }
      this._dvTargetState = { factionTargets: {} };
      const def = DIVINATION_BY_KEY[key];
      if (key && def && divinationHasChoices(def)) {
        // Есть выбор (напр. Hatred+Peer у «Будь благом братьям…») — строки
        // инлайн прямо здесь (_divinationChoiceContext), применяем на «Далее».
        this._pendingDivinationKey = key;
        this.render(false);
        return;
      }
      this._pendingDivinationKey = null;
      applyDivinationPicks(this.actor, key, {}).then(() => this.render(false));
    });
    {
      const dvChoice = this._divinationChoiceContext();
      if (dvChoice) wireGrantChoiceBlocks(html, { choices: DIVINATION_BY_KEY[this._pendingDivinationKey]?.choices || [] }, this._dvTargetState);
    }
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

    // ── Этап 3/1: ИЛИ/спец-выборы Конструктора, собранные в форму шага ──
    // Ни один из этих обработчиков больше НЕ применяет выбор сразу — только
    // запоминает его в row.pending. Применение — пакетом, по «Далее»
    // (см. _resolveAllPendingMechChoices, вызывается из _advanceArchetypeStep/
    // _advanceOriginStep).
    on(".wiz-mech-or-sel", "change", ev => {
      const val = ev.currentTarget.value;
      const key = ev.currentTarget.dataset.key;
      if (val === "") { this._setMechPick(key, undefined); return; } // плейсхолдер «— выбрать —» — снова не решено
      const row = this.pendingMechChoices.find(r => r.key === key);
      if (row) this._setMechPick(key, { kind: "pick", value: row.options[Number(val)]?.entry ?? null });
    });
    on(".wiz-mech-spec-radio", "change", ev => {
      const key = ev.currentTarget.dataset.key;
      const row = this.pendingMechChoices.find(r => r.key === key);
      if (row) this._setMechPick(key, { kind: "pick", value: row.choices[Number(ev.currentTarget.value)] ?? null });
    });
    on(".wiz-mech-spec-check", "change", ev => {
      const key = ev.currentTarget.dataset.key;
      const idx = Number(ev.currentTarget.dataset.idx);
      const row = this.pendingMechChoices.find(r => r.key === key);
      if (!row) return;
      if (ev.currentTarget.checked) { if (!row.picked.includes(idx)) row.picked.push(idx); }
      else row.picked = row.picked.filter(i => i !== idx);
      // «Готово» ниже пересобирает row.pending из picked заново при каждом
      // клике по чекбоксу тоже — так «Далее» может отправить пакет, даже
      // если игрок забыл явно нажать «Готово», как только набрано ровно need.
      row.pending = row.picked.length === row.need
        ? { kind: "pick", value: row.picked.map(i => row.choices[i]) } : undefined;
      this.render(false);
    });
    on(".wiz-mech-spec-confirm", "click", ev => {
      const key = ev.currentTarget.dataset.key;
      const row = this.pendingMechChoices.find(r => r.key === key);
      if (row) this._setMechPick(key, { kind: "pick", value: row.picked.map(i => row.choices[i]) });
    });
    on(".wiz-mech-skip", "click", ev => {
      const key = ev.currentTarget.dataset.key;
      const row = this.pendingMechChoices.find(r => r.key === key);
      // Повторный клик по уже пропущенной строке отменяет пропуск — возврат
      // к «ничего не решено», а не переключение на какой-то выбор наугад.
      this._setMechPick(key, row?.pending?.kind === "skip" ? undefined : { kind: "skip", value: null });
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
    // withCollector направляет ИЛИ-выбор Механики Стремления (если он есть —
    // «Fel+5 или Per+5» и т.п.) в форму шага вместо всплывающего Dialog, тем
    // же приёмом, что Раса/Архетип (см. _mechCollectorImmediate — резолвится
    // сразу по ответу, «Далее» ждать не нужно: сам список Стремлений
    // применяется по change, как на обычном листе).
    activateAspirationListeners(html, this.actor,
      fn => withMechCollector(this._mechCollectorImmediate(), fn));
    on(".wiz-aspir-choice-or", "change", ev => {
      const val = ev.currentTarget.value;
      if (val === "") return;
      const row = this.pendingAspirationChoice;
      this._resolveAspirationChoice({ kind: "pick", value: row?.options[Number(val)]?.entry ?? null });
    });
    on(".wiz-aspir-choice-spec", "change", ev => {
      const row = this.pendingAspirationChoice;
      this._resolveAspirationChoice({ kind: "pick", value: row?.choices[Number(ev.currentTarget.value)] ?? null });
    });
    on(".wiz-aspir-choice-skip", "click", ev => {
      ev.preventDefault();
      this._resolveAspirationChoice({ kind: "skip", value: null });
    });
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
    // Защита от повторного клика, пока предыдущий клик ещё внутри своего await
    // (батч-резолв Конструктора и пр.) — не то же самое, что _confirmingArchetype:
    // тот теперь бывает false ровно тогда, когда строки выбора ждут ответа, и
    // «Далее» в этот момент как раз ДОЛЖНА быть кликабельна.
    if (this._advancingStep) return;
    this._advancingStep = true;
    try {
      if (this.step.id === "origin") {
        const done = await this._advanceOriginStep();
        if (!done) return;
      }
      if (this.step.id === "characteristics") {
        const ok = await this._confirmCharacteristics();
        if (!ok) { ui.notifications?.warn("Выберите Склонности — ровно 4 Характеристики и 4 прочих."); return; }
        // Родной мир с Int-зависимым выбором специализаций (см. Этап 1) —
        // применяем именно сейчас, Интеллект уже посчитан; строки читаем из
        // DOM формы этого же шага (_homeworldChoiceContext их сюда и
        // показывает), а не всплывающим Dialog.
        if (this._pendingHomeworldKey && needsIntBonusChoice(this._pendingHomeworldKey)) {
          const key = this._pendingHomeworldKey;
          const hw = HOMEWORLD_BY_KEY[key];
          this._pendingHomeworldKey = null;
          if (hw) {
            const picks = homeworldHasChoices(hw)
              ? readHomeworldChoicePicks(this.element, hw, this._hwTargetState)
              : {};
            await applyHomeworldPicks(this.actor, key, picks);
          }
        }
      }
      if (this.step.id === "archetype") {
        const done = await this._advanceArchetypeStep();
        if (!done) return;
      }
      if (this.step.id === "aspirations") await this._confirmAspirations();
      this._goStep(this.stepIndex + 1);
    } finally {
      this._advancingStep = false;
    }
  }

  /**
   * «Далее» на Этапе 1 — тот же конечный автомат, что _advanceArchetypeStep:
   * первый клик запускает применение Расы/Субразы/Легиона/Прошлого В ФОНЕ
   * (withMechCollector наполняет pendingMechChoices вместо диалогов вместо
   * прямых вопросов Механики), каждый следующий клик либо применяет ПАКЕТОМ
   * то, что сейчас стоит в строках (не переходя дальше — вложенный выбор
   * может раскрыться следующим кликом), либо, когда применение реально
   * завершилось и строк больше нет, довершает шаг и возвращает true.
   */
  async _advanceOriginStep() {
    const actor = this.actor;
    const sys = actor.system;
    // Проверка «раса выбрана» — только ПЕРЕД стартом применения. После него
    // sys.race читать для этого нельзя: applyRace (clearRace внутри) на всё
    // время своей работы, включая паузу на строках выбора Конструктора,
    // временно обнуляет system.race и восстанавливает его только в самом
    // конце — то есть посреди каскада выбора это поле ЗАКОНОМЕРНО пустое
    // (найдено живой проверкой: клик «Далее» на второй-третьей строке молча
    // выходил отсюда, будто раса не выбрана, и каскад «зависал»).
    if (!this._originApplyPromise && !sys.race) return false; // подстраховка — nextDisabled должен был отловить раньше

    // Снимок ДО applyRace: та пишет расовую часть суммы в те же поля, и без
    // снимка Этап 2 не отличил бы «персонаж только создаётся» от «Мастер
    // просто перезапущен на уже развитом персонаже». Место — здесь, а не в
    // хвосте (_finishOriginStep): к моменту хвоста applyRace могла уже
    // отработать и переписать поля характеристик.
    if (!this._wasEmpty) {
      const chars = actor.system.characteristics;
      this._wasEmpty = {};
      for (const k of [...CREATION_ROLL_CHARS, "inf"]) this._wasEmpty[k] = (chars[k]?.base || 0) === 0;
      this._wasEmpty.wounds = (actor.system.wounds?.max || 0) === 0;
    }

    if (!this._originApplyPromise && this._originAlreadyApplied()) {
      // Раса/Субраса уже применены в ПРОШЛЫЙ РАЗ (другой экземпляр Мастера,
      // переоткрытый на уже готовом акторе) — новых строк выбора не будет.
      // Проверка _originApplyPromise обязательна по той же причине, что и у
      // Архетипа (см. _advanceArchetypeStep): предмет-носитель Расы создаётся
      // СРАЗУ внутри applyRace, задолго до Mechanics-выборов, так что
      // actorRaceItem(actor) стало бы true уже после первого клика ЭТОЙ
      // сессии — без этого условия второй клик проскакивал бы сюда мимо
      // pendingMechChoices.
      await this._finishOriginStep();
      return true;
    }

    if (this.pendingMechChoices.length) {
      if (!this._allMechChoicesPicked()) return false; // подстраховка — nextDisabled должен был отловить раньше
      this._resolveAllPendingMechChoices();
      this.render(false);
      return false; // применение продолжает работу в фоне; следующий клик увидит новую партию либо конец
    }

    if (!this._originApplyPromise) {
      this._confirmingOrigin = true;
      this.render(false); // сразу показать «Применяется…», не дожидаясь первой строки выбора
      this._originApplyPromise = withMechCollector(this._mechCollector(), () => this._applyOriginItems())
        .finally(() => {
          this._confirmingOrigin = false;
          if (!this._isClosing) this.render(false); // без этого кнопка не «оживёт» сама, когда фон молча закончил
        });
      return false; // дать коллектору шанс наполнить первую партию строк
    }

    if (this._confirmingOrigin) return false; // всё ещё идёт молча (напр. бюджетная покупка в Обозревателе)

    await this._finishOriginStep();
    return true;
  }

  /** Раса и (если выбрана) Субраса уже стоят на акторе своими носителями. */
  _originAlreadyApplied() {
    const actor = this.actor;
    const sys = actor.system;
    if (sys.race && !actorRaceItem(actor)) return false;
    if (sys.subrace && !actorSubraceItem(actor)) return false;
    return true;
  }

  /**
   * Раса/субраса/легион/Прошлое были только зеркальными полями
   * (`system.race` и т.п.) — здесь они превращаются в настоящие выдачи
   * (embedded-предметы, Черты, характеристики расы), как при нажатии
   * «Применить» в шапке листа. Родной мир и Предсказание уже применены —
   * их дропдауны пишут сразу по выбору, как и на самом листе.
   */
  async _applyOriginItems() {
    const actor = this.actor;
    const sys = actor.system;
    const createTraits = (list, source) => actor.sheet?._createTraitsFromList?.(list, source);

    if (sys.race && !actorRaceItem(actor)) await applyRace(actor, sys.race);
    if (sys.subrace && !actorSubraceItem(actor)) await applySubrace(actor, sys.subrace);
    if (sys.race === "astartes" && sys.geneSeed?.legion) await applyLegion(actor, { createTraits });
    if (sys.race === "ynnari" && sys.ynnariPast) await applyYnnari(actor, { createTraits });
    if (sys.race === "harlequin" && sys.harlequinPast) await applyHarlequin(actor, { createTraits });
  }

  /** Хвост Этапа 1: флаг псайкера Азуриан — зависит от расы, а не от архетипа. */
  async _finishOriginStep() {
    const actor = this.actor;
    const sys = actor.system;
    const pastKey = sys.race === "ynnari" ? sys.ynnariPast : sys.race === "harlequin" ? sys.harlequinPast : "";
    if (sys.race === "azuriane" || pastKey === "azuriane") await actor.update({ "system.isPsyker": true });
    await this._applyPendingHomeworldChoice();
    await this._applyPendingDivinationChoice();
  }

  /**
   * Применяет отложенное Предсказание с инлайн-строками выбора (см.
   * _divinationChoiceContext) — читает ответы прямо из DOM формы шага, как
   * раньше их читал callback «Принять» в promptGrantChoices, только без
   * самого Dialog.
   */
  async _applyPendingDivinationChoice() {
    const key = this._pendingDivinationKey;
    if (!key) return;
    const def = DIVINATION_BY_KEY[key];
    this._pendingDivinationKey = null;
    const shape = { choices: def?.choices || [] };
    const picks = def && divinationHasChoices(def)
      ? readGrantChoicePicks(this.element, shape, this._dvTargetState)
      : {};
    await applyDivinationPicks(this.actor, key, picks);
  }

  /**
   * Применяет отложенный Родной мир с инлайн-строками выбора (см.
   * _homeworldChoiceContext) — читает ответы прямо из DOM формы шага, как
   * раньше их читал callback «Принять» в promptChoices, только без самого
   * Dialog. Int-зависимый мир (needsIntBonusChoice) сюда не попадает — его
   * строки только на Этапе 2, читает _applyPendingHomeworldChoiceOnStep2.
   */
  async _applyPendingHomeworldChoice() {
    const key = this._pendingHomeworldKey;
    if (!key || needsIntBonusChoice(key)) return;
    const hw = HOMEWORLD_BY_KEY[key];
    if (!hw) return;
    this._pendingHomeworldKey = null;
    const picks = homeworldHasChoices(hw)
      ? readHomeworldChoicePicks(this.element, hw, this._hwTargetState)
      : {};
    await applyHomeworldPicks(this.actor, key, picks);
  }
}

export function openCharacterWizard(actor) {
  if (!actor) return null;
  const app = new CharacterWizard(actor);
  app.render(true);
  return app;
}
