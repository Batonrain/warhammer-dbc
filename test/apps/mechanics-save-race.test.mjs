// test/apps/mechanics-save-race.test.mjs
//
// wdbc-kntg: два быстрых клика подряд в Конструкторе теряли первую правку.
//
// Обработчики панели устроены как «прочитать getItemMechanics → поправить
// копию → сохранить набор групп ЦЕЛИКОМ» (module/sheets/item-sheet.mjs, все
// on(".grant-...")). Чтение синхронное, запись асинхронная: пока setFlag шёл
// на сервер, второй клик читал ещё старые данные и перезаписывал ими всё.
//
// Тест воспроизводит ровно эту последовательность — два обработчика подряд,
// без ожидания между ними, поверх медленного сохранения.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { getItemMechanics, saveItemMechanics } from "../../module/apps/mechanics.mjs";

const FLAG = "warhammer-dbc";

/** Предмет с медленным setFlag — как настоящий, ходящий на сервер. */
function slowItem(delay = 5) {
  const flags = { [FLAG]: { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e1", kind: "capability", capabilityKey: "test.key", when: {} }
  ] }] } };
  return {
    id: "item-1", uuid: "Item.item-1", name: "Тестовый предмет", isOwner: true,
    type: "gear", system: { effects: {} }, effects: [],
    update: async () => {},
    createEmbeddedDocuments: async () => [],
    deleteEmbeddedDocuments: async () => [],
    getFlag: (scope, key) => flags[scope]?.[key],
    setFlag: async (scope, key, value) => {
      await new Promise(r => setTimeout(r, delay));
      (flags[scope] ??= {})[key] = value;
    }
  };
}

/** Один клик по галочке условия — тот же порядок действий, что на листе. */
const clickQuality = (item, qualityKey) => {
  const arr = structuredClone(getItemMechanics(item));
  const entry = arr[0].entries[0];
  entry.when = entry.when || {};
  const quals = new Set(entry.when.quality || []);
  quals.add(qualityKey);
  entry.when.quality = [...quals];
  return saveItemMechanics(item, arr);
};

const savedQuality = item =>
  [...(item.getFlag(FLAG, "mechanics")[0].entries[0].when.quality || [])].sort();

describe("Конструктор: два сохранения подряд не теряют правку (wdbc-kntg)", () => {
  it("две галочки подряд без паузы — сохраняются обе", async () => {
    const item = slowItem();
    // Именно так и кликает человек: второй раз до того, как первый долетел.
    const first  = clickQuality(item, "good");
    const second = clickQuality(item, "best");
    await Promise.all([first, second]);

    expect(savedQuality(item)).toEqual(["best", "good"]);
  });

  it("четыре подряд — сохраняются все четыре", async () => {
    const item = slowItem();
    await Promise.all(["poor", "common", "good", "best"].map(q => clickQuality(item, q)));

    expect(savedQuality(item)).toEqual(["best", "common", "good", "poor"]);
  });

  it("до подтверждения чтение отдаёт уже записанное, а не старое из документа", async () => {
    const item = slowItem();
    const pending = clickQuality(item, "good");
    // setFlag ещё не завершился — документ хранит старое, но обработчик,
    // который сейчас начнёт свою правку, обязан увидеть свежее.
    expect(getItemMechanics(item)[0].entries[0].when.quality).toEqual(["good"]);
    await pending;
    expect(savedQuality(item)).toEqual(["good"]);
  });

  it("после завершения очереди чтение снова идёт из документа", async () => {
    const item = slowItem();
    await clickQuality(item, "good");
    // Подмена снята: значение то же, но приходит уже из самого предмета.
    item.getFlag = () => [{ id: "g", operator: "AND", entries: [{ id: "e1", when: { quality: ["best"] } }] }];
    expect(getItemMechanics(item)[0].entries[0].when.quality).toEqual(["best"]);
  });

  it("упавшее сохранение не оставляет предмет с подменённым чтением навсегда", async () => {
    const item = slowItem();
    item.setFlag = async () => { throw new Error("сервер отказал"); };
    await expect(clickQuality(item, "good")).rejects.toThrow("сервер отказал");
    // Документ не изменился, и чтение вернулось к нему, а не к неудавшейся правке.
    expect(getItemMechanics(item)[0].entries[0].when).toEqual({});
  });

  it("сохранения разных предметов не выстраиваются в общую очередь", async () => {
    const a = slowItem();
    const b = slowItem();
    b.id = "item-2"; b.uuid = "Item.item-2";
    await Promise.all([clickQuality(a, "good"), clickQuality(b, "best")]);

    expect(savedQuality(a)).toEqual(["good"]);
    expect(savedQuality(b)).toEqual(["best"]);
  });
});
