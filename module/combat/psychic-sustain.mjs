// module/combat/psychic-sustain.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Снятие поддержания психосилы — один набор правок на все пути (пачка I2).
//
//  Раньше эти поля сбрасывал только обработчик галочки «Подд.» на вкладке МИСТИКА
//  (sheets/tabs/psychic.mjs). Теперь поддержание снимает и Варп-Замок («все поддерживаемые
//  психосилы развеиваются»), и список сбросов обязан быть один: забытое поле — это висящая
//  «степень успеха», чужая цель или оружие с купленными свойствами у уже развеянной силы.
// ════════════════════════════════════════════════════════════════════════════

import { forceBladeShopClear } from "../apps/force-blade-choice.mjs";
import { syncItemEffectsDisabled } from "../apps/effects.mjs";
import { WOUND_FREE_FLAG } from "../rules/wound-in-reality.mjs";

const NS = "warhammer-dbc";

/**
 * Патч предмета-силы «поддержание снято».
 * - wdbc-8m0x/1wvn: сохранённые степень успеха и эPR — иначе на листе висело бы число прошлого каста;
 * - wdbc-vxgd: купленные Force Blade свойства оружия (читаются только пока isSustained);
 * - wdbc-lmd2: цель поддержания (источник cross-actor правил);
 * - Заточение Силы: флаг замка плода;
 * - Рана в Реальности: «бесплатной» сила бывает, только пока поддерживается.
 */
export function sustainOffPatch(item) {
  const upd = {
    "system.isSustained": false,
    "system.sustainedDegree": null,
    "system.sustainedEpr": null,
    "system.sustainedTargetUuid": ""
  };
  if (item?.system?.hasWeaponShop) upd["system.effects.weaponBuff"] = forceBladeShopClear();
  if (item?.getFlag?.(NS, "fruitOfFleshLockUuid")) upd[`flags.${NS}.-=fruitOfFleshLockUuid`] = null;
  if (item?.getFlag?.(NS, WOUND_FREE_FLAG)) upd[`flags.${NS}.-=${WOUND_FREE_FLAG}`] = null;
  return upd;
}

/**
 * Развеять ВСЕ поддерживаемые психосилы актора (Варп-Замок).
 * @returns {Promise<string[]>} имена развеянных сил
 */
export async function dispelAllSustained(actor) {
  const names = [];
  for (const item of [...(actor?.items ?? [])]) {
    if (item?.type !== "psychicPower" || !item.system?.isSustained) continue;
    await item.update(sustainOffPatch(item));
    await syncItemEffectsDisabled(item);
    names.push(item.name);
  }
  return names;
}
