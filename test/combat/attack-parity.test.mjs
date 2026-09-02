// test/combat/attack-parity.test.mjs
//
// Сеть безопасности под разбор _executeAttackRoll на фазы конвейера (шаг 5.2).
// Тесты фиксируют ЧИСЛА, которые атака даёт сейчас: сколько попаданий, сколько
// урона, какое Пробитие, сколько патронов ушло. Разбор функции на фазы не должен
// сдвинуть ни одно из них.
//
// Сценарии — те же восемь, что перечислены в плане для шага 5.2: рукопашная,
// стрельба, очередь, выключенное оружие, профиль оружия, боеприпас со
// свойствами, щит, прицеливание.
//
// Числа читаются из карточки чата, потому что сейчас атака только её и
// возвращает. Это временно: по мере выноса расчётов в чистые функции те же
// значения проверяются напрямую, а карточка остаётся сквозной проверкой.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, ammoFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

/** Последняя карточка в чате. */
const card = () => captured.chat.at(-1)?.content ?? "";

/** Строки «Попадание N | урон | место» из блока урона карточки. */
function hits() {
  return [...card().matchAll(
    /<span class="roll-hit-idx">Попадание (\d+)<\/span>\s*<span class="roll-hit-dmg">(\d+)<\/span>\s*<span class="roll-hit-loc">([^<]+)<\/span>/g
  )].map(m => ({ index: Number(m[1]), damage: Number(m[2]), location: m[3] }));
}

/** Пробитие из строки «тип · Пробитие N». */
function penetration() {
  const m = card().match(/Пробитие (-?\d+)/);
  return m ? Number(m[1]) : null;
}

/** Значение data-атрибута первой кнопки «Применить урон». */
function applyAttr(name) {
  const m = card().match(new RegExp(`data-${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/** Формула урона, ушедшая в Roll: первая после броска попадания. */
const damageFormula = () => captured.rolls[1];

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

// ── Стрельба ────────────────────────────────────────────────────────────────

describe("стрельба", () => {
  it("одиночный выстрел: одно попадание, урон оружия, Пробитие оружия", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 6];   // d100 атаки, d10 урона

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Попадание — 3");     // (45−23)/10 + 1
    expect(hits()).toEqual([{ index: 1, damage: 11, location: "Торс" }]);
    expect(penetration()).toBe(4);
    expect(weapon.system.magazineCur).toBe(23);    // одиночный тратит 1 патрон
  });

  it("промах: ни урона, ни расхода сверх выстрела", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [77];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Промах — 4");        // (77−45)/10 + 1
    expect(hits()).toEqual([]);
    expect(weapon.system.magazineCur).toBe(23);
  });

  it("Рука Смерти (wdbc-hftn): слитое оружие не тратит патроны — метаболизм вместо магазина", async () => {
    const weapon = weaponFor({}, { flags: { "warhammer-dbc.handOfDeathSource": "mut1" } });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(hits()).toEqual([{ index: 1, damage: 11, location: "Торс" }]);
    expect(weapon.system.magazineCur).toBe(24);    // не тронут
  });

  it("короткая очередь: попадание за каждый нечётный Успех, но не больше RoF", async () => {
    // deg 5 → ceil(5/2) = 3 попадания, потолок rof_semi = 2.
    const weapon = weaponFor({ rof_semi: 2 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [5, 4, 9];   // атака, урон первого, урон второго

    await _executeAttackRoll(actor, weapon, "bs", 45, "semi", null, {});

    expect(hits()).toEqual([
      { index: 1, damage: 9,  location: "Торс" },   // 05 → реверс 50 → Торс
      { index: 2, damage: 14, location: "Торс" }
    ]);
    expect(weapon.system.magazineCur).toBe(22);   // очередь тратит 2 патрона
  });

  it("заклинивание: ненадёжное оружие на высоком броске не доходит до урона и пишет реальное состояние (wdbc-vwfk)", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "unreliable", rating: 0, rating2: 0 }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [95];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Оружие заклинило!");
    expect(hits()).toEqual([]);
    // wdbc-vwfk: раньше заклинивание было только строкой в чате — теперь
    // реальное состояние предмета (снимается weapon-properties.mjs::clearWeaponJam).
    expect(weapon.system.jammed).toBe(true);
  });

  it("успешный выстрел ненадёжного оружия ниже порога заклинивания не ставит jammed", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "unreliable", rating: 0, rating2: 0 }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(weapon.system.jammed).toBe(false);
  });

  it("подавление: попаданий не бросает, а подсказывает их число ГМ-у", async () => {
    const weapon = weaponFor({ rof_full: 6 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "suppression", null, {});

    expect(card()).toContain("тест Подавление");
    expect(hits()).toEqual([]);
  });
});

// ── Рукопашная ──────────────────────────────────────────────────────────────

describe("рукопашная", () => {
  /** Цепной меч: 1d10+2 R, Пробитие 2, Рвущее. */
  const chainsword = (system = {}) => weaponFor({
    weaponClass: "melee", weaponType: "chain", damage: "1d10+2", damageType: "R",
    penetration: 2, weaponProps: [{ key: "tearing", rating: 0, rating2: 0 }], ...system
  }, { name: "Цепной меч" });

  it("бонус Силы входит в урон, Рвущее добавляет куб и оставляет лучший", async () => {
    const weapon = chainsword();
    const actor  = actorFor({ items: [weapon] });     // S 40 → S.b 4
    captured.dice = [15, 7, 3];                        // атака, два куба Рвущего

    await _executeAttackRoll(actor, weapon, "ws", 55, "melee", null, {});

    expect(damageFormula()).toBe("2d10kh1+2 + 4");
    expect(hits()).toEqual([{ index: 1, damage: 13, location: "Торс" }]);  // 7 + 2 + 4
    expect(card()).toContain("S.b +4");
  });

  it("выключенное цепное: −2 урона, −1 Пробитие, Рвущее снято", async () => {
    const weapon = chainsword();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [15, 7];                           // Рвущего больше нет — один куб

    await _executeAttackRoll(actor, weapon, "ws", 55, "melee", null, { weaponOff: true });

    expect(damageFormula()).toBe("1d10+2 + 2");        // S.b 4 − 2 за выключение
    expect(hits()).toEqual([{ index: 1, damage: 11, location: "Торс" }]);
    expect(penetration()).toBe(1);                     // 2 − 1
    expect(card()).toContain("Оружие выключено");
  });

  it("Могучее удваивает бонус Силы", async () => {
    const weapon = chainsword({ weaponProps: [{ key: "mighty", rating: 0, rating2: 0 }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [15, 5];

    await _executeAttackRoll(actor, weapon, "ws", 55, "melee", null, {});

    expect(damageFormula()).toBe("1d10+2 + 8");        // S.b 4 × 2
    expect(card()).toContain("Могучее ×2");
  });

  it("Обратный хват половинит бонус Силы", async () => {
    const weapon = chainsword({ weaponProps: [] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [15, 5];

    await _executeAttackRoll(actor, weapon, "ws", 55, "melee", null, { gripKey: "Об", gripSbHalf: true });

    expect(damageFormula()).toBe("1d10+2 + 2");        // S.b 4 → ½
    expect(card()).toContain("S.b +2 (½ хват)");
  });
});

// ── Профиль, боеприпас, прицел, щит ─────────────────────────────────────────

describe("профиль оружия", () => {
  it("выбранный профиль переопределяет урон, тип и Пробитие", async () => {
    const weapon = weaponFor({ damage: "1d10+5", penetration: 4 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 8];
    const profile = { label: "Крюк", damage: "1d10+9", damageType: "R", penetration: 7 };

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { profile });

    expect(damageFormula()).toBe("1d10+9");
    expect(hits()).toEqual([{ index: 1, damage: 17, location: "Торс" }]);
    expect(penetration()).toBe(7);
  });
});

describe("боеприпас", () => {
  it("модификаторы и свойства заряженного боеприпаса входят в урон и Пробитие", async () => {
    const ammo   = ammoFor({
      damageMod: 2, penetrationMod: 3,
      properties: [{ key: "tearing", rating: 0, rating2: 0 }]
    }, { name: "Кракен" });
    const weapon = weaponFor({ loadedAmmoId: ammo.id });
    const actor  = actorFor({ items: [weapon, ammo] });
    captured.dice = [23, 6, 9];                        // атака, два куба Рвущего от боеприпаса

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(damageFormula()).toBe("2d10kh1+5 + 2");
    expect(hits()).toEqual([{ index: 1, damage: 16, location: "Торс" }]);  // 9 + 5 + 2
    expect(penetration()).toBe(7);                     // 4 + 3
    expect(card()).toContain("Кракен");
  });

  it("условный эффект боеприпаса, отмеченный игроком, добавляет урон", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {
      ammoCondDmg: 3, ammoCondLabels: ["против одушевлённых"]
    });

    expect(damageFormula()).toBe("1d10+5 + 3");
    expect(hits()).toEqual([{ index: 1, damage: 14, location: "Торс" }]);
    expect(card()).toContain("против одушевлённых");
  });

  it("ручной бонус урона из диалога атаки (atk-dmg-bonus) прибавляется к итоговому урону", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { dmgBonus: 5 });

    expect(damageFormula()).toBe("1d10+5 + 5");
    expect(hits()).toEqual([{ index: 1, damage: 16, location: "Торс" }]);
  });
});

describe("прицеливание", () => {
  it("Избирательная атака кладёт попадание в выбранное место, минуя таблицу", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 6];                           // 23 → реверс 32 → по таблице Торс

    await _executeAttackRoll(actor, weapon, "bs", 45, "single",
      { value: "head", label: "Голова (−20)" }, {});

    expect(hits()).toEqual([{ index: 1, damage: 11, location: "Голова" }]);
    expect(card()).toContain("Прицел:");
  });
});

describe("Импульсное (aeldari.json): 4-й натуральный выстрел очереди — в Сочленение/Шею", () => {
  it("длинная очередь, 4 попадания — 4-е (не 1–3) идёт в Сочленение / Шея", async () => {
    // deg 7 → ceil(7/2)=4, потолок rof_full=4 → 4 попадания без Storm/Twin-linked.
    const weapon = weaponFor({ rof_full: 4, weaponProps: [{ key: "impulse", rating: 0, rating2: 0 }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [15, 3, 3, 3, 3];   // атака (deg 7), 4×урон

    await _executeAttackRoll(actor, weapon, "bs", 75, "full", null, {});

    expect(hits().map(h => h.location)).toEqual(["Торс", "Торс", "Торс", "Сочленение / Шея"]);
  });

  it("без Импульсного — та же очередь без подмены локации", async () => {
    const weapon = weaponFor({ rof_full: 4, weaponProps: [] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [15, 3, 3, 3, 3];

    await _executeAttackRoll(actor, weapon, "bs", 75, "full", null, {});

    expect(hits().map(h => h.location)).toEqual(["Торс", "Торс", "Торс", "Торс"]);
  });

  it("Шторм поверх Импульсного — порядок «натуральных» среди умноженных попаданий книгой не описан, подмена не включается", async () => {
    // deg 3 → ceil(3/2)=2, потолок rof_full=2 → 2 «естественных», Шторм(2) удваивает до 4.
    const weapon = weaponFor({
      rof_full: 2,
      weaponProps: [{ key: "impulse", rating: 0, rating2: 0 }, { key: "storm", rating: 2, rating2: 0 }]
    });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [50, 3, 3, 3, 3];   // атака (deg 3), 4×урон (2 естественных ×2 Шторма)

    await _executeAttackRoll(actor, weapon, "bs", 75, "full", null, {});

    expect(hits().length).toBe(4);
    expect(hits().map(h => h.location)).not.toContain("Сочленение / Шея");
  });

  it("цель — Техника: подмена не применяется (у машины нет Сочленений)", async () => {
    const weapon = weaponFor({ rof_full: 4, weaponProps: [{ key: "impulse", rating: 0, rating2: 0 }] });
    const actor  = actorFor({ items: [weapon] });
    setTargets([{ type: "vehicle" }]);
    captured.dice = [15, 3, 3, 3, 3];

    await _executeAttackRoll(actor, weapon, "bs", 75, "full", null, {});

    expect(hits().map(h => h.location)).not.toContain("Сочленение / Шея");
  });
});

describe("Fanning / Быстрый Курок (wdbc-fy33): opts.rofCapOverride в режиме full", () => {
  // threshold 90, rv 1 → deg = floor((90-1)/10)+1 = 9 → ceil(9/2) = 5 попаданий
  // «по броску» — с rof_full=4 без override капнулось бы на 4-х.
  it("поднимает потолок попаданий выше собственного rof_full предмета", async () => {
    const weapon = weaponFor({ rof_full: 4, magazineCur: 20 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [1, 3, 3, 3, 3, 3];   // атака (deg 9), 5×урон

    await _executeAttackRoll(actor, weapon, "bs", 90, "full", null, { rofCapOverride: 8 });

    expect(hits().length).toBe(5);
  });

  it("без override — обычный потолок rof_full предмета", async () => {
    const weapon = weaponFor({ rof_full: 4, magazineCur: 20 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [1, 3, 3, 3, 3];

    await _executeAttackRoll(actor, weapon, "bs", 90, "full", null, {});

    expect(hits().length).toBe(4);
  });

  it("расход патронов идёт по override, не по фиксированному rof_full", async () => {
    const weapon = weaponFor({ rof_full: 4, magazineCur: 20 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [1, 3, 3, 3, 3, 3];

    await _executeAttackRoll(actor, weapon, "bs", 90, "full", null, { rofCapOverride: 8 });

    expect(weapon.system.magazineCur).toBe(12);   // 20 − 8
  });

  // threshold 55, rv 30 → deg = floor((55-30)/10)+1 = 3 → ceil(3/2) = 2,
  // совпадает с rof_semi=2 — override для "semi" не действует вовсе.
  it("override игнорируется вне режима full (напр. semi)", async () => {
    const weapon = weaponFor({ rof_semi: 2, rof_full: 4, magazineCur: 20 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [30, 3, 3];

    await _executeAttackRoll(actor, weapon, "bs", 55, "semi", null, { rofCapOverride: 8 });

    expect(hits().length).toBe(2);
    expect(weapon.system.magazineCur).toBe(18);   // 20 − 2, не −8
  });
});

describe("щит", () => {
  it("Омывание — игнор щита — уходит в кнопку применения урона", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "flush", rating: 0, rating2: 0 }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(applyAttr("ignore-shield")).toBe("1");
    expect(applyAttr("penetration")).toBe("4");
    expect(applyAttr("damage")).toBe("11");
  });

  it("обычное оружие щит не игнорирует", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(applyAttr("ignore-shield")).toBe("0");
  });
});

describe("Взрывное «под цель»", () => {
  it("промах с прицелом «под цель» бросает розу смещения (d10 + d8)", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "blast", rating: 3 }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [77, 6, 3];   // d100 атаки (промах), d10 дистанции, d8 направления

    await _executeAttackRoll(actor, weapon, "bs", 45, "single",
      { value: "underfoot", label: "Под цель (Взрывное, −20)" }, {});

    expect(card()).toContain("Промах");
    expect(card()).toContain("Взрыв мимо цели");
    expect(card()).toContain("<b>6м</b>");
    expect(card()).toContain("Вправо");
    expect(hits()).toEqual([]);   // промах — урона по-прежнему нет
  });

  it("обычный промах (без «под цель») розу не бросает", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "blast", rating: 3 }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [77];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("Взрыв мимо цели");
  });

  it("попадание Взрывного не бросает розу", async () => {
    const weapon = weaponFor({ weaponProps: [{ key: "blast", rating: 3 }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [23, 6];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single",
      { value: "underfoot", label: "Под цель (Взрывное, −20)" }, {});

    expect(card()).toContain("Попадание");
    expect(card()).not.toContain("Взрыв мимо цели");
  });
});
