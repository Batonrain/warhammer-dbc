// module/apps/cancerous-healing.mjs
//
// UI/действие Мутации «Cancerous Healing / Раковое Исцеление» (wdbc-w8ws) —
// см. module/rules/cancerous-healing.mjs про арифметику. Кнопка на листе
// Мутации: берёт текущую цель (game.user.targets, тот же приём, что Bone
// Song/Первая Помощь) как «касание», полное действие отыгрывается флейвором
// в чате, не отдельным трекером ОД.
//
// Штраф −2 A/−2 S за каждую аблативную Рану цели живёт отдельным embedded
// ActiveEffect ПРЯМО НА АКТОРЕ цели (не на предмете — цель не носит саму
// Мутацию), пересобирается заново при каждом изменении её флага-вклада
// CANCEROUS_HEALING_FLAG (см. syncCancerousHealingPenalty ниже и хук
// updateActor в warhammer-dbc.mjs) — считается ТОЛЬКО от доли именно этого
// касания, посторонний аблатив на том же акторе (напр. Absurdly Fat) не
// штрафуется, тем же разделением, что и сам грант (rules/wounds.mjs::
// replaceAblativeContribution).

import { isCancerousHealingItem, cancerousHealingGrant, cancerousHealingPenaltyValue,
         cancerousHealingShrinkAfterHeal, cancerousHealingShrinkToFit, CANCEROUS_HEALING_FLAG }
  from "../rules/cancerous-healing.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { expectedPhase } from "../constants/effect-keys.mjs";

export { isCancerousHealingItem };

const FLAG = "warhammer-dbc";
const PENALTY_FLAG = "cancerousHealingPenalty";

/** Существующий эффект-штраф на акторе, если есть. */
function penaltyEffectOf(actor) {
  return actor?.effects?.find(e => e.getFlag?.(FLAG, PENALTY_FLAG)) || null;
}

/**
 * Пересобрать штраф под ТЕКУЩИЙ размер доли ИМЕННО этого источника (флаг
 * CANCEROUS_HEALING_FLAG, не весь system.wounds.ablative актора — на нём
 * может сидеть и посторонний аблатив, книга штрафует только «за каждую
 * аблативную Рану от Ракового Исцеления»). Вызывать после любого изменения
 * доли этого источника (см. хук updateActor в warhammer-dbc.mjs) — она
 * может как расти (новое касание), так и падать (поглощение урона, клэмп
 * при лечении).
 */
export async function syncCancerousHealingPenalty(actor) {
  if (!actor) return;
  const ownAblative = Number(actor.getFlag(FLAG, CANCEROUS_HEALING_FLAG)) || 0;
  const existing = penaltyEffectOf(actor);
  if (ownAblative <= 0) {
    if (existing) await existing.delete().catch(() => {});
    return;
  }
  const value = cancerousHealingPenaltyValue(ownAblative);
  const agKey = "system.characteristics.ag.totalFx";
  const sKey  = "system.characteristics.s.totalFx";
  const changes = [
    { key: agKey, type: "subtract", value, phase: expectedPhase(agKey), priority: 0 },
    { key: sKey,  type: "subtract", value, phase: expectedPhase(sKey),  priority: 0 }
  ];
  if (existing) {
    const same = JSON.stringify(existing.changes) === JSON.stringify(changes);
    if (!same) await existing.update({ changes });
  } else {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Раковое Исцеление (аблатив)",
      img: "icons/svg/regen.svg",
      changes,
      flags: { [FLAG]: { [PENALTY_FLAG]: true } }
    }]);
  }
}

/**
 * Ресинк ПОСЛЕ лечения цели (RAW: лишние аблативные Раны теряются) — вызывать
 * из хука updateActor при изменении system.wounds.value/.max ЛЮБОГО актора.
 */
export async function reconcileCancerousHealingAfterHeal(actor) {
  const prev = Number(actor.getFlag(FLAG, CANCEROUS_HEALING_FLAG)) || 0;
  if (prev <= 0) return;
  const result = cancerousHealingShrinkAfterHeal(actor.system, prev);
  if (!result) return;
  await actor.update({
    "system.wounds.ablative": result.newAblative,
    "system.wounds.ablativeMax": result.newAblativeMax,
    [`flags.${FLAG}.${CANCEROUS_HEALING_FLAG}`]: result.contribution
  });
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по другой причине
 * (поглощение урона) — иначе ablativeMax этой доли завис бы на историческом
 * пике и подпитывал бы лишний пассивный реген (module/combat/ablative-wounds.mjs).
 * Вызывать из хука updateActor при изменении system.wounds.ablative.
 */
export async function reconcileCancerousHealingToFit(actor) {
  const prev = Number(actor.getFlag(FLAG, CANCEROUS_HEALING_FLAG)) || 0;
  if (prev <= 0) return;
  const result = cancerousHealingShrinkToFit(actor.system, prev);
  if (!result) return;
  await actor.update({
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${CANCEROUS_HEALING_FLAG}`]: result.contribution
  });
}

/** Нажатие кнопки на листе Мутации: коснуться текущей цели. */
export async function useCancerousHealing(casterActor, item) {
  if (!isCancerousHealingItem(item) || !casterActor) return;
  const target = [...(game.user.targets ?? [])][0]?.actor || null;
  if (!target) {
    ui.notifications?.warn("Нет цели — наведите инструмент «Target» на раненую цель перед касанием.");
    return;
  }

  const prevContribution = Number(target.getFlag(FLAG, CANCEROUS_HEALING_FLAG)) || 0;
  const { newAblative, newAblativeMax, contribution, missing } = cancerousHealingGrant(target.system, prevContribution);
  const granted = contribution - prevContribution;
  const update = {
    "system.wounds.ablative": newAblative,
    "system.wounds.ablativeMax": newAblativeMax,
    [`flags.${FLAG}.${CANCEROUS_HEALING_FLAG}`]: contribution
  };
  const cured = [];
  if (target.system?.conditions?.bleeding) {
    update["system.conditions.bleeding"] = false;
    update["system.conditions.bleedingLevel"] = 0;
    cured.push("Кровотечение");
  }
  if (target.system?.conditions?.crippling) {
    update["system.conditions.crippling"] = false;
    cured.push("Калечение (Crippling)");
  }
  await target.update(update);
  await syncCancerousHealingPenalty(target);

  const penalty = cancerousHealingPenaltyValue(contribution);
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: casterActor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("heart","#7a9c3f")}Раковое Исцеление — ${esc(target.name)}</div>
      <div class="roll-threshold">Аблативные Раны: <b>${newAblative}</b>${granted > 0 ? ` (+${granted})` : missing === 0 ? " (цель не ранена)" : " (без изменений — уже не меньше)"}</div>
      ${contribution > 0 ? `<div class="roll-threshold">Штраф от аблативных Ран: A и S <b>−${penalty}</b> каждая</div>` : ""}
      ${cured.length ? `<div class="roll-threshold">Снято: <b>${esc(cured.join(", "))}</b></div>` : ""}
    </div>`,
    sound: null
  }, game.settings.get("core", "rollMode")));
}

/** Кнопка на листе предмета — пусто, если это не «Раковое Исцеление» или нет актора. */
export function cancerousHealingButtonHtml(item, actor) {
  if (!isCancerousHealingItem(item) || !actor) return "";
  return `<div class="cancerous-healing-panel">
    <div class="cancerous-healing-hint">Полное действие: наведите инструмент «Target» на раненую цель, затем нажмите.</div>
    <button type="button" class="cancerous-healing-btn" data-item-id="${item.id}">
      ${rollIcon("heart","#7a9c3f")}Коснуться цели
    </button>
  </div>`;
}
