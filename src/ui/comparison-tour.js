const TOUR_STORAGE_KEY = '87l-two-mode-tour-v2';
const NORMAL_JITTER_MS = 0.08;
const TRACKING_OBSERVE_MS = 5000;
const CARD_GAP = 18;
const VIEWPORT_GAP = 12;

const styles = `
.algorithm-tabs[data-comparison-only="true"]{grid-template-columns:repeat(2,minmax(0,1fr));min-width:min(520px,42vw)}
.algorithm-tabs[data-comparison-only="true"] .algorithm-tab{padding-inline:14px}
#comparison-demo-button{width:auto;min-width:62px;height:30px;padding:0 9px;border:1px solid rgba(84,214,195,.42);border-radius:5px;color:var(--accent);background:rgba(84,214,195,.08);font:700 8px var(--font-mono);letter-spacing:.08em;white-space:nowrap;transition:border-color .16s ease,background .16s ease,transform .16s ease}
#comparison-demo-button:hover{background:rgba(84,214,195,.16);border-color:rgba(84,214,195,.7);transform:translateY(-1px)}

.comparison-tour-scrim{position:fixed;inset:0;z-index:900;background:rgba(0,8,12,.52);pointer-events:none;opacity:0;transition:opacity .2s ease}
.comparison-tour-scrim.is-visible{opacity:1}
.comparison-tour-spotlight{--tour-color:84,214,195;position:fixed;z-index:902;display:none;pointer-events:none;border:2px solid rgb(var(--tour-color));border-radius:10px;box-shadow:0 0 0 4px rgba(var(--tour-color),.18),0 0 30px rgba(var(--tour-color),.28);transition:left .18s cubic-bezier(.22,.61,.36,1),top .18s cubic-bezier(.22,.61,.36,1),width .18s cubic-bezier(.22,.61,.36,1),height .18s cubic-bezier(.22,.61,.36,1),border-radius .18s ease}
.comparison-tour-spotlight.is-visible{display:block}
.comparison-tour-spotlight::before{content:"";position:absolute;inset:-8px;border:2px solid rgba(var(--tour-color),.55);border-radius:inherit;opacity:.75;will-change:transform,opacity;animation:tour-ring-pulse 1.05s ease-out infinite}
.comparison-tour-spotlight::after{content:"";position:absolute;inset:3px;border-radius:8px;background:linear-gradient(110deg,transparent 15%,rgba(var(--tour-color),.16) 48%,transparent 72%);opacity:.7;will-change:transform;animation:tour-sheen 1.45s ease-in-out infinite}
.comparison-tour-spotlight[data-tone="danger"]{--tour-color:239,64,78}
.comparison-tour-spotlight[data-tone="success"]{--tour-color:61,220,127}

.comparison-tour-prompt{--tour-color:84,214,195;position:fixed;z-index:905;display:none;pointer-events:none;padding:5px 8px;border:1px solid rgba(var(--tour-color),.5);border-radius:999px;background:rgb(7 22 25 / .98);color:rgb(var(--tour-color));box-shadow:0 8px 22px rgba(0,0,0,.32);font:800 8px var(--font-mono);letter-spacing:.09em;white-space:nowrap;will-change:transform,opacity;animation:tour-prompt-bob .9s ease-in-out infinite}
.comparison-tour-prompt.is-visible{display:block}
.comparison-tour-prompt[data-tone="danger"]{--tour-color:239,64,78}
.comparison-tour-prompt[data-tone="success"]{--tour-color:61,220,127}

.comparison-tour-card{--tour-arrow-x:50%;--tour-arrow-y:50%;position:fixed;z-index:906;width:min(350px,calc(100vw - 28px));padding:14px 15px 13px;border:1px solid rgba(84,214,195,.36);border-radius:10px;background:rgba(7,19,23,.985);box-shadow:0 20px 54px rgba(0,0,0,.54),0 0 0 1px rgba(255,255,255,.025) inset;color:#dce6e8;font-family:var(--font-mono);display:none;opacity:0;transform:translateY(5px);transition:opacity .16s ease,transform .16s ease}
.comparison-tour-card.is-visible{display:block;opacity:1;transform:translateY(0)}
.comparison-tour-card::before{content:"";position:absolute;width:12px;height:12px;background:#071317;transform:rotate(45deg);z-index:-1}
.comparison-tour-card[data-placement="bottom"]::before{top:-7px;left:var(--tour-arrow-x);margin-left:-6px;border-left:1px solid rgba(84,214,195,.36);border-top:1px solid rgba(84,214,195,.36)}
.comparison-tour-card[data-placement="top"]::before{bottom:-7px;left:var(--tour-arrow-x);margin-left:-6px;border-right:1px solid rgba(84,214,195,.36);border-bottom:1px solid rgba(84,214,195,.36)}
.comparison-tour-card[data-placement="right"]::before{left:-7px;top:var(--tour-arrow-y);margin-top:-6px;border-left:1px solid rgba(84,214,195,.36);border-bottom:1px solid rgba(84,214,195,.36)}
.comparison-tour-card[data-placement="left"]::before{right:-7px;top:var(--tour-arrow-y);margin-top:-6px;border-right:1px solid rgba(84,214,195,.36);border-top:1px solid rgba(84,214,195,.36)}
.comparison-tour-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}
.comparison-tour-step{display:inline-flex;align-items:center;gap:6px;color:var(--accent);font-size:8px;font-weight:800;letter-spacing:.12em}
.comparison-tour-step::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px rgba(84,214,195,.65);animation:tour-dot 1.1s ease-in-out infinite}
.comparison-tour-close{width:24px;height:24px;padding:0;border:1px solid rgba(255,255,255,.12);border-radius:50%;background:transparent;color:#aab7bb;font:600 12px var(--font-mono);transition:background .15s ease,color .15s ease}
.comparison-tour-close:hover{background:rgba(255,255,255,.07);color:#eef4f5}
.comparison-tour-card h3{margin:0 0 7px;font:700 13px/1.28 var(--font-mono);color:#f0f5f6}
.comparison-tour-card p{margin:0;color:#b5c2c6;font:9.5px/1.58 var(--font-mono)}
.comparison-tour-status{min-height:16px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.055);color:#76d9c9;font:8.5px/1.4 var(--font-mono)}
.comparison-tour-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:11px}
.comparison-tour-actions button{height:29px;padding:0 10px;border:1px solid rgba(255,255,255,.14);border-radius:5px;background:rgba(255,255,255,.04);color:#cbd5d8;font:700 8px var(--font-mono);letter-spacing:.06em;transition:transform .14s ease,border-color .14s ease,background .14s ease}
.comparison-tour-actions button:hover{transform:translateY(-1px);border-color:rgba(255,255,255,.28)}
.comparison-tour-actions button.is-primary{border-color:rgba(84,214,195,.55);background:rgba(84,214,195,.12);color:var(--accent)}

.comparison-tour-focus{position:relative!important;z-index:903!important}
.comparison-tour-focus[data-tour-action="click"]{animation:tour-click-target 1s ease-in-out infinite}
.comparison-tour-focus[data-tour-action="drag"] input[type="range"],input[type="range"].comparison-tour-focus[data-tour-action="drag"]{filter:brightness(1.28) saturate(1.16)}

@keyframes tour-ring-pulse{0%{transform:scale(.96);opacity:.8}70%{transform:scale(1.055);opacity:.12}100%{transform:scale(1.065);opacity:0}}
@keyframes tour-sheen{0%,100%{transform:translateX(-16%);opacity:.15}50%{transform:translateX(16%);opacity:.58}}
@keyframes tour-prompt-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes tour-dot{0%,100%{opacity:.45;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
@keyframes tour-click-target{0%,100%{filter:brightness(1);box-shadow:0 0 0 0 rgba(84,214,195,0)}50%{filter:brightness(1.22);box-shadow:0 0 0 5px rgba(84,214,195,.18)}}

@media(max-width:1180px){.algorithm-tabs[data-comparison-only="true"]{min-width:330px}.algorithm-tabs[data-comparison-only="true"] .algorithm-tab{padding-inline:8px;font-size:8px}.comparison-tour-card{width:min(320px,calc(100vw - 24px))}}
@media(max-width:760px){.algorithm-tabs[data-comparison-only="true"]{min-width:0}.comparison-tour-card{left:12px!important;right:12px!important;width:auto!important;max-width:none}.comparison-tour-card::before{display:none}.comparison-tour-prompt{font-size:7.5px}}
@media(prefers-reduced-motion:reduce){.comparison-tour-spotlight::before,.comparison-tour-spotlight::after,.comparison-tour-prompt,.comparison-tour-step::before,.comparison-tour-focus[data-tour-action="click"]{animation:none!important}.comparison-tour-card,.comparison-tour-spotlight{transition:none!important}}
`;

function element(id){return document.getElementById(id)}
function clamp(value,min,max){return Math.min(max,Math.max(min,value))}

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
    this.geometryFrame=null;
    this.currentPrompt='';
    this.currentTone='normal';
    this.currentAction='observe';
    this.card=this.createCard();
    this.scrim=this.createScrim();
    this.spotlight=this.createSpotlight();
    this.prompt=this.createPrompt();
    this.onViewportChange=()=>this.scheduleGeometry();
    window.addEventListener('resize',this.onViewportChange,{passive:true});
    window.addEventListener('scroll',this.onViewportChange,{passive:true,capture:true});
  }

  createScrim(){
    const node=document.createElement('div');
    node.className='comparison-tour-scrim';
    node.setAttribute('aria-hidden','true');
    document.body.append(node);
    return node;
  }

  createSpotlight(){
    const node=document.createElement('div');
    node.className='comparison-tour-spotlight';
    node.setAttribute('aria-hidden','true');
    document.body.append(node);
    return node;
  }

  createPrompt(){
    const node=document.createElement('div');
    node.className='comparison-tour-prompt';
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

  clearFocus(){
    if(!this.focused) return;
    this.focused.classList.remove('comparison-tour-focus');
    this.focused.removeAttribute('data-tour-tone');
    this.focused.removeAttribute('data-tour-action');
    this.focused=null;
  }

  focus(target,tone='normal',action='observe',prompt=''){
    this.clearFocus();
    this.focused=target instanceof HTMLElement?target:null;
    this.currentTone=tone;
    this.currentAction=action;
    this.currentPrompt=prompt;
    if(!this.focused){
      this.spotlight.classList.remove('is-visible');
      this.prompt.classList.remove('is-visible');
      return;
    }
    this.focused.classList.add('comparison-tour-focus');
    this.focused.dataset.tourTone=tone;
    this.focused.dataset.tourAction=action;
    this.focused.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'smooth'});
    this.spotlight.dataset.tone=tone;
    this.prompt.dataset.tone=tone;
    this.prompt.textContent=prompt;
    this.spotlight.classList.add('is-visible');
    this.prompt.classList.toggle('is-visible',Boolean(prompt));
    this.scheduleGeometry();
    window.setTimeout(()=>this.scheduleGeometry(),220);
  }

  scheduleGeometry(){
    if(this.geometryFrame!==null) return;
    this.geometryFrame=requestAnimationFrame(()=>{
      this.geometryFrame=null;
      this.positionGeometry();
    });
  }

  preferredPlacements(targetRect,cardRect){
    const spaces={
      bottom:window.innerHeight-targetRect.bottom,
      top:targetRect.top,
      right:window.innerWidth-targetRect.right,
      left:targetRect.left
    };
    const fits={
      bottom:spaces.bottom>=cardRect.height+CARD_GAP+VIEWPORT_GAP,
      top:spaces.top>=cardRect.height+CARD_GAP+VIEWPORT_GAP,
      right:spaces.right>=cardRect.width+CARD_GAP+VIEWPORT_GAP,
      left:spaces.left>=cardRect.width+CARD_GAP+VIEWPORT_GAP
    };
    const centerX=targetRect.left+targetRect.width/2;
    const centerY=targetRect.top+targetRect.height/2;
    const bias=centerX<window.innerWidth*.3?['right','bottom','top','left']:
      centerX>window.innerWidth*.72?['left','bottom','top','right']:
      centerY<window.innerHeight*.28?['bottom','right','left','top']:
      ['top','bottom','right','left'];
    const fitting=bias.filter((placement)=>fits[placement]);
    if(fitting.length>0) return fitting;
    return Object.entries(spaces).sort((a,b)=>b[1]-a[1]).map(([placement])=>placement);
  }

  positionGeometry(){
    if(!this.focused||!this.card.classList.contains('is-visible')) return;
    const targetRect=this.focused.getBoundingClientRect();
    if(targetRect.width<=0||targetRect.height<=0) return;
    const pad=this.currentAction==='click'?7:this.currentAction==='drag'?6:5;
    const spotLeft=clamp(targetRect.left-pad,4,window.innerWidth-8);
    const spotTop=clamp(targetRect.top-pad,4,window.innerHeight-8);
    const spotRight=clamp(targetRect.right+pad,8,window.innerWidth-4);
    const spotBottom=clamp(targetRect.bottom+pad,8,window.innerHeight-4);
    Object.assign(this.spotlight.style,{
      left:`${spotLeft}px`,top:`${spotTop}px`,width:`${Math.max(8,spotRight-spotLeft)}px`,height:`${Math.max(8,spotBottom-spotTop)}px`
    });

    const cardRect=this.card.getBoundingClientRect();
    const placement=this.preferredPlacements(targetRect,cardRect)[0]??'bottom';
    const targetCenterX=targetRect.left+targetRect.width/2;
    const targetCenterY=targetRect.top+targetRect.height/2;
    let left;
    let top;
    if(placement==='bottom'){
      left=clamp(targetCenterX-cardRect.width/2,VIEWPORT_GAP,window.innerWidth-cardRect.width-VIEWPORT_GAP);
      top=clamp(targetRect.bottom+CARD_GAP,VIEWPORT_GAP,window.innerHeight-cardRect.height-VIEWPORT_GAP);
    }else if(placement==='top'){
      left=clamp(targetCenterX-cardRect.width/2,VIEWPORT_GAP,window.innerWidth-cardRect.width-VIEWPORT_GAP);
      top=clamp(targetRect.top-cardRect.height-CARD_GAP,VIEWPORT_GAP,window.innerHeight-cardRect.height-VIEWPORT_GAP);
    }else if(placement==='right'){
      left=clamp(targetRect.right+CARD_GAP,VIEWPORT_GAP,window.innerWidth-cardRect.width-VIEWPORT_GAP);
      top=clamp(targetCenterY-cardRect.height/2,VIEWPORT_GAP,window.innerHeight-cardRect.height-VIEWPORT_GAP);
    }else{
      left=clamp(targetRect.left-cardRect.width-CARD_GAP,VIEWPORT_GAP,window.innerWidth-cardRect.width-VIEWPORT_GAP);
      top=clamp(targetCenterY-cardRect.height/2,VIEWPORT_GAP,window.innerHeight-cardRect.height-VIEWPORT_GAP);
    }
    this.card.dataset.placement=placement;
    this.card.style.left=`${left}px`;
    this.card.style.top=`${top}px`;
    this.card.style.right='auto';
    this.card.style.bottom='auto';
    this.card.style.setProperty('--tour-arrow-x',`${clamp(targetCenterX-left,24,cardRect.width-24)}px`);
    this.card.style.setProperty('--tour-arrow-y',`${clamp(targetCenterY-top,24,cardRect.height-24)}px`);

    if(this.currentPrompt){
      const promptRect=this.prompt.getBoundingClientRect();
      let promptLeft=spotRight-promptRect.width;
      let promptTop=spotTop-promptRect.height-8;
      if(promptTop<VIEWPORT_GAP) promptTop=spotBottom+8;
      promptLeft=clamp(promptLeft,VIEWPORT_GAP,window.innerWidth-promptRect.width-VIEWPORT_GAP);
      promptTop=clamp(promptTop,VIEWPORT_GAP,window.innerHeight-promptRect.height-VIEWPORT_GAP);
      this.prompt.style.left=`${promptLeft}px`;
      this.prompt.style.top=`${promptTop}px`;
    }
  }

  render({step,title,body,target=null,tone='normal',status='',actions=[],action='observe',prompt=''}){
    this.scrim.classList.add('is-visible');
    this.card.classList.add('is-visible');
    this.card.querySelector('.comparison-tour-step').textContent=step;
    this.card.querySelector('h3').textContent=title;
    this.card.querySelector('p').textContent=body;
    this.card.querySelector('.comparison-tour-status').textContent=status;
    const actionHost=this.card.querySelector('.comparison-tour-actions');
    actionHost.replaceChildren(...actions.map((item)=>{
      const button=document.createElement('button');
      button.type='button';
      button.textContent=item.label;
      if(item.primary) button.classList.add('is-primary');
      button.addEventListener('click',item.onClick);
      return button;
    }));
    this.focus(target,tone,action,prompt);
    this.scheduleGeometry();
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
      status:'The guide will highlight exactly what to drag or click next.',
      prompt:'START HERE',
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
      title:'Drag Timing jitter to the right',
      body:'Move the slider slowly to the right. Keep increasing jitter and watch Idiff. Stop when the virtual relay latches TRIP.',
      target:rangeField('jitterMs'),
      action:'drag',
      prompt:'DRAG RIGHT →',
      status:'Only the communication path is being stressed. The electrical scenario stays healthy.'
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
      body:`At about ${this.firstTripJitter.toFixed(2)} ms jitter, timing misalignment was enough to create an operating condition in this educational baseline.`,
      target:element('virtual-relay'),
      tone:'danger',
      action:'observe',
      prompt:'TRIP OBSERVED',
      status:'Next, the guide will point to Waveform Tracking.'
    });
    window.setTimeout(()=>this.waitForTrackingSelection(),900);
  }

  waitForTrackingSelection(){
    if(this.phase!=='trip-observed') return;
    const tracking=document.querySelector('[data-algorithm="smart-tracking"]');
    this.render({
      step:'2 / 4 · COMPARE',
      title:'Click Waveform Tracking',
      body:'Select B · 87L + Waveform Tracking. The demo will then normalize the communication injection and reset the relay automatically.',
      target:tracking,
      action:'click',
      prompt:'CLICK HERE',
      status:'The highlighted button is the only action needed now.'
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
      step:'3 / 4 · AUTO RESET',
      title:'Preparing the same test again',
      body:'Waveform Tracking is selected. Jitter and the other communication injections are returning to the healthy baseline, then the relay latch is cleared.',
      target:element('virtual-relay'),
      action:'observe',
      prompt:'AUTO RESET',
      status:'Preparing the second pass…'
    });
    window.setTimeout(()=>{
      const resetLatch=element('relay-reset-latch');
      if(resetLatch && !resetLatch.disabled) resetLatch.click();
      showCommControls();
      window.setTimeout(()=>this.trackingJitterStep(),240);
    },700);
  }

  trackingJitterStep(){
    this.phase='tracking-jitter';
    const jitter=element('jitterMs');
    this.render({
      step:'3 / 4 · AFTER',
      title:'Repeat the same jitter stress',
      body:`Drag Timing jitter right again. Reach at least ${this.compareJitter.toFixed(2)} ms — the same or stronger stress than the conventional trip point.`,
      target:rangeField('jitterMs'),
      action:'drag',
      prompt:'DRAG RIGHT →',
      status:'The guide will automatically continue when the comparison point is reached.'
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
      body:'Waveform tracking is working with bounded timing correction and evidence supervision. Keep the current jitter applied while the demo observes the relay.',
      target:relay,
      action:'observe',
      prompt:'HOLD & WATCH',
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
    },250);
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
      body:'The comparison stays evidence-based, so the guide will not fake a pass. Reset the second pass and try the same jitter point again after the tracker settles.',
      target:element('virtual-relay'),
      tone:'danger',
      action:'observe',
      prompt:'TRIP OBSERVED',
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
      title:'Waveform Tracking held the relay stable',
      body:`Under the repeated communication stress, waveform-assisted alignment added resilience without pretending bad data is safe.${diagnostic} This can make 87L more robust against timing anomalies such as jitter, path asymmetry, route changes, and related packet-timing disturbance.`,
      target:element('virtual-relay'),
      tone:'success',
      action:'observe',
      prompt:'NO FALSE TRIP',
      status:'If evidence becomes fundamentally invalid, protection can still supervise or block rather than operate blindly.',
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
    if(this.geometryFrame!==null){cancelAnimationFrame(this.geometryFrame);this.geometryFrame=null}
    if(markSeen){try{localStorage.setItem(TOUR_STORAGE_KEY,'seen')}catch{}}
    this.card.classList.remove('is-visible');
    this.scrim.classList.remove('is-visible');
    this.spotlight.classList.remove('is-visible');
    this.prompt.classList.remove('is-visible');
    this.clearFocus();
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
