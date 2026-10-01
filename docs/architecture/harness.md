# Harness розробки

**Дата:** 1 жовтня 2026 р.
**Статус:** описує harness на `main` після `T-037`. Документ — карта: хто кого викликає, хто володіє яким фактом і яким шляхом іде зміна.

Цей документ не додає нових рішень і не повторює правил. Чому harness саме такий — у ADR (`ADR-001`, `ADR-002`, `ADR-007`, `ADR-012`, `ADR-014`–`ADR-017`). Механіка gate і файлів у `.gate/` — у `docs/architecture/design/T-029-gate-and-loop.md`. Самі правила — у файлах, на які тут стоять посилання. Якщо тут і в тих файлах написано різне, правий той файл, а цей документ треба виправити.

Мова документа — українська проза з англійськими іменами: назви скілів, агентів, файлів, команд і полів пишуться дослівно.

Відомі слабкі місця harness, їхні workaround і можливі рішення — у `docs/architecture/harness-known-issues.md`.

---

## 1. Що таке harness і з чого він складається

**Harness** — усе, що оточує агента під час роботи з репозиторієм, крім коду продукту: інструкції, скіли, субагенти, hooks, локальний gate, CI і файли стану. Його мета — щоб зміна потрапила в `main` перевіреною, а перевірка не залежала від того, що агент «пам'ятає».

| Елемент | Шлях | Роль |
|---|---|---|
| Кореневі інструкції | `CLAUDE.md` | карта документації, мовне правило, команди, два шляхи зміни, правила дешевих викликів |
| Інструкції піддерева | `docs/backlog/CLAUDE.md` | конвенції backlog: frontmatter, `README.md`, «що, а не чому» |
| Налаштування | `.claude/settings.json` | реєструє `SessionStart` hook |
| Hook | `.claude/hooks/session-start-fetch.sh` | `git fetch origin` і безпечний fast-forward `main` |
| Скіл | `.claude/skills/teachers-ticket/SKILL.md` | повний цикл тікета, фази 1–7 |
| Скіл | `.claude/skills/teachers-fix-loop/SKILL.md` | обмежений цикл review → fix |
| Скіл | `.claude/skills/teachers-review/SKILL.md` | рев'ю проти документів, тільки читає |
| Скіл | `.claude/skills/vam-handoff/SKILL.md` | загальний handoff розмови, у цикл не входить |
| Субагент | `.claude/agents/teachers-review-round.md` | межа контексту одного раунду fix-loop |
| Субагент | `.claude/agents/teachers-review-contract.md` | прохід «diff ↔ тікет ↔ документи» |
| Локальний gate | `scripts/gate/*` → `npm run gate` | вибирає і запускає перевірки, веде `.gate/` |
| Вартість сесії | `scripts/cost/transcript-cost.ts` → `npm run cost` | рахує виклики й токени сесії за її transcript |
| CI | `.github/workflows/ci.yml` | авторитетний gate на кожен push (`ADR-007`) |
| Стан поза контекстом | `.gate/` (git-ignored) | `run.json`, `findings.json`, `ledger.jsonl`, `last-run.json` |
| Документи-стандарт | `docs/architecture/**`, `docs/specs/**`, `docs/tech-stack.md` | те, проти чого рев'ю міряє зміну |

Зовнішні скіли, які harness викликає, але не визначає: `/code-review` (загальна коректність) і вбудовані субагенти `Plan` та general-purpose.

Усі скіли й агенти проєкту мають префікс `teachers-` (`ADR-002`). `vam-handoff` — виняток: він старший за `ADR-002` і не є частиною циклу.

---

## 2. Наскрізні принципи

Ці принципи пояснюють, чому елементи розкладені саме так. Кожен має свій ADR.

1. **Стандарт — документи, прочитані під час рев'ю** (`ADR-001`). Скіли містять метод, а не правила. Правило, скопійоване в скіл, перестає збігатися з документом при першій зміні документа.
2. **Кожен факт — в одному місці.** Ліміти циклу — тільки `scripts/gate/caps.ts`. Список перевірок — тільки `scripts/gate/checks.ts`. Рівень `--effort` для self-review — тільки `teachers-ticket` фаза 7. Інші файли на це посилаються. `scripts/gate/skills.test.ts` перевіряє, що жоден скіл чи агент не пише число з `caps.ts`.
3. **Рев'ю вимірює, цикл виправляє** (`ADR-014`). `teachers-review` і обидва субагенти нічого не редагують. Редагує тільки `teachers-fix-loop` (і `teachers-ticket`, який його викликає).
4. **Рев'ю обмежене зміною** (`ADR-015`). Читаються тільки документи, до яких дотягуються змінені шляхи. Дефект, який зміна не спричинила, — не finding цього рев'ю.
5. **Маршрут за типом зміни** (`ADR-016`). `changeKind()` у `scripts/gate/checks.ts` ділить diff на `code` і `documentation`. І gate, і рев'ю користуються тією самою функцією.
6. **Одне визначення перевірок** (`ADR-012`). `checks.ts` і `ci.yml` описують одне й те саме. `scripts/gate/checks.ci.test.ts` падає, якщо вони розходяться. Єдине навмисне розходження задеклароване в тому ж тесті: gate не запускає `test` і `build` для `documentation`, а CI запускає їх на кожен push.
7. **Стан живе поза контекстом** (`ADR-017`). Довгий запуск пише стан у `.gate/run.json` на кожній межі фаз. Кожен раунд рев'ю — окремий субагент. Лічильники беруться з файлів, які агент не писав, а не з пам'яті розмови.
8. **CI — останнє слово** (`ADR-007`). Локальний gate може щось пропустити (`skipped`): немає Docker, немає `DATABASE_URL`, або тип зміни не потребує перевірки. `skipped` ніколи не означає «пройшло». Merge спирається тільки на зелений `ci.yml`.

---

## 3. Два шляхи зміни

Кореневий `CLAUDE.md` визначає, коли потрібен повний цикл тікета, а коли — пряма зміна. Тут — як кожен шлях проходить через harness.

### 3.1 Ticket run

Для всього, що змінює модель даних, контракт, екран або поведінку, яку бачить вчитель. Тобто для `T-NNN` у `docs/backlog/`.

```
SessionStart hook ── git fetch origin
        │
        ▼
/teachers-ticket
  1 Choose ─ 2 Branch+read ─ 3 Ask ─ 4 Plan ─ 5 Implement ─ 6 Gate+PR ─┐
                                                                     │
  7 ──► /teachers-fix-loop ──(раунди)──► return {exit, rounds, ...}  │
        │                                                            │
        ▼                                                            │
  чекбокси AC, status: done, gh pr checks ◄──────────────────────────┘
        │
        ▼
ci.yml (checks, integration, images) ── зелений ──► merge PR ──► publish to GHCR
```

### 3.2 Пряма зміна

Для змін тільки в `docs/backlog/**`, опечаток, виправлень, які вже знайшло інше рев'ю.

```
гілка від origin/main → коміт → npm run gate → /teachers-review → PR → ci.yml → merge
```

Тут fix-loop не обов'язковий. Але `/teachers-review` обов'язковий, і `main` змінюється тільки через merge PR — так само, як у ticket run. `/teachers-fix-loop` можна викликати і для PR без тікета: це його другий caller.

---

## 4. `SessionStart` hook

`.claude/settings.json` реєструє `.claude/hooks/session-start-fetch.sh` на старт кожної сесії. Hook робить дві речі і пише, яка з них відбулась:

- **`git fetch origin`** — робить `origin/main` актуальним. Від цього ref рахуються всі diff: gate, рев'ю, нова гілка. Більше ніщо в репозиторії fetch не робить.
- **`git merge --ff-only origin/main`** — тільки коли це однозначно: `HEAD` — це `main`, tree чистий, `main` позаду і не має своїх комітів. В інших випадках tree не чіпається, а hook пише, на скільки він відстає.

Наслідок для читання файлів описаний у кореневому `CLAUDE.md` («A session starts from a current main»): до того, як гілку створено, файли читаються з `origin/main` через `git show`, а не з диска. Якщо hook не зміг виконати fetch, сесія каже, що стан репозиторію не перевірено.

---

## 5. `/teachers-ticket` — повний цикл тікета

Оркестратор. Веде один тікет від вибору до PR і володіє розмовою з користувачем. Сім фаз, строго по черзі.

| Фаза | Що робить | Що пише в `.gate/run.json` |
|---|---|---|
| 1 Choose | перший `todo` за порядком у `docs/backlog/README.md`; frontmatter читає з `origin/main`; перевіряє `depends_on` | `ticket`, `ticketPath`, `flags` |
| 2 Branch + read | `git checkout -b claude/ticket-t-NNN-… origin/main`; читає тікет, `refs:`, glossary, код | `branch` |
| 3 Ask | один раунд `AskUserQuestion`, тільки про те, чого документи не вирішують | відповіді |
| 4 Plan | план до будь-якого редагування; для великого тікета — через `Plan`; схвалення користувача; за тригером план стає файлом у `docs/architecture/design/` | `plan`, `criteria`, `designDoc` |
| 5 Implement | код, ADR за тригером, `status: in-progress`; чекбокси AC **не** ставить | `filesTouched`, стан `criteria` |
| 6 Gate + PR | `npm run gate`, push, PR з таблицею gate і кожним `skipped` з причиною | `pr` |
| 7 Fix loop | викликає `/teachers-fix-loop`; після нього — чекбокси AC з доказом, `status: done`, звірка design doc, `gh pr checks`, `npm run gate -- --report` | причина виходу, що лишилось |

Ключові властивості:

- **`--resume`** продовжує запуск тільки з `.gate/run.json`, без контексту попередньої сесії.
- **`--persist-plan` / `--no-persist-plan`** примусово вирішують, де живе план фази 4.
- Фаза 7 сама цикл не описує. Вона викликає `/teachers-fix-loop` і задає `--effort medium`. Це єдине місце, де записаний рівень для self-review.
- Те, що можливо тільки з тікетом (чекбокси, `status`, design doc), робить `teachers-ticket`, а не цикл.

---

## 6. `/teachers-fix-loop` — обмежений цикл виправлень

```
review → triage → fix → gate → re-review
```

Єдине місце, де цикл записаний (`ADR-014`). Має два caller-и: `teachers-ticket` фаза 7 і PR без тікета.

**Вхід:** `--state <path>`, `--pr <n>`, `--effort <level>`; опційно `--ticket <path>`, `--merge`, `--comment` (передаються в рев'ю без змін).

**Вихід:** один об'єкт — `exit` (`converged` | `cap` | `blocked`), `cap`, `rounds`, `undisposed`, `outsideThisChange`, `head`, `gate`, `deferred`.

**Один раунд:**

1. Запускає субагента `teachers-review-round`. Він викликає `/teachers-review <pr> --self-review T-NNN --effort <level>` і повертає тільки JSON з findings. Diff, документи і міркування лишаються в контексті субагента.
2. Записує раунд у `.gate/findings.json` до будь-якого виправлення.
3. Кожному finding дає одну disposition:

   | Disposition | Що потрібно |
   |---|---|
   | `fixed` | коміт, що змінює названий `file:line` |
   | `rejected` | цитата з документа, яка спростовує правило |
   | `deferred` | `T-NNN`, який реально існує в backlog |
   | `accepted` | користувач сказав так у цій розмові |

4. Один коміт з виправленнями, потім `npm run gate`. Якщо `.gate/last-run.json` уже описує цей `HEAD` і tree чистий — gate не запускається вдруге.
5. Push, запис результату в state-файл, наступний раунд.

**Ліміти** — `reviewRounds`, `gateRunsPerRound`, `pushesAfterOpening` у `scripts/gate/caps.ts`. Лічильники беруться з `.gate/ledger.jsonl` і історії гілки, а не з розмови. Досягнутий ліміт зупиняє цикл з `exit: "cap"`.

**Вихід із циклу** — перший раунд без findings усередині diff. Підтверджувальний раунд не потрібен: рев'ю тільки читає, тому порожній звіт описує саме попередні виправлення.

**CI** читається через `gh pr checks <pr> --watch`, ніколи через `sleep`.

---

## 7. `/teachers-review` — рев'ю проти документів

Рев'ю PR, гілки або незакомічених змін. **Нічого не редагує.** Після рев'ю може тільки коментувати PR і робити merge, і тільки за прапорцями.

### 7.1 Аргументи

| Аргумент | Значення | Review mode | Self-review |
|---|---|---|---|
| `--effort` | `low` \| `medium` \| `high` \| `max` | `high` | задає caller (`medium` з `teachers-ticket`) |
| `--merge` | `no` \| `ask` \| `auto` | `ask` | `no` |
| `--comment` / `--no-comment` | — | `--comment` | `--no-comment` |
| `--self-review` | `T-NNN` | вимкнено | ставить `teachers-review-round` |

### 7.2 Що змінює `--effort`

`--effort` вирішує, **скільки читання варте одне рев'ю**. Він впливає на три речі одночасно:

1. **Рівень, який отримує `/code-review`.** Назви рівнів — ті самі, що в `/code-review`. `low` і `medium` дають менше findings, але з високою впевненістю. `high` і `max` дають ширше покриття і можуть включати менш певні findings.
2. **Як далеко фаза 2 читає документи.** Кожен рівень додає шар до попереднього:

   | `--effort` | Що читається (накопичувально) |
   |---|---|
   | `low` | `CLAUDE.md` кожної директорії, куди пише diff (кореневий і піддерев) |
   | `medium` | + тікет і всі шляхи з його `refs:`, + ADR, що покривають змінені шляхи |
   | `high` | + розділи `architect-overview.md` для шарів цих шляхів, + `glossary.md` для їхніх термінів, + `docs/tech-stack.md` |
   | `max` | + код, який diff не змінює, але від якого залежить — перевіряються припущення зміни про цей код |

3. **Чи запускається фаза 6** — пропозиція перетворити повторюваний finding на lint rule або convention test. Тільки на `max`.

Чого `--effort` **не** змінює:

- **Набір проходів.** Його визначає тип зміни (`changeKind()`), а не `--effort`. Див. 7.3.
- **Планку для finding.** На будь-якому рівні finding має `file:line`, цитату правила і конкретний failure scenario.
- **Обмеження зміною.** На будь-якому рівні читаються тільки документи, до яких дотягуються змінені шляхи. `--effort` задає глибину від цих шляхів, а не ширину по репозиторію.

П'ятий рівень `/code-review`, `ultra`, не пропонується: це платне хмарне рев'ю, яке скіл не може запустити від імені користувача.

Авторитетна таблиця рівнів — у `.claude/skills/teachers-review/SKILL.md`, фаза 1. Якщо вона зміниться, ця секція має бути виправлена.

### 7.3 Проходи і тип зміни

| Тип | `teachers-review-contract` | `/code-review` | Власне читання архітектури |
|---|---|---|---|
| `code` | так | так | так |
| `documentation` | так | **ні** | так |

Diff, у якому є хоч один файл з кодом, — це `code`, і він рев'юїться повністю. Звіт завжди каже, які проходи справді відбулися.

### 7.4 Що скіл вважає «архітектурою»

Прохід «власне читання проти архітектури» не має окремого фіксованого списку документів. **«Архітектура» для нього — це все, що прочитала фаза 2.** А фаза 2 визначається змінними шляхами і рівнем `--effort` (таблиця в 7.2). Тобто джерела такі:

| Джерело | Що звідти береться | З якого рівня |
|---|---|---|
| `CLAUDE.md` (кореневий і піддерев, напр. `docs/backlog/CLAUDE.md`) | інваріанти коду: немає `new Date()` у domain, `userId` — перший аргумент у `lib/db/queries`; шари з «Code layout»; мовне правило; «один факт — одне місце» | `low` |
| `refs:` тікета | ті розділи `architect-overview.md` і `docs/specs/**`, на які посилається тікет | `medium` |
| `docs/architecture/decisions/ADR-*.md` | ухвалені рішення для зачепленої області; код, що їх реалізує, — не дефект | `medium` |
| `docs/architecture/architect-overview.md` | розділи для шарів, до яких належать змінені шляхи (§2 шари, §8 наскрізні рішення тощо) | `high` |
| `docs/architecture/glossary.md` | англійський ідентифікатор для кожного доменного терміна | `high` |
| `docs/tech-stack.md` | стек; тут стандартом стає власне знання агента про цей стек — межі довіри, пастки запитів і рендеру | `high` |
| код навколо diff | припущення зміни про незмінений код | `max` |

Розподіл ролей між проходами:

- `teachers-review-contract` — чи виконує diff тікет, і чи документи після зміни узгоджені між собою;
- `/code-review` — загальна коректність, reuse, спрощення;
- власне читання — чи дотримується diff інваріантів, які записані в цих документах. Для `documentation` це мовне правило, «один факт — одне місце» і glossary.

**Наслідок, який варто знати.** Self-review у `teachers-ticket` іде на `medium`. На цьому рівні `architect-overview.md` читається тільки через `refs:` тікета, а glossary і `tech-stack.md` не читаються зовсім. Тому якість `refs:` у тікеті прямо впливає на те, що self-review вважатиме архітектурою. Ширше читання — standalone `/teachers-review` (за замовчуванням `high`) або ручний запуск раунду з вищим рівнем.

### 7.5 Фази

1. **Resolve** — target, тікет, аргументи, тип зміни, розмір diff — одним рядком. Target треба зробити checkout, інакше diff буде порожнім.
2. **Read the standard** — див. 7.2 і 7.4.
3. **Mechanical verdict** — за пріоритетом: CI на цьому head → `.gate/last-run.json` для того самого head і tree → `npm run gate`. Verdict рахується тільки для того head і tree, на яких він отриманий.
4. **Passes** — паралельно, за таблицею 7.3.
5. **Reconcile, drop, rank, report** — finding без `file:line`, цитати правила або failure scenario викидається. Дефект, який зміна не спричинила, викидається. Виняток — security або data-correctness: вони йдуть у `## Outside this change`. Порядок: security/data → архітектурний інваріант → контракт з тікетом/документами → спрощення.
6. **Make the next review cheaper** — тільки на `max`, тільки пропозиція.
7. **Merge** — тільки якщо нуль findings, зелений `ci.yml` на цьому head і PR mergeable. `--merge` вирішує лише, хто натискає кнопку.

---

## 8. Субагенти

| Агент | Хто викликає | Вхід | Вихід | Обмеження |
|---|---|---|---|---|
| `teachers-review-round` | `teachers-fix-loop`, раз на раунд | state-файл, шлях тікета або `none`, номер PR, `--effort` | JSON раунду у формі `.gate/findings.json`, без `disposition` | не редагує, не запускає gate, не питає користувача, не повертає diff і міркування |
| `teachers-review-contract` | `teachers-review`, фаза 4 | diff (або команда), id і шлях тікета | findings з цитатою правила і вердикт по AC | не редагує; `Bash` тільки для читання |

Навіщо субагент на раунд (`ADR-017`): кожен виклик інструмента знову відправляє весь контекст сесії. Якщо раунд читає diff і документи в основній сесії, кожен наступний виклик платить за це знову. Субагент тримає це читання у своєму контексті і повертає тільки маленький JSON.

---

## 9. Локальний gate — `npm run gate`

Механіка — `docs/architecture/design/T-029-gate-and-loop.md`. Тут — роль у harness.

- **Preflight Node.** `scripts/gate/nodeVersion.ts` перевіряє версію проти `.nvmrc` до вибору будь-якої перевірки.
- **Вибір перевірок** — `scripts/gate/checks.ts`, два виміри: шляхи (які додаткові перевірки підтягує зміна — БД, Docker) і `changeKind()` (чи потрібні `test` і `build` взагалі).
- **`hygiene`** — `scripts/gate/hygiene.ts`: властивості diff, яких CI не бачить (сфокусовані тести, env-файли в diff, блок, який дописує `next dev`).
- **Без short-circuit.** Запускаються всі вибрані перевірки, одна таблиця, ненульовий exit, якщо щось упало.
- **`skipped` з причиною** — машина не може (Docker, `DATABASE_URL`) або тип зміни не потребує. Ніколи не «пройшло».
- **`--pr-block`** друкує блок для тіла PR. **`--report`** нічого не запускає: читає лічильники і CI і відмовляє, якщо ліміт вичерпано або CI не зелений.

### Файли `.gate/`

| Файл | Хто пише | Хто читає |
|---|---|---|
| `ledger.jsonl` | gate, рядок на перевірку на запуск (`commit`, `dirty`, `result`) | fix-loop — лічильники `gateRunsPerRound` |
| `last-run.json` | gate, весь останній запуск | рев'ю фаза 3, fix-loop крок 4, `--report` |
| `findings.json` | fix-loop | наступний раунд, відновлена сесія |
| `run.json` | `teachers-ticket` (і ключ `loop` — fix-loop) | кожна фаза, `teachers-review-round`, `--resume` |

---

## 10. CI — `.github/workflows/ci.yml`

Авторитетний gate (`ADR-007`). Запускається на кожен push без фільтра шляхів.

| Job | Що перевіряє |
|---|---|
| `checks` | `lint`, `typecheck`, `test`, `build` |
| `integration` | `db:migrate`, `scripts/verify-schema.sql`, `test:integration` проти service-container Postgres |
| `images` | збірка runner і migrator, smoke-тест migrator |
| `publish` | публікація в GHCR, тільки на `main` і тільки після трьох попередніх |

`checks.ci.test.ts` тримає `checks.ts` і три gate-jobs синхронними. Скіли читають результат CI через `gh pr checks`.

---

## 11. Інші елементи

- **`npm run cost`** (`scripts/cost/transcript-cost.ts`) — читає transcript сесії і показує кількість викликів, розмір контексту і розподіл токенів по фазах. Інструмент для рішень про форму циклу, а не частина циклу.
- **Правила дешевих викликів** — кореневий `CLAUDE.md`, «Two habits that keep a call small»: незалежні виклики в одному повідомленні, великий вивід — у файл і читати звуженим.
- **`vam-handoff`** — стискає розмову в handoff-документ для нової сесії. Загальний скіл, не знає про `.gate/`. Для `teachers-ticket` роль handoff виконує `.gate/run.json` і `--resume`.

---

## 12. Хто володіє яким фактом

| Факт | Єдине місце |
|---|---|
| ліміти циклу | `scripts/gate/caps.ts` |
| список перевірок і маршрутизація | `scripts/gate/checks.ts` |
| тип зміни (`code` / `documentation`) | `changeKind()` у `scripts/gate/checks.ts` |
| рівень `--effort` для self-review | `teachers-ticket`, фаза 7 |
| що дає кожен рівень `--effort` | `teachers-review`, таблиця у фазі 1 |
| цикл, dispositions, вихід | `teachers-fix-loop` |
| умови merge | `teachers-review`, фаза 7 |
| конвенції backlog | `docs/backlog/CLAUDE.md` |
| архітектурні правила | `architect-overview.md`, ADR, `CLAUDE.md` |
| версія Node | `.nvmrc` |

Тести, що тримають ці правила механічно: `scripts/gate/skills.test.ts` (скіли не пишуть чисел лімітів), `scripts/gate/checks.ci.test.ts` (gate ↔ CI), `scripts/gate/nodeVersion.ci.test.ts` (версія Node скрізь однакова), `scripts/gate/checks.routing.test.ts` (маршрутизація).
