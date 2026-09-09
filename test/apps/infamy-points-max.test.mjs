// test/apps/infamy-points-max.test.mjs
//
// actorInfamyMax (wdbc-k1hc): максимум пула Очков Бесчестия у Хаосита/
// Демон-Принца — Inf.b, а не хранимый system.fate.max (та же развилка, что
// у actor-sheet.mjs::_infamyMax/hud.mjs — расхождение с fate.max объявлено
// багом, не альтернативной механикой).

import { describe, it, expect } from "vitest";
import { actorInfamyMax } from "../../module/apps/infamy-points.mjs";

describe("actorInfamyMax", () => {
  it("Хаосит (alignment heretic) — Inf.b, не fate.max", () => {
    const actor = { type: "character", system: {
      alignment: "heretic", fate: { max: 3 }, characteristics: { inf: { bonus: 4 } }
    } };
    expect(actorInfamyMax(actor)).toBe(4);
  });

  it("Демон-Принц — Inf.b тоже, fate.max у него роли не играет", () => {
    const actor = { type: "demonPrince", system: {
      fate: { max: 9 }, characteristics: { inf: { bonus: 5 } }
    } };
    expect(actorInfamyMax(actor)).toBe(5);
  });

  it("обычный лоялист — собственный system.fate.max", () => {
    const actor = { type: "character", system: {
      alignment: "loyalist", fate: { max: 3 }, characteristics: { inf: { bonus: 4 } }
    } };
    expect(actorInfamyMax(actor)).toBe(3);
  });

  it("отрицательное/нечисловое значение клампится в 0", () => {
    expect(actorInfamyMax({ type: "character", system: { alignment: "heretic" } })).toBe(0);
    expect(actorInfamyMax({ type: "character", system: {} })).toBe(0);
    expect(actorInfamyMax({ type: "character" })).toBe(0);
  });
});
