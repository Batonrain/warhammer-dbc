// test/constants/aeldari-paths.test.mjs
//
// Свойство Aspect (wdbc-8b5/wdbc-28ld): сопоставление текста рейтинга
// («Варп-Пауки») с ключом Пути из AZURIANE_PATHS по подстроке label.

import { describe, it, expect } from "vitest";
import { findAspectPathKey, actorHasAspectPath } from "../../module/constants/aeldari-paths.mjs";

describe("findAspectPathKey", () => {
  it("находит Путь по короткому имени в скобках label", () => {
    expect(findAspectPathKey("Варп-Пауки")).toBe("warpspider");
  });

  it("нечувствителен к регистру", () => {
    expect(findAspectPathKey("варп-пауки")).toBe("warpspider");
  });

  it("находит остальные Пути Воина по короткому имени", () => {
    expect(findAspectPathKey("Воющие Баньши")).toBe("banshee");
    expect(findAspectPathKey("Жалящие Скорпионы")).toBe("scorpion");
  });

  it("пустой/пробельный текст — null", () => {
    expect(findAspectPathKey("")).toBeNull();
    expect(findAspectPathKey("   ")).toBeNull();
    expect(findAspectPathKey(undefined)).toBeNull();
  });

  it("нераспознанный текст — null", () => {
    expect(findAspectPathKey("Несуществующая Группа")).toBeNull();
  });
});

describe("actorHasAspectPath", () => {
  it("текст не распознан — считается «есть» (не штрафуем на плохих данных)", () => {
    expect(actorHasAspectPath({ paths: [] }, "Несуществующая Группа")).toBe(true);
  });

  it("персонаж с нужным Путём — есть", () => {
    const system = { paths: [{ key: "warpspider", grade: "novice" }] };
    expect(actorHasAspectPath(system, "Варп-Пауки")).toBe(true);
  });

  it("персонаж без нужного Пути — нет", () => {
    const system = { paths: [{ key: "banshee", grade: "novice" }] };
    expect(actorHasAspectPath(system, "Варп-Пауки")).toBe(false);
  });

  it("у персонажа вообще нет Путей — нет", () => {
    expect(actorHasAspectPath({ paths: [] }, "Варп-Пауки")).toBe(false);
    expect(actorHasAspectPath({}, "Варп-Пауки")).toBe(false);
  });
});
