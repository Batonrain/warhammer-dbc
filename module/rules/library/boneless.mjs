// module/rules/library/boneless.mjs
//
// Бескостный (Общие мутации, wdbc-1rno.9) в форме «аморфной горы плоти»: пока
// на акторе и мутация, и Черта Amorphous (выдаёт кнопка «Устоять на ногах» при
// провале, combat/boneless.mjs) — «−20 на все тесты S… +30 на все тесты
// Карабканья (игнорируя штрафы к тестам S от этой мутации)». Карабканье — тест
// Athletics (S), поэтому к нему −20 тоже прилипает; +50 по области «climbing»
// даёт ровно книжные +30. Свойство места, не выбор — auto.

export const BONELESS_RULES = [
  {
    id: "boneless.amorphous.s",
    label: "🦴 Бескостный (аморфная форма): −20 к тестам S",
    when: { hasTrait: ["Boneless", "Amorphous"] },
    effects: [{ kind: "rollBonus", target: "char:s", value: -20, auto: true,
                label: "🦴 Бескостный: аморфная форма −20 S" }]
  },
  {
    id: "boneless.amorphous.climb",
    label: "🦴 Бескостный (аморфная форма): +30 Карабканье",
    when: { hasTrait: ["Boneless", "Amorphous"] },
    effects: [{ kind: "rollBonus", target: "climbing", value: 50, auto: true,
                label: "🦴 Бескостный: Карабканье +30 (и без −20 S)" }]
  }
];
