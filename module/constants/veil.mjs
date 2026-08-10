// module/constants/veil.mjs
// ════════════════════════════════════════════════════════════════════════
//  Завеса (Истончение Завесы) — глобальная механика, проецируемая на сцену.
//  Базовая завеса 0; факторы, события Варпа (феномены/прорывы) и ритуалы
//  меняют Истончение. Отрицательное — завеса плотнее (демонам плохо),
//  положительное — истончена (демонам легче удерживаться).
// ════════════════════════════════════════════════════════════════════════

// Факторы истончения (таблица правил). value — вклад в Истончение.
// group — взаимоисключающие варианты (демонический мир: только один уровень).
export const VEIL_FACTORS = [
  { key: "consecrated",    label: "Освящённая земля (собор, санктум Кузницы, реликварий, храм ксено-религии)", value: -2 },
  { key: "shrineWorld",    label: "Мир-святыня", value: -1 },
  { key: "massDeath",      label: "Место массовой смерти в недавнем прошлом", value: 1 },
  { key: "activeWar",      label: "Активная война (тысячи жертв ежедневно на планете)", value: 1 },
  { key: "strongEmotion",  label: "Место резонирует с сильными эмоциями", value: 1 },
  { key: "keyEmotion",     label: "Место резонирует с ключевой эмоцией демона", value: 2 },
  { key: "warpStorm",      label: "Внутри варп-шторма или рядом с варп-рифтом", value: 2 },
  { key: "daemonStable",   label: "Демонический мир (стабильный)", value: 2, group: "daemonWorld" },
  { key: "daemonSemi",     label: "Демонический мир (полу-инфернальный)", value: 3, group: "daemonWorld" },
  { key: "daemonInfernal", label: "Демонический мир (инфернальный)", value: 4, group: "daemonWorld" }
];

// Быстрые события Варпа, сдвигающие завесу. Дельты — дизайнерские (в правилах
// не квантованы): всплеск варп-активности истончает завесу, освящение уплотняет.
export const VEIL_EVENTS = [
  { key: "consecrate",  label: "Освящение места",           delta: -2, icon: "✚" },
  { key: "banish",      label: "Изгнание демона / очищение", delta: -1, icon: "◈" },
  { key: "phenomenon",  label: "Психический Феномен",         delta:  1, icon: "✦" },
  { key: "breach",      label: "Варп-Прорыв",                delta:  1, icon: "✧" },
  { key: "veilTear",    label: "Разрыв Завесы (прорыв)",      delta:  2, icon: "✺" },
  { key: "greatComing", label: "Великое Пришествие",          delta:  3, icon: "❂" }
];

// Пантеон Тёмных богов: цвет свечения, сигил (PNG в assets), подпись. Общий
// источник для варп-оверлея и выбора «прорыва Бога» в окне.
export const WARP_GODS = [
  { key: "undivided", label: "Неделимый", color: "#b477ff", glow: "rgba(180,119,255,0.9)", sigil: "Chaos" },
  { key: "khorne",    label: "Кхорн",     color: "#e0202e", glow: "rgba(224,32,46,0.9)",   sigil: "Khorne" },
  { key: "nurgle",    label: "Нургл",     color: "#8fbf3a", glow: "rgba(150,200,70,0.85)", sigil: "Nurgle" },
  { key: "tzeentch",  label: "Тзинч",     color: "#33a6ff", glow: "rgba(60,175,255,0.9)",  sigil: "Tzeentch" },
  { key: "slaanesh",  label: "Слаанеш",   color: "#e85ad6", glow: "rgba(232,90,214,0.9)",  sigil: "Slaanesh" }
];
export const WARP_GODS_MAP = Object.fromEntries(WARP_GODS.map(g => [g.key, g]));
export function warpGod(key) { return WARP_GODS_MAP[key] || null; }

// Значение по умолчанию для сцены.
export function defaultVeil() {
  const factors = {};
  for (const f of VEIL_FACTORS) factors[f.key] = false;
  return { base: 0, factors, manual: 0, god: "", rituals: [], log: [] };
}

// Суммарное Истончение из состояния завесы.
export function veilTotal(v) {
  if (!v) return 0;
  let t = Number(v.base) || 0;
  t += Number(v.manual) || 0;
  for (const f of VEIL_FACTORS) if (v.factors?.[f.key]) t += f.value;
  for (const r of (v.rituals || [])) if (r.active) t += Number(r.delta) || 0;
  return t;
}

// Информация об уровне завесы: подпись, ярус, класс анимации, последствия.
export function veilLevelInfo(total) {
  let tier, label;
  if (total <= -3)      { tier = "sacred";   label = "Освящённая — почти монолит"; }
  else if (total < 0)   { tier = "dense";    label = "Уплотнённая"; }
  else if (total === 0) { tier = "stable";   label = "Стабильная (базовая)"; }
  else if (total <= 2)  { tier = "thin";     label = "Истончённая"; }
  else if (total <= 4)  { tier = "torn";     label = "Прорывающаяся"; }
  else                  { tier = "infernal"; label = "Инфернальная"; }

  let consequence;
  if (total < 0) {
    consequence = "Завеса плотнее. Демоны проходят тесты Нестабильности при любом действии "
      + "(не только при уроне) и игнорируют эффекты авто-прохождения Нестабильности. Демоны в Истинной "
      + "Форме не могут добровольно войти сюда — словно упираются в невидимую стену — и мгновенно изгоняются, "
      + "попав против воли.";
  } else if (total === 0) {
    consequence = "Базовая плотность завесы. Демоны удерживаются в реальности как обычно.";
  } else {
    consequence = "Завеса истончена: демонам легче удерживаться в Материуме. Призыв, одержимость и "
      + "воплощение облегчены, изгнание затруднено; варп-феномены проявляются острее.";
  }
  return { tier, label, consequence };
}

// Влияние завесы на навигацию по Варпу (турбулентность). Модификатор к тесту
// Навигации: истончённая завеса = бурный Варп = сложнее.
export function veilNavMod(total) {
  if (total >= 4) return -30;
  if (total >= 2) return -20;
  if (total >= 1) return -10;
  if (total <= -2) return 10;
  if (total < 0)  return 5;
  return 0;
}
