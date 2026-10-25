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
import { collectTestMods } from "../rules/roll-mods.mjs";
import { TEMPERED_COCOON_CAP } from "../rules/situational.mjs";
import { addFatigue } from "../sheets/tabs/conditions.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
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

  // Общий сбор модификаторов (как Лучевая болезнь/Страх): Усталость и Черты —
  // Сопротивление (Cold/Heat) +10, Закалённый Кокон +10 — раньше тест шёл
  // голым T+штраф и ничего из этого не видел (3-b530, 3-edc4 п.7).
  const isCold = effect.kind === "cold";
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "t", ...(isCold ? { coldTest: true } : { heatTest: true }) });
  const t = Number(actor.system?.characteristics?.t?.total) || 0;
  const threshold = t + (Number(effect.test) || 0) + ruleMods.total;
  // Закалённый Кокон: «вместо переброса этих тестов от Мукраноида — Преимущество»
  // (два кубика, берётся лучший). Без Кокона бросок один.
  const advantage = hasRuleFlag(actor, TEMPERED_COCOON_CAP);
  const rolls = [await new Roll("1d100").evaluate()];
  if (advantage) rolls.push(await new Roll("1d100").evaluate());
  const roll = rolls.reduce((a, b) => (b.total < a.total ? b : a));
  const success = roll.total <= threshold;

  await actor.update({ [`flags.${FLAG}.${TEST_AT_FLAG}`]: game.time.worldTime });
  if (!success) await addFatigue(actor, 1);

  const sign = effect.test >= 0 ? `+${effect.test}` : `${effect.test}`;
  await postTestCard(actor, {
    icon: rollIcon(isCold ? "shield" : "burst", effect.tone || "#ff8a5a"),
    title: `${isCold ? "Холод" : "Жара"} — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "T", base: t, parts: [sign, esc(effect.label), ...ruleMods.parts.map(esc)], threshold, rv: roll.total }),
    outcome: (advantage ? `<div class="roll-threshold">Закалённый Кокон: Преимущество — броски ${rolls.map(r => r.total).join(" и ")}, берётся лучший.</div>` : "")
      + (success
        ? `<span class="roll-success">Успех</span>`
        : `<span class="roll-failure">Провал — 😓 Усталость +1</span>`)
  }, { rolls });
}
