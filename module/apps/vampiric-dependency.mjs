// module/apps/vampiric-dependency.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мутация «Vampiric Dependency / Вампирическая Зависимость» (стр. 452,
//  roll d100 94, wdbc-1rno): панель на листе Мутации — сколько месяцев без
//  подпитки, кнопка «Утолить» и кнопка «Тест на голод» (T+0, −10 за каждый
//  предыдущий месяц воздержания; провал — 1 Порчи). Что именно утоляет (10
//  субмутаций — сердце/печень/кровь…) остаётся отыгрышем, см. шапку
//  rules/vampiric-dependency.mjs.
// ════════════════════════════════════════════════════════════════════════

import { isVampiricDependencyItem, vampiricMonthsSince, vampiricTestRequired,
         vampiricTestPenalty, satisfyVampiricDependency } from "../rules/vampiric-dependency.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, thresholdLine, outcomeHtml } from "../helpers/test-card.mjs";

export { isVampiricDependencyItem };

/** Панель для листа предмета — пусто, если это не «Вампирическая Зависимость». */
export function vampiricPanelHtml(item) {
  if (!isVampiricDependencyItem(item)) return "";
  const months = vampiricMonthsSince(item, game.time?.worldTime ?? 0);
  const required = vampiricTestRequired(months);
  const status = required
    ? `${rollIcon("warn", "#ff6b4d")}Воздержание: ${months} мес. — обязателен тест T+0 (−10 за каждый предыдущий месяц)`
    : `${rollIcon("blood", "#8fd0ff")}Голод под контролем${months > 0 ? ` (${months} мес.)` : ""}`;
  return `<div class="vampiric-panel">
    <div class="vampiric-status">${status}</div>
    <div class="vampiric-btns">
      <button type="button" class="vampiric-satisfy-btn" data-item-id="${item.id}">
        ${rollIcon("blood", "#ffd24d")}Утолить
      </button>
      <button type="button" class="vampiric-test-btn" data-item-id="${item.id}">
        ${rollIcon("skull", "#c98fff")}Тест на голод
      </button>
    </div>
  </div>`;
}

/** Нажатие кнопки «Утолить» на листе Мутации. */
export async function useSatisfyVampiric(item) {
  await satisfyVampiricDependency(item);
}

/**
 * Тест T+0 (−10 за каждый предыдущий месяц воздержания) — провал даёт 1
 * Порчи. Карточка — общего вида (helpers/test-card.mjs, wdbc-kuun). Раньше
 * она рисовалась своей разметкой wh-poss-card, как у Проявления Демона: тест
 * с Порогом выглядел иначе, чем все остальные тесты в системе, и база T в
 * нём вообще не показывалась — только «бросок против числа».
 */
export async function useVampiricTest(actor, item) {
  if (!isVampiricDependencyItem(item) || !actor) return;
  const months  = vampiricMonthsSince(item, game.time?.worldTime ?? 0);
  const penalty = vampiricTestPenalty(months);
  const t       = actor.system.characteristics?.t?.total ?? 0;
  // Общий сбор модификаторов (wdbc-ct65.3): раньше этот тест катался мимо
  // реестра правил — ни Усталость, ни Черты/Таланты в него не попадали.
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "t" });
  const target  = Math.max(0, t + penalty + ruleMods.total);
  const roll    = await (new Roll("1d100")).evaluate();
  const success = roll.total <= target;
  const cor     = actor.system.corruption?.value ?? 0;
  if (!success) await actor.update({ "system.corruption.value": Math.min(100, cor + 1) });

  await postTestCard(actor, {
    icon: rollIcon("blood", "#8b1a1a"),
    title: `ГОЛОД — ${esc(item.name)}`,
    threshold: thresholdLine({
      label: "T", base: t,
      parts: [penalty ? `воздержание ${penalty}` : "", ...ruleMods.parts].filter(Boolean),
      threshold: target
    }),
    lines: [`<div class="roll-threshold">Воздержание: ${months} мес.</div>`],
    rv: roll.total,
    outcome: outcomeHtml(success, success ? "Успех" : "Провал: +1 Порчи")
  }, { rolls: [roll] });
}
