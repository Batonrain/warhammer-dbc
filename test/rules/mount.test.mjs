// test/rules/mount.test.mjs
//
// Верховой бой (корбук стр. 477-478). Проверяется то, что игрок увидит в
// панели «ВЕРХОМ» и в карточках верховых тестов: каким Навыком ведётся
// скакун, какие углы поворота открыты на каждой скорости, куда приходится
// попадание и с какой высоты падает выбитый из седла.
//
// Ни одной проверки на Foundry: таблицы книги должны сверяться глазами, не
// поднимая мир.

import { describe, it, expect } from "vitest";
import {
  MOUNT_SPEEDS, MOUNT_TURNS, MOUNT_SKID, SELECTIVE_MODS, STAY_MOD, BIKE_REPAIR,
  mountTraits, isBike, isAirborne, mountControlSkill, skillValue, riderControl, legionPenalty,
  testMod, maneuverMods, turnOptions, skidInfo, rangedPenalty, passengerActionMod,
  isDouble, hitTarget, selectiveMod, fallFromSaddle, mountSpd, acrobaticsStayMod,
  handsNeeded, bonusHalfAction, ridersOf, passengerCount, sizeFits, pairInitiative,
  atFullHealth, ablativeDamage, isBroken, mountPairFor
} from "../../module/rules/mount.mjs";

/** Черта существа или техники: имя двуязычное, как в паках. */
const trait = (name, rating = 0, type = "trait") => ({ type, name, system: { rating } });
const talent = name => ({ type: "talent", name });

/** Живой скакун: Раны, Размер, SPD в перемещении. */
const beast = ({ items = [], size = 1, spd = 8, wounds = 14, init = 3 } = {}) => ({
  type: "character", uuid: "Actor.beast", items,
  system: {
    size, initiative: init,
    movement: { halfMove: spd },
    wounds: { value: wounds, max: wounds, critical: 0 }
  }
});

/** Байк: техника со Структурой и ходовой. */
const bike = ({ items = [], size = 1, spd = 8, structure = 6, critical = 0, chassis = "wheeled" } = {}) => ({
  type: "vehicle", uuid: "Actor.bike", items,
  system: {
    size, initiative: 0, chassis: { type: chassis, spd },
    structure: { value: structure, max: 6, critical }
  }
});

/** Всадник: характеристики, ранги Навыков и специализации Operate. */
const rider = ({ ag = 40, per = 30, int = 35, sBonus = 8, survival = "untrained", techUse = "untrained",
                 operate = [], items = [], init = 5, size = 0, mountUuid = "" } = {}) => ({
  type: "character", uuid: "Actor.rider", items,
  system: {
    size, initiative: init,
    characteristics: { ag: { total: ag }, per: { total: per }, int: { total: int },
                        s: { bonus: sBonus } },
    skills: { survival: { rank: survival, total: per - 20 }, techUse: { rank: techUse } },
    groupSkills: { operate },
    mount: { uuid: mountUuid, role: "rider" }
  }
});

const op = (specKey, rank) => ({ specKey, specialty: specKey, rank });

describe("таблицы книги", () => {
  it("штраф стрельбы растёт со скоростью и упирается в −30", () => {
    expect(MOUNT_SPEEDS.still.ranged).toBe(0);
    expect(MOUNT_SPEEDS.half.ranged).toBe(-10);
    expect(MOUNT_SPEEDS.full.ranged).toBe(-20);
    expect(MOUNT_SPEEDS.charge.ranged).toBe(-30);
    expect(MOUNT_SPEEDS.run.ranged).toBe(-30);
  });

  it("бесплатный угол падает с 90° на 45°, как только скакун разгоняется", () => {
    expect(MOUNT_TURNS.half.free).toBe(90);
    expect(MOUNT_TURNS.full.free).toBe(45);
    expect(MOUNT_TURNS.charge.free).toBe(45);
    expect(MOUNT_TURNS.run.free).toBe(45);
  });

  // Самый крутой доступный угол на каждой скорости — ровно из книги.
  it("предельные углы: 180° на Полудвижении, 270° на Полном, 135° на Натиске и Беге", () => {
    const max = key => Math.max(...MOUNT_TURNS[key].options.map(o => o.angle));
    expect(max("half")).toBe(180);
    expect(max("full")).toBe(270);
    expect(max("charge")).toBe(135);
    expect(max("run")).toBe(135);
  });

  it("на Бегу поворот на 135° идёт с −10, а тест Ловкости всё равно +0", () => {
    const wide = MOUNT_TURNS.run.options.find(o => o.angle === 135);
    expect(wide.mod).toBe(-10);
    expect(wide.riderMod).toBe(0);
  });

  it("Избирательная атака по всаднику −10, по скакуну без штрафа", () => {
    expect(SELECTIVE_MODS.rider).toBe(-10);
    expect(SELECTIVE_MODS.mount).toBe(0);
    expect(SELECTIVE_MODS.riderCovered).toBe(-30);
  });

  it("удержание в седле: скакун +0, байк −10", () => {
    expect(STAY_MOD.beast).toBe(0);
    expect(STAY_MOD.bike).toBe(-10);
  });

  it("ремонт байка: −20 повреждённому, −40 сломанному, детали +40", () => {
    expect(BIKE_REPAIR.damaged.mod).toBe(-20);
    expect(BIKE_REPAIR.broken.mod).toBe(-40);
    expect(BIKE_REPAIR.broken.failScraps).toBe(true);
    expect(BIKE_REPAIR.partsBonus).toBe(40);
  });
});

describe("Черты скакуна", () => {
  it("находит Черту по любой половине двуязычного имени и берёт её рейтинг", () => {
    const t = mountTraits(beast({ items: [trait("Sidecar / Коляска (X)", 4), trait("Вездеход")] }));
    expect(t.sidecar).toBe(4);
    expect("allTerrain" in t).toBe(true);
  });

  it("Черты техники читаются тем же перебором, что и Черты существа", () => {
    const t = mountTraits(bike({ items: [trait("Ablative Plating / Аблативное Бронирование", 0, "vehicleTrait")] }));
    expect("ablativePlating" in t).toBe(true);
  });

  it("чужие предметы Чертами не считаются", () => {
    expect(mountTraits(beast({ items: [talent("Sidecar")] }))).toEqual({});
  });
});

describe("каким Навыком ведётся скакун", () => {
  it("живой скакун — Survival, и считается он от A, а не от P", () => {
    const info = mountControlSkill(beast());
    expect(info.key).toBe("survival");
    expect(info.char).toBe("ag");

    // Мутация «char: per» здесь провалила бы именно это сравнение: ранг тот же,
    // а значение уезжает на разницу характеристик.
    const val = skillValue(rider({ ag: 40, per: 30, survival: "trained" }), info);
    expect(val.value).toBe(50);
    expect(val.trained).toBe(true);
  });

  it("байк — Operate (Surface), джетбайк и всё летающее — Operate (Aeronautica)", () => {
    expect(mountControlSkill(bike()).specKey).toBe("surface");
    expect(mountControlSkill(bike({ chassis: "skimmer" })).specKey).toBe("aeronautica");
    expect(mountControlSkill(beast({ items: [trait("Flyer / Летун (X)", 2)] })).specKey).toBe("aeronautica");
    expect(mountControlSkill(beast({ items: [trait("Hoverer / Парящий (X)", 1)] })).specKey).toBe("aeronautica");
  });

  it("нетренированный Навык даёт −20 и делает верховые тесты комбинированными", () => {
    const control = riderControl(rider({ ag: 40 }), beast());
    expect(control.value).toBe(20);
    expect(control.combined).toBe(true);
    expect(bonusHalfAction(rider({ ag: 40 }), beast())).toBe(false);
  });

  it("владеющий Навыком получает бонусное верховое полудействие", () => {
    expect(bonusHalfAction(rider({ survival: "knows" }), beast())).toBe(true);
  });

  it("робоскакун ведётся через Tech-Use, если тот выше Survival", () => {
    const machine = beast({ items: [trait("Machine / Машина (X)", 3)] });
    const techie  = rider({ ag: 30, int: 50, survival: "untrained", techUse: "veteran" });
    const control = riderControl(techie, machine);
    expect(control.info.key).toBe("techUse");
    expect(control.value).toBe(70);
    expect(control.combined).toBe(false);
  });

  it("без Черты Machine замены Tech-Use нет, каким бы высоким он ни был", () => {
    const control = riderControl(rider({ ag: 30, int: 50, techUse: "veteran" }), beast());
    expect(control.info.key).toBe("survival");
  });

  it("Operate берётся из нужной специализации, а не из любой записи группы", () => {
    const r = rider({ ag: 35, operate: [op("voidship", "expert"), op("surface", "knows")] });
    expect(riderControl(r, bike()).value).toBe(35);
  });
});

describe("Легион (стр. 478)", () => {
  const legionBike = bike({ items: [trait("Legion / Легион")] });

  it("без Черты Легион штрафа нет, каким бы мелким ни был седок", () => {
    expect(legionPenalty(rider({ size: 0, sBonus: 3 }), {})).toBe(0);
  });

  it("подходящий седок (Размер ≥1 и S.b ≥8) — штрафа нет", () => {
    const r = rider({ size: 1, sBonus: 8 });
    expect(legionPenalty(r, mountTraits(legionBike))).toBe(0);
    expect(riderControl(r, legionBike).value).toBe(riderControl(rider({ ag: 40, size: 1, sBonus: 8 }), bike()).value);
  });

  it("Размер меньше 1 — штраф −20, даже если S.b хватает", () => {
    const r = rider({ size: 0, sBonus: 10 });
    expect(legionPenalty(r, mountTraits(legionBike))).toBe(-20);
  });

  it("S.b меньше 8 — штраф −20, даже если Размер хватает", () => {
    const r = rider({ size: 2, sBonus: 5 });
    expect(legionPenalty(r, mountTraits(legionBike))).toBe(-20);
  });

  it("штраф встроен в riderControl().value для всех верховых тестов", () => {
    const r = rider({ ag: 40, size: 0, sBonus: 3 });
    const control = riderControl(r, legionBike);
    expect(control.value).toBe(riderControl(r, bike()).value - 20);
    expect(control.legionPenalty).toBe(-20);
  });
});

describe("поправка теста", () => {
  it("пара {beast, bike} разбирается по типу скакуна, число — одинаково для обоих", () => {
    expect(testMod(STAY_MOD, beast())).toBe(0);
    expect(testMod(STAY_MOD, bike())).toBe(-10);
    expect(testMod(-10, beast())).toBe(-10);
    expect(testMod(null, bike())).toBe(0);
  });
});

describe("маневрирование", () => {
  it("Манёвренный даёт +20 на повороты и на Занос", () => {
    const m = beast({ items: [trait("Maneuverable / Манёвренный")] });
    expect(maneuverMods(rider(), m).mod).toBe(20);
    expect(skidInfo("run", rider(), m).mod).toBe(MOUNT_SKID.mod + 20);
  });

  it("пассажир за спиной даёт всаднику −10, а Оруженосец этот штраф снимает", () => {
    expect(maneuverMods(rider(), beast(), { passengers: 1 }).mod).toBe(-10);
    const squire = rider({ items: [talent("Squire / Оруженосец")] });
    expect(maneuverMods(squire, beast(), { passengers: 1 }).mod).toBe(0);
  });

  it("поправка маневрирования уже вложена в модификатор поворота", () => {
    const m = beast({ items: [trait("Манёвренный")] });
    const wide = turnOptions("full", rider(), m).options.find(o => o.angle === 270);
    expect(wide.baseMod).toBe(10);
    expect(wide.mod).toBe(30);
    expect(wide.needsTest).toBe(true);
  });

  it("бесплатный поворот теста не требует и остаётся углом отката при неудаче", () => {
    const opts = turnOptions("charge", rider(), beast());
    expect(opts.free).toBe(45);
    expect(opts.fallbackAngle).toBe(45);
    expect(opts.options.find(o => o.angle === 45).needsTest).toBe(false);
  });

  it("неподвижный скакун поворачивает за действия, а не за тест", () => {
    const opts = turnOptions("still", rider(), beast());
    expect(opts.options.map(o => o.action)).toEqual(["free", "half"]);
    expect(opts.options.every(o => !o.needsTest)).toBe(true);
  });

  it("Занос доступен только после Натиска и Бега", () => {
    expect(skidInfo("run", rider(), beast()).allowed).toBe(true);
    expect(skidInfo("charge", rider(), beast()).allowed).toBe(true);
    expect(skidInfo("full", rider(), beast()).allowed).toBe(false);
  });

  it("байк с Коляской Занос не совершает", () => {
    const side = bike({ items: [trait("Sidecar / Коляска (X)", 2, "vehicleTrait")] });
    const info = skidInfo("run", rider(), side);
    expect(info.allowed).toBe(false);
    expect(info.blockedBySidecar).toBe(true);
  });
});

describe("стрельба с седла", () => {
  it("штраф идёт по скорости в текущем Ходу", () => {
    expect(rangedPenalty("half")).toBe(-10);
    expect(rangedPenalty("full")).toBe(-20);
    expect(rangedPenalty("run")).toBe(-30);
  });

  it("интегрированное оружие и «Стабилизированный» штрафа не получают вовсе", () => {
    expect(rangedPenalty("run", { integral: true })).toBe(0);
    expect(rangedPenalty("run", { stabilized: true })).toBe(0);
  });

  it("турель в Коляске срезает штраф на 20, но в плюс не уводит", () => {
    expect(rangedPenalty("run", { sidecarTurret: true })).toBe(-10);
    expect(rangedPenalty("half", { sidecarTurret: true })).toBe(0);
  });

  it("пассажиру −10, а на Натиске и Беге −20; Оруженосец смягчает на 10", () => {
    expect(passengerActionMod("half")).toBe(-10);
    expect(passengerActionMod("charge")).toBe(-20);
    expect(passengerActionMod("run", rider({ items: [talent("Оруженосец")] }))).toBe(-10);
  });
});

describe("куда пришлось попадание", () => {
  it("дубль — это 11, 22 … 99, и только он", () => {
    expect([11, 44, 99].every(isDouble)).toBe(true);
    expect([10, 45, 100].some(isDouble)).toBe(false);
  });

  it("не-Избирательная атака бьёт скакуна, и лишь дубль достаётся всаднику", () => {
    expect(hitTarget(34, beast())).toBe("mount");
    expect(hitTarget(33, beast())).toBe("rider");
  });

  it("со Стойкой делят по чётности, а не по дублю", () => {
    const st = bike({ items: [trait("Stand / Стойка", 0, "vehicleTrait")] });
    expect(hitTarget(34, st)).toBe("rider");
    expect(hitTarget(33, st)).toBe("mount");
  });

  it("Всадник-Защитник забирает все попадания на себя", () => {
    const def = rider({ items: [talent("Defensive Rider / Всадник-Защитник")] });
    expect(hitTarget(34, beast(), { rider: def })).toBe("rider");
  });

  it("Избирательная атака по всаднику −10, а под «Укрытием» демона −30", () => {
    expect(selectiveMod("rider")).toBe(-10);
    expect(selectiveMod("rider", { covered: true })).toBe(-30);
    expect(selectiveMod("mount")).toBe(0);
  });
});

describe("выпадение из седла", () => {
  it("на спокойном ходу это 1d10 без расчёта высоты", () => {
    const fall = fallFromSaddle("half", beast({ spd: 8 }));
    expect(fall.height).toBe(0);
    expect(fall.formula).toBe("1d10");
    expect(fall.prone).toBe(true);
  });

  it("Натиск роняет с половины SPD, Бег — с полного", () => {
    expect(fallFromSaddle("charge", beast({ spd: 8 })).height).toBe(4);
    expect(fallFromSaddle("run", beast({ spd: 8 })).height).toBe(8);
  });

  it("полёт добавляет к расчётной высоте 2 м", () => {
    const flyer = beast({ spd: 8, items: [trait("Flyer / Летун (X)", 2)] });
    expect(fallFromSaddle("charge", flyer).height).toBe(6);
    expect(fallFromSaddle("still", flyer).height).toBe(2);
  });

  it("SPD байка берётся из ходовой части, а не из перемещения существа", () => {
    expect(mountSpd(bike({ spd: 10 }))).toBe(10);
    expect(mountSpd(beast({ spd: 6 }))).toBe(6);
  });

  it("тест Acrobatics на удержание тяжелеет с разгоном", () => {
    expect(acrobaticsStayMod("full")).toBe(0);
    expect(acrobaticsStayMod("charge")).toBe(-10);
    expect(acrobaticsStayMod("run")).toBe(-20);
  });
});

describe("руки, размер и очередь хода", () => {
  it("обычная езда занимает руку, связь MIU освобождает её", () => {
    expect(handsNeeded("half", beast()).hands).toBe(1);
    expect(handsNeeded("half", beast(), { linked: true }).hands).toBe(0);
  });

  it("Стойка освобождает руки всегда, Боевая Тренировка — кроме Натиска и Бега", () => {
    const st = beast({ items: [trait("Stand / Стойка")] });
    const wt = beast({ items: [trait("War-Trained / Боевая Тренировка")] });
    expect(handsNeeded("run", st).hands).toBe(0);
    expect(handsNeeded("full", wt).hands).toBe(0);
    expect(handsNeeded("charge", wt).hands).toBe(1);
  });

  it("седок должен быть хотя бы на 1 Размер меньше скакуна", () => {
    expect(sizeFits(rider({ size: 0 }), beast({ size: 1 }))).toBe(true);
    expect(sizeFits(rider({ size: 1 }), beast({ size: 1 }))).toBe(false);
  });

  it("по умолчанию ходят в инициативу всадника, «в ритм» — в наименьшую из двух", () => {
    const r = rider({ init: 5 });
    const m = beast({ init: 3 });
    expect(pairInitiative(r, m).value).toBe(5);
    expect(pairInitiative(r, m, { sync: true }).value).toBe(3);
    expect(pairInitiative(r, m, { sync: true }).mode).toBe("sync");
  });

  it("Чувство Скакуна и одержимость возвращают пару в инициативу всадника", () => {
    const sense = rider({ init: 5, items: [talent("Mount Sense / Чувство Скакуна")] });
    expect(pairInitiative(sense, beast({ init: 3 }), { sync: true }).value).toBe(5);
    expect(pairInitiative(rider({ init: 5 }), beast({ init: 3 }), { sync: true, possessed: true }).value).toBe(5);
  });

  it("всадники находятся перебором акторов, пассажиры считаются отдельно", () => {
    const m = beast();
    const one = rider({ mountUuid: m.uuid });
    const two = { ...rider({ mountUuid: m.uuid }), system: { ...rider({ mountUuid: m.uuid }).system,
      mount: { uuid: m.uuid, role: "passenger" } } };
    const idle = rider();
    expect(ridersOf(m, [one, two, idle])).toHaveLength(2);
    expect(passengerCount(m, [one, two, idle])).toBe(1);
  });
});

// Стрелок целится в ОДИН токен, а книга делит попадания между двумя телами:
// окно атаки должно находить пару по любой её половине (стр. 478).
describe("пара по цели прицела", () => {
  const pairWorld = () => {
    const m = beast({ size: 1 });
    const r = { ...rider({ size: 0, mountUuid: m.uuid }), uuid: "Actor.r1", name: "Всадник" };
    const p = { ...rider({ size: 0, mountUuid: m.uuid }), uuid: "Actor.p1", name: "Пассажир" };
    p.system = { ...p.system, mount: { uuid: m.uuid, role: "passenger" } };
    return { m, r, p, actors: [m, r, p] };
  };

  it("целясь во всадника, находит его скакуна", () => {
    const { m, r, actors } = pairWorld();
    const pair = mountPairFor(r, actors);
    expect(pair.mount).toBe(m);
    expect(pair.targetIs).toBe("rider");
  });

  it("целясь в скакуна, находит его всадника", () => {
    const { m, r, actors } = pairWorld();
    const pair = mountPairFor(m, actors);
    expect(pair.rider).toBe(r);
    expect(pair.targetIs).toBe("mount");
  });

  it("всадником считается тот, кто правит, а не седок за спиной", () => {
    const { m, r, p, actors } = pairWorld();
    // Пассажир идёт в списке первым — выбор не должен зависеть от порядка.
    expect(mountPairFor(m, [m, p, r]).rider).toBe(r);
    expect(mountPairFor(m, actors).rider).not.toBe(p);
  });

  it("у пешего цели пары нет", () => {
    expect(mountPairFor(rider(), [beast()])).toBe(null);
    expect(mountPairFor(null, [])).toBe(null);
  });
});

describe("урон и поломка", () => {
  it("Аблативное Бронирование режет урон до 1, пока запас полон", () => {
    const full = bike({ items: [trait("Ablative Plating", 0, "vehicleTrait")], structure: 6 });
    const hurt = bike({ items: [trait("Ablative Plating", 0, "vehicleTrait")], structure: 3 });
    expect(atFullHealth(full)).toBe(true);
    expect(ablativeDamage(9, full)).toBe(1);
    expect(ablativeDamage(9, hurt)).toBe(9);
    expect(ablativeDamage(0, full)).toBe(0);
  });

  it("без Черты урон не режется даже при полном запасе", () => {
    expect(ablativeDamage(9, bike({ structure: 6 }))).toBe(9);
  });

  it("байк сломан, когда Структура ушла ниже нуля; скакун не ломается вовсе", () => {
    expect(isBroken(bike({ structure: 0, critical: 3 }))).toBe(true);
    expect(isBroken(bike({ structure: 2 }))).toBe(false);
    expect(isBroken(beast())).toBe(false);
  });

  it("байк отличается от скакуна по типу актора", () => {
    expect(isBike(bike())).toBe(true);
    expect(isBike(beast())).toBe(false);
    expect(isAirborne(bike({ chassis: "skimmer" }))).toBe(true);
    expect(isAirborne(beast())).toBe(false);
  });
});
