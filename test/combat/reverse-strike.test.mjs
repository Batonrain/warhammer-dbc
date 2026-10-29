// test/combat/reverse-strike.test.mjs
//
// Reverse Strike / Обратный Удар (Рукопашные, Sahara 3-8dc5): Приём (База: Стандартная/Натиск/
// Осторожная; оружие с профилем посоха; только в Хвате на обе руки) — базовая атака +0 любым
// профилем и сразу вторая с теми же модификаторами профилем посоха; вторая получает Concussive(0).
// Данные штыка — настоящий JSON из packs-src (профиль «Посох», хват «2р (Бл)»).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { buildSelection } from "../../module/sheets/attack/selection.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { MELEE_MANEUVERS } from "../../module/constants/combat.mjs";
import { weaponProfiles } from "../../module/combat/weapon-profiles.mjs";
import { reverseStrikeSecondProfileIdx } from "../../module/rules/melee-talents.mjs";

const KEY = "meleeCore.core.reverseStrike";
const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const bayonetDoc = packDocById("packs-src/weapons/Имперское/Рукопашное/Примитивное", "Z0dpXv9pjaHp9dh2");
const bayonet = (over = {}) => weaponFor({ ...bayonetDoc.system, ...over }, { name: bayonetDoc.name });

function options(actor, item, { baseKey = "standard", gripKey = "2р" } = {}) {
  const atkProfiles = weaponProfiles(item);
  const { computeManeuverOptions } = buildSelection({
    actor, atkProfiles, bowMarkedMod: 0, categoryFor: () => item.system.meleeCategory, fullAttackForced: false,
    gripKey, gripList: ["2р", "Бл", "1р"], hasShieldEquipped: false, isMelee: true, isMounted: false, item,
    maneuverKeyDefault: "standard", meleeBaseKey: "standard", primGrip: "2р", profIdx: -1, sBonus: 4,
    stance: "standard", sys: item.system, targetActor: null, trainingFor: () => ({ trained: true, source: "" }),
    wp: { cheapShot: false }
  });
  return Object.fromEntries(computeManeuverOptions(baseKey, -1, gripKey).map(o => [o.key, o]));
}

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("данные", () => {
  it("штык в паке несёт профиль «Посох»", () => {
    expect(weaponProfiles(bayonet()).some(p => p.label === "Посох")).toBe(true);
  });
  it("Приём заведён с Базами, Хватом и профилем из книги", () => {
    const d = MELEE_MANEUVERS.reverseStrike;
    expect(d.wsBonus).toBe(0);
    expect(d.bases).toEqual(["standard", "charge", "careful"]);
    expect(d.requiresProfileLabel).toBe("Посох");
    expect(d.requiresGrips).toContain("2р");
  });
});

describe("Приём «Обратный Удар» в окне атаки", () => {
  const withTalent = () => actorFor({ items: [talentByKey(KEY)] });
  it("Талант + профиль посоха + хват 2р + Стандартная База — доступен", () => {
    expect(options(withTalent(), bayonet()).reverseStrike.allowed).toBe(true);
  });
  it("без Таланта — нет, причина названа", () => {
    const o = options(actorFor({}), bayonet()).reverseStrike;
    expect(o.allowed).toBe(false);
    expect(o.reason).toContain("Нужно");
  });
  it("одноручный хват — нет («только если обе руки»)", () => {
    const o = options(withTalent(), bayonet(), { gripKey: "1р" }).reverseStrike;
    expect(o.allowed).toBe(false);
    expect(o.reason).toContain("обе руки");
  });
  it("у оружия нет профиля посоха — нет", () => {
    const o = options(withTalent(), bayonet({ profiles: [] })).reverseStrike;
    expect(o.allowed).toBe(false);
    expect(o.reason).toContain("Посох");
  });
  it("не та База (Полная Атака) — нет; Натиск и Осторожная — да", () => {
    expect(options(withTalent(), bayonet(), { baseKey: "fullatk" }).reverseStrike.allowed).toBe(false);
    expect(options(withTalent(), bayonet(), { baseKey: "charge" }).reverseStrike.allowed).toBe(true);
    expect(options(withTalent(), bayonet(), { baseKey: "careful" }).reverseStrike.allowed).toBe(true);
  });
});

describe("Вторая атака: Concussive(0)", () => {
  const card = () => captured.chat.at(-1)?.content ?? "";
  async function swing(second, weaponProps = []) {
    const w = weaponFor({ weaponClass: "melee", meleeCategory: "Копьё", grips: "2р", damage: "1d10", weaponProps });
    const actor = actorFor({ items: [w], characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) } });
    captured.dice = [20, 5, 5, 5];
    await _executeAttackRoll(actor, w, "ws", 45, "melee", null, { baseKey: "standard", reverseStrikeSecond: second });
  }
  it("вторая атака без своего Concussive получает (0)", async () => {
    await swing(true);
    expect(card()).toContain("Оглушающее (0)");
  });
  it("первая (обычная) атака Оглушающего не получает", async () => {
    await swing(false);
    expect(card()).not.toContain("Оглушающее");
  });
  it("Concussive выше нуля у оружия не понижается", async () => {
    await swing(true, [{ key: "concussive", rating: 2 }]);
    expect(card()).toContain("Оглушающее (2)");
  });
});

// Решение владельца 26.10.2026: оружие категории «Посох» без профилей (12 предметов пака) тоже годится —
// вторая атака идёт базовым профилем самого оружия.
describe("Оружие категории «Посох» без профилей", () => {
  const withTalent = () => actorFor({ items: [talentByKey(KEY)] });
  const staffDoc = packDocById("packs-src/weapons/Имперское/Рукопашное/Примитивное", "PkpWEGGqubPQwaqm");
  const staff = (over = {}) => weaponFor({ ...staffDoc.system, ...over }, { name: staffDoc.name });
  it("данные: настоящий Посох пака — категория «Посох», профилей нет", () => {
    expect(staffDoc.system.meleeCategory).toBe("Посох");
    expect(weaponProfiles(staff())).toEqual([]);
  });
  it("Посох без профилей, Талант, хват 2р — Приём доступен", () => {
    expect(options(withTalent(), staff()).reverseStrike.allowed).toBe(true);
  });
  it("одноручный хват у Посоха по-прежнему закрывает Приём", () => {
    expect(options(withTalent(), staff(), { gripKey: "1р" }).reverseStrike.allowed).toBe(false);
  });
  it("Посох без Таланта — нет", () => {
    expect(options(actorFor({}), staff()).reverseStrike.allowed).toBe(false);
  });
  it("другая категория без профиля посоха — нет (штык без профилей)", () => {
    expect(options(withTalent(), bayonet({ profiles: [] })).reverseStrike.allowed).toBe(false);
  });
  it("вторая атака Посоха без профилей — базовый профиль (индекс −1)", () => {
    expect(reverseStrikeSecondProfileIdx(staff())).toBe(-1);
  });
  it("вторая атака штыка — профиль «Посох» (индекс ≥ 0), как раньше", () => {
    expect(reverseStrikeSecondProfileIdx(bayonet())).toBeGreaterThanOrEqual(0);
  });
  it("у штыка без профилей второй атаки нет (null)", () => {
    expect(reverseStrikeSecondProfileIdx(bayonet({ profiles: [] }))).toBeNull();
  });
});
