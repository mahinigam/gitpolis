import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { CityBlueprint } from '../../domain/city/types';
import type { CitySceneEngine } from '../../engine/CityScene';

export const PLAY_SPEEDS = [1, 3, 8] as const;

/** Full history plays in ~18s at 1x, ~6s at 3x, ~2.2s at 8x. */
const PLAYBACK_SECONDS = 18;
const ONE_DAY_MS = 86_400_000;

export interface TimelineController {
  timelineMs: number;
  isPlaying: boolean;
  playbackSpeed: number;
  speedIndex: number;
  togglePlay: () => void;
  changeTimeline: (ms: number) => void;
  resetToPresent: () => void;
  cycleSpeed: () => void;
}

/**
 * Drives the chronological growth scrubber with a requestAnimationFrame loop
 * and keeps the engine's timeline cursor in sync.
 */
export function useTimelinePlayback(
  blueprint: CityBlueprint | null,
  engineRef: RefObject<CitySceneEngine | null>
): TimelineController {
  const [timelineMs, setTimelineMs] = useState(() => blueprint?.timeline.endTime ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);

  // Snap the scrubber to the blueprint's present whenever the city changes.
  // State is adjusted during render; only the engine cursor is an effect.
  const [syncedBlueprint, setSyncedBlueprint] = useState(blueprint);
  if (blueprint !== syncedBlueprint) {
    setSyncedBlueprint(blueprint);
    setIsPlaying(false);
    if (blueprint) setTimelineMs(blueprint.timeline.endTime);
  }

  useEffect(() => {
    if (!blueprint) return;
    engineRef.current?.setTimelineCursor(blueprint.timeline.endTime);
  }, [blueprint, engineRef]);

  useEffect(() => {
    if (!isPlaying || !blueprint) return;

    let rafId = 0;
    let lastTs = performance.now();
    const { startTime, endTime } = blueprint.timeline;
    const span = Math.max(ONE_DAY_MS * 30, endTime - startTime);
    const msPerSecond = (span / PLAYBACK_SECONDS) * PLAY_SPEEDS[speedIndex];

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTs) / 1000);
      lastTs = now;

      setTimelineMs((prev) => {
        const next = prev + msPerSecond * dt;
        if (next >= endTime) {
          setIsPlaying(false);
          engineRef.current?.setTimelineCursor(endTime);
          return endTime;
        }
        engineRef.current?.setTimelineCursor(next);
        return next;
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, blueprint, speedIndex, engineRef]);

  const togglePlay = useCallback(() => {
    if (!blueprint) return;
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    // Restart cleanly from the founding date when already at the end.
    if (timelineMs >= blueprint.timeline.endTime - ONE_DAY_MS) {
      setTimelineMs(blueprint.timeline.startTime);
      engineRef.current?.setTimelineCursor(blueprint.timeline.startTime);
    }
    setIsPlaying(true);
  }, [blueprint, engineRef, isPlaying, timelineMs]);

  const changeTimeline = useCallback(
    (ms: number) => {
      setIsPlaying(false);
      setTimelineMs(ms);
      engineRef.current?.setTimelineCursor(ms);
    },
    [engineRef]
  );

  const resetToPresent = useCallback(() => {
    if (!blueprint) return;
    setIsPlaying(false);
    setTimelineMs(blueprint.timeline.endTime);
    engineRef.current?.setTimelineCursor(blueprint.timeline.endTime);
  }, [blueprint, engineRef]);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((index) => (index + 1) % PLAY_SPEEDS.length);
  }, []);

  return {
    timelineMs,
    isPlaying,
    playbackSpeed: PLAY_SPEEDS[speedIndex],
    speedIndex,
    togglePlay,
    changeTimeline,
    resetToPresent,
    cycleSpeed,
  };
}
