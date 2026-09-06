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
import { isIntegralAttack } from "../combat/equipped-melee.mjs";
import { weaponProfiles, canStrikeWithGun } from "../combat/weapon-profiles.mjs";
import { hasActionEconomy, isEncounterActive, apSpendGate } from "../combat/action-economy.mjs";
import { getHeldHand, weaponHandsRequired } from "../rules/hands.mjs";
import { movementMenuItems } from "../combat/movement-actions.mjs";
import { applyDrug, deactivateDrugEffect } from "../sheets/tabs/drugs.mjs";

const SYSTEM = "warhammer-dbc";
const TPL = `systems/${SYSTEM}/templates/apps/hud.hbs`;
const EL_ID = "wh-hud";

// Типы психосил, требующие цели (перед манифестацией — перекрестие).
const PSY_TARGETED = new Set(["attack", "psychicShoot", "psychicBlade", "touch", "change", "duration", "indirect"]);

// Безоружные удары (стр. 40) — теперь обычные предметы-оружие (integralAttack,
// packs-src/weapons/Интегральные_атаки), выданные любому персонажу расой
// (Mechanics kind:"integralAttack" на каждом предмете-расе). Кнопки здесь —
// просто быстрый доступ к ним же: клик ищет предмет по имени и открывает
// обычный диалог атаки (профиль/Приём/Стойка/Хват выбираются уже в нём же —
// в т.ч. усиленный профиль «Unarmed Warrior», если Талант куплен).
// _id исходников в packs-src/weapons/Интегральные_атаки — только для того,
// чтобы Кулак/Пинок/Удар головой стабильно шли первыми в лотке 0-хватных атак
// (zeroHandItems ниже) со своими узнаваемыми иконками; сама кнопка теперь
// адресуется прямо по id предмета на акторе (data-unarmed="{{id}}"), без
// поиска по имени/uuid.
const UNARMED_SOURCE_IDS = {
  fist: "89mS3BzjUKrGFRdH",
  kick: "U2TAAlVnZpdRQscO",
  headbutt: "xP2os46ZgH3HqoGj"
};
const UNARMED_ICONS = { fist: "fa-hand-fist", kick: "fa-shoe-prints", headbutt: "fa-user" };
const UNARMED_RANK = { fist: 0, kick: 1, headbutt: 2 };

// Ключ (fist/kick/headbutt) предмета по его equipSourceUuid, если это один
// из трёх «базовых» безоружных ударов — иначе null.
function unarmedKey(item) {
  const srcId = String(item.getFlag(SYSTEM, "equipSourceUuid") || "").split(".").pop();
  return Object.keys(UNARMED_SOURCE_IDS).find(k => UNARMED_SOURCE_IDS[k] === srcId) ?? null;
}

// Лоток «Безоружный бой»: интегральные атаки (часть тела/машины — Кулак,
// Пинок, Удар головой, Кислотный Плевок, Вопль, Дары Одержимого-выдохи и
// т.п.) с нулевой занятостью руки (rules/hands.mjs, weaponHandsRequired).
// Обычное снаряжение с Independent/Wrist (Болтшторм-перчатка и т.п.) сюда
// НЕ попадает — оно остаётся в слоте руки (handWeaponIds ниже) со своим
// магазином/перезарядкой; в лотке ему было бы не место среди рукопашных
// ударов, а слот терять нельзя (wdbc, ревью pr-reviewer перед пушем).
// Кулак/Пинок/Удар головой — стабильно первыми, дальше — по sort предмета.
function zeroHandItems(actor) {
  return equippedWeapons(actor)
    .filter(w => isIntegralAttack(w) && weaponHandsRequired(w, actor) === 0)
    .sort((a, b) => {
      const ra = UNARMED_RANK[unarmedKey(a)] ?? 99;
      const rb = UNARMED_RANK[unarmedKey(b)] ?? 99;
      return ra - rb || (a.sort ?? 0) - (b.sort ?? 0);
    });
}
function zeroHandIcon(item) {
  const key = unarmedKey(item);
  if (key) return UNARMED_ICONS[key];
  return item.system?.weaponClass === "melee" ? "fa-hand-back-fist" : "fa-satellite-dish";
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
  const t = canvas?.tokens?.controlled?.[0]?.actor;
  // Выбранный на сцене токен важнее назначенного персонажа — так HUD следует
  // за тем, кого выделили (ГМ ведёт бой по чужим токенам; игрок переключается
  // между своими персонажем/кораблём/миньоном). Игроку токен должен
  // принадлежать (isOwner) — иначе с выделением чужого юнита на сцене HUD
  // молча показал бы его лист.
  if (HUD_TYPES.includes(t?.type) && (game.user.isGM || t.isOwner)) return t;
  if (HUD_TYPES.includes(mine?.type)) return mine;
  if (game.user.isGM) return null;
  const own = game.actors?.filter(a => HUD_TYPES.includes(a.type) && a.isOwner) ?? [];
  return own.length === 1 ? own[0] : null;
}

/* ── Активное оружие ───────────────────────────────────────────────────── */

function equippedWeapons(actor) {
  return actor.items.filter(i => i.type === "weapon" && i.system.equipped);
}

// Две руки: правая (основная) и левая (вторая). Источник истины — предметный
// флаг weaponHand ("right"/"left", module/sheets/tabs/gear.mjs setWeaponHand),
// назначаемый кнопками Л/П прямо на вкладке БОЙ листа — HUD руку больше не
// назначает сам (было: акторные флаги hudMainHand/hudOffHand + клик по слоту
// в HUD). Рука ещё не назначена ни разу — прежний фолбэк (первое/второе
// надетое), чтобы у нового персонажа HUD не пустовал.
function handWeaponIds(actor) {
  const eq = equippedWeapons(actor);
  // В слоты Л/П не назначаются только НУЛЕВОРУЧНЫЕ интегральные атаки
  // (кулак/пинок/головой/природные — Betcher's Gland и т.п.) — они всегда
  // доступны из отдельного лотка «Безоружный бой» (zeroHandItems, тот же
  // критерий isIntegralAttack+0 рук) и не должны вытеснять из слота
  // настоящее оружие. 1-РУЧНЫЕ интегральные атаки (Дары Одержимого —
  // Клинок/Когти/Коса/Хлыст, grips:"1р") руку физически занимают точно так
  // же, как обычное оружие, и раньше выпадали из HUD целиком (wdbc-alxr) —
  // бланкетный !isIntegralAttack() не различал 0-ручные и 1-ручные.
  // Обычное снаряжение с нулевой занятостью руки (Independent/Wrist —
  // Болтшторм-перчатка и т.п.) в слот, наоборот, ДОЛЖНО попадать: иначе у
  // него в HUD пропадают магазин, перезарядка и кнопка ОГОНЬ (регрессия,
  // поймана pr-reviewer перед пушем) — это настоящее оружие, просто не
  // занимающее руку физически, а не часть тела.
  const real = eq.filter(w => !(isIntegralAttack(w) && weaponHandsRequired(w, actor) === 0));
  const byHand = h => real.find(w => getHeldHand(w) === h) ?? null;

  let mainId = byHand("right")?.id ?? null;
  let offId  = byHand("left")?.id  ?? null;

  if (!mainId && !offId) {
    mainId = real[0]?.id ?? null;
    offId  = real.find(w => w.id !== mainId)?.id ?? null;
  } else {
    if (!mainId) mainId = real.find(w => w.id !== offId)?.id ?? null;
    if (!offId)  offId  = real.find(w => w.id !== mainId)?.id ?? null;
  }
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

export function hudData(actor) {
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

  // Две руки: правая (основная) и левая (вторая). 0-ручные интегральные атаки
  // сюда не попадают (см. handWeaponIds) — их count не должен решать, нужен
  // ли видимый слот левой руки; 1-ручные (Дары Одержимого) считаются наравне
  // с обычным оружием — тот же критерий, что у handWeaponIds (wdbc-alxr).
  const { mainId, offId } = handWeaponIds(actor);
  const heldWeaponCount = equippedWeapons(actor)
    .filter(w => !(isIntegralAttack(w) && weaponHandsRequired(w, actor) === 0)).length;
  const zeroHand = zeroHandItems(actor).map(w => ({ id: w.id, name: w.name, icon: zeroHandIcon(w) }));
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

    // Профили — из общего сборщика: сюда же попадает выводимый «Удар в упор»
    // у стрелкового (wdbc-bs0q). Авторские сохраняют свои индексы, по которым
    // хранится выбор игрока (флаг hudProfile).
    const profList = weaponProfiles(w, { isIntegralAttack });
    let curProf = Number(w.getFlag(SYSTEM, "hudProfile"));
    if (!Number.isFinite(curProf) || curProf < -1 || curProf >= profList.length) curProf = -1;
    const profOpts = profList.length
      ? [{ idx: -1, label: (g.profileLabel || "Осн."), dmg: (g.damage || ""), active: curProf < 0 }]
          .concat(profList.map((p, i) => ({
            idx: i, label: (p.label || `Проф.${i + 1}`), dmg: (p.damage || ""), active: curProf === i
          })))
      : [];

    // Гейт кнопки ОГОНЬ/УДАР (wdbc-jpls, тот же предикат, что и wdbc-qjnk):
    // рукопашная База всегда стоит минимум 1 ОД (Полудействие) — ни одна не
    // бесплатна (module/constants/combat.mjs, MELEE_BASES), поэтому 0 ОД уже
    // однозначно блокирует любой рукопашный Приём. Дальнобойная стрельба ОД
    // сейчас не тратит вовсе (см. action-economy.mjs, apCostForActionType
    // применяется только к рукопашной) — гейтить «ОГОНЬ» нечем, не гейтим.
    const fireGate = melee ? apSpendGate(actor, 1) : { disabled: false, title: "" };

    // Удар оружием в упор/приклад (стр. 40) — быстрая кнопка к тому же
    // профилю, что лежит в списке Профилей рядом (wdbc-bs0q). Кому он
    // полагается, решает один общий предикат combat/weapon-profiles.mjs::
    // canStrikeWithGun: надетое, стрелковое, не интегральная атака (у
    // кислотного плевка нет приклада — точечно включается флагом
    // allowGunMeleeStrike на самом предмете).
    const canButtStrike = canStrikeWithGun(w, { isIntegralAttack });

    return {
      slot: slotKey, label, empty: false,
      id: w.id, name: w.name, isMelee: melee, canButtStrike,
      loaded: ammo?.name ?? "",
      clip: Number(g.magazineCur) || 0,
      clipMax: Number(g.magazineMax) || 0,
      empty2: !melee && (Number(g.magazineCur) || 0) <= 0 && (Number(g.magazineMax) || 0) > 0,
      noMag: !Number(g.magazineMax),
      recharge: !!g.needsRecharge,
      rof, fireGate,
      gripOpts, profOpts, hasOptions: gripOpts.length > 0 || profOpts.length > 0,
      damage: g.damage || "", pen: Number(g.penetration) || 0
    };
  };
  const hands = [
    weaponView(mainId, "main", "ПРАВАЯ"),
    weaponView(offId,  "off",  "ЛЕВАЯ")
  ];
  // Левую руку не показываем пустой, если оружие всего одно (нечего в неё класть).
  const showOff = !hands[1].empty || heldWeaponCount > 1;
  if (!showOff) hands[1].hide = true;

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
    { on: c.dazed,        label: "СТУПОР" },
    { on: c.prone,        label: "ЛЕЖИТ" },
    { on: c.blinded,      label: "ОСЛЕПЛЁН" },
    { on: c.deafened,     label: "ОГЛОХ" },
    { on: c.poisoned,     label: "ОТРАВЛЕН", bad: true },
    { on: c.burning,      label: "ГОРИТ", bad: true },
    { on: c.helpless,     label: "БЕСПОМОЩЕН", bad: true },
    { on: c.unconscious,  label: "БЕЗ СОЗН.", bad: true },
    { on: (Number(sys.fatigue?.value) || 0) > 0, label: "УСТАЛ" }
  ].filter(l => l.on);

  const woundPct = pctOf(ws.value, ws.max);

  // Кнопка «Закончить ход»: активна только когда сейчас ход именно этого
  // актора (по actorId текущего combatant — то же сравнение, что делает
  // нативный трекер боя, независимо от того, сколько у актора токенов).
  const combatant = game.combat?.combatant;
  const myTurn = !!(combatant && combatant.actorId === actor.id);

  // ОД/Реакции (wdbc-jpls): единственное окно, которое игрок держит открытым
  // весь бой, раньше не показывало главный боевой ресурс вовсе — те же данные,
  // что и на вкладке БОЙ листа (module/sheets/character-context.mjs), без
  // доп. пула на Избегание (тут только быстрый статус, не полная панель).
  const actionEconomy = hasActionEconomy(actor) ? {
    ap:        { value: Number(sys.actionPoints?.value) || 0, max: Number(sys.actionPoints?.max) || 0 },
    reactions: { value: Number(sys.reactions?.value) || 0, max: Number(sys.reactions?.max) || 0 },
    encounterActive: isEncounterActive()
  } : null;

  // Вкладка «Движение» (wdbc-zdu4): те же пункты, что Dialog showMovementMenu
  // (Token HUD/вкладка БОЙ, movement-actions.mjs) — один источник гейтов
  // (isEncounterActive/actorCanFly/actorHasHalfStep), без action() — сама
  // функция не сериализуется в шаблон, клик вызывает её заново через key
  // (см. wire() ниже).
  const movement = movementMenuItems(actor).map(({ key, label, cost }) => ({ key, label, cost }));

  // Вкладка «Химия» (wdbc-zdu4): препараты актора для быстрого применения в
  // бою — та же applyDrug()/deactivateDrugEffect(), что вкладка «Химия»
  // листа (tabs/drugs.mjs), без новой логики применения. Показываем, пока
  // есть дозы ИЛИ пока идёт уже применённый эффект (даже с quantity 0 —
  // игрок должен видеть таймер и снять эффект вручную).
  const chemistry = actor.items
    .filter(i => i.type === "drug" && ((Number(i.system.quantity) || 0) > 0 || i.system.activeEffect?.isActive))
    .map(i => ({
      id: i.id, name: i.name,
      quantity: Number(i.system.quantity) || 0,
      active: !!i.system.activeEffect?.isActive,
      roundsRemaining: Number(i.system.activeEffect?.roundsRemaining) || 0,
      effect: i.system.effect || ""
    }));

  return {
    name: actor.name, img: actor.img,
    isGM: game.user.isGM,
    myTurn,
    actionEconomy,
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
    // Максимум Очков Бесчестья (Хаосит/Демон-Принц) — Inf.b, СЧИТАЕТСЯ, а не
    // читается из system.fate.max (actor-sheet.mjs::_infamyMax,
    // demon-prince-sheet.mjs — тот же геттер): комментарий там прямо говорит,
    // что расхождение с fate.max было багом. HUD раньше читал только
    // sys.fate.max напрямую — на Хаосите это давало неверное число пипсов
    // (напр. хранимое fate.max=2 при реальном Inf.b=4 обрезало полосу до 2
    // ячеек, хотя fate.value корректно был 4) — расхождение с листом.
    fateTerm: fateTerm(sys),
    fate: (() => {
      const value = actor.type === "demonPrince" ? (Number(sys.dp?.ip) || 0) : (Number(sys.fate?.value) || 0);
      const max = (actor.type === "demonPrince" || sys.alignment === "heretic")
        ? Math.max(0, Number(sys.characteristics?.inf?.bonus) || 0)
        : (Number(sys.fate?.max) || 0);
      return {
        value, max,
        pips: Array.from({ length: clamp(max, 0, 10) }, (_, i) => ({ full: i < value }))
      };
    })(),
    lamps,
    hands, showOff,
    zeroHand,
    hasWeapon: !!(mainId || offId),
    movement,
    chemistry,
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

/* ── Вкладки (wdbc-zdu4) ──────────────────────────────────────────────────
   Общий блок (портрет/раны/броня/Судьба/ОД-Реакции/лампы/Ход/щит) остаётся
   всегда виден — не вкладка. «Атаки» (бывшая оружейная ячейка) и новые
   «Движение»/«Химия» видны всем; «Психосила» — только псайкерам
   (data.hasPsychic). Выбор вкладки — флаг ИГРОКА (game.user, не актора):
   свой для каждого, кто смотрит на HUD чужого токена, и переживает
   F5/перезаход — тот же приём, что hudGrip/hudProfile на предметах. */
const HUD_TAB_LABELS = { attacks: "АТАКИ", psychic: "ПСИХОСИЛА", movement: "ДВИЖЕНИЕ", chemistry: "ХИМИЯ" };
const HUD_TAB_ORDER = ["attacks", "psychic", "movement", "chemistry"];

function availableHudTabs(data) {
  return HUD_TAB_ORDER.filter(k => k !== "psychic" || data.hasPsychic);
}

/** Добавляет data.tabs (список для nav) и data.activeTab — читает сохранённый
 *  выбор из флага игрока, откатывается на «Атаки», если сохранённая вкладка
 *  сейчас недоступна (например «Психосила» у не-псайкера). */
function withHudTabs(data) {
  const avail = availableHudTabs(data);
  const saved = game.user?.getFlag?.(SYSTEM, "hudTab");
  const activeTab = avail.includes(saved) ? saved : avail[0];
  data.activeTab = activeTab;
  data.tabs = avail.map(key => ({ key, label: HUD_TAB_LABELS[key], active: key === activeTab }));
  return data;
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
    const data = actor ? withHudTabs(hudData(actor)) : { idle: true, isGM: !!game.user?.isGM };
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
  // «Закончить ход»: тот же вызов, что у нативной кнопки трекера боя
  // (client/applications/sidebar/tabs/combat-tracker.mjs, action "endTurn" →
  // combat.nextTurn()) — HUD не переизобретает переход хода, просто даёт
  // быстрый доступ к нему без открытия вкладки Encounter.
  el.querySelector("[data-end-turn]")?.addEventListener("click", async ev => {
    ev.preventDefault();
    if (ev.currentTarget.disabled) return;
    await game.combat?.nextTurn();
  });
  if (!actor) return;
  const own = actor.isOwner;

  const handWeapon = (hand) => {
    const ids = handWeaponIds(actor);
    const id = hand === "off" ? ids.offId : ids.mainId;
    return id ? actor.items.get(id) : null;
  };

  // Перезарядка (по руке).
  el.querySelectorAll("[data-reload]").forEach(b => b.addEventListener("click", () => {
    const w = handWeapon(b.dataset.reload);
    if (own && w) _reloadWeapon(actor, w);
  }));

  // Огонь/удар (по руке): Fallout-стиль — перекрестие → цель → диалог атаки
  // (и для стрелкового, и для ближнего). Кнопка — <a>, не <button>: атрибут
  // disabled её клик не остановит, гейт (wdbc-jpls, apSpendGate — тот же
  // предикат, что wdbc-qjnk) держится классом hud-disabled из hudData.fireGate.
  el.querySelectorAll("[data-fire]").forEach(b => b.addEventListener("click", () => {
    if (b.classList.contains("hud-disabled")) return;
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

  // Экипированное стрелковое как рукопашное (приклад/пистолет в упор, стр. 40).
  //
  // Теперь это ОБЫЧНАЯ атака этим оружием выбранным профилем (wdbc-bs0q), а не
  // синтетическая безоружная в обход оружейной машинерии, как было раньше:
  // работают Хват, Стойка, Тренировка по категории и свойства самого предмета.
  // Кнопка осталась как быстрый путь — она просто выбирает нужный профиль за
  // игрока и открывает то же окно атаки, что и обычный выстрел.
  el.querySelectorAll("[data-melee-gun]").forEach(b => b.addEventListener("click", () => {
    const w = actor.items.get(b.dataset.meleeGun);
    if (!own || !w) return;
    const profiles = weaponProfiles(w, { isIntegralAttack });
    const idx = profiles.findIndex(p => p.generated && p.melee);
    if (idx < 0) return;   // профиль не полагается (снято/рукопашное/интегральная)
    beginTargeting(actor, w,
      () => actor.sheet._showAttackDialog?.(w, { forceMelee: true, profileIdx: idx }),
      `${w.name} (в упор)`, { forceMelee: true });
  }));

  // Лоток «Безоружный бой» (zeroHandItems выше) — перекрестие → обычный
  // диалог атаки предмета-удара. Кнопка адресует предмет напрямую по id
  // (data-unarmed="{{id}}", проставлен в hudData), больше не ищет по
  // имени/uuid — сам список уже отфильтрован по нулевой занятости руки.
  el.querySelectorAll("[data-unarmed]").forEach(b => b.addEventListener("click", () => {
    if (!own) return;
    const item = actor.items.get(b.dataset.unarmed);
    if (!item) return;
    beginTargeting(actor, item, () => actor.sheet._showAttackDialog?.(item), item.name);
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

  // Вкладки (wdbc-zdu4): чисто зрительский выбор, не трогает актора — доступен
  // всем, кто видит HUD (в т.ч. ГМ на чужом токене), без gate по own. Выбор
  // хранится во флаге игрока (не актора) — свой на каждого зрителя.
  el.querySelectorAll("[data-hud-tab]").forEach(b => b.addEventListener("click", async () => {
    await game.user.setFlag(SYSTEM, "hudTab", b.dataset.hudTab);
    refreshHUD();
  }));

  // Движение (wdbc-zdu4): та же логика и те же гейты, что Dialog showMovementMenu
  // (movement-actions.mjs, movementMenuItems) — hudData не сериализует action()
  // в шаблон, здесь просто находим пункт по key и вызываем его заново.
  el.querySelectorAll("[data-movement]").forEach(b => b.addEventListener("click", () => {
    if (!own) return;
    movementMenuItems(actor).find(i => i.key === b.dataset.movement)?.action();
  }));

  // Химия (wdbc-zdu4): применить/снять эффект — та же applyDrug/deactivateDrugEffect,
  // что вкладка «Химия» листа (tabs/drugs.mjs), без новой логики применения.
  el.querySelectorAll("[data-drug-apply]").forEach(b => b.addEventListener("click", async () => {
    if (!own) return;
    const item = actor.items.get(b.dataset.drugApply);
    if (item) await applyDrug(actor, item);
  }));
  el.querySelectorAll("[data-drug-deactivate]").forEach(b => b.addEventListener("click", async () => {
    if (!own) return;
    const item = actor.items.get(b.dataset.drugDeactivate);
    if (item) await deactivateDrugEffect(item);
  }));

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

  // Боевые хуки (wdbc-9kqs). Половина содержимого HUD зависит от того, идёт ли
  // Столкновение: список Движения гейтится isEncounterActive() (походные марши
  // только вне боя, Полудвижение/Натиск/Бег — только в бою), ОД и Реакции
  // сбрасываются на смене Хода. Без этих подписок HUD, отрисованный до нажатия
  // «Начать бой», так и висел с походным списком и старым числом ОД до
  // случайной перерисовки (повторный клик по токену).
  for (const h of ["combatStart", "createCombat", "updateCombat", "deleteCombat",
                   "createCombatant", "updateCombatant", "deleteCombatant"])
    Hooks.on(h, () => refreshHUD());
}
