// module/combat/deadly-effectiveness.mjs
// ════════════════════════════════════════════════════════════════════════
//  Deadly Effectiveness / Смертоносная Эффективность (wdbc-1rno,
//  actionPoint.bonusOnFeintKill.extraMeleeAttack): «Убийство после финта в
//  том же раунде: раз в раунд +2 ОД и доп. рукопашная атака вне лимита».
//
//  Триггер («убил ПОСЛЕ своего Финта в этом раунде») НЕ детектируется
//  автоматически: в системе нет ни понятия «убийство»/смерть персонажа
//  вообще (grep по всей базе — damage.mjs знает только Тир Ран "dying", не
//  "dead"; смерть — целиком нарративное решение ГМа), ни отметки «применил
//  Финт в этом раунде» (Приём "feint" attack-dialog.mjs — только модификатор
//  на бросок, флагом никогда не пишется; Состязание "feint" techniques.mjs —
//  тоже разовый бросок без следа). Изобретать оба примитива под одну находку
//  не оправдано (тот же принцип, что Категория C/Snapshot/Just the Light).
//
//  Вместо авто-детекта — кнопка на вкладке БОЙ (по образцу Борьбы/
//  grapple-btn и .ae-spend-btn, wdbc-qjnk): игрок сам подтверждает клик
//  «да, было убийство после Финта в этом раунде», система обеспечивает
//  только механическую часть — «раз в Раунд» (module/rules/cooldown.mjs,
//  unit "round") и сам +2 ОД. «Доп. атака вне лимита» отдельно не смоделирована
//  и не нужна: в системе вообще нет счётчика атак за Ход (тот же вывод, что
//  для Eldar Agility, wdbc-1rno) — +2 ОД уже дают практический эквивалент.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasActionEconomy, isEncounterActive } from "./action-economy.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

export const DEADLY_EFFECTIVENESS_FLAG = "actionPoint.bonusOnFeintKill.extraMeleeAttack";

export function hasDeadlyEffectiveness(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Deadly Effectiveness"));
}

/** {disabled, title} для кнопки — гейт виден ДО клика (wdbc-qjnk, тот же приём, что apSpendGate). */
export function deadlyEffectivenessGate(actor) {
  const ok = isCapabilityAvailable(actor, DEADLY_EFFECTIVENESS_FLAG, "round");
  return {
    disabled: !ok,
    title: ok
      ? "Убийство после Финта в этом Раунде: +2 ОД (раз в Раунд)"
      : "Уже использовано в этом Раунде"
  };
}

/** Клик по кнопке: +2 ОД, отмечает использованной в текущем Раунде. Возвращает false, если уже потрачено или бой не идёт. */
export async function triggerDeadlyEffectiveness(actor) {
  if (!hasActionEconomy(actor) || !hasDeadlyEffectiveness(actor) || !isEncounterActive()) return false;
  if (!isCapabilityAvailable(actor, DEADLY_EFFECTIVENESS_FLAG, "round")) return false;
  await markCapabilityUsed(actor, DEADLY_EFFECTIVENESS_FLAG, "round");
  const value = Number(actor.system.actionPoints?.value) || 0;
  await actor.update({ "system.actionPoints.value": value + 2 });
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("sword", "#ff9d4d")}${esc(actor.name)} — Смертоносная Эффективность</div>
      <div class="roll-threshold">Убийство после Финта в этом Раунде: +2 ОД.</div>
    </div>`
  }, game.settings.get("core", "rollMode")));
  return true;
}
