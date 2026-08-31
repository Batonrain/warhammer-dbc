// tools/_gift-mechanics-batch3.mjs — третья партия Механики для Даров Богов
// (продолжение batch1/2, см. чат: «оформи в механику все мутации»).
// Одноразовый — можно удалить после запуска.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

function skillEntry({ id, skillKey, specKey, specialty, rank }) {
  const e = blankMechEntry("skill");
  e.id = id; e.skillScope = "group"; e.skillKey = skillKey;
  e.specKey = specKey; e.specialty = specialty; e.rank = rank;
  return e;
}

const patches = [
  {
    file: "packs-src/mutations/Дары_Богов/Слаанеш/Gift_of_Gluttony___Дар_Чревоугодия_VvnR2ZnywzPTYs8d.json",
    // «Если ещё не имел — получает Trade (Cook)+20». kind:"skill" уже сам не
    // понижает существующий более высокий Навык (skillGrantOutcome,
    // rules/duplicate-grants.mjs) — «если не было» естественно выходит из
    // сравнения с текущим рангом. Поедание Best.Q чемпиона ради Очков
    // Бесчестия — активная способность, не кодируется.
    groups: [{ entries: [
      skillEntry({ id: "gluttony-cook", skillKey: "trade", specKey: "cook", specialty: "Повар", rank: "veteran" })
    ] }]
  },
  {
    file: "packs-src/mutations/Дары_Богов/Кхорн/Deathsmith___Кузнец_Смерти_iRJOxDNetPKyZXtj.json",
    // «Получает Навык Trade (Weaponsmith), ИЛИ +10, если уже владел» —
    // приближено рангом «Тренированное» (+10): не владел — получает эту
    // ступень; владел ниже — поднимается; владел выше — запись не понижает
    // (skillGrantOutcome), что не точно бьёт с «+10 от текущего», но ближе
    // всего из того, что даёт Конструктор без script. +30 и вдвое быстрее на
    // крафт/ремонт РУКОПАШНОГО оружия — узкая область теста, не кодируется.
    groups: [{ entries: [
      skillEntry({ id: "deathsmith-weaponsmith", skillKey: "trade", specKey: "weaponsmith", specialty: "Оружейник", rank: "trained" })
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
