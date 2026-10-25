// test/combat/burning-cover.test.mjs
//
// Горящие укрытия — вторая половина Таланта «Pyromaniac / Пироман» (Sahara 3-8318):
// «Все укрытия, попавшие в шаблон огнемета, также загораются на 1d5+1 Раундов и
// персонаж, заканчивающий свой Ход в горящем укрытии, также автоматически
// загорается». Чистая часть — rules/burning-cover.mjs; обвязка Region/боя —
// combat/burning-cover.mjs (мок-объекты, как test/regions/linger-zone.test.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  burningCoverUntil, isCoverBurning, turnEndRound, coverIgnitionPatch, coverExtinguishPatch,
  regionsOverlapBySampling, BURNING_COVER_COLOR, REGION_VISIBILITY_ALWAYS
} from "../../module/rules/burning-cover.mjs";
import {
  isCoverRegion, coverRegionsUnderTemplate, igniteCoversUnderTemplate, applyBurningCovers,
  processBurningCoverTurnChange, clearAllBurningCovers
} from "../../module/combat/burning-cover.mjs";

const FLAG = "flags.warhammer-dbc.burningCover";
const coverBehavior = (extra = {}) => ({ type: "cover", disabled: false, system: { coverAp: 2 }, ...extra });

/** Подставная зона: прямоугольник x0..x1 × y0..y1, обновления копятся в update. */
function fakeRegion({ id = "r1", name = "Бочки", rect = [0, 0, 100, 100], behaviors = [coverBehavior()],
  flag = null, color = "#3366cc", visibility = 4 } = {}) {
  const [x0, y0, x1, y1] = rect;
  const region = {
    id, name, behaviors, color, visibility,
    flags: flag ? { "warhammer-dbc": { burningCover: flag } } : {},
    bounds: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
    testPoint: ({ x, y }) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
    update: vi.fn(async patch => { region.lastPatch = patch; })
  };
  return region;
}
const sceneOf = regions => ({ id: "s1", regions: Object.assign([...regions], { get: id => regions.find(r => r.id === id) }) });
const template = (rect) => ({ testPoint: ({ x, y }) => x >= rect[0] && x <= rect[2] && y >= rect[1] && y <= rect[3] });

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { scene: null, dimensions: { distancePixels: 10 } };
  globalThis.game = { ...globalThis.game, user: { isGM: true, id: "u1" }, users: { activeGM: { id: "u1" } },
    combat: null, scenes: [], socket: { emit: vi.fn() } };
});

describe("правила: срок и вид зоны", () => {
  it("срок: раунд поджога + выпавшие Раунды; горит, пока раунд меньше срока", () => {
    expect(burningCoverUntil(3, 4)).toBe(7);
    const flag = { untilRound: 7, combatId: "c1" };
    expect(isCoverBurning(flag, { round: 3, combatId: "c1" })).toBe(true);
    expect(isCoverBurning(flag, { round: 6, combatId: "c1" })).toBe(true);
    expect(isCoverBurning(flag, { round: 7, combatId: "c1" })).toBe(false);
    // флаг чужого боя и пустой флаг — не горит
    expect(isCoverBurning(flag, { round: 3, combatId: "other" })).toBe(false);
    expect(isCoverBurning(null, { round: 1, combatId: "c1" })).toBe(false);
  });

  it("Раунд закончившегося Хода: при переходе через конец раунда — предыдущий", () => {
    expect(turnEndRound(5, { turn: 2 })).toBe(5);
    expect(turnEndRound(5, { round: 5, turn: 0 })).toBe(4);
  });

  it("поджог: огненный цвет и видимость «всем», прежний вид запомнен; повторный поджог его не затирает и продлевает срок", () => {
    const region = fakeRegion({ color: "#3366cc", visibility: 4 });
    const first = coverIgnitionPatch(region, { untilRound: 6, combatId: "c1" });
    expect(first.color).toBe(BURNING_COVER_COLOR);
    expect(first.visibility).toBe(REGION_VISIBILITY_ALWAYS);
    expect(first[FLAG]).toEqual({ untilRound: 6, combatId: "c1", prev: { color: "#3366cc", visibility: 4 } });
    // зона уже горит: color теперь огненный, но «прежним» остаётся исходный
    const burning = fakeRegion({ color: BURNING_COVER_COLOR, visibility: 2, flag: first[FLAG] });
    const second = coverIgnitionPatch(burning, { untilRound: 5, combatId: "c1" });
    expect(second[FLAG].prev).toEqual({ color: "#3366cc", visibility: 4 });
    expect(second[FLAG].untilRound).toBe(6);          // меньший новый срок не укорачивает
    expect(coverIgnitionPatch(burning, { untilRound: 9, combatId: "c1" })[FLAG].untilRound).toBe(9);
  });

  it("гашение возвращает прежний цвет и видимость и снимает флаг", () => {
    const patch = coverExtinguishPatch({ prev: { color: "#3366cc", visibility: 0 } });
    expect(patch).toMatchObject({ color: "#3366cc", visibility: 0, "flags.warhammer-dbc.-=burningCover": null });
  });

  it("пересечение по сэмплу: перекрываются / не перекрываются / узкая полоса", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const inA = (x, y) => x >= 0 && x <= 100 && y >= 0 && y <= 100;
    expect(regionsOverlapBySampling(bounds, 10, inA, (x) => x >= 90)).toBe(true);
    expect(regionsOverlapBySampling(bounds, 10, inA, (x) => x >= 150)).toBe(false);
    // полоса уже шага сетки у самого края — края сетки включены
    expect(regionsOverlapBySampling(bounds, 40, inA, (x) => x >= 99)).toBe(true);
    expect(regionsOverlapBySampling({ x: 0, y: 0, width: 0, height: 0 }, 10, inA, () => true)).toBe(false);
  });
});

describe("шаблон огнемёта и зоны Укрытия", () => {
  it("опознаёт Укрытие только по включённому поведению cover", () => {
    expect(isCoverRegion(fakeRegion())).toBe(true);
    expect(isCoverRegion(fakeRegion({ behaviors: [coverBehavior({ disabled: true })] }))).toBe(false);
    expect(isCoverRegion(fakeRegion({ behaviors: [{ type: "difficultTerrain" }] }))).toBe(false);
  });

  it("берёт только накрытые шаблоном зоны Укрытия", () => {
    const hit = fakeRegion({ id: "a", rect: [0, 0, 100, 100] });
    const miss = fakeRegion({ id: "b", rect: [500, 500, 600, 600] });
    const notCover = fakeRegion({ id: "c", rect: [0, 0, 100, 100], behaviors: [{ type: "difficultTerrain" }] });
    const scene = sceneOf([hit, miss, notCover]);
    expect(coverRegionsUnderTemplate(template([50, 50, 300, 300]), scene).map(r => r.id)).toEqual(["a"]);
  });

  it("игрок бросает 1d5+1, просит ГМа сокетом и пишет карточку; в бою нужно", async () => {
    const hit = fakeRegion({ id: "a" });
    globalThis.canvas.scene = sceneOf([hit]);
    globalThis.game.user = { isGM: false, id: "u1" };
    // без боя — предупреждение, ничего не отправлено
    expect(await igniteCoversUnderTemplate(template([0, 0, 50, 50]))).toEqual([]);
    expect(captured.warnings.length).toBe(1);
    expect(globalThis.game.socket.emit).not.toHaveBeenCalled();

    globalThis.game.combat = { id: "c1", round: 3 };
    captured.dice = [4];                                  // 1d5+1 → 4 + 1... формула «1d5+1»: кубик 4, итог 5
    const res = await igniteCoversUnderTemplate(template([0, 0, 50, 50]), { attackerName: "Пиро" });
    expect(res.map(r => r.id)).toEqual(["a"]);
    const sent = globalThis.game.socket.emit.mock.calls[0][1];
    expect(sent).toMatchObject({ action: "burnCovers", sceneId: "s1", regionIds: ["a"], untilRound: 8, combatId: "c1" });
    expect(captured.chat.at(-1).content).toContain("Бочки");
  });

  it("ГМ-клиент пишет сам, без сокета; шаблон без укрытий — ничего", async () => {
    const hit = fakeRegion({ id: "a" });
    globalThis.canvas.scene = sceneOf([hit]);
    globalThis.game.scenes = { get: id => (id === "s1" ? globalThis.canvas.scene : null), [Symbol.iterator]: function* () { yield globalThis.canvas.scene; } };
    globalThis.game.combat = { id: "c1", round: 1 };
    expect(await igniteCoversUnderTemplate(template([900, 900, 950, 950]))).toEqual([]);
    expect(hit.update).not.toHaveBeenCalled();
    captured.dice = [1];                                  // 1d5+1 = 2
    await igniteCoversUnderTemplate(template([0, 0, 50, 50]));
    expect(globalThis.game.socket.emit).not.toHaveBeenCalled();
    expect(hit.lastPatch.color).toBe(BURNING_COVER_COLOR);
    expect(hit.lastPatch[FLAG].untilRound).toBe(3);
  });

  it("applyBurningCovers: не-Укрытие и чужой клиент не трогаются", async () => {
    const cover = fakeRegion({ id: "a" });
    const other = fakeRegion({ id: "b", behaviors: [{ type: "difficultTerrain" }] });
    const scene = sceneOf([cover, other]);
    globalThis.game.scenes = { get: () => scene };
    expect(await applyBurningCovers({ sceneId: "s1", regionIds: ["a", "b", "zz"], untilRound: 5, combatId: "c1" })).toBe(1);
    expect(other.update).not.toHaveBeenCalled();
    globalThis.game.user = { isGM: false };
    expect(await applyBurningCovers({ sceneId: "s1", regionIds: ["a"], untilRound: 5, combatId: "c1" })).toBe(0);
  });
});

describe("конец Хода в горящем укрытии и гашение", () => {
  const actor = () => {
    const a = { name: "Боец", type: "character", system: { conditions: {} }, update: vi.fn(async ch => { a.lastUpdate = ch; }),
      getActiveTokens: () => [] };
    return a;
  };
  const combatOf = (regions, round) => ({ id: "c1", round, scene: sceneOf(regions) });
  const burningFlag = { untilRound: 5, combatId: "c1", prev: { color: "#3366cc", visibility: 4 } };

  it("закончил Ход в горящей зоне — загорается сам и это видно в чате", async () => {
    const zone = fakeRegion({ flag: burningFlag });
    const a = actor();
    await processBurningCoverTurnChange(combatOf([zone], 3), { turn: 1 }, { actor: a, token: { regions: new Set([zone]) } });
    expect(a.update).toHaveBeenCalledTimes(1);
    expect(Object.keys(a.lastUpdate).some(k => k.includes("burning"))).toBe(true);
    expect(captured.chat.at(-1).content).toContain("автоматически Загорается");
  });

  it("в обычном укрытии, в погасшей зоне и уже горящий — ничего", async () => {
    const plain = fakeRegion({});
    const expired = fakeRegion({ flag: { ...burningFlag, untilRound: 3 } });
    const a = actor();
    await processBurningCoverTurnChange(combatOf([plain], 3), { turn: 1 }, { actor: a, token: { regions: new Set([plain]) } });
    await processBurningCoverTurnChange(combatOf([expired], 3), { turn: 1 }, { actor: a, token: { regions: new Set([expired]) } });
    expect(a.update).not.toHaveBeenCalled();
    const burningAlready = actor();
    burningAlready.system.conditions.burning = true;
    const zone = fakeRegion({ flag: burningFlag });
    await processBurningCoverTurnChange(combatOf([zone], 3), { turn: 1 }, { actor: burningAlready, token: { regions: new Set([zone]) } });
    expect(burningAlready.update).not.toHaveBeenCalled();
  });

  it("последний горящий Раунд: смена Раунда сначала поджигает закончившего Ход, потом гасит зону", async () => {
    const zone = fakeRegion({ flag: burningFlag });             // горит, пока раунд < 5
    const a = actor();
    // Ход закончился в раунде 4, combat.round уже 5
    await processBurningCoverTurnChange(combatOf([zone], 5), { round: 5, turn: 0 }, { actor: a, token: { regions: new Set([zone]) } });
    expect(a.update).toHaveBeenCalled();
    expect(zone.lastPatch).toMatchObject({ color: "#3366cc", visibility: 4, "flags.warhammer-dbc.-=burningCover": null });
  });

  it("зона чужого боя гаснет; не-ГМ ничего не делает", async () => {
    const stale = fakeRegion({ flag: { ...burningFlag, combatId: "old" } });
    await processBurningCoverTurnChange(combatOf([stale], 2), { turn: 0 }, null);
    expect(stale.update).toHaveBeenCalled();
    const z2 = fakeRegion({ flag: { ...burningFlag, combatId: "old" } });
    globalThis.game.user = { isGM: false };
    await processBurningCoverTurnChange(combatOf([z2], 2), { turn: 0 }, null);
    expect(z2.update).not.toHaveBeenCalled();
  });

  it("без укрытий под шаблоном вне боя предупреждения нет; не активный ГМ ничего не пишет", async () => {
    globalThis.canvas.scene = sceneOf([fakeRegion({ id: "far", rect: [900, 900, 950, 950] })]);
    await igniteCoversUnderTemplate(template([0, 0, 50, 50]));
    expect(captured.warnings.length).toBe(0);
    const z = fakeRegion({ flag: burningFlag });
    globalThis.game.users = { activeGM: { id: "other-gm" } };
    await processBurningCoverTurnChange(combatOf([{ ...z }], 9), { turn: 0 }, null);
    expect(z.update).not.toHaveBeenCalled();
  });

  it("конец боя гасит только зоны ЭТОГО боя (другой бой на другой сцене горит дальше)", async () => {
    const mine = fakeRegion({ id: "a", flag: burningFlag });
    const other = fakeRegion({ id: "b", flag: { ...burningFlag, combatId: "c2" } });
    globalThis.game.scenes = [sceneOf([mine, other])];
    await clearAllBurningCovers({ id: "c1" });
    expect(mine.update).toHaveBeenCalled();
    expect(other.update).not.toHaveBeenCalled();
  });

  it("конец боя гасит все горящие зоны мира", async () => {
    const z = fakeRegion({ flag: burningFlag });
    const calm = fakeRegion({ id: "r2" });
    const scene = sceneOf([z, calm]);
    globalThis.game.scenes = [scene];
    await clearAllBurningCovers();
    expect(z.update).toHaveBeenCalled();
    expect(calm.update).not.toHaveBeenCalled();
  });
});
