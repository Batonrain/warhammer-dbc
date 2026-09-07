// test/combat/weapon-profiles.test.mjs
//
// wdbc-bs0q: удар стрелковым оружием в упор перестал быть отдельной кнопкой и
// стал обычным профилем оружия.
//
// Числа здесь — не выдумка теста, а перенос таблицы, которая до этого жила
// прибитой в module/apps/hud.mjs::gunMeleeStrike со ссылкой на стр. 40 корбука.
// Перенос обязан быть побайтово тем же: если таблица поедет, за столом молча
// поедет урон удара прикладом.

import { describe, it, expect } from "vitest";

import { weaponProfiles, improvisedMeleeProfile, canStrikeWithGun,
         isMeleeProfile, attackIsMelee, IMPROVISED_MELEE_LABEL }
  from "../../module/combat/weapon-profiles.mjs";
import { MELEE_CATEGORIES, MELEE_TRAINING_EXEMPT }
  from "../../module/constants/weapon-categories.mjs";

const gun = (weaponClass, over = {}) => ({
  name: "Ствол",
  system: { weaponClass, equipped: true, profiles: [], ...over },
  getFlag: () => null
});

/** Интегральная атака: та же форма, но опознаётся переданным предикатом. */
const integral = (weaponClass, flag = null) => ({
  name: "Кислотный Плевок",
  system: { weaponClass, equipped: true, profiles: [] },
  getFlag: (_ns, key) => (key === "allowGunMeleeStrike" ? flag : null)
});
const asIntegral = { isIntegralAttack: item => item.name === "Кислотный Плевок" };

describe("improvisedMeleeProfile: таблица книги перенесена без потерь (wdbc-bs0q)", () => {
  it("пистолет бьёт как Булава — 1d5−3, досягаемость 1 м", () => {
    const p = improvisedMeleeProfile(gun("pistol"));
    expect(p.damage).toBe("1d5-3");
    expect(p.range).toBe("1 м");
    expect(p.note).toContain("Булава");
  });

  it("винтовка бьёт как Посох — 1d10−3, 2–3 м", () => {
    const p = improvisedMeleeProfile(gun("basic"));
    expect(p.damage).toBe("1d10-3");
    expect(p.range).toBe("2–3 м");
    expect(p.note).toContain("Посох");
  });

  it("тяжёлое, пусковое и станковое — как Булава, 2d10−4+S.b, 2 м", () => {
    for (const cls of ["heavy", "launcher", "stationary"]) {
      const p = improvisedMeleeProfile(gun(cls));
      expect(p.damage, cls).toBe("2d10-4");
      expect(p.range, cls).toBe("2 м");
    }
  });

  it("класс, не названный в книге, бьёт как винтовка — прежнее умолчание", () => {
    expect(improvisedMeleeProfile(gun("thrown")).damage).toBe("1d10-3");
  });

  it("всегда ударное, без пробития, Imprecise + Primitive", () => {
    const p = improvisedMeleeProfile(gun("pistol"));
    expect(p.damageType).toBe("impact");
    expect(p.penetration).toBe(0);
    expect(p.weaponProps.map(x => x.key).sort()).toEqual(["imprecise", "primitive"]);
  });

  it("помечен как рукопашный — иначе бросался бы по BS, а не по WS", () => {
    expect(isMeleeProfile(improvisedMeleeProfile(gun("pistol")))).toBe(true);
  });
});

describe("canStrikeWithGun: кому профиль полагается", () => {
  it("рукопашному оружию — нет, у него и так рукопашный профиль", () => {
    expect(canStrikeWithGun(gun("melee"))).toBe(false);
    expect(improvisedMeleeProfile(gun("melee"))).toBeNull();
  });

  it("обычному стрелковому — да", () => {
    expect(canStrikeWithGun(gun("basic"))).toBe(true);
  });

  it("интегральной атаке — нет: у кислотного плевка нет приклада", () => {
    expect(canStrikeWithGun(integral("pistol"), asIntegral)).toBe(false);
  });

  it("интегральной с флагом allowGunMeleeStrike — да, точечное исключение", () => {
    expect(canStrikeWithGun(integral("pistol", true), asIntegral)).toBe(true);
  });
});

describe("weaponProfiles: авторские плюс выводимый", () => {
  it("у стрелкового без своих профилей появляется ровно один — удар в упор", () => {
    const list = weaponProfiles(gun("basic"));
    expect(list.length).toBe(1);
    expect(list[0].label).toBe(IMPROVISED_MELEE_LABEL);
  });

  it("АВТОРСКИЕ ПРОФИЛИ СОХРАНЯЮТ СВОИ ИНДЕКСЫ — по ним хранится выбор игрока", () => {
    // Вставь выводимый профиль в начало — и у каждого уже сохранённого
    // hudProfile/profileIdx молча съедет смысл на другое оружие.
    const authored = [{ label: "Подавительный", damage: "1d10" },
                      { label: "Снайперский", damage: "2d10" }];
    const list = weaponProfiles(gun("basic", { profiles: authored }));
    expect(list[0].label).toBe("Подавительный");
    expect(list[1].label).toBe("Снайперский");
    expect(list[2].label).toBe(IMPROVISED_MELEE_LABEL);
  });

  it("у рукопашного список — ровно его авторские профили, ничего не добавлено", () => {
    const authored = [{ label: "Посох", damage: "1d10-2" }];
    expect(weaponProfiles(gun("melee", { profiles: authored }))).toEqual(authored);
  });

  it("предмет без профилей и без права на удар в упор даёт пустой список", () => {
    expect(weaponProfiles(gun("melee"))).toEqual([]);
  });

  it("авторский профиль без поля melee рукопашным не считается — прежнее поведение", () => {
    expect(isMeleeProfile({ label: "Снайперский" })).toBe(false);
  });
});

// ── Требования владельца, проверенные явно (06.09.2026) ──────────────────
//
// Формулировка была: профиль удара прикладом нельзя удалить, он пропадает
// вместе с оружием, показывается только у НАДЕТОГО стрелкового и не лезет в
// Снаряжение. Первые три проверяются здесь, четвёртое — устройством: вкладка
// Снаряжения профили не рисует вовсе (в templates/actor/parts/tab-gear.hbs
// про них нет ни строки), а редактор профилей на листе предмета читает
// system.profiles напрямую.
describe("удар в упор: требования владельца", () => {
  it("НЕ показывается, пока оружие не надето", () => {
    const stowed = gun("basic", { equipped: false });
    expect(canStrikeWithGun(stowed)).toBe(false);
    expect(improvisedMeleeProfile(stowed)).toBeNull();
    expect(weaponProfiles(stowed)).toEqual([]);
  });

  it("снятие оружия убирает профиль, надевание возвращает — состояние не хранится", () => {
    const w = gun("basic");
    expect(weaponProfiles(w).length).toBe(1);
    w.system.equipped = false;
    expect(weaponProfiles(w).length).toBe(0);
    w.system.equipped = true;
    expect(weaponProfiles(w).length).toBe(1);
  });

  it("надетое оружие со СВОИМИ профилями: авторские видны всегда, удар в упор — только надетым", () => {
    const authored = [{ label: "Подавительный", damage: "1d10" }];
    const stowed = gun("basic", { equipped: false, profiles: authored });
    expect(weaponProfiles(stowed)).toEqual(authored);
  });

  it("профиль не хранится в предмете — удалять нечего и сохранять нечего", () => {
    // Строится заново на каждый вызов и в system.profiles не попадает: значит
    // у него нет строки в редакторе профилей, нет крестика, и вместе с
    // удалённым оружием он исчезает сам.
    const w = gun("pistol");
    const first = weaponProfiles(w);
    expect(w.system.profiles).toEqual([]);
    const second = weaponProfiles(w);
    expect(second).toEqual(first);
    expect(second[0]).not.toBe(first[0]);   // новый объект, а не общая ссылка
    expect(second[0].generated).toBe(true); // и он помечен как выводимый
  });
});

// ── attackIsMelee: одно решение на окно и на бросок (найдено живой проверкой)
//
// Живая проверка 06.09.2026 заметила, что в карточке «Ударить оружием» кнопки
// защиты несут data-melee="0", хотя тест шёл по WS. Копали — формула
// «weaponClass === melee || forceMelee» была выписана ДВАЖДЫ: в окне атаки и в
// исполнителе броска. Пока рукопашность зависела только от предмета, копии
// совпадали; с появлением рукопашного ПРОФИЛЯ у стрелкового они разошлись, и
// разошлись молча. Цена: S.b не прибавлялся к урону (flatBonus берёт его
// только у рукопашной) и кнопки защиты уезжали в стрелковую ветку, где
// Парирование требует Талант «Щит Клинков».
describe("attackIsMelee: окно и бросок обязаны решать одинаково", () => {
  const melee  = { weaponClass: "melee" };
  const ranged = { weaponClass: "basic" };
  const buttStrike = { label: IMPROVISED_MELEE_LABEL, melee: true };

  it("рукопашное оружие — рукопашная всегда", () => {
    expect(attackIsMelee(melee, {})).toBe(true);
  });

  it("стрелковое без профиля и без forceMelee — стрельба", () => {
    expect(attackIsMelee(ranged, {})).toBe(false);
  });

  it("СТРЕЛКОВОЕ С РУКОПАШНЫМ ПРОФИЛЕМ — рукопашная (ради этого всё и делалось)", () => {
    expect(attackIsMelee(ranged, { profile: buttStrike })).toBe(true);
  });

  it("forceMelee по-прежнему работает сам по себе — метательное как рукопашное", () => {
    expect(attackIsMelee({ weaponClass: "thrown" }, { forceMelee: true })).toBe(true);
  });

  it("обычный авторский профиль стрельбу рукопашной не делает", () => {
    expect(attackIsMelee(ranged, { profile: { label: "Подавительный" } })).toBe(false);
  });

  it("пустые входы не роняют расчёт", () => {
    expect(attackIsMelee(undefined, undefined)).toBe(false);
    expect(attackIsMelee({}, {})).toBe(false);
  });
});

// ── Бонус Силы в строку урона НЕ пишется (найдено живой проверкой) ────────
//
// Книга пишет ИТОГ («1d5-3+S.b»), а система записывает урон рукопашного БЕЗ
// бонуса Силы и прибавляет его сама (combat/attack.mjs::flatBonus). Первая
// версия профиля несла «+S.b» в строке — и Сила прибавлялась ДВАЖДЫ: при S.b=3
// выходило 1d10-3+3+3 вместо 1d10-3+3, то есть удар прикладом бил вдвое
// сильнее положенного по бонусу Силы.
describe("бонус Силы: в строке урона его быть не должно", () => {
  it("ни у одного класса оружия в строке нет S.b", () => {
    for (const cls of ["pistol", "basic", "heavy", "launcher", "stationary", "thrown"]) {
      const p = improvisedMeleeProfile(gun(cls));
      expect(p.damage, cls).not.toMatch(/S\.?b/i);
    }
  });

  it("строка урона — только кубик и плоская поправка, как у рукопашных паков", () => {
    // У меча в паке «1d10+2», у профиля «Посох» — «2d10+4»: ни у одного нет
    // «+S.b». Форма обязана совпадать, иначе движок посчитает иначе.
    expect(improvisedMeleeProfile(gun("basic")).damage).toMatch(/^\d+d\d+[+-]\d+$/);
  });
});

// ── Категория рукопашного у выводимого профиля (решение владельца, вариант «а»)
//
// Вопрос владельца был прямой: «какая тренировка нужна для удара прикладом?»
// Ответ до этой правки — никакая, и НЕ ПО ЗАМЫСЛУ: категория выводилась из
// метки профиля, метка «Ударить оружием» в списке категорий не значится, пустая
// категория трактуется как «владеет». То есть Тренировка молча не спрашивалась.
//
// Теперь категория — та, которой книга велит бить: «как Булава», «как Посох».
// Она отдельным полем, а не меткой: метку игрок видит в списке профилей, и там
// должно стоять «Ударить оружием».
//
// Что это меняет за столом: Melee Training по книге открывает АЛЬТЕРНАТИВНЫЕ
// приёмы и хваты, а не саму атаку — нетренированный ударит прикладом всегда,
// просто Обычной Атакой, Стандартной Стойкой и Базовым Хватом. Булава вдобавок
// освобождена от Таланта прямой цитатой книги, поэтому разница видна только у
// приклада ВИНТОВКИ, который бьёт как Посох.
describe("удар в упор: категория рукопашного (wdbc-bs0q)", () => {
  it("винтовка бьёт как Посох — категория, требующая Тренировки", () => {
    const p = improvisedMeleeProfile(gun("basic"));
    expect(p.meleeCategory).toBe("Посох");
    expect(MELEE_CATEGORIES).toContain(p.meleeCategory);
    expect(MELEE_TRAINING_EXEMPT).not.toContain(p.meleeCategory);
  });

  it("пистолет и тяжёлое бьют как Булава — она освобождена книгой от Таланта", () => {
    for (const cls of ["pistol", "heavy", "launcher", "stationary"]) {
      const p = improvisedMeleeProfile(gun(cls));
      expect(p.meleeCategory, cls).toBe("Булава");
      expect(MELEE_TRAINING_EXEMPT, cls).toContain(p.meleeCategory);
    }
  });

  it("категория — НАСТОЯЩАЯ из списка, а не выдуманная: иначе гейт молча отключится", () => {
    // Категория, которой нет в MELEE_CATEGORIES, схлопывается в пустую, а
    // пустая означает «владеет». Ровно так дефект и возник.
    for (const cls of ["pistol", "basic", "heavy", "launcher", "stationary", "thrown"]) {
      expect(MELEE_CATEGORIES, cls).toContain(improvisedMeleeProfile(gun(cls)).meleeCategory);
    }
  });

  it("метка остаётся «Ударить оружием» — её читает игрок, а не движок", () => {
    expect(improvisedMeleeProfile(gun("basic")).label).toBe(IMPROVISED_MELEE_LABEL);
  });
});
