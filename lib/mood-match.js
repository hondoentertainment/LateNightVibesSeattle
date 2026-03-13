/**
 * Late Night Vibes — Mood Match engine.
 *
 * Natural language query → venue matching via keyword/semantic mapping.
 * Maps user phrases to vibe tags, categories, and venue attributes,
 * then scores and ranks venues accordingly.
 *
 * UMD export: window.LNVMoodMatch in browser, module.exports in Node.
 */
(function (exports) {
  "use strict";

  var Core = typeof window !== "undefined" ? window.LNVCore : require("./core");
  var normalizeValue = Core.normalizeValue;
  var getVibeSet = Core.getVibeSet;

  /* ─── Keyword → tag/category mapping ─── */

  var KEYWORD_MAP = {
    // Atmosphere
    "quiet":        { tags: ["chill", "casual"], categories: [] },
    "loud":         { tags: ["high-energy", "dancey"], categories: [] },
    "romantic":     { tags: ["date-friendly", "upscale"], categories: [] },
    "cheap":        { tags: ["divey", "casual"], categories: [] },
    "fancy":        { tags: ["upscale"], categories: [] },
    "upscale":      { tags: ["upscale"], categories: [] },
    "elegant":      { tags: ["upscale"], categories: [] },
    "classy":       { tags: ["upscale", "date-friendly"], categories: [] },

    // Activities
    "dance":        { tags: ["dancey", "high-energy"], categories: ["nightclub"] },
    "dancing":      { tags: ["dancey", "high-energy"], categories: ["nightclub"] },
    "karaoke":      { tags: ["karaoke"], categories: [] },
    "sing":         { tags: ["karaoke"], categories: [] },
    "singing":      { tags: ["karaoke"], categories: [] },

    // Food & drink
    "food":         { tags: ["food-focused", "late-eats"], categories: ["restaurant"] },
    "eat":          { tags: ["food-focused", "late-eats"], categories: ["restaurant"] },
    "eating":       { tags: ["food-focused", "late-eats"], categories: ["restaurant"] },
    "hungry":       { tags: ["food-focused", "late-eats"], categories: ["restaurant"] },
    "eats":         { tags: ["food-focused", "late-eats"], categories: ["restaurant"] },
    "beer":         { tags: ["divey"], categories: ["brewery", "beer bar"] },
    "beers":        { tags: ["divey"], categories: ["brewery", "beer bar"] },
    "cocktails":    { tags: ["drinks", "upscale"], categories: ["cocktail bar"] },
    "cocktail":     { tags: ["drinks", "upscale"], categories: ["cocktail bar"] },
    "drinks":       { tags: ["drinks"], categories: ["cocktail bar"] },
    "wine":         { tags: ["upscale"], categories: ["wine bar"] },

    // Conversation
    "talk":         { tags: ["chill", "casual"], categories: [], anti: ["high-energy", "dancey"] },
    "conversation": { tags: ["chill", "casual"], categories: [], anti: ["high-energy", "dancey"] },
    "hear":         { tags: ["chill", "casual"], categories: [], anti: ["high-energy", "dancey"] },
    "chat":         { tags: ["chill", "casual"], categories: [], anti: ["high-energy", "dancey"] },

    // Music & entertainment
    "music":        { tags: ["live-music"], categories: [] },
    "band":         { tags: ["live-music"], categories: [] },
    "bands":        { tags: ["live-music"], categories: [] },
    "live":         { tags: ["live-music"], categories: [] },
    "dj":           { tags: ["dancey", "high-energy"], categories: ["nightclub"] },

    // Sports
    "sports":       { tags: ["sports"], categories: ["sports bar"] },
    "game":         { tags: ["sports"], categories: ["sports bar"] },
    "games":        { tags: ["sports"], categories: ["sports bar"] },

    // Views
    "view":         { tags: ["rooftop", "views"], categories: [] },
    "views":        { tags: ["rooftop", "views"], categories: [] },
    "rooftop":      { tags: ["rooftop", "views"], categories: [] },
    "skyline":      { tags: ["rooftop", "views"], categories: [] },
    "scenic":       { tags: ["rooftop", "views"], categories: [] },

    // Late night
    "late":         { tags: ["late-night", "late-eats"], categories: [] },
    "midnight":     { tags: ["late-night", "late-eats"], categories: [] },

    // Dive
    "dive":         { tags: ["divey"], categories: ["dive bar"] },
    "divey":        { tags: ["divey"], categories: ["dive bar"] },

    // Social setting
    "group":        { tags: ["social", "high-energy"], categories: [] },
    "groups":       { tags: ["social", "high-energy"], categories: [] },
    "party":        { tags: ["social", "high-energy"], categories: [] },
    "friends":      { tags: ["social"], categories: [] },
    "solo":         { tags: ["chill", "casual"], categories: [] },
    "alone":        { tags: ["chill", "casual"], categories: [] },

    // Date
    "date":         { tags: ["date-friendly", "upscale"], categories: [] },

    // Chill
    "chill":        { tags: ["chill", "casual"], categories: [] },
    "relax":        { tags: ["chill", "casual"], categories: [] },
    "relaxed":      { tags: ["chill", "casual"], categories: [] },
    "relaxing":     { tags: ["chill", "casual"], categories: [] },
    "mellow":       { tags: ["chill", "casual"], categories: [] },
    "cozy":         { tags: ["chill", "casual"], categories: [] },
    "laid-back":    { tags: ["chill", "casual"], categories: [] },
    "laidback":     { tags: ["chill", "casual"], categories: [] },
    "lowkey":       { tags: ["chill", "casual"], categories: [] },
    "low-key":      { tags: ["chill", "casual"], categories: [] },

    // High energy
    "wild":         { tags: ["high-energy", "dancey"], categories: [] },
    "crazy":        { tags: ["high-energy", "dancey"], categories: [] },
    "hype":         { tags: ["high-energy", "dancey"], categories: [] },
    "energetic":    { tags: ["high-energy", "dancey"], categories: [] },
    "fun":          { tags: ["social", "high-energy"], categories: [] },

    // Categories as keywords
    "bar":          { tags: [], categories: ["bar"] },
    "club":         { tags: ["dancey", "high-energy"], categories: ["nightclub"] },
    "nightclub":    { tags: ["dancey", "high-energy"], categories: ["nightclub"] },
    "restaurant":   { tags: ["food-focused"], categories: ["restaurant"] },
    "brewery":      { tags: [], categories: ["brewery"] },
    "pub":          { tags: ["casual"], categories: ["bar", "brewery"] },
  };

  /* ─── Phrase patterns (multi-word before tokenization) ─── */

  var PHRASE_MAP = [
    { phrase: "after midnight",   tags: ["late-night", "late-eats"], categories: [] },
    { phrase: "late night",       tags: ["late-night", "late-eats"], categories: [] },
    { phrase: "date night",       tags: ["date-friendly", "upscale"], categories: [] },
    { phrase: "happy hour",       tags: ["drinks", "social"], categories: [] },
    { phrase: "live music",       tags: ["live-music"], categories: [] },
    { phrase: "good food",        tags: ["food-focused"], categories: ["restaurant"] },
    { phrase: "craft beer",       tags: [], categories: ["brewery", "beer bar"] },
    { phrase: "craft cocktails",  tags: ["drinks", "upscale"], categories: ["cocktail bar"] },
    { phrase: "no crowds",        negate: ["social", "high-energy"] },
    { phrase: "not loud",         negate: ["high-energy", "dancey"] },
    { phrase: "not fancy",        negate: ["upscale"] },
    { phrase: "not crowded",      negate: ["social", "high-energy"] },
  ];

  /* ─── Negation words ─── */

  var NEGATION_WORDS = ["not", "no", "without", "avoid", "nothing", "never"];

  /* ─── Tokenize & parse query ─── */

  function parseQuery(query) {
    var text = (query || "").toLowerCase().trim();
    if (!text) return { positiveTags: [], negativeTags: [], positiveCategories: [] };

    var positiveTags = [];
    var negativeTags = [];
    var positiveCategories = [];

    // 1. Check phrase patterns first (and remove matched phrases from text)
    PHRASE_MAP.forEach(function (entry) {
      if (text.indexOf(entry.phrase) >= 0) {
        if (entry.negate) {
          entry.negate.forEach(function (t) { negativeTags.push(t); });
        } else {
          (entry.tags || []).forEach(function (t) { positiveTags.push(t); });
          (entry.categories || []).forEach(function (c) { positiveCategories.push(c); });
        }
        text = text.replace(new RegExp(entry.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), " ");
      }
    });

    // 2. Tokenize remaining words
    var words = text.replace(/[^a-z0-9'-]+/g, " ").trim().split(/\s+/).filter(Boolean);

    // 3. Walk tokens, detect negations
    var negateNext = false;
    for (var i = 0; i < words.length; i++) {
      var word = words[i];

      // Check for negation prefix
      if (NEGATION_WORDS.indexOf(word) >= 0) {
        negateNext = true;
        continue;
      }

      var mapping = KEYWORD_MAP[word];
      if (!mapping) {
        negateNext = false;
        continue;
      }

      if (negateNext) {
        // Negate: these tags become penalties
        (mapping.tags || []).forEach(function (t) { negativeTags.push(t); });
        (mapping.categories || []).forEach(function (c) { negativeTags.push(c); });
      } else {
        (mapping.tags || []).forEach(function (t) { positiveTags.push(t); });
        (mapping.categories || []).forEach(function (c) { positiveCategories.push(c); });
        // Also apply inherent anti-tags (e.g., "talk" implies NOT loud)
        if (mapping.anti) {
          mapping.anti.forEach(function (t) { negativeTags.push(t); });
        }
      }

      negateNext = false;
    }

    // Deduplicate
    positiveTags = dedupe(positiveTags);
    negativeTags = dedupe(negativeTags);
    positiveCategories = dedupe(positiveCategories);

    return {
      positiveTags: positiveTags,
      negativeTags: negativeTags,
      positiveCategories: positiveCategories,
    };
  }

  function dedupe(arr) {
    var seen = {};
    return arr.filter(function (item) {
      if (seen[item]) return false;
      seen[item] = true;
      return true;
    });
  }

  /* ─── Score a venue against parsed query ─── */

  function scoreVenue(venue, parsed) {
    var vibeSet = getVibeSet(venue);
    var category = normalizeValue(venue.Category).toLowerCase();

    var matchedTags = [];
    var penalizedTags = [];
    var score = 0;

    // Positive tag matches (+2 per match)
    parsed.positiveTags.forEach(function (tag) {
      if (vibeSet.has(tag)) {
        score += 2;
        matchedTags.push(tag);
      }
    });

    // Positive category matches (+3 per match, categories are strong signals)
    parsed.positiveCategories.forEach(function (cat) {
      if (category.indexOf(cat) >= 0) {
        score += 3;
        matchedTags.push(cat);
      }
    });

    // Negative tag penalties (-2 per match)
    parsed.negativeTags.forEach(function (tag) {
      if (vibeSet.has(tag) || category.indexOf(tag) >= 0) {
        score -= 2;
        penalizedTags.push(tag);
      }
    });

    return {
      score: score,
      matchedTags: matchedTags,
      penalizedTags: penalizedTags,
    };
  }

  /* ─── Build a human-readable reason string ─── */

  function buildReason(matchedTags, penalizedTags) {
    var parts = [];
    if (matchedTags.length) {
      parts.push("Matches: " + matchedTags.join(", "));
    }
    if (penalizedTags.length) {
      parts.push("Avoids: " + penalizedTags.join(", "));
    }

    // Add flavor text
    var flavor = [];
    if (matchedTags.indexOf("chill") >= 0 || matchedTags.indexOf("casual") >= 0) flavor.push("relaxed atmosphere");
    if (matchedTags.indexOf("food-focused") >= 0 || matchedTags.indexOf("late-eats") >= 0) flavor.push("great eats");
    if (matchedTags.indexOf("date-friendly") >= 0) flavor.push("perfect for a date");
    if (matchedTags.indexOf("live-music") >= 0) flavor.push("live entertainment");
    if (matchedTags.indexOf("dancey") >= 0 || matchedTags.indexOf("high-energy") >= 0) flavor.push("high energy vibes");
    if (matchedTags.indexOf("views") >= 0 || matchedTags.indexOf("rooftop") >= 0) flavor.push("stunning views");
    if (matchedTags.indexOf("divey") >= 0) flavor.push("no-frills character");
    if (matchedTags.indexOf("karaoke") >= 0) flavor.push("sing your heart out");
    if (matchedTags.indexOf("sports") >= 0) flavor.push("catch the game");
    if (matchedTags.indexOf("late-night") >= 0) flavor.push("stays open late");

    if (flavor.length) {
      parts.push(dedupe(flavor).slice(0, 3).join(" + "));
    }

    return parts.join(". ") || "General match";
  }

  /* ─── Main API: matchMood(query, venues) ─── */

  function matchMood(query, venues) {
    if (!query || !venues || !venues.length) return [];

    var parsed = parseQuery(query);

    // No keywords matched at all — return empty
    if (!parsed.positiveTags.length && !parsed.positiveCategories.length && !parsed.negativeTags.length) {
      return [];
    }

    var results = [];

    for (var i = 0; i < venues.length; i++) {
      var venue = venues[i];
      if (!normalizeValue(venue.Name)) continue;

      var result = scoreVenue(venue, parsed);

      // Only include venues with a positive score
      if (result.score > 0) {
        results.push({
          venue: venue,
          score: result.score,
          matchedTags: result.matchedTags,
          reason: buildReason(result.matchedTags, result.penalizedTags),
        });
      }
    }

    // Sort by score descending, then by name for stability
    results.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return normalizeValue(a.venue.Name).localeCompare(normalizeValue(b.venue.Name));
    });

    return results;
  }

  /* ─── Exports ─── */

  exports.KEYWORD_MAP = KEYWORD_MAP;
  exports.PHRASE_MAP = PHRASE_MAP;
  exports.parseQuery = parseQuery;
  exports.matchMood = matchMood;

})(typeof module !== "undefined" ? module.exports : (window.LNVMoodMatch = {}));
