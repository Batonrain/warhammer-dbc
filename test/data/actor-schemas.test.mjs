// test/data/actor-schemas.test.mjs
//
// Перевод типа актора с template.json на схему проверяется теми же двумя
// вопросами, что и у предметов (см. item-schemas.test.mjs): умолчания и
// сохранность данных пака.
//
// Разница в одном: умолчания актора не переписаны в тест руками, а сняты с
// прежнего template.json в legacy-actor-templates.json. У Демона таких полей
// больше двух сотен, и список, набранный заново, проверял бы не схему, а
// внимательность набиравшего. Всё, чем схема НАМЕРЕННО отличается от старого
// описания, перечислено ниже в DEVIATIONS — молча разойтись они не могут.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { CHARACTERISTICS }   from "../../module/constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../module/constants/skills.mjs";
import { packDocuments, leaves, isEmpty } from "../support/pack-docs.mjs";

const LEGACY = JSON.parse(fs.readFileSync(
  path.resolve(import.meta.dirname, "legacy-actor-templates.json"), "utf8"));

/** Пак с документами этого типа; null — таких акторов в паках нет. */
const PACKS = {
  daemon:      "bestiary",
  demonPrince: null,
  horde:       null,
  vehicle:     "vehicles",
  squad:       null,
  formation:   null,
  ship:        null,
  starSystem:  null,
  character:   "bestiary",
  // Миньон (стр. 111-113) заведён уже после отказа от template.json: снимка
  // прежних умолчаний у него нет и быть не может. Вместо сверки со снимком у
  // него своя проверка ниже — состав полей относительно общей схемы существа.
  minion:      null
};

// Миньоны (стр. 111-113) — поля заведены уже после того, как template.json
// перестал описывать поля, поэтому в снимке прежних умолчаний их нет. Миньоном
// бывает Персонаж и Демон, Хозяином — они же и Принц Демонов, и набор полей у
// всех троих один (module/data/actor/_creature.mjs).
const MINION_FIELDS = {
  masterUuid: "", minionType: "", minionTier: "", loyalty: { value: 0, max: 0 }
};

// Верховой бой (стр. 477-478) заведён так же поздно, и по той же причине его
// полей нет в снимке. Ссылку на скакуна хранит ВСАДНИК — скакуном бывает и
// техника, у которой общей схемы существа нет вовсе (rules/mount.mjs).
const MOUNT_FIELDS = {
  mount: { uuid: "", role: "rider", speed: "still", sync: false, linked: false, skidUsed: false, bladesUsed: 0 }
};

/** Расхождения сверх общих для трёх типов с характеристиками. */
const OWN_DEVIATIONS = {
  // Пусто = Бог не выбран. Умолчание "undivided" делало «Покровительство:
  // Неделимый» выполненным у любого, кто не трогал выбор (wdbc-osz).
  // Здравомыслие пилота Дредноута (wdbc-a7s) — в template.json поля не было
  // вовсе, механика Книги Машин появилась позже. electrostim/hibernation —
  // туда же: буст Электростимуляторов и флаг Гибернации (стр. 57-58).
  character: {
    patronGod: "", sanity: { value: 0, max: 0 },
    electrostim: { active: false, amount: 0 },
    hibernation: { active: false },
    // Стереотип Покровительства и своя система цены Продвижения — заведены
    // гораздо позже template.json (constants/patronage.mjs).
    patronStereotype: "", pricingModeOverride: "",
    // Момент последнего «Поесть/Попить/Поспать» (worldTime) для автопрогресса
    // стадий по времени (wdbc-jnqj) — заведён гораздо позже template.json.
    vitals: { hunger: 0, thirst: 0, sleep: 0, lastFed: null, lastDrank: null, lastSlept: null },
    // Патрон-Демон-Принц (субраса «Наследник», Трейт Помазанник(X), wdbc-yo6r) —
    // заведено гораздо позже template.json.
    anointed: { uuid: "", name: "", godKey: "", rating: 0 }
  },
  // Вкладку «ТЕЛО» Принцу открыли позже: она общая с Персонажем, и её хранимые
  // поля (фигура голо-скана и жизнеобеспечение) пришлось завести и здесь.
  demonPrince: {
    bodyType: "male", vitals: { hunger: 0, thirst: 0, sleep: 0 },
    // Свободный текстовый инпут dp.anointed снят со схемы (wdbc-yo6r) — дар
    // «Помазанник» стал реальной механикой, старую заметку-заглушку убрали;
    // непустой текст мигрирует в Заметки (см. тест ниже).
    "dp.anointed": undefined
  }
};

/** Намеренные расхождения схемы с прежним template.json: путь → почему. */
const DEVIATIONS = {
  squad: {
    // Получатель «Личной Команды» — структурная ссылка (wdbc-e728/wdbc-sk8s,
    // Voice of God/Глас Божий: «получатель Личной Команды тоже получает Очко
    // Бесчестия»), заведена гораздо позже template.json, раньше был только
    // текст в note. Было заведено дважды под двумя тикетами независимо — это
    // же поле лежало и ниже вторым ключом `squad` (объект перекрывал сам
    // себя, вторая копия без эффекта), слито в одну запись при введении
    // no-dupe-keys (wdbc-swzz).
    "shortCommand.recipientUuid": ""
  },
  vehicle: {
    // Объявлена не была, но лежит у всех 56 машин пака.
    "availability": 0,
    // Пустотные Щиты (X) — персистентный массив HP щитов, заведён позже
    // template.json (wdbc-y33b).
    "voidShields": [],
    // Тормоза Падения — лимит «раз за бой/сцену», заведён позже template.json (wdbc-y33b).
    "fallBreaksUsed": false,
    // Продвинутые Системы Управления — «уже двигалась в этот Раунд», заведён позже template.json (wdbc-y33b).
    "movedThisTurn": false,
    // Аблативная Структура (Минный Плуг, wdbc-bxw6) — заведена гораздо позже template.json.
    "structure.ablative": 0,
    "structure.ablativeMax": 0
  },
  ship: {
    // Свободная заметка «Класс корпуса» дублировала выбор реального Корпуса
    // (узел-слот в шапке) и никем не читалась кроме HUD-подписи — снята
    // вместе с полем целиком (wdbc-zuf4). undefined убирает ключ из
    // ожидаемого объекта тем же приёмом, что и toEqual прощает отсутствующим
    // полям.
    shipClass: undefined
  },
  horde: {
    // Навыки Орды заведены позже template.json (вкладка «ПОКАЗАТЕЛИ»): у Орды
    // нет покупок за опыт, поэтому в записи только ранг и выведенное значение.
    skills: Object.fromEntries(Object.keys(SKILLS_DEF)
      .map(k => [k, { rank: "untrained", total: -20 }])),
    // Групповые — записями со специализацией, как у существ.
    groupSkills: Object.fromEntries(Object.keys(GROUP_SKILLS_DEF).map(k => [k, []])),
    // Расчёты тяжёлого оружия: стреляют отдельно, своими атаками без бонусов
    // Орды, и вычитаются из Магнитуды в расчёте её стрельбы. В template.json
    // поля не было — правило считали на бумаге.
    detachedMagnitude: 0,
    // «Мод.» — знаковый ручной модификатор Итога, заведён гораздо позже
    // template.json тем же приёмом, что и у Персонажа/Демона/Миньона/Принца
    // Демона (charDamage в _creature.mjs). У Орды нет Влияния.
    charDamage: Object.fromEntries(Object.keys(CHARACTERISTICS)
      .filter(k => k !== "inf").map(k => [k, 0]))
  },
  // У трёх существ три набора расхождений сразу, и записаны они по-разному:
  // поля Миньонов и свои поля типа — обычными именами, надбавки характеристик —
  // путями внутрь characteristics. withDeviations ниже разбирает и то, и
  // другое, поэтому держать их врозь незачем.
  //
  // Надбавки — цель эффектов, добавляющих к Бонусу и к Значению
  // характеристики: свои хранимые поля. Бонус — потому что «Сверхъестественное»
  // редактируемый ввод на листе; Значение — потому что `total` расчёт собирает
  // заново, и эффект поверх него не поднимал ни Бонус, ни навыки (wdbc-5wm).
  ...Object.fromEntries(["character", "daemon", "demonPrince"].map(type => [type, {
    ...MINION_FIELDS,
    ...MOUNT_FIELDS,
    // Три слота Стремлений. Раньше писались прямо в `aspirations`, но то поле
    // объявлено объектом (там Фактор Прибыли), и массив схема отбрасывала —
    // выбор не сохранялся вовсе. Теперь у слотов своё поле.
    "aspirations.slots": [],
    // Отношения (вкладка СОЦИУМ): к кому этот актор как относится.
    relations: [],
    // Командование вне Отряда: командовать можно и теми, кто в Отряд не сведён.
    // Поля повторяют лист Отряда, но без Слаженности и Риска — их у случайной
    // группы взять неоткуда. В template.json блока не было вовсе: Команды
    // отдавались только через Отряд.
    followers: [],
    command: {
      presence:      { active: false, benefit: "extreme" },
      shortCommand:  { active: false, key: "inspire", successes: 0, note: "" },
      detailCommand: { active: false, successes: 0, picks: [] }
    },
    // Журнал опыта: откуда взялся опыт помимо ручной правки «Всего». Первым
    // его наполняет возврат за совпавшую выдачу Навыка или Таланта.
    "experience.log": [],
    // Опыт на Элитные архетипы: своя статья, а не «прочее», потому что сумма
    // считается по предметам на листе — у каждого лежит уплаченная цена.
    "experience.spentElite": 0,
    // Опыт на Техночудеса: раньше суммировался вместе с Психосилами в одну
    // статью spentPsy, теперь у него своя строка в Опыте.
    "experience.spentTech": 0,
    // База рукопашной атаки (стр. 13) — заведена отдельно от Приёма гораздо
    // позже template.json, тем же приёмом, что и meleeStance когда-то.
    meleeBase: "standard",
    // Состояние «Беспомощный» заведено гораздо позже template.json (auto-успех
    // и удвоенный урон против него — attack-dialog.mjs/attack.mjs).
    "conditions.helpless": false,
    // Стр. 30-31 («Раны и Урон», «Статусы») — Ступор/Удушье/Гангрена/Потеря
    // Конечностей (по частям тела) заведены гораздо позже template.json.
    "conditions.dazed": false,
    "conditions.suffocating": false,
    "conditions.suffocatingRounds": 0,
    "conditions.gangrene": false,
    "conditions.lostHands": false,
    "conditions.lostHandsCount": 0,
    "conditions.lostArms": false,
    "conditions.lostArmsCount": 0,
    "conditions.lostFeet": false,
    "conditions.lostFeetCount": 0,
    "conditions.lostLegs": false,
    "conditions.lostLegsCount": 0,
    "conditions.lostEyes": false,
    "conditions.lostEyesCount": 0,
    // Стр. 12 («Борьба») — связаны Захватом, заведено гораздо позже template.json.
    "conditions.grappling": false,
    // Вызов/Challenge (X), wdbc-2xku — заведено гораздо позже template.json.
    "conditions.challenged": false,
    // «В Шоке» (стр. 53, wdbc-zepq) — снимается тестом выхода из Шока
    // (module/combat/fear.mjs::rollShockRecovery), заведено гораздо позже
    // template.json.
    "conditions.shocked": false,
    // Экономика действий (стр. 12, wdbc-qleg/wdbc-fkdd): ОД — новое поле,
    // Реакции раньше были свободным текстовым полем-памяткой (умолчание ""),
    // теперь структурный пул — см. module/combat/action-economy.mjs.
    actionPoints: { value: 2, max: 2 },
    reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 },
    // Точка расширения (wdbc-ls9d): плоское снижение входящего урона от
    // эффектов, заведено гораздо позже template.json — см. combat/damage.mjs.
    incomingDamageReduction: 0,
    // Высота полёта (стр. 30, wdbc-n1cy) — состояние Хода, заведено гораздо
    // позже template.json, тем же приёмом, что mount.speed.
    "movement.altitude": "ground",
    // Данные для Limited Vision (текст на Записях, видимый только ГМ) —
    // заведено гораздо позже template.json, тот же приём, что и notes.
    limitedVisionData: "",
    // Тумблер «подключён к Ноосфере» (вкладка ТЕХ) — заведён гораздо позже
    // template.json, читают Таланты вида «Виртуальная Память».
    noosphereConnected: false,
    // Свойства оружия Corrosive/Piercing/Crippling (wdbc-plsf) — заведены
    // гораздо позже template.json, см. combat/damage.mjs.
    armorCorrosion: { head: 0, leftArm: 0, rightArm: 0, body: 0, leftLeg: 0, rightLeg: 0 },
    piercingWounds: { head: 0, leftArm: 0, rightArm: 0, body: 0, leftLeg: 0, rightLeg: 0 },
    crippledWounds: [],
    // Тумблер «В Ярости» (wdbc-plsf) — заведён гораздо позже template.json.
    inRage: false,
    // Аблативные Раны (wdbc-smy7, напр. Дар Нургла «Абсурдно Толстый») —
    // отдельный пул ПЕРЕД обычными Ранами, заведён гораздо позже template.json.
    "wounds.ablative": 0,
    "wounds.ablativeMax": 0,
    // Аблативный AP-щит (wdbc-bxw6, напр. Роба Чемпиона) — отдельный от
    // аблативных Ран пул, заведён гораздо позже template.json.
    "ablativeApShield.value": 0,
    "ablativeApShield.max": 0,
    ...Object.fromEntries(Object.keys(CHARACTERISTICS)
      .flatMap(k => [[`characteristics.${k}.bonusFx`, 0], [`characteristics.${k}.totalFx`, 0]])),
    ...OWN_DEVIATIONS[type]
  }]))
};

/** Вписать значение по пути «characteristics.t.bonusFx» в копию объекта. */
function withDeviations(base, deviations = {}) {
  const out = structuredClone(base);
  for (const [path, value] of Object.entries(deviations)) {
    const keys = path.split(".");
    let cur = out;
    for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {});
    cur[keys.at(-1)] = value;
  }
  return out;
}

/**
 * Поля прошлого формата: значение не теряется, а переезжает в другое поле
 * силами migrateData, и проверяет переезд отдельный тест.
 */
const MIGRATED_AWAY = {
  vehicle: ["crew"]   // → stations
};

describe("типы данных акторов", () => {
  // Полей в system.json больше нет вовсе, остался только перечень типов:
  // тип, попавший в этот перечень без схемы, не получит ни одного поля.
  it("у каждого типа из system.json есть схема, и каждая проверена", () => {
    const declared = Object.keys(JSON.parse(fs.readFileSync(
      path.resolve(import.meta.dirname, "../../system.json"), "utf8")).documentTypes.Actor);
    expect(Object.keys(ACTOR_DATA_MODELS).sort()).toEqual([...declared].sort());
    expect(Object.keys(PACKS).sort()).toEqual([...declared].sort());
  });

  for (const [type, pack] of Object.entries(PACKS)) {
    describe(type, () => {
      const Model = ACTOR_DATA_MODELS[type];

      it.skipIf(!LEGACY[type])("пустой актор получает умолчания прежнего template.json", () => {
        expect(new Model({}).toObject()).toEqual(withDeviations(LEGACY[type], DEVIATIONS[type]));
      });

      it.skipIf(!pack)("документы пака проходят через схему без потерь", () => {
        const docs = packDocuments(pack, type);
        expect(docs.length).toBeGreaterThan(0);

        const migrated = MIGRATED_AWAY[type] ?? [];
        const lost = [];
        for (const { file, doc } of docs) {
          const after = new Map(leaves(new Model(doc.system).toObject()));
          for (const [key, value] of leaves(doc.system)) {
            if (isEmpty(value) || migrated.some(m => key === m || key.startsWith(`${m}.`))) continue;
            if (after.get(key) !== value) lost.push(`${file}: ${key} = ${JSON.stringify(value)}`);
          }
        }
        expect(lost).toEqual([]);
      });
    });
  }

  // Миньон — существо с общей механикой плюс три своих поля. Проверяем не
  // снимок (его нет), а что схема не разошлась с общей: слуга кидает те же
  // Характеристики и Навыки, носит то же снаряжение, и лист персонажа
  // показывает его вкладками персонажа.
  describe("minion", () => {
    const minion = new ACTOR_DATA_MODELS.minion({}).toObject();
    const daemon = new ACTOR_DATA_MODELS.daemon({}).toObject();

    it("берёт всю общую схему существа", () => {
      // У Демона свои поля сверх общих — сравниваем в одну сторону: всё, что
      // есть у существа, должно быть и у Миньона.
      const daemonOwn = ["allegiance", "rank", "form", "instabilityRating",
                         "trueName", "trueNameKnown", "portfolio", "isDaemon"];
      const missing = Object.keys(daemon)
        .filter(key => !daemonOwn.includes(key) && !(key in minion));
      expect(missing).toEqual([]);
    });

    it("добавляет своё: признак, Талант-слот и Магнитуду Орды", () => {
      expect(minion.isMinion).toBe(true);
      expect(minion.slotTalentId).toBe("");
      expect(minion.magnitude).toEqual({ value: 0, max: 0 });
    });

    it("привязка к Хозяину и Лояльность — те же поля, что у существа", () => {
      expect(minion.masterUuid).toBe("");
      expect(minion.minionType).toBe("");
      expect(minion.minionTier).toBe("");
      expect(minion.loyalty).toEqual({ value: 0, max: 0 });
    });
  });

  describe("разовые переезды", () => {
    it("ростер экипажа техники переезжает из crew в stations", () => {
      const vehicle = new ACTOR_DATA_MODELS.vehicle({
        crew: [{ role: "driver", uuid: "Actor.abc", name: "Гвардеец", img: "a.webp" }]
      });
      expect(vehicle.stations).toEqual([
        { id: expect.any(String), role: "driver", uuid: "Actor.abc", name: "Гвардеец", img: "a.webp" }
      ]);
      expect(vehicle.crew).toBeUndefined();
    });

    it("занятые места экипажа переезд не трогает", () => {
      const vehicle = new ACTOR_DATA_MODELS.vehicle({
        crew: [{ role: "driver" }],
        stations: [{ id: "s1", role: "gunner", uuid: "", name: "", img: "" }]
      });
      expect(vehicle.stations).toEqual([{ id: "s1", role: "gunner", uuid: "", name: "", img: "" }]);
    });

    it("заметка «Класс корпуса» корабля переезжает в Заметки, а не теряется", () => {
      const ship = new ACTOR_DATA_MODELS.ship({ shipClass: "Иерихон", notes: "<p>Флагман</p>" });
      expect(ship.notes).toBe("<p>Класс корпуса: Иерихон</p><p>Флагман</p>");
      expect(ship.shipClass).toBeUndefined();
      // Повторный проход по уже перенесённым Заметкам ничего не дописывает.
      expect(new ACTOR_DATA_MODELS.ship({ shipClass: "Иерихон", notes: ship.notes }).notes).toBe(ship.notes);
      expect(new ACTOR_DATA_MODELS.ship({ shipClass: "" }).notes).toBe("");
    });

    it("заметка «Помазанники» Демона-Принца переезжает в Заметки, а не теряется", () => {
      const dp = new ACTOR_DATA_MODELS.demonPrince({ dp: { anointed: "Кассий Вейн" }, notes: "<p>Флагман культа</p>" });
      expect(dp.notes).toBe("<p>Помазанники (заметка до переезда на дар): Кассий Вейн</p><p>Флагман культа</p>");
      expect(dp.dp.anointed).toBeUndefined();
      // Повторный проход по уже перенесённым Заметкам ничего не дописывает.
      expect(new ACTOR_DATA_MODELS.demonPrince({ dp: { anointed: "Кассий Вейн" }, notes: dp.notes }).notes).toBe(dp.notes);
      expect(new ACTOR_DATA_MODELS.demonPrince({ dp: { anointed: "" } }).notes).toBe("");
    });

    it("список isPsyker сворачивается в флаг, а не считается правдой целиком", () => {
      expect(new ACTOR_DATA_MODELS.daemon({ isPsyker: [false, false] }).isPsyker).toBe(false);
      expect(new ACTOR_DATA_MODELS.daemon({ isPsyker: [true, true] }).isPsyker).toBe(true);
    });
  });
});
