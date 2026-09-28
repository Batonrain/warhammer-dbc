// module/constants/archetypes.mjs
//
// Архетипы для Мастера создания. race — к какой расе/группе относится
// ("astartes" | "human"; далее добавим "mechanicus", "psyker" и др.).
// charBonus — бонусные характеристики (для людских архетипов). skills/talents/
// gear — текст (с выборами «или»); wounds — формула стартовых Ран.
// trait — особый архетипный Трейт. Применение — Мастером создания.

export const ARCHETYPES = {

  // ═══════════════════════════ КОСМОДЕСАНТНИКИ ════════════════════════════
  champion: {
    name: "Чемпион", race: "astartes", wounds: "15+1d5", charBonus: {},
    skills:  "Command, Scholastic Lore (любой 1), Charm или Deceive, Intimidate или Scrutiny",
    talents: "Iron Discipline или Protege, Air of Authority или Disturbing Voice, Minion (Низший, Человек) или Sure Strike",
    gear:    "L. Power Weapon (до R3, Good.Q)",
    trait: { name: "Inspiring Presence / Вдохновляющее Присутствие",
      benefit: "Чемпион может позволять союзникам и подчиненным в пределах видимости использовать его Очки Бесчестья, как если бы они имели Cor и Покровительство Чемпиона. Переданные таким образом Очки Бесчестия позволяют другому персонажу перебрасывать уже переброшенный тест." },
    desc: "Один из отрядных лидеров легиона."
  },
  raptor: {
    name: "Раптор", race: "astartes", wounds: "15+1d5", charBonus: {},
    skills:  "Acrobatics или Stealth, Intimidate или Survival, Operate (Aeronautica) +10",
    talents: "Two Weapon Wielder (Melee), Two Weapon Wielder (Ranged), Raptor или Reaper",
    gear:    "2×L. Chain Weapon (до R1), Jump Pack (Raptor pattern), 6×L. Frag Grenades",
    trait: { name: "Sky Predator / Хищник Небес",
      benefit: "В Ход, когда Раптор совершает Натиск с полета, он может заменять до 2-х кубиков урона от атак Успехами на попадание." },
    desc: "Один из воздушных штурмовиков легиона."
  },
  chosen: {
    name: "Избранный", race: "astartes", wounds: "16+1d5", charBonus: {},
    skills:  "Intimidate или Security, Stealth или Common Lore (War) +10, Dodge +10 или Parry +10",
    talents: "Lightning Reflexes, Leap Up или Rapid Reload, Disarm или Double Tap, Sure Strike или Deadeye Shot",
    gear:    "L. Chain Weapon (до R1) или L. Flamer, L. Meltagun или L. Plasmagun",
    trait: { name: "Cold Killer / Хладнокровный Убийца",
      benefit: "Когда Избранный наносит Экстремальный Урон, он бросает d5 на Критический Результат 2 раза и выбирает один из результатов." },
    desc: "Элитный оружейный специалист легиона."
  },
  executioner: {
    name: "Палач", race: "astartes", wounds: "17+1d5", charBonus: {},
    skills:  "Intimidate или Scrutiny, Acrobatics или Athletics +10, Dodge +10 или Parry +10",
    talents: "Blade Reader или Disarm, Berserk Charge или Flesh Render, Counter Attack или Swift Attack",
    gear:    "L. Chain Weapon (до R1, Best.Q) или L. Power Weapon (до R3), 3 модификации для оружия (до R3)",
    trait: { name: "Single Combat / Бой Один На Один",
      benefit: "Когда Палач связан в рукопашной только с одним противником и без союзников, он получает +1 Успех на все успешные тесты WS, S и A, и если он проводит встречный тест на WS или A и у противника есть Трейт Unnatural Characteristic для его теста, а у Палача – нет, правило форсированной «ничьей» при проигрыше противника не применяется." },
    desc: "Мастер-дуэлянт легиона."
  },
  seeker: {
    name: "Искатель", race: "astartes", wounds: "16+1d5", charBonus: {},
    skills:  "Security или Tech-Use, Acrobatics или Stealth, Awareness +10 или Dodge +10",
    talents: "Deadeye Shot, Rapid Reload, Chamber In или Trick Shooter, Covering Fire или Hip Shooting",
    gear:    "L. Combi-Bolter или L. Storm Bolter или L. Stalker Bolter или L. Atrox Bolt Rifle, +Ammo Selector, 4 магазина болтов до R2 и 2 до R3, L. Combi-Flamer (Best.Q) или L. Combi-Melta (Good.Q) или L. Combi-Plasma или L. Auxiliary Grenade Launcher (Best.Q)",
    trait: { name: "Legionnaire Virtuoso / Легионер-Виртуоз",
      benefit: "Все стрелковое оружие легиона в руках Искателя получает дополнительный кубик на урон и отбрасывает один с наименьшим результатом, даже на альтернативных профилях (прикладом, штыком, и т.п.)" },
    desc: "Ветеран-стрелок легиона."
  },
  havoc: {
    name: "Хавок", race: "astartes", wounds: "16+1d5", charBonus: {},
    skills:  "Tech-Use, Stealth или Trade (Weaponsmith) +10, Awareness +10 или Dodge +10",
    talents: "Rapid Reload, Technical Knock, Hip Shooting или Saturation Fire",
    gear:    "L. Heavy Bolter или L. Plasma Cannon или L. Multimelta или L. Autocannon, Backpack Feed или Heavy Power Cable",
    trait: { name: "Fire Point / Огневая Точка",
      benefit: "Когда Хавок тратит Очко Бесчестия на переброс стрелковой атаки или он использовал действие Закрепление, он может перебрасывать все стрелковые атаки, пока не сдвинется с места (кроме Отскоком), заляжет, или будет сбит с ног. Он может перебрасывать стрельбу из тяжелого оружия даже с покровительством Нургла." },
    desc: "Специалист по тяжёлому оружию легиона."
  },
  apothecary: {
    name: "Апотекарий", race: "astartes", wounds: "15+1d5", charBonus: {},
    skills:  "For. Lore (Astartes Implants), Trade (Chymist), Athletics +10, Medicae +10",
    talents: "Frontline Medic, Restitching, Sure Strike, Fast Stitches или Precise Blow",
    gear:    "L. Chain Weapon (до R1), Narthecium (Good.Q), 20 Доз Химии до R1",
    trait: { name: "Legion Surgery / Хирургия Легиона",
      benefit: "Когда Апотекарий проваливает любой тест на лечение или работу с геносеменем, он может потратить Очко Бесчестия, чтобы автоматически пройти этот тест с 1 Успехом. Если он Первой помощью поднял Раны вошедшего в Замедленную Анимацию десантника до хотя бы –7, Апотекарий может потратить 1 Очко Бесчестия, чтобы пробудить его из анабиоза." },
    desc: "Боевой медик легиона."
  },
  outcast: {
    name: "Изгой", race: "astartes", wounds: "17+1d5", charBonus: {},
    skills:  "Survival +10, Acrobatics или Stealth, Commerce или Security",
    talents: "Blind Fighting или Wallop, Catfall или Iron Jaw, Combat Master или Hunker Down, Breacher или Hip Shooting",
    gear:    "L. Chain Weapon (до R1) или L. Shotgun, 8 L. Гранат или Бомб до R2, Chameleoline Cloak (Good.Q) или L. Boarding Shield (Good.Q)",
    trait: { name: "Scrounge / Наскрести",
      benefit: "Изгой может потратить смену работы и Очко Бесчестия, чтобы добыть где-то 2d10 расходных материалов (магазинов боеприпасов, гранат, химии и т.п.) до R2, украв, выбив силой у кого-то, или найдя клад. Когда у него есть излишки расходников, ГМ может потребовать, чтобы Изгой время от времени прятал часть в клады «на черный день»." },
    desc: "Одинокий волк без банды и дома."
  },
  techmarine: {
    name: "Технодесантник", race: "astartes", wounds: "17+1d5", charBonus: {},
    skills:  "Linguistics (Binary Cant), For. Lore (Mechanicus), Trade (Armourer, Weaponsmith), Tech-Use +10",
    talents: "500 xp на Техночудеса, Blessing of Steel, Mechadendrite Use (Weapon, Utility)",
    gear:    "L. Power Weapon (до R3, Good.Q), 1 Мехадендрит (R3 или R2 Good.Q), Combi-Tool (Good.Q)",
    // Стартовый Трейт «Mechanicum Implants (стр. 20)» — не снаряжение: выдаётся
    // флагом grantsImplants (apps/archetypes.mjs::grantArchetypeImplants).
    isTechpriest: true, grantsImplants: true,
    trait: { name: "Emergency Maintenance / Экстренное Обслуживание",
      benefit: "Технодесантник может потратить Очко Бесчестия и полное действие, чтобы починить повреждения оружия, брони, или снаряжения Легиона, обычно требующие до 1 смены работы." },
    desc: "Тех-адепт и мастер машин легиона."
  },
  sorcerer: {
    name: "Чародей", race: "astartes", wounds: "15+1d5", charBonus: {},
    skills:  "Psyniscience, Schol. Lore (Occult), Deceive или Scrutiny, For. Lore (Warp, Daemons and Psykers)",
    talents: "Psy Rating (×2), 500 xp на Психосилы, Meditation или Warp Sense",
    gear:    "L. Bolt Pistol, L. Force Weapon (до R4)",
    isPsyker: true, psykerClass: "bound",
    trait: { name: "Sorcerer / Чародей",
      benefit: "Чародей обладает способностью призывать силы варпа себе на службу, но каждый подобный акт не проходит бесследно. +d10 Стартового Cor. В расчёте психической силы он считается связанным." },
    desc: "Боевой псайкер легиона."
  },

  // ═══════════════════════════════ ЛЮДИ ═══════════════════════════════════
  // Сверка с книгой (глава I, Архетипы Людей) — 28.09.2026: тексты навыков/
  // Талантов/снаряжения дословно по книге (снаряжение разбирает Этап 5
  // Мастера создания: «,» — отдельные строки книги, «или» — выбор).
  apostate: {
    name: "Отступник", race: "human", wounds: "9+1d5", charBonus: { fel: 5, int: 2 },
    skills:  "Linguistics (High Gothic, True Tongue), Awareness, Charm, Command, Deceive, Inquiry, Scrutiny, Schol. Lore (любые 3), Forbidden Lore (любые 3), Dodge или Parry, Interrogate или Sleight of Hand, Intimidate или Commerce, Security или Stealth или Logic, Charm +10 или Deceive +10, Command +10 или Inquiry +10",
    talents: "Air of Authority, Hatred (любые 2), Peer (любые 2), Cover Up (суммарно на 10 Inf без траты Inf), Total Recall, Unshakeable Will, Weapon Training (любые 3), Clues From the Crowd или Light Sleeper или Unremarkable, Disturbing Voice или Field Execution или Radiant Presence, Decadence или Polyglot или Mimic, Inspire Wrath или Iron Discipline или Minion (Средний)",
    gear:    "Autopistol (Best.Q) или Laspistol (Good.Q) или Blast Pistol, Chain Weapon (до R1, Good.Q) или Power Weapon (до R2), Full Flak Armour или Mesh Armour, Cogitator (Best.Q) или Loud Hailer(Best.Q) или Hololith(Good.Q), Disguise Kit(Best.Q) или Torture Tools(Best.Q) или Unholy Tomes",
    trait: { name: "Serpent's Tongue / Змеиный Язык",
      benefit: "Когда Отступник проваливает тест социального взаимодействия, командования или допроса, он может потратить Очко Бесчестия, чтобы вместо этого преуспеть в нем на 1 Успех. При трате дополнительных Очков Бесчестия даёт +1 Успех к Усилению на социальные взаимодействия. Отступник игнорирует требования по Inf для Миньонов-людей." },
    desc: "У вас есть знания, связи, и навыки, чтобы решать задачи словом, а не насилием. Возможно раньше вы были придворным интриганом, шпионом, следователем Арбитес, или даже падшим агентом Инквизиции."
  },
  // Ключ heresiarch — исторический (на нём живые персонажи), в книге Архетип
  // называется «Демонолог».
  heresiarch: {
    name: "Демонолог", race: "human", wounds: "9+1d5", charBonus: { int: 5, wp: 2 },
    skills:  "Linguistics (Battle Cant, True Tongue), Awareness, Charm, Command+10, Deceive+10, Inquiry, Scrutiny, Schol. Lore (Occult)+10, For. Lore (Heresy, Warp)+10, For. Lore (Daemons)+20, Dodge или Parry, Interrogate или Intimidate, Inquiry +10 или Scrutiny +10",
    talents: "Erudite-Infernal, Hatred (Ecclesiarchy), Jaded, Peer (Daemons), Total Recall, Melee Training (любые 2), Weapon Training (любые 3), Scapegoat, Unholy Devotion, Minion (Высший, Демон), Foresight или Rite Puzzler или Wisdom of the Ancients",
    gear:    "Autopistol (Good.Q) или Laspistol, Runic Weapon (Примитивное, Best.Q) или Sacrificial Athame, Full Flak Armour(Good.Q) или Light Carapace, 1 Мистическое Снаряжение или Инструмент (до R3), 2×Unholy Tomes (на разные темы), Записи Ритуалов на суммарную Редкость 11 (но не выше R3 каждый)",
    trait: { name: "Dark Seer / Ведун Тьмы",
      benefit: "Он мастер запретных ритуалов, способный обращаться к потусторонним силам Варпа. Его глубокое знание тайн нерождённых позволяет гибко адаптировать методики проведения ритуалов даже в самых нестабильных условиях. Он без труда использует тонкости варпа, заменяя одну характеристику другой там, где это необходимо, чтобы повысить эффективность своих ритуалов. Демонолог может использовать I вместо W или W вместо I в тестах ритуалов, а если использует «правильную» Характеристику, он получает Преимущество на этот тест. Демонолог игнорирует требования по Inf для Миньонов-демонов." },
    desc: "Вы опытный оккультист, сведущий в темных и запретных тайнах, и способный превратить эти знания в грозное оружие."
  },
  renegade: {
    name: "Ренегат", race: "human", wounds: "10+1d5", charBonus: { bs: 5, ws: 2 },
    skills:  "Athletics, Awareness, Dodge, Parry, Common Lore (War)+10, Schol. Lore (Tactica Imperialis), Operate (Surface), Command или Intimidate, Survival или Stealth, Tech-Use или Medicae, Dodge+10 или Parry+10",
    talents: "Jaded, Quick Draw, Rapid Reload, Melee Training (любые 2), Weapon Training (любые 5), Catfall или Combat Sense, Chamber In или Double Tap или Trick Shooter, Sure Strike или Deadeye Shot или Marksman, Double Team или Disarm или Takedown, Two Weapon Wielder (любой 1) или Hip Shooting, Bayonet Charge или Covering Fire, Dragoon или Tracking Aim",
    gear:    "Lasgun (Best.Q) или Bolter (Good.Q) или Plasma Gun или Heavy Flamer, Combi-Flamer или Auxiliary Grenade Launcher или Long-Las, Laspistol (Best.Q) или Bolt Pistol (Good.Q), Chain Weapon (до R1, Good.Q) или Power Weapon (до R2), 6 Модификаций для оружия (до R2), Tempestus Carapace (Good.Q) или Xeno Mesh + Chameleoline Cloak, 4 Модификации для брони (до R2), Rebreather(Best.Q) или Magnoculars(Best.Q) или Stummer, Medkit(Best.Q) или Recoil Glove (Good.Q) или Vox Caster",
    trait: { name: "Adroit / Искусный",
      benefit: "При создании персонажа, Ренегат выбирает одну Характеристику (кроме Inf и Cor). Все успешные тесты на эту Характеристику (в т.ч. тесты на навыки через эту Характеристику) получают +1 Успех." },
    desc: "Вы опытный профессиональный солдат, возможно павший Имперский штурмовик или ветеран Гвардии, или же элитный боец одной из армий Хаоса."
  },
  pirate: {
    name: "Пират", race: "human", wounds: "10+1d5", charBonus: { ws: 5, bs: 2 },
    skills:  "Acrobatics, Awareness, Dodge+10, Parry, Stealth, Common Lore (Imperial Fleet, Tech), Operate (Aeronautica), Commerce или Intimidate, Interrogate или Security, Trade (Technomat, Voidfarer), Awareness+10 или Parry+10",
    talents: "Ambidextrous, Jaded, Quick Draw, Two Weapon Wielder (Melee, Ranged), Melee Training (любые 3), Weapon Training (любые 4), Lightning Reflexes или Drop and Roll, Catfall или Pirouette, Blind Fighting или Steady Footwork или Street Fighting, Double Team или Disarm или Takedown, Close Quarters или Plasma Expertise или Wallop, Gun Guard или Sideblade или Knife Fighter",
    gear:    "Vox-Legi Shotgun(+Pistol Grip) или Bolt Revolver или Plasma Pistol, Chain Weapon (до R1, Good.Q) или Power Weapon (до R2), Shock Weapon или Snare Gun(Good.Q) или Webber, 6 Модификаций для оружия (до R2), Xeno Mesh(+Void) + Void Suit Helmet, 3 Модификации для брони (до R2), Recoil Glove(Best.Q) или Mag-Boots (Good.Q) или Gravchute, Rebreather(Best.Q) или Photo-Visor(Best.Q) или Chem Injector (Good.Q)",
    trait: { name: "Take Everything / Забирай Всё",
      benefit: "Пират получает Преимущество на все тесты на поиск и оценку трофеев. Он может нести на себе до своего веса ношения предметов, независимо от разгрузки, считая все на удобных разгрузках." },
    desc: "Вы заработали свои навыки и славу на борту корабля. Возможно раньше вы служили в Имперском Флоте, флоте Вольного Торговца, или же на корабле одной из банд Хаоса."
  },
  savage: {
    name: "Дикарь", race: "human", wounds: "11+1d5", charBonus: { t: 5, s: 2 },
    skills:  "Acrobatics, Athletics, Awareness, Dodge, Navigation (Surface)+10, Parry+10, Survival+10, Schol. Lore (Beasts), Command/Commerce/Intimidate, Interrogate или Scrutiny, Stealth или Sleight of Hand, Awareness+10 или Athletics+10",
    talents: "Frenzy, Heightened Senses (любые 2), Quick Draw, Skilled Rider, Battle Rage, Resistance (любые 2), Melee Training (любые 4), Weapon Training (любые 3), Catfall/Iron Jaw, Defensive Rider/Trot, Blind Fighting/Bodyguard/Steady Footwork, Disarm/Takedown/Sure Strike, Double Team/High Guard/Unarmed Warrior, Cleave/Tenacity/Wrestler",
    gear:    "3 стандартных Примитивных рукопашных или Примитивных стрелковых оружия (Best.Q), 6 Throwing Knife (+Mono) или 6 Throwing Axe (+Mono), Chain Weapon (до R1, Good.Q) или Power Weapon (до R2), 9 Модификаций для оружия (до R2), Xeno Hides + Jack Chains (Best.Q) + Carapace Helm, Скакун до R1 и набор брони до R1(базово) для него",
    trait: { name: "Survivor / Выживальщик",
      benefit: "Когда Дикарь проваливает не-атакующий тест S, T, A или P, он может потратить Очко Бесчестия, чтобы вместо этого преуспеть в нем на 1 Успех. Дикарь игнорирует требования по Inf для Миньонов-зверей." },
    desc: "Вы мастер выживания вне цивилизации, будь то дикие джунгли миров смерти, или выжженные токсичные пустоши между ульями и кузницами индустриальных миров."
  },
  noble: {
    name: "Благородный", race: "human", wounds: "11+1d5", charBonus: { ag: 5, fel: 2 },
    skills:  "Linguistics (High Gothic), Acrobatics, Athletics, Awareness, Charm, Dodge+10, Parry+10, Schol. Lore (Heraldry), Command или Intimidate, Logic или Tech-Use, Stealth или Survival, Acrobatics+10 или Athletics+10",
    talents: "Flip, Peer (Nobility), Quick Draw, Sure Strike, Deflect Shot, Swift Attack, Melee Training (любые 3), Weapon Training (любые 4), Ambidextrous/Leap Up, Catfall/Pirouette, Minion (Низший, Человек)/Radiant Presence, Blind Fighting/Decadence/Jaded, Exotic Weapon Training (1 любое)/Takedown/Disarm, Counter Attack/Precise Blow/Two Weapon Wielder (Melee)",
    gear:    "2 Любых рукопашных оружия R1(Best.Q) или R2(Good.Q) или R3, Hotshot Pistol(Best.Q) или Orthlak Duel Revolver(Good.Q) или Needler Pistol, Digital Laser(Good.Q) или Digital Plasma или Digital Needler, 9 Модификаций для оружия (до R3), Tempestus Carapace(Best.Q) или Light Power Armour(Good.Q), 5 Модификаций или Систем для брони (до R3)",
    trait: { name: "Noble Eugenics / Благородная Евгеника",
      benefit: "При создании персонажа, Благородный выбирает 2 Характеристики – они становятся дружественными в плане продвижений, и остаются таковыми, невзирая на его Покровительства." },
    desc: "Вы происходите из рода Имперских или Хаоситских аристократов, Рыцарского дома, или династии Вольного Торговца, что обеспечило вас лучшим образованием, что можно купить за деньги, и отменной родословной."
  },

  // ═══════════════════════════════ МЕХАНИКУС ══════════════════════════════
  skitarii: {
    name: "Скитарий", race: "mechanicus", wounds: "11+1d5", charBonus: { per: 5, t: 2 },
    grantsWarPlate: true,
    skills:  "Linguistics (Binary Cant), Athletics, Awareness+10, Dodge, Parry, Tech-Use, Common Lore (War, Tech), Operate (Aeronautica, Surface), Command или Intimidate, Security или Stealth, Dodge+10 или Parry+10",
    talents: "Combat Sense, Cold Hearted, Jaded, Quick Draw, Rapid Reload, Melee Training (любые 2), Weapon Training (любые 3), Exotic Weapon Training (любые 3), Ambidextrous/Technical Knock, Bodyguard/Disarm/Double Team, Die Hard/Iron Jaw/Orthoproxy, Sure Strike/Deadeye Shot/Marksman, Two Weapon Wielder (любой 1)/Scanning Advance, Reposition/Hunker Down",
    gear:    "Radium Carbine (Best.Q) или Galvanic Rifle (Best.Q) или Arc Rifle, Radium Pistol (Best.Q) или Flechette Blaster (Good.Q) или Phosphor Pistol, Taser Goad(Good.Q) или Transonic Blade(Good.Q) или Power Weapon (до R2), 7 Модификаций для оружия (до R2), Skitarii War Plate (нельзя поменять), 2 Модуля Кибернетики Скитарии (R1,Good.Q или R2), +1 к Качеству 3-х предметов",
    trait: { name: "Data Acquisition / Получение Данных",
      benefit: "Скитарий получает Преимущество на все тесты Awareness." },
    desc: "Вы техно-страж Механикум, волей случая, или под действием накопленной порчи, вырвавшийся из цифровых пут своих господ."
  },
  heretek: {
    name: "Еретех", race: "mechanicus", wounds: "12+1d5", charBonus: { int: 5, t: 2 },
    grantsImplants: true, isTechpriest: true,
    skills:  "Linguistics (Binary Cant), Logic, Tech-Use+10, Awareness или Medicae, Dodge или Parry, Commerce или Security, Com. Lore (Tech)+20, For. Lore (Mechanicum)+10, For. Lore (Archeotech/Xenos/Warp), Schol. Lore (Chymistry/Numerology), Trade (Armourer, Weaponsmith), Trade (Engineer/Chymist)",
    talents: "750 xp на Техночудеса, Die Hard, Technical Knock, Weapon Training (любые 4), Exotic Weapon Training (любые 1), Mechadendrite Use (Weapon, Utility), Apocrypha Coil/Virtual Memory, Meditation/Total Recall, Armour-Monger/Weapon-Tech, Minion (Низший, Машина)/Cold Hearted",
    gear:    "Hotshot Pistol (Good.Q) или Bolt Pistol или Phosphor Blast Pistol, Poleaxe (Best.Q +Mono) или Power Axe или Arc Maul, Enforcer Carapace + Vulcanized Cloak, 4 Бионики или Кибернетики (до R2, Good.Q или до R1 Best.Q), 3 Кибернетики Механикум (до R2), 2 Мехадендрита (R3 или R2 Good.Q или R1 Best.Q), Cogitator(Best.Q) + Retinal Display, Combi-Tool (Good.Q)",
    trait: { name: "Master of Machines / Повелитель Машин",
      benefit: "Еретех игнорирует требования по Inf для Миньонов-машин." },
    desc: "Вы один из жрецов Бога-Машины: либо предатель и беглец из Адептус Механикус Марса, либо адепт Темных Механикум Хаоса."
  },

  // ════════════════════════════════ ПСАЙКЕРЫ ══════════════════════════════
  witch: {
    name: "Ведьма", race: "human", wounds: "8+1d5", charBonus: { wp: 5, per: 2 },
    isPsyker: true, psykerClass: "unbound",
    skills:  "Awareness, Psyniscience, For. Lore (Warp, Daemons and Psykers), Deceive или Intimidate, Dodge или Parry",
    talents: "Psy Rating (×3), 1000хр на Психосилы, Jaded, Warp Sense, Weapon Training (Primary), Weapon Training (Las/SP/Shock), Child of the Warp или Sacrifice",
    gear:    "Laspistol (+Mono)/Stub Revolver, Sword (Good.Q)/Neural Whip, Knife (+Mono), Flak (Uniform + Flak Vest), Psy-focus",
    trait: { name: "Chaos Psyker / Псайкер Хаоса",
      benefit: "Получает Трейт Psyker с PR3 и +1d5 Cor. В расчёте психической силы считается Несвязанным." },
    desc: "Свободный псайкер, развивший дары без Имперского Санкционирования."
  },
  renegadePsyker: {
    name: "Псайкер", race: "human", wounds: "7+1d5", charBonus: { wp: 10, int: -3 },
    isPsyker: true, psykerClass: "bound",
    skills:  "Awareness, Psyniscience+10, Schol. Lore (Occult), For. Lore (Warp, Daemons and Psykers)+10, Dodge или Parry",
    talents: "Psy Rating (×2), 1000хр на Психосилы, Jaded, Warp Sense, Weapon Training (Primary), Resistance (Psychic Powers), Strong Minded или Warp Whisper",
    gear:    "Force Staff, Knife (+Mono), Flak Uniform",
    trait: { name: "Imperial Sanctioning / Имперское Санкционирование",
      benefit: "Получает Трейт Psyker с PR2 и +1 Cor. Считается Связанным. Тратит Очко Бесчестья для переброса Феномена, если он вызвал Прорыв. Начинает со случайным ментальным расстройством (тяжесть не ниже −2)." },
    desc: "Беглец, переживший ужасы Имперского Санкционирования, сохранив рассудок."
  },
  numen: {
    name: "Нумен", race: "human", wounds: "10+1d5", charBonus: {},
    charChoice: "+5 к одной Характеристике и +2 к другой (по выбору)",
    skills:  "Awareness, Dodge, Parry, Common Lore (любые 2), Schol. Lore (любые 2), For. Lore (любые 2), Acrobatics или Athletics, Charm или Intimidate, Medicae или Tech-Use, Stealth или Security",
    talents: "Jaded, 12 Талантов 1 уровня, 2 Таланта 2 уровня",
    gear:    "2 любых рукопашных оружия R0(Best.Q)/R1(Good.Q)/R2, 1 любое стрелковое R0(Best.Q)/R1(Good.Q)/R2, Полный комплект брони R0(Best.Q)/R1(Good.Q)/R2, 6 модификаций для оружия (до R2), 3 модификации для брони (до R2)",
    trait: { name: "Divinely Gifted / Божественно Одарённый",
      benefit: "Выбирает 1 дополнительную мутацию/субмутацию (кроме Доспеха Богов и Знания Веков). На покровительстве Бога может вместо этого выбрать 1 Дар. + Fated Path: берёт Элитный Архетип по базовой цене, не повышая цену других Элитных." },
    desc: "У Богов на вас большие планы — и они не спрашивают согласия."
  },

  // ═══════════════════════ АЗУРИАНЕ — ОТСТУПНИКИ ═══════════════════════════
  aelEshairr: {
    name: "Эшаирр (Рейнджер)", race: "azuriane", group: "Отступники",
    charBonus: { bs: 5 }, charChoice: "+2 к одной Характеристике (на выбор)",
    infRoll: "3d5+10", requiredPath: "Путь Изгоя",
    trait: { name: "Preferred Strike / Предпочтительный Удар",
      benefit: "Доп. куб урона для переброса за каждый −10 от Сочленений цели (макс 3). Талант-снижение штрафа не уменьшает кубы. До ½ P.b раз/битву. Только Винтовка+." },
    desc: "Виртуоз дальнего боя, мастер своей винтовки."
  },
  aelAnherit: {
    name: "Анхерит (Наёмник)", race: "azuriane", group: "Отступники",
    charBonus: { fel: 3 }, charChoice: "+3 к WS или BS (на выбор)",
    infRoll: "3d5+16", requiredPath: "Путь Изгоя",
    trait: { name: "Adaptive Xenos / Адаптивный Ксенос",
      benefit: "В людском облике (шлем/капюшон + не-эльдарская броня/плащ >70%) и на Низком Готике — нет штрафов на общение с людьми. Не докупает владение имперским оружием при наличии эльдарского аналога; не повышает редкость имперского снаряжения и пользуется без подгонки (кроме бионики/аугментики/силовой брони)." },
    desc: "Эльдар, привыкший к людским армиям."
  },
  aelAnrathe: {
    name: "Анратхе (Корсар)", race: "azuriane", group: "Отступники",
    charBonus: { t: 5 }, charChoice: "+3 к WS или BS (на выбор)",
    infRoll: "3d5+10", requiredPath: "Путь Изгоя или Путь Мореплавателя",
    trait: { name: "Bragging Wealth / Бахвальное Богатство",
      benefit: "+15 на оценку ценности, поиск трофеев и взлом замков. При провале поиска ценностей — находит 1d5+1 расходников. До I.b вещей всегда в Удобной разгрузке; их можно доставать/возвращать 3 раза/битву за Свободное действие. Только эльдарское снаряжение и предметы с Compact, не Тяжёлое." },
    desc: "Корсар, кичащийся своим богатством."
  },
  aelBrathai: {
    name: "Братхай (Дипломат)", race: "azuriane", group: "Отступники",
    charBonus: { fel: 5 }, charChoice: "+2 к одной Характеристике (на выбор)",
    infRoll: "3d5+13", requiredPath: "Путь Изгоя или Путь Дипломата",
    trait: { name: "Lying Speech Of A Liar / Лживые Речи Лжеца",
      benefit: "Преимущество на соц. тесты, пока собеседник не знает, что он эльдар (или относится нейтрально/положительно). Может «обращать» броски Deceive (менять местами десятки/единицы). Провал Deceive/Scrutiny против него даёт ему +1 успех на соц. тесты против этого существа на неделю (не складывается)." },
    desc: "Мастер обмана и красноречия."
  },
  aelManuidra: {
    name: "Мануидра (Ассасин)", race: "azuriane", group: "Отступники",
    charBonus: { ag: 3, ws: 3 },
    infRoll: "3d5+10", requiredPath: "Путь Изгоя или Путь Жалящего Скорпиона",
    trait: { name: "Experimental Serum / Экспериментальная Сыворотка",
      benefit: "Может создавать Яды и Наркотики с вектором Рана/Инъекция из любых других, повышая редкость итогового (по усмотрению ГМа)." },
    desc: "Мастер ядов и токсинов."
  },
  aelDhan: {
    name: "Дхан (Лидер)", race: "azuriane", group: "Отступники",
    charBonus: { fel: 5, int: 2 },
    infRoll: "4d5+13", requiredPath: "Путь Изгоя или Путь Дипломата",
    trait: { name: "Master of Minds of Mon-Keigh / Повелитель Разумов Мон-Кей",
      benefit: "Если Люди под его командованием не знают его природы (или признают лидером) — за Очко Судьбы даёт им Fearless (с инстинктом самосохранения) до конца Битвы/Сцены. Игнорирует требования по характеристикам для Миньона-Человека." },
    desc: "Манипулятор разумами низших рас."
  },
  aelRiossaibha: {
    name: "Риоссаибха (Пустотный Мечтатель)", race: "azuriane", group: "Отступники",
    charBonus: { wp: 10, per: 3 }, charChoice: "−5 к WS, BS или I (на выбор)",
    infRoll: "4d5+10", requiredPath: "Путь Изгоя или Путь Мореплавателя",
    trait: { name: "Lord of the Streams / Владыка Потоков",
      benefit: "Тест W−30: проводит суда Эльдар сквозь потоки Варпа (быстрее имперских прыжков, но на короткие дистанции/множество коротких). Navigation Stellar и Warp может использовать через W или P." },
    desc: "Проводник кораблей сквозь Варп без глубоких пси-навыков."
  },

  // ═══════════════════ АЗУРИАНЕ — ЖИТЕЛИ МИРА-КОРАБЛЯ ═══════════════════════
  aelAethLira: {
    name: "Аэтх-Лира (Принц)", race: "azuriane", group: "Жители Мира-Корабля",
    charBonus: { ag: 5, fel: 3 },
    infRoll: "4d5+16", requiredPath: "Любой (нужен талант Lost Nobility)",
    trait: { name: "The Blood of Heroes / Кровь Героев",
      benefit: "Раз/битву за Свободное действие тест W+10: при успехе — Unnatural Characteristic (+1) на выбор до конца битвы. Можно сменить раз/битву за Свободное действие тестом W−10." },
    desc: "Достопочтенный Принц с кровью древних героев."
  },
  aelEsdainn: {
    name: "Эсдаинн (Варлок)", race: "azuriane", group: "Жители Мира-Корабля",
    charBonus: { wp: 6, ws: 2 },
    infRoll: "3d5+10", requiredPath: "Путь Варлока",
    trait: { name: "The Inevitable / Неизбежное",
      benefit: "При попадании в рукопашной за Очко Судьбы — состязание W+20 vs W+0; при успехе все атаки им и союзниками по этой цели в след. раунде получают +½ тPR (окр.▼) успехов. Не повторять на той же цели за бой." },
    desc: "Псайкер-воин, обрекающий врагов на гибель."
  },
  aelIdainn: {
    name: "Идаинн (Провидец)", race: "azuriane", group: "Жители Мира-Корабля",
    charBonus: { wp: 10, int: 3, s: -5 },
    infRoll: "4d5+16", requiredPath: "Путь Провидца",
    trait: { name: "The Predicted Solution / Предсказанное Решение",
      benefit: "Раз/раунд, когда враг избегает его атаку или он промахнулся — реакция + тест W−30 (как манифестация): превращает свои провалы в успехи, а успехи врага в провалы." },
    desc: "Провидец, видящий ход событий наперёд."
  },
  aelTainn: {
    name: "Таинн (Духовидец)", race: "azuriane", group: "Жители Мира-Корабля",
    charBonus: { wp: 7, int: 3 }, charChoice: "−5 к WS или BS (на выбор)",
    infRoll: "3d5+10", requiredPath: "Путь Духовидца",
    trait: { name: "The Silent Guard / Безмолвная Стража",
      benefit: "Игнорирует требования по характеристикам для Миньонов-машин из психокости; погибшего миньона воскрешает за смену. Стартовые миньоны — Призрачные Воители. Раз/сессию за Очко Судьбы — воскресить павшего миньона с полным хитами." },
    desc: "Повелитель психокостяной стражи."
  },
  aelIrikiar: {
    name: "Ирикиар (Воин Храма)", race: "azuriane", group: "Жители Мира-Корабля",
    charBonus: {}, charChoice: "+5 и +2 к WS/BS/S/T/I (по выбору)",
    infRoll: "2d5+10", requiredPath: "Путь Воина",
    trait: { name: "Dedication to the Shrine / Приверженность Храму",
      benefit: "В начале сессии избирает один Путь Воина и одну Характеристику (кроме Inf/Cor): все успешные тесты на неё +1 Успех. +20 на обслуживание оружия/брони выбранного Аспекта." },
    desc: "Воин Аспектного Храма."
  },
  aelVeavarath: {
    name: "Веаваратх (Певец Кости)", race: "azuriane", group: "Жители Мира-Корабля",
    charBonus: { fel: 3, wp: 3, int: 3 },
    infRoll: "3d5+9", requiredPath: "Путь Певца Кости",
    trait: { name: "A Thousand Songs / Тысяча Песен",
      benefit: "При провале теста крафта — за Очко Судьбы вместо этого преуспеть на F.b успехов. Игнорирует требования по характеристикам для Миньонов-машин из психокости." },
    desc: "Меланхоличный мастер психокости."
  },
  aelAeldarii: {
    name: "Аэльдарии (Гражданин)", race: "azuriane", group: "Жители Мира-Корабля",
    charBonus: {}, charChoice: "+6 к одной Характеристике, +3 к другой (по выбору)",
    infRoll: "1d5+5", requiredPath: "Любой",
    trait: { name: "Just Civilian / Просто Гражданский + Взор Судьбы",
      benefit: "Знает 2 Пути на выбор (можно начать следовать в любой момент). +1 Очко Судьбы к максимуму; избирает Элитный Архетип, сохраняющий цену; Сжечь Судьбу — снизить его цену на 1500 (мин. 500); избранные Элитные не требуют учителей/обучения." },
    desc: "Обычный гражданин с минимальными боевыми навыками, но под взором Богов."
  },

  // ─────────────────────────── ДРУКХАРИ ───────────────────────────
  drFreebooter: {
    name: "Вольный Стрелок", race: "drukhari", group: "Друкхари",
    drukhariSubraces: ["", "truebornDrukhari", "wrack"], sslythAccess: true,
    skills:  "Athletics+10, Awareness+10, Common Lore (War)+10, Medicae+10, Stealth+10, Tech-Use, Tech-Use+10 или Dodge+10, Trade (Armourer) или Trade (Weaponsmith)",
    talents: "Ambidextrous, Cold Hearted, Combat Sense, Bodyguard или Disarm или Double Team, Chamber In или Double Tap или Trick Shooter, Quick Draw или Rapid Reload, Die Hard или Iron Jaw, Sure Strike или Deadeye Shot или Marksman, Two Weapon Wielder (любой 1) или Reposition",
    gear:    "Splinter Rifle (Good.Q) или Splinter Pistol; 1 любое стрелковое оружие R0 (Best.Q) или R1 (Good.Q) или R2; 2 Hekatrix Blade (Best.Q)",
    charBonus: { ws: 3, bs: 3 }, infRoll: "3d5+16", wounds: "10+1d5",
    trait: { name: "Fully Armed / Во Всеоружии",
      benefit: "Не-тяжёлое оружие с модом Custom Grip на разгрузках считается удобным; −1 ОД (до ½) к перезарядке, +1 надёжность и ½ веса такого оружия." },
    desc: "Наёмное оружие Комморага, мастер своего арсенала."
  },
  drAssassin: {
    name: "Убийца", race: "drukhari", group: "Друкхари",
    drukhariSubraces: ["", "truebornDrukhari", "mandrake", "wrack"], sslythAccess: true,
    skills:  "Acrobatics+20, Athletics, Deceive, Dodge+10, Forbidden Lore (Underworld)+10, Stealth+10, Survival+10, Tech-Use, Interrogate или Sleight of Hand",
    talents: "Ambidextrous, Backstab, Blind Fighting, Blade Juggler, Cold Hearted, Close Quarters, Combat Sense, Knife Fighter или Riding the Momentum, Reposition или Preternatural Speed",
    gear:    "2 Hekatrix Blade (Best.Q); 2 Punch Dagger (Best.Q); Wychsuit (Good.Q)",
    charBonus: { ag: 3, per: 3 }, infRoll: "4d5+13", wounds: "10+1d5",
    trait: { name: "Quiet Elimination / Тихое Устранение",
      benefit: "Атака врасплох: +1 куб урона, цель гибнет беззвучно. Только ножи/игольчатые/осколочные пистолеты — +10 к атаке." },
    desc: "Ловкий убийца с улиц Тёмного Города."
  },
  drOutcast: {
    name: "Неприкаянный", race: "drukhari", group: "Друкхари",
    drukhariSubraces: ["", "truebornDrukhari", "mandrake", "wrack"], sslythAccess: true,
    skills:  "Awareness+10, Dodge+10, Parry+10, Common Lore (любые 2), Scholastic Lore (любое 1), Forbidden Lore (любое 1), Acrobatics+20 или Athletics+10, Charm+10 или Intimidate+10, Medicae+10 или Tech-Use+10, Stealth+10 или Security+10",
    talents: "7 талантов 1 уровня, 2 таланта 2 уровня, 1 талант 3 уровня (на выбор)",
    gear:    "1 любое рукопашное оружие R0 (Best.Q) или R1 (Good.Q) или R2; 1 любое стрелковое оружие R0 (Best.Q) или R1 (Good.Q) или R2",
    charBonus: { t: 3, s: 3 }, infRoll: "1d5+5", wounds: "11+1d5",
    trait: { name: "Couldn't Hurt / Не Помешает",
      benefit: "В начале сессии находит 1d5+P.b расходников. +20 на поиск ценного/спрятанного у погибших. Обычно недоступны Кабал/Культ/Ковен." },
    desc: "Скиталец со дна Комморага, ищущий своё место."
  },
  drCourtier: {
    name: "Придворный", race: "drukhari", group: "Друкхари",
    drukhariSubraces: ["truebornDrukhari"], sslythAccess: false,
    skills:  "Charm+10, Command+10, Common Lore (Intrigue)+10, Deceive+10, Forbidden Lore (Underworld)+10, Interrogate+10, Scrutiny+10, Command+20 или Charm+20, Interrogate+20 или Scrutiny+20",
    talents: "Air of Authority, Clues from the Crowds, Face in a Crowd, Mimic, Peer (3 организации на выбор), Pity the Weak, Radiant Presence, Minion (Высший, Человек, ×2)",
    gear:    "Splinter Swarm Pistol; Loud Hailer (Best.Q); Translator Rod (Best.Q); Disguise Kit (Good.Q)",
    charBonus: { fel: 5, t: -3 }, infRoll: "4d5+16", wounds: "9+1d5",
    trait: { name: "Sophisticated Speech / Утончённая Речь",
      benefit: "+15 на соц. тесты при знании фракции собеседника (+10). Может потратить 1 Очко Боли, чтобы преуспеть в провальном соц. тесте против друкхари (×2 против Архонта)." },
    desc: "Посол меж звеньями Комморага (доступен Истиннорождённому)."
  },
  drDuelist: {
    name: "Дуэлянт", race: "drukhari", group: "Друкхари",
    drukhariSubraces: ["", "truebornDrukhari"], sslythAccess: true,
    skills:  "Athletics+10, Awareness+10, Common Lore (War)+10, Dodge+10, Parry+10, Command+10 или Intimidate+10, Dodge+20 или Parry+20, Survival+10 или Stealth+10",
    talents: "Bodyguard, Blade Binding, Disarm, Leap Up, Quick Draw, Reaper, Steady Footwork, Sure Strike, Blade Reader или Deflect Shot",
    gear:    "Monomolecular Blade (Best.Q); 3 модификации для оружия (до R3)",
    charBonus: { ws: 3, ag: 3 }, infRoll: "3d5+12", wounds: "10+1d5",
    trait: { name: "Sophisticated Combat / Утончённый Бой",
      benefit: "+1 успех на WS/A при числ. превосходстве врага; переброс WS/A в бою 1-на-1. Если WS противника ниже — Unnatural WS (+1)." },
    desc: "Мастер клинка с очень дорогим оружием."
  },
  drPitFighter: {
    name: "Боец Ямы", race: "drukhari", group: "Друкхари",
    drukhariSubraces: ["", "truebornDrukhari", "mandrake", "wrack"], sslythAccess: true,
    skills:  "Athletics+20, Acrobatics+20, Awareness+10, Dodge+10, Parry+10, Survival+10 или Stealth+10",
    talents: "Die Hard, Everything a Weapon, Headcracker, Iron Jaw, Precise Blow, Roundhouse Kick, Street Fighting, Sure Strike, Whack",
    gear:    "Xenohide Tunic (Best.Q) или Wychsuit (Best.Q); 1 любое рукопашное оружие R2 или 2 любых рукопашных R0; 1 любое стрелковое оружие R2 или 2 любых стрелковых R0",
    charBonus: { ws: 3, ag: 3 }, infRoll: "3d5+14", wounds: "11+1d5",
    trait: { name: "The Old Days / Старые Деньки",
      benefit: "Обезоружив противника — сразу безоружный удар. +20 vs Snare/Monofilament. Переброс физ. избегания против зверей/чудовищ. Элитный архетип Гладиатор стоит на 1000 опыта дешевле, и его покупка не увеличивает цену других элитных архетипов." },
    desc: "Гладиатор арен, разорвавший свои оковы."
  },
  drAlchemist: {
    name: "Алхимик", race: "drukhari", group: "Друкхари",
    drukhariSubraces: ["", "truebornDrukhari", "wrack"], sslythAccess: false,
    skills:  "Tech-Use+10, Medicae+10, Scholastic Lore (Chymistry)+10, Tech-Use+20 или Medicae+20, Trade (Weaponsmith) или Trade (Armourer), Trade (Chymist)+10 или Trade (Stylist)+10, 1 Scholastic Lore на выбор",
    talents: "But a Scratch, Degustator, Fast Stitches, Restitching, Snake Eater, Deadeye Shot или Sure Strike",
    gear:    "Drukhari Pistol Needler (Good.Q) или Drukhari Autogun (Best.Q); Surgical Kit (Best.Q) или Chemical Laboratory (Best.Q) или Chemistry Analyzer (Best.Q); 20 доз друкхарийской химии до R1; 10 единиц химических реагентов; 3 рецепта Алхимии R1 и 1 рецепт R2, или 3 генетических шаблона R1 и 1 генетический шаблон R2; 4 биоимпланта (до R2 Good.Q или до R1 Best.Q) или Enzyme Vat (Good.Q, 2-й эффект)",
    charBonus: { int: 3, t: 3 }, infRoll: "3d5+13", wounds: "9+1d5",
    trait: { name: "It Won't Hurt… / Будет Не Больно…",
      benefit: "Первая Помощь без анестезии: цель получает 1d5 Усталости, но восстанавливает столько же Ран; Алхимик получает 1 Очко Боли. Имея друкхарийскую аптечку или лучшие инструменты, может тестом Medicae(I)−20−5×Отрицательные Раны воскресить только что аккуратно убитое тело. Жертва получает 3d10 урона во все характеристики и даёт Алхимику 2 Очка Боли +1 за каждую характеристику, упавшую до 0. Если T жертвы упало до 0, она не погибает, а входит в агонизирующее состояние: нескончаемая боль во всём теле без потери сознания." },
    desc: "Хирург и мастер алхимических таинств Комморага."
  },
  drKabalite: {
    name: "Кабалит", race: "drukhari", group: "Друкхари",
    drukhariSubraces: ["", "truebornDrukhari", "wrack"], sslythAccess: false,
    skills:  "Athletics+10, Awareness+10, Common Lore (War)+10, Common Lore (любой 1), Dodge+10, Parry+10, Dodge+20 или Parry+20",
    talents: "Ambidextrous, Cold Hearted, Combat Sense, Bodyguard или Disarm или Double Team, Chamber In или Double Tap или Trick Shooter, Quick Draw или Rapid Reload, Sure Strike или Deadeye Shot или Marksman, Two Weapon Wielder (любой 1) или Reposition",
    gear:    "Splinter Rifle (Best.Q) или Blaster",
    charBonus: { ws: 3, bs: 3 }, infRoll: "3d5+15", wounds: "11+1d5",
    trait: { name: "Reliable Soldier / Надёжный Вояка",
      benefit: "Выбирает по одному типу рукопашного и стрелкового оружия: +2 Dmg, +1 Pen, +1 надёжность." },
    desc: "Воин под стягом одного из кабалов Комморага."
  },

  hqMime: {
    name: "Феис-Дистаур (Младший Мим)", race: "harlequin", group: "Арлекины",
    charBonus: {}, infRoll: "",
    trait: { name: "Performance / Выступление (талант)",
      benefit: "Раз в раунд — Реакция + Очко Судьбы: +A.b к поглощению урона до начала следующего хода. Талант (Скл. A/Fin; требование — Арлекин)." },
    desc: "Мимы — арлекины, ещё не определившиеся с ролью; берут числом и проворством. Старт. характеристики: WS 30, BS 30, S 25, T 25, Ag 35, Int 35, Per 35, WP 35, Fel 35 (Inf — особая). Бонусные Броски 2, Бонусные Очки 15, Смещение Характеристик 2. Очки Судьбы: 1d10 (1–3→1, 4–6→2, 7–9→3, 10→4). Навыки: Acrobatics+20, Athletics, Awareness, Common Lore (Fian + любые 3), Forbidden Lore (SercamBelach+20, Rillietann+20), Linguistics (LamEldannar (Harlequins)+10, Low Gothic), Trade (Calligraphy/Carpenter/Dancer/Instructor/Jeweler/Mason/Musician/Stylist)+10, Survival, Stealth. Таланты: Ambidextrous, Catfall, Combat Master, Dexterity Technique, Dexterous Fighter, Disarm, Eldar Weapon Training, Eldanesh Technique, Exotic Weapon Training (5), Fast And Swift, Flip, Heightened Senses (×3), Jaded, Jumper, Nimble Blade, Pirouette, Preternatural Speed, Precise Blow, Rapid Reload, Speed Awareness, Sprint, Sure Strike, Two Weapon Wielder (Both), Ultanesh Technique. Снаряжение: 3 предмета снаряжения/инструментов до R1 (3 Good.Q + 1 Best.Q или 2 Best.Q), Agaith, Dathedhi, Geirgilath."
  }

};
