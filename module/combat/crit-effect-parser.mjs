// module/combat/crit-effect-parser.mjs
// ════════════════════════════════════════════════════════════════════════════
//  wdbc-xql6: крит-таблицы (../../critical-tables.mjs) и таблица Шока после
//  провала Страха (constants/fear-tables.mjs::SHOCK_TABLE) — это ~200 строк
//  свободного русского текста. Раньше в чат уходил только текст, игрок сам
//  раскидывал по счётчикам: сам кидал 1d10 Раундов Оглушения, сам ставил
//  Кровотечение. Здесь — узкий regex-скан по типовым оборотам книги
//  («Оглушена на NdX Раундов», «N Усталости», «Кровотечение» и т.п.),
//  превращающий их в кликабельные пилюли CONDITIONS_DEF: клик сам кидает
//  кубик длительности (если он есть) и накладывает состояние на актора
//  карточки. Нераспознанные обороты («тест T+0, или умереть от шока»,
//  «−10 на все тесты X», урон в характеристику и т.п.) остаются только
//  текстом самой карточки — этот модуль их не трогает и не прячет.
//
//  ВАЖНО (см. doombc-russian-text-regex-pitfalls): \w/\b в JS не видят
//  кириллицу вовсе — везде explicit [а-яёА-ЯЁ], никаких \b. Регэкспы ниже
//  построены не «в слепую», а по факту прочтения всех 304 строк
//  critical-tables.mjs — это не широкий скан-кандидатов по книге (там
//  добавляется риск морфологических омонимов), а сверенный список реальных
//  формулировок этой конкретной таблицы.
// ════════════════════════════════════════════════════════════════════════════

// Из constants/conditions.mjs (wdbc-w88h), не из sheets/sheet-helpers.mjs —
// combat/ не должен тянуть слой листа.
import { CONDITIONS_DEF } from "../constants/conditions.mjs";
import { addFatigue, conditionAdjustFields, conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

// «Стем + на NdX/N Раунд(ов)» — общий костяк для Оглушения/Ослепления.
function roundPhrase(stem) {
  return new RegExp(`${stem}[а-яёА-ЯЁ]*\\s+(?:цель\\s+|её\\s+|его\\s+)?на\\s+(\\d+d\\d+|\\d+)\\s+Раунд`, "giu");
}

/**
 * Распознать типовые фразы в тексте крит-эффекта/строки Шока и вернуть
 * список пилюль { key (CONDITIONS_DEF), formula (кубик/число/null),
 * permanent (bool) }. Дубли (тот же key+formula) схлопываются — некоторые
 * обороты («Удушья» дважды в одном предложении) иначе дали бы вторую кнопку.
 */
export function parseCritEffectPills(text) {
  if (!text) return [];
  const pills = [];
  const seen = new Set();
  const push = (key, formula, extra = {}) => {
    if (!CONDITIONS_DEF[key]) return;
    const dedupeKey = `${key}:${formula || ""}:${extra.permanent ? "p" : ""}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    pills.push({ key, formula: formula || null, ...extra });
  };

  // Оглушение: «Оглушена/Оглушая/Оглушение ... на NdX Раундов»
  for (const m of text.matchAll(roundPhrase("Оглуш"))) push("stunned", m[1]);

  // Ослепление: «Ослепляет/Ослеплена ... на NdX Раундов», отдельно — перманент
  for (const m of text.matchAll(roundPhrase("Ослеп"))) push("blinded", m[1]);
  if (/перманентно\s+ослеплен[а-яёА-ЯЁ]*/giu.test(text)) push("blinded", null, { permanent: true });

  // Усталость: «N[dX] [уровень/уровня/уровней] Усталости»
  for (const m of text.matchAll(/(\d+d\d+|\d+)\s+(?:уровень|уровня|уровней)?\s*Усталост[а-яёА-ЯЁ]*/giu))
    push("fatigued", m[1]);

  // Кровотечение — таблица никогда не даёт числа, только сам факт.
  if (/Кровотечение/gu.test(text)) push("bleeding", null);

  // Обескровливание — редкий, но точный случай («Кровотечение и 2 Обескровливания»).
  for (const m of text.matchAll(/(\d+)\s+Обескровливани[а-яёА-ЯЁ]*/giu))
    push("haemorrhaging", m[1]);

  // Удушье — булево, книга не даёт длительности для крит-варианта.
  if (/Удушь[а-яёА-ЯЁ]*/gu.test(text)) push("suffocating", null);

  // Загорание — почти всегда за проваленным тестом («тест A+0, или Загореться»),
  // поэтому пилюля всё равно предлагается — ГМ жмёт, только если тест провален.
  if (/Загор[а-яёА-ЯЁ]*/gu.test(text)) push("burning", null);

  // Перманентная потеря слуха.
  if (/лишен[а-я]*\s+слуха/giu.test(text)) push("deafened", null, { permanent: true });

  // Сбита/сбивает с ног — булево состояние Повален.
  if (/[Сс]бит[а-яёА-ЯЁ]*\s+с\s+ног|[Сс]бива[а-яёА-ЯЁ]*\s+с\s+ног/gu.test(text)) push("prone", null);

  // «потерять/теряет сознание» — тоже часто за тестом (Взрывной/таблица Шока).
  if (/потерять\s+сознание|теряет\s+сознание/giu.test(text)) push("unconscious", null);

  return pills;
}

/** Пилюля со значением уровня/раундов? Иначе — просто булев флаг. */
function formulaIsDice(formula) {
  return !!formula && /d/i.test(formula);
}

/**
 * HTML-блок кнопок под текстом крит-эффекта. actorUuid — цель, известная
 * УЖЕ на этапе применения урона (applyDamageToActor), поэтому в отличие от
 * пилюль Ритуала (module/apps/ritual-cast.mjs — перетаскиваемые, без
 * фиксированной цели) здесь достаточно кликабельной кнопки.
 */
export function critPillsHtml(pills, actorUuid) {
  if (!pills?.length || !actorUuid) return "";
  const btns = pills.map(p => {
    const def = CONDITIONS_DEF[p.key];
    if (!def) return "";
    const durTxt = p.permanent ? " (перм.)" : (p.formula ? ` ${esc(p.formula)}` : "");
    return `<button type="button" class="wh-crit-apply-btn" data-actor-uuid="${esc(actorUuid)}"
      data-cond-key="${p.key}" data-formula="${esc(p.formula || "")}" data-permanent="${p.permanent ? "1" : "0"}"
      title="Наложить на цель карточки">
      ${def.svg || def.icon} ${esc(def.label)}${durTxt}</button>`;
  }).filter(Boolean).join("");
  return btns ? `<div class="wh-crit-pills">${btns}</div>` : "";
}

/**
 * Применить одну пилюлю к актору: кидает кубик длительности (если формула —
 * кубик), накладывает состояние (аддитивно к уже идущему счётчику — вторая
 * подряд Оглушающая рана добавляет Раунды, а не перекрывает их) и постит
 * карточку в чат. Состояния без levelField (Без сознания) — только флаг,
 * кинутая длительность идёт в карточку текстом: тикающей инфраструктуры для
 * них нет (см. condition-ticks.mjs — только Оглушение/Ослепление/Удушье),
 * снимать их ГМ будет вручную, как и раньше.
 */
export async function applyCritEffectPill(actor, { key, formula, permanent } = {}) {
  const def = CONDITIONS_DEF[key];
  if (!actor || !def) return;

  let amount = null, diceHtml = "", diceRoll = null;
  if (formulaIsDice(formula)) {
    diceRoll = await new Roll(formula).evaluate();
    amount = diceRoll.total;
    diceHtml = await diceRoll.render();
  } else if (formula) {
    amount = Number(formula) || null;
  }

  const tracked = key === "fatigued" || (def.hasLevel && def.levelField);
  if (key === "fatigued") {
    await addFatigue(actor, amount || 1);
  } else if (def.hasLevel && def.levelField && amount != null && !permanent) {
    await actor.update(conditionAdjustFields(actor, key, amount));
  } else {
    await actor.update(conditionApplyFields(key, null, actor));
  }

  const noteParts = [];
  if (permanent) noteParts.push("перманентно");
  else if (amount != null) noteParts.push(`+${amount}${tracked ? "" : " (снимите вручную — без автотика)"}`);

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("warn", "#8fd0ff")}Крит-эффект → ${esc(actor.name)}</div>
      <div class="roll-threshold">${def.svg || def.icon} <b>${esc(def.label)}</b>${noteParts.length ? ` — ${noteParts.join(", ")}` : ""}</div>
      ${diceHtml}
    </div>`,
    rolls: diceRoll ? [diceRoll] : [],
    sound: diceRoll ? CONFIG.sounds.dice : null
  }, game.settings.get("core", "rollMode")));
}
