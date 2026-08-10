// module/constants/small-craft.mjs
// Библиотека Малых Летательных Аппаратов (МЛА / эскадрильи) для компендиума small-craft.

export const CRAFT_KINDS = {
  fighter:       "Истребитель",
  bomber:        "Бомбардировщик",
  assaultBoat:   "Штурмовая лодка",
  torpedoBomber: "Торпедоносец",
  support:       "Судно поддержки",
  aeronautica:   "Аэронавтика",
  multipurpose:  "Многоцелевой"
};

const IMG = "systems/warhammer-dbc/assets/item-icons/small-craft.svg";

// C(name, faction, kind, {cr, crAlt, spd, size, props})
const C = (name, faction, kind, o) => ({
  name, type: "smallCraft", img: IMG, folder: ["МЛА", faction],
  system: {
    craftKind: kind, faction,
    cr: o.cr ?? 0, crAlt: o.crAlt ?? 0, spd: o.spd ?? 0, squadronSize: o.size ?? 0,
    props: o.props || "", rarity: o.r ?? 0, description: o.desc || ""
  }
});

export const SMALL_CRAFT = [
  // ── Имперские ──
  C("Перехватчик «Фурия»",          "Имперские", "fighter",     { cr: 10, spd: 10, size: 20, props: "Robust Craft" }),
  C("Бомбардировщик «Звёздный Ястреб»", "Имперские", "bomber",  { cr: 0,  spd: 6,  size: 10, props: "Robust Craft" }),
  C("Штурмовая лодка «Акула»",      "Имперские", "assaultBoat", { cr: 5,  spd: 10, size: 8,  props: "Нет" }),
  // ── Хаос ──
  C("Истребитель «Быстрая Смерть»", "Хаос", "fighter",     { cr: 10, spd: 11, size: 30, props: "Fragile Craft" }),
  C("Бомбардировщик «Огонь Погибели»", "Хаос", "bomber",   { cr: 0,  spd: 7,  size: 15, props: "Fragile Craft" }),
  C("Штурмовая лодка «Клешня Страха»", "Хаос", "assaultBoat", { cr: 5, spd: 11, size: 5, props: "Нет" }),
  // ── Аэльдари ──
  C("Истребитель «Тёмная Звезда»",  "Аэльдари", "fighter", { cr: 15, spd: 12, size: 12, props: "Excellent Pilots" }),
  C("Бомбардировщик «Орёл»",        "Аэльдари", "bomber",  { cr: 6,  spd: 9,  size: 6,  props: "Excellent Pilots" }),
  // ── Рак'гол ──
  C("«Кровавый Живодёр»",           "Рак'гол", "multipurpose", { cr: 8, spd: 9, size: 15, props: "Multipurpose Craft (штурмовая лодка; истребитель, 4)" }),
  // ── Орки ──
  C("Истрибила-бамбила",            "Орки", "multipurpose", { cr: 8, crAlt: 5, spd: 8, size: 25, props: "Multipurpose Craft (истребитель; бомбардировщик, 5)" }),
  C("Штурмавыи лодки",              "Орки", "assaultBoat",  { cr: 8, spd: 10, size: 15, props: "Нет" })
];
