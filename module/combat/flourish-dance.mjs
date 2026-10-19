// module/combat/flourish-dance.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Flourish Dance / Размашистый Танец (Талант Избегания, глава 3): «Когда он
//  носит плащ и одна из его рук свободна, персонаж может за полудействие или
//  как часть полудвижения или полного движения взять плащ в эту руку и пройти
//  тест Dancer (A)+0 vs Awareness (P)+0 против существа в пределах A.b метров.
//  Если персонаж побеждает, за каждый его Успех цель получает штраф –5 на все
//  атаки по персонажу до начала его следующего Хода.»
//
//  Кнопка на вкладке БОЙ (цель — под прицелом): диалог (часть движения?),
//  1 ОД, оба d100 бросает система, исход — rules/test-kind.mjs::resolveOpposed.
//  Штраф лежит флагом на танцоре (flourishDance → uuid цели + число); флаг
//  гасится в начале следующего Хода танцора (rules/turn-flags.mjs), а окно
//  атаки цели по танцору (sheets/attack/mods.mjs) читает его строкой.
//  Плащ, свободная рука и «в пределах A.b м» система не проверяет — решает стол.
// ════════════════════════════════════════════════════════════════════════════

import { hasDodgeTalent, flourishPenalty } from "../rules/dodge-talents.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { sideValue } from "./opposed-contest.mjs";
import { actorIdentityUuids } from "./command-state.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";
export const FLOURISH_FLAG = "flourishDance";

export function hasFlourishDance(actor) {
  return hasDodgeTalent(actor, "flourishDance");
}

/** Итог Навыка Trade (Dancer) или null, если такого Навыка на листе нет. */
export function dancerTotal(actor) {
  const list = actor?.system?.groupSkills?.trade;
  const entry = (Array.isArray(list) ? list : []).find(s => /dancer|танц/i.test(String(s?.specialty ?? "")));
  return entry ? Number(entry.total) || 0 : null;
}

/** Штраф танца, действующий против этого атакующего (0 — нет). */
export function flourishPenaltyAgainst(dancer, attacker) {
  const flag = dancer?.getFlag?.(NS, FLOURISH_FLAG);
  if (!flag?.penalty || !attacker) return 0;
  const ids = actorIdentityUuids(attacker);
  return (flag.targetUuids ?? []).some(u => ids.has(u)) ? Number(flag.penalty) || 0 : 0;
}

export async function applyFlourishDance(actor) {
  if (!hasFlourishDance(actor)) return ui.notifications.warn("⚠️ Нужен Талант Flourish Dance/Размашистый Танец.");
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!target || target === actor) return ui.notifications.warn("⚠️ Наведите цель (существо в пределах A.b метров).");
  const dance = dancerTotal(actor);
  if (dance == null) return ui.notifications.warn("⚠️ Нет Навыка Trade (Dancer) — Талант требует его.");

  const free = await foundry.applications.api.DialogV2.wait({
    window: { title: `Размашистый Танец — ${actor.name}` },
    classes: ["wh-roll-dialog-window"],
    position: { width: 380 },
    content: `<div class="wh-skill-roll-form">
      <div class="atk-range-info" style="font-size:0.85em;">Нужен плащ и свободная рука; цель — в пределах A.b м. Полудействие (1 ОД) либо часть полудвижения/полного движения.</div>
      <div class="roll-dlg-row"><label><input type="checkbox" name="free"/> Как часть движения (0 ОД)</label></div></div>`,
    buttons: [
      { action: "go", label: "Танцевать!", default: true,
        callback: (event, button) => !!button.form.querySelector('[name="free"]')?.checked },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    rejectClose: false
  });
  if (free == null) return;
  if (!free && !await spendActionPoints(actor, 1, { physical: true })) return ui.notifications.warn("⚠️ Не хватает ОД.");

  const awareness = sideValue(target, { skill: "awareness" });
  const [r1, r2] = [await new Roll("1d100").evaluate(), await new Roll("1d100").evaluate()];
  const mine = { ...testOutcome(r1.total, dance), threshold: dance };
  const theirs = { ...testOutcome(r2.total, awareness), threshold: awareness };
  const { winner } = resolveOpposed(mine, theirs);
  const successes = winner === "mine" && mine.success ? mine.deg : 0;
  const penalty = flourishPenalty(successes);
  if (penalty) {
    await actor.setFlag(NS, FLOURISH_FLAG, { targetUuids: [...actorIdentityUuids(target)], penalty });
  }
  await postTestCard(actor, {
    icon: rollIcon("run", "#d9a0ff"), title: `Размашистый Танец — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Dancer(A)", base: dance, parts: [], threshold: dance, rv: r1.total }),
    lines: [`<div class="roll-threshold">${esc(target.name)}: Awareness(P) ${awareness}, бросок <b>${r2.total}</b> — ${theirs.success ? `Успех ${theirs.deg}` : `Провал ${theirs.deg}`}</div>`],
    outcome: penalty
      ? outcomeHtml(true, `Танцор побеждает: ${successes} ${_degWord(successes)} — все атаки ${esc(target.name)} по ${esc(actor.name)} получают ${penalty} до начала его следующего Хода.`)
      : outcomeHtml(false, `Танец не сбил прицел: ${esc(target.name)} ${winner === "theirs" ? "побеждает во встречном тесте" : "не поддаётся"} — штрафа нет.`)
  }, { rolls: [r1, r2] });
}
