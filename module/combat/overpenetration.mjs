// module/combat/overpenetration.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Снаряд летит дальше» (стр. 12, wdbc-x1nz.2.39): после успешного Уклонения
//  от ДИСТАНЦИОННОЙ атаки снаряд может, по решению ГМа, продолжить лететь по
//  линии огня и задеть следующую цель. Минимальная одобренная версия: кнопка
//  на карточке успешного Уклонения → ГМ выбирает вторую цель, система катает
//  урон оригинальным оружием как 1 попадание в случайную часть тела.
//
//  Место попадания читается тем же приёмом, что и у обычной атаки
//  (attack-outcome.mjs::hitLocation — бросок задом наперёд): здесь ему просто
//  скармливается СВОЙ независимый d100, а не бросок атаки — реверс
//  равномерно случайного числа остаётся равномерно случайным, второй таблицы
//  для «просто случайного места» заводить не нужно.
//
//  Выбор второй цели и её брони/поглощения — не эта функция: кнопка
//  «Применить урон» (.wh-apply-dmg-btn, hooks.mjs) уже умеет спрашивать цель
//  через showApplyDamageDialog, когда ей не передан forceTarget/forceHorde.
//  Второй копии этой machinery здесь нет (тот же приём, что у
//  draw-action.mjs::useDetonateGrenadeInRig).
// ════════════════════════════════════════════════════════════════════════════

import { resolveWeaponProps, aggregateAuto } from "./weapon-properties.mjs";
import { rollExtremeDamage } from "./attack.mjs";
import { hitLocation } from "./attack-outcome.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

/** Кнопка на карточке успешного Уклонения от дистанционной атаки. */
export function overpenetrationButtonHtml(itemUuid) {
  if (!itemUuid) return "";
  return `<button class="wh-overpenetration-btn" type="button" data-item-uuid="${itemUuid}">
    💨 Снаряд летит дальше — задеть следующую цель (решает ГМ)
  </button>`;
}

/**
 * Катает урон оригинальным оружием по «следующей» цели: 1 попадание,
 * случайное место тела. Постит карточку с готовой кнопкой применения урона —
 * саму цель выбирает ГМ уже на этой карточке (showApplyDamageDialog).
 */
export async function rollOverpenetration(item) {
  if (!item) return ui.notifications.warn("⚠️ Оригинальное оружие этой атаки не найдено (возможно, удалено).");

  const wp = aggregateAuto(resolveWeaponProps(item));
  const damageType = item.system.damageType || "impact";
  const damageSubtype = item.system.damageSubtype || "";
  const pen = Number(item.system.penetration) || 0;
  const weaponName = esc(item.name);

  const locRoll = await new Roll("1d100").evaluate();
  const { label: hitLoc } = hitLocation({ rv: locRoll.total, hit: true });

  const dmgRoll = await new Roll(item.system.damage || "0").evaluate();
  const { hasExtreme, extremeLevel, critEffect, exRoll } = await rollExtremeDamage(dmgRoll, {
    wp, damageType, hitLocation: hitLoc, attacker: item.parent ?? null
  });
  const rolls = exRoll ? [locRoll, dmgRoll, exRoll] : [locRoll, dmgRoll];

  const dmgBtn = `
    <button class="wh-apply-dmg-btn" type="button"
      data-damage="${dmgRoll.total}" data-penetration="${pen}"
      data-damage-type="${damageType}" data-damage-subtype="${damageSubtype}"
      data-hit-location="${hitLoc}" data-weapon-name="${weaponName}"
      data-weapon-uuid="${item.uuid}" data-attacker="" data-attacker-uuid=""
      data-felling="${wp.fellingRating ?? 0}" data-primitive="${wp.primitive ? 1 : 0}"
      data-ignore-shield="${wp.ignoreShield ? 1 : 0}" data-warp-soak="${wp.warpSoak ? 1 : 0}"
      data-lance="${wp.lance ? 1 : 0}" data-sanctified="${wp.sanctified ? 1 : 0}"
      data-blast="0" data-flame="${wp.flame ? 1 : 0}"
      data-power-field="${wp.powerField ? 1 : 0}" data-spray="0"
      data-devastating="${wp.devastatingRating ?? 0}" data-weapon-range="0"
      data-melee="0" data-burst="0"
      data-corrosive="${wp.corrosiveRating ?? 0}" data-entropy="0" data-touch-of-pain="0"
      data-crippling="${wp.cripplingRating ?? 0}" data-piercing="${wp.piercing ? 1 : 0}"
      data-haywire="${wp.haywire ? (wp.haywireRating ?? 0) : ""}" data-haywire-dmg2="${wp.haywireDamage2 || ""}"
      data-through-shot="0" data-has-extreme="${hasExtreme ? 1 : 0}">
      Применить урон: <b>${dmgRoll.total}</b> → ${hitLoc}
    </button>`;

  const critHtml = critEffect ? `<div class="roll-crit-effect">${critEffect}</div>` : "";

  await postTestCard(null, {
    icon: rollIcon("burst", "#ff8a4d"),
    title: `Снаряд летит дальше: ${weaponName}`,
    lines: [
      `<div class="roll-threshold" style="color:#ffb86b;">⚠️ 1 попадание, случайное место тела — вторую цель выбирает ГМ (стр. 12).</div>`,
      `<div class="roll-threshold">Урон ${dmgRoll.total} ${damageType} Pen ${pen}${hasExtreme ? `, Экстремальный d5: ${extremeLevel}` : ""}</div>`,
      critHtml
    ],
    sections: [dmgBtn]
  }, { rolls });
}
