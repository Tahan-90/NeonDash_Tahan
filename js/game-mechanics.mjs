export const COMBO_UNLOCKS = Object.freeze({ ghost: 27, titan: 42 });
export const SLOW_RECOVERY_SECONDS = 1.8;

export function getDailyRewardAmount(streak) {
  const rewards = [50, 75, 100, 125, 150, 200, 300];
  return rewards[(Math.max(1, streak) - 1) % rewards.length];
}

export function canClaimDailyGift(lastClaimDate, today) {
  return lastClaimDate !== today;
}

export function advanceSlowTimer(slowT, recoveryT, dt, recoveryDuration = SLOW_RECOVERY_SECONDS) {
  const nextSlowT = Math.max(0, slowT - dt);
  if (slowT > 0 && nextSlowT === 0) return { slowT: 0, recoveryT: recoveryDuration };
  return { slowT: nextSlowT, recoveryT: Math.max(0, recoveryT - dt) };
}

export function calculateSlowFactor(slowT, recoveryT, recoveryDuration = SLOW_RECOVERY_SECONDS, slowFactor = 0.45) {
  if (slowT > 0) return slowFactor;
  if (recoveryT <= 0) return 1;
  return 1 - (1 - slowFactor) * (recoveryT / recoveryDuration);
}

export function getGemPickupValue(vehicleKey, speed, maxSpeed) {
  return vehicleKey === 'ghost' && speed >= maxSpeed ? 2 : 1;
}

export function getLevelIndex(score, levels) {
  let levelIndex = 0;
  for (let i = 0; i < levels.length; i++) {
    if (score >= levels[i].at) levelIndex = i;
  }
  return levelIndex;
}

export const CAMPAIGN_WAVES_PER_WORLD = 5;
export const CAMPAIGN_WORLDS_PER_TIER = 5;
export const CAMPAIGN_STAGES_PER_TIER = CAMPAIGN_WAVES_PER_WORLD * CAMPAIGN_WORLDS_PER_TIER;

export function isCampaignTierUnlocked(completedStages, tier) {
  return Math.max(0, Math.floor(completedStages)) >=
    (Math.max(0, Math.floor(tier)) + 1) * CAMPAIGN_STAGES_PER_TIER;
}

export function getCampaignPosition(progress) {
  const completed = Math.max(0, Math.floor(progress));
  const tier = Math.floor(completed / CAMPAIGN_STAGES_PER_TIER);
  const positionInTier = completed % CAMPAIGN_STAGES_PER_TIER;
  return {
    tier,
    world: Math.floor(positionInTier / CAMPAIGN_WAVES_PER_WORLD),
    wave: positionInTier % CAMPAIGN_WAVES_PER_WORLD,
  };
}

export function getCampaignRunRequirement(tier, world, wave) {
  return 700 + Math.max(0, world) * 250 + Math.max(0, wave) * 180 + Math.max(0, tier) * 600;
}

export function getCampaignBossHealth(tier, world, wave, supreme = false) {
  return 8 + Math.max(0, world) * 5 + Math.max(0, wave) * 4 + Math.max(0, tier) * 12 + (supreme ? 50 : 0);
}

export function calculatePilotRating(equippedVehicle, vehicles, owned, activeTechnologyIds = []) {
  const baseRating = vehicles[equippedVehicle]?.rating || 100;
  const fleetBonus = Object.keys(vehicles)
    .filter((vehicle) => vehicle !== equippedVehicle && owned['fighter-' + vehicle])
    .reduce((bonus, vehicle) => bonus + Math.floor((vehicles[vehicle].rating || 100) * 0.12), 0);
  const technologyBonus = activeTechnologyIds.length * 25;
  const upgradeBonus = Object.keys(owned).filter((id) => owned[id] && (id.startsWith('up-') || id.startsWith('war-'))).length * 18;
  return baseRating + fleetBonus + technologyBonus + upgradeBonus;
}

export function getPilotRank(totalScore, combatRating) {
  if (totalScore >= 200000 && combatRating >= 600) return 'STAR MARSHAL';
  if (totalScore >= 75000 && combatRating >= 400) return 'COMMANDER';
  if (totalScore >= 25000 && combatRating >= 260) return 'ACE PILOT';
  if (totalScore >= 5000 && combatRating >= 150) return 'WING PILOT';
  return 'CADET';
}

export function selectLaserTargets(obstacles, playerLane, playerY, twinLaser) {
  return obstacles
    .filter((obstacle) => obstacle.y + obstacle.h < playerY && (twinLaser || obstacle.lane === playerLane))
    .sort((a, b) => b.y - a.y)
    .slice(0, twinLaser ? 2 : 1);
}

export function updateGemX(gemX, playerX, laneX, dt, options) {
  const pullRange = options.magnetActive
    ? Infinity
    : options.strongMagnet ? options.laneWidth * 1.65
    : (options.passiveMagnet || options.autoCollector) ? options.laneWidth * 1.25 : options.gemRadar ? options.laneWidth * 0.65 : 0;
  if (options.magnetActive || (pullRange > 0 && Math.abs(playerX - gemX) < pullRange)) {
    const pullStrength = options.magnetActive ? 4.5 : options.strongMagnet ? 3.6 : options.passiveMagnet ? 2.4 : options.autoCollector ? 3.4 : 0.9;
    return gemX + (playerX - gemX) * Math.min(1, dt * pullStrength);
  }
  return gemX + (laneX - gemX) * Math.min(1, dt * 2);
}

export function calculateVehicleSpeed(score, fallbackSpeed, vehicle) {
  if (vehicle.baseSpeed == null || vehicle.maxSpeed == null) return fallbackSpeed;
  const progress = Math.max(0, Math.min(1, score / 900));
  return Math.round(vehicle.baseSpeed + (vehicle.maxSpeed - vehicle.baseSpeed) * progress);
}

export function calculateBoostedSpeed(baseSpeed, topSpeed, boostFactor) {
  const progress = Math.max(0, Math.min(1, boostFactor));
  return Math.round(baseSpeed + (topSpeed - baseSpeed) * progress);
}

export function isVehicleUnlocked(key, bestCombo, owned) {
  if (key === 'dart') return true;
  if (key === 'ghost' || key === 'titan') return bestCombo >= COMBO_UNLOCKS[key];
  return !!owned['fighter-' + key];
}

export function storeManualPowerup(queue, type, capacity = 2) {
  if (queue.filter((storedType) => storedType === type).length >= capacity) return queue.slice();
  return [...queue, type];
}

export function consumeManualPowerup(queue, index) {
  if (!Number.isInteger(index) || index < 0 || index >= queue.length) return queue.slice();
  return queue.filter((_, queueIndex) => queueIndex !== index);
}

export function selectRocketTarget(obstacles, playerY) {
  return obstacles
    .filter((obstacle) => obstacle.y + obstacle.h < playerY)
    .sort((a, b) => b.y - a.y)[0] || null;
}

export function canClaimReward(ready, claimed) {
  return ready && !claimed;
}
