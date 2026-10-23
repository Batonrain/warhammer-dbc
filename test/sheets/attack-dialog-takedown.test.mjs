// test/sheets/attack-dialog-takedown.test.mjs
//
// Takedown / Вырубание (гл. 3): «приём Оглушить с любым оружием и не-Избирательной
// атакой». Без Таланта приём ограничен категориями (Булава/Кистень/Кулаки/Молот/
// Посох/Щит) и окно форсирует прицел в Голову (test/sheets/attack-dialog-stun-maneuver.test.mjs);
// с Талантом — пилюля есть у любого оружия, а прицел свободен.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const talentFor = (name, specialization = "") => ({ type: "talent", name, system: { specialization } });
const TRAINING = talentFor("Melee Training / Рукопашная Тренировка", "Меч");
const TAKEDOWN = talentFor("Takedown / Вырубание");

function attacker(items) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none" });
  a.update = async () => {};
  return a;
}

const sword = () => weaponFor({ weaponClass: "melee", meleeCategory: "Меч" }, { name: "Меч" });
const mace  = () => weaponFor({ weaponClass: "melee", meleeCategory: "Булава" }, { name: "Булава" });

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Вырубание: пилюля приёма Оглушить у оружия не из списка категорий", () => {
  it("меч без Таланта — приёма Оглушить в окне нет (регрессия)", () => {
    const w = sword();
    showAttackDialog(attacker([w, TRAINING]), w);
    expect(captured.dialog.content).not.toMatch(/name="atk-maneuver" value="stun"/);
  });

  it("меч с Вырубанием — пилюля есть и доступна", () => {
    const w = sword();
    showAttackDialog(attacker([w, TRAINING, TAKEDOWN]), w);
    const html = captured.dialog.content;
    expect(html).toMatch(/name="atk-maneuver" value="stun"/);
    expect(html).not.toMatch(/name="atk-maneuver" value="stun"[^>]*disabled/);
  });

  it("булава без Таланта — приём по-прежнему доступен (регрессия)", () => {
    const w = mace();
    showAttackDialog(attacker([w, talentFor("Melee Training / Рукопашная Тренировка", "Булава")]), w);
    expect(captured.dialog.content).toMatch(/name="atk-maneuver" value="stun"/);
  });
});

describe("Вырубание: прицел при приёме Оглушить", () => {
  it("с Талантом окно НЕ запирает прицел в Голову", () => {
    const w = sword();
    showAttackDialog(attacker([w, TRAINING, TAKEDOWN]), w, { technique: "stun" });
    const html = captured.dialog.content;
    expect(html).toMatch(/<select id="atk-aim" class="av-input av-wide">/);
    expect(html).not.toMatch(/<select id="atk-aim"[^>]*disabled/);
    expect(html).not.toMatch(/<option value="head"[^>]*selected>/);
  });

  it("без Таланта — по-прежнему форсирована Голова (регрессия)", () => {
    const w = mace();
    showAttackDialog(attacker([w]), w, { technique: "stun" });
    const html = captured.dialog.content;
    expect(html).toMatch(/<select id="atk-aim" class="av-input av-wide" disabled>/);
    expect(html).toMatch(/<option value="head"[^>]*selected>/);
  });
});
