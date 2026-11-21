// test/apps/telekinetic-blades.test.mjs
//
// wdbc-1rno.28: удачная манифестация Телекинетического Клинка кладёт на лист
// клинки (по числу от эPR) и включает поддержание; Лезвие пишет усиление на
// выбранное оружие. Диалог — заглушка DialogV2 (test/support/foundry-stub.mjs).

import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runPsychicSummon } from "../../module/apps/telekinetic-blades.mjs";
import { summonsOf } from "../../module/rules/summoned-weapon.mjs";

const sword = JSON.parse(fs.readFileSync(path.resolve(
  "packs-src/weapons/Имперское/Рукопашное/Примитивное/Sword___Меч_xt9bG5qJ2JLarOXG.json"), "utf8"));
const folder = { name: "Примитивное", folder: { name: "Рукопашное", folder: { name: "Имперское", folder: null } } };
const swordDoc = { ...sword, uuid: "Compendium.warhammer-dbc.weapons.Item.sword", folder, toObject: () => structuredClone(sword) };

function powerOf(name, id = "p1") {
  const p = { id, type: "psychicPower", name, flags: {}, system: { isSustained: false, effects: {} },
    getFlag: (ns, k) => p.flags[ns]?.[k], setFlag: async (ns, k, v) => { (p.flags[ns] ??= {})[k] = v; },
    update: async d => { for (const [k, v] of Object.entries(d)) if (k.startsWith("system.")) {
      const keys = k.slice(7).split("."); let o = p.system; while (keys.length > 1) o = o[keys.shift()] ??= {}; o[keys[0]] = v; } } };
  return p;
}
function actorWith(items) {
  const list = [...items];
  return { name: "Псайкер", items: Object.assign(list, { get: id => list.find(i => i.id === id) }),
    createEmbeddedDocuments: async (_t, data) => { data.forEach((d, i) => list.push({ ...d, id: `b${i}` })); return data; },
    deleteEmbeddedDocuments: async (_t, ids) => { for (const id of ids) list.splice(list.findIndex(i => i.id === id), 1); } };
}

describe("Телекинетический Клинок: призыв после манифестации", () => {
  beforeEach(() => {
    resetCaptured();
    globalThis.game.packs = { get: () => ({ getDocuments: async () => [swordDoc] }) };
    globalThis.fromUuid = async () => swordDoc;
  });
  afterEach(() => { delete globalThis.game.packs; });

  it("эPR 4 — два клинка-Меча +4/+4, сила поддерживается", async () => {
    const power = powerOf("Telekinetic Blade / Телекинетический Клинок");
    const actor = actorWith([power]);
    const run = runPsychicSummon(actor, power, { epr: 4 });
    await new Promise(r => setTimeout(r, 0));
    const form = { querySelector: sel => ({ value: /b\d/.test(sel) ? swordDoc.uuid : "" }) };
    await captured.press("ok", form);
    expect(await run).toBe(true);
    const blades = summonsOf(actor, "p1");
    expect(blades).toHaveLength(2);
    expect(blades[0].system.damage).toBe("1d10+4");
    expect(blades[1].name).toContain("Телекинетический Клинок 2");
    expect(power.system.isSustained).toBe(true);
  });

  it("Лезвие на единственное рукопашное оружие: +эPR Dmg/Pen, Reinforced, поддерживается", async () => {
    const power = powerOf("Telekinetic Edge / Телекинетическое Лезвие", "p2");
    const knife = { id: "k1", type: "weapon", name: "Нож", system: { weaponClass: "melee", damageType: "rending", equipped: true } };
    const actor = actorWith([power, knife]);
    expect(await runPsychicSummon(actor, power, { epr: 5 })).toBe(true);
    expect(power.system.effects.weaponBuff).toMatchObject({ enabled: true, weaponId: "k1", damageMod: 5, penMod: 5 });
    expect(power.system.isSustained).toBe(true);
  });

  it("чужая сила — не трогается", async () => {
    const power = powerOf("Smite / Кара");
    expect(await runPsychicSummon(actorWith([power]), power, { epr: 5 })).toBe(false);
  });
});
