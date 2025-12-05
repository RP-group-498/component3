# Focus - Productivity App (Electron)

A minimal Task Manager UI for development with Electron.

## Files added

- `index.js` - Electron main process
- `index.html` - UI markup
- `styles.css` - Basic styles
- `renderer.js` - UI behavior and `localStorage` persistence

## Run locally

1. Install dependencies (Electron):

```bash
# Use the project shell (zsh)
npm install --save-dev electron
```

2. Start the app:

```bash
npm start
```

> `npm start` runs `electron .` (the `main` is `index.js`).

## Notes

- Tasks are saved to `localStorage` and will persist between runs on the same user profile.
- This is a simple demo; in production, enable `contextIsolation` and use a `preload.js` for IPC.
