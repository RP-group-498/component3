/**
 * Renderer - Demo page for Intervention UI components
 */

console.log('[Demo] Initializing Intervention UI Demo...');

// Intervention content for each strategy
const interventionContent = {
  '2_minute_rule': {
    title: 'Try the 2-Minute Rule',
    body: 'Commit to working on this for just 2 minutes. Often, starting is the hardest part!',
    onAccept: () => console.log('User accepted: 2-Minute Rule'),
    onReject: () => console.log('User rejected: 2-Minute Rule')
  },
  'pomodoro': {
    title: 'Start a Pomodoro Session',
    body: 'Focus for 25 minutes, then take a 5-minute break. This helps maintain concentration.',
    onAccept: () => console.log('User accepted: Pomodoro'),
    onReject: () => console.log('User rejected: Pomodoro')
  },
  'just_start': {
    title: 'Just Start Small',
    body: 'Pick one tiny part and start there. You don\'t need to do it all at once.',
    onAccept: () => console.log('User accepted: Just Start'),
    onReject: () => console.log('User rejected: Just Start')
  },
  'breathing': {
    title: 'Take a Breathing Break',
    body: 'A quick breathing exercise can help reduce stress and improve focus.',
    onAccept: () => {
      console.log('User accepted: Breathing');
      // Will be handled by InterventionUI
    },
    onReject: () => console.log('User rejected: Breathing')
  },
  'visualization': {
    title: 'Visualize Completion',
    body: 'Close your eyes for 30 seconds. Imagine the relief and satisfaction of finishing this.',
    onAccept: () => console.log('User accepted: Visualization'),
    onReject: () => console.log('User rejected: Visualization')
  },
  'reframe': {
    title: 'Reframe Your Perspective',
    body: 'Instead of "I have to do this," try "I choose to do this because it helps me [achieve goal]."',
    onAccept: () => console.log('User accepted: Reframe'),
    onReject: () => console.log('User rejected: Reframe')
  }
};

// Set up demo button event listeners
document.addEventListener('DOMContentLoaded', () => {
  const demoButtons = document.querySelectorAll('.demo-btn');

  demoButtons.forEach(button => {
    button.addEventListener('click', () => {
      const intervention = button.getAttribute('data-intervention');

      if (intervention === 'notification') {
        // Show system notification
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showNotification(
            'Stay Focused!',
            'Remember to take breaks and stay hydrated.'
          );
          console.log('Triggered: System Notification');
        }
      } else if (intervention === 'breathing') {
        // Show breathing exercise directly
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showBreathingExercise(() => {
            console.log('Breathing exercise completed');
          });
        }
      } else if (interventionContent[intervention]) {
        // Show intervention modal
        if (typeof InterventionUI !== 'undefined') {
          InterventionUI.showInterventionModal(
            intervention,
            interventionContent[intervention]
          );
        }
      } else {
        console.warn('Unknown intervention:', intervention);
      }
    });
  });

  console.log('[Demo] Event listeners attached to', demoButtons.length, 'buttons');
});

console.log('[Demo] Initialization complete');
