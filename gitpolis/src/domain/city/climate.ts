import type { CityClimate, DistrictBlueprint, GitHubProfilePayload } from './types';

/**
 * Derives the city's atmospheric mood (time of day + weather) from commit
 * recency, push velocity and open-issue pressure.
 */

export function computeClimate(
  payload: GitHubProfilePayload,
  districts: DistrictBlueprint[],
  nowMs: number
): CityClimate {
  const lastActivityMs = new Date(payload.lastActivityAt || payload.user.createdAt).getTime();
  const daysSinceLast = Math.max(0, (nowMs - lastActivityMs) / (1000 * 60 * 60 * 24));
  const activeCount = districts.filter((d) => d.vitality === 'active').length;
  const totalOpenIssues = districts.reduce((s, d) => s + d.repo.openIssuesCount, 0);

  const recencyScore = Math.max(0, 100 - daysSinceLast * 1.4);
  const pushScore = Math.min(100, payload.recentPushCount * 9 + activeCount * 15);
  const vitalityScore = Math.round(Math.min(100, Math.max(12, recencyScore * 0.55 + pushScore * 0.45)));

  if (daysSinceLast <= 14 && totalOpenIssues > 45 && payload.recentPushCount >= 5) {
    return {
      mood: 'drizzle',
      label: 'Electric Drizzle • High-Velocity Sprint',
      description:
        'Heavy active development and issue turnover bring a crisp creative rain shower with warm glowing studio windows.',
      vitalityScore,
      recommendedTimeOfDay: 16.4,
      recommendedWeather: 'rain',
    };
  }

  if (daysSinceLast <= 14 || activeCount >= 3 || payload.recentPushCount >= 6) {
    return {
      mood: 'radiant',
      label: 'Radiant Daylight • Active Coding Streak',
      description:
        'Fresh commits keep construction cranes turning, avenues bustling, and sunlight warm across the skyline.',
      vitalityScore,
      recommendedTimeOfDay: 14.2,
      recommendedWeather: 'clear',
    };
  }

  if (daysSinceLast <= 95 || activeCount >= 1) {
    return {
      mood: 'breezy',
      label: 'Crisp Morning • Steady Craft',
      description:
        'Balanced, healthy momentum fills the neighborhoods with gentle morning light and steady commuter life.',
      vitalityScore,
      recommendedTimeOfDay: 10.6,
      recommendedWeather: 'clear',
    };
  }

  return {
    mood: 'twilight_mist',
    label: 'Golden Mist • Heritage Calm',
    description:
      'Quiet streets bathed in warm golden-hour mist, where seasoned codebases stand as preserved architectural landmarks.',
    vitalityScore,
    recommendedTimeOfDay: 17.6,
    recommendedWeather: 'mist',
  };
}
