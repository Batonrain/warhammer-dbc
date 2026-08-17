// module/apps/elite-req-builder.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Конструктор требований Элитного архетипа — вкладка «МЕХАНИКА» его листа,
//  под Конструктором выдачи: там всё, что у архетипа настраивается, а «ИНФО»
//  осталась книжной справкой.
//
//  Два блока (rules/elite-requirements.mjs):
//    ОБЯЗАТЕЛЬНЫЙ — не выполнено, и архетипа нет в пикере вовсе;
//    ВТОРИЧНЫЙ    — не выполнено, и требование красится красным, но взять можно.
//
//  Виды записей у блоков одни и те же: блоки различаются строгостью, а не тем,
//  что в них можно потребовать. Раса, субраса, Черта и Талант кладутся
//  перетаскиванием из компендиума — имя и ключ берутся у самого документа,
//  чтобы правило сверялось с тем же, чем живёт лист, а не с набранной руками
//  строкой.
//
//  «Одно из (ИЛИ)» — запись-контейнер со своими вложенными: выполнено, если
//  выполнена хоть одна. Вложенность одна: «одно из одного из» никому не нужно,
//  а разметку и правку это удвоило бы.
//
//  Разметка строится строками, как Конструктор Механики: у записей разный
//  набор полей, и Handlebars пришлось бы разводить ветвлением на каждый вид.
// ════════════════════════════════════════════════════════════════════════════

import { REQ_KINDS, reqDropType, PATRON_OPTIONS } from "../rules/elite-requirements.mjs";
import { CHARACTERISTICS, SKILL_RANKS } from "../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../constants/skills.mjs";
import { specOptions } from "../constants/skill-specializations.mjs";
import { esc } from "../helpers/utils.mjs";

const FLAG = "warhammer-dbc";

/** Требования предмета в рабочем виде — всегда два списка. */
export function eliteReqOf(item) {
  const r = item?.system?.requirements ?? {};
  return {
    primary:   Array.isArray(r.primary)   ? foundry.utils.deepClone(r.primary)   : [],
    secondary: Array.isArray(r.secondary) ? foundry.utils.deepClone(r.secondary) : []
  };
}

/** Запись с новым id: по нему строка находится при правке и удалении. */
const newId = () => foundry.utils.randomID(8);

const opt = (value, label, on) =>
  `<option value="${esc(value)}"${on ? " selected" : ""}>${esc(label)}</option>`;

/** Заготовка новой записи: вид по умолчанию — Раса, её меняют селектором. */
export function blankEntry(kind = "race") {
  const base = { id: newId(), kind };
  switch (kind) {
    case "skill":  return { ...base, scope: "plain", skillKey: Object.keys(SKILLS_DEF)[0],
                            rank: "knows", count: 1 };
    case "talent": return { ...base, name: "", specialization: "", uuid: "", count: 1 };
    case "or":     return { ...base, items: [] };
    case "patron": return { ...base, key: "" };
    case "other":  return { ...base, text: "" };
    case "corruption": case "infamy": case "xp": return { ...base, value: 0 };
    case "characteristic": return { ...base, charKey: Object.keys(CHARACTERISTICS)[0], value: 0 };
    default:       return { ...base, key: "", name: "", uuid: "" };  // раса, субраса, Черта
  }
}

// ── Поля записи по её виду ──────────────────────────────────────────────────

/** Счётчик «любые N» — только там, где считать есть что: разные специализации. */
const countField = (e, dis, title) =>
  `<label class="elite-req-count" title="${title}">любые
     <input type="number" class="elite-req-field elite-req-num" data-field="count"
            min="1" value="${Math.max(1, Number(e.count) || 1)}" ${dis}/>
   </label>`;

/** Зона перетаскивания: что лежит, и крестик, чтобы снять. */
function dropField(e, dis, what) {
  const label = e.name || e.key || "";
  return label
    ? `<span class="elite-req-drop filled">${esc(label)}${e.specialization ? ` (${esc(e.specialization)})` : ""}</span>
       <button type="button" class="elite-req-clear" title="Убрать" ${dis}>✕</button>`
    : `<span class="elite-req-drop empty">Перетащите ${what} сюда</span>`;
}

function fieldsHtml(e, dis) {
  switch (e.kind) {
    case "race":    return dropField(e, dis, "Расу");
    case "subrace": return dropField(e, dis, "Субрасу");
    case "trait":   return dropField(e, dis, "Черту");
    case "talent":
      // Счётчик нужен только Таланту без указанной специализации: «Hatred,
      // любые 3» — это три ненависти к разным целям, а не один Талант трижды.
      return dropField(e, dis, "Талант")
        + (e.specialization ? "" : countField(e, dis, "Сколько разных специализаций этого Таланта нужно"));

    case "patron":
      return `<select class="elite-req-field" data-field="key" ${dis}>
        ${opt("", "— не важно —", !e.key)}
        ${PATRON_OPTIONS.map(p => opt(p.key, p.label, e.key === p.key)).join("")}</select>`;

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
        <select class="elite-req-field" data-field="rank" ${dis}>${ranks}</select>
        ${e.scope === "group" && !e.specKey
          ? countField(e, dis, "Сколько разных специализаций этой группы нужно") : ""}`;
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

    case "or":
      return "";   // содержимое ИЛИ-группы рисуется отдельно, вложенными строками

    default:
      // Порча, Бесчестие и потраченный опыт — одно число.
      return `<input type="number" class="elite-req-field elite-req-num" data-field="value" value="${e.value ?? 0}" ${dis}/>`;
  }
}

/**
 * Одна строка. `path` — адрес записи внутри блока: «id» для верхнего уровня,
 * «id/subId» для вложенной в ИЛИ-группу. По нему обработчики находят запись, не
 * гадая, где она лежит.
 */
function rowHtml(block, e, dis, path) {
  const kinds = REQ_KINDS
    // Вложенная ИЛИ-группа не предлагается: вложенность одна.
    .filter(k => k.key !== "or" || !path.includes("/"))
    .map(k => opt(k.key, k.label, e.kind === k.key)).join("");

  const head = `<div class="elite-req-row${e.kind === "or" ? " elite-req-or" : ""}"
      data-block="${block}" data-path="${esc(path)}" data-kind="${esc(e.kind || "")}">
    <select class="elite-req-field elite-req-kind" data-field="kind" ${dis}>${kinds}</select>
    ${fieldsHtml(e, dis)}
    <button type="button" class="elite-req-remove" title="Удалить требование" ${dis}>✕</button>
  </div>`;

  if (e.kind !== "or") return head;

  const inner = (e.items || []).map(sub => rowHtml(block, sub, dis, `${path}/${sub.id}`)).join("");
  return `<div class="elite-req-group">
    ${head}
    <div class="elite-req-sub">
      ${inner || `<div class="mc-hint">Пусто — добавьте, из чего выбирать.</div>`}
      ${dis ? "" : `<button type="button" class="mc-btn elite-req-add-sub"
        data-block="${block}" data-path="${esc(path)}">➕ В группу «одно из»</button>`}
    </div>
  </div>`;
}

/** Блок целиком: заголовок, пояснение, строки и кнопка добавления. */
function blockHtml(block, title, hint, rows, canEdit) {
  const dis = canEdit ? "" : "disabled";
  return `<div class="item-section elite-req-block" data-block="${block}">
    <div class="item-section-title">${esc(title)}</div>
    <div class="trait-fx-hint">${hint}</div>
    <div class="elite-req-rows">${rows.map(e => rowHtml(block, e, dis, e.id)).join("")
      || `<div class="mc-hint">Пусто — требований этого рода нет.</div>`}</div>
    ${canEdit ? `<button type="button" class="mc-btn elite-req-add" data-block="${block}">➕ Требование</button>` : ""}
  </div>`;
}

/** Весь Конструктор требований — идёт в контекст листа предмета. */
export function buildEliteReqHtml(item, canEdit = true) {
  const req = eliteReqOf(item);
  return [
    blockHtml("primary", "ТРЕБОВАНИЯ: ОБЯЗАТЕЛЬНЫЕ",
      "Не выполнено — архетипа нет в выборе вовсе. Сюда идёт то, кем персонаж должен быть: раса, субраса, Черта, Покровительство.",
      req.primary, canEdit),
    blockHtml("secondary", "ТРЕБОВАНИЯ: ВТОРИЧНЫЕ",
      "Не выполнено — требование красится красным во второй строке пикера, но взять архетип можно: разрешить исключение вправе ГМ.",
      req.secondary, canEdit)
  ].join("");
}

// ── Правка ──────────────────────────────────────────────────────────────────

const saveReq = (item, req) => item.update({ "system.requirements": req });

/**
 * Найти запись по адресу «id» или «id/subId» и заменить её тем, что вернёт fn.
 * Вернёт fn null — запись удаляется. Так одна функция обслуживает и верхний
 * уровень, и вложенные в ИЛИ-группу.
 */
function editAt(list, path, fn) {
  const [head, sub] = String(path).split("/");
  const out = [];
  for (const e of list || []) {
    if (e.id !== head) { out.push(e); continue; }
    if (!sub) {
      const next = fn(e);
      if (next) out.push(next);
      continue;
    }
    out.push({ ...e, items: editAt(e.items || [], sub, fn) });
  }
  return out;
}

/** Запись по адресу — нужна дропу, чтобы понять, какой тип документа он ждёт. */
function findAt(list, path) {
  const [head, sub] = String(path).split("/");
  const e = (list || []).find(x => x.id === head);
  if (!e || !sub) return e || null;
  return (e.items || []).find(x => x.id === sub) || null;
}

/** Обработчики Конструктора. Корень — элемент листа предмета. */
export function activateEliteReqListeners(root, item) {
  const el = root?.jquery ? root[0] : root;
  if (!el) return;

  const rowOf   = node => node.closest(".elite-req-row");
  const pathOf  = node => rowOf(node)?.dataset?.path;
  const blockOf = node => rowOf(node)?.dataset?.block
                       || node.closest(".elite-req-block")?.dataset?.block;

  /** Правка блока с сохранением — общий хвост всех обработчиков. */
  const apply = (block, fn) => {
    const req = eliteReqOf(item);
    req[block] = fn(req[block] || []);
    return saveReq(item, req);
  };

  el.querySelectorAll(".elite-req-add").forEach(btn => btn.addEventListener("click", async ev => {
    ev.preventDefault();
    const block = ev.currentTarget.dataset.block;
    await apply(block, list => [...list, blankEntry()]);
  }));

  el.querySelectorAll(".elite-req-add-sub").forEach(btn => btn.addEventListener("click", async ev => {
    ev.preventDefault();
    const { block, path } = ev.currentTarget.dataset;
    await apply(block, list => editAt(list, path,
      e => ({ ...e, items: [...(e.items || []), blankEntry()] })));
  }));

  el.querySelectorAll(".elite-req-remove").forEach(btn => btn.addEventListener("click", async ev => {
    ev.preventDefault();
    await apply(blockOf(ev.currentTarget), list => editAt(list, pathOf(ev.currentTarget), () => null));
  }));

  // Крестик у дропа очищает саму ссылку, а не строку целиком: чаще меняют
  // перетащенное, чем убирают требование.
  el.querySelectorAll(".elite-req-clear").forEach(btn => btn.addEventListener("click", async ev => {
    ev.preventDefault();
    await apply(blockOf(ev.currentTarget), list => editAt(list, pathOf(ev.currentTarget),
      e => ({ ...e, key: "", name: "", uuid: "", specialization: "" })));
  }));

  el.querySelectorAll(".elite-req-field").forEach(node => node.addEventListener("change", async ev => {
    const field = ev.currentTarget.dataset.field;
    const raw = ev.currentTarget.value;
    await apply(blockOf(ev.currentTarget), list => editAt(list, pathOf(ev.currentTarget), e => {
      // Смена вида обнуляет поля прежнего: у Порчи и Умения общего мало.
      if (field === "kind") return { ...blankEntry(raw), id: e.id };
      if (field === "skill") {
        const [scope, key] = String(raw).split(":");
        return { ...e, scope, skillKey: key, specKey: scope === "group" ? e.specKey : undefined,
                 label: (scope === "group" ? GROUP_SKILLS_DEF : SKILLS_DEF)[key]?.label || key };
      }
      if (field === "value") return { ...e, value: Number(raw) || 0 };
      if (field === "count") return { ...e, count: Math.max(1, Number(raw) || 1) };
      return { ...e, [field]: raw };
    }));
  }));

  // Дроп расы, субрасы, Черты и Таланта: имя и ключ берём у документа.
  el.querySelectorAll(".elite-req-row").forEach(row => {
    if (!reqDropType(row.dataset.kind)) return;
    row.addEventListener("dragover", ev => { ev.preventDefault(); row.classList.add("elite-req-over"); });
    row.addEventListener("dragleave", () => row.classList.remove("elite-req-over"));
    row.addEventListener("drop", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      row.classList.remove("elite-req-over");
      let data = null;
      try { data = JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { return; }
      if (!data?.uuid) return;
      const doc = await fromUuid(data.uuid).catch(() => null);
      if (!doc) return ui.notifications?.warn("Документ не найден — возможно, компендиум изменился.");

      const { block, path } = row.dataset;
      const entry = findAt(eliteReqOf(item)[block], path);
      if (!entry) return;

      const want = reqDropType(entry.kind);
      if (doc.type !== want) {
        return ui.notifications?.warn(`Сюда нужен ${want}, а перетащено: ${doc.type}.`);
      }

      await apply(block, list => editAt(list, path, e => ({
        ...e, uuid: doc.uuid, name: doc.name,
        key: doc.system?.key || e.key || "",
        ...(e.kind === "talent" ? { specialization: doc.system?.specialization || "" } : {})
      })));
    });
  });
}

export { FLAG as ELITE_REQ_FLAG };
