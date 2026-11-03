/**
 * Asset fingerprint.
 *
 * The stylesheet and the client script are inlined in the bundle, so a deploy
 * can change them without changing their URL. Browsers that cached
 * /css/app.css for an hour would then render new markup with an old stylesheet,
 * which looks like a broken layout until someone hard-refreshes.
 *
 * Hashing the shipped text gives every deploy a new ?v= and lets both files be
 * cached immutably: a stale copy is never referenced again.
 */

import { CSS } from "../assets/styles";
import { APP_JS } from "../assets/client";

/** FNV-1a, 32 bit. Enough to distinguish deploys; not a security primitive. */
function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export const ASSET_VERSION = fingerprint(CSS + APP_JS);

export const CSS_URL = `/css/app.css?v=${ASSET_VERSION}`;
export const JS_URL = `/js/app.js?v=${ASSET_VERSION}`;
