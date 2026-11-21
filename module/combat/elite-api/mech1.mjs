// module/combat/elite-api/mech1.mjs
// Помощники скриптов кнопок Талантов/Черт элитных архетипов (пачка «mech1»).
// Всё, что экспортировано в API, видно коду kind:"script"-записей Конструктора
// по имени ключа (module/apps/item-script.mjs → ELITE_SCRIPT_API). Свой файл на
// пачку, чтобы параллельные правки не сталкивались в длинных списках
// item-script.mjs. Имена ключей не должны повторять имена из item-script.mjs.

import { useArchDominusCommand, useAvatarOfMetal, useDoctrinaCalibration, useVisioIrae } from "../archmagos.mjs";
import { useToilseerCrew, useAssemblyLine, useChainsOfProduction, useInhumanResources, useRapidEmbrace, useThrallOverclock } from "../lacrimallus.mjs";
import { useParagonCoil, useDigitalGhost, useFellDischarge, useMagnetomorphosis, usePrescontax, useRogoex } from "../malagra.mjs";
import { useVassalAp, useVassalSwap, useAwakening, useNeuronist, useBrainContainerPrep, useBrainExtract } from "../monarch.mjs";

export const API = {
  // Архимагос (combat/archmagos.mjs)
  useArchDominusCommand, useAvatarOfMetal, useDoctrinaCalibration, useVisioIrae,
  // Лакрималлус (combat/lacrimallus.mjs)
  useToilseerCrew, useAssemblyLine, useChainsOfProduction, useInhumanResources, useRapidEmbrace, useThrallOverclock,
  // Малагра (combat/malagra.mjs)
  useParagonCoil, useDigitalGhost, useFellDischarge, useMagnetomorphosis, usePrescontax, useRogoex,
  // Монарх (combat/monarch.mjs)
  useVassalAp, useVassalSwap, useAwakening, useNeuronist, useBrainContainerPrep, useBrainExtract
};
