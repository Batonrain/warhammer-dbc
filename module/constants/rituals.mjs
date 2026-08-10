// module/constants/rituals.mjs
// ════════════════════════════════════════════════════════════════════════
//  Ритуалы — движок проведения (не фиксированные из книги). Ритуалист сам
//  выбирает Навык, через который идёт ритуал (из своих реальных Навыков),
//  складывает модификаторы (Призыв/Проклятья/Ассистенты/Нумерология/PR),
//  и проходит тест. При провале — Отвращение Варпа / Феномен / Прорыв.
// ════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "./skills.mjs";
import { CHARACTERISTICS, SKILL_RANKS } from "./characteristics.mjs";

// Тип ритуала → вид «Цены Ошибки» по умолчанию.
export const RITUAL_TYPES = [
  { key: "summon",    label: "Призыв демона",       failure: "aversion" },
  { key: "dominion",  label: "Владычество/Подчинение", failure: "aversion" },
  { key: "binding",   label: "Связывание/Заточение", failure: "aversion" },
  { key: "exorcism",  label: "Экзорцизм/Изгнание",   failure: "phenomenon" },
  { key: "curse",     label: "Проклятье",            failure: "curse" },
  { key: "circle",    label: "Ритуальный круг",      failure: "none" },
  { key: "gate",      label: "Открытие врат/Завеса", failure: "aversion" },
  { key: "blessing",  label: "Тёмная молитва/Алхимия", failure: "phenomenon" },
  { key: "other",     label: "Прочее",               failure: "phenomenon" }
];
export const RITUAL_TYPES_MAP = Object.fromEntries(RITUAL_TYPES.map(t => [t.key, t]));

// Характеристика теста (Символизм → I, Вера → W, Геометрия → A и т.п.).
export const TEST_CHARS = [
  { key: "int", abbr: "I",  label: "Интеллект (символизм)" },
  { key: "wp",  abbr: "W",  label: "Сила Воли (вера)" },
  { key: "ag",  abbr: "A",  label: "Ловкость (геометрия)" },
  { key: "per", abbr: "P",  label: "Восприятие" },
  { key: "fel", abbr: "F",  label: "Товарищество" },
  { key: "inf", abbr: "Inf", label: "Влияние/Бесчестье" }
];

// Модификаторы Призыва демонов и Владычества (общая таблица).
export const RITUAL_SUMMON_MODS = [
  { key: "trueName",    label: "Знает Истинное Имя демона",                         value: 30 },
  { key: "mark",        label: "Имеет метку бога демона",                            value: 30 },
  { key: "sharesGoals", label: "Знает цели демона и разделяет их",                    value: 20 },
  { key: "patronage",   label: "Покровительство (но не метка) бога демона",           value: 20 },
  { key: "sympathy",    label: "Ритуал следует правилу симпатичности",                value: 10 },
  { key: "sacrifice",   label: "Запитан нужной жертвой, угодной демону",              value: 10 },
  { key: "artifact",    label: "Имеет артефакт, связанный с демоном",                 value: 10 },
  { key: "littleKnown", label: "Очень мало знает о призываемом демоне",               value: -10 },
  { key: "enemyMark",   label: "Покровительство/метка враждебного бога",              value: -20 },
  { key: "nothingKnown",label: "Ничего не знает о призываемом демоне",                value: -30 },
  { key: "recentEnemy", label: "Недавно призывал демонов враждебного бога",           value: -30 },
  { key: "falseKnow",   label: "Полностью ложные знания о демоне",                    value: -40 },
  { key: "failedBefore",label: "Уже проваливал вызов этого демона (он запомнил)",     value: -40 }
];

// Проклятья — Факторы Знакомства (выбор одного).
export const CURSE_FAMILIARITY = [
  { key: "never",    label: "Никогда не видел цель",                     value: -60 },
  { key: "fewTimes", label: "Видел цель только несколько раз",           value: -50 },
  { key: "talked",   label: "Общался с целью хотя бы раз",               value: -40 },
  { key: "dealings", label: "Вёл дела с целью несколько раз",            value: -30 },
  { key: "known",    label: "Знают друг друга",                          value: -20 },
  { key: "years",    label: "Знают друг друга много лет",                value: -10 },
  { key: "close",    label: "Очень близкие знакомые / заклятые враги",   value: 0 }
];

// Проклятья — Факторы Симпатии (несколько).
export const CURSE_SYMPATHY = [
  { key: "targetHome",   label: "Проводится в доме/базе цели",                       value: 30 },
  { key: "vitalOrgan",   label: "Фокус — глаз, сердце или конечность цели",           value: 30 },
  { key: "dearSacrifice",label: "Жертва — дорогой цели человек",                      value: 30 },
  { key: "meaningPlace", label: "Проводится в значимом для цели месте",               value: 20 },
  { key: "organ",        label: "Фокус — орган цели (палец, почка и т.п.)",           value: 20 },
  { key: "itemSacrifice",label: "Жертва — важный цели предмет",                       value: 20 },
  { key: "frequentPlace",label: "Проводится в часто посещаемом целью месте",          value: 10 },
  { key: "freshFocus",   label: "Фокус снят с тела цели не более суток назад",        value: 10 },
  { key: "wornItem",     label: "Жертва — предмет, что цель долго носила",            value: 10 }
];

// Нумерологические синергии (Исследования — памятка, бонус вводится вручную).
export const NUMEROLOGY = [
  { key: "numeric",   label: "Числовая Синергия (+20/5У)",      note: "Ритуал вдвое дольше; все тесты и броски можно перебрасывать." },
  { key: "geometric", label: "Геометрическая Синергия (+0/15У)", note: "Тест комбинируется с тем же тестом через A; при успехе Успехи ×1.5 (окр.▲)." },
  { key: "temporal",  label: "Темпоральная Синергия (−10/30У)", note: "До 20 дат с бонусом +5..+50 (годовщины/предначертанные)." },
  { key: "geomantic", label: "Геомантическая Синергия (−20/50У)", note: "До 5 мест с бонусом +5..+50 (чем выше — тем опаснее место)." }
];

// ── Отвращение Варпа (провал ритуалов призыва/манипуляции демонами) ──────
// total = 1d100 + модификатор (по +X за каждый Провал после первого, +PR-бонус).
export const WARP_AVERSION = [
  { min: 1,   max: 50,  key: "ignore",     name: "Игнорирование",
    text: "Тишина и гладь Варпа отвечают призывам Ритуалиста. Попытка провалилась, но не привлекла гнева обитателей Эмпиреев." },
  { min: 51,  max: 80,  key: "mockery",    name: "Насмешка",
    text: "Вой демонического хохота наполняет воздух, худшие кошмары устремляются в разум Ритуалиста. Он получает 1d5 Порчи.", corruption: "1d5" },
  { min: 81,  max: 90,  key: "smitten",    name: "Сражён",
    text: "Сырые энергии Варпа поражают тело и душу: попадание 2d10 E, Pen 2, Warp Weapon (нельзя Избегать, игнорирует силовые щиты) + 1d10 Порчи.",
    damage: "2d10", corruption: "1d10", veil: 1 },
  { min: 91,  max: 100, key: "assault",    name: "Нападение",
    text: "Низший демон по выбору ГМа манифестируется в центре ритуала в Истинной Форме, уничтожая круги. Враждебен и иммунен к Владычеству. Если ритуал был на призыв — приходит именно тот демон.",
    veil: 2 },
  { min: 101, max: 120, key: "possession", name: "Одержимость",
    text: "Случайный Герольд/Демон-Принц/Высший Демон манифестируется в Истинной Форме, нематериален (Incorporeal + Possession), игнорирует круги и атакует Ритуалиста Одержимостью. Не покидает помещение, кроме как в хосте.",
    veil: 3 },
  { min: 121, max: 9999, key: "consumed",  name: "Поглощён",
    text: "Реальность разрывается и челюсти Варпа смыкаются на Ритуалисте — он необратимо уничтожен, душа разорвана на вечные муки. Из дыры вываливается 5d10 случайных низших демонов, иммунных к Владычеству и враждебных всему живому.",
    veil: 4 }
];
export function lookupAversion(total) {
  return WARP_AVERSION.find(r => total >= r.min && total <= r.max) || WARP_AVERSION[0];
}

// Формы призыва (памятка длительности; за уровень Истончения — на ступень дольше).
export const SUMMON_FORMS = [
  { key: "trueForm", label: "Истинная Форма", dur: "1d10+2×W.b−Inf.b (мин. 2) Раундов",
    note: "Нестабильна; +1 уровень Завесы → Раунды>Минуты>Часы>Дни>Месяцы>∞. Чародейский сквозной щит 1-10." },
  { key: "vessel",   label: "Вселение (труп)", dur: "1d5+2×W.b−Inf.b (мин. 2) Дней",
    note: "Начинает с Ранами трупа; поглощает трупы для лечения. Плоть разрушается со временем." },
  { key: "host",     label: "Хост (живой)",   dur: "долговременно (атака Одержимости)",
    note: "Если W демона < W хоста — выброс через 1d10+2×W.b−Inf.b Раундов (Incorporeal 10−W.b мин)." }
];

// ── Доступные Навыки ритуалиста (ВСЕ — flat + групповые специализации) ───
// Ритуал сам диктует Навык; система знаний динамическая, поэтому не фильтруем.
export function buildRitualSkills(actor) {
  const out = [];
  const chars = actor?.system?.characteristics || {};
  const untr = (ck) => (chars[ck]?.total ?? 0) - 20;
  const rank = (r) => SKILL_RANKS[r ?? "untrained"]?.bonus ?? -20;

  for (const [key, def] of Object.entries(SKILLS_DEF)) {
    const sk = actor?.system?.skills?.[key];
    out.push({ value: `skill:${key}`, label: def.label,
      total: sk?.total ?? untr(def.char), char: def.char, rankBonus: rank(sk?.rank) });
  }
  for (const [gkey, gdef] of Object.entries(GROUP_SKILLS_DEF)) {
    const entries = Array.isArray(actor?.system?.groupSkills?.[gkey]) ? actor.system.groupSkills[gkey] : [];
    entries.forEach((e, idx) => {
      const spec = e.specialty || e.name || "—";
      out.push({ value: `group:${gkey}:${idx}`, label: `${gdef.label} (${spec})`,
        total: e.total ?? untr(e.char || gdef.char), char: e.char || gdef.char, rankBonus: rank(e.rank) });
    });
  }
  // Знания/оккультизм — вперёд, они чаще всего ведут ритуалы.
  const prio = /Запретные знания|Учёные знания|Ученые знания/;
  out.sort((a, b) => (prio.test(b.label) ? 1 : 0) - (prio.test(a.label) ? 1 : 0));
  return out;
}
export function ritualSkillOption(available, value) { return available.find(o => o.value === value) || null; }

// Степени успеха d100 vs target.
export function ritualDegrees(roll, target) {
  if (roll <= target) return 1 + Math.floor((target - roll) / 10);
  return -(1 + Math.floor((roll - target) / 10));
}

export function charAbbr(key) { return CHARACTERISTICS[key]?.abbr || key; }
