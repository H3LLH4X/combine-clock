import { useState, useEffect, useRef, useCallback } from "react";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Doto:wght@100..900&display=swap');`;

function timerColor(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r < 128 || g < 128 || b < 128) ? "#ffffff" : "#000000";
}

const COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#C77DFF", "#FF9F1C"];
const DARK =   ["#cc2222", "#cc9900", "#1e8c3a", "#1155cc", "#7722cc", "#cc5500"];
const VDARK =  ["#3a0000", "#3a2800", "#003a10", "#00103a", "#1a003a", "#3a1500"];

const KICK_POINTS = 3;
const I_WON_POINTS = [5, 3, 2, 1, 1];

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function getAliveSectors(alivePlayers, totalPlayers, rotOffset = 0) {
  const twoPi = Math.PI * 2;
  const sectors = new Map();
  if (!alivePlayers.length || !totalPlayers) return sectors;

  const origIdxs = alivePlayers.map(p => p.originalIdx).sort((a, b) => a - b);
  const centers = origIdxs.map(origIdx => ({
    origIdx,
    angle: rotOffset + (twoPi * (origIdx + 0.5) / totalPlayers),
  }));

  if (centers.length === 1) {
    const center = centers[0];
    sectors.set(center.origIdx, {
      angle1: center.angle - Math.PI + 0.001,
      angle2: center.angle + Math.PI - 0.001,
      midAngle: center.angle,
    });
    return sectors;
  }

  centers.forEach((center, i) => {
    const prev = i === 0
      ? { ...centers[centers.length - 1], angle: centers[centers.length - 1].angle - twoPi }
      : centers[i - 1];
    const next = i === centers.length - 1
      ? { ...centers[0], angle: centers[0].angle + twoPi }
      : centers[i + 1];

    sectors.set(center.origIdx, {
      angle1: (prev.angle + center.angle) / 2,
      angle2: (center.angle + next.angle) / 2,
      midAngle: (prev.angle + (center.angle * 2) + next.angle) / 4,
    });
  });

  return sectors;
}

function playTick(isLast = false) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(isLast ? 1200 : 880, ctx.currentTime);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
}

function Leaderboard({ players, cumulativeScores, roundNum, targetScore, isBig = false }) {
  const sorted = [...players].map((p, i) => ({ ...p, score: cumulativeScores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const containerPadding = isBig ? "32px" : "22px";
  const headerMargin = isBig ? "20px" : "14px";
  const titleSize = isBig ? "15px" : "13px";
  const nameSize = isBig ? "20px" : "16px";
  const scoreSize = isBig ? "22px" : "17px";
  const barHeight = isBig ? "8px" : "4px";
  const playerMargin = isBig ? "16px" : "10px";

  return (
    <div style={{ background: "#0a0a14", border: "1px solid #1a1a2e", borderRadius: 24, padding: containerPadding, marginBottom: 20, boxShadow: isBig ? "0 10px 30px rgba(0,0,0,0.5)" : "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: headerMargin }}>
        <div style={{ color: "#666", fontSize: titleSize, fontWeight: 900, letterSpacing: 3 }}>
          LEADERBOARD{roundNum > 0 ? ` · ROUND ${roundNum}` : ""}
        </div>
        <div style={{ color: "#555", fontSize: titleSize, fontWeight: 900, letterSpacing: 2 }}>
          TARGET: <span style={{ color: "#FFD93D", fontWeight: 900 }}>{targetScore}</span>
        </div>
      </div>
      {sorted.map((p, i) => {
        const pct = Math.min(p.score / targetScore, 1);
        const isLeading = i === 0 && p.score > 0;
        return (
          <div key={p.name} style={{ marginBottom: playerMargin }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#444", fontSize: isBig ? "15px" : "13px", fontWeight: 900, width: 20 }}>{i + 1}</span>
                <div style={{ width: isBig ? 12 : 8, height: isBig ? 12 : 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                <span style={{ color: p.color, fontSize: nameSize, fontWeight: 900 }}>{p.name}</span>
                {isLeading && (
                  <span style={{ color: "#FFD93D", fontSize: isBig ? "12px" : "11px", fontWeight: 900, letterSpacing: 2, background: "#FFD93D15", padding: "4px 8px", borderRadius: 6 }}>
                    LEAD
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: p.color, fontWeight: 900, fontSize: scoreSize }}>{p.score}</span>
                <span style={{ color: "#444", fontSize: isBig ? "15px" : "13px", fontWeight: 900 }}>/{targetScore}</span>
              </div>
            </div>
            <div style={{ height: barHeight, background: "#111", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct * 100}%`, background: p.color, borderRadius: 6, transition: "width .5s cubic-bezier(.4,0,.2,1)", opacity: 0.85 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoundProgress({ events, players }) {
  if (!events.length) return null;
  return (
    <div style={{ background: "#0a0a14", border: "1px solid #1a1a2e", borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ color: "#666", fontSize: 13, fontWeight: 900, letterSpacing: 3, marginBottom: 14 }}>THIS ROUND</div>
      {events.map((ev, i) => {
        const p = players[ev.globalIdx];
        const target = ev.targetIdx !== null && ev.targetIdx !== undefined ? players[ev.targetIdx] : null;
        if (!p) return null;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: p.color, fontSize: 15, fontWeight: 900 }}>{p.name}</span>
                {ev.reason === "iwon" && <span style={{ color: "#6BCB77", fontSize: 11, fontWeight: 900, background: "#6BCB7722", padding: "3px 7px", borderRadius: 4, letterSpacing: 1 }}>I WON</span>}
                {ev.reason === "kick" && <span style={{ color: "#FF6B6B", fontSize: 11, fontWeight: 900, background: "#FF6B6B22", padding: "3px 7px", borderRadius: 4, letterSpacing: 1 }}>KICKED{target ? ` ${target.name}` : ""}</span>}
                {ev.reason === "kicked" && <span style={{ color: "#FF6B6B", fontSize: 11, fontWeight: 900, background: "#FF6B6B22", padding: "3px 7px", borderRadius: 4, letterSpacing: 1 }}>KICKED</span>}
                {ev.reason === "timeout" && <span style={{ color: "#FFD93D", fontSize: 11, fontWeight: 900, background: "#FFD93D22", padding: "3px 7px", borderRadius: 4, letterSpacing: 1 }}>TIMEOUT</span>}
                {ev.reason === "last" && <span style={{ color: "#666", fontSize: 11, fontWeight: 900, background: "#ffffff11", padding: "3px 7px", borderRadius: 4, letterSpacing: 1 }}>LOST</span>}
              </div>
              <span style={{ color: ev.pts > 0 ? p.color : "#666", fontWeight: 900, fontSize: 16 }}>{ev.pts > 0 ? `+${ev.pts}` : "0 pts"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoundStartPopup({ roundNum, starterName, starterColor, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#050508ee", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>
      <div style={{ background: "#0a0a14", border: `1px solid ${starterColor}44`, borderRadius: 28, padding: 44, textAlign: "center", maxWidth: 340, width: "90%" }}>
        <div style={{ fontSize: 24, color: "#fff", marginBottom: 24, letterSpacing: 1, lineHeight: 1.4 }}>
          ROUND {roundNum},<br />
          START WITH <span style={{ color: starterColor }}>{starterName}</span>.
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 12, background: starterColor, border: "none", color: "#000", fontFamily: "'Doto', sans-serif", fontSize: 15, fontWeight: 900, letterSpacing: 2, cursor: "pointer", WebkitTextStroke: "0" }}>
          LET'S GO →
        </button>
      </div>
    </div>
  );
}

function GameOverScreen({ winner, cumulativeScores, players, onPlayAgain, targetScore }) {
  const sorted = [...players].map((p, i) => ({ ...p, score: cumulativeScores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: `linear-gradient(135deg, ${winner.color} 0%, ${winner.dark} 60%, #050508 100%)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Doto', sans-serif",
      fontWeight: 900,
      padding: "2rem",
      boxSizing: "border-box",
      overflowY: "auto"
    }}>
      <style>{`
        @keyframes subtlePulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 25px rgba(255,255,255,0.25)); }
          50% { transform: scale(1.04); filter: drop-shadow(0 0 45px rgba(255,255,255,0.45)); }
        }
      `}</style>
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        
        <div style={{ marginBottom: 32, animation: "subtlePulse 3s infinite ease-in-out" }}>
          <div style={{ fontSize: 80, margin: "0 auto 12px" }}>🏆</div>
          <div style={{ color: "#fff", fontSize: 42, fontWeight: 900, letterSpacing: 2, textShadow: "0 0 20px rgba(255,255,255,0.3)" }}>
            {winner.name.toUpperCase()}
          </div>
          <div style={{ color: "#FFD93D", fontSize: 15, letterSpacing: 6, marginTop: 10, fontWeight: 900 }}>
            CHAMPION · TARGET {targetScore} PTS
          </div>
        </div>

        <div style={{
          background: "rgba(5, 5, 8, 0.88)",
          border: `2px solid ${winner.color}66`,
          borderRadius: 28,
          padding: 30,
          marginBottom: 32,
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.65)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)"
        }}>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 900, letterSpacing: 4, marginBottom: 22, textAlign: "left" }}>
            FINAL STANDINGS
          </div>
          
          {sorted.map((p, i) => {
            const pct = Math.min(p.score / targetScore, 1);
            const isWinner = p.name === winner.name;
            return (
              <div key={p.name} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: isWinner ? "#FFD93D" : "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: 900, width: 22 }}>
                      {isWinner ? "👑" : i + 1}
                    </span>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color }} />
                    <span style={{ color: p.color, fontSize: 18, fontWeight: 900 }}>
                      {p.name}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: p.color, fontWeight: 900, fontSize: 18 }}>{p.score}</span>
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, fontWeight: 900 }}>/{targetScore}</span>
                  </div>
                </div>
                <div style={{ height: 6, background: "#111", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct * 100}%`, background: p.color, borderRadius: 6 }} />
                </div>
              </div>
            );
          })}
        </div>

        <button 
          onClick={onPlayAgain} 
          style={{ 
            width: "100%", 
            padding: "20px 24px", 
            borderRadius: 16, 
            background: "#fff", 
            border: "none", 
            color: "#000", 
            fontFamily: "'Doto', sans-serif", 
            fontSize: 18, 
            fontWeight: 900, 
            letterSpacing: 3, 
            cursor: "pointer",
            boxShadow: `0 10px 30px ${winner.color}44`,
            transition: "transform 0.1s ease"
          }}
        >
          PLAY AGAIN →
        </button>

      </div>
    </div>
  );
}

function MatrixRain() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const fontSize = 14;
    const chars = "DHAPPA01アイウエオカキクケコサシスセソタチツテト";
    let cols = Math.floor(canvas.width / fontSize);
    let drops = Array(cols).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(5, 5, 8, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      cols = Math.floor(canvas.width / fontSize);
      if (drops.length !== cols) drops = Array(cols).fill(1);

      const RAIN_COLORS = ["#FF3333", "#33FF33", "#3399FF"];
      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const baseColor = RAIN_COLORS[i % 3];
        ctx.fillStyle = i % 5 === 0 ? baseColor : baseColor + "55";
        ctx.font = `${fontSize}px 'Doto'`;
        ctx.fillText(char, i * fontSize, y * fontSize);
        if (y * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, opacity: 0.6 }}
    />
  );
}

const DEFAULT_COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#C77DFF", "#FF9F1C"];

function SetupScreen({ onStart, cumulativeScores, players: existingPlayers, roundNum, targetScore, onTargetChange }) {
  const [n, setN] = useState(existingPlayers?.length || 3);
  const [mins, setMins] = useState(2);
  const [menuOpen, setMenuOpen] = useState(false);
  const [playerColors, setPlayerColors] = useState(() => [...DEFAULT_COLORS]);

  const [names, setNames] = useState(() => {
    const initialList = ["Player 1", "Player 2", "Player 3", "Player 4", "Player 5", "Player 6"];
    if (existingPlayers && existingPlayers.length) {
      existingPlayers.forEach((p, index) => {
        if (index < 6) {
          initialList[index] = p.name;
        }
      });
    }
    return initialList;
  });

  const hasHistory = existingPlayers?.length > 0 && roundNum > 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#050508", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", fontFamily: "'Doto', sans-serif", fontWeight: 900, boxSizing: "border-box" }}>
      <style>{FONT_IMPORT}</style>
      <MatrixRain />

      {/* Hamburger button */}
      <button onClick={() => setMenuOpen(true)} style={{ position: "absolute", top: 18, right: 18, zIndex: 10, background: "rgba(10,10,20,0.7)", border: "1px solid #333", borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 5, backdropFilter: "blur(4px)" }}>
        {[0,1,2].map(k => <div key={k} style={{ width: 22, height: 2, background: "#FF6B6B", borderRadius: 2 }} />)}
      </button>

      {/* Slide-in menu drawer */}
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 20, display: "flex" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.5)" }} onClick={() => setMenuOpen(false)} />
          <div style={{ width: 260, background: "#0a0a14", borderLeft: "1px solid #222", padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ color: "#555", fontSize: 10, letterSpacing: 4, marginBottom: 8 }}>MENU</div>
            <a href="https://mathbiceps.com" target="_blank" rel="noopener noreferrer"
              style={{ display: "block", padding: "14px 18px", borderRadius: 10, background: "#FF6B6B22", border: "1px solid #FF6B6B55", color: "#FF6B6B", fontFamily: "'Doto', sans-serif", fontSize: 14, fontWeight: 900, letterSpacing: 2, textDecoration: "none", textAlign: "center" }}>
              MATHBICEPS.COM ↗
            </a>
            <button onClick={() => setMenuOpen(false)} style={{ marginTop: "auto", padding: "10px", borderRadius: 8, background: "transparent", border: "1px solid #333", color: "#555", fontFamily: "'Doto', sans-serif", fontSize: 12, cursor: "pointer" }}>CLOSE ✕</button>
          </div>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 1, padding: "2rem", boxSizing: "border-box", overflowY: "auto", maxHeight: "100vh" }}>
        <div style={{ textAlign: "center", marginBottom: hasHistory ? 16 : 32 }}>
          <div style={{ fontSize: 48, letterSpacing: 4, color: "#fff", fontWeight: 900 }}>DHAPPA</div>
          <div style={{ color: "#555", fontSize: 12, letterSpacing: 6, marginTop: 4 }}>MULTIPLAYER CLOCK</div>
        </div>

        {hasHistory && (
          <Leaderboard
            players={existingPlayers}
            cumulativeScores={cumulativeScores}
            roundNum={roundNum - 1}
            targetScore={targetScore}
          />
        )}

        <div style={{ background: "#0a0a14", border: "1px solid #222", borderRadius: 16, padding: 28 }}>
          {!hasHistory && (
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#555", fontSize: 11, letterSpacing: 3 }}>TARGET SCORE</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number" min={1} value={targetScore}
                  onChange={e => onTargetChange(Number(e.target.value))}
                  style={{ width: 60, background: "#050508", border: "1px solid #333", borderRadius: 6, padding: "6px 10px", color: "#FFD93D", fontFamily: "'Doto', sans-serif", fontSize: 16, fontWeight: 900, outline: "none", textAlign: "center" }}
                />
                <span style={{ color: "#333", fontSize: 11 }}>pts</span>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={{ color: "#555", fontSize: 11, letterSpacing: 3, marginBottom: 10 }}>PLAYERS</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[2, 3, 4, 5, 6].map(v => (
                <button key={v} onClick={() => setN(v)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: n === v ? `2px solid ${COLORS[v - 2]}` : "1px solid #222", background: n === v ? `${COLORS[v - 2]}22` : "#050508", color: n === v ? COLORS[v - 2] : "#444", fontFamily: "'Doto', sans-serif", fontSize: 15, fontWeight: 900, cursor: "pointer", transition: "all .15s" }}>{v}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ color: "#555", fontSize: 11, letterSpacing: 3, marginBottom: 10 }}>MINUTES PER PLAYER</div>
            <input type="number" min={1} max={60} value={mins} onChange={e => setMins(Number(e.target.value))} style={{ width: "100%", background: "#050508", border: "1px solid #222", borderRadius: 8, padding: "10px 14px", color: "#fff", fontFamily: "'Doto', sans-serif", fontSize: 18, outline: "none", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: 24, textAlign: "center" }}>
            <div style={{ color: "#555", fontSize: 11, letterSpacing: 3, marginBottom: 16, textAlign: "left" }}>PLAYER NAMES (SETUP DIAL)</div>
            <div style={{ position: "relative", width: "320px", height: "320px", margin: "0 auto" }}>
              {/* SVG pie preview behind the inputs */}
              <svg width="320" height="320" viewBox="0 0 320 320" style={{ position: "absolute", inset: 0 }}>
                {Array.from({ length: n }, (_, i) => {
                  const twoPi = Math.PI * 2;
                  const sliceAngle = twoPi / n;
                  const a1 = -Math.PI / 2 + sliceAngle * i;
                  const a2 = a1 + sliceAngle;
                  const svgCx = 160, svgCy = 160;
                  const outerR = 155, innerR = 48;
                  const x1o = svgCx + outerR * Math.cos(a1), y1o = svgCy + outerR * Math.sin(a1);
                  const x2o = svgCx + outerR * Math.cos(a2), y2o = svgCy + outerR * Math.sin(a2);
                  const x1i = svgCx + innerR * Math.cos(a1), y1i = svgCy + innerR * Math.sin(a1);
                  const x2i = svgCx + innerR * Math.cos(a2), y2i = svgCy + innerR * Math.sin(a2);
                  const large = sliceAngle > Math.PI ? 1 : 0;
                  const d = `M ${x1i} ${y1i} L ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${innerR} ${innerR} 0 ${large} 0 ${x1i} ${y1i} Z`;
                  return <path key={i} d={d} fill={`${playerColors[i]}22`} stroke={`${playerColors[i]}55`} strokeWidth={1} />;
                })}
                <circle cx="160" cy="160" r="48" fill="#050508" stroke="#1a1a2e" strokeWidth={1} />
                <text x="160" y="160" textAnchor="middle" dominantBaseline="middle" fill="#222" fontSize="11" fontFamily="'Doto', sans-serif" letterSpacing="2">DHAPPA</text>
              </svg>

              {/* Name inputs + color pickers positioned in each sector */}
              {Array.from({ length: n }, (_, i) => {
                const angle = -Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / n;
                const r = 105;
                const x = 160 + r * Math.cos(angle);
                const y = 160 + r * Math.sin(angle);
                const col = playerColors[i];

                return (
                  <div key={i} style={{ position: "absolute", left: `${x}px`, top: `${y}px`, transform: "translate(-50%, -50%)", zIndex: 10, width: "90px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "9px", color: col, textShadow: "0 0 4px #000", fontFamily: "'Doto', monospace" }}>P{i + 1}</span>
                        {/* Color picker swatch */}
                        <label style={{ cursor: "pointer", position: "relative" }}>
                          <div style={{ width: 12, height: 12, borderRadius: "50%", background: col, border: "1px solid rgba(255,255,255,0.3)", boxShadow: `0 0 4px ${col}` }} />
                          <input type="color" value={col}
                            onChange={e => setPlayerColors(prev => { const u = [...prev]; u[i] = e.target.value; return u; })}
                            style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
                          />
                        </label>
                      </div>
                      <input
                        value={names[i] ?? `Player ${i + 1}`}
                        onChange={e => {
                          const val = e.target.value;
                          setNames(prev => {
                            const updated = [...prev];
                            updated[i] = val;
                            return updated;
                          });
                        }}
                        style={{ width: "100%", background: "rgba(10,10,20,0.55)", border: `1px solid ${col}55`, borderLeft: `3px solid ${col}`, borderRadius: 4, padding: "4px 6px", color: col, fontFamily: "'Doto', monospace", fontSize: "11px", outline: "none", textAlign: "center", boxSizing: "border-box", backdropFilter: "blur(4px)" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={() => onStart({ n, secs: mins * 60, names: names.slice(0, n), colors: playerColors.slice(0, n) })}
            style={{ width: "100%", padding: 14, borderRadius: 12, background: "#FF6B6B", border: "none", color: "#fff", fontFamily: "'Doto', sans-serif", fontSize: 15, fontWeight: 900, letterSpacing: 2, cursor: "pointer" }}>
            {hasHistory ? `START ROUND ${roundNum} →` : "START →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoundSummary({ roundResult, roundNum, cumulativeScores, players, targetScore, onContinue }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#050508", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Doto', sans-serif", fontWeight: 900, padding: "2rem", boxSizing: "border-box", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 520, textAlign: "center" }}>
        
        <div style={{ marginBottom: 30 }}>
          <div style={{ color: "#555", fontSize: 13, letterSpacing: 5, marginBottom: 8 }}>RESULTS SUMMARY</div>
          <div style={{ color: "#fff", fontSize: 32, fontWeight: 900, letterSpacing: 1 }}>ROUND {roundNum} COMPLETE</div>
        </div>

        <div style={{ marginBottom: 30 }}>
          <Leaderboard 
            players={players} 
            cumulativeScores={cumulativeScores} 
            roundNum={roundNum} 
            targetScore={targetScore} 
            isBig={true} 
          />
        </div>

        <button 
          onClick={onContinue} 
          style={{ 
            width: "100%", 
            padding: "20px 24px", 
            borderRadius: 16, 
            background: "#FF6B6B", 
            border: "none", 
            color: "#fff", 
            fontFamily: "'Doto', sans-serif", 
            fontSize: 18, 
            fontWeight: 900, 
            letterSpacing: 3, 
            cursor: "pointer",
            boxShadow: "0 10px 30px rgba(255, 107, 107, 0.3)",
            transition: "transform 0.1s ease"
          }}
        >
          NEXT ROUND →
        </button>

      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("setup");
  const [config, setConfig] = useState(null);
  const [players, setPlayers] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [times, setTimes] = useState([]);
  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false);
  const [popup, setPopup] = useState(null);
  const [kickActor, setKickActor] = useState(null);
  const [kickTarget, setKickTarget] = useState(null);
  const [winner, setWinner] = useState(null);
  const [highlightKick, setHighlightKick] = useState(false);
  const intervalRef = useRef(null);
  const svgRef = useRef(null);

  const [roundResult, setRoundResult] = useState(null);
  const finishOrderRef = useRef([]);
  const dhappaPlayerRef = useRef(null);
  const roundBonusesRef = useRef({});
  const winnerPointsRef = useRef({});
  const iWonCountRef = useRef(0);
  // Track alive count at moment of each "I WON" — stored per globalIdx

  const [roundNum, setRoundNum] = useState(1);
  const [targetScore, setTargetScore] = useState(11);
  const [turnDirection, setTurnDirection] = useState("counterclockwise");
  const [cumulativeScores, setCumulativeScores] = useState({});
  const [allPlayers, setAllPlayers] = useState([]);
  const [roundEvents, setRoundEvents] = useState([]);
  const roundEventsRef = useRef([]);
  const [gameWinner, setGameWinner] = useState(null);
  const [showRoundStart, setShowRoundStart] = useState(false);
  const [roundStartInfo, setRoundStartInfo] = useState(null);

  const lastTickedSecRef = useRef(-1);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const turnIndicatorRotationRef = useRef(0);
  const turnIndicatorReadyRef = useRef(false);
  const [turnIndicatorRotation, setTurnIndicatorRotation] = useState(0);
  const [centerHovered, setCenterHovered] = useState(false);
  const [dhappaTimer, setDhappaTimer] = useState(null);
  const dhappaTimerRef = useRef(null);

  // Live alive count from players state
  const aliveCount = players.filter(p => p.alive).length;

  useEffect(() => {
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const awardPoints = useCallback((playerIdx, pts) => {
    setCumulativeScores(prev => {
      const currentScore = prev[playerIdx] ?? 0;
      const newScore = currentScore + pts;
      const next = { ...prev, [playerIdx]: newScore };
      if (newScore >= targetScore && !gameWinner) {
        const winnerObj = allPlayers[playerIdx] || players[playerIdx];
        if (winnerObj) {
          clearInterval(intervalRef.current);
          setGameWinner(winnerObj);
          setScreen("gameOver");
        }
      }
      return next;
    });
  }, [targetScore, allPlayers, players, gameWinner]);

  const startGame = useCallback(({ n, secs, names, colors }) => {
    const resolvedColors = colors || COLORS;
    const ps = names.map((name, i) => ({ name, color: resolvedColors[i] || COLORS[i], dark: DARK[i], vdark: VDARK[i], alive: true, originalIdx: i }));
    setPlayers(ps);
    setTimes(Array(n).fill(secs));
    
    const startPlayerIdx = Math.floor(Math.random() * n);
    setActiveIdx(startPlayerIdx);
    
    setPaused(true);
    setStarted(false);
    setWinner(null);
    setPopup(null);
    finishOrderRef.current = [];
    dhappaPlayerRef.current = null;
    roundBonusesRef.current = {};
    winnerPointsRef.current = {};
    iWonCountRef.current = 0;
    setRoundResult(null);
    setRoundEvents([]);
    roundEventsRef.current = [];
    lastTickedSecRef.current = -1;
    turnIndicatorRotationRef.current = 0;
    turnIndicatorReadyRef.current = false;
    setTurnIndicatorRotation(0);
    setKickActor(null);
    setKickTarget(null);

    const rosterChanged = allPlayers.length !== ps.length || allPlayers.some((p, i) => p.name !== ps[i]?.name);
    const nextRoundNum = rosterChanged ? 1 : roundNum;
    if (allPlayers.length === 0 || rosterChanged) {
      setAllPlayers(ps);
      const initialScores = {};
      ps.forEach((_, i) => { initialScores[i] = 0; });
      setCumulativeScores(initialScores);
      if (rosterChanged) {
        setRoundNum(1);
        setGameWinner(null);
      }
    }

    setRoundStartInfo({ roundNum: nextRoundNum, starterName: names[startPlayerIdx], starterColor: resolvedColors[startPlayerIdx] || COLORS[startPlayerIdx], startPlayerIdx });
    setShowRoundStart(true);

    setConfig({ n, secs, names, turnDirection });
    setScreen("game");
  }, [roundNum, allPlayers, turnDirection]);

  const handleRoundStartClose = useCallback(() => {
    setShowRoundStart(false);
    if (roundStartInfo) {
      setActiveIdx(roundStartInfo.startPlayerIdx);
      setStarted(true);
      setPaused(false);
    }
  }, [roundStartInfo]);

  const alivePlayers = players.filter(p => p.alive);

  useEffect(() => {
    if (!started || paused || !players.length || !config) return;
    const aliveIdxs = players.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
    const cur = aliveIdxs[activeIdx % Math.max(aliveIdxs.length, 1)];
    if (cur === undefined) return;
    const t = times[cur];
    if (t > 0 && t <= 10 && t !== lastTickedSecRef.current) {
      lastTickedSecRef.current = t;
      playTick(t === 1);
    }
    if (t > 10) lastTickedSecRef.current = -1;
  }, [times, started, paused, players, activeIdx, config]);

  useEffect(() => {
    lastTickedSecRef.current = -1;
  }, [activeIdx]);

  const tick = useCallback(() => {
    setTimes(prev => {
      const next = [...prev];
      const aliveIdx = players.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
      const cur = aliveIdx[activeIdx % aliveIdx.length];
      if (cur === undefined || next[cur] <= 0) return next;
      next[cur] = Math.max(0, next[cur] - 1);
      return next;
    });
  }, [players, activeIdx]);

  useEffect(() => {
    if (!started || paused || winner || popup || gameWinner) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [started, paused, winner, popup, tick, gameWinner]);

  const aliveIndices = players.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
  const curGlobalIdx = aliveIndices[activeIdx % Math.max(aliveIndices.length, 1)];
  const totalPlayers = config?.n ?? players.length;
  const sectorByOrig = getAliveSectors(alivePlayers, totalPlayers, -Math.PI / 2);
  const activeSectorForTurn = players[curGlobalIdx] ? sectorByOrig.get(players[curGlobalIdx].originalIdx) : null;
  const activeSectorMidDeg = activeSectorForTurn ? activeSectorForTurn.midAngle * 180 / Math.PI : null;

  useEffect(() => {
    if (activeSectorMidDeg === null) return;
    if (!turnIndicatorReadyRef.current) {
      turnIndicatorReadyRef.current = true;
      turnIndicatorRotationRef.current = activeSectorMidDeg;
      setTurnIndicatorRotation(activeSectorMidDeg);
      return;
    }

    const current = turnIndicatorRotationRef.current;
    const normalizedCurrent = ((current % 360) + 360) % 360;
    const normalizedTarget = ((activeSectorMidDeg % 360) + 360) % 360;
    const clockwiseDelta = (normalizedTarget - normalizedCurrent + 360) % 360;
    const counterDelta = -((normalizedCurrent - normalizedTarget + 360) % 360);
    const delta = turnDirection === "clockwise" ? clockwiseDelta : counterDelta;
    if (Math.abs(delta) < 0.001) return;

    turnIndicatorRotationRef.current = current + delta;
    setTurnIndicatorRotation(turnIndicatorRotationRef.current);
  }, [activeSectorMidDeg, turnDirection]);

  useEffect(() => {
    if (!started || !players.length) return;
    if (times[curGlobalIdx] <= 0) kickPlayer(curGlobalIdx, "timeout");
  }, [times, started, players, curGlobalIdx]);

  const passToNext = useCallback((fromGlobal) => {
    if (!started) { setStarted(true); setPaused(false); return; }
    if (paused || winner || popup) return;
    const alive = players.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
    if (alive.length <= 1) return;
    const curPos = alive.indexOf(fromGlobal ?? curGlobalIdx);
    const step = turnDirection === "clockwise" ? 1 : -1;
    const nextPos = (curPos + step + alive.length) % alive.length;
    setActiveIdx(nextPos);
  }, [started, paused, winner, popup, players, curGlobalIdx, turnDirection]);

  const resetGame = useCallback(() => {
    clearInterval(intervalRef.current);
    setScreen("setup");
    setConfig(null);
    setPlayers([]);
    setActiveIdx(0);
    setTimes([]);
    setPaused(true);
    setStarted(false);
    setPopup(null);
    setKickActor(null);
    setKickTarget(null);
    setWinner(null);
    setHighlightKick(false);
    setRoundResult(null);
    setRoundNum(1);
    setTargetScore(11);
    setTurnDirection("counterclockwise");
    setCumulativeScores({});
    setAllPlayers([]);
    setRoundEvents([]);
    setGameWinner(null);
    setShowRoundStart(false);
    setRoundStartInfo(null);
    finishOrderRef.current = [];
    dhappaPlayerRef.current = null;
    roundBonusesRef.current = {};
    winnerPointsRef.current = {};
    iWonCountRef.current = 0;
    roundEventsRef.current = [];
    lastTickedSecRef.current = -1;
    turnIndicatorRotationRef.current = 0;
    turnIndicatorReadyRef.current = false;
    setTurnIndicatorRotation(0);
  }, []);

  const addRoundEvent = (globalIdx, reason, pts, targetIdx = null) => {
    const ev = { globalIdx, reason, pts, targetIdx };
    roundEventsRef.current = [...roundEventsRef.current, ev];
    setRoundEvents([...roundEventsRef.current]);
  };

  const addRoundBonus = (globalIdx, pts) => {
    roundBonusesRef.current = {
      ...roundBonusesRef.current,
      [globalIdx]: (roundBonusesRef.current[globalIdx] ?? 0) + pts,
    };
  };

  const endRound = useCallback((finalOrder, dhappaIdx, allPlayersSnap, totalPlayers, loserIdx) => {
    void dhappaIdx;
    clearInterval(intervalRef.current);

    const result = [];

    finalOrder.forEach((globalIdx, eliminationPos) => {
      // Points were already awarded in handleIWon / kickPlayer / awardPoints at the time of elimination.
      // Here we just build the result display — earned points already recorded in roundBonusesRef / winnerPointsRef.
      const dhappaBonus = roundBonusesRef.current[globalIdx] ?? 0;
      const winnerPts = winnerPointsRef.current[globalIdx] ?? 0;
      const earned = winnerPts + dhappaBonus;
      result.push({
        globalIdx,
        name: allPlayersSnap[globalIdx].name,
        color: allPlayersSnap[globalIdx].color,
        position: eliminationPos,
        earned,
        dhappa: dhappaBonus > 0,
        isLoser: globalIdx === loserIdx,
      });
    });

    result.sort((a, b) => b.position - a.position);

    setCumulativeScores(prev => {
      const winnerEntry = Object.entries(prev).find(([, score]) => score >= targetScore);
      if (winnerEntry) {
        const winnerIdx = parseInt(winnerEntry[0]);
        setGameWinner(allPlayersSnap[winnerIdx]);
        setScreen("gameOver");
      } else {
        setScreen("roundSummary");
      }
      return prev;
    });

    setRoundResult(result);
    setRoundNum(prev => prev + 1);
  }, [targetScore]);

  const kickPlayer = useCallback((globalIdx, reason = "kicked") => {
    setPlayers(prev => {
      const next = prev.map((p, i) => i === globalIdx ? { ...p, alive: false } : p);
      const stillAlive = next.filter(p => p.alive);
      const previousOrder = [...finishOrderRef.current];
      const newOrder = [...finishOrderRef.current, globalIdx];
      finishOrderRef.current = newOrder;

      if (stillAlive.length <= 1) {
        let fullOrder = [...newOrder];
        let loserIdx = null;

        if (stillAlive.length === 1) {
          const lastIdx = next.indexOf(stillAlive[0]);
          if (reason === "kicked" || reason === "timeout") {
            loserIdx = globalIdx;
            fullOrder = [globalIdx, ...previousOrder, lastIdx];
          } else {
            loserIdx = lastIdx;
            addRoundEvent(lastIdx, "last", 0);
            fullOrder = [lastIdx, ...newOrder];
          }
        } else {
          loserIdx = newOrder[0];
          fullOrder = newOrder;
        }

        finishOrderRef.current = fullOrder;
        setTimeout(() => endRound(fullOrder, dhappaPlayerRef.current, next, config?.n ?? prev.length, loserIdx), 0);
      } else {
        const aliveIdxs = next.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
        const newActivePos = aliveIdxs.indexOf(curGlobalIdx);
        if (newActivePos !== -1) {
          setActiveIdx(newActivePos);
        } else {
          setActiveIdx(0);
        }
      }
      return next;
    });
    setPopup(null);
    setKickActor(null);
    setKickTarget(null);
    setHighlightKick(false);
    setPaused(false);
  }, [endRound, config, curGlobalIdx]);

  const handleDhappa = () => {
    setPaused(true);
    setDhappaTimer(30);
    setPopup("dhappa");
  };

  // Dhappa 30s countdown — auto-cancel when it hits 0
  useEffect(() => {
    if (popup !== "dhappa" || dhappaTimer === null) return;
    if (dhappaTimer <= 0) {
      handleCancelDhappa();
      return;
    }
    dhappaTimerRef.current = setTimeout(() => setDhappaTimer(t => t - 1), 1000);
    return () => clearTimeout(dhappaTimerRef.current);
  }, [popup, dhappaTimer]);

  // I WON → fixed sequence: 1st=5, 2nd=3, 3rd=2, 4th=1, 5th=1
  const nextIWonPoints = I_WON_POINTS[iWonCountRef.current] ?? 0;

  const handleIWon = () => {
    const dhappaCallerIdx = curGlobalIdx;
    // Points by win order: 1st=5, 2nd=3, 3rd=2, 4th=1, 5th=1
    const pts = I_WON_POINTS[iWonCountRef.current] ?? 0;
    iWonCountRef.current += 1;
    winnerPointsRef.current = { ...winnerPointsRef.current, [dhappaCallerIdx]: pts };
    addRoundEvent(dhappaCallerIdx, "iwon", pts);
    awardPoints(dhappaCallerIdx, pts);

    setPlayers(prev => {
      const next = prev.map((p, i) => i === dhappaCallerIdx ? { ...p, alive: false } : p);
      const stillAlive = next.filter(p => p.alive);
      const newOrder = [...finishOrderRef.current, dhappaCallerIdx];
      finishOrderRef.current = newOrder;

      if (stillAlive.length <= 1) {
        let fullOrder = [...newOrder];
        let loserIdx = null;
        if (stillAlive.length === 1) {
          const lastIdx = next.indexOf(stillAlive[0]);
          loserIdx = lastIdx;
          addRoundEvent(lastIdx, "last", 0);
          fullOrder = [lastIdx, ...newOrder];
        } else {
          loserIdx = newOrder[0];
        }
        finishOrderRef.current = fullOrder;
        setTimeout(() => endRound(fullOrder, dhappaCallerIdx, next, config?.n ?? prev.length, loserIdx), 0);
      } else {
        const aliveIdxs = next.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
        const oldAliveIdxs = prev.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
        const kickedPos = oldAliveIdxs.indexOf(dhappaCallerIdx);

        const nextPlayerGlobalIdx = oldAliveIdxs[(kickedPos - 1 + oldAliveIdxs.length) % oldAliveIdxs.length];
        const newActivePos = aliveIdxs.indexOf(nextPlayerGlobalIdx);

        if (newActivePos !== -1) {
          setActiveIdx(newActivePos);
        } else {
          setActiveIdx(0);
        }
      }
      return next;
    });

    setPopup(null);
    setKickActor(null);
    setKickTarget(null);
    setHighlightKick(false);
    setPaused(false);
    clearTimeout(dhappaTimerRef.current);
    setDhappaTimer(null);
  };

  const handleKickSomeone = () => {
    clearTimeout(dhappaTimerRef.current);
    setDhappaTimer(null);
    setKickActor(curGlobalIdx);
    setPopup(null);
    setHighlightKick(true);
  };

  const handleDirectKick = (targetIdx) => {
    const actorIdx = curGlobalIdx;
    const pts = KICK_POINTS; // always 3, regardless of player count
    if (dhappaPlayerRef.current === null) dhappaPlayerRef.current = actorIdx;
    addRoundBonus(actorIdx, pts);
    addRoundEvent(actorIdx, "kick", pts, targetIdx);
    awardPoints(actorIdx, pts);
    kickPlayer(targetIdx, "kicked");
  };

  const handleCancelDhappa = () => {
    clearTimeout(dhappaTimerRef.current);
    setDhappaTimer(null);
    setPopup(null);
    setHighlightKick(false);
    setKickActor(null);
    setKickTarget(null);
    setPaused(false);
  };

  if (screen === "setup") {
    return (
      <SetupScreen
        onStart={startGame}
        cumulativeScores={cumulativeScores}
        players={allPlayers}
        roundNum={roundNum}
        targetScore={targetScore}
        onTargetChange={setTargetScore}
      />
    );
  }

  if (screen === "roundSummary") {
    return (
      <RoundSummary
        roundResult={roundResult}
        roundNum={roundNum - 1}
        cumulativeScores={cumulativeScores}
        players={allPlayers}
        targetScore={targetScore}
        onContinue={() => {
          startGame({
            n: config.n,
            secs: config.secs,
            names: config.names
          });
        }}
      />
    );
  }

  if (screen === "gameOver") {
    return (
      <GameOverScreen
        winner={gameWinner}
        cumulativeScores={cumulativeScores}
        players={allPlayers}
        targetScore={targetScore}
        onPlayAgain={() => {
          setGameWinner(null);
          setRoundNum(1);
          setCumulativeScores({});
          setAllPlayers([]);
          setScreen("setup");
        }}
      />
    );
  }

  const isPortrait = dimensions.height > dimensions.width;
  const cx = dimensions.width / 2;
  const minClockHeight = isPortrait ? Math.max(dimensions.width + 140, 560) : 560;
  const clockHeight = Math.max(dimensions.height, minClockHeight);
  const cy = clockHeight / 2;
  const baseScale = Math.min(dimensions.width, clockHeight);
  const centerR = baseScale * 0.24;
  const outerR = Math.max(dimensions.width, clockHeight) * 2.0;
  const timeR = baseScale * 0.385;
  const n = aliveCount;
  const dhappaFontSize = centerR * 0.58;
  const dhappaTextLength = centerR * 1.72;
  const timerFontSize = baseScale * (n <= 2 ? 0.21 : n <= 3 ? 0.165 : n <= 4 ? 0.14 : 0.112);

  return (
    <div className="app-container" style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#050508", fontFamily: "'Doto', sans-serif", fontWeight: 900, userSelect: "none", overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
      <style>{`
        ${FONT_IMPORT}
        .clock-view-wrapper { position: relative !important; width: 100% !important; height: ${clockHeight}px !important; }
        .action-dashboard { position: relative !important; height: auto !important; max-height: none !important; }
        .app-container, .app-container * { font-family: 'Doto', sans-serif !important; font-weight: 900 !important; }
        .app-container text { font-weight: 900 !important; }
        .app-container, .app-container *:not(input):not(svg):not(circle):not(path):not(line):not(rect):not(textPath) {
          -webkit-text-stroke: 2.5px rgba(0,0,0,0.85);
          paint-order: stroke fill;
        }
      `}</style>

      {showRoundStart && roundStartInfo && (
        <RoundStartPopup
          roundNum={roundStartInfo.roundNum}
          starterName={roundStartInfo.starterName}
          starterColor={roundStartInfo.starterColor}
          onClose={handleRoundStartClose}
        />
      )}

      <div className="clock-view-wrapper" style={{ position: "relative", width: "100%", height: clockHeight, overflow: "hidden", background: "#050508" }}>
        
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", boxSizing: "border-box" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => { setPaused(true); setPopup(null); setConfig(null); setScreen("setup"); }} style={{ background: "#05050899", border: "2px solid #333", borderRadius: 8, color: "#777", padding: "9px 16px", fontFamily: "'Doto', sans-serif", fontSize: 14, fontWeight: 900, cursor: "pointer", letterSpacing: 1, backdropFilter: "blur(4px)" }}>← SETUP</button>
            <button onClick={resetGame} style={{ background: "#05050899", border: "2px solid #333", borderRadius: 8, color: "#FF6B6B", padding: "9px 16px", fontFamily: "'Doto', sans-serif", fontSize: 14, fontWeight: 900, cursor: "pointer", letterSpacing: 1, backdropFilter: "blur(4px)" }}>RESET</button>
            <button onClick={() => { if (!started) { setStarted(true); setPaused(false); return; } setPaused(p => !p); }}
              disabled={!!winner}
              style={{ background: paused ? "#FFD93D22" : "#05050899", border: `2px solid ${paused ? "#FFD93D" : "#333"}`, borderRadius: 8, color: paused ? "#FFD93D" : "#777", padding: "9px 16px", fontFamily: "'Doto', sans-serif", fontSize: 14, fontWeight: 900, cursor: winner ? "not-allowed" : "pointer", letterSpacing: 1, backdropFilter: "blur(4px)" }}>
              {!started ? "START" : paused ? "GO" : "PAUSE"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ color: "#444", fontSize: 13, fontWeight: 900, letterSpacing: 2 }}>R{roundNum - 1}</div>
            <div style={{ color: paused ? "#FFD93D" : "#FF6B6B", fontSize: 14, fontWeight: 900, letterSpacing: 2 }}>
              {!started ? "TAP TO START" : paused ? "PAUSED" : "● LIVE"}
            </div>
          </div>
        </div>

        {highlightKick && (
          <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 30, background: "#FF6B6B15", border: "2px solid #FF6B6B", borderRadius: 12, padding: "10px 20px", display: "flex", alignItems: "center", gap: 14, backdropFilter: "blur(8px)", boxShadow: "0 8px 32px rgba(255, 107, 107, 0.15)" }}>
            <span style={{ color: "#FF6B6B", fontSize: 13, fontWeight: 900, letterSpacing: 1 }}>💀 SELECT PLAYER TO KICK OUT</span>
            <button onClick={handleCancelDhappa} style={{ background: "#FF6B6B", border: "none", borderRadius: 6, color: "#fff", padding: "4px 10px", fontFamily: "'Doto', sans-serif", fontSize: 11, fontWeight: 900, cursor: "pointer" }}>CANCEL</button>
          </div>
        )}

        <svg width="100%" height={clockHeight} viewBox={`0 0 ${dimensions.width} ${clockHeight}`} ref={svgRef} style={{ display: "block" }}>
          <rect x={0} y={0} width={dimensions.width} height={clockHeight} fill="#050508" />

          {alivePlayers.map((player) => {
            const globalIdx = players.indexOf(player);
            const origIdx = player.originalIdx;
            const isActive = globalIdx === curGlobalIdx;

            const sector = sectorByOrig.get(origIdx);
            if (!sector) return null;
            const { angle1, angle2, midAngle } = sector;

            const x1 = cx + outerR * Math.cos(angle1);
            const y1 = cy + outerR * Math.sin(angle1);
            const x2 = cx + outerR * Math.cos(angle2);
            const y2 = cy + outerR * Math.sin(angle2);
            const xc1 = cx + centerR * Math.cos(angle1);
            const yc1 = cy + centerR * Math.sin(angle1);
            const xc2 = cx + centerR * Math.cos(angle2);
            const yc2 = cy + centerR * Math.sin(angle2);
            const largeArc = (angle2 - angle1) > Math.PI ? 1 : 0;
            const path = `M ${xc1} ${yc1} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${xc2} ${yc2} A ${centerR} ${centerR} 0 ${largeArc} 0 ${xc1} ${yc1} Z`;
            const pct = times[globalIdx] / config.secs;
            const isLow = pct < 0.2;
            const fillAlpha = isActive ? "ff" : "cc";
            const fillColor = isLow ? "#FF6B6B" : player.color;
            const isKickHighlight = highlightKick && globalIdx !== kickActor;

            const tx = cx + timeR * Math.cos(midAngle);
            const ty = cy + timeR * Math.sin(midAngle);
            const deg = (midAngle * 180 / Math.PI) - 90;
            const t = times[globalIdx];
            const dispColor = isLow ? "#ff0000" : timerColor(player.color);

            const nameFontSize = baseScale * 0.034;
            // Place arc just outside center circle so names wrap around it facing inward
            const nameR = centerR + nameFontSize * 1.1;
            const nameInset = Math.min((angle2 - angle1) * 0.08, 0.12);
            const nameStartAngle = angle1 + nameInset;
            const nameEndAngle = angle2 - nameInset;
            const nameLargeArc = (nameEndAngle - nameStartAngle) > Math.PI ? 1 : 0;
            // Draw arc counterclockwise (end→start, sweep=0) so text baseline faces center
            const nameStartX = cx + nameR * Math.cos(nameEndAngle);
            const nameStartY = cy + nameR * Math.sin(nameEndAngle);
            const nameEndX = cx + nameR * Math.cos(nameStartAngle);
            const nameEndY = cy + nameR * Math.sin(nameStartAngle);
            const namePathId = `name-ring-${origIdx}`;

            return (
              <g key={globalIdx} onClick={() => {
                if (highlightKick) {
                  if (globalIdx !== curGlobalIdx) {
                    handleDirectKick(globalIdx);
                  }
                  return;
                }
                if (globalIdx === curGlobalIdx && !popup) passToNext(globalIdx);
              }} style={{ cursor: highlightKick ? (globalIdx !== curGlobalIdx ? "pointer" : "not-allowed") : globalIdx === curGlobalIdx ? "pointer" : "default" }}>
                <path d={path}
                  fill={`${fillColor}${isKickHighlight ? "dd" : fillAlpha}`}
                  stroke={isActive ? fillColor : "#0f0f20"}
                  strokeWidth={isActive ? 2 : 1}
                  style={{ transition: "fill .3s,stroke .3s" }}
                />
                <defs>
                  {/* Arc drawn end→start (sweep-flag=0) so text baseline faces center */}
                  <path id={namePathId} d={`M ${nameStartX} ${nameStartY} A ${nameR} ${nameR} 0 ${nameLargeArc} 0 ${nameEndX} ${nameEndY}`} fill="none" />
                </defs>
                <text fontFamily="'Doto', sans-serif"
                  fontSize={nameFontSize}
                  fontWeight={900}
                  fill="#000000"
                  stroke="rgba(255,255,255,0.24)"
                  strokeWidth={baseScale * 0.003}
                  paintOrder="stroke fill"
                  style={{ letterSpacing: "1px" }}>
                  <textPath href={`#${namePathId}`} startOffset="50%" textAnchor="middle">
                    {player.name.toUpperCase()}
                  </textPath>
                </text>
                <g transform={`translate(${tx},${ty}) rotate(${deg})`}>
                  <text textAnchor="middle" dominantBaseline="middle" fontSize={timerFontSize} fontWeight={900} fill={dispColor} fontFamily="'Doto', sans-serif" style={{ letterSpacing: 1 }}>
                    {formatTime(t)}
                  </text>
                  {isKickHighlight && (
                    <text textAnchor="middle" dominantBaseline="middle" fontSize={baseScale * 0.022} fill="#FF6B6B" stroke="rgba(0,0,0,0.85)" strokeWidth={baseScale * 0.009} paintOrder="stroke fill" fontFamily="'Doto', sans-serif" dy={baseScale * 0.06} style={{ animation: "pulse 1.5s infinite" }}>TAP TO KICK</text>
                  )}
                </g>
              </g>
            );
          })}

          {alivePlayers.map((player) => {
            const origIdx = player.originalIdx;
            const sector = sectorByOrig.get(origIdx);
            if (!sector) return null;
            const { angle1 } = sector;
            const pv = [cx + centerR * Math.cos(angle1), cy + centerR * Math.sin(angle1)];
            const edgeVert = [cx + outerR * Math.cos(angle1), cy + outerR * Math.sin(angle1)];
            return <line key={`div-${origIdx}`} x1={pv[0]} y1={pv[1]} x2={edgeVert[0]} y2={edgeVert[1]} stroke="#050508" strokeWidth={3} />;
          })}

          <circle cx={cx} cy={cy} r={centerR}
            fill={centerHovered ? "#1e1e35" : "#0f0f20"}
            stroke={centerHovered ? "#FF6B6B55" : "none"} strokeWidth={2}
            onClick={handleDhappa}
            onMouseEnter={() => setCenterHovered(true)}
            onMouseLeave={() => setCenterHovered(false)}
            style={{ cursor: "pointer", transition: "fill .15s, stroke .15s" }}
          />

          {(() => {
            if (!started) return null;
            const activePlayer = players[curGlobalIdx];
            if (!activePlayer) return null;
            const activeSector = sectorByOrig.get(activePlayer.originalIdx);
            if (!activeSector) return null;
            const arcR = centerR - baseScale * 0.012;
            const halfSpanRad = Math.max((activeSector.angle2 - activeSector.angle1) / 2, 0.12);
            const x1a = cx + arcR * Math.cos(-halfSpanRad);
            const y1a = cy + arcR * Math.sin(-halfSpanRad);
            const x2a = cx + arcR * Math.cos(halfSpanRad);
            const y2a = cy + arcR * Math.sin(halfSpanRad);
            const largeArc = halfSpanRad * 2 > Math.PI ? 1 : 0;
            return (
              <path d={`M ${x1a} ${y1a} A ${arcR} ${arcR} 0 ${largeArc} 1 ${x2a} ${y2a}`}
                fill="none" stroke={activePlayer.color} strokeWidth={baseScale * 0.018} strokeLinecap="round" strokeLinejoin="round"
                style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${turnIndicatorRotation}deg)`, transition: "transform .35s linear" }}
              />
            );
          })()}

          <text x={cx} y={cy - dhappaFontSize * 0.08} textAnchor="middle" dominantBaseline="middle"
            fontSize={dhappaFontSize} fontWeight={900}
            textLength={dhappaTextLength}
            lengthAdjust="spacingAndGlyphs"
            fill={centerHovered ? "#ff9999" : "#FF6B6B"}
            stroke="rgba(0,0,0,0.85)"
            strokeWidth={baseScale * 0.010}
            paintOrder="stroke fill"
            fontFamily="'Doto', sans-serif"
            onClick={handleDhappa}
            onMouseEnter={() => setCenterHovered(true)} onMouseLeave={() => setCenterHovered(false)}
            style={{ cursor: "pointer", letterSpacing: 0, transition: "fill .15s" }}>
            DHAPPA
          </text>
          <text x={cx} y={cy + dhappaFontSize * 0.68} textAnchor="middle" dominantBaseline="middle"
            fontSize={dhappaFontSize * 0.22} fontWeight={900}
            fill={centerHovered ? "#ff9999" : "#FF6B6B"}
            stroke="rgba(0,0,0,0.85)" strokeWidth={baseScale * 0.010} paintOrder="stroke fill"
            fontFamily="'Doto', sans-serif"
            onClick={handleDhappa}
            onMouseEnter={() => setCenterHovered(true)} onMouseLeave={() => setCenterHovered(false)}
            style={{ cursor: "pointer", letterSpacing: 1, transition: "fill .15s", opacity: 0.9 }}>
            TAP FOR DHAPPA
          </text>
        </svg>

        {popup === "dhappa" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#050508cc", zIndex: 100 }}>
            <div style={{ background: "#0a0a14", border: "2px solid #FF6B6B44", borderRadius: 24, padding: 40, textAlign: "center", width: 360, maxWidth: "90%" }}>
              <div style={{ color: "#FF6B6B", fontSize: 34, fontWeight: 900, letterSpacing: 3, marginBottom: 6 }}>DHAPPA!</div>
              <div style={{ color: "#666", fontSize: 14, fontWeight: 900, letterSpacing: 2, marginBottom: 12 }}>CHOOSE YOUR MOVE</div>

              {/* Timer bar + countdown */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <div style={{ flex: 1, height: 6, background: "#111", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${(dhappaTimer / 30) * 100}%`,
                    background: dhappaTimer <= 10 ? "#FF6B6B" : "#FFD93D",
                    borderRadius: 6,
                    transition: "width 1s linear, background 0.3s"
                  }} />
                </div>
                <div style={{ color: dhappaTimer <= 10 ? "#FF6B6B" : "#FFD93D", fontSize: 13, fontWeight: 900, minWidth: 28, textAlign: "right", transition: "color 0.3s" }}>
                  {dhappaTimer}s
                </div>
              </div>

              <button onClick={handleIWon} style={{ width: "100%", padding: "20px 0", borderRadius: 12, background: "#6BCB7722", border: "2px solid #6BCB77", color: "#6BCB77", fontFamily: "'Doto', sans-serif", fontSize: 18, fontWeight: 900, cursor: "pointer", marginBottom: 8, letterSpacing: 1 }}>
                I WON 🏆
              </button>
              <div style={{ color: "#6BCB7799", fontSize: 14, fontWeight: 900, marginBottom: 22, letterSpacing: 1 }}>
                Awards you: <strong style={{ color: "#6BCB77" }}>+{nextIWonPoints} pts</strong>
              </div>

              <button onClick={handleKickSomeone} style={{ width: "100%", padding: "20px 0", borderRadius: 12, background: "#FF6B6B22", border: "2px solid #FF6B6B", color: "#FF6B6B", fontFamily: "'Doto', sans-serif", fontSize: 18, fontWeight: 900, cursor: "pointer", marginBottom: 8, letterSpacing: 1 }}>
                KICK SOMEONE 💀
              </button>
              <div style={{ color: "#FF6B6B99", fontSize: 14, fontWeight: 900, marginBottom: 22, letterSpacing: 1 }}>
                Awards you: <strong style={{ color: "#FF6B6B" }}>+{KICK_POINTS} pts</strong> · kicked player gets 0
              </div>

              <button onClick={handleCancelDhappa} style={{ width: "100%", padding: "14px 0", borderRadius: 10, background: "none", border: "2px solid #333", color: "#666", fontFamily: "'Doto', sans-serif", fontSize: 15, fontWeight: 900, cursor: "pointer", letterSpacing: 2 }}>CANCEL</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
