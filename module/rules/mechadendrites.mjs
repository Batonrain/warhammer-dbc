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
//   • Не учитывается: Киберпривязь (слот за каждый подключённый сервочереп —
//     число черепов система не знает).
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
export function mechadendritePorts(actor) {
  const items = [...(actor?.items ?? [])];
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
  const list = installed.filter(i => implantPorts(i) > 0).map(i => {
    const type = mechadendriteType(i);
    return {
      id: i.id ?? i._id ?? "", name: i.name ?? "", ports: implantPorts(i), type,
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
