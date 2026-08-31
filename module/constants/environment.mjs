// module/constants/environment.mjs
// ════════════════════════════════════════════════════════════════════════
//  Окружающая среда сцены (корбук «Опасности», стр. 483-484).
//  Параметры: Погода (флавор) · Температура (Жара/Холод) · Гравитация ·
//  Радиация. Хранится во флаге сцены warhammer-dbc.env; ГМ правит в окне,
//  игроки видят только виджет. Помощники возвращают и подпись, и механику
//  (модификатор теста T + частота), чтобы виджет/окно были едины с правилами.
// ════════════════════════════════════════════════════════════════════════

// ── «Обстановка»: погода планеты + позиция/реальность корабля-в-пустоте.
//    grp: planet → в виджете подпись «ПОГОДА»; void → «ЛОКАЦИЯ». В корбуке
//    жёсткой таблицы нет — это флавор, задающий настроение сцены. ──────────
export const WEATHER = [
  // Планета — погода
  { key: "clear",     grp: "planet", label: "Ясно",              icon: "☀",  tone: "#ffd98a" },
  { key: "clouds",    grp: "planet", label: "Облачно",           icon: "☁",  tone: "#b8c6d0" },
  { key: "rain",      grp: "planet", label: "Дождь",             icon: "🌧", tone: "#6fa8d0" },
  { key: "storm",     grp: "planet", label: "Гроза",             icon: "⛈", tone: "#8ab0e0" },
  { key: "snow",      grp: "planet", label: "Снег / метель",     icon: "❄",  tone: "#cfe8ff" },
  { key: "fog",       grp: "planet", label: "Туман",             icon: "🌫", tone: "#a8b4bc" },
  { key: "wind",      grp: "planet", label: "Шквальный ветер",   icon: "💨", tone: "#bfe0d0" },
  { key: "heat",      grp: "planet", label: "Зной",              icon: "🔥", tone: "#ff8a5a" },
  { key: "ash",       grp: "planet", label: "Пепельная буря",    icon: "🌋", tone: "#c08a6a" },
  { key: "acid",      grp: "planet", label: "Кислотный дождь",   icon: "☣",  tone: "#9fd13f" },
  { key: "toxic",     grp: "planet", label: "Токсичный смог",    icon: "🏭", tone: "#b6c04a" },
  { key: "radstorm",  grp: "planet", label: "Радиационная буря", icon: "☢",  tone: "#e8e04a" },
  // Корабль / пустота — позиция и реальность
  { key: "shipnorm",  grp: "void", label: "Отсеки корабля",       icon: "🚀", tone: "#7fbf9c" },
  { key: "materium",  grp: "void", label: "В Материуме",          icon: "✦",  tone: "#6fa8d0" },
  { key: "orbit",     grp: "void", label: "На орбите",            icon: "🛰", tone: "#8ab0e0" },
  { key: "void",      grp: "void", label: "Открытый космос",      icon: "🌌", tone: "#6a7fb0" },
  { key: "translation", grp: "void", label: "Варп-переход",       icon: "🌀", tone: "#b477ff" },
  { key: "warp",      grp: "void", label: "В Варпе",              icon: "🕳", tone: "#9a5aff" },
  { key: "warpstorm", grp: "void", label: "Варп-шторм",           icon: "🌀", tone: "#e05aff" },
  { key: "gellar",    grp: "void", label: "Сбой Гелларова поля",  icon: "⚡", tone: "#ff5a5a" },
  { key: "breach",    grp: "void", label: "Разгерметизация",      icon: "💨", tone: "#ff8a5a" }
];
export const WEATHER_MAP = Object.fromEntries(WEATHER.map(w => [w.key, w]));
export function weatherMeta(key) { return WEATHER_MAP[key] || WEATHER_MAP.clear; }
export const WEATHER_GROUPS = [
  { grp: "planet", label: "Планета — погода" },
  { grp: "void",   label: "Корабль / пустота — позиция" }
];
// Подпись строки виджета: планета → «Погода», пустота/корабль → «Локация».
export function weatherRowLabel(key) { return weatherMeta(key).grp === "void" ? "Локация" : "Погода"; }

// ── Температура: Жара (корбук стр. 483) + симметричная шкала Холода ────────
// Жара — точная таблица книги. Холод — «по усмотрению ГМа» (значения дизайнер-
// ские, зеркалят суровость жары). test — модификатор к тесту T (порог), freq —
// как часто тест; tone — цвет индикатора; kind — hot|cold|ok.
const HEAT_TABLE = [
  { min: 65, kind: "hot", test: -20, freq: "каждый Ход",     label: "Внутри горящего здания" },
  { min: 60, kind: "hot", test: -15, freq: "каждую минуту",  label: "Улица горящего города" },
  { min: 55, kind: "hot", test: -10, freq: "раз в 5 минут",  label: "Над рекой магмы" },
  { min: 50, kind: "hot", test:  -5, freq: "раз в 30 минут", label: "Дневная зона синхронного мира" },
  { min: 45, kind: "hot", test:   0, freq: "каждый час",     label: "Литейный мануфакторум" },
  { min: 40, kind: "hot", test:   5, freq: "раз в 2 часа",   label: "Пустынный зной" },
  { min: 35, kind: "hot", test:  10, freq: "раз в 4 часа",   label: "Тепловая волна" },
  { min: 30, kind: "hot", test:  15, freq: "раз в 8 часов",  label: "Жаркий день без тени" }
];
const COLD_TABLE = [
  { max: -40, kind: "cold", test: -20, freq: "каждый Ход",     label: "Криоген / открытый космос" },
  { max: -30, kind: "cold", test: -15, freq: "каждую минуту",  label: "Полярная ночь ледяного мира" },
  { max: -20, kind: "cold", test: -10, freq: "раз в 5 минут",  label: "Лютый мороз, буран" },
  { max: -10, kind: "cold", test:  -5, freq: "раз в 30 минут", label: "Сильный мороз" },
  { max:   0, kind: "cold", test:   0, freq: "каждый час",     label: "Мороз" },
  { max:  10, kind: "cold", test:  10, freq: "раз в 8 часов",  label: "Пронизывающий холод" }
];

export function tempEffect(t) {
  const c = Number(t);
  for (const row of HEAT_TABLE) if (c >= row.min) return { ...row, active: true };
  for (const row of COLD_TABLE) if (c <= row.max) return { ...row, active: true };
  return { kind: "ok", test: null, freq: "", label: "Комфортная зона", active: false };
}
// Цвет по температуре (плавный: синий холод → бирюза норма → красный жар).
export function tempTone(t) {
  const c = Number(t);
  if (c >= 55) return "#ff4d3a";
  if (c >= 40) return "#ff8a3a";
  if (c >= 28) return "#ffcf5a";
  if (c >= 5)  return "#5affc0";
  if (c >= -15) return "#5ac8ff";
  return "#a0d8ff";
}

// ── Гравитация (корбук стр. 484): Высокая / Низкая / Невесомость ───────────
export function gravityEffect(g) {
  const G = Number(g);
  if (G <= 0) return {
    kind: "zero", label: "Невесомость",
    note: "Нет лимита нагрузки; движение только отталкиванием. Отдача и рукопашная вращают персонажа — тест Trade(Voidfarer). Маг-сапоги/сопла снимают трудности.",
    tone: "#b477ff"
  };
  if (G < 1) {
    const noRun = G <= 0.6;
    // Trade(Voidfarer) помогает при 0.6/0.5/0.4/0.3/0.2 → +0/+10/+20/+30
    return {
      kind: "low", label: `Низкая гравитация ${G}G`,
      note: `Вес снаряжения ×${G.toFixed(1)}; персонаж легче на своё тело ×(1−${G.toFixed(1)}). Прыжки/метание — дальше, урон от падения — меньше.${noRun ? " ≤0.6G: нельзя Бежать без Trade(Voidfarer)." : ""}`,
      tone: "#7fd0ff"
    };
  }
  if (G > 1) return {
    kind: "high", label: `Высокая гравитация ${G}G`,
    note: `Вес всего снаряжения ×${G.toFixed(1)}; доп. груз = вес тела ×(${G.toFixed(1)}−1). Прыжки/метание — короче, урон от падения — выше. Если вес тела ×1G > веса подъёма — движение только медленно.`,
    tone: "#ff9a6a"
  };
  return { kind: "norm", label: "Нормальная (1G)", note: "Стандартная гравитация — штрафов нет.", tone: "#8fe0b0" };
}

// ── Радиация (корбук стр. 484): интенсивность 1-10 + защита ────────────────
export const RAD_TABLE = [
  { lvl: 1,  freq: "раз в 8 часов",  label: "Окрестности вулкана / глубокие шахты" },
  { lvl: 2,  freq: "раз в 4 часа",   label: "Индустриальная зона улья / кузницы" },
  { lvl: 3,  freq: "раз в 2 часа",   label: "Внутри шахты / обогатительной фабрики" },
  { lvl: 4,  freq: "каждый час",     label: "Пустоши мира-улья / мира-кузницы" },
  { lvl: 5,  freq: "раз в 30 минут", label: "Свалки отходов, открытый космос" },
  { lvl: 6,  freq: "раз в 15 минут", label: "Зона выброса после ядерного взрыва" },
  { lvl: 7,  freq: "раз в 5 минут",  label: "Радиоактивные осадки, выброс реактора" },
  { lvl: 8,  freq: "каждую минуту",  label: "Открытое ядро реактора / варп-двигателя" },
  { lvl: 9,  freq: "раз в Ход",      label: "Вблизи ядра реактора / варп-двигателя" },
  { lvl: 10, freq: "5 в Ход",        label: "Внутри реактора / заправка варп-двигателя" }
];
export const RAD_PROTECTION = [
  { label: "Закрытая броня / костюм хим-защиты", val: "−1" },
  { label: "Пустотная броня / костюм рад-защиты", val: "−2" },
  { label: "Силовая броня",                       val: "−1" },
  { label: "Терминаторская броня",                val: "Иммунитет" },
  { label: "Трейт Machine",                       val: "−1" },
  { label: "Работающий Меланохром (геносемя)",    val: "−1" },
  { label: "Трейт Stuff of Nightmares",           val: "Иммунитет" },
  { label: "Внутри жестяного здания",             val: "−1" },
  { label: "Внутри рокритового здания",           val: "−2" },
  { label: "Внутри бункера / пещеры",             val: "−3" },
  { label: "Внутри радиационного бункера",        val: "Иммунитет" }
];
export function radEffect(lvl) {
  const l = Math.max(0, Math.min(10, Math.round(Number(lvl) || 0)));
  if (l <= 0) return { lvl: 0, label: "Фон в норме", freq: "", active: false, tone: "#8fe0b0" };
  const row = RAD_TABLE.find(r => r.lvl === l) || RAD_TABLE[RAD_TABLE.length - 1];
  // Цвет усиливается с уровнем (зелёный → жёлтый → оранжевый → красный).
  const tone = l >= 8 ? "#ff3a3a" : l >= 6 ? "#ff7a2a" : l >= 4 ? "#ffd23a" : "#b6e04a";
  return { ...row, active: true, tone };
}

// ── Состояние сцены: чтение/запись ────────────────────────────────────────
export function defaultEnv() {
  return { weather: "clear", weatherText: "", temp: 20, gravity: 1, rad: 0, note: "" };
}
export function normalizeEnv(raw) {
  const d = defaultEnv();
  if (!raw) return d;
  return {
    weather:     raw.weather || d.weather,
    weatherText: raw.weatherText || "",
    temp:        Number.isFinite(Number(raw.temp)) ? Number(raw.temp) : d.temp,
    gravity:     Number.isFinite(Number(raw.gravity)) ? Number(raw.gravity) : d.gravity,
    rad:         Math.max(0, Math.min(10, Math.round(Number(raw.rad) || 0))),
    note:        raw.note || ""
  };
}
// Полный «вид» окружения — единый источник для окна и виджета. Принимает уже
// нормализованный env (резолвится группо-осознанно вызывающим — см. Нексус).
export function envView(e) {
  const w = weatherMeta(e.weather);
  const temp = tempEffect(e.temp);
  const grav = gravityEffect(e.gravity);
  const rad  = radEffect(e.rad);
  const testSigned = temp.test == null ? "" : (temp.test >= 0 ? `+${temp.test}` : `${temp.test}`);
  return {
    raw: e,
    weather: { key: e.weather, label: e.weatherText || w.label, icon: w.icon, tone: w.tone, custom: !!e.weatherText, grp: w.grp, rowLabel: weatherRowLabel(e.weather) },
    temp: { value: e.temp, tone: tempTone(e.temp), testSigned, ...temp },
    gravity: { value: e.gravity, ...grav },
    rad: { value: e.rad, ...rad },
    note: e.note
  };
}
