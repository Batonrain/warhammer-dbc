// module/rules/mastery.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Mastery / Мастерство (Общие Таланты, корбук стр. 62).
//  [книга] «Он может потратить Очко Бесчестия для того, чтобы автоматически
//  пройти тест на выбранный Навык с окончательным модификатором +0 или легче
//  с количеством Успехов, равным бонусу использованной в тесте Характеристики.
//  Вдобавок, каждый раз, когда персонаж набирает 5+ Успехов в тесте на
//  выбранный Навык (кроме Психотестов и тестов активации Техночудес), это
//  считается Критическим Успехом. Игрок с разрешения ГМа может выбрать до 3-х
//  стандартных эффектов Критического Успеха для определённых применений
//  Навыка.»
//
//  «Выбранный Навык» — привязка Таланта при покупке (пикер кладёт ключ
//  masteryTargets в system.aptSource, подпись — в system.specialization).
//  Здесь только чистая логика без Foundry: какие Навыки покрыты, подходит ли
//  тест под автоуспех, считается ли набранное критом.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { masteryTarget, masteryTargets } from "./mastery-targets.mjs";
import { specOptions } from "../constants/skill-specializations.mjs";

/** Сколько Успехов делают результат Критическим Успехом. */
export const MASTERY_CRIT_DEGREES = 5;

/** Строка карточки: Критический Успех от Мастерства. */
export const MASTERY_CRIT_LINE =
  `<div class="roll-crit roll-crit-success">⚡ Критический Успех! <span class="roll-dlg-note">(Мастерство: ${MASTERY_CRIT_DEGREES}+ Успехов — до 3 стандартных эффектов с разрешения ГМа)</span></div>`;

/** Это Талант «Мастерство»? */
export function isMastery(item) {
  return item?.type === "talent"
    && (itemHasName(item, "Mastery") || itemHasName(item, "Мастерство"));
}

/** Ключ привязки Mastery: aptSource, либо обратный поиск по подписи. */
export function masteryKeyOf(talent) {
  const apt = String(talent?.system?.aptSource ?? "").trim();
  if (apt && masteryTarget(apt)) return apt;
  const label = String(talent?.system?.specialization ?? "").trim();
  if (!label) return "";
  return masteryTargets().find(t => t.label === label)?.key ?? "";
}

/** Ключи Навыков, к которым привязано Мастерство актора (без повторов). */
export function masteryKeys(items) {
  const keys = new Set();
  for (const it of items ?? []) {
    if (!isMastery(it)) continue;
    const k = masteryKeyOf(it);
    if (k) keys.add(k);
  }
  return [...keys];
}

const norm = s => String(s ?? "").trim().toLowerCase();

/** Подпись строки группового Навыка — та ли это специализация. */
function specialtyMatches(group, spec, specialty) {
  const want = norm(specialty);
  if (!want) return false;
  const opt = specOptions(group).find(o => o.key === spec);
  if (!opt) return want === norm(spec);
  return [opt.key, opt.label, opt.ru, opt.display].some(v => v && norm(v) === want);
}

/**
 * Покрывает ли хоть один из ключей привязки этот тест. `ctx` — флаг
 * skillTest карточки теста с листа: {skill, group, specialty}.
 * Группа целиком (ключ без специализации) покрывает любую её специализацию.
 * @param {string[]} keys ключи masteryTargets
 */
export function masteryCoversTest(keys, ctx) {
  if (!ctx || !Array.isArray(keys) || !keys.length) return false;
  return keys.some(key => {
    const t = masteryTarget(key);
    if (!t) return false;
    if (!t.group) return !!ctx.skill && ctx.skill === t.key;
    if (ctx.group !== t.group) return false;
    return !t.spec || specialtyMatches(t.group, t.spec, ctx.specialty);
  });
}

/** Есть ли у актора Мастерство на этот тест. */
export function actorHasMasteryFor(actor, ctx) {
  return masteryCoversTest(masteryKeys(actor?.items), ctx);
}

/** Критический Успех по Мастерству: успех с 5+ Успехами в покрытом тесте. */
export function masteryCrit(actor, ctx, { success, deg }) {
  return !!success && Number(deg) >= MASTERY_CRIT_DEGREES && actorHasMasteryFor(actor, ctx);
}

/**
 * Годится ли тест под автоуспех: «окончательный модификатор +0 или легче».
 * `mod` — итог всех поправок к Порогу (модификатор диалога + Сложность +
 * авто-штрафы); карточки без этого поля (старые) не режем.
 */
export function masteryAutoSuccessAllowed(skillTest) {
  if (!skillTest || !(skillTest.skill || skillTest.group)) return false;
  const mod = skillTest.mod;
  return mod == null || Number(mod) >= 0;
}

/** Успехи автоуспеха — Бонус Характеристики, которой бросали. */
export function masteryAutoSuccessDegrees(actor, charKey) {
  return Math.max(1, Number(actor?.system?.characteristics?.[charKey]?.bonus) || 0);
}

/**
 * Стоит ли предлагать автоуспех на этой карточке: Мастерство покрывает тест,
 * поправки не хуже +0, а сам бросок не дал бы столько же или больше.
 */
export function masteryAutoSuccessOffer(actor, skillTest) {
  if (!masteryAutoSuccessAllowed(skillTest)) return null;
  if (!actorHasMasteryFor(actor, skillTest)) return null;
  const deg = masteryAutoSuccessDegrees(actor, skillTest.char);
  if (skillTest.success && Number(skillTest.deg) >= deg) return null;   // и так не хуже
  return { deg };
}
