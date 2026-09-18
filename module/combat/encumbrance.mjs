// module/combat/encumbrance.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Периодический тест Перевеса инвентаря (стр. 27, «Максимальный Вес»):
//  «За каждые T.b часов в перевесе он должен пройти тест на Т+0 или получить
//  1 Усталости, получая накаливающийся штраф −10 за каждый тест после
//  первого.» Плоский штраф движениям/атакам и SPD −1 — уже rules/
//  encumbrance.mjs (inventoryOverloadTier/inventoryOverloadPenalty), этот
//  файл добавляет только сам периодический тест — то, что тот модуль
//  сознательно оставлял «игровым событием» (не расчётом).
//
//  Тот же общий приём worldTime-кулдауна (rules/cooldown.mjs), что и Перевес
//  выключенной силовой брони (combat/armor-mods.mjs, стр. 233) — кнопка на
//  листе, жмётся вручную раз в T.b часов игрового времени, не автоматический
//  хук по ходу времени. SECONDS_PER_HOUR — из constants/imperial-calendar.mjs
//  (тот же источник времени, что и у виджета Календаря: game.time.worldTime
//  общий, поэтому прокрутка Календаря автоматически двигает и этот таймер).
//
//  Накапливающийся штраф ЭТОГО теста — своя ось, отдельная от
//  inventoryOverloadTier: тот даёt ОДИН тир без эскалации (движения/атаки),
//  этот — считает, сколько раз тест уже брался с начала ТЕКУЩЕГО захода в
//  Перевес (inventoryOverloadTestCount), и штрафует −10 за каждый раз после
//  первого. Счётчик обнуляется, когда Перевес кончается (syncInventoryOverloadTimer)
//  — новый заход в Перевес снова начинается с 1-го теста на T+0.
// ════════════════════════════════════════════════════════════════════════════

import { inventoryOverloadTier } from "../rules/encumbrance.mjs";
import { worldTimeRemaining } from "../rules/cooldown.mjs";
import { SECONDS_PER_HOUR } from "../constants/imperial-calendar.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { addFatigue } from "../sheets/tabs/conditions.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";

const FLAG = "warhammer-dbc";
const TEST_AT_FLAG = "inventoryOverloadTestAt";
const TEST_COUNT_FLAG = "inventoryOverloadTestCount";

const sgn = n => `${n >= 0 ? "+" : ""}${n}`;

/** Секунд до следующего теста Перевеса инвентаря (0 — доступен прямо сейчас). */
export function inventoryOverloadPeriodicRemaining(testAt, worldTime, tb) {
  return worldTimeRemaining(testAt, worldTime, (Number(tb) || 0) * SECONDS_PER_HOUR);
}

/**
 * Держит флаг актора `inventoryOverloadTestAt` в согласии с текущим Перевесом
 * инвентаря (rules/encumbrance.mjs::inventoryOverloadTier — производное поле,
 * «предыдущего» значения хуку update* не видно, поэтому сверяется идемпотентно
 * на каждый вызов) — тот же приём, что syncDisabledArmourOverloadTimer
 * (combat/armor-mods.mjs). Перевес кончился — снимает флаг И счётчик тестов
 * (inventoryOverloadTestCount), чтобы следующий заход начинал отсчёт заново.
 */
export async function syncInventoryOverloadTimer(actor) {
  if (!game.user.isGM || !actor) return;
  const overload = inventoryOverloadTier(actor);
  const testAt = actor.getFlag(FLAG, TEST_AT_FLAG);
  const upd = {};
  if (overload && testAt == null) {
    upd[`flags.${FLAG}.${TEST_AT_FLAG}`] = game.time.worldTime;
  } else if (!overload && testAt != null) {
    upd[`flags.${FLAG}.-=${TEST_AT_FLAG}`] = null;
    if (actor.getFlag(FLAG, TEST_COUNT_FLAG) != null) upd[`flags.${FLAG}.-=${TEST_COUNT_FLAG}`] = null;
  }
  if (Object.keys(upd).length) await actor.update(upd);
}

/**
 * Тест Т(+0), накапливающий −10 за каждый предыдущий тест текущего захода в
 * Перевес: провал — 1 Усталость (addFatigue). Таймер и счётчик обновляются в
 * любом исходе — успех тоже тратит интервал и засчитывается «тестом», раз
 * книга не оговаривает иначе.
 */
export async function useInventoryOverloadPeriodicTest(actor) {
  if (!inventoryOverloadTier(actor)) return;
  const testAt = actor.getFlag(FLAG, TEST_AT_FLAG);
  const tb = Number(actor.system?.characteristics?.t?.bonus) || 0;
  const remaining = inventoryOverloadPeriodicRemaining(testAt, game.time.worldTime, tb);
  if (remaining > 0) {
    return ui.notifications.warn("Перевес инвентаря ещё не накопился на новый тест.");
  }

  const count = Number(actor.getFlag(FLAG, TEST_COUNT_FLAG)) || 0;
  const escalation = -10 * count; // 1-й тест захода — на T+0, дальше −10 за каждый следующий.

  const t = actor.system.characteristics?.t?.total ?? 0;
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "t" });
  const parts = [...ruleMods.parts];
  if (escalation) parts.push(`Перевес (накопление) ${sgn(escalation)}`);
  const threshold = t + ruleMods.total + escalation;

  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;
  if (!success) await addFatigue(actor, 1);
  await actor.update({
    [`flags.${FLAG}.${TEST_AT_FLAG}`]: game.time.worldTime,
    [`flags.${FLAG}.${TEST_COUNT_FLAG}`]: count + 1
  });

  const dice = await roll.render();
  await postTestCard(actor, {
    icon: rollIcon("warn", "#ff6b6b"),
    title: `Перевес инвентаря — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Т", base: t, parts, threshold, rv }),
    outcome: success ? outcomeHtml(true, "Успех") : outcomeHtml(false, "Провал — +1 Усталость"),
    sections: [
      `<div class="roll-threshold" style="font-size:.85em;opacity:.8;">Раз в T.b часов Перевеса (стр. 27). Тест по счёту в этом заходе: ${count + 1}.</div>`,
      `<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>`
    ]
  }, { rolls: [roll] });
}
