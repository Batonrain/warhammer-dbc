// test/sheets/ritual-cast-dialog.test.mjs
//
// Диалог «Провести ритуал» (кнопка на строке ритуала листа персонажа,
// 29.08.2026) — та же схема теста, что у диалога Навыка (test/sheets/
// skill-roll.test.mjs): DialogV2.wait запоминается заглушкой, кнопка жмётся
// через captured.press(action, fakeForm(...)).

import { afterEach, describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const { showRitualCastDialog } = await import("../../module/sheets/ritual-cast-dialog.mjs");

const savedRuleSources = getRuleSources();
/** Метки актора приходят возможностями из реестра — реестр возвращаем как был. */
function restoreRuleSources() {
  clearRuleSources();
  for (const [key, fn] of savedRuleSources) registerRuleSource(key, fn);
}

beforeEach(() => { resetCaptured(); globalThis.game.user = {}; });

const actor = () => ({ id: "act-1", name: "Каэль Ворн", type: "character",
  system: { characteristics: { int: { total: 40 } }, skills: {}, groupSkills: {} } });

/** Предмет-ритуал: нет навыка (база −20), сложность/тип книги заданы явно. */
const item = (over = {}) => ({
  id: "r1", name: "Зов Малефика",
  system: {
    testSkillScope: "", testSkillKey: "", testChar: "int", testMod: -10,
    aversionPerFail: 5, assistMin: 0, assistMax: 4, failureType: "summon",
    ...over
  },
  getFlag: () => undefined
});

describe("диалог «Провести ритуал»", () => {
  it("открывается с заголовком по имени предмета", () => {
    showRitualCastDialog(actor(), item());
    expect(captured.dialog.window.title).toBe("Ритуал: Зов Малефика");
  });

  it("«Провести» бросает и кладёт карточку в чат", async () => {
    const promise = showRitualCastDialog(actor(), item());
    // Нет навыка → база −20, порог всегда отрицателен — гарантированный
    // провал d100, второй кубик уходит на Отвращение Варпа (тип summon).
    captured.dice = [50, 50];
    await captured.press("cast", fakeForm({ "#rit-assistants": "0" }));
    await promise;

    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Зов Малефика");
  });

  it("присутствие ассистентов без жертвы бонуса не даёт", async () => {
    const promise = showRitualCastDialog(actor(), item());
    captured.dice = [50, 50];
    await captured.press("cast", fakeForm({ "#rit-assistants": "2" }));
    await promise;

    expect(captured.chat[0].content).not.toContain("Жертва ассистентов");
  });

  it("принесённые в жертву ассистенты попадают в разбивку порога", async () => {
    const promise = showRitualCastDialog(actor(), item());
    captured.dice = [50, 50];
    await captured.press("cast", fakeForm({ "#rit-assistants": "2", "#rit-assist-sac": "2" }));
    await promise;

    expect(captured.chat[0].content).toContain("Жертва ассистентов ×2");
  });

  it("жертва клампится к числу присутствующих ассистентов", async () => {
    const promise = showRitualCastDialog(actor(), item());
    captured.dice = [50, 50];
    await captured.press("cast", fakeForm({ "#rit-assistants": "1", "#rit-assist-sac": "5" }));
    await promise;

    expect(captured.chat[0].content).toContain("Жертва ассистентов ×1");
  });

  it("«Отмена» не бросает и не создаёт карточку", async () => {
    const promise = showRitualCastDialog(actor(), item());
    await captured.dismiss();
    const res = await promise;

    expect(res).toBeNull();
    expect(captured.chat).toEqual([]);
    expect(captured.rolls).toEqual([]);
  });

  it("невыполненное требование ритуалиста показано в окне", () => {
    const withReq = item({});
    withReq.getFlag = (_scope, key) => (key === "req"
      ? [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "reqRace", raceKey: "drukhari" }] }]
      : undefined);
    showRitualCastDialog(actor(), withReq);

    expect(captured.dialog.content).toContain("Требования не выполнены");
    expect(captured.dialog.content).toContain("Раса: Друкхари");
  });

  it("модификаторы призыва видны для summon-типа и скрыты для не-summon", () => {
    showRitualCastDialog(actor(), item({ failureType: "summon" }));
    expect(captured.dialog.content).toContain("Модификаторы призыва");

    showRitualCastDialog(actor(), item({ failureType: "exorcism" }));
    expect(captured.dialog.content).not.toContain("Модификаторы призыва");
  });

  it("один путь проведения — дропдаун не показан", () => {
    showRitualCastDialog(actor(), item());
    expect(captured.dialog.content).not.toContain("id=\"rit-path\"");
  });

  it("несколько путей (rollPaths) — дропдаун со всеми вариантами", () => {
    showRitualCastDialog(actor(), item({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Daemons",
      rollPaths: [{ scope: "group", key: "forbiddenLore", specialty: "Heresy", char: "wp", mod: -30 }]
    }));
    expect(captured.dialog.content).toContain("id=\"rit-path\"");
    expect(captured.dialog.content).toContain("<option value=\"default\">");
    expect(captured.dialog.content).toContain("<option value=\"alt:0\">");
  });

  it("выбор альтернативного пути меняет Сложность и модификатор в брошенной карточке", async () => {
    const promise = showRitualCastDialog(actor(), item({
      testSkillScope: "group", testSkillKey: "forbiddenLore", testSpecialty: "Daemons", testMod: -10,
      rollPaths: [{ scope: "group", key: "forbiddenLore", specialty: "Heresy", char: "wp", mod: -30 }]
    }));
    captured.dice = [50, 50];
    await captured.press("cast", fakeForm({ "#rit-path": "alt:0", "#rit-assistants": "0" }));
    await promise;

    expect(captured.chat[0].content).toContain("-30");
  });

  it("модификаторы ритуала (extraMods) показаны пилюлями и отмеченный уходит в порог", async () => {
    const promise = showRitualCastDialog(actor(), item({
      extraMods: [{ label: "С всадником", value: -20 }, { label: "Ассистент в жертву", value: 10 }]
    }));
    expect(captured.dialog.content).toContain("Модификаторы ритуала");
    expect(captured.dialog.content).toContain("С всадником");

    captured.dice = [50, 50];
    await captured.press("cast", fakeForm(
      { "#rit-assistants": "0" },
      { "[data-extra]": [{ dataset: { extra: "1" }, checked: true }] }
    ));
    await promise;

    expect(captured.chat[0].content).toContain("Модификаторы ритуала: +10");
  });

  it("нет extraMods — блок «Модификаторы ритуала» не показан", () => {
    showRitualCastDialog(actor(), item());
    expect(captured.dialog.content).not.toContain("Модификаторы ритуала");
  });

  // Бестиарий скрыт от игрока (ownership.PLAYER:"NONE") — блок «Демон» вписывается
  // вручную (имя+Inf), появляется только у summon-like типов (isSummonLike).
  it("блок «Демон» виден для summon-like типа и скрыт для не-summon-like", () => {
    showRitualCastDialog(actor(), item({ failureType: "summon" }));
    expect(captured.dialog.content).toContain("id=\"rit-demon-name\"");

    showRitualCastDialog(actor(), item({ failureType: "exorcism" }));
    expect(captured.dialog.content).not.toContain("id=\"rit-demon-name\"");
  });

  it("вписанный Inf демона уходит штрафом в порог и подпись демона в карточку", async () => {
    const promise = showRitualCastDialog(actor(), item({ failureType: "summon", testMod: 100 }));
    captured.dice = [1];
    await captured.press("cast", fakeForm({
      "#rit-assistants": "0", "#rit-demon-name": "Кровожад", "#rit-demon-inf": "45"
    }));
    await promise;

    expect(captured.chat[0].content).toContain("Кровожад");
    expect(captured.chat[0].content).toContain("−Inf");
  });

  // wdbc-1rno, шаг B/C: у ритуалов с фиксированным демоном (Инфернальный
  // Оруженосец и т.п.) имя называет не ГМ за столом, а сам предмет
  // (item.system.demonName) — поле не должно быть пустым текстовым инпутом,
  // иначе readRitualForm молча стирает R.demonName пустой строкой при отправке
  // формы, и castNoTestRitual решает, что демона называть некому. fakeForm —
  // синтетическая заглушка формы (не настоящий DOM), поэтому здесь значение
  // скрытого поля подставлено явно — ровно то, что живой браузер отдал бы из
  // атрибута value= сам, без участия игрока; markup-тест ниже проверяет, что
  // этот value= действительно печатается в разметку.
  it("демон, фиксированный Даром (item.system.demonName) — доезжает до карточки без правки формы", async () => {
    const promise = showRitualCastDialog(actor(), item({
      failureType: "summon", noTest: true, demonName: "Кровопускатель", asMinion: true
    }));
    await captured.press("cast", fakeForm({ "#rit-assistants": "0", "#rit-demon-name": "Кровопускатель" }));
    await promise;

    expect(captured.chat[0].content).toContain("Кровопускатель");
    expect(captured.chat[0].content).toContain("Привязан Миньоном без слота");
  });

  it("демон, фиксированный Даром — редактируемого поля имени в разметке нет", () => {
    showRitualCastDialog(actor(), item({ failureType: "summon", noTest: true, demonName: "Кровопускатель" }));
    expect(captured.dialog.content).not.toContain("placeholder=\"напр. Кровожад\"");
    expect(captured.dialog.content).toContain("Кровопускатель");
  });

  // wdbc-1rno, шаг D: второй Ритуал-предмет Инфернального Оруженосца
  // (item.system.asWeapon) — вселение в оружие Ритуалиста вместо Миньона.
  describe("asWeapon — вселение демона в оружие Ритуалиста", () => {
    // Настоящий actor.items — EmbeddedCollection (Map с array-методами):
    // диалогу нужен .filter (список выбора), castNoTestRitual — .get(id).
    const actorWithWeapons = (weapons = []) => {
      const items = [...weapons];
      items.get = id => weapons.find(w => w.id === id);
      return { ...actor(), items };
    };

    it("список оружия Ритуалиста показан в диалоге", () => {
      const weapons = [{ id: "w1", type: "weapon", name: "Цепной Клинок" }, { id: "w2", type: "weapon", name: "Болтер" }];
      showRitualCastDialog(actorWithWeapons(weapons), item({
        failureType: "summon", noTest: true, asWeapon: true, demonName: "Кровопускатель", demonGod: "khorne"
      }));

      expect(captured.dialog.content).toContain("id=\"rit-target-weapon\"");
      expect(captured.dialog.content).toContain("Цепной Клинок");
      expect(captured.dialog.content).toContain("Болтер");
    });

    it("на листе нет оружия — подсказка вместо списка", () => {
      showRitualCastDialog(actorWithWeapons([]), item({
        failureType: "summon", noTest: true, asWeapon: true, demonName: "Кровопускатель"
      }));

      expect(captured.dialog.content).not.toContain("id=\"rit-target-weapon\"");
      expect(captured.dialog.content).toContain("Оруженосец останется в Истинной Форме");
    });

    it("не asWeapon — блока «Оружие-сосуд» нет вовсе", () => {
      showRitualCastDialog(actorWithWeapons([{ id: "w1", type: "weapon", name: "Клинок" }]),
        item({ failureType: "summon", noTest: true, asMinion: true, demonName: "Кровопускатель" }));

      expect(captured.dialog.content).not.toContain("id=\"rit-target-weapon\"");
      expect(captured.dialog.content).not.toContain("Оружие-сосуд");
    });

    it("выбранное оружие доезжает до карточки, а не Миньон", async () => {
      const weapons = [{ id: "w1", type: "weapon", name: "Цепной Клинок" }];
      const promise = showRitualCastDialog(actorWithWeapons(weapons), item({
        failureType: "summon", noTest: true, asWeapon: true, demonName: "Кровопускатель", demonGod: "khorne"
      }));
      // fakeForm — синтетическая заглушка формы (см. пояснение у теста с
      // фиксированным demonName выше): значения скрытых полей demon-name/god
      // подставлены явно, ровно как их отдал бы живой DOM.
      await captured.press("cast", fakeForm({
        "#rit-assistants": "0", "#rit-target-weapon": "w1",
        "#rit-demon-name": "Кровопускатель", "#rit-demon-god": "khorne"
      }));
      await promise;

      expect(captured.chat[0].content).toContain("Оруженосец вселён в оружие");
      expect(captured.chat[0].content).toContain("Цепной Клинок");
      expect(captured.chat[0].content).not.toContain("Привязан Миньоном");
      expect(captured.chat[0].content).not.toContain("токен размещён");
    });
  });

  // wdbc-1rno, «Рыцарь Бога»: третий книжный исход того же noTest-ритуала
  // (item.system.asMount) — вселение демона в уже имеющегося скакуна/технику
  // персонажа (actor.system.mount.uuid, панель «ВЕРХОМ»), а не в Миньона/оружие.
  // showRitualCastDialog становится настоящей async-функцией на этой ветке
  // (await fromUuid) — нужен один тик (flush), прежде чем читать captured.dialog.
  describe("asMount — вселение демона в скакуна/технику персонажа", () => {
    const flush = () => new Promise(r => setTimeout(r, 0));
    const realFromUuid = globalThis.fromUuid;
    afterEach(() => { globalThis.fromUuid = realFromUuid; });

    const actorWithMount = (mount) => {
      const a = actor();
      a.system.mount = mount ? { uuid: "Actor.mount-1" } : undefined;
      globalThis.fromUuid = async uuid => (uuid === "Actor.mount-1" ? mount : null);
      return a;
    };

    it("текущий скакун с панели «ВЕРХОМ» показан в диалоге", async () => {
      const promise = showRitualCastDialog(actorWithMount({ uuid: "Actor.mount-1", name: "Джаггернаут" }), item({
        failureType: "summon", noTest: true, asMount: true, demonName: "Джаггернаут", demonGod: "khorne"
      }));
      await flush();

      expect(captured.dialog.content).toContain("id=\"rit-target-mount\"");
      expect(captured.dialog.content).toContain("Джаггернаут");
      await captured.press("cast", fakeForm({ "#rit-assistants": "0" }));
      await promise;
    });

    it("нет скакуна на панели «ВЕРХОМ» — подсказка вместо строки скакуна", async () => {
      const promise = showRitualCastDialog(actorWithMount(null), item({
        failureType: "summon", noTest: true, asMount: true, demonName: "Джаггернаут"
      }));
      await flush();

      expect(captured.dialog.content).not.toContain("id=\"rit-target-mount\"");
      expect(captured.dialog.content).toContain("Истинной Форме");
      await captured.press("cast", fakeForm({ "#rit-assistants": "0" }));
      await promise;
    });

    it("не asMount — блока «Скакун/техника-сосуд» нет вовсе", async () => {
      showRitualCastDialog(actor(), item({ failureType: "summon", noTest: true, asMinion: true, demonName: "Кровопускатель" }));

      expect(captured.dialog.content).not.toContain("id=\"rit-target-mount\"");
      expect(captured.dialog.content).not.toContain("Скакун/техника-сосуд");
    });

    it("выбранный скакун доезжает до карточки, а не Миньон/оружие", async () => {
      const promise = showRitualCastDialog(actorWithMount({ uuid: "Actor.mount-1", name: "Джаггернаут" }), item({
        failureType: "summon", noTest: true, asMount: true, demonName: "Джаггернаут", demonGod: "khorne"
      }));
      await flush();
      await captured.press("cast", fakeForm({
        "#rit-assistants": "0", "#rit-target-mount": "Actor.mount-1",
        "#rit-demon-name": "Джаггернаут", "#rit-demon-god": "khorne"
      }));
      await promise;

      expect(captured.chat[0].content).toContain("вселён в скакуна/технику");
      expect(captured.chat[0].content).not.toContain("Привязан Миньоном");
      expect(captured.chat[0].content).not.toContain("токен размещён");
    });
  });

  it("не summon-like тип — блока «Демон» нет и подписи демона в карточке не будет", async () => {
    const promise = showRitualCastDialog(actor(), item({ failureType: "exorcism", testMod: 50 }));
    captured.dice = [1];
    await captured.press("cast", fakeForm({ "#rit-assistants": "0" }));
    await promise;

    expect(captured.chat[0].content).not.toContain("Демон:");
  });

  // Корбук, «VI. МИСТИКА → РИТУАЛЫ»: «метку бога демона +30», «покровительство
  // (но не метку) бога демона +20». Раньше обе строки игрок отмечал сам, хотя
  // и Метка, и Покровительство лежат у него же на листе (wdbc-k1q4).
  describe("Бог демона: Метка и Покровительство считаются по листу", () => {
    afterEach(restoreRuleSources);

    const marked = god => {
      clearRuleSources();
      registerRuleSource("test", () => [{
        id: `mark.${god}`, label: `Метка ${god}`, when: {},
        effects: [{ kind: "grantFlag", target: `mark.${god}` }]
      }]);
      return actor();
    };

    it("в блоке «Демон» есть выбор Бога", () => {
      showRitualCastDialog(actor(), item({ failureType: "summon" }));
      expect(captured.dialog.content).toContain("id=\"rit-demon-god\"");
      expect(captured.dialog.content).toContain("Кхорн");
    });

    it("Метка названного бога даёт +30 без единой галочки", async () => {
      const promise = showRitualCastDialog(marked("khorne"), item({ failureType: "summon", testMod: 0 }));
      captured.dice = [1, 50];
      await captured.press("cast", fakeForm({ "#rit-assistants": "0", "#rit-demon-god": "khorne" }));
      await promise;

      expect(captured.chat[0].content).toContain("Метка Кхорна: +30");
    });

    it("Покровительство без Метки даёт +20 и названо своей строкой", async () => {
      clearRuleSources();
      registerRuleSource("test", () => []);
      const a = actor();
      a.system.patronGod = "nurgle";
      const promise = showRitualCastDialog(a, item({ failureType: "summon", testMod: 0 }));
      captured.dice = [1, 50];
      await captured.press("cast", fakeForm({ "#rit-assistants": "0", "#rit-demon-god": "nurgle" }));
      await promise;

      expect(captured.chat[0].content).toContain("Покровительство Нургла (без Метки): +20");
    });

    // Три ритуала корбука Метку ТРЕБУЮТ (Двор Первого Круга, Укрощение
    // Бронзового Скакуна, Трансформация Диска) — в паке это возможность
    // mark.<бог>, и без неё окно обязано назвать её словами, а не «Требования
    // не выполнены» без причины.
    it("ритуал с требованием Метки называет её в окне, если Метки нет", () => {
      clearRuleSources();
      registerRuleSource("test", () => []);
      const rit = item({ failureType: "summon" });
      rit.getFlag = (_scope, key) => (key === "req"
        ? [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "reqCapability", capabilityKey: "mark.khorne" }] }]
        : undefined);
      showRitualCastDialog(actor(), rit);

      expect(captured.dialog.content).toContain("Требования не выполнены");
      expect(captured.dialog.content).toContain("Метка Кхорна");
    });

    it("Метка враждебного Бога даёт −20 сама — по матрице отношений корбука", async () => {
      const promise = showRitualCastDialog(marked("slaanesh"), item({ failureType: "summon", testMod: 0 }));
      captured.dice = [1, 50];
      await captured.press("cast", fakeForm({ "#rit-assistants": "0", "#rit-demon-god": "khorne" }));
      await promise;

      expect(captured.chat[0].content).toContain("Враждебный Бог: Слаанеш: -20");
    });

    it("Бог не назван — ничего не подставляется", async () => {
      const promise = showRitualCastDialog(marked("khorne"), item({ failureType: "summon", testMod: 0 }));
      captured.dice = [1, 50];
      await captured.press("cast", fakeForm({ "#rit-assistants": "0" }));
      await promise;

      expect(captured.chat[0].content).not.toContain("Метка Кхорна");
    });
  });
});
