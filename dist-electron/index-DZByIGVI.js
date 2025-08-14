import { createRequire } from "node:module";
import { EventEmitter } from "events";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
var __require = /* @__PURE__ */ createRequire(import.meta.url);
const GlassMaterialVariant = {
  regular: 0,
  clear: 1,
  dock: 2,
  appIcons: 3,
  widgets: 4,
  text: 5,
  avplayer: 6,
  facetime: 7,
  controlCenter: 8,
  notificationCenter: 9,
  monogram: 10,
  bubbles: 11,
  identity: 12,
  focusBorder: 13,
  focusPlatter: 14,
  keyboard: 15,
  sidebar: 16,
  abuttedSidebar: 17,
  inspector: 18,
  control: 19,
  loupe: 20,
  slider: 21,
  camera: 22,
  cartouchePopover: 23
};
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nodeGypBuild = __require("node-gyp-build");
var native_loader_default = nodeGypBuild(join(__dirname, ".."));
var LiquidGlass = class extends EventEmitter {
  _addon;
  GlassMaterialVariant = GlassMaterialVariant;
  constructor() {
    super();
    if (process.platform !== "darwin") {
      console.warn("electron-liquid-glass only supports macOS – liquid glass functionality will be disabled.");
      return;
    }
    const macosVersion = Number(execSync("sw_vers -productVersion").toString().trim().split(".")[0]);
    if (macosVersion < 26) {
      console.warn("electron-liquid-glass requires macOS 26 or higher – liquid glass functionality will be disabled.");
      return;
    }
    try {
      this._addon = new native_loader_default.LiquidGlassNative();
    } catch (err) {
      console.error("electron-liquid-glass failed to load its native addon – liquid glass functionality will be disabled.", err);
    }
  }
  /**
  * Wrap the Electron window with a glass / vibrancy view.
  * @param handle BrowserWindow.getNativeWindowHandle()
  * @param options Glass effect options
  * @returns id – can be used for future API (remove/update)
  */
  addView(handle, options = {}) {
    if (!Buffer.isBuffer(handle)) {
      console.error("electron-liquid-glass: handle must be a Buffer");
      return -1;
    }
    if (!this._addon) {
      console.warn("electron-liquid-glass is unavailable on this platform – addView will be a no-op.");
      return -1;
    }
    return this._addon.addView(handle, options);
  }
  setVariant(id, variant) {
    if (!this._addon || typeof this._addon.setVariant !== "function") return;
    this._addon.setVariant(id, variant);
  }
  unstable_setVariant(id, variant) {
    this.setVariant(id, variant);
  }
  unstable_setScrim(id, scrim) {
    if (!this._addon || typeof this._addon.setScrimState !== "function") return;
    this._addon.setScrimState(id, scrim);
  }
  unstable_setSubdued(id, subdued) {
    if (!this._addon || typeof this._addon.setSubduedState !== "function") return;
    this._addon.setSubduedState(id, subdued);
  }
};
const liquidGlass = new LiquidGlass();
var js_default = liquidGlass;
export {
  js_default as default
};
