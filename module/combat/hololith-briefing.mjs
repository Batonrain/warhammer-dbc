// module/combat/hololith-briefing.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Гололит (стр. 256): «Брифинг: Tech-Use+0 + час подготовки → +10 Command».
//  Раньше +10 Command капало Конструктором просто по факту владения гололитом
//  (wdbc-x1nz.2, аудит инструментов/снаряжения — тот же класс проблемы, что
//  Ауспекс/Следовательский Набор/Редуктор) — здесь, в отличие от них, повод
//  теста не разовая процедура на конкретный бросок (извлечение геносемени), а
//  ЗАВЕРШЁННАЯ ПОДГОТОВКА, дающая бонус на СЛЕДУЮЩИЙ подходящий тест — тот же
//  класс, что «отложенный флаг» Фокуса на Прицеле (rules/aim-focus.mjs,
//  combat/action-economy.mjs::applyAimFocusTurnEnd), только гасится не концом
//  Хода, а фактом использования (см. clearHololithBriefing ниже, вызывается
//  из sheets/actor-sheet.mjs::_runTest сразу после теста Command).
//
//  Час подготовки — не проверяется отдельно (тот же принцип, что у прочих
//  «часовых» условий книги в этой системе — считает игровое время сам ГМ),
//  здесь только сам тест Tech-Use+0 и флаг успеха.
// ════════════════════════════════════════════════════════════════════════════

import { collectTestMods } from "../rules/roll-mods.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";

const FLAG = "warhammer-dbc";
const BRIEFED_FLAG = "hololithBriefed";

/** Читает rules/situational.mjs::hololithBriefingBonus — тот же флаг, тот же ключ. */
export function hasHololithBriefing(actor) {
  return !!actor?.getFlag?.(FLAG, BRIEFED_FLAG);
}

/** Гасит подготовку после того, как её бонус пошёл в тест Command. Не трогает флаг, если его и не было. */
export async function clearHololithBriefing(actor) {
  if (actor?.getFlag?.(FLAG, BRIEFED_FLAG)) await actor.unsetFlag(FLAG, BRIEFED_FLAG);
}

/** Провести брифинг: тест Tech-Use+0 (стр. 256). Успех — +10 Command доступен на следующий подходящий тест. */
export async function useHololithBriefing(actor, item) {
  if (!actor || !item) return;
  const techUse = actor.system?.skills?.techUse?.total ?? -20;
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "techUse", char: "int" });
  const threshold = techUse + ruleMods.total;

  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;
  if (success) await actor.setFlag(FLAG, BRIEFED_FLAG, true);

  const dice = await roll.render();
  await postTestCard(actor, {
    icon: rollIcon("chart", "#8fd0ff"),
    title: `${esc(actor.name)} — Брифинг: ${esc(item.name)}`,
    threshold: rollStatLine({ label: "Tech-Use", base: techUse, parts: ruleMods.parts, threshold, rv }),
    outcome: success
      ? outcomeHtml(true, "Успех — +10 Command доступен на следующий тест")
      : outcomeHtml(false, "Провал — подготовка не удалась"),
    sections: [
      `<div class="roll-threshold" style="font-size:.85em;opacity:.8;">Час подготовки (стр. 256) — игровое время считайте сами.</div>`,
      `<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>`
    ]
  }, { rolls: [roll] });
}
