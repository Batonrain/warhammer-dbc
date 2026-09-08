// tools/capability-reachability.mjs
// ════════════════════════════════════════════════════════════════════════
//  ДОСЯГАЕМОСТЬ ВОЗМОЖНОСТЕЙ — разбор, а не одно число (wdbc-czra).
//
//  У возможности две половины: ЧИТАТЕЛЬ в коде (кто-то спрашивает про неё)
//  и ВЫДАЧА — то, чем она включается из игры. Пока есть только читатель,
//  механика не работает ни у кого, и обычные средства этого не видят: код
//  правильный, тесты зелёные, а за столом ничего не происходит. Ровно так
//  вышло с Талантом «Два Оружия» (wdbc-3jlm).
//
//  Первый замер дал 69 возможностей «с читателем и без выдачи». Разбор
//  каждой (07.09.2026) показал, что подавляющее большинство — артефакт
//  измерения: способность работает, просто включается НЕ ключом с этим
//  именем. Отсюда этот файл: он не считает одну цифру, а раскладывает
//  ключи по способу включения и оставляет в долге только те, у которых
//  включателя нет вовсе.
//
//  ШЕСТЬ СПОСОБОВ ВКЛЮЧЕНИЯ, которые считаются настоящими:
//
//  1. `packs`  — предмет в packs-src несёт запись Конструктора
//     kind:"capability" с этим ключом. Основной путь.
//  2. `code`   — правило в module/rules/** кладёт эффект grantFlag с этим
//     ключом. Имя цели бывает не строкой, а переменной или элементом
//     массива (так выдаются pilot.dreadnought и семь sarcophagus.*, см.
//     rules/sources.mjs → rules/dreadnought.mjs), поэтому переменные здесь
//     разворачиваются, а не игнорируются.
//  3. `twin`   — та же книжная способность смоделирована под рабочим
//     ключом `ability.*` (module/rules/ability-by-key.mjs), и ТОТ ключ
//     выдаётся предметом. Документирующая запись книги и рабочая запись
//     кода — две записи об одном, опознаются по совпадению поля `source`.
//  4. `item`   — предмет, названный в `source`, несёт запись Конструктора
//     другого вида (чаще kind:"reroll" — так механизировано Преимущество,
//     wdbc-u0by). Ключ при этом документирующий: включает предмет, а не он.
//  5. `effect` — предмет, названный в `source`, несёт ActiveEffect с
//     изменениями (так Эльдарская Ловкость даёт +1 к максимуму ОД).
//  6. `byName` — код опознаёт носителя по имени предмета (itemHasName,
//     регулярка по name). Работает, но хрупко — это долг wdbc-iadw, а не
//     недосягаемость: за столом способность есть.
//
//  Всё, что не попало ни в одну корзину, — настоящий долг: `unreachable`.
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Обход дерева. Книги — журнальные тексты, записей Конструктора в них нет. */
function walk(dir, onFile) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "books" && e.name !== "node_modules") walk(p, onFile);
    } else onFile(p);
  }
}

/** Все .json пака: имя, оригинальное имя, тип, ключи возможностей, виды записей. */
function readPacks() {
  const granted = new Set();
  const items = [];
  walk(path.join(ROOT, "packs-src"), (p) => {
    if (!p.endsWith(".json")) return;
    let j;
    try { j = JSON.parse(fs.readFileSync(p, "utf8")); } catch { return; }
    const mech = j?.flags?.["warhammer-dbc"]?.mechanics;
    const keys = [];
    const kinds = [];
    const changes = (j?.effects || []).reduce((n, e) => n + (e?.system?.changes?.length || 0), 0);
    const scan = (o) => {
      if (Array.isArray(o)) o.forEach(scan);
      else if (o && typeof o === "object") {
        if (o.capabilityKey) { keys.push(String(o.capabilityKey)); granted.add(String(o.capabilityKey)); }
        if (o.kind) kinds.push(String(o.kind));
        Object.values(o).forEach(scan);
      }
    };
    scan(mech);
    if (j?.name) {
      items.push({
        file: path.relative(ROOT, p),
        name: String(j.name),
        originalName: String(j?.system?.originalName || ""),
        type: String(j.type || ""),
        capabilityKeys: keys,
        kinds,
        changes
      });
    }
  });
  return { granted, items };
}

/** Все .mjs модуля разом — чтобы не ходить по диску повторно. */
function readModule() {
  const files = new Map();
  walk(path.join(ROOT, "module"), (p) => {
    if (p.endsWith(".mjs")) files.set(path.relative(ROOT, p).replace(/\\/g, "/"), fs.readFileSync(p, "utf8"));
  });
  return files;
}

/**
 * Ключи, выдаваемые кодом через эффект grantFlag.
 *
 * Прямая цель — строковый литерал. Косвенная — имя переменной; тогда
 * ищется либо `const ИМЯ = "ключ"` (так объявлен DREADNOUGHT_PILOT_FLAG),
 * либо перебор `for (const ИМЯ of фн())` — и тогда берутся все строковые
 * литералы тела этой функции (так устроен sarcophagusFlags). Без этого
 * восемь работающих возможностей Дредноута числились недостижимыми.
 */
export function grantedByCode(moduleFiles = readModule()) {
  const keys = new Set();
  const consts = new Map();   // ИМЯ → "ключ"
  const funcs  = new Map();   // имяФункции → тело

  for (const src of moduleFiles.values()) {
    for (const m of src.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*"([\w.\-]+)"/g)) {
      consts.set(m[1], m[2]);
    }
    for (const m of src.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g)) {
      const start = m.index + m[0].length;
      let depth = 1, i = start;
      while (i < src.length && depth > 0) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") depth--;
        i++;
      }
      funcs.set(m[1], src.slice(start, i));
    }
  }

  for (const src of moduleFiles.values()) {
    for (const m of src.matchAll(/target:\s*"([\w.\-]+)"/g)) keys.add(m[1]);

    for (const m of src.matchAll(/target:\s*([A-Za-z_$][\w$]*)\s*[,}]/g)) {
      const ident = m[1];
      if (consts.has(ident)) { keys.add(consts.get(ident)); continue; }
      // Перебор по функции: for (const <ident> of fn()) { … target: <ident> … }
      const loop = new RegExp(`for\\s*\\(\\s*const\\s+${ident}\\s+of\\s+([A-Za-z_$][\\w$]*)\\s*\\(`);
      const found = src.match(loop);
      const body = found && funcs.get(found[1]);
      if (body) for (const lit of body.matchAll(/"([\w.\-]+)"/g)) keys.add(lit[1]);
    }
  }
  return keys;
}

/** «Snapshot / Выстрел Навскидку (packs-src/…)» → «snapshot / выстрел навскидку». */
const normSource = (s) => String(s || "").split("(")[0].trim().toLowerCase();
const normName   = (s) => String(s || "").toLowerCase().replace(/[ёе]/g, "e").replace(/[^a-zа-я0-9]/gi, "");

/** Половинки двуязычного имени из поля `source`: «Snapshot / Выстрел Навскидку». */
function sourceNames(source) {
  return normSource(source).split("/").map(s => s.trim()).filter(s => s.length > 3);
}

/** Половинки имени предмета пака — и русская, и английская, и originalName. */
function nameHalves(item) {
  return [item.name, item.originalName]
    .flatMap(s => String(s || "").split("/"))
    .map(s => s.replace(/\(.*?\)/g, "").trim())
    .filter(s => s.length > 3);
}

/**
 * Разложить ключи реестра по способу включения.
 *
 * @param {object} capabilities реестр module/constants/capabilities.mjs
 * @returns {{withReader:string[], byWay:Record<string,string[]>, unreachable:string[], why:Map<string,string>}}
 */
export function analyze(capabilities) {
  const { granted: packs, items } = readPacks();
  const moduleFiles = readModule();
  const code = grantedByCode(moduleFiles);
  const isGranted = (k) => packs.has(k) || code.has(k);

  const withReader = Object.entries(capabilities)
    .filter(([, v]) => String(v?.reader ?? "").trim() !== "");

  // Ключи `ability.*` — рабочие имена из ability-by-key.mjs. Индекс по source.
  const abilityBySource = new Map();
  for (const [k, v] of Object.entries(capabilities)) {
    if (!k.startsWith("ability.") || !isGranted(k)) continue;
    abilityBySource.set(normSource(v?.source), k);
  }

  const detectionNames = nameDetectionStrings(moduleFiles);
  const byWay = { packs: [], code: [], twin: [], item: [], effect: [], byName: [] };
  const unreachable = [];
  const why = new Map();

  for (const [key, def] of withReader) {
    if (packs.has(key)) { byWay.packs.push(key); why.set(key, "запись Конструктора в packs-src"); continue; }
    if (code.has(key))  { byWay.code.push(key);  why.set(key, "эффект grantFlag в module/rules"); continue; }

    const twin = abilityBySource.get(normSource(def?.source));
    if (twin && twin !== key) {
      byWay.twin.push(key);
      why.set(key, `та же способность выдаётся под рабочим ключом ${twin}`);
      continue;
    }

    // Имя в паке двуязычное («Sentry / Часовой»), в `source` — тоже; сравниваем
    // половинками, иначе не совпадёт ничего: у одной стороны бывает уточнение
    // в скобках, у другой — нет.
    const names = sourceNames(def?.source);
    const carrier = names.length
      ? items.find(it => nameHalves(it).some(h => names.some(n => normName(h) === normName(n))))
      : null;

    if (carrier && carrier.kinds.length) {
      byWay.item.push(key);
      why.set(key, `предмет «${carrier.name}» несёт запись Конструктора (${[...new Set(carrier.kinds)].join(", ")})`);
      continue;
    }

    if (carrier && carrier.changes) {
      byWay.effect.push(key);
      why.set(key, `предмет «${carrier.name}» несёт ActiveEffect (${carrier.changes} изм.)`);
      continue;
    }

    // Опознание по имени предмета: код ищет носителя регуляркой/itemHasName.
    if (carrier && namedInCode(detectionNames, carrier)) {
      byWay.byName.push(key);
      why.set(key, `код опознаёт «${carrier.name}» по имени (долг wdbc-iadw, не недосягаемость)`);
      continue;
    }

    unreachable.push(key);
  }

  return { withReader: withReader.map(([k]) => k), byWay, unreachable, why };
}

/**
 * Имена предметов, по которым код опознаёт носителя способности.
 *
 * Берутся ТОЛЬКО две формы, обе однозначные: имя аргументом в вызовах
 * опознания (itemHasName/hasAbility/hasTalent/hasItem…) и альтернативы
 * регулярки в поле `match:` таблиц вида SANITY_RECOVERY_TALENTS. Свободный
 * поиск строки по модулю сюда не годится: русские подписи Состязаний и
 * прочих таблиц совпадают с именами Талантов, и «Обезоружить» из подписи
 * MELEE_CONTESTS выдавалась бы за опознание Таланта.
 */
function nameDetectionStrings(moduleFiles) {
  const names = new Set();
  for (const [file, src] of moduleFiles) {
    if (!file.startsWith("module/")) continue;
    for (const m of src.matchAll(/\b(?:itemHasName|hasAbility|hasTalent|hasItemNamed|hasNamed)\s*\(([^)]*)\)/g)) {
      for (const lit of m[1].matchAll(/"([^"]+)"/g)) names.add(lit[1]);
    }
    // Регулярка по имени: и полем таблицы (`match: /…/i`), и отдельной
    // константой (`const FERUM_INFERNUS_MATCH = /…/i`, её .test(i.name)).
    // Второе ограничено файлами, которые вообще проверяют имя предмета,
    // иначе в список полезут регулярки разбора текста.
    const testsNames = /\.test\(\s*\w+(\?\.)?\.name\s*\)/.test(src);
    for (const m of src.matchAll(/(?:match:|const\s+[A-Z0-9_]*MATCH[A-Z0-9_]*\s*=)\s*\/([^/\n]+)\/[a-z]*/g)) {
      if (!m[0].startsWith("match:") && !testsNames) continue;
      for (const alt of m[1].split("|")) names.add(alt.replace(/\\/g, ""));
    }
  }
  return names;
}

/** Опознаёт ли код этого носителя по имени. */
function namedInCode(detectionNames, carrier) {
  return nameHalves(carrier).some(h => {
    const n = normName(h);
    for (const d of detectionNames) if (normName(d) === n) return true;
    return false;
  });
}

// Ручной прогон: node tools/capability-reachability.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const { CAPABILITIES } = await import("../module/constants/capabilities.mjs");
  const r = analyze(CAPABILITIES);
  console.log(`с читателем: ${r.withReader.length}`);
  for (const [way, list] of Object.entries(r.byWay)) console.log(`  ${way.padEnd(7)} ${list.length}`);
  console.log(`НЕДОСЯГАЕМЫ: ${r.unreachable.length}`);
  for (const k of r.unreachable) console.log(`  * ${k}  [${CAPABILITIES[k]?.source || ""}]`);
}
