// test/rules/burned-senses.test.mjs
//
// Burned Senses / Выжженные Чувства (wdbc-1rno, Общие Мутации): чистая
// логика таблицы чувств и того, у какого чувства есть реальная механика
// потери (только Зрение/Слух). Сам грант/применение условия — module/apps/
// burned-senses.mjs, интеграционные тесты там же.

import { describe, it, expect } from "vitest";
import { burnedSenseFromRoll, senseKeyFromName, burnedSenseConditionKey, SENSE_LABELS }
  from "../../module/rules/burned-senses.mjs";

describe("burnedSenseFromRoll", () => {
  it("книжная таблица d10 — все десять граней", () => {
    expect(burnedSenseFromRoll(1)).toBe("sight");
    expect(burnedSenseFromRoll(2)).toBe("touch");
    expect(burnedSenseFromRoll(3)).toBe("touch");
    expect(burnedSenseFromRoll(4)).toBe("hearing");
    expect(burnedSenseFromRoll(5)).toBe("hearing");
    expect(burnedSenseFromRoll(6)).toBe("hearing");
    expect(burnedSenseFromRoll(7)).toBe("smell");
    expect(burnedSenseFromRoll(8)).toBe("smell");
    expect(burnedSenseFromRoll(9)).toBe("taste");
    expect(burnedSenseFromRoll(10)).toBe("taste");
  });

  it("вне диапазона — null, не падает", () => {
    expect(burnedSenseFromRoll(0)).toBeNull();
    expect(burnedSenseFromRoll(11)).toBeNull();
    expect(burnedSenseFromRoll(undefined)).toBeNull();
  });
});

describe("senseKeyFromName", () => {
  it("книжное название → ключ, без учёта регистра", () => {
    expect(senseKeyFromName("Зрение")).toBe("sight");
    expect(senseKeyFromName("слух")).toBe("hearing");
    expect(senseKeyFromName("ВКУС")).toBe("taste");
  });

  it("незнакомое имя — null", () => {
    expect(senseKeyFromName("Шестое чувство")).toBeNull();
    expect(senseKeyFromName("")).toBeNull();
    expect(senseKeyFromName(undefined)).toBeNull();
  });

  it("обратимо с SENSE_LABELS для всех пяти ключей", () => {
    for (const [key, label] of Object.entries(SENSE_LABELS)) {
      expect(senseKeyFromName(label)).toBe(key);
    }
  });
});

describe("burnedSenseConditionKey", () => {
  it("Зрение → blinded, Слух → deafened", () => {
    expect(burnedSenseConditionKey("sight")).toBe("blinded");
    expect(burnedSenseConditionKey("hearing")).toBe("deafened");
  });

  it("Касание/Нюх/Вкус — null (честный нарратив, механики нет)", () => {
    expect(burnedSenseConditionKey("touch")).toBeNull();
    expect(burnedSenseConditionKey("smell")).toBeNull();
    expect(burnedSenseConditionKey("taste")).toBeNull();
  });

  it("незнакомый ключ — null, не падает", () => {
    expect(burnedSenseConditionKey(null)).toBeNull();
    expect(burnedSenseConditionKey("sixth")).toBeNull();
  });
});
