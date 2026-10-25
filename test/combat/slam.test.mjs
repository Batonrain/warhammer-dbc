// test/combat/slam.test.mjs
//
// Slam / Швырнуть (Пугилист, стр. 62; Sahara 3-eddb): «При взятии цели в
// Захват, победе во встречном тесте на Athletics на 5+ Успехов, и наличии
// достаточного веса подъема, персонаж может немедленно за свободное действие
// метнуть ее или использовать как импровизированное оружие.»

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { resolveGrappleSuccess, slamAction } from "../../module/combat/grapple.mjs";
import { slamOffered } from "../../module/combat/grapple-talents.mjs";

const SLAM = { id: "sl", name: "Slam / Швырнуть", type: "talent", system: {} };

function fighter(name, uuid, items = []) {
  const flags = {};
  const a = actorFor({ items, conditions: { grappling: false } });
  a.name = name; a.uuid = uuid; a.id = uuid;
  a.getFlag = (_s, k) => flags[k];
  a.setFlag = async (_s, k, v) => { flags[k] = v; };
  a.update = async changes => {
    for (const [p, v] of Object.entries(changes)) {
      let m = p.match(/^flags\.[^.]+\.-=(.+)$/);
      if (m) { delete flags[m[1]]; continue; }
      m = p.match(/^flags\.[^.]+\.(.+)$/);
      if (m) flags[m[1]] = v;
    }
  };
  a._flags = flags;
  return a;
}

beforeEach(() => resetCaptured());

describe("slamOffered: порог 5 Успехов победы", () => {
  it("4 → нет, 5 → да, 8 → да", () => {
    expect([4, 5, 8].map(slamOffered)).toEqual([false, true, true]);
  });
});

describe("resolveGrappleSuccess: предложение Швырнуть", () => {
  const cards = () => captured.chat.map(m => m.content).join("\n");

  it("с Талантом и победой на 5+: карточка с кнопками Метнуть/Замахнуться", async () => {
    await resolveGrappleSuccess(fighter("Борец", "Actor.a", [SLAM]), { target: fighter("Жертва", "Actor.b"), margin: 5 });
    expect(cards()).toContain("wh-slam-btn");
    expect(cards()).toContain('data-mode="throw"');
    expect(cards()).toContain('data-mode="swing"');
  });
  it("победа на 4 — нет", async () => {
    await resolveGrappleSuccess(fighter("Борец", "Actor.a", [SLAM]), { target: fighter("Жертва", "Actor.b"), margin: 4 });
    expect(cards()).not.toContain("wh-slam-btn");
  });
  it("победа меньшим провалом (deg 0) — «5+» не даёт, даже если margin большой", async () => {
    await resolveGrappleSuccess(fighter("Борец", "Actor.a", [SLAM]), { target: fighter("Жертва", "Actor.b"), margin: 6, deg: 0 });
    expect(cards()).not.toContain("wh-slam-btn");
  });
  it("без Таланта — нет", async () => {
    await resolveGrappleSuccess(fighter("Борец", "Actor.a"), { target: fighter("Жертва", "Actor.b"), margin: 9 });
    expect(cards()).not.toContain("wh-slam-btn");
  });
});

describe("slamAction", () => {
  it("не держащий в Борьбе не может Швырнуть", async () => {
    const me = fighter("Борец", "Actor.a", [SLAM]);
    // false — действие не состоялось: карточка «Швырнуть» не гасится (card-once).
    expect(await slamAction(me, "throw")).toBe(false);
    expect(captured.warnings.some(w => w.includes("держащему"))).toBe(true);
  });
  it("без Таланта — тихо ничего", async () => {
    const me = fighter("Борец", "Actor.a");
    await slamAction(me, "throw");
    expect(captured.warnings).toHaveLength(0);
  });
});
