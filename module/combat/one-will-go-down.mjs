// module/combat/one-will-go-down.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ONE WILL GO DOWN / ОДИН ИЗ НАС ПАДЁТ — Foundry-обвязка к
//  rules/berserker-talents.mjs::oneWillGoDownApplies (Таланты «Берсерк», Sahara 3-861e).
//
//  Книга (core.json, pdf-стр. 78): «Совершая атаку с базой Полная Атака по Ненавистной цели,
//  персонаж может удвоить ее Dmg (до Поглощения). Если эта атака убивает или выводит врага из
//  строя, персонаж получает 1 Усталости, если нет (в т.ч. из-за промаха) – T.b+W.b Усталости (и
//  немедленно теряет сознание). Независимо от успеха, персонаж также получает 1d5 непоглощаемого
//  R Dmg в руку, которой он атаковал, от порванных связок и мышц, вызванных перенапряжением.»
//
//  Что делает бросок (combat/attack.mjs): Dmg ×2 до Поглощения, 1d5 в руку носителю при любом
//  исходе (раз на атаку — переброс не платит повторно), кнопка итога на карточке.
//
//  Усталость зависит от исхода УДАРА, а он известен только после применения урона:
//   • урон применили и цель вышла из строя (Раны были > 0, стали ≤ 0 — тот же признак, что у
//     Разрубить) → карточка урона (combat/damage.mjs) сама засчитывает «1 Усталости»;
//   • во всех остальных случаях (промах, Избегание, не вышла из строя) игрок жмёт кнопку на
//     карточке атаки и выбирает исход: система берёт T.b+W.b и теряет сознание по порогу Усталости.
//  Кнопка одна на карточку (card-once, «oneWillGoDownSettled»): после итога гаснет.
//
//  «Рука, которой он атаковал»: Раны системой хранятся целым — урон в руку списывается с Ран
//  носителя (как Кровавое Пламя / Ритуал Самопожертвования), критический эффект руки не бросается.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { oneWillGoDownFatigue, ONE_WILL_SELF_DAMAGE } from "../rules/berserker-talents.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { addFatigue, conditionApplyFields, fatigueFaintMinutes } from "../sheets/tabs/conditions.mjs";
import { cardOnceUsed, runCardOnce } from "./card-once.mjs";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const ONE_WILL_GO_DOWN_CARD_FLAG = "oneWillGoDownSettled";

/** Разметка кнопки итога (класс .wh-owgd-btn слушает hooks.mjs). */
export function oneWillGoDownButtonHtml({ attackerUuid, targetName = "" }) {
  return `<div class="roll-damage-section roll-owgd">
    <div class="roll-damage-label">Один Из Нас Падёт (Талант)</div>
    <button class="wh-owgd-btn" type="button" data-attacker-uuid="${esc(attackerUuid)}"
      title="Подвести итог: убил или вывел из строя — 1 Усталости; иначе (промах, Избегание, цель устояла) — T.b+W.b Усталости и потеря сознания. Если урон по цели уже применён кнопкой и вывел её из строя, итог засчитан сам.">
      ${rollIcon("burst", "#ff6b6b")}Подвести итог: ${esc(targetName) || "цель"} выведена из строя?
    </button>
  </div>`;
}

/**
 * Урон в руку: 1d5 непоглощаемого R Dmg носителю. Возвращает брошенный Roll (чтобы карточка атаки показала
 * кубик) и итог списания Ран.
 * @returns {Promise<{roll: Roll, loss: object}>}
 */
export async function rollOneWillGoDownHandDamage(actor) {
  const roll = await new Roll(ONE_WILL_SELF_DAMAGE).evaluate();
  const loss = await applyWoundLoss(actor, roll.total);
  return { roll, loss };
}

/**
 * Засчитать цену Таланта в Усталости. felled — удар убил или вывел цель из строя.
 * @param {Actor} actor носитель
 * @param {{felled: boolean, post?: Function}} p post — подмена карточки для тестов
 * @returns {Promise<{fatigue: number}>}
 */
export async function settleOneWillGoDown(actor, { felled, post } = {}) {
  const amount = oneWillGoDownFatigue(actor, !!felled);
  const res = amount > 0 ? await addFatigue(actor, amount) : null;
  // «Немедленно теряет сознание»: обычный порог Усталости (T.b+W.b, у Ментальной Стойкости больше) сам может не
  // сработать — тогда сознание снимается явно, тем же способом, что при обмороке от Усталости. Саркофаг (Усталость не
  // растёт) и иммунитет к Без сознания обморок не дают — карточка говорит правду, а не «записано автоматически».
  let fainted = !!res?.fainted;
  if (!felled && res && !res.blocked && !fainted && !actor.system?.conditions?.unconscious) {
    const apply = conditionApplyFields("unconscious", null, actor);
    if (Object.keys(apply).length) {
      const minutes = fatigueFaintMinutes(actor.system?.characteristics?.t?.bonus);
      await actor.update({ ...apply, "system.conditions.fatigueFaintWakeAt": (Number(globalThis.game?.time?.worldTime) || 0) + minutes * 60 });
      fainted = true;
    }
  }
  const card = {
    icon: rollIcon("burst", "#ff6b6b"), title: `Один Из Нас Падёт: ${esc(actor.name)}`,
    outcome: felled
      ? `Цель убита или выведена из строя — <b>1</b> Усталости.`
      : `Цель устояла (или промах) — <b>${amount}</b> Усталости (T.b+W.b).`,
    sections: felled ? [] : [`<div class="roll-threshold" style="font-size:0.85em;">${fainted
      ? "Персонаж теряет сознание (Без сознания записано автоматически)."
      : "Сознание сохранено: Усталость не выросла (Саркофаг) или есть иммунитет к Без сознания — решите вручную."}</div>`]
  };
  await (post ?? (c => postTestCard(actor, c, { sound: false })))(card);
  return { fatigue: amount };
}

/**
 * Карточка урона вывела цель из строя: засчитать носителю 1 Усталости, если карточка атаки ещё без итога и
 * носителя может менять этот клиент (владелец или ГМ). Возвращает строку-секцию для карточки урона
 * (пустую — если засчитать некому/уже засчитано).
 */
export async function settleOneWillGoDownOnFelled({ attackerUuid, sourceMessageId = "" }) {
  const attacker = await fromUuid(attackerUuid).catch(() => null);
  if (!attacker) return "";
  const message = sourceMessageId ? (game.messages?.get(sourceMessageId) ?? null) : null;
  if (message && cardOnceUsed(message, ONE_WILL_GO_DOWN_CARD_FLAG)) return "";
  if (!attacker.isOwner) {
    return `<div class="roll-threshold">Один Из Нас Падёт: цель выведена из строя — ${esc(attacker.name)} получает 1 Усталости (подведите итог кнопкой на карточке атаки).</div>`;
  }
  const run = async () => { await settleOneWillGoDown(attacker, { felled: true }); return true; };
  if (message) await runCardOnce(message, ONE_WILL_GO_DOWN_CARD_FLAG, run, "Итог Один Из Нас Падёт с этой карточки уже подведён.");
  else await run();
  return `<div class="roll-threshold">Один Из Нас Падёт: цель выведена из строя — ${esc(attacker.name)} получает 1 Усталости.</div>`;
}
