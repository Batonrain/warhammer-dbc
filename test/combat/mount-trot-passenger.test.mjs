// test/combat/mount-trot-passenger.test.mjs
//
// Trot / Рысь (Всадник): «скакун или байк игнорируют Трудный Ландшафт и не дают
// штрафов на действия всадника или пассажира» (Sahara trait-stand, п.1). Если
// стреляет ПАССАЖИР, а Рысь у ведущего всадника на том же скакуне, штраф стрельбы
// с седла снимается и ему.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { mountRangedPenalty, trotApplies, leadRiderOf } from "../../module/rules/mount.mjs";

const talent = name => ({ type: "talent", name, system: {}, flags: {} });
const mount = { uuid: "Actor.horse", type: "character", name: "Конь", system: {}, items: [] };
const lead = (items = [talent("Trot / Рысь")]) =>
  ({ uuid: "Actor.lead", name: "Ведущий", type: "character", items, system: { mount: { uuid: "Actor.horse", role: "rider", speed: "half" } } });
const passenger = () =>
  ({ uuid: "Actor.pass", name: "Пассажир", type: "character", items: [], system: { mount: { uuid: "Actor.horse", role: "passenger", speed: "half" } } });
const otherRider = () =>
  ({ uuid: "Actor.other", name: "Чужой", type: "character", items: [], system: { mount: { uuid: "Actor.other-horse", role: "rider", speed: "half" } } });

describe("Рысь ведущего снимает штраф пассажира", () => {
  it("ведущий найден среди седоков того же скакуна (role ≠ passenger)", () => {
    const a = [lead(), passenger(), otherRider()];
    expect(leadRiderOf(a[1], mount, a)?.uuid).toBe("Actor.lead");
    expect(leadRiderOf(a[0], mount, a)).toBeNull();            // сам ведущий — не «пассажир»
  });

  it("стреляет пассажир, Рысь у ведущего: на полудвижении штраф 0 (без Рыси был бы −10)", () => {
    const a = [lead(), passenger()];
    expect(mountRangedPenalty("half", mount, { rider: a[1], actors: a })).toBe(0);
    expect(mountRangedPenalty("half", mount, { rider: a[1] })).toBe(-10);   // без списка акторов ведущего не найти
    expect(trotApplies(a[1], "half", { lead: a[0] })).toBe(true);
  });

  it("на полном движении Рысь не действует и на пассажира", () => {
    const a = [lead(), passenger()];
    expect(mountRangedPenalty("full", mount, { rider: a[1], actors: a })).toBe(-20);
  });

  it("у ведущего нет Рыси — пассажир штраф сохраняет; чужой всадник на другом скакуне не помогает", () => {
    const a = [lead([]), passenger()];
    expect(mountRangedPenalty("half", mount, { rider: a[1], actors: a })).toBe(-10);
    const b = [lead([talent("Trot")]), otherRider()];
    expect(mountRangedPenalty("half", mount, { rider: otherRider(), actors: b })).toBe(-10);
  });
});
