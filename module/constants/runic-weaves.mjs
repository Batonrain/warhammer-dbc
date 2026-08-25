// module/constants/runic-weaves.mjs — Рунические Вязи (корбук стр. 433-434).

// Сторона нанесения на носителя: изнутри побеждает снаружи (ближе к телу).
export const RUNIC_WEAVE_POSITIONS = {
  "":      "— не указано —",
  outer:   "Снаружи",
  inner:   "Изнутри"
};

// Каким носителем занята вязь (module/apps/effects.mjs::isItemActive решает
// активность по-разному для каждого).
export const RUNIC_WEAVE_INSTALLED_ON_TYPES = {
  "":        "— не выбрано —",
  carrier:   "Предмет (броня/оружие/держатель)",
  vehicle:   "Техника (сама вязь на акторе техники)",
  region:    "Помещение (Region на сцене)"
};

// Допустимые поверхности по тексту книги — подсказка пикеру, не жёсткая проверка.
export const RUNIC_WEAVE_SURFACE_KINDS = {
  armor:   "Броня/одежда",
  weapon:  "Оружие",
  vehicle: "Бронетехника",
  region:  "Стены/помещение"
};
