export function thumbnailPublishMessage(error: string): string {
  if (/permissions to upload and set custom video thumbnails/i.test(error)) {
    return "This YouTube channel cannot set custom thumbnails yet. Enable custom thumbnails/advanced features in YouTube Studio, then reconnect or retry publish.";
  }
  return error;
}
