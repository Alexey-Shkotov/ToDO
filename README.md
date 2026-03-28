# ToDo Planner

Минималистичный ToDo-планер с календарём, XP-системой и анимацией частиц.
Данные хранятся локально в SQLite (файл на компьютере).

## Запуск

```bash
npm install      # зависимости + пересборка better-sqlite3 под Electron
npm start        # запуск приложения
```

> `npm install` автоматически запускает `electron-rebuild` через `postinstall`.
> Это обязательно — SQLite нужно пересобрать под версию Node внутри Electron.

## База данных

Файл `todo.db` создаётся автоматически при первом запуске:
- **Linux:** `~/.config/todo-planner/todo.db`
- **Windows:** `%APPDATA%\todo-planner\todo.db`
- **macOS:** `~/Library/Application Support/todo-planner/todo.db`