console.log("Warhammer DBC | Загрузка системы...");

import { getCriticalEffect }          from "./critical-tables.mjs";
import { RACES, SUBRACES }            from "./module/constants/races.mjs";
import { CHARACTERISTICS, IMPROVEMENTS,
         IMPROVEMENT_BONUS,
         SKILL_RANKS }                from "./module/constants/characteristics.mjs";
import { SKILLS_DEF,
         GROUP_SKILLS_DEF }           from "./module/constants/skills.mjs";
import { HIT_LOCATIONS, MELEE_STANCES,
         BALANCE_PARRY_MOD,
         MELEE_BASES, MELEE_MANEUVERS, MELEE_CONTESTS } from "./module/constants/combat.mjs";
import { ITEM_TYPES, WEAPON_CLASSES,
         DAMAGE_TYPES,
         AVAILABILITY }               from "./module/constants/items.mjs";
import { AMMO_CATEGORIES }            from "./module/constants/ammo.mjs";
import { WEAPON_PROPERTIES }          from "./module/constants/weapon-properties.mjs";

import { WarhammerActor }             from "./module/documents/actor.mjs";
import { WarhammerItem }              from "./module/documents/item.mjs";
import { ITEM_DATA_MODELS,
         ACTOR_DATA_MODELS }          from "./module/data/index.mjs";

import { WarhammerCharacterSheet }    from "./module/sheets/actor-sheet.mjs";
import { WarhammerShipSheet }         from "./module/sheets/ship-sheet.mjs";
import { WarhammerStarSystemSheet }   from "./module/sheets/star-system-sheet.mjs";
import { WarhammerHordeSheet }        from "./module/sheets/horde-sheet.mjs";
import { WarhammerVehicleSheet }      from "./module/sheets/vehicle-sheet.mjs";
import { WarhammerDaemonSheet }       from "./module/sheets/daemon-sheet.mjs";
import { WarhammerMinionSheet }       from "./module/sheets/minion-sheet.mjs";
import { WarhammerDemonPrinceSheet }  from "./module/sheets/demon-prince-sheet.mjs";
import { WarhammerSquadSheet }        from "./module/sheets/squad-sheet.mjs";
import { WarhammerFormationSheet }    from "./module/sheets/formation-sheet.mjs";
import { WarhammerItemSheet }         from "./module/sheets/item-sheet.mjs";
import { WarhammerActiveEffectConfig } from "./module/sheets/active-effect-config.mjs";
import { refreshCalendarWidget, initTimeFlow } from "./module/apps/imperial-calendar.mjs";
import { showFateTurnBanner } from "./module/apps/game-session.mjs";
import { runAutoScripts }             from "./module/apps/item-script.mjs";
import { applyItemMechanics, syncMechanicsEffects, reconcileCohesionForActor, initEquipmentIndex,
         saveItemMechanics } from "./module/apps/mechanics.mjs";
import { isItemActive }              from "./module/apps/effects.mjs";
import { raceKeyOf } from "./module/apps/race-library.mjs"; // + хуки кэша рас (пак читается по готовности мира)
import { applyRace, applySubrace, SKIP_MECHANICS_HOOK } from "./module/apps/races.mjs";
import { openCompendiumBrowser } from "./module/apps/compendium-browser.mjs";
import { hasRuleFlag }                from "./module/rules/flags.mjs";
import { FATE_SAVE_FLAG, FATE_SAVE_DIE, fateSpent, fateSaved, fatePoolLabel }
  from "./module/rules/fate-save.mjs";
import { DEFAULT_CALENDAR_CONFIG }    from "./module/constants/imperial-calendar.mjs";
import { openSystemsOverview, refreshSystemsOverview } from "./module/apps/systems-overview.mjs";
import { openCraftWorkshop } from "./module/apps/craft-workshop.mjs";
import { openCogitatorManager } from "./module/apps/cogitator.mjs";
import { openTarotReader } from "./module/apps/veil.mjs";
import { openRigManager } from "./module/apps/rig-manager.mjs";
import { openSurgeon } from "./module/apps/surgeon.mjs";
import { openVeilMystic, veilShift, refreshVeilWindow } from "./module/apps/veil.mjs";
import { refreshVeilOverlay } from "./module/apps/veil-overlay.mjs";
import { openSceneNexus, refreshSceneNexus, execSceneTeleport } from "./module/apps/scene-nexus.mjs";
import { openEnvironment, refreshEnvironment, refreshEnvWidget } from "./module/apps/environment.mjs";
import { initHUD, refreshHUD } from "./module/apps/hud.mjs";
import { initTokenVariants } from "./module/apps/token-variants.mjs";
import { DifficultTerrainBehaviorType, DIFFICULT_TERRAIN_TYPE } from "./module/regions/difficult-terrain.mjs";
import { initDifficultTerrainHud } from "./module/combat/movement-terrain.mjs";
import { migrateWeaponGrips } from "./module/migrations/weapon-grips.mjs";
import { migrateRemoveGeneSeed } from "./module/migrations/gene-seed-cleanup.mjs";
import { runActorSetup } from "./module/apps/actor-setup.mjs";

import { registerFeatureSettings, registerSettingsSections,
         isFeatureEnabled }           from "./module/constants/features.mjs";
import { initPackCaches }             from "./module/apps/origin-shared.mjs";
import { initFactionIndex }           from "./module/apps/faction-cache.mjs";
import { setSystemPackLocks,
         warnEmptySystemPacks }      from "./module/apps/pack-locks.mjs";
import { importBooks }                from "./module/apps/books.mjs";
import { registerHandlebarsHelpers }  from "./module/helpers/handlebars.mjs";
import { registerHooks }              from "./module/hooks.mjs";
import { registerCharacterStartButton, openStartedCharacter, NEW_CHARACTER_NAME } from "./module/apps/character-start.mjs";
import { showApplyDamageDialog }      from "./module/combat/damage.mjs";
import { migrateAllItemEffects }       from "./module/migrations/item-effects.mjs";
import { itemIconFor, isGenericImg }  from "./module/constants/item-icons.mjs";
import { computeShipIdentity }        from "./module/constants/ship-tokens.mjs";

// ─── Инициализация ────────────────────────────────────────────────────────────

Hooks.once("init", () => {
  console.log("Warhammer DBC | Инициализация");

  // ── Флажки подключаемых подсистем ─────────────────────────────────────────
  // Регистрируем первыми: ниже по коду их значения уже могут читаться.
  registerFeatureSettings();
  registerSettingsSections();   // подразделы в окне настроек

  // ── Загрузка партиалов ────────────────────────────────────────────────────
  foundry.applications.handlebars.loadTemplates([
    // Актор
    "systems/warhammer-dbc/templates/actor/parts/header.hbs",
    "systems/warhammer-dbc/templates/actor/parts/minion-header.hbs",
    "systems/warhammer-dbc/templates/actor/parts/faction-field.hbs",
    "systems/warhammer-dbc/templates/apps/nexus-card.hbs",
    "systems/warhammer-dbc/templates/actor/parts/infamy-strip.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-stats.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-combat.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-abilities.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-social.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-psy.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-gear.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-advance.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-notes.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-effects.hbs",  // ← НОВОЕ
    "systems/warhammer-dbc/templates/actor/parts/tab-possession.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-haemonculus.hbs",
    "systems/warhammer-dbc/templates/apps/surgeon-slot.hbs",        // ← хирургикон (партиал слота)
    "systems/warhammer-dbc/templates/apps/hud.hbs",                 // ← боевой HUD
    "systems/warhammer-dbc/templates/apps/ship-hud.hbs",            // ← HUD корабля
    // Предмет
    "systems/warhammer-dbc/templates/item/parts/weapon.hbs",
    "systems/warhammer-dbc/templates/item/parts/ammo.hbs",
    "systems/warhammer-dbc/templates/item/parts/armor.hbs",
    "systems/warhammer-dbc/templates/item/parts/gear.hbs",
    "systems/warhammer-dbc/templates/item/parts/talent.hbs",
    "systems/warhammer-dbc/templates/item/parts/ritual.hbs",
    "systems/warhammer-dbc/templates/item/parts/shield.hbs",
    "systems/warhammer-dbc/templates/item/parts/drug.hbs",          // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/trait.hbs",         // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/psychic-power.hbs", // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/implant.hbs",       // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/tech-power.hbs",    // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/infoguard.hbs",     // ← НОВОЕ
    "systems/warhammer-dbc/templates/actor/parts/tab-tech.hbs",     // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/navigator-power.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-nav.hbs",
    // Корабль
    "systems/warhammer-dbc/templates/item/parts/component.hbs",
    "systems/warhammer-dbc/templates/item/parts/cargo.hbs",
    "systems/warhammer-dbc/templates/item/parts/torpedo.hbs",
    "systems/warhammer-dbc/templates/item/parts/disease.hbs",
    "systems/warhammer-dbc/templates/item/parts/vehicle-gear.hbs",
    "systems/warhammer-dbc/templates/item/parts/vehicle-trait.hbs",
    "systems/warhammer-dbc/templates/item/parts/small-craft.hbs",
    "systems/warhammer-dbc/templates/actor/ship-sheet.hbs",
    "systems/warhammer-dbc/templates/item/parts/weapon-property.hbs",      // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/armour-history-entry.hbs", // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/aspiration.hbs",           // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/archetype.hbs",            // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/faction.hbs",
    "systems/warhammer-dbc/templates/item/parts/elite-archetype.hbs",
    "systems/warhammer-dbc/templates/item/parts/faction-roster.hbs",
    "systems/warhammer-dbc/templates/item/parts/race.hbs",
    "systems/warhammer-dbc/templates/item/parts/subrace.hbs",
    // Звёздная система
    "systems/warhammer-dbc/templates/item/parts/celestial-body.hbs",
    "systems/warhammer-dbc/templates/actor/star-system-sheet.hbs",
    // Техника
    "systems/warhammer-dbc/templates/actor/vehicle-sheet.hbs",
    // Отряд
    "systems/warhammer-dbc/templates/actor/squad-sheet.hbs",
    // Формирование («Книга Битв»)
    "systems/warhammer-dbc/templates/actor/formation-sheet.hbs",
  ]);

  registerHandlebarsHelpers();

  CONFIG.Actor.documentClass = WarhammerActor;
  CONFIG.Item.documentClass  = WarhammerItem;

  // Типы данных документов. Перечисленные здесь типы читают схему из
  // module/data/, а не из template.json: там их записи пусты (см. index.mjs).
  Object.assign(CONFIG.Item.dataModels, ITEM_DATA_MODELS);
  Object.assign(CONFIG.Actor.dataModels, ACTOR_DATA_MODELS);

  CONFIG.Combat.initiative = {
    formula: "1d10 + @initiative + @initiativeMod",
    decimals: 0
  };

  CONFIG.WARHAMMER = {
    RACES, SUBRACES, CHARACTERISTICS, IMPROVEMENTS,
    IMPROVEMENT_BONUS, SKILL_RANKS, SKILLS_DEF, GROUP_SKILLS_DEF,
    ITEM_TYPES, WEAPON_CLASSES, DAMAGE_TYPES, AVAILABILITY,
    HIT_LOCATIONS, MELEE_BASES, MELEE_MANEUVERS, MELEE_CONTESTS, MELEE_STANCES,
    BALANCE_PARRY_MOD, AMMO_CATEGORIES, WEAPON_PROPERTIES
  };

  // Зона «Трудный ландшафт» — нативный Region Behavior (стр. 29 корбука).
  CONFIG.RegionBehavior.dataModels[DIFFICULT_TERRAIN_TYPE] = DifficultTerrainBehaviorType;
  CONFIG.RegionBehavior.typeLabels[DIFFICULT_TERRAIN_TYPE] = "Трудный ландшафт";
  CONFIG.RegionBehavior.typeIcons[DIFFICULT_TERRAIN_TYPE]  = "fa-solid fa-person-hiking";

  // ── Регистрация листов (только новый API v13) ─────────────────────────────

  foundry.documents.collections.Actors.unregisterSheet("core",
    foundry.appv1.sheets.ActorSheet
  );
  foundry.documents.collections.Actors.registerSheet("warhammer-dbc",
    WarhammerCharacterSheet, {
      types: ["character"], makeDefault: true, label: "Лист персонажа WH"
    }
  );
  foundry.documents.collections.Actors.registerSheet("warhammer-dbc",
    WarhammerShipSheet, {
      types: ["ship"], makeDefault: true, label: "Лист корабля WH"
    }
  );
  foundry.documents.collections.Actors.registerSheet("warhammer-dbc",
    WarhammerStarSystemSheet, {
      types: ["starSystem"], makeDefault: true, label: "Лист звёздной системы WH"
    }
  );
  foundry.documents.collections.Actors.registerSheet("warhammer-dbc",
    WarhammerHordeSheet, {
      types: ["horde"], makeDefault: true, label: "Лист орды WH"
    }
  );
  foundry.documents.collections.Actors.registerSheet("warhammer-dbc",
    WarhammerVehicleSheet, {
      types: ["vehicle"], makeDefault: true, label: "Лист техники WH"
    }
  );
  foundry.documents.collections.Actors.registerSheet("warhammer-dbc",
    WarhammerDaemonSheet, {
      types: ["daemon"], makeDefault: true, label: "Лист демона WH"
    }
  );
  foundry.documents.collections.Actors.registerSheet("warhammer-dbc",
    WarhammerMinionSheet, {
      types: ["minion"], makeDefault: true, label: "Лист миньона WH"
    }
  );
  foundry.documents.collections.Actors.registerSheet("warhammer-dbc",
    WarhammerDemonPrinceSheet, {
      types: ["demonPrince"], makeDefault: true, label: "Лист Демон-Принца WH"
    }
  );
  foundry.documents.collections.Actors.registerSheet("warhammer-dbc",
    WarhammerSquadSheet, {
      types: ["squad"], makeDefault: true, label: "Лист отряда WH"
    }
  );
  foundry.documents.collections.Actors.registerSheet("warhammer-dbc",
    WarhammerFormationSheet, {
      types: ["formation"], makeDefault: true, label: "Лист формирования WH"
    }
  );

  foundry.documents.collections.Items.unregisterSheet("core",
    foundry.appv1.sheets.ItemSheet
  );
  foundry.documents.collections.Items.registerSheet("warhammer-dbc",
    WarhammerItemSheet, {
      makeDefault: true, label: "Лист предмета WH"
    }
  );

  // Редактор Active Effect: ядро рисует "phase" скрытым полем — GM не может
  // выставить его через UI (см. module/sheets/active-effect-config.mjs).
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    ActiveEffect, "warhammer-dbc", WarhammerActiveEffectConfig,
    { makeDefault: true, types: ["base"], label: "Эффект WH (с полем «Фаза»)" }
  );

  // Ручное редактирование библиотек: разблокировать все компендиумы системы.
  // Переписывать правки при запуске больше нечему — содержимое компендиумов
  // приезжает готовым из packs-src/ (этап 4 плана), а не заполняется кодом.
  // Ключ настройки остался прежним, чтобы у существующих миров не сбросился
  // выбор.
  game.settings.register("warhammer-dbc", "protectCompendiumEdits", {
    name: "Разблокировать библиотеки для правки",
    hint: "Включите, чтобы редактировать компендиумы системы (Таланты, Черты, "
      + "Импланты и остальные) вручную: все компендиумы системы будут "
      + "разблокированы при запуске мира. Выключите — замки вернутся, включая "
      + "снятые вручную. Правки останутся в вашем мире; чтобы они попали в "
      + "систему, их нужно снять в исходники командой npm run packs:unpack.",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: async (on) => { if (game.user.isGM) await setSystemPackLocks(!on); }
  });

  // Настройка: убрать серую рамку у заметок-пинов на сцене.
  game.settings.register("warhammer-dbc", "hideNoteFrame", {
    name: "Заметки сцены без рамки",
    hint: "Убирает серую подложку-рамку у иконок заметок (журнал-пинов) на карте.",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: () => { try { canvas?.notes?.placeables?.forEach(n => n.draw()); } catch (e) {} }
  });

  // Версия разложенных по папкам компендиумов (одноразовая миграция раскладки)
  game.settings.register("warhammer-dbc", "packFoldersVersion", {
    scope: "world", config: false, type: Number, default: 0
  });

  // Версия проставленных хватов рукопашному оружию (одноразовая миграция)
  game.settings.register("warhammer-dbc", "weaponGripsVersion", {
    scope: "world", config: false, type: Number, default: 0
  });

  // Версия чистки остатков старой системы Органов Геносемени (одноразовая)
  game.settings.register("warhammer-dbc", "geneSeedCleanupVersion", {
    scope: "world", config: false, type: Number, default: 0
  });

  // Столица протектората Вольного Торговца (id актёра-системы)
  game.settings.register("warhammer-dbc", "protectorateCapital", {
    scope: "world", config: false, type: String, default: ""
  });
  // Династия игрока-ВТ (отображается на его планетах как владение)
  game.settings.register("warhammer-dbc", "playerDynasty", {
    scope: "world", config: false, type: String, default: ""
  });
  game.settings.register("warhammer-dbc", "dynastyCrest", {  // путь к картинке герба
    scope: "world", config: false, type: String, default: ""
  });
  game.settings.register("warhammer-dbc", "dynastyMotto", {  // девиз
    scope: "world", config: false, type: String, default: ""
  });
  // Список известных династий Вольных Торговцев (для выбора при генерации)
  game.settings.register("warhammer-dbc", "dynasties", {
    scope: "world", config: false, type: Array, default: []
  });
  // Дефолтный сектор и список регионов для систем
  game.settings.register("warhammer-dbc", "defaultSector", {
    scope: "world", config: false, type: String, default: ""
  });
  game.settings.register("warhammer-dbc", "regions", {
    scope: "world", config: false, type: Array, default: []
  });
  // Прочие траты протектората (ручные): { resKey: amount }
  game.settings.register("warhammer-dbc", "protectorateOtherCosts", {
    scope: "world", config: false, type: Object, default: {}
  });
  // Контракты протектората: [{ id, name, cost: {resKey: amount}, gain: "услуги/текст" }]
  game.settings.register("warhammer-dbc", "protectorateContracts", {
    scope: "world", config: false, type: Array, default: []
  });
  // Имперская дата: эпоха/деления суток/контрольный номер. Своя форма через
  // Dialog (openCalendarSettings) — не через generic-меню настроек.
  game.settings.register("warhammer-dbc", "imperialCalendar", {
    scope: "world", config: false, type: Object, default: DEFAULT_CALENDAR_CONFIG,
    onChange: () => { try { refreshCalendarWidget(); } catch (e) {} }
  });
  // Авто-течение времени (Старт/Пауза + множитель скорости) — тикает в
  // клиенте ГМа, см. initTimeFlow()/timeFlowState() в imperial-calendar.mjs.
  game.settings.register("warhammer-dbc", "timeFlow", {
    scope: "world", config: false, type: Object, default: { running: false, speed: 1 },
    onChange: () => { try { refreshCalendarWidget(); } catch (e) {} }
  });

  // Нексус Сцен: именованные группы сцен + общая Завеса группы.
  // [{ id, name, color, order, sceneIds:[], veil:{...} }]
  game.settings.register("warhammer-dbc", "sceneGroups", {
    scope: "world", config: false, type: Array, default: [],
    onChange: () => {
      try { refreshSceneNexus(); } catch (e) {}
      try { refreshVeilOverlay(); } catch (e) {}
      try { refreshVeilWindow(); } catch (e) {}
      try { refreshEnvWidget(); } catch (e) {}
      try { refreshEnvironment(); } catch (e) {}
    }
  });

  // Голографические зелёные иконки заметок (для звёздных карт).
  try {
    const base = "systems/warhammer-dbc/assets/map-icons/";
    foundry.utils.mergeObject(CONFIG.JournalEntry.noteIcons, {
      "Голо · Система":    base + "system.svg",
      "Голо · Звезда":     base + "star.svg",
      "Голо · Планета":    base + "planet.svg",
      "Голо · Станция":    base + "station.svg",
      "Голо · Аномалия":   base + "anomaly.svg",
      "Голо · Флот":       base + "fleet.svg",
      "Голо · Точка":      base + "waypoint.svg",
      "Игроки · Золото":   base + "player-gold.svg",
      "Игроки · Красный":  base + "player-red.svg",
      "Игроки · Синий":    base + "player-blue.svg",
      "Игроки · Зелёный":  base + "player-green.svg"
    });
  } catch (e) { console.warn("warhammer-dbc | noteIcons", e); }
});

// Прямой переход с заметки-пина звёздной системы на лист актёра (минуя журнал).
// Срабатывает ТОЛЬКО если у журнала заметки выставлен наш флаг systemActorUuid —
// обычные журналы открываются как прежде.
Hooks.once("setup", () => {
  try {
    const NoteCls = foundry.canvas?.placeables?.Note ?? globalThis.Note;
    if (!NoteCls?.prototype?._onClickLeft2) return;
    const orig = NoteCls.prototype._onClickLeft2;
    NoteCls.prototype._onClickLeft2 = function (event) {
      try {
        const uuid = this.document?.entry?.getFlag?.("warhammer-dbc", "systemActorUuid");
        if (uuid) {
          fromUuid(uuid).then(a => a?.sheet?.render(true)).catch(() => {});
          return;
        }
      } catch (e) { /* падаем к обычному поведению журнала */ }
      return orig.call(this, event);
    };
  } catch (e) { console.warn("warhammer-dbc | note→actor patch", e); }
});

// Заметки сцены: убираем серую подложку (по настройке) и держим название всегда видимым (по флагу).
function _whNoteAlways(note) {
  try { return !!note?.document?.getFlag?.("warhammer-dbc", "alwaysShowLabel"); } catch (e) { return false; }
}
// Включает постоянный показ названия и убирает обводку (stroke) у текста ярлыка.
function _whStyleLabel(note) {
  const t = note?.tooltip;
  if (!t) return;
  t.visible = true; t.renderable = true;
  if (t.style && t.style.strokeThickness !== 0) {
    t.style.strokeThickness = 0; t.style.stroke = null;
    if (t.style.dropShadow !== undefined) t.style.dropShadow = false;
    try { t.updateText?.(false); } catch (e) {}   // принудительно перерисовать текст без обводки
  }
}
Hooks.on("drawNote", (note) => {
  try {
    if (game.settings.get("warhammer-dbc", "hideNoteFrame")) {
      const ci = note.controlIcon;
      if (ci) {
        if (ci.bg) { try { ci.bg.clear(); } catch (e) {} ci.bg.visible = false; }
        if (ci.border) ci.border.visible = false;
      }
    }
    if (_whNoteAlways(note)) _whStyleLabel(note);
  } catch (e) {}
});
// Не прятать название при уводе курсора, если включено «всегда показывать».
Hooks.on("hoverNote", (note, hovered) => {
  try { if (!hovered && _whNoteAlways(note)) _whStyleLabel(note); } catch (e) {}
});
// Главное: после каждой перерисовки заметки заново включаем видимость названия и убираем обводку,
// иначе Foundry прячет ярлык (показ только при наведении) и возвращает stroke.
Hooks.on("refreshNote", (note) => {
  try { if (_whNoteAlways(note)) _whStyleLabel(note); } catch (e) {}
});
// При обновлении заметки перерисовываем её (чтобы галочка применилась сразу).
Hooks.on("updateNote", (doc) => {
  try { doc.object?.draw?.(); } catch (e) {}
});

// Добавляем в окно настройки заметки галочку «Всегда показывать название».
Hooks.on("renderNoteConfig", (app, html) => {
  try {
    const root = (html instanceof HTMLElement) ? html : (html?.[0] || html);
    if (!root || !root.querySelector) return;
    if (root.querySelector('[name="flags.warhammer-dbc.alwaysShowLabel"]')) return;
    const checked = app?.document?.getFlag?.("warhammer-dbc", "alwaysShowLabel") ? "checked" : "";
    const grp = document.createElement("div");
    grp.className = "form-group";
    grp.innerHTML = `<label>Всегда показывать название</label>
      <div class="form-fields"><input type="checkbox" name="flags.warhammer-dbc.alwaysShowLabel" ${checked}/></div>`;
    const form = root.querySelector("form") || root;
    const anchor = form.querySelector('[name="textAnchor"]')?.closest(".form-group");
    if (anchor) anchor.after(grp); else form.appendChild(grp);
    app.setPosition?.({ height: "auto" });
  } catch (e) { console.warn("warhammer-dbc | renderNoteConfig", e); }
});

// Регистрируем hooks
registerHooks();

// Кнопка «Начать создание персонажа» в панели «Актёры» (apps/character-start.mjs):
// с неё начинается новый персонаж — с выбора Уровня стартовой игры.
registerCharacterStartButton();

// ── Сокет: посадка игрока в чужую технику через активного ГМа ─────────────────
// Игрок не может обновлять актора-технику, которым не владеет. Клиент игрока
// шлёт запрос, активный ГМ применяет его — но только если игрок сажает/высаживает
// персонажа, которым владеет, и не добавляет/не удаляет сами места.

Hooks.once("ready", () => {
  // Проверка: набор мест не изменён, а любое изменение занятости касается
  // только персонажа, которым владеет запросивший игрок.
  const _validSeatChange = (before, next, requester) => {
    const ids = arr => arr.map(s => s.id).sort().join(",");
    if (ids(before) !== ids(next)) return false;
    const byId = new Map(before.map(s => [s.id, s]));
    const owns = (u) => {
      if (!u) return true;
      try { const d = fromUuidSync(u); const a = d?.actor ?? d; return !!a?.testUserPermission(requester, "OWNER"); }
      catch (e) { return false; }
    };
    for (const s of next) {
      const oldU = (byId.get(s.id)?.uuid) || "", newU = s.uuid || "";
      if (oldU === newU) continue;
      if (!owns(oldU) || !owns(newU)) return false;
    }
    return true;
  };

  // Отряд: в отличие от мест техники, состав можно пополнять и сокращать, но
  // только своими персонажами. Любая правка чужой строки состава или чужого
  // поста (Лидер/Командир/Координатор) — отказ.
  const _validSquadChange = (before, next, requester) => {
    const owns = (u) => {
      if (!u) return false;
      try { const d = fromUuidSync(u); const a = d?.actor ?? d; return !!a?.testUserPermission(requester, "OWNER"); }
      catch (e) { return false; }
    };

    // Посты: изменившийся слот должен касаться только своего персонажа.
    for (const key of ["leader", "commander", "coordinator"]) {
      const oldU = before.posts?.[key]?.uuid || "", newU = next.posts?.[key]?.uuid || "";
      if (oldU === newU) continue;
      if (oldU && !owns(oldU)) return false;
      if (newU && !owns(newU)) return false;
    }

    // Состав: добавленные и удалённые строки — только свои акторы.
    const beforeById = new Map((before.members || []).map(m => [m.id, m]));
    const nextById   = new Map((next.members   || []).map(m => [m.id, m]));
    for (const [id, m] of beforeById) {
      if (!nextById.has(id) && !owns(m.uuid)) return false;          // чужого не выгнать
    }
    for (const [id, m] of nextById) {
      const old = beforeById.get(id);
      if (!old) { if (!owns(m.uuid)) return false; continue; }        // чужого не привести
      // Существующая строка: править её (uuid, заметку, отметку Морали) может
      // только владелец этого персонажа.
      if (JSON.stringify(old) !== JSON.stringify(m) && !owns(old.uuid)) return false;
    }
    return true;
  };

  game.socket.on("system.warhammer-dbc", async (data) => {
    try {
      // Баннер Сессии/Сцены — у ВСЕХ клиентов (не только у активного ГМа).
      if (data.action === "sessionSceneBanner") { showFateTurnBanner(data.text); return; }
      // Ответ Мастера на просьбу завести персонажа: лист и Мастер создания
      // открываются у того, кто просил, — остальные это сообщение пропускают.
      if (data.action === "characterStarted") {
        if (data.userId !== game.user.id) return;
        const actor = await fromUuid(data.uuid).catch(() => null);
        if (actor) await openStartedCharacter(actor);
        return;
      }
      if (game.user !== game.users.activeGM) return;      // применяет ровно один ГМ
      const requester = game.users.get(data?.userId);
      if (!requester) return;

      if (data.action === "vehicleStations") {
        const veh = (await fromUuid(data.vehicleUuid))?.actor ?? await fromUuid(data.vehicleUuid);
        if (veh?.type !== "vehicle") return;
        const before = Array.isArray(veh.system.stations) ? veh.system.stations : [];
        const next   = Array.isArray(data.stations) ? data.stations : [];
        if (!_validSeatChange(before, next, requester))
          return console.warn("Warhammer DBC | Посадка (техника) отклонена.");
        await veh.update({ "system.stations": next });
      }
      else if (data.action === "shipOfficers") {
        const ship = (await fromUuid(data.shipUuid))?.actor ?? await fromUuid(data.shipUuid);
        if (ship?.type !== "ship") return;
        const before = Array.isArray(ship.system.officers) ? ship.system.officers : [];
        const next   = Array.isArray(data.officers) ? data.officers : [];
        if (!_validSeatChange(before, next, requester))
          return console.warn("Warhammer DBC | Посадка (офицер) отклонена.");
        await ship.update({ "system.officers": next });
      }
      else if (data.action === "squadRoster") {
        const sq = (await fromUuid(data.squadUuid))?.actor ?? await fromUuid(data.squadUuid);
        if (sq?.type !== "squad") return;
        const before = { posts: sq.system.posts || {}, members: Array.isArray(sq.system.members) ? sq.system.members : [] };
        const next   = { posts: data.posts || {},      members: Array.isArray(data.members) ? data.members : [] };
        if (!_validSquadChange(before, next, requester))
          return console.warn("Warhammer DBC | Изменение состава отряда отклонено.");
        await sq.update({ "system.posts": next.posts, "system.members": next.members });
      }
      else if (data.action === "formationRoster") {
        if (!isFeatureEnabled("battleBook")) return;   // подсистема выключена — запросы не применяем
        const fm = (await fromUuid(data.formationUuid))?.actor ?? await fromUuid(data.formationUuid);
        if (fm?.type !== "formation") return;
        // Тот же контроль, что у отряда: пост командира — как один «слот»,
        // приданные герои — как список, и трогать можно только своих.
        const before = {
          posts:   { leader: fm.system.posts?.commander || {}, commander: {}, coordinator: {} },
          members: Array.isArray(fm.system.attached) ? fm.system.attached : []
        };
        const next = {
          posts:   { leader: data.posts?.commander || {}, commander: {}, coordinator: {} },
          members: Array.isArray(data.attached) ? data.attached : []
        };
        if (!_validSquadChange(before, next, requester))
          return console.warn("Warhammer DBC | Изменение состава формирования отклонено.");
        await fm.update({ "system.posts": data.posts, "system.attached": next.members });
      }
      else if (data.action === "itemMechanics") {
        // Механику предмета настраивают все за столом, но писать чужой предмет
        // клиенту не дают — правка приходит сюда и ложится нашей рукой.
        const item = await fromUuid(data.uuid).catch(() => null);
        if (!(item instanceof Item) || !Array.isArray(data.groups)) return;
        await saveItemMechanics(item, data.groups);
      }
      else if (data.action === "itemUpdate") {
        // Общий релей (relayItemUpdate, module/helpers/utils.mjs) для блоков листа
        // предмета, которые обязаны работать не только у владельца — напр.
        // «Особенность комплекта» силовой брони (module/apps/armour-history.mjs).
        // В отличие от itemMechanics (пишет только через доверенный
        // saveItemMechanics), здесь клиент присылает произвольный object для
        // item.update() — без сужения путей любой подключённый клиент мог бы
        // socket-сообщением переписать ЛЮБОЕ поле ЛЮБОГО предмета в игре, а не
        // только «Особенность брони» и «Инфограждение». Сейчас все настоящие
        // вызыватели пишут только под system.history.* (armour-history.mjs,
        // item-sheet.mjs) или system.infoguard (module/apps/infoguard.mjs) —
        // разрешаем ровно эти два пути, остальное отклоняем.
        const item = await fromUuid(data.uuid).catch(() => null);
        if (!(item instanceof Item) || !data.data || typeof data.data !== "object") return;
        const allowed = Object.keys(data.data).every(k => k === "system.history"
          || k.startsWith("system.history.") || k === "system.infoguard");
        if (!allowed) return console.warn("Warhammer DBC | itemUpdate отклонён: путь вне system.history.*/system.infoguard", data.data);
        await item.update(data.data);
      }
      else if (data.action === "startCharacter") {
        // Игрок нажал «Начать создание персонажа», а права заводить Актёров у
        // его роли нет. Лист создаём мы и сразу отдаём его во владение
        // просителю — дальше он сам работает Мастером создания.
        const actor = await Actor.create({
          name: NEW_CHARACTER_NAME,
          type: "character",
          ownership: { [requester.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }
        });
        if (!actor) return;
        game.socket.emit("system.warhammer-dbc",
          { action: "characterStarted", userId: requester.id, uuid: actor.uuid });
      }
      else if (data.action === "cogitatorDiary") {
        // Игрок ведёт запись на странице-дневнике когитатора — пишет ГМ.
        const j = game.journal.get(data.journalId);
        const cog = j?.getFlag("warhammer-dbc", "cogitator");
        if (!j || !cog) return;
        if (!j.testUserPermission(requester, "OBSERVER")) return;   // нужен доступ к когитатору
        const pages = foundry.utils.deepClone(cog.pages || []);
        const page  = pages.find(p => p.id === data.pageId);
        if (!page || !page.input) return;
        const text = String(data.text ?? "").slice(0, 20000);
        if (data.shared) page.inputText = text;
        else { (page.entries ||= {})[requester.id] = text; }        // всегда под id отправителя
        await j.update({ "flags.warhammer-dbc.cogitator.pages": pages });
      }
    } catch (e) { console.warn("Warhammer DBC | seat socket:", e); }
  });
});

// ── Кнопка «Обзор звёздных систем» в меню управления сценой ───────────────────
// Доступ-фолбэк (на случай иной версии API контролов): game.warhammerDBC.openSystemsOverview()
Hooks.once("ready", () => {
  game.warhammerDBC = foundry.utils.mergeObject(game.warhammerDBC || {}, { importBooks, openSystemsOverview, openCraftWorkshop, openCogitatorManager, openTarotReader, openRigManager, openSurgeon, openVeilMystic, veilShift, openSceneNexus, openEnvironment, migrateWeaponGrips, migrateRemoveGeneSeed, runActorSetup });
});

// ── Одноразовая миграция: хваты + профили ББ из канон-текста (стр. 39, 207-221) ─
// Ручной перезапуск (в т.ч. с перезаписью): game.warhammerDBC.migrateWeaponGrips({force:true})
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const VERSION = 2;
  if ((game.settings.get("warhammer-dbc", "weaponGripsVersion") || 0) >= VERSION) return;
  try {
    await migrateWeaponGrips();
    await game.settings.set("warhammer-dbc", "weaponGripsVersion", VERSION);
  } catch (e) { console.error("Warhammer DBC | Авто-миграция хватов:", e); }
});

// ── Одноразовая чистка: остатки снятой системы Органов Геносемени ─────────────
// Ручной перезапуск: game.warhammerDBC.migrateRemoveGeneSeed()
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const VERSION = 1;
  if ((game.settings.get("warhammer-dbc", "geneSeedCleanupVersion") || 0) >= VERSION) return;
  try {
    await migrateRemoveGeneSeed();
    await game.settings.set("warhammer-dbc", "geneSeedCleanupVersion", VERSION);
  } catch (e) { console.error("Warhammer DBC | Чистка Геносемени:", e); }
});

// ── Боевой HUD (панель внизу вместо хотбара) ──────────────────────────────────
Hooks.once("ready", () => initHUD());
// Варианты облика токена: кнопка в меню токена (игрок выбирает сам).
Hooks.once("init", () => initTokenVariants());
Hooks.once("init", () => initDifficultTerrainHud());
Hooks.once("init", () => initEquipmentIndex());

// ── Виджет «Окружающая Среда» (левый-нижний угол, видят все) ──────────────────
Hooks.once("ready",     () => refreshEnvWidget());
Hooks.on("canvasReady", () => refreshEnvWidget());
Hooks.on("updateScene", (scene) => {
  refreshEnvWidget();                                   // виджет — у всех
  if (scene?.id === (canvas?.scene?.id)) refreshEnvironment();  // окно ГМа
});

// ── Виджет «Имперская дата» (видят все; источник времени — game.time.worldTime,
//    поэтому Duration (Seconds) у эффектов синхронна с прокруткой без доп. кода) ──
Hooks.once("ready", () => refreshCalendarWidget());
Hooks.once("ready", () => initTimeFlow());
Hooks.on("updateWorldTime", () => refreshCalendarWidget());

// ── Нексус Сцен: держать открытое окно в актуальном состоянии ─────────────────
// Сцены (имя/превью/флаг-переход/активна) и выбор токенов влияют на галерею.
Hooks.on("createScene", () => refreshSceneNexus());
Hooks.on("deleteScene", () => refreshSceneNexus());
Hooks.on("updateScene", () => refreshSceneNexus());
Hooks.on("controlToken", () => refreshSceneNexus());
Hooks.on("canvasReady",  () => refreshSceneNexus());
Hooks.on("updateUser",   () => refreshSceneNexus());
// Список игроков перерисовывается при активности/подключении — обновляем присутствие.
Hooks.on("renderPlayerList", () => refreshSceneNexus());

// ── Нексус: перенос через флаги User-документа (надёжный канал вместо сокета) ──
// Игрок пишет запрос в flags.warhammer-dbc.nexusReq своего user → активный ГМ
// выполняет перенос. ГМ пишет ответ в flags.warhammer-dbc.nexusGoto user'а игрока
// → тот показывает целевую сцену / получает сообщение.
Hooks.on("updateUser", async (user, changes) => {
  try {
    const req = foundry.utils.getProperty(changes, "flags.warhammer-dbc.nexusReq");
    if (req && game.user === game.users.activeGM) {
      await user.unsetFlag("warhammer-dbc", "nexusReq");   // очистить до выполнения (без циклов)
      await execSceneTeleport({ fromSceneId: req.fromSceneId, toSceneId: req.toSceneId, tokenIds: req.tokenIds }, user);
    }
    const goto = foundry.utils.getProperty(changes, "flags.warhammer-dbc.nexusGoto");
    if (goto && user.id === game.user.id) {
      await game.user.unsetFlag("warhammer-dbc", "nexusGoto");
      if (goto.toSceneId) { try { await game.scenes.get(goto.toSceneId)?.view(); } catch (e) {} }
      if (goto.msg) ui.notifications?.[goto.msg.kind === "error" ? "error" : goto.msg.kind === "info" ? "info" : "warn"](goto.msg.text);
    }
  } catch (e) { console.error("Warhammer DBC | Нексус updateUser:", e); }
});

// ── Одноразовая раскладка компендиумов по папкам ─────────────────────────────
// packFolders из манифеста не переприменяется к уже созданному миру, поэтому
// раскладываем программно один раз (по версии-флагу; ручную перестановку не трогаем).
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const VERSION = 6;
  if ((game.settings.get("warhammer-dbc", "packFoldersVersion") || 0) >= VERSION) return;
  const STRUCT = [
    ["Арсенал", ["weapons", "ammunition", "armor", "shields", "armour-systems", "armor-mods", "weapon-mods", "gear", "tools", "chemistry", "implants"]],
    ["Продвижение", ["traits", "talents"]],
    ["Псайкана и Мистика", ["psychic-powers", "tech-powers"]],
    ["Порча и Хаос", ["diseases"]],
    ["Корабли и техника", ["ship-components", "vehicle-equipment", "vehicle-traits", "vehicle-weapons", "vehicles", "small-craft"]],
    ["Другое", ["bestiary"]]
  ];
  try {
    let parent = game.folders.find(f => f.type === "Compendium" && f.name === "Warhammer DBC");
    if (!parent) parent = await Folder.create({ name: "Warhammer DBC", type: "Compendium" });
    for (const [name, packs] of STRUCT) {
      let folder = game.folders.find(f => f.type === "Compendium" && f.name === name && ((f.folder?.id ?? null) === parent.id));
      if (!folder) folder = await Folder.create({ name, type: "Compendium", folder: parent.id });
      for (const p of packs) {
        const pack = game.packs.get(`warhammer-dbc.${p}`);
        if (pack && (pack.folder?.id ?? null) !== folder.id) {
          try { await pack.setFolder(folder); } catch (e) { console.warn("Warhammer DBC | setFolder", p, e); }
        }
      }
    }
    await game.settings.set("warhammer-dbc", "packFoldersVersion", VERSION);
    console.log("Warhammer DBC | Компендиумы разложены по папкам.");
    ui.notifications?.info("Warhammer DBC: компендиумы разложены по папкам.");
  } catch (e) { console.error("Warhammer DBC | Раскладка компендиумов:", e); }
});
// Авто-обновление окна обзора при изменении систем/планет (экстракциумы, улучшения и т.п.)
Hooks.on("updateItem", (item) => { if (item?.type === "celestialBody") refreshSystemsOverview(); });
Hooks.on("createItem", (item) => { if (item?.type === "celestialBody") refreshSystemsOverview(); });
Hooks.on("deleteItem", (item) => { if (item?.type === "celestialBody") refreshSystemsOverview(); });
Hooks.on("updateActor", (actor) => { if (actor?.type === "starSystem") refreshSystemsOverview(); });

Hooks.on("getSceneControlButtons", (controls) => {
  try {
    const ICON = "fa-solid fa-circle-nodes";
    // Открыть окно и сразу вернуть активным контролом «tokens», иначе группа
    // «залипает» активной и повторный клик не вызывает onChange (окно не открыть).
    const CRAFT_ICON = "fa-solid fa-hammer";
    const COG_ICON = "fa-solid fa-terminal";
    const TAROT_ICON = "fa-solid fa-wand-sparkles";
    const VEIL_ICON = "fa-solid fa-hand-sparkles";
    const NEXUS_ICON = "fa-solid fa-diagram-project";
    const triggerVeil = () => {
      openVeilMystic();
      setTimeout(() => { try { ui.controls?.activate?.({ control: "tokens" }); } catch (e) {} }, 60);
    };
    const triggerNexus = () => {
      openSceneNexus();
      setTimeout(() => { try { ui.controls?.activate?.({ control: "tokens" }); } catch (e) {} }, 60);
    };
    const ENV_ICON = "fa-solid fa-cloud-sun-rain";
    const triggerEnv = () => {
      openEnvironment();
      setTimeout(() => { try { ui.controls?.activate?.({ control: "tokens" }); } catch (e) {} }, 60);
    };
    const trigger = () => {
      openSystemsOverview();
      setTimeout(() => { try { ui.controls?.activate?.({ control: "tokens" }); } catch (e) {} }, 60);
    };
    const triggerCraft = () => {
      openCraftWorkshop();
      setTimeout(() => { try { ui.controls?.activate?.({ control: "tokens" }); } catch (e) {} }, 60);
    };
    const triggerCog = () => {
      openCogitatorManager();
      setTimeout(() => { try { ui.controls?.activate?.({ control: "tokens" }); } catch (e) {} }, 60);
    };
    const triggerTarot = () => {
      openTarotReader();
      setTimeout(() => { try { ui.controls?.activate?.({ control: "tokens" }); } catch (e) {} }, 60);
    };
    if (Array.isArray(controls)) {
      // Foundry v12 и ранее — массив групп
      controls.push({
        name: "wh-systems", title: "Звёздные системы", icon: ICON, layer: null,
        visible: true, activeTool: "open",
        tools: [{ name: "open", title: "Обзор систем", icon: "fa-solid fa-table-list",
                  button: true, onClick: () => trigger() }]
      });
      controls.push({
        name: "wh-craft", title: "Крафт и Исследования", icon: CRAFT_ICON, layer: null,
        visible: true, activeTool: "open",
        tools: [{ name: "open", title: "Мастерская", icon: "fa-solid fa-flask",
                  button: true, onClick: () => triggerCraft() }]
      });
      controls.push({
        name: "wh-cog", title: "Когитаторы", icon: COG_ICON, layer: null,
        visible: true, activeTool: "open",
        tools: [{ name: "open", title: "Когитаторы", icon: "fa-solid fa-terminal",
                  button: true, onClick: () => triggerCog() }]
      });
      controls.push({
        name: "wh-veil", title: "Завеса и Мистика", icon: VEIL_ICON, layer: null,
        visible: true, activeTool: "open",
        tools: [{ name: "open", title: "Завеса и Мистика", icon: VEIL_ICON,
                  button: true, onClick: () => triggerVeil() }]
      });
      controls.push({
        name: "wh-nexus", title: "Нексус Сцен", icon: NEXUS_ICON, layer: null,
        visible: true, activeTool: "open",
        tools: [{ name: "open", title: "Нексус Сцен", icon: NEXUS_ICON,
                  button: true, onClick: () => triggerNexus() }]
      });
      if (game.user.isGM) controls.push({
        name: "wh-env", title: "Окружающая Среда", icon: ENV_ICON, layer: null,
        visible: true, activeTool: "open",
        tools: [{ name: "open", title: "Окружающая Среда", icon: ENV_ICON,
                  button: true, onClick: () => triggerEnv() }]
      });
    } else if (controls && typeof controls === "object") {
      // Foundry v13 — объект-словарь групп (onChange, без устаревшего onClick)
      controls["wh-systems"] = {
        name: "wh-systems", title: "Звёздные системы", icon: ICON, order: 90, visible: true,
        onChange: (_event, active) => { if (active) trigger(); },
        tools: {
          open: { name: "open", title: "Обзор систем", icon: "fa-solid fa-table-list",
                  order: 1, button: true, onChange: () => trigger() }
        },
        activeTool: "open"
      };
      controls["wh-craft"] = {
        name: "wh-craft", title: "Крафт и Исследования", icon: CRAFT_ICON, order: 91, visible: true,
        onChange: (_event, active) => { if (active) triggerCraft(); },
        tools: {
          open: { name: "open", title: "Мастерская", icon: "fa-solid fa-flask",
                  order: 1, button: true, onChange: () => triggerCraft() }
        },
        activeTool: "open"
      };
      controls["wh-cog"] = {
        name: "wh-cog", title: "Когитаторы", icon: COG_ICON, order: 92, visible: true,
        onChange: (_event, active) => { if (active) triggerCog(); },
        tools: {
          open: { name: "open", title: "Когитаторы", icon: "fa-solid fa-terminal",
                  order: 1, button: true, onChange: () => triggerCog() }
        },
        activeTool: "open"
      };
      controls["wh-veil"] = {
        name: "wh-veil", title: "Завеса и Мистика", icon: VEIL_ICON, order: 94, visible: true,
        onChange: (_event, active) => { if (active) triggerVeil(); },
        tools: {
          open: { name: "open", title: "Завеса и Мистика", icon: VEIL_ICON,
                  order: 1, button: true, onChange: () => triggerVeil() }
        },
        activeTool: "open"
      };
      controls["wh-nexus"] = {
        name: "wh-nexus", title: "Нексус Сцен", icon: NEXUS_ICON, order: 95, visible: true,
        onChange: (_event, active) => { if (active) triggerNexus(); },
        tools: {
          open: { name: "open", title: "Нексус Сцен", icon: NEXUS_ICON,
                  order: 1, button: true, onChange: () => triggerNexus() }
        },
        activeTool: "open"
      };
      if (game.user.isGM) controls["wh-env"] = {
        name: "wh-env", title: "Окружающая Среда", icon: ENV_ICON, order: 96, visible: true,
        onChange: (_event, active) => { if (active) triggerEnv(); },
        tools: {
          open: { name: "open", title: "Окружающая Среда", icon: ENV_ICON,
                  order: 1, button: true, onChange: () => triggerEnv() }
        },
        activeTool: "open"
      };
    }
  } catch (e) { console.warn("warhammer-dbc | scene control", e); }
});

// ── Встроенный трей костей (замена модулю Dice Tray) ───────────────────────────
const WH_DICE = [4, 6, 8, 10, 12, 20, 100];
const _dt = { pool: {}, qty: 1, mod: 0, keep: null };
function _whDTFormula() {
  const parts = [];
  for (const d of WH_DICE) { const n = _dt.pool[d] || 0; if (n) parts.push(`${n}d${d}${_dt.keep || ""}`); }
  let f = parts.join(" + ");
  if (_dt.mod) f += (_dt.mod > 0 ? ` + ${_dt.mod}` : ` - ${Math.abs(_dt.mod)}`);
  return f;
}
function _whRenderTray(tray) {
  const formula = _whDTFormula();
  const fEl = tray.querySelector(".wh-dt-formula");
  if (fEl) fEl.textContent = formula || "— выберите кубы —";
  // Дубль формулы в заголовке — чтобы набранное было видно и в свёрнутом виде.
  const hEl = tray.querySelector(".wh-dt-head-formula");
  if (hEl) hEl.textContent = formula || "";
  const q = tray.querySelector(".wh-dt-qty"); if (q) q.textContent = "×" + _dt.qty;
  const m = tray.querySelector(".wh-dt-mod"); if (m) m.textContent = (_dt.mod >= 0 ? "+" : "") + _dt.mod;
  tray.querySelectorAll(".wh-dt-keep").forEach(b => b.classList.toggle("on", b.dataset.act === _dt.keep));
}
async function _whRollTray(tray) {
  const f = _whDTFormula(); if (!f) return;
  try {
    const roll = new Roll(f);
    await roll.toMessage({ speaker: ChatMessage.getSpeaker(), flavor: "🎲 Бросок костей" });
  } catch (e) { ui.notifications.warn("Не удалось бросить: " + e.message); }
  _dt.pool = {}; _whRenderTray(tray);
}
function _whBindTray(tray) {
  tray.addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    if (b.dataset.d) { _dt.pool[b.dataset.d] = (_dt.pool[b.dataset.d] || 0) + _dt.qty; }
    else switch (b.dataset.act) {
      case "qu": _dt.qty = Math.min(20, _dt.qty + 1); break;
      case "qd": _dt.qty = Math.max(1, _dt.qty - 1); break;
      case "mu": _dt.mod++; break;
      case "md": _dt.mod--; break;
      case "kh": _dt.keep = _dt.keep === "kh" ? null : "kh"; break;
      case "kl": _dt.keep = _dt.keep === "kl" ? null : "kl"; break;
      case "clear": _dt.pool = {}; _dt.mod = 0; _dt.keep = null; break;
      case "roll": _whRollTray(tray); return;
    }
    _whRenderTray(tray);
  });
}
function _whBuildTray() {
  const dice = WH_DICE.map(d => `<button class="wh-dt-die" data-d="${d}">d${d}</button>`).join("");
  const tray = document.createElement("div");
  // Лоток занимает много места над полем ввода, поэтому по умолчанию свёрнут:
  // видна только узкая полоска-заголовок. Состояние помним в localStorage.
  const collapsed = localStorage.getItem("wh-dice-tray-collapsed") !== "0";
  tray.className = "wh-dice-tray" + (collapsed ? " is-collapsed" : "");
  tray.innerHTML = `
    <div class="wh-dt-head" title="Свернуть/развернуть лоток кубов">
      <span class="wh-dt-caret">${collapsed ? "▸" : "▾"}</span>
      <span class="wh-dt-title">Кубы</span>
      <span class="wh-dt-head-formula"></span>
    </div>
    <div class="wh-dt-body">
    <div class="wh-dt-formula">— выберите кубы —</div>
    <div class="wh-dt-dice">${dice}</div>
    <div class="wh-dt-row">
      <span class="wh-dt-grp" title="кубов за клик">
        <button class="wh-dt-step" data-act="qd">−</button>
        <span class="wh-dt-qty">×1</span>
        <button class="wh-dt-step" data-act="qu">+</button>
      </span>
      <button class="wh-dt-keep" data-act="kh" title="оставить высший">KH</button>
      <button class="wh-dt-keep" data-act="kl" title="оставить низший">KL</button>
      <span class="wh-dt-grp" title="модификатор броска">
        <button class="wh-dt-step" data-act="md">−</button>
        <span class="wh-dt-mod">+0</span>
        <button class="wh-dt-step" data-act="mu">+</button>
      </span>
    </div>
    <div class="wh-dt-row wh-dt-row-actions">
      <button class="wh-dt-clear" data-act="clear" title="очистить">✕ Сброс</button>
      <button class="wh-dt-roll" data-act="roll">Бросок</button>
    </div>
    </div>`;
  // Сворачивание по клику на заголовок.
  tray.querySelector(".wh-dt-head")?.addEventListener("click", () => {
    const now = tray.classList.toggle("is-collapsed");
    tray.querySelector(".wh-dt-caret").textContent = now ? "▸" : "▾";
    localStorage.setItem("wh-dice-tray-collapsed", now ? "1" : "0");
  });
  _whBindTray(tray);
  _whRenderTray(tray);
  return tray;
}
// Идемпотентный монтаж: трей должен жить ВНУТРИ панели чата в сайдбаре, над
// полем ввода. НЕ цепляемся к плавающему полю в #chat-notifications (оно висит
// над хотбаром/кнопками режима броска и перекрывает их).
function _whMountTray() {
  try {
    if (document.querySelector(".wh-dice-tray")) return;
    // Все поля ввода чата; выбираем то, что в сайдбаре и НЕ во всплывающих
    // уведомлениях (#chat-notifications висит над хотбаром и перекрывает UI).
    const tas = [...document.querySelectorAll(
      "#chat-message, textarea[name='chatmessage'], .chat-input textarea, textarea[name='content']"
    )].filter(t => !t.closest("#chat-notifications, #chat-popout"));
    const ta = tas.find(t => t.closest("#sidebar")) || tas[0];
    if (!ta) return;
    const anchor = ta.closest("#chat-form, form, .chat-input, .chat-form") || ta;
    if (!anchor.parentElement) return;
    anchor.parentElement.insertBefore(_whBuildTray(), anchor);
  } catch (e) { console.warn("warhammer-dbc | dice tray", e); }
}
Hooks.on("renderChatLog", _whMountTray);
Hooks.on("renderChatInput", _whMountTray);
Hooks.on("renderSidebarTab", _whMountTray);
Hooks.on("renderSidebar", _whMountTray);
Hooks.on("collapseSidebar", () => setTimeout(_whMountTray, 50));
Hooks.once("ready", () => setTimeout(_whMountTray, 200));

// ── Обозреватель компендиумов: кнопка в шапке вкладки «Компендиумы» ───────────
Hooks.on("renderCompendiumDirectory", (app, html) => {
  const actions = html.querySelector(".header-actions.action-buttons") || html.querySelector(".header-actions");
  if (!actions || actions.querySelector(".wh-compendium-browser-btn")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "wh-compendium-browser-btn";
  btn.innerHTML = '<i class="fa-solid fa-atlas"></i><span>Обозреватель компендиумов</span>';
  btn.addEventListener("click", ev => { ev.preventDefault(); openCompendiumBrowser(); });
  actions.appendChild(btn);
});

// ── Токен корабля: по умолчанию вписывание текстуры = «Покрытие» (cover) ──────
// Тематическая иконка для нового предмета (если стоит дефолтная Foundry).
Hooks.on("preCreateItem", (doc, data) => {
  try {
    if (!isGenericImg(doc.img)) return;
    const icon = itemIconFor(data?.type ?? doc.type, doc.system ?? {});
    if (icon) doc.updateSource({ img: icon });
  } catch (e) { /* не мешаем созданию предмета */ }
});

Hooks.on("preCreateActor", (doc, data) => {
  // По умолчанию у всех акторов: отображаемое имя «При наведении всеми»,
  // а имя токена = имени актора.
  const dm = CONST.TOKEN_DISPLAY_MODES.HOVER;
  const ptUpd = {};
  if ((doc.prototypeToken?.displayName ?? null) !== dm) ptUpd.displayName = dm;
  if (!doc.prototypeToken?.name && doc.name) ptUpd.name = doc.name;
  if (Object.keys(ptUpd).length) doc.updateSource({ prototypeToken: ptUpd });

  // Иконки по умолчанию для типов системы (вместо дефолтной mystery-man Foundry).
  const ICONS = {
    starSystem: "systems/warhammer-dbc/assets/map-icons/system.svg",
    character:  "systems/warhammer-dbc/assets/actor-icons/character.svg",
    ship:       "systems/warhammer-dbc/assets/actor-icons/ship.svg",
    horde:      "systems/warhammer-dbc/assets/actor-icons/horde.svg",
    vehicle:    "systems/warhammer-dbc/assets/actor-icons/vehicle.svg"
  };
  const icon = ICONS[data?.type];
  const isDefault = !doc.img || /mystery-man\.svg$/.test(doc.img);
  if (icon && isDefault) {
    const upd = { img: icon };
    // Текстуру токена тоже ставим, если она дефолтная.
    const tImg = doc.prototypeToken?.texture?.src;
    if (!tImg || /mystery-man\.svg$/.test(tImg)) {
      upd.prototypeToken = { texture: { src: icon } };
    }
    doc.updateSource(upd);
  }

  // Новые звёздные системы НЕ входят в протекторат (только ручное добавление).
  if (data?.type === "starSystem") {
    const upd = { "system.inProtectorate": false, "system.discovered": false };
    const defSec = game.settings.get("warhammer-dbc", "defaultSector");
    if (defSec && !doc.system.sector) upd["system.sector"] = defSec;
    doc.updateSource(upd);
  }

  if (data?.type !== "ship") return;
  doc.updateSource({
    prototypeToken: {
      texture: { fit: "cover" },
      sight:   { enabled: false },
      actorLink: false     // корабли — непривязанные токены по умолчанию
    }
  });
});

// ── Иконка/размер/цвет токена корабля по классу корпуса и отношению ──────────
// Применяется при установке корпуса (component kind=hull) и смене отношения/типа.
async function applyShipIdentity(actor) {
  if (!actor || actor.type !== "ship") return;
  if (game.users.activeGM !== game.user) return;   // применяет ровно один ГМ
  const id = computeShipIdentity(actor);
  if (!id) return;
  try {
    await actor.update({
      img: id.icon,
      "prototypeToken.texture.src":  id.icon,
      "prototypeToken.texture.tint": id.tint,
      "prototypeToken.texture.fit":  "cover",
      "prototypeToken.width":  id.width,
      "prototypeToken.height": id.height,
      "prototypeToken.disposition": id.disposition
    });
    for (const scene of game.scenes) {
      // Все токены этого корабля (в т.ч. непривязанные) — токен-поля применяются напрямую.
      const toks = scene.tokens.filter(t => t.actorId === actor.id);
      if (!toks.length) continue;
      await scene.updateEmbeddedDocuments("Token", toks.map(t => ({
        _id: t.id,
        "texture.src":  id.icon,
        "texture.tint": id.tint,
        "texture.fit":  "cover",
        width: id.width, height: id.height,
        disposition: id.disposition
      })));
    }
  } catch (e) { console.warn("Warhammer DBC | applyShipIdentity:", e); }
}

const _isHullComp = (item) => item?.type === "component" && item.system?.kind === "hull";
Hooks.on("createItem", (item) => { if (item.parent?.type === "ship" && _isHullComp(item)) applyShipIdentity(item.parent); });
Hooks.on("deleteItem", (item) => { if (item.parent?.type === "ship" && _isHullComp(item)) applyShipIdentity(item.parent); });
Hooks.on("updateItem", (item, ch) => { if (item.parent?.type === "ship" && _isHullComp(item) && ch.name !== undefined) applyShipIdentity(item.parent); });
Hooks.on("updateActor", (doc, ch) => {
  if (doc.type === "ship" && (ch.system?.shipRelation !== undefined || ch.system?.shipType !== undefined)) applyShipIdentity(doc);
});

// ── Имя актора → имя токена; арт актора → текстура токена ────────────────────
// В preUpdate дописываем изменения в прототип-токен той же операции.
Hooks.on("preUpdateActor", (doc, changes) => {
  if (typeof changes.name === "string") {
    foundry.utils.setProperty(changes, "prototypeToken.name", changes.name);
  }
  // Арт → токен для всех, кроме кораблей (у кораблей токен-иконка управляется классом корпуса).
  if (typeof changes.img === "string" && doc.type !== "ship") {
    foundry.utils.setProperty(changes, "prototypeToken.texture.src", changes.img);
  }
});

// Размещённые (привязанные) токены тоже подхватывают новое имя/арт актора.
Hooks.on("updateActor", async (doc, changes) => {
  if (!game.user.isGM) return;
  const nameChanged = typeof changes.name === "string";
  const imgChanged  = typeof changes.img === "string" && doc.type !== "ship";
  if (!nameChanged && !imgChanged) return;
  for (const scene of game.scenes) {
    const toks = scene.tokens.filter(t => t.actorId === doc.id && t.actorLink);
    if (!toks.length) continue;
    const upd = toks.map(t => {
      const u = { _id: t.id };
      if (nameChanged) u.name = changes.name;
      if (imgChanged)  u["texture.src"] = changes.img;
      return u;
    });
    try { await scene.updateEmbeddedDocuments("Token", upd); }
    catch (e) { console.warn("Warhammer DBC | sync token name/art:", e); }
  }
});

// Кэш библиотек Происхождения и Предсказаний для дропдаунов в шапке листа.
initPackCaches();

// Дерево фракций для предикатов правил: каталог лежит в компендиуме, а разбор
// цепочки предков обязан быть чистыми функциями — см. module/rules/factions.mjs.
initFactionIndex();

/** Просил ли ГМ открыть библиотеки (настройка protectCompendiumEdits выше). */
function _libsUnlocked() {
  try { return game.settings.get("warhammer-dbc", "protectCompendiumEdits") === true; }
  catch (e) { return false; }
}

// ─── Типы изменений ActiveEffect "divideUp"/"divideDown" (Конструктор эффектов) ──
// У ядра Foundry нет деления как типа change (только add/subtract/multiply/
// override/upgrade/downgrade) — а «Конструктор эффектов» (effect-builder.mjs)
// позволяет собрать «÷ с округлением вверх/вниз» без кода. Любой change.type,
// не входящий в штатный список, идёт через ActiveEffect._applyChangeCustom(),
// который по умолчанию просто вызывает хук "applyActiveEffect" — штатная точка
// расширения (client/documents/active-effect.mjs), а не патч ядра. Хук должен
// сам прочитать/записать значение через foundry.utils.get/setProperty —
// фреймворк сам сравнит "до/после" и оформит правку.
Hooks.on("applyActiveEffect", (targetDoc, change) => {
  if (change.type !== "divideUp" && change.type !== "divideDown") return;
  const divisor = Number(change.value);
  if (!divisor) return;
  const current = Number(foundry.utils.getProperty(targetDoc, change.key)) || 0;
  const raw = current / divisor;
  const rounded = change.type === "divideUp" ? Math.ceil(raw) : Math.floor(raw);
  foundry.utils.setProperty(targetDoc, change.key, rounded);
});

// ─── Миграция: system.effects.* существующих предметов → embedded ActiveEffect ──
// Сама миграция — в module/migrations/item-effects.mjs (проверяется без Foundry).
//
// Замки библиотек приводятся к настройке здесь же и строго до миграции:
// миграция снимает замок с пака и возвращает его, каким взяла, а Foundry
// соседние ready-хуки не дожидается — в разных хуках она читала бы замок
// посреди чужой правки и закрывала паки, которые ГМ просил открыть.
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  await setSystemPackLocks(!_libsUnlocked());
  // Пустой компендиум системы = база под него не собрана. Молча это выглядит
  // как «контент забыли», поэтому ГМу говорится сразу и с командой починки.
  warnEmptySystemPacks(game.packs);
  await migrateAllItemEffects();
});

/* ═══════════════ ДВУПРОФИЛЬНЫЕ ПРЕДМЕТЫ (снаряжение + оружие) ═══════════════
 * Часть снаряжения и инструментов имеет собственный боевой профиль
 * (Нартеций, Нуль Жезл, Икона Хаоса…). Он лежит отдельным предметом в
 * компендиуме оружия, а исходный предмет ссылается на него полем
 * system.linkedWeapon. Здесь эта пара живёт как одно целое: добавили один —
 * появился второй, удалили любой — ушли оба.
 *
 * Связь держится на флагах:
 *   twinId — у носителя (снаряжение/инструмент): id его боевого профиля;
 *   twinOf — у боевого профиля: id носителя.
 * Хуки, а не обработчик кнопки, — чтобы работали ВСЕ пути добавления:
 * библиотека, перетаскивание из компендиума, копирование листа.
 */
const TWIN_FLAG = "warhammer-dbc";
// id, чьё удаление мы инициировали сами: их хук должен промолчать, иначе
// пара начнёт удалять друг друга по кругу.
const _twinDeleting = new Set();

/** Ищет предмет оружия в компендиуме по точному имени. */
async function _twinLookup(name) {
  const pack = game.packs.get("warhammer-dbc.weapons");
  if (!pack) return null;
  const idx = await pack.getIndex();
  const hit = idx.find(e => e.name === name);
  return hit ? await pack.getDocument(hit._id) : null;
}

// Автоматика при получении предмета — единый Конструктор (вкладка
// «Механика», module/apps/mechanics.mjs: ± Характеристика/Черта/Талант/
// Навык/Код, группы И/ИЛИ) плюс runAutoScripts() для предметов в СТАРОМ
// плоском/массивном формате скриптов (до объединения — см. item-script.mjs),
// которые ещё могут где-то остаться. game.user.id !== userId — тот же приём,
// что и у пары боевых профилей ниже: createItem рассылается всем клиентам,
// а выполнить/применить должен только клиент того, кто реально создал
// документ (иначе выполнится у каждого).
/**
 * Раса/субраса, попавшая на актора мимо листа — макросом, скриптом,
 * копированием. Флаг originGrant ставит сам applyRace, поэтому его
 * собственная выдача сюда не возвращается и цикла не образует.
 *
 * Ключ — тем же правилом, что и кэш библиотеки (raceKeyOf: system.key или id
 * документа), а не «system.key || ''»: пустая строка на пути применения
 * означает «снять расу», и раса без заполненного ключа стирала бы персонажа
 * тем же способом, что чинит Находка C1 у дропа на лист (wdbc-n1k). Если
 * ключ не определился вовсе (документ без id — на практике не бывает, но
 * отказ явный, а не тихое снятие) — предмет всё равно убираем с актора, но
 * применение не зовём.
 */
export async function handleStrayRaceItem(item, actor) {
  const key = raceKeyOf(item);
  await item.delete();
  if (!key) {
    ui.notifications?.error(
      `Не удалось определить ключ ${item.type === "race" ? "расы" : "субрасы"} у «${item.name}» — предмет снят с актора без применения.`);
    return;
  }
  if (item.type === "race") await applyRace(actor, key);
  else await applySubrace(actor, key);
}

/**
 * Основной обработчик создания предмета — вынесен в именованную функцию,
 * чтобы ветку SKIP_MECHANICS_HOOK можно было проверить тестом напрямую:
 * Hooks.on в тестовом стенде — пустышка (foundry-stub.mjs), сама подписка
 * не срабатывает никогда.
 */
export async function handleItemCreated(item, options, userId) {
  if (game.user.id !== userId) return;
  const actor = item.parent;
  if (!(actor instanceof Actor)) return;

  // Свой clientId-фильтр выше уже не даёт каждому подключённому клиенту
  // повторить удаление и применение самому.
  if (["race", "subrace"].includes(item.type) && !item.getFlag("warhammer-dbc", "originGrant")) {
    return handleStrayRaceItem(item, actor);
  }

  await runAutoScripts(item);
  // Носитель расы/субрасы (originGrant стоит — страховка выше его не трогает)
  // уже получил свою Механику СИНХРОННО внутри applyRace/applySubrace
  // (module/apps/races.mjs) — опция SKIP_MECHANICS_HOOK в контексте создания
  // говорит этому хуку не применять её ещё раз.
  //
  // Идемпотентность applyItemMechanics (флаг mechanicsApplied) здесь НЕ
  // спасает, хотя раньше в комментарии на этом месте было обратное
  // утверждение — оно было ошибкой, которую поймало ревью. appliedEntryIds
  // читает флаг в САМОМ НАЧАЛЕ applyItemMechanics, а пишется он в конце.
  // Прямой вызов из applyRace и этот вызов из хука — два НЕЗАВИСИМЫХ старта:
  // если прямой вызов успевает уйти в реальные createEmbeddedDocuments по
  // каждой выдаваемой Черте (сетевые round-trip'ы в живом Foundry) дольше,
  // чем этот хук доходит до своего applyItemMechanics, оба читают один и тот
  // же ПУСТОЙ флаг и оба выдают Черты целиком — Астартес получил бы их
  // дважды. Раньше это не ловилось тестами: Hooks.on в стенде — пустышка,
  // поэтому в тестах отрабатывал только прямой вызов, и «зелёный» прогон
  // ничего про эту гонку не доказывал.
  if (options?.[SKIP_MECHANICS_HOOK]) return;
  await applyItemMechanics(item);
}

Hooks.on("createItem", handleItemCreated);

// Механику правят и на предмете, который УЖЕ лежит у актора: Черта из
// библиотеки приезжает пикером пустой, и настраивают её прямо на листе. Это
// ЕДИНСТВЕННАЯ точка, реагирующая на правку Механики, — лист предмета сам
// пересборку не зовёт: ядро зовёт хук синхронно, ещё до того как setFlag на
// листе вернёт управление, и два прогона успели бы завести по эффекту на одну
// запись.
//
// У предмета на акторе идёт полное применение: долговечные записи
// пересобираются, РАЗОВЫЕ (Порча, Раны, выдача Черты/снаряжения, Код)
// отыгрываются по одной, каждая свой первый раз. Предмету в списке мира актора
// нет — там только пересборка эффектов, чтобы вкладка «Эффекты» показывала то,
// что настроено, ещё до броска на лист.
//
// Условие — именно `!== undefined`, а не проверка на правду: снятие последней
// группы приходит как mechanics: [] и обязано дойти до пересборки, а не быть
// принятым за «механику не трогали». Собственные записи Конструктора
// (mechanicsApplied, rollMods, system.effects от weaponProp) ключа mechanics не
// несут и сюда не возвращаются — рекурсии нет.
Hooks.on("updateItem", async (item, changed, options, userId) => {
  if (game.user.id !== userId) return;
  if (changed?.flags?.["warhammer-dbc"]?.mechanics === undefined) return;
  if (item.parent instanceof Actor) await applyItemMechanics(item);
  else await syncMechanicsEffects(item);
});

// Откат перманентных правок характеристик/пулов, выданных шаблонами старого
// компендиума warhammer-dbc.script-library («± Значение характеристики»,
// «± Бонус характеристики», «± Очки пула») при снятии предмета с актора.
// Компендиум удалён (заменён Конструктором), но у уже выданных предметов на
// акторах эти флаги/эффекты остаются — хук держим ради обратной
// совместимости с тем, что уже роздано на живых мирах.
// {charValueApplied,charBonusApplied,poolApplied} = {stat|pool, amount} —
// не просто true именно затем, чтобы здесь было что откатывать без
// повторного разбора текста скрипта. Статус и ситуативный модификатор
// отката так и не имели.
//
// Плюс — откат Черты/Таланта, выданных записью kind:"trait"/"talent"
// Конструктора (module/apps/mechanics.mjs): при создании выданный предмет
// получает flags.warhammer-dbc.grantedByItem = <id предмета-источника>;
// здесь при удалении источника ищем на акторе всё, что он выдал, и удаляем.
Hooks.on("deleteItem", async (item, options, userId) => {
  if (game.user.id !== userId) return;
  const actor = item.parent;
  if (!(actor instanceof Actor)) return;

  const valueApplied = item.getFlag("warhammer-dbc", "charValueApplied");
  if (valueApplied?.stat && valueApplied.amount) {
    const cur = actor.system.characteristics[valueApplied.stat]?.advance || 0;
    await actor.update({ [`system.characteristics.${valueApplied.stat}.advance`]: cur - valueApplied.amount });
  }

  const bonusApplied = item.getFlag("warhammer-dbc", "charBonusApplied");
  if (bonusApplied?.stat && bonusApplied.amount) {
    const cur = actor.system.characteristics[bonusApplied.stat]?.supernatural || 0;
    await actor.update({ [`system.characteristics.${bonusApplied.stat}.supernatural`]: cur - bonusApplied.amount });
  }

  const poolApplied = item.getFlag("warhammer-dbc", "poolApplied");
  if (poolApplied?.pool && poolApplied.amount) {
    const cur = actor.system[poolApplied.pool]?.value || 0;
    await actor.update({ [`system.${poolApplied.pool}.value`]: cur - poolApplied.amount });
  }

  // {amount} — kind:"wounds" Конструктора (module/apps/mechanics.mjs): разовая
  // правка system.wounds.max, откат симметричен poolApplied выше.
  const woundsApplied = item.getFlag("warhammer-dbc", "woundsApplied");
  if (woundsApplied?.amount) {
    const cur = Number(actor.system.wounds?.max) || 0;
    await actor.update({ "system.wounds.max": Math.max(0, cur - woundsApplied.amount) });
  }

  // {squadUuid, amount} — kind:"cohesion" Конструктора: правка НЕ у этого
  // актора, а у отряда, в котором он состоял на момент применения. reconcile
  // здесь не подходит — предмет через миг исчезнет, а его записи kind:
  // "cohesion" — единственный источник знания, к какому отряду и на сколько
  // приложено.
  const cohesionApplied = item.getFlag("warhammer-dbc", "cohesionApplied");
  if (cohesionApplied?.squadUuid && cohesionApplied.amount) {
    const squad = await fromUuid(cohesionApplied.squadUuid).catch(() => null);
    if (squad) {
      const cur = Number(squad.system.cohesion?.base) || 0;
      await squad.update({ "system.cohesion.base": cur - cohesionApplied.amount });
    }
  }

  const granted = actor.items.filter(i => i.getFlag("warhammer-dbc", "grantedByItem") === item.id);
  if (granted.length) await actor.deleteEmbeddedDocuments("Item", granted.map(i => i.id));
});

// ── Слаженность отряда (kind:"cohesion" Конструктора) — реагирует на вход/
// выход/смену поста ─────────────────────────────────────────────────────
// Состав (system.members) и посты (system.posts) отряда меняются на ЛИСТЕ
// САМОГО ОТРЯДА, а не через предмет на персонаже — значит, createItem/
// deleteItem-хуки этого не увидят. Ловим здесь: preUpdateActor снимает
// снимок ДО изменения (только для type:"squad" и только когда трогают
// members/posts — иначе снимка нет, и updateActor ниже сразу выходит,
// в т.ч. предохраняет от зацикливания на собственных cohesion.base-правках
// reconcileCohesionForActor() ниже, которые members/posts не трогают).
// Пересчитываем ВСЕХ, кто был затронут — и старый состав/посты, и новый:
// один и тот же путь для входа, выхода и смены поста без поста.
// Массив, не Set: options проходит через сокет (сериализация в JSON и
// обратно) между preUpdate и update для персистентных апдейтов — Set
// после такого round-trip превращается в "{}" и ловит "not iterable".
function _squadMemberUuids(system) {
  return [...new Set([
    ...(system?.members || []).map(m => m.uuid),
    system?.posts?.leader?.uuid, system?.posts?.commander?.uuid, system?.posts?.coordinator?.uuid
  ].filter(Boolean))];
}
Hooks.on("preUpdateActor", (doc, changes, options) => {
  if (doc.type !== "squad") return;
  if (!("members" in (changes.system || {})) && !("posts" in (changes.system || {}))) return;
  options._cohesionOldUuids = _squadMemberUuids(doc.system);
});
Hooks.on("updateActor", async (doc, changes, options, userId) => {
  if (doc.type !== "squad") return;
  if (game.user.id !== userId) return;
  const oldUuids = options._cohesionOldUuids;
  if (!Array.isArray(oldUuids)) return;
  const affected = new Set([...oldUuids, ..._squadMemberUuids(doc.system)]);
  for (const uuid of affected) {
    const found = await fromUuid(uuid).catch(() => null);
    const a = found?.actor ?? found; // на случай, если uuid указывал на Token
    if (a instanceof Actor) await reconcileCohesionForActor(a);
  }
});

// ── «Пламенная вера» (Мир-храм): шанс не потратить Очко ──────────────────────
// Ловим ЛЮБОЕ уменьшение system.fate.value одним хуком, а не правим каждое из
// мест списания (лист, hooks.mjs, Боль/Душа): так правило достанет и то место
// траты, которое появится завтра. Счётная часть — rules/fate-save.mjs.
//
// Прежнее значение снимается в preUpdateActor: updateActor видит уже новое.
Hooks.on("preUpdateActor", (doc, changes, options) => {
  if (typeof changes.system?.fate?.value === "number") {
    options.whFatePrev = doc.system.fate?.value ?? 0;
  }
});

Hooks.on("updateActor", async (doc, changes, options, userId) => {
  // Только у того клиента, кто сделал правку, иначе бросок случится у каждого.
  if (game.user.id !== userId) return;
  // Наш собственный возврат и осознанная цена способности («Вера в прошлое»)
  // сюда не заходят: иначе зацикливание и бесплатные чудеса.
  if (options?.whSkipFateSave) return;
  if (typeof changes.system?.fate?.value !== "number") return;
  const spent = fateSpent(options?.whFatePrev, changes.system.fate.value);
  if (!spent || !hasRuleFlag(doc, FATE_SAVE_FLAG)) return;

  const rolls = [];
  for (let i = 0; i < spent; i++) {
    rolls.push((await new Roll(FATE_SAVE_DIE).evaluate()).total);
  }
  const saved = fateSaved(rolls);
  if (!saved) return;

  await doc.update({ "system.fate.value": (doc.system.fate?.value ?? 0) + saved },
    { whSkipFateSave: true });
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: doc }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">🔥 Пламенная вера — ${doc.name}</div>
      <div class="roll-dice">${FATE_SAVE_DIE}: <b>${rolls.join(", ")}</b></div>
      <div class="roll-outcome"><span class="roll-success">Очко ${fatePoolLabel(doc)} не потрачено${saved > 1 ? ` (×${saved})` : ""}</span></div>
    </div>`
  }, game.settings.get("core", "rollMode")));
});

Hooks.on("createItem", async (item, options, userId) => {
  if (game.user.id !== userId) return;
  const actor = item.parent;
  if (!(actor instanceof Actor)) return;
  // Ссылка живёт на самом предмете. Раньше рядом стояла запасная дорожка —
  // поиск по имени в библиотеках констант, на случай компендиума, засеянного
  // до появления поля. Поле теперь есть у всех носителей в packs-src
  // (wdbc-ff4.8), и запасная дорожка снята вместе с тремя импортами.
  const link = item.system?.linkedWeapon;
  if (!link) return;
  // Сам боевой профиль второго профиля не порождает.
  if (item.getFlag(TWIN_FLAG, "twinOf")) return;
  // Уже есть пара (перетащили лист целиком / повторный хук) — не плодим.
  if (actor.items.some(i => i.getFlag(TWIN_FLAG, "twinOf") === item.id)) return;
  if (actor.items.some(i => i.name === link && i.id !== item.id)) return;

  const doc = await _twinLookup(link);
  if (!doc) {
    return ui.notifications?.warn(
      `«${item.name}»: боевой профиль «${link}» не найден в компендиуме оружия.`);
  }
  const obj = doc.toObject();
  delete obj._id;
  foundry.utils.setProperty(obj, `flags.${TWIN_FLAG}.twinOf`, item.id);
  const [made] = await actor.createEmbeddedDocuments("Item", [obj]);
  if (made) await item.setFlag(TWIN_FLAG, "twinId", made.id);
});

Hooks.on("deleteItem", async (item, options, userId) => {
  if (game.user.id !== userId) return;
  const actor = item.parent;
  if (!(actor instanceof Actor)) return;
  // Это удаление затеяли мы сами — второй раз по кругу не идём.
  if (_twinDeleting.delete(item.id)) return;
  const partnerId = item.getFlag(TWIN_FLAG, "twinId")
                 || item.getFlag(TWIN_FLAG, "twinOf");
  if (!partnerId) return;
  const partner = actor.items.get(partnerId);
  if (!partner) return;
  _twinDeleting.add(partnerId);
  try {
    await actor.deleteEmbeddedDocuments("Item", [partnerId]);
  } catch (err) {
    _twinDeleting.delete(partnerId);
    console.error("Warhammer DBC | не удалось удалить парный предмет", err);
  }
});

/* ═══════════════════════ ИНТЕГРАЛЬНЫЕ АТАКИ ═══════════════════════════════
 * Оружие с флагом warhammer-dbc.integralAttack — это не снаряжение, а часть
 * тела или машины: Кислотный Плевок Железы Бетчера, Пинок Дредноута. Его
 * нельзя ни снять, ни выбросить, пока источник на месте и работает.
 *
 * Два происхождения, и правило для них одно:
 *   • выдано записью kind:"integralAttack" Конструктора — на оружии стоит
 *     grantedByItem, и оно живёт ровно пока источник активен (isItemActive:
 *     имплант — installed и не disabled). Снятие источника убирает атаку само
 *     — через syncGrantedEquipment и общий откат deleteItem выше;
 *   • вложено в актора инлайн, источника-предмета нет вовсе (Пинок в шасси
 *     Дредноута). Такую атаку убирает только ГМ — правкой самого шасси.
 *
 * Почему хуки, а не блокировка кнопок на листе: удаление идёт через
 * item.delete() из контекстного меню (sheets/context-menu.mjs), снятие — через
 * equipItem() (sheets/tabs/gear.mjs), и есть ещё макросы и перетаскивание.
 * Хук закрывает все пути разом, как и у пары боевых профилей выше.
 */
const INTEGRAL_FLAG = "integralAttack";

/**
 * Защищена ли эта интегральная атака прямо сейчас.
 * Источник уже удалён или выключен — не защищена: именно так её и убирают
 * штатные откаты, и мешать им нельзя, иначе снятый имплант оставит за собой
 * неудаляемое оружие.
 */
function _integralProtected(item) {
  if (!item.getFlag("warhammer-dbc", INTEGRAL_FLAG)) return false;
  const actor = item.parent;
  if (!(actor instanceof Actor)) return false;
  const sourceId = item.getFlag("warhammer-dbc", "grantedByItem");
  if (!sourceId) return !game.user.isGM;   // инлайн в шасси — только ГМ вправе
  const source = actor.items.get(sourceId);
  if (!source) return false;               // источник ушёл — идёт штатный откат
  return isItemActive(source);
}

Hooks.on("preDeleteItem", (item) => {
  if (!_integralProtected(item)) return true;
  ui.notifications?.warn(
    `«${item.name}» — интегральная атака: она есть, пока работает то, что её даёт. Убрать можно только источник.`);
  return false;
});

Hooks.on("preUpdateItem", (item, changed) => {
  // Ловим только попытку СНЯТЬ: надеть её обратно никто не мешает, а прочие
  // правки оружия (боезапас, модификации, переименование) не запрещены вовсе.
  if (changed?.system?.equipped !== false) return true;
  if (!_integralProtected(item)) return true;
  ui.notifications?.warn(`«${item.name}» — интегральная атака: снять её нельзя.`);
  return false;
});
