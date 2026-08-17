// module/apps/elite-req-builder.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Конструктор требований Элитного архетипа — вкладка «ИНФО» его листа.
//
//  Три блока, и они не равны по силе (rules/elite-requirements.mjs):
//    ОСНОВНЫЕ  — раса, субраса, Черта, Покровительство. Не выполнено — архетип
//                не показывается в выборе вовсе;
//    ПРОЧИЕ    — Умение, Порча, Бесчестие, Характеристика, Опыт, свободная
//                строка. Не выполнено — красным, но взять можно;
//    ТАЛАНТЫ   — требуемые Таланты, считаются как прочие.
//
//  Раса, субраса, Черта и Талант кладутся перетаскиванием из компендиума: имя
//  и ключ берутся у самого документа, чтобы правило сверялось с тем же, чем
//  живёт лист, а не с набранной руками строкой.
//
//  Разметка строится строками, как Конструктор Механики: у записей разный
//  набор полей, и Handlebars пришлось бы разводить ветвлением на каждый вид.
// ════════════════════════════════════════════════════════════════════════════

import { PRIMARY_KINDS, SECONDARY_KINDS, PATRON_OPTIONS, blankEliteReq }
  from "../rules/elite-requirements.mjs";
import { CHARACTERISTICS, SKILL_RANKS } from "../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { specOptions } from "../constants/skill-specializations.mjs";
import { esc } from "../helpers/utils.mjs";

const FLAG = "warhammer-dbc";

/** Требования предмета в рабочем виде — всегда три списка. */
export function eliteReqOf(item) {
  const r = item?.system?.requirements ?? {};
  return {
    primary:   Array.isArray(r.primary)   ? foundry.utils.deepClone(r.primary)   : [],
    secondary: Array.isArray(r.secondary) ? foundry.utils.deepClone(r.secondary) : [],
    talents:   Array.isArray(r.talents)   ? foundry.utils.deepClone(r.talents)   : []
  };
}

/** Запись с новым id: по нему строка находится при правке и удалении. */
const newId = () => foundry.utils.randomID(8);

const opt = (value, label, on) =>
  `<option value="${esc(value)}"${on ? " selected" : ""}>${esc(label)}</option>`;

// ── Поля записи по её виду ──────────────────────────────────────────────────

function primaryFields(e, dis) {
  if (e.kind === "patron") {
    return `<select class="elite-req-field" data-field="key" ${dis}>
      ${PATRON_OPTIONS.map(p => opt(p.key, p.label, e.key === p.key)).join("")}</select>`;
  }
  // Раса, субраса и Черта приходят дропом: показываем, что лежит, и даём снять.
  const label = e.name || e.key || "";
  return label
    ? `<span class="elite-req-drop filled">${esc(label)}</span>
       <button type="button" class="elite-req-clear" title="Убрать" ${dis}>✕</button>`
    : `<span class="elite-req-drop empty">Перетащите ${e.kind === "race" ? "Расу" : e.kind === "subrace" ? "Субрасу" : "Черту"} сюда</span>`;
}

function secondaryFields(e, dis) {
  switch (e.kind) {
    case "skill": {
      const plain = Object.entries(SKILLS_DEF).map(([k, d]) =>
        opt(`plain:${k}`, d.label, e.scope !== "group" && e.skillKey === k)).join("");
      const groups = Object.entries(GROUP_SKILLS_DEF).map(([k, d]) =>
        opt(`group:${k}`, d.label, e.scope === "group" && e.skillKey === k)).join("");
      const specs = e.scope === "group"
        ? `<select class="elite-req-field" data-field="specKey" ${dis}>
             ${opt("", "— любая —", !e.specKey)}
             ${specOptions(e.skillKey).map(s => opt(s.ru || s.label, s.display, e.specKey === (s.ru || s.label))).join("")}
           </select>` : "";
      const ranks = Object.entries(SKILL_RANKS)
        .filter(([k]) => k !== "untrained")
        .map(([k, d]) => opt(k, d.label, e.rank === k)).join("");
      return `<select class="elite-req-field elite-req-skill" data-field="skill" ${dis}>
          <optgroup label="Навыки">${plain}</optgroup>
          <optgroup label="Групповые">${groups}</optgroup>
        </select>${specs}
        <select class="elite-req-field" data-field="rank" ${dis}>${ranks}</select>`;
    }
    case "characteristic": {
      const chars = Object.entries(CHARACTERISTICS)
        .map(([k, d]) => opt(k, d.label || k, e.charKey === k)).join("");
      return `<select class="elite-req-field" data-field="charKey" ${dis}>${chars}</select>
        <input type="number" class="elite-req-field elite-req-num" data-field="value" value="${e.value ?? 0}" ${dis}/>`;
    }
    case "other":
      return `<input type="text" class="elite-req-field elite-req-text" data-field="text"
        value="${esc(e.text || "")}" placeholder="Своё требование — читает ГМ" ${dis}/>`;
    default:
      // Порча, Бесчестие и потраченный опыт — одно число.
      return `<input type="number" class="elite-req-field elite-req-num" data-field="value" value="${e.value ?? 0}" ${dis}/>`;
  }
}

function talentFields(e, dis) {
  return e.name
    ? `<span class="elite-req-drop filled">${esc(e.name)}${e.specialization ? ` (${esc(e.specialization)})` : ""}</span>
       <button type="button" class="elite-req-clear" title="Убрать" ${dis}>✕</button>`
    : `<span class="elite-req-drop empty">Перетащите Талант сюда</span>`;
}

/** Одна строка блока. */
function rowHtml(block, e, kinds, dis) {
  const kindSel = kinds
    ? `<select class="elite-req-field elite-req-kind" data-field="kind" ${dis}>
        ${kinds.map(k => opt(k.key, k.label, e.kind === k.key)).join("")}</select>`
    : "";
  const fields = block === "primary" ? primaryFields(e, dis)
    : block === "secondary" ? secondaryFields(e, dis) : talentFields(e, dis);

  return `<div class="elite-req-row" data-block="${block}" data-id="${e.id}">
    ${kindSel}${fields}
    <button type="button" class="elite-req-remove" title="Удалить требование" ${dis}>✕</button>
  </div>`;
}

/** Блок целиком: заголовок, пояснение, строки и кнопка добавления. */
function blockHtml(block, title, hint, rows, kinds, canEdit) {
  const dis = canEdit ? "" : "disabled";
  return `<div class="item-section elite-req-block" data-block="${block}">
    <div class="item-section-title">${esc(title)}</div>
    <div class="trait-fx-hint">${hint}</div>
    <div class="elite-req-rows">${rows.map(e => rowHtml(block, e, kinds, dis)).join("")
      || `<div class="mc-hint">Пусто — требований этого рода нет.</div>`}</div>
    ${canEdit ? `<button type="button" class="mc-btn elite-req-add" data-block="${block}">➕ Требование</button>` : ""}
  </div>`;
}

/** Весь Конструктор требований — идёт в контекст листа предмета. */
export function buildEliteReqHtml(item, canEdit = true) {
  const req = eliteReqOf(item);
  return [
    blockHtml("primary", "ТРЕБОВАНИЯ: КТО ТЫ ЕСТЬ",
      "Раса, субраса, Черта, Покровительство. Не выполнено — архетип не показывается в выборе вовсе.",
      req.primary, PRIMARY_KINDS, canEdit),
    blockHtml("secondary", "ТРЕБОВАНИЯ: ЧЕГО ТЫ ДОБИЛСЯ",
      "Умения, Порча, Бесчестие, Характеристики, потраченный опыт, своё условие. Не выполнено — красным, но взять можно.",
      req.secondary, SECONDARY_KINDS, canEdit),
    blockHtml("talents", "ТРЕБУЕМЫЕ ТАЛАНТЫ",
      "Перетащите Таланты из компендиума. Считаются как прочие требования: помечаются красным, но выбор не запирают.",
      req.talents, null, canEdit)
  ].join("");
}

// ── Правка ──────────────────────────────────────────────────────────────────

const saveReq = (item, req) => item.update({ "system.requirements": req });

/** Заготовка новой записи блока. */
function blankEntry(block) {
  if (block === "primary")   return { id: newId(), kind: "race", key: "", name: "" };
  if (block === "secondary") return { id: newId(), kind: "skill", scope: "plain",
                                      skillKey: Object.keys(SKILLS_DEF)[0], rank: "knows", value: 0 };
  return { id: newId(), name: "", specialization: "", uuid: "" };
}

/** Обработчики Конструктора. Корень — элемент листа предмета. */
export function activateEliteReqListeners(root, item) {
  const el = root?.jquery ? root[0] : root;
  if (!el) return;

  const rowsOf = block => eliteReqOf(item)[block] || [];
  const rowId  = node => node.closest(".elite-req-row")?.dataset?.id;
  const blockOf = node => node.closest(".elite-req-row")?.dataset?.block
                       || node.closest(".elite-req-block")?.dataset?.block;

  el.querySelectorAll(".elite-req-add").forEach(btn => btn.addEventListener("click", async ev => {
    ev.preventDefault();
    const block = ev.currentTarget.dataset.block;
    const req = eliteReqOf(item);
    req[block] = [...(req[block] || []), blankEntry(block)];
    await saveReq(item, req);
  }));

  el.querySelectorAll(".elite-req-remove").forEach(btn => btn.addEventListener("click", async ev => {
    ev.preventDefault();
    const block = blockOf(ev.currentTarget), id = rowId(ev.currentTarget);
    const req = eliteReqOf(item);
    req[block] = (req[block] || []).filter(e => e.id !== id);
    await saveReq(item, req);
  }));

  // Крестик у дропа очищает саму ссылку, а не строку целиком: чаще меняют
  // перетащенное, чем убирают требование.
  el.querySelectorAll(".elite-req-clear").forEach(btn => btn.addEventListener("click", async ev => {
    ev.preventDefault();
    const block = blockOf(ev.currentTarget), id = rowId(ev.currentTarget);
    const req = eliteReqOf(item);
    req[block] = (req[block] || []).map(e =>
      e.id === id ? { ...e, key: "", name: "", uuid: "", specialization: "" } : e);
    await saveReq(item, req);
  }));

  el.querySelectorAll(".elite-req-field").forEach(node => node.addEventListener("change", async ev => {
    const block = blockOf(ev.currentTarget), id = rowId(ev.currentTarget);
    const field = ev.currentTarget.dataset.field;
    const raw = ev.currentTarget.value;
    const req = eliteReqOf(item);

    req[block] = (req[block] || []).map(e => {
      if (e.id !== id) return e;
      // Смена вида обнуляет поля прежнего: у Порчи и Умения общего мало.
      if (field === "kind") return { ...blankEntry(block), id: e.id, kind: raw };
      if (field === "skill") {
        const [scope, key] = String(raw).split(":");
        return { ...e, scope, skillKey: key, specKey: scope === "group" ? e.specKey : undefined,
                 label: (scope === "group" ? GROUP_SKILLS_DEF : SKILLS_DEF)[key]?.label || key };
      }
      if (field === "value") return { ...e, value: Number(raw) || 0 };
      return { ...e, [field]: raw };
    });
    await saveReq(item, req);
  }));

  // Дроп расы, субрасы, Черты и Таланта: имя и ключ берём у документа.
  el.querySelectorAll(".elite-req-row").forEach(row => {
    row.addEventListener("dragover", ev => { ev.preventDefault(); row.classList.add("elite-req-over"); });
    row.addEventListener("dragleave", () => row.classList.remove("elite-req-over"));
    row.addEventListener("drop", async ev => {
      ev.preventDefault();
      row.classList.remove("elite-req-over");
      let data = null;
      try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
      if (!data?.uuid) return;
      const doc = await fromUuid(data.uuid).catch(() => null);
      if (!doc) return ui.notifications?.warn("Документ не найден — возможно, компендиум изменился.");

      const block = row.dataset.block, id = row.dataset.id;
      const req = eliteReqOf(item);
      const entry = (req[block] || []).find(e => e.id === id);
      if (!entry) return;

      const wanted = block === "talents" ? ["talent"]
        : entry.kind === "race" ? ["race"] : entry.kind === "subrace" ? ["subrace"] : ["trait"];
      if (!wanted.includes(doc.type)) {
        return ui.notifications?.warn(`Сюда нужен ${wanted[0]}, а перетащено: ${doc.type}.`);
      }

      req[block] = (req[block] || []).map(e => e.id === id ? {
        ...e, uuid: doc.uuid, name: doc.name,
        key: doc.system?.key || e.key || "",
        ...(block === "talents" ? { specialization: doc.system?.specialization || "" } : {})
      } : e);
      await saveReq(item, req);
    });
  });
}

export { FLAG as ELITE_REQ_FLAG };
