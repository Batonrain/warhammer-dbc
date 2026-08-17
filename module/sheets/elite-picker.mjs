// module/sheets/elite-picker.mjs
//
// Элитные архетипы в шапке листа (корбук 91): выбор, покупка за опыт и
// дополнительные поля (кнопка «+» рядом с основным архетипом).
//
// Пикер устроен как пикер Талантов: строка на архетип, цена справа, требования
// подсвечиваются красным, кнопка «＋» покупает. Разница одна и она из правила
// (rules/elite-requirements.mjs): основные требования — «кто ты есть», и
// архетип, которому персонаж по ним не подходит, в список не попадает вовсе.
// Прочие требования и требуемые Таланты только красят строку: разрешить
// исключение вправе ГМ, поэтому покупка спрашивает, а не запрещает.
//
// Поле в шапке остаётся текстовым — свой архетип всегда можно вписать руками.

import { ELITE_ARCHETYPES } from "../constants/elite-archetypes.mjs";
import { checkEliteRequirements, eliteWho, eliteTakenCount, eliteCost, eliteCostNote }
  from "../rules/elite-requirements.mjs";
import { buyEliteArchetype } from "../apps/elite-buy.mjs";
import { centerPicker, pickerPos } from "./picker-ui.mjs";
import { esc } from "../helpers/utils.mjs";

/** Пак элитных архетипов: библиотека, которую ГМ правит прямо в игре. */
const ELITE_PACK = "warhammer-dbc.elite-archetypes";

/**
 * Список для пикера. Источник истины — компендиум: архетип, заведённый или
 * поправленный ГМом, должен попадать в выбор наравне с книжным. Константы
 * остаются запасным путём — пак может быть ещё не собран.
 */
export function eliteEntries() {
  try {
    const rows = [...(game.packs?.get(ELITE_PACK)?.index ?? [])]
      .map(e => ({
        name: e.name,
        race: e.system?.race || "Любая",
        god:  e.system?.god  || "",
        req:  e.system?.req  || "",
        uuid: e.uuid
      }))
      .filter(e => e.name);
    if (rows.length) return rows.sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
  } catch { /* вне игры или пак не собран — идём в константы */ }
  return ELITE_ARCHETYPES;
}

// Метки рас из книги → ключи рас и субрас листа.
const RACE_LABELS = {
  "Космодесантник": ["astartes"],
  "Человек":        ["human", "ogryn", "ratling", "navigator", "squat"],
  // Метка «Друкхари» покрывает и субрасы — так сказано в книге.
  "Друкхари":       ["drukhari", "truebornDrukhari", "mandrake", "wrack"],
  "Друкхари Истиннорожденный": ["truebornDrukhari"],
  "Сслит":          ["sslyth"],
  "Мандрагора":     ["mandrake"],
  "Развалина":      ["wrack"]
};

/**
 * Подходит ли метка расы элитного архетипа расе персонажа.
 *
 * Метка расы из книги (текстовое поле system.race) — старый способ отбора, он
 * остаётся для архетипов, которым требования Конструктором ещё не заведены:
 * пустой блок основных требований пропускает всех, и без этой проверки список
 * стал бы одинаковым для человека и для Астартес.
 */
export function eliteRaceMatch(actor, entry) {
  const r = String(entry.race || "Любая");
  if (/люб/i.test(r)) return true;
  const race = actor.system.race || "";
  const sub  = actor.system.subrace || "";
  // Метка может перечислять несколько рас через запятую.
  return r.split(/[,/]/).some(part => {
    const keys = RACE_LABELS[part.trim()];
    if (!keys) return false;
    return keys.includes(race) || keys.includes(sub);
  });
}

/**
 * Годен ли архетип персонажу: сперва требования Конструктора, а если их нет —
 * метка расы из книги.
 * @returns {{check: object, available: boolean}}
 */
export function eliteAvailability(actor, doc) {
  const req = doc?.system?.requirements;
  const hasReq = (req?.primary?.length || 0) > 0;
  const check = checkEliteRequirements(req, eliteWho(actor));
  return { check, available: hasReq ? check.available : eliteRaceMatch(actor, { race: doc?.system?.race }) };
}

/** Строка архетипа в пикере — устройство то же, что у строки Таланта. */
function eliteRow(doc, check, cost, note, taken) {
  const unmet = [...check.secondaryUnmet, ...check.talentsUnmet];
  const meta  = [doc.system?.race, doc.system?.god].filter(Boolean).join(" · ");
  const reqTxt = unmet.length
    ? `<span class="pick-req pick-req-fail" title="Не выполнено: ${esc(unmet.join(", "))}">${esc(unmet.join(", "))}</span>`
    : (doc.system?.req
      ? `<span class="pick-req pick-req-ok" title="Требования выполнены">${esc(doc.system.req)}</span>` : "");
  const manual = check.manual.length
    ? `<span class="pick-req pick-req-unknown" title="Проверяет ГМ">${esc(check.manual.join(", "))}</span>` : "";
  const costTxt = cost
    ? `<span class="pick-cost cost-${unmet.length ? "enemy" : "neutral"}" title="Базовая цена ${doc.system?.cost || 0}${note ? `, ${note}` : ""}">${cost} XP</span>`
    : "";
  const desc = esc(doc.system?.description || doc.system?.charBonus || "—");
  return `<div class="pick-row${unmet.length ? " pick-unmet" : ""}" data-name="${esc(String(doc.name).toLowerCase())}" data-id="${doc.id}">
    <div class="pick-head">
      <button type="button" class="pick-exp" title="Показать описание">▸</button>
      <span class="pick-name" title="Раскрыть">${esc(doc.name)}</span>
      <span class="pick-tier">${esc(meta)}</span>${reqTxt}${manual}${costTxt}
      <button type="button" class="pick-add" data-id="${doc.id}" title="Купить и добавить на лист">＋</button>
    </div>
    <div class="pick-desc" style="display:none;">
      ${desc}
      ${doc.system?.charBonus ? `<p><b>Бонусы:</b> ${esc(doc.system.charBonus)}</p>` : ""}
      ${doc.system?.freeTalents ? `<p><b>Бесплатные Таланты:</b> ${esc(doc.system.freeTalents)}</p>` : ""}
      ${doc.system?.gear ? `<p><b>Снаряжение:</b> ${esc(doc.system.gear)}</p>` : ""}
    </div>
  </div>`;
}

/**
 * Пикер элитных архетипов: доступные списком, недоступные по основным
 * требованиям — под спойлером (видеть, чего лишён, полезно, брать нельзя).
 * extraIndex оставлен для кнопки «+» в шапке: там архетип вписывается строкой.
 */
export async function openElitePicker(actor, extraIndex = null) {
  const pack = game.packs?.get(ELITE_PACK);
  if (!pack) {
    ui.notifications.warn(`Компендиум не найден: ${ELITE_PACK}`);
    return openEliteTextPicker(actor, extraIndex);
  }
  const docs = (await pack.getDocuments())
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));

  const taken = eliteTakenCount(actor);
  const note  = eliteCostNote(taken);

  const fit = [], rest = [];
  for (const d of docs) {
    const { check, available } = eliteAvailability(actor, d);
    (available ? fit : rest).push({ doc: d, check });
  }

  const rows = fit.map(({ doc, check }) =>
    eliteRow(doc, check, eliteCost(doc.system?.cost, taken), note, taken)).join("");

  const restRows = rest.map(({ doc, check }) => `
    <div class="pick-row pick-row-locked" data-name="${esc(String(doc.name).toLowerCase())}">
      <div class="pick-head">
        <span class="pick-name">${esc(doc.name)}</span>
        <span class="pick-req pick-req-fail" title="${esc(check.primaryUnmet.join(", ") || doc.system?.race || "")}">${esc(check.primaryUnmet.join(", ") || doc.system?.race || "не для этой расы")}</span>
        <button type="button" class="pick-add" disabled title="Персонаж не может стать этим — дело не в опыте">🔒</button>
      </div>
    </div>`).join("");

  const content = `<div class="wh-item-picker wh-elite-picker">
    <div class="pick-top">
      <input type="text" class="pick-search" placeholder="Поиск по названию…"/>
      <span class="elite-taken" title="Каждый следующий Элитный архетип вдвое дороже предыдущего">Уже взято: ${taken}${note ? ` · ${esc(note)}` : ""}</span>
    </div>
    <div class="pick-list">
      <div class="pick-group"><div class="pick-group-head"><span class="pick-caret">▾</span>Доступные<span class="pick-count">${fit.length}</span></div>
        <div class="pick-group-body">${rows || '<div class="ep-none">Подходящих записей нет — впишите свой архетип в поле шапки.</div>'}</div></div>
      ${rest.length ? `<div class="pick-group pick-collapsed pick-group-locked">
        <div class="pick-group-head" title="Свернуть / развернуть"><span class="pick-caret">▸</span>Недоступные<span class="pick-count">${rest.length}</span></div>
        <div class="pick-group-body">${restRows}</div></div>` : ""}
    </div>
  </div>`;

  const dlg = new Dialog({
    title: "Элитный архетип",
    content,
    buttons: { close: { label: "Закрыть" } },
    default: "close",
    render: html => {
      centerPicker(html);
      html.find(".pick-add").on("click", async ev => {
        ev.preventDefault(); ev.stopPropagation();
        const btn = ev.currentTarget;
        if (btn.disabled) return;
        const doc = docs.find(d => d.id === btn.dataset.id);
        if (!doc) return;
        const item = await buyEliteArchetype(actor, doc);
        if (!item) return;
        ui.notifications.info(`Взят Элитный архетип: ${doc.name}`);
        dlg.close();
      });
      const toggle = row => {
        const desc = row.querySelector(".pick-desc");
        if (!desc) return;
        const exp  = row.querySelector(".pick-exp");
        const open = desc.style.display !== "none";
        desc.style.display = open ? "none" : "block";
        if (exp) exp.textContent = open ? "▸" : "▾";
      };
      html.find(".pick-exp").on("click", ev => { ev.preventDefault(); toggle(ev.currentTarget.closest(".pick-row")); });
      html.find(".pick-name").on("click", ev => toggle(ev.currentTarget.closest(".pick-row")));
      html.find(".pick-group-head").on("click", ev => {
        const grp = ev.currentTarget.closest(".pick-group");
        const collapsed = grp.classList.toggle("pick-collapsed");
        const caret = grp.querySelector(".pick-caret");
        if (caret) caret.textContent = collapsed ? "▸" : "▾";
      });
      html.find(".pick-search").on("input", ev => {
        const q = ev.currentTarget.value.toLowerCase().trim();
        html.find(".pick-row").each((_, r) => {
          r.classList.toggle("pick-hidden", !!q && !(r.dataset.name || "").includes(q));
        });
      });
    }
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "wh-item-picker-dialog"], ...pickerPos(620, 680) });
  dlg.render(true);
}

/**
 * Запасной выбор строкой — пока пак не собран. Ничего не покупает: пишет имя
 * в поле шапки, как было до перевода архетипов в предметы.
 */
export function openEliteTextPicker(actor, extraIndex = null) {
  const cur = extraIndex == null
    ? (actor.system.eliteArchetype || "")
    : (actor.system.eliteArchetypesExtra?.[extraIndex] || "");
  const fit = [], rest = [];
  for (const e of eliteEntries()) (eliteRaceMatch(actor, e) ? fit : rest).push(e);

  const card = (e, dim) => `
    <button type="button" class="ep-item ${dim ? "dim" : ""} ${e.name === cur ? "on" : ""}"
            data-name="${esc(e.name)}">
      <span class="ep-name">${esc(e.name)}</span>
      <span class="ep-meta">${esc(e.race)}${e.god ? " · " + esc(e.god) : ""}</span>
      <span class="ep-req">${esc(e.req || "")}</span>
    </button>`;

  const dlg = new Dialog({
    title: "Элитный архетип",
    content: `<form class="wh-elite-picker">
      <input type="text" class="ep-search" placeholder="Поиск по названию или требованиям…"/>
      <div class="ep-sec">Доступные расе (${fit.length})</div>
      <div class="ep-list">${fit.map(e => card(e, false)).join("") || '<div class="ep-none">Для этой расы записей нет — впишите свой архетип вручную.</div>'}</div>
      ${rest.length ? `<details class="ep-rest"><summary>Прочие архетипы (${rest.length}) — требования не выполнены</summary>
        <div class="ep-list">${rest.map(e => card(e, true)).join("")}</div></details>` : ""}
      <div class="ep-custom">
        <label>Свой архетип</label>
        <input type="text" class="ep-own" value="${esc(cur)}" placeholder="Название своего элитного архетипа"/>
        <button type="button" class="ep-own-set">Записать</button>
      </div>
    </form>`,
    buttons: { close: { label: "Закрыть" } },
    default: "close",
    render: html => {
      const put = async (name) => {
        if (extraIndex == null) {
          await actor.update({ "system.eliteArchetype": name });
        } else {
          const arr = foundry.utils.deepClone(actor.system.eliteArchetypesExtra || []);
          arr[extraIndex] = name;
          await actor.update({ "system.eliteArchetypesExtra": arr });
        }
        dlg.close();
      };
      html.find(".ep-item").click(ev => put(ev.currentTarget.dataset.name));
      html.find(".ep-own-set").click(() => put(html.find(".ep-own").val().trim()));
      html.find(".ep-own").on("keydown", ev => {
        if (ev.key === "Enter") { ev.preventDefault(); put(ev.currentTarget.value.trim()); }
      });
      html.find(".ep-search").on("input", ev => {
        const q = ev.currentTarget.value.trim().toLowerCase();
        html.find(".ep-item").each((_, el) => {
          el.classList.toggle("ep-hidden", !!q && !el.textContent.toLowerCase().includes(q));
        });
      });
    }
  }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 560, height: 620 });
  dlg.render(true);
}

/**
 * Шапка листа: основной архетип открывается пикером, доп. архетипы — простой
 * текстовый список поверх system.eliteArchetype (тот остаётся первым/главным).
 */
export function activateEliteListeners(html, actor) {
  html.find(".elite-pick-btn").click(() => openElitePicker(actor));

  const getExtra = () => foundry.utils.deepClone(actor.system.eliteArchetypesExtra || []);
  html.find(".elite-add-btn").click(async ev => {
    ev.preventDefault();
    const arr = getExtra(); arr.push("");
    await actor.update({ "system.eliteArchetypesExtra": arr });
  });
  html.find(".elite-extra-input").on("change", async ev => {
    const i = parseInt(ev.currentTarget.dataset.index);
    const arr = getExtra(); if (arr[i] === undefined) return;
    arr[i] = ev.currentTarget.value;
    await actor.update({ "system.eliteArchetypesExtra": arr });
  });
  html.find(".elite-extra-remove").click(async ev => {
    ev.preventDefault();
    const i = parseInt(ev.currentTarget.dataset.index);
    const arr = getExtra(); arr.splice(i, 1);
    await actor.update({ "system.eliteArchetypesExtra": arr });
  });
  html.find(".elite-extra-pick-btn").click(ev =>
    openEliteTextPicker(actor, parseInt(ev.currentTarget.dataset.index)));
}
