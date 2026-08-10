// module/constants/homeworlds.mjs
// ════════════════════════════════════════════════════════════════════════
//  Родные миры («Родные миры и Предсказания»).
//  Каждый мир даёт три модификатора Характеристик и одну Особенность.
//
//  chars       — прямые модификаторы ЗНАЧЕНИЯ характеристик (не бонуса);
//  grants      — что выдаётся сразу (навыки, таланты, черты, Раны, Порча);
//  choices     — выборы, которые надо сделать при выборе мира (диалог);
//  rollMods    — ситуативные Особенности: приходят галочкой в диалог броска.
//
//  Ключи характеристик системы: ws bs s t ag int per wp fel inf.
//  В книге: S=s, T=t, F=fel, I=int, W/WP=wp, P=per, A=ag, BS=bs, WS=ws.
// ════════════════════════════════════════════════════════════════════════

import { matchesContext } from "../rules/match-context.mjs";

export const HOMEWORLD_SOURCE = "Родные миры и Предсказания";

/**
 * Контексты бросков, в которые могут вклиниваться Особенности.
 *  skill  — проверка навыка/характеристики: { kind:"skill", skill, group, specialty, char }
 *  attack — окно атаки:                     { kind:"attack", ranged }
 *  fear   — тест Страха:                    { kind:"fear" }
 */
export const HOMEWORLDS = [
  {
    key: "wild", label: "Дикий мир",
    chars: { s: 3, t: 3, fel: -3 },
    feature: {
      name: "Старые Пути",
      desc: "В руках выходца персонажа любое примитивное оружие теряет качество Primitive и получает качество Proven (3)."
    },
    rollMods: [{
      key: "wild-primitive", when: { kind: "attack" }, value: 0,
      label: "Старые Пути: примитивное оружие теряет Primitive и получает Proven (3)",
      note: "Влияет на бросок урона, а не на попадание."
    }]
  },
  {
    key: "void", label: "Пустота",
    chars: { int: 3, wp: 3, s: -3 },
    feature: {
      name: "Из пустоты",
      desc: "Персонаж не считает невесомость трудным ландшафтом и получает умение Trade (Voidfarer) +0."
    },
    grants: { groupSkills: [{ group: "trade", specialty: "Voidfarer", rank: "knows" }] }
  },
  {
    key: "frontier", label: "Пограничный мир",
    chars: { bs: 3, per: 3, fel: -3 },
    feature: {
      name: "Надейся на себя",
      desc: "Персонаж получает +20 к навыку Tech-Use когда добавляет личные модификации к оружию, и +10 когда ремонтирует свои вещи."
    },
    rollMods: [
      { key: "frontier-mod", when: { kind: "skill", skill: "techUse" }, value: 20,
        label: "Надейся на себя: личные модификации оружия (+20)" },
      { key: "frontier-repair", when: { kind: "skill", skill: "techUse" }, value: 10,
        label: "Надейся на себя: ремонт своих вещей (+10)" }
    ]
  },
  {
    key: "hive", label: "Мир-улей",
    chars: { ag: 3, per: 3, wp: -3 },
    feature: {
      name: "Бесчисленные Толпы в Металлических Горах",
      desc: "Персонаж игнорирует толпы при движении, считая их за открытую местность. В закрытом помещении получает бонус +20 к проверкам Navigation (Surface)."
    },
    rollMods: [{
      key: "hive-nav", when: { kind: "skill", group: "navigation", specialty: "Surface" }, value: 20,
      label: "Бесчисленные Толпы: закрытое помещение (+20)"
    }]
  },
  {
    key: "temple", label: "Мир-храм",
    chars: { fel: 3, wp: 3, per: -3 },
    feature: {
      name: "Пламенная вера",
      desc: "Всякий раз, когда персонаж тратит очко Бесчестья, игрок бросает 1d10. При выпадении 1 общее количество Очков Бесчестья не уменьшается."
    },
    infamySave: { die: "1d10", on: 1 }
  },
  {
    key: "noble", label: "Знать",
    chars: { fel: 3, int: 3, t: -3 },
    feature: {
      name: "Привычка к власти",
      desc: "Персонаж получает +5 на тест Command(F) прямыми подчинёнными, +10 к Лояльности всех миньонов и Common Lore (Intrigue)."
    },
    grants: { groupSkills: [{ group: "commonLore", specialty: "Intrigue", rank: "knows" }] },
    rollMods: [{
      key: "noble-command", when: { kind: "skill", skill: "command" }, value: 5,
      label: "Привычка к власти: прямые подчинённые (+5)"
    }]
  },
  {
    key: "garden", label: "Мир-сад",
    chars: { fel: 3, ag: 3, t: -3 },
    feature: {
      name: "Безмятежность Зелени",
      desc: "Персонаж уменьшает вдвое действие любого результата из таблицы Шока или Ментальных травм и получает +10 ко всем проверкам на Подавление Травм и Расстройств."
    },
    rollMods: [{
      key: "garden-suppress", when: { kind: "skill", suppression: true }, value: 10,
      label: "Безмятежность Зелени: Подавление Травм и Расстройств (+10)"
    }]
  },
  {
    key: "death", label: "Мир смерти",
    chars: { ag: 3, per: 3, fel: -3 },
    feature: {
      name: "Паранойя Выжившего",
      desc: "Когда персонажа застали Неожиданностью, атакующие не получают бонус +30 к их BS и WS, когда целятся в него."
    },
    rollMods: [{
      key: "death-paranoia", when: { kind: "attack", target: true }, value: 0,
      label: "Паранойя Выжившего у цели: снять бонус «Цель Врасплох» (+30)",
      clears: "surprise"
    }]
  },
  {
    key: "forge", label: "Мир-кузня",
    chars: { int: 3, t: 3, fel: -3 },
    feature: {
      name: "Выросший в труде",
      desc: "Персонаж начинает игру с талантом Technical Knock, либо с одной из специализаций Общих знаний на ранге «Тренированное» (+10)."
    },
    choices: [{
      key: "forge-start", label: "Выросший в труде", type: "one",
      hint: "Выберите, с чего начинает персонаж.",
      options: [
        { label: "Талант Technical Knock", grants: { talents: ["Technical Knock"] } },
        { label: "Common Lore (Machine Cult) +10", grants: { groupSkills: [{ group: "commonLore", specialty: "Machine Cult", rank: "trained" }] } },
        { label: "Common Lore (Sump) +10",         grants: { groupSkills: [{ group: "commonLore", specialty: "Sump",         rank: "trained" }] } },
        { label: "Common Lore (Tech) +10",         grants: { groupSkills: [{ group: "commonLore", specialty: "Tech",         rank: "trained" }] } },
        { label: "Common Lore (Toil) +10",         grants: { groupSkills: [{ group: "commonLore", specialty: "Toil",         rank: "trained" }] } }
      ]
    }]
  },
  {
    key: "feudal", label: "Феодальный мир",
    chars: { per: 3, ws: 3, int: -3 },
    feature: {
      name: "Житие тяжкое",
      desc: "Персонаж получает +1 к S.b. для расчёта своей грузоподъёмности."
    },
    carryBonus: 1
  },
  {
    key: "research", label: "Исследовательская станция",
    chars: { per: 3, int: 3, fel: -3 },
    feature: {
      name: "Погоня за знаниями",
      desc: "Выберите Int.b × 2 специализаций из Scholastic Lore и Forbidden Lore. Эти специализации в Навыках всегда считаются Дружественными при покупке за опыт."
    },
    choices: [{
      key: "research-lore", label: "Погоня за знаниями", type: "many",
      countFormula: "intBonus2",
      hint: "Число специализаций равно удвоенному бонусу Интеллекта. Отмеченные всегда считаются Дружественными при покупке за опыт.",
      groups: ["scholasticLore", "forbiddenLore"],
      // Результат кладётся в system.homeworld.friendlySpecs — его читает расчёт цены.
      target: "friendlySpecs"
    }]
  },
  {
    key: "prison", label: "Мир-тюрьма",
    chars: { fel: 3, ag: 3, t: -3 },
    feature: {
      name: "Палец на Пульсе",
      desc: "Персонаж инстинктивно распознаёт, кто главный, а кого стоит бояться. Начинает с первым рангом в Common Lore (Crime) и Scrutiny, Forbidden Lore (Pirates или Underworld), а также получает талант Peers (Criminals или Pirates)."
    },
    grants: {
      skills: [{ key: "scrutiny", rank: "knows" }],
      groupSkills: [{ group: "commonLore", specialty: "Crime", rank: "knows" }]
    },
    choices: [
      { key: "prison-lore", label: "Forbidden Lore", type: "one",
        hint: "Выберите специализацию Запретных знаний.",
        options: [
          { label: "Forbidden Lore (Pirates)",    grants: { groupSkills: [{ group: "forbiddenLore", specialty: "Pirates",    rank: "knows" }] } },
          { label: "Forbidden Lore (Underworld)", grants: { groupSkills: [{ group: "forbiddenLore", specialty: "Underworld", rank: "knows" }] } }
        ]
      },
      { key: "prison-peers", label: "Талант Peers", type: "one",
        hint: "Выберите, среди кого персонаж свой.",
        options: [
          { label: "Peers (Criminals)", grants: { talents: ["Peers (Criminals)"] } },
          { label: "Peers (Pirates)",   grants: { talents: ["Peers (Pirates)"] } }
        ]
      }
    ]
  },
  {
    key: "agri", label: "Агромир",
    chars: { fel: 3, s: 3, ag: -3 },
    feature: {
      name: "Сила земли",
      desc: "Персонаж начинает игру с чертой Brutal Charge (2) и +2 Ранами."
    },
    grants: {
      traits: [{ name: "Brutal Charge", rating: 2, hasRating: true }],
      wounds: 2
    }
  },
  {
    key: "quarantine", label: "Карантинный мир",
    chars: { bs: 3, int: 3, s: -3 },
    feature: {
      name: "Скрытный от природы",
      desc: "Те, кто смогли покинуть карантинные миры, первым делом учатся хранить секреты. Персонаж начинает игру с навыками Stealth, Deceive и талантом Light Sleeper."
    },
    grants: {
      skills: [{ key: "stealth", rank: "knows" }, { key: "deceive", rank: "knows" }],
      talents: ["Light Sleeper"]
    }
  },
  {
    key: "imperial", label: "Имперский мир",
    chars: { wp: 3, per: 3, int: -3 },
    feature: {
      name: "Благословенное Невежество",
      desc: "Когда персонаж получает Порчу от моральных или интеллектуальных причин, он может уменьшить её на 1 (до минимума в 1)."
    },
    corruptionReduce: { value: 1, min: 1 }
  },
  {
    key: "fortress", label: "Мир-крепость",
    chars: { bs: 3, wp: 3, fel: -3 },
    feature: {
      name: "Бесконечные враги",
      desc: "Получите Hatred (выбрать), с которыми связан мир-крепость, и это работает также на стрелковых навыках."
    },
    choices: [{
      key: "fortress-hatred", label: "Hatred", type: "text",
      hint: "Укажите, кого ненавидит персонаж — с этим врагом связан его мир-крепость.",
      placeholder: "Например: Ork, Chaos, Xenos",
      talentTemplate: "Hatred ({v})"
    }]
  },
  {
    key: "cemetery", label: "Мир-кладбище",
    chars: { fel: 3, wp: 3, per: -3 },
    feature: {
      name: "Абсолютная вера в прошлое",
      desc: "Персонаж один раз за столкновение может потратить очко Бесчестья после того, как не прошёл тест на Страх, чтобы считать его пройденным с 1 степенью успеха, но при этом получает 1 очко Порчи."
    },
    rollMods: [{
      key: "cemetery-fear", when: { kind: "fear" }, value: 0,
      label: "Абсолютная вера в прошлое: потратить ОБ — провал считается успехом с 1 СУ (+1 Порчи)",
      note: "Один раз за столкновение.",
      fearSave: true
    }]
  },
  {
    key: "station", label: "Космическая станция",
    chars: { per: 3, int: 3, fel: -3 },
    feature: {
      name: "Никто не говорит по-другому",
      desc: "Персонаж получает Good Reputation (выбрать), связанный с тем, кто владел станцией."
    },
    choices: [{
      key: "station-rep", label: "Good Reputation", type: "text",
      hint: "Укажите, среди кого у персонажа доброе имя — по прежнему владельцу станции.",
      placeholder: "Например: Adeptus Mechanicus, Rogue Traders",
      talentTemplate: "Good Reputation ({v})"
    }]
  },
  {
    key: "cardinal", label: "Кардинальский мир",
    chars: { fel: 3, wp: 3, per: -3 },
    feature: {
      name: "Священное Воспитание",
      desc: "Персонаж начинает с одним рангом в навыках Common Lore (Ecclesiarchy, Adepta Sororitas) и талантом Peer (Adeptus Sororitas); либо с Common Lore (Chaos), Linguistics (Chaos Glyphs) и Inf +3."
    },
    choices: [{
      key: "cardinal-path", label: "Священное Воспитание", type: "one",
      hint: "Выберите, как персонажа воспитали.",
      options: [
        { label: "Экклезиархия: Common Lore (Ecclesiarchy), Common Lore (Adepta Sororitas), талант Peer (Adeptus Sororitas)",
          grants: {
            groupSkills: [
              { group: "commonLore", specialty: "Ecclesiarchy",     rank: "knows" },
              { group: "commonLore", specialty: "Adepta Sororitas", rank: "knows" }
            ],
            talents: ["Peer (Adeptus Sororitas)"]
          } },
        { label: "Хаос: Common Lore (Chaos), Linguistics (Chaos Glyphs), Inf +3",
          grants: {
            groupSkills: [
              { group: "commonLore",  specialty: "Chaos",       rank: "knows" },
              { group: "linguistics", specialty: "Chaos Glyphs", rank: "knows" }
            ],
            chars: { inf: 3 }
          } }
      ]
    }]
  },
  {
    key: "warzone", label: "Военная зона",
    chars: { ag: 3, per: 3, t: -3 },
    feature: {
      name: "Выживание среди убийц",
      desc: "Выполняя одиночную атаку, персонаж может изменить результат определения места попадания, увеличив или уменьшив результат до своего A.b."
    },
    rollMods: [{
      key: "warzone-hitloc", when: { kind: "attack", single: true }, value: 0,
      label: "Выживание среди убийц: сдвинуть место попадания до A.b",
      hitLocShift: true
    }]
  },
  {
    key: "daemonic", label: "Демонический мир",
    chars: { wp: 3, per: 3, fel: -3 },
    feature: {
      name: "Варп-чутьё",
      desc: "Персонаж получает Psyniscience +0 (даже без трейта Psyker, но в этом случае навык нельзя прокачивать) и 1d10 очков Порчи."
    },
    grants: {
      skills: [{ key: "psyniscience", rank: "knows" }],
      corruptionRoll: "1d10"
    }
  },
  {
    key: "mining", label: "Добывающий мир",
    chars: { s: 3, t: 3, fel: -3 },
    feature: {
      name: "Потом и кровью",
      desc: "Персонаж начинает получать штрафы за Усталость лишь накопив T.b Усталости."
    },
    fatigueGrace: "tBonus"
  },
  {
    key: "schola", label: "Схола Прогениум",
    chars: { wp: 3, fel: -3 },
    charChoice: {
      label: "Схола Прогениум",
      hint: "Выберите, к чему персонажа готовили.",
      options: [
        { label: "WS +3", chars: { ws: 3 } },
        { label: "BS +3", chars: { bs: 3 } }
      ]
    },
    feature: {
      name: "Закалка",
      desc: "Персонаж ополовинивает любые действующие на него штрафы к тестам W (Силы Воли)."
    },
    rollMods: [{
      key: "schola-halve", when: { kind: "skill", char: "wp" }, value: 0,
      label: "Закалка: ополовинить штраф к тесту W",
      halvePenalty: true
    }]
  },
  {
    key: "hellforge", label: "Адская кузня",
    chars: { int: 3, t: 3, wp: -3 },
    feature: {
      name: "Дым сожжённых душ",
      desc: "Персонаж с адской кузни получает 1к5 очков Порчи и может перебрасывать неуспешные проверки Страха от демонических существ."
    },
    grants: { corruptionRoll: "1d5" },
    rollMods: [{
      key: "hellforge-fear", when: { kind: "fear" }, value: 0,
      label: "Дым сожжённых душ: переброс провала Страха от демонического существа",
      fearReroll: true
    }]
  },
  {
    key: "pleasure", label: "Мир удовольствий",
    chars: { fel: 3, ag: 3, wp: -3 },
    feature: {
      name: "Нега разума",
      desc: "Персонаж получает +10 на Подавление Травм и Расстройств и на тесты Зависимости."
    },
    rollMods: [{
      key: "pleasure-suppress", when: { kind: "skill", suppression: true, addiction: true }, value: 10,
      label: "Нега разума: Подавление Травм / тест Зависимости (+10)"
    }]
  },
  {
    key: "industrial", label: "Промышленный мир",
    chars: { int: 3, ag: 3, t: -3 },
    feature: {
      name: "Ну-ка вместе",
      desc: "Персонаж может становиться дополнительным помощником или ассистентом сверх максимального значения для теста."
    }
  }
];

export const HOMEWORLD_BY_KEY = Object.fromEntries(HOMEWORLDS.map(h => [h.key, h]));

/** Порядок характеристик для читаемой подписи модификаторов. */
const CHAR_ABBR = { ws: "WS", bs: "BS", s: "S", t: "T", ag: "A", int: "I", per: "P", wp: "W", fel: "F", inf: "Inf" };

/** «+3 S, +3 T, −3 F» — подпись модификаторов мира для списка и карточки. */
export function charModLabel(chars = {}) {
  return Object.entries(chars)
    .map(([k, v]) => `${v >= 0 ? "+" : "−"}${Math.abs(v)} ${CHAR_ABBR[k] || k.toUpperCase()}`)
    .join(", ");
}

/** Есть ли у мира выборы, требующие диалога. */
export function hasChoices(hw) {
  return !!(hw?.charChoice || (hw?.choices || []).length);
}

/**
 * Ситуативные модификаторы Особенности для конкретного броска.
 * Возвращает записи для галочек в диалоге; выбор — за игроком.
 *
 * @param {string} key      ключ родного мира персонажа
 * @param {object} context  { kind, skill, group, specialty, char, suppression, addiction, single, ranged }
 */
export function homeworldRollMods(key, context = {}) {
  const hw = HOMEWORLD_BY_KEY[key];
  if (!hw?.rollMods?.length) return [];
  return hw.rollMods.filter(m => matchesContext(m.when, context))
    .map(m => ({ ...m, world: hw.label, feature: hw.feature.name }));
}

// Матчер живёт в rules/match-context.mjs; здесь остаётся реэкспорт, чтобы
// прежние импорты из этого файла (sheets/actor-sheet.mjs) продолжали работать.
export { matchesContext };
