import { SKILL_RANKS }    from "../constants/characteristics.mjs";
import { MELEE_STANCES, BALANCE_PARRY_MOD } from "../constants/combat.mjs";
import { _degWord }       from "../helpers/utils.mjs";
import { resolveWeaponPropsList, aggregateAuto } from "./weapon-properties.mjs";
import { getModEffects, mergeWeaponPropEntries }  from "./weapon-mods.mjs";
import { rollIcon }       from "../constants/roll-icons.mjs";

export async function _performDodge(actor, extraMod = 0, attackDeg = null) {
  const agTotal    = actor.system.characteristics.ag?.total ?? 0;
  const dodgeSkill = actor.system.skills?.dodge;
  const rankBonus  = SKILL_RANKS[dodgeSkill?.rank ?? "untrained"]?.bonus ?? -20;
  const stance     = actor.system.meleeStance || "standard";
  const stBonus    = MELEE_STANCES[stance]?.dodgeBonus ?? 0;
  // Клонирующее Поле: голограммы срывают прицел — бонус носителю на физическое
  // избегание. Сила зависит от редкости поля (Poor.Q режет её вдвое).
  const cloneBonus = actor.system.cloneField?.bonus ?? 0;
  const threshold  = agTotal + rankBonus + stBonus + extraMod + cloneBonus;

  const roll     = await new Roll("1d100").evaluate();
  const rv       = roll.total;
  const passed   = rv <= threshold;
  const deg      = passed
    ? Math.floor((threshold - rv) / 10) + 1
    : Math.floor((rv - threshold) / 10) + 1;
  const rollMode = game.settings.get("core", "rollMode");

  // Встречная проверка: защита превосходит атаку только если степеней успеха
  // строго больше, чем у атакующего. Ничья и меньше — попадание проходит.
  const opposed  = Number.isFinite(attackDeg);
  const evaded   = passed && (!opposed || deg > attackDeg);

  const modParts = [];
  if (rankBonus !== -20) modParts.push(`навык ${rankBonus >= 0 ? "+" : ""}${rankBonus}`);
  if (stBonus   !== 0)   modParts.push(`стойка ${stBonus >= 0 ? "+" : ""}${stBonus}`);
  if (extraMod  !== 0)   modParts.push(`приём ${extraMod >= 0 ? "+" : ""}${extraMod}`);
  if (cloneBonus !== 0)  modParts.push(`клон-поле +${cloneBonus}`);

  const oppLine = opposed
    ? `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Встречная проверка — атака: <b>${attackDeg}</b> ${_degWord(attackDeg)}</div>`
    : "";
  let outcomeHtml;
  if (!passed) {
    outcomeHtml = `<span class="roll-failure">Уклонение провалено — ${deg} ${_degWord(deg)}. Получает попадание.</span>`;
  } else if (evaded) {
    outcomeHtml = `<span class="roll-success">Уклонение успешно — ${deg} ${_degWord(deg)}${opposed ? ` против ${attackDeg}` : ""}! Атака промахивается.</span>`;
  } else {
    outcomeHtml = `<span class="roll-failure">${rollIcon("warn","#ffb84d")}Уклонение удалось (${deg} ${_degWord(deg)}), но атака сильнее (${attackDeg}) — попадание проходит.</span>`;
  }

    const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("run")}Уклонение — ${actor.name}</div>
        <div class="roll-threshold">
          Ag: <b>${agTotal}</b>${modParts.length ? ` (${modParts.join(", ")})` : ""}
          → Порог: <b>${threshold}</b>
        </div>
        ${oppLine}
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${outcomeHtml}</div>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode);

  await ChatMessage.create(messageData);
}

export async function _performParry(actor, extraMod = 0, attackDeg = null) {
  const wsTotal    = actor.system.characteristics.ws?.total ?? 0;
  const parrySkill = actor.system.skills?.parry;
  const rankBonus  = SKILL_RANKS[parrySkill?.rank ?? "untrained"]?.bonus ?? -20;

  const meleeWeapon = actor.items.find(i =>
    i.type === "weapon" && i.system.equipped &&
    (i.system.weaponClass === "melee" || i.system.weaponClass === "thrown")
  );

  // Эффекты модификаций парирующего оружия (баланс, Защитное/Power Field и т.п.)
  const modFx      = getModEffects(actor, meleeWeapon);
  const balance    = parseInt(meleeWeapon?.system.balance ?? 0) + (modFx.balanceMod || 0);
  const balanceKey = String(balance);
  const balanceMod = BALANCE_PARRY_MOD[balanceKey];

  // Баланс −2 (или иное значение, помеченное null) — оружием нельзя парировать
  if (balanceMod === null) {
    const rollMode = game.settings.get("core", "rollMode");
    const messageData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("sword")}Парирование — ${actor.name}</div>
          ${meleeWeapon
            ? `<div style="font-size:0.82em;color:#5a4a30;margin-bottom:2px;">
                 Оружие: ${meleeWeapon.name} (Баланс ${balance >= 0 ? "+" : ""}${balance})
               </div>`
            : ""
          }
          <div class="roll-outcome">
            <span class="roll-failure">${rollIcon("ban","#ff6b6b")}Этим оружием нельзя парировать (Баланс ${balance >= 0 ? "+" : ""}${balance}).</span>
          </div>
        </div>`
    }, rollMode);

    await ChatMessage.create(messageData);
    return;
  }

  const stance    = actor.system.meleeStance || "standard";
  const stBonus   = MELEE_STANCES[stance]?.parryBonus ?? 0;

  // Свойства парирующего оружия (+ модификации): Защитное (+15), Силовое поле
  const parryProps = resolveWeaponPropsList(mergeWeaponPropEntries(meleeWeapon, modFx));
  const pwp         = aggregateAuto(parryProps);
  const defBonus    = pwp.defensive ? 15 : 0;

  const threshold = wsTotal + rankBonus + (balanceMod ?? 0) + stBonus + defBonus + extraMod;

  const roll     = await new Roll("1d100").evaluate();
  const rv       = roll.total;
  const passed   = rv <= threshold;
  const deg      = passed
    ? Math.floor((threshold - rv) / 10) + 1
    : Math.floor((rv - threshold) / 10) + 1;
  const rollMode = game.settings.get("core", "rollMode");

  // Встречная проверка: парирование отражает атаку только при строго большем
  // числе степеней успеха. Ничья и меньше — попадание проходит.
  const opposed  = Number.isFinite(attackDeg);
  const parried  = passed && (!opposed || deg > attackDeg);

  const modParts = [];
  if (rankBonus !== -20) modParts.push(`навык ${rankBonus >= 0 ? "+" : ""}${rankBonus}`);
  if (balanceMod !== 0)  modParts.push(`баланс ${balanceMod >= 0 ? "+" : ""}${balanceMod}`);
  if (stBonus !== 0)     modParts.push(`стойка ${stBonus >= 0 ? "+" : ""}${stBonus}`);
  if (defBonus !== 0)    modParts.push(`Защитное +${defBonus}`);
  if (extraMod !== 0)    modParts.push(`приём ${extraMod >= 0 ? "+" : ""}${extraMod}`);

  const oppLine = opposed
    ? `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Встречная проверка — атака: <b>${attackDeg}</b> ${_degWord(attackDeg)}</div>`
    : "";
  let outcomeHtml;
  if (!passed) {
    outcomeHtml = `<span class="roll-failure">Парирование провалено — ${deg} ${_degWord(deg)}. Получает попадание.</span>`;
  } else if (parried) {
    outcomeHtml = `<span class="roll-success">Парирование успешно — ${deg} ${_degWord(deg)}${opposed ? ` против ${attackDeg}` : ""}! Атака отражена.</span>`;
  } else {
    outcomeHtml = `<span class="roll-failure">${rollIcon("warn","#ffb84d")}Парирование удалось (${deg} ${_degWord(deg)}), но атака сильнее (${attackDeg}) — попадание проходит.</span>`;
  }

  // Силовое поле: при успешном парировании автоматически кидаем 1d100 —
  // на 1–75 оружие противника (без Power Field / Reinforced) уничтожено.
  const allRolls = [roll];
  let powerFieldNote = "";
  if (parried && pwp.powerField) {
    const pfRoll = await new Roll("1d100").evaluate();
    allRolls.push(pfRoll);
    const destroyed = pfRoll.total <= 75;
    powerFieldNote = `
      <div class="roll-defense-note">
        ${rollIcon("bolt","#6fe6ff")}Силовое поле — бросок: <b>${pfRoll.total}</b> →
        ${destroyed
          ? `<span class="roll-success">оружие противника <b>уничтожено</b> (если без Power Field / Reinforced)!</span>`
          : `<span class="roll-failure">оружие противника уцелело (76+).</span>`}
      </div>`;
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("sword")}Парирование — ${actor.name}</div>
        <div class="roll-threshold">
          WS: <b>${wsTotal}</b>${modParts.length ? ` (${modParts.join(", ")})` : ""}
          → Порог: <b>${threshold}</b>
        </div>
        ${oppLine}
        ${meleeWeapon
          ? `<div style="font-size:0.82em;color:#5a4a30;margin-bottom:2px;">
               Оружие: ${meleeWeapon.name} (Баланс ${balance >= 0 ? "+" : ""}${balance})
             </div>`
          : ""
        }
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${outcomeHtml}</div>
        ${powerFieldNote}
      </div>`,
    rolls: allRolls, sound: CONFIG.sounds.dice
  }, rollMode));
}