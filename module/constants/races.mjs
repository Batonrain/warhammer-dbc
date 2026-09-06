// module/constants/races.mjs
//
// Данные рас для Мастера создания. chars — базовые характеристики; bonusRolls/
// bonusPoints/charShift — для распределения при создании (справочно). traits —
// расовые Черты (создаются как предметы с авто-эффектами). talents/skills/gear —
// пока строки/имена (заглушки; таланты и снаряжение прописываем позже).
// rules — машинная часть Черт (module/rules/library/, docs/rules-format.md).

import { ASTARTES_RULES } from "../rules/library/astartes.mjs";
import { OGRYN_RULES }    from "../rules/library/ogryn.mjs";

export const RACES = {
  human: {
    label: "Человек",
    subraces: ["mutant","stunted","afriel","inheritor","pariah","discordant","navigator"],
    chars: { ws:25, bs:25, s:25, t:25, ag:25, int:25, per:25, wp:25, fel:25, inf:19 },
    bonusRolls: 2, bonusPoints: 11, charShift: 2,
    size: 0,
    skills:  "Common Lore (любые 4), Linguistics (Low Gothic), Trade (любое 1)",
    gear:    "5 элементов Снаряжения/Инструментов до R1 (2 Good.Q, 1 Best.Q), Vox-Bead",
    talents: [],
    traits: [
      { name: "The Quick and The Dead / Быстрые и Мёртвые",
        benefit: "+2 к Инициативе; может Избегать атак Орды и атак «Троек» под 2-м эффектом Командного Присутствия. При Размере 2+ Трейт теряет все эффекты, кроме +2 к Инициативе." },
      { name: "Fast Learner / Ловит на Лету",
        benefit: "+25% к стартовому опыту и опыту за сессию (ГМ округляет вверх)." }
    ],
    archetypes: ["Все Архетипы Людей"],
    desc: "Один из несчётных квадриллионов Человечества, способный сражаться наравне с чемпионами Губительных Сил."
  },

  astartes: {
    label: "Астартес",
    subraces: [],
    chars: { ws:30, bs:30, s:30, t:30, ag:30, int:30, per:30, wp:30, fel:30, inf:19 },
    bonusRolls: 2, bonusPoints: 7, charShift: 0,
    size: 1,
    hasGeneSeed: true,
    skills:  "Athletics, Awareness, Common Lore (War, любое 1), Dodge, Forbidden Lore (Astartes, Horus Heresy and Long War), Linguistics (Low Gothic), Linguistics (Battle Cant или High Gothic), Navigate (Surface), Operate (Surface), Parry",
    gear:    "Power Armour Mk III-VII, 4 Стандартные системы, Болтер (Астартес) или Болт Пистолет (Астартес), Боевой Нож Астартес",
    talents: [
      "Ambidextrous", "Bulging Biceps", "Legion Weapon Training",
      "Heightened Senses (Hearing, Sight)", "Jaded", "Nerves of Steel",
      "Quick Draw", "Resistance (Cold, Heat, Poisons)", "Unarmed Warrior"
    ],
    // Расовые Черты с авто-эффектами (создаются на акторе при применении расы)
    traits: [
      { name: "Amphibious / Амфибия", benefit: "Дышит под водой; перебрасывает Плавание.", effects: {} },
      { name: "Nimble / Проворный", benefit: "Атакующим по нему −Ag.b к попаданию.", rating: 10, hasRating: true, effects: {} },
      { name: "Size (1) / Размер (1)", benefit: "Размер +1 к SPD.", rating: 1, hasRating: true, effects: { sizeMod: 1 } },
      { name: "Unnatural Strength (4) / Сверхъестественная Сила (4)", benefit: "+4 к Бонусу Силы.", rating: 4, hasRating: true, effects: { charBonusStat: "s", charBonusValue: 4 } },
      { name: "Unnatural Toughness (4) / Сверхъестественная Стойкость (4)", benefit: "+4 к Бонусу Стойкости.", rating: 4, hasRating: true, effects: { charBonusStat: "t", charBonusValue: 4 } },
      { name: "Gene-Seed / Геносемя", benefit: "Открывает все преимущества имплантов Геносемени (см. гайд на вкладке ТЕЛО).", effects: {} }
    ],
    // Машинная часть Черт — module/rules/library/astartes.mjs.
    rules: ASTARTES_RULES,
    archetypes: ["Все Архетипы Космодесантников"],
    desc: "Космодесантник Хаоса — генетически улучшенный воин, намного превосходящий смертных."
  },

  azuriane: {
    label: "Азуриане",
    subraces: ["eldanar"],
    chars: { ws:30, bs:30, s:25, t:25, ag:35, int:35, per:35, wp:30, fel:30 },
    bonusRolls: 2, bonusPoints: 7, charShift: 1,
    traits: [
      { name: "Nimble / Проворный", benefit: "Атакующим по нему −A.b к попаданию.", rating: 10, hasRating: true, effects: {} },
      { name: "Psyker / Псайкер", benefit: "PR 0. Древнее Мастерство (см. вкладку ПСИ). Отметьте «Пси-Пробуждение».", rating: 0, hasRating: true, effects: {} },
      { name: "Unnatural Agility (4) / Сверхъест. Ловкость (4)", benefit: "+4 к Бонусу Ловкости.", rating: 4, hasRating: true, effects: { charBonusStat: "ag", charBonusValue: 4 } },
      { name: "Unnatural Perception (4) / Сверхъест. Восприятие (4)", benefit: "+4 к Бонусу Восприятия.", rating: 4, hasRating: true, effects: { charBonusStat: "per", charBonusValue: 4 } },
      { name: "Craftworld Citizen / Житель Мира-Корабля",
        benefit: "Trade на 1 ступень дружественнее. Персонаж начинает с 2 Путями на уровне «Следующий».", effects: {} },
      { name: "Clear Mind / Чистый Разум",
        benefit: "При обучении Пути от более опытного: +30 к тесту I/Logic в конце и ×2 успехи. При обучении других: +60 к Trade(Instructor)(I) (÷2, если ученик не на том же Пути).", effects: {} },
      { name: "Eldarten / Эльдарское Тело",
        benefit: "Доп. Реакция; инициатива — 3 броска, лучший, +4 к Инициативе. Psyniscience с ½ штрафов (Mastery → трейт Warp Sight). Избегает атак Орды/«Троек» как одиночные, без бонус-кубов урона (теряется при Размере 2+). Чист в расчёте Порчи; при 50 Порчи начинается превращение в Коммората. Иммунитет к людским болезням; долгожитель; авто-обнаружение ядов по запаху. Людские стимуляторы = Poor.Q Смертельная Отрава. Слаанешитские «Скорость/Внимательность/Избегание» +1 дружественнее; Кхорнитские «Берсерк/Пугилист» +1 враждебнее.", effects: {} },
      { name: "Illiengau / Древний Рок",
        benefit: "−15 на Мораль/Шок/Командование против последователей Слаанеш; −15 на сопротивление одержимости и больше Порчи; демоны Слаанеш +30 пси-чутья против него; за 100 опыта и время вне игры — снять 1 Порчу; ветка «Смелость» всегда дружественна.", effects: {} },
      { name: "Non Imperial / Не Имперец",
        benefit: "Навыки Знаний об Империуме враждебны при покупке; до Forbidden Lore (Mon-Keigh)+0 все имперские знания стоят вдвое.", effects: {} },
      { name: "Speak Not Unto The Alien / С Чужаком Ты Не Заговори",
        benefit: "При общении с людьми считается мутантом: −20 на общение (взаимно). Другие мутанты относятся дружелюбнее.", effects: {} }
    ],
    skills: "Acrobatics+10, Awareness, Common Lore (любые 4), Dodge, Forbidden Lore (любые 2), Scholastic Lore (любые 2), Linguistics (LamEldannar)+10, Linguistics (Low Gothic), Scrutiny, Stealth, Trade (любые 2)",
    talents: ["Aim Focus, Catfall, Heightened Senses (любые 3), Jaded"],
    desc: "Аэльдари миров-кораблей (Асурьяни), идущие Путями (Ай'элетхра). Вместо Мировоззрения — Пути." },
  drukhari:  { label: "Друкхари", subraces: ["truebornDrukhari","mandrake","wrack"],
    chars: { ws:30, bs:30, s:25, t:25, ag:35, int:35, per:35, wp:20, fel:30 },
    bonusRolls: 2, bonusPoints: 7, charShift: 1,
    traits: [
      { name: "Dark Sight / Тёмное Зрение", benefit: "Видит в темноте без штрафов.", effects: {} },
      { name: "Nimble / Проворный", benefit: "Атакующим по нему −A.b к попаданию.", rating: 10, hasRating: true, effects: {} },
      { name: "Psyker / Псайкер", benefit: "PR 0, Связанный. Не может развивать дар без обучения у эльдарского варлока/провидца (см. «Тёмная Душа»). Парии действуют на него как на псайкера.", rating: 0, hasRating: true, effects: {} },
      { name: "Unnatural Agility (4) / Сверхъест. Ловкость (4)", benefit: "+4 к Бонусу Ловкости.", rating: 4, hasRating: true, effects: { charBonusStat: "ag", charBonusValue: 4 } },
      { name: "Unnatural Perception (4) / Сверхъест. Восприятие (4)", benefit: "+4 к Бонусу Восприятия.", rating: 4, hasRating: true, effects: { charBonusStat: "per", charBonusValue: 4 } },
      { name: "Reign Craving / Жажда Власти",
        benefit: "+10 на социальные тесты ради власти, свержения или предательства. Вдвое снижает штрафы соц. тестов, пока участвует в заговоре. За идеальную интригу/предательство в нужный момент — до +1d5 Inf.", effects: {} },
      { name: "Druchiiten / Друкхарийское Тело",
        benefit: "Доп. Реакция; +4 к Инициативе (3 броска, лучший); избегает атак Орды/«Троек» как одиночные (теряется при Размере 2+). Не получает мутаций и Безумия, но и нет прогрессирующей защиты от страха. Иммунитет к обычным болезням (есть свои); долгожитель; авто-обнаружение добавок в пище по запаху. Не страдает от боли (ощущает, но не страдает) и от пост-эффектов/штрафов наркотиков (зависимость получать может). Ощущает яркие эмоции жертв (авто-поиск). Людские стимуляторы = Poor.Q Смертельная Отрава. Слаанешитские «Скорость/Внимательность/Избегание» +1 дружественнее; Кхорнитские «Берсерк/Пугилист» +1 враждебнее.", effects: {} },
      { name: "Dorchacarrec / Тёмная Душа",
        benefit: "Взаимный +10 на Атаку и W с демонами Слаанеш. −20 на сопротивление одержимости и больше Cor. При Истончении Завесы −5×Уровень к ментальным тестам. Может питаться эмоциями (психическая «пища»; смерть жертвы от пыток = полноценный сон). Рейтинг Страха всех существ (кроме демонов) против него −1; сородичей-друкхари +1. При 20-кратной Порче — тест по 2 хар-кам, иначе Ментальное Расстройство. Ветка «Смелость» дружественна. Психодар пробуждается только обучением у варлока/провидца.", effects: {} },
      { name: "Through the Pain / Через Боль",
        benefit: "Может развивать Psyniscience как враждебный навык (видит лишь тяжелораненых/в страхе, радиус P м). За Реакцию впитывает страдания (крит. эффект боли/болезненная смерть в P.b м) — копит Очки Боли (макс. W.b; 1/раунд с цели). Очки Боли = Очки Бесчестья (Х×строку таблицы), работают в нуль-поле, кроме Усиления/доп.успехов/переброса Длительных. 1 очко/день вне Паутины — против Голодной Суки. Варп-урон/Выжигание Души сначала выжигает Боль (3 урона за 1 Боль). Сслиты/Астартес дают Боль, только если их T < P друкхари.", effects: {} },
      { name: "Godless / Безбожник",
        benefit: "Нет Очков Судьбы и Очков Бесчестья (нет Покровительства). Для талантов, требующих ОБ, тратит Очки Боли по уровню таланта. Смерть окончательна (см. «Цена Бессмертия»).", effects: {} },
      { name: "The Price of Immortality / Цена Бессмертия",
        benefit: "При гибели Гемункулы Кабала/Ковена/Культа возвращают друкхари из мёртвых: каждую главу −2d5 Inf за услуги. Невозможно при Выжигании Души, варп-оружии или поглощении души. Стартовый персонаж без субрасы может отказаться от Трейта ради +3d5 стартового Inf.", effects: {} },
      { name: "Non Imperial / Не Имперец",
        benefit: "Знания об Империуме всегда враждебны при покупке; имперские Common Lore считаются как Forbidden Lore; имперские науки изучаются вдвое сложнее.", effects: {} },
      { name: "Speak Not Unto The Alien / С Чужаком Ты Не Заговори",
        benefit: "При общении с людьми считается мутантом: −20 на общение (взаимно). Другие мутанты относятся дружелюбнее.", effects: {} }
    ],
    skills: "Acrobatics+10, Athletics, Awareness, Common Lore (Druchii), Common Lore (любые 2), Dodge, Deceive, Inquiry, Linguistics (LamEldannar Druchii), Linguistics (Low Gothic), Stealth, Survival, Scrutiny, Scholastic Lore (любое 1), Intimidate",
    talents: ["Catfall, Decadence, Heightened Senses (любые 3), Light Sleeper, Resistance (Poisons), Jaded, Melee Training (любые 3), Weapon Training (любые 4)"],
    gear: "5 элементов Снаряжения и Инструментов до R1; стрелковое оружие до R1; Hekatrix Blade; Xenomesh Armour (Good.Q) или Kabalite Armour, или Wychsuit",
    archetypes: ["freeShooter", "assassin", "forsaken", "duelist", "pitFighter", "alchemist", "kabalite"],
    desc: "Тёмные аэльдари Комморры (Недорождённые); питаются чужой болью, копят Очки Боли. Субрасы: Истиннорождённый, Мандрагора, Развалина." },
  ynnari:    { label: "Иннари",     subraces: [],
    // Иннари выбирают «Прошлое» (бывшую расу) и получают её бонусы + эти Черты.
    pastRaces: ["azuriane", "drukhari", "harlequin", "exodite"],
    traits: [
      { name: "The Reborn / Перерождённые",
        benefit: "Может использовать архетипы и элитные архетипы любых эльдар. Нет штрафов от Illiengau и Dorchacarrec. Автоуспех на тесты против Страха, Шока, Подавления, пыток и запугивания. При смерти без камня душ душу забирает Иннеад (даже при наличии душеловки); выжигание/пожирание души всё равно убивает навеки. Каждый день теряет 1 Cor (мин. 30); не получает Cor из внешних источников (кроме Царства Хаоса/сильного сосредоточения сил Хаоса). Может ощущать и общаться с психокостяными конструктами, имеющими души. Удерживая Камень Душ — общается с ним, временно получая его навыки/таланты (модификацией R2 Камень Душ ставится в броню для постоянного эффекта).", effects: {} },
      { name: "Power of Souls / Сила Душ",
        benefit: "Когда Иннари кого-либо убивает или кто-то умирает в радиусе 10 м — тест W+20, при успехе +1 Мёртвое Могущество (макс. W.b×3). Мёртвое Могущество тратится как Очки Бесчестья в расчёте «Х×строку таблицы» (эффект Cor=0 — 1 ММ, Cor=20 — 2 ММ и т.д.). Мистическая природа — давится нуль-полями; позволяет любому эльдар пользоваться механикой Очков Бесчестья.", effects: {} }
    ],
    desc: "Последователи Иннеада; выбирают Прошлое (бывшую расу) и копят Мёртвое Могущество (макс. W.b×3)." },
  halfEldar: { label: "Полуэльдар", subraces: ["grayman"],
    desc: "Полукровки людей и аэльдари." },
  harlequin: { label: "Арлекин",    subraces: [],
    // Арлекин выбирает «Прошлое» (изначальную расу) и получает её бонусы + эти Черты.
    pastRaces: ["azuriane", "drukhari", "exodite"],
    traits: [
      { name: "Дары Цегораха / Базовые Черты Арлекина",
        benefit: "From Beyond. Natural Weapons (A.b, Кулаки; Proven 3, Extreme 8). Nimble (+10). Soul-Bound (Цегорах, защита Чёрной Библиотеки). Unnatural WS (+4), Unnatural BS (+4), Unnatural W (+4), Unnatural Init (+6; при равной инициативе ходит первым), Unnatural A (8/+4), Unnatural P (8/+4), Unnatural Senses (A.b×5). Сохраняет трейты прошлых архетипов. Автопроходит любые тесты против Страха (даже сверхъестественного). Теряет штрафы Illiengau (Эльдар) и Dorchacarrec (Друкхари), но сохраняет бонусы. Им труднее манипулировать; угрозы расе/камням душ/поглощению Хаосом не действуют — душа всегда возвращается к Цегораху.", effects: {} },
      { name: "Acrobatic Mastery / Акробатическое Мастерство",
        benefit: "Полудвижение SPD×2, Полное SPD×4, Натиск SPD×8, Бег SPD×14 (со Sprint — удвоение самого Бега, SPD×28). +2 Реакции. Неограниченное число атак и контратак за ход (пока есть ОД/Реакции). Trade(Dancer)(A) вместо BS для метательного (вкл. гранаты) и вместо WS для Финтов/Давления. +Unnatural A успехов к успешным тестам Acrobatics, +2 успеха к проваленным. Перебрасывает Acrobatics/Stealth/Sleight of Hand. Может делать Быструю/Молниеносную атаку с каждой руки. Избирательные атаки: первые ½ A.b (▲) попаданий — в выбранную часть. Улучшенный уворот: тратя 2 Реакции — авто-успех уворота/парирования с A.b/WS.b успехами; накапливает успехи уворота. Эльдарские пистолеты получают Eldar Accurate/Eldar Precise. При экстрем. уроне может потратить до 5 Очков Судьбы, +4 за каждое. Синхронизация инициативы и обзора с союзниками-арлекинами в радиусе W/F м. Повторное прицеливание Свободным действием, пока атаки наносят непоглощённый урон; +2 Dmg (до +10) по той же цели после попадания.", effects: {} },
      { name: "Distorted Body / Искажённое Тело",
        benefit: "Не нуждается в еде, воде, сне; иммунитет к обычным и сверхъестественным болезням; не страдает от погодного жара/холода (но не от огнемёта/крио-оружия). Автоуспех против наркотиков; +5×W.b и переброс против ядов и химикатов. Иммунитет к укачиванию/дезориентации от скорости и падения; +30 и переброс против Concussive. Лечится как космодесантник; бросает d20 на тестах Кровотечения. +1d3 к максимуму Очков Судьбы.", effects: {} },
      { name: "Untouchable / Неприкосновенные",
        benefit: "Иммунитет к ритуалам, феноменам и прорывам. Душу нельзя схватить, удержать или выжечь — её спасает Цегорах. Игнорирует Fear демонов/демонических сущностей, силовые щиты демонов и их трейты/свойства (Dreaming, Bane, Challenge и т.п.). Не может быть одержим.", effects: {} },
      { name: "Will of Cegorach / Воля Цегораха",
        benefit: "Талант Bastion of Iron Will; может использовать W.b вместо PR. Игнорирует иммунитет к психосилам от трейта From Beyond. Игнорирует Тень в Варпе Тиранид и противостоит воле Улья. Теряет весь Cor и не может его получать; не может быть сломлен или встать на сторону Хаоса. Доступен талант «Выступление».", effects: {} },
      { name: "Myriad Masks / Мириада Масок",
        benefit: "Выберите ОДНУ маску (меняется раз в месяц с согласия Мастера Труппы/Цегораха): Маска Света — +3 к SPD и Инициативе; при Быстрой/Молниеносной атаке всегда +1 попадание к успешным атакам (сверх лимита). Маска Сумерек — Реакцией тест W+10 против вражеской атаки в радиусе A.b м: при успехе перемещается к врагу и может перенаправить атаку (ещё одна Реакция на «парирование»). Маска Ночи — впервые получая экстрем. урон/крит. эффект, полностью игнорирует и передаёт источнику (крит. эффект — вдвое, ▲); +1 итог. урона за каждый экстрем./крит по цели, которой нанёс экстрем. урон (спадает в конце боя).", effects: {} }
    ],
    // Навыков своих нет: всё приходит от Прошлого (изначальной расы) и архетипа.
    // Держать это в `skills` нельзя — строка описательная, парсер выдачи её не
    // понимает и раньше ругался на неё как на нераспознанный навык.
    skillsNote: "Эльдарские/друкхарийские навыки и таланты — по выбору архетипа и Прошлого.",
    desc: "Слуги Смеющегося Бога (Цегораха). Выбирают Прошлое (изначальную расу: Азуриане/Друкхари/Экзодит) и получают её бонусы + Черты Арлекина." },
  exodite:   { label: "Экзодит",    subraces: [],
    desc: "Аэльдари миров-дев, живущие в гармонии с природой." },
  sslyth: {
    label: "Сслиты", subraces: [],
    chars: { ws:30, bs:30, s:30, t:35, ag:30, int:25, per:30, wp:25, fel:20 },
    bonusRolls: 2, bonusPoints: 10, charShift: 1,
    fateRoll: "1d10: 1-5 → 1, 6-10 → 2",
    skills: "Athletics+10, Awareness, Common Lore (Druchii), Common Lore (любое 1), " +
            "Forbidden Lore (Pirates), Forbidden Lore (любое 1), Dodge, Deceive, " +
            "Linguistics (LamEldannar Druchii), Linguistics (Low Gothic), Stealth, Scrutiny, Survival",
    talents: ["Ambidextrous, Bulging Biceps, Disturbing Voice, Fearless, Snake Eater, " +
              "Heightened Senses (любые 2), Resistance (Poisons), Two Weapon Wielder (All), Unarmed Warrior"],
    gear: "4 элемента Снаряжения и Инструментов до R1; Splinter Rifle (Best.Q) или Shardcarabine (Good.Q); " +
          "3 Splinter Pistol; Monomolecular Blade; Kabalite Armour",
    archetypes: ["freeShooter", "duelist", "assassin", "forsaken", "pitFighter"],
    traits: [
      { name: "Auto-Stabilized / Автостабилизация", benefit: "Нет штрафа за стрельбу на ходу.", effects: {} },
      { name: "Bite (4) / Укус (4)", benefit: "Естественное оружие; урон 1d10+T.b цели вместо 1d5.", rating: 4, hasRating: true, effects: {} },
      { name: "Crawler / Ползун", benefit: "Змеиное тело: движение не сковано обычными препятствиями.", effects: {} },
      { name: "Dark Sight / Тёмное Зрение", benefit: "Видит в темноте без штрафов.", effects: {} },
      { name: "Multiple Arms (4) / Множество Рук (4)", benefit: "Четыре руки; все считаются основными, штрафов за множество рук нет.", rating: 4, hasRating: true, effects: {} },
      { name: "Natural Armour (3) / Природная Броня (3)", benefit: "AP 3 по всем локациям.", rating: 3, hasRating: true, effects: { naturalArmour: 3 } },
      { name: "Nimble (10) / Проворный (10)", benefit: "Атакующим по нему −A.b к попаданию.", rating: 10, hasRating: true, effects: {} },
      { name: "Size (1) / Размер (1)", benefit: "Размер +1 к SPD.", rating: 1, hasRating: true, effects: { sizeMod: 1 } },
      { name: "Sturdy / Кряжистый", benefit: "Устойчив к сбиванию с ног и отбрасыванию.", effects: {} },
      { name: "Toxic (3) / Токсичный (3)", benefit: "Естественные атаки ядовиты.", rating: 3, hasRating: true, effects: {} },
      { name: "Unnatural Strength (4) / Сверхъест. Сила (4)", benefit: "+4 к Бонусу Силы.", rating: 4, hasRating: true, effects: { charBonusStat: "s", charBonusValue: 4 } },
      { name: "Unnatural Toughness (4) / Сверхъест. Стойкость (4)", benefit: "+4 к Бонусу Стойкости.", rating: 4, hasRating: true, effects: { charBonusStat: "t", charBonusValue: 4 } },
      { name: "Sslyth Physiology / Физиология Сслита",
        benefit: "Иммунитет к ядам, пост-эффектам и зависимости от наркотиков. +15 к максимуму Ран; лечится как Космодесантник и дополнительно +1 Рана в сутки; кровотечение затягивает тестом T+0 в начале Хода. +4 к Инициативе; избегает атак Орды и «Троек» как одиночные (теряется при Размере 2+). Хвост считается парой рук с Unnatural S (6) и +30 к Athletics для Захвата и Борьбы, освобождая руки. Unnatural Senses (60) на кровь: авто-поиск раненых, различает запахи. Может отключать боль — физические пытки бесполезны. +20 против психосил на разум, +40 против иных воздействий (гипно-индоктринация); W.b перебросов в день против тестов на сознание; иммунен к подавителям воли. Холод: тест T+0 каждый час или 1 усталость; на 4-й — анабиоз (Medicae(I)−40, чтобы отличить от смерти).",
        effects: {} },
      { name: "Mercenary Loyalty / Наёмничья Верность",
        benefit: "Не предаёт нанимателя. Наниматель или уважаемый персонаж получает +30 на Командование Сслитом; сам Сслит — −30 на сопротивление их приказам и −10 на командование не-Сслитами.",
        effects: {} },
      { name: "Non Imperial / Не Имперец",
        benefit: "Все знания об Империуме постоянно враждебны при покупке; имперские Common Lore считаются как Forbidden Lore; чисто имперские науки изучаются вдвое дольше.",
        effects: {} },
      { name: "Speak Not Unto The Alien / С Чужаком Ты Не Заговори",
        benefit: "−20 на общение с людьми и людей с ним: его считают мутантом или ксеносом. Прочие мутанты относятся дружелюбнее черни.",
        effects: {} }
    ],
    desc: "Змееподобные наёмники Комморага: четыре руки, прочная шкура, сила и стойкость уровня Астартес. Невосприимчивы к боли, слабы к холоду." },

  ogryn: {
    label: "Огрин",
    rules: OGRYN_RULES,
    subraces: [],
    chars: { ws:25, bs:25, s:25, t:25, ag:25, int:25, per:25, wp:25, fel:25, inf:19 },
    bonusRolls: 1, bonusPoints: 4, charShift: 1,
    size: 1,
    largeBase: true, // Крупная База 3×3 (wdbc-8k0i) — не путать с `size` (бонус к SPD).
    skills:  "Athletics, Linguistics (Low Gothic)",
    gear:    "3 элемента Снаряжения/Инструментов до R1 (1 Good.Q); снаряжение бесплатно модифицируется под размер Огрина",
    talents: ["Bulging Biceps", "Hardy", "Iron Jaw", "Resistance (Cold, Heat)", "Unarmed Warrior"],
    traits: [
      { name: "Fanatic / Фанатик", benefit: "Может перехватить атаку по союзнику." },
      { name: "Size (1) / Размер (1)", benefit: "Размер +1 к SPD.", rating:1, hasRating:true, effects:{ sizeMod:1 } },
      { name: "Unnatural Strength (6) / Сверхъестественная Сила (6)", benefit:"+6 к Бонусу Силы.", rating:6, hasRating:true, effects:{ charBonusStat:"s", charBonusValue:6 } },
      { name: "Unnatural Toughness (6) / Сверхъестественная Стойкость (6)", benefit:"+6 к Бонусу Стойкости.", rating:6, hasRating:true, effects:{ charBonusStat:"t", charBonusValue:6 } },
      { name: "Brute Physiology / Физиология Громилы", benefit:"+15 к максимуму Ран; пассивное восстановление; −10 на оружие без свойства Ogrynized; −20 на стрелковое оружие." },
      { name: "Clever Hands / Умные Руки", benefit:"+15 к тонкой работе (Craft, ремонт)." },
      { name: "Hard as Stone / Крепкий как Камень", benefit:"Сопротивление эффектам против разума; +30 vs Страх/паника при концентрации." },
      { name: "BONE-Head / Костеголов", benefit:"Мозговые импланты: Int не выше человеческого; интенсивность импланта 3+ — повышение Int." }
    ],
    archetypes: ["Ренегат", "Пират", "Дикарь"],
    desc: "Могучий, но недалёкий нижний абхуман, возвышенный вниманием Тёмных Богов."
  },

  ratling: {
    label: "Ратлинг",
    subraces: [],
    chars: { ws:25, bs:25, s:25, t:25, ag:25, int:25, per:25, wp:25, fel:25, inf:19 },
    bonusRolls: 1, bonusPoints: 4, charShift: 1,
    size: -1,
    skills:  "Common Lore (любые 2), Linguistics (Low Gothic), Sleight of Hand +10, Stealth +10, Trade (Cook + любое 1)",
    gear:    "5 элементов до R1 (2 Good.Q, 1 Best.Q), Vox-Bead",
    talents: ["Combat Sense", "Heightened Senses (Sight, Smell, Taste)"],
    traits: [
      { name: "Size (-1) / Размер (-1)", benefit:"Размер −1 к SPD.", rating:-1, hasRating:true, effects:{ sizeMod:-1 } },
      { name: "Unnatural Ballistic Skill (2) / Сверхъестественный BS (2)", benefit:"+2 к Бонусу BS.", rating:2, hasRating:true, effects:{ charBonusStat:"bs", charBonusValue:2 } },
      { name: "Unnatural Perception (2) / Сверхъестественное Восприятие (2)", benefit:"+2 к Бонусу Per.", rating:2, hasRating:true, effects:{ charBonusStat:"per", charBonusValue:2 } },
      { name: "The Quick and The Dead / Быстрые и Мёртвые", benefit:"+2 к Инициативе; Избегание атак Орды." },
      { name: "Fast Learner (15) / Ловит на Лету (15)", benefit:"+15% к стартовому опыту и опыту за сессию.", rating:15, hasRating:true },
      { name: "Barefoot / Босоногий", benefit:"Кожа на ногах прочнее: бонус +20 и перебросы Stealth для бесшумного передвижения." },
      { name: "Runt / Коротышка", benefit:"−4 к максимуму Ран; свойство Compact нивелирует штрафы за маленькое оружие." }
    ],
    archetypes: ["Отступник", "Ересиарх", "Ренегат", "Пират", "Дикарь", "Ведьма", "Нумен"],
    desc: "Маленький, но зоркий и ловкий абхуман — идеальный разведчик и снайпер."
  },

  squat: {
    label: "Скват",
    subraces: [],
    chars: { ws:25, bs:25, s:25, t:25, ag:25, int:25, per:25, wp:25, fel:25, inf:19 },
    bonusRolls: 1, bonusPoints: 4, charShift: 1,
    size: 0,
    skills:  "Common Lore (любые 2), Linguistics (Low Gothic), Tech-Use, Trade (любые 2) +10",
    gear:    "5 элементов до R1 (3 Good.Q, 2 Best.Q), Vox-Bead, +2 очка стартового снаряжения",
    talents: ["Hunker Down", "Tireless", "Workaholic"],
    traits: [
      { name: "Blunted (1) / Затупленный (1)", benefit:"Защита от психо-атак на основе Варпа.", rating:1, hasRating:true },
      { name: "Sturdy / Надёжный", benefit:"+20 vs Захват/Оглушение, +30 vs сбивание/отбрасывание." },
      { name: "Unnatural Strength (2) / Сверхъестественная Сила (2)", benefit:"+2 к Бонусу Силы.", rating:2, hasRating:true, effects:{ charBonusStat:"s", charBonusValue:2 } },
      { name: "Unnatural Toughness (4) / Сверхъестественная Стойкость (4)", benefit:"+4 к Бонусу Стойкости.", rating:4, hasRating:true, effects:{ charBonusStat:"t", charBonusValue:4 } },
      { name: "Fast Learner / Ловит на Лету", benefit:"+10% к стартовому опыту и опыту за сессию." },
      { name: "Clever Hands / Умные Руки", benefit:"+15 к тонкой работе (Craft, ремонт)." },
      { name: "Hard as Stone / Крепкий как Камень", benefit:"Сопротивление эффектам против разума при концентрации." },
      { name: "Sure Tread / Надёжная Поступь", benefit:"+1 SPD пешком; не сбивается с ног; устойчивость в невесомости/нестабильном грунте." }
    ],
    archetypes: ["Отступник", "Ересиарх", "Ренегат", "Пират", "Дикарь", "Благородный", "Ведьма"],
    desc: "Коренастый абхуман-инженер, крепкий к Порче, но порой поддающийся соблазнам Хаоса."
  },

  beastman: {
    label: "Зверолюд",
    subraces: ["slaangor","pestigor","khorngor","tzaangor"],
    chars: { ws:25, bs:25, s:25, t:25, ag:25, int:25, per:25, wp:25, fel:25, inf:19 },
    bonusRolls: 1, bonusPoints: 5, charShift: 2,
    size: 0,
    skills:  "Common Lore (любые 2), Linguistics (Low Gothic), Survival",
    gear:    "4 элемента Снаряжения/Инструментов до R1 (1 Good.Q)",
    talents: ["Heightened Senses (Hearing, Smell)", "Unarmed Warrior"],
    traits: [
      { name: "Bite (1) / Укус (1)", benefit:"Естественная атака укусом (профиль).", rating:1, hasRating:true },
      { name: "Digitigrade (1) / Двусоставный (1)", benefit:"+1 к SPD; +5 на группирование.", rating:1, hasRating:true },
      { name: "Natural Weapons (1) / Естественное Оружие (1)", benefit:"Рога/Когти/Копыта как оружие (профиль).", rating:1, hasRating:true },
      { name: "Unnatural Strength (1) / Сверхъестественная Сила (1)", benefit:"+1 к Бонусу Силы.", rating:1, hasRating:true, effects:{ charBonusStat:"s", charBonusValue:1 } },
      { name: "Unnatural Toughness (1) / Сверхъестественная Стойкость (1)", benefit:"+1 к Бонусу Стойкости.", rating:1, hasRating:true, effects:{ charBonusStat:"t", charBonusValue:1 } },
      { name: "The Quick and The Dead / Быстрые и Мёртвые", benefit:"+2 к Инициативе; Избегание атак Орды." },
      { name: "Fast Learner (20) / Ловит на Лету (20)", benefit:"+20% к стартовому опыту и опыту за сессию.", rating:20, hasRating:true },
      { name: "Aversion to Order / Отвращение к Порядку", benefit:"Таланты Lore и Trade враждебны; бонусы предыдущих Бронфинов/Талантов Combat Formation теряются при переходе." },
      { name: "Cloven One / Раздвоенный", benefit:"Двусоставные ноги: +20 на тесты Трудного Ландшафта." },
      { name: "Stepchildren of the Gods / Пасынки Богов", benefit:"+10 на тесты против заинтересованных богов Хаоса; −1 к минимуму Бесчестья 1; не мутирует от Хаоса как человек." }
    ],
    archetypes: ["Отступник", "Ересиарх", "Ренегат", "Пират", "Дикарь", "Ведьма"],
    desc: "Звероподобный мутант человека: примитивный, но воинственный и агрессивный."
  },
  harpy: {
    label: "Гарпия",
    subraces: [],
    chars: { ws:25, bs:25, s:25, t:25, ag:25, int:25, per:25, wp:25, fel:25, inf:19 },
    bonusRolls: 2, bonusPoints: 7, charShift: 2,
    size: 0,
    skills:  "Common Lore (любые 2), Linguistics (Low Gothic), Operate (Aeronautica) +10, Trade (любое 1)",
    gear:    "4 элемента до R1 (1 Good.Q, 1 Best.Q)",
    talents: ["Flying Kick", "Pirouette", "Raptor"],
    traits: [
      { name:"Deadly Natural Weapons / Смертельное Естественное Оружие", benefit:"Когти на руках и ногах (2, профиль) теряют Primitive." },
      { name:"Flyer / Летун (Ag.b×2)", benefit:"Полёт со скоростью Ag.b×2.", rating:2, hasRating:true },
      { name:"Unnatural Agility (3) / Сверхъестественная Ловкость (3)", benefit:"+3 к Бонусу Ловкости.", rating:3, hasRating:true, effects:{ charBonusStat:"ag", charBonusValue:3 } },
      { name:"The Quick and The Dead / Быстрые и Мёртвые", benefit:"+2 к Инициативе; Избегание атак Орды." },
      { name:"Fast Learner (15) / Ловит на Лету (15)", benefit:"+15% к опыту.", rating:15, hasRating:true },
      { name:"Hollow Bones / Пустые Кости", benefit:"Полые кости: −5 к Поглощению против I(Cr) урона." },
      { name:"Razor Talons / Бритвенные Когти", benefit:"Естественное оружие получает свойство Razor Sharp." },
      { name:"Limited Lift / Ограниченная Подъёмная Сила", benefit:"Не может летать при перегрузе Ношения и в тяжёлой броне." }
    ],
    archetypes: ["Отступник","Ересиарх","Ренегат","Пират","Дикарь","Благородный","Ведьма","Нумен"],
    desc: "Крылатый абхуман-мутант ТЭТ: быстрый и свободный налётчик."
  },

  naga: {
    label: "Нага",
    subraces: [],
    chars: { ws:25, bs:25, s:25, t:25, ag:25, int:25, per:25, wp:25, fel:25, inf:19 },
    bonusRolls: 2, bonusPoints: 7, charShift: 2,
    size: 1,
    skills:  "Common Lore (любые 2), Linguistics (Low Gothic)",
    gear:    "4 элемента до R1 (1 Good.Q, 1 Best.Q)",
    talents: ["Ambidextrous", "Hatred (Naga)", "Preternatural Speed", "Sprint"],
    traits: [
      { name:"Bite (1) / Укус (1)", benefit:"Естественная атака укусом.", rating:1, hasRating:true },
      { name:"Crawler / Ползун", benefit:"Нет штрафов за трудный ландшафт." },
      { name:"Dark Sight / Ночное Зрение", benefit:"Видит в темноте." },
      { name:"Multiple Arms / Многорукий", benefit:"Дополнительные руки → доп. атаки/манипуляции." },
      { name:"Natural Armour (1) / Естественная Броня (1)", benefit:"+1 AP на все локации.", rating:1, hasRating:true, effects:{ armourAll:1 } },
      { name:"Nimble / Проворный", benefit:"Штраф атакующим (−Ag.b).", rating:10, hasRating:true },
      { name:"Size (1) / Размер (1)", benefit:"Размер +1.", rating:1, hasRating:true, effects:{ sizeMod:1 } },
      { name:"Sturdy / Надёжный", benefit:"+20 vs Захват/Оглушение." },
      { name:"Toxic / Токсичный", benefit:"Естественное оружие Toxic.", rating:1, hasRating:true },
      { name:"The Quick and The Dead / Быстрые и Мёртвые", benefit:"+2 к Инициативе." },
      { name:"Abominable Physiology / Изуверская Физиология", benefit:"Иммунитет к пост-эффектам/зависимости от наркотиков; перебросы T; снятие Кровотечения в начале Хода." },
      { name:"Adaptive Venom / Адаптивная Отрава", benefit:"Toxic использует 1d10 вместо 1d5." },
      { name:"Constrictor / Удав", benefit:"+20 на Захват/Борьбу; Unnatural S в Захвате." },
      { name:"Dark Prince's Child / Дитя Тёмного Принца", benefit:"Благословение Слаанеш." },
      { name:"Vanity Unbound / Безграничное Тщеславие", benefit:"Hatred ко всем (склонность к презрению)." }
    ],
    archetypes: ["Отступник","Ересиарх","Ренегат","Пират","Дикарь"],
    desc: "Змееподобный результат экспериментов Скульпторов Плоти по воссозданию Лазр."
  },

  splice: {
    label: "Сплайс",
    subraces: [],
    chars: { ws:25, bs:25, s:25, t:25, ag:25, int:25, per:25, wp:25, fel:25, inf:19 },
    bonusRolls: 2, bonusPoints: 7, charShift: 2,
    size: 0,
    skills:  "Common Lore (любые 4), Linguistics (Low Gothic), Trade (любое 1)",
    gear:    "5 элементов до R1 (2 Good.Q, 1 Best.Q), Vox-Bead",
    talents: ["Heightened Senses (любые 2)", "Resistance (любые 2)", "Catfall или Die Hard"],
    traits: [
      { name:"Bite (1) / Укус (1)", benefit:"Естественная атака укусом.", rating:1, hasRating:true },
      { name:"Digitigrade (1) / Двусоставный (1)", benefit:"+1 SPD; +5 группирование.", rating:1, hasRating:true },
      { name:"Quadruped (1) / Четвероногий (1)", benefit:"Удваивает SPD и Ношение.", rating:1, hasRating:true },
      { name:"Unnatural (выбор) (2) / Сверхъестественная (выбор) (2)", benefit:"+2 к Бонусу выбранной из S/T/A/P. Укажите в авто-эффектах.", rating:2, hasRating:true },
      { name:"The Quick and The Dead / Быстрые и Мёртвые", benefit:"+2 к Инициативе." },
      { name:"Fast Learner (15) / Ловит на Лету (15)", benefit:"+15% к опыту.", rating:15, hasRating:true },
      { name:"Unstable Genome / Нестабильный Геном", benefit:"Раз в сессию можно сменить адаптацию; +5% к Fast Learner." },
      { name:"Gene-Splice / Ген-Сплайс", benefit:"Выбор 3 адаптаций (Сенсорные/Защитные/Атакующие/Продвинутые) — см. список адаптаций." }
    ],
    adaptations: "Сенсорные (Ищейка, Ночной Хищник, Электрочутьё, Эколокация), Защитные (Амфибия, Жгучесть, Чешуя/Панцирь), Атакующие (Выдвижные/Большие Когти, Огромная Пасть, Хлысткообразные Мышцы), Продвинутые (Взрывное Действие, Ядовитые когти, Проворный Хвост, Переверты, Продвинутый Физиолог, Регенерация)",
    archetypes: ["Отступник","Ересиарх","Ренегат","Пират","Дикарь","Ведьма","Нумен"],
    desc: "Гибрид человека и животного из ДНК ТЭТ; нестабильный геном с выбором адаптаций."
  },

  replicant: {
    label: "Репликант",
    subraces: [],
    chars: { ws:25, bs:25, s:25, t:25, ag:25, int:25, per:25, wp:25, fel:25, inf:19 },
    bonusRolls: 2, bonusPoints: 7, charShift: 2,
    size: 1,
    skills:  "Common Lore (любые 2), Linguistics (Low Gothic), Trade (любое 1) +10",
    gear:    "5 элементов до R1 (2 Good.Q, 1 Best.Q), Vox-Bead",
    talents: ["Bulging Biceps", "Frenzy", "Hardy", "Iron Jaw", "Resistance (любые 2)"],
    traits: [
      { name:"Size (1) / Размер (1)", benefit:"Размер +1.", rating:1, hasRating:true, effects:{ sizeMod:1 } },
      { name:"Unnatural Strength (4) / Сверхъестественная Сила (4)", benefit:"+4 к Бонусу Силы.", rating:4, hasRating:true, effects:{ charBonusStat:"s", charBonusValue:4 } },
      { name:"Unnatural Toughness (4) / Сверхъестественная Стойкость (4)", benefit:"+4 к Бонусу Стойкости.", rating:4, hasRating:true, effects:{ charBonusStat:"t", charBonusValue:4 } },
      { name:"The Quick and The Dead / Быстрые и Мёртвые", benefit:"+2 к Инициативе." },
      { name:"Fast Learner (10) / Ловит на Лету (10)", benefit:"+10% к опыту.", rating:10, hasRating:true },
      { name:"Alchem Monster / Алхимическое Чудовище", benefit:"Наркотики/химия действуют сильнее и дольше; +T тесты." },
      { name:"Enduring / Стойкий", benefit:"Игнорирует штраф Усталости, пока не провалит Resistance." },
      { name:"Hulking / Громила (Легион)", benefit:"Может использовать оружие/снаряжение Легиона как десантник." },
      { name:"Hypno-Scars / Гипно-Шрамы", benefit:"Гипноимплант: Критический Провал → Ступор 1 Раунд." },
      { name:"Serum Hook / Крючок Сывороток", benefit:"Без еженедельной сыворотки — 1d5 урона в S; зависимость от сыворотки." },
      { name:"Expiration Date / Срок Годности", benefit:"Срок жизни ~15+1d5 лет; стареет быстро." },
      { name:"Genetic Decay / Генетическое Угасание", benefit:"Максимальный возраст со временем падает." }
    ],
    archetypes: ["Отступник","Ересиарх","Ренегат","Пират","Дикарь","Скитарий"],
    desc: "Генетически модифицированный раб-сверхчеловек, зависимый от гормональных сывороток."
  },

  yigori: {
    label: "Йигори",
    subraces: [],
    chars: { ws:25, bs:25, s:25, t:25, ag:25, int:25, per:25, wp:25, fel:25, inf:19 },
    bonusRolls: 2, bonusPoints: 11, charShift: 2,
    size: 0,
    skills:  "Common Lore (любые 4), Linguistics (Low Gothic), Trade (любое 1)",
    gear:    "5 элементов до R1 (2 Good.Q, 1 Best.Q), Vox-Bead",
    talents: ["Ambidextrous", "Double Team", "Frenzy", "Heightened Senses (Sight, Smell)", "Jumper", "Leap Up", "Resistance (Cold, Heat, Poison)", "Sprint", "Total Recall", "Unarmed Warrior"],
    traits: [
      { name:"Unnatural Strength (2) / Сверхъестественная Сила (2)", benefit:"+2 к Бонусу Силы.", rating:2, hasRating:true, effects:{ charBonusStat:"s", charBonusValue:2 } },
      { name:"Unnatural Intelligence (2) / Сверхъестественный Интеллект (2)", benefit:"+2 к Бонусу Интеллекта.", rating:2, hasRating:true, effects:{ charBonusStat:"int", charBonusValue:2 } },
      { name:"Unnatural Agility (2) / Сверхъестественная Ловкость (2)", benefit:"+2 к Бонусу Ловкости.", rating:2, hasRating:true, effects:{ charBonusStat:"ag", charBonusValue:2 } },
      { name:"The Quick and The Dead / Быстрые и Мёртвые", benefit:"+2 к Инициативе." },
      { name:"New Men / Новые Люди", benefit:"Лечится как космодесантник; иммунитет к негативным эффектам наркотиков/медикаментов; ускоренная регенерация конечностей; быстрое размножение." },
      { name:"Pack Conscious / Сознание Стаи", benefit:"Телепатическая связь со стаей в радиусе Командного Присутствия." },
      { name:"Pheromone Glands / Феромонные Железы", benefit:"+10 на социальные взаимодействия (в герметичной броне не работает)." }
    ],
    archetypes: ["Отступник","Ересиарх","Ренегат","Пират","Дикарь","Благородный","Ведьма"],
    desc: "Новый человек апотекария Фабия Байла: универсал с дополнительными органами и сознанием стаи."
  }
};

// Группировка рас для выпадающего списка (optgroup)
export const RACE_GROUPS = [
  { label: "Люди",           races: ["human","astartes","ogryn","ratling","beastman","replicant","yigori"] },
  { label: "Отродия",        races: ["harpy","naga","splice"] },
  { label: "Аэльдари",       races: ["azuriane","drukhari","ynnari","halfEldar","harlequin","exodite"] },
  { label: "Другие Ксеносы", races: ["squat","sslyth"] }
];

// Ключи рас аэльдари (для поля «Происхождение» и пр.)
export const AELDARI_RACES = ["azuriane","drukhari","ynnari","halfEldar","harlequin","exodite"];

export const SUBRACES = {
  mutant:      "Мутант",
  stunted:     "Затупленный",
  afriel:      "Африэль",
  inheritor:   "Наследник",
  pariah:      "Пария",
  discordant:  "Дискордант",
  navigator:   "Навигатор",
  eldanar:          "Эльданар",
  truebornDrukhari: "Истиннорожденный",
  mandrake:         "Мандрагора",
  wrack:            "Развалина",
  grayman:          "Серый Человек",
  slaangor:    "Слаангор",
  pestigor:    "Пестигор",
  khorngor:    "Кхорнгор",
  tzaangor:    "Тзаангор"
};

// Данные субрас Человека (стоимость в опыте + эффект). Применение — позже Мастером.
export const SUBRACE_DATA = {
  mutant: {
    label: "Мутант", cost: 500,
    effect: "+5 Cor и 1 дополнительная мутация (выбор из списка). Навыки Deceive или For.Lore (Mutants) становятся дружественными.",
    traits: []
  },
  stunted: {
    label: "Затупленный", cost: 500,
    effect: "Трейт Blunted (1); не уменьшает максимум Очков Бесчестья на 1. Можно повышать рейтинг Blunted (дороже).",
    traits: [{ name: "Blunted (1) / Затупленный (1)", benefit: "Защита от психо-атак на основе Варпа.", rating: 1, hasRating: true, effects: {} }]
  },
  afriel: {
    label: "Африэль", cost: 750,
    effect: "Клон-чемпион: 2 Характеристики и 3 Навыка становятся дружественными. ГМ периодически бросает лишние проблемы; криты врагов чаще нацелены на Африэля.",
    traits: []
  },
  inheritor: {
    label: "Наследник", cost: 1000,
    effect: "Кровь Лорда Хаоса: +1 к максимуму Очков Бесчестья; видения предка (подсказки). Чудесное Спасение/Божественная Защита: бросок 2 кубика, меньший. Трейт Помазанник (5) Демон-Принца.",
    traits: []
  },
  pariah: {
    label: "Пария", cost: 1500,
    effect: "Аура чернокнижия (W.b×3 м): иммунитет к психосилам/демоническим дарам; psychics −6PR×3; демоны −30; не имеет Порчи/Судьбы; −30 социальные (кроме запугивания), −60 к псайкерам/демонам. Не может брать Архетипы Ведьма и Псайкер.",
    traits: [{ name: "Pariah / Пария", benefit: "Аура чернокнижия (Untouchable).", hasRating: false, effects: {} }]
  },
  discordant: {
    label: "Дискордант", cost: 1500,
    effect: "Аура Haywire (2 м, интенсивность 7): глушит технику; +T0 vs болезни; биотех изнашивается. Талант Enemy (Adeptus Mechanicus, Dark Mechanicus). Не получает Архетипы Техножрец и Скитарий.",
    traits: [{ name: "Discordant / Дискордант", benefit: "Аура Haywire против техники.", hasRating: false, effects: {} }]
  },
  navigator: {
    label: "Навигатор", cost: 750,
    effect: "Мутант Навис Нобилитэ с третьим глазом. Считается псайкером для эффектов, нацеленных на псайкеров, но НЕ может психически пробудиться (не получает трейт Psyker). Получает трейт Navigator's Gen, навыки Navigation (Warp) +0 и Psyniscience +0 и Силу навигатора «Немигающий взор». Архетипы: Отступник, Ересиарх, Пират, Благородный, Нумен. Использует вкладку НАВ (Силы навигатора).",
    traits: [{ name: "Navigator's Gen / Ген Навигатора",
      benefit: "Живое окно в Варп. НЕ получает Порчу от Варп-Шока (на другие источники Порчи не распространяется). Может брать Силы навигаторов и таланты раздела «Ген Навигатора». Вместо обычных мутаций — Мутации навигатора. При варп-путешествиях — особые правила.",
      hasRating: false, effects: {} }]
  },

  // ── Субрасы Зверолюда (посвящённые Богам Хаоса) ─────────────────────────
  slaangor: {
    label: "Слаангор", cost: 750, god: "Слаанеш", parent: "beastman",
    effect: "+5 A, +5 P; не может потерять покровительство Слаанеш. Trait Digitigrade (3); Deadly Natural Weapons (Клешня: 1d10+2 R, Pen 3, Razor Sharp/Reinforced/Tearing). Талант Slaangor Fiendblood.",
    charMods: { ag: 5, per: 5 },
    traits: [
      { name:"Digitigrade (3) / Двусоставный (3)", benefit:"+3 SPD; +15 группирование.", rating:3, hasRating:true },
      { name:"Deadly Natural Weapons / Смертельное Естественное Оружие", benefit:"Клешня: 1d10+2 R, Pen 3, Razor Sharp, Reinforced, Tearing." },
      { name:"Slaangor Fiendblood / Слаангор Извергкровка", benefit:"Раз за бой/сцену после рукопашной атаки — ещё одна атака с той же базой (в т.ч. с нескольких рук). Требования: Cor 30, Inf 30." }
    ]
  },
  pestigor: {
    label: "Пестигор", cost: 750, god: "Нургл", parent: "beastman",
    effect: "+5 T, +5 I; не может потерять покровительство Нургла. Trait Toxic (1); Sturdy и Stuff of Nightmares. Талант Pestigor Mourner.",
    charMods: { t: 5, int: 5 },
    traits: [
      { name:"Toxic (1) / Токсичный (1)", benefit:"Естественное оружие Toxic (1).", rating:1, hasRating:true },
      { name:"Sturdy / Надёжный", benefit:"+20 vs Захват/Оглушение, +30 vs сбивание." },
      { name:"Stuff of Nightmares / Существо из Кошмаров", benefit:"Иммунитет к Усталости/критам/ядам; игнор Горения." },
      { name:"Pestigor Mourner / Пестигор Плакальщик", benefit:"Раз за бой/сцену после непоглощённого урона — уменьшить его до 1 и на 1 Раунд удвоить свой T.b в расчёте поглощения. Требования: Cor 30, Inf 30." }
    ]
  },
  khorngor: {
    label: "Кхорнгор", cost: 750, god: "Кхорн", parent: "beastman",
    effect: "+5 WS, +5 S; не может потерять покровительство Кхорна. Trait Brutal Charge (2); Natural Weapons → Deadly Natural Weapons; Талант Frenzy. Талант Khorngor Butcher.",
    charMods: { ws: 5, s: 5 },
    talents: ["Frenzy"],
    traits: [
      { name:"Brutal Charge (2) / Брутальный Натиск (2)", benefit:"+2 урона при Натиске/Верховой атаке.", rating:2, hasRating:true },
      { name:"Deadly Natural Weapons / Смертельное Естественное Оружие", benefit:"Естественное оружие теряет Primitive." },
      { name:"Khorngor Butcher / Кхорнгор Мясник", benefit:"Запас кубиков: по 1 за Талант Hatred 2-го ур. и 1 за 2 Таланта Hatred 1-го ур. Нанося урон атакой с бонусом S.b (после броска, до щитов), можно потратить до ½ W.b (окр.▲) кубиков, +1 кубик урона за каждый (Экстремальный урон возможен). Восстанавливаются в конце боя. Требования: Cor 30, Inf 30, Hatred." }
    ]
  },
  tzaangor: {
    label: "Тзаангор", cost: 750, god: "Тзинч", parent: "beastman",
    effect: "+5 I, +5 F; не может потерять покровительство Тзинча. Теряет Natural Weapons (Рога/Когти), Aversion to Order и Stepchildren of the Gods. Талант Tzaangor Enlightened.",
    charMods: { int: 5, fel: 5 },
    removesTraits: ["Natural Weapons", "Aversion to Order", "Stepchildren of the Gods"],
    traits: [
      { name:"Tzaangor Enlightened / Тзаангор Просвещённый", benefit:"Ритуалом (1 час, без теста) призывает Диск Тзинча под своим управлением, как при ритуале Трансформации Диска; получает 3d10 урона в W. Требования: Cor 30, Inf 30, Forbidden Lore (Daemons) +0." }
    ]
  },

  // ── Субрасы Друкхари ──
  truebornDrukhari: {
    label: "Истиннорождённый", cost: 1500, parent: "drukhari",
    effect: "Рождён естественным путём. Таланты «Пилот/Смелость/Всадник» +1 враждебнее; «Социальное» +1 дружественнее; Charm/Deceive/Scrutiny +1 дружественнее; Stealth/Survival +1 враждебнее. Талант Paranoia или Lightning Reflexes; Kabalite Weapon Training; +3 Очка Снаряжения; +6 улучшений стартового снаряжения (до R2); дважды бросок на Влияние (выбор большего); +2 броска характеристик или 11 Бонусных Очков. Доступ к архетипу Придворный.",
    talents: ["Paranoia или Lightning Reflexes", "Kabalite Weapon Training"],
    traits: []
  },
  mandrake: {
    label: "Мандрагора", cost: 2000, parent: "drukhari",
    effect: "Дитя теневого царства Элиндрах. +5 S/T, −10 I/F. Stealth → +10. Теряет талант Jaded. Таланты Disturbing Voice, Fearless, Unarmed Warrior. Стартовое снаряжение (кроме снаряжения/инструментов) → Glimmersteel Blade (Good.Q) и Xenohide Tunic. Архетипы: Убийца, Неприкаянный, Боец Ямы.",
    charMods: { s: 5, t: 5, int: -10, fel: -10 },
    talents: ["Disturbing Voice", "Fearless", "Unarmed Warrior"],
    traits: [
      { name: "Unnatural Strength (4) / Сверхъест. Сила (4)", benefit: "+4 к Бонусу Силы.", rating: 4, hasRating: true, effects: { charBonusStat: "s", charBonusValue: 4 } },
      { name: "Unnatural Toughness (2) / Сверхъест. Стойкость (2)", benefit: "+2 к Бонусу Стойкости.", rating: 2, hasRating: true, effects: { charBonusStat: "t", charBonusValue: 2 } },
      { name: "Daemonic (3) / Демонический (3)", benefit: "Поглощение варп-урона +3 (от теневого измерения, не Варпа; обходится Force/Sanctified/Warp Weapon).", rating: 3, hasRating: true, effects: {} },
      { name: "Phase / Фаза", benefit: "Может входить в фазовое состояние (взаимодействует с миром только во Тьме; высокотех. снаряжение пропадает в тенях и возвращается Poor.Q).", effects: {} },
      { name: "Drasii / Житель Тьмы",
        benefit: "Игнорирует страх (включая сверхъест. ужас) и свойства Daemonic/Daemonic Presence/From Beyond/Stuff of Nightmares врагов. Видит сквозь любую тьму. Аура холода 16 м. +2 Боли при усталости/уроне Холодом цели рядом. Не может иметь миньонов-зверей. Бонусы от татуировок теряются под Sealed-бронёй / бронёй с AP во всех частях или >4 AP. В Слабом Свете/Тьме +20 и Преимущество на Уворот/Скрытность. Может входить в теневое измерение (телепорт до 500 м между тёмными точками; выход — Незримая атака). Иммунитет к холоду/вакууму, +30 vs среда. Убийство: −1 усталость, +1 рана и атака «Губительное Пламя» (Doomfire: Пистолет, 20м, S/3/–, 1d10+6 E, Pen 4, Corrosive (1d5), Crippling (4), Shocking; до W.b зарядов). Должен убивать оружием из Мерцающей Стали раз в 36 дней. Подробности — см. справочник.", effects: {} }
    ]
  },
  wrack: {
    label: "Развалина", cost: 2000, parent: "drukhari",
    effect: "Гемаколит, хирургически перестроенный Гемункулами. +5 S/T. Таланты Ambidextrous, Bulging Biceps, Resistance (Cold, Heat, Poisons), Unarmed Warrior. Архетипы: Убийца, Алхимик, Неприкаянный, Боец Ямы. Элитный архетип Гемункул вдвое дешевле.",
    charMods: { s: 5, t: 5 },
    talents: ["Ambidextrous", "Bulging Biceps", "Resistance (Cold, Heat, Poisons)", "Unarmed Warrior"],
    traits: [
      { name: "Unnatural Strength (2) / Сверхъест. Сила (2)", benefit: "+2 к Бонусу Силы.", rating: 2, hasRating: true, effects: { charBonusStat: "s", charBonusValue: 2 } },
      { name: "Unnatural Toughness (2) / Сверхъест. Стойкость (2)", benefit: "+2 к Бонусу Стойкости.", rating: 2, hasRating: true, effects: { charBonusStat: "t", charBonusValue: 2 } },
      { name: "Machine (2) / Машина (2)", benefit: "+2 AP естественной брони; но иммунен к Haywire и лечится ремонтом и медикаментами.", rating: 2, hasRating: true, effects: {} },
      { name: "Toxic (2) / Токсичный (2)", benefit: "Интегрированное рукопашное оружие (природное) получает Toxic (2).", rating: 2, hasRating: true, effects: {} },
      { name: "Wrack’s Body / Тело Развалины",
        benefit: "Не носит немодифицированную броню (но Size 0). Best.Q Инъекторы в руках; постоянно имеет Best.Q Аптечку, Good.Q Комби-Инструмент, Следовательский Набор и Пыточные Инструменты. Сам ставит импланты/кибернетику за минуту. Броня = Machine + Natural Armour. При потере сознания/гибели создаёт Очко Боли. Трейты можно улучшать у Гемункула (услуга R3): Machine/Multiple Arms/Natural Armour/Toxic/Unnatural S/T → до (4). При создании 1 стартовый трейт можно улучшить бесплатно, ещё один — за 3 Очка Снаряжения.", effects: {} }
    ]
  }
};
