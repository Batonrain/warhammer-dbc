// test/combat/dodge-slip-away-reroll.test.mjs
//
// Ускользнуть / Slip Away (Избегание, Sahara 62, п.9): «перебросить его (можно решить
// после броска)». Уклонение от Захвата: на карточке ПРОВАЛА — кнопка переброса, раз в
// Раунд, без второй траты Реакции. +30 по-прежнему выбирается до броска.
// Остальные два места Таланта — тест Борьбы (techniques.mjs/grapple.mjs) — пока выбирают
// переброс до броска.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { actorFor } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performDodge } from "../../module/combat/defense.mjs";

const DEFAULT_SOURCES = getRuleSources();
const flush = () => new Promise(r => setTimeout(r, 0));
const SA = "Slip Away / Ускользнуть";
const talent = name => ({ id: `t-${name}`, type: "talent", name, system: {}, getFlag: () => undefined });

/** Уклоняющийся: Ag 50, Dodge 40, Реакции 2; флаги — настоящее хранилище с разбором путей. */
function dodger() {
  const a = actorFor({ items: [talent(SA)], reactions: { value: 2, defenseValue: 0 } });
  const flags = {};
  a.name = "Юркий"; a.uuid = "Actor.d"; a.type = "character";
  a.system.skills = { dodge: { total: 40 } };
  a.system.characteristics = { ...a.system.characteristics, ag: { total: 50, bonus: 5 } };
  a.getFlag = (_s, k) => flags[k];
  a.setFlag = async (_s, k, v) => { flags[k] = v; return v; };
  a.update = async changes => {
    for (const [path, v] of Object.entries(changes)) {
      const m = path.match(/^flags\.[^.]+\.(.+)$/);
      if (m) { flags[m[1]] = v; continue; }
      const keys = path.split(".");
      let node = a;
      for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
      node[keys.at(-1)] = v;
    }
  };
  return a;
}

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { ...globalThis.game.user, id: "user-1", isGM: true, targets: new Set() };
  globalThis.game.combat = { started: true, round: 1 };
});
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

/** Уклонение от Захвата с ответом «Без Таланта» в окне выбора. */
async function dodgeGrapple(a, opts = {}) {
  const p = _performDodge(a, { extraMod: 0, grappleAttack: true, attackerUuid: "Actor.holder", ...opts });
  await flush();
  await captured.press("none", fakeForm());
  await p;
}

describe("Ускользнуть: переброс Уклонения от Захвата после провала", () => {
  it("провал: на карточке кнопка переброса со всеми параметрами теста", async () => {
    const a = dodger();
    captured.dice = [95];
    await dodgeGrapple(a, { hitsCount: 2 });
    expect(card()).toContain("Уклонение провалено");
    expect(card()).toContain("wh-slip-reroll-btn");
    expect(card()).toContain('data-actor-uuid="Actor.d"');
    expect(card()).toContain('data-hits-count="2"');
    expect(card()).toContain('data-attacker-uuid="Actor.holder"');
  });

  it("успех: кнопки нет — перебрасывать нечего", async () => {
    captured.dice = [10];
    await dodgeGrapple(dodger());
    expect(card()).toContain("Уклонение успешно");
    expect(card()).not.toContain("wh-slip-reroll-btn");
  });

  it("не атака Захватом — кнопки нет", async () => {
    captured.dice = [95];
    await _performDodge(dodger(), { extraMod: 0 });
    expect(card()).not.toContain("wh-slip-reroll-btn");
  });

  it("выбрав «+30» до броска, переброса уже нет (раз в Раунд — одно из двух)", async () => {
    const a = dodger();
    captured.dice = [99];
    const p = _performDodge(a, { extraMod: 0, grappleAttack: true });
    await flush();
    await captured.press("bonus", fakeForm());
    await p;
    expect(card()).toContain("Ускользнуть +30");
    expect(card()).not.toContain("wh-slip-reroll-btn");
  });

  it("клик: новый бросок без второго списания Реакции и без окна выбора; возможность потрачена", async () => {
    const a = dodger();
    captured.dice = [95];
    await dodgeGrapple(a);
    const reactionsAfterFirst = a.system.reactions.value;
    captured.dice = [10];
    captured.dialog = null;
    await _performDodge(a, { extraMod: 0, grappleAttack: true, attackerUuid: "Actor.holder", slipReroll: true });
    expect(card()).toContain("Уклонение успешно");
    expect(card()).toContain("Ускользнуть: переброс провала");
    expect(a.system.reactions.value).toBe(reactionsAfterFirst);     // Реакция не списана второй раз
    expect(captured.dialog).toBeNull();                             // окна выбора нет
    expect(card()).not.toContain("wh-slip-reroll-btn");             // и второго переброса нет
  });

  it("переброс раз в Раунд: повторный клик в том же Раунде отклоняется (карточки нет)", async () => {
    const a = dodger();
    captured.dice = [95];
    await dodgeGrapple(a);
    captured.dice = [95];
    await _performDodge(a, { extraMod: 0, grappleAttack: true, slipReroll: true });
    resetCaptured();
    captured.dice = [10];
    await _performDodge(a, { extraMod: 0, grappleAttack: true, slipReroll: true });
    expect(captured.chat).toHaveLength(0);
  });

  it("в новом Раунде переброс снова возможен", async () => {
    const a = dodger();
    captured.dice = [95];
    await dodgeGrapple(a);
    globalThis.game.combat = { started: true, round: 2 };
    captured.dice = [10];
    await _performDodge(a, { extraMod: 0, grappleAttack: true, slipReroll: true });
    expect(card()).toContain("Уклонение успешно");
  });
});
