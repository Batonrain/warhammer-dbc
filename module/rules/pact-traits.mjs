// module/rules/pact-traits.mjs
// ════════════════════════════════════════════════════════════════════════
//  Оставшиеся Черты Пакта: Защита Пакта (Вампир, Когитор, Ревенант,
//  Мейстер), Испивающий Души (Вампир), Каменное Сердце (Когитор).
//  Чистая часть; кнопки — combat/pact-traits.mjs.
//
//  • Защита Пакта — телепатия по носителю «читает» ложь демона: строка-
//    карточка в гейте Теста Сопротивления (hooks.mjs) для любой силы
//    Телепатии по цели с Чертой.
//  • Испивающий Души — +½W.b (окр.▲) жертвы Жажды и выбор одного эффекта.
//  • Каменное Сердце — иммунитет к варп-оружию (запись «Возможность»
//    damageImmunity.warpWeapon); попадание в сердце — Избирательная −40.
// ════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

export const hasPactProtection = a => hasItemNamed(a, "Pact Protection", ["trait"]);
export const hasSoulDrinker = a => hasItemNamed(a, "Soul Drinker", ["trait"]);
export const hasHeartOfStone = a => hasItemNamed(a, "Heart of Stone", ["trait"]);

export const SOUL_DRUNK_FLAG = "soulDrunkBy";
export const HEART_SHOT_PENALTY = -40;

/** Строка Защиты Пакта для силы Телепатии по цели или "". */
export function pactProtectionNote(target, discipline) {
  if (String(discipline || "").trim().toLowerCase() !== "telepathy" || !hasPactProtection(target)) return "";
  return "Защита Пакта: разум цели прикрыт демоном-покровителем — телепатия «читает» мысли и эмоции, но получает ложь, которую создаёт демон (ГМ отвечает за него).";
}

/** Испивающий Души: числа по W.b жертвы. */
export function soulDrinkerGains(victimWpBonus) {
  const wb = Math.max(0, Math.trunc(Number(victimWpBonus) || 0));
  return { thirst: Math.ceil(wb / 2), heal: 2 * wb, charHeal: 4 * wb, traits: wb };
}

/** Испивающий Души: эффекты на выбор. */
export const SOUL_DRINKER_OPTIONS = [
  { key: "heal", label: "Восстановить до 2×W.b жертвы Ран" },
  { key: "chars", label: "Восстановить до 4×W.b жертвы урона Характеристик" },
  { key: "crits", label: "Снять с себя все Критические Эффекты и Усталость" },
  { key: "youth", label: "Омолодиться (до половины разницы в возрасте с более молодой жертвой)" },
  { key: "looks", label: "Перенять до W.b черт внешности, голос или манеры жертвы" },
  { key: "memories", label: "Украсть до W.b воспоминаний (или обоснований выучить Навык/Талант/силу жертвы)" }
];
