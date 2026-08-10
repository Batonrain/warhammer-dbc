// module/constants/imperial-calendar.mjs
// ════════════════════════════════════════════════════════════════════════
//  Имперская система летоисчисления (Imperial Dating System), формат по
//  warhammer40k.fandom.com/ru/wiki/Имперская_система_летоисчисления:
//
//    К.ДДД.ГГГ.МXX  =  контрольный_номер.доля_года.год.тысячелетие
//
//  - Контрольный номер (0-9) — точность измерения даты; не считается по
//    времени (это не физическая величина), GM выставляет вручную.
//  - Доля года (000-999) — год делится на 1000 равных частей вместо
//    недель/месяцев.
//  - Год (000-999) — сколько лет прошло с начала текущего тысячелетия.
//  - Тысячелетие (М + число) — сколько неполных тысячелетий прошло с
//    начала эры (0.000.000.М1).
//
//  Источник времени — game.time.worldTime (секунды). Это НЕ отдельный
//  счётчик: game.time.advance()/.set() уже двигают то самое worldTime, от
//  которого зависит истечение ActiveEffect с Duration в секундах — так что
//  прокрутка календаря автоматически синхронна с длительностью эффектов,
//  без какой-либо отдельной интеграции.
// ════════════════════════════════════════════════════════════════════════

export const SECONDS_PER_DAY  = 86400;
// Терранский год без учёта високосных дней — сама система в лоре описана
// как приблизительная бухгалтерия Империума, а не астрономическая точность.
export const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;

// Деление суток — список сегментов {label, icon, hours}, где hours —
// длительность именно ЭТОГО сегмента в терранских часах (сегменты не обязаны
// быть равными — см. вахты флота ниже). Сумма hours по всем сегментам задаёт
// длину полного цикла (обычно 24ч, но для Колхиды — 170.4ч, см. ниже).

// Классические 4 деления суток (ночь/утро/день/вечер), по 6 часов.
export const CLASSIC4_WATCHES = Object.freeze([
  { label: "Ночь",  icon: "🌑", hours: 6 },
  { label: "Утро",  icon: "🌅", hours: 6 },
  { label: "День",  icon: "☀", hours: 6 },
  { label: "Вечер", icon: "🌆", hours: 6 }
]);
export const CLASSIC4_DESCRIPTION = "Классическое деление суток на ночь/утро/день/вечер, по 6 часов каждое.";

export const HOURS24_WATCHES = Object.freeze(
  Array.from({ length: 24 }, (_, i) => ({ label: `${String(i).padStart(2, "0")}:00`, icon: "🕐", hours: 1 }))
);

// Вахты линейного флота Каликсиды — терранские сутки, НЕравные отрезки
// (две «собачьи» вахты по 2 часа режут стандартные 4-часовые интервалы,
// чтобы вахтенный состав менялся по разным часам каждый день).
export const CALIXIS_WATCHES = Object.freeze([
  { label: "Средняя вахта",           icon: "⚓", hours: 4 }, // 00:00–04:00
  { label: "Утренняя вахта",          icon: "⚓", hours: 4 }, // 04:00–08:00
  { label: "Предполуденная вахта",    icon: "⚓", hours: 4 }, // 08:00–12:00
  { label: "Послеполуденная вахта",   icon: "⚓", hours: 4 }, // 12:00–16:00
  { label: "Первая собачья вахта",    icon: "⚓", hours: 2 }, // 16:00–18:00
  { label: "Последняя собачья вахта", icon: "⚓", hours: 2 }, // 18:00–20:00
  { label: "Первая вахта",            icon: "⚓", hours: 4 }  // 20:00–00:00
]);
export const CALIXIS_DESCRIPTION = "Вахты линейного флота Каликсиды: 4-часовые смены, кроме двух 2-часовых «собачьих» вахт вечером (16:00–20:00), чтобы состав вахтенных смещался день ото дня.";

// Колхидское времяисчисление: солнечные сутки Колхиды = 7.1 терранских
// суток = 170.4 терранского часа (лор: житель "шести колхидских лет" на
// деле старше в 4.8 раза в терранском счёте). "День" делится на 7 примерно
// равных субдней. В реальности их длительность разнится по сезону/месту —
// здесь принято равное деление как играбельное приближение.
const COLCHIS_DAY_HOURS = 170.4;
const COLCHIS_SUBDAY_HOURS = COLCHIS_DAY_HOURS / 7; // ≈24.34ч
export const COLCHIS_WATCHES = Object.freeze([
  { label: "Предсвет (Dawnaway)",    icon: "🌄", hours: COLCHIS_SUBDAY_HOURS },
  { label: "Утрень (Mornday)",       icon: "🌅", hours: COLCHIS_SUBDAY_HOURS },
  { label: "Долгодень (Long Noon)",  icon: "☀",  hours: COLCHIS_SUBDAY_HOURS },
  { label: "Последень (Post-noon)",  icon: "🌇", hours: COLCHIS_SUBDAY_HOURS },
  { label: "Сумерица (Duskeve)",     icon: "🌆", hours: COLCHIS_SUBDAY_HOURS },
  { label: "Хладомрак (Coldfall)",   icon: "🌑", hours: COLCHIS_SUBDAY_HOURS },
  { label: "Полночье (High Night)",  icon: "🌌", hours: COLCHIS_SUBDAY_HOURS }
]);
export const COLCHIS_DESCRIPTION = "Колхидское времяисчисление: солнечные сутки Колхиды длятся 170.4 терранского часа (7.1 терранских суток), поделены на 7 примерно равных субдней.";

/** Конфигурация календаря по умолчанию — эпоха, контрольный номер, включённые обозначения. */
export const DEFAULT_CALENDAR_CONFIG = Object.freeze({
  // Императорское время в момент, когда worldTime === epochWorldTime.
  epochWorldTime: 0,
  epochMillennium: 41,
  epochYear: 999,
  epochFraction: 0,
  // 0-9, см. описание классов в вики — точность/подтверждённость даты.
  checkDigit: 1,
  // Ключи пресетов (встроенных из WATCH_PRESETS и/или своих из customPresets),
  // чьи обозначения показаны на виджете — КАЖДОЕ отдельной строкой под часами.
  // Основное деление (крупный лейбл 24ч) НЕ входит сюда — оно всегда фиксировано.
  enabledPresets: ["calixis"],
  // Свои пресеты, заведённые GM: [{key, label, watches:[{label,icon,hours}]}].
  customPresets: [],
  // Описание пресета (правится GM в настройках, всплывает подсказкой при
  // наведении на строку на виджете) — {presetKey: text}. Переопределяет
  // дефолтное description встроенного пресета, если задано непустым.
  presetDescriptions: {}
});

const pad3 = (n) => String(Math.abs(Math.trunc(n))).padStart(3, "0");

// Секунд в одной "доле года" (1/1000 года) — делится БЕЗ остатка, т.к.
// SECONDS_PER_YEAR кратен 1000. Считаем всё в целых числах этих единиц —
// не в дробных "годах" — иначе на границах округление double-точности
// (напр. 7/1000*1000 = 6.999999999999998) путает соседние значения.
// С дробными "годами" эпсилон-поправка ловит и настоящие «без 1 секунды
// до рубежа» случаи как если бы это был шум округления — здесь такого
// нет: наименьший реальный зазор (1 секунда) даёт ~3·10⁻⁵ долей года,
// на четыре порядка больше любого шума double.
export const SECONDS_PER_FRACTION_UNIT = SECONDS_PER_YEAR / 1000; // 31536, целое
const FRACTION_UNITS_PER_MILLENNIUM = 1000 * 1000;         // 1000 лет × 1000 долей
const EPS_UNITS = 1e-9; // запас против шума самого деления секунд на 31536

/**
 * worldTime (сек, game.time.worldTime) → {millennium, year, fraction}.
 * year/fraction — уже в границах 0-999 текущего тысячелетия (переход через
 * границу тысячелетия и уход в отрицательные worldTime — через floor-деление,
 * работает симметрично вперёд/назад).
 */
export function worldTimeToImperial(worldTime, cfg = DEFAULT_CALENDAR_CONFIG) {
  const epochUnits = ((cfg.epochMillennium - 1) * 1000 + cfg.epochYear) * 1000 + cfg.epochFraction;
  const deltaSeconds = worldTime - cfg.epochWorldTime;
  const deltaUnits = Math.floor(deltaSeconds / SECONDS_PER_FRACTION_UNIT + EPS_UNITS);
  const absoluteUnits = epochUnits + deltaUnits;

  const millennium = Math.floor(absoluteUnits / FRACTION_UNITS_PER_MILLENNIUM) + 1;
  const unitsInMillennium = absoluteUnits - (millennium - 1) * FRACTION_UNITS_PER_MILLENNIUM;
  const year = Math.floor(unitsInMillennium / 1000);
  const fraction = unitsInMillennium - year * 1000;
  return { millennium, year, fraction };
}

/** Обратное преобразование — worldTime, соответствующий {millennium,year,fraction} (та же целочисленная арифметика, что и выше — точный round-trip). */
export function imperialToWorldTime({ millennium, year, fraction }, cfg = DEFAULT_CALENDAR_CONFIG) {
  const epochUnits = ((cfg.epochMillennium - 1) * 1000 + cfg.epochYear) * 1000 + cfg.epochFraction;
  const targetUnits = ((millennium - 1) * 1000 + year) * 1000 + fraction;
  const deltaUnits = targetUnits - epochUnits;
  return cfg.epochWorldTime + deltaUnits * SECONDS_PER_FRACTION_UNIT;
}

/**
 * Дата "К.ДДД.ГГГ.МXX", разложенная на части готовыми строками — виджет
 * навешивает отдельную подсказку на каждую ("К.", долю года, год,
 * тысячелетие), а не на дату целиком.
 */
export function formatImperialDateParts(worldTime, cfg = DEFAULT_CALENDAR_CONFIG) {
  const { millennium, year, fraction } = worldTimeToImperial(worldTime, cfg);
  const digit = Math.max(0, Math.min(9, Math.trunc(cfg.checkDigit ?? 1)));
  return {
    digit: String(digit),
    fraction: pad3(fraction),
    year: pad3(year),
    millennium: `M${Math.max(1, millennium)}`
  };
}

// Контрольный номер (класс 0-9) — дословно по warhammer40k.fandom.com/ru/wiki/
// Имперская_система_летоисчисления, раздел «Контрольный номер». Не сокращать
// вольным пересказом — GM должен видеть точную формулировку лора по наведению.
export const CHECK_DIGIT_MEANINGS = Object.freeze([
  "0 — Терранское время: самое точное определение, используется для событий на Святой Терре.",
  "1 — Терранское время: используется для записи событий за пределами Терры (например, на Титане).",
  "2 — Прямой: событие произошло во время прямого астропатического контакта с Террой.",
  "3 — Непрямой: событие произошло во время астропатического контакта с источником, который в это время был на связи с Террой.",
  "4 — Подтверждённый: дата записана по системе отсчёта источника, недавно находившегося на связи с Террой.",
  "5 — Частично подтверждённый: дата записана по системе отсчёта источника, недавно находившегося в контакте с подтверждённым источником (класса «4»).",
  "6 — Неопределённая, ~1 год: не подтверждена предыдущими источниками, но является продолжением отсчёта с момента произошедшего ранее контакта.",
  "7 — Неопределённая, ~10 лет: то же, что и класс 6, но с большей погрешностью.",
  "8 — Неопределённая, 11+ лет: для ещё более длительных периодов времени.",
  "9 — Приблизительная: для миров, использующих неимперский календарь."
]);

/** Подсказка при наведении на «К.» — краткая роспись всех 10 классов контрольного номера. */
export function checkDigitTooltip() {
  return "Контрольный номер — точность измерения даты (компенсация искажений варп-путешествий):\n"
    + CHECK_DIGIT_MEANINGS.join("\n");
}

// Подсказки при наведении на остальные части даты — краткая суть, не полный лор.
export const DATE_PART_TOOLTIPS = Object.freeze({
  fraction: "Доля года (000–999): вместо недель/месяцев год делится Администратумом на 1000 равных частей.",
  year: "Год (000–999): сколько лет прошло с начала текущего тысячелетия.",
  millennium: "Тысячелетие (M + число): сколько неполных тысячелетий прошло с условного начала эры (0.000.000.M1)."
});

/**
 * Часы:минуты терранских суток, живьём из worldTime (не через сегменты
 * HOURS24_WATCHES — у тех подпись фиксирована на "HH:00", минуты внутри часа
 * в неё не попадают, и прокрутка минутами визуально "не работала" бы).
 */
export function formatClock(worldTime) {
  const secOfDay = ((worldTime % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  const h = Math.floor(secOfDay / 3600);
  const m = Math.floor((secOfDay % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Текущая «стража»/деление суток по worldTime. Сегменты не обязаны быть
 * равными — у каждого свой watches[i].hours (терранских часов); если поле
 * не задано (старые/ручные записи без него), сегмент считается равной
 * долей от 24 часов. Полный цикл = сумма hours по всем сегментам (обычно
 * 24ч, но, например, у Колхиды — 170.4ч) — это позволяет одной и той же
 * функции обслуживать и терранские сутки, и инопланетные с другой длиной.
 * Первая (index 0) начинается в момент, когда worldTime кратно длине цикла.
 */
export function currentWatch(worldTime, cfg = { watches: HOURS24_WATCHES }) {
  const watches = (cfg.watches?.length ? cfg.watches : HOURS24_WATCHES);
  const fallbackHours = 24 / watches.length;
  const segSecs = watches.map(w => (Number.isFinite(w?.hours) && w.hours > 0 ? w.hours : fallbackHours) * 3600);
  const cycleSecs = segSecs.reduce((a, b) => a + b, 0) || SECONDS_PER_DAY;
  const secOfCycle = ((worldTime % cycleSecs) + cycleSecs) % cycleSecs;

  // secOfCycle < cycleSecs всегда (модуль), а cycleSecs = сумма segSecs —
  // значит условие ниже гарантированно сработает не позже последнего сегмента.
  let acc = 0, index = 0, into = 0;
  for (let i = 0; i < watches.length; i++) {
    if (secOfCycle < acc + segSecs[i]) { index = i; into = secOfCycle - acc; break; }
    acc += segSecs[i];
  }
  const progress = segSecs[index] ? into / segSecs[index] : 0;
  return { index, watch: watches[index], progress, count: watches.length };
}

/** Готовые (встроенные, нередактируемые) пресеты обозначений — на выбор галками в настройках виджета. */
export const WATCH_PRESETS = Object.freeze({
  classic4: {
    label: "Классика (4: ночь/утро/день/вечер)",
    watches: CLASSIC4_WATCHES,
    description: CLASSIC4_DESCRIPTION
  },
  calixis: {
    label: "Флотские вахты",
    watches: CALIXIS_WATCHES,
    description: CALIXIS_DESCRIPTION
  },
  colchis: {
    label: "Колхидское времяисчисление (7 субдней, 170.4ч)",
    watches: COLCHIS_WATCHES,
    description: COLCHIS_DESCRIPTION
  }
});

/** Встроенный пресет + пользовательские (cfg.customPresets), по ключу. */
function presetRegistry(cfg = DEFAULT_CALENDAR_CONFIG) {
  const registry = { ...WATCH_PRESETS };
  for (const p of cfg.customPresets ?? []) if (p?.key && p.watches?.length) registry[p.key] = p;
  return registry;
}

/**
 * Индикаторы рядом с основными часами — ОДНА запись на каждый включённый
 * пресет (cfg.enabledPresets), каждая — отдельной строкой на виджете.
 * Использует тот же движок currentWatch (поддерживает и неравные вахты, и
 * длинные инопланетные сутки вроде колхидских), не зависит от основного
 * 24-часового деления, которое всегда фиксировано и сюда не входит.
 */
export function currentEnabledPhases(worldTime, cfg = DEFAULT_CALENDAR_CONFIG) {
  const registry = presetRegistry(cfg);
  const keys = cfg.enabledPresets?.length ? cfg.enabledPresets : DEFAULT_CALENDAR_CONFIG.enabledPresets;
  return keys
    .filter(key => registry[key])
    .map(key => ({
      key, label: registry[key].label,
      // GM-описание из настроек перекрывает дефолтное описание встроенного пресета.
      description: cfg.presetDescriptions?.[key] || registry[key].description || "",
      ...currentWatch(worldTime, { watches: registry[key].watches })
    }));
}
