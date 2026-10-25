// test/combat/jockey.test.mjs
//
// Jockey / Жокей (Пугилист, стр. 62; Sahara 3-eddb, решение владельца
// 24.10.2026) — только ВХОД: «Он может совершать Захват против целей Размером
// выше себя, используя Acrobatics(A) вместо Athletics(S), игнорируя штрафы за
// разницу в Размерах, и может проводить его против целей до на 2 Размера
// больше себя, вместо до на 1 Размер как обычно. При победе он вместо обычного
// Захвата взбирается на цель. Цель не может атаковать персонажа как при обычном
// Захвате, но атаки по ней получают только половинный бонус от Борьбы
// (обычно +10)». Управление движением цели — вручную.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { applyGrappleOnHit } from "../../module/combat/grapple.mjs";
import {
  JOCKEY_RIDING_FLAG, JOCKEY_MOUNTED_FLAG, JOCKEY_ATTACK_BONUS,
  resolveJockeySuccess, jockeyMountedBonus, endJockey, clearJockeyOnCombatEnd, jockeySizeBlocked, jockeyChoiceOffered
} from "../../module/combat/jockey.mjs";

const NS = "warhammer-dbc";
const JOCKEY = { id: "jk", name: "Jockey / Жокей", type: "talent", system: {} };

function actorWith(name, uuid, { size = 0, items = [] } = {}) {
  const flags = {};
  const list = [...items];
  list.get = id => list.find(i => i.id === id);
  const a = {
    id: uuid, name, uuid, items: list,
    system: { size, conditions: { grappling: false }, characteristics: {}, meleeStance: "standard" },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async (changes) => {
      for (const [path, v] of Object.entries(changes)) {
        let m = path.match(/^flags\.[^.]+\.-=(.+)$/);
        if (m) { delete flags[m[1]]; continue; }
        m = path.match(/^flags\.[^.]+\.(.+)$/);
        if (m) flags[m[1]] = v;
      }
      return changes;
    },
    _flags: flags
  };
  return a;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.settings = { get: () => "roll" };
  globalThis.fromUuidSync = () => null;
});

describe("jockeySizeBlocked: потолок Размера цели", () => {
  it("с Талантом — запрещено только 3+ крупнее; без — 2+", () => {
    expect(jockeySizeBlocked(2, true)).toBe(false);
    expect(jockeySizeBlocked(3, true)).toBe(true);
    expect(jockeySizeBlocked(1, false)).toBe(false);
    expect(jockeySizeBlocked(2, false)).toBe(true);
  });
});

describe("applyGrappleOnHit: вход Жокея", () => {
  it("цель на 1 Размер крупнее: сперва выбор «Захват / взобраться»; «взобраться» — Acrobatics(A), без штрафа за Размер", async () => {
    const me = actorWith("Жокей", "Actor.j", { size: 3, items: [JOCKEY] });
    const foe = actorWith("Великан", "Actor.g", { size: 4 });
    const run = applyGrappleOnHit(me, { actor: foe }, true, { technique: "grapple" });
    expect(captured.dialog.buttons.map(b => b.action)).toEqual(["grapple", "climb"]);
    await captured.press("climb", null);
    await run;
    const html = captured.dialog?.content ?? "";
    expect(html).toContain("Жокей");
    expect(html).toContain("Acrobatics(A)");
    expect(html).not.toContain("меньше Размером");
  });

  it("цель на 1 Размер крупнее: «обычный Захват» — Athletics(S) с честным штрафом за Размер, не режим Жокея", async () => {
    const me = actorWith("Жокей", "Actor.j", { size: 3, items: [JOCKEY] });
    const foe = actorWith("Великан", "Actor.g", { size: 4 });
    const run = applyGrappleOnHit(me, { actor: foe }, true, { technique: "grapple" });
    await captured.press("grapple", null);
    await run;
    const html = captured.dialog?.content ?? "";
    expect(html).toContain("Захват");
    expect(html).not.toContain("Жокей");
    expect(html).toContain("меньше Размером");
  });

  it("цель на 1 Размер крупнее: закрыли окно выбора — Приём не проводится", async () => {
    const me = actorWith("Жокей", "Actor.j", { size: 3, items: [JOCKEY] });
    const foe = actorWith("Великан", "Actor.g", { size: 4 });
    const run = applyGrappleOnHit(me, { actor: foe }, true, { technique: "grapple" });
    const choice = captured.dialog;
    captured.dismiss();
    await run;
    expect(captured.dialog).toBe(choice);
  });

  it("jockeyChoiceOffered: выбор только при разнице ровно в 1 Размер", () => {
    expect(jockeyChoiceOffered(1)).toBe(true);
    expect(jockeyChoiceOffered(2)).toBe(false);
    expect(jockeyChoiceOffered(0)).toBe(false);
  });

  it("цель на 2 Размера крупнее: с Талантом можно", async () => {
    const me = actorWith("Жокей", "Actor.j", { size: 3, items: [JOCKEY] });
    const foe = actorWith("Великан", "Actor.g", { size: 5 });
    await applyGrappleOnHit(me, { actor: foe }, true, { technique: "grapple" });
    expect(captured.dialog?.content ?? "").toContain("Жокей");
  });

  it("цель на 3 Размера крупнее: нельзя даже Жокею", async () => {
    const me = actorWith("Жокей", "Actor.j", { size: 3, items: [JOCKEY] });
    const foe = actorWith("Титан", "Actor.g", { size: 6 });
    await applyGrappleOnHit(me, { actor: foe }, true, { technique: "grapple" });
    expect(captured.dialog).toBeFalsy();
    expect(captured.chat.at(-1).content).toContain("невозможен");
  });

  it("без Таланта цель на 2 Размера крупнее — по-прежнему нельзя (регрессия)", async () => {
    const me = actorWith("Боец", "Actor.j", { size: 3 });
    const foe = actorWith("Великан", "Actor.g", { size: 5 });
    await applyGrappleOnHit(me, { actor: foe }, true, { technique: "grapple" });
    expect(captured.dialog).toBeFalsy();
  });

  it("Жокей против цели своего размера или меньше — обычный Захват (Athletics, не режим Жокея)", async () => {
    const me = actorWith("Жокей", "Actor.j", { size: 3, items: [JOCKEY] });
    const foe = actorWith("Тот же", "Actor.g", { size: 3 });
    await applyGrappleOnHit(me, { actor: foe }, true, { technique: "grapple" });
    const html = captured.dialog?.content ?? "";
    expect(html).toContain("Захват");
    expect(html).not.toContain("Жокей");
  });
});

describe("resolveJockeySuccess / endJockey / бонус атак", () => {
  it("победа: флаги на обоих, Борьба (grappling) НЕ ставится, карточка с подсказками", async () => {
    const me = actorWith("Жокей", "Actor.j", { size: 3, items: [JOCKEY] });
    const foe = actorWith("Великан", "Actor.g", { size: 4 });
    await resolveJockeySuccess(me, { target: foe });
    expect(me.getFlag(NS, JOCKEY_RIDING_FLAG)).toBe(foe.uuid);
    expect(foe.getFlag(NS, JOCKEY_MOUNTED_FLAG)).toBe(me.uuid);
    expect(me.system.conditions.grappling).toBe(false);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("не может атаковать");
    expect(html).toContain("половин");
    expect(html).toContain("Acrobatics(A)+30");
  });

  it("jockeyMountedBonus: +10 по оседланной цели всем, кроме самого Жокея", () => {
    const me = actorWith("Жокей", "Actor.j");
    const foe = actorWith("Великан", "Actor.g");
    foe._flags[JOCKEY_MOUNTED_FLAG] = me.uuid;
    const other = actorWith("Союзник", "Actor.o");
    expect(jockeyMountedBonus(foe, other)).toBe(JOCKEY_ATTACK_BONUS);
    expect(JOCKEY_ATTACK_BONUS).toBe(10);
    expect(jockeyMountedBonus(foe, me)).toBe(0);
    expect(jockeyMountedBonus(other, me)).toBe(0);
  });

  it("endJockey снимает оба флага", async () => {
    const me = actorWith("Жокей", "Actor.j");
    const foe = actorWith("Великан", "Actor.g");
    me._flags[JOCKEY_RIDING_FLAG] = foe.uuid;
    foe._flags[JOCKEY_MOUNTED_FLAG] = me.uuid;
    globalThis.fromUuid = async uuid => (uuid === foe.uuid ? foe : uuid === me.uuid ? me : null);
    await endJockey(me);
    expect(me.getFlag(NS, JOCKEY_RIDING_FLAG)).toBeUndefined();
    expect(foe.getFlag(NS, JOCKEY_MOUNTED_FLAG)).toBeUndefined();
  });

  it("конец боя снимает метки у бойцов", async () => {
    const me = actorWith("Жокей", "Actor.j");
    const foe = actorWith("Великан", "Actor.g");
    me._flags[JOCKEY_RIDING_FLAG] = foe.uuid;
    foe._flags[JOCKEY_MOUNTED_FLAG] = me.uuid;
    await clearJockeyOnCombatEnd({ combatants: [{ actor: me }, { actor: foe }] });
    expect(me.getFlag(NS, JOCKEY_RIDING_FLAG)).toBeUndefined();
    expect(foe.getFlag(NS, JOCKEY_MOUNTED_FLAG)).toBeUndefined();
  });
});
