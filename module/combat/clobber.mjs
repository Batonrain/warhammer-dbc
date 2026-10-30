// module/combat/clobber.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Clobber / Поколотить — Foundry-обвязка (правило и допущения — rules/throwing-talents.mjs::clobberPlan).
//
//  Книга: попав по цели метательным оружием (в т.ч. импровизированным), весящим не меньше ¼ цели, цель
//  проходит S+0 или Сбивается с ног; снаряд ≥½ цели — −10 на тест, тяжелее цели — −20.
//
//  1. Карточка попадания метательного оружия (attack.mjs → attack-card.mjs) и карточка «Метнуть» обычного
//     предмета (improvised-item.mjs) получают блок clobberOfferHtml: кнопка с уже посчитанным штрафом либо
//     строка, почему Талант не сработал (снаряд лёгкий / вес не заполнен).
//  2. Клик (hooks.mjs, .wh-clobber-btn) → resolveClobberClick: цель бросает S+0 со штрафом
//     (combat/resilience-test.mjs); при Провале — Состояние «Ничком» через единую точку наложения
//     (statusApplyFields: иммунитет и «Стена» учтены), запись в чужую цель идёт через ГМ-релей.
//  Раз на карточку (card-once.mjs, ключ clobberRolled).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { clobberPlan, hasClobber } from "../rules/throwing-talents.mjs";
import { totalWeightOf, bodyWeightOf } from "../rules/improvised-weapon.mjs";
import { rollResilienceTest } from "./resilience-test.mjs";
import { statusApplyFields } from "./status-resist.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { runCardOnce } from "./card-once.mjs";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const CLOBBER_CARD_FLAG = "clobberRolled";

/** Типы акторов, которых нельзя «сбить с ног»: техника, Орды, корабли, отряды, построения. */
const NOT_KNOCKABLE = new Set(["vehicle", "horde", "ship", "starSystem", "squad", "formation"]);

/**
 * Что предложить на карточке попадания метательным.
 * @param {Actor} attacker
 * @param {{projectileKg:number, target:Actor}} p
 * @returns {null | {status:string, mod?:number, ratio?:number, projectileKg:number, targetKg:number, targetUuid:string, targetName:string}}
 *   null — Таланта нет или цель не из тех, кого сбивают
 */
export function clobberOfferFor(attacker, { projectileKg, target } = {}) {
  if (!attacker || !target || !hasClobber(attacker)) return null;
  if (NOT_KNOCKABLE.has(target.type)) return null;
  // Вес тела у большинства NPC (бестиарий) не заполнен — тогда сравнивать нечего: одно снаряжение вместо веса цели дало бы ложный штраф.
  const targetKg = bodyWeightOf(target) > 0 ? totalWeightOf(target) : 0;
  return {
    ...clobberPlan(projectileKg, targetKg),
    projectileKg: Number(projectileKg) || 0, targetKg,
    targetUuid: target.uuid ?? "", targetName: target.name ?? ""
  };
}

const fmtMod = n => (n < 0 ? `−${-n}` : "+0");
const fmtKg = n => (Math.round(n * 10) / 10).toLocaleString("ru-RU");

/** Разметка блока для карточки. Пустая строка — предлагать нечего. */
export function clobberOfferHtml(offer, attackerUuid) {
  if (!offer) return "";
  if (offer.status === "ok") {
    return `
    <button class="wh-clobber-btn" type="button" data-attacker-uuid="${esc(attackerUuid)}" data-target-uuid="${esc(offer.targetUuid)}" data-mod="${offer.mod}"
      title="Поколотить: снаряд ${esc(fmtKg(offer.projectileKg))} кг при весе цели ${esc(fmtKg(offer.targetKg))} кг (${Math.round(offer.ratio * 100)}%). Цель проходит S${fmtMod(offer.mod)} — при Провале её сбивает с ног. Если цель Уклонилась от попадания — не нажимайте.">
      🪨 Поколотить: ${esc(offer.targetName)} — S${fmtMod(offer.mod)}
    </button>`;
  }
  const why = {
    tooLight: `снаряд (${fmtKg(offer.projectileKg)} кг) легче ¼ цели (${fmtKg(offer.targetKg)} кг) — не действует`,
    noProjectileWeight: "вес снаряда не заполнен — сравните с весом цели вручную",
    noTargetWeight: `вес цели ${esc(offer.targetName)} не заполнен (Записи → Вес) — сравните вручную`
  }[offer.status];
  return why ? `<div class="roll-allout-note">Поколотить: ${why}.</div>` : "";
}

/**
 * Клик по кнопке «Поколотить».
 * @returns {Promise<boolean>} true — тест брошен (кнопку можно гасить)
 */
export async function resolveClobberClick(attackerUuid, targetUuid, mod, message) {
  const attacker = await fromUuid(attackerUuid).catch(() => null);
  const target = await fromUuid(targetUuid).catch(() => null);
  if (!attacker || !target) { ui.notifications.warn("⚠️ Поколотить: стрелок или цель не найдены."); return false; }
  if (!attacker.isOwner && !game.user?.isGM) { ui.notifications.warn(`⚠️ Нет прав на ${attacker.name}.`); return false; }
  if (!hasClobber(attacker)) { ui.notifications.warn(`⚠️ ${attacker.name}: нет Таланта «Поколотить».`); return false; }
  // Штраф возможен только в пределах книги (0 / −10 / −20): подделанное в карточке значение зажимается.
  const penalty = Math.max(-20, Math.min(0, Number(mod) || 0));

  return runCardOnce(message, CLOBBER_CARD_FLAG, async () => {
    const test = await rollResilienceTest(target, "s", {
      title: "Поколотить", mod: penalty, charLabel: "S",
      successText: "Успех — устоял(а) на ногах", failText: "Провал — сбит(а) с ног"
    });
    if (test.success) return true;
    const { fields, resisted, note } = await statusApplyFields(target, "prone", null,
      { attacker, melee: false, source: "Поколотить" });
    if (Object.keys(fields).length && !(await writeToTarget(target, { kind: "update", data: fields }, attacker))) return true;
    await postTestCard(attacker, {
      icon: rollIcon("sword", "#e08a3a"),
      title: `Поколотить: ${esc(target.name)}`,
      outcome: outcomeHtml(!resisted, resisted ? esc(note) : `${esc(target.name)} сбит(а) с ног (Ничком)`),
      sections: []
    }, { sound: false });
    return true;
  }, "Поколотить с этой карточки уже проверяли.");
}
