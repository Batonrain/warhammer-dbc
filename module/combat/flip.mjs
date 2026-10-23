// module/combat/flip.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Flip / Кувырок (Талант Избегания, глава 3): «Когда он сбивается с ног, он
//  может пройти тест Acrobatics+0, чтобы сразу же встать. Если он упал в
//  результате неудачного теста на Трудный Ландшафт, персонаж может продолжать
//  движение, как если бы прошел этот тест.»
//
//  «Сбивается с ног» ловим по факту: у носителя Состояние «Повален» сменилось
//  с нет на да (hooks.mjs, updateActor) — так же приходят Повалить, Напролом,
//  критические эффекты и падение на Трудном Ландшафте. Лечь по своей воле
//  (declareProne) этот приём пропускает — пометка в опциях записи.
//  Предложение — карточка с кнопкой; бросок и подъём — по клику владельца.
// ════════════════════════════════════════════════════════════════════════════

import { hasDodgeTalent } from "../rules/dodge-talents.mjs";
import { standUpExtraApCost } from "../rules/takedown.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { skillTotal } from "./movement-actions.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";

/** Опция записи Состояния, которой «Лечь» помечает добровольное падение. */
export const VOLUNTARY_PRONE_OPTION = "whVoluntaryProne";

/** Сбило ли это обновление актора с ног (Повален стал истинным) и не добровольно ли. */
export function flipTriggered(changes, options = {}) {
  return changes?.system?.conditions?.prone === true && !options?.[VOLUNTARY_PRONE_OPTION];
}

/** Карточка-предложение носителю Таланта. */
export async function offerFlip(actor) {
  if (!hasDodgeTalent(actor, "flip")) return false;
  await postTestCard(actor, {
    icon: rollIcon("run", "#9fb4ff"), title: `Кувырок — ${esc(actor.name)}`, actorUuid: actor.uuid,
    lines: [`<div class="roll-threshold">Сбит с ног. Acrobatics+0 — подняться сразу, без траты действия.
      Если сбило неудачным тестом Трудного Ландшафта — при успехе движение продолжается, будто тест пройден.</div>`],
    sections: [`<div class="roll-defense-section"><button class="wh-flip-btn" type="button" data-actor-uuid="${actor.uuid}">
      ${rollIcon("run")}Кувырок: Acrobatics+0</button></div>`]
  }, { sound: false });
  return true;
}

/** Бросок Кувырка по клику. */
export async function rollFlip(actor) {
  if (!actor?.system?.conditions?.prone) return ui.notifications.warn("⚠️ Персонаж уже не Повален.");
  const base = skillTotal(actor, "acrobatics");
  const mods = collectTestMods(actor, { kind: "skill", skill: "acrobatics", char: "ag" });
  const threshold = base + mods.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  // «Ещё Не Всё» (rules/takedown.mjs): сбитый Вырубанием помеченный платит +1 ОД за ЛЮБОЙ
  // способ встать, и Кувырок не исключение (решение владельца 23.10.2026). Считается до снятия
  // «Повален» — вместе с ним уходит и метка.
  const extra = success ? standUpExtraApCost(actor) : 0;
  const unpaid = extra > 0 && !await spendActionPoints(actor, extra, { physical: true });
  if (success && !unpaid) await actor.update(conditionRemoveFields("prone"));
  await postTestCard(actor, {
    icon: rollIcon("run", "#9fb4ff"), title: `Кувырок — ${esc(actor.name)}`, actorUuid: actor.uuid,
    threshold: rollStatLine({ label: "Acrobatics", base, parts: mods.parts, threshold, rv: roll.total }),
    outcome: success && unpaid
      ? outcomeHtml(false, `Успех — ${deg} ${_degWord(deg)}, но «Ещё Не Всё»: встать стоит +${extra} ОД, а их не хватает — остаётся Повален.`)
      : success
      ? outcomeHtml(true, extra > 0
        ? `Успех — ${deg} ${_degWord(deg)}. Перекатился и вскочил на ноги, заплатив ${extra} ОД («Ещё Не Всё»).`
        : `Успех — ${deg} ${_degWord(deg)}. Перекатился и вскочил на ноги, не потратив действия.`)
      : outcomeHtml(false, `Провал — ${deg} ${_degWord(deg)}. Остаётся Повален (подняться можно обычным способом).`)
  }, { rolls: [roll] });
  return { success: success && !unpaid };
}
