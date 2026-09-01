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
// «Цель согласна» (promptTouch ниже) — снята → безоружная атака (простой
// тест WS+модификатор, resolveUnarmedTouch), провал которой отменяет эффект
// целиком. Не полноценный обмен атакой/уклонением через chat-карточку
// (тот рассчитан на кросс-клиентский обмен кнопками между игроками и не
// возвращает булев результат синхронно — см. module/sheets/attack-dialog.mjs)
// — упрощённый прямой тест, тем же уровнем детализации, что у встречных
// тестов Command в squad-sheet.mjs.
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

/**
 * Диалог перед касанием: «Цель согласна» (по умолчанию — да, обычный случай
 * лечения союзника). Если сняли галочку — цель не согласна, книга («может
 * коснуться раненного персонажа, если тот не согласен — это может
 * потребовать безоружной атаки») требует безоружную атаку, поля которой
 * показываются под галочкой. Возвращает {consent, threshold} либо null —
 * диалог отменён.
 */
async function promptTouch(casterActor, targetName) {
  const wsTotal = Number(casterActor.system?.characteristics?.ws?.total) || 0;
  const content = `<div class="wh-attack-form">
    <div class="atk-dlg-header"><span class="atk-weapon-name">Раковое Исцеление</span><span class="atk-weapon-class">${esc(targetName)}</span></div>
    <div class="atk-dlg-row"><label><input type="checkbox" id="ch-consent" checked/> Цель согласна</label></div>
    <div id="ch-attack-fields">
      <div class="sq-hint">Цель не согласна — коснуться можно только безоружной атакой (WS).</div>
      <div class="atk-dlg-row"><label>WS+0:</label><input id="ch-ws" type="number" value="${wsTotal}"/></div>
      <div class="atk-dlg-row"><label>Доп. модификатор:</label><input id="ch-mod" type="number" value="0"/></div>
    </div>
  </div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Раковое Исцеление: касание" },
    classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog"],
    content,
    rejectClose: false,
    buttons: [
      {
        action: "ok", label: "Коснуться", icon: "fas fa-hand-holding-medical", default: true,
        callback: (event, button) => {
          const form = button.form;
          return {
            consent: !!form.querySelector("#ch-consent").checked,
            threshold: (parseInt(form.querySelector("#ch-ws").value) || 0) + (parseInt(form.querySelector("#ch-mod").value) || 0)
          };
        }
      },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form") ?? dialog.element;
      const consentBox = form.querySelector("#ch-consent");
      const fields = form.querySelector("#ch-attack-fields");
      const upd = () => { fields.style.display = consentBox.checked ? "none" : ""; };
      consentBox.addEventListener("change", upd);
      upd();
    }
  });
}

/**
 * Безоружная атака на несогласную цель — прямой тест WS+модификатор
 * (не полноценный обмен атакой/уклонением через chat-карточку: та
 * рассчитана на кросс-клиентский обмен кнопками, здесь нужен немедленный
 * булев результат, чтобы решить, накладывать ли эффект). Постит краткую
 * чат-карточку исхода сама, возвращает true/false.
 */
async function resolveUnarmedTouch(casterActor, target, threshold) {
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const ok = rv <= threshold;
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: casterActor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("sword","#c95050")}Безоружная атака — ${esc(target.name)} (не согласна)</div>
      <div class="roll-threshold">WS+модификатор → порог <b>${threshold}</b>, бросок <b>${rv}</b></div>
      <div class="roll-outcome">${ok
        ? `<span class="roll-success">Успех — касание проходит</span>`
        : `<span class="roll-failure">Провал — цель увернулась, Раковое Исцеление не подействовало</span>`}</div>
    </div>`,
    rolls: [roll]
  }, game.settings.get("core", "rollMode")));
  return ok;
}

/** Нажатие кнопки на листе Мутации: коснуться текущей цели. */
export async function useCancerousHealing(casterActor, item) {
  if (!isCancerousHealingItem(item) || !casterActor) return;
  const target = [...(game.user.targets ?? [])][0]?.actor || null;
  if (!target) {
    ui.notifications?.warn("Нет цели — наведите инструмент «Target» на раненую цель перед касанием.");
    return;
  }

  const picked = await promptTouch(casterActor, target.name);
  if (!picked) return; // отменено

  if (!picked.consent) {
    const hit = await resolveUnarmedTouch(casterActor, target, picked.threshold);
    if (!hit) return; // промах — исход уже в чате, эффект не применяется
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
      ${!picked.consent ? `<div class="roll-threshold" style="opacity:.8;">Цель не согласна — навязано безоружной атакой.</div>` : ""}
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
