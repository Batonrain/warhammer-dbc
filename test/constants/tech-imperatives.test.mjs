// test/constants/tech-imperatives.test.mjs
//
// module/constants/tech-imperatives.mjs (wdbc-yu32) — числовые бонусы
// Evasion/Fortress Imperative, найденные по имени предмета (itemHasName).

import { describe, it, expect } from "vitest";
import { findTechImperative, TECH_IMPERATIVES } from "../../module/constants/tech-imperatives.mjs";

describe("findTechImperative", () => {
  it("находит Evasion Imperative по имени формата «English / Русский»", () => {
    expect(findTechImperative({ name: "Evasion Imperative / Императив Избегания" })).toMatchObject(TECH_IMPERATIVES["Evasion Imperative"]);
  });

  it("находит Fortress Imperative", () => {
    expect(findTechImperative({ name: "Fortress Imperative / Императив Крепости" })).toMatchObject(TECH_IMPERATIVES["Fortress Imperative"]);
  });

  it("прочие Техночудеса — null", () => {
    expect(findTechImperative({ name: "Noospheric Uplink / Ноосферный Аплинк" })).toBeNull();
  });
});
