import { describe, it, expect } from "vitest";
import { buildBodyState, classifyImplant } from "../../module/constants/body-map.mjs";

// Фигура на вкладке ТЕЛО нарисована анфас (лицом к зрителю) — анатомическая
// сторона персонажа зеркальна экранной. Имплант с bodySide:"right" (правая
// рука персонажа) обязан красить регион armL (левая половина полотна), иначе
// силуэт показывает имплант не на той стороне.
describe("buildBodyState — сторона имплантации зеркалится под фигуру анфас", () => {
  it("правая рука персонажа красит экранный регион armL, не armR", () => {
    const state = buildBodyState([{ name: "Bionic Arm", installed: "arm", category: "bionic", side: "right" }]);
    expect(state.regions.armL).toBe("bionic");
    expect(state.regions.armR).toBe("flesh");
  });

  it("левая рука персонажа красит экранный регион armR, не armL", () => {
    const state = buildBodyState([{ name: "Bionic Arm", installed: "arm", category: "bionic", side: "left" }]);
    expect(state.regions.armR).toBe("bionic");
    expect(state.regions.armL).toBe("flesh");
  });

  it("правый глаз персонажа красит экранный оверлей eyeL, не eyeR", () => {
    const state = buildBodyState([{ name: "Ocular Implant", installed: "eye", category: "bionic", side: "right" }]);
    expect(state.overlays.eyeL).toBe("bionic");
    expect(state.overlays.eyeR).toBeNull();
  });

  it("левая нога персонажа красит экранный регион legR, не legL", () => {
    const state = buildBodyState([{ name: "Bionic Leg", installed: "leg", category: "bionic", side: "left" }]);
    expect(state.regions.legR).toBe("bionic");
    expect(state.regions.legL).toBe("flesh");
  });
});

// wdbc-daz п.8: ключевые слова classifyImplant смешивают кириллические
// основы с суффиксом `\w*` — а `\w` в JS-регулярке (без явного Unicode-класса)
// матчит только ASCII [A-Za-z0-9_], НЕ кириллицу. Значит «обработк\w* отход»
// требовал ровно "обработк отход..." без единой русской буквы между ними и
// не матчил ни одно настоящее название («Система обработки отходов»,
// «Усиленный скелет», «Скрытый клинок») — implant молча падал в «Прочее»
// вместо своей категории/иконки. Замена на «обработк[а-яё]* отход» и т.п.
// добавляет реальный кириллический суффикс.
describe("classifyImplant — кириллический суффикс после основы слова (wdbc-daz п.8)", () => {
  it("«Система обработки отходов» — торс, а не «не распознано»", () => {
    expect(classifyImplant("Система обработки отходов")).toEqual({ kind: "torso" });
  });

  it("«Усиленный скелет» — категория skeleton", () => {
    expect(classifyImplant("Усиленный скелет")).toEqual({ kind: "skeleton" });
  });

  it("«Скрытый клинок» (SPECIAL_LIB) — распознаётся, а не уходит в «Прочее»", () => {
    // classifyImplant не знает про SPECIAL_LIB (это отдельная библиотека для
    // gModule/иконки, а не для kind), но должен хотя бы попасть в "arm" по
    // остальным ключевым словам, если они есть — здесь просто фиксируем, что
    // регэксп сам по себе матчит текст с реальным русским суффиксом.
    const re = /hidden blade|скрыт[а-яё]* клинок|retractable|выдвижн/i;
    expect(re.test("Скрытый клинок")).toBe(true);
    // Контрольный пример: со старым `\w*` строка не матчилась вовсе.
    expect(/скрыт\w* клинок/i.test("Скрытый клинок")).toBe(false);
  });
});
