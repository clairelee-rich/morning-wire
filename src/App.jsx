import { useState, useEffect, useRef } from "react";

const NEWS_SYSTEM_PROMPT = `You are Claire's personal daily news anchor. Today is ${new Date().toDateString()}.

Search the web and select the 5 most important news stories today, focused on:
1. Global geopolitics and major world events
2. Australian news (economy, RBA, finance, regulation, legal)

For each story, provide:
- A short punchy headline (max 8 words)
- A 2-sentence summary, clear and factual
- A category tag (e.g. 🌍 Global, 🇦🇺 Australia, 💰 Finance, ⚖️ Regulation)

Return ONLY a JSON array, no markdown, no backticks. Format:
[
  {
    "category": "🌍 Global",
    "headline": "Short headline here",
    "summary": "First sentence. Second sentence."
  }
]`;

export default function NewsPlayer() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [date] = useState(new Date().toLocaleDateString("en-AU", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
  const synthRef = useRef(window.speechSynthesis);

  const fetchNews = async () => {
    setLoading(true);
    setStories([]);
    setError(null);
    setActiveIndex(null);
    stopSpeech();

    const apiKey = import.meta.env.VITE_ANTHROPIC_KEY;

    if (!apiKey) {
      setError("❌ API Key未找到。请检查Vercel环境变量 VITE_ANTHROPIC_KEY 是否已设置，然后重新部署。");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
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
          system: NEWS_SYSTEM_PROMPT,
          messages: [{ role: "user", content: "Fetch today's top 5 news stories for me." }]
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(`API错误 ${res.status}: ${errData?.error?.message || "未知错误"}`);
      }

      const data = await res.json();
      const textBlock = data.content?.find(b => b.type === "text");

      if (!textBlock) {
        throw new Error("API没有返回文本内容，请重试。");
      }

      const clean = textBlock.text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setStories(parsed);
      setActiveIndex(0);

    } catch (e) {
      setError(`⚠️ ${e.message}`);
    }
    setLoading(false);
  };

  const stopSpeech = () => {
    synthRef.current.cancel();
    setSpeaking(false);
  };

  const readStory = (story, index) => {
    stopSpeech();
    setActiveIndex(index);
    const text = `${story.category}. ${story.headline}. ${story.summary}`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.0;
    utter.lang = "en-AU";
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v => v.lang === "en-AU" || v.lang === "en-GB");
    if (preferred) utter.voice = preferred;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => {
      setSpeaking(false);
      if (index + 1 < stories.length) {
        setTimeout(() => readStory(stories[index + 1], index + 1), 800);
      }
    };
    synthRef.current.speak(utter);
  };

  const readAll = () => {
    if (stories.length > 0) readStory(stories[0], 0);
  };

  useEffect(() => {
    fetchNews();
    return () => stopSpeech();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", fontFamily: "'Georgia', 'Times New Roman', serif", color: "#e8e4dc", padding: "0" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "radial-gradient(ellipse 80% 60% at 50% 0%, #1a1a2e 0%, #0a0a0f 70%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Header */}
        <div style={{ borderBottom: "1px solid #2a2a3a", paddingBottom: 24, marginBottom: 36 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.18em", color: "#6b6b8a", textTransform: "uppercase", marginBottom: 6 }}>Daily Briefing</div>
              <h1 style={{ fontSize: "clamp(26px, 5vw, 38px)", fontWeight: 400, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1, color: "#f0ece4" }}>The Morning Wire</h1>
              <div style={{ fontSize: 13, color: "#5a5a78", marginTop: 6, fontStyle: "italic" }}>{date}</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {!loading && stories.length > 0 && (
                <button onClick={speaking ? stopSpeech : readAll} style={{ background: speaking ? "#3a1a1a" : "#1a2a1a", border: `1px solid ${speaking ? "#8b3a3a" : "#3a6b3a"}`, color: speaking ? "#f08080" : "#80c880", padding: "8px 18px", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", borderRadius: 2 }}>
                  {speaking ? "◼ Stop" : "▶ Read All"}
                </button>
              )}
              <button onClick={fetchNews} disabled={loading} style={{ background: "transparent", border: "1px solid #2a2a4a", color: loading ? "#3a3a5a" : "#8080b0", padding: "8px 18px", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", borderRadius: 2 }}>
                {loading ? "Loading…" : "↻ Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#4a4a6a" }}>
            <div style={{ fontSize: 32, marginBottom: 16, animation: "pulse 1.4s ease-in-out infinite" }}>◎</div>
            <div style={{ fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>Scanning the wires…</div>
            <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{ background: "#1a0a0a", border: "1px solid #4a2a2a", borderLeft: "3px solid #8b3a3a", borderRadius: "0 4px 4px 0", padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.1em", color: "#8b3a3a", textTransform: "uppercase", marginBottom: 8 }}>错误</div>
            <div style={{ fontSize: 14, color: "#c08080", lineHeight: 1.6 }}>{error}</div>
            <div style={{ marginTop: 16, fontSize: 12, color: "#5a3a3a" }}>
              💡 检查清单：<br/>
              1. Vercel → Settings → Environment Variables → 确认 <code style={{background:"#2a1a1a", padding:"2px 6px", borderRadius:2}}>VITE_ANTHROPIC_KEY</code> 已添加<br/>
              2. 添加后点击 <strong>Redeploy</strong><br/>
              3. Key格式应为 <code style={{background:"#2a1a1a", padding:"2px 6px", borderRadius:2}}>sk-ant-api03-xxx...</code>
            </div>
          </div>
        )}

        {/* Stories */}
        {!loading && stories.map((story, i) => {
          const isActive = activeIndex === i;
          const isSpeakingThis = isActive && speaking;
          return (
            <div key={i} onClick={() => readStory(story, i)} style={{ marginBottom: 2, padding: "22px 24px", background: isActive ? "#13131f" : "transparent", border: `1px solid ${isActive ? "#2a2a4a" : "transparent"}`, borderLeft: `3px solid ${isSpeakingThis ? "#6060c0" : isActive ? "#3a3a7a" : "#1a1a2a"}`, cursor: "pointer", transition: "all 0.25s ease", borderRadius: "0 2px 2px 0", position: "relative" }}>
              {isSpeakingThis && (
                <div style={{ position: "absolute", top: 22, right: 20, display: "flex", gap: 3, alignItems: "flex-end", height: 16 }}>
                  {[1, 1.6, 0.8, 1.4, 1].map((h, j) => (
                    <div key={j} style={{ width: 3, background: "#6060c0", borderRadius: 1, animation: `bar${j} 0.6s ease-in-out infinite alternate`, height: `${h * 10}px` }} />
                  ))}
                  <style>{[0,1,2,3,4].map(j => `@keyframes bar${j}{from{transform:scaleY(0.4)}to{transform:scaleY(1.2)}}`).join("")}</style>
                </div>
              )}
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ minWidth: 28, height: 28, background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#5a5a8a", marginTop: 1 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.14em", color: "#5a5a8a", textTransform: "uppercase", marginBottom: 6 }}>{story.category}</div>
                  <div style={{ fontSize: "clamp(15px, 2.5vw, 18px)", fontWeight: 400, lineHeight: 1.3, color: isActive ? "#f0ece4" : "#c8c4bc", marginBottom: 10, letterSpacing: "-0.01em" }}>{story.headline}</div>
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
