// module/combat/knockdown.mjs
// ════════════════════════════════════════════════════════════════════════
//  ПОВАЛИТЬ (стр. 14, wdbc-x1nz.2.66.5) — эффект победы в состязании
//  (MELEE_CONTESTS.knockdown), подмешивается тем же приёмом, что Финт/
//  Давление/Напролом (combat/feint-press.mjs, combat/bulldoze.mjs).
//
//  «Если один из участников меньше другого, он получает штраф −10 за каждый
//  уровень разницы» (симметрично — штраф несёт МЕНЬШАЯ сторона, кто бы это
//  ни был), «нельзя против целей на 2+ Размера больше персонажа» — те же два
//  правила, что у Напролома/Захвата, тот же честный предел: _showContestDialog
//  — диалог на ОДНОГО инициатора, штраф автоматизирован только как подсказка
//  в Доп. модификаторе ДЛЯ ТОГО, кто открыл диалог (обычно атакующий) —
//  симметричный случай (цель меньше атакующего) эта подсказка не покрывает,
//  тот же предел, что у bulldozeSizePenalty.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { sizeOf } from "../rules/predicates.mjs";

/**
 * Разница в Размере (инициатор − цель). Итоговый Размер (sizeTotal, с
 * Чертами Size/Hulking), не база system.size — иначе Астартес и Огрины
 * читались бы людьми (тот же дефект, что разобран в defense.mjs у Парирования).
 */
export function knockdownSizeDiff(actor, target) {
  return sizeOf(actor) - sizeOf(target);
}

/**
 * Симметричная половина штрафа за Размер (wdbc-x1nz.2.73): меньшая ЦЕЛЬ
 * получает −10 за уровень разницы на свой бросок сопротивления — раньше его
 * было некуда положить, цель не бросала вовсе.
 */
export function knockdownResistMods(actor, target) {
  const diff = knockdownSizeDiff(actor, target);
  return diff > 0 ? [{ label: "меньше Размером", value: -10 * diff }] : [];
}

/** «Нельзя против целей на 2+ Размера больше персонажа» — жёсткий запрет. */
export function knockdownForbidden(actor, target) {
  return knockdownSizeDiff(actor, target) <= -2;
}

/**
 * Подсказанный штраф −10 за уровень разницы — ТОЛЬКО если инициатор МЕНЬШЕ
 * цели (симметричный случай «цель меньше» эту подсказку не покрывает, см.
 * шапку файла).
 */
export function knockdownSizePenalty(actor, target) {
  const diff = knockdownSizeDiff(actor, target);
  return diff < 0 ? diff * 10 : 0; // diff<0 → инициатор меньше → отрицательный штраф
}

export async function resolveKnockdownSuccess(actor, { deg, target } = {}) {
  if (!target) {
    return ui.notifications?.warn(`${actor.name}: цель Повалить не выцелена на сцене — эффект не наложен.`);
  }
  const fields = conditionApplyFields("prone", null, target);
  if (Object.keys(fields).length) await target.update(fields);

  const sections = [
    `<div class="roll-threshold">${esc(target.name)} сбит(а) с ног (Ничком).</div>`
  ];

  if (deg >= 5) {
    const sb = Number(actor.system?.characteristics?.s?.bonus) || 0;
    const apply = await Dialog.confirm({
      title: "Повалить — доп. эффект (5+ Успехов)",
      content: `<p>5+ Успехов позволяют дополнительно нанести ${esc(target.name)}: <b>1d5+S.b</b> (S.b ${sb}) I(Cr) Dmg, Pen 0, Primitive, и 1 Усталости.</p><p>Нанести?</p>`
    });
    if (apply) {
      const roll = await new Roll("1d5").evaluate();
      const dmg = roll.total + sb;
      const { applyDamageToActor } = await import("./damage.mjs");
      await applyDamageToActor(target, {
        rawDamage: dmg, penetration: 0, damageType: "impact", primitive: true,
        hitLocation: "Торс", melee: true,
        attackerName: actor.name, attackerUuid: actor.uuid, weaponName: "Повалить"
      });
      const { addFatigue } = await import("../sheets/tabs/conditions.mjs");
      await addFatigue(target, 1);
      sections.push(`<div class="roll-threshold">5+ Успехов: ${esc(target.name)} получает <b>${dmg}</b> I(Cr) Dmg (1d5+S.b, Primitive) и 1 Усталости.</div>`);
    }
  }

  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"),
    title: `Повалить: ${esc(target.name)}`,
    outcome: outcomeHtml(true, `Победа — ${deg} степеней`),
    sections
  }, { sound: false });
}
