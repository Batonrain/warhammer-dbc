// Невидимые метки актора как Состояния (wdbc-5uae) — чтение из чужого
// источника и гашение самого источника. Чистый модуль, заглушка Foundry не
// нужна и не должна понадобиться.

import { describe, it, expect } from "vitest";
import { CONDITION_MIRRORS, MIRROR_KEYS, isMirroredCondition, readMirror,
         readAllMirrors, mirrorClearPatch, mirrorItemSources, isMirrorClearable,
         mirrorHint }
  from "../../module/rules/condition-mirrors.mjs";

const FLAG = "warhammer-dbc";

/** Актор с флагами — и через getFlag (документ), и голым объектом (данные). */
const actor = ({ system = {}, flags = {}, items = [] } = {}) => ({
  system, items,
  flags: { [FLAG]: flags },
  getFlag: (scope, key) => (scope === FLAG ? flags[key] : undefined)
});

const itemWithFlag = (key, value) => ({
  getFlag: (scope, k) => (scope === FLAG && k === key ? value : undefined)
});

describe("isMirroredCondition", () => {
  it("метки — зеркала, книжные Состояния — нет", () => {
    expect(isMirroredCondition("inRage")).toBe(true);
    expect(isMirroredCondition("running")).toBe(true);
    expect(isMirroredCondition("stunned")).toBe(false);
    expect(isMirroredCondition("")).toBe(false);
  });

  it("у каждого зеркала есть подпись и хотя бы один источник", () => {
    for (const key of MIRROR_KEYS) {
      expect(CONDITION_MIRRORS[key].label).toBeTruthy();
      expect(CONDITION_MIRRORS[key].sources.length).toBeGreaterThan(0);
    }
  });
});

describe("readMirror: поле схемы", () => {
  it("Ярость читается из system.inRage", () => {
    expect(readMirror(actor({ system: { inRage: true } }), "inRage")).toBe(true);
    expect(readMirror(actor({ system: { inRage: false } }), "inRage")).toBe(false);
    expect(readMirror(actor(), "inRage")).toBe(false);
  });
});

describe("readMirror: флаг актора", () => {
  it("Бег читается из флага", () => {
    expect(readMirror(actor({ flags: { running: true } }), "running")).toBe(true);
    expect(readMirror(actor(), "running")).toBe(false);
  });

  it("читается и без getFlag — по голым данным", () => {
    const raw = { system: {}, items: [], flags: { [FLAG]: { running: true } } };
    expect(readMirror(raw, "running")).toBe(true);
  });

  it("Марш: флаг несёт ВИД марша, а не «да/нет» — важен сам факт значения", () => {
    expect(readMirror(actor({ flags: { marchKind: "forced" } }), "marching")).toBe(true);
    expect(readMirror(actor({ flags: { marchKind: "" } }), "marching")).toBe(false);
  });
});

describe("вторая волна меток (wdbc-5uae): что ещё было невидимым", () => {
  it("Устрашён, Лишь Свет и Лучевая болезнь — обычные флаги", () => {
    expect(readMirror(actor({ flags: { dreadWailFeared: true } }), "dreadWailFeared")).toBe(true);
    expect(readMirror(actor({ flags: { justTheLightActive: true } }), "justTheLight")).toBe(true);
    expect(readMirror(actor({ flags: { radiationSickness: true } }), "radiationSickness")).toBe(true);
  });

  it("Заворожён — метка с полезной нагрузкой, важен сам факт", () => {
    expect(readMirror(actor({ flags: { seesOnlyCaster: { casterUuid: "a" } } }), "seesOnlyCaster")).toBe(true);
    expect(readMirror(actor(), "seesOnlyCaster")).toBe(false);
  });

  it("имя флага и ключ Состояния могут не совпадать — читается флаг, не ключ", () => {
    // justTheLight ← флаг justTheLightActive: ключ Состояния подписан для
    // игрока, а флаг остался тем, что был в коде. Совпадение имён не обязано.
    expect(readMirror(actor({ flags: { justTheLight: true } }), "justTheLight")).toBe(false);
    expect(mirrorClearPatch("justTheLight")).toEqual({ [`flags.${FLAG}.-=justTheLightActive`]: null });
  });
});

describe("readMirror: несколько источников — это ИЛИ", () => {
  it("«Отмечен» одинаково значит любую из ДВУХ меток «меня пометили»", () => {
    // Метка Аватара Резни — объект, а не булево: непустой объект считается
    // стоящей меткой.
    expect(readMirror(actor({ flags: { avatarOfSlaughterMark: { berserkerUuid: "a" } } }), "marked")).toBe(true);
    expect(readMirror(actor({ flags: { hexMarkedPrey: true } }), "marked")).toBe(true);
    expect(readMirror(actor(), "marked")).toBe(false);
  });

  it("Поклон Публике — НЕ «меня пометили»: флаг лежит на исполнителе (wdbc-5uae.2)", () => {
    // combat/bow-to-audience.mjs ставит флаг САМОМУ актору ({targetIds, bonus})
    // — это «я поклонился и наметил цели». Пока он входил в «Отмечен», лист
    // показывал «на мне чужая метка» тому, кто пометил ДРУГИХ: смысл прямо
    // обратный. Разведено в своё Состояние.
    const performer = actor({ flags: { bowToAudienceMark: { targetIds: ["t1", "t2"], bonus: 10 } } });
    expect(readMirror(performer, "marked")).toBe(false);
    expect(readMirror(performer, "bowedToAudience")).toBe(true);
  });
});

describe("readMirror: флаг на предмете", () => {
  it("«Щит поднят» — про вещь в руках, но виден на акторе", () => {
    const withShield = actor({ items: [itemWithFlag("shieldRaised", true)] });
    expect(readMirror(withShield, "shieldUp")).toBe(true);
  });

  it("щит есть, но опущен — метки нет", () => {
    expect(readMirror(actor({ items: [itemWithFlag("shieldRaised", false)] }), "shieldUp")).toBe(false);
    expect(readMirror(actor({ items: [] }), "shieldUp")).toBe(false);
  });

  it("хотя бы один поднятый из нескольких щитов — считается", () => {
    const two = actor({ items: [itemWithFlag("shieldRaised", false), itemWithFlag("shieldRaised", true)] });
    expect(readMirror(two, "shieldUp")).toBe(true);
  });
});

describe("readAllMirrors", () => {
  it("отдаёт все ключи разом, каждый булевым", () => {
    const got = readAllMirrors(actor({ system: { inRage: true }, flags: { running: true } }));
    expect(got.inRage).toBe(true);
    expect(got.running).toBe(true);
    expect(got.marked).toBe(false);
    expect(Object.keys(got).sort()).toEqual([...MIRROR_KEYS].sort());
  });

  it("пустой актор — все ложны, ничего не падает", () => {
    expect(Object.values(readAllMirrors(actor()))).not.toContain(true);
    expect(Object.values(readAllMirrors(null))).not.toContain(true);
  });
});

describe("mirrorClearPatch: гасится ИСТОЧНИК, а не отражение", () => {
  it("поле схемы гасится записью false", () => {
    expect(mirrorClearPatch("inRage")).toEqual({ "system.inRage": false });
  });

  it("флаг гасится штатным «-=», как в экономике действий", () => {
    expect(mirrorClearPatch("running")).toEqual({ [`flags.${FLAG}.-=running`]: null });
  });

  it("несколько источников гасятся все разом — иначе метка «вернулась бы»", () => {
    expect(mirrorClearPatch("marked")).toEqual({
      [`flags.${FLAG}.-=avatarOfSlaughterMark`]: null,
      [`flags.${FLAG}.-=hexMarkedPrey`]: null
    });
  });

  it("Поклон Публике гасит свой флаг, а не чужие метки", () => {
    expect(mirrorClearPatch("bowedToAudience"))
      .toEqual({ [`flags.${FLAG}.-=bowToAudienceMark`]: null });
  });

  it("источник на предмете патчем актора не достаётся — патч пуст", () => {
    expect(mirrorClearPatch("shieldUp")).toEqual({});
    expect(mirrorItemSources("shieldUp")).toEqual([{ kind: "itemFlag", path: "shieldRaised" }]);
  });

  it("незнакомый ключ — пустой патч, а не исключение", () => {
    expect(mirrorClearPatch("stunned")).toEqual({});
  });
});

describe("isMirrorClearable", () => {
  it("крестик показывается только там, где он реально что-то сделает", () => {
    // Врать крестиком, который ничего не делает, хуже, чем не рисовать его.
    expect(isMirrorClearable("inRage")).toBe(true);
    expect(isMirrorClearable("marked")).toBe(true);
    expect(isMirrorClearable("shieldUp")).toBe(false);
  });
});

// ── Два списка не должны разъехаться ────────────────────────────────────────
// Тот же класс ошибки, от которого заведён сам реестр Состояний: одна вещь,
// описанная в двух местах, однажды разойдётся молча. Здесь описание метки
// («что это, как выглядит») живёт в constants/conditions.mjs, а откуда её
// читать — здесь; ключи обязаны совпадать ровно.
import { CONDITIONS, CONDITION_MARK_KEYS, CONDITION_STORED_KEYS, CONDITION_KEYS, isConditionMark }
  from "../../module/constants/conditions.mjs";

describe("реестр меток и реестр Состояний согласованы", () => {
  it("ключи совпадают в обе стороны", () => {
    expect([...MIRROR_KEYS].sort()).toEqual([...CONDITION_MARK_KEYS].sort());
  });

  it("каждая метка помечена mark:true и подписана одинаково", () => {
    for (const key of MIRROR_KEYS) {
      expect(isConditionMark(key)).toBe(true);
      expect(CONDITIONS[key].label).toBe(CONDITION_MIRRORS[key].label);
    }
  });

  it("метки НЕ получают хранимого поля в схеме — они целиком производные", () => {
    for (const key of MIRROR_KEYS) expect(CONDITION_STORED_KEYS).not.toContain(key);
    // При этом из общего списка они не выпали: лист, токен и предикаты их видят.
    for (const key of MIRROR_KEYS) expect(CONDITION_KEYS).toContain(key);
  });

  it("книжные Состояния зеркалами не считаются", () => {
    for (const key of ["stunned", "bleeding", "prone"]) {
      expect(isConditionMark(key)).toBe(false);
      expect(MIRROR_KEYS).not.toContain(key);
    }
  });
});

// ── Подсказка «чем именно поднята метка» (wdbc-5uae.2) ────────────────────
//
// Тикет спрашивал, не завести ли Состояниям поле «источник». Не завели: у
// каждой метки нагрузка своей формы, одним sourceUuid она не выражается, а
// второе место правды рядом с настоящим флагом — ровно то, чего зеркала и
// избегают. Вместо этого источник сам отдаёт готовую строку, и вот она.
describe("mirrorHint: чем поднята метка прямо сейчас", () => {
  it("метка без нагрузки — подсказки нет, и это не ошибка", () => {
    expect(mirrorHint(actor({ system: { inRage: true } }), "inRage")).toBe("");
  });

  it("Проклятая Метка называет бога, под которым наложена", () => {
    const a = actor({ flags: { hexMarkedPrey: { shamanUuid: "Actor.x", god: "Кхорн" } } });
    expect(mirrorHint(a, "marked")).toContain("Проклятая Метка");
    expect(mirrorHint(a, "marked")).toContain("Кхорн");
  });

  it("Марш называет свой вид — раньше он терялся в булевом теге", () => {
    expect(mirrorHint(actor({ flags: { marchKind: "форсированный" } }), "marching"))
      .toBe("вид: форсированный");
  });

  it("Поклон Публике называет число намеченных целей и бонус", () => {
    const a = actor({ flags: { bowToAudienceMark: { targetIds: ["t1", "t2"], bonus: 10 } } });
    expect(mirrorHint(a, "bowedToAudience")).toBe("цели намечены: 2, бонус +10");
  });

  it("две метки разом — обе названы, а не только первая", () => {
    const a = actor({ flags: {
      avatarOfSlaughterMark: { berserkerUuid: "Actor.a" },
      hexMarkedPrey: { shamanUuid: "Actor.b", god: "Нургл" }
    } });
    const hint = mirrorHint(a, "marked");
    expect(hint).toContain("Аватар Резни");
    expect(hint).toContain("Проклятая Метка");
  });

  it("метка не стоит — подсказки нет", () => {
    expect(mirrorHint(actor(), "marked")).toBe("");
  });

  it("незнакомый ключ и пустой актор — пустая строка, а не исключение", () => {
    expect(mirrorHint(actor(), "нет-такого")).toBe("");
    expect(mirrorHint(null, "marked")).toBe("");
  });

  it("имя по uuid не резолвится (нет игры/токен снят) — метка всё равно названа", () => {
    // fromUuidSync вне запущенной Foundry не существует вовсе: подсказка
    // обязана пережить это без «undefined» в тексте.
    const a = actor({ flags: { avatarOfSlaughterMark: { berserkerUuid: "Actor.gone" } } });
    expect(mirrorHint(a, "marked")).toBe("Аватар Резни");
  });
});
