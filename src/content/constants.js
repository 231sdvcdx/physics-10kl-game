// Physical constants page of the formula notebook (unlock as topics are reached)
export const CONSTANTS = [
  { id: 'c', tex: 'c', name: 'Скорость света в вакууме', value: 'c = 3{,}00\\cdot10^{8}\\ \\text{м/с}', num: 3e8, unit: 'м/с', ref: 'справочно (стандартная программа)', chapter: 'prologue' },
  { id: 'g', tex: 'g', name: 'Ускорение свободного падения (у поверхности Земли)', value: 'g \\approx 9{,}8\\ \\text{м/с}^2', num: 9.8, unit: 'м/с²', ref: '§7, с. 44', chapter: 'ch1' },
  { id: 'G', tex: 'G', name: 'Гравитационная постоянная', value: 'G = 6{,}67\\cdot10^{-11}\\ \\text{Н·м}^2/\\text{кг}^2', num: 6.67e-11, unit: 'Н·м²/кг²', ref: '§26', chapter: 'ch1' },
  { id: 'atm', tex: 'p_0', name: 'Нормальное атмосферное давление', value: 'p_0 = 1{,}013\\cdot10^{5}\\ \\text{Па}', num: 1.013e5, unit: 'Па', ref: '§39', chapter: 'ch1' },
  { id: 'NA', tex: 'N_A', name: 'Постоянная Авогадро', value: 'N_A = 6{,}02\\cdot10^{23}\\ \\text{моль}^{-1}', num: 6.02e23, unit: 'моль⁻¹', ref: '§44', chapter: 'ch2' },
  { id: 'kB', tex: 'k', name: 'Постоянная Больцмана', value: 'k = 1{,}38\\cdot10^{-23}\\ \\text{Дж/К}', num: 1.38e-23, unit: 'Дж/К', ref: '§51', chapter: 'ch2' },
  { id: 'R', tex: 'R', name: 'Универсальная газовая постоянная', value: 'R = 8{,}31\\ \\text{Дж/(моль·К)}', num: 8.31, unit: 'Дж/(моль·К)', ref: '§49', chapter: 'ch2' },
  { id: 'T0', tex: 'T_0', name: 'Абсолютный нуль по шкале Цельсия', value: '0\\ \\text{К} = -273{,}15\\ ^{\\circ}\\text{C}', num: 273.15, unit: 'К', ref: '§46', chapter: 'ch2' },
  { id: 'e', tex: 'e', name: 'Элементарный заряд', value: 'e = 1{,}6\\cdot10^{-19}\\ \\text{Кл}', num: 1.6e-19, unit: 'Кл', ref: '§67', chapter: 'ch3' },
  { id: 'kC', tex: 'k', name: 'Коэффициент в законе Кулона', value: 'k = \\frac{1}{4\\pi\\varepsilon_0} = 9\\cdot10^{9}\\ \\text{Н·м}^2/\\text{Кл}^2', num: 9e9, unit: 'Н·м²/Кл²', ref: '§68', chapter: 'ch3' },
  { id: 'eps0', tex: '\\varepsilon_0', name: 'Электрическая постоянная', value: '\\varepsilon_0 = 8{,}85\\cdot10^{-12}\\ \\text{Кл}^2/(\\text{Н·м}^2)', num: 8.85e-12, unit: 'Кл²/(Н·м²)', ref: '§68', chapter: 'ch3' },
  { id: 'me', tex: 'm_e', name: 'Масса электрона', value: 'm_e = 9{,}1\\cdot10^{-31}\\ \\text{кг}', num: 9.1e-31, unit: 'кг', ref: '§67', chapter: 'ch3' },
];
export const CONST_BY_ID = Object.fromEntries(CONSTANTS.map(c => [c.id, c]));
