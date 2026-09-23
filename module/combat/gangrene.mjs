// module/combat/gangrene.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Гангрена (стр. 30-31, wdbc-r5o7.5; сверка «Статусы» — wdbc-x1nz.2.96):
//  «+1 Усталости, которую нельзя снять, пока не вылечена Гангрена, −20 на
//  ментальные действия. Не восстанавливает урон в Т отдыхом и медитацией и
//  каждые T.b×2 часов получает 1d10 урона в Т, пока это не убьёт его.
//  Космодесантник перед каждым таким уроном проходит тест Т+0 и при Успехе
//  исцеляется (уже полученный урон в Т восстанавливает как обычно).»
//
//  +1 Усталость — производная надбавка поверх хранимой (rules/character.mjs,
//  fatigue.effective; rules/situational.mjs::effectiveFatigue). −20 на
//  ментальные действия — rules/library/conditions.mjs (rollBonus, charIn:
//  Int/Per/WP/Fel/Inf). «Не восстанавливает T отдыхом» — в этой системе
//  вообще нет автоматического восстановления system.charDamage.* отдыхом
//  (ручное поле листа «Мод.»), противоречить нечему.
//
//  Периодический урон T — gangreneTick. Идёт сам по игровому времени
//  (решение владельца: всё «минуты/часы» — к Календарю): его зовёт
//  combat/condition-clock.mjs по хуку updateWorldTime, по разу на каждый
//  истёкший интервал T.b×2 часов. Кнопка листа («Урон T — Гангрена»,
//  useGangrenePeriodicTest) оставлена запасным путём для стола, где время
//  Календарём не двигают, — идёт через тот же gangreneTick и сдвигает тот же
//  отсчёт (flags.warhammer-dbc.gangreneTestAt), поэтому кнопка и Календарь
//  не наносят урон за один интервал дважды.
//
//  Смерть — «пока это не убьёт его»: итоговая T ≤ 0 (charDamage.t — знаковый
//  Мод. к Итогу, rules/character.mjs) → combat/condition-death.mjs::
//  killByCondition (решение владельца 1).
// ════════════════════════════════════════════════════════════════════════════

import { worldTimeRemaining } from "../rules/cooldown.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { conditionRemoveFields, hasAstartesPhysiology } from "../sheets/tabs/conditions.mjs";
import { killByCondition } from "./condition-death.mjs";

const FLAG = "warhammer-dbc";
const TEST_AT_FLAG = "gangreneTestAt";
const SECONDS_PER_HOUR = 3600;

/**
 * Интервал урона Гангрены в секундах: T.b×2 часов, но не меньше 1 часа.
 * При T.b = 0 книга вырождается («каждые 0 часов») — буквально урон шёл бы
 * подряд без паузы до смерти в один сдвиг Календаря. Решение координатора
 * (wdbc-x1nz.2.96): пол 1 час — ГМ видит урон раз в час.
 */
export function gangreneIntervalSeconds(tb) {
  return Math.max(SECONDS_PER_HOUR, Math.max(0, Number(tb) || 0) * 2 * SECONDS_PER_HOUR);
}

/** Секунд до следующего «тика» Гангрены (0 — доступен прямо сейчас); интервал — gangreneIntervalSeconds (T.b×2 ч, не меньше 1 ч). */
export function gangrenePeriodicRemaining(testAt, worldTime, tb) {
  return worldTimeRemaining(testAt, worldTime, gangreneIntervalSeconds(tb));
}

/**
 * Один «тик» Гангрены в момент `at` (worldTime): тест T+0 космодесантника,
 * затем — если он не исцелился — 1d10 урона в T (system.charDamage.t) и
 * смерть при итоговой T ≤ 0. Отсчёт следующего интервала — от `at`.
 *
 * @returns {Promise<{healed?: boolean, damage?: number, died?: boolean, skipped?: boolean}>}
 */
export async function gangreneTick(actor, { at = game.time?.worldTime ?? 0 } = {}) {
  if (!actor?.system?.conditions?.gangrene || actor.getFlag?.(FLAG, "deceased")) return { skipped: true };
  const sections = [];
  let head = [];
  let threshold = "";
  const rolls = [];

  // Космодесантник: тест Т+0 ПЕРЕД броском урона; Успех — исцеление, урон
  // не наносится. Тот же сбор модификаторов, что у Т-теста Перевеса брони
  // (combat/armor-mods.mjs) — Черты и записи Конструктора на Стойкость.
  if (hasAstartesPhysiology(actor)) {
    const t = actor.system.characteristics?.t?.total ?? 0;
    const ruleMods = collectTestMods(actor, { kind: "skill", char: "t" });
    const thr = t + ruleMods.total;
    const testRoll = await new Roll("1d100").evaluate();
    rolls.push(testRoll);
    const success = testRoll.total <= thr;
    threshold = rollStatLine({ label: "Т", base: t, parts: ruleMods.parts, threshold: thr, rv: testRoll.total });
    if (success) {
      await actor.update({ ...conditionRemoveFields("gangrene"), [`flags.${FLAG}.${TEST_AT_FLAG}`]: at });
      await postTestCard(actor, {
        icon: rollIcon("spark", "#9fd08a"), title: `Гангрена — ${esc(actor.name)}`,
        threshold,
        outcome: outcomeHtml(true, "Успех — организм космодесантника побеждает Гангрену"),
        sections: [`<div class="roll-threshold" style="font-size:.85em;opacity:.8;">Уже полученный урон в Т восстанавливается как обычно.</div>`]
      }, { rolls });
      return { healed: true };
    }
    head = [`<div class="roll-threshold">Тест Т+0 космодесантника провален — Гангрена продолжается.</div>`];
  }

  const roll = await new Roll("1d10").evaluate();
  rolls.push(roll);
  const before = Number(actor.system.charDamage?.t) || 0;
  const after  = before - roll.total;
  // Итог T — до записи: после actor.update он пересчитается, но у заглушек
  // тестов и у несвязанных токенов пересчёта может не быть.
  const tBefore = Number(actor.system.characteristics?.t?.total) || 0;
  const tAfter  = tBefore - roll.total;
  await actor.update({
    "system.charDamage.t": after,
    [`flags.${FLAG}.${TEST_AT_FLAG}`]: at
  });

  let died = false;
  if (tAfter <= 0) {
    died = await killByCondition(actor);
    sections.push(`<div class="roll-outcome">${outcomeHtml(false, `Стойкость упала до ${tAfter} — ${esc(actor.name)} умирает от Гангрены.`)}</div>`);
  }

  await postTestCard(actor, {
    icon: rollIcon("blood","#7a8a4d"), title: `Гангрена → ${esc(actor.name)}`,
    head, threshold,
    lines: [`<div class="roll-threshold">Урон T: <b>${roll.total}</b> (Мод. T: ${before}→${after}; T ${tBefore}→${tAfter})</div>`],
    sections
  }, { rolls });
  return { damage: roll.total, died };
}

/**
 * Кнопка листа — запасной путь (см. шапку): тот же gangreneTick, если
 * интервал T.b×2 часов с прошлого тика уже истёк.
 */
export async function useGangrenePeriodicTest(actor) {
  if (!actor?.system?.conditions?.gangrene) return;
  const tb = Number(actor.system?.characteristics?.t?.bonus) || 0;
  const testAt = actor.getFlag(FLAG, TEST_AT_FLAG);
  const remaining = gangrenePeriodicRemaining(testAt, game.time.worldTime, tb);
  if (remaining > 0) {
    return ui.notifications.warn("Гангрена ещё не накопилась на новый урон T.");
  }
  await gangreneTick(actor, { at: game.time.worldTime });
}
