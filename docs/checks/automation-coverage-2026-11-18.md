# Замер автоматизации Черт, Талантов и Навыков (2026-11-18)

Собрано `node tools/automation-coverage.mjs --md`. Корзины описаны в шапке инструмента.

## Итог

| | Всего | Работает | Частично | Памятка | Заглушка | Только текст |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **Все** | 1676 | 800 (48%) | 10 | 132 | 3 | 731 |
| talents: общие | 637 | 432 (68%) | 7 | 0 | 0 | 198 |
| talents: элитные архетипы | 343 | 58 (17%) | 1 | 0 | 2 | 282 |
| traits: общие | 262 | 212 (81%) | 1 | 34 | 1 | 14 |
| traits: элитные архетипы | 187 | 65 (35%) | 1 | 98 | 0 | 23 |
| aeldari-talents: общие | 0 | 0 (—) | 0 | 0 | 0 | 0 |
| aeldari-talents: элитные архетипы | 164 | 11 (7%) | 0 | 0 | 0 | 153 |
| aeldari-traits: общие | 7 | 0 (0%) | 0 | 0 | 0 | 7 |
| aeldari-traits: элитные архетипы | 76 | 22 (29%) | 0 | 0 | 0 | 54 |
| **Есть у персонажей мира** | 169 | 140 (83%) | 2 | 3 | 0 | 24 |

## Почему «только текст»

| Причина в заметке | Записей |
| --- | ---: |
| условие или триггер | 560 |
| своя причина (см. заметку) | 103 |
| трата ресурса (Судьба, Бесчестие, Реакция…) | 54 |
| действует на других | 6 |
| меняет конкретный предмет | 6 |
| новая способность или действие | 2 |

## Не работают, но есть у персонажей мира

Сортировка по числу персонажей. Это очередь шага 2 плана.

| Запись | Тип | Корзина | Персонажей | Группа |
| --- | --- | --- | ---: | --- |
| Disarm / Обезоружить | Талант | только текст | 17 | talents / Рукопашные |
| Trick Shooter / Стрелок-Трюкач | Талант | только текст | 6 | talents / Стрелок |
| Mechadendrite Use / Использование Мехадендритов | Талант | только текст | 4 | talents / Механикум |
| Frontline Medic / Фронтовой Медик | Талант | только текст | 3 | talents / Медик |
| Total Recall / Идеальная Память | Талант | только текст | 3 | talents / Мудрец |
| Meditation / Медитация | Талант | только текст | 2 | talents / Псайкана |
| Warp Sense / Варп-Чутьё | Талант | только текст | 2 | talents / Псайкана |
| Light Sleeper / Чуткий Сон | Талант | только текст | 1 | talents / Внимательность |
| Roadkill / Переехать | Талант | частично | 1 | talents / Всадник |
| Comprehension of the Engine / Постижение двигателя | Талант | только текст | 1 | talents / Книга Пустоты |
| Omnissian Congregator / Омниссианский конгрегатор | Талант | только текст | 1 | talents / Книга Пустоты |
| Patching the Sacred Frame / Латание священного корпуса | Талант | только текст | 1 | talents / Книга Пустоты |
| Vox Silence / Вокс-тишина | Талант | только текст | 1 | talents / Книга Пустоты |
| Pity of Warp / Жалость варпа | Талант | только текст | 1 | talents / Книга Пустоты |
| Preservation of an Undefiled Spirit / Сохранение неосквернённого духа | Талант | только текст | 1 | talents / Книга Пустоты |
| Locum / Локум | Талант | только текст | 1 | talents / Крафт |
| Safety Precautions / Техника Безопасности | Талант | только текст | 1 | talents / Крафт |
| War Chant / Боевая Песнь | Талант | частично | 1 | talents / Лидерство |
| Triage / Триаж | Талант | только текст | 1 | talents / Медик |
| Cyber-Mantle Calibration / Калибровка Кибер-Мантии | Талант | только текст | 1 | talents / Механикум |
| Minion of Chaos / Миньон Хаоса | Талант | только текст | 1 | talents / Миньоны |
| Wisdom of the Ancients / Мудрость Древних | Талант | только текст | 1 | talents / Мудрец |
| Scapegoat / Козёл Отпущения | Талант | только текст | 1 | talents / Оккультист |
| Mind Killer / Убийца Разума | Талант | только текст | 1 | talents / Смелость |
| Clues from the Crowds / Разговор с Толпой | Талант | только текст | 1 | talents / Социальные |
| Polyglot / Полиглот | Талант | только текст | 1 | talents / Социальные |
| Noble Eugenics / Благородная Евгеника | Черта | памятка в чат | 1 | traits / (корень) |
| Graceful Giant / Изящный Гигант | Черта | памятка в чат | 1 | traits / Элитные архетипы / Чемпион Терминатор |
| Legendary Plate / Легендарные Латы | Черта | памятка в чат | 1 | traits / Элитные архетипы / Чемпион Терминатор |

## У персонажей, но не из компендиумов Черт и Талантов

62 названий: Черты рас, легионов и Происхождений, переименованные копии и самодельные записи. В корзины выше не входят.

- Unnatural Strength (4) / Сверхъестественная Сила (4) — 93
- Unnatural Toughness (4) / Сверхъестественная Стойкость (4) — 93
- Size (1) / Размер (1) — 92
- Культура: XVII Несущие Слово — 79
- Геносемя: XVII Несущие Слово — 77
- Bolter Virtuoso / Болтерный Виртуоз — 13
- Fiery Faith /Пламенная вера — 8
- Absolute faith in the past /Абсолютная вера в прошлое — 7
- Bliss of Reason /Нега разума — 6
- Raised in Labor /Выросший в труде — 5
- Old Ways /Старые пути — 5
- Do it Together /Ну-ка вместе — 5
- Pursuit of Knowledge /Погоня за знаниями — 5
- All in One /Все заодно — 4
- Countless Crowds in the Metal Mountains /Бесчисленные толпы в металлических горах — 4
- Endless Enemies /Бесконечные враги — 4
- Survivor's Paranoia /Паранойя выжившего — 4
- Serenity of Greenery /Безмятежность зелени — 3
- Life is Hard /Житие тяжкое — 3
- From Void /Из пустоты — 3
- Finger on the Pulse /Палец на пульсе — 3
- Sacred Education /Священное воспитание — 3
- Secretive by Nature /Скрытный от природы — 2
- Warp-flair /Варп-чутье — 2
- Fast Learner / Ловит на Лету — 2
- Multiple Arms / Многорукий (2) — 2
- Геносемя: IV Железные Воины — 2
- Проклятье: IV Железные Воины — 2
- Священное Воспитание — 2
- Hardening /Закалка — 2
- Power of the Earth /Сила земли — 2
- Survival Among Killers /Выживание среди убийц — 2
- Blood and Sweat /Потом и кровью — 1
- Привычка к власти — 1
- Blessed Ignorance /Благословенное невежество — 1
- Геносемя: VI Космические Волки — 1
- Культура: V Белые Шрамы — 1
- Культура: XVIII Саламандры — 1
- Сила земли — 1
- Two Weapon Wielder / Два Оружия (Стрелковое) — 1
- Fear / Страх (1) — 1
- Two Weapon Wielder / Два Оружия (Ближний Бой) — 1
- Ужас да станет другом твоим — 1
- Проклятье: VII Молоты Дорна — 1
- Культура: VII Молоты Дорна — 1
- Геносемя: VII Молоты Дорна — 1
- Бесконечные враги — 1
- Паранойя Выжившего — 1
- Погоня за знаниями — 1
- Unnatural Characteristic / Сверхъестественная Характеристика (1) — 1
- Habit of Power /Привычка к власти — 1
- Геносемя: VIII Повелители Ночи — 1
- Проклятье: VIII Повелители Ночи — 1
- Культура: VIII Повелители Ночи — 1
- Надейся на себя — 1
- Trust in Yourself /Надейся на себя — 1
- Бесчисленные Толпы в Металлических Горах — 1
- Абсолютная вера в прошлое — 1
- Smoke of Burnt Souls /Дым сожженных душ — 1
- Безмятежность Зелени — 1
- Проклятье: V Белые Шрамы — 1
- Геносемя: V Белые Шрамы — 1

## Заметка спорит с кодом

Заметка говорит «Не смоделировано», а код опознаёт запись по имени. Засчитаны как «работает»; одно из двух устарело.

- Dancing Among The Fire / Танец Среди Огня — `packs-src/talents/Азуриани/Dancing_Among_The_Fire___Танец_Среди_Огн_OMrgsJjGCUF6OEVk.json`
- Bow to the Audience / Поклон Публике — `packs-src/talents/Арлекины___Солитер/Bow_to_the_Audience___Поклон_Публике_EuAJLSf02w7IqXT3.json`
- Just the Light / Лишь Свет — `packs-src/talents/Арлекины___Солитер/Just_the_Light___Лишь_Свет_MsLFBQG5B8lU7GAO.json`
- Defensive Rider / Всадник-Защитник — `packs-src/talents/Всадник/Defensive_Rider___Всадник_Защитник_NyRfdqSNdVdu9RLn.json`
- Skilled Rider / Опытный Всадник — `packs-src/talents/Всадник/Skilled_Rider___Опытный_Всадник_kyiQZFrorseFiEKX.json`
- Squire / Оруженосец — `packs-src/talents/Всадник/Squire___Оруженосец_ARnuMggorBb6Fh7f.json`
- Hero's Sleep / Сон Героя — `packs-src/talents/Геносемя/Hero_s_Sleep___Сон_Героя_BmIEHBP27UuoJpdW.json`
- Core Memories / Ядро Воспоминаний — `packs-src/talents/Дредноуты/Core_Memories___Ядро_Воспоминаний_DreadCoreMemorie.json`
- Cruelty / Жестокость (Дредноут) — `packs-src/talents/Дредноуты/Cruelty___Жестокость__Дредноут__DreadCruelty0001.json`
- Endurance / Превозмогание — `packs-src/talents/Дредноуты/Endurance___Превозмогание_DreadEndurance01.json`
- Ferum Infernus / Ферум Инфернус — `packs-src/talents/Дредноуты/Ferum_Infernus___Ферум_Инфернус_DreadFerumInfern.json`
- Superiority / Превосходство — `packs-src/talents/Дредноуты/Superiority___Превосходство_DreadSuperiority.json`
- Triumph / Триумф — `packs-src/talents/Дредноуты/Triumph___Триумф_DreadTriumph0001.json`
- Cruelty / Жестокость — `packs-src/talents/Друкхари/Cruelty___Жестокость_WdMU7zln8HJ29LMi.json`
- Enjoyment / Наслаждение — `packs-src/talents/Друкхари/Enjoyment___Наслаждение_Mexd0ysxxzLhPQ8N.json`
- Slow Shift / Медленная Смена — `packs-src/talents/Крафт/Slow_Shift___Медленная_Смена_n2wWnOm1T5RVGV2S.json`
- Living Legend / Живая Легенда — `packs-src/talents/Лидерство/Living_Legend___Живая_Легенда_wr6QxI1QZnV7XjG2.json`
- Rally / Сплотить — `packs-src/talents/Лидерство/Rally___Сплотить_pG6WCs3ZLMnCq92f.json`
- Tolerance / Толерантность — `packs-src/talents/Медик/Tolerance___Толерантность_JG6MNrytVH410wKp.json`
- Cyberpreacher / Киберпроповедник — `packs-src/talents/Механикум/Cyberpreacher___Киберпроповедник_Dt4GHDGdl3OV16Dx.json`
- Erudite-Infernal / Эрудит-Инфернал — `packs-src/talents/Оккультист/Erudite_Infernal___Эрудит_Инфернал_iylTpQL9q9ZtzTyv.json`
- Fallbacks / Запасные Планы — `packs-src/talents/Оккультист/Fallbacks___Запасные_Планы_rZcHlJ3CRjQtNfcP.json`
- Glorious Purpose / Славное Назначение — `packs-src/talents/Оккультист/Glorious_Purpose___Славное_Назначение_bUvr7s8sAo9oGvIz.json`
- Infernal Master / Инфернальный Владыка — `packs-src/talents/Оккультист/Infernal_Master___Инфернальный_Владыка_TmowkYy05omCa4wa.json`
- Instructor / Инструктор — `packs-src/talents/Оккультист/Instructor___Инструктор_F8CIiVyZLtiNraQI.json`
- Spirit Talk / Духовный Разговор — `packs-src/talents/Певцы_Кости/Spirit_Talk___Духовный_Разговор_czktMMUEO2fstALH.json`
- Whirlwind of Death / Ураган Смерти — `packs-src/talents/Рукопашные/Whirlwind_of_Death___Ураган_Смерти_SpCzFxqedoKFPlq1.json`
- Demagogue / Демагог — `packs-src/talents/Социальные/Demagogue___Демагог_Cxl66rV8S89Pd4I5.json`
- Sniper Assassin / Снайпер-Убийца — `packs-src/talents/Стрелок/Sniper_Assassin___Снайпер_Убийца_UveZgmlmB9vxX0qB.json`
- Bottomless Soul / Бездонная Душа — `packs-src/talents/Таланты_Боли/Bottomless_Soul___Бездонная_Душа_ry2XaCOsxHL7Zbm8.json`
- Warp Sight / Дар: Варп-Зрение — `packs-src/talents/Таланты_одержимых/Дары___Единение/Warp_Sight___Дар__Варп_Зрение_6WVdW8v5zjNCXX8Z.json`
- Regeneration / Дар: Регенерация — `packs-src/talents/Таланты_одержимых/Дары___Защита/Regeneration___Дар__Регенерация_tXnfNXiMdD6xXtpY.json`
- Klaivex / Клэйвекс — `packs-src/talents/Элитные_архетипы/Инкуб/Klaivex___Клэйвекс_lbgTtCeU7rVTHpeX.json`
- Teacher / Учитель — `packs-src/talents/Элитные_архетипы/Когнитэ/Teacher___Учитель_VNC1rPfYPJbDzIuP.json`
- Bow to the Audience / Поклон Публике — `packs-src/aeldari-talents/Элитные_архетипы/Аребенниан/Bow_to_the_Audience___Поклон_Публике_xYh1tw1CM3bb6obP.json`
- Just the Light / Лишь Свет — `packs-src/aeldari-talents/Элитные_архетипы/Аребенниан/Just_the_Light___Лишь_Свет_NuWQuzTXqfcU2Aba.json`
- Silent Elimination / Тихое Устранение — `packs-src/aeldari-talents/Элитные_архетипы/Атхистаур/Silent_Elimination___Тихое_Устранение_CoTlkdy5bFkYnD6M.json`
- Deadly Effectiveness / Смертоносная Эффективность — `packs-src/aeldari-talents/Элитные_архетипы/Клинковое_Воинство/Deadly_Effectiveness___Смертоносная_Эффе_RGF7Tt4NtAAoHHNF.json`

## По группам

| Группа | Всего | Работает | Частично | Памятка | Заглушка | Текст |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| aeldari-talents / Элитные архетипы / Авангард Связанных Душами | 5 | 0 | 0 | 0 | 0 | 5 |
| aeldari-talents / Элитные архетипы / Агент Кабала | 5 | 0 | 0 | 0 | 0 | 5 |
| aeldari-talents / Элитные архетипы / Аребенниан | 6 | 2 | 0 | 0 | 0 | 4 |
| aeldari-talents / Элитные архетипы / Атхаир | 14 | 0 | 0 | 0 | 0 | 14 |
| aeldari-talents / Элитные архетипы / Атхистаур | 6 | 2 | 0 | 0 | 0 | 4 |
| aeldari-talents / Элитные архетипы / Аутарх | 3 | 0 | 0 | 0 | 0 | 3 |
| aeldari-talents / Элитные архетипы / Барон Корсаров | 5 | 0 | 0 | 0 | 0 | 5 |
| aeldari-talents / Элитные архетипы / Воин Курноуса | 7 | 0 | 0 | 0 | 0 | 7 |
| aeldari-talents / Элитные архетипы / Воин Троп | 8 | 1 | 0 | 0 | 0 | 7 |
| aeldari-talents / Элитные архетипы / Высший Варлок | 6 | 1 | 0 | 0 | 0 | 5 |
| aeldari-talents / Элитные архетипы / Высший Духовидец | 6 | 0 | 0 | 0 | 0 | 6 |
| aeldari-talents / Элитные архетипы / Высший Провидец | 6 | 0 | 0 | 0 | 0 | 6 |
| aeldari-talents / Элитные архетипы / Избранный Иши | 6 | 0 | 0 | 0 | 0 | 6 |
| aeldari-talents / Элитные архетипы / Клинковое Воинство | 5 | 2 | 0 | 0 | 0 | 3 |
| aeldari-talents / Элитные архетипы / Кузнец Ваула | 6 | 0 | 0 | 0 | 0 | 6 |
| aeldari-talents / Элитные архетипы / Лесной Владыка | 6 | 1 | 0 | 0 | 0 | 5 |
| aeldari-talents / Элитные архетипы / Маргорах | 5 | 0 | 0 | 0 | 0 | 5 |
| aeldari-talents / Элитные архетипы / Мастер Ремесленник | 2 | 0 | 0 | 0 | 0 | 2 |
| aeldari-talents / Элитные архетипы / Охотник Курноуса | 6 | 0 | 0 | 0 | 0 | 6 |
| aeldari-talents / Элитные архетипы / Принц Кхейна | 6 | 1 | 0 | 0 | 0 | 5 |
| aeldari-talents / Элитные архетипы / Присягнувшие Клинки | 6 | 0 | 0 | 0 | 0 | 6 |
| aeldari-talents / Элитные архетипы / Следопыт | 6 | 0 | 0 | 0 | 0 | 6 |
| aeldari-talents / Элитные архетипы / Странник Хоека | 5 | 0 | 0 | 0 | 0 | 5 |
| aeldari-talents / Элитные архетипы / Танцор Войны | 6 | 1 | 0 | 0 | 0 | 5 |
| aeldari-talents / Элитные архетипы / Феларх | 6 | 0 | 0 | 0 | 0 | 6 |
| aeldari-talents / Элитные архетипы / Экзарх Аспекта | 12 | 0 | 0 | 0 | 0 | 12 |
| aeldari-talents / Элитные архетипы / Эсдаинн | 4 | 0 | 0 | 0 | 0 | 4 |
| aeldari-traits / Архетипы Экзодитов | 7 | 0 | 0 | 0 | 0 | 7 |
| aeldari-traits / Элитные архетипы Эльдар | 76 | 22 | 0 | 0 | 0 | 54 |
| talents / Азуриани | 19 | 6 | 0 | 0 | 0 | 13 |
| talents / Арлекины Солитер | 8 | 3 | 0 | 0 | 0 | 5 |
| talents / Арлекины Теневой Провидец | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Арлекины Шут Смерти | 8 | 0 | 0 | 0 | 0 | 8 |
| talents / Арсенал | 11 | 9 | 0 | 0 | 0 | 2 |
| talents / Берсерк | 18 | 18 | 0 | 0 | 0 | 0 |
| talents / Внимательность | 11 | 9 | 0 | 0 | 0 | 2 |
| talents / Всадник | 11 | 8 | 3 | 0 | 0 | 0 |
| talents / Геносемя | 6 | 6 | 0 | 0 | 0 | 0 |
| talents / Два оружия | 15 | 15 | 0 | 0 | 0 | 0 |
| talents / Дредноуты | 12 | 6 | 0 | 0 | 0 | 6 |
| talents / Друкхари | 10 | 4 | 0 | 0 | 0 | 6 |
| talents / Избегание | 23 | 23 | 0 | 0 | 0 | 0 |
| talents / Книга Пустоты | 50 | 2 | 0 | 0 | 0 | 48 |
| talents / Крафт | 10 | 5 | 0 | 0 | 0 | 5 |
| talents / Лидерство | 21 | 17 | 2 | 0 | 0 | 2 |
| talents / Медик | 20 | 14 | 0 | 0 | 0 | 6 |
| talents / Метание | 6 | 6 | 0 | 0 | 0 | 0 |
| talents / Механикум | 16 | 10 | 2 | 0 | 0 | 4 |
| talents / Миньоны | 7 | 5 | 0 | 0 | 0 | 2 |
| talents / Мудрец | 4 | 2 | 0 | 0 | 0 | 2 |
| talents / Общие | 8 | 8 | 0 | 0 | 0 | 0 |
| talents / Огнем тчик | 6 | 4 | 0 | 0 | 0 | 2 |
| talents / Оккультист | 11 | 7 | 0 | 0 | 0 | 4 |
| talents / Оружейник | 19 | 17 | 0 | 0 | 0 | 2 |
| talents / Певцы Кости | 8 | 6 | 0 | 0 | 0 | 2 |
| talents / Пилот | 13 | 1 | 0 | 0 | 0 | 12 |
| talents / Псайкана | 29 | 20 | 0 | 0 | 0 | 9 |
| talents / Пси стойкость | 15 | 15 | 0 | 0 | 0 | 0 |
| talents / Пугилист | 17 | 17 | 0 | 0 | 0 | 0 |
| talents / Разбойник | 10 | 10 | 0 | 0 | 0 | 0 |
| talents / Рукопашные | 32 | 30 | 0 | 0 | 0 | 2 |
| talents / Скитарии | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Скорость | 11 | 11 | 0 | 0 | 0 | 0 |
| talents / Смелость | 7 | 6 | 0 | 0 | 0 | 1 |
| talents / Социальные | 18 | 11 | 0 | 0 | 0 | 7 |
| talents / Стойкость | 23 | 23 | 0 | 0 | 0 | 0 |
| talents / Стрелок | 36 | 35 | 0 | 0 | 0 | 1 |
| talents / Субрасы Зверолюдов | 4 | 3 | 0 | 0 | 0 | 1 |
| talents / Таланты Астартес | 2 | 0 | 0 | 0 | 0 | 2 |
| talents / Таланты Боли | 7 | 3 | 0 | 0 | 0 | 4 |
| talents / Таланты одержимых | 49 | 22 | 0 | 0 | 0 | 27 |
| talents / Техномистик | 15 | 15 | 0 | 0 | 0 | 0 |
| talents / Элитные архетипы / Архимаг | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Архимагос | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Архонт | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Берсерк Кхорна | 6 | 6 | 0 | 0 | 0 | 0 |
| talents / Элитные архетипы / Броненосец | 9 | 0 | 0 | 0 | 0 | 9 |
| talents / Элитные архетипы / Вампир | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Варп Кузнец | 5 | 5 | 0 | 0 | 0 | 0 |
| talents / Элитные архетипы / Ведьма | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Ветеран Долгой Войны | 8 | 0 | 0 | 0 | 0 | 8 |
| talents / Элитные архетипы / Виткис | 7 | 1 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Воин Ноты | 7 | 0 | 0 | 0 | 0 | 7 |
| talents / Элитные архетипы / Ворон | 8 | 0 | 0 | 0 | 0 | 8 |
| talents / Элитные архетипы / Герольд | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Гладиатор | 6 | 1 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Дикий Псайкер | 7 | 0 | 0 | 0 | 0 | 7 |
| talents / Элитные архетипы / Длань Архонта | 8 | 0 | 0 | 0 | 0 | 8 |
| talents / Элитные архетипы / Житель Бездны | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Иерарх | 6 | 1 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Иерофант | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Избиратель Плоти | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Инзорцист | 3 | 0 | 0 | 0 | 0 | 3 |
| talents / Элитные архетипы / Инкуб | 6 | 1 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Кенетаи | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Когитор | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Когнитэ | 5 | 1 | 0 | 0 | 0 | 4 |
| talents / Элитные архетипы / Коготь Варпа | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Колдун Рубрики | 5 | 5 | 0 | 0 | 0 | 0 |
| talents / Элитные архетипы / Король Червей | 5 | 1 | 0 | 0 | 0 | 4 |
| talents / Элитные архетипы / Кузнец Крови | 5 | 1 | 0 | 0 | 0 | 4 |
| talents / Элитные архетипы / Лакрималлус | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Ламия | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Лорд Дискордант | 4 | 0 | 0 | 0 | 0 | 4 |
| talents / Элитные архетипы / Малагра | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Мастер Казней | 6 | 6 | 0 | 0 | 0 | 0 |
| talents / Элитные архетипы / Медуза | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Мейстер | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Монарх | 4 | 0 | 0 | 0 | 0 | 4 |
| talents / Элитные архетипы / Моритат | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Ночной Демон | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Облитератор | 7 | 0 | 0 | 0 | 0 | 7 |
| talents / Элитные архетипы / Питати | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Последователь Ордена Сигиллитов | 6 | 6 | 0 | 0 | 0 | 0 |
| talents / Элитные архетипы / Ревенант | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Секутор | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Сибарит | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Скорбные Пасти | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Скульптор Плоти | 4 | 0 | 0 | 0 | 0 | 4 |
| talents / Элитные архетипы / Суккуб | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Т мный Апостол | 5 | 5 | 0 | 0 | 0 | 0 |
| talents / Элитные архетипы / Тенеткач | 4 | 0 | 0 | 0 | 0 | 4 |
| talents / Элитные архетипы / Тех Ассасин | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Укротитель | 5 | 0 | 0 | 0 | 0 | 5 |
| talents / Элитные архетипы / Чемпион Терминатор | 8 | 1 | 0 | 0 | 0 | 7 |
| talents / Элитные архетипы / Чернокнижник | 7 | 0 | 0 | 0 | 0 | 7 |
| talents / Элитные архетипы / Чумной Десантник | 6 | 6 | 0 | 0 | 0 | 0 |
| talents / Элитные архетипы / Чумной Монах | 6 | 0 | 0 | 0 | 0 | 6 |
| talents / Элитные архетипы / Шаман Зверолюдей | 6 | 4 | 0 | 0 | 2 | 0 |
| talents / Элитные архетипы / Шумовой Десантник | 7 | 7 | 0 | 0 | 0 | 0 |
| talents / Элитные архетипы / Электрожрец | 6 | 0 | 1 | 0 | 0 | 5 |
| traits / (корень) | 177 | 141 | 1 | 23 | 0 | 12 |
| traits / Книга Пустоты | 1 | 1 | 0 | 0 | 0 | 0 |
| traits / Локусы Герольдов | 26 | 25 | 0 | 0 | 1 | 0 |
| traits / Метки Богов | 4 | 4 | 0 | 0 | 0 | 0 |
| traits / Трейты рас | 54 | 41 | 0 | 11 | 0 | 2 |
| traits / Элитные архетипы / Архимаг | 3 | 0 | 0 | 3 | 0 | 0 |
| traits / Элитные архетипы / Архимагос | 3 | 0 | 0 | 0 | 0 | 3 |
| traits / Элитные архетипы / Архонт | 4 | 1 | 0 | 2 | 0 | 1 |
| traits / Элитные архетипы / Берсерк Кхорна | 3 | 3 | 0 | 0 | 0 | 0 |
| traits / Элитные архетипы / Бичеватель | 3 | 0 | 0 | 3 | 0 | 0 |
| traits / Элитные архетипы / Броненосец | 1 | 0 | 0 | 1 | 0 | 0 |
| traits / Элитные архетипы / Вампир | 4 | 0 | 0 | 4 | 0 | 0 |
| traits / Элитные архетипы / Варп Кузнец | 3 | 3 | 0 | 0 | 0 | 0 |
| traits / Элитные архетипы / Ведьма | 4 | 3 | 0 | 1 | 0 | 0 |
| traits / Элитные архетипы / Ветеран Долгой Войны | 2 | 0 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Виткис | 3 | 0 | 0 | 3 | 0 | 0 |
| traits / Элитные архетипы / Воин Ноты | 3 | 1 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Ворон | 3 | 0 | 0 | 3 | 0 | 0 |
| traits / Элитные архетипы / Гемункул | 3 | 0 | 0 | 3 | 0 | 0 |
| traits / Элитные архетипы / Герольд | 3 | 0 | 0 | 0 | 0 | 3 |
| traits / Элитные архетипы / Гладиатор | 4 | 3 | 0 | 1 | 0 | 0 |
| traits / Элитные архетипы / Дикий Псайкер | 3 | 1 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Длань Архонта | 3 | 1 | 0 | 0 | 0 | 2 |
| traits / Элитные архетипы / Житель Бездны | 2 | 1 | 0 | 1 | 0 | 0 |
| traits / Элитные архетипы / Иерарх | 3 | 1 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Иерофант | 2 | 0 | 0 | 0 | 0 | 2 |
| traits / Элитные архетипы / Избиратель Плоти | 4 | 2 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Инзорцист | 3 | 0 | 0 | 3 | 0 | 0 |
| traits / Элитные архетипы / Инкуб | 4 | 3 | 0 | 1 | 0 | 0 |
| traits / Элитные архетипы / Кенетаи | 2 | 0 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Когитор | 4 | 0 | 0 | 4 | 0 | 0 |
| traits / Элитные архетипы / Когнитэ | 3 | 0 | 0 | 3 | 0 | 0 |
| traits / Элитные архетипы / Коготь Варпа | 3 | 1 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Колдун Рубрики | 4 | 3 | 0 | 1 | 0 | 0 |
| traits / Элитные архетипы / Король Червей | 3 | 0 | 0 | 2 | 0 | 1 |
| traits / Элитные архетипы / Кузнец Крови | 2 | 0 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Лакрималлус | 2 | 0 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Ламия | 4 | 2 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Лорд Дискордант | 3 | 0 | 0 | 2 | 0 | 1 |
| traits / Элитные архетипы / Малагра | 4 | 0 | 0 | 0 | 0 | 4 |
| traits / Элитные архетипы / Мастер Казней | 5 | 5 | 0 | 0 | 0 | 0 |
| traits / Элитные архетипы / Медуза | 9 | 5 | 0 | 4 | 0 | 0 |
| traits / Элитные архетипы / Мейстер | 5 | 0 | 0 | 5 | 0 | 0 |
| traits / Элитные архетипы / Монарх | 2 | 0 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Моритат | 2 | 0 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Ночной Демон | 1 | 0 | 0 | 1 | 0 | 0 |
| traits / Элитные архетипы / Облитератор | 2 | 0 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Питати | 2 | 0 | 0 | 0 | 0 | 2 |
| traits / Элитные архетипы / Ревенант | 5 | 0 | 0 | 5 | 0 | 0 |
| traits / Элитные архетипы / Секутор | 3 | 2 | 0 | 0 | 0 | 1 |
| traits / Элитные архетипы / Сибарит | 2 | 0 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Сигиллит | 1 | 1 | 0 | 0 | 0 | 0 |
| traits / Элитные архетипы / Скорбные Пасти | 2 | 0 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Скульптор Плоти | 2 | 0 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Суккуб | 4 | 2 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Т мный Апостол | 2 | 2 | 0 | 0 | 0 | 0 |
| traits / Элитные архетипы / Тенеткач | 9 | 8 | 0 | 1 | 0 | 0 |
| traits / Элитные архетипы / Тех Ассасин | 2 | 0 | 0 | 1 | 0 | 1 |
| traits / Элитные архетипы / Укротитель | 2 | 1 | 0 | 1 | 0 | 0 |
| traits / Элитные архетипы / Чемпион Терминатор | 2 | 0 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Чернокнижник | 2 | 0 | 1 | 1 | 0 | 0 |
| traits / Элитные архетипы / Чумной Десантник | 2 | 2 | 0 | 0 | 0 | 0 |
| traits / Элитные архетипы / Чумной Монах | 5 | 3 | 0 | 2 | 0 | 0 |
| traits / Элитные архетипы / Шаман Зверолюдей | 2 | 2 | 0 | 0 | 0 | 0 |
| traits / Элитные архетипы / Шумовой Десантник | 2 | 2 | 0 | 0 | 0 | 0 |
| traits / Элитные архетипы / Электрожрец | 3 | 1 | 0 | 0 | 0 | 2 |

## Навыки

Файлы механики (вне `module/constants` и Мастера создания персонажа), где встречается ключ Навыка. Ноль — Навык только бросается с листа.

| Навык | Мест в механике | Где |
| --- | ---: | --- |
| Акробатика / Acrobatics | 12 | `combat/assassin-strike.mjs`, `combat/defense.mjs`, `combat/flip.mjs`, `combat/grapple.mjs`, `combat/mount.mjs`, `combat/movement-actions.mjs` и ещё 6 |
| Атлетика / Athletics | 9 | `combat/armor-mods.mjs`, `combat/force-move.mjs`, `combat/grapple.mjs`, `combat/joint-move.mjs`, `combat/movement-actions.mjs`, `combat/roundhouse.mjs` и ещё 3 |
| Внимательность / Awareness | 16 | `combat/blade-juggler.mjs`, `combat/bow-to-audience.mjs`, `combat/flourish-dance.mjs`, `combat/laser-sight.mjs`, `combat/opposed-contest.mjs`, `combat/recognize-stance.mjs` и ещё 10 |
| Очарование / Charm | 6 | `combat/command-state.mjs`, `combat/dark-apostle.mjs`, `combat/inspire-wrath.mjs`, `rules/dark-apostle.mjs`, `rules/master-of-executions.mjs`, `rules/situational-social-talents.mjs` |
| Командование / Command | 22 | `apps/cogitator.mjs`, `combat/command-state.mjs`, `combat/lord-of-exodites.mjs`, `rules/actor-setup.mjs`, `rules/adjutant.mjs`, `rules/binary-dominion.mjs` и ещё 16 |
| Торговля / Commerce | 2 | `rules/requisition-talents.mjs`, `rules/situational-social-talents.mjs` |
| Обман / Deceive | 4 | `combat/blade-juggler.mjs`, `combat/command-state.mjs`, `rules/master-of-executions.mjs`, `rules/situational-social-talents.mjs` |
| Уклонение / Dodge | 15 | `combat/adrenaline-rush.mjs`, `combat/blade-shield.mjs`, `combat/defense.mjs`, `combat/mount.mjs`, `combat/rage-behavior.mjs`, `combat/techniques.mjs` и ещё 9 |
| Расспрос / Inquiry | 1 | `rules/master-of-executions.mjs` |
| Допрос / Interrogate | 5 | `apps/skillful-torture.mjs`, `apps/torture.mjs`, `combat/noise-marine.mjs`, `rules/command-effects.mjs`, `rules/resolve-test.mjs` |
| Запугивание / Intimidate | 10 | `combat/field-execution.mjs`, `combat/intimidate.mjs`, `combat/terror-sniper.mjs`, `rules/command-effects.mjs`, `rules/leadership-talents.mjs`, `rules/rage-behavior.mjs` и ещё 4 |
| Логика / Logic | 4 | `apps/craft-workshop.mjs`, `combat/grenade-cooking.mjs`, `rules/situational-social-talents.mjs`, `sheets/squad-sheet.mjs` |
| Медицина / Medicae | 5 | `apps/craft-workshop.mjs`, `rules/legion-surgery.mjs`, `rules/surgical-precision.mjs`, `rules/torture.mjs`, `sheets/tabs/healing.mjs` |
| Парирование / Parry | 9 | `combat/defense.mjs`, `combat/movement-actions.mjs`, `combat/rage-behavior.mjs`, `combat/walker.mjs`, `rules/armour-penalty.mjs`, `rules/command-effects.mjs` и ещё 3 |
| Психочутьё / Psyniscience | 9 | `apps/hud.mjs`, `apps/illusion-of-normality.mjs`, `apps/veil.mjs`, `combat/attack-card.mjs`, `combat/unseen-attack.mjs`, `rules/blunted.mjs` и ещё 3 |
| Пристальность / Scrutiny | 2 | `combat/opposed-contest.mjs`, `rules/awareness-talents.mjs` |
| Безопасность / Security | 0 |  |
| Ловкость рук / Sleight of Hand | 0 |  |
| Скрытность / Stealth | 1 | `rules/situational-social-talents.mjs` |
| Выживание / Survival | 4 | `combat/mount.mjs`, `rules/mount.mjs`, `rules/situational.mjs`, `sheets/tabs/command.mjs` |
| Технология / Tech-Use | 13 | `apps/infoguard.mjs`, `combat/attack-card.mjs`, `combat/clear-jam.mjs`, `combat/hololith-briefing.mjs`, `combat/meltdown.mjs`, `combat/mount.mjs` и ещё 7 |
| Общие знания / Common Lore (группа) | 5 | `combat/hidden-joints.mjs`, `combat/tank-hunter.mjs`, `rules/actor-setup.mjs`, `rules/adjutant.mjs`, `rules/character.mjs` |
| Запретные знания / Forbidden Lore (группа) | 15 | `apps/addiction.mjs`, `apps/craft-workshop.mjs`, `combat/dark-apostle.mjs`, `combat/rubric-sorcerer.mjs`, `combat/warpsmith.mjs`, `rules/addiction.mjs` и ещё 9 |
| Ученые знания / Scholastic Lore (группа) | 3 | `rules/adjutant.mjs`, `rules/character.mjs`, `rules/surgical-precision.mjs` |
| Язык / Linguistics (группа) | 1 | `rules/leadership-talents.mjs` |
| Навигация / Navigation (группа) | 3 | `apps/scene-nexus.mjs`, `apps/veil.mjs`, `sheets/tabs/warp-routes.mjs` |
| Вождение / Operate (группа) | 5 | `apps/veil.mjs`, `combat/vehicle-force-move.mjs`, `combat/vehicle.mjs`, `combat/walker.mjs`, `rules/mount.mjs` |
| Ремесло / Trade (группа) | 5 | `combat/clear-jam.mjs`, `combat/flourish-dance.mjs`, `rules/dance-of-deception.mjs`, `rules/vacuum.mjs`, `sheets/sheet-helpers.mjs` |
