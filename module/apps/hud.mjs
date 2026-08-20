// module/apps/hud.mjs
// Боевой HUD Warhammer DBC — панель внизу экрана в духе сталкерского HUD, но по
// механикам вахи. Не окно Foundry, а div поверх интерфейса.
//
// Показывает: игроку — своего персонажа, ГМу — выбранный токен (иначе своего).
// Так ГМ ведёт бой, щёлкая по токенам. Слева фигура брони + Раны, в центре
// активное оружие с кнопкой «Огонь» (прицеливание по клику), справа портрет.

import { woundStatus } from "../constants/body-map.mjs";
import { fateTerm } from "../helpers/utils.mjs";
import { beginTargeting } from "../combat/aim.mjs";
import { _reloadWeapon } from "../combat/reload.mjs";
import { _toggleShield } from "../combat/shield.mjs";
import { GRIPS, parseGrips } from "../constants/combat.mjs";
import { SHIP_TPL, shipHudData, wireShipHud } from "./ship-hud.mjs";

const SYSTEM = "warhammer-dbc";
const TPL = `systems/${SYSTEM}/templates/apps/hud.hbs`;
const EL_ID = "wh-hud";

// Типы психосил, требующие цели (перед манифестацией — перекрестие).
const PSY_TARGETED = new Set(["attack", "psychicShoot", "psychicBlade", "touch", "change", "duration", "indirect"]);

// Безоружные удары (стр. 40). Урон I(Cr), Pen 0, +S.b; в квадратных скобках —
// профиль Астартес (используется автоматически, если раса персонажа astartes).
// _showAttackDialogNoWeapon кидает урон и добавляет кнопку применения.
const UNARMED_STRIKES = {
  fist: { key: "fist", icon: "fa-hand-fist", label: "Удар кулаком", wsBonus: 0,
    damage: "1d5-3+S.b", damageAstartes: "1d10+S.b", damageType: "impact", pen: 0,
    props: "Primitive", chatNote: "" },
  kick: { key: "kick", icon: "fa-shoe-prints", label: "Пинок", wsBonus: 0,
    damage: "1d5-1+S.b", damageAstartes: "1d10+2+S.b", damageType: "impact", pen: 0,
    props: "Imprecise, Primitive", chatNote: "Досягаемость 2 м." },
  headbutt: { key: "headbutt", icon: "fa-user", label: "Удар головой", wsBonus: 0,
    damage: "1d5-4+S.b", damageAstartes: "1d10-1+S.b", damageType: "impact", pen: 0,
    props: "Cheap Shot, Imprecise, Primitive", chatNote: "" }
};

// Профиль удара стрелковым оружием в упор (импровизированная рукопашная, стр. 40):
// пистолет — как Булава (1d5−3), винтовка/ручное — как Посох (1d10−3), тяжёлое —
// как Булава (2d10−4). Всё I(Cr) +S.b, Pen 0, Imprecise + Primitive.
function gunMeleeStrike(weapon) {
  const cls = weapon.system?.weaponClass;
  const p = ({
    pistol:     { dmg: "1d5-3+S.b",  type: "Булава", reach: "1 м" },
    basic:      { dmg: "1d10-3+S.b", type: "Посох",  reach: "2–3 м" },
    heavy:      { dmg: "2d10-4+S.b", type: "Булава", reach: "2 м" },
    launcher:   { dmg: "2d10-4+S.b", type: "Булава", reach: "2 м" },
    stationary: { dmg: "2d10-4+S.b", type: "Булава", reach: "2 м" }
  })[cls] || { dmg: "1d10-3+S.b", type: "Посох", reach: "2–3 м" };
  return {
    label: weapon.name, headerSuffix: "удар оружием в упор",
    wsBonus: 0, damage: p.dmg, damageType: "impact", pen: 0,
    props: "Imprecise, Primitive",
    chatNote: `Импровизированное рукопашное — как ${p.type}, досягаемость ${p.reach}.`
  };
}

// Локации брони → PNG-маска фигуры (assets/body) и подпись.
const ARMOR_PARTS = [
  { key: "head",     part: "head",       label: "Голова",      abbr: "Гл" },
  { key: "body",     part: "body",       label: "Торс",        abbr: "Т"  },
  { key: "leftArm",  part: "left-arm",   label: "Левая рука",  abbr: "ЛР" },
  { key: "rightArm", part: "right-arm",  label: "Правая рука", abbr: "ПР" },
  { key: "leftLeg",  part: "left-leg",   label: "Левая нога",  abbr: "ЛН" },
  { key: "rightLeg", part: "right-leg",  label: "Правая нога", abbr: "ПН" }
];

/* ── Чей персонаж на панели ────────────────────────────────────────────── */

// Панель обслуживает и персонажей, и корабли: у корабля своя раскладка.
const HUD_TYPES = ["character", "ship"];

export function hudActor() {
  if (!game.user) return null;
  const mine = game.user.character;
  if (game.user.isGM) {
    const t = canvas?.tokens?.controlled?.[0]?.actor;
    if (HUD_TYPES.includes(t?.type)) return t;
    return HUD_TYPES.includes(mine?.type) ? mine : null;
  }
  // Выбранный игроком токен корабля важнее назначенного персонажа: капитан
  // управляет судном, оставаясь тем же персонажем.
  const t = canvas?.tokens?.controlled?.[0]?.actor;
  if (t?.type === "ship" && t.isOwner) return t;
  if (mine?.type === "character") return mine;
  const own = game.actors?.filter(a => HUD_TYPES.includes(a.type) && a.isOwner) ?? [];
  return own.length === 1 ? own[0] : null;
}

/* ── Активное оружие ───────────────────────────────────────────────────── */

function equippedWeapons(actor) {
  return actor.items.filter(i => i.type === "weapon" && i.system.equipped);
}

// Две руки: правая (основная) и левая (вторая). Хранятся во флагах hudMainHand /
// hudOffHand как id надетого оружия. Не заданы — правая берёт первое надетое,
// левая — следующее (чтобы связка «пистолет + меч» показывалась сразу).
function handWeaponIds(actor) {
  const eq = equippedWeapons(actor);
  const has = id => id && eq.some(w => w.id === id);
  const savedMain = actor?.getFlag(SYSTEM, "hudMainHand");
  const savedOff  = actor?.getFlag(SYSTEM, "hudOffHand");

  let mainId = has(savedMain) ? savedMain
             : (savedMain === undefined ? (eq[0]?.id ?? null) : null);

  let offId;
  if (savedOff !== undefined) offId = has(savedOff) ? savedOff : null;
  else offId = eq.find(w => w.id !== mainId)?.id ?? null;
  if (offId && offId === mainId) offId = null;   // один ствол — не в обе руки

  return { mainId, offId };
}

/* ── Цвета ─────────────────────────────────────────────────────────────── */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pctOf = (v, max) => clamp(Math.round((Number(v) || 0) / (Number(max) || 1) * 100), 0, 100);

// Броня по AP — зелёная шкала когитатора. Даже AP 0 виден (тусклый серо-зелёный),
// чтобы фигура не пропадала на тёмном фоне.
// Шкала под ПОГЛОЩЕНИЕ (AP + T.b), а не под голую броню: T.b сам по себе даёт
// 3-5, поэтому пороги подняты — иначе почти любой персонаж светился максимумом.
function armorColor(ap) {
  ap = Number(ap) || 0;
  if (ap <= 0)  return "#4a6b58";
  if (ap <= 4)  return "#3f9e6a";
  if (ap <= 8)  return "#57c98a";
  if (ap <= 12) return "#4dffa6";
  return "#a8ffd0";
}
const WOUND_COLOR = { healthy: "#4dffa6", wounded: "#e0c060", nearcrit: "#e0762a", critical: "#ff6b6b" };

/* ── Данные панели ─────────────────────────────────────────────────────── */

function hudData(actor) {
  const sys = actor.system ?? {};
  const ws  = woundStatus(sys);

  // ГОТОВОЕ ПОГЛОЩЕНИЕ (AP + T.b), а не «голая» броня: в бою вычитается именно
  // оно, поэтому считать T.b в уме на каждое попадание незачем. Рядом в подсказке
  // показываем разбор «броня + бонус Стойкости».
  const absorb  = sys.absorption || {};
  const armorOnly = absorb.armorOnly || sys.armor || {};
  const tb = Number(sys.characteristics?.t?.bonus) || 0;
  const armor = ARMOR_PARTS.map(p => {
    const apOnly = Number(armorOnly[p.key]) || 0;
    // absorption уже содержит AP + T.b; если его нет (старый актор) — считаем сами.
    const ap = Number(absorb[p.key] ?? (apOnly + tb)) || 0;
    return { ...p, ap, apOnly, tb, color: armorColor(ap) };
  });

  // Две руки: правая (основная) и левая (вторая).
  const { mainId, offId } = handWeaponIds(actor);
  const weaponView = (id, slotKey, label) => {
    const w = id ? actor.items.get(id) : null;
    if (!w) return { slot: slotKey, label, empty: true };
    const g = w.system ?? {};
    const melee = g.weaponClass === "melee";
    const ammo = g.loadedAmmoId ? actor.items.get(g.loadedAmmoId) : null;
    const rof = [g.rof_single ? "•" : null, g.rof_semi ? "≈" : null, g.rof_full ? "≡" : null]
      .filter(Boolean).join(" ");

    // Хват и профиль (стр. 39, 207-221) — выбираются кнопками в HUD, хранятся
    // во флагах оружия (hudGrip / hudProfile). Показываем ВСЕ доступные варианты.
    const gripKeys = melee ? parseGrips(g.grips) : [];
    let curGrip = w.getFlag(SYSTEM, "hudGrip");
    if (!GRIPS[curGrip] || !gripKeys.includes(curGrip)) curGrip = gripKeys[0] || "";
    const gripOpts = gripKeys.length > 1
      ? gripKeys.map(k => ({
          key: k, label: (GRIPS[k]?.label || k),
          short: k, note: GRIPS[k]?.note || "", active: k === curGrip
        }))
      : [];

    const profList = Array.isArray(g.profiles) ? g.profiles : [];
    let curProf = Number(w.getFlag(SYSTEM, "hudProfile"));
    if (!Number.isFinite(curProf) || curProf < -1 || curProf >= profList.length) curProf = -1;
    const profOpts = profList.length
      ? [{ idx: -1, label: (g.profileLabel || "Осн."), dmg: (g.damage || ""), active: curProf < 0 }]
          .concat(profList.map((p, i) => ({
            idx: i, label: (p.label || `Проф.${i + 1}`), dmg: (p.damage || ""), active: curProf === i
          })))
      : [];

    return {
      slot: slotKey, label, empty: false,
      id: w.id, name: w.name, isMelee: melee,
      loaded: ammo?.name ?? "",
      clip: Number(g.magazineCur) || 0,
      clipMax: Number(g.magazineMax) || 0,
      empty2: !melee && (Number(g.magazineCur) || 0) <= 0 && (Number(g.magazineMax) || 0) > 0,
      noMag: !Number(g.magazineMax),
      recharge: !!g.needsRecharge,
      rof,
      gripOpts, profOpts, hasOptions: gripOpts.length > 0 || profOpts.length > 0,
      damage: g.damage || "", pen: Number(g.penetration) || 0
    };
  };
  const hands = [
    weaponView(mainId, "main", "ПРАВАЯ"),
    weaponView(offId,  "off",  "ЛЕВАЯ")
  ];
  // Левую руку не показываем пустой, если оружие всего одно (нечего в неё класть).
  const showOff = !hands[1].empty || equippedWeapons(actor).length > 1;
  if (!showOff) hands[1].hide = true;

  const slots = equippedWeapons(actor).map(w => ({
    id: w.id, name: w.name, img: w.img,
    hand: w.id === mainId ? "main" : w.id === offId ? "off" : null,
    melee: w.system.weaponClass === "melee"
  }));

  // Силовые поля: активное (для readout) + первое доступное для тумблера.
  const shields = actor.items.filter(i => i.type === "forcefield");
  const activeShield = shields.find(s => s.system.status === "active");
  const shieldBtn = activeShield || shields[0] || null;

  // Псайкер: PR + психосилы для быстрого манифеста прямо из HUD.
  const isPsyker = !!sys.isPsyker || (Number(sys.psyker?.rating) || 0) > 0;
  let psychic = null;
  if (isPsyker) {
    const chars = sys.characteristics ?? {};
    const tpr = Number(sys.psyker?.currentRating) || 0;
    const powers = actor.items.filter(i => i.type === "psychicPower").map(p => {
      const ps = p.system;
      // Превью порога психотеста при эPR = тПР (по умолчанию): charVal + 5×эPR + мод.
      const ck = (ps.testChar && ps.testChar !== "cor" && ps.testChar !== "psyniscience") ? ps.testChar : null;
      const charVal = ck && chars[ck] ? (chars[ck].total || 0) : 0;
      return {
        id: p.id, name: p.name, type: ps.powerType,
        discipline: ps.discipline || "",
        pr: Number(ps.prRequired) || 0,
        sustainable: !!ps.sustainable, sustained: !!ps.isSustained,
        threshold: charVal + 5 * tpr + (Number(ps.testMod) || 0),
        damage: ps.damage || ""
      };
    // Сортировка: сперва поддерживаемые (активные), затем по дисциплине и имени.
    }).sort((a, b) =>
      (Number(b.sustained) - Number(a.sustained)) ||
      a.discipline.localeCompare(b.discipline, "ru") ||
      a.name.localeCompare(b.name, "ru"));
    psychic = {
      tpr, bpr: Number(sys.psyker?.rating) || 0,
      sustain: Number(sys.psyker?.sustain) || 0,
      canManifest: tpr > 0,
      powers
    };
  }

  // Лампочки состояний.
  const c = sys.conditions ?? {};
  const lamps = [
    { on: c.bleeding,     label: "КРОВОТЕЧ.", bad: true },
    { on: c.haemorrhaging,label: "ГЕМОРРАГ.", bad: true },
    { on: c.stunned,      label: "ОГЛУШЁН" },
    { on: c.prone,        label: "ЛЕЖИТ" },
    { on: c.blinded,      label: "ОСЛЕПЛЁН" },
    { on: c.deafened,     label: "ОГЛОХ" },
    { on: c.poisoned,     label: "ОТРАВЛЕН", bad: true },
    { on: c.burning,      label: "ГОРИТ", bad: true },
    { on: c.unconscious,  label: "БЕЗ СОЗН.", bad: true },
    { on: (Number(sys.fatigue?.value) || 0) > 0, label: "УСТАЛ" }
  ].filter(l => l.on);

  const woundPct = pctOf(ws.value, ws.max);

  return {
    name: actor.name, img: actor.img,
    isGM: game.user.isGM,
    armor,
    // Раны — крупным блоком.
    wounds: {
      value: ws.value, max: ws.max, crit: ws.crit,
      pct: woundPct, color: WOUND_COLOR[ws.key] || WOUND_COLOR.healthy,
      key: ws.key
    },
    // Устал./Порча/Безумие убраны из HUD как второстепенные (следим на листе).
    tracks: [],
    // Ресурс судьбы: у Друкхари это Очки Боли, у Хаоситов — Очки Бесчестья
    // (общий хелпер fateTerm, как в шапке листа) — подпись на HUD должна
    // совпадать с листом, иначе игрок ищет «Судьбу», которой у него нет.
    fateTerm: fateTerm(sys),
    fate: {
      value: Number(sys.fate?.value) || 0,
      max: Number(sys.fate?.max) || 0,
      pips: Array.from({ length: clamp(Number(sys.fate?.max) || 0, 0, 10) },
        (_, i) => ({ full: i < (Number(sys.fate?.value) || 0) }))
    },
    lamps,
    hands, showOff,
    hasWeapon: !!(mainId || offId),
    slots,
    shield: shieldBtn ? {
      id: shieldBtn.id, name: shieldBtn.name,
      active: shieldBtn.system.status === "active",
      rating: shieldBtn.system.currentRating || 0,
      ratingMax: shieldBtn.system.ratingMax || 0,
      special: !!shieldBtn.system.isSpecialRating
    } : null,
    psychic, hasPsychic: !!psychic
  };
}

/* ── Отрисовка ─────────────────────────────────────────────────────────── */

let _busy = false, _again = false;

export async function refreshHUD() {
  const el = document.getElementById(EL_ID);
  if (!el) return;
  if (_busy) { _again = true; return; }
  _busy = true;
  try {
    const actor = hudActor();
    // Корабль рисуется своим шаблоном и своими обработчиками.
    if (actor?.type === "ship") {
      el.innerHTML = await foundry.applications.handlebars.renderTemplate(SHIP_TPL, shipHudData(actor));
      wireShipHud(el, actor);
      return;
    }
    const data = actor ? hudData(actor) : { idle: true, isGM: !!game.user?.isGM };
    el.innerHTML = await foundry.applications.handlebars.renderTemplate(TPL, data);
    wire(el, actor);
  } finally {
    _busy = false;
    if (_again) { _again = false; refreshHUD(); }
  }
}

/* ── Клики ─────────────────────────────────────────────────────────────── */

export function openSheet(actor, tab = "main") {
  actor.sheet.render(true);
  setTimeout(() => actor.sheet._tabs?.[0]?.activate?.(tab), 60);
}

function wire(el, actor) {
  el.querySelector("[data-toggle-hotbar]")?.addEventListener("click", () => {
    document.body.classList.toggle("wh-hotbar-on");
  });
  if (!actor) return;
  const own = actor.isOwner;

  const handWeapon = (hand) => {
    const ids = handWeaponIds(actor);
    const id = hand === "off" ? ids.offId : ids.mainId;
    return id ? actor.items.get(id) : null;
  };

  // Назначение оружия по рукам: ЛКМ по слоту — в правую руку, ПКМ — в левую.
  // Повторный клик той же рукой по тому же оружию — снять из руки.
  const assign = async (id, hand) => {
    const ids = handWeaponIds(actor);
    const upd = {};
    if (hand === "main") {
      upd["flags." + SYSTEM + ".hudMainHand"] = (ids.mainId === id) ? "" : id;
      if (ids.offId === id) upd["flags." + SYSTEM + ".hudOffHand"] = "";
    } else {
      upd["flags." + SYSTEM + ".hudOffHand"] = (ids.offId === id) ? "" : id;
      if (ids.mainId === id) upd["flags." + SYSTEM + ".hudMainHand"] = "";
    }
    await actor.update(upd);
  };
  el.querySelectorAll("[data-weapon]").forEach(b => {
    b.addEventListener("click", (ev) => { ev.preventDefault(); if (own) assign(b.dataset.weapon, "main"); });
    b.addEventListener("contextmenu", (ev) => { ev.preventDefault(); if (own) assign(b.dataset.weapon, "off"); });
  });

  // Перезарядка (по руке).
  el.querySelectorAll("[data-reload]").forEach(b => b.addEventListener("click", () => {
    const w = handWeapon(b.dataset.reload);
    if (own && w) _reloadWeapon(actor, w);
  }));

  // Огонь/удар (по руке): Fallout-стиль — перекрестие → цель → диалог атаки
  // (и для стрелкового, и для ближнего).
  el.querySelectorAll("[data-fire]").forEach(b => b.addEventListener("click", () => {
    const w = handWeapon(b.dataset.fire);
    if (!own || !w) return;
    beginTargeting(actor, w, () => actor.sheet._showAttackDialog?.(w));
  }));

  // Выбор хвата (стр. 39) — прямой клик по кнопке нужного хвата, флаг hudGrip.
  el.querySelectorAll("[data-grip-set]").forEach(b => b.addEventListener("click", async () => {
    const w = actor.items.get(b.dataset.gripSet);
    if (!own || !w) return;
    await w.setFlag(SYSTEM, "hudGrip", b.dataset.key);
  }));

  // Выбор профиля (стр. 207-221) — прямой клик, флаг hudProfile (-1 = основной).
  el.querySelectorAll("[data-profile-set]").forEach(b => b.addEventListener("click", async () => {
    const w = actor.items.get(b.dataset.profileSet);
    if (!own || !w) return;
    await w.setFlag(SYSTEM, "hudProfile", Number(b.dataset.idx));
  }));

  // Экипированное стрелковое как рукопашное (приклад/пистолет в упор, стр. 40):
  // импровизированный профиль (WS-тест, свой урон/свойства), НЕ стрельба.
  el.querySelectorAll("[data-melee-gun]").forEach(b => b.addEventListener("click", () => {
    const w = actor.items.get(b.dataset.meleeGun);
    if (!own || !w) return;
    beginTargeting(actor, w, () => actor.sheet._showAttackDialogNoWeapon?.(gunMeleeStrike(w)), `${w.name} (в упор)`);
  }));

  // Безоружные удары (кулак/пинок/головой) — перекрестие → рукопашная без оружия.
  el.querySelectorAll("[data-unarmed]").forEach(b => b.addEventListener("click", () => {
    if (!own) return;
    const strike = UNARMED_STRIKES[b.dataset.unarmed] || UNARMED_STRIKES.fist;
    beginTargeting(actor, null, () => actor.sheet._showAttackDialogNoWeapon?.(strike), strike.label);
  }));

  // Силовое поле — вкл/выкл.
  el.querySelector("[data-shield]")?.addEventListener("click", () => {
    if (!own) return;
    const id = el.querySelector("[data-shield]").dataset.shield;
    const s = actor.items.get(id);
    if (s) _toggleShield(actor, s);
  });

  // Психосила — быстрый манифест. Целевые/атакующие силы — сперва перекрестие
  // (Fallout-стиль), затем диалог манифестации. ПКМ по поддерживаемой —
  // переключить поддержание, не открывая диалог.
  el.querySelectorAll("[data-psy]").forEach(b => {
    b.addEventListener("click", () => {
      if (!own) return;
      const p = actor.items.get(b.dataset.psy);
      if (!p) return;
      const manifest = () => actor.sheet._showManifestDialog?.(p);
      if (PSY_TARGETED.has(p.system.powerType) && canvas?.ready) beginTargeting(actor, p, manifest);
      else manifest();
    });
    b.addEventListener("contextmenu", async (ev) => {
      ev.preventDefault();
      if (!own) return;
      const p = actor.items.get(b.dataset.psy);
      if (p?.system?.sustainable) await p.update({ "system.isSustained": !p.system.isSustained });
    });
  });

  // Открыть лист.
  el.querySelectorAll("[data-open-sheet]").forEach(b =>
    b.addEventListener("click", () => openSheet(actor, b.dataset.openSheet || "main")));
}

/* ── Запуск ────────────────────────────────────────────────────────────── */

export function initHUD() {
  if (document.getElementById(EL_ID)) return;
  const el = document.createElement("div");
  el.id = EL_ID;
  (document.getElementById("ui-bottom") ?? document.getElementById("interface") ?? document.body)
    .appendChild(el);
  document.body.classList.add("wh-hud-on");
  refreshHUD();

  const mine = (a) => a?.id && a.id === hudActor()?.id;
  Hooks.on("updateActor", (a) => { if (mine(a)) refreshHUD(); });
  for (const h of ["createItem", "updateItem", "deleteItem"])
    Hooks.on(h, (it) => { if (mine(it.parent)) refreshHUD(); });
  Hooks.on("controlToken", () => refreshHUD());
  Hooks.on("canvasReady", () => refreshHUD());
}
