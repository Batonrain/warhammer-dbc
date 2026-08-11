// module/sheets/tabs/drugs.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Препараты: тест зависимости. Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../../constants/characteristics.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { _degWord, resolveCharFormula } from "../../helpers/utils.mjs";
import { fatiguePenalty } from "./conditions.mjs";
import { computeWoundHealing, computeWoundDamage } from "./wounds.mjs";

/**
 * Применяет «доп.» (мульти-) эффекты блока к цели: снятие Обескровливания,
 * лечение по формуле, доп. Усталость, непоглощаемый урон в Раны.
 */
export async function applyEffectExtras(target, fx) {
  const updates = {};
  const lines = [];
  const rolls = [];
  if (!fx) return { updates, lines, rolls };
  const chars = target.system.characteristics;

  if (fx.removesHaemorrhagingLevels > 0) {
    const cur = target.system.conditions?.haemorrhagingLevel || 0;
    const nv = Math.max(0, cur - fx.removesHaemorrhagingLevels);
    updates["system.conditions.haemorrhagingLevel"] = nv;
    updates["system.conditions.haemorrhaging"] = nv > 0;
    lines.push(`${rollIcon("blood","#ff6b6b")}Снято ур. Обескровливания: <b>${fx.removesHaemorrhagingLevels}</b>`);
  }

  if (fx.healFormula) {
    try {
      const r = await new Roll(resolveCharFormula(fx.healFormula, chars)).evaluate();
      rolls.push(r);
      Object.assign(updates, computeWoundHealing(target.system, r.total));
      lines.push(`${rollIcon("heart","#ff8a8a")}Лечение: <b>${fx.healFormula}</b> = <b>${r.total}</b>`);
    } catch(e) {
      console.error("healFormula:", e);
    }
  }

  if (fx.grantsFatigue > 0) {
    const fatVal = target.system.fatigue?.value ?? 0;
    updates["system.fatigue.value"] = fatVal + fx.grantsFatigue;
    lines.push(`${rollIcon("warn","#ffb84d")}Усталость +<b>${fx.grantsFatigue}</b>`);
  }

  if (fx.woundDamage) {
    try {
      const r = await new Roll(resolveCharFormula(fx.woundDamage, chars)).evaluate();
      rolls.push(r);
      Object.assign(updates, computeWoundDamage(target.system, r.total));
      lines.push(`${rollIcon("burst","#ff6b6b")}Непоглощаемый урон в Раны: <b>${fx.woundDamage}</b> = <b style="color:#8b0000;">${r.total}</b>`);
    } catch(e) {
      console.error("woundDamage:", e);
    }
  }

  return { updates, lines, rolls };
}

export async function rollAddictionTest(actor, item, charKey = "t", testMod = 0) {
  const charTotal = actor.system.characteristics[charKey]?.total ?? 0;
  const fatigue = fatiguePenalty(actor, charKey);
  const eff = charTotal + testMod + fatigue;
  const wasAddicted = item?.system?.addiction?.isAddicted || false;

  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= eff;
  const deg = Math.floor(Math.abs(rv - eff) / 10) + 1;
  const abbr = CHARACTERISTICS[charKey]?.abbr ?? charKey.toUpperCase();
  const name = item?.name ?? "Наркотик";

  let outcome;
  if (success) {
    if (wasAddicted && item) {
      // Срыв зависимости — избавление.
      await item.update({ "system.addiction.isAddicted": false });
      const still = actor.items.some(i =>
        i.type === "drug" && i.id !== item.id &&
        i.system.addiction?.hasAddiction && i.system.addiction?.isAddicted
      );
      if (!still) await actor.update({ "system.conditions.addicted": false });
      outcome = `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Зависимость преодолена!</span>`;
    } else {
      outcome = `<span class="roll-success">Сопротивление успешно — ${deg} ${_degWord(deg)}</span>`;
    }
  } else {
    // Провал → персонаж зависим от ЭТОГО препарата.
    if (item) await item.update({ "system.addiction.isAddicted": true });
    await actor.update({ "system.conditions.addicted": true });
    outcome = wasAddicted
      ? `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Зависимость сохраняется.</span>`
      : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Персонаж стал зависим!</span>`;
  }

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("warn","#ffb84d")}Тест Зависимости — ${name}</div>
        <div class="roll-threshold">
          ${abbr}: <b>${charTotal}</b>${testMod !== 0 ? ` ${testMod >= 0 ? "+" : ""}${testMod}` : ""}${fatigue !== 0 ? ` 😓 ${fatigue}` : ""}
          → Порог: <b>${eff}</b>
        </div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${outcome}</div>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode));
}
