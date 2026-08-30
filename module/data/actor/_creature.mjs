// module/data/actor/_creature.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Общая часть схемы «существа» — всё, что одинаково у Персонажа, Демона и
//  Принца Демонов: характеристики, навыки, ресурсы, состояния, одержимость.
//  Различий между ними ровно три:
//   - у Персонажа в каждой характеристике и навыке есть ещё поле «выдано»
//     (grantedImp / grantedRank) — включается опцией `granted`;
//   - у Демона другое умолчание Мировоззрения, оно перекрывается в его схеме;
//   - свои поля (Демон: истинное имя и ранг, Персонаж: покровитель и жизненно
//     важные органы) каждый тип дописывает сам.
//
//  Характеристики и навыки строятся из CHARACTERISTICS/SKILLS_DEF, а не
//  перечисляются: список навыков должен быть один, иначе новый навык появится
//  в игре, но не в схеме, и его значения не сохранятся.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../../constants/skills.mjs";

/** Зоны попадания — порядок как в листе. */
export const HIT_LOCATIONS = ["head", "leftArm", "rightArm", "body", "leftLeg", "rightLeg"];

/** Состояния (conditions) — набор один и тот же у всех существ. */
const CONDITION_FLAGS = [
  "bleeding", "haemorrhaging", "stunned", "fatigued", "poisoned", "prone",
  "helpless", "unconscious", "blinded", "deafened", "burning", "radiation",
  "hallucinogenic", "pinned", "crippling", "addicted",
  // Стр. 30-31 (Раны и Урон, «Статусы») — Ступор и Удушье не имели своих
  // полей; Гангрена и Потеря Конечностей (по частям тела) — тоже.
  "dazed", "suffocating", "gangrene",
  "lostHands", "lostArms", "lostFeet", "lostLegs", "lostEyes",
  // Стр. 12 («Борьба») — состояние двух персонажей, связанных Захватом.
  "grappling",
  // Свойство оружия Вызов/Challenge (X), wdbc-2xku: до конца следующего Хода
  // нельзя добровольно выйти из рукопашной (кроме уклонения от атаки по
  // площади) — блокирует действие «Выход из Боя» (movement-actions.mjs).
  "challenged"
];
/** Состояния со счётчиком: имя поля → суффикс счётчика. */
const CONDITION_COUNTERS = {
  bleeding: "Level", haemorrhaging: "Level", stunned: "Rounds",
  fatigued: "Level", blinded: "Rounds", burning: "Level", radiation: "Level",
  suffocating: "Rounds",
  lostHands: "Count", lostArms: "Count", lostFeet: "Count", lostLegs: "Count", lostEyes: "Count"
};

/**
 * Общий блок полей существа.
 * @param {object} [options]
 * @param {boolean} [options.granted] добавить поля «выдано» (только Персонаж)
 */
export function creatureSchema({ granted = false } = {}) {
  const { StringField, HTMLField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
  const num  = (initial, label) => new NumberField({ initial, nullable: false, label });
  const str  = (initial, label) => new StringField({ initial, label });
  const bool = (initial, label) => new BooleanField({ initial, label });
  const objList = label => new ArrayField(new ObjectField(), { label });
  const strList = label => new ArrayField(new StringField(), { label });
  /** Пара «текущее / максимум» — раны, судьба, усталость и прочие запасы. */
  const pool = label => new SchemaField({ value: num(0, "Текущее"), max: num(0, "Максимум") }, { label });

  const charFields = {};
  for (const [key, def] of Object.entries(CHARACTERISTICS)) {
    charFields[key] = new SchemaField({
      base:         num(0, "База"),
      advance:      num(0, "Продвижение"),
      supernatural: num(0, "Сверхъестественное"),
      // Цель эффектов, добавляющих к БОНУСУ характеристики (Конструктор,
      // миграция старого system.effects). Отдельное поле, а не supernatural:
      // «Сверхъестественное» — редактируемый ввод на вкладке Продвижения, и
      // эффект в нём показал бы игроку чужое число, а правка ввода поверх
      // применённого эффекта задвоила бы его. Тот же приём, что у
      // system.armorBonus рядом с ручным system.armor.
      bonusFx:      num(0, "Надбавка к Бонусу (эффекты)"),
      // То же самое для ЗНАЧЕНИЯ характеристики. Отдельное поле нужно по той
      // же причине, что и bonusFx: `total` расчёт листа собирает заново из
      // base/advance/..., и эффект поверх готового числа не поднимал ни Бонус
      // (он уже выведен), ни навыки, ни броню — «+10 к Стойкости» меняло
      // только показанную цифру.
      totalFx:      num(0, "Надбавка к Значению (эффекты)"),
      improvement:  str("none", "Улучшение"),
      ...(granted ? { grantedImp: str("none", "Улучшение от источника") } : {}),
      total:        num(0, "Значение"),
      bonus:        num(0, "Бонус"),
      cost:         num(0, "Потрачено опыта")
    }, { label: def.label });
  }

  // Знаковый ручной модификатор к Итогу характеристики («Мод.» на листе):
  // плюс прибавляет, минус вычитает. Имя поля (charDamage) сохранено ради
  // совместимости с уже записанными данными акторов.
  const charDamageFields = {};
  for (const [key, def] of Object.entries(CHARACTERISTICS))
    charDamageFields[key] = num(0, def.label);

  const skillFields = {};
  for (const [key, def] of Object.entries(SKILLS_DEF)) {
    skillFields[key] = new SchemaField({
      rank: str("untrained", "Ранг"),
      ...(granted ? { grantedRank: str("untrained", "Ранг от источника") } : {}),
      cost:  num(0, "Потрачено опыта"),
      // −20 — бросок нетренированного навыка: значение пересчитывается
      // в prepareDerivedData, здесь только умолчание пустого листа.
      total: num(-20, "Значение")
    }, { label: def.label });
  }

  const groupSkillFields = {};
  for (const [key, def] of Object.entries(GROUP_SKILLS_DEF))
    groupSkillFields[key] = objList(def.label);

  // Каждый вызов отдаёт СВОИ экземпляры полей: поле принадлежит ровно одной
  // схеме, и подстановка одного набора и в armor, и в armorBonus валит систему
  // при загрузке («field already belongs to some other parent»).
  const armorFields = () => Object.fromEntries(HIT_LOCATIONS.map(loc => [loc, num(0, loc)]));

  const conditionFields = {};
  for (const flag of CONDITION_FLAGS) {
    conditionFields[flag] = bool(false, flag);
    const counter = CONDITION_COUNTERS[flag];
    if (counter) conditionFields[flag + counter] = num(0, flag + counter);
  }

  return {
    race:          str("", "Раса"),
    subrace:       str("", "Подраса"),
    ynnariPast:    str("", "Прошлое Иннари"),
    harlequinPast: str("", "Прошлое Арлекина"),
    harlequinMasque: str("", "Маскарад"),
    navigatorHouse:  str("", "Дом Навигаторов"),
    lineageOrigin:   str("", "Происхождение линии"),
    archetype:       str("", "Архетип"),
    eliteArchetype:  str("", "Элитный архетип"),
    eliteArchetypesExtra: strList("Дополнительные элитные архетипы"),
    alignment:     str("loyalist", "Мировоззрение"),
    isPsyker:      bool(false, "Псайкер"),
    isTechpriest:  bool(false, "Техножрец"),
    isRogueTrader: bool(false, "Вольный торговец"),
    meleeStance:   str("standard", "Стойка"),
    meleeBase:     str("standard", "База"),
    aiming:        str("none", "Прицеливание"),
    initiativeMod: num(0, "Модификатор Инициативы"),
    aspirations: new SchemaField({
      pride:        str("", "Гордость"),
      motivation:   str("", "Побуждение"),
      influence:    str("", "Влияние"),
      profitFactor: num(0, "Фактор Прибыли"),
      // Три слота выбора (стр. 22): [0] Гордость, [1] Мотивация, [2] Позор —
      // позиция и есть категория. Хранились в самом `aspirations` массивом,
      // но поле объявлено объектом, и схема массив молча отбрасывала: выбор
      // не доживал до перезагрузки листа. Поэтому у слотов своё поле.
      slots:        objList("Стремления")
    }, { label: "Устремления" }),
    experience: new SchemaField({
      // Журнал начислений: откуда взялся опыт помимо ручной правки «Всего».
      // Возврат за совпавшую выдачу приходит сам собой, посреди применения
      // расы или Архетипа, и разобраться потом, откуда взялись лишние 300,
      // было бы негде.
      log:          objList("Журнал опыта"),
      total:        num(0, "Всего"),
      spent:        num(0, "Потрачено"),
      spentChar:    num(0, "На характеристики"),
      spentSkills:  num(0, "На навыки"),
      spentTalents: num(0, "На таланты"),
      spentPsy:     num(0, "На психосилы"),
      spentTech:    num(0, "На техночудеса"),
      spentElite:   num(0, "На элитные архетипы"),
      spentOther:   num(0, "На прочее"),
      current:      num(0, "Свободно")
    }, { label: "Опыт" }),
    wounds: new SchemaField({
      value:        num(0, "Текущие"),
      max:          num(0, "Максимум"),
      critical:     num(0, "Критические"),
      firstAidUsed: bool(false, "Первая помощь оказана")
    }, { label: "Раны" }),
    fate:      pool("Судьба"),
    deadMight: pool("Мощь мёртвых"),
    fatigue:   pool("Усталость"),
    // Отношения (вкладка СОЦИУМ): к кому этот персонаж как относится. Запись —
    // ссылка на актора и четыре модификатора, по одному на Навык таблицы
    // Отношений (constants/relations.mjs): отношение бывает несимметричным,
    // «предан, но не верит» — это Командование +20 при Обмане −10.
    relations: objList("Отношения"),
    // Командование вне Отряда (вкладка СОЦИУМ, панель «Под моим Присутствием»).
    // Командовать можно и теми, кто в Отряд не сведён: наёмник, орда и пара
    // миньонов — обычный сброд. Поля повторяют лист Отряда, но без Слаженности
    // и Риска: это свойства сведённого отряда, а не командира, и у случайной
    // группы их взять неоткуда.
    //
    // Состояние Команд живёт здесь, у отдающего, — так же, как у Отряда, — а
    // подчинённые читают карточку в чате: на них ничего не пишется, кроме
    // обратной метки (flags.warhammer-dbc.commandedBy).
    command: new SchemaField({
      presence: new SchemaField({
        active:  bool(false, "Присутствие"),
        benefit: str("extreme", "Преимущество")
      }, { label: "Командное Присутствие" }),
      shortCommand: new SchemaField({
        active:    bool(false, "Отдан"),
        key:       str("inspire", "Приказ"),
        successes: num(0, "Успехи"),
        note:      str("", "Пометка")
      }, { label: "Короткая Команда" }),
      detailCommand: new SchemaField({
        active:    bool(false, "Отдан"),
        successes: num(0, "Успехи"),
        picks:     objList("Выбранное")
      }, { label: "Детальная Команда" })
    }, { label: "Командование" }),
    // Подчинённые вне Отряда: ссылка на актора плюс заметка. Тип любой из
    // допустимых, включая Орду и миньона, а что до кого доходит — считает
    // rules/command.mjs.
    followers: objList("Под моим Присутствием"),
    // Миньоны (стр. 111-113). Поля общие у всех троих намеренно: миньоном
    // бывает Персонаж и Демон, Хозяином — они же и Принц Демонов, а отдельного
    // типа актора у миньона нет (module/apps/minions.mjs).
    masterUuid: str("", "Хозяин"),
    minionType: str("", "Тип миньона"),
    minionTier: str("", "Уровень миньона"),
    loyalty:    pool("Лояльность"),
    // Верховой бой (стр. 477-478). Ссылку на скакуна хранит ВСАДНИК, наоборот
    // чем у Миньонов выше: скакуном бывает и `vehicle`, а общей схемы существа
    // у техники нет — поле «кто на мне едет» пришлось бы заводить дважды, в
    // двух несвязанных схемах. У всадника оно одно и всегда одно: сидеть в
    // двух сёдлах разом нельзя. Обратный список собирается перебором акторов
    // (ridersOf в rules/mount.mjs).
    mount: new SchemaField({
      uuid: str("", "Скакун"),
      role: str("rider", "Место"),
      // Скорость скакуна в ТЕКУЩЕМ Ходу: от неё зависят штрафы стрельбы,
      // доступные углы поворота и высота падения из седла. Состояние боя, а не
      // свойство персонажа, поэтому сбрасывается вручную кнопкой панели.
      speed: str("still", "Скорость в Ходу"),
      // «Приспособиться к ритму скакуна»: пара действует в наименьшую
      // инициативу обоих, зато скакун тратит свои действия, бьёт и реагирует.
      sync:     bool(false, "В ритм скакуна"),
      // Связь MIU, телепатия или подчинённый демон — тогда руки свободны.
      linked:   bool(false, "Связь без рук"),
      skidUsed: bool(false, "Занос совершён")
    }, { label: "Верхом" }),
    insanity:   new SchemaField({ value: num(0, "Значение"), threshold: num(0, "Порог") }, { label: "Безумие" }),
    corruption: new SchemaField({ value: num(0, "Значение"), threshold: num(0, "Порог") }, { label: "Порча" }),
    characteristics: new SchemaField(charFields, { label: "Характеристики" }),
    charDamage:      new SchemaField(charDamageFields, { label: "Мод. характеристик" }),
    skills:          new SchemaField(skillFields, { label: "Навыки" }),
    groupSkills:     new SchemaField(groupSkillFields, { label: "Групповые навыки" }),
    armor:      new SchemaField(armorFields(), { label: "Броня" }),
    // Складываемая надбавка AP от эффектов (constants/effect-keys.mjs) —
    // отдельно от `armor`, который берётся по максимуму, а не суммируется.
    armorBonus: new SchemaField(armorFields(), { label: "Надбавка брони" }),
    // Точка расширения (wdbc-ls9d): плоское снижение входящего урона ДО вычета
    // из Ран, отдельно от AP/T.b — например, эффект-Черта «входящий урон −N».
    // Складывается тем же приёмом, что armorBonus/indexBonus: ХРАНИМОЕ поле,
    // эффекты целятся сюда в фазе "initial", несколько источников суммируются
    // сами (см. combat/damage.mjs).
    incomingDamageReduction: num(0, "Снижение входящего урона"),
    movement: new SchemaField({
      halfMove: num(0, "Полуход"), move: num(0, "Ход"),
      charge:   num(0, "Натиск"),  run:  num(0, "Бег"),
      spdBonus: num(0, "Надбавка SPD"),
      // Высота полёта (стр. 30: Приземная/Низкая/Высокая) — состояние Хода,
      // а не свойство персонажа, тот же приём, что system.mount.speed.
      altitude: str("ground", "Высота полёта (ground/low/high)")
    }, { label: "Перемещение" }),
    initiative: num(0, "Инициатива"),
    size:       num(0, "Размер"),
    encumbrance: new SchemaField({
      current:          num(0, "Текущий вес"),
      effectiveCurrent: num(0, "Эффективный вес"),
      gravity:          num(1, "Гравитация"),
      max:   num(0, "Предел"),
      carry: num(0, "Нести"),
      lift:  num(0, "Поднять"),
      push:  num(0, "Толкать"),
      indexBonus: new SchemaField({
        all:   num(0, "Все"),
        carry: num(0, "Нести"),
        lift:  num(0, "Поднять"),
        push:  num(0, "Толкать")
      }, { label: "Сдвиг индекса" })
    }, { label: "Грузоподъёмность" }),
    psyker: new SchemaField({
      class:         str("bound", "Класс псайкера"),
      rating:        num(0, "Психорейтинг"),
      sustain:       num(0, "Поддерживается"),
      currentRating: num(0, "Текущий рейтинг")
    }, { label: "Псайкер" }),
    cognition: new SchemaField({
      value: num(0, "Текущая"), max: num(0, "Максимум"), regen: num(0, "Восстановление")
    }, { label: "Когнитивность" }),
    // Общий тумблер «подключён к Ноосфере» (вкладка ТЕХ). Пока это ручная
    // памятка ГМа: читателя у поля нет — Таланты вида «Виртуальная Память»
    // ещё не смоделированы (у них notes «Не смоделировано»). Когда дойдёт,
    // читать это поле, а не заводить свой флаг каждому Таланту.
    noosphereConnected: bool(false, "Подключён к Ноосфере"),
    energy: pool("Энергия"),
    geneSeed: new SchemaField({
      origin:         str("", "Происхождение"),
      legion:         str("", "Легион"),
      chapter:        str("", "Орден"),
      cultureLegion:  str("", "Культура легиона"),
      cultureChapter: str("", "Культура ордена")
    }, { label: "Геносемя" }),
    bio: new SchemaField({
      gender:     str("", "Пол"),
      age:        num(0, "Возраст"),
      height:     str("", "Рост"),
      build:      str("", "Телосложение"),
      hair:       str("", "Волосы"),
      divination: str("", "Прорицание"),
      features:   str("", "Особые приметы"),
      prejudices: str("", "Предубеждения"),
      souvenir:   str("", "Памятная вещь")
    }, { label: "Внешность" }),
    notes:          new HTMLField({ initial: "", label: "Заметки" }),
    // Заготовка под Limited Vision (стр. правил про Ограниченное зрение):
    // текст, который ГМ пишет отдельно от Заметок — то, что видно владельцу
    // ограниченного зрения на этом акторе. Пока просто текстовое поле на
    // Записях; сама фильтрация показа по типу зрения — отдельная задача.
    limitedVisionData: new HTMLField({ initial: "", label: "Данные (Limited Vision)" }),
    craftAvailable: bool(false, "Доступно ремесло"),
    possessed:      bool(false, "Одержим"),
    possession: new SchemaField({
      demon:            str("katart", "Демон"),
      demonName:        str("", "Имя демона"),
      symbiosis:        num(0, "Симбиоз"),
      manifested:       bool(false, "Проявлен"),
      greaterPossessed: bool(false, "Великая одержимость"),
      demonWounds:      pool("Раны демона"),
      swapWs:           bool(false, "Подмена WS"),
      swapBs:           bool(false, "Подмена BS"),
      notes:            str("", "Заметки")
    }, { label: "Одержимость" }),
    // Экономика действий в бою (стр. 12): 2 ОД + 1 Реакция в начале своего
    // Хода, восполняются полностью каждый Ход — тратятся только пока активен
    // Encounter (module/combat/action-economy.mjs). max — база (2/1) плюс
    // надбавка ActiveEffect Таланта (эффект складывает прямо в max, фаза
    // "initial" — тот же приём, что у system.movement.spdBonus).
    actionPoints: new SchemaField({
      value: num(2, "Текущие"), max: num(2, "Максимум")
    }, { label: "Очки действия" }),
    // defenseValue/defenseMax — доп. Реакции, которые тратятся ТОЛЬКО на
    // Избегание (Уклонение/Парирование, стр. 12) и расходуются раньше
    // универсальных (Защитная Стойка, стр. 15, даёт ровно такую — см.
    // MELEE_STANCES.defensive в constants/combat.mjs).
    reactions: new SchemaField({
      value: num(1, "Текущие"), max: num(1, "Максимум"),
      defenseValue: num(0, "Текущие (только Избегание)"),
      defenseMax:   num(0, "Максимум (только Избегание)")
    }, { label: "Реакции" }),
    aptitudes:        strList("Склонности"),
    advanceTalents:   objList("Таланты в Развитии"),
    paths:            objList("Пути"),
    world:            str("", "Мир"),
    band:             str("", "Отряд"),
    drukhariFaction:  str("", "Фракция друкхари"),
    drukhariDistrict: str("", "Район друкхари"),
    insanityBonus:    num(0, "Надбавка Безумия"),
    corruptionBonus:  num(0, "Надбавка Порчи"),
    conditions: new SchemaField(conditionFields, { label: "Состояния" })
  };
}
