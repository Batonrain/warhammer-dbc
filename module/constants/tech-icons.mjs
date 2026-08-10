// module/constants/tech-icons.mjs
// SVG-иконки для механики Техночудес: Когниция (⚙ зелёная — разум+машина)
// и Энергия (⚡ жёлтая — заряд Катушки Потенции). Инлайн, размер 1em, тянутся
// по высоте строки. Тематический цвет задаётся классом (см. actor-effects.css),
// поэтому используют fill/stroke = currentColor. Вставляются через {{{techIcon "cognition"}}}.

// Когниция — шестерня с нейро-узлом внутри (разум, вводящий код в машину).
const COGNITION_SVG =
  `<svg class="wh-ico wh-ico-cog" viewBox="0 0 24 24" fill="none" stroke="currentColor" `
  + `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
  + `<circle cx="12" cy="12" r="5.4"/>`
  + `<path d="M12 3.4v2.2M12 18.4v2.2M3.4 12h2.2M18.4 12h2.2`
  + `M6.2 6.2l1.6 1.6M16.2 16.2l1.6 1.6M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6"/>`
  + `<circle cx="12" cy="12" r="1.1"/>`
  + `<path d="M12 9.2v1.6M12 13.2v1.6M9.2 12h1.6M13.2 12h1.6"/>`
  + `</svg>`;

// Энергия — молния в обкладках конденсатора (Катушка Потенции).
const ENERGY_SVG =
  `<svg class="wh-ico wh-ico-en" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">`
  + `<path d="M13.2 2.5 6.4 12.6a.6.6 0 0 0 .5.95h3.1l-2 7.2a.5.5 0 0 0 .9.4l7.2-10.4a.6.6 0 0 0-.5-.95h-3.2l2-6.9a.5.5 0 0 0-.9-.35Z"/>`
  + `</svg>`;

export const TECH_ICONS = {
  cognition: COGNITION_SVG,
  energy:    ENERGY_SVG
};

export function techIcon(key) {
  return TECH_ICONS[key] || "";
}
