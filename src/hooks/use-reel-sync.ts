import { useEffect } from "react";
import { useReelStudio } from "@/store/reel-studio";

export function useReelSync() {
  const load = useReelStudio((state) => state.load);
  const pollSelected = useReelStudio((state) => state.pollSelected);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void pollSelected(), 4000);
    return () => window.clearInterval(timer);
  }, [pollSelected]);
}
