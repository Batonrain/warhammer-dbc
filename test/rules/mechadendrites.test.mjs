// test/rules/mechadendrites.test.mjs
//
// Учёт мехадендритов (Основная книга, Бионика и Кибернетика → Мехадендриты):
// порты Кибер-Мантии = T.b + Калибровка, Серво-Рука/Коготь — 2 порта,
// Серво-Обвязка — 4, Терция Интерфейс — 1 (Good/Best — 2, Редкость ≤ 2);
// атака дендритом без Mechadendrite Use (Weapon) — −20.

import { describe, it, expect } from "vitest";
import {
  mechadendritePorts, mechadendriteInstallWarning, mechadendriteTraining, implantPorts,
  mechadendriteType, isMechadendriteWeapon, mechadendriteAttackPenalty, mechPortsView
} from "../../module/rules/mechadendrites.mjs";
import { weaponTrainingPenalty } from "../../module/rules/weapon-training.mjs";

const NS = "warhammer-dbc";
let seq = 0;
const implant = (name, { category = "mechadendrite", installed = true, quality = "common",
                         availability = 2, description = "" } = {}) => ({
  id: `i${++seq}`, type: "implant", name,
  system: { category, quality, availability, description },
  flags: { [NS]: { installed } }
});
const dendrite = (name, kind = "Utility", extra = {}) =>
  implant(name, { description: `R:2. ${kind}.\nОписание`, ...extra });
const mantle = (extra = {}) => implant("Cyber-Mantle / Кибер-Мантия", { category: "mechanicus", ...extra });
const talent = (name, specialization = "") => ({ id: `t${++seq}`, type: "talent", name, system: { specialization } });
const CALIB = "Cyber-Mantle Calibration / Калибровка Кибер-Мантии";
const USE = "Mechadendrite Use / Использование Мехадендритов";

const actor = (items = [], { tb = 4, ib = 3 } = {}) => ({
  system: { characteristics: { t: { bonus: tb }, int: { bonus: ib } } }, items
});

describe("implantPorts / mechadendriteType", () => {
  it("обычный дендрит — 1 порт, Серво-Рука и Серво-Коготь — 2, Серво-Обвязка — 4", () => {
    expect(implantPorts(dendrite("Mechatendril / Мехатендрил"))).toBe(1);
    expect(implantPorts(dendrite("Servo-Arm / Серво-Рука"))).toBe(2);
    expect(implantPorts(dendrite("Servo-Talon / Серво-Коготь", "Оружие"))).toBe(2);
    expect(implantPorts(dendrite("Servo-Harness / Серво-Обвязка"))).toBe(4);
  });
  it("Унктор Когнис занимает 1 слот Мантии, прочие импланты Механикус — 0", () => {
    expect(implantPorts(implant("Unctor Cognis / Унктор Когнис", { category: "mechOther" }))).toBe(1);
    expect(implantPorts(mantle())).toBe(0);
  });
  it("тип берётся из книжной строки «R:N. Оружие/Utility»", () => {
    expect(mechadendriteType(dendrite("Dendrite Blade / Дендрит Лезвие", "Оружие"))).toBe("weapon");
    expect(mechadendriteType(dendrite("Optical Mechadendrite / Оптический Мехадендрит"))).toBe("utility");
    expect(mechadendriteType(mantle())).toBe("");
  });
});

describe("mechadendritePorts — максимум", () => {
  it("Кибер-Мантия: максимум T.b", () => {
    const p = mechadendritePorts(actor([mantle(), dendrite("Mechatendril / Мехатендрил")], { tb: 4 }));
    expect(p).toMatchObject({ source: "mantle", base: 4, max: 4, used: 1, free: 3, over: false });
  });
  it("каждая копия Калибровки +1 к максимуму", () => {
    const p = mechadendritePorts(actor([mantle(), talent(CALIB), talent(CALIB)], { tb: 3 }));
    expect(p.max).toBe(5);
    expect(p.calibration).toBe(2);
  });
  it("Калибровка сверх I.b считается, но попадает в предупреждения", () => {
    const p = mechadendritePorts(actor([mantle(), talent(CALIB), talent(CALIB)], { tb: 3, ib: 1 }));
    expect(p.max).toBe(5);
    expect(p.calibrationOver).toBe(true);
    expect(p.warnings.join()).toMatch(/I\.b = 1/);
  });
  it("неустановленная (лежит в снаряжении) Мантия портов не даёт", () => {
    const p = mechadendritePorts(actor([mantle({ installed: false }), dendrite("Mechatendril / Мехатендрил")]));
    expect(p.source).toBe("none");
    expect(p.warnings.join()).toMatch(/Нет Кибер-Мантии/);
  });
  it("неустановленный дендрит портов не занимает", () => {
    const p = mechadendritePorts(actor([mantle(), dendrite("Servo-Arm / Серво-Рука", "Utility", { installed: false })]));
    expect(p.used).toBe(0);
  });
  it("перебор портов: Серво-Обвязка + Серво-Рука при T.b 4", () => {
    const p = mechadendritePorts(actor([mantle(), dendrite("Servo-Harness / Серво-Обвязка"),
      dendrite("Servo-Arm / Серво-Рука")], { tb: 4 }));
    expect(p.used).toBe(6);
    expect(p.over).toBe(true);
    expect(p.warnings.join()).toMatch(/6 из 4/);
  });
  it("Терция Интерфейс: 1 порт, Good.Q — 2, Калибровка ей не прибавляет", () => {
    const tertia = q => implant("Tertia Interface / Терция Интерфейс", { category: "cybernetic", quality: q });
    expect(mechadendritePorts(actor([tertia("common"), talent(CALIB)])).max).toBe(1);
    expect(mechadendritePorts(actor([tertia("good")])).max).toBe(2);
    expect(mechadendritePorts(actor([tertia("best")])).source).toBe("tertia");
  });
  it("Терция держит только Редкость ≤ 2", () => {
    const tertia = implant("Tertia Interface / Терция Интерфейс", { category: "cybernetic" });
    const p = mechadendritePorts(actor([tertia, dendrite("Plasma Cutter / Плазменный Резак", "Оружие", { availability: 3 })]));
    expect(p.items[0].rarityOver).toBe(true);
    expect(p.warnings.join()).toMatch(/Редкость ≤ 2/);
  });
  it("с настоящей Мантией Терция бесполезна", () => {
    const tertia = implant("Tertia Interface / Терция Интерфейс", { category: "cybernetic", quality: "best" });
    expect(mechadendritePorts(actor([mantle(), tertia], { tb: 5 })).max).toBe(5);
  });
});

describe("mechadendriteTraining", () => {
  it("специализация из поля и из скобок имени", () => {
    expect([...mechadendriteTraining(actor([talent(USE, "Weapon")]))]).toEqual(["weapon"]);
    expect([...mechadendriteTraining(actor([talent("Mechadendrite Use (Utility)")]))]).toEqual(["utility"]);
    expect([...mechadendriteTraining(actor([talent(USE, "Оружие")]))]).toEqual(["weapon"]);
  });
  it("необученный тип дендрита помечен", () => {
    const p = mechadendritePorts(actor([mantle(), talent(USE, "Utility"),
      dendrite("Dendrite Blade / Дендрит Лезвие", "Оружие"), dendrite("Mechatendril / Мехатендрил")]));
    expect(p.items.map(x => x.untrained)).toEqual([true, false]);
    expect(p.training).toEqual({ weapon: false, utility: true });
  });
});

describe("атака мехадендритом", () => {
  const weapon = (name, profileLabel = "Мехадендрит") =>
    ({ type: "weapon", name, system: { profileLabel, weaponType: "exotic", weaponClass: "melee" } });

  it("опознаёт дендриты по ярлыку и Серво-Руку/Коготь по имени", () => {
    expect(isMechadendriteWeapon(weapon("Mechatendril / Мехатендрил"))).toBe(true);
    expect(isMechadendriteWeapon(weapon("Servo-Arm / Серво-Рука", ""))).toBe(true);
    expect(isMechadendriteWeapon(weapon("Servo-Talon / Серво-Коготь", ""))).toBe(true);
    expect(isMechadendriteWeapon(weapon("Chainsword / Цепной Меч", ""))).toBe(false);
  });
  it("без Mechadendrite Use (Weapon) — −20, с ним — 0", () => {
    expect(mechadendriteAttackPenalty(actor()).total).toBe(-20);
    expect(mechadendriteAttackPenalty(actor([talent(USE, "Utility")])).total).toBe(-20);
    expect(mechadendriteAttackPenalty(actor([talent(USE, "Weapon")])).total).toBe(0);
  });
  it("Тренировка: дендрит спрашивает Mechadendrite Use, а не Exotic Weapon Training", () => {
    const trained = actor([talent(USE, "Weapon")]);
    expect(weaponTrainingPenalty({ actor: trained, weaponType: "exotic", weaponName: "Mechatendril / Мехатендрил",
      mechadendrite: true }).total).toBe(0);
    const exoticOnly = actor([talent("Exotic Weapon Training / Экзотическая Оружейная Тренировка", "Mechatendril")]);
    const out = weaponTrainingPenalty({ actor: exoticOnly, weaponType: "exotic", weaponName: "Mechatendril / Мехатендрил",
      mechadendrite: true });
    expect(out.total).toBe(-20);
    expect(out.parts[0].label).toMatch(/Mechadendrite Use/);
  });
});

describe("mechadendriteInstallWarning (Хирургеон)", () => {
  it("свободные порты есть — молчит; не хватает — говорит сколько", () => {
    const a = actor([mantle(), dendrite("Servo-Arm / Серво-Рука")], { tb: 3 });
    expect(mechadendriteInstallWarning(a, dendrite("Mechatendril / Мехатендрил", "Utility", { installed: false }))).toBe("");
    expect(mechadendriteInstallWarning(a, dendrite("Servo-Talon / Серво-Коготь", "Оружие", { installed: false })))
      .toMatch(/нужно портов 2, свободно 1 из 3/);
  });
  it("без Мантии и Терции — подключить некуда; не дендрит — молчит", () => {
    expect(mechadendriteInstallWarning(actor(), dendrite("Mechatendril / Мехатендрил"))).toMatch(/некуда/);
    expect(mechadendriteInstallWarning(actor(), mantle())).toBe("");
  });
});

describe("mechPortsView (строка на вкладке ТЕЛО)", () => {
  it("нет ни дендритов, ни Мантии — строки нет", () => {
    expect(mechPortsView(mechadendritePorts(actor()))).toBe(null);
  });
  it("занято/максимум и подсказка со счётом", () => {
    const v = mechPortsView(mechadendritePorts(actor([mantle(), talent(CALIB), talent(USE, "Weapon, Utility"),
      dendrite("Mechatendril / Мехатендрил")], { tb: 4 })));
    expect(v).toMatchObject({ used: 1, max: 5, warn: false });
    expect(v.title).toMatch(/T\.b 4 \+ Калибровка 1/);
  });
  it("необученный дендрит или перебор — предупреждение", () => {
    const v = mechPortsView(mechadendritePorts(actor([mantle(), dendrite("Dendrite Blade / Дендрит Лезвие", "Оружие")])));
    expect(v.warn).toBe(true);
    expect(v.title).toMatch(/атака дендритом −20/);
  });
});
