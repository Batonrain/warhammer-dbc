// module/sheets/tabs/healing.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Лечение и первая помощь. Функции принимают медика/пациента, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../../constants/roll-icons.mjs";
import { hasRuleFlag } from "../../rules/flags.mjs";
import { computeWoundHealing } from "./wounds.mjs";
import { woundLevel } from "../../rules/wound-tier.mjs";
import { esc } from "../../helpers/utils.mjs";

/** Диалог лечения: себя или выбранной цели (тест Медики/Стойкости). */
export function showHealingDialog(medic) {
  const tgt = [...(game.user.targets ?? [])][0]?.actor || null;
  const hasTgt = !!tgt && tgt.id !== medic.id;
  const refHtml = `
    <details class="heal-reference" style="margin-top:6px;font-size:0.82em;">
      <summary style="cursor:pointer;font-weight:bold;">📖 Справка по лечению</summary>
      <div style="padding:4px 2px;line-height:1.35;">
        <b>Уровни ранения</b> (потеря Ран): Лёгкое — до T.b×2; Тяжёлое — больше T.b×2; Критическое — Отрицательные Раны (крит. урон).<br/>
        <b>Первая Помощь</b> (5 Ходов; 1 раз после урона, провал = использование): Лёгкое Medicae+10 (I.b Ран), Тяжёлое Medicae+0 (2), Критическое Medicae−10 (1).<br/>
        <b>Пассивное</b> (раз в сутки): Лёгкое 1; Тяжёлое — тест T+0 на 1; Критическое — нет.<br/>
        <b>Отдых</b> (сутки, без тяжёлой работы/боёв): Лёгкое ½T.b; Тяжёлое 1; Критическое — тест T+0 на 1.<br/>
        <b>Постельный режим</b> (сутки, лёжа): Лёгкое T.b; Тяжёлое ½T.b (окр.▲); Критическое 1.<br/>
        <b>Мед. уход</b>: Medicae+0 (лёгкий/тяжёлый) сокращает период до 8 часов; Medicae−10 (критический) — лечится как тяжёлый, но раз в сутки.<br/>
        <b>Физиология Астартес</b>: всегда считается отдыхающим; реальный отдых = постельный режим; полный постельный режим не ускоряет сверх этого.<br/>
        <b>Прижигание</b>: раскалённым предметом — 1d5 Усталости и 1d10 урона в Т, цель фиксируют или тест W−20; иногда останавливает заражение через рану.<br/>
        <b>Бесполезные конечности/Ампутация</b>: лечение перелома — 5 мин + Medicae+0 (конечность бесполезна 2d10−T.b сут.). Без помощи 2×T.b ч — перманентно; ампутация Medicae−10 (провал → Кровотечение, обрубок Medicae−10 или Гангрена).<br/>
        <b>Пришивание конечностей</b>: Medicae−30 (нужно качественное снаряжение); успех — восстановление 1d10+3−T.b сут.<br/>
        <b>Бионика/Кибернетика</b>: установка Medicae−30; провал — 1d10 непогл. R; успех — 1d10+3−T.b сут. адаптации.<br/>
        <b>Кома</b>: вывод раз в 10−T.b дней тестом Medicae−40 (нужен уход и питание).<br/>
        <b>Лечение болезней</b>: по умолчанию постельный режим; просто отдых −20, без отдыха −40; тест обычно раз в сутки.
      </div>
    </details>`;

  // Не <form>: содержимое DialogV2 уже внутри его формы, вложенная недопустима.
  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("heart","#ff8a8a")}Лечение</span></div>
      <div class="atk-dlg-row"><label>Пациент:</label>
        <select id="heal-patient">
          <option value="self">${esc(medic.name)} (себя)</option>
          ${hasTgt ? `<option value="target" selected>${esc(tgt.name)} (цель)</option>` : ""}
        </select>
      </div>
      <div class="atk-dlg-row"><label>Режим:</label>
        <select id="heal-mode">
          <option value="firstAid">Первая Помощь (тест Медики)</option>
          <option value="rest">Отдых (сутки)</option>
          <option value="bedRest">Постельный режим (сутки)</option>
          <option value="passive">Пассивное (сутки)</option>
        </select>
      </div>
      <div class="atk-dlg-row"><label title="Medicae: критический лечится как тяжёлый; период до 8 часов"><input type="checkbox" id="heal-care"/> Мед. уход</label></div>
      <div class="atk-dlg-row"><label>Мод. теста:</label><input type="number" id="heal-mod" value="0" style="width:60px;"/></div>
      <div class="atk-dlg-row"><label title="Напр. Мастер-Хирургеон +2">Доп. Раны:</label><input type="number" id="heal-bonus" value="0" style="width:60px;"/></div>
      <div id="heal-note" class="atk-range-info" style="font-size:0.84em;"></div>
      ${refHtml}
    </div>`;

  /** Кого лечим: выбор в окне, а не догадка — его читают и справка, и кнопка. */
  const patientOf = form =>
    (form.querySelector("#heal-patient")?.value === "target" ? tgt : medic);

  const updateNote = form => {
    const patient = patientOf(form);
    if (!patient) return;
    const lvl = woundLevel(patient.system);
    const parts = [
      `<b>Пациент:</b> ${esc(patient.name)}`,
      `<b>Уровень ранения:</b> ${lvl.label} (потеряно ${lvl.lost}${lvl.crit ? `, крит ${lvl.crit}` : ""}, T.b ${lvl.tb})`
    ];
    if (hasRuleFlag(patient, "healing.astartes")) parts.push("<i>Физиология Астартес: всегда считается отдыхающим.</i>");
    if (patient.system.wounds?.firstAidUsed) parts.push('<span style="color:#a33;">⚠ Первая Помощь уже оказана (нужен новый урон).</span>');
    form.querySelector("#heal-note").innerHTML = parts.join("<br/>");
  };

  return foundry.applications.api.DialogV2.wait({
    window: { title: "Лечение" },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 440 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "go", label: "Выполнить", icon: "fas fa-heart", default: true,
        callback: async (event, button) => {
          const form    = button.form;
          const patient = patientOf(form);
          if (!patient) {
            ui.notifications.warn("Нет выбранной цели — наведите таргет (T) на токен пациента.");
            return;
          }
          const num = sel => parseInt(form.querySelector(sel)?.value) || 0;
          await applyHealing(medic, patient, {
            mode:  form.querySelector("#heal-mode")?.value,
            care:  !!form.querySelector("#heal-care")?.checked,
            mod:   num("#heal-mod"),
            bonus: num("#heal-bonus")
          });
        }
      },
      { action: "cancel", label: "Отмена" }
    ],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form");
      // Один слушатель на форму: справка обновляется от любого выбора в окне.
      form.addEventListener("change", () => updateNote(form));
      updateNote(form);
    }
  });
}

/** Расчёт и применение лечения к пациенту + сообщение в чат. */
export async function applyHealing(medic, patient, { mode, care, mod, bonus }) {
  const lvl = woundLevel(patient.system);
  const tb = lvl.tb;
  // Физиология Астартес — возможность от правил, а не раса пациента.
  const isAstartes = hasRuleFlag(patient, "healing.astartes");
  const rolls = [];
  const lines = [];
  let heal = 0;
  const lblOf = { light: "Лёгкое", heavy: "Тяжёлое", critical: "Критическое" };
  const half = (n, up) => up ? Math.ceil(n / 2) : Math.floor(n / 2);
  const medSkill = () => medic.system.skills?.medicae?.total
    ?? ((medic.system.characteristics?.int?.value ?? 20) - 20);

  if (mode === "firstAid") {
    if (patient.system.wounds?.firstAidUsed) {
      ui.notifications.warn(`${patient.name}: Первая Помощь уже оказывалась после этого урона.`);
      return;
    }
    const testMod = ({ light: 10, heavy: 0, critical: -10 }[lvl.key]) + mod;
    const skill = medSkill();
    const eff = skill + testMod;
    const roll = await new Roll("1d100").evaluate();
    rolls.push(roll);
    const rv = roll.total;
    const success = rv <= eff;
    const deg = Math.floor(Math.abs(success ? eff - rv : rv - eff) / 10) + 1;
    const baseHeal = { light: medic.system.characteristics?.int?.bonus ?? 0, heavy: 2, critical: 1 }[lvl.key];
    lines.push(`${rollIcon("heart","#ff8a8a")}<b>Первая Помощь</b> (${lvl.label}): Медика ${skill}${testMod >= 0 ? "+" : ""}${testMod} → порог <b>${eff}</b>, бросок <b>${rv}</b> — ${success ? `<span class="roll-success">Успех (${deg})</span>` : `<span class="roll-failure">Провал (${deg})</span>`}`);
    heal = success ? Math.max(0, baseHeal + bonus) : 0;
    if (!success) lines.push("Восстановление: 0 — Первая Помощь израсходована.");
    try { await patient.update({ "system.wounds.firstAidUsed": true }); } catch {}
  } else {
    let effMode = mode;
    if (isAstartes) {
      if (mode === "passive") effMode = "rest";
      else if (mode === "rest") effMode = "bedRest";
      if (effMode !== mode) lines.push(`<i>Астартес: режим «${({ passive: "Пассивное", rest: "Отдых" })[mode]}» считается как «${({ rest: "Отдых", bedRest: "Постельный режим" })[effMode]}».</i>`);
    }
    let key = lvl.key;
    if (care) {
      const careMod = (lvl.key === "critical" ? -10 : 0) + mod;
      const eff = medSkill() + careMod;
      const roll = await new Roll("1d100").evaluate();
      rolls.push(roll);
      const ok = roll.total <= eff;
      if (lvl.key === "critical") {
        lines.push(`${rollIcon("heart","#ff8a8a")}<b>Мед. уход</b> (крит): Медика−10${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${ok ? `<span class="roll-success">Успех — лечится как тяжёлый</span>` : `<span class="roll-failure">Провал</span>`}`);
        if (ok) key = "heavy";
      } else {
        lines.push(`${rollIcon("heart","#ff8a8a")}<b>Мед. уход</b>: Медика+0${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${ok ? `<span class="roll-success">Успех — период до 8 часов</span>` : `<span class="roll-failure">Провал</span>`}`);
      }
    }
    const modeLabel = { rest: "Отдых", bedRest: "Постельный режим", passive: "Пассивное лечение" }[effMode];
    let amount = 0, needT = false;
    if (effMode === "rest") {
      amount = { light: half(tb), heavy: 1, critical: 0 }[key];
      if (key === "critical") needT = true;
    } else if (effMode === "bedRest") {
      amount = { light: tb, heavy: half(tb, true), critical: 1 }[key];
    } else {
      amount = { light: 1, heavy: 0, critical: 0 }[key];
      if (key === "heavy") needT = true;
    }
    if (needT) {
      const tv = (patient.system.characteristics?.t?.value ?? 0) + mod;
      const roll = await new Roll("1d100").evaluate();
      rolls.push(roll);
      const ok = roll.total <= tv;
      lines.push(`${rollIcon("heart","#8fd0ff")}<b>${modeLabel}</b> (${lblOf[key]}): тест T+0${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${tv}</b>, бросок <b>${roll.total}</b> — ${ok ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`);
      heal = ok ? Math.max(0, 1 + bonus) : 0;
    } else {
      heal = amount > 0 ? Math.max(0, amount + bonus) : 0;
      lines.push(`${rollIcon("heart","#8fd0ff")}<b>${modeLabel}</b> (${lblOf[key]}): восстановление <b>${amount}</b>${bonus && amount > 0 ? ` + ${bonus} (доп.)` : ""} Ран${amount === 0 ? " — нет лечения" : ""}.`);
    }
  }

  const missing = Math.max(0, (patient.system.wounds?.max ?? 0) - (patient.system.wounds?.value ?? 0))
    + (patient.system.wounds?.critical ?? 0);
  const applied = Math.min(heal, missing);
  if (applied > 0) {
    try {
      await patient.update(computeWoundHealing(patient.system, applied));
      lines.push(`${rollIcon("heart","#ff8a8a")}Восстановлено Ран: <b>${applied}</b>${applied < heal ? " (ограничено нехваткой)" : ""}.`);
    } catch {
      lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — восстановите <b>${applied}</b> Ран вручную (нужен ГМ).`);
    }
  }

  const rollMode = game.settings.get("core", "rollMode");
  const msg = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: medic }),
    content: `<div class="wh-roll-result"><div class="roll-header">${rollIcon("heart","#ff8a8a")}Лечение — ${esc(patient.name)}</div><div class="roll-threshold">${lines.join("<br/>")}</div></div>`,
    rolls,
    sound: rolls.length ? CONFIG.sounds.dice : undefined
  }, rollMode);
  await ChatMessage.create(msg);
}
