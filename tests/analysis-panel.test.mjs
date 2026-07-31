import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRelayEvent, formatRelayEventMessage } from '../src/ui/analysis-panel.js';

test('relay event severity separates restore, alarm, warning, and trip events', () => {
  assert.equal(classifyRelayEvent('BLOCKED → RECOVERY VALIDATION'), 'INFO');
  assert.equal(classifyRelayEvent('NORMAL → BLOCKED'), 'ALARM');
  assert.equal(classifyRelayEvent('1 packet sequence gap(s)'), 'WARN');
  assert.equal(classifyRelayEvent('87L operating criterion satisfied'), 'TRIP');
});

test('relay event messages are readable without exposing raw implementation wording', () => {
  assert.equal(formatRelayEventMessage('1 packet sequence gap(s)'), 'Packet sequence gap detected · 1');
  assert.equal(formatRelayEventMessage('2 reordered frame(s)'), 'Out-of-order frame recovered · 2');
  assert.equal(formatRelayEventMessage('3 duplicate frame(s) discarded'), 'Duplicate frame discarded · 3');
  assert.equal(formatRelayEventMessage('NORMAL → WATCH'), 'Protection state · NORMAL → WATCH');
});
