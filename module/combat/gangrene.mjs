// module/combat/gangrene.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Гангрена (стр. 30-31, wdbc-r5o7.5): «+1 неснимаемой Усталости, −20 на
//  ментальные действия. Не восстанавливает урон T отдыхом/медитацией; каждые
//  T.b×2 часов — 1d10 урона в T. Лечится операцией (Medicae−30), конечность
//  теряется.»
//
//  +1 Усталость — rules/character.mjs (клампится в derived data при каждом
//  пересчёте, «неснимаемая» = сброс Усталости отдыхом не может увести ниже 1,
//  пока стоит это Состояние). −20 на ментальные действия — rules/library/
//  conditions.mjs (rollBonus, charIn: Int/Per/WP/Fel/Inf — единственные пять
//  характеристик этой системы, не завязанные на тело). «Не восстанавливает T
//  отдыхом» — в этой системе ВООБЩЕ нет автоматического восстановления
//  system.charDamage.* отдыхом ни у кого (это ручное поле листа, «Мод.» —
//  вводится игроком, ни одна кнопка отдыха его не трогает) — книжное
//  ограничение сейчас ничему в коде не противоречит, снимать нечего; если
//  такое авто-восстановление когда-нибудь появится, ему нужно будет учесть
//  этот случай отдельно.
//
//  Периодический урон T — здесь: тот же общий примитив worldTimeRemaining
//  (rules/cooldown.mjs), что и Перевес выключенной силовой брони
//  (combat/armor-mods.mjs, disabledArmourPeriodicTestRemaining/
//  useDisabledArmourPeriodicTest) — раз в T.b×2 часов на листе доступна
//  кнопка, жмётся вручную (ГМ/игрок сам решает, что «прошло N часов»), а не
//  автоматический хук по ходу игрового времени — тот же выбор, что и у брони.
// ════════════════════════════════════════════════════════════════════════════

import { worldTimeRemaining } from "../rules/cooldown.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const FLAG = "warhammer-dbc";
const TEST_AT_FLAG = "gangreneTestAt";
const SECONDS_PER_HOUR = 3600;

/** Секунд до следующего «тика» Гангрены (0 — доступен прямо сейчас). tb≤0 — доступен всегда, тем же приёмом, что disabledArmourPeriodicTestRemaining. */
export function gangrenePeriodicRemaining(testAt, worldTime, tb) {
  return worldTimeRemaining(testAt, worldTime, (Number(tb) || 0) * 2 * SECONDS_PER_HOUR);
}

/**
 * Клик по кнопке листа: 1d10 непоглощаемого урона в T — пишет в
 * system.charDamage.t (ручной знаковый Мод. характеристики, тот же приём,
 * что и остальные источники урона характеристике), НЕ в Раны — книга прямо
 * говорит «урон в T», не «Раны». Таймер сбрасывается в любом исходе, как и у
 * Перевеса брони (тест не откладывается, раз состоялся).
 */
export async function useGangrenePeriodicTest(actor) {
  if (!actor?.system?.conditions?.gangrene) return;
  const tb = Number(actor.system?.characteristics?.t?.bonus) || 0;
  const testAt = actor.getFlag(FLAG, TEST_AT_FLAG);
  const remaining = gangrenePeriodicRemaining(testAt, game.time.worldTime, tb);
  if (remaining > 0) {
    return ui.notifications.warn("Гангрена ещё не накопилась на новый урон T.");
  }

  const roll   = await new Roll("1d10").evaluate();
  const before = Number(actor.system.charDamage?.t) || 0;
  const after  = before - roll.total;
  await actor.update({
    "system.charDamage.t": after,
    [`flags.${FLAG}.${TEST_AT_FLAG}`]: game.time.worldTime
  });

  await postTestCard(actor, {
    icon: rollIcon("blood","#7a8a4d"), title: `Гангрена → ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Урон T: <b>${roll.total}</b> (Мод. T: ${before}→${after})</div>`]
  }, { rolls: [roll] });
}
