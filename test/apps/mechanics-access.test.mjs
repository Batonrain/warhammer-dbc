// test/apps/mechanics-access.test.mjs
//
// Кто настраивает Механику предмета. Вкладка была заперта признаком isGM, а
// запирать её нечем: Черты, Таланты и снаряжение лежат в компендиумах и в мире,
// и «своими» для игрока не бывают — по владению доступ давать не к чему.
// Настоящее условие одно: незапертый компендиум.
//
// Писать чужой документ клиенту не дают, поэтому сохранение разветвлено: свой
// предмет пишется на месте, чужой уходит Мастеру по системному сокету. Раньше
// такая правка молча пропадала.

import "../support/foundry-stub.mjs";

import { describe, it, expect, vi } from "vitest";
import { buildMechanicsTabHtml, saveItemMechanics } from "../../module/apps/mechanics.mjs";

/** Предмет с одной группой Механики: запись выдаёт Характеристику. */
const itemWithMech = (extra = {}) => ({
  uuid: "Item.abc",
  getFlag: (_scope, key) => key === "mechanics"
    ? [{ id: "g1", operator: "AND", entries: [{ id: "e1", kind: "char", charKey: "ws", value: 5 }] }]
    : undefined,
  ...extra
});

describe("Механика предмета: настраивают все, а не только Мастер", () => {
  it("предмет можно править — кнопки записей и живые поля", () => {
    const html = buildMechanicsTabHtml(itemWithMech(), true);

    expect(html).toContain('data-action="grantEntryAdd"');
    expect(html).toContain('data-action="grantEntryRemove"');
    expect(html).toContain('data-action="grantOpToggle"');
    expect(html).not.toContain("disabled");
  });

  it("запертый компендиум — те же записи, но только на просмотр", () => {
    const html = buildMechanicsTabHtml(itemWithMech(), false);

    expect(html).toContain("disabled");
    expect(html).not.toContain('data-action="grantEntryAdd"');
    expect(html).not.toContain('data-action="grantEntryRemove"');
  });

  it("свой предмет пишется на месте", async () => {
    const setFlag = vi.fn();
    const item = itemWithMech({ isOwner: true, setFlag, effects: [], system: {} });
    const emit = vi.fn();
    globalThis.game = { ...globalThis.game, user: { id: "u1" }, socket: { emit } };

    await saveItemMechanics(item, [{ id: "g2", operator: "OR", entries: [] }]);

    expect(setFlag).toHaveBeenCalledWith("warhammer-dbc", "mechanics", [{ id: "g2", operator: "OR", entries: [] }]);
    expect(emit).not.toHaveBeenCalled();
  });

  it("чужой предмет — правка уходит Мастеру, а не пропадает", async () => {
    const setFlag = vi.fn();
    const item = itemWithMech({ isOwner: false, setFlag });
    const emit = vi.fn();
    globalThis.game = {
      ...globalThis.game,
      user: { id: "u1" }, users: { activeGM: { id: "gm" } }, socket: { emit }
    };

    const groups = [{ id: "g2", operator: "OR", entries: [] }];
    await saveItemMechanics(item, groups);

    expect(setFlag).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith("system.warhammer-dbc",
      { action: "itemMechanics", uuid: "Item.abc", groups, userId: "u1" });
  });
});

// wdbc-4umq (7): три вида записи «Щит: …» читаются ТОЛЬКО у type:"forcefield";
// на Черте или Таланте они прошли бы проверку заполненности и молча ничего
// не сделали — в выпадающем списке их там быть не должно.
describe("Виды «Щит: …» в списке — только у силового поля", () => {
  const shieldOpts = ['value="shieldSubtype"', 'value="shieldVsCondition"', 'value="shieldArmorGate"'];
  it("у Черты их в списке нет", () => {
    const html = buildMechanicsTabHtml(itemWithMech({ type: "trait" }), true);
    for (const o of shieldOpts) expect(html).not.toContain(o);
  });
  it("у силового поля — есть", () => {
    const html = buildMechanicsTabHtml(itemWithMech({ type: "forcefield" }), true);
    for (const o of shieldOpts) expect(html).toContain(o);
  });
  it("уже выбранный вид не пропадает из списка молча", () => {
    const item = { type: "trait", uuid: "Item.t", getFlag: (_s, key) => key === "mechanics"
      ? [{ id: "g1", operator: "AND", entries: [{ id: "e1", kind: "shieldArmorGate" }] }] : undefined };
    expect(buildMechanicsTabHtml(item, true)).toContain('value="shieldArmorGate"');
  });
});
