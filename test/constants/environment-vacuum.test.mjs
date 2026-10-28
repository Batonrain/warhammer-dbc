// test/constants/environment-vacuum.test.mjs
//
// Флаг «вакуум» окна «Окружение» (core стр. 483): по умолчанию воздух есть,
// старые сцены (без поля) вакуума не получают, включается только явным true.

import { describe, it, expect } from "vitest";
import { defaultEnv, normalizeEnv, envView, vacuumEffect } from "../../module/constants/environment.mjs";

describe("флаг вакуума сцены", () => {
  it("по умолчанию воздух есть", () => {
    expect(defaultEnv().vacuum).toBe(false);
    expect(normalizeEnv(null).vacuum).toBe(false);
  });

  it("старая сцена без поля — воздух есть; нестрогие значения вакуумом не считаются", () => {
    expect(normalizeEnv({ temp: 20 }).vacuum).toBe(false);
    expect(normalizeEnv({ vacuum: "yes" }).vacuum).toBe(false);
    expect(normalizeEnv({ vacuum: 1 }).vacuum).toBe(false);
  });

  it("явное true сохраняется, соседние поля не страдают", () => {
    const e = normalizeEnv({ vacuum: true, rad: 3, gravity: 0 });
    expect(e).toMatchObject({ vacuum: true, rad: 3, gravity: 0 });
  });

  it("вид для окна и виджета: подпись и пометка активности", () => {
    expect(envView(normalizeEnv({ vacuum: true })).vacuum).toMatchObject({ active: true, label: "Вакуум" });
    expect(envView(normalizeEnv({})).vacuum).toMatchObject({ active: false });
    expect(vacuumEffect(true).note).toMatch(/Blinding\(0\)/);
  });
});
