// module/combat/legion-surgery.mjs
// ════════════════════════════════════════════════════════════════════════
//  Хирургия Легиона (Апотекарий) — Foundry-обвязка к
//  module/rules/legion-surgery.mjs: вопрос медику, списание Очка Бесчестия,
//  пробуждение из Замедленной Анимации.
//
//  Решение принимается ПОСЛЕ броска (книга: «когда проваливает… может
//  потратить»), поэтому это вопрос по факту провала, а не галочка в диалоге
//  до броска — тот же приём, что у «Абсолютной веры в прошлое» (fear.mjs).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { actorInfamyPath, actorInfamyValue, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { tempInfamyAmount } from "../rules/temp-infamy.mjs";
import { conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import {
  SUS_AN_ACTIVE_FLAG, hasLegionSurgery, legionSurgeryCanRescue, susAnWakeEligible
} from "../rules/legion-surgery.mjs";

const NS = "warhammer-dbc";

/** Строка карточки: провал превращён в успех. */
export const LEGION_SURGERY_LINE =
  `${rollIcon("heart", "#ff8a8a")}<b>Хирургия Легиона</b>: потрачено Очко Бесчестия — тест пройден с 1 Успехом.`;

function hasInfamy(actor) {
  return actorInfamyValue(actor) + tempInfamyAmount(actor) >= 1;
}

/** Списать 1 Очко Бесчестия (временный запас — первым, Пустота Парии — отказ). */
async function spendOne(actor) {
  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return false;
  await actor.update({ [path]: spend.poolValue });
  return true;
}

async function ask(title, text, yes) {
  return !!(await foundry.applications.api.DialogV2.confirm({
    window: { title }, content: `<p>${text}</p>`,
    yes: { label: yes }, no: { label: "Нет" }
  }));
}

/**
 * Провал теста лечения: предложить Апотекарию Очко Бесчестия. Возвращает
 * итоговый успех и строку для карточки ("" — ничего не менялось).
 * @param {Actor} medic
 * @param {boolean} success исход броска
 * @param {string} testLabel подпись теста для вопроса
 * @returns {Promise<{success:boolean, line:string}>}
 */
export async function legionSurgeryPass(medic, success, testLabel) {
  if (!legionSurgeryCanRescue(medic, success) || !hasInfamy(medic)) return { success, line: "" };
  const ok = await ask("Хирургия Легиона",
    `${esc(medic.name)}: тест «${esc(testLabel)}» провален. Потратить Очко Бесчестия, чтобы пройти его с 1 Успехом?`,
    "Потратить Очко");
  if (!ok || !(await spendOne(medic))) return { success, line: "" };
  return { success: true, line: LEGION_SURGERY_LINE };
}

/**
 * После Первой Помощи: пациент в Замедленной Анимации с Ранами не ниже −7 —
 * предложить пробудить за Очко Бесчестия. Возвращает строку для карточки.
 */
export async function offerSusAnWake(medic, patient) {
  if (!hasLegionSurgery(medic) || !susAnWakeEligible(patient) || !hasInfamy(medic)) return "";
  const ok = await ask("Хирургия Легиона — пробуждение",
    `${esc(patient.name)} в Замедленной Анимации, Раны не ниже −7. Потратить Очко Бесчестия, чтобы пробудить его из анабиоза?`,
    "Пробудить");
  if (!ok || !(await spendOne(medic))) return "";
  try {
    await patient.update({ ...conditionRemoveFields("unconscious"), [`flags.${NS}.-=${SUS_AN_ACTIVE_FLAG}`]: null });
  } catch {
    return `${rollIcon("warn", "#ffb84d")}Хирургия Легиона: Очко потрачено, но нет прав на лист пациента — снимите «Без сознания» вручную (нужен ГМ).`;
  }
  return `${rollIcon("spark", "#4dffa6")}<b>Хирургия Легиона</b>: потрачено Очко Бесчестия — ${esc(patient.name)} пробуждается из Замедленной Анимации.`;
}

/**
 * Меню Очков на карточке проваленного теста Навыка (hooks.mjs): трата Очка
 * и карточка «засчитан с 1 Успехом». Сам бросок не переигрывается —
 * меняется исход, как у «+10 за Очко» того же меню.
 */
export async function legionSurgeryOnCard(actor, label) {
  if (!(await spendOne(actor))) return false;
  await postTestCard(actor, {
    icon: rollIcon("heart", "#ff8a8a"),
    title: `Хирургия Легиона — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Тест «${esc(label)}» проваленный — засчитан успешным.</div>`],
    outcome: `<span class="roll-success">Успех — 1 Успех (потрачено Очко Бесчестия)</span>`
  }, { sound: false });
  return true;
}
