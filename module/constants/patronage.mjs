// module/constants/patronage.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Покровительство — АЛЬТЕРНАТИВНАЯ система цены Продвижения (корбук,
//  «ОПЫТ и СТАРТОВОЕ СНАРЯЖЕНИЕ», стр. 23-24), рядом со Склонностями
//  (advancement.mjs). Плюс Смешанная система (комбинация обеих, «СКЛОННОСТИ»,
//  конец страницы). Режим выбирает ГМ настройкой мира или переопределяет
//  отдельному персонажу — см. effectivePricingMode().
// ════════════════════════════════════════════════════════════════════════════

import { TALENT_LIBRARY } from "./talents-library.mjs";

export const SYSTEM_ID = "warhammer-dbc";

export const PRICING_MODES = {
  aptitude:  "Склонности",
  patronage: "Покровительство",
  mixed:     "Смешанная"
};

// ── Матрица отношений Богов (стр. 23) ────────────────────────────────────────
// Слаанеш↔Кхорн и Нургл↔Тзинч — Враждебные пары (крест-накрест). Бог сам к
// себе — Союзный. Неделимый (в т.ч. персонаж без patronGod вовсе — не-Хаосит)
// со всеми, включая другого Неделимого, — Нейтрален: в таблице книги строка/
// столбец «Недел.» сплошь Нейтральные, это НЕ «Союзный сам с собой».
const ENEMY_GOD_PAIRS = [["khorne", "slaanesh"], ["nurgle", "tzeentch"]];

export function godRelationCat(a, b) {
  const ka = a || "undivided", kb = b || "undivided";
  if (ka === "undivided" || kb === "undivided") return "neutral";
  if (ka === kb) return "ally";
  if (ENEMY_GOD_PAIRS.some(([x, y]) => (ka === x && kb === y) || (ka === y && kb === x))) return "enemy";
  return "neutral";
}

// ── Навыки: у каждого — свой прямой Бог (корбук, «III. ПРОДВИЖЕНИЕ» →
//    «НАВЫКИ»). Common Lore/Trade — «Всегда Дружественный» независимо от
//    Покровителя: это уже флаг alwaysAlly в GROUP_SKILLS_DEF (skills.mjs),
//    здесь для них Бог не нужен, не дублируем.
export const SKILL_GOD = {
  acrobatics: "slaanesh", athletics: "khorne", awareness: "undivided", charm: "slaanesh",
  command: "khorne", commerce: "undivided", deceive: "slaanesh", dodge: "slaanesh",
  forbiddenLore: "tzeentch", inquiry: "undivided", interrogate: "undivided",
  intimidate: "nurgle", linguistics: "undivided", logic: "tzeentch", medicae: "nurgle",
  navigation: "undivided", operate: "undivided", parry: "khorne", psyniscience: "tzeentch",
  scholasticLore: "undivided", scrutiny: "tzeentch", security: "undivided",
  sleightOfHand: "undivided", stealth: "undivided", survival: "nurgle", techUse: "undivided"
};

// Исключение: специализация Forbidden Lore «Heresy» — Нургл, а не Тзинч,
// как остальная группа (книга отмечает это явно у самой специализации).
const SKILL_SPECIALTY_GOD_OVERRIDE = {
  forbiddenLore: { heresy: "nurgle" }
};

/** Бог Навыка (или его специализации) — ключ для godRelationCat(), или null,
 * если Навык «Всегда Дружественный» (Бог не участвует, см. alwaysAlly). */
export function skillGodOf(skillKey, specialty = "") {
  const override = SKILL_SPECIALTY_GOD_OVERRIDE[skillKey]?.[String(specialty || "").toLowerCase()];
  if (override) return override;
  return SKILL_GOD[skillKey] ?? null;
}

/** Категория цены Навыка по Покровительству. alwaysAlly (Common Lore/Trade,
 * Родной мир и культура) читает вызывающий код отдельно, как и у Склонностей —
 * здесь только чистое отношение Бог Навыка ↔ Бог персонажа. */
export function skillPatronCat(skillKey, specialty, patronGod) {
  const god = skillGodOf(skillKey, specialty);
  return god ? godRelationCat(patronGod, god) : "ally";
}

// ── Таланты: Бог — русской подписью в system.god, переводим в ключ
//    godRelationCat(). Таланты без записи (Элитные Архетипы, руками заведённые
//    ГМом) — Нейтрально, тем же правилом, что у них уже есть для Склонностей
//    (стр. 24).
//
//    Источник — СНАЧАЛА собранный компендиум warhammer-dbc.talents (пак —
//    единственная полная картина, TALENT_LIBRARY отстаёт от него на сотни
//    записей новых книг, см. wdbc-h59i), ПОТОМ константа как запасной путь,
//    когда пак ещё не собран/не готов. Вызывающая цепочка
//    (talentCostXP ← resolveTalentCat, живёт в синхронном рендере листа —
//    цену Таланта нельзя посчитать за await) не может ждать pack.getIndex(),
//    поэтому индекс строится ЗАРАНЕЕ и кэшируется — тот же приём, что
//    _equipIndex в apps/mechanics.mjs (initEquipmentIndex).
const TALENT_GOD_LABEL_KEY = {
  "слаанеш": "slaanesh", "нургл": "nurgle", "кхорн": "khorne", "тзинч": "tzeentch",
  "неделимый": "undivided"
};
const TALENT_PACK_ID = "warhammer-dbc.talents";

let _talentGodByName = null; // null = ещё не строился
let _eliteTalentNames = null; // имена Талантов Элитных Архетипов, строится вместе с Богами

// Талант Элитного Архетипа помечен в «Специализации»: «Элитный архетип: Архимаг».
const ELITE_SPECIALIZATION = /^\s*Элитный архетип:/i;
const isEliteSpecialization = (spec) => ELITE_SPECIALIZATION.test(String(spec ?? ""));

function fallbackTalentGodIndex() {
  return new Map(TALENT_LIBRARY.map(t => [t.name, t.system?.god || ""]));
}
function fallbackEliteTalentNames() {
  return new Set(TALENT_LIBRARY.filter(t => isEliteSpecialization(t.system?.specialization)).map(t => t.name));
}

export async function refreshTalentGodIndex() {
  const pack = (typeof game !== "undefined") ? game.packs?.get?.(TALENT_PACK_ID) : null;
  if (!pack) { _talentGodByName = fallbackTalentGodIndex(); _eliteTalentNames = fallbackEliteTalentNames(); return; }
  try {
    const index = await pack.getIndex({ fields: ["system.god", "system.specialization"] });
    const byName = new Map(index.map(e => [e.name, e.system?.god || ""]));
    const elite  = new Set(index.filter(e => isEliteSpecialization(e.system?.specialization)).map(e => e.name));
    // Константа как подстраховка: то, чего в паке ещё нет (новые записи,
    // добавленные мимо сборки), не должно тихо потерять Бога.
    for (const [name, god] of fallbackTalentGodIndex()) if (!byName.has(name)) byName.set(name, god);
    for (const name of fallbackEliteTalentNames()) elite.add(name);
    _talentGodByName = byName;
    _eliteTalentNames = elite;
  } catch (e) {
    console.warn("Warhammer DBC | кэш Бога Таланта не построился, работает библиотека", e);
    _talentGodByName = fallbackTalentGodIndex();
    _eliteTalentNames = fallbackEliteTalentNames();
  }
}

/** Регистрируется в warhammer-dbc.mjs — строит кэш после готовности мира и
 * обновляет его при правках компендиума warhammer-dbc.talents. До первого
 * построения (или в тестах без game.packs) используется прямой запасной путь. */
export function initTalentGodIndex() {
  Hooks.once("ready", () => refreshTalentGodIndex());
  for (const h of ["createItem", "deleteItem", "updateItem"])
    Hooks.on(h, doc => { if (doc?.pack === TALENT_PACK_ID) refreshTalentGodIndex(); });
}

/** Ключ Бога Таланта по имени (как оно лежит в компендиуме/библиотеке), или
 * "undivided", если талант не найден или Бог не указан (Элитные Архетипы). */
export function talentGodKeyOf(talentName) {
  // Мемоизация обязательна: до ready (и в тестах) иначе каждая цена Таланта
  // собирала бы Map на 611 записей заново — по разу на строку списка.
  _talentGodByName ??= fallbackTalentGodIndex();
  const index = _talentGodByName;
  const label = index.get(talentName) || "";
  return TALENT_GOD_LABEL_KEY[label.toLowerCase()] || "undivided";
}

/**
 * Талант Элитного Архетипа? «Все Таланты Элитных Архетипов считаются
 * нейтральными в системе Склонностей» (стр. 24) — у них в паке пустой список
 * Склонностей, и без этого признака подсчёт совпадений делал их Враждебными.
 *
 * Признак берётся с самого предмета (`specialization`, если вызывающий её
 * знает — так видны и Таланты, заведённые руками), а иначе по имени из кэша
 * компендиума.
 */
export function isEliteTalent(talentName, specialization = "") {
  if (isEliteSpecialization(specialization)) return true;
  _eliteTalentNames ??= fallbackEliteTalentNames();
  return _eliteTalentNames.has(talentName);
}

export function talentPatronCat(talentName, patronGod) {
  return godRelationCat(patronGod, talentGodKeyOf(talentName));
}

// ── Характеристики: не прямой Бог, а один из 12 «стереотипов» (3 на Бога,
//    корбук «III. ПРОДВИЖЕНИЕ» → «ХАРАКТЕРИСТИКИ»). Персонаж выбирает СВОЙ при
//    получении Покровительства — 1 Союзная и 2 Враждебные характеристики,
//    остальные Нейтральны. Без Покровителя/стереотипа — всё Нейтрально.
export const CHAR_STEREOTYPES = [
  { key: "slaanesh-dancer",   god: "slaanesh", label: "Танцор Клинка", ally: "ag",  enemies: ["int", "t"] },
  { key: "slaanesh-intriguer",god: "slaanesh", label: "Интриган",      ally: "fel", enemies: ["s", "t"] },
  { key: "slaanesh-hedonist", god: "slaanesh", label: "Гедонист",      ally: "per", enemies: ["s", "wp"] },
  { key: "nurgle-meister",    god: "nurgle",   label: "Мейстер",       ally: "int", enemies: ["per", "fel"] },
  { key: "nurgle-immortal",   god: "nurgle",   label: "Бессмертный",   ally: "t",   enemies: ["ag", "fel"] },
  { key: "nurgle-cultist",    god: "nurgle",   label: "Культист",      ally: "fel", enemies: ["ag", "s"] },
  { key: "khorne-vanguard",   god: "khorne",   label: "Авангард",      ally: "ws",  enemies: ["int", "wp"] },
  { key: "khorne-berserker",  god: "khorne",   label: "Берсерк",       ally: "s",   enemies: ["fel", "wp"] },
  { key: "khorne-smith",      god: "khorne",   label: "Кузнец",        ally: "int", enemies: ["fel", "ag"] },
  { key: "tzeentch-sniper",   god: "tzeentch", label: "Снайпер",       ally: "bs",  enemies: ["fel", "t"] },
  { key: "tzeentch-warlock",  god: "tzeentch", label: "Чернокнижник",  ally: "wp",  enemies: ["s", "t"] },
  { key: "tzeentch-sage",     god: "tzeentch", label: "Мудрец",        ally: "int", enemies: ["s", "ag"] }
];

export function charStereotypesFor(god) {
  return CHAR_STEREOTYPES.filter(s => s.god === god);
}

/** Категория цены Характеристики по Покровительству/стереотипу. */
export function charPatronCat(charKey, patronGod, stereotypeKey) {
  const st = CHAR_STEREOTYPES.find(s => s.key === stereotypeKey);
  if (!st || !patronGod || st.god !== patronGod) return "neutral";
  if (st.ally === charKey) return "ally";
  if (st.enemies.includes(charKey)) return "enemy";
  return "neutral";
}

// ── Смешанная система (стр. 24, «ВЗБОЛТАТЬ НО НЕ СМЕШИВАТЬ») ─────────────────
const MIXED_CAT = {
  ally:    { ally: "ally",    neutral: "ally",    enemy: "neutral" },
  neutral: { ally: "ally",    neutral: "neutral", enemy: "enemy" },
  enemy:   { ally: "neutral", neutral: "enemy",   enemy: "enemy" }
};
export function mixedCat(aptCat, patronCat) {
  return MIXED_CAT[aptCat || "neutral"][patronCat || "neutral"];
}

// ── Настройка ГМ: режим на весь мир ──────────────────────────────────────────
/**
 * Мировое умолчание — Покровительство: в книге (стр. 23) это основная система
 * цен, Склонности — альтернатива. Так решил владелец при сверке «Опыт»
 * 04.10.2026 (до того умолчанием были Склонности).
 *
 * Действует на миры, где настройку никогда не сохраняли; сохранённый выбор ГМ
 * остаётся. Цены, уже записанные на листах, пересчитаются при ближайшей смене
 * Склонностей/Покровителя или режима (hooks.mjs, recalcAllAdvanceCosts).
 */
export const DEFAULT_PRICING_MODE = "patronage";

export function registerAdvancePricingSettings() {
  game.settings.register(SYSTEM_ID, "advancePricingMode", {
    name: "Система цен Продвижения",
    hint: "Как считать цену покупки Характеристик/Навыков/Талантов за опыт — по Покровительству одного из Богов Хаоса (стр. 23, основная система книги — умолчание), по Склонностям (стр. 24, альтернативная система) или по обеим сразу (Смешанная, стр. 24). Персонажу можно задать свою систему отдельно через «Настройки листа».",
    scope: "world", config: true, type: String,
    choices: PRICING_MODES, default: DEFAULT_PRICING_MODE
  });
}

// Фолбэк «Склонности» — НЕ умолчание мира (его задаёт DEFAULT_PRICING_MODE), а
// поведение там, где настроек нет вовсе: тесты без game и самый ранний рендер.
// Цены там по-прежнему считаются по Склонностям.
export function worldAdvancePricingMode() {
  try { return game.settings.get(SYSTEM_ID, "advancePricingMode") || "aptitude"; }
  catch (e) { return "aptitude"; }
}

/** Действующий режим для КОНКРЕТНОГО актора: его personal-оверрайд, если
 * задан (module/sheets/actor-sheet.mjs, «Настройки листа»), иначе мировой. */
export function effectivePricingMode(actor) {
  return actor?.system?.pricingModeOverride || worldAdvancePricingMode();
}
