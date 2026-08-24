import { effectiveWeapon, shipQualityMods, QUALITY_LABELS } from "../constants/ship-quality.mjs";
import { SHIP_CHARS, SHIP_TYPES, getCargoType, CARGO_QUALITY, SHIP_WEAPON_ARCS,
         buildCargoTypeOptions, CARGO_TYPES, CARGO_TRADE, CARGO_DAMAGE,
         CARGO_HOLD_BONUS, cargoRarity } from "../constants/ship.mjs";
import { SHIP_PROPERTIES } from "../constants/ship-properties.mjs";
import { SHIP_DEFILEMENT_THRESHOLDS, findDistortion, findSubmutation } from "../constants/ship-corruption.mjs";
import { getShipCrit, SHIP_MANEUVERS, SHIP_LONG_ACTIONS,
         TORPEDO_NAV_SYSTEMS, NODE_STATES,
         torpedoProfile } from "../constants/ship-combat.mjs";
import { CREW_POP_TABLE, CREW_MORALE_TABLE, CREW_RATING_TABLE, crewActiveRows, OFFICER_POSTS,
         crewActionsPerSR, moralePerInfluence, SHORE_LEAVE, CREW_RECRUIT,
         MUTINY_APPROACHES, MUTINY_WIN_DOS } from "../constants/ship.mjs";
import { SHIP_RELATIONS } from "../constants/ship-tokens.mjs";
import { CRAFT_KINDS } from "../constants/small-craft.mjs";
import { esc } from "../helpers/utils.mjs";
import { openContextMenu, itemContextEntries } from "./context-menu.mjs";
import { whenEditable, onTab, filePicker } from "./v2-helpers.mjs";
import { actorFactionsContext, activateFactionFieldListeners } from "../apps/actor-factions.mjs";
import { actorHullItem, clearHull } from "../apps/ship-hull.mjs";
import { openHullPicker } from "./hull-picker.mjs";

const CRAFT_STATE = { stored: "На борту", prepared: "Подготовлена", launched: "В вылете", returning: "Возврат (топливо!)", rearming: "Перевооружение" };
const CRAFT_STRENGTH = { full: "Полная", half: "Полусильная", destroyed: "Уничтожена" };
// Какие типы МЛА чем атакуют (для кнопки «Запуск»).
const CRAFT_LAUNCH = { fighter: "fighter", bomber: "bomber", torpedoBomber: "bomber", assaultBoat: "assault", multipurpose: "fighter", support: null, aeronautica: null };
// Запас топлива/кислорода (СХ автономных действий до обязательного возврата).
const CRAFT_FUEL = { fighter: 4, assaultBoat: 4, multipurpose: 4, bomber: 6, torpedoBomber: 6, support: 99, aeronautica: 99 };

const KIND_LABELS = {
  hull: "Корпус", drive: "Плазм. двигатель", warp: "Варп-двигатель",
  gellar: "Поле Геллера", voidShield: "Пуст. щиты", bridge: "Мостик",
  occulum: "Оккулум навигатора", astropathic: "Астропатический узел",
  lifeSustainer: "Жизнеобесп.", quarters: "Жилые отсеки", augur: "Ауспики",
  weapon: "Орудие", hold: "Трюм/Отсек", supplemental: "Улучшение", other: "Прочее"
};
const WTYPE_LABELS = {
  macrobattery: "Макробатарея", lance: "Лэнс", nova: "Нова-орудие",
  torpedo: "Торпеды", bay: "Ангар", other: "Прочее"
};

// Мелкие SVG-иконки для чат-карточек (когитаторный стиль) вместо эмодзи.
const _s = (b) => `<svg width="14" height="14" viewBox="0 0 16 16" style="vertical-align:-2px;margin-right:2px" fill="none" stroke="#4dffa6" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${b}</svg>`;
const ICO = {
  dice:   _s(`<path d="M8 1.5 L14.5 8 L8 14.5 L1.5 8 Z"/><circle cx="8" cy="8" r="1.3" fill="#4dffa6" stroke="none"/>`),
  hit:    _s(`<circle cx="8" cy="8" r="5.5"/><path d="M8 0.5 V4 M8 12 V15.5 M0.5 8 H4 M12 8 H15.5"/>`),
  crit:   _s(`<path d="M8 1 L9.6 6.2 L15 8 L9.6 9.8 L8 15 L6.4 9.8 L1 8 L6.4 6.2 Z" fill="#4dffa6" stroke="none"/>`),
  shield: _s(`<path d="M8 1.5 L14 4 V8.5 Q14 12.5 8 14.5 Q2 12.5 2 8.5 V4 Z"/>`),
  dmg:    _s(`<path d="M8 1.5 L14 8 L11 8 L11 14.5 L5 14.5 L5 8 L2 8 Z" fill="#4dffa6" stroke="none"/>`),
  torp:   _s(`<path d="M1.5 8 H10 M10 5 Q15 5.5 15 8 Q15 10.5 10 11 Z M10 5 L10 11" /><path d="M2 6 L2 10 M4.5 6 L4.5 10"/>`)
};

// "Свойство (X/Y)" из активных свойств узла — для отображения.
function propLabel(p) {
  const d = SHIP_PROPERTIES[p.key];
  if (!d) return "";
  let s = d.label;
  if (d.rating && (p.rating || p.rating === 0)) {
    s += ` (${p.rating}${d.rating2 && (p.rating2 || p.rating2 === 0) ? `/${p.rating2}` : ""})`;
  }
  return s;
}

// ── Действия листа ───────────────────────────────────────────────────────────
// ApplicationV2 зовёт обработчик [data-action] с this = лист и элементом-
// источником вторым аргументом. Обычные функции — чтобы карта действий
// сверялась с шаблоном тестом. Общая обвязка (whenEditable, onTab, filePicker)
// — в v2-helpers.mjs.

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
const officerIdOf = target => target.closest("[data-officer-id]")?.dataset.officerId;

// ── Доступно и тому, кто кораблём не владеет ──

/** Открыть лист офицера, сидящего на должности. */
async function onOfficerOpen(event, target) {
  const uuid = target.closest("[data-uuid]")?.dataset.uuid;
  if (!uuid) return;
  const doc = await fromUuid(uuid);
  (doc?.actor ?? doc)?.sheet?.render(true);
}

/** Освободить должность: владелец корабля — любую, игрок — только свою. */
async function onOfficerClear(event, target) {
  const id = officerIdOf(target);
  const officers = foundry.utils.deepClone(this.actor.system.officers || []);
  const o = officers.find(x => x.id === id);
  if (!o) return;
  if (!this.actor.isOwner) {
    const occ = o.uuid ? await fromUuid(o.uuid) : null;
    const occActor = occ?.actor ?? occ;
    if (!occActor?.isOwner) return ui.notifications.warn("Освободить можно только своё место.");
  }
  o.uuid = ""; o.name = ""; o.img = "";
  await this._persistOfficers(officers);
}

// ── Правящие действия ──

/** Добавить должность (название — из выпадающего списка рядом с кнопкой). */
async function onOfficerAdd() {
  const title = this.element.querySelector(".ship-officer-select")?.value || "Офицер";
  const officers = foundry.utils.deepClone(this.actor.system.officers || []);
  officers.push({ id: foundry.utils.randomID(), title, uuid: "", name: "", img: "" });
  await this.actor.update({ "system.officers": officers });
}

function onOfficerRemove(event, target) {
  const id = officerIdOf(target);
  return this.actor.update({ "system.officers": (this.actor.system.officers || []).filter(o => o.id !== id) });
}

/** Создать узел/торпеду прямо на корабле и открыть его лист. */
const creator = doc => async function () {
  const [it] = await this.actor.createEmbeddedDocuments("Item", [doc]);
  it?.sheet.render(true);
};

const onCreateComponent = creator({ name: "Новый узел", type: "component", system: { kind: "supplemental" } });

// ── Корпус: выбор пикером в шапке, не узел среди прочих (apps/ship-hull.mjs) ──
function onHullPick()  { return openHullPicker(this.actor); }
function onHullOpen()  { return actorHullItem(this.actor)?.sheet?.render(true); }
function onHullClear() { return clearHull(this.actor); }
const onCreateTorpedo   = creator({ name: "Новая торпеда", type: "torpedo",
  system: { warhead: "plasma", navSystem: "standard", quantity: 1 } });

// Взять груз на борт: сперва выбор типа — партия сразу называется по типу
// («Роскошь», «Топливо»), переименовать её можно потом.
function onCreateCargo() { return this._showCargoPicker(); }

/** Левый клик по названию — открыть лист узла / груза / торпеды. */
function onItemOpen(event, target) {
  this.actor.items.get(itemIdOf(target))?.sheet.render(true);
}

// Броски по грузам (порча, воровство, повреждение) и пассажирам.
function onCargoRoll(event, target) { return this._rollCargoEvent(target.dataset.kind); }

/** Сворачивание категории груза (состояние живёт до перерисовки листа). */
function onCargoGroupHead(event, target) {
  const key = target.dataset.groupKey;
  if (!key) return;
  this._cargoCollapse[key] = !this._cargoCollapse[key];
  this.render(false);
}

// Количество: кнопка «−» не опускается ниже 1, иначе авто-очистка
// израсходованных грузов удалила бы партию с одного клика; убрать её
// целиком — кнопкой выгрузки.
function onCargoQtyStep(event, target) {
  event.stopPropagation();
  const it = this.actor.items.get(itemIdOf(target));
  if (!it) return;
  const d = Number(target.dataset.step) || 0;
  return it.update({ "system.quantity": Math.max(1, (Number(it.system.quantity) || 0) + d) });
}

/** Пометка «для обслуживания корабля» — такой груз не занимает трюм. */
function onCargoSupply(event, target) {
  event.stopPropagation();
  const it = this.actor.items.get(itemIdOf(target));
  if (it) return it.update({ "system.shipSupply": !it.system.shipSupply });
}

/** Сбросить партию за борт / выгрузить. */
async function onCargoJettison(event, target) {
  event.stopPropagation();
  const it = this.actor.items.get(itemIdOf(target));
  if (!it) return;
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Выгрузить партию" },
    content: `<p>Убрать «<b>${esc(it.name)}</b>» из трюма?</p>`
  }).catch(() => false);
  if (ok) await it.delete();
}

// Запасы путешествия: месяц прошёл / пополнение до максимума.
function onSuppliesStep(event, target) {
  const d   = Number(target.dataset.step) || 0;
  const max = this.actor.system.derived?.supplies?.max ?? 6;
  const now = Number(this.actor.system.supplies?.value) || 0;
  return this.actor.update({ "system.supplies.value": Math.max(0, Math.min(max, now + d)) });
}

function onSuppliesFull() {
  return this.actor.update({ "system.supplies.value": this.actor.system.derived?.supplies?.max ?? 6 });
}

/** Бросок Искажения осквернения (1d100 + модификатор порога с реверсом знака). */
async function onRollDistortion() {
  const lvl = this.element.querySelector(".ship-distort-threshold")?.value;
  const thr = SHIP_DEFILEMENT_THRESHOLDS.find(t => String(t.level) === String(lvl))
              || SHIP_DEFILEMENT_THRESHOLDS[2];
  const applied = -thr.mod;                       // реверс знака модификатора порога
  const roll  = await (new Roll("1d100")).evaluate();
  const raw   = roll.total;
  const total = Math.max(1, Math.min(100, raw + applied));
  const dist  = findDistortion(total);
  const sgn   = (n) => `${n >= 0 ? "+" : ""}${n}`;
  const allRolls = [roll];

  const range = dist ? (dist.min === dist.max ? `${dist.min === 100 ? "00" : dist.min}` : `${dist.min}–${dist.max}`) : "";
  const distName = dist ? dist.name : "—";
  let descBlock = "";
  let submutText = "";
  if (dist) {
    descBlock = dist.desc
      ? `<div class="roll-distort-desc">${dist.desc}</div>`
      : `<div class="roll-distort-desc"><i>(описание не занесено — см. справочник)</i></div>`;
    if (dist.submut) {
      const sub = await (new Roll("1d10")).evaluate();
      allRolls.push(sub);
      const sm = findSubmutation(dist.submut, sub.total);
      submutText = sm ? `${sm.name}` : "";
      descBlock += `<div class="roll-threshold" style="margin-top:5px;">${dist.submut.label}: <b>${sub.total}</b>${sm ? ` — <b>${esc(sm.name)}</b>` : ""}</div>`;
      if (sm) descBlock += `<div class="roll-distort-desc">${sm.desc}</div>`;
    }
  }

  // Чат — в стиле броска листа персонажа (wh-roll-result).
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">Осквернение корабля — Искажение</div>
        <div class="roll-threshold">Порог: <b>${esc(thr.name)}</b> (${thr.dp} DP, мод ${sgn(thr.mod)} → реверс ${sgn(applied)})</div>
        <div class="roll-dice">1d100: <b>${raw}</b>${applied ? ` ${sgn(applied)} → <b>${total}</b>` : ""}</div>
        <div class="roll-outcome"><span class="roll-success">Искажение${range ? ` (${range})` : ""}: ${distName}</span></div>
        ${descBlock}
      </div>`,
    rolls: allRolls,
    sound: CONFIG.sounds.dice
  }, rollMode));

  // Записываем искажение в журнал осквернения на листе корабля.
  const arr = foundry.utils.deepClone(this.actor.system.distortions || []);
  arr.push({
    id: foundry.utils.randomID(), name: distName, range,
    threshold: thr.name, roll: raw, total,
    submut: submutText, desc: dist?.desc || "", ts: Date.now()
  });
  await this.actor.update({ "system.distortions": arr });
}

/** Удалить запись искажения из журнала. */
function onDistortDel(event, target) {
  const arr = (this.actor.system.distortions || []).filter(d => d.id !== target.dataset.id);
  return this.actor.update({ "system.distortions": arr });
}

// ── Космический бой ──

/** Инициатива: 1d10 + бонус DT корабля. */
async function onInitRoll() {
  const dt = this.actor.system.derived?.chars?.detection || 0;
  const r  = await (new Roll(`1d10 + ${dt}`)).evaluate();
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `<div class="wh-roll-result"><div class="roll-header">Инициатива корабля</div>
      <div class="roll-dice">1d10 + DT ${dt} = <b>${r.total}</b></div></div>`,
    rolls: [r], sound: CONFIG.sounds.dice
  }, rollMode));
}

/** Стрельба из орудия — открыть лист атаки. */
function onFireWeapon(event, target) {
  const it = this.actor.items.get(target.dataset.itemId);
  if (it) this._showFireDialog(it);
}

// ── Ангар: эскадрильи (МЛА) ──

const onCraftAdd = creator({ name: "Новая эскадрилья", type: "smallCraft",
  img: "systems/warhammer-dbc/assets/item-icons/small-craft.svg" });

function onCraftOpen(event, target) { this.actor.items.get(itemIdOf(target))?.sheet.render(true); }
function onCraftDel(event, target)  { return this.actor.items.get(itemIdOf(target))?.delete(); }

function onCraftLoss(event, target) {
  const it = this.actor.items.get(itemIdOf(target)); if (!it) return;
  const next = (it.system.strength || "full") === "full" ? "half" : "destroyed";
  return it.update({ "system.strength": next,
    ...(next === "destroyed" ? { "system.state": "stored", "system.turnsOut": 0 } : {}) });
}

// Жизненный цикл: подготовить → запуск → возврат (перевооружение).
function onCraftPrepare(event, target) {
  const it = this.actor.items.get(itemIdOf(target));
  if (it) return this._prepareCraft(it);
}

function onCraftLaunch(event, target) {
  const it = this.actor.items.get(itemIdOf(target)); if (!it) return;
  if (it.system.strength === "destroyed") return ui.notifications.warn("Уничтоженная эскадрилья не может вылетать.");
  const kind = target.dataset.kind;
  it.update({ "system.state": "launched", "system.turnsOut": 0 });
  if (kind === "fighter") this._showFighterDialog(it);
  else if (kind) this._showCraftAttack(kind, it);
}

function onCraftReturn(event, target) {
  const it = this.actor.items.get(itemIdOf(target));
  if (it) return it.update({ "system.state": "rearming", "system.turnsOut": 0 });
}

function onCrewRecover(event, target) { return this._showCrewRecovery(target.dataset.kind); }

export class WarhammerShipSheet
  extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    // ship-sheet — на самой форме листа: CSS цепляется за
    // «.warhammer-dbc.ship-sheet», а у V1 этот класс нёс <form> в шаблоне.
    classes: ["warhammer-dbc", "sheet", "actor", "ship", "wh-holo", "ship-sheet"],
    position: { width: 780, height: 760 },
    window: { resizable: true },
    form: { submitOnChange: true, closeOnSubmit: false },
    actions: {
      tab: onTab,
      portrait: whenEditable(onPortrait),
      // Открыть лист офицера и освободить своё место доступны и игроку-не-
      // владельцу: права проверяются внутри, иначе он не вышел бы с поста
      // на чужом корабле.
      officerOpen:  onOfficerOpen,
      officerClear: onOfficerClear,

      officerAdd:      whenEditable(onOfficerAdd),
      officerRemove:   whenEditable(onOfficerRemove),
      createComponent: whenEditable(onCreateComponent),
      hullPick:        whenEditable(onHullPick),
      hullOpen:        onHullOpen,
      hullClear:       whenEditable(onHullClear),
      createCargo:     whenEditable(onCreateCargo),
      createTorpedo:   whenEditable(onCreateTorpedo),
      itemOpen:        whenEditable(onItemOpen),
      cargoRoll:       whenEditable(onCargoRoll),
      cargoGroupHead:  whenEditable(onCargoGroupHead),
      cargoQtyStep:    whenEditable(onCargoQtyStep),
      cargoSupply:     whenEditable(onCargoSupply),
      cargoJettison:   whenEditable(onCargoJettison),
      suppliesStep:    whenEditable(onSuppliesStep),
      suppliesFull:    whenEditable(onSuppliesFull),
      rollDistortion:  whenEditable(onRollDistortion),
      distortDel:      whenEditable(onDistortDel),
      initRoll:        whenEditable(onInitRoll),
      fireWeapon:      whenEditable(onFireWeapon),
      critRoll:        whenEditable(function () { return this._rollShipCrit(); }),
      ramRoll:         whenEditable(function () { return this._showRamDialog(); }),
      boardRoll:       whenEditable(function () { return this._showBoardingDialog(); }),
      salvoRoll:       whenEditable(function () { return this._showSalvoDialog(); }),
      turretRoll:      whenEditable(function () { return this._showTurretDialog(); }),
      bomberRoll:      whenEditable(function () { return this._showCraftAttack("bomber"); }),
      assaultRoll:     whenEditable(function () { return this._showCraftAttack("assault"); }),
      fighterRoll:     whenEditable(function () { return this._showFighterDialog(); }),
      craftAdd:        whenEditable(onCraftAdd),
      craftOpen:       whenEditable(onCraftOpen),
      craftDel:        whenEditable(onCraftDel),
      craftLoss:       whenEditable(onCraftLoss),
      craftPrepare:    whenEditable(onCraftPrepare),
      craftLaunch:     whenEditable(onCraftLaunch),
      craftReturn:     whenEditable(onCraftReturn),
      hangarAdvance:   whenEditable(function () { return this._craftAdvanceTurn(); }),
      mutinyRoll:      whenEditable(function () { return this._rollMutiny(); }),
      mutinyQuell:     whenEditable(function () { return this._showMutinyQuell(); }),
      crewRecover:     whenEditable(onCrewRecover)
    }
  };

  static PARTS = {
    body: { template: "systems/warhammer-dbc/templates/actor/ship-sheet.hbs", root: true }
  };

  static TABS = {
    primary: {
      initial: "overview",
      tabs: [
        { id: "overview",   label: "Обзор" },
        { id: "components", label: "Узлы" },
        { id: "combat",     label: "Бой" },
        { id: "hangar",     label: "Ангар" },
        { id: "crew",       label: "Экипаж" },
        { id: "cargo",      label: "Грузы" },
        { id: "notes",      label: "Записи" }
      ]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Поле «Фракция» в шапке — общее для всех листов (apps/actor-factions.mjs).
    Object.assign(context, actorFactionsContext(this.actor));
    const sys = this.actor.system;
    context.actor = this.actor;
    context.tab = this.tabGroups?.primary ?? WarhammerShipSheet.TABS.primary.initial;
    context.editable = this.isEditable;
    context.system    = sys;
    context.derived   = sys.derived || {};
    // ── Заметки: prose-mirror с переключаемым режимом (как у Journal Entries).
    context.notesEnriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      sys.notes || "", { relativeTo: this.actor, secrets: this.actor.isOwner });
    const _down = (s) => !!s.damaged || (s.status && s.status !== "intact");

    // ── Слот «Корпус» в шапке — выбор через пикер (sheets/hull-picker.mjs),
    // не узел среди прочих (apps/ship-hull.mjs::actorHullItem).
    const hullItem = actorHullItem(this.actor);
    context.hullSlot = hullItem
      ? { id: hullItem.id, img: hullItem.img, name: hullItem.name,
          hullClass: hullItem.system.hullClass || "" }
      : null;

    context.shipTypes = SHIP_TYPES;
    context.shipChars = SHIP_CHARS;
    context.shipRelations = SHIP_RELATIONS;

    context.components = this.actor.items
      .filter(i => i.type === "component")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(i => ({
        id: i.id, name: i.name, img: i.img,
        kind: i.system.kind, kindLabel: KIND_LABELS[i.system.kind] || i.system.kind,
        power: i.system.power ?? 0,
        space: i.system.space ?? 0,
        sp: i.system.sp ?? 0,
        external: !!i.system.external,
        damaged:  _down(i.system),
        aspects:  (i.system.shipProps || []).map(propLabel).filter(Boolean).join(", ")
                  || i.system.aspects || ""
      }));

    // Орудия для вкладки «Бой».
    const shipAimer = context.derived.aimer || 0;
    context.weapons = this.actor.items
      .filter(i => i.type === "component" && i.system.kind === "weapon" && i.system.weapon?.wType !== "bay")
      .map(i => {
        const props = i.system.shipProps || [];
        const w  = effectiveWeapon(i.system);   // профиль с учётом качества узла
        const qm = shipQualityMods(i.system);
        const ownAimer = props.filter(p => p.key === "aimer").reduce((a, p) => a + (Number(p.rating) || 0), 0);
        const arcKey = SHIP_WEAPON_ARCS[w.arc] ? w.arc : "";
        return {
          id: i.id, name: i.name, damaged: _down(i.system),
          wType: WTYPE_LABELS[w.wType] || w.wType || "—",
          strength: w.strength || 0, damage: w.wType === "torpedo" ? "боеголовка" : (w.damage || "—"),
          crit: w.crit || 0, range: w.range || 0,
          arcKey, arc: SHIP_WEAPON_ARCS[arcKey] || "— не назначено —",
          bsBonus: ownAimer + shipAimer,
          quality: i.system.quality, qualityLabel: QUALITY_LABELS[i.system.quality] || "",
          qualityNeed: qm.need,
          props: props.map(propLabel).filter(Boolean).join(", ")
        };
      });
    context.shipArcs = SHIP_WEAPON_ARCS;
    const wcRaw = context.derived.wc || { positions: [], over: false, unassigned: 0 };
    context.wc = {
      over: wcRaw.over, unassigned: wcRaw.unassigned,
      positions: (wcRaw.positions || []).map(p => {
        const pips = [];
        const total = Math.max(p.max, p.used);
        for (let i = 0; i < total; i++) pips.push({ on: i < p.used && i < p.max, over: i >= p.max && i < p.used });
        return { ...p, pips };
      })
    };

    // Грузы: группируем по категории (Сырьё / Товары), внутри — по типу.
    // Объём в трюме = LC единицы × количество; припасы корабля трюм не занимают.
    const collapsed = this._cargoCollapse ??= {};
    const groupMap = new Map();
    for (const i of this.actor.items.filter(x => x.type === "cargo")) {
      const key = i.system.cargoType || "other";
      const t   = getCargoType(key);
      if (!groupMap.has(key)) groupMap.set(key, {
        key, group: t?.group || "Прочее", typeLabel: t?.label || key,
        rarity: t?.rarity || "—", examples: t?.examples || "",
        lcTotal: 0, valueTotal: 0, units: 0, collapsed: !!collapsed[key], items: []
      });
      const g    = groupMap.get(key);
      const qty  = Number(i.system.quantity) || 0;
      const unit = Number(i.system.lc) || 0;
      const vol  = unit * qty;
      const val  = (Number(i.system.price) || 0) * qty;
      const rr   = cargoRarity(i.system);
      if (!i.system.shipSupply) g.lcTotal += vol;
      g.valueTotal += val;
      g.units      += qty;
      g.items.push({
        id: i.id, name: i.name, img: i.img, unitLc: unit, volume: vol, quantity: qty,
        price: Number(i.system.price) || 0, value: val,
        shipSupply: !!i.system.shipSupply, origin: i.system.origin || "",
        consignee: i.system.consignee || "",
        quality: i.system.quality, qualityLabel: CARGO_QUALITY[i.system.quality] || i.system.quality,
        rarity: rr.value ?? (i.system.rarity ?? 0), rarityKnown: rr.known !== false,
        xenos: !!i.system.xenos, astartes: !!i.system.astartes,
        description: i.system.description || ""
      });
    }
    for (const g of groupMap.values()) g.items.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    context.cargoGroups = Array.from(groupMap.values())
      .sort((a, b) => a.group.localeCompare(b.group, "ru") || a.typeLabel.localeCompare(b.typeLabel, "ru"));
    context.cargoTrade = CARGO_TRADE;
    context.cargoTypeOptions = buildCargoTypeOptions("");
    context.cargoQuality = CARGO_QUALITY;

    // Опции порога осквернения для броска искажения.
    const dpNow = Number(sys.defilement) || 0;
    context.defileThresholdOptions = SHIP_DEFILEMENT_THRESHOLDS.map(t => {
      // По умолчанию выбираем наивысший уже пройденный порог.
      const crossedNow = SHIP_DEFILEMENT_THRESHOLDS.filter(x => dpNow >= x.dp).pop();
      const sel = crossedNow && crossedNow.level === t.level ? " selected" : "";
      const mod = `${t.mod >= 0 ? "+" : ""}${t.mod}`;
      return `<option value="${t.level}"${sel}>${esc(t.name)} — ${t.dp} DP (мод ${mod})</option>`;
    }).join("");

    // Журнал искажений осквернения (для вкладки «Записи»).
    context.distortions = (sys.distortions || []).map(d => ({
      id: d.id, name: d.name, range: d.range, threshold: d.threshold,
      roll: d.roll, total: d.total, submut: d.submut, desc: d.desc,
      when: d.ts ? new Date(d.ts).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : ""
    })).reverse();   // новые сверху

    // Справочники для вкладки «Бой».
    context.shipManeuvers   = SHIP_MANEUVERS;
    context.shipLongActions = SHIP_LONG_ACTIONS;
    context.torpedoNav      = TORPEDO_NAV_SYSTEMS;
    context.nodeStates      = NODE_STATES;

    // Торпеды-боезапас на корабле (собранные: боеголовка + наведение).
    context.torpedoes = this.actor.items.filter(i => i.type === "torpedo").map(i => {
      const p = torpedoProfile(i.system.warhead, i.system.navSystem);
      return {
        id: i.id, name: i.name, quantity: Number(i.system.quantity) || 0,
        label: p?.label || "—", dmg: p?.dmg || "—", crit: p?.crit || 0,
        navTR: p?.navTR || 0, tp: p?.tp || 0, rng: p?.rng || 0
      };
    });

    // Полуразрушен (Прочность 0 при наличии максимума).
    const hiVal = Number(sys.hullIntegrity?.value) || 0;
    const hiMax = Number(context.derived.hullIntegrityMax) || 0;
    context.halfWrecked = hiMax > 0 && hiVal <= 0;

    // ── Экипаж: активные пороговые эффекты ──
    const cp = Number(sys.crew?.population);
    const cm = Number(sys.crew?.morale);
    context.crewPop        = CREW_POP_TABLE;
    context.crewMorale     = CREW_MORALE_TABLE;
    context.crewRatingTable = CREW_RATING_TABLE;
    context.crewActions = crewActionsPerSR(this.actor.system.crew?.rating || "");
    context.crewInfDie  = moralePerInfluence(this.actor.system.shipType);
    context.crewPopActive    = crewActiveRows(CREW_POP_TABLE, cp);
    context.crewMoraleActive = crewActiveRows(CREW_MORALE_TABLE, cm);
    context.crewPopVal = cp; context.crewMoraleVal = cm;

    // ── Офицеры: ростер по должностям (перетаскивание токена → занять место) ──
    const roster = Array.isArray(sys.officers) ? sys.officers : [];
    context.officers = roster.map(o => {
      let doc = null;
      if (o.uuid) { try { doc = fromUuidSync(o.uuid); } catch (e) { doc = null; } }
      const actor = doc?.actor ?? doc;
      return {
        id: o.id, title: o.title || "Офицер",
        uuid: o.uuid || "", occupied: !!o.uuid,
        name: actor?.name || o.name || (o.uuid ? "(недоступен)" : ""),
        img:  actor?.img  || o.img  || "icons/svg/mystery-man.svg",
        missing: !!o.uuid && !actor
      };
    });
    context.officerPosts = OFFICER_POSTS;

    // ── Ангар: отсеки (узлы wType=bay) и эскадрильи (МЛА на корабле) ──
    const bays = this.actor.items.filter(i => i.type === "component" && i.system.kind === "weapon" && i.system.weapon?.wType === "bay");
    context.hasHangar = bays.length > 0;
    if (context.hasHangar) {
      const capacity = bays.reduce((a, b) => a + (Number(b.system.weapon?.strength) || 0), 0);  // S — запуск/подготовка за СХ
      context.hangar = {
        bays: bays.map(b => ({ id: b.id, name: b.name, s: Number(b.system.weapon?.strength) || 0, damaged: _down(b.system) })),
        capacity,
        storageMax: capacity * 3,   // до 3 эскадрилий на очко S
      };
      const craft = this.actor.items.filter(i => i.type === "smallCraft");
      let stored = 0, prepared = 0;
      context.squadrons = craft.map(i => {
        const s = i.system; const qty = Math.max(1, Number(s.qty) || 1);
        const state = s.state || "stored";
        stored += qty; if (state === "prepared") prepared += qty;
        const fuel = CRAFT_FUEL[s.craftKind] || 4;
        const turns = Math.max(0, Number(s.turnsOut) || 0);
        return {
          id: i.id, name: i.name, img: i.img, qty,
          kind: CRAFT_KINDS[s.craftKind] || s.craftKind,
          launchKind: CRAFT_LAUNCH[s.craftKind] || null,
          cr: s.cr || 0, crAlt: s.crAlt || 0, spd: s.spd || 0, size: s.squadronSize || 0,
          state, stateLabel: CRAFT_STATE[state] || "На борту",
          strength: s.strength || "full", strengthLabel: CRAFT_STRENGTH[s.strength] || "Полная",
          isStored: state === "stored", isPrepared: state === "prepared",
          isOut: state === "launched" || state === "returning", isRearming: state === "rearming",
          fuel, turns, fuelLow: (state === "launched" || state === "returning") && turns >= fuel - 1,
          destroyed: s.strength === "destroyed"
        };
      });
      context.hangar.stored = stored;
      context.hangar.prepared = prepared;
      context.hangar.storageOver = stored > context.hangar.storageMax;
      context.hangar.prepOver = prepared > capacity;
    }

    return context;
  }

  // ── Посадка офицеров (перетаскивание токена/актора) ──
  _canDragDrop(_selector) { return true; }
  async _onDrop(event) {
    let data = null;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); } catch (e) {}
    if (data && (data.type === "Token" || data.type === "Actor")) return this._onDropActor(event, data);
    return super._onDrop(event);
  }
  // В V2 сюда приходит документ предмета, а не данные перетаскивания (V1).
  async _onDropItem(event, item) {
    if (!this.actor.isOwner) { ui.notifications.warn("Добавлять узлы на корабль может только его владелец или ГМ."); return false; }
    // Корпус на корабле всегда один — прежний снимаем перед вставкой нового,
    // иначе дроп из компендиума просто добавил бы второй (в отличие от
    // выбора пикером, apps/ship-hull.mjs::applyHull, который это уже делает).
    if (item.type === "shipHull") {
      const old = actorHullItem(this.actor);
      if (old) await this.actor.deleteEmbeddedDocuments("Item", [old.id]);
    }
    return super._onDropItem(event, item);
  }
  async _persistOfficers(officers) {
    if (this.actor.isOwner) { await this.actor.update({ "system.officers": officers }); return true; }
    const gm = game.users.activeGM;
    if (!gm) { ui.notifications.warn("Нужен активный ГМ, чтобы занять должность на чужом корабле."); return false; }
    game.socket.emit("system.warhammer-dbc", { action: "shipOfficers", shipUuid: this.actor.uuid, officers, userId: game.user.id });
    return true;
  }
  async _onDropActor(event, data) {
    const uuid = data.uuid
      || (data.type === "Actor" && data.id ? `Actor.${data.id}` : null)
      || (data.type === "Token" && data.sceneId && data.tokenId ? `Scene.${data.sceneId}.Token.${data.tokenId}` : null);
    if (!uuid) return false;
    let doc = null; try { doc = await fromUuid(uuid); } catch (e) {}
    const actor = doc?.actor ?? doc;
    if (!actor || actor.id === this.actor.id) return false;
    if (!this.actor.isOwner && !actor.isOwner) {
      ui.notifications.warn("На чужой корабль можно посадить только своего персонажа."); return false;
    }
    const officers = foundry.utils.deepClone(this.actor.system.officers || []);
    if (!officers.length) { ui.notifications.warn("Сначала создайте должности (вкладка «Экипаж» → «Добавить должность»)."); return false; }
    const seatEl = event.target?.closest?.("[data-officer-id]");
    let target = seatEl ? officers.find(o => o.id === seatEl.dataset.officerId) : null;
    // Один персонаж может занимать несколько постов — прежние НЕ освобождаем.
    // Ищем свободное место, но если целевое уже занято этим же — просто выходим.
    if (!target) target = officers.find(o => !o.uuid);
    if (!target) { ui.notifications.warn("Все должности заняты — добавьте новую или освободите одну."); return false; }
    if (target.uuid === uuid) { ui.notifications.info(`${actor.name} уже на этой должности.`); return false; }
    target.uuid = uuid; target.name = actor.name; target.img = actor.img;
    const ok = await this._persistOfficers(officers);
    if (ok) ui.notifications.info(`${actor.name} — ${target.title} на «${this.actor.name}».`);
    return ok;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    if (!el) return;
    // Перетаскивание привязывает сам ActorSheetV2, а права спрашивает у
    // _canDragDrop — он здесь всегда true: игрок-не-владелец должен уметь
    // посадить своего персонажа на чужой корабль (запись идёт через активного
    // ГМа по сокету, см. _persistOfficers).
    // Поле «Фракция» в шапке — общее для всех листов.
    activateFactionFieldListeners(el, this.actor);

    /** Слушатель на все узлы по селектору — замена jQuery-обхода из V1. */
    const on = (sel, ev, fn) => el.querySelectorAll(sel).forEach(n => n.addEventListener(ev, fn));

    if (!this.isEditable) return;

    // Перестановка должностей перетаскиванием (за «ручку»). Своё перетаскивание
    // помечаем флагом: без него дроп актора на строку принял бы обработчик
    // перестановки, а перестановку — посадка.
    let dragOfficer = null;
    on(".ship-officer-grip", "dragstart", ev => {
      dragOfficer = officerIdOf(ev.currentTarget);
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", "wh-officer-reorder");
    });
    on(".ship-officer-grip", "dragend", () => {
      dragOfficer = null;
      el.querySelectorAll(".ship-officer-row").forEach(r => r.classList.remove("wh-drag-over"));
    });
    on(".ship-officer-row", "dragover", ev => {
      if (!dragOfficer) return;               // не наша перестановка — не мешаем посадке
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
    });
    on(".ship-officer-row", "dragenter", ev => { if (dragOfficer) ev.currentTarget.classList.add("wh-drag-over"); });
    on(".ship-officer-row", "dragleave", ev => { ev.currentTarget.classList.remove("wh-drag-over"); });
    on(".ship-officer-row", "drop", async ev => {
      if (!dragOfficer) return;               // дроп актора — пусть обработает посадка
      ev.preventDefault(); ev.stopPropagation();
      const overId = ev.currentTarget.dataset.officerId;
      const dragId = dragOfficer; dragOfficer = null;
      if (!overId || dragId === overId) return;
      const officers = foundry.utils.deepClone(this.actor.system.officers || []);
      const from = officers.findIndex(o => o.id === dragId);
      const to   = officers.findIndex(o => o.id === overId);
      if (from < 0 || to < 0) return;
      const [moved] = officers.splice(from, 1);
      officers.splice(to, 0, moved);
      await this.actor.update({ "system.officers": officers });
    });

    on(".ship-officer-title", "change", async ev => {
      const officers = foundry.utils.deepClone(this.actor.system.officers || []);
      const o = officers.find(x => x.id === officerIdOf(ev.currentTarget));
      if (o) { o.title = ev.currentTarget.value; await this.actor.update({ "system.officers": officers }); }
    });

    // Авто-удаление израсходованных грузов (количество 0) — например потраченных
    // боеголовок/систем наведения. Торпеды-сборки не трогаем (это переиспользуемый профиль).
    const spent = this.actor.items
      .filter(i => i.type === "cargo" && (Number(i.system.quantity) || 0) <= 0)
      .map(i => i.id);
    if (spent.length) { this.actor.deleteEmbeddedDocuments("Item", spent); return; }

    // У торпедных аппаратов урона нет (он от боеголовки) — чистим устаревшее значение.
    const badTorp = this.actor.items
      .filter(i => i.type === "component" && i.system.weapon?.wType === "torpedo" && (i.system.weapon?.damage || "") !== "")
      .map(i => ({ _id: i.id, "system.weapon.damage": "" }));
    if (badTorp.length) { this.actor.updateEmbeddedDocuments("Item", badTorp); return; }

    // Количество партии прямым вводом (ноль оставляем: авто-очистка выше уберёт
    // израсходованное при следующей перерисовке).
    on(".cargo-qty-input", "change", async ev => {
      const it = this.actor.items.get(itemIdOf(ev.currentTarget));
      if (it) await it.update({ "system.quantity": Math.max(0, Number(ev.currentTarget.value) || 0) });
    });

    // Назначение позиции орудия (Оснащённость).
    on(".ship-arc-select", "change", ev => {
      const id = ev.currentTarget.dataset.itemId;
      if (id) this.actor.items.get(id)?.update({ "system.weapon.arc": ev.currentTarget.value });
    });

    // Быстрые переключатели «Внешний» / «Повреждён».
    on(".ship-comp-toggle", "change", ev => {
      const t  = ev.currentTarget;
      const id = itemIdOf(t);
      if (id) this.actor.items.get(id)?.update({ [`system.${t.dataset.flag}`]: t.checked });
    });

    on(".ship-craft-qty-inp", "change", ev => {
      const it = this.actor.items.get(itemIdOf(ev.currentTarget));
      if (it) it.update({ "system.qty": Math.max(1, parseInt(ev.currentTarget.value) || 1) });
    });

    // ПКМ по строке узла / груза / торпеды — то же меню, что у предметов на
    // листе персонажа. Со своей копией удаление шло молча (wdbc-9z9).
    on(".ship-comp-row, .cargo-row, .torpedo-row", "contextmenu", ev => {
      ev.preventDefault(); ev.stopPropagation();
      const item = this.actor.items.get(itemIdOf(ev.currentTarget));
      if (!item) return;
      openContextMenu(ev, itemContextEntries(item));
    });
  }

  _rollMutiny() {
    // Не <form>: содержимое DialogV2 уже внутри его формы, вложенная сломала бы
    // button.form, через который читаются поля.
    return foundry.applications.api.DialogV2.wait({
      window: { title: "Тест бунта (Command)" },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
      content: `<div style="padding:6px;"><div class="atk-dlg-row"><label>Command капитана:</label><input id="mut-cmd" type="number" value="40"/></div>
        <div class="atk-range-info" style="font-size:0.84em;">Тест Command +0 при падении CM до 70/40/10. Провал → часть экипажа бунтует.</div></div>`,
      buttons: [
        {
          action: "roll", label: "Бросок!", default: true,
          callback: async (event, button) => {
            const cmd = parseInt(button.form.querySelector("#mut-cmd").value) || 0;
            const r = await (new Roll("1d100")).evaluate();
            const ok = r.total <= cmd;
            const rollMode = game.settings.get("core", "rollMode");
            await ChatMessage.create(ChatMessage.applyRollMode({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              content: `<div class="wh-roll-result"><div class="roll-header">Тест бунта — Command</div>
                <div class="roll-threshold">Command: <b>${cmd}</b></div>
                <div class="roll-dice">${ICO.dice} 1d100: <b>${r.total}</b></div>
                <div class="roll-outcome">${ok ? `<span class="roll-success">Бунт предотвращён</span>` : `<span class="roll-failure">Бунт! Часть экипажа восстаёт — подавление встречным Command/Charm/Intimidation.</span>`}</div></div>`,
              rolls: [r], sound: CONFIG.sounds.dice
            }, rollMode));
          }
        },
        { action: "cancel", label: "Отмена" }
      ]
    });
  }

  // Диалог стрельбы (в стиле атаки персонажа).
  _showFireDialog(item) {
    // Профиль с учётом качества узла: Good/Best.Q правят Урон, Силу, Крит и Дальность.
    const w   = effectiveWeapon(item.system);
    const der = this.actor.system.derived || {};
    const aimer = der.aimer || 0;
    const wtKey = w.wType || "macrobattery";
    const isNova = wtKey === "nova";
    const wtLabel = WTYPE_LABELS[wtKey] || wtKey;

    if (wtKey === "bay") {
      return ui.notifications.info("Ангары запускают эскадрильи через Длительные Действия (см. справочник «Бой»), а не действие Стрельба.");
    }

    // BS канонира: из офицера-канонира (Мастер-канонир / любой «канонир»), если занят.
    let gunBS = 35, gunName = "";
    for (const o of (this.actor.system.officers || [])) {
      if (!o.uuid || !/канонир/i.test(o.title || "")) continue;
      let d = null; try { d = fromUuidSync(o.uuid); } catch (e) {}
      const a = d?.actor ?? d;
      const bs = a?.system?.characteristics?.bs?.total;
      if (bs != null) { gunBS = bs; gunName = a.name; if (/мастер/i.test(o.title)) break; }
    }

    const isTorpedo = wtKey === "torpedo";
    const torps = this.actor.items.filter(i => i.type === "torpedo" && (Number(i.system.quantity) || 0) > 0);
    if (isTorpedo && !torps.length) {
      return ui.notifications.warn("Нет торпед в боезапасе. Создайте торпеду («+ торпеда» на вкладке «Бой») и задайте количество.");
    }
    const warheadRow = isTorpedo ? `
        <div class="atk-dlg-row"><label>Торпеда (боезапас):</label>
          <select id="sf-torp">
            ${torps.map(t => { const p = torpedoProfile(t.system.warhead, t.system.navSystem); return `<option value="${t.id}">${esc(t.name)} — ${p?.label || ""} ×${t.system.quantity}</option>`; }).join("")}
          </select>
        </div>
        <div class="atk-dlg-row"><label>Запустить торпед (≤ S ${w.strength || 0}):</label><input id="sf-count" type="number" value="1" min="1"/></div>` : "";

    // Авто-подстановка щитов/брони отмеченной цели-корабля.
    const tgt = [...(game.user?.targets ?? [])].map(t => t.actor ?? t.document?.actor).find(a => a?.type === "ship");
    const tgtVS  = tgt ? (Number(tgt.system.derived?.chars?.voidShields) || 0) : 0;
    const tgtArm = tgt ? (Number(tgt.system.derived?.chars?.armour) || 0) : 0;
    const tgtNote = tgt
      ? `Цель: <b>${esc(tgt.name)}</b> — Пуст. щиты <b>${tgtVS}</b>, Броня <b>${tgtArm}</b> (подставлено).`
      : `Отметьте (target) корабль-цель — щиты и броня подставятся автоматически.`;

    // Не <form>: содержимое DialogV2 уже внутри его формы, вложенная сломала бы
    // button.form, через который читаются поля.
    const content = `
      <div class="wh-ship-fire" style="padding:6px;">
        <div class="atk-dlg-header"><span class="atk-weapon-name">${esc(item.name)}</span> <span style="opacity:.7">(${wtLabel}, S ${w.strength||0}, Урон ${w.damage||"—"}, Крит ${w.crit||0})</span></div>
        <div class="atk-range-info" style="font-size:0.84em;">${tgtNote}</div>
        ${warheadRow}
        <div class="atk-dlg-row"><label>BS канонира${gunName ? ` (${gunName})` : ""}:</label><input id="sf-bs" type="number" value="${gunBS}"/></div>
        <div class="atk-dlg-row"><label>Прицел / Aimer (+):</label><input id="sf-aim" type="number" value="${aimer}"/></div>
        <div class="atk-dlg-row"><label>Дальность:</label>
          <select id="sf-range">
            <option value="10">Ближе Rng/2 (+10)</option>
            <option value="0" selected>В пределах Rng (0)</option>
            <option value="-10">Дальше Rng (−10)</option>
          </select>
        </div>
        <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="sf-mod" type="number" value="0"/></div>
        <div class="atk-dlg-row"><label>Пустотные щиты цели:</label><input id="sf-vs" type="number" value="${tgtVS}" min="0"/></div>
        <div class="atk-dlg-row"><label>Броня цели:</label><input id="sf-arm" type="number" value="${tgtArm}" min="0"/></div>
        <div class="atk-range-info" style="font-size:0.84em;">
          ${isNova ? "Нова-орудие: −20 к попаданию (учтено). " : ""}Пуст. щиты гасят до <b>своей мощности</b> попаданий из залпа, затем схлопываются (остальные проходят). Макробатареи: попадания = СУ (до S), урон складывается, броня вычитается из суммы.
          Лэнсы: 1 попадание +1 за каждые 3 СУ, игнор брони. Торпеды: щиты не спасают, броня — по каждой.
        </div>
      </div>`;

    return foundry.applications.api.DialogV2.wait({
      window: { title: `Стрельба: ${item.name}` },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
      position: { width: 400 },
      content,
      buttons: [
        {
          action: "fire", icon: "fas fa-crosshairs", label: "Огонь!", default: true,
          callback: async (event, button) => {
            const form = button.form;
            const num = (id, dflt = 0) => parseInt(form.querySelector(id)?.value) || dflt;
            await this._resolveShipAttack(item, {
              bs:      num("#sf-bs"),
              aim:     num("#sf-aim"),
              range:   num("#sf-range"),
              mod:     num("#sf-mod"),
              shields: num("#sf-vs"),
              armour:  num("#sf-arm"),
              // Строка торпеды есть только у торпедных аппаратов.
              torpedoItemId: form.querySelector("#sf-torp")?.value || "",
              launchCount:   num("#sf-count", 1)
            });
          }
        },
        { action: "cancel", label: "Отмена" }
      ]
    });
  }

  async _resolveShipAttack(item, o) {
    const w     = item.system.weapon || {};
    const wt    = w.wType || "macrobattery";
    const S     = Number(w.strength) || 1;
    // Торпеда (боеголовка + наведение) — переопределяет урон/крит/TP/рейтинг наведения.
    const torpItem = (wt === "torpedo" && o.torpedoItemId) ? this.actor.items.get(o.torpedoItemId) : null;
    const torp = torpItem ? torpedoProfile(torpItem.system.warhead, torpItem.system.navSystem) : null;
    // Сколько торпед фактически запущено (≤ S, ≤ остаток).
    const torpAvail  = torpItem ? (Number(torpItem.system.quantity) || 0) : 0;
    const launched   = torp ? Math.max(1, Math.min(o.launchCount || 1, S, torpAvail)) : 0;
    let rawDmg = torp?.dmg || w.damage || "";
    let critN  = torp ? (Number(torp.crit) || 0) : (Number(w.crit) || 0);
    let tpArmour = torp ? (Number(torp.tp) || 0) : 0;        // Terminal Penetration снижает броню
    let warheadIgnoreArmour = !!torp?.ignoreArmour;
    const navTR = torp ? (Number(torp.navTR) || 0) : 0;
    // Очищаем формулу урона от лишнего текста (тип урона и т.п.): «2d10+12 R» → «2d10+12».
    const dmgMatch = String(rawDmg).match(/\(?\d*\s*d\s*\d+\s*(?:[+\-]\s*\d+)?\)?\s*(?:[*x×]\s*\d+)?/i);
    const dmgF  = (dmgMatch ? dmgMatch[0] : rawDmg).replace(/\s+/g, "").replace(/[x×]/i, "*") || "1d10";
    const novaPenalty = wt === "nova" ? -20 : 0;
    const threshold = o.bs + o.aim + o.range + o.mod + novaPenalty + navTR;
    const roll = await (new Roll("1d100")).evaluate();
    const rv   = roll.total;
    const hit  = rv <= threshold;
    const deg  = Math.max(1, Math.floor(Math.abs(rv - threshold) / 10) + 1);
    const allRolls = [roll];

    let hitsRaw = 0, ignoreArmour = false, shieldsApply = true, sumDamage = true;
    if (wt === "lance")        { hitsRaw = 1 + Math.floor(deg / 3); ignoreArmour = true;  sumDamage = false; }
    else if (wt === "torpedo") { hitsRaw = Math.min(deg, launched); ignoreArmour = warheadIgnoreArmour; shieldsApply = false; sumDamage = false; }
    else if (wt === "nova")    { hitsRaw = (await (new Roll("1d5")).evaluate().then(r => { allRolls.push(r); return r.total; })); ignoreArmour = true; sumDamage = false; }
    else                       { hitsRaw = deg; }                 // макробатарея и пр.
    hitsRaw = Math.min(hitsRaw, wt === "nova" ? hitsRaw : S);
    // Terminal Penetration снижает броню (только торпеды); звуковая — игнор брони.
    const effArmour = Math.max(0, o.armour - tpArmour);

    let body, applyData = "";
    if (!hit) {
      body = `<div class="roll-outcome"><span class="roll-failure">Промах</span></div>`;
      // Нова даже при промахе может задеть — памятка
      if (wt === "nova") body += `<div class="roll-threshold" style="font-size:0.82em;">Нова: точка смещается на 1 ПЕ (чёт — от стрелка, нечёт — к стрелку); суда в 1 ПЕ от точки получают 1d5 попаданий.</div>`;
    } else {
      const shieldsUsed = shieldsApply ? Math.min(o.shields, hitsRaw) : 0;
      const hitsAfter   = Math.max(0, hitsRaw - shieldsUsed);
      let totalHI = 0, dmgParts = [], critByNova = 0;
      for (let i = 0; i < hitsAfter; i++) {
        let dr;
        try {
          dr = await (new Roll(dmgF)).evaluate();
        } catch (e) {
          ui.notifications.warn(`Неверная формула урона орудия «${item.name}»: «${w.damage}». Использую 1d10.`);
          dr = await (new Roll("1d10")).evaluate();
        }
        allRolls.push(dr);
        dmgParts.push(dr.total);
        if (wt === "nova" && dr.dice?.[0]?.results?.some(d => d.result >= 10)) critByNova++;
        if (wt === "torpedo" && critN && dr.dice?.[0]?.results?.some(d => d.result >= critN)) critByNova++;
      }
      if (sumDamage) {
        const sum = dmgParts.reduce((a, b) => a + b, 0);
        totalHI = ignoreArmour ? sum : Math.max(0, sum - effArmour);
      } else {
        totalHI = dmgParts.reduce((a, b) => a + (ignoreArmour ? b : Math.max(0, b - effArmour)), 0);
      }

      // Критическое попадание
      let critSection = "";
      let critRollVal = 0;
      const critHappens = (wt !== "nova" && wt !== "torpedo" && critN && deg >= critN);
      if (critHappens || critByNova > 0) {
        const cr = await (new Roll("1d5")).evaluate();
        allRolls.push(cr);
        critRollVal = cr.total;
        const ce = getShipCrit(critRollVal);
        const extra = critByNova > 1 ? ` (×${critByNova} крит. — для нова/торпед бросьте отдельно)` : "";
        critSection = `<div class="roll-damage-section"><div class="roll-damage-label">${ICO.crit} КРИТ! 1d5 = <b>${critRollVal}</b> — ${esc(ce?.name)}${extra}</div><div class="roll-distort-desc">${ce?.text || ""}</div></div>`;
      }
      // Крит без урона Прочности всё равно наносит 1 очко Прочности.
      if ((critHappens || critByNova > 0) && totalHI === 0) totalHI = 1;

      const dtParts = dmgParts.length ? ` <span style="opacity:.7">[${dmgParts.join(" + ")}]</span>` : "";
      const armourNote = ignoreArmour ? "игнор брони"
        : `броня ${effArmour}${tpArmour ? ` (TP −${tpArmour})` : ""}`;
      body = `
        <div class="roll-outcome"><span class="roll-success">${ICO.hit} Попадание — ${deg} ст. успеха</span></div>
        <div class="roll-threshold">Попаданий: <b>${hitsRaw}</b>${shieldsUsed ? ` ${ICO.shield} −щиты ${shieldsUsed} = <b>${hitsAfter}</b>` : ""} · ${armourNote}</div>
        <div class="roll-damage-section">
          <div class="roll-damage-label">${ICO.dmg} Урон Прочности: <b>${totalHI}</b>${dtParts}</div>
          <button class="wh-ship-dmg-btn" type="button" data-hi="${totalHI}">${ICO.dmg} Применить ${totalHI} урона Прочности → отмеченной цели</button>
        </div>
        ${critSection}`;
    }

    const subline = `${WTYPE_LABELS[wt] || wt} · S ${S}${critN ? ` · Крит ${critN}${(wt === "torpedo" || wt === "nova") ? "+" : ""}` : ""}${torp ? ` · ${ICO.torp} ${torp.label} ×${launched}${navTR ? ` (наведение +${navTR})` : ""}` : ""}`;
    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${ICO.torp} ${esc(item.name)} — Стрельба</div>
          <div class="roll-threshold">${subline}</div>
          <div class="roll-threshold">BS ${o.bs}${o.aim ? ` +${o.aim} приц.` : ""}${o.range ? ` ${o.range > 0 ? "+" : ""}${o.range} дальн.` : ""}${o.mod ? ` ${o.mod > 0 ? "+" : ""}${o.mod}` : ""}${novaPenalty ? ` ${novaPenalty} нова` : ""} → Порог <b>${threshold}</b></div>
          <div class="roll-dice">${ICO.dice} 1d100: <b>${rv}</b></div>
          ${body}
        </div>`,
      rolls: allRolls, sound: CONFIG.sounds.dice
    }, rollMode));

    // Расход торпед из боезапаса.
    if (torpItem && launched > 0) {
      await torpItem.update({ "system.quantity": Math.max(0, torpAvail - launched) });
    }
  }

  // Число степеней успеха по d100 (0 и меньше при провале).
  _dos(rv, thr) { return rv <= thr ? Math.floor((thr - rv) / 10) + 1 : 0; }
  _chat(html, rolls = []) {
    return ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result">${html}</div>`, rolls, sound: CONFIG.sounds.dice
    }, game.settings.get("core", "rollMode")));
  }

  // Суммарная S исправных ангарных отсеков (лимит подготовки/запуска за СХ).
  _hangarCapacity() {
    return this.actor.items.filter(i => i.type === "component" && i.system.kind === "weapon"
      && i.system.weapon?.wType === "bay" && !(i.system.damaged || (i.system.status && i.system.status !== "intact")))
      .reduce((a, b) => a + (Number(b.system.weapon?.strength) || 0), 0);
  }

  // Подготовка эскадрильи (с возможностью подготовить ЧАСТЬ стопки qty).
  async _prepareCraft(item) {
    if (item.system.strength === "destroyed") return ui.notifications.warn("Уничтоженная эскадрилья не может вылетать в этом бою.");
    const qty = Math.max(1, Number(item.system.qty) || 1);
    const cap = this._hangarCapacity();
    const prep = this.actor.items.filter(i => i.type === "smallCraft" && i.system.state === "prepared")
      .reduce((a, i) => a + Math.max(1, Number(i.system.qty) || 1), 0);
    const free = cap - prep;
    if (free <= 0) return ui.notifications.warn(`Лимит подготовки исчерпан (S ангаров = ${cap}).`);

    const apply = async (n) => {
      n = Math.max(1, Math.min(n, qty, free));
      if (n >= qty) return item.update({ "system.state": "prepared" });
      // Дробим: подготовленная стопка n, остаток qty−n остаётся на борту.
      const data = item.toObject(); delete data._id;
      data.system = { ...data.system, qty: n, state: "prepared", turnsOut: 0 };
      await item.update({ "system.qty": qty - n });
      await this.actor.createEmbeddedDocuments("Item", [data]);
    };

    if (qty <= 1) return apply(1);
    const max = Math.min(qty, free);
    return foundry.applications.api.DialogV2.wait({
      window: { title: `Подготовить: ${item.name}` },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
      position: { width: 380 },
      content: `<div style="padding:8px;"><div class="atk-dlg-row"><label>Сколько эскадрилий подготовить (1–${max}):</label><input id="prep-n" type="number" value="${max}" min="1" max="${max}"/></div><div class="atk-range-info" style="font-size:0.82em;">В стопке: ${qty}. Свободно к подготовке: ${free} (S ангаров ${cap}).</div></div>`,
      buttons: [
        { action: "ok", label: "Подготовить", default: true,
          callback: async (event, button) => { await apply(parseInt(button.form.querySelector("#prep-n").value) || 1); } },
        { action: "cancel", label: "Отмена" }
      ]
    });
  }

  // СХ носителя для эскадрилий: расход топлива у вылетевших, возврат перевооружённых.
  async _craftAdvanceTurn() {
    const craft = this.actor.items.filter(i => i.type === "smallCraft");
    const upd = []; const notes = []; const del = [];
    for (const i of craft) {
      const s = i.system; const fuel = CRAFT_FUEL[s.craftKind] || 4;
      if (s.state === "launched" || s.state === "returning") {
        const t = (Number(s.turnsOut) || 0) + 1;
        const u = { _id: i.id, "system.turnsOut": t };
        if (t >= fuel && s.state !== "returning") { u["system.state"] = "returning"; notes.push(`${i.name}: топливо исчерпано — обязательный возврат.`); }
        else if (t >= fuel) { notes.push(`${i.name}: возвращается (топливо ${t}/${fuel}).`); }
        upd.push(u);
      } else if (s.state === "rearming") {
        // Перевооружена → на борт. Сливаем в существующую stored-стопку того же типа/силы.
        const twin = craft.find(o => o.id !== i.id && o.name === i.name && o.system.state === "stored"
          && (o.system.strength || "full") === (s.strength || "full") && !del.includes(o.id));
        if (twin) {
          await twin.update({ "system.qty": (Number(twin.system.qty) || 1) + (Number(s.qty) || 1) });
          del.push(i.id);
          notes.push(`${i.name}: перевооружена и объединена на борту.`);
        } else {
          upd.push({ _id: i.id, "system.state": "stored", "system.turnsOut": 0 });
          notes.push(`${i.name}: перевооружена и готова на борту.`);
        }
      }
    }
    if (upd.length) await this.actor.updateEmbeddedDocuments("Item", upd);
    if (del.length) await this.actor.deleteEmbeddedDocuments("Item", del);
    await this._chat(`<div class="roll-header">${ICO.dice} СХ носителя — ${esc(this.actor.name)}</div>
      <div class="roll-threshold">Обновление эскадрилий: топливо вылетевших, возврат перевооружённых.</div>
      ${notes.length ? notes.map(n => `<div class="roll-threshold" style="font-size:0.82em;">• ${n}</div>`).join("") : `<div class="roll-outcome"><span class="roll-success">Нет активных эскадрилий.</span></div>`}`);
  }

  // ── Турели: защита от торпед / малых судов ──────────────────────────────────
  _showTurretDialog() {
    const tr = Number(this.actor.system.derived?.chars?.turretRating) || 0;
    return foundry.applications.api.DialogV2.wait({
      window: { title: "Турели — защита" },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
      position: { width: 400 },
      content: `<div class="wh-ship-fire" style="padding:6px;">
        <div class="atk-range-info" style="font-size:0.82em;">Бросок BS + 5×TR. Успех = 1 сбитие + 1 за каждые 2 доп. успеха. Каждое сбитие уничтожает 1 торпеду или 1 судно эскадрильи. Эскорт-истребители дают −10 к BS.</div>
        <div class="atk-dlg-row"><label>BS (CR корабля):</label><input id="tr-bs" type="number" value="30"/></div>
        <div class="atk-dlg-row"><label>Оснащённость турелями (TR):</label><input id="tr-tr" type="number" value="${tr}"/></div>
        <div class="atk-dlg-row"><label>Доп. модификатор (эскорт и т.п.):</label><input id="tr-mod" type="number" value="0"/></div>
        <div class="atk-dlg-row"><label>Входящих (торпед/судов):</label><input id="tr-in" type="number" value="1" min="1"/></div>
      </div>`,
      buttons: [{ action: "roll", label: "Огонь турелей!", default: true, callback: async (event, button) => {
        const v = id => parseInt(button.form.querySelector(id).value) || 0;
        const bs = v("#tr-bs"), trv = v("#tr-tr");
        const md = v("#tr-mod"), inc = v("#tr-in") || 1;
        const thr = bs + trv*5 + md;
        const r = await new Roll("1d100").evaluate();
        const dos = this._dos(r.total, thr);
        const kills = dos > 0 ? Math.min(inc, 1 + Math.floor((dos-1)/2)) : 0;
        await this._chat(`<div class="roll-header">${ICO.shield} Турели — ${esc(this.actor.name)}</div>
          <div class="roll-threshold">BS ${bs} + TR×5 ${trv*5}${md?` ${md>=0?"+":""}${md}`:""} → Порог <b>${thr}</b></div>
          <div class="roll-dice">${ICO.dice} 1d100: <b>${r.total}</b> (${dos} ст.)</div>
          <div class="roll-outcome">${kills>0?`<span class="roll-success">Сбито: <b>${kills}</b> из ${inc} — уменьшите залп/волну.</span>`:`<span class="roll-failure">Турели промахнулись.</span>`}</div>`, [r]);
      } }, { action: "cancel", label: "Отмена" }]
    });
  }

  // ── Запуск бомбардировщиков / штурмовых лодок ───────────────────────────────
  _showCraftAttack(kind, craft = null) {
    const isBomber = kind === "bomber";
    const cCR = craft ? (Number(craft.system.cr) || 0) : 5;
    const cQty = craft ? Math.max(1, Number(craft.system.qty) || 1) : 1;
    const tgt = [...(game.user?.targets ?? [])].map(t => t.actor ?? t.document?.actor).find(a => a?.type === "ship" && a.id !== this.actor.id);
    const tgtArm = tgt ? (Number(tgt.system.derived?.chars?.armour) || 0) : 0;
    return foundry.applications.api.DialogV2.wait({
      window: { title: isBomber ? "Запуск бомбардировщиков" : "Запуск штурмовых лодок" },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
      position: { width: 430 },
      content: `<div class="wh-ship-fire" style="padding:6px;">
        <div class="atk-range-info" style="font-size:0.82em;">${tgt?`Цель: <b>${esc(tgt.name)}</b> (мин. броня ${tgtArm}).`:"Отметьте (target) цель."} ${isBomber?"Тест Command + CR. Каждый успех — попадание (макс. 2 + 1×эскадрилья), 1d10+4 урона, щиты не спасают, 4+ усп. — крит.":"Тест Command(F) + CR. Каждый успех — 1 лодка (макс. 6) пробила корпус; 5+ усп. — крит; +10 к Ударил-отступил за каждую лодку."}</div>
        <div class="atk-dlg-row"><label>Command ведущего:</label><input id="cf-cmd" type="number" value="40"/></div>
        <div class="atk-dlg-row"><label>CR судна:</label><input id="cf-cr" type="number" value="${cCR}"/></div>
        <div class="atk-dlg-row"><label>Эскадрилий (крыло):</label><input id="cf-sq" type="number" value="${cQty}" min="1"/></div>
        <div class="atk-dlg-row"><label>Доп. мод (эскорт −турели и т.п.):</label><input id="cf-mod" type="number" value="0"/></div>
        ${isBomber?`<div class="atk-dlg-row"><label>Мин. броня цели:</label><input id="cf-arm" type="number" value="${tgtArm}" min="0"/></div>`:""}
      </div>`,
      buttons: [{ action: "roll", label: isBomber?"Заход!":"Абордажный заход!", default: true, callback: async (event, button) => {
        const v = id => parseInt(button.form.querySelector(id)?.value) || 0;
        const cmd = v("#cf-cmd"), cr = v("#cf-cr");
        const sq = v("#cf-sq") || 1, md = v("#cf-mod");
        const arm = v("#cf-arm");   // строки брони нет у штурмовых лодок
        const wing = (sq-1)*5;   // +5 за каждую доп. эскадрилью (крыло)
        const thr = cmd + cr + md + wing;
        const r = await new Roll("1d100").evaluate();
        const dos = this._dos(r.total, thr); const rolls = [r];
        let body;
        if (dos <= 0) { body = `<div class="roll-outcome"><span class="roll-failure">Заход провален.</span></div>`; }
        else if (isBomber) {
          const maxHits = 2 + sq;
          const hits = Math.min(dos, maxHits);
          let sum = 0, parts = [];
          for (let i=0;i<hits;i++){ const dr = await new Roll("1d10+4").evaluate(); rolls.push(dr); sum += dr.total; parts.push(dr.total); }
          const dmg = Math.max(0, sum - arm);
          const crit = dos >= 4;
          body = `<div class="roll-outcome"><span class="roll-success">Попаданий: <b>${hits}</b> (макс ${maxHits})${crit?` — <b>КРИТ</b>`:""}</span></div>
            <div class="roll-damage-section"><div class="roll-damage-label">${ICO.dmg} Урон Прочности: <b>${dmg}</b> [${parts.join("+")}] − броня ${arm} (щиты не спасают)</div>
            <button class="wh-ship-dmg-btn" type="button" data-hi="${dmg}">${ICO.dmg} Применить ${dmg} → отмеченной цели</button></div>
            ${crit?`<div class="roll-threshold" style="font-size:0.82em;">4+ успеха — бросьте Крит. таблицу.</div>`:""}`;
        } else {
          const boats = Math.min(dos, 6);
          const crit = dos >= 5;
          body = `<div class="roll-outcome"><span class="roll-success">Лодок пробило корпус: <b>${boats}</b> (макс 6)${crit?` — <b>КРИТ</b>`:""}</span></div>
            <div class="roll-threshold" style="font-size:0.85em;">Ведущий абордажа начинает Ударил-отступил (без теста Operate), бонус <b>+${boats*10}</b> (+10 за лодку).</div>`;
        }
        await this._chat(`<div class="roll-header">${isBomber?ICO.dmg:ICO.hit} ${isBomber?"Бомбардировщики":"Штурмовые лодки"} — ${esc(this.actor.name)}${tgt?` → ${esc(tgt.name)}`:""}</div>
          <div class="roll-threshold">Command ${cmd} + CR ${cr}${wing?` + крыло ${wing}`:""}${md?` ${md>=0?"+":""}${md}`:""} → Порог <b>${thr}</b> (цель защищается турелями!)</div>
          <div class="roll-dice">${ICO.dice} 1d100: <b>${r.total}</b> (${dos} ст.)</div>${body}`, rolls);
      } }, { action: "cancel", label: "Отмена" }]
    });
  }

  // ── Бой истребителей (встречный) ────────────────────────────────────────────
  _showFighterDialog(craft = null) {
    const cCR = craft ? (Number(craft.system.cr) || 0) : 5;
    return foundry.applications.api.DialogV2.wait({
      window: { title: "Бой истребителей" },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
      position: { width: 430 },
      content: `<div class="wh-ship-fire" style="padding:6px;">
        <div class="atk-range-info" style="font-size:0.82em;">Встречный Command + CR. +5 за присутствие бомб./штурм. эскадрилий и +5 за каждые 2 доп. За каждый чистый успех — 1 эскадрилья врага выведена из боя. Победа на 4+ успехов — без потерь у победителя.</div>
        <div class="atk-dlg-row"><label>Наши Command + CR:</label><input id="fg-mc" type="number" value="40"/> + <input id="fg-mcr" type="number" value="${cCR}" style="width:50px"/></div>
        <div class="atk-dlg-row"><label>Наш бонус эскадрилий:</label><input id="fg-mb" type="number" value="0"/></div>
        <div class="atk-dlg-row"><label>Враг Command + CR:</label><input id="fg-tc" type="number" value="40"/> + <input id="fg-tcr" type="number" value="5" style="width:50px"/></div>
        <div class="atk-dlg-row"><label>Бонус эскадрилий врага:</label><input id="fg-tb" type="number" value="0"/></div>
      </div>`,
      buttons: [{ action: "roll", label: "Схватка!", default: true, callback: async (event, button) => {
        const v = id => parseInt(button.form.querySelector(id).value) || 0;
        const myThr = v("#fg-mc")+v("#fg-mcr")+v("#fg-mb"), tgThr = v("#fg-tc")+v("#fg-tcr")+v("#fg-tb");
        const r1 = await new Roll("1d100").evaluate(), r2 = await new Roll("1d100").evaluate();
        const d1 = this._dos(r1.total, myThr), d2 = this._dos(r2.total, tgThr);
        const net = d1 - d2;
        const myLoss = (d2 - d1 >= 4) ? 0 : Math.max(0, d2 - d1);
        const tgLoss = (d1 - d2 >= 4) ? 0 : Math.max(0, d1 - d2);
        await this._chat(`<div class="roll-header">${ICO.hit} Бой истребителей — ${esc(this.actor.name)}</div>
          <div class="roll-threshold">Мы: порог ${myThr}, бросок <b>${r1.total}</b> (${d1} ст.)</div>
          <div class="roll-threshold">Враг: порог ${tgThr}, бросок <b>${r2.total}</b> (${d2} ст.)</div>
          <div class="roll-outcome">${net===0?`<span class="roll-failure">Ничья — можно продолжить в следующем СХ.</span>`:`<span class="roll-success">Перевес: <b>${net>0?esc(this.actor.name):"враг"}</b></span>`}</div>
          <div class="roll-threshold" style="font-size:0.85em;">Врагу выведено эскадрилий: <b>${tgLoss}</b>; нам: <b>${myLoss}</b>. (Победа на 4+ — без потерь у победителя.)</div>`, [r1, r2]);
      } }, { action: "cancel", label: "Отмена" }]
    });
  }

  // ── Залп макробатарей (объединённый огонь) ──────────────────────────────────
  _showSalvoDialog() {
    const macros = this.actor.items.filter(i => i.type === "component" && i.system.kind === "weapon"
      && i.system.weapon?.wType === "macrobattery" && !i.system.damaged);
    if (macros.length < 2) return ui.notifications.info("Для залпа нужно ≥ 2 неповреждённых макробатарей.");

    let gunBS = 35, gunName = "";
    for (const o of (this.actor.system.officers || [])) {
      if (!o.uuid || !/канонир/i.test(o.title || "")) continue;
      let d = null; try { d = fromUuidSync(o.uuid); } catch (e) {}
      const a = d?.actor ?? d; const bs = a?.system?.characteristics?.bs?.total;
      if (bs != null) { gunBS = bs; gunName = a.name; if (/мастер/i.test(o.title)) break; }
    }
    const aimer = this.actor.system.derived?.aimer || 0;
    const tgt = [...(game.user?.targets ?? [])].map(t => t.actor ?? t.document?.actor).find(a => a?.type === "ship" && a.id !== this.actor.id);
    const tgtVS  = tgt ? (Number(tgt.system.derived?.chars?.voidShields) || 0) : 0;
    const tgtArm = tgt ? (Number(tgt.system.derived?.chars?.armour) || 0) : 0;

    const list = macros.map(m => {
      const w = m.system.weapon || {};
      const own = (m.system.shipProps || []).filter(p => p.key === "aimer").reduce((a, p) => a + (Number(p.rating) || 0), 0);
      return `<label class="salvo-row"><input type="checkbox" class="salvo-w" value="${m.id}" checked/> <b>${esc(m.name)}</b> — S ${w.strength || 0}, ${w.damage || "—"}, крит ${w.crit || 0}${own ? `, приц +${own}` : ""}</label>`;
    }).join("");

    const content = `<div class="wh-ship-fire" style="padding:6px;">
      <div class="atk-range-info" style="font-size:0.82em;">${tgt ? `Цель: <b>${esc(tgt.name)}</b> — щиты ${tgtVS}, броня ${tgtArm}.` : "Отметьте (target) корабль-цель."} Залп: макробатареи бьют одну цель, попадания и урон складываются, щиты гасят слабейшие попадания, броня вычитается из суммы, крит один на весь залп.</div>
      <div class="salvo-list">${list}</div>
      <div class="atk-dlg-row"><label>BS канонира${gunName ? ` (${gunName})` : ""}:</label><input id="sv-bs" type="number" value="${gunBS}"/></div>
      <div class="atk-dlg-row"><label>Прицел / Aimer (+):</label><input id="sv-aim" type="number" value="${aimer}"/></div>
      <div class="atk-dlg-row"><label>Дальность:</label><select id="sv-range"><option value="10">Ближе Rng/2 (+10)</option><option value="0" selected>В пределах Rng (0)</option><option value="-10">Дальше Rng (−10)</option></select></div>
      <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="sv-mod" type="number" value="0"/></div>
      <div class="atk-dlg-row"><label>Пустотные щиты цели:</label><input id="sv-vs" type="number" value="${tgtVS}" min="0"/></div>
      <div class="atk-dlg-row"><label>Броня цели:</label><input id="sv-arm" type="number" value="${tgtArm}" min="0"/></div>
    </div>`;

    return foundry.applications.api.DialogV2.wait({
      window: { title: "Залп макробатарей" },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
      position: { width: 440 },
      content,
      buttons: [
        { action: "fire", icon: "fas fa-bahai", label: "Залп!", default: true, callback: async (event, button) => {
          const form = button.form;
          const ids = [...form.querySelectorAll(".salvo-w:checked")].map(e => e.value);
          if (!ids.length) return ui.notifications.warn("Выберите орудия для залпа.");
          const v = id => parseInt(form.querySelector(id).value) || 0;
          await this._resolveSalvo(ids, {
            bs: v("#sv-bs"), aim: v("#sv-aim"), range: v("#sv-range"),
            mod: v("#sv-mod"), shields: v("#sv-vs"), armour: v("#sv-arm"), tgt
          });
        } },
        { action: "cancel", label: "Отмена" }
      ]
    });
  }

  async _resolveSalvo(ids, o) {
    const rollMode = game.settings.get("core", "rollMode");
    const allRolls = [];
    const cleanDmg = (raw) => { const m = String(raw || "").match(/\(?\d*\s*d\s*\d+\s*(?:[+\-]\s*\d+)?\)?\s*(?:[*x×]\s*\d+)?/i); return (m ? m[0] : raw || "1d10").replace(/\s+/g, "").replace(/[x×]/i, "*") || "1d10"; };
    const hits = []; let critEligible = false; const lines = [];
    for (const id of ids) {
      const it = this.actor.items.get(id); if (!it) continue;
      const w = it.system.weapon || {}; const S = Number(w.strength) || 1; const critN = Number(w.crit) || 0;
      const own = (it.system.shipProps || []).filter(p => p.key === "aimer").reduce((a, p) => a + (Number(p.rating) || 0), 0);
      const thr = o.bs + o.aim + o.range + o.mod + own;
      const roll = await new Roll("1d100").evaluate(); allRolls.push(roll);
      if (roll.total > thr) { lines.push(`<div class="roll-threshold" style="font-size:0.82em;opacity:.8;">${esc(it.name)}: ${roll.total} > ${thr} — промах</div>`); continue; }
      const deg = Math.floor((thr - roll.total) / 10) + 1;
      const wHits = Math.min(deg, S);
      if (critN && deg >= critN) critEligible = true;
      const dmgF = cleanDmg(w.damage); const wDmgs = [];
      for (let i = 0; i < wHits; i++) { let dr; try { dr = await new Roll(dmgF).evaluate(); } catch (e) { dr = await new Roll("1d10").evaluate(); } allRolls.push(dr); wDmgs.push(dr.total); hits.push(dr.total); }
      lines.push(`<div class="roll-threshold" style="font-size:0.82em;">${esc(it.name)}: ${deg} ст. → ${wHits} поп. [${wDmgs.join("+")}]${(critN && deg >= critN) ? ` <b>крит!</b>` : ""}</div>`);
    }
    hits.sort((a, b) => a - b);
    const shieldsUsed = Math.min(o.shields, hits.length);
    const passed = hits.slice(shieldsUsed);
    const sumDmg = passed.reduce((a, b) => a + b, 0);
    let totalHI = Math.max(0, sumDmg - o.armour);
    let critSection = "";
    if (critEligible) {
      const cr = await new Roll("1d5").evaluate(); allRolls.push(cr);
      const ce = getShipCrit(cr.total);
      if (totalHI === 0) totalHI = 1;
      critSection = `<div class="roll-damage-section"><div class="roll-damage-label">${ICO.crit} КРИТ! 1d5 = <b>${cr.total}</b> — ${esc(ce?.name)}</div><div class="roll-distort-desc">${ce?.text || ""}</div></div>`;
    }
    const overloaded = o.shields > 0 && hits.length >= o.shields;
    const vsNote = overloaded ? `<div class="roll-threshold" style="font-size:0.82em;color:#c07000;">Щиты перегружены (${hits.length} ≥ ${o.shields}) — схлопнулись.${o.tgt ? ` <button class="wh-ship-vs-btn" type="button">Отметить щиты цели схлопнутыми</button>` : ""}</div>` : "";
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${ICO.crit} Залп макробатарей — ${esc(this.actor.name)}${o.tgt ? ` → ${esc(o.tgt.name)}` : ""}</div>
        <div class="roll-threshold">BS ${o.bs}${o.aim ? ` +${o.aim} приц.` : ""}${o.range ? ` ${o.range > 0 ? "+" : ""}${o.range} дальн.` : ""}${o.mod ? ` ${o.mod > 0 ? "+" : ""}${o.mod}` : ""}</div>
        ${lines.join("")}
        <div class="roll-threshold">Всего попаданий: <b>${hits.length}</b>${shieldsUsed ? ` ${ICO.shield} −щиты ${shieldsUsed} = <b>${passed.length}</b>` : ""} · броня −${o.armour}</div>
        <div class="roll-damage-section">
          <div class="roll-damage-label">${ICO.dmg} Урон Прочности: <b>${totalHI}</b></div>
          ${(totalHI > 0 || critEligible) ? `<button class="wh-ship-dmg-btn" type="button" data-hi="${totalHI}">${ICO.dmg} Применить ${totalHI} → отмеченной цели</button>` : ""}
        </div>
        ${critSection}${vsNote}
      </div>`,
      rolls: allRolls, sound: CONFIG.sounds.dice
    }, rollMode));
  }

  // ── Таран ──────────────────────────────────────────────────────────────────
  _showRamDialog() {
    const der = this.actor.system.derived || {};
    const mn  = Number(der.chars?.manoeuvrability) || 0;
    const tgt = [...(game.user?.targets ?? [])].map(t => t.actor ?? t.document?.actor).find(a => a?.type === "ship" && a.id !== this.actor.id);
    const tgtArm = tgt ? (Number(tgt.system.derived?.chars?.armour) || 0) : 0;
    const RAM_DICE = { transport: "1d5", raider: "1d5", frigate: "1d10", lightCruiser: "2d5" };
    const dice = RAM_DICE[this.actor.system.shipType] || "2d10";
    const prowArm = Number(der.chars?.armour) || 0;

    return foundry.applications.api.DialogV2.wait({
      window: { title: "Таран" },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
      position: { width: 400 },
      content: `<div class="wh-ship-fire" style="padding:6px;">
        <div class="atk-range-info" style="font-size:0.82em;">${tgt ? `Цель: <b>${esc(tgt.name)}</b> (броня ${tgtArm}).` : "Отметьте (target) корабль-цель."} Урон тарана: ${dice} + Лоб. броня ${prowArm} (щиты не спасают). Таранящий получает 1d5 + броня цели (сквозь щиты).</div>
        <div class="atk-dlg-row"><label>Operate (Voidship) рулевого:</label><input id="rm-op" type="number" value="35"/></div>
        <div class="atk-dlg-row"><label>Манёвренность (MN):</label><input id="rm-mn" type="number" value="${mn}"/></div>
        <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="rm-mod" type="number" value="0"/></div>
      </div>`,
      buttons: [
        { action: "ram", icon: "fas fa-crosshairs", label: "Таранить!", default: true,
          callback: async (event, button) => {
            const v = id => parseInt(button.form.querySelector(id).value) || 0;
            await this._resolveRam(v("#rm-op"), v("#rm-mn"), v("#rm-mod"), dice, prowArm, tgt, tgtArm);
          } },
        { action: "cancel", label: "Отмена" }
      ]
    });
  }

  async _resolveRam(op, mn, mod, dice, prowArm, tgt, tgtArm) {
    const threshold = op + mn - 20 + mod;
    const roll = await (new Roll("1d100")).evaluate();
    const hit  = roll.total <= threshold;
    const rollMode = game.settings.get("core", "rollMode");
    const allRolls = [roll];
    let body = "";
    if (!hit) {
      body = `<div class="roll-outcome"><span class="roll-failure">Промах — таран не удался.</span></div>`;
    } else {
      const dmgR = await (new Roll(dice)).evaluate(); allRolls.push(dmgR);
      const selfR = await (new Roll("1d5")).evaluate(); allRolls.push(selfR);
      const ramDmg  = dmgR.total + prowArm;                 // цели (сквозь щиты)
      const selfDmg = selfR.total + tgtArm;                 // таранящему (сквозь щиты)
      // Урон таранящему применяем сразу к себе (+ CP/CM по общим правилам).
      const cur = Number(this.actor.system.hullIntegrity?.value) || 0;
      const next = Math.max(0, cur - selfDmg); const lost = cur - next;
      const cp = Number(this.actor.system.crew?.population) || 0, cm = Number(this.actor.system.crew?.morale) || 0;
      await this.actor.update({ "system.hullIntegrity.value": next, "system.crew.population": Math.max(0, cp - lost), "system.crew.morale": Math.max(0, cm - lost) });
      body = `
        <div class="roll-outcome"><span class="roll-success">${ICO.hit} Таран удался!</span></div>
        <div class="roll-damage-section">
          <div class="roll-damage-label">${ICO.dmg} Урон цели: <b>${ramDmg}</b> (${dice} ${dmgR.total} + броня ${prowArm}, щиты не спасают)</div>
          <button class="wh-ship-dmg-btn" type="button" data-hi="${ramDmg}">${ICO.dmg} Применить ${ramDmg} → отмеченной цели</button>
        </div>
        <div class="roll-threshold" style="font-size:0.85em;">Таранящий получил <b>${selfDmg}</b> Прочности (1d5 ${selfR.total} + броня цели ${tgtArm}): ${cur} → ${next}${lost ? `, экипаж −${lost} CP/CM` : ""}.</div>`;
    }
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">Таран — ${esc(this.actor.name)}${tgt ? ` → ${esc(tgt.name)}` : ""}</div>
        <div class="roll-threshold">Operate+MN−20: <b>${op}</b> +${mn} −20${mod ? ` ${mod>=0?"+":""}${mod}` : ""} → Порог <b>${threshold}</b></div>
        <div class="roll-dice">${ICO.dice} 1d100: <b>${roll.total}</b></div>
        ${body}</div>`,
      rolls: allRolls, sound: CONFIG.sounds.dice
    }, rollMode));
  }

  // ── Абордаж ────────────────────────────────────────────────────────────────
  _showBoardingDialog() {
    const my = this.actor.system, myDer = this.actor.system.derived || {};
    const tgt = [...(game.user?.targets ?? [])].map(t => t.actor ?? t.document?.actor).find(a => a?.type === "ship" && a.id !== this.actor.id);
    const tDer = tgt?.system.derived || {};
    const g = (o, p, d = 0) => Number(foundry.utils.getProperty(o, p)) || d;
    return foundry.applications.api.DialogV2.wait({
      window: { title: "Абордаж — встречный Command" },
      classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
      position: { width: 420 },
      content: `<div class="wh-ship-fire" style="padding:6px;">
        <div class="atk-range-info" style="font-size:0.82em;">Сначала сцепка: Operate(Voidship)+MN−20. Затем встречный Command. Модификаторы: защитник +10×TR; +10 за каждые 10 разницы CP; +10 за каждые 10 разницы Прочности; разница CR — бонус большему. За каждый чистый успех: −1d5 CP и −1d5 CM ИЛИ −1 Прочности проигравшему.</div>
        <div class="atk-dlg-row"><label>Мой Command:</label><input id="bd-mc" type="number" value="40"/></div>
        <div class="atk-dlg-row"><label>Command цели:</label><input id="bd-tc" type="number" value="40"/></div>
        <div class="atk-dlg-row"><label>Мой CP / Прочность / TR:</label><input id="bd-mcp" type="number" value="${g(my,'crew.population')}" style="width:60px"/> <input id="bd-mhi" type="number" value="${g(my,'hullIntegrity.value')}" style="width:60px"/> <input id="bd-mtr" type="number" value="${g(myDer,'chars.turretRating')}" style="width:50px"/></div>
        <div class="atk-dlg-row"><label>CP / Прочн. / TR цели:</label><input id="bd-tcp" type="number" value="${tgt ? g(tgt.system,'crew.population') : 0}" style="width:60px"/> <input id="bd-thi" type="number" value="${tgt ? g(tgt.system,'hullIntegrity.value') : 0}" style="width:60px"/> <input id="bd-ttr" type="number" value="${tgt ? g(tDer,'chars.turretRating') : 0}" style="width:50px"/></div>
      </div>`,
      buttons: [
        { action: "board", icon: "fas fa-users", label: "Абордаж!", default: true,
          callback: async (event, button) => {
            const v = id => parseInt(button.form.querySelector(id).value) || 0;
            await this._resolveBoarding({
              mc: v("#bd-mc"), tc: v("#bd-tc"), mcp: v("#bd-mcp"), tcp: v("#bd-tcp"),
              mhi: v("#bd-mhi"), thi: v("#bd-thi"), mtr: v("#bd-mtr"), ttr: v("#bd-ttr"), tgt
            });
          } },
        { action: "cancel", label: "Отмена" }
      ]
    });
  }

  async _resolveBoarding(o) {
    // Бонусы: TR (обеим сторонам как их турели), разница CP/HI даёт +10/10 большему.
    const cpDiff = Math.floor(Math.abs(o.mcp - o.tcp) / 10) * 10;
    const hiDiff = Math.floor(Math.abs(o.mhi - o.thi) / 10) * 10;
    const myMod = (o.mcp >= o.tcp ? cpDiff : 0) + (o.mhi >= o.thi ? hiDiff : 0) + o.mtr * 10;
    const tgMod = (o.tcp >  o.mcp ? cpDiff : 0) + (o.thi >  o.mhi ? hiDiff : 0) + o.ttr * 10;
    const myThr = o.mc + myMod, tgThr = o.tc + tgMod;
    const r1 = await (new Roll("1d100")).evaluate(), r2 = await (new Roll("1d100")).evaluate();
    const myDeg = Math.floor((myThr - r1.total) / 10) + (r1.total <= myThr ? 1 : 0);
    const tgDeg = Math.floor((tgThr - r2.total) / 10) + (r2.total <= tgThr ? 1 : 0);
    const net = myDeg - tgDeg;
    const winner = net > 0 ? this.actor.name : net < 0 ? (o.tgt?.name || "цель") : "ничья";
    const netAbs = Math.abs(net);
    const rollMode = game.settings.get("core", "rollMode");
    const loserIsTarget = net > 0;
    const applyBtn = (net !== 0 && o.tgt) ? `
        <div class="roll-damage-section">
          <div class="roll-damage-label">За каждый успех (${netAbs}): −1d5 CP и −1d5 CM ИЛИ −1 Прочности проигравшему.</div>
          ${loserIsTarget ? `<button class="wh-ship-dmg-btn" type="button" data-hi="${netAbs}">${ICO.dmg} Применить ${netAbs} Прочности → отмеченной цели</button>` : `<div class="roll-threshold" style="font-size:0.82em;">Проиграл ваш корабль — примените урон/потери к себе вручную.</div>`}
        </div>` : "";
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${ICO.hit} Абордаж — встречный Command</div>
        <div class="roll-threshold">Мы: <b>${o.mc}</b>${myMod?`+${myMod}`:""}→${myThr}, бросок <b>${r1.total}</b> (${myDeg} ст.)</div>
        <div class="roll-threshold">Цель: <b>${o.tc}</b>${tgMod?`+${tgMod}`:""}→${tgThr}, бросок <b>${r2.total}</b> (${tgDeg} ст.)</div>
        <div class="roll-outcome">${net===0?`<span class="roll-failure">Ничья — абордаж продолжается в следующем СХ.</span>`:`<span class="roll-success">Победил: <b>${winner}</b> — чистых успехов ${netAbs}.</span>`}</div>
        ${applyBtn}
        <div class="roll-threshold" style="font-size:0.8em;">Проигравший делает бросок CM: ≤ — держится (снова тест), провал — сдаётся.</div>
      </div>`,
      rolls: [r1, r2], sound: CONFIG.sounds.dice
    }, rollMode));
  }

  async _rollShipCrit() {
    const r = await (new Roll("1d5")).evaluate();
    const ce = getShipCrit(r.total);
    const rollMode = game.settings.get("core", "rollMode");
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result"><div class="roll-header">Критическое попадание (корабль)</div>
        <div class="roll-dice">1d5 = <b>${r.total}</b></div>
        <div class="roll-outcome"><span class="roll-success">${esc(ce?.name)}</span></div>
        <div class="roll-distort-desc">${ce?.text || ""}</div>
        <div class="roll-threshold" style="font-size:0.8em;">У полуразрушенного корабля эффект = пробившему броню урону (1–11).</div></div>`,
      rolls: [r], sound: CONFIG.sounds.dice
    }, rollMode));
  }
  /**
   * Выбор типа груза. Партия называется по типу и сразу получает базовую
   * редкость из таблицы — вручную ничего вписывать не нужно.
   */
  _showCargoPicker() {
    const groups = {};
    for (const c of CARGO_TYPES) (groups[c.group] ??= []).push(c);
    const cards = Object.entries(groups).map(([g, list]) => `
      <div class="cp-group"><div class="cp-group-name">${g}</div>
        <div class="cp-list">${list.map(c => `
          <button type="button" class="cp-item" data-key="${c.key}" title="${c.examples}">
            <span class="cp-item-name">${c.label}</span>
            <span class="cp-item-ex">${c.examples}</span>
            <span class="cp-item-r">R ${c.rarity}</span>
          </button>`).join("")}</div>
      </div>`).join("");

    return foundry.applications.api.DialogV2.wait({
      window: { title: "Взять груз на борт" },
      classes: ["warhammer-dbc", "wh-holo"],
      position: { width: 640, height: 560 },
      content: `<div class="wh-cargo-picker">
        <div class="cp-hint">Выберите тип груза. Партия получит имя типа и его базовую редкость —
        переименовать и уточнить («Вооружение (Стаб-дробовики)») можно на её листе.</div>
        ${cards}
      </div>`,
      buttons: [{ action: "close", label: "Закрыть", default: true }],
      render: (event, dialog) => {
        dialog.element.querySelectorAll(".cp-item").forEach(btn => btn.addEventListener("click", async ev => {
          const key = ev.currentTarget.dataset.key;
          const t   = getCargoType(key);
          if (!t) return;
          const [it] = await this.actor.createEmbeddedDocuments("Item", [{
            name: t.label, type: "cargo",
            system: {
              cargoType: key, lc: 1, quantity: 1, quality: "common",
              // Базовая редкость — середина диапазона типа; «Различное» даёт 0.
              rarity: (t.rMin != null) ? Math.round((t.rMin + t.rMax) / 2) : 0,
              baseRarity: t.rarity, description: t.examples
            }
          }]);
          dialog.close();
          it?.sheet.render(true);
        }));
      }
    });
  }

  /**
   * Броски событий по грузам (раздел «Грузы»): порча, воровство, повреждение
   * от попаданий и гибель пассажиров. Каждый бросок печатает в чат, сколько LC
   * или PC потеряно — списывает их ГМ вручную, чтобы выбрать конкретную партию.
   */
  async _rollCargoEvent(kind) {
    const sys = this.actor.system;
    const d   = sys.derived || {};
    const hasHold = this.actor.items.some(i => i.type === "component" && i.system.kind === "hold");
    let title, flavor, roll, lost = 0;

    if (kind === "spoil") {
      // Испорченное: тест Trade (Voidfarer) (I). Каждый провал — −1 качество у 1 LC.
      title  = "Груз: сохранность в пути";
      roll   = await new Roll("1d100").evaluate();
      flavor = `Тест <b>Trade (Voidfarer) (I)</b> — насколько грамотно крепили и хранили груз.
        Введите порог навыка: каждая степень провала снижает Качество 1 LC, критический провал —
        уничтожает партию. Груз в специализированных узлах не портится${hasHold ? " (на борту такие есть)" : ""}.`;
    } else if (kind === "theft") {
      title  = "Груз: воровство экипажа";
      roll   = await new Roll("1d100").evaluate();
      flavor = `Тест <b>CM, Inf или Command (F)</b>${hasHold ? ` с бонусом <b>+${CARGO_HOLD_BONUS}</b> за грузовые узлы` : ""}.
        Каждая степень провала — часть груза украдена. Полностью «уничтожить» партию воровство
        обычно не может, но последствия будут: недовольство заказчика, штраф к обмену или потеря Inf.`;
    } else if (kind === "damage") {
      // Повреждение узла или падение INT: 1d100, 51-100 губит груз.
      const th = CARGO_DAMAGE.nodeHit.threshold;
      roll  = await new Roll("1d100").evaluate();
      lost  = roll.total >= th ? 1 : 0;
      title = "Груз: повреждение от боя";
      flavor = `Порог <b>${th}+</b> (повреждение узла без External или падение INT).
        ${lost ? "<b>Часть груза уничтожена</b> — 1 LC случайной партии за каждую степень провала."
               : "Груз уцелел."}
        Груз в специализированных узлах гибнет только при критическом повреждении самого узла.`;
    } else if (kind === "crit") {
      const th = CARGO_DAMAGE.critEffect.threshold;
      roll  = await new Roll("1d100").evaluate();
      lost  = roll.total >= th ? 1 : 0;
      title = "Груз: критический эффект";
      flavor = `Порог <b>${th}+</b>. Критические эффекты 3, 4 и 7 этот тест не вызывают.
        ${lost ? "<b>Часть груза уничтожена</b> — 1 LC за каждую степень провала." : "Груз уцелел."}`;
    } else if (kind === "passengers") {
      const th = CARGO_DAMAGE.passengers.threshold;
      roll  = await new Roll("1d100").evaluate();
      lost  = roll.total >= th ? 1 : 0;
      title = "Пассажиры: потери при падении CP";
      flavor = `Порог <b>${th}+</b> при каждом падении CP.
        ${lost ? "<b>Пассажиры гибнут</b> — по 1 PC за каждую степень провала."
               : "Пассажиры уцелели."} На борту: ${d.pc?.aboard ?? 0} PC.`;
    } else return;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<b>${title}</b><br>${flavor}`
    }, { rollMode: game.settings.get("core", "rollMode") });
  }

  /** Пределы CP и CM: восстановление не поднимает показатели выше нормы. */
  _crewCaps() {
    const d = this.actor.system.derived || {};
    return {
      cmMax: (Number(this.actor.system.crew?.moraleMax) || 100) + (Number(d.moraleMaxBonus) || 0),
      cpMax: 100 + (Number(d.crewMaxBonus) || 0)
    };
  }

  /** Изменить CP/CM с обрезкой по пределам (0…max). */
  async _adjustCrew({ cp = 0, cm = 0 }) {
    const { cmMax, cpMax } = this._crewCaps();
    const c = this.actor.system.crew || {};
    const upd = {};
    if (cp) upd["system.crew.population"] = Math.max(0, Math.min(cpMax, (Number(c.population) || 0) + cp));
    if (cm) upd["system.crew.morale"]     = Math.max(0, Math.min(cmMax, (Number(c.morale) || 0) + cm));
    if (Object.keys(upd).length) await this.actor.update(upd);
  }

  /**
   * Восстановление экипажа (раздел «Восстановление»). kind: morale | population.
   * Каждый способ считает результат и сам правит показатель, не превышая предел.
   */
  _showCrewRecovery(kind) {
    const die  = moralePerInfluence(this.actor.system.shipType);
    const caps = this._crewCaps();
    const heavy = die === "1d5" ? " (крупный корабль — команда многочисленнее)" : "";

    const moraleForm = `
      <div class="cr-way">
        <div class="cr-way-h">Дары и траты Inf</div>
        <div class="cr-way-b">
          Потрачено Inf: <input id="cr-inf" type="number" value="1" min="1"/>
          — по <b>${die}</b> CM за единицу${heavy}.
          <button type="button" class="cr-go" data-way="inf">Раздать</button>
        </div>
      </div>
      <div class="cr-way">
        <div class="cr-way-h">Сплотить команду — раз за игровую встречу</div>
        <div class="cr-way-b">
          <select id="cr-rally-skill">
            <option value="Charm">Charm −10</option>
            <option value="Intimidation">Intimidation −10</option>
          </select>
          навык: <input id="cr-rally" type="number" value="40"/>
          — <b>+2 CM за степень успеха</b>.
          <button type="button" class="cr-go" data-way="rally">Бросок</button>
        </div>
      </div>
      <div class="cr-way">
        <div class="cr-way-h">Сойти на берег — CM до предела (${caps.cmMax})</div>
        <div class="cr-way-b">
          <select id="cr-shore">
            ${SHORE_LEAVE.map(x => `<option value="${x.key}">${x.label} — ${x.weeks} нед.</option>`).join("")}
          </select>
          <button type="button" class="cr-go" data-way="shore">Встать на якорь</button>
        </div>
      </div>`;

    const popForm = `
      <div class="cr-way">
        <div class="cr-way-h">Вербовка на населённой планете</div>
        <div class="cr-way-b">
          <select id="cr-place">
            ${CREW_RECRUIT.map(x => `<option value="${x.key}" data-avail="${x.avail}">${x.label} — доступность ${x.avail >= 0 ? "+" : ""}${x.avail}</option>`).join("")}
          </select>
          Inf: <input id="cr-recruit" type="number" value="40"/>
          <button type="button" class="cr-go" data-way="recruit">Тест реквизиции</button>
          <div class="cr-note">Успех — экипаж набран полностью (до ${caps.cpMax}). Провал — искать команду в другом месте.</div>
        </div>
      </div>
      <div class="cr-way">
        <div class="cr-way-h">Каторжники из местных тюрем</div>
        <div class="cr-way-b">
          Платить не нужно, но CM немедленно падает на <b>1d10+10</b> и не восстановится,
          пока корабль стоит у этой планеты.
          <button type="button" class="cr-go" data-way="convicts">Принять каторжников</button>
        </div>
      </div>
      <div class="cr-way">
        <div class="cr-way-h">Отряды вербовщиков</div>
        <div class="cr-way-b cr-note">
          Трущобы, подулей, лагеря рабов. Нужен тест Common Lore (Sump) или Forbidden Lore
          (Underworld), чтобы выйти на нужных людей, и Commerce — чтобы сговориться. Плата
          вербовщикам на финансах торговца не сказывается. Ведёт МИ вручную.
        </div>
      </div>`;

    return foundry.applications.api.DialogV2.wait({
      window: { title: kind === "morale" ? "Восстановление морали (CM)" : "Восстановление численности (CP)" },
      classes: ["warhammer-dbc", "wh-holo"],
      position: { width: 560 },
      content: `<div class="wh-crew-recovery">${kind === "morale" ? moraleForm : popForm}</div>`,
      buttons: [{ action: "close", label: "Закрыть", default: true }],
      render: (event, dialog) => {
        const form = dialog.element;
        form.querySelectorAll(".cr-go").forEach(b => b.addEventListener("click",
          ev => this._runRecovery(ev.currentTarget.dataset.way, form)));
      }
    });
  }

  /** Степени успеха: по десяткам разницы, как в основных правилах. */
  _dos(roll, target) {
    return roll <= target ? Math.max(1, Math.floor((target - roll) / 10) + 1) : 0;
  }

  async _runRecovery(way, form) {
    const caps = this._crewCaps();
    const say = (title, body, rolls = []) => ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result"><div class="roll-header">${title}</div>${body}</div>`,
      rolls, sound: rolls.length ? CONFIG.sounds.dice : null
    }, game.settings.get("core", "rollMode")));

    if (way === "inf") {
      const n = Math.max(1, parseInt(form.querySelector("#cr-inf").value) || 1);
      const die = moralePerInfluence(this.actor.system.shipType);
      const r = await new Roll(`${n}${die}`).evaluate();
      await this._adjustCrew({ cm: r.total });
      await say("Дары экипажу",
        `<div class="roll-dice">Потрачено Inf: <b>${n}</b> · ${n}${die} = <b>+${r.total}</b> CM</div>
         <div class="roll-threshold">Предел CM: ${caps.cmMax}.</div>`, [r]);

    } else if (way === "rally") {
      const sk = form.querySelector("#cr-rally-skill").value;
      const tv = (parseInt(form.querySelector("#cr-rally").value) || 0) - 10;
      const r  = await new Roll("1d100").evaluate();
      const dos = this._dos(r.total, tv);
      const gain = dos * 2;
      if (gain) await this._adjustCrew({ cm: gain });
      await say(`Сплотить команду — ${sk} −10`,
        `<div class="roll-dice">Порог <b>${tv}</b> · бросок <b>${r.total}</b></div>
         <div class="roll-outcome">${dos
            ? `<span class="roll-success">Успех, СУ ${dos} → <b>+${gain}</b> CM</span>`
            : `<span class="roll-failure">Провал</span>`}</div>
         <div class="roll-threshold">Применить можно лишь раз за игровую встречу.</div>`, [r]);

    } else if (way === "shore") {
      const x = SHORE_LEAVE.find(o => o.key === form.querySelector("#cr-shore").value);
      const cur = Number(this.actor.system.crew?.morale) || 0;
      await this._adjustCrew({ cm: caps.cmMax - cur });
      await say("Увольнение на берег",
        `<div class="roll-threshold">${x.label} — <b>${x.weeks} нед.</b> ${x.note}</div>
         <div class="roll-outcome"><span class="roll-success">CM восстановлена до предела: <b>${caps.cmMax}</b>.</span></div>`);

    } else if (way === "recruit") {
      const opt = form.querySelector("#cr-place").selectedOptions[0];
      const av  = parseInt(opt?.dataset.avail) || 0;
      const inf = parseInt(form.querySelector("#cr-recruit").value) || 0;
      const tv  = inf + av;
      const r   = await new Roll("1d100").evaluate();
      const ok  = r.total <= tv;
      if (ok) {
        const cur = Number(this.actor.system.crew?.population) || 0;
        await this._adjustCrew({ cp: caps.cpMax - cur });
      }
      await say("Вербовка экипажа",
        `<div class="roll-threshold">${opt.text()} · Inf ${inf} → порог <b>${tv}</b></div>
         <div class="roll-dice">Бросок: <b>${r.total}</b></div>
         <div class="roll-outcome">${ok
            ? `<span class="roll-success">Экипаж набран полностью — CP ${caps.cpMax}.</span>`
            : `<span class="roll-failure">Провал — искать команду придётся в другом месте.</span>`}</div>`, [r]);

    } else if (way === "convicts") {
      const cur = Number(this.actor.system.crew?.population) || 0;
      const r = await new Roll("1d10+10").evaluate();
      await this._adjustCrew({ cp: caps.cpMax - cur, cm: -r.total });
      await say("Каторжники на борту",
        `<div class="roll-outcome"><span class="roll-success">CP восстановлена до <b>${caps.cpMax}</b> бесплатно.</span></div>
         <div class="roll-dice">Мораль падает на <b>${r.total}</b> (1d10+10)</div>
         <div class="roll-threshold">Не восстановится, пока корабль стоит у этой планеты.</div>`, [r]);
    }
  }

  /**
   * Подавление бунта: встречный тест Command / Charm / Intimidation.
   * Победа персонажей стоит показателей, победа бунтовщиков на 4+ СУ означает,
   * что бунт удался и власть над кораблём потеряна.
   */
  _showMutinyQuell() {
    const ways = MUTINY_APPROACHES.map(a => `
      <label class="mq-way">
        <input type="radio" name="mq-way" value="${a.key}" ${a.key === "command" ? "checked" : ""}/>
        <span class="mq-way-h">${a.label}</span>
        <span class="mq-way-cost">цена успеха: ${a.cost}</span>
        <span class="mq-way-note">${a.note}</span>
      </label>`).join("");

    return foundry.applications.api.DialogV2.wait({
      window: { title: "Подавление бунта" },
      classes: ["warhammer-dbc", "wh-holo"],
      position: { width: 540 },
      content: `<div class="wh-mutiny-quell">
        <div class="mq-row">Навык персонажа: <input id="mq-skill" type="number" value="40"/>
          · Навык бунтовщиков: <input id="mq-rebels" type="number" value="30"/></div>
        ${ways}
        <div class="mq-note">Побеждают бунтовщики — можно пробовать снова. Но если они выиграют
          встречный тест на <b>${MUTINY_WIN_DOS}+ степеней успеха</b>, бунт удался: власть над
          кораблём потеряна.</div>
      </div>`,
      buttons: [
        { action: "roll", label: "Встречный тест", default: true,
          callback: (event, button) => this._rollMutinyQuell(button.form) },
        { action: "cancel", label: "Отмена" }
      ]
    });
  }

  async _rollMutinyQuell(form) {
    const key = form.querySelector("input[name=mq-way]:checked")?.value || "command";
    const a   = MUTINY_APPROACHES.find(x => x.key === key);
    const tv  = parseInt(form.querySelector("#mq-skill").value) || 0;
    const rv  = parseInt(form.querySelector("#mq-rebels").value) || 0;

    const rp = await new Roll("1d100").evaluate();
    const rr = await new Roll("1d100").evaluate();
    const dp = this._dos(rp.total, tv), dr = this._dos(rr.total, rv);
    const win = dp > dr;
    const crushed = !win && (dr - dp) >= MUTINY_WIN_DOS;

    let outcome, applied;
    if (win) {
      const cm = a.cmLoss ? (await new Roll(a.cmLoss).evaluate()).total : 0;
      const cp = a.cpLoss ? (await new Roll(a.cpLoss).evaluate()).total : 0;
      await this._adjustCrew({ cm: -cm, cp: -cp });
      outcome = `<span class="roll-success">Бунт подавлен.</span>`;
      applied = `Потери: ${cp ? `CP −<b>${cp}</b>, ` : ""}CM −<b>${cm}</b>.`;
    } else if (crushed) {
      outcome = `<span class="roll-failure">БУНТ УДАЛСЯ — перевес ${dr - dp} СУ.</span>`;
      applied = `Власть над кораблём потеряна. Персонажам стоит бежать, пока бывшие подчинённые их не убили.`;
    } else {
      outcome = `<span class="roll-failure">Бунтовщики взяли верх в этом столкновении.</span>`;
      applied = `Можно предпринять ещё один встречный тест.`;
    }

    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">Подавление бунта — ${a.skill}</div>
        <div class="roll-threshold">${a.label}</div>
        <div class="roll-dice">Персонаж: ${rp.total} против ${tv} — СУ <b>${dp}</b></div>
        <div class="roll-dice">Бунтовщики: ${rr.total} против ${rv} — СУ <b>${dr}</b></div>
        <div class="roll-outcome">${outcome}</div>
        <div class="roll-threshold">${applied}</div></div>`,
      rolls: [rp, rr], sound: CONFIG.sounds.dice
    }, game.settings.get("core", "rollMode")));
  }

}
