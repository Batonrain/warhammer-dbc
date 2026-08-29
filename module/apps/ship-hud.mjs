// ─────────────────────────────────────────────────────────────────────────────
//  HUD КОРАБЛЯ — нижняя панель для акторов типа "ship".
//  Живёт в том же контейнере, что и обычный боевой HUD (module/apps/hud.mjs):
//  тот при выборе корабля отдаёт отрисовку сюда. Панель показывает состояние
//  судна и даёт стрелять/таранить/идти на абордаж, не открывая лист.
// ─────────────────────────────────────────────────────────────────────────────

import { SHIP_WEAPON_ARCS, WC_ORDER, crewActiveRows, CREW_POP_TABLE, CREW_MORALE_TABLE }
  from "../constants/ship.mjs";
import { effectiveWeapon } from "../constants/ship-quality.mjs";

const SYSTEM = "warhammer-dbc";
export const SHIP_TPL = `systems/${SYSTEM}/templates/apps/ship-hud.hbs`;

/** Цвет полосы по доле оставшегося: зелёный → янтарь → красный. */
function barColor(pct) {
  if (pct > 66) return "#4dffa6";
  if (pct > 33) return "#ffc14d";
  return "#ff6b6b";
}

const pct = (v, max) => (max > 0 ? Math.max(0, Math.min(100, Math.round((v / max) * 100))) : 0);

/**
 * Данные панели корабля. Всё считается из system.derived, который готовит
 * _prepareShipData — здесь только раскладка под шаблон.
 */
export function shipHudData(actor) {
  const sys = actor.system;
  const d   = sys.derived || {};

  const hiMax  = Number(d.hullIntegrityMax) || 0;
  const hiVal  = Number(sys.hullIntegrity?.value) || 0;
  const hiPct  = pct(hiVal, hiMax);

  // Пустотные щиты — «лампочками»: сколько слоёв держится сейчас.
  const vsBase = Number(d.voidShieldsBase) || 0;
  const vsNow  = Number(d.chars?.voidShields) || 0;
  const shields = [];
  for (let i = 0; i < vsBase; i++) shields.push({ on: i < vsNow });

  // Орудия одним рядом: дуга — короткой меткой на самой кнопке. Колонками по
  // дугам панель не помещалась в ширину и давила кнопки до нечитаемых обрубков.
  const arcAbbr = (label) => (String(label || "").match(/\(([^)]+)\)/)?.[1]) || label || "—";
  const gunView = (w, arcKey) => {
    const wp = effectiveWeapon(w.system);
    const down = !!w.system.damaged || (w.system.status && w.system.status !== "intact");
    const full = arcKey ? SHIP_WEAPON_ARCS[arcKey] : "Дуга не назначена";
    return {
      id: w.id, name: w.name, down,
      arcKey, arcLabel: full, arcAbbr: arcKey ? arcAbbr(full) : "—",
      unassigned: !arcKey,
      wType: wp.wType || "", strength: wp.strength || 0,
      damage: wp.wType === "torpedo" ? "торпеды" : (wp.damage || "—"),
      crit: wp.crit || 0, range: wp.range || 0
    };
  };
  const weapons = actor.items.filter(i => i.type === "component" && i.system.kind === "weapon");
  const guns = [];
  for (const key of WC_ORDER)
    for (const w of weapons.filter(x => x.system.weapon?.arc === key)) guns.push(gunView(w, key));
  // Орудия без назначенной дуги — в конец, иначе они пропали бы из панели.
  for (const w of weapons.filter(x => !WC_ORDER.includes(x.system.weapon?.arc))) guns.push(gunView(w, ""));

  // Сводка по дугам для кнопки: «Н 1 · ЛБ 2 · ПБ 2» — состав борта виден,
  // не открывая панель.
  const arcSummary = [];
  for (const g of guns) {
    const row = arcSummary.find(a => a.key === g.arcKey);
    if (row) { row.n++; if (g.down) row.down++; }
    else arcSummary.push({ key: g.arcKey, abbr: g.arcAbbr, label: g.arcLabel, n: 1, down: g.down ? 1 : 0, loose: g.unassigned });
  }
  // Группы для самой панели.
  const gunGroups = arcSummary.map(a => ({ ...a, weapons: guns.filter(g => g.arcKey === a.key) }));
  const gunsDown = guns.filter(g => g.down).length;

  const cp = Number(sys.crew?.population) || 0;
  const cm = Number(sys.crew?.morale) || 0;
  const cmMax = (Number(sys.crew?.moraleMax) || 100) + (Number(d.moraleMaxBonus) || 0);

  // Активные пороговые штрафы экипажа — те же таблицы, что на вкладке «Экипаж».
  const popRows    = crewActiveRows(CREW_POP_TABLE, cp);
  const moraleRows = crewActiveRows(CREW_MORALE_TABLE, cm);

  return {
    ship: true,
    id: actor.id, name: actor.name, img: actor.img,
    isOwner: actor.isOwner,
    hi: { value: hiVal, max: hiMax, pct: hiPct, color: barColor(hiPct), crippled: hiVal <= 0 },
    shields, vsNow, vsBase, vsDown: !!d.voidShieldsDown,
    chars: d.chars || {},
    turnArc: d.turnArc || "—",
    crew: {
      cp, cm, cmMax, cpPct: pct(cp, 100), cmPct: pct(cm, cmMax),
      cpColor: barColor(pct(cp, 100)), cmColor: barColor(pct(cm, cmMax)),
      rating: sys.crew?.rating || "",
      penalties: [...popRows, ...moraleRows].map(r => r.fx).filter(Boolean),
      mutiny: [...popRows, ...moraleRows].some(r => r.mutiny)
    },
    guns, arcSummary, gunGroups, gunsDown,
    supplies: d.supplies || null,
    lc: d.lc || null,
    defilement: { value: Number(sys.defilement) || 0, isDaemon: !!d.defilement?.isDaemon },
    overBudget: !!d.overBudget,
    // Итоговые модификаторы потерь — капитану полезно видеть до боя.
    crewMods: d.crewMods || null
  };
}

// Слушатели закрытия панели орудий живут на document, поэтому храним их здесь
// и снимаем перед каждой новой отрисовкой.
let _gunPanelListeners = null;
function _dropGunPanelListeners() {
  if (!_gunPanelListeners) return;
  document.removeEventListener("click", _gunPanelListeners.away);
  document.removeEventListener("keydown", _gunPanelListeners.esc);
  _gunPanelListeners = null;
}

/**
 * Обработчики панели корабля. Диалоги боя живут на листе — дёргаем их методы
 * напрямую, лист при этом открывать не нужно.
 */
export function wireShipHud(el, actor) {
  _dropGunPanelListeners();
  if (!actor) return;
  const sheet = actor.sheet;
  const own   = actor.isOwner;

  el.querySelector("[data-ship-open]")?.addEventListener("click", () => actor.sheet.render(true));

  // Стрельба из конкретного орудия.
  for (const b of el.querySelectorAll("[data-fire-id]")) {
    b.addEventListener("click", () => {
      if (!own) return;
      const it = actor.items.get(b.dataset.fireId);
      el.querySelector(".wh-ship-gunpanel")?.classList.remove("open");
      if (it) sheet._showFireDialog(it);
    });
  }

  // Панель орудий: в полосе HUD им не хватает ширины, поэтому список живёт в
  // раскрывающейся панели над ней.
  const panel  = el.querySelector(".wh-ship-gunpanel");
  const toggle = el.querySelector("[data-guns-toggle]");
  if (panel && toggle) {
    const setOpen = (on) => {
      panel.classList.toggle("open", on);
      toggle.classList.toggle("on", on);
    };
    toggle.addEventListener("click", ev => { ev.stopPropagation(); setOpen(!panel.classList.contains("open")); });
    // Закрытие по клику мимо и по Esc — панель перекрывает карту.
    // HUD перерисовывается на каждое изменение актора, поэтому слушателей на
    // document надо снимать — иначе они копятся с каждой перерисовкой.
    _dropGunPanelListeners();
    const away = (ev) => { if (!panel.contains(ev.target) && ev.target !== toggle) setOpen(false); };
    const esc  = (ev) => { if (ev.key === "Escape") setOpen(false); };
    document.addEventListener("click", away);
    document.addEventListener("keydown", esc);
    _gunPanelListeners = { away, esc };
  }

  // Манёвры и общие броски боя.
  const act = {
    salvo:  () => sheet._showSalvoDialog(),
    ram:    () => sheet._showRamDialog(),
    board:  () => sheet._showBoardingDialog(),
    turret: () => sheet._showTurretDialog(),
    crit:   () => sheet._rollShipCrit()
  };
  for (const b of el.querySelectorAll("[data-ship-act]")) {
    b.addEventListener("click", () => { if (own) act[b.dataset.shipAct]?.(); });
  }

  // Щиты схлопнулись / восстановлены — переключатель прямо на панели.
  el.querySelector("[data-ship-shields]")?.addEventListener("click", () => {
    if (own) actor.update({ "system.voidShieldsDown": !actor.system.voidShieldsDown });
  });

  // Прочность корпуса: колесо мыши по полосе меняет значение на 1.
  const hiBar = el.querySelector("[data-ship-hi]");
  hiBar?.addEventListener("wheel", ev => {
    if (!own) return;
    ev.preventDefault();
    const max = Number(actor.system.derived?.hullIntegrityMax) || 0;
    const now = Number(actor.system.hullIntegrity?.value) || 0;
    const next = Math.max(0, Math.min(max, now + (ev.deltaY < 0 ? 1 : -1)));
    if (next !== now) actor.update({ "system.hullIntegrity.value": next });
  }, { passive: false });
}
