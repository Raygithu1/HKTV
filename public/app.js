(function () {
  "use strict";

  var TZ = "Asia/Hong_Kong";
  var PPM = 2.4;
  var DATA = null;
  var days = [];
  var selected = null;

  var partsFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  var dateFmt = new Intl.DateTimeFormat("en-HK", {
    timeZone: TZ, dateStyle: "medium"
  });
  var timeFmtShort = new Intl.DateTimeFormat("en-HK", {
    timeZone: TZ, hour: "numeric", minute: "2-digit"
  });
  var fullFmt = new Intl.DateTimeFormat("en-HK", {
    timeZone: TZ, weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  });

  function pt(o) {
    return {
      y: +o.year, mo: +o.month, d: +o.day,
      h: +o.hour % 24, mi: +o.minute, s: +o.second
    };
  }
  function ptParts(date) {
    var o = {};
    partsFmt.formatToParts(date).forEach(function (p) { o[p.type] = p.value; });
    return pt(o);
  }
  function tzOffsetMs(utcMs) {
    var p = ptParts(new Date(utcMs));
    var asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    return asUtc - utcMs;
  }
  function ptWallToUtc(y, mo, d, h, mi) {
    var ms = Date.UTC(y, mo - 1, d, h, mi, 0);
    for (var i = 0; i < 3; i++) {
      ms = Date.UTC(y, mo - 1, d, h, mi, 0) - tzOffsetMs(ms);
    }
    return ms;
  }
  function dayKey(ts) {
    var p = ptParts(new Date(ts));
    return p.y + "-" + pad(p.mo) + "-" + pad(p.d);
  }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function todayKey() { return dayKey(Date.now()); }
  function dayObj(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    return { key: key, y: +m[1], mo: +m[2], d: +m[3] };
  }
  function isToday(key) { return key === todayKey(); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function $ (sel) { return document.querySelector(sel); }

  function tickClock() {
    var now = new Date();
    var p = ptParts(now);
    var h12 = ((p.h + 11) % 12) + 1;
    var ampm = p.h < 12 ? "AM" : "PM";
    $("#clock-time").textContent =
      h12 + ":" + pad(p.mi) + ":" + pad(p.s) + " " + ampm;
    $("#clock-date").textContent = dateFmt.format(now) + " HKT";
  }

  function buildDays() {
    var set = {};
    DATA.programmes.forEach(function (p) {
      set[dayKey(p.start_ts * 1000)] = true;
      set[dayKey(p.stop_ts * 1000)] = true;
    });
    days = Object.keys(set).sort().slice(0, 7);
    var now = todayKey();
    selected = days.indexOf(now) !== -1 ? now : (days[0] || now);
  }

  function renderNav() {
    var nav = $("#day-nav");
    nav.innerHTML = "";
    days.forEach(function (key) {
      var d = dayObj(key);
      var label;
      if (isToday(key)) label = "Today";
      else label = fullFmt.format(new Date(Date.UTC(d.y, d.mo - 1, d.d, 12)));
      var btn = el("button", "day-btn" + (key === selected ? " active" : ""), label);
      btn.addEventListener("click", function () {
        selected = key;
        renderNav();
        render();
      });
      nav.appendChild(btn);
    });
    if (!nav.childElementCount) {
      var d = dayObj(days[0] || todayKey());
      var b = el("button", "day-btn active", fullFmt.format(new Date(Date.UTC(d.y, d.mo - 1, d.d, 12))));
      nav.appendChild(b);
    }
  }

  function renderLegend() {
    var legend = $("#legend");
    legend.innerHTML = "";
    var wrap = el("div");
    var nowSpan = el("span", "cur", "\u25CF Now");
    wrap.appendChild(nowSpan);
    var timeSpan = el("span", null, "All times Hong Kong");
    wrap.appendChild(timeSpan);
    legend.appendChild(wrap);
  }

  function shade(hex, amt) {
    var c = (hex || "#333").replace("#", "");
    if (c.length === 3) c = c.replace(/./g, function (x) { return x + x; });
    var num = parseInt(c, 16);
    if (isNaN(num)) num = 0x333333;
    var r = Math.round((num >> 16) * (1 - amt) + 18 * amt);
    var g = Math.round(((num >> 8) & 0xff) * (1 - amt) + 22 * amt);
    var b = Math.round((num & 0xff) * (1 - amt) + 26 * amt);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function syncSlider() {
    var guideEl = $("#guide");
    var sliderEl = $("#time-slider");
    if (!guideEl || !sliderEl) return;
    var max = guideEl.scrollWidth - guideEl.clientWidth;
    if (max < 0) max = 0;
    sliderEl.max = max;
    sliderEl.value = guideEl.scrollLeft;
    sliderEl.disabled = max === 0;
  }

  function render() {
    var guide = $("#guide");
    guide.innerHTML = "";
    guide.hidden = false;
    $("#status").hidden = true;

    var day = dayObj(selected);
    var midnight = ptWallToUtc(day.y, day.mo, day.d, 0, 0);
    var nextMid = ptWallToUtc(day.y, day.mo, day.d, 24, 0);
    var dayLenMin = (nextMid - midnight) / 60000;
    var trackW = Math.round(dayLenMin * PPM);
    var now = Date.now();

    // Ruler row
    var rulerRow = el("div", "ruler-row");
    var chCorner = el("div", "ch-col ruler-corner", "Channel");
    rulerRow.appendChild(chCorner);
    var numCorner = el("div", "num-col ruler-corner", "No.");
    rulerRow.appendChild(numCorner);
    var ruler = el("div", "ruler");
    ruler.style.width = trackW + "px";
    var hours = Math.round(dayLenMin / 60);
    for (var h = 0; h < hours; h++) {
      var tick = el("div", "tick");
      tick.style.left = Math.round(h * 60 * PPM) + "px";
      var lab = el("span", null, timeFmtShort.format(new Date(midnight + h * 3600000)));
      tick.appendChild(lab);
      ruler.appendChild(tick);
    }
    rulerRow.appendChild(ruler);
    guide.appendChild(rulerRow);

    DATA.channels.forEach(function (ch) {
      var row = el("div", "chan-row");
      var col = el("div", "ch-col");
      var swatch = document.createElement("span");
      swatch.style.cssText = "width:10px;height:100%;min-height:34px;border-radius:3px;flex:none;background:" +
        (ch.color || "#555") + ";";
      col.appendChild(swatch);
      var name = el("div", "ch-name");
      name.appendChild(el("div", "", ch.name));
      col.appendChild(name);
      row.appendChild(col);
      row.appendChild(el("div", "num-col", ch.number));

      var track = el("div", "track");
      track.style.width = trackW + "px";

      if (now >= midnight && now < nextMid) {
        var line = el("div", "now-line");
        line.style.left = Math.max(0, Math.round(((now - midnight) / 60000) * PPM)) + "px";
        track.appendChild(line);
      }

      DATA.programmes
        .filter(function (p) { return p.channel === ch.id && p.stop_ts * 1000 > midnight && p.start_ts * 1000 < nextMid; })
        .sort(function (a, b) { return a.start_ts - b.start_ts; })
        .forEach(function (p) {
          var s = Math.max(p.start_ts * 1000, midnight);
          var e = Math.min(p.stop_ts * 1000, nextMid);
          var left = Math.round(((s - midnight) / 60000) * PPM);
          var width = Math.max(3, Math.round(((e - s) / 60000) * PPM));
          var block = el("div", "prog");
          block.style.left = left + "px";
          block.style.width = width + "px";
          var hue = ch.color || "#333";
          block.style.background = shade(hue, 0.25);
          block.style.borderLeft = "3px solid " + hue;
          var title = el("div", "p-title", p.title || "(no title)");
          if (p.translated) {
            var badge = el("span", "translated", "EN");
            title.appendChild(badge);
          }
          block.appendChild(title);
          if (width > 130) {
            var meta = el("div", "p-meta");
            var m = timeFmtShort.format(new Date(p.start_ts * 1000)) + " \u2013 " + timeFmtShort.format(new Date(p.stop_ts * 1000));
            if (p.originalTitle) m += " \u00b7 " + p.originalTitle;
            if (p.category) m += " \u00b7 " + p.category;
            meta.textContent = m;
            block.appendChild(meta);
          }
          var tip = p.title;
          if (p.originalTitle) tip += "\n" + p.originalTitle;
          if (p.description) tip += "\n" + p.description;
          block.title = tip;
          track.appendChild(block);
        });

      row.appendChild(track);
      guide.appendChild(row);
    });

    guide.hidden = false;
    if (now >= midnight && now < nextMid) {
      guide.scrollLeft = Math.max(0, Math.round(((now - midnight) / 60000) * PPM) - 160);
    }
    syncSlider();
  }

  function init() {
    PPM = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ppm")) || PPM;
    tickClock();
    setInterval(tickClock, 1000);

    var guideEl = $("#guide");
    var sliderEl = $("#time-slider");
    if (sliderEl) {
      sliderEl.addEventListener("input", function () {
        guideEl.scrollLeft = +sliderEl.value;
      });
    }
    if (guideEl) {
      guideEl.addEventListener("scroll", function () {
        if (sliderEl) sliderEl.value = guideEl.scrollLeft;
      });
    }
    window.addEventListener("resize", syncSlider);

    fetch("data/guide.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        DATA = data;
        var foot = $("#source");
        var a = document.createElement("a");
        a.textContent = "Data: " + (data.source && data.source.name ? data.source.name : "IPTV-EPG.org");
        a.href = data.source && data.source.url ? data.source.url : "https://iptv-epg.org/";
        a.target = "_blank";
        a.style.color = "inherit";
        foot.innerHTML = "";
        foot.appendChild(a);
        $("#generated").textContent =
          "Updated " + new Intl.DateTimeFormat("en-HK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Hong_Kong" }).format(new Date(data.generatedAt)) + " HKT";

        if (!data.programmes.length) {
          $("#status").textContent = "No schedule data available. Run the guide builder to refresh guide.json.";
          return;
        }
        buildDays();
        renderNav();
        renderLegend();
        render();
      })
      .catch(function (err) {
        $("#status").textContent = "Could not load the guide: " + err.message;
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
