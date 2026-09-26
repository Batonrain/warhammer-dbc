// module/rules/library/ogryn.mjs
//
// Правила расы Огрин — машинная часть расовых Черт из constants/races.mjs
// (ключ «ogryn», поле traits); текст `benefit` остаётся там, как у Астартес
// (library/astartes.mjs) и прочих рас. Формат записи — docs/rules-format.md.
//
// Два набора:
//   • OGRYN_RULES — по расе (запись «ogryn.bruteWeapons» — признак сложения:
//     без неё расчёт огринского оружия (rules/ogryn-fit.mjs) не отличал бы
//     Огрина от человека и штрафовал бы Огрина за его же оружие);
//   • OGRYN_TRAIT_RULES — по самим Чертам «Brute Physiology» и «BONE-Head»
//     (условие hasTrait), подключены глобально в rules/sources.mjs. Черты
//     бывают не только у расы: комплексный Трейт Миньона «Ogryn» выдаёт те же
//     две Черты, и Миньон-огрин обязан работать так же, как персонаж.
//
// Размер, Сверхъестественные Сила и Стойкость приходят из данных расы;
// «+15 к максимуму Ран» и иммунитет к Обескровливанию — Механика самой Черты
// Brute Physiology (packs-src/traits), здесь их нет.

export const OGRYN_RULES = [
  {
    // «Brute Physiology / Физиология Громилы»: −10 на оружие без свойства
    // Ogrynized, −20 на стрелковое. Само число считает rules/ogryn-fit.mjs —
    // здесь только признак «сложен под огринское оружие», от которого оно
    // отталкивается в обе стороны (своё оружие без штрафа, чужое со штрафом).
    id: "ogryn.bruteWeapons",
    label: "Brute Physiology / Физиология Громилы (оружие)",
    effects: [{ kind: "grantFlag", target: "weapons.ogryn" }]
  }
];

const BRUTE = { hasTrait: "Brute Physiology" };
const BONE_HEAD = { hasTrait: "BONE-Head" };

/** Состояние «Сбой импланта» (constants/conditions.mjs) — Haywire 3+ по BONE-Head. */
export const BONE_HEAD_HAYWIRE_CONDITION = "implantHaywire";

export const OGRYN_TRAIT_RULES = [
  {
    // То же сложение, что у расы, но от Черты: Миньон-огрин расы не имеет.
    id: "ogryn.brute.weapons",
    label: "Brute Physiology / Физиология Громилы (оружие)",
    when: BRUTE,
    effects: [{ kind: "grantFlag", target: "weapons.ogryn" }]
  },
  {
    // «Не может умереть от Кровотечения» — тик Кровотечения
    // (combat/condition-ticks.mjs). «Иммунен к Обескровливанию» — отдельной
    // записью Механики Черты (Состояние: иммунитет), она гасит любой путь.
    id: "ogryn.brute.bleeding",
    label: "Brute Physiology / Физиология Громилы (Кровотечение)",
    when: BRUTE,
    effects: [{ kind: "grantFlag", target: "bleeding.noDeath" }]
  },
  {
    // «В конце своего Хода Огрин автоматически снимает с себя Оглушение».
    id: "ogryn.brute.stun",
    label: "Brute Physiology / Физиология Громилы (Оглушение)",
    when: BRUTE,
    effects: [{ kind: "grantFlag", target: "stun.shakeOffTurnEnd" }]
  },
  {
    // Пассивное восстановление Ран по Календарю — combat/brute-regen.mjs.
    id: "ogryn.brute.regen",
    label: "Brute Physiology / Физиология Громилы (восстановление)",
    when: BRUTE,
    effects: [{ kind: "grantFlag", target: "healing.bruteRegen" }]
  },
  {
    // «−20 на все тесты тонкой манипуляции». Какой тест «тонкий», решает
    // ситуация, а не Навык (тот же Tech-Use бывает и ударом гаечным ключом) —
    // поэтому галочка в окне теста, а не авто-штраф. Область — тесты Навыков
    // и Характеристик на Ловкости, Интеллекте и Восприятии (взлом, ловкость
    // рук, ремесло, тех-обслуживание, медика): атаке и Силе/Стойкости эта
    // галочка только мешала бы.
    id: "ogryn.brute.fineWork",
    label: "Толстые пальцы: тонкая манипуляция (−20)",
    when: BRUTE,
    effects: [{ kind: "rollBonus", target: ["basedon:ag", "basedon:int", "basedon:per"], value: -20,
                label: "Физиология Громилы: тонкая манипуляция" }]
  },
  {
    // «Любой тест I … при Успехе даёт не больше 1 Успеха».
    id: "ogryn.boneHead.intCap",
    label: "BONE-Head / Костеголов: тест I — не больше 1 Успеха",
    when: BONE_HEAD,
    effects: [{ kind: "successDegCap", target: "basedon:int", value: 1 }]
  },
  {
    // «Любой тест I занимает у Огрина минимум полное действие» — 2 ОД в свой
    // Ход в бою, списывает combat/bone-head.mjs::payIntTestAction.
    id: "ogryn.boneHead.intFullAction",
    label: "BONE-Head / Костеголов: тест I — Полное действие",
    when: BONE_HEAD,
    effects: [{ kind: "grantFlag", target: "tests.intFullAction" }]
  },
  {
    // Поле Haywire 3+ — «автоматически проваливает все тесты I». Сбой живёт
    // Состоянием со сроком (его ставит combat/damage.mjs при попадании ЭМИ).
    id: "ogryn.boneHead.haywire",
    label: "BONE-Head / Костеголов: сбой импланта",
    when: { ...BONE_HEAD, hasCondition: BONE_HEAD_HAYWIRE_CONDITION },
    effects: [{ kind: "autoFail", target: "basedon:int", label: "📡 Сбой импланта — тест I" }]
  },
  {
    // Кому при попадании ЭМИ считать сбой и Ступор — combat/damage.mjs.
    id: "ogryn.boneHead.flag",
    label: "BONE-Head / Костеголов",
    when: BONE_HEAD,
    effects: [{ kind: "grantFlag", target: "haywire.boneHead" }]
  }
];
