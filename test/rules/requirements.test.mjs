// test/rules/requirements.test.mjs
//
// Requirement — обобщённый гейт «можно ли получить/держать предмет»
// (doombc-req-condition-effect-plan). Без Foundry: актор — подставной объект
// { items: [...], system: {...} }, тот же приём, что у predicates.test.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  blankReqEntry, blankReqGroup, blankReqBlock,
  reqEntryOk, describeReqEntry, reqGroupOk, reqBlockMet,
  getReqBlocks, itemVisibleFor, itemHardBlockedFor, unmetSecondaryBlocks
} from "../../module/rules/requirements.mjs";
import { setFactionIndex, clearFactionIndex } from "../../module/rules/factions.mjs";

const actor = (over = {}) => ({
  items: [], system: { corruption: { value: 0 }, insanity: { value: 0 }, characteristics: {} },
  ...over
});

const item = (blocks = []) => ({ flags: { "warhammer-dbc": { reqBlocks: blocks } } });

describe("заготовки", () => {
  it("blankReqEntry/Group/Block дают рабочие дефолты без Foundry", () => {
    expect(blankReqEntry().kind).toBe("item");
    expect(blankReqEntry().mode).toBe("need");
    expect(blankReqGroup().operator).toBe("AND");
    expect(blankReqGroup().entries).toHaveLength(1);
    const b = blankReqBlock();
    expect(b.tier).toBe("secondary");
    expect(b.forbid).toBe(false);
  });
});

describe("kind:\"item\" — генерик drag&drop", () => {
  it("незаполненная запись (нет itemName) ничего не гейтит", () => {
    expect(reqEntryOk(actor(), { kind: "item", itemName: "" })).toBe(true);
  });

  it("проверяет наличие предмета данного типа и имени у актора", () => {
    const e = { kind: "item", itemType: "trait", itemName: "Безбожник", mode: "need" };
    expect(reqEntryOk(actor(), e)).toBe(false);
    const a = actor({ items: [{ type: "trait", name: "Безбожник", system: {} }] });
    expect(reqEntryOk(a, e)).toBe(true);
  });

  it("двуязычное имя и тип не совпадает — не считается", () => {
    const e = { kind: "item", itemType: "talent", itemName: "Gene-Seed", mode: "need" };
    const a = actor({ items: [{ type: "trait", name: "Gene-Seed / Геносемя", system: {} }] });
    expect(reqEntryOk(a, e)).toBe(false); // тип не совпал
    const a2 = actor({ items: [{ type: "talent", name: "Gene-Seed / Геносемя", system: {} }] });
    expect(reqEntryOk(a2, e)).toBe(true); // тип совпал, имя — по любой половине
  });

  it("порог рейтинга ≥ у найденного предмета", () => {
    const e = { kind: "item", itemType: "trait", itemName: "Natural Armour", rating: "4", mode: "need" };
    const low = actor({ items: [{ type: "trait", name: "Natural Armour", system: { rating: 2 } }] });
    const high = actor({ items: [{ type: "trait", name: "Natural Armour", system: { rating: 5 } }] });
    expect(reqEntryOk(low, e)).toBe(false);
    expect(reqEntryOk(high, e)).toBe(true);
  });

  it("режим «Нельзя» переворачивает результат", () => {
    const e = { kind: "item", itemType: "trait", itemName: "Безбожник", mode: "forbid" };
    const has = actor({ items: [{ type: "trait", name: "Безбожник", system: {} }] });
    const hasnt = actor();
    expect(reqEntryOk(has, e)).toBe(false);
    expect(reqEntryOk(hasnt, e)).toBe(true);
  });
});

describe("kind:\"numeric\" — Характеристика/Порча/Безумие", () => {
  it("Характеристика ≥/≤ порога", () => {
    const a = actor({ system: { characteristics: { s: { total: 45 } }, corruption: {}, insanity: {} } });
    expect(reqEntryOk(a, { kind: "numeric", charKey: "s", op: "atLeast", value: 40 })).toBe(true);
    expect(reqEntryOk(a, { kind: "numeric", charKey: "s", op: "atLeast", value: 50 })).toBe(false);
    expect(reqEntryOk(a, { kind: "numeric", charKey: "s", op: "atMost", value: 40 })).toBe(false);
  });

  it("Порча/Безумие читаются из своих полей, не characteristics", () => {
    const a = actor({ system: { corruption: { value: 30 }, insanity: { value: 5 }, characteristics: {} } });
    expect(reqEntryOk(a, { kind: "numeric", numericTarget: "corruption", op: "atLeast", value: 20 })).toBe(true);
    expect(reqEntryOk(a, { kind: "numeric", numericTarget: "insanity", op: "atLeast", value: 20 })).toBe(false);
  });

  it("режим «Нельзя» — например, запрет при высокой Порче", () => {
    const e = { kind: "numeric", numericTarget: "corruption", op: "atLeast", value: 50, mode: "forbid" };
    const clean = actor({ system: { corruption: { value: 10 }, insanity: {}, characteristics: {} } });
    const corrupt = actor({ system: { corruption: { value: 60 }, insanity: {}, characteristics: {} } });
    expect(reqEntryOk(clean, e)).toBe(true);
    expect(reqEntryOk(corrupt, e)).toBe(false);
  });
});

describe("kind:\"faction\" — принадлежность, не предмет", () => {
  beforeEach(() => setFactionIndex([
    { key: "chaos", name: "Хаос" },
    { key: "word-bearers", name: "Несущие Слово", parentKey: "chaos" }
  ]));
  afterEach(() => clearFactionIndex());

  it("пусто в записи — ничего не гейтит", () => {
    expect(reqEntryOk(actor(), { kind: "faction", factionKey: "" })).toBe(true);
  });

  it("считает нижестоящих: III рота Несущих Слово подходит под «Хаос»", () => {
    const a = actor({ items: [{ type: "faction", system: { key: "word-bearers" } }] });
    expect(reqEntryOk(a, { kind: "faction", factionKey: "chaos" })).toBe(true);
    expect(reqEntryOk(actor(), { kind: "faction", factionKey: "chaos" })).toBe(false);
  });
});

describe("группа И/ИЛИ", () => {
  it("пустая группа — всегда выполнена", () => {
    expect(reqGroupOk(actor(), { operator: "AND", entries: [] })).toBe(true);
  });

  it("И — все записи обязаны пройти", () => {
    const g = {
      operator: "AND",
      entries: [
        { kind: "item", itemType: "trait", itemName: "A" },
        { kind: "item", itemType: "trait", itemName: "B" }
      ]
    };
    const a = actor({ items: [{ type: "trait", name: "A", system: {} }] });
    expect(reqGroupOk(a, g)).toBe(false);
    a.items.push({ type: "trait", name: "B", system: {} });
    expect(reqGroupOk(a, g)).toBe(true);
  });

  it("ИЛИ — достаточно одной", () => {
    const g = {
      operator: "OR",
      entries: [
        { kind: "item", itemType: "trait", itemName: "A" },
        { kind: "item", itemType: "trait", itemName: "B" }
      ]
    };
    const a = actor({ items: [{ type: "trait", name: "B", system: {} }] });
    expect(reqGroupOk(a, g)).toBe(true);
  });
});

describe("уровни жёсткости блока", () => {
  it("Secondary никогда не прячет и не блокирует — только сам не «выполнен»", () => {
    const block = { tier: "secondary", forbid: false, group: { operator: "AND", entries: [{ kind: "item", itemType: "trait", itemName: "X" }] } };
    const i = item([block]);
    expect(itemVisibleFor(actor(), i)).toBe(true);
    expect(itemHardBlockedFor(actor(), i)).toBe(false);
    expect(unmetSecondaryBlocks(actor(), i)).toHaveLength(1);
  });

  it("Primary без Requirement не мешает видимости (нечего проверять)", () => {
    const block = { tier: "primary", forbid: false, group: { operator: "AND", entries: [] } };
    expect(itemVisibleFor(actor(), item([block]))).toBe(true);
  });

  it("Primary прячет из пикеров, но НЕ блокирует ручной drag&drop", () => {
    const block = { tier: "primary", forbid: false, group: { operator: "AND", entries: [{ kind: "item", itemType: "trait", itemName: "X" }] } };
    const i = item([block]);
    expect(itemVisibleFor(actor(), i)).toBe(false);
    expect(itemHardBlockedFor(actor(), i)).toBe(false);
    const has = actor({ items: [{ type: "trait", name: "X", system: {} }] });
    expect(itemVisibleFor(has, i)).toBe(true);
  });

  it("Primary + Запрет блокирует и видимость, и ручной drag&drop", () => {
    const block = { tier: "primary", forbid: true, group: { operator: "AND", entries: [{ kind: "item", itemType: "trait", itemName: "X" }] } };
    const i = item([block]);
    expect(itemVisibleFor(actor(), i)).toBe(false);
    expect(itemHardBlockedFor(actor(), i)).toBe(true);
    const has = actor({ items: [{ type: "trait", name: "X", system: {} }] });
    expect(itemHardBlockedFor(has, i)).toBe(false);
  });

  it("Мутация Кхорна из примера пользователя: Primary+Запрет (Кхорнит) + Secondary (Избранный)", () => {
    const primary = { tier: "primary", forbid: true, group: { operator: "AND", entries: [{ kind: "item", itemType: "trait", itemName: "Khornate" }] } };
    const secondary = { tier: "secondary", forbid: false, group: { operator: "AND", entries: [{ kind: "item", itemType: "eliteArchetype", itemName: "Избранный" }] } };
    const mutation = item([primary, secondary]);

    // не-кхорнит: жёстко заблокирован целиком
    expect(itemHardBlockedFor(actor(), mutation)).toBe(true);

    // кхорнит без архетипа Избранного: получить можно, но secondary не выполнен
    const khornate = actor({ items: [{ type: "trait", name: "Khornate", system: {} }] });
    expect(itemHardBlockedFor(khornate, mutation)).toBe(false);
    expect(unmetSecondaryBlocks(khornate, mutation)).toHaveLength(1);

    // кхорнит-Избранный: всё выполнено
    khornate.items.push({ type: "eliteArchetype", name: "Избранный", system: {} });
    expect(unmetSecondaryBlocks(khornate, mutation)).toHaveLength(0);
  });

  it("несколько Primary-блоков (плейсхолдер-дефолт И): все обязаны пройти", () => {
    const p1 = { tier: "primary", forbid: false, group: { operator: "AND", entries: [{ kind: "item", itemType: "trait", itemName: "A" }] } };
    const p2 = { tier: "primary", forbid: false, group: { operator: "AND", entries: [{ kind: "item", itemType: "trait", itemName: "B" }] } };
    const i = item([p1, p2]);
    const onlyA = actor({ items: [{ type: "trait", name: "A", system: {} }] });
    expect(itemVisibleFor(onlyA, i)).toBe(false);
    onlyA.items.push({ type: "trait", name: "B", system: {} });
    expect(itemVisibleFor(onlyA, i)).toBe(true);
  });
});

describe("описание записи", () => {
  it("даёт читаемую подпись по виду, включая «НЕ» для forbid", () => {
    expect(describeReqEntry({ kind: "item", itemName: "" })).toMatch(/перетащите/);
    expect(describeReqEntry({ kind: "item", itemName: "Безбожник" })).toBe("Предмет: Безбожник");
    expect(describeReqEntry({ kind: "item", itemName: "Безбожник", mode: "forbid" })).toBe("НЕ Предмет: Безбожник");
    expect(describeReqEntry({ kind: "numeric", numericTarget: "corruption", op: "atLeast", value: 40 })).toBe("Порча ≥ 40");
    expect(describeReqEntry({ kind: "faction", factionKey: "" })).toMatch(/не выбрана/);
  });
});

describe("getReqBlocks / reqBlockMet", () => {
  it("нормализует отсутствующий флаг в пустой массив", () => {
    expect(getReqBlocks({})).toEqual([]);
    expect(getReqBlocks({ flags: {} })).toEqual([]);
  });

  it("reqBlockMet — обёртка над reqGroupOk блока", () => {
    const block = blankReqBlock();
    block.group.entries = [];
    expect(reqBlockMet(actor(), block)).toBe(true);
  });
});
