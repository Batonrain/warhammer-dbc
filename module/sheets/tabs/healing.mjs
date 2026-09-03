// module/sheets/tabs/healing.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Лечение и первая помощь. Функции принимают медика/пациента, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../../constants/roll-icons.mjs";
import { hasRuleFlag } from "../../rules/flags.mjs";
import { resolveTest } from "../../rules/resolve-test.mjs";
import { computeWoundHealing } from "./wounds.mjs";
import { woundLossUpdates as computeWoundDamage } from "../../rules/wounds.mjs";
import { woundLevel } from "../../rules/wound-tier.mjs";
import { esc } from "../../helpers/utils.mjs";
import { SECONDS_PER_DAY } from "../../constants/imperial-calendar.mjs";
import { openSurgeon } from "../../apps/surgeon.mjs";
import { addFatigue } from "./conditions.mjs";
import { worldTimeRemaining } from "../../rules/cooldown.mjs";
import { showDelegateTestPicker } from "../../rules/delegate-test.mjs";

const NS = "warhammer-dbc";

/** Части тела для Ампутации/Пришивания — ключ формы → состояние (стр. 30-31). */
const LIMB_TYPES = {
  hand: { label: "Кисть", flag: "lostHands", count: "lostHandsCount" },
  arm:  { label: "Рука",  flag: "lostArms",  count: "lostArmsCount"  },
  foot: { label: "Стопа", flag: "lostFeet",  count: "lostFeetCount"  },
  leg:  { label: "Нога",  flag: "lostLegs",  count: "lostLegsCount"  },
  eye:  { label: "Глаз",  flag: "lostEyes",  count: "lostEyesCount"  }
};

/** Уход при лечении болезней (стр. 232) — модификатор к тесту Medicae. */
const DISEASE_CARE_MOD = { bedRest: 0, rest: -20, none: -40 };

/** Бонус Медики медика — общий для всех режимов теста. */
function medicSkill(medic) {
  return medic.system.skills?.medicae?.total
    ?? ((medic.system.characteristics?.int?.value ?? 20) - 20);
}

/**
 * Модификатор от Талантов/Черт ПАЦИЕНТА к тесту Лечения над ним (wdbc-uez7,
 * делегированный тест — «Высокий болевой порог» и т.п.) — эффекты с
 * `target:"skill:medicae:recipient"` (resolve-test.mjs::effectAppliesTo).
 * Отдельно от Медики самого медика (его собственный бонус уже целиком в
 * `medic.system.skills.medicae.total` — постоянные бонусы от снаряжения и
 * Талантов туда уже включены пайплайном производных полей; ситуативных
 * записей с этой областью в паках пока нет, поэтому диалог не показывает под
 * них отдельных галочек, только этот, уже автоматический разбор).
 */
function patientHealingMod(patient) {
  if (!patient) return { total: 0, lines: [] };
  const { mods } = resolveTest({ actor: patient, kind: "skill", skill: "medicae", asRecipient: true });
  const total = mods.reduce((s, m) => s + (Number(m.value) || 0), 0);
  const lines = mods.map(m => `${esc(m.label)} (пациент): ${m.value >= 0 ? "+" : ""}${m.value}`);
  return { total, lines };
}

/** Итоговый Порог теста Медики: медик + автоматический мод. от пациента + свой довесок режима. */
function medicaeEff(medic, patient, extra = 0) {
  return medicSkill(medic) + patientHealingMod(patient).total + extra;
}

/**
 * Раз в 10−T.b дней (стр. 232) — секунд до следующей попытки вывести из
 * комы (0 — доступна прямо сейчас). worldTime-троттлинг из
 * module/rules/cooldown.mjs (wdbc-f4jt): дни ≥ 10−T.b дают interval ≤ 0,
 * что worldTimeRemaining уже трактует как «всегда доступно».
 */
export function comaWakeRemaining(testAt, worldTime, tb) {
  const days = 10 - (Number(tb) || 0);
  return worldTimeRemaining(testAt, worldTime, days * SECONDS_PER_DAY);
}

/**
 * Диалог лечения: себя, выбранной цели (таргет-рамка) или пациента,
 * присланного делегированным запросом (wdbc-uez7 — «Плечо: попросить
 * лечение»/module/rules/delegate-test.mjs). forcedPatient старше таргета —
 * открывший диалог по кнопке из чата уже знает, за кого его попросили.
 */
export function showHealingDialog(medic, { forcedPatient = null } = {}) {
  const tgt = forcedPatient || [...(game.user.targets ?? [])][0]?.actor || null;
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
        <b>Прижигание</b>: раскалённым предметом — 1d5 Усталости и 1d10 урон в Т, цель фиксируют или тест W−20; иногда останавливает заражение через рану.<br/>
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
          <option value="cauterize">Прижигание</option>
          <option value="amputate">Ампутация (Medicae−10)</option>
          <option value="reattach">Пришивание конечности (Medicae−30)</option>
          <option value="bionic">Бионика/Кибернетика (Medicae−30)</option>
          <option value="coma">Вывод из комы (Medicae−40)</option>
          <option value="disease">Лечение болезни</option>
        </select>
      </div>
      <div class="atk-dlg-row" data-mode="firstAid,rest,bedRest,passive"><label title="Medicae: критический лечится как тяжёлый; период до 8 часов"><input type="checkbox" id="heal-care"/> Мед. уход</label></div>
      <div class="atk-dlg-row" data-mode="amputate,reattach"><label>Часть тела:</label>
        <select id="heal-limb">
          ${Object.entries(LIMB_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}
        </select>
      </div>
      <div class="atk-dlg-row" data-mode="cauterize"><label title="Иначе — тест W−20, чтобы не вырваться (без доп. эффекта)"><input type="checkbox" id="heal-restrained"/> Пациент зафиксирован</label></div>
      <div class="atk-dlg-row" data-mode="disease"><label>Уход:</label>
        <select id="heal-disease-care">
          <option value="bedRest">Постельный режим (+0)</option>
          <option value="rest">Просто отдых (−20)</option>
          <option value="none">Ни то ни другое (−40)</option>
        </select>
      </div>
      <div class="atk-dlg-row" data-mode="disease"><label>Болезнь:</label><select id="heal-disease-item"><option value="">— не указано —</option></select></div>
      <div class="atk-dlg-row"><label>Мод. теста:</label><input type="number" id="heal-mod" value="0" style="width:60px;"/></div>
      <div class="atk-dlg-row" data-mode="firstAid,rest,bedRest,passive"><label title="Напр. Мастер-Хирургеон +2">Доп. Раны:</label><input type="number" id="heal-bonus" value="0" style="width:60px;"/></div>
      <div id="heal-note" class="atk-range-info" style="font-size:0.84em;"></div>
      ${refHtml}
    </div>`;

  /** Кого лечим: выбор в окне, а не догадка — его читают и справка, и кнопка. */
  const patientOf = form =>
    (form.querySelector("#heal-patient")?.value === "target" ? tgt : medic);

  const syncModeRows = form => {
    const mode = form.querySelector("#heal-mode")?.value;
    form.querySelectorAll("[data-mode]").forEach(row => {
      row.style.display = row.dataset.mode.split(",").includes(mode) ? "" : "none";
    });
  };

  const rebuildDiseaseSelect = (form, patient) => {
    const sel = form.querySelector("#heal-disease-item");
    if (!sel) return;
    const diseases = patient?.items?.filter(i => i.type === "disease" && i.system?.active) ?? [];
    const cur = sel.value;
    sel.innerHTML = `<option value="">— не указано —</option>`
      + diseases.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("");
    if (diseases.some(d => d.id === cur)) sel.value = cur;
  };

  const updateNote = form => {
    const patient = patientOf(form);
    syncModeRows(form);
    rebuildDiseaseSelect(form, patient);
    if (!patient) return;
    const lvl = woundLevel(patient.system);
    const parts = [
      `<b>Пациент:</b> ${esc(patient.name)}`,
      `<b>Уровень ранения:</b> ${lvl.label} (потеряно ${lvl.lost}${lvl.crit ? `, крит ${lvl.crit}` : ""}, T.b ${lvl.tb})`
    ];
    if (hasRuleFlag(patient, "healing.astartes")) parts.push("<i>Физиология Астартес: всегда считается отдыхающим.</i>");
    if (patient.system.wounds?.firstAidUsed) parts.push('<span style="color:#a33;">⚠ Первая Помощь уже оказана (нужен новый урон).</span>');
    const mode = form.querySelector("#heal-mode")?.value;
    if (mode === "coma") {
      const tb = patient.system.characteristics?.t?.bonus ?? 0;
      const testAt = patient.getFlag?.(NS, "comaTestAt");
      const remaining = comaWakeRemaining(testAt, game.time.worldTime, tb);
      if (remaining > 0) {
        parts.push(`<span style="color:#a33;">⚠ Следующая попытка доступна не раньше чем через ~${Math.ceil(remaining / SECONDS_PER_DAY)} сут.</span>`);
      }
    }
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
          const mode = form.querySelector("#heal-mode")?.value;
          const opts = {
            mode,
            care:       !!form.querySelector("#heal-care")?.checked,
            restrained: !!form.querySelector("#heal-restrained")?.checked,
            mod:        num("#heal-mod"),
            bonus:      num("#heal-bonus"),
            limb:       form.querySelector("#heal-limb")?.value,
            diseaseCare: form.querySelector("#heal-disease-care")?.value,
            diseaseId:   form.querySelector("#heal-disease-item")?.value
          };
          if (mode === "bionic") {
            runBionicInstall(medic, patient, opts);
          } else {
            await applyHealing(medic, patient, opts);
          }
        }
      },
      // Та же кнопка, что теперь у любого теста (wdbc-uez7,
      // actor-sheet.mjs::_showSkillRollDialog) — рядом с «Выполнить», не
      // отдельным путём: делегирует ТЕКУЩЕГО выбранного в форме пациента,
      // а не обязательно того, с кем диалог открыли изначально.
      {
        action: "delegate", label: "📨 Делегировать", icon: "fas fa-paper-plane",
        callback: async (event, button) => {
          const patient = patientOf(button.form);
          if (!patient) {
            ui.notifications.warn("Нет выбранной цели — наведите таргет (T) на токен пациента.");
            return;
          }
          await showDelegateTestPicker(patient, { title: "Делегировать Лечение", kind: "healing", label: "Лечение", buttonLabel: "Открыть Лечение" });
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

/** Хвостовая часть общего сообщения в чат — общая на все режимы этого файла. */
async function sendHealChatMsg(medic, patient, headerIcon, headerLabel, lines, rolls = []) {
  const rollMode = game.settings.get("core", "rollMode");
  const msg = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: medic }),
    content: `<div class="wh-roll-result"><div class="roll-header">${headerIcon}${headerLabel} — ${esc(patient.name)}</div><div class="roll-threshold">${lines.join("<br/>")}</div></div>`,
    rolls,
    sound: rolls.length ? CONFIG.sounds.dice : undefined
  }, rollMode);
  await ChatMessage.create(msg);
}

/** Прижигание (стр. 231): без теста, 1d5 Усталости + 1d10 урон в Т. */
async function applyCauterize(medic, patient, { restrained }) {
  const rolls = [];
  const fatigueRoll = await new Roll("1d5").evaluate();
  rolls.push(fatigueRoll);
  const dmgRoll = await new Roll("1d10").evaluate();
  rolls.push(dmgRoll);
  const tb = patient.system.characteristics?.t?.bonus ?? 0;
  const dmg = Math.max(0, dmgRoll.total - tb);

  const updates = computeWoundDamage(patient.system, dmg);
  const lines = [
    `${rollIcon("fire","#ff8a3a")}<b>Прижигание</b>: Усталость <b>${fatigueRoll.total}</b>, урон <b>${dmgRoll.total}</b> − T.b(${tb}) = <b>${dmg}</b> непоглощаемого урона.`
  ];
  try {
    await patient.update(updates);
  } catch {
    lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — примените вручную.`);
  }

  if (!restrained) {
    const wp = (patient.system.characteristics?.wp?.total ?? 0) - 20;
    const roll = await new Roll("1d100").evaluate();
    rolls.push(roll);
    const success = roll.total <= wp;
    lines.push(`${rollIcon("warn","#ffb84d")}Пациент не зафиксирован — тест W−20 → порог <b>${wp}</b>, бросок <b>${roll.total}</b> — ${success ? `<span class="roll-success">не пытается вырваться</span>` : `<span class="roll-failure">пытается вырваться</span>`}`);
  }

  try { await addFatigue(patient, fatigueRoll.total); } catch {}

  await sendHealChatMsg(medic, patient, rollIcon("fire","#ff8a3a"), "Прижигание", lines, rolls);
}

/** Ампутация (стр. 231): Medicae−10, провал → Кровотечение + обрубок. */
async function applyAmputate(medic, patient, { mod, limb }) {
  const def = LIMB_TYPES[limb];
  if (!def) { ui.notifications.warn("Выберите часть тела для ампутации."); return; }

  const pMod = patientHealingMod(patient);
  const eff = medicaeEff(medic, patient, mod - 10);
  const roll = await new Roll("1d100").evaluate();
  const rolls = [roll];
  const success = roll.total <= eff;
  const lines = [
    ...pMod.lines,
    `${rollIcon("blood","#ff6b6b")}<b>Ампутация</b> (${def.label}): Медика−10${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${success ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`
  ];

  const curCount = patient.system.conditions?.[def.count] ?? 0;
  const updates = {
    [`system.conditions.${def.flag}`]: true,
    [`system.conditions.${def.count}`]: curCount + 1
  };
  lines.push(`Конечность (${def.label}) удалена.`);

  if (!success) {
    const bleedLvl = patient.system.conditions?.bleedingLevel ?? 0;
    updates["system.conditions.bleeding"] = true;
    updates["system.conditions.bleedingLevel"] = bleedLvl + 1;
    lines.push(`${rollIcon("blood","#ff6b6b")}Провал → <b>Кровотечение</b> (уровень ${bleedLvl + 1}).`);

    const stumpEff = medicaeEff(medic, patient, mod - 10);
    const stumpRoll = await new Roll("1d100").evaluate();
    rolls.push(stumpRoll);
    const stumpOk = stumpRoll.total <= stumpEff;
    lines.push(`Обработка обрубка: Медика−10${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${stumpEff}</b>, бросок <b>${stumpRoll.total}</b> — ${stumpOk ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`);

    if (!stumpOk) {
      const gangRoll = await new Roll("1d100").evaluate();
      rolls.push(gangRoll);
      const gangrene = gangRoll.total <= 80;
      lines.push(`Шанс Гангрены (80%): бросок <b>${gangRoll.total}</b> — ${gangrene ? `<span class="roll-failure">Гангрена началась</span>` : `<span class="roll-success">пронесло</span>`}`);
      if (gangrene) updates["system.conditions.gangrene"] = true;
    }
  }

  try { await patient.update(updates); } catch {
    lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — примените вручную.`);
  }
  await sendHealChatMsg(medic, patient, rollIcon("blood","#ff6b6b"), "Ампутация", lines, rolls);
}

/** Пришивание конечностей (стр. 231): Medicae−30. */
async function applyReattach(medic, patient, { mod, limb }) {
  const def = LIMB_TYPES[limb];
  if (!def) { ui.notifications.warn("Выберите часть тела для пришивания."); return; }
  const curCount = patient.system.conditions?.[def.count] ?? 0;
  if (curCount <= 0) {
    ui.notifications.warn(`У пациента нет потерянной части «${def.label}» для пришивания.`);
    return;
  }

  const pMod = patientHealingMod(patient);
  const eff = medicaeEff(medic, patient, mod - 30);
  const roll = await new Roll("1d100").evaluate();
  const rolls = [roll];
  const success = roll.total <= eff;
  const lines = [
    ...pMod.lines,
    `${rollIcon("wrench","#8fd0ff")}<b>Пришивание конечности</b> (${def.label}): Медика−30${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${success ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`
  ];

  if (success) {
    const tb = patient.system.characteristics?.t?.bonus ?? 0;
    const daysRoll = await new Roll("1d10").evaluate();
    rolls.push(daysRoll);
    const days = Math.max(1, daysRoll.total + 3 - tb);
    const newCount = curCount - 1;
    const updates = { [`system.conditions.${def.count}`]: newCount };
    if (newCount <= 0) updates[`system.conditions.${def.flag}`] = false;
    try { await patient.update(updates); } catch {
      lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — примените вручную.`);
    }
    lines.push(`Конечность пришита. Восстановление: <b>${days}</b> сут. (1d10+3−T.b, мин. 1).`);
  } else {
    lines.push("Провал — спасённая конечность умирает и более не может быть использована.");
  }
  await sendHealChatMsg(medic, patient, rollIcon("wrench","#8fd0ff"), "Пришивание конечности", lines, rolls);
}

/** Вывод из комы (стр. 232): Medicae−40, раз в 10−T.b дней. */
async function applyComaWake(medic, patient, { mod }) {
  const tb = patient.system.characteristics?.t?.bonus ?? 0;
  const testAt = patient.getFlag?.(NS, "comaTestAt");
  const remaining = comaWakeRemaining(testAt, game.time.worldTime, tb);
  if (remaining > 0) {
    ui.notifications.warn(`Следующая попытка вывода из комы доступна не раньше чем через ~${Math.ceil(remaining / SECONDS_PER_DAY)} сут.`);
    return;
  }

  const pMod = patientHealingMod(patient);
  const eff = medicaeEff(medic, patient, mod - 40);
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= eff;
  const lines = [
    ...pMod.lines,
    `${rollIcon("spark","#4dffa6")}<b>Вывод из комы</b>: Медика−40${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${success ? `<span class="roll-success">Успех — пациент приходит в себя</span>` : `<span class="roll-failure">Провал</span>`}`
  ];
  try { await patient.setFlag(NS, "comaTestAt", game.time.worldTime); } catch {}
  await sendHealChatMsg(medic, patient, rollIcon("spark","#4dffa6"), "Вывод из комы", lines, [roll]);
}

/** Лечение болезней (стр. 232): по умолчанию постельный режим, тест Medicae. */
async function applyDiseaseCure(medic, patient, { mod, diseaseCare, diseaseId }) {
  const careMod = DISEASE_CARE_MOD[diseaseCare] ?? 0;
  const pMod = patientHealingMod(patient);
  const eff = medicaeEff(medic, patient, mod + careMod);
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= eff;
  const careLabel = { bedRest: "постельный режим", rest: "просто отдых", none: "ни то ни другое" }[diseaseCare] ?? "постельный режим";
  const disease = diseaseId ? patient.items?.get(diseaseId) : null;

  const lines = [
    ...pMod.lines,
    disease ? `Болезнь: <b>${esc(disease.name)}</b>` : null,
    `${rollIcon("skull","#9fd08a")}<b>Лечение болезни</b> (${careLabel}): Медика${careMod ? `${careMod >= 0 ? "+" : ""}${careMod}` : ""}${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${success ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`,
    disease?.system?.cure ? `<span style="font-size:0.85em;">Лечение по тексту болезни: ${esc(disease.system.cure)}</span>` : null
  ].filter(Boolean);

  await sendHealChatMsg(medic, patient, rollIcon("skull","#9fd08a"), "Лечение болезни", lines, [roll]);
}

/**
 * Бионика/Кибернетика (стр. 231): сперва открывает Хирургеон для установки
 * импланта, и только ПОСЛЕ его закрытия — тест Medicae−30. Application v1
 * (SurgeonWindow) сам вызывает Hooks.callAll(`close${constructor.name}`, ...)
 * из своего close() — ждём этот хук вместо переопределения close() на
 * инстансе, чтобы не трогать чужой класс.
 */
export function runBionicInstall(medic, patient, { mod }) {
  const app = openSurgeon(patient);
  if (!app) return;
  Hooks.once(`close${app.constructor.name}`, () => {
    resolveBionicTest(medic, patient, { mod });
  });
}

async function resolveBionicTest(medic, patient, { mod }) {
  const pMod = patientHealingMod(patient);
  const eff = medicaeEff(medic, patient, mod - 30);
  const roll = await new Roll("1d100").evaluate();
  const rolls = [roll];
  const success = roll.total <= eff;
  const lines = [
    ...pMod.lines,
    `${rollIcon("gear","#c98bff")}<b>Установка бионики/кибернетики</b>: Медика−30${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${success ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`
  ];

  if (success) {
    const tb = patient.system.characteristics?.t?.bonus ?? 0;
    const daysRoll = await new Roll("1d10").evaluate();
    rolls.push(daysRoll);
    const days = Math.max(1, daysRoll.total + 3 - tb);
    lines.push(`Адаптация: <b>${days}</b> сут. (1d10+3−T.b, мин. 1).`);
  } else {
    const dmgRoll = await new Roll("1d10").evaluate();
    rolls.push(dmgRoll);
    const updates = computeWoundDamage(patient.system, dmgRoll.total);
    updates["system.conditions.crippling"] = true;
    lines.push(`Провал → <b>${dmgRoll.total}</b> непоглощаемого урона + <b>конечность бесполезна</b> (Калечение).`);
    try { await patient.update(updates); } catch {
      lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — примените вручную.`);
    }
  }

  await sendHealChatMsg(medic, patient, rollIcon("gear","#c98bff"), "Установка бионики/кибернетики", lines, rolls);
}

/** Расчёт и применение лечения к пациенту + сообщение в чат. */
export async function applyHealing(medic, patient, opts) {
  const { mode, care, mod, bonus } = opts;
  if (mode === "cauterize") return applyCauterize(medic, patient, opts);
  if (mode === "amputate")  return applyAmputate(medic, patient, opts);
  if (mode === "reattach")  return applyReattach(medic, patient, opts);
  if (mode === "coma")      return applyComaWake(medic, patient, opts);
  if (mode === "disease")   return applyDiseaseCure(medic, patient, opts);

  const lvl = woundLevel(patient.system);
  const tb = lvl.tb;
  // Физиология Астартес — возможность от правил, а не раса пациента.
  const isAstartes = hasRuleFlag(patient, "healing.astartes");
  const pMod = patientHealingMod(patient);
  const rolls = [];
  const lines = [...pMod.lines];
  let heal = 0;
  const lblOf = { light: "Лёгкое", heavy: "Тяжёлое", critical: "Критическое" };
  const half = (n, up) => up ? Math.ceil(n / 2) : Math.floor(n / 2);
  // Включает автоматический мод. пациента (patientHealingMod) — в отличие от
  // «сырой» medicSkill(medic), это уже итоговый Порог со стороны медика.
  const medSkill = () => medicSkill(medic) + pMod.total;

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

  await sendHealChatMsg(medic, patient, rollIcon("heart","#ff8a8a"), "Лечение", lines, rolls);
}
