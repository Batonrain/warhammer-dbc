// module/rules/item-rules.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПРАВИЛА ОТ ПРЕДМЕТОВ — мост между Конструктором и конвейером теста.
//
//  Конструктор (module/apps/mechanics.mjs) умеет две вещи: применить запись
//  один раз при получении предмета и повесить ActiveEffect. Ни то, ни другое не
//  годится для правил, которые живут В МОМЕНТ БРОСКА: «раз в Раунд перебросить
//  любой тест A» нельзя ни применить заранее, ни выразить числом в эффекте.
//
//  Такие записи и превращаются здесь в правила формата docs/rules-format.md —
//  те же, что пишет библиотека правил (module/rules/library/). Дальше их
//  просеивает по `when` тот же отбор и показывает тот же диалог: конвейеру
//  всё равно, пришло правило из книги или с предмета игрока.
//
//  Активность источника спрашивается снаружи (аргумент `isActive`), а не здесь:
//  её знает module/apps/effects.mjs, а этот файл обязан считаться без Foundry.
//  Благодаря ей выключенный Локус Герольда правил не даёт — тот же рубильник,
//  что гасит его эффекты и выдачи.
//
//  Виды записи, которые сюда доехали:
//    reroll  — «Переброс»: rerollScope, rerollChar / skillKey,
//              rerollMode (keepBest|keepWorst), label.
//    testMod — «Модификатор теста»: modScope, modValueMode (flat|charBonus),
//              value / modCharBonus, label. Второй режим нужен там, где числа
//              в данных быть не может: «+Inf герольда» у каждого своё.
//    capability — «Возможность»: capabilityKey, label. Именованная способность,
//              которую читает hasRuleFlag() (module/rules/flags.mjs). Ею
//              выражается всё, что не число и не переброс: снятие штрафа,
//              подмена характеристики, авто-успех, бонусное действие, база
//              приёма, аура, деление Ужасов, игнор шаблонов Linger. Имя —
//              договор между записью и тем местом кода, что её читает; список
//              занятых имён держится в module/constants/capabilities.mjs.
//  Области у обоих общие (scopeTarget) и совпадают с `target` из
//  docs/rules-format.md: одна область обязана значить одно и то же везде.
//  Остальные виды из Локусов (подмена характеристики, снятие штрафа, авто-успех,
//  бонусное действие, база приёма) поедут сюда же — см. биду wdbc-h5f.
// ════════════════════════════════════════════════════════════════════════════

import { isKnownCapability } from "../constants/capabilities.mjs";
import { entryWhenOk } from "./mech-when.mjs";

const SYSTEM = "warhammer-dbc";

/** Механика предмета — и у живого документа, и у сырых данных пака. */
const mechanicsOf = (item) => {
  const raw = item?.flags?.[SYSTEM]?.mechanics;
  return Array.isArray(raw) ? raw : [];
};

/**
 * Область эффекта из полей записи. Пустая обязательная часть — не «ноль», а
 * ошибка автора: правило без области сработало бы на каждом броске в игре.
 *
 * @returns {?string} null, если запись заполнена не до конца
 */
function scopeTarget(rawScope, entry, ruleId, what) {
  const scope = String(rawScope || "all");
  // shield — тесты на щиты (Локус Преломления), opposed — встречные тесты
  // (вторая половина Локуса Цепей и перебросы, навязанные цели).
  if (["all", "attack", "initiative", "social", "instability", "shield", "opposed"].includes(scope)) return scope;
  if (scope === "char") {
    const key = String(entry.rerollChar || "").trim();
    if (key) return `char:${key.toLowerCase()}`;
  }
  if (scope === "skill") {
    const key = String(entry.skillKey || "").trim();
    if (key) return `skill:${key.toLowerCase()}`;
  }
  console.error(`Warhammer DBC | запись «${what}» (${ruleId}): не заполнена область «${scope}»`);
  return null;
}

/** Запись → правило. Неизвестный вид молча пропускается: он не про броски. */
function ruleFromEntry(item, entry) {
  const id = `item.${item.name}.${entry?.id}`;

  if (entry?.kind === "reroll") {
    const target = scopeTarget(entry.rerollScope, entry, id, "Переброс");
    if (target === null) return null;
    return {
      id, label: entry.label || item.name, when: {},
      effects: [{
        kind: "rollMode", target,
        mode: entry.rerollMode === "keepWorst" ? "keepWorst" : "keepBest",
        rolls: 2,
        // who:"target" — переброс НАВЯЗАН цели: «заставить цель перебросить
        // Избегание» (Локус Кровопролития), «заставить цель соблазнения
        // перебросить встречный тест» (Локус Очарования). Без пометки демон
        // перебрасывал бы собственный бросок, то есть ровно наоборот.
        who: entry.rerollWho === "target" ? "target" : "self"
      }]
    };
  }

  if (entry?.kind === "testMod") {
    const target = scopeTarget(entry.modScope, entry, id, "Модификатор теста");
    if (target === null) return null;
    // Два режима значения: плоское число и «бонус своей характеристики».
    // Второй нужен там, где числа в данных быть не может: «+Inf герольда»
    // у каждого Герольда своё (Локус Цепей).
    const effect = entry.modValueMode === "charBonus"
      ? { kind: "rollBonus", target, valueFrom: { selfCharBonus: entry.modCharBonus || "inf" } }
      : { kind: "rollBonus", target, value: Number(entry.value) || 0 };
    return { id, label: entry.label || item.name, when: {}, effects: [effect] };
  }

  if (entry?.kind === "capability") {
    const key = String(entry.capabilityKey || "").trim();
    if (!key) {
      console.error(`Warhammer DBC | запись «Возможность» (${id}): не задано имя возможности`);
      return null;
    }
    // Неизвестное имя — почти наверняка опечатка: возможность молча ничего бы
    // не дала. Правило всё равно отдаём (вдруг имя завёл сторонний модуль),
    // но в консоль жалуемся.
    if (!isKnownCapability(key)) {
      console.error(`Warhammer DBC | запись «Возможность» (${id}): имя «${key}» не значится в constants/capabilities.mjs`);
    }
    return { id, label: entry.label || item.name, when: {},
             effects: [{ kind: "grantFlag", target: key }] };
  }

  return null;
}

/**
 * Правила со всех предметов актора.
 *
 * ИЛИ-ветки не просматриваются — по той же причине, что и в
 * collectDirectEquipmentEntries (mechanics.mjs): выбор в них делается один раз
 * диалогом при выдаче, и переигрывать его на каждом броске нельзя.
 *
 * @param {Iterable} items    предметы актора
 * @param {Function} isActive (item) => boolean, по умолчанию «все активны»
 * @param {object}   [actor]  владелец items — для гейта по Геносемени
 *   (entry.when, mech-when.mjs). Без него гейт считается пройденным (см.
 *   entryWhenOk): здесь это не должно случаться при обычном вызове из
 *   sources.mjs, где актор всегда есть, но функция вызывается и с сырыми
 *   данными теста без владельца — тогда веди себя как раньше, без фильтра.
 */
export function rulesFromItemMechanics(items, isActive = () => true, actor = null) {
  const out = [];
  const walk = (item, entries, operator) => {
    if (operator === "OR") return;
    for (const entry of entries || []) {
      if (entry?.kind === "group" && entry.group) {
        walk(item, entry.group.entries, entry.group.operator);
        continue;
      }
      if (!entryWhenOk(actor, entry, item)) continue;
      const rule = ruleFromEntry(item, entry);
      if (rule) out.push(rule);
    }
  };
  for (const item of items || []) {
    if (!isActive(item)) continue;
    for (const group of mechanicsOf(item)) walk(item, group.entries, group.operator);
  }
  return out;
}
