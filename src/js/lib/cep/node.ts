// Built-in Node.js modules the panels use (CEP runs them with Node enabled):
// only the five this code imports. No networking module (http, https, net,
// tls, dgram, dns) is loaded: the panels' only network access is the
// browser's own, behind networkGuard.ts, and release.mjs checks that it stays
// that way.

//@ts-ignore
export const child_process = (typeof window.cep !== "undefined" ? require("child_process") : {}) as typeof import("child_process");
export const fs = (typeof window.cep !== "undefined" ? require("fs") : {}) as typeof import("fs");
export const os = (typeof window.cep !== "undefined" ? require("os") : {}) as typeof import("os");
export const path = (typeof window.cep !== "undefined" ? require("path") : {}) as typeof import("path");
export const url = (typeof window.cep !== "undefined" ? require("url") : {}) as typeof import("url");
