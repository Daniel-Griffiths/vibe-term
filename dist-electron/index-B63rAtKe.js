import { createRequire as i } from "node:module";
import { EventEmitter as a } from "events";
import { execSync as r } from "child_process";
import { fileURLToPath as o } from "url";
import { join as s, dirname as n } from "path";
var d = /* @__PURE__ */ i(import.meta.url);
const l = {
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
}, u = o(import.meta.url), c = n(u), f = d("node-gyp-build");
var m = f(s(c, "..")), p = class extends a {
  _addon;
  GlassMaterialVariant = l;
  constructor() {
    if (super(), process.platform !== "darwin") {
      console.warn("electron-liquid-glass only supports macOS – liquid glass functionality will be disabled.");
      return;
    }
    if (Number(r("sw_vers -productVersion").toString().trim().split(".")[0]) < 26) {
      console.warn("electron-liquid-glass requires macOS 26 or higher – liquid glass functionality will be disabled.");
      return;
    }
    try {
      this._addon = new m.LiquidGlassNative();
    } catch (t) {
      console.error("electron-liquid-glass failed to load its native addon – liquid glass functionality will be disabled.", t);
    }
  }
  /**
  * Wrap the Electron window with a glass / vibrancy view.
  * @param handle BrowserWindow.getNativeWindowHandle()
  * @param options Glass effect options
  * @returns id – can be used for future API (remove/update)
  */
  addView(e, t = {}) {
    return Buffer.isBuffer(e) ? this._addon ? this._addon.addView(e, t) : (console.warn("electron-liquid-glass is unavailable on this platform – addView will be a no-op."), -1) : (console.error("electron-liquid-glass: handle must be a Buffer"), -1);
  }
  setVariant(e, t) {
    !this._addon || typeof this._addon.setVariant != "function" || this._addon.setVariant(e, t);
  }
  unstable_setVariant(e, t) {
    this.setVariant(e, t);
  }
  unstable_setScrim(e, t) {
    !this._addon || typeof this._addon.setScrimState != "function" || this._addon.setScrimState(e, t);
  }
  unstable_setSubdued(e, t) {
    !this._addon || typeof this._addon.setSubduedState != "function" || this._addon.setSubduedState(e, t);
  }
};
const _ = new p();
var q = _;
export {
  q as default
};
