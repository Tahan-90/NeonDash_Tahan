export const WAR_SCENARIOS = Object.freeze([
  { name: 'NEON FRONTIER', boss: 'THE PRISM WARDEN', art: 'neon-grid', pattern: 'line', accent: '#62e8d0', tint: 'rgba(32, 116, 113, .3)' },
  { name: 'EMBER BELT', boss: 'CINDER DREADNOUGHT', art: 'sunset-circuit', pattern: 'zigzag', accent: '#ff956f', tint: 'rgba(139, 57, 48, .34)' },
  { name: 'DEEP SPACE', boss: 'THE ABYSSAL MAW', art: 'deep-space', pattern: 'sweep', accent: '#8fa8ff', tint: 'rgba(55, 65, 147, .35)' },
  { name: 'TOXIC CORE', boss: 'VENOM OVERMIND', art: 'toxic-core', pattern: 'spiral', accent: '#adf06f', tint: 'rgba(50, 104, 48, .34)' },
  { name: 'VOID THRONE', boss: 'THE STAR EATER', art: 'void-run', pattern: 'sweep', accent: '#e0a3ff', tint: 'rgba(102, 42, 132, .38)' },
]);

export const WAR_LEVELS_PER_SCENARIO = 6;
export const WAR_TOTAL_MISSIONS = WAR_SCENARIOS.length * WAR_LEVELS_PER_SCENARIO;
export const WAR_WAVE_COUNTS = Object.freeze([3, 4, 5, 5, 6, 7]);
export const WAR_LIFE_DROPS_PER_MISSION = 2;
export const WAR_POWERUP_DROPS_PER_MISSION = 2;

export function getWarWaveCount(level) {
  return WAR_WAVE_COUNTS[Math.max(0, Math.min(WAR_LEVELS_PER_SCENARIO - 1, Math.floor(level) - 1))];
}

export function isWarLifeDropWave(wave, waveCount, dropsIssued) {
  return dropsIssued < WAR_LIFE_DROPS_PER_MISSION &&
    wave >= Math.ceil((dropsIssued + 1) * waveCount / (WAR_LIFE_DROPS_PER_MISSION + 1));
}

export function isWarPowerupDropWave(wave, waveCount, dropsIssued) {
  return dropsIssued < WAR_POWERUP_DROPS_PER_MISSION &&
    wave >= Math.ceil((dropsIssued + 1) * waveCount / (WAR_POWERUP_DROPS_PER_MISSION + 1));
}

export function isWarBossWave(mission, wave, waveCount) {
  return mission.isBoss && wave === waveCount;
}

export function getWarBossAttackPattern(scenarioIndex, attackPhase) {
  const patterns = [
    ['fan', 'radial', 'aimed'],
    ['sweep', 'fan', 'crossfire'],
    ['radial', 'spiral', 'radial'],
    ['spiral', 'crossfire', 'fan'],
    ['crossfire', 'radial', 'spiral'],
  ];
  const scenarioPatterns = patterns[Math.max(0, Math.min(patterns.length - 1, Math.floor(scenarioIndex)))];
  return scenarioPatterns[Math.max(0, Math.floor(attackPhase)) % scenarioPatterns.length];
}

export function getWarGemDropLimit(tier) {
  return Math.min(6, 2 + Math.max(0, Math.floor(tier)));
}

export function getWarMission(missionIndex) {
  const safeIndex = Math.max(0, Math.floor(missionIndex));
  const tier = Math.floor(safeIndex / WAR_TOTAL_MISSIONS);
  const localMissionIndex = safeIndex % WAR_TOTAL_MISSIONS;
  const scenarioIndex = Math.floor(localMissionIndex / WAR_LEVELS_PER_SCENARIO);
  const level = localMissionIndex % WAR_LEVELS_PER_SCENARIO + 1;
  const scenario = WAR_SCENARIOS[scenarioIndex];
  return {
    missionIndex: safeIndex,
    localMissionIndex,
    tier,
    scenarioIndex,
    level,
    isBoss: level === WAR_LEVELS_PER_SCENARIO,
    ...scenario,
    pattern: level <= 2 ? 'line' : level <= 4 ? 'zigzag' : 'sweep',
    bossPattern: scenario.pattern,
    difficulty: 1 + scenarioIndex * 0.55 + (level - 1) * 0.22 + tier * 0.8,
  };
}

export function getWarMissionReward(missionIndex, collectedGems = 0) {
  const mission = getWarMission(missionIndex);
  return 12 + mission.scenarioIndex * 6 + mission.level * 3 + mission.tier * 8 +
    (mission.isBoss ? 50 : 0) + Math.max(0, collectedGems);
}

export function isWarMissionUnlocked(missionIndex, highestUnlocked) {
  return missionIndex >= 0 && missionIndex <= highestUnlocked;
}

export function getWarBossHealth(missionIndex) {
  const mission = getWarMission(missionIndex);
  return 35 + mission.scenarioIndex * 12 + mission.level * 5 + mission.tier * 30;
}

export function buildEnemyFormation(missionIndex, width, height, waveIndex = 0) {
  const mission = getWarMission(missionIndex);
  const shipCount = Math.min(24, 12 + waveIndex * 2 + mission.scenarioIndex);
  const columns = Math.min(6, Math.ceil(Math.sqrt(shipCount * 1.5)));
  const gunshipCount = Math.min(4, Math.max(2, Math.ceil(shipCount * 0.18)));
  const kamikazeCount = gunshipCount;
  const enemies = [];
  const positions = Array.from({ length: shipCount }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const rowCount = Math.min(columns, shipCount - row * columns);
    const centeredColumn = column - (rowCount - 1) / 2;
    const stagger = row % 2 ? width * 0.035 : 0;
    const x = Math.max(18, Math.min(width - 18, width / 2 + centeredColumn * Math.min(width * 0.16, 74) + stagger));
    return { x, y: -30 - row * 42, homeX: x, homeY: 92 + row * 45 };
  });
  const roleOrder = Array.from({ length: shipCount }, (_, index) => index)
    .sort((left, right) => (left * 7 + waveIndex * 3) % shipCount - (right * 7 + waveIndex * 3) % shipCount);
  const roles = new Map();
  for (let index = 0; index < gunshipCount; index++) roles.set(roleOrder[index], 'gunship');
  for (let index = gunshipCount; index < gunshipCount + kamikazeCount; index++) roles.set(roleOrder[index], 'kamikaze');
  for (let index = 0; index < shipCount; index++) {
    const durability = mission.difficulty + waveIndex * 0.26;
    enemies.push({
      ...positions[index],
      role: roles.get(index) || 'raider',
      pattern: waveIndex % 4 === 0 ? mission.pattern : ['v', 'flank', 'helix', 'pincer'][waveIndex % 4],
      phase: index * 0.7,
      hp: 1 + Math.floor(waveIndex / 2) + Math.floor(Math.max(0, mission.difficulty - 1) / 1.8) +
        (index % 5 === 0 && durability >= 2.5 ? 1 : 0),
      fireT: Math.max(0.55, (1.3 + (index % 5) * 0.3) / Math.max(1, mission.difficulty * 0.3 + waveIndex * 0.1)),
    });
  }
  return enemies;
}
