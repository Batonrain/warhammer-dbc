import { SKILL_RANKS }    from "../constants/characteristics.mjs";
import { MELEE_STANCES, BALANCE_PARRY_MOD } from "../constants/combat.mjs";
import { _degWord, _hitWord, _leftoverSuccessPhrase, negatedHits, esc } from "../helpers/utils.mjs";
import { resolveWeaponPropsList, aggregateAuto } from "./weapon-properties.mjs";
import { getModEffects, mergeWeaponPropEntries }  from "./weapon-mods.mjs";
import { rollIcon }       from "../constants/roll-icons.mjs";
import { pickReroll }     from "../rules/reroll-pick.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, thresholdLine } from "../helpers/test-card.mjs";
import { hasRuleFlag }    from "../rules/flags.mjs";
import { isRoundCapabilityAvailable } from "../apps/game-session.mjs";
import { equippedMeleeWeapon } from "./equipped-melee.mjs";
import { withWitchsEdge } from "./witchs-edge.mjs";
import { spendReaction }  from "./action-economy.mjs";
import { addEvasionSurplus } from "./evasion-pool.mjs";
import { recoilButtonHtml } from "./recoil.mjs";
import { danceOfFireAdvantage } from "../rules/dodge-advantage.mjs";
import { oneAgainstAHundredAdvantage } from "../rules/one-against-a-hundred.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { retractPart, extendPart, allLimbsCompressed } from "../rules/compression.mjs";
import { determinationToFightParryBonus } from "../rules/determination-to-fight.mjs";
import { canParryPsychic, psychicParryOutcome, hasBladeShield } from "./blade-shield.mjs";

// Контратака (стр. 12, Талант Counter Attack) — «раз в Раунд» ключ учёта,
// тот же примитив, что у Локуса Сокрушения (constants/capabilities.mjs).
export const COUNTER_ATTACK_CAPABILITY = "technique.counterAttack";

// Сжатие (мутация Compression) — capabilityKey уже зарегистрирован
// constants/capabilities.mjs; здесь читается через hasRuleFlag, как и
// COUNTER_ATTACK_CAPABILITY выше.
export const COMPRESSION_CAPABILITY = "mutation.compression";

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

export async function _performDodge(actor, extraMod = 0, forcedReroll = "", hitsCount = 1, attackerUuid = "", isMelee = false, burst = false, attackerIsHorde = false) {
  // Потеря ног (стр. 30-31, wdbc-r5o7.5): «нельзя Уклоняться» — хватает одной
  // потерянной ноги (книга не требует «обеих», в отличие от полной
  // неподвижности при потере ОБЕИХ ног, см. rules/character.mjs). Реакция не
  // тратится — Уклонение физически недоступно, а не просто провалено.
  if ((Number(actor.system.conditions?.lostLegsCount) || 0) > 0)
    return _noReactionCard(actor, "Уклонение (нет ног)");
  if (!(await spendReaction(actor, { forDefense: true }))) return _noReactionCard(actor, "Уклонение");
  const agTotal    = actor.system.characteristics.ag?.total ?? 0;
  const dodgeSkill = actor.system.skills?.dodge;
  const rankBonus  = SKILL_RANKS[dodgeSkill?.rank ?? "untrained"]?.bonus ?? -20;
  const stance     = actor.system.meleeStance || "standard";
  const stBonus    = MELEE_STANCES[stance]?.dodgeBonus ?? 0;
  // Клонирующее Поле: голограммы срывают прицел — бонус носителю на физическое
  // избегание. Сила зависит от редкости поля (Poor.Q режет её вдвое).
  const cloneBonus = actor.system.cloneField?.bonus ?? 0;
  // Все модификаторы, которые система знает про этот тест, — одним сбором
  // (wdbc-ct65.1). Раньше здесь по одному дописывались Усталость, выключенная
  // силовая броня, Перевес инвентаря и Повален, а всё остальное, что книга
  // даёт Уклонению (Черты, Таланты, Происхождения, записи Конструктора),
  // сюда не доезжало вовсе: путь этой кнопки шёл мимо реестра правил.
  const ruleMods  = collectTestMods(actor, { kind: "skill", skill: "dodge", char: "ag" });
  const threshold = agTotal + rankBonus + stBonus + extraMod + cloneBonus + ruleMods.total;

  // Навязанный переброс (Локус Кровопролития: «заставить цель перебросить тест
  // Избегания»). Режим приходит с кнопки карточки: цель обязана оставить
  // ХУДШИЙ из двух — то есть больший на d100. Танец Среди Огня и Один Против
  // Сотни (wdbc-u0by) — собственное Преимущество защищающегося (против
  // Очереди / против атаки Орды), тот же приём (roll×2 + pickReroll), но mode
  // "keepBest" — forcedReroll, если задан, приоритетнее (внешнее навязывание
  // сильнее своего Преимущества).
  const dancerAdvantage = danceOfFireAdvantage(actor, burst);
  const hordeAdvantage  = oneAgainstAHundredAdvantage(actor, attackerIsHorde);
  const selfAdvantage   = dancerAdvantage || hordeAdvantage;
  const rolled = [];
  for (let i = 0; i < (forcedReroll || selfAdvantage ? 2 : 1); i++) rolled.push(await new Roll("1d100").evaluate());
  const picked = pickReroll(rolled.map(r => r.total), forcedReroll || "keepBest");
  const roll   = rolled[picked.index];
  const rv     = picked.value;
  // Формула степени успеха/провала — module/rules/roll-outcome.mjs (wdbc-5dvx,
  // раньше дублировалась вручную здесь же).
  const { success: passed, deg } = testOutcome(rv, threshold);

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
  modParts.push(...ruleMods.parts);
  if (picked.dropped.length) {
    modParts.push(forcedReroll
      ? `навязанный переброс, отброшено ${picked.dropped.join(", ")}`
      : `${dancerAdvantage ? "Танец Среди Огня" : "Один Против Сотни"}: Преимущество, отброшено ${picked.dropped.join(", ")}`);
  }

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

  // Отскок (стр. 12, wdbc-9wvm): вместо нивеляции — только от СТРЕЛКОВОЙ
  // атаки (isMelee=false) и только при успешном Уклонении. Рукопашный
  // Отскок = Вольт (п.6 правила) — отдельная точка входа, не эта кнопка
  // (см. заголовок module/combat/recoil.mjs).
  const recoilSection = (passed && !isMelee) ? recoilButtonHtml(actor) : "";

    await postTestCard(actor, {
    icon: rollIcon("run"), title: `Уклонение — ${esc(actor.name)}`, actorUuid: actor.uuid,
    threshold: thresholdLine({ label: "Ag", base: agTotal, parts: modParts, threshold }),
    rv, outcome: outcomeHtml, sections: [leftoverNote, recoilSection]
  }, { rolls: [roll] });
}

// Распыление/Spray (wdbc-p06s, свойство оружия «Дальнобойное», стр. 166-170):
// «Атака по каплевидному шаблону; попадает автоматически по всем на пути,
// цель отменяет попадание броском A+0 (без Реакции), при успехе — Отскок как
// при Уклонении, если её база полностью накрыта». Это НЕ Уклонение — другой
// Навык (Acrobatics, не Dodge), не тратит Реакцию (spendReaction здесь
// сознательно не зовётся) и не встречный тест. Геометрию накрытия Базы
// шаблоном код не отслеживает (тот же honest-compromise, что у blastRecoilNote
// в attack-card.mjs) — Отскок предлагается кнопкой на любом успехе, без гейта
// кодом; читающий карточку сам решает по столу, обязателен ли он здесь.
export async function _performSprayCancel(actor) {
  const agTotal   = actor.system.characteristics.ag?.total ?? 0;
  const acroSkill = actor.system.skills?.acrobatics;
  const rankBonus = SKILL_RANKS[acroSkill?.rank ?? "untrained"]?.bonus ?? -20;
  const cloneBonus = actor.system.cloneField?.bonus ?? 0;
  // Тест идёт Акробатикой, а не Уклонением, и Реакцию не тратит — поэтому
  // штраф выключенной брони берётся обычный физический (−10 характеристике),
  // а не реакционный −40: REACTION_SKILLS знает только Dodge/Parry, а ключ
  // навыка здесь другой. Ветвить это руками не нужно, сбор различает сам.
  const ruleMods  = collectTestMods(actor, { kind: "skill", skill: "acrobatics", char: "ag" });
  const threshold = agTotal + rankBonus + cloneBonus + ruleMods.total;

  const roll = await new Roll("1d100").evaluate();
  const rv     = roll.total;
  const passed = rv <= threshold;
  const deg    = passed
    ? Math.floor((threshold - rv) / 10) + 1
    : Math.floor((rv - threshold) / 10) + 1;

  const modParts = [];
  if (rankBonus !== -20) modParts.push(`навык ${rankBonus >= 0 ? "+" : ""}${rankBonus}`);
  if (cloneBonus !== 0)  modParts.push(`клон-поле +${cloneBonus}`);
  modParts.push(...ruleMods.parts);

  const outcomeHtml = passed
    ? `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}! Попадание отменено (если шаблон не накрывает Базу целиком — иначе годится только Отскок ниже, стр. 12).</span>`
    : `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Попадание проходит.</span>`;

  const recoilSection = passed ? recoilButtonHtml(actor) : "";

  await postTestCard(actor, {
    icon: rollIcon("run"),
    title: `Тест на отмену (Распыление, Acrobatics A+0) — ${esc(actor.name)}`, actorUuid: actor.uuid,
    threshold: thresholdLine({ label: "Ag", base: agTotal, parts: modParts, threshold }),
    rv, outcome: outcomeHtml, sections: [recoilSection]
  }, { rolls: [roll] });
}

/**
 * Порог Парирования и всё, из чего он сложился, — ОДИН расчёт на два вызова
 * (wdbc-bwf9). Парирование обычной атаки и Парирование психосилы Талантом «Щит
 * Клинков» считаются по книге одинаково (тест WS+навык+баланс+свойства
 * оружия), различаются только тем, ЧТО отменяет успех. Раньше расчёт жил
 * внутри _performParry, и второму вызову пришлось бы завести его копию —
 * то есть второе место, где живут бонусы Дуэлянтского и Шага За Шагом.
 *
 * Реакцию НЕ тратит и карточек не пишет: это делает вызывающий, у которого
 * свой текст отказа.
 *
 * @param {object} actor
 * @param {number} extraMod        модификатор приёма/ситуации
 * @param {?object} [weaponOverride] чем парируем, если не «надетое рукопашное»
 */
export function parryProfile(actor, extraMod = 0, weaponOverride = null) {
  const wsTotal    = actor.system.characteristics.ws?.total ?? 0;
  const parrySkill = actor.system.skills?.parry;
  const rankBonus  = SKILL_RANKS[parrySkill?.rank ?? "untrained"]?.bonus ?? -20;

  // Интегральные атаки (кулак/пинок) надеты всегда — без фильтра они
  // перехватывали бы парирование у настоящего оружия (см. equipped-melee.mjs).
  const meleeWeapon = weaponOverride ?? equippedMeleeWeapon(actor);

  // Эффекты модификаций парирующего оружия (баланс, Защитное/Power Field и т.п.)
  const modFx      = getModEffects(actor, meleeWeapon);
  const balance    = parseInt(meleeWeapon?.system.balance ?? 0) + (modFx.balanceMod || 0);
  const balanceMod = BALANCE_PARRY_MOD[String(balance)];

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
  // Тот же общий сбор, что у _performDodge (wdbc-ct65.1).
  const ruleMods = collectTestMods(actor, { kind: "skill", skill: "parry", char: "ws" });
  // Determination To Fight/Решительность Сражаться (wdbc-1rno): +30 при
  // отрицательных Ранах + прошлый раунд в Защитной Стойке.
  const dtfBonus = determinationToFightParryBonus(actor);

  const threshold = wsTotal + rankBonus + (balanceMod ?? 0) + stBonus + defBonus + extraMod + ruleMods.total + dtfBonus;

  const modParts = [];
  if (rankBonus !== -20) modParts.push(`навык ${rankBonus >= 0 ? "+" : ""}${rankBonus}`);
  if (balanceMod !== 0 && balanceMod != null) modParts.push(`баланс ${balanceMod >= 0 ? "+" : ""}${balanceMod}`);
  if (stBonus !== 0)     modParts.push(`стойка ${stBonus >= 0 ? "+" : ""}${stBonus}`);
  if (defensiveBonus !== 0) modParts.push(`Защитное +${defensiveBonus}`);
  if (duelingBonus !== 0)   modParts.push(`Дуэлянтское +${duelingBonus}`);
  if (stepBonus !== 0)      modParts.push(`Шаг За Шагом +${stepBonus}`);
  if (extraMod !== 0)    modParts.push(`приём ${extraMod >= 0 ? "+" : ""}${extraMod}`);
  modParts.push(...ruleMods.parts);
  if (dtfBonus !== 0)    modParts.push(`Решительность Сражаться +${dtfBonus}`);

  return { wsTotal, meleeWeapon, balance, balanceMod, threshold, modParts, pwp };
}

/** Отказ Парирования стрельбы: почему нельзя. Реакция при этом не тратится. */
function _bladeShieldRefusal(actor, why) {
  return postTestCard(actor, {
    icon: rollIcon("sword"), title: `Парирование — ${esc(actor.name)}`, actorUuid: actor.uuid,
    outcome: `<span class="roll-failure">${rollIcon("ban","#ff6b6b")}${why}</span>`
  });
}

export async function _performParry(actor, extraMod = 0, attackerUuid = "", hitsCount = 1, burst = false, attackerIsHorde = false, isMelee = true) {
  const { wsTotal, meleeWeapon, balance, balanceMod, threshold, modParts, pwp } =
    parryProfile(actor, extraMod);

  // ── Парирование СТРЕЛЬБЫ — только Талантом «Щит Клинков» (wdbc-3e2x) ──────
  // Корбук, стр. 62: «Реакция персонажа столь стремительна, что он способен
  // перехватывать клинком пули и лучи. Если персонаж вооружен оружием с
  // Балансом 1 и выше, он может парировать им стрелковую атаку.» До этой
  // правки кнопка Парирования на карточке стрельбы работала у КОГО УГОДНО и с
  // любым балансом — система была щедрее книги.
  //
  // Проверяется здесь, а не при отрисовке карточки: карточку пишет атакующий,
  // и на момент её сборки неизвестно, кто будет отбиваться (тот же приём, что
  // у Сжатия). Реакция при отказе не тратится — действие недоступно, а не
  // провалено.
  if (!isMelee) {
    if (!hasBladeShield(actor)) {
      return _bladeShieldRefusal(actor,
        "Парировать стрелковую атаку может только персонаж с Талантом «Щит Клинков» (стр. 62).");
    }
    if (balance < 1) {
      return _bladeShieldRefusal(actor,
        `«Щит Клинков» требует оружия с Балансом 1 и выше — у ${meleeWeapon ? `«${esc(meleeWeapon.name)}»` : "голых рук"} Баланс ${balance >= 0 ? "+" : ""}${balance}.`);
    }
  }

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
                 Оружие: ${esc(meleeWeapon.name)} (Баланс ${balance >= 0 ? "+" : ""}${balance})
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

  // Танец Среди Огня и Один Против Сотни (wdbc-u0by) — Преимущество на
  // Парирование против Очереди / против атаки Орды, тот же приём
  // roll×2 + pickReroll, что у Уклонения выше.
  const dancerAdvantage = danceOfFireAdvantage(actor, burst);
  const hordeAdvantage  = oneAgainstAHundredAdvantage(actor, attackerIsHorde);
  const selfAdvantage   = dancerAdvantage || hordeAdvantage;
  const rolled = [];
  for (let i = 0; i < (selfAdvantage ? 2 : 1); i++) rolled.push(await new Roll("1d100").evaluate());
  const picked   = pickReroll(rolled.map(r => r.total), "keepBest");
  const roll     = rolled[picked.index];
  const rv       = picked.value;
  // Формула степени успеха/провала — module/rules/roll-outcome.mjs (wdbc-5dvx).
  const { success: passed, deg } = testOutcome(rv, threshold);

  // Стр. 12: при Успехе персонаж отбивает или блокирует атаку и попадание
  // становится промахом — сравнивать степени успеха со степенью атакующего не
  // нужно (это не встречная проверка). Очередь/Быстрая/Молниеносная Атака дают
  // больше одного попадания за атаку — тогда Успех снимает их по одному за
  // каждую степень, не больше их числа («Избегание множественных попаданий»).
  // Стр. 62: «Успех на этом тесте парирования ВСЕГДА блокирует только одно
  // попадание, независимо от количества Успехов» — это про Парирование
  // СТРЕЛЬБЫ. В рукопашной работает общее правило стр. 12 (по попаданию за
  // степень), поэтому степень режется только в стрелковой ветке.
  const effectiveDeg = isMelee ? deg : Math.min(deg, 1);
  const { total: totalHits, negated, remaining } = negatedHits(passed, effectiveDeg, hitsCount);
  const parried = passed;
  // Излишек Успехов — банкуется на попадания ДРУГИХ атак того же противника
  // в этом Ходу (стр. 12, module/combat/evasion-pool.mjs). См. _performDodge.
  // При Парировании СТРЕЛЬБЫ банковать нечего: книга даёт ровно одно снятое
  // попадание независимо от числа Успехов, значит «излишка» в её смысле не
  // возникает. В рукопашной пул работает как раньше.
  const leftover = passed && isMelee ? deg - negated : 0;
  const banked = leftover > 0 && await addEvasionSurplus(actor, attackerUuid, leftover, extraMod);

  if (picked.dropped.length) modParts.push(`${dancerAdvantage ? "Танец Среди Огня" : "Один Против Сотни"}: Преимущество, отброшено ${picked.dropped.join(", ")}`);

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

  await postTestCard(actor, {
    icon: rollIcon("sword"), title: `Парирование — ${esc(actor.name)}`, actorUuid: actor.uuid,
    threshold: thresholdLine({ label: "WS", base: wsTotal, parts: modParts, threshold }),
    lines: [meleeWeapon
      ? `<div style="font-size:0.82em;color:#5a4a30;margin-bottom:2px;">Оружие: ${esc(meleeWeapon.name)} (Баланс ${balance >= 0 ? "+" : ""}${balance})</div>`
      : ""],
    rv, outcome: outcomeHtml,
    sections: [leftoverNote, powerFieldNote, counterAttackHtml]
  }, { rolls: [roll] });
}

/**
 * ПАРИРОВАНИЕ ПСИХОСИЛЫ Талантом «Щит Клинков» (wdbc-bwf9).
 *
 * Отличается от обычного Парирования только тем, что отменяет: не попадание, а
 * эффекты психосилы целиком (Книга Жаб-Псайкеров: «При успешном парировании
 * эффекты психосилы нивелируются»). Poor.Q ноктиковый щит развеивает частично —
 * снижает эPR за каждый успех, и тогда сила не отменена, а ослаблена.
 *
 * Порог тот же самый — parryProfile выше, один расчёт на оба вида Парирования.
 * Парируем ИМЕННО тем предметом, который разрешён книгой (tool), а не «надетым
 * рукопашным»: у варлока в другой руке может быть что угодно.
 *
 * Излишек Успехов в пул Избегания НЕ банкуется: пул книги (стр. 12) — про
 * попадания атак того же противника, а психосила попаданий не раздаёт.
 */
export async function _performPsychicParry(actor, { powerName = "", ePR = 0, extraMod = 0 } = {}) {
  const { ok, tool, weakens, reason } = canParryPsychic(actor);
  if (!ok) {
    return postTestCard(actor, {
      icon: rollIcon("sword"), title: `Парирование психосилы — ${esc(actor.name)}`, actorUuid: actor.uuid,
      outcome: `<span class="roll-failure">${rollIcon("ban","#ff6b6b")}Парировать психосилу нечем: ${esc(reason)}.</span>`
    });
  }

  const { wsTotal, balance, balanceMod, threshold, modParts } = parryProfile(actor, extraMod, tool);
  if (balanceMod === null) {
    return postTestCard(actor, {
      icon: rollIcon("sword"), title: `Парирование психосилы — ${esc(actor.name)}`, actorUuid: actor.uuid,
      outcome: `<span class="roll-failure">${rollIcon("ban","#ff6b6b")}Этим предметом нельзя парировать (Баланс ${balance >= 0 ? "+" : ""}${balance}).</span>`
    });
  }

  if (!(await spendReaction(actor, { forDefense: true }))) return _noReactionCard(actor, "Парирование психосилы");

  const roll = await new Roll("1d100").evaluate();
  const rv   = roll.total;
  const { success: passed, deg } = testOutcome(rv, threshold);
  const { negated, ePRLeft, drop } = psychicParryOutcome(passed, deg, weakens, ePR);

  let outcomeHtml;
  if (!passed) {
    outcomeHtml = `<span class="roll-failure">Парирование провалено — ${deg} ${_degWord(deg)}. Психосила действует полностью.</span>`;
  } else if (negated) {
    outcomeHtml = `<span class="roll-success">Парирование успешно — ${deg} ${_degWord(deg)}! Эффекты психосилы нивелированы.</span>`;
  } else {
    outcomeHtml = `<span class="roll-failure">${rollIcon("warn","#ffb84d")}Парирование успешно — ${deg} ${_degWord(deg)}, но щит развеивает не полностью: эPR ${ePR} − ${drop} = <b>${ePRLeft}</b>. Психосила действует ослабленной.</span>`;
  }

  return postTestCard(actor, {
    icon: rollIcon("sword"),
    title: `Парирование психосилы${powerName ? ` «${esc(powerName)}»` : ""} — ${esc(actor.name)}`,
    actorUuid: actor.uuid,
    threshold: thresholdLine({ label: "WS", base: wsTotal, parts: modParts, threshold }),
    lines: [`<div style="font-size:0.82em;color:#5a4a30;margin-bottom:2px;">Чем парирует: ${esc(tool.name)} (Баланс ${balance >= 0 ? "+" : ""}${balance})${weakens ? " — Poor.Q: развеивает частично" : ""}</div>`],
    rv, outcome: outcomeHtml
  }, { rolls: [roll] });
}

/**
 * Сжатие (мутация Compression, wdbc-1rno, стр. текста мутации) — реактивная
 * АЛЬТЕРНАТИВА Уклонению/Парированию для ОДНОГО попадания в конечность/
 * голову: тратит Реакцию (тот же гейт, что Уклонение/Парирование), БЕЗ
 * броска, всегда нивелирует ровно это попадание — книга не даёт теста,
 * просто «может втянуть эту часть тела». `location` — метка HIT_LOCATIONS
 * (constants/combat.mjs: «Голова»/«П. Рука»/«Л. Рука»/«П. Нога»/«Л. Нога»),
 * читается из карточки атаки (attack-card.mjs::defenseSection передаёт её
 * кнопке через data-атрибут, сама карточка Foundry-документов не касается —
 * доступность способности проверяется здесь, не на этапе рендера).
 *
 * Не смоделировано намеренно — см. шапку rules/compression.mjs: зрение при
 * втянутой Голове, мобильность при втянутых Ногах, выпуск удерживаемого
 * оружия из втягиваемой Руки — только чат-заметки, без числа/автоснятия.
 */
export async function _performCompression(actor, location, attackerUuid = "") {
  const rollMode = game.settings.get("core", "rollMode");
  if (!hasRuleFlag(actor, COMPRESSION_CAPABILITY)) {
    return ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${rollIcon("shield")}Сжатие — ${esc(actor.name)}</div>
          <div class="roll-outcome">
            <span class="roll-failure">${rollIcon("ban","#ff6b6b")}У цели нет мутации «Сжатие» (Compression).</span>
          </div>
        </div>`
    }, rollMode));
  }
  if (!(await spendReaction(actor, { forDefense: true }))) return _noReactionCard(actor, "Сжатие");

  const current = actor.getFlag("warhammer-dbc", "compressedParts") ?? [];
  const updated = retractPart(current, location);
  await actor.update({ "flags.warhammer-dbc.compressedParts": updated });

  const notes = [];
  if (location === "Голова") notes.push("лишается зрения (но не слуха), пока голова не разложена обратно");
  if (location === "П. Нога" || location === "Л. Нога")
    notes.push("мобильность снижена, пока нога не разложена обратно (величина — на усмотрение ГМа)");
  if (location === "П. Рука" || location === "Л. Рука")
    notes.push("оружие/инструмент в этой руке пришлось выпустить (снимите/переместите вручную)");
  if (allLimbsCompressed(updated))
    notes.push("все конечности втянуты — помещается в пространства, слишком малые для обычных людей/космодесантников");

  // Кнопки «Разложить», по одной на каждую СЕЙЧАС втянутую часть (не только
  // ту, что втянута этим кликом — прошлые попадания могли втянуть другие).
  // data-actor-uuid на корне карточки — тот же приём, что уже несёт
  // _performParry для кнопки Контратаки (не полагаться на «выбранный
  // токен», карточка может открыться спустя ходы после самого Сжатия).
  const extendBtns = updated.map(loc => `
      <button class="wh-extend-btn" type="button" data-location="${loc}"
        title="Полудействие: разложить эту часть тела обратно (экономика действий не отслеживается — отыгрывается вручную)">
        Разложить ${loc}
      </button>`).join("");

  await postTestCard(actor, {
    icon: rollIcon("shield"), title: `Сжатие — ${esc(actor.name)}`, actorUuid: actor.uuid,
    outcome: `<span class="roll-success">Втягивает ${location} в торс (вместе с бронёй/снаряжением на ней) — попадание нивелировано.</span>`,
    sections: [
      notes.length ? `<div class="roll-defense-note">${notes.join("; ")}.</div>` : "",
      `<div class="roll-defense-section">${extendBtns}</div>`
    ]
  });
}

/**
 * Разложить одну втянутую часть тела обратно (за полудействие, книга) —
 * кнопка «Разложить» в карточке самого Сжатия выше (data-actor-uuid на
 * корне карточки, тот же приём, что у Контратаки после Парирования).
 * Экономика полудействия НЕ отслеживается системой — тот же принцип, что у
 * Pure Form/Mist Transformation, отыгрывается вручную.
 */
export async function _performExtendBodyPart(actor, location) {
  const current = actor.getFlag("warhammer-dbc", "compressedParts") ?? [];
  if (!current.includes(location)) return;
  const updated = extendPart(current, location);
  await actor.update({ "flags.warhammer-dbc.compressedParts": updated });
  await postTestCard(actor, {
    icon: rollIcon("shield"), title: `Сжатие — ${esc(actor.name)}`,
    outcome: `<span class="roll-success">Раскладывает ${location} обратно (полудействие).</span>`
  }, { sound: false });
}