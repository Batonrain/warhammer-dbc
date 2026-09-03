import { CHASSIS_TYPES, CHASSIS_NOTES, VEHICLE_TYPES, CREW_ROLES,
         MOUNT_TYPES, MOUNT_NOTES, ARMOUR_SIDES,
         VEHICLE_HIT_LOCATIONS, VEHICLE_AIM_TARGETS,
         CREW_ACTIONS, VEHICLE_CRITS, VEHICLE_CRIT_LABEL,
         VEHICLE_BREAKAGES, VEHICLE_STATUS_EFFECTS,
         REPAIR_CONDITIONS, REPAIR_REQUIREMENTS, REQUISITION_NOTES } from "../constants/vehicle.mjs";
import { _executeAttackRoll } from "../combat/attack.mjs";
import { showRamDialog, showTerrainDialog, showRepairDialog, showVoidShieldRepairDialog,
         showOrbitalDeployTurn1, showOrbitalDeployTurn2, showFireDetonationDialog,
         showFallBreaksDialog, showDisembarkDialog, resolveVolleyAction } from "../combat/vehicle.mjs";
import { isTargetWithinVehicleArc } from "../combat/facing.mjs";
import { measureTokens } from "../combat/tactical-map.mjs";
import { rangeBandKey } from "../rules/tactical-map.mjs";
import { vehicleWeaponProfile } from "../constants/vehicle-weapons-library.mjs";
import { esc } from "../helpers/utils.mjs";
import { openContextMenu, itemContextEntries } from "./context-menu.mjs";
import { whenEditable, onTab, filePicker } from "./v2-helpers.mjs";
import { activateFactionFieldListeners } from "../apps/actor-factions.mjs";
import { WarhammerStructuralSheet } from "./structural-sheet.mjs";

const ROLE_ORDER = ["commander", "driver", "gunner", "loader", "pilot", "passenger"];

// ── Действия листа ───────────────────────────────────────────────────────────
// Тот же приём, что на листе Орды (wdbc-ff4.10.1): ApplicationV2 зовёт
// обработчик [data-action] с this = лист и элементом-источником вторым
// аргументом. Обычные функции — чтобы карта действий сверялась с шаблоном тестом.
// Общая обвязка (whenEditable, onTab, filePicker) — в v2-helpers.mjs.

const itemIdOf = target => target.closest("[data-item-id]")?.dataset.itemId;
// Портрет: в V1 клик по data-edit="img" обрабатывал ActorSheet сам, у V2 такого
// обработчика нет — нужен свой (wdbc-bg0).
function onPortrait() {
  const FP = filePicker();
  return new FP({
    type: "image", current: this.actor.img || "",
    callback: path => this.actor.update({ img: path })
  }).render(true);
}

function onStationOpen(event, target) {
  const uuid = target.closest("[data-uuid]")?.dataset.uuid;
  if (!uuid) return;
  return fromUuid(uuid).then(doc => (doc?.actor ?? doc)?.sheet?.render(true));
}

async function onStationClear(event, target) {
  const id = target.closest("[data-station-id]")?.dataset.stationId;
  const stations = foundry.utils.deepClone(this.actor.system.stations || []);
  const s = stations.find(x => x.id === id);
  if (!s) return;
  // Владелец техники освобождает любое место, игрок — только своё.
  if (!this.actor.isOwner) {
    const occ = s.uuid ? await fromUuid(s.uuid) : null;
    const occActor = occ?.actor ?? occ;
    if (!occActor?.isOwner) return ui.notifications.warn("Освободить можно только своё место.");
  }
  s.uuid = ""; s.name = ""; s.img = "";
  await this._persistStations(stations);
}

async function onStationsAdd() {
  const form = this.element;
  const role  = form.querySelector(".veh-add-role")?.value || "gunner";
  const count = Math.max(1, Math.min(20, parseInt(form.querySelector(".veh-add-count")?.value) || 1));
  const stations = foundry.utils.deepClone(this.actor.system.stations || []);
  for (let i = 0; i < count; i++)
    stations.push({ id: foundry.utils.randomID(), role, uuid: "", name: "", img: "" });
  await this.actor.update({ "system.stations": stations });
}

async function onStationRemove(event, target) {
  const id = target.closest("[data-station-id]")?.dataset.stationId;
  const stations = (this.actor.system.stations || []).filter(s => s.id !== id);
  // Отвяжем орудия, привязанные к удалённому месту.
  const upd = this.actor.items.filter(i => i.type === "weapon" && i.system.vehicleMount?.stationId === id)
    .map(i => ({ _id: i.id, "system.vehicleMount.stationId": "" }));
  await this.actor.update({ "system.stations": stations });
  if (upd.length) await this.actor.updateEmbeddedDocuments("Item", upd);
}

/** Создать вложенный предмет и открыть его лист. */
const creator = data => async function () {
  const [it] = await this.actor.createEmbeddedDocuments("Item", [data]);
  it?.sheet.render(true);
};

function onItemOpen(event, target) { this.actor.items.get(itemIdOf(target))?.sheet.render(true); }
function onItemDelete(event, target) { return this.actor.items.get(itemIdOf(target))?.delete(); }
function onFireWeapon(event, target) {
  const it = this.actor.items.get(itemIdOf(target));
  if (it) return this._showVehicleFireDialog(it);
}
function onVolley(event, target) {
  const stationId = target.closest("[data-station-id]")?.dataset.stationId;
  if (stationId) return this._showVolleyDialog(stationId);
}
function onReloadWeapon(event, target) {
  const it = this.actor.items.get(itemIdOf(target));
  if (it) return this._reloadVehicleWeapon(it);
}

function onRam()     { return showRamDialog(this.actor); }
function onTerrain() { return showTerrainDialog(this.actor); }
function onRepair()  { return showRepairDialog(this.actor); }
function onVoidShieldRepair() { return showVoidShieldRepairDialog(this.actor); }
function onOrbitalDeployTurn1() { return showOrbitalDeployTurn1(this.actor); }
function onOrbitalDeployTurn2() { return showOrbitalDeployTurn2(this.actor); }
function onFireDetonation()     { return showFireDetonationDialog(this.actor); }
function onFallBreaks()         { return showFallBreaksDialog(this.actor); }
function onDisembark()          { return showDisembarkDialog(this.actor); }

async function onStateAdd() {
  const val = this.element.querySelector(".veh-state-select")?.value;
  if (!val) return;
  const [kind, idxStr] = String(val).split(":");
  const src = kind === "breakage" ? VEHICLE_BREAKAGES[parseInt(idxStr)] : VEHICLE_STATUS_EFFECTS[parseInt(idxStr)];
  if (!src) return;
  const states = foundry.utils.deepClone(this.actor.system.damageStates || []);
  states.push({ id: foundry.utils.randomID(), kind, label: src.name, note: src.text });
  await this.actor.update({ "system.damageStates": states });
}

async function onStateDel(event, target) {
  const id = target.closest("[data-state-id]")?.dataset.stateId;
  const states = (this.actor.system.damageStates || []).filter(s => s.id !== id);
  await this.actor.update({ "system.damageStates": states });
}

export class WarhammerVehicleSheet extends WarhammerStructuralSheet {

  static DEFAULT_OPTIONS = {
    // vehicle-sheet — на самой форме листа: CSS цепляется за
    // «.warhammer-dbc.vehicle-sheet», а у V1 этот класс нёс <form> в шаблоне.
    classes: ["warhammer-dbc", "sheet", "actor", "vehicle", "wh-holo", "vehicle-sheet"],
    position: { width: 800, height: 780 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      // Открыть лист сидящего и освободить место доступны и игроку-не-владельцу:
      // права проверяются внутри, чтобы он мог выйти из чужой техники.
      tab: onTab,
      portrait:     whenEditable(onPortrait),
      stationOpen:  onStationOpen,
      stationClear: onStationClear,
      stationsAdd:    whenEditable(onStationsAdd),
      stationRemove:  whenEditable(onStationRemove),
      createWeapon:   whenEditable(creator({ name: "Новое орудие", type: "weapon",
                        system: { weaponClass: "heavy", vehicleMount: { isMounted: true } } })),
      createGear:     whenEditable(creator({ name: "Новое снаряжение", type: "vehicleGear",
                        img: "systems/warhammer-dbc/assets/actor-icons/vehicle.svg" })),
      createTrait:    whenEditable(creator({ name: "Новая черта", type: "vehicleTrait",
                        img: "systems/warhammer-dbc/assets/actor-icons/vehicle.svg" })),
      itemOpen:       whenEditable(onItemOpen),
      itemDelete:     whenEditable(onItemDelete),
      fireWeapon:     whenEditable(onFireWeapon),
      volley:         whenEditable(onVolley),
      reloadWeapon:   whenEditable(onReloadWeapon),
      ram:            whenEditable(onRam),
      terrain:        whenEditable(onTerrain),
      repair:         whenEditable(onRepair),
      voidShieldRepair: whenEditable(onVoidShieldRepair),
      orbitalDeployTurn1: whenEditable(onOrbitalDeployTurn1),
      orbitalDeployTurn2: whenEditable(onOrbitalDeployTurn2),
      fireDetonation:     whenEditable(onFireDetonation),
      fallBreaks:         whenEditable(onFallBreaks),
      disembark:          whenEditable(onDisembark),
      stateAdd:       whenEditable(onStateAdd),
      stateDel:       whenEditable(onStateDel)
    }
  };

  static PARTS = {
    body: { template: "systems/warhammer-dbc/templates/actor/vehicle-sheet.hbs", root: true }
  };

  static TABS = {
    primary: {
      initial: "overview",
      tabs: [
        { id: "overview", label: "Обзор",        icon: "fas fa-gauge-high" },
        { id: "crew",     label: "Экипаж",       icon: "fas fa-users" },
        { id: "combat",   label: "Бой",          icon: "fas fa-crosshairs" },
        { id: "damage",   label: "Повреждения",  icon: "fas fa-car-burst" },
        { id: "notes",    label: "Записи",       icon: "fas fa-file-lines" }
      ]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.actor.system;

    // ── Заметки: prose-mirror с переключаемым режимом (как у Journal Entries).
    context.notesEnriched   = await this._enrich(sys.notes);
    context.gmNotesEnriched = await this._enrich(sys.gmNotes);

    context.chassisTypes  = CHASSIS_TYPES;
    context.chassisNote   = CHASSIS_NOTES[sys.chassis?.type] || "";
    context.vehicleTypes  = VEHICLE_TYPES;
    context.armourSides   = ARMOUR_SIDES;
    context.crewRoles     = CREW_ROLES;
    context.mountTypes    = MOUNT_TYPES;
    context.hitLocations  = VEHICLE_HIT_LOCATIONS;
    context.crewActions   = CREW_ACTIONS;
    context.isWalker      = sys.chassis?.type === "walker";
    // Максимум Структуры: производный (с +X Коляски) показывать нельзя как
    // value инпута — submitOnChange отправил бы раздутое число в БД, и
    // следующий пересчёт прибавил бы X снова (6 → 9 → 12 за пару кликов).
    // _source?. — у настоящего актора он есть всегда; заглушки тестов листа
    // без него падают на производное значение, что для них и верно.
    context.structureMaxBase = this.actor._source?.system?.structure?.max ?? sys.structure?.max ?? 0;

    // Шкала Структуры (для когитаторного индикатора в шапке).
    const _st = sys.structure || {};
    const _smax = Number(_st.max) || 0, _sval = Number(_st.value) || 0;
    context.structPct   = _smax > 0 ? Math.max(0, Math.min(100, Math.round(_sval / _smax * 100))) : 0;
    context.structLevel = _smax <= 0 ? "na"
                        : _sval <= 0 ? "dead"
                        : context.structPct <= 33 ? "crit"
                        : context.structPct <= 66 ? "warn" : "ok";
    context.structStatus = { na: "НЕ ЗАДАНА", dead: "УНИЧТОЖЕНА", crit: "КРИТИЧЕСКОЕ",
                             warn: "ПОВРЕЖДЕНА", ok: "В НОРМЕ" }[context.structLevel];
    // Щит-дефлектор (Atomantic Shielding / Daemonic Possession).
    context.deflector         = Number(sys.derived?.deflector) || 0;
    context.deflectorDaemonic = !!sys.derived?.deflectorDaemonic;
    // Автопилот (Autonomous): BS/Operate/Awareness для стрельбы/управления без экипажа.
    context.autonomous = sys.derived?.autonomous
      ? { bs: sys.derived.autonomousBS, operate: sys.derived.autonomousOperate, aware: sys.derived.autonomousAwareness }
      : null;
    context.flickerfield = !!sys.derived?.flickerfield;
    // Пустотные Щиты (X): по щиту на элемент массива, каждый максимум 20 (wdbc-y33b).
    context.voidShields = (Array.isArray(sys.voidShields) ? sys.voidShields : []).map((hp, i) => ({
      index: i, hp: Number(hp) || 0, collapsed: !(Number(hp) > 0)
    }));

    // Справочник повреждений: крит-таблицы по частям, поломки, эффекты.
    context.critTables = Object.entries(VEHICLE_CRITS).map(([key, rows]) => ({
      key, label: VEHICLE_CRIT_LABEL[key] || key,
      rows: rows.map((text, i) => ({ level: i + 1, isMax: i === rows.length - 1, text }))
    }));
    context.breakages     = VEHICLE_BREAKAGES;
    context.statusEffects = VEHICLE_STATUS_EFFECTS;
    context.repairConditions   = REPAIR_CONDITIONS;
    context.repairRequirements = REPAIR_REQUIREMENTS;
    context.requisitionNotes   = REQUISITION_NOTES;

    // ── Живой трекер состояний машины (активные поломки/эффекты) ──
    context.damageStates = Array.isArray(sys.damageStates) ? sys.damageStates : [];
    // Опции для добавления состояния: поломки + особые эффекты одним списком.
    context.stateOptions = [
      ...VEHICLE_BREAKAGES.map((b, i)     => ({ value: `breakage:${i}`, label: `Поломка: ${b.name}` })),
      ...VEHICLE_STATUS_EFFECTS.map((s, i) => ({ value: `effect:${i}`,   label: `Эффект: ${s.name}` }))
    ];

    // ── Экипаж: сначала МЕСТА (станции), потом занятие их персонажами ──
    // Метки нумеруются по роли (Стрелок-1, Стрелок-2), если мест этой роли > 1.
    const rawStations = Array.isArray(sys.stations) ? sys.stations : [];
    const perRoleTotal = {};
    rawStations.forEach(s => { perRoleTotal[s.role] = (perRoleTotal[s.role] || 0) + 1; });
    const perRoleSeen = {};
    const labelById = {};
    const stations = rawStations.map(s => {
      perRoleSeen[s.role] = (perRoleSeen[s.role] || 0) + 1;
      const base  = CREW_ROLES[s.role] || s.role;
      const label = perRoleTotal[s.role] > 1 ? `${base}-${perRoleSeen[s.role]}` : base;
      labelById[s.id] = label;
      let doc = null;
      if (s.uuid) { try { doc = fromUuidSync(s.uuid); } catch (e) { doc = null; } }
      const actor = doc?.actor ?? doc;
      return {
        id: s.id, role: s.role, roleLabel: base, label,
        uuid: s.uuid || "", occupied: !!s.uuid,
        name: actor?.name || s.name || (s.uuid ? "(недоступен)" : ""),
        img:  actor?.img  || s.img  || "icons/svg/mystery-man.svg",
        bs:   actor?.system?.characteristics?.bs?.total ?? null,
        missing: !!s.uuid && !actor
      };
    }).sort((a, b) =>
      (ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)) ||
      a.label.localeCompare(b.label, undefined, { numeric: true }));
    context.stations = stations;
    // Места-операторы для привязки орудий (все, кроме пассажиров).
    context.weaponStations = stations
      .filter(s => s.role !== "passenger")
      .map(s => ({ id: s.id, label: s.label + (s.occupied ? ` — ${s.name}` : " (пусто)") }));

    // Снаряжение техники (Item type=vehicleGear).
    const RARITY = { "-5": "Повсеместно", "-4": "Распространено", "-3": "Изобильно", "-2": "Обычно",
                     "-1": "Средне", "0": "Дефицит", "1": "Редко", "2": "Очень редко",
                     "3": "Чрезвычайно редко", "4": "Почти уникально", "5": "Уникально" };
    // Черты техники (Item type=vehicleTrait).
    context.vehTraits = this.actor.items
      .filter(i => i.type === "vehicleTrait")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(i => {
        const s = i.system;
        const parts = [];
        if (s.hasRating)  parts.push(s.rating);
        if (s.hasRating2) parts.push(s.rating2);
        if (s.hasRating3) parts.push(s.rating3);
        return {
          id: i.id, name: i.name, img: i.img,
          rating: parts.length ? `(${parts.join("/")})` : "",
          benefit: s.benefit || "", description: s.description || ""
        };
      });

    context.equipment = this.actor.items
      .filter(i => i.type === "vehicleGear")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(i => ({
        id: i.id, name: i.name, img: i.img,
        active: i.system.active !== false,
        rarity: `R ${(Number(i.system.availability) || 0) > 0 ? "+" : ""}${Number(i.system.availability) || 0}`,
        rarityLabel: RARITY[String(Number(i.system.availability) || 0)] || "",
        description: i.system.description || ""
      }));

    // ── Орудия: Item type=weapon с данными установки ──
    context.weapons = this.actor.items
      .filter(i => i.type === "weapon")
      .map(i => {
        const s  = i.system;
        const vm = s.vehicleMount || {};
        const isMelee = s.weaponClass === "melee" || s.weaponClass === "thrown";
        return {
          id: i.id, name: i.name, img: i.img,
          isMelee,
          damage: s.damage || "—",
          pen: s.penetration || 0,
          range: s.range || 0,
          mag: `${s.magazineCur ?? 0}/${s.magazineMax ?? 0}`,
          rof: `${s.rof_single ?? 0}/${s.rof_semi ?? 0}/${s.rof_full ?? 0}`,
          stationId: vm.stationId || "",
          stationLabel: vm.stationId ? (labelById[vm.stationId] || "—") : "—",
          mount:    vm.mount || "turret",
          mountLabel: MOUNT_TYPES[vm.mount] || vm.mount || "",
          mountNote:  MOUNT_NOTES[vm.mount] || "",
          hArc: vm.hArc || "",
          vArc: vm.vArc || "",
          standard: !!vm.standard,
          reloads:  vm.reloads ?? 10,
          // Варианты орудия для этого разъёма (свап на месте).
          options:   (vm.options || []).map(n => ({ name: n, sel: n === i.name })),
          hasOptions:(vm.options || []).length > 1
        };
      });

    // Залп (Мультиприцел/Продвинутые Прицельные Системы, wdbc-y33b): по
    // станции — если на ней ≥1 орудие и есть занявший её оператор (у него, не
    // у машины, есть ОД, которые Залп тратит одним куском на всю станцию).
    context.volleyStations = sys.derived?.traitFlags?.advancedTargeting
      ? context.stations
          .filter(s => s.occupied && context.weapons.some(w => w.stationId === s.id))
          .map(s => ({ id: s.id, label: s.label, name: s.name,
                       weaponCount: context.weapons.filter(w => w.stationId === s.id).length }))
      : [];

    return context;
  }

  // Разрешаем drop всем (в т.ч. игрокам-не-владельцам техники), чтобы игрок мог
  // сам сесть в транспорт. Права проверяются в обработчиках дропа.
  _canDragDrop(_selector) { return true; }

  // Токен с холста может приходить как type:"Token" — маршрутизируем его (и Actor)
  // в посадку экипажа. Прочее (предметы и т.п.) — базовому обработчику.
  async _onDrop(event) { return this._dispatchActorOrItemDrop(event); }

  /** Предметы на технику может класть только владелец техники. */
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) {
      ui.notifications.warn("Добавлять снаряжение/орудия на технику может только её владелец или ГМ.");
      return false;
    }
    return super._onDropItem(event, data);
  }

  /**
   * Сохранить массив мест. Владелец техники — напрямую; иначе (игрок сажает
   * своего персонажа в чужую технику) — запрос к активному ГМу по сокету.
   */
  async _persistStations(stations) {
    return this._persistOrRelay({ "system.stations": stations },
      { action: "vehicleStations", vehicleUuid: this.actor.uuid, stations },
      "Нужен активный ГМ на сессии, чтобы занять место в чужой технике.");
  }

  /** Перетаскивание актора на лист → посадить его в конкретное (или первое свободное) место. */
  async _onDropActor(event, data) {
    const resolved = await this._resolveDroppedActor(data);
    if (!resolved) return false;
    const { uuid, actor } = resolved;

    // Игрок без прав на технику может сажать только своего персонажа.
    if (!this.actor.isOwner && !actor.isOwner) {
      ui.notifications.warn("В чужую технику можно посадить только своего персонажа.");
      return false;
    }

    const stations = foundry.utils.deepClone(this.actor.system.stations || []);
    if (!stations.length) {
      ui.notifications.warn("В машине ещё нет мест — их создаёт владелец техники/ГМ (вкладка «Экипаж»).");
      return false;
    }

    // Место под курсором (если бросили прямо на строку места), иначе первое свободное.
    const seatEl = event.target?.closest?.("[data-station-id]");
    let target = seatEl ? stations.find(s => s.id === seatEl.dataset.stationId) : null;
    if (!target) target = stations.find(s => !s.uuid);
    if (!target) {
      ui.notifications.warn("Все места заняты — добавьте новое место или освободите одно.");
      return false;
    }

    // Уберём этого персонажа с прежнего места (нельзя сидеть на двух сразу).
    for (const s of stations) if (s.uuid === uuid) { s.uuid = ""; s.name = ""; s.img = ""; }

    target.uuid = uuid; target.name = actor.name; target.img = actor.img;
    const ok = await this._persistStations(stations);
    if (ok) ui.notifications.info(`${actor.name} занял место в «${this.actor.name}».`);
    return ok;
  }

  /**
   * Здесь остаётся только то, что действиями [data-action] не выражается:
   * события change, ПКМ по строке орудия и Drag&Drop. Клики живут в actions.
   */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    if (!el) return;
    // Поле «Фракция» в шапке — общее для всех листов.
    activateFactionFieldListeners(el, this.actor);

    // Drop привязываем всегда, а не только на редактируемом листе: игрок-не-
    // владелец должен уметь перетащить своего персонажа в чужой транспорт
    // (запись идёт через активного ГМа по сокету, см. _persistStations).
    this._bindManualDragDrop(el, "vehicle");

    if (!this.isEditable) return;

    // Свап орудия на разъёме: подменяем профиль выбранным вариантом из
    // компендиума «Орудия техники», сохраняя данные установки (место/углы/опции).
    el.querySelectorAll(".veh-weapon-swap").forEach(sel => sel.addEventListener("change", async ev => {
      const item = this.actor.items.get(itemIdOf(ev.currentTarget));
      const name = ev.currentTarget.value;
      if (!item || item.name === name) return;
      const src = vehicleWeaponProfile(name);
      if (!src) return ui.notifications.warn(`Профиль «${name}» не найден в библиотеке орудий техники.`);
      const sys = foundry.utils.deepClone(src.system);
      sys.vehicleMount = foundry.utils.deepClone(item.system.vehicleMount || {}); // разъём/опции/место/углы/БК
      await item.update({ name: src.name, img: src.img, system: sys });
    }));

    // Inline-редакторы установки орудия.
    el.querySelectorAll(".veh-mount-field").forEach(f => f.addEventListener("change", ev => {
      const t = ev.currentTarget;
      const val = t.type === "checkbox" ? t.checked
                : t.type === "number"   ? Math.max(0, parseInt(t.value) || 0)
                : t.value;
      const id = itemIdOf(t);
      if (id) this.actor.items.get(id)?.update({ [`system.vehicleMount.${t.dataset.field}`]: val });
    }));

    el.querySelectorAll(".veh-gear-toggle").forEach(c => c.addEventListener("change", ev => {
      this.actor.items.get(itemIdOf(ev.currentTarget))
        ?.update({ "system.active": ev.currentTarget.checked });
    }));

    // Продвинутые Системы Управления: сброс "уже двигалась в этот Раунд"
    // вручную (тот же приём, что fallBreaksUsed без своего тумблера — здесь
    // сброс нужен каждый Раунд, а не раз за бой, поэтому тумблер есть).
    el.querySelectorAll(".veh-flag-toggle").forEach(c => c.addEventListener("change", ev => {
      const t = ev.currentTarget;
      if (t.dataset.flag) this.actor.update({ [`system.${t.dataset.flag}`]: t.checked });
    }));

    // ПКМ по строке орудия — то же меню, что у прочих строк предметов. Своя
    // копия здесь удаляла орудие молча, без вопроса (wdbc-9z9 чинил только
    // общий обработчик).
    el.querySelectorAll(".veh-weapon-row").forEach(row => row.addEventListener("contextmenu", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const item = this.actor.items.get(itemIdOf(ev.currentTarget));
      if (!item) return;
      openContextMenu(ev, itemContextEntries(item));
    }));
  }


  // Перезарядка орудия техники из его боекомплекта (vehicleMount.reloads).
  async _reloadVehicleWeapon(item) {
    const s      = item.system;
    const vm     = s.vehicleMount || {};
    const magMax = Number(s.magazineMax) || 0;
    const magCur = Number(s.magazineCur) || 0;
    const reloads = Number(vm.reloads) || 0;

    if (magMax <= 0) return ui.notifications.info(`${item.name}: у орудия не задан магазин (Магазин макс.).`);
    if (magCur >= magMax) return ui.notifications.info(`${item.name}: магазин уже полон (${magCur}/${magMax}).`);
    if (reloads <= 0) return ui.notifications.warn(`${item.name}: боекомплект пуст — нечем перезаряжать.`);

    await item.update({ "system.magazineCur": magMax, "system.vehicleMount.reloads": reloads - 1 });
    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">🔄 Перезарядка — ${esc(item.name)}</div>
        <div class="roll-outcome"><span class="roll-success">Магазин <b>${magMax}/${magMax}</b> · Боекомплект осталось: <b>${reloads - 1}</b></span></div>
        ${reloads - 1 === 0 ? `<div class="roll-allout-note">Боекомплект этого орудия исчерпан — перезарядка возможна только снаружи/в снабжении.</div>` : ""}
      </div>`
    }, rollMode));
  }

  // Компактный диалог стрельбы из орудия техники (переиспользует движок атаки).
  // aimBonus — только из Залпа (wdbc-y33b): первое орудие станции получает
  // преимущество Прицеливания, здесь — предзаполненный +10 в "Доп. мод.".
  _showVehicleFireDialog(item, { aimBonus = 0 } = {}) {
    const sys = item.system;
    const vm  = sys.vehicleMount || {};
    const isMelee = sys.weaponClass === "melee" || sys.weaponClass === "thrown";

    // BS оператора: персонаж на привязанном месте → его BS; иначе, если у машины
    // есть Автопилот (Autonomous), стреляет он своим BS; иначе базовый 35.
    let opBS = 35, opName = "";
    const der = this.actor.system.derived || {};
    const st = (this.actor.system.stations || []).find(s => s.id === vm.stationId);
    let occ = null;
    if (st?.uuid) { try { occ = fromUuidSync(st.uuid); } catch (e) {} occ = occ?.actor ?? occ; }
    const occBS = occ?.system?.characteristics?.bs?.total;
    if (occBS != null) { opBS = occBS; opName = occ.name; }
    else if (der.autonomous && der.autonomousBS > 0) { opBS = der.autonomousBS; opName = "Автопилот"; }

    // Режимы огня.
    const rofModes = [];
    if (isMelee) {
      rofModes.push({ value: "melee", label: "Рукопашная (±0)", bonus: 0 });
    } else {
      if ((sys.rof_single ?? 0) > 0 || (!sys.rof_semi && !sys.rof_full))
        rofModes.push({ value: "single", label: "Одиночный (+10)", bonus: 10 });
      if ((sys.rof_semi ?? 0) > 0)
        rofModes.push({ value: "semi", label: `Короткая очередь (±0, ${sys.rof_semi})`, bonus: 0 });
      if ((sys.rof_full ?? 0) > 0)
        rofModes.push({ value: "full", label: `Длинная очередь (−10, ${sys.rof_full})`, bonus: -10 });
    }
    if (!rofModes.length) rofModes.push({ value: "single", label: "Одиночный (+10)", bonus: 10 });
    const rofHtml = rofModes.map((m, i) =>
      `<label class="veh-rof"><input type="radio" name="vf-rof" value="${m.value}" data-bonus="${m.bonus}" ${i === 0 ? "checked" : ""}/> ${m.label}</label>`).join("");

    // Если отмеченная цель — техника, прицел по ЧАСТЯМ МАШИНЫ, иначе — по частям тела.
    const targetIsVehicle = [...(game.user?.targets ?? [])]
      .some(t => (t.actor ?? t.document?.actor)?.type === "vehicle");
    const aimTargets = targetIsVehicle
      ? VEHICLE_AIM_TARGETS.map(t => ({ value: t.value, label: t.label, penalty: t.penalty, part: t.part }))
      : [
          { value: "",     label: "Без прицела (Торс)", penalty: 0 },
          { value: "head", label: "Голова (−20)", penalty: -20 },
          { value: "arm",  label: "Рука (−20)",   penalty: -20 },
          { value: "leg",  label: "Нога (−20)",   penalty: -20 },
          { value: "eye",  label: "Глаз (−30)",   penalty: -30 }
        ];
    const aimHtml = aimTargets.map(t => `<option value="${t.value}" data-penalty="${t.penalty}">${t.label}</option>`).join("");
    const aimLabelHint = targetIsVehicle ? "Прицел (часть машины)" : "Прицел (часть цели)";

    // Сторона брони цели-техники выбирается здесь (в окне атаки), а не при применении урона.
    const sideRow = targetIsVehicle ? `
        <div class="atk-dlg-row"><label>Сторона брони цели:</label>
          <select id="vf-side">
            <option value="front">Лобовая</option>
            <option value="side" selected>Бортовая</option>
            <option value="rear">Кормовая</option>
          </select>
        </div>` : "";

    // Продвинутые Системы Управления (wdbc-y33b, доводка): попытка автоматизации
    // при отсутствии учёта «действия на движение» техники вообще — если машина
    // уже отмечена movedThisTurn, этот выстрел просто идёт как обычно; если нет,
    // этот же выстрел ЗАСЧИТЫВАЕТ Ход машины на этот Раунд (ставится флагом по
    // факту "Огонь!", не отдельным чекбоксом — меньше кликов, тот же итог).
    const advCtrlFixed  = !isMelee && vm.mount === "fixed" && !!der.traitFlags?.advancedControls;
    const movedThisTurn = !!this.actor.system.movedThisTurn;
    const fixedNote = vm.mount === "fixed"
      ? `<div class="atk-range-info" style="font-size:0.82em;">Закреплённое: выстрел комбинирован с Operate +10 мехвода — поворачивайте корпусом.
          ${advCtrlFixed ? (movedThisTurn
              ? "<br>Продвинутые Системы Управления: Ход в этот Раунд уже засчитан — этот выстрел не требует отдельного действия."
              : "<br>Продвинутые Системы Управления: этот выстрел засчитывается заодно с Ходом машины в этот Раунд (отметится автоматически).")
            : ""}
        </div>` : "";

    // Штурм: во время Натиска выстрел всегда с Боевой дистанции — форсирует
    // дальность вне зависимости от выбора в #vf-range (галочка).
    const onslaughtRow = (!isMelee && der.traitFlags?.onslaught)
      ? `<label class="veh-check"><input type="checkbox" id="vf-onslaught"/> Натиск (Штурм): стрельба с Боевой дистанции</label>` : "";

    // Мультиприцел/Продвинутые Прицельные/Продвинутые Системы Управления —
    // экономика действий стрельбы техники (сколько выстрелов на одно
    // действие) нигде в системе не проверяется автоматически (см.
    // doombc-mount-ranged-penalty-dead-parameters — тот же класс пробела),
    // поэтому только заметка-напоминание, не автоматика.
    const traitNotes = [];
    if (der.traitFlags?.multiTargeter)
      traitNotes.push("Мультиприцел: можно стрелять по разным целям независимо от углового расстояния.");
    if (der.traitFlags?.advancedTargeting)
      traitNotes.push("Продвинутые Прицельные Системы: чтобы выстрелить заодно всеми орудиями этой станции одним действием — кнопка «Залп» на вкладке «Обзор».");
    if (der.traitFlags?.advancedControls)
      traitNotes.push("Продвинутые Системы Управления: водитель может провести Ход и этот выстрел одним полным действием.");
    const traitNoteHtml = traitNotes.length
      ? `<div class="atk-range-info" style="font-size:0.82em;">${traitNotes.join("<br>")}</div>` : "";

    // Сектор наводки (wdbc-m38e, geometry: rules/facing.mjs) — предупреждение,
    // не блокировка: как и остальные правила установки орудий в этом окне
    // (см. fixedNote выше), решение остаётся за игроком/ГМ.
    const vehicleToken = this.actor.getActiveTokens?.(false, true)?.[0] || null;
    const outOfArcTargets = (!isMelee && vehicleToken)
      ? [...(game.user?.targets ?? [])].filter(t => !isTargetWithinVehicleArc(vehicleToken, vm.hArc, t))
      : [];
    const arcNote = outOfArcTargets.length
      ? `<div class="atk-range-info" style="color:#c0392b;font-size:0.82em;">⚠ Вне сектора наводки (${esc(vm.hArc || "—")}): ${outOfArcTargets.map(t => esc(t.name)).join(", ")} — довернуть корпус/башню или сменить цель.</div>`
      : "";

    // Полоса дальности (wdbc-5il7, п.4): та же измеренная дистанция и
    // rangeBandKey, что у личного диалога атаки (wdbc-mysg) — переиспользуем
    // готовую границу полос, не заводим свою. У техники дропдаун огрублён до
    // 3 пунктов (Ближе/Короткая +10 · В пределах 0 · Дальняя −10), поэтому
    // pointBlank/short схлопываются в «+10», long/extreme — в «−10».
    const vfTarget = (!isMelee && vehicleToken) ? [...(game.user?.targets ?? [])][0] : null;
    const vfMeasured = (vehicleToken && vfTarget) ? measureTokens(vehicleToken, vfTarget) : null;
    const vfBandKey = vfMeasured ? rangeBandKey(vfMeasured.edgeM, Number(sys.range)) : null;
    const vfAutoRange = vfBandKey === "pointBlank" || vfBandKey === "short" ? "10"
                       : vfBandKey === "long" || vfBandKey === "extreme" || vfBandKey === "out" ? "-10"
                       : "0";
    const vfRangeNote = vfMeasured ? `<div class="atk-range-info" style="font-size:0.82em;">Измеренная дистанция: ${vfMeasured.edgeM} м${Number(sys.range) ? ` (Дальность оружия: ${sys.range} м)` : ""}</div>${vfBandKey === "out" ? `
      <div class="atk-recharge-warn">⚠ Цель вне дальности: ${vfMeasured.edgeM} м при максимуме ${Number(sys.range) * 3} м (3×Rng)</div>` : ""}` : "";

    // Без <form>: DialogV2 сам оборачивает содержимое в форму, и вложенная
    // ломала бы button.form, через который читаются поля.
    const content = `
      <div class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-header"><span class="atk-weapon-name">${esc(item.name)}</span>
          <span style="opacity:.7">(${sys.damage || "—"}, Проб. ${sys.penetration || 0}, ${MOUNT_TYPES[vm.mount] || "—"})</span></div>
        <div class="atk-dlg-row"><label>BS оператора${opName ? ` (${opName})` : ""}:</label><input id="vf-bs" type="number" value="${opBS}"/></div>
        <div class="atk-dlg-row"><label>Установленная модификация к попаданию:</label><input id="vf-atkbonus" type="number" value="${(sys.attackBonus || 0) + aimBonus}"/></div>
        ${aimBonus ? `<div class="atk-range-info" style="font-size:0.82em;">Залп: первое орудие станции получает Прицеливание (+${aimBonus}), уже учтено выше.</div>` : ""}
        <div class="veh-rof-group"><div class="atk-dlg-sub">Режим огня:</div>${rofHtml}</div>
        <div class="atk-dlg-row"><label>${aimLabelHint}:</label><select id="vf-aim">${aimHtml}</select></div>
        ${sideRow}
        <div class="atk-dlg-row"><label>Дистанция:</label>
          <select id="vf-range">
            <option value="10" ${vfAutoRange === "10" ? "selected" : ""}>Ближе / Короткая (+10)</option>
            <option value="0" ${vfAutoRange === "0" ? "selected" : ""}>В пределах дальности (0)</option>
            <option value="-10" ${vfAutoRange === "-10" ? "selected" : ""}>Дальняя (−10)</option>
          </select>
        </div>
        ${vfRangeNote}
        <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="vf-mod" type="number" value="0"/></div>
        <label class="veh-check"><input type="checkbox" id="vf-short"/> Короткая дистанция (Мельта/Рассеивание)</label>
        ${onslaughtRow}
        ${fixedNote}
        ${arcNote}
        ${traitNoteHtml}
      </div>`;

    return foundry.applications.api.DialogV2.wait({
      // Без esc: заголовок окна рисуется текстом.
      window: { title: `Стрельба: ${item.name}` },
      classes: ["dialog", "wh-attack-dialog"],
      position: { width: 440 },
      content,
      buttons: [
        { action: "fire", icon: "fas fa-crosshairs", label: "Огонь!", default: true,
          callback: async (event, button) => {
            const form = button.form;
            const num = sel => parseInt(form.querySelector(sel)?.value) || 0;
            const rofEl   = form.querySelector("input[name='vf-rof']:checked");
            const bs      = num("#vf-bs");
            const atkBon  = num("#vf-atkbonus");
            const rofMode = rofEl?.value || rofModes[0].value;
            const rofBon  = parseInt(rofEl?.dataset.bonus) || 0;
            const aimSel  = form.querySelector("#vf-aim");
            const aimVal  = aimSel?.value;
            const aimPen  = parseInt(aimSel?.selectedOptions?.[0]?.dataset.penalty) || 0;
            // Штурм: галочка форсирует Боевую дистанцию (+10, «Ближе/Короткая»)
            // независимо от выбранного значения дальности.
            const onslaughtChecked = !!form.querySelector("#vf-onslaught")?.checked;
            const range   = onslaughtChecked ? 10 : num("#vf-range");
            const mod     = num("#vf-mod");
            const shortRange = !!form.querySelector("#vf-short")?.checked;
            const chosen = aimTargets.find(t => t.value === aimVal);
            const aimMap = { head: "Голова", arm: "Рука", leg: "Нога", eye: "Глаз (Голова)" };
            // Для техники передаём часть машины (vehiclePart), для существ — часть тела.
            const aimTarget = aimVal
              ? (targetIsVehicle
                  ? { value: aimVal, label: chosen?.label || "", vehiclePart: chosen?.part || "" }
                  : { value: aimVal, label: aimMap[aimVal] || "Торс" })
              : null;
            const vehicleSide = targetIsVehicle ? (form.querySelector("#vf-side")?.value || "side") : "";
            const threshold = bs + atkBon + rofBon + aimPen + range + mod;
            await _executeAttackRoll(this.actor, item, "bs", threshold, rofMode, aimTarget, { shortRange, vehicleSide });
            // Продвинутые Системы Управления: этот выстрел засчитывает Ход
            // машины на этот Раунд, если он ещё не был засчитан.
            if (advCtrlFixed && !movedThisTurn) {
              await this.actor.update({ "system.movedThisTurn": true });
            }
          } },
        { action: "cancel", label: "Отмена" }
      ]
    }).catch(() => null);
  }

  // Залп (wdbc-y33b): списывает ОДНО полное действие у оператора станции
  // (не у машины — у неё ОД нет), затем открывает стрельбу из первого орудия
  // станции с Прицеливанием; остальные орудия той же станции доступны из
  // обычного списка «ОГОНЬ — ОРУДИЯ» без дополнительной траты ОД в этот Раунд.
  async _showVolleyDialog(stationId) {
    const weapons = this.actor.items.filter(i =>
      i.type === "weapon" && i.system.vehicleMount?.stationId === stationId);
    if (!weapons.length) {
      return ui.notifications.warn("⚠️ На этой станции нет орудий.");
    }
    const result = await resolveVolleyAction(this.actor, stationId);
    if (!result.ok) return ui.notifications.warn(`⚠️ ${result.error}`);

    const [first, ...rest] = weapons;
    if (rest.length) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `
          <div class="wh-roll-result">
            <div class="roll-header">🎯 Залп — ${esc(this.actor.name)}</div>
            <div class="roll-outcome"><span class="roll-success">Полное действие оператора (${esc(result.occupant.name)}) потрачено на всю станцию.</span></div>
            <div class="roll-allout-note">Открывается стрельба из «${esc(first.name)}» (с Прицеливанием). Остальные орудия станции — без доп. траты ОД в этот Раунд: ${rest.map(w => esc(w.name)).join(", ")}.</div>
          </div>`
      });
    }
    // Не await/return: диалог стрельбы остаётся открытым до решения игрока,
    // а Залп как действие уже завершён (ОД потрачены, заметка отправлена).
    this._showVehicleFireDialog(first, { aimBonus: 10 });
  }
}
