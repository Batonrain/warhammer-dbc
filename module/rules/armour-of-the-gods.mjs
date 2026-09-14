// module/rules/armour-of-the-gods.mjs
// ════════════════════════════════════════════════════════════════════════
//  Armour of the Gods / Доспехи Богов (Общие Мутации, wdbc-1rno, d100 −4):
//  «Персонаж получает Божественные Латы, перманентно сплавленные с его
//  плотью, и становится Броненосцем (стр. 156) без траты опыта на элитный
//  Архетип. Его текущая броня сливается с Божественными Латами и придаёт
//  им свои особенности и AP, если они лучше, чем у Лат.»
//
//  «Становится Броненосцем без траты опыта» — Элитный Архетип «Ironclad /
//  Броненосец» (packs-src/elite-archetypes) уже несёт РЕАЛЬНЫЕ записи
//  Конструктора kind:"trait"/kind:"talent" (Size(1), Unnatural S(4)/T(4),
//  Divine Plate, 9 Талантов) — Hooks.on("createItem", ...) в
//  warhammer-dbc.mjs (apps/mechanics.mjs::applyItemMechanics) выдаёт их
//  ВСЕ автоматически в момент, когда предмет архетипа попадает на актора,
//  тем же трактом, что и обычная платная покупка (apps/elite-buy.mjs::
//  buyEliteArchetype) — эта находка просто создаёт предмет архетипа
//  (module/apps/armour-of-the-gods.mjs::grantArmourOfTheGods) и пишет
//  system.eliteArchetype/eliteArchetypesExtra ТЕМ ЖЕ способом, что и
//  buyEliteArchetype, минус проверка требований и списание опыта.
//
//  «Сливается с текущей бронёй, если она лучше» — Черта «Divine Plate»,
//  которую выдаёт архетип, сама по себе честная заглушка (её `effects`
//  всегда нулевые, см. её собственный `notes` в packs-src) — не только у
//  этой находки, у ЛЮБОЙ обычной покупки Броненосца тоже. Чтобы «слияние,
//  если лучше» стало реальным числом, находка выдаёт Божественные Латы
//  ВТОРЫМ, отдельным предметом-БРОНЁЙ (AP 8/10/8/8 по книге самой Черты) —
//  обычная броня по умолчанию НЕ складывается (`stacks:false`), а берёт
//  МАКСИМУМ AP по локации между всеми надетыми бронями (module/rules/
//  character/armour.mjs, строка `Math.max(armorFromItems[k], ap[k])`) —
//  «выигрывает лучшая» получается бесплатно, без единой строчки нового
//  кода слияния. Это заодно чинит тот же пробел у любого другого игрока,
//  купившего Броненосец обычным способом, не только у этой Мутации.
//
//  «+1d10 Порчи» (charBonus архетипа) — как и freeTraits/talents, тоже
//  НЕ автоматизирована ни для кого при обычной покупке (charBonus —
//  чисто описательное поле реестра elite-archetypes.mjs, не запись
//  Конструктора) — здесь роллится только для ЭТОЙ находки, чинить это для
//  всех покупок Архетипов вообще — отдельная, более широкая тема.
// ════════════════════════════════════════════════════════════════════════

export const ARMOUR_OF_THE_GODS_CAPABILITY = "mutation.armourOfTheGods";

/** Точное имя предмета архетипа в компендиуме (packs-src/elite-archetypes). */
export const IRONCLAD_ARCHETYPE_NAME = "Ironclad / Броненосец";

/** Уже взят ли этот Архетип (первым или дополнительным) — не выдавать дважды. */
export function hasIroncladArchetype(system) {
  const name = IRONCLAD_ARCHETYPE_NAME;
  return system?.eliteArchetype === name || (system?.eliteArchetypesExtra ?? []).includes(name);
}

/**
 * Данные предмета-брони «Божественные Латы»: AP 8/10/8/8 (голова/тело/руки/
 * ноги — порядок книги самой Черты Divine Plate), не складывается с другой
 * бронёй (берётся максимум AP по локации — см. шапку файла), всегда надета.
 */
export function divinePlateArmourData() {
  return {
    name: "Divine Plate / Божественные Латы (AP)",
    type: "armor",
    img: "systems/warhammer-dbc/assets/item-icons/armor.svg",
    system: {
      armorType: "simple", stacks: false, equipped: true,
      head: 8, body: 10, leftArm: 8, rightArm: 8, leftLeg: 8, rightLeg: 8,
      quality: "common"
    }
  };
}
