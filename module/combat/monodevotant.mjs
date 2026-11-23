// module/combat/monodevotant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка Черты «Монозависимый»: отметить дозу субстанции и бросить
//  срок до ломки 1d10+W.b дней. Арифметика и книжный текст —
//  rules/monodevotant.mjs. Зовётся кнопкой Черты на панели «Возможности
//  сейчас» (запись Конструктора kind:"script", scriptOnPanel).
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { NS, SUBSTANCE_AT_FLAG, GRACE_DAYS_FLAG, GRACE_FORMULA, NOTICED_FLAG, monodevotantTrait,
         monodevotantPenalty, withdrawalNoticeDue, withdrawalOutcomeUpdate } from "../rules/monodevotant.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

/** Субстанция получена: сейчас + бросок срока 1d10+W.b дней. */
export async function giveMonodevotantSubstance(actor, trait = null) {
  const t = trait ?? monodevotantTrait(actor);
  if (!actor || !t) return { ok: false, reason: "Нет Черты «Монозависимый»." };
  const now = game.time?.worldTime ?? 0;
  const wasPenalty = monodevotantPenalty(t.getFlag(NS, SUBSTANCE_AT_FLAG), t.getFlag(NS, GRACE_DAYS_FLAG), now);
  const wb = Number(actor.system?.characteristics?.wp?.bonus) || 0;
  const roll = await new Roll(`${GRACE_FORMULA}+${wb}`).evaluate();
  const grace = Math.max(0, roll.total);
  await t.setFlag(NS, SUBSTANCE_AT_FLAG, now);
  await t.setFlag(NS, GRACE_DAYS_FLAG, grace);
  if (t.getFlag(NS, NOTICED_FLAG)) await t.unsetFlag(NS, NOTICED_FLAG);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("heart", "#c98bff")}${esc(actor.name)} — получил субстанцию</div>
      <div class="roll-threshold">Монозависимый: без новой дозы ломка начнётся через <b>${grace}</b> дн. (1d10+W.b = ${roll.result}).${
        wasPenalty ? ` Штраф ломки −${wasPenalty} снят.` : ""}</div>
    </div>`,
    rolls: [roll], sound: CONFIG.sounds?.dice
  });
  return { ok: true, grace };
}

/**
 * Прокрутка Календаря (hooks.mjs updateWorldTime, клиент ГМа): ломка выросла —
 * карточка-развилка ГМу шёпотом. true — карточка выложена.
 */
export async function processMonodevotantWithdrawal(actor, now) {
  const t = monodevotantTrait(actor);
  const pen = withdrawalNoticeDue(t, now);
  if (!pen) return false;
  await t.setFlag(NS, NOTICED_FLAG, pen);
  const btn = (mode, label, title) => `<button type="button" class="wh-monodevotant-btn" data-actor-uuid="${esc(actor.uuid)}" data-mode="${mode}" title="${esc(title)}">${label}</button>`;
  const gms = (game.users ?? []).filter(u => u.isGM).map(u => u.id);
  await postTestCard(actor, {
    icon: rollIcon("heart", "#c98bff"), title: `Монозависимый: ломка — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Без субстанции: штраф ко всем Характеристикам <b>−${pen}</b>. От длительной ломки Миньон может покинуть хозяина или умереть — решите исход.</div>`],
    sections: [`<div class="roll-defense-btns">${[
      btn("stay", "Держится", "Миньон терпит — штраф ломки остаётся"),
      btn("leave", "Покидает хозяина", "Связь с хозяином разорвана: Миньон уходит"),
      btn("die", "Умирает", "Миньон умирает от ломки")
    ].join(" ")}</div>`]
  }, { sound: false, whisper: gms.length ? gms : null });
  return true;
}

/** Кнопка карточки ломки. true — исход применён. */
export async function resolveMonodevotantWithdrawal(actor, mode) {
  if (!actor) return false;
  const upd = withdrawalOutcomeUpdate(mode);
  if (upd) await actor.update(upd);
  const text = { stay: "держится — ломка продолжается", leave: "покидает хозяина", die: "умирает от ломки" }[mode] ?? "";
  if (!text) return false;
  await postTestCard(actor, { icon: rollIcon("heart", "#c98bff"), title: `Монозависимый — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">${esc(actor.name)} ${text}.</div>`] }, { sound: false });
  return true;
}
