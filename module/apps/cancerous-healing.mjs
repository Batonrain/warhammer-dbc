// module/apps/cancerous-healing.mjs
//
// UI/действие Мутации «Cancerous Healing / Раковое Исцеление» (wdbc-w8ws) —
// см. module/rules/cancerous-healing.mjs про арифметику. Кнопка на листе
// Мутации: берёт текущую цель (game.user.targets, тот же приём, что Bone
// Song/Первая Помощь) как «касание», полное действие отыгрывается флейвором
// в чате, не отдельным трекером ОД.
//
// Книга («может коснуться раненного персонажа, если тот не согласен — это
// может потребовать безоружной атаки»): диалог перед касанием несёт галочку
// «Цель согласна» (promptTouch ниже). Снята — полноценная безоружная атака
// через module/sheets/attack-dialog.mjs::showAttackDialogNoWeapon (WS+база+
// стойка+усталость, авто-успех/×2 по Беспомощной цели, кнопки Уклонение/
// Парирование цели — тот же путь, что у любого другого безоружного Приёма
// в этой системе, НЕ упрощённый прямой тест). При попадании чат-карточка
// несёт кнопку «Применить Раковое Исцеление» (applyCancerousHealingEffect,
// делегированный клик — hooks.mjs, тот же приём, что у wh-apply-dmg-btn):
// эффект не накладывается автоматически сразу по попаданию — у цели должно
// быть окно кликнуть Уклонение/Парирование первой, кто бы её ни отыгрывал.
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
import { showAttackDialogNoWeapon } from "../sheets/attack-dialog.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { expectedPhase } from "../constants/effect-keys.mjs";

export { isCancerousHealingItem };

const FLAG = "warhammer-dbc";
const PENALTY_FLAG = "cancerousHealingPenalty";
export const APPLY_BTN_CLASS = "ch-apply-touch-btn";

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

/**
 * Диалог перед касанием: только «Цель согласна» (по умолчанию — да, обычный
 * случай лечения союзника). Безоружная атака (если сняли галочку) считает
 * WS/базу/стойку/усталость сама (showAttackDialogNoWeapon) — здесь этим
 * полям взяться неоткуда, дублировать их не нужно. Возвращает true/false,
 * либо null — диалог отменён.
 */
async function promptConsent(targetName) {
  const content = `<div class="wh-attack-form">
    <div class="atk-dlg-header"><span class="atk-weapon-name">Раковое Исцеление</span><span class="atk-weapon-class">${esc(targetName)}</span></div>
    <div class="atk-dlg-row"><label><input type="checkbox" id="ch-consent" checked/> Цель согласна</label></div>
    <div class="sq-hint">Не согласна — коснуться можно только безоружной атакой.</div>
  </div>`;
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "Раковое Исцеление: касание" },
    classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok", label: "Коснуться", icon: "fas fa-hand-holding-medical", default: true,
        callback: (event, button) => !!button.form.querySelector("#ch-consent").checked
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
  return result;
}

/**
 * Применить сам эффект Мутации к цели: аблатив = недостающим Ранам (заменяя
 * собственную прошлую долю), лечение Кровотечения/Crippling, живой штраф.
 * Общая точка для обоих путей — согласная цель (сразу) и несогласная
 * (кнопка в чат-карточке ПОСЛЕ подтверждённого попадания безоружной атаки,
 * см. APPLY_BTN_CLASS/hooks.mjs). Резолвит актора цели заново по uuid, если
 * не передан документом — клик по кнопке может прийти с другого клиента
 * позже, актуальное состояние цели к этому моменту важнее того, что было
 * на момент броска.
 */
export async function applyCancerousHealingEffect(casterActor, target, { forced = false } = {}) {
  if (!target) return;
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
    Object.assign(update, conditionRemoveFields("bleeding"));
    cured.push("Кровотечение");
  }
  if (target.system?.conditions?.crippling) {
    Object.assign(update, conditionRemoveFields("crippling"));
    cured.push("Калечение (Crippling)");
  }
  await target.update(update);
  await syncCancerousHealingPenalty(target);

  const penalty = cancerousHealingPenaltyValue(contribution);
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: casterActor || target }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("heart","#7a9c3f")}Раковое Исцеление — ${esc(target.name)}</div>
      ${forced ? `<div class="roll-threshold" style="opacity:.8;">Цель не согласна — навязано безоружной атакой.</div>` : ""}
      <div class="roll-threshold">Аблативные Раны: <b>${newAblative}</b>${granted > 0 ? ` (+${granted})` : missing === 0 ? " (цель не ранена)" : " (без изменений — уже не меньше)"}</div>
      ${contribution > 0 ? `<div class="roll-threshold">Штраф от аблативных Ран: A и S <b>−${penalty}</b> каждая</div>` : ""}
      ${cured.length ? `<div class="roll-threshold">Снято: <b>${esc(cured.join(", "))}</b></div>` : ""}
    </div>`,
    sound: null
  }, game.settings.get("core", "rollMode")));
}

/**
 * Клик по кнопке «Применить Раковое Исцеление» в чат-карточке безоружной
 * атаки (hooks.mjs::renderChatMessageHTML делегирует сюда) — резолвит
 * актора/цель заново по uuid, кнопка может прийти с другого клиента.
 */
export async function applyCancerousHealingFromButton(casterUuid, targetUuid) {
  const caster = casterUuid ? await fromUuid(casterUuid).catch(() => null) : null;
  const target = targetUuid ? await fromUuid(targetUuid).catch(() => null) : null;
  if (!target) { ui.notifications?.warn("Цель Ракового Исцеления не найдена (токен/актор удалён?)."); return; }
  await applyCancerousHealingEffect(caster, target, { forced: true });
}

/** Нажатие кнопки на листе Мутации: коснуться текущей цели. */
export async function useCancerousHealing(casterActor, item) {
  if (!isCancerousHealingItem(item) || !casterActor) return;
  const target = [...(game.user.targets ?? [])][0]?.actor || null;
  if (!target) {
    ui.notifications?.warn("Нет цели — наведите инструмент «Target» на раненую цель перед касанием.");
    return;
  }

  const consent = await promptConsent(target.name);
  if (consent === null) return; // отменено

  if (consent) {
    await applyCancerousHealingEffect(casterActor, target, { forced: false });
    return;
  }

  // Не согласна — полноценная безоружная атака (WS/база/стойка/усталость
  // считает сама showAttackDialogNoWeapon); при попадании чат-карточка несёт
  // кнопку применения эффекта — см. докстринг файла про то, почему не сразу.
  const hitSectionHtml = `<div class="roll-threshold">
    <button type="button" class="${APPLY_BTN_CLASS}" data-caster-uuid="${esc(casterActor.uuid)}" data-target-uuid="${esc(target.uuid)}">
      ${rollIcon("heart","#7a9c3f")}Применить Раковое Исцеление
    </button>
  </div>`;
  await showAttackDialogNoWeapon(casterActor, {
    label: "Раковое Исцеление (безоружное касание)",
    wsBonus: 0,
    chatNote: "Цель не согласна — попытка коснуться безоружной атакой.",
    hitSectionHtml
  });
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
