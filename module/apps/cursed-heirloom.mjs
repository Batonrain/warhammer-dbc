// module/apps/cursed-heirloom.mjs
// ════════════════════════════════════════════════════════════════════════
//  Проклятое Наследство — Foundry-обвязка к module/rules/cursed-heirloom.mjs.
//  Тот же приём, что apps/scrounge.mjs: kind:"script" Таланта («▶ Запустить»)
//  открывает Обозреватель компендиумов на оружие до R4, бросает d5 и
//  записывает выпавшее проклятье на СОЗДАННЫЙ предмет (flags.warhammer-dbc.
//  cursedHeirloom) — текстом, который и видит игрок/ГМ на листе предмета.
//  Разовое: один Талант — одно наследство, повторный запуск просто даёт ещё
//  одно (книга «может выбрать получить ОДНО» не запрещает купить Талант раз,
//  но и не гейтит повторный запуск нигде специально — решение не принималось
//  отдельно, идемпотентности тут нет по тому же принципу, что у Наскрести).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { openCompendiumBrowser } from "./compendium-browser.mjs";
import { CURSED_HEIRLOOM_MAX_AVAILABILITY, curseForRoll } from "../rules/cursed-heirloom.mjs";

/**
 * Кнопка Таланта: выбрать оружие до R4, бросить d5, получить проклятье.
 * @param {Actor} actor владелец Таланта
 */
export async function grantCursedHeirloom(actor) {
  if (!actor) throw new Error("Нет персонажа-владельца Таланта.");
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Проклятое Наследство" },
    content: `<p>Получить одно оружие Редкостью не выше R${CURSED_HEIRLOOM_MAX_AVAILABILITY}? Оно свяжется с судьбой персонажа (не может быть уничтожено, всегда возвращается) и получит одно из пяти проклятий по броску d5.</p>`,
    yes: { label: "Получить" }, no: { label: "Отмена" }
  });
  if (!ok) throw new Error("Отменено — Талант не потрачен.");

  const picked = await openCompendiumBrowser(false, {
    pack: "weapons", filters: { maxAvailability: CURSED_HEIRLOOM_MAX_AVAILABILITY },
    budget: { mode: "count", value: 1, min: 1 },
    prompt: `Проклятое Наследство: оружие до R${CURSED_HEIRLOOM_MAX_AVAILABILITY}`
  });
  const uuid = Array.isArray(picked) ? picked[0] : picked;
  if (!uuid) throw new Error("Оружие не выбрано.");
  const src = await fromUuid(uuid).catch(() => null);
  if (!src) throw new Error("Не удалось получить выбранный предмет.");

  const roll = await new Roll("1d5").evaluate();
  const curse = curseForRoll(roll.total);

  const data = src.toObject();
  delete data._id;
  foundry.utils.setProperty(data, "flags.warhammer-dbc.cursedHeirloom",
    { key: curse.key, name: curse.name, text: curse.text });
  const [created] = await actor.createEmbeddedDocuments("Item", [data]);

  await postTestCard(actor, {
    icon: rollIcon("gear", "#6a2ea8"),
    title: `${esc(actor.name)} — Проклятое Наследство`,
    lines: [
      `<div class="roll-threshold">Получено: <b>${esc(created.name)}</b> (R${CURSED_HEIRLOOM_MAX_AVAILABILITY} и ниже) — не может быть уничтожено, всегда возвращается к персонажу.</div>`,
      `<div><b>Проклятье (d5=${roll.total}): ${esc(curse.name)}</b> — ${esc(curse.text)}</div>`,
      `<div style="opacity:.75">Триггер проклятья система не отслеживает — отыгрывается столом вручную (текст сохранён на предмете).</div>`
    ]
  }, { rolls: [roll] });

  return created;
}
