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
  berserkCharge: { key: "berserker.core.berserkCharge", name: "Berserk Charge" }
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
