// module/rules/vision-penalty-immunity.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кто со стороны АТАКУЮЩЕГО снимает штрафы плохой видимости (wdbc-1rno.36).
//  Сами штрафы — галочки окна атаки «Слабый свет / Дым / Тьма» (sheets/
//  attack/mods.mjs, стр. 32); образец гасителя — Чёрные Глаза (там же).
//  По книге:
//   • Dark Sight / Ночное Зрение (стр. 107): «не получает штрафов за низкое
//     освещение и полную тьму» — Слабый свет и Тьма;
//   • Preysense Visor / Охотничий Визор (стр. 243): «игнорируя штрафы за
//     плохое освещение» — надетый;
//   • Thermal Sight / Термальный Прицел (стр. 171, «(Прицеливание)»): то же,
//     только прицелившись и если прицел стоит на этом стволе;
//   • Djinn Sight / Джинн-Прицел (стр. 171, «(Прицеливание)»): «подсвечивает
//     силуэты целей в облаках дыма и тумана… позволяя стрелять в них как
//     обычно» — Дым/туман. Оговорку «кроме Завесовой Бомбы» стол снимает
//     галочкой сам: зона дыма не помнит, чем её поставили.
//  Чистая логика без Foundry.
// ════════════════════════════════════════════════════════════════════════

import { itemIs } from "./item-marker.mjs";

const aimed = aiming => !!aiming && aiming !== "none";
const shortName = item => String(item?.name ?? "").split("/").pop().trim();

/** Почему не действуют штрафы Слабого света и Тьмы, либо null. */
export function lightPenaltyImmunityReason(actor, installedMods = [], { aiming = "" } = {}) {
  const items = [...(actor?.items ?? [])];
  const darkSight = items.find(i => itemIs(i, "trait", "trait.darkSight", "Dark Sight"));
  if (darkSight) return "Ночное Зрение";
  const visor = items.find(i => itemIs(i, "gear", null, "Preysense Visor") && i.system?.equipped);
  if (visor) return shortName(visor);
  if (aimed(aiming)) {
    const scope = installedMods.find(m => itemIs(m, "weaponMod", null, "Thermal Sight"));
    if (scope) return `${shortName(scope)} (Прицеливание)`;
  }
  return null;
}

/** Почему не действует штраф Дыма/тумана, либо null. */
export function smokePenaltyImmunityReason(actor, installedMods = [], { aiming = "" } = {}) {
  if (!aimed(aiming)) return null;
  const scope = installedMods.find(m => itemIs(m, "weaponMod", null, "Djinn Sight"));
  return scope ? `${shortName(scope)} (Прицеливание)` : null;
}
