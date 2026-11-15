#!/usr/bin/env bash
# Tell IndexNow search engines (Bing, Yandex, Seznam, Naver, Yep) that the sitemap URLs changed.
# usage: scripts/indexnow.sh   (after a deploy that changed public pages; the key file is site/761d5166f6bfa18a96fa0c61d4eaf39f.txt)
set -euo pipefail
KEY=761d5166f6bfa18a96fa0c61d4eaf39f
URLS=$(curl -s https://seismicityatlas.org/sitemap.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//' | python3 -c 'import json,sys;print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')
[ "$URLS" != "[]" ] || { echo "sitemap not live yet"; exit 1; }
curl -s -o /dev/null -w "IndexNow HTTP %{http_code}\n" -H 'Content-Type: application/json; charset=utf-8' \
  -d "{\"host\":\"seismicityatlas.org\",\"key\":\"$KEY\",\"keyLocation\":\"https://seismicityatlas.org/$KEY.txt\",\"urlList\":$URLS}" \
  https://api.indexnow.org/indexnow
