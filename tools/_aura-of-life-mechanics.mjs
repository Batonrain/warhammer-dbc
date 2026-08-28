// tools/_aura-of-life-mechanics.mjs — «Аура Жизни» уже даёт себе Regeneration(1)
// через kind:"trait"; добавляет kind:"aura" (module/regions/auras.mjs), чтобы
// та же Regeneration(1) реально расходилась на союзников И врагов в радиусе 3м
// (текст: «Он и все живые существа в радиусе 3м от него (в т.ч. враги)»).
// includesSelf:false — себя уже покрывает существующая trait-запись, дублировать
// выдачу через оба пути незачем. Одноразовый — можно удалить после запуска.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

const file = "packs-src/mutations/Общие_мутации/Aura_of_Life___Аура_Жизни_nK3EY3Iv0oMqD3XL.json";
const doc = JSON.parse(fs.readFileSync(file, "utf8"));

const entry = blankMechEntry("aura");
entry.id = "aura-regen-radius";
entry.auraRadius = "3";
entry.auraAffects = "all";
entry.auraIncludesSelf = false;
entry.sourceUuid = "Compendium.warhammer-dbc.traits.Item.6cf11ucGdzYt6ndt";
entry.sourceName = "Regeneration / Регенерация (X)";
entry.sourceImg = "systems/warhammer-dbc/assets/item-icons/trait.svg";
entry.sourceHasRating = true;
entry.rating = "1";

const group = blankMechGroup("AND");
group.entries = [entry];

doc.flags["warhammer-dbc"].mechanics.push(group);
fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
console.log("OK:", file);
