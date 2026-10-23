// module/combat/shapeshift.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Адаптация Сплайса «Перевертыш» / Shapeshifter (корбук, Сплайс, wdbc-tkeh1):
//  «Дает перманентно эффект Полиморфина (стр. 283), считаясь как женщина для
//  эффекта, независимо от настоящего пола». Женский вариант Полиморфина: «за
//  полудействие тест A+20, и в зависимости от количества Успехов персонаж
//  меняет внешность» (таблица — rules/shapeshifter.mjs).
//
//   useShapeshift(actor) — кнопка записи Трейта (kind:"script"): 1 ОД
//     (полудействие), тест A+20 (с модификаторами реестра правил), в чат —
//     строка таблицы по числу Успехов.
//
//  Облик на «сменить до конца действия» не хранится: у препарата срок T.b
//  часов, у Перевертыша эффект постоянный — внешность ведёт стол. Лимита «раз
//  в Раунд» нет: книга его не вводит, каждая смена — новый тест за полудействие.
//
//  Не сделано (стол): сверка Размера с «+/– N%» и перенос формы тела на лист.
// ════════════════════════════════════════════════════════════════════════════

import { shapeshiftStep, SHAPESHIFT_MOD } from "../rules/shapeshifter.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { unnaturalRating, unnaturalDegreeBonus } from "../rules/unnatural-characteristic.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";

/**
 * Сменить облик: полудействие + тест A+20 + строка таблицы в чат.
 * Возвращает truthy при самоотказе (нет ОД) — так runMechScriptEntry не
 * списывает цену записи за несостоявшееся действие.
 */
export async function useShapeshift(actor) {
  if (!actor) return null;
  if (!await spendActionPoints(actor, 1)) {
    return ui.notifications?.warn("⚠️ Не хватает ОД (полудействие) — облик не меняется.");
  }
  const base = Number(actor.system?.characteristics?.ag?.total) || 0;
  const mods = collectTestMods(actor, { kind: "characteristic", char: "ag" });
  const threshold = base + SHAPESHIFT_MOD + (mods.total || 0);
  const roll = await new Roll("1d100").evaluate();
  const out = testOutcome(roll.total, threshold);
  // Unnatural A добавляет Успехи к удачному тесту (стр. 26).
  const successes = out.success ? out.deg + unnaturalDegreeBonus(unnaturalRating(actor, "ag")) : 0;
  const step = shapeshiftStep(successes);

  await postTestCard(actor, {
    icon: rollIcon("warp", "#c9a0ff"),
    title: `Сменить облик — ${esc(actor.name)}`,
    threshold: rollStatLine({
      label: "Ag+20", base, parts: [`Перевертыш +${SHAPESHIFT_MOD}`, ...(mods.parts ?? [])],
      threshold, rv: roll.total
    }),
    outcome: step
      ? outcomeHtml(true, `${successes} ${_degWord(successes)} (${step.min}+ У): можно сменить ${esc(step.text)}.`)
      : outcomeHtml(false, "Не удалось — облик не изменился (полудействие потрачено).")
  }, { rolls: [roll] });
  return undefined;
}
