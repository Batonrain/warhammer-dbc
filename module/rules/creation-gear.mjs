// module/rules/creation-gear.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Разбор книжного текста «Стартовое Снаряжение» Расы/Архетипа — Этап 5
//  Мастера создания (apps/character-wizard.mjs, _gearLayout/_confirmGear).
//
//  Модуль чистый: ни Foundry, ни актора, ни компендиумов. Он отвечает на
//  один вопрос — ЧТО книга велит выдать по строке, — а Мастер уже решает, КАК
//  (точное имя → предмет сам; категория → Обозреватель, суженный фильтрами).
//  Поэтому разбор проверяется таблицей на ВСЕХ реальных строках книги
//  (test/rules/creation-gear.test.mjs), без запуска мира.
//
//  Строка книги превращается в «заявку» (spec) одного из видов:
//    named      — конкретный предмет по имени («Narthecium (Good.Q)»,
//                 «6×L. Frag Grenades», «Knife(+Mono)»);
//    pick       — N предметов из категории с фильтрами («3 элемента
//                 Снаряжения и Инструментов до R1, из них 1 Good.Q»,
//                 «L. Chain Weapon (до R1)», «6 Модификаций для оружия (до R2)»);
//    stdSystems — «N Стандартные системы» Астартес (своя папка);
//    rule       — не предмет, а правило выдачи («+2 очка Стартового
//                 Снаряжения», «…модифицируется под Огрина», «+1 к Качеству
//                 3-х предметов»);
//    manual     — выдать сам Мастер не может ничем (Скакун — это актор-зверь,
//                 а не предмет), строка остаётся подсказкой ГМу.
//
//  Кириллица в регулярках: `\w` и `\b` — только ASCII (AGENTS.md, «Кириллица
//  в регулярках»), поэтому окончания пишутся `\S*`/`[а-яё]*`, границы — явно.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Папки компендиумов, на которые ссылаются категории книги. id постоянны
 * (packs-src/**\/_Folder…json), сверяются тестом test/rules/creation-gear.test.mjs
 * — переименование/перенос папки там и всплывёт.
 */
export const GEAR_FOLDERS = {
  // warhammer-dbc.weapons — ветки «Имперское/Рукопашное» и «Имперское/Стрелковое»
  // (Мастер раскрывает ветку в листья, см. weaponTypeFolderIds) и листья-Типы.
  meleeBranch:     "xFCD1Mi5ZAg9YDCs",
  rangedBranch:    "ifi99ypld4lTvwo6",
  chain:           "MwsAIUuoQBJXbOQA",
  power:           "x3vbtW2ZuzQfcPFG",
  shock:           "YCVIsdaiG7Gpf0Au",
  force:           "vCSlPFBhpeAbFSas",
  primitiveMelee:  "s14rS6kOxu0zhVPg",
  primitiveRanged: "Lt6osSLOUc9NoGlP",
  grenades:        "CiKyTXQv7N6C3J3A",
  bombs:           "1F41DWSJB405tFwp",
  wraithbone:      "YwpKwjEs1NBtEKyn",   // Азуриане/Рукопашное/Психокостяное
  eldarPower:      "qeNef9C2zvUaeA9b",   // Азуриане/Рукопашное/Силовое
  // warhammer-dbc.gear / .tools — «Мистическое»
  mysticGear:      "gx4qw4kEbnenugoI",
  mysticTools:     "RpwK7hjZB6380LhD"
};

/** Имена папок — для той же сверки в тесте и для подписи в Мастере. */
export const GEAR_FOLDER_LABELS = {
  meleeBranch: "Рукопашное", rangedBranch: "Стрелковое", chain: "Цепное", power: "Силовое",
  shock: "Шоковое", force: "Психосиловое", primitiveMelee: "Примитивное", primitiveRanged: "Примитивное",
  grenades: "Гранаты", bombs: "Бомбы", wraithbone: "Психокостяное", eldarPower: "Силовое",
  mysticGear: "Мистическое", mysticTools: "Мистическое"
};

const PACK_LABELS = {
  weapons: "Оружие", armor: "Броня", gear: "Снаряжение", tools: "Инструменты",
  "weapon-mods": "Модификации оружия", "armor-mods": "Модификации брони",
  "armour-systems": "Системы силовой брони", chemistry: "Химия", ammunition: "Боеприпасы",
  implants: "Импланты", rituals: "Ритуалы", shields: "Силовые щиты"
};

const QUALITY_LABELS = { good: "Хорошее", best: "Высшее", common: "Обычное" };

// Буква любого из двух алфавитов — для границ слова вместо `\b`.
const L = "A-Za-zА-Яа-яЁё";

// ── Разбивка текста ────────────────────────────────────────────────────────

/**
 * Верхний уровень: «,», «;» и перевод строки — «И», с учётом скобок.
 * «,» ПЕРЕД «или» — хвост той же цепочки выбора («A или B, или C»), не новый
 * предмет (Друкхари: «Xenomesh Armour (Good.Q) или Kabalite Armour, или Wychsuit»).
 */
export function splitGearTopLevel(str) {
  const out = []; let d = 0, cur = "";
  // Перенос слова по слогам из вёрстки книги: «Инстру-⏎ментов».
  const s = String(str ?? "").replace(/([А-Яа-яЁё])-\s*\n\s*([а-яё])/gu, "$1$2");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") d++; else if (ch === ")") d = Math.max(0, d - 1);
    if ((ch === "," || ch === ";" || ch === "\n") && d === 0) {
      if (ch === "," && /^\s*или\s+/u.test(s.slice(i + 1))) { cur += ch; continue; }
      // «…до R1, из них 1 Good.Q» — продолжение той же выдачи, не новый
      // предмет; в книге эта фраза ещё и переносится строкой («4 элемента
      // Снаряжения и Инструментов⏎до R1, из них 1 Good.Q»).
      // «Записи Ритуалов на суммарную Редкость 11, но не выше R3 каждый» — то же.
      if (/^\s*(?:из\s+них|до\s*R\s*-?\d|но\s)/iu.test(s.slice(i + 1))) { cur += ch === "\n" ? " " : ch; continue; }
      out.push(cur); cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

/** Части по «или» и по «/» верхнего уровня — как есть, без решения, выбор ли это. */
function rawAlternatives(str) {
  const out = []; let d = 0, cur = "", i = 0;
  const s = String(str);
  while (i < s.length) {
    const ch = s[i];
    if (ch === "(") d++; else if (ch === ")") d = Math.max(0, d - 1);
    if (d === 0 && ch === "/") {
      // «/» — выбор между ПРЕДМЕТАМИ только когда слева законченное название
      // (после «)» или из нескольких слов): «Shock Weapon (до R1)/Snare Gun».
      // «Power/Wraithbone Weapon» — «/» внутри одного названия (Силовое ИЛИ
      // Психокостяное оружие одной строкой), разрезать его нельзя: половинки
      // «Power» и «Wraithbone Weapon» ничего не значат.
      const left = cur.trimEnd();
      if (left.endsWith(")") || /\s/u.test(left.trim())) { out.push(cur); cur = ""; i++; continue; }
    }
    const m = d === 0 ? s.slice(i).match(/^,?\s+или\s+/u) : null;
    if (m) { out.push(cur); cur = ""; i += m[0].length; continue; }
    cur += ch; i++;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim().replace(/,+$/u, "").trim()).filter(Boolean);
}

/**
 * Варианты выбора строки: ["A","B","C"] для «A или B или C», [строка] — если
 * «или»/«/» в ней НЕ выбор между предметами, а часть описания одной выдачи:
 *   • потолки Редкости с Качеством — «2 Любых рукопашных оружия R1(Best.Q) или
 *     R2(Good.Q) или R3» (каждая следующая часть начинается с «R<N>»);
 *   • объединение категорий под одним счётом — «1 Мистическое Снаряжение или
 *     Инструмент (до R3)», «8 L. Гранат или Бомб до R2», «5 элементов
 *     Снаряжения/Инструментов до R1» (строка начинается с числа, а каждая
 *     следующая часть — с русского слова, не с числа и не с латинского имени).
 * «6 Throwing Knife (+Mono) или 6 Throwing Axe (+Mono)» — выбор (часть
 * начинается с числа), «Болтер (Астартес) или Болт Пистолет (Астартес)» —
 * выбор (строка не начинается с числа).
 */
export function gearChoiceOptions(str) {
  const parts = rawAlternatives(str);
  if (parts.length < 2) return [String(str).trim()];
  const rest = parts.slice(1);
  if (rest.every(p => /^(?:до\s*)?R\s*-?\d/u.test(p))) return [String(str).trim()];
  const leadsWithCount = /^\s*(?:[×xх]\s*)?\d+/u.test(parts[0]);
  if (leadsWithCount && rest.every(p => /^[А-Яа-яЁё]/u.test(p))) return [String(str).trim()];
  return parts;
}

/**
 * «Набор» из нескольких предметов через « + » верхнего уровня: «Xeno Hides +
 * Jack Chains (Best.Q) + Carapace Helm», «Cogitator(Best.Q) + Retinal Display».
 * «+» внутри скобок — это надстройка предмета («Knife(+Mono)»), а «+» в начале
 * строки — «дополнительно» («+Ammo Selector»); ни то, ни другое не режется.
 */
export function splitGearBundle(str) {
  const out = []; let d = 0, cur = "";
  const s = String(str ?? "").trim();
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") d++; else if (ch === ")") d = Math.max(0, d - 1);
    if (ch === "+" && d === 0 && cur.trim() && /\s/u.test(s[i - 1] ?? "") && /\s/u.test(s[i + 1] ?? "")) {
      out.push(cur); cur = ""; continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

// ── Разбор одной выдачи ────────────────────────────────────────────────────

/** Качество из текста: «Best.Q», «Good. Q», «Good.Q» → best/good; нет — null. */
export function parseQuality(text) {
  const m = /(Best|Good|Poor)\s*\.?\s*Q(?![A-Za-z])/iu.exec(String(text));
  return m ? m[1].toLowerCase() : null;
}

/**
 * Ступени «Редкость → Качество»: «R0 (Best.Q) или R1 (Good.Q) или R2»,
 * «(до R2, Good.Q или до R1 Best.Q)», «(R3 или R2 Good.Q или R1 Best.Q)».
 * Две и больше ступени через «или» — массив [{max, quality}], иначе null.
 */
export function parseTiers(text) {
  const re = /(?:до\s*)?R\s*(-?\d+)\s*(?:\(?\s*,?\s*(Best|Good)\s*\.?\s*Q\s*\)?)?/giu;
  const found = [];
  let m;
  const s = String(text);
  while ((m = re.exec(s))) found.push({ max: Number(m[1]), quality: m[2] ? m[2].toLowerCase() : "common", at: m.index, end: re.lastIndex });
  if (found.length < 2) return null;
  // Ступени — только те, что стоят через «или»: «4 магазина до R2 и 2 до R3» —
  // два разных счёта, а не выбор ступени.
  for (let k = 1; k < found.length; k++) {
    const between = s.slice(found[k - 1].end, found[k].at);
    if (!/^[\s,)]*или[\s(]*$/u.test(between)) return null;
  }
  return found.map(({ max, quality }) => ({ max, quality }));
}

/**
 * Качество предмета по его Редкости при ступенях: из всех ступеней, в
 * потолок которых предмет влезает, — лучшая. Игроку всегда выгоднее, и
 * это ровно смысл книжного «R0 (Best.Q) или R1 (Good.Q) или R2».
 */
export function qualityForAvailability(tiers, availability) {
  const rank = { common: 0, good: 1, best: 2 };
  // Редкость у предмета не заполнена (у части Имплантов пака её нет) — не
  // дарим Высшее наугад: ступень с самым высоким потолком, то есть худшее
  // Качество из предложенных книгой. Поднять — рукой ГМа на листе.
  if (availability == null || availability === "") {
    const top = [...(tiers || [])].sort((x, y) => y.max - x.max)[0];
    return top?.quality ?? "common";
  }
  const a = Number(availability) || 0;
  let best = null;
  for (const t of tiers || []) {
    if (a > t.max) continue;
    if (!best || rank[t.quality] > rank[best]) best = t.quality;
  }
  return best ?? "common";
}

/**
 * «из них 2 Good.Q и 1 Best.Q», «(3 Good.Q, 2 Best.Q)», «(1 Good.Q)» — сколько
 * из N выбранных предметов получают Качество. «R1 Best.Q» (ступень) сюда не
 * попадает: перед числом стоит «R».
 */
export function parseQualitySlots(text) {
  const re = /(?<![R\d])(\d+)\s*(Good|Best)\s*\.?\s*Q/giu;
  const slots = { good: 0, best: 0 };
  let m, any = false;
  while ((m = re.exec(String(text)))) { slots[m[2].toLowerCase()] += Number(m[1]); any = true; }
  return any ? slots : null;
}

/**
 * План Качества для N выбранных предметов при слотах «из них …»: по умолчанию
 * Высшее — первым выбранным, затем Хорошее, остальным Обычное (порядок
 * выбора в Обозревателе — порядок важности для игрока). Возвращает массив
 * ключей Качества той же длины, что n.
 */
export function defaultQualityPlan(n, slots) {
  const plan = [];
  let best = Math.max(0, Number(slots?.best) || 0), good = Math.max(0, Number(slots?.good) || 0);
  for (let i = 0; i < n; i++) {
    if (best > 0) { plan.push("best"); best--; }
    else if (good > 0) { plan.push("good"); good--; }
    else plan.push("common");
  }
  return plan;
}

/** План укладывается в слоты (не больше Высших/Хороших, чем дала книга). */
export function qualityPlanFits(plan, slots) {
  const n = { best: 0, good: 0 };
  for (const q of plan || []) if (q in n) n[q]++;
  return n.best <= (Number(slots?.best) || 0) && n.good <= (Number(slots?.good) || 0);
}

/** Надстройки в скобках: «(+Mono)», «(Best.Q +Mono)», «(+Pistol Grip)», «(+Void)». */
function parseAttachments(text) {
  const out = [];
  for (const grp of String(text).matchAll(/\(([^()]*)\)/gu)) {
    for (const m of grp[1].matchAll(/\+\s*([A-Za-zА-Яа-яЁё][^,+)]*)/gu)) {
      const name = m[1].trim();
      if (name && !/^(Best|Good|Poor)\s*\.?\s*Q$/iu.test(name)) out.push(name);
    }
  }
  return out;
}

const hasWord = (t, stem) => new RegExp(`(?<![${L}])${stem}`, "iu").test(t);

/** Ведущий счёт: «6 Throwing Knife», «2×L. Chain Weapon», «x2 Скакун». */
function takeCount(text) {
  let t = String(text).trim();
  let count = 1;
  // «×» после числа съедается, только если за ним имя с большой буквы:
  // «2×L. Chain Weapon», «2×Unholy Tomes», но не «3 xeno…».
  let m = /^(\d+)\s*(?:[×xх](?=\s*[A-ZА-ЯЁ]))?\s*(?=\S)/u.exec(t);
  if (m) {
    count = Number(m[1]); t = t.slice(m[0].length);
  } else if ((m = /^[×xх]\s*(\d+)\s+/u.exec(t))) {
    count = Number(m[1]); t = t.slice(m[0].length);
  }
  return { count, rest: t.trim() };
}

/** «до R3»/«не выше R3»/одиночное «R2» — потолок Редкости; нет — null. */
function parseMaxAvailability(text) {
  const s = String(text);
  let m = /не\s+выше\s+R\s*(-?\d+)/iu.exec(s);
  if (m) return Number(m[1]);
  m = /(?:до\s*)?R\s*(-?\d+)(?:\s*\/\s*R\s*(-?\d+))?/u.exec(s);
  if (!m) return null;
  return m[2] != null ? Math.max(Number(m[1]), Number(m[2])) : Number(m[1]);
}

/** Имя предмета для поиска: без счёта, «L.», скобок (кроме «(Астартес)»), «до Rn». */
export function cleanGearName(text) {
  return String(text)
    .replace(/^\s*\+\s*/u, "")
    .replace(/^\s*(?:\d+\s*[×xх]?|[×xх]\s*\d+)\s*/u, "")
    .replace(/^L\.\s*/iu, "")
    .replace(/\((?!Астартес\))[^)]*\)/gu, "")
    .replace(/\s*(?<![A-Za-zА-Яа-яЁё])до\s*R\s*-?\d+/giu, "")
    .replace(/(Best|Good|Common|Poor)\s*\.?\s*Q(?![A-Za-z])/giu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

// Правила выдачи ─────────────────────────────────────────────────────────────

/** «+2 очка Стартового Снаряжения» → 2; иначе null. */
export function matchEquipPointsBonus(text) {
  const m = /^\s*\+\s*(\d+)\s+очк[а-яё]*\s+(?:стартов[а-яё]*\s+)?снаряжени[а-яё]*\s*$/iu.exec(String(text));
  return m ? Number(m[1]) : null;
}

/**
 * «Все стартовое снаряжение бесплатно модифицируется под Огрина» (книга) и
 * прежний пересказ «…под размер Огрина». Раса → ключ свойства оружия.
 */
export const GEAR_SIZE_RULE_PROPS = { огрин: "ogryned" };
export function matchGearSizeRule(text) {
  const t = String(text).trim();
  if (!/снаряжен[а-яё]*[^.;]*модифиц[а-яё]*\s+под\s/iu.test(t)) return null;
  for (const [size, prop] of Object.entries(GEAR_SIZE_RULE_PROPS)) {
    if (new RegExp(size, "iu").test(t)) return { prop, size };
  }
  return { prop: null, size: null };
}

/** «+1 к Качеству 3-х предметов» (Скитарий) → { steps:1, count:3 }. */
export function matchQualityUpgrade(text) {
  const m = /^\s*\+\s*(\d+)\s+к\s+качеств[а-яё]*\s+(\d+)/iu.exec(String(text));
  return m ? { steps: Number(m[1]), count: Number(m[2]) } : null;
}

/** «4 Стандартные системы» → 4; иначе null. */
export function matchStandardSystemsCount(text) {
  const m = /^\s*(\d+)\s+Стандартны[ех]\s+систем/iu.exec(String(text));
  return m ? Number(m[1]) : null;
}

// Категории ──────────────────────────────────────────────────────────────────

/**
 * Категория строки (без счёта и «L.»): куда смотреть Обозревателю. null —
 * категории нет, это имя конкретного предмета.
 * @returns {{packs:string[], folders?:string[], implantCategories?:string[],
 *            ammoType?:string, runic?:boolean, rituals?:boolean}|null}
 */
function detectCategory(body, full) {
  const t = body.toLowerCase();
  const F = GEAR_FOLDERS;
  // Оружие по Типу — английская номенклатура книги («Chain Weapon»,
  // «PowerWeapon», «Power/Wraithbone Weapon»).
  const wt = [];
  if (/chain\s*weapon/u.test(t)) wt.push(F.chain);
  if (/power\s*(?:\/\s*wraith\S*\s*)?weapon/u.test(t)) wt.push(F.power);
  if (/wraith\S*\s*weapon|power\s*\/\s*wraith/u.test(t)) wt.push(F.wraithbone);
  if (/shock\s*weapon/u.test(t)) wt.push(F.shock);
  if (/force\s*weapon/u.test(t)) wt.push(F.force);
  if (wt.length) return { packs: ["weapons"], folders: wt };
  // «Runic Weapon (Примитивное/Прим., Best.Q)» — примитивное рукопашное с
  // пометкой «Рунический» (как у траты Очков Снаряжения «Рунический»).
  if (/runic\s*weapon/u.test(t)) return { packs: ["weapons"], folders: [F.primitiveMelee], runic: true };

  if (hasWord(t, "ритуал")) return { packs: ["rituals"], rituals: true };
  if (hasWord(t, "хими") || hasWord(t, "доз")) return { packs: ["chemistry"] };
  if (hasWord(t, "магазин") || hasWord(t, "обойм") || hasWord(t, "патрон")) {
    return { packs: ["ammunition"], ammoType: hasWord(t, "болт") ? "bolt" : undefined };
  }
  if (hasWord(t, "модификац") || (hasWord(t, "систем") && hasWord(t, "брон"))) {
    const packs = [];
    if (hasWord(t, "модификац") && hasWord(t, "оруж")) packs.push("weapon-mods");
    if (hasWord(t, "модификац") && hasWord(t, "брон")) packs.push("armor-mods");
    if (hasWord(t, "систем")) packs.push("armour-systems");
    return { packs: packs.length ? packs : ["weapon-mods", "armor-mods"] };
  }
  // Импланты — по полю category (как фильтр Конструктора implantCategory).
  const ic = [];
  if (hasWord(t, "мехадендрит")) ic.push("mechadendrite");
  if (hasWord(t, "кибернетик") && hasWord(t, "механикум")) ic.push("mechOther", "mechFocus", "mechEnergy");
  else if (hasWord(t, "кибернетик") && hasWord(t, "скитари")) ic.push("skitarii");
  else if (hasWord(t, "кибернетик")) ic.push("cybernetic");
  if (hasWord(t, "бионик")) ic.push("bionic", "bionic-arm", "bionic-leg");
  if (hasWord(t, "биоимплант")) ic.push("bioimplant");
  if (ic.length) return { packs: ["implants"], implantCategories: ic };

  if (hasWord(t, "гранат") || hasWord(t, "бомб")) {
    const folders = [];
    if (hasWord(t, "гранат")) folders.push(F.grenades);
    if (hasWord(t, "бомб")) folders.push(F.bombs);
    return { packs: ["weapons"], folders };
  }
  if (hasWord(t, "примитивн") && hasWord(t, "оруж")) {
    const folders = [];
    if (hasWord(t, "рукопаш")) folders.push(F.primitiveMelee);
    if (hasWord(t, "стрелк")) folders.push(F.primitiveRanged);
    return { packs: ["weapons"], folders: folders.length ? folders : [F.primitiveMelee, F.primitiveRanged] };
  }
  // «Любое рукопашное оружие», «2 Любых стрелкового оружия», «1 Оружие с
  // типом Меч или Копье» — ветка целиком (Мастер раскроет в листья).
  const anyWord = hasWord(t, "люб") || /^оруж/iu.test(t) || /^\d/u.test(full);
  if (anyWord && (hasWord(t, "оруж") || hasWord(t, "рукопаш") || hasWord(t, "стрелк"))) {
    const folders = [];
    if (hasWord(t, "рукопаш")) folders.push(F.meleeBranch);
    if (hasWord(t, "стрелк")) folders.push(F.rangedBranch);
    return { packs: ["weapons"], folders: folders.length ? folders : undefined };
  }
  if ((hasWord(t, "люб") || hasWord(t, "комплект")) && hasWord(t, "брон")) return { packs: ["armor"] };
  // «N элементов Снаряжения и Инструментов», «2 Элемента снаряжения»,
  // «1 Мистическое Снаряжение или Инструмент».
  if (hasWord(t, "элемент") || hasWord(t, "снаряжен") || hasWord(t, "инструмент")) {
    const mystic = hasWord(t, "мистическ");
    const packs = [], folders = [];
    const wantsGear = hasWord(t, "снаряжен"), wantsTools = hasWord(t, "инструмент");
    if (wantsGear || !wantsTools) { packs.push("gear"); if (mystic) folders.push(F.mysticGear); }
    if (wantsTools || !wantsGear) { packs.push("tools"); if (mystic) folders.push(F.mysticTools); }
    return { packs, folders: folders.length ? folders : undefined };
  }
  return null;
}

/**
 * Одна выдача (без « + » и без «или» — они разобраны раньше) → заявка.
 * @returns {object} spec, см. шапку модуля
 */
export function parseGearItem(text) {
  const raw = String(text ?? "").trim();
  const pts = matchEquipPointsBonus(raw);
  if (pts != null) return { kind: "rule", rule: "equipPoints", value: pts, raw };
  const size = matchGearSizeRule(raw);
  if (size) return { kind: "rule", rule: "sizeRule", prop: size.prop, size: size.size, raw };
  const up = matchQualityUpgrade(raw);
  if (up) return { kind: "rule", rule: "qualityUp", ...up, raw };
  const std = matchStandardSystemsCount(raw);
  if (std != null) return { kind: "stdSystems", count: std, raw };

  const { count, rest } = takeCount(raw.replace(/^\s*\+\s*(?=[A-Za-zА-Яа-яЁё])/u, ""));
  const legion = /^L\.\s*/iu.test(rest);
  const afterL = rest.replace(/^L\.\s*/iu, "");
  const body = afterL.replace(/\([^)]*\)/gu, " ").replace(/\s+/gu, " ").trim();

  // Скакун (Архетип Дикарь, Эльдарские наездники) — это зверь-актор из
  // Бестиария с собственной бронёй, а не предмет инвентаря: предметом его не
  // выдать, остаётся указанием ГМу.
  if (hasWord(body, "скакун") || /^любой\s+из\s+рапторов/iu.test(body)) {
    return { kind: "manual", count, raw, note: "Скакун — зверь из Бестиария, не предмет: ГМ выдаёт его отдельно" };
  }
  // Рецепты Алхимии, генетические шаблоны, Руны — своих паков-предметов нет.
  if (hasWord(body, "рецепт") || hasWord(body, "шаблон") || /^рун[аы]?(?![А-Яа-яЁё])/iu.test(body)) {
    return { kind: "manual", count, raw, note: "для этого вида записей нет компендиума — выдайте вручную" };
  }

  const quality = parseQuality(afterL);
  const tiers = parseTiers(afterL);
  const slots = parseQualitySlots(afterL);
  const maxAvailability = tiers ? Math.max(...tiers.map(x => x.max)) : parseMaxAvailability(afterL);
  const attach = parseAttachments(afterL);

  const cat = detectCategory(body, raw);
  if (cat) {
    const spec = {
      kind: "pick", raw, count, legion, packs: cat.packs,
      folders: cat.folders ?? null, implantCategories: cat.implantCategories ?? null,
      ammoType: cat.ammoType ?? null, runic: !!cat.runic,
      maxAvailability, quality: tiers || slots ? null : quality, tiers, qualitySlots: slots, attach
    };
    if (cat.rituals) {
      // «Записи Ритуалов на суммарную Редкость 11, но не выше R3 каждый» —
      // бюджет суммой Редкости. У Ритуалов в компендиуме поля Редкости нет
      // вовсе (module/data/item/ritual.mjs), так что ни потолок, ни сумму
      // Обозреватель проверить не может: честно — указание игроку/ГМу.
      const sum = /суммарн[а-яё]*\s+редкост[а-яё]*\s+(\d+)/iu.exec(afterL);
      const cap = /не\s+выше\s+R\s*(\d+)/iu.exec(afterL);
      return {
        kind: "manual", raw, count: null, packs: ["rituals"],
        budget: sum ? { mode: "availability", value: Number(sum[1]) } : null,
        maxAvailability: cap ? Number(cap[1]) : null,
        note: `Записи Ритуалов${sum ? ` на сумму Редкости ${sum[1]}` : ""}${cap ? ` (каждая ≤ R${cap[1]})` : ""}: `
          + "у Ритуалов в компендиуме нет Редкости — выберите на вкладке «Ритуалы» вручную"
      };
    }
    return spec;
  }
  return {
    kind: "named", raw, count, legion, name: cleanGearName(afterL),
    quality, maxAvailability, attach,
    // «Frag Grenades» в паке лежит как «Frag / Фраг» в папке «Гранаты».
    grenade: /grenades?\s*$/iu.test(body)
  };
}

/**
 * Одна строка верхнего уровня (уже выбранный вариант, если был выбор) →
 * список заявок. Раскрывает набор через « + » и продолжение счёта «4
 * магазина болтов до R2 и 2 до R3» (две выдачи одной категории с разными
 * потолками).
 */
export function parseGearEntry(text) {
  const out = [];
  for (const part of splitGearBundle(text)) {
    const cont = /^(.*?(?:до\s*)?R\s*-?\d+)\s+и\s+(\d+)\s+(?:до\s*)?R\s*(-?\d+)\s*$/iu.exec(part);
    if (cont && !hasWord(part, "скакун")) {
      const first = parseGearItem(cont[1]);
      out.push(first);
      if (first.kind === "pick") out.push({ ...first, raw: part, count: Number(cont[2]), maxAvailability: Number(cont[3]) });
      continue;
    }
    out.push(parseGearItem(part));
  }
  return out;
}

// ── Подписи для игрока ─────────────────────────────────────────────────────

const qLabel = q => QUALITY_LABELS[q] ?? q;
const folderLabel = id => {
  const k = Object.keys(GEAR_FOLDERS).find(key => GEAR_FOLDERS[key] === id);
  return k ? GEAR_FOLDER_LABELS[k] : null;
};

/** Что Мастер сделает с заявкой — одной строкой, в терминах книги. */
export function describeGearSpec(spec) {
  if (!spec) return "";
  if (spec.kind === "rule") {
    if (spec.rule === "equipPoints") return `+${spec.value} к Очкам Снаряжения — сразу в пуле`;
    if (spec.rule === "sizeRule") return spec.prop ? "всё оружие получит свойство «Огринизированное»" : "правило — применить вручную";
    if (spec.rule === "qualityUp") return `после выдачи — выбрать ${spec.count} предм. для +${spec.steps} ступени Качества`;
  }
  if (spec.kind === "stdSystems") return `список: Стандартные системы, ${spec.count} шт.`;
  if (spec.kind === "manual") return spec.note;
  const bits = [];
  if (spec.kind === "named") {
    bits.push(`выдаётся сам${spec.count > 1 ? `, ${spec.count} шт.` : ""}`);
    if (spec.quality) bits.push(qLabel(spec.quality));
    if (spec.legion) bits.push("Легион");
    if (spec.attach?.length) bits.push(`+ ${spec.attach.join(", ")}`);
    return bits.join(" · ");
  }
  const where = spec.packs.map(p => PACK_LABELS[p] ?? p);
  const folders = (spec.folders || []).map(folderLabel).filter(Boolean);
  bits.push(`список: ${where.join("/")}${folders.length ? ` · ${[...new Set(folders)].join("/")}` : ""}`);
  if (spec.budget?.mode === "availability") bits.push(`на сумму Редкости ${spec.budget.value}`);
  else if (spec.count > 1) bits.push(`${spec.count} шт.`);
  if (spec.maxAvailability != null) bits.push(`Редкость ≤ ${spec.maxAvailability}`);
  if (spec.tiers) bits.push(`Качество по Редкости: ${spec.tiers.map(x => `R${x.max} ${qLabel(x.quality)}`).join(" / ")}`);
  if (spec.qualitySlots) {
    const q = [];
    if (spec.qualitySlots.best) q.push(`${spec.qualitySlots.best} Высшее`);
    if (spec.qualitySlots.good) q.push(`${spec.qualitySlots.good} Хорошее`);
    bits.push(`из них ${q.join(", ")}`);
  }
  if (spec.quality) bits.push(qLabel(spec.quality));
  if (spec.legion) bits.push("Легион");
  if (spec.runic) bits.push("Рунический");
  return bits.join(" · ");
}

// ── Кто уже выдал: Конструктор Расы/Архетипа против текста ─────────────────

// Кириллица, набранная вместо латиницы внутри английского слова («Сombi-Tool»
// с русской «С» в книге Еретеха): глазом не отличить, а поиск по имени мимо.
const HOMOGLYPHS = { а: "a", е: "e", о: "o", р: "p", с: "c", у: "y", х: "x", к: "k", м: "m", т: "t" };
const fixHomoglyphs = w => (/[a-z]/u.test(w) && /[а-яё]/u.test(w))
  ? w.replace(/[аеорсухкмт]/gu, ch => HOMOGLYPHS[ch]) : w;

/**
 * Ключ имени для поиска: нижний регистр, всё кроме букв/цифр — пробел,
 * смешанные по алфавиту слова приведены к латинице. Им же Мастер строит
 * индекс компендиумов — одна функция по обе стороны сравнения.
 */
export const normName = s => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
  .split(" ").map(fixHomoglyphs).join(" ");

/**
 * Совпадает ли вариант строки текста с записью kind:"equipment" Конструктора.
 * Именная запись — по любой половине двуязычного имени; «Выбор» — по паку,
 * потолку Редкости и (если обе стороны его знают) Типу-папке оружия.
 */
function specMatchesEntry(spec, entry, folderOf, folderName) {
  if (!spec || !entry || entry.kind !== "equipment") return false;
  // Именная строка против «Выбора» Конструктора: «L. Heavy Bolter или …» у
  // Хавока и Выбор «Оружие · Болтерное» — одно и то же, если названный
  // предмет лежит в той же папке-Типе (узнаёт Мастер по индексу компендиума).
  if (spec.kind === "named" && entry.equipMode === "choice") {
    if (entry.equipCategoryPack !== "weapons" || !entry.equipWeaponType) return false;
    if (spec.grenade && entry.equipWeaponType === GEAR_FOLDERS.grenades) return true;
    const f = folderOf?.(spec);
    if (!f) return false;
    if (f === entry.equipWeaponType) return true;
    // Легионный «Тяжёлый Болтер (Астартес)» лежит в «Астартес/Стрелковое/
    // Болтерное», а Выбор Конструктора ссылается на Тип корбука «Имперское/
    // Стрелковое/Болтерное» (других Конструктор не предлагает) — один Тип,
    // разные папки. Сверяем по имени папки-Типа.
    const a = folderName?.(f), b = folderName?.(entry.equipWeaponType);
    return !!a && a === b;
  }
  if (entry.equipMode !== "choice") {
    if (spec.kind !== "named") return false;
    const want = normName(spec.name);
    return String(entry.equipSourceName || "").split("/").some(p => {
      const k = normName(p);
      return k && (k === want || k.replace(/\s*астартес$/u, "") === want);
    });
  }
  if (spec.kind !== "pick") return false;
  if (!spec.packs.includes(entry.equipCategoryPack)) return false;
  const eMax = Number(entry.equipMaxAvailability);
  if (spec.maxAvailability != null && Number.isFinite(eMax) && eMax < 5 && eMax !== spec.maxAvailability) {
    // Ступени «R0 Best / R1 Good / R2»: Конструктор записывает их группой
    // «ИЛИ» по записи на ступень — хватит совпадения любой ступени.
    if (!(spec.tiers || []).some(t => t.max === eMax)) return false;
  }
  if (entry.equipCategoryPack === "weapons" && entry.equipWeaponType && spec.folders?.length) {
    if (!spec.folders.includes(entry.equipWeaponType)) return false;
  }
  return true;
}

/**
 * Какие строки текста снаряжения уже покрыты записями Конструктора того же
 * персонажа (Архетип/Раса выдают часть книжного снаряжения своей Механикой на
 * Этапах 1–3). Без этого одна и та же строка выдавалась ДВАЖДЫ: Чемпион
 * получал «L. Power Weapon (до R3, Good.Q)» и Механикой Архетипа (Выбор:
 * Силовое, R≤3, Хорошее), и Этапом 5 по тексту.
 *
 * Каждая выдача Конструктора закрывает не больше ОДНОЙ строки текста (Нумен:
 * две одинаковые строки «рукопашное оружие» — две группы). Группа «ИЛИ» — это
 * одна выдача (игрок уже выбрал вариант в Механике, повторять вопрос на Этапе 5
 * незачем), группа «И» — столько выдач, сколько в ней записей (Раптор: «2×L.
 * Chain Weapon» и «6×L. Frag Grenades» лежат в одной группе «И»).
 *
 * @param {string[][]} rowOptions  варианты каждой строки (gearChoiceOptions)
 * @param {{operator?:string, entries:object[]}[]} groups  группы Конструктора
 * @param {(spec:object)=>?string} [folderOf]  папка именного предмета (из индекса)
 * @param {(id:string)=>?string} [folderName]  имя папки по id — «Болтерное» Астартес = «Болтерное» корбука
 * @returns {boolean[]} покрыта ли строка
 */
export function constructorCoverage(rowOptions, groups, folderOf = null, folderName = null) {
  const units = [];
  for (const g of groups || []) {
    const eq = (g?.entries || []).filter(e => e?.kind === "equipment");
    if (!eq.length) continue;
    if (String(g.operator || "AND").toUpperCase() === "OR") units.push(eq);
    else for (const e of eq) units.push([e]);
  }
  const used = new Set();
  return (rowOptions || []).map(options => {
    const specs = options.flatMap(o => parseGearEntry(o));
    for (let u = 0; u < units.length; u++) {
      if (used.has(u)) continue;
      if (specs.some(s => units[u].some(e => specMatchesEntry(s, e, folderOf, folderName)))) { used.add(u); return true; }
    }
    return false;
  });
}

// ── Поиск предмета по имени ────────────────────────────────────────────────

/** Слитный ключ имени: «plasma gun» → «plasmagun». */
export const compactKey = k => String(k || "").replace(/\s+/gu, "");

/** Ключи, под которыми искать именную заявку в индексе компендиумов. */
export function namedLookupKeys(spec) {
  const base = normName(spec?.name);
  if (!base) return [];
  const keys = [base];
  if (spec.legion) keys.unshift(`${base} астартес`, `legion ${base}`, `astartes ${base}`);
  if (spec.grenade) keys.push(base.replace(/\s*grenades?$/u, ""));
  // «Plasma Gun» книги — «Plasmagun» пака: слитное написание тоже ключ
  // (Мастер кладёт в индекс и его, см. compactKey).
  keys.push(...keys.map(compactKey));
  return [...new Set(keys.filter(Boolean))];
}

const isLegionName = n => /\(Астартес\)|^(Legion|Astartes)\s/iu.test(String(n));

/**
 * Из нескольких предметов с одним именем («Bolter / Болтер» и «Bolter /
 * Болтер (Астартес)») — нужный: «L.» — Легионную версию, без «L.» — обычную;
 * граната — из папки «Гранаты» (а не одноимённую Ракету).
 * @param {{name:string, folder?:string}[]} candidates
 */
export function pickNamedCandidate(candidates, spec) {
  let list = [...(candidates || [])];
  if (!list.length) return null;
  if (spec?.grenade) {
    const g = list.filter(c => c.folder === GEAR_FOLDERS.grenades);
    if (g.length) list = g;
  }
  // При равных — самое короткое имя: «Narthecium / Нартеций» раньше, чем
  // «Narthecium / Нартеций (рукопашный профиль)».
  list.sort((a, b) => String(a.name).length - String(b.name).length);
  const legionFirst = list.filter(c => isLegionName(c.name));
  const plain = list.filter(c => !isLegionName(c.name));
  return (spec?.legion ? (legionFirst[0] ?? plain[0]) : (plain[0] ?? legionFirst[0])) ?? null;
}

/** Нужно ли после выдачи дописать свойство Legion (выбранный предмет — не Легионная версия). */
export function needsLegionProp(spec, itemName) {
  return !!spec?.legion && !isLegionName(itemName);
}
