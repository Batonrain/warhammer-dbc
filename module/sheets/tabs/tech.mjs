// module/sheets/tabs/tech.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Техночудеса и ресурсы Механикум. Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF } from "../../constants/skills.mjs";
import { DAMAGE_TYPES } from "../../constants/items.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { techIcon } from "../../constants/tech-icons.mjs";
import { ironModForQuality, leastQuality } from "../../constants/implant-mechanics.mjs";
import { _degWord, resolveCharFormula, esc } from "../../helpers/utils.mjs";
import { syncItemEffectsDisabled } from "../../apps/effects.mjs";
import { fatiguePenalty } from "./conditions.mjs";
import { resolveWeaponPropsList, buildTargetEffectButtons, buildPropertyChatBlock,
         aggregateAuto, applyDamageDiceMods } from "../../combat/weapon-properties.mjs";
import { rollExtremeDamage } from "../../combat/attack.mjs";
import { rollInfoguard, infoguardInteractionSection } from "../../apps/infoguard.mjs";
import { triggerAttackAnimation } from "../../integrations/autoanimations.mjs";
import { isPsalmUnseenFortressItem, psalmUnseenFortressGrant } from "../../rules/psalm-unseen-fortress.mjs";
import { hasElectrovigour } from "../../rules/electrovigour.mjs";
import { pickReroll } from "../../rules/reroll-pick.mjs";
import { testOutcome } from "../../rules/roll-outcome.mjs";

/** Активация Техночуда: Когниция + Энергия + тест Tech-Use (Ментальное) + урон. */
export async function activateTechMiracle(actor, item) {
  const sys      = item.system;
  const cogCost  = sys.cognitionCost || 0;
  let   enCost   = sys.energyCost || 0;
  const cog      = actor.system.cognition || { value: 0, max: 0 };
  const en       = actor.system.energy || { value: 0, max: 0 };

  if (cogCost > (cog.value || 0)) {
    ui.notifications.warn(`Недостаточно Когниции: нужно ${cogCost}, есть ${cog.value || 0}.`);
    return;
  }

  // ── Славословие: требует предварительной компиляции (X×5 минут) ──────────
  const isSlavo = sys.miracleType === "slavoslovie";
  if (isSlavo && !sys.compiled) {
    const x = sys.rating || 1;
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
          <div class="wh-roll-result">
            <div class="roll-header">${rollIcon("chart","#8fd0ff")}Компиляция Славословия: ${esc(item.name)}</div>
            <div class="roll-threshold">Требуется компиляция <b>${x}×5 = ${x * 5}</b> минут. Держится как Процесс с Ценой ½X = <b>${Math.ceil(x / 2)}</b> Когниции.</div>
            <div class="roll-outcome"><span class="roll-success">Отметьте «Скомпилировано» на листе техночуда, затем активируйте.</span></div>
          </div>`
    }, game.settings.get("core", "rollMode")));
    return;
  }

  // ── Железо (Технофокусы): наименее качественный из установленных ─────────
  // Poor −10 / Good +5 / Best +10 к тесту и к I.b в формулах. Если требуемый
  // имплант не установлен — Техночудо нельзя использовать.
  const QLABEL = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" };
  let ironMod = 0, ironLine = "", ironIbDelta = 0;
  const ironReqRaw = String(sys.iron || "").trim();
  if (ironReqRaw) {
    const reqs    = ironReqRaw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const focus   = actor.system.techFocus || [];
    const matched = [], missing = [];
    for (const req of reqs) {
      const rl  = req.toLowerCase();
      const hit = focus.find(f => {
        const fl = f.name.toLowerCase();
        return fl.includes(rl) || fl.split("/").some(p => p.trim() && rl.includes(p.trim()));
      });
      if (hit) matched.push(hit); else missing.push(req);
    }
    if (missing.length) {
      ui.notifications.warn(`Нет нужного Железа (Технофокуса): ${missing.join(", ")}. Техночудо нельзя использовать без него.`);
      return;
    }
    const worstQ = leastQuality(matched.map(m => m.quality)) || "common";
    ironMod      = ironModForQuality(worstQ);
    ironIbDelta  = Math.trunc(ironMod / 10); // best +1 I.b, poor −1, good/comm 0
    ironLine     = `Железо (${matched.map(m => `${m.name.split("/")[0].trim()} ${QLABEL[m.quality]}`).join(", ")}) → тест ${ironMod >= 0 ? "+" : ""}${ironMod}`;
  }

  const skKey      = sys.testSkill || "techUse";
  const skillDef   = SKILLS_DEF[skKey];
  const skillLabel = skillDef?.label ?? "Tech-Use";
  const sk         = actor.system.skills?.[skKey];
  const base       = sk?.total ?? -20;
  const fatigue    = fatiguePenalty(actor, skillDef?.char ?? "int");
  const testMod    = sys.testMod || 0;
  const eff        = base + fatigue + testMod + ironMod;
  const allRolls   = [];

  // ── Компенсатор (X): тест Т−(10×X) снижает цену в ⚡ на 1 за Успех ─────────
  // Мод. Качества Железа НЕ применяется. Бонус имплантов (Печь/Инферния/Solar).
  let compLine = "";
  let compX = sys.miracleType === "compensator" ? (sys.rating || 0) : 0;
  const compExtra = (sys.extraTypes || []).find(e => e.type === "compensator");
  if (compExtra) compX = Math.max(compX, compExtra.x || 0);
  if (compX > 0 && enCost > 0) {
    const compBonus = actor.system.techCompBonus || 0;
    const tTot   = actor.system.characteristics?.t?.total ?? 0;
    const compTh = tTot - 10 * compX + compBonus;
    // Electrovigour (wdbc-u0by): «Преимущество на тесты Т на Техночудеса с
    // типом Компенсатор» — безусловно, авто (кнопка активации без диалога).
    const electro = hasElectrovigour(actor);
    const cRolled = [];
    for (let i = 0; i < (electro ? 2 : 1); i++) cRolled.push(await new Roll("1d100").evaluate());
    allRolls.push(...cRolled);
    const cPicked = pickReroll(cRolled.map(r => r.total), "keepBest");
    const cRoll  = cRolled[cPicked.index];
    const { success: cSucc, deg: cDeg } = testOutcome(cRoll.total, compTh);
    const reduce = cSucc ? Math.min(enCost, cDeg) : 0;
    const enBefore = enCost;
    enCost = Math.max(0, enCost - reduce);
    const electroNote = cPicked.dropped.length ? `, Электрорвение: Преимущество, отброшено ${cPicked.dropped.join(", ")}` : "";
    compLine = `Компенсатор (X${compX}): T−${10 * compX}${compBonus ? ` +${compBonus}` : ""} → Порог ${compTh}${electroNote}, бросок ${cRoll.total} → `
      + (cSucc ? `−${reduce} ⚡ (${enBefore}→${enCost})` : `Провал, цена ${enCost} ⚡`);
  }

  // Проверка Энергии — после снижения Компенсатором, до основного теста
  if (enCost > (en.value || 0)) {
    ui.notifications.warn(`Недостаточно Энергии (Катушка Потенции): нужно ${enCost}, есть ${en.value || 0}.`);
    return;
  }

  // ── Основной тест активации ──────────────────────────────────────────────
  const roll    = await new Roll("1d100").evaluate();
  allRolls.push(roll);
  const rv      = roll.total;
  const success = rv <= eff;
  const deg     = Math.floor(Math.abs(rv - eff) / 10) + 1;

  // Трата ресурсов: Когниция ⚙ — всегда (до теста), Энергия ⚡ — только при Успехе.
  const resUpd = {};
  if (cogCost > 0)            resUpd["system.cognition.value"] = Math.max(0, (cog.value || 0) - cogCost);
  if (enCost  > 0 && success) resUpd["system.energy.value"]    = Math.max(0, (en.value  || 0) - enCost);

  // Псалом Незримой Крепости (wdbc-173l): +2 аблативные Раны за Успех этой
  // активации — переоформляет прошлый Купол, не складывает между активациями
  // (module/rules/psalm-unseen-fortress.mjs).
  let psalmSection = "";
  const FLAG = "warhammer-dbc", PSALM_FLAG = "psalmUnseenFortressAblative";
  if (success && isPsalmUnseenFortressItem(item)) {
    const prevContribution = Number(actor.getFlag(FLAG, PSALM_FLAG)) || 0;
    const result = psalmUnseenFortressGrant(actor.system, prevContribution, deg);
    resUpd["system.wounds.ablative"] = result.ablative;
    resUpd["system.wounds.ablativeMax"] = result.ablativeMax;
    resUpd[`flags.${FLAG}.${PSALM_FLAG}`] = result.contribution;
    psalmSection = `<div class="roll-threshold">Купол Рефрактора: <b>${result.contribution}</b> аблативных Ран (2×${deg} Успех${deg === 1 ? "" : "а"})</div>`;
  }

  if (Object.keys(resUpd).length) await actor.update(resUpd);

  // Славословие: при успехе компиляция расходуется (одноразово)
  if (isSlavo && success) await item.update({ "system.compiled": false });

  // Свойства атаки Техночуда — тот же движок, что у оружия и психосил (стр.
  // 166-170): раньше поля для них не было вовсе, и Экстремальный урон/Рвущее/
  // Проверенное для техночудес не считались — только текстом в «Эффекте».
  const atkProps = resolveWeaponPropsList(sys.weaponProps);
  const wp       = aggregateAuto(atkProps);

  // Урон (если задан и активация удалась)
  let dmgSection = "";
  if (success && sys.damage) {
    // Качество Железа модифицирует I.b в формулах эффектов/дальности (best +1, poor −1).
    let chars = actor.system.characteristics;
    if (ironIbDelta && chars?.int) {
      chars = foundry.utils.deepClone(chars);
      chars.int.bonus = (chars.int.bonus || 0) + ironIbDelta;
    }
    const f = applyDamageDiceMods(
      resolveCharFormula(String(sys.damage).replace(/\bX\b/gi, sys.rating || 0), chars, actor.system.corruptionBonus ?? 0),
      wp
    );
    try {
      const dmgRoll = await new Roll(f).evaluate();
      allRolls.push(dmgRoll);
      // Экстремальный урон (стр. 166-170) — тот же расчёт, что у оружия/психосил.
      const ext = await rollExtremeDamage(dmgRoll, { wp, damageType: sys.damageType, hitLocation: "Торс" });
      if (ext.exRoll) allRolls.push(ext.exRoll);
      const dt  = DAMAGE_TYPES[sys.damageType] || sys.damageType;
      const pen = sys.penetration || 0;
      const extStr = ext.hasExtreme ? `
          <div class="roll-extreme-block">
            <b>Экстремальный урон</b> · d5: ${ext.extremeLevel}
            ${ext.critEffect ? `<div class="roll-crit-effect">${ext.critEffect}</div>` : ""}
          </div>` : "";
      dmgSection = `
          <div class="roll-damage-section">
            <div class="roll-damage-label">Урон (${dt}, Проб. ${pen}): <b>${dmgRoll.total}</b></div>
            <button class="wh-apply-dmg-btn" type="button"
              data-damage="${dmgRoll.total}" data-penetration="${pen}"
              data-damage-type="${sys.damageType}" data-hit-location="Торс"
              data-weapon-name="${item.name}" data-attacker="${actor.name}"
              data-felling="${wp.fellingRating ?? 0}"
              data-primitive="${wp.primitive ? 1 : 0}"
              data-ignore-shield="${wp.ignoreShield ? 1 : 0}"
              data-warp-soak="${wp.warpSoak ? 1 : 0}"
              data-lance="${wp.lance ? 1 : 0}"
              data-sanctified="${wp.sanctified ? 1 : 0}">
              Применить урон: ${dmgRoll.total} → Торс
            </button>
          </div>${extStr}`;
    } catch(e) { ui.notifications.warn(`Не удалось бросить урон: ${sys.damage}`); console.error(e); }
  }

  // Свойства атаки: памятки + кнопки эффектов на цель — то же, что у оружия/психосил.
  let attackPropsSection = "";
  if (success && atkProps.length) {
    const propBlock  = buildPropertyChatBlock(atkProps);
    const effectBtns = buildTargetEffectButtons(atkProps, { hit: true, netDamageKnown: false });
    attackPropsSection = (propBlock || "") + (effectBtns || "");
  }

  const cogIco = techIcon("cognition");
  const enIco  = techIcon("energy");
  const costLine = [
    cogCost ? `${cogIco} Когниция −<b>${cogCost}</b>` : "",
    enCost  ? `${enIco} Энергия −<b>${enCost}</b>`    : "",
    (sys.sustained && sys.sustainCost) ? `Поддержание ${sys.sustainCost} ${cogIco}/Ход` : ""
  ].filter(Boolean).join(" | ");

  // Автоматизация «vs Инфограждение» (Numerica Curse/Delving, Scrapcode
  // Injection, Techsorcism Purge) и усиливающих чудес (Techsorcism Ward,
  // Vox Warding) — module/apps/infoguard.mjs.
  const infoguardSection = await infoguardInteractionSection(actor, item, { success });

  const rollMode = game.settings.get("core", "rollMode");
  const techDice = (await Promise.all(allRolls.map(r => r.render()))).join("");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("gear","#8fd0ff")}Техночудо: ${esc(item.name)}</div>
          <div class="roll-threshold">
            ${skillLabel}: <b>${base}</b>${testMod !== 0 ? ` ${testMod >= 0 ? "+" : ""}${testMod}` : ""}${fatigue !== 0 ? ` 😓 ${fatigue}` : ""} → Порог: <b>${eff}</b>
          </div>
          ${ironLine ? `<div class="roll-threshold" style="font-size:0.85em;">${ironLine}</div>` : ""}
          ${compLine ? `<div class="roll-threshold" style="font-size:0.85em;">${compLine}</div>` : ""}
          ${costLine ? `<div class="roll-threshold">${costLine}</div>` : ""}
          ${sys.range ? `<div class="roll-threshold" style="font-size:0.85em;">Дальность: <b>${sys.range}</b></div>` : ""}
          <div class="roll-dice">Бросок: <b>${rv}</b></div>
          <div class="roll-outcome">
            ${success
              ? `<span class="roll-success">Активировано — ${deg} ${_degWord(deg)}</span>`
              : `<span class="roll-failure">Сбой — ${deg} ${_degWord(deg)}</span>`}
          </div>
          ${dmgSection}
          ${psalmSection}
          ${attackPropsSection}
          ${infoguardSection}
          ${sys.effect ? `<div class="roll-threshold">${sys.effect}</div>` : ""}
          <details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${techDice}</details>
        </div>`,
    rolls: allRolls,
    sound: CONFIG.sounds.dice
  }, rollMode));
  // Automated Animations (если установлен и включён) — module/integrations/autoanimations.mjs.
  triggerAttackAnimation({ actor, item, hit: success });
}

// ── Генерация Когниции/Энергии от имплантов Кибернетики Механикум ──────────
export async function techGenResource(actor, item, { res, amount, fromCognition }) {
  if (!item) return;
  const QL   = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" };
  const q    = item.system.quality || "common";
  const sys  = actor.system;
  const cog  = sys.cognition || { value: 0, max: 0 };
  const en   = sys.energy    || { value: 0, max: 0, maxTotal: 0 };
  const enMax = en.maxTotal ?? en.max ?? 0;
  const src  = item.name.split("/")[0].trim();
  const upd  = {};
  let msg = "";

  if (fromCognition > 0) {
    // Конверсия ⚙→⚡ (Двигатель Холодного Синтеза). Цена по Качеству.
    const ratio  = (q === "poor" || q === "good") ? 4 : 3; // ⚙ за 1⚡
    const gained = Math.floor((cog.value || 0) / ratio);
    const room   = Math.max(0, enMax - (en.value || 0));
    const gain   = Math.min(gained, room);
    if (gain <= 0) {
      ui.notifications.warn(room <= 0 ? "Катушка Потенции уже заполнена." : `Недостаточно Когниции (нужно ${ratio}⚙ на 1⚡).`);
      return;
    }
    const spend = gain * ratio;
    upd["system.cognition.value"] = Math.max(0, (cog.value || 0) - spend);
    upd["system.energy.value"]    = Math.min(enMax, (en.value || 0) + gain);
    msg = `${src}: −${spend} ⚙ → +${gain} ⚡ (${ratio}⚙/1⚡, ${QL[q]})`;
  } else if (res === "energy") {
    const room = Math.max(0, enMax - (en.value || 0));
    const gain = Math.min(amount, room);
    if (gain <= 0) { ui.notifications.warn("Катушка Потенции уже заполнена."); return; }
    upd["system.energy.value"] = (en.value || 0) + gain;
    msg = `${src}: +${gain} ⚡`;
  } else {
    const gain = Math.min(amount, Math.max(0, (cog.max || 0) - (cog.value || 0)));
    if (gain <= 0) { ui.notifications.warn("Когниция уже на максимуме."); return; }
    upd["system.cognition.value"] = (cog.value || 0) + gain;
    msg = `${src}: +${gain} ⚙`;
  }
  await actor.update(upd);
  const pretty = msg.replace(/⚙/g, techIcon("cognition")).replace(/⚡/g, techIcon("energy"));
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result"><div class="roll-header">${techIcon("energy")} Энергосистема Механикум</div><div class="roll-threshold">${pretty}</div></div>`
  }, game.settings.get("core", "rollMode")));
}

export function rollTechScan(actor, rollSkill) {
  const def = SKILLS_DEF.techUse;
  const sk  = actor.system.skills?.techUse;
  return rollSkill("📡 Ноосферное Сканирование (Tech-Use)", sk?.total ?? -20, def?.char ?? "int", { skill: "techUse" });
}

export function activateTechListeners(html, actor, { rollSkill } = {}) {
  html.find(".tech-add-btn").click(async ev => {
    ev.preventDefault();
    const item = await Item.create({ name: "Новое Техночудо", type: "techPower" }, { parent: actor });
    item?.sheet?.render(true);
  });
  html.find(".tech-sustain-cb").change(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) { await item.update({ "system.sustained": ev.currentTarget.checked }); await syncItemEffectsDisabled(item); }
  });
  html.find(".tech-activate-btn").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) activateTechMiracle(actor, item);
  });
  html.find(".cognition-input").change(ev => {
    actor.update({ "system.cognition.value": parseInt(ev.currentTarget.value) || 0 });
  });
  html.find(".energy-input").change(ev => {
    actor.update({ "system.energy.value": parseInt(ev.currentTarget.value) || 0 });
  });
  html.find(".energy-max-input").change(ev => {
    actor.update({ "system.energy.max": parseInt(ev.currentTarget.value) || 0 });
  });
  html.find(".cognition-rest-btn").click(async ev => {
    ev.preventDefault();
    const cog = actor.system.cognition || { value: 0, max: 0, regen: 0 };
    const nv  = Math.min(cog.max || 0, (cog.value || 0) + (cog.regen || 0));
    await actor.update({ "system.cognition.value": nv });
  });
  html.find(".tech-scan-btn").click(() => {
    if (rollSkill) rollTechScan(actor, rollSkill);
  });
  html.find(".tech-infoguard-roll-btn").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) rollInfoguard(item);
  });
  // Кнопки генерации ⚙/⚡ от имплантов Кибернетики Механикум
  html.find(".tech-gen-btn").click(ev => {
    const d = ev.currentTarget.dataset;
    const item = actor.items.get(d.itemId);
    techGenResource(actor, item, {
      res: d.res, amount: parseInt(d.amount) || 0,
      fromCognition: parseInt(d.fromCog) || 0
    });
  });
  // Тумблеры энергосистем (Печь Плоти / Солнечный Конвертер)
  html.find(".tech-toggle-cb").change(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) await item.setFlag("warhammer-dbc", "techActive", ev.currentTarget.checked);
  });
}
