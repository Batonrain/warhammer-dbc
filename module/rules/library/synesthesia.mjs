// module/rules/library/synesthesia.mjs
//
// Synesthesia / Синэстезия (wdbc-1rno): «Тесты Scrutiny против персонажа
// получают штраф −20». Живёт статичным правилом-библиотекой (как Avatar of
// Slaughter), а не пак-авторской записью kind:"testMod" — Конструктор
// хардкодит `when: {}` для testMod (item-rules.mjs::ruleFromEntry), кросс-
// акторных условий не поддерживает вовсе. Работает через targetHasTrait
// (predicates.mjs), которая до wdbc-1rno была мертва за пределами атак —
// теперь module/sheets/actor-sheet.mjs::_showSkillRollDialog тоже несёт
// ctx.targetActor (первый выбранный таргет сцены).
//
// НЕ покрыто этим правилом (см. capabilities.mjs, mutation.synesthesia):
// доп. −10 Избирательным атакам по персонажу — «Избирательная атака»
// выбирается в attack-dialog.mjs ПОСЛЕ того, как галочки правил уже
// отрисованы (аим-дропдаун читается только на кнопке «Бросок»), общий
// реестр правил сюда не дотягивается вовремя; нужна отдельная точка в
// attack-dialog.mjs, не этот файл.

export const SYNESTHESIA_RULES = [
  {
    id: "synesthesia.scrutinyPenalty",
    label: "Синэстезия: тест Scrutiny против цели",
    when: { targetHasTrait: "Synesthesia" },
    effects: [{ kind: "rollBonus", target: "skill:scrutiny", value: -20 }]
  }
];
