import { useState, useEffect, useRef } from "react";

function getSystemPrompt() {
  return "You are Claire's personal daily news anchor. Today is " + new Date().toDateString() + ". Search the web and select the 5 most important news stories today, focused on: 1. Global geopolitics and major world events. 2. Australian news (economy, RBA, finance, regulation, legal). For each story, provide a short punchy headline (max 8 words), a 2-sentence summary, and a category tag like 🌍 Global, 🇦🇺 Australia, 💰 Finance, or ⚖️ Regulation. You MUST return ONLY a raw JSON array. No explanation, no preamble, no markdown, no backticks. Start your response with [ and end with ]. Example: [{\"category\": \"🌍 Global\", \"headline\": \"Short headline here\", \"summary\": \"First sentence. Second sentence.\"}]";
}

function extractJSON(text) {
  var start = text.indexOf("[");
  var end = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  return null;
}

export default function NewsPlayer() {
  var [stories, setStories] = useState([]);
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState(null);
  var [activeIndex, setActiveIndex] = useState(null);
  var [speaking, setSpeaking] = useState(false);
  var [date] = useState(new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
  var synthRef = useRef(window.speechSynthesis);

  function stopSpeech() {
    synthRef.current.cancel();
    setSpeaking(false);
  }

  function readStory(story, index) {
    stopSpeech();
    setActiveIndex(index);
    var text = story.category + ". " + story.headline + ". " + story.summary;
    var utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.lang = "en-AU";
    var voices = synthRef.current.getVoices();
    var preferred = voices.find(function(v) { return v.lang === "en-AU" || v.lang === "en-GB"; });
    if (preferred) utter.voice = preferred;
    utter.onstart = function() { setSpeaking(true); };
    utter.onend = function() {
      setSpeaking(false);
      if (index + 1 < stories.length) {
        setTimeout(function() { readStory(stories[index + 1], index + 1); }, 800);
      }
    };
    synthRef.current.speak(utter);
  }

  function readAll() {
    if (stories.length > 0) readStory(stories[0], 0);
  }

  async function fetchNews() {
    setLoading(true);
    setStories([]);
    setError(null);
    setActiveIndex(null);
    stopSpeech();

    var apiKey = import.meta.env.VITE_ANTHROPIC_KEY;
    if (!apiKey) {
      setError("API Key未找到。请检查Vercel环境变量 VITE_ANTHROPIC_KEY。");
      setLoading(false);
      return;
    }

    try {
      var res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: getSystemPrompt(),
          messages: [{ role: "user", content: "Give me today's top 5 news stories as a JSON array only." }]
        })
      });

      if (!res.ok) {
        var errData = await res.json();
        throw new Error("API错误 " + res.status + ": " + (errData && errData.error && errData.error.message ? errData.error.message : "未知错误"));
      }

      var data = await res.json();
      var textBlock = null;
      if (data.content) {
        for (var i = 0; i < data.content.length; i++) {
          if (data.content[i].type === "text") {
            textBlock = data.content[i];
            break;
          }
        }
      }

      if (!textBlock || !textBlock.text) {
        throw new Error("API没有返回内容，请重试。");
      }

      var raw = textBlock.text;
      var jsonStr = extractJSON(raw);
      if (!jsonStr) {
        throw new Error("无法从响应中提取新闻数据，请重试。");
      }

      var parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("返回的数据格式不正确，请重试。");
      }

      setStories(parsed);
      setActiveIndex(0);

    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(function() {
    fetchNews();
    return function() { stopSpeech(); };
  }, []);

  var btnBase = {
    padding: "8px 18px",
    fontSize: 12,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    borderRadius: 2,
    border: "1px solid",
    fontFamily: "Georgia, serif"
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "Georgia, 'Times New Roman', serif", color: "#e8e4dc" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "radial-gradient(ellipse 80% 60% at 50% 0%, #1a1a2e 0%, #0a0a0f 70%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ borderBottom: "1px solid #2a2a3a", paddingBottom: 24, marginBottom: 36 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.18em", color: "#6b6b8a", textTransform: "uppercase", marginBottom: 6 }}>Daily Briefing</div>
              <h1 style={{ fontSize: "clamp(26px, 5vw, 38px)", fontWeight: 400, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1, color: "#f0ece4" }}>The Morning Wire</h1>
              <div style={{ fontSize: 13, color: "#5a5a78", marginTop: 6, fontStyle: "italic" }}>{date}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {!loading && stories.length > 0 && (
                <button onClick={speaking ? stopSpeech : readAll} style={{ ...btnBase, background: speaking ? "#3a1a1a" : "#1a2a1a", borderColor: speaking ? "#8b3a3a" : "#3a6b3a", color: speaking ? "#f08080" : "#80c880" }}>
                  {speaking ? "◼ Stop" : "▶ Read All"}
                </button>
              )}
              <button onClick={fetchNews} disabled={loading} style={{ ...btnBase, background: "transparent", borderColor: "#2a2a4a", color: loading ? "#3a3a5a" : "#8080b0", cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Loading..." : "↻ Refresh"}
              </button>
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#4a4a6a" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>◎</div>
            <div style={{ fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>Scanning the wires...</div>
          </div>
        )}

        {error && (
          <div style={{ background: "#1a0a0a", border: "1px solid #4a2a2a", borderLeft: "3px solid #8b3a3a", borderRadius: "0 4px 4px 0", padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.1em", color: "#8b3a3a", textTransform: "uppercase", marginBottom: 8 }}>Error</div>
            <div style={{ fontSize: 14, color: "#c08080", lineHeight: 1.6 }}>{error}</div>
            <button onClick={fetchNews} style={{ ...btnBase, marginTop: 12, background: "#2a1a1a", borderColor: "#4a2a2a", color: "#c08080" }}>↻ 重试</button>
          </div>
        )}

        {!loading && stories.map(function(story, i) {
          var isActive = activeIndex === i;
          var isSpeakingThis = isActive && speaking;
          return (
            <div key={i} onClick={function() { readStory(story, i); }}
              style={{ marginBottom: 2, padding: "22px 24px", background: isActive ? "#13131f" : "transparent", border: "1px solid " + (isActive ? "#2a2a4a" : "transparent"), borderLeft: "3px solid " + (isSpeakingThis ? "#6060c0" : isActive ? "#3a3a7a" : "#1a1a2a"), cursor: "pointer", transition: "all 0.25s ease", borderRadius: "0 2px 2px 0" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ minWidth: 28, height: 28, background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#5a5a8a", marginTop: 1 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", color: "#5a5a8a", textTransform: "uppercase", marginBottom: 6 }}>{story.category}</div>
                  <div style={{ fontSize: "clamp(15px, 2.5vw, 18px)", fontWeight: 400, lineHeight: 1.3, color: isActive ? "#f0ece4" : "#c8c4bc", marginBottom: 10 }}>{story.headline}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#787890", fontStyle: "italic" }}>{story.summary}</div>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && stories.length > 0 && (
          <div style={{ marginTop: 36, textAlign: "center", color: "#2a2a4a", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Click any story to hear it · Global + Australia Edition
          </div>
        )}
      </div>
    </div>
  );
}
