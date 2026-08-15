// module/constants/ritual-presets.mjs
// Пресеты приложенных ритуалов: автозаполняют форму (название, тип, сложность,
// навык/характеристику теста, ассистентов). Навык подбирается под РЕАЛЬНЫЕ
// навыки актёра (знания динамические) — по синонимам специализации.
//
// Схема: { n:название, cat:категория, type:тип, rec:Запись, a:[мин,макс] ассист.,
//          pf:цена ошибки/Провал, sk:[[группа, спец, харктест, мод], ...] }
//   группа: "fl" (Запретные знания) | "sl" (Учёные знания) | "flat:<ключ>"
//   харктест: i=Int, w=WP, a=Ag, p=Per, f=Fel, inf=Inf

import { specMatches } from "./rituals.mjs";

export const RITUAL_PRESETS = [
  // ─────────────── ПРИЗЫВ ───────────────
  { n: "Призыв Низшего Демона", cat: "Призыв", type: "summon", rec: 0, a: [0, 4], pf: 5,
    sk: [["fl", "Daemons", "i", -20], ["fl", "Heresy", "w", -30], ["fl", "Warp", "i", -30]] },
  { n: "Призыв Великого Зверя", cat: "Призыв", type: "summon", rec: 0, a: [2, 8], pf: 5,
    sk: [["fl", "Daemons", "i", -30], ["fl", "Heresy", "w", -40], ["fl", "Warp", "i", -40]] },
  { n: "Призыв Презреннейших", cat: "Призыв", type: "summon", rec: 0, a: [0, 4], pf: 5,
    sk: [["fl", "Daemons", "i", 0], ["fl", "Heresy", "w", -10], ["fl", "Warp", "i", -10]] },
  { n: "Призыв Воинства Богов", cat: "Призыв", type: "summon", rec: 0, a: [4, 16], pf: 10,
    sk: [["fl", "Daemons", "i", -60], ["fl", "Heresy", "w", -70], ["fl", "Warp", "i", -70]] },
  { n: "Призыв Глашатая Богов", cat: "Призыв", type: "summon", rec: 0, a: [2, 8], pf: 5,
    sk: [["fl", "Daemons", "i", -30], ["fl", "Heresy", "w", -40], ["fl", "Warp", "i", -40]] },
  { n: "Призыв Демонического Владыки", cat: "Призыв", type: "summon", rec: 3, a: [4, 16], pf: 10,
    sk: [["fl", "Daemons", "i", -60], ["fl", "Heresy", "w", -70], ["fl", "Warp", "i", -70]] },
  { n: "Создание Фамильяра", cat: "Призыв", type: "binding", rec: 0, a: [0, 4], pf: 5,
    sk: [["fl", "Daemons", "i", -20]] },
  { n: "Двор Первого Круга (Слаанеш)", cat: "Призыв", type: "summon", rec: 0, a: [0, 0], pf: 5,
    sk: [["fl", "Heresy", "w", 0], ["fl", "Warp", "i", 0]] },
  { n: "Укрощение Бронзового Скакуна (Кхорн)", cat: "Призыв", type: "summon", rec: 0, a: [0, 0], pf: 5,
    sk: [["fl", "Heresy", "w", 0], ["fl", "Warp", "i", 0]] },
  { n: "Трансформация Диска (Тзинч)", cat: "Призыв", type: "binding", rec: 0, a: [0, 0], pf: 5,
    sk: [["fl", "Daemons", "i", -20], ["fl", "Warp", "i", -30]] },
  { n: "Ритуал Тысячи Глаз", cat: "Призыв", type: "summon", rec: 3, a: [0, 4], pf: 10,
    sk: [["fl", "Daemons", "i", -30], ["fl", "Heresy", "w", -40], ["fl", "Warp", "i", -40]] },
  { n: "Темница Плоти", cat: "Призыв", type: "binding", rec: 3, a: [0, 0], pf: 5,
    sk: [["fl", "Daemons", "i", -40], ["sl", "Occult", "i", 20]] },
  { n: "Ритуал Одержимости", cat: "Призыв", type: "binding", rec: 1, a: [0, 4], pf: 10,
    sk: [["fl", "Daemons", "i", -20], ["fl", "Heresy", "w", -30]] },
  { n: "Ад в Бутылке", cat: "Призыв", type: "binding", rec: 1, a: [0, 4], pf: 5,
    sk: [["fl", "Daemons", "i", 0]] },
  { n: "Ритуал Дерзости", cat: "Призыв", type: "dominion", rec: 5, a: [4, 16], pf: 5,
    sk: [["fl", "Daemons", "i", -60]] },
  { n: "Ритуал Экстракции", cat: "Призыв", type: "binding", rec: 1, a: [0, 4], pf: 5,
    sk: [["fl", "Warp", "i", -20]] },
  { n: "Ритуал Смотрителя", cat: "Призыв", type: "binding", rec: 2, a: [0, 4], pf: 5,
    sk: [["fl", "Daemons", "i", 0]] },
  { n: "Ритуал Цепей", cat: "Призыв", type: "binding", rec: 2, a: [0, 4], pf: 5,
    sk: [["fl", "Daemons", "i", -10], ["fl", "Heresy", "w", -20], ["fl", "Warp", "i", -20]] },
  { n: "Ритуал Ищейки", cat: "Призыв", type: "summon", rec: 4, a: [0, 4], pf: 5,
    sk: [["fl", "Daemons", "i", -60]] },
  { n: "Ритуал Возрождения", cat: "Призыв", type: "summon", rec: 5, a: [0, 4], pf: 10,
    sk: [["fl", "Daemons", "i", -60]] },
  { n: "Ритуал Открытия Врат", cat: "Призыв", type: "gate", rec: 3, a: [0, 4], pf: 10,
    sk: [["fl", "Warp", "i", -20], ["fl", "Heresy", "w", -20], ["fl", "Daemons", "i", -10]] },
  { n: "Ритуал Разлома", cat: "Призыв", type: "gate", rec: 4, a: [4, 16], pf: 20,
    sk: [["fl", "Warp", "i", -70], ["fl", "Heresy", "w", -80], ["fl", "Daemons", "i", -80]] },
  { n: "Гехемахнет (финальная стадия)", cat: "Призыв", type: "gate", rec: 5, a: [4, 16], pf: 20,
    sk: [["fl", "Daemons", "i", -70], ["fl", "Heresy", "w", -80], ["fl", "Warp", "i", -80]] },

  // ─────────────── РИТУАЛЬНЫЕ КРУГИ ───────────────
  { n: "Круг Изоляции", cat: "Круги", type: "circle", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", 0]] },
  { n: "Круг Стабилизации", cat: "Круги", type: "circle", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", 0]] },
  { n: "Круг Подчинения", cat: "Круги", type: "circle", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", 0]] },
  { n: "Круг Духовного Щита", cat: "Круги", type: "circle", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", 0]] },
  { n: "Круг Сломанного Щита", cat: "Круги", type: "circle", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -10]] },
  { n: "Круг Крови", cat: "Круги", type: "circle", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -10]] },
  { n: "Круг Пламени", cat: "Круги", type: "circle", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -10]] },
  { n: "Круг Железа", cat: "Круги", type: "circle", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -20]] },
  { n: "Круг Спокойствия", cat: "Круги", type: "circle", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -20]] },
  { n: "Круг Единства", cat: "Круги", type: "circle", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -30]] },
  { n: "Круг Принуждения", cat: "Круги", type: "circle", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -30]] },
  { n: "Круг Сломанных Врат", cat: "Круги", type: "circle", rec: 2, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -30]] },
  { n: "Круг Грабителя", cat: "Круги", type: "circle", rec: 3, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -40]] },
  { n: "Круг Лжеца", cat: "Круги", type: "circle", rec: 3, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -40]] },
  { n: "Круг Плоти", cat: "Круги", type: "circle", rec: 5, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -40]] },

  // ─────────────── ЭКЗОРЦИЗМ ───────────────
  { n: "Святилище", cat: "Экзорцизм", type: "exorcism", rec: 0, a: [0, 0], pf: 5,
    sk: [["sl", "Imperial Creed", "w", 10], ["sl", "Occult", "i", 0]] },
  { n: "Отрицание", cat: "Экзорцизм", type: "exorcism", rec: 0, a: [0, 0], pf: 5,
    sk: [["sl", "Imperial Creed", "w", 0], ["sl", "Occult", "i", -10]] },
  { n: "Ограждение", cat: "Экзорцизм", type: "exorcism", rec: 0, a: [0, 0], pf: 5,
    sk: [["sl", "Imperial Creed", "w", 20], ["sl", "Occult", "i", 10]] },
  { n: "Изгнание", cat: "Экзорцизм", type: "exorcism", rec: 0, a: [0, 0], pf: 5,
    sk: [["sl", "Imperial Creed", "w", -20], ["sl", "Occult", "i", -10]] },
  { n: "Слово Сокрушения", cat: "Экзорцизм", type: "exorcism", rec: 0, a: [0, 0], pf: 5,
    sk: [["sl", "Imperial Creed", "w", 0], ["sl", "Occult", "i", -10]] },
  { n: "Слово Искоренения", cat: "Экзорцизм", type: "exorcism", rec: 2, a: [0, 0], pf: 5,
    sk: [["sl", "Imperial Creed", "w", 0], ["sl", "Occult", "i", -10]] },
  { n: "Слово Расковывания", cat: "Экзорцизм", type: "exorcism", rec: 4, a: [0, 0], pf: 5,
    sk: [["sl", "Imperial Creed", "w", -20], ["sl", "Occult", "i", -30]] },
  { n: "Гимн Изгнания", cat: "Экзорцизм", type: "exorcism", rec: 0, a: [0, 0], pf: 5,
    sk: [["sl", "Imperial Creed", "w", 10], ["sl", "Occult", "i", 0]] },
  { n: "Освящение", cat: "Экзорцизм", type: "exorcism", rec: 0, a: [0, 0], pf: 5,
    sk: [["sl", "Imperial Creed", "w", -20]] },
  { n: "Печать Презрения", cat: "Экзорцизм", type: "exorcism", rec: 3, a: [0, 0], pf: 5,
    sk: [["sl", "Imperial Creed", "w", -20], ["sl", "Occult", "i", -30]] },
  { n: "Великое Изгнание", cat: "Экзорцизм", type: "exorcism", rec: 4, a: [0, 0], pf: 5,
    sk: [["sl", "Imperial Creed", "w", -20], ["sl", "Occult", "i", -30]] },

  // ─────────────── ПРОКЛЯТЬЯ ───────────────
  { n: "Проклятье Маяка", cat: "Проклятья", type: "curse", rec: 0, a: [0, 2], pf: 5, sk: [["sl", "Occult", "i", 0]] },
  { n: "Проклятье Куклы", cat: "Проклятья", type: "curse", rec: 1, a: [0, 2], pf: 5, sk: [["sl", "Occult", "i", 0]] },
  { n: "Проклятье Удушающей Тьмы", cat: "Проклятья", type: "curse", rec: 1, a: [0, 0], pf: 5, sk: [["fl", "Heresy", "w", 10]] },
  { n: "Проклятье Кривой Руки", cat: "Проклятья", type: "curse", rec: 1, a: [0, 0], pf: 5, sk: [["fl", "Heresy", "w", 10]] },
  { n: "Проклятье Суеты", cat: "Проклятья", type: "curse", rec: 2, a: [0, 2], pf: 5, sk: [["sl", "Occult", "i", -10]] },
  { n: "Проклятье Вечного Ужаса", cat: "Проклятья", type: "curse", rec: 3, a: [0, 2], pf: 5,
    sk: [["sl", "Occult", "i", -10], ["fl", "Warp", "i", -10]] },
  { n: "Проклятье Чёрного Зеркала", cat: "Проклятья", type: "curse", rec: 3, a: [0, 0], pf: 5,
    sk: [["sl", "Occult", "i", -20], ["fl", "Heresy", "w", -20]] },
  { n: "Проклятье Проказы", cat: "Проклятья", type: "curse", rec: 3, a: [0, 0], pf: 5,
    sk: [["sl", "Occult", "i", -20], ["fl", "Heresy", "w", -20]] },
  { n: "Проклятье Эфирной Плети", cat: "Проклятья", type: "curse", rec: 3, a: [0, 0], pf: 5,
    sk: [["sl", "Occult", "i", -20], ["fl", "Heresy", "w", -20]] },
  { n: "Проклятье Изгоя", cat: "Проклятья", type: "curse", rec: 3, a: [0, 0], pf: 5,
    sk: [["sl", "Occult", "i", -20], ["fl", "Heresy", "w", -20]] },
  { n: "Проклятье Слова Силы", cat: "Проклятья", type: "curse", rec: 3, a: [0, 0], pf: 5,
    sk: [["sl", "Occult", "i", -20]] },
  { n: "Проклятье Искушения", cat: "Проклятья", type: "curse", rec: 3, a: [2, 2], pf: 5,
    sk: [["sl", "Occult", "i", -50], ["fl", "Heresy", "w", -40]] },
  { n: "Проклятье Злого Рока", cat: "Проклятья", type: "curse", rec: 3, a: [0, 2], pf: 5,
    sk: [["sl", "Occult", "i", -50], ["fl", "Warp", "i", -40]] },
  { n: "Проклятье Тёмного Двойника", cat: "Проклятья", type: "curse", rec: 4, a: [0, 2], pf: 5,
    sk: [["sl", "Occult", "i", -70], ["fl", "Daemons", "i", -50]] },
  { n: "Проклятье Слабины", cat: "Проклятья", type: "curse", rec: 3, a: [0, 2], pf: 5,
    sk: [["sl", "Occult", "i", -40], ["fl", "Heresy", "w", -40]] },
  { n: "Проклятье Предрешенья", cat: "Проклятья", type: "curse", rec: 4, a: [0, 0], pf: 5,
    sk: [["sl", "Occult", "i", -30], ["fl", "Heresy", "w", -30]] },
  { n: "Проклятье Вечности", cat: "Проклятья", type: "curse", rec: 5, a: [4, 8], pf: 5,
    sk: [["sl", "Occult", "i", -80], ["fl", "Heresy", "w", -80]] },

  // ─────────────── ТЁМНЫЕ МОЛИТВЫ / ПРОЧЕЕ ───────────────
  { n: "Ритуал Петиции", cat: "Тёмные молитвы", type: "blessing", rec: 0, a: [0, 0], pf: 10,
    sk: [["sl", "Occult", "i", -20], ["fl", "Heresy", "w", -30]] },
  { n: "Ритуал Божественного Инструмента", cat: "Тёмные молитвы", type: "blessing", rec: 5, a: [2, 4], pf: 10,
    sk: [["sl", "Occult", "i", -30], ["fl", "Daemons", "i", -30], ["fl", "Warp", "i", -30], ["fl", "Heresy", "w", -30]] },
  { n: "Ритуал Тёмного Письма", cat: "Тёмные молитвы", type: "blessing", rec: 2, a: [0, 0], pf: 5,
    sk: [["sl", "Occult", "i", -10]] },
  { n: "Ритуал Отсечения", cat: "Тёмные молитвы", type: "blessing", rec: 4, a: [2, 6], pf: 5,
    sk: [["fl", "Heresy", "w", -40]] },
  { n: "Ритуал Двора Хаоса", cat: "Тёмные молитвы", type: "binding", rec: 3, a: [4, 4], pf: 10,
    sk: [["fl", "Heresy", "w", -40]] },
  { n: "Ритуал Переполнения", cat: "Тёмные молитвы", type: "binding", rec: 1, a: [0, 2], pf: 5,
    sk: [["fl", "Heresy", "w", 0], ["fl", "Warp", "i", -10]] },
  { n: "Ритуал Цепных Псов", cat: "Тёмные молитвы", type: "binding", rec: 0, a: [0, 4], pf: 5,
    sk: [["fl", "Heresy", "w", 0], ["fl", "Warp", "i", 0]] },

  // ─────────────── АЛХИМАНТИЯ ───────────────
  { n: "Ритуал Возрождения Крови", cat: "Алхимантия", type: "blessing", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", 10]] },
  { n: "Ритуал Неуязвимости", cat: "Алхимантия", type: "blessing", rec: 2, a: [0, 0], pf: 5,
    sk: [["fl", "Heresy", "w", -10], ["fl", "Warp", "i", -20]] },
  { n: "Ритуал Котла Богов", cat: "Алхимантия", type: "blessing", rec: 2, a: [0, 2], pf: 5, sk: [["fl", "Heresy", "w", -20]] },
  { n: "Ритуал Кровного Наследника", cat: "Алхимантия", type: "blessing", rec: 3, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -10]] },
  { n: "Ритуал Рафинированной Плоти", cat: "Алхимантия", type: "blessing", rec: 3, a: [0, 2], pf: 5,
    sk: [["sl", "Occult", "i", 0], ["fl", "Warp", "i", 0]] },
  { n: "Ритуал Божественной Рощи", cat: "Алхимантия", type: "gate", rec: 3, a: [0, 2], pf: 5,
    sk: [["fl", "Heresy", "i", 0], ["fl", "Warp", "i", -10]] },
  { n: "Ритуал Смертной Алхимии", cat: "Алхимантия", type: "binding", rec: 4, a: [2, 4], pf: 5,
    sk: [["sl", "Occult", "i", -30], ["fl", "Warp", "i", -30]] },
  { n: "Ритуал Даров Данайцев", cat: "Алхимантия", type: "binding", rec: 4, a: [2, 4], pf: 10, sk: [["fl", "Daemons", "i", -20]] },

  // ─────────────── НАБЛЮДЕНИЕ ───────────────
  { n: "Ритуал Поиска", cat: "Наблюдение", type: "blessing", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", 30]] },
  { n: "Ритуал Злопамятности", cat: "Наблюдение", type: "blessing", rec: 1, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", 10]] },
  { n: "Ритуал Взора Сородича", cat: "Наблюдение", type: "blessing", rec: 1, a: [0, 2], pf: 5, sk: [["sl", "Occult", "i", 0]] },
  { n: "Ритуал Окна в Будущее", cat: "Наблюдение", type: "blessing", rec: 0, a: [0, 2], pf: 5, sk: [["sl", "Occult", "i", -30]] },
  { n: "Третий Глаз Рау'Кереса", cat: "Наблюдение", type: "blessing", rec: 4, a: [4, 4], pf: 5, sk: [["fl", "Warp", "i", -60]] },

  // ─────────────── СВЯЗЬ ───────────────
  { n: "Ритуал Говорящего с Ветром", cat: "Связь", type: "blessing", rec: 4, a: [0, 2], pf: 5, sk: [["fl", "Heresy", "w", -10]] },
  { n: "Ритуал Шептуна", cat: "Связь", type: "blessing", rec: 1, a: [0, 2], pf: 5, sk: [["sl", "Occult", "i", -10]] },
  { n: "Ритуал Разделённых Близнецов", cat: "Связь", type: "blessing", rec: 2, a: [2, 4], pf: 5, sk: [["sl", "Occult", "i", -30]] },
  { n: "Ритуал Крови На Воде", cat: "Связь", type: "blessing", rec: 3, a: [4, 8], pf: 5,
    sk: [["sl", "Occult", "i", -50], ["fl", "Warp", "i", -40]] },

  // ─────────────── ПУТЕШЕСТВИЕ ───────────────
  { n: "Ритуал Обсидиановой Двери", cat: "Путешествие", type: "gate", rec: 1, a: [0, 2], pf: 10, sk: [["fl", "Warp", "i", -40]] },
  { n: "Ритуал Инфернального Подменыша", cat: "Путешествие", type: "gate", rec: 2, a: [4, 4], pf: 10, sk: [["fl", "Warp", "i", -40]] },
  { n: "Ритуал Тайного Пути", cat: "Путешествие", type: "gate", rec: 3, a: [0, 2], pf: 10, sk: [["fl", "Warp", "i", -40]] },
  { n: "Врата Плоти Атхарвы (стадия 2)", cat: "Путешествие", type: "gate", rec: 4, a: [2, 4], pf: 10, sk: [["fl", "Warp", "i", -40]] },
  { n: "Демонкуллюм", cat: "Путешествие", type: "gate", rec: 5, a: [13, 13], pf: 10,
    sk: [["fl", "Daemons", "i", -20], ["fl", "Warp", "i", -30]] },

  // ─────────────── КОНТРОЛЬ ───────────────
  { n: "Ритуал Единения Возвышенной Плоти", cat: "Контроль", type: "blessing", rec: 1, a: [0, 2], pf: 5, sk: [["sl", "Occult", "i", 0]] },
  { n: "Ритуал Однодневки", cat: "Контроль", type: "blessing", rec: 1, a: [0, 4], pf: 5, sk: [["sl", "Occult", "i", -10]] },
  { n: "Ритуал Призрачного Наездника", cat: "Контроль", type: "blessing", rec: 2, a: [0, 2], pf: 5, sk: [["sl", "Occult", "i", 0]] },
  { n: "Ритуал Связывания Душ", cat: "Контроль", type: "blessing", rec: 3, a: [0, 0], pf: 5,
    sk: [["sl", "Occult", "i", -30], ["fl", "Warp", "i", -30], ["fl", "Heresy", "w", -30]] },
  { n: "Ритуал Стальной Крови", cat: "Контроль", type: "blessing", rec: 3, a: [0, 0], pf: 5, sk: [["fl", "Warp", "i", 0]] },
  { n: "Метка Изначального Уничтожителя", cat: "Контроль", type: "binding", rec: 4, a: [0, 4], pf: 5,
    sk: [["fl", "Heresy", "w", -30], ["fl", "Warp", "i", -40]] },

  // ─────────────── ВЕДЬМОГРАЖДЕНИЕ ───────────────
  { n: "Ритуал Тумана Безумия", cat: "Ведьмограждение", type: "blessing", rec: 1, a: [2, 4], pf: 5,
    sk: [["sl", "Occult", "i", -30], ["fl", "Warp", "i", -30], ["fl", "Heresy", "w", -30]] },
  { n: "Ритуал Ведьмовской Стены", cat: "Ведьмограждение", type: "blessing", rec: 2, a: [2, 4], pf: 5,
    sk: [["sl", "Occult", "i", -30], ["fl", "Psykers", "i", -40]] },
  { n: "Кровоточащий Каратель Ксорфаса", cat: "Ведьмограждение", type: "blessing", rec: 3, a: [2, 4], pf: 5, sk: [["fl", "Daemons", "i", -40]] },
  { n: "Зеркальный Зуб З'Сатропа", cat: "Ведьмограждение", type: "summon", rec: 3, a: [0, 2], pf: 5, sk: [["fl", "Warp", "i", -20]] },
  { n: "Ритуал Демона-Хранителя", cat: "Ведьмограждение", type: "binding", rec: 4, a: [0, 0], pf: 5, sk: [["fl", "Daemons", "inf", 30]] },

  // ─────────────── НЕКРОМАНТИЯ ───────────────
  { n: "Ритуал Слова Эндора", cat: "Некромантия", type: "blessing", rec: 0, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -20]] },
  { n: "Ритуал Вселения", cat: "Некромантия", type: "blessing", rec: 1, a: [0, 2], pf: 5, sk: [["fl", "Warp", "i", -20]] },
  { n: "Ритуал Переливания", cat: "Некромантия", type: "blessing", rec: 2, a: [0, 2], pf: 5, sk: [["fl", "Warp", "i", -20]] },
  { n: "Ритуал Гаруспики", cat: "Некромантия", type: "blessing", rec: 1, a: [0, 2], pf: 5, sk: [["fl", "Warp", "i", 0]] },
  { n: "Ритуал Медиума", cat: "Некромантия", type: "blessing", rec: 2, a: [0, 0], pf: 5, sk: [["fl", "Warp", "i", 0]] },
  { n: "Ритуал Последнего Слова", cat: "Некромантия", type: "blessing", rec: 3, a: [0, 4], pf: 5, sk: [["fl", "Warp", "i", -30]] },
  { n: "Ритуал Раба Смерти", cat: "Некромантия", type: "summon", rec: 4, a: [0, 4], pf: 5, sk: [["fl", "Warp", "i", -30]] },

  // ─────────────── ЭЛИТНЫЕ АРХЕТИПЫ ───────────────
  { n: "Ритуал Мхара Гал", cat: "Элитные архетипы", type: "summon", rec: 5, a: [2, 4], pf: 10, sk: [["fl", "Daemons", "i", -30]] },
  { n: "Ритуал Благословенных Сынов", cat: "Элитные архетипы", type: "blessing", rec: 5, a: [2, 4], pf: 10, sk: [["fl", "Heresy", "w", -30]] },
  { n: "Ритуал Доказательства Силы", cat: "Элитные архетипы", type: "dominion", rec: 3, a: [0, 0], pf: 5, sk: [["fl", "Daemons", "i", 20]] },
  { n: "Ритуал Королевского Стража", cat: "Элитные архетипы", type: "blessing", rec: 2, a: [0, 0], pf: 5, sk: [["fl", "Heresy", "w", 20]] },
  { n: "Ритуал Живой Крепости", cat: "Элитные архетипы", type: "blessing", rec: 5, a: [0, 0], pf: 5, sk: [["fl", "Heresy", "w", -20]] },
  { n: "Ритуал Ростка Парадокса", cat: "Элитные архетипы", type: "blessing", rec: 3, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -10]] },
  { n: "Ритуал Призрака в Машине", cat: "Элитные архетипы", type: "blessing", rec: 4, a: [0, 0], pf: 5, sk: [["sl", "Occult", "i", -20]] },
  { n: "Ритуал Бесконечной Раны", cat: "Элитные архетипы", type: "gate", rec: 3, a: [0, 0], pf: 5, sk: [["fl", "Warp", "i", 20]] },
  { n: "Ритуал Нечестивого Убежища", cat: "Элитные архетипы", type: "blessing", rec: 4, a: [0, 0], pf: 5, sk: [["fl", "Warp", "i", 0]] },
  { n: "Ритуал Оруженосца", cat: "Элитные архетипы", type: "blessing", rec: 4, a: [0, 0], pf: 5, sk: [["fl", "Heresy", "w", 0]] }
];

const CH = { i: "int", w: "wp", a: "ag", p: "per", f: "fel", inf: "inf" };

// Пресеты, сгруппированные по категориям (для optgroup).
export function ritualPresetGroups() {
  const groups = {};
  RITUAL_PRESETS.forEach((p, i) => {
    (groups[p.cat] ??= []).push({ idx: i, label: p.n });
  });
  return Object.entries(groups).map(([cat, items]) => ({ cat, items }));
}

// Применить пресет к реальным навыкам актёра → поля формы ритуала.
export function applyRitualPreset(actor, presetIdx, buildSkills, lineIdx = 0) {
  const p = RITUAL_PRESETS[presetIdx];
  if (!p) return null;
  const skills = buildSkills(actor);
  const line = p.sk[lineIdx] || p.sk[0];
  const [grp, spec, ch, mod] = line;

  let skillValue = skills[0]?.value || "";
  if (grp === "fl" || grp === "sl") {
    const gkey = grp === "fl" ? "forbiddenLore" : "scholasticLore";
    const match = skills.find(s => s.value.startsWith(`group:${gkey}:`) && specMatches(s.label, spec));
    const anyG  = skills.find(s => s.value.startsWith(`group:${gkey}:`));
    skillValue = (match || anyG)?.value || skillValue;
  } else if (grp.startsWith("flat:")) {
    const f = skills.find(s => s.value === `skill:${grp.slice(5)}`);
    skillValue = f?.value || skillValue;
  }
  return {
    name: p.n, type: p.type, gmMod: mod, testChar: CH[ch] || "int",
    skillValue, assistBonus: 10, aversionPerFail: p.pf ?? 5
  };
}
