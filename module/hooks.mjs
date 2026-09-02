import { _performDodge, _performParry, _performSprayCancel, COUNTER_ATTACK_CAPABILITY } from "./combat/defense.mjs";
import { performPoolSpend }              from "./combat/evasion-pool.mjs";
import { showRecoilDialog, performRecoil } from "./combat/recoil.mjs";
import { _executeAttackRoll }           from "./combat/attack.mjs";
import { _executeFearRoll, FAITH_FLAG, rollShockRecovery } from "./combat/fear.mjs";
import { isRuleUsageUsed, markRuleUsageUsed,
         isRoundCapabilityAvailable, markRoundCapabilityUsed } from "./apps/game-session.mjs";
import { fatePoolLabel }                 from "./rules/fate-save.mjs";
import { spendFromInfamyPool }           from "./apps/infamy-points.mjs";
import { tempInfamyAmount }              from "./rules/temp-infamy.mjs";
import { applyWoundLoss, woundDeathThreshold } from "./rules/wounds.mjs";
import { fateBonusOutcome, FATE_BONUS }  from "./rules/fate-bonus.mjs";
import { showApplyDamageDialog, applyDamageToActor, extractPiercingWound, applyCripplingTrigger, applyMonofilamentHit } from "./combat/damage.mjs";
import { rollPacifismTest } from "./combat/pacifism.mjs";
import { rollHordePsychTest }            from "./combat/horde-psych.mjs";
import { ROUND_DAMAGE_FLAG }             from "./combat/horde-damage.mjs";
import { _performSwerve, applyStructureLoss } from "./combat/vehicle.mjs";
import { maybeGrantEnjoymentPain }       from "./combat/enjoyment.mjs";
import { saddleTest, applyFall, showMountedDodgeDialog, resolveHitAllocation } from "./combat/mount.mjs";
import { CONDITION_LEVEL_FIELD, resolveWeaponPropsList, aggregateAuto, hasWeaponPropertyImmunity } from "./combat/weapon-properties.mjs";
import { rollSuppressionTest, rollSuppressionRecovery, postSuppressionRecoveryPrompt } from "./combat/suppression.mjs";
import { resolveFreeAttackClick } from "./combat/free-attack.mjs";
import { resolveAssassinStrikeClick } from "./combat/assassin-strike.mjs";
import { processPrismaTurnStart } from "./combat/prisma.mjs";
import { processWitchsEdgeCombatStart } from "./combat/witchs-edge.mjs";
import { processSpiritTalkRoundStart } from "./combat/spirit-talk.mjs";
import { getModEffects, mergeWeaponPropEntries } from "./combat/weapon-mods.mjs";
import { fateTerm, esc }                 from "./helpers/utils.mjs";
import { rollIcon }                      from "./constants/roll-icons.mjs";
import { registerActorSetupHook }        from "./apps/actor-setup.mjs";
import { resolvePendingSusAnHeals }      from "./apps/sus-an-heal.mjs";
import { resolveTrancesForCombat }       from "./apps/armour-history-trance.mjs";
import { syncDisabledArmourOverloadTimer, promptDisabledArmourForkTest } from "./combat/armor-mods.mjs";
import { blastCircleShape, sprayConeShape, placeAttackTemplate, targetTokens, pxPerMeter } from "./combat/templates.mjs";
import { triggerBlastAnimation } from "./integrations/autoanimations.mjs";
import { placeLingerZone, processShooterTurnStart, clearAllLingerZones } from "./regions/linger-zone.mjs";
import { placeGravitonZone, processGravitonShooterTurnStart, clearAllGravitonZones } from "./regions/graviton-zone.mjs";
import { placeSmokeZone } from "./regions/difficult-terrain.mjs";
import { findArcTarget } from "./combat/arc.mjs";
import { findThroughShotTarget } from "./combat/through-shot.mjs";
import { resetActionEconomy, applyTurnEndStanceEffects, postTurnStartCard } from "./combat/action-economy.mjs";
import { clearDreadWailWeaponBuff } from "./combat/dread-wail.mjs";
import { clearAvatarOfSlaughterMarks } from "./combat/avatar-of-slaughter.mjs";
import { clearSongOfSwiftnessBuffs } from "./combat/song-of-swiftness.mjs";
import { clearReformationSongBuffs, clearExpiredGearMalfunction } from "./combat/reformation-song.mjs";
import { recalcAllAdvanceCosts } from "./sheets/tabs/advance.mjs";
import { absorbPainDamage } from "./sheets/tabs/pain.mjs";
import { processConditionTurnStart, processConditionTurnEnd } from "./combat/condition-ticks.mjs";
import { processAblativeWoundsTurnStart } from "./combat/ablative-wounds.mjs";
import { applyCritEffectPill } from "./combat/crit-effect-parser.mjs";
import { showHerdSpiritsAllocationDialog } from "./apps/herd-spirits-summon.mjs";
import { clearBeastmanShamanTempEffects, clearHexMarkedPreyMarks } from "./combat/beastman-shaman.mjs";
import { resolveShipProps } from "./combat/ship-attack.mjs";
import { resolveNodeDamage, applyHullDamage } from "./combat/ship-node-damage.mjs";
import { WC_CODE } from "./constants/ship.mjs";

// Последний обработанный ходящий на Combat.id — экономика действий (см. блок
// updateCombat ниже) сама отслеживает, чей Ход только что закончился.
const _lastTurnCombatant = new Map();

/** Актор выбранного на сцене токена, или предупреждение и null (нет выбора). */
function requireControlledActor(warnMsg) {
  const actor = canvas.tokens?.controlled?.[0]?.actor;
  if (!actor) ui.notifications.warn(warnMsg);
  return actor || null;
}

export function registerHooks() {

  // ── Вариации существ бестиария ───────────────────────────────────────────
  // Диалог выбора версии при создании актора В МИРЕ (см. apps/actor-setup.mjs).
  registerActorSetupHook();

  // ── Обработчики кнопок в чате ────────────────────────────────────────────
  Hooks.on("renderChatMessageHTML", (message, html, data) => {

    // Состояние, наложенное Ритуалом (module/apps/ritual-cast.mjs) — пилюля
    // в карточке успешного проведения; ГМ тащит её на лист актора, которому
    // она принадлежит (module/sheets/actor-sheet.mjs, _onDrop).
    html.querySelectorAll(".wh-cond-drag").forEach(pill => {
      pill.addEventListener("dragstart", ev => {
        ev.dataTransfer.setData("text/plain", pill.dataset.payload);
        ev.dataTransfer.effectAllowed = "copy";
      });
    });

    // Уклонение
    html.querySelectorAll(".wh-dodge-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actor = requireControlledActor("⚠️ Выберите токен защищающегося персонажа на сцене!");
        if (!actor) return;
        const extraMod = parseInt(ev.currentTarget.dataset.extraMod || "0");
        const hitsCount = parseInt(ev.currentTarget.dataset.hitsCount || "1");
        const attackerUuid = ev.currentTarget.dataset.attackerUuid || "";
        if (!await confirmHordeDefense(actor, "Уклонение")) return;
        // Верхом Уклонение устроено иначе: за скакуна оно комбинируется с
        // Навыком управления, за себя — идёт с −10 (стр. 478). Кнопка в
        // карточке одна, а знает о седле только сама цель, поэтому развилка
        // здесь: карточка на момент броска ещё не знает, в кого попадут.
        if (actor.system?.mount?.uuid) {
          const handled = await showMountedDodgeDialog(actor, extraMod, hitsCount, attackerUuid);
          if (handled !== null) return;
        }
        await _performDodge(actor, extraMod,
          ev.currentTarget.dataset.forceReroll || "", hitsCount, attackerUuid,
          ev.currentTarget.dataset.melee === "1");
      });
    });

    // Отскок (стр. 12, wdbc-9wvm): кнопка приклеена к карточке успешного
    // Уклонения от стрелковой атаки (defense.mjs::_performDodge) — актор
    // берётся по uuid из data-actor-uuid (тот же приём, что у контратаки:
    // отскакивает тот, кто уклонился, а не выбранный сейчас токен).
    html.querySelectorAll(".wh-recoil-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actorUuid = ev.currentTarget.dataset.actorUuid
          || ev.currentTarget.closest(".wh-roll-result")?.dataset.actorUuid;
        const actor = actorUuid ? (await fromUuid(actorUuid).catch(() => null)) : null;
        if (!actor) return ui.notifications.warn("⚠️ Уклонившийся персонаж карточки не найден.");
        const choice = await showRecoilDialog(actor);
        if (!choice) return;
        await performRecoil(actor, choice);
      });
    });

    // Тест на отмену попадания Распыления (wdbc-p06s, свойство Spray, стр.
    // 166-170) — по образцу wh-dodge-btn: актор берётся с выбранного на
    // сцене токена защищающегося, а не из карточки (шаблон может отметить
    // несколько токенов, кнопка одна на всех — жмётся по разу за токен).
    html.querySelectorAll(".wh-spray-cancel-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actor = requireControlledActor("⚠️ Выберите токен защищающегося персонажа на сцене!");
        if (!actor) return;
        await _performSprayCancel(actor);
      });
    });

    // Призыв Духов Стада (wdbc-xxb7) — кнопка карточки успешного проведения
    // Ритуала «Summon Herd Spirits» (module/apps/ritual-cast.mjs); сам диалог
    // распределения (module/apps/herd-spirits-summon.mjs) GM-only внутри себя.
    html.querySelectorAll(".wh-herd-spirits-btn").forEach(btn => {
      btn.addEventListener("click", async ev => {
        ev.preventDefault();
        const el = ev.currentTarget;
        const actor = await fromUuid(el.dataset.actorUuid).catch(() => null);
        if (!actor) { ui.notifications?.warn("Ритуалист не найден."); return; }
        const successes = parseInt(el.dataset.successes) || 0;
        await showHerdSpiritsAllocationDialog(actor, successes, { ritualistUuid: actor.uuid });
      });
    });

    // Парирование
    html.querySelectorAll(".wh-parry-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actor = requireControlledActor("⚠️ Выберите токен защищающегося персонажа на сцене!");
        if (!actor) return;
        const extraMod = parseInt(ev.currentTarget.dataset.extraMod || "0");
        const hitsCount = parseInt(ev.currentTarget.dataset.hitsCount || "1");
        if (!await confirmHordeDefense(actor, "Парирование")) return;
        await _performParry(actor, extraMod,
          ev.currentTarget.dataset.attackerUuid || "", hitsCount);
      });
    });

    // Контратака (стр. 12, Талант Counter Attack): успешное Парирование
    // предлагает тут же ударить в ответ тем же оружием — по выбору игрока.
    // Раз-в-Раунд метится в момент клика (не после броска): открывшийся
    // диалог всё равно можно отменить, но сама попытка уже потрачена — тот же
    // компромисс, что у кнопок Уклонения/Парирования, которые тоже не
    // «отменяются» после клика.
    html.querySelectorAll(".wh-counter-attack-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        // Кнопка запоминается ДО первого await: currentTarget живёт только
        // пока событие обрабатывается синхронно (см. wh-saddle-btn ниже).
        const el = ev.currentTarget;
        // Актор — из data-actor-uuid карточки парирования (его кладёт
        // _performParry), а не из выбранного токена: контратакует тот, кто
        // парировал, и промах мышью по чужому токену тут ничего не решает.
        const cardUuid = el.closest(".wh-roll-result")?.dataset.actorUuid;
        const actor = cardUuid ? (await fromUuid(cardUuid).catch(() => null)) : null;
        if (!actor) {
          return ui.notifications.warn("⚠️ Парировавший персонаж карточки не найден.");
        }
        const weapon = actor.items.get(el.dataset.weaponId);
        if (!weapon) return ui.notifications.warn("⚠️ Оружие Контратаки не найдено на листе.");
        if (!isRoundCapabilityAvailable(actor, COUNTER_ATTACK_CAPABILITY)) {
          return ui.notifications.warn("⚠️ Контратака уже потрачена в этом Раунде.");
        }
        await markRoundCapabilityUsed(actor, COUNTER_ATTACK_CAPABILITY);

        // Целимся в того, кого парировали, если его токен ещё на сцене —
        // без этого диалог атаки просто откроется без автоматического
        // расчёта защиты цели (как «Бросок без цели»). Старые цели сбрасываем
        // в любом случае: контратака не должна бить по цели прошлой атаки.
        const attackerUuid = el.dataset.attackerUuid;
        if (attackerUuid) {
          const attackerActor = (await fromUuid(attackerUuid).catch(() => null));
          const token = canvas.tokens?.placeables?.find(t => t.actor?.uuid === attackerActor?.uuid);
          game.user.targets.forEach(t => t.setTarget(false, { user: game.user, releaseOthers: false }));
          token?.setTarget(true, { user: game.user, releaseOthers: true });
        }
        // forceBase: Контратака — атака со штрафом −10 с нейтральной Базой,
        // персистентная «Полная Атака» (+30) сюда протекать не должна.
        // Дуэлянтское (+10 к таланту Counter Attack, стр. 73 Книги Аэльдари)
        // снимает этот штраф целиком.
        const cwProps    = resolveWeaponPropsList(mergeWeaponPropEntries(weapon, getModEffects(actor, weapon)));
        const counterMod = aggregateAuto(cwProps).duelingParry ? 0 : -10;
        await actor.sheet._showAttackDialog?.(weapon, { modifier: counterMod, forceBase: "standard" });
      });
    });

    // Вираж (реакция техники — как Уклонение, но Operate − Размер×10)
    html.querySelectorAll(".wh-swerve-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actor = requireControlledActor("⚠️ Выберите токен машины на сцене!");
        if (!actor) return;
        const extraMod = parseInt(ev.currentTarget.dataset.extraMod || "0");
        const hitsCount = parseInt(ev.currentTarget.dataset.hitsCount || "1");
        const attackerUuid = ev.currentTarget.dataset.attackerUuid || "";
        await _performSwerve(actor, extraMod, hitsCount, attackerUuid);
      });
    });

    // Пул Избегания (стр. 12): траты неизрасходованных Успехов с прошлой
    // успешной защиты того же противника в этом Ходу — без броска и без
    // Реакции, module/combat/evasion-pool.mjs.
    html.querySelectorAll(".wh-pool-spend-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actor = requireControlledActor("⚠️ Выберите токен защищающегося персонажа на сцене!");
        if (!actor) return;
        const el = ev.currentTarget;
        await performPoolSpend(actor, {
          attackerUuid: el.dataset.attackerUuid || "",
          hitsCount: parseInt(el.dataset.hitsCount || "1"),
          dodgeMod: parseInt(el.dataset.dodgeMod || "0"),
          parryMod: parseInt(el.dataset.parryMod || "0"),
          targetIsVehicle: el.dataset.targetVehicle === "1",
          flexible: el.dataset.flexible === "1",
          forcedDefenceReroll: el.dataset.forceReroll || "",
          isMelee: el.dataset.melee === "1"
        });
      });
    });

    // Верховые тесты: удержаться в седле, переброс «Опытного Всадника» и урон
    // падения. Актор берётся не по выбранному токену, а по uuid из карточки:
    // тест удержания всегда проходит тот же всадник, чей поворот или ландшафт
    // его вызвал, и промах мышью по чужому токену тут ничего не должен решать.
    html.querySelectorAll(".wh-saddle-btn, .wh-saddle-reroll-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        // Кнопка запоминается ДО первого await: currentTarget живёт только пока
        // событие обрабатывается синхронно, а дальше он уже null.
        const el = ev.currentTarget;
        const ds = el.dataset;
        const actor = await fromUuid(ds.actorUuid).catch(() => null);
        if (!actor?.isOwner) {
          return ui.notifications.warn("Тест проходит владелец всадника (или ГМ).");
        }
        const reroll = el.classList.contains("wh-saddle-reroll-btn");
        if (reroll) el.disabled = true;
        await saddleTest(actor, {
          kind: ds.kind || "agility",
          mod: parseInt(ds.mod || "0"),
          reason: ds.reason || "",
          reroll
        });
      });
    });

    html.querySelectorAll(".wh-saddle-fall-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const el = ev.currentTarget;
        const ds = el.dataset;
        const actor = await fromUuid(ds.actorUuid).catch(() => null);
        if (!actor?.isOwner) {
          return ui.notifications.warn("Бросить урон падения может владелец всадника (или ГМ).");
        }
        el.disabled = true;
        await applyFall(actor, ds.formula || "1d10");
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

    // Блоки «только для владельца» в карточках чата: карточка одна на всех,
    // поэтому прячем их на клиенте по фактическим правам на актора.
    html.querySelectorAll(".wh-owner-only[data-actor-id]").forEach(el => {
      if (!game.actors?.get(el.dataset.actorId)?.isOwner) el.style.display = "none";
    });

    // «Абсолютная вера в прошлое» (Мир-кладбище): тратит Очко Судьбы/Бесчестья,
    // чтобы считать проваленный Страх пройденным с 1 успехом, и даёт 1 Порчи.
    // Один раз за столкновение — метка на акторе (usageLimits), её сбрасывает
    // кнопка «Новая сцена» в apps/game-session.mjs.
    html.querySelectorAll(".wh-fear-faith-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ctx = message.flags?.["warhammer-dbc"]?.faithInThePast;
        if (!ctx) return;
        const actor = game.actors?.get(ctx.actorId);
        if (!actor?.isOwner) {
          return ui.notifications.warn("Использовать может только владелец персонажа (или ГМ).");
        }
        if (isRuleUsageUsed(actor, FAITH_FLAG)) {
          return ui.notifications.warn(`«${ctx.label}» уже использована в этом столкновении.`);
        }
        const fate = Number(actor.system.fate?.value) || 0;
        if (fate <= 0 && tempInfamyAmount(actor) < 1) return ui.notifications.warn("Нет Очков Судьбы/Бесчестья.");
        ev.currentTarget.disabled = true;

        // Трата помечена whSkipFateSave: иначе её перехватила бы «Пламенная
        // вера» (Мир-храм) и Очко могло бы «не потратиться». Здесь это
        // осознанная цена способности, а не обычный расход. Временный запас
        // (wdbc-e728, Voice of God и т.п.) уходит первым.
        const spend = await spendFromInfamyPool(actor, 1, "system.fate.value");
        await actor.update({
          "system.fate.value": spend.poolValue,
          "system.corruption.value": (Number(actor.system.corruption?.value) || 0) + 1
        }, { whSkipFateSave: true });
        await markRuleUsageUsed(actor, FAITH_FLAG, "scene");

        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="wh-roll-result">
            <div class="roll-header">🕯️ ${esc(ctx.label)} — ${esc(actor.name)}</div>
            <div class="roll-outcome"><span class="roll-success">Тест Страха пройден с 1 степенью успеха</span></div>
            <div class="roll-threshold">Потрачено Очко ${fatePoolLabel(actor)} · Порча +1</div>
          </div>`
        });
      });
    });

    // «Крайне миролюбив» (Серый Человек, wdbc-gzuf) — карточка-гейт на вход в
    // Ярость до первой атаки по себе: тест Воли−20 или явный отказ.
    html.querySelectorAll(".wh-pacifism-test-btn, .wh-pacifism-refuse-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ctx = message.flags?.["warhammer-dbc"]?.pacifismGate;
        if (!ctx) return;
        const actor = game.actors?.get(ctx.actorId);
        if (!actor?.isOwner) {
          return ui.notifications.warn("Решить может только владелец персонажа (или ГМ).");
        }
        const row = ev.currentTarget.closest(".roll-defense-btns");
        row?.querySelectorAll("button").forEach(b => { b.disabled = true; });
        if (ev.currentTarget.classList.contains("wh-pacifism-test-btn")) {
          await rollPacifismTest(actor);
        } else {
          ui.notifications.info(`${actor.name} отказывается входить в Ярость.`);
        }
      });
    });

    // Применение урона
    html.querySelectorAll(".wh-apply-dmg-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        const damageData = {
          rawDamage:    parseInt(ds.damage      || "0"),
          penetration:  parseInt(ds.penetration || "0"),
          damageType:   ds.damageType  || "impact",
          hitLocation:  ds.hitLocation || "Торс",
          side:         ds.vehicleSide || "",   // сторона брони техники (из окна атаки)
          weaponName:   ds.weaponName  || "",
          attackerName: ds.attacker    || "",
          attackerUuid: ds.attackerUuid || "",
          felling:      parseInt(ds.felling || "0"),
          primitive:    ds.primitive    === "1",
          ignoreShield: ds.ignoreShield === "1",
          warpSoak:     ds.warpSoak     === "1",
          lance:        ds.lance        === "1",
          sanctified:   ds.sanctified   === "1",
          // Свойства, дающие Орде дополнительные попадания; на прочих целях
          // они не читаются и ни на что не влияют.
          blast:        parseInt(ds.blast || "0"),
          flame:        ds.flame      === "1",
          powerField:   ds.powerField === "1",
          spray:        ds.spray      === "1",
          devastating:  parseInt(ds.devastating || "0"),
          weaponRange:  parseInt(ds.weaponRange || "0"),
          melee:        ds.melee === "1",
          burst:        ds.burst === "1",
          // Corrosive/Crippling/Piercing/Haywire (wdbc-plsf) — применяются в
          // applyDamageToActor (combat/damage.mjs), где уже известны и актор,
          // и место попадания, и непоглощённый урон.
          corrosiveRating: parseInt(ds.corrosive || "0"),
          cripplingRating: parseInt(ds.crippling || "0"),
          piercing:        ds.piercing === "1",
          // Haywire(0) — валидный рейтинг («привязан к цели»), поэтому наличие
          // свойства метится пустым/непустым атрибутом, а не самим числом.
          haywireActive:   ds.haywire != null && ds.haywire !== "",
          haywireRating:   parseInt(ds.haywire || "0"),
          // Выстрел Насквозь (wdbc-wlwf): применяется в applyDamageToActor —
          // там уже известны AP цели и T.b, из которых и складывается тест
          // «пробило ли» (combat/through-shot.mjs::throughShotPierces).
          throughShot:     ds.throughShot === "1",
          // Куб(ы) Магнитуды Орды (wdbc-gzuf) — цель ещё не была известна на
          // момент броска (карточка Орды применяется позже, кнопкой), поэтому
          // эта часть урона едет отдельным числом: применяется в
          // applyDamageToActor (combat/damage.mjs), где актор-цель уже известен.
          magDiceBonus:    parseInt(ds.magDiceBonus || "0")
        };
        // «Прячась в Орде»: попадание уже расписано в Орду — цель не выбирается.
        if (ds.forceHorde) {
          const horde = await fromUuid(ds.forceHorde);
          const actor = horde?.actor ?? horde ?? null;
          if (!actor) return ui.notifications.warn("⚠️ Орда, прикрывшая цель, не найдена.");
          return applyDamageToActor(actor, damageData);
        }
        await showApplyDamageDialog(damageData);
      });
    });

    // Извлечение снаряда Проникающего (wdbc-plsf)
    html.querySelectorAll(".wh-piercing-extract-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        const actor = ds.actorUuid ? (await fromUuid(ds.actorUuid).catch(() => null)) : null;
        if (!actor) return ui.notifications.warn("⚠️ Актор не найден (возможно, удалён).");
        await extractPiercingWound(actor, ds.armorKey);
      });
    });

    // Триггер раны Калечащего — «оба ОД в Ход на физ. действия» (wdbc-plsf)
    html.querySelectorAll(".wh-crippling-trigger-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        const actor = ds.actorUuid ? (await fromUuid(ds.actorUuid).catch(() => null)) : null;
        if (!actor) return ui.notifications.warn("⚠️ Актор не найден (возможно, удалён).");
        await applyCripplingTrigger(actor, parseInt(ds.rating || "0"), ds.location || "");
      });
    });

    // Поглощение варп-урона Болью (Друкхари, wdbc-7as8) — число уже в карточке
    // атаки (тот же data-damage, что у соседней «Применить урон»), не нужно
    // перепечатывать его в диалог openPainSoulBurnDialog руками.
    html.querySelectorAll(".wh-pain-absorb-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actor = requireControlledActor("⚠️ Выберите токен персонажа, поглощающего урон Болью!");
        if (!actor) return;
        if (!actor.system?.painActive) {
          return ui.notifications.warn("⚠️ У выбранного персонажа нет Очков Боли (Через Боль).");
        }
        await absorbPainDamage(actor, parseInt(ev.currentTarget.dataset.damage || "0"));
      });
    });

    // Верховое попадание (wdbc-7as8) — бросок атаки уже в карточке, кнопка
    // передаёт его в resolveHitAllocation вместо ручного «по коню/по всаднику».
    html.querySelectorAll(".wh-mount-hit-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actor = requireControlledActor("⚠️ Выберите токен цели верхом на сцене!");
        if (!actor) return;
        if (!actor.system?.mount?.uuid) {
          return ui.notifications.warn("⚠️ Выбранный персонаж не верхом.");
        }
        await resolveHitAllocation(actor, ev.currentTarget.dataset.roll);
      });
    });

    // Шаблон зоны поражения (Взрывное/Распыление) — размещение мышью
    // (module/combat/templates.mjs). Без Linger — разовый эфемерный Region:
    // накрытые токены становятся целями, дальше «Применить урон» → «Всем»
    // как обычно. С Linger (data-linger) — персистентный Region с зоной
    // «Остаётся» (module/regions/linger-zone.mjs): попадание применяется
    // САМО, на каждого впервые-за-ход внутри, следующие N раундов — ничего
    // больше нажимать не нужно.
    html.querySelectorAll(".wh-place-template-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        const meters = parseFloat(ds.meters) || 0;
        if (meters <= 0) return ui.notifications.warn("⚠️ У оружия не задан радиус/дальность зоны.");
        const px = pxPerMeter();
        const shape = ds.shape === "cone" ? sprayConeShape(meters, px) : blastCircleShape(meters, px);

        const rounds = parseInt(ds.linger || "0") || 0;
        if (rounds > 0) {
          if (!game.combat) return ui.notifications.warn("⚠️ Зона «Остаётся» отсчитывает раунды боя — начните бой.");
          const damageData = {
            rawDamage:    parseInt(ds.damage      || "0"),
            penetration:  parseInt(ds.penetration || "0"),
            damageType:   ds.damageType  || "impact",
            hitLocation:  ds.hitLocation || "Торс",
            weaponName:   ds.weaponName  || "",
            attackerName: ds.attacker    || "",
            attackerUuid: ds.attackerUuid || "",
            // itemUuid — не для applyDamageToActor (её не читает), а чтобы
            // LingerZoneBehaviorType мог звать Automated Animations на каждое
            // попадание зоны (module/regions/linger-zone.mjs).
            itemUuid:     ds.itemUuid || "",
            felling:      parseInt(ds.felling || "0"),
            primitive:    ds.primitive    === "1",
            ignoreShield: ds.ignoreShield === "1",
            warpSoak:     ds.warpSoak     === "1",
            lance:        ds.lance        === "1",
            sanctified:   ds.sanctified   === "1",
            powerField:   ds.powerField   === "1",
            corrosiveRating: parseInt(ds.corrosive || "0"),
            cripplingRating: parseInt(ds.crippling || "0"),
            piercing:        ds.piercing === "1",
            haywireActive:   ds.haywire != null && ds.haywire !== "",
            haywireRating:   parseInt(ds.haywire   || "0"),
            throughShot:     ds.throughShot === "1"
          };
          const drift = parseFloat(ds.lingerDrift || "0") || 0;
          const region = await placeLingerZone(shape, damageData, rounds, drift, ds.weaponName || "Остаётся");
          if (!region) return; // ГМ отменил размещение (ПКМ)
          ui.notifications.info(`Зона «Остаётся» размещена на ${rounds} ход(а/ов) стрелка`
            + `${drift > 0 ? ` — дрейфует на ${drift}м каждый ход` : ""} — попадание применяется автоматически.`);
          return;
        }

        // Гравитонное (wdbc-wlwf) — персистентная зона, что тает 1м/ход
        // стрелка + Трудный Ландшафт−30 (module/regions/graviton-zone.mjs).
        // Начальное попадание — как у обычного Взрывного: накрытые токены
        // становятся целями, дальше «Применить урон» → «Всем» вручную.
        if (ds.graviton === "1") {
          if (!game.combat) return ui.notifications.warn("⚠️ Гравитонная зона отсчитывает раунды боя — начните бой.");
          const result = await placeGravitonZone(shape, meters, ds.attackerUuid || "", ds.weaponName || "Гравитонное");
          if (!result) return; // ГМ отменил размещение (ПКМ)
          if (result.tokens.length) targetTokens(result.tokens);
          ui.notifications.info(result.tokens.length
            ? `Отмечено целей: ${result.tokens.length}. Дальше — «Применить урон» → «Всем».`
            : "В зоне шаблона никого нет.");
          triggerBlastAnimation({
            attackerUuid: ds.attackerUuid, itemUuid: ds.itemUuid,
            tokens: result.tokens, region: result.region
          });
          return;
        }

        const result = await placeAttackTemplate(shape, ds.weaponName || "Зона поражения");
        if (!result) return; // ГМ отменил размещение (ПКМ)
        if (!result.tokens.length) {
          ui.notifications.info("В зоне шаблона никого нет.");
          return;
        }
        targetTokens(result.tokens);
        ui.notifications.info(`Отмечено целей: ${result.tokens.length}. Дальше — «Применить урон» → «Всем».`);
        triggerBlastAnimation({
          attackerUuid: ds.attackerUuid, itemUuid: ds.itemUuid,
          tokens: result.tokens, region: result.region
        });
      });
    });

    // Дымовая завеса (свойство Smoke, wdbc-wlwf) — не накрывает целей, просто
    // включает готовую галочку «Дым» Трудного Ландшафта на новой зоне
    // (module/regions/difficult-terrain.mjs::placeSmokeZone).
    html.querySelectorAll(".wh-place-smoke-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        const meters = parseFloat(ds.meters) || 0;
        if (meters <= 0) return ui.notifications.warn("⚠️ У оружия не задан радиус дымовой завесы.");
        const shape = blastCircleShape(meters, pxPerMeter());
        const region = await placeSmokeZone(shape, ds.weaponName || "Дым");
        if (!region) return; // ГМ отменил размещение (ПКМ)
      });
    });

    // Дуга (свойство Arc, wdbc-wlwf) — ГМ выбирает (control) уже поражённый
    // токен на сцене, скрипт ищет ближайшего ДРУГОГО в 5м (кроме самого
    // стрелка) и сразу применяет к нему Y(El) Dmg, Pen Y (module/combat/arc.mjs).
    html.querySelectorAll(".wh-arc-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        const primaryToken = canvas.tokens?.controlled?.[0];
        if (!primaryToken?.actor) return ui.notifications.warn("⚠️ Выберите токен поражённой цели на сцене!");
        const attackerToken = ds.attackerUuid
          ? (await fromUuid(ds.attackerUuid).catch(() => null))?.getActiveTokens?.(true)?.[0] : null;
        const candidates = canvas.tokens.placeables.filter(t => t !== primaryToken && t !== attackerToken);
        const target = findArcTarget(primaryToken, candidates, 5);
        if (!target?.actor) return ui.notifications.info("⚡ В радиусе 5м от цели никого нет — Дуга не сработала.");
        const arcDamage = parseInt(ds.arcDamage || "0");
        await applyDamageToActor(target.actor, {
          rawDamage: arcDamage, penetration: arcDamage, damageType: "energy", hitLocation: "Торс",
          weaponName: ds.weaponName || "", attackerName: ds.attacker || "", attackerUuid: ds.attackerUuid || ""
        });
        ui.notifications.info(`⚡ Дуга поразила ${target.name}.`);
      });
    });

    // Выстрел Насквозь (wdbc-wlwf) — пробитие уже определено (damage.mjs),
    // здесь только геометрия «следующей цели по линии огня»
    // (module/combat/through-shot.mjs::findThroughShotTarget): находит и
    // сразу отмечает целью, дальше новый бросок урона (со снижением) и
    // «Применить урон» — вручную, как и раньше.
    html.querySelectorAll(".wh-through-shot-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        const attackerToken = ds.attackerUuid
          ? (await fromUuid(ds.attackerUuid).catch(() => null))?.getActiveTokens?.(true)?.[0] : null;
        const targetActor  = ds.targetUuid ? await fromUuid(ds.targetUuid).catch(() => null) : null;
        const targetToken  = targetActor?.getActiveTokens?.(true)?.[0];
        if (!attackerToken || !targetToken) {
          return ui.notifications.warn("⚠️ Нет токена стрелка или пробитой цели на сцене — геометрию посчитать не из чего.");
        }
        const candidates = canvas.tokens.placeables.filter(t => t.actor && t !== attackerToken && t !== targetToken);
        const next = findThroughShotTarget(attackerToken, targetToken, candidates);
        if (!next) return ui.notifications.info("🎯 Позади цели по линии огня никого нет.");
        canvas.tokens.setTargets([next.id]);
        ui.notifications.info(`🎯 Выстрел Насквозь: следующая цель — ${next.name}. Бросьте урон со снижением и примените обычной кнопкой.`);
      });
    });

    // Психологический тест Орды: массивные потери, Страх, Запугивание.
    html.querySelectorAll(".wh-horde-psych-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        const horde = game.actors.get(ds.hordeId);
        if (!horde) return ui.notifications.warn("⚠️ Орда не найдена.");
        await rollHordePsychTest(horde, ds.kind || "massDamage",
          { mod: parseInt(ds.mod || "0") });
      });
    });

    // Применение эффектов особых свойств оружия к цели
    html.querySelectorAll(".wh-wprop-apply-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await _applyWeaponPropEffect(ev.currentTarget.dataset);
      });
    });

    // Пилюли распознанных крит-эффектов/Шока (wdbc-xql6) — цель уже известна
    // по data-actor-uuid (та же, что несла карточку урона/теста Страха),
    // поэтому в отличие от wh-wprop-apply-btn выше не нужен выбор токена.
    html.querySelectorAll(".wh-crit-apply-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const el = ev.currentTarget;
        const ds = el.dataset;
        const actor = await fromUuid(ds.actorUuid).catch(() => null);
        if (!actor?.isOwner) {
          return ui.notifications.warn("Наложить состояние может владелец цели (или ГМ).");
        }
        el.disabled = true;
        await applyCritEffectPill(actor, {
          key: ds.condKey, formula: ds.formula || null, permanent: ds.permanent === "1"
        });
      });
    });

    // Тест на Подавление (Стрельба на подавление, стр. 32-33) — по выбранному
    // токену цели, штраф уже посчитан (RoF + Импульсное) в attack.mjs.
    html.querySelectorAll(".wh-suppression-test-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const actor = requireControlledActor("⚠️ Выберите токен цели на сцене!");
        if (!actor) return;
        const mod = parseInt(ev.currentTarget.dataset.testMod || "0");
        await rollSuppressionTest(actor, { mod, sourceLabel: "Стрельба на подавление" });
      });
    });
    html.querySelectorAll(".wh-suppression-recovery-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        const actor = ds.actorUuid ? (await fromUuid(ds.actorUuid).catch(() => null)) : null;
        if (!actor) return ui.notifications.warn("⚠️ Подавленный персонаж не найден.");
        await rollSuppressionRecovery(actor, { bonus: parseInt(ds.bonus || "0") });
      });
    });
    html.querySelectorAll(".wh-shock-recovery-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        const actor = ds.actorUuid ? (await fromUuid(ds.actorUuid).catch(() => null)) : null;
        if (!actor) return ui.notifications.warn("⚠️ Шокированный персонаж не найден.");
        ev.currentTarget.disabled = true;
        await rollShockRecovery(actor);
      });
    });

    // Свободная атака (wdbc-2xku) — уходящий из рукопашной без «Выхода из Боя».
    html.querySelectorAll(".wh-free-attack-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ds = ev.currentTarget.dataset;
        await resolveFreeAttackClick(ds.reactorUuid, ds.moverUuid);
      });
    });

    // Удар Ассасина (wdbc-qpcg) — раз в Раунд после рукопашной атаки: Acrobatics+0 → Полудвижение свободным действием
    html.querySelectorAll(".wh-assassin-strike-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await resolveAssassinStrikeClick(ev.currentTarget.dataset.attackerUuid);
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

    // Забирающее жизни (Lifetaker): урон CP кораблю-цели — жмёт тот, у кого
    // есть права на цель (обычно ГМ), сама карточка атаки прав не требует.
    html.querySelectorAll(".wh-ship-cp-btn").forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const cpDmg = parseInt(ev.currentTarget.dataset.cp || "0");
        if (!cpDmg) return;
        const targeted = [...(game.user?.targets ?? [])].map(t => t.actor ?? t.document?.actor).find(a => a?.type === "ship");
        const selected = (canvas.tokens?.controlled ?? []).map(t => t.actor).find(a => a?.type === "ship");
        const actor = targeted || selected;
        if (!actor) return ui.notifications.warn("⚠️ Отметьте или выберите токен корабля-цели!");
        const cpNow = Number(actor.system.crew?.population) || 0;
        await actor.update({ "system.crew.population": Math.max(0, cpNow - cpDmg) });
        ui.notifications.info(`${actor.name}: Забирающее жизни — CP ${cpNow} → ${Math.max(0, cpNow - cpDmg)}`);
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
// Сама формула (HI + пропорциональный CP/CM) — module/combat/ship-node-damage.mjs
// ::applyHullDamage, общая с авто-взрывом Explosive (wdbc-qhwb).
async function _applyShipHullDamage(dmg) {
  const targeted = [...(game.user?.targets ?? [])]
    .map(t => t.actor ?? t.document?.actor).find(a => a?.type === "ship");
  const selected = (canvas.tokens?.controlled ?? [])
    .map(t => t.actor).find(a => a?.type === "ship");
  const actor = targeted || selected;
  if (!actor) return ui.notifications.warn("⚠️ Отметьте (target) или выберите токен корабля-цели!");

  const { cur, next, lost } = await applyHullDamage(actor, dmg);
  const half = next === 0 ? " — ПОЛУРАЗРУШЕН!" : "";
  ui.notifications.info(`${actor.name}: Прочность ${cur} → ${next} (−${Number(dmg) || 0})${lost ? `, экипаж −${lost} CP/CM` : ""}${half}`);
}

// ── Применение эффекта свойства оружия (Оглушающее, Ослепляющее и т.п.) ──────
async function _applyWeaponPropEffect(ds) {
  const actor = requireControlledActor("⚠️ Выберите токен цели на сцене!");
  if (!actor) return;
  const label     = ds.wpLabel    || "Эффект";
  const propKey   = ds.wpKey      || "";
  const kind      = ds.wpKind      || "";
  // Считается другим свойством для иммунитета (Monofilament → Snare, книга:
  // «Считается Snare в расчёте эффектов и иммунитетов»).
  const immunityAlias = ds.wpImmunityAlias || "";

  // Иммунитет к свойству оружия (wdbc-plsf) — Мутации/Дары вроде «Пылающее
  // Тело»/«Щит Чистоты» дают weaponPropertyImmunity.<key> через Механику.
  if ((propKey && hasWeaponPropertyImmunity(actor, propKey))
    || (immunityAlias && hasWeaponPropertyImmunity(actor, immunityAlias))) {
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${label} → ${esc(actor.name)}</div>
        <div class="roll-outcome"><span class="roll-success">Иммунитет — эффект не применён</span></div>
      </div>`
    });
  }
  const condition = ds.wpCondition || "";
  const testChar  = ds.wpTestChar  || "";
  const testMod   = parseInt(ds.wpTestMod || "0");
  const perDoP    = ds.wpLevelPerDop === "1";
  const useRounds = ds.wpRounds === "1";
  const fixedRnd  = parseInt(ds.wpFixedRounds || "0");
  const dmgFormula   = ds.wpDamage  || "";
  const rating       = parseInt(ds.wpRating || "0");
  const isProvaly    = ds.wpProvaly === "1";
  const provalyMult  = parseInt(ds.wpProvalyMult || "1");
  const provalyAdd   = parseInt(ds.wpProvalyAdd  || "0");
  const minDoP       = parseInt(ds.wpMinDop || "1") || 1;
  const vehicleFlat  = ds.wpVehicleFlat === "1";
  const armorPen     = ds.wpArmorPen === "1";
  const rollMode  = game.settings.get("core", "rollMode");

  // Bane и т.п. (vehicleFlatDamage): против Техники тест/provalyDamage не
  // применяются вовсе — рейтинг X идёт в Структуру напрямую, без броска.
  if (vehicleFlat && actor.type === "vehicle") {
    const { currentValue, newValue, newCritical, gotCritical } = await applyStructureLoss(actor, rating);
    return ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="wh-roll-result">
          <div class="roll-header">${label} → ${esc(actor.name)}</div>
          <div class="roll-outcome"><span class="roll-failure">Техника: ${rating} непоглощаемого урона (автоматически, без теста)</span></div>
          <div class="roll-threshold">Структура: <b>${currentValue}</b> → <b>${newValue}</b>${gotCritical ? ` (крит. ${newCritical})` : ""}</div>
        </div>`,
      rolls: [],
      sound: null
    }, rollMode));
  }

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

  // Состояния, которые накладываем при провале. minDoP (Вибро — Ничком только
  // при 5+ Провалах, не при любом провале) отсекает состояние по degrees of
  // failure, не влияя на сам факт провала теста/доп. урон.
  const conditionsToApply = [];
  if (kind === "grav") conditionsToApply.push(["prone", false], ["pinned", false]);
  else if (condition && deg >= minDoP) conditionsToApply.push([condition, true]);

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
    // Enjoyment/Наслаждение (wdbc-sk8s): Усталость/Отравление/Кровотечение/
    // Оглушение от противника — 1 Боли раз за бой, без траты Реакции.
    const ENJOYMENT_CONDITIONS = new Set(["fatigued", "poisoned", "bleeding", "stunned"]);
    if (conditionsToApply.some(([cond]) => ENJOYMENT_CONDITIONS.has(cond))) {
      await maybeGrantEnjoymentPain(actor);
    }
  }

  // Доп. урон (Токсичное и т.п.) — при провале теста, минуя броню
  let dmgNote = "";
  if (!resisted && dmgFormula) {
    const dmgRoll = await new Roll(dmgFormula).evaluate();
    allRolls.push(dmgRoll);
    const dmg = dmgRoll.total;
    const { currentWounds, newWounds, newCritical, gotCritical } = await applyWoundLoss(actor, dmg);
    dmgNote = `<div class="roll-threshold">${rollIcon("burst","#ffb84d")}Доп. урон (минуя броню): <b>${dmg}</b> → Раны ${currentWounds} → ${newWounds}${gotCritical ? ` | Крит. раны: <b>${newCritical}</b>` : ""}</div>`;
  } else if (!resisted && isProvaly && armorPen) {
    // Monofilament: та же формула рейтинг×mult+add+Провалы, но урон идёт
    // ЧЕРЕЗ поглощение брони (Pen X) — applyMonofilamentHit постит свою
    // отдельную карточку с разбивкой AP/T.b, здесь только итог броска 1d5.
    const dmg = rating * provalyMult + provalyAdd + deg;
    const { jointRoll, isJoint, hitLocation } = await applyMonofilamentHit(actor, { rating, damage: dmg, weaponName: label });
    allRolls.push(jointRoll);
    dmgNote = `<div class="roll-threshold">${rollIcon("burst","#ffb84d")}1d5 на Сочленение (≤${rating}): <b>${jointRoll.total}</b> → ${isJoint ? `попадание в ${hitLocation}` : "обычное попадание (Торс)"}; урон (${dmg}, Pen ${rating}) и AP брони (−1 везде) — отдельной карточкой ниже</div>`;
  } else if (!resisted && isProvaly) {
    // «X+Провалы» (Bane, Vibro и т.п.): не кубик, а рейтинг×mult + add + Провалы
    // проваленного теста сопротивления — уже посчитано выше как deg.
    const dmg = rating * provalyMult + provalyAdd + deg;
    const { currentWounds, newWounds, newCritical, gotCritical } = await applyWoundLoss(actor, dmg);
    dmgNote = `<div class="roll-threshold">${rollIcon("burst","#ffb84d")}Доп. урон (минуя броню, ${rating}×${provalyMult}+${provalyAdd}+${deg} Провалы): <b>${dmg}</b> → Раны ${currentWounds} → ${newWounds}${gotCritical ? ` | Крит. раны: <b>${newCritical}</b>` : ""}</div>`;
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
    // Непоглощаемый урон напрямую в Раны (затем в Критические)
    const { currentWounds, newWounds, newCritical, maxWounds, gotCritical } =
      await applyWoundLoss(target, dmg);

    const soulDestroyed = newCritical >= woundDeathThreshold(maxWounds);
    dmgNote = `
      <div class="roll-damage-section">
        <div class="roll-damage-label">${rollIcon("fire","#ff8a3a")}Непоглощаемый E урон: <b>${dmg}</b> (${net}d10 за ${net} Успех(ов))</div>
        <div class="roll-threshold">Раны: <b>${currentWounds}</b> → <b>${newWounds}</b>${gotCritical ? ` | Крит. раны: <b>${newCritical}</b>` : ""}</div>
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
    const canSpend = actor && (fateVal > 0 || tempInfamyAmount(actor) > 0);
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

      // Тратим очко судьбы — временный запас (wdbc-e728) уходит первым.
      const reroll1 = await spendFromInfamyPool(actor, 1, "system.fate.value");
      await actor.update({ "system.fate.value": reroll1.poolValue });

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
            `✨ ${actor.name} тратит ${ft.one} на переброс атаки! Осталось: ${reroll1.poolValue}`);
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
              ${ft.word} потрачена (осталось: ${reroll1.poolValue})
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
        `✨ ${actor.name} тратит ${ft.one} на переброс! Осталось: ${reroll1.poolValue}`
      );
    });

    // ── +10 к броску ──────────────────────────────────────────────────────
    btnBonus.addEventListener("click", async (ev2) => {
      ev2.stopPropagation();
      menu.remove();
      document.removeEventListener("click", closeMenu);

      if (!canSpend) return;

      const roll = rolls[0];
      if (!roll) return;

      const rv = roll.total;

      // Если это была атака — переигрываем её тем же кубом, но с порогом
      // выше на 10: место попадания и криты завязаны на выпавшее значение,
      // поэтому куб не трогаем (см. rules/fate-bonus.mjs).
      const atkB = message.flags?.["warhammer-dbc"]?.attack;
      if (atkB) {
        const atkActor = game.actors?.get(atkB.actorId) ?? actor;
        const atkItem  = atkActor?.items?.get(atkB.itemId);
        if (atkItem) {
          // Временный запас (wdbc-e728) уходит первым.
          const bonus1 = await spendFromInfamyPool(actor, 1, "system.fate.value");
          await actor.update({ "system.fate.value": bonus1.poolValue });
          await _executeAttackRoll(atkActor, atkItem, atkB.charKey,
            (Number(atkB.threshold) || 0) + FATE_BONUS,
            atkB.rofMode, atkB.aimTarget,
            { ...(atkB.opts || {}), forcedRoll: rv, skipAmmo: true });
          ui.notifications.info(
            `➕ ${actor.name} тратит ${ft.one}: +10 к атаке! Осталось: ${bonus1.poolValue}`);
          return;
        }
      }

      // Извлекаем порог из сообщения
      const thresholdMatch = message.content.match(/Порог.*?<b>(\d+)<\/b>/);
      const outcome = thresholdMatch
        ? fateBonusOutcome({ rv, threshold: parseInt(thresholdMatch[1]) })
        : null;

      // Без порога надбавку применять не к чему — Очко не тратим.
      if (!outcome) {
        return ui.notifications.warn(
          "⚠️ В этом сообщении не виден Порог теста — +10 применить не к чему. Используйте переброс.");
      }

      // Временный запас (wdbc-e728) уходит первым.
      const bonus1 = await spendFromInfamyPool(actor, 1, "system.fate.value");
      await actor.update({ "system.fate.value": bonus1.poolValue });

      const rollMode = game.settings.get("core", "rollMode");
      const outcomeHtml = outcome.success
        ? `<div class="roll-outcome"><span class="roll-success">Успех — ${outcome.degrees} ${_degWord(outcome.degrees)}</span></div>`
        : `<div class="roll-outcome"><span class="roll-failure">Провал — ${outcome.degrees} ${_degWord(outcome.degrees)}</span></div>`;

      const newMessageData = ChatMessage.applyRollMode({
        speaker: message.speaker,
        content: `
          <div class="wh-roll-result">
            <div class="roll-header">+10 за ${ft.one}</div>
            <div class="roll-damage-meta">
              ${ft.word} потрачена (осталось: ${bonus1.poolValue})
            </div>
            <div class="roll-threshold">
              Порог: <b>${outcome.base}</b> → <b>${outcome.threshold}</b>
              <span style="font-size:0.82em;color:#3a7a3a;">(+${outcome.bonus})</span>
            </div>
            <div class="roll-dice">Бросок: <b>${rv}</b> <span style="font-size:0.82em;opacity:.75;">— тот же, куб не перебрасывается</span></div>
            ${outcomeHtml}
          </div>`,
        rolls: [roll]
      }, rollMode);

      await ChatMessage.create(newMessageData);

      ui.notifications.info(
        `✨ ${actor.name} тратит ${ft.one} на +10! Осталось: ${bonus1.poolValue}`
      );
    });
  });
}

// Хуки ниже — ОДНОКРАТНЫЕ регистрации на весь клиент. Раньше они по ошибке
// жили внутри _attachFateContextMenu и вешались заново на КАЖДУЮ карточку
// чата с .wh-roll-result: старые обработчики были идемпотентны и это
// маскировали, а урон узла корабля катал детонацию по разу на карточку.

  // ── Новый Раунд обнуляет счётчики потерь Орд ─────────────────────────────
  // Тест W+Магнитуда требуется за массивный урон «в один Раунд», поэтому
  // накопитель живёт ровно один Раунд боя. Чистит только ГМ: флаги пишет
  // владелец документа, и дублировать запись с каждого клиента незачем.
  Hooks.on("updateCombat", async (combat, changed) => {
    if (!game.user.isGM || changed?.round === undefined) return;
    for (const combatant of combat.combatants ?? []) {
      const actor = combatant.actor;
      if (actor?.type !== "horde") continue;
      if (actor.getFlag("warhammer-dbc", ROUND_DAMAGE_FLAG))
        await actor.unsetFlag("warhammer-dbc", ROUND_DAMAGE_FLAG);
    }
    await resolvePendingSusAnHeals(combat);
    // Spirit Talk/Духовный Разговор (wdbc-q30d): захваченный конструкт
    // держит инициативу сразу за кастером каждый Раунд, пока не истекут
    // F.b — та же смена Раунда, ГМ пишет.
    await processSpiritTalkRoundStart(combat);
  });

  // Бой кончился раньше, чем подошёл отложенный Раунд Сус-ан Мембраны —
  // доносим исцеление немедленно, а не теряем его молча (module/apps/sus-an-heal.mjs).
  Hooks.on("deleteCombat", async combat => {
    if (!game.user.isGM) return;
    await resolvePendingSusAnHeals(combat, { force: true });
    _lastTurnCombatant.delete(combat.id);
    // «На поле боя X ходов стрелка» вне боя не имеет смысла — считать больше не от чего.
    await clearAllLingerZones();
    await clearAllGravitonZones();
  });

  // Бой кончился — снять транс «Дух героя» у всех, кто в него впадал, и
  // разослать отложенную Порчу (module/apps/armour-history-trance.mjs).
  Hooks.on("deleteCombat", async combat => {
    if (!game.user.isGM) return;
    await resolveTrancesForCombat(combat);
    // Метка Аватара Резни живёт «до конца боя» — снять со всех комбатантов.
    await clearAvatarOfSlaughterMarks(combat);
    // Бонусы Песни Стремительности (wdbc-sk8s) — та же логика «до конца боя».
    await clearSongOfSwiftnessBuffs(combat);
    // Reformation Song/Песня Изменений (wdbc-vwfk): моды AP брони, временный
    // Reinforced, временное качество Снаряжения — та же логика «до конца боя».
    await clearReformationSongBuffs(combat);
    // Метка Проклятой Метки (wdbc-xxb7) — та же логика «до конца боя».
    await clearHexMarkedPreyMarks(combat);
  });

  // Зоны «Остаётся» (Linger, module/regions/linger-zone.mjs) — И срок жизни
  // (X), И дрейф (Y) привязаны не к смене Раунда вообще, а именно к началу
  // Хода АКТОРА, породившего зону (см. заголовок linger-zone.mjs) —
  // поэтому своя отдельная пара Hooks.on, не переиспользует ни счётчики
  // Орд/Сус-ан выше (те резолвят по Раунду), ни _lastTurnCombatant
  // экономики действий ниже (тому «чей ход» нужен только для разницы
  // prev/next, здесь достаточно текущего combat.combatant).
  Hooks.on("updateCombat", async (combat, changed) => {
    if (!game.user.isGM) return;
    if (changed?.round === undefined && changed?.turn === undefined) return;
    if (combat.combatant) await processShooterTurnStart(combat.combatant);
  });

  // Гравитонные зоны (module/regions/graviton-zone.mjs, wdbc-wlwf) — тот же
  // триггер, что и у «Остаётся»: усыхание на 1м привязано к началу Хода
  // именно СТРЕЛКА, своя отдельная пара Hooks.on по тому же принципу.
  Hooks.on("updateCombat", async (combat, changed) => {
    if (!game.user.isGM) return;
    if (changed?.round === undefined && changed?.turn === undefined) return;
    if (combat.combatant) await processGravitonShooterTurnStart(combat.combatant);
  });

  // ── Экономика действий (стр. 12): восполнить ОД/Реакции актору, чей Ход
  // начался, и применить конец Хода уходящего (потеря Реакции Агрессивной
  // Стойки) — module/combat/action-economy.mjs. Своя пара Hooks.on, а не
  // ветка в обработчике Орд/Сус-ан выше: тот резолвит только по смене
  // РАУНДА, экономика действий — по смене ХОДА (combatant) внутри раунда
  // тоже. combat.previous в разных версиях Foundry вёл себя по-разному
  // (wdbc, доступность combatantId «до» апдейта не гарантирована), поэтому
  // «кто ходил до этого» отслеживается своей мапой combat.id → combatantId,
  // а не встроенным геттером.
  // Колдовское Лезвие (стр. 74 Книги Аэльдари): выбор бонуса на весь
  // Encounter — спрашиваем ровно раз, в момент старта боя («Begin Combat»).
  Hooks.on("combatStart", async (combat) => {
    await processWitchsEdgeCombatStart(combat);
  });

  Hooks.on("updateCombat", async (combat, changed) => {
    if (!game.user.isGM) return;
    if (changed?.round === undefined && changed?.turn === undefined) return;
    const nextCombatant = combat.combatant;
    const prevId = _lastTurnCombatant.get(combat.id);
    if (prevId && prevId !== nextCombatant?.id) {
      const prevActor = combat.combatants.get(prevId)?.actor;
      if (prevActor) {
        await applyTurnEndStanceEffects(prevActor);
        // Конец Хода Подавленного (стр. 33) — предложить тест на преодоление.
        if (prevActor.system.conditions?.pinned) await postSuppressionRecoveryPrompt(prevActor);
        // Кровотечение/Горение (wdbc-j3yf) — книга бьёт ими «в конце своего
        // Хода», не в начале следующего.
        await processConditionTurnEnd(prevActor);
      }
    }
    if (nextCombatant?.actor) {
      await resetActionEconomy(nextCombatant.actor);
      // Карточка «сколько у меня ОД/Реакций» (wdbc-qjnk) — сразу после сброса,
      // пока значения свежие; сама решает, нести ли этому типу актора экономику.
      await postTurnStartCard(nextCombatant.actor);
      await processPrismaTurnStart(nextCombatant.actor);
      // Грозный Вопль (wdbc-sk8s): усилитель звукового оружия живёт «до
      // начала следующего Хода» — снимается тут же, тем же тактом, что и
      // сброс ОД/Реакций.
      await clearDreadWailWeaponBuff(nextCombatant.actor);
      // Временные эффекты Шамана Зверолюдей (wdbc-xxb7) — «до начала
      // следующего Хода ШАМАНА» (не получателя), тем же тактом.
      await clearBeastmanShamanTempEffects(combat, nextCombatant.actor);
      // Декремент счётчиков длительности (Оглушение/Ослепление/Удушье,
      // wdbc-j3yf) — «в начале своего Хода», отдельно от Кровотечения/
      // Горения выше (у тех книга явно говорит «в конце»).
      await processConditionTurnStart(nextCombatant.actor);
      // Регенерация Аблативных Ран (wdbc-smy7) — «1 за Ход», тем же тактом.
      await processAblativeWoundsTurnStart(nextCombatant.actor);
      // Reformation Song/Песня Изменений (wdbc-vwfk): Снаряжение, «не
      // работает на раунд» от Разрушения — снимается в начале следующего
      // Хода владельца, тем же тактом, что и Грозный Вопль выше.
      await clearExpiredGearMalfunction(nextCombatant.actor);
    }
    if (nextCombatant) _lastTurnCombatant.set(combat.id, nextCombatant.id);
  });

  // ── Таймер периодического теста перевеса выключенной силовой брони ──────
  // (combat/armor-mods.mjs, стр. 233) — тир перевеса производный, «было/стало»
  // хуку update* не видно, поэтому синхронизация идёт по текущему состоянию
  // на каждое релевантное изменение: вес брони меняется через её собственный
  // updateItem (active/equipped), Ношение/Подъём/Толкание — через updateActor
  // (характеристики, снаряжение).
  Hooks.on("updateActor", async actor => {
    await syncDisabledArmourOverloadTimer(actor);
  });

  // ── Пересчёт цены Продвижения при смене Покровителя/стереотипа/режима ───
  // Склонности уже пересчитывались сами (setAptitudes зовёт recalc напрямую
  // из своего же обработчика на «Развитии»); patronGod/patronStereotype/
  // pricingModeOverride правятся простыми полями формы в разных местах листа
  // (ЗАПИСИ, «Настройки листа»), поэтому единая точка — хук на updateActor,
  // а не обработчик на каждом месте. userId-гвард — иначе каждый подключённый
  // клиент запустил бы свой пересчёт и свою запись поверх других (см.
  // doombc-foundry-v13-gotchas, «Multi-client hook duplication»).
  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (game.user.id !== userId) return;
    if (actor.type !== "character") return;
    const sys = changes.system;
    if (!sys) return;
    if ("patronGod" in sys || "patronStereotype" in sys || "pricingModeOverride" in sys) {
      await recalcAllAdvanceCosts(actor);
    }
  });
  // Хук стреляет у всех, кто в игре, — авто-диалог теста-развилки (S+0/
  // Athletics(S)+10, стр. 233) должен всплыть только у того, кто саму броню
  // отключил (userId), иначе окно выбора получат все клиенты разом.
  Hooks.on("updateItem", async (item, changes, options, userId) => {
    if (item.type !== "armor" || !item.actor) return;
    await syncDisabledArmourOverloadTimer(item.actor);
    if (userId === game.user?.id && changes?.system?.active === false) {
      await promptDisabledArmourForkTest(item.actor);
    }
  });

  // Узлы корабля (wdbc-qhwb): запоминаем старый system.status ДО применения
  // правки — preUpdate видит документ ещё нетронутым, а options — тот же
  // объект, что дойдёт до post-хука ниже (стандартный приём Foundry для
  // диффа old/new между pre/post update одной операции).
  Hooks.on("preUpdateItem", (item, changes, options) => {
    if (item.type === "component" && "status" in (changes.system || {})) {
      options.whPrevNodeStatus = item.system.status;
    }
  });
  Hooks.on("updateItem", async (item, changes, options, userId) => {
    if (game.user.id !== userId) return;
    if (item.type !== "component" || !item.actor) return;
    const sys = changes.system;
    if (!sys) return;

    // Требования к расположению (Location Requirements, wdbc-qhwb): предупредить,
    // если дуга узла не входит в разрешённый набор — не блокировать, тот же
    // стиль, что уже есть у предупреждения о перегрузке WC на вкладке «Узлы».
    if (sys.weapon && "arc" in sys.weapon) {
      const locReq = resolveShipProps(item).find(p => p.key === "locationReq");
      if (locReq?.rating) {
        const allowed = String(locReq.rating).split(",").map(s => s.trim()).filter(Boolean);
        const raw  = String(sys.weapon.arc || "").trim();
        const norm = WC_CODE[raw.toUpperCase()] || raw;   // принимает и «ПБ», и «star»
        if (norm && !allowed.includes(norm)) {
          ui.notifications.warn(`⚠️ «${item.name}»: Location Requirements не допускает дугу «${raw}» (разрешено: ${allowed.join(", ")}).`);
        }
      }
    }

    // Реакция на повреждение узла (explosive/fragileEngine/robustDesign).
    if (!("status" in sys) || options.whPrevNodeStatus === undefined) return;
    const oldStatus = options.whPrevNodeStatus;
    const newStatus = item.system.status;
    const { forceStatus, explosionDamage, revertStatus, note } =
      await resolveNodeDamage(resolveShipProps(item), item.system.kind, oldStatus, newStatus,
        async formula => (await (new Roll(formula)).evaluate()).total);
    if (!forceStatus && !revertStatus) return;

    if (revertStatus) {
      await item.update({ "system.status": revertStatus });
    } else if (forceStatus && forceStatus !== newStatus) {
      await item.update({ "system.status": forceStatus });
    }
    if (explosionDamage) {
      const roll = await (new Roll(explosionDamage)).evaluate();
      const { cur, next, lost } = await applyHullDamage(item.actor, roll.total);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: item.actor }),
        content: `<div class="wh-roll-result"><div class="roll-header">💥 ${esc(item.name)} — ${note}</div>
          <div class="roll-threshold">Урон Прочности: <b>${roll.total}</b> (${explosionDamage}): ${cur} → ${next}${lost ? `, экипаж −${lost} CP/CM` : ""}</div></div>`,
        rolls: [roll], sound: CONFIG.sounds.dice
      });
    } else if (note) {
      ui.notifications.info(`${item.name}: ${note}`);
    }
  });

// ── Вспомогательные функции ───────────────────────────────────────────────────

/**
 * Орда не может совершать Избегания — но кнопки защиты в чате не знают, чей
 * токен выделен. Предупреждаем и спрашиваем подтверждение: домашние Черты и
 * особые случаи ГМа бывают, а молча катить бросок против правила нельзя.
 *
 * @returns {Promise<boolean>} продолжать ли бросок
 */
async function confirmHordeDefense(actor, label) {
  if (actor?.type !== "horde") return true;
  ui.notifications.warn("⚠️ Орда не может совершать Избегания (правила Орд).");
  return foundry.applications.api.DialogV2.confirm({
    window: { title: `${label} за Орду` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p><b>${esc(actor.name)}</b> — Орда, а Орды Избеганий не совершают:
      их площадь слишком велика, чтобы уклоняться.</p>
      <p>Бросить ${esc(label.toLowerCase())} всё равно?</p>`,
    yes: { label: "Бросить" },
    no:  { label: "Отмена", default: true }
  }).catch(() => false);
}

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