// test/migrations/sight-angle.test.mjs
//
// Стопка #482-#504 ставит угол обзора 210° только НОВЫМ акторам (хук
// preCreateActor). У прежних акторов и их токенов остался 360°, и атака со
// слепой стороны по ним молча не срабатывала (wdbc-bjy1.6).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { actorSightAngleFix, sceneSightAngleFixes } from "../../module/migrations/sight-angle.mjs";
import { isUnsetSightAngle, DEFAULT_SIGHT_ANGLE_DEGREES } from "../../module/combat/facing.mjs";

const actor = (angle) => ({ prototypeToken: { sight: { angle } } });

describe("какой угол считается ненастроенным", () => {
  it("пусто, 0 и Foundry-дефолт 360", () => {
    for (const a of [undefined, null, 0, 360]) expect(isUnsetSightAngle(a)).toBe(true);
  });
  it("любой другой угол — чья-то настройка", () => {
    for (const a of [90, 210, 359]) expect(isUnsetSightAngle(a)).toBe(false);
  });
});

describe("прототип актора", () => {
  it("старый актор с 360° получает 210°", () => {
    expect(actorSightAngleFix(actor(360))).toEqual({ "prototypeToken.sight.angle": DEFAULT_SIGHT_ANGLE_DEGREES });
    expect(DEFAULT_SIGHT_ANGLE_DEGREES).toBe(210);
  });
  it("настроенный угол не трогаем — второй прогон ничего не находит", () => {
    expect(actorSightAngleFix(actor(210))).toBe(null);
    expect(actorSightAngleFix(actor(120))).toBe(null);
  });
});

describe("токены на сцене", () => {
  it("правятся только токены с ненастроенным углом, пакетом по id", () => {
    const scene = { tokens: { contents: [
      { id: "a", sight: { angle: 360 } },
      { id: "b", sight: { angle: 90 } },
      { id: "c", sight: {} }
    ] } };
    expect(sceneSightAngleFixes(scene)).toEqual([
      { _id: "a", "sight.angle": 210 },
      { _id: "c", "sight.angle": 210 }
    ]);
  });
});
