// module/combat/trait-test.mjs
// ════════════════════════════════════════════════════════════════════════
//  Тест Характеристики, который Черта требует по своему тексту: «при встрече
//  с опасностью должен пройти тест W+0, или убегает» (Зверь / Bestial,
//  корбук, «Трейты»). Раньше кнопка такой Черты была памяткой: писала текст
//  в чат, а Порог, бросок и исход ГМ считал сам.
//
//  Один бросок без диалога — модификаторы реестра правил берутся все, тем же
//  приёмом, что у тестов тика Состояния (combat/condition-ticks.mjs::
//  rollConditionCharTest) и Пацифизма (combat/pacifism.mjs). Последствие
//  провала (бегство) — решение стола: путь к бегству и куда бежать знает
//  только ГМ, поэтому карточка называет исход, а не двигает токен.
//
//  Скрипты Конструктора (kind:"script") получают функцию по имени
//  `rollTraitTest` (apps/item-script.mjs).
// ════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";

/** «W+0», «Ag−10» — подпись теста для шапки карточки. */
export function traitTestLabel(char, mod = 0) {
  const abbr = CHARACTERISTICS[char]?.abbr ?? char;
  const m = Number(mod) || 0;
  return `${abbr}${m < 0 ? "−" : "+"}${Math.abs(m)}`;
}

/**
 * Тест Характеристики от Черты: Порог = Характеристика + mod + правила.
 * @param {Actor} actor
 * @param {object} o
 * @param {string} [o.char="wp"]   ключ Характеристики
 * @param {number} [o.mod=0]       поправка теста из текста Черты
 * @param {string} [o.icon]
 * @param {string} [o.title]       что за тест («Зверь: встреча с опасностью»)
 * @param {string} [o.success]     исход при Успехе — текст для карточки
 * @param {string} [o.failure]     исход при Провале — текст для карточки
 * @returns {Promise<{success:boolean, deg:number, threshold:number, rv:number}>}
 */
export async function rollTraitTest(actor, { char = "wp", mod = 0, icon = "🎲", title = "", success = "", failure = "" } = {}) {
  const base = Number(actor?.system?.characteristics?.[char]?.total) || 0;
  const rm = collectTestMods(actor, { kind: "skill", char });
  const m = Number(mod) || 0;
  const threshold = base + m + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const { success: ok, deg } = testOutcome(rv, threshold);
  const label = traitTestLabel(char, m);
  const outcomeText = ok
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}${success ? `. ${esc(success)}` : ""}</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}${failure ? `. ${esc(failure)}` : ""}</span>`;
  await postTestCard(actor, {
    icon, title: `${esc(title || "Тест")} — ${esc(actor?.name ?? "")}`,
    threshold: rollStatLine({ label, base, parts: [m ? `${m > 0 ? "+" : ""}${m}` : null, ...rm.parts], threshold, rv }),
    outcome: outcomeText
  }, { rolls: [roll] });
  return { success: ok, deg, threshold, rv };
}
