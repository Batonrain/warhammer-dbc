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
import { GearData }           from "./item/gear.mjs";
import { ToolData }           from "./item/tool.mjs";
import { CyberneticData }     from "./item/cybernetic.mjs";
import { ImplantData }        from "./item/implant.mjs";
import { WeaponModData }      from "./item/weapon-mod.mjs";
import { ArmorModData }       from "./item/armor-mod.mjs";
import { ForcefieldData }     from "./item/forcefield.mjs";
import { WeaponData }         from "./item/weapon.mjs";
import { AmmoData }           from "./item/ammo.mjs";
import { ArmorData }          from "./item/armor.mjs";

/** Тип предмета → класс схемы. Раскладывается в CONFIG.Item.dataModels в init. */
export const ITEM_DATA_MODELS = {
  weaponProperty: WeaponPropertyData,
  aspiration:     AspirationData,
  trait:          TraitData,
  // Снаряжение и модификации (wdbc-ff4.1.1)
  gear:           GearData,
  tool:           ToolData,
  cybernetic:     CyberneticData,
  implant:        ImplantData,
  weaponMod:      WeaponModData,
  armorMod:       ArmorModData,
  forcefield:     ForcefieldData,
  // Оружие и броня (wdbc-ff4.1.2)
  weapon:         WeaponData,
  ammo:           AmmoData,
  armor:          ArmorData
};
