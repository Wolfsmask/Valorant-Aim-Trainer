import json
F = []
def add(t, f, r): F.append({"title": t, "find": f, "replace": r})

# helper used by both card views
add("Source links: helper that shows where a link actually goes, plus a Copy-link button",
'''    function renderSourceCards() {''',
'''    // The site a card's link opens, e.g. "apnews.com" — so you can see at a glance that it is
    // the original publisher and not a reprint, and hand the link over when they call for the card.
    function sourceLinkHost(url) {
      try { return new URL(url).hostname.replace(/^www\\./, ""); } catch (e) { return ""; }
    }
    function sourceLinkRowHtml(card) {
      const host = sourceLinkHost(card.url);
      return `
        <div class="flex flex-wrap items-center gap-1.5 mb-2">
          <a href="${escapeHtml(card.url)}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-[#3D6B58] underline">${escapeHtml(card.title)} ↗</a>
          ${host ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFFDF9] border border-[#D5CBB8] text-[#6E6259]">${escapeHtml(host)}</span>` : ""}
          <button type="button" onclick="copySourceLinkByShort('${escapeHtml(card.short)}')" class="text-[10px] font-bold px-2 py-0.5 rounded bg-[#E9F2EE] text-[#3D6B58] hover:bg-[#D5E6DF] transition cursor-pointer">🔗 Copy link</button>
        </div>`;
    }
    function copySourceLinkByShort(short) {
      const card = (DEBATE_DATA.SOURCE_CARDS || []).find(c => c.short === short);
      if (!card) return;
      copyTextToClipboard(card.url, "🔗 Link copied — " + sourceLinkHost(card.url));
    }

    function renderSourceCards() {''')

add("Source cards: show the site and a Copy-link button under the title",
'''            <a href="${escapeHtml(card.url)}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-[#3D6B58] underline block mb-2">${escapeHtml(card.title)} ↗</a>''',
'''            ${sourceLinkRowHtml(card)}''')

add("Find Source window: same link row",
'''          <a href="${escapeHtml(card.url)}" target="_blank" rel="noopener noreferrer" class="text-xs font-semibold text-[#3D6B58] underline block">${escapeHtml(card.title)} ↗</a>''',
'''          ${sourceLinkRowHtml(card)}''')

# honest label: the box shows the verbatim quote when there is one, otherwise a summary
add("Find Source window: stop calling a summary 'Exact Card Text'",
'''            <div class="text-[10px] font-bold uppercase tracking-wider text-[#3D6B58] mb-1">📜 Exact Card Text</div>
            <p class="serif-podium text-xs sm:text-sm italic text-[#2A2421] leading-relaxed">${escapeHtml(card.verbatim || card.takeaway)}</p>''',
'''            <div class="text-[10px] font-bold uppercase tracking-wider ${card.verbatim ? 'text-[#3D6B58]' : 'text-[#C86D3B]'} mb-1">${card.verbatim ? "📜 Author's exact words" : "✎ Our summary — do not read this as a quote"}</div>
            <p class="serif-podium text-xs sm:text-sm italic text-[#2A2421] leading-relaxed">${escapeHtml(card.verbatim || card.takeaway)}</p>''')

# credentials + warning also in the Find Source window
add("Find Source window: show credentials and the own-card warning too",
'''          <p class="text-xs text-[#6E6259]">${escapeHtml(card.citation)}</p>''',
'''          ${card.credential ? `<p class="text-xs text-[#2A2421] p-1.5 rounded bg-[#EFF6F3] border border-[#3D6B58]/30"><strong class="text-[#3D6B58]">Why they are qualified:</strong> ${escapeHtml(card.credential)}</p>` : ""}
          <p class="text-xs text-[#6E6259]">${escapeHtml(card.citation)}</p>
          ${card.ownRisk ? `<p class="text-[11px] text-[#2A2421] p-1.5 rounded bg-[#FDF6F2] border border-[#C86D3B]/40"><strong class="text-[#C86D3B]">If they attack this card:</strong> ${escapeHtml(card.ownRisk)}</p>` : ""}''')

json.dump(F, open('fixes_links.json', 'w'), indent=1)
print(len(F))
