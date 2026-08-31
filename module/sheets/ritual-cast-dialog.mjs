// module/sheets/ritual-cast-dialog.mjs
// ════════════════════════════════════════════════════════════════════════
//  Диалог «Провести ритуал» — кнопка на строке ритуала листа персонажа
//  (module/sheets/tabs/rituals.mjs, templates/actor/parts/tab-psy.hbs).
//
//  Разметка/стили — перенесены из бывшей вкладки «Ритуалы» окна «Завеса и
//  Мистика» (.wv-block/.wv-rit-*, styles/ui/veil.css) почти без изменений:
//  тот же грид, те же пилюли-модификаторы с цветом pos/neg, та же сводка
//  порога. Обёрнуто в .wh-veil-app — оттуда CSS-переменные темы (--wv-*).
//  Отличие от прежней консоли — книжные числа предмета (путь теста,
//  Сложность/testMod, Отвращение/Провал) READ-ONLY, полей выбора
//  Ритуалиста/пресета/предмета нет (актор и предмет уже даны кнопкой):
//  редактируются только ситуативные модификаторы конкретного проведения.
//  Решение пользователя 29.08.2026, план — C:\Users\Derbius\.claude\plans\
//  dazzling-weaving-taco.md.
//
//  Сама математика/бросок — module/apps/ritual-cast.mjs (ritualThreshold/
//  castRitual), тот же приём диалога с живым порогом, что и у Навыка/Атаки:
//  один readRitualForm(form), живой пересчёт на любой change/input.
// ════════════════════════════════════════════════════════════════════════

import { newRitualState, ritualThreshold, castRitual } from "../apps/ritual-cast.mjs";
import { RITUAL_TYPES_MAP, RITUAL_SUMMON_MODS, CURSE_FAMILIARITY, CURSE_SYMPATHY, SUMMON_FORMS,
         ritualPathOptions, buildRitualSkills } from "../constants/rituals.mjs";
import { esc } from "../helpers/utils.mjs";

const sgn = n => (n >= 0 ? "+" : "") + n;

/** Ситуативные модификаторы, вписанные игроком в форму. `paths` — из ritualPathOptions. */
function readRitualForm(form, paths) {
  const el = sel => form.querySelector(sel);
  const all = sel => [...form.querySelectorAll(sel)];
  const summon = {};
  all("[data-summon]").forEach(cb => { summon[cb.dataset.summon] = cb.checked; });
  const curseSymp = {};
  all("[data-symp]").forEach(cb => { curseSymp[cb.dataset.symp] = cb.checked; });
  const extraSel = {};
  all("[data-extra]").forEach(cb => { extraSel[cb.dataset.extra] = cb.checked; });

  const pathKey = el("#rit-path")?.value || "default";
  const path = paths.find(p => p.key === pathKey) || paths[0];

  const assistants = Math.max(0, parseInt(el("#rit-assistants")?.value) || 0);
  const assistSacrificed = Math.min(assistants, Math.max(0, parseInt(el("#rit-assist-sac")?.value) || 0));

  return {
    skillValue: path.skillValue, testChar: path.testChar, gmMod: path.gmMod,
    assistants, assistSacrificed,
    curseFam: el("#rit-curse-fam")?.value || "close",
    psyker: !!el("#rit-psyker")?.checked,
    psykerBonus: Math.max(0, parseInt(el("#rit-psyker-bonus")?.value) || 0),
    numMod: parseInt(el("#rit-num-mod")?.value) || 0,
    demonName: (el("#rit-demon-name")?.value || "").trim(),
    demonInf: Math.max(0, parseInt(el("#rit-demon-inf")?.value) || 0),
    summon, curseSymp, extraSel
  };
}

/** Пилюля-модификатор — та же разметка/классы, что были в консоли Завесы. */
function modPill(key, label, value, attr, checked = false) {
  const pos = value >= 0;
  return `<label class="wv-rit-mod ${checked ? "on" : ""} ${pos ? "pos" : "neg"}">
    <input type="checkbox" ${attr}="${key}" ${checked ? "checked" : ""}/>
    <span class="wv-rit-modv">${sgn(value)}</span><span>${esc(label)}</span>
  </label>`;
}

function breakdownRows(rows) {
  return rows.map(r => `<div class="wv-rit-brow ${r.primary ? "primary" : ""}">
    <span>${esc(r.label)}</span><b>${r.signed}</b></div>`).join("");
}

export async function showRitualCastDialog(actor, item) {
  if (!actor || !item) return;
  const base = newRitualState(actor, item);
  const d0 = ritualThreshold(base, actor, item);
  const s = item.system || {};
  const paths = ritualPathOptions(actor, item, buildRitualSkills);

  const assistMin = Number(s.assistMin) || 0;
  const assistMax = Number(s.assistMax) || 0;
  const hasAssists = !!(assistMin || assistMax);
  const typeLabel = RITUAL_TYPES_MAP[base.type]?.label || base.type;

  // Несколько равноценных путей теста (стр. 393-425: «...или Y, или Z...») —
  // дропдаун; один путь — как раньше, просто подпись без выбора.
  const pathBlock = paths.length > 1
    ? `<select id="rit-path" class="wv-rit-wide">${paths.map(p =>
        `<option value="${p.key}">${esc(p.label)}</option>`).join("")}</select>`
    : `<span class="wv-rit-wide">${d0.rows[0]?.label ? esc(d0.rows[0].label) : "— навык не задан —"}</span>`;

  const extraBlock = (s.extraMods || []).length ? `
    <div class="wv-block">
      <div class="wv-block-title">Модификаторы ритуала</div>
      <div class="wv-rit-mods">
        ${s.extraMods.map((m, i) => modPill(String(i), m.label, Number(m.value) || 0, "data-extra")).join("")}
      </div>
    </div>` : "";

  const summonBlock = d0.isSummonLike ? `
    <div class="wv-block">
      <div class="wv-block-title">Модификаторы призыва</div>
      <div class="wv-rit-mods">
        ${RITUAL_SUMMON_MODS.map(m => modPill(m.key, m.label, m.value, "data-summon")).join("")}
      </div>
    </div>` : "";

  // Бестиарий игроку не виден (ownership.PLAYER:"NONE") — демона и его Inf
  // называет ГМ за столом, поиск/токен на успехе делает он же
  // (module/apps/demon-summon.mjs). Только для type:"summon" (см. заголовок
  // castRitual) появляется токен — у Владычества/Связывания/Врат демон
  // просто уходит в −Inf модификатор и подпись карточки.
  const demonBlock = d0.isSummonLike ? `
    <div class="wv-block">
      <div class="wv-block-title">Демон</div>
      <div class="wv-rit-row">
        <label class="wv-rit-lbl" title="ГМ называет демона за столом — Бестиарий игроку не виден">Имя</label>
        <input type="text" id="rit-demon-name" class="wv-rit-wide" placeholder="напр. Кровожад"/>
      </div>
      <div class="wv-rit-row">
        <label class="wv-rit-lbl" title="−Inf демона идёт штрафом на тест (напр. Призыв Демонического Владыки)">Inf</label>
        <input type="number" id="rit-demon-inf" class="wv-rit-xs" value="0" min="0"/>
        ${base.type === "summon" ? `<span class="wv-hint">При успехе ГМ разместит токен на сцене.</span>` : ""}
      </div>
    </div>` : "";

  const curseBlock = d0.isCurse ? `
    <div class="wv-block">
      <div class="wv-block-title">Проклятье — знакомство и симпатия</div>
      <div class="wv-rit-row">
        <label class="wv-rit-lbl">Знакомство</label>
        <select id="rit-curse-fam" class="wv-rit-wide">${CURSE_FAMILIARITY.map(f =>
          `<option value="${f.key}" ${f.key === "close" ? "selected" : ""}>${sgn(f.value)} · ${esc(f.label)}</option>`).join("")}</select>
      </div>
      <div class="wv-rit-mods">
        ${CURSE_SYMPATHY.map(m => modPill(m.key, m.label, m.value, "data-symp")).join("")}
      </div>
    </div>` : "";

  const formsBlock = d0.isSummonLike ? `
    <div class="wv-block wv-lore">
      <div class="wv-block-title">Формы призыва</div>
      ${SUMMON_FORMS.map(f => `<div class="wv-form"><b>${esc(f.label)}</b> — ${esc(f.dur)}
        <div class="wv-form-note">${esc(f.note)}</div></div>`).join("")}
    </div>` : "";

  const reqWarnHtml = d0.reqOk ? "" : `<div class="wv-rit-unmet">
    <b>Требования не выполнены:</b>${d0.reqFailed.map(f => `<div>${esc(f)}</div>`).join("")}</div>`;

  const content = `
    <div class="wh-veil-app wv-ritual-tab">
      <div class="wv-rit-grid">
        <div class="wv-rit-form">
          <div class="wv-block">
            <div class="wv-block-title">${esc(item.name)}</div>
            <div class="wv-rit-row">
              <label class="wv-rit-lbl">Путь</label>
              ${pathBlock}
            </div>
            <div class="wv-rit-row">
              <label class="wv-rit-lbl">Тип</label><span>${esc(typeLabel)}</span>
              <label class="wv-rit-lbl">Сложность</label><span id="rit-gmmod-display">${sgn(base.gmMod)}</span>
              <label class="wv-rit-lbl">Отвращение/Провал</label><span>+${base.aversionPerFail}</span>
            </div>
            ${reqWarnHtml}
            <div class="wv-rit-row">
              ${hasAssists ? `<label class="wv-rit-lbl">Ассистенты (${assistMin}–${assistMax})</label>
              <input type="number" id="rit-assistants" class="wv-rit-xs" value="0" min="0"/>
              <label class="wv-rit-lbl" title="Сколько из присутствующих принесены в жертву в конце ритуала (стр. 393-425: +10 за каждого) — не больше числа ассистентов">Жертва</label>
              <input type="number" id="rit-assist-sac" class="wv-rit-xs" value="0" min="0" max="0"/>` : ""}
              <label class="wv-rit-cb" title="Псайкер-Ритуалист: +2×PR к тесту, но такой же бонус к броскам провала.">
                <input type="checkbox" id="rit-psyker"/> Псайкер
              </label>
              <input type="number" id="rit-psyker-bonus" class="wv-rit-xs" value="0" min="0" max="${d0.prMax}" title="До +2×PR = +${d0.prMax}"/>
            </div>
          </div>
          ${extraBlock}
          ${summonBlock}
          ${demonBlock}
          ${curseBlock}
        </div>

        <div class="wv-rit-side">
          <div class="wv-block wv-rit-summary">
            <div class="wv-block-title">Тест ритуала</div>
            <div class="wv-rit-break" id="rit-rows">${breakdownRows(d0.rows)}</div>
            <div class="wv-rit-threshold">Порог: <b id="rit-total-display">${d0.threshold}</b></div>
          </div>
          <div class="wv-block">
            <div class="wv-block-title">Нумерология</div>
            <div class="wv-rit-row">
              <label class="wv-rit-lbl" title="Суммарный ручной бонус Темпоральной/Геомантической синергии (дата/место)">Бонус дат/мест</label>
              <input type="number" id="rit-num-mod" class="wv-rit-xs" value="0"/>
            </div>
          </div>
          ${formsBlock}
        </div>
      </div>
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: `Ритуал: ${item.name}` },
    classes: ["warhammer-dbc", "wh-holo", "wh-ritual-cast-dialog"],
    position: { width: 580 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "cast", icon: "fas fa-hand-sparkles", label: "Провести", default: true,
        callback: async (event, button) => {
          const R = { ...base, ...readRitualForm(button.form, paths) };
          await castRitual(R, actor, { item });
          return true;
        }
      },
      { action: "cancel", label: "Отмена", callback: () => false }
    ],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form") || dialog.element;
      const display = form.querySelector("#rit-total-display");
      const rowsEl = form.querySelector("#rit-rows");
      const gmModEl = form.querySelector("#rit-gmmod-display");
      // Псайкер-Ритуалист (стр. 393): «может выбрать получить бонус ДО +2×PR» —
      // галочка сама подставляет максимум, а не заставляет искать/множить PR
      // вручную; поле бонуса остаётся редактируемым, если психик хочет взять
      // меньше (тот же бонус летит и в бросок провала — риск, а не чистый плюс).
      form.querySelector("#rit-psyker")?.addEventListener("change", ev => {
        const bonusEl = form.querySelector("#rit-psyker-bonus");
        if (bonusEl) bonusEl.value = ev.currentTarget.checked ? d0.prMax : 0;
      });
      // «Жертва» не может быть больше числа присутствующих ассистентов —
      // потолок и текущее значение поля следуют за ним живьём.
      form.querySelector("#rit-assistants")?.addEventListener("input", ev => {
        const sacEl = form.querySelector("#rit-assist-sac");
        if (!sacEl) return;
        const max = Math.max(0, parseInt(ev.currentTarget.value) || 0);
        sacEl.max = String(max);
        if ((parseInt(sacEl.value) || 0) > max) sacEl.value = String(max);
      });
      const update = () => {
        const R = { ...base, ...readRitualForm(form, paths) };
        const d = ritualThreshold(R, actor, item);
        display.textContent = d.threshold;
        rowsEl.innerHTML = breakdownRows(d.rows);
        if (gmModEl) gmModEl.textContent = sgn(R.gmMod || 0);
        form.querySelectorAll("[data-summon], [data-symp], [data-extra]").forEach(cb => {
          cb.closest(".wv-rit-mod")?.classList.toggle("on", cb.checked);
        });
      };
      form.addEventListener("change", update);
      form.addEventListener("input", update);
    }
  });
}
