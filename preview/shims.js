/* Dev-only preview harness: runs the real panel UI in a plain browser.
 *
 * NOT shipped. Nothing under preview/ is part of the build: the
 * real Vite config only builds the panels listed in cep.config.ts.
 *
 * What this file fakes, before any module loads:
 * - window.cep + a global require(), so lib/cep/node.ts hands out these
 *   stubs instead of empty objects (fs is an in-memory file map);
 * - window.__adobe_cep__, so CSInterface and evalTS work. evalTS calls are
 *   answered from MOCK_HOST below, per scenario.
 *
 * URL parameters:
 *   ?lang=en|ru|es       interface language (default en)
 *   &clip=1              a clip is selected on the timeline
 *   &key=1               an ElevenLabs key is saved (voices fail to load:
 *                        there is no network in the harness)
 *   &firstrun=1          no saved settings (first-run prompts appear)
 *   &update=new          update notice on, a newer release (9.9.9) saved
 *                        from an earlier check (dot, notice, release page)
 *   &update=check        update notice on and due: checks GitHub for real
 *   &sent=1              (bridge panel) a sent cut is waiting
 */
(function () {
  "use strict";
  var params = new URLSearchParams(location.search);
  var lang = params.get("lang") || "en";
  var hasClip = params.get("clip") === "1";
  var firstRun = params.get("firstrun") === "1";
  var hasKey = params.get("key") === "1";
  var hasSent = params.get("sent") === "1"; // bridge: a cut is waiting
  var update = params.get("update");

  // ---------- in-memory fs ----------
  var files = Object.create(null);
  if (!firstRun) {
    var settings = { uiLanguage: lang, outputLocation: "documents", macQuarantineNoticeShown: true, updateCheck: false };
    if (update === "new" || update === "check") settings.updateCheck = true;
    if (update === "new") {
      settings.lastUpdateCheck = Date.now();
      settings.latestRelease = { version: "9.9.9", url: "https://github.com/ominousopera/AIVoiceMasterTool/releases/tag/v9.9.9" };
    }
    if (hasKey) settings.elevenLabsApiKey = "sk_preview_0000000000000000";
    files["/Users/preview/Library/Application Support/AI Voice Master Tool/settings.json"] = JSON.stringify(settings);
  }
  var enoent = function (p) {
    var e = new Error("ENOENT: no such file or directory, '" + p + "'");
    e.code = "ENOENT";
    return e;
  };
  var fs = {
    existsSync: function (p) {
      if (p in files) return true;
      if (/\/jsx\/index\.js$/.test(p)) return true; // the panel's ExtendScript bundle "exists"
      if (/\/assets\/bin\/mac\/ffmpeg$/.test(p)) return true; // the bundled ffmpeg "exists"; spawning it still fails, so the mocked scan runs
      var prefix = p.replace(/\/$/, "") + "/";
      for (var k in files) if (k.indexOf(prefix) === 0) return true;
      return false;
    },
    readFileSync: function (p) {
      if (!(p in files)) throw enoent(p);
      return files[p];
    },
    writeFileSync: function (p, data) {
      files[p] = String(data);
    },
    appendFileSync: function (p, data) {
      files[p] = (files[p] || "") + String(data);
    },
    renameSync: function (a, b) {
      if (a in files) {
        files[b] = files[a];
        delete files[a];
      }
    },
    unlinkSync: function (p) {
      delete files[p];
    },
    mkdirSync: function () {},
    readdirSync: function () {
      return [];
    },
    statSync: function (p) {
      if (!(p in files)) throw enoent(p);
      return {
        size: files[p].length,
        mtimeMs: Date.now(),
        isFile: function () {
          return true;
        },
        isDirectory: function () {
          return false;
        },
      };
    },
    copyFileSync: function (a, b) {
      if (a in files) files[b] = files[a];
    },
    chmodSync: function () {},
    promises: {
      readFile: function (p) {
        return p in files ? Promise.resolve(files[p]) : Promise.reject(enoent(p));
      },
      writeFile: function (p, d) {
        files[p] = String(d);
        return Promise.resolve();
      },
    },
  };

  // ---------- path (posix subset) ----------
  var normalize = function (p) {
    var abs = p.charAt(0) === "/";
    var out = [];
    p.split("/").forEach(function (seg) {
      if (!seg || seg === ".") return;
      if (seg === "..") out.pop();
      else out.push(seg);
    });
    return (abs ? "/" : "") + out.join("/");
  };
  var path = {
    sep: "/",
    delimiter: ":",
    join: function () {
      return normalize(Array.prototype.slice.call(arguments).filter(Boolean).join("/"));
    },
    resolve: function () {
      var parts = Array.prototype.slice.call(arguments);
      var acc = "";
      parts.forEach(function (s) {
        if (!s) return;
        acc = s.charAt(0) === "/" ? s : acc + "/" + s;
      });
      return normalize(acc || "/");
    },
    normalize: normalize,
    dirname: function (p) {
      var i = p.replace(/\/$/, "").lastIndexOf("/");
      return i <= 0 ? "/" : p.slice(0, i);
    },
    basename: function (p, ext) {
      var b = p.replace(/\/$/, "").split("/").pop() || "";
      return ext && b.slice(-ext.length) === ext ? b.slice(0, -ext.length) : b;
    },
    extname: function (p) {
      var b = p.split("/").pop() || "";
      var i = b.lastIndexOf(".");
      return i > 0 ? b.slice(i) : "";
    },
    relative: function (a, b) {
      return b;
    },
    isAbsolute: function (p) {
      return p.charAt(0) === "/";
    },
  };
  path.posix = path;

  var EventEmitter = function () {
    this._h = {};
  };
  EventEmitter.prototype.on = function (n, f) {
    (this._h[n] = this._h[n] || []).push(f);
    return this;
  };
  EventEmitter.prototype.once = EventEmitter.prototype.on;
  EventEmitter.prototype.off = function () {
    return this;
  };
  EventEmitter.prototype.removeListener = EventEmitter.prototype.off;
  EventEmitter.prototype.emit = function (n) {
    var a = Array.prototype.slice.call(arguments, 1);
    (this._h[n] || []).forEach(function (f) {
      f.apply(null, a);
    });
    return true;
  };

  var fakeChild = function () {
    var c = new EventEmitter();
    c.stdout = new EventEmitter();
    c.stderr = new EventEmitter();
    c.stdin = { write: function () {}, end: function () {} };
    c.kill = function () {};
    setTimeout(function () {
      c.emit("error", new Error("child processes are not available in the preview harness"));
    }, 0);
    return c;
  };

  var modules = {
    "fs": fs,
    "fs/promises": fs.promises,
    "path": path,
    "os": {
      platform: function () {
        return "darwin";
      },
      homedir: function () {
        return "/Users/preview";
      },
      tmpdir: function () {
        return "/tmp";
      },
      arch: function () {
        return "arm64";
      },
      release: function () {
        return "25.0.0";
      },
      cpus: function () {
        return new Array(10).fill({ model: "preview" });
      },
      EOL: "\n",
    },
    "child_process": {
      spawn: fakeChild,
      execFile: fakeChild,
      spawnSync: function () {
        return { status: 1, stdout: "", stderr: "not available in preview" };
      },
      execFileSync: function () {
        throw new Error("not available in preview");
      },
    },
    "url": {
      pathToFileURL: function (p) {
        return { href: "file://" + encodeURI(p) };
      },
      fileURLToPath: function (u) {
        return decodeURI(String(u).replace(/^file:\/\//, ""));
      },
    },
    "crypto": {
      randomUUID: function () {
        return crypto.randomUUID();
      },
    },
    "events": EventEmitter,
    "util": {
      promisify: function (f) {
        return f;
      },
    },
    "buffer": {},
    "stream": {},
  };

  window.require = function (name) {
    var key = String(name).replace(/^node:/, "");
    return modules[key] || {};
  };

  window.process = {
    platform: "darwin",
    arch: "arm64",
    env: {},
    versions: {},
    release: { name: "browser" },
    pid: 1,
    uptime: function () {
      return 1;
    },
    memoryUsage: function () {
      return { rss: 0, heapUsed: 0, external: 0 };
    },
    on: function () {},
    cwd: function () {
      return "/";
    },
  };

  window.cep = {
    util: { openURLInDefaultBrowser: function () {} },
    fs: {},
    process: {},
  };

  // ---------- host ----------
  var clipInfo = {
    trackType: "audio",
    trackIndex: 0,
    clipName: "voiceover_take3.wav",
    mediaPath: "/Users/preview/Media/voiceover_take3.wav",
    nodeId: "000f4288",
    sequenceName: "Main edit",
    sequenceFps: 25,
    sourceFps: 25,
    fpsMismatch: false,
    sourceInPoint: 0,
    sourceOutPoint: 64.2,
    speedFactor: 1,
  };

  var MOCK_HOST = {
    ping: function () {
      return "pong";
    },
    getSelectedClipInfoIfAny: function () {
      return hasClip ? clipInfo : null;
    },
    getSelectedClipInfo: function () {
      if (!hasClip) throw new Error("Select exactly one clip on the timeline first.");
      return clipInfo;
    },
    getDocumentsFolderPath: function () {
      return "/Users/preview/Documents";
    },
    getProjectFolderPath: function () {
      return "/Users/preview/Projects";
    },
    getSelectedCutPieceInfo: function () {
      return [];
    },
    // Bridge (AE) panel.
    checkPendingManifest: function () {
      var manifestPath = "/Users/preview/Documents/AI Voice Master Tool/Bridge/manifest.json";
      if (!hasSent) return { exists: false, manifestPath: manifestPath };
      var now = new Date();
      var pad = function (n) {
        return (n < 10 ? "0" : "") + n;
      };
      return {
        exists: true,
        createdAt:
          now.getFullYear() +
          "-" +
          pad(now.getMonth() + 1) +
          "-" +
          pad(now.getDate()) +
          " " +
          pad(now.getHours()) +
          ":" +
          pad(now.getMinutes()),
        audioMode: "segments",
        itemCount: 20,
        videoItemCount: 0,
        sequenceName: "Episode 12 — rough",
        mediaFileName: "voiceover_take3.wav",
        manifestPath: manifestPath,
        manifestModifiedAt: now.toString(),
        manifestSizeBytes: 4810,
      };
    },
  };
  window.__PREVIEW_MOCK_HOST__ = MOCK_HOST;

  var hostEnv = {
    appName: "PPRO",
    appVersion: "26.0",
    appLocale: "en_US",
    appUILocale: "en_US",
    appId: "PPRO",
    isAppOnline: true,
    appSkinInfo: {
      baseFontFamily: "Helvetica",
      baseFontSize: 10,
      appBarBackgroundColor: { antialiasLevel: 0, type: 1, color: { red: 35, green: 35, blue: 35, alpha: 255 } },
      panelBackgroundColor: { antialiasLevel: 0, type: 1, color: { red: 35, green: 35, blue: 35, alpha: 255 } },
      appBarBackgroundColorSRGB: { antialiasLevel: 0, type: 1, color: { red: 35, green: 35, blue: 35, alpha: 255 } },
      panelBackgroundColorSRGB: { antialiasLevel: 0, type: 1, color: { red: 35, green: 35, blue: 35, alpha: 255 } },
      systemHighlightColor: { red: 255, green: 159, blue: 46, alpha: 255 },
    },
  };

  var answer = function (script) {
    var m = /\]\.(\w+)\(([\s\S]*?)\);\s*JSON\.stringify\(res\)/.exec(script);
    if (!m) return "undefined"; // evalES / evalFile
    var fn = MOCK_HOST[m[1]];
    if (!fn) return JSON.stringify({});
    try {
      var args = m[2].trim() ? JSON.parse("[" + m[2] + "]") : [];
      var res = fn.apply(null, args);
      return res === undefined ? "undefined" : JSON.stringify(res);
    } catch (e) {
      return JSON.stringify({ name: "Error", message: e.message });
    }
  };

  var cepHost = {
    evalScript: function (script, cb) {
      var out = answer(script);
      setTimeout(function () {
        if (cb) cb(out);
      }, 30);
    },
    getHostEnvironment: function () {
      return JSON.stringify(hostEnv);
    },
    getSystemPath: function () {
      return "/Users/preview/ext";
    },
    getCurrentApiVersion: function () {
      return JSON.stringify({ major: 11, minor: 0, micro: 0 });
    },
    getExtensions: function () {
      return "[]";
    },
    getNetworkPreferences: function () {
      return "{}";
    },
    getCurrentImsUserId: function () {
      return "";
    },
    invokeSync: function () {
      return "";
    },
    invokeAsync: function () {},
  };
  window.__adobe_cep__ = new Proxy(cepHost, {
    get: function (target, prop) {
      if (prop in target) return target[prop];
      return function () {
        return "";
      };
    },
  });
})();
