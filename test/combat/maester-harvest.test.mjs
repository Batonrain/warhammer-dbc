// Мейстер: сбор Культивации и Прожектор — трата после проверок (приёмка #597).
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../support/foundry-stub.mjs";

const gained = [];
const paid = [];
vi.mock("../../module/apps/resource-pools.mjs", async orig => ({
  ...(await orig()),
  gainResource: vi.fn(async (_a, _k, n) => { gained.push(n); }),
  spendResource: vi.fn(async () => ({}))
}));
vi.mock("../../module/combat/cult-common.mjs", async orig => ({
  ...(await orig()),
  payActions: vi.fn(async (_a, n) => { paid.push(n); return true; }),
  askChoice: vi.fn(async () => "full"),
  cultCard: vi.fn(async () => {})
}));

const { harvestFrom, useProjector } = await import("../../module/combat/maester.mjs");

const maester = { uuid: "Actor.M", name: "Мейстер", isOwner: true,
  items: [{ name: "Cultivation", type: "trait" }], system: { resourcePools: {} }, flags: {}, getFlag: () => null };
const patient = (isOwner) => ({ name: "Пациент", isOwner, updates: [],
  flags: { "warhammer-dbc": { lifeVirus: { by: "Actor.M", cultivation: 2 } } },
  getFlag(ns, k) { return this.flags[ns]?.[k]; },
  async update(u) { this.updates.push(u); } });

describe("Культивация: сбор с чужого пациента", () => {
  beforeEach(() => { gained.length = 0; paid.length = 0; });
  it("не вправе обнулить у пациента — ни действия, ни начисления (раньше начислялось бесконечно)", async () => {
    const p = patient(false);
    globalThis.game.user = { isGM: false, targets: new Set([{ actor: p }]) };
    await harvestFrom(maester);
    expect(paid).toEqual([]);
    expect(gained).toEqual([]);
    expect(p.updates).toEqual([]);
  });
});

describe("Целительный Прожектор: Культивации не хватает", () => {
  beforeEach(() => { gained.length = 0; paid.length = 0; });
  it("отказ до оплаты полудействия", async () => {
    const m = { ...maester, items: [...maester.items, { name: "Maester Pact Stage 4", type: "talent" }],
      system: { resourcePools: { cultivation: 0 } } };
    const p = patient(true);
    p.flags["warhammer-dbc"].lifeVirus = { by: "Actor.M", contribution: 5, expiresAt: Number.MAX_SAFE_INTEGER };
    p.system = { wounds: { value: 5, max: 10 }, conditions: {} };
    globalThis.game.user = { isGM: true, targets: new Set([{ actor: p }]) };
    const api = globalThis.foundry.applications.api.DialogV2;
    const saved = api.prompt;
    api.prompt = async () => ({ mode: "half", eff: "k3", extra: 0 });
    try { await useProjector(m); } finally { api.prompt = saved; }
    expect(paid).toEqual([]);
    expect(p.updates).toEqual([]);
  });
});
