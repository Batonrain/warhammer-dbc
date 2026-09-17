// module/rules/warp-route-charting.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Прокладка новых маршрутов и Начертание маршрута (Книга Пустоты v.2, гл.
//  «Варп-путешествия», wdbc-r0w9.1/.2). Источник — packs-src/books/void.json,
//  страницы «Прокладка новых маршрутов» и «Начертание маршрута» (сверять
//  с паком при расхождении, не с этим файлом).
//
//  Прокладка — сбор Очков Маршрута за несколько рейсов (module/apps/
//  warp-route.mjs хранит их на самом предмете «Маршрут», system.plotting,
//  раз они переживают отдельные странствия, а не одно). Начертание —
//  разовая попытка записать УЖЕ пройденный маршрут (новый или старый) на
//  карту: Trade (Astrographer) по точности выхода + признакам маршрута.
//
//  Чистая логика без Foundry — обвязка в module/apps/veil.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Таблица Порога прокладки — по фактической Длительности странствия в днях. */
export const PLOTTING_THRESHOLD = [
  { min: 1,   max: 5,   label: "Переход между близкими системами",      threshold: 3 },
  { min: 6,   max: 10,  label: "Внутри одного субсектора",              threshold: 5 },
  { min: 11,  max: 30,  label: "Через территорию сектора",              threshold: 8 },
  { min: 31,  max: 80,  label: "Между несколькими секторами",           threshold: 12 },
  { min: 81,  max: 190, label: "Через сегментум",                       threshold: 16 },
  { min: 191, max: 300, label: "Через всю галактику",                   threshold: 20 }
];

export function plottingThresholdFor(days) {
  const d = Number(days) || 0;
  const row = PLOTTING_THRESHOLD.find(r => d >= r.min && d <= r.max);
  if (row) return row;
  // Длиннее 300 дней книга не расписывает — берём верхнюю границу как есть.
  return d > 300 ? PLOTTING_THRESHOLD[PLOTTING_THRESHOLD.length - 1] : PLOTTING_THRESHOLD[0];
}

/** Сбор информации: «одно очко за каждые две степени успеха» — только успех
 *  даёт очки, провал самого теста Navigation (Warp) — ноль (не минус). */
export function routePointsFromTest(deg) {
  return deg > 0 ? Math.floor(deg / 2) : 0;
}

/**
 * Обработка данных (Scholastic Lore (Astromancy), один тест за рейс):
 * успех — очки рейса засчитываются полностью, +1 за каждую степень успеха
 * сверх первой; провал — очки засчитываются наполовину (округление вниз),
 * и запись черновиков (Начертание) в ЭТОМ рейсе невозможна.
 */
export function astromancyOutcome(rejsPoints, deg) {
  if (deg > 0) return { points: rejsPoints + Math.max(0, deg - 1), canRecord: true };
  return { points: Math.floor(rejsPoints / 2), canRecord: false };
}

/**
 * Модификатор Trade (Astrographer) для Начертания маршрута: точность выхода
 * (+10 Точный / −10 Слегка отклонившийся / −30 Значительно отклонившийся),
 * Категория «Прямой маршрут» +10, Особенность «Интуитивный» −20.
 */
export function chartingModifier({ exitAccuracy, categoryLabel, featureLabels = [] } = {}) {
  const accuracyMod = { exact: 10, slight: -10, significant: -30 }[exitAccuracy] ?? 0;
  const categoryMod = categoryLabel === "Прямой маршрут" ? 10 : 0;
  const featureMod = featureLabels.includes("Интуитивный") ? -20 : 0;
  return accuracyMod + categoryMod + featureMod;
}

/** «Неначертаемый след» — маршрут невозможно записать вовсе, теста не будет. */
export function chartingBlocked(categoryLabel) {
  return categoryLabel === "Неначертаемый след";
}

/** Успех — Детализированная карта; провал — Базовая; 4+ провала — не записан вовсе. */
export function chartingOutcome(deg) {
  if (deg <= -4) return "none";
  return deg > 0 ? "detailed" : "basic";
}

/** Детализированная карта → Известный; Базовая → Предполагаемый; нет записи → null. */
export function knowledgeFromCharting(outcome) {
  if (outcome === "detailed") return "known";
  if (outcome === "basic") return "presumed";
  return null;
}

/** Лестница Роста Знания (книжный порядок, снизу вверх). */
export const KNOWLEDGE_LADDER = ["unknown", "presumed", "known", "learned", "chosen"];

export function knowledgeRankOf(level) {
  const i = KNOWLEDGE_LADDER.indexOf(level);
  return i < 0 ? 0 : i;
}

/** Никогда не понижает — Знание растёт, не откатывается. */
export function upgradeKnowledge(current, proposed) {
  if (!proposed) return current || "unknown";
  return knowledgeRankOf(proposed) > knowledgeRankOf(current) ? proposed : (current || "unknown");
}

/**
 * «Известный → Выученный. Десять личных проходов… Особенность «Интуитивный»
 * считает каждый проход за два» — сколько шагов лестницы personal-проходов
 * даёт ОДИН завершённый рейс по этому маршруту (для накопления к порогу 10).
 */
export function passIncrement(featureLabels = []) {
  return featureLabels.includes("Интуитивный") ? 2 : 1;
}

export const PASSES_TO_LEARNED = 10;
