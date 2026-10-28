// module/combat/takedown.mjs
// ════════════════════════════════════════════════════════════════════════════
//  TAKEDOWN / ВЫРУБАНИЕ — «При успешном Оглушении он может выбрать также сбить
//  цель с ног» (Рукопашные, гл. 3) — Foundry-обвязка к module/rules/takedown.mjs.
//
//  Кнопка «Сбить с ног» рисуется в карточке урона (combat/damage.mjs), когда
//  приём Оглушить реально наложил Оглушение, а у атакующего есть Талант. По
//  клику цель получает Состояние «Повален» через единую точку наложения
//  (statusApplyFields: иммунитет и Стена Таланта Стойкости учтены, тот же путь,
//  что у Повалить, combat/knockdown.mjs). Если у атакующего ещё и «Ещё Не Всё»
//  (That's Not All) — вместе с Состоянием на цель ложится метка запрета
//  Вскочить (LEAP_UP_DENIED_FLAG), которую читает «Встать»
//  (combat/movement-actions.mjs); метка уходит вместе с «Повален»
//  (sheets/tabs/conditions.mjs::conditionRemoveFields).
//
//  Раз на карточку (combat/card-once.mjs): повторный клик, в том числе после
//  перезагрузки чата, ничего не делает.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { statusApplyFields } from "./status-resist.mjs";
import { runCardOnce } from "./card-once.mjs";
import { hasTakedown, hasThatsNotAll, LEAP_UP_DENIED_FLAG } from "../rules/takedown.mjs";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const TAKEDOWN_CARD_FLAG = "takedownKnockdown";

/** Разметка кнопки (класс .wh-takedown-btn слушает hooks.mjs). */
export function takedownButtonHtml({ attackerUuid, targetUuid, targetName = "" }) {
  return `<div class="roll-defense-section">
    <button class="wh-takedown-btn" type="button"
      data-attacker-uuid="${esc(attackerUuid)}" data-target-uuid="${esc(targetUuid)}"
      title="Вырубание: при успешном Оглушении можно сбить цель с ног">
      ${rollIcon("run")}Вырубание: сбить с ног ${esc(targetName)}
    </button>
  </div>`;
}

/**
 * Секция карточки урона: кнопка есть, только если у атакующего Талант, цель
 * ещё стоит на ногах и Оглушение действительно наложилось. Пустая строка — иначе.
 * @param {string} attackerUuid uuid актора-атакующего (damageData.attackerUuid)
 * @param {Actor} target        цель, на которой применён урон
 */
export async function takedownSection(attackerUuid, target) {
  if (!attackerUuid || !target?.uuid) return "";
  if (target.system?.conditions?.prone) return "";
  const attacker = await fromUuid(attackerUuid).catch(() => null);
  if (!attacker || !hasTakedown(attacker)) return "";
  return takedownButtonHtml({ attackerUuid, targetUuid: target.uuid, targetName: target.name });
}

/**
 * Обработчик кнопки. true — попытка состоялась (карточка помечена).
 * @param {ChatMessage} message карточка урона
 */
export async function takedownKnockdown(message, attackerUuid, targetUuid) {
  const attacker = attackerUuid ? await fromUuid(attackerUuid).catch(() => null) : null;
  const target = targetUuid ? await fromUuid(targetUuid).catch(() => null) : null;
  if (!attacker || !target) { ui.notifications?.warn("⚠️ Атакующий или цель не найдены."); return false; }
  if (!game.user?.isGM && !attacker.isOwner) {
    ui.notifications?.warn("⚠️ Сбить с ног может владелец атакующего или Мастер.");
    return false;
  }
  if (!hasTakedown(attacker)) {
    ui.notifications?.warn(`⚠️ У ${attacker.name} нет Таланта «Вырубание».`);
    return false;
  }
  return runCardOnce(message, TAKEDOWN_CARD_FLAG, async () => {
    if (target.system?.conditions?.prone) {
      ui.notifications?.info(`${target.name} уже Повален(а).`);
      return false;
    }
    // Игрок почти никогда не владеет целью (NPC): писать в неё может только ГМ.
    // Правка уходит активному ГМу сокетом (applyTakedownRelay), как у командования
    // (combat/command-state.mjs::updateOrRelay) — иначе клик падал бы «нет прав».
    if (!game.user?.isGM && !target.isOwner) {
      if (!game.users?.activeGM) {
        ui.notifications?.warn("⚠️ Цель не ваша, а Мастера нет в игре — сбить с ног некому.");
        return false;
      }
      game.socket?.emit("system.warhammer-dbc",
        { action: "takedownKnockdown", userId: game.user.id, attackerUuid, targetUuid });
      ui.notifications?.info(`Вырубание: Мастер сбивает с ног ${target.name}.`);
      return true;
    }
    return applyTakedown(attacker, target);
  }, "С этой карточки цель уже сбивали с ног.");
}

/**
 * Само сбивание: Состояние «Повален» через единую точку наложения + метка
 * «Ещё Не Всё», карточка-итог. Выполняется на клиенте, у которого есть право
 * писать в цель (ГМ или владелец).
 * @returns {Promise<boolean>} true — попытка состоялась
 */
export async function applyTakedown(attacker, target) {
  const { fields, resisted, note } = await statusApplyFields(target, "prone", null,
    { attacker, melee: true, source: "Вырубание" });
  const applied = Object.keys(fields).length > 0;
  const marked = applied && hasThatsNotAll(attacker);
  if (marked) fields[`flags.warhammer-dbc.${LEAP_UP_DENIED_FLAG}`] = true;
  if (applied) await target.update(fields);

  const text = applied
    ? `${esc(target.name)} сбит(а) с ног (Повален).${marked ? " «Ещё Не Всё»: Вскочить не поможет, а встать стоит ещё +1 ОД." : ""}`
    : resisted ? esc(note) : `${esc(target.name)}: Состояние «Повален» не наложено (иммунитет).`;
  await postTestCard(attacker, {
    icon: rollIcon("run", "#e0a060"),
    title: `Вырубание — ${esc(attacker.name)}`,
    actorUuid: attacker.uuid,
    lines: [`<div class="roll-threshold">${text}</div>`]
  }, { sound: false });
  return true;
}

/**
 * Сокет (ГМ): игрок нажал «сбить с ног» по чужой цели. Сокет открыт любому
 * игроку, поэтому ГМ сам сверяет всё, что кнопка проверила на клиенте:
 * просящий владеет атакующим, у того есть Талант, цель Оглушена и на ногах.
 */
export async function applyTakedownRelay(data, requester) {
  const attacker = data?.attackerUuid ? await fromUuid(data.attackerUuid).catch(() => null) : null;
  const target = data?.targetUuid ? await fromUuid(data.targetUuid).catch(() => null) : null;
  if (!attacker || !target) return;
  if (requester && !requester.isGM && !attacker.testUserPermission?.(requester, "OWNER")) {
    return console.warn("Warhammer DBC | takedownKnockdown отклонён: просящий не владеет атакующим");
  }
  if (!hasTakedown(attacker)) {
    return console.warn("Warhammer DBC | takedownKnockdown отклонён: у атакующего нет Вырубания");
  }
  if (!target.system?.conditions?.stunned || target.system?.conditions?.prone) {
    return console.warn("Warhammer DBC | takedownKnockdown отклонён: цель не Оглушена или уже лежит");
  }
  await applyTakedown(attacker, target);
}
