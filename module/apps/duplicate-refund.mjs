// module/apps/duplicate-refund.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Возврат опыта за совпавшую выдачу (rules/duplicate-grants.mjs).
//
//  Навык, доросший до потолка, и Талант, который уже есть, повторить нечем —
//  вместо этого источник возвращает опыт: столько, сколько эта покупка стоила
//  бы самому персонажу. Цена зависит от его Склонностей и культуры легиона,
//  поэтому считается теми же функциями, что и вкладка «Развитие», — иначе
//  возврат разошёлся бы с ценой покупки.
//
//  Опыт идёт и в полученный, и в свободный: это не возврат потраченного, а
//  новый опыт за то, чего персонаж не смог взять.
// ════════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { charAptitudeSet, skillCostXP, talentCostXP } from "../constants/advancement.mjs";
import { cultureCat, resolveCultureFx } from "../constants/legions.mjs";
import { rankLabel } from "../rules/duplicate-grants.mjs";

/** Культура легиона персонажа — она двигает категорию цены (стр. 58, 61). */
function cultFxOf(actor) {
  try { return resolveCultureFx(actor.system?.geneSeed?.cultureLegion || "", actor.system?.geneSeed?.cultureChapter || ""); }
  catch { return null; }
}

/**
 * Цена ступени Навыка для этого персонажа. `step` — индекс покупки (0 = +0,
 * 3 = +30): по нему и считается возврат на потолке.
 */
export function skillStepCost(actor, skillKey, step, { group = false, entryChar = "" } = {}) {
  const def = group ? GROUP_SKILLS_DEF[skillKey] : SKILLS_DEF[skillKey];
  if (!def) return 0;
  const apts = charAptitudeSet(actor.system?.aptitudes);
  const itemApts = [entryChar || def.char, def.apt2].filter(Boolean);
  // Общие знания и Ремесло всегда Дружественные — это перебивает и Склонности,
  // и культуру легиона, ровно как на «Развитии».
  const cat = def.alwaysAlly ? "ally"
    : cultureCat("skill", def.label || skillKey, "", cultFxOf(actor));
  return skillCostXP(step, itemApts, apts, cat);
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
 * Зачислить опыт и сказать об этом в чат: возврат случается сам собой, посреди
 * выдачи расы или Архетипа, и без строки в чате игрок его попросту не заметит.
 */
export async function refundXP(actor, amount, reason) {
  const xp = Math.max(0, Math.round(Number(amount) || 0));
  if (!xp) return 0;

  const exp = actor.system?.experience ?? {};
  await actor.update({
    "system.experience.total":   (Number(exp.total) || 0) + xp,
    "system.experience.current": (Number(exp.current) || 0) + xp
  });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><b>Совпавшая выдача:</b> ${reason} — возвращено <b>${xp}</b> опыта.</p>`
  });
  return xp;
}

/** Подпись для чата: «Навык Скрытность уже на +30». */
export const skillCapReason = (label, rank) => `Навык «${label}» уже ${rankLabel(rank)}`;

/** Подпись для чата: «Талант Дуэлист уже есть». */
export const talentReason = (name, specialization) =>
  `Талант «${name}${specialization ? ` (${specialization})` : ""}» уже есть`;
