import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useClimateControls } from '../../../src/app/hooks/useClimateControls';
import { buildCityBlueprint } from '../../../src/domain/city/planning';
import type { CityBlueprint } from '../../../src/domain/city/types';
import type { CitySceneEngine } from '../../../src/engine/CityScene';
import { makePayload } from '../../fixtures/github';

const NOW_MS = Date.parse('2025-06-01T00:00:00.000Z');
const blueprint: CityBlueprint = buildCityBlueprint(makePayload(), { nowMs: NOW_MS });

const engine = {
  setTimeOfDay: vi.fn(),
  setWeather: vi.fn(),
} as unknown as CitySceneEngine;

function engineRef(): RefObject<CitySceneEngine | null> {
  return { current: engine };
}

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.classList.remove('dark');
});

describe('useClimateControls', () => {
  it('starts from a neutral daytime climate before a city loads', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useClimateControls(null, ref));

    expect(result.current.timeOfDay).toBe(14.2);
    expect(result.current.weather).toBe('clear');
    expect(result.current.autoClimate).toBe(true);
    expect(result.current.isNightUI).toBe(false);
  });

  it('adopts the planner climate when a blueprint arrives', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useClimateControls(blueprint, ref));

    expect(result.current.timeOfDay).toBe(blueprint.climate.recommendedTimeOfDay);
    expect(result.current.weather).toBe(blueprint.climate.recommendedWeather);
    expect(result.current.autoClimate).toBe(true);
  });

  it('marks night for evening and early-morning hours', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useClimateControls(null, ref));

    act(() => result.current.setTimeOfDay(19.2));
    expect(result.current.isNightUI).toBe(true);

    act(() => result.current.setTimeOfDay(3));
    expect(result.current.isNightUI).toBe(true);

    act(() => result.current.setTimeOfDay(6.4));
    expect(result.current.isNightUI).toBe(false);
  });

  it('toggles the dark document class with the night theme', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useClimateControls(null, ref));

    act(() => result.current.setTimeOfDay(21));
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => result.current.setTimeOfDay(12));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies a manual time of day and disables auto climate', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useClimateControls(blueprint, ref));

    act(() => result.current.setTimeOfDay(21.5));

    expect(result.current.timeOfDay).toBe(21.5);
    expect(result.current.autoClimate).toBe(false);
    expect(engine.setTimeOfDay).toHaveBeenCalledWith(21.5);
  });

  it('applies manual weather and disables auto climate', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useClimateControls(blueprint, ref));

    act(() => result.current.setWeather('rain'));

    expect(result.current.weather).toBe('rain');
    expect(result.current.autoClimate).toBe(false);
    expect(engine.setWeather).toHaveBeenCalledWith('rain');
  });

  it('restores the planner climate when auto is re-enabled', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useClimateControls(blueprint, ref));
    act(() => result.current.setTimeOfDay(2));
    act(() => result.current.setWeather('rain'));

    act(() => result.current.resetAutoClimate());

    expect(result.current.autoClimate).toBe(true);
    expect(result.current.timeOfDay).toBe(blueprint.climate.recommendedTimeOfDay);
    expect(result.current.weather).toBe(blueprint.climate.recommendedWeather);
    expect(engine.setTimeOfDay).toHaveBeenLastCalledWith(blueprint.climate.recommendedTimeOfDay);
    expect(engine.setWeather).toHaveBeenLastCalledWith(blueprint.climate.recommendedWeather);
  });

  it('ignores resetAutoClimate without a blueprint', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useClimateControls(null, ref));

    act(() => result.current.resetAutoClimate());

    expect(result.current.autoClimate).toBe(true);
    expect(engine.setTimeOfDay).not.toHaveBeenCalled();
    expect(engine.setWeather).not.toHaveBeenCalled();
  });

  it('adopts the climate of a newly loaded city', () => {
    const ref = engineRef();
    const { result, rerender } = renderHook(
      ({ city }: { city: CityBlueprint | null }) => useClimateControls(city, ref),
      { initialProps: { city: blueprint } }
    );
    act(() => result.current.setTimeOfDay(2));

    const next = buildCityBlueprint(makePayload(), {
      nowMs: NOW_MS + 86_400_000,
    });
    rerender({ city: next });

    expect(result.current.autoClimate).toBe(true);
    expect(result.current.timeOfDay).toBe(next.climate.recommendedTimeOfDay);
    expect(result.current.weather).toBe(next.climate.recommendedWeather);
  });
});
