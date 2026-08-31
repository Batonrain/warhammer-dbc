import { techIcon } from "../constants/tech-icons.mjs";
import { veilIcon } from "../constants/veil-icons.mjs";

export function registerHandlebarsHelpers() {

  // SVG-иконки Техночудес: {{{techIcon "cognition"}}} / {{{techIcon "energy"}}}
  Handlebars.registerHelper("techIcon", function(key) {
    return new Handlebars.SafeString(techIcon(key));
  });

  // SVG-иконки окна Завесы: {{{veilIcon "ritual"}}} и т.п.
  Handlebars.registerHelper("veilIcon", function(key) {
    return new Handlebars.SafeString(veilIcon(key));
  });


  // Чекбоксы типов оружия в боеприпасах
  Handlebars.registerHelper("ammoHasType", function(weaponTypes, type) {
    if (!Array.isArray(weaponTypes)) return false;
    return weaponTypes.includes(type);
  });

  // Чекбоксы множественного рейтинга свойства узла корабля (rating = "armour,voidShields").
  Handlebars.registerHelper("codeIncludes", function(csv, code) {
    return String(csv ?? "").split(",").map(s => s.trim()).includes(code);
  });

  // Сравнение строгое
  Handlebars.registerHelper("eq", function(a, b) {
    return a === b;
  });

  // Отметка «★» у ранга, выданного архетипом/расой (бесплатного), в выпадашке.
  Handlebars.registerHelper("grantMark", function(rank, granted) {
    return (rank && rank === granted) ? " ★" : "";
  });

  // Сравнение через String() — число vs строка
  Handlebars.registerHelper("eqLoose", function(a, b) {
    return String(a) === String(b);
  });

  // Математика
  Handlebars.registerHelper("lt", function(a, b) {
    return a < b;
  });
  Handlebars.registerHelper("gt", function(a, b) {
    return a > b;
  });
  Handlebars.registerHelper("gte", function(a, b) {
    return a >= b;
  });
  Handlebars.registerHelper("lte", function(a, b) {
    return a <= b;
  });
  Handlebars.registerHelper("multiply", function(a, b) {
    return (parseFloat(a) || 0) * (parseFloat(b) || 0);
  });
  Handlebars.registerHelper("divCeil", function(a, b) {
    return Math.ceil((parseFloat(a) || 0) / (parseFloat(b) || 1));
  });

  // Яд: есть ли вектор в массиве
  Handlebars.registerHelper("poisonHasVector", function(vectorArray, vector) {
    if (!Array.isArray(vectorArray)) return false;
    return vectorArray.includes(vector);
  });

  // Логические хелперы
  Handlebars.registerHelper("and", function(...args) {
    args.pop(); // последний аргумент — options Handlebars
    return args.every(Boolean);
  });
  Handlebars.registerHelper("or", function(...args) {
    args.pop(); // последний аргумент — options Handlebars
    return args.some(Boolean);
  });
  Handlebars.registerHelper("not", function(a) {
    return !a;
  });

  // Знак числа для отображения модификаторов
  Handlebars.registerHelper("signedNum", function(n) {
    const v = parseInt(n) || 0;
    return v >= 0 ? `+${v}` : `${v}`;
  });

  // Список строк в одну строку через разделитель: поле-список схемы
  // (system.aliases у Фракции) правится одним полем ввода, а обратно в
  // массив его разбирает обработчик листа.
  Handlebars.registerHelper("join", function(list, sep) {
    const s = typeof sep === "string" ? sep : ", ";
    return Array.isArray(list) ? list.join(s) : "";
  });
}