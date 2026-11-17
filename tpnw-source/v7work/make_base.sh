#!/bin/sh
# Rebuild the v7 code base from Gemini's v7 upload: run from tpnw-source/v7work
set -e
python3 patch_search.py ../incoming/PF-gemini-v7-upload.html /tmp/pf_b1.html
python3 apply_fixes.py /tmp/pf_b1.html base-v7.html fixes_xf_v7.json fixes_timers.json fixes_link.json fixes_relay.json fixes_myth.json fixes_labels7.json
echo "now: cd .. && node build.mjs v7work/base-v7.html ../PF.html v7work/data7_final.json v7work/empty.json v7work/empty.json"
