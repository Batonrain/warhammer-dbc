// test/regions/runic-weave-zone.test.mjs
//
// module/regions/runic-weave-zone.mjs — Руническая Вязь на стенах/помещении:
// клонирует/снимает временную копию предмета-вязи у актора, чей токен стоит
// в Region с этим поведением (тот же приём, что Аура — auras.mjs). Канвас-
// зависимая часть (tokensInRegion, из combat/templates.mjs) замокана —
// тестируется только решение «кому положена копия вязи прямо сейчас».

import "../support/foundry-stub.mjs";

import { describe, it, expect, vi, beforeEach } from "vitest";

const { tokensInRegion } = vi.hoisted(() => ({ tokensInRegion: vi.fn() }));
vi.mock("../../module/combat/templates.mjs", () => ({ tokensInRegion }));

import { RUNIC_WEAVE_ZONE_TYPE, sweepRunicWeaveZones } from "../../module/regions/runic-weave-zone.mjs";

const WEAVE_UUID = "Item.weave123456789012";

function fakeRegion(id, weaveUuid = WEAVE_UUID, disabled = false) {
  return { id, behaviors: [{ type: RUNIC_WEAVE_ZONE_TYPE, disabled, system: { weaveItemUuid: weaveUuid } }] };
}

function fakeToken(actor) { return { actor }; }

function fakeActor(uuid, items = []) {
  return {
    uuid, items,
    deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
    createEmbeddedDocuments: vi.fn().mockResolvedValue(undefined)
  };
}

function flaggedItem(id, sourceUuid) {
  return { id, getFlag: (ns, key) => (key === "runicWeaveZoneSource" ? sourceUuid : undefined) };
}

beforeEach(() => {
  globalThis.game = { ...globalThis.game, user: { isGM: true } };
  tokensInRegion.mockReset();
  globalThis.fromUuid = vi.fn().mockResolvedValue({ toObject: () => ({ name: "Руническая Вязь", flags: {} }) });
});

describe("sweepRunicWeaveZones", () => {
  it("не-ГМ — ничего не делает", async () => {
    globalThis.game.user.isGM = false;
    const actor = fakeActor("Actor.a1");
    const scene = { regions: [fakeRegion("r1")], tokens: { contents: [fakeToken(actor)] } };
    await sweepRunicWeaveZones(scene);
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("нет сцены — ничего не делает, не бросает исключение", async () => {
    await expect(sweepRunicWeaveZones(null)).resolves.toBeUndefined();
  });

  it("на сцене нет зон Рунической Вязи — ранний выход, tokensInRegion не вызывается", async () => {
    const scene = { regions: [{ id: "r1", behaviors: [] }], tokens: { contents: [] } };
    await sweepRunicWeaveZones(scene);
    expect(tokensInRegion).not.toHaveBeenCalled();
  });

  it("токен актора вошёл в зону, копии вязи ещё нет — создаёт с флагом источника", async () => {
    const actor = fakeActor("Actor.a1", []);
    tokensInRegion.mockReturnValue([fakeToken(actor)]);
    const scene = { regions: [fakeRegion("r1")], tokens: { contents: [fakeToken(actor)] } };

    await sweepRunicWeaveZones(scene);

    expect(actor.createEmbeddedDocuments).toHaveBeenCalledOnce();
    const [type, docs] = actor.createEmbeddedDocuments.mock.calls[0];
    expect(type).toBe("Item");
    expect(docs[0].flags["warhammer-dbc"].runicWeaveZoneSource).toBe(WEAVE_UUID);
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("копия вязи уже стоит и токен всё ещё в зоне — идемпотентно, ничего не меняется", async () => {
    const item = flaggedItem("i1", WEAVE_UUID);
    const actor = fakeActor("Actor.a1", [item]);
    tokensInRegion.mockReturnValue([fakeToken(actor)]);
    const scene = { regions: [fakeRegion("r1")], tokens: { contents: [fakeToken(actor)] } };

    await sweepRunicWeaveZones(scene);

    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("токен покинул зону, но копия ещё на акторе — снимается", async () => {
    const item = flaggedItem("i1", WEAVE_UUID);
    const actor = fakeActor("Actor.a1", [item]);
    tokensInRegion.mockReturnValue([]); // никого в зоне
    const scene = { regions: [fakeRegion("r1")], tokens: { contents: [fakeToken(actor)] } };

    await sweepRunicWeaveZones(scene);

    expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["i1"]);
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("отключённое поведение зоны не учитывается — актор внутри её геометрии копии не получает", async () => {
    const actor = fakeActor("Actor.a1", []);
    tokensInRegion.mockReturnValue([fakeToken(actor)]);
    const scene = { regions: [fakeRegion("r1", WEAVE_UUID, true)], tokens: { contents: [fakeToken(actor)] } };

    await sweepRunicWeaveZones(scene);

    expect(tokensInRegion).not.toHaveBeenCalled(); // отключённая зона даже не входит в descriptors
    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });

  it("предмет-источник по UUID не найден (fromUuid → null) — копия не создаётся, без исключения", async () => {
    globalThis.fromUuid = vi.fn().mockResolvedValue(null);
    const actor = fakeActor("Actor.a1", []);
    tokensInRegion.mockReturnValue([fakeToken(actor)]);
    const scene = { regions: [fakeRegion("r1")], tokens: { contents: [fakeToken(actor)] } };

    await sweepRunicWeaveZones(scene);

    expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
  });
});
