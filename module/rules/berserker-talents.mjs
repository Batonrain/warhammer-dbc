// module/rules/berserker-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ БЕРСЕРКА, завязанные на Базу рукопашной атаки (Sahara 3-861e).
//  Чистые функции: бросков, Foundry и листа здесь нет. Числа самой Ярости и
//  Талантов поверх неё (Раненный Зверь, Холодная Ярость) — rules/rage.mjs.
//
//  Натиск Берсерка / Berserk Charge (корбук, Таланты «Берсерк», pdf-стр. 62):
//  «Персонаж вкладывает весь момент своего движения в атаку. Он получает еще
//  +10 на рукопашные приемы при Натиске.» Натиск сам даёт +20 к приёму
//  (MELEE_BASES.charge), с Талантом — +30.
//
//  ── Почему не правило с условием `meleeBaseIs` ──
//
//  База рукопашной атаки выбирается ПРЯМО В ОКНЕ АТАКИ (sheets/attack/
//  selection.mjs::resolveSelection: sel.baseKey ?? system.meleeBase) и
//  записывается на актора только при броске. Правила (rules/resolve-test.mjs)
//  собираются один раз при открытии окна и видят лишь то, что уже лежит в
//  system.meleeBase: игрок, открывший окно на Стандартной Базе и переключивший
//  пилюлю на Натиск, не получил бы +10 — или наоборот. Поэтому добавка живёт
//  там же, где считается сам бонус Базы: функция meleeBaseBonus ниже.
//
//  Опознание Таланта — «имя ИЛИ ключ Возможности» (rules/ability-by-key.mjs):
//  персонаж, купивший Талант до записи Конструктора в паке, ключа не несёт
//  («ловушка Desiccated», тикет 3-861e).
//
//  Модуль НЕ импортируется из rules/sources.mjs и ничего не регистрирует —
//  круга через source-registry нет (AGENTS.md, «Источники правил»).
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";
import { MELEE_BASES } from "../constants/combat.mjs";

/** Ключи Возможностей (module/constants/capabilities.mjs) и имена Талантов. */
export const BERSERKER_TALENTS = Object.freeze({
  berserkCharge: { key: "berserker.core.berserkCharge", name: "Berserk Charge" },
  hammerBlow:    { key: "berserker.core.hammerBlow",    name: "Hammer Blow" },
  overpower:     { key: "berserker.core.overpower",     name: "Overpower" },
  killingStrike: { key: "berserker.core.killingStrike", name: "Killing Strike" },
  furiousAssault:{ key: "berserker.core.furiousAssault", name: "Furious Assault" },
  reprise:       { key: "berserker.core.reprise",       name: "Reprise" },
  vengeance:     { key: "berserker.core.vengeance",     name: "Vengeance" }
});

/** Есть ли у актора Талант Берсерка из списка выше (по имени или по ключу). */
export function hasBerserkerTalent(actor, id) {
  const t = BERSERKER_TALENTS[id];
  return !!t && hasAbility(actor, t.key, t.name, "talent");
}

/** Добавка Натиска Берсерка к рукопашному приёму при Натиске (книга: «еще +10»). */
export const BERSERK_CHARGE_BONUS = 10;

/**
 * Добавка Таланта к бонусу этой Базы: +10 только у Натиска. Ключ Базы сверяется
 * первым — функция зовётся на каждое оружие в списке листа, а вопрос про Талант
 * вне Натиска дорогой (hasRuleFlag собирает правила актора).
 */
export function berserkChargeBonus(actor, baseKey) {
  if (baseKey !== "charge") return 0;
  return hasBerserkerTalent(actor, "berserkCharge") ? BERSERK_CHARGE_BONUS : 0;
}

/**
 * Полный бонус Базы к приёму: число из книги (MELEE_BASES) плюс Таланты. Одна
 * функция на все места, где считается порог рукопашной атаки, чтобы окно
 * атаки, приём без оружия, «Замахнуться» и колонка «Порог» на листе не
 * расходились.
 */
export function meleeBaseBonus(actor, baseKey) {
  return (MELEE_BASES[baseKey]?.wsBonus ?? 0) + berserkChargeBonus(actor, baseKey);
}

/**
 * Пересилить / Overpower (core.json, pdf-стр. 62): «Совершая атаку с базой Полная Атака,
 * он может пройти тест на S+0 vs S+0 после успешного парирования этой атаки врагом,
 * чтобы проигнорировать это Парирование и все равно нанести попадание.»
 *
 * Предлагается на карточке успешного Парирования: у атаковавшего Талант и База его
 * атаки — Полная Атака (баз атаки берётся с карточки атаки, opts.baseKey).
 * Парировавший может сопротивляться тем же S+0; кто выиграл, решает общий встречный тест.
 */
export function overpowerOffered(attacker, { baseKey, parried }) {
  return !!parried && baseKey === "fullatk" && hasBerserkerTalent(attacker, "overpower");
}

/** Метка на акторе-жертве (ставит ГМ в меню «Настройки листа»): лидер или чемпион своего отряда/врагов. */
export const LEADER_OR_CHAMPION_FLAG = "leaderOrChampion";
/** Метка на акторе-жертве: лорд, чьё могущество сравнимо с убийцей или выше. */
export const LORD_MIGHT_FLAG = "lordMight";

const flagOf = (actor, key) => actor?.getFlag?.("warhammer-dbc", key) ?? actor?.flags?.["warhammer-dbc"]?.[key];

/**
 * Месть / Vengeance (core.json, pdf-стр. 62): «Убивая лидера или чемпиона Ненавистного врага в
 * рукопашной, он может восстановить 1 Очко Бесчестия. Если этот враг был лордом сравнимого или
 * выше могущества, чем сам персонаж, он восстанавливает 1d5 Очков Бесчестия.»
 *
 * Кто «лидер/чемпион» и «лорд» — решение ГМа: ни в одном поле актора книга этого не хранит,
 * поэтому ГМ ставит метки (LEADER_OR_CHAMPION_FLAG, LORD_MIGHT_FLAG). «Ненавистный» —
 * hatred.mjs (цели Таланта Ненависти) считает вызывающий и передаёт как `hated`.
 *
 * @returns {?{formula: string}} "1" или "1d5"; null — Месть не действует
 */
export function vengeanceReward(killer, victim, { melee, hated }) {
  if (!melee || !hated || !hasBerserkerTalent(killer, "vengeance")) return null;
  if (!flagOf(victim, LEADER_OR_CHAMPION_FLAG) && !flagOf(victim, LORD_MIGHT_FLAG)) return null;
  return { formula: flagOf(victim, LORD_MIGHT_FLAG) ? "1d5" : "1" };
}

/**
 * Яростный Штурм / Furious Assault (core.json, pdf-стр. 62): «После успешной атаки с базой
 * Полная Атака (даже если она была отменена Избеганием) персонаж может потратить Реакцию,
 * чтобы провести еще одну атаку с теми же базой и приемом за свободное действие.»
 *
 * Предложение на карточке атаки: рукопашная успешная (hit — бросок на попадание, не исход
 * Избегания: отменённая Избеганием атака остаётся успешной) Полная Атака носителя. Сама
 * дополнительная атака (furiousChild) новой не порождает — книга «еще одну», не цепочку.
 */
export function furiousAssaultOffered(actor, { isMelee, baseKey, hit, furiousChild }) {
  if (!isMelee || !hit || furiousChild || baseKey !== "fullatk") return false;
  return hasBerserkerTalent(actor, "furiousAssault");
}

/** Метка «Смертельный Удар использован в этом Ходу» (rules/turn-flags.mjs гасит её с началом следующего Хода). */
export const KILLING_STRIKE_FLAG = "killingStrikeThisTurn";

/**
 * Предлагать ли галочку в окне рукопашной атаки: Талант есть и в этом Ходу ещё не использован.
 * База выбирается в самом окне, поэтому галочка видна всегда; сработает она только на Полной Атаке.
 */
export function killingStrikeOffered(actor, { isMelee }) {
  if (!isMelee || !hasBerserkerTalent(actor, "killingStrike")) return false;
  return !actor?.getFlag?.("warhammer-dbc", KILLING_STRIKE_FLAG);
}

/**
 * Смертельный Удар / Killing Strike (core.json, pdf-стр. 62): «Совершая атаку с базой Полная
 * Атака, он может потратить Очко Бесчестия, чтобы любые тесты на Избегание от этой атаки
 * автоматически становились Провалами. Этот Талант можно использовать только один раз в Ход.»
 *
 * Сработает ли на этой атаке: галочка включена, База атаки — Полная Атака, Талант не
 * использован в этом Ходу. replay — переброс той же атаки (Очко уже заплачено, метка Хода
 * уже стоит): эффект сохраняется без повторной платы.
 */
export function killingStrikeApplies(actor, { isMelee, baseKey, toggles, replay = false }) {
  if (!toggles?.killingStrike || baseKey !== "fullatk") return false;
  if (replay) return !!isMelee && hasBerserkerTalent(actor, "killingStrike");
  return killingStrikeOffered(actor, { isMelee });
}

/** Рейтинг Concussive, который даёт Удар Молота. */
export const HAMMER_BLOW_CONCUSSIVE = 2;

/**
 * Удар Молота / Hammer Blow (core.json, pdf-стр. 62): «Совершая атаку с базой Полная
 * Атака, он добавляет +½WS.b (окр.▲) Pen и свойство Concussive (2) своему рукопашному
 * оружию.»
 *
 * Считается по Базе ЭТОЙ атаки (opts.baseKey броска, а не system.meleeBase): правила
 * собираются один раз при открытии окна, а База выбирается в нём же — см. шапку файла.
 * Свойство (если у оружия Concussive уже выше двух — оно не понижается) применяет
 * combat/attack.mjs до сборки списка свойств.
 *
 * @returns {{pen: number, concussive: number}} нули — Талант не действует
 */
export function hammerBlowEffect(actor, { isMelee, baseKey, wsBonus }) {
  const none = { pen: 0, concussive: 0 };
  if (!isMelee || baseKey !== "fullatk" || !hasBerserkerTalent(actor, "hammerBlow")) return none;
  return { pen: Math.ceil((Number(wsBonus) || 0) / 2), concussive: HAMMER_BLOW_CONCUSSIVE };
}
