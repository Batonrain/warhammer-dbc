// Живой Стяг: соратник в поле зрения находится по TokenDocument (живая проверка pr-584).
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { alliesSeeingDocs } from "../../module/combat/living-banner.mjs";

const grid = { size: 100, distance: 1 };
const doc = (id, x, y, sight = { range: 0, angle: 360 }) => ({ id, x, y, width: 1, height: 1, rotation: 0, elevation: 0, sight });

describe("Живой Стяг — кто видит Герольда", () => {
  it("соратник рядом видит, дальний — нет", () => {
    const herald = doc("h", 0, 0);
    const near = doc("a", 500, 0);
    const far = doc("b", 10000, 0);
    expect(alliesSeeingDocs(herald, [near, far], grid).map(d => d.id)).toEqual(["a"]);
  });
});
