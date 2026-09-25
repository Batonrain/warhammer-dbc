// module/rules/library/null-zones.mjs
//
// Штрафы к тестам в Пустоте Парии (корбук, глава I — Субрасы Людей: Пария).
// Остальное про ауры — module/rules/null-zones.mjs.
//
// `auto: true` — это не выбор игрока, а свойство места: кто стоит в ауре,
// тот и получает штраф, без галочки (тот же приём, что Усталость в
// rules/situational.mjs). Зона узнаётся по Черте-метке «В Пустоте Парии»
// (предикат inPariahVoid), которую выдаёт и снимает аура носителя.

const SOCIAL_NO_INTIMIDATE = ["skill:charm", "skill:command", "skill:commerce",
                              "skill:deceive", "skill:inquiry", "skill:interrogate"];

export const NULL_ZONE_RULES = [
  {
    // «Псайкеры получают штраф –бPR×3 на все тесты» — бPR, базовый
    // Пси-Рейтинг (system.psyker.rating, переменная формулы «pr»), не
    // уменьшенный поддерживаемыми силами.
    id: "pariah.void.psyker",
    label: "🕳 Пустота Парии: псайкер −бPR×3",
    when: { inPariahVoid: true, psyRatingMin: 1 },
    effects: [{ kind: "rollBonus", target: "all", formula: "-pr*3",
                label: "🕳 Пустота Парии (псайкер)", auto: true }]
  },
  {
    id: "pariah.void.daemon",
    label: "🕳 Пустота Парии: демон −30",
    when: { inPariahVoid: true, isDaemon: true },
    effects: [{ kind: "rollBonus", target: "all", value: -30,
                label: "🕳 Пустота Парии (демон)", auto: true }]
  },
  {
    // «Пария получает штраф –30 на все социальные взаимодействия, кроме
    // запугивания, с другими персонажами, имеющими души, –60, если эти
    // персонажи – псайкеры или демоны». Оговорка «имеющими души» (другие
    // Парии, машины) не различается — решает ГМ.
    id: "pariah.self.social",
    label: "Пария: −30 к социальным (кроме Запугивания)",
    when: { hasTrait: "Pariah" },
    effects: [{ kind: "rollBonus", target: SOCIAL_NO_INTIMIDATE, value: -30,
                label: "Пария: отвращение (−30)", auto: true }]
  },
  {
    id: "pariah.self.social.psyker",
    label: "Пария: ещё −30 к социальным с псайкером/демоном",
    when: { hasTrait: "Pariah", targetPsykerOrDaemon: true },
    effects: [{ kind: "rollBonus", target: SOCIAL_NO_INTIMIDATE, value: -30,
                label: "Пария: цель — псайкер/демон (ещё −30)", auto: true }]
  }
];
