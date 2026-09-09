// test/rules/fleshmetal-regen.test.mjs
//
// «Укрепление Плотеметаллом» (wdbc-dnoj): +1 аблативная Рана в час и +1
// Ablative-брони в час. В книге у роста НЕТ верхнего предела, и именно поэтому
// правило годами оставалось неперенесённым: буквальный перенос дал бы +24 за
// сутки простоя и дальше без конца.
//
// Решение владельца 07.09.2026: «До стартового значения» — регенерация
// доводит пул обратно до его максимума и там останавливается. Максимум уже
// хранится схемой, придумывать число не пришлось.
//
// Здесь проверяется и то, ради чего правило существует (пул восстанавливается
// сам), и то, что удерживает его от абсурда (потолок, отсутствие долга за
// прошлое, неполные часы не сгорают).

import { describe, it, expect } from "vitest";
import { hoursElapsed, regenPool, planFleshmetalRegen, HOUR }
  from "../../module/rules/fleshmetal-regen.mjs";

const actor = (aW, aWMax, aA, aAMax) => ({
  wounds: { ablative: aW, ablativeMax: aWMax },
  ablativeApShield: { value: aA, max: aAMax }
});

describe("часы с последней выдачи", () => {
  it("считает только ЦЕЛЫЕ часы", () => {
    expect(hoursElapsed(0, HOUR - 1)).toBe(0);
    expect(hoursElapsed(0, HOUR)).toBe(1);
    expect(hoursElapsed(0, HOUR * 3 + 59)).toBe(3);
  });

  it("метки нет — ноль: за прошлое кампании долг не начисляем", () => {
    expect(hoursElapsed(null, HOUR * 1000)).toBe(0);
    expect(hoursElapsed(undefined, HOUR * 1000)).toBe(0);
  });

  it("время отмотали назад — ноль, а не отрицательные часы", () => {
    expect(hoursElapsed(HOUR * 10, HOUR * 2)).toBe(0);
  });
});

describe("потолок пула", () => {
  it("растёт по часу и упирается в максимум", () => {
    expect(regenPool(3, 10, 4)).toBe(7);
    expect(regenPool(9, 10, 4)).toBe(10);
    expect(regenPool(10, 10, 4)).toBe(10);
  });

  it("пула нет (максимум 0) — не трогаем вовсе", () => {
    // Иначе Укрепление начало бы выращивать аблативные Раны персонажу,
    // у которого их не бывает.
    expect(regenPool(0, 0, 5)).toBe(0);
  });
});

describe("план регенерации для актора", () => {
  it("первый проход только ставит метку и ничего не начисляет", () => {
    const plan = planFleshmetalRegen(actor(0, 6, 0, 4), null, 12345);
    expect(plan.update).toEqual({});
    expect(plan.flagAt).toBe(12345);
  });

  it("прошло два часа — по +2 в оба пула", () => {
    const plan = planFleshmetalRegen(actor(1, 6, 0, 4), 0, HOUR * 2);
    expect(plan.update).toEqual({
      "system.wounds.ablative": 3,
      "system.ablativeApShield.value": 2
    });
    expect(plan.gained).toEqual({ wounds: 2, armour: 2 });
  });

  it("оба пула полны — писать нечего, но метка всё равно сдвигается", () => {
    const plan = planFleshmetalRegen(actor(6, 6, 4, 4), 0, HOUR * 5);
    expect(plan.update).toEqual({});
    expect(plan.flagAt).toBe(HOUR * 5);
  });

  it("не прошло и часа — null, никакой записи в базу", () => {
    // Хук зовётся на КАЖДЫЙ тик времени у всех акторов: лишний update на
    // каждого стоит дороже самой механики.
    expect(planFleshmetalRegen(actor(1, 6, 1, 4), 0, HOUR - 1)).toBeNull();
  });

  it("неполный час не сгорает: метка сдвигается на выданные часы, а не на «сейчас»", () => {
    const plan = planFleshmetalRegen(actor(0, 6, 0, 4), 0, HOUR + 40 * 60);
    expect(plan.flagAt).toBe(HOUR);           // а не HOUR + 2400
    // Через двадцать минут после этого набежит второй час.
    const next = planFleshmetalRegen(actor(1, 6, 1, 4), plan.flagAt, HOUR * 2);
    expect(next.update["system.wounds.ablative"]).toBe(2);
  });

  it("восстанавливается только тот пул, у которого есть максимум", () => {
    const plan = planFleshmetalRegen(actor(2, 6, 0, 0), 0, HOUR * 3);
    expect(plan.update).toEqual({ "system.wounds.ablative": 5 });
  });
});
