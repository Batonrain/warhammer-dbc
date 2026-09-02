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
//              Второй режим той же записи (wdbc-zk69, capabilityMode:"aptOverride"):
//              capabilityAptScope ("skill"|"talent"|"characteristic") +
//              capabilityAptMatch + capabilityAptAlign ("ally"|"enemy") —
//              Навык/Талант/Характеристика всегда Дружественный/Враждебный
//              независимо от Покровительства, читает
//              module/rules/aptitude-overrides.mjs.
//    script  — «Код» с ценой ИЛИ частотой (wdbc-suwp): не эффект для теста,
//              а координаты (itemId/groupId/entryId) для панели актора
//              «ВОЗМОЖНОСТИ СЕЙЧАС» — там kind:"capability" (кнопка
//              «Потратить») и kind:"script" (кнопка «▶ Запустить»,
//              module/apps/mechanics.mjs::runMechScriptEntry) стоят рядом.
//              Записи без цены/частоты сюда не едут — их кнопка и так видна
//              на листе своего предмета, панель актора не про них.
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
  // (вторая половина Локуса Цепей и перебросы, навязанные цели). morale —
  // тесты Морали по книге (Страх/Шок/Паника от Горения/Подавление/встречные
  // Запугивание и Пытки, core.json «Мораль и Потеря Командования»), см.
  // resolve-test.mjs::effectAppliesTo — wdbc-zepq, Lord of the Exodites.
  if (["all", "attack", "initiative", "social", "instability", "shield", "opposed", "morale"].includes(scope)) return scope;
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
function ruleFromEntry(item, entry, groupId = null) {
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
    // Три режима значения: плоское число, «бонус своей характеристики» и
    // «ополовинить штраф». Второй нужен там, где числа в данных быть не может:
    // «+Inf герольда» у каждого Герольда своё (Локус Цепей). modCharBonusMultiplier
    // — для «+2×PR»/«+5×PR» (wdbc-jw81, Психосилы) — множитель selfCharBonus,
    // читаемый effectValue() (module/rules/resolve-test.mjs); опущен/1 — как раньше.
    // halvePenalty даёт ту же галочку диалога, что Особенности Происхождения
    // (kind:"penaltyMul", resolve-test.mjs::rollModsFromRules) — по решению
    // пользователя автоматической тихой отмены штрафа в системе нет нигде,
    // галочка всегда предлагается игроку, а не применяется молча (wdbc-gzuf).
    const effect = entry.modValueMode === "halvePenalty"
      ? { kind: "penaltyMul", target, factor: 0.5 }
      : entry.modValueMode === "charBonus"
      ? { kind: "rollBonus", target, valueFrom: {
          selfCharBonus: entry.modCharBonus || "inf",
          ...(Number(entry.modCharBonusMultiplier) > 1 ? { multiplier: Number(entry.modCharBonusMultiplier) } : {})
        } }
      : { kind: "rollBonus", target, value: Number(entry.value) || 0 };
    return { id, label: entry.label || item.name, when: {}, effects: [effect] };
  }

  if (entry?.kind === "capability") {
    // Расширение той же записи «Возможность» (wdbc-zk69): вместо именованного
    // булева флага — «Навык/Талант/Характеристика Х всегда Дружественный/
    // Враждебный, независимо от Покровительства» (Африэль/Эльданар/Серый
    // Человек). Режим переключает сам автор (capabilityMode в Конструкторе,
    // module/apps/mechanics.mjs) — по нему, не по заполненности полей: иначе
    // переключение назад на обычную Возможность оставляло бы «висячий» старый
    // aptScope и запись продолжала бы читаться как override.
    if (entry.capabilityMode === "aptOverride") {
      const aptScope = String(entry.capabilityAptScope || "").trim();
      const match = String(entry.capabilityAptMatch || "").trim();
      if (!aptScope || !match) {
        console.error(`Warhammer DBC | запись «Возможность» (${id}): override склонности не заполнен (scope/match)`);
        return null;
      }
      const align = entry.capabilityAptAlign === "enemy" ? "enemy" : "ally";
      return { id, label: entry.label || item.name, when: {},
               effects: [{ kind: "grantAptitudeOverride", scope: aptScope, match, align }] };
    }
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
    // Цена в пуле (wdbc-1dc8) едет вместе с флагом — ruleFlagCost (rules/flags.mjs)
    // читает её у того же эффекта, что даёт саму возможность. Поле добавляется,
    // только когда цена реально задана — большинство записей остаются
    // бесплатными, и их эффект не меняет формы (тесты старого поведения целы).
    const cost = entry.capabilityCostPool
      ? { pool: entry.capabilityCostPool, amount: Math.max(1, Number(entry.capabilityCostAmount) || 1) }
      : null;
    return { id, label: entry.label || item.name, when: {},
             effects: [{ kind: "grantFlag", target: key, ...(cost ? { cost } : {}) }] };
  }

  if (entry?.kind === "script") {
    // Активная способность с ценой/частотой (wdbc-suwp) — всплывает на
    // панели актора «ВОЗМОЖНОСТИ СЕЙЧАС» рядом с kind:"capability" (той же
    // sheet-helpers.mjs строкой, кнопка там зовёт runMechScriptEntry вместо
    // spendCapabilityCost). Записи БЕЗ цены и БЕЗ частоты сюда намеренно не
    // едут — кнопка «▶ Запустить» у них и так всегда видна внутри листа
    // своего предмета (module/apps/mechanics.mjs), не всякий одноразовый
    // служебный script — заявленная игроку способность.
    if (!String(entry.code || "").trim()) return null;
    const unit = entry.scriptThrottleUnit || "";
    const cost = entry.capabilityCostPool
      ? { pool: entry.capabilityCostPool, amount: Math.max(1, Number(entry.capabilityCostAmount) || 1) }
      : null;
    if (!unit && !cost) return null;
    return { id, label: entry.label || item.name, when: {},
             effects: [{ kind: "scriptAbility", itemId: item.id, groupId, entryId: entry.id }] };
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
  // groupId — только для kind:"script" (runMechScriptEntry(item, groupId,
  // entryId) требует его для поиска записи); reroll/testMod/capability его
  // не используют, поэтому раньше walk() его не отслеживал вовсе.
  const walk = (item, entries, operator, groupId) => {
    if (operator === "OR") return;
    for (const entry of entries || []) {
      if (entry?.kind === "group" && entry.group) {
        walk(item, entry.group.entries, entry.group.operator, entry.group.id);
        continue;
      }
      if (!entryWhenOk(actor, entry, item)) continue;
      const rule = ruleFromEntry(item, entry, groupId);
      if (rule) out.push(rule);
    }
  };
  for (const item of items || []) {
    if (!isActive(item)) continue;
    for (const group of mechanicsOf(item)) walk(item, group.entries, group.operator, group.id);
  }
  return out;
}
