import json
lib = open('../peer/package/dist/peerjs.min.js').read().replace('//# sourceMappingURL=peerjs.min.js.map', '').strip()
assert '</script' not in lib
F=[]
def add(t,f,r): F.append({"title":t,"find":f,"replace":r})
add("Wi-Fi room link: bundle the PeerJS 1.5.4 library (MIT) so the file needs no download",
"\n  <script>\n", "\n  <script id=\"peerjs-1.5.4-mit\">/* PeerJS 1.5.4, MIT License, https://github.com/peers/peerjs */\n" + lib + "\n  </script>\n  <script>\n")
add("Wi-Fi room link: new top section in the Partner Sync window",
"""          <!-- NEW: Super Simple 1-2 Click Live Sync Box -->""",
"""          <!-- Wi-Fi Room Code link (works over any internet Wi-Fi, laptop to laptop) -->
          <div class="p-4 rounded-xl bg-[#FDF6F2] border-2 border-[#C86D3B] space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs font-extrabold uppercase tracking-wider text-[#C86D3B]">🌐 Easiest: Link Over Tournament Wi-Fi With a Room Code</span>
              <span id="wifiRoomBadge" class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFFDF9] border border-[#C86D3B] text-[#C86D3B]">Not linked</span>
            </div>
            <p class="text-xs text-[#2A2421] leading-relaxed">
              <strong>1.</strong> One partner clicks <strong>New Code</strong> and tells the other the code. <strong>2.</strong> Both type the <em>same</em> code and click <strong>Link Laptops</strong>. Everything you type, click or edit shows up on both screens live. The data goes laptop-to-laptop and is encrypted; the free PeerJS server only introduces the two laptops. Needs Wi-Fi with internet. If the Wi-Fi blocks laptop-to-laptop links, use a phone hotspot with Option 1 below.
            </p>
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <button id="btnWifiRoomNewCode" type="button" onclick="makeWifiRoomCode()" class="px-3 py-2 rounded-xl border border-[#C86D3B] bg-[#FFFDF9] hover:bg-[#F9EBE4] text-[#C86D3B] text-xs font-bold transition cursor-pointer">🎲 New Code</button>
              <input id="wifiRoomCodeInput" type="text" maxlength="12" autocomplete="off" spellcheck="false" placeholder="e.g. K7QM-2XWP" class="rounded-xl border border-[#D5CBB8] bg-[#FFFDF9] px-3 py-1.5 text-sm font-mono font-bold tracking-widest uppercase text-[#2A2421] w-40">
              <button id="btnWifiRoomConnect" type="button" onclick="toggleWifiRoomLink()" class="px-3.5 py-2 rounded-xl bg-[#C86D3B] hover:bg-[#A65224] text-white text-xs font-bold transition cursor-pointer">🔗 Link Laptops</button>
            </div>
          </div>

          <!-- NEW: Super Simple 1-2 Click Live Sync Box -->""")
add("Wi-Fi room link: send every change to the linked partner",
"""      // 3. BroadcastChannel
      try {
        if (partnerBroadcastChannel) {""",
"""      // 2b. Wi-Fi room link (PeerJS)
      try {
        if (pfRoomConn && pfRoomConn.open) pfRoomConn.send(jsonStr);
      } catch (e) {}
      // 3. BroadcastChannel
      try {
        if (partnerBroadcastChannel) {""")
add("Wi-Fi room link: connection logic",
"""    function openPartnerSyncModal() {""",
"""    // WI-FI ROOM LINK: both laptops type the same room code. The first one to click Link waits
    // as the host; the second finds it through the free PeerJS server and they link directly (WebRTC, encrypted).
    let pfRoomPeer = null, pfRoomConn = null, pfRoomCode = "", pfRoomTimer = null, pfRoomActive = false;
    const PF_ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const PF_ROOM_CFG = { debug: 0, config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }] } };
    function pfCleanRoomCode(v) { return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10); }
    function pfRoomBadge(text, ok) {
      const b = document.getElementById("wifiRoomBadge");
      if (b) {
        b.textContent = text;
        b.className = ok
          ? "text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#3D6B58] text-white"
          : "text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFFDF9] border border-[#C86D3B] text-[#C86D3B]";
      }
      const btn = document.getElementById("btnWifiRoomConnect");
      if (btn) btn.textContent = pfRoomActive ? "✕ Unlink" : "🔗 Link Laptops";
    }
    function makeWifiRoomCode() {
      const a = new Uint32Array(8);
      (window.crypto || window.msCrypto).getRandomValues(a);
      const raw = Array.from(a, x => PF_ROOM_ALPHABET[x % PF_ROOM_ALPHABET.length]).join("");
      const inp = document.getElementById("wifiRoomCodeInput");
      if (inp) inp.value = raw.slice(0, 4) + "-" + raw.slice(4);
      copyTextToClipboard(raw.slice(0, 4) + "-" + raw.slice(4), "📋 Room code copied — tell your partner");
    }
    function pfRoomPeerId(code) { return "pf-tpnw-room-" + code; }
    function unlinkWifiRoom(silent) {
      pfRoomActive = false;
      clearTimeout(pfRoomTimer);
      try { if (pfRoomConn) pfRoomConn.close(); } catch (e) {}
      try { if (pfRoomPeer) pfRoomPeer.destroy(); } catch (e) {}
      pfRoomConn = null; pfRoomPeer = null;
      if (!silent) { pfRoomBadge("Not linked", false); updateRtcConnectionBadge("Disconnected", false); }
    }
    function toggleWifiRoomLink() {
      if (pfRoomActive) { unlinkWifiRoom(false); flashSaveToast("🔌 Laptops unlinked"); return; }
      linkWifiRoom();
    }
    function pfRoomFail(err) {
      const t = err && err.type;
      const msg = t === "network" || t === "server-error" || t === "socket-error" || t === "socket-closed"
        ? "No internet to the link server — use Option 1 or a phone hotspot"
        : t === "peer-unavailable" ? "Partner not found — both click Link again"
        : t === "browser-incompatible" ? "This browser can't link — use Chrome or Edge"
        : "Link failed — click Link Laptops again";
      unlinkWifiRoom(true);
      pfRoomBadge(msg, false);
    }
    function pfBindRoomConn(conn) {
      pfRoomConn = conn;
      clearTimeout(pfRoomTimer);
      pfRoomTimer = setTimeout(() => {
        if (pfRoomActive && !(pfRoomConn && pfRoomConn.open)) pfRoomBadge("Still trying… if it never links, this Wi-Fi blocks laptop-to-laptop: use a phone hotspot", false);
      }, 15000);
      conn.on("open", () => {
        clearTimeout(pfRoomTimer);
        pfRoomBadge("✓ Linked live (room " + pfRoomCode.slice(0, 4) + "-" + pfRoomCode.slice(4) + ")", true);
        updateRtcConnectionBadge("✓ Partner linked over Wi-Fi", true);
        flashSaveToast("🔗 Partner laptop linked live!");
        try { conn.send(JSON.stringify(buildSyncSnapshotPayload())); } catch (e) {}
      });
      conn.on("data", d => {
        try {
          const obj = typeof d === "string" ? JSON.parse(d) : d;
          if (obj && typeof obj === "object") applySyncSnapshotPayload(obj, false);
        } catch (e) {}
      });
      conn.on("close", () => {
        if (pfRoomConn === conn) pfRoomConn = null;
        if (pfRoomActive) { pfRoomBadge("Partner left — waiting for them to link again", false); updateRtcConnectionBadge("Disconnected", false); }
      });
      conn.on("error", () => {});
    }
    function linkWifiRoom() {
      const inp = document.getElementById("wifiRoomCodeInput");
      const code = pfCleanRoomCode(inp ? inp.value : "");
      if (code.length < 6) { flashSaveToast("⚠ Type a room code first (or click New Code)"); return; }
      if (typeof Peer === "undefined") { pfRoomBadge("Link library missing — use Option 1", false); return; }
      if (!navigator.onLine) { pfRoomBadge("No internet — connect to the Wi-Fi first, or use Option 1", false); return; }
      unlinkWifiRoom(true);
      pfRoomActive = true; pfRoomCode = code;
      pfRoomBadge("Connecting…", false);
      const hostId = pfRoomPeerId(code);
      let host;
      try { host = new Peer(hostId, PF_ROOM_CFG); } catch (e) { pfRoomFail(e); return; }
      pfRoomPeer = host;
      host.on("open", () => { if (pfRoomPeer === host) pfRoomBadge("Waiting for partner… (same code on their laptop)", false); });
      host.on("connection", conn => {
        if (pfRoomConn && pfRoomConn.open) { try { conn.close(); } catch (e) {} return; }
        pfBindRoomConn(conn);
      });
      host.on("error", err => {
        if (pfRoomPeer !== host) return;
        if (err && err.type === "unavailable-id") {
          // The partner is already waiting with this code: join them
          try { host.destroy(); } catch (e) {}
          const joiner = new Peer(PF_ROOM_CFG);
          pfRoomPeer = joiner;
          joiner.on("open", () => { if (pfRoomPeer === joiner) pfBindRoomConn(joiner.connect(hostId, { reliable: true, serialization: "json" })); });
          joiner.on("error", e2 => { if (pfRoomPeer === joiner) pfRoomFail(e2); });
        } else {
          pfRoomFail(err);
        }
      });
    }

    function openPartnerSyncModal() {""")
json.dump(F,open('fixes_link.json','w'),indent=1)
print(len(F))
