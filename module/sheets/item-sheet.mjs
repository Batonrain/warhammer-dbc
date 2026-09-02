import { armourHistoryContext, rollArmourTable, rollArmourEntry,
         rollArmourZones, setArmourEntry, clearArmourHistory } from "../apps/armour-history.mjs";
import { infoguardContext, rollInfoguard }                    from "../apps/infoguard.mjs";
import { submutationContext, rollSubmutation,
         pickSubmutation, clearSubmutation }                   from "../apps/submutations.mjs";
import { legacyContext, rollAscension, breakLegacy, setHistory, rollHistory,
         rollMutation, addCustomMutation, removeMutation,
         legacyPrompt }                                        from "../apps/legacy-weapon.mjs";
import { shipQualityMods, qualityOptionsFor, effectiveWeapon, clampQuality, QUALITY_LABELS }
  from "../constants/ship-quality.mjs";
import { availableFieldModes, fieldSuitFor } from "../constants/drukhari-armor-fields.mjs";
import { isAutoAnimationsActive } from "../integrations/autoanimations.mjs";
// module/sheets/item-sheet.mjs

import { ARMOR_PROPERTIES,
         DRUG_CATEGORIES, DRUG_DELIVERY,
         DRUG_CHAR_KEYS, WEAPON_MOD_GROUPS,
         ARMOR_MOD_GROUPS, GEAR_CATEGORIES,
         TOOL_CATEGORIES, RIG_COMFORT, RIG_SLOT_SIZES, ITEM_TYPES } from "../constants/items.mjs";
import { qualityEffects, itemSpecificQuality }       from "../constants/quality.mjs";
import { implantMech }                               from "../constants/implant-mechanics.mjs";
import { susAnHealButtonHtml, useSusAnHeal }         from "../apps/sus-an-heal.mjs";
import { tranceButtonHtml, useTrance }               from "../apps/armour-history-trance.mjs";
import { handOfDeathButtonHtml, useHandOfDeath }     from "../apps/hand-of-death.mjs";
import { addictionPanelHtml, useSatisfyAddiction }   from "../apps/addiction.mjs";
import { vampiricPanelHtml, useSatisfyVampiric, useVampiricTest } from "../apps/vampiric-dependency.mjs";
import { cancerousHealingButtonHtml, useCancerousHealing } from "../apps/cancerous-healing.mjs";
import { flayedButtonHtml, useFlayed }               from "../apps/flayed.mjs";
import { hasVoidSupply, voidAirRemainingDisplay, sealVoidArmour, refillVoidArmour } from "../rules/void-air.mjs";
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
import { dynamicAptKind }                            from "../constants/advancement.mjs";
import { masteryTargets }                            from "../rules/mastery-targets.mjs";
import { activeRunicWeaveId, siblingRunicWeaves }    from "../rules/runic-weave.mjs";
import { RUNIC_WEAVE_POSITIONS, RUNIC_WEAVE_INSTALLED_ON_TYPES,
         RUNIC_WEAVE_SURFACE_KINDS }                  from "../constants/runic-weaves.mjs";
import { PSY_DISCIPLINES, TECH_DISCIPLINES,
         buildDisciplineContext }                    from "../constants/disciplines.mjs";
import { DW_GODS_MAP }                               from "../constants/demon-weapon.mjs";
import { summarizeEffectChanges, expectedPhase }     from "../constants/effect-keys.mjs";
import { createBlankEffect } from "../apps/effects.mjs";
import { getItemMechanics, blankMechGroup, blankMechEntry, buildMechanicsTabHtml,
         saveItemMechanics, findMechGroup, findMechEntry, runMechScriptEntry,
         getItemRequirements, blankReqGroup, blankReqEntry, buildRequirementsHtml } from "../apps/mechanics.mjs";
import { specOptions }                               from "../constants/skill-specializations.mjs";
import { buildEliteReqHtml, activateEliteReqListeners } from "../apps/elite-req-builder.mjs";
import { RITUAL_ITEM_TYPES, RITUAL_TYPES }            from "../constants/rituals.mjs";
import { openCompendiumBrowser }                     from "../apps/compendium-browser.mjs";
import { factionTarget, actorTypeTarget, allTarget, raceTarget, featureTarget, patronTarget,
         TARGET_FEATURES, PATRON_ANY, addTarget, removeTargetAt } from "../rules/talent-targets.mjs";
import { RACES, SUBRACES }                           from "../constants/races.mjs";
import { WARP_GODS }                                 from "../constants/veil.mjs";
import { disabledRaceKeys }                          from "../constants/features.mjs";
import { factionKey, factionAncestors, factionParentKey, factionAlsoKeys,
         getFactionIndex }                           from "../rules/factions.mjs";
import { factionRosterContext, originTreeContext,
         activateFactionRosterListeners, activateOriginTreeListeners }
                                                     from "../apps/faction-roster.mjs";
import { ritualTestContext }                         from "./tabs/rituals.mjs";
import { onTab, whenEditable, linesToArray }         from "./v2-helpers.mjs";
import { relayItemUpdate }                           from "../helpers/utils.mjs";

// Метка типа (в PSY это строки, в TECH — объекты {label})
function _typeLabel(map, key) {
  const v = map[key];
  return typeof v === "string" ? v : (v?.label ?? key);
}

// ── Сохранение Механики и Требований ────────────────────────────────────────
// Приём один на оба блока: read-mutate-clone-save. Полагаемся на авто-рендер
// листа после setFlag, а не на живую перестройку DOM вручную.
//
// Помощники живут на уровне модуля, потому что их зовут и действия
// [data-action] (тоже модульные), и change-обработчики в _onRender — там
// стоят однострочные переходники, подставляющие this.item.

/**
 * Сохранение Механики живёт в mechanics.mjs: писать её умеет не только лист
 * (без прав на предмет правка уходит Мастеру по сокету), поэтому путь один на
 * всех, а здесь — только короткое имя.
 */
const saveMechanics = (item, arr) => saveItemMechanics(item, arr);

// Какой набор групп требований правим («req» ритуалиста или «assistReq»
// ассистентов) — в data-req, поэтому один комплект обработчиков обслуживает
// оба блока сразу.
const reqGroupsOf      = (item, key)      => foundry.utils.deepClone(getItemRequirements(item, key));
const saveRequirements = (item, key, arr) => item.setFlag("warhammer-dbc", key, arr);
const findReqGroup     = (arr, id)        => arr.find(g => g.id === id) || null;
const findReqEntry     = (arr, gid, eid)  => findReqGroup(arr, gid)?.entries?.find(e => e.id === eid) || null;

/** Правка поля записи требования — общий помощник, чтобы не плодить одинаковый код. */
function patchReqEntry(item, el, fn) {
  const key = el.dataset.req;
  const arr = reqGroupsOf(item, key);
  const e   = findReqEntry(arr, el.dataset.groupId, el.dataset.entryId);
  if (!e) return;
  fn(e, el);
  return saveRequirements(item, key, arr);
}

// ── Действия листа ───────────────────────────────────────────────────────────
// ApplicationV2 зовёт обработчик [data-action] с this = лист и элементом-
// источником вторым аргументом. Обычные функции — чтобы карта действий
// сверялась с шаблоном тестом.

// ── Доступно и тому, кто лист не правит ──
// В V1 эти обработчики вешались до проверки isEditable; права на сам документ
// проверяет ядро при update, а кнопки Механики и Требований рисуются только ГМ.

/** Режим поля друкхарийской брони — ровно один активный. */
function onFieldMode(event, target) {
  return this.item.update({ "system.fieldMode": target.dataset.fieldMode || "" });
}

// ── Automated Animations (module/integrations/autoanimations.mjs) ──────────
// AA 4.2.84 добавляет свою кнопку «A-A» только через устаревший V1-хук
// getItemSheetHeaderButtons; наш лист построен на ItemSheetV2, и Foundry v14
// этот хук для него не зовёт (ни старый, ни новый getHeaderControlsApplicationV2 —
// проверено живьём, см. память doombc-autoanimations-integration). Дёргаем
// хук сами и переиспользуем готовый onclick — он открывает штатное меню AA,
// без правки самого модуля.
function onOpenAutoAnimations() {
  if (!isAutoAnimationsActive()) return;
  const buttons = [];
  Hooks.callAll("getItemSheetHeaderButtons", { item: this.item }, buttons);
  buttons.find(b => b.class === "aaItemSettings")?.onclick?.();
}

// ── Эффекты (Active Effect Foundry) — общая вкладка для всех типов ──
function onEffectCreate() { return createBlankEffect(this.item); }

function onEffectEdit(event, target) {
  this.item.effects.get(target.dataset.effectId)?.sheet?.render(true);
}

function onEffectDelete(event, target) {
  return this.item.effects.get(target.dataset.effectId)?.delete();
}

// ── МЕХАНИКА: группы И/ИЛИ и записи ──
function onGrantGroupAdd(event, target) {
  const arr = foundry.utils.deepClone(getItemMechanics(this.item));
  arr.push(blankMechGroup(target.dataset.op === "OR" ? "OR" : "AND"));
  return saveMechanics(this.item, arr);
}

function onGrantGroupRemove(event, target) {
  const id = target.dataset.groupId;
  return saveMechanics(this.item, getItemMechanics(this.item).filter(g => g.id !== id));
}

function onGrantOpToggle(event, target) {
  const arr = foundry.utils.deepClone(getItemMechanics(this.item));
  const g = findMechGroup(arr, target.dataset.groupId);
  if (!g) return;
  g.operator = g.operator === "OR" ? "AND" : "OR";
  return saveMechanics(this.item, arr);
}

function onGrantEntryAdd(event, target) {
  const arr = foundry.utils.deepClone(getItemMechanics(this.item));
  const g = findMechGroup(arr, target.dataset.groupId);
  if (!g) return;
  g.entries.push(blankMechEntry());
  return saveMechanics(this.item, arr);
}

function onGrantEntryRemove(event, target) {
  const arr = foundry.utils.deepClone(getItemMechanics(this.item));
  const g = findMechGroup(arr, target.dataset.groupId);
  if (!g) return;
  g.entries = g.entries.filter(e => e.id !== target.dataset.entryId);
  return saveMechanics(this.item, arr);
}

// «Когда» (entry.when.conditions) — варианты одного условия, ИЛИ между ними
// (см. buildEntryWhenHtml/entryWhenOk в mechanics.mjs).
function onGrantWhenAdd(event, target) {
  const arr = foundry.utils.deepClone(getItemMechanics(this.item));
  const e = findMechEntry(arr, target.dataset.groupId, target.dataset.entryId);
  if (!e) return;
  e.when = e.when || { negate: false, conditions: [] };
  e.when.conditions.push({ legion: "", chapter: "" });
  return saveMechanics(this.item, arr);
}

function onGrantWhenRemove(event, target) {
  const arr = foundry.utils.deepClone(getItemMechanics(this.item));
  const e = findMechEntry(arr, target.dataset.groupId, target.dataset.entryId);
  if (!e || !e.when) return;
  const idx = parseInt(target.dataset.whenIdx);
  e.when.conditions = (e.when.conditions || []).filter((_, i) => i !== idx);
  return saveMechanics(this.item, arr);
}

/** Черта / Талант: сброс перетащенного (сам дроп резолвится в _onDropGrantItem). */
function onGrantDropClear(event, target) {
  const arr = foundry.utils.deepClone(getItemMechanics(this.item));
  const e = findMechEntry(arr, target.dataset.groupId, target.dataset.entryId);
  if (!e) return;
  Object.assign(e, { sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "", specialization: "" });
  return saveMechanics(this.item, arr);
}

/** Оружие: Свойство — сброс зоны (saveMechanics сам досчитывает mechAddProps/mechRemoveProps). */
function onWpropDropClear(event, target) {
  const arr = foundry.utils.deepClone(getItemMechanics(this.item));
  const e = findMechEntry(arr, target.dataset.groupId, target.dataset.entryId);
  if (!e) return;
  const prefix = target.dataset.slot === "newProp" ? "weaponPropNew" : "weaponProp";
  e[`${prefix}Key`] = ""; e[`${prefix}Label`] = ""; e[`${prefix}HasRating`] = false; e[`${prefix}HasRating2`] = false;
  if (prefix === "weaponProp" && (e.weaponPropAction === "increase" || e.weaponPropAction === "decrease")) {
    e.weaponPropAction = "add";
  }
  return saveMechanics(this.item, arr);
}

// ── ТРЕБОВАНИЯ (Ритуал) ──
function onReqGroupAdd(event, target) {
  const key = target.dataset.req;
  const arr = reqGroupsOf(this.item, key);
  arr.push(blankReqGroup(target.dataset.op === "OR" ? "OR" : "AND"));
  return saveRequirements(this.item, key, arr);
}

function onReqGroupRemove(event, target) {
  const key = target.dataset.req;
  return saveRequirements(this.item, key,
    reqGroupsOf(this.item, key).filter(g => g.id !== target.dataset.groupId));
}

function onReqOpToggle(event, target) {
  const key = target.dataset.req;
  const arr = reqGroupsOf(this.item, key);
  const g = findReqGroup(arr, target.dataset.groupId);
  if (!g) return;
  g.operator = g.operator === "OR" ? "AND" : "OR";
  return saveRequirements(this.item, key, arr);
}

function onReqEntryAdd(event, target) {
  const key = target.dataset.req;
  const arr = reqGroupsOf(this.item, key);
  const g = findReqGroup(arr, target.dataset.groupId);
  if (!g) return;
  g.entries.push(blankReqEntry());
  return saveRequirements(this.item, key, arr);
}

function onReqEntryRemove(event, target) {
  const key = target.dataset.req;
  const arr = reqGroupsOf(this.item, key);
  const g = findReqGroup(arr, target.dataset.groupId);
  if (!g) return;
  g.entries = g.entries.filter(e => e.id !== target.dataset.entryId);
  return saveRequirements(this.item, key, arr);
}

function onReqDropClear(event, target) {
  return patchReqEntry(this.item, target, e => {
    Object.assign(e, { sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false });
  });
}

// ── Особенность комплекта силовой брони ──
function onInfoguardRoll() { return rollInfoguard(this.item); }

function onPaRollTable() { return rollArmourTable(this.item); }
function onPaRollZones() { return rollArmourZones(this.item); }
function onPaClear()     { return clearArmourHistory(this.item); }
function onPaRollEntry() {
  return rollArmourEntry(this.item,
    this.element.querySelector(".pa-table-select")?.value || this.item.system.history?.table);
}

// ── Субмутация (корбук, стр. 440) ──
function onSubRoll()  { return rollSubmutation(this.item); }
function onSubClear() { return clearSubmutation(this.item); }
function onSubPick()  {
  return pickSubmutation(this.item, this.element.querySelector(".sub-entry-select")?.value);
}

// ── Правящие действия ──

/** Сборка торпеды из грузов корабля: сколько собрать — в поле рядом с кнопкой. */
function onTorpedoAssemble() {
  return this._assembleTorpedo(parseInt(this.element.querySelector(".torpedo-assemble-n")?.value) || 1);
}

function onWpropRemove(event, target) {
  const props = (this.item.system.weaponProps || []).filter(p => p.key !== target.dataset.key);
  return this.item.update({ "system.weaponProps": props });
}

/** Освободить демона: снять осквернение (стать Руническим Оружием). */
async function onWmsRelease() {
  const dw = this.item.system.daemonWeapon || {};
  const hasSnap = Array.isArray(dw.preProps);
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
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Освободить демона" },
    content: "<p>Демон вырывается из оружия. Бросок d10 определит судьбу оружия (1-6 уничтожено, 7-10 → Руническое). Демоническое усиление снимается, родные свойства оружия сохраняются.</p>",
    yes: { label: "Освободить" }, no: { label: "Отмена" }
  });
  if (ok) await doRelease();
}

// ── Психосила: доп. профили атаки и вариации броска ──
function onPsyProfileAdd() {
  const arr = foundry.utils.deepClone(this.item.system.profiles || []);
  arr.push({ label: "", damage: "", damageType: "energy", penetration: 0, propsText: "", charDamageStat: "", charDamageFormula: "" });
  return this.item.update({ "system.profiles": arr });
}

function onPsyProfileRemove(event, target) {
  const i = Number(target.dataset.index);
  return this.item.update({ "system.profiles": (this.item.system.profiles || []).filter((_, idx) => idx !== i) });
}

function onPsyVariantAdd() {
  const arr = foundry.utils.deepClone(this.item.system.variants || []);
  arr.push({ label: "", testMod: 0, note: "" });
  return this.item.update({ "system.variants": arr });
}

function onPsyVariantRemove(event, target) {
  const i = Number(target.dataset.index);
  return this.item.update({ "system.variants": (this.item.system.variants || []).filter((_, idx) => idx !== i) });
}

// ── Оружие: доп. профили ББ (Крюк/Посох, стр. 207-221) ──
/** Номер профиля — на карточке, а не на самой кнопке. */
const profileIdx = el => Number(el.closest(".wprofile-card")?.dataset.idx);

function onWprofileAdd() {
  const arr = foundry.utils.deepClone(this.item.system.profiles || []);
  arr.push({ label: "", damage: "", damageType: "rending", penetration: 0, range: "", weaponProps: [] });
  return this.item.update({ "system.profiles": arr });
}

function onWprofileDel(event, target) {
  const i = profileIdx(target);
  return this.item.update({ "system.profiles": (this.item.system.profiles || []).filter((_, idx) => idx !== i) });
}

/** Свойства конкретного профиля (свой блок Devastating/Primitive и т.п.). */
function onWprofilePropRemove(event, target) {
  const i = profileIdx(target);
  const arr = foundry.utils.deepClone(this.item.system.profiles || []);
  if (!arr[i]) return;
  arr[i].weaponProps = (arr[i].weaponProps || []).filter(p => p.key !== target.dataset.key);
  return this.item.update({ "system.profiles": arr });
}

// ── Списки свойств и бонусов: удаление чипа ──
function onWbuffRemove(event, target) {
  const props = (this.item.system.effects?.weaponBuff?.addProps || []).filter(p => p.key !== target.dataset.key);
  return this.item.update({ "system.effects.weaponBuff.addProps": props });
}

function onShippropRemove(event, target) {
  const props = (this.item.system.shipProps || []).filter(p => p.key !== target.dataset.key);
  return this.item.update({ "system.shipProps": props });
}

function onCbonusRemove(event, target) {
  const arr = (this.item.system.effects?.charBonuses || []).filter(c => c.stat !== target.dataset.stat);
  return this.item.update({ "system.effects.charBonuses": arr });
}

function onXtypeRemove(event, target) {
  const arr = (this.item.system.extraTypes || []).filter(e => e.type !== target.dataset.type);
  return this.item.update({ "system.extraTypes": arr });
}

function onModpropRemove(event, target) {
  const arr = (this.item.system.effects?.addProps || []).filter(p => p.key !== target.dataset.key);
  return this.item.update({ "system.effects.addProps": arr });
}

function onModremRemove(event, target) {
  const arr = (this.item.system.effects?.removeProps || []).filter(k => k !== target.dataset.key);
  return this.item.update({ "system.effects.removeProps": arr });
}

function onAptRemove(event, target) {
  const arr = (this.item.system.aptitudes || []).filter(k => k !== target.dataset.key);
  return this.item.update({ "system.aptitudes": arr });
}

function onApropRemove(event, target) {
  const props = (this.item.system.properties || []).filter(p => p !== target.dataset.key);
  return this.item.update({ "system.properties": props });
}

/**
 * Окно с одним выпадающим списком — общее для всех выборов цели Таланта.
 *
 * DialogV2, а не Dialog: лист предмета переведён на ApplicationV2, и jQuery в
 * нём больше нет (контракт проверяется тестом v2-sheet-contract).
 *
 * @param {object} o title/prompt/options — заголовок, вопрос и готовый HTML
 *   вариантов; withLabel просит вернуть не ключ, а пару {key, label}.
 * @returns {Promise<?string|?{key: string, label: string}>} null — отмена.
 */
function pickFromList({ title, prompt, options, withLabel = false }) {
  // `false`, а не `null`, во всех callback'ах ниже: DialogV2 резолвит результат
  // как `(await callback(...)) ?? button.action` (scripts/foundry.mjs,
  // DialogV2#_onSubmit) — `null`/`undefined` там подменяются на сам action и
  // возвращают строку «cancel»/«ok». Она непустая, проходит `if (!kind) return`
  // у вызывающих и уезжает дальше как настоящий выбор. `false` переживает `??`
  // и здесь же переводится обратно в задокументированный null.
  return foundry.applications.api.DialogV2.wait({
    window: { title },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<div class="wh-holo-dialog">
      <p>${prompt}</p>
      <select class="wh-pick-select" style="width:100%">${options}</select>
    </div>`,
    buttons: [
      {
        action: "ok", label: "Далее", default: true,
        callback: (event, button) => {
          const sel = button.form.querySelector(".wh-pick-select");
          if (!sel?.value) return false;
          return withLabel
            ? { key: sel.value, label: sel.selectedOptions[0].textContent }
            : sel.value;
        }
      },
      { action: "cancel", label: "Отмена", callback: () => false }
    ],
    rejectClose: false
  }).then(res => res === false ? null : res);
}

export class WarhammerItemSheet
  extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

  /** @override — без модуля Automated Animations кнопки в шапке нет. */
  _getHeaderControls() {
    const controls = super._getHeaderControls();
    return isAutoAnimationsActive() ? controls : controls.filter(c => c.action !== "openAutoAnimations");
  }

  static DEFAULT_OPTIONS = {
    // item-sheet — на самой форме листа: CSS цепляется за «.warhammer-dbc.item-sheet»,
    // а у V1 этот класс нёс <form> в шаблоне. Класс по типу предмета
    // («weapon-sheet» и т.п.) добавляется в _onRender: он динамический.
    classes: ["warhammer-dbc", "sheet", "item", "wh-holo", "item-sheet"],
    position: { width: 600, height: 640 },
    // controls — объявлен всегда: game.modules ещё не гарантированно готов в
    // момент вычисления static DEFAULT_OPTIONS (модульная загрузка идёт до
    // ready). Прячет кнопку без модуля _getHeaderControls() на рендере;
    // onOpenAutoAnimations проверяет активность ещё раз по клику.
    window: { resizable: true, controls: [
      { icon: "fa-solid fa-film", label: "Automated Animations", action: "openAutoAnimations" }
    ] },
    form: { submitOnChange: true, closeOnSubmit: false },
    dragDrop: [{ dragSelector: null, dropSelector: ".effects-drop-target, .grant-drop-zone, .wprop-drop-zone" }],
    actions: {
      tab: onTab,
      fieldMode: onFieldMode,
      openAutoAnimations: onOpenAutoAnimations,
      effectCreate: onEffectCreate,
      effectEdit: onEffectEdit,
      effectDelete: onEffectDelete,
      grantGroupAdd: onGrantGroupAdd,
      grantGroupRemove: onGrantGroupRemove,
      grantOpToggle: onGrantOpToggle,
      grantEntryAdd: onGrantEntryAdd,
      grantEntryRemove: onGrantEntryRemove,
      grantWhenAdd: onGrantWhenAdd,
      grantWhenRemove: onGrantWhenRemove,
      grantDropClear: onGrantDropClear,
      wpropDropClear: onWpropDropClear,
      reqGroupAdd: onReqGroupAdd,
      reqGroupRemove: onReqGroupRemove,
      reqOpToggle: onReqOpToggle,
      reqEntryAdd: onReqEntryAdd,
      reqEntryRemove: onReqEntryRemove,
      reqDropClear: onReqDropClear,
      infoguardRoll: whenEditable(onInfoguardRoll),
      paRollTable: onPaRollTable,
      paRollEntry: onPaRollEntry,
      paRollZones: onPaRollZones,
      paClear: onPaClear,
      subRoll: onSubRoll,
      subPick: onSubPick,
      subClear: onSubClear,
      // Ниже — то, что в V1 висело после общей проверки isEditable.
      torpedoAssemble: whenEditable(onTorpedoAssemble),
      wpropRemove: whenEditable(onWpropRemove),
      wmsRelease: whenEditable(onWmsRelease),
      psyProfileAdd: whenEditable(onPsyProfileAdd),
      psyProfileRemove: whenEditable(onPsyProfileRemove),
      psyVariantAdd: whenEditable(onPsyVariantAdd),
      psyVariantRemove: whenEditable(onPsyVariantRemove),
      wprofileAdd: whenEditable(onWprofileAdd),
      wprofileDel: whenEditable(onWprofileDel),
      wprofilePropRemove: whenEditable(onWprofilePropRemove),
      wbuffRemove: whenEditable(onWbuffRemove),
      shippropRemove: whenEditable(onShippropRemove),
      cbonusRemove: whenEditable(onCbonusRemove),
      xtypeRemove: whenEditable(onXtypeRemove),
      modpropRemove: whenEditable(onModpropRemove),
      modremRemove: whenEditable(onModremRemove),
      aptRemove: whenEditable(onAptRemove),
      apropRemove: whenEditable(onApropRemove)
    }
  };

  // scrollable — прокрутка тела листа переживает перерисовку. Без него любая
  // правка (а лист перерисовывается на каждое изменение) швыряла к самому
  // верху, и до Конструктора внизу вкладки приходилось мотать заново.
  static PARTS = {
    body: {
      template: "systems/warhammer-dbc/templates/item/item-sheet.hbs",
      root: true,
      scrollable: [".sheet-body"]
    }
  };

  // «СОСТАВ» объявлен для всех типов, а показывается только у Фракции (разметка
  // вкладки под {{#if}}): список вкладок статический, а тип предмета известен
  // лишь у экземпляра. Лишняя запись здесь безвредна — переключиться на неё
  // можно только по кнопке, которой у прочих типов нет.
  static TABS = {
    "item-primary": {
      initial: "info",
      tabs: [
        { id: "info",      label: "ИНФО" },
        { id: "effects",   label: "ЭФФЕКТЫ" },
        { id: "mechanics", label: "МЕХАНИКА" },
        { id: "roster",    label: "СОСТАВ" },
        { id: "notes",     label: "ЗАПИСИ" }
      ]
    }
  };

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
    const targetZone = event.target?.closest?.(".talent-target-drop");
    if (targetZone && data?.type === "Item") return this._onDropTalentTarget(event, data);
    // Зона Ауры несёт ОБА класса (.aura-drop-zone .grant-drop-zone), как и
    // зона Требования выше — проверяется РАНЬШЕ дженерик-зоны Черты/Таланта,
    // иначе _onDropGrantItem перезаписал бы kind:"aura" на trait/talent.
    const auraZone = event.target?.closest?.(".aura-drop-zone");
    if (auraZone && data?.type === "Item") return this._onDropAuraGrant(event, data, auraZone);
    const grantZone = event.target?.closest?.(".grant-drop-zone");
    if (grantZone && data?.type === "Item") return this._onDropGrantItem(event, data, grantZone);
    if (data?.type === "ActiveEffect") return this._onDropActiveEffect(event, data);
  }

  /**
   * Драг-н-дроп Фракции в список целей Таланта (Hatred, Peer, Enemy, Good
   * Reputation). Тот же приём, что у зоны требования выше: цели правит только
   * Мастер, а зона дропа disabled не бывает.
   */
  async _onDropTalentTarget(event, data) {
    if (!this.item.isOwner || !game.user.isGM) return;
    const src = await Item.implementation.fromDropData(data);
    if (!src) return;
    if (src.type !== "faction") {
      return ui.notifications.warn(
        `Сюда нужно перетащить Фракцию, а перетащено: ${ITEM_TYPES[src.type] || src.type}.`);
    }
    const target = factionTarget(src);
    if (!target) return ui.notifications.warn(`У фракции «${src.name}» не задан ключ — ссылаться не на что.`);
    const before = this.item.system.targets || [];
    const after = addTarget(before, target);
    if (after.length === before.length) return ui.notifications.info(`«${src.name}» уже в списке целей.`);
    await this.item.update({ "system.targets": after });
  }

  /**
   * Записать вышестоящую Фракцию в «Входит в состав».
   *
   * В поле уезжает КЛЮЧ, а не ссылка на документ (см. причину в шапке
   * module/data/item/faction.mjs). Общая часть для перетаскивания и кнопки
   * «＋»: оба пути обязаны одинаково отсеять чужой тип и кольцо в дереве.
   */
  async _setFactionParent(src) {
    if (!src) return;
    if (src.type !== "faction") {
      return ui.notifications.warn(
        `Сюда нужно перетащить Фракцию, а перетащено: ${ITEM_TYPES[src.type] || src.type}.`);
    }
    const parentKey = factionKey(src);
    if (!parentKey) return ui.notifications.warn(`У фракции «${src.name}» нет ключа — ссылаться не на что.`);

    // Сама себе вышестоящей быть не может, и нижестоящая тоже: получилось бы
    // кольцо, а дерево обходится вверх до корня. Обход такой цикл переживает
    // (factionChain обрывает и жалуется), но данные всё равно были бы врущими.
    const myKey = factionKey(this.item);
    if (parentKey === myKey) return ui.notifications.warn("Фракция не может входить в саму себя.");
    if (myKey && factionAncestors(parentKey, getFactionIndex()).has(myKey)) {
      return ui.notifications.warn(
        `«${src.name}» уже входит в состав этой фракции — кольца в дереве не бывает.`);
    }
    await this._updateFaction({ "system.parentKey": parentKey });
  }

  /**
   * Добавить дополнительную принадлежность («Также состоит в»).
   *
   * Кольцо проверяем по ОБЪЕДИНЕНИЮ связей: дополнительные ссылки образуют не
   * дерево, а сеть, и «служу тому, кто служит мне» так же бессмысленно, как
   * вассал собственного вассала.
   */
  async _addFactionAlso(src) {
    if (!src) return;
    if (src.type !== "faction") {
      return ui.notifications.warn(
        `Сюда нужно перетащить Фракцию, а перетащено: ${ITEM_TYPES[src.type] || src.type}.`);
    }
    const key = factionKey(src);
    if (!key) return ui.notifications.warn(`У фракции «${src.name}» нет ключа — ссылаться не на что.`);
    const myKey = factionKey(this.item);
    if (key === myKey) return ui.notifications.warn("Фракция не может состоять в самой себе.");

    const already = factionAlsoKeys(this.item);
    if (already.includes(key)) return ui.notifications.info(`«${src.name}» уже указана.`);
    if (myKey && factionAncestors(key, getFactionIndex()).has(myKey)) {
      return ui.notifications.warn(
        `«${src.name}» сама подпадает под эту фракцию — кольца не бывает.`);
    }
    await this._updateFaction({ "system.alsoIn": [...already, key] });
  }

  /**
   * Правка самой Фракции с понятным отказом.
   *
   * Лист фракции чаще всего открыт из компендиума, а закрытый пак Foundry
   * править не даёт — молчаливое «ничего не произошло» выглядит как поломка,
   * поэтому объясняем причину.
   */
  async _updateFaction(changes) {
    const pack = this.item.pack ? game.packs.get(this.item.pack) : null;
    if (pack?.locked) {
      return ui.notifications.warn(
        "Компендиум закрыт для правки — включите «Разрешить правку компендиумов» в настройках системы.");
    }
    if (!game.user.isGM) return ui.notifications.warn("Править фракции может только Мастер.");
    await this.item.update(changes);
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

    const want = entry.kind === "reqTalent" ? "talent"
      : entry.kind === "reqPower" ? "psychicPower" : "trait";
    if (src.type !== want) {
      const need = want === "talent" ? "Талант" : want === "psychicPower" ? "Психосилу" : "Черту";
      return ui.notifications.warn(
        `Сюда нужно перетащить ${need}, а перетащено: ${ITEM_TYPES[src.type] || src.type}.`);
    }
    entry.sourceUuid = src.uuid;
    entry.sourceName = src.name;
    entry.sourceImg  = src.img;
    entry.sourceHasRating = !!src.system?.hasRating;
    await this.item.setFlag("warhammer-dbc", reqKey, arr);
  }

  /**
   * Какого вида цель добавляем. Один список вместо трёх кнопок: видов немного,
   * а типы акторов всё равно нужно показать перечнем.
   *
   * @returns {Promise<?string>} "faction" | "race" | "all" | ключ типа актора;
   *   null — отмена.
   */
  _askTargetKind() {
    // Типы акторов берутся у Foundry, а подписи — из lang/ru.json (TYPES.Actor.*):
    // свой список разъехался бы с системой при добавлении типа.
    const actorTypes = (game.documentTypes?.Actor ?? []).filter(t => t !== "base");
    const opts = [
      `<option value="faction">Фракция…</option>`,
      `<option value="race">Раса…</option>`,
      `<option value="feature">Признак…</option>`,
      `<option value="patron">Покровительство…</option>`,
      `<option value="all">Все! (без разбора)</option>`,
      ...actorTypes.map(t =>
        `<option value="${t}">Тип существа: ${game.i18n.localize(`TYPES.Actor.${t}`)}</option>`)
    ].join("");

    return pickFromList({
      title: "Добавить цель", prompt: "Против кого действует талант?", options: opts
    });
  }

  /**
   * Выбор расы для цели-расы. Расы и субрасы в одном списке двумя группами:
   * ключи у них не пересекаются, а игроку важно только имя породы.
   *
   * Расы выключенных подсистем не показываем — как и в шапке листа персонажа.
   *
   * @returns {Promise<?{key: string, label: string}>} null — отмена.
   */
  _askRace() {
    const off = disabledRaceKeys();
    const group = (label, pairs) => {
      const opts = pairs
        .filter(([key]) => !off.includes(key))
        .sort((a, b) => a[1].localeCompare(b[1], "ru"))
        .map(([key, name]) => `<option value="${key}">${name}</option>`).join("");
      return opts ? `<optgroup label="${label}">${opts}</optgroup>` : "";
    };
    const html = group("Расы", Object.entries(RACES).map(([k, d]) => [k, d.label || d.name || k]))
               + group("Субрасы", Object.entries(SUBRACES));

    return pickFromList({
      title: "Цель: раса", prompt: "Против какой породы работает талант?",
      options: html, withLabel: true
    });
  }

  /**
   * Выбор признака для цели-признака: список берётся из реестра
   * (rules/talent-targets.mjs), свой перечень здесь разошёлся бы с проверкой.
   *
   * @returns {Promise<?string>} ключ признака; null — отмена.
   */
  _askFeature() {
    const opts = Object.entries(TARGET_FEATURES)
      .map(([key, def]) => `<option value="${key}">${def.label}</option>`).join("");
    return pickFromList({
      title: "Цель: признак", prompt: "По какому свойству существа работает талант?",
      options: opts
    });
  }

  /**
   * Выбор покровителя. «Любой покровитель» стоит первым: Ненависть к служащим
   * Губительным Силам вообще встречается не реже, чем к конкретному богу.
   *
   * @returns {Promise<?{key: string, label: string}>} null — отмена.
   */
  _askPatron() {
    const opts = [`<option value="${PATRON_ANY}">Любой покровитель</option>`]
      .concat(WARP_GODS.map(g => `<option value="${g.key}">${g.label}</option>`)).join("");
    return pickFromList({
      title: "Цель: покровительство", prompt: "Кому служит тот, против кого работает талант?",
      options: opts, withLabel: true
    });
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
    ent.sourceHasRating  = !!src.system.hasRating;
    ent.rating           = src.system.hasRating ? (src.system.rating ?? 0) : "";
    ent.specialization   = src.type === "talent" ? (src.system.specialization || "") : "";
    await saveMechanics(this.item, groups);
  }

  /**
   * Драг-н-дроп предмета в grant-зону записи kind:"aura" — в отличие от
   * _onDropGrantItem (Черта/Талант) НЕ трогает kind записи и НЕ ограничивает
   * тип перетащенного: движок ауры (module/regions/auras.mjs) клонирует
   * любой предмет по UUID, не только Черту/Талант.
   */
  async _onDropAuraGrant(event, data, dropZone) {
    const groupId = dropZone.dataset.groupId, entryId = dropZone.dataset.entryId;
    const src = await Item.implementation.fromDropData(data);
    if (!src) return;
    const groups = foundry.utils.deepClone(getItemMechanics(this.item));
    const ent = findMechEntry(groups, groupId, entryId);
    if (!ent) return;
    ent.sourceUuid = src.uuid;
    ent.sourceName = src.name;
    ent.sourceImg  = src.img;
    await saveMechanics(this.item, groups);
  }

  /**
   * Драг-н-дроп Свойства оружия (предмет type:"weaponProperty", компендиум
   * «Свойства оружия») на запись kind:"weaponProp" вкладки «Механика».
   * data-slot зоны: "prop" (основное свойство) или "newProp" (замена, только
   * при действии «заменить свойство») — пишет в соответствующую пару полей.
   */
  async _onDropWeaponPropItem(event, data, dropZone) {
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
    await saveMechanics(this.item, groups);
  }

  /** @override */
  _processFormData(event, form, formData) {
    // Субраса: «Снимает Черты» — ArrayField(StringField), а на листе это одна
    // textarea (по имени на строку). Foundry сама собирает массив примитивов
    // из формы, только когда одному имени поля отвечают НЕСКОЛЬКО input'ов —
    // одиночная textarea шлёт строку целиком, и без разбора она уйдёт в схему
    // как есть (ArrayField() у настоящего Foundry раскладывает строку по
    // символам — это годами будет незаметно ломать любое сохранение субрасы).
    if (this.item.type === "subrace" && typeof formData.object["system.removesTraits"] === "string") {
      formData.object["system.removesTraits"] = linesToArray(formData.object["system.removesTraits"]);
    }
    return super._processFormData(event, form, formData);
  }

  // Асинхронный не только по требованию V2: вкладке «Состав» Фракции нужны
  // акторы компендиумов, а они приходят загрузкой документов.
  async _prepareContext(options) {
    const context  = await super._prepareContext(options);
    context.item   = this.item;
    context.editable = this.isEditable;
    context.tab = this.tabGroups?.["item-primary"] ?? WarhammerItemSheet.TABS["item-primary"].initial;
    // Истории силовой брони — только для брони Астартес и при включённом расширении.
    context.armourHistory = armourHistoryContext(this.item);
    // Транс «Дух героя» — пусто у истории без транса (module/apps/armour-history-trance.mjs).
    context.tranceHtml    = tranceButtonHtml(this.item, this.item.parent);
    // Инфограждение — только у не-примитивных/не-мистических weapon/armor/gear/tool.
    context.infoguard     = infoguardContext(this.item);
    // Субмутации — только у мутаций, у которых таблица есть в тексте (стр. 440).
    context.submutation   = submutationContext(this.item);
    // Оружие Наследия — только у оружия (стр. 426-428).
    context.legacy        = legacyContext(this.item);
    context.system = this.item.system;
    // Легаси-эффекты (AP/charBonuses), уже перенесённые в ActiveEffect миграцией —
    // партиалы armor/tech-power/psychic-power.hbs прячут эти поля за флагом вместо
    // молчаливого расхождения с актором (wdbc-o80l).
    context.effectsMigrated = !!this.item.getFlag("warhammer-dbc", "migratedEffect");

    // ── Описание/Заметки: prose-mirror с переключаемым режимом (как у Journal
    // Entries) — пока не открыт на правку, показывается обогащённый HTML.
    context.descriptionEnriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.description || "", { relativeTo: this.item, secrets: this.item.isOwner });
    context.notesEnriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      context.system.notes || "", { relativeTo: this.item, secrets: this.item.isOwner });

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

    // ── Оружие, психосилы и техночудеса: особые свойства атаки (общий список) ──
    if (["weapon", "psychicPower", "techPower"].includes(this.item.type)) {
      const active     = context.system.weaponProps || [];
      const activeKeys = new Set(active.map(p => p.key));
      context.weaponPropsActive = active
        .map(p => ({
          key:     p.key,
          rating:  p.rating  ?? 0,
          rating2: p.rating2 ?? 0,
          def:     WEAPON_PROPERTIES[p.key],
          // Призма: текущий накопленный заряд (не рейтинг-максимум X, а живое
          // состояние на предмете) — своя мини-панель в чипе, не общий rating2.
          prismaCharge: p.key === "prisma" ? (context.system.prismaCharge ?? 0) : null
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

    // ── Узел/Корпус корабля: свойства (Aspects) ─────────────────────────────────
    if (this.item.type === "component" || this.item.type === "shipHull") {
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

    // ── Мутация: кнопки динамических источников Аблативных Ран (wdbc-w8ws) —
    // пусто у остальных Мутаций (isXItem проверяет имя, не capabilityKey).
    if (this.item.type === "mutation") {
      context.handOfDeathHtml = handOfDeathButtonHtml(this.item, this.item.parent);
      // ── «Зависимость»/«Вампирическая Зависимость» (wdbc-1rno) — состояние
      // утоления по игровому времени, пусто у остальных Мутаций ──────────────
      context.addictionHtml = addictionPanelHtml(this.item);
      context.vampiricHtml  = vampiricPanelHtml(this.item);
      context.cancerousHealingHtml = cancerousHealingButtonHtml(this.item, this.item.parent);
      context.flayedHtml = flayedButtonHtml(this.item, this.item.parent);
    }

    // ── Имплант: роспись механик (Качество + памятка) ────────────────────────────
    // Строки «Авто:» здесь больше нет: числовое (un/val/ap) переехало в сам
    // предмет и видно на вкладке ЭФФЕКТЫ, где его и правят (wdbc-cy2). Чип
    // рисовался по ИМЕНИ предмета и правку эффекта пережил бы — показывал бы
    // одно, а работало бы другое.
    if (this.item.type === "implant") {
      const mech = implantMech(this.item.name);
      if (mech) {
        context.implantMech = {
          traits: mech.traits || [],
          skills: mech.skills || [],
          q: (mech.q && Object.keys(mech.q).length) ? mech.q : null,
          note: mech.note || "",
          any: (mech.traits || []).length || (mech.skills || []).length || mech.note || (mech.q && Object.keys(mech.q).length),
        };
      }
      // Активное исцеление Сус-ан Мембраны у Призраков Смерти — пусто у всех
      // остальных владельцев того же органа (module/apps/sus-an-heal.mjs).
      context.susAnHealHtml = susAnHealButtonHtml(this.item, this.item.parent);
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

      // Подстройка под персонажа (wdbc-1rno, Custom Grip): список всех
      // акторов мира — модификация может путешествовать с оружием на другого
      // владельца, а "подстроена под" должно пережить эту передачу.
      context.modFittedToChoices = (game.actors ?? []).map(a => ({ id: a.id, name: a.name }));
    }

    // ── Фракция: вышестоящая, показанная фишкой ─────────────────────────────
    // В поле лежит КЛЮЧ (см. module/data/item/faction.mjs), а игроку нужна
    // подпись — берём её из каталога фракций. Каталога может не быть (мир ещё
    // грузится, фракция заведена не в компендиуме) — тогда показываем сам
    // ключ: «ссылка есть, но на что — сказать нечем» честнее пустоты.
    if (this.item.type === "faction") {
      // Ключ — только строка. Мусор («[object Object]» от старой записи
      // объектом) показываем как пустое поле, а не как фишку с этим текстом:
      // ссылки на такой ключ всё равно нет.
      const parentKey = factionParentKey(this.item);
      const known = parentKey ? getFactionIndex().get(parentKey) : null;
      context.factionParent = parentKey
        ? { key: parentKey, name: known?.name || parentKey, img: known?.img || "" }
        : null;
      // Дополнительные принадлежности — фишками, как цели Таланта.
      context.factionAlso = factionAlsoKeys(this.item).map(key => {
        const doc = getFactionIndex().get(key);
        return { key, name: doc?.name || key, img: doc?.img || "" };
      });
      // Вкладка «Состав» и схема происхождения — apps/faction-roster.mjs.
      Object.assign(context, await factionRosterContext(this.item), originTreeContext(this.item));
    }

    // Элитный архетип: Конструктор требований (три блока разной силы).
    if (this.item.type === "eliteArchetype") {
      context.eliteReqHtml = buildEliteReqHtml(this.item, context.canEditMech);
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
      // «Мастерство» привязывается к конкретному Навыку (стр. 62) — подсказываем
      // весь список, включая специализации групп.
      if (dynamicAptKind(this.item.name) === "skill") context.masteryList = masteryTargets();
      // Проверяемое требование — тот же движок, что у Ритуала (задуман под
      // ритуалиста, но нигде не привязан к типу предмета). До сих пор у
      // Таланта было только текстовое поле «Требование» — GM читал его
      // глазами; для Талантов из дерева Элитного архетипа этого мало: книга
      // требует именно «взял архетип X», и это стало проверяемым условием
      // (kind:"reqArchetype"), а не только строкой в специализации.
      context.talentReqHtml = buildRequirementsHtml(this.item, "req", context.isGM);
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

    // ── Руническая Вязь (корбук стр. 433-434) ─────────────────────────────────
    if (this.item.type === "runicWeave") {
      context.runicWeavePositions = RUNIC_WEAVE_POSITIONS;
      context.runicWeaveInstalledOnTypes = RUNIC_WEAVE_INSTALLED_ON_TYPES;
      context.runicWeaveUuid = this.item.uuid;

      const sys = context.system;
      if (!Array.isArray(sys.surfaceKinds)) sys.surfaceKinds = [];
      context.runicWeaveSurfaceOptions = Object.entries(RUNIC_WEAVE_SURFACE_KINDS)
        .map(([key, label]) => ({ key, label, active: sys.surfaceKinds.includes(key) }));

      const parentActor = this.item.parent;
      // Носители «carrier» — броня/оружие того же актора и держатели (модификации
      // силовой брони с runicWeaveSlots>0, напр. Загадка Маата).
      context.runicWeaveInstallTargets = (parentActor?.items ?? [])
        .filter(i => i.type === "armor" || i.type === "weapon"
          || (i.type === "armorMod" && Number(i.system?.runicWeaveSlots) > 0))
        .map(i => ({
          id: i.id, name: i.name, equipped: i.system.equipped,
          isHolder: i.type === "armorMod"
        }));

      const host = sys.installedOn ? (parentActor?.items?.get(sys.installedOn) ?? null) : null;
      context.runicWeaveHostIsHolder = host?.type === "armorMod";

      const siblings = siblingRunicWeaves(parentActor?.items?.contents ?? [], this.item)
        .map(i => ({ id: i.id, wornPosition: i.system?.wornPosition || "" }));
      context.runicWeaveActiveId = activeRunicWeaveId(siblings);
      context.runicWeaveOverridden = !context.runicWeaveHostIsHolder && sys.installedOn
        && context.runicWeaveActiveId != null && context.runicWeaveActiveId !== this.item.id;
      if (context.runicWeaveHostIsHolder) {
        const used = (parentActor?.items ?? []).filter(i =>
          i.type === "runicWeave" && i.system?.installedOn === sys.installedOn).length;
        context.runicWeaveSlotUsage = { used, slots: Number(host.system?.runicWeaveSlots) || 0 };
      }
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
      if (!Array.isArray(sys.effects.charBonuses)) sys.effects.charBonuses = [];
      context.charBonusOptions = Object.entries(CHARACTERISTICS)
        .map(([k, m]) => ({ key: k, abbr: m.abbr, label: m.label }));
      context.charBonusesActive = sys.effects.charBonuses.map(cb => ({
        stat: cb.stat, value: cb.value ?? 0, abbr: CHARACTERISTICS[cb.stat]?.abbr ?? cb.stat
      }));
    }

    // ── Небесное тело (звёздная система) ─────────────────────────────────────
    if (this.item.type === "celestialBody") {
      const sys = context.system;
      context.cbGmNotesEnriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        sys.gmNotes || "", { relativeTo: this.item, secrets: this.item.isOwner });
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
      const propRatings = context.system.propRatings || {};
      // Как у оружия: активные свойства — чипами, остальные — в выпадающем «добавить».
      // rating — только у Gorget/Protective (ARMOR_PROPERTIES[key].rating),
      // хранится не рядом с ключом (как у оружия weaponProps[].rating), а в
      // отдельном свободном реестре system.propRatings (data/item/armor.mjs).
      context.armorPropsActive = activeProps
        .filter(key => ARMOR_PROPERTIES[key])
        .map(key => ({ key, def: ARMOR_PROPERTIES[key], rating: propRatings[key] ?? 0 }));
      context.armorPropsAvailable = Object.entries(ARMOR_PROPERTIES)
        .filter(([key]) => !activeProps.includes(key))
        .map(([key, def]) => ({ key, label: def.label }));

      // Разгрузка силовой брони (стр. 27) — те же константы, что у снаряжения.
      const sys = context.system;
      if (!sys.rig) sys.rig = { comfort: "normal", backSlot: false, slots: [], magLocks: [] };
      if (!Array.isArray(sys.rig.slots))    sys.rig.slots = [];
      if (!Array.isArray(sys.rig.magLocks)) sys.rig.magLocks = [];
      context.rigComfort   = RIG_COMFORT;
      context.rigSlotSizes = RIG_SLOT_SIZES;

      // Запас воздуха Void (wdbc-jtqf, стр. 228) — только у брони с этим свойством.
      if (hasVoidSupply(this.item)) {
        context.voidAir = {
          remaining: voidAirRemainingDisplay(this.item),
          sealed: this.item.getFlag?.("warhammer-dbc", "voidAirStartedAt") != null,
          breached: !!sys.breached
        };
      }
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
        // «Надеть на» (не занимает слот в разгрузке, см. constants/rig.mjs
        // wornOnHost) — носитель тот же набор типов, что у Рунической Вязи.
        context.gearWornOnTargets = (this.item.parent?.items ?? [])
          .filter(i => (i.type === "armor" || i.type === "weapon") && i.id !== this.item.id)
          .map(i => ({ id: i.id, name: i.name, equipped: i.system.equipped }));
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
    // Механику настраивают все за столом, а не один Мастер: Черты, Таланты и
    // снаряжение лежат в компендиумах и в мире, и «своими» для игрока не
    // бывают — по владению доступ давать нечему. Закрыт только запертый
    // компендиум: там правку не примут ни у кого. Чужой предмет клиент писать
    // не вправе, поэтому такая правка уходит Мастеру (saveItemMechanics).
    context.canEditMech       = !this.item.compendium?.locked;
    context.itemMechanicsHtml = buildMechanicsTabHtml(this.item, context.canEditMech);

    // Ритуал — контентные разделы книги (стр. 393-425) и два набора
    // механических требований: к ритуалисту и к ассистентам.
    if (this.item.type === "ritual") {
      context.ritualItemTypes     = RITUAL_ITEM_TYPES;
      context.ritualFailureTypes  = RITUAL_TYPES;
      context.ritualTest          = ritualTestContext(this.item);
      context.ritualReqHtml       = buildRequirementsHtml(this.item, "req", context.isGM);
      // Вилка «0—0» — ритуал проводится в одиночку: ассистентов у него не
      // бывает, и требовать с них нечего. Блок требований к ассистентам в этом
      // случае выключаем целиком (вместе с кнопками групп), чтобы не набирать
      // условия для тех, кого не позовут.
      const s = this.item.system || {};
      context.ritualHasAssists    = !!((Number(s.assistMin) || 0) || (Number(s.assistMax) || 0));
      context.ritualAssistReqHtml = context.ritualHasAssists
        ? buildRequirementsHtml(this.item, "assistReq", context.isGM)
        : "";
    }

    // Раса/Субраса — десять полей характеристик листаются циклом в шаблоне,
    // а не выписываются по одной, как в архетипе: там их пять, здесь десять.
    if (this.item.type === "race" || this.item.type === "subrace") {
      context.charKeys = Object.entries(CHARACTERISTICS).map(([key, c]) => ({ key, label: c.abbr }));
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

  /**
   * ApplicationV2 гасит всю форму, если предмет не наш. Вкладку «Механика» это
   * гасить не должно: её настраивают все за столом, а правка чужого предмета
   * уходит Мастеру (saveItemMechanics). Полей формы там нет — у элементов
   * Механики нет name, в сабмит они не попадают и правятся своими
   * обработчиками, — поэтому вернуть их в строй безопасно.
   *
   * «Особенность комплекта» силовой брони (.pa-history, вкладка «ИНФО») живёт
   * по тому же правилу «не своим для игрока не бывает» (module/apps/
   * armour-history.mjs, relayItemUpdate) — без этой строчки её кнопки
   * оставались бы серыми у любого, кто не владелец предмета, хотя запись и
   * так уходит через Мастера. У её input'а тоже нет name (armor.hbs) — по
   * той же причине, что у Механики.
   * @override
   */
  _toggleDisabled(disabled) {
    super._toggleDisabled?.(disabled);
    if (!disabled || this.item.compendium?.locked) return;
    this.element?.querySelectorAll(
      '[data-tab="mechanics"] input, [data-tab="mechanics"] select,'
      + ' [data-tab="mechanics"] textarea, [data-tab="mechanics"] button,'
      + ' .pa-history input, .pa-history select, .pa-history button')
      .forEach(node => { node.disabled = false; });
  }

  /**
   * Перетаскивание Черты/Таланта/Свойства оружия на запись «Механики»
   * (.grant-drop-zone/.wprop-drop-zone) должно работать даже у того, кто
   * предметом не владеет — тот же принцип, что и у _toggleDisabled выше, и
   * тот же приём, что в ship-sheet.mjs/squad-sheet.mjs/vehicle-sheet.mjs/
   * formation-sheet.mjs: штатный DragDrop Foundry сам вешает обработчик
   * 'drop' по _canDragDrop(), а не по отдельным зонам, и без переопределения
   * гасится вместе со всей формой (this.isEditable=false) — драг-н-дроп молча
   * переставал работать, оставляя ТОЛЬКО свободный код («Код») как способ
   * задать что-либо предмету. Разрешение по-прежнему проверяет каждый
   * обработчик отдельно: _onDropReqItem/_onDropTalentTarget — только ГМ,
   * _onDropActiveEffect — только owner, _onDropGrantItem/_onDropWeaponPropItem
   * — через relay (saveItemMechanics), поэтому здесь достаточно всегда true.
   * @override
   */
  _canDragDrop(_selector) { return true; }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    if (!el) return;
    // Класс по типу предмета динамический, в DEFAULT_OPTIONS.classes его не
    // положить: CSS частей цепляется за .weapon-sheet, .armor-sheet и т.п.
    el.classList.add(`${this.item.type}-sheet`);

    /** Слушатель на все узлы по селектору — замена jQuery-обхода из V1. */
    const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach(n => n.addEventListener(ev, fn));

    // Конструктор требований Элитного архетипа.
    if (this.item.type === "eliteArchetype") activateEliteReqListeners(el, this.item);

    // ── Цели Таланта (Hatred, Peer, Enemy, Good Reputation) ─────────────────
    // Цель добавляется тремя путями, потому что и природа у целей разная:
    // фракция выбирается в Обозревателе (там дерево и поиск), тип существа —
    // из короткого списка типов акторов, «Все!» — просто есть.
    on(".talent-target-add", "click", async ev => {
      ev.preventDefault();
      if (!game.user.isGM) return;
      const kind = await this._askTargetKind();
      if (!kind) return;

      let target = null;
      if (kind === "faction") {
        const uuid = await openCompendiumBrowser(false, {
          filters: { type: "faction" },
          prompt: "Выберите фракцию — правило сработает и на любую нижестоящую"
        });
        if (!uuid) return;
        const doc = await fromUuid(uuid).catch(() => null);
        if (!doc) return ui.notifications.warn("Фракция не найдена — возможно, компендиум изменился.");
        target = factionTarget(doc);
        if (!target) return ui.notifications.warn(`У фракции «${doc.name}» не задан ключ.`);
      } else if (kind === "race") {
        const race = await this._askRace();
        if (!race) return;
        target = raceTarget(race.key, race.label);
      } else if (kind === "feature") {
        const feature = await this._askFeature();
        if (!feature) return;
        target = featureTarget(feature);
      } else if (kind === "patron") {
        const patron = await this._askPatron();
        if (!patron) return;
        target = patronTarget(patron.key, patron.label);
      } else if (kind === "all") {
        target = allTarget();
      } else {
        target = actorTypeTarget(kind, game.i18n.localize(`TYPES.Actor.${kind}`));
      }

      const before = this.item.system.targets || [];
      const after = addTarget(before, target);
      if (after.length === before.length) return ui.notifications.info("Такая цель уже есть.");
      await this.item.update({ "system.targets": after });
    });

    on(".talent-target-remove", "click", async ev => {
      ev.preventDefault();
      if (!game.user.isGM) return;
      await this.item.update({
        "system.targets": removeTargetAt(this.item.system.targets || [], ev.currentTarget.dataset.index)
      });
    });

    // ── Фракция: ключ и вышестоящая ─────────────────────────────────────────
    // Ключ выдаётся при создании (module/documents/item.mjs) и правке не
    // подлежит: на него ссылаются другие фракции и цели Талантов. Поле только
    // показывает его, поэтому рядом кнопка «скопировать» — иначе значение
    // остаётся видимым, но неудобным в переносе.
    on(".faction-key-copy", "click", async ev => {
      ev.preventDefault();
      const key = this.item.system.key || "";
      if (!key) return ui.notifications.warn("Ключа нет — выдайте его кнопкой рядом.");
      try {
        await game.clipboard.copyPlainText(key);
        ui.notifications.info(`Ключ «${key}» скопирован.`);
      } catch {
        // Буфер обмена доступен не в каждом окружении — значение всё равно
        // видно в поле, поэтому это не ошибка, а подсказка.
        ui.notifications.warn(`Не удалось скопировать. Ключ: ${key}`);
      }
    });

    // «Входит в состав»: перетаскивание и кнопка «＋». Дроп ловим сами, а не
    // штатным dragDrop листа: тот отключается вместе с редактируемостью, а
    // лист фракции почти всегда открыт из компендиума — и перетаскивание
    // молча переставало работать.
    const parentZone = el.querySelector(".faction-parent-drop");
    if (parentZone) {
      parentZone.addEventListener("dragover", ev => {
        ev.preventDefault();
        parentZone.classList.add("faction-drop-over");
      });
      parentZone.addEventListener("dragleave", () => parentZone.classList.remove("faction-drop-over"));
      parentZone.addEventListener("drop", async ev => {
        parentZone.classList.remove("faction-drop-over");
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
        if (data?.type !== "Item") return;
        ev.preventDefault();
        ev.stopPropagation();
        await this._setFactionParent(await Item.implementation.fromDropData(data));
      });
    }

    on(".faction-parent-add", "click", async ev => {
      ev.preventDefault();
      const uuid = await openCompendiumBrowser(false, {
        filters: { type: "faction" },
        prompt: "Выберите вышестоящую фракцию — эта войдёт в её состав"
      });
      if (!uuid) return;
      const doc = await fromUuid(uuid).catch(() => null);
      if (!doc) return ui.notifications.warn("Фракция не найдена — возможно, компендиум изменился.");
      await this._setFactionParent(doc);
    });

    on(".faction-parent-remove", "click", async ev => {
      ev.preventDefault();
      await this._updateFaction({ "system.parentKey": "" });
    });

    // «Также состоит в» — то же самое, но список: зона дропа, «＋» и крестик
    // у каждой фишки.
    const alsoZone = el.querySelector(".faction-also-drop");
    if (alsoZone) {
      alsoZone.addEventListener("dragover", ev => {
        ev.preventDefault();
        alsoZone.classList.add("faction-drop-over");
      });
      alsoZone.addEventListener("dragleave", () => alsoZone.classList.remove("faction-drop-over"));
      alsoZone.addEventListener("drop", async ev => {
        alsoZone.classList.remove("faction-drop-over");
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
        if (data?.type !== "Item") return;
        ev.preventDefault();
        ev.stopPropagation();
        await this._addFactionAlso(await Item.implementation.fromDropData(data));
      });
    }

    on(".faction-also-add", "click", async ev => {
      ev.preventDefault();
      const uuid = await openCompendiumBrowser(false, {
        filters: { type: "faction" },
        prompt: "Выберите фракцию, которой эта служит, не входя в неё по устройству"
      });
      if (!uuid) return;
      const doc = await fromUuid(uuid).catch(() => null);
      if (!doc) return ui.notifications.warn("Фракция не найдена — возможно, компендиум изменился.");
      await this._addFactionAlso(doc);
    });

    on(".faction-also-remove", "click", async ev => {
      ev.preventDefault();
      const key = ev.currentTarget.dataset.key;
      await this._updateFaction({
        "system.alsoIn": factionAlsoKeys(this.item).filter(k => k !== key)
      });
    });

    if (this.item.type === "faction") {
      activateFactionRosterListeners(el, this.item);
      activateOriginTreeListeners(el, this.item);
    }

    // ── Фракция: список «других названий» одним полем ───────────────────────
    // system.aliases — ArrayField, и авто-submit формы строку в массив не
    // превратит. Разбираем сами, тем же приёмом, что и прочие списки в этом
    // файле: собрать значение и отдать одним update.
    on(".faction-aliases", "change", ev => {
      const list = String(ev.currentTarget.value || "")
        .split(",").map(s => s.trim()).filter(Boolean);
      this.item.update({ "system.aliases": list });
    });

    // ── Эффекты (Active Effect Foundry) — общая вкладка для всех типов ──────────
    on(".effect-disabled-toggle", "change", async ev => {
      const fx = this.item.effects.get(ev.currentTarget.dataset.effectId);
      if (fx) await fx.update({ disabled: !ev.currentTarget.checked });
    });

    // ── Сус-ан Мембрана: активное исцеление Призраков Смерти раз в сутки ────────
    on(".sus-an-heal-btn", "click", async ev => {
      ev.preventDefault();
      const actor = this.item.parent;
      if (actor) await useSusAnHeal(actor, this.item);
    });

    // ── История брони: транс «Дух героя» ────────────────────────────────────
    on(".pa-trance-btn", "click", async ev => {
      ev.preventDefault();
      const actor = this.item.parent;
      if (actor) await useTrance(actor, this.item);
    });

    // ── Мутация «Рука Смерти»: слияние с выбранным оружием (wdbc-hftn) ──────
    on(".hand-of-death-btn", "click", async ev => {
      ev.preventDefault();
      const actor = this.item.parent;
      if (actor) await useHandOfDeath(actor, this.item);
    });

    // ── Мутация «Зависимость»: кнопка «Утолить» (wdbc-1rno) ─────────────────
    on(".addiction-satisfy-btn", "click", async ev => {
      ev.preventDefault();
      await useSatisfyAddiction(this.item);
    });

    // ── Мутация «Вампирическая Зависимость»: «Утолить»/«Тест на голод» ──────
    on(".vampiric-satisfy-btn", "click", async ev => {
      ev.preventDefault();
      await useSatisfyVampiric(this.item);
    });
    on(".vampiric-test-btn", "click", async ev => {
      ev.preventDefault();
      const actor = this.item.parent;
      if (actor) await useVampiricTest(actor, this.item);
    });

    // ── Мутация «Раковое Исцеление»: касание текущей цели (wdbc-w8ws) ───────
    on(".cancerous-healing-btn", "click", async ev => {
      ev.preventDefault();
      const actor = this.item.parent;
      if (actor) await useCancerousHealing(actor, this.item);
    });

    // ── Мутация «Освежёванный»: содрать кожу с текущей цели (wdbc-w8ws) ─────
    on(".flayed-btn", "click", async ev => {
      ev.preventDefault();
      const actor = this.item.parent;
      if (actor) await useFlayed(actor, this.item);
    });

    // ── Запас воздуха Void (wdbc-jtqf) ────────────────────────────────────────
    on(".void-seal-btn", "click", async ev => {
      ev.preventDefault();
      await sealVoidArmour(this.item);
    });
    on(".void-refill-btn", "click", async ev => {
      ev.preventDefault();
      await refillVoidArmour(this.item);
    });

    // ── МЕХАНИКА (единый Конструктор: Характеристика/Черта/Талант/Навык/Код,
    // группы И/ИЛИ) — общая вкладка для всех типов. Кнопки групп и записей —
    // действия [data-action] выше; здесь остались поля записи.
    const saveMech = arr => saveMechanics(this.item, arr);
    // Рекурсивный поиск (учитывает вложенные подгруппы kind:"group", см. mechanics.mjs).
    const findEntry = findMechEntry;
    on(".grant-entry-kind", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      // blankMechEntry(kind) — а не blankMechEntry() — иначе смена вида на
      // "group" оставила бы entry.group=null (kind сам по себе выставился бы
      // верно 3-м аргументом Object.assign, но вложенная подгруппа — нет).
      // when сохраняется явно: условие «Когда» — про то, КОМУ достаётся
      // запись, а не про то, ЧТО она даёт, смена вида его не касается.
      const kind = ev.currentTarget.value;
      Object.assign(e, blankMechEntry(kind), { id: e.id, kind, when: e.when });
      saveMech(arr);
    });
    // Порча (kind:"corruption")
    on(".mech-corruption-op", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.op = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-corruption-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.corruptionValue = ev.currentTarget.value; saveMech(arr); }
    });
    // Раны (kind:"wounds")
    on(".mech-wounds-op", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.op = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-wounds-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.woundsValue = ev.currentTarget.value; saveMech(arr); }
    });
    // Слаженность отряда (kind:"cohesion")
    on(".mech-cohesion-role", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.cohesionRole = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-cohesion-op", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.op = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-cohesion-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.cohesionValue = ev.currentTarget.value; saveMech(arr); }
    });
    // Характеристика
    on(".mech-char-key", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.charKey = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-char-field", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.field = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-char-op", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.op = ev.currentTarget.value; saveMech(arr); }
    });
    // Значение — число ИЛИ формула mech-formula.mjs (ag*2, ceil(cor/2)…):
    // строка хранится как есть, до числа её доводит mechFormulaTotalSafe в
    // момент применения записи (mechEffectData/applyMechEntry).
    on(".mech-char-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.value = ev.currentTarget.value; saveMech(arr); }
    });
    // Вес (kind:"weight")
    on(".mech-weight-scope", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weightScope = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-weight-mode", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weightMode = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-weight-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weightValue = ev.currentTarget.value; saveMech(arr); }
    });
    // Движение (kind:"movement")
    on(".mech-move-target", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.movementTarget = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-move-op", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.op = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-move-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.movementValue = ev.currentTarget.value; saveMech(arr); }
    });
    // Очки Брони по локации (kind:"armour")
    on(".mech-armour-loc", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.armourLocation = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-armour-op", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.op = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-armour-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.armourValue = ev.currentTarget.value; saveMech(arr); }
    });
    // Ландшафт — игнорирование свойств (kind:"terrainIgnore")
    on(".mech-terrain-ignore", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.ignoreTerrainProps = Array.from(ev.currentTarget.selectedOptions).map(o => o.value);
      saveMech(arr);
    });
    // Переброс (kind:"reroll"). Смена области меняет набор полей (у «теста
    // характеристики» появляется её выбор, у «теста навыка» — навык), поэтому
    // сохраняем и даём листу перерисоваться, как у Усталости ниже.
    const mechField = (sel, apply) => on(sel, "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      apply(e, ev.currentTarget.value);
      saveMech(arr);
    });
    mechField(".mech-reroll-scope", (e, v) => { e.rerollScope = v; });
    mechField(".mech-reroll-char",  (e, v) => { e.rerollChar = v; });
    mechField(".mech-reroll-skill", (e, v) => { e.skillKey = v; });
    mechField(".mech-reroll-mode",  (e, v) => { e.rerollMode = v; });
    mechField(".mech-reroll-label", (e, v) => { e.label = v; });
    mechField(".mech-mod-scope",     (e, v) => { e.modScope = v; });
    mechField(".mech-mod-valuemode", (e, v) => { e.modValueMode = v; });
    mechField(".mech-mod-char",      (e, v) => { e.modCharBonus = v; });
    mechField(".mech-mod-char-mult", (e, v) => { e.modCharBonusMultiplier = Math.max(1, Number(v) || 1); });
    // Значение «Модификатора теста» (kind:"testMod") — число (mech-entry-value)
    // ИЛИ формула mech-formula.mjs (mech-mod-formula, wdbc-1rno: Black Eyes
    // «½Cor(окр.▲)»), тот же приём хранения строкой, что у .mech-char-value.
    // Раньше .mech-entry-value не имел своего листенера вовсе — правка того
    // же поля в UI молча не сохранялась (найдено попутно, чинится тут же).
    mechField(".mech-entry-value", (e, v) => { e.value = Number(v) || 0; });
    mechField(".mech-mod-formula", (e, v) => { e.value = v; });
    mechField(".mech-reroll-who",    (e, v) => { e.rerollWho = v; });
    mechField(".mech-capability-key", (e, v) => { e.capabilityKey = v; });
    // Цена в пуле (wdbc-1dc8) — смена пула показывает/прячет поле числа,
    // тот же приём каскада, что у .mech-fatigue-action ниже (saveMech даёт
    // листу перерисоваться).
    mechField(".mech-capability-cost-pool",   (e, v) => { e.capabilityCostPool = v; });
    mechField(".mech-capability-cost-amount", (e, v) => { e.capabilityCostAmount = Math.max(1, Number(v) || 1); });
    // Возможность, второй режим — override склонности (wdbc-zk69). Смена
    // capabilityMode/AptScope тоже перерисовывает лист, тем же каскадом.
    mechField(".mech-capability-mode",      (e, v) => { e.capabilityMode = v; });
    mechField(".mech-capability-apt-scope", (e, v) => { e.capabilityAptScope = v; });
    mechField(".mech-capability-apt-match", (e, v) => { e.capabilityAptMatch = v; });
    mechField(".mech-capability-apt-align", (e, v) => { e.capabilityAptAlign = v; });

    // Усталость (kind:"fatigue") — каскад действие → характеристика. Смена
    // действия перерисовывает поля, поэтому сохраняем и даём листу обновиться.
    on(".mech-fatigue-action", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.fatigueAction = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-fatigue-char", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.fatigueThresholdChar = ev.currentTarget.value; saveMech(arr); }
    });
    // Снаряжение (kind:"equipment")
    on(".mech-equip-mode", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipMode = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-equip-source", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.equipSourceUuid = ev.currentTarget.value;
      e.equipSourceName = ev.currentTarget.selectedOptions[0]?.textContent || "";
      saveMech(arr);
    });
    on(".mech-equip-cat", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.equipCategoryPack = ev.currentTarget.value;
      e.equipWeaponType = ""; e.equipWeaponProp = ""; e.equipArmorType = "";
      saveMech(arr);
    });
    on(".mech-equip-wtype", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipWeaponType = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-equip-wprop", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipWeaponProp = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-equip-atype", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipArmorType = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-equip-avail", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipMaxAvailability = parseInt(ev.currentTarget.value); saveMech(arr); }
    });
    on(".mech-equip-qty", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipQty = Math.max(1, parseInt(ev.currentTarget.value) || 1); saveMech(arr); }
    });
    on(".mech-equip-pr-delta", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipPrRequiredDelta = parseInt(ev.currentTarget.value) || 0; saveMech(arr); }
    });
    // Ступень Таланта и потолок Пси-Рейтинга — фильтры небоевых паков.
    // Пустая строка значит «любая», поэтому пустое НЕ приводится к нулю.
    const setEquipFilter = (sel, field) => on(sel, "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      const raw = String(ev.currentTarget.value).trim();
      e[field] = raw === "" ? "" : (parseInt(raw) || 0);
      saveMech(arr);
    });
    setEquipFilter(".mech-equip-tier", "equipTalentTier");
    setEquipFilter(".mech-equip-pr",   "equipMaxPsyRating");
    const setMinionSlot = (sel, field) => on(sel, "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e[field] = ev.currentTarget.value; saveMech(arr); }
    });
    setMinionSlot(".mech-minion-group", "minionGroup");
    setMinionSlot(".mech-minion-tier",  "minionTier");
    on(".mech-equip-quality", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipQuality = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-equip-budget-mode", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipBudgetMode = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-equip-budget-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.equipBudgetValue = Math.max(0, parseInt(ev.currentTarget.value) || 0); saveMech(arr); }
    });
    // Лояльность миньонов (kind:"loyalty")
    on(".mech-loyalty-type", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.loyaltyMinionType = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-loyalty-op", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.loyaltyOp = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-loyalty-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.loyaltyValue = ev.currentTarget.value === "" ? "" : (parseFloat(ev.currentTarget.value) || 0); saveMech(arr); }
    });
    // Модификатор броска (kind:"rollmod") — навык/специализация переиспользуют
    // .grant-entry-skillref/.grant-entry-specialty/-spec-custom (см. ниже).
    on(".mech-rollmod-label", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.label = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-rollmod-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.value = ev.currentTarget.value === "" ? "" : (parseFloat(ev.currentTarget.value) || 0); saveMech(arr); }
    });
    // Очки Судьбы/Бесчестья либо Аблативные Раны (kind:"poolMax")
    on(".mech-poolmax-target", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.poolTarget = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-poolmax-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.value = ev.currentTarget.value; saveMech(arr); }
    });
    // Аура (kind:"aura") — drop-зона обрабатывается _onDropAuraGrant/_onDrop.
    on(".mech-aura-radius", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.auraRadius = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-aura-affects", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.auraAffects = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-aura-self", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.auraIncludesSelf = !!ev.currentTarget.checked; saveMech(arr); }
    });
    on(".mech-aura-immune", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.auraImmuneTraits = ev.currentTarget.value; saveMech(arr); }
    });
    // Код (kind:"script")
    on(".mech-script-label", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.label = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-script-code", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.code = ev.currentTarget.value; saveMech(arr); }
    });
    // «Частота» кнопки «▶ Запустить» (wdbc-f4jt), необязательный счётчик «до N раз», и сама кнопка.
    on(".mech-script-throttle", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.scriptThrottleUnit = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-script-throttle-max", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.scriptThrottleMax = Math.max(1, parseInt(ev.currentTarget.value) || 1); saveMech(arr); }
    });
    // Триггер по исходу теста (wdbc-1rno) — переключение показывает/прячет
    // область (modScope), поэтому сохраняем и даём листу перерисоваться, тот
    // же каскад, что у .mech-fatigue-action/.mech-reroll-scope.
    on(".mech-script-trigger", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.scriptTrigger = ev.currentTarget.value; saveMech(arr); }
    });
    on(".mech-script-run", "click", async ev => {
      ev.preventDefault();
      await runMechScriptEntry(this.item, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
    });
    // ── «Когда» (entry.when) — гейт по Геносемени, общий для ЛЮБОГО kind ────
    // (см. entryWhenOk в mechanics.mjs). conditions — список вариантов (ИЛИ),
    // data-when-idx метит, какой именно правим. Смена легиона в варианте
    // сбрасывает его орден: набор орденов зависит от легиона, старый выбор из
    // другого дерева не годится.
    const whenCondition = (e, idx) => {
      e.when = e.when || { negate: false, conditions: [] };
      e.when.conditions[idx] = e.when.conditions[idx] || { legion: "", chapter: "" };
      return e.when.conditions[idx];
    };
    on(".grant-when-legion", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      const c = whenCondition(e, parseInt(ev.currentTarget.dataset.whenIdx) || 0);
      c.legion = ev.currentTarget.value;
      c.chapter = "";
      saveMech(arr);
    });
    on(".grant-when-chapter", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      const c = whenCondition(e, parseInt(ev.currentTarget.dataset.whenIdx) || 0);
      c.chapter = ev.currentTarget.value;
      saveMech(arr);
    });
    on(".grant-when-age", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      const c = whenCondition(e, parseInt(ev.currentTarget.dataset.whenIdx) || 0);
      const v = ev.currentTarget.value;
      c.ageAtLeast = v === "" ? "" : Math.max(0, parseInt(v) || 0);
      saveMech(arr);
    });
    on(".grant-when-negate", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.when = e.when || { negate: false, conditions: [] };
      e.when.negate = !!ev.currentTarget.checked;
      saveMech(arr);
    });
    // ── «Когда субмутация» (entry.when.submutations) — независимый гейт по
    // строке своей же таблицы субмутаций (см. mech-when.mjs). Список строк в
    // разметке идёт прямо из parseSubmutations(item.system.benefit) — метка
    // берётся из data-sub-label, а не индекса, чтобы правка текста таблицы не
    // сдвигала уже расставленные галочки на постороннюю строку.
    on(".grant-when-submutation", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.when = e.when || { negate: false, conditions: [] };
      const subs = new Set(e.when.submutations || []);
      const label = ev.currentTarget.dataset.subLabel;
      if (ev.currentTarget.checked) subs.add(label); else subs.delete(label);
      e.when.submutations = [...subs];
      saveMech(arr);
    });
    on(".grant-when-sub-negate", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.when = e.when || { negate: false, conditions: [] };
      e.when.negateSub = !!ev.currentTarget.checked;
      saveMech(arr);
    });
    // ── «Когда Талант» (entry.when.talentSpec/negateTalent, wdbc-ta4y) ──────
    // Третий независимый гейт — см. mech-when.mjs. Имя+специализация — один
    // объект, не список ИЛИ-вариантов, поэтому оба поля просто перезаписываются
    // целиком при каждой правке, без data-when-idx.
    const whenTalentSpecField = e => {
      e.when = e.when || { negate: false, conditions: [] };
      e.when.talentSpec = e.when.talentSpec || { name: "", specialization: "" };
      return e.when.talentSpec;
    };
    on(".grant-when-talent-name", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      whenTalentSpecField(e).name = ev.currentTarget.value;
      saveMech(arr);
    });
    on(".grant-when-talent-spec", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      whenTalentSpecField(e).specialization = ev.currentTarget.value;
      saveMech(arr);
    });
    on(".grant-when-talent-negate", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.when = e.when || { negate: false, conditions: [] };
      e.when.negateTalent = !!ev.currentTarget.checked;
      saveMech(arr);
    });
    // ── «Когда Тир Ран» (entry.when.woundTier/negateWoundTier, wdbc-wyr3) ───
    // Четвёртый независимый гейт — см. mech-when.mjs. Ключ берётся из
    // data-tier-key, не индекса — тот же приём, что у субмутации выше.
    on(".grant-when-tier", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.when = e.when || { negate: false, conditions: [] };
      const tiers = new Set(e.when.woundTier || []);
      const key = ev.currentTarget.dataset.tierKey;
      if (ev.currentTarget.checked) tiers.add(key); else tiers.delete(key);
      e.when.woundTier = [...tiers];
      saveMech(arr);
    });
    on(".grant-when-tier-negate", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.when = e.when || { negate: false, conditions: [] };
      e.when.negateWoundTier = !!ev.currentTarget.checked;
      saveMech(arr);
    });
    // ── «Когда Ярость» (entry.when.requireRage/negateRage) — пятый гейт ─────
    on(".grant-when-rage", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.when = e.when || { negate: false, conditions: [] };
      e.when.requireRage = !!ev.currentTarget.checked;
      saveMech(arr);
    });
    on(".grant-when-rage-negate", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.when = e.when || { negate: false, conditions: [] };
      e.when.negateRage = !!ev.currentTarget.checked;
      saveMech(arr);
    });
    // ── «Когда Герметичная броня» (entry.when.requireSealedArmour/
    // negateSealedArmour, wdbc-1rno) — шестой гейт, тот же паттерн, что у Ярости.
    on(".grant-when-sealed", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.when = e.when || { negate: false, conditions: [] };
      e.when.requireSealedArmour = !!ev.currentTarget.checked;
      saveMech(arr);
    });
    on(".grant-when-sealed-negate", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.when = e.when || { negate: false, conditions: [] };
      e.when.negateSealedArmour = !!ev.currentTarget.checked;
      saveMech(arr);
    });
    // ── ТРЕБОВАНИЯ (Ритуал: к ритуалисту «req» и к ассистентам «assistReq») ──
    // Кнопки групп и условий — действия [data-action] выше; здесь поля записи.
    const patchReq = (ev, fn) => patchReqEntry(this.item, ev.currentTarget, fn);

    on(".req-entry-kind", "change", ev => patchReq(ev, (e, el) => {
      // Смена вида условия обнуляет поля прежнего — иначе на записи висели
      // бы чужие данные (напр. навык у требования по расе).
      Object.assign(e, blankReqEntry(el.value), { id: e.id, kind: el.value });
    }));
    on(".req-skillref", "change", ev => patchReq(ev, (e, el) => {
      const [scope, key] = String(el.value || "").split(":");
      e.skillScope = scope === "group" ? "group" : "plain";
      e.skillKey = key || "";
      e.specKey = ""; e.specialty = "";
    }));
    on(".req-rank", "change",      ev => patchReq(ev, (e, el) => { e.rank = el.value; }));
    on(".req-spec", "change",      ev => patchReq(ev, (e, el) => {
      const spec = el.value ? specOptions(e.skillKey).find(s => s.key === el.value) : null;
      e.specKey = el.value;
      // Сверку ведёт specKey, поэтому в specialty кладём русское имя — оно
      // идёт в текст требования на листе (AGENTS.md: интерфейс русский).
      e.specialty = spec ? (spec.ru || spec.label) : "";
    }));
    on(".req-rating", "change",    ev => patchReq(ev, (e, el) => {
      e.rating = el.value === "" ? "" : (parseInt(el.value) || 0);
    }));
    on(".req-race", "change",      ev => patchReq(ev, (e, el) => { e.raceKey = el.value; }));
    on(".req-archetype", "change", ev => patchReq(ev, (e, el) => { e.archetypeName = el.value; }));
    on(".req-patron", "change",    ev => patchReq(ev, (e, el) => { e.patronKey = el.value; }));
    on(".req-capability-key", "change", ev => patchReq(ev, (e, el) => { e.capabilityKey = el.value; }));
    on(".req-stat-key", "change",  ev => patchReq(ev, (e, el) => { e.statKey = el.value; }));
    on(".req-stat-threshold", "change", ev => patchReq(ev, (e, el) => {
      e.statThreshold = el.value === "" ? "" : (parseInt(el.value) || 0);
    }));

    // Черта / Талант (драг-н-дроп резолвится в _onDropGrantItem)
    on(".grant-entry-rating", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.rating = ev.currentTarget.value; saveMech(arr); }
    });
    on(".grant-entry-spec", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.specialization = ev.currentTarget.value; saveMech(arr); }
    });
    // Навык
    on(".grant-entry-skillref", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      const [scope, key] = String(ev.currentTarget.value || "").split(":");
      e.skillScope = scope === "group" ? "group" : "plain";
      e.skillKey   = key || "";
      e.specKey = ""; e.specialty = "";
      saveMech(arr);
    });
    // «Любой Навык» (specKey:"__choice_any__", wdbc-2n5t) — переключатель
    // ПОВЕРХ обычного выбора Навыка, не его пункт: включение стирает
    // конкретный skillKey/скоуп (актор выберет их сам при получении),
    // выключение возвращает к обычному выбору с чистого листа.
    on(".grant-entry-skill-any", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      if (ev.currentTarget.checked) {
        e.specKey = "__choice_any__";
        e.skillScope = "plain"; e.skillKey = ""; e.specialty = ""; e.specChoiceKeys = [];
      } else {
        e.specKey = ""; e.grantsMastery = false;
      }
      saveMech(arr);
    });
    on(".grant-entry-grants-mastery", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.grantsMastery = !!ev.currentTarget.checked; saveMech(arr); }
    });
    on(".grant-entry-specialty", "change", ev => {
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
    on(".grant-entry-spec-custom", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.specialty = ev.currentTarget.value; saveMech(arr); }
    });
    // «По выбору» — несколько кандидатов-чекбоксов, актор выбирает один
    // диалогом при получении предмета (resolveEntrySpecChoice в mechanics.mjs).
    on(".grant-entry-spec-choice", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      const key = ev.currentTarget.dataset.key;
      const set = new Set(e.specChoiceKeys || []);
      if (ev.currentTarget.checked) set.add(key); else set.delete(key);
      e.specChoiceKeys = [...set];
      saveMech(arr);
    });
    // Сколько РАЗНЫХ специализаций выбирает актор: «Общие знания (любые 4)».
    on(".grant-entry-spec-count", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (!e) return;
      e.specChoiceCount = Math.max(1, parseInt(ev.currentTarget.value) || 1);
      saveMech(arr);
    });
    on(".grant-entry-rank", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.rank = ev.currentTarget.value; saveMech(arr); }
    });

    // Оружие: Свойство (kind:"weaponProp") — драг-н-дроп резолвится в
    // _onDropWeaponPropItem; здесь только действие/значения/сброс зон
    // (saveMech сам досчитывает system.effects.mechAddProps/mechRemoveProps).
    on(".wprop-action", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weaponPropAction = ev.currentTarget.value; saveMech(arr); }
    });
    on(".wprop-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weaponPropValue = ev.currentTarget.value; saveMech(arr); }
    });
    on(".wprop-value2", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weaponPropValue2 = ev.currentTarget.value; saveMech(arr); }
    });
    on(".wprop-new-value", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weaponPropNewValue = ev.currentTarget.value; saveMech(arr); }
    });
    on(".wprop-new-value2", "change", ev => {
      const arr = foundry.utils.deepClone(getItemMechanics(this.item));
      const e = findEntry(arr, ev.currentTarget.dataset.groupId, ev.currentTarget.dataset.entryId);
      if (e) { e.weaponPropNewValue2 = ev.currentTarget.value; saveMech(arr); }
    });

    // ── Оружие Наследия (стр. 426-428) ──
    //   Возвышение — тест Inf, он же правит профиль оружия; История и Мутации
    //   выбираются или бросаются, Мутация требует выбранного Характера.
    on(".legacy-ascend", "click", () => rollAscension(this.item, {
      deedBonus: parseInt(el.querySelector(".legacy-deed")?.value) || 0,
      legendary: !!el.querySelector(".legacy-legendary")?.checked
    }));
    on(".legacy-break", "click", () => breakLegacy(this.item));
    on(".legacy-history-select", "change", ev => {
      if (ev.currentTarget.value) setHistory(this.item, ev.currentTarget.value);
    });
    on(".legacy-roll-history", "click", () => rollHistory(this.item));
    on(".legacy-character-select", "change", ev =>
      this.item.update({ "system.legacy.character": ev.currentTarget.value }));
    on(".legacy-roll-mutation", "click", () => rollMutation(
      this.item, el.querySelector(".legacy-character-select")?.value));
    on(".legacy-mutation-del", "click", ev =>
      removeMutation(this.item, Number(ev.currentTarget.dataset.index)));
    on(".legacy-custom-mutation", "click", async () => {
      const name = await legacyPrompt("Название Мутации", "Нестандартная Мутация");
      if (name === null) return;
      const text = await legacyPrompt("Правило Мутации", "");
      if (text === null) return;
      await addCustomMutation(this.item, name, text);
    });

    // ── Особенность комплекта силовой брони ──
    // relayItemUpdate, а не this.item.update напрямую: комплект силовой брони
    // так же часто «не свой» для игрока, как и запись Механики (лежит в мире/
    // компендиуме, пока его не выдали) — без релея правка тихо отклонялась бы
    // проверкой прав Foundry. Тот же приём — у input'а .pa-hist-choice ниже.
    on(".pa-table-select", "change", ev =>
      relayItemUpdate(this.item, { "system.history.table": ev.currentTarget.value }));
    on(".pa-entry-select", "change", ev => {
      const table = el.querySelector(".pa-table-select")?.value || this.item.system.history?.table;
      if (ev.currentTarget.value) setArmourEntry(this.item, table, ev.currentTarget.value);
    });
    // Поле «уточнение» у особенностей с hasChoice — то же самое, почему без
    // name (см. .pa-hist-choice в armor.hbs): нативный сабмит формы пишет
    // документ владельца напрямую, мимо relayItemUpdate.
    on(".pa-hist-choice-input", "change", ev =>
      relayItemUpdate(this.item, { "system.history.choice": ev.currentTarget.value }));

    // Качество узла: галочки модификаторов. Лишние сверх лимита сбрасываем —
    // иначе тихо применились бы только первые, а вид говорил бы обратное.
    on(".comp-quality-pick", "change", async ev => {
      const def  = qualityOptionsFor(this.item.system);
      const lim  = def.pick || 0;
      const keys = [...el.querySelectorAll(".comp-quality-pick")]
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
    // Ниже — только для того, кто лист правит (действия проверяют это сами).
    if (!this.isEditable) return;

    // ── Баланс ────────────────────────────────────────────────────────────────
    on(".balance-select", "change", ev => {
      this.item.update({ "system.balance": parseInt(ev.currentTarget.value) });
    });

    // ── Доступность (только для НЕ-drug, у drug работает через name= биндинг)
    // Для drug селект имеет name="system.availability" и Foundry сам сохраняет.
    // Для других предметов — ручной handler через класс .availability-select
    if (this.item.type !== "drug") {
      on(".availability-select", "change", ev => {
        this.item.update({ "system.availability": parseInt(ev.currentTarget.value) });
      });
    } else {
      // Для drug: принудительно конвертируем строку в число при сохранении
      on("[name='system.availability']", "change", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        this.item.update({ "system.availability": parseInt(ev.currentTarget.value) || 0 });
      });
    }

    // ── Тип брони ─────────────────────────────────────────────────────────────
    on(".armor-type-select", "change", ev => {
      this.item.update({ "system.armorType": ev.currentTarget.value });
    });

    // ── Особые свойства оружия ─────────────────────────────────────────────────
    on(".wprop-add-select", "change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const props = foundry.utils.deepClone(this.item.system.weaponProps || []);
      if (!props.some(p => p.key === key)) {
        props.push({ key, rating: 0, rating2: 0 });
        await this.item.update({ "system.weaponProps": props });
      }
    });
    on(".wprop-rating", "change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = parseInt(ev.currentTarget.value) || 0;
      const props = foundry.utils.deepClone(this.item.system.weaponProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.weaponProps": props }); }
    });
    // Призма: живой заряд на предмете (не weaponProps[].rating — тот X-максимум).
    on(".wprop-prisma-charge", "change", async ev => {
      const val = Math.max(0, parseInt(ev.currentTarget.value) || 0);
      await this.item.update({ "system.prismaCharge": val });
    });
    // Рейтинг-бросок (например, Дуга/Arc: 2-е значение — формула кубика, напр. «2d10»).
    on(".wprop-rating-dice", "change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = ev.currentTarget.value.trim();
      const props = foundry.utils.deepClone(this.item.system.weaponProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.weaponProps": props }); }
    });

    // ── Психосила: доп. профили атаки ───────────────────────────────────────────
    on(".psy-profile-field", "change", async ev => {
      const i = Number(ev.currentTarget.dataset.index);
      const field = ev.currentTarget.dataset.field;
      const arr = foundry.utils.deepClone(this.item.system.profiles || []);
      if (!arr[i]) return;
      arr[i][field] = field === "penetration" ? (parseInt(ev.currentTarget.value) || 0) : ev.currentTarget.value;
      await this.item.update({ "system.profiles": arr });
    });

    // ── Психосила: вариации броска (разные модификаторы/цели) ────────────────────
    on(".psy-variant-field", "change", async ev => {
      const i = Number(ev.currentTarget.dataset.index);
      const field = ev.currentTarget.dataset.field;
      const arr = foundry.utils.deepClone(this.item.system.variants || []);
      if (!arr[i]) return;
      arr[i][field] = field === "testMod" ? (parseInt(ev.currentTarget.value) || 0) : ev.currentTarget.value;
      await this.item.update({ "system.variants": arr });
    });

    // ── Оружие: доп. профили ББ (Крюк/Посох, стр. 207-221) ──────────────────────
    on(".wprofile-field", "change", async ev => {
      const i = profileIdx(ev.currentTarget);
      const field = ev.currentTarget.dataset.field;
      const arr = foundry.utils.deepClone(this.item.system.profiles || []);
      if (!arr[i]) return;
      arr[i][field] = field === "penetration" ? (parseInt(ev.currentTarget.value) || 0) : ev.currentTarget.value;
      await this.item.update({ "system.profiles": arr });
    });
    // Свойства конкретного профиля (свой блок Devastating/Primitive и т.п.)
    on(".wprofile-prop-add", "change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const i = profileIdx(ev.currentTarget);
      const arr = foundry.utils.deepClone(this.item.system.profiles || []);
      if (!arr[i]) return;
      arr[i].weaponProps = Array.isArray(arr[i].weaponProps) ? arr[i].weaponProps : [];
      if (!arr[i].weaponProps.some(p => p.key === key))
        arr[i].weaponProps.push({ key, rating: 0, rating2: 0 });
      await this.item.update({ "system.profiles": arr });
    });
    on(".wprofile-prop-rating", "change", async ev => {
      const i = profileIdx(ev.currentTarget);
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
    on(".wbuff-add-select", "change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const props = foundry.utils.deepClone(this.item.system.effects?.weaponBuff?.addProps || []);
      if (!props.some(p => p.key === key)) {
        props.push({ key, rating: 0, rating2: 0 });
        await this.item.update({ "system.effects.weaponBuff.addProps": props });
      }
    });
    on(".wbuff-rating", "change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = parseInt(ev.currentTarget.value) || 0;
      const props = foundry.utils.deepClone(this.item.system.effects?.weaponBuff?.addProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.effects.weaponBuff.addProps": props }); }
    });
    on(".wbuff-rating-dice", "change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = ev.currentTarget.value.trim();
      const props = foundry.utils.deepClone(this.item.system.effects?.weaponBuff?.addProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.effects.weaponBuff.addProps": props }); }
    });

    // ── Свойства узла корабля ───────────────────────────────────────────────────
    on(".shipprop-add-select", "change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const props = foundry.utils.deepClone(this.item.system.shipProps || []);
      if (!props.some(p => p.key === key)) {
        props.push({ key, rating: 0, rating2: 0 });
        await this.item.update({ "system.shipProps": props });
      }
    });
    on(".shipprop-rating", "change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = parseInt(ev.currentTarget.value) || 0;
      const props = foundry.utils.deepClone(this.item.system.shipProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.shipProps": props }); }
    });
    // Формула кубика (Deadly Ramming: «1d10») — не число, храним строкой как есть.
    on(".shipprop-rating-dice", "change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = ev.currentTarget.value.trim();
      const props = foundry.utils.deepClone(this.item.system.shipProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.shipProps": props }); }
    });
    // Одиночный select (Y = тип узла-оружия у Devastating/Effective Distance).
    on(".shipprop-rating-select", "change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = ev.currentTarget.value;
      const props = foundry.utils.deepClone(this.item.system.shipProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.shipProps": props }); }
    });
    // Множественный выбор (Penetrating: Armour/Void Shields; Location Requirements:
    // дуги) — собираем все отмеченные чекбоксы той же группы key+field в строку через запятую.
    on(".shipprop-rating-set", "change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const group = ev.currentTarget.closest(".wprop-chip")
        ?.querySelectorAll(`.shipprop-rating-set[data-key="${key}"][data-field="${field}"]`) || [];
      const val   = [...group].filter(cb => cb.checked).map(cb => cb.value).join(",");
      const props = foundry.utils.deepClone(this.item.system.shipProps || []);
      const p     = props.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.shipProps": props }); }
    });

    // ── Бонусы характеристик (множественные) психосилы / техночуда ──────────────
    on(".cbonus-add", "change", async ev => {
      const stat = ev.currentTarget.value;
      if (!stat) return;
      const arr = foundry.utils.deepClone(this.item.system.effects?.charBonuses || []);
      if (!arr.some(c => c.stat === stat)) {
        arr.push({ stat, value: 0 });
        await this.item.update({ "system.effects.charBonuses": arr });
      }
    });
    on(".cbonus-value", "change", async ev => {
      const stat = ev.currentTarget.dataset.stat;
      const val  = parseInt(ev.currentTarget.value) || 0;
      const arr  = foundry.utils.deepClone(this.item.system.effects?.charBonuses || []);
      const c    = arr.find(x => x.stat === stat);
      if (c) { c.value = val; await this.item.update({ "system.effects.charBonuses": arr }); }
    });

    // ── Доп. типы психосилы / техночуда ────────────────────────────────────────
    on(".xtype-add-select", "change", async ev => {
      const type = ev.currentTarget.value;
      if (!type) return;
      const arr = foundry.utils.deepClone(this.item.system.extraTypes || []);
      if (!arr.some(e => e.type === type)) {
        arr.push({ type, x: 0 });
        await this.item.update({ "system.extraTypes": arr });
      }
    });
    on(".xtype-x", "change", async ev => {
      const type = ev.currentTarget.dataset.type;
      const val  = parseInt(ev.currentTarget.value) || 0;
      const arr  = foundry.utils.deepClone(this.item.system.extraTypes || []);
      const e    = arr.find(x => x.type === type);
      if (e) { e.x = val; await this.item.update({ "system.extraTypes": arr }); }
    });

    // ── Модификация оружия: даруемые/убираемые свойства ────────────────────────
    on(".modprop-add", "change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const arr = foundry.utils.deepClone(this.item.system.effects?.addProps || []);
      if (!arr.some(p => p.key === key)) {
        arr.push({ key, rating: 0, rating2: 0 });
        await this.item.update({ "system.effects.addProps": arr });
      }
    });
    on(".modprop-rating", "change", async ev => {
      const key   = ev.currentTarget.dataset.key;
      const field = ev.currentTarget.dataset.field;
      const val   = parseInt(ev.currentTarget.value) || 0;
      const arr   = foundry.utils.deepClone(this.item.system.effects?.addProps || []);
      const p     = arr.find(x => x.key === key);
      if (p) { p[field] = val; await this.item.update({ "system.effects.addProps": arr }); }
    });
    on(".modrem-add", "change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const arr = foundry.utils.deepClone(this.item.system.effects?.removeProps || []);
      if (!arr.includes(key)) { arr.push(key); await this.item.update({ "system.effects.removeProps": arr }); }
    });

    // ── Талант: склонности ─────────────────────────────────────────────────────
    on(".apt-add", "change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const arr = foundry.utils.deepClone(this.item.system.aptitudes || []);
      if (!arr.includes(key)) { arr.push(key); await this.item.update({ "system.aptitudes": arr }); }
    });

    // ── Модификация брони: даруемые свойства (чекбоксы) ────────────────────────
    on(".armormod-prop-cb", "change", () => {
      const props = [];
      [...el.querySelectorAll(".armormod-prop-cb:checked")].forEach(cb => props.push(cb.dataset.prop));
      this.item.update({ "system.effects.addProps": props });
    });

    // ── Руническая Вязь: допустимые виды поверхности (чекбоксы) ────────────────
    on(".runic-weave-surface-cb", "change", () => {
      const kinds = [];
      [...el.querySelectorAll(".runic-weave-surface-cb:checked")].forEach(cb => kinds.push(cb.dataset.key));
      this.item.update({ "system.surfaceKinds": kinds });
    });

    // ── Особенности брони (как у оружия: добавление чипами) ────────────────────
    on(".aprop-add-select", "change", async ev => {
      const key = ev.currentTarget.value;
      if (!key) return;
      const props = [...(this.item.system.properties || [])];
      if (!props.includes(key)) {
        props.push(key);
        await this.item.update({ "system.properties": props });
      }
    });
    // Рейтинг X особенности брони (Gorget/Protective, wdbc-8b5) — отдельный
    // свободный реестр system.propRatings, а не поле рядом с ключом свойства
    // (у брони, в отличие от оружия, properties[] — плоский массив строк).
    on(".aprop-rating", "change", async ev => {
      const key = ev.currentTarget.dataset.key;
      const val = Math.max(0, parseInt(ev.currentTarget.value) || 0);
      const propRatings = { ...(this.item.system.propRatings || {}) };
      propRatings[key] = val;
      await this.item.update({ "system.propRatings": propRatings });
    });
    // Текстовый рейтинг (Aspect — «Варп-Пауки» и т.п., wdbc-8b5/wdbc-28ld).
    on(".aprop-rating-text", "change", async ev => {
      const key = ev.currentTarget.dataset.key;
      const val = ev.currentTarget.value.trim();
      const propRatings = { ...(this.item.system.propRatings || {}) };
      propRatings[key] = val;
      await this.item.update({ "system.propRatings": propRatings });
    });

    // ── Типы боеприпасов ──────────────────────────────────────────────────────
    on(".ammo-type-cb", "change", () => {
      const types = [];
      [...el.querySelectorAll(".ammo-type-cb:checked")].forEach(cb => types.push(cb.dataset.type));
      this.item.update({ "system.weaponTypes": types });
    });

    // ── Силовой щит ───────────────────────────────────────────────────────────
    on(".shield-nature-select", "change", ev => {
      this.item.update({ "system.shieldNature": ev.currentTarget.value });
    });
    on(".shield-type-select", "change", ev => {
      this.item.update({ "system.shieldType": ev.currentTarget.value });
    });
    on(".shield-special-rating-cb", "change", ev => {
      this.item.update({ "system.isSpecialRating": ev.currentTarget.checked });
    });
    // ── Яд: чекбоксы вектора доставки ────────────────────────────────────────
    on(".poison-vector-cb", "change", () => {
      const vectors = [];
      [...el.querySelectorAll(".poison-vector-cb:checked")].forEach(cb => vectors.push(cb.dataset.vector));
      this.item.update({ "system.poisonVector": vectors });
    });

    // ── Зависимость: показать/скрыть блок ────────────────────────────────────
    on(".drug-addiction-toggle", "change", ev => {
      this.item.update({ "system.addiction.hasAddiction": ev.currentTarget.checked });
    });
  }
}