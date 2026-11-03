export const APP_JS = String.raw`
(function () {
  "use strict";

  var configNode = document.getElementById("app-config");
  var config = { tool: "video", strings: {} };
  try {
    if (configNode) config = JSON.parse(configNode.textContent || "{}");
  } catch (error) {
    /* keep defaults */
  }
  var S = config.strings || {};

  var form = document.getElementById("search-form");
  var input = document.getElementById("s_input");
  var submit = document.getElementById("submit");
  var pasteBtn = document.getElementById("paste");
  var toastNode = document.getElementById("toast");
  var toastTimer = null;

  function toast(message) {
    if (!toastNode) return;
    toastNode.textContent = message;
    toastNode.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastNode.classList.remove("is-visible");
    }, 3200);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function setBusy(busy) {
    if (!submit) return;
    submit.disabled = busy;
    var label = submit.querySelector(".btn-label");
    if (label) label.textContent = busy ? (S.busy || "Retrieving...") : (S.submit || "Download");
  }

  function removeExisting() {
    var old = document.getElementById("result");
    if (old) old.parentNode.removeChild(old);
    var oldAlert = document.querySelector(".alert");
    if (oldAlert) oldAlert.parentNode.removeChild(oldAlert);
  }

  function alertBox(message, hint) {
    var box = el("div", "alert");
    box.setAttribute("role", "alert");
    box.appendChild(el("b", null, message));
    if (hint) box.appendChild(el("span", null, hint));
    return box;
  }

  function downloadItem(item) {
    var li = el("li", "item");

    if (item.thumbnail) {
      var img = document.createElement("img");
      img.src = item.thumbnail;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.width = 56;
      img.height = 56;
      li.appendChild(img);
    } else {
      li.appendChild(el("span", "thumb-fallback"));
    }

    var body = el("div", "item-body");
    body.appendChild(el("b", null, item.label));
    var meta = [];
    if (item.quality) meta.push(item.quality);
    if (item.width && item.height) meta.push(item.width + "x" + item.height);
    if (meta.length === 0) meta.push(item.kind === "video" ? "MP4" : "JPG");
    body.appendChild(el("span", "muted", meta.join(" - ")));
    body.appendChild(el("span", "filename", item.filename));
    li.appendChild(body);

    if (config.tool === "audio" && item.kind === "video") {
      var audioBtn = el("button", "btn ghost", S.audio || "Extract audio");
      audioBtn.type = "button";
      audioBtn.setAttribute("data-audio", item.href);
      audioBtn.setAttribute("data-name", item.filename);
      li.appendChild(audioBtn);
    }

    var link = el("a", "btn primary", (S.save || S.submit || "Save") + " ↓");
    link.href = item.href;
    link.setAttribute("download", item.filename);
    link.setAttribute("rel", "nofollow noopener");
    li.appendChild(link);

    return li;
  }

  function triggerDownload(link) {
    // Browsers only honor the "download" attribute on an anchor that is part of
    // the document, so we clone the save link, click it, then discard it.
    var tmp = document.createElement("a");
    tmp.href = link.href || "";
    tmp.download = link.getAttribute("download") || "";
    tmp.rel = "nofollow noopener";
    document.body.appendChild(tmp);
    tmp.click();
    document.body.removeChild(tmp);
  }

  function saveAll() {
    var section = document.getElementById("result");
    if (!section) return;
    var links = section.querySelectorAll('.item a[download]');
    var count = links.length;
    if (count === 0) return;
    var btn = section.querySelector("[data-save-all]");
    if (btn) btn.disabled = true;
    var i;
    for (i = 0; i < count; i += 1) {
      (function (link, idx) {
        setTimeout(function () {
          triggerDownload(link);
        }, idx * 700);
      })(links[i], i);
    }
    setTimeout(function () {
      if (btn) btn.disabled = false;
      toast((S.savedAll || "Saved all") + " \xB7 " + count);
    }, count * 700 + 200);
  }

  function renderResult(result) {
    removeExisting();

    var container = document.getElementById("result-slot") || document.querySelector(".hero-inner");
    if (!container) return;

    var section = el("section", "result");
    section.id = "result";
    section.setAttribute("aria-live", "polite");

    var head = el("div", "result-head");
    var left = el("div");
    left.appendChild(el("h2", null, S.ready || "Ready to save"));
    if (result.author && result.author.username) {
      var byline = el("p", "muted byline");
      if (result.author.avatar) {
        var face = document.createElement("img");
        face.className = "avatar";
        face.src = result.author.avatar;
        face.alt = "";
        face.loading = "lazy";
        face.decoding = "async";
        face.referrerPolicy = "no-referrer";
        face.width = 28;
        face.height = 28;
        byline.appendChild(face);
      }
      var name = "@" + result.author.username;
      if (result.author.fullName) name += " · " + result.author.fullName;
      byline.appendChild(el("span", null, (S.author || "Author") + ": " + name));
      left.appendChild(byline);
    }
    head.appendChild(left);
    head.appendChild(el("span", "badge", result.provider));
    section.appendChild(head);

    if (result.caption) section.appendChild(el("p", "caption", result.caption));

    if (result.items.length > 1) {
      var actions = el("div", "result-actions");
      var allBtn = el("button", "btn primary save-all", (S.saveAll || "Save all") + " \xB7 " + result.items.length);
      allBtn.type = "button";
      allBtn.setAttribute("data-save-all", "1");
      actions.appendChild(allBtn);
      section.appendChild(actions);
    }

    var list = el("ul", "items");
    for (var i = 0; i < result.items.length; i += 1) {
      list.appendChild(downloadItem(result.items[i]));
    }
    section.appendChild(list);

    if (result.expiresAt) {
      var when = new Date(result.expiresAt * 1000).toISOString().replace("T", " ").slice(0, 16);
      section.appendChild(el("p", "fineprint", (S.expires || "Link expires") + ": " + when + " UTC"));
    }

    if (result.warnings && result.warnings.length) {
      var warnings = el("ul", "warnings");
      for (var w = 0; w < result.warnings.length; w += 1) {
        warnings.appendChild(el("li", null, result.warnings[w]));
      }
      section.appendChild(warnings);
    }

    container.appendChild(section);
    section.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showError(code, message, hint) {
    removeExisting();
    var container = document.getElementById("result-slot") || document.querySelector(".hero-inner");
    if (!container) return;
    var text = S[code] || message || S.upstream_error || "Something went wrong.";
    container.appendChild(alertBox(text, hint));
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      if (!window.fetch) return;
      event.preventDefault();

      var value = input ? input.value.trim() : "";
      if (!value) {
        showError("invalid_url", S.invalid_url, null);
        return;
      }

      setBusy(true);
      var data = new FormData();
      data.set("q", value);

      fetch("/api/search", { method: "POST", body: data, headers: { accept: "application/json" } })
        .then(function (response) {
          return response.json().then(function (body) {
            return { status: response.status, body: body };
          });
        })
        .then(function (payload) {
          if (payload.body && payload.body.ok) {
            renderResult(payload.body.result);
          } else {
            var body = payload.body || {};
            showError(body.code, body.message, body.hint);
          }
        })
        .catch(function () {
          showError("network", S.network, null);
        })
        .then(function () {
          setBusy(false);
          try {
            history.replaceState(null, "", window.location.pathname + "?q=" + encodeURIComponent(value));
          } catch (error) {
            /* ignore */
          }
        });
    });
  }

  if (pasteBtn && input) {
    pasteBtn.addEventListener("click", function () {
      var clearing = pasteBtn.getAttribute("data-clearing") === "1";
      if (clearing) {
        input.value = "";
        pasteBtn.textContent = S.paste || "Paste";
        pasteBtn.removeAttribute("data-clearing");
        input.focus();
        return;
      }
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        input.focus();
        toast("Clipboard is not available. Paste manually.");
        return;
      }
      navigator.clipboard.readText().then(function (text) {
        input.value = text.trim();
        pasteBtn.textContent = S.clear || "Clear";
        pasteBtn.setAttribute("data-clearing", "1");
        input.focus();
      }).catch(function () {
        input.focus();
      });
    });
  }

  if (input && pasteBtn) {
    input.addEventListener("input", function () {
      if (input.value.length === 0) {
        pasteBtn.textContent = S.paste || "Paste";
        pasteBtn.removeAttribute("data-clearing");
      }
    });
  }

  var installButton = document.getElementById("install-app");
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    if (installButton) installButton.hidden = false;
  });
  if (installButton) {
    installButton.addEventListener("click", function () {
      if (!deferredPrompt) {
        toast("Use your browser menu and choose Add to Home Screen.");
        return;
      }
      deferredPrompt.prompt();
      deferredPrompt = null;
      installButton.hidden = true;
    });
  }

  // Live ledger: the home page is rendered per request, then quietly refreshed
  // once a minute so an open tab keeps showing real numbers. /api/v1/stats is
  // aggregate-only and is not itself counted as an API call.
  var ledger = document.querySelector(".ledger");
  if (ledger && window.fetch) {
    var lastStats = 0;

    function num(value) {
      return Math.round(Number(value) || 0).toLocaleString("en-US");
    }

    function bytes(value) {
      var units = ["B", "KB", "MB", "GB", "TB"];
      var size = Number(value) || 0;
      var unit = 0;
      while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
      }
      var digits = unit === 0 || size >= 10 ? 0 : 1;
      return size.toFixed(digits) + " " + units[unit];
    }

    function clock(iso) {
      var date = new Date(iso);
      if (isNaN(date.getTime())) return "—";
      return date.toISOString().slice(11, 16) + " UTC";
    }

    function put(name, text) {
      var node = ledger.querySelector('[data-stat="' + name + '"]');
      if (node) node.textContent = text;
    }

    function paint(data) {
      var totals = data.totals || {};
      var today = data.today || {};
      put("downloads", num(totals.downloads));
      put("bytes", bytes(totals.bytes));
      put("resolves", num(totals.resolves));
      put("today", num(today.downloads) + " " + (S.saved || "saved"));
      put("updated", clock(data.updated_at));

      var week = data.last_7_days || [];
      var bars = ledger.querySelectorAll(".ledger-bars span");
      var peak = 1;
      var i;
      for (i = 0; i < week.length; i += 1) peak = Math.max(peak, Number(week[i].downloads) || 0);
      for (i = 0; i < bars.length && i < week.length; i += 1) {
        var count = Number(week[i].downloads) || 0;
        bars[i].style.height = Math.max(4, Math.round((count / peak) * 100)) + "%";
        bars[i].className = count === 0 ? "is-zero" : "";
      }
    }

    function refreshStats() {
      lastStats = Date.now();
      fetch("/api/v1/stats", { headers: { accept: "application/json" }, cache: "no-store" })
        .then(function (response) {
          return response.json();
        })
        .then(function (payload) {
          if (payload && payload.ok && payload.data && payload.data.available) paint(payload.data);
        })
        .catch(function () {
          /* counters are decoration; never break the page for them */
        });
    }

    refreshStats();
    setInterval(refreshStats, 60000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && Date.now() - lastStats > 60000) refreshStats();
    });
  }

  function encodeWav(buffer) {
    var channels = buffer.numberOfChannels;
    var length = buffer.length;
    var sampleRate = buffer.sampleRate;
    var blockAlign = channels * 2;
    var dataSize = length * blockAlign;
    var view = new DataView(new ArrayBuffer(44 + dataSize));

    function writeText(offset, text) {
      for (var i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
    }

    writeText(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeText(8, "WAVE");
    writeText(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeText(36, "data");
    view.setUint32(40, dataSize, true);

    var data = [];
    for (var c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));

    var offset = 44;
    for (var i = 0; i < length; i += 1) {
      for (var channel = 0; channel < channels; channel += 1) {
        var sample = Math.max(-1, Math.min(1, data[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([view.buffer], { type: "audio/wav" });
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest ? event.target.closest("[data-audio]") : null;
    if (!button) return;

    var url = button.getAttribute("data-audio");
    var name = (button.getAttribute("data-name") || "audio").replace(/\.[a-z0-9]+$/i, "") + ".wav";
    var original = button.textContent;

    button.disabled = true;
    button.textContent = S.audioBusy || "Extracting...";

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("fetch failed");
        return response.arrayBuffer();
      })
      .then(function (buffer) {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) throw new Error("no audio context");
        var context = new Ctx();
        return context.decodeAudioData(buffer.slice(0)).then(function (decoded) {
          var blob = encodeWav(decoded);
          var link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = name;
          document.body.appendChild(link);
          link.click();
          setTimeout(function () {
            URL.revokeObjectURL(link.href);
            link.remove();
          }, 4000);
          context.close();
          toast("Audio saved as " + name);
        });
      })
      .catch(function () {
        toast("This browser could not decode the audio track. Download the video instead.");
      })
      .then(function () {
        button.disabled = false;
        button.textContent = original;
      });
  });

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest ? event.target.closest("[data-save-all]") : null;
    if (!trigger) return;
    saveAll();
  });
})();
`;
