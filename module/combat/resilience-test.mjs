// module/combat/resilience-test.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Общий бросок «тест характеристики +0» для Талантов Стойкости (глава 3):
//  Стальная Челюсть (T+0), Стена (S+0), Последний Рывок (T+0), Боль — Лишь
//  Иллюзия (W+0) и тест «смерть от шока» (T+0, Крепкий Орешек перебрасывает).
//
//  Тесты запускаются кнопкой/диалогом без окна с галочками, поэтому модификаторы
//  реестра правил берутся все разом (collectTestMods — «для мест БЕЗ диалога»),
//  а их подписи видны в подсказке Порога. Карточка — общим сборщиком
//  (helpers/test-card.mjs, AGENTS.md «Карточки результата теста»).
//
//  Импортирует только rules/, helpers/ и constants/ — модуль тянут и damage.mjs,
//  и condition-effects, поэтому подключать сюда combat/-файлы нельзя (круг).
// ════════════════════════════════════════════════════════════════════════════

import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { esc } from "../helpers/utils.mjs";

/**
 * Бросить тест характеристики и выложить карточку.
 * @param {Actor}  actor
 * @param {string} char  ключ характеристики (t, s, wp…)
 * @param {object} o
 * @param {string} o.title        заголовок карточки (имя актора дописывается тут же)
 * @param {number} [o.mod]        модификатор теста ("+0" — ноль)
 * @param {string} [o.charLabel]  подпись характеристики в карточке (по книге: «T», «W»)
 * @param {?{rolls:number, mode:string, label:string}} [o.reroll] переброс (Крепкий Орешек: 2 броска, лучший)
 * @param {string} [o.successText] исход при успехе (может содержать {deg})
 * @param {string} [o.failText]    исход при провале
 * @param {string[]} [o.sections]  свои блоки под исходом
 * @param {object} [o.ctx]        теги теста для реестра правил (stunTest — Сопротивление (Stun) даёт +10)
 * @returns {Promise<{success:boolean, deg:number, rv:number, eff:number}>}
 */
export async function rollResilienceTest(actor, char, {
  title, mod = 0, charLabel = "", reroll = null, successText = "Успех", failText = "Провал", sections = [], ctx = {}
} = {}) {
  const base = Number(actor?.system?.characteristics?.[char]?.total) || 0;
  const rm = collectTestMods(actor, { kind: "skill", char, ...ctx });
  const eff = base + (Number(mod) || 0) + rm.total;
  const { roll, rolls, rv, rerollNote } = await rollD100WithReroll(reroll);
  const { success, deg } = testOutcome(rv, eff);
  const label = charLabel || CHARACTERISTICS[char]?.abbr || String(char).toUpperCase();
  const parts = [mod ? `${mod > 0 ? "+" : ""}${mod}` : "", ...rm.parts];
  await postTestCard(actor, {
    icon: rollIcon("target", "#8fd0ff"),
    title: `${title} — ${esc(actor?.name ?? "")}`,
    threshold: rollStatLine({ label, base, parts, threshold: eff, rv }),
    rerollNote,
    outcome: success
      ? `<span class="roll-success">${successText.replace("{deg}", String(deg))}</span>`
      : `<span class="roll-failure">${failText.replace("{deg}", String(deg))}</span>`,
    sections
  }, { rolls: rolls?.length ? rolls : [roll] });
  return { success, deg, rv, eff };
}
