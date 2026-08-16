// test/tools/pack-file-names.test.mjs
//
// Имя файла в packs-src задаёт распаковщик: CI собирает пак и разбирает его
// обратно, после чего требует, чтобы packs-src не изменился. Генераторы кладут
// документы в packs-src сами, и своё правило имени у них расходилось с каноном
// на двуязычных названиях: « / » распаковщик пишет тремя подчёркиваниями, а
// генератор — одним, отчего сдвигалась и обрезка. Для CI это выглядело как
// «сборка компендиумов теряет документ».

import { describe, it, expect } from "vitest";
import path from "node:path";
import { packFileName } from "../../tools/pack-file-name.mjs";
import { raceDocs } from "../../tools/races-to-pack.mjs";
import { libraryDocs } from "../../tools/race-traits.mjs";

// Имя файла берём platform-независимо: генераторы строят путь через path.join,
// и на Windows разделитель обратный. Резать строку по «/» значило проверять на
// Windows целый путь вместо имени — тест краснел там, где всё верно, и зеленел
// на CI.
const stem = p => path.basename(p);

describe("генераторы именуют файлы правилом распаковщика", () => {
  it.each([
    ["Acrobatic Mastery / Акробатическое Мастерство", "Wlip2fVM1XQHPVPS"],
    ["Дары Цегораха / Базовые Черты Арлекина", "NKSVuIzoJOrZGH5u"],
    ["Hulking / Громила (Легион)", "2JxSkBO4Plq90YKi"]
  ])("%s", (name, id) => {
    expect(packFileName(name, id)).toBe(
      `${name.replace(/[^a-zA-Z0-9А-я]/g, "_").slice(0, 40)}_${id}.json`);
  });

  it("все документы генераторов названы каноном", () => {
    const wrong = [...raceDocs(), ...libraryDocs()]
      .filter(({ path, doc }) => stem(path) !== packFileName(doc.name, doc._id))
      .map(({ path }) => stem(path));

    expect(wrong).toEqual([]);
  });
});
