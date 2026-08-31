// module/constants/craft.mjs
// Данные и движок системы Крафта и Исследований (Warhammer DBC).
//
// Крафт — расширенный тест. Сложность считается из Редкости (как реквизиция)
// и Качества; Банк Успехов зависит от категории/размера (ориентир, правит ГМ)
// и множится по Качеству. Навык определяется категорией предмета; при Trade
// прочие навыки крафта получают +10, Знания +20; при Tech-Use/Medicae Знания +10.
// Инструменты дают модификатор ко всем навыкам комбинированного теста.
//
// Все числа — ориентир и правятся в окне (решение всегда за ГМом).

import { SKILLS_DEF, GROUP_SKILLS_DEF } from "./skills.mjs";
import { SKILL_RANKS } from "./characteristics.mjs";

// Порядок Редкости для выпадающего списка: −5..+5, 0 по центру.
export const RARITY_ORDER = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];

// ── Качество: множитель Банка + модификатор сложности ───────────────────────
export const CRAFT_QUALITY = {
  poor:   { label: "Низкое (Poor.Q)",   bankMult: 0.25, diff:  10 },
  common: { label: "Обычное (Comm.Q)",  bankMult: 1,    diff:   0 },
  good:   { label: "Хорошее (Good.Q)",  bankMult: 4,    diff: -10 },
  best:   { label: "Высшее (Best.Q)",   bankMult: 14,   diff: -30 }
};

// ── Редкость → модификатор сложности (как реквизиция). Правится в окне. ──────
export const RARITY_LABELS = {
  "-5": "Повсеместно", "-4": "Распространено", "-3": "Изобильно", "-2": "Обычно",
  "-1": "Средне", "0": "Дефицит", "1": "Редко", "2": "Очень редко",
  "3": "Чрезвычайно редко", "4": "Почти уникально", "5": "Уникально"
};
export function rarityDiff(r) { return -10 * Number(r || 0); }

// ── Инструменты (модификатор ко всем навыкам крафта) ────────────────────────
export const CRAFT_TOOLS = [
  { key: "none",    mod: -30, label: "Совсем без инструментов",  note: "Топор без инструментов, дом голыми руками." },
  { key: "improv",  mod: -20, label: "Импровизированные",        note: "Ковка молотом на костре, химикаты на кухне." },
  { key: "primit",  mod: -10, label: "Примитивные",              note: "Инструменты дикого мира / из мусора." },
  { key: "common",  mod:   0, label: "Обычные",                  note: "Стандартный набор." },
  { key: "good",    mod: +10, label: "Качественные (Good.Q)",    note: "Плазменная кузница, полноценная лаборатория." },
  { key: "best",    mod: +20, label: "Очень качественные (Best.Q)", note: "Полевая кузница Механикум, Апотекарион." },
  { key: "master",  mod: +30, label: "Мастерский комплект",      note: "Стационарная/корабельная кузница Механикум." }
];

// ── Категории предметов: навыки крафта (req) и навыки исследования (research) ─
// req: массив требований. Каждое: {skill:"techUse"} или {group:"trade", spec:"Weaponsmith"}.
// alt (строка) — примечание об альтернативном Знании. baseBank — ориентир Банка.
const S  = (skill) => ({ skill });
const G  = (group, spec) => ({ group, spec });

// Категории по «первой таблице» (Банки Успехов по Категории × Редкости), с
// корректным маппингом Навыков из «второй таблицы». banks = [<0, 0, 1, 2, 3, 4, 5];
// null = «–» (не создаётся при этой Редкости). machine=true — примечание ×(Размер+1).
const C = (key, label, icon, req, banks, extra = {}) => ({ key, label, icon, req, banks, ...extra });

export const CRAFT_CATEGORIES = [
  C("improv",     "Оружие/ловушки из подручных", "improv",  [ S("survival") ],                                                   [4, 6, 8, null, null, null, null]),
  C("explosive",  "Взрывчатка",                  "explosive", [ S("techUse") ],                                                [4, 6, 10, 20, 40, 90, 200]),
  C("primWeapon", "Примитивное оружие",          "primWeapon",   [ G("trade", "Weaponsmith") ],                                       [5, 10, 20, null, null, null, null]),
  C("firearm",    "Огнестрельное оружие",        "firearm",   [ G("trade", "Weaponsmith") ],                                       [10, 15, 30, 55, 100, 250, 750]),
  C("bolt",       "Болт-оружие",                 "bolt",  [ G("trade", "Weaponsmith"), S("techUse"), G("forbiddenLore", "Mechanicum") ], [null, null, 40, 75, 200, 700, 2000], { alt: "For.Lore (Mechanicum или Astartes)" }),
  C("lasPlasma",  "Лаз, Плазма, Мельта",         "lasPlasma",[ G("trade", "Weaponsmith"), S("techUse"), G("forbiddenLore", "Mechanicum") ], [20, 20, 30, 75, 250, 1000, 2300], { alt: "Лаз — без For.Lore" }),
  C("flamer",     "Огнемёты",                    "flamer",   [ G("trade", "Weaponsmith"), S("techUse") ],                         [10, 10, 20, 40, 80, 200, 700]),
  C("launcher",   "Пусковые установки",          "launcher", [ G("trade", "Weaponsmith"), S("techUse") ],                     [5, 10, 20, 45, 90, 220, 700]),
  C("grenade",    "Гранаты и ракеты",            "grenade",[ G("trade", "Weaponsmith"), S("techUse") ],                        [2, 4, 8, 15, 30, 90, 250]),
  C("mechWeapon", "Оружие Механикум",            "mechWeapon",  [ G("trade", "Weaponsmith"), S("techUse"), G("forbiddenLore", "Mechanicum") ], [null, 25, 50, 100, 300, 1000, 2000]),
  C("ammo",       "Боеприпасы",                  "ammo",  [ G("trade", "Weaponsmith") ],                                       [1, 2, 4, 10, 20, 60, 120]),
  C("chainShock", "Пило и Шоковое оружие",       "chainShock", [ G("trade", "Weaponsmith"), S("techUse") ],                         [15, 15, 30, 55, 100, 250, 750]),
  C("powerWeapon","Силовое оружие",              "powerWeapon", [ G("trade", "Weaponsmith"), S("techUse"), G("forbiddenLore", "Mechanicum") ], [null, null, null, 75, 200, 700, 2000]),
  C("psychicW",   "Психосиловое оружие",         "psychicW",[ G("trade", "Weaponsmith"), G("forbiddenLore", "Warp") ],          [null, null, null, null, 400, 1000, 2300]),
  C("weaponMod",  "Модификации оружия",          "weaponMod",   [ G("trade", "Weaponsmith"), S("techUse") ],                         [5, 10, 15, 30, 70, 160, 500]),
  C("armor",      "Броня",                       "armor", [ G("trade", "Armourer") ],                                          [10, 20, 40, 80, 150, 500, 1500]),
  C("powerArmor", "Силовая броня",               "powerArmor", [ G("trade", "Armourer"), S("techUse") ],                       [null, null, null, 100, 250, 900, 2500]),
  C("exoSuit",    "Экзо-Костюмы / Терминаторская","exoSuit", [ G("trade", "Armourer"), S("techUse"), G("forbiddenLore", "Mechanicum") ], [null, null, null, 200, 500, 1800, 5000]),
  C("armorMod",   "Модификации брони",           "armorMod",   [ G("trade", "Armourer"), S("techUse") ],                            [5, 10, 20, 40, 100, 300, 700]),
  C("systems",    "Системы",                     "systems",[ S("techUse"), G("forbiddenLore", "Mechanicum") ],                  [null, 20, 40, 75, 150, 500, 800]),
  C("shield",     "Силовые щиты",                "shield", [ S("techUse"), G("forbiddenLore", "Archeotech") ],             [null, null, null, 80, 200, 700, 2000], { alt: "Технолог.: Archeotech/Mechanicum · Чародейские: Schol.Lore(Occult)+For.Lore(Heresy/Warp)" }),
  C("gear",       "Снаряжение",                  "gear", [ S("techUse") ],                                                 [5, 10, 20, 30, 60, 150, 600]),
  C("tools",      "Инструменты",                 "tools", [ S("techUse") ],                                                    [2, 5, 10, 30, 80, 250, 600]),
  C("bionics",    "Бионика и Мехадендриты",      "bionics",[ S("techUse"), G("forbiddenLore", "Mechanicum") ],                 [null, 15, 25, 50, 120, 320, 750]),
  C("cyber",      "Кибернетика",                 "cyber",[ S("techUse"), G("forbiddenLore", "Mechanicum") ],                 [null, 20, 35, 70, 150, 400, 1000]),
  C("chem",       "Химия (наркотики и яды)",     "chem",  [ G("trade", "Chymist") ],                                           [1, 2, 4, 10, 20, 60, 120]),
  C("wheeled",    "Колёсные машины",             "wheeled",[ G("trade", "Engineer") ],                                         [30, 40, 60, 100, 200, 350, 700], { machine: true }),
  C("tracked",    "Гусеничные машины",           "tracked",[ G("trade", "Engineer") ],                                         [40, 80, 120, 180, 300, 400, 800], { machine: true }),
  C("walker",     "Шагоходы",                    "walker",[ G("trade", "Engineer") ],                                         [null, 100, 140, 200, 350, 500, 1000], { machine: true }),
  C("flyer",      "Самолёты",                    "flyer",[ G("trade", "Engineer") ],                                         [null, 200, 300, 400, 600, 1000, 1500], { machine: true }),
  C("skimmer",    "Скиммеры",                    "skimmer",[ G("trade", "Engineer") ],                                         [null, null, null, 700, 1200, 2000, 3500], { machine: true }),
  C("demonHull",  "Оболочки демонических машин", "demonHull", [ G("trade", "Engineer"), G("forbiddenLore", "Warp") ],              [15, 10, 20, 50, 100, 175, 350])
];

// Банк из таблицы по Редкости. bucket: r<0 → индекс 0, r 0..5 → r+1. null = не создаётся.
export function bankFromTable(category, rarity) {
  if (!category?.banks) return null;
  const r = Number(rarity || 0);
  const idx = r < 0 ? 0 : Math.min(6, r + 1);
  const v = category.banks[idx];
  return (v === null || v === undefined) ? null : v;
}

export const RESEARCH_KINDS = [
  { key: "blueprint", label: "Чертёж / рецепт для крафта" },
  { key: "psychic",   label: "Психосила / ритуал / вязь" },
  { key: "truename",  label: "Истинное имя демона" },
  { key: "lore",      label: "Изучение (обоснование Знаний)" },
  { key: "other",     label: "Иное знание" }
];

// ── Материалы (справочно) ───────────────────────────────────────────────────
export const CRAFT_MATERIALS = [
  { r: -3, name: "Рокрит",         desc: "Стройматериал-пенобетон; строительство и кораблестроение." },
  { r: -3, name: "Пластек",        desc: "Лёгкий прочный полимер; почти всё, флак-броня." },
  { r: -2, name: "Пласталь",       desc: "Прочный сплав железа; каркасы, листы брони, панцирь." },
  { r: -1, name: "Керамит",        desc: "Жароустойчивый композит; силовая броня, обшивка." },
  { r: -1, name: "Латейская Сталь", desc: "Сталь с адамантием в 0-G; клинки, пило-оружие." },
  { r: -1, name: "Телдрит",        desc: "Жидкий металл; компенсаторы отдачи танков." },
  { r:  0, name: "Диамантин",      desc: "Твёрдый органик (зубы/когти ксеносов); укрепление." },
  { r:  1, name: "Адамантин",      desc: "Прочный лёгкий металл; терминаторская броня, щиты." },
  { r:  2, name: "Психокристаллы", desc: "Формируются в местах пси-резонанса; пси-технологии." },
  { r:  3, name: "Ноктилит",       desc: "Ковкий в магнитном поле; подавление/усиление Варпа." }
];

// ── Разрешение навыка крафтера ──────────────────────────────────────────────
// req: {skill} или {group,spec}. Возвращает {label, total, trained, char}.
export function reqSkillLabel(req) {
  if (req.skill) return SKILLS_DEF[req.skill]?.label || req.skill;
  const g = GROUP_SKILLS_DEF[req.group]?.label || req.group;
  return req.spec ? `${g} (${req.spec})` : g;
}
const LORE_GROUPS = ["forbiddenLore", "scholasticLore", "commonLore"];

// ── Реальные навыки крафтера для выбора вручную ─────────────────────────────
// Групповые Навыки (Ремесло/Знания) вписываются на листе со своими спец-названиями,
// поэтому крафтер выбирает конкретный Навык из того, что у него есть на самом деле.
// research=true — оставляем только Навыки исследования (Tech-Use, Medicae,
// Linguistics, Forbidden/Scholastic Lore).
// Крафт учитывает только релевантные Навыки: плоские Tech-Use/Survival/Medicae и
// групповые Ремесло + Знания. Исследование — Tech-Use/Medicae + Знания/Лингвистика.
const CRAFT_FLAT    = ["survival", "techUse", "medicae"];
const CRAFT_GROUPS  = ["trade", "forbiddenLore", "scholasticLore"];
const RESEARCH_FLAT = ["techUse", "medicae"];
const RESEARCH_GRPS = ["linguistics", "forbiddenLore", "scholasticLore"];

export function buildAvailableSkills(actor, research = false) {
  const out = [];
  const chars = actor?.system?.characteristics || {};
  const untr = (charKey) => (chars[charKey]?.total ?? 0) - 20;
  const flatOk  = research ? RESEARCH_FLAT : CRAFT_FLAT;
  const groupOk = research ? RESEARCH_GRPS : CRAFT_GROUPS;

  const rank = (r) => SKILL_RANKS[r ?? "untrained"]?.bonus ?? -20;

  for (const [key, def] of Object.entries(SKILLS_DEF)) {
    if (!flatOk.includes(key)) continue;
    const sk = actor?.system?.skills?.[key];
    out.push({ value: `skill:${key}`, label: def.label,
      total: sk?.total ?? untr(def.char), rankBonus: rank(sk?.rank),
      isLore: false, isTrade: false });
  }
  for (const [gkey, gdef] of Object.entries(GROUP_SKILLS_DEF)) {
    if (!groupOk.includes(gkey)) continue;
    const entries = Array.isArray(actor?.system?.groupSkills?.[gkey]) ? actor.system.groupSkills[gkey] : [];
    entries.forEach((e, idx) => {
      const spec = e.specialty || e.name || "—";
      out.push({ value: `group:${gkey}:${idx}`, label: `${gdef.label} (${spec})`,
        total: e.total ?? untr(e.char || gdef.char), rankBonus: rank(e.rank),
        isLore: LORE_GROUPS.includes(gkey), isTrade: gkey === "trade" });
    });
  }
  return out;
}
export function findSkillOption(available, value) { return available.find(o => o.value === value) || null; }

// Авто-подбор варианта по подсказке категории (req) из доступных навыков.
export function suggestOption(available, req) {
  if (!req) return available[0]?.value || "";
  if (req.skill) {
    const o = available.find(a => a.value === `skill:${req.skill}`);
    if (o) return o.value;
  }
  if (req.group) {
    const specLc = (req.spec || "").toLowerCase();
    const byName = available.find(a => a.value.startsWith(`group:${req.group}:`) && a.label.toLowerCase().includes(specLc));
    if (byName) return byName.value;
    const anyG = available.find(a => a.value.startsWith(`group:${req.group}:`));
    if (anyG) return anyG.value;
  }
  return available[0]?.value || "";
}

// Комбинированный тест — ОДИН Предел и ОДНА проверка. Бонусы навыков СУММИРУЮТСЯ,
// а не выбирается наименьший. Ведущий навык (наибольший total) даёт базу; остальные
// добавляют свой бонус ранга; ВСЕ вовлечённые навыки добавляют синергию крафта:
//   Trade в тесте → прочим навыкам +10, Знаниям +20; иначе Tech-Use/Medicae → Знаниям +10.
// Пример (Магос): Int 88, Tech-Use +30 (ведущий=118), Знание Mechanicum ранг +0 но синергия
// +10 → 118 + 0 + 10 = 128 (а не min(118, 98)=98). Редкость/Качество к броску не влияют.
// mods: { toolMod, gmMod, improveMod }
export function computeCombined(selectedOpts, mods) {
  const opts = selectedOpts.filter(Boolean);
  const external = (mods.toolMod || 0) + (mods.gmMod || 0) + (mods.improveMod || 0);
  if (!opts.length) return { limit: null, external, rows: [] };

  const primary = opts.reduce((a, b) => (b.total > a.total ? b : a), opts[0]);
  const hasTrade   = opts.some(o => o.isTrade);
  const hasTechMed = opts.some(o => /^skill:(techUse|medicae)$/.test(o.value));
  const syn = (o) => {
    if (hasTrade) return o.isLore ? 20 : (o.isTrade ? 0 : 10);
    if (hasTechMed && o.isLore) return 10;
    return 0;
  };

  const rows = opts.map(o => {
    const s = syn(o), isPrimary = o === primary;
    return { label: o.label, total: o.total, rankBonus: o.rankBonus, synergy: s, isPrimary,
      contrib: isPrimary ? o.total + s : o.rankBonus + s };
  });
  const limit = rows.reduce((sum, r) => sum + r.contrib, 0) + external;
  return { limit, external, primary, hasTrade, hasTechMed, rows };
}

export function bankFor(baseBank, quality, improve) {
  const q = CRAFT_QUALITY[quality] || CRAFT_QUALITY.common;
  let bank = Math.round(Number(baseBank || 0) * q.bankMult);
  if (improve) bank = Math.round(bank / 2);
  return Math.max(1, bank);
}

// Степени успеха теста d100 vs target (роллер отрабатывает одну смену).
export function degreesOfSuccess(roll, target) {
  if (roll <= target) return 1 + Math.floor((target - roll) / 10);   // Успех
  return -(1 + Math.floor((roll - target) / 10));                    // Провал
}
