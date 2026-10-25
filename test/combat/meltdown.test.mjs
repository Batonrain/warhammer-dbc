// test/combat/meltdown.test.mjs
//
// Meltdown / Расплавление и очередь «взрыв через N Раундов» (Оружейник; Sahara 3-9d40, решение
// владельца 24.10.2026): полудействие, Tech-Use+10, провал ломает оружие, успех — взрыв через 1d5
// Раундов в начале Хода (1–4 Успеха срок бросает ГМ втайне, 5+ — игрок), Критический Провал — сразу.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { startMeltdown } from "../../module/combat/meltdown.mjs";
import { processDelayedBlastsTurnStart, scheduleDelayedBlast } from "../../module/combat/delayed-blast.mjs";
import { meltdownOutcome, meltdownKnifeOk, meltdownWeaponOk, MELTDOWN_BLAST } from "../../module/rules/meltdown.mjs";
import { tickDelayedBlasts, makeDelayedBlast, DELAYED_BLASTS_FLAG } from "../../module/rules/delayed-blast.mjs";

const TALENT = {
  id: "t-melt", name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "weaponsmith.core.meltdown", label: "" }] }] } }
};

const lasgun = () => weaponFor({ weaponClass: "basic", weaponType: "laser", special: "Моды: Power Setting", equipped: true,
  magazineCur: 40, magazineMax: 60 }, { id: "las", name: "Лазган" });
const knife = () => weaponFor({ weaponClass: "melee", meleeCategory: "Нож", equipped: false }, { id: "kn", name: "Боевой Нож" });

function who(items = [lasgun(), knife(), TALENT]) {
  const a = actorFor({ items, skills: { techUse: { total: 50 } } });
  a.name = "Оружейник"; a.uuid = "Actor.A1"; a.type = "character";
  const flags = {};
  a.getFlag = (s, k) => flags[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { flags[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete flags[`${s}.${k}`]; };
  a.update = async () => {};
  a.flagStore = flags;
  return a;
}
const blasts = a => a.flagStore[`warhammer-dbc.${DELAYED_BLASTS_FLAG}`] ?? [];

beforeEach(() => {
  resetCaptured(); globalThis.game.combat = undefined;
  // Заглушка ChatMessage не знает получателей-ГМов — даём одного, как в живом мире.
  globalThis.ChatMessage.getWhisperRecipients = () => [{ id: "gm1" }];
});

describe("Расплавление: чистые правила", () => {
  it("исход теста: Крит. Провал — сразу; Провал — поломка; 1–4 Успеха — тайно; 5+ — открыто", () => {
    expect(meltdownOutcome({ success: false, deg: 1, critFail: true })).toBe("instant");
    expect(meltdownOutcome({ success: false, deg: 2 })).toBe("break");
    expect(meltdownOutcome({ success: true, deg: 1 })).toBe("hidden");
    expect(meltdownOutcome({ success: true, deg: 4 })).toBe("hidden");
    expect(meltdownOutcome({ success: true, deg: 5 })).toBe("open");
    expect(meltdownOutcome({ success: true, deg: 9 })).toBe("open");
  });

  it("взрыв: 3d10+10 Dmg, Pen 14, Blast 3", () => {
    expect(MELTDOWN_BLAST).toMatchObject({ damage: "3d10+10", pen: 14, blast: 3 });
  });

  it("нужны лаз-оружие в руках с Power Setting и нож (категория «Нож»)", () => {
    expect(meltdownWeaponOk(lasgun())).toBe(true);
    expect(meltdownWeaponOk(weaponFor({ weaponType: "bolt", special: "Power Setting", equipped: true }))).toBe(false);
    expect(meltdownWeaponOk(weaponFor({ weaponType: "laser", special: "", equipped: true }))).toBe(false);
    expect(meltdownWeaponOk(weaponFor({ weaponType: "laser", special: "Power Setting", equipped: false }))).toBe(false);
    expect(meltdownKnifeOk(knife())).toBe(true);
    expect(meltdownKnifeOk(weaponFor({ weaponClass: "melee", meleeCategory: "Меч" }))).toBe(false);
    expect(meltdownKnifeOk(weaponFor({ weaponClass: "melee", meleeCategory: "Нож", stored: true }))).toBe(false);
  });

  it("очередь: срок −1 за Ход владельца, дошедшие до 0 — к взрыву", () => {
    const list = [makeDelayedBlast({ id: "a", turnsLeft: 3 }), makeDelayedBlast({ id: "b", turnsLeft: 1 })];
    const { remaining, due } = tickDelayedBlasts(list);
    expect(remaining.map(e => [e.id, e.turnsLeft])).toEqual([["a", 2]]);
    expect(due.map(e => e.id)).toEqual(["b"]);
  });
});

describe("Расплавление: тест и последствия", () => {
  it("без Таланта, без оружия или без ножа — отказ", async () => {
    expect(await startMeltdown(who([lasgun(), knife()]))).toBeNull();
    expect(await startMeltdown(who([knife(), TALENT]))).toBeNull();
    expect(await startMeltdown(who([lasgun(), TALENT]))).toBeNull();
    expect(captured.warnings.length).toBe(3);
  });

  it("Успех 1–4 Успеха: взрыв в очереди скрыт, срок = бросок 1d5, ГМу — шёпот", async () => {
    const a = who();
    captured.dice = [55, 3];                       // Tech-Use 50 + 10 = 60: 55 → 1 Успех; таймер 3
    expect(await startMeltdown(a)).toBe("hidden");
    expect(blasts(a)).toHaveLength(1);
    expect(blasts(a)[0]).toMatchObject({ turnsLeft: 3, hidden: true, damage: "3d10+10", pen: 14, blast: 3, itemIds: ["las", "kn"] });
    const publicCards = captured.chat.filter(m => !m.whisper?.length);
    expect(publicCards.some(m => m.content.includes("втайне"))).toBe(true);
    expect(publicCards.some(m => m.content.includes("взрыв через <b>3</b>"))).toBe(false);
    const secret = captured.chat.filter(m => m.whisper !== undefined);
    // blind: иначе автор шёпота (сам игрок) увидел бы срок.
    expect(secret.some(m => m.content.includes("<b>3</b>") && m.blind === true && m.whisper.includes("gm1"))).toBe(true);
  });

  it("Успех 5+ Успехов: срок объявляет сам игрок, запись не скрыта", async () => {
    const a = who();
    captured.dice = [5 + 10, 4];                   // rv 15 → deg 5; таймер 4
    expect(await startMeltdown(a)).toBe("open");
    expect(blasts(a)[0]).toMatchObject({ turnsLeft: 4, hidden: false });
    expect(captured.chat.map(m => m.content).join("\n")).toContain("<b>4</b>");
  });

  it("Провал: оружие сломано (system.destroyed), взрыва в очереди нет", async () => {
    const a = who();
    const w = a.items.get("las");
    captured.dice = [80];
    expect(await startMeltdown(a)).toBe("break");
    expect(w.system.destroyed).toBe(true);
    expect(blasts(a)).toHaveLength(0);
  });

  it("Критический Провал: взрыв сразу — карточка с уроном, оружие и нож уничтожены, магазин пуст", async () => {
    const a = who();
    captured.dice = [98, 5, 5, 5];                 // 98 — крит. провал; 3d10 = 15 (+10 = 25)
    expect(await startMeltdown(a)).toBe("instant");
    expect(a.items.get("las").system.destroyed).toBe(true);
    expect(a.items.get("las").system.magazineCur).toBe(0);
    expect(a.items.get("kn").system.destroyed).toBe(true);
    const html = captured.chat.map(m => m.content).join("\n");
    expect(html).toContain("wh-place-template-btn");
    expect(html).toContain('data-damage="25"');
    expect(html).toContain('data-penetration="14"');
  });
});

describe("Очередь отложенных взрывов: ход за ходом", () => {
  it("срок 2: первый Ход владельца убавляет, второй взрывает; запись снимается", async () => {
    const a = who();
    await scheduleDelayedBlast(a, { ...MELTDOWN_BLAST, label: "Расплавление", weaponName: "Лазган", turnsLeft: 2, itemIds: ["las", "kn"] });
    const combatant = { actor: a, getFlag: () => undefined };
    captured.dice = [5, 5, 5];
    await processDelayedBlastsTurnStart(combatant);
    expect(blasts(a)[0].turnsLeft).toBe(1);
    expect(a.items.get("las").system.destroyed).toBeUndefined();
    await processDelayedBlastsTurnStart(combatant);
    expect(blasts(a)).toHaveLength(0);
    expect(a.items.get("las").system.destroyed).toBe(true);
    expect(captured.chat.map(m => m.content).join("\n")).toContain('data-damage="25"');
  });

  it("дополнительный Ход (extraTurnSource) срок не убавляет", async () => {
    const a = who();
    await scheduleDelayedBlast(a, { ...MELTDOWN_BLAST, turnsLeft: 2, itemIds: [] });
    await processDelayedBlastsTurnStart({ actor: a, getFlag: () => "devourerOfTime" });
    expect(blasts(a)[0].turnsLeft).toBe(2);
  });
});
