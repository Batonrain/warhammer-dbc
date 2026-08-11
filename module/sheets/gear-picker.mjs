// module/sheets/gear-picker.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Пикер снаряжения из компендиумов: оружие, броня, щиты, боеприпасы,
//  снаряжение и инструменты. Принимает актора, чтобы лист персонажа не был
//  частью расчёта и разметки пикера.
// ════════════════════════════════════════════════════════════════════════════

import { DAMAGE_TYPES } from "../constants/items.mjs";
import { centerPicker, pickerPos } from "./picker-ui.mjs";

const GEAR_PACKS = [
  { id: "warhammer-dbc.weapons",    label: "Оружие" },
  { id: "warhammer-dbc.armor",      label: "Броня" },
  { id: "warhammer-dbc.shields",    label: "Силовые щиты" },
  { id: "warhammer-dbc.ammunition", label: "Боеприпасы" },
  { id: "warhammer-dbc.gear",       label: "Снаряжение" },
  { id: "warhammer-dbc.tools",      label: "Инструменты" }
];

const esc = t => String(t ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/"/g, "&quot;");

// Краткая строка характеристик — чтобы выбирать, не открывая лист.
function statLine(doc) {
  const system = doc.system || {};
  const bits = [];
  if (doc.type === "weapon") {
    if (system.damage) {
      bits.push(`${system.damage}${system.damageType ? " " + (DAMAGE_TYPES[system.damageType] || system.damageType) : ""}`);
    }
    if (system.penetration) bits.push(`Проб. ${system.penetration}`);
    if (system.range) bits.push(`${system.range}м`);
    const rof = [system.rof_single, system.rof_semi, system.rof_full].filter(x => x != null);
    if (rof.length && (system.rof_semi || system.rof_full)) {
      bits.push(`RoF ${system.rof_single || "–"}/${system.rof_semi || "–"}/${system.rof_full || "–"}`);
    }
  } else if (doc.type === "armor") {
    bits.push(`AP ${system.head || 0}/${system.body || 0}/${system.leftArm || 0}/${system.leftLeg || 0}`);
    if (system.strengthBonus) bits.push(`S +${system.strengthBonus}`);
  } else if (doc.type === "forcefield") {
    bits.push(`Щит ${system.ratingMin || 1}-${system.ratingMax || 0}`);
  }
  if (system.weight) bits.push(`${system.weight}кг`);
  if (system.availability != null) bits.push(`R ${system.availability}`);
  return bits.join(" · ");
}

async function loadGearGroups() {
  const groups = [];
  for (const packDef of GEAR_PACKS) {
    const pack = game.packs.get(packDef.id);
    if (!pack) continue;
    const docs = await pack.getDocuments();
    if (!docs.length) continue;

    // Внутри пака — разбивка по папкам компендиума (Стрелковое/Рукопашное/…).
    const byFolder = new Map();
    for (const doc of docs) {
      const folder = doc.folder;
      const parent = folder?.folder?.name || "";
      const label = folder ? (parent ? `${parent} · ${folder.name}` : folder.name) : "Прочее";
      if (!byFolder.has(label)) byFolder.set(label, []);
      byFolder.get(label).push(doc);
    }
    groups.push({
      pack: packDef,
      folders: [...byFolder.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru"))
    });
  }
  return groups;
}

function rowHtml(doc) {
  return `
    <div class="pick-row" data-name="${esc(String(doc.name).toLowerCase())}">
      <div class="pick-head">
        <button type="button" class="pick-exp" title="Показать описание">▸</button>
        <span class="pick-name" title="Раскрыть">${esc(doc.name)}</span>
        <span class="pick-req">${esc(statLine(doc))}</span>
        <button type="button" class="pick-add" data-uuid="${doc.uuid}" title="Добавить на лист">＋</button>
      </div>
      <div class="pick-desc" style="display:none;">${esc(doc.system?.special || doc.system?.description || "—")}</div>
    </div>`;
}

function gearPickerContent(groups) {
  const tabs = groups.map((group, i) =>
    `<button type="button" class="gp-tab${i === 0 ? " is-on" : ""}" data-tab="${i}" data-hits="">${esc(group.pack.label)}</button>`).join("");
  const panes = groups.map((group, i) => `
    <div class="gp-pane" data-pane="${i}" style="${i === 0 ? "" : "display:none;"}">
      ${group.folders.map(([label, docs]) => `
        <div class="pick-group">
          <div class="pick-group-head">${esc(label)} <span class="pick-count">${docs.length}</span></div>
          <div class="pick-group-body">${docs
            .sort((a, b) => a.name.localeCompare(b.name, "ru")).map(rowHtml).join("")}</div>
        </div>`).join("")}
    </div>`).join("");

  return `<div class="wh-item-picker wh-gear-picker">
    <div class="pick-top"><input type="text" class="pick-search" placeholder="Поиск по названию…"/></div>
    <div class="gp-tabs">${tabs}</div>
    <div class="pick-list">${panes}</div>
  </div>`;
}

function activateGearPicker(html, actor) {
  centerPicker(html);
  // Прилипание вкладок: высоты строки поиска и полосы вкладок кладём в
  // CSS-переменные — иначе заголовки папок наезжают на вкладки.
  const root = html.find(".wh-gear-picker")[0];
  if (root) requestAnimationFrame(() => {
    const topH = root.querySelector(".pick-top")?.offsetHeight ?? 0;
    const tabH = root.querySelector(".gp-tabs")?.offsetHeight ?? 0;
    root.style.setProperty("--pick-top-h", `${topH}px`);
    root.style.setProperty("--gp-tabs-h", `${topH + tabH}px`);
  });
  html.find(".gp-tab").on("click", ev => {
    const idx = ev.currentTarget.dataset.tab;
    html.find(".gp-tab").removeClass("is-on");
    $(ev.currentTarget).addClass("is-on");
    html.find(".gp-pane").each((_, pane) => {
      pane.style.display = pane.dataset.pane === idx ? "" : "none";
    });
  });
  html.find(".pick-add").on("click", async ev => {
    ev.preventDefault();
    ev.stopPropagation();
    const doc = await fromUuid(ev.currentTarget.dataset.uuid);
    if (!doc) return;
    const obj = doc.toObject();
    delete obj._id;
    await actor.createEmbeddedDocuments("Item", [obj]);
    ui.notifications.info(`Добавлено: ${doc.name}`);
    $(ev.currentTarget).closest(".pick-row").addClass("just-added");
  });
  const toggle = row => {
    const desc = row.querySelector(".pick-desc");
    const exp = row.querySelector(".pick-exp");
    const open = desc.style.display !== "none";
    desc.style.display = open ? "none" : "block";
    exp.textContent = open ? "▸" : "▾";
  };
  html.find(".pick-exp").on("click", ev => {
    ev.preventDefault();
    toggle(ev.currentTarget.closest(".pick-row"));
  });
  html.find(".pick-name").on("click", ev => toggle(ev.currentTarget.closest(".pick-row")));
  html.find(".pick-search").on("input", ev => filterGearPicker(html, ev.currentTarget.value));
}

function filterGearPicker(html, value) {
  const q = value.toLowerCase().trim();
  // ВАЖНО: тело в фигурных скобках. classList.toggle возвращает булево, а
  // jQuery .each() прерывает обход, если колбэк вернул false — из-за этого
  // фильтр обрывался на первой же СОВПАВШЕЙ строке и остаток списка не
  // фильтровался вовсе.
  html.find(".pick-row").each((_, row) => {
    row.classList.toggle("pick-hidden", !!q && !(row.dataset.name || "").includes(q));
  });
  html.find(".pick-group").each((_, group) => {
    group.style.display = group.querySelectorAll(".pick-row:not(.pick-hidden)").length ? "" : "none";
  });

  // Совпадения могут лежать в другой вкладке, а она скрыта — поэтому считаем
  // найденное по каждой и подсказываем числом на кнопке. Если в текущей вкладке
  // пусто, а где-то есть — переключаемся туда сами.
  let firstHit = -1;
  let total = 0;
  html.find(".gp-pane").each((_, pane) => {
    const n = pane.querySelectorAll(".pick-row:not(.pick-hidden)").length;
    total += n;
    if (n && firstHit < 0) firstHit = Number(pane.dataset.pane);
    const tab = html.find(`.gp-tab[data-tab="${pane.dataset.pane}"]`)[0];
    if (tab) {
      tab.dataset.hits = q ? String(n) : "";
      tab.classList.toggle("gp-tab-empty", !!q && !n);
    }
  });
  const active = html.find(".gp-tab.is-on")[0];
  const activeHits = active ? Number(active.dataset.hits || 0) : 0;
  if (q && !activeHits && firstHit >= 0) html.find(`.gp-tab[data-tab="${firstHit}"]`).trigger("click");
  html.find(".gp-empty").remove();
  if (q && !total) {
    html.find(".pick-list").append('<div class="gp-empty">Ничего не найдено</div>');
  }
}

export async function openGearPicker(actor) {
  const groups = await loadGearGroups();
  if (!groups.length) return ui.notifications.warn("Компендиумы снаряжения не найдены.");

  new Dialog({
    title: "📚 Библиотека снаряжения",
    content: gearPickerContent(groups),
    buttons: { close: { label: "Закрыть" } },
    default: "close",
    render: html => activateGearPicker(html, actor)
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-item-picker-dialog"], ...pickerPos(700, 680) }).render(true);
}
