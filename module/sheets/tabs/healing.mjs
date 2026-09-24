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
import { postTestCard } from "../../helpers/test-card.mjs";
import { SECONDS_PER_DAY } from "../../constants/imperial-calendar.mjs";
import { openSurgeon } from "../../apps/surgeon.mjs";
import { addFatigue, conditionApplyFields, conditionRemoveFields } from "./conditions.mjs";
import { spendActionPoints } from "../../combat/action-economy.mjs";
import { worldTimeRemaining } from "../../rules/cooldown.mjs";
import { showDelegateTestPicker } from "../../rules/delegate-test.mjs";
import { dropFromHand } from "../../combat/limb-loss.mjs";
import { classifyImplant } from "../../constants/body-map.mjs";
import { SIDE_LABELS, STATE_LABELS, settableSides, setLimbOutcome, clearSideFields, recoveryFields } from "../../rules/useless-limbs.mjs";
import { BODY_SIDE_SHORT, isLostOn, pickLostSide, lostSideFields, clearStumpTimerFields, stumpSidesWithTimer, lostByMutation } from "../../rules/limb-loss.mjs";
import { collectTestMods } from "../../rules/roll-mods.mjs";
import { regimenHeal, healPeriodSeconds } from "../../rules/healing-clock.mjs";
import { killByCondition } from "../../combat/condition-death.mjs";
import { charLossAddFields } from "../../rules/char-loss.mjs";

const NS = "warhammer-dbc";

/** Части тела для Ампутации/Пришивания — ключ формы → состояние (стр. 30-31). */
const LIMB_TYPES = {
  hand: { label: "Кисть", flag: "lostHands", count: "lostHandsCount" },
  arm:  { label: "Рука",  flag: "lostArms",  count: "lostArmsCount"  },
  foot: { label: "Стопа", flag: "lostFeet",  count: "lostFeetCount"  },
  leg:  { label: "Нога",  flag: "lostLegs",  count: "lostLegsCount"  },
  eye:  { label: "Глаз",  flag: "lostEyes",  count: "lostEyesCount"  }
};

/** Какой тип бесполезности снимает ампутация/операция этой части тела (wdbc-x1nz.2.99). */
const LIMB_USELESS_TYPE = { arm: "arm", leg: "leg" };

/** Ключ system.uselessLimbs той же стороны: ("arm", "left") → "leftArm". */
const uselessKeyOf = (limb, side) => LIMB_USELESS_TYPE[limb] ? side + (limb === "arm" ? "Arm" : "Leg") : null;

/**
 * Восстановление после Пришивания/бионики (wdbc-x1nz.2.106): рука/нога
 * (кисть — в руке, стопа — в ноге) бесполезна `days` суток, снимется по
 * Календарю. Глаз — только строка в карточке: бесполезного глаза в системе нет.
 */
function recoveryPatch(limb, side, days) {
  const key = uselessKeyOf({ hand: "arm", foot: "leg" }[limb] ?? limb, side);
  return key ? recoveryFields(key, { days, worldTime: game.time.worldTime }) : {};
}

/** « (П.)» для строк карточки. */
const sideTag = side => side ? ` (${BODY_SIDE_SHORT[side]})` : "";

/** Есть ли у медика Нартеций — по имени предмета (в паке «Narthecium / Нартеций»). */
export function hasNarthecium(medic) {
  return [...(medic?.items ?? [])].some(i => /narthec|нартец/i.test(i.name ?? ""));
}

/**
 * Мясник (Талант Медика): «автоматически проходит тесты на лечение
 * бесполезных конечностей и ампутацию при помощи Нартеция» — возможность
 * medic.core.butcher (constants/capabilities.mjs), только с Нартецием.
 */
export function butcherAutoPass(medic, narthecium) {
  return !!narthecium && hasRuleFlag(medic, "medic.core.butcher");
}

/** Уход при лечении болезней (стр. 232) — модификатор к тесту Medicae. */
const DISEASE_CARE_MOD = { bedRest: 0, rest: -20, none: -40 };

/** Бонус Медики медика — общий для всех режимов теста. */
function medicSkill(medic) {
  return medic.system.skills?.medicae?.total
    ?? ((medic.system.characteristics?.int?.total ?? 20) - 20);
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
export function medicaeEff(medic, patient, extra = 0) {
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
        <b>Первая Помощь</b> (5 Ходов; 1 раз после урона, провал = использование; не больше Ран, чем потеряно после прошлой): Лёгкое Medicae+10 (I.b Ран), Тяжёлое Medicae+0 (2), Критическое Medicae−10 (1).<br/>
        <b>Пассивное</b> (раз в сутки): Лёгкое 1; Тяжёлое — тест T+0 на 1; Критическое — нет.<br/>
        <b>Отдых</b> (сутки, без тяжёлой работы/боёв): Лёгкое ½T.b; Тяжёлое 1; Критическое — тест T+0 на 1.<br/>
        <b>Постельный режим</b> (сутки, лёжа): Лёгкое T.b; Тяжёлое ½T.b (окр.▲); Критическое 1.<br/>
        <b>Мед. уход</b>: Medicae+0 (лёгкий/тяжёлый) сокращает период до 8 часов; Medicae−10 (критический) — лечится как тяжёлый, но раз в сутки.<br/>
        <b>Физиология Астартес</b>: всегда считается отдыхающим; реальный отдых = постельный режим; полный постельный режим не ускоряет сверх этого.<br/>
        <b>Прижигание</b>: раскалённым предметом — 1d5 Усталости и 1d10 урона в T (Характеристику), цель фиксируют или тест W−20; останавливает Кровотечение, прижжённый обрубок не загноится.<br/>
        <b>Бесполезные конечности/Ампутация</b>: лечение перелома — 5 мин + Medicae+0 (конечность бесполезна 2d10−T.b сут.). Без помощи 2×T.b ч — перманентно; ампутация Medicae−10 (провал → Кровотечение, обрубок Medicae−10 или Гангрена); отрубить клинком — как провал (E — без Кровотечения).<br/>
        <b>Потеря конечности (крит/бой)</b>: всегда Кровотечение; обрубок не обработан за T.b дней → 80% Гангрены (розыгрыш сам по виджету Календаря). «Обработка обрубка» — Medicae−10, 5 мин, снимает угрозу.<br/>
        <b>Остановить Кровотечение</b>: полудействие, Medicae−10; −30, если пациент активно действовал в прошлый Ход или кровь останавливают на себе; жгут/ремень/верёвка — полное действие, +40.<br/>
        <b>Лечение Гангрены</b>: операция хотя бы в операционной, смена работы, Medicae−30; даже при Успехе конечность теряется полностью.<br/>
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
          <option value="careAssign">Взять на мед. уход (по Календарю)</option>
          <option value="cauterize">Прижигание</option>
          <option value="setLimb">Зафиксировать бесполезную конечность (Medicae+0, 5 мин)</option>
          <option value="amputate">Ампутация (Medicae−10)</option>
          <option value="reattach">Пришивание конечности (Medicae−30)</option>
          <option value="stumpCare">Обработка обрубка (Medicae−10, 5 мин)</option>
          <option value="stopBleeding">Остановить Кровотечение (Medicae−10, полудействие)</option>
          <option value="gangreneSurgery">Лечение Гангрены (Medicae−30, операция)</option>
          <option value="bionic">Бионика/Кибернетика (Medicae−30)</option>
          <option value="coma">Вывод из комы (Medicae−40)</option>
          <option value="disease">Лечение болезни</option>
        </select>
      </div>
      <div class="atk-dlg-row" data-mode="rest,bedRest,passive"><label title="Medicae: критический лечится как тяжёлый; период до 8 часов"><input type="checkbox" id="heal-care"/> Мед. уход</label></div>
      <div class="atk-dlg-row" data-mode="stopBleeding"><label title="Книга: −30 вместо −10, если пациент активно действовал в свой прошлый Ход (отмечается само по движению/атаке/физическим ОД). На себе — всегда −30."><input type="checkbox" id="heal-patient-active"/> Пациент активно действовал в прошлый Ход</label></div>
      <div class="atk-dlg-row" data-mode="stopBleeding"><label title="Жгут, ремень или тонкая верёвка: полное действие вместо полудействия, +40"><input type="checkbox" id="heal-tourniquet"/> Жгут/ремень/верёвка (+40, полное действие)</label></div>
      <div class="atk-dlg-row" data-mode="gangreneSurgery"><label title="Книга: сложная операция хотя бы в операционной комнате, занимает смену работы. Даже при Успехе гангренозная конечность теряется полностью — выберите её ниже."><input type="checkbox" id="heal-theatre"/> Есть операционная (обязательно)</label></div>
      <div class="atk-dlg-row" data-mode="amputate,reattach,stumpCare,bionic,gangreneSurgery,cauterize"><label title="Для Прижигания — какой обрубок прижечь (снимает угрозу Гангрены). Пусто — единственный необработанный, если он один.">Часть тела:</label>
        <select id="heal-limb">
          <option value="">— (для Бионики, если не восстанавливает утраченную часть) —</option>
          ${Object.entries(LIMB_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}
        </select>
      </div>
      <div class="atk-dlg-row" data-mode="amputate,reattach,stumpCare,bionic,gangreneSurgery,cauterize"><label title="Потеря конечностей хранится по сторонам (wdbc-x1nz.2.100). «Любая» — первая подходящая.">Сторона:</label>
        <select id="heal-body-side"><option value="">— любая подходящая —</option><option value="right">Правая</option><option value="left">Левая</option></select>
      </div>
      <div class="atk-dlg-row" data-mode="setLimb"><label>Конечность:</label><select id="heal-useless-side"></select></div>
      <div class="atk-dlg-row" data-mode="setLimb,amputate"><label title="Талант «Мясник»: с Нартецием тест проходится автоматически"><input type="checkbox" id="heal-narthecium" ${hasNarthecium(medic) ? "checked" : ""}/> Нартецием</label></div>
      <div class="atk-dlg-row" data-mode="amputate"><label title="Книга: отрубить любым рукопашным оружием с лезвием — без теста, как проваленная ампутация"><input type="checkbox" id="heal-chop"/> Отрубить клинком (без теста)</label></div>
      <div class="atk-dlg-row" data-mode="amputate"><label title="Оружие, наносящее E Dmg, не вызывает Кровотечение"><input type="checkbox" id="heal-chop-energy"/> Оружие E (без Кровотечения)</label></div>
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

  const rebuildUselessSelect = (form, patient) => {
    const sel = form.querySelector("#heal-useless-side");
    if (!sel) return;
    const cur = sel.value;
    const sides = settableSides(patient?.system);
    sel.innerHTML = sides.length
      ? sides.map(side => {
        const e = patient.system.uselessLimbs[side];
        const tail = [STATE_LABELS[e.state], e.attempts ? `попыток ${e.attempts}` : "", e.healMod ? `мод. ${e.healMod}` : ""]
          .filter(Boolean).join(", ");
        return `<option value="${side}">${SIDE_LABELS[side]} (${esc(tail)})</option>`;
      }).join("")
      : `<option value="">— нечего фиксировать —</option>`;
    if (sides.includes(cur)) sel.value = cur;
  };

  const updateNote = form => {
    const patient = patientOf(form);
    syncModeRows(form);
    rebuildDiseaseSelect(form, patient);
    rebuildUselessSelect(form, patient);
    if (!patient) return;
    const lvl = woundLevel(patient.system);
    const parts = [
      `<b>Пациент:</b> ${esc(patient.name)}`,
      `<b>Уровень ранения:</b> ${lvl.label} (потеряно ${lvl.lost}${lvl.crit ? `, крит ${lvl.crit}` : ""}, T.b ${lvl.tb})`
    ];
    if (hasRuleFlag(patient, "healing.astartes")) parts.push("<i>Физиология Астартес: всегда считается отдыхающим.</i>");
    if (patient.system.wounds?.firstAidUsed) parts.push('<span style="color:#a33;">⚠ Первая Помощь уже оказана (нужен новый урон).</span>');
    const mode = form.querySelector("#heal-mode")?.value;
    // Галочка «активно действовал» проставляется сама по меткам прошлого Хода
    // пациента — только при смене пациента/режима, чтобы не перетирать
    // ручной выбор игрока на любом другом изменении формы.
    const activeBox = form.querySelector("#heal-patient-active");
    const activeKey = `${patient.id ?? patient.name}|${mode}`;
    if (activeBox && form.dataset.activeFor !== activeKey) {
      form.dataset.activeFor = activeKey;
      activeBox.checked = patientActedLastTurn(patient);
    }
    if (mode === "stopBleeding" && patient === medic) parts.push("<i>Кровь на себе — всегда −30.</i>");
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
            patientActive: !!form.querySelector("#heal-patient-active")?.checked,
            tourniquet: !!form.querySelector("#heal-tourniquet")?.checked,
            theatre:    !!form.querySelector("#heal-theatre")?.checked,
            mod:        num("#heal-mod"),
            bonus:      num("#heal-bonus"),
            limb:       form.querySelector("#heal-limb")?.value,
            bodySide:   form.querySelector("#heal-body-side")?.value || "",
            diseaseCare: form.querySelector("#heal-disease-care")?.value,
            diseaseId:   form.querySelector("#heal-disease-item")?.value,
            side:        form.querySelector("#heal-useless-side")?.value,
            narthecium:  !!form.querySelector("#heal-narthecium")?.checked,
            chop:        !!form.querySelector("#heal-chop")?.checked,
            chopEnergy:  !!form.querySelector("#heal-chop-energy")?.checked
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

/**
 * Хвостовая часть общего сообщения в чат — общая на все режимы этого файла.
 * Сборка и публикация — общий helpers/test-card.mjs (wdbc-kuun): говорящий —
 * медик, звук кубика только там, где кубик катался (Прижигание/тест Medicae —
 * с ним, «Пришить бионику вручную» — без).
 */
async function sendHealChatMsg(medic, patient, headerIcon, headerLabel, lines, rolls = []) {
  await postTestCard(medic, {
    icon: headerIcon, title: `${headerLabel} — ${esc(patient.name)}`,
    threshold: `<div class="roll-threshold">${lines.join("<br/>")}</div>`
  }, { rolls, sound: rolls.length > 0 });
}

/** Все необработанные обрубки пациента: [{ limb, side }] — для Прижигания без выбора. */
function waitingStumps(system) {
  return Object.entries(LIMB_TYPES).flatMap(([limb, def]) =>
    stumpSidesWithTimer(system, def.flag).map(side => ({ limb, side })));
}

/**
 * Тест Характеристики пациента без диалога: Итог + Черты/Конструктор
 * (collectTestMods — тот же сбор, что у Т-теста Гангрены) + свой модификатор.
 */
async function charTest(actor, char, extra = 0) {
  const base = Number(actor.system.characteristics?.[char]?.total) || 0;
  const ruleMods = collectTestMods(actor, { kind: "skill", char });
  const threshold = base + ruleMods.total + extra;
  const roll = await new Roll("1d100").evaluate();
  const rules = ruleMods.parts.length ? ` (${esc(ruleMods.parts.join(", "))})` : "";
  return { roll, threshold, success: roll.total <= threshold, rules };
}

/**
 * Прижигание (книга, «Прижигание», wdbc-x1nz.2.103): без теста — 1d5
 * Усталости и 1d10 урона в T. «Урон в T» — урон в Характеристику
 * (system.charDamage.t, как у Гангрены), не Раны: в книге «урона в T/W/I/S»
 * везде значит Характеристику. Прижигает кровоточащую рану (снимает
 * Кровотечение) или обрубок — психосила Пиромантии «Прижигание» прямо
 * называет эти два исхода обычного Прижигания; прижжённый обрубок снимает
 * угрозу Гангрены (решение владельца 24.09.2026). T ≤ 0 — смерть
 * (нулевая T, раздел «Урон в Характеристики»).
 */
async function applyCauterize(medic, patient, { restrained, limb = "", bodySide = "" }) {
  const rolls = [];
  const fatigueRoll = await new Roll("1d5").evaluate();
  rolls.push(fatigueRoll);
  const dmgRoll = await new Roll("1d10").evaluate();
  rolls.push(dmgRoll);

  // Урон в T — единый конвейер (wdbc-x1nz.2.83): пол 0, отходит по 1 в час.
  const loss = charLossAddFields(patient.system, "t", dmgRoll.total, game.time?.worldTime ?? 0);
  const tBefore = loss.before;
  const tAfter = loss.after;
  const updates = { ...loss.patch };
  const lines = [
    `${rollIcon("fire","#ff8a3a")}<b>Прижигание</b>: Усталость <b>${fatigueRoll.total}</b>, урон в T <b>${dmgRoll.total}</b> (T ${tBefore}→${tAfter}).`
  ];
  if (patient.system.conditions?.bleeding) {
    Object.assign(updates, conditionRemoveFields("bleeding"));
    lines.push("Кровотечение остановлено.");
  }
  // Какой обрубок: выбранная часть тела (сторона — выбранная или первая
  // ждущая), без выбора — единственный необработанный.
  const def = LIMB_TYPES[limb];
  const waiting = def ? stumpSidesWithTimer(patient.system, def.flag).map(side => ({ limb, side })) : waitingStumps(patient.system);
  const stump = waiting.find(w => w.side === bodySide) ?? (def || waiting.length === 1 ? waiting[0] : null);
  if (stump) {
    Object.assign(updates, clearStumpTimerFields(LIMB_TYPES[stump.limb].flag, stump.side));
    lines.push(`Обрубок (${LIMB_TYPES[stump.limb].label}${sideTag(stump.side)}) прижжён — угроза Гангрены снята.`);
  } else if (waiting.length > 1) {
    lines.push(`${rollIcon("warn","#ffb84d")}Необработанных обрубков несколько — выберите часть тела, чтобы прижечь обрубок.`);
  }
  try {
    await patient.update(updates);
  } catch {
    lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — примените вручную.`);
  }

  if (!restrained) {
    const t = await charTest(patient, "wp", -20);
    rolls.push(t.roll);
    lines.push(`${rollIcon("warn","#ffb84d")}Пациент не зафиксирован — тест W−20${t.rules} → порог <b>${t.threshold}</b>, бросок <b>${t.roll.total}</b> — ${t.success ? `<span class="roll-success">не пытается вырваться</span>` : `<span class="roll-failure">пытается вырваться</span>`}`);
  }

  try { await addFatigue(patient, fatigueRoll.total); } catch {}

  if (tAfter <= 0 && await killByCondition(patient)) {
    lines.push(`${rollIcon("skull","#ff6b6b")}Стойкость упала до ${tAfter} — <b>${esc(patient.name)} умирает</b>.`);
  }
  await sendHealChatMsg(medic, patient, rollIcon("fire","#ff8a3a"), "Прижигание", lines, rolls);
}

/**
 * Ампутация (книга, «Бесполезные Конечности и Ампутация»): Medicae−10.
 * Провал всё равно удаляет конечность, но вызывает Кровотечение, а обрубок
 * «нуждается в медицинской обработке (Medicae−10), иначе с шансом 80%
 * загноится» — тот же таймер обрубка, что у потери от крит-эффекта (T.b
 * дней, combat/limb-loss.mjs), обработка — режим «Обработка обрубка» или
 * Прижигание (wdbc-x1nz.2.103; раньше обработка и 80% разыгрывались сразу).
 * chop — «просто отрубив конечность любым рукопашным оружием с лезвием»:
 * без теста, как провал; chopEnergy — оружие E Dmg не вызывает Кровотечение.
 */
async function applyAmputate(medic, patient, { mod, limb, narthecium, bodySide = "", chop = false, chopEnergy = false }) {
  const def = LIMB_TYPES[limb];
  if (!def) { ui.notifications.warn("Выберите часть тела для ампутации."); return; }
  const side = pickLostSide(patient.system, def.flag, bodySide);
  if (!side) { ui.notifications.warn(`${patient.name}: «${def.label}» — обе уже потеряны.`); return; }

  const pMod = patientHealingMod(patient);
  const rolls = [];
  const lines = [...pMod.lines];
  let success = false;
  if (chop) {
    lines.push(`${rollIcon("blood","#ff6b6b")}<b>Ампутация клинком</b> (${def.label}): без теста — как проваленная ампутация.`);
  } else {
    const eff = medicaeEff(medic, patient, mod - 10);
    const roll = await new Roll("1d100").evaluate();
    rolls.push(roll);
    const butcher = butcherAutoPass(medic, narthecium);
    success = butcher || roll.total <= eff;
    lines.push(`${rollIcon("blood","#ff6b6b")}<b>Ампутация</b> (${def.label}): Медика−10${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${success ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`);
    if (butcher) lines.push("Мясник с Нартецием — тест пройден автоматически.");
  }

  const tb = Number(patient.system.characteristics?.t?.bonus) || 0;
  const updates = lostSideFields(def.flag, side, { timer: !success, worldTime: game.time.worldTime, tb });
  lines.push(`Конечность (${def.label}${sideTag(side)}) удалена.`);
  // Удалённая рука/нога больше не «бесполезная» (wdbc-x1nz.2.99).
  const uselessKey = uselessKeyOf(limb, side);
  if (uselessKey) Object.assign(updates, clearSideFields(uselessKey));

  if (!success) {
    // У Кровотечения нет книжных «уровней» (wdbc-x1nz.2.92) — просто накладывается.
    if (chop && chopEnergy) {
      lines.push("Оружие E — рана прижжена ударом, Кровотечения нет.");
    } else {
      Object.assign(updates, conditionApplyFields("bleeding", null, patient));
      lines.push(`${rollIcon("blood","#ff6b6b")}<b>Кровотечение</b>.`);
    }
    lines.push(`Обрубок нужно обработать (Medicae−10 или Прижигание), иначе через ${tb} дн. 80% Гангрены.`);
  }

  try { await patient.update(updates); } catch {
    lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — примените вручную.`);
  }
  await sendHealChatMsg(medic, patient, rollIcon("blood","#ff6b6b"), "Ампутация", lines, rolls);
  // Без кисти/руки на этой стороне ничего не удержать (wdbc-x1nz.2.100).
  if (limb === "hand" || limb === "arm") await dropFromHand(patient, side, { wrist: limb === "arm", reason: "ампутация" });
}

/**
 * Зафиксировать бесполезную конечность (книга, «Бесполезные Конечности и
 * Ампутация», wdbc-x1nz.2.99): 5 минут, Medicae+0 (плюс штраф самой
 * конечности, напр. −20 от некроза). Успех — в лубке на 2d10−T.b суток
 * (минимум 1), дальше срок ведут часы игрового времени; Провал —
 * зафиксирована неправильно, попыток до T.b пациента, все провалены —
 * перманентно (ампутация, иначе через T.b дней 60% Гангрены).
 */
async function applySetLimb(medic, patient, { mod, side, narthecium }) {
  const entry = patient.system?.uselessLimbs?.[side];
  if (!entry || !settableSides(patient.system).includes(side)) {
    ui.notifications.warn(`${patient.name}: нет бесполезной конечности, которую можно зафиксировать.`);
    return;
  }
  const tb = Number(patient.system.characteristics?.t?.bonus) || 0;
  const limbMod = Number(entry.healMod) || 0;
  const pMod = patientHealingMod(patient);
  const eff = medicaeEff(medic, patient, mod + limbMod);
  const roll = await new Roll("1d100").evaluate();
  const rolls = [roll];
  const butcher = butcherAutoPass(medic, narthecium);
  const success = butcher || roll.total <= eff;
  const modTxt = [limbMod ? `${limbMod} (конечность)` : "", mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""].filter(Boolean).join(" ");
  const lines = [
    ...pMod.lines,
    `${rollIcon("wrench","#d9a066")}<b>Фиксация</b> (${SIDE_LABELS[side]}): Медика+0${modTxt ? ` ${modTxt}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${success ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}${butcher ? " (Мясник с Нартецием — автоматически)" : ""}`
  ];
  let days = 1;
  if (success) {
    const daysRoll = await new Roll("2d10").evaluate();
    rolls.push(daysRoll);
    days = Math.max(1, daysRoll.total - tb);
  }
  const out = setLimbOutcome(patient.system, side, { success, days, worldTime: game.time.worldTime, tb });
  if (out.result === "splinted") {
    lines.push(`Травма обработана правильно. Конечность в лубке и бесполезна ещё <b>${days}</b> сут. (2d10−T.b, мин. 1) — снимется сама по Календарю.`);
  } else if (out.result === "misset") {
    lines.push(`Зафиксирована неправильно. Попыток: ${out.attempts} из ${out.maxAttempts} (T.b пациента) — можно пробовать снова.`);
  } else {
    lines.push(`Все ${out.maxAttempts} попыток провалены — конечность <b>перманентно бесполезна</b>. Нужна ампутация, иначе через T.b дн. 60% Гангрены.`);
  }
  try { await patient.update(out.patch); } catch {
    lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — примените вручную.`);
  }
  await sendHealChatMsg(medic, patient, rollIcon("wrench","#d9a066"), "Бесполезная конечность", lines, rolls);
}

/** Пришивание конечностей (стр. 231): Medicae−30. */
async function applyReattach(medic, patient, { mod, limb, bodySide = "" }) {
  const def = LIMB_TYPES[limb];
  if (!def) { ui.notifications.warn("Выберите часть тела для пришивания."); return; }
  const side = pickLostSide(patient.system, def.flag, bodySide, { lost: false });
  if (!side) {
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
    const recovery = recoveryPatch(limb, side, days);
    const updates = { ...lostSideFields(def.flag, side, { lost: false }), ...recovery };
    try { await patient.update(updates); } catch {
      lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — примените вручную.`);
    }
    lines.push(`Конечность${sideTag(side)} пришита. Восстановление: <b>${days}</b> сут. (1d10+3−T.b, мин. 1)${Object.keys(recovery).length ? " — до тех пор бесполезна, снимется сама по Календарю" : ""}.`);
  } else {
    lines.push("Провал — спасённая конечность умирает и более не может быть использована.");
  }
  await sendHealChatMsg(medic, patient, rollIcon("wrench","#8fd0ff"), "Пришивание конечности", lines, rolls);
}

/**
 * Обработка обрубка (стр. 30-31, wdbc-1rno.6): Medicae−10, 5 минут — снимает
 * запланированную проверку Гангрены (module/combat/limb-loss.mjs), заведённую
 * в момент потери части тела от крит-эффекта. Не привязана к Ампутации —
 * применима к любому текущему lostX, независимо от причины (кроме Мутации
 * Loss of Limb, которая эту угрозу вообще не заводит, см. rules/limb-loss.mjs).
 */
async function applyStumpCare(medic, patient, { mod, limb, bodySide = "" }) {
  const def = LIMB_TYPES[limb];
  if (!def) { ui.notifications.warn("Выберите часть тела для обработки обрубка."); return; }
  // Таймер у каждого обрубка свой (wdbc-x1nz.2.100): выбранная сторона, если
  // её обрубок ещё ждёт обработки, иначе первый такой.
  const waiting = stumpSidesWithTimer(patient.system, def.flag);
  const side = waiting.includes(bodySide) ? bodySide : waiting[0];
  if (!side) {
    ui.notifications.warn(`У пациента нет необработанного обрубка «${def.label}».`);
    return;
  }

  const pMod = patientHealingMod(patient);
  const eff = medicaeEff(medic, patient, mod - 10);
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= eff;
  const lines = [
    ...pMod.lines,
    `${rollIcon("blood","#ff6b6b")}<b>Обработка обрубка</b> (${def.label}${sideTag(side)}): Медика−10${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${success ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`
  ];
  if (success) {
    lines.push("Обрубок обработан — угроза Гангрены снята.");
    try { await patient.update(clearStumpTimerFields(def.flag, side)); } catch {
      lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — снимите таймер вручную.`);
    }
  } else {
    lines.push("Провал — угроза Гангрены остаётся, обрубок можно попробовать обработать снова.");
  }
  await sendHealChatMsg(medic, patient, rollIcon("blood","#ff6b6b"), "Обработка обрубка", lines, [roll]);
}

/**
 * «Активно действовал в свой прошлый Ход» (книга, «Кровотечение», wdbc-x1nz.2.92)
 * — по меткам, которые живут до начала СЛЕДУЮЩЕГО Хода пациента (rules/
 * turn-flags.mjs): двигался (movedThisTurn), тратил ОД на физические действия
 * (physicalApSpentThisTurn), атаковал (attackActionsThisTurn). Медик
 * действует в свой Ход, значит у пациента эти метки — как раз от его
 * прошлого Хода. Вне боя меток нет — ответ «нет», галочку диалога игрок
 * может поставить сам.
 */
export function patientActedLastTurn(patient) {
  const f = key => patient?.getFlag?.(NS, key) ?? patient?.flags?.[NS]?.[key];
  return !!f("movedThisTurn")
    || (Number(f("physicalApSpentThisTurn")) || 0) > 0
    || (Number(f("attackActionsThisTurn")) || 0) > 0;
}

/**
 * Модификатор остановки Кровотечения: −10; −30, если пациент активно
 * действовал в прошлый Ход ИЛИ медик останавливает кровь на себе (одно
 * условие, не сумма — книга: «становится −30»); жгут/ремень/верёвка +40.
 */
export function stopBleedingMod({ selfTreat = false, patientActive = false, tourniquet = false } = {}) {
  return (selfTreat || patientActive ? -30 : -10) + (tourniquet ? 40 : 0);
}

/**
 * Остановить Кровотечение (книга, «Кровотечение», wdbc-x1nz.2.92):
 * полудействие, Medicae−10/−30; жгут — полное действие, +40. Успех снимает
 * Кровотечение (Обескровливание остаётся — оно сходит по часу).
 */
async function applyStopBleeding(medic, patient, { mod, tourniquet, patientActive }) {
  if (!patient.system.conditions?.bleeding) {
    ui.notifications.warn(`${patient.name}: Кровотечения нет.`);
    return;
  }
  const cost = tourniquet ? 2 : 1;
  if (!await spendActionPoints(medic, cost, { physical: true })) {
    ui.notifications.warn(`Не хватает ОД: нужно ${cost} (${tourniquet ? "полное действие" : "полудействие"}).`);
    return;
  }
  const selfTreat = medic === patient || (medic?.id != null && medic.id === patient?.id);
  const bookMod = stopBleedingMod({ selfTreat, patientActive, tourniquet });
  const pMod = patientHealingMod(patient);
  const eff = medicaeEff(medic, patient, mod + bookMod);
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= eff;
  const why = [
    selfTreat ? "на себе −30" : patientActive ? "пациент активно действовал −30" : "−10",
    tourniquet ? "жгут +40" : null,
    mod ? `мод. ${mod >= 0 ? "+" : ""}${mod}` : null
  ].filter(Boolean).join(", ");
  const lines = [
    ...pMod.lines,
    `${rollIcon("blood","#ff6b6b")}<b>Остановить Кровотечение</b> (${tourniquet ? "полное действие" : "полудействие"}): Медика ${why} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${success ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`
  ];
  if (success) {
    try {
      await patient.update(conditionRemoveFields("bleeding"));
      lines.push("Кровотечение остановлено.");
    } catch {
      lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — снимите Кровотечение вручную.`);
    }
  } else {
    lines.push("Кровь не остановлена — можно попробовать снова.");
  }
  await sendHealChatMsg(medic, patient, rollIcon("blood","#ff6b6b"), "Остановить Кровотечение", lines, [roll]);
}

/** Кисть/стопа «теряется полностью» — вместе со всей рукой/ногой. */
const LIMB_WHOLE = { hand: "arm", foot: "leg" };

/**
 * Лечение Гангрены (книга, «Гангрена», wdbc-x1nz.2.96): «сложная операция
 * в хотя бы операционной комнате, занимающая смену работы, тест Medicae−30.
 * Даже в случае Успеха персонаж теряет гангренозную конечность полностью».
 *
 * Какую конечность — Гангрена сама не помнит (таймер обрубка гасится при
 * розыгрыше, combat/limb-loss.mjs::sweepLimbLossGangrene), поэтому часть тела
 * выбирает медик. Решение по счётчикам потери:
 *  - часть тела ещё цела (Гангрена от травмы/обморожения) — +1 к её потере;
 *  - уже обрубок (Гангрена обрубка): кисть → теряется вся рука, стопа → вся
 *    нога («полностью»); у руки/ноги/глаза отнимать больше нечего — счётчик
 *    не меняется;
 *  - не выбрано — Гангрена снимается, конечность отмечается вручную.
 * Кровотечение и новый таймер обрубка не ставятся: это плановая операция в
 * операционной, а не травма.
 */
async function applyGangreneSurgery(medic, patient, { mod, limb, theatre, bodySide = "" }) {
  if (!patient.system.conditions?.gangrene) {
    ui.notifications.warn(`${patient.name}: Гангрены нет.`);
    return;
  }
  if (!theatre) {
    ui.notifications.warn("Операция от Гангрены требует хотя бы операционной — отметьте её в окне.");
    return;
  }
  const pMod = patientHealingMod(patient);
  const eff = medicaeEff(medic, patient, mod - 30);
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= eff;
  const lines = [
    ...pMod.lines,
    `${rollIcon("skull","#7a8a4d")}<b>Операция от Гангрены</b> (операционная, смена работы): Медика−30${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${success ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`
  ];
  if (!success) {
    lines.push("Гангрена не излечена.");
    return sendHealChatMsg(medic, patient, rollIcon("skull","#7a8a4d"), "Операция от Гангрены", lines, [roll]);
  }
  const updates = { ...conditionRemoveFields("gangrene") };
  const def = LIMB_TYPES[limb];
  // Сторона (wdbc-x1nz.2.100): выбранная, иначе первый обрубок с таймером,
  // иначе первая целая — там и гниёт.
  const side = bodySide
    || (def && stumpSidesWithTimer(patient.system, def.flag)[0])
    || (def && pickLostSide(patient.system, def.flag, "")) || "right";
  // Гангренозная бесполезная рука/нога теряется — бесполезной ей больше не быть.
  const uselessKey = uselessKeyOf(LIMB_WHOLE[limb] ?? limb, side);
  if (uselessKey) Object.assign(updates, clearSideFields(uselessKey));
  let dropWrist = null;
  if (!def) {
    lines.push("Гангрена излечена. Гангренозная конечность потеряна полностью — отметьте её потерю на листе.");
  } else if (!isLostOn(patient.system, def.flag, side)) {
    Object.assign(updates, lostSideFields(def.flag, side));
    lines.push(`Гангрена излечена. Конечность (${def.label}${sideTag(side)}) потеряна полностью.`);
    if (limb === "hand" || limb === "arm") dropWrist = limb === "arm";
  } else if (LIMB_WHOLE[limb]) {
    const whole = LIMB_TYPES[LIMB_WHOLE[limb]];
    Object.assign(updates, lostSideFields(def.flag, side, { lost: false }), lostSideFields(whole.flag, side));
    lines.push(`Гангрена излечена. Обрубок (${def.label}${sideTag(side)}) иссечён — потеряна вся конечность (${whole.label}).`);
    if (limb === "hand") dropWrist = true;
  } else {
    Object.assign(updates, clearStumpTimerFields(def.flag, side));
    lines.push(`Гангрена излечена. Гангренозный обрубок (${def.label}${sideTag(side)}) иссечён.`);
  }
  try { await patient.update(updates); } catch {
    lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — примените вручную.`);
  }
  await sendHealChatMsg(medic, patient, rollIcon("skull","#7a8a4d"), "Операция от Гангрены", lines, [roll]);
  if (dropWrist !== null) await dropFromHand(patient, side, { wrist: dropWrist, reason: "операция от Гангрены" });
}

/**
 * Вывод из комы (стр. 232): Medicae−40, раз в 10−T.b дней. Успех снимает
 * Состояние «Кома» (wdbc-x1nz.2.105) — оно само не проходит.
 */
async function applyComaWake(medic, patient, { mod }) {
  if (!patient.system.conditions?.coma) {
    ui.notifications.warn(`${patient.name}: не в коме.`);
    return;
  }
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
  if (success) {
    try { await patient.update(conditionRemoveFields("coma")); } catch {
      lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — снимите Кому вручную.`);
    }
  }
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
export function runBionicInstall(medic, patient, { mod, limb, bodySide = "" }) {
  const before = implantSnapshot(patient);
  const app = openSurgeon(patient);
  if (!app) return;
  Hooks.once(`close${app.constructor.name}`, () => {
    // Сторона импланта, который поставили в Хирургеоне прямо сейчас, важнее
    // выбора в окне Лечения — бионика встала туда (wdbc-x1nz.2.100, хвост 1).
    const after = implantSnapshot(patient);
    const side = installedImplantSide(before, after, limb) || bodySide;
    const fresh = newInstalledImplants(before, after, limb);
    resolveBionicTest(medic, patient, { mod, limb, bodySide: side,
      implantQuality: fresh.length ? (fresh.every(i => i.quality === "best") ? "best" : "lower") : "" });
  });
}

/** Часть тела Лечения → тип импланта Хирургеона (constants/body-map.mjs::classifyImplant). */
const LIMB_IMPLANT_KIND = { hand: "arm", arm: "arm", foot: "leg", leg: "leg", eye: "eye" };

/** Снимок имплантов актора: id → { kind, side, installed } — до и после Хирургеона. */
export function implantSnapshot(actor) {
  const out = new Map();
  for (const i of actor?.items ?? []) {
    if (i.type !== "implant") continue;
    out.set(i.id, {
      kind: classifyImplant(i.name, i.system?.installed, i.system?.category)?.kind || null,
      side: i.getFlag?.(NS, "bodySide") || "",
      quality: i.system?.quality || "common",
      installed: !!i.getFlag?.(NS, "installed")
    });
  }
  return out;
}

/**
 * Сторона импланта нужного типа, который в Хирургеоне появился или стал
 * установленным между двумя снимками. Несколько сразу (пара ног) или ни
 * одного со стороной — "" (решает выбор в окне Лечения).
 */
export function installedImplantSide(before, after, limb) {
  const sides = new Set(newInstalledImplants(before, after, limb).map(i => i.side).filter(Boolean));
  return sides.size === 1 ? [...sides][0] : "";
}

/** Импланты нужного типа, установленные между снимками: [{ side, quality }]. */
export function newInstalledImplants(before, after, limb) {
  const kind = LIMB_IMPLANT_KIND[limb];
  if (!kind) return [];
  const out = [];
  for (const [id, now] of after) {
    const was = before.get(id);
    if (now.kind !== kind || !now.installed) continue;
    if (!was || !was.installed || was.side !== now.side) out.push({ side: now.side, quality: now.quality });
  }
  return out;
}

/**
 * limb (wdbc-1rno.6, необязательный) — раньше успешная установка ничего не
 * делала с lostX вовсе (бионика молча не восстанавливала утраченную часть
 * тела). Пустое значение — обычный имплант не по месту потери конечности
 * (напр. чисто когнитивный), тогда ветка ниже не трогает Состояния вообще.
 */
export async function resolveBionicTest(medic, patient, { mod, limb, bodySide = "", implantQuality = "" }) {
  const def = LIMB_TYPES[limb];
  // Бионика встаёт на выбранную сторону, если там есть потеря, иначе на
  // первую потерянную (wdbc-x1nz.2.100).
  const side = def ? pickLostSide(patient.system, def.flag, bodySide, { lost: false }) : null;
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
    // Потеряно мутацией Loss of Limb (wdbc-1rno.6.1): «только Best.Q бионикой,
    // протезы более низкого Качества… отторгаются». Качество — у импланта,
    // только что поставленного в Хирургеоне; неизвестно (поставлен вручную) —
    // решает стол, конечность не восстанавливаем молча.
    const mutationGate = def && side && lostByMutation(patient.system, def.flag, side) && implantQuality !== "best";
    if (mutationGate) {
      lines.push(`${rollIcon("warn","#ffb84d")}Часть тела (${def.label}${sideTag(side)}) потеряна мутацией — прижится только Best.Q бионика${implantQuality ? "; этот протез отторгнется" : " (Качество импланта не определено — проверьте вручную)"}.`);
    } else if (def && side) {
      const recovery = recoveryPatch(limb, side, days);
      const updates = { ...lostSideFields(def.flag, side, { lost: false }), ...recovery };
      try {
        await patient.update(updates);
        lines.push(`Часть тела (${def.label}${sideTag(side)}) восстановлена бионикой${Object.keys(recovery).length ? " — бесполезна, пока идёт адаптация" : ""}.`);
      } catch {
        lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — снимите «${def.label}» вручную.`);
      }
    } else if (def) {
      lines.push(`${rollIcon("warn","#ffb84d")}У пациента нет утраченной «${def.label}» — установлено как обычный имплант.`);
    }
  } else {
    const dmgRoll = await new Roll("1d10").evaluate();
    rolls.push(dmgRoll);
    // Книга: «При Провале пациент получает 1d10 непоглощаемого R Dmg» — и
    // только; Калечения в тексте нет (wdbc-x1nz.2.103).
    const updates = computeWoundDamage(patient.system, dmgRoll.total);
    lines.push(`Провал → <b>${dmgRoll.total}</b> непоглощаемого урона (R).`);
    try { await patient.update(updates); } catch {
      lines.push(`${rollIcon("warn","#ffb84d")}Нет прав на изменение листа цели — примените вручную.`);
    }
  }

  await sendHealChatMsg(medic, patient, rollIcon("gear","#c98bff"), "Установка бионики/кибернетики", lines, rolls);
}

/**
 * Взять пациента на медицинский уход (wdbc-x1nz.2.104): медик сохраняется в
 * system.healing.caregiver, дальше тест ухода в начале каждого периода лечения
 * бросают часы Календаря (combat/healing-clock.mjs). Повторно тот же медик —
 * снимает с ухода.
 */
export async function assignCare(medic, patient) {
  if (!patient.system?.healing) { ui.notifications.warn(`${patient.name}: лечение по Календарю не ведётся для этого типа.`); return; }
  const same = patient.system.healing.caregiver === medic.uuid;
  try {
    await patient.update({ "system.healing.caregiver": same ? "" : medic.uuid });
  } catch {
    ui.notifications.warn("Нет прав на изменение листа пациента — попросите ГМа.");
    return;
  }
  await sendHealChatMsg(medic, patient, rollIcon("heart","#ff8a8a"), "Мед. уход", [same
    ? `${esc(medic.name)} больше не ухаживает за пациентом.`
    : `${esc(medic.name)} берёт пациента на уход: тест Medicae (+0, критическому −10) в начале каждого периода лечения — успех сокращает его до 8 ч или лечит критического как тяжёлого.`]);
}

/** Расчёт и применение лечения к пациенту + сообщение в чат. */
export async function applyHealing(medic, patient, opts) {
  const { mode, care, mod, bonus } = opts;
  if (mode === "careAssign") return assignCare(medic, patient);
  if (mode === "cauterize") return applyCauterize(medic, patient, opts);
  if (mode === "setLimb")   return applySetLimb(medic, patient, opts);
  if (mode === "amputate")  return applyAmputate(medic, patient, opts);
  if (mode === "reattach")  return applyReattach(medic, patient, opts);
  if (mode === "stumpCare") return applyStumpCare(medic, patient, opts);
  if (mode === "stopBleeding") return applyStopBleeding(medic, patient, opts);
  if (mode === "gangreneSurgery") return applyGangreneSurgery(medic, patient, opts);
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
  let periodRestart = null;
  let careSucceeded = false;
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
    // «Не может вылечить больше Ран, чем персонаж потерял после предыдущего
    // оказания первой помощи» (wdbc-x1nz.2.103); null — ещё не оказывали.
    const since = patient.system.wounds?.lostSinceFirstAid;
    if (typeof since === "number" && heal > since) {
      lines.push(`Ограничено: после прошлой Первой Помощи потеряно только <b>${since}</b> Ран.`);
      heal = since;
    }
    try { await patient.update({ "system.wounds.firstAidUsed": true, "system.wounds.lostSinceFirstAid": 0 }); } catch {}
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
      careSucceeded = ok;
      if (lvl.key === "critical") {
        lines.push(`${rollIcon("heart","#ff8a8a")}<b>Мед. уход</b> (крит): Медика−10${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${ok ? `<span class="roll-success">Успех — лечится как тяжёлый</span>` : `<span class="roll-failure">Провал</span>`}`);
        if (ok) key = "heavy";
      } else {
        lines.push(`${rollIcon("heart","#ff8a8a")}<b>Мед. уход</b>: Медика+0${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""} → порог <b>${eff}</b>, бросок <b>${roll.total}</b> — ${ok ? `<span class="roll-success">Успех — период до 8 часов</span>` : `<span class="roll-failure">Провал</span>`}`);
      }
    }
    const modeLabel = { rest: "Отдых", bedRest: "Постельный режим", passive: "Пассивное лечение" }[effMode];
    // Та же таблица, что у часов Календаря (rules/healing-clock.mjs); «Пассивное» — режим "active".
    const { amount, needT } = regimenHeal(effMode === "passive" ? "active" : effMode, key, tb);
    // Кнопка — запасной путь для стола без Календаря: период лечения по
    // часам начинается заново, иначе те же сутки вылечили бы дважды.
    if (patient.system.healing) periodRestart = { "system.healing.nextAt": (game.time?.worldTime ?? 0) + healPeriodSeconds(key, care && key === lvl.key && careSucceeded), "system.healing.careOk": false };
    if (needT) {
      // Итог T (у характеристик нет поля value — раньше порог выходил 0 и тест
      // проваливался всегда, wdbc-x1nz.2.103) + Черты/Конструктор.
      const t = await charTest(patient, "t", mod);
      rolls.push(t.roll);
      const ok = t.success;
      lines.push(`${rollIcon("heart","#8fd0ff")}<b>${modeLabel}</b> (${lblOf[key]}): тест T+0${mod ? `${mod >= 0 ? "+" : ""}${mod}` : ""}${t.rules} → порог <b>${t.threshold}</b>, бросок <b>${t.roll.total}</b> — ${ok ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал</span>`}`);
      heal = ok ? Math.max(0, 1 + bonus) : 0;
    } else {
      heal = amount > 0 ? Math.max(0, amount + bonus) : 0;
      lines.push(`${rollIcon("heart","#8fd0ff")}<b>${modeLabel}</b> (${lblOf[key]}): восстановление <b>${amount}</b>${bonus && amount > 0 ? ` + ${bonus} (доп.)` : ""} Ран${amount === 0 ? " — нет лечения" : ""}.`);
    }
  }

  // effectiveMax — Саркофаг Дредноута (wdbc-drn): выше него Раны не лечатся.
  const woundMax = patient.system.wounds?.effectiveMax ?? patient.system.wounds?.max ?? 0;
  const missing = Math.max(0, woundMax - (patient.system.wounds?.value ?? 0))
    + (patient.system.wounds?.critical ?? 0);
  const applied = Math.min(heal, missing);
  if (periodRestart) {
    try { await patient.update(periodRestart); } catch {}
  }
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
