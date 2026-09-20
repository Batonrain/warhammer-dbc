// module/apps/legacy-weapon.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Блок «НАСЛЕДИЕ» на листе оружия (корбук, стр. 426-428): Возвышение, История
//  и Мутации по порогам Порчи.
//
//  Тесты и таблицы — в rules/legacy-weapon.mjs и constants/legacy-weapon.mjs;
//  здесь броски, правки предмета и карточки в чат.
//
//  Возвышение правит сам профиль оружия (+½Inf.b к Dmg и Pen, Reinforced,
//  минус Primitive, +1 Качество), поэтому перед правкой снимается снимок
//  прежних значений: связь рвётся Ревностью, и возвращать оружие к обычному
//  виду надо по снимку, а не обратным вычитанием — иначе правки, сделанные
//  между Возвышением и разрывом, потерялись бы.
//
//  Владелец нужен всему: Inf для теста, Inf.b для бонуса, Порча для числа
//  Мутаций. У оружия в списке предметов мира владельца нет — блок тогда
//  показывает правила, но кнопки бросков не предлагает.
// ════════════════════════════════════════════════════════════════════════════

import { LEGACY_COMMON, LEGACY_HISTORIES, LEGACY_CHARACTERS, CHARACTER_ORDER,
         LEGACY_RULES, MUTATION_THRESHOLDS, historyByRoll, mutationByRoll,
         entryText, rangeLabel } from "../constants/legacy-weapon.mjs";
import { canAscend, ascensionRows, legacyBonus, qualityAfterLegacy, propsAfterLegacy,
         mutationSlots, nextMutationAt, mutationsAvailable, takenMutationNames,
         isHeavyWeapon, hardProps, painLegacyProps, plagueLegacyProps,
         tearingLegacyProps, shatteringLegacyGrant, stunningLegacyGrant,
         swiftLegacyMeleeGrant, slaughterLegacyGrant, viciousLegacyGrant } from "../rules/legacy-weapon.mjs";
import { ITEM_QUALITY } from "../constants/quality.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { _degWord, esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";

const sgn = n => `${n >= 0 ? "+" : ""}${n}`;

/** Рукопашное ли оружие — от этого зависит, какой текст записи брать. */
const isMeleeWeapon = weapon =>
  weapon?.system?.weaponClass === "melee" || weapon?.system?.weaponClass === "thrown";

/** Данные блока «НАСЛЕДИЕ» для листа оружия. */
export function legacyContext(item) {
  if (item?.type !== "weapon") return null;
  const sys = item.system ?? {};
  const L = sys.legacy ?? {};
  const actor = item.actor ?? null;
  const melee = isMeleeWeapon(item);

  const check = canAscend(item);
  const { rows, threshold } = actor ? ascensionRows(actor, item) : { rows: [], threshold: 0 };
  const cor = Number(actor?.system?.corruption?.value) || 0;

  return {
    active: !!L.active,
    legendary: !!L.legendary,
    hasActor: !!actor,
    actorName: actor?.name || "",
    // Демоническое Наследием не бывает — это не «нельзя нажать», а правило,
    // и причина показывается словами.
    canAscend: check.ok && !!actor,
    blockReason: check.ok ? "" : check.reason,
    common: LEGACY_COMMON,
    rules: LEGACY_RULES,

    ascension: {
      rows: rows.map(r => ({ ...r, signed: sgn(r.val) })),
      threshold, thresholdSigned: sgn(threshold),
      heavy: isHeavyWeapon(item),
      hardProps: hardProps(item)
    },

    history: L.historyName
      ? {
          name: L.historyName, text: L.historyText, roll: L.historyKey,
          // Наследие Излишеств (wdbc-1rno.35, стр. 427): выбор Характеристики
          // (кроме WS/BS) под опциональный риск +10/W+0-Порча — см.
          // rules/legacy-weapon.mjs::legacyExcessRules.
          isExcess: L.historyName === "Наследие Излишеств",
          excessChar: L.excessChar || "",
          excessCharOptions: L.historyName === "Наследие Излишеств"
            ? Object.entries(CHARACTERISTICS)
                .filter(([k]) => k !== "ws" && k !== "bs")
                .map(([k, meta]) => ({ key: k, label: `${meta.abbr} — ${meta.label}`, selected: k === L.excessChar }))
            : []
        }
      : null,
    histories: LEGACY_HISTORIES.map(h => ({
      roll: h.roll, name: h.name, text: entryText(h, melee),
      selected: h.roll === Number(L.historyKey)
    })),

    bonus: Number(L.bonus) || 0,
    character: L.character || "",
    characterLabel: LEGACY_CHARACTERS[L.character]?.label || "",
    characters: CHARACTER_ORDER.map(k => ({
      key: k, label: LEGACY_CHARACTERS[k].label, selected: k === L.character,
      entries: LEGACY_CHARACTERS[k].entries.map(e => ({
        name: e.name, range: rangeLabel(e), text: entryText(e, melee)
      }))
    })),

    mutations: (L.mutations ?? []).map(m => ({ ...m })),
    mutationSlots: mutationSlots(cor),
    mutationsAvailable: mutationsAvailable(actor, item),
    nextAt: nextMutationAt(cor),
    thresholds: MUTATION_THRESHOLDS,
    corruption: cor
  };
}

// ── Возвышение ────────────────────────────────────────────────────────────

/**
 * Тест Возвышения: Inf+0 с модификаторами. Успех — оружие становится
 * Наследием; провал не запирает попытку навсегда, но повторить её можно
 * лишь подняв Inf.b или совершив деяние (стр. 426), а это решает стол.
 */
export async function rollAscension(item, { deedBonus = 0, legendary = false } = {}) {
  const actor = item.actor;
  if (!actor) return ui.notifications?.warn("Возвышать оружие может только его владелец.");
  const check = canAscend(item);
  if (!check.ok) return ui.notifications?.warn(check.reason);

  const { rows, threshold: ritualThreshold } = ascensionRows(actor, item, { deedBonus, legendary });
  // Возвышение — тест владельца, и штрафы его состояния тела в него входят
  // (wdbc-9jj7): раньше Порог складывался из одной ритуальной арифметики
  // (Бесчестие, Редкость, Тяжёлое, свойства, Легион, деяние), и ни Усталость,
  // ни Черты до него не доезжали. Диалога с галочками у этого броска нет —
  // значит collectTestMods, а не autoTestMods (docs/rules-format.md).
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "inf" });
  const threshold = ritualThreshold + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const passed = rv <= threshold;
  const deg = Math.floor(Math.abs(passed ? threshold - rv : rv - threshold) / 10) + 1;

  if (passed) await applyLegacy(item, { legendary });

  // Первая строка ascensionRows — база (Бесчестие), остальные слагаемые уходят
  // в скобки общего формата Порога (helpers/test-card.mjs).
  await postTestCard(actor, {
    icon: rollIcon("crown", "#e8c76a"),
    title: `Возвышение — ${esc(item.name)}`,
    threshold: rollStatLine({
      label: rows[0]?.label ?? "Бесчестие (Inf)", base: rows[0]?.val ?? 0,
      parts: [...rows.slice(1).map(r => `${r.label} ${sgn(r.val)}`), ...ruleMods.parts],
      threshold, rv
    }),
    outcome: outcomeHtml(passed, passed
      ? `Успех — ${deg} ${_degWord(deg)}. Оружие стало Оружием Наследия.`
      : `Провал — ${deg} ${_degWord(deg)}. Попытку можно повторить, подняв Inf.b или совершив деяние, достойное легенды.`),
    sections: [passed ? `<div class="dc-foot">${LEGACY_COMMON.map(esc).join(" ")}</div>` : ""]
  }, { rolls: [roll] });
}

/** Применить общие свойства Наследия к профилю, сняв снимок прежнего. */
export async function applyLegacy(item, { legendary = false } = {}) {
  const sys = item.system ?? {};
  const bonus = legacyBonus(item.actor, item);
  const preProps = foundry.utils.deepClone(sys.weaponProps || []);

  await item.update({
    "system.legacyWeapon": true,
    "system.legacy.active": true,
    "system.legacy.legendary": !!legendary,
    "system.legacy.bonus": bonus,
    "system.legacy.preProps": preProps,
    "system.legacy.preDamage": sys.damage || "",
    "system.legacy.prePen": Number(sys.penetration) || 0,
    "system.legacy.preQuality": sys.quality || "common",
    "system.weaponProps": propsAfterLegacy(preProps),
    "system.penetration": (Number(sys.penetration) || 0) + bonus,
    "system.damage": addFlatDamage(sys.damage || "", bonus),
    "system.quality": qualityAfterLegacy(sys.quality)
  });
}

/**
 * Разорвать связь (провал теста Ревности): профиль возвращается по снимку,
 * а История и Мутации остаются записанными — при повторном Возвышении книга
 * велит вернуть прежние, а не бросать заново.
 */
export async function breakLegacy(item) {
  const L = item.system?.legacy ?? {};
  if (!L.active) return;
  await item.update({
    "system.legacyWeapon": false,
    "system.legacy.active": false,
    "system.weaponProps": foundry.utils.deepClone(L.preProps || []),
    "system.damage": L.preDamage || item.system.damage,
    "system.penetration": Number(L.prePen) || 0,
    "system.quality": L.preQuality || item.system.quality
  });
  // Карточка без броска — результат действия, не тест (тот же случай, что
  // Сжатие в combat/defense.mjs): сборщик общий, строки Порога и броска нет.
  await postTestCard(item.actor, {
    icon: rollIcon("warn", "#ffb84d"),
    title: `Связь разорвана — ${esc(item.name)}`,
    outcome: "Оружие перестало быть Оружием Наследия. История и Мутации сохранены: при повторном Возвышении они вернутся."
  }, { sound: false });
}

/** Плоская прибавка к строке урона: «1d10+4» → «1d10+6». */
function addFlatDamage(dmg, n) {
  if (!n) return dmg;
  const s = String(dmg || "").trim();
  if (!s) return `+${n}`;
  const m = s.match(/^(.*?)([+-])\s*(\d+)$/);
  if (!m) return `${s}+${n}`;
  const val = (m[2] === "+" ? 1 : -1) * Number(m[3]) + n;
  return `${m[1].trim()}${val >= 0 ? "+" : "−"}${Math.abs(val)}`;
}

// ── История и Мутации ─────────────────────────────────────────────────────

/** Записать Историю (выбором или броском 1d10). */
export async function setHistory(item, roll) {
  const entry = historyByRoll(roll);
  if (!entry) return;
  const update = {
    "system.legacy.historyKey": entry.roll,
    "system.legacy.historyName": entry.name,
    "system.legacy.historyText": entryText(entry, isMeleeWeapon(item))
  };
  // Наследие Боли (wdbc-1rno.35, стр. 427): «Даёт Crippling(1), или Shocking,
  // если уже имело Crippling» — разовое постоянное свойство, применяется
  // здесь же, вместе с записью самой Истории, а не на каждой атаке.
  if (entry.name === "Наследие Боли") {
    update["system.weaponProps"] = painLegacyProps(item.system?.weaponProps ?? []);
  }
  // Наследие Чумы (wdbc-1rno.35, стр. 427): Toxic(0), или +1 к рейтингу,
  // если уже был. Третье предложение книги (альтернативный яд) честно НЕ
  // реализовано — см. заголовок plagueLegacyProps.
  if (entry.name === "Наследие Чумы") {
    update["system.weaponProps"] = plagueLegacyProps(item.system?.weaponProps ?? []);
  }
  await item.update(update);
}

export async function rollHistory(item) {
  const roll = await new Roll("1d10").evaluate();
  await setHistory(item, roll.total);
  const entry = historyByRoll(roll.total);
  // Бросок по ТАБЛИЦЕ, а не тест: Порога нет, и какой именно кубик бросали
  // (1d10) для таблицы важно — поэтому строка кубика своя, а не общая
  // «Бросок: N» (rv намеренно не передаётся).
  await postTestCard(item.actor, {
    icon: rollIcon("crown", "#e8c76a"),
    title: `История — ${esc(item.name)}`,
    lines: [`<div class="roll-dice">${rollIcon("dice", "#6fe6ff")}1d10: <b>${roll.total}</b></div>`],
    outcome: `<b>${esc(entry.name)}</b>`,
    sections: [`<div class="dc-foot">${esc(entryText(entry, isMeleeWeapon(item)))}</div>`]
  }, { rolls: [roll] });
}

/**
 * Бросок очередной Мутации по выбранному Характеру. Уже выпавшее
 * перебрасывается — книга требует именно этого, а не «бросьте ещё раз, если
 * не нравится». Ограничитель на случай, когда взято всё, что таблица даёт.
 */
export async function rollMutation(item, characterKey) {
  const actor = item.actor;
  if (!actor) return ui.notifications?.warn("Мутации считаются от Порчи владельца — оружие должно быть у актора.");
  if (!item.system?.legacy?.active) return ui.notifications?.warn("Сначала Возвысьте оружие.");
  if (mutationsAvailable(actor, item) <= 0) {
    const at = nextMutationAt(actor.system?.corruption?.value);
    return ui.notifications?.warn(at
      ? `Следующая Мутация — при Порче ${at}.`
      : "Все четыре Мутации уже получены.");
  }

  const key = characterKey || item.system.legacy.character;
  if (!LEGACY_CHARACTERS[key]) return ui.notifications?.warn("Выберите таблицу Характера оружия.");

  const taken = takenMutationNames(item);
  let roll, entry, guard = 0;
  do {
    roll = await new Roll("1d10").evaluate();
    entry = mutationByRoll(key, roll.total);
    guard++;
  } while (entry && taken.has(entry.name) && guard < 24);

  if (!entry || taken.has(entry.name)) {
    return ui.notifications?.warn("Свободных Мутаций в этой таблице не осталось.");
  }

  const melee = isMeleeWeapon(item);
  const list = [...(item.system.legacy.mutations ?? []),
    { name: entry.name, text: entryText(entry, melee), roll: roll.total, character: key }];
  const update = { "system.legacy.character": key, "system.legacy.mutations": list };
  // Рваное/fearsome 3-4 (wdbc-1rno.35, стр. 427): разовое постоянное
  // свойство, как у Наследия Боли/Чумы — только у Мутации, не Истории.
  if (entry.name === "Рваное") {
    const infBonus = Number(actor.system?.characteristics?.inf?.bonus) || 0;
    update["system.weaponProps"] = tearingLegacyProps(item.system?.weaponProps ?? [], infBonus);
  }
  // Разбивающее/fearsome 5-6 (wdbc-1rno.35, стр. 427): Power Field/Razor
  // Sharp по классу оружия, «+2 Pen» повтора — плоская правка system.penetration.
  if (entry.name === "Разбивающее") {
    const grant = shatteringLegacyGrant(item);
    update["system.weaponProps"] = grant.props;
    if (grant.penDelta) update["system.penetration"] = (Number(item.system?.penetration) || 0) + grant.penDelta;
  }
  // Ошеломляющее/fearsome 7-7 (wdbc-1rno.35, стр. 427): Concussive, рейтинг
  // по классу оружия. Второе предложение стрелковой ветки (пробитие
  // Поглощения на Уклонении) честно НЕ реализовано — см. stunningLegacyGrant.
  if (entry.name === "Ошеломляющее") {
    const infBonus = Number(actor.system?.characteristics?.inf?.bonus) || 0;
    update["system.weaponProps"] = stunningLegacyGrant(item, infBonus);
  }
  // Быстрое/skilled 8-8 (wdbc-1rno.35, стр. 428), рукопашная ветка: Flexible,
  // или −10 живой Уклонению, если Flexible уже была (решается сейчас, раз и
  // навсегда — см. swiftLegacyMeleeGrant).
  if (entry.name === "Быстрое" && melee) {
    const grant = swiftLegacyMeleeGrant(item);
    update["system.weaponProps"] = grant.props;
    update["system.legacy.swiftDodgePenalty"] = grant.swiftDodgePenalty;
  }
  // Резня/merciless 7-7 и Злобное/merciless 9-9 (wdbc-1rno.35, стр. 428):
  // тот же приём грант/апгрейд рейтинга, что Ошеломляющее выше.
  if (entry.name === "Резня") {
    const infBonus = Number(actor.system?.characteristics?.inf?.bonus) || 0;
    update["system.weaponProps"] = slaughterLegacyGrant(item, infBonus);
  }
  if (entry.name === "Злобное") {
    const infBonus = Number(actor.system?.characteristics?.inf?.bonus) || 0;
    update["system.weaponProps"] = viciousLegacyGrant(item, infBonus);
  }
  // Перебор/fearsome 8-8 (wdbc-1rno.35, стр. 427): «Бонус к урону оружия
  // использует полный Inf.b вместо половины» — уже применённый бонус
  // Возвышения (½Inf.b) ДОПЛАЧИВАЕТСЯ до полного прямо сейчас, не ждёт
  // следующего Возвышения (weaponUpdated с item.system.legacy.mutations уже
  // содержит эту запись — legacyBonus(actor, item) её увидит через list
  // выше, но item.system.legacy ещё старый — считаем явно от list).
  // Второе предложение (Очко Бесчестия → временный 2×Inf.b на ½Inf.b(окр▲)
  // Ходов) честно НЕ реализовано: нужна общая кнопка «потратить Очко
  // Бесчестия на временный эффект Мутации», которой в системе ещё нет —
  // повторяющийся паттерн (≥5 записей таблиц), общая инфраструктура для
  // отдельного тикета, не для этой находки в одиночку.
  if (entry.name === "Перебор" && item.system.legacy?.active) {
    const oldBonus = Number(item.system.legacy?.bonus) || 0;
    const infBonus = Number(actor.system?.characteristics?.inf?.bonus) || 0;
    const newBonus = infBonus; // Перебор всегда даёт ПОЛНЫЙ Inf.b
    const delta = newBonus - oldBonus;
    if (delta !== 0) {
      update["system.legacy.bonus"] = newBonus;
      update["system.penetration"] = (Number(item.system?.penetration) || 0) + delta;
      update["system.damage"] = addFlatDamage(item.system?.damage || "", delta);
    }
  }
  await item.update(update);

  // Тоже бросок по таблице (см. rollHistory): «Порога» здесь нет — строка
  // roll-threshold несёт условия выбора таблицы, а не число, с которым
  // сравнивают бросок.
  await postTestCard(actor, {
    icon: rollIcon("crown", "#e8c76a"),
    title: `Мутация ${list.length} — ${esc(item.name)}`,
    lines: [
      `<div class="roll-threshold">Характер: <b>${esc(LEGACY_CHARACTERS[key].label)}</b> · Порча владельца: <b>${actor.system?.corruption?.value ?? 0}</b></div>`,
      `<div class="roll-dice">${rollIcon("dice", "#6fe6ff")}1d10: <b>${roll.total}</b></div>`
    ],
    outcome: `<b>${esc(entry.name)}</b>`,
    sections: [`<div class="dc-foot">${esc(entryText(entry, melee))}</div>`]
  }, { rolls: [roll] });
}

/**
 * Однострочный ввод. Отмена возвращает null — вызывающий по нему отличает
 * «передумал» от «оставил пустым», а это разные вещи для второго вопроса.
 */
export async function legacyPrompt(label, initial = "") {
  return foundry.applications.api.DialogV2.wait({
    window: { title: label },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<form><div class="atk-dlg-row"><label>${esc(label)}</label>
      <input type="text" name="value" value="${esc(initial)}" style="width:100%"/></div></form>`,
    rejectClose: false,
    buttons: [
      { action: "ok", label: "Готово", default: true,
        callback: (_e, button) => button.form.elements.value.value },
      // `false`, а не `null`: `null` DialogV2 подменяет на сам action («cancel»),
      // и вызывающий (`if (name === null) return`) заводил бы Мутацию с именем
      // «cancel». См. комментарий у pickFromList (sheets/item-sheet.mjs).
      { action: "cancel", label: "Отмена", callback: () => false }
    ]
  }).then(res => res === false ? null : res);
}

/** Своя Мутация вместо броска — книга разрешает это для 3-й и 4-й (стр. 428). */
export async function addCustomMutation(item, name, text) {
  const list = [...(item.system?.legacy?.mutations ?? []),
    { name: String(name || "Нестандартная Мутация"), text: String(text || ""), roll: 0, custom: true }];
  await item.update({ "system.legacy.mutations": list });
}

export async function removeMutation(item, index) {
  const list = [...(item.system?.legacy?.mutations ?? [])];
  if (!list[index]) return;
  list.splice(index, 1);
  await item.update({ "system.legacy.mutations": list });
}

/** Качество словами — подпись в блоке. */
export const qualityLabel = key => ITEM_QUALITY?.[key]?.label || key;
