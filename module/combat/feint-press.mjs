// module/combat/feint-press.mjs
// ════════════════════════════════════════════════════════════════════════
//  ФИНТ И ДАВЛЕНИЕ (стр. 31, wdbc-x1nz.2.65) — эффекты победы в состязании
//  (MELEE_CONTESTS.feint/press, module/constants/combat.mjs). Тот бросок сам
//  по себе уже работал (module/combat/techniques.mjs::_showContestDialog),
//  эффект победы не был подключён — «Финт/Давление... не меняют поведение»
//  (техническая заметка, которую этот файл закрывает).
//
//  onSuccess живёт НЕ в constants/combat.mjs — тот файл чисто данные (как у
//  всех остальных MELEE_CONTESTS записей), функцию подмешивает вызывающая
//  сторона (module/sheets/tabs/combat.mjs, клик по кнопке Состязания), тот
//  же приём, что «Заломить» использует в своём отдельном ALL_TESTS
//  (module/combat/grapple.mjs) — просто здесь нет отдельного диалога-обёртки,
//  подмешивание идёт прямо в объект techDef перед _showContestDialog.
//
//  ФИНТ: «цель не может совершать Избегание от его атак до конца его Хода»
//  — не одна атака, а ВСЕ атаки этого конкретного персонажа до конца ЕГО
//  (не цели) Хода. Флаг живёт на ЦЕЛИ (feintNoEvade: {byUuid, byName}) —
//  attack.mjs читает его при разрешении атаки и форсирует dodgeMod/parryMod
//  −999, тем же порогом, что «Скрытая атака» (opts.hiddenAttack). Обратный
//  указатель на АКТОРЕ (feintTargetUuid) — только для очистки в конце Хода
//  (hooks.mjs, тот же такт, что Подавление/Прицеливание).
//
//  ДАВЛЕНИЕ: «может заставить цель переместиться на Успехи м. до максимума
//  в её SPD... либо последовать за целью, сохраняя базовый контакт, либо
//  остаться на месте» — само перемещение токена НЕ автоматизировано (нет
//  разметки препятствий/стен на пути, тот же честный компромисс, что у
//  движения в укрытие при Подавлении, wdbc-x1nz.2.62) — карточка считает и
//  печатает максимальную дистанцию, стол двигает токен сам. Условие-запрет
//  книги («нельзя, если цель уверена, что оружие не может нанести ей больше
//  3 урона после Поглощения») — GM-суждение, не автоматизировано.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { spdMeters } from "./recoil-pool.mjs";

const NS = "warhammer-dbc";

export async function resolveFeintSuccess(actor, { target } = {}) {
  if (!target) {
    return ui.notifications?.warn(`${actor.name}: цель Финта не выцелена на сцене — эффект не наложен.`);
  }
  await target.setFlag(NS, "feintNoEvade", { byUuid: actor.uuid, byName: actor.name });
  await actor.setFlag(NS, "feintTargetUuid", target.uuid);
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"),
    title: `Финт: ${esc(target.name)}`,
    outcome: outcomeHtml(true, `До конца Хода ${esc(actor.name)} — Избегание ${esc(target.name)} от его атак недоступно (стр. 31).`)
  }, { sound: false });
}

/** Финт снимает Избегание от атак ИМЕННО этого атакующего (не от чужих). */
export function feintBlocksEvasion(defenderActor, attackerActor) {
  const f = defenderActor?.getFlag?.(NS, "feintNoEvade");
  return !!f && f.byUuid === attackerActor?.uuid;
}

/** Снимается в конце Хода атакующего (hooks.mjs), не цели. */
export async function clearFeintAtTurnEnd(actor) {
  const targetUuid = actor?.getFlag?.(NS, "feintTargetUuid");
  if (!targetUuid) return;
  await actor.unsetFlag(NS, "feintTargetUuid");
  const target = await fromUuid(targetUuid).catch(() => null);
  const flag = target?.getFlag?.(NS, "feintNoEvade");
  if (target && flag?.byUuid === actor.uuid) await target.unsetFlag(NS, "feintNoEvade");
}

export async function resolvePressSuccess(actor, { deg, target } = {}) {
  if (!target) {
    return ui.notifications?.warn(`${actor.name}: цель Давления не выцелена на сцене — эффект не наложен.`);
  }
  const spd = spdMeters(target);
  const maxMeters = spd > 0 ? Math.min(deg, spd) : deg;
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"),
    title: `Давление: ${esc(target.name)}`,
    outcome: outcomeHtml(true, `Можно сдвинуть ${esc(target.name)} до <b>${maxMeters} м</b> в любом направлении`
      + (spd > 0 ? ` (Успехи ${deg}, потолок SPD ${spd})` : ` (Успехи ${deg}, SPD цели неизвестен — потолок не проверен)`)
      + ` — переместите токен сами; ${esc(actor.name)} может последовать за целью, сохраняя контакт, или остаться на месте (стр. 31).`)
  }, { sound: false });
}
