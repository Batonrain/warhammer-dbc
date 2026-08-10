/**
 * Библиотека Техночудес (Мистика Механикум) — Warhammer DBC.
 *
 * Компендиум "warhammer-dbc.tech-powers". Заполняется ready-хуком
 * (см. warhammer-dbc.mjs) с созданием вложенных папок по пути folder[] через
 * _ensureWeaponFolder. Идемпотентно: добавляет недостающее по имени.
 *
 * Структура папок (скриншот): ТЕХНОЧУДЕСА → МОТИВОТЕУРГИЯ / КИБЕРТЕУРГИЯ /
 *   НООТЕУРГИЯ / АНИМАТЕУРГИЯ, в каждой — суб-школы.
 *
 * ВАЖНО про Цену: первая цифра — Когниция, вторая — Энергия. Одна цифра —
 * только Когниция. В библиотеке: cog = Когниция, en = Энергия.
 * cognitionCost/energyCost — структурные поля; Железо, полный Процесс и полный
 * список Типов сохраняются в шапке текста effect, чтобы ничего не терялось.
 */

const IMG = "icons/svg/circle.svg";

// o: { mt, rating, cog, en, sc, skill, test, act, rng, dmg, dmgT, pen, hw, proc, type, fx }
//   mt — miracleType (anima|doctrine|imperative|compensator|manipula|passive|slavoslovie)
//   cog/en — цена Когниции/Энергии; sc — Процесс (Когниция) для поля; proc — полная строка Процесса
//   hw — Железо; type — полная строка «Тип»; skill — навык теста (techUse по умолч.)
function TC(name, o) {
  const costStr = (o.cog || o.en)
    ? `${o.cog ?? 0}К${o.en ? `+${o.en}Э` : ""}` : "—";
  const hdr = `[Железо: ${o.hw || "—"} · Цена: ${costStr} · Процесс: ${o.proc || "Нет"} · Тип: ${o.type || "—"}]`;
  return {
    name, type: "techPower", img: IMG,
    system: {
      description: "", notes: "",
      discipline: "", subtype: "",
      miracleType: o.mt || "imperative",
      extraTypes: [], rating: o.rating ?? 1,
      cognitionCost: o.cog ?? 0, energyCost: o.en ?? 0,
      sustainCost: o.sc ?? 0, sustainAction: "free",
      testSkill: o.skill || "techUse", testMod: o.test ?? 0,
      action: o.act || "full", sustained: false, compiled: false,
      range: o.rng || "", damage: o.dmg || "", damageType: o.dmgT || "energy",
      penetration: o.pen ?? 0,
      effect: `${hdr} ${o.fx || ""}`.trim(),
      effects: { charBonusStat: "", charBonusValue: 0, charBonuses: [] }
    }
  };
}

const TECH = "ТЕХНОЧУДЕСА";
const MOT = [TECH, "МОТИВОТЕУРГИЯ"];
const CYB = [TECH, "КИБЕРТЕУРГИЯ"];
const NOO = [TECH, "НООТЕУРГИЯ"];
const ANI = [TECH, "АНИМАТЕУРГИЯ"];

const DISC_BY_FOLDER = {
  "МОТИВОТЕУРГИЯ": "motivotheurgy", "КИБЕРТЕУРГИЯ": "cybertheurgy",
  "НООТЕУРГИЯ": "nootheurgy", "АНИМАТЕУРГИЯ": "animatheurgy"
};
const SUBTYPE_FIX = { "Рунический Код": "Рунический код" };
const grp = (folder, arr) => {
  const discipline = DISC_BY_FOLDER[folder[1]] || "";
  const leaf = folder[folder.length - 1];
  const subtype = SUBTYPE_FIX[leaf] ?? (folder.length > 2 ? leaf : "");
  return arr.map(p => ({ ...p, folder, system: { ...p.system, discipline, subtype } }));
};

export const TECH_POWERS_LIBRARY = [].concat(

  // ═══════════ МОТИВОТЕУРГИЯ ═══════════
  // ── Вольтагейст ──
  grp([...MOT, "Вольтагейст"], [
    TC("Voltagheist Shield / Вольтагейст Щит", { mt: "compensator", rating: 0, cog: 1, en: 1, sc: 0,
      act: "free", rng: "Сам", hw: "Ferric Lure Implants, Luminen Capacitors", proc: "½ (У)", type: "Компенсатор (0)",
      fx: "Треб.: T 35, Tech-Use+10. Не перегружающийся технологический щит-купол 1-(½I окр.▲ +10). Техножрец после броска урона решает, применять ли щит; каждое успешное отражение тратит 1 Энергию (Компенсатор применим)." }),
    TC("Voltagheist Chapel / Вольтагейст Капелла", { mt: "compensator", rating: 1, cog: 2, en: 1,
      act: "reaction", rng: "I.b×2м", skill: "techUse", test: 0, hw: "Ferric Lure Implants, Luminen Capacitors", proc: "Нет", type: "Компенсатор (1), Реакция",
      fx: "Треб.: T 40, Tech-Use+20, Voltagheist Shield. Только с Вольтагейст Щитом в Процессах, как реакция на урон союзнику в дальности. Союзник получает щит 1-(½I окр.▲ +10) против этой атаки и до начала след. Хода. Каждое успешное отражение (кроме первого) тратит 1 Энергию (Компенсатор применим)." }),
    TC("Voltagheist Vestments / Вольтагейст Риза", { mt: "passive",
      act: "free", rng: "Сам", hw: "Ferric Lure Implants, Luminen Capacitors", proc: "Нет", type: "Пассивное",
      fx: "Треб.: T 40, Tech-Use+20, Voltagheist Shield. Перед броском щита от Вольтагейст Щита/Капеллы можно увеличить цену срабатывания в Энергии и рейтинг Компенсатора на +1, чтобы поднять рейтинг щита до 1-I." }),
    TC("Voltagheist Retribution / Вольтагейст Воздаяние", { mt: "passive", cog: 1,
      act: "free", rng: "I×2м", skill: "techUse", test: 0, hw: "Ferric Lure Implants, Luminen Capacitors", proc: "Нет", type: "Незримое, Пассивное, Стрельба",
      dmg: "Xd10+I.b", dmgT: "energy", pen: 0,
      fx: "Треб.: T 50, Tech-Use+30, Voltagheist Vestments. Успешное отражение Вольтагейст Щитом (не Капеллой) даёт 1 заряд (до 5). Потратив все заряды (X): авто-стрелковое попадание Xd10+I.b E(Ls), Pen 0, Extreme (11−X), Rad (Xd5). Засекающие радиацию видят луч и Избегают (игнор Незримое)." })
  ]),

  // ── Голограф ──
  grp([...MOT, "Голограф"], [
    TC("Holographic Veil / Голографическая Вуаль", { cog: 3, sc: 2,
      act: "free", rng: "Сам", skill: "techUse", test: 0, hw: "Maglev Coils, Luminen Capacitors", proc: "2 (У)", type: "—",
      fx: "Треб.: P 35, Tech-Use+10. Стрелковые атаки по техножрецу с короткой+ дистанции −I.b×3, рукопашные/в упор −I.b×2 (если атакующий полагается на зрение; Blind Fighting уменьшает второй штраф). Избирательные — штрафы ×2." }),
    TC("Holographic Mask / Голографическая Маска", { act: "free", rng: "Сам", skill: "techUse", hw: "Maglev Coils, Luminen Capacitors", proc: "X (У)", type: "—",
      fx: "Треб.: P 40, Tech-Use+20, Holographic Veil. Цена/Процесс = X (выбирается, меняется в начале Хода). Тест Tech-Use(I)+10×X. Меняет внешность на любую сравнимого Размера, создаёт/скрывает иллюзорное оружие/снаряжение. Наблюдатели: Awareness−10 и X×2 Успехов, чтобы распознать. Только зрение." }),
    TC("Holographic Host / Голографическое Воинство", { cog: 4, sc: 3,
      act: "free", rng: "Сам", skill: "techUse", test: -10, hw: "Maglev Coils, Luminen Capacitors", proc: "3", type: "—",
      fx: "Треб.: P 50, Tech-Use+20, Holographic Veil. Множество голографических копий. При попадании не по площади бросок 1d10: 4+ атака проходит сквозь иллюзию (Избирательные 3+; Широкая Очередь/Подавление/Взмах 6+). Не работает против слепых атак. Свои рукопашные/в упор: цели без альт. чувств перебрасывают успешные Избегания." }),
    TC("Holographic Sacrament / Голографическое Таинство", { cog: 5, sc: 4,
      act: "free", rng: "Сам", skill: "techUse", test: -20, hw: "Maglev Coils, Luminen Capacitors", proc: "4", type: "—",
      fx: "Треб.: P 50, Tech-Use+30, Holographic Host. Невидимость для обычного и теплового зрения. Засекается по следам/звуку Awareness+0 vs Stealth+0 (бой вслепую) или альт. чувством/Ноосферным Сканированием. Может скрывать и других персонажей в своём пространстве." })
  ]),

  // ── Люминен ──
  grp([...MOT, "Люминен"], [
    TC("Luminen Shock / Люминен Шок", { mt: "compensator", rating: 0, cog: 1, en: 1,
      act: "free", rng: "Касание", skill: "techUse", hw: "Luminen Capacitors", proc: "Нет", type: "Компенсатор (0), Реакция",
      dmg: "1d10+I.b", dmgT: "energy", pen: 2,
      fx: "Все, кого техножрец касается телом/электропроводящим оружием (или кто касается его таким оружием): неизбегаемое 1d10+I.b E(El), Pen 2, Shocking. Можно как реакция на контакт (не тратя Реакций), но не чаще раза в Раунд." }),
    TC("Luminen Surge / Люминен Всплеск", { mt: "compensator", rating: 0, cog: 1, en: 1,
      act: "half", rng: "I×1м", skill: "techUse", test: 0, hw: "Luminen Capacitors", proc: "Нет", type: "Атака, Компенсатор (0), Манипула (1), Стрельба, Физическое",
      dmg: "1d10+I.b", dmgT: "energy", pen: 2,
      fx: "Треб.: I 40, Tech-Use+10, Luminen Shock. Цель: 1d10+I.b E(El), Pen 2, Arc (7/1d10+½I.b окр.▲), Shocking. Для Уклонения цель должна потратить не меньше Успехов, чем техножрец на активации." }),
    TC("Luminen Pila / Люминен Шар", { mt: "compensator", rating: 1, cog: 2, en: 1, sc: 0,
      act: "half", rng: "I×5м", skill: "techUse", test: 0, hw: "Luminen Capacitors, Maglev Coils", proc: "½", type: "Атака, Компенсатор (1), Манипула (1), Физическое",
      dmg: "2d10+I.b", dmgT: "energy", pen: 2,
      fx: "Треб.: I 50, Tech-Use+20, Luminen Surge. Шаровая молния Размером −2 в контакте; раз в Ход своб. действием двигать на I×1м (как летающее). При касании существа/предмета — взрыв (или своб. действием/Реакцией): 2d10+I.b E(El), Pen 2, Blast (½I.b окр.▲), Shocking." }),
    TC("Luminen Smite / Люминен Сокрушение", { mt: "compensator", rating: 2, cog: 2, en: 3,
      act: "full", rng: "I×1м", skill: "techUse", test: -10, hw: "Luminen Capacitors", proc: "Нет", type: "Атака, Компенсатор (2), Манипула (2), Стрельба, Физическое",
      dmg: "2d10+2×I.b", dmgT: "energy", pen: 0,
      fx: "Треб.: I 55, Tech-Use+30, Luminen Pila. Молния: 2d10+2×I.b E(El), Pen ½I.b, Arc (7/1d10+I.b), Concussive (2), Extreme (7); затем взрыв ударной волны 3d10 X, Pen 0, Blast (½I.b окр.▲), Concussive (2). Уклонение от молнии — не меньше Успехов активации; Избежавший молнию не получает урон от взрыва." }),
    TC("Luminen Drain / Люминен Вытягивание", { mt: "passive",
      act: "full", rng: "—", hw: "Luminen Capacitors", proc: "Нет", type: "Пассивное",
      fx: "Треб.: I 50, Tech-Use+20, Luminen Shock. Если Люминен Шок наносит непоглощённый урон — авто-тест Компенсатора, +1 Энергия техножрецу, цель +1 Усталости." }),
    TC("Luminen Channel / Люминен Канал", { mt: "manipula", rating: 2, cog: 1, sc: 0,
      act: "half", rng: "I×3м", skill: "techUse", test: 0, hw: "Maglev Coils", proc: "½", type: "Манипула (2), Незримое, Физическое",
      fx: "Треб.: Luminen Surge. До ½I.b(окр.▲) незримых магнитных якорей. Люминен Всплеск можно нацелить на якорь, перенаправив молнию в цель/другой якорь в I×1м (огибая укрытия, удлиняя дальность). Перенаправление Люминен Сокрушения через якорь стоит 1 Энергию." }),
    TC("Luminen Duality / Люминен Двойственность", { mt: "passive",
      act: "full", rng: "—", hw: "Luminen Capacitors, Maglev Coils", proc: "Нет", type: "Пассивное",
      fx: "Треб.: Luminen Surge. Две атаки Люминен Всплеском/Шаром как одно полудействие (разными руками); Люминен Шок до 2 раз в Раунд из двух точек контакта." }),
    TC("Luminen Desecration / Люминен Осквернение", { mt: "compensator", rating: 1, cog: 5, en: 2,
      act: "full", rng: "I×0,5м", skill: "techUse", test: -20, hw: "Luminen Capacitors", proc: "Нет", type: "Атака, Компенсатор (1), Манипула (1), Стрельба, Физическое",
      fx: "Треб.: I 60, For.Lore (Mechanicum)+20, Luminen Smite. За нечётный Успех — молния в цель (Избегание как от стрельбы, отдельные атаки). Без урона, но 1d5−1 Раундов эффект 7-8 «Мёртвая Зона» (Haywire). Разряжает батареи/источники (восстанавливая до 1 Энергии с каждого)." }),
    TC("Doctrina Fulgurite / Доктрина Фульгурит", { mt: "doctrine", cog: 3, sc: 0,
      act: "free", rng: "Сам", hw: "Luminen Capacitors", proc: "½", type: "Доктрина",
      fx: "Треб.: Luminen Shock. Люминен Шок получает Tearing и +½I.b(окр.▲) Pen. Цель с непоглощ. уроном от Шока: T+0 или 1 Усталости и дуга Arc (1d10+½I.b окр.▲)." }),
    TC("Doctrina Corpuscarii / Доктрина Корпускарии", { mt: "doctrine", cog: 3, sc: 0,
      act: "free", rng: "Сам", hw: "Luminen Capacitors", proc: "½", type: "Доктрина",
      fx: "Треб.: Luminen Surge. Люминен Всплеск получает Tearing и +½Успехи(окр.▲) Pen (после Уклонения), но теряет Компенсатор. После Избеганий можно потратить 1 Энергию: авто-Дуга с профилем самой молнии (можно продолжать тратить Энергию на ещё Дуги)." }),
    TC("Litany of the Electromancer / Литания Электроманта", { mt: "compensator", rating: 1, cog: 3, en: 2, sc: 1,
      act: "half", rng: "I×3м", skill: "techUse", test: 0, hw: "Luminen Capacitors", proc: "1 (У)", type: "Компенсатор (1), Манипула (1), Славословие (1)",
      dmg: "1d10+I.b", dmgT: "energy", pen: 0,
      fx: "Треб.: For.Lore (Mechanicum)+20. До I.b целей в коронах статики на Успехи Раундов. При рукопашной/в упор атаке по цели — корона развеивается, в атакующего 1d10+I.b E(El), Pen ½I.b, Extreme (7), Shocking (AP не удваивается; Оглушённый атакующий — атака отменяется). При прекращении/выходе из дальности корона разряжается в саму цель." }),
    TC("Crown of Elder Nikola / Корона Старца Николы", { mt: "compensator", rating: 1, cog: 3, en: 3, sc: 1,
      act: "free", rng: "Сам", skill: "techUse", test: -10, hw: "Luminen Capacitors", proc: "1 , 1 (У)", type: "Компенсатор (1), Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Аура Успехи м. Атаке E(El) в ауре техножрец даёт +1 кубик урона и −2 к первому рейтингу Arc, либо −1 кубик и +2 к Arc (до 10). В начале Хода аура −1 м." }),
    TC("Fulgurite Core / Фульгуритовое Ядро", { mt: "passive", cog: 1,
      act: "reaction", rng: "Сам", hw: "Luminen Capacitors", proc: "Нет", type: "Реакция",
      fx: "Треб.: For.Lore (Mechanicum)+20, Doctrina Fulgurite. При попадании E(El) — нивелировать весь урон и эффекты, восстановить 1 Энергию." }),
    TC("Doctrina Negavolt / Доктрина Негавольт", { mt: "doctrine", cog: 4,
      act: "free", rng: "Сам", hw: "Luminen Capacitors", proc: "1", type: "Анима, Доктрина",
      fx: "Треб.: Cor 30, Hatred, Doctrina Fulgurite, Doctrina Corpuscarii. При уроне Люминен-техночуда — до 3 Энергии: +кубик урона за каждую (по одной цели), игнор Daemonic/Stuff of Nightmares. Ненавистная цель: +1 кубик без траты Энергии (макс. +2 ещё). Непоглощ. урон/убийство Ненавистной → +1 Энергия (2 за убийство). Падение уровня ранения → +1 Энергия." }),
    TC("Electroepithany / Электропрозрение", { cog: 2,
      act: "free", rng: "Сам", hw: "Luminen Capacitors", proc: "Да", type: "—",
      fx: "Треб.: P 40, Tech-Use+10. Отключает обычное зрение, давая Unnatural Senses (P) (незримые электро/магнитные эффекты). Процесс 1 Энергия — не отключать зрение (но перебрасывать успешные Awareness)." }),
    TC("Invocation of the Storm / Обращение к Шторму", { mt: "compensator", rating: 1, cog: 3, en: 5, sc: 1,
      act: "full", rng: "I×2м", skill: "techUse", test: 0, hw: "Luminen Capacitors", proc: "1 , 2 (У)", type: "Атака, Компенсатор (1), Манипула (2), Славословие (2), Физическое",
      dmg: "2d10+I.b", dmgT: "energy", pen: 0,
      fx: "Треб.: For.Lore (Mechanicum)+30. Облако шторма: 2d10+I.b E(El), Pen ½I.b, Blast (I.b), Extreme (7), Linger (?/1d10), Shocking, Smoke (I.b). До ½I.b(окр.▲) целей иммунны. Остаётся, пока Процесс активен; в начале Хода смещение (Tech-Use−20 — ±Успехи м)." })
  ]),

  // ── Феррик ──
  grp([...MOT, "Феррик"], [
    TC("Ferric Summon / Феррический Призыв", { mt: "manipula", rating: 1, cog: 1,
      act: "half", rng: "I×1м", hw: "Ferric Lure Implants", proc: "Нет", type: "Манипула (1), Незримое, Физическое",
      fx: "Притягивает в руку хотя бы наполовину металлический предмет ≤I.b×10кг в дальности. Удерживаемый другим — встречный I+0 vs S+0, при победе вырывает." }),
    TC("Ferric Chains / Феррические Цепи", { mt: "compensator", rating: 0, cog: 2, en: 1,
      act: "half", rng: "I×1м", hw: "Ferric Lure Implants", proc: "Нет", type: "Атака, Компенсатор (0), Манипула (2), Незримое, Физическое",
      dmg: "1d10+I.b", dmgT: "impact", pen: 0,
      fx: "Треб.: I 40, Tech-Use+10, Ferric Summon. Два металлических предмета ≤I.b×50кг в I×1м притягиваются друг к другу (лёгкий «падает» на тяжёлый). На персонаже — S+0 vs I+0 за опору. Падение: 1d10+I.b I(Cr), Pen 0. «Примагниченные» до начала след. Хода (полудействием встречный снова). Примагниченный к тяжёлому не может двигаться/Уклоняться." }),
    TC("Ferric Sanctuary / Феррическое Святилище", { mt: "compensator", rating: 0, cog: 2, en: 1, sc: 0,
      act: "half", rng: "Сам", hw: "Ferric Lure Implants", proc: "½ (У)", type: "Компенсатор (0), Незримое",
      fx: "Треб.: I 50, Tech-Use+20, Ferric Chains. Аура I.b×1м. Металлическое метательное/гранаты по целям в ауре −I. Гранаты внутри выталкиваются. Противник в металлической броне/с аугметикой: S+0 vs I+0 для входа (иначе стоп на границе). Остановив противника Размером ≥ техножреца — Процесс 1 Энергия (Компенсатор)." }),
    TC("Ferric Exousia / Феррическая Эксусия", { cog: 2,
      act: "reaction", rng: "I.b×1м", skill: "techUse", test: -10, hw: "Ferric Lure Implants", proc: "Нет", type: "Избегание, Незримое, Реакция",
      fx: "Треб.: I 55, Tech-Use+30, Ferric Sanctuary. Реакция на попадание металлическим снарядом (пуля/болт/ракета/нож) по любому в дальности. За Успех — отменить одно попадание и при желании перенаправить в другую цель в дальности (шаблон: техножрец выбирает точку смещения)." }),
    TC("Doctrina Lorentica / Доктрина Лорентика", { mt: "doctrine", cog: 2,
      act: "free", rng: "Сам", hw: "Ferric Lure Implants", proc: "2", type: "Доктрина",
      fx: "Треб.: Tech-Use+10, Ferric Summon. +I.b×2 к WS, BS, S, A для действий бионическими конечностями или конечностями в металлической броне. Раз в Ход своб. действием до 3 Энергии: Unnatural S (+2) или Unnatural A (+2) за каждую до начала след. Хода." }),
    TC("Ferric Commandment / Феррическая Заповедь", { cog: 2, sc: 2,
      act: "free", rng: "I×0,5м", hw: "Ferric Lure Implants, Maglev Coils", proc: "2 (У)", type: "Незримое",
      fx: "Треб.: I 50, Tech-Use+20, Ferric Chains. Пара магнитных «рук» (Multiple Arms +2) для действий (вкл. оружие) в дальности, но только с ≥наполовину металлическими предметами. Используют I вместо WS/BS/S/A; невидимы для незасекающих Ноосферу/магнетизм." }),
    TC("Sacred Host of Olympus / Священное Воинство Олимпа", { mt: "compensator", rating: 1, cog: 3, en: 1, sc: 1,
      act: "half", rng: "I×1м", skill: "techUse", test: 0, hw: "Ferric Lure Implants", proc: "1 (У)", type: "Компенсатор (1), Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. До Успехи незакреплённого рукопашного оружия зависает вокруг. Своб. действием 1 Энергия — запустить оружие в цель в I×3м (авто-попадание, I.b вместо S.b); +1 Энергия (Компенсатор) — +1 кубик урона. В конце Хода оружие в обычной дальности возвращается. Дольше ½I.b Ходов — Процесс +1 за каждый." }),
    TC("Gate of Elder Hendrik / Врата Старца Гендрика", { mt: "compensator", rating: 1, cog: 3, en: 3, sc: 1,
      act: "free", rng: "I×0,5м", skill: "techUse", test: -10, hw: "Ferric Lure Implants", proc: "1 , 1 (У)", type: "Компенсатор (1), Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Магнитные врата Ø I.b×1м (входная/выходная сторона). Стрельба I/R сквозь них: со входа +1 кубик и +2 Pen, с выхода −1 кубик и −2 Pen. Персонаж в металле/аугметике: со входа +I.b×1м к движению, с выхода −I.b×1м." })
  ]),

  // ── Маглев ──
  grp([...MOT, "Маглев"], [
    TC("Maglev Transcendence / Маглев Просветление", { cog: 1, sc: 0,
      act: "free", rng: "Сам", hw: "Maglev Coils", proc: "½ (У)", type: "Реакция",
      fx: "Трейт Hoverer (I.b). Можно вне своего Хода (без траты Реакций), обычно как реакция на падение — безопасное приземление с любой высоты." }),
    TC("Maglev Grace / Маглев Милость", { cog: 2,
      act: "free", rng: "Сам", hw: "Maglev Coils", proc: "1 (У)", type: "Реакция",
      fx: "Треб.: I 40, Tech-Use+10, Maglev Transcendence. Трейт Hoverer (I.b×2). Можно вне своего Хода, обычно как реакция на падение — безопасное приземление." }),
    TC("Maglev Ascension / Маглев Вознесение", { mt: "compensator", rating: 0, cog: 2, en: 1, sc: 1,
      act: "free", rng: "Сам", hw: "Maglev Coils", proc: "1 , 1 (У)", type: "Компенсатор (0), Реакция",
      fx: "Треб.: I 50, Tech-Use+20, Maglev Grace. Трейт Flyer (I.b×2). Можно вне Хода (зависание вместо падения). Если за прошлый Ход двигался полётом ≤I.b×4м — авто-тест Компенсатора на цену Процесса." }),
    TC("Maglev Autocephaly / Маглев Автокефалия", { mt: "compensator", rating: 1, cog: 2, en: 1, sc: 1,
      act: "free", rng: "Сам", hw: "Maglev Coils", proc: "1 (У)", type: "Компенсатор (1)",
      fx: "Треб.: I 55, Tech-Use+30, Maglev Grace. Трейты Auto-Stabilized и Sturdy, всегда есть надёжная опора (даже в полёте). I вместо S во встречных тестах против Борьбы/сдвига/сбивания." }),
    TC("Doctrina Seraph / Доктрина Сераф", { mt: "doctrine", cog: 2, en: 1, sc: 1,
      act: "free", rng: "Сам", hw: "Maglev Coils", proc: "1", type: "Доктрина, Компенсатор (1)",
      fx: "Треб.: Tech-Use+10, Maglev Transcendence. С активным Маглев-техночудом (Flyer/Hoverer): I вместо A во всех тестах движений (вкл. Уклонение/Вольт), движения могут быть Ментальными. Раз в Раунд 1 Энергия (Компенсатор) — Уклонение без траты Реакции. Крылья видимы (косметика)." }),
    TC("Maglev Chariot / Маглев Колесница", { mt: "compensator", rating: 0, cog: 3, en: 1, sc: 0,
      act: "free", rng: "I.b×1м", hw: "Maglev Coils", proc: "½ , 1", type: "Компенсатор (0), Реакция",
      fx: "Треб.: I 50, Tech-Use+20, Maglev Grace. Только с Маглев Просветлением/Милостью. До I.b пассажиров Размером ≤1 в металлической броне/с аугметикой. Несогласный: А+30 чтобы избежать, S+30 чтобы вырваться. Подтягиваются в 3м, зависают, движутся с техножрецом, не тратя действий." }),
    TC("Litany of the Ruinex / Литания Руинэкса", { mt: "compensator", rating: 0, cog: 3, en: 2, sc: 1,
      act: "half", rng: "Сам", skill: "techUse", test: 0, hw: "Maglev Coils", proc: "1 , 1 (У)", type: "Компенсатор (0), Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Аура I.b×1м с эффектом Haywire 7-8 «Мёртвая Зона». Исключает себя и до I.b союзников (меняет выбор в начале Хода)." }),
    TC("Shield of Elder Carolus / Щит Старца Каролуса", { mt: "compensator", rating: 1, cog: 3, en: 2, sc: 1,
      act: "free", rng: "Сам", skill: "techUse", test: -10, hw: "Ferric Lure Implants", proc: "1 , 1 (У)", type: "Компенсатор (1), Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Магнитная линза-аура 3м. Снаружи не видят внутрь (обычное/тепловое зрение); изнутри не видят наружу. Стрельба снаружи (не по площади) проходит сквозь, не задевая внутренних; изнутри можно стрелять наружу при альт. засекании. Процесс +1 за каждый Раунд активности (кроме первого)." })
  ]),

  // ═══════════ КИБЕРТЕУРГИЯ ═══════════
  // ── Инфрапеснь ──
  grp([...CYB, "Инфрапеснь"], [
    TC("Feedback Screech / Кольцевой Визг", { act: "free", rng: "I×2м", hw: "Respirator Unit", proc: "Да (У)", type: "—",
      fx: "Респираторный визг: все в дальности Оглохшие, не могут общаться устно (кроме звукоизолированных шлемов с воксом), эхолокация не работает. Вне радиуса −50 на слух (−5 за каждые 10м). За ½ Энергии — направленный (исключённые секторы −30 на слух)." }),
    TC("Rite of Dread / Обряд Ужаса", { cog: 1, sc: 0, act: "free", rng: "I×2м", hw: "Respirator Unit", proc: "½ (У)", type: "—",
      fx: "Треб.: Medicae+0, Feedback Screech. Инфразвук: все в дальности −3×I.b на встречные тесты против Страха/Подавления/Паники/Запугивания/Допроса/устыжения. Импланты Механикум — иммунны. 1 Энергия — направленный." }),
    TC("Rite of Awe / Обряд Трепета", { cog: 1, sc: 0, act: "free", rng: "I×2м", hw: "Respirator Unit", proc: "½ (У)", type: "—",
      fx: "Треб.: Medicae+0, Feedback Screech. Инфразвук: все в дальности −3×I.b на встречные тесты против социальных взаимодействий/психического контроля/Одержимости. Импланты Механикум — иммунны. 1 Энергия — направленный." }),
    TC("Rite of Silent Renunciation / Обряд Молчаливого Отречения", { cog: 5, sc: 1, act: "free", rng: "I×2м", hw: "Embedded Auspex, Respirator Unit", proc: "1 (У)", type: "—",
      fx: "Треб.: Medicae+10, Rite of Dread. Только с Обрядом Ужаса в Процессах. Одна цель считает всех существ имеющими Страх 3 (и страдает от Обряда Ужаса). Пока активно — нельзя пользоваться Ауспексом. Импланты Механикум иммунны (но слышат изменённый тон)." })
  ]),

  // ── Цереброконтроль ──
  grp([...CYB, "Цереброконтроль"], [
    TC("Electrovespers / Электровечерняя", { cog: 4, en: 1, act: "full", rng: "Сам", skill: "medicae", test: 20, hw: "Cranial Circuitry", proc: "Нет", type: "—",
      fx: "Тест Medicae+20. Снимает 1 Усталости за нечётный Успех. Без Усталости — считается хорошо выспавшимся (заменяет 8 часов сна)." }),
    TC("Rite of Open Mind / Обряд Открытого Разума", { act: "free", rng: "Сам", skill: "medicae", test: 0, hw: "Cranial Circuitry", proc: "X (У)", type: "—",
      fx: "Треб.: Medicae+10, Electrovespers. Цена/Процесс = X. +3×X на Charm/Commerce/Deceive/Inquiry/Interrogate/Intimidate и +5×X на Scrutiny. От 2 Когниции — даёт эти Навыки на +0, если не было." }),
    TC("Rite of Pure Thought / Обряд Чистого Разума", { cog: 3, sc: 0, act: "free", rng: "Сам", skill: "medicae", test: 0, hw: "Cranial Circuitry", proc: "½ (У)", type: "—",
      fx: "Треб.: Medicae+10, Electrovespers. Иммунитет к Страху/Подавлению/Панике/Запугиванию/Допросу/Соблазнению. Может считывать «положенные» эмоции для общения." }),
    TC("Rite of Machine's Clarity / Обряд Машинной Ясности", { cog: 3, act: "free", rng: "Сам", skill: "medicae", test: -10, hw: "Cranial Circuitry", proc: "Да (У)", type: "—",
      fx: "Треб.: I 50, Medicae+20, Rite of Pure Thought. Иммунитет к Страху/Подавлению/Панике/Запугиванию/Допросу/Соблазнению. Соц. тесты через F (его и против него) авто-проваливаются. Теряет Hatred, Psyker, Warp-Gifted; получает Blunted (0). Не может Ярость/психосилы/Анима-техночудеса/Чудеса Веры." })
  ]),

  // ── Киберпсалмы (мехадендриты как Железо; «Касание» = длина дендрита) ──
  grp([...CYB, "Киберпсалмы"], [
    TC("Psalm of the Iron Spider / Псалом Железного Паука", { cog: 2, sc: 0, act: "free", rng: "Сам", hw: "4+ мехадендрита (кроме Оптических)", proc: "½", type: "Физическое",
      fx: "Треб.: Navigate (Surface)+0. Передвижение по стенам/потолку мехадендритами; Трейты Crawler, Quadruped (2), Sturdy. Дендрит-Лезвия/Баллистические/Факелы/Резаки = ½ дендрита; Манипуляторы/Серво-Руки/Клешни = 2 дендрита." }),
    TC("Psalm of the Vigilant Eye / Псалом Бдительного Ока", { act: "free", rng: "I×1м", skill: "awareness", test: 10, hw: "Optical MCD, Embedded Auspex", proc: "Да (У)", type: "Концентрация",
      fx: "Тест Awareness(I)+10. Узнаёт текущие/макс. Раны или Структуру цели, AP брони, тип/рейтинг щита. Пока в Процессах и цель в дальности — обновления; раз в Ход −1 Когниция к одному техночуду по этой цели." }),
    TC("Psalm of the Foresight / Псалом Предусмотрительности", { cog: 2, sc: 0, act: "free", rng: "I×10м", hw: "All-Seeing Eye, Noise Reductor", proc: "½ (У)", type: "—",
      fx: "Треб.: Awareness+10. Трейт Sonar Sense, центрированный на точке в дальности. +2×I.b на Избегания/встречные против целей, засекаемых эхолокацией и зрением одновременно; +1 Реакция на такие Избегания." }),
    TC("Psalm of the Quiet Shelter / Псалом Тихого Убежища", { mt: "compensator", rating: 1, cog: 4, en: 1, sc: 0, act: "free", rng: "I.b×2м", hw: "Excursion Field, Omnion Shield", proc: "½ (У)", type: "Компенсатор (1)",
      fx: "Треб.: Survival+0. Купол радиусом до дальности с эффектами Экскурсионного Поля и Омнионного Щита. Скрывает от Ауспексов/эхолокации/электро-чутья. Можно сделать матовым снаружи (−30 на Избирательные по силуэтам, гасит свет)." }),
    TC("Psalm of Miraculous Healing / Псалом Чудесного Исцеления", { cog: 3, act: "free", rng: "Касание", skill: "medicae", test: 10, hw: "Medicae MCD или Technical MCD", proc: "Нет", type: "Физическое",
      fx: "Треб.: Medicae+10, Tech-Use+10. Тест Medicae(I)+10 или Tech-Use(I)+10. За Успех — 1 Рана/Структура/Аблативная Рана цели Размером ≤1 (как Первая Помощь, до I.b суммарно). Живые — Медицинским MCD (Medicae); машины — Техническим MCD (Tech-Use). Манипулятор/Серво-Рука/Коготь — цели Размером 2/3." }),
    TC("Psalm of the Missing Mosaic / Псалом Недостающей Мозаики", { mt: "compensator", rating: 0, cog: 2, en: 1, act: "free", rng: "Касание", skill: "techUse", test: 0, hw: "Mechatendril, Fabrication Module", proc: "Нет", type: "Компенсатор (0), Физическое",
      fx: "Треб.: Tech-Use+10. Чинит поломку брони/оружия (≤1 смена), Расклинивает оружие, или восстанавливает Аблативную Броню/Реактивные Пластины/повреждение AP (одно). Не чинит аблативные Раны брони или Структуру техники." }),
    TC("Psalm of the Unseen Fortress / Псалом Незримой Крепости", { mt: "compensator", rating: 1, cog: 4, en: 1, sc: 1, act: "free", rng: "Сам", skill: "techUse", test: 0, hw: "Embedded Refractor", proc: "1", type: "Компенсатор (1)",
      fx: "Треб.: Tech-Use+20. Купол Рефрактора +2 аблативные Раны за Успех. Атака, которую мог бы отразить Рефрактор, при непоглощ. уроне — урон до 1, остальное в аблативные Раны (нехватка — разница вместо 1)." }),
    TC("Psalm of the Opened Gates / Псалом Открытых Врат", { mt: "compensator", rating: 1, cog: 1, en: 1, act: "free", rng: "Сам", hw: "Plasma Cutter, 2+ мехадендрита", proc: "Нет", type: "Компенсатор (1)",
      fx: "Треб.: Athletics+0. До конца Хода проходит сквозь стены/преграды, оставляя прорезанные двери. Как 2 дендрита — только манипуляторные (Мехатендрил/Манипуляционный/Медицинский/Технический/Серво-Рука/Коготь)." }),
    TC("Psalm of the Iron Whirlwind / Псалом Железного Вихря", { mt: "passive", act: "full", rng: "—", hw: "Cyber-Mantle", proc: "Нет", type: "Пассивное",
      fx: "Треб.: WS 40 или BS 40, I 45. По 1 Когниции вместо 1 Реакции на атаки мехадендритами. Дендрит-Лезвия/Мехатендрилы — ½ Когниции за атаку (окр.▲). Один мехадендрит — не более 1 атаки в Ход." }),
    TC("Psalm of the Singing Blades / Псалом Поющих Клинков", { cog: 2, sc: 1, act: "free", rng: "Сам", hw: "Unctor Cognis, Noise Reductor", proc: "1 (У)", type: "—",
      fx: "Треб.: Trade (Weaponsmith)+10. Всё рукопашное оружие, интегрированное в бионику/кибернетику (вкл. Унктор Когнис) без Contained, получает Reinforced и Resonant." }),
    TC("Psalm of the Ashen Steps / Псалом Пепельной Поступи", { cog: 2, sc: 2, act: "free", rng: "Сам", hw: "Fyceline Torch, Excursion Field", proc: "2 (У)", type: "—",
      dmg: "2d10+3", dmgT: "energy", pen: 2,
      fx: "Треб.: Tech-Use+10. Шаблон на техножреце (движется с ним, Linger): 2d10+3 E(Fl), Pen 2, Blast (3), Flame, Linger. Сам и до ½I.b(окр.▲) других иммунны и +30 на А против E(Fl)-взрывов/спреев и иммунитет к Горению." }),
    TC("Psalm of the Thousand Suns / Псалом Тысячи Солнц", { cog: 4, en: 2, act: "free", rng: "I×1м", skill: "techUse", test: -10, hw: "Plasma Cutter, Energeia Enhancer", proc: "Нет", type: "Стрельба, Физическое",
      dmg: "2d10+10", dmgT: "energy", pen: 12,
      fx: "Треб.: Tech-Use+20. Линия I.b×2м × 2м (как взрыв): 2d10+10 E, Pen 12, Blinding (1), Devastating (I.b), Extreme (9). Резак отключается на 1 Раунд (как Maximal); за 2 Когниции и 1 Энергию — охладить. Не тип Атака — не мешает др. атакам." }),
    TC("Psalm of the Guidance / Псалом Наставления", { mt: "passive", act: "full", rng: "—", hw: "Unctor Cognis, All-Seeing Eye", proc: "Нет", type: "Пассивное",
      fx: "Треб.: P 50. По 1/2 Когниции вместо Полудействия/Полного на Полу-/Полное Прицеливание оружием со свойством Cognis; можно посреди атаки с нескольких рук." }),
    TC("Psalm of the Parting / Псалом Разделения", { mt: "compensator", cog: 1, en: 1, act: "free", rng: "Касание", skill: "athletics", test: 0, hw: "2+ мехадендрита, Embedded Auspex", proc: "Нет", type: "Борьба, Компенсатор, Физическое",
      dmg: "3d10+S.b", dmgT: "impact", pen: 0,
      fx: "Треб.: Athletics+10. Только если держит цель в Захвате ≥2 мехадендритами (S слабейшего). Athletics(S) vs Athletics(S); при победе: 3d10+S.b I(Cr), Pen 0, Concussive (1), Wrecker (3), игнор AP. +1 Когниция (до +3) — +10 на тест за каждую." }),
    TC("Psalm of the Watchtower / Псалом Сторожевой Башни", { cog: 2, sc: 2, act: "free", rng: "Сам", hw: "Manus Poenae", proc: "2", type: "—",
      fx: "Треб.: Trade (Weaponsmith)+10. Оружие в Манус Поэнаэ входит в Караул с обзором 360°. Нельзя стрелять до конца Хода завершения Процесса (если не завершён в начале до траты Когниции). I вместо A для очерёдности. Нельзя в Ход, когда уже стрелял из Манус Поэнаэ." }),
    TC("Psalm of the Death's Breath / Псалом Дыхания Смерти", { cog: 4, en: 2, act: "free", rng: "30м", skill: "techUse", test: -10, hw: "Solar Converter, Omnion Shield", proc: "Нет", type: "Незримое, Стрельба, Физическое",
      dmg: "2d10+4", dmgT: "energy", pen: 10,
      fx: "Треб.: Tech-Use+20. Стрельба: 30м, 2d10+4 E, Pen 10, Felling (4), Rad (2d10), Spray (Незримая, если цель не засекает радиацию/само техночудо). Солнечный Конвертер отключается. Не тип Атака — не мешает др. атакам." })
  ]),

  // ── ЭФМ ──
  grp([...CYB, "ЭФМ"], [
    TC("Doctrina Cestica / Доктрина Цестика", { mt: "doctrine", cog: 2, act: "free", rng: "Сам", hw: "Ferric Lure Implants", proc: "1", type: "Доктрина",
      fx: "Треб.: Tech-Use+10, EFM Speed. Можно бросать все тесты S и тесты урона с бонусом от S.b дважды, выбирая лучший." }),
    TC("EFM Speed / ЭФМ Скорость", { cog: 1, sc: 0, act: "free", rng: "Сам", hw: "EFM Circuits", proc: "½ (У)", type: "—",
      fx: "Требования: Нет. При активации +½I.b (окр.▲) к SPD без постоянной траты энергии." }),
    TC("EFM Potence / ЭФМ Могущество", { mt: "compensator", rating: 0, cog: 1, en: 1, act: "free", rng: "Сам", hw: "EFM Circuits", proc: "Нет", type: "Компенсатор (0)",
      fx: "Треб.: I 40, Tech-Use+10, EFM Speed. +3×I.b к S и Трейт Unnatural S (+2) до начала след. Хода; можно тратить доп. Энергию — Unnatural S (+2) за каждую. Активируется посреди действия (например, после попадания рукопашной, до броска на урон)." }),
    TC("EFM Control / ЭФМ Контроль", { cog: 1, sc: 0, act: "free", rng: "Сам", hw: "EFM Circuits", proc: "½ (У)", type: "—",
      fx: "Треб.: I 50, Tech-Use+20, EFM Potence. При атаке с бонусом от S.b можно уменьшать S.b (до 0), получая +5 на атаку за каждый пункт. +2×I.b на Крафт с точными движениями." }),
    TC("EFM Fortitude / ЭФМ Стойкость", { cog: 2, sc: 1, act: "free", rng: "Сам", hw: "EFM Circuits", proc: "1 (У)", type: "—",
      fx: "Треб.: I 50, Tech-Use+20, EFM Potence. +½I.b (окр.▲) к Поглощению всех частей тела кроме головы; +3×I.b на оборонительные встречные тесты S и тесты S против перемещения/сбивания, а также тесты T против Оглушения (кроме попаданий в голову)." }),
    TC("EFM Celerity / ЭФМ Стремительность", { mt: "compensator", rating: 2, cog: 3, en: 2, act: "free", rng: "Сам", hw: "EFM Circuits", proc: "Нет", type: "Компенсатор (2)",
      fx: "Треб.: I 55, Tech-Use+30, EFM Fortitude. +1 полудействие в Ход — только на движения, физ. рукопашные или метательные атаки (даже если уже атаковал в Ход). Не потратив его — +1 Реакция на физические действия. Можно активировать несколько раз в Ход при наличии Когниции/Энергии." }),
    TC("Voidian Scepter / Пустотный Скипетр", { mt: "compensator", rating: 1, cog: 4, en: 3, act: "free", rng: "Сам", skill: "techUse", test: 0, hw: "EFM Circuits, Unctor Cognis", proc: "Нет", type: "Компенсатор (1), Славословие (1)",
      dmg: "3d10+2×I.b", dmgT: "energy", pen: 12,
      fx: "Треб.: For.Lore (Mechanicum)+20. Силовое оружие в Унктор Когнис до начала след. Хода: 3d10+2×I.b E, Pen 12, Contained, Extreme (7), Imprecise, Power Field, Razor Sharp, Bl −2. Считается на 2 Размера больше при Парировании; успешное Парирование — S+0 vs S+0 или удар проходит. Активация перегружает техно-щиты в 3м (кроме своих и до I.b союзников)." }),
    TC("Might of Elder Jacob / Мощь Старца Иакова", { mt: "compensator", rating: 1, cog: 3, en: 2, act: "reaction", rng: "Сам", skill: "techUse", test: 10, hw: "EFM Circuits, Maglev Coils", proc: "Нет", type: "Избегание, Компенсатор (1), Славословие (1), Реакция",
      fx: "Треб.: For.Lore (Mechanicum)+30. Парирует любую рукопашную атаку и все её попадания (игнор разницы Размеров/Flexible/эффектов, игнорирующих Парирование). Tech-Use(I)+10 vs S+0; при победе перекидывает атакующего на ½I.b(окр.▲) м (урон как от падения с этой высоты)." })
  ]),

  // ── Санктус (только если персонаж может получать эффекты наркотиков/медикаментов) ──
  grp([...CYB, "Санктус"], [
    TC("Sanctus Purge / Санктус Чистка", { cog: 1, sc: 0, act: "free", rng: "Сам", hw: "Sanctus Canister", proc: "½", type: "—",
      fx: "Треб.: Medicae+0. При активации и в начале каждого Хода — T+0 для очистки от одного яда/наркотика. +3×I.b на тесты против ядов/болезней, авто-успех против ядов/болезней с Пределом 70+." }),
    TC("Sanctus Vigour / Санктус Рвение", { cog: 2, sc: 0, act: "free", rng: "Сам", hw: "Sanctus Canister", proc: "½ (У)", type: "—",
      fx: "Треб.: I 40, Medicae+10, Sanctus Purge. Штраф Усталости вдвое (до −5); в начале каждого Хода T+0, при Успехе снять 1 Усталости." }),
    TC("Sanctus Renewal / Санктус Обновление", { cog: 3, act: "free", rng: "Сам", skill: "medicae", test: 0, hw: "Sanctus Canister", proc: "Нет", type: "—",
      fx: "Треб.: I 50, Medicae+20, Sanctus Vigour. Тест Medicae(I)+0. Восстанавливает 1 Рану за нечётный Успех." }),
    TC("Sanctus Illumination / Санктус Просветление", { sc: 1, act: "free", rng: "Сам", skill: "medicae", test: 0, hw: "Sanctus Canister", proc: "1", type: "—",
      fx: "Треб.: I 55, Medicae+30, Sanctus Renewal. Цена = X. Тест Medicae(I)+0. Эффект одного наркотика Редкостью до X−1 до конца Процесса (с пост-эффектами/Зависимостью). Только заряженные в Канистру наркотики, только для самого техножреца." }),
    TC("Doctrina Bakhan / Доктрина Бакхан", { mt: "doctrine", cog: 1, act: "free", rng: "Сам", hw: "Sanctus Canister", proc: "1", type: "Доктрина",
      fx: "Треб.: Medicae+10, Sanctus Purge. Если Доктрина была активна весь эффект наркотика — иммунитет к его пост-эффектам и приём не считается в счётчике зависимости." }),
    TC("Sanctus Battery / Санктус Батарея", { cog: 2, sc: 1, act: "free", rng: "Сам", hw: "Sanctus Canister", proc: "1 (У)", type: "—",
      fx: "Треб.: I 50, Medicae+20, Sanctus Vigour. +5×I.b на тесты Компенсатора, но за каждый предыдущий тест Компенсатора в тот же Ход бонус −10." }),
    TC("Prosanguine / Просангвина", { cog: 4, act: "free", rng: "Сам", skill: "techUse", test: 0, hw: "Sanctus Canister, Autosanguine", proc: "Нет", type: "Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Восстанавливает I.b Ран и +30 к 2 Характеристикам (WS/BS/S/T/A/P). В начале каждого Хода −10 для обеих. В Ход активации +2 полудействия (одна доп. атака и концентрация)." }),
    TC("Elixir of Elder Albus / Эликсир Старца Альбуса", { act: "free", rng: "Сам", hw: "Sanctus Canister, Fabricator Module", proc: "Нет", type: "Славословие (2)",
      fx: "Треб.: For.Lore (Mechanicum)+30. Восстанавливает всю Когницию, +30 к I и Трейт Unnatural I (6) (не складывается с Кортикальным Имплантом). В начале каждого Хода −5 к I и −1 к рейтингу Unnatural I." })
  ]),

  // ═══════════ НООТЕУРГИЯ ═══════════
  // ── Воксманипулятор ──
  grp([...NOO, "Воксманипулятор"], [
    TC("Vox Warding / Вокс Ограждение", { cog: 1, sc: 0, act: "free", rng: "Сам", hw: "Noospheric Emitter", proc: "½", type: "—",
      fx: "Одна из вокс-сетей поднимает Инфограждение до I.b (если ниже). Авто-смена кодировки в конце Хода при засечении взлома." }),
    TC("Vox Seal / Вокс Печать", { cog: 2, sc: 1, act: "free", rng: "I×2м", hw: "Noospheric Emitter", proc: "1", type: "—",
      fx: "Треб.: Tech-Use+10, Vox Warding. Вся вокс-связь в дальности — только помехи/белый шум. Всегда в открытом канале, авто-засекается Ноосферным Сканированием." }),
    TC("Vox Omniscience / Вокс Всеведенье", { act: "free", rng: "Вокс", skill: "techUse", hw: "Noospheric Emitter", proc: "½", type: "—",
      fx: "Треб.: Tech-Use+20, Vox Warding. Цена = X, тест Tech-Use(I)−10+5×X vs Tech-Use(I)+0. Прослушка зашифрованного вокс-канала, пока не сменит кодировку. До P.b каналов одновременно (доп. чувство)." }),
    TC("Vox Gheist / Вокс Гейст", { sc: 1, act: "free", rng: "Вокс", skill: "techUse", hw: "Noospheric Emitter", proc: "1", type: "—",
      fx: "Треб.: Tech-Use+30, Vox Omniscience. Как Вокс Всеведенье (тест −20+5×X), но за 1 Когницию: заглушить/заменить/сфабриковать вокс-сообщение (голосом услышанного ≥3 раза). Tech-Use(I) вместо Deceive/Intimidate. Изменённый приказ даёт бонусы, но −3 Успеха." })
  ]),

  // ── Инфостраж ──
  grp([...NOO, "Инфостраж"], [
    TC("Info Vigil / Инфо Бдение", { cog: 1, sc: 0, act: "free", rng: "Сам", hw: "Cranial Circuitry", proc: "½", type: "—",
      fx: "Преимущество на тесты Ноосферного Сканирования; при Успехе всегда понимает засечённые техночудеса, как если бы знал их." }),
    TC("Info Whisper / Инфо Шепот", { act: "free", rng: "Сам", hw: "Cranial Circuitry", proc: "Нет", type: "—",
      fx: "Треб.: Tech-Use+10, Info Vigil. Цена = X. Активируется перед другим техночудом: чтобы засечь его Ноосферным Сканированием, нужно на X Успехов больше (обычно X+1)." }),
    TC("Info Parry / Инфо Парирование", { act: "reaction", rng: "Ноосфера", skill: "techUse", test: 0, hw: "Cranial Circuitry", proc: "Нет", type: "—",
      fx: "Треб.: Tech-Use+20, Info Vigil. Реакция на засечённое чужое техночудо. Tech-Use(I)+0 vs Tech-Use(I)+0; при победе оно отменяется (тратит цену активации, но не Энергию)." }),
    TC("Info Leech / Инфо Пиявка", { mt: "passive", act: "full", rng: "Ноосфера", hw: "Cranial Circuitry", proc: "Нет", type: "Пассивное",
      fx: "Треб.: Tech-Use+30, Info Parry. При успешном Инфо Парировании цель теряет 1 Когницию, техножрец +1 (на 5+ Успехов — 2). Нехватка у цели — тратит недостающий Процесс в начале своего Хода (техножрец получает Когницию)." })
  ]),

  // ── Пастырь Императивов (Железо: Noospheric Uplink; Императив действует на до X целей с машинной частью) ──
  grp([...NOO, "Пастырь Императивов"], [
    TC("Prayer of Compensation / Молитва Компенсации", { cog: 5, act: "free", rng: "Ноосфера", skill: "techUse", test: -10, hw: "Noospheric Uplink", proc: "Нет", type: "—",
      fx: "Цель с Трейтом Machine/Mechanicum Implants/Латами Скитарии восстанавливает Успехи Ран (компенсация, не лечение). Повторно — только после настоящего лечения/ремонта до максимума Ран." }),
    TC("Shroudpsalm / Саванпсалм", { mt: "imperative", cog: 2, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b), Славословие (1)",
      fx: "Стрелковые атаки по целям Императива −20, рукопашные −10 (Избирательные ×2). Не работает, если атака не полагается на зрение." }),
    TC("Incantation of the Iron Soul / Инкантация Железной Души", { mt: "imperative", cog: 3, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b), Славословие (1)",
      fx: "Цели Императива — Преимущество на тесты W (кроме психотестов/ритуалов). Силовая броня не может быть целью." }),
    TC("Benediction of the Omnissiah / Благословение Омниссии", { mt: "imperative", cog: 4, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b), Славословие (1)",
      fx: "Цели Императива могут перебрасывать все тесты стрельбы и тесты урона стрелкового оружия." }),
    TC("Choir of the Unenlightened / Хор Непросвещённых", { mt: "imperative", cog: 1, act: "free", rng: "Ноосфера", skill: "techUse", test: -10, hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b×2)",
      fx: "Без бонусов целям, но в начале след. Хода за каждые полные 2 цели (бывшие под Императивом от начала до конца) техножрец восстанавливает 1 Когницию." }),
    TC("Chant of Remorseless Fist / Песнь Беспощадного Кулака", { mt: "imperative", cog: 3, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b), Славословие (1)",
      fx: "Цели Императива +20 к S и раз в Раунд перебрасывают тест S или тест урона с бонусом от S.b." }),
    TC("Invocation of Machine Wrath / Обращение к Машинному Гневу", { mt: "imperative", cog: 3, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b), Славословие (1)",
      fx: "Цели Императива могут совершать Натиск на дистанцию Бега и перебрасывать тесты Трудного Ландшафта." }),
    TC("Canticle of the Craft / Славословие Ремесла", { mt: "imperative", cog: 4, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b), Славословие (1)",
      fx: "Каждое высокотехнологичное оружие целей Императива первый раз в Раунд при попадании (после Избеганий, до щитов) авто-наносит Экстремальный Урон (один кубик → максимум)." }),
    TC("Protector Imperative / Императив Защитника", { mt: "imperative", cog: 2, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b×2), Славословие (1)",
      fx: "Цели Императива +30 на BS и −30 на WS." }),
    TC("Conqueror Imperative / Императив Завоевателя", { mt: "imperative", cog: 2, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b×2), Славословие (1)",
      fx: "Цели Императива +30 на WS и −30 на BS." }),
    TC("Bulwark Imperative / Императив Оплота", { mt: "imperative", cog: 2, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b×2), Славословие (1)",
      fx: "Цели Императива +4 к AP высокотехнологичной брони, но −3 к SPD (мин. 1)." }),
    TC("Aggressor Imperative / Императив Агрессора", { mt: "imperative", cog: 2, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b×2), Славословие (1)",
      fx: "Цели Императива +3 к SPD, но −4 к AP высокотехнологичной брони (мин. 1)." }),
    TC("Fortress Imperative / Императив Крепости", { mt: "imperative", cog: 2, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b×2), Славословие (1)",
      fx: "Цели Императива +до +8 к расчётному AP укрытий (не более ×2) и +20 на Отскок в укрытие, но −30 на остальные Избегания." }),
    TC("Evasion Imperative / Императив Избегания", { mt: "imperative", cog: 2, act: "free", rng: "Ноосфера", hw: "Noospheric Uplink", proc: "Нет", type: "Императив (I.b×2), Славословие (1)",
      fx: "Цели Императива +до +30 на Избегания (кроме Отскока в укрытие, −20), но AP укрытий −8 (не более чем вдвое)." }),
    TC("Kataphatic Hymn / Катафатический Гимн", { act: "free", rng: "Сам", hw: "Noospheric Uplink", proc: "Нет", type: "—",
      fx: "Треб.: For.Lore (Mechanicum)+20. Цена: цена Императива +2 Когниции. Раз в начале Хода продлить один Императив прошлого Хода на +1 Ход (цена +2 за каждое продление)." }),
    TC("Binary Shepherd / Бинарный Пастырь", { mt: "passive", act: "full", rng: "Сам", hw: "Noospheric Uplink", proc: "Нет", type: "Пассивное",
      fx: "Треб.: For.Lore (Mechanicum)+20. Активируя Императив, можно увеличить его действие до полного и рейтинг в 10 раз, распространяя на до <оригинального рейтинга> отдельных отрядов." })
  ]),

  // ── Нумерика (Железо: Hasta Numerica) ──
  grp([...NOO, "Нумерика"], [
    TC("Numerica Curse / Нумерика Проклятье", { cog: 3, act: "free", rng: "Ноосфера", skill: "techUse", test: -10, hw: "Hasta Numerica", proc: "Нет", type: "—",
      fx: "Tech-Use(I)−10 vs Tech-Use(I)+0 (Инфограждение/пользователь). При победе отключает оружие/броню/снаряжение на ½I.b(окр.▲) Раундов. Пользователь полудействием Tech-Use(I)+0 (больше Успехов) включает обратно." }),
    TC("Numerica Delving / Нумерика Погружение", { cog: 4, act: "free", rng: "Ноосфера", skill: "techUse", test: -10, hw: "Hasta Numerica", proc: "Нет", type: "—",
      fx: "Треб.: I 40, Tech-Use+10, Numerica Curse. vs Инфограждение/пользователь. За нечётный Успех — считать одну сцену/массив данных из цифровой памяти цели." }),
    TC("Numerica Dominion / Нумерика Владычество", { cog: 5, sc: 2, act: "free", rng: "Ноосфера", skill: "techUse", test: -10, hw: "Hasta Numerica", proc: "2", type: "—",
      fx: "Треб.: I 50, Tech-Use+20, Numerica Delving. vs цель. За Успех — перехват одного импланта бионики/кибернетики (вкл./выкл./как Железо). Раз в Ход цель своб. действием встречный, восстанавливая контроль за Успех." }),
    TC("Numerica Subjugation / Нумерика Покорение", { cog: 6, sc: 3, act: "free", rng: "Ноосфера", skill: "techUse", test: -20, hw: "Hasta Numerica", proc: "3", type: "—",
      fx: "Треб.: I 55, Tech-Use+30, Numerica Dominion. vs цель. При победе контролирует действия цели в её Ход (только техночудеса, его I/Навыки/Когниция; WS/BS его, если выше). Цель отключена от Ноосферы. В конце Хода цель своб. действием встречный для освобождения." }),
    TC("Doctrina Praxis / Доктрина Праксис", { mt: "doctrine", cog: 2, act: "free", rng: "Сам", hw: "Hasta Numerica", proc: "1", type: "Доктрина",
      fx: "Треб.: Tech-Use+10, Numerica Curse. Осознаёт все атаки по нему высокотехнологичным/бионическим/в силовой броне оружием (круговое чутьё). Преимущество на такие Избегания, +1 Реакция только на них." }),
    TC("Numerica Fascia / Нумерика Фасцы", { cog: 2, act: "reaction", rng: "Ноосфера", skill: "techUse", test: 0, hw: "Hasta Numerica", proc: "Нет", type: "Избегание, Реакция",
      fx: "Треб.: I 50, Tech-Use+20, Numerica Delving. Реакция на атаку по нему бионической/кибернетической конечностью или в силовой броне (от подключённого к Ноосфере/воксу). При Успехе отменяет попадание (как Уклонение — конвульсия актуаторов срывает атаку)." }),
    TC("Digital Phantasm / Цифровой Фантазм", { cog: 4, sc: 2, act: "half", rng: "Сам", skill: "techUse", test: 0, hw: "Hasta Numerica", proc: "2", type: "Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. vs подключённое к Ноосфере существо. При победе контролирует вводы цели от бионических чувств/авточувств/сенсоров/Инфозрения, заменяя иллюзиями. Цель в конце Хода может встречным освободиться при подозрении." }),
    TC("Order of Elder Sheev / Приказ Старца Шива", { cog: 5, act: "half", rng: "Ноосфера", skill: "techUse", test: 0, hw: "Hasta Numerica", proc: "Нет", type: "Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. До I.b подключённых машин без сознания (сервочерепа/сервиторы/роботы). vs контролирующий/Инфограждение. При победе обращают свой/чужой (бывшие союзники → цели, враги → союзники). Хозяева могут восстанавливать десигнации (2 Когниции, Tech-Use(I)+0)." })
  ]),

  // ── Логис (психотест Logic(I); Железо: Logis Engine) ──
  grp([...NOO, "Логис"], [
    TC("Logis Input / Логис Ввод", { cog: 1, sc: 0, act: "free", rng: "Сам", skill: "logic", hw: "Logis Engine", proc: "½ (У)", type: "—",
      fx: "Треб.: Logic+0. Logic(I) вместо Awareness(P). Копит Логис-Данные (ЛД) на объекты (1 ЛД при первом появлении в Ход; макс. по уровню Logic: +0→1 … Mastery→5). Своб. действием 1 Когниция: Logic(I)+0 на объект — +1 ЛД за 1/4/7/10 Успехи." }),
    TC("Logis Routine / Логис Рутина", { cog: 1, act: "free", rng: "Сам", skill: "logic", hw: "Logis Engine", proc: "Нет", type: "—",
      fx: "Треб.: I 40, Logic+10, Logis Input. Тест Logic(I)+5×ЛД. Перед любым тестом (одна попытка): при Успехе +10×ЛД на тест (ЛД связанного объекта)." }),
    TC("Logis Clarity / Логис Ясность", { cog: 2, act: "free", rng: "Сам", skill: "logic", hw: "Logis Engine", proc: "Нет", type: "—",
      fx: "Треб.: I 50, Logic+20, Logis Routine. Тест Logic(I)+5×ЛД. После любого теста: потерять 1 ЛД на связанном объекте и при Успехе перебросить этот тест. Нужны накопленные ЛД." }),
    TC("Doctrina Reductio / Доктрина Редукцио", { mt: "doctrine", cog: 1, sc: 0, act: "free", rng: "Сам", skill: "logic", hw: "Logis Engine", proc: "½", type: "Доктрина",
      fx: "Треб.: Logic+10, Logis Input. Перед действием 1 Когниция — узнать его результаты наперёд (вкл. встречные/Избегания цели). Совершишь то действие — броски из прогноза; иное — игнор. Не одно и то же действие дважды в Ход." }),
    TC("Logis Clairvoyance / Логис Ясновидение", { cog: 1, act: "reaction", rng: "Сам", skill: "logic", hw: "Logis Engine", proc: "Нет", type: "Избегание, Реакция",
      fx: "Треб.: I 50, Logic+20, Logis Routine. Тест Logic(I)+10×ЛД. После попадания (до урона, ЛД атакующего): считается Уклонением/Парированием (по выбору) со всеми бонусами/штрафами. Нужны ЛД атакующего." }),
    TC("Logis Prophecy / Логис Пророчество", { cog: 3, sc: 1, act: "free", rng: "Сенсоры", skill: "logic", hw: "Logis Engine", proc: "1 (У)", type: "—",
      fx: "Треб.: I 55, Logic+30, Logis Clarity. Цель с накопленными ЛД: +1 Реакция против её действий, +5×ЛД на встречные/Избегания против неё (цель — такой же штраф). Раз в Раунд переброс одного теста против цели или её теста против себя." }),
    TC("Logarithm of Certainty / Логарифм Определённости", { cog: 2, act: "half", rng: "Сам", skill: "logic", hw: "Logis Engine", proc: "Нет", type: "Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Перед тестом против цели с ЛД — потратить любое число ЛД: авто-успех с 3 Успехами за каждый ЛД, цель −5 на Избегания/встречные за каждый ЛД." }),
    TC("Loop of Elder Paul / Петля Старца Павла", { cog: 2, act: "free", rng: "Сам", hw: "Logis Engine", proc: "Нет", type: "Славословие (2)",
      fx: "Треб.: For.Lore (Mechanicum)+30. В любой момент своего Хода (даже посреди действия) «вернуться» в начало Хода, отменив его последствия, и отыграть заново (техножрец сохраняет воспоминания об «отменённом»)." })
  ]),

  // ═══════════ АНИМАТЕУРГИЯ ═══════════
  // ── Скрапкод (Железо: Omnissiah Axe) ──
  grp([...ANI, "Скрапкод"], [
    TC("Scrapcode Injection / Инъекция Скрапкода", { mt: "anima", cog: 1, act: "half", rng: "I.b×1м", skill: "techUse", test: 0, hw: "Omnissiah Axe", proc: "Нет", type: "Анима, Физическое",
      fx: "Треб.: Cor 30. vs Инфограждение. Высокотехнологичный предмет (кроме бионики/кибернетики) заражается Скрапкодом — не реагирует на вводы. Чинится за смену (запчасти, ремонт −Cor.b×5, 1 Усталости за Провал). Не на Демоническое/Наследие/Демонические Машины." }),
    TC("Scrapcode Eucharist / Причастие Скрапкода", { mt: "anima", cog: 2, sc: 0, act: "half", rng: "I.b×1м", hw: "Omnissiah Axe", proc: "½", type: "Анима, Физическое",
      fx: "Треб.: Cor 40, Tech-Use+10, Scrapcode Injection. Демоническая машина получает преимущества Императивов и считается обычной (Командование/ремонт), пока Процесс активен." }),
    TC("Scrapcode Initiation / Инициация Скрапкода", { mt: "anima", cog: 2, act: "half", rng: "I.b×1м", skill: "techUse", test: 0, hw: "Omnissiah Axe", proc: "Нет", type: "Анима, Физическое",
      fx: "Треб.: Cor 50, Tech-Use+20, Scrapcode Injection. Как Инъекция, но машина сохраняет приём вводов от Хаоситов (не меняет свой/чужой, не даёт коды). Заменяет Инъекцию на заражённой машине." }),
    TC("Scrapcode Confession / Исповедь Скрапкода", { mt: "anima", cog: 3, act: "half", rng: "I.b×1м", skill: "techUse", test: 0, hw: "Omnissiah Axe", proc: "Нет", type: "Анима, Физическое",
      fx: "Треб.: Cor 60, Tech-Use+30, Scrapcode Initiation. Машина принимает вводы техножреца и до I.b союзников (считает их «своими»). +½Cor.b к Инфограждению (кроме них); техножрец +2×Cor.b на тесты с ней. Прочие даже после ремонта −2×Cor.b до Техзорцизма. Макс. Cor.b порабощённых машин." })
  ]),

  // ── Техзорцизм (Железо: Omnissiah Axe) ──
  grp([...ANI, "Техзорцизм"], [
    TC("Techsorcism Purge / Чистка Техзорцизма", { mt: "anima", cog: 1, act: "half", rng: "I.b×1м", skill: "techUse", test: 0, hw: "Omnissiah Axe", proc: "Нет", type: "Анима, Физическое",
      fx: "vs Инфограждение/Заражение. Очищает машину от Скрапкода, кода ИИ, Некронов или Орочьих Меков, возвращая здоровый дух машины (далее — обычная имперская)." }),
    TC("Techsorcism Rebellion / Восстание Техзорцизма", { mt: "anima", cog: 2, act: "half", rng: "I.b×1м", skill: "techUse", test: -20, hw: "Omnissiah Axe", proc: "Нет", type: "Анима, Физическое",
      fx: "Треб.: Tech-Use+10, Techsorcism Purge. vs W демона. Демоническая машина/оружие: на 1 Раунд за нечётный Успех изолируется от демона (машина Беспомощна, оружие обычное; прекращает Одержимость носителя)." }),
    TC("Techsorcism Ward / Оберег Техзорцизма", { mt: "anima", cog: 2, sc: 1, act: "half", rng: "I.b×1м", hw: "Omnissiah Axe", proc: "1 (У)", type: "Анима, Физическое",
      fx: "Треб.: Tech-Use+20, Techsorcism Purge. До I.b целей: механизмы +½I.b(окр.▲) к Инфограждению против Скрапкода/Ксенотеха/ИИ, пока в одной Ноосфере со жрецом." }),
    TC("Techsorcism Awakening / Пробуждение Техзорцизма", { mt: "anima", cog: 3, sc: 1, act: "half", rng: "I.b×1м", skill: "techUse", test: 0, hw: "Omnissiah Axe", proc: "1 (У)", type: "Анима, Физическое",
      fx: "Треб.: Tech-Use+30, Techsorcism Ward. Как Чистка, но на очищенную машину накладывается Оберег Техзорцизма. Можно полудействием без траты Когниции очищать ещё одну машину рядом/по инфо-кабелю (+10 за каждую очищенную)." })
  ]),

  // ── Пневматеургия (Железо: Noospheric Uplink) ──
  grp([...ANI, "Пневматеургия"], [
    TC("Dataquake / Дататрясение", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×2м", hw: "Noospheric Uplink", proc: "1 (У)", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Все техночудеса в дальности +1 к цене активации и +ступень действия; Ноосферное Сканирование тут −20." }),
    TC("Maledict of Momentum / Проклятье Момента", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Шаблон I.b м. Техника внутри: SPD вдвое (окр.▲), Маневренность −20; двигавшаяся >SPD×2 Теряет Управление. Антигравы/реактивные двигатели перестают принимать вводы (SPD → 0)." }),
    TC("Maledict of Cracks / Проклятье Трещин", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Шаблон I.b м. Высокотехнологичная броня внутри −½I.b(окр.▲, не более чем вдвое, не на сочленениях/визорах) AP против E и X." }),
    TC("Maledict of Rust / Проклятье Ржавчины", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Шаблон I.b м. Высокотехнологичная броня внутри −½I.b(окр.▲, не более чем вдвое, не на сочленениях/визорах) AP против I и R." }),
    TC("Maledict of Jamming / Проклятье Заклинивания", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Шаблон I.b м. Высокотехнологичное оружие внутри −20 к Пределу Крит. Провала (и Заклинивания/Перегрева). Не на Демоническое/Наследие." }),
    TC("Enraging of Animus / Разъярение Анимуса", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Шаблон I.b м. Кто входит/начинает Ход — всё его высокотехнологичное стрелковое оружие авто-стреляет на макс. RoF (не знал — в случайном направлении, без траты действий). Не на Демоническое/Наследие." }),
    TC("Quelling of Animus / Усмирение Анимуса", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Шаблон I.b м. Высокотехнологичное стрелковое оружие внутри не может стрелять (как Заклинило); после Расклина первая атака снова отключает его. Не на Демоническое/Наследие." }),
    TC("Blessing of Lubrication / Благословение Смазывания", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Шаблон I.b м. Высокотехнологичное оружие внутри +5 к Пределу Крит. Провала и +10 к Пределу Заклинивания/Перегрева (до 100). Не на Демоническое/Наследие." }),
    TC("Prayer of Plasteel / Молитва Пластали", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Шаблон I.b м. Высокотехнологичная броня внутри +½I.b(окр.▲, не более +50%, не на сочленениях/визорах) AP против I и R." }),
    TC("Prayer of Ceramite / Молитва Керамита", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Шаблон I.b м. Высокотехнологичная броня внутри +½I.b(окр.▲, не более +50%, не на сочленениях/визорах) AP против E и X." }),
    TC("Prayer of Momentum / Молитва Момента", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Шаблон I.b м. Техника внутри: SPD вдвое (окр.▲), Маневренность +20, Трудный Ландшафт как обычный. Падающие на антигравах/реактивных двигателях безопасно приземляются." }),
    TC("Datastill / Даташтиль", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×2м", hw: "Noospheric Uplink", proc: "1 (У)", type: "Анима, Славословие (1)",
      fx: "Треб.: For.Lore (Mechanicum)+20. Первое техночудо в Раунд каждого в дальности −1 к цене активации и −ступень действия; Ноосферное Сканирование тут +20." }),
    TC("Cloak of Elder Kelbor / Плащ Старца Кельбора", { mt: "anima", cog: 3, sc: 3, act: "reaction", rng: "I×1м", hw: "Noospheric Uplink", proc: "3", type: "Анима, Славословие (2)",
      fx: "Треб.: Cor 30, For.Lore (Mechanicum)+30. Реакция на попадание под Haywire (после броска интенсивности, до применения). Шаблон I.b м — эффекты Haywire внутри игнорируются (полностью прекращаются, если весь шаблон/точечный эффект внутри)." }),
    TC("Devastator of Elder Anacharis / Опустошитель Старца Аначариса", { mt: "anima", cog: 3, act: "full", rng: "I×2м", hw: "Noospheric Uplink", proc: "Нет", type: "Анима, Славословие (2)",
      fx: "Треб.: Cor 30, For.Lore (Mechanicum)+30. Шаблон I.b м. Все техно-щиты в области перегружаются (отключаются на 1 Раунд), всё высокотехнологичное оружие отключается на 1 Раунд. Пустотные щиты — один обрушивается (не восстанавливается 1 Раунд)." }),
    TC("Library of Elder Koriel / Библиотека Старицы Кориэль", { mt: "anima", cog: 3, sc: 1, act: "half", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (2)",
      fx: "Треб.: I 50, For.Lore (Mechanicum)+30. Узнаёт, высокотехнологично ли устройство и как им пользоваться (минимальные Навыки/Таланты для использования как оружие/пилотирование), пока в Процессах. Урон: 2d10 в I (человеческая техника) или 3d10 в I (ксенос/Варп). Вне дальности — снова урон в I." }),
    TC("Whip of Elder Arkhan / Плеть Старца Аркхана", { mt: "anima", cog: 3, sc: 1, act: "half", rng: "I×1м", hw: "Noospheric Uplink", proc: "1", type: "Анима, Славословие (2)",
      fx: "Треб.: I 50, For.Lore (Mechanicum)+30. Автономное устройство (робот/сервитор/авто-турель/Autonomous): −10 на все тесты, +10 в начале каждого Хода. −20 ≤полудействие на движения; −40 нет ментальных действий; −60 −1 полудействие и Реакция. Многократное применение может сломить и подчинить ИИ." })
  ]),

  // ── Моравек (Железо: Repository of Moravec) ──
  grp([...ANI, "Моравек"], [
    TC("Moravec Breath / Дыхание Моравека", { mt: "anima", cog: 2, sc: 1, act: "free", rng: "I×2м", hw: "Repository of Moravec", proc: "1", type: "Анима",
      fx: "Треб.: For.Lore(Warp). Шаблон I.b м как Smoke (не сдувается, глушит вокс/Ноосферу). Техножрецы, начинающие Ход в нём, не восстанавливают Когницию (если не отключились от Ноосферы). Своб. действием смещение на I.b м." }),
    TC("Moravec Locus / Локус Моравека", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "I×1м", hw: "Repository of Moravec", proc: "1 (У)", type: "Анима",
      fx: "Треб.: I 40, For.Lore(Warp)+10, Moravec Breath. Рейтинг Страха 1. Тесты с высокотехнологичным оружием/предметами в дальности: +2×I.b Хаоситам, −2×I.b не-Хаоситам. Не складывается." }),
    TC("Doctrina Impietas / Доктрина Импиетас", { mt: "doctrine", cog: 2, act: "free", rng: "I.b×1м", hw: "Repository of Moravec", proc: "1", type: "Анима, Доктрина",
      fx: "Треб.: For.Lore(Warp)+10, Moravec Breath. Истончает Завесу в дальности на 2. Псайкеры перебрасывают психотесты; демоны в Истинной Форме/Вселении — все тесты, иначе — тесты W. Демоническое оружие/машины — 1 переброс в Раунд." }),
    TC("Moravec Net / Сеть Моравека", { mt: "anima", cog: 3, sc: 0, act: "free", rng: "I×1м", skill: "techUse", test: -20, hw: "Repository of Moravec", proc: "½", type: "Анима",
      fx: "Треб.: I 50, For.Lore(Warp)+20, Moravec Locus. Tech-Use(I)−20 vs W+0. Демон теряет 1 полудействие и Реакцию; демоническое оружие — W демона до 10 и все свойства кроме одного; псайкер — только безопасный режим; наложенные психосилы — за нечётный Успех подавить одну. Цель в конце Хода Реакцией повторяет тест." }),
    TC("Moravec Eyes / Глаза Моравека", { mt: "anima", cog: 3, act: "half", rng: "I×1м", skill: "techUse", test: 0, hw: "Repository of Moravec", proc: "Нет", type: "Анима, Атака, Стрельба",
      dmg: "1d10+I.b", dmgT: "energy", pen: 8,
      fx: "Треб.: I 50, For.Lore(Warp)+20, Moravec Locus. Как длинная очередь (1 попадание за Успех): I×1м, 1d10+I.b E, Pen 8, Corrosive (2), Extreme (8), Tearing." }),
    TC("Moravec Maw / Пасть Моравека", { mt: "anima", cog: 5, act: "half", rng: "Сам", skill: "techUse", test: -10, hw: "Repository of Moravec", proc: "Нет", type: "Анима, Атака, Стрельба",
      dmg: "2d10+2×I.b", dmgT: "rending", pen: 0,
      fx: "Треб.: I 55, For.Lore(Warp)+30, Moravec Eyes. Шаблон на техножреце (не бьёт его/дружественных, но может их телепортировать): 2d10+2×I.b R, Pen 0, Blast (I.b), Shocking, Tearing. Цели в шаблоне телепортируются на <больший кубик урона> м в выбранном направлении." }),
    TC("Xanite Gate / Ксанитские Врата", { mt: "anima", cog: 3, act: "half", rng: "Сам", hw: "Repository of Moravec", proc: "Нет", type: "Славословие (1)",
      fx: "Треб.: For.Lore (Warp)+20. Компилируется во время ритуала призыва (как ритуалист/ассистент); при успешном ритуале эффект «запирается» в коде и высвобождается при активации Славословия." }),
    TC("Swarm of Elder Sotha / Рой Старицы Соты", { mt: "anima", cog: 4, sc: 2, act: "half", rng: "I×1м", hw: "Repository of Moravec", proc: "2 (У)", type: "Славословие (2)",
      fx: "Треб.: For.Lore (Warp)+30. Вселяет мелких демонов в до I.b высокотехнологичного оружия/предметов: демоническое (W 10), авто-подчиняется; не тратит энергию/топливо, иммунно к Haywire. При прекращении/выходе из дальности демон покидает предмет." })
  ]),

  // ── Рунический Код (Железо: Runic Circuits) ──
  grp([...ANI, "Рунический Код"], [
    TC("Runic Scan / Руническое Сканирование", { mt: "anima", cog: 1, sc: 0, act: "free", rng: "Сам", hw: "Runic Circuits", proc: "½ (У)", type: "Анима",
      fx: "Треб.: For.Lore (Warp). Трейт Warp Sight, но потоки размыты (только источник/направление/сила). Можно передавать проекцию связанным Инфоречью (его обзором)." }),
    TC("Runic Aegis / Руническая Эгида", { mt: "anima", cog: 3, sc: 2, act: "free", rng: "Сам", hw: "Runic Circuits", proc: "2 (У)", type: "Анима, Реакция",
      fx: "Треб.: I 40, For.Lore (Warp)+10, Runic Scan. Перебрасывает тесты против психосил (кроме непрямых), Одержимости, Выжигания Души и варп-эффектов. Можно как Реакция на засечённую варп-атаку (даже после проигрыша встречного)." }),
    TC("Doctrina Inanis / Доктрина Инанис", { mt: "doctrine", cog: 2, act: "free", rng: "I.b×1м", hw: "Runic Circuits", proc: "1", type: "Анима, Доктрина",
      fx: "Треб.: I 40, For.Lore (Warp)+10, Runic Scan. Укрепляет Завесу в дальности на 2. Псайкеры перебрасывают успешные психотесты; демоны в Истинной Форме/Вселении — все успешные, иначе — успешные W. Демоническое оружие/машины — переброс первого успешного теста в Раунд." }),
    TC("Runic Interrupt / Руническое Прерывание", { mt: "anima", cog: 3, sc: 1, act: "free", rng: "Сам", hw: "Runic Circuits", proc: "1 (У)", type: "Анима",
      fx: "Треб.: I 50, For.Lore (Warp)+20, Runic Aegis. Трейт Warp Sight (без ограничений Сканирования). Пси-Капюшон через Tech-Use(I)+0 (I вместо W для дальности), но кроме Реакции тратит 1 Когницию." }),
    TC("Runic Redoubt / Рунический Редут", { mt: "anima", cog: 4, sc: 2, act: "free", rng: "I.b×0,5м", hw: "Runic Circuits", proc: "2 (У)", type: "Анима, Реакция",
      fx: "Треб.: I 50, For.Lore (Warp)+20, Runic Aegis. Как Руническая Эгида, но на всех в дальности. При активации и в начале Хода можно менять дальность (до указанной)." }),
    TC("Runic Exorcism / Рунический Экзорцизм", { mt: "compensator", rating: 1, cog: 5, en: 2, act: "free", rng: "I×1м", skill: "techUse", test: -10, hw: "Runic Circuits", proc: "Нет", type: "Анима, Компенсатор (1)",
      fx: "Треб.: I 55, For.Lore (Warp)+30, Runic Interrupt. Шаблон I.b м (засёкшие Избегают). При проигрыше: демон в Истинной Форме/Вселении — проваленный тест Нестабильности + Ступор 1 Раунд; в хосте/машине/Одержимый — Ступор 1 Раунд (Одержимый — контроль человеку); демоническое оружие/байки — теряют Демоническое на 1 Раунд; псайкеры — тПР −Провалы на 1 Раунд, удвоение времени манифестации." }),
    TC("Hexagrammatic Code / Гексаграмматический Код", { mt: "anima", cog: 3, sc: 3, act: "free", rng: "I×1м", hw: "Runic Circuits", proc: "3 (У)", type: "Анима, Реакция, Славословие (1)",
      fx: "Треб.: For.Lore (Warp)+20. Шаблон I.b м: все атаки оружия со свойством Warp Weapon внутри/сквозь него нивелируются. Можно как реакция на засечённое попадание варп-оружия (до Избеганий)." }),
    TC("Light of Elder Zagreus / Светоч Старца Загреуса", { mt: "anima", cog: 4, sc: 1, act: "free", rng: "Касание", hw: "Runic Circuits", proc: "1 (У)", type: "Анима, Реакция, Славословие (2)",
      fx: "Треб.: For.Lore (Warp)+30. Одно высокотехнологичное рукопашное оружие получает Extreme (9/−1), Haywire (0), Reinforced, Sanctified и иммунитет к Haywire; светится (цвет зависит от верований жреца)." })
  ])
);
