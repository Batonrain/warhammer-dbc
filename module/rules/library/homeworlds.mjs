// module/rules/library/homeworlds.mjs
//
// Машинная часть Особенностей Происхождений. Текст Особенности остаётся в
// constants/homeworlds.mjs (поле `feature`) — игрок читает описание, система
// применяет правило. Формат записи — docs/rules-format.md.
//
// Здесь только те Особенности, которые нельзя выразить ни модификатором
// характеристики, ни выдачей навыка, ни галочкой в диалоге: они вмешиваются в
// работу системы в конкретной точке — при трате Очка, при наборе помощников,
// в окне атаки ПО НОСИТЕЛЮ, в карточке проваленного Страха. Каждая объявляет
// возможность (`grantFlag`), а точка системы её спрашивает через
// `hasRuleFlag()`. Прежде это делалось именованными ключами со своим сканом
// предметов (ветка «Конструктор-и-происхождения», kind:"specialRule") — теперь
// тем же механизмом, что и остальные правила.
//
// Условие `when` у этих правил пустое: правила приходят от источника
// «homeworld» (rules/sources.mjs), а он уже выбирает их по Происхождению
// актора. Дублировать проверку в данных незачем — она бы разошлась с
// источником при первой правке.

/** Мир-храм, «Пламенная вера»: 1d10 при трате Очка, при 1 очко не тратится. */
export const TEMPLE_RULES = [
  {
    id: "homeworld.temple.fireOfFaith",
    label: "Пламенная вера",
    effects: [{ kind: "grantFlag", target: "fate.save" }]
  }
];

/** Мир смерти, «Паранойя Выжившего»: по нему не работает «Цель Врасплох». */
export const DEATH_RULES = [
  {
    id: "homeworld.death.survivorParanoia",
    label: "Паранойя Выжившего",
    effects: [{ kind: "grantFlag", target: "attack.surpriseImmune" }]
  }
];

/** Промышленный мир, «Ну-ка вместе»: помогает сверх лимита помощников. */
export const INDUSTRIAL_RULES = [
  {
    id: "homeworld.industrial.allTogether",
    label: "Ну-ка вместе",
    effects: [{ kind: "grantFlag", target: "assist.beyondCap" }]
  }
];

/** Мир-кладбище, «Абсолютная вера в прошлое»: Очко за провал теста Страха. */
export const CEMETERY_RULES = [
  {
    id: "homeworld.cemetery.faithInThePast",
    label: "Абсолютная вера в прошлое",
    effects: [{ kind: "grantFlag", target: "fear.faithInThePast" }]
  }
];
