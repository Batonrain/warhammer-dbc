// module/apps/burned-senses.mjs
// ════════════════════════════════════════════════════════════════════════
//  Burned Senses / Выжженные Чувства (wdbc-1rno) — Foundry-обвязка поверх
//  module/rules/burned-senses.mjs. ПЕРВЫЙ бросок (что теряем) — уже даёт
//  стандартный автобросок субмутации при выдаче Мутации (item.system.
//  submutation.name, rules/submutations.mjs), эта функция катает ВТОРОЙ
//  (что усиливаем) и применяет то немногое, что в системе реально
//  существует: перманентную потерю Зрения/Слуха. Усиление (+20/переброс
//  провалов) и потеря Касания/Нюха/Вкуса — честный нарратив, GM отыгрывает
//  сам (см. шапку rules/burned-senses.mjs про Awareness как единый Навык).
// ════════════════════════════════════════════════════════════════════════

import { burnedSenseFromRoll, senseKeyFromName, burnedSenseConditionKey, SENSE_LABELS }
  from "../rules/burned-senses.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const FLAG = "warhammer-dbc";
const RESOLVED_FLAG = "burnedSensesResolved";

/**
 * @param {Actor} actor
 * @param {Item} item Мутация «Выжженные Чувства» на этом акторе
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function resolveBurnedSenses(actor, item) {
  if (!actor || !item) return { ok: false, reason: "Нет актора или предмета." };
  if (item.getFlag(FLAG, RESOLVED_FLAG)) {
    return { ok: false, reason: "Уже применено — второй бросок не повторяем." };
  }

  const lostKey = senseKeyFromName(item.system?.submutation?.name);
  if (!lostKey) {
    return { ok: false, reason: "Первая субмутация (что теряем) ещё не брошена — сначала выдайте Мутацию обычным способом." };
  }

  const roll = await new Roll("1d10").evaluate();
  const boostedKey = burnedSenseFromRoll(roll.total);
  const sameSense = boostedKey === lostKey;
  // «Одинаковые чувства» — книга сама называет решением ГМа: чувство не
  // теряется вовсе (возвращается, слегка изменённое), поэтому условие ниже
  // не применяется в этом случае.
  const condKey = sameSense ? null : burnedSenseConditionKey(lostKey);
  if (condKey) await actor.update(conditionApplyFields(condKey, null, actor));

  await item.setFlag(FLAG, RESOLVED_FLAG, true);

  const lostLabel = SENSE_LABELS[lostKey];
  const boostedLabel = SENSE_LABELS[boostedKey] ?? "?";
  const lines = [];
  if (sameSense) {
    lines.push(`<div class="roll-threshold">Оба броска — <b>${esc(lostLabel)}</b>: чувство не теряется, а возвращается слегка ` +
      `изменённым — решение ГМа за столом (книга не даёт формулы).</div>`);
  } else {
    lines.push(`<div class="roll-threshold">Теряет: <b>${esc(lostLabel)}</b>${condKey ? " (перманентно наложено)" : " — механики этой потери в системе нет, отыгрывается за столом"}</div>`);
    lines.push(`<div class="roll-threshold">Усиливает: <b>${esc(boostedLabel)}</b> — «+20 и переброс провалов» не подключить ни к одному чувству: ` +
      `Бдительность в системе один общий Навык на все чувства, отдельного теста на каждое нет. Бонус отыгрывается по решению ГМа.</div>`);
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warn", "#8fd0ff")}Выжженные Чувства — ${esc(actor.name)}</div>
      <div class="roll-dice">Второй бросок (что усиливаем): 1d10 → <b>${roll.total}</b> (${esc(boostedLabel)})</div>
      ${lines.join("")}
    </div>`
  }, game.settings.get("core", "rollMode")));

  return { ok: true };
}
