import { armourHistoryContext, rollArmourTable, rollArmourEntry,
         rollArmourZones, setArmourEntry, clearArmourHistory } from "../apps/armour-history.mjs";
import { shipQualityMods, qualityOptionsFor, effectiveWeapon, clampQuality, QUALITY_LABELS }
  from "../constants/ship-quality.mjs";
import { availableFieldModes, fieldSuitFor } from "../constants/drukhari-armor-fields.mjs";
// module/sheets/item-sheet.mjs

import { ARMOR_PROPERTIES,
         DRUG_CATEGORIES, DRUG_DELIVERY,
         DRUG_CHAR_KEYS, WEAPON_MOD_GROUPS,
         ARMOR_MOD_GROUPS, GEAR_CATEGORIES,
         TOOL_CATEGORIES, RIG_COMFORT, RIG_SLOT_SIZES, ITEM_TYPES } from "../constants/items.mjs";
import { qualityEffects, itemSpecificQuality }       from "../constants/quality.mjs";
import { implantMech }                               from "../constants/implant-mechanics.mjs";
import { SHIELD_NATURES, SHIELD_TYPES,
         SHIELD_STATUS }                             from "../constants/shields.mjs";
import { WEAPON_PROPERTIES,
         WEAPON_PROPERTIES_LIST }                    from "../constants/weapon-properties.mjs";
import { SHIP_PROPERTIES,
         SHIP_PROPERTIES_LIST }                      from "../constants/ship-properties.mjs";
import { buildCargoTypeOptions, getCargoType }       from "../constants/ship.mjs";
import { TORPEDO_WARHEADS, TORPEDO_NAV_SYSTEMS, torpedoProfile } from "../constants/ship-combat.mjs";
import { DISEASE_GODS } from "../constants/diseases.mjs";
import { BODY_TYPES, ZONES, STAR_CLASSES, BODY_SIZES, GRAVITY,
         ATMOSPHERE_PRESENCE, ATMOSPHERE_TYPE, CLIMATE, HABITABILITY, ALLEGIANCE,
         XENOS_SPECIES, RESOURCE_TYPES, RESOURCE_ICONS,
         WORLD_CLASSES, WORLD_ENVIRONMENTS, TITHE_GRADES } from "../constants/star-system.mjs";
import { PSY_POWER_TYPES }                           from "../constants/psyker.mjs";
import { TECH_MIRACLE_TYPES }                        from "../constants/tech.mjs";
import { SKILLS_DEF }                                from "../constants/skills.mjs";
import { CHARACTERISTICS, APTITUDES }                from "../constants/characteristics.mjs";
import { PSY_DISCIPLINES, TECH_DISCIPLINES,
         buildDisciplineContext }                    from "../constants/disciplines.mjs";
import { DW_GODS_MAP }                               from "../constants/demon-weapon.mjs";
import { summarizeEffectChanges, expectedPhase }     from "../constants/effect-keys.mjs";
import { createBlankEffect } from "../apps/effects.mjs";
import { getItemMechanics, blankMechGroup, blankMechEntry, buildMechanicsTabHtml, syncWeaponPropItemEffects, findMechGroup, findMechEntry,
         getItemRequirements, blankReqGroup, blankReqEntry, buildRequirementsHtml } from "../apps/mechanics.mjs";
import { specOptions }                               from "../constants/skill-specializations.mjs";
import { RITUAL_ITEM_TYPES }                         from "../constants/rituals.mjs";

// Метка типа (в PSY это строки, в TECH — объекты {label})
function _typeLabel(map, key) {
  const v = map[key];
  return typeof v === "string" ? v : (v?.label ?? key);
}

export class WarhammerItemSheet extends foundry.appv1.sheets.ItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["warhammer-dbc","sheet","item","wh-holo"],
      template: "systems/warhammer-dbc/templates/item/item-sheet.hbs",
      width: 600, height: 640,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "info" }],
      dragDrop: [{ dragSelector: null, dropSelector: ".effects-drop-target, .grant-drop-zone, .wprop-drop-zone" }]
    });
  }

  /**
   * Перетаскивание готового эффекта с другого предмета/актора прямо на
   * вкладку «Эффекты» — клонирует его на текущий предмет. Базовый ItemSheet
   * такого не умеет (только ActorSheet).
   */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const wpropZone = event.target?.closest?.(".wprop-drop-zone");
    if (wpropZone && data?.type === "Item") return this._onDropWeaponPropItem(event, data, wpropZone);
    // ВАЖНО: зона требования несёт ОБА класса (.req-drop-zone .grant-drop-zone),
    // поэтому проверяется РАНЬШЕ — иначе дроп ушёл бы в Механику.
    const reqZone = event.target?.closest?.(".req-drop-zone");
    if (reqZone && data?.type === "Item") return this._onDropReqItem(event, data, reqZone);
    const grantZone = event.target?.closest?.(".grant-drop-zone");
    if (grantZone && data?.type === "Item") return this._onDropGrantItem(event, data, grantZone);
    if (data?.type === "ActiveEffect") return this._onDropActiveEffect(event, data);
  }

  /**
   * Драг-н-дроп Таланта/Черты на условие-требование. Пишет в набор групп,
   * указанный в data-req (req — ритуалисту, assistReq — ассистентам).
   */
  async _onDropReqItem(event, data, dropZone) {
    // Требования правит только Мастер: остальные элементы конструктора ему
    // рисуются disabled, а зона дропа disabled не бывает — без проверки
    // владелец-игрок переписал бы мастерское требование перетаскиванием.
    if (!this.item.isOwner || !game.user.isGM) return;
    const { req: reqKey, groupId, entryId } = dropZone.dataset;
    const src = await Item.implementation.fromDropData(data);
    if (!src) return;

    const arr = foundry.utils.deepClone(getItemRequirements(this.item, reqKey));
    const entry = arr.find(g => g.id === groupId)?.entries?.find(e => e.id === entryId);
    if (!entry) return;

    const want = entry.kind === "reqTalent" ? "talent" : "trait";
    if (src.type !== want) {
      const need = want === "talent" ? "Талант" : "Черту";
      return ui.notifications.warn(
        `Сюда нужно перетащить ${need}, а перетащено: ${ITEM_TYPES[src.type] || src.type}.`);
    }
    entry.sourceUuid = src.uuid;
    entry.sourceName = src.name;
    entry.sourceImg  = src.img;
    entry.sourceHasRating = !!src.system?.hasRating;
    await this.item.setFlag("warhammer-dbc", reqKey, arr);
  }

  async _onDropActiveEffect(event, data) {
    const effect = await ActiveEffect.implementation.fromDropData(data);
    if (!this.item.isOwner || !effect) return false;
    if (effect.target === this.item) return false;
    return ActiveEffect.implementation.create(effect.toObject(), { parent: this.item });
  }

  /**
   * Драг-н-дроп Черты/Таланта на поле записи вкладки «Механика» — резолвит
   * перетащенный предмет (компендиум/мир/чужой лист) и заполняет им запись:
   * ссылку (UUID), имя, картинку, признак «есть рейтинг» у Черт.
   */
  async _onDropGrantItem(event, data, dropZone) {
    if (!this.item.isOwner) return;
    const groupId = dropZone.dataset.groupId, entryId = dropZone.dataset.entryId;
    const src = await Item.implementation.fromDropData(data);
    if (!src) return;
    if (!["trait", "talent"].includes(src.type)) {
      return ui.notifications.warn(`Сюда можно перетащить только Черту или Талант (получено: «${src.type}»).`);
    }
    const groups = foundry.utils.deepClone(getItemMechanics(this.item));
    const ent = findMechEntry(groups, groupId, entryId);
    if (!ent) return;
    ent.kind            = src.type;
    ent.sourceUuid       = src.uuid;
    ent.sourceName       = src.name;
    ent.sourceImg        = src.img;
    ent.sourceHasRating  = src.type === "trait" ? !!src.system.hasRating : false;
    ent.rating           = (src.type === "trait" && src.system.hasRating) ? (src.system.rating ?? 0) : "";
    ent.specialization   = src.type === "talent" ? (src.system.specialization || "") : "";
    await this.item.setFlag("warhammer-dbc", "mechanics", groups);
  }

  /**
   * Драг-н-дроп Свойства оружия (предмет type:"weaponProperty", компендиум
   * «Свойства оружия») на запись kind:"weaponProp" вкладки «Механика».
   * data-slot зоны: "prop" (основное свойство) или "newProp" (замена, только
   * при действии «заменить свойство») — пишет в соответствующую пару полей.
   */
  async _onDropWeaponPropItem(event, data, dropZone) {
    if (!this.item.isOwner) return;
    const groupId = dropZone.dataset.groupId, entryId = dropZone.dataset.entryId;
    const slot = dropZone.dataset.slot === "newProp" ? "newProp" : "prop";
    const src = await Item.implementation.fromDropData(data);
    if (!src) return;
    if (src.type !== "weaponProperty") {
      return ui.notifications.warn(`Сюда можно перетащить только предмет «Свойство оружия» (получено: «${src.type}»).`);
    }
    const groups = foundry.utils.deepClone(getItemMechanics(this.item));
    const ent = findMechEntry(groups, groupId, entryId);
    if (!ent) return;
    const key = src.system.autoKey || "";
    const prefix = slot === "newProp" ? "weaponPropNew" : "weaponProp";
    ent[`${prefix}Key`]        = key;
    ent[`${prefix}Label`]      = src.name;
    ent[`${prefix}HasRating`]  = !!src.system.hasRating;
    ent[`${prefix}HasRating2`] = !!src.system.hasRating2;
    // Основное свойство сменилось на нерейтинговое — увеличение/уменьшение
    // рейтинга больше не имеют смысла, откатываем действие на «добавить».
    if (slot === "prop" && !ent.weaponPropHasRating
        && (ent.weaponPropAction === "increase" || ent.weaponPropAction === "decrease")) {
      ent.weaponPropAction = "add";
    }
    await this.item.setFlag("warhammer-dbc", "mechanics", groups);
    await syncWeaponPropItemEffects(this.item);
  }

  getData() {
    const context  = super.getData();
    // Истории силовой брони — только для брони Астартес и при включённом расширении.
    context.armourHistory = armourHistoryContext(this.item);
    context.system = this.item.system;

    context.system.balanceStr      = String(context.system.balance      ?? "0");
    // availabilityStr всегда строка для корректного сравнения в HBS
    context.system.availabilityStr = String(context.system.availability ?? "0");
    context.system.weaponTypesRaw  = (context.system.weaponTypes || []).join(", ");

    // ── Друкхарийская броня с генератором поля: режимы и их доступность ────────
    // Амортизирующее требует Good.Q, Подавляющее — Best.Q; закрытые режимы
    // показываем неактивными, чтобы было видно, что даёт качество брони.
    if (this.item.type === "armor") {
      const suit = fieldSuitFor(this.item);
      if (suit) {
        context.fieldSuit  = suit.label;
        context.fieldModes = availableFieldModes(this.item);
      }
    }

    // ── Оружие и психосилы: особые свойства атаки (общий список) ────────────────
    if (this.item.type === "weapon" || this.item.type === "psychicPower") {
      const active     = context.system.weaponProps || [];
      const activeKeys = new Set(active.map(p => p.key));
      context.weaponPropsActive = active
        .map(p => ({
          key:     p.key,
          rating:  p.rating  ?? 0,
          rating2: p.rating2 ?? 0,
          def:     WEAPON_PROPERTIES[p.key]
        }))
        .filter(p => p.def);
      context.weaponPropsAvailable = WEAPON_PROPERTIES_LIST.filter(d => !activeKeys.has(d.key));
    }

    // ── Оружие: доп. профили ББ (Крюк/Посох и т.п.) — свои урон/тип/пробой/Rng/свойства ──
    if (this.item.type === "weapon") {
      context.weaponProfiles = (context.system.profiles || []).map((prof, idx) => {
        const pActive     = Array.isArray(prof.weaponProps) ? prof.weaponProps : [];
        const pActiveKeys = new Set(pActive.map(p => p.key));
        return {
          idx,
          num: idx + 2,
          label: prof.label ?? "",
          damage: prof.damage ?? "",
          damageType: prof.damageType ?? "i",
          penetration: prof.penetration ?? 0,
          range: prof.range ?? "",
          propsActive: pActive
            .map(p => ({ key: p.key, rating: p.rating ?? 0, rating2: p.rating2 ?? 0, def: WEAPON_PROPERTIES[p.key] }))
            .filter(p => p.def),
          propsAvailable: WEAPON_PROPERTIES_LIST.filter(d => !pActiveKeys.has(d.key))
        };
      });
    }

    // ── Демоническое Оружие: цвет/метка бога + метки свойств ───────────────
    if (this.item.type === "weapon" && context.system.daemonWeapon?.bound) {
      const dw = context.system.daemonWeapon;
      const g  = DW_GODS_MAP[dw.god] || null;
      context.daemonWeaponColor    = g?.color || "#b477ff";
      context.daemonWeaponGodLabel = g?.label || "Неделимый";
      (dw.properties || []).forEach(dp => { dp.godLabel = (DW_GODS_MAP[dp.god]?.label) || "Неделимый"; });
    }

    // ── Узел корабля: свойства (Aspects) ───────────────────────────────────────
    if (this.item.type === "component") {
      const active     = context.system.shipProps || [];
      const activeKeys = new Set(active.map(p => p.key));
      context.shipPropsActive = active
        .map(p => ({ key: p.key, rating: p.rating ?? 0, rating2: p.rating2 ?? 0, def: SHIP_PROPERTIES[p.key] }))
        .filter(p => p.def);
      context.shipPropsAvailable = SHIP_PROPERTIES_LIST.filter(d => !activeKeys.has(d.key));

      // Качество узла: выбор модификаторов и итоговые значения.
      const sysC = context.system;
      const q    = sysC.quality || "common";
      const def  = qualityOptionsFor(sysC);
      const qm   = shipQualityMods(sysC);
      const picked = new Set(qm.picks.map(p => p.key));
      const isWeapon = sysC.kind === "weapon";
      const ew = isWeapon ? effectiveWeapon(sysC) : null;
      context.quality = {
        show: q !== "common", label: QUALITY_LABELS[q] || q,
        sp: qm.sp, need: qm.need, custom: !!sysC.qualityCustom, isWeapon,
        fixed: def.fixed || [],
        options: (def.options || []).map(o => ({ ...o, on: picked.has(o.key) })),
        effPower: clampQuality(sysC.power, qm.power),
        effSpace: clampQuality(sysC.space, qm.space),
        effSp:    (Number(sysC.sp) || 0) + qm.sp,
        effS: ew?.strength ?? 0, effDmg: ew?.damage || "—",
        effCrit: ew?.crit ?? 0, effRng: ew?.range ?? 0
      };
    }

    // ── Груз корабля ───────────────────────────────────────────────────────────
    if (this.item.type === "cargo") {
      context.cargoTypeOptions = buildCargoTypeOptions(context.system.cargoType);
      context.cargoTypeInfo    = getCargoType(context.system.cargoType);
    }

    // ── Болезнь ─────────────────────────────────────────────────────────────────
    if (this.item.type === "disease") {
      context.diseaseGodOptions = DISEASE_GODS;
    }

    // ── Имплант: роспись механик (авто-числовое + Качество + памятка) ────────────
    if (this.item.type === "implant") {
      const mech = implantMech(this.item.name);
      if (mech) {
        const LOC = { head: "голова", body: "торс", arms: "руки", legs: "ноги", all: "всё тело" };
        const auto = [];
        if (mech.un)  for (const [k, v] of Object.entries(mech.un))  auto.push(`Unnatural ${k.toUpperCase()} (${v > 0 ? "+" : ""}${v})`);
        if (mech.val) for (const [k, v] of Object.entries(mech.val)) auto.push(`${v > 0 ? "+" : ""}${v} к ${k.toUpperCase()}`);
        if (mech.ap)  for (const [k, v] of Object.entries(mech.ap))  auto.push(`+${v} AP ${LOC[k] || k}`);
        context.implantMech = {
          auto,
          traits: mech.traits || [],
          skills: mech.skills || [],
          q: (mech.q && Object.keys(mech.q).length) ? mech.q : null,
          note: mech.note || "",
          any: auto.length || (mech.traits || []).length || (mech.skills || []).length || mech.note || (mech.q && Object.keys(mech.q).length),
        };
      }
    }

    // ── Торпеда (боеголовка + система наведения) ────────────────────────────────
    if (this.item.type === "torpedo") {
      const sysT = context.system;
      context.torpedoWarheadOptions = TORPEDO_WARHEADS.map(t =>
        `<option value="${t.id}"${t.id === sysT.warhead ? " selected" : ""}>${t.label}</option>`).join("");
      context.torpedoNavOptions = TORPEDO_NAV_SYSTEMS.map(n =>
        `<option value="${n.id}"${n.id === sysT.navSystem ? " selected" : ""}>${n.label}</option>`).join("");
      context.torpedoProfile = torpedoProfile(sysT.warhead, sysT.navSystem);

      // Запасы боеголовок/систем наведения в грузах корабля-носителя.
      const parent  = this.item.parent;
      const whLabel  = (TORPEDO_WARHEADS.find(t => t.id === sysT.warhead) || {}).label || "";
      const navLabel = (TORPEDO_NAV_SYSTEMS.find(n => n.id === sysT.navSystem) || {}).label || "";
      const navNeeded = sysT.navSystem !== "standard";   // Стандартная — в комплекте с боеголовкой
      if (parent && parent.type === "ship") {
        const whCargo  = parent.items.find(i => i.type === "cargo" && i.name === `Боеголовка: ${whLabel}`);
        const navCargo = parent.items.find(i => i.type === "cargo" && i.name === `Система наведения: ${navLabel}`);
        context.torpedoStock = {
          onShip: true, navNeeded,
          whName: `Боеголовка: ${whLabel}`, navName: `Система наведения: ${navLabel}`,
          whHas: !!whCargo, whQty: whCargo ? (Number(whCargo.system.quantity) || 0) : 0,
          navHas: !!navCargo, navQty: navCargo ? (Number(navCargo.system.quantity) || 0) : 0
        };
      } else {
        context.torpedoStock = { onShip: false, navNeeded };
      }
    }

    // ── Модификация оружия ──────────────────────────────────────────────────────
    if (this.item.type === "weaponMod") {
      const sys = context.system;
      if (!sys.effects) sys.effects = {};
      if (!Array.isArray(sys.effects.addProps))    sys.effects.addProps = [];
      if (!Array.isArray(sys.effects.removeProps)) sys.effects.removeProps = [];

      const cat = sys.category || "ranged";
      context.modCategory = cat;
      context.modGroupOptions = Object.entries(WEAPON_MOD_GROUPS[cat] || {})
        .map(([k, label]) => ({ key: k, label }));

      // Установка на оружие (только когда модификация принадлежит актору)
      const parentActor = this.item.parent;
      context.modInstallTargets = (parentActor?.items ?? [])
        .filter(i => i.type === "weapon")
        .map(i => ({ id: i.id, name: i.name, equipped: i.system.equipped }));

      // Даруемые свойства
      const addKeys = new Set(sys.effects.addProps.map(p => p.key));
      context.modAddPropsActive = sys.effects.addProps
        .map(p => ({ key: p.key, rating: p.rating ?? 0, rating2: p.rating2 ?? 0, def: WEAPON_PROPERTIES[p.key] }))
        .filter(p => p.def);
      context.modAddPropsAvailable = WEAPON_PROPERTIES_LIST.filter(d => !addKeys.has(d.key));

      // Убираемые свойства
      const remKeys = new Set(sys.effects.removeProps);
      context.modRemovePropsActive = sys.effects.removeProps
        .map(k => ({ key: k, def: WEAPON_PROPERTIES[k] }))
        .filter(p => p.def);
      context.modRemovePropsAvailable = WEAPON_PROPERTIES_LIST.filter(d => !remKeys.has(d.key));
    }

    // ── Талант: склонности ───────────────────────────────────────────────────────
    if (this.item.type === "talent") {
      const active = context.system.aptitudes || [];
      const used   = new Set(active);
      context.aptitudesActive = active
        .filter(k => APTITUDES[k])
        .map(k => ({ key: k, label: APTITUDES[k] }));
      context.aptitudesAvailable = Object.entries(APTITUDES)
        .filter(([k]) => !used.has(k))
        .map(([k, label]) => ({ key: k, label }));
    }

    // ── Модификация брони ───────────────────────────────────────────────────────
    if (this.item.type === "armorMod") {
      const sys = context.system;
      if (!sys.effects) sys.effects = {};
      if (!Array.isArray(sys.effects.addProps))   sys.effects.addProps = [];
      if (!Array.isArray(sys.effects.charBonuses)) sys.effects.charBonuses = [];

      const cat = sys.category || "armor";
      context.armorModCategory = cat;
      context.armorModGroupOptions = Object.entries(ARMOR_MOD_GROUPS[cat] || {})
        .map(([k, label]) => ({ key: k, label }));
      context.armorModIsPower = cat === "powerSystem";

      // Установка на броню (для систем — только силовая)
      const parentActor = this.item.parent;
      context.armorInstallTargets = (parentActor?.items ?? [])
        .filter(i => i.type === "armor" && (cat !== "powerSystem" || i.system.armorType === "power"))
        .map(i => ({ id: i.id, name: i.name, equipped: i.system.equipped }));

      // Даруемые свойства брони (чекбоксы)
      const activeProps = sys.effects.addProps;
      context.armorModProps = Object.entries(ARMOR_PROPERTIES).map(([key, def]) => ({
        key, label: def.label, desc: def.desc, active: activeProps.includes(key)
      }));

      // Бонусы характеристик
      context.charBonusOptions = Object.entries(CHARACTERISTICS)
        .map(([k, m]) => ({ key: k, abbr: m.abbr, label: m.label }));
      context.charBonusesActive = sys.effects.charBonuses.map(cb => ({
        stat: cb.stat, value: cb.value ?? 0, abbr: CHARACTERISTICS[cb.stat]?.abbr ?? cb.stat
      }));
    }

    // ── Психосилы / Техночудеса: доп. типы, навык, бонус характеристики ──────────
    if (this.item.type === "psychicPower" || this.item.type === "techPower") {
      const isTech  = this.item.type === "techPower";
      const TYPES   = isTech ? TECH_MIRACLE_TYPES : PSY_POWER_TYPES;
      const primary = isTech ? context.system.miracleType : context.system.powerType;
      const active  = context.system.extraTypes || [];

      context.extraTypesActive = active.map(e => ({
        type: e.type, x: e.x ?? 0, label: _typeLabel(TYPES, e.type)
      }));
      const used = new Set([primary, ...active.map(e => e.type)]);
      context.extraTypesAvailable = Object.keys(TYPES)
        .filter(k => !used.has(k))
        .map(k => ({ key: k, label: _typeLabel(TYPES, k) }));

      context.charBonusOptions = Object.entries(CHARACTERISTICS)
        .map(([k, m]) => ({ key: k, abbr: m.abbr, label: m.label }));
      if (!context.system.effects) context.system.effects = {};
      if (!Array.isArray(context.system.effects.charBonuses)) context.system.effects.charBonuses = [];
      context.charBonusesActive = context.system.effects.charBonuses.map(cb => ({
        stat: cb.stat, value: cb.value ?? 0,
        abbr: CHARACTERISTICS[cb.stat]?.abbr ?? cb.stat
      }));

      // Усиление оружия от психосилы (только для психосил): свойства как у оружия.
      if (this.item.type === "psychicPower") {
        if (!context.system.effects.weaponBuff)
          context.system.effects.weaponBuff = { enabled: false, scope: "equipped", damageMod: 0, penMod: 0, rangeMod: 0, addProps: [] };
        const wb = context.system.effects.weaponBuff;
        if (!Array.isArray(wb.addProps)) wb.addProps = [];
        const wbKeys = new Set(wb.addProps.map(p => p.key));
        context.weaponBuffPropsActive = wb.addProps
          .map(p => ({ key: p.key, rating: p.rating ?? 0, rating2: p.rating2 ?? 0, def: WEAPON_PROPERTIES[p.key] }))
          .filter(p => p.def);
        context.weaponBuffPropsAvailable = WEAPON_PROPERTIES_LIST.filter(d => !wbKeys.has(d.key));

        // Доп. профили атаки и вариации броска.
        if (!Array.isArray(context.system.profiles)) context.system.profiles = [];
        if (!Array.isArray(context.system.variants)) context.system.variants = [];
        context.psyProfiles = context.system.profiles.map((p, i) => ({
          idx: i, label: p.label ?? "", damage: p.damage ?? "",
          damageType: p.damageType ?? "energy", penetration: p.penetration ?? 0,
          propsText: p.propsText ?? "", charDamageStat: p.charDamageStat ?? "",
          charDamageFormula: p.charDamageFormula ?? ""
        }));
        context.psyVariants = context.system.variants.map((v, i) => ({
          idx: i, label: v.label ?? "", testMod: v.testMod ?? 0, note: v.note ?? ""
        }));
        context.psyDamageTypeOptions = { energy: "Энергетический", impact: "Ударный", rending: "Режущий", blast: "Взрывной", chemical: "Химический" };
      }

      if (isTech) {
        context.techSkillOptions = Object.entries(SKILLS_DEF)
          .map(([k, d]) => ({ key: k, label: d.label }));
      }

      // Дисциплина → зависимый подтип
      const REG = isTech ? TECH_DISCIPLINES : PSY_DISCIPLINES;
      const dc  = buildDisciplineContext(REG, context.system.discipline);
      context.disciplineGroups = dc.groups;
      context.disciplineSubtypes = dc.subtypes;
    }

    // ── Импланты / Черты: множественные бонусы характеристик (как у психосил) ────
    if (this.item.type === "implant" || this.item.type === "trait") {
      const sys = context.system;
      if (!sys.effects) sys.effects = {};
      if (!Array.isArray(sys.effects.charBonuses))      sys.effects.charBonuses = [];
      if (!Array.isArray(sys.effects.charValueBonuses)) sys.effects.charValueBonuses = [];
      context.charBonusOptions = Object.entries(CHARACTERISTICS)
        .map(([k, m]) => ({ key: k, abbr: m.abbr, label: m.label }));
      context.charBonusesActive = sys.effects.charBonuses.map(cb => ({
        stat: cb.stat, value: cb.value ?? 0, abbr: CHARACTERISTICS[cb.stat]?.abbr ?? cb.stat
      }));
      // Бонусы к ЗНАЧЕНИЮ характеристики (обычный +X, не Unnatural)
      context.charValueBonusesActive = sys.effects.charValueBonuses.map(cb => ({
        stat: cb.stat, value: cb.value ?? 0, abbr: CHARACTERISTICS[cb.stat]?.abbr ?? cb.stat
      }));
    }

    // ── Небесное тело (звёздная система) ─────────────────────────────────────
    if (this.item.type === "celestialBody") {
      const sys = context.system;
      const opts = (obj) => Object.entries(obj).map(([key, v]) => ({ key, label: v.label ?? v }));
      context.cbBodyTypes  = Object.entries(BODY_TYPES).map(([key, v]) => ({ key, label: v.label, icon: v.icon }));
      context.cbZones      = opts(ZONES);
      context.cbStarClasses= opts(STAR_CLASSES);
      context.cbBodySizes  = opts(BODY_SIZES);
      context.cbGravity    = opts(GRAVITY);
      context.cbAtmPres    = opts(ATMOSPHERE_PRESENCE);
      context.cbAtmType    = opts(ATMOSPHERE_TYPE);
      context.cbClimate    = opts(CLIMATE);
      context.cbHabit      = opts(HABITABILITY);
      context.cbAllegiance = opts(ALLEGIANCE);
      context.cbXenos      = opts(XENOS_SPECIES);
      context.cbWorldClasses = opts(WORLD_CLASSES);
      context.cbWorldEnv   = opts(WORLD_ENVIRONMENTS);
      context.cbTithe      = opts(TITHE_GRADES);
      // Улучшения, видимые зрителю (открытые — всегда; скрытые — после разведки; тайные — после раскрытия).
      const gm = game.user.isGM;
      const visImps = (sys.improvements || []).filter(im => gm || (im.secret ? sys.revealed : (im.hidden ? sys.scouted : true)));
      const impBonus = {};
      for (const im of visImps) for (const k in (im.res || {})) impBonus[k] = (impBonus[k] || 0) + Number(im.res[k] || 0);
      context.cbResources  = Object.entries(RESOURCE_TYPES).map(([key, v]) => ({ key, label: v.label, cat: v.cat, icon: RESOURCE_ICONS[key] || "", bonus: impBonus[key] || 0 }));
      context.cbImprovements = visImps.map(im => ({
        name: im.name, desc: im.desc,
        flag: gm ? (im.secret ? "Тайное" : im.hidden ? "скрыто до разведки" : "") : "",
        dim: gm && (im.secret ? !sys.revealed : (im.hidden ? !sys.scouted : false)),
        bonus: Object.entries(RESOURCE_TYPES).filter(([k]) => Number(im.res?.[k])).map(([k, v]) => `${v.label} +${im.res[k]}`).join(", ")
      }));
      // Родитель (орбита): другие небесные тела этой же системы.
      const host = this.item.parent;
      context.cbParents = (host?.items ?? [])
        .filter(i => i.type === "celestialBody" && i.id !== this.item.id)
        .map(i => ({ id: i.id, name: i.name }));
      context.cbHasXenos = sys.allegiance === "xenos" || sys.xenosSpecies;
      // Разведка: ГМ видит всё; игрок — только после разведки тела.
      context.cbIsGM = game.user.isGM;
      context.cbScouted = game.user.isGM || sys.scouted;
      // Секретные данные (оборона / истинная природа) — видит ГМ всегда, игрок — после раскрытия.
      context.cbShowSecret = game.user.isGM || sys.revealed;
    }

    // ── Броня ─────────────────────────────────────────────────────────────────
    if (this.item.type === "armor") {
      const activeProps = context.system.properties || [];
      // Как у оружия: активные свойства — чипами, остальные — в выпадающем «добавить».
      context.armorPropsActive = activeProps
        .filter(key => ARMOR_PROPERTIES[key])
        .map(key => ({ key, def: ARMOR_PROPERTIES[key] }));
      context.armorPropsAvailable = Object.entries(ARMOR_PROPERTIES)
        .filter(([key]) => !activeProps.includes(key))
        .map(([key, def]) => ({ key, label: def.label }));
    }

    // ── Силовой щит ───────────────────────────────────────────────────────────
    if (this.item.type === "forcefield") {
      context.shieldNatures    = Object.entries(SHIELD_NATURES).map(([k, v]) => ({ key: k, label: v }));
      context.shieldTypes      = Object.entries(SHIELD_TYPES).map(([k, v])   => ({ key: k, label: v }));

      const sys = context.system;
      if (sys.isSpecialRating) {
        context.ratingDisplay = "особый";
      } else {
        context.ratingDisplay = `${sys.ratingMin}–${sys.ratingMax}`;
        context.ratingDisplay += sys.overloadThreshold > 0
          ? `/${sys.overloadThreshold}` : "/−";
      }
      context.statusInfo = SHIELD_STATUS[sys.status] || SHIELD_STATUS.inactive;
    }

    // ── Препараты / Химия ─────────────────────────────────────────────────────
    if (this.item.type === "drug") {
      const sys = context.system;

      // availabilityStr для drug — отдельно, гарантируем строку
      context.system.availabilityStr = String(sys.availability ?? "0");

      // Доподстановки вложенных блоков здесь больше нет: их раздаёт схема
      // DrugData (module/data/item/drug.mjs), через которую проходит любой
      // документ. Что именно она гарантирует — записано в проверке умолчаний
      // (test/data/item-schemas.test.mjs).

      // Краткое отображение модов характеристик
      const modParts = [];
      for (const [k, v] of Object.entries(sys.statMods)) {
        if (v && v !== 0) {
          modParts.push(`${DRUG_CHAR_KEYS[k] ?? k} ${v > 0 ? "+" : ""}${v}`);
        }
      }
      context.statModsDisplay = modParts.join(", ") || "";

      context.drugCategories = DRUG_CATEGORIES;
      context.drugDelivery   = DRUG_DELIVERY;
    }

    // ── Снаряжение / Инструменты: качество + разгрузка ──────────────────────────
    if (this.item.type === "gear" || this.item.type === "tool") {
      const sys = context.system;
      context.system.availabilityStr = String(sys.availability ?? "0");
      if (!sys.quality) sys.quality = "common";
      if (!sys.qualityEffects) sys.qualityEffects = { poor: "", good: "", best: "" };

      if (this.item.type === "gear") {
        if (!sys.gearCategory) sys.gearCategory = "misc";
        if (!sys.rig) sys.rig = { comfort: "normal", backSlot: false, slots: [], magLocks: [] };
        if (!Array.isArray(sys.rig.slots))    sys.rig.slots = [];
        if (!Array.isArray(sys.rig.magLocks)) sys.rig.magLocks = [];
        context.gearCategories = GEAR_CATEGORIES;
        context.rigComfort     = RIG_COMFORT;
        context.rigSlotSizes   = RIG_SLOT_SIZES;
      } else {
        if (!sys.toolCategory) sys.toolCategory = "general";
        context.toolCategories = TOOL_CATEGORIES;
      }

      // Эффекты качества для отображения (типовой + специфичный текст)
      const qe = qualityEffects(this.item);
      context.qualityReminders = qe.reminders;
      context.qualityInfo      = qe.info;
      context.qualitySpecific  = itemSpecificQuality(this.item);
    }

    // ── Эффекты (Active Effect Foundry) — общая вкладка для всех типов ──────────
    context.itemEffects = this.item.effects.contents.map(fx => ({
      id: fx.id,
      name: fx.name,
      disabled: !!fx.disabled,
      summary: summarizeEffectChanges(fx.system?.changes),
      // Не «не final», а «не та, которую требует ключ»: хранимому полю нужна
      // именно "initial" (см. expectedPhase) — оно вход расчёта, а не итог.
      hasWrongPhase: (fx.system?.changes ?? []).some(c => c.phase !== expectedPhase(c.key))
    }));

    context.isGM = !!game.user.isGM;

    // ── МЕХАНИКА (Характеристики/Черты/Таланты/Навыки/Код при получении
    // предмета) — единый Конструктор, общая вкладка для всех типов. Заменил
    // собой прежние раздельные Скрипты/Выдачи/кнопку «Конструктор» в Эффектах.
    context.itemMechGroups   = getItemMechanics(this.item);
    context.itemMechanicsHtml = buildMechanicsTabHtml(this.item, context.isGM);

    // Ритуал — контентные разделы книги (стр. 393-425) и два набора
    // механических требований: к ритуалисту и к ассистентам.
    if (this.item.type === "ritual") {
      context.ritualItemTypes     = RITUAL_ITEM_TYPES;
      context.ritualReqHtml       = buildRequirementsHtml(this.item, "req", context.isGM);
      context.ritualAssistReqHtml = buildRequirementsHtml(this.item, "assistReq", context.isGM);
    }

    return context;
  }

  // Собрать N торпед, списав боеголовку (и систему наведения, если не Стандартная)
  // из грузов корабля-носителя.
  async _assembleTorpedo(n) {
    const parent = this.item.parent;
    if (!parent || parent.type !== "ship")
      return ui.notifications.warn("Сборка возможна только когда торпеда на корабле.");
    n = Math.max(1, Number(n) || 1);
    const sysT = this.item.system;
    const whLabel  = (TORPEDO_WARHEADS.find(t => t.id === sysT.warhead) || {}).label || "";
    const navLabel = (TORPEDO_NAV_SYSTEMS.find(nv => nv.id === sysT.navSystem) || {}).label || "";
    const navNeeded = sysT.navSystem !== "standard";
    const whCargo  = parent.items.find(i => i.type === "cargo" && i.name === `Боеголовка: ${whLabel}`);
    const navCargo = navNeeded ? parent.items.find(i => i.type === "cargo" && i.name === `Система наведения: ${navLabel}`) : null;
    const whQty  = whCargo  ? (Number(whCargo.system.quantity)  || 0) : 0;
    const navQty = navCargo ? (Number(navCargo.system.quantity) || 0) : 0;
    if (!whCargo || whQty < n)
      return ui.notifications.warn(`Недостаточно боеголовок «${whLabel}» в грузах (есть ${whQty}, нужно ${n}).`);
    if (navNeeded && (!navCargo || navQty < n))
      return ui.notifications.warn(`Недостаточно систем наведения «${navLabel}» в грузах (есть ${navQty}, нужно ${n}).`);
    // Списываем; при нуле — удаляем груз с листа.
    if (whQty - n <= 0) await whCargo.delete();
    else await whCargo.update({ "system.quantity": whQty - n });
    if (navNeeded) {
      if (navQty - n <= 0) await navCargo.delete();
      else await navCargo.update({ "system.quantity": navQty - n });
    }
    await this.item.update({ "system.quantity": (Number(sysT.quantity) || 0) + n });
    ui.notifications.info(`Собрано торпед: ${n}. Списано из грузов: ${whLabel} ×${n}${navNeeded ? `, ${navLabel} ×${n}` : ""}.`);
  }

  activateListeners(html) {
    // Режим поля друкхарийской брони — ровно один активный.
    (html[0] ?? html).querySelectorAll("[data-field-mode]").forEach(n =>
      n.addEventListener("click", ev => {
        const key = ev.currentTarget.dataset.fieldMode || "";
        this.item.update({ "system.fieldMode": key });
      }));

    super.activateListeners(html);

    // ── Фракция: список «других названий» одним полем ───────────────────────
    // system.aliases — ArrayField, и авто-submit формы строку в массив не
    // превратит. Разбираем сами, тем же приёмом, что и прочие списки в этом
    // файле: собрать значение и отдать одним update.
    html.find(".faction-aliases").on("change", ev => {
      const list = String(ev.currentTarget.value || "")
        .split(",").map(s => s.trim()).filter(Boolean);
      this.item.update({ "system.aliases": list });
    });

    // ── Эффекты (Active Effect Foundry) — общая вкладка для всех типов ──────────
    html.find(".effect-create-btn").on("click", ev => { ev.preventDefault(); createBlankEffect(this.item); });
    html.find(".effect-name-link, .effect-edit-btn").on("click", ev => {
      const fx = this.item.effects.get(ev.currentTarget.dataset.effectId);
      fx?.sheet?.render(true);
    });
    html.find(".effect-delete-btn").on("click", async ev => {
      const fx = this.item.effects.get(ev.currentTarget.dataset.effectId);
      if (fx) await fx.delete();
    });
    html.find(".effect-disabled-toggle").on("change", async ev => {
      const fx = this.item.effects.get(ev.currentTarget.dataset.effectId);
      if (fx) await fx.update({ disabled: !ev.currentTarget.checked });
    });

    // ── МЕХАНИКА (единый Конструктор: Характеристика/Черта/Талант/Навык/Код,
    // группы И/ИЛИ) — общая вкладка для всех типов. Read-mutate-clone-save:
    // полагаемся на авто-рендер листа после setFlag, а не на живую
    // перестройку DOM вручную (тот же приём, что и у прежних Скриптов/Выдач).
    // Досчитываем system.effects.mechAddProps/mechRemoveProps при КАЖДОМ сохранении,
    // не только из полей weaponProp — иначе смена kind/удаление группы или записи
    // не подчистили бы то, что раньше построил kind:"weaponProp" (см. mechanics.mjs).
    const saveMech = async arr => {
      await this.item.setFlag("warhammer-dbc", "mechanics", arr);
      await syncWeaponPropItemEffects(this.item);
    };
    // Рекурсивный поиск (учитывает вложенные подгруппы kind:"group", см. mechanics.mjs).
    const findEntry = findMechEntry;
    html.find(".grant-group-add").on("click", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      arr.push(blankMechGroup(ev.currentTarget.dataset.op === "OR" ? "OR" : "AND"));
      saveMech(arr);
    });
    html.find(".grant-group-remove").on("click", ev => {
      const id = ev.currentTarget.dataset.groupId;
      saveMech(getItemMechanics(this.item).filter(g => g.id !== id));
    });
    html.find(".grant-op-toggle").on("click", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const g = findMechGroup(arr, ev.currentTarget.dataset.groupId);
      if (g) { g.operator = g.operator === "OR" ? "AND" : "OR"; saveMech(arr); }
    });
    html.find(".grant-entry-add").on("click", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const g = findMechGroup(arr, ev.currentTarget.dataset.groupId);
      if (g) { g.entries.push(blankMechEntry()); saveMech(arr); }
    });
    html.find(".grant-entry-remove").on("click", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const g = findMechGroup(arr, ev.currentTarget.dataset.groupId);
      if (g) { g.entries = g.entries.filter(e => e.id !== ev.currentTarget.dataset.entryId); saveMech(arr); }
    });
    html.find(".grant-entry-kind").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      // blankMechEntry(kind) — а не blankMechEntry() — иначе смена вида на
      // "group" оставила бы entry.group=null (kind сам по себе выставился бы
      // верно 3-м аргументом Object.assign, но вложенная подгруппа — нет).
      const kind = ev.currentTarget.value;
      Object.assign(e, blankMechEntry(kind), { id: e.id, kind });
      saveMech(arr);
    });
    // Порча (kind:"corruption")
    html.find(".mech-corruption-op").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.op = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-corruption-value").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.corruptionValue = ev.currentTarget.value; saveMech(arr); }
    });
    // Раны (kind:"wounds")
    html.find(".mech-wounds-op").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.op = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-wounds-value").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.woundsValue = ev.currentTarget.value; saveMech(arr); }
    });
    // Слаженность отряда (kind:"cohesion")
    html.find(".mech-cohesion-role").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.cohesionRole = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-cohesion-op").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.op = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-cohesion-value").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.cohesionValue = ev.currentTarget.value; saveMech(arr); }
    });
    // Характеристика
    html.find(".mech-char-key").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.charKey = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-char-field").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.field = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-char-op").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.op = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-char-value").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.value = ev.currentTarget.value === "" ? "" : (parseFloat(ev.currentTarget.value) || 0); saveMech(arr); }
    });
    // Вес (kind:"weight")
    html.find(".mech-weight-scope").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weightScope = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-weight-mode").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weightMode = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-weight-value").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weightValue = ev.currentTarget.value === "" ? "" : (parseFloat(ev.currentTarget.value) || 0); saveMech(arr); }
    });
    // Движение (kind:"movement")
    html.find(".mech-move-target").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.movementTarget = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-move-op").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.op = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-move-value").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.movementValue = ev.currentTarget.value === "" ? "" : (parseInt(ev.currentTarget.value) || 0); saveMech(arr); }
    });
    // Ландшафт — игнорирование свойств (kind:"terrainIgnore")
    html.find(".mech-terrain-ignore").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.ignoreTerrainProps = Array.from(ev.currentTarget.selectedOptions).map(o => o.value);
      saveMech(arr);
    });
    // Снаряжение (kind:"equipment")
    html.find(".mech-equip-mode").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipMode = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-equip-source").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.equipSourceUuid = ev.currentTarget.value;
      e.equipSourceName = ev.currentTarget.selectedOptions[0]?.textContent || "";
      saveMech(arr);
    });
    html.find(".mech-equip-cat").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.equipCategoryPack = ev.currentTarget.value;
      e.equipWeaponType = ""; e.equipWeaponProp = ""; e.equipArmorType = "";
      saveMech(arr);
    });
    html.find(".mech-equip-wtype").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipWeaponType = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-equip-wprop").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipWeaponProp = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-equip-atype").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipArmorType = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-equip-avail").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipMaxAvailability = parseInt(ev.currentTarget.value); saveMech(arr); }
    });
    html.find(".mech-equip-qty").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipQty = Math.max(1, parseInt(ev.currentTarget.value) || 1); saveMech(arr); }
    });
    // Модификатор броска (kind:"rollmod") — навык/специализация переиспользуют
    // .grant-entry-skillref/.grant-entry-specialty/-spec-custom (см. ниже).
    html.find(".mech-rollmod-label").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.label = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-rollmod-value").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.value = ev.currentTarget.value === "" ? "" : (parseFloat(ev.currentTarget.value) || 0); saveMech(arr); }
    });
    // Очки Судьбы или Бесчестья (kind:"poolMax")
    html.find(".mech-poolmax-value").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.value = ev.currentTarget.value === "" ? "" : (parseFloat(ev.currentTarget.value) || 0); saveMech(arr); }
    });
    // Код (kind:"script")
    html.find(".mech-script-label").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.label = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".mech-script-code").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.code = ev.currentTarget.value; saveMech(arr); }
    });
    // ── ТРЕБОВАНИЯ (Ритуал: к ритуалисту «req» и к ассистентам «assistReq») ──
    // Тот же приём read-mutate-clone-save, что и у Механики; какой набор
    // групп правим — в data-req, поэтому один комплект обработчиков
    // обслуживает оба блока сразу.
    const reqKeyOf  = el => el.dataset.req;
    const saveReq   = async (key, arr) => { await this.item.setFlag("warhammer-dbc", key, arr); };
    const reqGroups = key => foundry.utils.deepClone(getItemRequirements(this.item, key));
    const findReqGroup = (arr, id) => arr.find(g => g.id === id) || null;
    const findReqEntry = (arr, gid, eid) => findReqGroup(arr, gid)?.entries?.find(e => e.id === eid) || null;
    // Правка поля записи — общий помощник, чтобы не плодить одинаковый код.
    const patchReq = (ev, fn) => {
      const el = ev.currentTarget, key = reqKeyOf(el);
      const arr = reqGroups(key);
      const e = findReqEntry(arr, el.dataset.groupId, el.dataset.entryId);
      if (!e) return;
      fn(e, el);
      saveReq(key, arr);
    };

    html.find(".req-group-add").on("click", ev => {
      const key = reqKeyOf(ev.currentTarget);
      const arr = reqGroups(key);
      arr.push(blankReqGroup(ev.currentTarget.dataset.op === "OR" ? "OR" : "AND"));
      saveReq(key, arr);
    });
    html.find(".req-group-remove").on("click", ev => {
      const el = ev.currentTarget, key = reqKeyOf(el);
      saveReq(key, reqGroups(key).filter(g => g.id !== el.dataset.groupId));
    });
    html.find(".req-op-toggle").on("click", ev => {
      const el = ev.currentTarget, key = reqKeyOf(el);
      const arr = reqGroups(key);
      const g = findReqGroup(arr, el.dataset.groupId);
      if (g) { g.operator = g.operator === "OR" ? "AND" : "OR"; saveReq(key, arr); }
    });
    html.find(".req-entry-add").on("click", ev => {
      const el = ev.currentTarget, key = reqKeyOf(el);
      const arr = reqGroups(key);
      const g = findReqGroup(arr, el.dataset.groupId);
      if (g) { g.entries.push(blankReqEntry()); saveReq(key, arr); }
    });
    html.find(".req-entry-remove").on("click", ev => {
      const el = ev.currentTarget, key = reqKeyOf(el);
      const arr = reqGroups(key);
      const g = findReqGroup(arr, el.dataset.groupId);
      if (g) { g.entries = g.entries.filter(e => e.id !== el.dataset.entryId); saveReq(key, arr); }
    });
    html.find(".req-entry-kind").on("change", ev => patchReq(ev, (e, el) => {
      // Смена вида условия обнуляет поля прежнего — иначе на записи висели
      // бы чужие данные (напр. навык у требования по расе).
      Object.assign(e, blankReqEntry(el.value), { id: e.id, kind: el.value });
    }));
    html.find(".req-skillref").on("change", ev => patchReq(ev, (e, el) => {
      const [scope, key] = String(el.value || "").split(":");
      e.skillScope = scope === "group" ? "group" : "plain";
      e.skillKey = key || "";
      e.specKey = ""; e.specialty = "";
    }));
    html.find(".req-rank").on("change",      ev => patchReq(ev, (e, el) => { e.rank = el.value; }));
    html.find(".req-spec").on("change",      ev => patchReq(ev, (e, el) => {
      const spec = el.value ? specOptions(e.skillKey).find(s => s.key === el.value) : null;
      e.specKey = el.value;
      // Сверку ведёт specKey, поэтому в specialty кладём русское имя — оно
      // идёт в текст требования на листе (AGENTS.md: интерфейс русский).
      e.specialty = spec ? (spec.ru || spec.label) : "";
    }));
    html.find(".req-rating").on("change",    ev => patchReq(ev, (e, el) => {
      e.rating = el.value === "" ? "" : (parseInt(el.value) || 0);
    }));
    html.find(".req-race").on("change",      ev => patchReq(ev, (e, el) => { e.raceKey = el.value; }));
    html.find(".req-archetype").on("change", ev => patchReq(ev, (e, el) => { e.archetypeName = el.value; }));
    html.find(".req-patron").on("change",    ev => patchReq(ev, (e, el) => { e.patronKey = el.value; }));
    html.find(".req-drop-clear").on("click", ev => patchReq(ev, e => {
      Object.assign(e, { sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false });
    }));

    // Черта / Талант (драг-н-дроп резолвится в _onDropGrantItem)
    html.find(".grant-drop-clear").on("click", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      Object.assign(e, { sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "", specialization: "" });
      saveMech(arr);
    });
    html.find(".grant-entry-rating").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.rating = ev.currentTarget.value === "" ? "" : (parseInt(ev.currentTarget.value) || 0); saveMech(arr); }
    });
    html.find(".grant-entry-spec").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.specialization = ev.currentTarget.value; saveMech(arr); }
    });
    // Навык
    html.find(".grant-entry-skillref").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      const [scope, key] = String(ev.currentTarget.value || "").split(":");
      e.skillScope = scope === "group" ? "group" : "plain";
      e.skillKey   = key || "";
      e.specKey = ""; e.specialty = "";
      saveMech(arr);
    });
    html.find(".grant-entry-specialty").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      const val = ev.currentTarget.value;
      if (val === "__custom__") { e.specKey = ""; e.specialty = e.specialty || ""; e.specChoiceKeys = []; }
      else if (val === "__choice__") { e.specKey = "__choice__"; e.specialty = ""; e.specChoiceKeys = e.specChoiceKeys || []; }
      else if (val) {
        const opt = specOptions(e.skillKey).find(s => s.key === val);
        e.specKey = val; e.specialty = opt?.label || val; e.specChoiceKeys = [];
      } else { e.specKey = ""; e.specialty = ""; e.specChoiceKeys = []; }
      saveMech(arr);
    });
    html.find(".grant-entry-spec-custom").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.specialty = ev.currentTarget.value; saveMech(arr); }
    });
    // «По выбору» — несколько кандидатов-чекбоксов, актор выбирает один
    // диалогом при получении предмета (resolveEntrySpecChoice в mechanics.mjs).
    html.find(".grant-entry-spec-choice").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      const key = ev.currentTarget.dataset.key;
      const set = new Set(e.specChoiceKeys || []);
      if (ev.currentTarget.checked) set.add(key); else set.delete(key);
      e.specChoiceKeys = [...set];
      saveMech(arr);
    });
    html.find(".grant-entry-rank").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.rank = ev.currentTarget.value; saveMech(arr); }
    });

    // Оружие: Свойство (kind:"weaponProp") — драг-н-дроп резолвится в
    // _onDropWeaponPropItem; здесь только действие/значения/сброс зон
    // (saveMech сам досчитывает system.effects.mechAddProps/mechRemoveProps).
    html.find(".wprop-action").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weaponPropAction = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".wprop-value").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weaponPropValue = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".wprop-value2").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weaponPropValue2 = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".wprop-new-value").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weaponPropNewValue = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".wprop-new-value2").on("change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weaponPropNewValue2 = ev.currentTarget.value; saveMech(arr); }
    });
    html.find(".wprop-drop-clear").on("click", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      const prefix = ev.currentTarget.dataset.slot === "newProp" ? "weaponPropNew" : "weaponProp";
      e[`${prefix}Key`] = ""; e[`${prefix}Label`] = ""; e[`${prefix}HasRating`] = false; e[`${prefix}HasRating2`] = false;
      if (prefix === "weaponProp" && (e.weaponPropAction === "increase" || e.weaponPropAction === "decrease")) {
        e.weaponPropAction = "add";
      }
      saveMech(arr);
    });

    // ── Особенность комплекта силовой брони ──
    html.find(".pa-roll-table").on("click", () => rollArmourTable(this.item));
    html.find(".pa-roll-entry").on("click", () =>
      rollArmourEntry(this.item, html.find(".pa-table-select").val() || this.item.system.history?.table));
    html.find(".pa-roll-zones").on("click", () => rollArmourZones(this.item));
    html.find(".pa-clear").on("click", () => clearArmourHistory(this.item));
    html.find(".pa-table-select").on("change", ev =>
      this.item.update({ "system.history.table": ev.currentTarget.value }));
    html.find(".pa-entry-select").on("change", ev => {
      const table = html.find(".pa-table-select").val() || this.item.system.history?.table;
      if (ev.currentTarget.value) setArmourEntry(this.item, table, ev.currentTarget.value);
    });

    // Качество узла: галочки модификаторов. Лишние сверх лимита сбрасываем —
    // иначе тихо применились бы только первые, а вид говорил бы обратное.
    html.find(".comp-quality-pick").change(async ev => {
      const def  = qualityOptionsFor(this.item.system);
      const lim  = def.pick || 0;
      const keys = Array.from(html.find(".comp-quality-pick"))
        .filter(el => el.checked).map(el => el.dataset.key);
      if (keys.length > lim) {
        const key = ev.currentTarget.dataset.key;
        // Новый выбор вытесняет самый ранний из отмеченных.
        const rest = keys.filter(k => k !== key).slice(-(lim - 1 > 0 ? lim - 1 : 0));
        await this.item.update({ "system.qualityPicks": [...rest, key] });
      } else {
        await this.item.update({ "system.qualityPicks": keys });
      }
    });
    // Голо-тема для листа небесного тела (планеты/станции).
    if (this.item.type === "celestialBody") this.element?.addClass?.("wh-holo");
    if (!this.isEditable) return;

    // ── Сборка торпеды из грузов корабля ───────────────────────────────────────
    html.find(".torpedo-assemble-btn").on("click", async () => {
      const n = parseInt(html.find(".torpedo-assemble-n").val()) || 1;
      await this._assembleTorpedo(n);
    });

    // ── Баланс ────────────────────────────────────────────────────────────────
    html.find(".balance-select").on("change", ev => {
      this.item.update({ "system.balance": parseInt(ev.currentTarget.value) });
    });

    // ── Доступность (только для НЕ-drug, у drug работает через name= биндинг)
    // Для drug селект имеет name="system.availability" и Foundry сам сохраняет.
    // Для других предметов — ручной handler через класс .availability-select
    if (this.item.type !== "drug") {
      html.find(".availability-select").on("change", ev => {
        this.item.update({ "system.availability": parseInt(ev.currentTarget.value) });
      });
    } else {
      // Для drug: принудительно конвертируем строку в число при сохранении
      html.find("[name='system.availability']").on("change", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        this.item.update({ "system.availability": parseInt(ev.currentTarget.value) || 0 });
      });
    }

    // ── Тип брони ─────────────────────────────────────────────────────────────
    html.find(".armor-type-select").on("change", ev => {
      this.item.update({ "system.armorType": ev.currentTarget.value });
    });

    // ── Особые свойства оружия ─────────────────────────────────────────────────
    html.find(".wprop-add-select").on("change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const props = foundry.utils.deepClone(this.item.system.weaponProps || []);
      if (!props.some(p => p.key === key)) {
        props.push({ key, rating: 0, rating2: 0 });
        await this.item.update({ "system.weaponProps": props });
      }
    });
    html.find(".wprop-remove").on("click", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const props = (this.item.system.weaponProps || []).filter(p => p.key !== key);
      await this.item.update({ "system.weaponProps": props });
    });

    // ── Освободить демона: снять осквернение (стать Руническим Оружием) ──────
    html.find(".wms-release").on("click", async () => {
      const dw = this.item.system.daemonWeapon || {};
      const hasSnap = Array.isArray(dw.preProps);
      const Dialog = foundry.appv1?.api?.Dialog || globalThis.Dialog;
      const doRelease = async () => {
        // d10: 1-6 оружие уничтожено, 7-10 → Руническое Оружие. В обоих случаях
        // демоническое усиление снимается — восстанавливаем ИСХОДНЫЕ свойства
        // оружия (снимок при осквернении), НЕ трогая родные (немагические) свойства.
        const r = (await new Roll("1d10").evaluate()).total;
        const runic = r >= 7;
        // База: снимок исходных свойств (если есть), иначе — текущие как есть
        // (fallback для старых осквернённых предметов — чтобы не потерять родные).
        let props = foundry.utils.deepClone(hasSnap ? dw.preProps : (this.item.system.weaponProps || []));
        if (runic) {
          // Руническое: исходные свойства + Tainted и Reinforced, теряет Primitive.
          props = props.filter(p => p.key !== "primitive");
          if (!props.some(p => p.key === "reinforced")) props.push({ key: "reinforced" });
          if (!props.some(p => p.key === "tainted"))    props.push({ key: "tainted" });
        }
        const update = {
          "system.weaponProps": props,
          "system.daemonWeapon.bound": false,
          "system.daemonWeapon.subdued": false,
          "system.daemonWeapon.runic": runic,
          "system.daemonWeapon.properties": []
        };
        // Возврат урона/пробивания (снимаем +W.b демона), если есть снимок.
        if (hasSnap) {
          update["system.damage"] = dw.preDamage ?? this.item.system.damage;
          update["system.penetration"] = dw.prePen ?? this.item.system.penetration;
          update["system.daemonWeapon.preProps"] = [];
          update["system.daemonWeapon.preDamage"] = "";
          update["system.daemonWeapon.prePen"] = 0;
        }
        await this.item.update(update);
        ChatMessage.create({ content: `<div class="wh-poss-card" style="--gc:#b477ff"><div class="wh-poss-card-h">Освобождение демона — d10: ${r}</div><div class="wh-poss-card-r">${runic ? "<b>7-10:</b> оружие стало <b>Руническим</b> (родные свойства + Reinforced + Tainted, эхо силы)." : "<b>1-6:</b> оружие <b>уничтожено</b>, оставив искорёженные куски (демоническое усиление снято)."}</div></div>` });
      };
      if (Dialog) {
        new Dialog({ title: "Освободить демона", content: "<p>Демон вырывается из оружия. Бросок d10 определит судьбу оружия (1-6 уничтожено, 7-10 → Руническое). Демоническое усиление снимается, родные свойства оружия сохраняются.</p>",
          buttons: { ok: { label: "Освободить", callback: doRelease }, cancel: { label: "Отмена" } }, default: "ok" }).render(true);
      } else { await doRelease(); }
    });
    html.find(".wprop-rating").on("change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = parseInt(ev.currentTarget.value) || 0;
      const props = foundry.utils.deepClone(this.item.system.weaponProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.weaponProps": props }); }
    });
    // Рейтинг-бросок (например, Дуга/Arc: 2-е значение — формула кубика, напр. «2d10»).
    html.find(".wprop-rating-dice").on("change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = ev.currentTarget.value.trim();
      const props = foundry.utils.deepClone(this.item.system.weaponProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.weaponProps": props }); }
    });

    // ── Психосила: доп. профили атаки ───────────────────────────────────────────
    html.find(".psy-profile-add").on("click", async () => {
      const arr = foundry.utils.deepClone(this.item.system.profiles || []);
      arr.push({ label: "", damage: "", damageType: "energy", penetration: 0, propsText: "", charDamageStat: "", charDamageFormula: "" });
      await this.item.update({ "system.profiles": arr });
    });
    html.find(".psy-profile-remove").on("click", async ev => {
      const i = Number(ev.currentTarget.dataset.index);
      const arr = (this.item.system.profiles || []).filter((_, idx) => idx !== i);
      await this.item.update({ "system.profiles": arr });
    });
    html.find(".psy-profile-field").on("change", async ev => {
      const i = Number(ev.currentTarget.dataset.index);
      const field = ev.currentTarget.dataset.field;
      const arr = foundry.utils.deepClone(this.item.system.profiles || []);
      if (!arr[i]) return;
      arr[i][field] = field === "penetration" ? (parseInt(ev.currentTarget.value) || 0) : ev.currentTarget.value;
      await this.item.update({ "system.profiles": arr });
    });

    // ── Психосила: вариации броска (разные модификаторы/цели) ────────────────────
    html.find(".psy-variant-add").on("click", async () => {
      const arr = foundry.utils.deepClone(this.item.system.variants || []);
      arr.push({ label: "", testMod: 0, note: "" });
      await this.item.update({ "system.variants": arr });
    });
    html.find(".psy-variant-remove").on("click", async ev => {
      const i = Number(ev.currentTarget.dataset.index);
      const arr = (this.item.system.variants || []).filter((_, idx) => idx !== i);
      await this.item.update({ "system.variants": arr });
    });
    html.find(".psy-variant-field").on("change", async ev => {
      const i = Number(ev.currentTarget.dataset.index);
      const field = ev.currentTarget.dataset.field;
      const arr = foundry.utils.deepClone(this.item.system.variants || []);
      if (!arr[i]) return;
      arr[i][field] = field === "testMod" ? (parseInt(ev.currentTarget.value) || 0) : ev.currentTarget.value;
      await this.item.update({ "system.variants": arr });
    });

    // ── Оружие: доп. профили ББ (Крюк/Посох, стр. 207-221) ──────────────────────
    const profIdxOf = el => Number(el.closest(".wprofile-card")?.dataset.idx);
    html.find(".wprofile-add").on("click", async () => {
      const arr = foundry.utils.deepClone(this.item.system.profiles || []);
      arr.push({ label: "", damage: "", damageType: "rending", penetration: 0, range: "", weaponProps: [] });
      await this.item.update({ "system.profiles": arr });
    });
    html.find(".wprofile-del").on("click", async ev => {
      const i = profIdxOf(ev.currentTarget);
      const arr = (this.item.system.profiles || []).filter((_, idx) => idx !== i);
      await this.item.update({ "system.profiles": arr });
    });
    html.find(".wprofile-field").on("change", async ev => {
      const i = profIdxOf(ev.currentTarget);
      const field = ev.currentTarget.dataset.field;
      const arr = foundry.utils.deepClone(this.item.system.profiles || []);
      if (!arr[i]) return;
      arr[i][field] = field === "penetration" ? (parseInt(ev.currentTarget.value) || 0) : ev.currentTarget.value;
      await this.item.update({ "system.profiles": arr });
    });
    // Свойства конкретного профиля (свой блок Devastating/Primitive и т.п.)
    html.find(".wprofile-prop-add").on("change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const i = profIdxOf(ev.currentTarget);
      const arr = foundry.utils.deepClone(this.item.system.profiles || []);
      if (!arr[i]) return;
      arr[i].weaponProps = Array.isArray(arr[i].weaponProps) ? arr[i].weaponProps : [];
      if (!arr[i].weaponProps.some(p => p.key === key))
        arr[i].weaponProps.push({ key, rating: 0, rating2: 0 });
      await this.item.update({ "system.profiles": arr });
    });
    html.find(".wprofile-prop-remove").on("click", async ev => {
      const i = profIdxOf(ev.currentTarget);
      const key = ev.currentTarget.dataset.key;
      const arr = foundry.utils.deepClone(this.item.system.profiles || []);
      if (!arr[i]) return;
      arr[i].weaponProps = (arr[i].weaponProps || []).filter(p => p.key !== key);
      await this.item.update({ "system.profiles": arr });
    });
    html.find(".wprofile-prop-rating").on("change", async ev => {
      const i = profIdxOf(ev.currentTarget);
      const key = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const raw = ev.currentTarget.value;
      const val = ev.currentTarget.type === "number" ? (parseInt(raw) || 0) : raw;
      const arr = foundry.utils.deepClone(this.item.system.profiles || []);
      if (!arr[i]) return;
      const p = (arr[i].weaponProps || []).find(x => x.key === key);
      if (!p) return;
      p[field] = val;
      await this.item.update({ "system.profiles": arr });
    });

    // ── Усиление оружия психосилой: особые свойства (тот же список) ──────────────
    html.find(".wbuff-add-select").on("change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const props = foundry.utils.deepClone(this.item.system.effects?.weaponBuff?.addProps || []);
      if (!props.some(p => p.key === key)) {
        props.push({ key, rating: 0, rating2: 0 });
        await this.item.update({ "system.effects.weaponBuff.addProps": props });
      }
    });
    html.find(".wbuff-remove").on("click", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const props = (this.item.system.effects?.weaponBuff?.addProps || []).filter(p => p.key !== key);
      await this.item.update({ "system.effects.weaponBuff.addProps": props });
    });
    html.find(".wbuff-rating").on("change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = parseInt(ev.currentTarget.value) || 0;
      const props = foundry.utils.deepClone(this.item.system.effects?.weaponBuff?.addProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.effects.weaponBuff.addProps": props }); }
    });
    html.find(".wbuff-rating-dice").on("change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = ev.currentTarget.value.trim();
      const props = foundry.utils.deepClone(this.item.system.effects?.weaponBuff?.addProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.effects.weaponBuff.addProps": props }); }
    });

    // ── Свойства узла корабля ───────────────────────────────────────────────────
    html.find(".shipprop-add-select").on("change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const props = foundry.utils.deepClone(this.item.system.shipProps || []);
      if (!props.some(p => p.key === key)) {
        props.push({ key, rating: 0, rating2: 0 });
        await this.item.update({ "system.shipProps": props });
      }
    });
    html.find(".shipprop-remove").on("click", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const props = (this.item.system.shipProps || []).filter(p => p.key !== key);
      await this.item.update({ "system.shipProps": props });
    });
    html.find(".shipprop-rating").on("change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = parseInt(ev.currentTarget.value) || 0;
      const props = foundry.utils.deepClone(this.item.system.shipProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.shipProps": props }); }
    });

    // ── Бонусы характеристик (множественные) психосилы / техночуда ──────────────
    html.find(".cbonus-add").on("change", async ev => {
      const stat = ev.currentTarget.value;
      if (!stat) return;
      const arr = foundry.utils.deepClone(this.item.system.effects?.charBonuses || []);
      if (!arr.some(c => c.stat === stat)) {
        arr.push({ stat, value: 0 });
        await this.item.update({ "system.effects.charBonuses": arr });
      }
    });
    html.find(".cbonus-remove").on("click", async ev => {
      const stat = ev.currentTarget.dataset.stat;
      const arr  = (this.item.system.effects?.charBonuses || []).filter(c => c.stat !== stat);
      await this.item.update({ "system.effects.charBonuses": arr });
    });
    html.find(".cbonus-value").on("change", async ev => {
      const stat = ev.currentTarget.dataset.stat;
      const val  = parseInt(ev.currentTarget.value) || 0;
      const arr  = foundry.utils.deepClone(this.item.system.effects?.charBonuses || []);
      const c    = arr.find(x => x.stat === stat);
      if (c) { c.value = val; await this.item.update({ "system.effects.charBonuses": arr }); }
    });

    // ── Бонусы к ЗНАЧЕНИЮ характеристики (обычный +X, не Unnatural) ──────────────
    html.find(".cvbonus-add").on("change", async ev => {
      const stat = ev.currentTarget.value;
      if (!stat) return;
      const arr = foundry.utils.deepClone(this.item.system.effects?.charValueBonuses || []);
      if (!arr.some(c => c.stat === stat)) {
        arr.push({ stat, value: 0 });
        await this.item.update({ "system.effects.charValueBonuses": arr });
      }
    });
    html.find(".cvbonus-remove").on("click", async ev => {
      const stat = ev.currentTarget.dataset.stat;
      const arr  = (this.item.system.effects?.charValueBonuses || []).filter(c => c.stat !== stat);
      await this.item.update({ "system.effects.charValueBonuses": arr });
    });
    html.find(".cvbonus-value").on("change", async ev => {
      const stat = ev.currentTarget.dataset.stat;
      const val  = parseInt(ev.currentTarget.value) || 0;
      const arr  = foundry.utils.deepClone(this.item.system.effects?.charValueBonuses || []);
      const c    = arr.find(x => x.stat === stat);
      if (c) { c.value = val; await this.item.update({ "system.effects.charValueBonuses": arr }); }
    });

    // ── Доп. типы психосилы / техночуда ────────────────────────────────────────
    html.find(".xtype-add-select").on("change", async ev => {
      const type = ev.currentTarget.value;
      if (!type) return;
      const arr = foundry.utils.deepClone(this.item.system.extraTypes || []);
      if (!arr.some(e => e.type === type)) {
        arr.push({ type, x: 0 });
        await this.item.update({ "system.extraTypes": arr });
      }
    });
    html.find(".xtype-remove").on("click", async ev => {
      const type = ev.currentTarget.dataset.type;
      const arr  = (this.item.system.extraTypes || []).filter(e => e.type !== type);
      await this.item.update({ "system.extraTypes": arr });
    });
    html.find(".xtype-x").on("change", async ev => {
      const type = ev.currentTarget.dataset.type;
      const val  = parseInt(ev.currentTarget.value) || 0;
      const arr  = foundry.utils.deepClone(this.item.system.extraTypes || []);
      const e    = arr.find(x => x.type === type);
      if (e) { e.x = val; await this.item.update({ "system.extraTypes": arr }); }
    });

    // ── Модификация оружия: даруемые/убираемые свойства ────────────────────────
    html.find(".modprop-add").on("change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const arr = foundry.utils.deepClone(this.item.system.effects?.addProps || []);
      if (!arr.some(p => p.key === key)) {
        arr.push({ key, rating: 0, rating2: 0 });
        await this.item.update({ "system.effects.addProps": arr });
      }
    });
    html.find(".modprop-remove").on("click", async ev => {
      const key = ev.currentTarget.dataset.key;
      const arr = (this.item.system.effects?.addProps || []).filter(p => p.key !== key);
      await this.item.update({ "system.effects.addProps": arr });
    });
    html.find(".modprop-rating").on("change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = parseInt(ev.currentTarget.value) || 0;
      const arr   = foundry.utils.deepClone(this.item.system.effects?.addProps || []);
      const p     = arr.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.effects.addProps": arr }); }
    });
    html.find(".modrem-add").on("change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const arr = foundry.utils.deepClone(this.item.system.effects?.removeProps || []);
      if (!arr.includes(key)) { arr.push(key); await this.item.update({ "system.effects.removeProps": arr }); }
    });
    html.find(".modrem-remove").on("click", async ev => {
      const key = ev.currentTarget.dataset.key;
      const arr = (this.item.system.effects?.removeProps || []).filter(k => k !== key);
      await this.item.update({ "system.effects.removeProps": arr });
    });

    // ── Талант: склонности ─────────────────────────────────────────────────────
    html.find(".apt-add").on("change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const arr = foundry.utils.deepClone(this.item.system.aptitudes || []);
      if (!arr.includes(key)) { arr.push(key); await this.item.update({ "system.aptitudes": arr }); }
    });
    html.find(".apt-remove").on("click", async ev => {
      const key = ev.currentTarget.dataset.key;
      const arr = (this.item.system.aptitudes || []).filter(k => k !== key);
      await this.item.update({ "system.aptitudes": arr });
    });

    // ── Модификация брони: даруемые свойства (чекбоксы) ────────────────────────
    html.find(".armormod-prop-cb").on("change", () => {
      const props = [];
      html.find(".armormod-prop-cb:checked").each((_, cb) => props.push(cb.dataset.prop));
      this.item.update({ "system.effects.addProps": props });
    });

    // ── Особенности брони (как у оружия: добавление чипами) ────────────────────
    html.find(".aprop-add-select").on("change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const props = [...(this.item.system.properties || [])];
      if (!props.includes(key)) {
        props.push(key);
        await this.item.update({ "system.properties": props });
      }
    });
    html.find(".aprop-remove").on("click", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const props = (this.item.system.properties || []).filter(p => p !== key);
      await this.item.update({ "system.properties": props });
    });

    // ── Типы боеприпасов ──────────────────────────────────────────────────────
    html.find(".ammo-type-cb").on("change", () => {
      const types = [];
      html.find(".ammo-type-cb:checked").each((_, cb) => types.push(cb.dataset.type));
      this.item.update({ "system.weaponTypes": types });
    });

    // ── Силовой щит ───────────────────────────────────────────────────────────
    html.find(".shield-nature-select").on("change", ev => {
      this.item.update({ "system.shieldNature": ev.currentTarget.value });
    });
    html.find(".shield-type-select").on("change", ev => {
      this.item.update({ "system.shieldType": ev.currentTarget.value });
    });
    html.find(".shield-special-rating-cb").on("change", ev => {
      this.item.update({ "system.isSpecialRating": ev.currentTarget.checked });
    });
    // ── Яд: чекбоксы вектора доставки ────────────────────────────────────────
    html.find(".poison-vector-cb").on("change", () => {
      const vectors = [];
      html.find(".poison-vector-cb:checked").each((_, cb) => vectors.push(cb.dataset.vector));
      this.item.update({ "system.poisonVector": vectors });
    });

    // ── Зависимость: показать/скрыть блок ────────────────────────────────────
    html.find(".drug-addiction-toggle").on("change", ev => {
      this.item.update({ "system.addiction.hasAddiction": ev.currentTarget.checked });
    });
  }
}