// Хвост Талантов Элитных Архетипов (21.11.2026): доводка 13 частичных и Соглашения Доблести.
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { dimacherusSolo } from "../../module/rules/dual-wield-talents.mjs";
import { critSuccessOnlyFromRules } from "../../module/rules/resolve-test.mjs";
import { hiddenPatternsRules, RAVEN_STANCE_FLAG } from "../../module/rules/raven-talents.mjs";
import { thrustDegFromMessage } from "../../module/combat/kenetai.mjs";
import {
  brotherhoodSustainCost, halveBladeBuff, brotherhoodBuffsFor, BROTHERHOOD_FLAG
} from "../../module/rules/kenetai-talents.mjs";
import {
  runicFlightRounds, runicFlightLine, seekerReady, seekerThresholdOffset, seekerIgnoresGrappleCover,
  timedExplosionPoint, SEEKER_FLAG
} from "../../module/rules/runic-shot.mjs";
import { secutorPinOf, shieldPinning, weaponPinnedBy, SECUTOR_PIN_FLAG } from "../../module/rules/gladiator-arena.mjs";
import {
  ordinatorGunRefusal, ordinatorVehicleGun, ordinatorLoader, ordinatorLoaderCost, isMainVehicleGun
} from "../../module/rules/secutor-talents.mjs";
import { devourerWeapon, devourerRamming, DEVOURER_RAM_FLAG } from "../../module/rules/terminator-talents.mjs";
import { electropriestActive, otherFrameInstalled } from "../../module/rules/electropriest.mjs";
import {
  suppressibleArchetypeOf, suppressedArchetypes, itemShouldBeSuppressed, timedSuppressions, valourViolation,
  valourPenalty, TIMED_FLAG, BLOOD_SMITH, ELECTROPRIEST, VALOUR_SECONDS, VALOUR_OWN_FLAG
} from "../../module/rules/archetype-suppression.mjs";
import { hasItemNamed } from "../../module/rules/req-atom.mjs";

const NS = "warhammer-dbc";
const T = (name, type = "talent", extra = {}) => ({ type, name, ...extra });
const actor = (items = [], flags = {}, extra = {}) => ({
  items: items.map(n => typeof n === "string" ? T(n) : n), flags: { [NS]: flags }, system: {}, ...extra
});

describe("Димахер: Таланты Два Оружия с одним оружием", () => {
  it("узнаётся по Таланту", () => {
    expect(dimacherusSolo(actor(["Dimacherus / Димахер"]))).toBe(true);
    expect(dimacherusSolo(actor(["Crossblock"]))).toBe(false);
  });
});

describe("Скрытые Узоры: засечь Стойку — только Критический Успех", () => {
  const raven = actor([T("Hidden Patterns / Скрытые Узоры"), T("Stances of Deceit / Стойки Обмана", "trait")],
    { [RAVEN_STANCE_FLAG]: ["confusion"] }, { name: "Ворон" });
  const seer = actor([], {}, { name: "Псайкер" });
  it("правило есть только при активной Стойке и на Psyniscience", () => {
    const rules = hiddenPatternsRules(seer, { targetActor: raven });
    expect(rules).toHaveLength(1);
    expect(critSuccessOnlyFromRules(rules, { skill: "psyniscience" })).toHaveLength(1);
    expect(critSuccessOnlyFromRules(rules, { skill: "awareness" })).toHaveLength(0);
    const calm = actor(raven.items, {}, { name: "Ворон" });
    expect(hiddenPatternsRules(seer, { targetActor: calm })).toEqual([]);
    expect(hiddenPatternsRules(raven, { targetActor: raven })).toEqual([]);
  });
});

describe("Выпад Души: Успехи попадания с карточки атаки", () => {
  const msg = (technique, hit, deg) => ({ flags: { [NS]: { attack: { hit, deg, opts: { techniqueOpts: { technique } } } } } });
  it("Выпад-попадание — его Успехи, иначе 0, нет атаки — null", () => {
    expect(thrustDegFromMessage(msg("thrust", true, 3))).toBe(3);
    expect(thrustDegFromMessage(msg("thrust", false, 3))).toBe(0);
    expect(thrustDegFromMessage(msg("feint", true, 3))).toBe(0);
    expect(thrustDegFromMessage({ flags: {} })).toBeNull();
  });
});

describe("Клинки Братства", () => {
  const power = (list, wb = { enabled: true, damageMod: 3, penMod: -3, rangeMod: 0, balanceMod: 1 }) => ({
    type: "psychicPower", name: "Клинок", system: { isSustained: true, sustainCost: 2, effects: { weaponBuff: wb } },
    flags: { [NS]: { [BROTHERHOOD_FLAG]: list } }
  });
  it("половина эффекта, окр.▲ по модулю", () => {
    expect(halveBladeBuff({ damageMod: 3, penMod: -3, rangeMod: 0, balanceMod: 1 }))
      .toMatchObject({ damageMod: 2, penMod: -2, rangeMod: 0, balanceMod: 1 });
  });
  it("союзник получает ½ на экипированное рукопашное; кенетаи платит ещё одно поддержание", () => {
    const ally = { uuid: "A", items: [], name: "Брат" };
    const kenetai = { uuid: "K", name: "Кенетаи", items: [power(["A"])] };
    const sword = { system: { weaponClass: "melee", equipped: true } };
    expect(brotherhoodBuffsFor(ally, sword, [kenetai, ally])).toHaveLength(1);
    expect(brotherhoodBuffsFor(ally, { system: { weaponClass: "basic", equipped: true } }, [kenetai])).toEqual([]);
    expect(brotherhoodSustainCost(kenetai)).toBe(2);
    expect(brotherhoodSustainCost({ items: [power([])] })).toBe(0);
  });
});

describe("Рунная Артиллерия: время полёта", () => {
  it("до 3×Rng — сразу, дальше — по Раунду на каждые 3×Rng", () => {
    expect(runicFlightRounds(300, 100)).toBe(0);
    expect(runicFlightRounds(301, 100)).toBe(1);
    expect(runicFlightRounds(900, 100)).toBe(2);
    expect(runicFlightLine(100, 100)).toBe("");
    expect(runicFlightLine(700, 100)).toMatch(/через 2/);
  });
});

describe("Пуля Искатель", () => {
  it("заряд читается с флага, вне диапазона — нет", () => {
    expect(seekerReady(actor([], { [SEEKER_FLAG]: 1 }))).toBe(1);
    expect(seekerReady(actor([], { [SEEKER_FLAG]: 9 }))).toBeNull();
    expect(seekerReady(actor())).toBeNull();
  });
  it("каждый эффект возвращает в Порог свои штрафы", () => {
    const f = { aimPenalty: -20, sizePenalty: -10, coverMod: -30, seekerMelee: -20, seekerLos: -30 };
    expect(seekerThresholdOffset(0, f)).toBe(30);
    expect(seekerThresholdOffset(1, f)).toBe(50);
    expect(seekerThresholdOffset(2, f)).toBe(30);
    expect(seekerThresholdOffset(3, f)).toBe(0);
    expect(seekerIgnoresGrappleCover(1)).toBe(true);
    expect(seekerIgnoresGrappleCover(0)).toBe(false);
  });
});

describe("Выдержанный Взрыв: точка позади цели", () => {
  it("на линии стрелок → цель, за радиус токена + 1 м", () => {
    expect(timedExplosionPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, 50, 20)).toEqual({ x: 170, y: 0 });
  });
});

describe("Секуторий: прижатое оружие", () => {
  const gl = actor([], { [SECUTOR_PIN_FLAG]: { weaponUuid: "W1", weaponName: "Меч" } });
  it("щит занят, оружие найдено по Гладиатору", () => {
    expect(secutorPinOf(gl).weaponUuid).toBe("W1");
    expect(shieldPinning(gl, { type: "weapon", system: { shieldAP: 2 } })).toBe(true);
    expect(shieldPinning(gl, { type: "weapon", system: { shieldAP: null } })).toBe(false);
    expect(weaponPinnedBy({ uuid: "W1" }, [actor(), gl])).toBe(gl);
    expect(weaponPinnedBy({ uuid: "W2" }, [gl])).toBeNull();
  });
});

describe("Ординатор: оружие техники", () => {
  const vehGun = (mount, props = []) => ({ type: "weapon", name: "Пушка",
    system: { vehicleMount: { isMounted: true, mount }, weaponProps: props.map(key => ({ key })) } });
  const ord = (...extra) => actor([T("Ordinator / Ординатор"), ...extra]);
  it("главное орудие: в корпусе нельзя, в башне — с Серво-Рукой", () => {
    const main = [ "ordnance" ];
    expect(isMainVehicleGun(vehGun("turret", main))).toBe(true);
    expect(ordinatorGunRefusal(ord(), vehGun("hull", main))).toMatch(/корпусе/);
    expect(ordinatorGunRefusal(ord(), vehGun("turret", main))).toMatch(/Серво-Рука/);
    expect(ordinatorGunRefusal(ord({ type: "implant", name: "Servo-Arm / Серво-Рука" }), vehGun("turret", main))).toBe("");
    expect(ordinatorGunRefusal(ord(), vehGun("turret"))).toBe("");
    expect(ordinatorGunRefusal(actor(), vehGun("hull", main))).toBe("");
  });
  it("стрельба на ходу со штрафом — только оружие техники у Ординатора", () => {
    expect(ordinatorVehicleGun(ord(), vehGun("turret"))).toBe(true);
    expect(ordinatorVehicleGun(ord(), { type: "weapon", system: {} })).toBe(false);
  });
  it("Заряжающий: оба мехадендрита, Rld −1", () => {
    const tech = { type: "implant", name: "Technical Mechadendrite / Технический Мехадендрит" };
    const manip = { type: "implant", name: "Manipulator Mechadendrite / Манипулятор Мехадендрит" };
    expect(ordinatorLoader(ord(tech, manip))).toBe(true);
    expect(ordinatorLoader(ord(tech))).toBe(false);
    expect([1, 2, 4, 6].map(ordinatorLoaderCost)).toEqual([0, 1, 2, 4]);
  });
});

describe("Поглотитель", () => {
  const w = (name, range, equipped = true, damage = "1d10+2") =>
    ({ type: "weapon", name, system: { weaponClass: "melee", range, equipped, damage } });
  it("оружие Rng 0–1, экипированное прежде", () => {
    const a = actor([T("Devourer / Поглотитель"), w("Копьё", 3), w("Кулак", 0, false, "2d10"), w("Коготь", 1)]);
    expect(devourerWeapon(a).name).toBe("Коготь");
    expect(devourerWeapon(actor([w("Коготь", 1)]))).toBeNull();
  });
  it("метка Тарана", () => {
    expect(devourerRamming(actor([], { [DEVOURER_RAM_FLAG]: true }))).toBe(true);
    expect(devourerRamming(actor())).toBe(false);
  });
});

describe("Сила Из Плоти: подавление Электрожреца", () => {
  const pff = T("Power From Flesh / Сила Из Плоти", "trait");
  const coils = T("Electropriest Coils / Катушки Электрожреца", "trait");
  it("гаснет от Machine и от чужого Фрейма", () => {
    expect(electropriestActive(actor([pff, coils]))).toBe(true);
    expect(electropriestActive(actor([pff, T("Machine (2)", "trait")]))).toBe(false);
    expect(electropriestActive(actor([pff, T("Machine (2)", "trait"), T("Fleshmetal")]))).toBe(true);
    const framed = actor([pff, T("Paladin Frame / Фрейм Паладина", "trait")]);
    expect(otherFrameInstalled(framed)).toBe(true);
    expect(electropriestActive(framed)).toBe(false);
    expect(suppressedArchetypes(framed).has(ELECTROPRIEST)).toBe(true);
  });
  it("гасит Таланты и Черты Архетипа и его бонусы, но не саму Силу Из Плоти", () => {
    const a = actor([pff, coils, T("Machine", "trait")]);
    expect(suppressibleArchetypeOf(coils)).toBe(ELECTROPRIEST);
    expect(suppressibleArchetypeOf(pff)).toBeNull();
    expect(itemShouldBeSuppressed(a, coils)).toBe(true);
    expect(itemShouldBeSuppressed(a, pff)).toBe(false);
    expect(itemShouldBeSuppressed(a, { type: "eliteArchetype", name: "Электрожрец" })).toBe(true);
    expect(itemShouldBeSuppressed(a, T("Machine", "trait"))).toBe(false);
  });
  it("погашенный предмет не находится проверкой «есть ли Талант»", () => {
    const off = { ...coils, flags: { [NS]: { archetypeSuppressed: true } } };
    expect(hasItemNamed(actor([off]), "Electropriest Coils", ["trait"])).toBe(false);
    expect(hasItemNamed(actor([coils]), "Electropriest Coils", ["trait"])).toBe(true);
  });
});

describe("Соглашение Доблести", () => {
  const accord = T("Valourous Accord / Соглашение Доблести", "trait");
  const smith = (items = [], flags = {}) => actor([accord, ...items], flags);
  const weapon = (own, props = []) => ({ type: "weapon", name: "Клинок", system: { weaponProps: props.map(key => ({ key })) },
    flags: { [NS]: own ? { [VALOUR_OWN_FLAG]: true } : {} } });
  it("нарушения: психосила, ритуал не Призыва, психосиловое и чужое оружие, чужая броня", () => {
    const a = smith();
    expect(valourViolation(a, "psychic")).toMatch(/психосил/);
    expect(valourViolation(a, "ritual", { name: "Призыв", system: { ritualType: "summon" } })).toBe("");
    expect(valourViolation(a, "ritual", { name: "Проклятье", system: { ritualType: "curse" } })).toMatch(/ритуал/);
    expect(valourViolation(a, "attack", weapon(true))).toBe("");
    expect(valourViolation(a, "attack", weapon(false))).toMatch(/чужим/);
    expect(valourViolation(a, "attack", weapon(true, ["force"]))).toMatch(/психосиловым/);
    expect(valourViolation(a, "attack", { ...weapon(false), flags: { [NS]: { integralAttack: true } } })).toBe("");
    expect(valourViolation(a, "equip", { type: "armor", name: "Латы", flags: {} })).toMatch(/чужое/);
    expect(valourViolation(actor(), "psychic")).toBe("");
  });
  it("срок 8 дней; повтор во время срока", () => {
    const a = smith();
    expect(valourPenalty(a, 100)).toEqual({ until: 100 + VALOUR_SECONDS, repeat: false });
    const b = smith([], { [TIMED_FLAG]: { [BLOOD_SMITH]: { until: 1000, since: 0 } } });
    expect(valourPenalty(b, 500).repeat).toBe(true);
    expect(Object.keys(timedSuppressions(b, 2000))).toEqual([]);
  });
  it("в срок гаснут Черты и Таланты Кузнеца, но не само Соглашение", () => {
    const ring = T("Ring of Blood / Кольцо Крови", "trait");
    const b = smith([ring], { [TIMED_FLAG]: { [BLOOD_SMITH]: { until: 1000, since: 0 } } });
    expect(itemShouldBeSuppressed(b, ring, 500)).toBe(true);
    expect(itemShouldBeSuppressed(b, accord, 500)).toBe(false);
    expect(itemShouldBeSuppressed(b, ring, 1500)).toBe(false);
  });
});
