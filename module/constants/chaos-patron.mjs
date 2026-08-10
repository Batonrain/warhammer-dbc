// module/constants/chaos-patron.mjs
// ════════════════════════════════════════════════════════════════════════
//  Бог-покровитель Хаосита: палитра листа + сдвиг тона переиспользуемых
//  вкладок (как у Демон-Принца). Неделимый — тёмная бронза/коричневый мрак.
//  Иконки — PNG-сигилы из assets. hue/sat/bright — фильтр для когитаторных
//  вкладок (зелёный #4dffa6 → цвет Бога).
//  star — БАЗОВЫЙ (до-фильтровый) цвет сигила-водяного знака в шапке. Шапка
//  целиком крутится тем же hue-rotate'ом, поэтому знак нельзя красить в готовый
//  цвет: его красят в «когитаторную зелень», которую фильтр САМ доводит до цвета
//  Бога (как всю остальную зелень шапки). Для Неделимого фильтр из зелени даёт
//  бронзу, а нужен кровавый красный — поэтому подаём чистую зелень (hue 120),
//  которую hue(-120) разворачивает в тёмно-красный. sigilSize — высота маски
//  (%) относительно шапки: у «толстых» сигилов (Кхорн/Нургл) меньше, чтобы не
//  распухали.
// ════════════════════════════════════════════════════════════════════════

const ASSET = (n) => `systems/warhammer-dbc/assets/${n}.png`;

export const CHAOS_PATRONS = [
  { key: "undivided", label: "Неделимый", gen: "Хаоса Неделимого", sigil: ASSET("Chaos"),
    color: "#b5905a", gc2: "#5a4326", glow: "rgba(181,144,90,0.7)", star: "#1aff1a", sigilSize: "150%",
    hue: "-120deg", sat: "0.5", bright: "0.92" },
  { key: "khorne", label: "Кхорн", gen: "Кхорна", sigil: ASSET("Khorne"),
    color: "#e0202e", gc2: "#7a1518", glow: "rgba(224,32,46,0.85)", star: "#4dffa6", sigilSize: "100%",
    hue: "206deg", sat: "1.05", bright: "1" },
  { key: "nurgle", label: "Нургл", gen: "Нургла", sigil: ASSET("Nurgle"),
    color: "#8fbf3a", gc2: "#4a5a20", glow: "rgba(150,200,70,0.8)", star: "#4dffa6", sigilSize: "105%",
    hue: "-79deg", sat: "0.95", bright: "1" },
  { key: "tzeentch", label: "Тзинч", gen: "Тзинча", sigil: ASSET("Tzeentch"),
    color: "#33a6ff", gc2: "#2456a0", glow: "rgba(60,175,255,0.85)", star: "#4dffa6", sigilSize: "120%",
    hue: "51deg", sat: "1", bright: "1.05" },
  { key: "slaanesh", label: "Слаанеш", gen: "Слаанеш", sigil: ASSET("Slaanesh"),
    color: "#e85ad6", gc2: "#7a2e6a", glow: "rgba(232,90,214,0.85)", star: "#4dffa6", sigilSize: "120%",
    hue: "158deg", sat: "1", bright: "1" }
];

export const CHAOS_PATRONS_MAP = Object.fromEntries(CHAOS_PATRONS.map(p => [p.key, p]));

export function chaosPatronMeta(key) { return CHAOS_PATRONS_MAP[key] || CHAOS_PATRONS_MAP.undivided; }
