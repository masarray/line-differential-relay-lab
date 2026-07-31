import { installReadableAnalysisPanel } from './analysis-panel.js';
import { installVirtualRelayPanel } from './virtual-relay-panel.js';

/**
 * GPL-3.0-only
 * Pure latching state for the educational virtual relay front panel.
 */

if (typeof document !== 'undefined') {
  installVirtualRelayPanel();
  installReadableAnalysisPanel();
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
