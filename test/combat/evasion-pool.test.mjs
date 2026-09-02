// test/combat/evasion-pool.test.mjs
//
// «Избегание множественных попаданий и атак» (стр. 12), вторая половина
// правила: неизрасходованные Успехи с одной успешной защиты можно потратить
// на попадания ДРУГИХ атак того же противника в этом Ходу — по 2 Успеха за
// попадание, +1 за каждые полные −10 бóльшего штрафа. Первая половина
// (само снятие попаданий одной атаки) — test/helpers/negated-hits.test.mjs.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  addEvasionSurplus, getEvasionPool, poolHitCost, poolAffordableHits, performPoolSpend,
  spendPoolForRecoil
} from "../../module/combat/evasion-pool.mjs";

function defender(overrides = {}) {
  const store = {};
  return {
    name: "Защитник",
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; },
    ...overrides
  };
}

const ATTACKER = "Actor.attacker-1";

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});

describe("poolHitCost", () => {
  it("2 Успеха база, без разницы в штрафе", () => {
    expect(poolHitCost(0, 0)).toBe(2);
    expect(poolHitCost(-10, -10)).toBe(2);
    expect(poolHitCost(-10, 0)).toBe(2); // штраф следующей атаки МЕНЬШЕ — не дороже
  });

  it("+1 Успех за каждые полные −10 бóльшего штрафа", () => {
    expect(poolHitCost(-10, -35)).toBe(4); // разница 25 → 2 полных −10 → 2+2
    expect(poolHitCost(0, -19)).toBe(3);   // разница 19 → 1 полный −10 → 2+1
    expect(poolHitCost(0, -20)).toBe(4);   // разница 20 → ровно 2 полных −10
  });
});

describe("poolAffordableHits", () => {
  it("без пула — ничего не доступно", () => {
    expect(poolAffordableHits(null, 0, 3)).toEqual({ hits: 0, cost: 0, perHit: 0 });
  });

  it("считает по цене за попадание, не больше hitsCount", () => {
    expect(poolAffordableHits({ successes: 5, penalty: 0 }, 0, 3)).toEqual({ hits: 2, cost: 4, perHit: 2 });
    expect(poolAffordableHits({ successes: 5, penalty: 0 }, 0, 1)).toEqual({ hits: 1, cost: 2, perHit: 2 });
  });

  it("недостаточно даже на одно попадание при возросшей цене", () => {
    expect(poolAffordableHits({ successes: 3, penalty: -10 }, -35, 5)).toEqual({ hits: 0, cost: 0, perHit: 4 });
  });
});

describe("addEvasionSurplus / getEvasionPool: банк на Ход атакующего", () => {
  it("вне активного боя — не банкует", async () => {
    const d = defender();
    const ok = await addEvasionSurplus(d, ATTACKER, 3, -10);
    expect(ok).toBe(false);
    expect(getEvasionPool(d, ATTACKER)).toBeNull();
  });

  it("в бою — банкует и читается обратно", async () => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
    const d = defender();
    const ok = await addEvasionSurplus(d, ATTACKER, 3, -10);
    expect(ok).toBe(true);
    expect(getEvasionPool(d, ATTACKER)).toMatchObject({ successes: 3, penalty: -10 });
  });

  it("копится в течение того же Хода, штраф остаётся от первой банковки", async () => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 2, -10);
    await addEvasionSurplus(d, ATTACKER, 1, -20);
    expect(getEvasionPool(d, ATTACKER)).toMatchObject({ successes: 3, penalty: -10 });
  });

  it("сменился Ход (другой боевой участник) — старый пул не виден", async () => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 3, -10);
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-2" } };
    expect(getEvasionPool(d, ATTACKER)).toBeNull();
  });
});

describe("spendPoolForRecoil: банк → пропуск в Отскок (wdbc-16ss, Voltagheist Blast)", () => {
  beforeEach(() => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
  });

  it("хватает — списывает cost, остаток читается обратно", async () => {
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 5, 0);

    const ok = await spendPoolForRecoil(d, ATTACKER, 2);

    expect(ok).toBe(true);
    expect(getEvasionPool(d, ATTACKER)).toMatchObject({ successes: 3 });
  });

  it("не хватает даже на cost — ничего не списывает", async () => {
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 1, 0);

    const ok = await spendPoolForRecoil(d, ATTACKER, 2);

    expect(ok).toBe(false);
    expect(getEvasionPool(d, ATTACKER)).toMatchObject({ successes: 1 });
  });

  it("пул пуст/не существует — false, без ошибки", async () => {
    const d = defender();
    expect(await spendPoolForRecoil(d, ATTACKER, 2)).toBe(false);
  });

  it("свой cost (не 2) — работает как параметр", async () => {
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 3, 0);

    expect(await spendPoolForRecoil(d, ATTACKER, 3)).toBe(true);
    expect(getEvasionPool(d, ATTACKER)).toBeNull();
  });
});

describe("performPoolSpend: чат-карточка траты пула", () => {
  beforeEach(() => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
  });

  it("пул пуст/не существует — предупреждение, без трат", async () => {
    const d = defender();
    await performPoolSpend(d, { attackerUuid: ATTACKER, hitsCount: 2, dodgeMod: 0 });
    expect(captured.chat.at(-1).content).toContain("пуст или устарел");
  });

  it("Успехов хватает не на все — снимает часть, остаток получает свежие кнопки", async () => {
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 3, 0); // 2/попадание → 1 попадание за 2, 1 Усп. остаётся неиспользуемым

    await performPoolSpend(d, { attackerUuid: ATTACKER, hitsCount: 3, dodgeMod: 0 });

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Потрачено 2 Усп.");
    expect(card).toContain("снимает 1 из 3");
    expect(card).toContain("2 попадания всё ещё проходит");
    expect(card).toContain("wh-dodge-btn");
    expect(card).toContain('data-hits-count="2"');
  });

  it("Успехов хватает на все попадания — атака полностью снята, кнопок продолжения нет", async () => {
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 4, 0); // 2 попадания по 2

    await performPoolSpend(d, { attackerUuid: ATTACKER, hitsCount: 2, dodgeMod: 0 });

    const card = captured.chat.at(-1).content;
    expect(card).toContain("снимает все 2 попадания");
    expect(card).toContain("Атака промахивается");
    expect(card).not.toContain("wh-dodge-btn");
  });

  it("недостаточно Успехов даже на одно попадание", async () => {
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 1, 0);

    await performPoolSpend(d, { attackerUuid: ATTACKER, hitsCount: 2, dodgeMod: 0 });

    expect(captured.chat.at(-1).content).toContain("недостаточно Успехов");
  });

  it("больший штраф следующей атаки поднимает цену за попадание", async () => {
    const d = defender();
    await addEvasionSurplus(d, ATTACKER, 4, -10); // база штрафа −10

    await performPoolSpend(d, { attackerUuid: ATTACKER, hitsCount: 3, dodgeMod: -35 }); // разница 25 → цена 4

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Потрачено 4 Усп.");
    expect(card).toContain("снимает 1 из 3");
  });
});
