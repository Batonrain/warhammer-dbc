// module/apps/actor-control.mjs
// ════════════════════════════════════════════════════════════════════════
//  Контроль чужого токена (wdbc-ux8a) — слой Foundry-действий над чистым
//  module/rules/actor-control.mjs. Два независимых куска:
//
//   1. Гейт «встречный тест» — переиспользует module/combat/techniques.mjs::
//      _showContestDialog С СИНТЕТИЧЕСКИМ techDef (не из статичного
//      MELEE_CONTESTS: техника принимает ЛЮБОЙ совместимый объект, лишний
//      импорт/правка constants/combat.mjs не нужна). Как и у всех «встречных»
//      техник этого файла (Финт/Давление/Повалить/Напролом), код проверяет
//      ТОЛЬКО бросок ИНИЦИАТОРА против его же порога — «vs» защита цели
//      сравнивается столом вручную (тот же честный уровень автоматизации,
//      что у остальных Состязаний; здесь нет второго, более сильного
//      прецедента «resolve A vs B одним вызовом» — не изобретаю его).
//
//   2. Реальная передача Foundry-владения токеном — НЕОБЯЗАТЕЛЬНЫЙ довесок
//      сверх правило-флага (rules/actor-control.mjs::establishControl —
//      тот источник истины, эта передача может молча не сработать без
//      последствий для правил). Actor.ownership правит только GM (Foundry
//      v13, серверная валидация) — тот же relay-приём через game.socket,
//      что уже даёt apps/demon-mount.mjs::defaultBindDemonMountFn (action
//      "bindDemonMount"): не-ГМ клиент просит, активный ГМ у себя исполняет
//      (module/warhammer-dbc.mjs, action "grantActorControlOwnership"/
//      "revokeActorControlOwnership"). Освобождение УДАЛЯЕТ персональный
//      override (flags.-=/ownership.-=), а не восстанавливает «прежний
//      уровень» — избегает проблемы «результат недоступен по сокету»
//      (тот же компромисс, что уже принят у bindDemonMount).
// ════════════════════════════════════════════════════════════════════════

import { _showContestDialog } from "../combat/techniques.mjs";
import { establishControl } from "../rules/actor-control.mjs";

/**
 * Открыть диалог встречного теста; при успехе устанавливает контроль над
 * ТЕКУЩЕЙ целью (game.user.targets, как и сам _showContestDialog).
 *
 * @param {object} actor         инициатор захвата
 * @param {object} opts
 * @param {string} [opts.label]        подпись техники в диалоге
 * @param {string} [opts.note]         книжный текст-условие
 * @param {string} [opts.defaultChar]  характеристика по умолчанию (ws/wp/...)
 * @param {number} [opts.extraBonus]
 * @param {object} [opts.controlOpts]  прокидывается в establishControl (permanent/unit/durationValue/sourceItemUuid)
 */
export async function attemptSeizeControl(actor, {
  label = "Захват контроля", note = "", defaultChar = "ws", extraBonus = 0, controlOpts = {}
} = {}) {
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!target) {
    ui.notifications?.warn("Нет выбранной цели — захват контроля отменён.");
    return;
  }
  const techDef = {
    label, note, defaultChar, extraBonus,
    modLabel: `${defaultChar.toUpperCase()} vs защита цели`,
    // Встречный тест (wdbc-x1nz.2.73): цель сопротивляется той же
    // Характеристикой по кнопке в карточке — сравнивать вручную больше не надо.
    chatNote: "⚡ Встречный тест — цель сопротивляется по кнопке в карточке",
    onSuccess: async () => { await establishControl(target, actor.uuid, controlOpts); }
  };
  await _showContestDialog(actor, techDef);
}

const SOCKET = "system.warhammer-dbc";

/** ГМ — напрямую; иначе сокет-релей (обработчик — warhammer-dbc.mjs). */
export async function requestControlOwnership(targetActor, controllerActor) {
  const userId = _ownerUserIdOf(controllerActor);
  if (!userId) {
    ui.notifications?.warn("Не найден игрок за персонажем-контролёром — реальное владение токеном не передано (флаг контроля всё равно установлен).");
    return { ok: false, reason: "Нет игрока-владельца." };
  }
  if (game.user?.isGM) return grantControlOwnership(targetActor, userId);
  if (!game.users?.activeGM) {
    ui.notifications?.warn("Нет активного Мастера — реальное владение токеном не передано, флаг контроля всё равно установлен.");
    return { ok: false, reason: "Нет активного Мастера." };
  }
  game.socket?.emit(SOCKET, { action: "grantActorControlOwnership", userId: game.user?.id, targetUuid: targetActor.uuid, controllerUserId: userId });
  return { ok: true, relayed: true };
}

/** Пользователь, за которым закреплён этот актор (game.users.character) — null, если такого нет. */
function _ownerUserIdOf(actor) {
  return game.users?.find(u => u.character?.uuid === actor?.uuid)?.id ?? null;
}

/** Сама передача владения — только на стороне активного ГМ (прямой вызов или из сокет-обработчика). */
export async function grantControlOwnership(targetActor, controllerUserId) {
  await targetActor.update({ [`ownership.${controllerUserId}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER });
  return { ok: true };
}

/** ГМ — напрямую; иначе сокет-релей. */
export async function requestRevokeControlOwnership(targetActor, controllerActor) {
  const userId = _ownerUserIdOf(controllerActor);
  if (!userId) return { ok: false };
  if (game.user?.isGM) return revokeControlOwnership(targetActor, userId);
  if (!game.users?.activeGM) {
    ui.notifications?.warn("Нет активного Мастера — реальное владение токеном осталось у контролирующего игрока, снимите вручную.");
    return { ok: false, reason: "Нет активного Мастера." };
  }
  game.socket?.emit(SOCKET, { action: "revokeActorControlOwnership", userId: game.user?.id, targetUuid: targetActor.uuid, controllerUserId: userId });
  return { ok: true, relayed: true };
}

/** Удаляет персональный override владения целиком (падает обратно на ownership.default). */
export async function revokeControlOwnership(targetActor, controllerUserId) {
  await targetActor.update({ [`ownership.-=${controllerUserId}`]: null });
  return { ok: true };
}
