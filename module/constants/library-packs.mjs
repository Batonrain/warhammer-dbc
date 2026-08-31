// module/constants/library-packs.mjs
//
// Паки-библиотеки Черт и Талантов. По правилу AGENTS.md «пак на тип документа
// × источник» новая книга заводит СВОЙ пак (Книга Аэльдари — aeldari-traits/
// aeldari-talents), поэтому «все Черты» и «все Таланты» — это списки паков,
// а не один пак. Всё, что ищет Черту/Талант по имени или собирает их полный
// список (резолвер Механики, пикер листа), обязано обходить эти списки.

export const TRAIT_LIB_PACKS  = ["warhammer-dbc.traits",  "warhammer-dbc.aeldari-traits"];
export const TALENT_LIB_PACKS = ["warhammer-dbc.talents", "warhammer-dbc.aeldari-talents"];
