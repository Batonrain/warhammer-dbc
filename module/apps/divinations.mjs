// module/apps/divinations.mjs
// ════════════════════════════════════════════════════════════════════════
//  Предсказания: выбор в шапке и применение.
//
//  Дропдаун читает компендиум, а не константы — значит, ГМ может завести
//  своё предсказание прямо в библиотеке, и оно появится в списке.
// ════════════════════════════════════════════════════════════════════════

import { DIVINATIONS, DIVINATION_BY_KEY, DIVINATION_SOURCE,
         rollLabel, divinationByRoll, hasChoices } from "../constants/divinations.mjs";
import { isFeatureEnabled } from "../constants/features.mjs";
import { promptGrantChoices, applyGrants, clearGrantedBy,
         registerPackCache, packEntries, charBonusesToMechanics } from "./origin-shared.mjs";
import { esc } from "../helpers/utils.mjs";
import { SKIP_MECHANICS_HOOK } from "./races.mjs";
import { applyItemMechanics } from "./mechanics.mjs";
import { changeInfamy } from "./infamy-points.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const PACK = "warhammer-dbc.divinations";
const FLAG = "warhammer-dbc";
export const DIVINATION_TAG = "divination";

/** Кэш компендиума: список для дропдауна с учётом рукописных записей ГМа. */
registerPackCache(PACK, DIVINATION_TAG);

// ── Состояние актора ─────────────────────────────────────────────────────

export function actorDivinationItem(actor) {
  return actor?.items?.find(i => i.type === "divination") || null;
}

/** Данные дропдауна «Предсказание» для шапки листа. */
export function divinationSheetContext(actor) {
  if (!isFeatureEnabled("divinations")) return null;
  const item = actorDivinationItem(actor);
  const cur  = item?.system?.key || "";
  return {
    enabled: true,
    current: cur,
    label: item?.name || "",
    effect: item?.system?.effect || "",
    charLabel: item?.system?.charModLabel || "",
    // Список из компендиума; если он ещё не прочитан — из константной таблицы.
    // effect — для предпросмотра (title у option) до выбора, не только после.
    options: packEntries(DIVINATION_TAG, () => DIVINATIONS.map(d => ({
      key: d.key, name: d.text, roll: rollLabel(d), effect: d.effect || ""
    }))).map(o => ({ ...o, selected: o.key === cur }))
  };
}

// ── Применение ───────────────────────────────────────────────────────────

/** Снимает предсказание и всё, что оно выдало. */
export async function clearDivination(actor) {
  await clearGrantedBy(actor, DIVINATION_TAG, actorDivinationItem(actor));
}

/**
 * Выбор предсказания.
 * @param {string} key ключ, "random" для броска к100 или "" чтобы снять
 */
export async function applyDivination(actor, key) {
  if (!isFeatureEnabled("divinations")) return;

  let rolled = null;
  if (key === "random") {
    const r = await rollRandomDivinationKey();
    if (!r) return;
    key = r.key; rolled = r.rolled;
  }

  if (!key) { await clearDivination(actor); return; }

  // Запись компендиума — источник истины: ГМ мог добавить своё предсказание.
  const entry = packEntries(DIVINATION_TAG, () => []).find(e => e.key === key);
  const def   = DIVINATION_BY_KEY[key];
  if (!def && !entry) return;

  let picks = null;
  if (def && hasChoices(def)) {
    picks = await promptGrantChoices({
      title: `Предсказание: ${def.text}`,
      head: def.text, desc: def.effect,
      charChoices: def.charChoices, choices: def.choices, actor
    });
    if (picks === null) return;                       // окно закрыли — ничего не меняем
  }

  await clearDivination(actor);
  await grantDivination(actor, key, def, entry, picks || {}, rolled);
}

/** Бросок «Бросить к100» — вынесено отдельно: Мастер создания сперва
 *  бросает и узнаёт ключ, а уже потом решает, показывать ли строки выбора
 *  инлайн (см. character-wizard.mjs). */
export async function rollRandomDivinationKey() {
  // Не тест против порога, а бросок ПО ТАБЛИЦЕ (wdbc-ct65.3): у него нет ни
  // характеристики, ни Порога, ни степеней успеха — модифицировать нечего, и
  // реестр правил ему не нужен. Проверено при разборе, не оставлено вопросом.
  const rolled = await new Roll("1d100").evaluate();
  const d = divinationByRoll(rolled.total);
  if (!d) return null;
  ui.notifications?.info(`Предсказание (к100 = ${rolled.total}): ${d.text}.`);
  return { key: d.key, rolled };
}

/**
 * То же самое, но с уже готовыми picks — не спрашивает Dialog'ом. Для
 * Мастера создания: строки выбора читаются прямо из формы шага (см.
 * origin-shared.mjs readGrantChoicePicks), а не из всплывающего окна.
 * @param {Actor} actor
 * @param {string} key      ключ предсказания (не "random" — тот резолвится раньше)
 * @param {object} picks    форма из readGrantChoicePicks (или {})
 * @param {Roll}   [rolled] бросок к100 — для карточки в чат, если ключ пришёл со «Случайно»
 */
export async function applyDivinationPicks(actor, key, picks, rolled = null) {
  if (!isFeatureEnabled("divinations")) return;
  if (!key) { await clearDivination(actor); return; }
  const entry = packEntries(DIVINATION_TAG, () => []).find(e => e.key === key);
  const def   = DIVINATION_BY_KEY[key];
  if (!def && !entry) return;
  await clearDivination(actor);
  await grantDivination(actor, key, def, entry, picks || {}, rolled);
}

async function grantDivination(actor, key, def, entry, picks, rolled) {
  // Своё предсказание из компендиума без описания в коде — кладём как есть.
  // Механику ждём синхронно (SKIP_MECHANICS_HOOK) — это ГМ-запись целиком,
  // её Механика может быть любой, не только пассивными бонусами.
  if (!def) {
    const doc = entry?.uuid ? await fromUuid(entry.uuid) : null;
    if (!doc) return;
    const data = doc.toObject(); delete data._id;
    const [created] = await actor.createEmbeddedDocuments("Item", [data], { [SKIP_MECHANICS_HOOK]: true });
    if (created) await applyItemMechanics(created);
    if (isFeatureEnabled("divinations")) await actor.update({ "system.bio.divination": "" });
    return;
  }

  const charBonuses = Object.entries(def.chars || {}).map(([stat, value]) => ({ stat, value }));
  const chosen = {};

  // «X или Y» — выбранные варианты добавляются к модификаторам.
  (def.charChoices || []).forEach((cc, i) => {
    const o = cc.options[picks.charChoices?.[i] ?? 0];
    if (!o) return;
    chosen[cc.label] = o.label;
    for (const [stat, value] of Object.entries(o.chars || {})) charBonuses.push({ stat, value });
  });

  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name: def.text, type: "divination", img: "icons/svg/eye.svg",
    system: {
      key: def.key, roll: rollLabel(def), rollMin: def.min, rollMax: def.max,
      text: def.text, effect: def.effect, source: DIVINATION_SOURCE, bookSource: DIVINATION_SOURCE,
      charModLabel: charBonuses.map(c => `${c.value >= 0 ? "+" : "−"}${Math.abs(c.value)} ${c.stat.toUpperCase()}`).join(", "),
      choices: chosen
    },
    flags: { [FLAG]: { mechanics: charBonusesToMechanics(charBonuses) } }
  }], { [SKIP_MECHANICS_HOOK]: true });
  if (item) await applyItemMechanics(item);

  const summary = await applyGrants(actor, {
    def, picks, chosen, tag: DIVINATION_TAG, owner: item,
    sourceLabel: `${DIVINATION_SOURCE} — ${def.text}`
  });

  // Дополнительное Очко Бесчестья (100) и Фобия (68-71).
  const extra = [];
  if (def.grants?.infamyPoint) {
    // Тот же пул/потолок, что у actor-sheet.mjs::_infamyPath/_infamyMax
    // (system.fate.value, потолок Inf.b) — начисляем сразу, не просим ГМа
    // вспомнить об этом постфактум (wdbc-5il7).
    const ipMax = Math.max(0, Number(actor.system.characteristics?.inf?.bonus) || 0);
    await changeInfamy(actor, "system.fate.value", ipMax, def.grants.infamyPoint);
    extra.push(`<b>Очки Бесчестья:</b> +${def.grants.infamyPoint} (начислено)`);
  }
  if (def.phobia) extra.push(`<b>Фобия (−${def.phobia}):</b> согласуйте с ГМом конкретный страх`);
  if (def.giftRoll) extra.push("<b>Дары:</b> сделайте один бросок по таблице Даров");
  if (def.mutationInfBonus) extra.push(`<b>Мутации:</b> при бросках считайте Inf.b на ${def.mutationInfBonus} выше`);
  if (def.bookNote) extra.push(`<i>${def.bookNote}</i>`);

  // Предсказание теперь живёт предметом — старый текстовый атрибут чистим.
  await actor.update({ "system.bio.divination": "" });

  await postSummary(actor, def, { charBonuses, chosen, summary, extra, rolled });
}

async function postSummary(actor, def, { charBonuses, chosen, summary, extra, rolled }) {
  const lines = [];
  const chars = charBonuses.map(c => `${c.value >= 0 ? "+" : "−"}${Math.abs(c.value)} ${c.stat.toUpperCase()}`).join(", ");
  if (chars) lines.push(`<b>Характеристики:</b> ${esc(chars)}`);
  for (const [k, v] of Object.entries(chosen)) lines.push(`<b>${esc(k)}:</b> ${esc(v)}`);
  lines.push(...(summary || []));
  lines.push(...extra);

  // Не тест, а итог выбора/броска по ТАБЛИЦЕ Предсказаний: Порога нет.
  // Публикация общая (postTestCard), а разметка осталась своей — у корня
  // карточки нужен класс `hw-chat`, а стили (styles/sheets/homeworlds.css)
  // написаны селектором `.wh-roll-result.hw-chat .hw-chat-*`, то есть класс
  // обязан стоять на том же узле; testCardHtml своего класса пока не
  // принимает (см. отчёт по wdbc-kuun).
  await postTestCard(actor, `<div class="wh-roll-result hw-chat">
      <div class="roll-header">Предсказание — ${esc(actor.name)}</div>
      ${rolled ? `<div class="roll-dice">к100: <b>${rolled.total}</b></div>` : ""}
      <div class="hw-chat-world">${esc(rollLabel(def))} — ${esc(def.text)}</div>
      <div class="hw-chat-feature">${esc(def.effect)}</div>
      ${lines.length ? `<div class="hw-chat-grants">${lines.join("<br/>")}</div>` : ""}
    </div>`, { rolls: rolled ? [rolled] : [], sound: !!rolled });
}
