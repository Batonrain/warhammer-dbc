// test/combat/welder-vehicle-part.test.mjs
//
// Welder / Сварщик (weaponsmith.core.welder), решение владельца 26.10.2026: в окне
// атаки существа-стрелка по технике появляется выбор ЧАСТИ ТЕХНИКИ (aimTarget.vehiclePart,
// перечень VEHICLE_AIM_TARGETS), а доп. Критический Эффект 1d5+1 Сварщика ложится ровно
// в выбранную часть («в ту часть машины, в которую он целился»), а не туда, куда
// попало конкретное попадание очереди.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { applyDamageToVehicle } from "../../module/combat/vehicle.mjs";
import { VEHICLE_AIM_TARGETS } from "../../module/constants/vehicle.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const talentByName = name => ({ id: "t-" + name, name, type: "talent", system: {} });
const melta = () => weaponFor({ damage: "2d10", penetration: 12, weaponProps: [{ key: "melta" }] }, { name: "Meltagun / Мельтаган" });
const shooter = items => actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) } });

beforeEach(() => { resetCaptured(); setTargets([]); });

const aimOptions = () => [...(captured.dialog?.content ?? "").matchAll(/<option value="([^"]*)" data-penalty="(-?\d+)"[^>]*>([^<]*)</g)];

describe("окно атаки: часть техники при цели-технике", () => {
  it("цель — техника: в прицеле части машины из VEHICLE_AIM_TARGETS, без Головы и Сочленений", () => {
    setTargets([{ type: "vehicle" }]);
    const gun = melta();
    showAttackDialog(shooter([gun]), gun);
    const content = captured.dialog.content;
    for (const t of VEHICLE_AIM_TARGETS.filter(t => t.value)) expect(content).toContain(`value="${t.value}"`);
    expect(content).toContain("Ходовая");
    expect(content).toContain("Башня");
    expect(content).toContain("Орудие");
    expect(content).not.toContain(">Голова");
    expect(content).not.toContain("Сочленение");
    // штрафы берутся из перечня техники, а не из таблицы частей тела
    const turret = aimOptions().find(m => m[1] === "turret");
    expect(turret?.[2]).toBe("-15");
  });

  it("цель — существо: прежний список частей тела", () => {
    setTargets([{ type: "character" }]);
    const gun = melta();
    showAttackDialog(shooter([gun]), gun);
    const content = captured.dialog.content;
    expect(content).toContain("Голова");
    expect(content).toContain("Сочленение");
    expect(content).not.toContain('value="turret"');
  });

  it("нет цели: прежний список частей тела", () => {
    const gun = melta();
    showAttackDialog(shooter([gun]), gun);
    expect(captured.dialog.content).toContain("Голова");
    expect(captured.dialog.content).not.toContain('value="turret"');
  });

  it("реальный бросок с выбранной Башней: попадание в Башню, штраф −15 в пороге", async () => {
    setTargets([{ type: "vehicle" }]);
    const gun = melta();
    const actor = shooter([gun, talentByName("Welder / Сварщик")]);
    actor.update = async () => {};
    const p = showAttackDialog(actor, gun);
    captured.dice = [20, 6, 4, 4, 4, 4];
    await captured.press("roll", fakeForm({
      "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "turret",
      "#atk-aim option:checked": { dataset: { penalty: "-15" } }
    }));
    await p;
    expect(card()).toContain("Башня");
    expect(card()).toMatch(/data-welder="1"/);
    expect(card()).toMatch(/data-welder-part="Башня"/);
  });
});

describe("Сварщик: карточка урона несёт выбранную часть", () => {
  async function shoot(items, aim, targets = [{ type: "vehicle" }]) {
    setTargets(targets);
    const gun = melta();
    const actor = shooter([gun, ...items]);
    captured.dice = [23, 6, 4, 4, 4, 4];
    await _executeAttackRoll(actor, gun, "bs", 45, "single", aim, {});
  }
  it("Избирательная атака по Орудию — data-welder-part=Орудие", async () => {
    await shoot([talentByName("Welder / Сварщик")], { value: "gun1", label: "Орудие", vehiclePart: "Орудие" });
    expect(card()).toMatch(/data-welder-part="Орудие"/);
  });
  it("без Таланта или без Избирательной — части нет (пустая строка)", async () => {
    await shoot([], { value: "gun1", label: "Орудие", vehiclePart: "Орудие" });
    expect(card()).toMatch(/data-welder-part=""/);
    resetCaptured();
    await shoot([talentByName("Welder / Сварщик")], null);
    expect(card()).toMatch(/data-welder-part=""/);
  });
});

describe("Сварщик: доп. Критический Эффект ложится в выбранную часть", () => {
  const vehicle = () => {
    const a = {
      id: "veh", name: "Леман Русс", uuid: "Actor.veh", type: "vehicle",
      system: { structure: { value: 40, max: 40, critical: 0, ablative: 0 }, derived: {}, armour: { front: 10, side: 10, rear: 10 } },
      getActiveTokens: () => [],
      update: async u => { for (const [k, v] of Object.entries(u)) { const ks = k.split("."); let o = a; for (const kk of ks.slice(0, -1)) o = (o[kk] ??= {}); o[ks.at(-1)] = v; } }
    };
    return a;
  };
  const base = { rawDamage: 30, penetration: 12, damageType: "energy", side: "side", melee: false, welder: true };

  it("попадание в Корпус, но целились в Башню → Критический Эффект Башни", async () => {
    captured.dice = [3];
    await applyDamageToVehicle(vehicle(), { ...base, vehicleLocation: "Корпус", welderPart: "Башня" });
    expect(captured.chat.map(m => m.content).join("\n")).toMatch(/Сварщик — [^<]*— Башня<\/b>/);
  });

  it("части нет в данных (старая карточка) — по месту попадания, как раньше", async () => {
    captured.dice = [3];
    await applyDamageToVehicle(vehicle(), { ...base, vehicleLocation: "Ходовая" });
    const text = captured.chat.map(m => m.content).join("\n");
    expect(text).toMatch(/Сварщик — [^<]*— Ходовая<\/b>/);
  });

  it("непоглощённого урона нет — Сварщик молчит", async () => {
    captured.dice = [3];
    await applyDamageToVehicle(vehicle(), { ...base, rawDamage: 1, penetration: 0, vehicleLocation: "Корпус", welderPart: "Башня" });
    expect(captured.chat.map(m => m.content).join("\n")).not.toContain("Сварщик —");
  });
});

describe("проводка: кнопка урона → damageData", () => {
  it("hooks.mjs читает data-welder-part в welderPart, а attack-card.mjs его пишет", async () => {
    const fs = await import("node:fs");
    const hooks = fs.readFileSync(new URL("../../module/hooks.mjs", import.meta.url), "utf8");
    const cardSrc = fs.readFileSync(new URL("../../module/combat/attack-card.mjs", import.meta.url), "utf8");
    expect(hooks).toContain("welderPart:      ds.welderPart");
    expect(cardSrc).toContain('data-welder-part="');
  });
});
