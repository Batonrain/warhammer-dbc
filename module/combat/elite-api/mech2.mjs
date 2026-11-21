// module/combat/elite-api/mech2.mjs
// Помощники скриптов кнопок Талантов/Черт элитных архетипов (пачка «mech2»).
// Всё, что экспортировано в API, видно коду kind:"script"-записей Конструктора
// по имени ключа (module/apps/item-script.mjs → ELITE_SCRIPT_API). Свой файл на
// пачку, чтобы параллельные правки не сталкивались в длинных списках
// item-script.mjs. Имена ключей не должны повторять имена из item-script.mjs.

import { useDestructor, useGunzerker } from "../secutor.mjs";
import { useCoilsSelfCharge, useCoilsShield, useCoilsDamageReduction, useVoltagheistBlast, useVoltagheistBubble, useVoltaicAbsorption } from "../electropriest.mjs";
import { useMachineSpiritThief, useTorturedSpirit, useDaemonicUplink, useDiscordantDuo, useHellbound } from "../lord-discordant.mjs";
import { useBisection, useDisjoint, useModularAutonomy, useScorpio, useChrysalis, useParadoxVeil } from "../tech-assassin.mjs";

export const API = {
  // Тех Ассасин
  useBisection, useDisjoint, useModularAutonomy, useScorpio, useChrysalis, useParadoxVeil,
  // Секутор
  useDestructor, useGunzerker,
  // Электрожрец
  useCoilsSelfCharge, useCoilsShield, useCoilsDamageReduction, useVoltagheistBlast, useVoltagheistBubble, useVoltaicAbsorption,
  // Лорд Дискордант
  useMachineSpiritThief, useTorturedSpirit, useDaemonicUplink, useDiscordantDuo, useHellbound
};
