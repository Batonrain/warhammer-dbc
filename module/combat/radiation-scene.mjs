// module/combat/radiation-scene.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Радиация сцены по часам Календаря (wdbc-c5vf0). Арифметика — rules/
//  radiation-scene.mjs; здесь: на какой сцене актор, часы Состояний
//  (combat/condition-clock.mjs, обработчик "sceneRadiation") и карточка.
//
//  Урон — 1 в Т за тик через единую точку урона в Характеристики
//  (combat/char-damage.mjs), на каждые 10 накопленных тиков — тест T+0, провал
//  даёт лучевую болезнь (флаг radiationSickness, combat/radiation.mjs). Доза
//  радиации сцены ведётся своим флагом (radDose): Состояние «Радиация» остаётся
//  ручным и тикает по Раундам боя, второй счётчик не трогает.
//
//  Радиация сцены действует на Персонажей с токеном на сцене окна «Окружение».
// ════════════════════════════════════════════════════════════════════════════

import { readEnvForScene } from "../constants/scene-nexus.mjs";
import {
  RAD_SHELTER_FLAG, RAD_CLOCK_FLAG, RAD_DOSE_FLAG, RAD_SHELTERS,
  radProtectionOf, effectiveRadiation, radIntervalSeconds, radiationTicks, doseCrossings
} from "../rules/radiation-scene.mjs";
import { applyCharDamage } from "./char-damage.mjs";
import { rollConditionCharTest } from "./condition-ticks.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

/** Сцена, на которой сейчас этот актор (токен), либо активная сцена канвы, если на ней есть его токен. */
export function radiationSceneOf(actor) {
  if (!actor) return null;
  const own = actor.token?.parent;
  if (own) return own;
  const scene = globalThis.canvas?.scene ?? globalThis.game?.scenes?.current ?? null;
  if (!scene) return null;
  const hasToken = [...(scene.tokens ?? [])].some(t => t.actorId === actor.id);
  return hasToken ? scene : null;
}

/**
 * Облучение актора прямо сейчас: сцена, уровень, защита, эффективная
 * интенсивность и интервал. null — актор не персонаж или вне сцены.
 */
export function radiationExposure(actor) {
  if (actor?.type !== "character") return null;
  const scene = radiationSceneOf(actor);
  if (!scene) return null;
  const level = Number(readEnvForScene(scene).rad) || 0;
  const shelter = actor.getFlag?.(NS, RAD_SHELTER_FLAG) ?? "";
  const protection = radProtectionOf(actor, shelter);
  const effective = effectiveRadiation(level, protection);
  return { scene, level, shelter, protection, effective, interval: effective > 0 ? radIntervalSeconds(effective) : null };
}

/** Обработчик часов Состояний: тики радиации сцены за отрезок [from, to]. */
export async function sceneRadiationClock(actor, { from, to }) {
  const ex = radiationExposure(actor);
  if (!ex || !ex.interval) return;

  const prev = actor.getFlag?.(NS, RAD_CLOCK_FLAG) ?? null;
  const { ticks, clock } = radiationTicks(prev, { from, to, interval: ex.interval });
  const dose = Number(actor.getFlag?.(NS, RAD_DOSE_FLAG)) || 0;
  const tests = doseCrossings(dose, ticks);
  const update = { [`flags.${NS}.${RAD_CLOCK_FLAG}`]: clock };
  if (!ticks) return actor.update(update);

  // Каждый тик — отдельный урон: надбавки Угасания/Генома растут от каждого.
  let before = null, after = null, died = false, applied = 0;
  for (let i = 0; i < ticks && !died; i++) {
    const r = await applyCharDamage(actor, "t", 1);
    if (before === null) before = r.before;
    after = r.after; died = r.died; applied++;
  }
  update[`flags.${NS}.${RAD_DOSE_FLAG}`] = dose + applied;

  const lines = [];
  let sick = false;
  for (let i = 0; i < tests && !died; i++) {
    const t = await rollConditionCharTest(actor, "t");
    if (!t.success) sick = true;
    lines.push(`Доза ${(Math.floor(dose / 10) + i + 1) * 10} — тест T+0 (<b>${t.eff}</b>): <b>${t.rv}</b> ${t.success
      ? `<span class="roll-success">успех</span>` : `<span class="roll-failure">провал → лучевая болезнь</span>`}`);
  }
  if (sick) update[`flags.${NS}.radiationSickness`] = true;
  await actor.update(update);

  const prot = ex.protection.parts.length ? ` (защита: ${esc(ex.protection.parts.join(", "))})` : "";
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warp", "#ffe14d")}Радиация сцены — ${esc(actor.name)}</div>
      <div class="roll-threshold">Фон ${ex.level}${prot} → эффективная интенсивность <b>${ex.effective}</b>: урон в T <b>${applied}</b> (T ${before}→${after})${died ? " — <b>умирает</b>" : ""}</div>
      ${lines.map(l => `<div class="roll-threshold">${l}</div>`).join("")}
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/** Подпись укрытия для окна «Окружение». */
export const shelterOptions = selected => Object.entries(RAD_SHELTERS)
  .map(([key, s]) => ({ key, label: s.label, selected: key === (selected ?? "") }));
