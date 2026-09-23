// test/combat/damage-subtype-sources.test.mjs
//
// wdbc-9zpt: подвид урона (I(Cr)/X(Fr)/E(El)/…) доходил до applyDamageToActor
// только из обычной атаки персонажа (attack-card.mjs). Остальные окна урона
// клали на кнопку «Применить урон» один тип, и всё, что читает подвид
// (Проводящая, Мягкая, Флак, иммунитеты damageImmunity.subtype.*), в них
// молча не работало. Тесты подвидов раньше звали applyDamageToActor напрямую
// с damageSubtype в аргументах — здесь проверяется сам источник: кнопка
// карточки или вызов из действия Борьбы.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";

vi.mock("../../module/combat/damage.mjs", async importOriginal => ({
  ...(await importOriginal()),
  applyDamageToActor: vi.fn(async () => {})
}));

const { applyDamageToActor } = await import("../../module/combat/damage.mjs");
const { WarhammerHordeSheet } = await import("../../module/sheets/horde-sheet.mjs");
const { _resolveRam } = await import("../../module/combat/vehicle.mjs");
const { _doBite, _doCrunch, _resolveWrenchSuccess } = await import("../../module/combat/grapple.mjs");

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
  applyDamageToActor.mockClear();
});

describe("Орда: подвид оружия едет на кнопку урона", () => {
  const hordeAttack = weapon => WarhammerHordeSheet.prototype._executeHordeAttack.call(
    { actor: actorFor({ derived: { magDamageDice: 0 } }) }, weapon, "ws", 50, true, 3);

  it("дубина I(Cr) — data-damage-subtype=\"crushing\"", async () => {
    captured.dice = [30, 5];
    await hordeAttack(weaponFor({ weaponClass: "melee", damage: "1d10", damageType: "impact", damageSubtype: "crushing" }));
    expect(card()).toContain('data-damage-subtype="crushing"');
  });

  it("оружие без подвида — пустой атрибут, не «undefined»", async () => {
    captured.dice = [30, 5];
    await hordeAttack(weaponFor({ weaponClass: "melee", damage: "1d10", damageType: "impact" }));
    expect(card()).toContain('data-damage-subtype=""');
  });
});

describe("Таран техники — I(Cr) (книга: «урон от Тарана становится E вместо I(Cr)»)", () => {
  it("кнопка несёт crushing", async () => {
    captured.dice = [7];
    await _resolveRam({ type: "vehicle", name: "Химера", flags: {}, system: { armour: { front: 5 } } }, false, false);
    expect(card()).toContain('data-damage-subtype="crushing"');
  });
});

describe("Борьба: прямые попадания несут подвид", () => {
  const PARTNER_UUID = "Actor.partner";
  const partner = { uuid: PARTNER_UUID, name: "Партнёр" };
  let savedFromUuidSync;

  /** Захвативший с партнёром по Борьбе: grapplePartner читает флаг и fromUuidSync. */
  function grappler(items) {
    const actor = actorFor({ items });
    actor.uuid = "Actor.grappler";
    actor.getFlag = (_s, key) => (key === "grapplePartnerUuid" ? PARTNER_UUID : undefined);
    return actor;
  }

  beforeEach(() => {
    savedFromUuidSync = globalThis.fromUuidSync;
    globalThis.fromUuidSync = uuid => (uuid === PARTNER_UUID ? partner : null);
  });
  afterEach(() => { globalThis.fromUuidSync = savedFromUuidSync; });

  const lastDamage = () => applyDamageToActor.mock.calls.at(-1)?.[1] ?? {};

  it("Укус — подвид самого оружия Укус", async () => {
    const bite = weaponFor({ weaponClass: "melee", damage: "1d10", damageType: "rending", damageSubtype: "toxic" }, { name: "Bite / Укус" });
    captured.dice = [4];
    await _doBite(grappler([bite]), { aim: "torso" });
    expect(lastDamage()).toMatchObject({ damageType: "rending", damageSubtype: "toxic" });
  });

  it("Хруст — подвид оружия с Crunch", async () => {
    const maul = weaponFor({ weaponClass: "melee", damage: "1d10", damageType: "impact", damageSubtype: "crushing",
      weaponProps: [{ key: "crunch" }] }, { name: "Молот" });
    await _doCrunch(grappler([maul]));
    expect(lastDamage()).toMatchObject({ damageType: "impact", damageSubtype: "crushing" });
  });

  it("Заломить без Когтей — 1d5+S.b I(Cr) по книге", async () => {
    const pending = _resolveWrenchSuccess(grappler([]));
    await vi.waitFor(() => expect(captured.press).toBeTypeOf("function"));
    captured.dice = [3];
    const form = { querySelector: sel => ({ checked: sel.includes('"dmg"') }) };
    await captured.press("apply", form);
    await pending;
    expect(lastDamage()).toMatchObject({ damageType: "impact", damageSubtype: "crushing", ignoreArmour: true });
  });

  it("Заломить Когтями — подвид Когтей", async () => {
    const claws = weaponFor({ weaponClass: "melee", damage: "1d10", damageType: "rending", damageSubtype: "flame",
      equipped: true, meleeCategory: "Когти" }, { name: "Огненные Когти" });
    const pending = _resolveWrenchSuccess(grappler([claws]));
    await vi.waitFor(() => expect(captured.press).toBeTypeOf("function"));
    captured.dice = [6];
    const form = { querySelector: sel => ({ checked: sel.includes('"dmg"') }) };
    await captured.press("apply", form);
    await pending;
    expect(lastDamage()).toMatchObject({ damageType: "rending", damageSubtype: "flame" });
  });
});
