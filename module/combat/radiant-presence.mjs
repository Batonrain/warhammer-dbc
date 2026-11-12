// module/combat/radiant-presence.mjs
//
// Обвязка Блистательного Присутствия над сценой: чистая логика —
// module/rules/radiant-presence-sight.mjs, сам +10 к тесту Морали по-прежнему
// даёт флаг ctx.radiantPresence в module/rules/leadership-talents.mjs.
//
//   radiantPresenceSeenBy(actor, {sourceActor}) — какие союзные или нейтральные
//     носители Таланта на сцене видны цели теста; из него диалоги Морали (Страх,
//     Запугивание, Полевая Казнь) ставят галочку «Блистательное Присутствие»
//     при открытии, а ГМ/игрок могут её снять или поставить руками.
//   radiantPresenceHint(seen) — подсказка к галочке: что проставлено по
//     видимости и кто увиден; «слышит» — только руками.
//   resolveCardRadiantPresence(checkbox, actor, sourceActor) — то же для
//     галочки на карточке атаки (Подавление), у которой диалога нет: чекбокс
//     в «прочерке» (indeterminate) значит «решит видимость», отмеченный или
//     снятый — решение стола.

import { hasRadiantPresence } from "../rules/leadership-talents.mjs";
import { radiantHoldersInSight } from "../rules/radiant-presence-sight.mjs";

const docOf = t => t?.document ?? t;

/** Токены цели теста: свои у актора на сцене, иначе по id актора среди токенов сцены. */
function ownTokensOf(actor, placeables) {
  const own = actor?.getActiveTokens?.(false, true);
  if (Array.isArray(own) && own.length) return own.map(docOf);
  return placeables.filter(t => t.actor?.id && t.actor.id === actor?.id).map(docOf);
}

/**
 * @param {Actor} actor  цель теста Морали
 * @param {{sourceActor?:Actor|null}} [opts]  источник теста — его собственное Присутствие не считается
 * @returns {{seen:boolean, holders:string[]}}  holders — имена увиденных носителей
 */
export function radiantPresenceSeenBy(actor, { sourceActor = null } = {}) {
  const none = { seen: false, holders: [] };
  if (!actor) return none;
  const placeables = globalThis.canvas?.tokens?.placeables ?? [];
  const grid = globalThis.canvas?.scene?.grid ?? { size: 100, distance: 1 };
  const candidates = placeables
    .filter(t => t.actor && hasRadiantPresence(t.actor))
    .map(t => ({ actorId: t.actor.id, hasTalent: true, token: docOf(t), name: t.actor.name ?? t.name }));
  const found = radiantHoldersInSight({ ownTokens: ownTokensOf(actor, placeables), candidates, grid, sourceActorId: sourceActor?.id ?? null });
  return { seen: found.length > 0, holders: found.map(c => c.name).filter(Boolean) };
}

/** Подсказка галочки: проставлена по видимости и кем; «слышит» не считается. */
export function radiantPresenceHint(seen) {
  const base = "Блистательное Присутствие: цель видит или слышит союзника или нейтрального, обладающего этим Талантом — +10 на этот тест Морали. «Видит» проставляется само по полю зрения токена; «слышит» отметьте руками.";
  if (!seen?.seen) return base;
  const who = seen.holders.length ? ` Проставлено по видимости: ${seen.holders.join(", ")}.` : " Проставлено по видимости.";
  return base + who;
}

/**
 * Значение галочки на карточке атаки в момент броска.
 * @param {HTMLInputElement|null} checkbox  indeterminate=true — стол не трогал, решает видимость
 */
export function resolveCardRadiantPresence(checkbox, actor, sourceActor = null) {
  if (!checkbox) return false;
  if (!checkbox.indeterminate) return !!checkbox.checked;
  return radiantPresenceSeenBy(actor, { sourceActor }).seen;
}
