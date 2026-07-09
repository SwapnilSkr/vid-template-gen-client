import { useEffect } from "react";
import { useReelStudio } from "@/store/reel-studio";
import { reelId, reelNeedsPolling } from "@/utils/reel";

const POLL_MS = 3000;
const SETTLE_MS = 2000;

export function useReelSync() {
  const load = useReelStudio((state) => state.load);
  const loadYouTubeChannels = useReelStudio((state) => state.loadYouTubeChannels);
  const pollSelected = useReelStudio((state) => state.pollSelected);
  const selectedId = useReelStudio((state) => state.selectedId);
  const selected = useReelStudio((state) =>
    state.reels.find((reel) => reelId(reel) === state.selectedId),
  );
  const needsPoll = reelNeedsPolling(selected);

  useEffect(() => {
    void load();
    void loadYouTubeChannels();
  }, [load, loadYouTubeChannels]);

  // Poll only while the selected reel has an in-flight job. Trailing refresh
  // after settle catches auto-publish pending that lands right after completed.
  useEffect(() => {
    if (!selectedId) return;
    if (needsPoll) {
      void pollSelected();
      const timer = window.setInterval(() => void pollSelected(), POLL_MS);
      return () => window.clearInterval(timer);
    }
    const settle = window.setTimeout(() => void pollSelected(), SETTLE_MS);
    return () => window.clearTimeout(settle);
  }, [selectedId, needsPoll, pollSelected]);
}
