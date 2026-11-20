// module/combat/monodevotant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка Черты «Монозависимый»: отметить дозу субстанции и бросить
//  срок до ломки 1d10+W.b дней. Арифметика и книжный текст —
//  rules/monodevotant.mjs. Зовётся кнопкой Черты на панели «Возможности
//  сейчас» (запись Конструктора kind:"script", scriptOnPanel).
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { NS, SUBSTANCE_AT_FLAG, GRACE_DAYS_FLAG, GRACE_FORMULA, monodevotantTrait,
         monodevotantPenalty } from "../rules/monodevotant.mjs";

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
