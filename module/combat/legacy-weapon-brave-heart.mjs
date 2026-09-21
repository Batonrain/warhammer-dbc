// module/combat/legacy-weapon-brave-heart.mjs
//
// Лучшая Часть Отваги/skilled 5-6, Оружие Наследия, стрелковая ветка
// (wdbc-1rno.35, стр. 427): «Если выстрел этого оружия не убил и не
// обезвредил цель, персонаж может совершить Полудвижение за свободное
// действие.» Кнопка на карточке урона (АТАКУЮЩЕЙ стороны, не жертвы, в
// отличие от Жнеца/Ошеломляющего) — «жива и не обезврежена» стол
// подтверждает самим кликом, тот же честный уровень, что Kiss of Mimic/
// Silent Elimination (module/combat/damage.mjs). Сам свободный Полудвижение —
// module/combat/movement-actions.mjs::declareLegacyBraveHeartMove.

import { takenMutationNames } from "../rules/legacy-weapon.mjs";

/** Кнопка на карточке урона — видна только для стрелкового оружия с этой Мутацией. */
export function braveHeartLegacyButtonHtml(weapon, attackerUuid) {
  if (!weapon || weapon.system?.weaponClass === "melee") return "";
  if (!takenMutationNames(weapon).has("Лучшая Часть Отваги")) return "";
  if (!attackerUuid) return "";
  return `<button class="wh-legacy-brave-heart-btn" type="button" data-actor-uuid="${attackerUuid}">
    🏃 Лучшая Часть Отваги: цель жива и не обезврежена — свободное Полудвижение
  </button>`;
}
