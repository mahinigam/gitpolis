import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimelinePlayback } from '../../../src/app/hooks/useTimelinePlayback';
import { buildCityBlueprint } from '../../../src/domain/city/planning';
import type { CityBlueprint } from '../../../src/domain/city/types';
import type { CitySceneEngine } from '../../../src/engine/CityScene';
import { makePayload } from '../../fixtures/github';

const NOW_MS = Date.parse('2025-06-01T00:00:00.000Z');
const blueprint: CityBlueprint = buildCityBlueprint(makePayload(), { nowMs: NOW_MS });

const engine = {
  setTimelineCursor: vi.fn(),
} as unknown as CitySceneEngine;

function engineRef(): RefObject<CitySceneEngine | null> {
  return { current: engine };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTimelinePlayback', () => {
  it('snaps to the present when a blueprint is supplied', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useTimelinePlayback(blueprint, ref));

    expect(result.current.timelineMs).toBe(blueprint.timeline.endTime);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.playbackSpeed).toBe(3);
    expect(engine.setTimelineCursor).toHaveBeenCalledWith(blueprint.timeline.endTime);
  });

  it('stays idle without a blueprint', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useTimelinePlayback(null, ref));

    expect(result.current.timelineMs).toBe(0);
    act(() => result.current.togglePlay());
    expect(result.current.isPlaying).toBe(false);
    act(() => result.current.resetToPresent());
    expect(result.current.timelineMs).toBe(0);
  });

  it('restarts from the founding date when playing from the end', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useTimelinePlayback(blueprint, ref));

    act(() => result.current.togglePlay());

    expect(result.current.isPlaying).toBe(true);
    expect(result.current.timelineMs).toBe(blueprint.timeline.startTime);
    expect(engine.setTimelineCursor).toHaveBeenLastCalledWith(blueprint.timeline.startTime);
  });

  it('pauses on a second toggle', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useTimelinePlayback(blueprint, ref));

    act(() => result.current.togglePlay());
    act(() => result.current.togglePlay());

    expect(result.current.isPlaying).toBe(false);
  });

  it('scrubs to a time and pauses playback', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useTimelinePlayback(blueprint, ref));
    act(() => result.current.togglePlay());

    act(() => result.current.changeTimeline(1_234));

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.timelineMs).toBe(1_234);
    expect(engine.setTimelineCursor).toHaveBeenLastCalledWith(1_234);
  });

  it('returns to the present and pauses', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useTimelinePlayback(blueprint, ref));
    act(() => result.current.changeTimeline(1_234));

    act(() => result.current.resetToPresent());

    expect(result.current.timelineMs).toBe(blueprint.timeline.endTime);
    expect(result.current.isPlaying).toBe(false);
    expect(engine.setTimelineCursor).toHaveBeenLastCalledWith(blueprint.timeline.endTime);
  });

  it('cycles playback speeds 3x → 8x → 1x', () => {
    const ref = engineRef();
    const { result } = renderHook(() => useTimelinePlayback(blueprint, ref));

    expect(result.current.playbackSpeed).toBe(3);
    act(() => result.current.cycleSpeed());
    expect(result.current.playbackSpeed).toBe(8);
    act(() => result.current.cycleSpeed());
    expect(result.current.playbackSpeed).toBe(1);
    act(() => result.current.cycleSpeed());
    expect(result.current.playbackSpeed).toBe(3);
  });

  it('adopts the new present when the blueprint changes', () => {
    const ref = engineRef();
    const { result, rerender } = renderHook(
      ({ city }: { city: CityBlueprint }) => useTimelinePlayback(city, ref),
      { initialProps: { city: blueprint } }
    );
    act(() => result.current.changeTimeline(1_000));

    const next = buildCityBlueprint(makePayload(), { nowMs: NOW_MS + 86_400_000 });
    rerender({ city: next });

    expect(result.current.timelineMs).toBe(next.timeline.endTime);
    expect(result.current.isPlaying).toBe(false);
  });
});
