# Getting Boolean Value from Intervention Responses

## ✅ How It Works Now

When a user responds to an intervention notification, you get a **boolean value**:
- `true` = User accepted the intervention
- `false` = User rejected/skipped the intervention

---

## 📝 Platform-Specific Behavior

### macOS
1. **Notification appears** with title and message
2. **User clicks notification** → App opens with dialog showing action buttons
3. **User clicks button** → Boolean value returned
4. Alternatively: **Reply button** available (type "start", "skip", etc.)

### Windows/Linux
1. **Notification appears** with action buttons directly
2. **User clicks button** in notification
3. **Boolean value returned** immediately

---

## 🔧 How to Use the Boolean Value

### Method 1: Listen to Console Logs

The boolean value is logged automatically:

```javascript
// In console, you'll see:
[App] Intervention ACCEPTED (boolean: true)
// or
[App] Intervention REJECTED (boolean: false)
```

### Method 2: Listen to Custom Event

Add this anywhere in your code:

```javascript
// Listen for intervention results
window.addEventListener('intervention-result', (event) => {
    const { accepted, action, metadata } = event.detail;

    console.log('Boolean value:', accepted);  // true or false
    console.log('Action type:', action);       // 'accept' or 'reject'
    console.log('Strategy:', metadata.strategy); // 'pomodoro', etc.
    console.log('Task ID:', metadata.taskId);
    console.log('Intervention ID:', metadata.interventionId);

    // YOUR CODE HERE - Use the boolean value
    if (accepted) {
        console.log('✅ User wants to start the intervention!');
        // Do something when user accepts
    } else {
        console.log('❌ User skipped the intervention');
        // Do something when user rejects
    }
});
```

### Method 3: Modify InterventionManager

Edit `frontend/modules/interventionManager.js` and add a callback:

```javascript
// In recordOutcome method, add this:
recordOutcome(taskId, outcome, interventionId) {
    const accepted = outcome === 'accepted';

    // YOUR CALLBACK HERE
    this.onInterventionResponse(accepted, taskId, interventionId);

    // ... rest of the code
},

// Add this new method:
onInterventionResponse(accepted, taskId, interventionId) {
    console.log('=== INTERVENTION RESPONSE ===');
    console.log('Accepted:', accepted);
    console.log('Task ID:', taskId);
    console.log('Intervention ID:', interventionId);

    // YOUR FUTURE DEVELOPMENT CODE HERE
    if (accepted) {
        // User accepted - do something
        this.handleAcceptance(taskId);
    } else {
        // User rejected - do something else
        this.handleRejection(taskId);
    }
}
```

### Method 4: Use IPC Listener (Advanced)

In `renderer.js`, the boolean value is already calculated:

```javascript
// In setupInterventionActionHandler(), line 891:
const accepted = action === 'accept';  // THIS IS YOUR BOOLEAN VALUE

// Add your code here:
if (accepted) {
    // User accepted
    yourCustomFunction(true, taskId, strategy);
} else {
    // User rejected
    yourCustomFunction(false, taskId, strategy);
}
```

---

## 🧪 Testing the Boolean Value

### Test with Demo Buttons:

1. **Start the app:**
   ```bash
   npm start
   ```

2. **Open DevTools Console** (`Cmd+Option+I`)

3. **Add event listener in console:**
   ```javascript
   window.addEventListener('intervention-result', (e) => {
       console.log('BOOLEAN VALUE:', e.detail.accepted);
   });
   ```

4. **Click any Demo Control button** (Pomodoro, 2-Minute Rule, etc.)

5. **See notification**, then:
   - **macOS**: Click notification → see dialog → click button
   - **Windows**: Click button directly in notification

6. **Check console for:**
   ```
   BOOLEAN VALUE: true
   ```
   or
   ```
   BOOLEAN VALUE: false
   ```

---

## 📊 Example: Using Boolean for Analytics

```javascript
// Add this to your code
window.addEventListener('intervention-result', (event) => {
    const { accepted, metadata } = event.detail;

    // Send to analytics
    trackInterventionResponse({
        strategy: metadata.strategy,
        accepted: accepted,
        taskId: metadata.taskId,
        timestamp: Date.now()
    });

    // Update UI based on response
    if (accepted) {
        showSuccessMessage('Great! Let\'s get started!');
    } else {
        showInfoMessage('No problem, maybe later.');
    }

    // Store in database
    saveInterventionResponse({
        intervention_id: metadata.interventionId,
        accepted: accepted,
        task_id: metadata.taskId
    });
});
```

---

## 📦 Example: Using Boolean for State Management

```javascript
// In your app state
const appState = {
    interventions: {
        total: 0,
        accepted: 0,
        rejected: 0,
        acceptanceRate: 0
    }
};

// Listen for responses
window.addEventListener('intervention-result', (event) => {
    const { accepted } = event.detail;

    // Update state
    appState.interventions.total++;

    if (accepted) {
        appState.interventions.accepted++;
    } else {
        appState.interventions.rejected++;
    }

    // Calculate acceptance rate
    appState.interventions.acceptanceRate =
        (appState.interventions.accepted / appState.interventions.total) * 100;

    console.log('Acceptance Rate:', appState.interventions.acceptanceRate + '%');

    // Update UI
    updateInterventionStats(appState.interventions);
});
```

---

## 🔄 Data Flow Diagram

```
User sees notification
        │
        ├─ macOS: Clicks notification
        │         └─> Shows dialog with buttons
        │             └─> User clicks button
        │                 └─> Boolean value generated
        │
        └─ Windows: Clicks button in notification
                    └─> Boolean value generated

Boolean value (true/false)
        │
        ├─> Logged to console
        ├─> Sent via 'intervention-result' event
        ├─> Passed to InterventionManager.recordOutcome()
        └─> Available for your custom logic
```

---

## 💡 Integration Examples

### Example 1: Reward System

```javascript
let userPoints = 0;

window.addEventListener('intervention-result', (event) => {
    if (event.detail.accepted) {
        userPoints += 10; // Reward for accepting intervention
        console.log('Points earned! Total:', userPoints);
        showReward('+10 points!');
    }
});
```

### Example 2: Adaptive Suggestions

```javascript
const interventionPreferences = {
    pomodoro: 0,
    two_minute_rule: 0,
    breathing: 0
    // ... etc
};

window.addEventListener('intervention-result', (event) => {
    const { accepted, metadata } = event.detail;
    const strategy = metadata.strategy;

    if (accepted) {
        interventionPreferences[strategy]++;
    } else {
        interventionPreferences[strategy]--;
    }

    // Next time, suggest strategies user prefers
    const preferredStrategy = Object.keys(interventionPreferences)
        .reduce((a, b) => interventionPreferences[a] > interventionPreferences[b] ? a : b);

    console.log('User prefers:', preferredStrategy);
});
```

### Example 3: Notification Frequency Adjustment

```javascript
let consecutiveRejections = 0;

window.addEventListener('intervention-result', (event) => {
    if (event.detail.accepted) {
        consecutiveRejections = 0;
        console.log('User engaged! Keep sending interventions');
    } else {
        consecutiveRejections++;

        if (consecutiveRejections >= 3) {
            console.log('User rejecting interventions, reducing frequency...');
            adjustInterventionFrequency('lower');
        }
    }
});
```

---

## 🚀 Your Code Template

Here's a ready-to-use template for your future development:

```javascript
// Add this to frontend/renderer.js or create a new module

class InterventionResponseHandler {
    constructor() {
        this.setupListener();
    }

    setupListener() {
        window.addEventListener('intervention-result', (event) => {
            this.handleResponse(event.detail);
        });
    }

    handleResponse({ accepted, action, metadata }) {
        // ✨ YOUR CODE HERE ✨

        console.log('=================================');
        console.log('📊 INTERVENTION RESPONSE DATA');
        console.log('=================================');
        console.log('Boolean Value:', accepted);
        console.log('Action:', action);
        console.log('Strategy:', metadata.strategy);
        console.log('Task ID:', metadata.taskId);
        console.log('Intervention ID:', metadata.interventionId);
        console.log('=================================');

        if (accepted) {
            this.onAccept(metadata);
        } else {
            this.onReject(metadata);
        }
    }

    onAccept(metadata) {
        // 🎯 User accepted the intervention
        console.log('✅ ACCEPTED:', metadata.strategy);

        // Add your code here:
        // - Update database
        // - Show success message
        // - Track analytics
        // - Trigger actions
        // - etc.
    }

    onReject(metadata) {
        // ⏭️ User rejected/skipped the intervention
        console.log('❌ REJECTED:', metadata.strategy);

        // Add your code here:
        // - Update database
        // - Adjust strategy
        // - Track analytics
        // - etc.
    }
}

// Initialize the handler
const responseHandler = new InterventionResponseHandler();
```

---

## ✅ Summary

You now have **3 ways to get the boolean value**:

1. **Console logs** - Already working, check DevTools
2. **Custom event** - `window.addEventListener('intervention-result', ...)`
3. **Direct access** - Modify `setupInterventionActionHandler()` in renderer.js

The boolean value represents:
- `true` = User accepted (clicked "Start", "Got It!", etc.)
- `false` = User rejected (clicked "Skip", "Later", etc.)

**Test it now with the Demo Controls buttons!** 🎉
