// module/rules/sigillite-runes-combat.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Руны Сигиллитов — начисление по тактам боя (wdbc-fsl9).
//
//  Книга (DoomBC — Психокеры-Жабы, стр. 101-102):
//    • «В начале боя персонаж стартует с бPR рун» — УСТАНОВКА значения, а не
//      прибавка: «стартует с», а не «получает»;
//    • «В начале своего хода псайкер получает бPR рун и еще по +1 за каждую
//      ступень в навыке Forbidden Lore (Archeotech)» — прибавка каждый Ход;
//    • Rune Calculator: «При наступлении первого хода псайкера в бою он
//      получает дополнительно +I.b рун» — один раз за бой.
//
//  Отдельным файлом от rules/sigillite-runes.mjs намеренно: тот импортируется
//  пересчётом листа (rules/character.mjs) на КАЖДЫЙ prepareDerivedData, и
//  тащить в этот горячий путь ещё и троттлинг с календарём незачем.
//
//  «Один раз за бой» считает не свой счётчик, а общий примитив
//  rules/cooldown.mjs (unit "battle" — метка сравнивается с game.combat.id).
//  Своя мапа id→Set пережила бы перезагрузку мира хуже: игрок получил бы
//  бонус Вычислителя второй раз за тот же бой.
//
//  Заготовленная Руна / Prepared Rune (wdbc-p2it) — тем же тактом (combatStart),
//  но выбор ОДНОЙ Руны на бой не считается по числу, а спрашивается диалогом
//  (тот же приём, что Witch's Edge, module/combat/witchs-edge.mjs): выбор и
//  «уже использована скидка» хранятся явным флагом на акторе, который здесь
//  же и перезаписывается заново каждый Encounter — сравнения с id боя, в
//  отличие от Вычислителя выше, здесь нет: rules/sigillite-runes.mjs, где
//  живёт сама скидка, обязан остаться чистым (без game.combat).
// ════════════════════════════════════════════════════════════════════════════

import { hasRuneMagic, runeGainPerTurn, runeStartOfCombat, runeCalculatorBonus,
         runeUpdate, isRuneLearned, PREPARED_RUNE_FLAG } from "./sigillite-runes.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "./cooldown.mjs";
import { esc } from "../helpers/utils.mjs";

/** Метка «бонус Вычислителя Рун за этот бой уже выдан». */
export const RUNE_CALCULATOR_FLAG = "rune.sigillites.calculator";

// Namespace/ключ флага «выбранная Заготовленная Руна на этот бой» — тот же,
// что читает module/rules/sigillite-runes.mjs::preparedRuneChoiceId/
// isPreparedRuneUsed (флаг общий, эти два файла — его единственные писатели).
const PREPARED_RUNE_FLAG_SCOPE = "warhammer-dbc";
const PREPARED_RUNE_FLAG_KEY   = "preparedRune";

/**
 * Начало боя: пул выставляется в бPR (не прибавляется).
 * Молча ничего не делает всем, у кого нет Черты «Магия Сигиллитов».
 */
export async function processSigilliteRunesCombatStart(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant?.actor;
    if (!actor || !hasRuneMagic(actor)) continue;
    const patch = runeUpdate(actor, 0, { set: runeStartOfCombat(actor) });
    if (patch) await actor.update(patch);
  }
}

/**
 * Начало своего Хода: +бPR и +1 за ступень Археотеха, плюс разовый за бой
 * бонус Таланта «Вычислитель Рун».
 *
 * Возвращает начисленное число (0 — ничего не начислено): так тест видит
 * решение, не разбирая патч.
 */
export async function processSigilliteRunesTurnStart(actor) {
  if (!actor || !hasRuneMagic(actor)) return 0;
  let gain = runeGainPerTurn(actor);
  // «Первый ход псайкера в бою» — именно первый ХОД, а не старт боя: в
  // системе бой начинается кнопкой «Begin Combat», и до своего Хода псайкер
  // может не дожить. Поэтому метка ставится здесь, а не в combatStart.
  if (isCapabilityAvailable(actor, RUNE_CALCULATOR_FLAG, "battle")) {
    const bonus = runeCalculatorBonus(actor);
    if (bonus > 0) gain += bonus;
    await markCapabilityUsed(actor, RUNE_CALCULATOR_FLAG, "battle");
  }
  if (gain <= 0) return 0;
  const patch = runeUpdate(actor, gain);
  if (patch) await actor.update(patch);
  return gain;
}

/**
 * Диалог выбора Заготовленной Руны для ОДНОГО актора в начале Encounter-а —
 * тот же приём, что Witch's Edge (module/combat/witchs-edge.mjs): выбор
 * запрашивается заново каждый бой, а прошлый — стирается явно, а не
 * сравнением с id боя (эта часть намеренно не трогает rules/sigillite-runes.mjs,
 * см. заголовок файла). Список — только УЖЕ ИЗУЧЕННЫЕ Руны (wdbc-exjp,
 * isRuneLearned): книга готовит скидку на манифестацию конкретной Руны, а
 * неизвестную силу и так не сотворить этим Путём без Improvised Rune.
 */
export async function promptPreparedRuneChoice(actor) {
  const runes = (actor.items ?? []).filter(i => i?.type === "psychicPower" && isRuneLearned(i));
  if (!runes.length) {
    // Изученных Рун нет — готовить нечего. Снимаем прошлый выбор явно: иначе
    // стейл itemId с прошлого боя (сила забыта/удалена, либо Талант получен
    // только что) молча продолжил бы давать скидку чужой психосиле.
    await actor.unsetFlag?.(PREPARED_RUNE_FLAG_SCOPE, PREPARED_RUNE_FLAG_KEY);
    return null;
  }
  return new Promise(resolve => {
    // Тот же приём, что и у Witch's Edge: Foundry всегда зовёт Dialog.close
    // (submit() сам вызывает close()) — chosen отличает «нажали кнопку» от
    // «закрыли крестиком/Escape».
    let chosen = false;
    const options = runes.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");
    new Dialog({
      title: `Заготовленная Руна — ${actor.name}`,
      content: `<form class="flexcol">
        <div class="form-group">
          <label>Одна Руна на этот бой — скидка I.b на её первую манифестацию:</label>
          <select id="prepared-rune-choice" style="width:100%;">${options}</select>
        </div>
      </form>`,
      buttons: {
        choose: {
          label: "Выбрать",
          callback: async html => {
            chosen = true;
            const itemId = html.find("#prepared-rune-choice").val();
            await actor.setFlag(PREPARED_RUNE_FLAG_SCOPE, PREPARED_RUNE_FLAG_KEY, { itemId, used: false });
            resolve(itemId);
          }
        },
        skip: {
          label: "Не готовить",
          callback: async () => {
            chosen = true;
            await actor.unsetFlag(PREPARED_RUNE_FLAG_SCOPE, PREPARED_RUNE_FLAG_KEY);
            resolve(null);
          }
        }
      },
      default: "choose",
      // Закрытие без выбора — та же логика, что у Witch's Edge: не оставлять
      // флаг прошлого Encounter-а действующим, если игрок в этот раз ничего
      // не выбрал.
      close: async () => {
        if (chosen) return;
        await actor.unsetFlag(PREPARED_RUNE_FLAG_SCOPE, PREPARED_RUNE_FLAG_KEY);
        resolve(null);
      }
    }).render(true);
  });
}

/**
 * В начале Encounter-а — спросить выбор у всех носителей Таланта
 * «Prepared Rune / Заготовленная Руна». GM-гейт — забота вызывающего
 * (module/hooks.mjs), тем же приёмом, что у processSigilliteRunesCombatStart
 * выше и у соседей по тому же хуку combatStart.
 */
export async function processPreparedRuneCombatStart(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant?.actor;
    if (!actor || !hasRuleFlag(actor, PREPARED_RUNE_FLAG)) continue;
    await promptPreparedRuneChoice(actor);
  }
}
