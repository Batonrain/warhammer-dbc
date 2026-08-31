// test/rules/corruption-madness.test.mjs
//
// wdbc-gzuf (Серый Человек): «считает Cor как Безумие» — широкое прочтение
// по решению пользователя, любое изменение Порчи (рост и снижение)
// перенаправляется в Безумие той же величиной, Порча сама не меняется.

import { describe, it, expect } from "vitest";
import { redirectCorruptionToMadness } from "../../module/rules/corruption-madness.mjs";

describe("redirectCorruptionToMadness", () => {
  it("рост Cor уходит в рост Безумия, Cor не меняется", () => {
    expect(redirectCorruptionToMadness(10, 15, 5)).toEqual({ corruption: 10, insanity: 10 });
  });

  it("снижение Cor тоже уходит в Безумие — как рост, с тем же знаком", () => {
    expect(redirectCorruptionToMadness(20, 12, 30)).toEqual({ corruption: 20, insanity: 22 });
  });

  it("без изменения Cor — null, апдейт не трогаем", () => {
    expect(redirectCorruptionToMadness(10, 10, 5)).toBeNull();
  });

  it("Безумие не уходит в минус даже при большом снижении Cor", () => {
    expect(redirectCorruptionToMadness(20, 0, 3)).toEqual({ corruption: 20, insanity: 0 });
  });
});
