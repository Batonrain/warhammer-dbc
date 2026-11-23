// test/rules/minion-trait-pick.test.mjs
//
// Генератор Миньона: какой Трейт компендиума берётся за строку таблицы книги
// (rules/minion-build.mjs::pickMinionTraitEntry). Живая проверка 21.11.2026:
// зверь-слуга вместо «Bite / Укус (X)» получал Черту Медузы «Deadly Natural
// Weapon (2, Tentacles; 7, Bite)» — индекс пака идёт по _id, и первым
// попадался документ, чьё имя просто СОДЕРЖАЛО «Bite».

import { describe, it, expect } from "vitest";
import { pickMinionTraitEntry } from "../../module/rules/minion-build.mjs";

// Порядок — как в индексе пака (по _id): чужие Черты идут раньше нужных.
const INDEX = [
  { _id: "BG570MapBYWdEcFE", name: "Deadly Natural Weapon (2, Tentacles; 7, Bite) / Deadly Natural Weapon (2, Щупальца; 7, Укус)", folder: "mbaAZsAG0NwHzzZC" },
  { _id: "a1", name: "Chaos Psyker / Псайкер Хаоса", folder: null },
  { _id: "a2", name: "Machine Spirit Thief / Вор Духов Машины", folder: "f1" },
  { _id: "a3", name: "Nimble (10) / Проворный", folder: "f2" },
  { _id: "a4", name: "Size (+1) / Размер (+1)", folder: "f2" },
  { _id: "a5", name: "From Beyond / Извне", folder: "mbaAZsAG0NwHzzZC" },
  { _id: "a6", name: "Daemonic Dread (−20 W) / Демонический Ужас (−20 к W)", folder: "f3" },
  { _id: "a7", name: "Daemonic (+3) / Демонический", folder: "f3" },
  { _id: "b1", name: "Machine / Машина (X)", folder: null },
  { _id: "b2", name: "Psyker / Псайкер", folder: null },
  { _id: "b3", name: "Nimble / Проворный", folder: null },
  { _id: "b4", name: "Size / Размер (X)", folder: null },
  { _id: "b5", name: "From Beyond / Не От Мира Сего", folder: null },
  { _id: "b6", name: "Blades (X) / Лезвия (X)", folder: null },
  { _id: "uKUYswX8k0nK3U5F", name: "Bite / Укус (X)", folder: null }
];

const pick = name => pickMinionTraitEntry(INDEX, name)?.name;

describe("pickMinionTraitEntry: Трейт компендиума за строку таблицы Миньона", () => {
  it("Bite — свой «Bite / Укус (X)», не Черта Медузы", () => {
    expect(pick("Bite")).toBe("Bite / Укус (X)");
  });

  it("имя должно начинаться с ключа: Psyker, Machine не ловят чужие Черты", () => {
    expect(pick("Psyker")).toBe("Psyker / Псайкер");
    expect(pick("Machine")).toBe("Machine / Машина (X)");
  });

  it("общий «(X)» и голое имя важнее частного значения", () => {
    expect(pick("Size")).toBe("Size / Размер (X)");
    expect(pick("Nimble")).toBe("Nimble / Проворный");
    expect(pick("Daemonic")).toBe("Daemonic (+3) / Демонический");
  });

  it("при равенстве — Трейт из корня пака, не из папки архетипа", () => {
    expect(pick("From Beyond")).toBe("From Beyond / Не От Мира Сего");
  });

  it("ключ таблицы с профилем книги ищется по имени пака (`pack`)", () => {
    expect(pick("Blades (1d10+2 R, Pen 0)")).toBe("Blades (X) / Лезвия (X)");
  });

  it("ничего подходящего — null, без «похожих» подстановок", () => {
    expect(pickMinionTraitEntry(INDEX, "Amorphous")).toBeNull();
    expect(pickMinionTraitEntry([], "Bite")).toBeNull();
  });
});
