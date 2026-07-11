import { useEffect } from "react";
import { useReelStudio } from "@/store/reel-studio";
import {
  isAssetStreamingStatus,
  reelId,
  reelNeedsPolling,
  REEL_ASSET_POLL_MS,
  REEL_POLL_MS,
  REEL_SETTLE_MS,
} from "@/utils/reel";

export function useReelSync() {
  const load = useReelStudio((state) => state.load);
  const loadYouTubeChannels = useReelStudio((state) => state.loadYouTubeChannels);
  const pollSelected = useReelStudio((state) => state.pollSelected);
  const selectedId = useReelStudio((state) => state.selectedId);
  const selected = useReelStudio((state) =>
    state.reels.find((reel) => reelId(reel) === state.selectedId),
  );
  const needsPoll = reelNeedsPolling(selected);
  const assetStreaming = isAssetStreamingStatus(selected?.status);

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
      const timer = window.setInterval(
        () => void pollSelected(),
        assetStreaming ? REEL_ASSET_POLL_MS : REEL_POLL_MS,
      );
      return () => window.clearInterval(timer);
    }
    const settle = window.setTimeout(() => void pollSelected(), REEL_SETTLE_MS);
    return () => window.clearTimeout(settle);
  }, [selectedId, needsPoll, pollSelected, assetStreaming]);
}
