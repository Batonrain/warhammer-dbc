import { SKILL_RANKS }    from "../constants/characteristics.mjs";
import { MELEE_STANCES, BALANCE_PARRY_MOD } from "../constants/combat.mjs";
import { _degWord, _hitWord, _leftoverSuccessPhrase, negatedHits, esc } from "../helpers/utils.mjs";
import { resolveWeaponPropsList, aggregateAuto } from "./weapon-properties.mjs";
import { getModEffects, mergeWeaponPropEntries }  from "./weapon-mods.mjs";
import { rollIcon }       from "../constants/roll-icons.mjs";
import { pickReroll }     from "../rules/reroll-pick.mjs";
import { fatiguePenalty } from "../sheets/tabs/conditions.mjs";
import { disabledArmourPenalty } from "./armor-mods.mjs";
import { inventoryOverloadPenalty } from "../rules/encumbrance.mjs";
import { hasRuleFlag }    from "../rules/flags.mjs";
import { isRoundCapabilityAvailable } from "../apps/game-session.mjs";
import { equippedMeleeWeapon } from "./equipped-melee.mjs";
import { withWitchsEdge } from "./witchs-edge.mjs";
import { spendReaction }  from "./action-economy.mjs";
import { addEvasionSurplus } from "./evasion-pool.mjs";

// Контратака (стр. 12, Талант Counter Attack) — «раз в Раунд» ключ учёта,
// тот же примитив, что у Локуса Сокрушения (constants/capabilities.mjs).
export const COUNTER_ATTACK_CAPABILITY = "technique.counterAttack";

// Уклонение/Парирование — Реакция (стр. 12): вне активного Encounter
// spendReaction ничего не считает и всегда отдаёт true, поэтому вне боя
// кнопки продолжают работать как раньше, без ограничений.
export async function _noReactionCard(actor, label) {
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("sword")}${label} — ${esc(actor.name)}</div>
        <div class="roll-outcome">
          <span class="roll-failure">${rollIcon("ban","#ff6b6b")}Нет доступных Реакций в этом Ходу.</span>
        </div>
      </div>`
  }, rollMode));
}

export async function _performDodge(actor, extraMod = 0, forcedReroll = "", hitsCount = 1, attackerUuid = "") {
  if (!(await spendReaction(actor, { forDefense: true }))) return _noReactionCard(actor, "Уклонение");
  const agTotal    = actor.system.characteristics.ag?.total ?? 0;
  const dodgeSkill = actor.system.skills?.dodge;
  const rankBonus  = SKILL_RANKS[dodgeSkill?.rank ?? "untrained"]?.bonus ?? -20;
  const stance     = actor.system.meleeStance || "standard";
  const stBonus    = MELEE_STANCES[stance]?.dodgeBonus ?? 0;
  // Клонирующее Поле: голограммы срывают прицел — бонус носителю на физическое
  // избегание. Сила зависит от редкости поля (Poor.Q режет её вдвое).
  const cloneBonus = actor.system.cloneField?.bonus ?? 0;
  // Эта кнопка (карточка атаки в чате) раньше не учитывала ни Усталость, ни
  // выключенную силовую броню (стр. 233, −40 на физическую РЕАКЦИЮ) — путь
  // отдельный от вкладки Навыков (_rollSkill), которая их уже учитывала.
  const fatigue       = fatiguePenalty(actor, "ag");
  const armourPenalty = disabledArmourPenalty(actor, { skillKey: "dodge" });
  // Перевес инвентаря (стр. 27, wdbc-2l3x) — независимый от брони источник,
  // может действовать одновременно с ней (не смешиваются, оба вычитаются).
  const overloadPenalty = inventoryOverloadPenalty(actor, { skillKey: "dodge" });
  const threshold  = agTotal + rankBonus + stBonus + extraMod + cloneBonus + fatigue + armourPenalty + overloadPenalty;

  // Навязанный переброс (Локус Кровопролития: «заставить цель перебросить тест
  // Избегания»). Режим приходит с кнопки карточки: цель обязана оставить
  // ХУДШИЙ из двух — то есть больший на d100.
  const rolled = [];
  for (let i = 0; i < (forcedReroll ? 2 : 1); i++) rolled.push(await new Roll("1d100").evaluate());
  const picked = pickReroll(rolled.map(r => r.total), forcedReroll || "keepBest");
  const roll   = rolled[picked.index];
  const rv     = picked.value;
  const passed = rv <= threshold;
  const deg      = passed
    ? Math.floor((threshold - rv) / 10) + 1
    : Math.floor((rv - threshold) / 10) + 1;
  const rollMode = game.settings.get("core", "rollMode");

  // Стр. 12: при Успехе персонаж уклоняется от атаки и попадание становится
  // промахом — сравнивать степени успеха со степенью атакующего не нужно (это
  // не встречная проверка). Очередь/Быстрая/Молниеносная Атака дают больше
  // одного попадания за атаку — тогда Успех снимает их по одному за каждую
  // степень, не больше их числа («Избегание множественных попаданий», стр. 12).
  const { total: totalHits, negated, remaining } = negatedHits(passed, deg, hitsCount);
  // Излишек Успехов сверх того, что нужно было ЭТОЙ атаке — банкуется на
  // попадания ДРУГИХ атак того же противника в этом Ходу (стр. 12, «...после
  // успешного Избегания одной его атаки у персонажа остались не потраченные
  // Успехи...», module/combat/evasion-pool.mjs). Молча ничего не делает вне
  // боя или без attackerUuid (кнопки контратаки/старые вызовы его не несут).
  const leftover = passed ? deg - negated : 0;
  const banked = leftover > 0 && await addEvasionSurplus(actor, attackerUuid, leftover, extraMod);

  const modParts = [];
  if (rankBonus !== -20) modParts.push(`навык ${rankBonus >= 0 ? "+" : ""}${rankBonus}`);
  if (stBonus   !== 0)   modParts.push(`стойка ${stBonus >= 0 ? "+" : ""}${stBonus}`);
  if (extraMod  !== 0)   modParts.push(`приём ${extraMod >= 0 ? "+" : ""}${extraMod}`);
  if (cloneBonus !== 0)  modParts.push(`клон-поле +${cloneBonus}`);
  if (fatigue !== 0)     modParts.push(`😓 усталость ${fatigue}`);
  if (armourPenalty !== 0) modParts.push(`🔌 броня выключена ${armourPenalty}`);
  if (overloadPenalty !== 0) modParts.push(`◈ перевес инвентаря ${overloadPenalty}`);
  if (picked.dropped.length) modParts.push(`навязанный переброс, отброшено ${picked.dropped.join(", ")}`);

  let outcomeHtml;
  if (!passed) {
    outcomeHtml = `<span class="roll-failure">Уклонение провалено — ${deg} ${_degWord(deg)}. ${
      totalHits > 1 ? `Все ${totalHits} ${_hitWord(totalHits)} проходят.` : "Получает попадание."}</span>`;
  } else if (remaining === 0) {
    outcomeHtml = `<span class="roll-success">Уклонение успешно — ${deg} ${_degWord(deg)}${
      totalHits > 1 ? `, снимает все ${totalHits} ${_hitWord(totalHits)}` : ""}! Атака промахивается.</span>`;
  } else {
    outcomeHtml = `<span class="roll-failure">${rollIcon("warn","#ffb84d")}Уклонение успешно — ${deg} ${_degWord(deg)}, снимает ${negated} из ${totalHits} ${_hitWord(totalHits)}. ${remaining} ${_hitWord(remaining)} всё ещё проходит.</span>`;
  }
  const leftoverNote = banked
    ? `<div class="roll-defense-note">Остаётся ${leftover} ${_leftoverSuccessPhrase(leftover)} — можно потратить на попадания других атак этого противника в этом Ходу (2 Усп./попадание).</div>`
    : "";

    const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("run")}Уклонение — ${esc(actor.name)}</div>
        <div class="roll-threshold">
          Ag: <b>${agTotal}</b>${modParts.length ? ` (${modParts.join(", ")})` : ""}
          → Порог: <b>${threshold}</b>
        </div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${outcomeHtml}</div>
        ${leftoverNote}
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode);

  await ChatMessage.create(messageData);
}

export async function _performParry(actor, extraMod = 0, attackerUuid = "", hitsCount = 1) {
  const wsTotal    = actor.system.characteristics.ws?.total ?? 0;
  const parrySkill = actor.system.skills?.parry;
  const rankBonus  = SKILL_RANKS[parrySkill?.rank ?? "untrained"]?.bonus ?? -20;

  // Интегральные атаки (кулак/пинок) надеты всегда — без фильтра они
  // перехватывали бы парирование у настоящего оружия (см. equipped-melee.mjs).
  const meleeWeapon = equippedMeleeWeapon(actor);

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
          <div class="roll-header">${rollIcon("sword")}Парирование — ${esc(actor.name)}</div>
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

  if (!(await spendReaction(actor, { forDefense: true }))) return _noReactionCard(actor, "Парирование");

  const stance    = actor.system.meleeStance || "standard";
  const stBonus   = MELEE_STANCES[stance]?.parryBonus ?? 0;

  // Свойства парирующего оружия (+ модификации): Защитное (+15), Силовое поле,
  // Дуэлянтское (+10 Парирование), Шаг За Шагом (+10 — Парирование само по
  // себе означает «в рукопашном бою», условие свойства выполнено безусловно)
  const parryProps    = resolveWeaponPropsList(withWitchsEdge(meleeWeapon, mergeWeaponPropEntries(meleeWeapon, modFx)));
  const pwp            = aggregateAuto(parryProps);
  const defensiveBonus = pwp.defensive    ? 15 : 0;
  const duelingBonus   = pwp.duelingParry ? 10 : 0;
  const stepBonus      = pwp.stepByStep   ? 10 : 0;
  const defBonus       = defensiveBonus + duelingBonus + stepBonus;
  // Та же правка, что у _performDodge выше — эта кнопка тоже не учитывала
  // ни Усталость, ни выключенную силовую броню.
  const fatigue       = fatiguePenalty(actor, "ws");
  const armourPenalty = disabledArmourPenalty(actor, { skillKey: "parry" });
  const overloadPenalty = inventoryOverloadPenalty(actor, { skillKey: "parry" });

  const threshold = wsTotal + rankBonus + (balanceMod ?? 0) + stBonus + defBonus + extraMod + fatigue + armourPenalty + overloadPenalty;

  const roll     = await new Roll("1d100").evaluate();
  const rv       = roll.total;
  const passed   = rv <= threshold;
  const deg      = passed
    ? Math.floor((threshold - rv) / 10) + 1
    : Math.floor((rv - threshold) / 10) + 1;
  const rollMode = game.settings.get("core", "rollMode");

  // Стр. 12: при Успехе персонаж отбивает или блокирует атаку и попадание
  // становится промахом — сравнивать степени успеха со степенью атакующего не
  // нужно (это не встречная проверка). Очередь/Быстрая/Молниеносная Атака дают
  // больше одного попадания за атаку — тогда Успех снимает их по одному за
  // каждую степень, не больше их числа («Избегание множественных попаданий»).
  const { total: totalHits, negated, remaining } = negatedHits(passed, deg, hitsCount);
  const parried = passed;
  // Излишек Успехов — банкуется на попадания ДРУГИХ атак того же противника
  // в этом Ходу (стр. 12, module/combat/evasion-pool.mjs). См. _performDodge.
  const leftover = passed ? deg - negated : 0;
  const banked = leftover > 0 && await addEvasionSurplus(actor, attackerUuid, leftover, extraMod);

  const modParts = [];
  if (rankBonus !== -20) modParts.push(`навык ${rankBonus >= 0 ? "+" : ""}${rankBonus}`);
  if (balanceMod !== 0)  modParts.push(`баланс ${balanceMod >= 0 ? "+" : ""}${balanceMod}`);
  if (stBonus !== 0)     modParts.push(`стойка ${stBonus >= 0 ? "+" : ""}${stBonus}`);
  if (defensiveBonus !== 0) modParts.push(`Защитное +${defensiveBonus}`);
  if (duelingBonus !== 0)   modParts.push(`Дуэлянтское +${duelingBonus}`);
  if (stepBonus !== 0)      modParts.push(`Шаг За Шагом +${stepBonus}`);
  if (extraMod !== 0)    modParts.push(`приём ${extraMod >= 0 ? "+" : ""}${extraMod}`);
  if (fatigue !== 0)     modParts.push(`😓 усталость ${fatigue}`);
  if (armourPenalty !== 0) modParts.push(`🔌 броня выключена ${armourPenalty}`);

  let outcomeHtml;
  if (!passed) {
    outcomeHtml = `<span class="roll-failure">Парирование провалено — ${deg} ${_degWord(deg)}. ${
      totalHits > 1 ? `Все ${totalHits} ${_hitWord(totalHits)} проходят.` : "Получает попадание."}</span>`;
  } else if (remaining === 0) {
    outcomeHtml = `<span class="roll-success">Парирование успешно — ${deg} ${_degWord(deg)}${
      totalHits > 1 ? `, снимает все ${totalHits} ${_hitWord(totalHits)}` : ""}! Атака отражена.</span>`;
  } else {
    outcomeHtml = `<span class="roll-failure">${rollIcon("warn","#ffb84d")}Парирование успешно — ${deg} ${_degWord(deg)}, снимает ${negated} из ${totalHits} ${_hitWord(totalHits)}. ${remaining} ${_hitWord(remaining)} всё ещё проходит.</span>`;
  }
  const leftoverNote = banked
    ? `<div class="roll-defense-note">Остаётся ${leftover} ${_leftoverSuccessPhrase(leftover)} — можно потратить на попадания других атак этого противника в этом Ходу (2 Усп./попадание).</div>`
    : "";

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

  // Контратака (стр. 12, Талант Counter Attack): «успешно Парировав, персонаж
  // может тут же атаковать этим же оружием со штрафом −10, раз в Раунд» — по
  // выбору игрока, поэтому кнопка, а не авто-атака. Без активного Combat
  // isRoundCapabilityAvailable считает её всегда доступной (раунд отследить
  // нечем) — тот же приём, что у Локуса Сокрушения.
  const counterAttackHtml = (parried && meleeWeapon
      && hasRuleFlag(actor, COUNTER_ATTACK_CAPABILITY)
      && isRoundCapabilityAvailable(actor, COUNTER_ATTACK_CAPABILITY))
    ? `<div class="roll-defense-section">
         <button class="wh-counter-attack-btn" type="button"
           data-weapon-id="${meleeWeapon.id}" data-attacker-uuid="${attackerUuid}">
           ${rollIcon("sword")}Контратака (−10)
         </button>
       </div>`
    : "";

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result" data-actor-uuid="${actor.uuid}">
        <div class="roll-header">${rollIcon("sword")}Парирование — ${esc(actor.name)}</div>
        <div class="roll-threshold">
          WS: <b>${wsTotal}</b>${modParts.length ? ` (${modParts.join(", ")})` : ""}
          → Порог: <b>${threshold}</b>
        </div>
        ${meleeWeapon
          ? `<div style="font-size:0.82em;color:#5a4a30;margin-bottom:2px;">
               Оружие: ${meleeWeapon.name} (Баланс ${balance >= 0 ? "+" : ""}${balance})
             </div>`
          : ""
        }
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${outcomeHtml}</div>
        ${leftoverNote}
        ${powerFieldNote}
        ${counterAttackHtml}
      </div>`,
    rolls: allRolls, sound: CONFIG.sounds.dice
  }, rollMode));
}