// module/combat/aiming-action.mjs
// ════════════════════════════════════════════════════════════════════════
//  Прицеливание как HUD-действие (wdbc-1rno.5). Было: радио «Без прицела/
//  Полу/Полное» прямо в диалоге атаки (module/sheets/attack-dialog.mjs),
//  actor.system.aiming менялось без расхода ОД вовсе. Теперь — две кнопки в
//  боевом HUD (module/apps/hud.mjs), тем же паттерном, что movementMenuItems
//  (combat/movement-actions.mjs): список пунктов с action(), без сериализации
//  функции в шаблон.
//
//  Бонус к порогу атаки и его потребители (Sniper Assassin, hip-fire,
//  Fanning) не тронуты — attack-dialog.mjs как читал actor.system.aiming, так
//  и читает, не зная, откуда оно взялось. Не «прицеливание по клику»
//  (combat/aim.mjs — выбор цели мышью для стрельбы, другая вещь, несмотря на
//  созвучное имя файла).
// ════════════════════════════════════════════════════════════════════════

import { hasActionEconomy, isEncounterActive, spendActionPoints, spendReaction, canSpendReaction } from "./action-economy.mjs";
import { aimApCost } from "../rules/aiming.mjs";
import { isTokenInSight } from "../rules/vision-target.mjs";
import { hasAimFocus, AIM_FOCUS_PENDING_FLAG, AIM_FOCUS_EXTENDED_FLAG } from "../rules/aim-focus.mjs";
import { hasTrackingAim, TRACKING_AIM_PENDING_FLAG, TRACKING_AIM_ACTIVE_FLAG } from "../rules/tracking-aim.mjs";
import { psalmCognitionCost, canSpendCognition, spendCognition } from "../rules/psalm-of-guidance.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/**
 * Видит ли актор хотя бы одну выбранную (game.user.targets) цель — для
 * бесплатного Полу-Прицеливания Чёрных Глаз (Cor 80+, «если он видит
 * цель»). Геометрическое приближение (см. rules/vision-target.mjs) — не
 * полноценная LoS, но не хуже прочих гейтов этого проекта на прямой цели.
 */
function actorSeesAnyTarget(actor) {
  const token = actor?.getActiveTokens?.(false)?.[0]?.document;
  const targets = [...(game.user?.targets ?? [])].map(t => t.document).filter(Boolean);
  if (!token || !targets.length) return false;
  const grid = canvas?.scene?.grid ?? { size: 100, distance: 1 };
  return targets.some(t => isTokenInSight(token, t, grid));
}

/**
 * Tracking Aim/Прицел на Упреждение (wdbc-1rno.5, rules/tracking-aim.mjs):
 * бесплатный (без ОД/Реакции) тест P+0 прямо в момент объявления
 * Прицеливания — успех ставит TRACKING_AIM_ACTIVE_FLAG (гасит штраф −20 за
 * Бег цели на следующем выстреле, attack-dialog.mjs::runningMod), провал —
 * только чат-карточка, тест израсходован впустую (тот же принцип, что у
 * Поклона Публике, bow-to-audience.mjs).
 */
async function rollTrackingAimTest(actor) {
  const perTotal = Number(actor.system?.characteristics?.per?.total) || 0;
  const ruleMods = collectTestMods(actor, { kind: "characteristic", char: "per" });
  const threshold = perTotal + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  if (success) await actor.setFlag("warhammer-dbc", TRACKING_AIM_ACTIVE_FLAG, true);
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark", "#c98bff")}${esc(actor.name)} — Прицел на Упреждение</div>
      <div class="roll-threshold">P+0${ruleMods.parts.map(p => ` ${p}`).join("")} = <b>${threshold}</b>, бросок <b>${roll.total}</b> — ${success ? `успех, степень ${deg}` : "провал"}.</div>
      ${success
        ? `<div class="roll-threshold">Следующий дальнобойный выстрел игнорирует штраф за Бег цели.</div>`
        : `<div class="roll-threshold">Тест израсходован впустую.</div>`}
    </div>`
  }, game.settings.get("core", "rollMode")));
  return success;
}

/**
 * Клик по кнопке: тратит ОД (или 0 — Чёрные Глаза) и объявляет Прицеливание.
 * Псалом Наставления/Psalm of the Guidance (wdbc-1rno.5, rules/psalm-of-
 * guidance.mjs): Техножрец с Cognis-оружием платит Когницией ВМЕСТО ОД
 * (1 для Полу-, 2 для Полного) — «может тратить», не обязан: не хватает
 * Когниции — просто платит обычным ОД, без предупреждения (тихий фоллбэк).
 * Aim Focus/Фокус на Прицеле (wdbc-1rno.5, rules/aim-focus.mjs): если у
 * актора есть Талант и включена HUD-галочка (AIM_FOCUS_PENDING_FLAG), клик
 * ЕЩЁ тратит 1 Реакцию и ставит "pending" — продлевает Прицеливание до конца
 * следующего Хода вместо одной атаки. Нет Реакции — Прицеливание всё равно
 * объявляется, просто без продления (галочка гасится в любом случае — это
 * одноразовый выбор на этот клик, не персистентный режим).
 * Tracking Aim/Прицел на Упреждение — та же галочка-до-клика форма, но не
 * тратит ОД/Реакцию, просто катает P+0 тест (см. rollTrackingAimTest выше).
 */
function declareAim(actor, level) {
  return async () => {
    const cogCost = psalmCognitionCost(actor, level);
    const paidWithCognition = cogCost != null && canSpendCognition(actor, cogCost)
      && await spendCognition(actor, cogCost);
    if (!paidWithCognition) {
      const cost = aimApCost(actor, level, { seesTarget: actorSeesAnyTarget(actor) });
      if (!await spendActionPoints(actor, cost)) {
        ui.notifications?.warn(`⚠️ Не хватает ОД (нужно ${cost}).`);
        return false;
      }
    }
    const wantsFocus = hasAimFocus(actor) && !!actor.getFlag?.("warhammer-dbc", AIM_FOCUS_PENDING_FLAG);
    let focusApplied = false;
    if (wantsFocus) {
      if (await spendReaction(actor)) {
        focusApplied = true;
      } else {
        ui.notifications?.warn("⚠️ Не хватает Реакции для Фокуса на Прицеле — Прицеливание объявлено без продления.");
      }
      await actor.unsetFlag("warhammer-dbc", AIM_FOCUS_PENDING_FLAG);
    }
    const wantsTracking = hasTrackingAim(actor) && !!actor.getFlag?.("warhammer-dbc", TRACKING_AIM_PENDING_FLAG);
    if (wantsTracking) await actor.unsetFlag("warhammer-dbc", TRACKING_AIM_PENDING_FLAG);
    await actor.update({ "system.aiming": level });
    if (focusApplied) await actor.setFlag("warhammer-dbc", AIM_FOCUS_EXTENDED_FLAG, "pending");
    else if (actor.getFlag?.("warhammer-dbc", AIM_FOCUS_EXTENDED_FLAG)) await actor.unsetFlag("warhammer-dbc", AIM_FOCUS_EXTENDED_FLAG);
    if (wantsTracking) await rollTrackingAimTest(actor);
    else if (actor.getFlag?.("warhammer-dbc", TRACKING_AIM_ACTIVE_FLAG)) await actor.unsetFlag("warhammer-dbc", TRACKING_AIM_ACTIVE_FLAG);
    return true;
  };
}

/**
 * Подпись цены кнопки — Когниция (Псалом Наставления), если применимо и её
 * хватает прямо сейчас, иначе обычная цена ОД (или «Свободное»).
 */
function aimCostLabel(actor, level, seesTarget) {
  const cogCost = psalmCognitionCost(actor, level);
  if (cogCost != null && canSpendCognition(actor, cogCost)) {
    return `${cogCost} ${cogCost === 1 ? "Когниция" : "Когниции"}`;
  }
  const apCost = aimApCost(actor, level, { seesTarget });
  return apCost ? `${apCost} ОД` : "Свободное";
}

/** Пункты HUD — тот же паттерн, что movementMenuItems (movement-actions.mjs). */
export function aimMenuItems(actor) {
  if (!hasActionEconomy(actor) || !isEncounterActive()) return [];
  const seesTarget = actorSeesAnyTarget(actor);
  return [
    { key: "aimHalf", label: "Полу-прицеливание", cost: aimCostLabel(actor, "half", seesTarget),
      action: declareAim(actor, "half") },
    { key: "aimFull", label: "Полное Прицеливание", cost: aimCostLabel(actor, "full", seesTarget),
      action: declareAim(actor, "full") }
  ];
}

/**
 * Галочка «Фокус на Прицеле» — только у обладателя Таланта, показывает
 * текущее включено/выключено состояние (AIM_FOCUS_PENDING_FLAG) и хватает
 * ли Реакции прямо сейчас (для предупреждения в подсказке, клика не
 * блокирует — реального гейта на само объявление Прицеливания это не даёт,
 * тратится оно чуть позже, в declareAim).
 */
export function aimFocusToggleState(actor) {
  if (!hasActionEconomy(actor) || !isEncounterActive() || !hasAimFocus(actor)) return null;
  return {
    pending: !!actor.getFlag?.("warhammer-dbc", AIM_FOCUS_PENDING_FLAG),
    reactionOk: canSpendReaction(actor)
  };
}

/** Клик по галочке — переключить AIM_FOCUS_PENDING_FLAG. */
export async function toggleAimFocusPending(actor) {
  const cur = !!actor.getFlag?.("warhammer-dbc", AIM_FOCUS_PENDING_FLAG);
  if (cur) await actor.unsetFlag("warhammer-dbc", AIM_FOCUS_PENDING_FLAG);
  else await actor.setFlag("warhammer-dbc", AIM_FOCUS_PENDING_FLAG, true);
}

/**
 * Галочка «Прицел на Упреждение» — только у обладателя Таланта. Не тратит
 * Реакцию (в отличие от Фокуса), поэтому reactionOk тут нет.
 */
export function trackingAimToggleState(actor) {
  if (!hasActionEconomy(actor) || !isEncounterActive() || !hasTrackingAim(actor)) return null;
  return { pending: !!actor.getFlag?.("warhammer-dbc", TRACKING_AIM_PENDING_FLAG) };
}

/** Клик по галочке — переключить TRACKING_AIM_PENDING_FLAG. */
export async function toggleTrackingAimPending(actor) {
  const cur = !!actor.getFlag?.("warhammer-dbc", TRACKING_AIM_PENDING_FLAG);
  if (cur) await actor.unsetFlag("warhammer-dbc", TRACKING_AIM_PENDING_FLAG);
  else await actor.setFlag("warhammer-dbc", TRACKING_AIM_PENDING_FLAG, true);
}
