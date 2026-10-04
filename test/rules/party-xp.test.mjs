// test/rules/party-xp.test.mjs
//
// Опыт новичка (стр. 23): планка — наименее опытный из текущих персонажей.

import { describe, it, expect } from "vitest";
import { leastExperienced } from "../../module/rules/party-xp.mjs";

const party = [
  { id: "a", name: "Первый", total: 9000 },
  { id: "b", name: "Второй", total: 7500 },
  { id: "c", name: "Третий", total: 12000 }
];

describe("leastExperienced", () => {
  it("берёт наименьший ОБЩИЙ опыт", () => {
    expect(leastExperienced(party)).toEqual({ id: "b", name: "Второй", xp: 7500 });
  });

  it("сам новичок планкой не считается", () => {
    expect(leastExperienced([...party, { id: "me", name: "Новичок", total: 0 }], "me").xp).toBe(7500);
  });

  it("сравнивать не с кем — null, а не ноль", () => {
    // Ноль выдал бы первому персонажу партии нулевой опыт молча.
    expect(leastExperienced([])).toBeNull();
    expect(leastExperienced([{ id: "me", name: "Я", total: 100 }], "me")).toBeNull();
    expect(leastExperienced()).toBeNull();
  });

  it("у кого опыта нет вовсе — считается нулём", () => {
    expect(leastExperienced([{ id: "x", name: "Икс" }, party[0]]).xp).toBe(0);
  });
});
