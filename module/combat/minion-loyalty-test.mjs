// module/combat/minion-loyalty-test.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Тест Лояльности Миньона (корбук стр. 113) — окно, бросок, карточка.
//
//  Кнопка «🎲» стоит рядом с Лояльностью в шапке листа Миньона и на карточке
//  слуги в блоке МИНЬОНЫ у Хозяина. Книга говорит «ГМ бросает на Лояльность»,
//  но кнопку не прячем от игрока: стол сам решает, кто жмёт, а режим броска
//  (публичный/для ГМа) берётся из чата, как у всех карточек.
//
//  Правила (порог, переброс Монозависимого, последствия по поводу) — чистые,
//  в module/rules/minion-loyalty.mjs. Здесь то, что требует Foundry:
//  диалог, кубики, списание Реакции, Очко Бесчестия Хозяину и карточка.
//
//  Перехват контроля при провале в бою книга отдаёт ГМу; система пишет это
//  строкой карточки и не отбирает у игрока права на токен — это решение
//  стола, и молча забирать владение было бы хуже напоминания.
// ════════════════════════════════════════════════════════════════════════════

import {
  LOYALTY_REASONS, LOYALTY_COMBAT_FAIL_TEXT, loyaltyReasonOptions, loyaltyThreshold,
  resolveLoyaltyRolls, loyaltyConsequence, hasMonodevotant, adoringCrowdsEligible, isSoulBound
} from "../rules/minion-loyalty.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/** Хозяин Миньона (документ) или null. */
export async function minionMaster(minion) {
  const uuid = minion?.system?.masterUuid;
  if (!uuid) return null;
  return fromUuid(uuid).catch(() => null);
}

/** Стоит ли Миньон в текущем бою (его токен — участник активного боя). */
export function minionInCombat(minion) {
  const combat = globalThis.game?.combat;
  if (!combat?.started && !combat?.active) return false;
  return [...(combat?.combatants ?? [])].some(c => c?.actor?.uuid === minion?.uuid || c?.actorId === minion?.id);
}

/**
 * Окно теста: повод, модификатор ГМа, «в бою». Возвращает выбор или null.
 * @returns {Promise<?{reason:string, mod:number, inCombat:boolean}>}
 */
export async function loyaltyTestDialog(minion, master) {
  const reasons = loyaltyReasonOptions(master, minion);
  const inCombat = minionInCombat(minion);
  const loyalty = Number(minion?.system?.loyalty?.value) || 0;
  const mono = hasMonodevotant(minion);
  const content = `<div class="wh-loyalty-dialog" style="margin:4px 6px;">
    <p>Лояльность <b>${esc(minion?.name ?? "")}</b>: <b>${loyalty}</b>.
      ${mono ? "<br>Монозависимый — неудачный тест перебрасывается сам." : ""}</p>
    <div class="form-group"><label for="wh-loyalty-reason">Повод</label>
      <select id="wh-loyalty-reason" name="reason">
        ${reasons.map((r, i) => `<option value="${r.key}"${i === 0 ? " selected" : ""}>${esc(r.label)}</option>`).join("")}
      </select></div>
    <div class="form-group"><label for="wh-loyalty-mod">Модификатор ГМа</label>
      <input id="wh-loyalty-mod" name="mod" type="number" step="5" value="0"/></div>
    <div class="form-group"><label for="wh-loyalty-combat">В бою (провал — Миньон под контролем ГМа до конца боя)</label>
      <input id="wh-loyalty-combat" name="inCombat" type="checkbox"${inCombat ? " checked" : ""}/></div>
    ${reasons.some(r => r.key === "adoringCrowds") ? `<p class="hint">Обожание Толпы: Миньон тратит Реакцию; Успех восстанавливает Хозяину 1 Очко Бесчестия.</p>` : ""}
  </div>`;
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: `Тест Лояльности — ${minion?.name ?? ""}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content,
    rejectClose: false,
    buttons: [
      { action: "roll", label: "Бросить", default: true, callback: (event, button) => {
        const f = button.form;
        return {
          reason: f?.querySelector?.("#wh-loyalty-reason")?.value || reasons[0]?.key || "other",
          mod: Number(f?.querySelector?.("#wh-loyalty-mod")?.value) || 0,
          inCombat: !!f?.querySelector?.("#wh-loyalty-combat")?.checked
        };
      } },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  });
  return choice && typeof choice === "object" ? choice : null;
}

/** Бросок d100 → {roll, total}. Подменяется в тестах. */
async function d100() {
  const roll = await new Roll("1d100").evaluate();
  return { roll, total: roll.total };
}

/**
 * Бросить тест Лояльности и выложить карточку.
 *
 * @param {Actor} minion
 * @param {object} o
 * @param {?Actor} [o.master]
 * @param {string} [o.reason]    ключ LOYALTY_REASONS
 * @param {number} [o.mod]       модификатор ГМа
 * @param {boolean} [o.inCombat]
 * @param {Function} [o.rollFn]  () => Promise<{roll, total}>
 * @param {Function} [o.spendReactionFn]  (actor) => Promise<boolean>
 * @param {Function} [o.restoreInfamyFn]  (actor, delta) => Promise<{changed:boolean, before:number, after:number, max:number}>
 * @returns {Promise<?{success:boolean, deg:number, rv:number, threshold:number, rerolled:boolean, gmControl:boolean, infamyRestored:number}>}
 */
export async function rollLoyaltyTest(minion, {
  master = null, reason = "risk", mod = 0, inCombat = false,
  rollFn = d100, spendReactionFn = null, restoreInfamyFn = null
} = {}) {
  if (!minion) return null;
  const key = LOYALTY_REASONS[reason] ? reason : "other";
  const def = LOYALTY_REASONS[key];

  if (def.adoringCrowds) {
    if (!adoringCrowdsEligible(master, minion)) {
      ui.notifications?.warn("Обожание Толпы: нужен Хозяин с этой Чертой и Миньон-Человек.");
      return null;
    }
    // «Могут потратить по Реакции» — Реакция Миньона; вне боя списывать нечего.
    const spend = spendReactionFn ?? (async a => (await import("./action-economy.mjs")).spendReaction(a));
    // В бою — актор участника (у несвязанного токена Реакция своя), а не
    // мировой актор, которого берёт кнопка на листе Хозяина.
    const fighter = minionInCombat(minion)
      ? [...globalThis.game.combat.combatants].find(c => c?.actorId === minion.id)?.actor ?? minion
      : minion;
    if (!(await spend(fighter))) {
      ui.notifications?.warn(`${minion.name}: нет Реакции — тест по Обожанию Толпы недоступен.`);
      return null;
    }
  }

  const threshold = loyaltyThreshold(minion, mod);
  const base = Number(minion.system?.loyalty?.value) || 0;
  // Связан душой (Ритуал Связывания Души): тест пройден всегда, переброс не нужен.
  const soulBound = isSoulBound(minion);
  const reroll = !soulBound && hasMonodevotant(minion);

  const first = await rollFn();
  const rolls = [first];
  if (reroll && !resolveLoyaltyRolls([first.total], threshold).success) rolls.push(await rollFn());
  const res = resolveLoyaltyRolls(rolls.map(r => r.total), threshold, { rerollFailed: reroll, autoSuccess: soulBound });
  const cons = loyaltyConsequence(key, res.success, { inCombat });

  let infamyRestored = 0;
  const sections = [];
  if (cons.restoreMasterInfamy && master) {
    const restore = restoreInfamyFn ?? (async (a, d) => (await import("../apps/infamy-points.mjs")).changeActorInfamy(a, d));
    if (master.isOwner === false) {
      sections.push(`<div class="roll-threshold">Очко Бесчестия ${esc(master.name)} начислить некому: у вас нет прав на его лист — ГМ, добавьте вручную.</div>`);
    } else {
      const r = await restore(master, cons.restoreMasterInfamy);
      infamyRestored = r?.changed ? r.after - r.before : 0;
      sections.push(`<div class="roll-threshold">${esc(master.name)}: Очки Бесчестия ${r?.changed
        ? `<b>${r.after}</b>/${r.max}`
        : `уже на максимуме (${r?.max ?? "?"}) — восстанавливать нечего`}.</div>`);
    }
  }
  if (cons.gmControl) sections.push(`<div class="roll-threshold"><b>${LOYALTY_COMBAT_FAIL_TEXT}</b></div>`);

  const rerollNote = res.rerolled
    ? `<div class="roll-reroll-note">Монозависимый: провал на ${res.first} переброшен</div>`
    : (soulBound ? `<div class="roll-reroll-note">Связан душой (Ритуал Связывания Души): тест Лояльности пройден автоматически</div>` : "");
  await postTestCard(minion, {
    icon: rollIcon("target", "#e0b050"),
    title: `Тест Лояльности — ${esc(minion.name)}`,
    actorUuid: minion.uuid,
    lines: [`<div class="roll-threshold">Повод: ${esc(def.label)}${master ? ` · Хозяин: ${esc(master.name)}` : ""}</div>`],
    threshold: rollStatLine({ label: "Лояльность", base, parts: [mod ? `${mod > 0 ? "+" : ""}${mod} (ГМ)` : ""], threshold, rv: res.rv }),
    rerollNote,
    outcome: outcomeHtml(res.success, `${res.success ? "Успех" : "Провал"} (${res.deg} ст.) — ${esc(cons.text)}`),
    sections
  }, { rolls: rolls.map(r => r.roll).filter(Boolean) });

  return { success: res.success, deg: res.deg, rv: res.rv, threshold, rerolled: res.rerolled, gmControl: cons.gmControl, infamyRestored };
}

/** Кнопка «🎲»: окно → бросок. */
export async function openLoyaltyTest(minion) {
  if (!minion) return null;
  const master = await minionMaster(minion);
  const choice = await loyaltyTestDialog(minion, master);
  if (!choice) return null;
  return rollLoyaltyTest(minion, { master, ...choice });
}
