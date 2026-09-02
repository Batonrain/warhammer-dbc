// module/rules/addiction.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Зависимость (мутация «Addiction», корбук стр. 440-452; wdbc-5inv/wdbc-1rno):
//  «если персонаж в течение дня не удовлетворяет эту зависимость, начиная со
//  следующего дня и пока он не удовлетворит её, получает штраф −10 на все
//  тесты Навыков (но не тесты Характеристик)».
//
//  Состояние (момент последнего утоления, объект зависимости) хранится НЕ на
//  акторе, а на самом предмете-мутации (system.dependency, data/item/
//  mutation.mjs) — тот же выбор, что у submutation: зависимость личная для
//  каждого экземпляра мутации, а не общая для актора. Модуль читает предметы
//  актора напрямую (по capabilityKey), не через hasRuleFlag — тому нужна
//  булева «есть/нет», а здесь нужен конкретный документ, чтобы читать/писать
//  его дату утоления. isAddictionItem() ниже — тот же поиск по ИМЕНИ, что у
//  rules/hand-of-death.mjs: apps/addiction.mjs (кнопка «Утолить» на листе
//  самой Мутации) должен находить предмет независимо от того, собрал ли
//  движок правил его capabilityKey в actor.items (превью вне владельца и
//  т.п.) — то же соображение, что у соседней rules/vampiric-dependency.mjs.
//
//  Штраф заведён отдельным `target:"anySkill"` (resolve-test.mjs), которого
//  раньше не было: ни одна книжная запись не била по «любому тесту Навыка, но
//  не Характеристики» одной галочкой — обычно правило целится в конкретный
//  Навык (`skill:<key>`) или вовсе не разделяет Навык/Характеристику
//  (`all`/`char:<key>`). Отдельный примитив, а не запись Конструктора: сам
//  предмет — не Конструктор-контент (нет entry.when/kind), а всегда включённое
//  правило поверх времени, как Голод/Жажда/Сон (constants/vitals.mjs).
//
//  ЧТО ИМЕННО утоляет зависимость — одна из 13 субмутаций текста (последняя
//  еда, яд, кровь врага и т.п.) — не автоматизировано и не будет: это чисто
//  отыгрышевый выбор игрока/ГМа (см. capabilities.mjs::mutation.addiction).
// ════════════════════════════════════════════════════════════════════════════

import { isItemActive } from "../apps/effects.mjs";
import { itemHasName } from "./predicates.mjs";
import { SECONDS_PER_DAY, formatDuration } from "../constants/imperial-calendar.mjs";

export const ADDICTION_CAPABILITY = "mutation.addiction";
const THRESHOLD_DAYS = 1; // «начиная со следующего дня» — сутки без штрафа
const NAME = "Addiction";

function itemGrantsCapability(item, key) {
  const groups = item?.flags?.["warhammer-dbc"]?.mechanics;
  if (!Array.isArray(groups)) return false;
  return groups.some(g => (g.entries || []).some(e => e?.kind === "capability" && e.capabilityKey === key));
}

/** Это предмет-Мутация «Зависимость»? Поиск по имени — см. шапку файла. */
export function isAddictionItem(item) {
  return item?.type === "mutation" && itemHasName(item, NAME);
}

/** Предметы-носители Зависимости на акторе (обычно один, код не полагается на это). */
export function addictionItems(actor) {
  return (actor?.items ?? []).filter(i =>
    i.type === "mutation" && itemGrantsCapability(i, ADDICTION_CAPABILITY) && isItemActive(i));
}

/** Сколько суток прошло с последнего утоления. null-метка (ещё не инициализирована) → 0, без штрафа задним числом. */
export function addictionDaysSince(item, worldTime) {
  const last = item?.system?.dependency?.lastSatisfied;
  if (last == null) return 0;
  return Math.max(0, (Number(worldTime) - Number(last)) / SECONDS_PER_DAY);
}

export function isAddictionUnsatisfied(item, worldTime) {
  return addictionDaysSince(item, worldTime) >= THRESHOLD_DAYS;
}

/** Строка статуса для листа: "до штрафа: 6ч" либо "не удовлетворена: 3д 4ч". */
export function addictionStatusLabel(item, worldTime) {
  const elapsed = addictionDaysSince(item, worldTime) * SECONDS_PER_DAY;
  if (elapsed < THRESHOLD_DAYS * SECONDS_PER_DAY) {
    return `до штрафа: ${formatDuration(THRESHOLD_DAYS * SECONDS_PER_DAY - elapsed)}`;
  }
  return `не удовлетворена: ${formatDuration(elapsed - THRESHOLD_DAYS * SECONDS_PER_DAY)}`;
}

/** Объект зависимости для отображения: своя запись игрока или авто из выпавшей субмутации. */
export function addictionSubstanceLabel(item) {
  const own = String(item?.system?.dependency?.substance ?? "").trim();
  if (own) return own;
  return String(item?.system?.submutation?.name ?? "").trim();
}

/** Источник для реестра правил (rules/sources.mjs): по одной записи на неутолённую Зависимость. */
export function addictionPenaltyRules(actor) {
  const worldTime = (typeof game !== "undefined" ? game.time?.worldTime : null) ?? 0;
  const rules = [];
  for (const item of addictionItems(actor)) {
    if (!isAddictionUnsatisfied(item, worldTime)) continue;
    const substance = addictionSubstanceLabel(item);
    const label = `Зависимость${substance ? ` (${substance})` : ""}: не удовлетворена`;
    rules.push({
      id: `mutation.addiction.${item.id}`, label, when: {},
      effects: [{ kind: "rollBonus", target: "anySkill", value: -10, label }]
    });
  }
  return rules;
}

/** «Удовлетворить»: метка времени → сейчас; если объект ещё не вписан — подставить из субмутации. */
export async function satisfyAddiction(item) {
  const update = { "system.dependency.lastSatisfied": game.time?.worldTime ?? 0 };
  if (!String(item?.system?.dependency?.substance ?? "").trim()) {
    const auto = String(item?.system?.submutation?.name ?? "").trim();
    if (auto) update["system.dependency.substance"] = auto;
  }
  await item.update(update);
}

export async function setAddictionSubstance(item, value) {
  await item.update({ "system.dependency.substance": String(value ?? "") });
}
