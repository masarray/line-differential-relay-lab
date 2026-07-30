/**
 * GPL-3.0-only
 * Installs a generic educational relay faceplate without vendor branding.
 */

const markup = `
  <aside class="relay-panel" aria-label="Virtual line differential relay">
    <section id="virtual-relay" class="relay-device" data-relay-state="ready">
      <header class="relay-nameplate">
        <div class="relay-family">87L</div>
        <div><strong>VIRTUAL PROTECTION RELAY</strong><small>LDX-87 · educational model</small></div>
      </header>
      <div class="relay-health-row" aria-label="Relay health indicators">
        <span><i id="relay-run-led" class="relay-led relay-led--green" data-active="true"></i>RUN</span>
        <span><i id="relay-comm-led" class="relay-led relay-led--green" data-active="true"></i>COMM</span>
        <span><i id="relay-error-led" class="relay-led relay-led--red" data-active="false"></i>ERROR</span>
      </div>
      <div class="relay-lcd" role="status" aria-live="polite">
        <div class="relay-lcd-head"><span id="relay-lcd-title">87L READY</span><span id="relay-lcd-clock">0.000 s</span></div>
        <div class="relay-lcd-grid">
          <span>IDIFF</span><strong id="relay-lcd-idiff">0.000 pu</strong>
          <span>IBIAS</span><strong id="relay-lcd-ibias">0.000 pu</strong>
          <span>STATE</span><strong id="relay-lcd-state">NORMAL</strong>
          <span>PERM</span><strong id="relay-lcd-permission">UNRESTRICTED</strong>
        </div>
        <div id="relay-lcd-message" class="relay-lcd-message">PROTECTION IN SERVICE</div>
      </div>
      <div class="relay-face-body">
        <ul class="relay-indicator-list" aria-label="Protection indication LEDs">
          <li><i id="relay-pickup-led" class="relay-led relay-led--amber" data-active="false"></i><span>87L PICKUP</span></li>
          <li><i id="relay-secure-led" class="relay-led relay-led--amber" data-active="false"></i><span>SECURE</span></li>
          <li><i id="relay-block-led" class="relay-led relay-led--violet" data-active="false"></i><span>87L BLOCK</span></li>
          <li class="relay-trip-indication"><i id="relay-trip-led" class="relay-led relay-led--red" data-active="false"></i><span>TRIP LATCH</span></li>
        </ul>
        <div class="relay-keypad" aria-hidden="true">
          <button type="button" tabindex="-1">▲</button><button type="button" tabindex="-1">◀</button>
          <button type="button" tabindex="-1">●</button><button type="button" tabindex="-1">▶</button>
          <button type="button" tabindex="-1">▼</button>
          <div class="relay-numeric-pad"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span></div>
        </div>
        <div class="relay-output-mimic" aria-label="Latched trip output path">
          <small>TRIP OUTPUT PATH</small>
          <div class="relay-mimic-chain"><span>87L</span><i></i><b>86</b><i></i><span>52</span></div>
          <strong id="relay-output-state">TRIP CONTACT RESET</strong>
        </div>
      </div>
      <div class="relay-trip-memory">
        <div><small>TRIP MEMORY</small><strong id="relay-latch-status">CLEAR</strong><span id="relay-latch-detail">No latched operation</span></div>
        <button id="relay-reset-latch" type="button">RESET LATCH</button>
      </div>
    </section>
  </aside>`;

const styles = `
.workspace{grid-template-columns:218px minmax(0,1fr) 220px 205px}
.relay-panel{min-width:0;min-height:0;padding:7px;overflow:hidden;border:1px solid var(--border);background:linear-gradient(180deg,rgba(14,29,34,.96),rgba(8,18,22,.98))}
.relay-device{--relay-face:#c4cdce;--relay-ink:#1b2629;--relay-lcd:#7d9e69;height:100%;min-height:0;display:grid;grid-template-rows:auto auto 116px minmax(0,1fr) auto;color:var(--relay-ink);border:1px solid #647276;border-radius:4px;background:linear-gradient(90deg,rgba(255,255,255,.18),transparent 8%,transparent 92%,rgba(0,0,0,.08)),linear-gradient(180deg,#d4dcdd,var(--relay-face) 44%,#b0bbbd);box-shadow:inset 0 0 0 2px rgba(255,255,255,.2);overflow:hidden}
.relay-nameplate{display:grid;grid-template-columns:38px minmax(0,1fr);gap:7px;align-items:center;padding:8px 8px 6px;border-bottom:1px solid rgba(27,38,41,.25)}
.relay-family{display:grid;place-items:center;height:28px;color:#d9fffa;background:#1d6761;border:1px solid #124943;font:600 15px var(--font-mono);letter-spacing:.04em}
.relay-nameplate strong,.relay-nameplate small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.relay-nameplate strong{font:600 9px var(--font-mono);letter-spacing:.04em}.relay-nameplate small{margin-top:2px;color:#506064;font:8px var(--font-mono)}
.relay-health-row{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:7px 8px;border-bottom:1px solid rgba(27,38,41,.18);font:8px var(--font-mono)}.relay-health-row span{display:flex;align-items:center;gap:4px;min-width:0}
.relay-led{--led-color:#677276;width:8px;height:8px;flex:0 0 auto;display:inline-block;border:1px solid rgba(0,0,0,.55);border-radius:50%;background:#626a6b;box-shadow:inset 0 1px 2px rgba(255,255,255,.22)}
.relay-led--green{--led-color:#51d77c}.relay-led--amber{--led-color:#f0bc3f}.relay-led--red{--led-color:#ef404e}.relay-led--violet{--led-color:#ae7ff4}.relay-led[data-active="true"]{background:var(--led-color);box-shadow:0 0 7px color-mix(in srgb,var(--led-color) 68%,transparent),inset 0 1px 2px rgba(255,255,255,.72)}.relay-led[data-condition="warning"]{--led-color:#f0bc3f}.relay-led[data-condition="danger"]{--led-color:#ef404e}.relay-led[data-condition="blocked"]{--led-color:#ae7ff4}
.relay-lcd{margin:7px 8px 5px;padding:7px;border:3px solid #647276;border-radius:2px;background:repeating-linear-gradient(0deg,rgba(18,39,27,.05) 0 1px,transparent 1px 3px),var(--relay-lcd);box-shadow:inset 0 0 8px rgba(20,38,26,.35);color:#13291b;font-family:var(--font-mono);text-shadow:0 1px rgba(255,255,255,.18)}
.relay-lcd-head{display:flex;justify-content:space-between;gap:5px;padding-bottom:4px;border-bottom:1px solid rgba(19,41,27,.28);font-size:9px;font-weight:700}.relay-lcd-grid{display:grid;grid-template-columns:40px minmax(0,1fr);gap:2px 4px;margin-top:4px;font-size:8px}.relay-lcd-grid strong{overflow:hidden;font-weight:700;text-align:right;text-overflow:ellipsis;white-space:nowrap}.relay-lcd-message{margin-top:4px;padding-top:3px;border-top:1px solid rgba(19,41,27,.28);overflow:hidden;font-size:8px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
.relay-face-body{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 74px;grid-template-rows:auto minmax(0,1fr);gap:7px;padding:5px 8px 7px}.relay-indicator-list{min-width:0;margin:0;padding:0;list-style:none}.relay-indicator-list li{display:grid;grid-template-columns:10px minmax(0,1fr);align-items:center;gap:5px;min-height:27px;padding:4px 5px;border-bottom:1px solid rgba(27,38,41,.18);font:8px var(--font-mono)}.relay-indicator-list .relay-trip-indication{margin-top:4px;border:1px solid rgba(141,28,38,.38);background:rgba(239,64,78,.08);font-weight:700}
.relay-keypad{display:grid;grid-template-columns:repeat(3,20px);grid-auto-rows:20px;justify-content:center;align-content:start;gap:3px;padding-top:2px}.relay-keypad>button{width:20px;height:20px;padding:0;border:1px solid #758386;border-radius:2px;color:#223034;background:linear-gradient(#dfe5e5,#9fabac);box-shadow:0 1px 1px rgba(0,0,0,.18);cursor:default;font-size:8px}.relay-keypad>button:first-child{grid-column:2}.relay-keypad>button:nth-child(2){grid-column:1;grid-row:2}.relay-keypad>button:nth-child(3){grid-column:2;grid-row:2}.relay-keypad>button:nth-child(4){grid-column:3;grid-row:2}.relay-keypad>button:nth-child(5){grid-column:2;grid-row:3}.relay-numeric-pad{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,20px);gap:3px;margin-top:3px}.relay-numeric-pad span{display:grid;place-items:center;height:19px;border:1px solid #758386;border-radius:2px;background:linear-gradient(#dfe5e5,#9fabac);box-shadow:0 1px 1px rgba(0,0,0,.18);font:8px var(--font-mono)}
.relay-output-mimic{grid-column:1/-1;align-self:end;display:grid;gap:6px;padding:8px 7px;border:1px solid rgba(27,38,41,.22);background:rgba(255,255,255,.13)}.relay-output-mimic>small{color:#526165;font:7px var(--font-mono);letter-spacing:.08em}.relay-mimic-chain{display:grid;grid-template-columns:28px minmax(10px,1fr) 28px minmax(10px,1fr) 28px;align-items:center}.relay-mimic-chain span,.relay-mimic-chain b{display:grid;place-items:center;height:24px;border:1px solid #667579;background:#d9dfdf;font:700 8px var(--font-mono)}.relay-mimic-chain b{border-radius:50%}.relay-mimic-chain i{height:2px;background:#536266}.relay-output-mimic>strong{color:#314044;font:700 8px var(--font-mono)}
.relay-trip-memory{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;padding:7px 8px;border-top:1px solid rgba(27,38,41,.28);background:rgba(255,255,255,.18)}.relay-trip-memory>div{min-width:0;display:grid;gap:1px}.relay-trip-memory small,.relay-trip-memory span{color:#526165;font:7px var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.relay-trip-memory strong{color:#203034;font:700 10px var(--font-mono)}.relay-trip-memory button{padding:6px;border-color:#68777a;color:#1f2c2f;background:linear-gradient(#eef2f2,#a8b4b6);font:700 7px var(--font-mono)}.relay-trip-memory button:disabled{opacity:.45;cursor:not-allowed}
.relay-device[data-relay-state="trip"]{box-shadow:inset 0 0 0 2px rgba(239,64,78,.35)}.relay-device[data-relay-state="trip"] .relay-lcd{background-color:#a79565}.relay-device[data-relay-state="trip"] .relay-mimic-chain{color:#8d1c26}.relay-device[data-relay-state="trip"] .relay-mimic-chain i{background:#ef404e;box-shadow:0 0 5px rgba(239,64,78,.45)}.relay-device[data-relay-state="blocked"] .relay-lcd{background-color:#9487a7}.relay-device[data-relay-state="secure"] .relay-lcd{background-color:#a59b68}
@media(max-width:1180px){.workspace{grid-template-columns:205px minmax(0,1fr) 205px 188px}}
@media(max-width:980px){.workspace{grid-template-columns:220px minmax(0,1fr)}.relay-panel{grid-column:1/-1;min-height:600px}}
`;

export function installVirtualRelayPanel() {
  if (document.getElementById('virtual-relay')) return;
  const workspace = document.getElementById('workspace');
  if (!workspace) throw new Error('Virtual relay requires #workspace');

  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  workspace.append(template.content);

  const style = document.createElement('style');
  style.id = 'virtual-relay-styles';
  style.textContent = styles;
  document.head.append(style);
}
