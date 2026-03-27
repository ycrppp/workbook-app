# Workbook App — Инструкция запуска

## Локальный запуск (посмотреть на своём компьютере)

### 1. Установи Node.js
Скачай с https://nodejs.org — выбери версию LTS (зелёная кнопка).

### 2. Получи API ключ Anthropic
- Зайди на https://console.anthropic.com
- Раздел "API Keys" → "Create Key"
- Скопируй ключ (начинается с `sk-ant-...`)

### 3. Запусти приложение

Открой папку `workbook-app` в терминале и выполни по очереди:

```bash
npm install
```

```bash
ANTHROPIC_API_KEY=твой_ключ_сюда node server.js
```

На Windows вместо этого:
```bash
set ANTHROPIC_API_KEY=твой_ключ_сюда && node server.js
```

Открой браузер: http://localhost:3000

---

## Деплой онлайн (Railway — бесплатно)

### 1. Создай аккаунт на Railway
https://railway.app — войди через GitHub

### 2. Создай репозиторий на GitHub
- Зайди на https://github.com/new
- Создай новый репозиторий, например `workbook-app`
- Загрузи все файлы из папки `workbook-app`

Или через терминал в папке `workbook-app`:
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/ТВО_ИМЯ/workbook-app.git
git push -u origin main
```

### 3. Задеплой на Railway
- На railway.app нажми "New Project"
- Выбери "Deploy from GitHub repo"
- Выбери свой репозиторий
- Railway сам найдёт Node.js и запустит

### 4. Добавь API ключ
- В Railway открой проект → вкладка "Variables"
- Добавь переменную:
  - Name: `ANTHROPIC_API_KEY`
  - Value: `sk-ant-твой_ключ`
- Нажми "Add" — приложение перезапустится автоматически

### 5. Получи свой URL
- Вкладка "Settings" → "Domains" → "Generate Domain"
- Получишь адрес вида `workbook-app-production.up.railway.app`

Готово — можно делиться с людьми.

---

## Структура файлов

```
workbook-app/
├── server.js        — бэкенд (принимает контекст, обращается к Claude API)
├── package.json     — зависимости
├── .gitignore
└── public/
    └── index.html   — весь фронтенд (онбординг + упражнения)
```

## Как добавить новую книгу

В `server.js` найди объект `BOOKS` и добавь новую книгу по той же структуре:

```javascript
const BOOKS = {
  bangey: { ... },
  novaya_kniga: {
    title: 'Название книги',
    author: 'Автор',
    modules: [
      {
        id: 'module1',
        title: 'Название модуля',
        quote: 'Цитата из книги',
        concept: 'Описание концепции для AI...',
      },
    ],
  },
};
```

## Стоимость

- Railway: бесплатный план — 500 часов/месяц (достаточно для беты)
- Claude API: ~$0.003 за одну генерацию упражнений (3 упражнения)
  При 100 пользователях в день — около $9/день
