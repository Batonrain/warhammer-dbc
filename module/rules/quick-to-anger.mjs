// module/rules/quick-to-anger.mjs
// ════════════════════════════════════════════════════════════════════════
//  Warp-Touched/Затронутый Варпом, субмутация 8 «Вспыльчивость» (wdbc-5inv):
//  «При получении атаки или оскорбления персонаж должен пройти тест на W+0,
//  или впасть в Ярость». «Оскорбление» — событие за столом, движку сверять
//  не с чем (тот же принцип, что «эмоция, которой питается» у Warp Eater);
//  «получение атаки» читается как единая точка урона (combat/damage.mjs::
//  applyDamageToActor — тот же хук, что уже взводит флаг Pacifism), не
//  каждый бросок на попадание отдельно — промах сюда не доходит, то же
//  ограничение, что уже принято для Pacifism. Уже в Ярости — тест не нужен,
//  повторно входить в неё некуда.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { autoTestMods } from "./roll-mods.mjs";
import { postTestCard, thresholdLine } from "../helpers/test-card.mjs";

export const QUICK_TO_ANGER_CAPABILITY = "mutation.warpTouched.quickToAnger";

/** Тест W+0 (стр. текста субмутации) — провал вгоняет актора в Ярость. */
export async function rollQuickToAngerTest(actor) {
  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  const ruleMods = autoTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = wp + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= threshold;

  if (!success) await actor.update({ "system.inRage": true });

  await postTestCard(actor, {
    icon: "😠", title: `Вспыльчивость — ${esc(actor.name)}`,
    threshold: thresholdLine({ label: "W", base: wp, parts: ruleMods.parts, threshold }),
    rv,
    outcome: success
      ? `<span class="roll-success">Успех — сдержался</span>`
      : `<span class="roll-failure">Провал — впадает в Ярость</span>`
  }, { rolls: [roll] });
}
