// module/combat/vehicle-force-move.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Против Техники (стр. 27): попытки толкать/переворачивать технику (кроме
//  согласной/обездвиженной) — ВСЕГДА встречные, атакующий Athletics(S) (см.
//  force-move.mjs — та же формула, штраф массивности/Помеха применяются
//  так же) против пилота Operate(A)+20. Пилот при этом временно считается
//  имеющим Трейт Unnatural A (2×<разница в Размерах>), если уже не имеет
//  его с лучшим Рейтингом — маневрирует машиной, чтобы усложнить задачу.
//
//  Unnatural даёт не изменение Порога, а бонус Успехов на СВОЙ успешный тест
//  (rules/unnatural-characteristic.mjs, стр. 26: +⌊X/2⌋ Успехов) — здесь этот
//  бонус временный (на один встречный тест), поэтому считается тут же, а не
//  постоянным Трейтом на акторе.
//
//  Сравнение исхода встречного теста (кто выше по степени Успеха) — то же
//  правило книги, что уже используется другими встречными тестами проекта
//  (kind-outcome.mjs), здесь не переиспользуется напрямую (тот конвейер
//  рассчитан на диалог одного актора) — карточка просто показывает оба
//  результата и итог сравнения читателю.
//
//  Последствия перевёрнутой/растерявшей наводку техники (стр. 27: «большая
//  часть техники... становится обездвиженной... днище открывается») —
//  текстовые, не автоматизированы: система не знает заранее, что стало
//  «дном» у конкретной модели техники.
// ════════════════════════════════════════════════════════════════════════════

import { forceMoveThreshold, forceMoveDistance } from "./force-move.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { unnaturalRating, unnaturalDegreeBonus } from "../rules/unnatural-characteristic.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";

const OPERATE_BONUS = 20;

/** Порог Operate(A)+20 пилота + временный бонус Успехов Unnatural A(2×разница), если он выше уже имеющегося. */
export function pilotOperateThreshold(pilot, sizeDiff = 0) {
  const operate = pilot?.system?.skills?.operate?.total ?? -20;
  const ruleMods = collectTestMods(pilot, { kind: "skill", skill: "operate", char: "ag" });
  const threshold = operate + ruleMods.total + OPERATE_BONUS;
  const ownRating = unnaturalRating(pilot, "ag");
  const tempRating = Math.max(ownRating, 2 * Math.max(0, sizeDiff));
  const degreeBonus = unnaturalDegreeBonus(tempRating);
  return { threshold, base: operate, parts: [...ruleMods.parts, `Operate+${OPERATE_BONUS}`], degreeBonus, tempRating, ownRating };
}

/**
 * Встречный тест: атакующий Athletics(S) (через force-move.mjs, с той же
 * массивностью/Помехой) против пилота Operate(A)+20 (+Unnatural A временный).
 * Полное действие/обе руки списываются с атакующего (Через Силу применяется
 * всегда — толкать/переворачивать чужую технику по определению «за пределами
 * согласия», не бывает «в пределах лимита» против сопротивляющегося пилота).
 */
export async function useVehiclePushContest(actor, pilot, { mode = "push", sizeDiff = 0 } = {}) {
  if (!actor || !pilot) return;
  if (!await spendActionPoints(actor, 2, { physical: true })) {
    return ui.notifications.warn("⚠️ Не хватает ОД на Полное действие (обе руки).");
  }

  const atk = forceMoveThreshold(actor, { sizeDiff });
  const disadvantage = atk.massive;
  const atkRoll = await rollD100WithReroll(
    disadvantage ? { rolls: 2, mode: "disadvantage", label: "Помеха (Массивная техника)" } : null
  );
  const atkOutcome = testOutcome(atkRoll.rv, atk.threshold);
  const atkDeg = atkOutcome.success ? atkOutcome.deg : 0;

  const def = pilotOperateThreshold(pilot, sizeDiff);
  const defRoll = await new Roll("1d100").evaluate();
  const defOutcome = testOutcome(defRoll.total, def.threshold);
  const defDeg = defOutcome.success ? defOutcome.deg + def.degreeBonus : 0;

  // Стр. 26: во встречном тесте выигрывает больший Успех; оба провалили —
  // никто не продавил технику. Атакующий выигрывает только реальным успехом.
  const win = atkOutcome.success && atkDeg > defDeg;
  const spd = actor.system?.movement?.spd ?? 0;
  const distance = win ? forceMoveDistance(mode, atkDeg, spd) : 0;

  const dice = await atkRoll.roll.render();
  const defDice = await defRoll.render();
  const modeLabel = mode === "push" ? "Толкание" : "Переворот";
  await postTestCard(actor, {
    icon: rollIcon("run", "#b0a080"),
    title: `${esc(actor.name)} vs ${esc(pilot.name)} — Против Техники (${modeLabel})`,
    threshold: rollStatLine({ label: "Athletics(S)", base: atk.base, parts: atk.parts, threshold: atk.threshold, rv: atkRoll.rv }),
    outcome: win
      ? outcomeHtml(true, `Атакующий выигрывает встречный тест (${atkDeg} vs ${defDeg} Усп.) — сдвинуто на ${distance}м`)
      : outcomeHtml(false, `Пилот удерживает технику (${defDeg} vs ${atkDeg} Усп.)`),
    rerollNote: atkRoll.rerollNote,
    sections: [
      `<div class="roll-threshold">${esc(pilot.name)} — Operate(A)+20: Бросок <b>${defRoll.total}</b> vs Порог <b>${def.threshold}</b>`
        + `${def.tempRating > def.ownRating ? ` (временный Unnatural A ${def.tempRating}, +${def.degreeBonus} Усп.)` : ""}</div>`,
      `<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Атакующий</summary>${dice}</details>`,
      `<details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Пилот</summary>${defDice}</details>`
    ]
  }, { rolls: [atkRoll.roll, defRoll] });
}
