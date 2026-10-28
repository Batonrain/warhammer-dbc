// module/apps/skillful-torture.mjs
// ════════════════════════════════════════════════════════════════════════
//  Skillful Torture / Искусная Пытка (Талант, packs-src/talents/Таланты_Боли/
//  Skillful_Torture___Искусная_Пытка_nibgzZyVum8rCQ2L.json, wdbc-sk8s):
//
//  «Пытая Беспомощного врага 5 минут и успешно пройдя Interrogate−20(I) vs
//  W+0, все друкхари, что могли насыщаться с жертвы, получают 2 Боли и
//  восстанавливают 1d5 урона во все Характеристики. За каждые 3 Успеха
//  восстанавливается ещё 1d5 Характеристики и +1 Боли. Каждый друкхари
//  получает пользу не более W.b раз в сутки (включая усиления за доп.
//  успехи в одной проверке).»
//
//  Решения по неоднозначностям текста (согласованы с пользователем):
//   - «(I)» — тест идёт по Интеллекту, а не по умолчательной Воле Навыка
//     Допрос (module/constants/skills.mjs::interrogate.char==="wp").
//   - «vs W+0» — настоящий ВСТРЕЧНЫЙ тест (resolveOpposed, оба бросают),
//     не односторонний тест пытающего со справочным порогом цели.
//   - «друкхари, способные насыщаться с жертвы» — любой друкхари-актор в
//     текущем бою (или на сцене вне боя), без доп. условия.
//   - «за каждые 3 Успеха» — margin/3 округлённый вниз (margin — итоговая
//     степень ВСТРЕЧНОГО теста из resolveOpposed, не исходного).
//
//  Day-лимит — throttleCount(actor, FLAG, "day") из module/rules/cooldown.mjs
//  (wdbc-sk8s), max = W.b ПОЛУЧАТЕЛЯ (не пытающего) — каждый друкхари считает
//  свой личный дневной лимит независимо, инкремент один раз за пытку, не за
//  каждый тир (текст явно: «включая усиления… в одной проверке»).
// ════════════════════════════════════════════════════════════════════════

import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { isThrottleCountAvailable, incrementThrottleCount } from "../rules/cooldown.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { raceMatches } from "../rules/race.mjs";
import { charHealAllFields } from "../rules/char-loss.mjs";

// Диалог пытки живёт в apps/torture.mjs (3-dc87: один общий для всех, этот
// файл — помощники Искусной Пытки: друкхари, тиры, польза, дневной лимит).
const FLAG = "skillfulTorture";

/** Владеет ли актор Талантом Skillful Torture / Искусная Пытка. */
export function hasSkillfulTorture(actor) {
  return hasAbility(actor, "ability.skillfulTorture", "Skillful Torture", "talent");
}

/** Друкхари ли актор — по расе, либо по «Прошлому» Иннари/Арлекина (module/rules/race.mjs). */
export function isDrukhari(actor) {
  return raceMatches(actor?.system, "drukhari");
}

/** Порог Interrogate(Int)−20 пытающего — «(I)» книги, не Воля по умолчанию Навыка. */
export function interrogateIntTotal(actor) {
  const rank = actor?.system?.skills?.interrogate?.rank;
  const rankBonus = SKILL_RANKS[rank]?.bonus ?? -20;
  const intTotal = Number(actor?.system?.characteristics?.int?.total) || 0;
  return intTotal + rankBonus;
}

/** Сколько тиров по 3 Успеха (margin встречного теста) — каждый даёт +1d5 лечения и +1 Боли. */
export function extraTiers(margin) {
  return Math.max(0, Math.floor((Number(margin) || 0) / 3));
}

/** Друкхари-актёры в текущем бою — либо на текущей сцене, если боя нет. */
export function drukhariNearby() {
  let actors;
  if (game.combat?.combatants) {
    actors = [...game.combat.combatants].map(c => c.actor).filter(Boolean);
  } else {
    actors = (canvas?.scene?.tokens?.contents ?? []).map(t => t.actor).filter(Boolean);
  }
  const seen = new Set();
  return actors.filter(a => {
    if (!isDrukhari(a) || seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

/**
 * Начисляет Боль + лечение всех Характеристик получателю (после проверки
 * дневного лимита ЕГО СОБСТВЕННЫМ W.b — вызывающий код это уже проверил).
 * healRolls — массив уже брошенных 1d5 (база + по одному на тир).
 */
export async function grantTortureBenefit(actor, healRolls) {
  const totalHeal = healRolls.reduce((a, b) => a + (Number(b) || 0), 0);
  const pain = 1 + healRolls.length; // 2 Боли база (1 тир) + 1 за каждый доп. тир
  const upd = {};
  // Урон по книге (charLoss) и старый минус в «Мод.» — wdbc-x1nz.2.83.
  Object.assign(upd, charHealAllFields(actor.system, totalHeal));
  const fateCur = actor.system.fate?.value ?? 0;
  const fateMax = actor.system.fate?.max ?? 0;
  upd["system.fate.value"] = Math.min(fateMax, fateCur + pain);
  await actor.update(upd);
  return { totalHeal, pain };
}

/** Дневной лимит получателя (W.b) — есть ли ещё запас. */
export function tortureBenefitAvailable(actor) {
  const wpBonus = Number(actor?.system?.characteristics?.wp?.bonus) || 0;
  if (wpBonus <= 0) return false;
  return isThrottleCountAvailable(actor, FLAG, "day", wpBonus);
}

/** Списывает одно использование дневного лимита получателя. */
export async function markTortureBenefitUsed(actor) {
  const wpBonus = Number(actor?.system?.characteristics?.wp?.bonus) || 0;
  await incrementThrottleCount(actor, FLAG, "day", wpBonus);
}
