// module/rules/collect.mjs
//
// Отбор правил: matchRule решает по одному правилу, collectRules собирает всё,
// что даёт актор, и снимает вытесненные.

import { PREDICATES } from "./predicates.mjs";
import { getRuleSources } from "./sources.mjs";

const overridesOf = rule => (Array.isArray(rule?.overrides) ? rule.overrides : []);

/**
 * Подходит ли правило актору и контексту: истинны должны быть все условия
 * `when` сразу. Пустой `when` означает «всегда».
 *
 * Неизвестный ключ условия — ошибка в консоль и false: тихо не сработавшее
 * правило ищется днями.
 */
export function matchRule(rule, actor, ctx = {}) {
  for (const [key, value] of Object.entries(rule?.when ?? {})) {
    // anyOf — единственный ключ, который не предикат, а СВЯЗКА: список веток,
    // из которых достаточно одной (wdbc-n48f). Без него «работает у Кхорнита
    // ИЛИ у Нурглита» приходилось заводить двумя правилами, и они расходились
    // при первой правке — одно поправили, второе забыли.
    //
    // Внутри ветки условия по-прежнему складываются через «И», а сам anyOf
    // соседствует с обычными условиями по «И»: «Астартес И (Кхорн ИЛИ Нургл)»
    // пишется одним правилом, как в книге.
    if (key === "anyOf") {
      const branches = Array.isArray(value) ? value : [];
      // Пустой список — не «условия нет»: автор написал ИЛИ и не заполнил ни
      // одной ветки. Тихо пропустить всех было бы противоположностью
      // написанного.
      if (!branches.some(w => matchRule({ id: rule?.id, when: w }, actor, ctx))) return false;
      continue;
    }
    if (!Object.hasOwn(PREDICATES, key)) {
      console.error(`Warhammer DBC | правило «${rule?.id ?? "без id"}»: неизвестное условие «${key}»`);
      return false;
    }
    if (!PREDICATES[key](actor, ctx, value)) return false;
  }
  return true;
}

/**
 * Снятие вытесненных. Вызывается только после отбора по `when`: правило с
 * невыполненным условием ничего вытеснять не должно.
 *
 * Взаимное вытеснение — ошибка в данных. Оставляем оба и пишем в консоль: молча
 * выбрать одно из двух хуже, чем показать двойной эффект, который сразу заметят.
 */
function applyOverrides(rules) {
  // Вытесняющих правил в наборе обычно нет вовсе: почти всё, что приезжает с
  // предметов, никого не вытесняет. Без этой проверки на каждый сбор строился
  // Map по всем правилам актора (в профиле пересчёта листа — 13% времени) ради
  // заведомо пустого списка снятых.
  if (!rules.some(rule => overridesOf(rule).length)) return rules;

  const byId = new Map(rules.filter(r => r?.id).map(r => [r.id, r]));

  const mutual = new Set();
  for (const rule of rules) {
    for (const id of overridesOf(rule)) {
      if (!overridesOf(byId.get(id)).includes(rule.id)) continue;
      mutual.add(rule.id);
      mutual.add(id);
      if (rule.id <= id) console.error(`Warhammer DBC | правила «${rule.id}» и «${id}» вытесняют друг друга`);
    }
  }

  const dropped = new Set();
  for (const rule of rules) {
    for (const id of overridesOf(rule)) {
      if (byId.has(id) && !mutual.has(id)) dropped.add(id);
    }
  }

  return rules.filter(rule => !dropped.has(rule.id));
}

/**
 * Источники, уже работающие ПРЯМО СЕЙЧАС по этому актору. Нужны против
 * бесконечной рекурсии: источник вправе спросить у актора возможность
 * (rules/flags.mjs::hasRuleFlag), а та собирает правила заново — и источник
 * зовёт сам себя. Так и вышло с источником «situational» (wdbc-n17t): штраф
 * Усталости спрашивает «Не Чувствует Боли», и сборка зациклилась насмерть.
 *
 * Ключ — источник ПЛЮС актор, а не один источник: cross-actor правила
 * («adjutant» смотрит Командира, «dreadnought» — мир) вложенно собирают
 * правила ДРУГОГО актора, и это законный вложенный вызов, глушить его нельзя.
 * Повторный вход по тому же актору законным быть не может: тот же источник с
 * тем же актором ответит то же самое, только глубже.
 *
 * WeakMap, а не строковый ключ: у подставного актора в тестах нет ни uuid, ни
 * id, и по строке два разных актора слились бы в один.
 */
const IN_FLIGHT = new WeakMap();
const IN_FLIGHT_NO_ACTOR = new Set();

function inFlightSetFor(actor) {
  if (!actor || typeof actor !== "object") return IN_FLIGHT_NO_ACTOR;
  let set = IN_FLIGHT.get(actor);
  if (!set) IN_FLIGHT.set(actor, set = new Set());
  return set;
}

/**
 * Сбор без отбора: всё, что дают зарегистрированные источники. Отдельно от
 * отбора, потому что конвейер теста (rules/resolve-test.mjs, фаза 2) даёт
 * сторонним модулям дописать правила в этот список до того, как он просеян.
 *
 * Упавший источник не роняет сборку: ошибка в консоль, остальные отрабатывают.
 */
export function gatherRules(actor, ctx = {}) {
  const all = [];
  const inFlight = inFlightSetFor(actor);
  for (const [key, source] of getRuleSources()) {
    if (inFlight.has(key)) continue;
    inFlight.add(key);
    try {
      all.push(...(source(actor, ctx) ?? []));
    } catch (err) {
      console.error(`Warhammer DBC | источник правил «${key}» упал`, err);
    } finally {
      inFlight.delete(key);
    }
  }
  return all;
}

/**
 * Кэш сборки на время ОДНОГО пересчёта (wdbc-uvap).
 *
 * hasRuleFlag() собирает все правила актора заново на каждый вопрос, а
 * пересчёт листа задаёт их несколько: замер (tools/bench-sheet.mjs, актор на
 * 120 предметов) показал ШЕСТЬ полных обходов всех предметов и всех записей
 * Конструктора за один prepareDerivedData — при том, что ответ все шесть раз
 * один и тот же.
 *
 * Кэш живёт только внутри withRulesCache(fn) и умирает вместе с ней. Это
 * сознательно уже, чем «кэш на акторе с инвалидацией по хукам»: сборка правил
 * читает не только самого актора (чужой Дредноут через game.actors, мировое
 * время у Зависимости, настройки подсистем), и подписаться на все источники
 * устаревания нечем. За время синхронного пересчёта устареть кэшу негде —
 * ничего из перечисленного внутри него не меняется.
 *
 * Кэшируется только ПУСТОЙ контекст: непустой значит «вопрос про конкретный
 * бросок», и два вопроса с разными целями обязаны отвечаться по-разному.
 */
let CACHE = null;

const emptyCtx = ctx => !ctx || Object.keys(ctx).length === 0;

/**
 * Собрать правила один раз на всё, что делается внутри `fn`.
 * Вложенный вызов пользуется кэшем внешнего и не гасит его на выходе.
 */
export function withRulesCache(fn) {
  if (CACHE) return fn();
  CACHE = new WeakMap();
  try {
    return fn();
  } finally {
    CACHE = null;
  }
}

/** Есть ли на этом акторе незакрытый вызов источника — см. IN_FLIGHT выше. */
const nested = actor => inFlightSetFor(actor).size > 0;

/**
 * Отбор: сначала по `when`, и только потом снятие вытесненных.
 */
export function selectRules(rules, actor, ctx = {}) {
  return applyOverrides(rules.filter(rule => matchRule(rule, actor, ctx)));
}

/**
 * Все правила, действующие для актора в этом контексте: сначала собрать от всех
 * источников, потом отобрать по `when`, и только потом снять вытесненные.
 */
export function collectRules(actor, ctx = {}) {
  // Кэшируется только полный ответ верхнего уровня. Вложенный (источник
  // спросил правила у самого себя) предохранитель IN_FLIGHT намеренно
  // усекает — положить такой ответ в кэш значило бы потерять источник в
  // следующем вопросе.
  const cacheable = CACHE && actor && typeof actor === "object"
                    && emptyCtx(ctx) && !nested(actor);
  if (cacheable && CACHE.has(actor)) return CACHE.get(actor);

  const rules = selectRules(gatherRules(actor, ctx), actor, ctx);
  if (cacheable) CACHE.set(actor, rules);
  return rules;
}

/**
 * Сбросить кэш ОДНОГО актора внутри текущего withRulesCache — не путать со
 * снятием обёртки целиком (та обнуляет CACHE и возвращает «нет кэша вовсе»).
 *
 * Нужна для середины ОДНОГО пересчёта (wdbc-2gn, module/rules/character.mjs):
 * первый вопрос за пересчёт (hasRuleFlag на Дредноута, ДО цикла характеристик
 * и до Object.assign(system.conditions, readAllMirrors(actor))) кладёт в кэш
 * полный набор правил, отобранный по ЕЩЁ НЕ ОБНОВЛЁННЫМ actor.system —
 * characteristics[key].bonus и conditions читаются предикатами charBonusMin/
 * hasCondition прямо с живого актора, а не из снимка на входе. Любое правило,
 * которое эти предикаты гейтят («нужен Бонус Силы 5», «в Ярости»), отбирается
 * по значениям ДО пересчёта и в такой форме остаётся в кэше до конца ОДНОГО
 * withRulesCache — даже когда сам пересчёт уже дописал верные bonus/conditions
 * на этот же actor.system несколькими строками ниже.
 *
 * Вызывается сразу после того, как эти поля устаканились для прохода
 * (character.mjs — после «Без сознания ⇒ Беспомощен»), чтобы следующий
 * коллект внутри той же обёртки пересобрал список по актуальному состоянию.
 * Не трогает кэш других акторов и не выходит из самой обёртки.
 */
export function invalidateRulesCacheFor(actor) {
  if (CACHE && actor && typeof actor === "object") CACHE.delete(actor);
}
