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
export function forceBladeShopUpdate(selectedIds, maxSuccesses, weaponId = "") {
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
      // weaponId — КОНКРЕТНОЕ оружие, на которое манифестировали. Книга:
      // «Если данная психосила была манифестирована на не-психосиловом
      // оружии, то ОНО получает свойство Force» — одно, а не всё надетое.
      // Раньше поля не было вовсе, и Варлок с мечом и пистолетом в руках
      // получал Force и все купленные свойства на ОБА (приём 14.09.2026).
      // Пустая строка = оружие выбрать не из чего: поведение как раньше,
      // по всему надетому, чтобы не отнять способность целиком.
      enabled: true, scope: "equipped", weaponId: String(weaponId || ""),
      damageMod: 0, penMod: 0, rangeMod: 0, balanceMod, addProps
    }
  };
}

/** Пустой weaponBuff — снятие поддержания Force Blade (та же форма, что emptyEffects()). */
export function forceBladeShopClear() {
  return { enabled: false, scope: "equipped", weaponId: "", damageMod: 0, penMod: 0, rangeMod: 0, balanceMod: 0, addProps: [] };
}

function tierRows(tier) {
  return FORCE_BLADE_SHOP.filter(e => e.tier === tier).map(e => `
    <label class="hw-choice-row fb-shop-row">
      <input type="checkbox" class="fb-shop-cb" data-id="${e.id}" data-tier="${tier}"/>
      ${esc(e.label)}
    </label>`).join("");
}

/** Рукопашное оружие носителя — на что психосилу можно наложить.
 *  Книга: «манифестирована на НЕ-психосиловом оружии», поэтому уже
 *  психосиловое из списка убираем: ему давать Force незачем. */
function meleeWeaponChoices(actor) {
  return [...(actor?.items ?? [])]
    .filter(i => i.type === "weapon" && i.system?.melee
      && !(i.system?.weaponProps || []).some(p => p.key === "force"))
    .map(i => ({ id: i.id, name: i.name, equipped: !!i.system?.equipped }));
}

function weaponPickerHtml(weapons) {
  if (!weapons.length) {
    return `<div class="hw-choice-desc fb-shop-noweapon">Рукопашного не-психосилового оружия у персонажа нет —
      свойства применятся ко всему надетому оружию, как раньше. Выберите оружие и манифестируйте заново,
      если так не задумано.</div>`;
  }
  const opts = weapons.map(w =>
    `<option value="${esc(w.id)}"${w.equipped ? " selected" : ""}>${esc(w.name)}${w.equipped ? "" : " (не надето)"}</option>`).join("");
  return `<div class="weapon-row fb-shop-weapon-row">
    <label class="wr-label" title="Психосила накладывается на ОДНО оружие — книга: «оно получает свойство Force»">На какое оружие</label>
    <select class="fb-shop-weapon wr-select-sm">${opts}</select>
  </div>`;
}

function shopDialogHtml(maxSuccesses, weapons = []) {
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
    ${weaponPickerHtml(weapons)}
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
  return { ids, weaponId: h.find(".fb-shop-weapon").val() || "" };
}

/**
 * @param {number} maxSuccesses  Успехи психотеста манифестации.
 * @param {Array<{id:string,name:string,equipped:boolean}>} weapons  на что накладывать
 * @returns {Promise<{ids:string[],weaponId:string}|null>}  выбор или null (перебор Успехов)
 */
export function promptForceBladeShop(maxSuccesses, weapons = []) {
  return new Promise(resolve => {
    let done = false;
    new Dialog({
      title: "Force Blade: свойства оружия",
      content: shopDialogHtml(maxSuccesses, weapons),
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>', label: "Применить",
          callback: h => {
            if (done) return; done = true;
            const picked = readShopDialog(h);
            if (forceBladeShopCost(picked.ids) > maxSuccesses) {
              ui.notifications.warn("Выбрано больше свойств, чем позволяют Успехи — ничего не применено.");
              resolve(null);
            } else resolve(picked);
          }
        },
        cancel: { label: "Только Force", callback: h => { if (!done) { done = true; resolve({ ids: [], weaponId: h?.find?.(".fb-shop-weapon")?.val?.() || "" }); } } }
      },
      default: "ok",
      render: h => wireShopDialog(h, maxSuccesses),
      close: () => { if (!done) { done = true; resolve({ ids: [], weaponId: "" }); } }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "hw-choice-dialog", "fb-shop-dialog"], width: 420 }).render(true);
  });
}

/**
 * Полный цикл после успешной манифестации: спросить и записать
 * system.effects.weaponBuff на предмете. Вызывается из executePsychotest
 * (module/sheets/tabs/psychic.mjs), только для success && item.system.hasWeaponShop.
 */
export async function runForceBladeShop(item, successes) {
  const weapons = meleeWeaponChoices(item?.parent);
  const picked = await promptForceBladeShop(Math.max(0, Number(successes) || 0), weapons);
  const result = forceBladeShopUpdate(picked?.ids ?? [], successes, picked?.weaponId ?? "")
              ?? forceBladeShopUpdate([], successes, picked?.weaponId ?? "");
  await item.update({ "system.effects.weaponBuff": result.weaponBuff });
}
