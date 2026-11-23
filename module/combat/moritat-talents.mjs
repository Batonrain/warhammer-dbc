// module/combat/moritat-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кнопки Талантов Моритата (правила — rules/moritat-talents.mjs).
//  Ленточное Питание — подключить оружие к ленте ранца и набить магазин;
//  Пролётом — полное действие: Полудвижение, Одиночный Выстрел из
//  экипированного оружия (бесплатное окно атаки), Полудвижение.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";
import { resourcePoolValue } from "../rules/resource-pools.mjs";
import { spendResource } from "../apps/resource-pools.mjs";
import {
  BELT_FEED_POOL, BELT_FED_FLAG, FLY_BY_FLAG, beltFeedEligible, beltFeedTransfer, flyByRoundKey
} from "../rules/moritat-talents.mjs";
import { chooseOne, infoCard, payActions } from "./astartes-elite-ui.mjs";

const NS = "warhammer-dbc";

/**
 * Belt Feed / Ленточное Питание: выбрать оружие, подключить к ленте (метка
 * BELT_FED_FLAG — для Цепного Выстрела) и подать патроны из ранца в магазин.
 */
export async function useBeltFeed(actor) {
  if (!hasItemNamed(actor, "Belt Feed", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Ленточное Питание.") && "нет Таланта";
  const guns = actor.items.filter(i => beltFeedEligible(i));
  if (!guns.length) return ui.notifications.warn("⚠️ Нет стрелкового оружия с магазином.") && "нет оружия";
  const saved = guns.find(g => g.getFlag(NS, BELT_FED_FLAG));
  const ordered = saved ? [saved, ...guns.filter(g => g !== saved)] : guns;
  const pick = await chooseOne("Ленточное Питание", ordered.map(g => ({
    id: g.id, label: `${g.name} (${g.system.magazineCur}/${g.system.magazineMax})${g.getFlag(NS, BELT_FED_FLAG) ? " — на ленте" : ""}` })),
  { prompt: "Какое оружие питать от ленты ранца?" });
  if (!pick) return "отмена";
  const gun = actor.items.get(pick.id);
  for (const g of guns) if (g !== gun && g.getFlag(NS, BELT_FED_FLAG)) await g.unsetFlag(NS, BELT_FED_FLAG);
  if (!gun.getFlag(NS, BELT_FED_FLAG)) await gun.setFlag(NS, BELT_FED_FLAG, true);
  const pool = resourcePoolValue(actor, BELT_FEED_POOL);
  const n = beltFeedTransfer(gun, pool);
  if (n > 0) {
    const r = await spendResource(actor, BELT_FEED_POOL, n, { silent: true, ignoreRoundCap: true });
    if (r) await gun.update({ "system.magazineCur": (Number(gun.system.magazineCur) || 0) + n });
  }
  await infoCard(actor, "🎗️", "Ленточное Питание", [
    `<b>${esc(gun.name)}</b> подключено к ленте ранца: Надёжность не понижается, можно Цепной Выстрел.`,
    n > 0 ? `Лента подала ${n} патр. без Перезарядки: магазин ${gun.system.magazineCur}/${gun.system.magazineMax}. В ранце осталось ${pool - n}.`
      : pool > 0 ? "Магазин и так полон." : "Ранец пуст — набейте его кнопкой пула «Припасы ранца»."
  ]);
  return undefined;
}

/** Fly-By / Пролётом: полное действие с прыжковым ранцем — Полудвижение, выстрел, Полудвижение. */
export async function useFlyBy(actor) {
  if (!hasItemNamed(actor, "Fly-By", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Пролётом.") && "нет Таланта";
  if (!hasItemNamed(actor, "Flyer", ["trait"])) return ui.notifications.warn("⚠️ Пролётом — только с прыжковым ранцем (Черта Flyer).") && "нет ранца";
  const guns = actor.items.filter(i => i.type === "weapon" && i.system?.equipped && ["pistol", "basic", "heavy"].includes(i.system?.weaponClass));
  if (!guns.length) return ui.notifications.warn("⚠️ Нет экипированного стрелкового оружия.") && "нет оружия";
  if (!(await payActions(actor, 2, "Пролётом"))) return "нет ОД";
  await actor.setFlag(NS, FLY_BY_FLAG, `${flyByRoundKey(game.combat)}|`);
  const ag = Number(actor.system?.characteristics?.ag?.total) || 0;
  const btns = guns.map(g => `<button class="wh-free-shot-btn" type="button" data-kind="flyBy" data-actor-uuid="${actor.uuid}" data-item-id="${g.id}">🦅 Пролётом: Одиночный Выстрел из ${esc(g.name)}</button>`);
  await infoCard(actor, "🦅", "Пролётом", [
    "Полное действие (2 ОД списаны): Полудвижение → Одиночный Выстрел (из одного или нескольких оружий — кнопки ниже, без ОД) → второе Полудвижение.",
    `Враги в Карауле или с задержанным действием реагируют на манёвр, только если их A выше ${ag}.`
  ], { sections: [btns.join("")] });
  return undefined;
}
