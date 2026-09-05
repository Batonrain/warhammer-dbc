// test/rules/talent-name-literals.test.mjs
//
// Сторож против молчаливой поломки при переименовании (wdbc-iadw).
//
// 57 Талантов/Черт/имплантов/оружия опознаются в коде по литеральному имени —
// itemHasName(item, "Bone Song"), 93 вызова. Это ровно тот класс ошибки, о
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

/**
 * Имена, по которым код опознаёт предмет через itemHasName.
 *
 * Считаются ДВА вида записи, и второй не менее важен первого: половина
 * вызовов передаёт не литерал на месте, а константу файла
 * (`itemHasName(i, FULLY_ARMED_NAME)`). Сторож, знающий только литералы,
 * молча пропускал бы 23 таких имени — а наверх выносят как раз те, что
 * используются в нескольких местах, то есть самые важные.
 *
 * Имя-переменная времени выполнения (параметр функции) сюда не попадает и не
 * должна: такой договор складывается в рантайме, следить за ним нечем.
 */
function literalNames() {
  const found = new Map(); // имя → [«файл:строка», …]
  for (const file of filesIn(path.join(ROOT, "module"), ".mjs")) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    const consts = stringConstsOf(text);
    text.split(/\r?\n/).forEach((line, i) => {
      const add = (name) => {
        if (!found.has(name)) found.set(name, []);
        found.get(name).push(`${rel}:${i + 1}`);
      };
      for (const m of line.matchAll(/itemHasName\([^,]+,\s*"([^"]+)"/g)) add(m[1]);
      for (const m of line.matchAll(/itemHasName\([^,]+,\s*([A-Za-z_$][\w$]*)\s*[),]/g)) {
        const value = consts.get(m[1]);
        if (value !== undefined) add(value);
      }
      // hasAbility(actor, "ключ", "Имя", тип) — опознание переведено на ключ
      // Возможности (wdbc-iadw), но имя там осталось как запасной путь и
      // обязано совпадать с паком ровно так же. Без этой ветки сторож терял
      // бы имя каждый раз, когда очередной вызов переводят на ключ.
      for (const m of line.matchAll(/hasAbility\([^,]+,\s*"[^"]*",\s*"([^"]+)"/g)) add(m[1]);
      for (const m of line.matchAll(/hasAbility\([^,]+,\s*"[^"]*",\s*([A-Za-z_$][\w$]*)\s*[),]/g)) {
        const value = consts.get(m[1]);
        if (value !== undefined) add(value);
      }
    });
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
  // А это уже настоящая дыра, а не запасной путь: оружия нет в паках вовсе,
  // и элитный архетип «Малеарий» не может сработать ни при каких условиях.
  "Meteor Hammer": "wdbc-h1bx — Метеоритного Молота нет в packs-src/weapons, Талант «Малеарий» бумажный"
};

describe("имена предметов, зашитые в код, есть в packs-src", () => {
  const names = literalNames();
  const docs = packNames();

  it("разбор находит и литералы, и имена, вынесенные в константы", () => {
    // Порог не декоративный. Сузившийся разбор НЕ виден по красноте: сторож,
    // проверяющий меньше имён, остаётся зелёным. Числом он и ловится.
    // Считаются три формы записи: литерал на месте вызова, имя через
    // константу файла (`itemHasName(i, FULLY_ARMED_NAME)`) и третий аргумент
    // hasAbility — там имя осталось запасным путём после перевода опознания
    // на ключ Возможности (wdbc-iadw).
    expect(names.size).toBeGreaterThanOrEqual(78);
    expect(docs.length).toBeGreaterThan(1000);

    // Именно константная половина: без неё цифра просела бы, но убедимся
    // прямо, что такие имена в разборе есть.
    expect([...names.keys()]).toContain("Fully Armed");
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
