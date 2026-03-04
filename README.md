# Intervention UI Demo

A collection of standalone, reusable intervention UI components designed to help users overcome procrastination and maintain focus. Built with vanilla JavaScript and Electron.

## Features

This demo showcases 7 different intervention strategies:

1. **2-Minute Rule** - Encourages starting with just 2 minutes of work
2. **Pomodoro** - Suggests a 25-minute focused work session
3. **Just Start** - Helps overcome initial resistance by starting small
4. **Breathing Exercise** - Guided breathing animation to reduce stress (3 cycles)
5. **Visualization** - Mental rehearsal of task completion
6. **Reframe** - Cognitive reframing of task perception
7. **System Notification** - Native OS notification example

## Installation

```bash
# Install dependencies
npm install

# Start the demo app
npm start
```

## Components

### InterventionUI Module

Located in `frontend/modules/interventionUI.js`, this module provides three main functions:

#### 1. `showNotification(title, body)`
Shows a system notification using Electron IPC or browser Notification API.

```javascript
InterventionUI.showNotification('Stay Focused!', 'Take a break every hour.');
```

#### 2. `showInterventionModal(strategy, content)`
Displays an in-app modal with an intervention strategy.

**Parameters:**
- `strategy` (string): One of `'2_minute_rule'`, `'pomodoro'`, `'just_start'`, `'breathing'`, `'visualization'`, or `'reframe'`
- `content` (object):
  - `title` (string): Modal title
  - `body` (string): Modal message
  - `onAccept` (function): Callback when user accepts
  - `onReject` (function): Callback when user rejects

```javascript
InterventionUI.showInterventionModal('2_minute_rule', {
  title: 'Try the 2-Minute Rule',
  body: 'Commit to working for just 2 minutes.',
  onAccept: () => console.log('User accepted'),
  onReject: () => console.log('User rejected')
});
```

#### 3. `showBreathingExercise(onComplete)`
Displays an animated breathing exercise modal.

**Parameters:**
- `onComplete` (function): Optional callback to run after completing the exercise

```javascript
InterventionUI.showBreathingExercise(() => {
  console.log('Breathing exercise completed');
});
```

## Project Structure

```
component3/
├── index.js                          # Electron main process
├── package.json                      # Dependencies
├── frontend/
│   ├── index.html                    # Demo page
│   ├── renderer.js                   # Demo button handlers
│   ├── styles.css                    # Intervention UI styles
│   └── modules/
│       └── interventionUI.js         # Intervention components
└── README.md                         # This file
```

## Customization

### Styling
All styles are in `frontend/styles.css`. You can customize:
- Colors via CSS variables (`:root` section)
- Animation timings
- Modal sizes and layouts
- Breathing circle appearance

### Intervention Content
Modify the intervention content in `frontend/renderer.js` to customize messages and behavior for each strategy.

## Integration into Your Project

### Option 1: Copy the Module
1. Copy `frontend/modules/interventionUI.js` to your project
2. Copy the intervention-related CSS from `frontend/styles.css`
3. Include the module in your HTML: `<script src="path/to/interventionUI.js"></script>`
4. Use the `InterventionUI` global object

### Option 2: Import as ES Module
Convert `interventionUI.js` to export as an ES module:

```javascript
// At the end of interventionUI.js, replace the export with:
export default InterventionUI;
```

Then import it:

```javascript
import InterventionUI from './interventionUI.js';
```

## Technologies

- **Electron** v39.2.4 - Desktop app framework
- **Vanilla JavaScript** - No frameworks, pure JS
- **CSS3** - Animations, glass-morphism effects
- **Lucide Icons** - Icon library (loaded from CDN)

## License

ISC
