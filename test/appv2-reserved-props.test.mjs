// test/appv2-reserved-props.test.mjs
//
// СТОРОЖ ОДНОЙ ОШИБКИ, из-за которой окно не открывается вообще и молча.
//
// Живая проверка 07.09.2026 (wdbc-gy9n): пункт Настроек «Итоги Сессии»
// нажимался, и не происходило НИЧЕГО — ни окна, ни сообщения об ошибке.
// Причина: конструктор писал `this.form = {...}`, а `form` у ApplicationV2 —
// собственный геттер (DOM-элемент формы) БЕЗ сеттера. Присваивание бросает
// «Cannot set property form of #<ApplicationV2> which has only a getter» ещё
// в конструкторе, до первого рендера, и исключение уходит в необработанный
// промис обработчика Foundry. На экране — тишина.
//
// Ошибку не ловят ни линтер, ни обычные тесты: имя поля выглядит совершенно
// невинно, а падение случается только внутри настоящего Foundry. Поэтому
// сторож читает исходники и сверяется со списком занятых имён.
//
// Список снят с самого движка (client/applications/api/application.mjs и
// handlebars-application.mjs установленной сборки): все эти свойства объявлены
// геттерами, и НИ У ОДНОГО из них нет сеттера.
//
// ПРАВИЛО: своё состояние приложения хранить под своим именем (`picks`,
// `chosen`, `draft`), а не под именем, которое уже занял ApplicationV2.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Геттеры ApplicationV2 и HandlebarsApplicationMixin, у которых нет сеттера. */
const RESERVED = [
  "window", "classList", "id", "title", "element", "form", "minimized",
  "rendered", "state", "hasFrame", "children", "parent", "parts"
];

const ASSIGN_RE = new RegExp(
  String.raw`\bthis\.(${RESERVED.join("|")})\s*(?:=[^=]|\?\?=|\|\|=|\+=)`
);

/** Файлы, где вообще может жить наследник ApplicationV2. */
function appFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) appFiles(full, out);
    else if (name.endsWith(".mjs")) {
      const src = fs.readFileSync(full, "utf8");
      if (/extends\s+\w*(?:ApplicationV2|SheetV2|Mixin\()/.test(src) ||
          /HandlebarsApplicationMixin\(/.test(src))
        out.push({ path: path.relative(ROOT, full).split(path.sep).join("/"), src });
    }
  }
  return out;
}

describe("занятые имена ApplicationV2 не перезаписываются", () => {
  const files = appFiles(path.join(ROOT, "module"));

  it("наследники ApplicationV2 в проекте вообще нашлись", () => {
    // Если сторож перестанет что-либо находить, он замолчит и пропустит
    // следующую такую же ошибку — а выглядеть будет зелёным.
    expect(files.length).toBeGreaterThan(5);
  });

  it("ни один не пишет в свойство, у которого только геттер", () => {
    const offenders = [];
    for (const file of files) {
      file.src.split(/\r?\n/).forEach((raw, i) => {
        const line = raw.replace(/\/\/.*$/, "");   // в комментариях имена называют нарочно
        const hit = line.match(ASSIGN_RE);
        if (hit) offenders.push(`${file.path}:${i + 1}  this.${hit[1]} = …`);
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
