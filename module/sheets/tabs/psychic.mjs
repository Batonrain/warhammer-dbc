// module/sheets/tabs/psychic.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Псайкана и Силы навигатора. Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../../constants/characteristics.mjs";
import { SKILLS_DEF } from "../../constants/skills.mjs";
import { DAMAGE_TYPES } from "../../constants/items.mjs";
import { isAeldariRace } from "../../apps/race-library.mjs";
import { PSY_NATURES, PSY_MODES, PSY_PATHS, PSY_POWER_TYPES } from "../../constants/psyker.mjs";
import { PSY_DISCIPLINES } from "../../constants/disciplines.mjs";
import { getPhenomenon, getPeril } from "../../constants/psyker-tables.mjs";
import { WEAPON_PROPERTIES } from "../../constants/weapon-properties.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { _degWord, resolveCharFormula, esc } from "../../helpers/utils.mjs";
import { resolveWeaponPropsList, buildTargetEffectButtons, buildPropertyChatBlock } from "../../combat/weapon-properties.mjs";
import { attackThreshold } from "../../combat/attack-threshold.mjs";
import { ruleRollModsHtml } from "../../rules/roll-mods.mjs";
import { syncItemEffectsDisabled } from "../../apps/effects.mjs";
import { computeWoundDamage } from "./wounds.mjs";
import { fatiguePenalty } from "./conditions.mjs";

/**
 * Через что кастуется психосила. Прорицание (divination) — через навык
 * Псинаука; также явный выбор testChar="psyniscience" использует навык.
 * Иначе — характеристика (WP/Int/Per/Fel).
 */
export function resolvePsyCastAttr(actor, sys) {
  let key = sys.testChar || "wp";
  if (sys.discipline === "divination" && (key === "per" || !sys.testChar)) key = "psyniscience";
  if (key === "psyniscience") {
    return { key, val: actor.system.skills?.psyniscience?.total ?? -20, abbr: "Псинаука" };
  }
  if (key === "cor") {
    // Психотест на Порчу (колдовство/демонология): бросок против значения Порчи.
    return { key, val: actor.system.corruption?.value ?? 0, abbr: "Порча" };
  }
  return {
    key,
    val:  actor.system.characteristics?.[key]?.total ?? 0,
    abbr: CHARACTERISTICS[key]?.abbr ?? key.toUpperCase()
  };
}

export function showManifestDialog(actor, item) {
  const sys      = item.system;
  const psy      = actor.system.psyker || {};
  const isEldar  = isAeldariRace(actor.system.race);
  // Аэльдари всегда используют Природу «Древнее Мастерство»
  const nature   = isEldar ? "ancientMastery" : (psy.class || "bound");
  // Манифест. PR (mPR) — свободный выбор от 1 до текущего Пси-Рейтинга (тPR),
  // стр. 289: тPR = бPR −1 за каждую поддерживаемую силу, а эPR можно снижать
  // «на любое значение до минимума в 1». `prRequired` — требование ИЗУЧЕНИЯ
  // силы («кроме требований»), а не нижняя граница манифестации, поэтому
  // список не должен им ограничиваться.
  const maxPR    = Math.max(0, psy.currentRating || 0);
  const minPR    = 1;
  const cast     = resolvePsyCastAttr(actor, sys);
  const charAbbr = cast.abbr;
  const charVal  = cast.val;

  let prOptions = "";
  const top = Math.max(1, maxPR);
  for (let p = minPR; p <= top; p++)
    prOptions += `<option value="${p}" ${p === top ? "selected" : ""}>${p}</option>`;
  // тPR 0 — новые силы манифестировать нельзя (стр. 289).
  const prWarn = maxPR <= 0
    ? `<div class="pm-warn">тPR = 0 (все ${psy.sustain || 0} PR уходят на поддержание) — новые психосилы манифестировать нельзя.</div>`
    : (psy.sustain ? `<div class="pm-note">тPR ${maxPR} = бPR ${psy.rating || 0} − ${psy.sustain} на поддержание.</div>` : "");

  const pathOptions = Object.entries(PSY_PATHS).map(([k, p]) =>
    `<option value="${k}">${p.label}</option>`).join("");

  const profiles = sys.profiles || [];
  const variants = sys.variants || [];

  // Данные для живого предпросмотра порога/Феномена (клиентская сторона).
  const NATx = PSY_NATURES[nature] || PSY_NATURES.bound;
  const natData = {
    normalPhenMod: NATx.normalPhenMod || 0,
    pushBonusType: NATx.pushBonusType || "fixed",
    pushBonus:     NATx.pushBonus || 0,
    pushFormula:   NATx.pushFormula || "",
    pushPhenType:  NATx.pushPhenType || "flat",
    pushPhenValue: NATx.pushPhenValue || 0
  };
  const pathData = Object.fromEntries(Object.entries(PSY_PATHS).map(([k, p]) => [k, {
    ePR: p.ePR || 0, testMod: p.testMod || 0, phenMod: p.phenMod || 0, dyn: p.dynamicTestMod || ""
  }]));
  const dynBonus = { t: actor.system.characteristics?.t?.bonus ?? 0,
                     wp: actor.system.characteristics?.wp?.bonus ?? 0 };
  const powerMod = Number(sys.testMod) || 0;
  const variantMods = variants.map(v => Number(v.testMod) || 0);
  const psyMeta = { charVal, charAbbr, powerMod, natData, pathData, dynBonus, variantMods, isEldar };

  // Правила реестра. Манифестация — такой же тест конвейера, как бросок навыка
  // и атака: вид теста «power», область эффекта «power» или «power:<имя>». Сама
  // сила лежит в контексте целиком — по ней область и находит нужную
  // (rules/resolve-test.mjs).
  const ruleMods = ruleRollModsHtml(actor, {
    kind: "power", power: item, char: cast.key,
    skill: cast.key === "psyniscience" ? "psyniscience" : undefined,
    targetActor: [...(game.user?.targets ?? [])][0]?.actor ?? null
  });

  const discLabel = (PSY_DISCIPLINES?.[sys.discipline]?.label) || "";
  const typeLabel = (PSY_POWER_TYPES?.[sys.powerType]) || sys.powerType || "";
  const dmgLabel  = sys.damage ? ` · урон ${sys.damage}` : "";

  const content = `
      <form class="wh-psy-manifest">
        <div class="pm-header">
          <span class="pm-sigil">✨</span>
          <div class="pm-titles">
            <div class="pm-name">${esc(item.name)}</div>
            <div class="pm-sub">${[discLabel, typeLabel].filter(Boolean).join(" · ")}${dmgLabel}</div>
          </div>
          <span class="pm-nature" title="Природа Дара">${NATx.label || nature}</span>
        </div>

        <div class="pm-preview">
          <div class="pm-prev-thr-wrap">
            <div class="pm-prev-lbl">Порог психотеста (${charAbbr})</div>
            <div class="pm-prev-thr" id="pm-thr">—</div>
          </div>
          <div class="pm-prev-meta">
            <div class="pm-prev-chip">эPR <b id="pm-epr">—</b></div>
            <div class="pm-prev-chip pm-prev-phen" id="pm-phen">—</div>
          </div>
        </div>

        <div class="pm-modes" role="group" aria-label="Режим">
          <button type="button" class="pm-mode" data-mode="safe" title="эPR = ½ mPR (▲). Феномены не вызываются.">Безопасный</button>
          <button type="button" class="pm-mode is-on" data-mode="normal" title="эPR = mPR. Феномен при дубле на успехе или 99.">Обычный</button>
          <button type="button" class="pm-mode" data-mode="push" title="эPR = mPR + бонус Природы. Феномен гарантирован.">Усиленный</button>
        </div>
        <input type="hidden" id="psy-mode" value="normal"/>

        <div class="pm-row">
          <label>Манифест. PR</label>
          <select id="psy-pr" class="pm-input">${prOptions}</select>
          ${isEldar ? `
          <label class="pm-push-lbl">Усиление</label>
          <select id="psy-push-bonus" class="pm-input">
            <option value="1">+1</option><option value="2">+2</option>
            <option value="3">+3</option><option value="4">+4</option>
          </select>` : ""}
        </div>
        ${prWarn}

        <div class="pm-row">
          <label>Путь Силы</label>
          <select id="psy-path" class="pm-input pm-wide">${pathOptions}</select>
        </div>
        ${profiles.length ? `
        <div class="pm-row">
          <label>Профиль</label>
          <select id="psy-profile" class="pm-input pm-wide">
            <option value="-1">Основной</option>
            ${profiles.map((p, i) => `<option value="${i}">${p.label || ("Профиль " + (i + 1))}</option>`).join("")}
          </select>
        </div>` : `<input type="hidden" id="psy-profile" value="-1"/>`}
        ${variants.length ? `
        <div class="pm-row">
          <label>Вариация</label>
          <select id="psy-variant" class="pm-input pm-wide">
            <option value="-1">— нет —</option>
            ${variants.map((v, i) => `<option value="${i}">${v.label || ("Вариация " + (i + 1))}${v.testMod ? ` (${v.testMod >= 0 ? "+" : ""}${v.testMod})` : ""}</option>`).join("")}
          </select>
        </div>` : `<input type="hidden" id="psy-variant" value="-1"/>`}

        <details class="pm-adv">
          <summary>Дополнительно</summary>
          <div class="pm-row">
            <label>Мод. PR (±)</label>
            <input id="psy-pr-mod" class="pm-input pm-num" type="number" value="0" title="Таланты/ситуации: каст по PR±N"/>
            <label>Доп. мод. теста</label>
            <input id="psy-mod" class="pm-input pm-num" type="number" value="0"/>
          </div>
          <div class="pm-row">
            <label>эPR урона</label>
            <input id="psy-pr-dmg" class="pm-input pm-num" type="number" value="0" min="0" title="0 = полный эPR. Можно снизить эPR только для урона (мин. 1)"/>
            <label>эPR дальности</label>
            <input id="psy-pr-range" class="pm-input pm-num" type="number" value="0" min="0" title="0 = полный эPR. Можно снизить эPR только для дальности (мин. 1)"/>
          </div>
        </details>
        ${ruleMods.html}
      </form>`;

  new Dialog({
    title: `Манифестация: ${item.name}`,
    content,
    buttons: {
      cast: {
        icon: '<i class="fas fa-hat-wizard"></i>', label: "Психотест!",
        callback: async html => {
          // Галочки правил — тот же формат и тот же разбор, что в диалоге атаки.
          let ruleMod = 0, halveRulePenalty = false;
          html.find(".rule-mod:checked").each((_, cb) => {
            ruleMod += parseInt(cb.dataset.value) || 0;
            if (cb.dataset.halve === "1") halveRulePenalty = true;
          });
          await executePsychotest(actor, item, {
            ruleMod, halveRulePenalty,
            mPR:      parseInt(html.find("#psy-pr").val())     || minPR,
            prMod:    parseInt(html.find("#psy-pr-mod").val()) || 0,
            mode:     html.find("#psy-mode").val()             || "normal",
            path:     html.find("#psy-path").val()             || "",
            modifier: parseInt(html.find("#psy-mod").val())    || 0,
            eldar:    isEldar,
            pushChoice: parseInt(html.find("#psy-push-bonus").val()) || 1,
            damagePR: parseInt(html.find("#psy-pr-dmg").val())   || 0,
            rangePR:  parseInt(html.find("#psy-pr-range").val()) || 0,
            profileIdx: parseInt(html.find("#psy-profile").val()) ?? -1,
            variantIdx: parseInt(html.find("#psy-variant").val()) ?? -1
          });
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "cast",
    render: html => wirePsyManifestPreview(html, psyMeta)
  }, { classes: ["dialog", "wh-attack-dialog", "warhammer-dbc", "wh-holo", "wh-psy-dialog"], width: 400 }).render(true);
}

// Живой предпросмотр окна манифестации: пилюли режима + пересчёт порога/эPR/Феномена.
export function wirePsyManifestPreview(html, m) {
  const el = html[0] ?? html;
  const $ = (sel) => el.querySelector(sel);
  const modeInput = $("#psy-mode");

  const recalc = () => {
    const mode  = modeInput.value || "normal";
    const mPR0  = parseInt($("#psy-pr")?.value) || 0;
    const prMod = parseInt($("#psy-pr-mod")?.value) || 0;
    const mod   = parseInt($("#psy-mod")?.value) || 0;
    const path  = $("#psy-path")?.value || "";
    const varIdx = parseInt($("#psy-variant")?.value ?? "-1");
    const pMR = Math.max(0, mPR0 + prMod);

    let ePR = pMR, phenText = "", eprSuffix = "";
    if (mode === "safe") { ePR = Math.ceil(pMR / 2); phenText = "Феноменов нет"; }
    else if (mode === "normal") { ePR = pMR; phenText = m.isEldar ? "Феномен: дубль 66 / крит-провал" : "Феномен: дубль / 99"; }
    else {
      let pb = 0;
      if (m.natData.pushBonusType === "choice" || m.isEldar) pb = parseInt($("#psy-push-bonus")?.value) || 1;
      else if (m.natData.pushBonusType === "roll") { pb = 0; eprSuffix = `+${m.natData.pushFormula || "1d5"}`; }
      else pb = m.natData.pushBonus || 0;
      ePR = pMR + pb;
      phenText = "Феномен гарантирован";
    }
    const pd = m.pathData[path] || { ePR: 0, testMod: 0, phenMod: 0, dyn: "" };
    ePR += pd.ePR || 0;
    const pathTest = (pd.testMod || 0) + (pd.dyn ? (m.dynBonus[pd.dyn] || 0) : 0);
    const varMod = (varIdx >= 0) ? (m.variantMods[varIdx] || 0) : 0;
    // Галочки правил считаем тем же кодом, что и сам бросок (executePsychotest),
    // иначе игрок увидит в окне одно число, а бросится другое.
    let ruleMod = 0, halveRule = false;
    el.querySelectorAll(".rule-mod:checked").forEach(cb => {
      ruleMod += parseInt(cb.dataset.value) || 0;
      if (cb.dataset.halve === "1") halveRule = true;
    });
    const thr = attackThreshold({
      base: m.charVal + 5 * ePR,
      mods: [mod, ruleMod, pathTest, m.powerMod, varMod],
      halvePenalty: halveRule
    });

    $("#pm-thr").textContent = thr;
    $("#pm-epr").textContent = `${ePR}${eprSuffix}`;
    const phenEl = $("#pm-phen");
    phenEl.textContent = phenText;
    phenEl.classList.toggle("danger", mode === "push");
    phenEl.classList.toggle("safe", mode === "safe");
  };

  // Пилюли режима.
  el.querySelectorAll(".pm-mode").forEach(b => b.addEventListener("click", () => {
    el.querySelectorAll(".pm-mode").forEach(x => x.classList.remove("is-on"));
    b.classList.add("is-on");
    modeInput.value = b.dataset.mode;
    // Поле «Усиление» актуально только в Усиленном режиме.
    const pushLbl = el.querySelector(".pm-push-lbl");
    const pushSel = $("#psy-push-bonus");
    if (pushLbl && pushSel) { const on = b.dataset.mode === "push"; pushLbl.style.opacity = pushSel.style.opacity = on ? "1" : "0.4"; }
    recalc();
  }));
  el.querySelectorAll("select, input").forEach(inp => {
    inp.addEventListener("change", recalc);
    inp.addEventListener("input", recalc);
  });

  // Раскрытие «Дополнительно» — растянуть окно диалога под новый контент,
  // иначе блок обрезается.
  const details = el.querySelector(".pm-adv");
  if (details) {
    const win = el.closest("[data-appid]");
    const app = win ? ui.windows?.[win.dataset.appid] : null;
    details.addEventListener("toggle", () => app?.setPosition?.({ height: "auto" }));
  }
  recalc();
}

export async function executePsychotest(actor, item, opts) {
  const sys      = item.system;
  const psy      = actor.system.psyker || {};
  const nature   = opts.eldar ? "ancientMastery" : (psy.class || "bound");
  const NAT      = PSY_NATURES[nature] || PSY_NATURES.bound;
  const PATH     = PSY_PATHS[opts.path] || PSY_PATHS[""];
  // Руны Судьбы/Битвы: манифестация только в Безопасном/Обычном режиме.
  let runeNote = "";
  if (PATH.runeMode && opts.mode === "push") {
    opts.mode = "normal";
    runeNote = "Руна: Усиленный режим недоступен — использован Обычный.";
  }
  const MODE     = PSY_MODES[opts.mode] || PSY_MODES.normal;
  const cast     = resolvePsyCastAttr(actor, sys);
  const charVal  = cast.val;
  const charAbbr = cast.abbr;

  // ── Эффективный Пси-Рейтинг и модификатор к броску Феноменов ──────────────
  // Манифест. PR с учётом модификатора (таланты/ситуации: PR±N), мин. 0.
  const prMod = opts.prMod || 0;
  const mPR   = Math.max(0, (opts.mPR || 0) + prMod);
  let ePR = mPR;
  let pushBonus = 0;
  let phenMod = 0;
  if (opts.mode === "safe") {
    ePR = Math.ceil(mPR / 2);
  } else if (opts.mode === "normal") {
    ePR = mPR;
    phenMod = NAT.normalPhenMod;
  } else { // push (Усиленный)
    if (NAT.pushBonusType === "roll") {
      const r = await new Roll(NAT.pushFormula).evaluate();
      pushBonus = r.total;
    } else if (NAT.pushBonusType === "choice") {
      pushBonus = Math.max(1, Math.min(NAT.pushChoiceMax || 4, opts.pushChoice || 1));
    } else pushBonus = NAT.pushBonus;
    ePR = mPR + pushBonus;
    phenMod = NAT.pushPhenType === "flat"
      ? NAT.pushPhenValue
      : NAT.pushPhenValue * pushBonus;
  }

  // ── Бонусы Пути Силы ──────────────────────────────────────────────────────
  ePR     += PATH.ePR || 0;
  phenMod += PATH.phenMod || 0;
  const pathLabel = PATH.label || "";
  // Динамический бонус Пути от характеристики (Телесная Конверсия: +T.b)
  const pathDynMod = PATH.dynamicTestMod
    ? (actor.system.characteristics?.[PATH.dynamicTestMod]?.bonus ?? 0) : 0;

  // Психофокус: отдельный тест W+0 (свободное действие, 1/ход). Успех → +10,
  // крит. успех (дубль на успехе) → +15, крит. провал (дубль на провале) → −10.
  let focusMod = 0, focusNote = "", focusRoll = null;
  if (PATH.focusTest) {
    const wpv = actor.system.characteristics?.wp?.total ?? 0;
    focusRoll = await new Roll("1d100").evaluate();
    const fv      = focusRoll.total;
    const fPass   = fv <= wpv;
    const fDouble = (fv % 11 === 0) || fv === 100;
    if (fPass && fDouble) focusMod = 15;
    else if (fPass)       focusMod = 10;
    else if (fDouble)     focusMod = -10;
    const fWord = (fPass && fDouble) ? "крит. успех" : fPass ? "успех" : fDouble ? "крит. провал" : "провал";
    const fCls  = focusMod >= 0 ? "roll-success" : "roll-failure";
    focusNote = `<div class="roll-defense-note">${rollIcon("spark","#c98bff")}Психофокус (W ${wpv}): бросок <b>${fv}</b> → <span class="${fCls}">${fWord}${focusMod ? `, ${focusMod > 0 ? "+" : ""}${focusMod}` : ", без бонуса"}</span> к психотесту. <i>(свободное действие, 1/ход, в свой Ход)</i></div>`;
  }
  const pathTestMod = (PATH.testMod || 0) + pathDynMod + focusMod;

  const actorUpdates = {}; // накопленные изменения (Порча Варп-Шока, Раны Конверсии)

  // ── Эффективный PR по аспектам ─────────────────────────────────────────────
  // Псайкер может независимо снизить эPR для урона и дальности (минимум 1),
  // не трогая эPR психотеста. 0 в диалоге = использовать полный эPR.
  const clampPR  = (v) => (v > 0 ? Math.max(1, Math.min(ePR, v)) : ePR);
  const damagePR = clampPR(opts.damagePR || 0);
  const rangePR  = clampPR(opts.rangePR  || 0);
  const aspectsDiffer = damagePR !== ePR || rangePR !== ePR;

  // ── Профиль атаки и вариация броска ────────────────────────────────────────
  // Если выбран доп. профиль — берём его урон/тип/пробитие/свойства/урон-в-хар-ку,
  // иначе основной. Вариация добавляет свой модификатор к психотесту.
  const profile = (opts.profileIdx >= 0) ? (sys.profiles || [])[opts.profileIdx] : null;
  const atk = profile ? {
    damage:    profile.damage, damageType: profile.damageType || "energy",
    pen:       Number(profile.penetration) || 0,
    props:     parsePsyPropsText(profile.propsText),
    charStat:  profile.charDamageStat || "",
    charForm:  profile.charDamageFormula || "",
    label:     profile.label || "профиль"
  } : {
    damage:    sys.damage, damageType: sys.damageType || "energy",
    pen:       Number(sys.penetration) || 0,
    props:     sys.weaponProps || [],
    charStat:  sys.charDamageStat || "",
    charForm:  sys.charDamageFormula || "",
    label:     "основной"
  };
  const variant    = (opts.variantIdx >= 0) ? (sys.variants || [])[opts.variantIdx] : null;
  const variantMod = Number(variant?.testMod) || 0;

  const powerMod  = sys.testMod || 0; // собственный модификатор силы
  // Складываем тем же счётчиком, что и атака: галочка «ополовинить штраф»
  // делит сумму, только если она в минус, и округляет в пользу игрока.
  const threshold = attackThreshold({
    base: charVal + 5 * ePR,
    mods: [opts.modifier || 0, opts.ruleMod || 0, pathTestMod, powerMod, variantMod],
    halvePenalty: !!opts.halveRulePenalty
  });
  const roll = await new Roll("1d100").evaluate();
  const rv   = roll.total;
  let success = rv <= threshold;
  let deg  = Math.floor(Math.abs(rv - threshold) / 10) + 1;
  const allRolls = focusRoll ? [roll, focusRoll] : [roll];

  // Аэльдари, Безопасный режим: авто-успех, число успехов = тPR (mPR)
  if (opts.eldar && opts.mode === "safe") {
    success = true;
    deg = Math.max(1, mPR);
  }

  // Телесная Конверсия — цена в Ранах (платится при использовании Пути)
  if (PATH.woundCost) {
    Object.assign(actorUpdates, computeWoundDamage(actor.system, PATH.woundCost));
  }

  // ── Авто-урон (для атакующих сил при успехе) ──────────────────────────────
  const isDamaging = ["attack", "psychicShoot", "psychicBlade"].includes(sys.powerType);
  const atkProps   = resolveWeaponPropsList(atk.props);   // свойства атаки (профиля)
  let damageSection = "";
  if (success && isDamaging && atk.damage) {
    const chars = actor.system.characteristics;
    const dmgFormula = resolveCharFormula(String(atk.damage).replace(/\bPR\b/gi, damagePR), chars, actor.system.corruptionBonus ?? 0);
    // Число попаданий по типу Психострельбы (стр. 290): Снаряд/Взрыв/Дыхание — 1;
    // Обстрел (короткая очередь) — по 1 за нечётный Успех = ceil(deg/2);
    // Шторм (длинная очередь) — по 1 за каждый Успех = deg.
    const shootType = sys.shootSubtype || "";
    let hits = 1, hitsNote = "";
    if (sys.powerType === "psychicShoot") {
      if (shootType === "barrage") { hits = Math.max(1, Math.ceil(deg / 2)); hitsNote = `Психический Обстрел: <b>${hits}</b> попад. (по 1 за нечётный из ${deg} Успехов).`; }
      else if (shootType === "storm") { hits = Math.max(1, deg); hitsNote = `Психический Шторм: <b>${hits}</b> попад. (по 1 за каждый из ${deg} Успехов).`; }
    }
    try {
      const dtLabel = DAMAGE_TYPES[atk.damageType] || atk.damageType;
      const pen     = atk.pen;
      const hitLines = [];
      for (let h = 0; h < hits; h++) {
        const dmgRoll = await new Roll(dmgFormula).evaluate();
        allRolls.push(dmgRoll);
        hitLines.push(`
            <div class="roll-damage-hit">
              <span>${hits > 1 ? `Попадание #${h + 1}` : "Урон"} (${dtLabel}, Проб. ${pen}): <b>${dmgRoll.total}</b></span>
              <button class="wh-apply-dmg-btn" type="button"
                data-damage="${dmgRoll.total}" data-penetration="${pen}"
                data-damage-type="${atk.damageType}" data-hit-location="Торс"
                data-weapon-name="${item.name}" data-attacker="${actor.name}">
                ${dmgRoll.total} → Торс
              </button>
            </div>`);
      }
      damageSection = `
          <div class="roll-damage-section">
            ${hitsNote ? `<div class="roll-threshold" style="font-size:0.82em;">${hitsNote}${profile ? ` Профиль «${atk.label}».` : ""} Вторичные цели (в 2м) — попадания в Торс.</div>` : (profile ? `<div class="roll-threshold" style="font-size:0.82em;">Профиль «${atk.label}».</div>` : "")}
            ${hitLines.join("")}
          </div>`;
    } catch(e) {
      ui.notifications.warn(`Не удалось бросить урон психосилы: ${atk.damage}`);
      console.error(e);
    }
  }

  // ── Урон в характеристику (если задан) ─────────────────────────────────────
  let charDamageSection = "";
  if (success && atk.charStat && atk.charForm) {
    try {
      const cdRoll = await new Roll(String(atk.charForm).replace(/\bPR\b/gi, damagePR)).evaluate();
      allRolls.push(cdRoll);
      const cdAbbr = CHARACTERISTICS[atk.charStat]?.abbr || atk.charStat.toUpperCase();
      charDamageSection = `
          <div class="roll-damage-section">
            <div class="roll-damage-label">Урон в характеристику <b>${cdAbbr}</b>: <b>${cdRoll.total}</b></div>
            <div class="roll-threshold" style="font-size:0.82em;">Примените к соответствующей характеристике цели (минуя Раны).</div>
          </div>`;
    } catch {
      ui.notifications.warn(`Не удалось бросить урон в характеристику: ${atk.charForm}`);
    }
  }

  // ── Свойства атаки психосилы: памятки + кнопки эффектов на цель ─────────────
  let attackPropsSection = "";
  if (success && isDamaging && atkProps.length) {
    const propBlock  = buildPropertyChatBlock(atkProps);
    const effectBtns = buildTargetEffectButtons(atkProps, { hit: true, netDamageKnown: false });
    attackPropsSection = (propBlock || "") + (effectBtns || "");
  }

  // ── Феномен / Прорыв ──────────────────────────────────────────────────────
  let phenomena = false;
  const isDouble = (rv % 11 === 0) || rv === 100;
  if (PATH.phenOnly66) {
    // Руны Судьбы/Битвы: Феномен только на броске 66 в Обычном режиме.
    phenomena = (opts.mode === "normal") && success && rv === 66;
  } else if (opts.eldar) {
    // Эльдарские правила Феноменов по режимам:
    if (opts.mode === "safe") {
      phenomena = false;                                   // Безопасный — никогда
    } else if (opts.mode === "normal") {
      const critFail = !success && (isDouble || rv === 100);
      phenomena = (success && rv === 66) || critFail;      // дубль 66 на успехе или крит. провал
    } else { // push
      phenomena = !success || (success && isDouble);       // провал или дубль
    }
  } else if (MODE.phenomena === "always") {
    phenomena = true;
  } else if (MODE.phenomena === "double") {
    phenomena = (success && isDouble) || rv === 99;
  }

  let phenSection = "";
  let perilTriggered = false;
  if (phenomena) {
    const phenRoll = await new Roll(`1d100 + ${phenMod}`).evaluate();
    allRolls.push(phenRoll);
    const phenVal = phenRoll.total;
    const phen = getPhenomenon(phenVal);
    phenSection = `
        <div class="psy-phenomenon">
          <div class="psy-phen-header">⚠️ Психический Феномен (бросок ${phenVal}${phenMod !== 0 ? `, мод ${phenMod >= 0 ? "+" : ""}${phenMod}` : ""})</div>
          <div class="psy-phen-name">${phen.label}</div>
          <div class="psy-phen-text">${phen.text}</div>
        </div>`;

    // Прорыв (если Феномен переходит в Прорыв)
    if (phen.peril) {
      perilTriggered = true;
      const perilRoll = await new Roll("1d100").evaluate();
      allRolls.push(perilRoll);
      const peril = getPeril(perilRoll.total);
      phenSection += `
          <div class="psy-peril">
            <div class="psy-peril-header">💀 ВАРП-ПРОРЫВ! (бросок ${perilRoll.total})</div>
            <div class="psy-peril-name">${peril.label}</div>
            <div class="psy-peril-text">${peril.text}</div>
          </div>`;
    }
  } else if (opts.mode === "safe") {
    phenSection = `<div class="roll-threshold" style="font-size:0.85em;">Безопасный режим — Феномены не вызываются.</div>`;
  } else {
    phenSection = `<div class="roll-threshold" style="font-size:0.85em;color:#3a7a3a;">Феномен не вызван.</div>`;
  }

  // ── Варп-Шок: не-Хаоситы получают Порчу при Феномене (1d5 при Прорыве) ──────
  let warpShockSection = "";
  if (phenomena && !NAT.isChaos) {
    let corrAmt = 1;
    if (perilTriggered) {
      const corrRoll = await new Roll("1d5").evaluate();
      allRolls.push(corrRoll);
      corrAmt = corrRoll.total;
    }
    const curCorr = actor.system.corruption?.value || 0;
    actorUpdates["system.corruption.value"] = curCorr + corrAmt;
    warpShockSection = `<div class="psy-warpshock">🌀 Варп-Шок: <b>+${corrAmt} Порчи</b>${perilTriggered ? " (1d5 — за Прорыв)" : ""}. Не-Хаоситы в радиусе PR×5 м от Прорыва: тест W+0 или +1 Порчи.</div>`;
  } else if (phenomena && NAT.isChaos) {
    warpShockSection = `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Демонический дар игнорирует негативные эффекты собственных Феноменов (но не Прорывов).</div>`;
  }

  // Цена Конверсии в чат
  let conversionLine = "";
  if (PATH.woundCost) {
    conversionLine = `<div class="roll-threshold" style="font-size:0.85em;color:#8b0000;">${rollIcon("blood","#ff6b6b")}Телесная Конверсия: −${PATH.woundCost} Раны.</div>`;
  }

  // Применяем накопленные изменения (Раны/Порча)
  if (Object.keys(actorUpdates).length) await actor.update(actorUpdates);

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("spark","#c98bff")}${esc(item.name)}</div>
          <div class="roll-threshold">
            Природа: <b>${NAT.label}</b> | Режим: <b>${MODE.label}</b>${pathLabel ? ` | Путь: <b>${pathLabel}</b>` : ""}
          </div>
          <div class="roll-threshold">
            mPR <b>${opts.mPR}</b>${prMod ? ` ${prMod >= 0 ? "+" : ""}${prMod} = <b>${mPR}</b>` : ""} → эPR <b>${ePR}</b>${pushBonus ? ` (Усиление +${pushBonus})` : ""}${PATH.ePR ? ` (Путь +${PATH.ePR})` : ""}
          </div>
          ${aspectsDiffer ? `<div class="roll-threshold" style="font-size:0.82em;">эPR по аспектам: тест <b>${ePR}</b>${isDamaging ? ` · урон <b>${damagePR}</b>` : ""} · дальность <b>${rangePR}</b></div>` : ""}
          ${sys.range ? `<div class="roll-threshold" style="font-size:0.82em;">Дальность: ${String(sys.range).replace(/\bPR\b/gi, rangePR)}</div>` : ""}
          <div class="roll-threshold">
            ${charAbbr}: <b>${charVal}</b> + 5×${ePR}${opts.modifier ? ` ${opts.modifier >= 0 ? "+" : ""}${opts.modifier}` : ""}${pathTestMod ? ` ${pathTestMod >= 0 ? "+" : ""}${pathTestMod} (Путь)` : ""}${variantMod ? ` ${variantMod >= 0 ? "+" : ""}${variantMod} (Вариация)` : ""}
            → Порог: <b>${threshold}</b>
          </div>
          ${variant ? `<div class="roll-threshold" style="font-size:0.82em;">Вариация: <b>${variant.label || "—"}</b>${variant.note ? ` — ${variant.note}` : ""}</div>` : ""}
          ${PATH.note ? `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Путь: ${PATH.note}</div>` : ""}
          ${runeNote ? `<div class="roll-threshold" style="font-size:0.82em;color:#7a1010;">${runeNote}</div>` : ""}
          ${focusNote}
          <div class="roll-dice">Психотест: <b>${rv}</b></div>
          <div class="roll-outcome">
            ${success
              ? `<span class="roll-success">Манифестация удалась — ${deg} ${_degWord(deg)}</span>`
              : `<span class="roll-failure">Психотест провален — ${deg} ${_degWord(deg)}</span>`}
          </div>
          ${conversionLine}
          ${damageSection}
          ${charDamageSection}
          ${attackPropsSection}
          ${phenSection}
          ${warpShockSection}
        </div>`,
    rolls: allRolls,
    sound: CONFIG.sounds.dice
  }, rollMode));
}

export function rollPsyniscience(actor, rollSkill) {
  const def = SKILLS_DEF.psyniscience;
  const sk  = actor.system.skills?.psyniscience;
  return rollSkill(def?.label ?? "Пси-чутьё", sk?.total ?? -20, def?.char ?? "per", { skill: "psyniscience" });
}

/** Тест W + PR×5 (для Пси-капюшона и Выжигания Души). */
export async function rollPsyWpTest(actor, label, note) {
  const wp  = actor.system.characteristics?.wp?.total ?? 0;
  const pr  = actor.system.psyker?.currentRating ?? 0;
  const eff = wp + 5 * pr;
  const roll = await new Roll("1d100").evaluate();
  const rv   = roll.total;
  const success = rv <= eff;
  const deg  = Math.floor(Math.abs(rv - eff) / 10) + 1;
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
        <div class="wh-roll-result">
          <div class="roll-header">${label}</div>
          <div class="roll-threshold">WP: <b>${wp}</b> + 5×PR(${pr}) → Порог: <b>${eff}</b></div>
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">
            ${success
              ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
              : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`}
          </div>
          <div class="roll-threshold" style="font-size:0.85em;color:#5a4a30;">${note}</div>
        </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode));
}

/** Применение Силы навигатора: простой тест характеристики (без Феноменов/Прорывов). */
export async function activateNavigatorPower(actor, item) {
  const sys     = item.system;
  const charKey = sys.testChar || "wp";
  const meta    = CHARACTERISTICS[charKey];
  const charVal = actor.system.characteristics?.[charKey]?.total ?? 0;
  const fatigue = fatiguePenalty(actor, charKey);
  const eff     = charVal + (sys.testMod || 0) + fatigue;

  const roll    = await new Roll("1d100").evaluate();
  const rv      = roll.total;
  const success = rv <= eff;
  const deg     = Math.floor(Math.abs(rv - eff) / 10) + 1;
  const rollMode = game.settings.get("core", "rollMode");
  const allRolls = [roll];

  // Урон (если задан и сила сработала)
  let dmgSection = "";
  if (success && sys.damage) {
    const chars = actor.system.characteristics;
    const f = resolveCharFormula(String(sys.damage), chars, actor.system.corruptionBonus ?? 0);
    try {
      const dmgRoll = await new Roll(f).evaluate();
      allRolls.push(dmgRoll);
      const dt  = DAMAGE_TYPES[sys.damageType] || sys.damageType;
      const pen = sys.penetration || 0;
      dmgSection = `
          <div class="roll-damage-section">
            <div class="roll-damage-label">Урон (${dt}, Проб. ${pen}): <b>${dmgRoll.total}</b></div>
            <button class="wh-apply-dmg-btn" type="button"
              data-damage="${dmgRoll.total}" data-penetration="${pen}"
              data-damage-type="${sys.damageType}" data-hit-location="Торс"
              data-weapon-name="${item.name}" data-attacker="${actor.name}">
              Применить урон: ${dmgRoll.total} → Торс
            </button>
          </div>`;
    } catch (e) { ui.notifications.warn(`Не удалось бросить урон: ${sys.damage}`); console.error(e); }
  }

  const dice = (await Promise.all(allRolls.map(r => r.render()))).join("");

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("spark","#8b78ff")}Сила навигатора: ${esc(item.name)}</div>
          ${sys.powerKind ? `<div class="roll-threshold" style="font-size:0.85em;">${sys.powerKind}</div>` : ""}
          <div class="roll-threshold">
            ${meta?.abbr ?? charKey}: <b>${charVal}</b>${sys.testMod ? ` ${sys.testMod >= 0 ? "+" : ""}${sys.testMod}` : ""}${fatigue ? ` 😓 ${fatigue}` : ""} → Порог: <b>${eff}</b>${sys.opposed ? " <span style='font-size:0.85em;'>(встречный — цель бросает свою хар-ку)</span>" : ""}
          </div>
          ${sys.range ? `<div class="roll-threshold" style="font-size:0.85em;">Дальность: <b>${sys.range}</b></div>` : ""}
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">
            ${success
              ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span>`
              : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span>`}
          </div>
          ${dmgSection}
          ${sys.effect ? `<div class="roll-threshold">${sys.effect}</div>` : ""}
          <div class="roll-threshold" style="font-size:0.78em;color:#5a4a30;">Навигатор не бросает по таблицам Феноменов и Прорывов Варпа.</div>
          <details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${dice}</details>
        </div>`,
    rolls: allRolls,
    sound: CONFIG.sounds.dice
  }, rollMode));
}

export function activatePsychicListeners(html, actor, { rollSkill, resolveSoulBurn } = {}) {
  // ── Силы навигатора (вкладка НАВ) ──────────────────────────────────────
  html.find(".nav-add-btn").click(async ev => {
    ev.preventDefault();
    const item = await Item.create({ name: "Новая сила навигатора", type: "navigatorPower" }, { parent: actor });
    item?.sheet?.render(true);
  });
  html.find(".nav-activate-btn").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) activateNavigatorPower(actor, item);
  });
  html.find(".nav-sustain-cb").change(async ev => {
    const id = ev.currentTarget.dataset.itemId;
    const on = ev.currentTarget.checked;
    // Можно поддерживать только одну Силу навигатора одновременно
    const updates = [];
    for (const it of actor.items) {
      if (it.type !== "navigatorPower") continue;
      const want = it.id === id ? on : false;
      if ((it.system.isSustained || false) !== want)
        updates.push({ _id: it.id, "system.isSustained": want });
    }
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
    for (const it of actor.items) {
      if (it.type !== "navigatorPower") continue;
      await syncItemEffectsDisabled(it, it.id === id ? on : false);
    }
  });

  // ── Псайкана ──────────────────────────────────────────────────────────
  // Базовый PR и Природа Дара редактируются и в ПСИ, и в Развитии — через
  // class-обработчики (без name=), чтобы не было конфликта дублей в форме.
  html.find(".psy-rating-input").change(ev => {
    actor.update({ "system.psyker.rating": parseInt(ev.currentTarget.value) || 0 });
  });
  html.find(".psy-class-select").change(ev => {
    actor.update({ "system.psyker.class": ev.currentTarget.value });
  });

  html.find(".psy-add-btn").click(async ev => {
    ev.preventDefault();
    const item = await Item.create({ name: "Новая психосила", type: "psychicPower" }, { parent: actor });
    item?.sheet?.render(true);
  });
  html.find(".psy-sustain-cb").change(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) { await item.update({ "system.isSustained": ev.currentTarget.checked }); await syncItemEffectsDisabled(item); }
  });
  html.find(".psy-manifest-btn").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) showManifestDialog(actor, item);
  });
  html.find(".psy-sense-btn").click(() => {
    if (rollSkill) rollPsyniscience(actor, rollSkill);
  });
  html.find(".psy-hood-btn").click(() => rollPsyWpTest(
    actor,
    "🛡️ Пси-капюшон",
    "Реакция: встречный тест W+PR×5 — уменьшает Успехи вражеской манифестации на ваши (при равенстве/больше — гасит силу)."));
  html.find(".psy-soulburn-btn").click(() => resolveSoulBurn?.(actor.id));
}

// Парсит текст особых свойств профиля психосилы («Tearing, Felling (4), Toxic (7, 2d10)»)
// в записи {key,rating,rating2}. Имена сопоставляются по label/en реестра.
function parsePsyPropsText(text) {
  if (!text) return [];
  const tokens = []; let depth = 0, cur = "";
  for (const ch of String(text)) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { tokens.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());
  const byName = {};
  for (const d of Object.values(WEAPON_PROPERTIES)) {
    byName[d.label.toLowerCase()] = d.key;
    if (d.en) byName[d.en.toLowerCase()] = d.key;
  }
  const out = [];
  for (const tok of tokens) {
    if (!tok) continue;
    const m = tok.match(/^(.*?)\s*\((.*)\)\s*$/);
    let name = tok, rating = null;
    if (m) { name = m[1].trim(); rating = m[2].trim(); }
    const key = byName[name.toLowerCase()];
    if (!key) continue;
    const entry = { key, rating: 0, rating2: 0 };
    if (rating != null) {
      const parts = rating.split(",").map(s => s.trim());
      const r1 = parseInt(parts[0]); if (!isNaN(r1)) entry.rating = r1;
      if (parts[1] != null) { const r2 = parseInt(parts[1]); if (!isNaN(r2)) entry.rating2 = r2; }
    }
    out.push(entry);
  }
  return out;
}
