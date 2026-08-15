import { _performDodge, _performParry } from "./combat/defense.mjs";
import { _executeAttackRoll }           from "./combat/attack.mjs";
import { _executeFearRoll }             from "./combat/fear.mjs";
import { showApplyDamageDialog }         from "./combat/damage.mjs";
import { _performSwerve }                from "./combat/vehicle.mjs";
import { CONDITION_LEVEL_FIELD }         from "./combat/weapon-properties.mjs";
import { fateTerm, esc }                 from "./helpers/utils.mjs";
import { rollIcon }                      from "./constants/roll-icons.mjs";

export function registerHooks() {

  // ── Обработчики кнопок в чате ────────────────────────────────────────────
  Hooks.on("renderChatMessageHTML", (message, html, data) => {

    // Уклонение
    html.querySelectorAll(".wh-dodge-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const selectedToken = canvas.tokens?.controlled?.[0];
        if (!selectedToken?.actor) {
          return ui.notifications.warn("⚠️ Выберите токен защищающегося персонажа на сцене!");
        }
        const extraMod = parseInt(ev.currentTarget.dataset.extraMod || "0");
        const attackDeg = ev.currentTarget.dataset.attackDeg != null
          ? parseInt(ev.currentTarget.dataset.attackDeg) : null;
        await _performDodge(selectedToken.actor, extraMod, attackDeg);
      });
    });

    // Парирование
    html.querySelectorAll(".wh-parry-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const selectedToken = canvas.tokens?.controlled?.[0];
        if (!selectedToken?.actor) {
          return ui.notifications.warn("⚠️ Выберите токен защищающегося персонажа на сцене!");
        }
        const extraMod = parseInt(ev.currentTarget.dataset.extraMod || "0");
        const attackDeg = ev.currentTarget.dataset.attackDeg != null
          ? parseInt(ev.currentTarget.dataset.attackDeg) : null;
        await _performParry(selectedToken.actor, extraMod, attackDeg);
      });
    });

    // Вираж (реакция техники — как Уклонение, но Operate − Размер×10)
    html.querySelectorAll(".wh-swerve-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const selectedToken = canvas.tokens?.controlled?.[0];
        if (!selectedToken?.actor) {
          return ui.notifications.warn("⚠️ Выберите токен машины на сцене!");
        }
        const extraMod = parseInt(ev.currentTarget.dataset.extraMod || "0");
        const attackDeg = ev.currentTarget.dataset.attackDeg != null
          ? parseInt(ev.currentTarget.dataset.attackDeg) : null;
        await _performSwerve(selectedToken.actor, extraMod, attackDeg);
      });
    });

    // Сдвиг места попадания (±A.b, Талант/Черта с flags.hitLocationShift) —
    // только владелец атакующего актора (или ГМ). Правит ЭТУ ЖЕ карточку
    // (updateMessageId) — тот же rv через opts.forcedRoll, урон/крит
    // пересчитываются заново под новое место. Можно жать разные кнопки друг
    // за другом — не одноразово: кнопка текущего сдвига просто приходит уже
    // задизейбленной с сервера (см. locShiftHtml в attack.mjs).
    // У остальных игроков блок сразу прячем — не просто дизейблим по клику,
    // чтобы не выглядел кликабельным для чужой атаки.
    html.querySelectorAll(".roll-loc-shift").forEach(section => {
      const atkForVis = message.flags?.["warhammer-dbc"]?.attack;
      const owner = atkForVis && game.actors?.get(atkForVis.actorId)?.isOwner;
      if (!owner) section.remove();
    });
    html.querySelectorAll(".wh-locshift-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const atk = message.flags?.["warhammer-dbc"]?.attack;
        if (!atk) return;
        const atkActor = game.actors?.get(atk.actorId);
        if (!atkActor?.isOwner) {
          return ui.notifications.warn("Сдвинуть место попадания может только сам атакующий (или ГМ).");
        }
        const atkItem = atkActor.items?.get(atk.itemId);
        if (!atkItem) return;
        const shift = parseInt(ev.currentTarget.dataset.shift) || 0;
        await _executeAttackRoll(atkActor, atkItem, atk.charKey, atk.threshold, atk.rofMode, atk.aimTarget,
          { ...(atk.opts || {}), forcedRoll: atk.rv, skipAmmo: true, locationShift: shift, updateMessageId: message.id });
      });
    });

    // Бесплатный переброс Теста Страха (Демон) — одна попытка на тест,
    // поэтому сразу дизейблим кнопку по клику (новая карточка сама
    // повторную кнопку уже не предложит — opts.free в fear.mjs).
    html.querySelectorAll(".wh-fear-reroll-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ctx = message.flags?.["warhammer-dbc"]?.fearTest;
        if (!ctx) return;
        const actor = game.actors?.get(ctx.actorId);
        if (!actor?.isOwner) {
          return ui.notifications.warn("Перебросить может только владелец персонажа (или ГМ).");
        }
        ev.currentTarget.disabled = true;
        await _executeFearRoll(actor, ctx.ratingKey, ctx.type, ctx.infamy, ctx.mod, ctx.properties, { free: true });
      });
    });

    // Применение урона
    html.querySelectorAll(".wh-apply-dmg-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        await showApplyDamageDialog({
          rawDamage:    parseInt(ds.damage      || "0"),
          penetration:  parseInt(ds.penetration || "0"),
          damageType:   ds.damageType  || "impact",
          hitLocation:  ds.hitLocation || "Торс",
          side:         ds.vehicleSide || "",   // сторона брони техники (из окна атаки)
          weaponName:   ds.weaponName  || "",
          attackerName: ds.attacker    || "",
          felling:      parseInt(ds.felling || "0"),
          primitive:    ds.primitive    === "1",
          ignoreShield: ds.ignoreShield === "1",
          warpSoak:     ds.warpSoak     === "1",
          lance:        ds.lance        === "1",
          sanctified:   ds.sanctified   === "1"
        });
      });
    });

    // Применение эффектов особых свойств оружия к цели
    html.querySelectorAll(".wh-wprop-apply-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await _applyWeaponPropEffect(ev.currentTarget.dataset);
      });
    });

    // Непоглощаемый урон в Ходовую техники (Трудный Ландшафт) → Структура
    html.querySelectorAll(".wh-vehicle-track-dmg-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        const actor = game.actors.get(ds.actorId);
        if (!actor) return ui.notifications.warn("⚠️ Машина не найдена.");
        const dmg = parseInt(ds.dmg || "0") || 0;
        const cur = Number(actor.system.structure?.value) || 0;
        const curCrit = Number(actor.system.structure?.critical) || 0;
        const next = Math.max(0, cur - dmg);
        const overflow = Math.max(0, dmg - cur);
        await actor.update({
          "system.structure.value": next,
          "system.structure.critical": curCrit + overflow,
          "system.chassis.spdDamage": (Number(actor.system.chassis?.spdDamage) || 0)
        });
        ui.notifications.info(`${actor.name}: Ходовая повреждена — Структура ${cur} → ${next} (−${dmg}).`);
      });
    });

    // Применение урона Прочности к выбранному кораблю-цели
    html.querySelectorAll(".wh-ship-dmg-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await _applyShipHullDamage(parseInt(ev.currentTarget.dataset.hi || "0"));
      });
    });

    // Отметить пустотные щиты корабля-цели схлопнутыми (VS = 0)
    html.querySelectorAll(".wh-ship-vs-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const targeted = [...(game.user?.targets ?? [])].map(t => t.actor ?? t.document?.actor).find(a => a?.type === "ship");
        const selected = (canvas.tokens?.controlled ?? []).map(t => t.actor).find(a => a?.type === "ship");
        const actor = targeted || selected;
        if (!actor) return ui.notifications.warn("⚠️ Отметьте или выберите токен корабля-цели!");
        await actor.update({ "system.voidShieldsDown": true });
        ui.notifications.info(`${actor.name}: пустотные щиты схлопнуты (VS = 0). Восстановите на листе, когда накопятся.`);
      });
    });

    // Выжигание Души (с Психосилового оружия при попадании)
    html.querySelectorAll(".wh-soulburn-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await _resolveSoulBurn(ev.currentTarget.dataset.attackerId);
      });
    });

    // ── ПКМ по сообщению с броском — переброс / +10 за Очки Судьбы ────────
    _attachFateContextMenu(message, html);
  });
}

// ── Применение урона Прочности к кораблю-цели ────────────────────────────────
// Сначала берём отмеченную (target) цель-корабль, иначе выбранный токен.
async function _applyShipHullDamage(dmg) {
  const targeted = [...(game.user?.targets ?? [])]
    .map(t => t.actor ?? t.document?.actor).find(a => a?.type === "ship");
  const selected = (canvas.tokens?.controlled ?? [])
    .map(t => t.actor).find(a => a?.type === "ship");
  const actor = targeted || selected;
  if (!actor) return ui.notifications.warn("⚠️ Отметьте (target) или выберите токен корабля-цели!");

  const d    = Number(dmg) || 0;
  const cur  = actor.system.hullIntegrity?.value ?? 0;
  const next = Math.max(0, cur - d);
  const lost = cur - next;                       // фактически снятая Прочность
  const cp   = Number(actor.system.crew?.population) || 0;
  const cm   = Number(actor.system.crew?.morale) || 0;
  // За каждое потерянное очко Прочности экипаж теряет 1 CP и 1 CM.
  await actor.update({
    "system.hullIntegrity.value": next,
    "system.crew.population":     Math.max(0, cp - lost),
    "system.crew.morale":         Math.max(0, cm - lost)
  });
  const half = next === 0 ? " — ПОЛУРАЗРУШЕН!" : "";
  ui.notifications.info(`${actor.name}: Прочность ${cur} → ${next} (−${d})${lost ? `, экипаж −${lost} CP/CM` : ""}${half}`);
}

// ── Применение эффекта свойства оружия (Оглушающее, Ослепляющее и т.п.) ──────
async function _applyWeaponPropEffect(ds) {
  const token = canvas.tokens?.controlled?.[0];
  if (!token?.actor) {
    return ui.notifications.warn("⚠️ Выберите токен цели на сцене!");
  }
  const actor     = token.actor;
  const label     = ds.wpLabel    || "Эффект";
  const kind      = ds.wpKind      || "";
  const condition = ds.wpCondition || "";
  const testChar  = ds.wpTestChar  || "";
  const testMod   = parseInt(ds.wpTestMod || "0");
  const perDoP    = ds.wpLevelPerDop === "1";
  const useRounds = ds.wpRounds === "1";
  const fixedRnd  = parseInt(ds.wpFixedRounds || "0");
  const dmgFormula = ds.wpDamage  || "";
  const rollMode  = game.settings.get("core", "rollMode");

  const allRolls = [];

  // Тест сопротивления цели (если задана характеристика)
  let resisted = false, rollHtml = "", deg = 1;
  if (testChar) {
    const charTotal = actor.system.characteristics?.[testChar]?.total ?? 0;
    const threshold = charTotal + testMod;
    const roll      = await new Roll("1d100").evaluate();
    allRolls.push(roll);
    const rv        = roll.total;
    resisted        = rv <= threshold;
    deg             = Math.max(1, Math.floor(Math.abs(rv - threshold) / 10) + 1);
    rollHtml = `
      <div class="roll-threshold">${testChar.toUpperCase()}: <b>${charTotal}</b>${testMod !== 0 ? ` ${testMod >= 0 ? "+" : ""}${testMod}` : ""} → Порог: <b>${threshold}</b></div>
      <div class="roll-dice">Бросок: <b>${rv}</b></div>
      <div class="roll-outcome">${resisted
        ? `<span class="roll-success">Цель сопротивилась — эффект не наложен</span>`
        : `<span class="roll-failure">Провал (${deg} ст.) — эффект наложен</span>`}</div>`;
  }

  // Состояния, которые накладываем при провале
  const conditionsToApply = [];
  if (kind === "grav") conditionsToApply.push(["prone", false], ["pinned", false]);
  else if (condition)  conditionsToApply.push([condition, true]);

  let appliedNote = "";
  if (!resisted && conditionsToApply.length) {
    const update = {};
    const applied = [];
    for (const [cond, hasLevel] of conditionsToApply) {
      update[`system.conditions.${cond}`] = true;
      const levelField = CONDITION_LEVEL_FIELD[cond];
      if (hasLevel && levelField) {
        const lvl = perDoP ? deg : (fixedRnd || 1);
        const cur = actor.system.conditions?.[levelField] ?? 0;
        update[`system.conditions.${levelField}`] = Math.max(cur, lvl);
        applied.push(`${label} (${useRounds ? "раундов" : "ур."}: ${lvl})`);
      } else {
        applied.push(cond === "prone" ? "Сбита с ног" : cond === "pinned" ? "Прижата" : label);
      }
    }
    await actor.update(update);
    appliedNote = `<div class="roll-threshold">Состояние: <b>${applied.join(", ")}</b></div>`;
  }

  // Доп. урон (Токсичное и т.п.) — при провале теста, минуя броню
  let dmgNote = "";
  if (!resisted && dmgFormula) {
    const dmgRoll = await new Roll(dmgFormula).evaluate();
    allRolls.push(dmgRoll);
    const dmg = dmgRoll.total;
    const cur = actor.system.wounds?.value ?? 0;
    await actor.update({ "system.wounds.value": Math.max(0, cur - dmg) });
    dmgNote = `<div class="roll-threshold">${rollIcon("burst","#ffb84d")}Доп. урон (минуя броню): <b>${dmg}</b> → Раны ${cur} → ${Math.max(0, cur - dmg)}</div>`;
  }

  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${label} → ${esc(actor.name)}</div>
        ${rollHtml}
        ${appliedNote}
        ${dmgNote}
      </div>`,
    rolls: allRolls,
    sound: allRolls.length ? CONFIG.sounds.dice : null
  }, rollMode);
  await ChatMessage.create(messageData);
}

// ── Выжигание Души (с Психосилового оружия) ──────────────────────────────────
// Псайкер: тест W+PR×5. Цель сопротивляется тестом W. При успехе псайкера и
// провале/меньших СУ цели — урон 1d10+PR в выбранную характеристику (не в раны).
function _resolveActorById(id) {
  return game.actors?.get(id)
    ?? canvas.tokens?.placeables?.find(t => t.actor?.id === id)?.actor
    ?? null;
}

export async function _resolveSoulBurn(attackerId) {
  const attacker = _resolveActorById(attackerId);
  if (!attacker) return ui.notifications.warn("⚠️ Не найден псайкер-источник.");

  const targets  = [...(game.user.targets ?? [])];
  const selected = canvas.tokens?.controlled ?? [];
  const target   = targets[0]?.actor
                 ?? selected.find(t => t.actor && t.actor.id !== attackerId)?.actor
                 ?? selected[0]?.actor;
  if (!target) return ui.notifications.warn("⚠️ Отметьте или выберите токен цели!");

  await _executeSoulBurn(attacker, target);
}

// Опозный тест W+tPR×5 vs W+tPR×5. При победе псайкера — d10 непоглощаемого
// E Dmg за каждый чистый Успех, напрямую в Раны цели (минуя броню и T.b).
async function _executeSoulBurn(attacker, target) {
  const rollMode = game.settings.get("core", "rollMode");
  const allRolls = [];

  const pWp = attacker.system.characteristics?.wp?.total ?? 0;
  const pPr = attacker.system.psyker?.currentRating ?? 0;
  const pEff = pWp + 5 * pPr;

  const tWp = target.system.characteristics?.wp?.total ?? 0;
  const tPr = target.system.psyker?.currentRating ?? 0;
  const tEff = tWp + 5 * tPr;

  // Бросок псайкера
  const pRoll = await new Roll("1d100").evaluate(); allRolls.push(pRoll);
  const pRv   = pRoll.total;
  const pSucc = pRv <= pEff;
  const pDoS  = pSucc ? Math.floor((pEff - pRv) / 10) + 1 : 0;

  // Встречный бросок цели
  const tRoll = await new Roll("1d100").evaluate(); allRolls.push(tRoll);
  const tRv   = tRoll.total;
  const tSucc = tRv <= tEff;
  const tDoS  = tSucc ? Math.floor((tEff - tRv) / 10) + 1 : 0;

  // Чистые Успехи псайкера над целью
  let net = 0;
  if (pSucc) net = tSucc ? (pDoS - tDoS) : pDoS;
  const burned = net > 0;

  let dmgNote = "";
  if (burned) {
    const dRoll = await new Roll(`${net}d10`).evaluate(); allRolls.push(dRoll);
    const dmg   = dRoll.total;
    const curW  = target.system.wounds?.value    ?? 0;
    const curC  = target.system.wounds?.critical ?? 0;
    // Непоглощаемый урон напрямую в Раны (затем в Критические)
    let newW = curW, newC = curC;
    if (curW >= dmg) newW = curW - dmg;
    else { newC = curC + (dmg - curW); newW = 0; }
    await target.update({ "system.wounds.value": newW, "system.wounds.critical": newC });

    const maxW   = target.system.wounds?.max ?? 0;
    const deathThreshold = maxW + 7;   // живые: −(Макс Ран+7)
    const soulDestroyed  = newC >= deathThreshold;
    dmgNote = `
      <div class="roll-damage-section">
        <div class="roll-damage-label">${rollIcon("fire","#ff8a3a")}Непоглощаемый E урон: <b>${dmg}</b> (${net}d10 за ${net} Успех(ов))</div>
        <div class="roll-threshold">Раны: <b>${curW}</b> → <b>${newW}</b>${newC > curC ? ` | Крит. раны: <b>${newC}</b>` : ""}</div>
        ${soulDestroyed ? `<div class="roll-threshold" style="color:#8b0000;"><b>${rollIcon("skull","#ff6b6b")}Душа разорвана на куски — цель уничтожена!</b></div>` : ""}
      </div>`;
  }

  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("fire","#ff8a3a")}Выжигание Души → ${esc(target.name)}</div>
        <div class="roll-threshold">Псайкер W+tPR×5 → Порог <b>${pEff}</b> | Бросок <b>${pRv}</b>
          ${pSucc ? `<span class="roll-success">(успех, ${pDoS} ст.)</span>` : `<span class="roll-failure">(провал)</span>`}</div>
        <div class="roll-threshold">Цель W+tPR×5 → Порог <b>${tEff}</b> | Бросок <b>${tRv}</b>
          ${tSucc ? `<span class="roll-success">(успех, ${tDoS} ст.)</span>` : `<span class="roll-failure">(провал)</span>`}</div>
        <div class="roll-outcome">${burned
          ? `<span class="roll-failure">Душа выжжена — ${net} чист. Успех(ов)!</span>`
          : `<span class="roll-success">Цель устояла</span>`}</div>
        ${dmgNote}
        <details class="roll-dice-details"><summary>Показать кубы</summary>${(await Promise.all(allRolls.map(r => r.render()))).join("")}</details>
      </div>`,
    rolls: allRolls,
    sound: CONFIG.sounds.dice
  }, rollMode);
  await ChatMessage.create(messageData);
}

// ── Контекстное меню судьбы ───────────────────────────────────────────────────
function _attachFateContextMenu(message, html) {
  // Проверяем — есть ли в сообщении бросок WH (класс .wh-roll-result)
  if (!html.querySelector(".wh-roll-result")) return;

  html.addEventListener("contextmenu", async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();

    // Убираем старые меню
    document.querySelectorAll(".wh-fate-context-menu").forEach(m => m.remove());

    // Извлекаем данные броска из сообщения
    const rolls = message.rolls ?? [];
    if (rolls.length === 0) return;

    // Определяем актора — по speaker сообщения
    const speaker = message.speaker;
    let actor = null;
    if (speaker?.token) {
      const tokenDoc = canvas.tokens?.get(speaker.token)?.document
        ?? game.scenes?.active?.tokens?.get(speaker.token);
      actor = tokenDoc?.actor;
    }
    if (!actor && speaker?.actor) {
      actor = game.actors?.get(speaker.actor);
    }

    // Если актор не найден — пробуем по выделенному токену
    if (!actor) {
      actor = canvas.tokens?.controlled?.[0]?.actor;
    }

    // Очки судьбы (название зависит от персонажа: Судьба/Бесчестье/Боль)
    const fate     = actor?.system?.fate;
    const fateVal  = fate?.value ?? 0;
    const canSpend = actor && fateVal > 0;
    const ft       = fateTerm(actor?.system);

    // Строим меню
    const menu = document.createElement("div");
    menu.className = "wh-fate-context-menu";
    menu.style.cssText = `
      position: fixed;
      top: ${ev.clientY}px;
      left: ${ev.clientX}px;
      z-index: 10000;
      background: #0a1c12;
      border: 1px solid #2f9e6a;
      border-radius: 4px;
      box-shadow: 0 0 14px rgba(0,0,0,0.6), 0 0 7px rgba(47,158,106,0.3);
      min-width: 230px;
      font-family: inherit;
      overflow: hidden;
    `;

    // Заголовок
    const header = document.createElement("div");
    header.style.cssText = `
      background: linear-gradient(180deg, #0e3a26, #04100a);
      color: #c6ffe0;
      padding: 6px 10px;
      font-size: 0.74em;
      font-weight: bold;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      border-bottom: 1px solid #2f9e6a;
    `;
    header.textContent = `${ft.plural}${actor ? ` — ${actor.name}` : ""}`;
    menu.appendChild(header);

    // Кнопка: Потратить судьбу — переброс
    const btnReroll = _makeFateMenuItem(
      `Переброс (${ft.word}: ${fateVal})`,
      canSpend,
      !canSpend ? (actor ? `Нет ${ft.plural}` : "Актор не найден") : ""
    );
    menu.appendChild(btnReroll);

    // Кнопка: Потратить судьбу — +10
    const btnBonus = _makeFateMenuItem(
      `Добавить +10 (${ft.word}: ${fateVal})`,
      canSpend,
      !canSpend ? (actor ? `Нет ${ft.plural}` : "Актор не найден") : ""
    );
    menu.appendChild(btnBonus);

    document.body.appendChild(menu);

    // Закрытие по клику вне меню
    const closeMenu = () => {
      menu.remove();
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("contextmenu", closeMenu);
    };
    setTimeout(() => {
      document.addEventListener("click", closeMenu);
      document.addEventListener("contextmenu", closeMenu);
    }, 50);

    // ── Переброс ──────────────────────────────────────────────────────────
    btnReroll.addEventListener("click", async (ev2) => {
      ev2.stopPropagation();
      menu.remove();
      document.removeEventListener("click", closeMenu);

      if (!canSpend) return;

      // Тратим очко судьбы
      await actor.update({ "system.fate.value": fateVal - 1 });

      // Если это была атака — повторяем атаку целиком (новый бросок d100,
      // место попадания, урон, кнопки защиты), а не «голый» переброс.
      const atk = message.flags?.["warhammer-dbc"]?.attack;
      if (atk) {
        const atkActor = game.actors?.get(atk.actorId) ?? actor;
        const atkItem  = atkActor?.items?.get(atk.itemId);
        if (atkItem) {
          await _executeAttackRoll(atkActor, atkItem, atk.charKey, atk.threshold,
            atk.rofMode, atk.aimTarget, { ...(atk.opts || {}), skipAmmo: true });
          ui.notifications.info(
            `✨ ${actor.name} тратит ${ft.one} на переброс атаки! Осталось: ${fateVal - 1}`);
          return;
        }
      }

      // Перебрасываем все кости из сообщения
      const roll = rolls[0];
      if (!roll) return;

      // Строим новый бросок с той же формулой
      const newRoll = new Roll(roll.formula);
      await newRoll.evaluate();

      const rollMode = game.settings.get("core", "rollMode");

      // Читаем старый контент и строим новый
      const oldContent = html.querySelector(".wh-roll-result")?.innerHTML ?? "";

      // Извлекаем порог из старого сообщения
      const thresholdMatch = message.content.match(/Порог.*?<b>(\d+)<\/b>/);
      const threshold = thresholdMatch ? parseInt(thresholdMatch[1]) : null;

      const rv  = newRoll.total;
      const hit = threshold !== null ? rv <= threshold : null;
      const deg = threshold !== null
        ? Math.floor(Math.abs(rv - threshold) / 10) + 1
        : null;

      let outcomeHtml = `<div class="roll-dice">Новый бросок: <b>${rv}</b></div>`;
      if (threshold !== null && hit !== null) {
        outcomeHtml += hit
          ? `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span></div>`
          : `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span></div>`;
      }

      const newMessageData = ChatMessage.applyRollMode({
        speaker: message.speaker,
        content: `
          <div class="wh-roll-result">
            <div class="roll-header">Переброс за ${ft.one}</div>
            <div class="roll-damage-meta">
              ${ft.word} потрачена (осталось: ${fateVal - 1})
            </div>
            ${threshold !== null
              ? `<div class="roll-threshold">Порог: <b>${threshold}</b></div>`
              : ""}
            ${outcomeHtml}
          </div>`,
        rolls: [newRoll],
        sound: CONFIG.sounds.dice
      }, rollMode);

      await ChatMessage.create(newMessageData);

      ui.notifications.info(
        `✨ ${actor.name} тратит ${ft.one} на переброс! Осталось: ${fateVal - 1}`
      );
    });

    // ── +10 к броску ──────────────────────────────────────────────────────
    btnBonus.addEventListener("click", async (ev2) => {
      ev2.stopPropagation();
      menu.remove();
      document.removeEventListener("click", closeMenu);

      if (!canSpend) return;

      // Тратим очко судьбы
      await actor.update({ "system.fate.value": fateVal - 1 });

      const roll = rolls[0];
      if (!roll) return;

      const oldRv = roll.total;

      // Если это была атака — повторяем атаку целиком с улучшенным на 10
      // броском (меньше = лучше), сохраняя место попадания/урон/защиту.
      const atkB = message.flags?.["warhammer-dbc"]?.attack;
      if (atkB) {
        const atkActor = game.actors?.get(atkB.actorId) ?? actor;
        const atkItem  = atkActor?.items?.get(atkB.itemId);
        if (atkItem) {
          await _executeAttackRoll(atkActor, atkItem, atkB.charKey, atkB.threshold,
            atkB.rofMode, atkB.aimTarget,
            { ...(atkB.opts || {}), forcedRoll: Math.max(1, oldRv - 10), skipAmmo: true });
          ui.notifications.info(
            `➕ ${actor.name} тратит ${ft.one}: +10 к атаке! Осталось: ${fateVal - 1}`);
          return;
        }
      }

      // Извлекаем порог из сообщения
      const thresholdMatch = message.content.match(/Порог.*?<b>(\d+)<\/b>/);
      const threshold = thresholdMatch ? parseInt(thresholdMatch[1]) : null;

      // Новый результат = старый − 10 (бросок стал лучше на 10)
      // В d100 меньше = лучше, поэтому вычитаем 10
      const newRv   = Math.max(1, oldRv - 10);
      const rollMode = game.settings.get("core", "rollMode");

      const hit = threshold !== null ? newRv <= threshold : null;
      const deg = threshold !== null
        ? Math.floor(Math.abs(newRv - threshold) / 10) + 1
        : null;

      let outcomeHtml = `
        <div class="roll-dice">
          Старый бросок: <b>${oldRv}</b> → Новый: <b>${newRv}</b>
          <span style="font-size:0.82em;color:#3a7a3a;">(−10)</span>
        </div>`;
      if (threshold !== null && hit !== null) {
        outcomeHtml += hit
          ? `<div class="roll-outcome"><span class="roll-success">Успех — ${deg} ${_degWord(deg)}</span></div>`
          : `<div class="roll-outcome"><span class="roll-failure">Провал — ${deg} ${_degWord(deg)}</span></div>`;
      }

      // Создаём фиктивный ролл с нужным значением для записи
      const fakeRoll = new Roll(`${newRv}`);
      await fakeRoll.evaluate();

      const newMessageData = ChatMessage.applyRollMode({
        speaker: message.speaker,
        content: `
          <div class="wh-roll-result">
            <div class="roll-header">+10 за ${ft.one}</div>
            <div class="roll-damage-meta">
              ${ft.word} потрачена (осталось: ${fateVal - 1})
            </div>
            ${threshold !== null
              ? `<div class="roll-threshold">Порог: <b>${threshold}</b></div>`
              : ""}
            ${outcomeHtml}
          </div>`,
        rolls: [fakeRoll],
        sound: CONFIG.sounds.dice
      }, rollMode);

      await ChatMessage.create(newMessageData);

      ui.notifications.info(
        `✨ ${actor.name} тратит ${ft.one} на +10! Осталось: ${fateVal - 1}`
      );
    });
  });
}

// ── Вспомогательные функции ───────────────────────────────────────────────────
function _makeFateMenuItem(label, enabled, tooltip = "") {
  const item = document.createElement("div");
  item.style.cssText = `
    padding: 8px 12px;
    font-size: 0.9em;
    cursor: ${enabled ? "pointer" : "not-allowed"};
    color: ${enabled ? "#d8ffe8" : "#5a7a68"};
    border-top: 1px solid rgba(47,158,106,0.3);
    transition: background 0.1s;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  item.textContent = label;
  if (tooltip) item.title = tooltip;
  if (enabled) {
    item.addEventListener("mouseenter", () => {
      item.style.background = "rgba(77,255,166,0.1)";
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "";
    });
  }
  return item;
}

function _degWord(n) {
  if (n === 1) return "степень";
  if (n >= 2 && n <= 4) return "степени";
  return "степеней";
}

// ── Красивое сообщение инициативы ────────────────────────────────────────
  Hooks.on("createChatMessage", (message) => {
    // Foundry сам создаёт сообщение при броске инициативы
    // Нам не нужно дублировать — стандартное сообщение достаточно
  });