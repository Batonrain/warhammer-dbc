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

/**
 * Литеральные имена из вызовов itemHasName(..., "Имя") по всему module/.
 * Вычисляемое второе слово (переменная, поле) сюда не попадает — за такими
 * именами сторож не следит, и это честно: он проверяет ровно те договоры,
 * которые записаны в коде буквой.
 */
function literalNames() {
  const found = new Map(); // имя → [«файл:строка», …]
  for (const file of filesIn(path.join(ROOT, "module"), ".mjs")) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
      for (const m of line.matchAll(/itemHasName\([^,]+,\s*"([^"]+)"/g)) {
        if (!found.has(m[1])) found.set(m[1], []);
        found.get(m[1]).push(`${rel}:${i + 1}`);
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

  it("вызовы itemHasName с литеральным именем вообще находятся", () => {
    // Если разбор сломается (например, кто-то переименует itemHasName), тест
    // выше стал бы зелёным на пустом множестве и ничего не проверял.
    expect(names.size).toBeGreaterThan(40);
    expect(docs.length).toBeGreaterThan(1000);
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
