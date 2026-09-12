// module/combat/temperature-hazard.mjs
// ════════════════════════════════════════════════════════════════════════
//  Тест на Жару/Холод (wdbc-1rno) — Foundry-обвязка поверх module/rules/
//  temperature-hazard.mjs. Тот же приём, что Лучевая болезнь (combat/
//  radiation.mjs): кнопка жмётся вручную, worldTime-кулдаун гейтит повтор,
//  провал даёт +1 Усталости (та же цена, что «Удушье», combat/condition-
//  ticks.mjs, — книга не задаёт для жары/холода своего отдельного
//  наказания на этой странице, «доп. урон» описан только у более тяжёлых
//  осложнений соседних правил).
//
//  Breeze/Бриз (Общие Мутации, wdbc-1rno): «не получает штрафов за
//  экстремальную жару или холод» — держателю тест не нужен вовсе, кнопка
//  сама об этом сообщает и ничего не катает.
// ════════════════════════════════════════════════════════════════════════

import { isWorldTimeCooldownReady, worldTimeRemaining } from "../rules/cooldown.mjs";
import { tempEffect } from "../constants/environment.mjs";
import { readEnvForScene, currentScene } from "../constants/scene-nexus.mjs";
import { tempHazardIntervalSeconds, BREEZE_CAPABILITY } from "../rules/temperature-hazard.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { addFatigue } from "../sheets/tabs/conditions.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const FLAG = "warhammer-dbc";
const TEST_AT_FLAG = "tempHazardTestAt";

/** Секунд до следующего доступного теста (0 — доступен прямо сейчас). */
export function tempHazardRemaining(testAt, worldTime, intervalSeconds) {
  return worldTimeRemaining(testAt, worldTime, intervalSeconds);
}

/**
 * Клик по кнопке (виджет Окружения) — тест T+модификатор книги, провал даёт
 * +1 Усталости; таймер сбрасывается в любом исходе. Молча ничего не делает
 * (тостом), если температура в комфортной зоне, частота не распознана, ещё
 * не время, или носитель Бриза.
 */
export async function rollTempHazardTest(actor) {
  if (!actor) return;
  if (hasRuleFlag(actor, BREEZE_CAPABILITY)) {
    return ui.notifications?.info(`${actor.name}: Бриз держит вокруг комфортную температуру — тест не нужен.`);
  }

  const env = readEnvForScene(currentScene());
  const effect = tempEffect(env.temp);
  if (!effect.active) return ui.notifications?.info("Температура в комфортной зоне — тест не нужен.");

  const interval = tempHazardIntervalSeconds(effect.freq);
  if (interval == null) {
    return ui.notifications?.warn(`Тест на Жару/Холод: неизвестная частота «${effect.freq}» — сверьте reader.`);
  }
  if (!isWorldTimeCooldownReady(actor, TEST_AT_FLAG, interval)) {
    return ui.notifications?.warn("Тест на Жару/Холод: ещё не время для следующей попытки.");
  }

  const t = Number(actor.system?.characteristics?.t?.total) || 0;
  const threshold = t + (Number(effect.test) || 0);
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= threshold;

  await actor.update({ [`flags.${FLAG}.${TEST_AT_FLAG}`]: game.time.worldTime });
  if (!success) await addFatigue(actor, 1);

  const sign = effect.test >= 0 ? `+${effect.test}` : `${effect.test}`;
  await postTestCard(actor, {
    icon: rollIcon(effect.kind === "cold" ? "shield" : "burst", effect.tone || "#ff8a5a"),
    title: `${effect.kind === "cold" ? "Холод" : "Жара"} — ${esc(actor.name)}`,
    threshold: `<div class="roll-threshold">T <b>${t}</b>${sign} → Порог <b>${threshold}</b> (${esc(effect.label)})</div>`,
    rv: roll.total,
    outcome: success
      ? `<span class="roll-success">Успех</span>`
      : `<span class="roll-failure">Провал — 😓 Усталость +1</span>`
  }, { rolls: [roll] });
}
