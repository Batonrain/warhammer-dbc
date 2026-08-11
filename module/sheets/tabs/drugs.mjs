// module/sheets/tabs/drugs.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Препараты: тест зависимости. Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../../constants/characteristics.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { _degWord } from "../../helpers/utils.mjs";
import { fatiguePenalty } from "./conditions.mjs";

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
