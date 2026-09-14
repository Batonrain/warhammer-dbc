// module/apps/force-blade-choice.mjs
// ════════════════════════════════════════════════════════════════════════
//  «Магазин» покупки свойств оружия за Успехи психотеста (wdbc-vxgd,
//  Force Blade / Психосиловой Клинок) — каталог module/constants/
//  force-blade-shop.mjs. Диалог по образцу module/apps/implant-bestq-
//  choice.mjs (тот же принцип «диалог сразу после успеха»), но валюта —
//  Успехи ЭТОГО психотеста, а не постоянная Доступность предмета, и запись
//  результата идёт в system.effects.weaponBuff (читает combat/weapon-
//  mods.mjs, применяется к вооружённому оружию персонажа, пока сила
//  поддерживается), а не в отдельное поле самого предмета.
//
//  Всегда добавляет свойство "force" безусловно — Force Blade превращает
//  ЛЮБОЕ оружие в психосиловое одним фактом манифестации, независимо от
//  того, сколько Успехов потрачено на прочие свойства (книга: «Если данная
//  психосила была манифестирована на не-психосиловом оружии, то оно
//  получает свойство Force»).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { FORCE_BLADE_SHOP } from "../constants/force-blade-shop.mjs";

/** Суммарная цена выбранных id — чистая функция для живого счётчика. */
export function forceBladeShopCost(selectedIds) {
  const set = new Set(selectedIds || []);
  return FORCE_BLADE_SHOP.reduce((sum, e) => sum + (set.has(e.id) ? e.tier : 0), 0);
}

/**
 * selectedIds → {weaponBuff} для item.update, либо null, если бюджет
 * превышен или ничего не выбрано (кроме безусловного "force").
 * Дубли по одному ключу weaponProps (только Flame встречается на трёх
 * ступенях каталога) — оставляем запись САМОЙ ДОРОГОЙ выбранной ступени,
 * остальные молча отбрасываем (более высокая ступень строго сильнее).
 */
export function forceBladeShopUpdate(selectedIds, maxSuccesses) {
  const ids = [...new Set(selectedIds || [])];
  const spent = forceBladeShopCost(ids);
  if (spent > Math.max(0, Number(maxSuccesses) || 0)) return null;

  const entries = FORCE_BLADE_SHOP.filter(e => ids.includes(e.id));
  let balanceMod = 0;
  const byKey = new Map();
  for (const e of entries) {
    if (e.balanceStat) { balanceMod += Number(e.rating) || 0; continue; }
    const prev = byKey.get(e.key);
    if (!prev || e.tier > prev.tier) byKey.set(e.key, e);
  }
  const addProps = [{ key: "force" }];
  for (const e of byKey.values()) {
    const prop = { key: e.key };
    if (e.rating !== undefined) prop.rating = e.rating;
    if (e.rating2 !== undefined) prop.rating2 = e.rating2;
    addProps.push(prop);
  }

  return {
    spent,
    remaining: Math.max(0, Number(maxSuccesses) || 0) - spent,
    weaponBuff: {
      enabled: true, scope: "equipped",
      damageMod: 0, penMod: 0, rangeMod: 0, balanceMod, addProps
    }
  };
}

/** Пустой weaponBuff — снятие поддержания Force Blade (та же форма, что emptyEffects()). */
export function forceBladeShopClear() {
  return { enabled: false, scope: "equipped", damageMod: 0, penMod: 0, rangeMod: 0, balanceMod: 0, addProps: [] };
}

function tierRows(tier) {
  return FORCE_BLADE_SHOP.filter(e => e.tier === tier).map(e => `
    <label class="hw-choice-row fb-shop-row">
      <input type="checkbox" class="fb-shop-cb" data-id="${e.id}" data-tier="${tier}"/>
      ${esc(e.label)}
    </label>`).join("");
}

function shopDialogHtml(maxSuccesses) {
  const tiers = [1, 2, 3, 4, 5].map(t => `
    <fieldset class="fb-shop-tier">
      <legend>${t} У.</legend>
      ${tierRows(t)}
    </fieldset>`).join("");
  return `<form class="hw-choice-form fb-shop-form">
    <div class="hw-choice-desc">
      Успехов психотеста: <b>${maxSuccesses}</b>. Force уже добавится безусловно —
      выберите дополнительные свойства, потратив Успехи (1-5 за штуку).
    </div>
    ${tiers}
    <div class="fb-shop-summary">Потрачено: <span class="fb-shop-spent">0</span> из ${maxSuccesses}
      — осталось: <span class="fb-shop-left">${maxSuccesses}</span></div>
  </form>`;
}

function wireShopDialog(h, maxSuccesses) {
  const recount = () => {
    const ids = [];
    h.find(".fb-shop-cb:checked").each((_, el) => ids.push(el.dataset.id));
    const spent = forceBladeShopCost(ids);
    h.find(".fb-shop-spent").text(String(spent));
    h.find(".fb-shop-left").text(String(Math.max(0, maxSuccesses - spent)));
    h.find(".fb-shop-left").css("color", spent > maxSuccesses ? "#a51717" : "");
  };
  h.find(".fb-shop-cb").on("change", recount);
  recount();
}

function readShopDialog(h) {
  const ids = [];
  h.find(".fb-shop-cb:checked").each((_, el) => ids.push(el.dataset.id));
  return ids;
}

/**
 * @param {number} maxSuccesses  Успехи психотеста манифестации.
 * @returns {Promise<string[]|null>}  выбранные id или null (закрыли без выбора)
 */
export function promptForceBladeShop(maxSuccesses) {
  return new Promise(resolve => {
    let done = false;
    new Dialog({
      title: "Force Blade: свойства оружия",
      content: shopDialogHtml(maxSuccesses),
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>', label: "Применить",
          callback: h => {
            if (done) return; done = true;
            const ids = readShopDialog(h);
            if (forceBladeShopCost(ids) > maxSuccesses) {
              ui.notifications.warn("Выбрано больше свойств, чем позволяют Успехи — ничего не применено.");
              resolve(null);
            } else resolve(ids);
          }
        },
        cancel: { label: "Только Force", callback: () => { if (!done) { done = true; resolve([]); } } }
      },
      default: "ok",
      render: h => wireShopDialog(h, maxSuccesses),
      close: () => { if (!done) { done = true; resolve([]); } }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "hw-choice-dialog", "fb-shop-dialog"], width: 420 }).render(true);
  });
}

/**
 * Полный цикл после успешной манифестации: спросить и записать
 * system.effects.weaponBuff на предмете. Вызывается из executePsychotest
 * (module/sheets/tabs/psychic.mjs), только для success && item.system.hasWeaponShop.
 */
export async function runForceBladeShop(item, successes) {
  const ids = await promptForceBladeShop(Math.max(0, Number(successes) || 0));
  const picked = ids ?? [];
  const result = forceBladeShopUpdate(picked, successes) ?? forceBladeShopUpdate([], successes);
  await item.update({ "system.effects.weaponBuff": result.weaponBuff });
}
