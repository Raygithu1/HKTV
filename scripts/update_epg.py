#!/usr/bin/env python3
"""Build the small, static guide used by the GitHub Pages site.

The upstream XMLTV document is deliberately not shipped to visitors.  This
script keeps only the terrestrial-channel selection and their schedules.
"""
from __future__ import annotations

import datetime as dt
import json
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

SOURCE_URL = "https://iptv-epg.org/files/epg-hk.xml"
OUTPUT = Path(__file__).parents[1] / "public" / "data" / "guide.json"

# IPTV-EPG's Hong Kong feed exposes these local free-to-air TVB services.
# Numbers are Hong Kong DTT logical channel numbers, used only for display/sort.
OTA_CHANNELS = {
    "TVBJade.hk": (81, "TVB Jade"),
    "TVBJ2.hk": (82, "TVB J2"),
    "TVBNewsChannel.hk": (83, "TVB News"),
    "TVBPearl.hk": (84, "TVB Pearl"),
    "TVBFinanceAndInformationChannel.hk": (85, "TVB Finance, Sports & Information"),
}


def text(element: ET.Element, tag: str, lang: str | None = None) -> str:
    choices = element.findall(tag)
    if lang:
        for choice in choices:
            if choice.get("lang") == lang and choice.text:
                return choice.text.strip()
    for choice in choices:
        if choice.text:
            return choice.text.strip()
    return ""


def parse_time(value: str) -> str:
    parsed = dt.datetime.strptime(value, "%Y%m%d%H%M%S %z")
    return parsed.astimezone(dt.timezone(dt.timedelta(hours=8))).isoformat()


def program_type(title: str, description: str, upstream: str) -> str:
    if upstream:
        return upstream.lower()
    words = (title + " " + description).lower()
    if any(word in words for word in ("news", "新聞", "財經", "market")):
        return "news"
    if any(word in words for word in ("movie", "film", "cinema", "電影")):
        return "movie"
    if any(word in words for word in ("sport", "football", "soccer", "體育", "足球")):
        return "sports"
    if any(word in words for word in ("kids", "cartoon", "動畫", "兒童")):
        return "kids"
    if any(word in words for word in ("drama", "series", "劇集")):
        return "drama"
    if any(word in words for word in ("food", "travel", "documentary", "美食", "旅遊")):
        return "lifestyle"
    return "general"


def main() -> None:
    print(f"Downloading {SOURCE_URL}")
    with urllib.request.urlopen(SOURCE_URL, timeout=90) as response:
        root = ET.parse(response).getroot()

    channels = []
    for channel in root.findall("channel"):
        channel_id = channel.get("id", "")
        if channel_id not in OTA_CHANNELS:
            continue
        number, fallback_name = OTA_CHANNELS[channel_id]
        icon = channel.find("icon")
        channels.append({
            "id": channel_id,
            "number": number,
            "name": text(channel, "display-name").removeprefix("HK - ") or fallback_name,
            "icon": icon.get("src", "") if icon is not None else "",
        })

    programmes = []
    for programme in root.findall("programme"):
        if programme.get("channel") not in OTA_CHANNELS:
            continue
        title_zh = text(programme, "title", "zh")
        title_en = text(programme, "title", "en")
        title = title_en or title_zh or "Untitled programme"
        description = text(programme, "desc", "zh") or text(programme, "desc", "en")
        category = text(programme, "category", "en") or text(programme, "category")
        programmes.append({
            "channel": programme.get("channel"),
            "start": parse_time(programme.get("start", "")),
            "stop": parse_time(programme.get("stop", "")),
            "title": title,
            "originalTitle": title_zh if title_en and title_zh != title_en else "",
            "translated": bool(title_en and title_zh and title_en != title_zh),
            "description": description,
            "category": program_type(title, description, category),
        })

    payload = {
        "source": {"name": "IPTV-EPG.org", "url": "https://iptv-epg.org/", "feed": SOURCE_URL},
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "timezone": "Asia/Hong_Kong",
        "channels": sorted(channels, key=lambda item: item["number"]),
        "programmes": programmes,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Saved {len(channels)} channels and {len(programmes)} programmes to {OUTPUT}")


if __name__ == "__main__":
    main()
