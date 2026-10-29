// test/rules/talent-name-literals.test.mjs
//
// Сторож против молчаливой поломки при переименовании (wdbc-iadw).
//
// Таланты/Черты/импланты/оружие опознаются в коде по литеральному имени —
// itemHasName(item, "Bone Song") и родственные формы (см. literalNames). Это ровно тот класс ошибки, о
// котором AGENTS.md предупреждает на своём же примере: в паке лежал «Sure
// Stitch» вместо «Sure Strike», и Талант просто не находился. Ни один гейт
// этого не ловил: тесты, lint и сборка паков оставались зелёными, в консоль
// ничего не писалось, а механика тихо переставала работать. Заметить можно
// было только за столом, когда кнопка не появилась.
//
// Здесь имя становится проверяемым договором: каждое имя, по которому код
// опознаёт предмет, обязано быть у какого-нибудь документа в packs-src.
// Переименовали в компендиуме — тест краснеет с именем и адресом строки кода.
//
// Сравнение — тем же itemHasName, что и в бою: по любой половине двуязычного
// имени, без учёта регистра, со снятой специализацией в скобках.
//
// Это НЕ отменяет перевод опознания на именованные Возможности (реестр
// module/constants/capabilities.mjs, где имя проверяется isKnownCapability).
// Сторож дешевле и ставится сразу; перевод остаётся в wdbc-iadw.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { itemHasName } from "../../module/rules/predicates.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Все файлы с таким расширением в папке, рекурсивно. */
const filesIn = (dir, ext) => fs.readdirSync(dir, { withFileTypes: true, recursive: true })
  .filter(e => !e.isDirectory() && e.name.endsWith(ext))
  .map(e => path.join(e.parentPath ?? e.path, e.name));

/** Строковые константы модуля: `const X = "…"` и `export const X = "…"`. */
const stringConstsOf = text => new Map(
  [...text.matchAll(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)]
    .map(m => [m[1], m[2]]));

/** Имена из таблиц `{ key: "ключ", name: "Имя" }` модуля (TAKEDOWN, MELEE_TALENTS…). */
const tableNamesOf = text =>
  [...text.matchAll(/\{\s*key:\s*"[^"]*",\s*name:\s*"([^"]+)"/g)].map(m => m[1]);

/** Массивы из одних строк: `const X_NAMES = ["Eng", "Рус"]`, можно в несколько строк. */
const stringArraysOf = text =>
  [...text.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:Object\.freeze\()?\[([^\]]*)\]/g)]
    .map(m => ({ id: m[1], body: m[2].replace(/\/\/.*$/gm, ""), line: text.slice(0, m.index).split("\n").length }))
    .filter(a => /^\s*"[^"]*"(\s*,\s*"[^"]*")*\s*,?\s*$/.test(a.body))
    .map(a => ({ id: a.id, line: a.line, names: [...a.body.matchAll(/"([^"]+)"/g)].map(s => s[1]) }));

/** Аргумент-имя: литерал, константа файла или поле `.name` таблицы. */
const NAME_ARG = String.raw`("[^"]*"|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)`;
const NAME_CALLS = [
  // itemHasName(item, ИМЯ)
  new RegExp(String.raw`itemHasName\([^,]+,\s*${NAME_ARG}\s*[),]`, "g"),
  // hasAbility(actor, ключ, ИМЯ, тип) — опознание переведено на ключ
  // Возможности (wdbc-iadw), но имя осталось запасным путём и обязано
  // совпадать с паком. Ключ — литерал, константа или `T.key`: неважно.
  new RegExp(String.raw`hasAbility\([^,]+,[^,]+,\s*${NAME_ARG}\s*[),]`, "g"),
  // itemIs(item, "тип", ключ, ИМЯ) — то же для вопроса о САМОМ предмете (wdbc-wdlw).
  new RegExp(String.raw`itemIs\([^,]+,[^,]+,[^,]+,\s*${NAME_ARG}\s*[),]`, "g")
];

/**
 * Имена, по которым код опознаёт предмет.
 *
 * Имя доходит до сравнения многими путями, и сторож обязан видеть каждый:
 * литерал на месте вызова; константа файла (`itemHasName(i, FULLY_ARMED_NAME)`);
 * поле таблицы `{key, name}` (`hasAbility(a, T.key, T.name)`, где T — строка
 * MELEE_TALENTS или TAKEDOWN); массив имён, который перебирают
 * (`X_NAMES.some(n => itemHasName(i, n))`) или отдают помощнику
 * (`hasLeadershipTalent(actor, RANCOR_NAMES)`); литералы местных помощников
 * `hasTalent(actor, "Eng", "Рус")` и `hasItem(actor, "тип", "Имя")`. Сторож,
 * знающий только литералы, молча пропускал половину имён — а наверх выносят
 * как раз те, что используются в нескольких местах.
 *
 * Имя-переменная времени выполнения (параметр функции) сюда не попадает и не
 * должна: такой договор складывается в рантайме, следить за ним нечем.
 */
function literalNames() {
  const found = new Map(); // имя → [«файл:строка», …]
  const add = (name, where) => {
    if (!found.has(name)) found.set(name, []);
    found.get(name).push(where);
  };
  for (const file of filesIn(path.join(ROOT, "module"), ".mjs")) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    const consts = stringConstsOf(text);
    const tableNames = tableNamesOf(text);
    const arrays = stringArraysOf(text);
    const usedArrays = new Set();
    const resolve = (arg, where) => {
      if (arg.startsWith("\"")) add(arg.slice(1, -1), where);
      // `t.name` — строка таблицы, выбранная в рантайме: в договоре вся таблица файла.
      else if (arg.endsWith(".name")) tableNames.forEach(n => add(n, where));
      else if (consts.has(arg)) add(consts.get(arg), where);
    };
    text.split(/\r?\n/).forEach((line, i) => {
      // Строки-комментарии пропускаются. Объяснение, ПОЧЕМУ опознание по имени
      // сняли, обычно цитирует прежний вызов целиком — и сторож принимал
      // цитату за живой код (поймано на wdbc-h1bx). Имя из комментария
      // договором между данными и кодом не является.
      const bare = line.trim();
      if (bare.startsWith("//") || bare.startsWith("*") || bare.startsWith("/*")) return;
      const where = `${rel}:${i + 1}`;
      for (const re of NAME_CALLS) for (const m of line.matchAll(re)) resolve(m[1], where);
      for (const m of line.matchAll(/\bhasTalent\([^,"]+((?:,\s*"[^"]*")+)\s*\)/g))
        for (const s of m[1].matchAll(/"([^"]+)"/g)) add(s[1], where);
      for (const m of line.matchAll(/\bhasItem\([^,"]+,\s*"[^"]*",\s*"([^"]+)"\s*\)/g)) add(m[1], where);
      for (const a of arrays) {
        if (new RegExp(String.raw`\b${a.id}\.(?:some|find|filter|every)\(.*\b(?:itemHasName|itemIs)\(`).test(line)
          || new RegExp(String.raw`\bhas\w*\([^,]+,\s*${a.id}\s*\)`).test(line)) usedArrays.add(a);
      }
    });
    for (const a of usedArrays) a.names.forEach(n => add(n, `${rel}:${a.line}`));
  }
  return found;
}

/**
 * Имена всех документов packs-src. Книги (packs-src/books) пропускаются: это
 * многомегабайтные журналы разбора книг, а не предметы, и имени предмета в
 * них нет.
 */
function packNames() {
  const out = [];
  const root = path.join(ROOT, "packs-src");
  for (const file of filesIn(root, ".json")) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    if (rel.startsWith("books/")) continue;
    let doc;
    try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    if (typeof doc?.name === "string") out.push({ name: doc.name, type: doc.type, rel });
  }
  return out;
}

/**
 * Имена, у которых в паках нет носителя — и почему это пока терпимо.
 *
 * Список закрытый и не бесплатный: каждая строка здесь означает механику,
 * которая в игре не работает, и обязана называть заведённую биду. Тест ниже
 * это проверяет — иначе список тихо стал бы свалкой, а сторож перестал бы
 * следить за половиной имён.
 */
const KNOWN_GAPS = {
  // Название импланта в паке несёт его номер по книге («19. Чёрный Панцирь /
  // Black Carapace»), поэтому русская половина при сравнении не совпадает —
  // цифра с точкой остаётся частью имени. Механика при этом работает: рядом в
  // коде стоит проверка по английской половине, она и срабатывает. То есть
  // русский литерал в коде — мёртвый запасной путь, а не поломка. Убирается
  // вместе с переводом на Возможности (wdbc-iadw).
  "Чёрный Панцирь": "wdbc-iadw — пак называет имплант «19. Чёрный Панцирь / Black Carapace», работает английская половина рядом",
  "Сус-ан Мембрана": "wdbc-iadw — пак называет имплант «12. Сус-ан Мембрана / Sus-an Membrane», работает английская половина рядом",
  // Прямой апостроф в коде, типографский в паке («Khaine’s Arrow»); русская
  // половина «Стрела Кхейна» в том же массиве совпадает, Путь работает.
  "Khaine's Arrow": "wdbc-iadw — пак пишет «Khaine’s Arrow» с типографским апострофом, работает русская половина рядом",
  // Настоящая дыра: пак зовёт предмет «Mag-Boots / Маг-Сапоги», и
  // wearsFootwear Маг-Сапоги не видит (Barefoot Ратлинга). Найдено при
  // расширении сторожа на массивы имён; чинить имя в коде или в паке.
  "Mag Boots": "wdbc-t044e — пак называет предмет «Mag-Boots / Маг-Сапоги», обувь из снаряжения не опознаётся"
};

describe("имена предметов, зашитые в код, есть в packs-src", () => {
  const names = literalNames();
  const docs = packNames();

  it("разбор находит имена во всех формах записи", () => {
    // Порог не декоративный. Сузившийся разбор НЕ виден по красноте: сторож,
    // проверяющий меньше имён, остаётся зелёным. Числом он и ловится.
    // Порог снижается только вместе с объяснением, куда делось имя (так ушёл
    // «Meteor Hammer» при починке Малеария, wdbc-h1bx).
    //
    // 511 (храповик): при расширении разбора на ключ-константу, таблицы {key,name},
    // массивы имён и hasTalent/hasItem (фаза B аудита тестов, 29.10.2026)
    // имён стало 511 против 247.
    expect(names.size).toBeGreaterThanOrEqual(511);
    expect(docs.length).toBeGreaterThan(1000);

    // По имени на каждую форму: без любой из них цифра просела бы, но
    // убедимся прямо.
    expect([...names.keys()]).toEqual(expect.arrayContaining([
      "Fully Armed",          // itemHasName(i, FULLY_ARMED_NAME) — константа файла
      "Tracking Aim",         // hasAbility(a, TRACKING_AIM_CAPABILITY, "Tracking Aim") — ключ-константа
      "Black Eyes",           // itemIs(i, "mutation", КЛЮЧ, NAME)
      "Takedown",             // hasAbility(a, TAKEDOWN.key, TAKEDOWN.name) — таблица
      "Savior",               // hasAbility(a, t.key, t.name) — строка MELEE_TALENTS в рантайме
      "Rancor",               // hasLeadershipTalent(actor, RANCOR_NAMES) — массив помощнику
      "Летающий",             // FLIGHT_TRAIT_NAMES.some(n => itemHasName(i, n))
      "Teacher",              // hasTalent(actor, "Teacher")
      "Clear Mind",           // hasItem(actor, "trait", "Clear Mind")
      "Прыжок в Седло"        // hasTalent(actor, "Saddle Jump", "Прыжок в Седло")
    ]));
  });

  it("у каждого имени есть носитель в packs-src", () => {
    const missing = [];
    for (const [name, where] of names) {
      if (name in KNOWN_GAPS) continue;
      if (docs.some(d => itemHasName(d, name))) continue;
      missing.push(`«${name}» — ${where.join(", ")}`);
    }
    expect(missing, [
      "Код опознаёт эти предметы по имени, а в packs-src такого имени нет.",
      "Механика молча не работает: предмет не находится, условие всегда ложно.",
      "Чинить в packs-src (имя документа), а не в коде — если только имя в коде не опечатка."
    ].join("\n")).toEqual([]);
  });

  it("искомое имя — одна половина, а не двуязычная пара целиком", () => {
    // itemHasName сравнивает искомое с ПОЛОВИНАМИ имени предмета: двуязычное
    // имя режется по «/». Значит пара «Eng / Рус», переданная целиком, не
    // совпадёт НИ С ЧЕМ, и проверка будет вечно ложной — тихо, без ошибки.
    //
    // Ловушка не выдуманная: так была вечно ложной проверка «эта Черта у
    // актора уже есть» в combat/beastman-shaman.mjs (Символ Власти), и от
    // повторной выдачи спасал только внешний гейт по флагу. Рядом в том же
    // файле половину брали правильно, через engHalf.
    const pairs = [...names]
      .filter(([name]) => name.includes("/"))
      .map(([name, where]) => `«${name}» — ${where.join(", ")}`);
    expect(pairs, [
      "Здесь искомым передана двуязычная пара целиком — такое не совпадёт никогда.",
      "Передавайте одну половину: itemHasName сам найдёт предмет по любой из них."
    ].join("\n")).toEqual([]);
  });

  it("у каждого известного расхождения названа бида", () => {
    // Без этого список стал бы местом, куда прячут неудобные имена: добавил
    // строку — тест снова зелёный, а механика как не работала, так и не
    // работает, и никто про неё больше не вспомнит.
    const nameless = Object.entries(KNOWN_GAPS)
      .filter(([, why]) => !/wdbc-[a-z0-9.]+/.test(why))
      .map(([name]) => name);
    expect(nameless, "у этих строк KNOWN_GAPS не названа бида").toEqual([]);
  });

  it("известное расхождение перестало быть расхождением — строку убрать", () => {
    // Обратная сторона списка: если имя в паках починили, а строка осталась,
    // сторож перестаёт следить за этим именем незаметно.
    const fixed = Object.keys(KNOWN_GAPS).filter(name => docs.some(d => itemHasName(d, name)));
    expect(fixed, "эти имена уже находятся в packs-src — уберите их из KNOWN_GAPS").toEqual([]);
  });
});
