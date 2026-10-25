// module/combat/vacuum.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Вакуум и Взрывная Декомпрессия (корбук, «Опасности», стр. 483, Sahara
//  trade-voidfarer-10-wdbc-dbveg) — Foundry-обвязка поверх module/rules/
//  vacuum.mjs. Образец — тест Жары/Холода (combat/temperature-hazard.mjs):
//  флаг сцены из окна «Окружение», карточка с плашкой Порога, общий сбор
//  модификаторов.
//
//   • Тест вакуума — в начале Хода персонажа на сцене с флагом «вакуум»
//     (hooks.mjs::updateCombat → processVacuumTurnStart) и кнопкой 🎲 виджета
//     «Окружение» (там же спрашиваются «задержал дыхание» и «глаза закрыты»;
//     выбор запоминается флагами актора и работает на следующих Ходах).
//     Провал — непоглощаемый урон в Торс по числу Провалов (+1d5 при
//     задержке дыхания), Преимущество Крепкого как Камень — бросок дважды.
//   • Глаза не закрыты — Blinding(0) каждый Ход: тест Per+0, провал —
//     Ослепление на раунд за каждую степень провала (тот же путь, что у
//     свойства Blinding в hooks.mjs: единая точка наложения Состояния).
//   • Декомпрессия — GM ставит шаблон взрыва радиусом 10×ширина пробоя
//     (combat/templates.mjs), один бросок 2d10 непоглощаемого X на всех
//     накрытых без пустотной брони (так же, как Взрывное: «один бросок на всех»).
// ════════════════════════════════════════════════════════════════════════════

import { readEnvForScene, currentScene } from "../constants/scene-nexus.mjs";
import {
  voidArmourOf, vacuumApplies, vacuumTestPlan, vacuumDamage, decompressionRadius,
  isDecompressionVictim, VACUUM_BREATH_FAIL_DIE, DECOMPRESSION_DAMAGE
} from "../rules/vacuum.mjs";
import { vacuumResistReroll } from "../rules/squat-traits.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { TEMPERED_COCOON_CAP } from "../rules/situational.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { secondaryCritHtml } from "./secondary-crit.mjs";
import { rollConditionCharTest } from "./condition-ticks.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { hasWeaponPropertyImmunity } from "./weapon-properties.mjs";
import { blastCircleShape, placeAttackTemplate, pxPerMeter } from "./templates.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const NS = "warhammer-dbc";
/** Запомненный выбор игрока: «задерживает дыхание». */
export const HOLD_BREATH_FLAG = "vacuumHoldBreath";
/** Запомненный выбор игрока: «глаза закрыты». */
export const EYES_CLOSED_FLAG = "vacuumEyesClosed";

const ICON = () => rollIcon("warp", "#8a7fd0");

/** Сцена в вакууме (флаг окна «Окружение»). */
export function sceneIsVacuum(scene) {
  return !!scene && readEnvForScene(scene).vacuum === true;
}

/** Запомненные галочки актора. */
export function vacuumOptionsOf(actor) {
  return {
    holdBreath: !!actor?.getFlag?.(NS, HOLD_BREATH_FLAG),
    eyesClosed: !!actor?.getFlag?.(NS, EYES_CLOSED_FLAG)
  };
}

/**
 * «Глаза не закрыты от вакуума → Blinding(0) каждый Ход»: тест Per+0, провал —
 * Ослепление на раунд за степень провала. Иммунитет к Blinding гасит попадание.
 * @returns {Promise<string>} строки для карточки
 */
async function blindingHit(actor) {
  if (hasWeaponPropertyImmunity(actor, "blinding")) {
    return `<div class="roll-threshold">${ICON()}Blinding(0): иммунитет — глаза не страдают</div>`;
  }
  const t = await rollConditionCharTest(actor, "per");
  const { success, deg } = testOutcome(t.rv, t.eff);
  if (success) {
    return `<div class="roll-threshold">${ICON()}Глаза открыты — Blinding(0): тест Per+0 (<b>${t.eff}</b>): <b>${t.rv}</b> ${outcomeHtml(true, "успех")}</div>`;
  }
  const fields = conditionApplyFields("blinded", Math.max(Number(actor.system?.conditions?.blindedRounds) || 0, deg), actor);
  if (Object.keys(fields).length) await actor.update(fields);
  return `<div class="roll-threshold">${ICON()}Глаза открыты — Blinding(0): тест Per+0 (<b>${t.eff}</b>): <b>${t.rv}</b> ${
    outcomeHtml(false, Object.keys(fields).length ? `провал → 🙈 Ослеплён на ${deg} р.` : "провал — иммунитет к Ослеплению")}</div>`;
}

/**
 * Тест вакуума одного персонажа. Возвращает false, если бросать нечего
 * (воздух есть, актор защищён пустотной бронёй).
 *
 * @param {Actor}  actor
 * @param {object} [o]
 * @param {boolean} [o.holdBreath]  задержал дыхание (иначе — запомненный выбор)
 * @param {boolean} [o.eyesClosed]  глаза закрыты от вакуума (иначе — запомненный)
 * @param {boolean} [o.manual]      вызвано кнопкой: молчаливые отказы заменяются уведомлением
 * @param {object}  [o.scene]       сцена актора (по умолчанию текущая)
 */
export async function rollVacuumTest(actor, { holdBreath, eyesClosed, manual = false, scene = null } = {}) {
  if (!actor) return false;
  const here = scene ?? currentScene();
  if (!sceneIsVacuum(here)) {
    if (manual) ui.notifications?.info("Воздух есть — тест вакуума не нужен.");
    return false;
  }
  const armour = voidArmourOf(actor);
  if (armour) {
    if (manual) ui.notifications?.info(`${actor.name}: ${armour.name} — пустотная броня защищает от вакуума.`);
    return false;
  }
  if (!vacuumApplies(actor)) {
    if (manual) ui.notifications?.info(`${actor.name}: вакуум на этот тип существа не действует.`);
    return false;
  }

  const saved = vacuumOptionsOf(actor);
  const hold = holdBreath ?? saved.holdBreath;
  const closed = eyesClosed ?? saved.eyesClosed;

  const plan = vacuumTestPlan(actor, { holdBreath: hold });
  // Общий сбор модификаторов (Усталость, Черты, области "vacuum"/char:t) — как
  // у Жары/Холода и Страха; раньше тесты в тиках шли голым T.
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "t", vacuumTest: true });
  const threshold = plan.threshold + ruleMods.total;
  // Закалённый Кокон: «вместо переброса этих тестов от Мукраноида — Преимущество»
  // (так же, как в тесте Жары/Холода); Крепкий как Камень даёт его независимо.
  const advantage = vacuumResistReroll(actor)
    ?? (hasRuleFlag(actor, TEMPERED_COCOON_CAP)
      ? { rolls: 2, mode: "keepBest", label: "Преимущество (Закалённый Кокон)" } : null);
  const { rv, rolls } = await rollD100WithReroll(advantage);
  const { success, deg } = testOutcome(rv, threshold);

  const sections = [];
  let outcome;
  if (success) {
    outcome = outcomeHtml(true, "Успех — организм держится");
  } else {
    let breathRoll = 0;
    let breathDie = null;
    if (hold) {
      breathDie = await new Roll(VACUUM_BREATH_FAIL_DIE).evaluate();
      breathRoll = breathDie.total;
      rolls.push(breathDie);
    }
    const { amount, breath } = vacuumDamage(deg, { holdBreath: hold, breathRoll });
    const loss = await applyWoundLoss(actor, amount);
    const detail = `${deg} ${deg === 1 ? "Провал" : "Провалов"}${breath ? ` + ${breath} (задержка дыхания, ${VACUUM_BREATH_FAIL_DIE})` : ""}`;
    outcome = outcomeHtml(false, `Провал — ${amount} непоглощаемого X Dmg в Торс (${detail})`);
    sections.push(`<div class="roll-threshold">Раны: ${loss.currentWounds} → ${loss.newWounds}${loss.gotCritical ? ` (крит. <b>${loss.newCritical}</b>)` : ""}</div>`);
    const crit = await secondaryCritHtml(actor, loss, { damageType: "blast", hitLocation: "Торс" });
    if (crit) sections.push(crit);
  }

  // Каждый Ход открытые глаза бьют отдельным попаданием, независимо от теста.
  if (!closed) sections.push(await blindingHit(actor));

  const noteParts = [];
  if (advantage) noteParts.push(`<div class="roll-threshold">${esc(advantage.label)}: броски ${rolls.slice(0, advantage.rolls).map(r => r.total).join(" и ")}, берётся лучший.</div>`);
  if (hold) noteParts.push(`<div class="roll-threshold">Дыхание задержано: −30 к тесту, +1d5 урона при провале.</div>`);
  if (closed) noteParts.push(`<div class="roll-threshold">Глаза закрыты — Blinding(0) не бьёт.</div>`);

  await postTestCard(actor, {
    icon: ICON(),
    title: `Вакуум — ${esc(actor.name)}`,
    threshold: rollStatLine({
      label: plan.skill === "Voidfarer" ? "Trade (Voidfarer)(T)" : "T",
      base: plan.base, parts: [...plan.parts, ...ruleMods.parts.map(esc)], threshold, rv
    }),
    outcome: noteParts.join("") + outcome,
    sections
  }, { rolls });
  return true;
}

/**
 * Начало Хода в вакууме (hooks.mjs::updateCombat): тест по запомненным
 * галочкам. Молча ничего не делает вне вакуумной сцены и у защищённых.
 */
export async function processVacuumTurnStart(actor, token = null) {
  const scene = token?.parent ?? token?.scene ?? currentScene();
  if (!actor || !sceneIsVacuum(scene)) return;
  await rollVacuumTest(actor, { scene });
}

/**
 * Кнопка 🎲 виджета: спрашивает «задержал дыхание» и «глаза закрыты», запоминает
 * выбор на акторе и бросает тест.
 */
export async function askAndRollVacuum(actor) {
  if (!actor) return false;
  const saved = vacuumOptionsOf(actor);
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: `Вакуум — ${actor.name}` },
    classes: ["wh-roll-dialog-window"],
    content: `<form class="wh-vacuum-dialog">
      <label><input type="checkbox" name="holdBreath" ${saved.holdBreath ? "checked" : ""}/> Задержал дыхание (−30 к тесту, +1d5 урона при провале)</label>
      <label><input type="checkbox" name="eyesClosed" ${saved.eyesClosed ? "checked" : ""}/> Глаза закрыты (иначе Blinding(0) каждый Ход)</label>
    </form>`,
    buttons: [{
      action: "roll", label: "Бросить", default: true,
      callback: (_ev, button) => ({
        holdBreath: !!button.form?.elements?.holdBreath?.checked,
        eyesClosed: !!button.form?.elements?.eyesClosed?.checked
      })
    }],
    rejectClose: false
  });
  if (!result) return false;
  await actor.update({ [`flags.${NS}.${HOLD_BREATH_FLAG}`]: result.holdBreath, [`flags.${NS}.${EYES_CLOSED_FLAG}`]: result.eyesClosed });
  // В бою тест идёт сам в начале Хода: второй бросок за тот же Ход дал бы второй
  // урон. Кнопка только запоминает галочки — они сработают со следующего Хода.
  if (actorInStartedCombat(actor, globalThis.game?.combat)) {
    ui.notifications?.info(`${actor.name}: выбор запомнен — тест вакуума пройдёт в начале следующего Хода.`);
    return false;
  }
  return rollVacuumTest(actor, { ...result, manual: true });
}

/** Актор участвует в начатом бою: тест вакуума катается сам в начале его Хода. */
export function actorInStartedCombat(actor, combat) {
  if (!actor || !combat?.started) return false;
  return [...(combat.combatants ?? [])].some(c => c?.actor === actor || (actor.id != null && c?.actorId === actor.id));
}

/**
 * Взрывная Декомпрессия: ГМ ставит шаблон радиусом 10×ширина пробоя, один бросок
 * 2d10 непоглощаемого X Dmg всем накрытым без пустотной брони.
 * @param {number} width  ширина пробоя или шлюза, метры
 */
export async function placeDecompression(width) {
  const radius = decompressionRadius(width);
  if (!radius) return ui.notifications?.warn("Декомпрессия: укажите ширину пробоя в метрах (больше нуля).");
  const placed = await placeAttackTemplate(blastCircleShape(radius, pxPerMeter()), `Взрывная Декомпрессия (${radius} м)`);
  if (!placed) return;
  const roll = await new Roll(DECOMPRESSION_DAMAGE).evaluate();
  const amount = roll.total;

  const lines = [];
  const spared = [];
  for (const tok of placed.tokens) {
    const actor = tok.actor;
    if (!isDecompressionVictim(actor)) {
      if (actor && voidArmourOf(actor)) spared.push(esc(tok.name || actor.name));
      continue;
    }
    const loss = await applyWoundLoss(actor, amount);
    let line = `<div class="roll-threshold"><b>${esc(tok.name || actor.name)}</b>: ${amount} непоглощаемого X Dmg · Раны ${loss.currentWounds} → ${loss.newWounds}${loss.gotCritical ? ` (крит. <b>${loss.newCritical}</b>)` : ""}</div>`;
    line += await secondaryCritHtml(actor, loss, { damageType: "blast", hitLocation: "Торс" });
    lines.push(line);
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ alias: "Окружение" }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${ICON()}Взрывная Декомпрессия — радиус ${radius} м</div>
      <div class="roll-threshold">${DECOMPRESSION_DAMAGE} = <b>${amount}</b> непоглощаемого X Dmg всем без пустотной брони</div>
      ${lines.join("") || `<div class="roll-threshold">В зоне некого поражать.</div>`}
      ${spared.length ? `<div class="roll-threshold">Защищены пустотной бронёй: ${spared.join(", ")}</div>` : ""}
    </div>`,
    rolls: [roll]
  }, game.settings.get("core", "rollMode")));
}
