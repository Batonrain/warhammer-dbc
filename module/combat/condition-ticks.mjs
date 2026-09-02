// module/combat/condition-ticks.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Тик Состояний по Ходам (wdbc-j3yf) — поля длительности (sheet-helpers.mjs::
//  CONDITIONS_DEF) уже существуют и пишутся с разных мест листа (weapon-
//  properties.mjs, drugs.mjs, healing.mjs), но ни один хук их не читал:
//  счётчики уменьшал и урон Кровотечения/Горения наносил игрок сам, руками.
//
//  Тайминг — из книги (core.json, «Раны и Урон», разделы «Кровотечение»/
//  «Огонь»): Кровотечение/Горение бьют «в конце своего Хода» (processTurnEnd,
//  зовётся из hooks.mjs для АКТОРА, чей Ход только что закончился), счётчики
//  длительности (Оглушение/Ослепление/Удушье) тикают «в начале своего Хода»
//  (processTurnStart, для актора, чей Ход начинается).
//
//  Паника от Горения (стр. «Раны и Урон», «Огонь») — тест W+0 в начале Хода
//  Горящего персонажа, тест Морали; провал пропускает весь Ход (обнуление ОД,
//  тот же приём, что «Подавленный в укрытии» в action-economy.mjs). Раньше
//  здесь было сознательное решение это НЕ реализовывать (игровое событие, не
//  число для тика) — отменено по прямому запросу пользователя, wdbc-zepq.
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { applyWoundLoss, woundDeathThreshold } from "../rules/wounds.mjs";
import { addFatigue } from "../sheets/tabs/conditions.mjs";
import { rollMoraleTest } from "../rules/morale-test.mjs";
import { postShockRecoveryPrompt } from "./fear.mjs";
import { applyLordOfExoditesFailPenalty } from "./lord-of-exodites.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";

// Состояния «N раундов», тикающие в начале Хода их обладателя — ключ
// system.conditions.<key> (bool) + system.conditions.<field> (число).
const ROUND_CONDITIONS = [
  { key: "stunned",     field: "stunnedRounds",     label: "Оглушение" },
  { key: "blinded",     field: "blindedRounds",     label: "Ослепление" },
  { key: "suffocating", field: "suffocatingRounds", label: "Удушье" }
];

async function postConditionCard(actor, lines) {
  if (!lines.length) return;
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warn", "#8fd0ff")}Состояния — ${esc(actor.name)}</div>
      ${lines.join("")}
    </div>`
  }, game.settings.get("core", "rollMode")));
}

/**
 * Тест Паники от Горения (W+0, тест Морали) — в начале Хода Горящего
 * персонажа. Провал: персонаж проводит Ход, паникуя и воя — обнуляем ОД
 * (тот же принцип, что «Подавленный в укрытии» — action-economy.mjs), Реакции
 * не трогаем (Уклонение/Парирование — не действия ЕГО хода).
 */
export async function rollBurningPanicTest(actor) {
  const wp = actor.system.characteristics.wp?.total ?? 0;
  const { eff, bonus, roll, rv, rerollNote, success, dof, usedReroll } = await rollMoraleTest(actor, wp);
  if (!success) await actor.update({ "system.actionPoints.value": 0 });
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll });

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("fire","#ff8a3a")}Паника от Горения — ${esc(actor.name)}</div>
        <div class="roll-threshold">WP: <b>${wp}</b>${bonus !== 0 ? ` ${bonus >= 0 ? "+" : ""}${bonus}` : ""} → Порог: <b>${eff}</b></div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        ${rerollNote}
        <div class="roll-outcome">${success
          ? `<span class="roll-success">Успех — держит себя в руках</span>`
          : `<span class="roll-failure">Провал — Ход потерян в панике (ОД обнулены)</span>`}</div>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, game.settings.get("core", "rollMode")));
  return { success, rv, eff };
}

/**
 * Начало Хода актора: Паника от Горения (если Горит), декремент счётчиков
 * длительности, снятие состояния на нуле. Зовётся из hooks.mjs::updateCombat
 * рядом с resetActionEconomy (после него — панике нужно обнулить уже
 * восстановленные ОД, а не значение до сброса).
 */
export async function processConditionTurnStart(actor) {
  const conds = actor?.system?.conditions;
  if (!conds) return;
  if (conds.burning) await rollBurningPanicTest(actor);
  // Выход из Шока (стр. 53) — по кнопке, не автоматически (тот же приём, что
  // напоминание Подавления в конце Хода — suppression.mjs).
  if (conds.shocked) await postShockRecoveryPrompt(actor);
  const updates = {};
  const lines = [];
  for (const { key, field, label } of ROUND_CONDITIONS) {
    if (!conds[key]) continue;
    const cur = Number(conds[field]) || 0;
    if (cur <= 0) continue;
    const next = cur - 1;
    updates[`system.conditions.${field}`] = next;
    if (next <= 0) {
      updates[`system.conditions.${key}`] = false;
      lines.push(`<div class="roll-threshold">${label}: <b>${cur}</b> → снято</div>`);
    } else {
      lines.push(`<div class="roll-threshold">${label}: <b>${cur}</b> → <b>${next}</b></div>`);
    }
  }
  if (!Object.keys(updates).length) return;
  await actor.update(updates);
  await postConditionCard(actor, lines);
}

/**
 * Конец Хода актора: Кровотечение (1d10 − Обескровливание: 1-5 → +1
 * Обескровливания, ≤0 → смерть независимо от Ран — стр. «Раны и Урон»,
 * «Кровотечение») и Горение (1d10 E(Fl), игнорирует AP брони, T.b всё же
 * поглощает — «получает урон, игнорирующего броню»; полностью поглощённый
 * T.b урон даёт тест T+0 вместо Усталости). Смерть — только строка в
 * карточке (как «Душа разорвана» у Выжигания Души, hooks.mjs) — в системе
 * нет отдельного флага «мёртв», решение фиксирует ГМ.
 * Тушение/остановка (существующие кнопки) не трогаются.
 */
export async function processConditionTurnEnd(actor) {
  const conds = actor?.system?.conditions;
  if (!conds) return;
  const lines = [];

  // Саркофаг Дредноута (стр. 57): иммунитет к Кровотечению — тело пилота
  // физически неспособно истечь кровью, поэтому сама проверка (и риск
  // случайной смерти на плохом броске) не имеет смысла, а не просто смягчена.
  const immuneBleeding = hasRuleFlag(actor, "sarcophagus.immuneBleedingFatigue");
  if (conds.bleeding && immuneBleeding) {
    lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: иммунитет саркофага — урон не применяется</div>`);
  } else if (conds.bleeding) {
    const roll = await new Roll("1d10").evaluate();
    const level = Number(conds.haemorrhagingLevel) || 0;
    const eff = roll.total - level;
    if (eff <= 0) {
      lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: 1d10 <b>${roll.total}</b> − Обескровливание ${level} = <b>${eff}</b> → <span class="roll-failure"><b>СМЕРТЬ</b> (независимо от количества Ран)</span></div>`);
    } else if (eff <= 5) {
      const newLevel = level + 1;
      await actor.update({ "system.conditions.haemorrhagingLevel": newLevel, "system.conditions.haemorrhaging": true });
      lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: 1d10 <b>${roll.total}</b> − ${level} = <b>${eff}</b> → +1 Обескровливание (<b>${newLevel}</b>)</div>`);
    } else {
      lines.push(`<div class="roll-threshold">${rollIcon("blood", "#ff6b6b")}Кровотечение: 1d10 <b>${roll.total}</b> − ${level} = <b>${eff}</b> → обошлось</div>`);
    }
  }

  // Саркофаг Дредноута (стр. 57): электрошок в конце Хода снимает Оглушение
  // целиком (не декремент stunnedRounds, как в processConditionTurnStart) —
  // кроме Галлюцинаций: если Оглушение вызвано ими (conds.hallucinogenic),
  // электрошок по мозгу их не лечит.
  if (conds.stunned && !conds.hallucinogenic && hasRuleFlag(actor, "sarcophagus.autoWakeFromStun")) {
    await actor.update({ "system.conditions.stunned": false, "system.conditions.stunnedRounds": 0 });
    lines.push(`<div class="roll-threshold">${rollIcon("bolt", "#8fd0ff")}Электрошок саркофага снял Оглушение</div>`);
  }

  if (conds.burning) {
    const roll = await new Roll("1d10").evaluate();
    const tb = Number(actor.system?.characteristics?.t?.bonus) || 0;
    const net = Math.max(0, roll.total - tb);
    if (net > 0) {
      const { currentWounds, newWounds, newCritical, maxWounds, gotCritical } = await applyWoundLoss(actor, net);
      await addFatigue(actor, 1);
      const destroyed = gotCritical && newCritical >= woundDeathThreshold(maxWounds);
      lines.push(`<div class="roll-threshold">${rollIcon("fire", "#ff8a3a")}Горение: 1d10 <b>${roll.total}</b> − T.b ${tb} = <b>${net}</b> урона E(Fl), игнор брони. Раны: ${currentWounds} → ${newWounds}${gotCritical ? ` (крит. <b>${newCritical}</b>)` : ""} · 😓 Усталость +1${destroyed ? ` — <b>уничтожен</b>` : ""}</div>`);
    } else {
      const tTotal = Number(actor.system?.characteristics?.t?.total) || 0;
      const test = await new Roll("1d100").evaluate();
      const failed = test.total > tTotal;
      if (failed) await addFatigue(actor, 1);
      lines.push(`<div class="roll-threshold">${rollIcon("fire", "#ff8a3a")}Горение: 1d10 <b>${roll.total}</b> целиком в T.b — тест T+0 (<b>${tTotal}</b>): <b>${test.total}</b> ${failed ? `<span class="roll-failure">провал → 😓 Усталость +1</span>` : `<span class="roll-success">успех</span>`}</div>`);
    }
  }

  if (lines.length) await postConditionCard(actor, lines);
}
