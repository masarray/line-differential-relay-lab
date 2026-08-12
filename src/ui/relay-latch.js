import { installReadableAnalysisPanel } from './analysis-panel.js';
import { installComparisonExperience } from './comparison-tour.js';
import { installRelayExperience } from './relay-experience.js';
import { installVirtualRelayPanel } from './virtual-relay-panel.js';

/**
 * GPL-3.0-only
 * Pure latching state for the educational virtual relay front panel.
 */

if (typeof document !== 'undefined') {
  installVirtualRelayPanel();
  installReadableAnalysisPanel();
  installRelayExperience();
  // Defer the comparison/tour bootstrap until app.js has attached its control
  // listeners, so tour-driven clicks use the same public UI path as the user.
  window.setTimeout(installComparisonExperience, 0);

  // Keep internal protection supervision states available to the engine while
  // presenting only the two user-facing comparison concepts in the UI.
  const presentTwoModeLanguage = () => {
    const protectionState = document.getElementById('protection-state');
    const lcdState = document.getElementById('relay-lcd-state');
    const lcdTitle = document.getElementById('relay-lcd-title');
    const lcdMessage = document.getElementById('relay-lcd-message');
    const decision = document.getElementById('decision-value');

    if (protectionState?.textContent === 'SECURE WINDOW') protectionState.textContent = 'SUPERVISED';
    if (lcdState?.textContent === 'SECURE WINDOW') lcdState.textContent = 'SUPERVISED';
    if (lcdTitle?.textContent === 'SECURE MODE') lcdTitle.textContent = 'SUPERVISED';
    if (lcdMessage?.textContent.endsWith('VALIDATION WINDOW')) {
      lcdMessage.textContent = lcdMessage.textContent.replace('VALIDATION WINDOW', 'QUALITY REVALIDATION');
    }
    if (decision?.textContent === 'SECURE / SUPERVISED') decision.textContent = 'SUPERVISED';
  };

  const languageObserver = new MutationObserver(presentTwoModeLanguage);
  ['protection-state', 'relay-lcd-state', 'relay-lcd-title', 'relay-lcd-message', 'decision-value'].forEach((id) => {
    const output = document.getElementById(id);
    if (output) languageObserver.observe(output, { childList: true, characterData: true, subtree: true });
  });
  presentTwoModeLanguage();

  const alignmentOutput = document.getElementById('alignment-error');
  const alignmentLabel = alignmentOutput?.previousElementSibling;
  if (alignmentLabel) alignmentLabel.textContent = 'ALIGN UNC';
  if (alignmentOutput) {
    const presentUncertainty = () => {
      if (alignmentOutput.textContent.startsWith('+')) {
        alignmentOutput.textContent = `±${alignmentOutput.textContent.slice(1)}`;
      }
    };
    new MutationObserver(presentUncertainty).observe(alignmentOutput, {
      childList: true,
      characterData: true,
      subtree: true
    });
    presentUncertainty();
  }
}

export function createRelayLatchState() {
  return Object.freeze({
    latched: false,
    tripTimeSeconds: null,
    idiffPu: null,
    restraintPu: null,
    modeLabel: null,
    scenarioLabel: null
  });
}

export function updateRelayLatch(previous, frame) {
  if (previous?.latched || !frame?.protection?.operate) return previous;

  return Object.freeze({
    latched: true,
    tripTimeSeconds: Number(frame.timeSeconds),
    idiffPu: Number(frame.differential?.validatedRmsPu ?? 0),
    restraintPu: Number(frame.differential?.restraintRmsPu ?? 0),
    modeLabel: String(frame.modeLabel ?? '87L'),
    scenarioLabel: String(frame.scenarioLabel ?? 'Unknown scenario')
  });
}

export function resetRelayLatch(previous, operateConditionActive = false) {
  if (operateConditionActive) {
    return Object.freeze({
      ...previous,
      scenarioLabel: 'RESET INHIBITED · operate condition active',
      resetInhibited: true
    });
  }
  return createRelayLatchState();
}
