import { Image as ImageIcon } from "lucide-react";
import { mediaUrl, type Reel, type Scene } from "@/api/reels";
import { cn } from "@/lib/utils";

export function SceneThumb({
  reel,
  scene,
  className,
}: {
  reel: Reel;
  scene: Scene;
  className?: string;
}) {
  const draftAsset = reel.editDraft?.sceneAssets.find(
    (item) => item.index === scene.index,
  );
  const imageUrl = mediaUrl(draftAsset?.assetUrl) ?? scene.assetUrl;
  return (
    <span
      className={cn(
        "grid aspect-9/16 place-items-center overflow-hidden rounded border border-border bg-black/45 text-muted-foreground/80",
        className,
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon size={16} />
      )}
    </span>
  );
}

