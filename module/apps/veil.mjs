// ════════════════════════════════════════════════════════════════════════
//  Завеса и Мистика — окно ГМа (Warhammer DBC).
//  • Отдельное окно (как Таро/Мастерская), кнопка в панели контролей —
//    видна только ГМу.
//  • Состояние ЗАВЕСЫ проецируется на СЦЕНУ (scene.flags), общее для всех.
//  • Вкладки: «Завеса» (плотность/факторы/события), «Ритуалы», «Навигация»
//    (навигаторы в Варпе), «Таро Императора», «Осквернение» (крафт
//    демон-оружия).
//  Редактирование — только ГМ.
//
//  29.08.2026: бросок ритуала теперь ДОСТУПЕН И С ЛИСТА ПЕРСОНАЖА (кнопка
//  «Провести ритуал» → module/sheets/ritual-cast-dialog.mjs) — тот путь не
//  требует ГМа и не даёт выбрать чужого Ритуалиста/пресет книги. Вкладка
//  «Ритуалы» здесь ВРЕМЕННО оставлена рядом для сравнения (решение
//  пользователя) и переписана как тонкая обёртка над той же математикой
//  (module/apps/ritual-cast.mjs: ritualThreshold/castRitual) — дублирования
//  расчёта между окном и диалогом больше нет, только выбор Ритуалиста/
//  предмета остаётся тут своим (актор ещё не известен, в отличие от кнопки
//  на его собственном листе). Пресет ритуала по имени книги (без предмета
//  на акторе) убран вместе с module/constants/ritual-presets.mjs — у всех
//  123 ритуалов книги теперь есть предмет в packs-src/rituals, отдельный
//  рукописный список стал чистым дублированием.
// ════════════════════════════════════════════════════════════════════════

import { VEIL_FACTORS, VEIL_EVENTS, WARP_GODS, warpGod, defaultVeil, veilTotal, veilLevelInfo, veilNavMod }
  from "../constants/veil.mjs";
import { RITUAL_TYPES, TEST_CHARS, RITUAL_SUMMON_MODS, CURSE_FAMILIARITY, CURSE_SYMPATHY,
         NUMEROLOGY, SUMMON_FORMS, buildRitualSkills, applyRitualItem } from "../constants/rituals.mjs";
import { ritualThreshold, castRitual, psykerMaxBonus } from "./ritual-cast.mjs";
import { TAROT_DECK, SUITS, SUIT_HINTS, TAROT_SPREADS, TAROT_GUIDE,
         cardByN, cardTitle, cardSuitLine, cardImgSrc } from "../constants/tarot.mjs";
import { DW_GODS, DW_GODS_MAP, DEMON_INF_FORMULAS, VESSEL_RESONANCE, VESSEL_RESONANCE_GROUPS,
         DEMON_WEAPON_COMMON, rollDemonProperty, propsFromRow, addFlatDamage } from "../constants/demon-weapon.mjs";
import { MOUNT_POSSESSION_COMMON, mountRitualMods, rollMountProperty, possessionFlags }
  from "../constants/mount-possession.mjs";
import { MOUNT_ACTOR_TYPES, isPossessed } from "../rules/mount.mjs";
import { JOURNEY_DURATION, GUIDE_ESTIMATE, ENTRY_LOCATIONS, jumpDurationMult,
         WARP_ENCOUNTERS, WARP_INVASIONS, INACCURATE_EXIT, WARP_STORMS, lookupTable, degWord }
  from "../constants/warp-travel.mjs";
import { ROUTE_ILLUMINATION, routeNavigationCap, routeEncounterCap } from "../rules/warp-route-traits.mjs";
import { routeKnowledgeMod } from "../rules/warp-route.mjs";
import { resolveRouteRows, routeKnowledgeLevelFor, effectiveIlluminationFor, allWarpRoutes }
  from "./warp-route.mjs";
import { GUIDE_KINDS, guideKindFor, guideNavPenalty, guideExitPenalty, guideEncounterBonus,
         guideRollsEncounterTwice, guideDecadeUpkeep, guideNeedsLoyaltyCheck } from "../rules/warp-guide.mjs";
import { plottingThresholdFor, routePointsFromTest, astromancyOutcome, chartingModifier,
         chartingBlocked, chartingOutcome, knowledgeFromCharting, upgradeKnowledge,
         passIncrement, PASSES_TO_LEARNED } from "../rules/warp-route-charting.mjs";
import { veilIcon } from "../constants/veil-icons.mjs";
import { refreshVeilOverlay } from "./veil-overlay.mjs";
import { resolveVeilContainer, currentScene, veilShift,
         readVeilForScene as readVeil, writeVeilForScene as writeVeil } from "../constants/scene-nexus.mjs";
import { esc } from "../helpers/utils.mjs";
import { addFatigue } from "../sheets/tabs/conditions.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, testCardHtml, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";

export { veilShift };

// Экспортированы для module/apps/scene-settings.mjs (wdbc-paif): единое окно
// «Сцена» держит СВОЁ состояние вкладки «Завеса» отдельно от EnvironmentApp,
// но заводит его тем же способом, что и конструктор VeilMystic — не дублируя
// исходные значения руками.
export function _newJourney() {
  return {
    shipId: "", gellar: "ok", occulum: "ok", warpEngineDmg: false, emergency: false,
    entryLoc: "mandeville",
    // Варп-маршрут (wdbc-r0w9) — выбирается на Шаге 0 вместо броска
    // «Стабильность»; Категория/Тип/Изученность/Освещённость/Стабильность
    // читаются с самого предмета (см. _journeyRouteItem/resolveRouteRows),
    // а не хранятся здесь отдельными полями — иначе они разошлись бы, если
    // ГМ поменяет маршрут посреди странствия.
    routeUuid: "", beaconSearched: false, omensUnsuppressed: false,
    // Проводники не-навигаторы (wdbc-r0w9): человеческая часть одержимого
    // подключилась к навигации — отменяет демонические штрафы Шага 4/5, но
    // добавляет свою Порчу (module/rules/warp-guide.mjs::guideDecadeUpkeep).
    possessedHumanCoNav: false,
    // Усталость Проводника (раздел «Проводники», wdbc-r0w9): без сознания при
    // T.b+W.b, дальше каждый бросок Столкновений — накопительный +10. Ключ —
    // id актора, не журнала: иначе при смене Проводника посреди странствия
    // статус «без сознания» перешёл бы на следующего вместе с ним (найдено
    // живой проверкой).
    guideStateByNav: {},
    baseDuration: null, beaconMod: 0, days: 0,
    senseSkill: "", navSkill: "", helmSkill: "",   // Навыки Проводника (Psyniscience/Navigation/Operate)
    // Прокладка новых маршрутов и Начертание (wdbc-r0w9.1/.2) — Навыки для
    // Обработки данных/Записи черновиков, копилка очков ЭТОГО рейса (сами
    // накопленные Очки Маршрута живут на предмете, не здесь — см.
    // module/data/item/warp-route.mjs::plotting), точность последнего Выхода.
    astroSkill: "", astrographerSkill: "", plottingRejsPoints: 0, plottingCanRecord: true, lastExitAccuracy: ""
  };
}

// Состояние вкладки «Ритуалы» ГМ-консоли: ритуалист/предмет ещё не выбраны
// (в отличие от диалога с листа персонажа, где оба уже известны) — форма
// начинается пустой, начальные числа как у ритуала книги «по умолчанию».
export function _newRitual() {
  return {
    ritualistId: "", itemId: "", name: "", type: "summon",
    skillValue: "", testChar: "", gmMod: -20,
    assistants: 0, assistSacrificed: 0, assistBonus: 10,
    summon: {}, curseFam: "close", curseSymp: {},
    numerology: {}, numMod: 0, psyker: false, psykerBonus: 0,
    aversionPerFail: 5
  };
}

// ── Таро: пустые слоты по спреду ──────────────────────────────────────────
export function _tarotSlots(spreadKey) {
  return (TAROT_SPREADS[spreadKey]?.positions || []).map(() => ({ cardN: null, reversed: false }));
}

// ── Осквернение (крафт демон-оружия): исходное состояние ──────────────────
export function _newDefile() {
  return {
    weaponUuid: "", god: "undivided", demonName: "",
    demonFormula: "lesser", demonWb: 4, demonInf: 8, binding: 3,
    resonance: {}, ironwork: 0, gmMod: 0,
    ritualistId: "", skillValue: "",   // ритуалист со сцены + его Навык (FL Демоны/Варп/Ересь)
    trueNameKnown: false, demonWilling: false, sacrificedAssist: 0
  };
}

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const FLAG_SCOPE = "warhammer-dbc";
const FLAG_KEY   = "veil";

// Подпись контейнера Завесы (имя группы или сцены) — для шапки окна.
function veilContainerLabel(scene) {
  const c = resolveVeilContainer(scene);
  return c.kind === "group" ? `Группа: ${c.label}` : (scene?.name || "— нет сцены —");
}

export class VeilMystic extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "wh-veil",
    classes: ["warhammer-dbc", "wh-holo", "wh-veil"],
    window: { title: "Завеса и Мистика", resizable: true },
    position: { width: 960, height: 800 }
  };

  static PARTS = {
    body: {
      template: "systems/warhammer-dbc/templates/apps/veil.hbs",
      root: true, scrollable: [".wh-veil-scroll"]
    }
  };

  constructor(...args) {
    super(...args);
    this.uiState = { tab: "veil", navId: "", godPicker: false };
    this.ritual = _newRitual();
    this.journey = _newJourney();
    this.tarot = { subtab: "reading", spread: "cross", question: "", teomant: "", quirit: "", slots: _tarotSlots("cross") };
    this.defile = _newDefile();
  }

  // ── Списки навигаторов сцены/мира ───────────────────────────────────────
  /**
   * Кандидаты в Проводники (раздел «Проводники», wdbc-r0w9) — не только
   * субраса navigator: психоактивные люди/астартес, демоны, одержимые,
   * принцы демонов тоже годятся, каждый по своим правилам (см.
   * module/rules/warp-guide.mjs::guideKindFor). Прежний фильтр «только
   * navigator» брал только character — теперь ещё daemon/demonPrince.
   */
  _navigators() {
    const eligibleTypes = ["character", "daemon", "demonPrince"];
    const fromTokens = (canvas?.tokens?.placeables || [])
      .map(t => t.actor).filter(a => eligibleTypes.includes(a?.type) && guideKindFor(a));
    const all = game.actors.filter(a => eligibleTypes.includes(a.type) && guideKindFor(a));
    const map = new Map();
    for (const a of [...fromTokens, ...all]) if (a && !map.has(a.id)) map.set(a.id, a);
    return [...map.values()];
  }

  // ── Данные движка ритуалов ──────────────────────────────────────────────
  _ritualActors() {
    // Только персонажи, чьи токены присутствуют на текущей сцене.
    const ids = new Set((canvas?.tokens?.placeables || []).map(t => t.actor?.id).filter(Boolean));
    return game.actors.filter(a => a.type === "character" && ids.has(a.id) && (game.user.isGM || a.isOwner))
      .map(a => ({ id: a.id, name: a.name }))
      .sort((x, y) => x.name.localeCompare(y.name, "ru"));
  }

  /**
   * Контекст вкладки «Ритуалы» — тонкая обёртка над ritualThreshold
   * (module/apps/ritual-cast.mjs): здесь только то, чего у диалога с листа
   * нет — выбор Ритуалиста среди присутствующих на сцене и выбор ЕГО
   * ритуала-предмета (у диалога оба уже даны кнопкой). Сама математика
   * порога/разбивки — общая с диалогом, не дублируется.
   */
  _ritualData() {
    const R = this.ritual;
    const actors = this._ritualActors();
    if (!actors.find(a => a.id === R.ritualistId)) R.ritualistId = actors[0]?.id || "";
    const actor = game.actors.get(R.ritualistId) || null;

    // Ритуалы, лежащие на Ритуалисте. Смена ритуалиста роняет выбор: чужой
    // предмет к нему отношения не имеет, а его требования гейтили бы не того.
    const ritualItems = (actor?.items ?? []).filter(i => i.type === "ritual");
    if (!ritualItems.find(i => i.id === R.itemId)) R.itemId = "";
    const ritualItem = ritualItems.find(i => i.id === R.itemId) || null;

    const skills = actor ? buildRitualSkills(actor) : [];
    if (!skills.find(s => s.value === R.skillValue)) R.skillValue = skills[0]?.value || "";
    if (!R.testChar) R.testChar = "int";

    const d = ritualThreshold(R, actor, ritualItem);
    const sgn = n => (n >= 0 ? "+" : "") + n;

    return {
      actors, hasActor: !!actor, ritualistName: actor?.name || "",
      types: RITUAL_TYPES.map(t => ({ ...t, selected: t.key === R.type })),
      isCurse: d.isCurse, isSummonLike: d.isSummonLike,
      name: R.name, gmMod: R.gmMod, assistants: R.assistants,
      assistSacrificed: R.assistSacrificed, assistBonus: R.assistBonus,
      skills: skills.map(s => ({ value: s.value, label: s.label, selected: s.value === R.skillValue })),
      testChars: TEST_CHARS.map(c => ({ ...c, selected: c.key === R.testChar })),
      summonMods: RITUAL_SUMMON_MODS.map(m => ({ ...m, signed: sgn(m.value), pos: m.value > 0, active: !!R.summon[m.key] })),
      famOptions: CURSE_FAMILIARITY.map(f => ({ ...f, signed: sgn(f.value), selected: f.key === R.curseFam })),
      sympMods: CURSE_SYMPATHY.map(m => ({ ...m, signed: sgn(m.value), active: !!R.curseSymp[m.key] })),
      numerology: NUMEROLOGY.map(n => ({ ...n, active: !!R.numerology[n.key] })),
      numMod: R.numMod, psyker: R.psyker, psykerBonus: R.psykerBonus, prMax: d.prMax,
      summonForms: SUMMON_FORMS,
      ritualItems: ritualItems.map(i => ({ id: i.id, name: i.name, selected: i.id === R.itemId })),
      hasRitualItems: ritualItems.length > 0,
      reqOk: d.reqOk, reqFailed: d.reqFailed,
      rows: d.rows, threshold: d.threshold, thresholdSigned: sgn(d.threshold),
      aversionPerFail: R.aversionPerFail
    };
  }

  /** Применить ритуал-предмет выбранного Ритуалиста: путь проведения из его полей. */
  _applyRitualItem(itemId) {
    const R = this.ritual;
    const actor = game.actors.get(R.ritualistId);
    const item = itemId ? actor?.items?.get(itemId) : null;
    if (!item) { R.itemId = ""; this.render(false); return; }
    Object.assign(R, applyRitualItem(actor, item, buildRitualSkills));
    this.render(false);
  }

  // ── Проведение ритуала: та же castRitual, что зовёт диалог с листа ───────
  async _castRitual() {
    const R = this.ritual;
    const actor = game.actors.get(R.ritualistId);
    if (!actor) { ui.notifications?.warn("Ритуал: выберите Ритуалиста."); return; }
    const ritualItems = (actor.items ?? []).filter(i => i.type === "ritual");
    const item = ritualItems.find(i => i.id === R.itemId) || null;
    await castRitual(R, actor, { item });
  }

  // ── Данные варп-путешествия ─────────────────────────────────────────────
  _jSkillTotal(actor, value) {
    if (!actor || !value) return null;
    return buildRitualSkills(actor).find(s => s.value === value)?.total ?? null;
  }
  _journeyData() {
    const J = this.journey;
    const ships = game.actors.filter(a => a.type === "ship" && (game.user.isGM || a.isOwner))
      .map(a => ({ id: a.id, name: a.name })).sort((x, y) => x.name.localeCompare(y.name, "ru"));
    if (!ships.find(s => s.id === J.shipId)) J.shipId = ships[0]?.id || "";
    const ship = game.actors.get(J.shipId) || null;
    const occMod = J.occulum === "damaged" ? -20 : (J.occulum === "destroyed" ? -40 : 0);

    // Навыки Проводника выбираются вручную (знания/навигация — не фиксированы).
    const nav = this._journeyNav();
    const skills = nav ? buildRitualSkills(nav) : [];
    const pick = (cur, hints) => {
      if (skills.find(s => s.value === cur)) return cur;
      const m = skills.find(s => hints.some(h => s.label.toLowerCase().includes(h)));
      return (m || skills[0])?.value || "";
    };
    J.senseSkill = pick(J.senseSkill, ["psynisc", "псио", "психонаук", "чуть"]);
    J.navSkill   = pick(J.navSkill,   ["navig", "навиг"]);
    J.helmSkill  = pick(J.helmSkill,  ["operate", "управл", "void", "пуст", "кораб"]);
    // Прокладка/Начертание (wdbc-r0w9.1/.2): Scholastic Lore (Astromancy) для
    // Обработки данных, Trade (Astrographer) для Записи черновиков.
    J.astroSkill        = pick(J.astroSkill,        ["astromancy", "астроманти"]);
    J.astrographerSkill = pick(J.astrographerSkill, ["astrograph", "астрограф"]);
    const opts = (cur) => skills.map(s => ({ value: s.value, label: s.label, selected: s.value === cur }));

    // Варп-маршрут (wdbc-r0w9) — выбирается на Шаге 0 вместо броска Стабильности
    // (сам маршрут — мировой предмет, генерируется на своём листе заранее).
    const routes = allWarpRoutes().map(r => ({ id: r.uuid, name: r.name }))
      .sort((x, y) => x.name.localeCompare(y.name, "ru"));
    if (!routes.find(r => r.id === J.routeUuid)) J.routeUuid = "";
    const route = this._journeyRouteItem();
    const rows = resolveRouteRows(route);
    const illumEff = route ? effectiveIlluminationFor(nav, route, rows) : null;
    const routeSummary = route
      ? [rows.category?.label, rows.routeType?.label, rows.lore?.label, illumEff?.label, rows.stability?.label]
          .filter(Boolean).join(" · ")
      : "";
    const navMod = this._occNavMod();

    // Усталость Проводника (wdbc-r0w9) — только для показа; сам счётчик живёт
    // на акторе (system.fatigue.value), не в journey.
    const fatigue = Number(nav?.system?.fatigue?.value) || 0;
    const fatigueThreshold = nav
      ? (nav.system?.characteristics?.t?.bonus || 0) + (nav.system?.characteristics?.wp?.bonus || 0) : 0;

    // Вид Проводника (раздел «Проводники», wdbc-r0w9) — навигатор, психоактивный,
    // демон, одержимый или принц демона; каждый по своим правилам.
    const guideKind = guideKindFor(nav);
    const decadeUpkeep = guideDecadeUpkeep(guideKind, J.possessedHumanCoNav);

    return {
      ships, shipId: J.shipId, shipName: ship?.name || "", hasNav: !!nav,
      gellar: J.gellar, occulum: J.occulum, warpEngineDmg: J.warpEngineDmg, emergency: J.emergency,
      entryLoc: J.entryLoc, entryLocations: ENTRY_LOCATIONS.map(l => ({ ...l, selected: l.key === J.entryLoc })),
      routes: routes.map(r => ({ ...r, selected: r.id === J.routeUuid })), routeUuid: J.routeUuid,
      hasRoute: !!route, routeName: route?.name || "", routeSummary,
      durationMult: rows.category?.durMult || 1,
      omensUnsuppressed: !!J.omensUnsuppressed,
      fatigue, fatigueThreshold, guideUnconscious: !!this._guideState(nav?.id).unconscious,
      guideKind, guideKindLabel: GUIDE_KINDS[guideKind]?.label || "",
      isPossessedGuide: guideKind === "possessed", possessedHumanCoNav: !!J.possessedHumanCoNav,
      hasDecadeUpkeep: !!(decadeUpkeep.corruption || decadeUpkeep.fatigue),
      needsLoyaltyCheck: guideNeedsLoyaltyCheck(guideKind),
      baseDuration: J.baseDuration, beaconMod: J.beaconMod, days: J.days,
      senseSkills: opts(J.senseSkill), navSkills: opts(J.navSkill), helmSkills: opts(J.helmSkill),
      astroSkills: opts(J.astroSkill), astrographerSkills: opts(J.astrographerSkill),
      occMod, navMod, occModSigned: (occMod >= 0 ? "+" : "") + occMod, navModSigned: (navMod >= 0 ? "+" : "") + navMod,
      // Прокладка новых маршрутов (wdbc-r0w9.1) — очки живут на предмете, тут только показ.
      isPlotting: !!route?.system.plotting?.active,
      plottingPoints: route?.system.plotting?.points || 0,
      plottingThreshold: route?.system.plotting?.threshold || 0,
      plottingRejsPoints: J.plottingRejsPoints || 0
    };
  }

  async _prepareContext(options) {
    const scene = currentScene();
    const v = readVeil(scene);
    const total = veilTotal(v);
    const info = veilLevelInfo(total);
    const isGM = game.user.isGM;

    // Активный ключ группы «демонический мир» (для радио-поведения)
    const factors = VEIL_FACTORS.map(f => ({
      key: f.key, label: f.label, value: f.value,
      signed: (f.value > 0 ? "+" : "") + f.value,
      pos: f.value > 0, neg: f.value < 0,
      group: f.group || "",
      active: !!v.factors[f.key]
    }));

    const rituals = (v.rituals || []).map((r, i) => ({
      idx: i, name: r.name || "Ритуал", delta: Number(r.delta) || 0,
      signed: ((Number(r.delta) || 0) > 0 ? "+" : "") + (Number(r.delta) || 0),
      active: !!r.active
    }));

    const log = (v.log || []).slice(0, 12).map(e => ({
      signed: ((Number(e.delta) || 0) > 0 ? "+" : "") + (Number(e.delta) || 0),
      pos: (Number(e.delta) || 0) > 0, neg: (Number(e.delta) || 0) < 0,
      note: e.note || "", when: e.time ? new Date(e.time).toLocaleTimeString("ru") : ""
    }));

    // Навигация
    const navs = this._navigators();
    let navId = this.uiState.navId;
    if (!navs.find(a => a.id === navId)) navId = navs[0]?.id || "";
    const navActor = navs.find(a => a.id === navId) || null;
    const journeyData = this._journeyData(); // сначала — чтобы навык навигации выбрался
    const navSkillTot = this._jSkillTotal(navActor, this.journey.navSkill);
    const navPowers = navActor
      ? navActor.items.filter(i => i.type === "navigatorPower").map(i => ({
          id: i.id, name: i.name,
          testChar: i.system.testChar || "", testMod: i.system.testMod || 0,
          action: i.system.action || "", range: i.system.range || "",
          sustainable: !!i.system.sustainable,
          effect: i.system.effect || i.system.description || ""
        }))
      : [];

    // Гейдж завесы: позиция мембраны 0..100 (0 = у Материума/плотно, 100 = у Варпа)
    const gauge = Math.max(0, Math.min(100, 50 + total * 9));

    // Доминирующий Бог (прорыв) — цвет ока Варпа и набор наваждений.
    const godMeta  = warpGod(v.god);
    const godColor = godMeta?.color || "";
    const gods     = WARP_GODS.map(g => ({ key: g.key, label: g.label, color: g.color, selected: g.key === v.god }));

    return {
      isGM,
      tab: this.uiState.tab,
      isVeil: this.uiState.tab === "veil",
      isRituals: this.uiState.tab === "rituals",
      isNav: this.uiState.tab === "nav",
      isTarot: this.uiState.tab === "tarot",
      isDefile: this.uiState.tab === "defile",
      tarot: this.uiState.tab === "tarot" ? this._tarotData() : null,
      defile: this.uiState.tab === "defile" ? this._defileData() : null,
      sceneName: veilContainerLabel(scene),
      base: v.base, manual: v.manual,
      total, totalSigned: (total > 0 ? "+" : "") + total,
      tier: info.tier, levelLabel: info.label, consequence: info.consequence,
      gauge,
      god: v.god, godMeta, godColor, gods, godPickerOpen: this.uiState.godPicker,
      ritual: this._ritualData(),
      journey: journeyData,
      factors, rituals, log,
      events: VEIL_EVENTS,
      // Навигация
      navigators: navs.map(a => ({ id: a.id, name: a.name, selected: a.id === navId })),
      hasNav: !!navActor,
      navName: navActor?.name || "",
      navHouse: navActor?.system?.navigatorHouse || "",
      navSkillTotal: navSkillTot,
      navMod: veilNavMod(total),
      navPowers,
      navPowerCount: navPowers.length
    };
  }

  // ═══════════════════ ТАРО ИМПЕРАТОРА ═══════════════════════════════════════
  _tarotUsedN(except = -1) {
    return new Set(this.tarot.slots.map((x, i) => (i === except ? null : x.cardN)).filter(Boolean));
  }
  _tarotRollSlot(i) {
    const used = this._tarotUsedN(i);
    const avail = TAROT_DECK.filter(c => !used.has(c.n));
    if (!avail.length) return;
    const card = avail[Math.floor(Math.random() * avail.length)];
    this.tarot.slots[i] = { cardN: card.n, reversed: Math.floor(Math.random() * 10) >= 5 };
  }
  _tarotRandomAll() { for (let i = 0; i < this.tarot.slots.length; i++) this._tarotRollSlot(i); }
  _tarotHint() {
    const drawn = this.tarot.slots.map(x => (x.cardN ? cardByN(x.cardN) : null)).filter(Boolean);
    if (!drawn.length) return "";
    const majors = drawn.filter(c => c.suit === "major");
    const counts = {};
    for (const c of drawn) if (c.suit !== "major") counts[c.suit] = (counts[c.suit] || 0) + 1;
    let dom = null, dn = 0;
    for (const k in counts) if (counts[k] > dn) { dn = counts[k]; dom = k; }
    const majTxt = majors.length
      ? `Тему задаёт Старшая Аркана: ${majors.map(m => m.name).join(", ")}.`
      : "Нет Старших Арканов — дело касается смертных.";
    const domTxt = dom ? ` Доминирует ${SUITS[dom]}: ${SUIT_HINTS[dom]}` : "";
    return majTxt + domTxt;
  }
  _tarotData() {
    const s = this.tarot;
    const sp = TAROT_SPREADS[s.spread];
    const tokens = (() => {
      const toks = canvas?.tokens?.placeables || [];
      let names = [...new Set(toks.map(t => t.name).filter(Boolean))];
      if (!names.length) names = game.actors.filter(a => a.type === "character").map(a => a.name);
      return names.sort((x, y) => x.localeCompare(y, "ru"));
    })();
    const suitGroups = Object.keys(SUITS).map(k => ({
      key: k, label: SUITS[k],
      cards: TAROT_DECK.filter(c => c.suit === k).map(c => ({ n: c.n, label: `${c.n}. ${cardTitle(c)}` }))
    }));
    const slots = sp.positions.map((pos, i) => {
      const sl = s.slots[i];
      const card = sl.cardN ? cardByN(sl.cardN) : null;
      return { i, name: pos.name, signal: !!pos.signal, cardN: sl.cardN || "", reversed: !!sl.reversed,
        card: card ? { title: cardTitle(card), suitLine: cardSuitLine(card), img: cardImgSrc(card),
          meaning: sl.reversed ? card.rev : card.up } : null };
    });
    const guideSuits = Object.keys(SUITS).map(k => ({
      key: k, label: SUITS[k], hint: SUIT_HINTS[k],
      cards: TAROT_DECK.filter(c => c.suit === k).map(c => ({ n: c.n, title: cardTitle(c), img: cardImgSrc(c), up: c.up, rev: c.rev, ch: c.ch }))
    }));
    return {
      isReading: s.subtab === "reading", isGuide: s.subtab === "guide",
      spreadKey: s.spread, spreadNote: sp.note,
      spreads: Object.entries(TAROT_SPREADS).map(([k, v]) => ({ key: k, label: v.label, selected: k === s.spread })),
      question: s.question, teomant: s.teomant, quirit: s.quirit,
      tokens, suitGroups, slots, readHint: this._tarotHint(),
      guide: TAROT_GUIDE, guideSuits
    };
  }
  _tarotPost() {
    const s = this.tarot;
    const sp = TAROT_SPREADS[s.spread];
    if (!s.slots.some(x => x.cardN)) { ui.notifications?.warn("Таро: ни одна карта не выбрана."); return; }
    const rows = sp.positions.map((pos, i) => {
      const sl = s.slots[i];
      const sig = pos.signal ? ` <span class="tc-sig">знаковая</span>` : "";
      if (!sl.cardN) return `<div class="wh-tarot-card empty"><div class="tc-pos">${esc(pos.name)}${sig}</div><div class="tc-empty">— не вытянута —</div></div>`;
      const c = cardByN(sl.cardN), rev = sl.reversed, img = cardImgSrc(c);
      const imgHtml = img ? `<div class="tc-frame"><img class="tc-art" src="${img}" data-title="${esc(cardTitle(c))}" alt="" title="Открыть карту"/></div>` : "";
      return `<div class="wh-tarot-card${rev ? " reversed" : ""}"><div class="tc-pos">${esc(pos.name)}${sig}</div>${imgHtml}<div class="tc-text"><div class="tc-name">${c.n}. ${esc(cardTitle(c))} <span class="tc-suit">(${esc(cardSuitLine(c))})</span></div><div class="tc-orient">${rev ? "⭮ Перевёрнутая" : "⭯ Прямая"}</div><div class="tc-mean">${esc(rev ? c.rev : c.up)}</div><div class="tc-change">${esc(c.ch)}</div></div></div>`;
    }).join("");
    const meta = [];
    if (s.teomant) meta.push(`<span class="tr-meta-i"><b>Теомант:</b> ${esc(s.teomant)}</span>`);
    if (s.quirit)  meta.push(`<span class="tr-meta-i"><b>Квирит:</b> ${esc(s.quirit)}</span>`);
    const metaHtml = meta.length ? `<div class="tr-meta">${meta.join("")}</div>` : "";
    const qHtml = s.question ? `<div class="tr-question">«${esc(s.question)}»</div>` : "";
    const hint = this._tarotHint();
    const hintHtml = hint ? `<div class="tr-hint">${esc(hint)}</div>` : "";
    // НЕ карточка теста (wdbc-kuun): ни броска, ни Порога. Разметка остаётся
    // своей и через testCardHtml не идёт: корень тут `wh-tarot-reading`, а
    // общий строитель всегда ставит на корень `wh-roll-result` — у того своя
    // рамка, отступы и ::before (styles/ui/chat.css), расклад бы поехал.
    // Общей стала только публикация: спикер-псевдоним Теомант/Таро.
    postTestCard(null,
      `<div class="wh-tarot-reading"><div class="tr-head">✦ ТАРО ИМПЕРАТОРА · ${esc(sp.label)} ✦</div>${qHtml}${metaHtml}<div class="tr-cards">${rows}</div>${hintHtml}</div>`,
      {
        sound: false, speaker: { alias: s.teomant ? `Теомант — ${s.teomant}` : "Таро Императора" },
        // Расклад Таро — не бросок против Порога, режим броска его не касается.
        ignoreRollMode: true
      });
  }

  // ═══════════════════ ОСКВЕРНЕНИЕ (крафт демон-оружия) ══════════════════════
  _defileWeapon() {
    const uuid = this.defile.weaponUuid;
    if (!uuid) return null;
    try { return fromUuidSync(uuid); } catch (e) { return null; }
  }
  _defileData() {
    const D = this.defile;
    const item = this._defileWeapon();
    // Сосудом бывает и скакун (стр. 478). Тогда резонанс оружия не собирается —
    // определять «Оружие Наследия» и «Примитивное» на живом звере нечем, — а
    // порог получает свои две поправки.
    const isMount = item?.documentName === "Actor";
    const wSys = isMount ? null : (item?.system || null);
    const godMeta = DW_GODS_MAP[D.god] || DW_GODS_MAP.undivided;

    // Резонанс сосуда: авто-детект из оружия + ручные чекбоксы.
    const auto = {};
    if (wSys) {
      if (wSys.legacyWeapon) auto.legacyFriend = true;   // Оружие Наследия (по умолчанию — дружественного)
      if (wSys.sacred)       auto.sacredDefile = true;
      if (wSys.quality === "best")   auto.qbest = true;
      if (wSys.quality === "common") auto.qcommon = true;
      if (wSys.quality === "poor")   auto.qpoor = true;
      if (wSys.weaponClass === "melee") auto.melee = true;
      const props = new Set((wSys.weaponProps || []).map(p => p.key));
      if (props.has("primitive")) auto.primitive = true;
      if (props.has("powerField") || /plasma|melta|плазм|мельт/i.test(wSys.weaponType || "")) auto.hitech = true;
    }
    const resGroups = VESSEL_RESONANCE_GROUPS.map(grp => ({
      group: grp,
      mods: VESSEL_RESONANCE.filter(m => m.group === grp).map(m => ({
        key: m.key, label: m.label, value: m.value, signed: (m.value > 0 ? "+" : "") + m.value,
        pos: m.value > 0, active: !!(D.resonance[m.key] ?? auto[m.key])
      }))
    }));
    let resonanceTotal = 0;
    for (const m of VESSEL_RESONANCE) {
      const on = (D.resonance[m.key] ?? auto[m.key]);
      if (on) resonanceTotal += m.value;
    }
    resonanceTotal += Number(D.ironwork || 0);  // −5..−30 доп. иконография → +резонанс

    // Ритуалист со сцены + его Навык (динамические знания: FL Демоны/Варп/Ересь).
    const actors = this._ritualActors();
    if (!actors.find(a => a.id === D.ritualistId)) D.ritualistId = actors[0]?.id || "";
    const actor = game.actors.get(D.ritualistId) || null;
    const available = actor ? buildRitualSkills(actor) : [];
    if (!available.find(o => o.value === D.skillValue)) {
      const pref = available.find(o => /демон|варп|ерес|forbidden|daemon|warp|heres/i.test(o.label));
      D.skillValue = pref?.value || available[0]?.value || "";
    }
    const skillOpt = available.find(o => o.value === D.skillValue) || null;
    const skillTotal = skillOpt ? skillOpt.total : -20;
    const lore = /ерес|heres/i.test(skillOpt?.label || "") ? "heresy"
               : /варп|warp/i.test(skillOpt?.label || "") ? "warp" : "daemons";
    const baseDiff = lore === "daemons" ? -50 : -60;

    // Порог ритуала: Навык(FL) − базовая сложность + модификаторы.
    const sgn = (n) => (n >= 0 ? "+" : "") + n;
    const infHalf = -Math.ceil((Number(D.demonInf) || 0) / 2);
    const rows = [
      { label: skillOpt ? `Навык: ${skillOpt.label}` : "— выберите навык —", val: skillTotal, primary: true },
      { label: `Базовая сложность (${lore === "daemons" ? "Демоны" : lore === "heresy" ? "Ересь" : "Варп"})`, val: baseDiff },
      ...(D.trueNameKnown ? [{ label: "Известно Истинное Имя", val: 20 }] : []),
      ...(D.demonWilling ? [{ label: "Демон желает заключения", val: 10 }] : []),
      { label: "½ Inf демона", val: infHalf },
      { label: "Резонанс сосуда", val: resonanceTotal },
      ...(isMount ? mountRitualMods(D.demonFormula) : []),
      ...(D.sacrificedAssist ? [{ label: `Жертвы-ассистенты ×${D.sacrificedAssist}`, val: D.sacrificedAssist * 10 }] : []),
      ...(D.gmMod ? [{ label: "ГМ-модификатор", val: Number(D.gmMod) }] : [])
    ].map(r => ({ ...r, signed: sgn(r.val) }));
    const threshold = rows.reduce((s, r) => s + r.val, 0);

    const propCount = Math.max(1, (Number(D.demonWb) || 1) - (Number(D.binding) || 0));

    // Строка под именем сосуда: у оружия это профиль, у скакуна — запас, по
    // которому его и опознают за столом (Раны у живого, Структура у байка).
    const mountLine = isMount
      ? (item.type === "vehicle"
          ? `Байк · AP ${item.system?.armour?.side ?? 0} · Структура ${item.system?.structure?.value ?? 0}/${item.system?.structure?.max ?? 0}`
          : `Скакун · Раны ${item.system?.wounds?.value ?? 0}/${item.system?.wounds?.max ?? 0}`)
      : "";

    return {
      hasWeapon: !!item,
      isMountVessel: isMount,
      weaponName: item?.name || "",
      weaponImg: item?.img || "",
      weaponLine: isMount ? mountLine
        : (wSys ? `${wSys.damage || "—"} · Pen ${wSys.penetration || 0} · ${wSys.quality || "common"}` : ""),
      alreadyDaemon: isMount ? isPossessed(item) : !!wSys?.daemonWeapon?.bound,
      gods: DW_GODS.map(g => ({ key: g.key, label: g.label, color: g.color, selected: g.key === D.god })),
      godMeta,
      formulas: DEMON_INF_FORMULAS.map(f => ({ ...f, selected: f.key === D.demonFormula })),
      demonName: D.demonName, demonWb: D.demonWb, demonInf: D.demonInf, binding: D.binding,
      ironwork: D.ironwork, gmMod: D.gmMod,
      actors: actors.map(a => ({ id: a.id, name: a.name, selected: a.id === D.ritualistId })),
      hasActor: !!actor, noActors: actors.length === 0,
      skills: available.map(o => ({ value: o.value, label: o.label, selected: o.value === D.skillValue })),
      skillTotal, skillTotalSigned: sgn(skillTotal),
      trueNameKnown: D.trueNameKnown, demonWilling: D.demonWilling, sacrificedAssist: D.sacrificedAssist,
      resGroups, resonanceTotal, resonanceSigned: sgn(resonanceTotal),
      rows, threshold, thresholdSigned: sgn(threshold),
      propCount, common: isMount ? MOUNT_POSSESSION_COMMON : DEMON_WEAPON_COMMON
    };
  }
  async _defileRitual() {
    const D = this.defile;
    const item = this._defileWeapon();
    if (!item) { ui.notifications?.warn("Осквернение: перетащите оружие-сосуд."); return; }
    if (item.system?.daemonWeapon?.bound) { ui.notifications?.warn("Это оружие уже демоническое."); return; }
    const data = this._defileData();
    // Ритуал Осквернения — тест Ритуалиста, и штрафы его состояния в него
    // входят (wdbc-9jj7). Порог собирался одной ритуальной арифметикой
    // (_defileData): ни Усталость, ни Черты до него не доезжали.
    // Ритуалист — владелец сосуда. Сосудом бывает и скакун (актор), у
    // которого владельца нет: тогда собирать не с кого, и сбор пуст, а не
    // подставляет случайного актора.
    const ritualist = item?.actor ?? null;
    const ruleMods = ritualist
      ? collectTestMods(ritualist, { kind: "skill", char: "wp" })
      : { total: 0, parts: [] };
    const threshold = data.threshold + ruleMods.total;
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total;
    const success = rv <= threshold;
    const dos = success ? (1 + Math.floor((threshold - rv) / 10)) : 0;
    const godMeta = data.godMeta;

    const vessel = data.isMountVessel ? "скакуна" : "оружие";
    let body = `<div class="wh-warp-card wv-defile-card" style="--gc:${godMeta.color}">
      <div class="roll-header">⚒ Ритуал Создания Демонического Оружия — ${esc(item.name)}</div>
      <div class="roll-outcome"><b>${rv}</b> vs Порог <b>${data.thresholdSigned}</b>${ruleMods.parts.map(p => ` ${p}`).join("")}${ruleMods.total ? ` = <b>${threshold}</b>` : ""} → ${success
        ? `<span class="roll-success">Успех (${dos} ст.)</span>` : `<span class="roll-failure">Провал</span>`}</div>`;
    if (success) {
      body += `<div class="dc-line">Демон вселён в ${vessel}. Связывание установлено до <b>${Math.min(dos, Number(D.binding) || 0) || dos}</b> (≤ успехов).</div>
        <div class="dc-line">Нажмите «Осквернить» на панели, чтобы применить свойства.</div>`;
    } else {
      body += `<div class="dc-line">Демон вырывается: Сосуд уничтожен, +5 ко всем Хар-кам демона и +2 Раны за каждый Провал Часов. Отвращение Варпа. Участники с Cor&lt;75 получают +1d5+1 Порчи.</div>`;
    }
    body += `<div class="dc-foot">Цена: Ритуалист и ассистенты — 2d10 урона во все Характеристики; Феномен.</div></div>`;
    // Это ТЕСТ (бросок против Порога), но разметка остаётся своей: корень —
    // wv-defile-card с цветом бога в inline-стиле и БЕЗ wh-roll-result,
    // который общий строитель ставит всегда (своя рамка и отступы в
    // styles/ui/chat.css). Общей стала публикация: спикер «Кузница Душ».
    await postTestCard(null, body, { sound: false, speaker: { alias: "Кузница Душ" } });
    this._defileLastSuccess = success ? { dos } : null;
    this.render(false);
  }
  async _defileApply() {
    const D = this.defile;
    const item = this._defileWeapon();
    if (!item) { ui.notifications?.warn("Осквернение: перетащите оружие-сосуд."); return; }
    if (item.documentName === "Actor") return this._defileApplyMount(item);
    if (item.system?.daemonWeapon?.bound) { ui.notifications?.warn("Это оружие уже демоническое."); return; }
    const wb = Math.max(1, Number(D.demonWb) || 1);
    const binding = Math.max(0, Number(D.binding) || 0);
    const count = Math.max(1, wb - binding);
    const godMeta = DW_GODS_MAP[D.god] || DW_GODS_MAP.undivided;

    // Генерация N свойств: минимум одно по таблице бога (если не Неделимый), остальные — Неделимый/бог.
    const generated = [];
    const usedNames = new Set();
    for (let n = 0; n < count; n++) {
      const useGod = (D.god !== "undivided") && (n === 0 || Math.random() < 0.5) ? D.god : "undivided";
      let r, guard = 0;
      do { r = rollDemonProperty(useGod); guard++; } while (usedNames.has(r.name) && guard < 12);
      usedNames.add(r.name);
      generated.push(r);
    }

    // Снимок исходного состояния — для корректного возврата при освобождении демона.
    const preProps  = foundry.utils.deepClone(item.system.weaponProps || []);
    const preDamage = item.system.damage || "";
    const prePen    = Number(item.system.penetration) || 0;
    const preKeys   = new Set(preProps.map(p => p.key));

    // Свойства оружия: базовые демон-свойства + сгенерированные prop'ы (авто).
    let props = foundry.utils.deepClone(preProps);
    const addProp = (p) => { if (!p?.key) return; const ex = props.find(x => x.key === p.key); if (ex) { if (p.rating != null) ex.rating = Math.max(ex.rating || 0, p.rating); } else props.push(p); };
    props = props.filter(p => p.key !== "primitive" && p.key !== "sanctified"); // теряет Primitive/Sanctified
    addProp({ key: "reinforced" });
    for (const g of generated) for (const p of propsFromRow(g.prop, wb)) addProp(p);

    // +W.b к Dmg и Pen (Dmg — правим строку, Pen — число).
    const newDamage = addFlatDamage(preDamage, wb);
    const newPen    = prePen + wb;

    const propertiesStore = generated.map(g => ({ god: g.god, godLabel: (DW_GODS_MAP[g.god]?.label || "Неделимый"), name: g.name, text: g.text, roll: g.total }));

    await item.update({
      "system.weaponProps": props,
      "system.damage": newDamage,
      "system.penetration": newPen,
      "system.daemonWeapon": {
        bound: true, god: D.god, demonName: D.demonName || "",
        binding, demonWb: wb, demonInf: Number(D.demonInf) || 0,
        subdued: !!D.demonWilling, runic: false, properties: propertiesStore,
        preProps, preDamage, prePen
      }
    });

    // Не тест (броска нет), и разметка та же своя, что у _defileRitual выше:
    // wv-defile-card без wh-roll-result. Общая — публикация («Кузница Душ»).
    const propHtml = generated.map(g => `<div class="dc-prop"><span class="dc-prop-god" style="color:${(DW_GODS_MAP[g.god]?.color)||'#b477ff'}">${(DW_GODS_MAP[g.god]?.label)||'Неделимый'}</span> <b>${esc(g.name)}</b> — ${esc(g.text)}</div>`).join("");
    await postTestCard(null, `<div class="wh-warp-card wv-defile-card" style="--gc:${godMeta.color}">
        <div class="roll-header">⛧ ${esc(item.name)} осквернено — Демоническое Оружие</div>
        <div class="dc-line">Связывание ${binding} · W.b демона ${wb} · +${wb} к Dmg/Pen · Reinforced · теряет Primitive/Sanctified.</div>
        <div class="dc-props">${propHtml}</div>
        <div class="dc-foot">Игнорирует T.b и иммунитеты Daemonic/Stuff of Nightmares; не тратит боеприпасы; игнорирует Haywire.</div>
      </div>`, {
      sound: false, speaker: { alias: "Кузница Душ" },
      // Не бросок, а выпавшие оружию свойства: скрытый режим броска не должен
      // прятать от игрока то, что он получил (wdbc-kuun, решение по вопросу
      // агента при переводе).
      ignoreRollMode: true
    });
    this._defileLastSuccess = null;
    this.render(false);
  }

  /**
   * Осквернение СКАКУНА или байка (стр. 478). Отдельный путь, а не ветка в
   * _defileApply: у скакуна своя таблица свойств (одна на всех богов), нет
   * профиля оружия, который надо править и потом возвращать, а результат
   * ложится флагом на актора — оттуда его читает верховой бой (rules/mount.mjs).
   */
  async _defileApplyMount(mount) {
    const D = this.defile;
    if (isPossessed(mount)) { ui.notifications?.warn("Этот скакун уже одержим."); return; }
    const wb = Math.max(1, Number(D.demonWb) || 1);
    const binding = Math.max(0, Number(D.binding) || 0);
    const count = Math.max(1, wb - binding);
    const godMeta = DW_GODS_MAP[D.god] || DW_GODS_MAP.undivided;

    // Свойства не повторяются: список короткий, и дубль «Скорость ×2» книга не
    // подразумевает. Ограничитель на случай, если свойств просят больше строк.
    const generated = [];
    const used = new Set();
    for (let n = 0; n < count; n++) {
      let r, guard = 0;
      do { r = rollMountProperty(); guard++; } while (used.has(r.name) && guard < 20);
      used.add(r.name);
      generated.push(r);
    }

    const properties = generated.map(g => ({ name: g.name, text: g.text, flag: g.flag, roll: g.total }));
    const update = {
      "flags.warhammer-dbc.mountPossession": {
        god: D.god, demonName: D.demonName || "",
        binding, demonInf: Number(D.demonInf) || 0,
        subdued: !!D.demonWilling, properties,
        ...possessionFlags(properties, wb)
      }
    };

    // Два свойства правят сам сосуд, а не расчёты вокруг него, и потому
    // применяются здесь же, разово: «Укрепление» (+10 Ран или Структуры) и
    // «Скорость» (+W.b к SPD). Всё остальное живёт флагом — его читает
    // верховой бой при каждом тесте.
    if (properties.some(p => p.flag === "reinforced")) {
      if (mount.type === "vehicle") {
        const s = mount.system.structure ?? {};
        update["system.structure.max"]   = (Number(s.max) || 0) + 10;
        update["system.structure.value"] = (Number(s.value) || 0) + 10;
      } else {
        const w = mount.system.wounds ?? {};
        update["system.wounds.max"]   = (Number(w.max) || 0) + 10;
        update["system.wounds.value"] = (Number(w.value) || 0) + 10;
      }
    }
    if (properties.some(p => p.flag === "speed")) {
      if (mount.type === "vehicle") {
        update["system.chassis.spd"] = (Number(mount.system.chassis?.spd) || 0) + wb;
      } else {
        // У существа SPD выводится из Ag и Размера; прибавка идёт тем же
        // входным полем, которым пользуются Черты и Конструктор.
        update["system.movement.spdBonus"] = (Number(mount.system.movement?.spdBonus) || 0) + wb;
      }
    }
    await mount.update(update);

    // Общие свойства Одержимых: «Получает Трейты Daemonic (W.b демона) и Stuff
    // of Nightmares» (стр. 478). Черты живут в двух паках — у существ свои, у
    // техники свои, — поэтому берётся тот, что соответствует сосуду.
    const granted = await this._grantPossessionTraits(mount, wb);

    // Не тест, и разметка та же своя, что у _defileApply выше. Общая —
    // публикация («Кузница Душ»).
    const propHtml = generated.map(g =>
      `<div class="dc-prop"><b>${esc(g.name)}</b> — ${esc(g.text)}</div>`).join("");
    await postTestCard(null, `<div class="wh-warp-card wv-defile-card" style="--gc:${godMeta.color}">
        <div class="roll-header">⛧ ${esc(mount.name)} осквернён — Одержимый ${mount.type === "vehicle" ? "байк" : "скакун"}</div>
        <div class="dc-line">Связывание ${binding} · W.b демона ${wb} · Демонических свойств: ${count}.</div>
        ${granted.length ? `<div class="dc-line">Выданы Трейты: ${granted.map(esc).join(", ")}.</div>` : ""}
        <div class="dc-props">${propHtml}</div>
        <div class="dc-foot">${MOUNT_POSSESSION_COMMON.map(esc).join(" ")}</div>
      </div>`, {
      sound: false, speaker: { alias: "Кузница Душ" },
      // Не бросок, а выпавшие оружию свойства: скрытый режим броска не должен
      // прятать от игрока то, что он получил (wdbc-kuun, решение по вопросу
      // агента при переводе).
      ignoreRollMode: true
    });
    this._defileLastSuccess = null;
    this.render(false);
  }

  /**
   * Выдаёт сосуду Daemonic (W.b) и Stuff of Nightmares. Черта берётся из пака
   * по типу сосуда: у существ они лежат в `traits`, у техники — в
   * `vehicle-traits` (заведены под Одержимость, стр. 478). Уже имеющиеся
   * Черты не задваиваются, а Daemonic получает рейтинг демона.
   * @returns {Promise<string[]>} имена выданных Черт
   */
  async _grantPossessionTraits(mount, wb) {
    const isVehicle = mount.type === "vehicle";
    const pack = game.packs.get(isVehicle ? "warhammer-dbc.vehicle-traits" : "warhammer-dbc.traits");
    if (!pack) return [];
    const wanted = isVehicle
      ? [{ starts: "Daemonic (", rating: wb }, { starts: "Stuff of Nightmares", rating: null }]
      : [{ starts: "Daemonic /", rating: wb }, { starts: "Stuff of Nightmares", rating: null }];

    const docs = await pack.getDocuments();
    const created = [];
    for (const w of wanted) {
      const src = docs.find(d => d.name.startsWith(w.starts));
      if (!src) continue;
      const bare = src.name.replace(/\s*\([^)]*\)/g, "");
      if (mount.items.some(i => i.name.replace(/\s*\([^)]*\)/g, "") === bare)) continue;
      const data = src.toObject();
      delete data._id;
      if (w.rating != null) {
        data.system.rating = w.rating;
        data.name = src.name.replace(/\(X\)/g, `(${w.rating})`);
      }
      created.push(data);
    }
    if (!created.length) return [];
    const made = await mount.createEmbeddedDocuments("Item", created);
    return made.map(i => i.name);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    const rr = () => this.render(false);
    const isGM = game.user.isGM;

    // Вкладки
    el.querySelectorAll("[data-tab]").forEach(b =>
      b.addEventListener("click", () => { this.uiState.tab = b.dataset.tab; rr(); }));

    // ── Таро Императора (подвкладки, расклад) ─────────────────────────────
    if (this.uiState.tab === "tarot") {
      const S = this.tarot;
      el.querySelectorAll("[data-ttab]").forEach(b => b.addEventListener("click", () => { S.subtab = b.dataset.ttab; rr(); }));
      el.querySelector("[name=tspread]")?.addEventListener("change", e => { S.spread = e.target.value; S.slots = _tarotSlots(S.spread); rr(); });
      el.querySelector("[name=tquestion]")?.addEventListener("change", e => { S.question = e.target.value; });
      el.querySelector("[name=tteomant]")?.addEventListener("change", e => { S.teomant = e.target.value; });
      el.querySelector("[name=tquirit]")?.addEventListener("change", e => { S.quirit = e.target.value; });
      el.querySelectorAll("[data-tpick]").forEach(sel => sel.addEventListener("change", e => { if (!e.target.value) return; S[sel.dataset.tpick] = e.target.value; rr(); }));
      el.querySelectorAll("[data-tcardsel]").forEach(sel => sel.addEventListener("change", e => { const i = Number(sel.dataset.tcardsel); S.slots[i].cardN = e.target.value ? Number(e.target.value) : null; rr(); }));
      el.querySelectorAll("[data-torient]").forEach(sel => sel.addEventListener("change", e => { const i = Number(sel.dataset.torient); S.slots[i].reversed = e.target.value === "rev"; rr(); }));
      el.querySelectorAll("[data-trollslot]").forEach(b => b.addEventListener("click", () => { this._tarotRollSlot(Number(b.dataset.trollslot)); rr(); }));
      el.querySelector("[data-act=trandomall]")?.addEventListener("click", () => { this._tarotRandomAll(); rr(); });
      el.querySelector("[data-act=tclear]")?.addEventListener("click", () => { S.slots = _tarotSlots(S.spread); rr(); });
      el.querySelector("[data-act=tpost]")?.addEventListener("click", () => this._tarotPost());
    }

    // ── Осквернение (крафт демон-оружия) ──────────────────────────────────
    if (this.uiState.tab === "defile") {
      const D = this.defile;
      const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
      const dz = el.querySelector("[data-defiledrop]");
      if (dz) {
        dz.addEventListener("dragover", ev => { ev.preventDefault(); dz.classList.add("dragover"); });
        dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
        dz.addEventListener("drop", async ev => {
          ev.preventDefault(); dz.classList.remove("dragover");
          try {
            const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
            let doc = null;
            if (data?.uuid) doc = await fromUuid(data.uuid);
            // Со сцены приходит Токен — сосудом становится его актор.
            if (doc?.documentName === "Token") doc = doc.actor;
            if (doc?.documentName === "Item" && doc.type === "weapon") { D.weaponUuid = doc.uuid; rr(); }
            // Сосудом бывает и скакун: тот же ритуал, но своя таблица свойств и
            // две поправки порога (стр. 478).
            else if (doc?.documentName === "Actor" && MOUNT_ACTOR_TYPES.includes(doc.type)) { D.weaponUuid = doc.uuid; rr(); }
            else ui.notifications?.warn("Перетащите оружие-сосуд или актора-скакуна (байк).");
          } catch (e) { ui.notifications?.warn("Не удалось прочитать перетащенный объект."); }
        });
      }
      el.querySelector("[data-act=defileClear]")?.addEventListener("click", () => { D.weaponUuid = ""; rr(); });
      el.querySelectorAll("[data-defgod]").forEach(b => b.addEventListener("click", () => { D.god = b.dataset.defgod; rr(); }));
      el.querySelector("[name=defFormula]")?.addEventListener("change", e => {
        D.demonFormula = e.target.value;
        const f = DEMON_INF_FORMULAS.find(x => x.key === e.target.value);
        if (f) { D.demonWb = f.wb; } rr();
      });
      el.querySelector("[name=defDemonName]")?.addEventListener("change", e => { D.demonName = e.target.value; });
      el.querySelector("[name=defWb]")?.addEventListener("change", e => { D.demonWb = Math.max(1, num(e.target.value, 1)); rr(); });
      el.querySelector("[name=defInf]")?.addEventListener("change", e => { D.demonInf = Math.max(0, num(e.target.value)); rr(); });
      el.querySelector("[name=defBinding]")?.addEventListener("change", e => { D.binding = Math.max(0, num(e.target.value)); rr(); });
      el.querySelector("[name=defRitualist]")?.addEventListener("change", e => { D.ritualistId = e.target.value; D.skillValue = ""; rr(); });
      el.querySelector("[name=defSkill]")?.addEventListener("change", e => { D.skillValue = e.target.value; rr(); });
      el.querySelector("[name=defIronwork]")?.addEventListener("change", e => { D.ironwork = Math.max(0, Math.min(30, num(e.target.value))); rr(); });
      el.querySelector("[name=defGmMod]")?.addEventListener("change", e => { D.gmMod = num(e.target.value); rr(); });
      el.querySelector("[name=defSacrifice]")?.addEventListener("change", e => { D.sacrificedAssist = Math.max(0, num(e.target.value)); rr(); });
      el.querySelector("[name=defTrueName]")?.addEventListener("change", e => { D.trueNameKnown = e.target.checked; rr(); });
      el.querySelector("[name=defWilling]")?.addEventListener("change", e => { D.demonWilling = e.target.checked; rr(); });
      el.querySelectorAll("[data-defres]").forEach(cb => cb.addEventListener("change", e => { D.resonance[cb.dataset.defres] = e.target.checked; rr(); }));
      el.querySelector("[data-act=defileRitual]")?.addEventListener("click", () => this._defileRitual());
      el.querySelector("[data-act=defileApply]")?.addEventListener("click", () => this._defileApply());
    }

    // ── Навигация: выбор навигатора / бросок ──────────────────────────────
    el.querySelector("[name=navPick]")?.addEventListener("change", e => { this.uiState.navId = e.target.value; rr(); });
    el.querySelector("[data-act=navRoll]")?.addEventListener("click", () => this._rollNavigation());
    el.querySelectorAll("[data-navpower]").forEach(row =>
      row.addEventListener("click", () => this._postNavPower(row.dataset.navpower)));

    // ── Варп-путешествие ──────────────────────────────────────────────────
    const J = this.journey;
    const rrJ = () => this.render(false);
    el.querySelector("[name=jShip]")?.addEventListener("change", e => { J.shipId = e.target.value; rrJ(); });
    el.querySelector("[name=jSense]")?.addEventListener("change", e => { J.senseSkill = e.target.value; rrJ(); });
    el.querySelector("[name=jNav]")?.addEventListener("change", e => { J.navSkill = e.target.value; rrJ(); });
    el.querySelector("[name=jHelm]")?.addEventListener("change", e => { J.helmSkill = e.target.value; rrJ(); });
    el.querySelector("[name=jAstro]")?.addEventListener("change", e => { J.astroSkill = e.target.value; rrJ(); });
    el.querySelector("[name=jAstrographer]")?.addEventListener("change", e => { J.astrographerSkill = e.target.value; rrJ(); });
    el.querySelector("[name=jGellar]")?.addEventListener("change", e => { J.gellar = e.target.value; rrJ(); });
    el.querySelector("[name=jOcculum]")?.addEventListener("change", e => { J.occulum = e.target.value; rrJ(); });
    el.querySelector("[name=jEntry]")?.addEventListener("change", e => { J.entryLoc = e.target.value; rrJ(); });
    el.querySelector("[name=jEngine]")?.addEventListener("change", e => { J.warpEngineDmg = e.target.checked; rrJ(); });
    el.querySelector("[name=jEmergency]")?.addEventListener("change", e => { J.emergency = e.target.checked; rrJ(); });
    el.querySelector("[name=jDays]")?.addEventListener("change", e => { J.days = parseInt(e.target.value) || 0; });
    // Варп-маршрут (wdbc-r0w9) — выбор вместо броска «Стабильность»; сброс
    // beaconSearched при смене маршрута, иначе повторный поиск маяка на новом
    // маршруте посчитался бы с колонкой «Повторный» по инерции от старого.
    el.querySelector("[name=jRoute]")?.addEventListener("change", e => {
      J.routeUuid = e.target.value; J.beaconSearched = false; rrJ();
    });
    el.querySelector("[name=jBadOmens]")?.addEventListener("change", e => { J.omensUnsuppressed = e.target.checked; rrJ(); });
    el.querySelector("[name=jPossessedCoNav]")?.addEventListener("change", e => { J.possessedHumanCoNav = e.target.checked; rrJ(); });
    const jMap = {
      jDuration: "_rollDuration", jOmens: "_readOmens",
      jEnter: "_enterWarp", jBeacon: "_findBeacon", jDirect: "_directShip",
      jEncounter: "_warpEncounter", jInvasion: "_warpInvasion", jExit: "_exitWarp", jStorm: "_warpStorm",
      jFatigueDay: "_tickGuideFatigueDay", jDecadeUpkeep: "_tickGuideDecadeUpkeep", jLoyalty: "_daemonLoyaltyReminder",
      jPlotProcess: "_processPlottingData", jChart: "_chartRoute"
    };
    for (const [act, fn] of Object.entries(jMap))
      el.querySelector(`[data-act=${act}]`)?.addEventListener("click", () => this[fn]());
    el.querySelector("[data-act=jReset]")?.addEventListener("click", () => { this.journey = _newJourney(); rrJ(); });

    // ── Движок ритуалов (доступен ГМу и владельцам актёров) ───────────────
    const R = this.ritual;
    const rr2 = () => this.render(false);
    const bindR = (name, key, num = false) =>
      el.querySelector(`[name=${name}]`)?.addEventListener("change", e => {
        R[key] = num ? (parseInt(e.target.value) || 0) : e.target.value; rr2();
      });
    bindR("ritActor", "ritualistId"); bindR("ritType", "type"); bindR("ritSkill", "skillValue");
    bindR("ritChar", "testChar");
    bindR("ritGmMod", "gmMod", true); bindR("ritAssist", "assistants", true);
    bindR("ritAssistSac", "assistSacrificed", true);
    bindR("ritAssistB", "assistBonus", true); bindR("ritNumMod", "numMod", true);
    bindR("ritPerFail", "aversionPerFail", true); bindR("ritCurseFam", "curseFam");
    el.querySelectorAll("[data-num]").forEach(cb => cb.addEventListener("change", e => {
      R.numerology[cb.dataset.num] = e.target.checked; rr2();
    }));
    el.querySelector("[name=ritItem]")?.addEventListener("change", e => this._applyRitualItem(e.target.value));
    el.querySelector("[name=ritName]")?.addEventListener("change", e => { R.name = e.target.value; });
    // Псайкер-Ритуалист (стр. 393): «может выбрать получить бонус ДО +2×PR» —
    // галочка сама подставляет максимум, а не заставляет искать/множить PR
    // вручную; поле бонуса остаётся редактируемым, если психик хочет взять
    // меньше (тот же бонус летит и в бросок провала — риск, а не чистый плюс).
    el.querySelector("[name=ritPsyker]")?.addEventListener("change", e => {
      R.psyker = e.target.checked;
      R.psykerBonus = R.psyker ? psykerMaxBonus(game.actors.get(R.ritualistId)) : 0;
      rr2();
    });
    el.querySelector("[name=ritPsykerB]")?.addEventListener("change", e => { R.psykerBonus = parseInt(e.target.value) || 0; rr2(); });
    el.querySelectorAll("[data-summon]").forEach(cb => cb.addEventListener("change", e => {
      R.summon[cb.dataset.summon] = e.target.checked; rr2();
    }));
    el.querySelectorAll("[data-symp]").forEach(cb => cb.addEventListener("change", e => {
      R.curseSymp[cb.dataset.symp] = e.target.checked; rr2();
    }));
    el.querySelector("[data-act=castRitual]")?.addEventListener("click", () => this._castRitual());

    if (!isGM) return; // Дальше — только редактирование ГМ (Завеса/Ритуалы сцены)

    const scene = currentScene();

    // Око Варпа — выбор прорыва конкретного Бога
    el.querySelector("[data-act=godpick]")?.addEventListener("click", () => {
      this.uiState.godPicker = !this.uiState.godPicker; rr();
    });
    el.querySelectorAll("[data-setgod]").forEach(b => b.addEventListener("click", async () => {
      this.uiState.godPicker = false;
      const v = readVeil(scene); v.god = b.dataset.setgod || ""; await writeVeil(scene, v);
    }));

    // Факторы (чекбоксы; демонический мир — взаимоисключающе)
    el.querySelectorAll("[data-factor]").forEach(cb => cb.addEventListener("change", async e => {
      const key = cb.dataset.factor;
      const grp = cb.dataset.group || "";
      const v = readVeil(scene);
      v.factors[key] = e.target.checked;
      if (grp && e.target.checked) {
        for (const f of VEIL_FACTORS) if (f.group === grp && f.key !== key) v.factors[f.key] = false;
      }
      await writeVeil(scene, v);
    }));

    // База / ручной сдвиг
    el.querySelector("[name=base]")?.addEventListener("change", async e => {
      const v = readVeil(scene); v.base = parseInt(e.target.value) || 0; await writeVeil(scene, v);
    });
    el.querySelector("[name=manual]")?.addEventListener("change", async e => {
      const v = readVeil(scene); v.manual = parseInt(e.target.value) || 0; await writeVeil(scene, v);
    });
    el.querySelectorAll("[data-nudge]").forEach(b => b.addEventListener("click", async () => {
      const v = readVeil(scene); v.manual = (v.manual || 0) + Number(b.dataset.nudge); await writeVeil(scene, v);
    }));

    // Быстрые события Варпа
    el.querySelectorAll("[data-event]").forEach(b => b.addEventListener("click", async () => {
      const ev = VEIL_EVENTS.find(x => x.key === b.dataset.event);
      if (!ev) return;
      const v = readVeil(scene);
      v.manual = (v.manual || 0) + ev.delta;
      v.log = [{ delta: ev.delta, note: ev.label, time: Date.now() }, ...(v.log || [])].slice(0, 30);
      await writeVeil(scene, v);
    }));

    el.querySelector("[data-act=clearlog]")?.addEventListener("click", async () => {
      const v = readVeil(scene); v.log = []; await writeVeil(scene, v);
    });
    // Селектор скопирован в границы своего контейнера (.wh-veil-app) — на
    // общей странице «Сцена» (scene-settings.mjs) el общий для Окружения и
    // Завесы, а у обеих кнопок одинаковый data-act=reset (wdbc-gyj: без
    // .wh-veil-app querySelector на общем корне находил кнопку Окружения,
    // которая идёт в разметке первой, и своя кнопка сброса Завесы не
    // срабатывала вовсе).
    el.querySelector(".wh-veil-app [data-act=reset]")?.addEventListener("click", async () => {
      await writeVeil(scene, defaultVeil());
    });
    el.querySelector("[data-act=announce]")?.addEventListener("click", () => this._announce());

    // ── Ритуалы ───────────────────────────────────────────────────────────
    el.querySelector("[data-act=ritualAdd]")?.addEventListener("click", async () => {
      const v = readVeil(scene);
      v.rituals = [...(v.rituals || []), { name: "Новый ритуал", delta: -1, active: true }];
      await writeVeil(scene, v);
    });
    el.querySelectorAll("[data-ritual-name]").forEach(inp => inp.addEventListener("change", async e => {
      const i = Number(inp.dataset.ritualName); const v = readVeil(scene);
      if (v.rituals[i]) { v.rituals[i].name = e.target.value; await writeVeil(scene, v); }
    }));
    el.querySelectorAll("[data-ritual-delta]").forEach(inp => inp.addEventListener("change", async e => {
      const i = Number(inp.dataset.ritualDelta); const v = readVeil(scene);
      if (v.rituals[i]) { v.rituals[i].delta = parseInt(e.target.value) || 0; await writeVeil(scene, v); }
    }));
    el.querySelectorAll("[data-ritual-active]").forEach(cb => cb.addEventListener("change", async e => {
      const i = Number(cb.dataset.ritualActive); const v = readVeil(scene);
      if (v.rituals[i]) { v.rituals[i].active = e.target.checked; await writeVeil(scene, v); }
    }));
    el.querySelectorAll("[data-ritual-del]").forEach(b => b.addEventListener("click", async () => {
      const i = Number(b.dataset.ritualDel); const v = readVeil(scene);
      v.rituals.splice(i, 1); await writeVeil(scene, v);
    }));
  }

  async _rollNavigation() {
    const navs = this._navigators();
    const actor = navs.find(a => a.id === (this.uiState.navId || navs[0]?.id));
    if (!actor) { ui.notifications?.warn("Навигация: выберите навигатора."); return; }
    const base = this._jSkillTotal(actor, this.journey.navSkill) ?? -20;
    const total = veilTotal(readVeil(currentScene()));
    const mod = veilNavMod(total);
    // Общий сбор модификаторов (wdbc-ct65.3): тест Навигации шёл мимо реестра
    // правил. Навигация — групповой навык, ключ едет в ctx.group (обычный
    // ctx.skill его не поймает, см. rules/resolve-test.mjs::effectAppliesTo).
    const ruleMods = collectTestMods(actor, { kind: "skill", group: "navigation", char: "int" });
    const eff = base + mod + ruleMods.total;
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total;
    const success = rv <= eff;
    const deg = Math.floor(Math.abs(rv - eff) / 10) + 1;
    const info = veilLevelInfo(total);
    // Настоящий тест с Порогом — единственный такой в этом окне вместе с
    // Выходом из варпа, поэтому собирается общим строителем. Слагаемые Порога
    // (завеса + подписи из реестра правил) переехали в скобки общего формата.
    await postTestCard(actor, {
      icon: `${veilIcon("compass")} `,
      title: `Навигация в Варпе — ${esc(actor.name)}`,
      threshold: rollStatLine({
        label: "Навигация", base,
        parts: [`завеса ${info.label} ${mod >= 0 ? "+" : ""}${mod}`, ...ruleMods.parts],
        threshold: eff, rv
      }),
      outcome: outcomeHtml(success, success
        ? `Курс проложен — ${deg} ст.`
        : `Сбился с курса — ${deg} ст. (риск варп-инцидента)`)
    }, { rolls: [roll] });
  }

  _postNavPower(id) {
    const navs = this._navigators();
    const actor = navs.find(a => a.id === (this.uiState.navId || navs[0]?.id));
    const item = actor?.items.get(id);
    if (!item) return;
    const s = item.system;
    // Не тест: справка о силе Навигатора в чат, без броска и Порога.
    postTestCard(actor, {
      icon: `${veilIcon("eye")} `,
      title: `Сила Навигатора: ${esc(item.name)}`,
      lines: [
        s.action ? `<div class="roll-threshold">Действие: <b>${esc(s.action)}</b>${s.range ? ` · Дальность: ${esc(s.range)}` : ""}</div>` : "",
        s.effect ? `<div class="roll-threshold">${esc(s.effect)}</div>` : ""
      ]
    }, { sound: false });
  }

  // ── Варп-путешествие: шаги ──────────────────────────────────────────────
  _journeyNav() {
    const navs = this._navigators();
    return navs.find(a => a.id === (this.uiState.navId || navs[0]?.id)) || null;
  }
  /** Состояние «без сознания» ЭТОГО Проводника (по id актора, не журнала — см. _newJourney). */
  _guideState(navId) {
    const map = (this.journey.guideStateByNav ||= {});
    return (map[navId || ""] ||= { unconscious: false, stacks: 0 });
  }
  /** Варп-маршрут, выбранный на Шаге 0 (wdbc-r0w9) — мировой предмет, не вложен в актора. */
  _journeyRouteItem() {
    const uuid = this.journey.routeUuid;
    if (!uuid) return null;
    let doc = null;
    try { doc = fromUuidSync(uuid); } catch { doc = null; }
    return doc?.type === "warpRoute" ? doc : null;
  }
  _occNavMod() {
    const J = this.journey;
    const nav = this._journeyNav();
    let base = (J.occulum === "damaged" ? -20 : J.occulum === "destroyed" ? -40 : 0)
      + (J.emergency ? -20 : 0) + (J.beaconMod || 0)
      // Психоактивный Проводник (не навигатор) — −20 на ВСЕ тесты навигации
      // в варпе (раздел «Проводники», wdbc-r0w9).
      + guideNavPenalty(guideKindFor(nav));
    const route = this._journeyRouteItem();
    if (!route) return base;
    // Тип + Изученность + Знание Проводника, капается −60..+40 (Шаги 4-5).
    const rows = resolveRouteRows(route);
    const level = routeKnowledgeLevelFor(nav, route, rows.lore);
    const routeMod = routeNavigationCap(rows.routeType?.mod || 0, rows.lore?.mod || 0, routeKnowledgeMod(level));
    return base + routeMod;
  }
  _groupTotal(actor, gkey, hints) {
    const arr = actor?.system?.groupSkills?.[gkey] || [];
    const hit = arr.find(e => hints.some(h => (e.specialty || e.name || "").toLowerCase().includes(h)));
    return hit?.total ?? null;
  }
  async _roll(eff) {
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total;
    const deg = rv <= eff ? 1 + Math.floor((eff - rv) / 10) : -(1 + Math.floor((rv - eff) / 10));
    return { roll, rv, eff, deg, success: deg > 0 };
  }
  /**
   * Общая отправка карточек Варп-странствия — через общий сборщик
   * (helpers/test-card.mjs, wdbc-kuun). Почти все её карточки — броски по
   * ТАБЛИЦАМ Варп-столкновений (стабильность маршрута, длительность, шторм,
   * неаккуратный выход), а не тесты: Порога у них нет, сравнивать бросок не с
   * чем, поэтому готовое тело карточки идёт строкой в lines. Исключение —
   * Выход из варпа (_exitWarp), он идёт через эту же отправку.
   *
   * Классы корня: `wh-warp-card` и ярус `wv-tier-*` — от последнего зависит
   * весь цвет карточки (styles/ui/veil.css переопределяет им --wv-tier), так
   * что он обязан стоять на том же узле, что и `wh-roll-result`.
   * Говорит не актор, а «Варп-Навигация» — спикер-псевдоним.
   */
  async _jPost(title, tier, body, rolls = []) {
    const dice = rolls.length
      ? `<details class="roll-dice-details"><summary>📊 Кубы</summary>${(await Promise.all(rolls.map(r => r.render()))).join("")}</details>` : "";
    await postTestCard(null, testCardHtml({
      title, classes: `wh-warp-card wv-tier-${tier}`, lines: [body], sections: [dice]
    }), { rolls, sound: !!rolls.length, speaker: { alias: "Варп-Навигация" } });
  }

  async _rollDuration() {
    const r = await new Roll("1d10").evaluate();
    const row = lookupTable(JOURNEY_DURATION, r.total);
    const dRoll = await new Roll(row.formula).evaluate();
    const route = this._journeyRouteItem();
    const rows = resolveRouteRows(route);
    const mult = rows.category?.durMult || 1;
    const base = dRoll.total * mult;
    this.journey.baseDuration = base;
    this.render(false);
    await this._jPost(`${veilIcon("hourglass")} Длительность странствия`, "stable",
      `<div class="roll-dice">1d10: <b>${r.total}</b> — ${esc(row.ex)}</div><div class="roll-threshold">${row.formula} = ${dRoll.total}${mult > 1 ? ` × ${mult}` : ""} = <b>${base}</b> дн. (исходное)</div><div class="roll-threshold" style="font-size:0.8em;opacity:0.8;">МИ не оглашает игрокам.</div>`, [r, dRoll]);
  }
  async _readOmens() {
    const a = this._journeyNav(); if (!a) { ui.notifications?.warn("Навигация: нет Проводника на сцене."); return; }
    const base = this._jSkillTotal(a, this.journey.senseSkill) ?? -20;
    const route = this._journeyRouteItem();
    const rows = resolveRouteRows(route);
    // Категория «Трудный маршрут» — −10 на Psyniscience при Чтении знамений.
    const mod = rows.category?.omenMod || 0;
    // Чтение знамений — тоже тест Псинауки Проводника, и он тоже шёл мимо
    // реестра (wdbc-9jj7): нашлось при правке соседнего _findBeacon.
    const ruleMods = collectTestMods(a, { kind: "skill", skill: "psyniscience", char: "per" });
    const res = await this._roll(base + mod + ruleMods.total);
    let body = rollStatLine({
      label: "Psyniscience", base,
      parts: [mod ? `${mod >= 0 ? "+" : ""}${mod}` : "", ...ruleMods.parts],
      threshold: res.eff, rv: res.rv
    });
    if (res.success) body += `<div class="roll-outcome"><span class="roll-success">Знамения ясны — ${res.deg} ${degWord(res.deg)}. Судно готово ко входу.</span></div>`;
    else { const g = GUIDE_ESTIMATE[Math.floor(Math.random() * 5)]; body += `<div class="roll-outcome"><span class="roll-failure">Знамения смутны.</span></div><div class="roll-threshold">Оценка Проводника: длительность ${g.mult}, Астрономикон: ${esc(g.astro)}</div>`; }
    await this._jPost(`${veilIcon("eye")} Чтение знамений — ${esc(a.name)}`, "stable", body, [res.roll]);
  }
  async _enterWarp() {
    const loc = ENTRY_LOCATIONS.find(l => l.key === this.journey.entryLoc) || ENTRY_LOCATIONS[5];
    if (loc.key === "mandeville") { await this._jPost(`${veilIcon("spiral")} Вход в варп — ${esc(loc.label)}`, "stable", `<div class="roll-outcome"><span class="roll-success">${esc(loc.success)}</span></div>`); return; }
    if (loc.mod === null) { await this._jPost(`${veilIcon("spiral")} Вход в варп — ${esc(loc.label)}`, "torn", `<div class="roll-outcome"><span class="roll-failure">Авто-провал.</span></div><div class="roll-threshold">${esc(loc.fail)}</div>`); return; }
    const a = this._journeyNav();
    const base = this._jSkillTotal(a, this.journey.helmSkill) ?? 30;
    const res = await this._roll(base + loc.mod);
    let body = rollStatLine({ label: "Operate (Voidship)", base, parts: [String(loc.mod)], threshold: res.eff, rv: res.rv });
    if (res.success) body += `<div class="roll-outcome"><span class="roll-success">${esc(loc.success)}</span></div>`;
    else { this.journey.emergency = true; this.render(false); body += `<div class="roll-outcome"><span class="roll-failure">${esc(loc.fail)}</span></div>`; }
    await this._jPost(`${veilIcon("spiral")} Вход в варп — ${esc(loc.label)}`, res.success ? "stable" : "torn", body, [res.roll]);
  }
  async _findBeacon() {
    const a = this._journeyNav(); if (!a) { ui.notifications?.warn("Навигация: нет Проводника."); return; }
    const route = this._journeyRouteItem();
    const rows = resolveRouteRows(route);
    // Категория «Тропа во тьме» — Освещённость на время странствия считается
    // Слепой зоной целиком, независимо от того, что выпало отдельным броском.
    const illumRow = rows.category?.illuminationBlindZone
      ? ROUTE_ILLUMINATION.find(row => row.label === "Слепая зона")
      : effectiveIlluminationFor(a, route, rows);
    const repeat = !!this.journey.beaconSearched;
    if (repeat && illumRow?.repeatImpossible) {
      ui.notifications?.warn("Слепая зона: повторный поиск маяка невозможен.");
      return;
    }
    const mod = illumRow ? (repeat ? (illumRow.repeat ?? 0) : illumRow.first) : 0;
    const base = this._jSkillTotal(a, this.journey.senseSkill) ?? -20;
    // Общий сбор модификаторов (wdbc-9jj7): тест Псинауки Проводника шёл мимо
    // реестра — соседний _directShip уже переведён, этот в тот проход не попал.
    const ruleMods = collectTestMods(a, { kind: "skill", skill: "psyniscience", char: "per" });
    const res = await this._roll(base + mod + ruleMods.total);
    const bm = (res.success ? 1 : -1) * Math.floor(Math.abs(res.deg) / 2) * 10;
    this.journey.beaconMod = bm; this.journey.beaconSearched = true; this.render(false);
    await this._jPost(`${veilIcon("star")} Поиск Астрономикона${repeat ? " (повторно)" : ""} — ${esc(a.name)}`, "stable",
      `${rollStatLine({
        label: "Psyniscience", base,
        parts: [mod ? `${mod >= 0 ? "+" : ""}${mod}` : "", ...ruleMods.parts],
        threshold: res.eff, rv: res.rv
      })}<div class="roll-outcome">${res.success ? `<span class="roll-success">Маяк найден — ${res.deg} ${degWord(res.deg)}` : `<span class="roll-failure">Маяк тускл — ${Math.abs(res.deg)} ${degWord(res.deg)}`} → мод. навигации <b>${bm >= 0 ? "+" : ""}${bm}</b></span></div>`, [res.roll]);
  }
  async _directShip() {
    const a = this._journeyNav(); if (!a) { ui.notifications?.warn("Навигация: нет Проводника."); return; }
    const base = this._jSkillTotal(a, this.journey.navSkill) ?? -20;
    const mod = this._occNavMod();
    // Тот же общий сбор, что у _rollNavigation выше (wdbc-ct65.3).
    const ruleMods = collectTestMods(a, { kind: "skill", group: "navigation", char: "int" });
    const res = await this._roll(base + mod + ruleMods.total);
    const mult = jumpDurationMult(res.deg);
    const real = this.journey.baseDuration != null ? `≈ ${Math.ceil(this.journey.baseDuration * ({ "×1/4": .25, "×1/2": .5, "×3/4": .75, "×1": 1, "×2": 2, "×3": 3, "×4": 4 }[mult] || 1))} дн.` : "";
    const dosText = res.deg > 0 ? `${res.deg} СУ` : `${Math.abs(res.deg)} СП`;
    await this._jPost(`${veilIcon("compass")} Направление корабля — ${esc(a.name)}`, "stable",
      `${rollStatLine({
        label: "Navigation (Warp)", base,
        parts: [mod ? `${mod >= 0 ? "+" : ""}${mod}` : "", ...ruleMods.parts],
        threshold: res.eff, rv: res.rv
      })}<div class="roll-outcome"><span class="${res.success ? "roll-success" : "roll-failure"}">Длительность прыжка (${dosText}): <b>${mult}</b> ${real}</span></div>`, [res.roll]);
    // Прокладка нового маршрута (wdbc-r0w9.1): «одно очко за каждые две
    // степени успеха на любом тесте Navigation (Warp)» — только этот и Выход.
    const plottedRoute = this._journeyRouteItem();
    if (plottedRoute?.system.plotting?.active && res.success) {
      this.journey.plottingRejsPoints += routePointsFromTest(res.deg);
      this.render(false);
    }
    await this._applyGuideFatigue(a);
  }
  /**
   * Усталость Проводника (раздел «Проводники», wdbc-r0w9): +1 за каждый тест
   * Navigation (Warp) в варпе, вне зависимости от успеха. При достижении
   * T.b+W.b Проводник теряет сознание — с этого момента каждый СЛЕДУЮЩИЙ
   * бросок по Таблице Варп-столкновений получает накопительный +10
   * (см. _warpEncounter). Дневной тик (30 дней странствия, 10 при разбитом
   * Оккулуме) — кнопка jFatigueDay, тот же +1, не отдельная логика: книга не
   * различает источник Усталости при проверке порога.
   */
  async _applyGuideFatigue(actor) {
    if (!actor) return;
    // Через addFatigue (wdbc-x1nz.2.95): порог T.b+W.b роняет Проводника без
    // сознания и на ЛИСТЕ (с таймером пробуждения), а не только в состоянии
    // странствия ниже; Саркофаг держит иммунитет. Порог — по действующей
    // Усталости (+1 Гангрены).
    const res = await addFatigue(actor, 1);
    if (!res) return;
    const next = res.effective;
    const state = this._guideState(actor.id);
    if (state.unconscious) return;
    const threshold = (actor.system?.characteristics?.t?.bonus || 0) + (actor.system?.characteristics?.wp?.bonus || 0);
    if (next < threshold) return;
    state.unconscious = true;
    this.render(false);
    await this._jPost(`${veilIcon("warning")} Проводник без сознания — ${esc(actor.name)}`, "torn",
      `<div class="roll-threshold">Усталость ${next} ≥ T.b+W.b (${threshold}). Корабль идёт «без Проводника» (см. «Прыжки без проводника»), пока Проводник не очнётся. Каждый следующий бросок Варп-столкновений получает накопительный +10.</div>`);
  }
  /** Кнопка «+1 Усталость (30/10 дней)» — та же проверка порога, что и у
   *  тестов Navigation (Warp): книга не различает источник Усталости. */
  async _tickGuideFatigueDay() {
    const a = this._journeyNav(); if (!a) { ui.notifications?.warn("Навигация: нет Проводника."); return; }
    await this._applyGuideFatigue(a);
  }
  /**
   * Доп. надбавка за 10 дней навигации психоактивным/одержимым Проводникам
   * (раздел «Проводники», wdbc-r0w9) — СВЕРХ общей Усталости за тест
   * Navigation (Warp): 1 Порча всегда, плюс 1 Усталость для психоактивных.
   */
  async _tickGuideDecadeUpkeep() {
    const a = this._journeyNav(); if (!a) { ui.notifications?.warn("Навигация: нет Проводника."); return; }
    const kind = guideKindFor(a);
    const upkeep = guideDecadeUpkeep(kind, this.journey.possessedHumanCoNav);
    if (!upkeep.corruption && !upkeep.fatigue) {
      ui.notifications?.info("У этого Проводника нет надбавки за 10 дней.");
      return;
    }
    if (upkeep.corruption) {
      const cor = (Number(a.system?.corruption?.value) || 0) + upkeep.corruption;
      await a.update({ "system.corruption.value": cor });
    }
    if (upkeep.fatigue) await this._applyGuideFatigue(a);
    await this._jPost(`${veilIcon("warning")} 10 дней навигации — ${esc(a.name)}`, "thin",
      `<div class="roll-threshold">${GUIDE_KINDS[kind]?.label || kind}: +${upkeep.corruption} Порча${upkeep.fatigue ? `, +${upkeep.fatigue} Усталость` : ""}.</div>`);
  }
  /** Напоминание о встречном тесте лояльности демона — МИ ведёт его сам
   *  вручную (какой именно тест зависит от того, сломлен демон или Миньон),
   *  здесь только подсказка с точным текстом правила. */
  async _daemonLoyaltyReminder() {
    const a = this._journeyNav(); if (!a) { ui.notifications?.warn("Навигация: нет Проводника."); return; }
    await this._jPost(`${veilIcon("demon")} Лояльность демона-Проводника — ${esc(a.name)}`, "torn",
      `<div class="roll-threshold">Встречный тест на усмотрение МИ: наибольшая <b>Inf</b> персонажей vs <b>Inf</b> демона; <b>W vs W</b>, если демон сломлен и принуждён служить; <b>Лояльность</b>, если демон — Миньон. Победа демона — саботаж варп-перехода на усмотрение МИ.</div>`);
  }
  /**
   * Обработка данных (Scholastic Lore (Astromancy), wdbc-r0w9.1) — один тест
   * за рейс, «кассирует» очки ЭТОГО рейса (journey.plottingRejsPoints) в
   * постоянный счётчик на самом предмете (system.plotting.points). Провал —
   * половина очков, и Начертание (_chartRoute) в этом рейсе недоступно.
   */
  async _processPlottingData() {
    const a = this._journeyNav(); if (!a) { ui.notifications?.warn("Навигация: нет Проводника."); return; }
    const route = this._journeyRouteItem();
    if (!route?.system.plotting?.active) {
      ui.notifications?.info("Выбранный маршрут не в процессе прокладки.");
      return;
    }
    const plotting = route.system.plotting;
    const bonus = (plotting.attempts || 0) * 10; // накопительный +10 за каждый пройденный рейс
    const base = this._jSkillTotal(a, this.journey.astroSkill) ?? -20;
    const res = await this._roll(base + bonus);
    const { points, canRecord } = astromancyOutcome(this.journey.plottingRejsPoints, res.deg);
    const totalPoints = (plotting.points || 0) + points;
    await route.update({ "system.plotting.points": totalPoints });
    this.journey.plottingRejsPoints = 0;
    this.journey.plottingCanRecord = canRecord;
    this.render(false);
    const body = `${rollStatLine({ label: "Scholastic Lore (Astromancy)", base, parts: [bonus ? `+${bonus} (повторные рейсы)` : ""], threshold: res.eff, rv: res.rv })}
      <div class="roll-outcome"><span class="${res.success ? "roll-success" : "roll-failure"}">${res.success ? "Данные обработаны" : "Записи путаются"} — +${points} Очков Маршрута (всего ${totalPoints}/${plotting.threshold || "?"}).</span></div>
      ${canRecord ? "" : `<div class="roll-threshold">Записать черновики в этом рейсе не получится.</div>`}`;
    await this._jPost(`${veilIcon("eye")} Обработка данных — ${esc(a.name)}`, res.success ? "stable" : "thin", body, [res.roll]);
  }
  /**
   * Начертание маршрута (wdbc-r0w9.2) — Trade (Astrographer) по точности
   * последнего Выхода + признакам маршрута. Работает и для прокладки нового
   * маршрута (гейт по Очкам/Обработке данных), и для уже известного —
   * записать/уточнить карту после обычного странствия.
   */
  async _chartRoute() {
    const a = this._journeyNav(); if (!a) { ui.notifications?.warn("Навигация: нет Проводника."); return; }
    const route = this._journeyRouteItem();
    if (!route) { ui.notifications?.warn("Навигация: маршрут не выбран."); return; }
    const rows = resolveRouteRows(route);
    if (chartingBlocked(rows.category?.label)) {
      ui.notifications?.warn(`«${route.name}»: Категория «Неначертаемый след» — записать невозможно.`);
      return;
    }
    const plotting = route.system.plotting || {};
    if (plotting.active) {
      if (!this.journey.plottingCanRecord) {
        ui.notifications?.warn("Обработка данных провалена в этом рейсе — запись сейчас недоступна.");
        return;
      }
      if ((plotting.points || 0) < (plotting.threshold || 0)) {
        ui.notifications?.warn(`Очков Маршрута пока ${plotting.points || 0}/${plotting.threshold || "?"} — не хватает для записи.`);
        return;
      }
    }
    const featureLabels = (route.system.features || []).map(f => f.name);
    const bonus = plotting.active ? (plotting.attempts || 0) * 10 : 0;
    const mod = chartingModifier({ exitAccuracy: this.journey.lastExitAccuracy, categoryLabel: rows.category?.label, featureLabels }) + bonus;
    const base = this._jSkillTotal(a, this.journey.astrographerSkill) ?? -20;
    const res = await this._roll(base + mod);
    const outcome = chartingOutcome(res.deg);
    const knowledge = knowledgeFromCharting(outcome);
    if (knowledge) {
      const known = foundry.utils.deepClone(a.system?.knownRoutes || []);
      const entry = known.find(k => k.routeUuid === route.uuid);
      if (entry) entry.level = upgradeKnowledge(entry.level, knowledge);
      else known.push({ routeUuid: route.uuid, level: knowledge, passes: 0 });
      await a.update({ "system.knownRoutes": known });
    }
    if (plotting.active) {
      const finished = outcome !== "none" && (plotting.points || 0) >= (plotting.threshold || 0);
      await route.update({
        "system.plotting.attempts": (plotting.attempts || 0) + 1,
        ...(finished ? { "system.plotting.complete": true, "system.plotting.active": false } : {})
      });
    }
    const outcomeLabel = { detailed: "Детализированная карта (Известный)", basic: "Базовая карта (Предполагаемый)", none: "Записать не удалось" }[outcome];
    await this._jPost(`${veilIcon("star")} Начертание маршрута — ${esc(a.name)}`, outcome === "detailed" ? "stable" : (outcome === "none" ? "torn" : "thin"),
      `${rollStatLine({ label: "Trade (Astrographer)", base, parts: [`${mod >= 0 ? "+" : ""}${mod}`], threshold: res.eff, rv: res.rv })}
       <div class="roll-outcome"><b>${esc(outcomeLabel)}</b></div>
       ${plotting.active && outcome !== "none" && (plotting.points || 0) >= (plotting.threshold || 0) ? `<div class="roll-threshold">«${esc(route.name)}» проложен!</div>` : ""}`, [res.roll]);
  }
  async _warpEncounter() {
    // Не тест против порога, а бросок ПО ТАБЛИЦЕ (wdbc-ct65.3): характеристики
    // и Порога у него нет, реестр правил не нужен — но признаки маршрута,
    // Дурные знамения и вид Проводника (раздел «Проводники») дают
    // модификатор к самому броску (wdbc-r0w9, книга: «Сумма модификаторов
    // не может выйти за пределы от −30 до +40»).
    const a = this._journeyNav();
    const kind = guideKindFor(a);
    const route = this._journeyRouteItem();
    const rows = resolveRouteRows(route);
    const capped = routeEncounterCap(rows.stability?.encounterMod || 0, rows.category?.encounterMod || 0, !!this.journey.omensUnsuppressed);
    // Проводник без сознания (Усталость ≥ T.b+W.b) — накопительный +10 за
    // каждый СЛЕДУЮЩИЙ бросок с этого момента, ВНЕ книжного потолка −30..+40
    // (это отдельная спираль кризиса, не признак маршрута).
    const guideState = this._guideState(a?.id);
    if (guideState.unconscious) { guideState.stacks += 10; this.render(false); }
    // Психоактивный Проводник (не навигатор) — +10 (правка Н1). Уже входит в
    // общий книжный потолок −30..+40 наравне со Стабильностью/Категорией.
    const mod = Math.max(-30, Math.min(40, capped + guideEncounterBonus(kind)))
      + (guideState.unconscious ? guideState.stacks : 0);
    // Демон/одержимый-в-демоническом-режиме — бросок ДВАЖДЫ, МИ выбирает
    // результат сам (книга буквально «выбирает», не «берёт худший») —
    // показываем оба, не решаем за стол.
    const twice = guideRollsEncounterTwice(kind, this.journey.possessedHumanCoNav);
    const r = await new Roll("1d100").evaluate();
    const r2 = twice ? await new Roll("1d100").evaluate() : null;
    const total = Math.max(1, Math.min(100, r.total + mod));
    const total2 = r2 ? Math.max(1, Math.min(100, r2.total + mod)) : null;
    const row = lookupTable(WARP_ENCOUNTERS, total);
    const tierOf = t => t <= 20 ? "stable" : (t >= 71 ? "torn" : "thin");
    const dice = `<div class="roll-dice">1d100: <b>${r.total}</b>${mod ? ` ${mod >= 0 ? "+" : ""}${mod} = ${total}` : ""}</div>`;
    if (!twice) {
      await this._jPost(`${veilIcon("warning")} Варп-столкновение — ${esc(row.name)}`, tierOf(total),
        `${dice}<div class="roll-threshold">${esc(row.text)}</div>`, [r]);
      return;
    }
    const rowB = lookupTable(WARP_ENCOUNTERS, total2);
    await this._jPost(`${veilIcon("warning")} Варп-столкновение (демон бросает дважды, выберите результат)`, tierOf(Math.max(total, total2)),
      `${dice}<div class="roll-threshold"><b>Вариант А:</b> ${esc(row.name)} — ${esc(row.text)}</div>
       <div class="roll-dice">1d100 (второй): <b>${r2.total}</b>${mod ? ` ${mod >= 0 ? "+" : ""}${mod} = ${total2}` : ""}</div>
       <div class="roll-threshold"><b>Вариант Б:</b> ${esc(rowB.name)} — ${esc(rowB.text)}</div>`, [r, r2]);
  }
  async _warpInvasion() {
    const g = this.journey.gellar;
    const mod = g === "ok" ? -30 : (g === "off" ? 30 : 0);
    const r = await new Roll("1d100").evaluate();
    const total = Math.max(1, Math.min(100, r.total + mod));
    const row = lookupTable(WARP_INVASIONS, total);
    await this._jPost(`${veilIcon("demon")} Варп-вторжение — ${esc(row.name)}`, "torn",
      `<div class="roll-dice">1d100: <b>${r.total}</b>${mod ? ` ${mod >= 0 ? "+" : ""}${mod} (Геллер) = ${total}` : ""}</div><div class="roll-threshold">${esc(row.text)}</div>`, [r]);
  }
  async _exitWarp() {
    const a = this._journeyNav(); if (!a) { ui.notifications?.warn("Навигация: нет Проводника."); return; }
    const base = this._jSkillTotal(a, this.journey.navSkill) ?? -20;
    // Демон/одержимый-в-демоническом-режиме — доп. −30 к Выходу поверх
    // обычного −20 Шага 5 (раздел «Проводники», wdbc-r0w9).
    const guideMod = guideExitPenalty(guideKindFor(a), this.journey.possessedHumanCoNav);
    const mod = this._occNavMod() - 20 + guideMod;
    // Тот же общий сбор, что у _directShip и _rollNavigation (wdbc-9jj7).
    const ruleMods = collectTestMods(a, { kind: "skill", group: "navigation", char: "int" });
    const res = await this._roll(base + mod + ruleMods.total);
    let body = rollStatLine({
      label: "Navigation (Warp) −20", base,
      parts: [`${mod >= 0 ? "+" : ""}${mod}`, ...ruleMods.parts],
      threshold: res.eff, rv: res.rv
    });
    if (res.success) {
      body += `<div class="roll-outcome"><span class="roll-success">Точный выход — ${res.deg} ${degWord(res.deg)}.</span></div>`;
      await this._jPost(`${veilIcon("door")} Выход из варпа — ${esc(a.name)}`, "stable", body, [res.roll]);
      // Точность выхода для Начертания маршрута (wdbc-r0w9.2, chartingModifier)
      // — «Быстрый способ» книги упрощён до исхода ЭТОГО броска, без отдельного
      // отслеживания качества Оценки Шага 1 (честно не смоделировано).
      this.journey.lastExitAccuracy = "exact";
    } else {
      const er = await new Roll("1d100").evaluate(); const row = lookupTable(INACCURATE_EXIT, er.total);
      body += `<div class="roll-outcome"><span class="roll-failure">Отклонение от курса.</span></div><div class="roll-threshold">Неаккуратный выход (1d100: ${er.total}): ${esc(row.text)}</div>`;
      await this._jPost(`${veilIcon("door")} Выход из варпа — ${esc(a.name)}`, "torn", body, [res.roll, er]);
      this.journey.lastExitAccuracy = er.total <= 75 ? "slight" : "significant";
    }
    // Прокладка (wdbc-r0w9.1): +1 гарантированное очко за то, что довёл судно
    // из точки А в точку Б — вне зависимости от точности выхода.
    const exitRoute = this._journeyRouteItem();
    if (exitRoute?.system.plotting?.active) {
      this.journey.plottingRejsPoints += 1;
      if (!exitRoute.system.plotting.threshold && this.journey.baseDuration) {
        await exitRoute.update({ "system.plotting.threshold": plottingThresholdFor(this.journey.baseDuration).threshold });
      }
    }
    // Рост Знания по личным проходам (wdbc-r0w9.2) — только при успешном
    // выходе («один личный проход без серьёзных происшествий»); работает для
    // ЛЮБОГО выбранного маршрута, не только прокладываемого нового.
    if (res.success && exitRoute) await this._trackRoutePass(a, exitRoute);
    this.render(false);
    await this._applyGuideFatigue(a);
  }
  /**
   * Рост Знания (wdbc-r0w9.2, «Таблица Роста Знания»): Неизвестный →
   * Предполагаемый за один чистый проход; Известный → Выученный за 10
   * личных проходов (Особенность «Интуитивный» считает проход за два).
   * Не понижает и не трогает Предполагаемый→Известный — тот только через
   * Начертание/карту (_chartRoute), не через число проходов.
   */
  async _trackRoutePass(actor, route) {
    const known = foundry.utils.deepClone(actor.system?.knownRoutes || []);
    let entry = known.find(k => k.routeUuid === route.uuid);
    if (!entry) { entry = { routeUuid: route.uuid, level: "unknown", passes: 0 }; known.push(entry); }
    const featureLabels = (route.system.features || []).map(f => f.name);
    entry.passes = (Number(entry.passes) || 0) + passIncrement(featureLabels);
    if (entry.level === "unknown" || !entry.level) entry.level = "presumed";
    else if (entry.level === "known" && entry.passes >= PASSES_TO_LEARNED) entry.level = "learned";
    await actor.update({ "system.knownRoutes": known });
  }
  async _warpStorm() {
    const r = await new Roll("1d5").evaluate();
    const row = WARP_STORMS[r.total - 1] || WARP_STORMS[0];
    if (game.user.isGM) veilShift(row.veil, `Варп-шторм (сила ${row.s})`);
    await this._jPost(`${veilIcon("storm")} Варп-шторм — сила ${row.s}`, "infernal",
      `<div class="roll-dice">1d5: <b>${r.total}</b></div><div class="roll-threshold"><b>Астропатия:</b> ${esc(row.astro)}</div><div class="roll-threshold"><b>Путешествия:</b> ${esc(row.travel)}</div><div class="rf-veil">Завеса истончается на +${row.veil}.</div>`, [r]);
  }

  _announce() {
    const scene = currentScene();
    const v = readVeil(scene);
    const total = veilTotal(v);
    const info = veilLevelInfo(total);
    const active = VEIL_FACTORS.filter(f => v.factors[f.key])
      .map(f => `${f.label} (${f.value > 0 ? "+" : ""}${f.value})`);
    const rituals = (v.rituals || []).filter(r => r.active)
      .map(r => `${esc(r.name)} (${(Number(r.delta) || 0) > 0 ? "+" : ""}${Number(r.delta) || 0})`);
    const factorsHtml = active.length ? `<div class="wv-chat-factors">${active.map(esc).join(" · ")}</div>` : "";
    const ritualsHtml = rituals.length ? `<div class="wv-chat-factors">Ритуалы: ${rituals.join(" · ")}</div>` : "";
    // Оглашение состояния Завесы — уведомление, не карточка теста (wdbc-kuun):
    // броска и Порога нет. Разметка своя и через testCardHtml не идёт: корень
    // тут `wh-veil-chat`, а общий строитель всегда добавил бы `wh-roll-result`
    // с чужой рамкой и отступами. Общей стала публикация: спикер «Завеса».
    postTestCard(null, `<div class="wh-veil-chat wv-tier-${info.tier}">
        <div class="wv-chat-head">◈ ИСТОНЧЕНИЕ ЗАВЕСЫ ◈</div>
        <div class="wv-chat-scene">${esc(scene?.name || "")}</div>
        <div class="wv-chat-total">${total > 0 ? "+" : ""}${total}</div>
        <div class="wv-chat-label">${esc(info.label)}</div>
        ${factorsHtml}${ritualsHtml}
        <div class="wv-chat-cons">${esc(info.consequence)}</div>
      </div>`, { sound: false, speaker: { alias: "Завеса" } });
  }
}

// ── Открытие / авто-обновление ────────────────────────────────────────────
let _veil = null;
export function openVeilMystic(tab = null) {
  if (!_veil) _veil = new VeilMystic();
  // .state — геттер без сеттера у настоящего ApplicationV2 (Foundry v14);
  // вкладка листа/окна хранится отдельно, в .uiState (см. конструктор
  // VeilMystic). Присвоение в .state молча проходило только потому, что
  // test/support/foundry-stub.mjs не знал об этом геттере ДО wdbc-v8b2 — в
  // реальном мире падало бы TypeError. openTarotReader() ниже сейчас без
  // единого вызывающего места, но экспортирован — баг ждал первого, кто его
  // подключит.
  if (tab) _veil.uiState.tab = tab;
  _veil.render(true);
  return _veil;
}
// Открыть окно Завесы сразу на вкладке «Таро Императора» (замена старого окна).
export function openTarotReader() { return openVeilMystic("tarot"); }

// Перерисовать открытое окно Завесы (напр. при смене общей Завесы группы Нексуса).
export function refreshVeilWindow() { if (_veil?.rendered) _veil.render(false); }

// Полноразмерный просмотр карты Таро по клику (окно/чат).
export function openCardImage(src, title = "Карта") {
  if (!src) return;
  try { if (globalThis.ImagePopout) { new globalThis.ImagePopout(src, { title, shareable: true }).render(true); return; } } catch (e) {}
  try { const V2 = foundry.applications?.apps?.ImagePopout; if (V2) { new V2({ src, window: { title } }).render(true); return; } } catch (e) { console.warn("Warhammer DBC | ImagePopout:", e); }
}
Hooks.once("ready", () => {
  document.addEventListener("click", (ev) => {
    const img = ev.target?.closest?.("img.tr-pv-art, img.tr-gc-art, img.tc-art");
    if (!img) return;
    openCardImage(img.getAttribute("src"), img.dataset.title || "Карта");
  });
});

// Перерисовка открытого окна + варп-оверлей сцены при смене сцены/флагов.
Hooks.on("updateScene", (scene) => {
  if (scene?.id === currentScene()?.id) {
    if (_veil?.rendered) _veil.render(false);
    refreshVeilOverlay();
  }
});
Hooks.on("canvasReady", () => {
  if (_veil?.rendered) _veil.render(false);
  refreshVeilOverlay();
});
Hooks.once("ready", () => refreshVeilOverlay());
