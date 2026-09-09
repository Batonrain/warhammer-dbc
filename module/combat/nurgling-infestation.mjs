// module/combat/nurgling-infestation.mjs
// ════════════════════════════════════════════════════════════════════════
//  Заражение Нурглингами / Nurgling Infestation (Дар Нургла, d100 74..77,
//  wdbc-1rno): «Когда персонаж получает непоглощённый урон, рядом с ним
//  манифестируется Нурглинг в Истинной Форме, дружественный ему, и
//  считающий его своим командиром. Если непоглощённый урон был 3 или выше,
//  количество Нурглингов увеличивается до 1d5, а если он был 7 или выше —
//  до 1d10.»
//
//  Что здесь считается, а что нет. Считается СКОЛЬКО: пороги 3 и 7 и их
//  кости — именно та арифметика, которую иначе игрок вспоминает вручную
//  посреди чужого хода, уже получив урон. Не считается САМА ВЫСТАВКА
//  токенов: «призыва существа вне слотов Миньонов» в системе нет вовсе
//  (слоты считаются по Талантам-источникам, module/apps/minion-creator.mjs
//  — это отдельная архитектура, а не строчка здесь), и подменять её
//  самодельным созданием акторов ради одной находки неправильно. Карточка
//  называет число и отправляет МИ выставить Нурглингов из Бестиария, где
//  они уже лежат готовыми NPC.
//
//  Триггер — та же точка, что у Наслаждения (combat/enjoyment.mjs::
//  maybeGrantEnjoymentPain): момент в applyDamageToActor, когда
//  непоглощённый урон уже посчитан со всеми поглощениями и аблативом.
//  Ограничения «раз за бой» книга здесь не даёт — Нурглинги лезут с
//  каждого пропущенного удара, и это не описка: Дар и задуман как
//  нарастающий ком.
// ════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

export const NURGLING_INFESTATION = "gift.nurgle.nurglingInfestation";

/**
 * Формула количества Нурглингов по величине непоглощённого урона.
 * null — урона не было, манифестации нет.
 */
export function nurglingCountFormula(netDamage) {
  const d = Number(netDamage) || 0;
  if (d <= 0) return null;
  if (d >= 7) return "1d10";
  if (d >= 3) return "1d5";
  return "1";
}

/** Пропущенный удар по носителю Дара — карточка с числом манифестировавших. */
export async function processNurglingInfestation(actor, netDamage) {
  const formula = nurglingCountFormula(netDamage);
  if (!formula || !actor) return;
  if (!hasRuleFlag(actor, NURGLING_INFESTATION)) return;

  const rolls = [];
  let count = 1;
  if (formula !== "1") {
    const roll = await new Roll(formula).evaluate();
    rolls.push(roll);
    count = roll.total;
  }

  await postTestCard(actor, {
    icon: rollIcon("warp", "#7fd36a"),
    title: `Заражение Нурглингами — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">Непоглощённый урон <b>${netDamage}</b> → манифестирует <b>${count}</b> Нурглинг(ов)${formula === "1" ? "" : ` (${formula})`} в Истинной Форме.</div>`,
      `<div class="roll-threshold" style="opacity:.8;">Дружественны чемпиону и считают его командиром. Выставить на сцену из Бестиария — вручную: призыва существа вне слотов Миньонов в системе нет.</div>`
    ]
  }, { rolls, sound: false });
}
