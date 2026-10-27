# Hong Kong OTA TV Guide

A static, mobile-friendly guide for Hong Kong over-the-air TV services. Programme data comes from [IPTV-EPG.org](https://iptv-epg.org/)'s Hong Kong XMLTV feed and is rendered in Hong Kong time.

## Features

- Hide or restore channels; choices are saved in the browser.
- Sort by channel number or name.
- Programme cards use category colours when the feed supplies a category, with a small title/description fallback for common types.
- A GitHub Actions workflow refreshes the data and deploys the site every six hours.

## Publish with GitHub Pages

1. Create a GitHub repository and push this folder to its `main` branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Run **Actions → Update and publish TV guide → Run workflow** once, or wait for the first push workflow to finish.

The workflow downloads the source immediately before deployment, so the published site receives current listings without committing the downloaded feed back to the repository.

## Refresh locally

```sh
python3 scripts/update_epg.py
python3 -m http.server 8000 --directory public
```

Then visit `http://localhost:8000`.
