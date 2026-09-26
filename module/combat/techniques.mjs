import { CHARACTERISTICS }                  from "../constants/characteristics.mjs";
import { esc, _degWord }                    from "../helpers/utils.mjs";
import { rollIcon }                         from "../constants/roll-icons.mjs";
import { MELEE_STANCES }                    from "../constants/combat.mjs";
import { ruleRerollsHtml }                  from "../rules/roll-mods.mjs";
import { pickReroll }                       from "../rules/reroll-pick.mjs";
import { testOutcome }                      from "../rules/roll-outcome.mjs";
import { hasRuleFlag, ruleFlagLabels }      from "../rules/flags.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { DANCE_OF_DECEPTION_CAPABILITY, danceOfDeceptionFeintOptions } from "../rules/dance-of-deception.mjs";
import { phantomCopiesFeintBonus } from "../rules/wrapped-in-chaos.mjs";
import { spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { tempInfamyAmount } from "../rules/temp-infamy.mjs";
import { sideValue, sideContext, registerContest, contestOpponents } from "./opposed-contest.mjs";
import { spendActionPoints } from "./action-economy.mjs";
import { canTakeAttackAction, takeAttackAction } from "./attack-limit.mjs";

export async function _showContestDialog(actor, techDef) {
  // Повалить и Напролом — Athletics(S) vs Athletics(S), Финт/Давление — WS vs WS.
  const isKnock  = techDef.label === "Повалить" || techDef.label === "Напролом";

  // Стойка (стр. 15) даёт бонус «на все тесты WS», но Агрессивная явно
  // исключает встречные тесты против Финта — то есть Давление его получает,
  // а Финт нет. techDef.stanceWs отмечает это на самом Давлении (только
  // оно из контестов — настоящий тест WS вs WS без исключения книги).
  const stanceKey      = actor.system.meleeStance || "standard";
  const stanceWsBonus  = techDef.stanceWs ? (MELEE_STANCES[stanceKey]?.wsBonus ?? 0) : 0;

  // Плоский бонус источника, не зависящего от Стойки/характеристики — напр.
  // Мутация Tentacle/Щупальце даёт +20 на все тесты Борьбы (module/combat/
  // grapple.mjs::tentacleTechDef), независимо от того, какой характеристикой
  // их сдают. Фантомные Копии (Wrapped in Chaos "2-3", wdbc-1rno) — тот же
  // приём для Финта конкретно: гейт по имени техники (как Танец Обмана
  // ниже), а не запись в статичном MELEE_CONTESTS — там нет актора.
  const extraBonus = (techDef.extraBonus ?? 0)
    + (techDef.label === "Финт" ? phantomCopiesFeintBonus(actor) : 0);

  // Определяем характеристику по умолчанию. techDef.defaultChar — явное
  // указание (действия Борьбы, стр. 12: Athletics(S) или Acrobatics(A) —
  // ни то, ни другое не WS/Повалить-Напролом, поэтому нужна отдельная ручка,
  // а не растягивать isKnock ещё сильнее).
  const defaultChar = techDef.defaultChar || (isKnock ? "s" : "ws");
  // Навык вместо голой Характеристики (wdbc-x1nz.2.73): «Athletics(S)+0» —
  // тест Навыка, Ранг (нетренированный −20, +10/+20/+30) входит в порог.
  // techDef.skills: { s: "athletics", ag: "acrobatics" } — какой ключ списка
  // бросается Навыком; остальные — Характеристикой, как раньше (WS у Финта).
  const sideFor = key => techDef.skills?.[key] ? { skill: techDef.skills[key] } : { char: key };
  const baseVal     = sideValue(actor, sideFor(defaultChar))
                     + (defaultChar === "ws" ? stanceWsBonus : 0)
                     + extraBonus;

  // Строим опции для выбора характеристики. techDef.allowedChars (Повалить,
  // стр. 14, wdbc-x1nz.2.66.5: «Athletics(S)+0 vs Athletics(S)+0 или
  // Acrobatics(A)+0» — РОВНО эти два, не любая из 10) сужает список; без
  // этого поля поведение прежнее (любая характеристика — Финт/Давление/
  // Напролом/Обезоружить книгой не ограничены конкретным Навыком).
  // techDef.charLabels — подпись поверх общей (meta.label даёт «Ловкость»,
  // книге здесь нужно «Acrobatics(A)», не характеристика сама по себе).
  const charEntries = techDef.allowedChars
    ? Object.entries(CHARACTERISTICS).filter(([key]) => techDef.allowedChars.includes(key))
    : Object.entries(CHARACTERISTICS);
  // Отвлекающее, Оружие Наследия (стр. 427-428): «При Финте — тест на
  // Charm(Fel) или Int вместо WS». Список и так полный — подпись лишь
  // отличает разрешённую книгой подмену от самоуправства; живёт здесь, в
  // окне Финта, а не в окне обычной атаки (wdbc-t3c3t.3).
  const feintSwapWhy = techDef.label === "Финт"
    ? { fel: ruleFlagLabels(actor, "charSwap.fel.forWs"), int: ruleFlagLabels(actor, "charSwap.int.forWs") }
    : {};
  const charOptions = charEntries.map(([key, meta]) => {
    let val = sideValue(actor, sideFor(key));
    if (key === "ws" && stanceWsBonus) val += stanceWsBonus;
    val += extraBonus;
    const label = techDef.charLabels?.[key] ?? `${meta.abbr} — ${meta.label}`;
    const swap = feintSwapWhy[key]?.length ? ` — вместо WS: ${esc(feintSwapWhy[key].join(", "))}` : "";
    return `<option value="${key}" ${key === defaultChar ? "selected" : ""}>
      ${label} (${val})${swap}
    </option>`;
  }).join("");

  // Dance of Deception/Танец Обмана (wdbc-1rno, Слаанеш): у Финта — доп.
  // варианты Навыком вместо WS+0. Техника задаётся общим статичным объектом
  // MELEE_CONTESTS (constants/combat.mjs), актор-специфичные варианты в него
  // не положить — гейт по имени, тот же приём, что isKnock выше.
  const danceOfDeceptionActive = techDef.label === "Финт" && hasRuleFlag(actor, DANCE_OF_DECEPTION_CAPABILITY);
  const danceOptions = danceOfDeceptionActive ? danceOfDeceptionFeintOptions(actor) : [];
  const danceOptionsHtml = danceOptions.map(o =>
    `<option value="${esc(o.key)}">${esc(o.label)} (${o.value})</option>`).join("");
  const danceFreeActionHtml = danceOfDeceptionActive
    ? `<div class="atk-dlg-row">
         <label><input type="checkbox" id="dance-free-action"/>
           💃 Танец Обмана: потратить Очко Бесчестия — Финт как свободное действие</label>
       </div>`
    : "";

  const stanceBonusNote = stanceWsBonus
    ? `<div style="font-size:0.85em;color:#8fd0ff;margin-bottom:6px;">
         ${rollIcon("sword")}Стойка: ${MELEE_STANCES[stanceKey].label} (${stanceWsBonus >= 0 ? "+" : ""}${stanceWsBonus}), уже в WS выше
       </div>`
    : "";

  // Опциональные перебросы правил (wdbc-u0by, Truth-Seer/Defiance) — этот
  // диалог раньше вообще не читал реестр правил (та же дыра, что была у
  // Парирования до фикса, module/combat/defense.mjs). Список считается по
  // характеристике ПО УМОЛЧАНИЮ при открытии — тот же компромисс, что у
  // общего диалога теста Навыка (mods не пересчитываются реактивно при
  // смене дропдауна): честное самоподтверждение игрока всё равно решает,
  // применять ли галочку, форма Состязания не проверяет роль/условие сама.
  const rr = ruleRerollsHtml(actor, sideContext(sideFor(defaultChar)));

  const extraBonusNote = extraBonus
    ? `<div style="font-size:0.85em;color:#8fd0ff;margin-bottom:6px;">
         ${rollIcon("sword")}${techDef.extraBonusLabel ?? "Бонус"}: ${extraBonus >= 0 ? "+" : ""}${extraBonus}, уже учтён выше
       </div>`
    : "";

  // Иммунитет цели (wdbc-egll, напр. mutation.tentacle.suckerGrip у Щупальца
  // 4-5) — предупреждение, не блокировка: тот же принцип «галочка, не тихий
  // запрет», что и у прочих модификаторов (resolve-test.mjs). Бросок можно
  // всё равно сделать (цель может смениться, или стол решит иначе).
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  const immune = techDef.targetImmunityFlag && target && hasRuleFlag(target, techDef.targetImmunityFlag);
  const immuneLabels = immune ? ruleFlagLabels(target, techDef.targetImmunityFlag).join(", ") : "";
  const immunityNote = immune
    ? `<div style="font-size:0.85em;color:#e08a3a;margin-bottom:6px;">
         ⚠️ ${esc(target.name)}: нельзя обезоружить${immuneLabels ? ` (${esc(immuneLabels)})` : ""} — бросок пройдёт, но эффект списывается вручную
       </div>`
    : "";

  new Dialog({
    title: techDef.label,
    content: `
      <form class="wh-attack-form">
        <div class="atk-dlg-header">
          <span class="atk-weapon-name">${techDef.label}</span>
        </div>
        ${techDef.chatNote
          ? `<div class="atk-technique-chatnote" style="margin-bottom:6px;">
               ${techDef.chatNote}
             </div>`
          : ""}
        <div style="font-size:0.88em;color:#5a4a30;margin-bottom:8px;padding:4px 6px;
                    background:rgba(0,0,0,0.05);border-left:3px solid #7a5c2e;">
          ${techDef.note}
        </div>
        ${stanceBonusNote}
        ${extraBonusNote}
        ${immunityNote}

        <div class="atk-dlg-row">
          <label>Характеристика:</label>
          <select id="contest-char">${charOptions}${danceOptionsHtml}</select>
        </div>

        <div class="atk-dlg-row">
          <label>Ваш бросок с:</label>
          <input id="contest-self" type="number" value="${baseVal}" readonly/>
        </div>

        <div class="atk-dlg-row">
          <label>Доп. модификатор:</label>
          <input id="contest-mod" type="number" value="${techDef.defaultMod ?? 0}"/>
        </div>

        <div class="atk-dlg-row atk-total-row">
          <label>Итоговый порог:</label>
          <span id="contest-total-display">${baseVal}</span>
        </div>
        ${rr.html}
        ${danceFreeActionHtml}
      </form>`,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice-d10"></i>', label: "Бросок!",
        callback: async html => {
          const charKey  = html.find("#contest-char").val();
          // Dance of Deception (wdbc-1rno): выбранный пункт — не сырая
          // Характеристика, а один из вариантов danceOptions (Навык).
          const danceOpt = danceOptions.find(o => o.key === charKey);
          const charMeta = danceOpt ? null : CHARACTERISTICS[charKey];
          const selfVal  = parseInt(html.find("#contest-self").val()) || 0;
          const mod      = parseInt(html.find("#contest-mod").val())  || 0;
          // Общий сбор модификаторов (wdbc-ct65.3): встречный тест приёма
          // шёл мимо реестра правил — «Цель» в окне игрок правил руками.
          // Навыком (danceOpt) — ctx несёт и char (Ловкость), и сам Навык,
          // как у обычного броска Навыка (actor-sheet.mjs::_rollSkill).
          const side = danceOpt ? { skill: danceOpt.skillKey } : sideFor(charKey);
          const ruleMods = collectTestMods(actor, danceOpt
            ? { kind: "skill", char: danceOpt.charKey, skill: danceOpt.skillKey }
            : sideContext(side));
          const eff      = selfVal + mod + ruleMods.total;

          // Встречный тест (wdbc-x1nz.2.73): без противника сравнивать не с
          // чем — бросок не делается вовсе, ОД не тратятся.
          const opponents = contestOpponents(actor, techDef);
          if (!opponents.length) {
            ui.notifications?.warn(`${techDef.label}: нет противника — наведите цель (встречный тест).`);
            return;
          }
          // Цена действия (Борьба, стр. 12: Полудействие/Полное действие) —
          // у тех приёмов, что её несут; прочие Состязания ОД не списывают.
          // Тип «Атака» (Заломить, Пересилить — стр. 12) входит в Лимит Атак за Ход.
          if (techDef.isAttack && !canTakeAttackAction(actor)) {
            ui.notifications?.warn(`⚠️ ${techDef.label}: Атака в этом Ходу уже была (стр. 12).`);
            return;
          }
          if (techDef.apCost && !(await spendActionPoints(actor, techDef.apCost, { physical: true }))) {
            ui.notifications?.warn(`⚠️ ${techDef.label}: не хватает ОД (${techDef.apCost}).`);
            return;
          }
          if (techDef.isAttack) await takeAttackAction(actor);
          // Прочая цена приёма (Реакция «Повалить» с карточки атаки, hooks.mjs)
          // — здесь, а не до окна: «Отмена» ничего не должна съедать
          // (wdbc-t3c3t.7). pay сам предупреждает, чего не хватило.
          if (techDef.pay && !(await techDef.pay(actor))) return;

          // Dance of Deception — свободное действие за Очко Бесчестия
          // (wdbc-1rno): Состязания не списывают ОД программно вовсе (см.
          // заголовок rules/dance-of-deception.mjs) — механизируема только
          // цена, тем же путём, что обычная трата Бесчестия (_ipSpend).
          let freeActionNote = "";
          if (danceOfDeceptionActive && html.find("#dance-free-action").is(":checked")) {
            const poolPath = actor.sheet?._infamyPath ?? "system.fate.value";
            const curIp = Math.max(0, Number(foundry.utils.getProperty(actor, poolPath)) || 0);
            if (curIp < 1 && tempInfamyAmount(actor) < 1) {
              ui.notifications?.warn("Танец Обмана: нет Очков Бесчестия — Финт остаётся обычным действием.");
            } else {
              const spend = await spendFromInfamyPool(actor, 1, poolPath);
              if (spend) await actor.update({ [poolPath]: spend.poolValue });
              if (spend) freeActionNote = `<div class="roll-threshold">💃 Танец Обмана: потрачено 1 Очко Бесчестия — Финт проведён как свободное действие.</div>`;
            }
          }

          // Опциональный переброс правил (wdbc-u0by) — тот же приём чтения,
          // что actor-sheet.mjs::_showSkillRollDialog (.rule-reroll-opt:checked).
          const rerollEl = html.find(".rule-reroll-opt:checked");
          const rerollIdx = parseInt(rerollEl?.data?.("idx") ?? "-1");
          const useReroll = rerollIdx >= 0;
          const mode = rerollEl?.data?.("mode") || "keepBest";
          // Лишние руки в Захвате (стр. 12, wdbc-x1nz.2.77): «за каждую
          // дополнительную руку он может бросать... дополнительный раз,
          // выбирая лучший» — techDef.rollCount; с перебросом правил не
          // складывается (оба — «выбрать лучший из нескольких»).
          const extraRolls = Math.max(1, Number(techDef.rollCount) || 1);
          const rolled = [];
          const nRolls = useReroll ? Math.max(2, extraRolls) : extraRolls;
          for (let i = 0; i < nRolls; i++) rolled.push(await new Roll("1d100").evaluate());
          const picked = pickReroll(rolled.map(r => r.total), useReroll ? mode : "keepBest");
          const rv     = picked.value;
          const { success: hit, deg } = testOutcome(rv, eff);
          const outcome  = hit
            ? outcomeHtml(true,  `Успех — ${deg} ${_degWord(deg)}`)
            : outcomeHtml(false, `Провал — ${deg} ${_degWord(deg)}`);
          // Подписи модификаторов, а не только ручное число (wdbc-kuun):
          // Порог уже считался с Усталостью и Чертами, но в карточке этого
          // видно не было — тот же дефект, что живая проверка нашла в
          // Командовании и Ударе Ассасина.
          const modParts = [
            mod !== 0 ? `${mod >= 0 ? "+" : ""}${mod}` : "",
            ...ruleMods.parts
          ];
          const rerollLabel = useReroll ? rr.rerolls?.[rerollIdx]?.label
            : (extraRolls > 1 ? `Лишние руки в Захвате, лучший из ${extraRolls}` : "");
          const rerollNote = picked.dropped.length
            ? `<div class="roll-defense-note">${rerollLabel || "Переброс"}: отброшено ${picked.dropped.join(", ")}</div>`
            : "";

          // Карточка — общим сборщиком (wdbc-kuun). Блок «Приём: …» остался
          // над шапкой (prelude), слагаемые Порога перечисляются в скобках
          // через запятую вместо « · ».
          await postTestCard(actor, {
            prelude: `
              <div class="roll-technique-block">${rollIcon("sword")}Приём: <b>${techDef.label}</b>
                ${techDef.chatNote
                  ? `<div class="roll-technique-note">${techDef.chatNote}</div>`
                  : ""}
              </div>`,
            title: techDef.label,
            threshold: rollStatLine({
              label: danceOpt ? danceOpt.label : (charMeta?.abbr ?? charKey), base: selfVal, parts: modParts, threshold: eff, rv
            }),
            rerollNote, outcome,
            sections: [
              `<div class="roll-location" style="font-size:0.88em;margin-top:3px;">
                 ${rollIcon("spark","#8fd0ff")}При победе: ${techDef.note}
               </div>`,
              registerContest(actor, techDef, {
                success: hit, deg, threshold: eff, rv, side,
                resistMods: Object.fromEntries(opponents.map(o => [o.uuid, techDef.resistMods?.(o, actor) ?? []])),
                resistRolls: Object.fromEntries(opponents.map(o => [o.uuid, techDef.resistRolls?.(o, actor) ?? 1]))
              }, opponents),
              hit && immune
                ? `<div class="roll-location" style="font-size:0.88em;margin-top:3px;color:#e08a3a;">
                     ⚠️ ${esc(target.name)}: нельзя обезоружить${immuneLabels ? ` (${esc(immuneLabels)})` : ""} — эффект Приёма не применяется
                   </div>`
                : "",
              freeActionNote
            ]
          }, { rolls: rolled });

          // Опциональный колбэк на успех (техника несёт реальный эффект, не
          // только прозу-заметку) — «Заломить» (grapple.mjs), «Финт»/«Давление»
          // (combat/feint-press.mjs, wdbc-x1nz.2.65). target — уже вычисленная
          // выше выцеленная цель (см. immune/target), тот же токен, что
          // получает эффект. Необязателен: у Повалить/Напролом его нет.
          // С wdbc-x1nz.2.73 он зовётся НЕ здесь, а после броска противника —
          // combat/opposed-contest.mjs::runContestOutcome, когда инициатор
          // выиграл встречный тест.
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "roll",
    render: html => {
      // При смене характеристики — обновляем базовое значение
      html.find("#contest-char").on("change", ev => {
        const key = ev.currentTarget.value;
        const danceOpt = danceOptions.find(o => o.key === key);
        let val;
        if (danceOpt) {
          val = danceOpt.value;
        } else {
          val = sideValue(actor, sideFor(key));
          if (key === "ws" && stanceWsBonus) val += stanceWsBonus;
          val += extraBonus;
        }
        html.find("#contest-self").val(val);
        _updateTotal(html);
      });
      html.find("#contest-mod").on("input", () => _updateTotal(html));

      function _updateTotal(html) {
        const base = parseInt(html.find("#contest-self").val()) || 0;
        const mod  = parseInt(html.find("#contest-mod").val())  || 0;
        html.find("#contest-total-display").text(base + mod);
      }

      _updateTotal(html);
    },
    close: () => {}
  }, { classes: ["dialog", "wh-attack-dialog"], width: 400 }).render(true);
}