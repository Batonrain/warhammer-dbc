// module/combat/elite-api/null-zones-body.mjs
// Помощники скриптов кнопок пачки «ауры Парии/Дискорданта и мутации тела»
// (crb, пачка 2, группа C). Всё, что экспортировано в API, видно коду
// kind:"script"-записей Конструктора по имени ключа (module/apps/item-script.mjs
// → ELITE_SCRIPT_API). Имена ключей не должны повторять имена из item-script.mjs.

import { pariahTouch } from "../pariah-touch.mjs";
import { activateSpatialInstability, returnToReality, extendSpatialInstability, toggleDreamWalk,
         hatredThroughVeil, warpDominionTest, breachTheVeil } from "../spatial-instability.mjs";
import { bonelessStand, toggleBonelessQuadruped } from "../boneless.mjs";
import { suppressBurningBody, restoreBurningBody } from "../burning-body.mjs";

export const API = {
  // Пария: касание (task-1452)
  pariahTouch,
  // Пространственная Нестабильность (wdbc-1rno.8)
  activateSpatialInstability, returnToReality, extendSpatialInstability, toggleDreamWalk,
  hatredThroughVeil, warpDominionTest, breachTheVeil,
  // Бескостный (wdbc-1rno.9)
  bonelessStand, toggleBonelessQuadruped,
  // Пылающее Тело (wdbc-1rno.16)
  suppressBurningBody, restoreBurningBody
};
