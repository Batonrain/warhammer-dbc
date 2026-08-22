// test/apps/aptitude-keys.test.mjs
//
// Списки выбора Склонностей (Мастер создания, оба его поколения) берут подпись
// как APTITUDES[key]. Ключ, которого в APTITUDES нет, рисуется пустой фишкой —
// именно так «Влияние» и осталось висеть в APT_CHAR_KEYS после того, как
// Склонность убрали из реестра.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { APT_CHAR_KEYS, APT_OTHER_KEYS, APT_PICK } from "../../module/apps/creation.mjs";
import { APTITUDES } from "../../module/constants/characteristics.mjs";

describe("ключи выбора Склонностей", () => {
  it.each([...APT_CHAR_KEYS, ...APT_OTHER_KEYS])("«%s» есть в APTITUDES", (key) => {
    expect(APTITUDES[key]).toBeTruthy();
  });

  it("выбрать можно не больше, чем предложено", () => {
    expect(APT_CHAR_KEYS.length).toBeGreaterThanOrEqual(APT_PICK.char);
    expect(APT_OTHER_KEYS.length).toBeGreaterThanOrEqual(APT_PICK.other);
  });
});
