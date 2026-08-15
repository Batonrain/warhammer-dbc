// ════════════════════════════════════════════════════════════════════════
//  Легионы Космодесанта (Warhammer DBC). Геносемя, Культура, Проклятье.
//  + дочерние ордена/банды (chapters). Геносемя и Культура могут быть из
//  разных легионов; проклятья — обычно по линии Геносемени.
// ════════════════════════════════════════════════════════════════════════
import { esc } from "../helpers/utils.mjs";

function L(num, name, o) {
  return { id: num, num, name,
    geneseed: o.geneseed || "Нет мутаций.",
    culture:  o.culture  || "",
    curse:    o.curse    || "Нет проклятья.",
    curseChoices: o.curseChoices || null,
    effects:  o.effects  || null,   // авто-эффекты Геносемени (charBonuses/sizeMod/…)
    // Машинная культура: что она делает дружественным/враждебным и что выдаёт.
    // Имена Навыков и Талантов — как в библиотеках (англ. часть достаточно).
    // «группа:Имя» в talents означает всю группу талантов целиком.
    cult:     o.cult     || null,
    chapters: o.chapters || [] };
}
// Дочерний орден/банда. C(id, name, {geneseed, culture, curse, effects})
function C(id, name, o) {
  return { id, name,
    geneseed: o.geneseed || "Как у легиона-основателя.",
    culture:  o.culture  || "",
    curse:    o.curse    || "Нет проклятья.",
    curseChoices: o.curseChoices || null,
    effects:  o.effects  || null,
    cult:     o.cult     || null };
}

export const LEGIONS = [
  L("I", "Тёмные Ангелы", {
    geneseed: "Нет мутаций.",
    culture: "«Круги Внутри Кругов» — Deceive и Scrutiny дружественны, Charm враждебен. Стартовое плазменное оружие +1 Качество. Раз за сцену/бой — переброс любого броска против другого Астартес.",
    curse: "Выбрать: «Непрощённый» — при предательстве союзника тест W+0 или на Провалы Ходов взят Врасплох. «Павший» — легион считает ВАС предателем и охотится за вами.",
    curseChoices: [
      { name: "Непрощённый", text: "Предательство погружает в шок: когда вас предаёт союзник, тест W+0 или на Провалы Ходов вы становитесь взятым Врасплох, пока видение терзает разум." },
      { name: "Павший", text: "Легион предал вас, а неведомая сила выдернула вас из реальности, оставив дыры в памяти. Легион рано или поздно найдёт вас и жаждет мести, считая предателем ВАС; лишь покаяние под ножом смоет грех." }
    ],
    chapters: [
      C("absolution", "Ангелы Искупления", {
        geneseed: "Нет мутаций.",
        culture: "«Прощённые» — Charm и Deceive дружественны, Interrogate враждебен. Стартовое плазменное оружие +1 Качество.",
        curse: "Нет проклятья (вина искуплена за Калибан)." ,
        cult: { friendlySkills: ["Charm", "Deceive"], friendlyTalents: [],
                hostileSkills: ["Interrogate"], hostileTalents: [],
                grantSkills: [], grantTalents: [] } }),
      C("vengeance", "Ангелы Мщения", {
        geneseed: "Нет мутаций.",
        culture: "«Неумолимая Охота» — Interrogate, Security и Paranoia, Mental Fortitude, Torturer, Takedown, Plasma Expertise, Fearless, Pity the Weak дружественны; Charm, Deceive и Hunker Down, Disarm, Independent Targeting, Peer враждебны. Hatred (Fallen), Enemy 1 (Лоялисты кроме Непрощённых). Плазма +1 Качество; раз/сцену — переброс против Астартес.",
        curse: "«Непрощённый» — но тест W−10 вместо W+0." ,
        cult: { friendlySkills: ["Interrogate", "Security"], friendlyTalents: ["Paranoia", "Mental Fortitude", "Torturer", "Takedown", "Plasma Expertise", "Fearless", "Pity the Weak"],
                hostileSkills: ["Charm", "Deceive"], hostileTalents: ["Hunker Down", "Disarm", "Independent Targeting", "Peer"],
                grantSkills: [], grantTalents: ["Hatred (Fallen)", "Enemy"] } }),
      C("starphantoms", "Звёздные Фантомы", {
        geneseed: "Нет мутаций.",
        culture: "«Огневая Мощь» — Scanning Advance, Covering Fire, Saturation Fire, Storm of Lead, Eye of Vengeance, Mighty Shot дружественны; Deadeye Shot, Trick Shooter, Marksman, Tracking Aim, Target Selection враждебны. Попадания по укрытиям наносят ×2 урон в AP укрытий.",
        curse: "«Старые Счёты» — духи павших предков требуют мести; встретив «должника», тест W+0 или обязан мстить (мстительный дух — −10 на ментальные действия на сутки за бездействие)." ,
        cult: { friendlySkills: [], friendlyTalents: ["Scanning Advance", "Covering Fire", "Saturation Fire", "Storm of Lead", "Eye of Vengeance", "Mighty Shot"],
                hostileSkills: [], hostileTalents: ["Deadeye Shot", "Trick Shooter", "Marksman", "Tracking Aim", "Target Selection"],
                grantSkills: [], grantTalents: [] } }),
      C("consecrators", "Освятители", {
        geneseed: "Нет мутаций.",
        culture: "«Реликварий» — Awareness и Security дружественны, Charm враждебен. Scholastic Lore (Legends)+10, Forbidden Lore (Archeotech), Trade (Archaeologist). Одно стартовое снаряжение R4−, Best.Q (только броня/оружие/снаряжение Легиона).",
        curse: "«Непрощённый» — как у Тёмных Ангелов." ,
        cult: { friendlySkills: ["Awareness", "Security"], friendlyTalents: [],
                hostileSkills: ["Charm"], hostileTalents: [],
                grantSkills: ["Scholastic Lore (Legend)+10", "Forbidden Lore (Archeotech)", "Trade (Archaeologist)"], grantTalents: [] } }),
      C("covenant", "Стражи Завета", {
        geneseed: "Нет мутаций.",
        culture: "«Хранители Знаний» — все Scholastic Lore и Forbidden Lore дружественны, Charm враждебен. Scholastic Lore (Judgement), Forbidden Lore (Xenos любые три)+10, Талант Infused Knowledge, +30 на тест Lore раз/сцену.",
        curse: "«Непрощённый» — как у Тёмных Ангелов." ,
        cult: { friendlySkills: [], friendlyTalents: [],
                hostileSkills: ["Charm"], hostileTalents: [],
                grantSkills: ["Scholastic Lore (Judgement)", "Forbidden Lore (Xenos)+10"], grantTalents: ["Infused Knowledge"] } })
    ] }),

  L("III", "Дети Императора", {
    geneseed: "Оссмодула — деликатные кости лица. Ухо Лимана — +20 к слуху. Оккулоб — 30% фиолетовая радужка. Меланохром — 60% кремово-белые волосы.",
    culture: "«Совершенство» — продвижение Навыка +20→+30 и Талант Mastery дружественны. Linguistics (Chemosan) и бесплатное продвижение стартового Навыка до +20. Звуковое оружие −1 Редкости; «Шумовой Десантник» −500 XP.",
    curse: "«Отмеченный» — Слаанеш считает вас своей собственностью; чемпионы/демоны охотятся. Защищает только заступничество другого Бога.",
    chapters: [
      C("consortium", "Консорциум", {
        geneseed: "Как у изначального легиона/ордена + Каталептический Узел модифицирован: Трейт Unnatural I (+2).",
        effects: { charBonuses: [{ stat: "int", value: 2 }] },
        culture: "«Прародители» — Medicae, Scholastic Lore (Chymistry), Forbidden Lore (Astartes Implants, Mutants, Xenobiology) дружественны; Charm, Inquiry враждебны. Преимущество на любую работу с Геносеменем; выращивание органов из мутировавших Прогеноидов как из обычных. Hatred (Eldar).",
        curse: "«Смеющийся Рок» — Цегорах настроил Эльдар против вас; задержка на месте навлекает Видящих/Корсаров/Тёмных Эльдар, в худшем — Арлекинов." ,
        cult: { friendlySkills: ["Medicae", "Scholastic Lore (Chymistry)", "Forbidden Lore (Astartes Implants)", "Forbidden Lore (Mutants)", "Forbidden Lore (Xenobiology)"], friendlyTalents: [],
                hostileSkills: ["Charm", "Inquiry"], hostileTalents: [],
                grantSkills: [], grantTalents: ["Hatred (Eldar)"] } }),
      C("violators", "Насильники", {
        geneseed: "Как у Детей Императора.",
        culture: "«Венец Чувственности» — Кортикальный Имплант Best.Q: если за Ход подвигался >A.b+1 м или получил непоглощённый урон, до конца следующего Хода перебрасывает все тесты WS и A.",
        curse: "«Отмеченный» — как у Детей Императора." ,
        cult: { friendlySkills: [], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: [], grantTalents: [] } })
    ] }),

  L("IV", "Железные Воины", {
    geneseed: "Бископея/Оолитическая Почка — +20 на операции бионики, ×4 восстановление. Прогеноиды — нет отторжения, +20 на имплантацию, возраст 10–18 (десантник за 2 года), можно имплантировать с 1 физ. мутацией.",
    culture: "«Математика Войны» — Logic, Tech-Use и Combat Formation, Paranoia, Litany of Cleaning, Field Execution, Iron Discipline, Duty Above All, Cannon Fodder дружественны; Charm, Inquiry и Double Team, Radiant Presence, Beloved Leader, Peer враждебны. Linguistics (Olympian), Hatred (Imperial Fists), Hunker Down, Mind Killer. −2 СУ Коротким Командам (мин 1) без Iron Discipline у командира.",
    curse: "«Неверная Длань» — при мутации (не от провала) обязан выбрать мутацию конечностей, если она есть. Бионика Легиона ≥Comm.Q исправляет такие мутации.",
    chapters: [
      C("ironcoven", "Железный Ковен", {
        geneseed: "Как у Железных Воинов.",
        culture: "«Варп и Сталь» — Scholastic Lore (Occult), Forbidden Lore (Daemons, Psykers, Warp) и Paranoia, Iron Discipline, Cannon Fodder, Meditation, Glorious Purpose, Brainwashing дружественны; Charm, Inquiry и Double Team, Radiant Presence, Beloved Leader, Peer враждебны. Linguistics (Olympian), Hatred (Imperial Fists, Khorne), Dominator, Mind Killer. −2 СУ Коротким Командам без Iron Discipline.",
        curse: "«Неверная Длань» — как у Железных Воинов." ,
        cult: { friendlySkills: ["Scholastic Lore (Occult)", "Forbidden Lore (Daemons)", "Forbidden Lore (Psykers)", "Forbidden Lore (Warp)"], friendlyTalents: ["Paranoia", "Iron Discipline", "Cannon Fodder", "Meditation", "Glorious Purpose", "Brainwashing"],
                hostileSkills: ["Charm", "Inquiry"], hostileTalents: ["Double Team", "Radiant Presence", "Beloved Leader", "Peer"],
                grantSkills: ["Linguistics (Olympian)"], grantTalents: ["Hatred (Imperial Fists)", "Dominator", "Mind Killer"] } }),
      C("bloodborn", "Кроверождённые", {
        geneseed: "Как у Железных Воинов.",
        culture: "«Крепости Неподвижны» — Logic и Tech-Use дружественны. Linguistics (Olympian), Forbidden Lore (Pirates), Hatred (Imperial Fists, Ultramarines), Hunker Down, Mind Killer.",
        curse: "«Неверная Длань» — как у Железных Воинов." ,
        cult: { friendlySkills: ["Logic", "Tech-Use"], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: ["Linguistics (Olympian)", "Forbidden Lore (Pirates)"], grantTalents: ["Hatred (Imperial Fists)", "Hunker Down", "Mind Killer"] } }),
      C("steelbrethren", "Стальное Братство", {
        geneseed: "Как у Железных Воинов.",
        culture: "«Тех-Рейдеры» — Tech-Use, Security и Paranoia, Armour-Monger, Reaper, Exotic Weapon Training, Litany of Cleaning, Iron Discipline дружественны; Charm, Inquiry и Double Team, Radiant Presence, Beloved Leader, Peer враждебны. Linguistics (Olympian), Hatred (Adeptus Mechanicus, Iron Warriors), Hunker Down, Mind Killer. −2 СУ Коротким Командам без Iron Discipline. 1 оружие Механикум R2− под руку Легиона.",
        curse: "«Инфопроклятье» — тесты Техночудес против вас получают Преимущество, ваши встречные −10. В системе Медренгарда −20 на ментальные действия." ,
        cult: { friendlySkills: ["Tech-Use", "Security"], friendlyTalents: ["Paranoia", "Armour-Monger", "Reaper", "Exotic Weapon Training", "Litany of Cleaning", "Iron Discipline"],
                hostileSkills: ["Charm", "Inquiry"], hostileTalents: ["Double Team", "Radiant Presence", "Beloved Leader", "Peer"],
                grantSkills: ["Linguistics (Olympian)"], grantTalents: ["Hatred (Adeptus Mechanicus)", "Hunker Down", "Mind Killer"] } })
    ] }),

  L("V", "Белые Шрамы", {
    geneseed: "Преомнор и сопутствующие мутации (см. дочерние ордена).",
    culture: "Свободолюбивый легион конных рейдеров; лояльность Человечеству, а не Императору. Базовая культура легиона в справочнике не детализирована — см. ордена-наследники.",
    curse: "«Боевая Дымка» / «Опьянение Битвой» — перед броском на расстройство тест W+10; при Провале Преомнор-токсин: Unnatural WS/BS/A (+4) и +1 Реакция, но ×2 Усталость, −20 против Оглушения/боли, ×4 еда; F→0, не понимает речь. Перманентно; Панацея «исцеляет» за 60 СУ.",
    chapters: [
      C("mantis", "Воины Богомолы", {
        geneseed: "Преомнор (см. проклятье). Ухо Лимана — +10 на вождение байков/езду верхом/маневры/Избегания на технике с Fast. Оккулоб — зелёная радужка.",
        culture: "«Воины Джунглей» — Stealth, Survival и Combat Sense, Hip Shooting, Reposition, Escape Artist, Hard Target, Steady Footwork, Covering Fire дружественны; Charm, Operate и Combat Formation, Armour-Monger, Hunker Down, Tenacity, Frenzy, Frontline Commander враждебны. Лес/джунгли/болото/мелководье — обычный ландшафт.",
        curse: "«Боевая Дымка» — как у Белых Шрамов." ,
        cult: { friendlySkills: ["Stealth", "Survival"], friendlyTalents: ["Combat Sense", "Hip Shooting", "Reposition", "Escape Artist", "Hard Target", "Steady Footwork", "Covering Fire"],
                hostileSkills: ["Charm", "Operate"], hostileTalents: ["Combat Formation", "Armour-Monger", "Hunker Down", "Tenacity", "Frenzy", "Frontline Commander"],
                grantSkills: [], grantTalents: [] } }),
      C("punishers", "Каратели", {
        geneseed: "Как у Белых Шрамов.",
        culture: "«Глас Свободы» — Charm, Deceive и Double Team, Air of Authority, Radiant Presence, Frontline Commander, Inspire Wrath, Demagogue дружественны; Logic, Security и Paranoia, Hunker Down, Mental Fortitude, Field Execution, Iron Discipline, Fearless враждебны. Элитный Архетип «Иерофант» без ограничения расы.",
        curse: "«Опьянение Битвой» — как у Белых Шрамов." ,
        cult: { friendlySkills: ["Charm", "Deceive"], friendlyTalents: ["Double Team", "Air of Authority", "Radiant Presence", "Frontline Commander", "Inspire Wrath", "Demagogue"],
                hostileSkills: ["Logic", "Security"], hostileTalents: ["Paranoia", "Hunker Down", "Mental Fortitude", "Field Execution", "Iron Discipline", "Fearless"],
                grantSkills: [], grantTalents: [] } }),
      C("darkhunters", "Тёмные Охотники", {
        geneseed: "Как у Белых Шрамов.",
        culture: "«Гасящие Свет» — Intimidate, Stealth и Fastest Hand, Blind Fighting, Street Fighting, Knife Fighter, Sideblade, Don’t Trust Your Eyes дружественны; Tech-Use, Security и Cleave, Frenzy, Covering Fire, Plasma Expertise, Weapon-Tech, Plasma Mastery враждебны. Stealth, Hatred (Mechanicus). Стартовое Primary/SP/Bolt и не-силовая броня +1 Качество.",
        curse: "«Опьянение Битвой» — как у Белых Шрамов." ,
        cult: { friendlySkills: ["Intimidate", "Stealth"], friendlyTalents: ["Fastest Hand", "Blind Fighting", "Street Fighting", "Knife Fighter", "Sideblade", "Trust Your Eyes"],
                hostileSkills: ["Tech-Use", "Security"], hostileTalents: ["Cleave", "Frenzy", "Covering Fire", "Plasma Expertise", "Weapon-Tech", "Plasma Mastery"],
                grantSkills: ["Stealth"], grantTalents: ["Hatred (Adeptus Mechanicus)"] } }),
      C("destroyers", "Уничтожители", {
        geneseed: "Как у Белых Шрамов. Каталептический Узел — −20 против ментальных расстройств/травм. Прогеноиды — 50% несовместимости; в тестах Лоялистов против мутаций выбирается худший результат.",
        culture: "«Без Жалости» — Intimidate, Interrogate и Tireless, Torturer, Reaper, Whirlwind of Death, Storm of Lead, Disturbing Voice дружественны; Charm, Logic и Cold Fury, Radiant Presence, Protege, Fearless враждебны. Intimidate, Peer (Administratum).",
        curse: "«Опьянение Битвой» — как у Белых Шрамов, но все тесты против проклятья −10." ,
        cult: { friendlySkills: ["Intimidate", "Interrogate"], friendlyTalents: ["Tireless", "Torturer", "Reaper", "Whirlwind of Death", "Storm of Lead", "Disturbing Voice"],
                hostileSkills: ["Charm", "Logic"], hostileTalents: ["Cold Fury", "Radiant Presence", "Protege", "Fearless"],
                grantSkills: ["Intimidate"], grantTalents: ["Peer"] } })
    ] }),

  L("VI", "Космические Волки", {
    geneseed: "—",
    culture: "Нет орденов-наследников: единственная попытка (Волчьи Братья) обернулась мутацией в Вульфенов. Редкие банды Хаоса от Космических Волков сохраняют культуру/проклятья легиона.",
    curse: "—" }),

  L("VII", "Имперские Кулаки", {
    geneseed: "Бископея — +5 Ран. Сус-ан Мембрана и Железа Бетчера не работают.",
    culture: "«Перчатка Боли» — Logic, Security и Sentry, Die Hard, Iron Jaw, Final Push, Tireless, True Grit, Bolter Drill дружественны; Deceive, Stealth и Rapid Reaction, Preternatural Speed, Reaper, Cannon Fodder враждебны. Trade (Mason), Hatred (Iron Warriors), Hunker Down, Mind Killer.",
    curse: "«Мрак» — серьёзно подвёл братьев → W+0, при Провале на Провалы Раундов −30 и −1 Реакция/Ход.",
    chapters: [
      C("crimsonfists", "Багровые Кулаки", {
        geneseed: "Как у Имперских Кулаков.",
        culture: "«Несокрушимая Воля» — Athletics, Logic и Resistance, Iron Jaw, Pain is an Illusion, True Grit, Fearless, Strong Minded дружественны; Charm, Intimidate и Rapid Reaction, Preternatural Speed, Reaper, Cannon Fodder враждебны. Stealth/Survival, Hatred (Orks), Reposition, Mind Killer.",
        curse: "«Мрак» — как у Имперских Кулаков." ,
        cult: { friendlySkills: ["Athletics", "Logic"], friendlyTalents: ["Resistance", "Iron Jaw", "Pain Is an Illusion", "True Grit", "Fearless", "Strong Minded"],
                hostileSkills: ["Charm", "Intimidate"], hostileTalents: ["Rapid Reaction", "Preternatural Speed", "Reaper", "Cannon Fodder"],
                grantSkills: ["Stealth"], grantTalents: ["Hatred (Orks)", "Reposition", "Mind Killer"] } }),
      C("ironknights", "Железные Рыцари", {
        geneseed: "Как у Имперских Кулаков.",
        culture: "«Мастера Осады» — Logic, Tech-Use и Combat Formation, Iron Jaw, True Grit, Litany of Cleaning, Iron Discipline, Fearless дружественны; Charm, Deceive и Double Team, Radiant Presence, Beloved Leader, Peer враждебны. Linguistics (Battle Kant), Hatred (Iron Warriors), Hunker Down, Mind Killer.",
        curse: "«Мрак» — как у Имперских Кулаков." ,
        cult: { friendlySkills: ["Logic", "Tech-Use"], friendlyTalents: ["Combat Formation", "Iron Jaw", "True Grit", "Litany of Cleaning", "Iron Discipline", "Fearless"],
                hostileSkills: ["Charm", "Deceive"], hostileTalents: ["Double Team", "Radiant Presence", "Beloved Leader", "Peer"],
                grantSkills: ["Linguistics (Battle Cant)"], grantTalents: ["Hatred (Iron Warriors)", "Hunker Down", "Mind Killer"] } }),
      C("invaders", "Захватчики", {
        geneseed: "Как у Имперских Кулаков. Прогеноиды — совместимость с «почти-людьми» миров смерти.",
        culture: "«Ксено-Охотники» — Awareness, Tech-Use и Lightning Reflexes, Quick Store, Blade Reader, True Grit, Tracking Aim, Sure Shot дружественны; Charm, Deceive и Hunker Down, Reaper, Dragoon, Storm of Lead, Pity the Weak враждебны. Forbidden Lore (Xenos (Eldar +2))+10, Hatred (Eldar), Unshakeable Will, Mind Killer.",
        curse: "«Злой Рок» — проклятье Хрустальных Провидцев Идхарэ: случайные опасности всегда нацеливаются на вас." ,
        cult: { friendlySkills: ["Awareness", "Tech-Use"], friendlyTalents: ["Lightning Reflexes", "Quick Store", "Blade Reader", "True Grit", "Tracking Aim", "Sure Shot"],
                hostileSkills: ["Charm", "Deceive"], hostileTalents: ["Hunker Down", "Reaper", "Dragoon", "Storm of Lead", "Pity the Weak"],
                grantSkills: ["Forbidden Lore (Xenos)+10"], grantTalents: ["Hatred (Eldar)", "Unshakeable Will", "Mind Killer"] } }),
      C("souldrinkers", "Испивающие Души", {
        geneseed: "Как у Имперских Кулаков. Омофагея — память из съеденного спинного мозга + ощущение эмоций жертвы за последний день.",
        culture: "«Пустотные Чистильщики» — Operate (Aeronautica), Tech-Use и Hip Shooting, Scanning Advance, Quick Store, Hard Target, True Grit, Bolter Drill, Sprayer дружественны; Deceive, Scrutiny и Frenzy, Dragoon, Marksman, Sniper Assassin, Iron Discipline, Solipsism враждебны. Trade (Voidfarer)+10, Hatred (Nurgle), Snake Eater, Hunker Down.",
        curse: "«Отмеченный» (Тзинч) — Лоялист получает мутации как Хаосит без Покровительства; Хаосит — как с Покровительством Тзинча." ,
        cult: { friendlySkills: ["Operate (Aeronautica)", "Tech-Use"], friendlyTalents: ["Hip Shooting", "Scanning Advance", "Quick Store", "Hard Target", "True Grit", "Bolter Drill", "Sprayer"],
                hostileSkills: ["Deceive", "Scrutiny"], hostileTalents: ["Frenzy", "Dragoon", "Marksman", "Sniper Assassin", "Iron Discipline", "Solipsism"],
                grantSkills: ["Trade (Voidfarer)+10"], grantTalents: ["Hatred (Nurgle)", "Snake Eater", "Hunker Down"] } }),
      C("hammersofdorn", "Молоты Дорна", {
        geneseed: "Как у Имперских Кулаков.",
        culture: "«Молот и Наковальня» — Command, Logic и Armour-Monger, True Grit, Chamber In, On This Mark, Mighty Shot, Target Selection дружественны; Deceive, Charm и Paranoia, Hard Target, Arms Master, Reaper, Frenzy, Protege враждебны. Forbidden Lore (Codex Astartes)+10; +2 СУ Коротким Командам при FL (Codex Astartes)+20 у командира.",
        curse: "«Мрак» — как у Имперских Кулаков." ,
        cult: { friendlySkills: ["Command", "Logic"], friendlyTalents: ["Armour-Monger", "True Grit", "Chamber In", "On This Mark", "Mighty Shot", "Target Selection"],
                hostileSkills: ["Deceive", "Charm"], hostileTalents: ["Paranoia", "Hard Target", "Arms Master", "Reaper", "Frenzy", "Protege"],
                grantSkills: ["Forbidden Lore (Codex Astartes)+10"], grantTalents: [] } }),
      C("retributors", "Отмстители", {
        geneseed: "Как у Имперских Кулаков.",
        culture: "«Импульсоры» — Awareness, Command и Rapid Reaction, Sentry, Scanning Advance, True Grit, Blind Fighting, Target Selection дружественны; Stealth, Survival и Hard Target, Hunker Down, Reaper, Saturation Fire, Run and Gun, Independent Targeting враждебны. +10 на атаки по целям в 5 м от уже атакованных под тем же Командным Присутствием.",
        curse: "«Мрак» — как у Имперских Кулаков." ,
        cult: { friendlySkills: ["Awareness", "Command"], friendlyTalents: ["Rapid Reaction", "Sentry", "Scanning Advance", "True Grit", "Blind Fighting", "Target Selection"],
                hostileSkills: ["Stealth", "Survival"], hostileTalents: ["Hard Target", "Hunker Down", "Reaper", "Saturation Fire", "Run and Gun", "Independent Targeting"],
                grantSkills: [], grantTalents: [] } }),
      C("executioners", "Палачи", {
        geneseed: "Как у Имперских Кулаков.",
        culture: "«Охотники за Головами» — Scrutiny, Survival и Preternatural Speed, Blade Reader, Tireless, True Grit, Takedown, Counter Attack, Gatekeeper дружественны; Deceive, Stealth и Hunker Down, Bayonet Charge, Whirlwind of Death, Protege, Unshakeable Will враждебны. В дуэли 1-на-1 криты на 1–10 (вместо 1–5) и Extreme (9/−1) на все атаки.",
        curse: "«Нерушимое Слово» — чтобы солгать, W+10 (W−10 с боевыми братьями). Ложь товарищу — −10 на ментальные действия на сутки; нарушенное слово — −20 на месяц." ,
        cult: { friendlySkills: ["Scrutiny", "Survival"], friendlyTalents: ["Preternatural Speed", "Blade Reader", "Tireless", "True Grit", "Takedown", "Counter Attack", "Gatekeeper"],
                hostileSkills: ["Deceive", "Stealth"], hostileTalents: ["Hunker Down", "Bayonet Charge", "Whirlwind of Death", "Protege", "Unshakeable Will"],
                grantSkills: [], grantTalents: [] } }),
      C("firelords", "Повелители Пламени", {
        geneseed: "Как у Имперских Кулаков. Мульти-лёгкое не работает, но хранит до 5 зарядов прометия — можно плеваться (Л. Ручной Огнемёт, Independent).",
        culture: "«Пламенный Натиск» — Awareness, Tech-Use и Hip Shooting, True Grit, Storm of Lead, Run and Gun, Friendly Fire, Torrent дружественны; Deceive, Stealth и Paranoia, Hunker Down, Tireless, Marksman, Tracking Aim, Fearless враждебны. Sprayer, Peer (Adeptus Mechanicus), +1 Качество всего стартового оружия/брони.",
        curse: "«Мрак» — как у Имперских Кулаков." ,
        cult: { friendlySkills: ["Awareness", "Tech-Use"], friendlyTalents: ["Hip Shooting", "True Grit", "Storm of Lead", "Run and Gun", "Friendly Fire", "Torrent"],
                hostileSkills: ["Deceive", "Stealth"], hostileTalents: ["Paranoia", "Hunker Down", "Tireless", "Marksman", "Tracking Aim", "Fearless"],
                grantSkills: [], grantTalents: ["Sprayer", "Peer"] } }),
      C("shadowwolves", "Теневые Волки", {
        geneseed: "Как у Имперских Кулаков.",
        culture: "«Неистовый Штурм» — Athletics и Hip Shooting, Sprint, Hard Target, True Grit, Bayonet Charge, Run and Gun дружественны; Deceive и Hunker Down, Tenacity, Covering Fire, Sharpshooter, Bolter Drill, Iron Discipline враждебны. Double Team; Hip Shooting позволяет стрелять при Перебежке как при Полном движении. В первый Ход рукопашной — как 2 персонажа в расчёте численного преимущества.",
        curse: "«Мрак» — как у Имперских Кулаков." ,
        cult: { friendlySkills: ["Athletics"], friendlyTalents: ["Hip Shooting", "Sprint", "Hard Target", "True Grit", "Bayonet Charge", "Run and Gun"],
                hostileSkills: ["Deceive"], hostileTalents: ["Hunker Down", "Tenacity", "Covering Fire", "Sharpshooter", "Bolter Drill", "Iron Discipline"],
                grantSkills: [], grantTalents: ["Double Team"] } }),
      C("blacktemplars", "Чёрные Храмовники", {
        geneseed: "Как у Имперских Кулаков.",
        culture: "«Вечный Крестовый Поход» — Athletics, Parry и Preternatural Speed, True Grit, Flesh Render, Reaper, Battle Rage, Vengeance, Shield of Contempt дружественны; Charm, Deceive и Scanning Advance, Cold Fury, Deadeye Shot, Target Selection, Bolter Drill, Meditation враждебны. Frenzy, Hatred (Psykers), Mental Rage.",
        curse: "«Презирай Ведьму» — рядом с союзным псайкером −10 на ментальные действия и −20 на выход из Ярости; в Ярости приоритет целей: сдавшиеся вражеские псайкеры → союзные псайкеры → остальные." ,
        cult: { friendlySkills: ["Athletics", "Parry"], friendlyTalents: ["Preternatural Speed", "True Grit", "Flesh Render", "Reaper", "Battle Rage", "Vengeance", "Shield of Contempt"],
                hostileSkills: ["Charm", "Deceive"], hostileTalents: ["Scanning Advance", "Cold Fury", "Deadeye Shot", "Target Selection", "Bolter Drill", "Meditation"],
                grantSkills: [], grantTalents: ["Frenzy", "Hatred (Psykers)", "Mental Rage"] } }),
      C("exorcists", "Экзорцисты", {
        geneseed: "Как у Имперских Кулаков.",
        culture: "«Демоноборцы» — вся группа «Пси-Стойкость» дружественна. Hatred (Daemons); тесты демонов на обнаружение/атаку/одержимость −20; иммунитет к Демоническому Присутствию (≤−10). Не участвует в ритуалах (кроме экзорцизма) и Демоническом Владычестве. Лоялисты получают Порчу как Хаоситы.",
        curse: "«Мрак» — как у Имперских Кулаков." ,
        cult: { friendlySkills: [], friendlyTalents: ["группа:Пси-стойкость"],
                hostileSkills: [], hostileTalents: [],
                grantSkills: [], grantTalents: ["Hatred (Daemons)"] } }),
      C("excoriators", "Экскориаторы", {
        geneseed: "Как у Имперских Кулаков.",
        culture: "«Боевые Шрамы» — Athletics, Intimidate и Iron Jaw, Armour-Monger, Combat Master, Final Push, True Grit, Fearless дружественны; Deceive, Scrutiny и Lightning Reflexes, Preternatural Speed, Whirlwind of Death, Run and Gun, Idolater враждебны. Hatred (Alpha Legion), Tireless, Mind Killer.",
        curse: "«Мрак» — как у Имперских Кулаков." ,
        cult: { friendlySkills: ["Athletics", "Intimidate"], friendlyTalents: ["Iron Jaw", "Armour-Monger", "Combat Master", "Final Push", "True Grit", "Fearless"],
                hostileSkills: ["Deceive", "Scrutiny"], hostileTalents: ["Lightning Reflexes", "Preternatural Speed", "Whirlwind of Death", "Run and Gun", "Idolater"],
                grantSkills: [], grantTalents: ["Hatred (Alpha Legion)", "Tireless", "Mind Killer"] } })
    ] }),

  L("VIII", "Повелители Ночи", {
    geneseed: "Оккулоб — Dark Sight, зрение во тьме +20/полутьма +10/свет +0/яркий −10; чёрные радужки и белки. Меланохром — мертвенно-бледная кожа, чёрные волосы.",
    culture: "«Тактика Террора» — Interrogate, Intimidate, Stealth дружественны; группа «Смелость» враждебна. +10 на атаки по целям под Запугиванием/Шоком/Паникой/Подавлением; +2 СУ на ужасающую обстановку.",
    curse: "«Рок Ночного Призрака» — пророческие сны о своей смерти; получив потенциально смертельный непоглощённый урон — W+10 или −10×Провалы на следующее действие. Таланты «Долгий Кошмар», «Пророческое Видение».",
    chapters: [
      C("brotherhoodnight", "Братство Ночи", {
        geneseed: "Как у Повелителей Ночи.",
        culture: "«Храм Ужаса» — Interrogate, Intimidate, Stealth дружественны; группа «Смелость» враждебна. +2 СУ на ужасающую обстановку; +3 на ритуалы на такой местности за каждый СУ её создания в течение Успехи дней.",
        curse: "«Рок Ночного Призрака» — как у Повелителей Ночи." ,
        cult: { friendlySkills: ["Interrogate", "Intimidate", "Stealth"], friendlyTalents: [],
                hostileSkills: [], hostileTalents: ["группа:Смелость"],
                grantSkills: [], grantTalents: [] } }),
      C("bleedingeyes", "Кровоточащие Глаза", {
        geneseed: "Как у Повелителей Ночи.",
        culture: "«Ночные Хищники» — Intimidate, Operate (Aeronautica) дружественны; группа «Смелость» враждебна. Съев разумное существо — Размер+1 бонусных Очков Бесчестья (копятся до Cor.b), тратятся только на WS и A в полёте.",
        curse: "«Рок Ночного Призрака» — как у Повелителей Ночи." ,
        cult: { friendlySkills: ["Intimidate", "Operate (Aeronautica)"], friendlyTalents: [],
                hostileSkills: [], hostileTalents: ["группа:Смелость"],
                grantSkills: [], grantTalents: [] } })
    ] }),

  L("IX", "Кровавые Ангелы", {
    geneseed: "2 года комы с переливаниями крови Сангвиния. Гемастамен — стареет ×5 медленнее. Омофагея — память из выпитой крови. Меланохром — бледная кожа, 70% золотистые волосы. Прогеноиды — совместимость с «почти-людьми».",
    culture: "«Схождение Ангелов» — Operate (Aeronautica) дружественен. Trade (Mason/Musician/Painter), Frenzy, Battle Rage.",
    curse: "«Красная Жажда» (W+30 в начале боя или Ярость; убил — W+0 или пьёт кровь) и «Чёрный Гнев» (W+10 перед расстройством; провал — считает себя Сангвинием, перманентная Ярость, +2 Unnatural S/T, +10 Ран).",
    chapters: [
      C("vermillion", "Ангелы Киновари", {
        geneseed: "Как у Кровавых Ангелов.",
        culture: "«Красный Урожай» — Deceive, Operate (Aeronautica), Stealth дружественны; Charm, Logic враждебны. Security, Tech-Use, Frenzy, Battle Rage.",
        curse: "«Красная Жажда» и «Чёрный Гнев». Пили кровь человека за месяц: +30 против проклятий, переброс против Чёрного Гнева; Лоялист при этом получает +1 Порчи за каждое получение Порчи." ,
        cult: { friendlySkills: ["Deceive", "Operate (Aeronautica)", "Stealth"], friendlyTalents: [],
                hostileSkills: ["Charm", "Logic"], hostileTalents: [],
                grantSkills: ["Security", "Tech-Use"], grantTalents: ["Frenzy", "Battle Rage"] } }),
      C("sanguine", "Ангелы Сангвина", {
        geneseed: "Как у Кровавых Ангелов. Бископея — мышцы усыхают (вид мумии), без влияния на способности. Меланохром — мертвенно-бледная серая холодная кожа.",
        culture: "«Схождение Ангелов» — Operate (Aeronautica) дружественен. Trade (Mason/Musician/Painter), Frenzy, Battle Rage.",
        curse: "«Красная Жажда» и «Чёрный Гнев». +20 на Красную Жажду и нельзя впасть в неё перманентно, но −10 на Чёрный Гнев." ,
        cult: { friendlySkills: ["Operate (Aeronautica)"], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: ["Trade (Mason)"], grantTalents: ["Frenzy", "Battle Rage"] } }),
      C("atlantian", "Атлантские Копья", {
        geneseed: "Как у Кровавых Ангелов. Каталептический Узел — нет снов; псайкер получает фокус Прорицания (или Либрариум).",
        culture: "«Холодная Ярость» — Logic, Operate (Aeronautica) дружественны, Intimidate враждебен. Frenzy, Cold Fury, Battle Rage.",
        curse: "«Красная Жажда» и «Чёрный Гнев». Персональное Предсказание читает следующее испытание Чёрного Гнева; 8 ч медитации (нужен Meditation) → +20 и Преимущество против Чёрной Ярости на неделю." ,
        cult: { friendlySkills: ["Logic", "Operate (Aeronautica)"], friendlyTalents: [],
                hostileSkills: ["Intimidate"], hostileTalents: [],
                grantSkills: [], grantTalents: ["Frenzy", "Cold Fury", "Battle Rage"] } }),
      C("charnel", "Гвардия Склепов", {
        geneseed: "Как у Кровавых Ангелов.",
        culture: "«Во Тьме Меж Стен» — Operate (Surface) и Rapid Reaction, Reposition, Meat Shield, Steady Footwork, Cleave, Thunder Charge дружественны; Combat Master, Hunker Down, Raptor, Knife Fighter, Marksman враждебны. Blind Fighting, Frenzy, Battle Rage.",
        curse: "«Красная Жажда» и «Чёрный Гнев». +15 против обоих в тесном помещении (≤12 м), +30 в машине/очень тесном (≤5 м)." ,
        cult: { friendlySkills: ["Operate (Surface)"], friendlyTalents: ["Rapid Reaction", "Reposition", "Meat Shield", "Steady Footwork", "Cleave", "Thunder Charge"],
                hostileSkills: [], hostileTalents: ["Combat Master", "Hunker Down", "Raptor", "Knife Fighter", "Marksman"],
                grantSkills: [], grantTalents: ["Blind Fighting", "Frenzy", "Battle Rage"] } }),
      C("blooddrinkers", "Кровопийцы", {
        geneseed: "Как у Кровавых Ангелов.",
        culture: "«Схождение Ангелов» — Operate (Aeronautica) дружественен. Trade (Mason/Musician/Painter), Frenzy, Battle Rage.",
        curse: "«Красная Жажда» и «Чёрный Гнев». +20 против обоих, но Порча Тзинча ×2. Провал Чёрного Гнева — видение Кайроса (согласие → Хаосит, Покровительство Тзинча, Псайбер Кайроса)." ,
        cult: { friendlySkills: ["Operate (Aeronautica)"], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: ["Trade (Mason)"], grantTalents: ["Frenzy", "Battle Rage"] } }),
      C("lamenters", "Плакальщики", {
        geneseed: "Как у Кровавых Ангелов.",
        culture: "«Схождение Ангелов» — Operate (Aeronautica) дружественен. Trade (Mason/Musician/Painter), Frenzy, Battle Rage.",
        curse: "«Красная Жажда» и «Чёрный Гнев» (+30 против обоих; до 913.M41 оба исцелены) и «Злой Рок» — случайные опасности всегда нацеливаются на вас." ,
        cult: { friendlySkills: ["Operate (Aeronautica)"], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: ["Trade (Mason)"], grantTalents: ["Frenzy", "Battle Rage"] } }),
      C("fleshtearers", "Расчленители", {
        geneseed: "Как у Кровавых Ангелов.",
        culture: "«Безудержный Гнев» — Athletics, Operate (Aeronautica) и Preternatural Speed, Tireless, Flesh Render, Cleave, Furious Assault, Overpower дружественны; Charm и Combat Master, Bodyguard, Disarm, Takedown, Cold Fury, Reprise враждебны. Frenzy, Battle Rage, Fire in Blood.",
        curse: "«Красная Жажда» и «Чёрный Гнев». −10 против обоих, но в Ярости от Красной Жажды +2 к Unnatural S и Unnatural T." ,
        cult: { friendlySkills: ["Athletics", "Operate (Aeronautica)"], friendlyTalents: ["Preternatural Speed", "Tireless", "Flesh Render", "Cleave", "Furious Assault", "Overpower"],
                hostileSkills: ["Charm"], hostileTalents: ["Combat Master", "Bodyguard", "Disarm", "Takedown", "Cold Fury", "Reprise"],
                grantSkills: [], grantTalents: ["Frenzy", "Battle Rage", "Fire in Blood"] } })
    ] }),

  L("X", "Железные Руки", {
    geneseed: "Нет мутаций.",
    culture: "«Плоть Слаба» — Tech-Use дружественен. За элемент Good.Q+ бионики/кибернетики — нейтральный Навык/Талант → дружественный (или враждебный → нейтральный). Best.Q бионическая рука Легиона как старт.",
    curse: "«Презрение к Слабости» — расстройства Иерархичность и Перфекционизм (Тяжесть −2, не ниже −4). Перфекционизм снимается «совершенством формы» (Трейт Machine); Иерархичность — только божественным вмешательством." ,
    chapters: [
      C("stardragons", "Звёздные Драконы", {
        geneseed: "Оккулоб — радужки чёрные, частичная цветовая слепота (не различает красный). "
                + "Железа Бетчера — не работает.",
        culture: "«Сила Небес» — Operate (Aeronautica) и Tech-Use и Таланты Reposition, Sprint, Hard Target, "
               + "Step Aside, Dragoon и Jink дружественны; Charm и Таланты Scanning Advance, Hunker Down, Cleave, "
               + "Tenacity, Mighty Shot и Roll With It враждебны. +10 на стрелковые атаки по целям ниже и +10 на "
               + "рукопашные в Ход спуска хотя бы на одну высоту.",
        curse: "«Презрение к Слабости» — как у Железных Рук; от Перфекционизма избавляет Mastery (Operate (Aeronautica)).",
        cult: { friendlySkills: ["Operate (Aeronautica)", "Tech-Use"],
                friendlyTalents: ["Reposition", "Sprint", "Hard Target", "Step Aside", "Dragoon", "Jink"],
                hostileSkills: ["Charm"],
                hostileTalents: ["Scanning Advance", "Hunker Down", "Cleave", "Tenacity", "Mighty Shot", "Roll With It"],
                grantSkills: [], grantTalents: [] } }),
      C("redtalons", "Красные Когти", {
        geneseed: "Нет мутаций.",
        culture: "«Окровавленные Когти» — Athletics и Tech-Use и Таланты Iron Jaw, Resistance, Never Die, Wrestler, "
               + "Crushing Blow и Mighty Shot дружественны; Acrobatics и Charm и Таланты Sprint, Blade Reader, Reaper, "
               + "Precise Blow, Sharpshooter и Mind Killer враждебны. Раз за сцену или бой — переброс любого теста S, T или W.",
        curse: "«Презрение к Слабости» — как у Железных Рук; Перфекционизм неизлечим.",
        cult: { friendlySkills: ["Athletics", "Tech-Use"],
                friendlyTalents: ["Iron Jaw", "Resistance", "Never Die", "Wrestler", "Crushing Blow", "Mighty Shot"],
                hostileSkills: ["Acrobatics", "Charm"],
                hostileTalents: ["Sprint", "Blade Reader", "Reaper", "Precise Blow", "Sharpshooter", "Mind Killer"],
                grantSkills: [], grantTalents: [] } }),
      C("ironlords", "Повелители Железа", {
        geneseed: "Нет мутаций.",
        culture: "«Знай Врага» — Logic и Tech-Use и Таланты Combat Formation, Mental Fortitude, Surgical Precision, "
               + "Tank Hunter, Wisdom of the Ancients и Taste the Soul дружественны; Charm и все Таланты группы "
               + "«Берсерк», кроме Cold Fury и Battle Rage, враждебны. Раз за сцену или бой — переброс теста Lore, "
               + "Tech-Use или Medicae на вспоминание.",
        curse: "«Презрение к Слабости» — как у Железных Рук; от Перфекционизма избавляет Mastery (Logic).",
        cult: { friendlySkills: ["Logic", "Tech-Use"],
                friendlyTalents: ["Combat Formation", "Mental Fortitude", "Surgical Precision", "Tank Hunter",
                                  "Wisdom of the Ancients", "Taste the Soul"],
                hostileSkills: ["Charm"], hostileTalents: ["группа:Берсерк!Cold Fury,Battle Rage"],
                grantSkills: [], grantTalents: [] } }),
      C("steelconfessors", "Стальные Исповедники", {
        geneseed: "Нет мутаций.",
        culture: "«Левая Длань Марса» — Tech-Use и Exotic Weapon Training для оружия Механикум дружественны. "
               + "Дают ограниченные Импланты Механикум: не позволяют имплантировать кибернетику Механикум и "
               + "изучать Техночудеса, в остальном работают как обычные.",
        curse: "«Презрение к Слабости» — как у Железных Рук.",
        cult: { friendlySkills: ["Tech-Use"], friendlyTalents: ["Exotic Weapon Training"],
                hostileSkills: [], hostileTalents: [], grantSkills: [], grantTalents: [] } }),
      C("sonsofmedusa", "Сыны Медузы", {
        geneseed: "Нет мутаций.",
        culture: "«Братоубийцы» — Tech-Use дружественен. Раз за сцену или бой — переброс любого броска "
               + "(атакующего или защитного) против другого Астартес.",
        curse: "«Презрение к Слабости» — как у Железных Рук.",
        cult: { friendlySkills: ["Tech-Use"], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [], grantSkills: [], grantTalents: [] } })
    ] }),

  L("XII", "Пожиратели Миров", {
    geneseed: "Каталептический Узел — +30 против ментальных расстройств от регулярного дружеского общения. Гвозди Мясника подавляют эффект.",
    culture: "«Красные Пески» — Frenzy, Fire in Blood, Hatred (любые три). Трейт Butcher’s Nails «Берсерка Кхорна» и −500 XP к этому Архетипу.",
    curse: "«Отмеченный» — Кхорн считает вас своей собственностью. Банды XII легиона почти не разошлись культурно — отдельных орденов нет." }),

  L("XIII", "Ультрамарины", {
    geneseed: "Нет мутаций.",
    culture: "«Теория и Практика» — Common Lore (War)+10, Scholastic Lore (Tactica Imperialis)+10, Forbidden Lore (Codex Astartes)+10, Linguistics (High Gothic). Раз/сцену — переброс этих Навыков, Command или Logic.",
    curse: "Нет проклятья.",
    chapters: [
      C("aurora", "Аврора", {
        geneseed: "Нет мутаций.",
        culture: "«Стальной Прилив» — Operate (Surface), Tech-Use дружественны. Раз/сцену — переброс теста на наземную машину/её оружие или атаки/Избегания в Раунд высадки.",
        curse: "Нет проклятья." ,
        cult: { friendlySkills: ["Operate (Surface)", "Tech-Use"], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: [], grantTalents: [] } }),
      C("whiteconsuls", "Белые Консулы", {
        geneseed: "Нет мутаций.",
        culture: "«Единая Сила» — Command, Charm дружественны. Common Lore (Imperium)+10, Scholastic Lore (Tactica Imperialis)+10, Hatred (Word Bearers). Раз/сцену — переброс общения/командования людьми.",
        curse: "Нет проклятья." ,
        cult: { friendlySkills: ["Command", "Charm"], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: ["Common Lore (Imperium)+10", "Scholastic Lore (Tactica Imperialis)+10"], grantTalents: ["Hatred (Word Bearers)"] } }),
      C("howlinggriffons", "Воющие Грифоны", {
        geneseed: "Нет мутаций.",
        culture: "«Вечный Крестовый Поход» — Athletics, Parry и Preternatural Speed, True Grit, Flesh Render, Reaper, Battle Rage, Vengeance, Shield of Contempt дружественны; Charm, Deceive и Scanning Advance, Cold Fury, Deadeye Shot, Target Selection, Bolter Drill, Meditation враждебны. Frenzy, Hatred (Word Bearers), Mental Rage.",
        curse: "«Проклятье Слова» — расстройство «Ненависть» к Несущим Слово (Тяжесть 3, не ниже 3); их Тёмные Апостолы используют это против вас." ,
        cult: { friendlySkills: ["Athletics", "Parry"], friendlyTalents: ["Preternatural Speed", "True Grit", "Flesh Render", "Reaper", "Battle Rage", "Vengeance", "Shield of Contempt"],
                hostileSkills: ["Charm", "Deceive"], hostileTalents: ["Scanning Advance", "Cold Fury", "Deadeye Shot", "Target Selection", "Bolter Drill", "Meditation"],
                grantSkills: [], grantTalents: ["Frenzy", "Hatred (Word Bearers)", "Mental Rage"] } }),
      C("ironsnakes", "Железные Змеи", {
        geneseed: "Оссмодула — на 10–15% выше обычного десантника (Размер 1).",
        culture: "«Фаланга» — Double Team, Quick Store. Good.Q копьё Легиона с модификацией Моно, Абордажный щит и система Маг-перчатки для брони как старт.",
        curse: "Нет проклятья." ,
        cult: { friendlySkills: [], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: [], grantTalents: ["Double Team", "Quick Store"] } }),
      C("emperorsspears", "Копья Императора", {
        geneseed: "Нет мутаций.",
        culture: "«Смерть с Небес» — Operate (Aeronautica) и Catfall, Raptor, Flying Kick дружественны. +10 на стрелковые атаки по целям ниже; +10 на рукопашные в Ход спуска на высоту ниже. Good.Q Гравишют Легиона в ранце брони.",
        curse: "Нет проклятья." ,
        cult: { friendlySkills: ["Operate (Aeronautica)"], friendlyTalents: ["Catfall", "Raptor", "Flying Kick"],
                hostileSkills: [], hostileTalents: [],
                grantSkills: [], grantTalents: [] } }),
      C("doomeagles", "Роковые Орлы", {
        geneseed: "Нет мутаций.",
        culture: "«Крылья Мёртвых» — Operate (Aeronautica) дружественен. Resistance (Fear), Unshakeable Will, +10 против ментальных расстройств. Прыжковый ранец как старт.",
        curse: "Нет проклятья." ,
        cult: { friendlySkills: ["Operate (Aeronautica)"], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: [], grantTalents: ["Resistance", "Unshakeable Will"] } }),
      C("silverskulls", "Серебряные Черепа", {
        geneseed: "Бископея/Оолитическая Почка — +20 на операции бионики, ×4 восстановление (химерическое геносемя Жиллимана и Пертурабо).",
        culture: "«Рейдеры Укреплений» — Logic, Tech-Use и Combat Formation, Reposition, Sure Strike, Litany of Cleaning, Iron Discipline дружественны; Inquiry и Whirlwind of Death, Storm of Lead, Beloved Leader, Peer враждебны. Hunker Down, Mind Killer.",
        curse: "Нет проклятья." ,
        cult: { friendlySkills: ["Logic", "Tech-Use"], friendlyTalents: ["Combat Formation", "Reposition", "Sure Strike", "Litany of Cleaning", "Iron Discipline"],
                hostileSkills: ["Inquiry"], hostileTalents: ["Whirlwind of Death", "Storm of Lead", "Beloved Leader", "Peer"],
                grantSkills: [], grantTalents: ["Hunker Down", "Mind Killer"] } }),
      C("marineserrant", "Странствующие Десантники", {
        geneseed: "Нет мутаций.",
        culture: "«Абордажные Специалисты» — Operate (Aeronautica), Tech-Use и Hip Shooting, Scanning Advance, Quick Store, Hard Target, Meat Shield, Bolter Drill, Sprayer дружественны; Deceive и Frenzy, Dragoon, Marksman, Sniper Assassin, Iron Discipline, Solipsism враждебны. Common Lore (Imperial Fleet)+10, Trade (Voidfarer)+10, Hatred (Night Lords), Hunker Down. Абордажный щит как старт.",
        curse: "Нет проклятья." ,
        cult: { friendlySkills: ["Operate (Aeronautica)", "Tech-Use"], friendlyTalents: ["Hip Shooting", "Scanning Advance", "Quick Store", "Hard Target", "Meat Shield", "Bolter Drill", "Sprayer"],
                hostileSkills: ["Deceive"], hostileTalents: ["Frenzy", "Dragoon", "Marksman", "Sniper Assassin", "Iron Discipline", "Solipsism"],
                grantSkills: ["Common Lore (Imperial Fleet)+10", "Trade (Voidfarer)+10"], grantTalents: ["Hatred (Night Lords)", "Hunker Down"] } }),
      C("scythes", "Косы Императора", {
        geneseed: "Нет мутаций.",
        culture: "«На Истощение» — Navigate (Surface) и Таланты Combat Master, True Grit, Whirlwind of Death, "
               + "Covering Fire и Storm of Lead дружественны. Даёт Forbidden Lore (Xenos (Tyranids)) и Талант "
               + "Hatred (Tyranids).",
        curse: "Нет проклятья.",
        cult: { friendlySkills: ["Navigate"],
                friendlyTalents: ["Combat Master", "True Grit", "Whirlwind of Death", "Covering Fire", "Storm of Lead"],
                hostileSkills: [], hostileTalents: [],
                grantSkills: ["Forbidden Lore (Xenos)"], grantTalents: ["Hatred (Tyranids)"] } }),
      C("mortifactors", "Мортифакторы", {
        geneseed: "Сус-ан Мембрана — не работает. Омофагея — при поедании мозга десантника с геносеменем "
                + "Мортифакторов позволяет продвигать один из его Навыков или Талантов как дружественный, "
                + "независимо от Покровительства.",
        culture: "«Упорство в Жизни, Почёт в Смерти» — Navigate (Surface) и Таланты Tireless, Blind Fighting, "
               + "High Guard и Covering Fire дружественны. Если носить на броне реликварий из костей павшего "
               + "товарища, даёт один Талант на выбор: Never Die, Pain Is an Illusion, Fearless или Strong Minded "
               + "(меняется сменой реликвария, но не больше одного одновременно).",
        curse: "Нет проклятья.",
        cult: { friendlySkills: ["Navigate"],
                friendlyTalents: ["Tireless", "Blind Fighting", "High Guard", "Covering Fire"],
                hostileSkills: [], hostileTalents: [], grantSkills: [], grantTalents: [] } }),
      C("nemesis", "Немезис", {
        geneseed: "Второе Сердце, Оссмодула, Бископея, Гемастамен и Оолитическая Почка — небольшие изъяны "
                + "приводят к ускоренному старению: первые косметические признаки в 100 лет вместо 200-300.",
        culture: "«Кающиеся Палачи» — Awareness и Intimidate и Таланты Snake Eater, Combat Master, Steady Footwork, "
               + "Whirlwind of Death и Storm of Lead дружественны. Даёт один переброс за сцену или бой теста против "
               + "опасностей среды (температура, вакуум, радиация, необычная гравитация) и +10 на тесты против "
               + "ментальных расстройств.",
        curse: "Нет проклятья.",
        cult: { friendlySkills: ["Awareness", "Intimidate"],
                friendlyTalents: ["Snake Eater", "Combat Master", "Steady Footwork", "Whirlwind of Death", "Storm of Lead"],
                hostileSkills: [], hostileTalents: [], grantSkills: [], grantTalents: [] } }),
      C("novamarines", "Новадесантники", {
        geneseed: "Нет мутаций.",
        culture: "«Монодоминирование» — даёт Forbidden Lore (Codex Astartes)+10 и Талант Hatred (Xenos, все). "
               + "Экзотическое оружие и Терминаторская броня считаются на 1 Редкость ниже для стартового "
               + "снаряжения. При обмене стартового оружия или брони на модификации позволяет брать модификации "
               + "до R 4 вместо R 2.",
        curse: "Нет проклятья.",
        cult: { friendlySkills: [], friendlyTalents: [], hostileSkills: [], hostileTalents: [],
                grantSkills: ["Forbidden Lore (Codex Astartes)+10"], grantTalents: ["Hatred (Xenos)"] } }),
      C("fireangels", "Огненные Ангелы", {
        geneseed: "Нет мутаций.",
        culture: "«Вера и Пламя» — даёт Common Lore (Imperial Creed)+10, Scholastic Lore (Imperial Creed)+10, "
               + "Linguistics (High Gothic) и Талант Divine Protection. Раз за сцену или бой позволяет отменить "
               + "трату Очка Бесчестия вместе с её эффектом (например, если переброс оказался хуже начального).",
        curse: "Нет проклятья.",
        cult: { friendlySkills: [], friendlyTalents: [], hostileSkills: [], hostileTalents: [],
                grantSkills: ["Common Lore (Imperial Creed)+10", "Scholastic Lore (Imperial Creed)+10",
                              "Linguistics (High Gothic)"],
                grantTalents: ["Divine Protection"] } }),
      C("relictors", "Реликторы", {
        geneseed: "Нет мутаций.",
        culture: "«Адский Арсенал» — даёт Forbidden Lore (Daemons)+10 и Таланты Glorious Purpose и "
               + "Erudite-Infernal. Улучшение оружия до Демонического или Оружия Наследия стоит на 1 очко "
               + "реквизиции меньше, а мистическое снаряжение считается на 1 Редкость ниже для стартового.",
        curse: "Нет проклятья.",
        cult: { friendlySkills: [], friendlyTalents: [], hostileSkills: [], hostileTalents: [],
                grantSkills: ["Forbidden Lore (Daemons)+10"],
                grantTalents: ["Glorious Purpose", "Erudite-Infernal"] } })
    ] }),

  L("XIV", "Гвардия Смерти", {
    geneseed: "Оолитическая Почка — +20 против болезней и ядов.",
    culture: "«Тактика Истощения» — Sound Constitution ×4 и продвижение Т до +10. Элитный Архетип «Чумной Десантник» без требований, −500 XP.",
    curse: "«Отмеченный» — без Покровительства Нургла бросаете на заражение обычными болезнями; провал → 1d100, на 7 (1–7 если сверхъестественная) — Чума Разрушения.",
    chapters: [
      C("apostlescontagion", "Апостолы Заражения", {
        geneseed: "Как у Гвардии Смерти.",
        culture: "«Пастыри Мёртвых» — Sound Constitution ×2, продвижение Т до +5, Medicae+10 (или +10 к нему), Surgical Precision. «Чумной Десантник» без требований, −500 XP. Особый штамм Чумы Неверия (не действует на десантников; зомби подчиняются только Апостолам).",
        curse: "«Отмеченный» — как у Гвардии Смерти." ,
        cult: { friendlySkills: [], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: ["Medicae+10"], grantTalents: ["Sound Constitution", "Sound Constitution", "Surgical Precision"] } }),
      C("harbingers", "Предвестники", {
        geneseed: "Как у Гвардии Смерти.",
        culture: "«Чумной Флот» — Sound Constitution ×2, продвижение Т до +5, Trade (Voidfarer)+10, Hunker Down. «Чумной Десантник» без требований, −500 XP.",
        curse: "«Отмеченный» — как у Гвардии Смерти." ,
        cult: { friendlySkills: [], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: ["Trade (Voidfarer)+10"], grantTalents: ["Sound Constitution", "Sound Constitution", "Hunker Down"] } })
    ] }),

  L("XV", "Тысяча Сынов", {
    geneseed: "Каталептический Узел — мутация Вирд (как Связанный) и Талант Psy-Rating.",
    culture: "«Хранители Знаний» — Common Lore (Chaos, Imperium)+10, Scholastic Lore (Legend, Numerology, Occult)+10. Раз/сцену — переброс любого броска Lore.",
    curse: "«Изменение Плоти» — перед броском на расстройство (или после мощной психосилы) W+20; провал: Лоялист → Отродье Хаоса, Хаосит → случайная мутация. Рубрика Аримана подавляет проклятье." ,
    chapters: [
      C("prodigalsons", "Блудные Сыны", {
        geneseed: "Как у Тысячи Сынов или другого легиона (треть ковена — «приёмные» колдуны).",
        culture: "«Война в Паутине» — даёт Forbidden Lore (Eldar и Eldar Occult)+10 и Талант Hatred (Eldar). "
               + "Также 2 очка стартового снаряжения, которые можно потратить только на мистическое снаряжение, "
               + "психосиловое оружие, их улучшение и записи ритуалов.",
        curse: "Как у Тысячи Сынов или другого легиона.",
        cult: { friendlySkills: [], friendlyTalents: [], hostileSkills: [], hostileTalents: [],
                grantSkills: ["Forbidden Lore (Eldar)+10", "Forbidden Lore (Xenos Occult)+10"],
                grantTalents: ["Hatred (Eldar)"] } }),
      C("bladesofmagnus", "Клинки Магнуса", {
        geneseed: "Как у Тысячи Сынов.",
        culture: "«Продолжение Воли» — даёт Таланты Wisdom of the Ancients и Infused Knowledge, а также фокусы "
               + "всех фундаментальных психических дисциплин и двух редких на выбор Магнуса (то есть ГМа). "
               + "Редкие дисциплины Примарх может менять в зависимости от полезности своего орудия.",
        curse: "«Изменение Плоти» — как у Тысячи Сынов. Плюс «Рабы Магнуса»: Магнус читает ваши мысли, видит "
             + "вашими глазами и слышит вашими ушами на любом расстоянии, телепатически отдаёт приказы, которым "
             + "нужно следовать по духу, а не только по букве. Даёт Трейты Psyber (Магнус) и Soul-Bound; мутацию "
             + "от Soul-Bound Магнус может менять между сессиями — наградой или наказанием.",
        cult: { friendlySkills: [], friendlyTalents: [], hostileSkills: [], hostileTalents: [],
                grantSkills: [], grantTalents: ["Wisdom of the Ancients", "Infused Knowledge"] } }),
      C("redecho", "Красное Эхо", {
        geneseed: "Как у Тысячи Сынов.",
        culture: "«Заклание» — Charm и Intimidate дружественны. Даёт Таланты Sacrifice и Scapegoat. Раз за бой "
               + "или сцену — переброс психотеста с Путём Силы «Жертва» или теста ритуала, в котором приносится "
               + "в жертву разумное существо. Также +5 на психотесты и тесты ритуалов за каждый уровень "
               + "истончения Завесы от массовых смертей.",
        curse: "«Изменение Плоти» — как у Тысячи Сынов.",
        cult: { friendlySkills: ["Charm", "Intimidate"], friendlyTalents: [],
                hostileSkills: [], hostileTalents: [],
                grantSkills: [], grantTalents: ["Sacrifice", "Scapegoat"] } }),
      C("tizcanhost", "Тизканское Воинство", {
        geneseed: "Как у Тысячи Сынов.",
        culture: "«Колдуны Войны» — даёт Common Lore (War)+10, Scholastic Lore (Tactica Imperialis)+10 и Талант "
               + "Child of the Warp. Если при манифестации в усиленном режиме тратит Очко Бесчестия на "
               + "дополнительные Успехи, может добавлять Успехи манифестации ко всему урону силы против одной цели.",
        curse: "«Изменение Плоти» — как у Тысячи Сынов. Плюс «Ангелы Разрушения»: расстройство Агрессия на "
             + "Тяжести 0, и его Тяжесть не может опуститься ниже −4.",
        cult: { friendlySkills: [], friendlyTalents: [], hostileSkills: [], hostileTalents: [],
                grantSkills: ["Common Lore (War)+10", "Scholastic Lore (Tactica Imperialis)+10"],
                grantTalents: ["Child of the Warp"] } })
    ] }),

  L("XVI", "Чёрный Легион", {
    geneseed: "Оссмодула — 10% сходство лица с Хорусом.",
    culture: "«Тёмное Братство» — Common Lore (War)+10, Scholastic Lore (Heraldry)+10. +2 СУ Коротким Командам при Слаженности +30+.",
    curse: "«Опустошение» — теряя Командное Присутствие из-за смерти/трусости/бегства командира, W+10 или Ступор на 1 Раунд." ,
    chapters: [
      C("luperci", "Луперки", {
        geneseed: "Как у Чёрного Легиона.",
        culture: "«Волки Хтонии» — −250 XP к стоимости Элитного Архетипа «Одержимый» и +30 на социальные "
               + "взаимодействия с демоном внутри. Дар «Звериные Ноги» не учитывается в максимуме активных Даров. "
               + "Во время Проявления удваивает бонусы на рукопашные атаки за численное преимущество — себе и "
               + "союзникам в той же рукопашной.",
        curse: "«Опустошение» — как у Чёрного Легиона.",
        cult: { friendlySkills: [], friendlyTalents: [], hostileSkills: [], hostileTalents: [],
                grantSkills: [], grantTalents: [] } }),
      C("sonsoftheeye", "Сыны Ока", {
        geneseed: "Как у Чёрного Легиона.",
        culture: "«Неистовый Штурм» — Athletics и Таланты Hip Shooting, Sprint, Hard Target, True Grit, "
               + "Bayonet Charge и Run and Gun дружественны; Deceive и Таланты Hunker Down, Tenacity, Covering Fire, "
               + "Sharpshooter, Bolter Drill и Iron Discipline враждебны. Даёт Талант Double Team. Hip Shooting "
               + "позволяет стрелять при Перебежке как при обычном Полном движении. В первый Ход рукопашной "
               + "считается как 2 персонажа в расчёте численного преимущества.",
        curse: "«Опустошение» — как у Чёрного Легиона.",
        cult: { friendlySkills: ["Athletics"],
                friendlyTalents: ["Hip Shooting", "Sprint", "Hard Target", "True Grit", "Bayonet Charge", "Run and Gun"],
                hostileSkills: ["Deceive"],
                hostileTalents: ["Hunker Down", "Tenacity", "Covering Fire", "Sharpshooter", "Bolter Drill", "Iron Discipline"],
                grantSkills: [], grantTalents: ["Double Team"] } })
    ] }),

  L("XVII", "Несущие Слово", {
    geneseed: "Нет мутаций.",
    culture: "«Изначальная Истина» — Common Lore (Chaos)+20, Forbidden Lore (Daemons)+10, Forbidden Lore (Heresy)+10, Forbidden Lore (Warp), Linguistics (Chaos Glyphs, True Tongue). Раз/сцену — переброс этих Навыков, Charm или Deceive.",
    curse: "Нет проклятья." ,
    chapters: [
      C("sanctified", "Освящённые", {
        geneseed: "Нет мутаций.",
        culture: "«Храм Битвы» — даёт Common Lore (War)+20, Forbidden Lore (Daemons)+10, Forbidden Lore (Heresy)+10 "
               + "и Linguistics (Chaos Glyphs и True Tongue). Перебросы любых тестов ритуалов, в которых жертвы "
               + "приносятся в полноценном бою. Позволяет проводить контрмеры против срывов ритуалов Веры даже без "
               + "Таланта Mastery, если срыв вызван смертью участников или назначенных жертв.",
        curse: "Нет проклятья.",
        cult: { friendlySkills: [], friendlyTalents: [], hostileSkills: [], hostileTalents: [],
                grantSkills: ["Common Lore (War)+20", "Forbidden Lore (Daemons)+10", "Forbidden Lore (Heresy)+10",
                              "Linguistics (Chaos Glyphs)", "Linguistics (True Tongue)"],
                grantTalents: [] } }),
      C("prophetsofpath", "Пророки Пути", {
        geneseed: "Нет мутаций.",
        culture: "«Пастыри Чёрного Крестового Похода» — даёт Common Lore (регион)+20, Forbidden Lore "
               + "(Followers of Chaos, регион)+10, Forbidden Lore (Daemons)+10, Forbidden Lore (Heresy)+10 и "
               + "Linguistics (Chaos Glyphs и True Tongue). Также +20 и один переброс за сцену или бой на все "
               + "социальные взаимодействия с другими Хаоситами, не являющимися подчинёнными или врагами.",
        curse: "Нет проклятья.",
        cult: { friendlySkills: [], friendlyTalents: [], hostileSkills: [], hostileTalents: [],
                grantSkills: ["Forbidden Lore (Daemons)+10", "Forbidden Lore (Heresy)+10",
                              "Linguistics (Chaos Glyphs)", "Linguistics (True Tongue)"],
                grantTalents: [] } })
    ] }),

  L("XVIII", "Саламандры", {
    geneseed: "Бископея — +10 S/Т, −10 A, +30% веса. Каталептический Узел — −2 Инициатива. Оккулоб — тепловидение. Меланохром — угольно-чёрная кожа, нужны добавки в диету. Мукраноид — +20 против жара, +1 от радиации, +4 поглощения E(Fl).",
    culture: "«Кредо Прометея» — группа «Огнемётчик» дружественна, «Скорость» враждебна. Linguistics (Nocturnal), Trade (Armourer, Weaponsmith)+10, Hatred (Eldar). +Качество старта/реквизиции ×3 (броня/оружие); 3 модификации R3−; полный набор систем силовой брони.",
    curse: "«Милосердие» — видя убийство/пытку небойцов, W+30 или обязан вмешаться; самому убить/пытать таких — W−30. Не реагирует на насилие против ксеносов/аблюдей/Астартес/мутантов." ,
    chapters: [
      C("blackdragons", "Чёрные Драконы", {
        geneseed: "Оссмодула — при особой диете (R 0 за 6-месячный курс) из костей предплечий и черепа вырастают "
                + "длинные шипы: Трейт Natural Weapons (3, Рога + Когти). Если покрыть их адамантием (модификация "
                + "оружия R 1) — Deadly Natural Weapons. Оккулоб — белки глаз становятся чёрными. "
                + "Мукраноид — ещё +20 против жара, +1 защиты от радиации и +4 поглощения E(Fl) урона.",
        culture: "«Огнём и Когтем» — Таланты Cleave, Slam, Wrestler, Sprayer, Two Weapon Wielder и Savage "
               + "дружественны; Quick Store, Armour-Monger, Disarm, Grind, Tenacity и Assassin Strike враждебны. "
               + "Позволяет атаковать рогами за Реакцию в Ход вне Натиска, но тогда −1 кубик урона от них.",
        curse: "«Милосердие» — как у Саламандр.",
        cult: { friendlySkills: [],
                friendlyTalents: ["Cleave", "Slam", "Wrestler", "Sprayer", "Two Weapon Wielder", "Savage"],
                hostileSkills: [],
                hostileTalents: ["Quick Store", "Armour-Monger", "Disarm", "Grind", "Tenacity", "Assassin Strike"],
                grantSkills: [], grantTalents: [] } }),
      C("stormgiants", "Штормовые Великаны", {
        geneseed: "Как у Саламандр. Оссмодула — на 30-40% больше обычных десантников: Чёрный Панцирь больше не "
                + "сохраняет Трейт Nimble в силовой броне, максимальная дальность всего рукопашного оружия +1, "
                + "броня требует доводки как от мутации. Бископея — +2 к рейтингу Трейта Unnatural S (обычно до 6).",
        culture: "«Могущество» — Athletics и Таланты Everything a Weapon, Street Fighting, Slam, Unarmed Master, "
               + "Wrestler и Clobber дружественны; Acrobatics и Таланты Sure Strike, Crippling Strike, Precise Blow, "
               + "Assassin Strike, Blademaster и Lightning Attack враждебны. Считается на 1 Размер больше в расчёте Борьбы.",
        curse: "«Милосердие» — как у Саламандр.",
        cult: { friendlySkills: ["Athletics"],
                friendlyTalents: ["Everything a Weapon", "Street Fighting", "Slam", "Unarmed Master", "Wrestler", "Clobber"],
                hostileSkills: ["Acrobatics"],
                hostileTalents: ["Sure Strike", "Crippling Strike", "Precise Blow", "Assassin Strike",
                                 "Blademaster", "Lightning Attack"],
                grantSkills: [], grantTalents: [] } })
    ] }),

  L("XIX", "Гвардия Ворона", {
    geneseed: "Оккулоб — чёрные радужки. Меланохром — бледная кожа, чёрные волосы. Мукраноид и Железа Бетчера не работают.",
    culture: "«Незримые Клинки» — Stealth, Acrobatics и Lightning Reflexes, Leap Up, Reposition, Catfall, Step Aside, Assassin Strike, Savage дружественны; Charm, Inquiry и Iron Jaw, Armour-Monger, Hunker Down, Tireless, True Grit, Frenzy, Fearless враждебны. Stealth (или +10), Rapid Reaction, Double Team.",
    curse: "«Пепельная Слепота» — смерть товарища → W+10; провал: обязан атаковать убийцу Провалы Ходов, на Провалы дней не Команды и −30 соц. Крит-провал — перманентно. Талант «Теневой Родич».",
    chapters: [
      C("ashenclaws", "Пепельные Когти", {
        geneseed: "Как у Гвардии Ворона.",
        culture: "«Тактическое Окружение» — Acrobatics и Hip Shooting, Hard Target, Double Team, Assassin Strike, Field Execution, Cannon Fodder дружественны; Charm и Scanning Advance, Hunker Down, Gatekeeper, Covering Fire, Marksman, Radiant Presence враждебны. Deceive, Linguistics (Battle Cant), Leap Up, Target Selection.",
        curse: "«Пепельная Слепота» — как у Гвардии Ворона, но тест W−10 вместо W+10." ,
        cult: { friendlySkills: ["Acrobatics"], friendlyTalents: ["Hip Shooting", "Hard Target", "Double Team", "Assassin Strike", "Field Execution", "Cannon Fodder"],
                hostileSkills: ["Charm"], hostileTalents: ["Scanning Advance", "Hunker Down", "Gatekeeper", "Covering Fire", "Marksman", "Radiant Presence"],
                grantSkills: ["Deceive", "Linguistics (Battle Cant)"], grantTalents: ["Leap Up", "Target Selection"] } }),
      C("deathspectres", "Призраки Смерти", {
        geneseed: "Как у Гвардии Ворона. Меланохром — белая просвечивающая кожа, белые волосы. Сус-ан Мембрана — раз/сутки исцеляет 2×СУ Ран (в конце след. Хода; засекается как Биомантия). Прогеноиды — 80% несовместимости вне евгенической программы.",
        culture: "«За Гранью Смерти» — Intimidate и Combat Sense, Never Die, Pain Is An Illusion, Hero’s Sleep, Mind Killer дружественны; Inquiry и True Grit, Crushing Blow, Frenzy, Deadeye Shot, Sharpshooter, Frontline Commander враждебны. Forbidden Lore (Psykers)+10, Resistance (Psychic Powers), Don’t Trust Your Eyes, Strong Minded.",
        curse: "«Пепельная Слепота» — как у Гвардии Ворона." ,
        cult: { friendlySkills: ["Intimidate"], friendlyTalents: ["Combat Sense", "Never Die", "Pain Is an Illusion", "Hero", "Mind Killer"],
                hostileSkills: ["Inquiry"], hostileTalents: ["True Grit", "Crushing Blow", "Frenzy", "Deadeye Shot", "Sharpshooter", "Frontline Commander"],
                grantSkills: ["Forbidden Lore (Psykers)+10"], grantTalents: ["Resistance", "Trust Your Eyes", "Strong Minded"] } }),
      C("raptors", "Рапторы", {
        geneseed: "Как у Гвардии Ворона.",
        culture: "«Полевое Ремесло» — Awareness, Stealth, Survival и Deadeye Shot, Sharpshooter, Crack Shot, Mighty Shot дружественны; Charm, Commerce, Inquiry и Sure Strike, Precise Blow, Crippling Strike, Crushing Blow враждебны. Раз/сцену — переброс Survival. Good.Q Хамелеолиновый Плащ и Тепловые Банки для брони как старт.",
        curse: "«Пепельная Слепота» — как у Гвардии Ворона." ,
        cult: { friendlySkills: ["Awareness", "Stealth", "Survival"], friendlyTalents: ["Deadeye Shot", "Sharpshooter", "Crack Shot", "Mighty Shot"],
                hostileSkills: ["Charm", "Commerce", "Inquiry"], hostileTalents: ["Sure Strike", "Precise Blow", "Crippling Strike", "Crushing Blow"],
                grantSkills: [], grantTalents: [] } }),
      C("revilers", "Бранители", {
        geneseed: "Как у Гвардии Ворона.",
        culture: "«Клинки Ночи» — Stealth и Таланты Sure Strike, Precise Blow, Crippling Strike и Crushing Blow "
               + "дружественны; Charm и Таланты Deadeye Shot, Sharpshooter, Crack Shot и Mighty Shot враждебны. "
               + "Раз за сцену или бой — переброс теста Stealth или атаки из скрытности. Броски урона рукопашных "
               + "атак по застигнутым Врасплох целям делаются дважды с выбором лучшего.",
        curse: "«Пепельная Слепота» — как у Гвардии Ворона, но тест W+0 вместо W+10.",
        cult: { friendlySkills: ["Stealth"],
                friendlyTalents: ["Sure Strike", "Precise Blow", "Crippling Strike", "Crushing Blow"],
                hostileSkills: ["Charm"],
                hostileTalents: ["Deadeye Shot", "Sharpshooter", "Crack Shot", "Mighty Shot"],
                grantSkills: [], grantTalents: [] } }),
      C("carcharodons", "Кархародоны", {
        geneseed: "Оссмодула — все зубы заострённые и треугольные, непригодные для жевания, но дают Трейт Bite (2); "
                + "выбитые вырастают заново за 1d5 дней. Оккулоб — радужки и белки глаз чёрные. "
                + "Меланохром — кожа серая и грубая, волосы белые; 50% шанс (1-5 на 1d10) полного облысения после "
                + "имплантации; защиты от радиации не даёт. Мукраноид и Железа Бетчера — не работают.",
        culture: "«Красная Десятина» — Intimidate и Stealth и Таланты Flesh Render, Reaper, Cleave, Grind и "
               + "Whirlwind of Death дружественны; Charm и Inquiry и Таланты Combat Formation, Hunker Down, "
               + "Tenacity, Radiant Presence и Peer враждебны. Даёт Linguistics (High Gothic) и Таланты Cold Fury "
               + "и Frenzy, а также +10 на все атаки по целям под Запугиванием, Шоком, Паникой или Подавлением.",
        curse: "«Пепельная Слепота» — как у Гвардии Ворона, но тест W−10 вместо W+10. При перманентном проклятии "
             + "персонаж лишается способности говорить вслух (но может жестами или телепатически).",
        cult: { friendlySkills: ["Intimidate", "Stealth"],
                friendlyTalents: ["Flesh Render", "Reaper", "Cleave", "Grind", "Whirlwind of Death"],
                hostileSkills: ["Charm", "Inquiry"],
                hostileTalents: ["Combat Formation", "Hunker Down", "Tenacity", "Radiant Presence", "Peer"],
                grantSkills: ["Linguistics (High Gothic)"], grantTalents: ["Cold Fury", "Frenzy"] } })
    ] }),

  L("XX", "Альфа Легион", {
    geneseed: "Оссмодула — на 10–25% выше обычного десантника (Размер 1).",
    culture: "«Головы Гидры» — Command, Deceive и Paranoia, Bodyguard, Disarm, Takedown, On This Mark, Target Selection, Iron Discipline, Bring It Down, Mimic, Neural Triggers дружественны; группа «Берсерк» враждебна. Deceive, Linguistics (Battle Cant), Combat Formation, Double Team.",
    curse: "Нет проклятья. Банды Альфа-Легиона следуют общей доктрине легиона." })
];

export function getLegion(id) { return LEGIONS.find(l => l.id === id) || null; }
export function getChapter(legionId, chapterId) {
  const lg = getLegion(legionId);
  return lg ? (lg.chapters.find(c => c.id === chapterId) || null) : null;
}
export function buildLegionOptions(selectedId) {
  let html = `<option value="">— не выбран —</option>`;
  for (const l of LEGIONS) {
    const sel = l.id === selectedId ? " selected" : "";
    html += `<option value="${l.id}"${sel}>${l.num} — ${esc(l.name)}</option>`;
  }
  return html;
}
export function buildChapterOptions(legionId, selectedId) {
  const lg = getLegion(legionId);
  let html = `<option value="">— весь легион / своя банда —</option>`;
  if (lg) for (const c of lg.chapters) {
    const sel = c.id === selectedId ? " selected" : "";
    html += `<option value="${c.id}"${sel}>${esc(c.name)}</option>`;
  }
  return html;
}

// Опции «Культура» — тот же список, но с пунктом «как у геносемени» по умолчанию.
// Культура может быть из ЛЮБОГО легиона/банды: геносемя ты сохраняешь, а культуру
// перенимаешь у нового легиона (напр. Повелитель Ночи в Чёрном Легионе). Стр. 489-506.
export function buildCultureLegionOptions(selectedId) {
  let html = `<option value="">— как у геносемени —</option>`;
  for (const l of LEGIONS) {
    const sel = l.id === selectedId ? " selected" : "";
    html += `<option value="${l.id}"${sel}>${l.num} — ${esc(l.name)}</option>`;
  }
  return html;
}

// Возвращает {name, culture} для выбранной культуры (легион+банда), или null.
export function resolveCulture(legionId, chapterId) {
  const lg = getLegion(legionId);
  if (!lg) return null;
  const ch = chapterId ? (lg.chapters.find(c => c.id === chapterId) || null) : null;
  const culture = ch && ch.culture ? ch.culture : lg.culture;
  const name = ch ? `${lg.num} ${ch.name}` : `${lg.num} ${lg.name}`;
  return { name, culture };
}

// ════════════════════ МАШИННАЯ КУЛЬТУРА ЛЕГИОНОВ ════════════════════════════
// Культура делает часть Навыков и Талантов дружественными или враждебными
// «независимо от Покровительства» — то есть в обход обычного подсчёта
// склонностей. Здесь это машинные списки, чтобы движок опыта считал цену сам.
const CULT = {
  I:    { fS:["Deceive","Scrutiny"], hS:["Charm"] },
  III:  { fT:["Mastery"], gS:["Linguistics (Chemosan)"] },
  IV:   { fS:["Logic","Tech-Use"],
          fT:["Combat Formation","Paranoia","Litany of Cleaning","Field Execution","Iron Discipline","Duty Above All","Cannon Fodder"],
          hS:["Charm","Inquiry"], hT:["Double Team","Radiant Presence","Beloved Leader","Peer"],
          gS:["Linguistics (Olympian)"], gT:["Hatred (Imperial Fists)","Hunker Down","Mind Killer"] },
  V:    { fS:["Operate"], fT:["Leap Up","Preternatural Speed","Sprint","Dragoon","Skilled Rider"],
          hS:["Logic","Security"], hT:["Paranoia","Scanning Advance","Hunker Down","Tenacity","Sniper Assassin","Trot"],
          gS:["Linguistics (Khorchin)","Survival"], gT:["Lightning Reflexes","Saddle Jump"] },
  VI:   { fS:["Survival"], fT:["Final Push","Tireless","Everything a Weapon","Slam","Wrestler","Clobber","Decadence"],
          hS:["Operate (Aeronautica)","Scholastic Lore"],
          hT:["Combat Formation","Armour-Monger","Pain Is an Illusion","Raptor","On This Mark","Field Execution"],
          gS:["Linguistics (Fenrisian)","Survival"], gT:["Double Team","Steady Footwork"] },
  VII:  { fS:["Logic","Security"], fT:["Sentry","Die Hard","Iron Jaw","Final Push","Tireless","True Grit","Bolter Drill"],
          hS:["Deceive","Stealth"], hT:["Rapid Reaction","Preternatural Speed","Reaper","Cannon Fodder"],
          gS:["Trade (Mason)"], gT:["Hatred (Iron Warriors)","Hunker Down","Mind Killer"] },
  VIII: { fS:["Interrogate","Intimidate","Stealth"], hT:["группа:Смелость"] },
  IX:   { fS:["Operate (Aeronautica)"], gT:["Frenzy","Battle Rage"] },
  X:    { fS:["Tech-Use"] },
  XII:  { gT:["Frenzy","Fire in Blood"] },
  XIII: { gS:["Common Lore (War)+10","Scholastic Lore (Tactica Imperialis)+10","Forbidden Lore (Codex Astartes)+10","Linguistics (High Gothic)"] },
  XIV:  { gT:["Sound Constitution","Sound Constitution","Sound Constitution","Sound Constitution"] },
  XV:   { gT:["Psy Rating"] },
  XVI:  { gS:["Common Lore (War)+10","Scholastic Lore (Heraldry)+10"] },
  XVII: { gS:["Common Lore (Chaos)+20","Forbidden Lore (Daemons)+10","Forbidden Lore (Heresy)+10","Forbidden Lore (Warp)",
              "Linguistics (Chaos Glyphs)","Linguistics (True Tongue)"] },
  XVIII:{ fT:["группа:Огнемётчик"], hT:["группа:Скорость"],
          gS:["Linguistics (Nocturnal)","Trade (Armourer)+10","Trade (Weaponsmith)+10"], gT:["Hatred (Eldar)"] },
  XIX:  { fS:["Stealth","Acrobatics"],
          fT:["Lightning Reflexes","Leap Up","Reposition","Catfall","Step Aside","Assassin Strike","Savage"],
          hS:["Charm","Inquiry"],
          hT:["Iron Jaw","Armour-Monger","Hunker Down","Tireless","True Grit","Frenzy","Fearless"],
          gS:["Stealth"], gT:["Rapid Reaction","Double Team"] },
  XX:   { fS:["Command","Deceive"],
          fT:["Paranoia","Bodyguard","Disarm","Takedown","On This Mark","Target Selection","Iron Discipline","Bring It Down","Mimic","Neural Triggers"],
          hT:["группа:Берсерк"], gS:["Deceive","Linguistics (Battle Cant)"], gT:["Combat Formation","Double Team"] }
};
for (const lg of LEGIONS) {
  const c = CULT[lg.num];
  if (!c) continue;
  lg.cult = { friendlySkills: c.fS || [], friendlyTalents: c.fT || [],
              hostileSkills:  c.hS || [], hostileTalents:  c.hT || [],
              grantSkills:    c.gS || [], grantTalents:    c.gT || [] };
}

/**
 * Машинная культура персонажа: берём культуру ордена, если она есть, иначе
 * легиона. Учитывает, что культура может быть от ДРУГОГО легиона, чем геносемя.
 */
export function resolveCultureFx(cultureLegionId, cultureChapterId) {
  const lg = getLegion(cultureLegionId);
  if (!lg) return null;
  const ch = cultureChapterId ? (lg.chapters.find(c => c.id === cultureChapterId) || null) : null;
  return (ch && ch.cult) ? ch.cult : (lg.cult || null);
}

/**
 * Переопределяет категорию склонности по культуре: "ally" / "enemy" / null.
 * kind — "skill" | "talent". name — имя из библиотеки (сверяем по подстроке,
 * чтобы «Hatred (Imperial Fists)» ловился и как «Hatred»).
 */
export function cultureCat(kind, name, group, fx) {
  if (!fx || !name) return null;
  const n = String(name).toLowerCase();
  const g = String(group || "").toLowerCase();
  const hit = (list) => (list || []).some(e => {
    const s = String(e).toLowerCase();
    if (s.startsWith("группа:")) {
      // «группа:Имя!Исключение1,Исключение2» — вся группа, КРОМЕ перечисленного
      // (в книге так у Повелителей Железа: «Берсерк, кроме Cold Fury и Battle Rage»).
      const [grp, exc] = s.slice(7).split("!");
      if (g !== grp.trim()) return false;
      if (!exc) return true;
      return !exc.split(",").some(x => n.includes(x.trim()));
    }
    return n.includes(s);
  });
  const fr = kind === "skill" ? fx.friendlySkills : fx.friendlyTalents;
  const ho = kind === "skill" ? fx.hostileSkills  : fx.hostileTalents;
  if (hit(ho)) return "enemy";   // враждебность важнее: она явный штраф
  if (hit(fr)) return "ally";
  return null;
}
