// module/combat/recoil.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Отскок» (стр. 12, wdbc-9wvm) — UI-половина: диалог выбора метров/Укрытия,
//  открываемый кнопкой на карточке успешного Уклонения от стрелковой атаки
//  (module/combat/defense.mjs::_performDodge, только !isMelee), и чат-
//  карточка исхода. Данные (пул/лимит) — recoil-pool.mjs, эта пара файлов —
//  то же разделение, что evasion-pool.mjs (данные+карточка в одном файле там,
//  потому что там нет отдельного диалога выбора) и showSkidDialog/mount.mjs
//  (диалог+карточка вместе, когда диалог есть).
//
//  Отскок «вне предела атаки» и «в Укрытие» — оба буквально то, что решает
//  игрок за столом (площадь карты в проекте не отслеживается вовсе — см.
//  module/rules/aoe-target.mjs, module/combat/resplendent-raiment.mjs про
//  тот же honest-compromise): диалог не проверяет геометрию, а просто
//  спрашивает, куда персонаж отскочил, и списывает метры из пула.
//  «Отскок из рукопашной = Вольт» (п.6 правила) в этом диалоге не
//  предлагается — Отскок здесь всегда идёт от СТРЕЛКОВОЙ атаки (см. гейт
//  !isMelee в _performDodge); рукопашный случай — отдельная точка входа,
//  см. declareDisengage/disengageActive в movement-actions.mjs.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { spdMeters, recoilRemaining, spendRecoil } from "./recoil-pool.mjs";
import { coverApForToken } from "./cover.mjs";
import { spendPoolForRecoil } from "./evasion-pool.mjs";

/** Цена входа в Отскок из банка Успехов (Voltagheist Blast, wdbc-16ss). */
export const POOL_RECOIL_COST = 2;

/**
 * Кнопка «Отскочить», приклеиваемая к карточке успешного Уклонения от
 * стрелковой атаки — только УСПЕХ и !isMelee зовут её (см. defense.mjs).
 */
export function recoilButtonHtml(actor) {
  const remaining = recoilRemaining(actor);
  const remLabel = Number.isFinite(remaining) ? `${remaining}` : "∞ (вне боя)";
  return `
    <div class="roll-defense-section">
      <button class="wh-recoil-btn" type="button" data-actor-uuid="${actor.uuid}">
        ${rollIcon("run")}Отскочить (вместо нивеляции) — остаток ${remLabel}м в этом Раунде
      </button>
    </div>`;
}

/** Токен актора на текущей сцене, если есть — для авто-подстановки AP Укрытия. */
function tokenFor(actor) {
  return canvas?.tokens?.placeables?.find(t => t.actor?.uuid === actor.uuid) ?? null;
}

/**
 * Диалог выбора метров/Укрытия. Возвращает null при отмене.
 * @returns {Promise<{meters:number, intoCover:boolean, coverAp:number}|null>}
 */
export async function showRecoilDialog(actor) {
  const remaining = recoilRemaining(actor);
  if (remaining <= 0) {
    ui.notifications?.warn("⚠️ Дистанция Отскока в этом Раунде исчерпана.");
    return null;
  }
  const spd = spdMeters(actor);
  const defaultMeters = Math.min(spd || 1, Number.isFinite(remaining) ? remaining : (spd || 1));
  const token = tokenFor(actor);
  const suggestedAp = token ? coverApForToken(token) : 0;

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: `Отскок — ${actor.name}` },
    classes: ["wh-roll-dialog-window"],
    position: { width: 340 },
    content: `
      <div class="wh-skill-roll-form">
        <div class="roll-dlg-header"><span>Отскок — ${esc(actor.name)}</span></div>
        <div class="roll-dlg-row"><label>Дистанция (м, до ${Number.isFinite(remaining) ? remaining : spd}):</label>
          <input type="number" name="meters" value="${defaultMeters}" min="0" ${Number.isFinite(remaining) ? `max="${remaining}"` : ""} step="1">
        </div>
        <div class="roll-dlg-row"><label>Отскочил в Укрытие:</label>
          <input type="checkbox" name="intoCover" ${suggestedAp > 0 ? "checked" : ""}>
        </div>
        <div class="roll-dlg-row"><label>AP Укрытия:</label>
          <input type="number" name="coverAp" value="${suggestedAp}" min="0" step="1">
        </div>
        <div class="roll-dlg-note">Не в Укрытие — все попадания этой атаки промахиваются (вне предела атаки, стр. 12). В Укрытие — попадания проходят с доп. AP.</div>
      </div>`,
    buttons: [
      {
        action: "recoil", icon: "fas fa-person-running", label: "Отскочить!", default: true,
        callback: (event, button) => {
          const form = button.form;
          return {
            meters: Math.max(0, parseInt(form.querySelector('[name="meters"]')?.value) || 0),
            intoCover: !!form.querySelector('[name="intoCover"]')?.checked,
            coverAp: Math.max(0, parseInt(form.querySelector('[name="coverAp"]')?.value) || 0)
          };
        }
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    rejectClose: false
  });
  return result ?? null;
}

/**
 * Списывает дистанцию из пула, ставит разовый флаг AP Укрытия (если
 * применимо) и постит исход в чат. Зовётся из клика по wh-recoil-btn после
 * подтверждения showRecoilDialog.
 */
export async function performRecoil(actor, { meters, intoCover, coverAp } = {}) {
  const spent = await spendRecoil(actor, meters);
  if (intoCover && coverAp > 0) {
    await actor.setFlag("warhammer-dbc", "recoilCoverBonus", coverAp);
  }
  const remaining = recoilRemaining(actor);
  const remLabel = Number.isFinite(remaining) ? `, остаток ${remaining}м в этом Раунде` : "";

  const outcomeHtml = intoCover
    ? `<span class="roll-success">Отскочил на ${spent}м в Укрытие — попадания проходят, но со +${coverAp} AP (учтётся при следующем применении урона).</span>`
    : `<span class="roll-success">Отскочил на ${spent}м вне предела атаки — все попадания промахиваются.</span>`;

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("run")}Отскок — ${esc(actor.name)}</div>
        <div class="roll-outcome">${outcomeHtml}</div>
        <div class="roll-defense-note">Потрачено ${spent}м из дистанции Отскока${remLabel}.</div>
      </div>`
  }, rollMode));
}

/**
 * Voltagheist Blast (wdbc-16ss): открывает Отскок за счёт банка Успехов
 * Уклонения (module/combat/evasion-pool.mjs) вместо свежего Уклонения от
 * ЭТОЙ атаки — зовётся из клика по wh-pool-recoil-btn (кнопка приклеена рядом
 * с обычным «Пул Избегания» на карточке атаки, см. attack-card.mjs::
 * defenseSection). Стоимость (POOL_RECOIL_COST Успехов) списывается ДО показа
 * диалога метров: отмена диалога Успехи не возвращает — тот же компромисс,
 * что у Контратаки (hooks.mjs) и прочих трат-до-подтверждения кнопок.
 */
export async function performPoolRecoil(actor, attackerUuid) {
  const rollMode = game.settings.get("core", "rollMode");
  if (recoilRemaining(actor) <= 0) {
    ui.notifications?.warn("⚠️ Дистанция Отскока в этом Раунде исчерпана.");
    return;
  }
  const spent = await spendPoolForRecoil(actor, attackerUuid, POOL_RECOIL_COST);
  if (!spent) {
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-outcome"><span class="roll-failure">${rollIcon("ban","#ff6b6b")}В банке недостаточно Успехов на Отскок (нужно ${POOL_RECOIL_COST}) или он устарел.</span></div>
      </div>`
    }, rollMode));
    return;
  }
  const choice = await showRecoilDialog(actor);
  if (!choice) return;
  await performRecoil(actor, choice);
}
