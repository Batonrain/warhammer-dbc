// module/sheets/gear-mod-picker.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Улучшить» (wdbc-7td8): кнопка на строке оружия/брони в таблице Снаряжения
//  (module/sheets/tabs/gear.mjs) открывает пикер уже имеющихся у актора
//  модификаций (weaponMod/armorMod), ещё не установленных ни на что и
//  совместимых с этим носителем. Тот же список и та же связь installedOn,
//  что уже доступны через выпадашку в блоке «не установлены» (gear.mjs,
//  gearWeaponModsFree/gearArmorModsFree в sheet-helpers.mjs) — просто вход с
//  ДРУГОГО конца: с носителя, а не с мода, чтобы не нужно было прокручивать
//  лист до отдельного блока и искать нужный носитель в его выпадашке.
//
//  Совместимость (см. sheet-helpers.mjs::gearWeaponModsFree/gearArmorModsFree
//  и item-sheet.mjs::modInstallTargets/armorInstallTargets — три места, где
//  уже жила эта логика, здесь она не изобретается заново, а зеркалится):
//   - модификация оружия ставится на ЛЮБОЕ оружие персонажа — modGroup/
//     категория мода (WEAPON_MOD_GROUPS) только подписывает строку, отбора
//     по типу/классу оружия в системе не заведено;
//   - модификация брони — на любую броню, КРОМЕ Систем силовой брони
//     (category:"powerSystem" в схеме) — им нужна броня armorType:"power".
// ════════════════════════════════════════════════════════════════════════════

import { ARMOR_MOD_GROUPS, WEAPON_MOD_GROUPS } from "../constants/items.mjs";
import { installGearMod as _installGearMod } from "./tabs/gear.mjs";
import { centerPicker, pickerPos } from "./picker-ui.mjs";
import { esc } from "../helpers/utils.mjs";

/** "weapon" | "armor" | null — какого рода носитель модов у этого предмета. */
export function hostKindOf(item) {
  if (item?.type === "weapon") return "weapon";
  if (item?.type === "armor")  return "armor";
  return null;
}

function modView(kind, i) {
  const cat = i.system.category || (kind === "weapon" ? "ranged" : "armor");
  const groups = kind === "weapon" ? WEAPON_MOD_GROUPS : ARMOR_MOD_GROUPS;
  return {
    id: i.id, name: i.name,
    groupLabel:  groups[cat]?.[i.system.modGroup] ?? "",
    weight:      i.system.weight ?? 0,
    powerSystem: kind === "armor" && cat === "powerSystem",
    benefit:     i.system.description || ""
  };
}

/**
 * Свободные модификации, совместимые с конкретным носителем (актор + сам
 * предмет-носитель). Возвращает вьюшки для рендера ПЛЮС ссылку на исходный
 * документ (`_item`) — пикер сам решает, что с ним делать (installGearMod).
 */
export function modsAvailableFor(actor, hostItem) {
  const kind = hostKindOf(hostItem);
  if (!actor || !kind) return [];
  const modType  = kind === "weapon" ? "weaponMod" : "armorMod";
  const hostIds  = new Set((actor.items ?? []).filter(i => i.type === kind).map(i => i.id));
  return (actor.items ?? [])
    .filter(i => i.type === modType && !hostIds.has(i.system.installedOn))
    .filter(i => {
      if (kind !== "armor") return true;
      const isPower = (i.system.category || "armor") === "powerSystem";
      return isPower ? hostItem.system.armorType === "power" : true;
    })
    .map(i => ({ ...modView(kind, i), _item: i }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function rowHtml(m) {
  return `
    <div class="pick-row" data-name="${esc(String(m.name).toLowerCase())}" data-item-id="${m.id}">
      <div class="pick-head">
        <button type="button" class="pick-exp" title="Показать описание">▸</button>
        <span class="pick-name" title="Раскрыть">${esc(m.name)}</span>
        ${m.groupLabel ? `<span class="pick-req">${esc(m.groupLabel)}</span>` : ""}
        ${m.powerSystem ? `<span class="gear-sys-badge" title="Система силовой брони">⚡</span>` : ""}
        <span class="pick-req">${m.weight} кг</span>
        <button type="button" class="pick-add gear-mod-picker-install" data-item-id="${m.id}" title="Установить">＋</button>
      </div>
      <div class="pick-desc" style="display:none;">${esc(m.benefit) || "—"}</div>
    </div>`;
}

const EMPTY_HTML = `<div class="gear-free-notarget">Нет подходящих модификаций на инвентаре — заведите новую («＋ Своя») или снимите свободную с другого предмета.</div>`;

function pickerContent(mods) {
  return `<div class="wh-item-picker wh-gear-mod-picker">
    <div class="pick-top">
      <input type="text" class="pick-search" placeholder="Поиск модификации…"/>
      <button type="button" class="pick-custom gear-mod-picker-new" title="Создать новую модификацию и сразу установить">＋ Своя</button>
    </div>
    <div class="pick-list">${mods.length ? mods.map(rowHtml).join("") : EMPTY_HTML}</div>
  </div>`;
}

/**
 * Пикер модификаций для оружия/брони (кнопка «Улучшить», wdbc-7td8).
 * После установки строка убирается из списка, а диалог остаётся открытым —
 * можно поставить несколько модов подряд не переоткрывая пикер. Сам лист
 * персонажа перерисуется штатно (installGearMod → item.update → updateItem),
 * этот код о ререндере листа не заботится.
 */
export async function openGearModPicker(actor, hostItem, { installGearMod = _installGearMod } = {}) {
  const kind = hostKindOf(hostItem);
  if (!kind) return null;
  let mods = modsAvailableFor(actor, hostItem);

  const dlg = new Dialog({
    title: `Улучшить: ${hostItem.name}`,
    content: pickerContent(mods),
    buttons: { close: { label: "Закрыть" } },
    default: "close",
    render: html => {
      centerPicker(html);

      const refreshEmptyState = () => {
        if (html.find(".pick-row").length) return;
        html.find(".pick-list").html(EMPTY_HTML);
      };

      html.find(".gear-mod-picker-install").on("click", async ev => {
        ev.preventDefault(); ev.stopPropagation();
        const id  = ev.currentTarget.dataset.itemId;
        const mod = mods.find(m => m.id === id)?._item;
        if (!mod) return;
        await installGearMod(mod, hostItem.id);
        ui.notifications?.info(`${mod.name} установлен(а) на ${hostItem.name}.`);
        mods = mods.filter(m => m.id !== id);
        html.find(`.pick-row[data-item-id="${id}"]`).remove();
        refreshEmptyState();
      });

      // «Своя» — по образцу openItemPicker (module/sheets/item-picker.mjs)
      // pick-custom: пустой предмет нужного типа, сразу привязанный к этому
      // носителю (installedOn), с открытием его листа для заполнения деталей.
      html.find(".gear-mod-picker-new").on("click", async ev => {
        ev.preventDefault();
        const modType = kind === "weapon" ? "weaponMod" : "armorMod";
        const system = { installedOn: hostItem.id };
        if (kind === "weapon") system.category = hostItem.system?.weaponClass === "melee" ? "melee" : "ranged";
        const created = await actor.createEmbeddedDocuments("Item", [{
          name: kind === "weapon" ? "Новая модификация оружия" : "Новая модификация брони",
          type: modType,
          system
        }]);
        const item = created?.[0];
        if (item) item.sheet?.render(true);
      });

      const toggleDesc = row => {
        const desc = row.querySelector(".pick-desc");
        const exp  = row.querySelector(".pick-exp");
        const open = desc.style.display !== "none";
        desc.style.display = open ? "none" : "block";
        exp.textContent = open ? "▸" : "▾";
      };
      html.find(".pick-exp").on("click", ev => { ev.preventDefault(); toggleDesc(ev.currentTarget.closest(".pick-row")); });
      html.find(".pick-name").on("click", ev => toggleDesc(ev.currentTarget.closest(".pick-row")));

      html.find(".pick-search").on("input", ev => {
        const q = ev.currentTarget.value.toLowerCase().trim();
        html.find(".pick-row").each((_, row) => {
          row.classList.toggle("pick-hidden", !!q && !(row.dataset.name || "").includes(q));
        });
      });
    }
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-item-picker-dialog"], ...pickerPos(460, 520) });
  dlg.render(true);
  return dlg;
}
