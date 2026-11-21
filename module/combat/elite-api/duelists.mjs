// module/combat/elite-api/duelists.mjs
// Помощники скриптов кнопок Талантов/Черт элитных архетипов (пачка «duelists»).
// Всё, что экспортировано в API, видно коду kind:"script"-записей Конструктора
// по имени ключа (module/apps/item-script.mjs → ELITE_SCRIPT_API). Свой файл на
// пачку, чтобы параллельные правки не сталкивались в длинных списках
// item-script.mjs. Имена ключей не должны повторять имена из item-script.mjs.

import { forceEnemyMeleeReroll, chooseRavenStance, usePassBy, useRedirectBlow } from "../raven.mjs";
import { useWarSeer, useWitchslayer, useAllKnowing, useBloodFatherFeat } from "../vitkis.mjs";
import { useBloodyPerformance, useRetiariusReturn, useMilitarius } from "../gladiator.mjs";
import { useFinale, useLeitmotif } from "../note-warrior.mjs";
import { weaveRunicPower, usePiercingShot } from "../pitati.mjs";

export const API = {
  // Ворон
  forceEnemyMeleeReroll, chooseRavenStance, usePassBy, useRedirectBlow,
  // Виткис
  useWarSeer, useWitchslayer, useAllKnowing, useBloodFatherFeat,
  // Гладиатор
  useBloodyPerformance, useRetiariusReturn, useMilitarius,
  // Воин Ноты
  useFinale, useLeitmotif,
  // Питати
  weaveRunicPower, usePiercingShot
};
