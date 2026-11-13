import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { eliteRaceMatch } from "../../module/sheets/elite-picker.mjs";

// «Человек» в требованиях Элитного архетипа по книге (стр. 114, «Расы») —
// «все расы людей, аблюдей, мутантов и т. п., т. е. “не Космодесантник”».
// Раньше метка покрывала только пять рас: Репликант, Йигори, Зверолюд, Гарпия,
// Нага и Сплайс не видели архетипы «Человека» вовсе.

const actorOf = (race, subrace = "") => ({ system: { race, subrace } });
const match = (race, subrace) => eliteRaceMatch(actorOf(race, subrace), { race: "Человек" });

describe("«Человек» у Элитного архетипа = любая раса, кроме Космодесантника", () => {
  it.each(["human", "ogryn", "ratling", "squat", "beastman", "replicant", "yigori", "harpy", "naga", "splice"])(
    "раса %s подходит",
    race => expect(match(race)).toBe(true)
  );

  it("Человек с любой субрасой подходит (мутант, навигатор, пария…)", () => {
    expect(match("human", "mutant")).toBe(true);
    expect(match("human", "navigator")).toBe(true);
    expect(match("human", "pariah")).toBe(true);
  });

  it("Космодесантник не подходит", () => {
    expect(match("astartes")).toBe(false);
  });

  // Решение владельца 03.11.2026: у эльдар и сслитов своя книга архетипов,
  // «Человек» их не охватывает. Полуэльдар: в «Ответвлениях» сказано лишь, что
  // обычный (не элитный) Архетип они выбирают с ГМом, элитных «человеческих»
  // прямо не разрешено — поэтому исключены вместе с остальными эльдарами.
  it.each(["azuriane", "drukhari", "ynnari", "halfEldar", "harlequin", "exodite", "sslyth"])(
    "раса %s не подходит под «Человека»",
    race => expect(match(race)).toBe(false)
  );

  it.each(["eldanar", "truebornDrukhari", "mandrake", "wrack", "grayman"])(
    "эльдарская субраса %s не подходит под «Человека»",
    sub => expect(match("", sub)).toBe(false)
  );

  it("пустая раса актора подходит (как и раньше)", () => {
    expect(match("")).toBe(true);
  });

  it("метка с перечислением («Человек, Развалина») по-прежнему работает по частям", () => {
    const a = actorOf("astartes");
    expect(eliteRaceMatch(a, { race: "Человек, Космодесантник" })).toBe(true);
    expect(eliteRaceMatch(a, { race: "Человек" })).toBe(false);
  });

  it("другие метки не затронуты", () => {
    expect(eliteRaceMatch(actorOf("human"), { race: "Космодесантник" })).toBe(false);
    expect(eliteRaceMatch(actorOf("astartes"), { race: "Космодесантник" })).toBe(true);
    expect(eliteRaceMatch(actorOf("human"), { race: "Друкхари" })).toBe(false);
    expect(eliteRaceMatch(actorOf("drukhari"), { race: "Любая" })).toBe(true);
  });
});
