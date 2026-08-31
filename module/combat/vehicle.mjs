// module/combat/vehicle.mjs
// Боевые автоматизации Техники: Вираж, Таран, Трудный Ландшафт и применение
// урона по Структуре (броня по стороне). Интеграция с чат-карточками — в том
// же стиле, что Уклонение/Парирование и Применение урона для персонажей.

import { _degWord, _hitWord, _leftoverSuccessPhrase, negatedHits, esc } from "../helpers/utils.mjs";
import { addEvasionSurplus } from "./evasion-pool.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { ARMOUR_SIDES, TERRAIN_TABLE, TERRAIN_MANEUVER_MODS,
         getVehicleCrit, LOCATION_LABEL_TO_KEY,
         REPAIR_CONDITIONS, REPAIR_PACE, VEHICLE_BREAKAGES } from "../constants/vehicle.mjs";
import { DAMAGE_TYPES }    from "../constants/items.mjs";
import { ablativeDamage }  from "../rules/mount.mjs";
import { isDreadnought, pilotUuidOf, pilotDamageThreshold }
  from "../rules/dreadnought.mjs";
import { applyWoundLoss, woundLossAfter } from "../rules/wounds.mjs";
import { resolveAttackerToken, tokenDistance } from "./facing.mjs";
import { apCostForActionType, canSpendActionPoints, spendActionPoints } from "./action-economy.mjs";

const sgn = (n) => `${n >= 0 ? "+" : ""}${n}`;

// ─── Вираж (реакция уклонения техникой) ───────────────────────────────────────
// Порог = Operate мехвода + swerveMod (−Размер×10, −10 для гусеничной) + extraMod.
// При Успехе попадание становится промахом — как обычное Уклонение (стр. книги
// про машины: «аналогично как с пешим Уклонением»), без сравнения степеней.
export async function _performSwerve(actor, extraMod = 0, hitsCount = 1, attackerUuid = "") {
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

  const { total: totalHits, negated, remaining } = negatedHits(passed, deg, hitsCount);
  // Излишек Успехов — банкуется на попадания ДРУГИХ атак того же противника
  // в этом Ходу (стр. 12, module/combat/evasion-pool.mjs). См. defense.mjs.
  const leftover = passed ? deg - negated : 0;
  const banked = leftover > 0 && await addEvasionSurplus(actor, attackerUuid, leftover, extraMod);

  const modParts = [];
  modParts.push(`Размер ${sgn(-(Number(actor.system.size) || 0) * 10)}`);
  if (der.chassisType === "tracked") modParts.push("гусеничная −10");
  if (extraMod !== 0)                modParts.push(`мод ${sgn(extraMod)}`);

  let outcomeHtml;
  if (!passed) {
    outcomeHtml = `<span class="roll-failure">Вираж провален — ${deg} ${_degWord(deg)}. ${
      totalHits > 1 ? `Все ${totalHits} ${_hitWord(totalHits)} проходят.` : "Попадание проходит."}</span>`;
  } else if (remaining === 0) {
    outcomeHtml = `<span class="roll-success">Вираж успешен — ${deg} ${_degWord(deg)}${
      totalHits > 1 ? `, снимает все ${totalHits} ${_hitWord(totalHits)}` : ""}! Атака промахивается.</span>`;
  } else {
    outcomeHtml = `<span class="roll-failure">${rollIcon("warn","#ffb84d")}Вираж успешен — ${deg} ${_degWord(deg)}, снимает ${negated} из ${totalHits} ${_hitWord(totalHits)}. ${remaining} ${_hitWord(remaining)} всё ещё проходит.</span>`;
  }
  const leftoverNote = banked
    ? `<div class="roll-defense-note">Остаётся ${leftover} ${_leftoverSuccessPhrase(leftover)} — можно потратить на попадания других атак этого противника в этом Ходу (2 Усп./попадание).</div>`
    : "";

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("warp","#8fd0ff")}Вираж — ${esc(actor.name)}</div>
        <div class="roll-threshold">
          Operate: <b>${operate}</b> (${modParts.join(", ")}) → Порог: <b>${threshold}</b>
        </div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${outcomeHtml}</div>
        ${leftoverNote}
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

  // Амфибия: не считает неглубокую воду Трудным Ландшафтом — GM отмечает
  // галочкой, что этот проезд именно по воде, и штраф ландшафта обнуляется.
  const amphibious = !!der.traitFlags?.amphibious;
  const amphRow = amphibious
    ? `<div class="atk-dlg-row"><label>Амфибия — по воде?</label><input id="tr-amph" type="checkbox"/></div>`
    : "";

  new Dialog({
    title: "Трудный Ландшафт",
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Operate мехвода:</label><input id="tr-op" type="number" value="${operate}"/></div>
        <div class="atk-dlg-row"><label>Ландшафт:</label><select id="tr-terrain">${terrainOpts}</select></div>
        <div class="atk-dlg-row"><label>Манёвр:</label><select id="tr-man">${manOpts}</select></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="tr-mod" type="number" value="0"/></div>
        ${amphRow}
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
          const amph = amphibious && html.find("#tr-amph").is(":checked");
          await _resolveTerrain(actor, op, ter, man, md, amph);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

async function _resolveTerrain(actor, operate, terrainMod, manMod, extraMod, amphibiousWater = false) {
  // Амфибия по воде: неглубокая вода не считается Трудным Ландшафтом вовсе.
  if (amphibiousWater) {
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result"><div class="roll-header">${rollIcon("burst","#b0a080")}Трудный Ландшафт — ${esc(actor.name)}</div>
        <div class="roll-outcome"><span class="roll-success">Амфибия — неглубокая вода не считается Трудным Ландшафтом, тест не требуется.</span></div></div>`
    });
  }
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

// ─── Пустотные Щиты: попадание принял щит, не броня (wdbc-y33b) ───────────────
async function _resolveVoidShieldHit(actor, shields, idx, damageData) {
  const { rawDamage, penetration = 0, damageType = "impact", attackerName = "", weaponName = "" } = damageData;
  const shieldAP    = Math.max(0, 30 - (Number(penetration) || 0));
  const dmgToShield = Math.max(0, (Number(rawDamage) || 0) - shieldAP);
  const curHP       = Number(shields[idx]) || 0;
  const newHP       = Math.max(0, curHP - dmgToShield);
  const collapsed   = newHP === 0 && curHP > 0;

  const newShields = [...shields];
  newShields[idx] = newHP;
  await actor.update({ "system.voidShields": newShields });

  const dtLabel = DAMAGE_TYPES[damageType] || damageType;
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: { alias: "Система" },
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("shield", "#6fe6ff")}Пустотный Щит — ${esc(actor.name)}</div>
        <div class="roll-damage-meta">
          Источник: <b>${attackerName || "?"}</b>${weaponName ? ` (${weaponName})` : ""}
          · Тип: <b>${dtLabel}</b> · Урон: <b>${rawDamage}</b> · Дистанция &gt;5м
        </div>
        <div class="dmg-absorption-detail">
          Щит №${idx + 1}: АР <b>${shieldAP}</b>${penetration > 0 ? ` (30 − Проб. ${penetration})` : ""} → урон щиту <b>${dmgToShield}</b>
        </div>
        <div class="roll-damage-section">
          <div class="roll-outcome"><span class="roll-success">Структура машины не затронута — щит принял удар целиком${
            collapsed ? ", лишний урон потерян" : ""}.</span></div>
          <div class="roll-damage-meta">Структура щита: <b>${curHP}</b> → <b>${newHP}</b>${collapsed ? " (щит схлопнулся)" : ""}</div>
        </div>
      </div>`
  }, game.settings.get("core", "rollMode")));
}

// ─── Применение урона по Структуре ────────────────────────────────────────────
// Поглощение = эффективная AP выбранной стороны (без T.b). Непоглощённый урон
// идёт в Структуру; ниже 0 — Критические Эффекты (учёт отрицательной Структуры).
export async function applyDamageToVehicle(actor, damageData) {
  const {
    rawDamage, penetration = 0, damageType = "impact",
    side = "side", flame = false, sanctified = false, warpSoak = false,
    attackerName = "", weaponName = ""
  } = damageData;

  const tf = actor.system.derived?.traitFlags || {};
  // Неподвижная: попадания в Ходовую считаются как в Корпус.
  let vehicleLocation = damageData.vehicleLocation || "Корпус";
  if (tf.trackHitsToHull && vehicleLocation === "Ходовая") vehicleLocation = "Корпус";

  // ── Пустотные Щиты (X) (wdbc-y33b) ────────────────────────────────────────
  // Останавливают ВСЮ стрельбу с расстояния >5м (не рукопашную). Пока держит
  // хоть один щит, Структура машины в этот раз не трогается вовсе — щит либо
  // выдерживает, либо схлопывается, но «лишний» урон при схлопывании теряется,
  // на броню/Структуру не переходит (проверено по тексту: "лишний урон... теряется").
  const shields   = Array.isArray(actor.system.voidShields) ? actor.system.voidShields : [];
  const shieldIdx = shields.findIndex(hp => Number(hp) > 0);
  if (shieldIdx !== -1 && !damageData.melee && !damageData.ignoreVoidShields) {
    const vehicleToken  = actor.getActiveTokens?.(true, true)?.[0] ?? null;
    const attackerToken = await resolveAttackerToken(damageData.attackerUuid);
    const dist = (vehicleToken && attackerToken) ? tokenDistance(vehicleToken, attackerToken) : null;
    // Позиция неизвестна — щит по умолчанию защищает (тот же принцип, что у
    // isFrontArcHit: отсутствие геометрии не должно наказывать защищающегося).
    if (dist == null || dist > 5) {
      return _resolveVoidShieldHit(actor, shields, shieldIdx, damageData);
    }
  }

  // Щит-дефлектор 1-X (Atomantic Shielding / Daemonic Possession): бросок до брони.
  const deflector = Number(actor.system.derived?.deflector) || 0;
  let deflectRoll = null, deflected = false;
  if (deflector > 0 && !damageData.ignoreDeflector) {
    const dr = await new Roll("1d100").evaluate();
    deflectRoll = dr.total;
    deflected = deflectRoll <= deflector;
  }

  const armour  = actor.system.armour || {};
  // Керамитовая Броня: АР удваивается против урона со свойством Flame.
  const apBase   = Number(armour[side]) || 0;
  const apCeramite = (tf.ceramitePlating && flame) ? apBase * 2 : apBase;
  // Демонический (X): +X к поглощению, но "против них Трейт не работает
  // вовсе" — Sanctified/Warp Weapon (Force не доезжает отдельным флагом до
  // этого конвейера, приближение по двум из трёх свойств, задокументировано).
  const daemonicVulnerable = sanctified || warpSoak;
  const ap = (tf.daemonicAbsorb && !daemonicVulnerable) ? apCeramite + tf.daemonicAbsorb : apCeramite;
  const effAP   = Math.max(0, ap - (Number(penetration) || 0));
  const rawNet  = deflected ? 0 : Math.max(0, (Number(rawDamage) || 0) - effAP);
  // Аблативное Бронирование байка (стр. 478): пока Структура полна, любой
  // непоглощённый урон срезается до 1. У большой техники этой Черты нет, и
  // расчёт для неё не меняется.
  const net     = ablativeDamage(rawNet, actor);
  const ablated = net !== rawNet;

  const curVal  = Number(actor.system.structure?.value) || 0;
  const curCrit = Number(actor.system.structure?.critical) || 0;

  // Та же арифметика, что у Ран (rules/wounds.mjs): остаток сверх запаса
  // Структуры уходит в Критические.
  const { value: newVal, critical: newCrit, overflow: gotCrit } =
    woundLossAfter(curVal, curCrit, net);
  if (net > 0) {
    await actor.update({ "system.structure.value": newVal, "system.structure.critical": newCrit });
  }

  // ── Пилот Дредноута (Книга Машин, стр. 57) ───────────────────────────────
  // Толчок от удара по машине достаёт и того, кто в саркофаге: при ≥½W.b
  // пилота (окр.▲) непоглощённого урона по машине пилот получает ровно тот
  // же урон в свои Раны — без брони и T.b, саркофаг лишь передаёт удар, а не
  // принимает отдельное попадание (rules/dreadnought.mjs).
  let pilotLine = "";
  if (net > 0 && isDreadnought(actor)) {
    const pilotUuid = pilotUuidOf(actor);
    const pilot = pilotUuid ? await fromUuid(pilotUuid).catch(() => null) : null;
    if (pilot) {
      const wb = pilot.system?.characteristics?.wp?.bonus ?? 0;
      const threshold = pilotDamageThreshold(wb);
      if (net >= threshold) {
        const { currentWounds, newWounds, newCritical, gotCritical } = await applyWoundLoss(pilot, net);
        pilotLine = `
    <div class="dmg-critical-block">
      <b>Резонанс саркофага — ${esc(pilot.name)}</b>
      <div class="dmg-tb-note">Урон по машине ≥ ½W.b пилота (${threshold}) — пилот тоже ранен.</div>
      <div class="roll-damage-meta">Раны пилота: <b>${currentWounds}</b> → <b>${newWounds}</b>${gotCritical ? ` (крит. ${newCritical})` : ""}</div>
    </div>`;
      }
    }
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
               <div class="roll-damage-meta">Структура: <b>${curVal}</b> → <b>${newVal}</b>${gotCrit ? ` (крит. ${newCrit})` : ""}${
                 ablated ? ` · <span class="dmg-tb-note">Аблативное Бронирование: ${rawNet} → 1</span>` : ""}</div>`
            : `<div class="roll-outcome"><span class="roll-success">Урон поглощён (${rawDamage} ≤ ${effAP})</span></div>`
          }
        </div>
        ${critLine}
        ${pilotLine}
      </div>`
  }, game.settings.get("core", "rollMode")));
}

/**
 * Непоглощаемый урон в Структуру напрямую, мимо брони и без теста (Bane
 * Технике — «Техника при попадании автоматически получает X урона», без
 * условия пробития). Та же арифметика overflow→Критические, что у Ран
 * (rules/wounds.mjs::woundLossAfter), только пишет в system.structure —
 * applyWoundLoss пишет в system.wounds и для Техники не подходит.
 */
export async function applyStructureLoss(actor, amount) {
  const curVal  = Number(actor.system.structure?.value)    || 0;
  const curCrit = Number(actor.system.structure?.critical) || 0;
  const { value: newVal, critical: newCrit, overflow: gotCritical } =
    woundLossAfter(curVal, curCrit, amount);
  if ((Number(amount) || 0) > 0) {
    await actor.update({ "system.structure.value": newVal, "system.structure.critical": newCrit });
  }
  return { currentValue: curVal, currentCritical: curCrit, newValue: newVal, newCritical: newCrit, gotCritical };
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

// ─── Ремонт Пустотного Щита (wdbc-y33b) ────────────────────────────────────────
// Механикус на генераториуме: щит ещё не схлопнувшийся — Tech-Use+20 полудействием,
// схлопнувшийся — Tech-Use−10 полным действием. Оба варианта: +2 Структуры за
// каждый Успех, до максимума 20.
const VOID_SHIELD_REPAIR = {
  active:    { mod: 20, action: "полудействие", label: "ещё не схлопнувшийся" },
  collapsed: { mod: -10, action: "полное действие", label: "схлопнувшийся" }
};

export async function showVoidShieldRepairDialog(actor) {
  if (actor.type !== "vehicle") return;
  const shields = Array.isArray(actor.system.voidShields) ? actor.system.voidShields : [];
  if (!shields.length) {
    return ui.notifications.warn("⚠️ У этой машины нет Пустотных Щитов.");
  }

  const shieldOpts = shields.map((hp, i) => {
    const state = Number(hp) > 0 ? "active" : "collapsed";
    return `<option value="${i}">Щит №${i + 1} — ${Number(hp) || 0}/20 (${VOID_SHIELD_REPAIR[state].label})</option>`;
  }).join("");

  new Dialog({
    title: `Ремонт Пустотного Щита — ${actor.name}`,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Щит:</label><select id="vsr-shield">${shieldOpts}</select></div>
        <div class="atk-dlg-row"><label>Tech-Use (итог):</label><input id="vsr-skill" type="number" value="40"/></div>
        <div class="atk-dlg-row"><label>Доп. мод:</label><input id="vsr-mod" type="number" value="0"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">
          Ещё не схлопнувшийся щит: Tech-Use+20, полудействие, +2 Структуры щита за Успех.<br>
          Схлопнувшийся щит: Tech-Use−10, полное действие, +2 Структуры щита за Успех.
        </div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Тест!",
        callback: async html => {
          const idx   = parseInt(html.find("#vsr-shield").val()) || 0;
          const skill = parseInt(html.find("#vsr-skill").val()) || 0;
          const mod   = parseInt(html.find("#vsr-mod").val()) || 0;
          await _resolveVoidShieldRepair(actor, shields, idx, skill, mod);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 440 }).render(true);
}

async function _resolveVoidShieldRepair(actor, shields, idx, skill, extraMod) {
  const curHP = Number(shields[idx]) || 0;
  const state = curHP > 0 ? "active" : "collapsed";
  const cfg   = VOID_SHIELD_REPAIR[state];
  const totalMod  = cfg.mod + extraMod;
  const threshold = skill + totalMod;

  const roll   = await new Roll("1d100").evaluate();
  const rv     = roll.total;
  const passed = rv <= threshold;
  const deg    = passed
    ? Math.floor((threshold - rv) / 10) + 1
    : Math.floor((rv - threshold) / 10) + 1;

  let body, gain = 0, newHP = curHP;
  if (passed) {
    gain = deg * 2;
    newHP = Math.min(20, curHP + gain);
    const newShields = [...shields];
    newShields[idx] = newHP;
    await actor.update({ "system.voidShields": newShields });
    body = `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}. Восстановлено: <b>+${gain}</b>.</span></div>
      <div class="roll-damage-meta">Щит №${idx + 1}: <b>${curHP}</b> → <b>${newHP}</b> / 20</div>`;
  } else {
    body = `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Щит не восстановлен.</span></div>`;
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("shield", "#6fe6ff")}Ремонт Щита №${idx + 1} — ${esc(actor.name)}</div>
        <div class="roll-threshold">Tech-Use <b>${skill}</b> ${sgn(totalMod)} (${cfg.label}, ${cfg.action}) → Порог <b>${threshold}</b></div>
        <div class="roll-dice">${rollIcon("dice", "#6fe6ff")}1d100: <b>${rv}</b></div>
        ${body}
      </div>`,
    rolls: [roll], sound: CONFIG.sounds.dice
  }, game.settings.get("core", "rollMode")));
}

// ─── Орбитальная высадка (wdbc-y33b) ────────────────────────────────────────
// Сценарий на 2 Хода — здесь только чат-карточки с числами/текстом, канвас
// (высота токена, реальное смещение позиции) система нигде не двигает сама,
// как и в остальных диалогах техники (Таран/Ландшафт) — решает ГМ руками.
export async function showOrbitalDeployTurn1(actor) {
  if (actor.type !== "vehicle") return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("burst", "#8fd0ff")}Орбитальная высадка — Ход 1 — ${esc(actor.name)}</div>
        <div class="roll-outcome"><span class="roll-success">Влетает на Высокую высоту.</span></div>
        <div class="roll-allout-note">Все атаки по машине в этот Ход получают −30.</div>
      </div>`
  });
}

// Направление смещения — 1d8 по компасу: книга не называет конкретный способ
// розыгрыша направления ("в случайном направлении"), 8 румбов — практическое
// решение, задокументировано явно, не подано как книжное правило.
const COMPASS_8 = ["север", "северо-восток", "восток", "юго-восток", "юг", "юго-запад", "запад", "северо-запад"];

export async function showOrbitalDeployTurn2(actor) {
  if (actor.type !== "vehicle") return;
  const scatter = await new Roll("2d10").evaluate();
  const dirRoll = await new Roll("1d8").evaluate();
  const dir = COMPASS_8[dirRoll.total - 1];

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("burst", "#ff8a3a")}Орбитальная высадка — Ход 2 (Приземление) — ${esc(actor.name)}</div>
        <div class="roll-threshold">Смещение: <b>${scatter.total}</b> м на <b>${dir}</b> от точки посадки</div>
        <div class="roll-dice">${rollIcon("dice", "#6fe6ff")}2d10: <b>${scatter.total}</b> · 1d8 (направление): <b>${dirRoll.total}</b></div>
        <div class="roll-allout-note">
          Если наводчик/маяк не подсвечивал точку — сдвинуть место посадки на это расстояние в этом направлении.
          При посадке на занятое токеном место — считается Тараном на скорости &gt;1,5 SPD (кнопка «Таран»).
          Атаки из машины в этот Раунд получают −20.
        </div>
      </div>`,
    rolls: [scatter, dirRoll], sound: CONFIG.sounds.dice
  }, game.settings.get("core", "rollMode")));
}

// ─── Пожар: тест внутренней детонации (wdbc-y33b) ───────────────────────────
// «Ходов Пожара» нигде не считается автоматически — в системе нет тика по
// Раундам для состояний машины (проверено: нет ни одной функции с "Пожар"/
// "Крушение" в имени до этого тикета) — ГМ вводит вручную.
export async function showFireDetonationDialog(actor) {
  if (actor.type !== "vehicle") return;
  const tf = actor.system.derived?.traitFlags || {};
  const threshold = tf.volatile ? 6 : 10;

  new Dialog({
    title: `Пожар: тест детонации — ${actor.name}`,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Прошло Ходов Пожара:</label><input id="fd-turns" type="number" value="0" min="0"/></div>
        <div class="atk-range-info" style="font-size:0.82em;">
          1d10 + Ходов Пожара ≥ ${threshold} — детонация (8 непоглощаемого урона машине).
          ${tf.volatile ? "Взрывоопасная: порог снижен с 10+ до 6+." : ""}
        </div>
      </form>`,
    buttons: {
      roll: { icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок!",
        callback: async html => {
          const turns = Math.max(0, parseInt(html.find("#fd-turns").val()) || 0);
          await _resolveFireDetonation(actor, turns, threshold, tf.volatile);
        } },
      cancel: { label: "Отмена" }
    },
    default: "roll"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 400 }).render(true);
}

async function _resolveFireDetonation(actor, turns, threshold, volatile) {
  const roll  = await new Roll("1d10").evaluate();
  const total = roll.total + turns;
  const detonated = total >= threshold;

  let body;
  if (detonated) {
    const curVal  = Number(actor.system.structure?.value) || 0;
    const curCrit = Number(actor.system.structure?.critical) || 0;
    const { value: newVal, critical: newCrit, overflow: gotCrit } = woundLossAfter(curVal, curCrit, 8);
    await actor.update({ "system.structure.value": newVal, "system.structure.critical": newCrit });
    body = `<div class="roll-outcome"><span class="roll-failure">Детонация! 8 непоглощаемого урона машине.</span></div>
      <div class="roll-damage-meta">Структура: <b>${curVal}</b> → <b>${newVal}</b>${gotCrit ? ` (крит. ${newCrit})` : ""}</div>
      ${volatile ? `<div class="roll-allout-note">Взрывоопасная: все, кого задел взрыв, проходят тест A−10 или Загораются; выживший экипаж Горит автоматически.</div>` : ""}`;
  } else {
    body = `<div class="roll-outcome"><span class="roll-success">Без детонации.</span></div>`;
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("burst", "#ff6b6b")}Пожар: тест детонации — ${esc(actor.name)}</div>
        <div class="roll-threshold">1d10 + Ходов Пожара (${turns}) ≥ ${threshold}</div>
        <div class="roll-dice">${rollIcon("dice", "#6fe6ff")}1d10: <b>${roll.total}</b> + ${turns} = <b>${total}</b></div>
        ${body}
      </div>`,
    rolls: [roll], sound: CONFIG.sounds.dice
  }, game.settings.get("core", "rollMode")));
}

// ─── Тормоза Падения (wdbc-y33b) ────────────────────────────────────────────
// Не полноценный резолвер Крушения (в системе оно остаётся текстом-справкой,
// VEHICLE_STATUS_EFFECTS — ГМ разыгрывает исход сам) — только переключатель
// тяжести конкретно для этой Черты + гарантированная поломка + лимит «не чаще
// раза за бой/сцену» (персистентный флаг, сбрасывается вручную ГМом, тот же
// компромисс, что у system.mount.skidUsed).
export async function showFallBreaksDialog(actor) {
  if (actor.type !== "vehicle") return;
  const tf = actor.system.derived?.traitFlags || {};
  if (!tf.fallBreaks) {
    return ui.notifications.warn("⚠️ У этой машины нет Черты Тормоза Падения.");
  }
  if (actor.system.fallBreaksUsed) {
    return ui.notifications.warn("⚠️ Тормоза Падения уже использованы в этом бою/сцене (длительная перезарядка).");
  }

  const confirmed = await Dialog.confirm({
    title: `Тормоза Падения — ${actor.name}`,
    content: `<p>Крушение с Низкой высоты считается Крушением с Приземной высоты.
      Сразу после посадки — гарантированная поломка «Ходовая Часть Повреждена».
      Использовать нельзя чаще раза за бой/сцену.</p>`
  });
  if (!confirmed) return;

  const states = foundry.utils.deepClone(actor.system.damageStates || []);
  const breakage = VEHICLE_BREAKAGES.find(b => b.name === "Ходовая Часть Повреждена");
  states.push({
    id: foundry.utils.randomID(), kind: "breakage",
    label: breakage?.name || "Ходовая Часть Повреждена", note: breakage?.text || ""
  });
  await actor.update({ "system.damageStates": states, "system.fallBreaksUsed": true });

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("burst", "#b0a080")}Тормоза Падения — ${esc(actor.name)}</div>
        <div class="roll-outcome"><span class="roll-success">Крушение с Низкой высоты → с Приземной высоты.</span></div>
        <div class="roll-allout-note">Поломка «Ходовая Часть Повреждена» добавлена. Тормоза израсходованы до конца боя/сцены.</div>
      </div>`
  });
}

// ─── Выгрузка пассажиров (wdbc-y33b) ────────────────────────────────────────
// Обычная Выгрузка (стр. книги про Действия Экипажа, CREW_ACTIONS в
// constants/vehicle.mjs) — полудействие БЕЗ движения. Боковые Двери меняют её
// на полное действие + Бег; Штурмовая Рампа — на полное действие + Бег ИЛИ
// Натиск. Открытая(X) даёт то же самое, но её рейтинг (0/½/1/E — степень
// открытости для укрытия экипажа) сейчас читается только как булев флаг, не
// как отдельный вход в этот же бонус — не расширял заодно, вне охвата
// конкретно этих 2 Черт.
export async function showDisembarkDialog(actor) {
  if (actor.type !== "vehicle") return;
  const stations = Array.isArray(actor.system.stations) ? actor.system.stations : [];
  const passengers = stations.filter(s => s.role === "passenger" && s.uuid);
  if (!passengers.length) {
    return ui.notifications.warn("⚠️ На местах пассажиров сейчас никого нет.");
  }

  const tf = actor.system.derived?.traitFlags || {};
  const bonus = tf.assaultRamp ? "assaultRamp" : tf.sideHatches ? "sideHatches" : "none";

  const passengerOpts = passengers.map(s => `<option value="${s.id}">${esc(s.name || "?")}</option>`).join("");
  const modeRow = bonus === "assaultRamp"
    ? `<div class="atk-dlg-row"><label>Бонусное движение:</label>
        <select id="dis-mode"><option value="run">Бег</option><option value="charge">Натиск</option></select></div>`
    : "";
  const noteText = bonus === "assaultRamp"
    ? "Штурмовая Рампа: полное действие — Выгрузка + Бег или Натиск из рампы."
    : bonus === "sideHatches"
      ? "Боковые Двери: полное действие — Выгрузка + Бег."
      : "Обычная Выгрузка: полудействие, без движения (нет подходящей Черты).";

  new Dialog({
    title: `Выгрузка — ${actor.name}`,
    content: `
      <form class="wh-vehicle-dialog" style="padding:6px;">
        <div class="atk-dlg-row"><label>Пассажир:</label><select id="dis-station">${passengerOpts}</select></div>
        ${modeRow}
        <div class="atk-range-info" style="font-size:0.82em;">${noteText}</div>
      </form>`,
    buttons: {
      go: { icon: '<i class="fas fa-person-running"></i>', label: "Выгрузить",
        callback: async html => {
          const stationId = html.find("#dis-station").val();
          const mode = html.find("#dis-mode").val() || "run";
          await _resolveDisembark(actor, stations, stationId, bonus, mode);
        } },
      cancel: { label: "Отмена" }
    },
    default: "go"
  }, { classes: ["dialog", "wh-attack-dialog"], width: 420 }).render(true);
}

async function _resolveDisembark(actor, stations, stationId, bonus, mode) {
  const st = stations.find(s => s.id === stationId);
  if (!st) return;
  const name = st.name || "Пассажир";
  const newStations = stations.map(s => s.id === stationId ? { ...s, uuid: "", name: "", img: "" } : s);
  await actor.update({ "system.stations": newStations });

  const actionLine = bonus === "assaultRamp"
    ? `Полное действие: Выгрузка + ${mode === "charge" ? "Натиск" : "Бег"} из рампы.`
    : bonus === "sideHatches"
      ? "Полное действие: Выгрузка + Бег."
      : "Полудействие: Выгрузка без движения.";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("run", "#8fd0ff")}Выгрузка — ${esc(name)}</div>
        <div class="roll-outcome"><span class="roll-success">${esc(name)} выгружается из ${esc(actor.name)}.</span></div>
        <div class="roll-allout-note">${actionLine}</div>
      </div>`
  });
}

// ─── Залп: Мультиприцел / Продвинутые Прицельные Системы (wdbc-y33b) ───────
// У ТЕХНИКИ нет экономики действий (action-economy.mjs — "vehicle" не входит
// в ACTION_ECONOMY_ACTOR_TYPES), а вот у ПЕРСОНАЖА-оператора станции она есть
// и работает. Автоматизация "одним действием" из текста Черты — списать у
// оператора ОДНО полное действие (2 ОД) на всю станцию разом, а не по
// действию за орудие; сами выстрелы остаются обычным _showVehicleFireDialog
// по каждому орудию (не дублируется здесь).
export async function resolveVolleyAction(actor, stationId) {
  const stations = Array.isArray(actor.system.stations) ? actor.system.stations : [];
  const station = stations.find(s => s.id === stationId);
  if (!station?.uuid) {
    return { ok: false, error: "На этой станции сейчас никто не сидит." };
  }
  const occupant = await fromUuid(station.uuid).catch(() => null);
  if (!occupant) {
    return { ok: false, error: "Оператор станции не найден (возможно, удалён)." };
  }
  const cost = apCostForActionType("Полное действие");
  if (!canSpendActionPoints(occupant, cost)) {
    return { ok: false, error: `У ${occupant.name} не хватает ОД на полное действие Залпа.` };
  }
  await spendActionPoints(occupant, cost);
  return { ok: true, occupant };
}
