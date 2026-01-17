// panopto-dl.ts
import { $ } from "bun";
import { chromium, type BrowserContext, type Page } from "playwright";

interface StreamUrls {
  audioUrl: string;
  videoUrl: string;
}

async function getBrowserContext(): Promise<BrowserContext> {
  const userDataDir = `${process.env.HOME}/.panopto-dl/browser-data`;
  await $`mkdir -p ${userDataDir}`;

  const browser = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: true,
    viewport: { width: 1920, height: 1080 },
  });

  return browser;
}

async function getStreamUrls(
  page: Page,
  panoptoUrl: string,
): Promise<StreamUrls> {
  const hlsUrls: Set<string> = new Set();

  // Intercept all requests to find HLS-related URLs
  page.on("request", (request) => {
    const url = request.url();
    // Look for HLS segment requests or manifest requests
    if (
      url.includes(".hls/") ||
      url.includes(".m3u8") ||
      url.includes("fragmented.mp4")
    ) {
      // Extract the base HLS URL from the segment URL
      // Pattern: https://.../{streamId}.hls/{bitrate}/fragmented.mp4
      const hlsMatch = url.match(
        /(https:\/\/[^/]+\/sessions\/[^/]+\/[^/]+\.hls)/,
      );
      if (hlsMatch) {
        hlsUrls.add(hlsMatch[1]);
      }
    }
  });

  // Navigate to the page
  console.log("Navigating to page...");
  await page.goto(panoptoUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Wait for the video player to initialize
  console.log("Waiting for video player...");
  try {
    await page.waitForSelector("video", { timeout: 30000 });
  } catch {
    console.log("No video element found, checking if login is required...");
  }

  // Check if we're on a login page
  const currentUrl = page.url();
  if (currentUrl.includes("Login") || currentUrl.includes("login")) {
    throw new Error(
      "Login required. Please run with headless: false to log in first.",
    );
  }

  // Wait a bit longer for streams to start loading
  console.log("Waiting for streams to load...");
  await page.waitForTimeout(8000);

  // Try clicking play if video isn't autoplaying
  try {
    const playButton = await page.$(
      'button[aria-label*="play"], .play-button, [class*="play"]',
    );
    if (playButton) {
      await playButton.click();
      await page.waitForTimeout(3000);
    }
  } catch {
    // Ignore if no play button
  }

  // Also try to extract URLs from the page's JavaScript data
  const extractedUrls = await page.evaluate(() => {
    const urls: string[] = [];

    // Check performance entries for resource URLs
    if (performance && performance.getEntriesByType) {
      const resources = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      resources.forEach((r) => {
        if (r.name.includes(".hls/") || r.name.includes(".m3u8")) {
          urls.push(r.name);
        }
      });
    }

    return urls;
  });

  extractedUrls.forEach((url) => {
    const hlsMatch = url.match(
      /(https:\/\/[^/]+\/sessions\/[^/]+\/[^/]+\.hls)/,
    );
    if (hlsMatch) {
      hlsUrls.add(hlsMatch[1]);
    }
  });

  console.log(`Found ${hlsUrls.size} HLS stream(s)`);

  const urlArray = Array.from(hlsUrls);
  urlArray.forEach((url, i) => console.log(`  Stream ${i + 1}: ${url}`));

  // Categorize streams
  let audioUrl = "";
  let videoUrl = "";

  for (const url of urlArray) {
    // .object.hls is typically screen recording (video only)
    // Regular .hls is typically camera with audio
    if (url.includes(".object.hls")) {
      videoUrl = url;
    } else {
      audioUrl = url;
    }
  }

  // If we only found one stream, use it as audioUrl (it likely has both audio and video)
  if (urlArray.length === 1) {
    audioUrl = urlArray[0];
    videoUrl = "";
  }

  return { audioUrl, videoUrl };
}

async function downloadWithFfmpeg(
  audioUrl: string,
  videoUrl: string,
  outputPath: string,
): Promise<void> {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Download attempt ${attempt}/${maxAttempts}...`);

      if (!videoUrl) {
        // Single stream - just copy
        const masterUrl = `${audioUrl}/master.m3u8`;
        console.log(`Downloading single stream: ${masterUrl}`);
        await $`ffmpeg -i ${masterUrl} -c copy -bsf:a aac_adtstoasc ${outputPath} -y`;
      } else {
        // Two streams - merge audio from primary into video
        const videoMaster = `${videoUrl}/master.m3u8`;
        const audioMaster = `${audioUrl}/master.m3u8`;
        console.log(`Merging streams:`);
        console.log(`  Video: ${videoMaster}`);
        console.log(`  Audio: ${audioMaster}`);
        await $`ffmpeg -i ${videoMaster} -i ${audioMaster} -map 0:v -map 1:a -c:v copy -c:a aac -bsf:a aac_adtstoasc ${outputPath} -y`;
      }

      console.log(`✓ Downloaded: ${outputPath}`);
      return;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt === maxAttempts) {
        throw new Error(`Failed to download after ${maxAttempts} attempts`);
      }
      await Bun.sleep(2000);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log("Usage: bun panopto-dl.ts <panopto-url> [output-path]");
    console.log(
      'Example: bun panopto-dl.ts "https://mediaweb.ap.panopto.com/..." ./output.mp4',
    );
    process.exit(1);
  }

  // Clean the URL - remove any backslash escapes that might have been added by shell
  const panoptoUrl = args[0].replace(/\\\\/g, "");
  const outputPath = args[1] || "./output.mp4";

  console.log("Starting Panopto download...");
  console.log(`URL: ${panoptoUrl}`);
  console.log(`Output: ${outputPath}`);

  let context: BrowserContext | null = null;

  try {
    context = await getBrowserContext();
    const page = await context.newPage();

    // Get stream URLs
    console.log("Extracting stream URLs...");
    const { audioUrl, videoUrl } = await getStreamUrls(page, panoptoUrl);

    if (!audioUrl && !videoUrl) {
      // Try with visible browser for debugging
      console.log("No streams found. Trying with visible browser...");
      await context.close();

      context = await chromium.launchPersistentContext(
        `${process.env.HOME}/.panopto-dl/browser-data`,
        {
          channel: "chrome",
          headless: false,
          viewport: { width: 1920, height: 1080 },
        },
      );
      const visiblePage = await context.newPage();

      const { audioUrl: a2, videoUrl: v2 } = await getStreamUrls(
        visiblePage,
        panoptoUrl,
      );

      if (!a2 && !v2) {
        throw new Error(
          "Could not find any stream URLs. The page may require authentication or the video may not be available.",
        );
      }

      await downloadWithFfmpeg(a2, v2, outputPath);
    } else {
      await downloadWithFfmpeg(audioUrl, videoUrl, outputPath);
    }

    console.log("✓ Download complete!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await context?.close();
  }
}

main();
