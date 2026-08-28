// tools/_mutation-mechanics-batch2.mjs — вторая партия Механики для Мутаций
// (продолжение tools/_mutation-mechanics-pilot.mjs, см. чат: «оформи в
// механику все мутации»). Пять записей с чистыми, теперь ещё и формульными
// (mech-formula.mjs) параметрами. Одноразовый — можно удалить после запуска.
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

const patches = [
  {
    file: "packs-src/mutations/Общие_мутации/Carapace___Панцирь_2n52RpWDImyz3Ev1.json",
    // Natural Armour (½Cor.b, окр.▲) — ровно то, что теперь умеет формула.
    groups: [{ entries: [
      traitEntry({ id: "carapace-armour", uuid: "bvO8S59a6fOSBXcK", name: "Natural Armour / Естественная Броня (X)", rating: "ceil(cor/2)" })
    ] }]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Aura_of_Life___Аура_Жизни_nK3EY3Iv0oMqD3XL.json",
    // Regeneration (1) — только САМ персонаж; ауру на живых существ в 3м
    // (в т.ч. врагов) Механика выдать не может (нет вида записи «аура на
    // окружающих») — не кодируется, остаётся в тексте.
    groups: [{ entries: [
      traitEntry({ id: "aura-regen", uuid: "6cf11ucGdzYt6ndt", name: "Regeneration / Регенерация (X)", rating: 1 })
    ] }]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Wings___Крылья_PSfNZryIyip09eYj.json",
    // Flyer (A.b×2) — формула. Естественная броня крыльев «как у брони торса
    // на момент получения» (снимок чужого состояния в момент выдачи) и запрет
    // летать на месте без движения 3м/Ход — вне полей Конструктора, не кодируются.
    groups: [{ entries: [
      traitEntry({ id: "wings-flyer", uuid: "6PG9FuSMS13O6Ou8", name: "Flyer / Летун (X)", rating: "ag*2" })
    ] }]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Strange_Hands___Странные_Руки_ApXVLD3qzW9ngnuC.json",
    // Multiple Arms (+2) — фиксированный рейтинг из текста. «Ограниченный
    // функционал» рук — по решению ГМа, не число, не кодируется.
    groups: [{ entries: [
      traitEntry({ id: "strange-hands-arms", uuid: "b2B8zxbhoK961wEf", name: "Multiple Arms / Многорукий (X)", rating: 2 })
    ] }]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Wyrd___Вирд_SM4kdBGwHqfSFPO3.json",
    // Trait Psyker (без рейтинга — им и в компендиуме не параметрируется).
    // «Стартует с PR 0», «Несвязанный», случайный фокус дисциплины — это уже
    // не про Черту, а про system.psyker.currentRating/unbound и рандомный
    // выбор из списка — вне текущих видов записи Конструктора, не кодируются.
    groups: [{ entries: [
      traitEntry({ id: "wyrd-psyker", uuid: "ptoBb9NH6g51SfJD", name: "Psyker / Псайкер" })
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
