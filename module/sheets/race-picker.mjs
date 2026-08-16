// module/sheets/race-picker.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Выбор расы и субрасы из библиотеки — то, что открывается кликом по пустому
//  слоту в шапке листа. Второй путь к тому же результату — перетащить предмет
//  из компендиума; оба ведут в applyRace/applySubrace.
//
//  Окно говорит на языке остальных пикеров системы (wh-item-picker: липкий
//  поиск, группы со счётчиком, строка с раскрытием) — своя разметка тут была
//  бы третьим диалектом на одном листе.
//
//  Строка показывает то, по чему расу ВЫБИРАЮТ: сильные Характеристики и
//  сколько у расы субрас. Остальное — в раскрытии, чтобы список оставался
//  списком, а не простынёй.
//
//  Субрасы показываются только свои: чужая раса всё равно была бы отклонена
//  применением, и предлагать её значит звать игрока на ошибку.
// ════════════════════════════════════════════════════════════════════════════

import { raceGroupList, subracesOf, raceDef, raceEntries, subraceEntries } from "../apps/race-library.mjs";
import { applyRace, applySubrace } from "../apps/races.mjs";
import { esc } from "../helpers/utils.mjs";
import { disabledRaceKeys } from "../constants/features.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { centerPicker } from "./picker-ui.mjs";

/** Средний человек — 25. Всё заметно выше и есть «за что брать эту расу». */
const STRONG = 30;

/** Сильные стороны расы одной строкой: до четырёх Характеристик по убыванию. */
export function strongChars(chars = {}) {
  return Object.entries(chars)
    .filter(([k, v]) => CHARACTERISTICS[k] && Number(v) >= STRONG)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${CHARACTERISTICS[k].abbr} ${v}`)
    .join(" · ");
}

/** Все Характеристики сеткой — в раскрытии строки. */
const charGrid = (chars = {}) => {
  const cells = Object.entries(CHARACTERISTICS)
    .filter(([k]) => Number(chars[k]))
    .map(([k, c]) => `<span class="rp-char" title="${esc(c.label)}">
      <b>${esc(c.abbr)}</b>${Number(chars[k])}</span>`).join("");
  return cells ? `<div class="rp-chars">${cells}</div>` : "";
};

const row = ({ key, name, badge, meta, detail, current }) => `
  <div class="pick-row${current ? " rp-current" : ""}" data-key="${esc(key)}" data-name="${esc(name.toLowerCase())} ${esc((meta || "").toLowerCase())}">
    <div class="pick-head">
      <button type="button" class="pick-exp" title="Показать подробности" ${detail ? "" : "disabled"}>▸</button>
      <span class="pick-name rp-pick">${esc(name)}</span>
      ${badge ? `<span class="pick-tier">${esc(badge)}</span>` : ""}
      <span class="pick-req">${esc(meta || "")}</span>
      ${current
    ? `<span class="rp-current-mark" title="Сейчас выбрана">✓</span>`
    : `<button type="button" class="pick-add rp-pick" title="Выбрать">＋</button>`}
    </div>
    ${detail ? `<div class="pick-desc" style="display:none;">${detail}</div>` : ""}
  </div>`;

const section = (label, rows) => `
  <div class="pick-group">
    <div class="pick-group-head">${esc(label)} <span class="pick-count">${rows.length}</span></div>
    <div class="pick-group-body">${rows.join("")}</div>
  </div>`;

function raceRows(raceKey) {
  const offRaces = disabledRaceKeys();
  const all = raceEntries();
  return raceGroupList().map(g => ({
    label: g.label,
    races: g.races.filter(r => r.key === raceKey || !offRaces.includes(r.key))
  })).filter(g => g.races.length).map(g => section(g.label, g.races.map(r => {
    const def = all[r.key] || {};
    const subs = subracesOf(r.key).length;
    const desc = def.desc ? `<p class="rp-desc-text">${esc(def.desc)}</p>` : "";
    const detail = charGrid(def.chars) + desc;
    return row({
      key: r.key, name: r.label, current: r.key === raceKey,
      badge: subs ? `субрас: ${subs}` : "",
      meta: strongChars(def.chars),
      detail: detail || ""
    });
  }))).join("");
}

function subraceRows(raceKey, subKey) {
  const list = subracesOf(raceKey);
  const all = subraceEntries();
  return section(raceDef(raceKey)?.label || raceKey, list.map(s => {
    const def = all[s.key] || {};
    const mods = Object.entries(def.charMods || {})
      .filter(([k, v]) => CHARACTERISTICS[k] && Number(v))
      .map(([k, v]) => `${CHARACTERISTICS[k].abbr} ${Number(v) > 0 ? "+" : ""}${v}`).join(" · ");
    const drops = (def.removesTraits || []).length
      ? `<p class="rp-drops">Снимает Черты: ${esc(def.removesTraits.join(", "))}</p>` : "";
    const detail = (def.effect ? `<p class="rp-desc-text">${esc(def.effect)}</p>` : "") + drops;
    return row({
      key: s.key, name: s.label, current: s.key === subKey,
      badge: def.cost ? `${def.cost} оч.` : "",
      meta: mods || (def.god ? `Бог: ${def.god}` : ""),
      detail
    });
  }));
}

/**
 * @param {Actor} actor
 * @param {{subrace?: boolean}} opts  subrace:true — выбор субрасы текущей расы
 */
export async function openRacePicker(actor, { subrace = false } = {}) {
  const raceKey = actor.system.race || "";

  let body;
  if (subrace) {
    if (!raceKey) return ui.notifications?.warn("Сначала выберите расу.");
    body = subracesOf(raceKey).length
      ? subraceRows(raceKey, actor.system.subrace || "")
      : `<div class="rp-none">У расы «${esc(raceDef(raceKey)?.label || raceKey)}» субрас нет.</div>`;
  } else {
    body = raceRows(raceKey);
  }

  await foundry.applications.api.DialogV2.wait({
    window: { title: subrace ? "Выбор субрасы" : "Выбор расы" },
    classes: ["warhammer-dbc", "wh-holo", "wh-item-picker-dialog", "wh-race-picker"],
    position: { width: 560, height: 620 },
    content: `<div class="wh-item-picker">
      <input type="text" class="pick-search" placeholder="Поиск по названию…" autofocus/>
      <div class="pick-list">${body}</div>
      <div class="rp-empty" style="display:none;">Ничего не найдено.</div>
    </div>`,
    buttons: [{ action: "close", label: "Закрыть", default: true }],
    rejectClose: false,
    render: (_event, dialog) => {
      const root = dialog.element;

      const choose = async key => {
        dialog.close();
        if (subrace) await applySubrace(actor, key);
        else await applyRace(actor, key);
      };
      root.querySelectorAll(".rp-pick").forEach(el =>
        el.addEventListener("click", () => choose(el.closest(".pick-row").dataset.key)));

      root.querySelectorAll(".pick-exp").forEach(btn =>
        btn.addEventListener("click", () => {
          const desc = btn.closest(".pick-row").querySelector(".pick-desc");
          if (!desc) return;
          const open = desc.style.display !== "none";
          desc.style.display = open ? "none" : "";
          btn.textContent = open ? "▸" : "▾";
        }));

      // Поиск идёт по имени И по сильным Характеристикам: «Ag 40» — такой же
      // осмысленный запрос, как имя расы. Группа без совпадений прячется
      // целиком, иначе её липкий заголовок висит над пустотой.
      root.querySelector(".pick-search")?.addEventListener("input", ev => {
        const q = ev.currentTarget.value.trim().toLowerCase();
        let shown = 0;
        root.querySelectorAll(".pick-row").forEach(el => {
          const hit = !q || el.dataset.name.includes(q);
          el.classList.toggle("pick-hidden", !hit);
          if (hit) shown++;
        });
        root.querySelectorAll(".pick-group").forEach(g => {
          const vis = g.querySelectorAll(".pick-row:not(.pick-hidden)").length;
          g.classList.toggle("pick-hidden", !vis);
          const c = g.querySelector(".pick-count");
          if (c) c.textContent = vis;
        });
        const empty = root.querySelector(".rp-empty");
        if (empty) empty.style.display = shown ? "none" : "";
      });

      centerPicker(globalThis.$(root));
    }
  });
}
