// module/sheets/attack/talent-toggles.mjs
// ══════════════════════════════════════════════════════════════════════════
//  ГАЛОЧКИ ТАЛАНТОВ ГЛАВЫ 3 в окне атаки (Sahara 3-9d40 / 3-5fbf).
//
//  Таланты Стрелка и Оружейника, которые включаются перед броском («может
//  выбрать…», «может потратить Очко…»), сидят в одном блоке «Таланты» окна.
//  Каждый — элемент с классом .atk-talent-toggle и data-key; форма читает их
//  все одним проходом (form.mjs → talentToggles) и несёт в бросок как
//  opts.talentToggles.<ключ>, а решение «сработало ли» принимает attack.mjs
//  через чистые функции rules/gunner-talents.mjs и rules/gunsmith-talents.mjs.
//
//  Модуль только рисует: ни бросков, ни записи в документы.
// ══════════════════════════════════════════════════════════════════════════

import { esc } from "../../helpers/utils.mjs";
import { hasGunnerTalent, eyeOfVengeanceAvailable, EYE_OF_VENGEANCE_FLAG } from "../../rules/gunner-talents.mjs";
import { killingStrikeOffered, oneWillGoDownOffered } from "../../rules/berserker-talents.mjs";
import { haymakerOffered, goadingStrikeOffered } from "../../rules/pugilist-talents.mjs";
import { hasGunsmithTalent, weaponTechAvailable, WEAPON_TECH_SPENT_FLAG, lensTuningAvailable, LENS_CHARGES_FLAG,
  litanyCoversWeapon, litanyReliability, litanyUnresolved, LITANY_CLEANED_FLAG } from "../../rules/gunsmith-talents.mjs";

import { grenadeCookingOffered } from "../../rules/throwing-talents.mjs";
import { torrentOffered, torrentWorkedShifts, torrentBlastRadius, torrentMaxDistance } from "../../rules/flamer-talents.mjs";

const NS = "warhammer-dbc";

const check = (key, text, title, { checked = false, disabled = false } = {}) => `
    <label class="attack-mod-check" title="${esc(title)}">
      <input type="checkbox" class="atk-talent-toggle" data-key="${key}"${checked ? " checked" : ""}${disabled ? " disabled" : ""}/> ${text}
    </label>`;

/**
 * @param {Actor}  actor
 * @param {Item}   item
 * @param {object} ctx  isMelee, wProps (разобранные свойства оружия), wideBurstAvailable
 * @returns {string} разметка блока; "" — ни один Талант не применим
 */
export function talentTogglesHtml(actor, item, { isMelee, wProps = [], sys = {} } = {}) {
  if (isMelee) {
    // Смертельный Удар (Берсерк, rules/berserker-talents.mjs): База выбирается в этом же окне, поэтому
    // галочка видна всегда, а срабатывает только на Полной Атаке (проверяет бросок, attack.mjs).
    const meleeOut = [];
    if (killingStrikeOffered(actor, { isMelee })) {
      meleeOut.push(check("killingStrike",
        "Смертельный Удар (−1 Очко Бесчестия: Избегания цели от Полной Атаки невозможны; раз в Ход)",
        "Смертельный Удар: атака с Базой «Полная Атака» — потратив Очко Бесчестия, вы делаете любые тесты на Избегание цели от этой атаки проваленными. Очко уходит при попадании, раз в Ход; на другой Базе галочка ничего не делает."));
    }
    if (oneWillGoDownOffered(actor, { isMelee })) {
      meleeOut.push(check("oneWillGoDown",
        "Один Из Нас Падёт (Полная Атака по Ненавистной цели: Dmg ×2; цена — 1d5 в руку и Усталость)",
        "Один Из Нас Падёт: атака с Базой «Полная Атака» по Ненавистной цели (выделите её на сцене) — Dmg ×2 до Поглощения. Цена при любом исходе, даже при промахе: 1d5 непоглощаемого урона в руку; Усталость — 1, если удар убил или вывел цель из строя, иначе T.b+W.b и потеря сознания (итог — кнопка на карточке). На другой Базе или по не-Ненавистной цели ничего не стоит и ничего не даёт."));
    }
    if (haymakerOffered(actor, item)) {
      meleeOut.push(check("haymaker",
        "Тяжёлый Хук (отказ от второй руки в этот Ход: +½T.b Dmg; попавшая цель проходит S+0 vs S+0 или Ничком)",
        "Тяжёлый Хук: атака кулаком — вы отказываетесь от атаки второй рукой в этот Ход («Обе руки» закрываются) и получаете +½T.b к Dmg (окр. вниз). Если цель получила попадание, в карточке урона появится кнопка встречного теста S+0 vs S+0: проигравшая цель Сбивается с ног."));
    }
    if (goadingStrikeOffered(actor, item)) {
      meleeOut.push(check("goadingStrike",
        "Направляющий Удар (−20 к атаке кулаком; при Успехе — свободное Давление, даже если цель Избежит)",
        "Направляющий Удар: атака кулаком получает штраф −20 (он сразу в пороге ниже); при Успехе на карточке атаки появится кнопка Давления против цели за свободное действие — даже если цель потом Избежит самого удара."));
    }
    if (!meleeOut.length) return "";
    return `
    <div class="av-section atk-talent-toggles">
      <div class="av-sec-lbl">Таланты</div>${meleeOut.join("")}
    </div>`;
  }
  const has = key => wProps.some(p => (p?.key ?? p) === key);
  const out = [];

  // Выдержка Гранаты (rules/throwing-talents.mjs): тест Logic(I)+0 перед броском гранаты.
  if (grenadeCookingOffered(actor, { sys: { ...item?.system, ...sys }, isMelee })) {
    out.push(check("grenadeCooking",
      "Выдержка Гранаты (Logic(I)+0 до броска: Успех — Уклонение −5 за Успех; Провал — граната Очень Ненадёжна)",
      "Выдержка Гранаты: перед броском гранаты проходится Logic(I)+0. Успех — все тесты Уклонения от этой гранаты получают −5 за каждый Успех; Провал — граната получает Очень Ненадёжное, но её всё равно нужно метнуть."));
  }

  // Верный Выстрел: только одиночный выстрел, трата Очка — при успехе.
  if (hasGunnerTalent(actor, "sureShot")) {
    out.push(check("sureShot", "Верный Выстрел (−1 Очко Бесчестия при попадании: Уклонение цели −10 за Успех)",
      "Верный Выстрел: после успешного ОДИНОЧНОГО выстрела можно потратить 1 Очко Бесчестия — противник получает −10 за каждый Успех на попадание на все броски Избегания против этого выстрела."));
  }

  // Око Мщения: Очко платится один раз, бонус держится до конца Хода (флаг на акторе).
  if (eyeOfVengeanceAvailable(actor, { isMelee })) {
    const active = actor.getFlag?.(NS, EYE_OF_VENGEANCE_FLAG) === item?.id;
    out.push(check("eyeOfVengeance",
      active ? "Око Мщения действует до конца Хода (+Inf.b к Dmg и Pen)" : "Око Мщения (−1 Очко Бесчестия: +Inf.b к Dmg и Pen этого оружия до конца Хода)",
      "Око Мщения: можно потратить 1 Очко Бесчестия — добавить Inf.b к Dmg и Pen одного стрелкового оружия до конца Хода. Пока оружие усилено, повторно платить не нужно.",
      { checked: active, disabled: active }));
  }

  // Контролируемая Очередь / Огневая Клеть: только у оружия с Очередью.
  const hasBurst = (Number(sys.rof_semi) || 0) > 0 || (Number(sys.rof_full) || 0) > 0;
  if (hasBurst && hasGunnerTalent(actor, "controlledBurst")) {
    out.push(check("controlledBurst", "Контролируемая Очередь (расход патронов — до половины RoF, но не меньше попаданий+1)",
      "Контролируемая Очередь: после Короткой/Длинной очереди (но не Широкой и не Подавления) расчётный RoF можно уменьшить до половины (окр.▲), но не меньше числа попаданий +1 (без бонусных от свойств)."));
  }
  if ((Number(sys.rof_full) || 0) > 0 && hasGunnerTalent(actor, "cageFiring")) {
    out.push(check("cageFiring", "Огневая Клеть (Широкая Длинная очередь: RoF ещё −3, цель тратит вдвое больше Успехов на Уклонение)",
      "Огневая Клеть: Широкая Длинная Очередь по одиночной цели — эффективный RoF ещё на 3 меньше, но цель должна тратить вдвое больше Успехов для Уклонения. Включайте вместе с галочкой «Широкая Очередь»."));
  }

  // Облучить: только у оружия со свойством Rad.
  if (has("rad") && hasGunsmithTalent(actor, "irradiate")) {
    out.push(`
    <label class="attack-mod-check" title="Облучить: до броска выбрать — удвоить рейтинг Felling или считать пробитие брони для свойства Rad без удвоения AP цели.">
      Облучить:
      <select class="atk-talent-toggle" data-key="irradiate">
        <option value="">— без выбора —</option>
        ${has("felling") ? `<option value="felling">удвоить рейтинг Felling</option>` : ""}
        <option value="noDouble">пробитие Rad без удвоения AP цели</option>
      </select>
    </label>`);
  }

  // Тех-Оружейник: усиленный выстрел плазмой/мельтой/экзотикой раз на оружие до новой настройки.
  if (weaponTechAvailable(actor, { item, isMelee })) {
    const spent = !!item.getFlag?.(NS, WEAPON_TECH_SPENT_FLAG);
    out.push(check("weaponTech",
      spent ? "Тех-Оружейник: усиленный выстрел (оружие не настроено заново — сначала отметьте перенастройку)" : "Тех-Оружейник: усиленный выстрел (+I.b к Dmg и Pen этого оружия)",
      "Тех-Оружейник: +I.b к Dmg и Pen плазменного, мельта или экзотического оружия. Нужно 5 минут подготовки (можно заранее); второй раз тем же оружием — только после новой настройки."));
    out.push(check("weaponTechRetune", "Оружие перенастроено (5 минут): снова доступен усиленный выстрел",
      "Отметьте, если персонаж потратил 5 минут на подготовку этого оружия — метка «усиленный выстрел уже сделан» снимется."));
  }

  // Настройка Линз: заряды на лаз-оружии (флаг на предмете).
  if (lensTuningAvailable(actor, { item, isMelee })) {
    const charges = Number(item.getFlag?.(NS, LENS_CHARGES_FLAG)) || 0;
    const ib = Number(actor.system?.characteristics?.int?.bonus) || 0;
    out.push(check("lensTune", `Линзы настроены только что (5 минут): зарядов станет I.b = ${ib} (сейчас ${charges})`,
      "Настройка Линз: 5 минут калибровки дают лаз-оружию I.b зарядов (заменяют прежние)."));
    out.push(check("lensUse", "Настройка Линз: потратить заряд — Felling (I.b) и Precise на эту атаку",
      "Настройка Линз: 1 заряд — оружие получает Felling (I.b) и Precise на эту атаку. Precise — скидка +20 к штрафу Избирательной атаки по сочленению и глазу: Порог в окне пересчитывается сразу."));
  }

  // Литания Чистки: метка «чищено за сутки» по типу оружия — на актора.
  if (litanyCoversWeapon(actor, item)) {
    const cleaned = actor.getFlag?.(NS, LITANY_CLEANED_FLAG) ?? {};
    const now = Number(globalThis.game?.time?.worldTime) || 0;
    const active = litanyReliability(actor, { item, isMelee, cleaned, worldTime: now }) > 0;
    out.push(check("litanyCleaned",
      active ? "Литания Чистки действует: оружие чищено за последние сутки (+1 Надёжность)" : "Литания Чистки: оружие этого типа чищено сегодня (30 минут) — +1 Надёжность на сутки",
      "Литания Чистки: если в сутки тратить хотя бы 30 минут на чистку оружия выбранного типа, оно получает +1 к Надёжности. Отметка действует 24 часа мирового времени.",
      { checked: active, disabled: active }));
  }

  // Литания, купленная без выбора типа оружия, молчит — подсказать, как её оживить (иначе игрок не поймёт,
  // почему галочки нет).
  if (item?.system?.weaponType && !litanyCoversWeapon(actor, item) && litanyUnresolved(actor).length) {
    out.push(`<div class="roll-threshold" title="Литания Чистки куплена без выбора типа оружия — механика молчит, пока тип не вписан.">Литания Чистки: тип оружия не выбран — впишите его в специализацию Таланта на листе (Bolt, Las, Melta…), и галочка появится у этого оружия.</div>`);
  }

  // Поток: огнемёт, над которым работали смену в Мастерской Крафта (rules/flamer-talents.mjs).
  if (torrentOffered(actor, { item, isMelee })) {
    const worked = torrentWorkedShifts(item) >= 1;
    const rng = Number(sys.range ?? item?.system?.range) || 0;
    out.push(check("torrent",
      worked
        ? `Поток: расход боеприпасов ×2, шаблон Blast(${torrentBlastRadius(rng)} м) до ${torrentMaxDistance(rng)} м вместо конуса`
        : "Поток недоступен: над этим огнемётом ещё не работали ни одной смены (отметьте смену в Мастерской Крафта)",
      "Поток: если над огнемётом работали хотя бы одну смену, можно удвоить расход боеприпасов и вместо каплевидного шаблона поставить шаблон Blast(Rng/5+1) в пределах удвоенной дальности и прямой видимости; попадание — по правилам Распыления.",
      { disabled: !worked }));
  }

  return out.length ? `
    <div class="av-section atk-talent-toggles">
      <div class="av-sec-lbl">Таланты</div>${out.join("")}
    </div>` : "";
}
