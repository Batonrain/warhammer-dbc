// module/combat/radiation.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Лучевая болезнь (стр. 30-31, wdbc-r5o7.6) — осложнение Радиации: провал
//  теста T+0 при накоплении 10/20/30... уровней Радиации (combat/
//  condition-ticks.mjs::processConditionTurnEnd) ставит флаг
//  flags.warhammer-dbc.radiationSickness. Книга: «доп. урон в T каждые 8
//  часов, лечится Medicae−30» — конкретную кость для этого урона книга не
//  называет (в отличие от Гангрены, у которой прямо «1d10»); решение — тот
//  же фиксированный 1, что и у самой Радиации за Раунд (condition-ticks.mjs),
//  раз книга не задаёт число явно, а не подбирать кость самостоятельно.
//  «Лечится Medicae−30» — снятие флага руками через тест на листе, как и у
//  любого другого «вылечено» — отдельной кнопки-теста для лечения тут не
//  заводим, это уже стандартный путь через Лечение (wounds-heal-btn).
//
//  Тот же общий приём worldTime-кулдауна (rules/cooldown.mjs), что и Перевес
//  выключенной силовой брони (combat/armor-mods.mjs) и Гангрена (combat/
//  gangrene.mjs) — кнопка на листе, жмётся вручную раз в 8 часов игрового
//  времени, не автоматический хук по ходу времени.
// ════════════════════════════════════════════════════════════════════════════

import { worldTimeRemaining } from "../rules/cooldown.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const FLAG = "warhammer-dbc";
const SICKNESS_FLAG = "radiationSickness";
const TEST_AT_FLAG = "radiationSicknessTestAt";
const SECONDS_PER_HOUR = 3600;
const INTERVAL_HOURS = 8;

/** Секунд до следующего тика лучевой болезни (0 — доступен прямо сейчас). */
export function radiationSicknessRemaining(testAt, worldTime) {
  return worldTimeRemaining(testAt, worldTime, INTERVAL_HOURS * SECONDS_PER_HOUR);
}

/**
 * Клик по кнопке листа: 1 непоглощаемого урона в T (system.charDamage.t,
 * см. заголовок файла про выбор фиксированного числа). Таймер сбрасывается
 * в любом исходе.
 */
export async function useRadiationSicknessTest(actor) {
  if (!actor?.getFlag?.(FLAG, SICKNESS_FLAG)) return;
  const testAt = actor.getFlag(FLAG, TEST_AT_FLAG);
  const remaining = radiationSicknessRemaining(testAt, game.time.worldTime);
  if (remaining > 0) {
    return ui.notifications.warn("Лучевая болезнь ещё не накопилась на новый урон T.");
  }

  const before = Number(actor.system.charDamage?.t) || 0;
  const after  = before - 1;
  await actor.update({
    "system.charDamage.t": after,
    [`flags.${FLAG}.${TEST_AT_FLAG}`]: game.time.worldTime
  });

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warp","#ffe14d")}Лучевая болезнь → ${esc(actor.name)}</div>
      <div class="roll-threshold">Урон T: <b>1</b> (Мод. T: ${before}→${after})</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
}
