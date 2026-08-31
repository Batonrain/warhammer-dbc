// tools/_g53k-quickwin1.mjs — wdbc-g53k, первая точечная находка: Chaotic
// Pattern / Хаотичный паттерн — единственный чистый testMod-кандидат,
// найденный после честного прогона по всем 1251 неавтоматизированным
// Талантам (regex по названиям Навыков + числу, длина текста < 160 — см.
// заметку в тикете). Одноразовый скрипт.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

const file = "packs-src/talents/Книга_Пустоты/Пустотный_Волк/Chaotic_Pattern___Хаотичный_паттерн_xd6VbNcsyHHGOoaD.json";
const doc = JSON.parse(fs.readFileSync(file, "utf8"));
const entry = blankMechEntry("testMod");
entry.modScope = "skill";
entry.skillKey = "dodge";
entry.modValueMode = "flat";
entry.value = 10;
entry.label = "Хаотичный паттерн (Уклонение)";
const group = blankMechGroup("AND");
group.entries = [entry];
doc.flags ??= {};
doc.flags["warhammer-dbc"] ??= {};
doc.flags["warhammer-dbc"].mechanics = [group];
fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
console.log("OK:", file);
