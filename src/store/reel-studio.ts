import { create } from "zustand";
import {
  createReel,
  getReel,
  getReview,
  listGameplay,
  listReels,
  listTtsVoices,
  promoteVoiceVariant,
  publishReel,
  regenerateThumbnail,
  revoiceReel,
  updateReview,
  useFrameAsThumbnail,
  type CreateReelInput,
  type GameplayClip,
  type Reel,
  type ReelReview,
  type RevoiceVariantInput,
  type TtsVoiceOption,
} from "@/api/reels";
import { reelId } from "@/utils/reel";

interface ReelStudioState {
  reels: Reel[];
  selectedId?: string;
  loading: boolean;
  error?: string;
  draftReview?: ReelReview;
  gameplayClips: GameplayClip[];
  ttsVoices: TtsVoiceOption[];
  revoicing: boolean;
  load: () => Promise<void>;
  loadGameplay: () => Promise<void>;
  loadTtsVoices: () => Promise<void>;
  select: (id: string) => Promise<void>;
  create: (input: CreateReelInput) => Promise<boolean>;
  pollSelected: () => Promise<void>;
  saveReview: (review: ReelReview) => Promise<void>;
  regenerateThumbnail: (review: ReelReview) => Promise<void>;
  useFrameAsThumbnail: (atSeconds: number) => Promise<void>;
  approveReview: () => Promise<void>;
  publish: () => Promise<void>;
  revoice: (variants: RevoiceVariantInput[]) => Promise<void>;
  promoteVariant: (variantId: string) => Promise<void>;
}

export const useReelStudio = create<ReelStudioState>((set, get) => ({
  reels: [],
  loading: false,
  gameplayClips: [],
  ttsVoices: [],
  revoicing: false,

  async loadGameplay() {
    try {
      const gameplayClips = await listGameplay();
      set({ gameplayClips });
    } catch {
      // non-fatal — the create form falls back to random gameplay selection
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
    set({ draftReview: saved });
  },

  async regenerateThumbnail(review) {
    const id = get().selectedId;
    if (!id) return;
    set({ loading: true, error: undefined });
    try {
      const saved = await regenerateThumbnail(id, review);
      set((state) => ({
        draftReview: saved,
        loading: false,
        reels: state.reels.map((item) =>
          reelId(item) === id ? { ...item, review: saved } : item
        ),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to regenerate thumbnail",
        loading: false,
      });
    }
  },

  async useFrameAsThumbnail(atSeconds) {
    const id = get().selectedId;
    if (!id) return;
    set({ loading: true, error: undefined });
    try {
      const saved = await useFrameAsThumbnail(id, atSeconds);
      set((state) => ({
        draftReview: saved,
        loading: false,
        reels: state.reels.map((item) => (reelId(item) === id ? { ...item, review: saved } : item)),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to use frame as thumbnail",
        loading: false,
      });
    }
  },

  async approveReview() {
    const review = get().draftReview;
    const id = get().selectedId;
    if (!id || !review) return;
    const saved = await updateReview(id, { ...review, status: "approved" });
    set({ draftReview: saved });
  },

  async publish() {
    const id = get().selectedId;
    if (!id) return;
    await publishReel(id);
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
}));
