// module/combat/gladiator.mjs
// Гладиатор — Foundry-сторона rules/gladiator-arena.mjs: Кровавое
// Представление (снимок Момента в конце Хода и тест F), Ретиарий (обратный
// удар цепью за очко Момента), Милитарий (Повалить из Частокола и бросок
// через себя с уроном падения 2 м).

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { momentumOf, addMomentum } from "./momentum.mjs";
import { sizeOf } from "../rules/predicates.mjs";
import {
  hasBloodyPerformance, hasRetiarius, hasMilitarius, unarmouredParts, bloodyPerformanceBonus, retiariusChainLength
} from "../rules/gladiator-arena.mjs";
import { rollTestCard, firstTargetActor } from "./duelist-tests.mjs";

const NS = "warhammer-dbc";
export const BLOODY_PERF_FLAG = "bloodyPerformance";
const card = (actor, icon, title, lines, sections = []) => postTestCard(actor, {
  icon, title: `${title} — ${esc(actor.name)}`,
  lines: lines.filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`), sections
}, { sound: false });

/**
 * Конец Хода гладиатора: сколько очков Момента набрано с конца прошлого Хода.
 * Набрал — карточка-подсказка «можно сыграть Кровавое Представление».
 */
export async function bloodyPerformanceTurnEnd(actor, combat) {
  if (!actor || !hasBloodyPerformance(actor)) return;
  const now = momentumOf(actor);
  const prev = actor.getFlag(NS, BLOODY_PERF_FLAG);
  const last = prev?.combatId === combat?.id ? (Number(prev.last) || 0) : 0;
  const gained = Math.max(0, now - last);
  await actor.setFlag(NS, BLOODY_PERF_FLAG, { combatId: combat?.id ?? "", last: now, gained });
  if (gained > 0) await card(actor, "🎭", "Кровавое Представление", [
    `Ход закончен с ${now} очками Момента — на ${gained} больше, чем в прошлый раз. Можно пройти тест F+0 (+${bloodyPerformanceBonus(gained, unarmouredParts(actor))}) — кнопка Черты «Кровавое Представление».`
  ]);
}

/** Кровавое Представление: тест F+0 +10 за набранное очко, +5 за открытую часть тела. */
export async function useBloodyPerformance(actor) {
  if (!actor || !hasBloodyPerformance(actor)) return ui.notifications.warn("⚠️ У актора нет Черты Кровавое Представление.");
  const f = actor.getFlag(NS, BLOODY_PERF_FLAG);
  const gained = Number(f?.gained) || 0;
  if (gained <= 0) return ui.notifications.warn("⚠️ В конце прошлого Хода Момента не прибавилось — Представления нет.");
  const bare = unarmouredParts(actor);
  await actor.setFlag(NS, BLOODY_PERF_FLAG, { ...f, gained: 0 });
  await rollTestCard(actor, {
    icon: "🎭", title: "Кровавое Представление", label: "F",
    base: Number(actor.system?.characteristics?.fel?.total) || 0,
    mod: bloodyPerformanceBonus(gained, bare), modLabel: `Момент +${gained}×10, без брони ${bare}×5`,
    ctx: { kind: "skill", char: "fel" },
    lines: r => [r.success
      ? `Успехи (${r.deg}) — на выбор: как Успехи теста Командования союзников (первый эффект Короткой Команды, без траты действия) или как тест Запугивания противников.`
      : "Толпа не впечатлена."]
  });
}

/** Ретиарий: от оружия на цепи Уклонились — очко Момента за ещё одно попадание на обратном пути (со спины). */
export async function useRetiariusReturn(actor) {
  if (!actor || !hasRetiarius(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Ретиарий.");
  if (momentumOf(actor) < 1) return ui.notifications.warn("⚠️ Нет очков Момента.");
  await addMomentum(actor, -1);
  const t = firstTargetActor();
  await card(actor, "⛓️", "Ретиарий: обратный удар", [
    `Потрачено 1 очко Момента (осталось ${momentumOf(actor)}): оружие на цепи наносит ${t ? esc(t.name) : "цели"} ещё одно попадание на обратном пути — атака с обратной стороны (со спины). Бросьте урон этого оружия кнопкой урона его карточки.`,
    `Цепь: до ${retiariusChainLength(actor)} м (A.b×2); метание — WS вместо BS (окно атаки ставит само), возврат в руку — свободное действие.`
  ]);
}

/** Милитарий: из Частокола после успешной Свободной Атаки — Повалить (база Стандартная Атака) задержанным действием. */
export async function useMilitarius(actor) {
  if (!actor || !hasMilitarius(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Милитарий.");
  if ((actor.system?.meleeStance || "standard") !== "rapidstrike") return ui.notifications.warn("⚠️ Нужна Стойка «Частокол».");
  const target = firstTargetActor();
  if (!target) return ui.notifications.warn("⚠️ Наведите цель Свободной Атаки.");
  const { _showContestDialog } = await import("./techniques.mjs");
  const { MELEE_CONTESTS } = await import("../constants/combat.mjs");
  const { resolveKnockdownSuccess, knockdownResistMods, knockdownSizePenalty } = await import("./knockdown.mjs");
  const { fallDamageSectionHtml } = await import("./fall-damage.mjs");
  await _showContestDialog(actor, {
    ...MELEE_CONTESTS.knockdown,
    label: "Повалить",
    note: "Милитарий: Повалить задержанным действием (база Стандартная Атака). Победа: цель Ничком; Размер цели не больше своего+1 — бросок через себя, урон падения с 2 м.",
    resistMods: (opp, me) => knockdownResistMods(me, opp),
    defaultMod: knockdownSizePenalty(actor, target),
    onSuccess: async (a, res) => {
      await resolveKnockdownSuccess(a, res);
      const t = res?.target;
      if (!t || sizeOf(t) > sizeOf(a) + 1) return;
      const roll = await new Roll("1d10 + 2").evaluate();
      await postTestCard(a, {
        icon: "🛡️", title: `Милитарий: бросок через себя — ${esc(t.name)}`,
        lines: [`<div class="roll-dice">Падение с 2 м · 1d10+2: <b>${roll.total}</b></div>`],
        sections: [fallDamageSectionHtml(roll.total, "Милитарий: бросок через себя")]
      }, { rolls: [roll] });
    }
  });
}
