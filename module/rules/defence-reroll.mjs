// module/rules/defence-reroll.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Переброс Уклонения и Парирования, брошенных кнопкой защиты на карточке атаки.
//
//  Обычный тест Навыка бросается через окно, и перебросы Черт и Талантов
//  (эффекты rollMode, rules/resolve-test.mjs::rerollsFromRules) появляются там
//  радиокнопкой ДО броска. Защита окна не имеет: игрок жмёт «Уклониться» и
//  сразу получает карточку. Поэтому здесь переброс предлагается ПОСЛЕ броска —
//  кнопкой на карточке проваленной защиты, как и сказано в книге («может
//  перебросить проваленный тест»), и как уже делает Ускользнуть
//  (combat/defense.mjs::slipRerollSectionHtml).
//
//  Какие перебросы годятся — решает тот же конвейер, что и в окне: контекст
//  теста Навыка dodge/parry плюс ctx.evasion (область «evasion»), противник —
//  в ctx.targetActor (Охотники на Ангелов: «целью или источником которого
//  является Космодесантник»). Ограничители «раз в Раунд» — тоже общие
//  (rules/roll-mods.mjs::selfRerollsOffered).
//
//  Переброс — новый бросок, и остаётся он (стр. 25), а не лучший из двух:
//  первый уже провален, решение принято после броска. Переброшенную защиту
//  второй раз не перебрасывают — кнопок на её карточке нет.
//
//  Чистые данные, без Foundry: карточку и клик обслуживает
//  combat/defence-reroll.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { resolveTest } from "./resolve-test.mjs";
import { selfRerollsOffered } from "./roll-mods.mjs";
import { esc } from "../helpers/utils.mjs";

/** Флаг карточки защиты: всё, чтобы повторить тот же тест (combat/defence-reroll.mjs). */
export const DEFENCE_TEST_FLAG = "defenceTest";
/** Отметка «эту карточку уже перебросили» (combat/card-once.mjs). */
export const DEFENCE_REROLLED_FLAG = "defenceRerolled";

export const DEFENCE_KINDS = {
  dodge: { skill: "dodge", char: "ag", label: "Уклонение" },
  parry: { skill: "parry", char: "ws", label: "Парирование" }
};

/** Контекст теста для конвейера правил — тот же, что у окна броска Навыка с листа. */
export function defenceTestContext(kind, { attackerActor = null, isMelee = true } = {}) {
  const def = DEFENCE_KINDS[kind];
  if (!def) return null;
  return { kind: "skill", skill: def.skill, char: def.char, evasion: true, isMelee: !!isMelee,
    ...(attackerActor ? { targetActor: attackerActor } : {}) };
}

/**
 * Перебросы, которые можно предложить на карточке этой защиты.
 * Только на провале, только на первом броске и только «лучший» по смыслу:
 * keepWorst — наказание, его добровольно не выбирают.
 * @returns {Array<{ruleId:string,label:string,limit?:string,source?:object}>}
 */
export function defenceRerollsFor(actor, kind, { attackerActor = null, isMelee = true, passed = false, rerolled = false } = {}) {
  if (!actor || passed || rerolled) return [];
  const ctx = defenceTestContext(kind, { attackerActor, isMelee });
  if (!ctx) return [];
  const resolved = resolveTest({ actor, ...ctx });
  const seen = new Set();
  return selfRerollsOffered(actor, resolved.rerolls).filter(r => {
    if (r.mode === "keepWorst" || seen.has(r.ruleId)) return false;
    seen.add(r.ruleId);
    return true;
  });
}

/** Кнопки «Перебросить» на карточке проваленной защиты. Пусто — секции нет. */
export function defenceRerollSectionHtml(rerolls, kind) {
  if (!rerolls?.length) return "";
  const what = DEFENCE_KINDS[kind]?.label ?? "тест";
  const buttons = rerolls.map(r => `
    <button class="wh-defence-reroll-btn" type="button" data-rule-id="${esc(r.ruleId)}"
      title="Переброс проваленного теста: новый бросок остаётся. Реакция второй раз не тратится.">
      Перебросить ${esc(what)}: ${esc(r.label)}
    </button>`).join("");
  return `<div class="roll-defense-note wh-defence-rerolls">${buttons}</div>`;
}
