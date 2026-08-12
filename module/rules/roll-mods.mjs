// module/rules/roll-mods.mjs
//
// Галочки от реестра правил — третий источник модификаторов рядом с
// Особенностями Происхождения и предметными rollMods. Правила приходят через
// конвейер теста (module/rules/resolve-test.mjs, фазы 1–3): здесь только показ.
//
// Формат записи тот же, {value, label, halvePenalty}, поэтому дальше диалог
// складывает все три вида галочек одинаково. Разметку читают и диалог броска
// навыка (на листе), и диалог атаки — поэтому она живёт отдельно от обоих.

import { resolveTest } from "./resolve-test.mjs";

export function ruleRollModsHtml(actor, context) {
  const { mods } = resolveTest({ actor, ...context });
  if (!mods.length) return { html: "", mods };
  const rows = mods.map((m, i) => {
    const sign = m.value > 0 ? `+${m.value}` : (m.value < 0 ? `${m.value}` : "");
    return `<label class="attack-mod-check rule-roll-mod">
      <input type="checkbox" class="rule-mod" data-idx="${i}" data-value="${m.value || 0}"
             ${m.halvePenalty ? 'data-halve="1"' : ""}/>
      <span>${m.label}${sign ? ` <b>(${sign})</b>` : ""}</span></label>`;
  }).join("");
  return {
    mods,
    html: `<div class="atk-dlg-modifiers rule-mods">
      <div class="atk-mods-title">Правила</div>
      <div class="atk-mods-list">${rows}</div></div>`
  };
}
