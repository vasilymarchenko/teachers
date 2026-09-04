import type {
  BoundaryKind,
  NonTeachingKind,
  Parity,
  Weekday,
} from "@/lib/db/schema/enums";
import {
  BOUNDARY_KIND_VALUES,
  NON_TEACHING_KIND_VALUES,
  PARITY_VALUES,
  WEEKDAY_VALUES,
} from "@/lib/validation/enums";

/**
 * Every word the year-setup screen shows the teacher — Ukrainian, because she
 * reads it (root `CLAUDE.md`, language by audience). The sections hold no
 * literal text of their own, exactly as the calendar's components hold none:
 * a word is reworded here and changes everywhere it appears.
 *
 * `fullDate` is re-exported from the calendar's labels rather than written
 * again: a date the teacher reads has to have one format in the whole
 * application.
 */
export { fullDate } from "@/components/calendar/labels";

/** An option of a `<select>` — the value stored, the word shown. */
export type Option<Value extends string> = { value: Value; label: string };

const optionsFor = <Value extends string>(
  values: readonly Value[],
  labels: Record<Value, string>,
): Option<Value>[] => values.map((value) => ({ value, label: labels[value] }));

/**
 * Glossary §1 — the three kinds of non-teaching period, in the words the
 * glossary binds them to. Not a shorter wording invented here: the glossary is
 * where a product term is decided, and a screen that abbreviates «державне
 * свято» to «Свято» gives the teacher two names for one row as soon as the next
 * screen is written from the glossary instead of from this file.
 */
export const NON_TEACHING_KIND_LABELS: Record<NonTeachingKind, string> = {
  BREAK: "Канікули",
  PUBLIC_HOLIDAY: "Державне свято",
  OTHER: "Позаплановий вихідний",
};

/** Glossary §1 — `MON` … `SUN`, in the order a week runs (overview §8.5). */
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MON: "Понеділок",
  TUE: "Вівторок",
  WED: "Середа",
  THU: "Четвер",
  FRI: "П’ятниця",
  SAT: "Субота",
  SUN: "Неділя",
};

/**
 * Glossary §4 — how the teacher said the rule ends, kept for display and for
 * nothing else (overview §8.1).
 */
export const BOUNDARY_KIND_LABELS: Record<BoundaryKind, string> = {
  DATE: "До вибраної дати",
  NEXT_BREAK: "До найближчих канікул",
  END_OF_SEMESTER: "До кінця семестру",
};

export const PARITY_OPTION_LABELS: Record<Parity, string> = {
  NUMERATOR: "Чисельник",
  DENOMINATOR: "Знаменник",
};

export const NON_TEACHING_KIND_OPTIONS = optionsFor(
  NON_TEACHING_KIND_VALUES,
  NON_TEACHING_KIND_LABELS,
);
export const WEEKDAY_OPTIONS = optionsFor(WEEKDAY_VALUES, WEEKDAY_LABELS);
export const BOUNDARY_KIND_OPTIONS = optionsFor(
  BOUNDARY_KIND_VALUES,
  BOUNDARY_KIND_LABELS,
);
export const PARITY_OPTIONS = optionsFor(PARITY_VALUES, PARITY_OPTION_LABELS);

/** The page itself — specification §3. */
export const PAGE_LABELS = {
  title: "Навчальний рік",
  intro:
    "Тут задається каркас року: межі, семестри, канікули, дні тижня без уроків, розклад дзвінків і відлік парності. Усі ці параметри можна змінити будь-коли.",
  selectedYear: "Навчальний рік, який редагуємо",
  noYears:
    "Навчальних років ще немає. Додайте перший — після цього з’являться решта налаштувань.",
  toCalendar: "Перейти до календаря",
};

/** The buttons every section shares. */
export const ACTION_LABELS = {
  add: "Додати",
  save: "Зберегти",
  saving: "Зберігаємо…",
  remove: "Видалити",
};

export const YEAR_SECTION = {
  title: "Межі навчального року",
  description:
    "Дата початку й дата закінчення року, а також те, з чого починається чергування тижнів.",
  dateFrom: "Перший день року",
  dateTo: "Останній день року",
  initialParity: "Рік починається з",
  addTitle: "Новий навчальний рік",
  /** Deleting a year takes the frame that hangs off it — see the action. */
  removeConfirm:
    "Видалити навчальний рік разом із семестрами, канікулами, правилами днів тижня та точками відліку парності?",
};

export const SEMESTERS_SECTION = {
  title: "Семестри",
  description:
    "Рік ділиться на два семестри. Канікули всередині семестру його не завершують — вони задаються окремо, нижче.",
  index: "Семестр",
  dateFrom: "Перший день",
  dateTo: "Останній день",
  empty: "Семестрів ще немає.",
  removeConfirm: "Видалити цей семестр?",
  option: (index: number) => (index === 1 ? "Перший" : "Другий"),
};

export const PERIODS_SECTION = {
  title: "Канікули, свята та інші неробочі дні",
  description:
    "У ці дні уроків немає: календар показує їх як неробочі. Свято — це період завдовжки в один день.",
  kind: "Вид",
  name: "Назва",
  dateFrom: "Перший день",
  dateTo: "Останній день",
  empty: "Неробочих періодів ще немає.",
  removeConfirm: "Видалити цей неробочий період?",
  /**
   * Overview §8.1, the accepted cost: «до найближчих канікул» was turned into a
   * date when the rule was written, and moving the break afterwards does not
   * move it back.
   */
  datesWarning:
    "Якщо змінити дати цього періоду, правила, які закінчувалися на ньому, залишаться зі старою датою — їх треба перевірити нижче, у розділі «Дні тижня без уроків».",
};

export const RULES_SECTION = {
  title: "Дні тижня без уроків",
  description:
    "Наприклад, методичний день. Правило діє не обов’язково весь рік — вкажіть, доки воно триває.",
  weekday: "День тижня",
  boundaryKind: "Діє",
  lastDay: "Останній день дії",
  lastDayHint: "Потрібен лише для варіанта «До вибраної дати».",
  validFrom: "Діє з",
  until: "Діє до",
  empty: "Правил ще немає — уроки є всі сім днів тижня, зокрема в суботу й неділю.",
  removeConfirm: "Видалити це правило?",
};

export const BELLS_SECTION = {
  title: "Розклад дзвінків",
  description:
    "Уроки нумеруються від 0 до 9. Заповніть лише ті номери, які справді є в розкладі; порожній рядок означає, що такого уроку немає.",
  /**
   * Each input names its own lesson: ten rows of «Початок» would leave a
   * screen reader saying the same word ten times.
   */
  timeFrom: (lessonNumber: number) => `Урок ${lessonNumber}, початок`,
  timeTo: (lessonNumber: number) => `Урок ${lessonNumber}, кінець`,
  shared: "Розклад дзвінків спільний для всіх навчальних років.",
};

export const PARITY_SECTION = {
  title: "Відлік чисельника й знаменника",
  description:
    "Тижні чергуються автоматично від початку року. Після канікул відлік можна почати заново — таких точок може бути кілька.",
  initial: "Початок року",
  initialHint:
    "Задається вище, у межах навчального року.",
  initialMissing:
    "На перший день року немає точки відліку. Збережіть межі року ще раз, щоб її створити.",
  date: "З якої дати",
  parity: "Починається з",
  addTitle: "Нове скидання відліку",
  empty: "Скидань відліку немає — тижні чергуються від початку року.",
  removeConfirm: "Видалити цю точку відліку?",
};
