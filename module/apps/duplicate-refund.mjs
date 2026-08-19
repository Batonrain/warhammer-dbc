// module/apps/duplicate-refund.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Возврат опыта за совпавшую выдачу (rules/duplicate-grants.mjs).
//
//  Навык, который персонажу уже не поднять, и Талант, который у него уже есть,
//  повторить нечем — вместо этого источник возвращает опыт: столько, сколько
//  эта покупка стоила бы ему самому. Цена зависит от Склонностей и культуры
//  легиона, поэтому считается теми же функциями, что и вкладка «Развитие», —
//  иначе возврат разошёлся бы с ценой покупки.
//
//  Каждое начисление пишется в журнал опыта (system.experience.log) с пометкой
//  «Возврат за …»: оно случается само собой, посреди применения расы или
//  Архетипа, и разобраться потом, откуда взялись лишние 300, было бы негде.
//  Опыт идёт и в полученный, и в свободный — это не возврат потраченного, а
//  новый опыт за то, чего персонаж не смог взять.
// ════════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { charAptitudeSet, skillCostXP, talentCostXP } from "../constants/advancement.mjs";
import { cultureCat, resolveCultureFx } from "../constants/legions.mjs";
import { isFriendlySpecialty } from "../rules/friendly-specialties.mjs";
import { rankLabel, stepsUpTo } from "../rules/duplicate-grants.mjs";

/** Культура легиона персонажа — она двигает категорию цены (стр. 58, 61). */
function cultFxOf(actor) {
  try {
    return resolveCultureFx(actor.system?.geneSeed?.cultureLegion || "",
                            actor.system?.geneSeed?.cultureChapter || "");
  } catch { return null; }
}

/** Категория цены Навыка для этого персонажа: Склонности плюс культура. */
function skillCat(actor, def, entryChar = "", group = "", specialty = "") {
  const apts = charAptitudeSet(actor.system?.aptitudes);
  const itemApts = [entryChar || def.char, def.apt2].filter(Boolean);
  // Общие знания и Ремесло всегда Дружественные — это перебивает и Склонности,
  // и культуру легиона, ровно как на «Развитии». То же самое — специализация,
  // отмеченная как Дружественная на Родном мире (Исследовательская станция).
  const cat = def.alwaysAlly ? "ally"
    : (group && isFriendlySpecialty(actor, group, specialty)) ? "ally"
    : cultureCat("skill", def.label || "", "", cultFxOf(actor));
  return { apts, itemApts, cat };
}

/**
 * Цена перечисленных ступеней Навыка для этого персонажа. Ступени приходят
 * готовыми (rules/duplicate-grants.mjs): за выдаваемый уровень платится так,
 * будто персонаж качал его с нуля.
 */
export function skillStepsCost(actor, skillKey, steps = [], { group = false, entryChar = "", specialty = "" } = {}) {
  const def = group ? GROUP_SKILLS_DEF[skillKey] : SKILLS_DEF[skillKey];
  if (!def || !steps.length) return 0;
  const { apts, itemApts, cat } = skillCat(actor, def, entryChar, group ? skillKey : "", specialty);
  return steps.reduce((sum, step) => sum + skillCostXP(step, itemApts, apts, cat), 0);
}

/** Цена прокачки Навыка с нуля до ранга — для подписи и для прямых вызовов. */
export function skillRankCost(actor, skillKey, rank, opts = {}) {
  return skillStepsCost(actor, skillKey, stepsUpTo(rank), opts);
}

/** Цена Таланта для этого персонажа — столько и возвращается за повтор. */
export function talentCost(actor, talent) {
  const apts = charAptitudeSet(actor.system?.aptitudes);
  const sys = talent?.system ?? {};
  const cat = cultureCat("talent", talent?.name || "", sys.specialization || "", cultFxOf(actor));
  return talentCostXP(sys.tier, sys.aptitudes || [], apts, cat,
    { name: talent?.name, patron: actor.system?.patronGod });
}

/**
 * Зачислить опыт, записать в журнал и сказать в чат.
 *
 * @param {Actor}  actor
 * @param {number} amount  сколько начислить
 * @param {string} reason  за что — идёт в журнал после слов «Возврат за»
 */
export async function refundXP(actor, amount, reason) {
  const xp = Math.max(0, Math.round(Number(amount) || 0));
  if (!xp) return 0;

  const exp = actor.system?.experience ?? {};
  const log = Array.isArray(exp.log) ? foundry.utils.deepClone(exp.log) : [];
  log.push({ at: Date.now(), amount: xp, kind: "refund", reason: String(reason || "") });

  await actor.update({
    "system.experience.total":   (Number(exp.total) || 0) + xp,
    "system.experience.current": (Number(exp.current) || 0) + xp,
    "system.experience.log":     log
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><b>Возврат за</b> ${reason}: <b>${xp}</b> опыта.</p>`
  });
  return xp;
}

/** Подпись для журнала: «Навык Скрытность (+10) — уже есть +20». */
export const skillReason = (label, grantedRank, currentRank) =>
  `Навык «${label}» ${rankLabel(grantedRank)}${currentRank ? ` — уже ${rankLabel(currentRank)}` : ""}`;

/** Подпись для журнала: «Талант Дуэлист — уже есть». */
export const talentReason = (name, specialization) =>
  `Талант «${name}${specialization ? ` (${specialization})` : ""}» — уже есть`;
