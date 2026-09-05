// module/helpers/test-card.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Общий сборщик карточки теста в чат (wdbc-kuun).
//
//  До него карточки собирались вручную в 92 файлах: 237 вызовов
//  ChatMessage.create и 232 самодельных блока <div class="wh-roll-result">. В
//  каждом заново повторялись шапка с иконкой, строка Порога, строка броска,
//  строка исхода, примечание о перебросе и обёртка applyRollMode. Следствия
//  были ровно три:
//
//   • вид карточек разъезжался между подсистемами — разный порядок строк и
//     разные подписи одного и того же;
//   • любое улучшение (кнопка, подсветка крита, показ источника модификатора)
//     нужно было вносить 232 раза, поэтому не вносилось;
//   • HTML внутри JS не покрыт ни линтером разметки, ни тестами.
//
//  Почему функция, а не .hbs-шаблон (задача предлагала шаблон). Претензия
//  «HTML не покрыт проверками» решается и так: разметка съехала в ОДНО место,
//  и это место проверяется тестом без запуска Foundry. Шаблон Handlebars
//  потребовал бы асинхронного renderTemplate на каждом из 92 мест и научить
//  заглушку Foundry компилировать шаблоны — иначе разом краснеют все тесты,
//  читающие текст карточки. Разметка при этом всё равно осталась бы одна.
//  Переезд в .hbs остаётся возможным следующим шагом: он затронет один файл.
//
//  Строитель (testCardHtml) — чистая функция: ни ChatMessage, ни game, ни
//  бросков. Публикация (postTestCard) отделена от него ровно поэтому.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "./utils.mjs";

/** Знак перед числом: «+10», «−10», пустая строка у нуля. */
const sgn = v => (v > 0 ? `+${v}` : (v < 0 ? `${v}` : ""));

/**
 * Строка Порога: «Ag: 35 (😓 Усталость −10, стойка +10) → Порог: 35».
 *
 * `parts` — уже готовые подписи слагаемых (их отдаёт collectTestMods в
 * rules/roll-mods.mjs). Пустой список означает «Порог равен базе», и скобок
 * тогда нет вовсе: пустые скобки в карточке выглядят как потерянные данные.
 */
export function thresholdLine({ prefix = "", label = "Порог", base = null, parts = [], threshold }) {
  const shown = (parts ?? []).filter(Boolean);
  const lead = prefix ? `${esc(prefix)} | ` : "";
  const head = base == null ? "" : `${lead}${esc(label)}: <b>${base}</b>`;
  const mods = shown.length ? ` (${shown.map(esc).join(", ")})` : "";
  const arrow = base == null ? "" : " → ";
  return `<div class="roll-threshold">${head}${mods}${arrow}Порог: <b>${threshold}</b></div>`;
}

/**
 * Разметка карточки теста. Порядок строк — тот, что сложился в боевых
 * карточках и стал общим: шапка, Порог, свои строки, бросок, переброс, крит,
 * исход, свои блоки.
 *
 * @param {object}   o
 * @param {string}   o.icon         готовая разметка иконки (constants/roll-icons.mjs)
 * @param {string}   o.title        заголовок; имя актора дописывается сюда же вызывающим
 * @param {string}   [o.actorUuid]  для кнопок карточки, читающих владельца
 * @param {string}   [o.threshold]  готовая строка Порога (см. thresholdLine)
 * @param {string[]} [o.lines]      свои строки между Порогом и броском
 * @param {number}   [o.rv]         выпавшее число; null — карточка без броска
 * @param {string}   [o.dice]       отрендеренные кубики Foundry
 * @param {string}   [o.rerollNote] примечание о перебросе
 * @param {string}   [o.critLine]   строка Критического Успеха/Провала
 * @param {string}   o.outcome      разметка исхода
 * @param {string[]} [o.sections]   свои блоки после исхода (кнопки, таблицы)
 */
export function testCardHtml({
  icon = "", title = "", actorUuid = "", threshold = "", lines = [],
  rv = null, dice = "", rerollNote = "", critLine = "", outcome = "", sections = []
} = {}) {
  const parts = [
    `<div class="roll-header">${icon}${title}</div>`,
    threshold,
    ...(lines ?? []).filter(Boolean),
    rv == null ? "" : `<div class="roll-dice">Бросок: <b>${rv}</b></div>`,
    dice, rerollNote, critLine,
    outcome ? `<div class="roll-outcome">${outcome}</div>` : "",
    ...(sections ?? []).filter(Boolean)
  ].filter(Boolean);
  const uuid = actorUuid ? ` data-actor-uuid="${actorUuid}"` : "";
  return `<div class="wh-roll-result"${uuid}>${parts.join("")}</div>`;
}

/** Успех/провал одной строкой — тот же вид во всех подсистемах. */
export function outcomeHtml(success, text) {
  return `<span class="roll-${success ? "success" : "failure"}">${text}</span>`;
}

/**
 * Отправить карточку теста в чат. Режим броска (`core.rollMode`) читается
 * здесь, а не на каждом месте вызова: раньше эта строчка повторялась 237 раз
 * и в паре мест отличалась.
 *
 * `speaker` и `whisper` нужны карточкам, которые говорит не персонаж
 * (системные уведомления от «Системы») или которые видны не всем.
 *
 * @returns {Promise<ChatMessage>}
 */
export async function postTestCard(actor, card, {
  rolls = [], sound = true, flags = null, speaker = null, whisper = null
} = {}) {
  const content = typeof card === "string" ? card : testCardHtml(card);
  const data = {
    // speaker переопределяется для карточек, которые говорит не персонаж:
    // системные уведомления идут от «Системы» (alias), и getSpeaker с
    // отсутствующим актором подставил бы туда текущего пользователя.
    speaker: speaker ?? ChatMessage.getSpeaker({ actor }),
    // whisper — для карточек, которые видит только владелец и ГМ (запрос
    // делегированного теста, приватные напоминания).
    ...(whisper ? { whisper } : {}),
    content,
    ...(rolls.length ? { rolls } : {}),
    ...(sound ? { sound: CONFIG.sounds.dice } : {}),
    // Флаги карточки (кнопки читают из них свой контекст — переброс Страха,
    // «Вера в прошлое»). Кладутся ДО applyRollMode: тот меняет только
    // видимость сообщения и флаги не трогает.
    ...(flags ? { flags } : {})
  };
  return ChatMessage.create(ChatMessage.applyRollMode(data, game.settings.get("core", "rollMode")));
}

export { sgn as modSign };
