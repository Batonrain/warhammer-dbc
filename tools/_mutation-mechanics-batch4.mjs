// tools/_mutation-mechanics-batch4.mjs — четвёртая партия Механики для Мутаций
// (продолжение batch3, см. чат: «оформи в механику все мутации»).
// Одноразовый — можно удалить после запуска.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

const TRAIT_ICON = "systems/warhammer-dbc/assets/item-icons/trait.svg";

function traitEntry({ id, uuid, name, rating = "" }) {
  const e = blankMechEntry("trait");
  e.id = id;
  e.sourceUuid = `Compendium.warhammer-dbc.traits.Item.${uuid}`;
  e.sourceName = name;
  e.sourceImg = TRAIT_ICON;
  e.sourceHasRating = rating !== "";
  e.rating = String(rating);
  return e;
}

function charEntry({ id, charKey, field, op, value }) {
  const e = blankMechEntry("characteristic");
  e.id = id; e.charKey = charKey; e.field = field; e.op = op; e.value = String(value);
  return e;
}

function woundsEntry({ id, op, value }) {
  const e = blankMechEntry("wounds");
  e.id = id; e.op = op; e.woundsValue = String(value);
  return e;
}

function skillEntry({ id, skillScope, skillKey, specialty, rank }) {
  const e = blankMechEntry("skill");
  e.id = id; e.skillScope = skillScope; e.skillKey = skillKey; e.specialty = specialty; e.rank = rank;
  return e;
}

const patches = [
  {
    file: "packs-src/mutations/Общие_мутации/Eye_Stalks___Глаза_Стебельки_loevdqDGs1X0MtBS.json",
    // «+10 к P» — прямое число. Обзор назад, несовместимость с Авточувствами
    // и сниженный штраф по глазам (−35 вместо −50) — вне полей Конструктора.
    groups: [{ entries: [
      charEntry({ id: "eyestalks-per", charKey: "per", field: "total", op: "add", value: 10 })
    ] }]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Faceless___Безликий_NEtQxwEoOSOEaJeI.json",
    // Один язык жестов «приходит в разум из Варпа» — Навык знает сразу.
    // Потеря еды/питья/речи и обучение других за неделю — не кодируются.
    groups: [{ entries: [
      skillEntry({ id: "faceless-signlang", skillScope: "group", skillKey: "linguistics", specialty: "Sign Language / Язык Жестов", rank: "knows" })
    ] }]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Flayed___Освежеванный_tYexhV8bV5fx01XG.json",
    // «Уменьшает максимум Ран на 5» — прямое число. Способность свежевать
    // других и надевать их кожу — активная способность, не кодируется.
    groups: [{ entries: [
      woundsEntry({ id: "flayed-wounds", op: "subtract", value: 5 })
    ] }]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Pseudo_Daemonhood___Псевдо_Демоничество_KLTsML2X6ZiHNHZF.json",
    // Daemonic(+3), Stuff of Nightmares, Warp Instability, +7 Ран — все
    // прямые числа/готовые Черты из текста. Отношения с демонами рангом ниже
    // Герольда, Чудесное Спасение при изгнании и ритуал возвращения —
    // ситуативные и не кодируются.
    groups: [{ entries: [
      traitEntry({ id: "pseudo-daemonic", uuid: "brwXUX5nKFR5tOjG", name: "Daemonic / Демонический (X)", rating: 3 }),
      traitEntry({ id: "pseudo-nightmares", uuid: "njhMytZB06EWtsQA", name: "Stuff of Nightmares / Существо из Кошмаров" }),
      traitEntry({ id: "pseudo-instability", uuid: "l4RbSuAxAyVFZCdS", name: "Warp Instability / Варп-Нестабильность" }),
      woundsEntry({ id: "pseudo-wounds", op: "add", value: 7 })
    ] }]
  }
];

for (const patch of patches) {
  const raw = fs.readFileSync(patch.file, "utf8");
  const doc = JSON.parse(raw);
  const groups = patch.groups.map(g => {
    const grp = blankMechGroup("AND");
    grp.entries = g.entries;
    if (g.when) for (const e of grp.entries) e.when = g.when;
    return grp;
  });
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].mechanics = groups;
  fs.writeFileSync(patch.file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK:", patch.file);
}
