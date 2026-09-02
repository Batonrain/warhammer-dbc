// module/rules/requirements.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Requirement — обобщённый гейт «можно ли вообще получить/держать предмет»,
//  спроектирован в сессии планирования 24.08.2026 (память
//  doombc-req-condition-effect-plan, Атлас Механики часть IV) как замена трём
//  несвязанным движкам требований (races.mjs bespoke, elite-requirements.mjs,
//  mechanics.mjs req*). Образец жёсткости/мягкости — elite-requirements.mjs
//  (primary/secondary), обобщён и добавлен третий уровень («Запрет»).
//
//  Как и predicates.mjs/elite-requirements.mjs — здесь нет ни Foundry, ни
//  компендиумов: на вход идёт актор (или подставной объект той же формы —
//  { items: [...], system: {...} }), проверяется без запуска мира.
//
//  ХРАНЕНИЕ: новый флаг `flags.warhammer-dbc.reqBlocks` на предмете —
//  аддитивно, ничего из существующих flags.mechanics/req не трогает.
//  Блок = { id, tier: "secondary"|"primary", forbid: bool, group }.
//  `forbid` осмыслен ТОЛЬКО при tier:"primary" (проверено пользователем).
//
//  Виды записи (entry.kind) внутри group.entries:
//    "item"     — генерик drag&drop: у актора есть embedded-предмет данного
//                 типа+имени (опционально — с рейтингом ≥ entry.rating).
//                 Закрывает разом Талант/Черту/Расу/Субрасу/Архетип/Элитный
//                 архетип/Культуру/Геносемя — все это реальные embedded-
//                 предметы на акторе (проверено чтением _onDropItem расы).
//    "numeric"  — числовое поле актора: Характеристика (entry.charKey) или
//                 Порча/Безумие (entry.numericTarget), op "atLeast"|"atMost".
//    "faction"  — принадлежность (НЕ предмет, вычисляемая — predicates.mjs
//                 hasFaction/inFactions, considers нижестоящих).
//  Общее поле у всех видов — entry.mode: "need"|"forbid" («Нужно»/«Нельзя»),
//  переключатель вместо отдельного флага-негейта.
//
//  ЧЕГО ЭТОТ МОДУЛЬ НЕ ДЕЛАЕТ (следующие шаги, не эта задача):
//    - нет UI на вкладке МЕХАНИКА;
//    - не подключено к _onDropItem (жёсткая блокировка руками ГМа);
//    - не подключено к Обозревателю компендиумов (скрытие Primary из списка);
//    - крест-блочный И/ИЛИ между несколькими Primary-блоками одного предмета
//      использует ПЛЕЙСХОЛДЕР (см. itemVisibleFor) — формат данных для этого
//      ещё не спроектирован пользователем.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { actorFactionKeys, anySameOrDescendant, getFactionIndex } from "./factions.mjs";

const num = v => Number(v) || 0;

// ── заготовки (без foundry.utils.randomID — модуль намеренно без Foundry) ──

export function blankReqEntry(kind = "item") {
  return {
    kind, mode: "need", // "need" | "forbid"
    // item
    itemType: "trait", itemName: "", rating: "",
    // numeric — numericTarget: "characteristic" | "corruption" | "insanity"
    numericTarget: "characteristic", charKey: "s", op: "atLeast", value: 0,
    // faction
    factionKey: ""
  };
}

export function blankReqGroup(operator = "AND") {
  return { operator, entries: [blankReqEntry()] };
}

export function blankReqBlock(tier = "secondary") {
  return { tier, forbid: false, group: blankReqGroup() };
}

// ── проверка одной записи ───────────────────────────────────────────────────

function itemEntryOk(actor, entry) {
  const name = String(entry.itemName || "").trim();
  if (!name) return true; // незаполненная запись не гейтит ничего
  const items = [...(actor?.items ?? [])];
  const hit = items.find(i => (!entry.itemType || i?.type === entry.itemType) && itemHasName(i, name));
  let ok = !!hit;
  if (ok && entry.rating !== "" && entry.rating != null) {
    ok = num(hit?.system?.rating) >= num(entry.rating);
  }
  return entry.mode === "forbid" ? !ok : ok;
}

function numericEntryOk(actor, entry) {
  const sys = actor?.system ?? {};
  let cur;
  if (entry.numericTarget === "corruption") cur = num(sys.corruption?.value);
  else if (entry.numericTarget === "insanity") cur = num(sys.insanity?.value);
  else cur = num(sys.characteristics?.[entry.charKey]?.total);
  const ok = entry.op === "atMost" ? cur <= num(entry.value) : cur >= num(entry.value);
  return entry.mode === "forbid" ? !ok : ok;
}

function factionEntryOk(actor, entry) {
  if (!entry.factionKey) return true;
  const mine = actorFactionKeys(actor);
  const ok = anySameOrDescendant(mine, entry.factionKey, getFactionIndex());
  return entry.mode === "forbid" ? !ok : ok;
}

/** Одна запись Requirement: true — выполнена, false — нет. */
export function reqEntryOk(actor, entry) {
  switch (entry?.kind) {
    case "item":     return itemEntryOk(actor, entry);
    case "numeric":  return numericEntryOk(actor, entry);
    case "faction":  return factionEntryOk(actor, entry);
    default:         return true;
  }
}

/** Человекочитаемое описание записи — для превью и подсказки «чего не хватает». */
export function describeReqEntry(entry) {
  const not = entry?.mode === "forbid" ? "НЕ " : "";
  switch (entry?.kind) {
    case "item": {
      if (!entry.itemName) return "Предмет: (перетащите)";
      const rating = entry.rating !== "" && entry.rating != null ? ` (рейтинг ≥ ${entry.rating})` : "";
      return `${not}Предмет: ${entry.itemName}${rating}`;
    }
    case "numeric": {
      const sign = entry.op === "atMost" ? "≤" : "≥";
      const label = entry.numericTarget === "corruption" ? "Порча"
        : entry.numericTarget === "insanity" ? "Безумие"
        : (entry.charKey || "?").toUpperCase();
      return `${not}${label} ${sign} ${entry.value ?? ""}`;
    }
    case "faction":
      return entry.factionKey ? `${not}Фракция: ${entry.factionKey}` : "Фракция: (не выбрана)";
    default:
      return "?";
  }
}

// ── группа (И/ИЛИ) и блок ───────────────────────────────────────────────────

/** Выполнена ли группа записей целиком: «И» — все, «ИЛИ» — хотя бы одна. */
export function reqGroupOk(actor, group) {
  const entries = group?.entries || [];
  if (!entries.length) return true;
  return group.operator === "OR"
    ? entries.some(e => reqEntryOk(actor, e))
    : entries.every(e => reqEntryOk(actor, e));
}

/** Выполнен ли Requirement одного блока (обёртка над группой, для читаемости вызова). */
export function reqBlockMet(actor, block) {
  return reqGroupOk(actor, block?.group);
}

/** Нормализованный список блоков Requirement предмета. */
export function getReqBlocks(item) {
  const arr = item?.flags?.["warhammer-dbc"]?.reqBlocks;
  return Array.isArray(arr) ? arr : [];
}

// ── проверка предмета целиком ───────────────────────────────────────────────

/**
 * Виден ли предмет в пикерах/дроплистах для этого актора: false, если есть
 * хотя бы один невыполненный Primary-блок (Secondary никогда не прячет).
 *
 * ПЛЕЙСХОЛДЕР: несколько Primary-блоков на одном предмете комбинируются
 * через И (обязаны быть выполнены ВСЕ) — крест-блочный И/ИЛИ формат данных
 * ещё не спроектирован пользователем (см. doombc-req-condition-effect-plan).
 * Сменить на явный оператор, когда формат появится, а не считать этот дефолт
 * окончательным решением.
 */
export function itemVisibleFor(actor, item) {
  const primaries = getReqBlocks(item).filter(b => b.tier === "primary");
  return primaries.every(b => reqBlockMet(actor, b));
}

/**
 * Жёстко блокирован ли ручной drag&drop мимо пикера — только Primary с
 * флагом forbid. Secondary и Primary без forbid никогда не блокируют.
 */
export function itemHardBlockedFor(actor, item) {
  return getReqBlocks(item).some(b => b.tier === "primary" && b.forbid && !reqBlockMet(actor, b));
}

/**
 * Secondary-блоки, чей Requirement сейчас не выполнен — для подсветки в UI
 * («часть эффектов недоступна»), не блокируют ни получение, ни видимость.
 */
export function unmetSecondaryBlocks(actor, item) {
  return getReqBlocks(item).filter(b => b.tier === "secondary" && !reqBlockMet(actor, b));
}
