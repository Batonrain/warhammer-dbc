// module/rules/limb-loss.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Потеря Конечностей (стр. 30-31, «Потеря конечностей всегда приводит к
//  Кровотечению. Обрубок конечности нуждается в медицинской обработке
//  (Medicae−10, 5 минут), иначе через T.b дней с шансом 80% (1-8 на 1d10)
//  он загноится и вызовет Гангрену») — wdbc-1rno.6.
//
//  С wdbc-x1nz.2.100 (решение владельца, 24.09.2026) потеря хранится ПО
//  СТОРОНАМ: system.lostLimbs.{rightHand,leftHand,rightArm,…,leftEye} =
//  { lost, gangreneAt } — игрок знает, какую руку заменять бионикой и в
//  какой руке не удержать оружие. Состояния lostHands/lostArms/lostFeet/
//  lostLegs/lostEyes и их *Count остаются для всех читателей (руки, SPD,
//  Уклонение, BS, Ослепление), но теперь ПРОИЗВОДНЫЕ: считаются из сторон
//  (rules/character.mjs), а писатели идут через lostCountFields /
//  lostSideFields этого модуля (единая точка — sheets/tabs/conditions.mjs).
//
//  Таймер Гангрены обрубка — у каждой стороны свой: T.b ДНЕЙ, снимается
//  явной обработкой обрубка ДО срабатывания. Мутация Loss of Limb
//  (wdbc-1rno.6.1) этот таймер заводить не должна — её обрубок книга
//  описывает уже закрытым.
//
//  Чистый модуль: читает переданный system, возвращает патчи actor.update.
// ════════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_DAY } from "../constants/imperial-calendar.mjs";

/** Ключи Состояний потери частей тела (constants/conditions.mjs). */
export const LIMB_LOSS_KEYS = ["lostHands", "lostArms", "lostFeet", "lostLegs", "lostEyes"];

/** Состояние → часть тела в ключе стороны (rightHand, leftEye…). */
const LIMB_PART = { lostHands: "Hand", lostArms: "Arm", lostFeet: "Foot", lostLegs: "Leg", lostEyes: "Eye" };

/** Стороны тела. Порядок — порядок заполнения «первой свободной». */
export const BODY_SIDES = ["right", "left"];
export const BODY_SIDE_LABELS = { right: "правая", left: "левая" };
export const BODY_SIDE_SHORT = { right: "П.", left: "Л." };

/** Ключ стороны в system.lostLimbs: ("lostArms", "left") → "leftArm". */
export function lostSideKey(key, side) {
  return LIMB_PART[key] && BODY_SIDES.includes(side) ? `${side}${LIMB_PART[key]}` : null;
}

/** Все десять ключей system.lostLimbs — для схемы. */
export const LOST_SIDE_KEYS = LIMB_LOSS_KEYS.flatMap(key => BODY_SIDES.map(side => lostSideKey(key, side)));

const path = (sideKey, field) => `system.lostLimbs.${sideKey}.${field}`;
const entryOf = (system, key, side) => system?.lostLimbs?.[lostSideKey(key, side)] ?? {};

/** Стороны, где эта часть тела потеряна. */
export function lostSides(system, key) {
  return BODY_SIDES.filter(side => !!entryOf(system, key, side).lost);
}

/** Сколько потеряно (0-2) — то, что раньше хранилось в *Count. */
export function lostCount(system, key) {
  return lostSides(system, key).length;
}

/** Потеряна ли часть тела именно на этой стороне. */
export function isLostOn(system, key, side) {
  return !!entryOf(system, key, side).lost;
}

/**
 * Сторона руки/ноги из места попадания карточки урона или конечности
 * Бесполезности: «rightArm»/«leftLeg» → «right»/«left»; прочее — "".
 */
export function sideOfLimb(limbKey) {
  const m = /^(right|left)/.exec(String(limbKey ?? ""));
  return m ? m[1] : "";
}

/** Момент (worldTime) проверки Гангрены обрубка — T.b дней от сейчас. */
export function limbLossGangreneCheckAt(worldTime, tb) {
  return Number(worldTime) + (Number(tb) || 0) * SECONDS_PER_DAY;
}

/**
 * Потерять/вернуть часть тела на стороне.
 * lost:true + timer — завести таймер Гангрены этого обрубка (крит, ручная
 * постановка); без timer — обрубок закрыт (ампутация сама решает Гангрену).
 * lost:false — вернуть (пришита, бионика): таймер гасится.
 */
export function lostSideFields(key, side, { lost = true, timer = false, worldTime = 0, tb = 0 } = {}) {
  const sideKey = lostSideKey(key, side);
  if (!sideKey) return {};
  return {
    [path(sideKey, "lost")]: !!lost,
    [path(sideKey, "gangreneAt")]: lost && timer ? limbLossGangreneCheckAt(worldTime, tb) : 0,
    // Новая потеря не от мутации — снимает её пометку (гейт Best.Q, wdbc-1rno.6.1).
    [path(sideKey, "mutation")]: false
  };
}

/**
 * Какую сторону взять: указанную (если она подходит под `lost`), иначе
 * первую подходящую по порядку BODY_SIDES. lost:true — ищем ещё целую,
 * lost:false — уже потерянную (снимать — с последней). null — нечего.
 */
export function pickLostSide(system, key, preferred = "", { lost = true } = {}) {
  const fits = side => isLostOn(system, key, side) !== lost;
  if (BODY_SIDES.includes(preferred) && fits(preferred)) return preferred;
  const order = lost ? BODY_SIDES : [...BODY_SIDES].reverse();
  return order.find(fits) ?? null;
}

/**
 * Довести число потерь до target (0-2) — путь тех писателей, что знают
 * только число (диалог «Добавить состояние», строка уровня на листе, иконка
 * токена, общее ±N). Новые потери встают на первые целые стороны, снятие —
 * с последней потерянной. Таймер Гангрены — только новым обрубкам, и только
 * если timer.
 */
export function lostCountFields(system, key, target, opts = {}) {
  if (!LIMB_PART[key]) return {};
  const want = Math.max(0, Math.min(BODY_SIDES.length, Number(target) || 0));
  const fields = {};
  let have = lostCount(system, key);
  const sim = structuredClone(system?.lostLimbs ?? {});
  const simSys = { lostLimbs: sim };
  while (have < want) {
    const side = pickLostSide(simSys, key, "", { lost: true });
    Object.assign(fields, lostSideFields(key, side, { ...opts, lost: true }));
    sim[lostSideKey(key, side)] = { lost: true };
    have++;
  }
  while (have > want) {
    const side = pickLostSide(simSys, key, "", { lost: false });
    Object.assign(fields, lostSideFields(key, side, { lost: false }));
    sim[lostSideKey(key, side)] = { lost: false };
    have--;
  }
  return fields;
}

/** Патч «обрубок обработан» — таймер этой стороны снят. */
export function clearStumpTimerFields(key, side) {
  const sideKey = lostSideKey(key, side);
  return sideKey ? { [path(sideKey, "gangreneAt")]: 0 } : {};
}

/** Стороны, у которых обрубок ещё ждёт обработки (таймер идёт). */
export function stumpSidesWithTimer(system, key) {
  return lostSides(system, key).filter(side => Number(entryOf(system, key, side).gangreneAt) > 0);
}

/**
 * Какие таймеры обрубков СЕЙЧАС просрочены: [{ key, side }]. Бросок и
 * наложение Гангрены делает вызывающий Foundry-слой (combat/limb-loss.mjs).
 */
export function dueLimbLossGangreneSides(system, worldTime) {
  const due = [];
  for (const key of LIMB_LOSS_KEYS) {
    for (const side of BODY_SIDES) {
      const e = entryOf(system, key, side);
      const at = Number(e.gangreneAt) || 0;
      if (e.lost && at > 0 && Number(worldTime) >= at) due.push({ key, side });
    }
  }
  return due;
}

/**
 * Производные Состояния из сторон — для rules/character.mjs: флаг и *Count
 * каждого lostX, как их всегда читали руки/SPD/Уклонение/BS.
 */
export function derivedLimbLossConditions(system) {
  const out = {};
  for (const key of LIMB_LOSS_KEYS) {
    const n = lostCount(system, key);
    out[key] = n > 0;
    out[`${key}Count`] = n;
  }
  return out;
}

/**
 * Стороны из прежнего хранения (до wdbc-x1nz.2.100): conditions.lostX —
 * флаг, lostXCount — сколько (0-2), lostXGangreneAt — один таймер на все
 * обрубки. Только для ключей, которые в conditions вообще записаны:
 * { lostArms: { rightArm: {...}, leftArm: {...} } }. Стороны — по порядку
 * BODY_SIDES, как у lostCountFields: какая именно, прежде не хранилось.
 */
export function legacyLimbLossSides(conditions) {
  const out = {};
  for (const key of LIMB_LOSS_KEYS) {
    if (conditions?.[key] === undefined && conditions?.[`${key}Count`] === undefined) continue;
    const n = conditions[key] ? Math.min(BODY_SIDES.length, Math.max(1, Number(conditions[`${key}Count`]) || 0)) : 0;
    const gangreneAt = Number(conditions[`${key}GangreneAt`]) || 0;
    out[key] = Object.fromEntries(BODY_SIDES.map((side, i) => [lostSideKey(key, side),
      { lost: i < n, gangreneAt: i < n ? gangreneAt : 0, mutation: false }]));
  }
  return out;
}

/**
 * migrateData существа: старая потеря переезжает в system.lostLimbs, пока
 * у документа своего lostLimbs нет. Схема старые поля вычищает, так что без
 * этого у покалеченных персонажей конечности «отрастали» (приёмка #518-#526).
 * Записанный lostLimbs главнее: после первой записи старые поля — мусор.
 */
export function migrateLegacyLimbLoss(source) {
  if (!source?.conditions || source.lostLimbs !== undefined) return source;
  const sides = Object.values(legacyLimbLossSides(source.conditions)).filter(s => Object.values(s).some(e => e.lost));
  if (sides.length) source.lostLimbs = Object.assign({}, ...sides);
  return source;
}

/** «П. и Л.», «Л.» — подпись сторон для карточек и подсказок. */
export function lostSidesLabel(system, key) {
  return lostSides(system, key).map(s => BODY_SIDE_SHORT[s]).join(" и ");
}

// ── Мутация Loss of Limb / Потеря Конечности (wdbc-1rno.6.1) ────────────────
// «Боги наказывают персонажа, отнимая его конечность или её часть, которые
// исчезают, оставляя за собой обрубок плоти, словно давно затянувшаяся рана.
// Персонаж может восстановить потерянные от этой мутации части тела только
// Best.Q бионикой». Решения владельца (17.09 и 24.09.2026):
//   • ни таймера Гангрены, ни Кровотечения — обрубок уже закрыт;
//   • «Пальцы» — не потеря кисти: рука держит оружие, но атаки оружием в
//     этой руке получают −10 (sheets/attack/mods.mjs);
//   • Best.Q-гейт бионики — только для частей тела, потерянных от ЭТОЙ
//     мутации (пометка mutation:true у стороны в system.lostLimbs).

/** Стороны «пальцев» — отдельные ключи system.lostLimbs, без Состояния. */
export const FINGER_SIDE_KEYS = BODY_SIDES.map(side => `${side}Fingers`);

/** Строка субмутации (d10) → что теряется: { key|fingers, side }. */
export const LOSS_OF_LIMB_SUBMUTATIONS = {
  1: { fingers: true, side: "right" }, 2: { key: "lostHands", side: "right" },
  3: { key: "lostArms", side: "right" }, 4: { key: "lostLegs", side: "right" },
  5: { key: "lostFeet", side: "right" }, 6: { fingers: true, side: "left" },
  7: { key: "lostHands", side: "left" }, 8: { key: "lostArms", side: "left" },
  9: { key: "lostLegs", side: "left" }, 10: { key: "lostFeet", side: "left" }
};

/** Цель мутации по подписи выпавшей строки («3», «10») или null. */
export function lossOfLimbTarget(label) {
  const n = parseInt(String(label ?? "").trim(), 10);
  return LOSS_OF_LIMB_SUBMUTATIONS[n] ?? null;
}

/** Ключ system.lostLimbs для цели мутации: «rightFingers» / «leftArm»… */
export function lossOfLimbSideKey(target) {
  if (!target) return null;
  return target.fingers ? `${target.side}Fingers` : lostSideKey(target.key, target.side);
}

/** Патч: потеряно/возвращено мутацией — без таймера, с пометкой mutation. */
export function mutationLossFields(target, lost = true) {
  const sideKey = lossOfLimbSideKey(target);
  if (!sideKey) return {};
  return {
    [`system.lostLimbs.${sideKey}.lost`]: !!lost,
    [`system.lostLimbs.${sideKey}.gangreneAt`]: 0,
    [`system.lostLimbs.${sideKey}.mutation`]: !!lost
  };
}

/** Нет пальцев на этой руке (мутация, субмутации 1/6). */
export function fingersLostOn(system, side) {
  return !!system?.lostLimbs?.[`${side}Fingers`]?.lost;
}

/** Потеряна ли часть тела на стороне именно мутацией (гейт Best.Q бионики). */
export function lostByMutation(system, key, side) {
  return !!system?.lostLimbs?.[lostSideKey(key, side)]?.mutation;
}
