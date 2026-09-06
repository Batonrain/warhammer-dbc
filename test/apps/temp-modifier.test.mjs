// test/apps/temp-modifier.test.mjs
//
// wdbc-5qvo: «на три Хода −10 к Ловкости» должно вешаться эффектом с именем
// источника, сроком и снятием одним крестиком, а не числом в поле «Мод.»,
// про которое негде прочитать, откуда оно и до каких пор.
//
// Проверяется форма данных эффекта — то, от чего зависит, дойдёт ли штраф до
// расчёта листа вообще. Фаза здесь не косметика: "final" легла бы поверх уже
// посчитанного Значения и не дошла бы ни до навыков, ни до брони.

import { describe, it, expect } from "vitest";

import { tempModifierData, isTempModifier, TEMP_MODIFIER_FLAG }
  from "../../module/apps/temp-modifier.mjs";
import { expectedPhase } from "../../module/constants/effect-keys.mjs";
import { rowSourceName } from "../../module/apps/effects-summary.mjs";

describe("tempModifierData: форма временного модификатора (wdbc-5qvo)", () => {
  it("целится в хранимое поле характеристики и в фазу, которую расчёт не перетрёт", () => {
    const data = tempModifierData({ charKey: "ag", value: -10 });
    const [change] = data.system.changes;
    expect(change.key).toBe("system.characteristics.ag.totalFx");
    expect(change.type).toBe("add");
    expect(change.value).toBe(-10);
    // Ровно та фаза, которой этот ключ требует по реестру ключей эффектов.
    expect(change.phase).toBe(expectedPhase(change.key));
    expect(change.phase).toBe("initial");
  });

  it("имя источника попадает в имя эффекта ВМЕСТЕ с числом", () => {
    // Ради источника всё и затевалось, но одного его мало: в сводке ДЕБАФОВ
    // источником показывается сам актор, и две гранаты, наложившие
    // «Ослепление» на −10 и на −20, дали бы две неразличимые строки.
    const data = tempModifierData({ charKey: "ag", value: -10, source: "Ослепляющая граната" });
    expect(data.name).toBe("Ослепляющая граната (Ag −10)");
    const other = tempModifierData({ charKey: "ag", value: -20, source: "Ослепляющая граната" });
    expect(other.name).not.toBe(data.name);
  });

  it("без источника имя всё равно осмысленное: характеристика и число", () => {
    expect(tempModifierData({ charKey: "ag", value: -10 }).name).toBe("Ag −10");
    expect(tempModifierData({ charKey: "ws", value: 5 }).name).toBe("WS +5");
  });

  it("срок переводится в duration Foundry, который ядро тикает само", () => {
    const data = tempModifierData({ charKey: "ag", value: -10, duration: 3, unit: "rounds" });
    expect(data.duration).toEqual({ value: 3, units: "rounds" });
  });

  it("без срока duration пуст — бессрочный штраф не должен истечь на первом же раунде", () => {
    expect(tempModifierData({ charKey: "ag", value: -10 }).duration).toBeNull();
    expect(tempModifierData({ charKey: "ag", value: -10, duration: 3, unit: "" }).duration).toBeNull();
  });

  it("помечен флагом — по нему сводка рисует крестик снятия", () => {
    const data = tempModifierData({ charKey: "ag", value: -10 });
    expect(data.flags["warhammer-dbc"][TEMP_MODIFIER_FLAG]).toBe(true);
    expect(isTempModifier(data)).toBe(true);
  });

  it("чужой эффект временным не считается — крестика у него быть не должно", () => {
    expect(isTempModifier({ name: "Черта", flags: {} })).toBe(false);
    expect(isTempModifier(null)).toBe(false);
  });

  it("бонус тоже можно: механизм про знаковый модификатор, не только про штраф", () => {
    const data = tempModifierData({ charKey: "s", value: 20, source: "Боевые стимуляторы" });
    expect(data.system.changes[0].value).toBe(20);
    expect(data.name).toBe("Боевые стимуляторы (S +20)");
  });
});

// ── Строка в сводке ЭФФЕКТОВ (найдено живой проверкой 06.09.2026) ─────────
//
// Временный модификатор — единственный эффект, который лежит ПРЯМО НА АКТОРЕ,
// а не приходит с предмета. Сводка брала источником `source.name`, и для него
// источником числился сам актор: в ДЕБАФАХ печаталось имя того же персонажа,
// чей лист открыт, вместо «Ослепляющая граната (Ag −10)». При двух дебафах
// сразу их было не различить.
describe("сводка ЭФФЕКТОВ: чей это эффект (wdbc-5qvo)", () => {
  it("эффект на самом акторе назван СВОИМ именем, а не именем актора", () => {
    const effect = { name: "Ослепляющая граната (Ag −10)", img: "fx.svg" };
    const actor  = { name: "Иван Грозный", img: "portrait.png" };
    expect(rowSourceName({ effect, source: actor, fromItem: false }))
      .toBe("Ослепляющая граната (Ag −10)");
  });

  it("эффект предмета по-прежнему назван предметом — регресса нет", () => {
    const effect = { name: "Силовой меч (эффект)" };
    const item   = { name: "Силовой меч" };
    expect(rowSourceName({ effect, source: item, fromItem: true })).toBe("Силовой меч");
  });

  it("у предмета без имени остаётся имя эффекта, иначе прочерк", () => {
    expect(rowSourceName({ effect: { name: "X" }, source: {}, fromItem: true })).toBe("X");
    expect(rowSourceName({ effect: {}, source: {}, fromItem: true })).toBe("—");
    expect(rowSourceName({ effect: {}, source: {}, fromItem: false })).toBe("—");
  });
});
