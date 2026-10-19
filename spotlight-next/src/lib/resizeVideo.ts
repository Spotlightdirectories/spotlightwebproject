// ===============================================================
// src/lib/resizeVideo.ts
//
// Resizes a vendor's video inside the browser (no server, nothing
// uploaded until it is done) so it fits their plan's limits:
//   - picture scaled down to 720p (1280 x 720 or 720 x 1280) at most
//   - video data rate chosen from the plan's size limit and the
//     clip's length, with a safety margin
//   - sound is carried across untouched whenever possible
// The result is always an MP4. This mirrors the Spotlight app, which
// does the same thing on the phone, so a vendor gets the same result
// whichever one they upload from.
//
// Uses the "mediabunny" library, loaded only when a video actually
// needs resizing, so it adds nothing to normal page loads.
// ===============================================================

export const MAX_LONG_SIDE = 1280;
export const MAX_SHORT_SIDE = 720;

/** True when this browser can re-encode video (Chrome, Edge, Safari 16.4+, recent Firefox). */
export function canResizeVideoInBrowser(): boolean {
  return typeof window !== "undefined"
    && typeof (window as any).VideoEncoder !== "undefined"
    && typeof (window as any).VideoDecoder !== "undefined";
}

function evenNumber(n: number): number {
  const r = Math.max(2, Math.round(n));
  return r % 2 === 0 ? r : r - 1;
}

export type ResizeOptions = {
  width: number;        // current picture width in pixels
  height: number;       // current picture height in pixels
  duration: number;     // clip length in seconds
  maxSize: number;      // plan's size limit in bytes
  onProgress?: (percent: number) => void;
};

export async function resizeVideoToFit(file: File, opts: ResizeOptions): Promise<File> {
  const { Input, BlobSource, ALL_FORMATS, Output, Mp4OutputFormat, BufferTarget, Conversion } = await import("mediabunny");

  const long = Math.max(opts.width, opts.height);
  const short = Math.min(opts.width, opts.height);
  // Never enlarge; only shrink to fit inside 1280 x 720.
  const scale = Math.min(1, MAX_LONG_SIDE / long, MAX_SHORT_SIDE / short);
  const outWidth = evenNumber(opts.width * scale);

  // Video data rate that keeps the file inside the plan's size limit:
  // 10% safety margin, ~96 kbps set aside for the sound.
  const seconds = opts.duration > 0 ? opts.duration : 1;
  const budget = Math.floor((opts.maxSize * 8 * 0.9) / seconds - 96000);
  const startBitrate = Math.min(2500000, Math.max(300000, budget));

  const attempt = async (bitrate: number): Promise<Blob> => {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
    const conversion = await Conversion.init({
      input,
      output,
      video: { width: outWidth, codec: "avc", bitrate },
    });
    if (!conversion.isValid || conversion.discardedTracks.some(d => d.track.isVideoTrack())) {
      throw new Error("This video can't be resized in your browser. Try Google Chrome or Microsoft Edge, or choose a different video.");
    }
    conversion.onProgress = (p: number) => opts.onProgress?.(Math.min(100, Math.round(p * 100)));
    await conversion.execute();
    if (!target.buffer) throw new Error("Resizing the video failed. Please try again.");
    return new Blob([target.buffer], { type: "video/mp4" });
  };

  let blob = await attempt(startBitrate);
  if (blob.size > opts.maxSize) {
    // Slightly too big: try once more at a lower quality.
    opts.onProgress?.(0);
    blob = await attempt(Math.max(250000, Math.floor(startBitrate * 0.6)));
  }
  if (blob.size > opts.maxSize) {
    throw new Error(
      `Even after resizing, this video is ${(blob.size / 1048576).toFixed(1)}MB. Your plan allows ${Math.round(opts.maxSize / 1048576)}MB. Please choose a shorter video.`
    );
  }
  const baseName = file.name.replace(/\.[^.]+$/, "") || "video";
  return new File([blob], `${baseName}.mp4`, { type: "video/mp4" });
}
