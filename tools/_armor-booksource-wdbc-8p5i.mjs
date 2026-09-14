// tools/_armor-booksource-wdbc-8p5i.mjs
// ════════════════════════════════════════════════════════════════════════
//  Разовый скрипт для wdbc-8p5i: заполняет system.bookSource у packs-src/armor/.
//  Сверено вручную построчно с packs-src/books/{core,aeldari,aeldari-branches,chaos}.json
//  (см. bd-комментарий wdbc-8p5i для разбора по каждой папке).
//
//    node tools/_armor-booksource-wdbc-8p5i.mjs --dry   # только показать план
//    node tools/_armor-booksource-wdbc-8p5i.mjs         # применить
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARMOR = path.join(ROOT, "packs-src", "armor");

// Папка (относительно packs-src/armor) -> bookSource по умолчанию для всех файлов в ней.
const byFolder = {
  "Имперское/Броня/Примитивная": 'DoomBC — Основная книга, IV. Арсенал («Броня», стр. 228)',
  "Имперское/Броня/Импровизированная": 'DoomBC — Основная книга, IV. Арсенал («Броня», стр. 228)',
  "Имперское/Броня/Флак": 'DoomBC — Основная книга, IV. Арсенал («Броня», стр. 229)',
  "Имперское/Броня/Панцирная": 'DoomBC — Основная книга, IV. Арсенал («Броня», стр. 229)',
  "Имперское/Броня/Ячеистая": 'DoomBC — Основная книга, IV. Арсенал («Броня», стр. 230)',
  "Имперское/Броня/Прочая": 'DoomBC — Основная книга, IV. Арсенал («Броня», стр. 230)',
  "Имперское/Броня/Силовая": 'DoomBC — Основная книга, IV. Арсенал («Силовая броня», стр. 233)',
  "Астартес/Броня/Силовая": 'DoomBC — Основная книга, IV. Арсенал («Силовая броня», стр. 234)',
  "Астартес/Броня/Терминаторская": 'DoomBC — Основная книга, IV. Арсенал («Силовая броня», стр. 235)',
  "Азуриане/Ячеистая": 'Книга Аэльдари, V. Арсенал Эльдар («Ячеистая броня» стр. 91)',
  "Азуриане/Аспектная": 'Книга Аэльдари, V. Арсенал Эльдар («Аспектная броня» стр. 92)',
  "Друкхари/Броня": 'Книга Аэльдари: Ответвления, АРСЕНАЛ ДРУКХАРИ («Броня» стр. 131)',
};

// Точечные исключения по имени файла (относительно packs-src/armor) —
// либо особая цитата, либо сознательный пропуск (не найдено в книгах).
const byFile = {
  // Уникально не по Arsenal-таблице: текст этого имени найден дословно в
  // aeldari.json, II. ПУТИ АЗУРИАНА, страница «Иррикшад (Сверкающие Копья)» —
  // лор и таланты этого аспекта (гравициклы, лазерные копья), а не общая
  // строка таблицы брони (там числится «Shining Spear Armour / Броня
  // Сияющего Копья» — другой файл, другая цитата).
  "Азуриане/Аспектная/Броня_Варп_Паука_Tu8SRtK8JZJsuaDi.json": null, // покрыт byFolder (Warp-Spiders Armour есть в таблице)
  "Азуриане/Аспектная/Броня_Сверкающие_Копья_FArWRkuer5PrVxJi.json":
    'Книга Аэльдари, II. Пути Азуриана («Иррикшад (Сверкающие Копья)», стр. 29)',

  // Снаряжение Арлекинов: только 2 из 4 файлов papки дословно найдены в
  // aeldari-branches.json (СЕРЫЕ ЛЮДИ → «Снаряжение Арлекинов», стр. 243).
  "Арлекины/Снаряжение/Голокостюм__Dathedi__6jmN6AZj8JWdPLr2.json":
    'Книга Аэльдари: Ответвления, СЕРЫЕ ЛЮДИ («Снаряжение арлекинов» стр. 243)',
  "Арлекины/Снаряжение/Ложное_Лицо__Agaith__RaYhikt2QmLXaIX8.json":
    'Книга Аэльдари: Ответвления, СЕРЫЕ ЛЮДИ («Снаряжение арлекинов» стр. 243)',
  // "Звёздное Одеяние" и "Маска Секретов" в книгах не найдены (см. отчёт) —
  // сознательно оставлены пустыми, не выдумываем цитату.
  "Арлекины/Снаряжение/Зв_здное_Одеяние_UNfh2IRF07p3lqol.json": undefined,
  "Арлекины/Снаряжение/Маска_Секретов_ClTdXcTMDYXUbeEl.json": undefined,

  // Существующая запись — исправлена на честную и единообразную: добавлена
  // пропущенная глава «IV. Арсенал», а название под-раздела приведено к
  // фактическому имени страницы книги («Бионика и кибернетика», а не
  // придуманному «Кибернетика Скитарии»); страница 269 подтверждена текстом.
  "Имперское/Броня/Прочая/Skitarii_War_Plate___Боевые_Латы_Скитари_542KovBL6cRd2pXD.json":
    'DoomBC — Основная книга, IV. Арсенал («Бионика и кибернетика», стр. 269)',

  // Дочерний предмет комплекта Improvised Armour (голова с AP 2) — существующий
  // текст поля special уже указывает источник (стат-блок Культиста в Хаосе);
  // переносим ту же цитату в bookSource.
  "Имперское/Броня/Импровизированная/Improvised_Helmet___Импровизированный_Шл_MsTm5zCqb4Zpb5Xb.json":
    'DoomBC — Хаос, II. Смертные («Культисты», стр. 43)',
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".json") && !p.endsWith("_Folder.json")) out.push(p);
  }
  return out;
}

function run({ dry = false } = {}) {
  const files = walk(ARMOR);
  let changed = 0, skippedFilled = 0, skippedNoRule = 0, clearedIntentionally = 0;
  const noRule = [];

  for (const abs of files) {
    const rel = path.relative(ARMOR, abs).split(path.sep).join("/");
    const dir = path.dirname(rel);

    let value;
    let hasRule = false;
    if (Object.prototype.hasOwnProperty.call(byFile, rel)) {
      hasRule = true;
      value = byFile[rel];
      if (value === null) { // явный "нет спец-правила, использовать byFolder"
        hasRule = false;
      }
    }
    if (!hasRule) {
      if (Object.prototype.hasOwnProperty.call(byFolder, dir)) {
        hasRule = true;
        value = byFolder[dir];
      }
    }

    if (!hasRule) {
      noRule.push(rel);
      skippedNoRule++;
      continue;
    }

    const doc = JSON.parse(fs.readFileSync(abs, "utf8"));
    const current = doc.system.bookSource;

    if (value === undefined) {
      // Сознательно оставляем пустым (не найдено в книгах) — но убедимся,
      // что поле присутствует как пустая строка, а не отсутствует.
      if (current === "" || current === undefined || current === null) {
        if (current !== "") {
          doc.system.bookSource = "";
          if (!dry) fs.writeFileSync(abs, JSON.stringify(doc, null, 2) + "\n");
          changed++;
        } else {
          clearedIntentionally++;
        }
      } else {
        clearedIntentionally++;
      }
      continue;
    }

    if (current === value) { skippedFilled++; continue; }

    doc.system.bookSource = value;
    if (!dry) fs.writeFileSync(abs, JSON.stringify(doc, null, 2) + "\n");
    changed++;
  }

  return { total: files.length, changed, skippedFilled, skippedNoRule, clearedIntentionally, noRule };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const dry = process.argv.includes("--dry");
  const { total, changed, skippedFilled, skippedNoRule, clearedIntentionally, noRule } = run({ dry });
  console.log(`Всего файлов: ${total}`);
  console.log(`Изменено: ${changed}${dry ? " (dry-run, не записано)" : ""}`);
  console.log(`Уже совпадало: ${skippedFilled}`);
  console.log(`Оставлено пустым намеренно (без цитаты): ${clearedIntentionally}`);
  console.log(`Без правила вообще: ${skippedNoRule}`);
  if (noRule.length) { console.log("Без правила:"); for (const f of noRule) console.log("  " + f); }
}

export { run };
