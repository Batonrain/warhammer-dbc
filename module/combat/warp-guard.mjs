// module/combat/warp-guard.mjs
//
// Точка перехвата «эффект Варпа» (wdbc-nzzgn) для Талантов Пси-Стойкости. Зовётся
// ДО встречного теста цели — из гейта кнопки «Тест Сопротивления» психосилы и из
// Выжигания Души (hooks.mjs). Чистая часть (доступность, исход d10) —
// rules/warp-effect-guard.mjs.
//
//  • Божественная Защита — спрашивает игрока; попытка Раунда тратится на «да».
//  • Щит Презрения — флажок «Щит активен» = Талант включён тумблером строки.
//  • Нейральные Триггеры / Не Верь Глазам Своим / Психический Обвал — кнопки
//    карточки сопротивления (postWarpOffers → runWarpOffer); силы не размечены.

import { hasRuleFlag } from "../rules/flags.mjs";
import {
  DIVINE_PROTECTION_CAP, DIVINE_PROTECTION_ROUND_FLAG, divineProtectionKey,
  divineProtectionAvailable, attemptDivineProtection,
  WARP_OFFERS, SHIELD_CAP, perceptionThreshold, shieldOfContemptPasses
} from "../rules/warp-effect-guard.mjs";
import { updateOrRelay } from "./command-state.mjs";
import { sustainOffPatch } from "./psychic-sustain.mjs";
import { syncItemEffectsDisabled } from "../apps/effects.mjs";
import { applyConditionWithDuration } from "./condition-effects.mjs";
import { getPhenomenon } from "../constants/psyker-tables.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/**
 * Божественная Защита. Не автомат («может бросить»): игрока спрашивают, попытка
 * Раунда тратится только если он согласился.
 * @param {Actor} target  кто получает эффект
 * @param {string} what   что за эффект (подпись)
 * @returns {Promise<boolean>} true — эффект игнорируется, тест не нужен
 */
export async function tryDivineProtection(target, what) {
  if (!target || !hasRuleFlag(target, DIVINE_PROTECTION_CAP)) return false;
  const combat = game.combat ?? null;
  if (!divineProtectionAvailable(target, combat)) return false;
  const yes = await foundry.applications.api.DialogV2.confirm({
    window: { title: `Божественная Защита — ${target.name}` },
    content: `<p>${esc(what)}: бросить Божественную Защиту? 1d10, на 10 эффект игнорируется на 1 Раунд. Попытка — раз в Раунд.</p>`,
    yes: { label: "Бросить Защиту" }, no: { label: "Не бросать" },
    rejectClose: false
  });
  if (!yes) return false;
  const roll = await new Roll("1d10").evaluate();
  const { ignored } = attemptDivineProtection(roll.total);
  const key = divineProtectionKey(combat);
  if (key) await updateOrRelay(target, { [`flags.warhammer-dbc.${DIVINE_PROTECTION_ROUND_FLAG}`]: key });
  await postTestCard(target, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("shield", "#8fd0ff")}Божественная Защита — ${esc(target.name)}</div>
    <div class="roll-threshold">${esc(what)}: 1d10 = <b>${roll.total}</b> — ${ignored
      ? "<b>10: эффект игнорируется на 1 Раунд</b> (поддерживаемая сила не развеивается)."
      : "эффект действует (нужна 10). Попытка в этом Раунде потрачена."}</div>
    </div>`, { sound: false });
  return ignored;
}

/**
 * Щит Презрения: «каждый раз, когда на него нацелена психосила (полезная или
 * вредная), проходит W+0. Успех — полностью игнорирует эффекты, а псайкер
 * проходит W+0 или развеивает её. Провал — впадает в Ярость после применения
 * эффекта. Только против сил прямой силы Варпа (не Непрямых)».
 * «Развеять» бросает ПСАЙКЕР («псайкер проходит W+0»): провал его W+0 развеивает
 * силу. «Щит активен» — Талант включён тумблером в строке (после ритуала).
 * @returns {Promise<boolean>} true — эффект игнорируется (тест Сопротивления не нужен)
 */
export async function tryShieldOfContempt(target, caster, { indirect = false } = {}) {
  if (!target || indirect || !hasRuleFlag(target, SHIELD_CAP)) return false;
  const tWp = Number(target.system?.characteristics?.wp?.total) || 0;
  const r1 = await new Roll("1d100").evaluate();
  if (!shieldOfContemptPasses(tWp, r1.total)) {
    await updateOrRelay(target, { "system.inRage": true });
    await postTestCard(target, `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("shield", "#ff8a3a")}Щит Презрения — ${esc(target.name)}</div>
      <div class="roll-threshold">W+0: <b>${r1.total}</b> против <b>${tWp}</b> — провал. Эффект силы действует, носитель впадает в Ярость.</div>
      </div>`, { sound: false });
    return false;
  }
  let casterLine = "Кастера нет — W+0 за псайкера бросает ГМ.";
  if (caster) {
    const cWp = Number(caster.system?.characteristics?.wp?.total) || 0;
    const r2 = await new Roll("1d100").evaluate();
    casterLine = shieldOfContemptPasses(cWp, r2.total)
      ? `Псайкер: W+0 ${r2.total} против ${cWp} — успех, сила не развеяна, но на Щит не действует.`
      : `Псайкер: W+0 ${r2.total} против ${cWp} — провал, <b>сила развеяна</b>.`;
  }
  await postTestCard(target, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("shield", "#8fd0ff")}Щит Презрения — ${esc(target.name)}</div>
    <div class="roll-threshold">W+0: <b>${r1.total}</b> против <b>${tWp}</b> — успех: эффекты силы полностью игнорируются.</div>
    <div class="roll-threshold">${casterLine}</div>
    </div>`, { sound: false });
  return true;
}

/** Какие из предложений-кнопок доступны актору (Талант есть и включён). */
export function warpOffersFor(actor) {
  return WARP_OFFERS.filter(o => hasRuleFlag(actor, o.cap));
}

/** Карточка с кнопками Талантов Пси-Стойкости; нечего предложить — ничего не публикуем. */
export async function postWarpOffers(target, what) {
  const offers = warpOffersFor(target);
  if (!offers.length) return false;
  await postTestCard(target, `<div class="wh-roll-result">
    <div class="roll-header">${rollIcon("shield", "#8fd0ff")}Пси-Стойкость — ${esc(target.name)}</div>
    <div class="roll-threshold">${esc(what)}. Доступно:</div>
    ${offers.map(o => `<button type="button" class="wh-warp-offer-btn" data-action="${o.action}" data-actor-uuid="${esc(target.uuid)}">${esc(o.label)}</button>`).join("")}
    </div>`, { sound: false });
  return true;
}

/** Исполнение кнопки предложения (hooks.mjs, .wh-warp-offer-btn). */
export async function runWarpOffer(action, actor) {
  if (!actor) return;
  if (action === "neural") {
    await applyConditionWithDuration(actor, "helpless", { value: 1, unit: "rounds" });
    return postTestCard(actor, `<div class="wh-roll-result"><div class="roll-header">${rollIcon("shield", "#8fd0ff")}Нейральные Триггеры — ${esc(actor.name)}</div>
      <div class="roll-threshold">Вместо того чтобы действовать против воли, персонаж парализует себя: Беспомощен 1 Раунд.</div></div>`, { sound: false });
  }
  if (action === "perception") {
    const thr = perceptionThreshold(actor.system?.skills?.awareness?.total);
    const roll = await new Roll("1d100").evaluate();
    const ok = roll.total <= thr;
    return postTestCard(actor, `<div class="wh-roll-result"><div class="roll-header">${rollIcon("eye", "#8fd0ff")}Не Верь Глазам Своим — тайный бросок за ${esc(actor.name)}</div>
      <div class="roll-threshold">Awareness−10: <b>${roll.total}</b> против <b>${thr}</b> — <b>${ok ? "успех: персонаж узнаёт, что из его ощущений изменено (сквозь иллюзии не видит)" : "провал"}</b>.</div></div>`,
      { sound: false, whisper: ChatMessage.getWhisperRecipients?.("GM") || [], blind: true });
  }
  if (action === "collapse") {
    const own = [...(actor.items ?? [])].filter(i => i?.type === "psychicPower" && i.system?.isSustained);
    if (!own.length) return ui.notifications?.warn(`${actor.name}: нет поддерживаемой психосилы, которую можно развеять.`);
    let item = own[0];
    if (own.length > 1) {
      const id = await foundry.applications.api.DialogV2.wait({
        window: { title: "Психический Обвал: какую силу развеять?" },
        content: "<p>Выберите свою поддерживаемую силу.</p>",
        buttons: own.map(i => ({ action: i.id, label: i.name, callback: () => i.id })),
        rejectClose: false
      });
      item = own.find(i => i.id === id);
      if (!item) return;
    }
    await item.update(sustainOffPatch(item));
    await syncItemEffectsDisabled(item);
    const roll = await new Roll("1d100").evaluate();
    const phen = getPhenomenon(roll.total);
    return postTestCard(actor, `<div class="wh-roll-result"><div class="roll-header">${rollIcon("fire", "#ff8a3a")}Психический Обвал — ${esc(actor.name)}</div>
      <div class="roll-threshold">Развеяна «${esc(item.name)}» (полудействие списывает игрок). Феномен: d100 = <b>${roll.total}</b> — <b>${esc(phen.label)}</b>. ${esc(phen.text)}</div>
      <div class="roll-threshold">Развеять чужую силу на себе или победить Одержимость — решает стол.</div></div>`, { sound: false });
  }
}
