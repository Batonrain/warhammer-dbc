// module/combat/skitarii-modules.mjs
// Смещающаяся Мантия (Shifting Mantle): «Раз в Ход за ментальное свободное
// действие Скитарий может отключить один Модуль и/или включить другой.
// Отключённый модуль не даёт бонусов/штрафов и не мешает». Отключение — флаг
// импланта disabled (rules/item-gates.mjs::isImplantActive), поэтому эффекты,
// Таланты и снаряжение Модуля гаснут и возвращаются той же пересинхронизацией,
// что у Хирургеона. Подсчёт лимитов — rules/skitarii-modules.mjs.

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";
import { isSkitariiModule, skitariiModuleTalents, skitariiModuleSummary,
         mantleSwapAllowed, mantleSwapMark, MANTLE_SWAP_FLAG, arkhanCanPayCharge } from "../rules/skitarii-modules.mjs";

const NS = "warhammer-dbc";

/** Включить/выключить Модуль Мантией. */
export async function toggleSkitariiModule(actor, item) {
  if (!actor || !item) return;
  if (!hasItemNamed(actor, "Shifting Mantle", ["talent"])) {
    return ui.notifications.warn("⚠️ Переключать Модули на ходу позволяет Талант Смещающаяся Мантия.");
  }
  const t = skitariiModuleTalents(actor);
  if (!isSkitariiModule(item, t) || !item.getFlag(NS, "installed")) {
    return ui.notifications.warn("⚠️ Это не установленный Модуль Скитарии.");
  }
  const turnOn = !!item.getFlag(NS, "disabled");
  const dir = turnOn ? "on" : "off";
  const combat = game.combat?.started ? game.combat : null;
  if (!mantleSwapAllowed(actor, combat, dir)) {
    return ui.notifications.warn(`⚠️ В этом Ходу Мантия уже ${turnOn ? "включала" : "отключала"} Модуль.`);
  }
  const { syncItemEffectsDisabled } = await import("../apps/effects.mjs");
  const { syncGrantedEquipment, syncLiveGrants } = await import("../apps/mechanics.mjs");
  const apply = async on => {
    if (on) await item.unsetFlag(NS, "disabled");
    else await item.setFlag(NS, "disabled", true);
    await syncItemEffectsDisabled(item, on);
    await syncGrantedEquipment(item);
    await syncLiveGrants(item);
  };
  await apply(turnOn);
  // Лимит проверяется ПОСЛЕ включения: Модуль, сам поднимающий T, при
  // отключении уронил T.b, а с ним и лимит — проверка «до» не дала бы его вернуть.
  if (turnOn) {
    const after = skitariiModuleSummary(actor);
    if (after && after.active > after.activeMax) {
      await apply(false);
      return ui.notifications.warn(`⚠️ С этим Модулем действовало бы ${after.active} из ${after.activeMax} — сначала отключите другой.`);
    }
  }
  const mark = mantleSwapMark(actor, combat, dir);
  if (mark) await actor.setFlag(NS, MANTLE_SWAP_FLAG, mark);
  const sum = skitariiModuleSummary(actor);
  await postTestCard(actor, {
    icon: "⚙", title: `Смещающаяся Мантия — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Ментальное свободное действие: Модуль <b>${esc(item.name)}</b> ${turnOn ? "включён" : "отключён"}.`
      + (sum ? ` Действуют ${sum.active} из ${sum.activeMax}, установлено ${sum.installed} из ${sum.installedMax}.` : "")
      + `</div>`]
  }, { sound: false });
}

// ── Избавление Аркхана ──────────────────────────────────────────────────────
// «Когда он попадает в поле Haywire интенсивностью 7+ Скитарий может получить
// 1 Усталости или потратить 1 заряд Актуаторных Банков, чтобы его бионические
// конечности не отключались… всё ещё Оглушён, но не Беспомощен». Актуаторные
// Банки Лат — +1 к общей Катушке (constants/implant-mechanics.mjs), заряд
// списывается оттуда (rules/skitarii-modules.mjs::arkhanCanPayCharge).

export const ARKHAN_MIN_INTENSITY = 7;

/** Кнопки под строкой ЭМИ на карточке урона (пусто — не тот случай). */
export function arkhanHaywireNote(actor, intensity) {
  if (!actor || Number(intensity) < ARKHAN_MIN_INTENSITY) return "";
  if (!hasItemNamed(actor, "Deliverance of Arkhan", ["talent"])) return "";
  const uuid = esc(actor.uuid);
  const charge = arkhanCanPayCharge(actor)
    ? ` <button type="button" class="wh-arkhan-btn" data-actor-uuid="${uuid}" data-pay="charge">⚡ −1 заряд Актуаторных Банков</button>` : "";
  return `<div class="dmg-tb-note">⚙ Избавление Аркхана: ${esc(actor.name)} может принять 1 Усталость${charge ? " или потратить 1 заряд Актуаторных Банков" : ""} — бионические конечности не отключаются (Оглушён, но не Беспомощен).
    <button type="button" class="wh-arkhan-btn" data-actor-uuid="${uuid}" data-pay="fatigue">⚙ +1 Усталость: бионика работает</button>${charge}</div>`;
}

/** Нажатие кнопки: +1 Усталости либо −1 заряд Катушки, и строка в чат. */
export async function useDeliveranceOfArkhan(message, { actorUuid, pay = "fatigue" } = {}) {
  const actor = actorUuid ? await fromUuid(actorUuid) : null;
  if (!actor) return false;
  if (!actor.isOwner) { ui.notifications.warn("⚠️ Решает владелец персонажа."); return false; }
  const byCharge = pay === "charge";
  if (byCharge && !arkhanCanPayCharge(actor)) {
    ui.notifications.warn("⚠️ В Актуаторных Банках нет заряда — остаётся Усталость.");
    return false;
  }
  const { runCardOnce } = await import("./card-once.mjs");
  return runCardOnce(message, "arkhanUsed", async () => {
    let paid;
    if (byCharge) {
      const before = Number(actor.system.energy?.value) || 0;
      await actor.update({ "system.energy.value": before - 1 });
      paid = `−1 заряд Актуаторных Банков (Катушка ${before} → ${before - 1})`;
    } else {
      const { addFatigue } = await import("../sheets/tabs/conditions.mjs");
      await addFatigue(actor, 1);
      paid = "+1 Усталость";
    }
    await postTestCard(actor, {
      icon: "⚙", title: `Избавление Аркхана — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">${paid}: аварийные цепи Лат держат бионику в мёртвой зоне ЭМИ — ноги не подкашиваются, руки не выпускают оружие. ${esc(actor.name)} Оглушён, но не Беспомощен.</div>`]
    }, { sound: false });
  }, "Избавление Аркхана с этой карточки уже применено.");
}

// ── Дар Омниссии ────────────────────────────────────────────────────────────

/** Смена работы: перезарядить магазин оружия или создать запасной (+1 к пачке боеприпаса). */
export async function useBoonOfOmnissiah(actor) {
  if (!actor || !hasItemNamed(actor, "Boon of Omnissiah", ["talent"])) {
    return ui.notifications.warn("⚠️ У актора нет Таланта Дар Омниссии.");
  }
  const { boonWeaponOk } = await import("../rules/skitarii-modules.mjs");
  const { _getCompatibleAmmo } = await import("./reload.mjs");
  const weapons = [...actor.items].filter(boonWeaponOk);
  if (!weapons.length) return ui.notifications.warn("⚠️ Нет оружия Механикум или SP с магазином.");
  const opts = [];
  for (const w of weapons) {
    const cur = Number(w.system.magazineCur) || 0, max = Number(w.system.magazineMax) || 0;
    if (cur < max) opts.push({ value: `reload:${w.id}`, label: `Перезарядить: ${w.name} (${cur}/${max})` });
    for (const a of _getCompatibleAmmo(actor, w)) {
      opts.push({ value: `make:${a.id}:${w.id}`, label: `Создать магазин: ${a.name} для ${w.name} (сейчас ${Number(a.system.quantity) || 0})` });
    }
  }
  if (!opts.length) return ui.notifications.warn("⚠️ Магазины полны, а подходящих пачек боеприпаса на листе нет.");
  const html = `<p>Смена работы у электросети, сырьё под рукой — без инструментов и тестов.</p>
    <div class="form-group"><select name="pick">${opts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select></div>`;
  const pick = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Дар Омниссии" }, content: html, rejectClose: false,
    ok: { label: "Работать", callback: (_e, b) => b.form.elements.pick.value }
  }).catch(() => null);
  if (!pick) return;
  const [mode, id, wid] = pick.split(":");
  let text;
  if (mode === "reload") {
    const w = actor.items.get(id);
    await w.update({ "system.magazineCur": Number(w.system.magazineMax) || 0 });
    text = `Магазин <b>${esc(w.name)}</b> перезаряжен до ${w.system.magazineMax}.`;
  } else {
    const a = actor.items.get(id);
    const w = actor.items.get(wid);
    await a.update({ "system.quantity": (Number(a.system.quantity) || 0) + 1 });
    text = `Создан магазин <b>${esc(a.name)}</b> для ${esc(w?.name ?? "оружия")}: теперь ${a.system.quantity}.`;
  }
  await postTestCard(actor, {
    icon: "⚙", title: `Дар Омниссии — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Смена работы у электросети: ${text}</div>`]
  }, { sound: false });
}
