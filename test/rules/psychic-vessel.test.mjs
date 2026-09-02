// test/rules/psychic-vessel.test.mjs
//
// Общий примитив «через кого сейчас манифестирует псайкер» (wdbc-q30d) —
// делится между Путём Силы Псайбер-Фамильяра (constants/psyker.mjs,
// PSY_PATHS.familiar) и Spirit Talk (combat/spirit-talk.mjs). Ссылку хранит
// псайкер флагом, не полем схемы. module/rules/psychic-vessel.mjs.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { getPsychicVessel, setPsychicVessel, clearPsychicVessel } from "../../module/rules/psychic-vessel.mjs";

function actorWithFlags() {
  const flags = {};
  return {
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; }
  };
}

describe("getPsychicVessel", () => {
  it("нет носителя — null", () => {
    expect(getPsychicVessel(actorWithFlags())).toBeNull();
  });
  it("нет актора — null, не падает", () => {
    expect(getPsychicVessel(null)).toBeNull();
  });
});

describe("setPsychicVessel", () => {
  it("записывает uuid и имя носителя", async () => {
    const psyker = actorWithFlags();
    const vessel = { uuid: "Actor.v1", name: "Захваченный Призрачный Страж" };
    await setPsychicVessel(psyker, vessel);
    expect(getPsychicVessel(psyker)).toEqual({ uuid: "Actor.v1", name: "Захваченный Призрачный Страж" });
  });

  it("явная label перекрывает имя актора", async () => {
    const psyker = actorWithFlags();
    await setPsychicVessel(psyker, { uuid: "Actor.v1", name: "Тех. имя" }, { label: "Фамильяр Кроу" });
    expect(getPsychicVessel(psyker).name).toBe("Фамильяр Кроу");
  });

  it("повторный вызов перезаписывает предыдущего носителя", async () => {
    const psyker = actorWithFlags();
    await setPsychicVessel(psyker, { uuid: "Actor.v1", name: "Первый" });
    await setPsychicVessel(psyker, { uuid: "Actor.v2", name: "Второй" });
    expect(getPsychicVessel(psyker)).toEqual({ uuid: "Actor.v2", name: "Второй" });
  });

  it("нет псайкера или носителя — не падает, ничего не пишет", async () => {
    await expect(setPsychicVessel(null, { uuid: "x" })).resolves.toBeUndefined();
    const psyker = actorWithFlags();
    await expect(setPsychicVessel(psyker, null)).resolves.toBeUndefined();
    expect(getPsychicVessel(psyker)).toBeNull();
  });
});

describe("clearPsychicVessel", () => {
  it("снимает носителя", async () => {
    const psyker = actorWithFlags();
    await setPsychicVessel(psyker, { uuid: "Actor.v1", name: "Носитель" });
    await clearPsychicVessel(psyker);
    expect(getPsychicVessel(psyker)).toBeNull();
  });
  it("нет носителя — не падает", async () => {
    await expect(clearPsychicVessel(actorWithFlags())).resolves.toBeUndefined();
  });
  it("нет актора — не падает", async () => {
    await expect(clearPsychicVessel(null)).resolves.toBeUndefined();
  });
});
