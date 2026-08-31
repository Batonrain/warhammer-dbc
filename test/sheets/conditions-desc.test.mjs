// test/sheets/conditions-desc.test.mjs
//
// Откуда число (wdbc-zbiz), вторая половина: наведение на «Оглушение» раньше
// не говорило, что оно делает — надо было открывать книгу. Каждая запись
// CONDITIONS_DEF должна нести непустой desc (текст по книге), который потом
// уходит в title тега (templates/actor/parts/tab-effects.hbs).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { CONDITIONS_DEF } from "../../module/sheets/sheet-helpers.mjs";

describe("CONDITIONS_DEF: desc непуст для каждого состояния", () => {
  for (const [key, def] of Object.entries(CONDITIONS_DEF)) {
    it(`${key} (${def.label}) несёт непустой desc`, () => {
      expect(typeof def.desc).toBe("string");
      expect(def.desc.trim().length).toBeGreaterThan(0);
    });
  }
});
