// module/apps/infernal-inspiration.mjs
// ════════════════════════════════════════════════════════════════════════
//  Инфернальное Вдохновение (Черта Когитора): «мгновенно получить аналог
//  полноценного сна, сняв всю Усталость и до 2d10 урона в I и W (один бросок
//  для обоих)». Цену (1 Очко Вдохновения) списывает кнопка записи Конструктора
//  (capabilityCostPool "res:inspiration", combat/capability-cost.mjs); здесь —
//  сам эффект. Доступна скриптам Механики (apps/item-script.mjs).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { fatigueChangeFields, announceFatigueChange } from "../sheets/tabs/conditions.mjs";
import { charHealFields } from "../rules/char-loss.mjs";

/** Снять всю Усталость и вылечить 2d10 урона в I и W одним броском. */
export async function inspiredRest(actor, { label = "Аналог полноценного сна" } = {}) {
  if (!actor) return "нет персонажа";
  const fat = fatigueChangeFields(actor, 0, { wake: true });
  if (Object.keys(fat.fields ?? {}).length) await actor.update(fat.fields);
  const roll = await new Roll("2d10").evaluate();
  const healed = {};
  for (const key of ["int", "wp"]) {
    const { patch, healed: n } = charHealFields(actor.system, key, roll.total);
    healed[key] = n;
    if (Object.keys(patch).length) await actor.update(patch);
  }
  await announceFatigueChange(actor, fat);
  await postTestCard(actor, {
    icon: rollIcon("bolt", "#c98bff"), title: `${esc(label)} — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">Усталость снята.</div>`,
      `<div class="roll-threshold">Бросок 2d10: <b>${roll.total}</b> — вылечено урона в I: <b>${healed.int}</b>, в W: <b>${healed.wp}</b>.</div>`
    ]
  }, { rolls: [roll], sound: true });
  return undefined;
}
