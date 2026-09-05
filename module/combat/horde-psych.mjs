// module/combat/horde-psych.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПСИХОЛОГИЧЕСКИЙ УРОН ОРДЫ
//
//  Толпу ломает не только оружие. Массивные потери за Раунд, Страх и Запугивание
//  бьют по воле к бою, и эти провалы снимают Магнитуду так же, как обычный урон —
//  разница в том, что психологический урон лечится Командованием и социалкой.
//
//  Орды, автоматически проходящие тесты на Страх и Запугивание, психологического
//  урона не получают вовсе и Сломлены быть не могут.
// ════════════════════════════════════════════════════════════════════════════

import { psychDamageFor, PSYCH_MULTIPLIERS, WEAKENED_WP_PENALTY, noRecoveryHours }
  from "../rules/horde-damage.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";

/** Флаг: до какого worldTime Ослабленная Орда не лечит психологический урон. */
export const PSYCH_LOCK_FLAG = "hordePsychLockUntil";

export const PSYCH_TESTS = {
  massDamage: { label: "Массивные потери", sub: "тест W+Магнитуда после потери 25%+ за Раунд" },
  fear:       { label: "Страх",            sub: "провал стоит Провалы×2 Магнитуды" },
  intimidate: { label: "Запугивание",      sub: "провал стоит Провалы×1 Магнитуды" }
};

/**
 * Порог психологического теста Орды.
 *
 * Во всех трёх случаях это Воля плюс Магнитуда: толпа держится числом. У
 * Ослабленной Орды (потеряно больше половины) тесты Воли идут с −10.
 */
export function psychThreshold(horde, mod = 0) {
  const wp  = Number(horde.system?.characteristics?.wp?.total) || 0;
  const mag = Number(horde.system?.magnitude?.value) || 0;
  const weakened = horde.system?.derived?.state === "weakened" ? WEAKENED_WP_PENALTY : 0;
  return wp + mag + weakened + (Number(mod) || 0);
}

/**
 * Психологический тест Орды с применением урона.
 *
 * @param {Actor}  horde
 * @param {string} kind  massDamage | fear | intimidate
 * @param {object} [opts]
 * @param {number} [opts.mod] модификатор теста (рейтинг Страха, степень Запугивания)
 */
export async function rollHordePsychTest(horde, kind, { mod = 0 } = {}) {
  const meta = PSYCH_TESTS[kind];
  if (!meta || !PSYCH_MULTIPLIERS[kind]) return null;

  // Несломляемая Орда проходит такие тесты автоматически — и потому неуязвима
  // для психологического урона.
  if (horde.system?.immuneFear) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: horde }),
      content: `<div class="wh-roll-result horde-psych">
        <div class="roll-header">${esc(horde.name)} — ${esc(meta.label)}</div>
        <div class="roll-outcome"><span class="roll-success">Тест пройден автоматически — психологического урона нет</span></div>
      </div>`
    });
    return { immune: true, psychDamage: 0 };
  }

  // Общий сбор модификаторов (wdbc-kok3). Бросает сама Орда, поэтому и
  // правила берутся её: Черты Орды, её предметы, её Состояния. Психология
  // Орды — Страх, Паника и Подавление — по книге тесты Морали, отсюда
  // morale:true.
  //
  // Штрафы состояния тела на Орде безвредны по построению: у неё нет ни
  // Усталости, ни шлема, ни инвентаря, и каждый из них честно возвращает 0,
  // а не подставляет чужое число.
  const ruleMods = collectTestMods(horde, { kind: "skill", char: "wp", morale: true });
  const threshold = psychThreshold(horde, mod) + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const passed = rv <= threshold;
  const deg = Math.floor(Math.abs(rv - threshold) / 10) + 1;
  const damage = passed ? 0 : psychDamageFor(kind, deg);

  if (damage > 0) await applyPsychDamage(horde, damage);

  const weakenedNote = horde.system?.derived?.state === "weakened"
    ? ` · Ослаблена: ${WEAKENED_WP_PENALTY}` : "";

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: horde }),
    content: `<div class="wh-roll-result horde-psych">
      <div class="roll-header">${esc(horde.name)} — ${esc(meta.label)}</div>
      <div class="roll-threshold">Порог <b>${threshold}</b> = W ${horde.system?.characteristics?.wp?.total ?? 0}
        + Магнитуда ${horde.system?.magnitude?.value ?? 0}${mod ? ` · мод. ${mod >= 0 ? "+" : ""}${mod}` : ""}${ruleMods.parts.map(p => ` · ${p}`).join("")}${weakenedNote}</div>
      <div class="roll-dice">Бросок: <b>${rv}</b></div>
      <div class="roll-outcome">${passed
        ? `<span class="roll-success">Успех (${deg} ${_degWord(deg)}) — строй держится</span>`
        : `<span class="roll-failure">Провал (${deg} ${_degWord(deg)}) — психологический урон ×${PSYCH_MULTIPLIERS[kind]} = <b>${damage}</b> Магнитуды</span>`}</div>
      <div class="roll-damage-meta">${esc(meta.sub)}</div>
    </div>`,
    rolls: [roll]
  }, game.settings.get("core", "rollMode")));

  return { passed, degrees: deg, psychDamage: damage };
}

/**
 * Наносит психологический урон: он уменьшает Магнитуду так же, как обычный,
 * но копится отдельно — только его можно «вылечить» речью и угрозами.
 */
export async function applyPsychDamage(horde, amount) {
  const sys = horde.system ?? {};
  if (sys.immuneFear) return 0;
  const damage = Math.max(0, Number(amount) || 0);
  if (!damage) return 0;

  const value = Math.max(0, Number(sys.magnitude?.value) || 0);
  await horde.update({
    "system.magnitude.value": Math.max(0, value - damage),
    "system.psychDamage": (Number(sys.psychDamage) || 0) + damage
  });
  return damage;
}

/**
 * Лечение психологического урона (Командование, социальные взаимодействия).
 * Возвращает, сколько удалось вернуть: обычные потери так не восполняются, и
 * Ослабленная Орда не лечится 10−W.b часов после того, как просела за половину.
 */
export async function healPsychDamage(horde, amount) {
  const sys = horde.system ?? {};
  const psych = Math.max(0, Number(sys.psychDamage) || 0);
  const healed = Math.min(Math.max(0, Number(amount) || 0), psych);
  if (!healed) return 0;

  const value = Math.max(0, Number(sys.magnitude?.value) || 0);
  const start = Math.max(0, Number(sys.magnitude?.start) || 0);
  await horde.update({
    "system.magnitude.value": start > 0 ? Math.min(start, value + healed) : value + healed,
    "system.psychDamage": psych - healed
  });
  return healed;
}

/** Заперто ли лечение психологического урона прямо сейчас. */
export function psychHealLocked(horde) {
  const until = Number(horde?.getFlag?.("warhammer-dbc", PSYCH_LOCK_FLAG)) || 0;
  if (!until) return null;
  const now = Number(game?.time?.worldTime) || 0;
  if (now >= until) return null;
  return { until, hoursLeft: Math.ceil((until - now) / 3600) };
}

/**
 * Ставит запрет на лечение психологического урона: Орда, потерявшая больше
 * половины, не восстанавливает его 10−W.b часов.
 */
export async function lockPsychHealing(horde) {
  const wpBonus = Number(horde.system?.characteristics?.wp?.bonus) || 0;
  const hours = noRecoveryHours(wpBonus);
  if (hours <= 0) return 0;
  const now = Number(game?.time?.worldTime) || 0;
  await horde.setFlag("warhammer-dbc", PSYCH_LOCK_FLAG, now + hours * 3600);
  return hours;
}
