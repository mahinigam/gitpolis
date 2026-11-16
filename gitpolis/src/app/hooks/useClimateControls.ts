import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { CityBlueprint, WeatherMode } from '../../domain/city/types';
import type { CitySceneEngine } from '../../engine/CityScene';

/** Hour of day at which the HUD switches to its nocturnal glass theme. */
const NIGHT_START = 19.2;
const NIGHT_END = 6.4;

export interface ClimateController {
  timeOfDay: number;
  weather: WeatherMode;
  autoClimate: boolean;
  isNightUI: boolean;
  setTimeOfDay: (hour: number) => void;
  setWeather: (weather: WeatherMode) => void;
  resetAutoClimate: () => void;
}

/** Manual time-of-day and weather controls, with a per-profile auto default. */
export function useClimateControls(
  blueprint: CityBlueprint | null,
  engineRef: RefObject<CitySceneEngine | null>
): ClimateController {
  const [timeOfDay, setTimeOfDayState] = useState(
    () => blueprint?.climate.recommendedTimeOfDay ?? 14.2
  );
  const [weather, setWeatherState] = useState<WeatherMode>(
    () => blueprint?.climate.recommendedWeather ?? 'clear'
  );
  const [autoClimate, setAutoClimate] = useState(true);

  // Adopt the climate the planner recommended whenever a new city loads.
  // Adjusting state during render (instead of in an effect) avoids a second
  // render pass with stale climate values.
  const [syncedBlueprint, setSyncedBlueprint] = useState(blueprint);
  if (blueprint !== syncedBlueprint) {
    setSyncedBlueprint(blueprint);
    if (blueprint) {
      setAutoClimate(true);
      setTimeOfDayState(blueprint.climate.recommendedTimeOfDay);
      setWeatherState(blueprint.climate.recommendedWeather);
    }
  }

  const setTimeOfDay = useCallback(
    (hour: number) => {
      setAutoClimate(false);
      setTimeOfDayState(hour);
      engineRef.current?.setTimeOfDay(hour);
    },
    [engineRef]
  );

  const setWeather = useCallback(
    (next: WeatherMode) => {
      setAutoClimate(false);
      setWeatherState(next);
      engineRef.current?.setWeather(next);
    },
    [engineRef]
  );

  const resetAutoClimate = useCallback(() => {
    if (!blueprint) return;
    setAutoClimate(true);
    setTimeOfDayState(blueprint.climate.recommendedTimeOfDay);
    setWeatherState(blueprint.climate.recommendedWeather);
    engineRef.current?.setTimeOfDay(blueprint.climate.recommendedTimeOfDay);
    engineRef.current?.setWeather(blueprint.climate.recommendedWeather);
  }, [blueprint, engineRef]);

  const isNightUI = timeOfDay >= NIGHT_START || timeOfDay < NIGHT_END;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isNightUI);
  }, [isNightUI]);

  return {
    timeOfDay,
    weather,
    autoClimate,
    isNightUI,
    setTimeOfDay,
    setWeather,
    resetAutoClimate,
  };
}
