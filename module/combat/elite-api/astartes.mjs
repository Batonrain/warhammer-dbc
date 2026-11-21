// module/combat/elite-api/astartes.mjs
// Помощники скриптов кнопок Талантов/Черт элитных архетипов (пачка «astartes»).
// Всё, что экспортировано в API, видно коду kind:"script"-записей Конструктора
// по имени ключа (module/apps/item-script.mjs → ELITE_SCRIPT_API). Свой файл на
// пачку, чтобы параллельные правки не сталкивались в длинных списках
// item-script.mjs. Имена ключей не должны повторять имена из item-script.mjs.

import { ancientBannerLost, useGreaterHerald, useStandYourGround, useVillainousHonour, useDelegate, noblesseObligeSlip } from "../gerold-talents.mjs";
import { useVeilRender, useRift, useSpeedOfThought, useWarpTrail } from "../warp-talon-talents.mjs";
import { useBeltFeed, useFlyBy } from "../moritat-talents.mjs";
import { useAnointed, useAtramentar, useDeathShroud } from "../terminator-talents.mjs";
import { useChaosGreatbow, useDivineShield, dedicateChaosSteed, useSinEater } from "../bronenosets-talents.mjs";

export const API = {
  // Броненосец
  useChaosGreatbow, useDivineShield, dedicateChaosSteed, useSinEater,
  // Герольд
  ancientBannerLost, useGreaterHerald, useStandYourGround, useVillainousHonour, useDelegate, noblesseObligeSlip,
  // Коготь Варпа
  useVeilRender, useRift, useSpeedOfThought, useWarpTrail,
  // Моритат
  useBeltFeed, useFlyBy,
  // Чемпион Терминатор
  useAnointed, useAtramentar, useDeathShroud
};
