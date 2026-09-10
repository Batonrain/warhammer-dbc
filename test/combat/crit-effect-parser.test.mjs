// test/combat/crit-effect-parser.test.mjs
//
// wdbc-xql6: крит-таблицы (критическая строка находится сама, но раньше в чат
// уходил только текст — «Оглушена на 1d10 Раундов, 1d5 Усталости,
// Кровотечение», игрок раскидывал руками). parseCritEffectPills распознаёт
// типовые обороты книги и превращает их в кликабельные пилюли CONDITIONS_DEF;
// applyCritEffectPill — сам клик (кубик длительности + actor.update).
//
// Строки ниже — не выдуманные, а реальные строки critical-tables.mjs
// (указаны таблица/локация/уровень), чтобы тест проверял разбор настоящих
// формулировок книги, а не удобных для регэкспа искусственных примеров.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  parseCritEffectPills, applyCritEffectPill, critPillsHtml,
  textAssertsDeath, deathButtonHtml
} from "../../module/combat/crit-effect-parser.mjs";
import { CRITICAL_TABLES } from "../../critical-tables.mjs";
import { SHOCK_TABLE } from "../../module/constants/fear-tables.mjs";

function makeActor(overrides = {}) {
  const actor = {
    id: "actor-stub", uuid: "Actor.stub", name: "Подставной", isOwner: true,
    system: { fatigue: { value: 0 }, conditions: {}, characteristics: {}, ...overrides }
  };
  actor.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      const parts = path.split(".");
      let target = actor;
      for (const part of parts.slice(0, -1)) target = (target[part] ??= {});
      target[parts.at(-1)] = value;
    }
    return data;
  };
  return actor;
}

beforeEach(resetCaptured);

describe("parseCritEffectPills — реальные строки крит-таблиц", () => {
  // impact.head[3]
  it("«Оглушена на 1 Раунд» после Ослепления в той же строке — обе пилюли", () => {
    const text = "От удара у цели открывается сильнейшее носовое кровотечение, боль Ослепляет её на 1 Раунд. Цель должна пройти тест на T+0, или Оглушена на 1 Раунд.";
    const pills = parseCritEffectPills(text);
    expect(pills).toEqual(expect.arrayContaining([
      { key: "blinded", formula: "1" },
      { key: "stunned", formula: "1" }
    ]));
  });

  // impact.head[7]
  it("«Оглушена на 1d10 Раундов» — кубик, не фиксированное число", () => {
    const text = "Удар врезается в голову цели, дробя череп и сдирая значительный лоскут скальпа. Цель Оглушена на 1d10 Раундов, и её SPD уменьшена вдвое (окр. ▼) на 1d10 часов.";
    const pills = parseCritEffectPills(text);
    expect(pills).toEqual([{ key: "stunned", formula: "1d10" }]);
  });

  // impact.torso[5]
  it("«1d5 Усталости и Оглушена на 2 Раунда» — Усталость и Оглушение вместе", () => {
    const text = "Удар в грудь дробит рёбра, и со следующим же вздохом боль возрастает многократно — цели остаётся лишь хвататься за грудь и вопить в агонии. Цель получает 1d5 Усталости и Оглушена на 2 Раунда.";
    const pills = parseCritEffectPills(text);
    expect(pills).toEqual(expect.arrayContaining([
      { key: "fatigued", formula: "1d5" },
      { key: "stunned", formula: "2" }
    ]));
  });

  // impact.arm[8]
  it("«Оглушена на 1d10 Раундов, получает 1d5 Усталости и Кровотечение» — три пилюли", () => {
    const text = "Удар отрывает руку от тела, поливая кровью всё вокруг. Цель должна пройти тест на T+0, или умереть от шока. Цель Оглушена на 1d10 Раундов, получает 1d5 Усталости и Кровотечение. Цель теряет руку.";
    const pills = parseCritEffectPills(text);
    expect(pills).toEqual(expect.arrayContaining([
      { key: "stunned", formula: "1d10" },
      { key: "fatigued", formula: "1d5" },
      { key: "bleeding", formula: null }
    ]));
    expect(pills).toHaveLength(3);
  });

  // rending.head[4] — «Оглушая» (глагольная форма, не «Оглушена»)
  it("«Оглушая цель на 1 Раунд» — глагольная форма стема тоже ловится", () => {
    const text = "Порез задевает глаз, причиняя 1d5 Усталости и Оглушая цель на 1 Раунд. Цель должна пройти тест на T+20, или потерять глаз.";
    const pills = parseCritEffectPills(text);
    expect(pills).toEqual(expect.arrayContaining([
      { key: "fatigued", formula: "1d5" },
      { key: "stunned", formula: "1" }
    ]));
  });

  // energy.head[7] — «перманентно ослеплена» (permanent, без кубика)
  it("«перманентно ослеплена» — пилюля без формулы, permanent:true", () => {
    const text = "Плоть на голове цели горит сама по себе, обнажая кость и обугленные ткани. Цель перманентно ослеплена и получает 1d10 Усталости. Оставляет Шрам.";
    const pills = parseCritEffectPills(text);
    expect(pills).toEqual(expect.arrayContaining([
      { key: "blinded", formula: null, permanent: true },
      { key: "fatigued", formula: "1d10" }
    ]));
  });

  // blast.head[5] — «перманентно лишена слуха»
  it("«перманентно лишена слуха» — Оглох, permanent:true", () => {
    const text = "Взрыв сдирает кожу с лица цели и режет барабанные перепонки. Цель Оглушена на 1d10 Раундов и перманентно лишена слуха. Оставляет Шрам.";
    const pills = parseCritEffectPills(text);
    expect(pills).toEqual(expect.arrayContaining([
      { key: "stunned", formula: "1d10" },
      { key: "deafened", formula: null, permanent: true }
    ]));
  });

  // chemical.torso[6] — «N Обескровливания» напрямую, не через тик Кровотечения
  it("«Кровотечение и 2 Обескровливания» — оба состояния, с уровнем у второго", () => {
    const text = "Артерии и вены на теле цели чернеют и вздуваются, а некоторые из них лопаются. Цель получает 1d10 урона в T, Кровотечение и 2 Обескровливания.";
    const pills = parseCritEffectPills(text);
    expect(pills).toEqual(expect.arrayContaining([
      { key: "bleeding", formula: null },
      { key: "haemorrhaging", formula: "2" }
    ]));
  });

  // chemical.head[7] — Удушье, булево, без длительности
  it("«страдает от Удушья» дважды в одном тексте — одна пилюля, не две", () => {
    const text = "Химикат повреждает лёгкие и парализует их. Цель страдает от Удушья. В начале каждого Хода Удушья она должна пройти тест на T+20, или выполнить Уход Паники и тщетно пытаться вздохнуть.";
    const pills = parseCritEffectPills(text);
    expect(pills).toEqual([{ key: "suffocating", formula: null }]);
  });

  // energy.torso[5] — «Загореться» за проваленным тестом всё равно даёт пилюлю
  it("«тест A+0, или Загореться» — пилюля предлагается, тест решает ГМ", () => {
    const text = "Ярость атаки опрокидывает цель на землю. Цель сбита с ног, получает 1d5 Усталости, должна пройти тест на A+0, или Загореться, и должна пройти тест на T+0, или быть Оглушена на 1 Раунд.";
    const pills = parseCritEffectPills(text);
    expect(pills).toEqual(expect.arrayContaining([
      { key: "prone", formula: null },
      { key: "fatigued", formula: "1d5" },
      { key: "burning", formula: null },
      { key: "stunned", formula: "1" }
    ]));
  });

  // impact.torso[3] — «сбита с ног» рядом с Оглушением
  it("«Оглушена на 1 Раунд и сбита с ног» — Повален как булево состояние", () => {
    const text = "Удар ломает одно из рёбер. Цель получает 2 Усталости, Оглушена на 1 Раунд и сбита с ног.";
    const pills = parseCritEffectPills(text);
    expect(pills).toEqual(expect.arrayContaining([
      { key: "fatigued", formula: "2" },
      { key: "stunned", formula: "1" },
      { key: "prone", formula: null }
    ]));
  });

  // impact.head[9] — чисто повествовательный текст без единого состояния
  it("текст без узнаваемых оборотов — пустой список, не мусорные пилюли", () => {
    const text = "Голова цели взрывается, разбрызгивая вокруг кровь, куски костей и мозга, забрызгивая глаза и доспехи. Любой в радиусе 4м должен пройти тест на A+0, или получить штраф −10 к WS и BS на 1 Раунд.";
    expect(parseCritEffectPills(text)).toEqual([]);
  });

  it("пустой/отсутствующий текст — пустой список, без падения", () => {
    expect(parseCritEffectPills("")).toEqual([]);
    expect(parseCritEffectPills(null)).toEqual([]);
  });
});

describe("parseCritEffectPills — таблица Шока (fear-tables.mjs)", () => {
  it("«Теряет сознание на 1d5 Раундов» → пилюля Без сознания", () => {
    const row = SHOCK_TABLE.find(r => r.text.includes("Теряет сознание"));
    const pills = parseCritEffectPills(row.text);
    expect(pills).toEqual([{ key: "unconscious", formula: null }]);
  });
});

describe("applyCritEffectPill — клик применяет состояние к актору", () => {
  it("Оглушение с кубиком: катает формулу, складывает с уже идущими Раундами, ставит флаг", async () => {
    captured.dice = [7];
    const actor = makeActor({ conditions: { stunned: true, stunnedRounds: 2 } });
    await applyCritEffectPill(actor, { key: "stunned", formula: "1d10" });

    expect(actor.system.conditions.stunned).toBe(true);
    expect(actor.system.conditions.stunnedRounds).toBe(9); // 2 текущих + 7 выпавших
    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Оглушение");
  });

  it("Усталость идёт через addFatigue (fatigue.value), не через system.conditions", async () => {
    captured.dice = [3];
    const actor = makeActor();
    await applyCritEffectPill(actor, { key: "fatigued", formula: "1d5" });

    expect(actor.system.fatigue.value).toBe(3);
    expect(actor.system.conditions.fatiguedLevel).toBeUndefined();
  });

  it("Кровотечение (булево, без формулы) — просто ставит флаг", async () => {
    const actor = makeActor();
    await applyCritEffectPill(actor, { key: "bleeding", formula: null });
    expect(actor.system.conditions.bleeding).toBe(true);
    expect(actor.system.conditions.bleedingLevel).toBeUndefined();
  });

  it("Обескровливание — уровень складывается с текущим", async () => {
    const actor = makeActor({ conditions: { haemorrhagingLevel: 1 } });
    await applyCritEffectPill(actor, { key: "haemorrhaging", formula: "2" });
    expect(actor.system.conditions.haemorrhaging).toBe(true);
    expect(actor.system.conditions.haemorrhagingLevel).toBe(3);
  });

  it("Перманентное состояние — флаг ставится, уровень не трогается", async () => {
    const actor = makeActor();
    await applyCritEffectPill(actor, { key: "blinded", formula: null, permanent: true });
    expect(actor.system.conditions.blinded).toBe(true);
    expect(actor.system.conditions.blindedRounds).toBeUndefined();
  });

  it("Без сознания (нет levelField) — флаг ставится, длительность только в тексте карточки", async () => {
    captured.dice = [4];
    const actor = makeActor();
    await applyCritEffectPill(actor, { key: "unconscious", formula: "1d5" });
    expect(actor.system.conditions.unconscious).toBe(true);
    expect(captured.chat[0].content).toContain("без автотика");
  });
});

describe("critPillsHtml — рендер кнопок", () => {
  it("без actorUuid или без пилюль — пустая строка", () => {
    expect(critPillsHtml([], "Actor.stub")).toBe("");
    expect(critPillsHtml([{ key: "stunned", formula: "1" }], "")).toBe("");
  });

  it("кнопка несёт data-атрибуты ключа/формулы/цели", () => {
    const html = critPillsHtml([{ key: "stunned", formula: "1d10" }], "Actor.stub");
    expect(html).toContain("wh-crit-apply-btn");
    expect(html).toContain('data-actor-uuid="Actor.stub"');
    expect(html).toContain('data-cond-key="stunned"');
    expect(html).toContain('data-formula="1d10"');
  });
});

// wdbc-1rno (09.09.2026): «Кровавое Пламя» упирался в «системе не знает,
// кого чемпион убил этим оружием» — но flags.warhammer-dbc.deceased реально
// есть (module/sheets/tabs/body.mjs::setDeceased, module/rules/death-save.mjs
// — весь блок Спасения/Воскрешения уже стоит на этом флаге). Не хватало
// только моста от текста крит-таблицы к этому флагу — тот же приём, что уже
// работает для Оглушения/Кровотечения/Усталости выше, просто цель не
// Состояние, а флаг «смерть». textAssertsDeath ловит ТОЛЬКО прямые
// утверждения книги («умирает», «убивает», «погибает», «безжизненное тело»,
// «труп», «не способна пережить», «смерть наступает») — НЕ условные («тест
// T+0, или умереть от шока» — умереть здесь инфинитив, другой корень, чем
// «умирает»/«умирающий»; кроме того «трупным ядом» — не «труп», негативный
// lookahead специально исключает прилагательное). Сверено построчно со ВСЕЙ
// таблицей (200 строк) — 35 утверждает смерть напрямую, 0 конфликтов с
// условными формулировками (12 строк «или умереть от шока», 2 из них несут
// «трупным»). Число уточнено живой проверкой 09.09.2026 (live-tester): первая
// редакция сужала «убива»/«погиба» до конкретных окончаний и пропускала
// деепричастие «убивая» (4 реальные строки книги) — не выдумано задним
// числом, а найдено кликом по настоящей кнопке в открытом мире.
describe("textAssertsDeath — прямое утверждение смерти в тексте крит-эффекта", () => {
  // impact.torso[10]
  it("«мгновенно убивает цель» — прямое утверждение", () => {
    expect(textAssertsDeath(
      "Мощнейший удар мгновенно убивает цель и отбрасывает безжизненное тело на 1d10м на атакующего."
    )).toBe(true);
  });

  // rending.necrosis (arm[10]) — отложенная, но безусловная смерть
  it("«умирает в ужасной агонии» (некроз, без теста) — тоже утверждение, не условие", () => {
    expect(textAssertsDeath(
      "Рука чернеет и обмякает, а химическое повреждение расходится дальше в тело, поражая внутренние органы. Цель умирает в мучениях."
    )).toBe(true);
  });

  // impact.head[8]
  it("«не способна пережить такое»", () => {
    expect(textAssertsDeath("Кровь ручьями хлещет из носа — удар выдающийся. Цель не способна пережить такое.")).toBe(true);
  });

  // blast.head[8] — без глагола «умирает»/«убивает» вовсе, только «труп»
  it("«вокруг трупа» без глагола смерти — труп сам по себе достаточен", () => {
    expect(textAssertsDeath(
      "Серия взрывов превращает голову цели в кровавое месиво. Это создаёт область Трудного Ландшафта радиусом 1d5м вокруг трупа."
    )).toBe(true);
  });

  // fire.head[9] — «погибает», не «умирает»/«убивает»
  it("«погибает мгновенно»", () => {
    expect(textAssertsDeath("Цель полностью охвачена огнём и погибает мгновенно.")).toBe(true);
  });

  // blast.head[7] — деепричастие «убивая», НЕ «убивает» (wdbc-1rno, найдено
  // живой проверкой 09.09.2026: первая редакция сужала «убива» до [ею] и
  // молча пропускала эту и ещё 3 такие же строки — regression guard)
  it("«убивая цель» — деепричастие, а не «убивает», тоже ловится", () => {
    expect(textAssertsDeath(
      "Голова и тело цели превращаются в кровавое месиво, убивая цель. Если у цели есть при себе боеприпасы, они детонируют."
    )).toBe(true);
  });

  // blast.arm[9]/blast.arm[10]/blast.head[10] — «убивая её мгновенно»
  it("«убивая её мгновенно» — та же деепричастная форма с местоимением", () => {
    expect(textAssertsDeath(
      "Взрыв отрывает руку цели, убивая её мгновенно. Если в руке у цели было оружие с источником энергии, оно взрывается."
    )).toBe(true);
  });

  // impact.torso[9] — «уходит жизнь», без явного глагола смерти
  it("«вместе с ним уходит жизнь. Безжизненное тело валится на землю.»", () => {
    expect(textAssertsDeath(
      "Фонтан крови вырывается из её горла и вместе с ним уходит жизнь. Безжизненное тело валится на землю."
    )).toBe(true);
  });

  // impact.arm[8] и семья: 12 строк книги с этой формулировкой — все условные
  it("«тест T+0, или умереть от шока» — УСЛОВНАЯ смерть, не распознаётся", () => {
    expect(textAssertsDeath(
      "Удар отрывает руку от тела, поливая кровью всё вокруг. Цель должна пройти тест на T+0, или умереть от шока. Цель Оглушена на 1d10 Раундов."
    )).toBe(false);
  });

  // chemical.arm[9]/leg[9] — «трупным ядом», не «труп»: негативный lookahead
  it("«наполняя кровь трупным ядом» — прилагательное «трупный», не труп цели", () => {
    expect(textAssertsDeath(
      "Все ткани руки поражены некрозом, наполняя кровь цели трупным ядом. Цель должна пройти тест на T+0, или умереть от шока. Если цель выжила, рука цели бесполезна."
    )).toBe(false);
  });

  // impact.torso[7] — «риском умереть с шансом 20%» — тоже условно
  it("«риском умереть с шансом 20% в конце Хода» — условная смерть", () => {
    expect(textAssertsDeath(
      "Удар с треском разламывает 1d5 рёбер цели на куски. Цель может либо лежать в ожидании медпомощи, либо продолжать выполнять действия с риском умереть с шансом 20% в конце Хода."
    )).toBe(false);
  });

  it("обычный крит-эффект без единого намёка на смерть — false", () => {
    expect(textAssertsDeath("Цель Оглушена на 1d10 Раундов, и её SPD уменьшена вдвое на 1d10 часов.")).toBe(false);
  });

  it("Шоковая таблица: «Острый сердечный приступ: тест T+0 или смерть» — условная, не распознаётся", () => {
    expect(textAssertsDeath("Острый сердечный приступ: тест T+0 или смерть. При Успехе — кататония на 1d5 часов.")).toBe(false);
  });

  it("пустой/отсутствующий текст — false, без падения", () => {
    expect(textAssertsDeath("")).toBe(false);
    expect(textAssertsDeath(null)).toBe(false);
  });
});

describe("deathButtonHtml — рендер кнопки «Констатировать смерть»", () => {
  it("текст утверждает смерть — кнопка с data-actor-uuid", () => {
    const html = deathButtonHtml("Цель мгновенно умирает.", "Actor.stub");
    expect(html).toContain("wh-crit-death-btn");
    expect(html).toContain('data-actor-uuid="Actor.stub"');
  });

  it("текст НЕ утверждает смерть — пустая строка", () => {
    expect(deathButtonHtml("Цель Оглушена на 1 Раунд.", "Actor.stub")).toBe("");
  });

  it("нет actorUuid — пустая строка, даже если текст смертельный", () => {
    expect(deathButtonHtml("Цель мгновенно умирает.", "")).toBe("");
  });
});

// ── Метрика покрытия: снимок доли распознанного по ВСЕЙ таблице ────────────
// Не «все строки должны распознаваться» — часть текста (произвольные штрафы
// к тестам, урон в характеристику) сознательно не сведена к CONDITIONS_DEF
// (см. заголовок crit-effect-parser.mjs). Мгновенная смерть тоже НЕ через
// CONDITIONS_DEF — но с wdbc-1rno (09.09.2026) больше не «не сведена вовсе»,
// у неё свой отдельный мост (textAssertsDeath/deathButtonHtml выше, метрика —
// отдельным блоком ниже). Порог ниже — фактическая доля на момент wdbc-xql6
// (64.5% крит-таблиц, 20% Шока), с небольшим запасом: тест ловит РЕГРЕССИЮ
// (кто-то сломал стем/паттерн), не требует расти к 100%.
describe("метрика покрытия — снимок доли распознанного", () => {
  it("крит-таблицы: не менее 55% из 200 строк дают хотя бы одну пилюлю", () => {
    let total = 0, recognized = 0;
    for (const locs of Object.values(CRITICAL_TABLES)) {
      for (const rows of Object.values(locs)) {
        for (const [, text] of rows) {
          total++;
          if (parseCritEffectPills(text).length) recognized++;
        }
      }
    }
    expect(total).toBe(200);
    expect(recognized / total).toBeGreaterThanOrEqual(0.55);
  });

  it("таблица Шока: не менее 1 из 10 строк даёт пилюлю", () => {
    const recognized = SHOCK_TABLE.filter(r => parseCritEffectPills(r.text).length).length;
    expect(recognized).toBeGreaterThanOrEqual(1);
  });

  // wdbc-1rno: 35/200 строк утверждают смерть напрямую (сверено построчно
  // 09.09.2026, число уточнено живой проверкой в тот же день — деепричастие
  // «убивая» сначала не ловилось, +4 строки после починки).
  // wdbc-665 (10.09.2026): машинный перебор всех 200 строк нашёл ещё девять
  // БЕЗУСЛОВНО смертельных, и все на результатах 9-10 — в них нет ни одного
  // глагола смерти («Голова цели взрывается…», «прежде чем умереть»,
  // «Смертельнее не бывает», «в кровавые клочья», «прекращает своё
  // существование»). Стало 44. Порог держится снизу — это снимок, а не цель
  // роста к 100% (условные «или умереть от шока», 14 строк, намеренно вне
  // счёта, см. отдельный тест ниже).
  it("крит-таблицы: не менее 44 из 200 строк утверждают смерть напрямую", () => {
    let total = 0, deadly = 0;
    for (const locs of Object.values(CRITICAL_TABLES)) {
      for (const rows of Object.values(locs)) {
        for (const [, text] of rows) {
          total++;
          if (textAssertsDeath(text)) deadly++;
        }
      }
    }
    expect(total).toBe(200);
    expect(deadly).toBeGreaterThanOrEqual(44);
  });

  it("Шоковая таблица: ни одна строка не утверждает смерть напрямую (только условная)", () => {
    expect(SHOCK_TABLE.some(r => textAssertsDeath(r.text))).toBe(false);
  });
});

// wdbc-665: девять безусловно смертельных строк, у которых нет ни одного
// глагола смерти. Все на результатах 9-10 — то есть самые жуткие исходы
// кнопки не давали, ГМ шёл ставить галочку руками, а Кровавому Пламени такое
// убийство не засчитывалось.
describe("textAssertsDeath: строки без глагола смерти (wdbc-665)", () => {
  const deadly = [
    "Голова цели взрывается, разбрызгивая вокруг кровь, куски костей и мозга.",
    "Безумно крича, жертва несколько секунд бьётся в агонии, прежде чем умереть.",
    "Безумно крича, жертва бьётся в агонии, прежде чем растаять как снег на ветру и умереть.",
    "Мощнейший взрыв оставляет от головы цели лишь висящий в воздухе алый туман. Смертельнее не бывает.",
    "Взрывная волна разрывает цель в кровавые клочья.",
    "Перегретый мозг цели взрывается. Цель прекращает своё существование."
  ];
  for (const text of deadly) {
    it(`утверждает смерть: «${text.slice(0, 46)}…»`, () => {
      expect(textAssertsDeath(text)).toBe(true);
    });
  }

  it("условное «или умереть от шока» новыми оборотами НЕ ловится", () => {
    expect(textAssertsDeath("Цель должна пройти тест T+0, или умереть от шока.")).toBe(false);
    expect(textAssertsDeath("Тест T+0, или умереть от шока. Рана поражена трупным ядом.")).toBe(false);
  });

  it("ни одна из 14 условных строк «или умереть» не попала под новые обороты", () => {
    let conditional = 0, falsePositives = 0;
    for (const locs of Object.values(CRITICAL_TABLES)) {
      for (const rows of Object.values(locs)) {
        for (const [, text] of rows) {
          if (!/или\s+умереть/iu.test(text)) continue;
          conditional++;
          if (textAssertsDeath(text)) falsePositives++;
        }
      }
    }
    expect(conditional).toBe(14);
    expect(falsePositives).toBe(0);
  });
});
