// module/rules/eater-of-pain.mjs
// ════════════════════════════════════════════════════════════════════════
//  Eater of Pain / Пожиратель Боли (Слаанеш, wdbc-1rno, d100 70…73):
//  «Боль и страдание других питают тело и душу персонажа... Каждый раз,
//  когда любое разумное существо, обладающее душой, в пределах Cor.b м от
//  него получает Критический Эффект, персонаж может бросить 1d10+1 — если
//  результат ниже Критического Эффекта, он может выбрать снять с себя 1d5
//  Усталости, исцелить 1d5 Ран, или восстановить 1d10 урона в
//  Характеристики. Успешно проведя Пытку против другого разумного
//  существа, персонаж получает указанные выше преимущества за каждый
//  Успех на тесте.»
//
//  Триггер «крит рядом» — та же точка, что combat/damage.mjs уже даёт Cast
//  Out of Death/Изгнанному из Смерти (wdbc-1rno), та же геометрия ауры
//  (Cor.b м — СВОЙ радиус у каждого носителя, не общий), что rules/
//  fatalism.mjs. Радиус меряется ОТ НОСИТЕЛЯ, victimToken — тот, кто
//  получил Крит.Эффект (может быть кем угодно, включая самого носителя).
//
//  Триггер «Пытка» подключён ТОЛЬКО к единственному кодифицированному
//  действию Пытки в системе — apps/skillful-torture.mjs (Талант «Искусная
//  Пытка», wdbc-sk8s). Общего действия «допросить Беспомощного» без этого
//  Таланта в коде нет вовсе — честное ограничение уже (мы) отмечали для
//  ряда других находок этого тикета, не лень.
//
//  Восстановление урона Характеристик — тот же путь (system.charDamage.
//  <key>, клэмп к 0), что apps/skillful-torture.mjs::grantTortureBenefit —
//  второй копии формулы заводить не стали.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "./flags.mjs";
import { tokensWithinRadius } from "./aoe-target.mjs";
import { esc } from "../helpers/utils.mjs";

export const EATER_OF_PAIN_CAPABILITY = "gift.slaanesh.eaterOfPain";

/**
 * Носители Дара, чей Cor.b-радиус (СВОЙ у каждого) накрывает victimToken —
 * несколько носителей могут сработать на один Критический Эффект разом.
 * @returns {{token:object, actor:object}[]}
 */
export function eaterOfPainHoldersNear(victimToken) {
  const scene = victimToken?.parent;
  if (!scene) return [];
  const out = [];
  for (const holderToken of scene.tokens?.contents ?? []) {
    const holder = holderToken.actor;
    if (!holder || !hasRuleFlag(holder, EATER_OF_PAIN_CAPABILITY)) continue;
    const radius = Number(holder.system?.corruptionBonus) || 0;
    if (radius <= 0) continue;
    const within = tokensWithinRadius(holderToken, radius, { includeSelf: true });
    if (within.some(t => t.id === victimToken.id)) out.push({ token: holderToken, actor: holder });
  }
  return out;
}

/**
 * Обновление актора по выбранному преимуществу — roll уже брошенное число
 * (вызывающая сторона кидает 1d5/1d5/1d10 сама, здесь только арифметика).
 * @param {object} system  actor.system получателя
 * @param {"fatigue"|"wounds"|"char"} choice
 * @param {number} roll
 * @returns {Record<string, number>} кусок для actor.update() (может быть пустым)
 */
export function eaterOfPainBenefitUpdate(system, choice, roll) {
  const n = Number(roll) || 0;
  if (n <= 0) return {};
  if (choice === "fatigue") {
    const cur = Number(system?.fatigue?.value) || 0;
    return { "system.fatigue.value": Math.max(0, cur - n) };
  }
  if (choice === "wounds") {
    const cur = Number(system?.wounds?.value) || 0;
    const max = Number(system?.wounds?.effectiveMax ?? system?.wounds?.max) || 0;
    return { "system.wounds.value": Math.min(max, cur + n) };
  }
  if (choice === "char") {
    const upd = {};
    for (const key of Object.keys(system?.characteristics ?? {})) {
      const cur = Number(system?.charDamage?.[key]) || 0;
      if (cur < 0) upd[`system.charDamage.${key}`] = Math.min(0, cur + n);
    }
    return upd;
  }
  return {};
}

/**
 * Три кнопки выбора преимущества — общие для обоих триггеров (крит рядом,
 * combat/damage.mjs; успешная Пытка, apps/skillful-torture.mjs), поэтому
 * строятся здесь один раз, не дублируются в двух файлах. diceCount — сколько
 * кубов суммировать («за каждый Успех» у Пытки — несколько разом, крит рядом
 * — всегда 1), формула едет прямо в data-dice — hooks.mjs её просто катает.
 */
export function eaterOfPainChoiceButtonsHtml(eaterUuid, diceCount = 1) {
  const n = Math.max(1, Number(diceCount) || 1);
  const btn = (choice, label, die) => `
    <button type="button" class="wh-eater-of-pain-choice-btn"
      data-eater-uuid="${esc(eaterUuid)}" data-choice="${choice}" data-dice="${n}${die}">
      ${label}</button>`;
  return `<div class="wh-crit-pills">
    ${btn("fatigue", "Снять Усталость", "d5")}
    ${btn("wounds", "Исцелить Раны", "d5")}
    ${btn("char", "Восстановить Характеристики", "d10")}
  </div>`;
}
