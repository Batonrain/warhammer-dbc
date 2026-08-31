// module/rules/library/avatar-of-slaughter.mjs
//
// Avatar of Slaughter/Аватар Резни (Черта, элитный архетип Берсерк Кхорна,
// wdbc-sk8s): «Раз за бой в конце своего Хода может потратить Очко
// Бесчестия, чтобы направить кровожадность в одного противника в пределах
// видимости. Тест W−10, иначе до конца боя −20 на все атаки и манёвры,
// направленные не на Берсерка.»
//
// Сам триггер (кнопка, трата Очка, тест, метка) — module/combat/
// avatar-of-slaughter.mjs. Здесь — только СЛЕДСТВИЕ метки: правило со
// статичным when (условие целиком читает метку на самом акторе через
// предикат avatarOfSlaughterOffTarget, rules/predicates.mjs), отбирается
// как обычное правило основной книги. Покрывает только «атаки»
// (ctx.kind==="attack") — «манёвры» (Состязания, combat/techniques.mjs)
// используют другой вид теста, не покрытый effectAppliesTo, оставлено
// открытым пробелом.

export const AVATAR_OF_SLAUGHTER_RULES = [
  {
    id: "avatarOfSlaughter.penalty",
    label: "Аватар Резни: не тот противник",
    when: { avatarOfSlaughterOffTarget: true },
    effects: [{ kind: "rollBonus", target: "attack", value: -20, label: "Аватар Резни: атакует не Берсерка" }]
  }
];
