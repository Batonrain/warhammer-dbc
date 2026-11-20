// module/rules/mechadendrites.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Учёт мехадендритов (Основная книга, «Бионика и Кибернетика» → Мехадендриты,
//  стр. 263-275; Таланты Механикума).
//
//  Книга:
//   • «Механикум по умолчанию имеет T.b портов для установки мехадендритов в
//     Кибер-Мантии и большая часть мехадендритов занимает 1 порт каждый.»
//     Серво-Рука и Серво-Коготь — 2 порта, Серво-Обвязка — 4, Унктор Когнис —
//     1 слот Кибер-Мантии.
//   • Калибровка Кибер-Мантии: «увеличивает максимум мехадендритов на 1. Можно
//     брать до I.b раз» — каждая копия Таланта +1 порт; предел I.b — ограничение
//     покупки (как у Плоть Слаба), лишние копии всё равно считаются, а лист
//     подсвечивает перебор.
//   • Терция Интерфейс (без настоящей Кибер-Мантии): 1 мехадендрит Редкостью не
//     выше 2; Good.Q/Best.Q — до 2-х.
//   • «Для использования даже утилитарного мехадендрита в бою персонаж должен
//     иметь Талант Mechadendrite Use (Weapon).» Mechadendrite Use — «обучение
//     по использованию конкретного типа мехадендритов» (Weapon / Utility); тип
//     каждого дендрита книга пишет в таблице («Оружие» / «Utility»).
//
//  Что делает система (решения 19.11.2026):
//   • mechadendritePorts() — сводка для листа (ТЕЛО) и Хирургеона: занято /
//     максимум портов, откуда максимум, кто не обучен.
//   • Атака мехадендритом без Mechadendrite Use (Weapon) — штраф −20, как у
//     любого оружия без Тренировки (rules/weapon-training.mjs). Раньше дендрит
//     (weaponType "exotic") требовал Exotic Weapon Training — Талант, которого
//     книга для дендритов не просит.
//   • Киберпривязь (20.11.2026, wdbc-c88dd): «по 1 слоту Кибер-Мантии» за
//     каждый подключённый сервочереп, не больше предела по Качеству (Poor 1,
//     обычная 2, Good 3, Best 4 — один из них без слота). Подключённые черепа —
//     Миньоны этого персонажа с Трейтом Сервочереп (Servoskull).
//
//  Чистый модуль без Foundry.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

/** Флаг «хирургически установлен» (apps/surgeon.mjs). */
const INSTALLED_FLAG = "installed";

const flagOf = (item, key) =>
  item?.flags?.["warhammer-dbc"]?.[key] ?? item?.getFlag?.("warhammer-dbc", key);

/** Имплант установлен Хирургеоном (только такие стоят на фигуре и занимают порты). */
export const isInstalledImplant = item => item?.type === "implant" && !!flagOf(item, INSTALLED_FLAG);

/** Имплант-мехадендрит (категория компендиума «Мехадендриты»). */
export const isMechadendriteImplant = item =>
  item?.type === "implant" && String(item.system?.category ?? "") === "mechadendrite";

/** Сервоконечности, которые в паке оружия идут без ярлыка «Мехадендрит». */
const SERVO_LIMB_RE = /servo-arm|servo-talon|серво-рук|серво-кого/i;

/**
 * Оружие-мехадендрит: ярлык профиля «Мехадендрит» (так подписан раздел
 * дендритов в паке оружия), «мехадендрит» в имени, либо Серво-Рука/Серво-Коготь
 * (книга: «Серво-Рука занимает два порта для мехадендритов»).
 */
export function isMechadendriteWeapon(item) {
  if (item?.type !== "weapon") return false;
  if (String(item.system?.profileLabel ?? "").trim() === "Мехадендрит") return true;
  const name = String(item.name ?? "");
  return /mechadendrite|мехадендрит/i.test(name) || SERVO_LIMB_RE.test(name);
}

const isCyberleash = item =>
  item?.type === "implant" && (itemHasName(item, "Cyberleash") || itemHasName(item, "Киберпривязь"));

/** Предел черепов Киберпривязи по Качеству и сколько из них без слота. */
const LEASH_CAP = { poor: 1, common: 2, good: 3, best: 4 };

/**
 * Слоты Кибер-Мантии под Киберпривязь: 1 за каждый подключённый череп (не
 * больше предела Качества), у Best.Q один череп бесплатно.
 */
export function cyberleashPorts(item, skulls = 0) {
  if (!isCyberleash(item)) return 0;
  const q = String(item.system?.quality ?? "common");
  const cap = LEASH_CAP[q] ?? 2;
  const n = Math.min(Math.max(0, Number(skulls) || 0), cap);
  return Math.max(0, n - (q === "best" ? 1 : 0));
}

/** Сервочерепа персонажа: его Миньоны с Трейтом Servoskull / Сервочереп. */
export function servoSkullCount(actor, actors = globalThis.game?.actors ?? []) {
  if (!actor?.uuid) return 0;
  return [...actors].filter(a => a?.system?.masterUuid === actor.uuid
    && [...(a.items ?? [])].some(i => i?.type === "trait" && (itemHasName(i, "Servoskull") || itemHasName(i, "Сервочереп")))).length;
}

/** Сколько портов Кибер-Мантии занимает имплант (0 — не занимает). */
export function implantPorts(item) {
  if (item?.type !== "implant") return 0;
  if (itemHasName(item, "Servo-Harness") || itemHasName(item, "Серво-Обвязка")) return 4;
  if (itemHasName(item, "Servo-Arm") || itemHasName(item, "Серво-Рука")
      || itemHasName(item, "Servo-Talon") || itemHasName(item, "Серво-Коготь")) return 2;
  if (isMechadendriteImplant(item)) return 1;
  if (itemHasName(item, "Unctor Cognis") || itemHasName(item, "Унктор Когнис")) return 1;
  return 0;
}

/**
 * Тип мехадендрита по книжной таблице: "weapon" («Оружие») или "utility".
 * В паке тип стоит первой строкой описания («R:2. Оружие.»). Не дендрит — "".
 */
export function mechadendriteType(item) {
  if (!isMechadendriteImplant(item)) return "";
  const text = `${item.system?.description ?? ""} ${item.system?.effect ?? ""}`;
  return /R:\s*\d+\.\s*Оружие/i.test(text) ? "weapon" : "utility";
}

const isCyberMantle = item =>
  item?.type === "implant" && (itemHasName(item, "Cyber-Mantle") || itemHasName(item, "Кибер-Мантия"));
const isTertia = item =>
  item?.type === "implant" && (itemHasName(item, "Tertia Interface") || itemHasName(item, "Терция Интерфейс"));

/** Калибровка Кибер-Мантии — каждая копия Таланта +1 к максимуму. */
export const isMantleCalibration = item =>
  item?.type === "talent"
  && (itemHasName(item, "Cyber-Mantle Calibration") || itemHasName(item, "Калибровка Кибер-Мантии"));

const isMechadendriteUse = item =>
  item?.type === "talent"
  && (itemHasName(item, "Mechadendrite Use") || itemHasName(item, "Использование Мехадендритов"));

/** Слово специализации → тип дендрита. */
function specType(spec) {
  const s = String(spec ?? "").trim().toLowerCase();
  if (/^(weapon|оруж|боев)/.test(s)) return "weapon";
  if (/^(utility|утилит|служеб)/.test(s)) return "utility";
  return "";
}

/**
 * Каким типам мехадендритов персонаж обучен (Mechadendrite Use (X)).
 * Специализация берётся из system.specialization купленного Таланта или из
 * скобок в имени; непорезолвленный шаблон «Weapon, Utility» даёт оба — так же
 * читают свои списки Weapon/Armour Training.
 * @returns {Set<"weapon"|"utility">}
 */
export function mechadendriteTraining(actor) {
  const out = new Set();
  for (const i of actor?.items ?? []) {
    if (!isMechadendriteUse(i)) continue;
    const specs = String(i.system?.specialization ?? "").split(",");
    const tail = /\(([^)]*)\)\s*$/.exec(String(i.name ?? ""));
    if (tail) specs.push(...tail[1].split(","));
    for (const s of specs) { const t = specType(s); if (t) out.add(t); }
  }
  return out;
}

/** Обучен ли персонаж мехадендритам этого типа ("weapon"/"utility"). */
export const hasMechadendriteTraining = (actor, type) => mechadendriteTraining(actor).has(type);

/** Мехатендрил: «+5 на любые тесты Крафта за каждый мехатендрил» (wdbc-qbyvc). */
export const MECHATENDRIL_CRAFT_BONUS = 5;

/**
 * Бонус Мастерской за установленные Мехатендрилы. Утилитарный дендрит в деле
 * требует Mechadendrite Use (Utility) — без обучения бонуса нет. Исследования
 * — не Крафт, туда бонус не идёт.
 */
export function mechatendrilCraftBonus(actor, mode = "craft") {
  if (mode === "research" || !hasMechadendriteTraining(actor, "utility")) return 0;
  const n = [...(actor?.items ?? [])].filter(i => isInstalledImplant(i)
    && (itemHasName(i, "Mechatendril") || itemHasName(i, "Мехатендрил"))).length;
  return n * MECHATENDRIL_CRAFT_BONUS;
}

/** Штраф за атаку мехадендритом без Mechadendrite Use (Weapon) — как у оружия без Тренировки. */
export const UNTRAINED_MECHADENDRITE_PENALTY = -20;

/**
 * Часть порога атаки мехадендритом: 0 при Mechadendrite Use (Weapon), иначе −20.
 * @returns {{total:number, parts:Array<{label:string,value:number}>}}
 */
export function mechadendriteAttackPenalty(actor) {
  if (hasMechadendriteTraining(actor, "weapon")) return { total: 0, parts: [] };
  return { total: UNTRAINED_MECHADENDRITE_PENALTY,
           parts: [{ label: "Нет Mechadendrite Use (Weapon)", value: UNTRAINED_MECHADENDRITE_PENALTY }] };
}

const QUALITY_TWO = new Set(["good", "best"]);
const tbOf  = actor => Math.max(0, Number(actor?.system?.characteristics?.t?.bonus) || 0);
const ibOf  = actor => Math.max(0, Number(actor?.system?.characteristics?.int?.bonus) || 0);

/**
 * Сводка портов мехадендритов.
 * @returns {{
 *   source: "mantle"|"tertia"|"none",
 *   base: number, calibration: number, calibrationCap: number, calibrationOver: boolean,
 *   max: number, used: number, free: number, over: boolean,
 *   items: Array<{id:string,name:string,ports:number,type:string,rarityOver:boolean,untrained:boolean}>,
 *   training: {weapon:boolean, utility:boolean},
 *   warnings: string[]
 * }}
 */
export function mechadendritePorts(actor, { skulls = null } = {}) {
  const items = [...(actor?.items ?? [])];
  const skullCount = skulls ?? servoSkullCount(actor);
  const installed = items.filter(isInstalledImplant);
  const mantle = installed.some(isCyberMantle);
  const tertia = mantle ? null : installed.find(isTertia) ?? null;
  const calibration = items.filter(isMantleCalibration).length;
  const calibrationCap = ibOf(actor);

  let source = "none", base = 0;
  if (mantle) { source = "mantle"; base = tbOf(actor); }
  else if (tertia) { source = "tertia"; base = QUALITY_TWO.has(String(tertia.system?.quality ?? "")) ? 2 : 1; }
  // Калибровка настраивает именно Кибер-Мантию — Терции и пустой спине она не прибавляет.
  const max = base + (mantle ? calibration : 0);

  const trained = mechadendriteTraining(actor);
  const portsOf = i => implantPorts(i) || cyberleashPorts(i, skullCount);
  const list = installed.filter(i => portsOf(i) > 0).map(i => {
    const type = mechadendriteType(i);
    return {
      id: i.id ?? i._id ?? "", name: i.name ?? "", ports: portsOf(i), type,
      // Терция держит только дендриты Редкостью ≤ 2.
      rarityOver: source === "tertia" && (Number(i.system?.availability) || 0) > 2,
      untrained: !!type && !trained.has(type)
    };
  });
  const used = list.reduce((s, x) => s + x.ports, 0);

  const warnings = [];
  if (used > 0 && source === "none") warnings.push("Нет Кибер-Мантии или Терции Интерфейса — мехадендриты некуда подключить");
  else if (used > max) warnings.push(`Занято портов больше максимума: ${used} из ${max}`);
  for (const x of list) if (x.rarityOver) warnings.push(`${x.name}: Терция Интерфейс держит только Редкость ≤ 2`);
  if (mantle && calibration > calibrationCap) warnings.push(`Калибровка Кибер-Мантии взята ${calibration} раз, предел I.b = ${calibrationCap}`);

  return {
    source, base, calibration, calibrationCap, calibrationOver: mantle && calibration > calibrationCap,
    max, used, free: Math.max(0, max - used), over: used > max,
    items: list,
    training: { weapon: trained.has("weapon"), utility: trained.has("utility") },
    warnings
  };
}

/**
 * Проверка перед установкой импланта Хирургеоном: что станет с портами.
 * Не запрет — подсказка (ГМ может ставить что угодно, лист подсветит перебор).
 * @returns {string} текст предупреждения или "" — всё в порядке
 */
export function mechadendriteInstallWarning(actor, item) {
  const ports = implantPorts(item);
  if (!ports) return "";
  const now = mechadendritePorts(actor);
  if (now.source === "none") return `${item.name}: нет Кибер-Мантии или Терции Интерфейса — подключить некуда`;
  if (now.source === "tertia" && (Number(item.system?.availability) || 0) > 2)
    return `${item.name}: Терция Интерфейс держит только мехадендриты Редкостью ≤ 2`;
  if (now.used + ports > now.max)
    return `${item.name}: нужно портов ${ports}, свободно ${now.free} из ${now.max}`;
  return "";
}

/**
 * Строка «Порты мехадендритов» на вкладке ТЕЛО: «занято / максимум», подсказка
 * со счётом максимума и предупреждения (перебор, нет обучения, нет Мантии).
 * null — показывать нечего (ни дендритов, ни Мантии/Терции).
 */
export function mechPortsView(p) {
  if (!p || (p.source === "none" && !p.used)) return null;
  const srcLabel = p.source === "mantle"
    ? `Кибер-Мантия: T.b ${p.base}${p.calibration ? ` + Калибровка ${p.calibration}` : ""}`
    : p.source === "tertia" ? `Терция Интерфейс: ${p.base}` : "Нет Кибер-Мантии";
  const lines = [srcLabel, ...p.items.map(x => `${x.name} — портов ${x.ports}`
    + (x.type ? ` (${x.type === "weapon" ? "Оружие" : "Utility"}${x.untrained ? ", нет Mechadendrite Use" : ""})` : ""))];
  if (p.used && !p.training.weapon) lines.push("Без Mechadendrite Use (Weapon): атака дендритом −20");
  const warn = p.warnings.length > 0 || p.items.some(x => x.untrained);
  return { used: p.used, max: p.max, warn, title: [...lines, ...p.warnings].join("\n") };
}

// ── Мехадендриты в бою (книга, «Мехадендриты»; Разобрать 2qtgp) ─────────────
// «Для использования даже утилитарного мехадендрита в бою персонаж должен иметь
// Талант Mechadendrite Use (Weapon). Два режима: 1) персонаж полностью
// концентрируется на мехадендритах — считается имеющим Трейт Multiple Arms (X),
// где X — количество его мехадендритов, и в этот Ход может использовать как
// оружие только их; 2) мехадендриты в дополнение к обычным атакам — атака одним
// из них за Реакцию; несколько Реакций — несколькими, но не одним дважды.»
// Оба флага живут до начала следующего своего Хода (rules/turn-flags.mjs).
export const DENDRITE_FOCUS_FLAG = "dendriteFocus";
export const DENDRITE_REACTION_FLAG = "dendriteReactionAttacks";


/** Сколько у персонажа мехадендритов: установленные импланты-дендриты или оружие-дендриты, что больше. */
export function mechadendriteCount(actor) {
  const all = [...(actor?.items ?? [])];
  const implants = mechadendritePorts(actor, { skulls: 0 }).items
    .filter(x => !isCyberleash(all.find(i => (i.id ?? i._id) === x.id))).length;
  const weapons = [...(actor?.items ?? [])].filter(isMechadendriteWeapon).length;
  return Math.max(implants, weapons);
}

/** Сосредоточен ли персонаж на мехадендритах в этот Ход. */
export function dendriteFocusActive(actor) {
  return !!flagOf(actor, DENDRITE_FOCUS_FLAG);
}

/** Надбавка к Лимиту Атак от Multiple Arms (X) сосредоточения: ceil(X/2) − 1 (та же формула, что у Трейта). */
export function dendriteFocusAttackBonus(actor) {
  if (!dendriteFocusActive(actor) || !hasMechadendriteTraining(actor, "weapon")) return 0;
  return Math.max(0, Math.ceil(mechadendriteCount(actor) / 2) - 1);
}

/** Какие режимы атаки дендритом доступны этим оружием. */
export function dendriteAttackModes(actor, item) {
  if (!isMechadendriteWeapon(item) || !hasMechadendriteTraining(actor, "weapon")) return [];
  return ["focus", "reaction"];
}

/**
 * Почему атака этим оружием сейчас запрещена правилами дендритов ("" — можно).
 * @param {object} actor
 * @param {object} item
 * @param {""|"focus"|"reaction"} mode
 * @param {string[]} attackedIds — id оружия, которым уже атаковали в этот Ход
 */
export function dendriteAttackBlock(actor, item, mode = "", attackedIds = []) {
  const isDendrite = isMechadendriteWeapon(item);
  if (dendriteFocusActive(actor) && !isDendrite && mode !== "reaction")
    return "сосредоточен на мехадендритах: в этот Ход оружием служат только они";
  if (!mode) return "";
  if (!isDendrite) return "это не мехадендрит";
  if (!hasMechadendriteTraining(actor, "weapon")) return "нужен Талант Mechadendrite Use (Weapon)";
  if (mode === "focus" && !dendriteFocusActive(actor)) {
    const items = actor?.items;
    const other = attackedIds.some(id => {
      const it = items?.get?.(id) ?? [...(items ?? [])].find(i => (i.id ?? i._id) === id);
      return it && !isMechadendriteWeapon(it);
    });
    if (other) return "в этот Ход уже атаковал не мехадендритом — сосредоточиться на дендритах нельзя";
  }
  if (mode === "reaction") {
    const used = flagOf(actor, DENDRITE_REACTION_FLAG);
    const id = item.id ?? item._id;
    if (Array.isArray(used) && used.includes(id)) return "этим мехадендритом за Реакцию в этот Ход уже атаковал";
  }
  return "";
}

// ── Гекатонхейр (Талант Крафта; Разобрать tfgq9) ─────────────────────────────
// «Уменьшает время смены в расчёте Крафта, ремонта или обслуживания со
// стандартных 8 часов на 30 минут за каждый утилитарный мехадендрит или
// дополнительную руку, до минимума в 2 часа.» Лишние руки считает вызывающий
// (rules/hands.mjs::maxHands − 2) — сюда hands.mjs не тянем, чтобы не замкнуть импорты.
export const CRAFT_SHIFT_HOURS = 8;

/** Сколько утилитарных мехадендритов установлено (Киберпривязь — не дендрит). */
export function utilityMechadendriteCount(actor) {
  const all = [...(actor?.items ?? [])];
  return mechadendritePorts(actor, { skulls: 0 }).items
    .filter(x => x.type === "utility" && !isCyberleash(all.find(i => (i.id ?? i._id) === x.id))).length;
}

/** Длина смены Крафта в часах: 8, у Гекатонхейра −0.5 за утилитарный дендрит/лишнюю руку, не меньше 2. */
export function craftShiftHours(actor, { extraArms = 0 } = {}) {
  const hasTalent = [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Hecatoncheires"));
  if (!hasTalent) return CRAFT_SHIFT_HOURS;
  const limbs = utilityMechadendriteCount(actor) + Math.max(0, Number(extraArms) || 0);
  return Math.max(2, CRAFT_SHIFT_HOURS - 0.5 * limbs);
}
