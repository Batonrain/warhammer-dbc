// module/apps/effects-summary.mjs
// ════════════════════════════════════════════════════════════════════════
//  Вкладка «Эффекты» листа персонажа (wdbc-xrsh): сводка активных Foundry
//  ActiveEffect — баф/дебаф × характеристика/иной показатель.
//
//  ТОЛЬКО ЧТЕНИЕ уже применённых change — никакого пересчёта итоговых
//  характеристик (тот считает module/documents/actor.mjs при
//  prepareDerivedData). Собирает эффекты так же, как их находит сам Foundry
//  перед применением (Actor#allApplicableEffects, client/documents/actor.mjs
//  движка v14): свои embedded-эффекты актора + effects с transfer:true у
//  каждого предмета. Правило продублировано намеренно — метод реального
//  класса Actor недоступен в тестах без foundry-stub, а эта сводка обязана
//  проверяться без него (см. dbc-workflow, «Заглушка Foundry — узкий
//  инструмент»).
//
//  «Урон характеристикам» из формулировки тикета сюда НЕ входит: в этой
//  системе это отдельное ХРАНИМОЕ поле system.charDamage.<char> (ручной ввод
//  на листе, знаковый «Мод.» — см. module/migrations/char-damage-sign.mjs,
//  module/rules/character.mjs), а не ActiveEffect. Смешивать его с этой
//  сводкой значило бы выдавать ручное поле за автоматический эффект.
// ════════════════════════════════════════════════════════════════════════

import { effectKeyLabel, EFFECT_TYPE_LABELS } from "../constants/effect-keys.mjs";
import { remainingLabel } from "../rules/condition-duration.mjs";
import { isTempModifier } from "./temp-modifier.mjs";

const CHAR_PREFIX = "system.characteristics.";

/** Метка категории цели эффекта: характеристика или прочий показатель (AP, Инициатива, Размер…). */
export function effectTargetCategory(key = "") {
  return key.startsWith(CHAR_PREFIX) ? "characteristic" : "other";
}
export const TARGET_CATEGORY_LABELS = {
  characteristic: "Характеристика",
  other:          "Иной показатель"
};

/**
 * Знак изменения по одному change: +1 баф, -1 дебаф, 0 — определить нельзя
 * (в основном "override": без базового значения неизвестно, растёт итог или
 * падает).
 */
export function effectChangeSign(change) {
  const raw = Number(change?.value);
  if (!Number.isFinite(raw) || raw === 0) return 0;
  switch (change?.type) {
    case "add":
    case "upgrade":   return raw > 0 ? 1 : -1;
    case "subtract":  return raw > 0 ? -1 : 1;
    case "multiply":  return raw >= 1 ? 1 : -1;
    // "downgrade" (Math.min) — задаёт потолок: положительное значение всё
    // равно ограничивает сверху, поэтому это дебаф-ограничение, а не бонус.
    case "downgrade": return -1;
    // Деление (Конструктор эффектов, wdbc): делитель ≥1 уменьшает число —
    // дебаф; дробный делитель <1 увеличивает — баф.
    case "divideUp":
    case "divideDown": return raw >= 1 ? -1 : 1;
    case "override":
    default: return 0;
  }
}

/**
 * "+2", "−3", "×2", "=5" и т.п. — знак операции (EFFECT_TYPE_LABELS) плюс число.
 *
 * ADD — особый случай: Foundry хранит дебаф тем же режимом ADD с
 * ОТРИЦАТЕЛЬНЫМ change.value (нет отдельного режима «вычесть»), поэтому
 * фиксированный префикс "+" из EFFECT_TYPE_LABELS.add дал бы «+-5» — знак
 * здесь берётся из самого значения, не из ярлыка типа.
 */
export function formatChangeValue(change) {
  const type = change?.type;
  const value = Number(change?.value);
  if (type === "add" && Number.isFinite(value)) {
    return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
  }
  const sign = EFFECT_TYPE_LABELS[type] ?? type ?? "+";
  return `${sign}${change?.value ?? ""}`;
}

/**
 * Все эффекты, которые Foundry применит к актору: свои + transfer:true (по
 * умолчанию true в схеме ядра) с каждого предмета. Копия Actor#
 * allApplicableEffects — см. заголовок файла.
 */
export function applicableActorEffects(actor) {
  // fromItem различает две ЛИЧНО РАЗНЫЕ вещи с одинаковой формой: эффект,
  // пришедший с предмета (источник — сам предмет, его имя и картинку и надо
  // показывать), и эффект, лежащий прямо на акторе (источником там числится
  // сам актор, и показывать его имя бессмысленно — см. rowSourceName ниже).
  const own = [...(actor?.effects?.contents ?? actor?.effects ?? [])]
    .map(effect => ({ effect, source: actor, fromItem: false }));
  const items = actor?.items?.contents ?? actor?.items ?? [];
  const fromItems = [];
  for (const item of items) {
    const effects = item?.effects?.contents ?? item?.effects ?? [];
    for (const effect of effects) {
      if (effect?.transfer === false) continue; // явно выключенная передача
      fromItems.push({ effect, source: item, fromItem: true });
    }
  }
  return [...own, ...fromItems];
}

/**
 * Что показать в столбце «источник».
 *
 * У эффекта ПРЕДМЕТА это сам предмет: «Силовой меч», «Мутация: Рога». У
 * эффекта, лежащего на акторе, источником числится сам актор — и строка
 * получалась «Иван Грозный», то есть имя того же персонажа, чей лист открыт
 * (найдено живой проверкой 06.09.2026 на Временном модификаторе). Полезное имя
 * там несёт сам эффект: «Ослепляющая граната (Ag −10)».
 */
export function rowSourceName({ effect, source, fromItem }) {
  if (!fromItem) return effect?.name || "—";
  return source?.name || effect?.name || "—";
}

/** Действует ли эффект прямо сейчас — тот же признак, что держит isItemActive/syncItemEffectsDisabled. */
function isEffectActive(effect) {
  return !effect?.disabled;
}

/**
 * Построчная сводка активных эффектов актора — одна строка на один change
 * одного активного ActiveEffect: источник, к чему применяется, знак,
 * категория цели.
 */
export function buildActiveEffectRows(actor) {
  const rows = [];
  for (const entry of applicableActorEffects(actor)) {
    const { effect, source } = entry;
    if (!isEffectActive(effect)) continue;
    const changes = effect?.system?.changes ?? effect?.changes ?? [];
    for (const change of changes) {
      if (!change?.key) continue;
      const category = effectTargetCategory(change.key);
      rows.push({
        effectId:   effect.id,
        effectName: effect.name || "Эффект",
        // Временный модификатор с листа (wdbc-5qvo) — единственная строка
        // сводки, которую можно снять отсюда же: у неё нет предмета-владельца,
        // гасить её больше негде. Срок показывается только у неё по той же
        // причине — у эффекта предмета срока обычно нет вовсе.
        temp:       isTempModifier(effect),
        termLabel:  remainingLabel(effect?.duration),
        sourceId:   source?.id,
        sourceUuid: source?.uuid,
        sourceName: rowSourceName(entry),
        // Картинка — по тому же признаку: у эффекта на самом акторе портрет
        // персонажа в столбце источника не сообщает ничего, там нужна иконка
        // самого эффекта.
        sourceImg:  (entry.fromItem ? source?.img : null) || effect.img || "icons/svg/aura.svg",
        key:        change.key,
        targetLabel: effectKeyLabel(change.key),
        type:       change.type,
        value:      change.value,
        valueLabel: formatChangeValue(change),
        sign:       effectChangeSign(change),
        category,
        categoryLabel: TARGET_CATEGORY_LABELS[category]
      });
    }
  }
  return rows;
}

/** Строки → { buff, debuff, neutral } × { characteristic, other }. */
export function groupActiveEffectRows(rows) {
  const groups = {
    buff:    { characteristic: [], other: [] },
    debuff:  { characteristic: [], other: [] },
    neutral: { characteristic: [], other: [] }
  };
  for (const row of rows) {
    const signKey = row.sign > 0 ? "buff" : row.sign < 0 ? "debuff" : "neutral";
    groups[signKey][row.category].push(row);
  }
  return groups;
}

/** Контекст вкладки «Эффекты» листа персонажа. */
export function activeEffectsTabContext(actor) {
  const rows = buildActiveEffectRows(actor);
  const groups = groupActiveEffectRows(rows);
  const count = g => g.characteristic.length + g.other.length;
  return {
    activeEffectsRows: rows,
    activeEffectsGroups: groups,
    activeEffectsCounts: { buff: count(groups.buff), debuff: count(groups.debuff), neutral: count(groups.neutral) },
    activeEffectsEmpty: rows.length === 0
  };
}
