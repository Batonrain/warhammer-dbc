// module/combat/legacy-weapon-stunning.mjs
// ════════════════════════════════════════════════════════════════════════
//  Ошеломляющее/fearsome 7-7, Оружие Наследия, стрелковая ветка (wdbc-1rno.35,
//  стр. 427), второе предложение: «Даёт Concussive(1). Если цель Уклонилась,
//  бросьте 1d10+Inf.b — если это пробивает её Поглощение, она получает
//  попадание без урона с Concussive(0).»
//
//  Кнопка на карточке успешного дистанционного Уклонения — тот же приём, что
//  «Снаряд летит дальше» (module/combat/overpenetration.mjs): бросок катает
//  СЕБЯ, случайное место попадания (у Уклонения не сохраняется, где именно
//  целились), урона не наносит.
//
//  ЧЕСТНО УПРОЩЕНО: Поглощение считает только базовый AP брони места
//  попадания + бонусы vsType/vsSubtype + T.b — БЕЗ Ртути/Адаптации/
//  Аблативного AP-щита/Felling-редукции Сверхъест. Стойкости/Варп-Оружия
//  (module/combat/damage.mjs — полный конвейер учитывает всё это разом,
//  извлекать 15 переплетённых переменных ради одной проверки без урона —
//  риск разойтись с настоящим применением урона того же попадания). Для
//  игры это может НЕМНОГО завысить или занизить редкий пограничный случай
//  (носитель Ртути/Адаптации против этого конкретного попадания) — открытая
//  честная граница, не молчаливая.
// ════════════════════════════════════════════════════════════════════════

import { resolveWeaponProps, aggregateAuto } from "./weapon-properties.mjs";
import { resolveArmorAbsorptionAP } from "./armor-properties.mjs";
import { hitLocation } from "./attack-outcome.mjs";
import { LOCATION_TO_ARMOR } from "./damage.mjs";
import { takenMutationNames } from "../rules/legacy-weapon.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

/** Кнопка на карточке успешного дистанционного Уклонения — видна только при Мутации на стрелковом оружии. */
export function stunningLegacyButtonHtml(item, defenderUuid) {
  if (!item || item.system?.weaponClass === "melee" || !takenMutationNames(item).has("Ошеломляющее")) return "";
  if (!defenderUuid) return "";
  return `<button class="wh-legacy-stunning-btn" type="button" data-item-uuid="${item.uuid}" data-defender-uuid="${defenderUuid}">
    ${rollIcon("bolt", "#6fe6ff")}Ошеломляющее: 1d10+Inf.b против Поглощения
  </button>`;
}

/**
 * 1d10+Inf.b атакующего против Поглощения защищавшегося — при пробитии
 * попадание засчитывается без урона, с Concussive(0) (постим карточку с
 * итогом; само наложение Concussive(0) — тем же текстом, что и обычный
 * грант свойства, отдельного механизма «Concussive(0) без урона» в системе
 * ещё не было).
 */
export async function rollStunningLegacyCheck(item, defenderActor) {
  if (!item?.parent) return ui.notifications?.warn("Оригинальный стрелок этой атаки не найден (возможно, удалён).");
  if (!defenderActor) return ui.notifications?.warn("Защищавшийся актор не найден.");

  const infBonus = Number(item.parent.system?.characteristics?.inf?.bonus) || 0;
  const roll = await new Roll(`1d10+${infBonus}`).evaluate();

  const locRoll = await new Roll("1d100").evaluate();
  const { label: hitLoc } = hitLocation({ rv: locRoll.total, hit: true });

  const wp = aggregateAuto(resolveWeaponProps(item));
  const damageType = item.system.damageType || "impact";
  const damageSubtype = item.system.damageSubtype || "";
  const absorption = defenderActor.system?.absorption || {};
  const armorKey = LOCATION_TO_ARMOR[hitLoc] || "body";
  const armorAP = resolveArmorAbsorptionAP({
    baseArmorAP: (absorption[armorKey] ?? 0) - (absorption.toughnessBonus ?? 0),
    vsTypeBonus: absorption.vsType?.[damageType] ?? 0,
    subtypeBonus: absorption.vsSubtype?.[damageSubtype] ?? 0,
    damageType, damageSubtype, melee: false, hitLocation: hitLoc,
    primitive: !!wp.primitive, flags: absorption.propFlags?.[armorKey],
    layers: absorption.layers?.[armorKey] ?? null, otherWornAP: absorption.otherWorn?.[armorKey] ?? 0
  });
  const totalAbsorption = armorAP + (Number(absorption.toughnessBonus) || 0);
  const pierced = roll.total > totalAbsorption;

  await postTestCard(item.parent, {
    icon: rollIcon("bolt", "#6fe6ff"),
    title: `${esc(item.name)} — Ошеломляющее`,
    threshold: `<div class="roll-threshold">1d10+Inf.b: <b>${roll.total}</b> vs Поглощение ${esc(defenderActor.name)} (${hitLoc}): <b>${totalAbsorption}</b></div>`,
    outcome: pierced
      ? `<span class="roll-success">Пробито — попадание без урона, Concussive(0) применён к ${esc(defenderActor.name)}.</span>`
      : `<span class="roll-failure">Не пробито — Уклонение остаётся полным успехом.</span>`
  }, { rolls: [roll, locRoll] });
}
