// module/combat/psychic-vampire.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Психический Вампир (Талант Псайканы, Sahara 3-28, пачка I2) — Foundry-обвязка к
//  rules/psychic-vampire.mjs: кнопка на карточке урона и её обработчик.
//
//  Кнопку рисует combat/damage.mjs (vampireSection), когда психическая атака вывела цель
//  из строя. Клик (hooks.mjs, .wh-vampire-btn): право → «раз в Раунд» → вопрос «есть ли у
//  цели душа» → тест W+0 → при Успехе лечение 1d5 Ран или снятие всей Усталости → доза
//  «наркотика» в недельный счётчик (механизм наркотиков, sheets/tabs/drugs.mjs::weeklyDoseCheck).
//  Всё пишется только в актора-владельца Таланта — чужие акторы не трогаются.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { runCardOnce } from "./card-once.mjs";
import { computeWoundHealing } from "../sheets/tabs/wounds.mjs";
import { fatigueChangeFields, announceFatigueChange } from "../sheets/tabs/conditions.mjs";
import {
  VAMPIRE_HEAL_FORMULA, VAMPIRE_USAGE_KEY, vampireDrug, vampireOffered, vampireWhy
} from "../rules/psychic-vampire.mjs";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const VAMPIRE_CARD_FLAG = "vampireUsed";

/** Разметка кнопки (класс .wh-vampire-btn слушает hooks.mjs). */
export function vampireButtonHtml({ attackerUuid, targetName = "" }) {
  return `<div class="roll-defense-section">
    <button class="wh-vampire-btn" type="button" data-attacker-uuid="${esc(attackerUuid)}"
      data-target-name="${esc(targetName)}"
      title="Психический Вампир: раз в Раунд, убив психической мощью существо с душой, пройти психотест W+0 — при Успехе вылечить 1d5 Ран или снять всю Усталость. Считается дозой наркотика (Зависимость 6 | W+0 | 6 дней | Агрессия 2)">
      ${rollIcon("skull")}Психический Вампир: поглотить душу ${esc(targetName)} (W+0)
    </button>
  </div>`;
}

/**
 * Секция карточки урона. Пустая строка — Талант не применим.
 * @param {object} p attackerUuid, weaponUuid, psychicPowerType, net, woundsAfter, targetName
 */
export async function vampireSection(p) {
  if (!p.attackerUuid) return "";
  const attacker = await fromUuid(p.attackerUuid).catch(() => null);
  const weapon = p.weaponUuid ? await fromUuid(p.weaponUuid).catch(() => null) : null;
  if (!attacker || !vampireOffered(attacker, { psychicPowerType: p.psychicPowerType ?? null, weapon, net: p.net, woundsAfter: p.woundsAfter })) return "";
  return vampireButtonHtml(p);
}

async function askSoul(targetName) {
  return foundry.applications.api.DialogV2.confirm({
    window: { title: "Психический Вампир" },
    content: `<p>У <b>${esc(targetName || "цели")}</b> есть душа — и это не изгнание демона в Варп?</p>`,
    yes: { label: "Есть душа" }, no: { label: "Нет — Талант не срабатывает" },
    rejectClose: false
  });
}

async function askBenefit() {
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Психический Вампир — что взять" },
    content: `<p>Тест пройден. Что получить?</p>`,
    buttons: [
      { action: "heal", label: `Вылечить ${VAMPIRE_HEAL_FORMULA} Ран`, default: true },
      { action: "fatigue", label: "Снять всю Усталость" }
    ],
    rejectClose: false
  });
}

/** Клик по кнопке карточки урона. */
export async function handleVampireClick(message, btn) {
  const { attackerUuid, targetName } = btn.dataset;
  let actor = null;
  try { actor = await fromUuid(attackerUuid); } catch { actor = null; }
  if (actor && !(actor instanceof Actor)) actor = actor.actor ?? null;
  if (!actor?.isOwner) { ui.notifications?.warn("Поглотить душу может только владелец псайкера (или ГМ)."); return false; }
  if (!isCapabilityAvailable(actor, VAMPIRE_USAGE_KEY, "round")) { ui.notifications?.warn(vampireWhy("round")); return false; }
  if (!(await askSoul(targetName))) return false;

  return runCardOnce(message, VAMPIRE_CARD_FLAG, async () => {
    // Попытка засчитана в Раунд в момент броска: «раз в Раунд … может пройти психотест».
    await markCapabilityUsed(actor, VAMPIRE_USAGE_KEY, "round");
    const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
    const mods = collectTestMods(actor, { kind: "skill", char: "wp" });
    const threshold = wp + (Number(mods.total) || 0);
    const roll = await new Roll("1d100").evaluate();
    const rv = roll.total;
    const success = rv <= threshold;
    const deg = Math.floor(Math.abs(rv - threshold) / 10) + 1;
    const lines = [];
    const rolls = [roll];
    let outcome = outcomeHtml(false, `Провал — ${deg} ст.: душа ускользнула`);

    if (success) {
      outcome = outcomeHtml(true, `Успех — ${deg} ст.`);
      const choice = (await askBenefit()) || "heal";
      if (choice === "fatigue") {
        const res = fatigueChangeFields(actor, 0);
        await actor.update(res.fields);
        await announceFatigueChange(actor, res);
        lines.push(`<div class="roll-threshold">${rollIcon("heart", "#ff8a8a")}Снята вся Усталость (было ${res.before}).</div>`);
      } else {
        const heal = await new Roll(VAMPIRE_HEAL_FORMULA).evaluate();
        rolls.push(heal);
        await actor.update(computeWoundHealing(actor.system, heal.total));
        lines.push(`<div class="roll-threshold">${rollIcon("heart", "#ff8a8a")}Лечение: <b>${VAMPIRE_HEAL_FORMULA}</b> = <b>${heal.total}</b> Ран.</div>`);
      }
      lines.push(`<div class="roll-threshold" style="font-size:0.85em;">Считается применением наркотика: доза записана в недельный счётчик (Зависимость 6 | W+0 | 6 дней).</div>`);
    }

    await postTestCard(actor, {
      icon: rollIcon("skull", "#ff6b6b"), title: `Психический Вампир — ${esc(targetName || "цель")} — ${esc(actor.name)}`,
      threshold: rollStatLine({ label: "WP", base: wp, parts: mods.parts ?? [], threshold, rv }),
      lines, outcome
    }, { rolls });

    // Доза «наркотика» — после карточки: тест Зависимости (на шестой за неделю) ложится отдельной карточкой.
    if (success) {
      const { weeklyDoseCheck } = await import("../sheets/tabs/drugs.mjs");
      await weeklyDoseCheck(actor, vampireDrug());
    }
    return true;
  }, "С этой карточки Психический Вампир уже использован.");
}
