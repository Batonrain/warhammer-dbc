// module/rules/pugilist-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ ПУГИЛИСТА (глава 3, группа «Пугилист», стр. 62) — чистая логика
//  (задача Sahara 3-eddb; решения владельца 24.10.2026).
//
//    Thunder Charge / Громовой Натиск  — Напролом всегда сбивает с ног (combat/bulldoze.mjs)
//    Unarmed Master / Безоружный Мастер — вооружён безоружным: без Primitive, Парирование
//                                         голыми руками без −20, Захват не Парируется, Баланс кулаков +1
//    Whack / Затрещина                 — −30 на Избегания «не видевшего» приём (combat/whack.mjs)
//
//  Талант опознаётся по имени предмета ИЛИ по записи Конструктора
//  kind:"capability" с ключом (персонаж, купивший Талант до появления записи в
//  паке, ключа не несёт) — тем же приёмом, что rules/resilience-talents.mjs.
//  Файл НЕ импортирует hasAbility/hasRuleFlag: те тянут collect.mjs →
//  sources.mjs (круг, AGENTS.md → «Источники правил»).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const NS = "warhammer-dbc";

/** Короткий ключ → { ключ Возможности, имя Таланта }. */
export const PUGILIST_TALENTS = {
  roundhouseKick: { key: "pugilist.core.roundhouseKick", name: "Roundhouse Kick" },
  chokehold:     { key: "pugilist.core.chokehold",     name: "Chokehold" },
  pinDown:       { key: "pugilist.core.pinDown",       name: "Pin Down" },
  pounce:        { key: "pugilist.core.pounce",        name: "Pounce" },
  slam:          { key: "pugilist.core.slam",          name: "Slam" },
  wrestler:      { key: "pugilist.core.wrestler",      name: "Wrestler" },
  headcracker:   { key: "pugilist.core.headcracker",   name: "Headcracker" },
  rollingWithPunches: { key: "pugilist.core.rollingWithPunches", name: "Rolling With Punches" },
  flyingKick:    { key: "pugilist.core.flyingKick",    name: "Flying Kick" },
  jockey:        { key: "pugilist.core.jockey",        name: "Jockey" },
  thunderCharge: { key: "pugilist.core.thunderCharge", name: "Thunder Charge" },
  unarmedMaster: { key: "pugilist.core.unarmedMaster", name: "Unarmed Master" },
  whack:         { key: "pugilist.core.whack",         name: "Whack" },
  haymaker:      { key: "pugilist.core.haymaker",      name: "Haymaker" },
  goadingStrike: { key: "pugilist.core.goadingStrike", name: "Goading Strike" },
  kneeStrike:    { key: "pugilist.core.kneeStrike",    name: "Knee Strike" }
};

/** Несёт ли актор запись Конструктора kind:"capability" с этим ключом (общий помощник Талантов по имени ИЛИ ключу). */
export function holdsCapability(actor, key) {
  if (!key) return false;
  for (const item of actor?.items ?? []) {
    const groups = item?.flags?.[NS]?.mechanics;
    if (!Array.isArray(groups)) continue;
    for (const g of groups) {
      for (const e of g?.entries ?? []) {
        if (e?.kind === "capability" && e.capabilityKey === key) return true;
      }
    }
  }
  return false;
}

/** Есть ли у актора этот Талант Пугилиста (по имени предмета ИЛИ по ключу Возможности). */
export function hasPugilistTalent(actor, id) {
  const t = PUGILIST_TALENTS[id];
  if (!t) return false;
  const items = actor?.items;
  if (items?.some?.(i => i?.type === "talent" && itemHasName(i, t.name))) return true;
  return holdsCapability(actor, t.key);
}

// ── Головолом ───────────────────────────────────────────────────────────────

/**
 * Удар головой — безоружная (интегральная) атака с Хватом «Гол», но НЕ рогами
 * («безоружный удар головой (не рогами)»).
 */
export function isHeadbutt(weapon) {
  if (!weapon?.getFlag?.(NS, "integralAttack")) return false;
  if (!/Гол/.test(String(weapon.system?.grips ?? ""))) return false;
  return !/Рог|Horn/i.test(String(weapon.name ?? ""));
}

/**
 * «Он уменьшает штраф на Избирательные атаки в голову на 20» — скидка к штрафу
 * Избирательной атаки в голову (окно атаки: sheets/attack-dialog.mjs, aimTargets;
 * та же скидка у Локуса Подношения — penalty.calledShot.head.reduce20).
 * @returns {number} 20 или 0
 */
export function headcrackerHeadReduction(actor, weapon) {
  return isHeadbutt(weapon) && hasPugilistTalent(actor, "headcracker") ? 20 : 0;
}

/**
 * Штраф Избирательной атаки в голову: базовый −20 минус все скидки, но не
 * выше 0 (скидка не превращается в бонус).
 */
export function headCalledShotPenalty(reductions) {
  return Math.min(0, -20 + (Number(reductions) || 0));
}

// ── Прижать ─────────────────────────────────────────────────────────────────

/** Флаг на ПРИЖИМАЮЩЕМ: величина штрафа цели (0 допустим). Снимается в начале его следующего Хода (turn-flags.mjs). */
export const PIN_DOWN_FLAG = "pinDownHold";

/**
 * «(<T.b + Размер×3 персонажа> − <T.b + Размер×3 цели>) × 5 (минимум 0)» —
 * штраф цели на все физические действия.
 */
export function pinDownPenaltyValue(pinner, target) {
  const mass = a => (Number(a?.system?.characteristics?.t?.bonus) || 0)
    + 3 * (Number(a?.system?.sizeTotal ?? a?.system?.size) || 0);
  return Math.max(0, (mass(pinner) - mass(target)) * 5);
}

/** Величина удержания на прижимающем (undefined — не прижимает). */
export function pinDownHoldOf(actor) {
  const v = actor?.getFlag?.(NS, PIN_DOWN_FLAG) ?? actor?.flags?.[NS]?.[PIN_DOWN_FLAG];
  return v === undefined || v === null ? undefined : Number(v) || 0;
}

// ── Скользить за Ударами ────────────────────────────────────────────────────

/**
 * «Он увеличивает свое поглощение против безоружных атак на +½A.b, если он не
 * Оглушен, Беспомощен, или атака не Незрима.» Округление книга не называет —
 * вверх (▲), как в соседних «½I.b (окр.▲)». «Незримая» атака в данные урона не
 * доезжает и здесь не проверяется (см. отчёт 3-eddb).
 * @param {object} actor    получающий урон
 * @param {boolean} unarmed атака безоружная (интегральное оружие нападающего)
 */
export function rollingWithPunchesBonus(actor, unarmed) {
  if (!unarmed || !hasPugilistTalent(actor, "rollingWithPunches")) return 0;
  const c = actor?.system?.conditions ?? {};
  if (c.stunned || c.helpless || c.unconscious) return 0;
  const ab = Number(actor?.system?.characteristics?.ag?.bonus) || 0;
  return Math.max(0, Math.ceil(ab / 2));
}

// ── Пинок с Полёта ──────────────────────────────────────────────────────────

/** Высоты полёта, на которых персонаж «в воздухе» (system.movement.altitude). */
const AIRBORNE = new Set(["low", "high"]);

/**
 * «В Раунд, когда он совершает Натиск в полёте» — Талант, База «Натиск»
 * (system.meleeBase, персистентна на акторе) и высота low/high. «Дерётся в
 * воздухе с другим летающим персонажем» отдельно не определяется: у такого
 * бойца высота и так low/high, а База выбирается игроком.
 */
export function flyingKickActive(actor) {
  if (!hasPugilistTalent(actor, "flyingKick")) return false;
  if (String(actor?.system?.meleeBase ?? "standard") !== "charge") return false;
  return AIRBORNE.has(String(actor?.system?.movement?.altitude ?? "landed"));
}

/**
 * Число ног: две; Четвероногий (Quadruped) — четыре. Книга: «Если персонаж
 * имеет больше (или меньше), чем две ноги, бонус Трейта меняется» — других
 * сведений о числе ног в данных нет.
 */
export function flyingKickLegs(actor) {
  const quadruped = (actor?.items ?? []).some?.(i => i?.type === "trait" && itemHasName(i, "Quadruped"));
  return quadruped ? 4 : 2;
}

/** «Multiple Arms (+N)» — прибавка к бюджету рук (rules/hands.mjs::maxHands). */
export function flyingKickHandsBonus(actor) {
  return flyingKickActive(actor) ? flyingKickLegs(actor) : 0;
}

/**
 * «Дополнительная атака за каждую пару рук» (Трейт Multiple Arms): +1 к
 * Лимиту Атак за Ход на каждую добавленную пару (combat/attack-limit.mjs).
 * ПРИБЛИЖЕНИЕ: книга делает её частью ОДНОГО действия, а лимит считает Атаки
 * целыми кликами «Бросок!» — вторая атака стоит своё ОД.
 */
export function flyingKickAttackBonus(actor) {
  return Math.floor(flyingKickHandsBonus(actor) / 2);
}

// ── Безоружный Мастер ───────────────────────────────────────────────────────

/**
 * «оружие-кулаки с Балансом ниже 0 получает +1 к Балансу». Кулаки — рукопашное
 * оружие категории «Кулаки» (в том числе Кулак.Б); Пинок, Удар головой и
 * естественное оружие кулаками не считаются. Возвращает прибавку (0 или 1).
 * Читают Парирование (combat/defense.mjs), окно атаки (минимальный Баланс
 * Стоек/Приёмов) и строка оружия на листе.
 */
export function fistBalanceBonus(actor, weapon) {
  if (!weapon || String(weapon.system?.meleeCategory ?? "") !== "Кулаки") return 0;
  // Щупальца в паке тоже «Кулаки», но кулаками не являются.
  if (/Щуп/.test(String(weapon.system?.grips ?? ""))) return 0;
  if ((Number.parseInt(weapon.system?.balance ?? 0, 10) || 0) >= 0) return 0;
  return hasPugilistTalent(actor, "unarmedMaster") ? 1 : 0;
}

/**
 * «Безоружные атаки теряют свойство Primitive»: безоружная атака — интегральная
 * (Кулак, Пинок, Удар головой, естественное оружие; combat/unarmed-combat.mjs::
 * isUnarmedWeapon — тот же признак).
 */
export function unarmedLosesPrimitive(actor, weapon) {
  return !!weapon?.getFlag?.(NS, "integralAttack") && hasPugilistTalent(actor, "unarmedMaster");
}

// ── Борец ───────────────────────────────────────────────────────────────────

/**
 * Борец (стр. 62): «Противники, пытающиеся Уклониться от его Захвата, должны
 * перебрасывать успешные броски на Уклонение.» Режим навязанного переброса для
 * кнопки Уклонения в карточке атаки (data-force-reroll → defense.mjs::_performDodge):
 * "rerollSuccess" — успешный бросок перебрасывается, остаётся второй. Только
 * приём Захват; Парирование книга не называет. Пусто — Таланта/приёма нет.
 */
export function wrestlerDodgeReroll(actor, technique) {
  return technique === "grapple" && hasPugilistTalent(actor, "wrestler") ? "rerollSuccess" : "";
}

/** «его Захват нельзя Парировать»: приём Захват у мастера. */
export function grappleUnparryable(actor, technique) {
  return technique === "grapple" && hasPugilistTalent(actor, "unarmedMaster");
}

// ── Кулак: Тяжёлый Хук и Направляющий Удар ───────────────────────────────────

/**
 * «Атака кулаком» — рукопашное оружие категории «Кулаки» (Кулак, Латная Перчатка и т.п.). Щупальца в паке тоже
 * «Кулаки» по категории, но кулаками не являются (тот же отсев, что у fistBalanceBonus).
 */
export function isFistWeapon(weapon) {
  if (!weapon || String(weapon.system?.meleeCategory ?? "") !== "Кулаки") return false;
  return !/Щуп/.test(String(weapon.system?.grips ?? ""));
}

/** Метка Хода: носитель отказался от атаки второй рукой (Тяжёлый Хук) — «в этот Ход». Гаснет с началом его следующего Хода. */
export const HAYMAKER_FORFEIT_FLAG = "haymakerHandForfeit";

/** Показывать ли галочку «Тяжёлый Хук»: Талант и атака кулаком. */
export function haymakerOffered(actor, weapon) {
  return isFistWeapon(weapon) && hasPugilistTalent(actor, "haymaker");
}

/**
 * Тяжёлый Хук / Haymaker (core.json, стр. 62): «Он может при совершении атаки кулаком (до броска на попадание)
 * выбрать отказаться от атаки еще одной рукой в этот Ход, чтобы дать этой атаке +½ T.b Dmg (окр. ▼)...»
 * replay — переброс той же атаки: отказ от руки уже заплачен, эффект остаётся.
 */
export function haymakerApplies(actor, { weapon, isMelee, toggles, replay = false }) {
  if (!isMelee || !haymakerOffered(actor, weapon)) return false;
  return replay || !!toggles?.haymaker;
}

/** +½T.b Dmg, округление вниз (книга: «окр. ▼»). */
export function haymakerDamageBonus(actor) {
  const tb = Math.max(0, Number(actor?.system?.characteristics?.t?.bonus) || 0);
  return Math.floor(tb / 2);
}

/**
 * «Отказаться от атаки еще одной рукой в этот Ход»: вторая рука здесь — «Обе руки» окна атаки
 * (sheets/attack/dialog.mjs, пара рук = одно действие). Хук вместе с «Обе руки» не выбирается, а после Хука в
 * этом Ходу «Обе руки» закрыты (метка HAYMAKER_FORFEIT_FLAG). Возвращает причину отказа или пустую строку.
 */
export function haymakerBlocksSecondHand(actor, { toggles, dual }) {
  if (!dual) return "";
  if (toggles?.haymaker && hasPugilistTalent(actor, "haymaker")) {
    return "Тяжёлый Хук и «Обе руки» одновременно не выбираются — Хук как раз отказ от второй руки";
  }
  const spent = actor?.getFlag?.(NS, HAYMAKER_FORFEIT_FLAG);
  if (spent) return "в этом Ходу персонаж отказался от атаки второй рукой (Тяжёлый Хук) — «Обе руки» недоступны";
  return "";
}

/** Штраф Направляющего Удара к атаке кулаком (книга: «штраф –20»). */
export const GOADING_STRIKE_PENALTY = -20;

/** Показывать ли галочку «Направляющий Удар»: Талант и атака кулаком. */
export function goadingStrikeOffered(actor, weapon) {
  return isFistWeapon(weapon) && hasPugilistTalent(actor, "goadingStrike");
}

/** Выбран ли Направляющий Удар для этой атаки (штраф и свободное Давление по Успеху). */
export function goadingStrikeApplies(actor, { weapon, isMelee, toggles }) {
  return !!isMelee && !!toggles?.goadingStrike && goadingStrikeOffered(actor, weapon);
}

/** Штраф к порогу атаки: −20, если Направляющий Удар выбран; иначе 0. */
export function goadingStrikePenalty(actor, ctx) {
  return goadingStrikeApplies(actor, ctx) ? GOADING_STRIKE_PENALTY : 0;
}

// ── Удар с Колена ───────────────────────────────────────────────────────────

/** Счётчик ударов ногой в этом Ходу («ногой, которой он еще не атаковал»); гаснет с началом Хода. */
export const LEG_ATTACKS_FLAG = "legAttacksThisTurn";

/** Сколько ног ещё не атаковали в этом Ходу: ног две (четыре у Четвероногого) минус уже сделанные удары ногой. */
export function legsFree(actor) {
  const used = Math.max(0, Number(actor?.getFlag?.(NS, LEG_ATTACKS_FLAG)) || 0);
  return Math.max(0, flyingKickLegs(actor) - used);
}

/** «Взял цель в Захват как минимум 2-мя руками». */
export function kneeStrikeHandsOk(hands) {
  return (Number(hands) || 0) >= 2;
}

/** Победа в тесте Захвата на столько Успехов даёт право бить в голову с Concussive (0). */
export const KNEE_STRIKE_HEAD_MARGIN = 5;

export function kneeStrikeHeadOffered(margin) {
  return (Number(margin) || 0) >= KNEE_STRIKE_HEAD_MARGIN;
}
