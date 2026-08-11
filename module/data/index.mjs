// module/data/index.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Типы данных документов — то, что заменяет собой template.json.
//
//  Переезд идёт по одному типу: пока тип здесь не перечислен, его поля берутся
//  из template.json по-старому. Зарегистрированный тип template.json больше не
//  читает совсем, поэтому запись типа там опустошается в том же коммите —
//  чтобы не осталось двух описаний одной схемы.
// ════════════════════════════════════════════════════════════════════════════

import { WeaponPropertyData } from "./item/weapon-property.mjs";
import { AspirationData }     from "./item/aspiration.mjs";
import { TraitData }          from "./item/trait.mjs";

/** Тип предмета → класс схемы. Раскладывается в CONFIG.Item.dataModels в init. */
export const ITEM_DATA_MODELS = {
  weaponProperty: WeaponPropertyData,
  aspiration:     AspirationData,
  trait:          TraitData
};
