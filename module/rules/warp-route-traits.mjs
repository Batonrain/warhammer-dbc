// module/rules/warp-route-traits.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Признаки варп-маршрута (Книга Пустоты v.2, гл. «Варп-путешествия», раздел
//  «Создание варп-маршрута», wdbc-r0w9). Источник истины — сам пак
//  (packs-src/books/void.json, страница «Шаг 0: Подготовка»), а не память:
//  при расхождении текста между этим файлом и книгой прав пак.
//
//  Шесть признаков: Категория/Тип/Изученность/Освещённость/Стабильность —
//  каждый 1d10, Особенности — d100 (сколько угодно раз). Знание Проводником
//  — отдельный признак, принадлежит не маршруту, а Проводнику (см. таблицу
//  ROUTE_KNOWLEDGE_LEVELS в module/rules/warp-route.mjs).
//
//  Чистая логика без Foundry — обвязка (кнопка «Сгенерировать», запись в
//  item.system) живёт в module/apps/warp-route.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { routeKnowledgeMod } from "./warp-route.mjs";

/** Категория — насколько прям маршрут; множитель Продолжительности странствия. */
export const ROUTE_CATEGORY = [
  { min: 1, max: 3, label: "Прямой маршрут", durMult: 1,
    effect: "Проводник получает +10 на все тесты Начертания этого маршрута." },
  { min: 4, max: 5, label: "Непрямой маршрут", durMult: 2,
    effect: "Удвойте Продолжительность странствия." },
  { min: 6, max: 6, label: "Пугающий поход", durMult: 2, encounterMod: 10,
    effect: "Удвойте Продолжительность; +10 ко всем броскам по Таблице Варп-столкновений." },
  { min: 7, max: 7, label: "Трудный маршрут", durMult: 2, omenMod: -10,
    effect: "Удвойте Продолжительность; −10 на Psyniscience(P) при Чтении знамений." },
  { min: 8, max: 8, label: "Неначертаемый след", durMult: 2, noRecord: true,
    effect: "Удвойте Продолжительность; маршрут невозможно записать." },
  { min: 9, max: 9, label: "Тропа во тьме", durMult: 2, illuminationBlindZone: true,
    effect: "Удвойте Продолжительность; Освещённость на время странствия считается Слепой зоной." },
  { min: 10, max: 10, label: "Запутанный маршрут", durMult: 3,
    effect: "Утройте Продолжительность странствия." }
];

/** Тип — ширина и проходимость варп-артерии. Мод. идёт в Navigation (Warp), Шаги 4-5. */
export const ROUTE_TYPE = [
  { min: 1, max: 3, label: "Магистральный", mod: 10,
    effect: "Широкая варп-артерия, по которой веками ходят флотилии." },
  { min: 4, max: 8, label: "Стандартный", mod: 0,
    effect: "Обычный торговый или патрульный путь между системами." },
  { min: 9, max: 10, label: "Тропа", mod: -10,
    effect: "Узкое варп-течение, где не разойтись двоим." }
];

/**
 * Изученность — что о пути знает человечество (не путать со Знанием
 * конкретного Проводника). Мод. идёт в Navigation (Warp), Шаги 4-5.
 * «Неизведанный» (10) автоматически делает маршрут Неизвестным для ЛЮБОГО
 * Проводника (см. book: «итоговый штраф составит −40», пока кто-то не
 * пройдёт первым) — это книжное правило, не отдельный числовой мод.
 */
export const ROUTE_LORE = [
  { min: 1, max: 3, label: "Задокументированный", mod: 10,
    effect: "Маршрут есть в официальных лоциях и регулярно обновляется." },
  { min: 4, max: 7, label: "Устаревший", mod: 0,
    effect: "Лоциям больше сотни лет. Путь известен, актуальность под вопросом." },
  { min: 8, max: 9, label: "Апокрифичный", mod: -10,
    effect: "Маршрут упоминается в мифах или известен по слухам." },
  { min: 10, max: 10, label: "Неизведанный", mod: -30, forcesUnknown: true,
    effect: "Путь, которым по записям не ходил никто и никогда. Автоматически Неизвестный для любого Проводника, пока кто-то не пройдёт им первым." }
];

/**
 * Освещённость — наличие маяков/ориентиров. Мод. идёт ТОЛЬКО в
 * Psyniscience(P) на Шаге 3 (Поиск маяка) — Первый поиск и Повторный по
 * разным колонкам книжной таблицы. «Слепая зона» на повторном поиске —
 * маяк искать невозможно вовсе (не штраф, а запрет теста).
 */
export const ROUTE_ILLUMINATION = [
  { min: 1, max: 1, label: "Светозарный", first: 20, repeat: 10,
    effect: "Свет Астрономикона или иной мощный маяк ясно виден на всём пути." },
  { min: 2, max: 6, label: "Ясный", first: 10, repeat: 0,
    effect: "Есть стабильные, но слабые локальные ориентиры." },
  { min: 7, max: 9, label: "Тусклый", first: -10, repeat: -10,
    effect: "Ориентиры скрываются за варп-туманом; порой приходится идти вслепую." },
  { min: 10, max: 10, label: "Слепая зона", first: -30, repeat: null, repeatImpossible: true,
    effect: "Любые ориентиры отсутствуют на всём протяжении пути." }
];

/**
 * Стабильность — норов варпа на пути. Мод. идёт ТОЛЬКО в броски по Таблице
 * Варп-столкновений — и никуда больше. На этой таблице высокий результат
 * плохой, поэтому здесь плюс означает опасность, а минус — покой.
 */
export const ROUTE_STABILITY = [
  { min: 1, max: 1, label: "Спокойный", encounterMod: -10,
    effect: "Аномалий почти нет." },
  { min: 2, max: 7, label: "Изменчивый", encounterMod: 0,
    effect: "Нормальное состояние варпа: течения смещаются, водовороты приходят и уходят." },
  { min: 8, max: 9, label: "Турбулентный", encounterMod: 10,
    effect: "Путь пролегает через зоны возмущения варпа." },
  { min: 10, max: 10, label: "Штормовой", encounterMod: 30, storm: true,
    effect: "Маршрут идёт по краю Варп-Шторма. Путь идёт по краю шторма; маршрут внутри шторма подчиняется таблице силы Варп-шторма." }
];

/** Особенности — d100, МИ решает, сколько раз бросить (или выбирает вручную). */
export const ROUTE_FEATURES = [
  { min: 1, max: 8, label: "Эхо трагедии",
    effect: "На маршруте погиб корабль или целая флотилия. +10 к броскам Варп-столкновений. Выпавшие Корабли-призраки могут оказаться настоящими — и на них найдётся груз." },
  { min: 9, max: 16, label: "Зов",
    effect: "Путь связан с призрачными сигналами. МИ может без броска объявить Столкновение «Сны и шёпоты», а голоса на этом маршруте всегда говорят об одном и том же." },
  { min: 17, max: 25, label: "Паломнический",
    effect: "Дорога флотов пилигримов. −10 к броскам Варп-столкновений, но +5 к броскам Варп-вторжений: множество душ пахнет в варпе слишком громко." },
  { min: 26, max: 33, label: "Проклятый",
    effect: "Среди мореходов путь считается несчастливым — не обязательно заслуженно. Каждый раз, когда корабль получает DP в этом странствии, он получает +1 DP сверх того." },
  { min: 34, max: 41, label: "Вязкое течение",
    effect: "Путь требует долгого, постепенного погружения. Любая попытка Экстренного входа или резкой смены курса в варпе получает −30." },
  { min: 42, max: 50, label: "Стремнина",
    effect: "Маршрут затягивает корабль, как водоворот; замедлиться нельзя. Настоящая длительность не может быть больше ×1/2 расчётной, но при провале на Шаге 4 добавьте +1 СП." },
  { min: 51, max: 58, label: "Рифовый пролив",
    effect: "Коридор узок и окружён варп-рифами. −10 к Navigation (Warp) на Шаге 4; критический провал вдобавок к обычным последствиям вызывает Эфирный риф." },
  { min: 59, max: 66, label: "Незадокументированный",
    effect: "Путь известен контрабандистам или найден в чьих-то бумагах, но в лоциях его нет. МИ тайно решает до начала странствия, существует ли он вообще. Проводник узнаёт правду только при провале на Шаге 4 на 3+ СП: корабль считается значительно отклонившимся от курса." },
  { min: 67, max: 75, label: "Резонирующий",
    effect: "Маршрут усиливает всё психическое на борту. +10 к Psyniscience, фокусированию психосил и силам навигатора; но +10 к броскам Психических феноменов и +10 к Варп-столкновениям." },
  { min: 76, max: 83, label: "Охотничьи угодья",
    effect: "Здесь живёт варп-сущность, считающая эти воды своими. При Столкновении «Психические хищники» бросьте 1d10: на 6–10 это не случайные твари, а одна и та же сущность, помнящая этот корабль." },
  { min: 84, max: 91, label: "Граница",
    effect: "Путь идёт по стыку двух варп-регионов. МИ заранее готовит два набора Освещённости и Стабильности: первая половина странствия идёт по одному, вторая по другому. Проводник узнаёт о смене условий броском Psyniscience −10 на Шаге 4, иначе — по факту." },
  { min: 92, max: 100, label: "Интуитивный",
    effect: "Маршрут не даётся зрительной карте: Проводник чувствует его как вибрацию, звук или чужую эмоцию. −20 к Начертанию, но за каждый личный проход Знание растёт вдвое быстрее (проход считается за два)." }
];

/** Находит строку таблицы по броску 1d10/d100. */
function lookup(table, roll) {
  return table.find(r => roll >= r.min && roll <= r.max) || table[table.length - 1];
}

export const routeCategoryFor     = roll => lookup(ROUTE_CATEGORY, roll);
export const routeTypeFor         = roll => lookup(ROUTE_TYPE, roll);
export const routeLoreFor         = roll => lookup(ROUTE_LORE, roll);
export const routeIlluminationFor = roll => lookup(ROUTE_ILLUMINATION, roll);
export const routeStabilityFor    = roll => lookup(ROUTE_STABILITY, roll);
export const routeFeatureFor      = roll => lookup(ROUTE_FEATURES, roll);

/**
 * «Локальные ориентиры надо знать»: Ясная освещённость подразумевает, что
 * Проводник знаком с местными маяками. Если маршрут для него Неизвестный,
 * Ясный считается Тусклым — только числа хуже, не сам показанный признак
 * (книга нарочно оговаривает: «Светозарность так не понижается»).
 *
 * @param {?object} illumRow      строка ROUTE_ILLUMINATION (routeIlluminationFor)
 * @param {string} knowledgeLevel уровень Знания ЭТОГО Проводника ("unknown"…)
 */
export function effectiveIllumination(illumRow, knowledgeLevel) {
  if (!illumRow) return illumRow;
  if (illumRow.label === "Ясный" && knowledgeLevel === "unknown") {
    return ROUTE_ILLUMINATION.find(r => r.label === "Тусклый");
  }
  return illumRow;
}

/**
 * Модификатор Navigation (Warp) на Шагах 4-5 от признаков самого маршрута
 * (Тип + Изученность), капается книжным потолком −60..+40 ВМЕСТЕ со Знанием
 * Проводника — Знание сюда не входит (считается отдельно, знание относится
 * к Проводнику, а не к маршруту) и добавляется чем зовёт функция.
 *
 * @param {number} typeMod        ROUTE_TYPE[].mod
 * @param {number} loreMod        ROUTE_LORE[].mod
 * @param {number} knowledgeMod   routeKnowledgeMod(level) — прибавляется ДО капа
 * @returns {number} итоговый капнутый модификатор Типа+Изученности+Знания
 */
export function routeNavigationCap(typeMod, loreMod, knowledgeMod) {
  const sum = (Number(typeMod) || 0) + (Number(loreMod) || 0) + (Number(knowledgeMod) || 0);
  return Math.max(-60, Math.min(40, sum));
}

/**
 * Модификатор броска по Таблице Варп-столкновений от Стабильности + Категории
 * «Пугающий поход» + Дурных знамений — капается книжным −30..+40. Особенности
 * и «Проводник-псайкер/демон» добавляются отдельно (не числовые константы
 * маршрута, их обвязка внутри WARP_ENCOUNTERS/Проводников).
 *
 * @param {number} stabilityMod        ROUTE_STABILITY[].encounterMod
 * @param {number} categoryMod         ROUTE_CATEGORY[].encounterMod ?? 0 (только «Пугающий поход»)
 * @param {boolean} badOmensUnsuppressed  Дурные знамения не подавлены на Шаге 2
 * @returns {number}
 */
export function routeEncounterCap(stabilityMod, categoryMod, badOmensUnsuppressed) {
  const sum = (Number(stabilityMod) || 0) + (Number(categoryMod) || 0) + (badOmensUnsuppressed ? 20 : 0);
  return Math.max(-30, Math.min(40, sum));
}

export { routeKnowledgeMod };

// ── Генератор (МИ бросает все признаки за раз) ───────────────────────────────
// Math.random(), а не чат-бросок Foundry: то же решение, что у генератора
// звёздной системы (constants/star-system.mjs::generateSystem) — это
// подготовка мира ведущим, не тест за столом, отдельная чат-карточка тут не нужна.
const d10  = () => Math.floor(Math.random() * 10) + 1;
const d100 = () => Math.floor(Math.random() * 100) + 1;

/**
 * Бросает все шесть признаков маршрута разом. Особенности — d100 featureCount
 * раз, без повторов (книга: «повторное выпадение того же результата
 * приводит к перебросу») — на маленьких featureCount коллизии почти не
 * бывает, а reroll-до-упора безопасен: строк в таблице всего 12.
 *
 * @param {number} [featureCount] сколько раз бросить по Особенностям (МИ решает сам)
 * @returns {{category:{rating,label}, routeType:{rating,label}, lore:{rating,label},
 *            illumination:{rating,label}, stability:{rating,label},
 *            features: {roll:number, name:string, effect:string}[]}}
 */
export function generateRouteTraits(featureCount = 1) {
  const categoryRoll = d10(), typeRoll = d10(), loreRoll = d10(), illumRoll = d10(), stabRoll = d10();
  const features = [];
  const seenLabels = new Set();
  let guard = 0;
  while (features.length < featureCount && guard++ < 200) {
    const roll = d100();
    const f = routeFeatureFor(roll);
    if (seenLabels.has(f.label)) continue; // тот же результат — переброс
    seenLabels.add(f.label);
    features.push({ roll, name: f.label, effect: f.effect });
  }
  return {
    category:     { rating: categoryRoll, label: routeCategoryFor(categoryRoll).label },
    routeType:    { rating: typeRoll,     label: routeTypeFor(typeRoll).label },
    lore:         { rating: loreRoll,     label: routeLoreFor(loreRoll).label },
    illumination: { rating: illumRoll,    label: routeIlluminationFor(illumRoll).label },
    stability:    { rating: stabRoll,     label: routeStabilityFor(stabRoll).label },
    features
  };
}
