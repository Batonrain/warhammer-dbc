// module/rules/library/skitarii.mjs
//
// Кибернетика Скитарии (корбук): «В Скитария можно установить не более ½ T.b
// (окр.▲) Модулей… или получает штраф –30 на все действия». Подсчёт и Таланты,
// двигающие лимит, — rules/skitarii-modules.mjs; здесь только сам штраф.
// `auto: true` — не выбор игрока, а состояние тела, как Усталость.

export const SKITARII_RULES = [
  {
    id: "skitarii.modules.overLimit",
    label: "⚙ Перегрузка Модулями Скитарии −30",
    when: { skitariiModulesOverLimit: true },
    effects: [{ kind: "rollBonus", target: "all", value: -30,
                label: "⚙ Модулей сверх лимита", auto: true }]
  }
];
