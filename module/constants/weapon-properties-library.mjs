// module/constants/weapon-properties-library.mjs
// ════════════════════════════════════════════════════════════════════════
//  Компендиум warhammer-dbc.weapon-properties — СПРАВОЧНАЯ библиотека Особых
//  Свойств Оружия (DoomBC — Основная книга, IV. Арсенал, «ОСОБЫЕ СВОЙСТВА
//  ОРУЖИЯ», стр. 166), по одному предмету (type:"weaponProperty") на запись
//  из WEAPON_PROPERTIES (module/constants/weapon-properties.mjs).
//
//  СОЗНАТЕЛЬНО НЕ проведено через «Механику» (единый Конструктор):
//  свойства оружия — это директивы автоматизации БОЕВОГО РАСЧЁТА (модифи-
//  каторы атаки/урона/парирования и т.п.), которые движок combat/weapon-
//  properties.mjs читает в момент БРОСКА, а не единоразовые правки при
//  ПОЛУЧЕНИИ предмета — Конструктор целиком про второе (createItem-хук,
//  ActiveEffect/грант при получении). Это другой момент времени и другой
//  класс механики; переиспользовать тут «Механику» значило бы городить её
//  под задачу, для которой она не рассчитана, ради формального единообразия.
//  Вместо этого — genererируемая из WEAPON_PROPERTIES (источник истины —
//  код автоматизации, не дублируем вручную) СПРАВОЧНАЯ библиотека: имя,
//  описание, чат-напоминание, Источник — только смотреть/искать, реальный
//  расчёт как применялся по ключу в system.weaponProps[].key, так и
//  применяется (без изменений).
// ════════════════════════════════════════════════════════════════════════

import { WEAPON_PROPERTIES } from "./weapon-properties.mjs";

const BOOK = "DoomBC — Основная книга, IV. Арсенал («Особые свойства оружия», стр. 166)";
const CAT_LABEL = { ranged: "дальнобойное", melee: "рукопашное", both: "любое" };

/** Предметы-справки для компендиума «Свойства оружия». */
export function weaponPropertyLibrary() {
  return Object.values(WEAPON_PROPERTIES).map(p => ({
    name: `${p.label} / ${p.en}`,
    type: "weaponProperty",
    img: "icons/svg/sword.svg",
    folder: CAT_LABEL[p.cat] ? `${CAT_LABEL[p.cat][0].toUpperCase()}${CAT_LABEL[p.cat].slice(1)}` : "Любое",
    system: {
      description: p.desc || "",
      reminder: p.reminder || "",
      category: p.cat || "both",
      hasRating: !!p.rating,
      hasRating2: !!p.rating2,
      autoKey: p.key,
      bookSource: BOOK
    }
  }));
}

export const WEAPON_PROPERTY_CATEGORY_LABEL = CAT_LABEL;
