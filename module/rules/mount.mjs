// module/rules/mount.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВЕРХОВОЙ БОЙ (корбук, глава «Прочее», стр. 477-478): владение скакуном и
//  байком, маневрирование, выпадение из седла, попадания по всаднику и
//  скакуну, штрафы стрельбы на ходу.
//
//  Здесь только числа: ни Foundry, ни бросков, ни листа. Диалоги и карточки —
//  в combat/mount.mjs, панель на листе — в sheets/tabs/mount-panel.mjs; оба
//  берут пороги и модификаторы отсюда, и разъехаться им негде.
//
//  ── Три решения, которые стоит знать до чтения кода ────────────────────────
//
//  1. ССЫЛКУ ХРАНИТ ВСАДНИК, а не скакун — наоборот, чем у Миньонов
//     (apps/minions.mjs). Причина не в симметрии, а в том, что скакуном бывает
//     `vehicle`: общей схемы существа у техники нет, и поле «кто на мне едет»
//     пришлось бы заводить дважды, в двух несвязанных схемах. У всадника оно
//     одно и всегда одно: сидеть в двух сёдлах разом нельзя. Обратный список
//     («кто на этом скакуне») собирается перебором акторов, как minionsOf.
//
//  2. SURVIVAL ВЕРХОМ СЧИТАЕТСЯ ОТ A, А НЕ ОТ P. Книга оговаривает это прямо:
//     «Survival для тестов со скакуном использует А». Поэтому готовое
//     `system.skills.survival.total` (оно от P) здесь не годится — значение
//     собирается заново из характеристики и надбавки ранга.
//
//  3. МОДИФИКАТОР БЫВАЕТ РАЗНЫМ У СКАКУНА И БАЙКА. Повороты и Занос требуют
//     одинаковой поправки («Survival+20 или Operate+20»), а удержание в седле
//     после провала ландшафта и Уклонение верхом — разной («Survival+0 или
//     Operate−10»). Поэтому поправка теста записывается либо числом, либо
//     парой {beast, bike}, и `testMod()` разбирает оба вида.
// ════════════════════════════════════════════════════════════════════════════

import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { findGroupEntry, specChar } from "../constants/skill-specializations.mjs";
import { itemHasName } from "./predicates.mjs";

const num = v => Number(v) || 0;

/** Кто может ехать верхом и кто может быть скакуном. */
export const RIDER_ACTOR_TYPES = ["character", "daemon", "demonPrince", "minion"];
export const MOUNT_ACTOR_TYPES = ["character", "daemon", "vehicle", "minion"];

/** Место в седле. Пассажир едет за спиной всадника и не управляет. */
export const MOUNT_ROLES = {
  rider:     { label: "Всадник" },
  passenger: { label: "Пассажир" },
  sidecar:   { label: "Коляска" }
};

// ── Скорость скакуна в текущем Ходу ───────────────────────────────────────
//  `ranged` — штраф стрелковым атакам с седла; `fall` — с какой высоты
//  считается урон при выпадении (доля SPD); `stay` — поправка теста
//  Acrobatics на удержание, когда скакун получил Крит, упал или умер.
export const MOUNT_SPEEDS = {
  still:  { label: "Без движения",    ranged:   0, fall: 0,   stay:   0 },
  half:   { label: "Полудвижение",    ranged: -10, fall: 0,   stay:   0 },
  full:   { label: "Полное движение", ranged: -20, fall: 0,   stay:   0 },
  charge: { label: "Натиск",          ranged: -30, fall: 0.5, stay: -10 },
  run:    { label: "Бег",             ranged: -30, fall: 1,   stay: -20 }
};

// ── Повороты (стр. 477) ───────────────────────────────────────────────────
//  Поворот на угол сверх бесплатного требует теста навыка управления; при
//  неудаче скакун поворачивает только на бесплатный угол, а всадник проходит
//  тест A с той же поправкой, что была у навыка, — иначе вылетает из седла.
//
//  `mod: null` — поворот без теста вовсе. `action` у неподвижного скакуна —
//  цена в действиях, теста там нет ни при каком угле.
export const MOUNT_TURNS = {
  still: {
    free: 0,
    options: [
      { angle: 90,  mod: null, action: "free" },
      { angle: 180, mod: null, action: "half" }
    ]
  },
  half: {
    free: 90,
    options: [
      { angle: 90,  mod: null },
      { angle: 180, mod: 20, riderMod: 20 }
    ]
  },
  full: {
    free: 45,
    options: [
      { angle: 45,  mod: null },
      { angle: 90,  mod: 20, riderMod: 20 },
      { angle: 270, mod: 10, riderMod: 10 }
    ]
  },
  charge: {
    free: 45,
    options: [
      { angle: 45,  mod: null },
      { angle: 90,  mod: 10, riderMod: 10 },
      { angle: 135, mod: 0,  riderMod: 0 }
    ]
  },
  run: {
    free: 45,
    options: [
      { angle: 45,  mod: null },
      { angle: 90,  mod: 0,   riderMod: 0 },
      // Книга даёт всаднику «тест А+0» на обоих углах Бега, хотя сам поворот
      // на 135° идёт с −10: поправка теста навыка и поправка теста Ловкости
      // здесь расходятся, и riderMod записан отдельно не для симметрии.
      { angle: 135, mod: -10, riderMod: 0 }
    ]
  }
};

/** Занос — полудействие после Натиска или Бега. */
export const MOUNT_SKID = { mod: -10, angle: 90, penalty: -10, afterSpeeds: ["charge", "run"] };

/** Штраф маневрирования за пассажира за спиной (Коляска его не даёт). */
export const PASSENGER_MANEUVER_MOD = -10;

/** Штрафы самому пассажиру на физические действия с седла. */
export const PASSENGER_ACTION_MOD = { base: -10, fast: -20 };

/** Верхом тесты трудного и опасного ландшафта получают −20 (стр. 477). */
export const MOUNT_TERRAIN_MOD = -20;

/** Избирательные атаки: по всаднику труднее, по скакуну — как обычно. */
export const SELECTIVE_MODS = { rider: -10, mount: 0, riderCovered: -30 };

/** Уклонение верхом комбинировано; удержание после провала ландшафта — тоже. */
export const STAY_MOD = { beast: 0, bike: -10 };

// ── Черты верхового боя ───────────────────────────────────────────────────
//  Черта скакуна — предмет `trait`, черта байка — `vehicleTrait`; ищутся они
//  одинаково, по двуязычному имени (predicates.itemHasName), потому что
//  `system.effects` у Черт существ — уходящий формат (см. шапку
//  data/item/trait.mjs), и вешать на него новую механику незачем.
export const MOUNT_TRAIT_DEFS = {
  ablativePlating: { names: ["Ablative Plating", "Аблативное Бронирование"] },
  allTerrain:      { names: ["All-Terrain", "Вездеход"] },
  aquatic:         { names: ["Aquatic", "Водный"] },
  blades:          { names: ["Blades", "Лезвия"], rated: true },
  flyer:           { names: ["Flyer", "Летун", "Летающий"], rated: true },
  hoverer:         { names: ["Hoverer", "Парящий"], rated: true },
  integralWeapon:  { names: ["Integral Weapon", "Интегрированное Оружие"] },
  legion:          { names: ["Legion", "Легион"] },
  machine:         { names: ["Machine", "Машина"], rated: true },
  maneuverable:    { names: ["Maneuverable", "Манёвренный", "Маневренный"] },
  sidecar:         { names: ["Sidecar", "Коляска"], rated: true },
  stand:           { names: ["Stand", "Стойка"] },
  unruly:          { names: ["Unruly", "Непослушный"] },
  warTrained:      { names: ["War-Trained", "Боевая Тренировка"] },
  daemonic:        { names: ["Daemonic", "Демонический"], rated: true }
};

const TRAIT_ITEM_TYPES = new Set(["trait", "vehicleTrait"]);

/**
 * Черты верхового боя скакуна: ключ → рейтинг (у нерейтинговых 0).
 * Рейтинг берётся из `system.rating`, как у всех Черт с (X).
 */
export function mountTraits(mount) {
  const found = {};
  for (const item of mount?.items ?? []) {
    if (!TRAIT_ITEM_TYPES.has(item?.type)) continue;
    for (const [key, def] of Object.entries(MOUNT_TRAIT_DEFS)) {
      if (key in found) continue;
      if (def.names.some(name => itemHasName(item, name))) found[key] = num(item?.system?.rating);
    }
  }
  return found;
}

/** Байк ли это — то есть машина, а не живой скакун. */
export function isBike(mount) {
  return mount?.type === "vehicle";
}

/** Летает ли скакун: и Flyer, и Hoverer уводят тесты в Operate (Aeronautica). */
export function isAirborne(mount, traits = null) {
  const t = traits ?? mountTraits(mount);
  if ("flyer" in t || "hoverer" in t) return true;
  // У техники ходовая может быть «скиммер»/«самолёт» и без отдельной Черты.
  const chassis = String(mount?.system?.chassis?.type || mount?.system?.vehicleType || "");
  return chassis === "skimmer" || chassis === "flyer";
}

// ── Навык управления ──────────────────────────────────────────────────────

/**
 * Каким Навыком этот скакун управляется (стр. 477).
 *  • живой скакун — Survival, и считается он от A, а не от P;
 *  • байк — Operate (Surface);
 *  • всё летающее, включая джетбайк, — Operate (Aeronautica);
 *  • у скакуна с Чертой Machine есть замена: Tech-Use вместо Survival.
 * @returns {{scope:string,key:string,specKey?:string,char:string,label:string,
 *            alt:?object}}
 */
export function mountControlSkill(mount, traits = null) {
  const t = traits ?? mountTraits(mount);
  const air = isAirborne(mount, t);

  if (isBike(mount) || air) {
    const specKey = air ? "aeronautica" : "surface";
    return {
      scope: "group", key: "operate", specKey,
      char: specChar("operate", specKey, "ag"),
      label: air ? "Operate (Aeronautica)" : "Operate (Surface)",
      alt: null
    };
  }

  return {
    scope: "skill", key: "survival", char: "ag", label: "Survival",
    // Робоскакун: Черта Machine позволяет вести все верховые тесты через
    // Tech-Use (стр. 478). Это замена, а не бонус — берётся то, что выгоднее.
    alt: "machine" in t
      ? { scope: "skill", key: "techUse", char: "int", label: "Tech-Use" }
      : null
  };
}

/**
 * Значение Навыка у всадника: характеристика + надбавка ранга.
 * Готовое `system.skills.*.total` не годится — у Survival там P (см. шапку).
 * @returns {{value:number, rank:string, trained:boolean, label:string}}
 */
export function skillValue(rider, info) {
  const chars = rider?.system?.characteristics ?? {};
  const charVal = num(chars?.[info?.char]?.total);

  let rank = "untrained";
  if (info?.scope === "group") {
    const entry = findGroupEntry(rider, info.key, info.specKey);
    if (entry?.rank) rank = entry.rank;
  } else {
    const skill = rider?.system?.skills?.[info?.key];
    if (skill?.rank) rank = skill.rank;
  }

  const bonus = SKILL_RANKS[rank]?.bonus ?? SKILL_RANKS.untrained.bonus;
  return { value: charVal + bonus, rank, trained: rank !== "untrained", label: info?.label || "" };
}

/**
 * Легион (стр. 478): байк для Космодесантников — седок Размером меньше 1
 * ИЛИ с S.b меньше 8 получает −20 на все тесты управления этим байком.
 * Обратный случай («космодесантник не помещается на мелкий байк без Трейта»)
 * — не число, а поломка снаряжения, ГМ решает за столом, не автоматизируется.
 */
export function legionPenalty(rider, traits) {
  if (!("legion" in (traits ?? {}))) return 0;
  const riderSize = num(rider?.system?.sizeTotal ?? rider?.system?.size);
  const sb = num(rider?.system?.characteristics?.s?.bonus);
  return (riderSize < 1 || sb < 8) ? -20 : 0;
}

/**
 * Навык, которым всадник реально ведёт этот скакун: основной или замена
 * (Tech-Use у робоскакуна), смотря что выше. Ниже −20 не бывает: это и есть
 * бросок нетренированного.
 *
 * `combined` означает «не владеет» — тогда, по книге, каждое движение и атака
 * верхом становятся комбинированным тестом с этим Навыком. Комбинирование
 * ядро не считает: это свойство ЧУЖОГО теста, и решает его тот бросок, к
 * которому верховой тест пристёгнут.
 */
export function riderControl(rider, mount, traits = null) {
  const t = traits ?? mountTraits(mount);
  const main = mountControlSkill(mount, t);
  const legion = legionPenalty(rider, t);
  const best = { ...skillValue(rider, main), info: main };
  best.value += legion;

  if (main.alt) {
    const alt = { ...skillValue(rider, main.alt), info: main.alt };
    alt.value += legion;
    if (alt.value > best.value) return { ...alt, combined: !alt.trained, legionPenalty: legion };
  }
  return { ...best, combined: !best.trained, legionPenalty: legion };
}

// ── Поправки тестов ───────────────────────────────────────────────────────

/** Поправка, записанная числом либо парой {beast, bike}. */
export function testMod(mod, mount) {
  if (mod == null) return 0;
  if (typeof mod === "number") return mod;
  return num(isBike(mount) ? mod.bike : mod.beast);
}

/**
 * Модификаторы теста МАНЕВРИРОВАНИЯ (повороты, Занос): Черта Manoeuvrable
 * даёт +20, пассажир за спиной — −10 (Коляска и Талант «Оруженосец» его
 * снимают).
 * @returns {{mod:number, parts:{label:string,value:number}[]}}
 */
export function maneuverMods(rider, mount, { passengers = 0, traits = null } = {}) {
  const t = traits ?? mountTraits(mount);
  const parts = [];

  if ("maneuverable" in t) parts.push({ label: "Манёвренный", value: 20 });

  if (passengers > 0 && !hasTalent(rider, "Squire", "Оруженосец")) {
    parts.push({ label: `Пассажир ×${passengers}`, value: PASSENGER_MANEUVER_MOD * passengers });
  }

  return { mod: parts.reduce((s, p) => s + p.value, 0), parts };
}

/** Есть ли у всадника Талант с таким именем (двуязычным). */
export function hasTalent(actor, ...names) {
  return [...(actor?.items ?? [])].some(
    i => (i?.type === "talent" || i?.type === "trait") && names.some(n => itemHasName(i, n)));
}

/**
 * Варианты поворота на этой скорости: угол, поправка теста навыка и поправка
 * теста Ловкости, если тест провален. Поправка маневрирования уже вложена в
 * `mod`, чтобы диалогу не пришлось складывать её второй раз.
 */
export function turnOptions(speedKey, rider, mount, opts = {}) {
  const table = MOUNT_TURNS[speedKey] || MOUNT_TURNS.still;
  const { mod: manMod, parts } = maneuverMods(rider, mount, opts);
  return {
    free: table.free,
    fallbackAngle: table.free,
    manoeuvreParts: parts,
    options: table.options.map(o => ({
      angle: o.angle,
      action: o.action ?? null,
      needsTest: o.mod != null,
      mod: o.mod == null ? null : o.mod + manMod,
      baseMod: o.mod ?? null,
      riderMod: o.riderMod ?? null
    }))
  };
}

/** Занос: доступен только после Натиска и Бега, и никогда — с Коляской. */
export function skidInfo(speedKey, rider, mount, opts = {}) {
  const t = opts.traits ?? mountTraits(mount);
  const { mod: manMod, parts } = maneuverMods(rider, mount, { ...opts, traits: t });
  return {
    allowed: MOUNT_SKID.afterSpeeds.includes(speedKey) && !("sidecar" in t),
    blockedBySidecar: "sidecar" in t,
    mod: MOUNT_SKID.mod + manMod,
    angle: MOUNT_SKID.angle,
    penalty: MOUNT_SKID.penalty,
    manoeuvreParts: parts
  };
}

// ── Стрельба с седла ──────────────────────────────────────────────────────

/**
 * Штраф стрелковой атаки с седла по скорости в текущем Ходу (стр. 478).
 * Интегрированное оружие штрафа не получает вовсе; турель в Коляске срезает
 * его на 20; демоническое свойство «Стабилизированный» снимает целиком.
 */
export function rangedPenalty(speedKey, { integral = false, sidecarTurret = false,
                                          stabilized = false } = {}) {
  if (integral || stabilized) return 0;
  const base = MOUNT_SPEEDS[speedKey]?.ranged ?? 0;
  return sidecarTurret ? Math.min(0, base + 20) : base;
}

/**
 * То же по конкретному скакуну: демоническое свойство «Стабилизированный»
 * снимает штраф скорости само, и спрашивать о нём диалоги не должны.
 */
export function mountRangedPenalty(speedKey, mount, opts = {}) {
  return rangedPenalty(speedKey, { ...opts, stabilized: !!possessionOf(mount)?.stabilized });
}

/** Избирательная атака по этому скакуну: «Укрытие» демона учитывается само. */
export function mountSelectiveMod(target, mount) {
  return selectiveMod(target, { covered: !!possessionOf(mount)?.covered });
}

/** Штраф пассажира на физические действия с седла (−20 на Натиске и Беге). */
export function passengerActionMod(speedKey, rider = null) {
  const fast = speedKey === "charge" || speedKey === "run";
  const base = fast ? PASSENGER_ACTION_MOD.fast : PASSENGER_ACTION_MOD.base;
  // Талант «Оруженосец» смягчает штраф пассажиру на 10.
  return hasTalent(rider, "Squire", "Оруженосец") ? Math.min(0, base + 10) : base;
}

// ── Попадания по всаднику и скакуну ───────────────────────────────────────

/** Дубль на d100: 11, 22, … 99. Сотня в успешный бросок не попадает. */
export function isDouble(roll) {
  const n = num(roll);
  return n >= 11 && n <= 99 && n % 11 === 0;
}

/**
 * Куда пришлось не-Избирательное попадание по всаднику (стр. 478).
 * Обычно по скакуну, и лишь дубль на успешном броске — по всаднику. С Чертой
 * Stand делят иначе: чётные — всадник, нечётные — скакун.
 * @returns {"rider"|"mount"}
 */
export function hitTarget(roll, mount, { traits = null, rider = null } = {}) {
  // Талант «Всадник-Защитник» позволяет забирать все попадания на себя.
  if (hasTalent(rider, "Defensive Rider", "Всадник-Защитник")) return "rider";
  const t = traits ?? mountTraits(mount);
  if ("stand" in t) return num(roll) % 2 === 0 ? "rider" : "mount";
  return isDouble(roll) ? "rider" : "mount";
}

/** Штраф Избирательной атаки по цели верхом. `covered` — «Укрытие» демона. */
export function selectiveMod(target, { covered = false } = {}) {
  if (target !== "rider") return SELECTIVE_MODS.mount;
  return covered ? SELECTIVE_MODS.riderCovered : SELECTIVE_MODS.rider;
}

// ── Выпадение из седла ────────────────────────────────────────────────────

/**
 * Урон при выпадении (стр. 477). На спокойном ходу это 1d10 «как от падения»,
 * на Натиске — как с высоты ½ SPD, на Бегу — с высоты SPD; полёт добавляет к
 * расчётной высоте 2 м.
 * @returns {{height:number, formula:string, prone:boolean, note:string}}
 */
export function fallFromSaddle(speedKey, mount, { traits = null } = {}) {
  const t = traits ?? mountTraits(mount);
  const spd = mountSpd(mount);
  const share = MOUNT_SPEEDS[speedKey]?.fall ?? 0;
  const airborne = isAirborne(mount, t);

  let height = share ? Math.floor(spd * share) : 0;
  if (airborne) height += 2;

  return {
    height,
    // Без разгона книга даёт ровно 1d10, а не расчёт по высоте.
    formula: height > 0 ? `${Math.max(1, Math.ceil(height / 2))}d10` : "1d10",
    prone: true,
    note: airborne ? "Полёт: +2 м к расчётной высоте (с Низкой и Высокой — по правилам полёта)." : ""
  };
}

/** SPD скакуна: у техники он в ходовой части, у существа — в перемещении. */
export function mountSpd(mount) {
  if (isBike(mount)) return num(mount?.system?.chassis?.spd);
  return num(mount?.system?.movement?.halfMove) || num(mount?.system?.spd);
}

/**
 * Поправка теста Acrobatics на удержание в седле, когда скакун получил
 * Критический Эффект, сбит с ног, умер или (с Чертой Unruly) просто получил
 * непоглощённый урон.
 */
export function acrobaticsStayMod(speedKey) {
  return MOUNT_SPEEDS[speedKey]?.stay ?? 0;
}

// ── Одержимость (стр. 478) ────────────────────────────────────────────────

/**
 * Демонические свойства этого скакуна, которые система считает сама. Кладёт их
 * туда ритуал осквернения (constants/mount-possession.mjs, possessionFlags);
 * свойства, которые ведёт стол, во флаг не попадают вовсе.
 */
export function possessionOf(mount) {
  return mount?.flags?.["warhammer-dbc"]?.mountPossession ?? null;
}

/** Одержим ли скакун: от этого зависит и очередь хода, и часть штрафов. */
export function isPossessed(mount) {
  return !!possessionOf(mount)?.demonWb;
}

/**
 * Бонус на тесты «не выпасть из седла» от демонического свойства «Сращивание»
 * (+5×W.b демона).
 */
export function spliceBonus(mount) {
  const wb = num(possessionOf(mount)?.spliceWb);
  return wb ? wb * 5 : 0;
}

// ── Руки и действия ───────────────────────────────────────────────────────

/**
 * Занимает ли управление руку (стр. 477). Не занимает при MIU, телепатической
 * связи, у подчинённого демонического скакуна, с Чертой Stand, а с Чертой
 * War-Trained — на любой скорости, кроме Натиска и Бега.
 * @returns {{hands:number, reason:string}}
 */
export function handsNeeded(speedKey, mount, { traits = null, linked = false } = {}) {
  const t = traits ?? mountTraits(mount);
  if (linked)         return { hands: 0, reason: "Связь MIU / телепатия / подчинённый демон" };
  if ("stand" in t)   return { hands: 0, reason: "Стойка" };
  if ("warTrained" in t && speedKey !== "charge" && speedKey !== "run")
    return { hands: 0, reason: "Боевая Тренировка (кроме Натиска и Бега)" };
  return { hands: 1, reason: "Повод или руль" };
}

/**
 * Бонусное верховое полудействие: его получает только тот, кто своим скакуном
 * ВЛАДЕЕТ, и потратить его можно лишь на движение скакуна.
 */
export function bonusHalfAction(rider, mount, traits = null) {
  return !riderControl(rider, mount, traits).combined;
}

// ── Связь всадника и скакуна ──────────────────────────────────────────────

/** Акторы, которые едут на этом скакуне (ссылку хранит всадник). */
export function ridersOf(mount, actors = []) {
  if (!mount?.uuid) return [];
  return [...actors].filter(a => a?.system?.mount?.uuid === mount.uuid);
}

/**
 * Пара «всадник + скакун» по любой её половине. Нужна тому, кто целится: в
 * прицел попадает один токен, а книга делит попадания между двумя телами, и
 * какое из них выбрано — всадник или скакун — решает штраф.
 *
 * `mountUuid` у пассажира указывает на того же скакуна, поэтому всадником
 * считается тот, у кого роль не «пассажир»: иначе выцеливание «во всадника»
 * могло бы назвать всадником седока за спиной.
 * @returns {?{rider:object, mount:object, targetIs:"rider"|"mount"}}
 */
export function mountPairFor(actor, actors = []) {
  if (!actor) return null;

  const ridden = actor.system?.mount?.uuid;
  if (ridden) {
    const mount = [...actors].find(a => a?.uuid === ridden);
    return mount ? { rider: actor, mount, targetIs: "rider" } : null;
  }

  const riders = ridersOf(actor, actors);
  if (!riders.length) return null;
  const rider = riders.find(r => r?.system?.mount?.role !== "passenger") ?? riders[0];
  return { rider, mount: actor, targetIs: "mount" };
}

/** Сколько пассажиров за спиной — они и дают штраф маневрирования. */
export function passengerCount(mount, actors = []) {
  return ridersOf(mount, actors).filter(a => a?.system?.mount?.role === "passenger").length;
}

/**
 * Может ли этот скакун нести этого седока по Размеру: седок должен быть хотя
 * бы на 1 Размер меньше (стр. 477).
 */
export function sizeFits(rider, mount) {
  const riderSize = num(rider?.system?.sizeTotal ?? rider?.system?.size);
  const mountSize = num(mount?.system?.sizeTotal ?? mount?.system?.size);
  return riderSize <= mountSize - 1;
}

/**
 * Инициатива пары. По умолчанию всадник действует в свой черёд, а атаки
 * скакуна не используются; «в ритм скакуна» (`sync`) — оба ходят в наименьшую
 * инициативу обоих, зато скакун тратит свои действия, бьёт и реагирует сам.
 * Талант «Чувство Скакуна» и одержимость демоном сводят пару к инициативе
 * всадника.
 * @returns {{value:number, mode:string, label:string}}
 */
export function pairInitiative(rider, mount, { sync = false, possessed = false } = {}) {
  const ri = num(rider?.system?.initiative);
  const mi = num(mount?.system?.initiative);

  if (possessed) return { value: ri, mode: "rider", label: "Одержимый — в Инициативу всадника" };
  if (!sync)     return { value: ri, mode: "rider", label: "Всадник действует в свой черёд" };
  if (hasTalent(rider, "Mount Sense", "Чувство Скакуна"))
    return { value: ri, mode: "rider", label: "Чувство Скакуна — в Инициативу всадника" };

  return { value: Math.min(ri, mi), mode: "sync", label: "В ритм скакуна — наименьшая из двух" };
}

// ── Ремонт байка (стр. 478) ───────────────────────────────────────────────
//  Смена работы плюс тест Tech-Use: −20 обычному байку, −40 сломанному, и
//  каждый Успех возвращает 1 Структуры. Провал ремонта СЛОМАННОГО байка —
//  остов на лом. Подходящие детали дают +40 сверх бонусов инструментов.
export const BIKE_REPAIR = {
  damaged: { mod: -20, perSuccess: 1, label: "Восстановление Структуры" },
  broken:  { mod: -40, perSuccess: 1, label: "Восстановление сломанного", failScraps: true },
  partsBonus: 40
};

/** Сломан ли байк: Структура ниже нуля — сразу поломка, без Крит. Эффектов. */
export function isBroken(mount) {
  if (!isBike(mount)) return false;
  return num(mount?.system?.structure?.value) <= 0 && num(mount?.system?.structure?.critical) > 0;
}

/** Полон ли запас: от этого зависит Аблативное Бронирование. */
export function atFullHealth(mount) {
  if (isBike(mount)) {
    const s = mount?.system?.structure ?? {};
    return num(s.max) > 0 && num(s.value) >= num(s.max);
  }
  const w = mount?.system?.wounds ?? {};
  return num(w.max) > 0 && num(w.value) >= num(w.max);
}

/**
 * Урон по скакуну после Аблативного Бронирования: пока запас полон, любой
 * непоглощённый урон срезается до 1.
 */
export function ablativeDamage(damage, mount, traits = null) {
  const t = traits ?? mountTraits(mount);
  if (!("ablativePlating" in t) || !atFullHealth(mount)) return num(damage);
  return num(damage) > 0 ? 1 : 0;
}
