// module/rules/dreadnought.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПИЛОТ ДРЕДНОУТА — ядро без Foundry (Книга Машин, стр. 57-58).
//
//  Дредноут в системе уже есть: это актор техники (`vehicle`) класса «Дредноут»
//  с местами экипажа (`system.stations`). Место с ролью `pilot` хранит uuid
//  актора — вот эта ссылка и делает персонажа пилотом. Ничего нового заводить
//  не понадобилось: связь ровно та же, что у прочей техники, просто у Дредноута
//  из неё следует целая глава правил.
//
//  Отсюда растут три вещи:
//    1. Возможность `pilot.dreadnought` — её раздаёт источник правил, и на неё
//       опираются Требования двенадцати Талантов Дредноутов: книга даёт их
//       только пилоту, и проверять это должны данные, а не память ГМа.
//    2. Максимум Здравомыслия: 50 + 2×W.b, плюс 5 за каждый взятый Талант
//       «Ядро Воспоминаний» (его можно брать до I.b раз).
//    3. Пороги Безумия: 50 / 40 / 30 / 20 / 10 / 0, эффекты складываются.
//
//  Здесь только расчёт на голых данных. Поиск саркофага среди акторов мира и
//  выдача возможности — в module/rules/sources.mjs, там нужна живая игра.
// ════════════════════════════════════════════════════════════════════════════

/** Имя возможности, которую получает назначенный пилот. */
export const DREADNOUGHT_PILOT_FLAG = "pilot.dreadnought";

/**
 * Заключение в саркофаг (стр. 57) — тринадцать пунктов книги. Числовые собраны
 * здесь, остальные раздаются возможностями (sarcophagusFlags ниже): иммунитет
 * к Кровотечению не выражается числом, а «не может манифестировать психосилы» —
 * запрет, который должен уметь спросить код психосил.
 *
 * Правки живут НА ДРЕДНОУТЕ, а не на пилоте: саркофаг — часть машины, и когда
 * пилота вынут (или назначат другого), с ним не должно уехать ничего. По той же
 * причине это живой запрос, а не выданные предметы — тот же приём, каким
 * устроен верховой бой (module/rules/mount.mjs): числа считаются в момент
 * обращения, а связь хранит одна ссылка.
 */
export const SARCOPHAGUS = {
  armour: 30,             // Машина с AP 30 со всех сторон
  structure: 10,          // и 10 Структуры
  unnaturalS: -4,         // рейтинг Unnatural S уменьшается на 4
  unnaturalT: -2,         // Unnatural T — на 2
  woundsMax: -5,          // максимум Ран уменьшается на 5
  unnaturalW: 4,          // Трейт Unnatural W (+4)
  mindControlBonus: 30,   // +30 против изменения и контроля сознания
  poisonBonus: 30,        // +30 к тестам против ядов
  healEveryMinutes: 10,   // 1 Рана каждые 10 минут
  auspexRange: 450,       // ауспекс саркофага, м
  airHours: 4             // кислорода в амниотической жидкости при отказе СЖО
};

/**
 * Насколько реально уменьшатся рейтинги Сверхъестественного. Книга говорит
 * «уменьшает рейтинг на 4», а не «даёт −4»: у пилота без Сверхъестественной
 * Силы отнимать нечего, и отрицательного рейтинга не бывает.
 *
 * @param {{s?:number,t?:number}} ratings текущие рейтинги Unnatural
 */
export function sarcophagusCharDelta(ratings = {}) {
  // «|| 0» убирает минус ноль: без него у пилота без Сверхъестественной Силы
  // на листе стояло бы «−0», как это уже случалось с модификаторами броска.
  const cut = (have, by) => -Math.min(Math.max(0, Number(have) || 0), Math.abs(by)) || 0;
  return {
    s:  cut(ratings.s, SARCOPHAGUS.unnaturalS),
    t:  cut(ratings.t, SARCOPHAGUS.unnaturalT),
    wp: SARCOPHAGUS.unnaturalW
  };
}

/** Аблативные Раны только против варп-оружия: W.b, обновляются к концу боя. */
export function sarcophagusWarpWounds(wpBonus) {
  return Math.max(0, Number(wpBonus) || 0);
}

/** Возможности, которые даёт саркофаг. Имена — из constants/capabilities.mjs. */
export function sarcophagusFlags() {
  return [
    "sarcophagus.autoPassFear",
    "sarcophagus.immuneBleedingFatigue",
    "sarcophagus.noPsychicPowers",
    "sarcophagus.helpless",
    "sarcophagus.noFoodWaterAir",
    "sarcophagus.autoWakeFromStun",
    "sarcophagus.autoSenses"
  ];
}

/** Пороги Безумия по убыванию (стр. 57). Эффекты порогов складываются. */
export const MADNESS_THRESHOLDS = [50, 40, 30, 20, 10, 0];

const norm = (v) => String(v ?? "").trim().toLowerCase();

/**
 * Дредноут ли это. Судим по классу техники — так его называет книга и так он
 * записан в паке («Дредноут»). Тип актора проверяется тоже: персонаж с таким
 * словом в поле техники Дредноутом не становится.
 */
export function isDreadnought(actorData) {
  if (actorData?.type !== "vehicle") return false;
  return norm(actorData.system?.vehicleClass) === "дредноут";
}

/** uuid актора, назначенного пилотом, или пустая строка. */
export function pilotUuidOf(actorData) {
  const station = (actorData?.system?.stations || []).find(s => norm(s?.role) === "pilot");
  return String(station?.uuid || "");
}

/**
 * Саркофаг, в который заключён этот актор, или null.
 *
 * @param {string} actorUuid  кого ищем
 * @param {Iterable} vehicles среди чего ищем (акторы мира)
 */
export function dreadnoughtOf(actorUuid, vehicles) {
  const want = String(actorUuid || "");
  // Пустой uuid не совпадает с пустым местом экипажа: иначе КАЖДЫЙ актор
  // оказался бы пилотом любого Дредноута без назначенного пилота.
  if (!want) return null;
  for (const v of vehicles || []) {
    if (!isDreadnought(v)) continue;
    if (pilotUuidOf(v) === want) return v;
  }
  return null;
}

/** Короткий вопрос «он пилот Дредноута?». */
export function isDreadnoughtPilot(actorUuid, vehicles) {
  return !!dreadnoughtOf(actorUuid, vehicles);
}

/**
 * Максимум Здравомыслия: 50 + 2×W.b (стр. 57).
 *
 * `coreMemories` — сколько раз взят Талант «Ядро Воспоминаний» (+5 за каждый,
 * стр. 58). Отрицательный бонус Воли ниже базовых 50 не уводит: книга задаёт
 * прибавку, а не вычитание.
 */
export function sanityMax(wpBonus, coreMemories = 0) {
  const base = 50 + Math.max(0, Number(wpBonus) || 0) * 2;
  return base + Math.max(0, Number(coreMemories) || 0) * 5;
}

/**
 * Какие пороги Безумия сработали при этом Здравомыслии. Возвращает список
 * порогов по убыванию строгости — эффекты складываются, поэтому вызывающий
 * применяет все сразу, а не только последний.
 */
export function madnessLevels(sanity) {
  const s = Number(sanity);
  const value = Number.isFinite(s) ? s : 0;
  return MADNESS_THRESHOLDS.filter(t => value <= t);
}

/**
 * Порог урона по Дредноуту, при котором ранит и пилота: ½W.b пилота, окр.▲
 * (стр. 57). Считается от пилота, а не от машины — резонанс саркофага зависит
 * от того, кто внутри, а не от корпуса.
 */
export function pilotDamageThreshold(pilotWpBonus) {
  return Math.ceil(Math.max(0, Number(pilotWpBonus) || 0) / 2);
}

/**
 * Четыре Таланта Дредноутов (стр. 58), чьё выполненное условие даёт разовое
 * восстановление 2d10 Здравомыслия за 1 Очко Бесчестия. `match` узнаёт Талант
 * на листе тем же приёмом, что и «Ядро Воспоминаний» выше; `hint` — короткая
 * памятка об условии, само условие книга не проверяет автоматически (решает
 * стол), код лишь считает трату и бросок.
 */
export const SANITY_RECOVERY_TALENTS = [
  { key: "cruelty",     label: "Жестокость",    match: /Cruelty|Жестокость \(Дредноут\)/i,
    hint: "добита конечность атакой" },
  { key: "endurance",   label: "Превозмогание", match: /Endurance|Превозмогание/i,
    hint: "3-й непоглощённый урон с прошлого Хода" },
  { key: "superiority", label: "Превосходство", match: /Superiority|Превосходство/i,
    hint: "победа нечестным приёмом" },
  { key: "triumph",     label: "Триумф",        match: /Triumph|Триумф/i,
    hint: "добит сильный противник" }
];

/** Какие из четырёх Талантов восстановления есть у актора (по предметам на листе). */
export function sanityRecoveryTalentsOf(items) {
  return SANITY_RECOVERY_TALENTS.filter(t =>
    (items || []).some(i => i?.type === "talent" && t.match.test(i.name)));
}

/**
 * Суточный тест бодрствования (стр. 57): W+0, без модификаторов — саркофаг
 * снимает обычные основания для их учёта (усталость/шлем и т.п. пилоту, по
 * сути, больше не аргумент). При Провале число его Провалов книга ПРЯМО
 * называет потерей Здравомыслия — выбора тут нет, поэтому кнопка листа может
 * применить результат сама, без диалога с причиной (в отличие от «±»).
 *
 * @param {number} roll     результат 1d100
 * @param {number} wpTotal  W пилота (не W.b) — порог теста
 */
export function dailyWillTestOutcome(roll, wpTotal) {
  const eff = Math.max(0, Number(wpTotal) || 0);
  const rv = Number(roll) || 0;
  const success = rv <= eff;
  const degrees = Math.floor(Math.abs(success ? eff - rv : rv - eff) / 10) + 1;
  return { success, degrees, sanityLoss: success ? 0 : degrees };
}

/** Узнаём снаряжение «Электростимуляторы» (стр. 58) среди предметов Дредноута. */
const ELECTROSTIM_MATCH = /Electrostimulator|Электростимулятор/i;
export function hasElectrostimulators(vehicleItems) {
  return (vehicleItems || []).some(i => i?.type === "vehicleGear" && ELECTROSTIM_MATCH.test(i.name));
}

/**
 * Электростимуляторы (стр. 58): разовое +10+2×W.b Здравомыслия за свободное
 * действие. Отката по таймеру в системе нет (тикающего хука нет нигде в
 * кодовой базе — тот же случай, что и Пост-эффект Препаратов в drugs.mjs):
 * кнопка листа лишь считает числа, откат жмут вручную, когда сочтут, что
 * 2×W.b минут истекли.
 */
export function electrostimulatorBoost(pilotWpBonus) {
  const wp = Math.max(0, Number(pilotWpBonus) || 0);
  return { amount: 10 + 2 * wp, delayMinutes: 2 * wp };
}

/**
 * Узнаём «Матрицу Осирис» (стр. 58) среди снаряжения Дредноута: снимает
 * запрет sarcophagus.noPsychicPowers (пилот может манифестировать и
 * поддерживать психосилы). Штраф −3 к тПР, которым книга платит за это, —
 * отдельный числовой эффект самого предмета, не читатель этой возможности,
 * и здесь не считается.
 */
const OSIRIS_MATRIX_MATCH = /Osiris Matrix|Матрица Осирис/i;
export function hasOsirisMatrix(vehicleItems) {
  return (vehicleItems || []).some(i => i?.type === "vehicleGear" && OSIRIS_MATRIX_MATCH.test(i.name));
}

/** Узнаём Талант «Ферум Инфернус» (стр. 58) среди предметов пилота. */
const FERUM_INFERNUS_MATCH = /Ferum Infernus|Ферум Инфернус/i;
export function hasFerumInfernus(items) {
  return (items || []).some(i => i?.type === "talent" && FERUM_INFERNUS_MATCH.test(i.name));
}

/**
 * Порог «Ферум Инфернус»: ½Inf+5 (стр. 58). Книга не оговаривает округление
 * половины отдельно для этой формулы, но округляет вверх для всех соседних
 * «½X» этой же главы — та же конвенция принята и здесь.
 */
export function ferumInfernusThreshold(infTotal) {
  return Math.ceil(Math.max(0, Number(infTotal) || 0) / 2) + 5;
}

/** Активна ли пассивка сейчас: Здравомыслие СТРОГО ниже порога. */
export function ferumInfernusActive(sanityValue, infTotal) {
  return (Number(sanityValue) || 0) < ferumInfernusThreshold(infTotal);
}
