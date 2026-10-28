// test/combat/vehicle-ram-swerve.test.mjs
//
// Встречный тест Тарана (Книга Машин, Таран; Sahara 62, п.12, решение владельца 24.10.2026):
// «Вираж против Тарана является встречным против Operate+0 таранящего водителя». Вираж
// цели бросается как обычно, затем бросает Operate+0 таранящая машина, и сравниваются
// Степени Успеха (rules/test-kind.mjs::resolveOpposed). Без пометки Тарана Вираж — прежний.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _performSwerve, _resolveRam } from "../../module/combat/vehicle.mjs";

function vehicle(overrides = {}) {
  return {
    type: "vehicle", name: "Химера", uuid: "Actor.swerver",
    system: { operate: 45, size: 3, derived: { swerveMod: -30 }, ...overrides }
  };
}
const rammer = (operate = 60) => ({ type: "vehicle", name: "Таран", uuid: "Actor.rammer", system: { operate, armour: { front: 20 } } });

let prevFromUuid;
beforeEach(() => {
  resetCaptured();
  prevFromUuid = globalThis.fromUuid;
  globalThis.fromUuid = async uuid => (uuid === "Actor.rammer" ? rammer() : null);
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; });

const card = () => captured.chat.at(-1)?.content ?? "";
const swerve = (opts = {}) => _performSwerve(vehicle(), { extraMod: 0, attackerUuid: "Actor.rammer", ramContest: true, ...opts });

describe("Вираж против Тарана: встречный Operate+0 таранящего", () => {
  it("Вираж с Порогом 15: выпало 05 (2 ст.), Таран 60: выпало 55 (1 ст.) — Вираж выиграл, Таран мимо", async () => {
    captured.dice = [5, 55];
    await swerve();
    expect(card()).toContain("Вираж успешен");
    expect(card()).toContain("Атака промахивается");
    expect(card()).toContain("Operate+0 таранящего");
  });

  it("обе стороны преуспели, но у Тарана степеней больше — Вираж проигрывает, Таран попадает", async () => {
    captured.dice = [10, 5];            // Вираж: 15−10 → 1 ст.; Таран 60−5 → 6 ст.
    await swerve();
    expect(card()).toContain("Вираж проигран");
    expect(card()).toContain("Таран попадает");
    expect(card()).not.toContain("Атака промахивается");
  });

  it("Вираж провален — Таран попадает, как раньше", async () => {
    captured.dice = [96, 30];
    await swerve();
    expect(card()).toContain("Вираж провален");
  });

  it("Вираж удался, а Таран провалился — Вираж выигрывает", async () => {
    captured.dice = [10, 99];
    await swerve();
    expect(card()).toContain("Вираж успешен");
    expect(card()).toContain("Атака промахивается");
  });

  it("без пометки Тарана (обычный Вираж от стрельбы) второго броска нет", async () => {
    captured.dice = [10];               // одного куба хватило бы только прежней ветке
    await swerve({ ramContest: false });
    expect(card()).toContain("Вираж успешен");
    expect(card()).not.toContain("Operate+0 таранящего");
  });

  it("таранящая машина не найдена по uuid — Вираж идёт по прежнему правилу", async () => {
    captured.dice = [10];
    await swerve({ attackerUuid: "Actor.gone" });
    expect(card()).toContain("Вираж успешен");
  });
});

describe("Карточка Тарана: Вираж помечен встречным", () => {
  it("кнопка Виража несёт пометку Тарана и uuid таранящего", async () => {
    captured.dice = [7];
    const ram = { ...rammer(), flags: {} };
    await _resolveRam(ram, false, false);
    expect(card()).toMatch(/wh-swerve-btn"[^>]*data-ram="1"/);
    expect(card()).toContain('data-attacker-uuid="Actor.rammer"');
  });
});
