/**
 * Mock Context Provider
 * Generates a 12-element context vector (all values normalized 0-1) for the LinUCB bandit.
 *
 * Context vector layout (d = 12):
 *   [0]  bias               = 1 (constant)
 *   [1]  expectancy         = completed_tasks / (assigned_tasks + 1)
 *   [2]  value              = 0.5*priority + 0.3*grade_weight + 0.2*value_time
 *   [3]  impulsiveness      = 0.5*switching_score + 0.5*non_academic_ratio
 *   [4]  delay              = hours_to_deadline / (1 + hours_to_deadline)
 *   [5]  overdue_flag       = 1 if deadline passed, else 0
 *   [6]  motivation         = (expectancy * value) / (1 + impulsiveness * delay)
 *   [7]  app_switch_rate    (normalized 0-1)
 *   [8]  tab_switch_rate    (normalized 0-1)
 *   [9]  non_academic_ratio = non_academic_transitions / (total_transitions + 1)
 *   [10] idle_ratio         (normalized 0-1)
 *   [11] deadline_urgency   = 1 - delay
 *
 * Values come from Component 1 (behavior) and Component 4 (task scheduling) in the future.
 * For now, three mock scenarios are provided.
 */

const MockContext = (() => {
  // Pre-computed mock scenarios.
  // All raw feature values are included for readability; the vector is derived from them.
  const SCENARIOS = {
    A: {
      label: 'Scenario A — Low Urgency',
      description: 'Far deadline, low switching, low impulsiveness.',
      // Raw inputs
      expectancy: 0.80,
      value: 0.60,
      app_switch_rate: 0.10,
      tab_switch_rate: 0.10,
      non_academic_ratio: 0.20,
      idle_ratio: 0.10,
      hours_to_deadline: 48,
      overdue_flag: 0,
    },
    B: {
      label: 'Scenario B — High Urgency',
      description: 'Near deadline, high impulsiveness.',
      expectancy: 0.50,
      value: 0.80,
      app_switch_rate: 0.70,
      tab_switch_rate: 0.60,
      non_academic_ratio: 0.70,
      idle_ratio: 0.30,
      hours_to_deadline: 0.5,
      overdue_flag: 0,
    },
    C: {
      label: 'Scenario C — Overdue',
      description: 'Deadline has passed, high urgency and impulsiveness.',
      expectancy: 0.30,
      value: 0.90,
      app_switch_rate: 0.80,
      tab_switch_rate: 0.70,
      non_academic_ratio: 0.80,
      idle_ratio: 0.50,
      hours_to_deadline: 0,
      overdue_flag: 1,
    },
  };

  let _currentScenario = 'A';

  /**
   * Derive the 12-element context vector from a scenario's raw inputs.
   * @param {Object} s - scenario object
   * @returns {number[]}
   */
  function _buildVector(s) {
    const bias = 1;
    const expectancy = s.expectancy;
    const value = s.value;

    const switching_score = (s.app_switch_rate + s.tab_switch_rate) / 2;
    const impulsiveness = 0.5 * switching_score + 0.5 * s.non_academic_ratio;

    const delay = s.overdue_flag === 1
      ? 0
      : s.hours_to_deadline / (1 + s.hours_to_deadline);

    const overdue_flag = s.overdue_flag;

    const motivation = (expectancy * value) / (1 + impulsiveness * delay);
    // Clamp motivation to [0, 1] — theoretically bounded but guard against edge cases
    const motivation_clamped = Math.min(1, Math.max(0, motivation));

    const deadline_urgency = 1 - delay;

    return [
      bias,                    // [0]
      expectancy,              // [1]
      value,                   // [2]
      impulsiveness,           // [3]
      delay,                   // [4]
      overdue_flag,            // [5]
      motivation_clamped,      // [6]
      s.app_switch_rate,       // [7]
      s.tab_switch_rate,       // [8]
      s.non_academic_ratio,    // [9]
      s.idle_ratio,            // [10]
      deadline_urgency,        // [11]
    ];
  }

  return {
    /**
     * Set the active scenario.
     * @param {'A'|'B'|'C'} scenario
     */
    setScenario(scenario) {
      if (!SCENARIOS[scenario]) {
        console.warn(`[MockContext] Unknown scenario: ${scenario}`);
        return;
      }
      _currentScenario = scenario;
      console.log(`[MockContext] Scenario set to ${scenario}: ${SCENARIOS[scenario].label}`);
    },

    /**
     * Get the current scenario key.
     * @returns {'A'|'B'|'C'}
     */
    getCurrentScenario() {
      return _currentScenario;
    },

    /**
     * Get the active scenario's metadata (label, description).
     * @returns {{ label: string, description: string }}
     */
    getScenarioInfo() {
      const s = SCENARIOS[_currentScenario];
      return { label: s.label, description: s.description };
    },

    /**
     * Generate the context vector for the given user under the current scenario.
     * The userId argument is reserved for future per-user variation.
     * @param {string} userId
     * @returns {number[]} 12-element normalized context vector
     */
    getMockContext(userId) {
      const scenario = SCENARIOS[_currentScenario];
      const vector = _buildVector(scenario);

      console.log(`[MockContext] user=${userId} scenario=${_currentScenario}`, vector);
      return vector;
    },

    /**
     * Expose all scenario metadata for UI rendering.
     * @returns {{ A: {...}, B: {...}, C: {...} }}
     */
    getAllScenarios() {
      return Object.fromEntries(
        Object.entries(SCENARIOS).map(([key, s]) => [
          key,
          { label: s.label, description: s.description },
        ])
      );
    },
  };
})();

if (typeof window !== 'undefined') {
  window.MockContext = MockContext;
}
