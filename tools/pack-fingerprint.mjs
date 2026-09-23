// tools/pack-fingerprint.mjs
// ════════════════════════════════════════════════════════════════════════
//  ОТПЕЧАТОК СОДЕРЖИМОГО ПАКА — чтобы отличить настоящую правку в игре от
//  того, что мир просто открывали (wdbc-1c10).
//
//  Сторож ручных правок (tools/pack-stamp.mjs) раньше судил по дате файлов
//  базы. Но classic-level переписывает .ldb при ОТКРЫТИИ базы (уплотнение), не
//  меняя ни одного документа, а мир открывает все паки при каждом запуске — и
//  гейт packs:build краснел после каждого сеанса игры, то есть ровно тогда,
//  когда нужен больше всего. Проверено трижды за 05.09.2026: все 18
//  «изменённых» паков меняли дату в окне 1–4 секунды (момент открытия мира), а
//  полное извлечение давало НОЛЬ изменений в packs-src.
//
//  Отпечаток считается по ДОКУМЕНТАМ, а не по байтам файлов: порядок ключей и
//  раскладка LevelDB на него не влияют, а любое изменение, добавление или
//  удаление документа — влияет.
//
//  Дата файлов при этом никуда не делась: она остаётся быстрым предфильтром
//  «стоит ли вообще открывать базу», и отпечаток считается только у паков,
//  которые этот предфильтр не прошли.
// ════════════════════════════════════════════════════════════════════════

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Версия АЛГОРИТМА отпечатка (wdbc-7qjg).
 *
 * Любая правка authored()/stable() меняет отпечаток у всех паков сразу, и
 * отметка, записанная прошлой версией, перестаёт быть сравнимой. Без этого
 * номера такое расхождение читалось как «в игре правили» — то есть ровно та
 * ложная тревога, от которой сторож и лечится. Поднимать при каждом изменении
 * того, ЧТО считается авторским содержимым.
 */
export const FINGERPRINT_VERSION = 3;

/**
 * Отпечаток набора документов.
 *
 * Чистая функция: принимает уже прочитанные пары [ключ, значение], поэтому
 * проверяется без файловой системы и без LevelDB.
 *
 * Ключи сортируются — LevelDB волен отдавать их в своём порядке, и после
 * уплотнения порядок может смениться.
 *
 * Разделитель ключа и значения — литерал NUL (0x00), не пробел: гарантированно
 * не встретится в реальных ключах/значениях документов, в отличие от
 * печатного символа (тот же выбор, что и в tools/book-docs.mjs stableId(),
 * bd wdbc-gap5). Байт защищён от случайной порчи явным escape-литералом
 * `\x00` — не переписывать на `" "` и не вставлять сырым байтом: это лишь
 * меняет отпечаток и объявляет пак «изменённым в игре» без единой реальной
 * правки, если кто-то забудет заодно поднять FINGERPRINT_VERSION (bd wdbc-awvf).
 *
 * @param {Iterable<[string, unknown]>} entries пары ключ→документ
 * @returns {string} шестнадцатеричный отпечаток
 */
export function fingerprintOf(entries) {
  const rows = [...entries]
    .map(([key, value]) => `${key}\x00${stable(authored(key, value))}`)
    .sort();
  const h = createHash("sha1");
  // Длина набора в затравке: иначе набор из одной склеенной строки совпал бы
  // с набором из двух, дающих ту же склейку. Затравка отделена литералом SOH
  // (0x01, Start of Heading) по той же причине, что и NUL выше: не пробел, не
  // встретится в реальных данных, защищён явным escape-литералом `\x01` — не
  // переписывать на печатный символ (bd wdbc-gap5, wdbc-awvf).
  h.update(`${rows.length}\x01`);
  for (const row of rows) h.update(row + "\x01");
  return h.digest("hex");
}

/**
 * Документ без того, что Foundry дописывает САМА при открытии мира.
 *
 * Измерено 05.09.2026 на свежесобранном паке против того же пака, побывавшего
 * в открытом мире: движок дописывает `_stats` ВСЕМ документам, а страницам
 * журналов ещё и system/image/video/src/category — значения по умолчанию своей
 * схемы. Автор к этому непричастен, и считать это правкой значит краснеть после
 * каждой партии, то есть ровно то, с чего начался wdbc-1c10.
 *
 * `system` вычищается ТОЛЬКО у страниц журналов. У предметов это авторские
 * данные — урон оружия, поля Черты, — и выбросить их значило бы ослепить
 * сторожа там, где он нужнее всего.
 *
 * Перечнем, а не правилом «убрать пустые»: правило выкинуло бы и настоящие
 * пустые поля, которые автор очистил осознанно. Цена перечня — его придётся
 * дополнять, когда Foundry добавит новое поле по умолчанию; ошибка при этом
 * идёт в безопасную сторону, лишней остановкой сборки.
 */
const PAGE_DEFAULTS = ["system", "image", "video", "src", "category"];

/**
 * Флаги, которые дописывает СИСТЕМА при загрузке мира — не автор (wdbc-7qjg).
 *
 * `migratedEffect` ставит module/migrations/item-effects.mjs:215 каждому
 * предмету, у которого его ещё нет, в том числе внутри компендиумов. Документ,
 * заведённый в packs-src без этого флага, получает его при первом же открытии
 * мира — и отпечаток объявлял пак «отредактированным в игре», хотя автор к
 * этому непричастен ровно так же, как к `_stats` выше. Измерено 06.09.2026:
 * после закрытия мира расходился один документ и ровно по этому полю.
 */
const SYSTEM_WRITTEN_FLAGS = { "warhammer-dbc": ["migratedEffect"] };

/**
 * Разметка, которую дописывает в текст страницы САМ редактор Foundry (wdbc-1c10,
 * третий случай той же болезни).
 *
 * Измерено 06.09.2026 на четырёх книгах (Аэльдари, Ветви Аэльдари, Техника
 * Эльдар, Некроны, 435 страниц): после сеанса игры сборка объявила их
 * изменёнными, а полное извлечение дало 226 «правок», в которых не было НИ
 * ОДНОГО содержательного отличия — только `<tbody>`. ProseMirror достраивает
 * таблицу до полной формы и сохраняет книгу такой. Автор к этому непричастен
 * ровно так же, как к `_stats` и `migratedEffect` выше.
 *
 * Дописывается это при ЗАГРУЗКЕ МИРА, всей книге разом, — а не при открытии
 * той страницы, которую смотрели. Сначала думали наоборот; измерено вечером
 * того же дня: после сеанса, в котором открыли ровно одну страницу
 * «Некронов», `<tbody>` оказался на 45 страницах из 84, и на открытой его как
 * раз не было. Для поправки это ничего не меняет, но значит, что расхождение
 * приходит после ЛЮБОГО запуска мира, а не только после чтения книг.
 *
 * Это ПРАВИЛО, а не перечень полей, — единственное такое место в файле, и цена
 * известна: правка, состоящая ТОЛЬКО из `<tbody>`, станет для сторожа
 * невидимой. Руками её сделать нельзя — человек, правящий страницу в игре,
 * неизбежно меняет и текст, а текст сторож по-прежнему видит.
 *
 * Только страницы журналов: в других паках то же самое не измерено, а
 * расширять правило по догадке значит слепнуть там, где не проверяли.
 */
const EDITOR_WRITTEN_MARKUP = /<\/?tbody>/g;

/** Текст страницы без разметки, которую достраивает сам редактор. */
function authoredPageText(text) {
  if (!text || typeof text !== "object" || typeof text.content !== "string") return text;
  return { ...text, content: text.content.replace(EDITOR_WRITTEN_MARKUP, "") };
}

/** Копия flags без служебных полей, которые проставляет сама система. */
function authoredFlags(flags) {
  if (!flags || typeof flags !== "object") return flags;
  const out = { ...flags };
  for (const [scope, keys] of Object.entries(SYSTEM_WRITTEN_FLAGS)) {
    if (!out[scope] || typeof out[scope] !== "object") continue;
    const scoped = { ...out[scope] };
    for (const key of keys) delete scoped[key];
    // Область, в которой не осталось ничего, кроме служебного флага, тоже
    // должна исчезнуть: иначе документ с {warhammer-dbc:{}} не совпадёт с
    // документом вовсе без flags.
    if (Object.keys(scoped).length) out[scope] = scoped;
    else delete out[scope];
  }
  return out;
}

function authored(key, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out = { ...value };
  delete out._stats;
  if (out.flags) {
    const flags = authoredFlags(out.flags);
    if (Object.keys(flags).length) out.flags = flags;
    else delete out.flags;
  }
  // Ключ страницы выглядит как «!journal.pages!<журнал>.<страница>» — точка
  // перед pages, а не восклицательный знак. Проверка на "!pages!" его не
  // ловила вовсе, и поправка молча не работала.
  if (/\.pages!/.test(String(key))) {
    for (const f of PAGE_DEFAULTS) delete out[f];
    if (out.text) out.text = authoredPageText(out.text);
  }
  return out;
}
/**
 * JSON с отсортированными ключами на всех уровнях. Обычный JSON.stringify
 * зависит от порядка полей в объекте, а он не гарантирован ничем: один и тот
 * же документ, прочитанный после уплотнения, мог бы дать другую строку.
 */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Отпечаток базы пака на диске ВМЕСТЕ С ПРИЧИНОЙ, если его нет (wdbc-7qjg).
 *
 * Причина важна, потому что «не смог прочитать» и «содержимое разошлось» —
 * разные новости, а сторож сообщал одну и ту же. Запущенный мир держит LOCK на
 * каждой открытой базе: отпечаток становился null, сторож считал пак
 * изменённым и советовал `npm run packs:unpack`, который на занятой базе тоже
 * не работает. Совет был невыполнимым, а диагноз — ложным: никто ничего не
 * правил, просто игра идёт.
 *
 * @param {string} absDir абсолютный путь к папке базы
 * @returns {Promise<{fingerprint: ?string, busy: boolean, missing: boolean}>}
 */
export async function packFingerprintInfo(absDir) {
  if (!existsSync(absDir)) return { fingerprint: null, busy: false, missing: true };
  let db = null;
  try {
    const { ClassicLevel } = await import("classic-level");
    db = new ClassicLevel(absDir, { valueEncoding: "json" });
    // createIfMissing:false — функция ТОЛЬКО читает. Без него classic-level
    // завёл бы новую пустую базу в папке, где её не было, и отпечаток пустоты
    // выглядел бы как честный ответ «пак пуст».
    await db.open({ createIfMissing: false });
    const entries = [];
    for await (const [key, value] of db.iterator()) entries.push([String(key), value]);
    return { fingerprint: fingerprintOf(entries), busy: false, missing: false };
  } catch (error) {
    return { fingerprint: null, busy: isLocked(error), missing: false };
  } finally {
    try { await db?.close(); } catch { /* уже закрыта или не открывалась */ }
  }
}

/** Занятая база: код ядра LEVEL_LOCKED либо его же текст в цепочке причин. */
function isLocked(error) {
  for (let e = error; e; e = e.cause) {
    if (e.code === "LEVEL_LOCKED") return true;
    if (/LOCK|EPERM|EBUSY/i.test(String(e.message ?? ""))) return true;
  }
  return false;
}

/**
 * Отпечаток базы пака на диске.
 *
 * Открывать базу приходится честно, через classic-level — тот же движок, что у
 * Foundry. Базы нет вовсе или она занята (мир запущен) — null: судить о
 * содержимом нечем, и вызывающий должен считать пак изменённым, а не чистым.
 * Кому нужно отличить одно от другого — packFingerprintInfo выше.
 *
 * @param {string} absDir абсолютный путь к папке базы
 * @returns {Promise<?string>} отпечаток или null
 */
export async function packFingerprint(absDir) {
  return (await packFingerprintInfo(absDir)).fingerprint;
}

/**
 * Отпечатки всех паков — для записи в отметку синхронизации.
 *
 * Паки, чью базу открыть не удалось, в отметку не попадают: пустая запись
 * честнее выдуманной. Следующая сборка увидит отсутствие отпечатка и, если
 * дата окажется свежее, остановится — то есть ошибётся в безопасную сторону.
 *
 * @param {Array<{name: string, dir: string}>} packs
 * @param {(p: string) => string} toAbs преобразование пути пака в абсолютный
 * @returns {Promise<Object<string,string>>}
 */
export async function allFingerprints(packs, toAbs) {
  const out = {};
  for (const p of packs) {
    const fp = await packFingerprint(toAbs(p.dir));
    if (fp) out[p.name] = fp;
  }
  return out;
}

/**
 * Отпечаток ИСХОДНИКА пака — папки packs-src/<пак> или файла книги (wdbc-6dps).
 *
 * Отпечаток базы выше отвечает на вопрос «правили ли в игре после сверки».
 * Этот — на обратный: «менялись ли исходники после сверки» (пулл, правка,
 * переключение ветки). Если да, а база не пересобрана, база старше исходников,
 * и извлечение молча вернуло бы в packs-src её старое содержимое — даже когда
 * состав документов совпадает и сторож дрейфа (tools/pack-drift.mjs) молчит.
 * Так выглядела вторая половина инцидента 14.09.2026.
 *
 * Считается по байтам файлов, а не по документам: исходники и есть то, что
 * пишут инструменты, и лишних полей от Foundry в них нет. Переводы строк
 * сводятся к \n — иначе core.autocrlf на Windows менял бы отпечаток без правки.
 * Путь внутри папки входит в отпечаток: переезд документа в другую папку —
 * тоже правка.
 *
 * @param {string} absPath абсолютный путь к папке пака или файлу книги
 * @returns {?string} отпечаток; null — исходника нет
 */
export function sourceFingerprint(absPath) {
  if (!existsSync(absPath)) return null;
  const h = createHash("sha1");
  const add = (file, rel) => h.update(`${rel}\x00${readFileSync(file, "utf8").replace(/\r\n/g, "\n")}\x01`);
  if (!statSync(absPath).isDirectory()) {
    add(absPath, "");
    return h.digest("hex");
  }
  const files = readdirSync(absPath, { withFileTypes: true, recursive: true })
    .filter(e => !e.isDirectory() && e.name.endsWith(".json"))
    .map(e => join(e.parentPath ?? e.path, e.name))
    .map(file => ({ file, rel: relative(absPath, file).replace(/\\/g, "/") }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  h.update(`${files.length}\x01`);
  for (const { file, rel } of files) add(file, rel);
  return h.digest("hex");
}

/**
 * Отпечатки исходников набора паков: имя пака → отпечаток. Паки без
 * исходника в набор не попадают — как и в allFingerprints выше.
 *
 * @param {Array<{name: string, source: string}>} packs source — абсолютный путь
 * @returns {Object<string,string>}
 */
export function allSourceFingerprints(packs) {
  const out = {};
  for (const p of packs) {
    const fp = sourceFingerprint(p.source);
    if (fp) out[p.name] = fp;
  }
  return out;
}
