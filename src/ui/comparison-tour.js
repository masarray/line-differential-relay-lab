const TOUR_STORAGE_KEY = '87l-two-mode-tour-v1';
const NORMAL_JITTER_MS = 0.08;
const TRACKING_OBSERVE_MS = 5000;

const styles = `
.algorithm-tabs[data-comparison-only="true"]{grid-template-columns:repeat(2,minmax(0,1fr));min-width:min(520px,42vw)}
.algorithm-tabs[data-comparison-only="true"] .algorithm-tab{padding-inline:14px}
#comparison-demo-button{width:auto;min-width:62px;height:30px;padding:0 9px;border:1px solid rgba(84,214,195,.42);border-radius:5px;color:var(--accent);background:rgba(84,214,195,.08);font:700 8px var(--font-mono);letter-spacing:.08em;white-space:nowrap}
#comparison-demo-button:hover{background:rgba(84,214,195,.16);border-color:rgba(84,214,195,.7)}
.comparison-tour-scrim{position:fixed;inset:0;z-index:900;background:rgba(0,8,12,.22);pointer-events:none;opacity:0;transition:opacity .18s ease}
.comparison-tour-scrim.is-visible{opacity:1}
.comparison-tour-card{position:fixed;z-index:904;width:min(360px,calc(100vw - 28px));padding:14px 15px 13px;border:1px solid rgba(84,214,195,.32);border-radius:9px;background:rgba(8,20,24,.97);box-shadow:0 18px 48px rgba(0,0,0,.48);color:#dce6e8;font-family:var(--font-mono);display:none}
.comparison-tour-card.is-visible{display:block}
.comparison-tour-card.is-left{left:16px;right:auto;bottom:16px}.comparison-tour-card:not(.is-left){right:16px;left:auto;bottom:16px}
.comparison-tour-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:7px}
.comparison-tour-step{color:var(--accent);font-size:8px;font-weight:700;letter-spacing:.12em}
.comparison-tour-close{width:24px;height:24px;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:transparent;color:#aab7bb;font:600 12px var(--font-mono)}
.comparison-tour-card h3{margin:0 0 7px;font:700 13px/1.25 var(--font-mono);color:#f0f5f6}
.comparison-tour-card p{margin:0;color:#b5c2c6;font:9.5px/1.55 var(--font-mono)}
.comparison-tour-status{min-height:16px;margin-top:8px;color:#76d9c9;font:8.5px/1.35 var(--font-mono)}
.comparison-tour-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:11px}
.comparison-tour-actions button{height:29px;padding:0 10px;border:1px solid rgba(255,255,255,.14);border-radius:5px;background:rgba(255,255,255,.04);color:#cbd5d8;font:700 8px var(--font-mono);letter-spacing:.06em}
.comparison-tour-actions button.is-primary{border-color:rgba(84,214,195,.55);background:rgba(84,214,195,.12);color:var(--accent)}
.comparison-tour-focus{position:relative!important;z-index:902!important;box-shadow:0 0 0 2px rgba(84,214,195,.9),0 0 0 7px rgba(84,214,195,.16),0 12px 28px rgba(0,0,0,.38)!important;border-radius:7px;transition:box-shadow .18s ease}
.comparison-tour-focus[data-tour-tone="danger"]{box-shadow:0 0 0 2px rgba(239,64,78,.95),0 0 0 8px rgba(239,64,78,.2),0 12px 32px rgba(0,0,0,.42)!important}
.comparison-tour-focus[data-tour-tone="success"]{box-shadow:0 0 0 2px rgba(61,220,127,.95),0 0 0 8px rgba(61,220,127,.18),0 12px 32px rgba(0,0,0,.42)!important}
@media(max-width:1180px){.algorithm-tabs[data-comparison-only="true"]{min-width:330px}.algorithm-tabs[data-comparison-only="true"] .algorithm-tab{padding-inline:8px;font-size:8px}}
@media(max-width:760px){.comparison-tour-card.is-left,.comparison-tour-card:not(.is-left){left:14px;right:14px;bottom:14px;width:auto}.algorithm-tabs[data-comparison-only="true"]{min-width:0}}
`;

function element(id){return document.getElementById(id)}

function dispatch(control,type='input'){
  control?.dispatchEvent(new Event(type,{bubbles:true}));
}

function rangeField(id){
  return element(id)?.closest('.range-field') ?? element(id);
}

function hideControl(id){
  const control=element(id);
  const wrapper=control?.closest('.range-field,.switch-row');
  if(wrapper){
    wrapper.hidden=true;
    wrapper.setAttribute('aria-hidden','true');
  }
}

function simplifyComparatorUI(){
  const tabs=document.querySelector('.algorithm-tabs');
  if(tabs){
    tabs.dataset.comparisonOnly='true';
    tabs.setAttribute('aria-label','Line differential before and after comparison');
    tabs.querySelector('[data-algorithm="secure-window"]')?.remove();
    tabs.querySelector('[data-algorithm="gps"]')?.remove();
    const conventional=tabs.querySelector('[data-algorithm="ping-pong"]');
    const tracking=tabs.querySelector('[data-algorithm="smart-tracking"]');
    if(conventional){
      conventional.innerHTML='<span>A</span> Conventional 87L';
      conventional.title='Conventional line differential using RTT/2 timing alignment';
    }
    if(tracking){
      tracking.innerHTML='<span>B</span> 87L + Waveform Tracking';
      tracking.title='Line differential with bounded waveform-assisted timing alignment';
    }
  }

  const brandSub=document.querySelector('.brand-sub');
  if(brandSub) brandSub.textContent='conventional vs waveform-tracked 87L · communication anomaly laboratory';

  hideControl('gpsSyncValid');
  hideControl('gpsHoldover');
  hideControl('secureWindowMs');
  hideControl('recoveryValidationMs');

  const timeNote=document.querySelector('[data-control-page="time"] .engineering-note');
  if(timeNote) timeNote.textContent='Clock offset, drift, and packet age let you study timing uncertainty without adding another protection mode.';

  const policyTab=document.querySelector('[data-control-tab="policy"]');
  if(policyTab) policyTab.textContent='TUNE';

  const syncLost=document.querySelector('#preset-select option[value="syncLost"]');
  syncLost?.remove();

  const secureClock=document.querySelector('.secure-clock');
  if(secureClock){
    secureClock.hidden=true;
    secureClock.setAttribute('aria-hidden','true');
  }

  const secureLedLabel=element('relay-secure-led')?.nextElementSibling;
  if(secureLedLabel) secureLedLabel.textContent='SUPERV';
}

function ensureRunning(){
  if(element('run-state')?.textContent==='PAUSED') element('play-button')?.click();
}

function chooseMode(mode){
  const button=document.querySelector(`[data-algorithm="${mode}"]`);
  if(button && !button.classList.contains('is-active')) button.click();
}

function chooseNormalPreset(){
  const preset=element('preset-select');
  if(!preset) return;
  preset.value='normal';
  dispatch(preset,'change');
}

function setJitter(value){
  const jitter=element('jitterMs');
  if(!jitter) return;
  jitter.value=String(value);
  dispatch(jitter,'input');
}

function showCommControls(){
  document.querySelector('[data-control-tab="comm"]')?.click();
}

function normalizeInjection(mode){
  ensureRunning();
  chooseMode(mode);
  chooseNormalPreset();
  setJitter(NORMAL_JITTER_MS);
  showCommControls();
  element('reset-button')?.click();
}

class ComparisonTour{
  constructor(){
    this.phase='idle';
    this.firstTripJitter=2;
    this.compareJitter=2;
    this.focused=null;
    this.tripObserver=null;
    this.modeObserver=null;
    this.watchTimer=null;
    this.watchInterval=null;
    this.card=this.createCard();
    this.scrim=this.createScrim();
  }

  createScrim(){
    const node=document.createElement('div');
    node.className='comparison-tour-scrim';
    node.setAttribute('aria-hidden','true');
    document.body.append(node);
    return node;
  }

  createCard(){
    const card=document.createElement('section');
    card.className='comparison-tour-card';
    card.setAttribute('role','dialog');
    card.setAttribute('aria-live','polite');
    card.innerHTML=`<div class="comparison-tour-head"><span class="comparison-tour-step"></span><button class="comparison-tour-close" type="button" aria-label="Close guided demo">×</button></div><h3></h3><p></p><div class="comparison-tour-status"></div><div class="comparison-tour-actions"></div>`;
    card.querySelector('.comparison-tour-close').addEventListener('click',()=>this.finish(true));
    document.body.append(card);
    return card;
  }

  clearTimers(){
    if(this.watchTimer!==null) window.clearTimeout(this.watchTimer);
    if(this.watchInterval!==null) window.clearInterval(this.watchInterval);
    this.watchTimer=null;
    this.watchInterval=null;
  }

  clearObservers(){
    this.tripObserver?.disconnect();
    this.modeObserver?.disconnect();
    this.tripObserver=null;
    this.modeObserver=null;
  }

  focus(target,tone='normal'){
    if(this.focused){
      this.focused.classList.remove('comparison-tour-focus');
      this.focused.removeAttribute('data-tour-tone');
    }
    this.focused=target instanceof HTMLElement?target:null;
    if(!this.focused) return;
    this.focused.classList.add('comparison-tour-focus');
    this.focused.dataset.tourTone=tone;
    const rect=this.focused.getBoundingClientRect();
    this.card.classList.toggle('is-left',rect.left+rect.width/2>window.innerWidth*.58);
    this.focused.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'smooth'});
  }

  render({step,title,body,target=null,tone='normal',status='',actions=[]}){
    this.scrim.classList.add('is-visible');
    this.card.classList.add('is-visible');
    this.card.querySelector('.comparison-tour-step').textContent=step;
    this.card.querySelector('h3').textContent=title;
    this.card.querySelector('p').textContent=body;
    this.card.querySelector('.comparison-tour-status').textContent=status;
    const actionHost=this.card.querySelector('.comparison-tour-actions');
    actionHost.replaceChildren(...actions.map((action)=>{
      const button=document.createElement('button');
      button.type='button';
      button.textContent=action.label;
      if(action.primary) button.classList.add('is-primary');
      button.addEventListener('click',action.onClick);
      return button;
    }));
    this.focus(target,tone);
  }

  intro(){
    this.phase='intro';
    this.clearTimers();
    this.clearObservers();
    this.render({
      step:'60-SECOND BEFORE / AFTER',
      title:'See why waveform tracking matters',
      body:'You will create communication jitter yourself. First, conventional 87L will show the timing-error risk. Then you will repeat the same stress with waveform tracking.',
      target:document.querySelector('.algorithm-tabs'),
      actions:[
        {label:'NOT NOW',onClick:()=>this.finish(true)},
        {label:'START DEMO',primary:true,onClick:()=>this.startBaseline()}
      ]
    });
  }

  startBaseline(){
    this.phase='preparing-baseline';
    normalizeInjection('ping-pong');
    const resetLatch=element('relay-reset-latch');
    window.setTimeout(()=>{
      if(resetLatch && !resetLatch.disabled) resetLatch.click();
      this.baselineJitterStep();
    },420);
  }

  baselineJitterStep(){
    this.phase='baseline-jitter';
    const relay=element('virtual-relay');
    const jitter=element('jitterMs');
    this.render({
      step:'1 / 4 · BEFORE',
      title:'Stress conventional 87L with jitter',
      body:'Slowly drag Timing jitter to the right. Keep increasing it and watch the differential current. Stop when the relay latches TRIP.',
      target:rangeField('jitterMs'),
      status:'You are changing the communication path — not the electrical fault scenario.'
    });

    const detectTrip=()=>{
      if(this.phase!=='baseline-jitter'||relay?.dataset.relayState!=='trip') return;
      this.firstTripJitter=Math.max(NORMAL_JITTER_MS,Number(jitter?.value)||NORMAL_JITTER_MS);
      this.compareJitter=Math.min(4,Math.max(1.5,this.firstTripJitter));
      this.showTripObserved();
    };
    this.tripObserver=new MutationObserver(detectTrip);
    if(relay) this.tripObserver.observe(relay,{attributes:true,attributeFilter:['data-relay-state']});
    detectTrip();
  }

  showTripObserved(){
    this.phase='trip-observed';
    this.tripObserver?.disconnect();
    this.render({
      step:'2 / 4 · RESULT',
      title:'Conventional 87L latched TRIP',
      body:`At about ${this.firstTripJitter.toFixed(2)} ms jitter, timing misalignment was enough to create an operating condition in this educational baseline. Now select B · 87L + Waveform Tracking.`,
      target:element('virtual-relay'),
      tone:'danger',
      status:'Next: switch the algorithm. The demo will reset and normalize the injection automatically.'
    });
    window.setTimeout(()=>this.waitForTrackingSelection(),650);
  }

  waitForTrackingSelection(){
    if(this.phase!=='trip-observed') return;
    const tracking=document.querySelector('[data-algorithm="smart-tracking"]');
    this.render({
      step:'2 / 4 · COMPARE',
      title:'Choose waveform tracking',
      body:'Click B · 87L + Waveform Tracking. After you select it, the relay latch and communication injection will be returned to the same healthy baseline automatically.',
      target:tracking,
      status:'The electrical scenario remains Healthy through current.'
    });
    const detect=()=>{
      if(this.phase==='trip-observed'&&tracking?.classList.contains('is-active')) this.prepareTrackingPass();
    };
    this.modeObserver=new MutationObserver(detect);
    if(tracking) this.modeObserver.observe(tracking,{attributes:true,attributeFilter:['class']});
    tracking?.addEventListener('click',()=>window.setTimeout(detect,0),{once:true});
    detect();
  }

  prepareTrackingPass(){
    this.phase='preparing-tracking';
    this.modeObserver?.disconnect();
    normalizeInjection('smart-tracking');
    this.render({
      step:'3 / 4 · RESET',
      title:'Same baseline, smarter alignment path',
      body:'Waveform tracking is selected. The simulator is returning jitter and other communication injection to normal, then clearing the trip latch.',
      target:element('virtual-relay'),
      status:'Preparing the second pass…'
    });
    window.setTimeout(()=>{
      const resetLatch=element('relay-reset-latch');
      if(resetLatch && !resetLatch.disabled) resetLatch.click();
      showCommControls();
      window.setTimeout(()=>this.trackingJitterStep(),220);
    },620);
  }

  trackingJitterStep(){
    this.phase='tracking-jitter';
    const jitter=element('jitterMs');
    this.render({
      step:'3 / 4 · AFTER',
      title:'Repeat the jitter test',
      body:`Slowly drag Timing jitter right again. Reach at least ${this.compareJitter.toFixed(2)} ms — the same or stronger stress than the conventional trip point.`,
      target:rangeField('jitterMs'),
      status:'The tour will observe the relay for five seconds when you reach the comparison point.'
    });
    const onInput=()=>{
      if(this.phase!=='tracking-jitter') return;
      const value=Number(jitter?.value)||0;
      this.card.querySelector('.comparison-tour-status').textContent=`Current jitter ${value.toFixed(2)} ms · target ${this.compareJitter.toFixed(2)} ms`;
      if(value+0.03>=this.compareJitter) this.observeTracking();
    };
    jitter?.addEventListener('input',onInput,{passive:true});
    onInput();
  }

  observeTracking(){
    if(this.phase!=='tracking-jitter') return;
    this.phase='observe-tracking';
    const relay=element('virtual-relay');
    const started=performance.now();
    this.render({
      step:'4 / 4 · OBSERVE',
      title:'Hold the jitter and watch the relay',
      body:'Waveform tracking is now working with bounded timing correction and evidence supervision. Keep the current jitter applied while the demo observes the relay.',
      target:relay,
      status:'Observing for 5.0 s…'
    });
    const checkTrip=()=>{
      if(this.phase!=='observe-tracking') return false;
      if(relay?.dataset.relayState==='trip'){
        this.showTrackingRetry();
        return true;
      }
      return false;
    };
    this.tripObserver?.disconnect();
    this.tripObserver=new MutationObserver(checkTrip);
    if(relay) this.tripObserver.observe(relay,{attributes:true,attributeFilter:['data-relay-state']});
    this.watchInterval=window.setInterval(()=>{
      if(checkTrip()) return;
      const remaining=Math.max(0,TRACKING_OBSERVE_MS-(performance.now()-started));
      this.card.querySelector('.comparison-tour-status').textContent=`No TRIP latched · ${(remaining/1000).toFixed(1)} s remaining`;
    },200);
    this.watchTimer=window.setTimeout(()=>{
      if(!checkTrip()) this.showSuccess();
    },TRACKING_OBSERVE_MS);
  }

  showTrackingRetry(){
    this.phase='tracking-retry';
    this.clearTimers();
    this.tripObserver?.disconnect();
    this.render({
      step:'4 / 4 · RETRY',
      title:'This stress point still reached TRIP',
      body:'The comparison must stay evidence-based, so the demo will not fake a pass. Reset the second pass and try the same jitter point again after the tracker has settled.',
      target:element('virtual-relay'),
      tone:'danger',
      actions:[{label:'RESET SECOND PASS',primary:true,onClick:()=>this.prepareTrackingPass()}]
    });
  }

  showSuccess(){
    this.phase='success';
    this.clearTimers();
    this.tripObserver?.disconnect();
    const frame=window.__87L_LAB__?.frame;
    const correction=Number(frame?.alignment?.trackingCorrectionMs);
    const uncertainty=Number(frame?.alignment?.uncertaintyMs);
    const diagnostic=Number.isFinite(correction)&&Number.isFinite(uncertainty)
      ? ` Bounded waveform correction is ${correction.toFixed(2)} ms with estimated alignment uncertainty ±${uncertainty.toFixed(2)} ms.`
      : '';
    this.render({
      step:'4 / 4 · AFTER',
      title:'No false TRIP latched with waveform tracking',
      body:`Under the repeated communication stress, waveform-assisted alignment added resilience without pretending bad data is safe.${diagnostic} The same approach can help 87L handle timing anomalies such as jitter, path asymmetry, route changes, and related packet-timing disturbance more intelligently.`,
      target:element('virtual-relay'),
      tone:'success',
      status:'If evidence becomes fundamentally invalid, protection can still supervise or block instead of operating blindly.',
      actions:[
        {label:'REPLAY',onClick:()=>this.startBaseline()},
        {label:'DONE',primary:true,onClick:()=>this.finish(true)}
      ]
    });
    try{localStorage.setItem(TOUR_STORAGE_KEY,'done')}catch{}
  }

  finish(markSeen=false){
    this.phase='idle';
    this.clearTimers();
    this.clearObservers();
    if(markSeen){try{localStorage.setItem(TOUR_STORAGE_KEY,'seen')}catch{}}
    this.card.classList.remove('is-visible','is-left');
    this.scrim.classList.remove('is-visible');
    this.focus(null);
  }
}

export function installComparisonExperience(){
  if(typeof document==='undefined'||document.documentElement.dataset.comparisonExperience==='ready') return;
  document.documentElement.dataset.comparisonExperience='ready';
  simplifyComparatorUI();

  const style=document.createElement('style');
  style.id='comparison-tour-styles';
  style.textContent=styles;
  document.head.append(style);

  const tour=new ComparisonTour();
  const button=document.createElement('button');
  button.id='comparison-demo-button';
  button.type='button';
  button.textContent='▶ DEMO';
  button.title='Run the guided conventional vs waveform-tracking comparison';
  button.setAttribute('aria-label','Start guided conventional versus waveform tracking demo');
  button.addEventListener('click',()=>tour.intro());
  document.querySelector('.header-status')?.prepend(button);

  let seen=false;
  try{seen=Boolean(localStorage.getItem(TOUR_STORAGE_KEY))}catch{}
  if(!seen) window.setTimeout(()=>tour.intro(),850);
}
