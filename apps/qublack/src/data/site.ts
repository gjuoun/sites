import { FONT_VERSION } from "./font-release.generated";

// The generated file is rewritten on every deploy from the release the fonts were cut
// from (scripts/fetch-fonts.sh), so the download CTA never goes stale.
export const VERSION = FONT_VERSION;
export const RELEASE_TAG = `v${VERSION}`;
export const REPO = "https://github.com/gjuoun/qublack";
export const RELEASE_URL = `${REPO}/releases/tag/${RELEASE_TAG}`;
export const ZIP_NAME = `QuBlack-family-${VERSION}.zip`;
export const DOWNLOAD_URL = `${REPO}/releases/download/${RELEASE_TAG}/${ZIP_NAME}`;
export const SITE_URL = "https://qublack.qqntt.com";
