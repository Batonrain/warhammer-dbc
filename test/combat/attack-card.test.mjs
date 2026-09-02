// test/combat/attack-card.test.mjs
//
// Фаза 7 конвейера: сборка карточки чата. Модуль ничего не считает и не знает
// про Foundry — на вход приходят уже посчитанные числа, на выход идёт HTML.
// Поэтому проверяется он напрямую, без заглушки и без броска кубов.
//
// Числа карточки как таковые проверяет test/combat/attack-parity.test.mjs
// (сквозной прогон настоящей атаки); здесь — что из этих чисел собирается.

import { describe, it, expect } from "vitest";
import { attackCard, jamCard } from "../../module/combat/attack-card.mjs";

/** Минимальная карточка: попадание болтера в торс. */
const base = {
  actorName: "Стрелок", weaponName: "Болтер", wp: {},
  threshold: 45, rv: 23, modeLine: "Одиночный", hit: true, deg: 3,
  hitsCount: 1, hits: [{ total: 11, loc: "Торс" }],
  hitLocLabel: "Торс", locRoll: 32, dtLabel: "Взрывной", pen: 4
};

const card = extra => attackCard({ ...base, ...extra });

describe("карточка атаки", () => {
  it("шапка, порог, бросок и исход", () => {
    const html = card();
    expect(html).toContain("Болтер");
    expect(html).toContain("<b>45</b>");
    expect(html).toContain("<b>23</b>");
    expect(html).toContain("Попадание — 3 степени");
    expect(html).toContain("Место попадания: <b>Торс</b> (32)");
  });

  it("промах не печатает ни места попадания, ни защиты, ни урона", () => {
    const html = card({ hit: false, deg: 2, hits: [], hitsCount: 0 });
    expect(html).toContain("Промах — 2 степени");
    expect(html).not.toContain("Место попадания");
    expect(html).not.toContain("Защита цели");
    expect(html).not.toContain("Применить урон");
  });

  it("строка попадания печатает добавочные кубы, выгорание и штраф мульти-удара", () => {
    const html = card({
      hitsCount: 2,
      hits: [
        { total: 15, loc: "Торс", bonusNote: 4 },
        { total: 9, loc: "Голова", deflagrateNote: 6, msPenalty: 3 }
      ]
    });
    expect(html).toContain("(2 попадания)");
    expect(html).toContain("+4 доп.");
    expect(html).toContain("+6 выгор.");
    expect(html).toContain("−3 мульти-удар");
  });

  it("Экстремальный урон печатает d5 и эффект таблицы", () => {
    const html = card({
      hits: [{ total: 20, loc: "Голова", hasExtreme: true, extremeLevel: 3, critEffect: "Оглушён" }]
    });
    expect(html).toContain("Экстремальный урон");
    expect(html).toContain("d5: 3");
    expect(html).toContain("Оглушён");
  });

  it("бонус Силы подписывается только в рукопашной и помечает Могучее и хват", () => {
    expect(card({ isMelee: true, sbEff: 8, wp: { mightySB: true } }))
      .toContain("S.b +8 (Могучее ×2)");
    expect(card({ isMelee: true, sbEff: 2, sbHalf: true })).toContain("S.b +2 (½ хват)");
    expect(card({ isMelee: false, sbEff: 4 })).not.toContain("S.b");
  });

  it("кнопка урона несёт число, место и свойства оружия", () => {
    const html = card({ pen: 6, dtLabel: "Взрывной", damageType: "explosive",
      wp: { fellingRating: 2, primitive: true } });
    expect(html).toContain('data-damage="11"');
    expect(html).toContain('data-penetration="6"');
    expect(html).toContain('data-damage-type="explosive"');
    expect(html).toContain('data-hit-location="Торс"');
    expect(html).toContain('data-felling="2"');
    expect(html).toContain('data-primitive="1"');
    expect(html).toContain("Применить урон 1: <b>11</b> → Торс");
  });

  it("кнопка урона несёт Corrosive/Crippling/Piercing/Haywire (wdbc-plsf)", () => {
    const html = card({
      wp: { corrosiveRating: 3, cripplingRating: 2, piercing: true, haywire: true, haywireRating: 4 }
    });
    expect(html).toContain('data-corrosive="3"');
    expect(html).toContain('data-crippling="2"');
    expect(html).toContain('data-piercing="1"');
    expect(html).toContain('data-haywire="4"');
  });

  it("Haywire(0) — валидный рейтинг («привязан к цели»), не путается с «свойства нет»", () => {
    const html = card({ wp: { haywire: true, haywireRating: 0 } });
    expect(html).toContain('data-haywire="0"');
  });

  it("без этих свойств атрибуты явно нулевые/пустые", () => {
    const html = card();
    expect(html).toContain('data-corrosive="0"');
    expect(html).toContain('data-crippling="0"');
    expect(html).toContain('data-piercing="0"');
    expect(html).toContain('data-haywire=""'); // отсутствие свойства ≠ Haywire(0)
  });

  it("Гибкое оружие запрещает Парирование, но не Уклонение", () => {
    const html = card({ wp: { flexible: true } });
    expect(html).toContain("Парирование (невозможно — Гибкое)");
    expect(html).toContain('class="wh-dodge-btn"');
  });

  it("приём с запретом Уклонения гасит кнопку", () => {
    const html = card({ defense: { dodgeMod: -999, parryMod: -10, note: "Обманный манёвр" } });
    expect(html).toContain("Уклонение (невозможно)");
    expect(html).toContain("Парирование (-10)");
    expect(html).toContain("Обманный манёвр");
  });

  it("кнопка Уклонения несёт data-melee — Отскок (wdbc-9wvm) только от стрелковой", () => {
    expect(card({ isMelee: false })).toContain('data-melee="0"');
    expect(card({ isMelee: true })).toContain('data-melee="1"');
  });

  it("Взрывное/Распыление стрелковой атаки — напоминание про обязательный Отскок при полном накрытии Базы", () => {
    expect(card({ isMelee: false, wp: { blastRating: 3 } })).toContain("Уклонение допустимо только Отскоком");
    expect(card({ isMelee: false, wp: { spray: true } })).toContain("Уклонение допустимо только Отскоком");
  });

  it("напоминания про Отскок нет в рукопашной, без Взрывного/Распыления и когда Уклонение уже недоступно", () => {
    expect(card({ isMelee: true, wp: { blastRating: 3 } })).not.toContain("Уклонение допустимо только Отскоком");
    expect(card({ isMelee: false, wp: {} })).not.toContain("Уклонение допустимо только Отскоком");
    expect(card({ isMelee: false, wp: { blastRating: 3 }, defense: { dodgeMod: -999 } }))
      .not.toContain("Уклонение допустимо только Отскоком");
  });

  it("по технике предлагается Вираж", () => {
    expect(card({ defense: { targetIsVehicle: true } })).toContain("Вираж");
    expect(card()).not.toContain("Вираж");
  });

  it("сдвиг места попадания даёт кнопки ±A.b и гасит текущую", () => {
    const html = card({ locShift: { max: 2, current: -1 } });
    expect(html).toContain("Сдвинуть место попадания (±2, A.b) — только Стрелок");
    expect(html).toContain('data-shift="-2"');
    expect(html).toContain('data-shift="-1" disabled');
    expect(html).toContain('data-shift="2"');
  });

  // Верхом попадание делится между двумя телами, а на сцене у пары обычно один
  // токен: без строки в карточке урон, назначенный всаднику, ушёл бы скакуну
  // просто потому, что кликнули по видимому токену (стр. 478).
  it("печатает, кого выцелили в паре «всадник + скакун»", () => {
    const html = card({ notes: { mount: "Верхом: попадание во ВСАДНИКА — Кетар" } });
    expect(html).toContain("Верхом: попадание во ВСАДНИКА — Кетар");
    expect(card()).not.toContain("Верхом:");
  });

  it("блок боеприпасов печатается только для стрелкового", () => {
    const html = card({ ammo: { name: "Кракен", mods: "Пробитие +3", magCur: 23, magMax: 24, spent: 1 } });
    expect(html).toContain("Кракен");
    expect(html).toContain("<b>23/24</b>");
    expect(html).toContain("(израсходовано: 1)");
    expect(card({ isMelee: true })).not.toContain("Магазин");
  });

  it("Подавление печатает число попаданий и штраф теста", () => {
    expect(card({ suppression: { pen: "−20", hits: 2, cap: 4 } }))
      .toContain("ГМ распределяет <b>2</b> попадания в торс");
  });

  it("Порча печатает только доступные при текущей Cor эффекты", () => {
    const html = card({ corVal: 30, corEffects: [
      { cor: 10, text: "Пьёт кровь" }, { cor: 60, text: "Говорит" }
    ] });
    expect(html).toContain("Порча 10+: Пьёт кровь");
    expect(html).not.toContain("Говорит");
  });

  it("готовые блоки вставляются как есть", () => {
    const html = card({ blocks: {
      props: "<div>СВОЙСТВА</div>", quality: "<div>КАЧЕСТВО</div>",
      splinter: "<div>ОСКОЛОК</div>", targetEffects: "<div>ЭФФЕКТЫ</div>",
      dice: "<div>КУБЫ</div>"
    } });
    for (const block of ["СВОЙСТВА", "КАЧЕСТВО", "ОСКОЛОК", "ЭФФЕКТЫ", "КУБЫ"]) {
      expect(html).toContain(block);
    }
    expect(html).toContain("Показать кубы");          // обёртка «коробочек» — на карточке
    expect(card()).not.toContain("Показать кубы");    // кубов нет — нет и пустой обёртки
  });

  it("Выжигание Души предлагается только с id атакующего", () => {
    expect(card({ soulBurnActorId: "actor-1" })).toContain('data-attacker-id="actor-1"');
    expect(card()).not.toContain("wh-soulburn-btn");
  });

  // ── Взрывное ────────────────────────────────────────────────────────────
  it("Взрывное: одно попадание подписывается «Взрыв», а не «Попадание»", () => {
    const html = card({ wp: { blastRating: 3 } });
    expect(html).toContain("Взрыв 1");
    expect(html).not.toContain("Попадание 1<");
  });

  it("Взрывное: несколько шаблонов очереди — отдельная заметка про Уклонение", () => {
    const html = card({
      wp: { blastRating: 3 }, hitsCount: 2,
      hits: [{ total: 10, loc: "Торс" }, { total: 8, loc: "Торс" }]
    });
    expect(html).toContain("Взрыв 1");
    expect(html).toContain("Взрыв 2");
    expect(html).toContain("отдельный шаблон, размещается до Уклонения");
  });

  it("Взрывное: одно попадание не печатает заметку про несколько шаблонов", () => {
    expect(card({ wp: { blastRating: 3 } })).not.toContain("отдельный шаблон");
  });

  it("Взрывное: кнопка урона подсказывает отметить всех в радиусе", () => {
    expect(card({ wp: { blastRating: 5 } })).toContain("отметьте всех в радиусе 5м");
    expect(card()).not.toContain("отметьте всех в радиусе");
  });

  it("Взрывное «под цель»: промах печатает смещение по розе", () => {
    const html = card({
      hit: false, deg: 2, hits: [], hitsCount: 0,
      notes: { blastScatter: { distance: 6, radius: 3, dir: { n: 3, label: "Вправо", icon: "➡️" } } }
    });
    expect(html).toContain("Взрыв мимо цели");
    expect(html).toContain("<b>6м</b>");
    expect(html).toContain("Вправо");
    expect(html).toContain("направление 3/8");
    expect(html).toContain("Радиус взрыва <b>3м</b>");
  });

  it("без смещения заметка о промахе взрыва не печатается", () => {
    expect(card({ hit: false, deg: 2, hits: [], hitsCount: 0 })).not.toContain("Взрыв мимо цели");
  });
});

describe("карточка заклинившего оружия", () => {
  it("печатает бросок и требование устранить Клин", () => {
    const html = jamCard({ weaponName: "Лазган", rv: 96, blocks: { props: "<div>СВОЙСТВА</div>" } });
    expect(html).toContain("Лазган");
    expect(html).toContain("<b>96</b>");
    expect(html).toContain("Оружие заклинило!");
    expect(html).toContain("СВОЙСТВА");
  });
});
