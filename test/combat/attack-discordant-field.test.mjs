// test/combat/attack-discordant-field.test.mjs
//
// Поле Дискорданта (task-be12, хвост): электрическое стрелковое оружие не
// стреляет — не только в окне атаки (sheets/attack-dialog.mjs), но и в самом
// броске (combat/attack.mjs::_executeAttackRoll). Овервотч и прочие пути,
// стреляющие мимо окна, раньше запрет обходили. Черта-метка поля — настоящий
// JSON пака.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const FIELD = packDocById("packs-src/traits/Трейты_рас", "DiscordFieldZn01");
const fieldItem = () => ({ id: FIELD._id, name: FIELD.name, type: FIELD.type, system: FIELD.system, flags: FIELD.flags });

const card = () => captured.chat.at(-1)?.content ?? "";
const fire = (actor, weapon, opts = {}) => _executeAttackRoll(actor, weapon, "bs", 45, "single", null, opts);

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Поле Дискорданта в самом броске атаки", () => {
  it("электрическое стрелковое в поле — выстрела нет: ни броска, ни карточки, ни расхода патронов", async () => {
    const weapon = weaponFor({ techClass: "electric" }, { name: "Лазган" });
    const actor = actorFor({ items: [weapon, fieldItem()] });
    captured.dice = [10, 5];
    await fire(actor, weapon);
    expect(captured.chat).toHaveLength(0);
    expect(captured.rolls).toHaveLength(0);
    expect(weapon.system.magazineCur).toBe(24);
    expect(captured.warnings.join(" ")).toContain("Дискорданта");
  });

  it("перерасчёт уже сделанного выстрела (skipAmmo: переброс, Горжет) запретом не рубится", async () => {
    const weapon = weaponFor({ techClass: "electric" }, { name: "Лазган" });
    const actor = actorFor({ items: [weapon, fieldItem()] });
    captured.dice = [10, 5];
    await fire(actor, weapon, { skipAmmo: true });
    expect(captured.chat.length).toBeGreaterThan(0);
  });

  it("то же оружие вне поля стреляет — запрет не глушит всё подряд", async () => {
    const weapon = weaponFor({ techClass: "electric" }, { name: "Лазган" });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];
    await fire(actor, weapon);
    expect(captured.chat.length).toBeGreaterThan(0);
  });

  it("механическое оружие в поле стреляет (заклинивание — отдельный хвост)", async () => {
    const weapon = weaponFor({ techClass: "mechanical" });
    const actor = actorFor({ items: [weapon, fieldItem()] });
    captured.dice = [10, 5];
    await fire(actor, weapon);
    expect(captured.chat.length).toBeGreaterThan(0);
  });

  it("электрическое рукопашное в поле бьёт выключенным, а не отказывает", async () => {
    const weapon = weaponFor({ techClass: "electric", weaponClass: "melee" }, { name: "Силовой меч" });
    const actor = actorFor({ items: [weapon, fieldItem()] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "ws", 45, "single", null, {});
    expect(captured.chat.length).toBeGreaterThan(0);
  });
});
