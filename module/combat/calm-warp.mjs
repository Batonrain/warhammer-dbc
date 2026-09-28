// module/combat/calm-warp.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Кнопки «Усмирение Варпа» на карточке манифестации и их обработчик.
//  Правило и чистые проверки — module/rules/calm-warp.mjs.
//
//  Кнопка несёт весь свой контекст в data-атрибутах (кому принадлежит, какая
//  таблица, модификатор Феноменов), а не во флагах сообщения: карточку
//  манифестации собирает postTestCard одним вызовом на много секций, и флаги
//  пришлось бы протаскивать через весь showManifestDialog. «Каждый бросок
//  перебрасывается один раз» (корбук 438) — отметкой calmWarpUsed во флагах
//  самого сообщения, если у нажавшего есть на него права, иначе хотя бы
//  выключенной кнопкой.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { spendFromInfamyPool, actorInfamyPath } from "../apps/infamy-points.mjs";
import { tempInfamyAmount } from "../rules/temp-infamy.mjs";
import { calmWarpAllowed, calmWarpResult, hasImperialSanctioning, offerFreePerilReroll, CALM_WARP_COR }
  from "../rules/calm-warp.mjs";

const FLAG = "warhammer-dbc";

/**
 * Кнопки переброса для секции Феномена/Прорыва карточки. Видны только
 * владельцу псайкера (.wh-owner-only прячет их остальным — hooks.mjs).
 * @param {Actor} actor
 * @param {{phenMod:number, peril:boolean, free?:boolean, table?:"both"|"peril"}} opts
 */
export function calmWarpButtonsHtml(actor, { phenMod = 0, peril = false, free = false, table = "both" } = {}) {
  const attrs = `data-actor-uuid="${esc(actor.uuid)}" data-phen-mod="${Number(phenMod) || 0}"`;
  const btns = [];
  if (free) {
    btns.push(`<button type="button" class="wh-calm-warp-btn" data-table="peril" data-free="1" ${attrs}
      title="Имперское Санкционирование: Феномен переброшен за Очко Бесчестия и вызвал Прорыв — Прорыв можно перебросить бесплатно">
      🌀 Перебросить Прорыв бесплатно (Имперское Санкционирование)</button>`);
  } else {
    if (table === "both") {
      btns.push(`<button type="button" class="wh-calm-warp-btn" data-table="phenomenon" ${attrs}
        title="Усмирение Варпа (Cor ${CALM_WARP_COR}+): 1 Очко Бесчестия — новый бросок по таблице Феноменов с тем же модификатором">
        🌀 Усмирение Варпа: перебросить Феномен (1 Очко Бесчестия)</button>`);
    }
    if (peril) {
      btns.push(`<button type="button" class="wh-calm-warp-btn" data-table="peril" ${attrs}
        title="Усмирение Варпа (Cor ${CALM_WARP_COR}+): 1 Очко Бесчестия — новый бросок по таблице Прорывов">
        🌀 Усмирение Варпа: перебросить Прорыв (1 Очко Бесчестия)</button>`);
    }
  }
  if (!btns.length) return "";
  return `<div class="roll-threshold wh-owner-only wh-calm-warp" data-actor-uuid="${esc(actor.uuid)}">${btns.join(" ")}</div>`;
}

function phenHtml(phen, phenTotal, phenMod) {
  return `
    <div class="psy-phenomenon">
      <div class="psy-phen-header">⚠️ Психический Феномен (переброс ${phenTotal}${phenMod ? `, мод ${phenMod >= 0 ? "+" : ""}${phenMod}` : ""})</div>
      <div class="psy-phen-name">${phen.label}</div>
      <div class="psy-phen-text">${phen.text}</div>
    </div>`;
}

function perilHtml(peril, total, prefix = "") {
  return `
    <div class="psy-peril">
      <div class="psy-peril-header">💀 ${prefix}ВАРП-ПРОРЫВ! (бросок ${total})</div>
      <div class="psy-peril-name">${peril.label}</div>
      <div class="psy-peril-text">${peril.text}</div>
    </div>`;
}

/**
 * Клик по кнопке «Усмирение Варпа».
 * @param {ChatMessage} message  сообщение с кнопкой
 * @param {HTMLButtonElement} btn
 */
export async function handleCalmWarpClick(message, btn) {
  const { actorUuid, table } = btn.dataset;
  const free = btn.dataset.free === "1";
  const phenMod = Number(btn.dataset.phenMod) || 0;
  let actor = null;
  try { actor = await fromUuid(actorUuid); } catch { actor = null; }
  if (actor && !(actor instanceof Actor)) actor = actor.actor ?? null;
  if (!actor?.isOwner) return ui.notifications.warn("Перебросить может только владелец псайкера (или ГМ).");

  const usedKey = free ? "freePeril" : table;
  const used = message.getFlag?.(FLAG, "calmWarpUsed") || {};
  if (used[usedKey]) return ui.notifications.warn("Этот бросок уже переброшен — каждый бросок перебрасывается один раз.");

  if (free && !hasImperialSanctioning(actor)) {
    return ui.notifications.warn("Бесплатный переброс Прорыва — только у Черты «Имперское Санкционирование».");
  }

  let spentLine = "";
  if (!free) {
    const allowed = calmWarpAllowed(actor);
    if (!allowed.ok) return ui.notifications.warn(allowed.reason);
    const path = actorInfamyPath(actor);
    const cur = Number(foundry.utils.getProperty(actor, path)) || 0;
    if (cur < 1 && tempInfamyAmount(actor) < 1) return ui.notifications.warn("Нет Очков Бесчестия.");
    const spend = await spendFromInfamyPool(actor, 1, path);
    if (!spend) return;
    await actor.update({ [path]: spend.poolValue });
    spentLine = spend.tempSpent
      ? `Потрачено 1 временное Очко Бесчестия. Осталось: <b>${spend.poolValue}</b>.`
      : `Потрачено Очко Бесчестия. Осталось: <b>${spend.poolValue}</b>.`;
  }

  btn.disabled = true;
  if (message.isOwner) await message.setFlag(FLAG, "calmWarpUsed", { ...used, [usedKey]: true });

  const rolls = [];
  const sections = [];
  let perilTriggered = false;
  if (table === "peril") {
    const r = await new Roll("1d100").evaluate(); rolls.push(r);
    const res = calmWarpResult("peril", { perilTotal: r.total });
    sections.push(perilHtml(res.peril, r.total, "ПЕРЕБРОС: "));
  } else {
    const pr = await new Roll(`1d100 + ${phenMod}`).evaluate(); rolls.push(pr);
    let perilTotal = null;
    if (calmWarpResult("phenomenon", { phenTotal: pr.total }).perilTriggered) {
      const r = await new Roll("1d100").evaluate(); rolls.push(r);
      perilTotal = r.total;
    }
    const res = calmWarpResult("phenomenon", { phenTotal: pr.total, perilTotal });
    perilTriggered = res.perilTriggered;
    sections.push(phenHtml(res.phen, pr.total, phenMod));
    if (res.peril) sections.push(perilHtml(res.peril, perilTotal));
    else sections.push(`<div class="roll-threshold" style="font-size:0.85em;color:#3a7a3a;">Прорыва нет.</div>`);
  }

  const sanctioned = hasImperialSanctioning(actor);
  if (offerFreePerilReroll({ table, free, perilTriggered, sanctioned })) {
    sections.push(calmWarpButtonsHtml(actor, { phenMod, free: true }));
  }
  // Варп-Шок первого броска (Порча не-Хаоситу: 1 за Феномен, 1d5 за Прорыв)
  // уже начислен карточкой манифестации — переброс его не пересчитывает.
  sections.push(`<div class="roll-threshold" style="font-size:0.78em;opacity:0.8;">Порча Варп-Шока по первому броску уже начислена — переброс её не меняет.</div>`);

  await postTestCard(actor, {
    icon: "🌀",
    title: free
      ? `Имперское Санкционирование — переброс Прорыва — ${esc(actor.name)}`
      : `Усмирение Варпа — ${table === "peril" ? "переброс Прорыва" : "переброс Феномена"} — ${esc(actor.name)}`,
    lines: [free
      ? `<div class="roll-damage-meta">Бесплатно: Феномен перебрасывали за Очко Бесчестия.</div>`
      : `<div class="roll-damage-meta">${spentLine}</div>`],
    sections
  }, { rolls });
}
