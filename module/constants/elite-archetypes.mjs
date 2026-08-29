/**
 * ЭЛИТНЫЕ АРХЕТИПЫ (корбук стр. 114-164).
 *
 * Каждый Элитный Архетип даёт персонажу уникальные Трейты (бесплатно, в разделе
 * «Преимущества») и открывает доступ к списку «Дополнительных Талантов», которые
 * покупаются за опыт как обычные. Сами Трейты и Таланты живут в компендиумах
 * `warhammer-dbc.traits`/`warhammer-dbc.talents` (папка «Элитные архетипы» →
 * лист = имя архетипа) — наполнены из packs-src, не отсюда.
 *
 * Данные архетипа (раса, требования, бонусы х-к, стартовые таланты, снаряжение)
 * хранятся в ELITE_ARCHETYPES для автоматизации выдачи через Мастер создания
 * и элит-пикер (elite-picker.mjs); traits/talents — только имена, для ссылки
 * на записи компендиума (tools/elite-archetypes-to-pack.mjs). Механику
 * одержимого см. possession.mjs (там же папка «Таланты одержимых»).
 */

// ── Данные архетипов ────────────────────────────────────────────────────────
// arch: { name, god, race, req, charBonus, freeTalents, gear,
//         traits: [name, …], talents: [name, …] }
export const ELITE_ARCHETYPES = [
  // ═══════════════════════ ДРУКХАРИ ═══════════════════════
  // Бог не указан: у друкхари нет Покровительства (трейт «Безбожник»).
  // Где в требованиях стоит «Друкхари» — архетип доступен и субрасам.

  // ── Культ Ведьм ──
  {
    name: "Ведьма", god: "", race: "Друкхари",
    req: "A 60, WS 50, Acrobatics+20, Dodge+20; Cleave, Dexterity Technique, Eldanesh Technique, Hekatrii Technique, Whirlwind of Death, Ultanesh Technique; 2000 xp",
    charBonus: "+5 WS, +5 A",
    freeTalents: "Reaper, Dexterous Fighter, Speed Awareness, Sprint, Sure Strike, Two Weapon Wielder (Both)",
    gear: "",
    traits: ["Unnatural Agility (+2) / Сверхъест. Ловкость", "Unnatural WS (4) / Сверхъест. Оружейное Мастерство", "Striking Performance / Разящее Представление", "Gladiators of Commoragh / Гладиаторы Комморага"],
    talents: ["Shaving Dance / Бритвенный Танец", "Agonizing Dance / Агонизирующий Танец", "Power Dance / Силовой Танец", "Yraqnae / Иракнае", "Hydrae / Гидрае", "Bloodbride / Кровавая Невеста"]
  },
  {
    name: "Суккуб", god: "", race: "Любая",
    req: "Элитный архетип Ведьма или Укротитель; 3000 xp",
    charBonus: "+3 WS, +3 A, +3 P",
    freeTalents: "",
    gear: "",
    traits: ["Brutal Charge (WS.b) / Жестокий Натиск", "Unnatural WS, A (+2) / Сверхъест. WS и Ловкость", "Bride of Death / Невеста Смерти", "Storm of Blades / Шторм Клинков"],
    talents: ["Performance of Blades / Представление Клинков", "Prerogative of Strike / Прерогатива Удара", "Blood Dancer / Кровавый Танцор", "Superagility / Сверхловкость", "Leader of Brides of Death / Предводительница Невест Смерти", "Thrilling Spectacle / Захватывающее Представление"]
  },
  {
    name: "Укротитель", god: "", race: "Любая",
    req: "P 50, A 40, Awareness+20, Survival+20; 2000 xp",
    charBonus: "+10 P",
    freeTalents: "",
    gear: "Маска Повелителя Зверей (R4)",
    traits: ["Unnatural Perception (+2) / Сверхъест. Восприятие", "Beast Master / Мастер Зверей"],
    talents: ["Hellspider / Адский Паук", "Clawed Fiend / Когтистый Дьявол", "Khymera / Кхимера", "Barghesi / Бхаргези", "Unusual Animals / Необычные Звери"]
  },

  // ── Кабалы ──
  {
    name: "Архонт", god: "", race: "Друкхари",
    req: "WS 40, BS 40, I 40, W 40, F 50, Charm+20, Command+30, Deceive+20, Logic+20, Scholastic Lore (Heraldry)+20, Air of Authority, Iron Discipline, Mastery Common Lore (Intrigue), 60 Inf; 3000 xp",
    charBonus: "+2 WS, +2 BS, +2 F, +2 I, +2 W",
    freeTalents: "",
    gear: "",
    traits: ["Unnatural F, I, W (+2) / Сверхъест. Общительность, Интеллект, Воля", "Unnatural Inf (+4) / Сверхъест. Влияние", "Old Feelings / Старые Ощущения", "Lord of the Spires of Commoragh / Владыка Шпилей Комморага"],
    talents: ["Ascend of Weapon / Возвышение Оружия", "Fight, Die In My Name! / В Бой! Умрите Во Имя Меня!", "Terrifying Presence / Ужасающее Присутствие", "Devious Mind / Коварный Ум", "Overlord / Повелитель"]
  },
  {
    name: "Гемункул", god: "", race: "Друкхари, Развалина",
    req: "I 40, 2000 xp потрачено, 30 Inf; 3000 xp",
    charBonus: "+15 I",
    freeTalents: "Infused Knowledge",
    gear: "Лаборатория Гемункула (R5), амниотические капсулы, капсулы регенерации",
    traits: ["From Beyond / Извне", "Unnatural Intelligence (+2) / Сверхъест. Интеллект", "Lord of Lords / Владыка Владык", "Haemonculi Coven / Ковен Гемункулов", "Ideal of Science / Идеал Науки"],
    talents: []
  },
  {
    name: "Иерарх", god: "", race: "Друкхари Истиннорожденный",
    req: "F 45, I 45, Peer (3 комморитские фракции), Good Reputation (1 комморитская фракция), быть в подчинении у Архонта, Intimidate+10, Inquiry+10, Charm+20, Commerce+20, Common Lore (Druchii)+30, Common Lore (Intrigue)+30; 2500 xp",
    charBonus: "+3 F, +3 I",
    freeTalents: "",
    gear: "",
    traits: ["Unnatural Fellowship (+2) / Сверхъест. Общительность", "His Will / Его Воля", "Invisible Threads / Невидимые Нити"],
    talents: ["Sophisticated Speech / Утончённая Речь", "Convincing Argument / Убедительный Аргумент", "A Trained Eye / Наметанный Глаз", "Whatever You Want / Что Захотите", "The Contract Network / Сеть Контрактов", "Please At Any Cost! / Угодить Любой Ценой!"]
  },
  {
    name: "Сибарит", god: "", race: "Любая",
    req: "WS 35, BS 35, F 35; 1500 xp",
    charBonus: "+3 WS, +3 BS, +3 F",
    freeTalents: "",
    gear: "",
    traits: ["Power of Strength / Власть Силы", "Tyrant's Reputation / Репутация Тирана"],
    talents: ["Sybarite / Сибарит", "Solarite / Соларит", "Helliarch / Геллиарх", "Hekatrix / Гекатрица", "Dracon / Драконт"]
  },
  {
    name: "Ламия", god: "", race: "Друкхари, Развалина, Сслит",
    req: "Женщина; I 40, F 40, Charm+20, Trade (Chymist)+20; 3000 xp (2500 для Истиннорождённого)",
    charBonus: "+5 I, +5 F",
    freeTalents: "Disciple Of Shaimesh",
    gear: "Blade of the Sisterhood",
    traits: ["Unnatural Intelligence (+2) / Сверхъест. Интеллект", "Shaimesh Disciple / Ученица Шаимеш", "Blessing of Shaimesh / Благословение Шаимеша"],
    talents: ["Lhamaean Kiss / Ламеянский Поцелуй", "Shard of Poison / Осколок Яда", "Salt On The Wound / Соль На Рану", "Hands In A Poison / Руки В Яде", "Cruelty of the Poison / Жестокость Яда", "Daughter of Shiamesh / Дочь Шаимеш"]
  },
  {
    name: "Медуза", god: "", race: "Любая",
    req: "Отсутствие Blunted; 3000 xp (2500 для Друкхари)",
    charBonus: "+15 W, −5 S, −5 T, −5 F",
    freeTalents: "",
    gear: "Живая медуза (зверь R4; R3 при связях с Гемункулами, Архонтами, Суккубами или Клэйвексами)",
    traits: ["Deadly Natural Weapon (2, Щупальца; 7, Укус)", "From Beyond / Извне", "Hoverer (W.b) / Парящий", "Parasite / Паразит", "Unnatural Willpower (+4) / Сверхъест. Воля", "Warp Sight / Варп-Зрение", "Medusae / Медуза", "Empath / Эмпат"],
    talents: ["Extreme Sensations / Экстремальные Ощущения", "Emotional Vision / Эмоциональное Зрение", "Emotional Explosion / Эмоциональный Взрыв", "Material Wreck / Материальное Крушение", "Alien Consciousness, Alien Powers / Чуждое Сознание, Чуждые Силы"]
  },

  // ── Мандрагоры ──
  {
    name: "Ночной Демон", god: "", race: "Мандрагора",
    req: "F 35, Command+20; 2500 xp",
    charBonus: "+5 WS, +5 F",
    freeTalents: "Peer (Мандрагоры), Good Reputation (своя община Мандрагор)",
    gear: "",
    traits: ["Daemonic (+3) / Демонический", "Unnatural WS (+4) / Сверхъест. Оружейное Мастерство", "Chosen One of Darkness / Избранник Тьмы", "The Exalted Mandrake / Возвышенный Мандрагор"],
    talents: ["The Cold of Darkness / Холод Тьмы", "Shimmering Bodies / Мерцающие Тела", "The Glimmer of Blades / Мерцание Клинков", "Darkness is Our Home / Тьма Дом Родной", "Freeze the Blood / Заморозить Кровь", "Skulls to the Throne of Mandrakes / Черепа Трону Мандрагор"]
  },
  {
    name: "Житель Бездны", god: "", race: "Мандрагора",
    req: "BS 40, T 40; 2500 xp",
    charBonus: "+5 BS, +5 T",
    freeTalents: "",
    gear: "",
    traits: ["Daemonic (+4) / Демонический", "The Conductor of Dark Energy / Проводник Тёмной Энергии", "The Exalted Mandrake / Возвышенный Мандрагор"],
    talents: ["Dark Flesh / Тёмная Плоть", "Dark Hand / Тёмная Длань", "Hungry Darkness / Голодная Тьма", "Doom Runes / Губительные Руны", "The Hands of Death / Руки Несмерти", "Herald of Darkness / Герольд Тьмы"]
  },
  {
    name: "Избиратель Плоти", god: "", race: "Мандрагора",
    req: "WS 40, I 40, Forbidden Lore (Xenobiology)+0, Medicae+10, Scholastic Lore (Occult)+10; 2500 xp",
    charBonus: "+5 WS, +5 I",
    freeTalents: "",
    gear: "Berten-Zhar / Тело Смерти (двуручный клинок из Мерцающей Стали, R4)",
    traits: ["Daemonic (+2) / Демонический", "Unnatural Intelligence (+4) / Сверхъест. Интеллект", "The Ritual of the Limbs / Ритуал Конечностей", "Dark Surgery / Тёмная Хирургия", "The Exalted Mandrake / Возвышенный Мандрагор"],
    talents: ["Fiery Wounds / Огненные Раны", "Dissection / Рассечение", "Devouring of Life / Поглощение Жизни", "Rotting Life / Гниющая Жизнь", "The Cursed Hand / Проклятая Рука", "Any Hands... Any Kind! / Любые Руки… Любые!"]
  },
  {
    name: "Скорбные Пасти", god: "", race: "Мандрагора",
    req: "Intimidate+10, Scholastic Lore (Occult)+10, Trade (Musician)+10; 2500 xp",
    charBonus: "+5 I, −5 W",
    freeTalents: "",
    gear: "",
    traits: ["Daemonic (+3) / Демонический", "Mark of Revenge / Метка Мести", "The Time Has Come / Время Пришло", "The Exalted Mandrake / Возвышенный Мандрагор"],
    talents: ["Ice Kingdom / Ледяное Царство", "Whisper of Death / Шёпот Смерти", "Fear Incarnate / Воплощение Страха", "Dark Omens / Тёмные Предзнаменования", "Sentence / Приговор", "Game Has Only Just Begun / Игра Только Началась"]
  },
  {
    name: "Тенеткач", god: "", race: "Мандрагора",
    req: "Deceive+10, Scholastic Lore (Occult)+10; 2500 xp",
    charBonus: "+5 W",
    freeTalents: "",
    gear: "",
    traits: ["Daemonic (+3) / Демонический", "Lord of Darkness / Владыка Тьмы", "The Exalted Mandrake / Возвышенный Мандрагор"],
    talents: ["Eternal Darkness / Вечная Тьма", "Embrace of Darkness / Объятия Тьмы", "Cold of Darkness / Холод Тьмы", "Stalker / Преследователь"]
  },

  // ── Разное ──
  {
    name: "Бичеватель", god: "", race: "Друкхари, Развалина",
    req: "A 50, Operate (Aeronautica)+10, Inf 35; 1750 xp",
    charBonus: "",
    freeTalents: "",
    gear: "Ghostplate Armor; Splinter Cannon или Shredder, или Haywire Blaster, или Blaster, или Shardcarabine",
    traits: ["Born for Heights / Рождены Для Высоты", "Corporate Ethics / Корпоративная Этика", "Vultures of Commorragh / Стервятники Комморры"],
    talents: []
  },
  {
    name: "Длань Архонта", god: "", race: "Друкхари, Сслит",
    req: "Все характеристики (кроме Cor и Inf) от 30, 29 Inf, Peer с Архонтом, Гемункулом, Суккубом или Клэйвексом; 2500 xp",
    charBonus: "+3 ко всем характеристикам",
    freeTalents: "",
    gear: "",
    traits: ["Fear (1) / Страх", "Established Role / Установленная Роль", "Equalize The Odds / Уравнивание Шансов"],
    talents: ["Archsybarite / Архисибарит", "Disciple of Yaelindra / Ученик Яэлиндры", "Elixicant / Элексикант", "Flayer / Свежеватель", "Kabalite Agent / Агент Кабалит", "Kabalite Gunner / Кабалитский Стрелок", "Crimson Duellist / Багряный Дуэлянт", "Skysplinter Assassin / Ассасин Клана «Осколок Неба»"]
  },
  {
    name: "Инкуб", god: "", race: "Друкхари",
    req: "WS 55, A 50, Disarm, Steady Footwork, Sure Strike, Cleave, Precise Blow, Tenacity, Blademaster; 3000 xp",
    charBonus: "+5 S, +5 T",
    freeTalents: "Frenzy, Fire in Blood, Cold Fury, Battle Rage",
    gear: "Klaive, Incubus Warsuit",
    traits: ["Unnatural WS (+4) / Сверхъест. Оружейное Мастерство", "Mercenary of the Word / Наёмник Слова", "Mercenary of the Matter / Наёмник Дела"],
    talents: ["Cold Face / Холодное Лицо", "Let's Finish It Faster / Закончим Быстрее", "Sword Duel / Дуэль Мечей", "Disciple Tormentor / Ученик Мучителя", "The Teachings of Arhra / Учения Архры", "Klaivex / Клэйвекс"]
  },

  // ═══ Культовые десантники (стр. 115-118) ═══
  {
    name: "Шумовой Десантник", god: "Слаанеш", race: "Космодесантник",
    req: "Покровительство Слаанеш, BS 45, P 50, 2500 xp",
    charBonus: "+5 BS, +5 P, +6 Cor",
    freeTalents: "Exotic Weapon Training (Sonic), Heightened Senses (All), Resistance (Interrogate, Stun)",
    gear: "Sonic Blaster",
    traits: ["Intoxicating Uproar / Пьянящий Рёв", "Dread Wail / Грозный Вопль"],
    talents: ["Sing For Me! / Спой Мне!", "Distilled Torment / Дистиллированная Мука", "Nectar Of The Gods / Нектар Богов", "Pain Is Pleasure / Боль Это Наслаждение", "Sweet Cacophony / Сладкая Какофония", "Dirge of Despair / Песнь Отчаянья", "Wall of Discord / Стена Диссонанса"]
  },
  {
    name: "Чумной Десантник", god: "Нургл", race: "Космодесантник",
    req: "Покровительство Нургла, T 50, 21 Рана, 2500 xp",
    charBonus: "+10 T, +5 W, −10 A, +7 Cor",
    freeTalents: "Exotic Weapon Training (Plague)",
    gear: "Plague Knife, 7 Blight Grenades",
    traits: ["Abominable Physiology / Отвратная Физиология", "Infectious Miasma / Заразные Миазмы"],
    talents: ["Plague Gardener / Чумной Садовник", "Rotsmith / Кузнец Гнили", "Bile Spit / Жёлчный Плевок", "Glorious Rust / Славная Ржавчина", "Blessed with Pus / Благословенный Гноем", "Walking Wasteland / Ходячая Пустошь"]
  },
  {
    name: "Берсерк Кхорна", god: "Кхорн", race: "Космодесантник",
    req: "Покровительство Кхорна, WS 50, S 45, Frenzy, Fire in Blood, Hatred (любые 3), 2000 xp",
    charBonus: "+5 WS, +5 S, −8 I",
    freeTalents: "",
    gear: "",
    traits: ["Avatar of Slaughter / Аватар Резни", "Butcher's Nails / Гвозди Мясника", "Unstoppable Wrath / Неостановимый Гнев"],
    talents: ["For He Cares Not / Ему Не Важно", "Red Streak / Красная Полоса", "Paint It Red / Окрась Всё в Красный", "Tempered in Blood / Закалённое в Крови", "Blood Offering / Кровавое Подношение", "Skull Offering / Подношение Черепов"]
  },
  {
    name: "Колдун Рубрики", god: "Тзинч", race: "Космодесантник",
    req: "Покровительство Тзинча, W 50, I 45, Psyker, PR 5, Command +0, 3000 xp",
    charBonus: "+5 W, +5 F, +9 Cor",
    freeTalents: "Peer (Thousand Sons)",
    gear: "",
    traits: ["Rubric of Ahriman / Рубрика Аримана", "Golem Master / Повелитель Големов", "Shield of Rubric / Щит Рубрики"],
    talents: ["Infernal Shells / Инфернальные Снаряды", "Nexus Of Souls / Узы Душ", "Psychic Echo / Психическое Эхо", "Sekhmet / Сехмет", "Reborn in Dust / Возрождён во Прахе"]
  },

  // ═══ Специалисты Хаоса (стр. 119-126) ═══
  {
    name: "Тёмный Апостол", god: "Неделимый", race: "Космодесантник",
    req: "F 50, I 45, Charm+10, Demagogue, For.Lore (Heresy, Daemons), 2500 xp",
    charBonus: "+5 F, +5 W, +1d5 Cor",
    freeTalents: "Hatred (Ecclesiarchy)",
    gear: "Accursed Crozius",
    traits: ["Harbinger of Heresy / Предвестник Ереси", "Dark Devotion / Тёмное Поклонение"],
    talents: ["True Prayer / Истинная Молитва", "Lay On Hands / Возложение Рук", "Litany of Chaos / Литания Хаоса", "Martyr / Мученик", "Mortal Instrument / Смертный Инструмент"]
  },
  {
    name: "Мастер Казней", god: "Неделимый", race: "Космодесантник",
    req: "WS 50, P 50, Awareness+20, For.Lore(Warp)+10, 3000 xp",
    charBonus: "+5 WS, +5 P, −5 F, +1d5 Cor",
    freeTalents: "Fanatic, Unnatural Senses (P), Warp Sight",
    gear: "",
    traits: ["Single-Minded Hunter / Целеустремлённый Охотник", "Trophy Taker / Собиратель Трофеев", "Hunter Sight / Взор Охотника", "Mistwalker / Туманоходец", "Execution / Казнь"],
    talents: ["Trophies of Judgement / Трофеи Приговора", "Trophies of Triumph / Трофеи Триумфа", "Marked Prey / Отмеченная Добыча", "Mist Leap / Туманный Прыжок", "Mist Savior / Спаситель Туманов", "Final Execution / Окончательная Казнь"]
  },
  {
    name: "Варп-Кузнец", god: "Неделимый", race: "Космодесантник",
    req: "I 45, Tech-Use+10, For.Lore (Daemons), Trade (Armourer, Weaponsmith), 2000 xp",
    charBonus: "+5 T, +5 I, +1d5 Cor",
    freeTalents: "Mechandendrite Use (Weapon), Strange Technique",
    gear: "Omnissiah Axe, 4 Механодендрита (до R2)",
    traits: ["Mechanicum Implants / Импланты Механикум", "Warpforged Plate / Закалённые Варпом Латы", "Iron Cage / Железная Клеть"],
    talents: ["Sigil of Dominion / Печать Владычества", "Cell of Shame / Ячейка Позора", "Empyrean Whip / Эмпирейная Плеть", "Forge of One / Кузница Одного", "Run Down / Загнать"]
  },
  {
    name: "Лорд-Дискордант", god: "Неделимый", race: "Космодесантник",
    req: "For.Lore (Daemons)+10, Трейт Mechanicum Implants, 2500 xp",
    charBonus: "+5 WS, +5 I, +1d5 Cor",
    freeTalents: "Hatred (Dark Mechanicum, Adeptus Mechanicus, Vehicles)",
    gear: "Hell Stalker (оболочка)",
    traits: ["Machine Spirit Thief / Вор Духов Машины", "Corrupted Noosphere / Порченная Ноосфера", "Daemonic Uplink / Демоническое Подключение"],
    talents: ["Discordant Duo / Дискордантный Дуэт", "Stalkersmith / Кузнец Сталкеров", "Hellbound / Адосвязанный", "Tortured Spirit / Истерзанный Дух"]
  },
  {
    name: "Чемпион-Терминатор", god: "Неделимый", race: "Космодесантник",
    req: "WS 50, BS 50, Inf 40, 2500 xp",
    charBonus: "+5 WS или +5 BS, +5 W или +5 F",
    freeTalents: "",
    gear: "Terminator Armour (только при старте с Архетипом)",
    note: "Все преимущества, Трейты и Таланты этого Архетипа работают только когда персонаж носит Терминаторскую броню.",
    traits: ["Graceful Giant / Изящный Гигант", "Legendary Plate / Легендарные Латы"],
    talents: ["Anointed / Помазанник", "Atramentar / Атрамэнтар", "Death Shroud / Саван Смерти", "Devourer / Поглотитель", "Justaerin / Юстаэринец", "Lernean / Лернеец", "Phoenician / Фениксиец", "Tyranthikos / Тирантикос"]
  },
  {
    name: "Ветеран Долгой Войны", god: "Неделимый", race: "Космодесантник",
    req: "Hatred (любые 3 Имперские фракции), 20 000 xp потрачено, 2000 xp",
    charBonus: "+5 WS или +5 BS, +5 W или +5 F",
    freeTalents: "Hatred (Imperium)",
    gear: "",
    note: "Каждый взятый дополнительный Талант этого Архетипа увеличивает цену других его Талантов на 250 xp.",
    traits: ["Archenemy / Архивраг", "Adaptation / Адаптация"],
    talents: ["Builder of Bridges / Строитель Мостов", "Diabolist / Дьяболист", "Hub Reaver / Разоритель Хабов", "Lord Reaper / Лорд Жнец", "Proselyte / Прозелит", "Shadow Stalker / Крадущийся в Тенях", "Slayer of Champions / Убийца Чемпионов", "War Sage / Боевой Мудрец"]
  },
  {
    name: "Моритат", god: "Неделимый", race: "Космодесантник",
    req: "BS 50, A 50, Operate (Aeronautica)+10, Stealth+10, Tech-Use+10, Trade (Weaponsmith)+10, Two Weapon Wielder (Ranged), Gunslinger, 2500 xp",
    charBonus: "+5 BS, +5 A, −5 F",
    freeTalents: "",
    gear: "Moritat Power Pack (только при старте с Архетипом)",
    traits: ["No Lord, Nor Servant / Ни Владыка, Ни Слуга", "Chain Shot / Цепной Выстрел"],
    talents: ["Lone Warrior / Одинокий Воин", "Mortido / Мортидо", "Belt Feed / Ленточное Питание", "Lightning Fingers / Молниеносные Пальцы", "Fly-By / Пролётом", "Outgun / Огневая Мощь"]
  },
  {
    name: "Герольд", god: "Неделимый", race: "Космодесантник",
    req: "WS 40, F 40, Charm+10, Command+10, Logic+10, Schol.Lore (Heraldry), Air of Authority, Iron Discipline, 2500 xp",
    charBonus: "+5 F, +5 W",
    freeTalents: "Peer (Собственная банда)",
    gear: "",
    traits: ["Delegate / Делегат", "Living Banner / Живой Стяг", "Noblesse Oblige / Благородство Обязывает"],
    talents: ["Ancient / Древний", "Tip Of The Spear / Остриё Копья", "Stand Your Ground / Ни Шагу Назад", "Villainous Honour / Честь Злодеев", "Greater Herald / Высший Герольд"]
  },

  // ═══ Твари Варпа (стр. 127-128; Одержимый — см. possession.mjs, стр. 129-132) ═══
  {
    name: "Коготь Варпа", god: "Неделимый", race: "Космодесантник",
    req: "WS 50, Cor 50, Operate (Aeronautica)+20, Two Weapon Wielder (Melee), 2500 xp",
    charBonus: "+10 WS, +10 A, +5 P, −10 I, −10 F",
    freeTalents: "",
    gear: "",
    freeTraits: "Daemonic (+2), Flyer (A.b×2), Stuff of Nightmares",
    traits: ["Warp Talon Suit / Доспех Когтя Варпа", "Vorpal Claws / Стрижающие Когти", "Veil Render / Разрыватель Завесы"],
    talents: ["Warp Flash / Варп Вспышка", "Speed of Thought / Со Скоростью Мысли", "Vulture / Стервятник", "Warp Trail / Варп-След", "Rift / Разлом"]
  },
  {
    name: "Облитератор", god: "Неделимый", race: "Любая",
    req: "I 50, Tech-Use+10, 4500 xp для Космодесантника, 5500 xp для Человека",
    charBonus: "+10 BS, +30 S, +10 T, −25 A, −15 F, +5 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "Auto-stabilized, Daemonic (2), Fear (2), From Beyond, Machine (14), Regeneration (1), Size (2), Sturdy, Unnatural S (6), Unnatural T (6)",
    traits: ["Fleshmetal Body / Тело Из Плотеметалла", "Living Arsenal / Живой Арсенал"],
    talents: ["Bullet Eater / Пожиратель Пуль", "Fireproof / Огнеупорный", "Self-Forging / Самоперековывание", "Shredder / Измельчитель", "Broadside / Залп", "Mutilator / Расчленитель", "To the Teeth / До Зубов"]
  },

  // ═══ Культовые творцы (стр. 133-136) ═══
  {
    name: "Скульптор Плоти", god: "Слаанеш", race: "Человек",
    req: "Покровительство Слаанеш, I 50, P 45, Medicae+10, Schol.Lore (Occult)+10, 2500 xp",
    charBonus: "+10 I, +5 P, −5 W, +6 Cor",
    freeTalents: "",
    gear: "",
    traits: ["Rite of Fleshmolding / Ритуал Лепки Плоти", "Insanely Malleable / Безумно Податливый"],
    talents: ["Sculpturite / Скульптурит", "Eidolon / Эйдолон", "Appolyon / Аполион", "Narcissus / Нарцисс"]
  },
  {
    name: "Король Червей", god: "Нургл", race: "Человек",
    req: "Покровительство Нургла, I 50, P 45, Psyker, PR 4, Survival+10, 2500 xp",
    charBonus: "+5 T, +5 I, +5 W, −5 F, +7 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "Regeneration (½Cor.b, окр.▲)",
    traits: ["Verminous Conduit / Паразитический Проводник", "Hand of Plenty / Рука Изобилия", "Worm Master / Повелитель Червей"],
    talents: ["Maggot Mark / Метка Опарыша", "Free Roamer / Свободный Скиталец", "King's Plate / Латы Короля", "Wormwalker / Червеход", "Shell Guard / Стражи Панциря"]
  },
  {
    name: "Кузнец Крови", god: "Кхорн", race: "Человек",
    req: "Покровительство Кхорна, WS 50, W 45, For.Lore (Daemons)+10, Trade (Weaponsmith)+10, 2500 xp",
    charBonus: "+5 WS, +5 S, +5 W, −5 F, +8 Cor",
    freeTalents: "",
    gear: "",
    traits: ["Valourous Accord / Соглашение Доблести", "Ring of Blood / Кольцо Крови"],
    talents: ["Bound by Blood / Связанный Кровью", "Fealty / Присяга", "Daemon Plate / Демонические Латы", "Unforge / Расковать", "Blood Shield / Кровавый Щит"]
  },
  {
    name: "Архимаг", god: "Тзинч", race: "Человек",
    req: "Покровительство Тзинча, W 50, I 45, Psyker, PR 6, Meditation, For.Lore (Warp, Daemons, Psykers)+10, Schol.Lore (Occult)+10, Deceive+10, Scrutiny+10, 2500 xp",
    charBonus: "+5 I, +5 W, +5 F, −5 S, +9 Cor",
    freeTalents: "",
    gear: "Force Staff",
    traits: ["Mastery of Form / Мастерство Формы", "Magus Supreme / Высший Магус", "Wizard Staff / Чародейский Посох"],
    talents: ["Inner Eye / Внутренний Глаз", "Exemptus / Экземптус", "Mystic Feint / Мистический Финт", "Mirror Soul / Зеркальная Душа", "Savant Immaterial / Савант Иммматериал", "Unlimited Power / Безграничная Сила"]
  },

  // ═══ Псайкеры и оккультисты (стр. 137-142) ═══
  {
    name: "Чернокнижник", god: "Неделимый", race: "Любая",
    req: "Cor 20, For.Lore (Psykers)+20, Schol.Lore (Occult)+20, 1500 xp",
    charBonus: "+1d5 Cor",
    freeTalents: "Blasphemous Incantation",
    gear: "",
    traits: ["Dark Arts / Тёмные Искусства", "Transcription / Транскрипция"],
    talents: ["Cannibal Mage / Маг-Каннибал", "Final Echo / Последнее Эхо", "Warp Dancer / Варп-Танцор", "High Ritualist / Высший Ритуалист", "Listener / Слушающий", "Silent Student / Тихий Ученик", "Interpreter / Интерпретатор"]
  },
  {
    name: "Монарх", god: "Неделимый", race: "Любая",
    req: "I 50, W 50, Tech-Use+20, For.Lore (Psykers)+20, Medicae+20, 3000 xp",
    charBonus: "",
    freeTalents: "",
    gear: "",
    traits: ["Corona Polentia / Корона Полентия", "Brain Harvesting / Извлечение Мозга"],
    talents: ["Cerebral Channeling / Церебральный Поток", "Dragon Monarch / Монарх Дракон", "Awakening / Пробуждение", "Neuronist / Нейронист"]
  },
  {
    name: "Дикий Псайкер", god: "Неделимый", race: "Человек",
    req: "Psyker, 3000 xp",
    charBonus: "+10 W, −5 S, −5 T, +2d5 Cor",
    freeTalents: "",
    gear: "",
    traits: ["Broken Chains / Порванные Цепи", "Chain Rejection / Отторжение Цепей", "Shield of Chains / Щит Цепей"],
    talents: ["Chain Scars / Шрамы Цепей", "Heart Fire / Пламя Сердца", "Residual Absorption / Остаточное Поглощение", "Chains of Alacrity / Цепи Стремительности", "Death Eater / Пожиратель Смерти", "Power Overwhelming / Мощь Переполняет", "Withering Charge / Иссушающий Заряд"]
  },
  {
    name: "Инзорцист", god: "Неделимый", race: "Любая",
    req: "I 50, W 50, Psyker, PR 6, Total Recall, Schol.Lore (Occult)+10, For.Lore (Daemons)+30, Linguistics (True Tongue), 3500 xp",
    charBonus: "+5 I, +2d5 Cor",
    freeTalents: "",
    gear: "",
    traits: ["Name Seal / Печать Имени", "Mark of Subjugator / Метка Поработителя", "Insorcism / Инзорцизм"],
    talents: ["Daemonic Levy / Демоническое Ополчение", "Fleeting Possession / Мимолётная Одержимость", "Black Hand / Чёрная Рука"]
  },
  {
    name: "Кенетаи", god: "Неделимый", race: "Любая",
    req: "WS 50, W 50, Psyker, PR 4, Schol.Lore (Occult)+10, Психосилы: Mind Link, Precognitive Strike, 2500 xp",
    charBonus: "+5 WS, +5 W",
    freeTalents: "",
    gear: "",
    traits: ["Occult Blade / Оккультный Клинок", "Shared Consciousness / Общее Сознание"],
    talents: ["Wide Berth / Пространство для Маневра", "Focused Storm / Фокусированный Шторм", "Soul Thrust / Выпад Души", "Way of Two Blades / Путь Двух Клинков", "Blades of Brotherhood / Клинки Братства", "Spell Breaker / Разрушитель Чар"]
  },
  {
    name: "Питати", god: "Неделимый", race: "Любая",
    req: "BS 45, W 45, Psyker, PR 4, Schol.Lore (Occult)+10, Trade (Scrimshawer), 2500 xp",
    charBonus: "+3 BS, +3 P, +3 W, +1d5 Cor",
    freeTalents: "",
    gear: "",
    traits: ["Runic Bullet / Рунная Пуля", "Runic Shot / Рунный Выстрел"],
    talents: ["Living Bullet / Живая Пуля", "Runic Artillery / Рунная Артиллерия", "Seeker Bullet / Пуля Искатель", "Timed Explosion / Выдержанный Взрыв", "Piercing Shot / Сквозной Выстрел"]
  },

  // ═══ Тёмные Механикум (стр. 143-148) ═══
  {
    name: "Электрожрец", god: "Неделимый", race: "Человек",
    req: "W 40, A 40, For.Lore (Mechanicum)+10, Трейт Mechanicum Implants, Техночудеса: Voltagheist Shield, Luminen Shock, Electroepithany, 2500 xp",
    charBonus: "+5 S, +5 A, +5 T",
    freeTalents: "",
    gear: "",
    freeTraits: "Blind, Nimble (10)",
    traits: ["Electropriest Coils / Катушки Электрожреца", "Power From Flesh / Сила Из Плоти", "Motive Stimulation / Мотивирующая Стимуляция"],
    talents: ["Voltagheist Blast / Вольтагейст Взрыв", "Voltagheist Bubble / Вольтагейст Пузырь", "Voltaic Absorption / Вольтаическое Поглощение", "Voltaic Confluence / Вольтаическое Слияние", "Motive Sight / Мотивное Зрение", "Conduit March / Проводниковый Марш"]
  },
  {
    name: "Лакрималлус", god: "Неделимый", race: "Человек",
    req: "I 45, P 40, Трейт Mechanicum Implants, Medicae, Tech-Use+10, 2000 xp",
    charBonus: "+5 I, +5 P",
    freeTalents: "",
    gear: "",
    traits: ["Cyberembrace / Киберобъятья", "Toilseer / Трудовидец"],
    talents: ["Chains of Production / Цепи Производства", "Cyber-Shepherd / Кибер-Пастырь", "Inhuman Resources / Бесчеловечные Ресурсы", "Thrall Overclock / Разгон Траллов", "Assembly Line / Сборочная Линия", "Rapid Embrace / Быстрые Объятья"]
  },
  {
    name: "Тех-Ассасин", god: "Неделимый", race: "Человек",
    req: "Не Секутор, Архимагос или Малагра, WS 45, A 45, Трейт Mechanicum Implants, 4000 xp",
    charBonus: "+5 WS, +5 A, +2 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "Deadly Natural Weapons (4, когти), Hoverer (A.b), Machine (4), Multiple Arms (+2), Nimble (10), Undying, Unnatural S (4), Unnatural A (4)",
    traits: ["Assassin Frame / Фрейм Ассасина", "Paradox Veil / Вуаль Парадокса"],
    talents: ["Modular Autonomy / Модульная Автономия", "Cranial Mantle / Черепная Мантия", "Disjoint / Разделение", "Scorpio / Скорпион", "Chrysalis / Куколка", "Bisection / Рассечение"]
  },
  {
    name: "Секутор", god: "Неделимый", race: "Человек",
    req: "Не Тех-Ассасин, Архимагос или Малагра, WS 45, BS 50, Трейт Mechanicum Implants, Ambidextrous, Hatred (любые 3), Two Weapon Wielder (Ranged), 4000 xp",
    charBonus: "+5 WS, +5 BS, +5 S, +10 T, −5 I, −10 F",
    freeTalents: "Hatred (Все!)",
    gear: "",
    freeTraits: "Auto-Stabilized, Machine (6), Multiple Arms (+2), Size (1), Regeneration (1), Unnatural S (4), Unnatural T (4)",
    traits: ["Paladin Frame / Фрейм Паладина", "Structural Analysis / Структурный Анализ", "Lumbering Giant / Громыхающий Гигант"],
    talents: ["Gunzerker / Берсерк-Стрелок", "Fusillade / Фузилада", "Ordinator / Ординатор", "Sustained Assault / Непрерывный Натиск", "Myrmidon / Мирмидон", "Destructor / Деструктор"]
  },
  {
    name: "Архимагос", god: "Неделимый", race: "Человек",
    req: "Не Тех-Ассасин, Секутор или Малагра, I 55, Inf 55, Трейт Mechanicum Implants, Forbidden Lore (Mechanicum, Archeotech), Cybernetic Rebirth, Binary Dominion, 4000 xp",
    charBonus: "+10 I, +2 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "Sturdy, Undying, Unnatural T (4), Unnatural I (4)",
    traits: ["Masterpiece Frame / Фрейм Шедевра", "Voice of Omnissiah / Глас Омниссии", "Doctrina Imperative / Доктрина Императив"],
    talents: ["Dogmatix / Догматикс", "Infernax / Инфернакс", "Avatar of Metal / Аватар Металла", "Visio Irae / Лик Гнева", "Concordax / Конкордакс", "Arch-Dominus / Архи-Доминус"]
  },
  {
    name: "Малагра", god: "Неделимый", race: "Человек",
    req: "Не Тех-Ассасин, Секутор или Архимагос, I 55, P 55, Трейт Mechanicum Implants, Stealth+10, Total Recall, 4000 xp",
    charBonus: "+5 I, +5 P, +2 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "Unnatural I (4), Unnatural P (4)",
    traits: ["Astral Converter / Астральный Конвертер", "Digital Ghost / Цифровой Призрак", "Paragon Coil / Совершенная Катушка", "Malagra Cortex / Кортекс Малагра"],
    talents: ["Fell Discharge / Жестокая Разрядка", "Prescontax / Пресконтакс", "Iovex / Йовекс", "Rogoex / Рогоекс", "Magnetomorphosis / Магнитоморфоз", "Venefactor / Вэнефактор"]
  },

  // ═══ Агенты и демагоги (стр. 149-150) ═══
  {
    name: "Когнитэ", god: "Неделимый", race: "Любая",
    req: "I 65, W 55, F 55, Charm+10, Deceive+10, Inquiry+10, Interrogate+10, Scrutiny+10, Security, Stealth, Tech-Use, Schol.Lore (Bureaucracy, Cryptology, Occult), For.Lore (Heresy, Inquisition, Warp), Trade (Chymist, Instructor), Linguistics (High Gothic, Chaos Glyphs, True Tongue), 2500 xp",
    charBonus: "+5 I, +5 F, +1d5 Cor",
    freeTalents: "",
    gear: "",
    traits: ["Rite of Eight Specks / Ритуал Восьми Спиц", "Veil of Lies / Вуаль Лжи", "Hypno-Programming / Гипно-Программирование"],
    talents: ["Perfect Mask / Совершенная Маска", "Proxy Veil / Замещающая Вуаль", "Corrupted Call / Искаженный Зов", "Thousand Papercuts / Тысяча Бумажных Порезов", "Teacher / Учитель"]
  },
  {
    name: "Иерофант", god: "Неделимый", race: "Человек",
    req: "W 50, F 60, Charm+20, Deceive+20, Scrutiny+20, Schol.Lore (Imperial Creed)+20, For.Lore (Heresy)+20, Air of Authority, Inspire Wrath, 2500 xp",
    charBonus: "+5 I, +5 F, +1d5 Cor",
    freeTalents: "",
    gear: "",
    traits: ["Grand Agitator / Великий Агитатор", "Master of Masses / Владыка Масс"],
    talents: ["Blood of Martyrs / Кровь Мучеников", "Mob Justice / Правосудие Толпы", "Living Tide / Живая Волна", "Zealous Masses / Фанатичные Толпы", "Hail / Град", "Profane Cardinal / Нечестивый Кардинал"]
  },

  // ═══ Мастера боевых культов (стр. 151-154) ═══
  {
    name: "Воин Ноты", god: "Слаанеш", race: "Человек",
    req: "Покровительство Слаанеш, WS 40, A 50, Acrobatics+10, Awareness+10, Dodge+10, Trade (Musician), Trade (Dancer), Flip, Hard Target, Step Aside, Sure Strike, Precise Blow, 3500 xp",
    charBonus: "+2 WS, +5 A, +5 P, +1d5 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "Nimble (10), Unnatural A (+2), Unnatural P (+2), Sonar Sense",
    traits: ["Music of Battle / Музыка Битвы", "Dance of Pain / Танец Боли", "Adoring Crowds / Обожание Толпы"],
    talents: ["Aria / Ария", "Waltz / Вальс", "Leitmotif / Лейтмотив", "Crescendo / Крещендо", "Finale / Финале", "Overture / Увертюра", "Symphony / Симфония"]
  },
  {
    name: "Чумной Монах", god: "Нургл", race: "Человек",
    req: "Покровительство Нургла, T 50, W 35, Survival+10, For.Lore (Heresy)+10, Trade (Chymist), Resistance (Disease, Poison), Tireless, True Grit, Unarmed Master, Meditation, 3500 xp",
    charBonus: "+2 WS, +5 T, +3 W, −5 P, +7 Ран, +1d5 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "Unnatural T (+2), Regeneration (+1), Sturdy",
    traits: ["Carrion Eater / Пожиратель Мертвечины", "Corpse Poison / Трупный Яд", "Fevered Speed / Горячечная Скорость", "Putrescence Within / Гниль Внутри", "Forsake the Flame / Отвергни Пламя"],
    talents: ["Gluttony / Чревоугодие", "Putrid Clarity / Гнилостное Просвещение", "Fever Stance / Стойка Горячки", "Long Hand of Corrosion / Длинная Рука Коррозии", "Worm Listener / Слушающий Червей", "True Rot / Истинная Гниль"]
  },
  {
    name: "Виткис", god: "Кхорн", race: "Человек",
    req: "Покровительство Кхорна, WS 50, I 35, Athletics+10, Command+0, Com.Lore (War)+10, Resistance (Fear), Frenzy, Unshakeable Will, 3500 xp",
    charBonus: "+5 WS, +5 I, +2 W, +1d5 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "Unnatural WS (+2), Unnatural I (+2)",
    traits: ["All-Knowing / Всеведающий", "War Seer / Провидец Войны", "Blood Father / Отец Крови"],
    talents: ["Harder They Fall / Тем Больнее Им Падать", "Split Vision / Разделённое Видение", "Book of Battle / Книга Битвы", "Brothers at Arms / Братья по Оружию", "Witchslayer / Убийца Ведьм", "Battle Sage / Мудрец Битвы", "Blood Feud / Кровная Вражда"]
  },
  {
    name: "Ворон", god: "Тзинч", race: "Человек",
    req: "Покровительство Тзинча, WS 40, I 40, Deceive+10, Medicae+0, For.Lore (Warp)+10, Blind Fighting, Disarm, Double Team, 3500 xp",
    charBonus: "+9 WS, +3 I, +1d5 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "Unnatural WS (+4)",
    traits: ["False Blade / Ложный Клинок", "Stances of Deceit / Стойки Обмана", "Blades of Fate / Клинки Судьбы"],
    talents: ["Hidden Patterns / Скрытые Узоры", "Leverage / Рычаг", "Trip / Подножка", "Twin Fate / Двойная Судьба", "Pass By / Пропустить", "Redirect Blow / Перенаправить Удар", "Acupuncture / Акупунктура", "Flow Reader / Чтец Течения"]
  },

  // ═══ Бойцы арены и одарённые (стр. 155-156) ═══
  {
    name: "Гладиатор", god: "Неделимый", race: "Любая",
    req: "WS 50, S 40, T 40, A 40, F 35, Athletics+10, Acrobatics+10, Dodge+10, Parry+10, Die Hard, Everything a Weapon, Iron Jaw, Sure Strike, Precise Blow, 2500 xp",
    charBonus: "+3 WS, +3 S, +3 A, +3 F",
    freeTalents: "",
    gear: "",
    traits: ["Momentum / Момент", "Red Sands / Красные Пески", "Bloody Performance / Кровавое Представление", "Morituri / Идущие на Смерть"],
    talents: ["Bestiarius / Бестиарий", "Militarius / Милитарий", "Dimacherus / Димахер", "Secutorius / Секуторий", "Retiarius / Ретиарий", "Malearius / Малеарий"]
  },
  {
    name: "Броненосец", god: "Неделимый", race: "Человек",
    req: "Без Лат Скитарии или Имплантов Механикум, Inf 30, Cor 30, 3500 xp",
    charBonus: "+1d10 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "Size (1), Unnatural S (4), Unnatural T (4)",
    traits: ["Divine Plate / Божественные Латы"],
    talents: ["Hedgehog / Дикобраз", "Divine Shield / Божественный Щит", "Chaos Greatbow / Великий Лук Хаоса", "Potence / Могущество", "Rider of Chaos / Всадник Хаоса", "Chosen Flame / Избранное Пламя", "Exalted Plate / Возвышенные Латы", "Sin Eater / Пожиратель Греха", "Sorcerer's Plate / Латы Чародея"]
  },

  // ═══ Пакты и проклятья (стр. 157-163) ═══
  {
    name: "Вампир", god: "Слаанеш", race: "Любая",
    req: "Покровительство Слаанеш, 2000 xp",
    charBonus: "+5 S, +5 A, −5 W, +1d5 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "Bite (½Cor.b, окр.▲), Dark Sight, From Beyond, Stuff of Nightmares, Undying",
    note: "Таблица Стадий Пакта (Стадия 0/1/2/3/4/5) — Максимум Жажды: 6/9/12/15/18/24; Жажда в Раунд: 2/3/4/5/6/7; из них как ОБ: 2/3/3/4/4/5; Макс Unnatural Х-ка: нет/2/2/3/3/4; Боевая форма: нет/нет/да/да/да/да; PR: нет/нет/3/4/5/6.",
    traits: ["Pact Protection / Защита Пакта", "The Thirst / Жажда", "Soul Drinker / Испивающий Души", "Supreme Avarice / Высшая Алчность"],
    talents: ["Pact Stage 1 / Стадия Пакта 1", "Pact Stage 2 / Стадия Пакта 2", "Pact Stage 3 / Стадия Пакта 3", "Pact Stage 4 / Стадия Пакта 4", "Pact Stage 5 / Стадия Пакта 5"]
  },
  {
    name: "Мейстер", god: "Нургл", race: "Любая",
    req: "Покровительство Нургла, Medicae+10, Schol.Lore (Chymistry)+10, 2000 xp",
    charBonus: "+5 T, +5 I, −5 F, +1d5 Cor",
    freeTalents: "",
    gear: "",
    freeTraits: "From Beyond, Regeneration (½Cor.b, окр.▲), Stuff of Nightmares, Undying, Unnatural T (+2)",
    note: "Таблица Стадий Пакта (Стадия 0/1/2/3/4/5) — Макс. пациентов: 3/3/4/5/6/7; Аблативные Раны: 7/8/9/10/11/12; Сверхукрепление: нет/14/16/18/20/22; Regeneration: +1/+1/+2/+2/+3/+3; Бонус регенерации: нет/+10/+15/+20/+30/Авто; Инъекции: 7/7/9/11/12/14; Макс. Культивации: 3/3/4/5/6/7.",
    traits: ["Pact Protection / Защита Пакта (Мейстер)", "Savant of Life and Death / Савант Жизни и Смерти", "Life Virus / Вирус Жизни", "Cultivation / Культивация", "Deathless Oath / Несмертная Клятва"],
    talents: ["Maester Pact Stage 1 / Стадия Пакта 1 (Мейстер)", "Maester Pact Stage 2 / Стадия Пакта 2 (Мейстер)", "Maester Pact Stage 3 / Стадия Пакта 3 (Мейстер)", "Maester Pact Stage 4 / Стадия Пакта 4 (Мейстер)", "Maester Pact Stage 5 / Стадия Пакта 5 (Мейстер)"]
  }
];
