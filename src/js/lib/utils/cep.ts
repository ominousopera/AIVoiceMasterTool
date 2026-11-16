import { os } from "../cep/node";
import { csi } from "./bolt";

/**
 * Register all possible keyboard shortcuts on Mac and Windows for you CEP Panel
 * Warning: Note that certain keys will not work per OS regardless of registration
 */

export const keyRegisterOverride = () => {
  //@ts-ignore
  const platform = navigator.platform.substring(0, 3);
  let maxKey = 0;
  if (platform === "Mac")
    maxKey = 126; // Mac Max Key Code
  else if (platform === "Win") maxKey = 222; // HTML Max Key Code
  let allKeys: {
    keyCode: number;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
  }[] = [];
  for (let k = 0; k <= maxKey; k++) {
    for (let j = 0; j <= 15; j++) {
      const guide = (j >>> 0).toString(2).padStart(4, "0");
      allKeys.push({
        keyCode: k,
        ctrlKey: guide[0] === "1",
        altKey: guide[1] === "1",
        shiftKey: guide[2] === "1",
        metaKey: guide[3] === "1",
      });
    }
  }
  csi.registerKeyEventsInterest(JSON.stringify(allKeys));
};

/**
 * Registers only the standard text-editing shortcuts (paste, copy, cut, select
 * all, undo, redo) as CEP "key events of interest", instead of
 * `keyRegisterOverride`'s every-key, every-modifier form above. Without any
 * registration, Cmd/Ctrl+V does nothing in a focused CEP text field
 * (Premiere's Edit-menu accelerator claims it first) — a known CEP gotcha.
 * Narrow on purpose (5 letter keys, Cmd/Ctrl with optional Shift): the broad
 * form would also claim keys like Space/J/K/L whenever the panel has focus.
 */
export const registerEditShortcuts = () => {
  //@ts-ignore
  const platform = navigator.platform.substring(0, 3);
  const isMac = platform === "Mac";
  // DOM keyCodes are the same numeric values across platforms (US layout):
  // V=86, C=67, X=88, A=65, Z=90.
  const editKeyCodes = [86, 67, 88, 65, 90];
  const keys: {
    keyCode: number;
    ctrlKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
    metaKey: boolean;
  }[] = [];
  for (const keyCode of editKeyCodes) {
    for (const shiftKey of [false, true]) {
      // Mac: Cmd is the real modifier, Ctrl+<key> is untouched (some other
      // Mac app shortcut, not ours to claim). Windows: Ctrl is the real one.
      keys.push({ keyCode, ctrlKey: !isMac, altKey: false, shiftKey, metaKey: isMac });
    }
  }
  csi.registerKeyEventsInterest(JSON.stringify(keys));
};

export const textCepPatch = (e: KeyboardEvent) => {
  const isMac = os.platform() === "darwin";
  if (!isMac) return; // Only needed on MacOS, Windows handles this natively

  const isShiftKey = e.shiftKey;
  const input = e.target as HTMLTextAreaElement | HTMLInputElement;
  const start = input.selectionStart;
  let end = input.selectionEnd;

  const selectionExists = start !== null && end !== null && start !== end;

  if (start === null || end === null) return;

  if (e.key === "ArrowLeft") {
    if (start === 0) return; // Prevents going to -1
    if (isShiftKey) {
      input.setSelectionRange(start - 1, end);
    } else {
      input.setSelectionRange(start - 1, start - 1);
    }
  } else if (e.key === "ArrowRight") {
    if (end === input.value.length) return; // Prevents going to start
    if (isShiftKey) {
      input.setSelectionRange(start, end + 1);
    } else {
      input.setSelectionRange(end + 1, end + 1);
    }
  }
};

/**
 * Prevents the user from dropping files or URLs onto the panel and navigating away
 */

export const dropDisable = () => {
  window.addEventListener("dragover", (e) => e.preventDefault(), false);
  window.addEventListener("drop", (e) => e.preventDefault(), false);
};
