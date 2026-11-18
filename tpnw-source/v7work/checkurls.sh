#!/bin/bash
while IFS=$'\t' read -r short url; do
  code=$(curl -sS -L --max-time 25 -o /dev/null -w "%{http_code}" -A "Mozilla/5.0 (compatible; link-checker)" "$url" 2>/dev/null || echo "ERR")
  echo -e "$code\t$short\t$url"
done < urls.txt
