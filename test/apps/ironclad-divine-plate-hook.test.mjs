// test/apps/ironclad-divine-plate-hook.test.mjs
//
// Книга (Броненосец, Преимущества): «Броненосец носит несъёмную тяжёлую броню
// АР 8/10/8/8». Раньше эту броню получал только тот, кто взял Мутацию «Доспехи
// Богов» (apps/armour-of-the-gods.mjs); купивший Архетип обычным путём получал
// Трейт-заглушку Divine Plate без единого АР. Теперь выдачу берёт на себя
// createItem-хук (warhammer-dbc.mjs::handleItemCreated) — любое появление
// предмета «Ironclad / Броненосец» на акторе, откуда бы оно ни пришло.

import "../support/foundry-stub.mjs";

import { describe, it, expect, vi } from "vitest";

vi.mock("../../module/apps/mechanics.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, applyItemMechanics: vi.fn(async () => {}) };
});
vi.mock("../../module/apps/item-script.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, runAutoScripts: vi.fn(async () => {}) };
});

const { handleItemCreated } = await import("../../warhammer-dbc.mjs");
const { IRONCLAD_ARCHETYPE_NAME, divinePlateArmourData } = await import("../../module/rules/armour-of-the-gods.mjs");

function actorWith(existing = []) {
  const actor = new Actor();
  actor.items = [...existing];
  actor.created = [];
  actor.createEmbeddedDocuments = async (type, docs) => { actor.created.push(...docs); actor.items.push(...docs); return docs; };
  return actor;
}
function archetypeItem(actor, name) {
  return { id: "arch", type: "eliteArchetype", name, parent: actor, getFlag: () => undefined };
}

describe("Броненосец: Божественные Латы выдаёт createItem-хук", () => {
  it("предмет «Ironclad» на акторе → броня AP 8/10/8/8", async () => {
    globalThis.game.user = { id: "u1" };
    const actor = actorWith();
    await handleItemCreated(archetypeItem(actor, IRONCLAD_ARCHETYPE_NAME), {}, "u1");
    expect(actor.created).toHaveLength(1);
    expect(actor.created[0]).toMatchObject({
      type: "armor",
      system: { equipped: true, stacks: false, head: 8, body: 10, leftArm: 8, rightArm: 8, leftLeg: 8, rightLeg: 8 }
    });
  });

  it("броня уже лежит на акторе (Мутация + повторная покупка) — второй не создаётся", async () => {
    globalThis.game.user = { id: "u1" };
    const actor = actorWith([{ type: "armor", name: divinePlateArmourData().name }]);
    await handleItemCreated(archetypeItem(actor, IRONCLAD_ARCHETYPE_NAME), {}, "u1");
    expect(actor.created).toHaveLength(0);
  });

  it("другой Архетип — броню не выдаёт", async () => {
    globalThis.game.user = { id: "u1" };
    const actor = actorWith();
    await handleItemCreated(archetypeItem(actor, "Noise Marine / Шумовой Десантник"), {}, "u1");
    expect(actor.created).toHaveLength(0);
  });

  it("хук чужого клиента (userId не совпал) — не дублирует выдачу", async () => {
    globalThis.game.user = { id: "u1" };
    const actor = actorWith();
    await handleItemCreated(archetypeItem(actor, IRONCLAD_ARCHETYPE_NAME), {}, "other");
    expect(actor.created).toHaveLength(0);
  });
});
