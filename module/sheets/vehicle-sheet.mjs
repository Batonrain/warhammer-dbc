import { CHASSIS_TYPES, CHASSIS_NOTES, VEHICLE_TYPES, CREW_ROLES,
         MOUNT_TYPES, MOUNT_NOTES, ARMOUR_SIDES,
         VEHICLE_HIT_LOCATIONS, VEHICLE_AIM_TARGETS,
         CREW_ACTIONS, VEHICLE_CRITS, VEHICLE_CRIT_LABEL,
         VEHICLE_BREAKAGES, VEHICLE_STATUS_EFFECTS,
         REPAIR_CONDITIONS, REPAIR_REQUIREMENTS, REQUISITION_NOTES } from "../constants/vehicle.mjs";
import { _executeAttackRoll } from "../combat/attack.mjs";
import { showRamDialog, showTerrainDialog, showRepairDialog } from "../combat/vehicle.mjs";
import { VEHICLE_WEAPONS } from "../constants/vehicle-weapons-library.mjs";
import { actorFactionsContext, activateFactionFieldListeners } from "../apps/actor-factions.mjs";

const ROLE_ORDER = ["commander", "driver", "gunner", "loader", "pilot", "passenger"];

export class WarhammerVehicleSheet extends foundry.appv1.sheets.ActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["warhammer-dbc", "sheet", "actor", "vehicle", "wh-holo"],
      template: "systems/warhammer-dbc/templates/actor/vehicle-sheet.hbs",
      width: 800, height: 780,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "overview" }]
    });
  }

  getData() {
    const context = super.getData();
    // Поле «Фракция» в шапке — общее для всех листов (apps/actor-factions.mjs).
    Object.assign(context, actorFactionsContext(this.actor));
    const sys = this.actor.system;
    context.system  = sys;
    context.derived = sys.derived || {};

    context.chassisTypes  = CHASSIS_TYPES;
    context.chassisNote   = CHASSIS_NOTES[sys.chassis?.type] || "";
    context.vehicleTypes  = VEHICLE_TYPES;
    context.armourSides   = ARMOUR_SIDES;
    context.crewRoles     = CREW_ROLES;
    context.mountTypes    = MOUNT_TYPES;
    context.hitLocations  = VEHICLE_HIT_LOCATIONS;
    context.crewActions   = CREW_ACTIONS;
    context.isWalker      = sys.chassis?.type === "walker";

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

    return context;
  }

  // Разрешаем drop всем (в т.ч. игрокам-не-владельцам техники), чтобы игрок мог
  // сам сесть в транспорт. Права проверяются в обработчиках дропа.
  _canDragDrop(_selector) { return true; }

  // Токен с холста может приходить как type:"Token" — маршрутизируем его (и Actor)
  // в посадку экипажа. Прочее (предметы и т.п.) — базовому обработчику.
  async _onDrop(event) {
    let data = null;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch (e) { /* нет данных */ }
    if (data && (data.type === "Token" || data.type === "Actor")) {
      return this._onDropActor(event, data);
    }
    return super._onDrop(event);
  }

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
    if (this.actor.isOwner) {
      await this.actor.update({ "system.stations": stations });
      return true;
    }
    const gm = game.users.activeGM;
    if (!gm) {
      ui.notifications.warn("Нужен активный ГМ на сессии, чтобы занять место в чужой технике.");
      return false;
    }
    game.socket.emit("system.warhammer-dbc", {
      action: "vehicleStations",
      vehicleUuid: this.actor.uuid,
      stations,
      userId: game.user.id
    });
    return true;
  }

  /** Перетаскивание актора на лист → посадить его в конкретное (или первое свободное) место. */
  async _onDropActor(event, data) {
    const uuid = data.uuid
      || (data.type === "Actor" && data.id ? `Actor.${data.id}` : null)
      || (data.type === "Token" && data.sceneId && data.tokenId ? `Scene.${data.sceneId}.Token.${data.tokenId}` : null);
    if (!uuid) return false;

    let doc = null;
    try { doc = await fromUuid(uuid); } catch (e) { doc = null; }
    const actor = doc?.actor ?? doc;
    if (!actor || actor.id === this.actor.id) return false;

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

  activateListeners(html) {
    super.activateListeners(html);
    // Поле «Фракция» в шапке — общее для всех листов.
    activateFactionFieldListeners(html, this.actor);

    // ── Доступно всем (в т.ч. игроку-не-владельцу техники) ──
    // Открыть лист сидящего персонажа.
    html.find(".veh-station-open").on("click", async ev => {
      const uuid = ev.currentTarget.closest("[data-uuid]")?.dataset.uuid;
      if (!uuid) return;
      const doc = await fromUuid(uuid);
      (doc?.actor ?? doc)?.sheet?.render(true);
    });
    // Освободить место: владелец техники — любое; игрок — только своё.
    html.find(".veh-station-clear").on("click", async ev => {
      const id = ev.currentTarget.closest("[data-station-id]")?.dataset.stationId;
      const stations = foundry.utils.deepClone(this.actor.system.stations || []);
      const s = stations.find(x => x.id === id);
      if (!s) return;
      if (!this.actor.isOwner) {
        const occ = s.uuid ? await fromUuid(s.uuid) : null;
        const occActor = occ?.actor ?? occ;
        if (!occActor?.isOwner) return ui.notifications.warn("Освободить можно только своё место.");
      }
      s.uuid = ""; s.name = ""; s.img = "";
      await this._persistStations(stations);
    });

    if (!this.isEditable) {
      // Core appv1 привязывает Drag&Drop только для редактируемого листа.
      // Для игрока-не-владельца привязываем drop сами, чтобы он мог перетащить
      // своего персонажа/токен в транспорт (запись идёт через ГМа по сокету).
      try {
        const el  = html[0] ?? html;
        const DDC = foundry.applications?.ux?.DragDrop ?? globalThis.DragDrop;
        if (DDC && el) new DDC({ dropSelector: null, callbacks: { drop: this._onDrop.bind(this) } }).bind(el);
      } catch (e) { console.warn("Warhammer DBC | vehicle DnD bind:", e); }
      return;
    }

    const idOf = (ev) => ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;

    // ── Экипаж: управление МЕСТАМИ ──
    // Добавить N мест выбранной роли.
    html.find(".veh-add-stations").on("click", async () => {
      const role  = html.find(".veh-add-role").val() || "gunner";
      const count = Math.max(1, Math.min(20, parseInt(html.find(".veh-add-count").val()) || 1));
      const stations = foundry.utils.deepClone(this.actor.system.stations || []);
      for (let i = 0; i < count; i++)
        stations.push({ id: foundry.utils.randomID(), role, uuid: "", name: "", img: "" });
      await this.actor.update({ "system.stations": stations });
    });
    // Удалить место целиком.
    html.find(".veh-station-remove").on("click", async ev => {
      const id = ev.currentTarget.closest("[data-station-id]")?.dataset.stationId;
      const stations = (this.actor.system.stations || []).filter(s => s.id !== id);
      // Отвяжем орудия, привязанные к удалённому месту.
      const upd = this.actor.items.filter(i => i.type === "weapon" && i.system.vehicleMount?.stationId === id)
        .map(i => ({ _id: i.id, "system.vehicleMount.stationId": "" }));
      await this.actor.update({ "system.stations": stations });
      if (upd.length) await this.actor.updateEmbeddedDocuments("Item", upd);
    });
    // (Освобождение места и открытие листа — выше, доступны и игроку.)

    // ── Орудия: создать / открыть / контекст ──
    html.find(".veh-create-weapon").on("click", async () => {
      const [it] = await this.actor.createEmbeddedDocuments("Item", [
        { name: "Новое орудие", type: "weapon",
          system: { weaponClass: "heavy", vehicleMount: { isMounted: true } } }
      ]);
      it?.sheet.render(true);
    });
    html.find(".veh-weapon-open").on("click", ev => this.actor.items.get(idOf(ev))?.sheet.render(true));

    // Свап орудия на разъёме: подменяем профиль выбранным вариантом из
    // компендиума «Орудия техники», сохраняя данные установки (место/углы/опции).
    html.find(".veh-weapon-swap").on("change", async ev => {
      const id   = idOf(ev);
      const name = ev.currentTarget.value;
      const item = this.actor.items.get(id);
      if (!item || item.name === name) return;
      const src = VEHICLE_WEAPONS.find(w => w.name === name);
      if (!src) return ui.notifications.warn(`Профиль «${name}» не найден в библиотеке орудий техники.`);
      const vm  = foundry.utils.deepClone(item.system.vehicleMount || {});
      const sys = foundry.utils.deepClone(src.system);
      sys.vehicleMount = vm;                 // сохраняем разъём/опции/место/углы/БК
      await item.update({ name: src.name, img: src.img, system: sys });
    });

    // Inline-редакторы установки орудия.
    html.find(".veh-mount-field").on("change", ev => {
      const id = idOf(ev);
      const el = ev.currentTarget;
      const val = el.type === "checkbox" ? el.checked
                : el.type === "number"   ? (Math.max(0, parseInt(el.value) || 0))
                : el.value;
      if (id) this.actor.items.get(id)?.update({ [`system.vehicleMount.${el.dataset.field}`]: val });
    });

    // Стрельба / перезарядка.
    html.find(".veh-fire-weapon").on("click", ev => {
      const it = this.actor.items.get(idOf(ev));
      if (it) this._showVehicleFireDialog(it);
    });
    html.find(".veh-reload-weapon").on("click", ev => {
      const it = this.actor.items.get(idOf(ev));
      if (it) this._reloadVehicleWeapon(it);
    });

    // ПКМ по строке орудия — контекстное меню (Редактировать / Удалить).
    html.find(".veh-weapon-row").on("contextmenu", ev => {
      ev.preventDefault(); ev.stopPropagation();
      $(".wh-context-menu").remove();
      const id = $(ev.currentTarget).data("item-id");
      const item = this.actor.items.get(id);
      if (!item) return;
      const menu = $(`
        <div class="wh-context-menu">
          <div class="wh-ctx-item wh-ctx-edit">Редактировать</div>
          <div class="wh-ctx-item wh-ctx-delete">Удалить</div>
        </div>`).css({ top: ev.clientY + "px", left: ev.clientX + "px", position: "fixed" });
      $("body").append(menu);
      setTimeout(() => { $(document).one("click.wh-ctx", () => menu.remove()); }, 50);
      menu.find(".wh-ctx-edit").on("click", e2 => { e2.stopPropagation(); menu.remove(); item.sheet.render(true); });
      menu.find(".wh-ctx-delete").on("click", e2 => { e2.stopPropagation(); menu.remove(); item.delete(); });
    });

    // ── Снаряжение техники ──
    html.find(".veh-create-gear").on("click", async () => {
      const [it] = await this.actor.createEmbeddedDocuments("Item", [
        { name: "Новое снаряжение", type: "vehicleGear",
          img: "systems/warhammer-dbc/assets/actor-icons/vehicle.svg" }
      ]);
      it?.sheet.render(true);
    });
    html.find(".veh-gear-open").on("click", ev => {
      const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      this.actor.items.get(id)?.sheet.render(true);
    });
    html.find(".veh-gear-toggle").on("change", ev => {
      const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      this.actor.items.get(id)?.update({ "system.active": ev.currentTarget.checked });
    });
    html.find(".veh-gear-del").on("click", ev => {
      const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      this.actor.items.get(id)?.delete();
    });

    // ── Черты техники ──
    html.find(".veh-create-trait").on("click", async () => {
      const [it] = await this.actor.createEmbeddedDocuments("Item", [
        { name: "Новая черта", type: "vehicleTrait",
          img: "systems/warhammer-dbc/assets/actor-icons/vehicle.svg" }
      ]);
      it?.sheet.render(true);
    });
    html.find(".veh-trait-open").on("click", ev => {
      const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      this.actor.items.get(id)?.sheet.render(true);
    });
    html.find(".veh-trait-del").on("click", ev => {
      const id = ev.currentTarget.closest("[data-item-id]")?.dataset.itemId;
      this.actor.items.get(id)?.delete();
    });

    // ── Боевые действия ──
    html.find(".veh-ram").on("click", () => showRamDialog(this.actor));
    html.find(".veh-terrain").on("click", () => showTerrainDialog(this.actor));
    html.find(".veh-repair").on("click", () => showRepairDialog(this.actor));

    // ── Трекер состояний машины (поломки/эффекты) ──
    html.find(".veh-state-add").on("click", async () => {
      const val = html.find(".veh-state-select").val();
      if (!val) return;
      const [kind, idxStr] = String(val).split(":");
      const idx = parseInt(idxStr);
      const src = kind === "breakage" ? VEHICLE_BREAKAGES[idx] : VEHICLE_STATUS_EFFECTS[idx];
      if (!src) return;
      const states = foundry.utils.deepClone(this.actor.system.damageStates || []);
      states.push({ id: foundry.utils.randomID(), kind, label: src.name, note: src.text });
      await this.actor.update({ "system.damageStates": states });
    });
    html.find(".veh-state-del").on("click", async ev => {
      const id = ev.currentTarget.closest("[data-state-id]")?.dataset.stateId;
      const states = (this.actor.system.damageStates || []).filter(s => s.id !== id);
      await this.actor.update({ "system.damageStates": states });
    });
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
        <div class="roll-header">🔄 Перезарядка — ${item.name}</div>
        <div class="roll-outcome"><span class="roll-success">Магазин <b>${magMax}/${magMax}</b> · Боекомплект осталось: <b>${reloads - 1}</b></span></div>
        ${reloads - 1 === 0 ? `<div class="roll-allout-note">Боекомплект этого орудия исчерпан — перезарядка возможна только снаружи/в снабжении.</div>` : ""}
      </div>`
    }, rollMode));
  }

  // Компактный диалог стрельбы из орудия техники (переиспользует движок атаки).
  _showVehicleFireDialog(item) {
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

    const fixedNote = vm.mount === "fixed"
      ? `<div class="atk-range-info" style="font-size:0.82em;">Закреплённое: выстрел комбинирован с Operate +10 мехвода — поворачивайте корпусом.</div>` : "";

    const content = `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-header"><span class="atk-weapon-name">${item.name}</span>
          <span style="opacity:.7">(${sys.damage || "—"}, Проб. ${sys.penetration || 0}, ${MOUNT_TYPES[vm.mount] || "—"})</span></div>
        <div class="atk-dlg-row"><label>BS оператора${opName ? ` (${opName})` : ""}:</label><input id="vf-bs" type="number" value="${opBS}"/></div>
        <div class="atk-dlg-row"><label>Установленная модификация к попаданию:</label><input id="vf-atkbonus" type="number" value="${sys.attackBonus || 0}"/></div>
        <div class="veh-rof-group"><div class="atk-dlg-sub">Режим огня:</div>${rofHtml}</div>
        <div class="atk-dlg-row"><label>${aimLabelHint}:</label><select id="vf-aim">${aimHtml}</select></div>
        ${sideRow}
        <div class="atk-dlg-row"><label>Дистанция:</label>
          <select id="vf-range">
            <option value="10">Ближе / Короткая (+10)</option>
            <option value="0" selected>В пределах дальности (0)</option>
            <option value="-10">Дальняя (−10)</option>
          </select>
        </div>
        <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="vf-mod" type="number" value="0"/></div>
        <label class="veh-check"><input type="checkbox" id="vf-short"/> Короткая дистанция (Мельта/Рассеивание)</label>
        ${fixedNote}
      </form>`;

    new Dialog({
      title: `Стрельба: ${item.name}`,
      content,
      buttons: {
        fire: { icon: '<i class="fas fa-crosshairs"></i>', label: "Огонь!",
          callback: async html => {
            const bs      = parseInt(html.find("#vf-bs").val()) || 0;
            const atkBon  = parseInt(html.find("#vf-atkbonus").val()) || 0;
            const rofMode = html.find("input[name='vf-rof']:checked").val() || rofModes[0].value;
            const rofBon  = parseInt(html.find("input[name='vf-rof']:checked").data("bonus")) || 0;
            const aimVal  = html.find("#vf-aim").val();
            const aimPen  = parseInt(html.find("#vf-aim option:selected").data("penalty")) || 0;
            const range   = parseInt(html.find("#vf-range").val()) || 0;
            const mod     = parseInt(html.find("#vf-mod").val()) || 0;
            const shortRange = html.find("#vf-short").is(":checked");
            const chosen = aimTargets.find(t => t.value === aimVal);
            const aimMap = { head: "Голова", arm: "Рука", leg: "Нога", eye: "Глаз (Голова)" };
            // Для техники передаём часть машины (vehiclePart), для существ — часть тела.
            const aimTarget = aimVal
              ? (targetIsVehicle
                  ? { value: aimVal, label: chosen?.label || "", vehiclePart: chosen?.part || "" }
                  : { value: aimVal, label: aimMap[aimVal] || "Торс" })
              : null;
            const vehicleSide = targetIsVehicle ? (html.find("#vf-side").val() || "side") : "";
            const threshold = bs + atkBon + rofBon + aimPen + range + mod;
            await _executeAttackRoll(this.actor, item, "bs", threshold, rofMode, aimTarget, { shortRange, vehicleSide });
          } },
        cancel: { label: "Отмена" }
      },
      default: "fire"
    }, { classes: ["dialog", "wh-attack-dialog"], width: 440 }).render(true);
  }
}
