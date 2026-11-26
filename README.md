# Пердёж-балдёж

Один плот на всех, вместо мотора — экипаж. Telegram Mini App: бот @PerdezhBaldezhBot.

- `sim.js` — правила реки (одни и те же на сервере и в телефоне)
- `game.js`, `index.html` — картинка и управление
- `server/worker.js` — комнаты для друзей (Cloudflare Worker + Durable Object) и бот
- каждый push уходит только на тестовую копию `perdezh-test`; настоящая игра обновляется запуском workflow с `prod`
