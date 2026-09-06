// module/combat/blade-shield.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПАРИРОВАНИЕ ПСИХОСИЛ Талантом «Щит Клинков» (wdbc-bwf9).
//
//  Талант корбука (стр. 62) сам по себе про стрельбу: «вооружён оружием с
//  Балансом 1+ — может парировать им стрелковую атаку». Психосилы к нему
//  добавляют ДВЕ книги, и обе через предмет в руках, а не через сам Талант:
//
//  • Книга Аэльдари, Путь Варлока: «Если персонаж использует силовое оружие
//    эльдар или психосиловое психокостяное оружие, он может парировать вражеские
//    психосилы при помощи таланта Blade Shield».
//  • Книга Жаб-Псайкеров, ноктиковый щит: «Если у персонажа есть талант Blade
//    Shield, он может парировать психосилы с помощью ноктикового щита. При
//    успешном парировании эффекты психосилы нивелируются». Poor.Q того же щита
//    развеивает не полностью — за каждый успех снижает эPR.
//
//  Отсюда условие из ДВУХ частей, и обе обязательны: Талант на персонаже
//  (возможность dodge.core.bladeShield) И подходящий предмет ИМЕННО В РУКАХ
//  (возможность defence.psychicParryTool на самом предмете). Второе спрашивается
//  у предмета через itemHasKey, а не у актора через hasRuleFlag: клинок в рюкзаке
//  психосилу не отбивает, а ruleFlags не различает надетое и лежащее.
//
//  Почему предмет помечается возможностью, а не опознаётся по папке/типу: тип
//  «психокостяное» и ветка «Азуриане» — это авторская раскладка компендиума, и
//  самодельный предмет ГМа в неё не попадёт никогда. Возможность же ставится с
//  листа предмета галочкой в Конструкторе.
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { itemHasKey } from "../rules/item-marker.mjs";
import { handHeldItems } from "../rules/hands.mjs";

/** Талант «Щит Клинков» на персонаже. */
export const BLADE_SHIELD_CAPABILITY = "dodge.core.bladeShield";

/** Предмет, которым книга разрешает отбивать психосилы. */
export const PSYCHIC_PARRY_TOOL_CAPABILITY = "defence.psychicParryTool";

/**
 * Предмет, который в ПЛОХОМ качестве развеивает силу не полностью, а снижает
 * эPR за успех. Книга Жаб-Псайкеров говорит это про ноктиковый щит и только про
 * его Poor.Q — поэтому условий два: и возможность на предмете, и само качество.
 * Обобщать до «любой плохой инструмент только ослабляет» нечем: другой книга
 * такого не говорит ни про один предмет.
 */
export const PSYCHIC_PARRY_WEAK_CAPABILITY = "defence.psychicParryWeakens";

/** Плохое качество — единственная ступень, для которой книга даёт ослабление. */
const POOR_QUALITY = "poor";

/** Есть ли у персонажа сам Талант. */
export function hasBladeShield(actor) {
  return hasRuleFlag(actor, BLADE_SHIELD_CAPABILITY);
}

/**
 * Предмет в руках, которым можно отбить психосилу — или null.
 * Именно в руках: handHeldItems отбирает надетое и реально занимающее руку.
 */
export function psychicParryTool(actor) {
  return handHeldItems(actor).find(item => itemHasKey(item, PSYCHIC_PARRY_TOOL_CAPABILITY)) ?? null;
}

/**
 * Можно ли этому персонажу парировать психосилу прямо сейчас.
 *
 * Возвращает и причину отказа: молчаливо неактивная кнопка — то же самое, что
 * её отсутствие, а игрок должен видеть, ЧЕГО ему не хватает (Таланта или
 * нужного клинка в руке).
 *
 * @returns {{ok: boolean, tool: ?object, weakens: boolean, reason: string}}
 */
export function canParryPsychic(actor) {
  if (!hasBladeShield(actor)) {
    return { ok: false, tool: null, weakens: false, reason: "нет Таланта «Щит Клинков»" };
  }
  const tool = psychicParryTool(actor);
  if (!tool) {
    return { ok: false, tool: null, weakens: false,
             reason: "в руках нет силового эльдарского, психосилового психокостяного оружия или ноктикового щита" };
  }
  const weakens = itemHasKey(tool, PSYCHIC_PARRY_WEAK_CAPABILITY)
               && String(tool.system?.quality ?? "") === POOR_QUALITY;
  return { ok: true, tool, weakens, reason: "" };
}

/**
 * Исход парирования психосилы по книге.
 *
 * Обычный инструмент — успех нивелирует эффекты психосилы целиком (Книга
 * Жаб-Псайкеров, прямая формулировка). Poor.Q ноктиковый щит развеивает
 * частично: за каждый успех эPR психосилы падает на 1, и до нуля её надо ещё
 * дожать. Провал не делает ни того, ни другого.
 *
 * Чистая функция: ни документов Foundry, ни бросков — их делает вызывающий.
 *
 * @param {boolean} passed  тест Парирования пройден
 * @param {number}  deg     степеней успеха
 * @param {boolean} weakens инструмент только ослабляет (Poor.Q ноктик)
 * @param {number}  ePR     эPR парируемой психосилы
 */
export function psychicParryOutcome(passed, deg, weakens, ePR = 0) {
  if (!passed) return { negated: false, ePRLeft: ePR, drop: 0 };
  if (!weakens) return { negated: true, ePRLeft: 0, drop: ePR };
  const drop = Math.max(0, Math.min(ePR, Math.max(0, deg)));
  const left = ePR - drop;
  return { negated: left <= 0, ePRLeft: left, drop };
}
