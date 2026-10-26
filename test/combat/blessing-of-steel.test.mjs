// test/combat/blessing-of-steel.test.mjs
//
// Благословение Стали (Таланты Механикума, Sahara 3-cc96 п.3; DoomBC — Основная
// книга): «Потратив 5 минут на ритуал, персонаж может благословить оружие или
// набор брони, увеличив их Качество на 1 до конца следующего боя. Только один
// предмет одновременно.»

import { describe, it, expect, beforeEach, vi } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { startBlessingOfSteel, clearBlessingOfSteel, blessedQuality, hasBlessingOfSteel }
  from "../../module/combat/blessing-of-steel.mjs";
import { runTalentAction, talentActionsHtml } from "../../module/apps/talent-actions.mjs";

function gear(id, type, quality) {
  const flags = {};
  const it = {
    id, type, name: `${type}-${id}`, system: { quality }, flags: {},
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async d => { for (const [k, v] of Object.entries(d)) if (k === "system.quality") it.system.quality = v; }
  };
  return it;
}
const talent = () => ({ id: "t", type: "talent", name: "Blessing of Steel / Благословение Стали", system: {}, flags: {}, getFlag: () => undefined });

function actor(items) {
  const col = [...items];
  col.get = id => col.find(i => i.id === id);
  return { id: "a", name: "Техножрец", items: col, system: {}, getFlag: () => undefined };
}

const bless = async (a, id) => {
  const p = startBlessingOfSteel(a);
  await captured.press("go", fakeForm({ '[name="item"]': id }));
  return p;
};

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("Благословение Стали", () => {
  it("ступень Качества: Низкое → Обычное → Хорошее → Высшее → Высшее", () => {
    expect(blessedQuality("poor")).toBe("common");
    expect(blessedQuality("common")).toBe("good");
    expect(blessedQuality("good")).toBe("best");
    expect(blessedQuality("best")).toBe("best");
    expect(blessedQuality("мусор")).toBe("good"); // неизвестное = Обычное
  });

  it("Качество предмета растёт на ступень, прежнее лежит меткой на предмете", async () => {
    const sword = gear("w1", "weapon", "common");
    const a = actor([talent(), sword]);
    expect(await bless(a, "w1")).toBe(true);
    expect(sword.system.quality).toBe("good");
    expect(sword.getFlag("warhammer-dbc", "blessingOfSteel").originalQuality).toBe("common");
    expect(captured.chat.at(-1).content).toContain("Обычное");
  });

  it("только один предмет одновременно: новое благословение снимает прежнее", async () => {
    const sword = gear("w1", "weapon", "common");
    const plate = gear("a1", "armor", "good");
    const a = actor([talent(), sword, plate]);
    await bless(a, "w1");
    await bless(a, "a1");
    expect(sword.system.quality).toBe("common");
    expect(sword.getFlag("warhammer-dbc", "blessingOfSteel")).toBeUndefined();
    expect(plate.system.quality).toBe("best");
  });

  it("повторное благословение того же предмета ступень не удваивает", async () => {
    const sword = gear("w1", "weapon", "common");
    const a = actor([talent(), sword]);
    await bless(a, "w1");
    await bless(a, "w1");
    expect(sword.system.quality).toBe("good");
  });

  it("Высшее Качество выше не растёт — метки нет, система говорит об этом", async () => {
    const sword = gear("w1", "weapon", "best");
    const a = actor([talent(), sword]);
    expect(await bless(a, "w1")).toBe(false);
    expect(sword.getFlag("warhammer-dbc", "blessingOfSteel")).toBeUndefined();
    expect(captured.chat.at(-1).content).toContain("уже Высшее");
  });

  it("конец боя возвращает Качество; ритуал посреди боя переживает ЭТОТ бой", async () => {
    const sword = gear("w1", "weapon", "common");
    const a = actor([talent(), sword]);
    globalThis.game.combat = { id: "c1", started: true };
    await bless(a, "w1");
    await clearBlessingOfSteel({ id: "c1", combatants: [{ actor: a }] });
    expect(sword.system.quality).toBe("good");               // тот же бой — держится
    await clearBlessingOfSteel({ id: "c2", combatants: [{ actor: a }] });
    expect(sword.system.quality).toBe("common");              // следующий бой — снято
    expect(sword.getFlag("warhammer-dbc", "blessingOfSteel")).toBeUndefined();
  });

  it("ритуал вне боя снимается в конце первого же боя; предметы не участников не трогаются", async () => {
    const sword = gear("w1", "weapon", "common");
    const a = actor([talent(), sword]);
    await bless(a, "w1");
    await clearBlessingOfSteel({ id: "c1", combatants: [{ actor: actor([]) }] });
    expect(sword.system.quality).toBe("good");
    await clearBlessingOfSteel({ id: "c1", combatants: [{ actor: a }] });
    expect(sword.system.quality).toBe("common");
  });

  it("откат на ступень вниз и только если Качество всё ещё равно поставленному (Песня Изменений откатилась раньше)", async () => {
    // Песня подняла Обычное → Хорошее, благословение — Хорошее → Высшее.
    const sword = gear("w1", "weapon", "good");
    const a = actor([talent(), sword]);
    await bless(a, "w1");
    expect(sword.system.quality).toBe("best");
    // Песня раньше в deleteCombat откатывает «абсолютно» к прежнему Обычному.
    sword.system.quality = "common";
    await clearBlessingOfSteel({ id: "c9", combatants: [{ actor: a }] });
    expect(sword.system.quality).toBe("common");              // не «Хорошее» (прежний откат)
    expect(sword.getFlag("warhammer-dbc", "blessingOfSteel")).toBeUndefined();
  });

  it("откат при поднятом Песней Качестве: благословлённое Высшее → на ступень вниз", async () => {
    const sword = gear("w1", "weapon", "good");
    const a = actor([talent(), sword]);
    await bless(a, "w1");
    await clearBlessingOfSteel({ id: "c9", combatants: [{ actor: a }] });
    expect(sword.system.quality).toBe("good");
  });

  it("без Таланта и без оружия/брони — отказ", async () => {
    expect(hasBlessingOfSteel(actor([]))).toBe(false);
    expect(await startBlessingOfSteel(actor([gear("w1", "weapon", "common")]))).toBe(false);
    expect(await startBlessingOfSteel(actor([talent()]))).toBe(false);
    expect(captured.warnings.join()).toContain("нет оружия");
  });

  it("кнопка на листе Таланта есть и ведёт в действие", async () => {
    const a = actor([talent(), gear("w1", "weapon", "common")]);
    expect(talentActionsHtml(talent(), a)).toContain('data-talent-action="blessingOfSteel"');
    const p = runTalentAction("blessingOfSteel", talent(), a);
    await vi.waitFor(() => expect(captured.press).toBeTypeOf("function")); // действие грузит модуль лениво
    await captured.press("go", fakeForm({ '[name="item"]': "w1" }));
    expect(await p).toBe(true);
  });
});
