/**
 * GPL-3.0-only
 * Installs a generic educational relay faceplate without vendor branding.
 * Faceplate geometry follows a panel-mount numerical relay: square-ish case,
 * LED status column, colour LCD with single-line mimic + measurement list,
 * F-key rail with RESET, and a keypad deck with D-pad and USB flap.
 */

const markup = `
  <aside class="relay-panel" aria-label="Virtual line differential relay">
    <section id="virtual-relay" class="relay-device" data-relay-state="ready">
      <header class="relay-brandbar">
        <span class="relay-brand">NEXT<i>+</i>GEN <b>87L</b></span>
        <small>LINE DIFFERENTIAL PROTECTION RELAY</small>
      </header>

      <div class="relay-face">
        <div class="relay-status-column" aria-label="Relay status indication">
          <small>STATUS</small>
          <ul class="relay-indicator-list">
            <li><i id="relay-run-led" class="relay-led relay-led--green" data-active="true"></i><span>HEALTHY</span></li>
            <li><i id="relay-pickup-led" class="relay-led relay-led--amber" data-active="false"></i><span>PICKUP</span></li>
            <li><i id="relay-trip-led" class="relay-led relay-led--red" data-active="false"></i><span>TRIP</span></li>
            <li><i id="relay-block-led" class="relay-led relay-led--violet" data-active="false"></i><span>BLOCK</span></li>
            <li><i id="relay-error-led" class="relay-led relay-led--red" data-active="false"></i><span>ALARM</span></li>
            <li><i id="relay-secure-led" class="relay-led relay-led--amber" data-active="false"></i><span>SECURE</span></li>
            <li><i id="relay-comm-led" class="relay-led relay-led--green" data-active="true"></i><span>COMM</span></li>
          </ul>
        </div>

        <div class="relay-screen">
          <div class="relay-lcd" role="status" aria-live="polite">
            <div class="relay-lcd-head">
              <span id="relay-lcd-title">87L READY</span>
              <span id="relay-lcd-clock">0.000 s</span>
            </div>
            <div class="relay-lcd-body">
              <svg class="relay-mimic" viewBox="0 0 108 190" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <text x="54" y="12" text-anchor="middle" class="mimic-label">LOCAL 150 kV</text>
                <line x1="12" y1="20" x2="96" y2="20"/>
                <line x1="40" y1="20" x2="40" y2="168"/>
                <line x1="84" y1="20" x2="84" y2="46"/>
                <path d="M35 30 L45 42 M45 30 L35 42"/>
                <path d="M79 40 L89 52 M89 40 L79 52"/>
                <line x1="75" y1="58" x2="93" y2="58"/>
                <line x1="78" y1="62" x2="90" y2="62"/>
                <line x1="81" y1="66" x2="87" y2="66"/>
                <rect x="30" y="58" width="20" height="20"/>
                <path d="M35 96 L40 86 L45 96 Z" class="mimic-fill"/>
                <circle cx="40" cy="116" r="9"/>
                <path d="M50 111 q4 -4 8 0 M50 120 q4 -4 8 0"/>
                <text x="62" y="120" class="mimic-label">87L</text>
                <text x="54" y="184" text-anchor="middle" class="mimic-label">REMOTE END</text>
              </svg>
              <dl class="relay-lcd-grid">
                <dt>IDIFF</dt><dd id="relay-lcd-idiff">0.000 pu</dd>
                <dt>IBIAS</dt><dd id="relay-lcd-ibias">0.000 pu</dd>
                <dt>IRAW</dt><dd id="relay-lcd-iraw">0.000 pu</dd>
                <dt>IPKUP</dt><dd id="relay-lcd-ipickup">0.000 pu</dd>
                <dt class="is-spacer"></dt><dd class="is-spacer"></dd>
                <dt>STATE</dt><dd id="relay-lcd-state">NORMAL</dd>
                <dt>PERM</dt><dd id="relay-lcd-permission">UNRESTRICTED</dd>
                <dt>CHAN</dt><dd id="relay-lcd-channel">100 %</dd>
              </dl>
            </div>
            <div id="relay-lcd-message" class="relay-lcd-message">PROTECTION IN SERVICE</div>
            <div class="relay-lcd-tabs" aria-hidden="true">
              <span class="is-active">MEASURE</span><span>EVENTS</span><span>RECORDS</span><span>SETUP</span>
            </div>
          </div>
        </div>

        <div class="relay-fkeys">
          <div class="relay-fkey" aria-hidden="true"><i></i><button type="button" tabindex="-1">F1</button></div>
          <div class="relay-fkey" aria-hidden="true"><i></i><button type="button" tabindex="-1">F2</button></div>
          <div class="relay-fkey" aria-hidden="true"><i></i><button type="button" tabindex="-1">F3</button></div>
          <div class="relay-fkey" aria-hidden="true"><i></i><button type="button" tabindex="-1">F4</button></div>
          <div class="relay-fkey" aria-hidden="true"><i></i><button type="button" tabindex="-1">F5</button></div>
          <div class="relay-fkey relay-fkey--reset"><i></i><button id="relay-reset-latch" type="button">RESET</button></div>
        </div>
      </div>

      <div class="relay-tripbar">
        <div>
          <small>TRIP MEMORY</small>
          <strong id="relay-latch-status">CLEAR</strong>
          <span id="relay-latch-detail">No latched operation</span>
        </div>
        <div class="relay-output-mimic">
          <small>TRIP OUTPUT PATH</small>
          <div class="relay-mimic-chain"><span>87L</span><i></i><b>86</b><i></i><span>52</span></div>
          <strong id="relay-output-state">TRIP CONTACT RESET</strong>
        </div>
      </div>

      <div class="relay-deck">
        <div class="relay-deck-left" aria-hidden="true">
          <button type="button" tabindex="-1">⌂</button>
          <button type="button" tabindex="-1">☰</button>
        </div>
        <div class="relay-dpad" aria-hidden="true">
          <button class="dpad-up" type="button" tabindex="-1">▲</button>
          <button class="dpad-left" type="button" tabindex="-1">◀</button>
          <button class="dpad-ok" type="button" tabindex="-1">OK</button>
          <button class="dpad-right" type="button" tabindex="-1">▶</button>
          <button class="dpad-down" type="button" tabindex="-1">▼</button>
        </div>
        <div class="relay-deck-right" aria-hidden="true">
          <button type="button" tabindex="-1">↩</button>
          <button type="button" tabindex="-1">★</button>
        </div>
        <div class="relay-usb" aria-hidden="true"><i></i><span>USB</span></div>
      </div>
    </section>
  </aside>`;

const styles = `
.workspace{grid-template-columns:196px minmax(0,1fr) 205px clamp(320px,22vw,420px)}
.relay-panel{min-width:0;min-height:0;display:grid;align-content:center;justify-items:center;padding:10px;overflow:auto;border:1px solid var(--border);background:linear-gradient(180deg,rgba(14,29,34,.96),rgba(8,18,22,.98))}
.relay-device{
  --relay-ink:#dfe6e8;--relay-blue:#2f9bd8;
  width:100%;max-width:420px;aspect-ratio:1/1.06;min-height:0;
  display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;gap:8px;
  padding:11px;color:var(--relay-ink);border:1px solid #191e21;border-radius:12px;
  background:linear-gradient(180deg,#4a5257,#343b40 42%,#272d31);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 0 0 1px rgba(255,255,255,.04),0 14px 30px rgba(0,0,0,.5);
  overflow:hidden
}
.relay-brandbar{display:flex;align-items:baseline;justify-content:flex-end;gap:8px;padding:1px 4px 6px;border-bottom:1px solid rgba(255,255,255,.07)}
.relay-brand{color:#e9eff1;font:600 14px var(--font-mono);letter-spacing:.06em}
.relay-brand i{color:var(--relay-blue);font-style:normal}
.relay-brand b{color:var(--relay-blue);font-weight:700}
.relay-brandbar small{color:#8d999e;font:8px var(--font-mono);letter-spacing:.12em}

.relay-face{min-height:0;display:grid;grid-template-columns:88px minmax(0,1fr) 46px;gap:8px}
.relay-status-column{min-width:0;padding:9px 7px;border:1px solid rgba(255,255,255,.06);border-left:2px solid rgba(47,155,216,.5);border-radius:6px;background:linear-gradient(180deg,rgba(0,0,0,.3),rgba(0,0,0,.14))}
.relay-status-column>small{display:block;margin-bottom:8px;color:#94a1a6;font:8px var(--font-mono);letter-spacing:.14em}
.relay-indicator-list{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.relay-indicator-list li{display:grid;grid-template-columns:11px minmax(0,1fr);align-items:center;gap:8px;color:#cbd4d7;font:8px var(--font-mono);letter-spacing:.06em;overflow:hidden;white-space:nowrap}
.relay-led{--led-color:#5c666a;width:11px;height:11px;flex:0 0 auto;display:inline-block;border:1px solid rgba(0,0,0,.6);border-radius:50%;background:#2c3336;box-shadow:inset 0 1px 2px rgba(255,255,255,.12)}
.relay-led--green{--led-color:#3ddc7f}.relay-led--amber{--led-color:#f0bc3f}.relay-led--red{--led-color:#ef404e}.relay-led--violet{--led-color:#3aa9ff}
.relay-led[data-active="true"]{background:var(--led-color);box-shadow:0 0 10px color-mix(in srgb,var(--led-color) 75%,transparent),inset 0 1px 2px rgba(255,255,255,.55)}
.relay-led[data-condition="warning"]{--led-color:#f0bc3f}.relay-led[data-condition="danger"]{--led-color:#ef404e}.relay-led[data-condition="blocked"]{--led-color:#3aa9ff}

.relay-screen{min-width:0;min-height:0;padding:5px;border:1px solid #1d2225;border-radius:6px;background:linear-gradient(180deg,#22282b,#191d20);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}
.relay-lcd{height:100%;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;border-radius:2px;background:#eef1ef;color:#1b2428;font-family:var(--font-mono);overflow:hidden}
.relay-lcd-head{display:flex;justify-content:space-between;gap:8px;padding:5px 8px;background:linear-gradient(180deg,#2f7fc4,#215f97);color:#f2f7fa;font-size:10px;font-weight:700;letter-spacing:.05em}
.relay-lcd-body{min-height:0;display:grid;grid-template-columns:minmax(74px,0.9fr) minmax(0,1.1fr);gap:6px;padding:8px 9px;overflow:hidden}
.relay-mimic{width:100%;height:100%;min-height:0;stroke:#1b2428;stroke-width:1.5;fill:none}
.relay-mimic text{fill:#1b2428;stroke:none;font:6.5px var(--font-mono)}
.relay-mimic .mimic-fill{fill:#1b2428}
.relay-lcd-grid{min-width:0;margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);align-content:start;gap:6px 8px;font-size:9px}
.relay-lcd-grid dt{color:#41525a;letter-spacing:.04em}
.relay-lcd-grid dd{margin:0;overflow:hidden;font-weight:700;text-align:right;text-overflow:ellipsis;white-space:nowrap}
.relay-lcd-grid .is-spacer{height:3px}
.relay-lcd-message{padding:5px 9px;border-top:1px solid rgba(27,36,40,.18);overflow:hidden;font-size:9px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
.relay-lcd-tabs{display:grid;grid-template-columns:repeat(4,1fr)}
.relay-lcd-tabs span{padding:5px 2px;border-top:1px solid #c3ccd0;border-right:1px solid #c3ccd0;background:#dfe4e5;color:#3a484d;text-align:center;font:8px var(--font-mono);letter-spacing:.05em}
.relay-lcd-tabs span:last-child{border-right:0}
.relay-lcd-tabs span.is-active{background:#2f7fc4;color:#f4f8fb;font-weight:700}

.relay-fkeys{min-height:0;display:grid;grid-template-rows:repeat(6,minmax(0,1fr));gap:6px}
.relay-fkeys .relay-fkey{min-height:0;display:grid;grid-template-columns:7px minmax(0,1fr);align-items:center;gap:4px}
.relay-fkey i{width:7px;height:3px;border-radius:2px;background:var(--relay-blue);box-shadow:0 0 6px rgba(47,155,216,.6)}
.relay-fkey button{width:100%;height:100%;min-height:24px;padding:0;border:1px solid #1f2528;border-radius:4px;color:#d9e1e4;background:linear-gradient(180deg,#4b5359,#333a3e);box-shadow:inset 0 1px 0 rgba(255,255,255,.14);font:600 9px var(--font-mono);cursor:default}
#relay-reset-latch{border-color:rgba(47,155,216,.6);color:#d8eefc;background:linear-gradient(180deg,#3d5f7d,#274357);font:700 8px var(--font-mono);letter-spacing:.04em;cursor:pointer}
#relay-reset-latch:disabled{opacity:.45;cursor:not-allowed}

.relay-tripbar{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:8px;padding:8px;border:1px solid rgba(255,255,255,.07);border-radius:6px;background:rgba(0,0,0,.22)}
.relay-tripbar>div{min-width:0;display:grid;gap:3px;align-content:start}
.relay-tripbar small{color:#8d999e;font:8px var(--font-mono);letter-spacing:.1em}
.relay-tripbar strong{color:#e7eef0;font:700 12px var(--font-mono)}
.relay-tripbar span{color:#96a2a7;font:8px var(--font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.relay-output-mimic .relay-mimic-chain{display:grid;grid-template-columns:30px minmax(10px,1fr) 30px minmax(10px,1fr) 30px;align-items:center;margin:2px 0}
.relay-mimic-chain span,.relay-mimic-chain b{display:grid;place-items:center;height:22px;border:1px solid #6a767a;border-radius:3px;background:rgba(255,255,255,.08);color:#dbe3e5;font:700 8px var(--font-mono)}
.relay-mimic-chain b{border-radius:50%}
.relay-mimic-chain i{height:2px;background:#6a767a}
.relay-output-mimic>strong{font-size:9px;letter-spacing:.06em}

.relay-deck{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 11px;border:1px solid rgba(255,255,255,.07);border-radius:8px;background:linear-gradient(180deg,#4b5257,#383f43);box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.relay-deck button{border:1px solid #232a2d;border-radius:5px;color:#d7dfe2;background:linear-gradient(180deg,#4d565b,#333a3e);box-shadow:inset 0 1px 0 rgba(255,255,255,.14);font:600 10px var(--font-mono);cursor:default}
.relay-deck-left,.relay-deck-right{display:grid;gap:6px}
.relay-deck-left button,.relay-deck-right button{width:32px;height:25px}
.relay-dpad{position:relative;justify-self:center;display:grid;grid-template-columns:repeat(3,26px);grid-template-rows:repeat(3,21px);gap:3px;padding:5px;border-radius:50%;background:radial-gradient(circle at 50% 40%,rgba(47,155,216,.3),rgba(0,0,0,.28) 70%);box-shadow:inset 0 0 0 1px rgba(47,155,216,.4)}
.relay-dpad button{width:100%;height:100%;font-size:9px}
.dpad-up{grid-area:1/2}.dpad-left{grid-area:2/1}.dpad-ok{grid-area:2/2;border-radius:50%!important;font-weight:700}.dpad-right{grid-area:2/3}.dpad-down{grid-area:3/2}
.relay-usb{display:grid;justify-items:center;gap:3px;padding:6px 8px;border:1px solid #232a2d;border-radius:5px;background:linear-gradient(180deg,#3f474b,#2c3235)}
.relay-usb i{width:20px;height:9px;border:1px solid #6d797d;border-radius:2px;background:#20262a}
.relay-usb span{color:#8d999e;font:7px var(--font-mono);letter-spacing:.1em}

.relay-device[data-relay-state="trip"]{box-shadow:inset 0 0 0 2px rgba(239,64,78,.5),0 14px 30px rgba(0,0,0,.5)}
.relay-device[data-relay-state="trip"] .relay-lcd{background-color:#f6dcdc}
.relay-device[data-relay-state="trip"] .relay-lcd-head{background:linear-gradient(180deg,#c3414c,#962c35)}
.relay-device[data-relay-state="trip"] .relay-mimic-chain i{background:#ef404e;box-shadow:0 0 6px rgba(239,64,78,.5)}
.relay-device[data-relay-state="blocked"] .relay-lcd{background-color:#e5e2f4}
.relay-device[data-relay-state="blocked"] .relay-lcd-head{background:linear-gradient(180deg,#6f5fbe,#4d3f95)}
.relay-device[data-relay-state="secure"] .relay-lcd{background-color:#f4eddb}
.relay-device[data-relay-state="secure"] .relay-lcd-head{background:linear-gradient(180deg,#c69a3c,#9a742a)}

@media(max-width:1320px){.workspace{grid-template-columns:190px minmax(0,1fr) 190px clamp(300px,24vw,360px)}.relay-face{grid-template-columns:82px minmax(0,1fr) 44px}}
@media(max-width:1180px){.workspace{grid-template-columns:180px minmax(0,1fr) 180px 300px}.relay-panel{padding:6px}.relay-device{padding:8px;gap:6px}.relay-face{grid-template-columns:76px minmax(0,1fr) 42px;gap:6px}.relay-lcd-body{padding:6px 7px;gap:5px}.relay-deck{gap:6px;padding:7px}.relay-dpad{grid-template-columns:repeat(3,22px);grid-template-rows:repeat(3,18px)}}
@media(max-width:980px){.workspace{grid-template-columns:220px minmax(0,1fr)}.relay-panel{grid-column:1/-1;min-height:560px}.relay-device{max-width:420px}}
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
