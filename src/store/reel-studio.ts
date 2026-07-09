import { create } from "zustand";
import {
  createReel,
  deleteReel,
  deleteYouTubeChannel,
  getReel,
  getReview,
  listArtStyles,
  listGameplay,
  listHorrorAudio,
  listImageModels,
  listReels,
  listTtsVoices,
  listYouTubeChannels,
  promoteVoiceVariant,
  purgeFailedReels,
  publishReel,
  resumeFailedReel,
  revoiceReel,
  startYouTubeChannelConnect,
  updateReview,
  type ArtStyleOption,
  type CreateReelInput,
  type GameplayClip,
  type HorrorAudioOption,
  type ImageModelOption,
  type Reel,
  type ReelReview,
  type RevoiceVariantInput,
  type TtsVoiceOption,
  type YouTubeChannelOption,
} from "@/api/reels";
import { reelId } from "@/utils/reel";

interface ReelStudioState {
  reels: Reel[];
  selectedId?: string;
  loading: boolean;
  error?: string;
  draftReview?: ReelReview;
  gameplayClips: GameplayClip[];
  horrorAudios: HorrorAudioOption[];
  imageModels: ImageModelOption[];
  artStyles: ArtStyleOption[];
  ttsVoices: TtsVoiceOption[];
  youtubeChannels: YouTubeChannelOption[];
  revoicing: boolean;
  previewTimeSeconds: number;
  load: () => Promise<void>;
  loadGameplay: () => Promise<void>;
  loadHorrorAudio: () => Promise<void>;
  loadImageModels: () => Promise<void>;
  loadArtStyles: () => Promise<void>;
  loadTtsVoices: () => Promise<void>;
  loadYouTubeChannels: () => Promise<void>;
  connectYouTubeChannel: (input: {
    label: string;
    channelKey?: string;
    privacyStatus?: "private" | "unlisted" | "public";
    categoryId?: string;
    niches?: string[];
  }) => Promise<string | undefined>;
  removeYouTubeChannel: (id: string) => Promise<void>;
  select: (id: string) => Promise<void>;
  create: (input: CreateReelInput) => Promise<boolean>;
  pollSelected: () => Promise<void>;
  saveReview: (review: ReelReview) => Promise<void>;
  approveReview: () => Promise<void>;
  publish: (channelId?: string) => Promise<void>;
  deleteSelected: () => Promise<void>;
  deleteById: (id: string) => Promise<void>;
  purgeFailed: () => Promise<void>;
  resumeFailed: (id?: string) => Promise<void>;
  revoice: (variants: RevoiceVariantInput[]) => Promise<void>;
  promoteVariant: (variantId: string) => Promise<void>;
  setPreviewTimeSeconds: (seconds: number) => void;
}

export const useReelStudio = create<ReelStudioState>((set, get) => ({
  reels: [],
  loading: false,
  gameplayClips: [],
  horrorAudios: [],
  imageModels: [],
  artStyles: [],
  ttsVoices: [],
  youtubeChannels: [],
  revoicing: false,
  previewTimeSeconds: 0,

  async loadGameplay() {
    try {
      const gameplayClips = await listGameplay();
      set({ gameplayClips });
    } catch {
      // non-fatal — the create form falls back to random gameplay selection
    }
  },

  async loadHorrorAudio() {
    try {
      const horrorAudios = await listHorrorAudio();
      set({ horrorAudios });
    } catch {
      // non-fatal — horror rendering falls back to a random S3 bed if present
    }
  },

  async loadImageModels() {
    try {
      const imageModels = await listImageModels();
      set({ imageModels });
    } catch {
      // non-fatal — create form falls back to tier defaults
    }
  },

  async loadArtStyles() {
    try {
      const artStyles = await listArtStyles();
      set({ artStyles });
    } catch {
      // non-fatal — create form falls back to the niche's default style pool
    }
  },

  async loadTtsVoices() {
    try {
      const ttsVoices = await listTtsVoices();
      set({ ttsVoices });
    } catch {
      // non-fatal — revoice falls back to typing a model/voice manually
    }
  },

  async loadYouTubeChannels() {
    try {
      const youtubeChannels = await listYouTubeChannels();
      set({ youtubeChannels });
    } catch {
      // non-fatal — publish will still report the server-side config error
    }
  },

  async connectYouTubeChannel(input) {
    set({ loading: true, error: undefined });
    try {
      const result = await startYouTubeChannelConnect(input);
      set({ loading: false });
      return result.authUrl;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to start YouTube channel connect",
        loading: false,
      });
      return undefined;
    }
  },

  async removeYouTubeChannel(id) {
    set({ loading: true, error: undefined });
    try {
      await deleteYouTubeChannel(id);
      await get().loadYouTubeChannels();
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to remove YouTube channel",
        loading: false,
      });
    }
  },

  async load() {
    set({ loading: true, error: undefined });
    try {
      const reels = await listReels();
      set((state) => ({
        reels,
        selectedId: state.selectedId ?? reelId(reels[0]),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to load reels", loading: false });
    }
  },

  async select(id) {
    set({ selectedId: id, draftReview: undefined, error: undefined });
    const reel = await getReel(id);
    set((state) => ({
      reels: state.reels.map((item) => (reelId(item) === id ? { ...item, ...reel } : item)),
      draftReview: reel.review,
    }));
    if (reel.status === "completed") {
      const review = await getReview(id);
      set({ draftReview: review });
    }
  },

  async create(input) {
    set({ loading: true, error: undefined });
    try {
      const result = await createReel(input);
      await get().load();
      await get().select(result.id);
      set({ loading: false });
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to create reel", loading: false });
      return false;
    }
  },

  async pollSelected() {
    const id = get().selectedId;
    if (!id) return;
    const reel = await getReel(id);
    set((state) => ({
      reels: state.reels.map((item) => (reelId(item) === id ? { ...item, ...reel } : item)),
      draftReview: reel.review ?? state.draftReview,
    }));
    if (reel.status === "completed" && !get().draftReview) {
      const review = await getReview(id);
      set({ draftReview: review });
    }
  },

  async saveReview(review) {
    const id = get().selectedId;
    if (!id) return;
    const saved = await updateReview(id, review);
    set((state) => ({
      draftReview: saved,
      reels: state.reels.map((item) => (reelId(item) === id ? { ...item, review: saved } : item)),
    }));
  },

  async approveReview() {
    const review = get().draftReview;
    const id = get().selectedId;
    if (!id || !review) return;
    const saved = await updateReview(id, { ...review, status: "approved" });
    set((state) => ({
      draftReview: saved,
      reels: state.reels.map((item) => (reelId(item) === id ? { ...item, review: saved } : item)),
    }));
  },

  async publish(channelId) {
    const id = get().selectedId;
    if (!id) return;
    set({ loading: true, error: undefined });
    try {
      const result = await publishReel(id, channelId);
      set((state) => ({
        loading: false,
        reels: state.reels.map((item) =>
          reelId(item) === id
            ? { ...item, youtube: result.youtube ?? { status: "pending", channelId } }
            : item
        ),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to publish reel", loading: false });
      return;
    }
    await get().pollSelected();
  },

  async deleteSelected() {
    const id = get().selectedId;
    if (!id) return;
    await get().deleteById(id);
  },

  async deleteById(id) {
    set({ loading: true, error: undefined });
    try {
      await deleteReel(id);
      set((state) => {
        const reels = state.reels.filter((item) => reelId(item) !== id);
        const selectedId = state.selectedId === id ? reelId(reels[0]) || undefined : state.selectedId;
        return {
          reels,
          selectedId,
          draftReview: state.selectedId === id ? undefined : state.draftReview,
          loading: false,
        };
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to delete reel", loading: false });
    }
  },

  async purgeFailed() {
    set({ loading: true, error: undefined });
    try {
      await purgeFailedReels();
      await get().load();
      set({ loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to purge failed reels", loading: false });
    }
  },

  async resumeFailed(id) {
    const targetId = id ?? get().selectedId;
    if (!targetId) return;
    set({ loading: true, error: undefined });
    try {
      const updated = await resumeFailedReel(targetId);
      set((state) => ({
        loading: false,
        reels: state.reels.map((item) => (reelId(item) === targetId ? updated : item)),
        selectedId: targetId,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to resume reel",
        loading: false,
      });
      return;
    }
    await get().pollSelected();
  },

  async revoice(variants) {
    const id = get().selectedId;
    if (!id) return;
    set({ revoicing: true, error: undefined });
    try {
      await revoiceReel(id, variants);
      await get().pollSelected();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to queue revoice" });
    } finally {
      set({ revoicing: false });
    }
  },

  async promoteVariant(variantId) {
    const id = get().selectedId;
    if (!id) return;
    set({ loading: true, error: undefined });
    try {
      await promoteVoiceVariant(id, variantId);
      await get().pollSelected();
      set({ loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to promote voice variant",
        loading: false,
      });
    }
  },

  setPreviewTimeSeconds(seconds) {
    if (!Number.isFinite(seconds)) return;
    set({ previewTimeSeconds: Math.max(seconds, 0) });
  },
}));
