// module/combat/ogryn-regen.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Пассивное восстановление Ран «Физиологии Громилы» (Огрин) — обвязка
//  чистой арифметики rules/ogryn-regen.mjs под два источника времени:
//
//   • прокрутка Календаря — обработчик часов Состояний (CONDITION_CLOCK_HANDLERS
//     в combat/condition-clock.mjs, хук updateWorldTime);
//   • боевые Раунды — хук updateCombat (module/hooks.mjs): Раунд в этой
//     системе worldTime не двигает, а 5 секунд боя книга считает временем.
//
//  Кто лечится — решает возможность brutePhysiology.passiveRegen (запись
//  Конструктора на Черте «Физиология Громилы»), не раса: Черту получает и
//  Миньон с комплексной Чертой «Огрин».
//
//  Это лечение идёт ПОВЕРХ обычного естественного (combat/healing-clock.mjs):
//  книга называет его «пассивным» и не говорит, что оно заменяет Отдых или
//  Постельный режим.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import {
  ogrynRegenStep, OGRYN_REGEN_FLAG, OGRYN_REGEN_BANK_FLAG, SECONDS_PER_COMBAT_ROUND
} from "../rules/ogryn-regen.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

/**
 * Доложить `seconds` игрового времени в банк Огрина и вылечить, что набежало.
 * Не Огрин (нет возможности) — ничего. Карточка — только если что-то
 * вылечилось: минутный тик без результата в чат не пишется.
 * @returns {Promise<number>} сколько Ран восстановлено
 */
export async function ogrynRegenAdvance(actor, seconds, { source = "time" } = {}) {
  if (!actor?.system?.wounds || !(Number(seconds) > 0)) return 0;
  if (!hasRuleFlag(actor, OGRYN_REGEN_FLAG)) return 0;
  const bank = Number(actor.getFlag?.(NS, OGRYN_REGEN_BANK_FLAG)) || 0;
  const res = ogrynRegenStep(actor.system, bank, seconds);
  const patch = {};
  if (res.bank !== bank) patch[`flags.${NS}.${OGRYN_REGEN_BANK_FLAG}`] = res.bank;
  if (res.healed > 0) {
    patch["system.wounds.value"] = res.wounds.value;
    patch["system.wounds.critical"] = res.wounds.critical;
  }
  if (!Object.keys(patch).length) return 0;
  await actor.update(patch);
  if (res.healed > 0) {
    const when = source === "combat" ? "за Раунд боя" : "за прошедшее время";
    const rollMode = actor.hasPlayerOwner ? game.settings.get("core", "rollMode") : "gmroll";
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${rollIcon("heart", "#ff8a8a")}${esc(actor.name)} — Физиология Громилы</div>
        <div class="roll-threshold">Пассивное восстановление ${when}: <b>+${res.healed}</b> ${res.healed === 1 ? "Рана" : "Ран"} (1/мин легко, 1/10 мин тяжело, 1/час критически ранен).</div>
      </div>`
    }, rollMode));
  }
  return res.healed;
}

/** Обработчик часов Состояний: отрезок (from, to] Календаря. */
export async function ogrynRegenClock(actor, { from, to }) {
  return ogrynRegenAdvance(actor, Number(to) - Number(from), { source: "time" });
}

/**
 * Смена Раунда боя: каждому комбатанту-Огрину — 5 секунд за каждый
 * пройденный вперёд Раунд. Откат Раунда назад времени не добавляет.
 */
export async function ogrynRegenCombatRound(combat, changed) {
  const now = Number(changed?.round);
  const prev = Number(combat?.previous?.round ?? now - 1);
  const rounds = now - prev;
  if (!(rounds > 0)) return;
  for (const combatant of combat.combatants ?? []) {
    if (combatant.actor) await ogrynRegenAdvance(combatant.actor, rounds * SECONDS_PER_COMBAT_ROUND, { source: "combat" });
  }
}
