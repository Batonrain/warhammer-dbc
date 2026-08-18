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
