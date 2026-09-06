// test/support/application-v2-state.test.mjs
//
// wdbc-v8b2: настоящий Foundry v14 объявляет ApplicationV2.prototype.state как
// геттер БЕЗ сеттера (render-состояние приложения). Наследник, по ошибке
// объявивший СВОЁ поле `state` через `this.state = {...}`, в реальном мире
// падает TypeError — а старая заглушка вообще не знала о `state` и тихо
// проглатывала присвоение как обычное поле объекта. wdbc-7l4r: VeilMystic и
// EnvironmentApp несли именно эту коллизию и падали только живьём, npm test
// был зелёным. Этот тест — на саму заглушку, не на игровую логику.

import { describe, it, expect } from "vitest";
import "./foundry-stub.mjs";

describe("foundry.applications.api.ApplicationV2 — state только для чтения", () => {
  it("наследник, присваивающий this.state в конструкторе, падает — как в реальном Foundry", () => {
    class Broken extends foundry.applications.api.ApplicationV2 {
      constructor() {
        super();
        this.state = { tab: "main" };
      }
    }
    expect(() => new Broken()).toThrow(TypeError);
  });

  it("класс, не трогающий state, создаётся нормально, а state читается как геттер", () => {
    class Fine extends foundry.applications.api.ApplicationV2 {
      constructor() { super(); this.uiState = { tab: "main" }; }
    }
    const app = new Fine();
    expect(app.uiState.tab).toBe("main");
    expect(typeof app.state).toBe("number");
  });

  it("тот же геттер унаследован V2-листами (ActorSheetV2/ItemSheetV2)", () => {
    class BrokenSheet extends foundry.applications.sheets.ActorSheetV2 {
      constructor() { super(); this.state = {}; }
    }
    expect(() => new BrokenSheet()).toThrow(TypeError);
  });
});
