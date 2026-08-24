// test/combat/scatter.test.mjs
//
// Роза смещения: d10 дистанция + d8 направление. Переиспользуемый бросок под
// любую атаку по площади (сейчас — только Взрывное «под цель», attack.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { rollScatter, SCATTER_ROSE } from "../../module/combat/scatter.mjs";

beforeEach(() => resetCaptured());

describe("роза смещения", () => {
  it("бросает d10 дистанции и d8 направления, направление берётся из розы по номеру", async () => {
    captured.dice = [6, 3];   // дистанция 6, направление 3 → «Вправо»

    const sc = await rollScatter();

    expect(sc.distance).toBe(6);
    expect(sc.dir).toEqual({ n: 3, label: "Вправо", icon: "➡️", deg: 90 });
    // Именно d10 + d8 и именно в этом порядке — индексация розы держится на d8.
    expect(captured.rolls).toEqual(["1d10", "1d8"]);
  });

  it("крайние значения розы — 1 «Вперёд» и 8 «Вперёд-влево»", async () => {
    captured.dice = [1, 1];
    expect((await rollScatter()).dir).toEqual(SCATTER_ROSE[0]);

    captured.dice = [10, 8];
    expect((await rollScatter()).dir).toEqual(SCATTER_ROSE[7]);
  });

  it("роза — 8 направлений по часовой стрелке без повторов", () => {
    expect(SCATTER_ROSE).toHaveLength(8);
    expect(new Set(SCATTER_ROSE.map(d => d.n)).size).toBe(8);
  });

  it("deg — 45° шагом по часовой стрелке от «Вперёд» (0°)", () => {
    expect(SCATTER_ROSE.map(d => d.deg)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  });
});
