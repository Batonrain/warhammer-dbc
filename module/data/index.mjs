// module/data/index.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Типы данных документов — то, что заменяет собой template.json.
//
//  Переезд закончен: поля всех типов описаны здесь, а в template.json остался
//  только перечень имён типов (Actor.types / Item.types) — Foundry берёт его
//  оттуда, пока в system.json нет documentTypes. Записи типов там пусты, и
//  такими должны остаться: два описания одной схемы разъезжаются.
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
import { MentalTraumaData }   from "./item/mental-trauma.mjs";
import { HomeworldData }      from "./item/homeworld.mjs";
import { DivinationData }     from "./item/divination.mjs";
import { ArchetypeData }      from "./item/archetype.mjs";
import { ArmourHistoryEntryData } from "./item/armour-history-entry.mjs";
import { DrugData }           from "./item/drug.mjs";
import { PsychicPowerData }   from "./item/psychic-power.mjs";
import { TechPowerData }      from "./item/tech-power.mjs";
import { NavigatorPowerData } from "./item/navigator-power.mjs";
import { ComponentData }      from "./item/component.mjs";
import { CargoData }          from "./item/cargo.mjs";
import { TorpedoData }        from "./item/torpedo.mjs";
import { CelestialBodyData }  from "./item/celestial-body.mjs";
import { VehicleGearData }    from "./item/vehicle-gear.mjs";
import { VehicleTraitData }   from "./item/vehicle-trait.mjs";
import { SmallCraftData }     from "./item/small-craft.mjs";
import { RitualData }         from "./item/ritual.mjs";
import { FactionData }        from "./item/faction.mjs";

import { DaemonData }      from "./actor/daemon.mjs";
import { DemonPrinceData } from "./actor/demon-prince.mjs";
import { HordeData }       from "./actor/horde.mjs";
import { VehicleData }     from "./actor/vehicle.mjs";
import { SquadData }       from "./actor/squad.mjs";
import { FormationData }   from "./actor/formation.mjs";
import { ShipData }       from "./actor/ship.mjs";
import { StarSystemData } from "./actor/star-system.mjs";
import { CharacterData }  from "./actor/character.mjs";

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
  mentalTrauma:   MentalTraumaData,
  // Данные персонажа (wdbc-ff4.1.5)
  homeworld:          HomeworldData,
  divination:         DivinationData,
  archetype:          ArchetypeData,
  armourHistoryEntry: ArmourHistoryEntryData,
  drug:               DrugData,
  // Силы (wdbc-ff4.1.4)
  psychicPower:   PsychicPowerData,
  techPower:      TechPowerData,
  navigatorPower: NavigatorPowerData,
  // Корабль и техника (wdbc-ff4.1.6)
  component:     ComponentData,
  cargo:         CargoData,
  torpedo:       TorpedoData,
  celestialBody: CelestialBodyData,
  vehicleGear:   VehicleGearData,
  vehicleTrait:  VehicleTraitData,
  smallCraft:    SmallCraftData,
  // Ритуалы (wdbc-5ed)
  ritual:        RitualData,
  // Дерево принадлежностей (фракции, шаг 1)
  faction:       FactionData
};

/** Тип актора → класс схемы. Раскладывается в CONFIG.Actor.dataModels в init. */
export const ACTOR_DATA_MODELS = {
  // Простые акторы (wdbc-ff4.1.7)
  daemon:      DaemonData,
  demonPrince: DemonPrinceData,
  horde:       HordeData,
  vehicle:     VehicleData,
  squad:       SquadData,
  formation:   FormationData,
  // Корабль и звёздная система (wdbc-ff4.1.8)
  ship:        ShipData,
  starSystem:  StarSystemData,
  // Персонаж последним (wdbc-ff4.1.9)
  character:   CharacterData
};
