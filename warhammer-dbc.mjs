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
         MELEE_TECHNIQUES }           from "./module/constants/combat.mjs";
import { ITEM_TYPES, WEAPON_CLASSES,
         DAMAGE_TYPES, GEAR_CATEGORIES, TOOL_CATEGORIES,
         AVAILABILITY }               from "./module/constants/items.mjs";
import { AMMO_CATEGORIES }            from "./module/constants/ammo.mjs";
import { WEAPON_PROPERTIES }          from "./module/constants/weapon-properties.mjs";

import { WarhammerActor }             from "./module/documents/actor.mjs";
import { WarhammerItem }              from "./module/documents/item.mjs";

import { WarhammerCharacterSheet }    from "./module/sheets/actor-sheet.mjs";
import { WarhammerShipSheet }         from "./module/sheets/ship-sheet.mjs";
import { WarhammerStarSystemSheet }   from "./module/sheets/star-system-sheet.mjs";
import { WarhammerHordeSheet }        from "./module/sheets/horde-sheet.mjs";
import { WarhammerVehicleSheet }      from "./module/sheets/vehicle-sheet.mjs";
import { WarhammerDaemonSheet }       from "./module/sheets/daemon-sheet.mjs";
import { WarhammerDemonPrinceSheet }  from "./module/sheets/demon-prince-sheet.mjs";
import { WarhammerSquadSheet }        from "./module/sheets/squad-sheet.mjs";
import { WarhammerFormationSheet }    from "./module/sheets/formation-sheet.mjs";
import { WarhammerItemSheet }         from "./module/sheets/item-sheet.mjs";
import { WarhammerActiveEffectConfig } from "./module/sheets/active-effect-config.mjs";
import { refreshCalendarWidget, initTimeFlow } from "./module/apps/imperial-calendar.mjs";
import { showFateTurnBanner } from "./module/apps/game-session.mjs";
import { runAutoScripts }             from "./module/apps/item-script.mjs";
import { applyItemMechanics, reconcileCohesionForActor, initEquipmentIndex } from "./module/apps/mechanics.mjs";
import { openCompendiumBrowser } from "./module/apps/compendium-browser.mjs";
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

import { registerFeatureSettings, registerSettingsSections,
         isFeatureEnabled }           from "./module/constants/features.mjs";
import { fillHomeworldPack }          from "./module/apps/homeworlds.mjs";
import { fillDivinationPack }         from "./module/apps/divinations.mjs";
import { initPackCaches }             from "./module/apps/origin-shared.mjs";
import { fillBookPacks, importBooks }  from "./module/apps/books.mjs";
import { registerHandlebarsHelpers }  from "./module/helpers/handlebars.mjs";
import { registerHooks }              from "./module/hooks.mjs";
import { showApplyDamageDialog }      from "./module/combat/damage.mjs";
import { CHEMISTRY_LIBRARY }          from "./module/constants/chemistry-library.mjs";
import { GEAR_LIBRARY }               from "./module/constants/gear-library.mjs";
import { TOOLS_LIBRARY }              from "./module/constants/tools-library.mjs";
import { TRAIT_LIBRARY, BEASTMAN_RACE_TRAITS, VOID_TRAIT_LIBRARY } from "./module/constants/traits-library.mjs";
import { TALENT_LIBRARY }             from "./module/constants/talents-library.mjs";
import { hasLegacyEffects, legacyEffectsToChanges } from "./module/constants/effect-keys.mjs";
import { POSSESSION_LIBRARY }         from "./module/constants/possession.mjs";
import { MUTATION_LIBRARY, GOD_GIFT_LIBRARY } from "./module/constants/mutations.mjs";
import { ELITE_TRAITS_LIBRARY, ELITE_TALENTS_LIBRARY } from "./module/constants/elite-archetypes.mjs";
import { DISEASE_LIBRARY }            from "./module/constants/diseases.mjs";
import { POWER_ARMOUR_SYSTEMS }       from "./module/constants/power-armour-systems.mjs";
import { ARMOR_MODS_LIBRARY }         from "./module/constants/armor-mods-library.mjs";
import { WEAPON_MODS_LIBRARY }        from "./module/constants/weapon-mods-library.mjs";
import { weaponPropertyLibrary }      from "./module/constants/weapon-properties-library.mjs";
import { armourHistoryLibrary }       from "./module/constants/armour-history-library.mjs";
import { aspirationLibrary }          from "./module/constants/aspirations.mjs";
import { archetypeLibrary }           from "./module/constants/archetypes.mjs";
import { IMPLANT_LIBRARY }            from "./module/constants/implants.mjs";
import { AELDARI_WEAPONS, MECHADENDRITE_WEAPONS } from "./module/constants/aeldari-weapons.mjs";
import { PSYCHIC_POWERS_LIBRARY }     from "./module/constants/psychic-powers-library.mjs";
import { TECH_POWERS_LIBRARY }        from "./module/constants/tech-powers-library.mjs";
import { AMMO_LIBRARY }               from "./module/constants/ammo-library.mjs";
import { itemIconFor, isGenericImg, isManagedImg } from "./module/constants/item-icons.mjs";
import { AELDARI_ARMOR }              from "./module/constants/aeldari-armor.mjs";
import { SHIELD_COMPENDIUM, ELDAR_SHIELDS,
         SHIELD_NATURES }             from "./module/constants/shields.mjs";
import { SHIP_COMPONENTS, SHIP_EQUIPMENT } from "./module/constants/ship-components.mjs";
import { VEHICLE_EQUIPMENT }          from "./module/constants/vehicle-equipment.mjs";
import { VEHICLE_TRAITS }             from "./module/constants/vehicle-traits.mjs";
import { VEHICLE_WEAPONS }            from "./module/constants/vehicle-weapons-library.mjs";
import { VEHICLE_LIBRARY }            from "./module/constants/vehicle-library.mjs";
import { computeShipIdentity }        from "./module/constants/ship-tokens.mjs";
import { SMALL_CRAFT }                from "./module/constants/small-craft.mjs";
import { BESTIARY_LIBRARY }           from "./module/constants/bestiary-library.mjs";

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
    "systems/warhammer-dbc/templates/apps/nexus-card.hbs",
    "systems/warhammer-dbc/templates/actor/parts/infamy-strip.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-stats.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-combat.hbs",
    "systems/warhammer-dbc/templates/actor/parts/tab-abilities.hbs",
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
    "systems/warhammer-dbc/templates/item/parts/shield.hbs",
    "systems/warhammer-dbc/templates/item/parts/drug.hbs",          // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/trait.hbs",         // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/psychic-power.hbs", // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/implant.hbs",       // ← НОВОЕ
    "systems/warhammer-dbc/templates/item/parts/tech-power.hbs",    // ← НОВОЕ
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

  CONFIG.Combat.initiative = {
    formula: "1d10 + @initiative + @initiativeMod",
    decimals: 0
  };

  CONFIG.WARHAMMER = {
    RACES, SUBRACES, CHARACTERISTICS, IMPROVEMENTS,
    IMPROVEMENT_BONUS, SKILL_RANKS, SKILLS_DEF, GROUP_SKILLS_DEF,
    ITEM_TYPES, WEAPON_CLASSES, DAMAGE_TYPES, AVAILABILITY,
    HIT_LOCATIONS, MELEE_TECHNIQUES, MELEE_STANCES,
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

  // Ручное редактирование библиотек: разблокировать все компендиумы системы
  // и не давать заполнению компендиумов (_fillModLibrary/_fillEffectLibrary)
  // при следующих запусках переписывать уже существующие записи обратно на
  // то, что задано в коде. Новые записи из обновлений системы по-прежнему
  // добавляются — правится только «не трогать то, что уже руками поправлено».
  game.settings.register("warhammer-dbc", "protectCompendiumEdits", {
    name: "Защита правок в библиотеках",
    hint: "Включите перед тем, как редактировать компендиумы системы (Таланты, "
      + "Черты, Импланты, Эффекты и т.д.) вручную. Разблокирует все компендиумы "
      + "системы и не даёт следующему запуску Foundry переписать ваши правки в "
      + "уже существующих записях обратно на то, что в коде системы — новые "
      + "записи из обновлений по-прежнему будут добавляться, старые больше не трогаются.",
    scope: "world", config: true, type: Boolean, default: false,
    onChange: async (on) => { if (on && game.user.isGM) await _unlockAllSystemPacks(); }
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
  game.warhammerDBC = foundry.utils.mergeObject(game.warhammerDBC || {}, { importBooks, openSystemsOverview, openCraftWorkshop, openCogitatorManager, openTarotReader, openRigManager, openSurgeon, openVeilMystic, veilShift, openSceneNexus, openEnvironment, migrateWeaponGrips });
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

// Органы Геносемени Астартес (system.category "geneseed") — не хирургическая
// операция, а часть тела космодесантника: откуда бы орган ни появился на
// акторе (автовыдача при создании персонажа, перетаскивание из компендиума
// «Импланты», ручное добавление GM'ом), он сразу считается вживлённым и
// попадает на био-скан вкладки ТЕЛО, а не только когда выдан через
// _grantAstartesImplants.
Hooks.on("preCreateItem", (doc, data) => {
  try {
    if ((data?.type ?? doc.type) !== "implant") return;
    if ((data?.system?.category ?? doc.system?.category) !== "geneseed") return;
    if (doc.getFlag("warhammer-dbc", "installed")) return;
    doc.updateSource({
      "flags.warhammer-dbc.installed": true,
      "flags.warhammer-dbc.geneSeed": true
    });
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

// ─── Автозаполнение библиотеки химии ────────────────────────────────────────
// При первом запуске система наполняет компендиум "chemistry" предметами из
// CHEMISTRY_LIBRARY. Дальше они доступны через Drag-and-drop в лист персонажа.
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  const pack = game.packs.get("warhammer-dbc.chemistry");
  if (!pack) {
    console.warn("Warhammer DBC | Компендиум 'chemistry' не найден.");
    return;
  }

  // Разблокируем пак на случай, если он locked
  if (pack.locked) await pack.configure({ locked: false });

  // Папки категорий внутри компендиума
  const FOLDER_MAP = {
    medicine: "Медикаменты",
    narcotic: "Наркотики",
    elixir:   "Эликсиры",
    poison:   "Яды"
  };

  try {
    // 1) Гарантируем наличие папок категорий (не трогаем существующие)
    const folderByName = {};
    for (const f of (pack.folders?.contents ?? [])) folderByName[f.name] = f.id;
    const missing = Object.values(FOLDER_MAP).filter(n => !folderByName[n]);
    if (missing.length) {
      const created = await Folder.createDocuments(
        missing.map(name => ({ name, type: "Item", sorting: "m" })),
        { pack: pack.collection }
      );
      for (const f of created) folderByName[f.name] = f.id;
    }

    // 2) Раскладываем по папкам ранее созданные предметы без папки
    const libByName = new Map(CHEMISTRY_LIBRARY.map(d => [d.name, d]));
    const docs = await pack.getDocuments();
    const folderFixes = [];
    for (const doc of docs) {
      if (doc.folder) continue;
      const lib = libByName.get(doc.name);
      if (!lib) continue;
      const fid = folderByName[FOLDER_MAP[lib.system?.drugCategory] ?? "Медикаменты"];
      if (fid) folderFixes.push({ _id: doc.id, folder: fid });
    }
    if (folderFixes.length) await Item.updateDocuments(folderFixes, { pack: pack.collection });

    // 3) Добавляем только недостающие предметы (по имени) — неразрушающе
    const index         = await pack.getIndex();
    const existingNames = new Set(index.map(e => e.name));
    const toAdd = CHEMISTRY_LIBRARY
      .filter(d => !existingNames.has(d.name))
      .map(d => ({
        ...d,
        folder: folderByName[FOLDER_MAP[d.system?.drugCategory] ?? "Медикаменты"] ?? null
      }));

    if (toAdd.length) {
      await Item.createDocuments(toAdd, { pack: pack.collection });
      console.log(`Warhammer DBC | Библиотека химии: добавлено ${toAdd.length} предм.`);
      ui.notifications?.info(`Warhammer DBC: в библиотеку химии добавлено ${toAdd.length} предметов.`);
    }
  } catch(e) {
    console.error("Warhammer DBC | Не удалось заполнить библиотеку химии:", e);
  }
});

// ─── Автозаполнение библиотеки Снаряжения ───────────────────────────────────
// При первом запуске наполняет компендиум "gear" из GEAR_LIBRARY и раскладывает
// по папкам категорий (по system.gearCategory). Неразрушающе (по имени).
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  const pack = game.packs.get("warhammer-dbc.gear");
  if (!pack) {
    console.warn("Warhammer DBC | Компендиум 'gear' не найден.");
    return;
  }
  if (pack.locked) await pack.configure({ locked: false });

  const FOLDER_MAP = { ...GEAR_CATEGORIES }; // key → RU имя папки

  try {
    // 1) Папки категорий
    const folderByName = {};
    for (const f of (pack.folders?.contents ?? [])) folderByName[f.name] = f.id;
    const missing = Object.values(FOLDER_MAP).filter(n => !folderByName[n]);
    if (missing.length) {
      const created = await Folder.createDocuments(
        missing.map(name => ({ name, type: "Item", sorting: "m" })),
        { pack: pack.collection }
      );
      for (const f of created) folderByName[f.name] = f.id;
    }

    const folderIdFor = (cat) => folderByName[FOLDER_MAP[cat] ?? GEAR_CATEGORIES.misc] ?? null;

    // 2) Раскладываем ранее созданные предметы без папки
    const libByName = new Map(GEAR_LIBRARY.map(d => [d.name, d]));
    const docs = await pack.getDocuments();
    const folderFixes = [];
    for (const doc of docs) {
      if (doc.folder) continue;
      const lib = libByName.get(doc.name);
      if (!lib) continue;
      const fid = folderIdFor(lib.system?.gearCategory);
      if (fid) folderFixes.push({ _id: doc.id, folder: fid });
    }
    if (folderFixes.length) await Item.updateDocuments(folderFixes, { pack: pack.collection });

    // 3) Добавляем недостающие
    const index         = await pack.getIndex();
    const existingNames = new Set(index.map(e => e.name));
    const toAdd = GEAR_LIBRARY
      .filter(d => !existingNames.has(d.name))
      .map(d => ({ ...d, folder: folderIdFor(d.system?.gearCategory) }));

    if (toAdd.length) {
      await Item.createDocuments(toAdd, { pack: pack.collection });
      console.log(`Warhammer DBC | Библиотека снаряжения: добавлено ${toAdd.length} предм.`);
      ui.notifications?.info(`Warhammer DBC: в библиотеку снаряжения добавлено ${toAdd.length} предметов.`);
    }

    // 4) Синхронизация уже засеянных предметов с библиотекой: без неё правки
    //    (в т.ч. ссылка на боевой профиль) остаются в коде и не доезжают.
    //    Пропускается при защите правок (protectCompendiumEdits) — недостающие
    //    выше всё равно добавляются, существующее руками отредактированное — нет.
    if (!_editsProtected()) {
      const fresh   = await pack.getDocuments();
      const updates = [];
      for (const doc of fresh) {
        const lib = libByName.get(doc.name);
        if (!lib) continue;
        const cur = doc.system || {}, want = lib.system || {};
        const patch = {};
        for (const k of GEAR_SYNC_KEYS) {
          if (want[k] === undefined) continue;
          if (cur[k] !== want[k]) patch[`system.${k}`] = want[k];
        }
        if (Object.keys(patch).length) updates.push({ _id: doc.id, ...patch });
      }
      if (updates.length) {
        await Item.updateDocuments(updates, { pack: pack.collection });
        console.log(`Warhammer DBC | Библиотека снаряжения: обновлено ${updates.length}.`);
      }
    }
  } catch (e) {
    console.error("Warhammer DBC | Не удалось заполнить библиотеку снаряжения:", e);
  }
});

// ─── Автозаполнение библиотеки Инструментов ─────────────────────────────────
// При первом запуске наполняет компендиум "tools" из TOOLS_LIBRARY и раскладывает
// по папкам категорий (по system.toolCategory). Неразрушающе (по имени).
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  const pack = game.packs.get("warhammer-dbc.tools");
  if (!pack) {
    console.warn("Warhammer DBC | Компендиум 'tools' не найден.");
    return;
  }
  if (pack.locked) await pack.configure({ locked: false });

  const FOLDER_MAP = { ...TOOL_CATEGORIES }; // key → RU имя папки

  try {
    // 1) Папки категорий
    const folderByName = {};
    for (const f of (pack.folders?.contents ?? [])) folderByName[f.name] = f.id;
    const missing = Object.values(FOLDER_MAP).filter(n => !folderByName[n]);
    if (missing.length) {
      const created = await Folder.createDocuments(
        missing.map(name => ({ name, type: "Item", sorting: "m" })),
        { pack: pack.collection }
      );
      for (const f of created) folderByName[f.name] = f.id;
    }

    const folderIdFor = (cat) => folderByName[FOLDER_MAP[cat] ?? TOOL_CATEGORIES.general] ?? null;

    // 2) Раскладываем ранее созданные предметы без папки
    const libByName = new Map(TOOLS_LIBRARY.map(d => [d.name, d]));
    const docs = await pack.getDocuments();
    const folderFixes = [];
    for (const doc of docs) {
      if (doc.folder) continue;
      const lib = libByName.get(doc.name);
      if (!lib) continue;
      const fid = folderIdFor(lib.system?.toolCategory);
      if (fid) folderFixes.push({ _id: doc.id, folder: fid });
    }
    if (folderFixes.length) await Item.updateDocuments(folderFixes, { pack: pack.collection });

    // 3) Добавляем недостающие
    const index         = await pack.getIndex();
    const existingNames = new Set(index.map(e => e.name));
    const toAdd = TOOLS_LIBRARY
      .filter(d => !existingNames.has(d.name))
      .map(d => ({ ...d, folder: folderIdFor(d.system?.toolCategory) }));

    if (toAdd.length) {
      await Item.createDocuments(toAdd, { pack: pack.collection });
      console.log(`Warhammer DBC | Библиотека инструментов: добавлено ${toAdd.length} предм.`);
      ui.notifications?.info(`Warhammer DBC: в библиотеку инструментов добавлено ${toAdd.length} предметов.`);
    }

    // 4) Синхронизация уже засеянных предметов с библиотекой: без неё правки
    //    (в т.ч. ссылка на боевой профиль) остаются в коде и не доезжают.
    //    Пропускается при защите правок (protectCompendiumEdits).
    if (!_editsProtected()) {
      const fresh   = await pack.getDocuments();
      const updates = [];
      for (const doc of fresh) {
        const lib = libByName.get(doc.name);
        if (!lib) continue;
        const cur = doc.system || {}, want = lib.system || {};
        const patch = {};
        for (const k of GEAR_SYNC_KEYS) {
          if (want[k] === undefined) continue;
          if (cur[k] !== want[k]) patch[`system.${k}`] = want[k];
        }
        if (Object.keys(patch).length) updates.push({ _id: doc.id, ...patch });
      }
      if (updates.length) {
        await Item.updateDocuments(updates, { pack: pack.collection });
        console.log(`Warhammer DBC | Библиотека инструментов: обновлено ${updates.length}.`);
      }
    }
  } catch (e) {
    console.error("Warhammer DBC | Не удалось заполнить библиотеку инструментов:", e);
  }
});

// ─── Автозаполнение библиотеки Черт (трейтов) ───────────────────────────────
// Плоский пак без папок; неразрушающе добавляет недостающие по имени.
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  const pack = game.packs.get("warhammer-dbc.traits");
  if (!pack) {
    console.warn("Warhammer DBC | Компендиум 'traits' не найден.");
    return;
  }
  if (pack.locked) await pack.configure({ locked: false });

  try {
    const index    = await pack.getIndex();
    const existing  = new Set(index.map(e => e.name));
    const toAdd = TRAIT_LIBRARY.filter(d => !existing.has(d.name));
    if (toAdd.length) {
      await Item.createDocuments(toAdd, { pack: pack.collection });
      console.log(`Warhammer DBC | Библиотека черт: добавлено ${toAdd.length} предм.`);
      ui.notifications?.info(`Warhammer DBC: в библиотеку черт добавлено ${toAdd.length}.`);
    }
  } catch(e) {
    console.error("Warhammer DBC | Не удалось заполнить библиотеку черт:", e);
  }
});

// ─── Автозаполнение библиотеки Родных миров ────────────────────────────────
// Миры (type: homeworld) и их Особенности (type: trait) — одним компендиумом.
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  if (!isFeatureEnabled("homeworlds")) return;
  await fillHomeworldPack();
});

// ─── Автозаполнение библиотеки Предсказаний ────────────────────────────────
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  if (!isFeatureEnabled("divinations")) return;
  await fillDivinationPack();
});

// Кэш библиотек Происхождения и Предсказаний для дропдаунов в шапке листа.
initPackCaches();

// ─── Импорт книг в компендиумы Journal Entries ─────────────────────────────
// Заполняем только пустые паки и только после того, как предметные библиотеки
// уже созданы: иначе ссылкам @UUID не на что указывать.
Hooks.once("ready", () => {
  if (!game.user.isGM) return;
  // fillBookPacks сам дожидается наполнения предметных библиотек.
  fillBookPacks().catch(e => console.error("Warhammer DBC | Импорт книг:", e));
});

// ─── Расовые Черты субрас Зверолюдов (вложенная папка «Трейты рас → Зверолюды») ─
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  await _fillModLibrary("warhammer-dbc.traits", BEASTMAN_RACE_TRAITS);
  await _fillModLibrary("warhammer-dbc.traits", ELITE_TRAITS_LIBRARY);
  await _fillModLibrary("warhammer-dbc.traits", VOID_TRAIT_LIBRARY);
  // Мутации (стр. 440-452) и Дары Богов (стр. 453-460) — общий компендиум,
  // раскладка по папкам «Общие мутации» / «Дары Богов → <Бог>».
  await _fillModLibrary("warhammer-dbc.mutations", MUTATION_LIBRARY);
  await _fillModLibrary("warhammer-dbc.mutations", GOD_GIFT_LIBRARY);
});

// ─── Автозаполнение библиотеки Болезней (папки «Обычные»/«Варп») ────────────
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const pack = game.packs.get("warhammer-dbc.diseases");
  if (!pack) { console.warn("Warhammer DBC | Компендиум 'diseases' не найден."); return; }
  if (pack.locked) await pack.configure({ locked: false });
  try {
    const byName = {};
    for (const f of (pack.folders?.contents ?? [])) byName[f.name] = f.id;
    const wanted = [...new Set(DISEASE_LIBRARY.map(d => d.folder))];
    const missing = wanted.filter(n => !byName[n]);
    if (missing.length) {
      const created = await Folder.createDocuments(missing.map(name => ({ name, type: "Item", sorting: "m" })), { pack: pack.collection });
      for (const f of created) byName[f.name] = f.id;
    }
    // Переименования: правки названий не должны плодить дубли — сначала
    // приводим старые имена к новым, потом уже идёт обычная сверка.
    if (RENAMES[pack.collection]) {
      const idx0 = await pack.getIndex();
      const ren  = idx0.filter(e => RENAMES[pack.collection][e.name])
                       .map(e => ({ _id: e._id, name: RENAMES[pack.collection][e.name] }));
      if (ren.length) {
        if (pack.locked) await pack.configure({ locked: false });
        await Item.updateDocuments(ren, { pack: pack.collection });
        console.log(`Warhammer DBC | ${pack.collection}: переименовано ${ren.length}.`);
      }
    }
    const index    = await pack.getIndex();
    const existing = new Set(index.map(e => e.name));
    const toAdd = DISEASE_LIBRARY
      .filter(d => !existing.has(d.name))
      .map(d => ({ name: d.name, type: d.type, img: d.img, folder: byName[d.folder] ?? null, system: d.system }));
    if (toAdd.length) {
      await Item.createDocuments(toAdd, { pack: pack.collection });
      console.log(`Warhammer DBC | Библиотека болезней: добавлено ${toAdd.length}.`);
      ui.notifications?.info(`Warhammer DBC: в библиотеку болезней добавлено ${toAdd.length}.`);
    }
  } catch(e) {
    console.error("Warhammer DBC | Не удалось заполнить библиотеку болезней:", e);
  }
});

// ─── Автозаполнение библиотеки Систем Силовой Брони (папки по локациям) ─────
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const pack = game.packs.get("warhammer-dbc.armour-systems");
  if (!pack) { console.warn("Warhammer DBC | Компендиум 'armour-systems' не найден."); return; }
  if (pack.locked) await pack.configure({ locked: false });
  try {
    const byName = {};
    for (const f of (pack.folders?.contents ?? [])) byName[f.name] = f.id;
    const wanted = [...new Set(POWER_ARMOUR_SYSTEMS.map(d => d.folder))];
    const missing = wanted.filter(n => !byName[n]);
    if (missing.length) {
      const created = await Folder.createDocuments(missing.map(name => ({ name, type: "Item", sorting: "m" })), { pack: pack.collection });
      for (const f of created) byName[f.name] = f.id;
    }
    const index    = await pack.getIndex();
    const existing = new Set(index.map(e => e.name));
    const toAdd = POWER_ARMOUR_SYSTEMS
      .filter(d => !existing.has(d.name))
      .map(d => ({ name: d.name, type: d.type, img: d.img, folder: byName[d.folder] ?? null, system: d.system }));
    if (toAdd.length) {
      await Item.createDocuments(toAdd, { pack: pack.collection });
      console.log(`Warhammer DBC | Библиотека систем силовой брони: добавлено ${toAdd.length}.`);
      ui.notifications?.info(`Warhammer DBC: систем силовой брони добавлено ${toAdd.length}.`);
    }
  } catch(e) {
    console.error("Warhammer DBC | Не удалось заполнить библиотеку систем силовой брони:", e);
  }
});

// ─── Автозаполнение библиотек модификаций брони и оружия (папки по группам) ──
// Поля профиля оружия, которые синхронизатор подтягивает из библиотеки в
// компендиум. Состояние экземпляра (magazineCur, quality, installedOn) — нет.
const WEAPON_SYNC_KEYS = [
  "weaponClass", "weaponType", "range", "rof_single", "rof_semi", "rof_full",
  "damage", "damageType", "penetration", "magazineMax", "reload", "availability",
  "weight", "special", "weaponProps", "rangeBands", "balance",
  "profiles", "profileLabel", "grips",
  "offProfile", "gripProps2h", "corEffects",
  "shieldAP", "shieldZones", "shieldForm"
];

// Поля снаряжения, которые подтягиваются из библиотеки.
const GEAR_SYNC_KEYS = ["linkedWeapon", "effect", "reminder", "availability", "weight", "worn", "bookSource"];

// Поля профиля брони, которые синхронизатор подтягивает из библиотеки.
// Качество и надетость — состояние экземпляра, их не трогаем.
const ARMOR_SYNC_KEYS = [
  "armorType", "head", "body", "leftArm", "rightArm", "leftLeg", "rightLeg",
  "maxAgility", "strengthBonus", "wpBonus", "availability", "weight",
  "properties", "propRatings", "apSecond", "special"
];

// Переименования предметов в компендиумах (старое имя → новое). Нужны, чтобы
// исправление названия не оставляло в паке предмет-сироту со старым профилем.
const RENAMES = {
  "warhammer-dbc.weapons": {
    "Лонгглаз": "Лонглаз",
    "Плазменный Калибер": "Плазменный Каливер",
    "Плазменный Калибер (Астартес)": "Плазменный Каливер (Астартес)",
    "Волькитовый Калибер": "Волькитовый Каливер",
    "Стаб Карабин [Скитарии]": "Стаб Карабин",
    "Дробовик Отбивная [Альт]": "Дробовик Отбивная",
    "Дробовик Вокс-Леги [Альт]": "Дробовик Вокс-Леги",
    // Разведение одинаковых названий между корбуком и книгой друкхари.
    // В уже засеянном паке под этими именами лежат ИМЕННО друкхарские записи:
    // они идут в библиотеке раньше имперских, поэтому создались первыми, а
    // имперские тёзки просто не добавлялись. Переименование освобождает имя.
    "Бласт Пистолет": "Бласт Пистолет (Друкхари)",
    "Гекатрийский Клинок": "Гекатрийский Клинок (Друкхари)"
  }
};

/** Включена ли защита правок (см. настройку protectCompendiumEdits выше). */
function _editsProtected() {
  try { return game.settings.get("warhammer-dbc", "protectCompendiumEdits") === true; }
  catch (e) { return false; }
}

/** Разблокирует все компендиумы системы разом — по запросу настройки выше. */
async function _unlockAllSystemPacks() {
  let n = 0;
  for (const pack of game.packs) {
    if (pack.metadata.packageName !== "warhammer-dbc") continue;
    if (!pack.locked) continue;
    try { await pack.configure({ locked: false }); n++; }
    catch (e) { console.error(`Warhammer DBC | Не удалось разблокировать '${pack.collection}':`, e); }
  }
  if (n) {
    console.log(`Warhammer DBC | Разблокировано компендиумов: ${n}.`);
    ui.notifications?.info(`Warhammer DBC: разблокировано компендиумов для редактирования — ${n}.`);
  }
}
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  if (_editsProtected()) await _unlockAllSystemPacks();
});

async function _fillModLibrary(packId, library) {
  const pack = game.packs.get(packId);
  if (!pack) { console.warn(`Warhammer DBC | Компендиум '${packId}' не найден.`); return; }
  // Тело наполнения. Разблокировка делается прямо перед записью, чтобы пережить
  // гонку параллельных ready-хуков (все configure пишут общий настроечный объект
  // core.compendiumConfiguration и могут затирать разблокировку друг друга).
  // Ключ папки: "Родитель/Лист" для вложенных (d.folderParent), иначе просто имя.
  const keyFor = (d) => d.folderParent ? `${d.folderParent}/${d.folder}` : d.folder;
  const run = async () => {
    if (pack.locked) await pack.configure({ locked: false });
    // Индексация существующих папок по составному ключу (учёт вложенности).
    const folders   = pack.folders?.contents ?? [];
    const byId       = new Map(folders.map(f => [f.id, f]));
    const parentName = (f) => {
      const p = (typeof f.folder === "string") ? byId.get(f.folder) : f.folder;
      return p?.name ?? null;
    };
    const idByKey = {};
    for (const f of folders) {
      const pn = parentName(f);
      idByKey[pn ? `${pn}/${f.name}` : f.name] = f.id;
    }
    // Родительские папки (для вложенных групп) — создать первыми.
    const parents = [...new Set(library.map(d => d.folderParent).filter(Boolean))];
    for (const pn of parents) {
      if (idByKey[pn]) continue;
      if (pack.locked) await pack.configure({ locked: false });
      const [cf] = await Folder.createDocuments([{ name: pn, type: "Item", sorting: "m" }], { pack: pack.collection });
      idByKey[pn] = cf.id; byId.set(cf.id, cf);
    }
    // Листовые папки (верхнего уровня или вложенные).
    for (const key of [...new Set(library.map(keyFor))]) {
      if (idByKey[key]) continue;
      const d = library.find(x => keyFor(x) === key);
      if (pack.locked) await pack.configure({ locked: false });
      const data = { name: d.folder, type: "Item", sorting: "m" };
      if (d.folderParent) data.folder = idByKey[d.folderParent];
      const [cf] = await Folder.createDocuments([data], { pack: pack.collection });
      idByKey[key] = cf.id;
    }
    const index    = await pack.getIndex();
    const existing = new Set(index.map(e => e.name));
    const toAdd = library
      .filter(d => !existing.has(d.name))
      .map(d => ({ name: d.name, type: d.type, img: d.img, folder: idByKey[keyFor(d)] ?? null, system: d.system }));
    if (toAdd.length) {
      if (pack.locked) await pack.configure({ locked: false });
      await Item.createDocuments(toAdd, { pack: pack.collection });
      console.log(`Warhammer DBC | ${packId}: добавлено ${toAdd.length}.`);
    }
    // Синхронизация (обновление существующих записей + перенос по папкам +
    // чистка пустых папок) пропускается целиком, если GM включил защиту
    // правок (настройка protectCompendiumEdits) — тогда трогаем компендиум
    // только добавлением недостающих по имени (уже сделано выше).
    if (_editsProtected()) return;
    // Синхронизация: обновляем effects/description/requirement/benefit существующих
    // предметов по библиотеке, чтобы правки и фиксы доходили до компендиума.
    // (benefit есть у Талантов/Черт; у модов он пуст — diff не возникает.)
    const libByName = new Map(library.map(d => [d.name, d]));
    const docs = await pack.getDocuments();
    const updates = [];
    for (const doc of docs) {
      const d = libByName.get(doc.name);
      if (!d) continue;
      const cur = doc.system || {}, want = d.system || {};
      const diff = JSON.stringify(cur.effects ?? {}) !== JSON.stringify(want.effects ?? {})
                || (cur.description ?? "") !== (want.description ?? "")
                || (cur.requirement ?? "") !== (want.requirement ?? "")
                || (cur.benefit ?? "") !== (want.benefit ?? "")
                || (want.mods !== undefined && (cur.mods ?? "") !== (want.mods ?? ""))
                || (want.bookSource !== undefined && (cur.bookSource ?? "") !== (want.bookSource ?? ""));
      if (diff) updates.push({ _id: doc.id, "system.effects": want.effects,
        "system.description": want.description ?? "", "system.requirement": want.requirement ?? "",
        "system.benefit": want.benefit ?? "",
        ...(want.mods !== undefined ? { "system.mods": want.mods ?? "" } : {}),
        ...(want.bookSource !== undefined ? { "system.bookSource": want.bookSource ?? "" } : {}) });
      // У оружия сверяем ещё и сам профиль: без этого правки урона/RoF/обоймы
      // и т.п. остаются в коде и не доезжают до уже засеянного компендиума.
      // magazineCur и quality не трогаем — это состояние экземпляра.
      // Профиль брони синхронизируем так же, как оружейный: без этого правки
      // AP, Max.A, свойств и редкости остаются в коде и не доезжают до пака.
      // Снаряжение: тянем ссылку на его оружейный профиль и краткую сводку.
      // Инструменты — та же сверка, что и у снаряжения.
      if (doc.type === "tool") {
        const tu = {};
        for (const k of GEAR_SYNC_KEYS) {
          if (want[k] === undefined) continue;
          if (cur[k] !== want[k]) tu[`system.${k}`] = want[k];
        }
        if (Object.keys(tu).length) updates.push({ _id: doc.id, ...tu });
      }
      if (doc.type === "gear") {
        const gu = {};
        for (const k of GEAR_SYNC_KEYS) {
          if (want[k] === undefined) continue;
          if (cur[k] !== want[k]) gu[`system.${k}`] = want[k];
        }
        if (Object.keys(gu).length) updates.push({ _id: doc.id, ...gu });
      }
      if (doc.type === "armor") {
        const au = {};
        for (const k of ARMOR_SYNC_KEYS) {
          if (want[k] === undefined) continue;
          const a = cur[k], b = want[k];
          const same = (typeof b === "object")
            ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
            : a === b;
          if (!same) au[`system.${k}`] = b;
        }
        if (Object.keys(au).length) updates.push({ _id: doc.id, ...au });
      }
      if (doc.type === "weapon") {
        const wu = {};
        for (const k of WEAPON_SYNC_KEYS) {
          if (want[k] === undefined) continue;
          const a = cur[k], b = want[k];
          const same = (typeof b === "object")
            ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
            : a === b;
          if (!same) wu[`system.${k}`] = b;
        }
        if (Object.keys(wu).length) updates.push({ _id: doc.id, ...wu });
      }
    }
    if (updates.length) {
      if (pack.locked) await pack.configure({ locked: false });
      await Item.updateDocuments(updates, { pack: pack.collection });
      console.log(`Warhammer DBC | ${packId}: обновлено ${updates.length}.`);
    }
    // Миграция папок: переносим существующие предметы в их целевые (вложенные)
    // папки — напр. при добавлении родительского слоя «Стрелковое/Рукопашное/Щиты».
    const folderMoves = [];
    for (const doc of docs) {
      const d = libByName.get(doc.name);
      if (!d) continue;
      const targetId = idByKey[keyFor(d)] ?? null;
      const curId = doc.folder?.id ?? doc.folder ?? null;
      if (curId !== targetId) folderMoves.push({ _id: doc.id, folder: targetId });
    }
    if (folderMoves.length) {
      if (pack.locked) await pack.configure({ locked: false });
      await Item.updateDocuments(folderMoves, { pack: pack.collection });
      console.log(`Warhammer DBC | ${packId}: перенесено ${folderMoves.length} в новые папки.`);
    }
    // Чистка устаревших пустых папок (старый плоский слой после миграции).
    const wantedKeys = new Set([...library.map(keyFor), ...parents]);
    const fresh = pack.folders?.contents ?? [];
    const fById = new Map(fresh.map(f => [f.id, f]));
    const pnOf  = (f) => { const p = (typeof f.folder === "string") ? fById.get(f.folder) : f.folder; return p?.name ?? null; };
    const allDocs = await pack.getDocuments();
    const usedFolderIds = new Set(allDocs.map(x => x.folder?.id ?? x.folder).filter(Boolean));
    const parentOfFolder = new Set(fresh.map(f => (typeof f.folder === "string") ? f.folder : f.folder?.id).filter(Boolean));
    const toPrune = fresh.filter(f => {
      const key = pnOf(f) ? `${pnOf(f)}/${f.name}` : f.name;
      return !wantedKeys.has(key) && !usedFolderIds.has(f.id) && !parentOfFolder.has(f.id);
    });
    if (toPrune.length) {
      if (pack.locked) await pack.configure({ locked: false });
      await Folder.deleteDocuments(toPrune.map(f => f.id), { pack: pack.collection });
      console.log(`Warhammer DBC | ${packId}: удалено пустых папок ${toPrune.length}.`);
    }
  };
  try {
    await run();
  } catch(e) {
    // Скорее всего гонка разблокировки между хуками — форсируем и повторяем.
    if (/locked/i.test(e?.message ?? "")) {
      try {
        await pack.configure({ locked: false });
        await run();
      } catch(e2) {
        console.error(`Warhammer DBC | Не удалось заполнить '${packId}' (повтор):`, e2);
      }
    } else {
      console.error(`Warhammer DBC | Не удалось заполнить '${packId}':`, e);
    }
  }
}
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  await _fillModLibrary("warhammer-dbc.armor-mods",  ARMOR_MODS_LIBRARY);
  await _fillModLibrary("warhammer-dbc.weapon-mods", WEAPON_MODS_LIBRARY);
});

// Справочные библиотеки (не проходят через createItem/«Механику» — см.
// комментарии в шапках weapon-properties-library.mjs/armour-history-library.mjs
// про то, почему это другой класс механики).
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  await _fillModLibrary("warhammer-dbc.weapon-properties", weaponPropertyLibrary());
  await _fillModLibrary("warhammer-dbc.armour-histories",  armourHistoryLibrary());
  await _fillModLibrary("warhammer-dbc.aspirations",       aspirationLibrary());
  await _fillModLibrary("warhammer-dbc.archetypes",        archetypeLibrary());
});


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
// Разово (по флагу на каждом предмете — устойчиво к перезапускам и не трогает
// уже мигрированное) переводит старые числовые эффекты в реальный, работающий
// Active Effect — единственный источник правды для этих 11 типов отныне.
// Сам system.effects НЕ стираем (легаси/справка), только перестаём его читать
// в prepareDerivedData и показывать для редактирования (см. партиалы листов).
const MIGRATE_EFFECT_TYPES = new Set([
  "talent", "trait", "implant", "mutation", "psychicPower", "techPower",
  "homeworld", "divination", "armorMod", "weaponMod"
]);
const MIGRATE_COMPENDIA = [
  "warhammer-dbc.traits", "warhammer-dbc.talents", "warhammer-dbc.implants",
  "warhammer-dbc.mutations", "warhammer-dbc.psychic-powers", "warhammer-dbc.tech-powers",
  "warhammer-dbc.homeworlds", "warhammer-dbc.divinations",
  "warhammer-dbc.armor-mods", "warhammer-dbc.weapon-mods"
];

async function _migrateItemEffects(item) {
  if (!MIGRATE_EFFECT_TYPES.has(item.type)) return false;
  if (item.getFlag("warhammer-dbc", "migratedEffect")) return false;
  const fx = item.system?.effects;
  if (!hasLegacyEffects(fx)) {
    // Нечего переносить — всё равно ставим флаг, чтобы не пересканировать
    // этот предмет на каждом следующем перезапуске.
    await item.setFlag("warhammer-dbc", "migratedEffect", true);
    return false;
  }
  const changes = legacyEffectsToChanges(fx);
  await item.createEmbeddedDocuments("ActiveEffect", [{
    name: `${item.name} (перенесено)`, icon: item.img,
    system: { changes }
  }]);
  await item.setFlag("warhammer-dbc", "migratedEffect", true);
  return true;
}

// Починка бага ранней версии миграции: charValueBonuses (обычные +X к
// характеристике — Родные миры, импланты и т.п.) переводились в
// system.characteristics.<стат>.value — поля, которого не существует ни в
// схеме, ни в коде листа (сравните с prepareDerivedData: считается .total).
// Эффект тихо создавался, но ни на что не влиял. Верный путь — .total, он
// пересчитывается заново из base/advance/... каждый цикл, поэтому
// "final"-эффект безопасно ложится поверх (тот же приём, что и у .bonus).
// Идемпотентно само по себе — почищенных .value-ключей просто не останется.
async function _repairCharValueEffectKeys(item) {
  let fixed = 0;
  for (const effect of item.effects ?? []) {
    const changes = effect.system?.changes ?? [];
    if (!changes.some(c => /^system\.characteristics\.\w+\.value$/.test(c.key))) continue;
    const newChanges = changes.map(c => /^system\.characteristics\.\w+\.value$/.test(c.key)
      ? { ...c, key: c.key.replace(/\.value$/, ".total") } : c);
    await effect.update({ "system.changes": newChanges });
    fixed++;
  }
  return fixed;
}

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  let migrated = 0, repaired = 0;

  // Акторы мира — каждый их предмет с непустыми старыми эффектами.
  for (const actor of game.actors) {
    for (const item of actor.items) {
      if (await _migrateItemEffects(item)) migrated++;
      repaired += await _repairCharValueEffectKeys(item);
    }
  }

  // Компендиумы библиотек — та же логика, с разблокировкой пака.
  for (const packId of MIGRATE_COMPENDIA) {
    const pack = game.packs.get(packId);
    if (!pack) continue;
    try {
      if (pack.locked) await pack.configure({ locked: false });
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        if (await _migrateItemEffects(doc)) migrated++;
        repaired += await _repairCharValueEffectKeys(doc);
      }
    } catch (e) {
      console.error(`Warhammer DBC | Миграция эффектов '${packId}':`, e);
    }
  }

  if (migrated) {
    console.log(`Warhammer DBC | Миграция эффектов: перенесено ${migrated} предм. в Active Effect.`);
    ui.notifications?.info(`Warhammer DBC: перенесено в новую систему эффектов — ${migrated}.`);
  }
  if (repaired) {
    console.log(`Warhammer DBC | Починка эффектов: исправлено ${repaired} эффект(ов) с ключом .value → .total.`);
    ui.notifications?.info(`Warhammer DBC: исправлены неработавшие бонусы характеристик — ${repaired}.`);
  }
});

// ─── Автозаполнение библиотеки Талантов (папки = функциональные группы) ─────
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  await _fillModLibrary("warhammer-dbc.talents", TALENT_LIBRARY);
  // Таланты и Дары Одержимого (папка «Таланты одержимых»).
  await _fillModLibrary("warhammer-dbc.talents", POSSESSION_LIBRARY);
  // Дополнительные Таланты Элитных Архетипов (папка «Элитные архетипы»).
  await _fillModLibrary("warhammer-dbc.talents", ELITE_TALENTS_LIBRARY);

  // Миграция уже созданных талантов: перенести текст из description в benefit
  // (поле «ЧТО ДАЁТ»), т.к. именно benefit выводит система раскрытия описаний.
  try {
    const pack = game.packs.get("warhammer-dbc.talents");
    if (pack) {
      if (pack.locked) await pack.configure({ locked: false });
      const docs = await pack.getDocuments();
      const updates = docs
        .filter(d => d.type === "talent" && !d.system.benefit && d.system.description)
        .map(d => ({ _id: d.id, "system.benefit": d.system.description, "system.description": "" }));
      if (updates.length) {
        await Item.updateDocuments(updates, { pack: pack.collection });
        console.log(`Warhammer DBC | Таланты: перенесено описаний в «ЧТО ДАЁТ»: ${updates.length}.`);
      }
    }
  } catch(e) { console.error("Warhammer DBC | Миграция талантов (benefit) не удалась:", e); }
});

// ─── Библиотека Имплантов: вложенная структура (Адептус Механикус → …) ──────
// Всё, что связано с Механикус/Механикум/Скитариями/мехадендритами — в одной
// родительской папке с подпапками. Старые плоские папки мигрируются и удаляются.
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const pack = game.packs.get("warhammer-dbc.implants");
  if (!pack) { console.warn("Warhammer DBC | Компендиум 'implants' не найден."); return; }

  const MECH = "Адептус Механикус";
  const IMPL_PATHS = {
    mechanicus:    [MECH, "Импланты Механикус"],
    skitarii:      [MECH, "Кибернетика Скитарии"],
    mechEnergy:    [MECH, "Кибернетика Механикум", "Энергосистемы"],
    mechFocus:     [MECH, "Кибернетика Механикум", "Технофокусы"],
    mechOther:     [MECH, "Кибернетика Механикум", "Прочее"],
    mechadendrite: [MECH, "Мехадендриты"],
    bionic:        ["Бионика"],
    cybernetic:    ["Кибернетика"],
    psybernetic:   ["Псибернетика"],
    archeotech:    ["Археотех"],
    bioimplant:    ["Биоимпланты (Друкхари)"],
    geneseed:      ["Геносемя (Астартес)"]
  };
  const pathFor = cat => IMPL_PATHS[cat] || ["Кибернетика"];
  // Старые плоские папки верхнего уровня — удаляем после миграции (если пусты).
  const LEGACY = new Set(["Механикус", "Импланты Механикус", "Кибернетика Механикум",
    "Кибернетика Скитарии", "Мехадендриты", "Механикум — Энергосистемы",
    "Механикум — Технофокусы", "Механикум — Прочее"]);

  // Путь папки предмета: явный folderPath из данных (для подпапок биоимплантов)
  // имеет приоритет над папкой по категории.
  const libByName = new Map(IMPLANT_LIBRARY.map(d => [d.name, d]));
  const pathOfDoc = d => {
    const entry = libByName.get(d.name);
    return (entry && Array.isArray(entry.folderPath) && entry.folderPath.length)
      ? entry.folderPath : pathFor(d.system?.category);
  };

  try {
    await _unlockPack(pack);
    const cache = {};
    let docs = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, d]));

    // 1) Добавляем недостающие в правильные вложенные папки.
    const toAdd = [];
    for (const d of IMPLANT_LIBRARY) {
      if (byName.has(d.name)) continue;
      const path = Array.isArray(d.folderPath) && d.folderPath.length ? d.folderPath : pathFor(d.system?.category);
      const folder = await _ensureWeaponFolder(pack, path, cache);
      toAdd.push({ name: d.name, type: d.type, img: d.img, system: d.system, folder });
    }
    if (toAdd.length) {
      await _unlockPack(pack);
      await Item.createDocuments(toAdd, { pack: pack.collection });
      docs = await pack.getDocuments();
    }

    // 2) Миграция: переносим в правильные вложенные папки и синхронизируем
    //    описание/эффект существующих имплантов с библиотекой (по имени).
    //    Пропускается при защите правок (protectCompendiumEdits) — импланты
    //    правят руками не реже прочего, а тут ещё и папка/описание/эффект
    //    целиком перезаписываются под библиотеку.
    const updates = [];
    if (!_editsProtected()) {
      for (const d of docs) {
        if (d.type !== "implant") continue;
        const target = await _ensureWeaponFolder(pack, pathOfDoc(d), cache);
        const entry  = libByName.get(d.name);
        const upd = { _id: d.id };
        if ((d.folder?.id ?? null) !== target) upd.folder = target;
        if (entry && (d.system?.effect !== entry.system.effect || d.system?.description !== entry.system.description))
          upd.system = entry.system;
        if (Object.keys(upd).length > 1) updates.push(upd);
      }
      if (updates.length) {
        await _unlockPack(pack);
        await Item.updateDocuments(updates, { pack: pack.collection });
      }
    }

    // 3) Удаляем старые пустые плоские папки верхнего уровня.
    const keep         = new Set(Object.values(cache));
    const fresh        = await pack.getDocuments();
    const usedFolders  = new Set(fresh.map(d => d.folder?.id).filter(Boolean));
    const folders      = pack.folders?.contents ?? [];
    const usedAsParent = new Set(folders.map(f => f.folder?.id).filter(Boolean));
    const toDelete = folders
      .filter(f => (f.folder?.id ?? null) === null && LEGACY.has(f.name)
                && !keep.has(f.id) && !usedFolders.has(f.id) && !usedAsParent.has(f.id))
      .map(f => f.id);
    if (toDelete.length) {
      await _unlockPack(pack);
      await Folder.deleteDocuments(toDelete, { pack: pack.collection });
    }

    const parts = [];
    if (toAdd.length)    parts.push(`добавлено ${toAdd.length}`);
    if (updates.length)  parts.push(`перенесено ${updates.length}`);
    if (toDelete.length) parts.push(`удалено папок ${toDelete.length}`);
    if (parts.length) console.log(`Warhammer DBC | Импланты: ${parts.join(", ")}.`);
  } catch(e) {
    console.error("Warhammer DBC | Не удалось обновить библиотеку имплантов:", e);
  }
});

// ─── Автозаполнение библиотеки Оружия (вложенные папки Азуриане → …) ────────
// Идемпотентно: добавляет недостающее по имени, создавая папки по пути.
async function _ensureWeaponFolder(pack, pathArr, cache) {
  let parentId = null;
  let key = "";
  for (const name of pathArr) {
    key = key ? `${key}/${name}` : name;
    if (cache[key]) { parentId = cache[key]; continue; }
    let folder = (pack.folders?.contents ?? [])
      .find(f => f.name === name && (f.folder?.id ?? null) === parentId);
    if (!folder) {
      folder = await Folder.create({ name, type: "Item", folder: parentId, sorting: "m" },
                                   { pack: pack.collection });
    }
    cache[key] = folder.id;
    parentId   = folder.id;
  }
  return parentId;
}

// ─── Чистка папок компендиума ──────────────────────────────────────────────
// Битые папки от старого билдера имели имя-массив через запятую
// («ПСИХОСИЛЫ,КОЛДОВСТВО»). Удаляем их безоговорочно.
async function _purgeMalformedFolders(pack) {
  // Гидратируем содержимое пака — иначе pack.folders.contents может быть пуст.
  await pack.getDocuments();
  const bad = (pack.folders?.contents ?? []).filter(f => f.name.includes(","));
  if (bad.length) {
    // Удаляем вместе с содержимым: внутри лежат лишь устаревшие дубли,
    // канонические силы билдер пересоздаст в правильных вложенных папках.
    await Folder.deleteDocuments(bad.map(f => f.id),
      { pack: pack.collection, deleteSubfolders: true, deleteContents: true });
    console.log(`Warhammer DBC | Удалено битых папок с содержимым (${pack.collection}): ${bad.length}`);
  }
}
// Удаляем пустые папки (нет предметов и нет вложенных папок). Вызывать ПОСЛЕ
// добавления предметов, чтобы не снести только что наполняемые папки.
async function _purgeEmptyFolders(pack) {
  const docs    = await pack.getDocuments();
  const folders = pack.folders?.contents ?? [];
  const used    = new Set(docs.map(d => d.folder?.id).filter(Boolean));
  const parents = new Set(folders.map(f => f.folder?.id).filter(Boolean));
  // повторяем, пока остаются пустые (удаление одной может опустошить родителя)
  let removed = 0, pass = true;
  while (pass) {
    pass = false;
    const cur = pack.folders?.contents ?? [];
    const curUsed = new Set((await pack.getDocuments()).map(d => d.folder?.id).filter(Boolean));
    const curPar  = new Set(cur.map(f => f.folder?.id).filter(Boolean));
    const empty = cur.filter(f => !curUsed.has(f.id) && !curPar.has(f.id));
    if (empty.length) {
      await Folder.deleteDocuments(empty.map(f => f.id), { pack: pack.collection });
      removed += empty.length; pass = true;
    }
  }
  if (removed) console.log(`Warhammer DBC | Удалено пустых папок (${pack.collection}): ${removed}`);
}

// ─── Надёжная разблокировка пака (избегаем гонки настроек блокировки) ───────
async function _unlockPack(pack) {
  if (pack.locked) await pack.configure({ locked: false });
  // Перепроверка: одновременные configure разных паков пишут в один мировой
  // сеттинг и могут затирать друг друга — даём второй заход при необходимости.
  if (pack.locked) await pack.configure({ locked: false });
}

// Все библиотеки заполняются ПОСЛЕДОВАТЕЛЬНО в одном хуке, чтобы разблокировки
// паков не выполнялись параллельно и не затирали друг друга.
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  // ── Оружие ──
  try {
    const pack = game.packs.get("warhammer-dbc.weapons");
    if (!pack) throw new Error("Компендиум 'weapons' не найден.");
    await _unlockPack(pack);
    const docs   = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, d]));
    const cache  = {};
    const toAdd = [], toUpdate = [];
    for (const w of [...AELDARI_WEAPONS, ...MECHADENDRITE_WEAPONS]) {
      const doc = byName.get(w.name);
      if (doc) {
        const hasProps  = (doc.system?.weaponProps?.length ?? 0) > 0;
        const badDamage = /\s/.test(doc.system?.damage || "");
        if (!hasProps || badDamage) { toUpdate.push({ _id: doc.id, system: w.system }); continue; }
        // Точечная миграция класса/типа оружия: приводим к библиотечным значениям
        // (напр. осколочное → "splinter", тёмносветовое → "darklight" вместо
        // устаревшего "laser"). Не трогаем остальные поля, если профиль уже корректен.
        const upd = { _id: doc.id };
        if ((doc.system?.weaponType  ?? "") !== (w.system.weaponType  ?? "")) upd["system.weaponType"]  = w.system.weaponType;
        if ((doc.system?.weaponClass ?? "") !== (w.system.weaponClass ?? "")) upd["system.weaponClass"] = w.system.weaponClass;
        if (Object.keys(upd).length > 1) toUpdate.push(upd);
        continue;
      }
      const folderId = await _ensureWeaponFolder(pack, w.folder, cache);
      toAdd.push({ name: w.name, type: w.type, folder: folderId, system: w.system });
    }
    if (toAdd.length)    await Item.createDocuments(toAdd, { pack: pack.collection });
    if (toUpdate.length) await Item.updateDocuments(toUpdate, { pack: pack.collection });
    if (toAdd.length || toUpdate.length)
      console.log(`Warhammer DBC | Оружие: добавлено ${toAdd.length}, обновлено ${toUpdate.length}.`);
  } catch(e) { console.error("Warhammer DBC | Библиотека оружия:", e); }

  // ── Боеприпасы ──
  try {
    const pack = game.packs.get("warhammer-dbc.ammunition");
    if (!pack) throw new Error("Компендиум 'ammunition' не найден.");
    await _unlockPack(pack);
    const docs   = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, d]));
    const cache  = {};
    const toAdd = [], toUpdate = [];
    // `properties` (свойства оружия от боеприпаса) и `damageDiceMod` («+1 кубик
    // урона») добавлены позже — без них правки стр. 203 не дошли бы до уже
    // созданных предметов в компендиуме.
    const SYNC = ["description", "weaponTypes", "ammoCategory", "rarity", "weight",
                  "availability", "attackMod", "damageMod", "damageDiceMod",
                  "damageTypeOverride", "penetrationMod", "rangeMod",
                  "rangeMultiplier", "special", "properties", "condMods"];
    for (const a of AMMO_LIBRARY) {
      const folderId = await _ensureWeaponFolder(pack, a.folder, cache);
      const ex = byName.get(a.name);
      if (!ex) {
        // quantity у предметов в компендиуме держим 0 — наполняется при выдаче игроку
        toAdd.push({ name: a.name, type: a.type, img: a.img, folder: folderId, system: a.system });
        continue;
      }
      const upd = { _id: ex.id };
      if ((ex.folder?.id ?? null) !== folderId) upd.folder = folderId;
      for (const k of SYNC) {
        const cur = ex.system?.[k], next = a.system[k];
        const same = Array.isArray(next)
          ? JSON.stringify(cur ?? []) === JSON.stringify(next)
          : (cur ?? "") === (next ?? "");
        if (!same) upd[`system.${k}`] = next;
      }
      if (Object.keys(upd).length > 1) toUpdate.push(upd);
    }
    if (toAdd.length)    await Item.createDocuments(toAdd, { pack: pack.collection });
    if (toUpdate.length) await Item.updateDocuments(toUpdate, { pack: pack.collection });
    if (toAdd.length || toUpdate.length)
      console.log(`Warhammer DBC | Боеприпасы: добавлено ${toAdd.length}, обновлено ${toUpdate.length}.`);
  } catch(e) { console.error("Warhammer DBC | Библиотека боеприпасов:", e); }

  // ── Броня ──
  try {
    const pack = game.packs.get("warhammer-dbc.armor");
    if (!pack) throw new Error("Компендиум 'armor' не найден.");
    await _unlockPack(pack);
    const docs   = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, d]));
    const cache  = {};
    const toAdd = [], toUpdate = [];
    for (const a of AELDARI_ARMOR) {
      const doc = byName.get(a.name);
      if (doc) {
        // Миграция: тип, бонусы S/W, AP по зонам, редкость, вес и текст свойств.
        // Раньше сверялись только тип и бонусы, поэтому правки книжных данных
        // (напр. S +25 у Mk II/Mk III, стр. 234) не доходили до компендиума.
        const s = doc.system || {}, w = a.system;
        const AP_KEYS = ["head","body","leftArm","rightArm","leftLeg","rightLeg"];
        const needsFix = s.armorType !== w.armorType
                      || (s.strengthBonus ?? 0) !== (w.strengthBonus ?? 0)
                      || (s.wpBonus ?? 0)       !== (w.wpBonus ?? 0)
                      || (s.availability ?? 0)  !== (w.availability ?? 0)
                      || (s.maxAgility ?? 100)  !== (w.maxAgility ?? 100)
                      || (s.weight ?? 0)        !== (w.weight ?? 0)
                      || (s.special ?? "")      !== (w.special ?? "")
                      || AP_KEYS.some(k => (s[k] ?? 0) !== (w[k] ?? 0));
        // Качество и надетость — состояние конкретного предмета, их не трогаем.
        if (needsFix) toUpdate.push({ _id: doc.id, system: {
          ...w, quality: s.quality ?? w.quality, equipped: s.equipped ?? false
        } });
        continue;
      }
      const folderId = await _ensureWeaponFolder(pack, a.folder, cache);
      toAdd.push({ name: a.name, type: a.type, folder: folderId, system: a.system });
    }
    if (toAdd.length)    await Item.createDocuments(toAdd, { pack: pack.collection });
    if (toUpdate.length) await Item.updateDocuments(toUpdate, { pack: pack.collection });
    if (toAdd.length || toUpdate.length)
      console.log(`Warhammer DBC | Броня: добавлено ${toAdd.length}, обновлено ${toUpdate.length}.`);
  } catch(e) { console.error("Warhammer DBC | Библиотека брони:", e); }

  // ── Силовые щиты ──
  try {
    const pack = game.packs.get("warhammer-dbc.shields");
    if (!pack) throw new Error("Компендиум 'shields' не найден.");
    await _unlockPack(pack);
    const sysFromShield = s => ({
      shieldNature: s.shieldNature, shieldType: s.shieldType,
      ratingMin: s.ratingMin, ratingMax: s.ratingMax, overloadThreshold: s.overloadThreshold,
      isSpecialRating: s.isSpecialRating, currentRating: 0, equipped: false, status: "inactive",
      quality: "common", availability: s.availability, weight: s.weight, description: s.description
    });
    const index    = await pack.getIndex();
    const existing = new Set(index.map(e => e.name));
    const cache = {};
    const toAdd = [];
    for (const s of SHIELD_COMPENDIUM) {
      if (existing.has(s.name)) continue;
      const folderId = await _ensureWeaponFolder(pack, [SHIELD_NATURES[s.shieldNature] || "Прочие"], cache);
      toAdd.push({ name: s.name, type: "forcefield", folder: folderId, system: sysFromShield(s) });
    }
    for (const s of ELDAR_SHIELDS) {
      if (existing.has(s.name)) continue;
      const folderId = await _ensureWeaponFolder(pack, ["Азуриане"], cache);
      toAdd.push({ name: s.name, type: "forcefield", folder: folderId, system: sysFromShield(s) });
    }
    if (toAdd.length) {
      await Item.createDocuments(toAdd, { pack: pack.collection });
      console.log(`Warhammer DBC | Щиты: добавлено ${toAdd.length}.`);
    }
  } catch(e) { console.error("Warhammer DBC | Библиотека щитов:", e); }

  // ── Корабельные узлы ──
  try {
    const pack = game.packs.get("warhammer-dbc.ship-components");
    if (!pack) throw new Error("Компендиум 'ship-components' не найден.");
    await _unlockPack(pack);
    const docs   = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, d]));
    const cache  = {};
    const toAdd = [], toUpdate = [];
    for (const c of SHIP_COMPONENTS) {
      const path = Array.isArray(c.folder) ? c.folder : [c.folder];
      const folderId = await _ensureWeaponFolder(pack, path, cache);
      const ex = byName.get(c.name);
      if (ex) {
        // Миграция: переносим существующие узлы в актуальную (вложенную) папку
        // и подтягиваем бонусы LC/PC из библиотеки.
        const upd = { _id: ex.id };
        if ((ex.folder?.id ?? null) !== folderId) upd.folder = folderId;
        const lcB = Number(c.system.lcBonus) || 0, pcB = Number(c.system.pcBonus) || 0;
        if ((Number(ex.system.lcBonus) || 0) !== lcB) upd["system.lcBonus"] = lcB;
        if ((Number(ex.system.pcBonus) || 0) !== pcB) upd["system.pcBonus"] = pcB;
        // У торпедных аппаратов урона нет (он от боеголовки) — чистим старое значение «торпеды».
        if (c.system.weapon?.wType === "torpedo" && (ex.system.weapon?.damage || "") !== "")
          upd["system.weapon.damage"] = "";
        if (Object.keys(upd).length > 1) toUpdate.push(upd);
      } else {
        toAdd.push({ name: c.name, type: c.type, img: c.img, folder: folderId, system: c.system });
      }
    }
    // Снаряжение корабля (грузы) — папка «Снаряжение».
    for (const e of SHIP_EQUIPMENT) {
      if (byName.has(e.name)) continue;
      const folderId = await _ensureWeaponFolder(pack, e.folder, cache);
      toAdd.push({ name: e.name, type: e.type, img: e.img, folder: folderId, system: e.system });
    }

    if (toAdd.length)    await Item.createDocuments(toAdd, { pack: pack.collection });
    if (toUpdate.length) await Item.updateDocuments(toUpdate, { pack: pack.collection });
    if (toAdd.length || toUpdate.length)
      console.log(`Warhammer DBC | Корабельные узлы/снаряжение: добавлено ${toAdd.length}, перенесено ${toUpdate.length}.`);

    // Чистим устаревшие плоские папки «Орудия — …» / «Корпуса — …».
    // Любой узел, оставшийся в такой папке, — устаревший дубль/сирота прежней
    // структуры (актуальная копия уже лежит во вложенной папке), поэтому удаляем
    // и сами папки, и их остаточное содержимое.
    const legacyRe      = /^(Орудия|Корпуса)\s+—\s+/;
    const legacyFolders = (pack.folders?.contents ?? []).filter(f => legacyRe.test(f.name));
    if (legacyFolders.length) {
      const legacyIds = new Set(legacyFolders.map(f => f.id));
      const allDocs   = await pack.getDocuments();
      const staleIds  = allDocs.filter(d => legacyIds.has(d.folder?.id)).map(d => d.id);
      if (staleIds.length) await Item.deleteDocuments(staleIds, { pack: pack.collection });
      for (const f of legacyFolders) await f.delete();
      console.log(`Warhammer DBC | Корабельные узлы: удалено плоских папок ${legacyFolders.length}, устаревших узлов ${staleIds.length}.`);
    }
  } catch(e) { console.error("Warhammer DBC | Библиотека корабельных узлов:", e); }

  // ── Снаряжение техники ──
  try {
    const pack = game.packs.get("warhammer-dbc.vehicle-equipment");
    if (!pack) throw new Error("Компендиум 'vehicle-equipment' не найден.");
    await _unlockPack(pack);
    const docs   = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, d]));
    const toAdd = [], toUpdate = [];
    for (const e of VEHICLE_EQUIPMENT) {
      const ex = byName.get(e.name);
      if (!ex) { toAdd.push({ name: e.name, type: e.type, img: e.img, system: e.system }); continue; }
      // Синхронизируем редкость и описание из библиотеки (правки доходят до пака).
      const upd = { _id: ex.id };
      if ((Number(ex.system.availability) || 0) !== (Number(e.system.availability) || 0))
        upd["system.availability"] = e.system.availability;
      if ((ex.system.description || "") !== (e.system.description || ""))
        upd["system.description"] = e.system.description;
      if (Object.keys(upd).length > 1) toUpdate.push(upd);
    }
    if (toAdd.length)    await Item.createDocuments(toAdd, { pack: pack.collection });
    if (toUpdate.length) await Item.updateDocuments(toUpdate, { pack: pack.collection });
    if (toAdd.length || toUpdate.length)
      console.log(`Warhammer DBC | Снаряжение техники: добавлено ${toAdd.length}, обновлено ${toUpdate.length}.`);
  } catch(e) { console.error("Warhammer DBC | Библиотека снаряжения техники:", e); }

  // ── Орудия техники ──
  try {
    const pack = game.packs.get("warhammer-dbc.vehicle-weapons");
    if (!pack) throw new Error("Компендиум 'vehicle-weapons' не найден.");
    await _unlockPack(pack);
    const docs   = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, d]));
    const cache  = {};
    const toAdd = [], toUpdate = [];
    for (const w of VEHICLE_WEAPONS) {
      const ex = byName.get(w.name);
      if (ex) {
        // Неразрушающе: доводим тип/класс/свойства при рассинхроне с библиотекой.
        const upd = { _id: ex.id };
        if ((ex.system?.weaponType ?? "")  !== (w.system.weaponType ?? ""))  upd["system.weaponType"]  = w.system.weaponType;
        if ((ex.system?.weaponClass ?? "") !== (w.system.weaponClass ?? "")) upd["system.weaponClass"] = w.system.weaponClass;
        if ((ex.system?.weaponProps?.length ?? 0) === 0 && (w.system.weaponProps?.length ?? 0) > 0)
          upd["system.weaponProps"] = w.system.weaponProps;
        if (Object.keys(upd).length > 1) toUpdate.push(upd);
        continue;
      }
      const folderId = await _ensureWeaponFolder(pack, w.folder, cache);
      toAdd.push({ name: w.name, type: w.type, img: w.img, folder: folderId, system: w.system });
    }
    if (toAdd.length)    await Item.createDocuments(toAdd, { pack: pack.collection });
    if (toUpdate.length) await Item.updateDocuments(toUpdate, { pack: pack.collection });
    if (toAdd.length || toUpdate.length)
      console.log(`Warhammer DBC | Орудия техники: добавлено ${toAdd.length}, обновлено ${toUpdate.length}.`);
  } catch(e) { console.error("Warhammer DBC | Библиотека орудий техники:", e); }

  // ── Черты техники ──
  try {
    const pack = game.packs.get("warhammer-dbc.vehicle-traits");
    if (!pack) throw new Error("Компендиум 'vehicle-traits' не найден.");
    await _unlockPack(pack);
    const docs   = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, d]));
    const toAdd = [], toUpdate = [];
    for (const t of VEHICLE_TRAITS) {
      const ex = byName.get(t.name);
      if (!ex) { toAdd.push({ name: t.name, type: t.type, img: t.img, system: t.system }); continue; }
      // Синхронизируем описание/выжимку/авто-эффекты из библиотеки.
      const upd = { _id: ex.id };
      if ((ex.system.description || "") !== (t.system.description || "")) upd["system.description"] = t.system.description;
      if ((ex.system.benefit || "") !== (t.system.benefit || "")) upd["system.benefit"] = t.system.benefit;
      if (JSON.stringify(ex.system.effects || {}) !== JSON.stringify(t.system.effects || {})) upd["system.effects"] = t.system.effects;
      if (Object.keys(upd).length > 1) toUpdate.push(upd);
    }
    if (toAdd.length)    await Item.createDocuments(toAdd, { pack: pack.collection });
    if (toUpdate.length) await Item.updateDocuments(toUpdate, { pack: pack.collection });
    if (toAdd.length || toUpdate.length)
      console.log(`Warhammer DBC | Черты техники: добавлено ${toAdd.length}, обновлено ${toUpdate.length}.`);
  } catch(e) { console.error("Warhammer DBC | Библиотека черт техники:", e); }

  // ── Малые суда (МЛА) ──
  try {
    const pack = game.packs.get("warhammer-dbc.small-craft");
    if (!pack) throw new Error("Компендиум 'small-craft' не найден.");
    await _unlockPack(pack);
    const docs   = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, d]));
    const cache  = {};
    const toAdd = [], toUpdate = [];
    for (const c of SMALL_CRAFT) {
      const folderId = await _ensureWeaponFolder(pack, c.folder, cache);
      const ex = byName.get(c.name);
      if (!ex) { toAdd.push({ name: c.name, type: c.type, img: c.img, folder: folderId, system: c.system }); continue; }
      const upd = { _id: ex.id };
      if ((ex.folder?.id ?? null) !== folderId) upd.folder = folderId;
      for (const k of ["cr", "crAlt", "spd", "squadronSize", "craftKind", "props"])
        if (JSON.stringify(ex.system[k]) !== JSON.stringify(c.system[k])) upd[`system.${k}`] = c.system[k];
      if (Object.keys(upd).length > 1) toUpdate.push(upd);
    }
    if (toAdd.length)    await Item.createDocuments(toAdd, { pack: pack.collection });
    if (toUpdate.length) await Item.updateDocuments(toUpdate, { pack: pack.collection });
    if (toAdd.length || toUpdate.length)
      console.log(`Warhammer DBC | Малые суда: добавлено ${toAdd.length}, обновлено ${toUpdate.length}.`);
  } catch(e) { console.error("Warhammer DBC | Библиотека малых судов:", e); }

  // ── Псайкана (психосилы) ──
  try {
    const pack = game.packs.get("warhammer-dbc.psychic-powers");
    if (!pack) throw new Error("Компендиум 'psychic-powers' не найден.");
    await _unlockPack(pack);
    await _purgeMalformedFolders(pack);   // снести битые «А,Б» папки + их устаревшее содержимое
    const docs   = await pack.getDocuments();   // актуальный список (после чистки)
    const byName = new Map(docs.map(d => [d.name, d]));
    const cache  = {};
    const toAdd = [], toUpdate = [];
    // Поля, которые синхронизируем у существующих (чтобы правки доходили).
    const SYNC = ["cost", "prRequired", "testMod", "testChar", "action", "range", "powerType",
                  "sustainable", "damage", "damageType", "penetration", "effect",
                  "discipline", "subtype"];
    for (const p of PSYCHIC_POWERS_LIBRARY) {
      const folderId = await _ensureWeaponFolder(pack, p.folder, cache);
      const ex = byName.get(p.name);
      if (!ex) {
        toAdd.push({ name: p.name, type: p.type, img: p.img, folder: folderId, system: p.system });
        continue;
      }
      const upd = { _id: ex.id };
      if ((ex.folder?.id ?? null) !== folderId) upd.folder = folderId;
      for (const k of SYNC) {
        if ((ex.system?.[k] ?? "") !== (p.system[k] ?? "")) upd[`system.${k}`] = p.system[k];
      }
      if (Object.keys(upd).length > 1) toUpdate.push(upd);
    }
    if (toAdd.length)    await Item.createDocuments(toAdd, { pack: pack.collection });
    if (toUpdate.length) await Item.updateDocuments(toUpdate, { pack: pack.collection });
    await _purgeEmptyFolders(pack);       // вычистить оставшиеся пустые папки
    if (toAdd.length || toUpdate.length)
      console.log(`Warhammer DBC | Псайкана: добавлено ${toAdd.length}, обновлено ${toUpdate.length}.`);
  } catch(e) { console.error("Warhammer DBC | Библиотека Псайканы:", e); }

  // ── Техночудеса ──
  try {
    const pack = game.packs.get("warhammer-dbc.tech-powers");
    if (!pack) throw new Error("Компендиум 'tech-powers' не найден.");
    await _unlockPack(pack);
    const docs   = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, d]));
    const cache  = {};
    const toAdd = [], toUpdate = [];
    const SYNC = ["miracleType", "rating", "cognitionCost", "energyCost", "sustainCost",
                  "testSkill", "testMod", "action", "range", "damage", "damageType",
                  "penetration", "effect", "discipline", "subtype"];
    for (const p of TECH_POWERS_LIBRARY) {
      const folderId = await _ensureWeaponFolder(pack, p.folder, cache);
      const ex = byName.get(p.name);
      if (!ex) {
        toAdd.push({ name: p.name, type: p.type, img: p.img, folder: folderId, system: p.system });
        continue;
      }
      const upd = { _id: ex.id };
      if ((ex.folder?.id ?? null) !== folderId) upd.folder = folderId;
      for (const k of SYNC) {
        if ((ex.system?.[k] ?? "") !== (p.system[k] ?? "")) upd[`system.${k}`] = p.system[k];
      }
      if (Object.keys(upd).length > 1) toUpdate.push(upd);
    }
    if (toAdd.length)    await Item.createDocuments(toAdd, { pack: pack.collection });
    if (toUpdate.length) await Item.updateDocuments(toUpdate, { pack: pack.collection });
    if (toAdd.length || toUpdate.length)
      console.log(`Warhammer DBC | Техночудеса: добавлено ${toAdd.length}, обновлено ${toUpdate.length}.`);
  } catch(e) { console.error("Warhammer DBC | Библиотека Техночудес:", e); }

  // ── Миграция иконок: проставляем тематические SVG предметам с дефолтной картинкой ──
  try {
    const ICON_PACKS = ["weapons", "ammunition", "armor", "shields", "armor-mods",
      "weapon-mods", "traits", "talents", "implants", "psychic-powers", "tech-powers",
      "chemistry", "ship-components", "diseases", "armour-systems", "gear", "tools"];
    let total = 0;
    for (const pn of ICON_PACKS) {
      const pack = game.packs.get("warhammer-dbc." + pn);
      if (!pack) continue;
      await _unlockPack(pack);
      const docs = await pack.getDocuments();
      const upd = [];
      for (const d of docs) {
        if (!isManagedImg(d.img)) continue;            // не трогаем кастомные иконки
        const icon = itemIconFor(d.type, d.system);
        if (icon && icon !== d.img) upd.push({ _id: d.id, img: icon });
      }
      if (upd.length) { await Item.updateDocuments(upd, { pack: pack.collection }); total += upd.length; }
    }
    if (total) console.log(`Warhammer DBC | Иконки предметов: обновлено ${total}.`);
  } catch(e) { console.error("Warhammer DBC | Миграция иконок:", e); }

  ui.notifications?.info("Warhammer DBC: библиотеки синхронизированы.");
});

// ─── Автозаполнение компендиума «Техника» (Actor) ───────────────────────────
// Неразрушающе по имени. Орудия и черты резолвятся из библиотек-констант
// (VEHICLE_WEAPONS/VEHICLE_TRAITS) по EN-подстроке — детерминированно, без
// зависимости от порядка наполнения паков. Места (stations) создаются из crew,
// орудия привязываются к первому месту своей роли.
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  const pack = game.packs.get("warhammer-dbc.vehicles");
  if (!pack) { console.warn("Warhammer DBC | Компендиум 'vehicles' не найден."); return; }
  await _unlockPack(pack);

  const lc = (s) => (s || "").toLowerCase();
  // Резолв данных предмета по EN-подстроке имени «EN / RU».
  const resolveWeapon = (token) => {
    const t = lc(token);
    return VEHICLE_WEAPONS.find(w => lc(w.name) === t)
        || VEHICLE_WEAPONS.find(w => lc(w.name).includes(t));
  };
  const resolveTrait = (token) => {
    const t = lc(token);
    return VEHICLE_TRAITS.find(w => lc(w.name).includes(t));
  };

  // Один разъём = ОДНО орудие (стандартное, `w`) + список вариантов для свапа
  // в vehicleMount.options. Альтернативы НЕ ставятся отдельными стволами.
  const buildSlotWeapons = (v, firstByRole) => {
    const items = [];
    for (const wp of (v._weapons || [])) {
      const src = resolveWeapon(wp.w);
      if (!src) { console.warn(`Warhammer DBC | Техника «${v.name}»: орудие '${wp.w}' не найдено — пропущено.`); continue; }
      // Список опций — резолвнутые имена [w, ...alt] (только реально найденные).
      const options = [wp.w, ...(wp.alt || [])]
        .map(t => resolveWeapon(t)?.name).filter(Boolean);
      const obj = foundry.utils.deepClone(src);
      delete obj.folder;
      obj.system = obj.system || {};
      obj.system.vehicleMount = {
        isMounted: true,
        stationId: firstByRole[wp.role] || "",
        mount: wp.mount || "turret",
        hArc: wp.hArc || "", vArc: wp.vArc || "",
        standard: !!wp.std, reloads: 10,
        slotId: foundry.utils.randomID(),
        options
      };
      items.push(obj);
    }
    return items;
  };

  // Черты машины (копии из библиотеки или заглушки; рейтинг X — дефлектор и т.п.).
  const buildTraits = (v) => {
    const items = [];
    for (const traitSpec of (v._traits || [])) {
      const isObj  = typeof traitSpec !== "string";
      const tk     = isObj ? traitSpec.name : traitSpec;
      const r1 = isObj ? traitSpec.rating  : null;
      const r2 = isObj ? traitSpec.rating2 : null;
      const r3 = isObj ? traitSpec.rating3 : null;
      const applyRatings = (sys) => {
        if (r1 != null) { sys.hasRating  = true; sys.rating  = r1; }
        if (r2 != null) { sys.hasRating2 = true; sys.rating2 = r2; }
        if (r3 != null) { sys.hasRating3 = true; sys.rating3 = r3; }
        return sys;
      };
      const src = resolveTrait(tk);
      if (src) {
        const o = foundry.utils.deepClone(src); delete o.folder;
        o.system = applyRatings(o.system || {});
        items.push(o);
      } else {
        console.warn(`Warhammer DBC | Техника «${v.name}»: черта '${tk}' не найдена — вложена заглушка.`);
        items.push({ name: tk, type: "vehicleTrait", img: "systems/warhammer-dbc/assets/actor-icons/vehicle.svg",
                     system: applyRatings({}) });
      }
    }
    return items;
  };

  const buildStations = (v) => {
    const stations = [], firstByRole = {};
    for (const c of (v._crew || [])) {
      const role = typeof c === "string" ? c : c.role;
      const n    = typeof c === "string" ? 1 : (c.n || 1);
      for (let i = 0; i < n; i++) {
        const st = { id: foundry.utils.randomID(), role, uuid: "", name: "", img: "" };
        stations.push(st);
        if (!firstByRole[role]) firstByRole[role] = st.id;
      }
    }
    return { stations, firstByRole };
  };

  try {
    // 1) Папки-фракции (тип Actor).
    const folders = pack.folders?.contents ?? [];
    const idByName = {};
    for (const f of folders) idByName[f.name] = f.id;
    for (const fn of [...new Set(VEHICLE_LIBRARY.map(v => v.folder).filter(Boolean))]) {
      if (idByName[fn]) continue;
      const [cf] = await Folder.createDocuments([{ name: fn, type: "Actor", sorting: "m" }], { pack: pack.collection });
      idByName[fn] = cf.id;
    }

    const docs      = await pack.getDocuments();
    const byName    = new Map(docs.map(d => [d.name, d]));
    const toAdd     = [];
    let migrated    = 0;

    for (const v of VEHICLE_LIBRARY) {
      const actor = byName.get(v.name);

      // ── Уже существует: миграция папки + орудий к актуальной библиотеке ──
      if (actor) {
        let changed = false;
        // Папка: приводим к библиотечной (напр. разделение Хаос ↔ Демонические Машины).
        const wantFolder = idByName[v.folder] ?? null;
        if ((actor.folder?.id ?? null) !== wantFolder) {
          await _unlockPack(pack);
          await actor.update({ folder: wantFolder });
          changed = true;
        }
        const weps = actor.items.filter(i => i.type === "weapon");
        const needs = weps.some(w => !(w.system?.vehicleMount?.options?.length));
        if (needs) {
          const firstByRole = {};
          for (const s of (actor.system.stations || [])) if (!firstByRole[s.role]) firstByRole[s.role] = s.id;
          const newWeapons = buildSlotWeapons(v, firstByRole);
          await _unlockPack(pack);
          if (weps.length) await actor.deleteEmbeddedDocuments("Item", weps.map(w => w.id));
          if (newWeapons.length) await actor.createEmbeddedDocuments("Item", newWeapons);
          changed = true;
        }
        if (changed) migrated++;
        continue;
      }

      // ── Новой машины нет: создаём (места + орудия + черты) ──
      const { stations, firstByRole } = buildStations(v);
      const items = [...buildSlotWeapons(v, firstByRole), ...buildTraits(v)];
      toAdd.push({
        name: v.name, type: "vehicle",
        img: "systems/warhammer-dbc/assets/actor-icons/vehicle.svg",
        folder: idByName[v.folder] ?? null,
        system: { ...v.system, stations },
        items
      });
    }

    if (toAdd.length) {
      await _unlockPack(pack);
      await Actor.createDocuments(toAdd, { pack: pack.collection });
    }
    if (toAdd.length || migrated) {
      console.log(`Warhammer DBC | Техника: добавлено ${toAdd.length}, мигрировано орудий у ${migrated} машин.`);
      ui.notifications?.info(`Warhammer DBC: техника — добавлено ${toAdd.length}, обновлено ${migrated}.`);
    }
  } catch(e) { console.error("Warhammer DBC | Не удалось заполнить «Технику»:", e); }
});

// ─── Автозаполнение Бестиария (Actor-компендиум) ────────────────────────────
// Неразрушающе по имени. Снаряжение/способности (kit) резолвятся из уже
// существующих компендиумов по гибкому совпадению имени (RU/EN токены) и
// вкладываются копиями в актора. Отсутствующее пропускается с предупреждением.
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  const pack = game.packs.get("warhammer-dbc.bestiary");
  if (!pack) { console.warn("Warhammer DBC | Компендиум 'bestiary' не найден."); return; }
  await _unlockPack(pack);

  // Кэш документов исходных компендиумов (для резолва снаряжения).
  const _packCache = {};
  const _getPackDocs = async (key) => {
    if (_packCache[key]) return _packCache[key];
    const p = game.packs.get(`warhammer-dbc.${key}`);
    _packCache[key] = p ? await p.getDocuments() : [];
    if (!p) console.warn(`Warhammer DBC | Бестиарий: компендиум '${key}' не найден.`);
    return _packCache[key];
  };

  // Гибкий поиск: точное (ci) → подстрока (ci) → пустой токен = первый в паке.
  const _resolve = (docs, tokens) => {
    const lc = (s) => (s || "").toLowerCase();
    for (const tk of tokens) { const t = lc(tk); if (!t) continue;
      const h = docs.find(d => lc(d.name) === t); if (h) return h; }
    for (const tk of tokens) { const t = lc(tk); if (!t) continue;
      const h = docs.find(d => lc(d.name).includes(t)); if (h) return h; }
    if (tokens.some(t => t === "")) return docs[0] ?? null;
    return null;
  };

  // Собирает массив вложенных предметов актора из его kit.
  const _buildItems = async (actorName, kit) => {
    const items = [];
    for (const entry of (kit || [])) {
      if (entry.inline) { items.push(foundry.utils.deepClone(entry.inline)); continue; }
      const docs = await _getPackDocs(entry.pack);
      const hit  = _resolve(docs, entry.q || []);
      if (!hit) {
        console.warn(`Warhammer DBC | Бестиарий: для «${actorName}» не найден предмет `
                   + `[${entry.pack}] по токенам ${JSON.stringify(entry.q)} — пропущено.`);
        continue;
      }
      const obj = hit.toObject();
      delete obj._id; delete obj.folder; delete obj.ownership;
      obj.system = obj.system || {};
      if (entry.equipped !== undefined && "equipped" in obj.system) obj.system.equipped = entry.equipped;
      if (entry.stacks !== undefined && "stacks" in obj.system) obj.system.stacks = entry.stacks;
      if (entry.qty !== undefined && "quantity" in obj.system) obj.system.quantity = entry.qty;
      items.push(obj);
    }
    return items;
  };

  try {
    // 1) Папки (тип Actor): родитель + листья по составному ключу «Родитель/Лист».
    const folders = pack.folders?.contents ?? [];
    const byId    = new Map(folders.map(f => [f.id, f]));
    const parentName = (f) => {
      const p = (typeof f.folder === "string") ? byId.get(f.folder) : f.folder;
      return p?.name ?? null;
    };
    const idByKey = {};
    for (const f of folders) {
      const pn = parentName(f);
      idByKey[pn ? `${pn}/${f.name}` : f.name] = f.id;
    }
    const parents = [...new Set(BESTIARY_LIBRARY.map(d => d.folderParent).filter(Boolean))];
    for (const pn of parents) {
      if (idByKey[pn]) continue;
      await _unlockPack(pack);
      const [cf] = await Folder.createDocuments([{ name: pn, type: "Actor", sorting: "m" }], { pack: pack.collection });
      idByKey[pn] = cf.id; byId.set(cf.id, cf);
    }
    const keyFor = (d) => d.folderParent ? `${d.folderParent}/${d.folder}` : d.folder;
    for (const key of [...new Set(BESTIARY_LIBRARY.map(keyFor))]) {
      if (!key || idByKey[key]) continue;
      const d = BESTIARY_LIBRARY.find(x => keyFor(x) === key);
      await _unlockPack(pack);
      const data = { name: d.folder, type: "Actor", sorting: "m" };
      if (d.folderParent) data.folder = idByKey[d.folderParent];
      const [cf] = await Folder.createDocuments([data], { pack: pack.collection });
      idByKey[key] = cf.id;
    }

    // 2) Неразрушающе добавляем недостающих акторов (по имени).
    const index    = await pack.getIndex();
    const existing = new Set(index.map(e => e.name));
    const toAdd    = [];
    for (const d of BESTIARY_LIBRARY) {
      if (existing.has(d.name)) continue;
      const items = await _buildItems(d.name, d.kit);
      toAdd.push({
        name: d.name, type: d.type ?? "character", img: d.img ?? "icons/svg/mystery-man.svg",
        folder: idByKey[keyFor(d)] ?? null, system: d.system, items,
        prototypeToken: d.prototypeToken
      });
    }
    if (toAdd.length) {
      await _unlockPack(pack);
      await Actor.createDocuments(toAdd, { pack: pack.collection });
      console.log(`Warhammer DBC | Бестиарий: добавлено ${toAdd.length} акт.`);
      ui.notifications?.info(`Warhammer DBC: в бестиарий добавлено ${toAdd.length} существ.`);
    }

    // 3) Миграция уже засеянных акторов: синхронизируем класс/тип встроенного
    //    оружия с эталоном по имени (напр. исправляем осколочное/тёмносветовое
    //    Друкхари, если копии были вложены со старым weaponType). Источник —
    //    сами библиотеки оружия (детерминированно, без зависимости от того,
    //    успел ли отработать хук наполнения компендиума «Оружие»).
    const wByName = new Map(
      [...AELDARI_WEAPONS, ...MECHADENDRITE_WEAPONS].map(w => [w.name, w.system]));
    const allActors = await pack.getDocuments();
    for (const actor of allActors) {
      const embUpd = [];
      for (const it of actor.items) {
        if (it.type !== "weapon") continue;
        const src = wByName.get(it.name);
        if (!src) continue;
        const u = { _id: it.id };
        if ((it.system?.weaponType  ?? "") !== (src.weaponType  ?? "")) u["system.weaponType"]  = src.weaponType;
        if ((it.system?.weaponClass ?? "") !== (src.weaponClass ?? "")) u["system.weaponClass"] = src.weaponClass;
        if (Object.keys(u).length > 1) embUpd.push(u);
      }
      if (embUpd.length) {
        await _unlockPack(pack);
        await actor.updateEmbeddedDocuments("Item", embUpd);
      }
    }
  } catch(e) {
    console.error("Warhammer DBC | Не удалось заполнить бестиарий:", e);
  }
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

/** Ссылка на боевой профиль по имени предмета — прямо из библиотеки. */
function _twinLinkByName(name) {
  if (!_twinByName) {
    _twinByName = new Map();
    for (const d of [...GEAR_LIBRARY, ...TOOLS_LIBRARY, ...IMPLANT_LIBRARY]) {
      const w = d.system?.linkedWeapon;
      if (w) _twinByName.set(d.name, w);
    }
  }
  return _twinByName.get(name) || "";
}
let _twinByName = null;

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
Hooks.on("createItem", async (item, options, userId) => {
  if (game.user.id !== userId) return;
  const actor = item.parent;
  if (!(actor instanceof Actor)) return;
  await runAutoScripts(item);
  await applyItemMechanics(item);
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

Hooks.on("createItem", async (item, options, userId) => {
  if (game.user.id !== userId) return;
  const actor = item.parent;
  if (!(actor instanceof Actor)) return;
  // Ссылку берём из предмета, а если её там нет — из библиотеки по имени.
  // Компендиум мог быть засеян до появления поля, и полагаться только на
  // него нельзя: пара просто молча не создавалась бы.
  const link = item.system?.linkedWeapon || _twinLinkByName(item.name);
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
