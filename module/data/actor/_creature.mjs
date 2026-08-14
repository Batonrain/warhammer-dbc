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
  "unconscious", "blinded", "deafened", "burning", "radiation",
  "hallucinogenic", "pinned", "crippling", "addicted"
];
/** Состояния со счётчиком: имя поля → суффикс счётчика. */
const CONDITION_COUNTERS = {
  bleeding: "Level", haemorrhaging: "Level", stunned: "Rounds",
  fatigued: "Level", blinded: "Rounds", burning: "Level", radiation: "Level"
};

/**
 * Общий блок полей существа.
 * @param {object} [options]
 * @param {boolean} [options.granted] добавить поля «выдано» (только Персонаж)
 */
export function creatureSchema({ granted = false } = {}) {
  const { StringField, BooleanField, NumberField, ObjectField, SchemaField, ArrayField } = foundry.data.fields;
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
      improvement:  str("none", "Улучшение"),
      ...(granted ? { grantedImp: str("none", "Улучшение от источника") } : {}),
      total:        num(0, "Значение"),
      bonus:        num(0, "Бонус"),
      cost:         num(0, "Потрачено опыта")
    }, { label: def.label });
  }

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

  const armorFields = {};
  for (const loc of HIT_LOCATIONS) armorFields[loc] = num(0, loc);

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
    aiming:        str("none", "Прицеливание"),
    initiativeMod: num(0, "Модификатор Инициативы"),
    aspirations: new SchemaField({
      pride:        str("", "Гордость"),
      motivation:   str("", "Побуждение"),
      influence:    str("", "Влияние"),
      profitFactor: num(0, "Фактор Прибыли")
    }, { label: "Устремления" }),
    experience: new SchemaField({
      total:        num(0, "Всего"),
      spent:        num(0, "Потрачено"),
      spentChar:    num(0, "На характеристики"),
      spentSkills:  num(0, "На навыки"),
      spentTalents: num(0, "На таланты"),
      spentPsy:     num(0, "На психосилы"),
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
    insanity:   new SchemaField({ value: num(0, "Значение"), threshold: num(0, "Порог") }, { label: "Безумие" }),
    corruption: new SchemaField({ value: num(0, "Значение"), threshold: num(0, "Порог") }, { label: "Порча" }),
    characteristics: new SchemaField(charFields, { label: "Характеристики" }),
    charDamage:      new SchemaField(charDamageFields, { label: "Урон характеристикам" }),
    skills:          new SchemaField(skillFields, { label: "Навыки" }),
    groupSkills:     new SchemaField(groupSkillFields, { label: "Групповые навыки" }),
    armor:      new SchemaField({ ...armorFields }, { label: "Броня" }),
    // Складываемая надбавка AP от эффектов (constants/effect-keys.mjs) —
    // отдельно от `armor`, который берётся по максимуму, а не суммируется.
    armorBonus: new SchemaField({ ...armorFields }, { label: "Надбавка брони" }),
    movement: new SchemaField({
      halfMove: num(0, "Полуход"), move: num(0, "Ход"),
      charge:   num(0, "Натиск"),  run:  num(0, "Бег"),
      spdBonus: num(0, "Надбавка SPD")
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
    notes:          str("", "Заметки"),
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
    reactions:        str("", "Реакции"),
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
