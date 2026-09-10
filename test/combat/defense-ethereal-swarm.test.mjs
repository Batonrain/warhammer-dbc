// test/combat/defense-ethereal-swarm.test.mjs
//
// Ethereal Swarm / Эфирная Стая (Дар Тзинч, wdbc-1rno): реактивное
// поглощение ОДНОГО попадания призрачным Крикуном — тест Cor+0, НЕ через
// spendReaction (книга прямо оговаривает «не тратит Реакций», в отличие от
// Сжатия). Тот же тестовый харнесс, что test/combat/defense-compression.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { actorFor } from "../support/combat-fixtures.mjs";
import { summonSwarm } from "../../module/rules/ethereal-swarm.mjs";
import { _performEtherealSwarm } from "../../module/combat/defense.mjs";

/** Актор с getFlag/setFlag — flags.warhammer-dbc.etherealSwarm хранится флагом. */
function defender(overrides = {}) {
  const a = actorFor(overrides);
  const flags = { "warhammer-dbc": {} };
  a.getFlag = (scope, key) => flags[scope]?.[key];
  a.setFlag = async (scope, key, value) => { (flags[scope] ??= {})[key] = value; };
  return a;
}

beforeEach(() => {
  resetCaptured();
  captured.nextRoll = 50;
  globalThis.game.time = { worldTime: 1000 };
});

describe("_performEtherealSwarm", () => {
  it("Стая не призвана — отказ, попытка не тратит бросок", async () => {
    const actor = defender();
    await _performEtherealSwarm(actor, "Actor.attacker-1");
    const card = captured.chat.at(-1).content;
    expect(card).toContain("не призвана, пуста или истёк срок");
  });

  it("Стая истекла (worldTime ≥ expiresAt) — тот же отказ", async () => {
    const actor = defender({ corruption: { value: 40 } });
    await summonSwarm(actor, 3, 10, 500); // истекает на 500+600=1100... подождём
    globalThis.game.time = { worldTime: 1100 };
    await _performEtherealSwarm(actor);
    expect(captured.chat.at(-1).content).toContain("не призвана, пуста или истёк срок");
  });

  it("Успех теста Cor+0 — списывает Крикуна, нивелирует попадание", async () => {
    const actor = defender({ corruption: { value: 40 } });
    await summonSwarm(actor, 3, 10, 1000);
    captured.nextRoll = 30; // 30 <= Cor 40 — успех
    await _performEtherealSwarm(actor, "Actor.attacker-1");
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Успех");
    expect(card).toContain("изгоняется в Варп");
    expect(card).toContain("осталось 2");
    expect(actor.getFlag("warhammer-dbc", "etherealSwarm").count).toBe(2);
  });

  it("Провал теста Cor+0 — Крикун не списывается, попадание проходит", async () => {
    const actor = defender({ corruption: { value: 40 } });
    await summonSwarm(actor, 3, 10, 1000);
    captured.nextRoll = 90; // 90 > Cor 40 — провал
    await _performEtherealSwarm(actor);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Провал");
    expect(card).toContain("проходит как обычно");
    expect(actor.getFlag("warhammer-dbc", "etherealSwarm").count).toBe(3);
  });

  it("МУТАЦИЯ: порог реально Cor, не Cor.b/Cor+10 — регресс-ловушка", async () => {
    // Cor.b актора с Cor 40 был бы 4 — почти любой d100 «провалил» бы против
    // него, но книга даёт Cor+0 (сырое значение), не Cor.b. 35 <= 40 (Cor) —
    // успех; 35 > 4 (Cor.b) выглядел бы «провалом», если бы порог был неверен.
    const actor = defender({ corruption: { value: 40 } });
    await summonSwarm(actor, 1, 10, 1000);
    captured.nextRoll = 35;
    await _performEtherealSwarm(actor);
    expect(captured.chat.at(-1).content).toContain("Успех");
  });

  it("Крикуны закончились (count=0) — Стая считается пустой", async () => {
    const actor = defender({ corruption: { value: 90 } });
    await summonSwarm(actor, 1, 10, 1000);
    captured.nextRoll = 10;
    await _performEtherealSwarm(actor); // списывает последнего
    await _performEtherealSwarm(actor); // теперь пусто
    expect(captured.chat.at(-1).content).toContain("не призвана, пуста или истёк срок");
  });
});
