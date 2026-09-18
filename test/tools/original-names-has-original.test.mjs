// test/tools/original-names-has-original.test.mjs
//
// wdbc-ssbb: hasOriginal() считал «оригинал уже есть» по наличию ЛЮБОЙ
// латинской буквы в имени, а не по наличию реального разделителя "English /
// Русское" — "Y-Визор" (без "/") проходил как имеющий оригинал из-за одной
// буквы Y. Найдено агентом packs-editor при работе над wdbc-o30i.

import { describe, it, expect } from "vitest";
import { hasOriginal } from "../../tools/original-names-from-books.mjs";

describe("hasOriginal", () => {
  it("латиница без разделителя '/' не считается оригиналом", () => {
    expect(hasOriginal({ name: "Y-Визор" })).toBe(false);
  });

  it("настоящая пара 'English / Русское' считается оригиналом", () => {
    expect(hasOriginal({ name: "Y-Visor / Y-Визор" })).toBe(true);
  });

  it("чисто русское имя без латиницы — оригинала нет", () => {
    expect(hasOriginal({ name: "Панцирная Кираса" })).toBe(false);
  });

  it("system.originalName перебивает проверку по name", () => {
    expect(hasOriginal({ name: "Русское Имя", system: { originalName: "English Name" } })).toBe(true);
  });

  it("wdbc-o30i: обратный порядок 'Русское / English' тоже считается оригиналом", () => {
    expect(hasOriginal({ name: "Горный Байк / Mountain Bike" })).toBe(true);
  });
});
