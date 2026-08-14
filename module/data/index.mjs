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
import { TalentData }         from "./item/talent.mjs";
import { AbilityData }        from "./item/ability.mjs";
import { MutationData }       from "./item/mutation.mjs";
import { DiseaseData }        from "./item/disease.mjs";
import { MentalDisorderData } from "./item/mental-disorder.mjs";
import { HomeworldData }      from "./item/homeworld.mjs";
import { DivinationData }     from "./item/divination.mjs";
import { ArchetypeData }      from "./item/archetype.mjs";
import { ArmourHistoryEntryData } from "./item/armour-history-entry.mjs";
import { DrugData }           from "./item/drug.mjs";

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
  armor:          ArmorData,
  // Способности, черты, состояния (wdbc-ff4.1.3)
  talent:         TalentData,
  ability:        AbilityData,
  mutation:       MutationData,
  disease:        DiseaseData,
  mentalDisorder: MentalDisorderData,
  // Данные персонажа (wdbc-ff4.1.5)
  homeworld:          HomeworldData,
  divination:         DivinationData,
  archetype:          ArchetypeData,
  armourHistoryEntry: ArmourHistoryEntryData,
  drug:               DrugData
};
