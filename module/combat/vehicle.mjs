// module/combat/vehicle.mjs
// Боевые автоматизации Техники: Вираж, Таран, Трудный Ландшафт и применение
// урона по Структуре (броня по стороне). Интеграция с чат-карточками — в том
// же стиле, что Уклонение/Парирование и Применение урона для персонажей.

import { _degWord, esc }        from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { ARMOUR_SIDES, TERRAIN_TABLE, TERRAIN_MANEUVER_MODS,
         getVehicleCrit, LOCATION_LABEL_TO_KEY,
         REPAIR_CONDITIONS, REPAIR_PACE } from "../constants/vehicle.mjs";
import { DAMAGE_TYPES }    from "../constants/items.mjs";

const sgn = (n) => `${n >= 0 ? "+" : ""}${n}`;

// ─── Вираж (реакция уклонения техникой) ───────────────────────────────────────
// Порог = Operate мехвода + swerveMod (−Размер×10, −10 для гусеничной) + extraMod.
// Встречная проверка против степеней успеха атаки, как обычное Уклонение.
export async function _performSwerve(actor, extraMod = 0, attackDeg = null) {
  if (actor.type !== "vehicle") {
    return ui.notifications.warn("⚠️ Вираж может совершать только Техника — выберите токен машины.");
  }
  const der       = actor.system.derived || {};
  if (der.swerveDisabled) {
    return ui.notifications.warn("⚠️ Эта машина не может совершать Вираж (Неподвижная / нет ходовой).");
  }
  const operate   = Number(actor.system.operate) || 0;
  const swerveMod = Number(der.swerveMod) || 0;
  const threshold = operate + swerveMod + extraMod;

  const roll   = await new Roll("1d100").evaluate();
  const rv     = roll.total;
  const passed = rv <= threshold;
  const deg    = passed
    ? Math.floor((threshold - rv) / 10) + 1
    : Math.floor((rv - threshold) / 10) + 1;

  const opposed = Number.isFinite(attackDeg);
  const evaded  = passed && (!opposed || deg > attackDeg);

  const modParts = [];
  modParts.push(`Размер ${sgn(-(Number(actor.system.size) || 0) * 10)}`);
  if (der.chassisType === "tracked") modParts.push("гусеничная −10");
  if (extraMod !== 0)                modParts.push(`мод ${sgn(extraMod)}`);

  const oppLine = opposed
    ? `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Встречная проверка — атака: <b>${attackDeg}</b> ${_degWord(attackDeg)}</div>`
    : "";
  let outcomeHtml;
  if (!passed) {
    outcomeHtml = `<span class="roll-failure">Вираж провален — ${deg} ${_degWord(deg)}. Попадание проходит.</span>`;
  } else if (evaded) {
    outcomeHtml = `<span class="roll-success">Вираж успешен — ${deg} ${_degWord(deg)}${opposed ? ` против ${attackDeg}` : ""}! Атака промахивается.</span>`;
  } else {
    outcomeHtml = `<span class="roll-failure">${rollIcon("warn","#ffb84d")}Вираж удался (${deg} ${_degWord(deg)}), но атака сильнее (${attackDeg}) — попадание проходит.</span>`;
  }

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("warp","#8fd0ff")}Вираж — ${esc(actor.name)}</div>
        <div class="roll-threshold">
          Operate: <b>${operate}</b> (${modParts.join(", ")}) → Порог: <b>${threshold}</b>
        </div>
        ${oppLine}
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${outcomeHtml}</div>
      </div>`,
    rolls: [roll], sound: CONFIG.sounds.dice
  }, rollMode));
}

// ─── Тест Трудного Ландшафта ──────────────────────────────────────────────────
// Operate+0 со штрафом ландшафта (+ мод манёвра). Провалы → непоглощаемый урон в
// Ходовую; 5+ Провалов или Крит.Провал → машина останавливается.
export async function showTerrainDialog(actor) {
  if (actor.type !== "vehicle") return;
  const operate = Number(actor.system.operate) || 0;
  const der     = actor.system.derived || {};
  if (der.traitFlags?.ignoreDifficultTerrain) {
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result"><div class="roll-header">${rollIcon("burst","#b0a080")}Трудный Ландшафт — ${esc(actor.name)}</div>
        <div class="roll-outcome"><span class="roll-success">Сверхтяжёлая — игнорирует Трудный Ландшафт, тест не требуется.</span></div></div>`
    });
  }

  const terrainOpts = TERRAIN_TABLE
    .map((t, i) => `<option value="${t.mod}">${t.mod} — ${t.label}</option>`).join("");
  const manOpts = TERRAIN_MANEUVER_MODS
    .map((m, i) => `<option value="${m.mod}"${m.mod === 0 ? " selected" : ""}>${m.label}</option>`).join("");

  new Dialog({
    title: "Трудный Ландшафт",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Operate мехвода:</label><input id="tr-op" type="number" value="${operate}"/></div>
        <div class="atk-dlg-row"><label>Ландшафт:</label><select id="tr-terrain">${terrainOpts}</select></div>
        <div class="atk-dlg-row"><label>Манёвр:</label><select id="tr-man">${manOpts}</select></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="tr-mod" type="number" value="0"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Провал → Провалы непоглощаемого урона в Ходовую. 5+ Провалов / Крит.Провал → остановка.
          Если суммарный штраф ≥ 0 — проезд безопасен без теста${der.walker ? " (Шагоход не замедляется)" : ""}.
        </div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест!",
        callback: async html => {
          const op  = parseInt(html.find("#tr-op").val()) || 0;
          const ter = parseInt(html.find("#tr-terrain").val()) || 0;
          const man = parseInt(html.find("#tr-man").val()) || 0;
          const md  = parseInt(html.find("#tr-mod").val()) || 0;
          await _resolveTerrain(actor, op, ter, man, md);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

async function _resolveTerrain(actor, operate, terrainMod, manMod, extraMod) {
  const totalMod  = terrainMod + manMod + extraMod;
  const threshold = operate + totalMod;

  if (totalMod >= 0) {
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${rollIcon("burst","#b0a080")}Трудный Ландшафт — ${esc(actor.name)}</div>
        <div class="roll-outcome"><span class="roll-success">Суммарный штраф ${sgn(totalMod)} ≥ 0 — проезд безопасен без теста.</span></div>
      </div>`
    });
  }

  const roll   = await new Roll("1d100").evaluate();
  const rv      = roll.total;
  const passed  = rv <= threshold;
  const critFail = rv >= 96;
  const deg     = passed
    ? Math.floor((threshold - rv) / 10) + 1
    : Math.floor((rv - threshold) / 10) + 1;
  const dop     = passed ? 0 : deg;                    // Провалы = степени провала
  const stopped = critFail || dop >= 5;

  let body;
  if (passed) {
    body = `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Ходовая не повреждена.</span></div>`;
  } else {
    body = `
      <div class="roll-outcome"><span class="roll-failure">Провал — ${dop} ${_degWord(dop)}${critFail ? " (Крит.Провал!)" : ""}.</span></div>
      <div class="roll-damage-section">
        <div class="roll-damage-label">${rollIcon("blood","#ff6b6b")}Непоглощаемый урон в Ходовую: <b>${dop}</b></div>
        <button class="wh-vehicle-track-dmg-btn" type="button" data-actor-id="${actor.id}" data-dmg="${dop}">
          Применить ${dop} урона в Ходовую (Структура)
        </button>
      </div>
      ${stopped ? `<div class="roll-allout-note">Машина останавливается, зайдя наполовину в область Трудного Ландшафта.</div>` : ""}`;
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("burst","#b0a080")}Трудный Ландшафт — ${esc(actor.name)}</div>
        <div class="roll-threshold">Operate <b>${operate}</b> ${sgn(totalMod)} (ландшафт ${sgn(terrainMod)}${manMod ? `, манёвр ${sgn(manMod)}` : ""}${extraMod ? `, мод ${sgn(extraMod)}` : ""}) → Порог <b>${threshold}</b></div>
        <div class="roll-dice">${rollIcon("dice","#6fe6ff")}1d100: <b>${rv}</b></div>
        ${body}
      </div>`,
    rolls: [roll], sound: CONFIG.sounds.dice
  }, game.settings.get("core", "rollMode")));
}

// ─── Таран ────────────────────────────────────────────────────────────────────
// Урон I(Cr) = Лобовая AP + 1d10 (+1d10 при движении ≥ 1,5 SPD). Уклонение цели
// +30, Вираж цели — встречный против Operate+0. Карточка даёт кнопки защиты и
// применения урона к выбранному токену-цели.
export async function showRamDialog(actor) {
  if (actor.type !== "vehicle") return;
  const frontAP = Number(actor.system.armour?.front) || 0;
  new Dialog({
    title: "Таран",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-header"><span class="atk-weapon-name">${esc(actor.name)}</span> <span style="opacity:.7">(Лоб. AP ${frontAP})</span></div>
        <div class="atk-dlg-row"><label>Прошла ≥ 1,5 SPD?</label>
          <select id="ram-fast"><option value="1">Да (+1d10)</option><option value="0">Нет</option></select>
        </div>
        <div class="atk-dlg-row"><label>Цель крупнее машины?</label>
          <select id="ram-big"><option value="0">Нет — цель ≤ машины</option><option value="1">Да — цель ≥ машины</option></select>
        </div>
        <div class="atk-range-info" style="font-size:0.82em;">
          I(Cr). Уклонение от Тарана +30. Вираж — встречный против Operate+0.
          Крупная цель бьёт машину в лоб (Поглощение цели +1d5/1d10).
        </div>
      </form>`,
    buttons: {
      ram: { icon: '<i class="fas fa-truck-monster"></i>', label: "Таранить!",
        callback: async html => {
          const fast = html.find("#ram-fast").val() === "1";
          const big  = html.find("#ram-big").val() === "1";
          await _resolveRam(actor, fast, big);
        } },
      cancel: { label: "Отмена" }
    },
    default: "ram"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

async function _resolveRam(actor, fast, targetBigger) {
  const frontAP = Number(actor.system.armour?.front) || 0;
  const roll    = await new Roll(fast ? "1d10 + 1d10" : "1d10").evaluate();
  const dmg     = frontAP + roll.total;

  const applyBtn = `
    <div class="roll-apply-dmg-section">
      <div class="roll-section-head">Применить к цели <span class="roll-head-hint">— выберите токен</span></div>
      <button class="wh-apply-dmg-btn" type="button"
        data-damage="${dmg}" data-penetration="0" data-damage-type="impact"
        data-hit-location="Торс" data-weapon-name="Таран" data-attacker="${actor.name}"
        data-felling="0" data-primitive="0" data-ignore-shield="0" data-warp-soak="0">
        Применить урон Тарана: <b>${dmg}</b>
      </button>
    </div>`;

  const defenseBtns = `
    <div class="roll-defense-section">
      <div class="roll-section-head">Защита цели <span class="roll-head-hint">— выберите токен защищающегося</span></div>
      <div class="roll-defense-btns">
        <button class="wh-dodge-btn" type="button" data-extra-mod="30">Уклонение (+30)</button>
        <button class="wh-swerve-btn" type="button" data-extra-mod="0">Вираж (встречный)</button>
      </div>
      <div class="roll-defense-note">Уклонение от Тарана +30; Вираж — встречной проверкой против Operate+0 таранящего.</div>
    </div>`;

  const bigNote = targetBigger
    ? `<div class="roll-allout-note">Цель ≥ машины: машина получает попадание в Лоб. броню = Поглощению цели от Тарана + 1d5${fast ? "/1d10" : ""}.</div>`
    : `<div class="roll-threshold" style="font-size:0.82em;">Цель ≤ машины: её отбрасывает на &lt;Урон до поглощения / 10 × (1 + Размер машины − Размер цели)&gt; м; меньшую на 1+ Размер — тест или сбита с ног.</div>`;

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("burst","#ff8a3a")}Таран — ${esc(actor.name)}</div>
        <div class="roll-threshold">Урон I(Cr): Лоб.AP <b>${frontAP}</b> + <b>${roll.total}</b>${fast ? " (1d10+1d10)" : " (1d10)"} = <b>${dmg}</b></div>
        <div class="roll-dice">${rollIcon("dice","#6fe6ff")}${fast ? "2×1d10" : "1d10"}: <b>${roll.total}</b></div>
        ${bigNote}
        ${defenseBtns}
        ${applyBtn}
      </div>`,
    rolls: [roll], sound: CONFIG.sounds.dice
  }, game.settings.get("core", "rollMode")));
}

// ─── Применение урона по Структуре ────────────────────────────────────────────
// Поглощение = эффективная AP выбранной стороны (без T.b). Непоглощённый урон
// идёт в Структуру; ниже 0 — Критические Эффекты (учёт отрицательной Структуры).
export async function applyDamageToVehicle(actor, damageData) {
  const {
    rawDamage, penetration = 0, damageType = "impact",
    side = "side",
    attackerName = "", weaponName = ""
  } = damageData;

  const tf = actor.system.derived?.traitFlags || {};
  // Неподвижная: попадания в Ходовую считаются как в Корпус.
  let vehicleLocation = damageData.vehicleLocation || "Корпус";
  if (tf.trackHitsToHull && vehicleLocation === "Ходовая") vehicleLocation = "Корпус";

  // Щит-дефлектор 1-X (Atomantic Shielding / Daemonic Possession): бросок до брони.
  const deflector = Number(actor.system.derived?.deflector) || 0;
  let deflectRoll = null, deflected = false;
  if (deflector > 0 && !damageData.ignoreDeflector) {
    const dr = await new Roll("1d100").evaluate();
    deflectRoll = dr.total;
    deflected = deflectRoll <= deflector;
  }

  const armour  = actor.system.armour || {};
  const ap      = Number(armour[side]) || 0;
  const effAP   = Math.max(0, ap - (Number(penetration) || 0));
  const net     = deflected ? 0 : Math.max(0, (Number(rawDamage) || 0) - effAP);

  const curVal  = Number(actor.system.structure?.value) || 0;
  const curCrit = Number(actor.system.structure?.critical) || 0;

  let newVal = curVal, newCrit = curCrit, gotCrit = false;
  if (net > 0) {
    if (curVal >= net) {
      newVal = curVal - net;
    } else {
      newCrit = curCrit + (net - curVal);
      newVal  = 0;
      gotCrit = true;
    }
    await actor.update({ "system.structure.value": newVal, "system.structure.critical": newCrit });
  }

  const dtLabel = DAMAGE_TYPES[damageType] || damageType;
  // Крит-эффект по глубине отрицательной Структуры и выбранной части машины.
  const critLine = gotCrit ? (() => {
    const locKey = LOCATION_LABEL_TO_KEY[vehicleLocation] || "hull";
    // Укреплённая Броня: отрицательная Структура для крита вдвое (окр.▲).
    const critLevel = tf.critHalved ? Math.ceil(newCrit / 2) : newCrit;
    const ce = getVehicleCrit(locKey, critLevel);
    const note = tf.critHalved ? ` <span style="opacity:.75;font-size:0.85em;">(Укреплённая: ${newCrit}→${critLevel})</span>` : "";
    return `
    <div class="dmg-critical-block">
      <b>Критический Эффект — ${ce.label} (${ce.level}${critLevel >= 10 ? "+" : ""})</b>${note}
      <div class="roll-crit-effect">${ce.text}</div>
    </div>`;
  })() : "";

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: { alias: "Система" },
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">Урон → ${esc(actor.name)}</div>
        <div class="roll-damage-meta">
          Источник: <b>${attackerName || "?"}</b>${weaponName ? ` (${weaponName})` : ""}
          · Часть: <b>${vehicleLocation}</b> · Сторона: <b>${ARMOUR_SIDES[side] || side}</b> · Тип: <b>${dtLabel}</b> · Урон: <b>${rawDamage}</b>
        </div>
        ${deflector > 0 ? `<div class="dmg-absorption-detail">
          ${tf.deflectorDaemonic ? "Колдовской" : "Технологический"} щит-дефлектор <b>1–${deflector}</b> · 1d100: <b>${deflectRoll}</b> →
          ${deflected ? `<span class="roll-success">ОТРАЖЕНО</span>` : `<span class="roll-failure">пробит</span>`}
          ${tf.deflectorDaemonic ? `<div class="dmg-tb-note">Атаки, игнорирующие Daemonic, игнорируют и этот щит.</div>` : ""}
        </div>` : ""}
        <div class="dmg-absorption-detail">
          AP ${ARMOUR_SIDES[side] || side}: <b>${ap}</b>${penetration > 0 ? ` − Проб. <b>${penetration}</b> = <b>${effAP}</b>` : ""} = Поглощение <b>${effAP}</b>
          <div class="dmg-tb-note">У техники нет T.b — поглощает только броня.</div>
        </div>
        <div class="roll-damage-section">
          <div class="roll-section-head">Итог</div>
          ${net > 0
            ? `<div class="roll-hit-line"><span class="roll-hit-idx">В Структуру</span><span class="roll-hit-dmg roll-hit-dmg-bad">${net}</span></div>
               <div class="roll-damage-meta">Структура: <b>${curVal}</b> → <b>${newVal}</b>${gotCrit ? ` (крит. ${newCrit})` : ""}</div>`
            : `<div class="roll-outcome"><span class="roll-success">Урон поглощён (${rawDamage} ≤ ${effAP})</span></div>`
          }
        </div>
        ${critLine}
      </div>`
  }, game.settings.get("core", "rollMode")));
}


// ─── Ремонт (восстановление Структуры / снятие поломок) ───────────────────────
// Тест ремонтного Навыка (значение вводится вручную) с модификаторами Условий и
// Темпа. За каждый Успех — восстановление Структуры на заданное «+за Успех».
// Можно снять выбранную активную поломку (state) при Успехе.
export async function showRepairDialog(actor) {
  if (actor.type !== "vehicle") return;
  const sys      = actor.system;
  const structMax = Number(sys.structure?.max) || 0;
  const structVal = Number(sys.structure?.value) || 0;
  const repairBonus = Number(sys.derived?.traitFlags?.repairBonus) || 0;

  const condOpts = REPAIR_CONDITIONS
    .map(c => `<option value="${c.mod}"${c.mod === 0 ? " selected" : ""}>${c.label}</option>`).join("");
  const paceOpts = REPAIR_PACE
    .map(p => `<option value="${p.mod}"${p.mod === 0 ? " selected" : ""}>${p.label}</option>`).join("");

  const states = Array.isArray(sys.damageStates) ? sys.damageStates : [];
  const stateOpts = states.length
    ? `<div class="atk-dlg-row"><label>Снять поломку при Успехе:</label>
         <select id="rp-state"><option value="">— не снимать —</option>
           ${states.map(s => `<option value="${s.id}">${s.label}</option>`).join("")}
         </select></div>`
    : "";

  new Dialog({
    title: `Ремонт — ${actor.name}`,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Навык ремонта (итог):</label><input id="rp-skill" type="number" value="30"/></div>
        <div class="atk-dlg-row"><label>Условия:</label><select id="rp-cond">${condOpts}</select></div>
        <div class="atk-dlg-row"><label>Темп:</label><select id="rp-pace">${paceOpts}</select></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="rp-mod" type="number" value="${repairBonus}"/></div>
        <div class="atk-dlg-row"><label>+Структуры за Успех:</label><input id="rp-per" type="number" value="2" min="0" title="Из описания поломки: Лёгкие +2, прочие +1"/></div>
        ${stateOpts}
        <div class="atk-range-info" style="font-size:0.82em;">
          Восстанавливает Структуру (макс. ${structMax}). За каждый Успех поверх первого время ремонта −5%.
          Доп. требования по Навыкам и Условия — на вкладке «Повреждения».
        </div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-wrench"></i>', label: "Ремонт!",
        callback: async html => {
          const skill = parseInt(html.find("#rp-skill").val()) || 0;
          const cond  = parseInt(html.find("#rp-cond").val()) || 0;
          const pace  = parseInt(html.find("#rp-pace").val()) || 0;
          const mod   = parseInt(html.find("#rp-mod").val()) || 0;
          const per   = Math.max(0, parseInt(html.find("#rp-per").val()) || 0);
          const stateId = html.find("#rp-state").val() || "";
          await _resolveRepair(actor, { skill, cond, pace, mod, per, stateId });
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 460 }).render(true);
}

async function _resolveRepair(actor, { skill, cond, pace, mod, per, stateId }) {
  const totalMod  = cond + pace + mod;
  const threshold = skill + totalMod;
  const roll      = await new Roll("1d100").evaluate();
  const rv        = roll.total;
  const passed    = rv <= threshold;
  const critFail  = rv >= 96;
  const deg       = passed
    ? Math.floor((threshold - rv) / 10) + 1
    : Math.floor((rv - threshold) / 10) + 1;

  const structMax = Number(actor.system.structure?.max) || 0;
  const curVal    = Number(actor.system.structure?.value) || 0;
  const curCrit   = Number(actor.system.structure?.critical) || 0;

  let body, gain = 0, clearedLabel = "";
  if (passed) {
    gain = per * deg;
    // Сначала гасим отрицательную Структуру (critical), затем поднимаем value до max.
    let g = gain, newCrit = curCrit, newVal = curVal;
    if (newCrit > 0) { const take = Math.min(newCrit, g); newCrit -= take; g -= take; }
    if (g > 0) newVal = Math.min(structMax, newVal + g);
    const upd = { "system.structure.value": newVal, "system.structure.critical": newCrit };

    // Снять выбранную поломку.
    if (stateId) {
      const states = Array.isArray(actor.system.damageStates) ? actor.system.damageStates : [];
      const st = states.find(s => s.id === stateId);
      if (st) { clearedLabel = st.label; upd["system.damageStates"] = states.filter(s => s.id !== stateId); }
    }
    await actor.update(upd);

    body = `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Восстановлено Структуры: <b>+${gain}</b>.</span></div>
      <div class="roll-damage-meta">Структура: <b>${curVal}${curCrit ? `/крит ${curCrit}` : ""}</b> → <b>${newVal}${newCrit ? `/крит ${newCrit}` : ""}</b>${structMax ? ` (макс. ${structMax})` : ""}</div>
      ${clearedLabel ? `<div class="roll-allout-note">Снята поломка: <b>${clearedLabel}</b>.</div>` : ""}`;
  } else {
    body = `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}${critFail ? " (Крит.Провал!)" : ""}. Структура не восстановлена.</span></div>
      ${critFail ? `<div class="roll-allout-note">Крит. Провал: ГМ может усугубить поломку или потратить материалы впустую.</div>` : ""}`;
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("dice","#6fe6ff")}Ремонт — ${esc(actor.name)}</div>
        <div class="roll-threshold">Навык <b>${skill}</b> ${sgn(totalMod)} (условия ${sgn(cond)}${pace ? `, темп ${sgn(pace)}` : ""}${mod ? `, мод ${sgn(mod)}` : ""}) → Порог <b>${threshold}</b></div>
        <div class="roll-dice">${rollIcon("dice","#6fe6ff")}1d100: <b>${rv}</b></div>
        ${body}
      </div>`,
    rolls: [roll], sound: CONFIG.sounds.dice
  }, game.settings.get("core", "rollMode")));
}
