**Next.js как fullstack.** Server Actions и Route Handlers дают вам бэкенд в том же проекте. Типы моделей БД идут напрямую в компоненты, без слоя DTO. Для однопользовательского приложения с нагрузкой «один учитель» это не компромисс, а честная экономия.

**Claude Code.** Это практический аргумент, не маркетинговый: на Next.js + Tailwind + shadcn/ui у модели радикально больше качественного материала, чем на Blazor или ASP.NET+React связке. Итерации по UI будут заметно быстрее и точнее — а UI здесь основная работа.

**Drizzle вместо Prisma.** Prisma тянет отдельный движок и заметно жрёт память; Drizzle — тонкий слой над SQL, синтаксис близок к тому, что вы знаете по EF Core. Миграции через `drizzle-kit`.

**PostgreSQL, не SQLite.** SQLite для одного пользователя технически достаточно, но вы прямо закладываете переход на мультипользовательский режим. Postgres в Docker ест ~80–120 МБ RAM — на CX23 это ничто, а миграцию потом делать не придётся.

## Полный стек

|Слой|Выбор|
|---|---|
|Frontend + Backend|Next.js 15, TypeScript|
|Стилизация|Tailwind + shadcn/ui|
|ORM|Drizzle|
|БД|PostgreSQL 16 (Docker)|
|Auth|better-auth (проще Auth.js, из коробки готов к мультитенантности)|
|Валидация|Zod (он же — схема для structured output от ИИ)|
|ИИ|`@anthropic-ai/sdk`, tool use для structured output|
|Фоновые задачи|таблица-очередь + `node-cron`. BullMQ/Redis на этом этапе — лишняя сущность|
|Reverse proxy|Caddy (автоматический TLS)|
|Деплой|Docker Compose + GitHub Actions → GHCR → `docker compose pull`|

Один нюанс по деплою: **не собирайте Next.js на самом VPS**. На shared vCPU это займёт 