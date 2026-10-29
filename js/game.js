import {
  CAMPAIGN_WAVES_PER_WORLD,
  CAMPAIGN_STAGES_PER_TIER,
  isCampaignTierUnlocked,
  COMBO_UNLOCKS,
  advanceSlowTimer,
  calculateSlowFactor,
  calculateBoostedSpeed,
  calculateVehicleSpeed,
  canClaimDailyGift,
  canClaimReward,
  calculatePilotRating,
  getCampaignBossHealth,
  getCampaignPosition,
  getCampaignRunRequirement,
  getPilotRank,
  getDailyRewardAmount,
  getGemPickupValue,
  getLevelIndex,
  isVehicleUnlocked,
  storeManualPowerup,
  consumeManualPowerup,
  selectLaserTargets,
  selectRocketTarget,
  updateGemX,
} from './game-mechanics.mjs';
import {
  WAR_LEVELS_PER_SCENARIO,
  WAR_LIFE_DROPS_PER_MISSION,
  WAR_SCENARIOS,
  WAR_TOTAL_MISSIONS,
  buildEnemyFormation,
  getWarMission,
  getWarGemDropLimit,
  getWarMissionReward,
  getWarBossAttackPattern,
  isWarMissionUnlocked,
  getWarBossHealth,
  getWarWaveCount,
  isWarBossWave,
  isWarLifeDropWave,
  isWarPowerupDropWave,
} from './war-mechanics.mjs';

(() => {
  'use strict';

  /* =====================================================
     Constants & configuration
  ===================================================== */
  const LANES = 3;
  const COLORS = {
    obstacle: '#ff4466',
    obstacleGlow: 'rgba(255, 68, 102, 0.30)',
    gem: '#ffcc55',
    gemGlow: 'rgba(255, 204, 85, 0.35)',
    shield: '#8fd3ff',
    magnet: '#ff8fd0',
    slow: '#c7a9ff',
    laser: '#ff8f5c',
  };
  const WAR_PROJECTILE_COLORS = Object.freeze({
    bolt: '#ff7285', ember: '#ff9c5e', lance: '#8feaff', toxin: '#adf06f',
    plasma: '#ff72dc', orb: '#b28cff', shard: '#b6d9ff', flare: '#ffd36e',
  });

  const GUIDE_TOPICS = {
    flight: { title: 'Flight basics', copy: 'Learn the controls and systems that make every flight count.' },
    fighters: { title: 'Meet your fleet', copy: 'Find the ship and ability that match your flying style.' },
    modes: { title: 'Choose your mission', copy: 'Explore every way to fly, collect, and progress.' },
    hangar: { title: 'Your pilot story', copy: 'Personalize your callsign, portraits, and career.' },
    warfront: { title: 'Enter the warfront', copy: 'Know your enemy, your weapons, and your next target.' },
  };
  const CFG = {
    baseSpeed: 300,
    maxSpeed: 800,
    creepPerPoint: 1.2,
    creepMax: 90,
    creepLate: 0.3,       // extra px/s per point after creep caps
    laneChangeTime: 0.11, // default; overridden by vehicle
    playerSize: 0.52,
    minRowGap: 240,
    rowGapSpeedFactor: 0.55,
    gemChance: 0.4,
    powerupChance: 0.14,
    magnetDur: 6,
    slowDur: 6,
    slowFactor: 0.45,
    slowRecoveryDur: 1.8,
    shieldImmunity: 1.2,
    startDelay: 0.6,
    nearMissWindow: 0.3,
    nearMissBonus: 15,
    laserScore: 10,
  };

  /* Vehicles: distinct silhouettes, one clear trait each */
  const VEHICLES = {
    dart: { name: 'DART', callsign: 'INTERCEPTOR', color: '#4af0c0', sizeMul: 1, laneTime: 0.11, perk: null, ability: 'Balanced handling', baseSpeed: null, maxSpeed: null, rating: 100 },
    ghost: { name: 'GHOST', callsign: 'GHOST WING', color: '#7fd0ff', sizeMul: 0.64, laneTime: 0.075, perk: null, ability: 'Stealth frame · smaller hitbox · rapid dodge', baseSpeed: 280, maxSpeed: 1200, rating: 145 },
    titan: { name: 'TITAN', callsign: 'HEAVY STRIKE', color: '#ffb347', sizeMul: 1.12, laneTime: 0.12, perk: 'shield', ability: 'Shielded · manual wing rockets', baseSpeed: 100, maxSpeed: 750, rocketAmmo: 3, rating: 175 },
    falcon: { name: 'FALCON', callsign: 'NORTH AMERICAN AERO', color: '#79aaff', sizeMul: 0.92, laneTime: 0.09, perk: 'phase', ability: 'Active phase · pass through hazards for 5 seconds', baseSpeed: 320, maxSpeed: 1020, price: 500, rating: 160 },
    sokol: { name: 'SOKOL', callsign: 'RUSSIAN-INSPIRED DELTA', color: '#ff796d', sizeMul: 1.04, laneTime: 0.105, perk: 'shield', shieldHits: 2, ability: 'Reinforced armor · two starting shield hits', baseSpeed: 250, maxSpeed: 850, price: 600, rating: 165 },
    longyu: { name: 'LONGYU', callsign: 'CHINESE-INSPIRED STEALTH', color: '#c7a9ff', sizeMul: 0.82, laneTime: 0.085, perk: 'magnet', ability: 'Stealth profile · passive gem attraction', baseSpeed: 300, maxSpeed: 940, price: 650, rating: 155 },
    mirage: { name: 'MIRAGE', callsign: 'PHANTOM INTERCEPTOR', color: '#a8c7ff', sizeMul: 0.9, laneTime: 0.085, perk: 'cloak', ability: 'Auto-cloak briefly avoids collisions', baseSpeed: 310, maxSpeed: 980, price: 700, rating: 165 },
    comet: { name: 'COMET', callsign: 'AFTERBURNER JET', color: '#ffb35c', sizeMul: 0.96, laneTime: 0.09, perk: 'score', ability: '25% extra flight score from gems', baseSpeed: 340, maxSpeed: 1080, price: 750, rating: 170 },
    tempest: { name: 'TEMPEST', callsign: 'STRIKE FIGHTER', color: '#ff777e', sizeMul: 1, laneTime: 0.1, perk: 'laser', ability: 'Auto-fires a laser every 12 seconds', baseSpeed: 300, maxSpeed: 960, price: 800, rating: 180 },
    wasp: { name: 'WASP', callsign: 'SCOUT HELICOPTER', color: '#d9ee75', sizeMul: 0.88, laneTime: 0.09, perk: 'drone', ability: 'Rescue drone attracts distant gems', baseSpeed: 250, maxSpeed: 820, price: 700, aircraft: 'helicopter', rating: 165 },
    atlas: { name: 'ATLAS', callsign: 'ARMORED HELICOPTER', color: '#7de0c2', sizeMul: 1.08, laneTime: 0.12, perk: 'shield', shieldHits: 3, ability: 'Heavy rotor armor · three starting shield hits', baseSpeed: 220, maxSpeed: 760, price: 800, aircraft: 'helicopter', rating: 190 },
    kestrel: { name: 'KESTREL', callsign: 'EVADE HELICOPTER', color: '#f5c2ff', sizeMul: 0.78, laneTime: 0.065, perk: 'precision', ability: 'Fast evasive handling · 50% larger near-miss bonus', baseSpeed: 290, maxSpeed: 900, price: 850, aircraft: 'helicopter', rating: 175 },
  };
  const POWERUP_TYPES = ['shield', 'magnet', 'slow', 'laser'];
  const POWERUP_INFO = {
    shield: { label: 'SHIELD', detail: 'Absorb a collision', color: '#8fd3ff', icon: '<path d="M12 2 20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/>' },
    magnet: { label: 'MAGNET', detail: 'Draw nearby gems in', color: '#ff8fd0', icon: '<path d="M6 4v8a6 6 0 0 0 12 0V4M6 4h4v4H6zM14 4h4v4h-4z"/>' },
    slow: { label: 'SLOW TIME', detail: 'Slow incoming hazards', color: '#c7a9ff', icon: '<path d="M6 3h12M6 21h12M7 3c0 8 10 10 10 18M17 3c0 8-10 10-10 18"/>' },
    laser: { label: 'LASER', detail: 'Fire at the next hazard', color: '#ff8f5c', icon: '<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>' },
  };
  const RUN_MODES = {
    classic: { name: 'SURVIVAL RUN', description: 'Endless arcade run. How long can you last?' },
    sprint: { name: 'TIME ATTACK', description: 'Survive for 60 seconds. Your score is your time-trial result.' },
    zen: { name: 'FREE FLIGHT', description: 'A no-crash practice run: no blocks, just collect gems and explore.' },
    campaign: { name: 'STORY CAMPAIGN', description: 'Five escalating runs per world; recover gems to break each guardian.' },
    war: { name: 'STARFRONT WAR', description: 'Fight through five star systems and recover the stolen Star Gems.' },
  };
  const SPRINT_DURATION = 60;

  /* Levels: thresholds, speed bases and visual themes */
  const LEVELS = [
    { at: 0,   name: 'NEON GRID',      art: 'neon-grid',      base: 300, bg: '#0a0a14', bgTop: 'rgba(38,24,72,0.28)',  bgBot: 'rgba(10,40,60,0.20)',  grid: 'rgba(120,90,220,0.10)',  stars: false },
    { at: 750, name: 'SUNSET CIRCUIT', art: 'sunset-circuit', base: 380, bg: '#150a16', bgTop: 'rgba(110,26,70,0.24)', bgBot: 'rgba(255,110,40,0.14)', grid: 'rgba(255,140,80,0.10)', stars: false },
    { at: 1500, name: 'DEEP SPACE',    art: 'deep-space',     base: 460, bg: '#050810', bgTop: 'rgba(14,18,54,0.22)',  bgBot: 'rgba(8,20,44,0.18)',   grid: 'rgba(90,120,255,0.07)', stars: true },
    { at: 2250, name: 'TOXIC CORE',    art: 'toxic-core',     base: 540, bg: '#061108', bgTop: 'rgba(8,52,28,0.24)',   bgBot: 'rgba(46,88,20,0.14)',  grid: 'rgba(120,255,140,0.09)', stars: false },
    { at: 3000, name: 'VOID RUN',      art: 'void-run',       base: 620, bg: '#020204', bgTop: 'rgba(255,255,255,0.09)', bgBot: 'rgba(0,0,0,0.05)',    grid: 'rgba(255,255,255,0.10)', stars: true },
  ];
  const worldImages = Object.fromEntries(LEVELS.map((level) => {
    const image = new Image();
    image.src = './assets/worlds/' + level.art + '.svg';
    return [level.art, image];
  }));
  const shipImages = Object.fromEntries(Object.keys(VEHICLES).map((id) => {
    const image = new Image();
    image.src = './assets/ships/' + id + '.svg';
    return [id, image];
  }));

  /* =====================================================
     Canvas & DOM
  ===================================================== */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hud = document.getElementById('hud');
  const scoreEl = document.getElementById('score');
  const bestLineEl = document.getElementById('best-line');
  const levelLineEl = document.getElementById('level-line');
  const gameoverScreen = document.getElementById('gameover-screen');
  const playBtn = document.getElementById('play-btn');
  const restartBtn = document.getElementById('restart-btn');
  const changeVehicleBtn = document.getElementById('change-vehicle-btn');
  const collectorReturnBtn = document.getElementById('collector-return-btn');
  const finalScoreEl = document.getElementById('final-score');
  const finalBestEl = document.getElementById('final-best');
  const finalLevelEl = document.getElementById('final-level');
  const newBestEl = document.getElementById('new-best');
  const muteBtn = document.getElementById('mute-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const pauseScreen = document.getElementById('pause-screen');
  const resumeBtn = document.getElementById('resume-btn');
  const pauseRestartBtn = document.getElementById('pause-restart-btn');
  const pauseVehicleBtn = document.getElementById('pause-vehicle-btn');
  const debugEl = document.getElementById('debug');
  const banner = document.getElementById('level-banner');
  const bannerEyebrow = document.getElementById('banner-eyebrow');
  const bannerName = document.getElementById('banner-name');
  const chipShield = document.getElementById('chip-shield');
  const chipMagnet = document.getElementById('chip-magnet');
  const chipSlow = document.getElementById('chip-slow');
  const chipLaser = document.getElementById('chip-laser');
  const chipCombo = document.getElementById('chip-combo');
  const comboVEl = document.getElementById('combo-v');
  const statGemsEl = document.getElementById('stat-gems');
  const statComboEl = document.getElementById('stat-combo');
  const statNmEl = document.getElementById('stat-nm');
  const statLaserEl = document.getElementById('stat-laser');
  const statRocketEl = document.getElementById('stat-rocket');
  const unlockNoticeEl = document.getElementById('unlock-notice');
  const gemsBankedEl = document.getElementById('gems-banked');
  const bestComboLineEl = document.getElementById('bestcombo-line');
  const gemBankLineEl = document.getElementById('gembank-line');
  const marketBtn = document.getElementById('market-btn');
  const homeScreen = document.getElementById('start-screen');
  const collectorScreen = document.getElementById('collector-screen');
  const marketScreen = document.getElementById('market-screen');
  const marketBankEl = document.getElementById('market-bank-n');
  const marketListEl = document.getElementById('market-list');
  const marketTabsEl = document.getElementById('market-tabs');
  const marketHeroShipEl = document.getElementById('market-hero-ship');
  const profileScreen = document.getElementById('profile-screen');
  const rewardsScreen = document.getElementById('rewards-screen');
  const guideScreen = document.getElementById('guide-screen');
  const campaignScreen = document.getElementById('campaign-screen');
  const campaignListEl = document.getElementById('campaign-list');
  const campaignIntroEl = document.getElementById('campaign-intro');
  const campaignTierLabelEl = document.getElementById('campaign-tier-label');
  const campaignTierTitleEl = document.getElementById('campaign-tier-title');
  const campaignTierArtEl = document.getElementById('campaign-tier-art');
  const campaignProgressLabelEl = document.getElementById('campaign-progress-label');
  const campaignProgressFillEl = document.getElementById('campaign-progress-fill');
  const campaignMapStatusEl = document.getElementById('campaign-map-status');
  const campaignOpenTierBtn = document.getElementById('campaign-open-tier-btn');
  const warMapScreen = document.getElementById('war-map-screen');
  const warScenariosEl = document.getElementById('war-scenarios');
  const warProgressEl = document.getElementById('war-progress');
  const warProgressFooterEl = document.getElementById('war-progress-footer');
  const warMapProgressFillEl = document.getElementById('war-map-progress-fill');
  const warMapIntroEl = document.getElementById('war-map-intro');
  const warOpenTierBtn = document.getElementById('war-open-tier-btn');
  const warResultScreen = document.getElementById('war-result-screen');
  const warResultEyebrowEl = document.getElementById('war-result-eyebrow');
  const warResultTitleEl = document.getElementById('war-result-title');
  const warResultCopyEl = document.getElementById('war-result-copy');
  const warResultGemsEl = document.getElementById('war-result-gems');
  const warBankRewardBtn = document.getElementById('war-bank-reward-btn');
  const warContinueBtn = document.getElementById('war-continue-btn');
  const warMapReturnBtn = document.getElementById('war-map-return-btn');
  const warMapBtn = document.getElementById('war-map-btn');
  const collectorBtn = document.getElementById('collector-btn');
  const campaignBtn = document.getElementById('campaign-btn');
  const warHudEl = document.getElementById('war-hud');
  const warLivesEl = document.getElementById('war-lives');
  const warMissionLabelEl = document.getElementById('war-mission-label');
  const warKillsLabelEl = document.getElementById('war-kills-label');
  const warPowerLabelEl = document.getElementById('war-power-label');
  const warBossHealthPanelEl = document.getElementById('war-boss-health-panel');
  const warBossNameEl = document.getElementById('war-boss-name');
  const warBossHealthEl = document.getElementById('war-boss-health');
  const warBossHealthValueEl = document.getElementById('war-boss-health-value');
  const warGemCountEl = document.getElementById('war-gems');
  const warResultCollectedEl = document.getElementById('war-result-collected');
  const warResultBankEl = document.getElementById('war-result-bank');
  const warResultScoreEl = document.getElementById('war-result-score');
  const warResultKillsEl = document.getElementById('war-result-kills');
  const warResultWavesEl = document.getElementById('war-result-waves');
  const warResultTimeEl = document.getElementById('war-result-time');
  const warResultLivesEl = document.getElementById('war-result-lives');
  const warTierStatsEl = document.getElementById('war-tier-stats');
  const warResultTierMissionsEl = document.getElementById('war-result-tier-missions');
  const warResultTierScoreEl = document.getElementById('war-result-tier-score');
  const warResultTierKillsEl = document.getElementById('war-result-tier-kills');
  const warResultTierGemsEl = document.getElementById('war-result-tier-gems');
  const warResultTierTimeEl = document.getElementById('war-result-tier-time');
  const warTierLabelEl = document.getElementById('war-tier-label');
  const campaignRunLabelEl = document.getElementById('campaign-run-label');
  const campaignRunProgressEl = document.getElementById('campaign-run-progress');
  const campaignRunIconEl = document.getElementById('campaign-run-icon');
  const campaignBoostBtn = document.getElementById('campaign-boost-btn');
  const collectorActiveFighterEl = document.getElementById('collector-active-fighter');
  const collectorActiveFighterNameEl = document.getElementById('collector-active-fighter-name');
  const collectorActiveFighterAbilityEl = document.getElementById('collector-active-fighter-ability');
  const collectorGemBalanceEl = document.getElementById('collector-gem-balance');
  const collectorBestComboEl = document.getElementById('collector-best-combo');
  const collectorComboRewardsEl = document.querySelector('.collector-combo-rewards');
  const collectorComboCardsEl = document.getElementById('collector-combo-cards');
  const homeShipEl = document.getElementById('home-ship');
  const homeShipNameEl = document.getElementById('home-ship-name');
  const homeShipAbilityEl = document.getElementById('home-ship-ability');
  const profileShortcutPortraitEl = document.getElementById('profile-shortcut-portrait');
  const profileTechnologyEl = document.getElementById('profile-technology');
  const profileSkinsEl = document.getElementById('profile-skins');
  const profilePowerupsEl = document.getElementById('profile-powerups');
  const profilePowerupControlsEl = document.getElementById('profile-powerup-controls');
  const manualPowerupsEl = document.getElementById('manual-powerups');
  const profileWarEl = document.getElementById('profile-war');
  const modeRecordsEl = document.getElementById('mode-records');
  const rewardsBtn = document.getElementById('rewards-btn');
  const homeRewardsBtn = document.getElementById('home-rewards-btn');
  const profileBtn = document.getElementById('profile-btn');
  const guideBtn = document.getElementById('guide-btn');
  const modeChoices = Array.from(document.querySelectorAll('.mode-choice'));
  const modeDescriptionEl = document.getElementById('mode-description');
  const dailyChallengeEl = document.getElementById('daily-challenge');
  const achievementListEl = document.getElementById('achievement-list');
  const runResultLabelEl = document.getElementById('run-result-label');
  const goalResultEl = document.getElementById('goal-result');
  const shieldHitsEl = document.getElementById('shield-hits');
  const magnetTEl = document.getElementById('magnet-t');
  const slowTEl = document.getElementById('slow-t');
  const rocketBtn = document.getElementById('rocket-btn');
  const abilityBtn = document.getElementById('ability-btn');
  const rocketAmmoEl = document.getElementById('rocket-ammo');
  const abilityTimerEl = document.getElementById('ability-timer');
  const bossHudEl = document.getElementById('boss-hud');
  const bossHealthEl = document.getElementById('boss-health');
  const dailyRewardEl = document.getElementById('daily-reward');
  const introScreen = document.getElementById('intro-screen');
  const introHomeBtn = document.getElementById('intro-home-btn');
  const profileAvatarEl = document.getElementById('profile-avatar');
  const profileNameInputEl = document.getElementById('profile-pilot-name');
  const profileRankEl = document.getElementById('profile-rank');
  const profileRatingEl = document.getElementById('profile-rating');
  const profileTotalScoreEl = document.getElementById('profile-total-score');
  const profileWarProgressEl = document.getElementById('profile-war-progress');
  const profileCampaignProgressEl = document.getElementById('profile-campaign-progress');
  const profileBestComboEl = document.getElementById('profile-best-combo');
  const profileShipPreviewEl = document.getElementById('profile-ship-preview');
  const profileShipNameEl = document.getElementById('profile-ship-name');
  const profileShipAbilityEl = document.getElementById('profile-ship-ability');
  const pilotNameFormEl = document.getElementById('pilot-name-form');
  const guideTabsEl = document.getElementById('guide-tabs');
  const guideHeroTitleEl = document.getElementById('guide-hero-title');
  const guideHeroCopyEl = document.getElementById('guide-hero-copy');
  const profilePilotsEl = document.getElementById('profile-pilots');
  const profileHistoryEl = document.getElementById('profile-history');
  const vehicleRowEl = document.getElementById('vehicle-row');
  let vehicleCards = [];

  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    onResizeHook();
  }
  // re-align player to its lane when the viewport changes size
  function onResizeHook() {
    try {
      if (state && state.mode !== 'menu') {
        if (state.runMode === 'war') {
          state.player.x = state.player.toX = clamp(state.player.x, 24, W - 24);
          state.player.y = state.player.toY = clamp(state.player.y, 64, H - 50);
        } else {
          state.player.x = state.player.fromX = state.player.toX = laneCenter(state.player.lane);
          state.player.t = 1;
        }
      }
    } catch (e) { /* state not ready yet */ }
  }
  window.addEventListener('resize', resize);
  resize();

  /* =====================================================
     Utilities
  ===================================================== */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const randInt = (n) => Math.floor(Math.random() * n);

  function laneCenter(i) { return (W / LANES) * (i + 0.5); }
  function laneWidth() { return W / LANES; }
  // cap entity sizes so wide desktop viewports stay playable
  function basePlayerSize() { return Math.min(laneWidth() * CFG.playerSize, 120); }
  function playerSize() { return basePlayerSize() * VEHICLES[state.vehicle].sizeMul; }
  function obstacleW() { return Math.min(laneWidth() * 0.86, 230); }
  function obstacleH() { return Math.min(laneWidth() * 0.62, 150); }
  function gemR() { return Math.min(laneWidth() * 0.15, 30); }
  function playerY() { return H - Math.max(110, H * 0.16); }

  /* =====================================================
     Audio (procedural — no external files)
  ===================================================== */
  const Sound = {
    ctx: null,
    master: null,
    muted: false,
    musicTimer: null,
    musicStep: 0,
    noiseBuffer: null,

    init() {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.4;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      } catch (e) { /* audio unavailable — game still playable */ }
    },
    blip(freq, dur, type, vol, slide) {
      if (!this.ctx || this.muted) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g).connect(this.master);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      } catch (e) { /* ignore */ }
    },
    move() { this.blip(320, 0.07, 'square', 0.10); },
    deny() { this.blip(220, 0.12, 'square', 0.10); this.blip(160, 0.14, 'square', 0.08); },
    pop() { this.blip(1200, 0.05, 'triangle', 0.12); this.blip(1650, 0.04, 'triangle', 0.08); },
    explosion() { this.blip(170, 0.18, 'sawtooth', 0.16, 58); this.blip(95, 0.25, 'triangle', 0.11, 40); },
    gem() { this.blip(880, 0.09, 'sine', 0.16); this.blip(1318, 0.12, 'sine', 0.14); },
    comboTier() { this.blip(660, 0.08, 'square', 0.12); this.blip(990, 0.12, 'square', 0.10); },
    nearMiss() { this.blip(1500, 0.06, 'sine', 0.14); this.blip(2000, 0.05, 'sine', 0.08); },
    laser() { this.blip(900, 0.28, 'sawtooth', 0.2, 130); this.blip(1800, 0.08, 'square', 0.07); },
    power() { this.blip(520, 0.1, 'triangle', 0.18); this.blip(780, 0.16, 'triangle', 0.15); },
    levelUp() { this.blip(440, 0.12, 'triangle', 0.15); this.blip(660, 0.14, 'triangle', 0.13); this.blip(880, 0.2, 'triangle', 0.12); },
    shieldBreak() { this.blip(200, 0.25, 'sawtooth', 0.2, 90); this.blip(1400, 0.08, 'square', 0.08); },
    crash() {
      if (!this.ctx || this.muted) return;
      try {
        const t = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.45, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.35);
        src.connect(filter).connect(g).connect(this.master);
        src.start(t);
        this.blip(110, 0.3, 'sawtooth', 0.22, 55);
      } catch (e) { /* ignore */ }
    },
    startMusic() {
      if (!this.ctx || this.musicTimer) return;
      const scale = [220, 261.63, 293.66, 349.23, 392, 440, 523.25];
      const pattern = [0, 4, 2, 5, 0, 6, 3, 4];
      const tick = () => {
        if (!this.ctx || this.muted) return;
        const note = scale[pattern[this.musicStep % pattern.length]];
        this.blip(note, 0.22, 'triangle', 0.045);
        if (this.musicStep % 4 === 0) this.blip(note / 2, 0.4, 'sine', 0.03);
        this.musicStep++;
      };
      this.musicTimer = setInterval(tick, 280);
    },
    stopMusic() {
      if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    },
    suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); },
    resumeAudio() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },
  };

  /* =====================================================
     Game state
  ===================================================== */
  const state = {
    mode: 'menu',           // menu | playing | gameover
    paused: false,
    runMode: 'classic',
    sprintComplete: false,
    dailyDay: todayKey(),
    dailyProgress: 0,
    dailyClaimed: false,
    lastDailyRewardDate: '',
    dailyStreak: 0,
    achievements: {},
    achievementClaims: {},
    marketCategory: 'Fighters',
    vehicle: 'dart',
    score: 0,
    best: 0,                // in-memory (sandbox blocks storage)
    records: { classic: 0, sprint: 0, zen: 0, campaign: 0, war: 0 },
    campaignUnlock: 0,
    campaignTier: 0,
    campaignWave: 0,
    campaignReplay: false,
    campaignGems: 0,
    selectedCampaign: 0,
    time: 0,
    speed: CFG.baseSpeed,
    levelIndex: 0,
    campaignStage: 0,
    boss: null,
    player: { lane: 1, x: 0, fromX: 0, toX: 0, t: 1 },
    obstacles: [],          // { lane, y, h }
    gems: [],               // { x, lane, y, phase }
    powerups: [],           // { lane, y, type, phase }
    manualPowerups: [],
    powerupAuto: { shield: true, magnet: true, slow: true, laser: true },
    stars: [],
    nextSpawnY: 0,
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    flash: 0,
    shield: false,
    shieldInvuln: 0,
    magnetT: 0,
    slowT: 0,
    slowRecoveryT: 0,
    falconPhaseT: 0,
    falconAbilityAvailable: false,
    mirageCloakT: 0,
    mirageCooldownT: 0,
    fighterAbilityT: 0,
    laserCharge: 0,
    laserFx: null,
    rocketAmmo: 0,
    rocketFx: null,
    combo: 0,
    nearMisses: 0,
    bestComboAll: 0,
    flightCount: 0,
    totalScore: 0,
    pilotName: '',
    totalGemsCollected: 0,
    totalNearMisses: 0,
    stats: { gems: 0, lasers: 0, rockets: 0, bestCombo: 0 },
    meterFrac: 0,
    meterRising: false,
    prevSpeed: 0,
    meterFx: [],
    tierFx: null,
    fxGlow: 0,
    fireworksQ: [],
    gemBank: 0,
    owned: {},
    technologyEnabled: {},
    warUnlockedMission: 0,
    warTier: 0,
    warTierStats: { tier: 0, missions: 0, score: 0, kills: 0, gems: 0, time: 0 },
    warMission: 0,
    warWave: 1,
    warWaveCount: 0,
    warWaveTransitionT: 0,
    warWaveGemDrops: 0,
    warLifeDropsIssued: 0,
    warPowerDropsIssued: 0,
    warKills: 0,
    warMissionGems: 0,
    warMissionReward: 0,
    warMissionBanked: false,
    warMissionCompleted: false,
    warTierJustCompleted: false,
    warLives: 4,
    warFireT: 0,
    warEnemies: [],
    warPlayerShots: [],
    warEnemyShots: [],
    warPickups: [],
    warBoss: null,
    warPower: { rapidT: 0, shield: false, spread: false },
    warInvulnT: 0,
    warCarryPowerups: false,
    warExiting: false,
    warTime: 0,
    warPointerDown: false,
    skin: 'classic',
    pilot: 'rookie',
    shieldHP: 0,
    texts: [],
    particles: [],
    campaignBoostT: 0,
    campaignBoostFactor: 0,
  };

  function theme() { return LEVELS[state.levelIndex]; }
  function isTechnologyActive(id) {
    return !!state.owned[id] && state.technologyEnabled[id] !== false;
  }

  function genStars() {
    state.stars = [];
    for (let i = 0; i < 46; i++) {
      state.stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: 0.8 + Math.random() * 1.6,
        v: 0.4 + Math.random() * 0.8,
      });
    }
  }

  function resetRun() {
    const v = VEHICLES[state.vehicle];
    state.score = (isTechnologyActive('tech-head') ? 100 : 0);
    state.best = state.records[state.runMode] || 0;
    state.sprintComplete = false;
    state.time = 0;
    state.levelIndex = state.runMode === 'campaign' ? state.selectedCampaign : getLevelIndex(state.score, LEVELS);
    state.campaignStage = state.runMode === 'campaign' ? state.selectedCampaign : 0;
    state.boss = null;
    state.campaignBoostT = 0;
    state.campaignBoostFactor = 0;
    state.speed = calculateVehicleSpeed(Math.max(0, state.score - (isTechnologyActive('tech-head') ? 100 : 0)), theme().base, v);
    state.player.lane = 1;
    state.player.x = laneCenter(1);
    state.player.fromX = state.player.x;
    state.player.toX = state.player.x;
    state.player.t = 1;
    state.obstacles.length = 0;
    state.gems.length = 0;
    state.powerups.length = 0;
    state.manualPowerups.length = 0;
    state.particles.length = 0;
    state.nextSpawnY = CFG.startDelay * CFG.baseSpeed; // grace distance before first row
    state.shake = 0;
    state.flash = 0;
    state.shield = v.perk === 'shield';
    state.shieldHP = state.shield ? (v.shieldHits || 1) + (state.owned['up-shield2'] ? 1 : 0) : 0;
    state.shieldInvuln = 0;
    state.magnetT = 0;
    state.slowT = 0;
    state.slowRecoveryT = 0;
    state.falconPhaseT = 0;
    state.falconAbilityAvailable = v.perk === 'phase';
    state.mirageCloakT = 0;
    state.mirageCooldownT = 18;
    state.fighterAbilityT = 12;
    state.laserCharge = 0;
    state.laserFx = null;
    state.rocketAmmo = v.rocketAmmo ? v.rocketAmmo + (state.owned['up-rocket-rack'] ? 3 : 0) : 0;
    state.rocketFx = null;
    state.combo = 0;
    state.nearMisses = 0;
    state.stats = { gems: 0, lasers: 0, rockets: 0, bestCombo: 0 };
    state.meterFrac = 0;
    state.meterRising = false;
    state.prevSpeed = 0;
    state.meterFx.length = 0;
    state.tierFx = null;
    state.fxGlow = 0;
    state.fireworksQ.length = 0;
    state.texts.length = 0;
    state.paused = false;
    state.warEnemies.length = 0;
    state.warPlayerShots.length = 0;
    state.warEnemyShots.length = 0;
    state.warPickups.length = 0;
    state.warBoss = null;
    genStars();
  }

  function startGame() {
    if (state.runMode === 'war') {
      openWarMap();
      return;
    }
    muteBtn.style.display = '';
    Sound.init();
    if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
    resetRun();
    goalResultEl.textContent = '';
    state.mode = 'playing';
    hud.classList.toggle('campaign-mode', state.runMode === 'campaign');
    homeScreen.classList.add('hidden');
    introScreen.classList.add('hidden');
    collectorScreen.classList.add('hidden');
    marketScreen.classList.add('hidden');
    rewardsScreen.classList.add('hidden');
    profileScreen.classList.add('hidden');
    guideScreen.classList.add('hidden');
    campaignScreen.classList.add('hidden');
    warMapScreen.classList.add('hidden');
    warResultScreen.classList.add('hidden');
    warHudEl.classList.remove('visible');
    muteBtn.style.display = '';
    pauseScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    hud.classList.add('visible');
    document.getElementById('powerups').classList.remove('dimmed');
    document.getElementById('comboline').classList.remove('dimmed');
    bossHudEl.classList.remove('visible');
    pauseBtn.style.opacity = '';
    pauseBtn.style.pointerEvents = '';
    updateHud();
    updatePowerHud();
    updateRocketButton();
    updateAbilityButton();
    Sound.startMusic();
  }

  function updateWarHud() {
    const mission = getWarMission(state.warMission);
    warMissionLabelEl.textContent = 'TIER ' + (mission.tier + 1) + ' · SYSTEM ' + (mission.scenarioIndex + 1) + ' · MISSION ' + mission.level +
      (mission.isBoss ? ' · BOSS' : '');
    const bossActive = !!state.warBoss;
    warMissionLabelEl.parentElement.classList.toggle('war-boss-active', bossActive);
    warKillsLabelEl.textContent = bossActive ? '' : 'WAVE ' + state.warWave + ' / ' + state.warWaveCount + ' · ' +
      (state.warWaveTransitionT > 0 ? 'HOSTILE WING INBOUND' : state.warEnemies.length + ' ALIEN SHIPS');
    warBossHealthPanelEl.classList.toggle('visible', bossActive);
    if (bossActive) {
      warBossNameEl.textContent = mission.boss;
      warBossHealthEl.style.width = (Math.max(0, Math.min(100, state.warBoss.hp / state.warBoss.maxHp * 100))) + '%';
      warBossHealthValueEl.textContent = Math.max(0, state.warBoss.hp) + ' / ' + state.warBoss.maxHp + ' HP';
      warBossHealthPanelEl.setAttribute('aria-label', mission.boss + ' health ' + state.warBoss.hp + ' of ' + state.warBoss.maxHp);
    }
    const lives = 4 + (state.owned['war-armor'] ? 1 : 0) + WAR_LIFE_DROPS_PER_MISSION;
    warLivesEl.innerHTML = Array.from({ length: state.warLives }, () => '<i aria-hidden="true">♥</i>').join('') +
      Array.from({ length: Math.max(0, lives - state.warLives) }, () => '<i class="lost" aria-hidden="true">♥</i>').join('');
    warLivesEl.setAttribute('aria-label', state.warLives + ' lives remaining');
    warGemCountEl.textContent = String(state.warMissionGems);
    const active = [];
    if (state.warPower.shield) active.push('<span class="war-power-shield"><i>⬡</i> SHIELD</span>');
    if (state.warPower.rapidT > 0) active.push('<span class="war-power-rapid"><i>ϟ</i> RAPID FIRE</span>');
    if (state.warPower.spread) active.push('<span class="war-power-spread"><i>✣</i> SPREAD</span>');
    const weapon = state.owned['war-cannon'] ? 'PULSE CANNON' : 'NEON BOLTS';
    warPowerLabelEl.innerHTML = 'WEAPON · ' + weapon + (active.length ? '<br>' + active.join('<br>') : '');
  }

  function openWarMap() {
    state.mode = 'menu';
    state.runMode = 'war';
    hud.classList.remove('campaign-mode');
    campaignBoostBtn.classList.remove('visible');
    renderWarMap();
    showPage(warMapScreen);
    hud.classList.remove('visible');
    warHudEl.classList.remove('visible');
    pauseBtn.style.opacity = '0';
    pauseBtn.style.pointerEvents = 'none';
    Sound.stopMusic();
  }

  function renderWarMap() {
    const tier = state.warTier;
    warTierLabelEl.textContent = 'TIER ' + (tier + 1);
    const tierStart = tier * WAR_TOTAL_MISSIONS;
    const localProgress = clamp(state.warUnlockedMission - tierStart, 0, WAR_TOTAL_MISSIONS);
    const nextTierUnlocked = state.warUnlockedMission >= tierStart + WAR_TOTAL_MISSIONS;
    warOpenTierBtn.classList.toggle('hidden', !nextTierUnlocked);
    if (nextTierUnlocked) warOpenTierBtn.textContent = 'OPEN TIER ' + (tier + 2) + ' · FREE';
    warProgressEl.textContent = 'TIER ' + (tier + 1) + ' · ' +
      (localProgress >= WAR_TOTAL_MISSIONS ? 'ALL MISSIONS CLEARED' : 'MISSION ' + (localProgress + 1) + ' / ' + WAR_TOTAL_MISSIONS);
    warProgressFooterEl.textContent = warProgressEl.textContent;
    warMapProgressFillEl.style.width = (localProgress / WAR_TOTAL_MISSIONS * 100) + '%';
    warMapIntroEl.textContent = nextTierUnlocked
      ? 'TIER ' + (tier + 1) + ' CLEARED. Your next tier is unlocked; open it when you are ready for a tougher warfront.'
      : 'TIER ' + (tier + 1) + ': six missions in each of five systems. Enemy wings grow stronger wave by wave; defeat the Star Eater to unlock the next tier.';
    warScenariosEl.innerHTML = WAR_SCENARIOS.map((scenario, scenarioIndex) => {
      const missions = Array.from({ length: WAR_LEVELS_PER_SCENARIO }, (_, levelIndex) => {
        const missionIndex = tierStart + scenarioIndex * WAR_LEVELS_PER_SCENARIO + levelIndex;
        const unlocked = isWarMissionUnlocked(missionIndex, state.warUnlockedMission);
        const cleared = missionIndex < state.warUnlockedMission;
        return '<button class="war-mission' + (cleared ? ' cleared' : unlocked ? ' available' : '') +
          (levelIndex === WAR_LEVELS_PER_SCENARIO - 1 ? ' boss-mission' : '') +
          '" data-war-mission="' + missionIndex + '" aria-label="' +
          (levelIndex === WAR_LEVELS_PER_SCENARIO - 1 ? 'Boss mission ' : 'Mission ') + (levelIndex + 1) +
          (cleared ? ', cleared' : unlocked ? ', available' : ', locked') + '"' + (unlocked ? '' : ' disabled') + '>' +
          (cleared ? '✓' : levelIndex + 1 === WAR_LEVELS_PER_SCENARIO ? '★' : levelIndex + 1) + '</button>';
      }).join('');
      const scenarioProgress = clamp(localProgress - scenarioIndex * WAR_LEVELS_PER_SCENARIO, 0, WAR_LEVELS_PER_SCENARIO);
      return '<section class="war-scenario-card" style="--world-accent:' + scenario.accent +
        ';--world-tint:' + scenario.tint + ';--world-border:' + scenario.accent + '38">' +
        '<div class="war-scenario-art"><img src="./assets/worlds/' + scenario.art + '.svg" alt="" /><span aria-hidden="true">✦</span></div>' +
        '<div class="war-scenario-copy"><strong>' + scenario.name +
        '</strong><small>' + scenario.boss + '</small><small class="war-scenario-progress">' +
        scenarioProgress + ' / ' + WAR_LEVELS_PER_SCENARIO + ' MISSIONS · ' +
        (scenarioProgress >= WAR_LEVELS_PER_SCENARIO ? 'CLEARED' : scenarioProgress ? 'IN PROGRESS' : 'AWAITING DEPLOYMENT') +
        '</small></div><div class="war-scenario-missions">' + missions + '</div></section>';
    }).join('');
  }

  function startWarWave(wave) {
    const mission = getWarMission(state.warMission);
    state.warWave = wave;
    state.warWaveTransitionT = 0;
    state.warWaveGemDrops = 0;
    state.warPlayerShots.length = 0;
    state.warEnemyShots.length = 0;
    state.warEnemies = [];
    state.warBoss = null;
    if (isWarBossWave(mission, wave, state.warWaveCount)) {
      const hp = getWarBossHealth(state.warMission) + wave * 4;
      state.warBoss = { hp, maxHp: hp, attackT: 1.7, flash: 0, phase: 0, attackPhase: 0 };
      showBanner('WAVE ' + wave + ' / ' + state.warWaveCount, mission.boss + ' · ' + state.warBoss.hp + ' HP');
    } else {
      state.warEnemies = buildEnemyFormation(state.warMission, W, H, wave - 1);
      showBanner('WAVE ' + wave + ' / ' + state.warWaveCount, mission.name + ' · HOSTILE WING');
    }
    updateWarHud();
  }

  function advanceWarWave() {
    if (state.warWave >= state.warWaveCount) {
      finishWarMission();
      return;
    }
    state.warWaveTransitionT = 0.9;
    state.warPlayerShots.length = 0;
    state.warEnemyShots.length = 0;
    state.warEnemies.length = 0;
    updateWarHud();
  }

  function startWarMission(missionIndex, carryPowerups = false) {
    if (!isWarMissionUnlocked(missionIndex, state.warUnlockedMission)) return;
    state.runMode = 'war';
    state.warMission = missionIndex;
    state.warMissionCompleted = false;
    state.warMissionBanked = false;
    state.warMissionReward = 0;
    state.warTierJustCompleted = false;
    if (!carryPowerups) state.warPower = { rapidT: 0, shield: !!state.owned['war-armor'], spread: false };
    state.warMissionGems = 0;
    state.warLifeDropsIssued = 0;
    state.warPowerDropsIssued = 0;
    state.warKills = 0;
    state.warLives = 4 + (state.owned['war-armor'] ? 1 : 0);
    state.warExiting = false;
    state.warWaveTransitionT = 0;
    state.warWaveCount = getWarWaveCount(getWarMission(missionIndex).level);
    state.warFireT = 0;
    state.warTime = 0;
    state.warInvulnT = 0;
    resetRun();
    state.player.x = W / 2;
    state.player.toX = W / 2;
    state.player.y = H * 0.8;
    state.player.toY = H * 0.8;
    const mission = getWarMission(missionIndex);
    startWarWave(1);
    goalResultEl.textContent = '';
    state.mode = 'playing';
    state.paused = false;
    hud.classList.remove('campaign-mode');
    campaignBoostBtn.classList.remove('visible');
    for (const page of [homeScreen, introScreen, marketScreen, rewardsScreen, profileScreen, guideScreen,
      collectorScreen, campaignScreen, warMapScreen, warResultScreen, pauseScreen, gameoverScreen]) page.classList.add('hidden');
    hud.classList.remove('visible');
    warHudEl.classList.add('visible');
    muteBtn.style.display = '';
    document.getElementById('powerups').classList.add('dimmed');
    document.getElementById('comboline').classList.add('dimmed');
    pauseBtn.style.opacity = '';
    pauseBtn.style.pointerEvents = '';
    updateWarHud();
    Sound.init();
    Sound.resumeAudio();
    Sound.startMusic();
    showBanner('SYSTEM ' + (mission.scenarioIndex + 1) + ' · MISSION ' + mission.level + ' · TIER ' + (mission.tier + 1),
      'WAVE 1 / ' + state.warWaveCount + ' · ' + mission.name);
  }

  function finishWarMission() {
    if (state.warMissionCompleted) return;
    const mission = getWarMission(state.warMission);
    const reward = getWarMissionReward(state.warMission, state.warMissionGems);
    const firstClear = state.warMission >= state.warUnlockedMission;
    if (state.warTierStats.tier !== mission.tier) {
      state.warTierStats = { tier: mission.tier, missions: 0, score: 0, kills: 0, gems: 0, time: 0 };
    }
    state.totalScore += Math.max(0, Math.floor(state.score));
    state.stats.gems = state.warMissionGems;
    state.flightCount++;
    state.totalGemsCollected += state.warMissionGems;
    updateDailyChallenge();
    state.records.war = Math.max(state.records.war, Math.floor(state.score));
    state.best = state.records.war;
    if (firstClear) {
      state.warTierStats.missions++;
      state.warTierStats.score += Math.max(0, Math.floor(state.score));
      state.warTierStats.kills += state.warKills;
      state.warTierStats.gems += state.warMissionGems;
      state.warTierStats.time += state.warTime;
    }
    state.warUnlockedMission = Math.max(state.warUnlockedMission, state.warMission + 1);
    state.warTierJustCompleted = firstClear &&
      state.warUnlockedMission % WAR_TOTAL_MISSIONS === 0;
    state.warCarryPowerups = !mission.isBoss;
    state.warMissionReward = reward;
    state.warMissionCompleted = true;
    state.warMissionBanked = false;
    state.warPlayerShots.length = 0;
    state.warEnemyShots.length = 0;
    state.warPickups.length = 0;
    bankWarMissionReward();
    renderWarMap();
    Sound.stopMusic();
    Sound.levelUp();
    state.warExiting = true;
    state.player.toY = -100;
  }

  function bankWarMissionReward() {
    if (!state.warMissionCompleted || state.warMissionBanked) return false;
    state.gemBank += state.warMissionReward;
    state.warMissionBanked = true;
    updateGemBankDisplay(true);
    warResultBankEl.textContent = String(state.gemBank);
    savePersistent();
    return true;
  }

  function bankAbandonedWarGems() {
    if (state.runMode !== 'war' || state.warMissionCompleted || state.warMissionGems <= 0) return 0;
    const gems = state.warMissionGems;
    state.gemBank += gems;
    state.totalGemsCollected += gems;
    state.warMissionGems = 0;
    state.stats.gems = 0;
    updateGemBankDisplay(true);
    savePersistent();
    return gems;
  }

  function formatWarTime(seconds) {
    const wholeSeconds = Math.floor(Math.max(0, seconds));
    return Math.floor(wholeSeconds / 60) + ':' + String(wholeSeconds % 60).padStart(2, '0');
  }

  function showWarMissionResult() {
    const mission = getWarMission(state.warMission);
    state.mode = 'war-transition';
    state.paused = false;
    const tierComplete = state.warTierJustCompleted;
    warResultScreen.classList.toggle('tier-complete', tierComplete);
    warResultEyebrowEl.textContent = mission.name + ' · ' +
      (mission.isBoss ? 'SUPREME MONSTER DEFEATED' : 'MISSION CLEAR');
    warResultTitleEl.textContent = tierComplete ? 'TIER ' + (mission.tier + 1) + ' CONQUERED!' : mission.isBoss ? 'FRONTIER LIBERATED' : 'FORMATION DESTROYED';
    warResultCopyEl.textContent = mission.isBoss
      ? tierComplete
        ? mission.boss + ' has fallen. You conquered all 30 missions of Tier ' + (mission.tier + 1) + '! Your full mission reward is banked; choose when to open the next tier from the Warfront Map.'
        : mission.boss + ' has fallen. The next system is open. Continue straight to carry your power-ups, or return to the Warfront Map to choose another mission.'
      : 'Enemy wing neutralized after ' + state.warWaveCount + ' escalating waves. Continue to carry your power-ups into the next mission, or return to the Warfront Map.';
    warResultGemsEl.textContent = state.warMissionReward;
    warResultCollectedEl.textContent = String(state.warMissionGems);
    warResultBankEl.textContent = String(state.gemBank);
    warResultScoreEl.textContent = String(Math.floor(state.score));
    warResultKillsEl.textContent = String(state.warKills);
    warResultWavesEl.textContent = String(state.warWaveCount);
    warResultTimeEl.textContent = formatWarTime(state.warTime);
    warResultLivesEl.textContent = String(state.warLives);
    warTierStatsEl.classList.toggle('hidden', !tierComplete);
    if (tierComplete) {
      warResultTierMissionsEl.textContent = state.warTierStats.missions + ' / ' + WAR_TOTAL_MISSIONS;
      warResultTierScoreEl.textContent = String(state.warTierStats.score);
      warResultTierKillsEl.textContent = String(state.warTierStats.kills);
      warResultTierGemsEl.textContent = String(state.warTierStats.gems);
      warResultTierTimeEl.textContent = formatWarTime(state.warTierStats.time);
    }
    warBankRewardBtn.textContent = 'BANK REWARD · ' + state.warMissionReward + ' GEMS';
    warBankRewardBtn.disabled = false;
    warContinueBtn.textContent = 'NEXT MISSION';
    warContinueBtn.classList.toggle('hidden', tierComplete);
    warMapReturnBtn.textContent = tierComplete ? 'CHOOSE NEXT TIER' : 'WARFRONT MAP';
    warHudEl.classList.remove('visible');
    pauseBtn.style.opacity = '0';
    pauseBtn.style.pointerEvents = 'none';
    showPage(warResultScreen);
  }

  function openCampaigns() {
    renderCampaigns();
    showPage(campaignScreen);
  }

  function getCampaignTierProgress() {
    return clamp(
      state.campaignUnlock - state.campaignTier * CAMPAIGN_STAGES_PER_TIER,
      0,
      CAMPAIGN_STAGES_PER_TIER,
    );
  }

  function getActiveCampaignPosition() {
    const progress = getCampaignTierProgress();
    return progress === CAMPAIGN_STAGES_PER_TIER
      ? { tier: state.campaignTier, world: LEVELS.length, wave: 0 }
      : { ...getCampaignPosition(progress), tier: state.campaignTier };
  }

  function renderCampaigns() {
    const position = getActiveCampaignPosition();
    const tierUnlocked = isCampaignTierUnlocked(state.campaignUnlock, state.campaignTier);
    const nextWorld = LEVELS[Math.min(position.world, LEVELS.length - 1)];
    const progress = getCampaignTierProgress();
    campaignTierArtEl.src = './assets/worlds/' + nextWorld.art + '.svg';
    campaignTierArtEl.alt = '';
    campaignTierLabelEl.textContent = 'TIER ' + (state.campaignTier + 1) + ' · ' +
      (progress === CAMPAIGN_STAGES_PER_TIER ? 'FRONTIER CONQUERED' :
        state.campaignTier === 0 ? 'THE FIRST FRONTIER' : 'FRONTIER ' + (state.campaignTier + 1));
    campaignTierTitleEl.textContent = progress === CAMPAIGN_STAGES_PER_TIER
      ? 'A NEW FRONTIER IS YOURS' : nextWorld.name;
    campaignIntroEl.textContent = progress === CAMPAIGN_STAGES_PER_TIER
      ? 'All five worlds are clear. Open the next tier whenever you are ready for a tougher campaign.'
      : 'Recover Star Gems, weaken each guardian, and clear five runs in every world. Your next tier waits until you choose to open it.';
    campaignProgressLabelEl.textContent = progress + ' / ' + CAMPAIGN_STAGES_PER_TIER + ' RUNS';
    campaignProgressFillEl.style.width = (progress / CAMPAIGN_STAGES_PER_TIER * 100) + '%';
    campaignOpenTierBtn.classList.toggle('hidden', !tierUnlocked);
    if (tierUnlocked) campaignOpenTierBtn.textContent = 'OPEN TIER ' + (state.campaignTier + 2) + ' · FREE';
    campaignMapStatusEl.textContent = progress === CAMPAIGN_STAGES_PER_TIER
      ? 'TIER CLEARED · OPEN NEXT TIER WHEN READY'
      : 'RUN ' + (progress + 1) + ' / ' + CAMPAIGN_STAGES_PER_TIER;
    campaignListEl.innerHTML = LEVELS.map((level, index) => {
      const open = index <= position.world;
      const status = index < position.world ? 'CLEARED' : open ? 'AVAILABLE' : 'LOCKED';
      const progress = index < position.world ? '5 / 5 RUNS'
        : index === position.world ? position.wave + ' / 5 RUNS' : 'LOCKED';
      const difficulty = ['Rookie', 'Pilot', 'Ace', 'Veteran', 'Elite'][index];
      return '<button class="campaign-card' + (open ? ' campaign-open' : ' campaign-locked') +
        (index === position.world && !tierUnlocked ? ' campaign-current' : '') +
        '" data-campaign="' + index + '" style="--world-accent:' +
        ['#62e8d0', '#ff956f', '#8fa8ff', '#adf06f', '#e0a3ff'][index] + ';--world-tint:' +
        ['rgba(32,116,113,.25)', 'rgba(139,57,48,.25)', 'rgba(55,65,147,.25)', 'rgba(50,104,48,.25)', 'rgba(102,42,132,.25)'][index] +
        ';--world-art:url(/assets/worlds/' + level.art + '.svg)" ' + (open ? '' : 'disabled') +
        '><span class="campaign-card-art"><img src="./assets/worlds/' + level.art + '.svg" alt="" /><span class="campaign-mark">' +
        (index < position.world ? '✓' : '✦') + '</span></span><span class="campaign-card-copy"><strong>' + level.name +
        '</strong><small>' + difficulty + ' · ' + progress + '</small><small class="campaign-card-target">' +
        (index < position.world ? 'ALL FIVE RUNS CLEARED' : open
          ? getCampaignRunRequirement(state.campaignTier, index, position.wave) + ' PTS TO GUARDIAN'
          : 'CLEAR THE PREVIOUS WORLD TO OPEN') +
        '</small></span><b class="campaign-status">' + status + '</b></button>';
    }).join('');
  }

  function takeWarHit(x, y) {
    if (state.warInvulnT > 0) return false;
    if (state.warPower.shield) state.warPower.shield = false;
    else state.warLives--;
    state.warInvulnT = 1.1;
    emitBurst(x, y, '#ff7885', 18, 260);
    updateWarHud();
    return state.warLives <= 0;
  }

  function setPaused(p) {
    if (state.mode !== 'playing' || state.paused === p) return;
    state.paused = p;
    pauseScreen.classList.toggle('hidden', !p);
    document.getElementById('powerups').classList.toggle('dimmed', p);
    document.getElementById('comboline').classList.toggle('dimmed', p);
    pauseBtn.style.opacity = p ? '0' : '';
    pauseBtn.style.pointerEvents = p ? 'none' : '';
    updateRocketButton();
    updateAbilityButton();
    updateManualPowerups();
    banner.style.animationPlayState = p ? 'paused' : '';
    if (p) {
      Sound.stopMusic();
      Sound.suspend();
    } else {
      Sound.resumeAudio();
      Sound.startMusic();
    }
  }

  function gameOver(completed) {
    if (state.runMode === 'war') state.stats.gems = state.warMissionGems;
    state.mode = 'gameover';
    state.paused = false;
    state.sprintComplete = completed === true;
    pauseScreen.classList.add('hidden');
    warHudEl.classList.remove('visible');
    campaignBoostBtn.classList.remove('visible');
    pauseBtn.style.opacity = '0';
    pauseBtn.style.pointerEvents = 'none';
    updateManualPowerups();
    state.shake = completed ? 0 : 14;
    state.flash = completed ? 0 : 1;
    state.magnetT = 0;
    state.slowT = 0;
    state.slowRecoveryT = 0;
    state.falconPhaseT = 0;
    state.mirageCloakT = 0;
    state.shield = false;
    state.shieldInvuln = 0;
    state.laserCharge = 0;
    state.laserFx = null;
    state.combo = 0;
    state.boss = null;
    bossHudEl.classList.remove('visible');
    updatePowerHud();
    if (completed) Sound.levelUp();
    else Sound.crash();
    Sound.stopMusic();
    if (!completed) emitCrashParticles();
    state.totalScore += Math.max(0, Math.floor(state.score));
    const isBest = state.score > state.records[state.runMode];
    if (isBest) state.records[state.runMode] = Math.floor(state.score);
    state.best = state.records[state.runMode];
    if (state.runMode === 'campaign' && !completed) {
      state.stats.gems += state.campaignGems;
      state.campaignGems = 0;
    }
    runResultLabelEl.textContent = state.sprintComplete
      ? state.runMode === 'campaign' ? state.selectedCampaign === LEVELS.length - 1 ? 'THE STAR EATER DEFEATED' : 'CAMPAIGN CLEARED' : 'TIME ATTACK COMPLETE'
      : state.runMode === 'war' ? 'GAME OVER · WING LOST'
      : state.runMode === 'zen' ? 'FREE FLIGHT ENDED' : 'CRASHED';
    restartBtn.textContent = state.runMode === 'war' ? 'RETRY SORTIE' : 'PLAY AGAIN';
    changeVehicleBtn.textContent = state.runMode === 'war' ? 'WARFRONT MAP'
      : state.runMode === 'campaign' ? 'CAMPAIGN PAGE' : 'HOME';
    collectorReturnBtn.classList.toggle('hidden', !['classic', 'sprint', 'zen'].includes(state.runMode));
    runResultLabelEl.style.color = state.sprintComplete ? 'var(--color-primary)' : 'var(--color-danger)';
    finalScoreEl.textContent = Math.floor(state.score);
    finalBestEl.textContent = RUN_MODES[state.runMode].name + ' best ' + state.best;
    finalLevelEl.textContent = state.runMode === 'war'
      ? 'Tier ' + (getWarMission(state.warMission).tier + 1) + ' · System ' + (getWarMission(state.warMission).scenarioIndex + 1) + ' · Mission ' + getWarMission(state.warMission).level
      : state.runMode === 'campaign'
        ? 'Tier ' + (state.campaignTier + 1) + ' · Run ' + (state.campaignWave + 1) + ' · ' + theme().name
        : 'Level ' + (state.levelIndex + 1) + ' \u00b7 ' + theme().name;
    newBestEl.classList.toggle('show', isBest && state.score > 0);
    bestLineEl.textContent = 'Best ' + state.best;
    // run stats + all-time records + unlocks
    statGemsEl.textContent = state.stats.gems;
    statComboEl.textContent = state.stats.bestCombo;
    statNmEl.textContent = state.nearMisses;
    statLaserEl.textContent = state.stats.lasers;
    statRocketEl.textContent = state.stats.rockets;
    state.flightCount++;
    state.totalGemsCollected += state.stats.gems;
    state.totalNearMisses += state.nearMisses;
    const beforeUnlocks = unlockedVehicles();
    state.bestComboAll = Math.max(state.bestComboAll, state.stats.bestCombo);
    const newly = unlockedVehicles().filter((k) => beforeUnlocks.indexOf(k) < 0);
    unlockNoticeEl.classList.toggle('hidden', newly.length === 0);
    if (newly.length) {
      unlockNoticeEl.textContent = 'Vehicle unlocked: ' + newly.map((k) => k.toUpperCase()).join(' \u00b7 ');
      Sound.levelUp();
    }
    const goals = updateDailyChallenge();
    state.gemBank += state.stats.gems;
    updateGemBankDisplay(state.stats.gems > 0);
    if (state.runMode === 'war') state.warMissionGems = 0;
    goalResultEl.textContent = (goals.ready ? 'Daily reward ready to claim.' : '') +
      (goals.unlocked ? (goals.ready ? ' · ' : '') + 'Achievement reward ready to claim.' : '');
    refreshVehicleLocks();
    updateBestComboLine();
    savePersistent();
    const banked = state.stats.gems;
    gemsBankedEl.textContent = banked > 0 ? '+' + banked + ' gems banked' : '';
    gemsBankedEl.classList.toggle('hidden', banked === 0);
    updateRocketButton();
    updateAbilityButton();
    setTimeout(() => gameoverScreen.classList.remove('hidden'), 550);
  }

  function returnHome() {
    if (state.runMode === 'war' && !state.warMissionCompleted) bankAbandonedWarGems();
    state.mode = 'menu';
    state.paused = false;
    Sound.stopMusic();
    campaignBoostBtn.classList.remove('visible');
    hud.classList.remove('campaign-mode');
    pauseScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    document.getElementById('powerups').classList.remove('dimmed');
    document.getElementById('comboline').classList.remove('dimmed');
    if (state.runMode === 'war') {
      openWarMap();
      return;
    }
    if (state.runMode === 'campaign') {
      restartBtn.textContent = 'PLAY AGAIN';
      changeVehicleBtn.textContent = 'CAMPAIGN PAGE';
      hud.classList.remove('visible');
      pauseBtn.style.opacity = '0';
      pauseBtn.style.pointerEvents = 'none';
      openCampaigns();
      return;
    }
    restartBtn.textContent = 'PLAY AGAIN';
    changeVehicleBtn.textContent = 'HOME';
    showPage(homeScreen);
    hud.classList.remove('visible');
    pauseBtn.style.opacity = '0';
    pauseBtn.style.pointerEvents = 'none';
    updateRocketButton();
    updateAbilityButton();
    refreshVehicleLocks();
    updateBestComboLine();
    renderVehicleCards();
    updateHomeShip();
    renderMarket();
  }

  function showPage(activePage) {
    for (const page of [introScreen, homeScreen, collectorScreen, marketScreen, profileScreen, rewardsScreen, guideScreen,
      campaignScreen, warMapScreen, warResultScreen]) {
      page.classList.toggle('hidden', page !== activePage);
    }
  }

  function finishIntro() {
    showPage(homeScreen);
  }

  function openCollectorMode() {
    if (!['classic', 'sprint', 'zen'].includes(state.runMode)) state.runMode = 'classic';
    state.best = state.records[state.runMode] || 0;
    playBtn.textContent = 'START FLIGHT';
    modeChoices.forEach((choice) => {
      const selected = choice.dataset.mode === state.runMode;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    modeDescriptionEl.textContent = RUN_MODES[state.runMode].description;
    updateHomeShip();
    updateBestComboLine();
    updateGemBankDisplay();
    showPage(collectorScreen);
  }

  function activateCampaignBoost() {
    if (state.mode !== 'playing' || state.runMode !== 'campaign' ||
      state.campaignBoostT > 0 || state.campaignBoostFactor > 0.05) return;
    state.campaignBoostT = 3;
    Sound.power();
    updateCampaignBoostButton();
  }

  function updateCampaignBoostButton() {
    const active = state.campaignBoostT > 0;
    const recovering = !active && state.campaignBoostFactor > 0.05;
    campaignBoostBtn.disabled = active || recovering;
    campaignBoostBtn.textContent = active ? '⚡ BOOSTING'
      : recovering ? '↻ CHARGING' : '⚡ BOOST';
  }

  function returnToCollector() {
    state.mode = 'menu';
    state.paused = false;
    gameoverScreen.classList.add('hidden');
    hud.classList.remove('visible');
    warHudEl.classList.remove('visible');
    pauseBtn.style.opacity = '0';
    pauseBtn.style.pointerEvents = 'none';
    openCollectorMode();
  }

  function restartCurrentRun() {
    if (state.runMode === 'war') {
      startWarMission(state.warMission);
      return;
    }
    if (state.runMode === 'campaign') {
      state.campaignGems = 0;
      const position = getActiveCampaignPosition();
      if (!state.campaignReplay) state.campaignWave = position.wave;
    }
    startGame();
  }

  function openMarket() {
    Sound.init();
    renderMarket();
    showPage(marketScreen);
  }

  marketBtn.addEventListener('click', openMarket);
  const openRewards = () => { renderGoals(); showPage(rewardsScreen); };
  rewardsBtn.addEventListener('click', openRewards);
  homeRewardsBtn.addEventListener('click', openRewards);
  profileBtn.addEventListener('click', () => { renderProfile(); showPage(profileScreen); });
  guideBtn.addEventListener('click', () => showPage(guideScreen));
  collectorBtn.addEventListener('click', openCollectorMode);
  document.getElementById('collector-hangar-btn').addEventListener('click', () => {
    renderProfile();
    showPage(profileScreen);
  });
  introHomeBtn.addEventListener('click', finishIntro);
  campaignBoostBtn.addEventListener('click', activateCampaignBoost);
  campaignBoostBtn.addEventListener('pointerdown', (event) => event.stopPropagation());
  campaignBtn.addEventListener('click', () => {
    state.runMode = 'campaign';
    openCampaigns();
  });
  warMapBtn.addEventListener('click', openWarMap);
  warScenariosEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-war-mission]');
    if (!button || button.disabled) return;
    state.warCarryPowerups = false;
    startWarMission(Number(button.dataset.warMission));
  });
  warContinueBtn.addEventListener('click', () => {
    bankWarMissionReward();
    startWarMission(state.warMission + 1, state.warCarryPowerups);
  });
  warBankRewardBtn.addEventListener('click', () => {
    bankWarMissionReward();
    warBankRewardBtn.textContent = 'REWARD BANKED ✓';
    warBankRewardBtn.disabled = true;
    warResultBankEl.textContent = String(state.gemBank);
  });
  warMapReturnBtn.addEventListener('click', () => {
    bankWarMissionReward();
    openWarMap();
  });
  warOpenTierBtn.addEventListener('click', () => {
    const nextTier = state.warTier + 1;
    if (state.warUnlockedMission < nextTier * WAR_TOTAL_MISSIONS) return;
    state.warTier = nextTier;
    state.warTierStats = { tier: nextTier, missions: 0, score: 0, kills: 0, gems: 0, time: 0 };
    savePersistent();
    renderWarMap();
  });
  campaignOpenTierBtn.addEventListener('click', () => {
    if (!isCampaignTierUnlocked(state.campaignUnlock, state.campaignTier)) return;
    state.campaignTier++;
    state.campaignWave = 0;
    state.campaignReplay = false;
    savePersistent();
    renderCampaigns();
  });
  campaignListEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-campaign]');
    if (!button || button.disabled) return;
    state.selectedCampaign = Number(button.dataset.campaign);
    const position = getActiveCampaignPosition();
    state.campaignReplay = state.selectedCampaign < position.world;
    state.campaignWave = state.campaignReplay ? 0 : position.wave;
    state.campaignGems = 0;
    state.runMode = 'campaign';
    startGame();
  });
  document.querySelectorAll('[data-collector]').forEach((button) => button.addEventListener('click', openCollectorMode));
  document.querySelectorAll('[data-home]').forEach((button) => button.addEventListener('click', () => {
    if (state.mode === 'menu') {
      if (state.runMode === 'war') {
        state.runMode = 'classic';
        state.best = state.records.classic;
        modeChoices.forEach((choice) => {
          const selected = choice.dataset.mode === state.runMode;
          choice.classList.toggle('selected', selected);
          choice.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        modeDescriptionEl.textContent = RUN_MODES.classic.description;
        playBtn.textContent = 'START FLIGHT';
        updateHud();
      }
      showPage(homeScreen);
    }
    else returnHome();
  }));
  modeChoices.forEach((button) => {
    button.addEventListener('click', () => {
      state.runMode = button.dataset.mode;
      state.best = state.records[state.runMode];
      modeChoices.forEach((choice) => {
        const selected = choice === button;
        choice.classList.toggle('selected', selected);
        choice.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      modeDescriptionEl.textContent = RUN_MODES[state.runMode].description;
      playBtn.textContent = state.runMode === 'campaign' ? 'CHOOSE CAMPAIGN' : 'START FLIGHT';
      updateHud();
      savePersistent();
      Sound.init();
      Sound.move();
    });
  });
  marketTabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-category]');
    if (!tab) return;
    state.marketCategory = tab.dataset.category;
    renderMarket();
  });
  marketListEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.buy) buyItem(b.dataset.buy);
    else if (b.dataset.equip) equipSkin(b.dataset.equip);
    else if (b.dataset.equipPilot) equipPilot(b.dataset.equipPilot);
    else if (b.dataset.equipStyle) equipStyle(b.dataset.equipStyle);
    else if (b.dataset.equipVehicle) equipVehicle(b.dataset.equipVehicle);
    else if (b.dataset.vehicle) equipVehicle(b.dataset.vehicle);
  });
  guideTabsEl.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-guide-tab]');
    if (!tab) return;
    const topic = tab.dataset.guideTab;
    if (!GUIDE_TOPICS[topic]) return;
    guideTabsEl.querySelectorAll('[data-guide-tab]').forEach((choice) => {
      const selected = choice === tab;
      choice.classList.toggle('selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    });
    guideHeroTitleEl.textContent = GUIDE_TOPICS[topic].title;
    guideHeroCopyEl.textContent = GUIDE_TOPICS[topic].copy;
    guideScreen.querySelectorAll('[data-guide-topic]').forEach((card) => {
      card.hidden = card.dataset.guideTopic !== topic;
    });
    guideScreen.querySelector('.guide-scroll').scrollTop = 0;
  });
  profileTechnologyEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tech]');
    if (!button || !state.owned[button.dataset.tech]) return;
    state.technologyEnabled[button.dataset.tech] = !isTechnologyActive(button.dataset.tech);
    savePersistent();
    renderProfile();
  });
  profilePilotsEl.addEventListener('click', (event) => {
    const equipButton = event.target.closest('[data-equip-pilot]');
    if (equipButton) {
      equipPilot(equipButton.dataset.equipPilot);
      return;
    }
    if (event.target.closest('[data-pilot-shop]')) {
      state.marketCategory = 'Pilots';
      openMarket();
    }
  });

  function equipPilot(id) {
    if (!PILOTS[id] || (!PILOTS[id].free && !state.owned['pilot-' + id])) return;
    state.owned['pilot-' + id] = true;
    state.pilot = id;
    savePersistent();
    renderProfile();
    renderMarket();
    Sound.move();
  }

  function updateHud() {
    scoreEl.textContent = Math.floor(state.score);
    bestLineEl.textContent = 'Best ' + (state.records[state.runMode] || 0);
    levelLineEl.textContent = state.runMode === 'war'
      ? 'STARFRONT WAR'
      : state.runMode === 'campaign' && state.boss
      ? 'BOSS · ' + (state.campaignStage + 1) + ' / ' + LEVELS.length
      : state.runMode === 'campaign'
        ? 'LEVEL ' + Math.min(state.campaignStage + 1, LEVELS.length) + ' · ' + theme().name
        : state.runMode === 'sprint'
      ? 'TIME ATTACK · ' + Math.max(0, SPRINT_DURATION - state.time).toFixed(1) + 's'
      : state.runMode === 'zen'
        ? 'FREE FLIGHT · ' + theme().name
        : 'Level ' + (state.levelIndex + 1) + ' · ' + theme().name;
    updateCampaignRunMeter();
  }

  function updateCampaignRunMeter() {
    const campaignMode = state.runMode === 'campaign';
    const active = campaignMode && state.mode === 'playing';
    hud.classList.toggle('campaign-mode', campaignMode);
    campaignBoostBtn.classList.toggle('visible', active);
    if (!campaignMode) return;

    const requirement = getCampaignRunRequirement(
      state.campaignTier, state.selectedCampaign, state.campaignWave);
    const boss = state.boss;
    const progress = boss
      ? clamp(boss.health / boss.maxHealth, 0, 1)
      : clamp(state.score / requirement, 0, 1);
    const meterTrack = campaignRunProgressEl.parentElement;
    meterTrack.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    meterTrack.setAttribute('aria-valuetext', boss
      ? Math.ceil(boss.health) + ' of ' + boss.maxHealth + ' health remaining'
      : Math.max(0, Math.ceil(requirement - state.score)) + ' points to monster');
    campaignRunProgressEl.style.width = (progress * 100) + '%';
    campaignRunLabelEl.textContent = boss
      ? (boss.supreme ? 'SUPREME MONSTER' : 'GUARDIAN') + ' · HEALTH'
      : 'DISTANCE TO MONSTER · ' + Math.floor(state.score) + ' / ' + requirement;
    meterTrack.classList.toggle('boss-active', !!boss);
    updateCampaignBoostButton();
  }

  function comboMultiplier(combo = state.combo) {
    return Math.min(100, 1 + Math.floor(combo / 3));
  }

  /* ---------- gem market ---------- */
  const SKINS = {
    classic: '#4af0c0',
    ember: '#ff9a5c',
    aurora: '#c7a9ff',
    frost: '#9fe8ff',
    midas: '#ffcc55',
    coral: '#ff7f98',
    ocean: '#60bfff',
  };
  const SHOP = [
    { id: 'fighter-falcon', cat: 'Fighters', name: 'FALCON', desc: 'North American-inspired interceptor · fast control · 320–1,020 speed', price: 500, type: 'fighter', vehicle: 'falcon', icon: 'ship' },
    { id: 'fighter-sokol', cat: 'Fighters', name: 'SOKOL', desc: 'Russian-inspired delta · reinforced shield · 250–850 speed', price: 600, type: 'fighter', vehicle: 'sokol', icon: 'ship' },
    { id: 'fighter-longyu', cat: 'Fighters', name: 'LONGYU', desc: 'Chinese-inspired stealth design · passive gem magnet · 300–940 speed', price: 650, type: 'fighter', vehicle: 'longyu', icon: 'ship' },
    { id: 'fighter-mirage', cat: 'Fighters', name: 'MIRAGE', desc: 'Auto-cloaks to slip through danger · 310–980 speed', price: 700, type: 'fighter', vehicle: 'mirage', icon: 'ship' },
    { id: 'fighter-comet', cat: 'Fighters', name: 'COMET', desc: 'Earns 25% more flight score from gems · 340–1,080 speed', price: 750, type: 'fighter', vehicle: 'comet', icon: 'ship' },
    { id: 'fighter-tempest', cat: 'Fighters', name: 'TEMPEST', desc: 'Automatically fires a laser every 12 seconds', price: 800, type: 'fighter', vehicle: 'tempest', icon: 'ship' },
    { id: 'fighter-wasp', cat: 'Fighters', name: 'WASP', desc: 'Scout helicopter with a long-range rescue drone', price: 700, type: 'fighter', vehicle: 'wasp', icon: 'ship' },
    { id: 'fighter-atlas', cat: 'Fighters', name: 'ATLAS', desc: 'Armored helicopter starts with three shield hits', price: 800, type: 'fighter', vehicle: 'atlas', icon: 'ship' },
    { id: 'fighter-kestrel', cat: 'Fighters', name: 'KESTREL', desc: 'Evasive helicopter with a 50% larger near-miss bonus', price: 850, type: 'fighter', vehicle: 'kestrel', icon: 'ship' },
    { id: 'pilot-rookie', cat: 'Pilots', name: 'ROOKIE PILOT · MALE', desc: 'Free starter portrait · choose this pilot for your flight record', price: 0, type: 'pilot', pilot: 'rookie', icon: 'pilot' },
    { id: 'pilot-ace', cat: 'Pilots', name: 'ACE VANGUARD · FEMALE', desc: 'Free starter portrait · choose this pilot for your flight record', price: 0, type: 'pilot', pilot: 'ace', icon: 'pilot' },
    { id: 'pilot-android', cat: 'Pilots', name: 'SENTINEL-7', desc: 'Synthetic flight specialist · portrait for your flight record', price: 350, type: 'pilot', pilot: 'android', icon: 'pilot' },
    { id: 'pilot-vanguard', cat: 'Pilots', name: 'SCOUT VANGUARD', desc: 'Frontier reconnaissance pilot · portrait for your flight record', price: 450, type: 'pilot', pilot: 'vanguard', icon: 'pilot' },
    { id: 'skin-ember', cat: 'Skins', name: 'EMBER', desc: 'Molten orange color finish · shape unchanged', price: 150, type: 'skin', skin: 'ember', icon: 'ship' },
    { id: 'skin-aurora', cat: 'Skins', name: 'AURORA', desc: 'Violet color finish · shape unchanged', price: 150, type: 'skin', skin: 'aurora', icon: 'ship' },
    { id: 'skin-frost', cat: 'Skins', name: 'FROST', desc: 'Ice-blue color finish · shape unchanged', price: 150, type: 'skin', skin: 'frost', icon: 'ship' },
    { id: 'skin-midas', cat: 'Skins', name: 'MIDAS', desc: 'Gold color finish · shape unchanged', price: 400, type: 'skin', skin: 'midas', icon: 'ship' },
    { id: 'skin-coral', cat: 'Skins', name: 'CORAL', desc: 'Bright coral color finish · shape unchanged', price: 180, type: 'skin', skin: 'coral', icon: 'ship' },
    { id: 'skin-ocean', cat: 'Skins', name: 'OCEAN', desc: 'Deep blue color finish · shape unchanged', price: 180, type: 'skin', skin: 'ocean', icon: 'ship' },
    { id: 'glow-prism', cat: 'Skins', name: 'PRISM GLOW', desc: 'A shifting aurora halo around your fighter', price: 220, type: 'glow', glow: 'prism', icon: 'radar' },
    { id: 'glow-ember', cat: 'Skins', name: 'EMBER GLOW', desc: 'A warm plasma halo around your fighter', price: 220, type: 'glow', glow: 'ember', icon: 'radar' },
    { id: 'move-afterburn', cat: 'Skins', name: 'AFTERBURN TRAIL', desc: 'Cosmetic comet trail while you fly', price: 300, type: 'move', move: 'afterburn', icon: 'laser' },
    { id: 'move-phase', cat: 'Skins', name: 'PHASE WAKE', desc: 'Cosmetic violet phase trail while you fly', price: 320, type: 'move', move: 'phase', icon: 'laser' },
    { id: 'up-shield2', cat: 'Power-ups', name: 'SHIELD 2.0', desc: 'Shields absorb 2 hits', price: 250, type: 'upgrade', icon: 'shield' },
    { id: 'up-magnet', cat: 'Power-ups', name: 'MAGNET+', desc: 'Magnet lasts 9s', price: 200, type: 'upgrade', icon: 'magnet' },
    { id: 'up-slow', cat: 'Power-ups', name: 'SLOW+', desc: 'Slow-mo lasts 9s', price: 200, type: 'upgrade', icon: 'slow' },
    { id: 'up-laser2', cat: 'Power-ups', name: 'TWIN LASER', desc: 'Laser destroys 2 blocks', price: 300, type: 'upgrade', icon: 'laser' },
    { id: 'up-rocket-rack', cat: 'Power-ups', name: 'GUIDED ROCKET RACK', desc: 'Titan launches 3 extra player-fired rockets per run', price: 300, type: 'upgrade', icon: 'rocket' },
    { id: 'up-phase-2', cat: 'Power-ups', name: 'PHASE CAPACITOR I', desc: 'Falcon phase lasts 2 seconds longer', price: 250, type: 'upgrade', icon: 'shield' },
    { id: 'up-phase-4', cat: 'Power-ups', name: 'PHASE CAPACITOR II', desc: 'Falcon phase lasts 4 more seconds', price: 450, type: 'upgrade', icon: 'shield' },
    { id: 'tech-radar', cat: 'Technology', name: 'GEM RADAR', desc: 'Gems drift toward you', price: 350, type: 'tech', icon: 'radar' },
    { id: 'tech-collector', cat: 'Technology', name: 'AUTO-COLLECTOR', desc: 'Pull nearby crystals from adjacent lanes', price: 250, type: 'tech', icon: 'collector' },
    { id: 'tech-head', cat: 'Technology', name: 'HEAD START', desc: 'Begin runs at +100 score', price: 300, type: 'tech', icon: 'start' },
    { id: 'tech-score', cat: 'Technology', name: 'SCORE TELEMETRY', desc: 'Earn 15% more score from collected gems', price: 500, type: 'tech', icon: 'radar' },
    { id: 'war-cannon', cat: 'War Arsenal', name: 'PULSE CANNON', desc: 'Starfront War: deal double damage to raiders and supreme monsters', price: 450, type: 'war-tech', icon: 'laser' },
    { id: 'war-rapid', cat: 'War Arsenal', name: 'RAPID-FIRE COIL', desc: 'Starfront War: increase automatic weapon fire rate', price: 350, type: 'war-tech', icon: 'rocket' },
    { id: 'war-armor', cat: 'War Arsenal', name: 'AEGIS ARMOR', desc: 'Starfront War: begin sorties with an extra life and shield', price: 500, type: 'war-tech', icon: 'shield' },
  ];
  const PILOTS = {
    rookie: { name: 'ROOKIE PILOT', portrait: 'rookie', gender: 'MALE', free: true },
    ace: { name: 'ACE VANGUARD', portrait: 'ace', gender: 'FEMALE', free: true },
    android: { name: 'SENTINEL-7', portrait: 'android', gender: 'SYNTHETIC' },
    vanguard: { name: 'SCOUT VANGUARD', portrait: 'vanguard', gender: 'FEMALE' },
  };

  function marketPreview(item) {
    if (item.pilot) {
      return '<span class="m-icon pilot-market-icon" aria-hidden="true"><img src="./assets/pilots/' + item.pilot + '.svg" alt="" /></span>';
    }
    if (item.skin) {
      return '<span class="m-icon skin-icon" data-skin="' + item.skin + '" aria-hidden="true"><img class="skin-tint" data-skin="' + item.skin + '" src="./assets/ships/' + state.vehicle + '.svg" alt="" /></span>';
    }
    if (item.vehicle) return '<span class="m-icon fighter-icon" aria-hidden="true"><img src="./assets/ships/' + item.vehicle + '.svg" alt="" /></span>';
    const color = item.icon === 'shield' ? COLORS.shield : item.icon === 'magnet' ? COLORS.magnet : item.icon === 'slow' ? COLORS.slow : item.icon === 'laser' ? COLORS.laser : item.icon === 'radar' || item.icon === 'collector' || item.icon === 'rocket' ? COLORS.gem : '#4af0c0';
    const shapes = {
      ship: '<path d="M12 2 21 21l-9-4-9 4z" fill="COLOR" stroke="COLOR" stroke-linejoin="round"/>',
      shield: '<path d="M12 2 20 6v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" fill="none" stroke="COLOR" stroke-width="2"/>',
      magnet: '<path d="M5 4v8a7 7 0 0 0 14 0V4M5 4h5v5H5zM14 4h5v5h-5z" fill="none" stroke="COLOR" stroke-width="2" stroke-linecap="round"/>',
      slow: '<path d="M6 3h12M6 21h12M7 3c0 8 10 10 10 18M17 3c0 8-10 10-10 18" fill="none" stroke="COLOR" stroke-width="2" stroke-linecap="round"/>',
      laser: '<path d="m13 2-8 12h6l-1 8 9-12h-6z" fill="COLOR" stroke="COLOR" stroke-linejoin="round"/>',
      radar: '<circle cx="12" cy="12" r="9" fill="none" stroke="COLOR" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="none" stroke="COLOR" stroke-width="1.5"/><path d="m12 12 6-6" stroke="COLOR" stroke-width="2"/>',
      collector: '<path d="M12 2 21 12l-9 10-9-10z" fill="none" stroke="COLOR" stroke-width="2"/><path d="M3 12h5m8 0h5" stroke="COLOR" stroke-width="1.5"/>',
      start: '<path d="M4 12h13m-5-5 5 5-5 5" fill="none" stroke="COLOR" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 5v14" stroke="COLOR" stroke-width="2"/>',
      rocket: '<path d="M14 3c4-1 7-1 7-1s0 3-1 7l-8 8-5-5z" fill="none" stroke="COLOR" stroke-width="2" stroke-linejoin="round"/><path d="m7 12-4 1-1 5 5-2m5 1-1 4 5 1-2-5" fill="none" stroke="COLOR" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="6" r="1.5" fill="COLOR"/>',
    };
    return '<span class="m-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + shapes[item.icon].replace(/COLOR/g, color) + '</svg></span>';
  }

  function renderMarket() {
    marketBankEl.textContent = state.gemBank;
    updateGemBankDisplay();
    marketHeroShipEl.src = './assets/ships/' + state.vehicle + '.svg';
    const categories = [...new Set(SHOP.map((item) => item.cat))];
    const categoryIcons = { Fighters: '✈', Pilots: '✦', Skins: '🎨', 'Power-ups': '⚡', Technology: '⌁', 'War Arsenal': '⚔' };
    marketTabsEl.innerHTML = categories.map((category) =>
      '<button class="market-tab' + (category === state.marketCategory ? ' selected' : '') +
      '" type="button" role="tab" aria-selected="' + (category === state.marketCategory) +
      '" data-category="' + category + '" data-icon="' + categoryIcons[category] + '">' + category + '</button>').join('');
    let html = '';
    for (const category of categories) {
      html += '<section class="m-category' + (category === state.marketCategory ? ' selected' : '') +
        '" role="tabpanel" aria-label="' + category + '">';
      for (const item of SHOP.filter((entry) => entry.cat === category)) {
        const owned = !!state.owned[item.id];
        const equipped = item.type === 'skin' && state.skin === item.skin;
        const fighterEquipped = item.type === 'fighter' && state.vehicle === item.vehicle;
        const pilotEquipped = item.type === 'pilot' && state.pilot === item.pilot;
        let btn;
        if (item.type === 'pilot' && owned) {
          btn = '<button class="m-buy' + (pilotEquipped ? '' : ' affordable') + '" data-equip-pilot="' + item.pilot + '"' + (pilotEquipped ? ' disabled' : '') + '>' + (pilotEquipped ? 'ACTIVE' : 'EQUIP') + '</button>';
        } else if (item.type === 'fighter' && owned) {
          btn = '<button class="m-buy' + (fighterEquipped ? '' : ' affordable') + '" data-equip-vehicle="' + item.vehicle + '"' + (fighterEquipped ? ' disabled' : '') + '>' + (fighterEquipped ? 'FLYING' : 'EQUIP') + '</button>';
        } else if (item.type === 'skin' && owned) {
          btn = '<button class="m-buy' + (equipped ? '' : ' affordable') + '" data-equip="' + item.id + '"' + (equipped ? ' disabled' : '') + '>' + (equipped ? 'ON' : 'EQUIP') + '</button>';
        } else if ((item.type === 'glow' || item.type === 'move') && owned) {
          const active = item.type === 'glow' ? state.owned['active-glow'] === item.glow : state.owned['active-move'] === item.move;
          btn = '<button class="m-buy' + (active ? '' : ' affordable') + '" data-equip-style="' + item.id + '"' + (active ? ' disabled' : '') + '>' + (active ? 'ON' : 'EQUIP') + '</button>';
        } else if ((item.type === 'glow' || item.type === 'move') && !owned) {
          btn = '<button class="m-buy' + (state.gemBank >= item.price ? ' affordable' : '') + '" data-buy="' + item.id + '">BUY</button>';
        } else if (owned) {
          btn = '<button class="m-buy" disabled>OWNED</button>';
        } else {
          btn = '<button class="m-buy' + (state.gemBank >= item.price ? ' affordable' : '') + '" data-buy="' + item.id + '">BUY</button>';
        }
        html += '<div class="m-item' + (equipped || fighterEquipped || pilotEquipped ? ' equipped' : '') + '">' + marketPreview(item) +
          '<div class="m-info"><div class="m-name">' + item.name + '</div><div class="m-desc">' + item.desc + '</div></div><div class="m-price">' +
          (item.price === 0 ? '<b class="free-item">FREE</b>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffcc55" stroke-width="2.2" stroke-linejoin="round"><path d="M12 2l8 7-8 13L4 9z"/></svg>' + item.price) +
          '</div>' + btn + '</div>';
      }
      html += '</section>';
    }
    marketListEl.innerHTML = html;
    refreshRewardIndicator();
  }

  function updateGemBankDisplay(animate = false) {
    gemBankLineEl.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 9 12 22 3 9z"/><path d="m3 9 9 13 9-13M3 9h18M8 9l4-7 4 7"/></svg><b>' +
      state.gemBank.toLocaleString() + '</b>';
    gemBankLineEl.setAttribute('aria-label', 'Gem balance: ' + state.gemBank.toLocaleString());
    marketBankEl.textContent = state.gemBank.toLocaleString();
    collectorGemBalanceEl.textContent = state.gemBank.toLocaleString();
    if (animate) {
      gemBankLineEl.classList.remove('bank-updated');
      void gemBankLineEl.offsetWidth;
      gemBankLineEl.classList.add('bank-updated');
    }
  }

  function buyItem(id) {
    const item = SHOP.find((s) => s.id === id);
    if (!item || state.owned[id]) return;
    if (state.gemBank < item.price) { Sound.deny(); return; }
    state.gemBank -= item.price;
    updateGemBankDisplay();
    state.owned[id] = true;
    if (item.type === 'skin') {
      state.skin = item.skin;
      updateHomeShip();
    } else if (item.type === 'fighter') {
      state.vehicle = item.vehicle;
      updateHomeShip();
      renderVehicleCards();
    } else if (item.type === 'pilot') {
      state.pilot = item.pilot;
    } else if (item.type === 'glow') {
      state.owned['active-glow'] = item.glow;
      updateHomeShip();
    } else if (item.type === 'move') {
      state.owned['active-move'] = item.move;
      updateHomeShip();
    }
    Sound.power();
    savePersistent();
    renderMarket();
    renderGoals();
    renderProfile();
  }

  function equipSkin(id) {
    const item = SHOP.find((s) => s.id === id);
    if (item && state.owned[id]) {
      state.skin = item.skin;
      updateHomeShip();
      Sound.move();
      savePersistent();
      renderMarket();
      renderGoals();
      renderProfile();
    }

    function equipStyle(id) {
      const item = SHOP.find((entry) => entry.id === id);
      if (!item || !state.owned[id]) return;
      state.owned[item.type === 'glow' ? 'active-glow' : 'active-move'] = item.type === 'glow' ? item.glow : item.move;
      updateHomeShip();
      savePersistent();
      renderMarket();
      renderProfile();
    }
  }

  function equipVehicle(key) {
    if (!isVehicleUnlocked(key, state.bestComboAll, state.owned)) return;
    state.vehicle = key;
    updateHomeShip();
    renderVehicleCards();
    refreshVehicleLocks();
    Sound.move();
    savePersistent();
    renderMarket();
    renderProfile();
  }

  function updateHomeShip() {
    const craft = VEHICLES[state.vehicle];
    const pilot = PILOTS[state.pilot] || PILOTS.rookie;
    homeShipEl.src = './assets/ships/' + state.vehicle + '.svg';
    homeShipEl.dataset.skin = state.skin;
    homeShipEl.dataset.glow = state.owned['active-glow'] || '';
    homeShipEl.dataset.move = state.owned['active-move'] || '';
    homeShipEl.alt = craft.name + ' fighter jet preview';
    homeShipNameEl.textContent = craft.name + ' · ' + (state.skin === 'classic' ? craft.callsign : state.skin.toUpperCase() + ' FLIGHT SKIN');
    homeShipAbilityEl.textContent = craft.ability;
    profileShortcutPortraitEl.src = './assets/pilots/' + pilot.portrait + '.svg';
    profileShortcutPortraitEl.alt = pilot.name + ' portrait';
    collectorActiveFighterEl.src = homeShipEl.src;
    collectorActiveFighterEl.alt = craft.name + ' fighter jet preview';
    collectorActiveFighterEl.dataset.skin = state.skin;
    collectorActiveFighterEl.dataset.glow = state.owned['active-glow'] || '';
    collectorActiveFighterEl.dataset.move = state.owned['active-move'] || '';
    collectorActiveFighterNameEl.textContent = craft.name + ' · ' +
      (state.skin === 'classic' ? craft.callsign : state.skin.toUpperCase() + ' FLIGHT SKIN');
    collectorActiveFighterAbilityEl.textContent = craft.ability;
  }

  const DAILY_CHALLENGES = [
    { key: 'gems', target: 8, label: 'Collect 8 gems' },
    { key: 'score', target: 400, label: 'Reach 400 score in one run' },
    { key: 'nearMisses', target: 4, label: 'Make 4 near misses' },
  ];
  const ACHIEVEMENTS = [
    { id: 'first-sortie', label: 'First sortie', detail: 'Complete your first flight', mode: 'ALL MODES', tier: 'BRONZE', icon: '🚀', reward: { gems: 5 }, test: () => state.flightCount >= 1 },
    { id: 'gem-hunter', label: 'Gem hunter', detail: 'Collect 10 gems in one Classic run', mode: 'CLASSIC', tier: 'BRONZE', icon: '💎', reward: { gems: 8 }, test: () => state.runMode === 'classic' && state.stats.gems >= 10 },
    { id: 'thread-needle', label: 'Thread the needle', detail: 'Make 5 near misses in Classic', mode: 'CLASSIC', tier: 'SILVER', icon: '⚡', reward: { gems: 10 }, test: () => state.runMode === 'classic' && state.nearMisses >= 5 },
    { id: 'combo-ace', label: 'Combo ace', detail: 'Reach a 15-gem combo', mode: 'CLASSIC', tier: 'GOLD', icon: '🏅', reward: { item: 'skin-frost' }, test: () => state.bestComboAll >= 15 },
    { id: 'classic-veteran', label: 'Neon veteran', detail: 'Score 1,500 in Classic', mode: 'CLASSIC', tier: 'GOLD', icon: '🌟', reward: { gems: 15 }, test: () => state.runMode === 'classic' && state.records.classic >= 1500 },
    { id: 'sprint-finish', label: 'Time trialist', detail: 'Finish a Sprint run', mode: 'SPRINT', tier: 'BRONZE', icon: '⏱️', reward: { gems: 8 }, test: () => state.runMode === 'sprint' && state.sprintComplete },
    { id: 'sprint-distance', label: 'Full throttle', detail: 'Finish Sprint with 2,000 score', mode: 'SPRINT', tier: 'SILVER', icon: '💨', reward: { gems: 12 }, test: () => state.runMode === 'sprint' && state.sprintComplete && state.score >= 2000 },
    { id: 'sprint-ace', label: 'Sprint ace', detail: 'Finish Sprint with 4,000 score', mode: 'SPRINT', tier: 'GOLD', icon: '🏁', reward: { gems: 18 }, test: () => state.runMode === 'sprint' && state.sprintComplete && state.score >= 4000 },
    { id: 'zen-first-light', label: 'Quiet skies', detail: 'Collect 5 gems in a Zen flight', mode: 'ZEN', tier: 'BRONZE', icon: '🌙', reward: { gems: 6 }, test: () => state.runMode === 'zen' && state.stats.gems >= 5 },
    { id: 'zen-stargazer', label: 'Stargazer', detail: 'Collect 12 gems in a Zen flight', mode: 'ZEN', tier: 'SILVER', icon: '🌌', reward: { gems: 10 }, test: () => state.runMode === 'zen' && state.stats.gems >= 12 },
    { id: 'zen-constellation', label: 'Constellation', detail: 'Collect 20 gems in a Zen flight', mode: 'ZEN', tier: 'GOLD', icon: '✨', reward: { gems: 15 }, test: () => state.runMode === 'zen' && state.stats.gems >= 20 },
    { id: 'campaign-first-light', label: 'First frontier', detail: 'Clear your first Campaign stage', mode: 'CAMPAIGN', tier: 'BRONZE', icon: '🪐', reward: { gems: 8 }, test: () => state.runMode === 'campaign' && state.campaignUnlock >= 1 },
    { id: 'campaign-pioneer', label: 'Star pioneer', detail: 'Clear 5 Campaign stages', mode: 'CAMPAIGN', tier: 'SILVER', icon: '🛰️', reward: { gems: 14 }, test: () => state.runMode === 'campaign' && state.campaignUnlock >= 5 },
    { id: 'guardian-slayer', label: 'Guardian slayer', detail: 'Complete all five Campaign worlds', mode: 'CAMPAIGN', tier: 'GOLD', icon: '👾', reward: { gems: 25 }, test: () => state.runMode === 'campaign' && state.campaignUnlock >= 25 },
    { id: 'war-first-blood', label: 'First blood', detail: 'Clear your first War mission', mode: 'WAR MODE', tier: 'BRONZE', icon: '🛡️', reward: { gems: 8 }, test: () => state.runMode === 'war' && state.warUnlockedMission >= 1 },
    { id: 'war-ace', label: 'Warfront ace', detail: 'Clear 3 War missions', mode: 'WAR MODE', tier: 'SILVER', icon: '🚀', reward: { gems: 14 }, test: () => state.runMode === 'war' && state.warUnlockedMission >= 3 },
    { id: 'warfront-champion', label: 'Warfront champion', detail: 'Defeat a system boss', mode: 'WAR MODE', tier: 'GOLD', icon: '👑', reward: { gems: 22 }, test: () => state.runMode === 'war' && state.warUnlockedMission >= WAR_LEVELS_PER_SCENARIO },
  ];

  function todayKey() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }

  function daysBetween(first, second) {
    const toUtcDay = (key) => {
      const [year, month, day] = key.split('-').map(Number);
      return Date.UTC(year, month - 1, day) / 86400000;
    };
    return toUtcDay(second) - toUtcDay(first);
  }

  function dailyChallenge() {
    const today = todayKey();
    if (state.dailyDay !== today) {
      state.dailyDay = today;
      state.dailyProgress = 0;
      state.dailyClaimed = false;
    }
    const day = state.dailyDay;
    const dayNumber = Number(day.replace(/-/g, ''));
    return DAILY_CHALLENGES[dayNumber % DAILY_CHALLENGES.length];
  }

  function renderGoals() {
    const challenge = dailyChallenge();
    const progress = Math.min(state.dailyProgress, challenge.target);
    const dailyReady = canClaimReward(progress >= challenge.target, state.dailyClaimed);
    const currentStreak = state.lastDailyRewardDate && daysBetween(state.lastDailyRewardDate, todayKey()) > 1 ? 0 : state.dailyStreak;
    const streakDay = (currentStreak % 7) + 1;
    const loginReward = getDailyRewardAmount(streakDay);
    const loginClaimed = !canClaimDailyGift(state.lastDailyRewardDate, todayKey());
    dailyRewardEl.innerHTML = '<div class="daily-streak"><strong>' + (loginClaimed ? 'TODAY\'S REWARD CLAIMED' : 'CHECK IN TODAY') +
      '</strong><p>Daily streak: ' + currentStreak + ' day' + (currentStreak === 1 ? '' : 's') +
      (currentStreak ? ' · next reward Day ' + streakDay : '') + '</p><div class="streak-days">' +
      Array.from({ length: 7 }, (_, index) => '<span class="' + (index + 1 === streakDay ? 'current' : '') + '">DAY ' +
        (index + 1) + '<b>' + getDailyRewardAmount(index + 1) + ' ✦</b></span>').join('') +
      '</div>' + (loginClaimed
        ? '<span class="claim-state">Come back tomorrow to continue your streak.</span>'
        : '<button class="claim-reward" data-claim-login>' + gemRewardMarkup(loginReward) + ' · CLAIM DAILY GIFT</button>') + '</div>';
    dailyChallengeEl.innerHTML = '<strong>DAILY · ' + challenge.label + '</strong><br>' +
      (state.dailyClaimed
        ? 'Claimed: ' + gemRewardMarkup(100)
        : progress + ' / ' + challenge.target + (challenge.key === 'score' ? ' score' : '') + ' · Reward: ' + gemRewardMarkup(100)) +
      (dailyReady ? '<button class="claim-reward" data-claim-daily>' + gemRewardMarkup(100) + ' · CLAIM CHALLENGE</button>' : '');
    const completed = ACHIEVEMENTS.filter((achievement) => state.achievements[achievement.id]).length;
    achievementListEl.innerHTML = '<strong class="achievement-summary">ACHIEVEMENTS · ' + completed + '/' + ACHIEVEMENTS.length + ' UNLOCKED</strong>' +
      ACHIEVEMENTS.map((achievement) => {
        const unlocked = !!state.achievements[achievement.id];
        const claimed = !!state.achievementClaims[achievement.id];
        const rewardText = achievement.reward.gems
          ? gemRewardMarkup(achievement.reward.gems)
          : SHOP.find((item) => item.id === achievement.reward.item).name + ' skin';
        return '<div class="achievement-row tier-' + achievement.tier.toLowerCase() + (unlocked ? ' unlocked' : '') + (claimed ? ' claimed' : '') + '">' +
          '<span class="achievement-art" aria-hidden="true">' + achievement.icon + '</span>' +
          '<span class="achievement-copy"><span class="achievement-meta"><b>' + achievement.mode + '</b><i>' + achievement.tier + '</i></span>' +
          '<strong>' + achievement.label + '</strong><small>' + achievement.detail + '</small><small class="achievement-prize">Reward: ' +
          rewardText + '</small></span>' +
          (claimed
            ? '<span class="claim-state">CLAIMED</span>'
            : unlocked
              ? '<button class="claim-reward" data-claim-achievement="' + achievement.id + '">CLAIM</button>'
              : '<span class="claim-state">LOCKED</span>') + '</div>';
      }).join('');
    modeRecordsEl.innerHTML = Object.entries(RUN_MODES)
      .map(([mode, definition]) => '<div>' + definition.name + '<strong> · ' + (state.records[mode] || 0) + '</strong></div>')
      .join('');
    refreshRewardIndicator();
  }

  function updateDailyChallenge() {
    const challenge = dailyChallenge();
    if (challenge.key === 'gems') state.dailyProgress += state.stats.gems;
    else if (challenge.key === 'score') state.dailyProgress = Math.max(state.dailyProgress, Math.floor(state.score));
    else state.dailyProgress += state.nearMisses;

    let unlocked = false;
    for (const achievement of ACHIEVEMENTS) {
      if (!state.achievements[achievement.id] && achievement.test()) {
        state.achievements[achievement.id] = true;
        unlocked = true;
      }
    }
    renderGoals();
    return { ready: canClaimReward(state.dailyProgress >= challenge.target, state.dailyClaimed), unlocked };
  }

  function claimDailyReward() {
    const challenge = dailyChallenge();
    if (!canClaimReward(state.dailyProgress >= challenge.target, state.dailyClaimed)) return;
    state.dailyClaimed = true;
    state.gemBank += 100;
    updateGemBankDisplay(true);
    Sound.power();
    savePersistent();
    renderGoals();
    renderMarket();
    renderProfile();
  }

  function claimLoginReward() {
    const today = todayKey();
    if (!canClaimDailyGift(state.lastDailyRewardDate, today)) return;
    state.dailyStreak = state.lastDailyRewardDate && daysBetween(state.lastDailyRewardDate, today) === 1
      ? state.dailyStreak + 1
      : 1;
    state.lastDailyRewardDate = today;
    state.gemBank += getDailyRewardAmount(state.dailyStreak);
    updateGemBankDisplay(true);
    Sound.power();
    savePersistent();
    renderGoals();
    renderMarket();
    renderProfile();
  }

  function gemRewardMarkup(amount) {
    return '<span class="gem-reward"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 9 12 22 3 9z"/><path d="m3 9 9 13 9-13M3 9h18M8 9l4-7 4 7" /></svg><b>' + amount + '</b> gems</span>';
  }

  function claimAchievementReward(id) {
    const achievement = ACHIEVEMENTS.find((entry) => entry.id === id);
    if (!achievement || !state.achievements[id] || state.achievementClaims[id]) return;
    if (achievement.reward.gems) {
      state.gemBank += achievement.reward.gems;
      updateGemBankDisplay(true);
    }
    if (achievement.reward.item) state.owned[achievement.reward.item] = true;
    state.achievementClaims[id] = true;
    Sound.power();
    savePersistent();
    renderGoals();
    renderMarket();
    renderProfile();
    updateHomeShip();
  }

  dailyChallengeEl.addEventListener('click', (event) => {
    if (event.target.closest('[data-claim-daily]')) claimDailyReward();
  });
  dailyRewardEl.addEventListener('click', (event) => {
    if (event.target.closest('[data-claim-login]')) claimLoginReward();
  });
  achievementListEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-claim-achievement]');
    if (button) claimAchievementReward(button.dataset.claimAchievement);
  });

  function hasClaimableRewards() {
    const challenge = dailyChallenge();
    return canClaimDailyGift(state.lastDailyRewardDate, todayKey()) ||
      canClaimReward(state.dailyProgress >= challenge.target, state.dailyClaimed) ||
      ACHIEVEMENTS.some((entry) => state.achievements[entry.id] && !state.achievementClaims[entry.id]);
  }

  function refreshRewardIndicator() {
    const ready = hasClaimableRewards();
    homeRewardsBtn.classList.toggle('reward-ready', ready);
    rewardsBtn.classList.toggle('reward-ready', ready);
    const label = ready ? 'Rewards ready to claim' : 'Open rewards';
    homeRewardsBtn.setAttribute('aria-label', label);
    rewardsBtn.setAttribute('aria-label', label);
  }

  function renderProfile() {
    const pilot = PILOTS[state.pilot] || PILOTS.rookie;
    const activeTechnologies = SHOP.filter((item) => item.type === 'tech' && isTechnologyActive(item.id))
      .map((item) => item.id);
    const fleet = { ...state.owned };
    for (const vehicle of unlockedVehicles()) fleet['fighter-' + vehicle] = true;
    const rating = calculatePilotRating(state.vehicle, VEHICLES, fleet, activeTechnologies);
    profileAvatarEl.src = './assets/pilots/' + pilot.portrait + '.svg';
    profileAvatarEl.alt = pilot.name + ' portrait';
    profileNameInputEl.value = state.pilotName || pilot.name;
    profileRankEl.textContent = getPilotRank(state.totalScore, rating);
    profileRatingEl.textContent = rating;
    profileTotalScoreEl.textContent = state.totalScore.toLocaleString();
    profileWarProgressEl.textContent = 'TIER ' + (state.warTier + 1) + ' · ' +
      clamp(state.warUnlockedMission - state.warTier * WAR_TOTAL_MISSIONS, 0, WAR_TOTAL_MISSIONS) + '/' + WAR_TOTAL_MISSIONS;
    profileCampaignProgressEl.textContent = 'TIER ' + (state.campaignTier + 1) + ' · ' +
      getCampaignTierProgress() + '/' + CAMPAIGN_STAGES_PER_TIER;
    profileBestComboEl.textContent = String(state.bestComboAll);
    const selectedCraft = VEHICLES[state.vehicle];
    profileShipPreviewEl.src = './assets/ships/' + state.vehicle + '.svg';
    profileShipPreviewEl.alt = selectedCraft.name + ' fighter';
    profileShipNameEl.textContent = selectedCraft.name + ' · ' + selectedCraft.callsign;
    profileShipAbilityEl.textContent = selectedCraft.ability;
    profilePilotsEl.innerHTML = Object.entries(PILOTS).filter(([id]) =>
      id === 'rookie' || !!state.owned['pilot-' + id] || state.pilot === id).map(([id, portrait]) => {
      const equipped = state.pilot === id;
      const action = equipped ? '<b>ACTIVE</b>' : '<button class="tech-toggle" data-equip-pilot="' + id + '">EQUIP</button>';
      return '<div class="profile-item pilot-item"><img src="./assets/pilots/' + portrait.portrait +
        '.svg" alt="" /><span><strong>' + portrait.name + '</strong><small>' +
        portrait.gender + ' PILOT PORTRAIT</small></span>' + action + '</div>';
    }).join('');
    profileTechnologyEl.innerHTML = SHOP.filter((item) => item.cat === 'Technology' && state.owned[item.id]).map((item) =>
      '<div class="profile-item"><span class="profile-symbol">⌘</span><span><strong>' + item.name + '</strong><small>' + item.desc + '</small></span><button class="tech-toggle" data-tech="' +
      item.id + '" aria-pressed="' + isTechnologyActive(item.id) + '">' + (isTechnologyActive(item.id) ? 'ACTIVE' : 'INACTIVE') + '</button></div>').join('') ||
      '<p class="profile-empty">No technology owned yet. Visit the market to upgrade your ship.</p>';
    const ownedSkins = [{ id: 'skin-classic', name: 'CLASSIC', skin: 'classic' },
      ...SHOP.filter((item) => item.type === 'skin' && state.owned[item.id])];
    profileSkinsEl.innerHTML = ownedSkins.map((item) =>
      '<div class="profile-item"><img class="skin-tint" data-skin="' + item.skin + '" src="./assets/ships/' + state.vehicle + '.svg" alt="" /><span><strong>' +
      item.name + '</strong><small>Color finish · fighter shape unchanged</small></span><button class="tech-toggle" data-hangar-skin="' +
      (item.id === 'skin-classic' ? '' : item.id) + '" aria-pressed="' + (item.skin === state.skin) + '">' +
      (item.skin === state.skin ? 'EQUIPPED' : 'EQUIP') + '</button></div>').join('') +
      SHOP.filter((item) => (item.type === 'glow' || item.type === 'move') && state.owned[item.id]).map((item) => {
        const key = item.type === 'glow' ? 'active-glow' : 'active-move';
        const value = item.type === 'glow' ? item.glow : item.move;
        const equipped = state.owned[key] === value;
        return '<div class="profile-item"><span class="profile-symbol">✧</span><span><strong>' + item.name +
          '</strong><small>' + item.desc + '</small></span><button class="tech-toggle" data-hangar-style="' + item.id +
          '" aria-pressed="' + equipped + '">' + (equipped ? 'EQUIPPED' : 'EQUIP') + '</button></div>';
      }).join('');
    profilePowerupsEl.innerHTML = SHOP.filter((item) => item.cat === 'Power-ups' && state.owned[item.id]).map((item) =>
      '<div class="profile-item"><span class="profile-symbol">✦</span><span><strong>' + item.name + '</strong><small>' + item.desc + '</small></span><b>OWNED</b></div>').join('') || '<p class="profile-empty">No power-up upgrades owned yet.</p>';
    profilePowerupControlsEl.innerHTML = POWERUP_TYPES.map((type) => {
      const info = POWERUP_INFO[type];
      const automatic = state.powerupAuto[type] !== false;
      return '<div class="powerup-setting"><span class="powerup-setting-icon" style="--powerup-color:' + info.color +
        '"><svg viewBox="0 0 24 24" aria-hidden="true">' + info.icon + '</svg></span><span class="powerup-setting-copy"><strong>' +
        info.label + '</strong><small>' + info.detail + '</small></span><button class="powerup-mode-toggle' +
        (automatic ? ' automatic' : '') + '" data-powerup-auto="' + type + '" aria-pressed="' + automatic +
        '"><span>' + (automatic ? 'AUTO' : 'MANUAL') + '</span><i aria-hidden="true"></i></button></div>';
    }).join('');
    profileWarEl.innerHTML = SHOP.filter((item) => item.cat === 'War Arsenal' && state.owned[item.id]).map((item) =>
      '<div class="profile-item profile-war-item"><span class="profile-symbol">✦</span><span><strong>' + item.name + '</strong><small>' +
      item.desc + '</small></span><b>INSTALLED</b></div>').join('') ||
      '<p class="profile-empty">No Starfront War systems installed. Browse the War Arsenal in the market.</p>';
    profileHistoryEl.innerHTML = '<div><span>Flights</span><b>' + state.flightCount + '</b></div>' +
      '<div><span>Total score</span><b>' + state.totalScore.toLocaleString() + '</b></div>' +
      '<div><span>Gems collected</span><b>' + state.totalGemsCollected + '</b></div>' +
      '<div><span>Near misses</span><b>' + state.totalNearMisses + '</b></div>' +
      '<div><span>Best combo</span><b>' + state.bestComboAll + '</b></div>' +
      Object.entries(RUN_MODES).map(([mode, definition]) => '<div><span>' + definition.name + ' best</span><b>' +
        (state.records[mode] || 0) + '</b></div>').join('') +
      '<div><span>Campaign tier progress</span><b>TIER ' + (state.campaignTier + 1) + ' · ' +
        getCampaignTierProgress() + ' / ' + CAMPAIGN_STAGES_PER_TIER + '</b></div>';
  }

  pilotNameFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    state.pilotName = profileNameInputEl.value.trim().slice(0, 24);
    savePersistent();
    renderProfile();
    profileNameInputEl.focus();
  });
  profileSkinsEl.addEventListener('click', (event) => {
    const skinButton = event.target.closest('[data-hangar-skin]');
    const styleButton = event.target.closest('[data-hangar-style]');
    if (skinButton) {
      const skinId = skinButton.dataset.hangarSkin;
      if (!skinId) {
        state.skin = 'classic';
        updateHomeShip();
        savePersistent();
        renderMarket();
        renderProfile();
      } else {
        equipSkin(skinId);
        renderProfile();
      }
    } else if (styleButton) {
      equipStyle(styleButton.dataset.hangarStyle);
      renderProfile();
    }
  });
  profilePowerupControlsEl.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-powerup-auto]');
    if (!toggle) return;
    const type = toggle.dataset.powerupAuto;
    if (!POWERUP_INFO[type]) return;
    state.powerupAuto[type] = !state.powerupAuto[type];
    savePersistent();
    renderProfile();
  });

  /* ---------- persistence (graceful: falls back to memory in sandboxed previews) ---------- */
  const storage = (() => {
    try {
      const s = window['local' + 'Storage'];
      s.setItem('__nd_t', '1');
      s.removeItem('__nd_t');
      return s;
    } catch (e) { return null; }
  })();

  function savePersistent() {
    if (!storage) return;
    try {
      storage.setItem('nd_best', String(state.records.classic));
      storage.setItem('nd_records', JSON.stringify(state.records));
      storage.setItem('nd_bestcombo', String(state.bestComboAll));
      storage.setItem('nd_gembank', String(state.gemBank));
      storage.setItem('nd_owned', JSON.stringify(state.owned));
      storage.setItem('nd_powerup_auto', JSON.stringify(state.powerupAuto));
      storage.setItem('nd_skin', state.skin);
      storage.setItem('nd_daily_day', state.dailyDay);
      storage.setItem('nd_daily_progress', String(state.dailyProgress));
      storage.setItem('nd_daily_claimed', String(state.dailyClaimed));
      storage.setItem('nd_daily_reward_date', state.lastDailyRewardDate);
      storage.setItem('nd_daily_streak', String(state.dailyStreak));
      storage.setItem('nd_achievements', JSON.stringify(state.achievements));
      storage.setItem('nd_achievement_claims', JSON.stringify(state.achievementClaims));
      storage.setItem('nd_flight_count', String(state.flightCount));
      storage.setItem('nd_total_score', String(state.totalScore));
      storage.setItem('nd_pilot_name', state.pilotName);
      storage.setItem('nd_total_gems', String(state.totalGemsCollected));
      storage.setItem('nd_total_near_misses', String(state.totalNearMisses));
      storage.setItem('nd_run_mode', state.runMode === 'war' ? 'classic' : state.runMode);
      storage.setItem('nd_vehicle', state.vehicle);
      storage.setItem('nd_technology_enabled', JSON.stringify(state.technologyEnabled));
      storage.setItem('nd_campaign_unlock', String(state.campaignUnlock));
      storage.setItem('nd_campaign_progress', String(state.campaignUnlock));
      storage.setItem('nd_campaign_tier', String(state.campaignTier));
      storage.setItem('nd_war_unlock', String(state.warUnlockedMission));
      storage.setItem('nd_war_tier', String(state.warTier));
      storage.setItem('nd_war_tier_stats', JSON.stringify(state.warTierStats));
      storage.setItem('nd_pilot', state.pilot);
    } catch (e) { /* ignore */ }
  }

  function loadPersistent() {
    if (!storage) return;
    try {
      state.best = Math.max(0, parseInt(storage.getItem('nd_best') || '0', 10) || 0);
      try {
        const records = JSON.parse(storage.getItem('nd_records') || '{}');
        for (const mode of Object.keys(RUN_MODES)) state.records[mode] = Math.max(0, Number(records[mode]) || 0);
      } catch (e) { state.records.classic = state.best; }
      state.records.classic = Math.max(state.records.classic, state.best);
      state.best = state.records[state.runMode];
      state.bestComboAll = Math.max(0, parseInt(storage.getItem('nd_bestcombo') || '0', 10) || 0);
      const savedMode = storage.getItem('nd_run_mode');
      if (savedMode && RUN_MODES[savedMode]) state.runMode = savedMode;
      state.best = state.records[state.runMode];
      const savedVehicle = storage.getItem('nd_vehicle');
      if (savedVehicle && VEHICLES[savedVehicle]) state.vehicle = savedVehicle;
      state.gemBank = Math.max(0, parseInt(storage.getItem('nd_gembank') || '0', 10) || 0);
      try { state.owned = JSON.parse(storage.getItem('nd_owned') || '{}') || {}; } catch (e) { state.owned = {}; }
      try {
        const powerupAuto = JSON.parse(storage.getItem('nd_powerup_auto') || '{}');
        for (const type of POWERUP_TYPES) {
          if (typeof powerupAuto[type] === 'boolean') state.powerupAuto[type] = powerupAuto[type];
        }
      } catch (e) { state.powerupAuto = { shield: true, magnet: true, slow: true, laser: true }; }
      try { state.technologyEnabled = JSON.parse(storage.getItem('nd_technology_enabled') || '{}') || {}; } catch (e) { state.technologyEnabled = {}; }
      const campaignProgress = storage.getItem('nd_campaign_progress');
      state.campaignUnlock = Math.max(0, parseInt(campaignProgress ||
        String((parseInt(storage.getItem('nd_campaign_unlock') || '0', 10) || 0) * 5), 10) || 0);
      const maxCampaignTier = Math.floor(state.campaignUnlock / CAMPAIGN_STAGES_PER_TIER);
      const defaultCampaignTier = Math.max(0, Math.ceil(state.campaignUnlock / CAMPAIGN_STAGES_PER_TIER) - 1);
      state.campaignTier = clamp(
        parseInt(storage.getItem('nd_campaign_tier') || String(defaultCampaignTier), 10) || 0,
        0,
        maxCampaignTier,
      );
      state.warUnlockedMission = Math.max(0, parseInt(storage.getItem('nd_war_unlock') || '0', 10) || 0);
      const maxUnlockedTier = Math.floor(state.warUnlockedMission / WAR_TOTAL_MISSIONS);
      const defaultWarTier = Math.floor(Math.max(0, state.warUnlockedMission - 1) / WAR_TOTAL_MISSIONS);
      state.warTier = clamp(
        parseInt(storage.getItem('nd_war_tier') || String(defaultWarTier), 10) || 0,
        0,
        maxUnlockedTier,
      );
      try {
        const tierStats = JSON.parse(storage.getItem('nd_war_tier_stats') || 'null');
        if (tierStats && Number.isInteger(tierStats.tier) && tierStats.tier >= 0) {
          state.warTierStats = {
            tier: tierStats.tier,
            missions: Math.max(0, Number(tierStats.missions) || 0),
            score: Math.max(0, Number(tierStats.score) || 0),
            kills: Math.max(0, Number(tierStats.kills) || 0),
            gems: Math.max(0, Number(tierStats.gems) || 0),
            time: Math.max(0, Number(tierStats.time) || 0),
          };
        }
      } catch (e) { state.warTierStats = { tier: state.warTier, missions: 0, score: 0, kills: 0, gems: 0, time: 0 }; }
      if (state.warTierStats.tier !== state.warTier) {
        state.warTierStats = { tier: state.warTier, missions: 0, score: 0, kills: 0, gems: 0, time: 0 };
      }
      const savedPilot = storage.getItem('nd_pilot');
      if (savedPilot && PILOTS[savedPilot]) state.pilot = savedPilot;
      const sk = storage.getItem('nd_skin');
      if (sk && SKINS[sk]) state.skin = sk;
      state.dailyDay = storage.getItem('nd_daily_day') || todayKey();
      state.dailyProgress = Math.max(0, parseInt(storage.getItem('nd_daily_progress') || '0', 10) || 0);
      state.dailyClaimed = storage.getItem('nd_daily_claimed') === 'true';
      state.lastDailyRewardDate = storage.getItem('nd_daily_reward_date') || '';
      state.dailyStreak = Math.max(0, parseInt(storage.getItem('nd_daily_streak') || '0', 10) || 0);
      try { state.achievements = JSON.parse(storage.getItem('nd_achievements') || '{}') || {}; } catch (e) { state.achievements = {}; }
      try { state.achievementClaims = JSON.parse(storage.getItem('nd_achievement_claims') || '{}') || {}; } catch (e) { state.achievementClaims = {}; }
      state.flightCount = Math.max(0, parseInt(storage.getItem('nd_flight_count') || '0', 10) || 0);
      state.totalScore = Math.max(0, parseInt(storage.getItem('nd_total_score') || '0', 10) || 0);
      state.pilotName = storage.getItem('nd_pilot_name') || '';
      state.totalGemsCollected = Math.max(0, parseInt(storage.getItem('nd_total_gems') || '0', 10) || 0);
      state.totalNearMisses = Math.max(0, parseInt(storage.getItem('nd_total_near_misses') || '0', 10) || 0);
      if (state.dailyDay !== todayKey()) {
        state.dailyDay = todayKey();
        state.dailyProgress = 0;
        state.dailyClaimed = false;
      }
    } catch (e) { /* ignore */ }
  }

  /* ---------- combo-based vehicle unlocks ---------- */
  const UNLOCKS = COMBO_UNLOCKS;
  function unlockedVehicles() {
    return Object.keys(VEHICLES).filter((key) => isVehicleUnlocked(key, state.bestComboAll, state.owned));
  }

  function refreshVehicleLocks() {
    renderVehicleCards();
  }

  function updateBestComboLine() {
    const next = ['ghost', 'titan'].find((k) => state.bestComboAll < UNLOCKS[k]);
    bestComboLineEl.textContent = 'Best combo: ' + state.bestComboAll + (next ? ' \u00b7 ' + next.toUpperCase() + ' at x' + comboMultiplier(UNLOCKS[next]) : ' \u00b7 combo fighters unlocked');
    renderCollectorComboRewards();
  }

  function renderCollectorComboRewards() {
    collectorBestComboEl.textContent = 'BEST · ' + state.bestComboAll + ' GEMS';
    const allComboFightersUnlocked = ['ghost', 'titan'].every((key) => state.bestComboAll >= UNLOCKS[key]);
    collectorComboRewardsEl.classList.toggle('hidden', allComboFightersUnlocked);
    collectorComboCardsEl.innerHTML = ['ghost', 'titan'].map((key) => {
      const craft = VEHICLES[key];
      const requiredGems = UNLOCKS[key];
      const unlocked = isVehicleUnlocked(key, state.bestComboAll, state.owned);
      const progress = Math.min(100, Math.round(state.bestComboAll / requiredGems * 100));
      const combo = comboMultiplier(requiredGems);
      return '<article class="combo-unlock-card' + (unlocked ? ' unlocked' : '') + '">' +
        '<img src="./assets/ships/' + key + '.svg" alt="" />' +
        '<div class="combo-unlock-copy"><span class="combo-unlock-requirement">' +
        (unlocked ? 'COMBO REWARD EARNED' : 'UNLOCK AT x' + combo + ' COMBO') +
        '</span><h3>' + craft.name + '</h3><p>' + craft.ability + '</p>' +
        '<div class="combo-progress-track" role="progressbar" aria-label="' + craft.name +
        ' combo unlock progress" aria-valuemin="0" aria-valuemax="' + requiredGems +
        '" aria-valuenow="' + Math.min(state.bestComboAll, requiredGems) + '"><span style="width:' +
        progress + '%"></span></div><small>' + (unlocked ? 'READY IN YOUR HANGAR' :
        Math.min(state.bestComboAll, requiredGems) + ' / ' + requiredGems + ' GEMS IN YOUR BEST CHAIN') +
        '</small></div><span class="combo-unlock-status" aria-hidden="true">' +
        (unlocked ? '✓' : '✦') + '</span></article>';
    }).join('');
  }

  function renderVehicleCards() {
    vehicleRowEl.innerHTML = Object.entries(VEHICLES).map(([key, craft]) => {
      const unlocked = isVehicleUnlocked(key, state.bestComboAll, state.owned);
      const requirement = UNLOCKS[key] ? 'Combo x' + comboMultiplier(UNLOCKS[key]) : craft.price + ' gems';
      return '<button class="vehicle-card' + (state.vehicle === key ? ' selected' : '') + (!unlocked ? ' locked' : '') +
        '" data-vehicle="' + key + '" aria-pressed="' + (state.vehicle === key) + '" aria-label="' + craft.name + ' · ' +
        (unlocked ? craft.ability : 'Locked · ' + requirement) + '">' +
        '<img class="vehicle-card-art" src="./assets/ships/' + key + '.svg" alt="" /><span class="vehicle-color" style="--vehicle-color:' + craft.color + '"></span>' +
        '<span class="v-name">' + craft.name + '</span><span class="v-trait">' +
        (unlocked ? craft.ability : requirement) + '</span></button>';
    }).join('');
    vehicleCards = Array.from(vehicleRowEl.querySelectorAll('.vehicle-card'));
    homeScreen.scrollLeft = 0;
    const selectedCard = vehicleRowEl.querySelector('.vehicle-card.selected');
    if (selectedCard) {
      const selectedOffset = selectedCard.getBoundingClientRect().left - vehicleRowEl.getBoundingClientRect().left + vehicleRowEl.scrollLeft;
      vehicleRowEl.scrollLeft = Math.max(0, selectedOffset - (vehicleRowEl.clientWidth - selectedCard.offsetWidth) / 2);
    }
  }

  function addText(x, y, text, color) {
    state.texts.push({ x, y, text, color, life: 0.9 });
    if (state.texts.length > 8) state.texts.shift();
  }

  function applyPowerup(type) {
    if (type === 'shield') {
      state.shield = true;
      state.shieldHP = (VEHICLES[state.vehicle].shieldHits || 1) + (state.owned['up-shield2'] ? 1 : 0);
    } else if (type === 'magnet') state.magnetT = CFG.magnetDur + (state.owned['up-magnet'] ? 3 : 0);
    else if (type === 'slow') {
      state.slowT = CFG.slowDur + (state.owned['up-slow'] ? 3 : 0);
      state.slowRecoveryT = 0;
    } else if (type === 'laser') state.laserCharge = 1;
    else return false;
    return true;
  }

  let lastManualPowerupPointerAt = 0;
  let manualPowerupInventoryKey = null;
  function useManualPowerup(index) {
    if (state.mode !== 'playing' || state.paused || state.runMode === 'war') return false;
    const type = state.manualPowerups[index];
    if (!type || !applyPowerup(type)) return false;
    state.manualPowerups = consumeManualPowerup(state.manualPowerups, index);
    Sound.power();
    updatePowerHud();
    return true;
  }

  function updateManualPowerups() {
    const visible = state.mode === 'playing' && !state.paused && state.runMode !== 'war' && state.manualPowerups.length > 0;
    manualPowerupsEl.classList.toggle('visible', visible);
    manualPowerupsEl.setAttribute('aria-label', 'Manual power-ups, up to 2 of each type');
    const inventoryKey = visible ? state.manualPowerups.join(',') : '';
    if (inventoryKey === manualPowerupInventoryKey) return;
    manualPowerupInventoryKey = inventoryKey;
    const grouped = [];
    for (let index = 0; index < state.manualPowerups.length; index++) {
      const type = state.manualPowerups[index];
      const existing = grouped.find((item) => item.type === type);
      if (existing) existing.count++;
      else grouped.push({ type, count: 1, index });
    }
    manualPowerupsEl.innerHTML = visible ? '<span class="manual-powerup-capacity">UP TO 2 EACH</span>' +
      grouped.map(({ type, count, index }) => {
      const info = POWERUP_INFO[type];
      return '<button class="manual-powerup" data-manual-powerup="' + index + '" style="--powerup-color:' +
        info.color + '" aria-label="Use ' + info.label + ' power-up, ' + count + ' held"><span class="manual-powerup-symbol">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + info.icon + '</svg><b class="manual-powerup-count">' +
        count + '</b></span><span>' + info.label + '</span></button>';
    }).join('') : '';
    manualPowerupsEl.querySelectorAll('[data-manual-powerup]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        event.preventDefault();
        if (useManualPowerup(Number(button.dataset.manualPowerup))) {
          lastManualPowerupPointerAt = performance.now();
        }
      });
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        if (event.detail !== 0 && performance.now() - lastManualPowerupPointerAt < 500) return;
        if (useManualPowerup(Number(button.dataset.manualPowerup))) {
          lastManualPowerupPointerAt = performance.now();
        }
      });
    });
  }

  function updatePowerHud() {
    chipShield.classList.toggle('on', state.shield || state.shieldInvuln > 0);
    if (state.shield && state.shieldHP > 1) shieldHitsEl.textContent = state.shieldHP + ' HITS';
    else shieldHitsEl.textContent = '1 HIT';
    chipMagnet.classList.toggle('on', state.magnetT > 0);
    chipSlow.classList.toggle('on', state.slowT > 0 || state.slowRecoveryT > 0);
    chipLaser.classList.toggle('on', state.laserCharge > 0);
    magnetTEl.textContent = state.magnetT > 0 ? state.magnetT.toFixed(1) + 's' : 'READY';
    slowTEl.textContent = state.slowT > 0 ? state.slowT.toFixed(1) + 's'
      : state.slowRecoveryT > 0 ? 'RECOVERING' : 'READY';
    chipCombo.classList.toggle('on', state.combo > 0);
    comboVEl.textContent = state.combo + ' · x' + comboMultiplier();
    updateManualPowerups();
  }

  function updateRocketButton() {
    const available = state.mode === 'playing' && !state.paused && VEHICLES[state.vehicle].rocketAmmo;
    rocketBtn.classList.toggle('visible', !!available);
    rocketBtn.disabled = !available || state.rocketAmmo <= 0;
    rocketAmmoEl.textContent = state.rocketAmmo;
  }

  function updateAbilityButton() {
    const available = state.mode === 'playing' && !state.paused && VEHICLES[state.vehicle].perk === 'phase';
    abilityBtn.classList.toggle('visible', !!available);
    abilityBtn.disabled = !available || (!state.falconAbilityAvailable && state.falconPhaseT <= 0);
    abilityTimerEl.textContent = state.falconPhaseT > 0 ? state.falconPhaseT.toFixed(1) + 's'
      : state.falconAbilityAvailable ? 'READY' : 'USED';
    abilityBtn.setAttribute('aria-label', state.falconPhaseT > 0
      ? 'Falcon phase active for ' + state.falconPhaseT.toFixed(1) + ' seconds'
      : state.falconAbilityAvailable ? 'Activate Falcon phase' : 'Falcon phase already used this flight');
  }

  function activateFalconPhase() {
    if (state.mode !== 'playing' || state.paused || VEHICLES[state.vehicle].perk !== 'phase' ||
      !state.falconAbilityAvailable || state.falconPhaseT > 0) return;
    state.falconAbilityAvailable = false;
    state.falconPhaseT = 5 + (state.owned['up-phase-2'] ? 2 : 0) + (state.owned['up-phase-4'] ? 4 : 0);
    addText(state.player.x, playerY() - 20, 'PHASE ACTIVE', '#9fe8ff');
    Sound.power();
    updateAbilityButton();
  }

  function launchRocket() {
    if (state.mode !== 'playing' || state.paused || !VEHICLES[state.vehicle].rocketAmmo || state.rocketAmmo <= 0) return;
    const target = selectRocketTarget(state.obstacles, playerY());
    if (!target) {
      Sound.deny();
      return;
    }

    const index = state.obstacles.indexOf(target);
    if (index < 0) return;
    state.obstacles.splice(index, 1);
    state.rocketAmmo--;
    state.stats.rockets++;
    state.score += 35;
    const targetX = laneCenter(target.lane);
    const targetY = target.y + target.h / 2;
    state.rocketFx = { x: state.player.x, y: playerY(), targetX, targetY, t: 0.32 };
    emitBurst(targetX, targetY, COLORS.laser, 20, 320);
    addText(targetX, targetY - 12, '+35 ROCKET', '#ffbe76');
    Sound.laser();
    updateHud();
    updateRocketButton();
  }

  function defeatBoss() {
    const position = getActiveCampaignPosition();
    const replay = state.campaignReplay || state.selectedCampaign < position.world;
    const defeatedWave = state.campaignWave;
    const finalWave = defeatedWave === CAMPAIGN_WAVES_PER_WORLD - 1;
    const supremeName = state.selectedCampaign === LEVELS.length - 1
      ? 'THE STAR EATER'
      : LEVELS[state.selectedCampaign].name + ' SUPREME GUARDIAN';
    state.boss = null;
    bossHudEl.classList.remove('visible');
    Sound.levelUp();
    state.campaignGems += state.stats.gems;
    if (!replay) {
      state.campaignUnlock++;
      savePersistent();
    }
    if (!finalWave) {
      state.campaignWave++;
      showBanner('GUARDIAN DEFEATED', 'Run ' + (state.campaignWave + 1) + ' · ' + LEVELS[state.selectedCampaign].name);
      resetRun();
      state.mode = 'playing';
      state.sprintComplete = false;
      updateHud();
      updatePowerHud();
      return true;
    }
    state.stats.gems = state.campaignGems;
    state.campaignGems = 0;
    state.sprintComplete = true;
    goalResultEl.textContent = replay
      ? 'Replay complete · all five runs survived.'
      : isCampaignTierUnlocked(state.campaignUnlock, state.campaignTier)
        ? 'TIER ' + (state.campaignTier + 1) + ' CLEARED · Open the next tier from the Campaign Map whenever you are ready.'
        : 'Campaign cleared · the next frontier is now available.';
    showBanner('SUPREME GUARDIAN DEFEATED', supremeName);
    gameOver(true);
    return true;
  }

  function showBanner(eyebrow, name) {
    bannerEyebrow.textContent = eyebrow;
    bannerName.textContent = name;
    banner.classList.remove('show');
    void banner.offsetWidth; // restart CSS animation
    banner.classList.add('show');
  }

  /* =====================================================
     Spawning — always leaves at least one open lane,
     rows spaced far enough to react at current speed.
  ===================================================== */
  function spawnRow() {
    const blockCount = Math.random() < 0.35 ? 2 : 1;
    const lanes = [0, 1, 2];
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    const blocked = state.runMode === 'zen' ? [] : lanes.slice(0, blockCount);
    const openLanes = [0, 1, 2].filter((l) => !blocked.includes(l));
    const rowY = -obstacleH() - laneWidth() * 0.3;
    for (const lane of blocked) {
      state.obstacles.push({ lane, y: rowY, h: obstacleH() });
    }
    let gemLane = -1;
    if (openLanes.length && Math.random() < CFG.gemChance) {
      gemLane = openLanes[randInt(openLanes.length)];
      state.gems.push({ x: laneCenter(gemLane), lane: gemLane, y: rowY, phase: Math.random() * Math.PI * 2 });
    }
    if (openLanes.length && Math.random() < CFG.powerupChance) {
      const candidates = openLanes.filter((l) => l !== gemLane);
      const lane = candidates.length ? candidates[randInt(candidates.length)] : openLanes[randInt(openLanes.length)];
      state.powerups.push({ lane, y: rowY, type: POWERUP_TYPES[randInt(POWERUP_TYPES.length)], phase: Math.random() * Math.PI * 2 });
    }
  }

  function emitCrashParticles() {
    const v = VEHICLES[state.vehicle];
    const crashY = state.runMode === 'war' ? state.player.y : playerY();
    for (let i = 0; i < 42; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 420;
      state.particles.push({
        x: state.player.x,
        y: crashY,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 140,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        size: 3 + Math.random() * 5,
        color: Math.random() < 0.5 ? v.color : COLORS.obstacle,
      });
    }
    for (const p of state.particles) p.maxLife = p.life;
  }

  function emitBurst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random());
      state.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        size: 2 + Math.random() * 3,
        color,
      });
    }
    for (const p of state.particles) if (p.maxLife === 1) p.maxLife = p.life;
  }

  /* =====================================================
     Input
  ===================================================== */
  function moveLane(dir) {
    if (state.mode !== 'playing' || state.paused) return;
    const next = clamp(state.player.lane + dir, 0, LANES - 1);
    if (next === state.player.lane) {
      // bump feedback at the edge
      state.player.fromX = laneCenter(state.player.lane) + dir * laneWidth() * 0.08;
      state.player.toX = laneCenter(state.player.lane);
      state.player.t = 0;
      return;
    }
    // near-miss eligibility: obstacles in the departed lane that threaten the ship's actual position
    const depLane = state.player.lane;
    const shipX = state.player.x;
    const shipTop = playerY();
    const shipH = playerSize();
    for (const o of state.obstacles) {
      if (o.lane !== depLane || o.passed) continue;
      const ow2 = obstacleW();
      const ox2 = laneCenter(o.lane) - ow2 / 2;
      const xOverlap = shipX + 4 > ox2 && shipX - 4 < ox2 + ow2;
      if (xOverlap && o.y + o.h < shipTop + shipH) {
        o.nm = true;
        o.nmT = state.time;
      }
    }
    state.player.lane = next;
    state.player.fromX = state.player.x;
    state.player.toX = laneCenter(next);
    state.player.t = 0;
    Sound.move();
  }

  window.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'playing' || state.paused) return;
    if (e.target === muteBtn || muteBtn.contains(e.target)) return;
    if (e.target === campaignBoostBtn || campaignBoostBtn.contains(e.target)) return;
    if (e.target === pauseBtn || pauseBtn.contains(e.target)) return;
    if (e.target === rocketBtn || rocketBtn.contains(e.target)) return;
    if (e.target === abilityBtn || abilityBtn.contains(e.target)) return;
    if (manualPowerupsEl.contains(e.target)) return;
    if (state.runMode === 'war') {
      state.warPointerDown = true;
      state.player.toX = e.clientX;
      state.player.toY = e.clientY;
      return;
    }
    const x = e.clientX;
    moveLane(x < W / 2 ? -1 : 1);
  }, { passive: true });
  window.addEventListener('pointermove', (event) => {
    if (state.mode !== 'playing' || state.paused || state.runMode !== 'war' || !state.warPointerDown) return;
    state.player.toX = event.clientX;
    state.player.toY = event.clientY;
  }, { passive: true });
  window.addEventListener('pointerup', () => { state.warPointerDown = false; }, { passive: true });
  window.addEventListener('pointercancel', () => { state.warPointerDown = false; }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      if (state.runMode === 'war') state.player.toX = clamp(state.player.toX - 45, 24, W - 24);
      else moveLane(-1);
    }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      if (state.runMode === 'war') state.player.toX = clamp(state.player.toX + 45, 24, W - 24);
      else moveLane(1);
    }
    else if ((e.code === 'ArrowUp' || e.code === 'KeyW') && state.runMode === 'war') state.player.toY = clamp(state.player.toY - 45, 64, H - 50);
    else if ((e.code === 'ArrowDown' || e.code === 'KeyS') && state.runMode === 'war') state.player.toY = clamp(state.player.toY + 45, 64, H - 50);
    else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state.mode === 'playing') setPaused(!state.paused);
    }
    else if (e.code === 'KeyF') launchRocket();
    else if (e.code === 'KeyG') activateFalconPhase();
    else if (e.code === 'Space' || e.code === 'Enter') {
      if (state.mode === 'playing' && state.paused) setPaused(false);
      else if (state.mode === 'menu') startGame();
      else if (state.mode === 'gameover' && !gameoverScreen.classList.contains('hidden')) restartCurrentRun();
      e.preventDefault();
    }
  });

  // block scroll / pull-to-refresh during play
  window.addEventListener('touchmove', (e) => {
    if (!e.target.closest('#start-screen, #collector-screen, #campaign-screen, #war-map-screen, #market-list, .page-scroll')) e.preventDefault();
  }, { passive: false });

  playBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', restartCurrentRun);
  changeVehicleBtn.addEventListener('click', returnHome);
  collectorReturnBtn.addEventListener('click', returnToCollector);
  resumeBtn.addEventListener('click', () => setPaused(false));
  pauseBtn.addEventListener('click', () => setPaused(true));
  pauseRestartBtn.addEventListener('click', () => {
    setPaused(false);
    if (state.runMode === 'war') startWarMission(state.warMission);
    else startGame();
  });
  pauseVehicleBtn.addEventListener('click', returnHome);
  rocketBtn.addEventListener('click', launchRocket);
  abilityBtn.addEventListener('click', activateFalconPhase);

  // vehicle selection
  vehicleRowEl.addEventListener('click', (event) => {
    const card = event.target.closest('[data-vehicle]');
    if (!card) return;
    const key = card.dataset.vehicle;
    if (!isVehicleUnlocked(key, state.bestComboAll, state.owned)) {
      if (VEHICLES[key].price) {
        state.marketCategory = 'Fighters';
        openMarket();
      } else {
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 400);
        Sound.deny();
      }
      return;
    }
    equipVehicle(key);
    renderProfile();
  });

  muteBtn.addEventListener('click', () => {
    Sound.init();
    Sound.setMuted(!Sound.muted);
    muteBtn.setAttribute('aria-label', Sound.muted ? 'Unmute sound' : 'Mute sound');
    muteBtn.style.opacity = Sound.muted ? '0.5' : '1';
  });

  // auto-pause when tab hidden during a run; explicit resume required
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    if (document.hidden) {
      if (state.mode === 'playing' && !state.paused) setPaused(true);
    }
  });

  /* =====================================================
     Update
  ===================================================== */
  function effectiveSpeed() {
    return state.speed * calculateSlowFactor(state.slowT, state.slowRecoveryT, CFG.slowRecoveryDur, CFG.slowFactor);
  }

  function updateWarPickups(dt) {
    for (let i = state.warPickups.length - 1; i >= 0; i--) {
      const pickup = state.warPickups[i];
      pickup.y += pickup.vy * dt;
      if (Math.hypot(pickup.x - state.player.x, pickup.y - state.player.y) < 36) {
        if (pickup.type === 'gem') {
          state.warMissionGems += 5;
          state.score += 5;
        } else if (pickup.type === 'shield') state.warPower.shield = true;
        else if (pickup.type === 'rapid') state.warPower.rapidT = 8;
        else if (pickup.type === 'spread') state.warPower.spread = true;
        else state.warLives++;
        if (pickup.type === 'gem') Sound.gem();
        else Sound.power();
        const pickupColor = pickup.type === 'gem' ? COLORS.gem : pickup.type === 'life' ? '#ff7885' : '#8feaff';
        emitBurst(pickup.x, pickup.y, pickupColor, 10, 180);
        state.warPickups.splice(i, 1);
        updateWarHud();
        updateHud();
        continue;
      }
      if (pickup.y > H + 20) state.warPickups.splice(i, 1);
    }
  }

  function updateWar(dt) {
    if (state.warExiting) {
      state.player.y -= 560 * dt;
      if (state.player.y < -70) {
        state.warExiting = false;
        showWarMissionResult();
      }
      return;
    }
    const mission = getWarMission(state.warMission);
    state.time += dt;
    state.warTime += dt;
    state.player.x = lerp(state.player.x, state.player.toX, Math.min(1, dt * 10));
    state.player.y = lerp(state.player.y, state.player.toY, Math.min(1, dt * 10));
    state.player.x = clamp(state.player.x, 24, W - 24);
    state.player.y = clamp(state.player.y, 64, H - 50);
    state.warInvulnT = Math.max(0, state.warInvulnT - dt);
    state.warPower.rapidT = Math.max(0, state.warPower.rapidT - dt);
    if (state.owned['active-move'] && Math.random() < 0.7) {
      state.particles.push({
        x: state.player.x + (Math.random() - 0.5) * 10, y: state.player.y + 25,
        vx: (Math.random() - 0.5) * 30, vy: 95 + Math.random() * 70,
        life: 0.4, maxLife: 0.4, size: 2 + Math.random() * 2,
        color: state.owned['active-move'] === 'phase' ? '#c7a9ff' : '#ff986d',
      });
    }
    for (const star of state.stars) {
      star.y += 95 * star.v * dt;
      if (star.y > H + 4) { star.y = -4; star.x = Math.random() * W; }
    }
    if (state.warWaveTransitionT > 0) {
      updateWarPickups(dt);
      state.warWaveTransitionT -= dt;
      if (state.warWaveTransitionT <= 0) startWarWave(state.warWave + 1);
      return;
    }

    const fireInterval = (state.owned['war-rapid'] ? 0.14 : 0.22) * (state.warPower.rapidT > 0 ? 0.55 : 1);
    state.warFireT -= dt;
    if (state.warFireT <= 0) {
      state.warFireT = fireInterval;
      const offsets = state.warPower.spread ? [-13, 0, 13] : [0];
      for (const offset of offsets) {
        state.warPlayerShots.push({
          x: state.player.x + offset,
          y: state.player.y - 26,
          vy: -760,
          damage: state.owned['war-cannon'] ? 2 : 1,
          weapon: state.owned['war-cannon'] ? 'pulse' : state.warPower.spread ? 'spread' : 'bolt',
        });
      }
    }

    for (let i = state.warPlayerShots.length - 1; i >= 0; i--) {
      const shot = state.warPlayerShots[i];
      shot.y += shot.vy * dt;
      if (shot.y < -20) state.warPlayerShots.splice(i, 1);
    }
    for (let i = state.warEnemyShots.length - 1; i >= 0; i--) {
      const shot = state.warEnemyShots[i];
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (shot.y > H + 24 || shot.x < -24 || shot.x > W + 24) state.warEnemyShots.splice(i, 1);
    }

    if (isWarBossWave(mission, state.warWave, state.warWaveCount) && state.warBoss) {
        const boss = state.warBoss;
        boss.phase += dt;
        boss.flash = Math.max(0, boss.flash - dt);
        boss.attackT -= dt;
        if (boss.attackT <= 0) {
          boss.attackPhase++;
          boss.attackT = Math.max(0.42, 1.55 - mission.difficulty * 0.11 - state.warWave * 0.055);
          const count = Math.min(9, 3 + Math.floor(mission.difficulty) + Math.floor(state.warWave / 2));
          const bossX = W / 2 + Math.sin(boss.phase * (1 + mission.scenarioIndex * 0.12)) * W * 0.3;
          const bossY = 135 + Math.sin(boss.phase * 1.7) * 22;
          const aimAngle = Math.atan2(state.player.y - bossY, state.player.x - bossX);
          const attackPattern = getWarBossAttackPattern(mission.scenarioIndex, boss.attackPhase - 1);
          const weapon = attackPattern === 'radial' ? 'orb'
            : attackPattern === 'spiral' ? 'shard'
              : attackPattern === 'sweep' ? 'flare'
                : attackPattern === 'crossfire' ? 'lance' : 'plasma';
          for (let shotIndex = 0; shotIndex < count; shotIndex++) {
            const spread = (shotIndex - (count - 1) / 2) * 0.16;
            const angle = attackPattern === 'radial'
              ? (Math.PI * 2 * shotIndex) / count + boss.phase * 0.45
              : attackPattern === 'spiral'
                ? (Math.PI * 2 * shotIndex) / count + boss.phase * 1.2
                : attackPattern === 'sweep'
                  ? Math.PI / 2 + Math.sin(boss.phase * 1.4) * 0.8 + spread * 0.45
                  : attackPattern === 'crossfire'
                    ? (shotIndex % 2 ? Math.PI - 0.35 : 0.35) + spread * 0.3
                    : aimAngle + spread;
            const velocity = 210 + mission.difficulty * 22 + mission.tier * 26 +
              (attackPattern === 'lance' ? 100 : attackPattern === 'shard' ? 35 : 0);
            state.warEnemyShots.push({
              x: bossX, y: bossY + 18, vx: Math.cos(angle) * velocity,
              vy: Math.sin(angle) * velocity + (attackPattern === 'fan' ? 35 : 0),
              weapon,
            });
          }
        }
        const bossX = W / 2 + Math.sin(boss.phase * (1 + mission.scenarioIndex * 0.12)) * W * 0.3;
        const bossY = 135 + Math.sin(boss.phase * 1.7) * 22;
        for (let i = state.warPlayerShots.length - 1; i >= 0; i--) {
          const shot = state.warPlayerShots[i];
          if (Math.abs(shot.x - bossX) < Math.min(W * 0.22, 86) && Math.abs(shot.y - bossY) < 48) {
            boss.hp -= shot.damage;
            state.score += shot.damage * 10;
            boss.flash = 0.08;
            state.warPlayerShots.splice(i, 1);
            updateHud();
            if (boss.hp <= 0) {
              state.warKills++;
              emitBurst(bossX, bossY, mission.accent, 55, 460);
              Sound.explosion();
              state.warMissionGems += 15 + mission.scenarioIndex * 5;
              advanceWarWave();
              return;
            }
          }
        }
    } else {
      for (let i = state.warEnemies.length - 1; i >= 0; i--) {
        const enemy = state.warEnemies[i];
        enemy.phase += dt;
        const difficulty = mission.difficulty;
        if (enemy.role === 'kamikaze' && state.warTime > 1.5) {
          const dx = state.player.x - enemy.x;
          const dy = state.player.y - enemy.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          const velocity = 140 + difficulty * 22 + (state.warWave - 1) * 12;
          const weave = Math.sin(enemy.phase * 5 + enemy.phase) * 28;
          enemy.x += (dx / distance * velocity + weave) * dt;
          enemy.y += dy / distance * velocity * dt;
        } else {
          const wave = Math.sin(enemy.phase * (enemy.pattern === 'line' ? 1 : 2.3));
          const patternOffset = enemy.pattern === 'line' ? wave * 12
            : enemy.pattern === 'zigzag' ? Math.sign(wave) * W * 0.06
            : enemy.pattern === 'sweep' ? Math.sin(enemy.phase * 0.85) * W * 0.12
            : enemy.pattern === 'v' ? Math.sin(enemy.phase * 1.8 + enemy.phase) * W * 0.12
            : enemy.pattern === 'flank' ? Math.sin(enemy.phase * 1.1 + (enemy.homeX < W / 2 ? 0 : Math.PI)) * W * 0.18
            : enemy.pattern === 'helix' ? Math.sin(enemy.phase * 2.1 + enemy.homeX * 0.01) * W * 0.2
            : (enemy.homeX < W / 2 ? 1 : -1) * Math.sin(enemy.phase * 1.7) * W * 0.19;
          enemy.x = clamp(enemy.homeX + patternOffset, 20, W - 20);
          const dive = enemy.pattern === 'pincer' && Math.sin(enemy.phase * 1.7) > 0.9 ? 34 : 0;
          enemy.y = enemy.homeY + Math.sin(enemy.phase * 1.3 + enemy.phase * 0.2) * 14 + dive;
        }
        if (Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < 32) {
          state.warEnemies.splice(i, 1);
          if (takeWarHit(state.player.x, state.player.y)) {
            state.stats.gems = state.warMissionGems;
            gameOver(false);
            return;
          }
          continue;
        }
        if (enemy.role === 'gunship') {
          enemy.fireT -= dt;
          if (enemy.fireT <= 0 && state.warEnemyShots.length < 36) {
            enemy.fireT = Math.max(0.42, (1.8 - difficulty * 0.16 - (state.warWave - 1) * 0.08) * (0.8 + Math.random() * 0.4));
            const angle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
            const velocity = 220 + difficulty * 22 + state.warWave * 8;
            const burst = difficulty + state.warWave * 0.25 >= 3 ? [-0.12, 0, 0.12] : [0];
            for (const spread of burst) {
              state.warEnemyShots.push({
                x: enemy.x, y: enemy.y + 10, vx: Math.cos(angle + spread) * velocity,
                vy: Math.sin(angle + spread) * velocity,
                weapon: mission.scenarioIndex === 1 ? 'ember'
                  : mission.scenarioIndex === 2 ? 'lance'
                    : mission.scenarioIndex === 3 ? 'toxin' : 'bolt',
              });
            }
          }
        }
        for (let shotIndex = state.warPlayerShots.length - 1; shotIndex >= 0; shotIndex--) {
          const shot = state.warPlayerShots[shotIndex];
          if (Math.abs(shot.x - enemy.x) < 20 && Math.abs(shot.y - enemy.y) < 18) {
            enemy.hp -= shot.damage;
            state.warPlayerShots.splice(shotIndex, 1);
            if (enemy.hp <= 0) {
              state.warEnemies.splice(i, 1);
              state.warKills++;
              state.score += Math.round(50 * mission.difficulty);
              emitBurst(enemy.x, enemy.y, mission.accent, 12, 220);
              Sound.explosion();
              const eligibleWaveCount = mission.isBoss ? state.warWaveCount - 1 : state.warWaveCount;
              if (isWarPowerupDropWave(state.warWave, eligibleWaveCount, state.warPowerDropsIssued)) {
                const types = ['shield', 'rapid', 'spread'];
                const type = types[randInt(types.length)];
                const dropX = clamp(enemy.x + (enemy.x < W / 2 ? 20 : -20), 18, W - 18);
                state.warPickups.push({ x: dropX, y: enemy.y, type, vy: 105 });
                state.warPowerDropsIssued++;
              }
              if (isWarLifeDropWave(state.warWave, state.warWaveCount, state.warLifeDropsIssued)) {
                state.warPickups.push({ x: enemy.x, y: enemy.y, type: 'life', vy: 105 });
                state.warLifeDropsIssued++;
              } else if (Math.random() < Math.min(0.2, 0.09 + state.warWave * 0.012)) {
                const gemLimit = getWarGemDropLimit(mission.tier);
                const gemDrop = state.warWaveGemDrops < gemLimit && Math.random() < 0.55;
                if (gemDrop) {
                  state.warWaveGemDrops++;
                  state.warPickups.push({ x: enemy.x, y: enemy.y, type: 'gem', vy: 105 });
                }
              }
              updateWarHud();
              updateHud();
            }
            break;
          }
        }
      }
      if (!state.warEnemies.length) advanceWarWave();
      if (state.warWaveTransitionT > 0 || state.warExiting) {
        updateWarPickups(dt);
        return;
      }
    }

    updateWarPickups(dt);

    for (let i = state.warEnemyShots.length - 1; i >= 0; i--) {
      const shot = state.warEnemyShots[i];
      if (Math.hypot(shot.x - state.player.x, shot.y - state.player.y) > 24) continue;
      state.warEnemyShots.splice(i, 1);
      if (takeWarHit(state.player.x, state.player.y)) {
        state.stats.gems = state.warMissionGems;
        gameOver(false);
        return;
      }
    }
    updateWarHud();
  }

  function update(dt) {
    if (state.paused || document.hidden) return;

    // background scroll (frozen while paused)
    bgScroll += effectiveSpeed() * dt;

    // particles & shake always animate
    updateParticles(dt);
    state.shake = Math.max(0, state.shake - dt * 40);
    if (state.shake > 0.3) {
      state.shakeX = (Math.random() - 0.5) * state.shake;
      state.shakeY = (Math.random() - 0.5) * state.shake;
    } else { state.shakeX = 0; state.shakeY = 0; }
    state.flash = Math.max(0, state.flash - dt * 2.2);

    // floating texts and laser beam fade
    for (let i = state.texts.length - 1; i >= 0; i--) {
      const t = state.texts[i];
      t.y -= 40 * dt;
      t.life -= dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
    if (state.laserFx) {
      state.laserFx.t -= dt;
      if (state.laserFx.t <= 0) state.laserFx = null;
    }
    if (state.rocketFx) {
      state.rocketFx.t -= dt;
      if (state.rocketFx.t <= 0) state.rocketFx = null;
    }

    // combo tier-up flash + fireworks queue
    if (state.tierFx) {
      state.tierFx.t -= dt;
      if (state.tierFx.t <= 0) state.tierFx = null;
    }
    state.fxGlow = Math.max(0, state.fxGlow - dt * 0.7);
    for (let i = state.fireworksQ.length - 1; i >= 0; i--) {
      const f = state.fireworksQ[i];
      f.t -= dt;
      if (f.t <= 0) {
        emitBurst(f.x, f.y, f.color, f.n, f.spd);
        Sound.pop();
        state.fireworksQ.splice(i, 1);
      }
    }

    if (state.mode !== 'playing') return;
    if (state.runMode === 'war') {
      updateWar(dt);
      return;
    }

    state.time += dt;
    if (state.runMode === 'sprint' && state.time >= SPRINT_DURATION) {
      state.score += dt * 12;
      state.sprintComplete = true;
      gameOver(true);
      return;
    }

    // sprint meter: smooth toward current speed, spark when accelerating
    const meterLen = H * 0.4;
    const frac = clamp((effectiveSpeed() - CFG.baseSpeed) / (CFG.maxSpeed - CFG.baseSpeed), 0, 1);
    state.meterFrac += (frac - state.meterFrac) * Math.min(1, dt * 12);
    state.meterRising = effectiveSpeed() > state.prevSpeed + 2;
    state.prevSpeed = effectiveSpeed();
    if (state.meterRising && Math.random() < 0.5 && state.meterFx.length < 18) {
      state.meterFx.push({ f: Math.random() * Math.max(0.05, state.meterFrac), vy: -(120 + Math.random() * 120), life: 0.6 });
    }
    for (let i = state.meterFx.length - 1; i >= 0; i--) {
      const m = state.meterFx[i];
      m.f += (m.vy * dt) / meterLen;
      m.life -= dt;
      if (m.life <= 0 || m.f > 1.05) state.meterFx.splice(i, 1);
    }

    // level progression
    const lv = state.runMode === 'campaign' ? state.selectedCampaign : getLevelIndex(state.score, LEVELS);
    if (lv > state.levelIndex) {
      state.levelIndex = lv;
      if (theme().stars) genStars();
      showBanner('Level ' + (lv + 1), theme().name);
      Sound.levelUp();
    }

    // speed: level base + slow creep within the level, capped
    const inLevel = Math.max(0, state.score - theme().at);
    const creep = Math.min(inLevel * CFG.creepPerPoint, CFG.creepMax) + Math.max(0, inLevel - CFG.creepMax / CFG.creepPerPoint) * CFG.creepLate;
    const balancedSpeed = Math.min(CFG.maxSpeed, theme().base + creep);
    const speedScore = Math.max(0, state.score - (isTechnologyActive('tech-head') ? 100 : 0));
    state.speed = calculateVehicleSpeed(speedScore, balancedSpeed, VEHICLES[state.vehicle]);
    if (state.runMode === 'campaign') {
      state.campaignBoostT = Math.max(0, state.campaignBoostT - dt);
      state.campaignBoostFactor = state.campaignBoostT > 0
        ? Math.min(1, state.campaignBoostFactor + dt / 1.1)
        : Math.max(0, state.campaignBoostFactor - dt / 2.2);
      const topSpeed = VEHICLES[state.vehicle].maxSpeed || CFG.maxSpeed;
      state.speed = calculateBoostedSpeed(state.speed, topSpeed, state.campaignBoostFactor);
      updateCampaignBoostButton();
    } else {
      state.campaignBoostT = 0;
      state.campaignBoostFactor = 0;
    }

    state.score += dt * 12; // survival points
    updateHud();
    updatePowerHud();

    // power-up timers (simulation time)
    state.magnetT = Math.max(0, state.magnetT - dt);
    const slowTimers = advanceSlowTimer(state.slowT, state.slowRecoveryT, dt, CFG.slowRecoveryDur);
    state.slowT = slowTimers.slowT;
    state.slowRecoveryT = slowTimers.recoveryT;
    state.shieldInvuln = Math.max(0, state.shieldInvuln - dt);
    state.falconPhaseT = Math.max(0, state.falconPhaseT - dt);
    if (VEHICLES[state.vehicle].perk === 'cloak') {
      if (state.mirageCloakT > 0) state.mirageCloakT = Math.max(0, state.mirageCloakT - dt);
      else {
        state.mirageCooldownT -= dt;
        if (state.mirageCooldownT <= 0) {
          state.mirageCloakT = 2.5;
          state.mirageCooldownT = 20;
          addText(state.player.x, playerY() - 18, 'MIRAGE CLOAK', '#a8c7ff');
        }
      }
    } else {
      state.mirageCloakT = 0;
    }
    if (VEHICLES[state.vehicle].perk === 'laser') {
      state.fighterAbilityT -= dt;
      if (state.fighterAbilityT <= 0) {
        state.laserCharge = 1;
        state.fighterAbilityT = 12;
        addText(state.player.x, playerY() - 18, 'TEMPEST LASER READY', COLORS.laser);
      }
    }
    updateAbilityButton();

    if (state.runMode === 'campaign') {
      const campaignTier = state.campaignTier;
      const bossRequirement = getCampaignRunRequirement(campaignTier, state.selectedCampaign, state.campaignWave);
      if (!state.boss && state.score >= bossRequirement) {
        const supreme = state.campaignWave === CAMPAIGN_WAVES_PER_WORLD - 1;
        const health = getCampaignBossHealth(campaignTier, state.selectedCampaign, state.campaignWave, supreme);
        state.boss = { health, maxHealth: health, attackT: 2, flash: 0, stage: state.campaignStage, supreme };
        bossHudEl.firstElementChild.textContent = supreme ? 'SUPREME MONSTER' : 'GUARDIAN';
        bossHudEl.classList.remove('visible');
        showBanner(supreme ? 'SUPREME MONSTER INCOMING' : 'GUARDIAN INCOMING',
          supreme ? state.selectedCampaign === LEVELS.length - 1 ? 'THE STAR EATER' : LEVELS[state.selectedCampaign].name + ' SUPREME' : LEVELS[state.selectedCampaign].name);
        updateHud();
        Sound.levelUp();
      }
      if (state.boss) {
        state.boss.attackT -= dt;
        state.boss.flash = Math.max(0, state.boss.flash - dt);
        if (state.boss.attackT <= 0) {
          const lane = randInt(LANES);
          state.obstacles.push({ lane, y: -obstacleH(), h: obstacleH(), bossShot: true });
          const safeLane = [0, 1, 2].filter((candidate) => candidate !== lane)[randInt(2)];
          state.gems.push({ x: laneCenter(safeLane), lane: safeLane, y: -obstacleH() * 1.2, phase: Math.random() * Math.PI * 2 });
          state.boss.attackT = Math.max(1.25, 2.8 - campaignTier * 0.18 - state.campaignWave * 0.14);
        }
        bossHealthEl.style.width = (state.boss.health / state.boss.maxHealth * 100) + '%';
        bossHudEl.setAttribute('aria-label', 'Boss health ' + state.boss.health + ' of ' + state.boss.maxHealth);
      }
    }

    // lane transition (vehicle-specific speed)
    const p = state.player;
    const laneTime = VEHICLES[state.vehicle].laneTime;
    p.t = Math.min(1, p.t + dt / laneTime);
    const e = 1 - Math.pow(1 - p.t, 3); // ease-out cubic
    p.x = lerp(p.fromX, p.toX, e);

    const eff = effectiveSpeed();

    // spawn rows based on distance travelled (slow-mo included)
    state.nextSpawnY -= eff * dt;
    const minGap = CFG.minRowGap + eff * CFG.rowGapSpeedFactor;
    if (state.nextSpawnY <= 0) {
      spawnRow();
      state.nextSpawnY = minGap;
    }

    const py = playerY();
    const pw = playerSize();
    const px = p.x - pw / 2;

    // starfield drift
    if (theme().stars) {
      for (const s of state.stars) {
        s.y += eff * 0.12 * s.v * dt;
        if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
      }
    }

    // combo trail: gold sparks behind the ship while the chain is alive
    if (state.combo >= 3 && Math.random() < 0.55) {
      state.particles.push({
        x: p.x + (Math.random() - 0.5) * 12,
        y: py + pw,
        vx: (Math.random() - 0.5) * 40,
        vy: 100 + Math.random() * 80,
        life: 0.5, maxLife: 0.5,
        size: 1.5 + Math.random() * 2.5,
        color: COLORS.gem,
      });
    }
    if (state.owned['active-move'] && Math.random() < 0.45) {
      state.particles.push({
        x: p.x + (Math.random() - 0.5) * 10, y: py + pw,
        vx: (Math.random() - 0.5) * 24, vy: 90 + Math.random() * 60,
        life: 0.35, maxLife: 0.35, size: 2 + Math.random() * 2,
        color: state.owned['active-move'] === 'phase' ? '#c7a9ff' : '#ff986d',
      });
    }

    // Twin Laser acquires the two closest hazards, even when they occupy different lanes.
    if (state.laserCharge > 0) {
      const twinLaser = !!state.owned['up-laser2'];
      const targets = selectLaserTargets(state.obstacles, p.lane, py, twinLaser);
      if (targets.length) {
        state.laserCharge = 0;
        state.stats.lasers++;
        for (const target of targets) {
          const idx = state.obstacles.indexOf(target);
          if (idx >= 0) state.obstacles.splice(idx, 1);
          state.score += CFG.laserScore;
          emitBurst(laneCenter(target.lane), target.y + target.h / 2, COLORS.laser, 16, 300);
        }
        addText(p.x, py - 14, '+' + (CFG.laserScore * targets.length) + ' LASER', COLORS.laser);
        state.laserFx = {
          targets: targets.map((target) => ({ lane: target.lane, y: target.y + target.h / 2 })),
          t: 0.3,
        };
        Sound.laser();
        updateHud();
        updatePowerHud();
      }
    }

    // obstacles
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const o = state.obstacles[i];
      o.y += eff * dt;
      const ow = obstacleW();
      const ox = laneCenter(o.lane) - ow / 2;
      const oh = o.h;
      if (state.shieldInvuln <= 0 && state.falconPhaseT <= 0 && state.mirageCloakT <= 0 &&
        px < ox + ow && px + pw > ox && py < o.y + oh && py + pw > o.y) {
        if (state.shield) {
          // absorb the hit: destroy obstacle, brief immunity (Shield 2.0 soaks 2)
          state.shieldHP--;
          if (state.shieldHP <= 0) state.shield = false;
          state.shieldInvuln = CFG.shieldImmunity;
          emitBurst(state.player.x, py + pw / 2, COLORS.shield, 26, 300);
          emitBurst(laneCenter(o.lane), o.y + oh / 2, COLORS.obstacle, 18, 260);
          state.obstacles.splice(i, 1);
          Sound.shieldBreak();
          updatePowerHud();
          continue;
        }
        gameOver();
        return;
      }
      // near-miss: obstacle reaches the player's row in the lane the player just left
      if (!o.passed && o.y + oh >= py) {
        o.passed = true;
        if (o.nm && (state.time - o.nmT) <= CFG.nearMissWindow) {
          const shipClear = p.x <= ox - 2 || p.x >= ox + ow + 2;
          if (shipClear) {
            const nearMissBonus = Math.round(CFG.nearMissBonus * (VEHICLES[state.vehicle].perk === 'precision' ? 1.5 : 1));
            state.score += nearMissBonus;
            state.nearMisses++;
            state.shake = Math.max(state.shake, 2.5);
            addText(laneCenter(o.lane), py - 14, 'NEAR MISS +' + nearMissBonus, '#ffffff');
            Sound.nearMiss();
            updateHud();
          }
        }
      }
      if (o.y > H + laneWidth()) state.obstacles.splice(i, 1);
    }

    // gems (magnet pulls them toward the player)
    for (let i = state.gems.length - 1; i >= 0; i--) {
      const g = state.gems[i];
      g.y += eff * dt;
      g.phase += dt * 5;
      const collector = isTechnologyActive('tech-collector');
      const radar = isTechnologyActive('tech-radar');
      const passiveMagnet = VEHICLES[state.vehicle].perk === 'magnet' || VEHICLES[state.vehicle].perk === 'drone';
      if (state.magnetT > 0 || passiveMagnet || g.y < py + pw) {
        g.x = updateGemX(g.x, p.x, laneCenter(g.lane), dt, {
          magnetActive: state.magnetT > 0,
          passiveMagnet,
          strongMagnet: VEHICLES[state.vehicle].perk === 'drone',
          autoCollector: collector,
          gemRadar: radar,
          laneWidth: laneWidth(),
        });
      } else {
        g.x += (laneCenter(g.lane) - g.x) * Math.min(1, dt * 2);
      }
      const gr = gemR();
      const pickupR = state.magnetT > 0
        ? pw * 1.1
        : passiveMagnet ? pw * 0.85
        : collector ? pw * 1.45 : pw * 0.55;
      const d = Math.hypot(g.x - p.x, g.y - (py + pw / 2));
      if (d < gr + pickupR) {
        const prevMult = comboMultiplier();
        const gemValue = getGemPickupValue(state.vehicle, effectiveSpeed(), VEHICLES[state.vehicle].maxSpeed || Infinity);
        state.combo++;
        state.stats.gems += gemValue;
        state.stats.bestCombo = Math.max(state.stats.bestCombo, state.combo);
        const mult = comboMultiplier();
        const scoreBonus = VEHICLES[state.vehicle].perk === 'score' ? 1.25 : 1;
        const techBonus = isTechnologyActive('tech-score') ? 1.15 : 1;
        const pts = Math.round(25 * mult * gemValue * scoreBonus * techBonus);
        state.score += pts;
        addText(g.x, g.y - 10, (gemValue > 1 ? 'GEM x' + gemValue + ' · ' : '') + '+' + pts, COLORS.gem);
        if (state.boss) {
          state.boss.health -= gemValue;
          state.boss.flash = 0.18;
          if (state.boss.health <= 0 && defeatBoss()) return;
        }
        if (mult > prevMult) {
          Sound.comboTier();
          addText(g.x, g.y - 34, 'COMBO x' + mult, '#ffffff');
          state.tierFx = { t: 0.5, max: 0.5 };
          // chip glow flash on every new combo tier
          if (chipCombo.animate) chipCombo.animate([
            { boxShadow: '0 0 0px rgba(255, 204, 85, 0)' },
            { boxShadow: '0 0 22px rgba(255, 204, 85, 0.95)' },
            { boxShadow: '0 0 0px rgba(255, 204, 85, 0)' },
          ], { duration: 650, easing: 'ease-out' });
          if (mult % 10 === 0) {
            // milestone: keep the glow + fireworks around the ship
            state.fxGlow = 1;
            state.tierFx = { t: 0.8, max: 0.8 };
            const sx = state.player.x, sy = playerY();
            const palette = [COLORS.gem, '#ffffff', '#7fd0ff', '#ff8fd0'];
            for (let k = 0; k < 6; k++) {
              state.fireworksQ.push({
                t: 0.06 + k * 0.11,
                x: clamp(sx + (Math.random() - 0.5) * Math.min(240, W * 0.6), 20, W - 20),
                y: clamp(sy - 50 - Math.random() * 250, 60, H - 160),
                color: palette[k % 4],
                n: 16 + Math.floor(Math.random() * 10),
                spd: 240 + Math.random() * 110,
              });
            }
            if (chipCombo.animate) chipCombo.animate([{ transform: 'scale(1.45)' }, { transform: 'scale(1)' }], { duration: 340, easing: 'ease-out' });
          }
        }
        updateHud();
        updatePowerHud();
        if (chipCombo.animate) chipCombo.animate([{ transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
        Sound.gem();
        emitBurst(g.x, g.y, COLORS.gem, 10, 180);
        state.gems.splice(i, 1);
        continue;
      }
      if (g.y > H + 40) {
        state.gems.splice(i, 1);
        if (state.boss) {
              state.boss.health = Math.min(state.boss.maxHealth, state.boss.health + 1);
          bossHealthEl.style.width = (state.boss.health / state.boss.maxHealth * 100) + '%';
              updateHud();
        }
        if (state.combo > 0) {
          if (state.combo >= 3) addText(W / 2, 170, 'COMBO LOST', '#8d8aa6');
          state.combo = 0;
          updatePowerHud();
        }
        continue;
      }
    }

    // power-ups
    for (let i = state.powerups.length - 1; i >= 0; i--) {
      const pu = state.powerups[i];
      pu.y += eff * dt;
      pu.phase += dt * 4;
      const gr = gemR() * 1.1;
      const cx = laneCenter(pu.lane);
      const d = Math.hypot(cx - p.x, pu.y - (py + pw / 2));
      if (d < gr + pw * 0.6) {
        const automatic = state.powerupAuto[pu.type] !== false;
        if (!automatic && state.manualPowerups.filter((type) => type === pu.type).length >= 2) continue;
        if (automatic) applyPowerup(pu.type);
        else state.manualPowerups = storeManualPowerup(state.manualPowerups, pu.type, 2);
        const col = pu.type === 'shield' ? COLORS.shield : pu.type === 'magnet' ? COLORS.magnet : pu.type === 'slow' ? COLORS.slow : COLORS.laser;
        emitBurst(cx, pu.y, col, 14, 200);
        Sound.power();
        updatePowerHud();
        state.powerups.splice(i, 1);
        continue;
      }
      if (pu.y > H + 40) state.powerups.splice(i, 1);
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 500 * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  }

  /* =====================================================
     Render
  ===================================================== */
  let bgScroll = 0;

  function drawAlienShip(enemy, scenarioIndex, color) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,.82)';
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = enemy.role === 'kamikaze' ? 20 : 13;
    ctx.beginPath();
    if (enemy.role === 'kamikaze') {
      ctx.moveTo(0, 20); ctx.lineTo(9, 3); ctx.lineTo(19, -4); ctx.lineTo(7, -3);
      ctx.lineTo(4, -15); ctx.lineTo(0, -8); ctx.lineTo(-4, -15); ctx.lineTo(-7, -3);
      ctx.lineTo(-19, -4); ctx.lineTo(-9, 3);
    } else if (enemy.role === 'gunship') {
      ctx.moveTo(-25, -5); ctx.lineTo(-14, -2); ctx.lineTo(-8, -15); ctx.lineTo(0, -9);
      ctx.lineTo(8, -15); ctx.lineTo(14, -2); ctx.lineTo(25, -5); ctx.lineTo(17, 7);
      ctx.lineTo(9, 5); ctx.lineTo(0, 17); ctx.lineTo(-9, 5); ctx.lineTo(-17, 7);
    } else if (scenarioIndex === 0) {
      ctx.moveTo(-20, -1); ctx.quadraticCurveTo(-17, -12, -6, -8); ctx.lineTo(0, -15);
      ctx.lineTo(6, -8); ctx.quadraticCurveTo(17, -12, 20, -1); ctx.lineTo(12, 5);
      ctx.lineTo(8, 14); ctx.lineTo(0, 10); ctx.lineTo(-8, 14); ctx.lineTo(-12, 5);
    } else if (scenarioIndex === 1) {
      ctx.moveTo(-18, -8); ctx.lineTo(-8, -13); ctx.lineTo(-4, -7); ctx.lineTo(4, -7);
      ctx.lineTo(8, -13); ctx.lineTo(18, -8); ctx.lineTo(13, 0); ctx.lineTo(17, 11);
      ctx.lineTo(7, 8); ctx.lineTo(0, 16); ctx.lineTo(-7, 8); ctx.lineTo(-17, 11); ctx.lineTo(-13, 0);
    } else if (scenarioIndex === 2) {
      ctx.moveTo(-23, -5); ctx.quadraticCurveTo(-7, -18, 8, -11); ctx.lineTo(22, -15);
      ctx.lineTo(14, -3); ctx.lineTo(23, 8); ctx.lineTo(6, 6); ctx.lineTo(0, 16);
      ctx.lineTo(-5, 6); ctx.lineTo(-22, 9); ctx.lineTo(-13, -2);
    } else if (scenarioIndex === 3) {
      ctx.moveTo(0, -18); ctx.lineTo(7, -8); ctx.lineTo(19, -11); ctx.lineTo(13, 0);
      ctx.lineTo(19, 11); ctx.lineTo(6, 8); ctx.lineTo(0, 18); ctx.lineTo(-6, 8);
      ctx.lineTo(-19, 11); ctx.lineTo(-13, 0); ctx.lineTo(-19, -11); ctx.lineTo(-7, -8);
    } else {
      ctx.moveTo(0, -16); ctx.bezierCurveTo(14, -18, 17, -5, 13, 2); ctx.lineTo(21, 12);
      ctx.lineTo(8, 9); ctx.lineTo(0, 17); ctx.lineTo(-8, 9); ctx.lineTo(-21, 12);
      ctx.lineTo(-13, 2); ctx.bezierCurveTo(-17, -5, -14, -18, 0, -16);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.48)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    if (enemy.role === 'gunship') {
      ctx.moveTo(-17, -3); ctx.lineTo(-7, 1); ctx.lineTo(-4, 9);
      ctx.moveTo(17, -3); ctx.lineTo(7, 1); ctx.lineTo(4, 9);
    } else {
      ctx.moveTo(-12, -3); ctx.lineTo(-4, 1); ctx.lineTo(0, 9);
      ctx.moveTo(12, -3); ctx.lineTo(4, 1);
    }
    ctx.stroke();
    ctx.fillStyle = '#fff4db';
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.ellipse(0, 0, enemy.role === 'gunship' ? 4.5 : 3.2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawWarPickup(pickup, color) {
    ctx.save();
    ctx.translate(pickup.x, pickup.y);
    ctx.shadowColor = color;
    if (pickup.type === 'gem') {
      ctx.shadowBlur = 20;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#fff0a8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(8, -8); ctx.lineTo(12, -2);
      ctx.lineTo(0, 13); ctx.lineTo(-12, -2); ctx.lineTo(-8, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, -8); ctx.lineTo(8, -8); ctx.lineTo(0, 13);
      ctx.moveTo(-12, -2); ctx.lineTo(12, -2);
      ctx.moveTo(0, -13); ctx.lineTo(0, 13);
      ctx.stroke();
      ctx.fillStyle = '#fff8d8';
      ctx.beginPath();
      ctx.moveTo(-5, -7); ctx.lineTo(0, -10); ctx.lineTo(-2, -3);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = color + '2e';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(12, -7); ctx.lineTo(12, 7);
      ctx.lineTo(0, 14); ctx.lineTo(-12, 7); ctx.lineTo(-12, -7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff';
      ctx.fillStyle = '#fff';
      ctx.lineWidth = 1.8;
      if (pickup.type === 'shield') {
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(7, -5); ctx.lineTo(6, 2);
        ctx.lineTo(0, 8); ctx.lineTo(-6, 2); ctx.lineTo(-7, -5);
        ctx.closePath(); ctx.stroke();
      } else if (pickup.type === 'rapid') {
        ctx.beginPath();
        ctx.moveTo(2, -9); ctx.lineTo(-5, 1); ctx.lineTo(0, 1);
        ctx.lineTo(-2, 9); ctx.lineTo(6, -2); ctx.lineTo(1, -2);
        ctx.closePath(); ctx.fill();
      } else if (pickup.type === 'spread') {
        for (const x of [-6, 0, 6]) {
          ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, -3); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, -5, 1.8, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', 0, 1);
      }
    }
    ctx.restore();
  }

  function renderWarScene() {
    const mission = getWarMission(state.warMission);
    const scenario = WAR_SCENARIOS[mission.scenarioIndex];
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#080b1b');
    gradient.addColorStop(0.52, '#10172b');
    gradient.addColorStop(1, '#070914');
    ctx.fillStyle = gradient;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    const nebula = ctx.createRadialGradient(W * 0.72, H * 0.28, 8, W * 0.72, H * 0.28, W * 0.7);
    nebula.addColorStop(0, scenario.tint);
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(226,241,255,.72)';
    for (const star of state.stars) {
      ctx.globalAlpha = 0.25 + star.v * 0.5;
      ctx.fillRect(star.x, star.y, star.s, star.s);
    }
    ctx.globalAlpha = 1;
    for (let index = 0; index < 5; index++) {
      const x = (index * 0.29 + 0.08) * W;
      const y = H * (0.13 + (index % 2) * 0.18);
      const radius = 18 + (index % 3) * 12;
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = scenario.accent;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(155,188,230,.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 74) {
      ctx.beginPath();
      ctx.moveTo(0, y + (state.warTime * 24 % 74));
      ctx.lineTo(W, y + (state.warTime * 24 % 74));
      ctx.stroke();
    }
    for (const shot of state.warPlayerShots) {
      ctx.save();
      const weaponColor = shot.weapon === 'pulse' ? '#fff1a8'
        : shot.weapon === 'spread' ? '#d9a8ff' : scenario.accent;
      ctx.strokeStyle = weaponColor;
      ctx.fillStyle = weaponColor;
      ctx.lineWidth = shot.weapon === 'pulse' ? 5 : 3;
      ctx.shadowColor = weaponColor;
      ctx.shadowBlur = shot.weapon === 'pulse' ? 18 : 12;
      if (shot.weapon === 'pulse') {
        ctx.beginPath();
        ctx.moveTo(shot.x, shot.y - 11);
        ctx.lineTo(shot.x + 5, shot.y);
        ctx.lineTo(shot.x, shot.y + 11);
        ctx.lineTo(shot.x - 5, shot.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(shot.x, shot.y + 10);
        ctx.lineTo(shot.x, shot.y - 8);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const shot of state.warEnemyShots) {
      ctx.save();
      const color = WAR_PROJECTILE_COLORS[shot.weapon] || WAR_PROJECTILE_COLORS.bolt;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#fff4dd';
      ctx.shadowColor = color;
      ctx.shadowBlur = shot.weapon === 'lance' ? 18 : 12;
      ctx.beginPath();
      if (shot.weapon === 'lance' || shot.weapon === 'shard') {
        ctx.moveTo(shot.x, shot.y - 8);
        ctx.lineTo(shot.x + 4, shot.y);
        ctx.lineTo(shot.x, shot.y + 8);
        ctx.lineTo(shot.x - 4, shot.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.arc(shot.x, shot.y, shot.weapon === 'orb' ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        if (shot.weapon === 'plasma' || shot.weapon === 'flare') {
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.arc(shot.x, shot.y, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    for (const pickup of state.warPickups) {
      const colors = { gem: COLORS.gem, shield: COLORS.shield, rapid: '#ff986d', spread: '#d7a5ff', life: '#ff7885' };
      drawWarPickup(pickup, colors[pickup.type]);
    }
    for (const enemy of state.warEnemies) {
      const color = enemy.role === 'gunship' ? '#ffb375' : enemy.role === 'kamikaze' ? '#ff607b' : scenario.accent;
      drawAlienShip(enemy, mission.scenarioIndex, color);
    }
    if (state.warBoss) {
      const boss = state.warBoss;
      const bx = W / 2 + Math.sin(boss.phase * (1 + mission.scenarioIndex * 0.12)) * W * 0.3;
      const by = 135 + Math.sin(boss.phase * 1.7) * 22;
      const color = scenario.accent;
      const size = Math.min(W * 0.28, 106);
      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = boss.flash > 0 ? '#fff' : scenario.tint.replace(/[\d.]+\)$/, '.95)');
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 28;
      ctx.beginPath();
      if (mission.scenarioIndex === 0) {
        ctx.moveTo(0, -size); ctx.lineTo(size * .8, -size * .2); ctx.lineTo(size, size * .35);
        ctx.lineTo(size * .32, size * .18); ctx.lineTo(0, size); ctx.lineTo(-size * .32, size * .18);
        ctx.lineTo(-size, size * .35); ctx.lineTo(-size * .8, -size * .2);
      } else if (mission.scenarioIndex === 1) {
        ctx.moveTo(-size, -size * .35); ctx.lineTo(-size * .35, -size * .18); ctx.lineTo(0, -size);
        ctx.lineTo(size * .35, -size * .18); ctx.lineTo(size, -size * .35); ctx.lineTo(size * .7, size * .42);
        ctx.lineTo(0, size); ctx.lineTo(-size * .7, size * .42);
      } else if (mission.scenarioIndex === 2) {
        ctx.moveTo(-size, 0); ctx.lineTo(-size * .25, -size * .55); ctx.lineTo(0, -size);
        ctx.lineTo(size * .25, -size * .55); ctx.lineTo(size, 0); ctx.lineTo(size * .2, size * .25);
        ctx.lineTo(0, size); ctx.lineTo(-size * .2, size * .25);
      } else if (mission.scenarioIndex === 3) {
        ctx.moveTo(0, -size); ctx.lineTo(size * .5, -size * .6); ctx.lineTo(size, 0);
        ctx.lineTo(size * .45, size * .28); ctx.lineTo(0, size); ctx.lineTo(-size * .45, size * .28);
        ctx.lineTo(-size, 0); ctx.lineTo(-size * .5, -size * .6);
      } else {
        ctx.moveTo(0, -size); ctx.lineTo(size * .45, -size * .3); ctx.lineTo(size, -size * .6);
        ctx.lineTo(size * .7, size * .45); ctx.lineTo(0, size); ctx.lineTo(-size * .7, size * .45);
        ctx.lineTo(-size, -size * .6); ctx.lineTo(-size * .45, -size * .3);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.rotate(boss.phase * 0.16);
      ctx.strokeStyle = 'rgba(255,255,255,.48)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-size * 0.72, -size * 0.08);
      ctx.lineTo(-size * 0.24, size * 0.14);
      ctx.lineTo(0, -size * 0.26);
      ctx.lineTo(size * 0.24, size * 0.14);
      ctx.lineTo(size * 0.72, -size * 0.08);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.35, size * 0.58, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = color;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, size * (.16 + Math.sin(boss.phase * 4) * .025), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.17)';
      ctx.fillRect(W * .22, 196, W * .56, 7);
      ctx.fillStyle = color;
      ctx.fillRect(W * .22, 196, W * .56 * (boss.hp / boss.maxHp), 7);
    }
    const playerImage = shipImages[state.vehicle];
    const flicker = state.warInvulnT > 0 && Math.floor(state.warTime * 18) % 2 === 0;
    if (state.mode !== 'gameover') {
      ctx.save();
      ctx.globalAlpha = flicker ? 0.38 : 1;
      if (state.warExiting) {
        const flame = 0.9 + Math.sin(performance.now() * 0.025) * 0.1;
        const flameGradient = ctx.createLinearGradient(state.player.x, state.player.y + 16, state.player.x, state.player.y + 108 * flame);
        flameGradient.addColorStop(0, '#fff8c4');
        flameGradient.addColorStop(0.2, '#ffdb69');
        flameGradient.addColorStop(0.58, '#ff704d');
        flameGradient.addColorStop(1, 'rgba(255,76,108,0)');
        ctx.fillStyle = flameGradient;
        ctx.shadowColor = '#ff8b57';
        ctx.shadowBlur = 32;
        ctx.beginPath();
        ctx.moveTo(state.player.x - 6, state.player.y + 20);
        ctx.quadraticCurveTo(state.player.x - 24, state.player.y + 58, state.player.x, state.player.y + 108 * flame);
        ctx.quadraticCurveTo(state.player.x + 24, state.player.y + 58, state.player.x + 6, state.player.y + 20);
        ctx.closePath();
        ctx.fill();
      }
      ctx.shadowColor = state.owned['active-glow'] === 'prism' ? '#c08cff'
        : state.owned['active-glow'] === 'ember' ? '#ff986d' : scenario.accent;
      ctx.shadowBlur = state.warPower.shield ? 28 : state.owned['active-glow'] ? 32 : 17;
      if (playerImage.complete && playerImage.naturalWidth > 0) {
        ctx.drawImage(playerImage, state.player.x - 26, state.player.y - 34, 52, 68);
      }
      ctx.restore();
    }
    if (state.warPower.shield) {
      ctx.strokeStyle = 'rgba(143,211,255,.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, 39, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
    if (state.paused) {
      ctx.fillStyle = 'rgba(5,5,12,.45)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function render() {
    const t = theme();

    ctx.save();
    if (state.shakeX !== 0 || state.shakeY !== 0) {
      ctx.translate(state.shakeX, state.shakeY);
    }

    // Theme-specific original vector artwork is drawn behind the live effects.
    ctx.fillStyle = t.bg;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    const worldImage = worldImages[t.art];
    if (worldImage.complete && worldImage.naturalWidth > 0) {
      ctx.drawImage(worldImage, 0, 0, W, H);
    }
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, t.bgTop);
    bg.addColorStop(1, t.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    if (state.runMode === 'war') {
      renderWarScene();
      ctx.restore();
      return;
    }

    // starfield (space themes)
    if (t.stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const s of state.stars) {
        ctx.globalAlpha = 0.2 + s.v * 0.4;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // moving grid floor
    ctx.strokeStyle = t.grid;
    ctx.lineWidth = 1;
    const grid = 90;
    const off = (bgScroll * 0.35) % grid;
    ctx.beginPath();
    for (let y = -grid; y < H + grid; y += grid) {
      ctx.moveTo(0, y + off);
      ctx.lineTo(W, y + off);
    }
    for (let x = 0; x <= W; x += grid) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    ctx.stroke();

    // lane dividers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i < LANES; i++) {
      ctx.moveTo(laneWidth() * i, 0);
      ctx.lineTo(laneWidth() * i, H);
    }
    ctx.stroke();

    if (state.mode !== 'menu') {
      if (state.boss) {
        const bx = W / 2;
        const by = H * 0.22 + Math.sin(state.time * 2.4) * 8;
        const bw = Math.min(W * 0.46, 190);
        const bh = bw * 0.48;
        const bossColor = ['#ff5c93', '#ff9b57', '#b285ff', '#94ef86', '#d9e6ff'][state.boss.stage];
        ctx.save();
        ctx.translate(bx, by);
        ctx.shadowColor = state.boss.flash > 0 ? '#ffffff' : bossColor;
        ctx.shadowBlur = state.boss.flash > 0 ? 34 : 22;
        ctx.fillStyle = state.boss.flash > 0 ? '#fff1f7' : '#732553';
        ctx.strokeStyle = bossColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -bh * 0.62);
        ctx.lineTo(bw * 0.19, -bh * 0.18);
        ctx.lineTo(bw * 0.5, bh * 0.16);
        ctx.lineTo(bw * 0.18, bh * 0.28);
        ctx.lineTo(0, bh * 0.55);
        ctx.lineTo(-bw * 0.18, bh * 0.28);
        ctx.lineTo(-bw * 0.5, bh * 0.16);
        ctx.lineTo(-bw * 0.19, -bh * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = bossColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, bw * 0.12, bh * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // gems
      for (const g of state.gems) {
        const r = gemR() * (1 + Math.sin(g.phase) * 0.12);
        ctx.save();
        ctx.shadowColor = COLORS.gemGlow;
        ctx.shadowBlur = 24;
        // brilliant-cut body: crown + pavilion
        ctx.fillStyle = COLORS.gem;
        ctx.beginPath();
        ctx.moveTo(g.x - r * 0.72, g.y - r * 0.62);
        ctx.lineTo(g.x + r * 0.72, g.y - r * 0.62);
        ctx.lineTo(g.x + r, g.y + r * 0.08);
        ctx.lineTo(g.x, g.y + r);
        ctx.lineTo(g.x - r, g.y + r * 0.08);
        ctx.closePath();
        ctx.fill();
        // facets
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(g.x - r, g.y + r * 0.08); ctx.lineTo(g.x + r, g.y + r * 0.08);
        ctx.moveTo(g.x - r * 0.72, g.y - r * 0.62); ctx.lineTo(g.x - r * 0.3, g.y + r * 0.08);
        ctx.moveTo(g.x + r * 0.72, g.y - r * 0.62); ctx.lineTo(g.x + r * 0.3, g.y + r * 0.08);
        ctx.moveTo(g.x, g.y + r); ctx.lineTo(g.x - r * 0.3, g.y + r * 0.08);
        ctx.moveTo(g.x, g.y + r); ctx.lineTo(g.x + r * 0.3, g.y + r * 0.08);
        ctx.stroke();
        // twinkle sparkle
        const tw = 0.5 + Math.sin(g.phase * 2.3) * 0.5;
        ctx.globalAlpha = 0.35 + tw * 0.65;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(g.x - r * 0.18, g.y - r * 0.35); ctx.lineTo(g.x + r * 0.18, g.y - r * 0.35);
        ctx.moveTo(g.x, g.y - r * 0.53); ctx.lineTo(g.x, g.y - r * 0.17);
        ctx.stroke();
        ctx.restore();
      }
      if (state.rocketFx) {
        const fx = state.rocketFx;
        const alpha = clamp(fx.t / 0.32, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = '#ffbe76';
        ctx.shadowBlur = 22;
        ctx.strokeStyle = '#ffbe76';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.targetX, fx.targetY);
        ctx.stroke();
        ctx.strokeStyle = '#fff6e8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.targetX, fx.targetY);
        ctx.stroke();
        ctx.restore();
      }

      // power-ups
      for (const pu of state.powerups) {
        const cx = laneCenter(pu.lane);
        const r = gemR() * 1.05 * (1 + Math.sin(pu.phase) * 0.1);
        const col = pu.type === 'shield' ? COLORS.shield : pu.type === 'magnet' ? COLORS.magnet : pu.type === 'slow' ? COLORS.slow : COLORS.laser;
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = 26;
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = Math.max(3, r * 0.32);
        ctx.lineCap = 'round';
        if (pu.type === 'shield') {
          // hexagon shield
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = -Math.PI / 2 + (k * Math.PI) / 3;
            const x = cx + Math.cos(a) * r, y = pu.y + Math.sin(a) * r;
            k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.globalAlpha = 0.25;
          ctx.fill();
        } else if (pu.type === 'magnet') {
          // horseshoe magnet
          ctx.beginPath();
          ctx.arc(cx, pu.y - r * 0.15, r * 0.75, Math.PI, 0, false);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.75, pu.y - r * 0.15);
          ctx.lineTo(cx - r * 0.75, pu.y + r * 0.55);
          ctx.moveTo(cx + r * 0.75, pu.y - r * 0.15);
          ctx.lineTo(cx + r * 0.75, pu.y + r * 0.55);
          ctx.stroke();
        } else if (pu.type === 'laser') {
          // lightning bolt
          ctx.beginPath();
          ctx.moveTo(cx + r * 0.25, pu.y - r);
          ctx.lineTo(cx - r * 0.45, pu.y + r * 0.15);
          ctx.lineTo(cx - r * 0.02, pu.y + r * 0.15);
          ctx.lineTo(cx - r * 0.25, pu.y + r);
          ctx.lineTo(cx + r * 0.45, pu.y - r * 0.15);
          ctx.lineTo(cx + r * 0.02, pu.y - r * 0.15);
          ctx.closePath();
          ctx.stroke();
          ctx.globalAlpha = 0.25;
          ctx.fill();
        } else {
          // hourglass
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.7, pu.y - r);
          ctx.lineTo(cx + r * 0.7, pu.y - r);
          ctx.lineTo(cx - r * 0.7, pu.y + r);
          ctx.lineTo(cx + r * 0.7, pu.y + r);
          ctx.closePath();
          ctx.stroke();
          ctx.globalAlpha = 0.25;
          ctx.fill();
        }
        ctx.restore();
      }

      // obstacles
      for (const o of state.obstacles) {
        const ow = obstacleW();
        const oh = o.h;
        const ox = laneCenter(o.lane) - ow / 2;
        ctx.save();
        const obstacleColor = o.bossShot ? '#ff8fba' : COLORS.obstacle;
        ctx.shadowColor = o.bossShot ? 'rgba(255, 115, 173, 0.45)' : COLORS.obstacleGlow;
        ctx.shadowBlur = 30;
        ctx.fillStyle = obstacleColor;
        roundRect(ox, o.y, ow, oh, 10);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        roundRect(ox + 6, o.y + 6, ow - 12, Math.max(4, oh * 0.16), 6);
        ctx.fill();
        ctx.restore();
      }

      // Laser beams trace from the fighter to each acquired target.
      if (state.laserFx) {
        const fx = state.laserFx;
        const alpha = clamp(fx.t / 0.3, 0, 1);
        const shipY = playerY() + playerSize() * 0.4;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = COLORS.laser;
        ctx.shadowBlur = 24;
        ctx.lineCap = 'round';
        for (const target of fx.targets) {
          ctx.strokeStyle = COLORS.laser;
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(state.player.x, shipY);
          ctx.lineTo(laneCenter(target.lane), target.y);
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(state.player.x, shipY);
          ctx.lineTo(laneCenter(target.lane), target.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // combo aura (grows with the chain, boosted on milestones)
      if (state.combo >= 3 && state.mode === 'playing') {
        const ap = state.player;
        const apw = playerSize();
        const apy = playerY();
        const aura = Math.min(1, (comboMultiplier() - 1) / 12);
        const pulse = 0.78 + Math.sin(state.time * 6) * 0.22;
        const boost = state.fxGlow;
        const ar = apw * (1.15 + aura * 0.6 + boost * 0.5);
        const grad = ctx.createRadialGradient(ap.x, apy + apw / 2, apw * 0.15, ap.x, apy + apw / 2, ar);
        grad.addColorStop(0, 'rgba(255, 220, 140, ' + Math.min(0.65, (0.20 + aura * 0.18 + boost * 0.3) * pulse).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(255, 204, 85, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ap.x, apy + apw / 2, ar, 0, Math.PI * 2);
        ctx.fill();
      }

      // tier-up flash: gold glare + expanding ring from the ship
      if (state.tierFx && state.mode === 'playing') {
        const k = clamp(state.tierFx.t / state.tierFx.max, 0, 1);
        const fx = state.player.x, fy = playerY() + playerSize() / 2;
        const fr = playerSize() * (2 + (1 - k) * 9);
        const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
        grad.addColorStop(0, 'rgba(255, 240, 190, ' + (k * 0.5).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(255, 204, 85, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255, 224, 140, ' + (k * 0.65).toFixed(3) + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(fx, fy, playerSize() * (1 + (1 - k) * 6), 0, Math.PI * 2); ctx.stroke();
      }

      // Original vector fighter sprites keep the collision size independent from the artwork.
      const v = VEHICLES[state.vehicle];
      const skinCol = SKINS[state.skin] || v.color;
      const p = state.player;
      const pw = playerSize();
      const py = playerY();
      const shipImage = shipImages[state.vehicle];
      const shipX = p.x - pw * 0.62;
      const shipY = py - pw * 0.2;
      const shipW = pw * 1.24;
      const shipH = pw * 1.55;
      const phasing = state.falconPhaseT > 0 || state.mirageCloakT > 0;
      ctx.save();
      ctx.globalAlpha = phasing ? 0.58 : 1;
      ctx.shadowColor = phasing ? '#8feaff' : state.owned['active-glow'] === 'prism' ? '#c08cff' :
        state.owned['active-glow'] === 'ember' ? '#ff986d' : skinCol;
      ctx.shadowBlur = state.owned['active-glow'] ? 32 : 22;
      if (shipImage.complete && shipImage.naturalWidth > 0) {
        ctx.drawImage(shipImage, shipX, shipY, shipW, shipH);
        if (state.skin !== 'classic') {
          ctx.globalCompositeOperation = 'source-atop';
          ctx.globalAlpha = 0.42;
          ctx.fillStyle = skinCol;
          ctx.fillRect(shipX, shipY, shipW, shipH);
        }
      } else {
        ctx.fillStyle = skinCol;
        ctx.beginPath();
        ctx.moveTo(p.x, py);
        ctx.lineTo(p.x + pw / 2, py + pw);
        ctx.lineTo(p.x - pw / 2, py + pw);
        ctx.closePath();
        ctx.fill();
      }
      if (phasing) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.35 + Math.sin(state.time * 18) * 0.12;
        ctx.strokeStyle = '#9defff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#8feaff';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(p.x, py + pw * 0.55, pw * 0.78, pw * 1.02, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // shield ring
      if (state.shield || state.shieldInvuln > 0) {
        const cx = p.x, cy = py + pw / 2;
        const flicker = state.shieldInvuln > 0 ? (Math.sin(state.time * 30) > 0 ? 1 : 0.25) : 1;
        ctx.save();
        ctx.globalAlpha = (0.7 + Math.sin(state.time * 6) * 0.15) * flicker;
        ctx.strokeStyle = COLORS.shield;
        ctx.lineWidth = 3;
        ctx.shadowColor = COLORS.shield;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(cx, cy, pw * 0.85 + 6 + Math.sin(state.time * 6) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // particles
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // floating texts (score popups)
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      ctx.globalAlpha = clamp(t.life / 0.9, 0, 1);
      ctx.font = '700 14px "Satoshi", "Azeret Mono", sans-serif';
      ctx.fillStyle = t.color;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.restore();

    // crash flash
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 68, 102, ${state.flash * 0.28})`;
      ctx.fillRect(0, 0, W, H);
    }

    // slow-mo tint
    if (state.slowT > 0 && state.mode === 'playing') {
      ctx.fillStyle = 'rgba(170, 150, 255, 0.07)';
      ctx.fillRect(0, 0, W, H);
    }

    // paused dim
    if (state.paused) {
      ctx.fillStyle = 'rgba(5, 5, 12, 0.45)';
      ctx.fillRect(0, 0, W, H);
    }

    // combo edge glow (the higher the chain, the warmer the screen)
    if (state.combo > 0 && state.mode === 'playing') {
      const a = Math.min(0.35, 0.05 + comboMultiplier() * 0.006 + state.fxGlow * 0.12);
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
      vg.addColorStop(0, 'rgba(255, 204, 85, 0)');
      vg.addColorStop(1, 'rgba(255, 204, 85, ' + a.toFixed(3) + ')');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    // Horizontal speed sweep: the live needle travels left to right as speed rises.
    if (state.mode === 'playing') {
      const gaugeW = Math.min(200, Math.max(120, W * 0.46));
      const gx = W - gaugeW - 18, gy = H * 0.45;
      const needleX = gx + gaugeW * state.meterFrac;
      const frac = state.meterFrac;
      const mixc = (a, b, u) => 'rgb(' + [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * u)).join(',') + ')';
      const col = frac < 0.5 ? mixc([74, 240, 192], [255, 204, 85], frac / 0.5) : mixc([255, 204, 85], [255, 106, 106], (frac - 0.5) / 0.5);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gaugeW, gy); ctx.stroke();
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = state.meterRising ? 16 : 7;
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(needleX, gy); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1;
      for (let k = 0; k <= 4; k++) {
        const tickX = gx + gaugeW * (k / 4);
        ctx.beginPath();
        ctx.moveTo(tickX, gy - 8);
        ctx.lineTo(tickX, gy + 8);
        ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = state.meterRising ? 14 : 5;
      ctx.beginPath();
      ctx.moveTo(needleX, gy - 13);
      ctx.lineTo(needleX - 6, gy - 23);
      ctx.lineTo(needleX + 6, gy - 23);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath(); ctx.arc(needleX, gy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      const dispSpeed = effectiveSpeed().toFixed(1);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.font = '700 13px "Satoshi", "Azeret Mono", sans-serif';
      ctx.fillText(dispSpeed, gx + gaugeW, gy + 27);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
      ctx.font = '600 12px "Satoshi", "Azeret Mono", sans-serif';
      ctx.fillText('SPEED', gx, gy + 27);
      ctx.restore();
    }
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* =====================================================
     Main loop (fixed timestep)
  ===================================================== */
  loadPersistent();
  showPage(introScreen);
  if (import.meta.env.PROD) debugEl.hidden = true;
  modeChoices.forEach((button) => {
    const selected = button.dataset.mode === state.runMode;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
  modeDescriptionEl.textContent = RUN_MODES[state.runMode].description;
  playBtn.textContent = state.runMode === 'campaign' ? 'CHOOSE CAMPAIGN' : 'START FLIGHT';
  renderVehicleCards();
  updateHomeShip();
  refreshVehicleLocks();
  updateBestComboLine();
  renderGoals();
  renderMarket();
  renderProfile();
  updateHud();
  pauseBtn.style.opacity = '0';
  pauseBtn.style.pointerEvents = 'none';
  const TICK = 1 / 60;
  let last = performance.now();
  let accumulator = 0;
  let rafId = requestAnimationFrame(loop);

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    const delta = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!document.hidden) {
      accumulator += delta;
      let steps = 0;
      while (accumulator >= TICK && steps < 5) {
        update(TICK);
        accumulator -= TICK;
        steps++;
      }
      if (steps === 5) accumulator = 0;
    }
    render();
    updateDebug(now);
  }

  /* =====================================================
     Debug overlay
  ===================================================== */
  let dbgFrames = 0, dbgLast = performance.now(), dbgFps = 0, dbgFrameMs = 0;
  function updateDebug(now) {
    dbgFrames++;
    if (now - dbgLast >= 1000) {
      dbgFps = (dbgFrames * 1000) / (now - dbgLast);
      dbgFrames = 0;
      dbgLast = now;
      debugEl.textContent = 'FPS:' + dbgFps.toFixed(0) + ' ' + dbgFrameMs.toFixed(1) + 'ms';
    }
  }

  /* =====================================================
     Test hooks (deterministic stepping for automated QA)
  ===================================================== */
  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i++) update(1 / 60);
    render();
  };
  window.render_game_to_text = () => {
    return JSON.stringify({
      note: 'origin top-left, y down. player near bottom.',
      mode: state.mode,
      runMode: state.runMode,
      sprintRemaining: Math.max(0, +(SPRINT_DURATION - state.time).toFixed(1)),
      paused: state.paused,
      vehicle: state.vehicle,
      score: Math.floor(state.score),
      best: state.best,
      level: state.levelIndex + 1,
      levelName: theme().name,
      speed: Math.round(effectiveSpeed()),
      boss: state.boss ? { health: state.boss.health, maxHealth: state.boss.maxHealth } : null,
      falconPhase: +state.falconPhaseT.toFixed(2),
      slowRecovery: +state.slowRecoveryT.toFixed(2),
      player: { x: Math.round(state.player.x), y: Math.round(playerY()), lane: state.player.lane, pw: Math.round(playerSize()) },
      war: {
        mission: state.warMission + 1,
        scenario: getWarMission(state.warMission).scenarioIndex + 1,
        level: getWarMission(state.warMission).level,
        lives: state.warLives,
        lifeDropsIssued: state.warLifeDropsIssued,
        kills: state.warKills,
        enemyCount: state.warEnemies.length,
        enemyRoles: state.warEnemies.reduce((roles, enemy) => {
          roles[enemy.role] = (roles[enemy.role] || 0) + 1;
          return roles;
        }, {}),
        boss: state.warBoss ? { health: state.warBoss.hp, maxHealth: state.warBoss.maxHp } : null,
        player: { x: Math.round(state.player.x), y: Math.round(state.player.y) },
        playerShots: state.warPlayerShots.length,
        enemyShots: state.warEnemyShots.length,
        pickups: state.warPickups.map((pickup) => pickup.type),
        power: { ...state.warPower },
      },
      powerups: { shield: state.shield, magnetT: +state.magnetT.toFixed(2), slowT: +state.slowT.toFixed(2), laser: state.laserCharge, laserFx: !!state.laserFx },
      manualPowerups: state.manualPowerups.slice(),
      rockets: { ammo: state.rocketAmmo, buttonVisible: rocketBtn.classList.contains('visible'), effect: !!state.rocketFx },
      combo: state.combo,
      multiplier: comboMultiplier(),
      nearMisses: state.nearMisses,
      bestComboAll: state.bestComboAll,
      gemBank: state.gemBank,
      ownedCount: Object.keys(state.owned).length,
      skin: state.skin,
      shieldHP: state.shieldHP,
      stats: { gems: state.stats.gems, lasers: state.stats.lasers, rockets: state.stats.rockets, bestCombo: state.stats.bestCombo },
      storageOk: !!storage,
      meterFrac: +state.meterFrac.toFixed(3),
      meterRising: state.meterRising,
      meterFx: state.meterFx.length,
      tierFx: state.tierFx ? +state.tierFx.t.toFixed(2) : null,
      fxGlow: +state.fxGlow.toFixed(2),
      fireworks: state.fireworksQ.length,
      texts: state.texts.length,
      obstacles: state.obstacles.map((o) => ({ lane: o.lane, y: Math.round(o.y), h: Math.round(o.h), nm: !!o.nm, passed: !!o.passed })),
      gems: state.gems.map((g) => ({ lane: g.lane, x: Math.round(g.x), y: Math.round(g.y) })),
      pickups: state.powerups.map((p) => ({ lane: p.lane, type: p.type, y: Math.round(p.y) })),
      particles: state.particles.length,
    });
  };
  if (import.meta.env.DEV) {
    window.injectTestObstacle = (lane = state.player.lane) => {
      state.obstacles.push({ lane, y: playerY() - 180, h: obstacleH() });
    };
    window.injectTestGem = () => {
      state.gems.push({ x: state.player.x, lane: state.player.lane, y: playerY(), phase: 0 });
    };
    window.injectTestPowerup = (type = 'shield') => {
      if (!POWERUP_INFO[type]) return;
      state.powerups.push({ lane: state.player.lane, y: playerY() - 80, type, phase: 0 });
    };
    window.setTestScore = (score) => {
      state.score = Math.max(0, Number(score) || 0);
    };
  }
})();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .catch((error) => console.error('Neon Dash offline support could not be enabled.', error));
}
