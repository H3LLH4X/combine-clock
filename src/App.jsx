import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF9F1C"];
const DARK =   ["#cc2222","#cc9900","#1e8c3a","#1155cc","#7722cc","#cc5500"];
const VDARK =  ["#3a0000","#3a2800","#003a10","#00103a","#1a003a","#3a1500"];

const DHAPPA_POINTS = 3;

// Points for "I WON" positions — awarded in sequence as players win
// Index 0 = first winner, 1 = second winner, etc.
// Last player ALWAYS gets 0 regardless of total.
// 6p: 5,3,2,1,0  (last=0)
// 5p: 5,3,2,1    (last=0)
// 4p: 5,3,2      (last=0)
// 3p: 5,3        (last=0)
// 2p: 5          (last=0)
const WIN_POINTS_TABLE = {
  6: [5, 3, 2, 1, 0],  // 5 winners, last gets 0
  5: [5, 3, 2, 1],     // 4 winners, last gets 0
  4: [5, 3, 2],        // 3 winners, last gets 0
  3: [5, 3],           // 2 winners, last gets 0
  2: [5],              // 1 winner, last gets 0
};

// winnerCount = how many "I WON" players have already won before this one (0-indexed)
// totalPlayers = total players in the round
function getNextWinnerPoints(winnerCount, totalPlayers) {
  const table = WIN_POINTS_TABLE[totalPlayers] ?? [5];
  return table[winnerCount] ?? 0;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
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

// ── SOUND: tick each second when ≤10s remain ──
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
  } catch(e) {}
}

// ── LEADERBOARD PANEL ──
function Leaderboard({ players, cumulativeScores, roundNum, targetScore }) {
  const sorted = [...players].map((p, i) => ({ ...p, score: cumulativeScores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return (
      <div style={{background:"#0a0a14",border:"1px solid #1a1a2e",borderRadius:16,padding:22,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{color:"#666",fontSize:13,fontWeight:900,letterSpacing:3}}>LEADERBOARD{roundNum > 0 ? ` · ROUND ${roundNum}` : ""}</div>
        <div style={{color:"#555",fontSize:13,fontWeight:900,letterSpacing:2}}>TARGET: <span style={{color:"#FFD93D",fontWeight:900}}>{targetScore}</span></div>
      </div>
      {sorted.map((p, i) => {
        const pct = Math.min(p.score / targetScore, 1);
        const isLeading = i === 0 && p.score > 0;
        return (
          <div key={p.name} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:"#444",fontSize:13,fontWeight:900,width:16}}>{i+1}</span>
                <div style={{width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                <span style={{color:p.color,fontSize:16,fontWeight:900}}>{p.name}</span>
                {isLeading && <span style={{color:"#FFD93D",fontSize:11,fontWeight:900,letterSpacing:2,background:"#FFD93D15",padding:"3px 7px",borderRadius:4}}>LEAD</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{color:p.color,fontWeight:900,fontSize:17}}>{p.score}</span>
                <span style={{color:"#444",fontSize:13,fontWeight:900}}>/{targetScore}</span>
              </div>
            </div>
            <div style={{height:4,background:"#111",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct*100}%`,background:p.color,borderRadius:4,transition:"width .5s cubic-bezier(.4,0,.2,1)",opacity:0.85}}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ROUND PROGRESS (live kickout feed) ──
function RoundProgress({ events, players }) {
  if (!events.length) return null;
  return (
    <div style={{background:"#0a0a14",border:"1px solid #1a1a2e",borderRadius:14,padding:18,marginBottom:16}}>
      <div style={{color:"#666",fontSize:13,fontWeight:900,letterSpacing:3,marginBottom:14}}>THIS ROUND</div>
      {events.map((ev, i) => {
        const p = players[ev.globalIdx];
        const target = ev.targetIdx !== null && ev.targetIdx !== undefined ? players[ev.targetIdx] : null;
        if (!p) return null;
        return (
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:p.color,flexShrink:0}}/>
            <div style={{flex:1,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{color:p.color,fontSize:15,fontWeight:900}}>{p.name}</span>
                {ev.reason === "iwon"    && <span style={{color:"#6BCB77",fontSize:11,fontWeight:900,background:"#6BCB7722",padding:"3px 7px",borderRadius:4,letterSpacing:1}}>I WON</span>}
                {ev.reason === "kick"    && <span style={{color:"#FF6B6B",fontSize:11,fontWeight:900,background:"#FF6B6B22",padding:"3px 7px",borderRadius:4,letterSpacing:1}}>KICKED{target ? ` ${target.name}` : ""}</span>}
                {ev.reason === "kicked"  && <span style={{color:"#FF6B6B",fontSize:11,fontWeight:900,background:"#FF6B6B22",padding:"3px 7px",borderRadius:4,letterSpacing:1}}>KICKED</span>}
                {ev.reason === "timeout" && <span style={{color:"#FFD93D",fontSize:11,fontWeight:900,background:"#FFD93D22",padding:"3px 7px",borderRadius:4,letterSpacing:1}}>TIMEOUT</span>}
                {ev.reason === "last"    && <span style={{color:"#666",fontSize:11,fontWeight:900,background:"#ffffff11",padding:"3px 7px",borderRadius:4,letterSpacing:1}}>LOST</span>}
              </div>
              <span style={{color:ev.pts > 0 ? p.color : "#666",fontWeight:900,fontSize:16}}>{ev.pts > 0 ? `+${ev.pts}` : "0 pts"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ROUND START POPUP ──
function RoundStartPopup({ roundNum, starterName, starterColor, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:99999,background:"#050508ee",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>
      <div style={{background:"#0a0a14",border:`1px solid ${starterColor}44`,borderRadius:28,padding:44,textAlign:"center",maxWidth:320,width:"90%"}}>
        <div style={{color:"#555",fontSize:10,letterSpacing:5,marginBottom:16}}>GET READY</div>
        <div style={{fontSize:52,fontWeight:900,letterSpacing:2,color:"#fff",marginBottom:4}}>R{roundNum}</div>
        <div style={{color:"#444",fontSize:11,letterSpacing:3,marginBottom:24}}>ROUND {roundNum}</div>
        <div style={{color:"#555",fontSize:11,letterSpacing:2,marginBottom:8}}>STARTS WITH</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:30}}>
          <div style={{width:12,height:12,borderRadius:"50%",background:starterColor}}/>
          <span style={{color:starterColor,fontSize:22,fontWeight:900}}>{starterName}</span>
        </div>
        <button onClick={onClose} style={{width:"100%",padding:14,borderRadius:12,background:starterColor,border:"none",color:"#000",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,letterSpacing:2,cursor:"pointer"}}>
          LET'S GO →
        </button>
      </div>
    </div>
  );
}

// ── ROUND LOSER POPUP ──
function RoundLoserPopup({ loser, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:99998,background:"#050508dd",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",fontWeight:900}}>
      <div style={{background:"#0a0a14",border:"1px solid #FF6B6B33",borderRadius:28,padding:40,textAlign:"center",maxWidth:300,width:"90%"}}>
        <div style={{fontSize:40,marginBottom:12}}>💀</div>
        <div style={{color:"#555",fontSize:10,letterSpacing:5,marginBottom:10}}>ROUND LOSER</div>
        <div style={{color:loser.color,fontSize:28,fontWeight:900,marginBottom:6}}>{loser.name}</div>
        <div style={{color:"#444",fontSize:11,letterSpacing:2,marginBottom:28}}>LAST ONE OUT · 0 PTS</div>
        <button onClick={onClose} style={{width:"100%",padding:14,borderRadius:12,background:"#FF6B6B",border:"none",color:"#fff",fontFamily:"'Courier New',monospace",fontSize:14,fontWeight:900,letterSpacing:2,cursor:"pointer"}}>
          SEE RESULTS →
        </button>
      </div>
    </div>
  );
}

// ── GAME OVER POPUP ──
function GameOverPopup({ winner, cumulativeScores, players, onPlayAgain }) {
  const sorted = [...players].map((p, i) => ({ ...p, score: cumulativeScores[i] ?? 0 })).sort((a, b) => b.score - a.score);
  return (
    <div style={{position:"fixed",inset:0,zIndex:99999,background:"#050508ee",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",fontWeight:900}}>
      <div style={{background:"#0a0a14",border:`1px solid ${winner.color}44`,borderRadius:28,padding:36,textAlign:"center",maxWidth:360,width:"90%"}}>
        <div style={{color:"#FFD93D",fontSize:11,letterSpacing:5,marginBottom:8}}>GAME OVER</div>
        <div style={{color:winner.color,fontSize:36,fontWeight:900,marginBottom:4}}>{winner.name}</div>
        <div style={{color:"#555",fontSize:11,letterSpacing:3,marginBottom:28}}>WINS THE GAME 🏆</div>
        <div style={{background:"#050508",borderRadius:14,padding:16,marginBottom:24}}>
          {sorted.map((p, i) => (
            <div key={p.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:"#333",fontSize:11,width:16}}>{i+1}</span>
                <div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/>
                <span style={{color:p.color,fontSize:13,fontWeight:700}}>{p.name}</span>
              </div>
              <span style={{color:p.color,fontWeight:900,fontSize:15}}>{p.score} pts</span>
            </div>
          ))}
        </div>
        <button onClick={onPlayAgain} style={{width:"100%",padding:14,borderRadius:12,background:"#FF6B6B",border:"none",color:"#fff",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,letterSpacing:2,cursor:"pointer"}}>
          PLAY AGAIN →
        </button>
      </div>
    </div>
  );
}

// ── SETUP SCREEN ──
function SetupScreen({ onStart, cumulativeScores, players: existingPlayers, roundNum, targetScore, onTargetChange, turnDirection, onTurnDirectionChange }) {
  const [n, setN] = useState(existingPlayers?.length || 3);
  const [mins, setMins] = useState(5);
  const [names, setNames] = useState(
    existingPlayers?.length
      ? existingPlayers.map(p => p.name)
      : ["Player 1","Player 2","Player 3","Player 4","Player 5","Player 6"]
  );
  const hasHistory = existingPlayers?.length > 0 && roundNum > 1;

  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"#050508",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",fontFamily:"'Courier New',monospace",fontWeight:900,padding:"2rem",boxSizing:"border-box",overflowY:"auto"}}>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom:hasHistory ? 16 : 32}}>
          <div style={{fontSize:48,letterSpacing:4,color:"#fff",fontWeight:900}}>DHAPPA</div>
          <div style={{color:"#555",fontSize:12,letterSpacing:6,marginTop:4}}>MULTIPLAYER CLOCK</div>
        </div>

        {hasHistory && (
          <Leaderboard
            players={existingPlayers}
            cumulativeScores={cumulativeScores}
            roundNum={roundNum - 1}
            targetScore={targetScore}
          />
        )}

        <div style={{background:"#0a0a14",border:"1px solid #222",borderRadius:16,padding:28}}>
          {!hasHistory && (
            <div style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{color:"#555",fontSize:11,letterSpacing:3}}>TARGET SCORE</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input
                  type="number" min={1} value={targetScore}
                  onChange={e => onTargetChange(Number(e.target.value))}
                  style={{width:60,background:"#050508",border:"1px solid #333",borderRadius:6,padding:"6px 10px",color:"#FFD93D",fontFamily:"'Courier New',monospace",fontSize:16,fontWeight:900,outline:"none",textAlign:"center"}}
                />
                <span style={{color:"#333",fontSize:11}}>pts</span>
              </div>
            </div>
          )}

          <div style={{marginBottom:20}}>
            <div style={{color:"#555",fontSize:11,letterSpacing:3,marginBottom:10}}>PLAYERS</div>
            <div style={{display:"flex",gap:8}}>
              {[2,3,4,5,6].map(v=>(
                <button key={v} onClick={()=>setN(v)} style={{flex:1,padding:"10px 0",borderRadius:10,border:n===v?`2px solid ${COLORS[v-2]}`:"1px solid #222",background:n===v?`${COLORS[v-2]}22`:"#050508",color:n===v?COLORS[v-2]:"#444",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,cursor:"pointer",transition:"all .15s"}}>{v}</button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:20}}>
            <div style={{color:"#555",fontSize:11,letterSpacing:3,marginBottom:10}}>MINUTES PER PLAYER</div>
            <input type="number" min={1} max={60} value={mins} onChange={e=>setMins(Number(e.target.value))} style={{width:"100%",background:"#050508",border:"1px solid #222",borderRadius:8,padding:"10px 14px",color:"#fff",fontFamily:"'Courier New',monospace",fontSize:18,outline:"none",boxSizing:"border-box"}} />
          </div>

          <div style={{marginBottom:20}}>
            <div style={{color:"#555",fontSize:11,letterSpacing:3,marginBottom:10}}>TURN DIRECTION</div>
            <div style={{display:"flex",gap:8}}>
              {[
                ["clockwise", "CLOCKWISE"],
                ["counterclockwise", "COUNTERCLOCKWISE"],
              ].map(([value, label]) => (
                <button key={value} onClick={() => onTurnDirectionChange(value)}
                  style={{flex:1,padding:"10px 4px",borderRadius:10,border:turnDirection===value?"2px solid #4D96FF":"1px solid #222",background:turnDirection===value?"#4D96FF22":"#050508",color:turnDirection===value?"#4D96FF":"#444",fontFamily:"'Courier New',monospace",fontSize:11,fontWeight:900,cursor:"pointer",letterSpacing:0}}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:24}}>
            <div style={{color:"#555",fontSize:11,letterSpacing:3,marginBottom:10}}>NAMES</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,maxHeight:"240px",overflowY:"auto",paddingRight:4}}>
              {Array.from({length:n},(_,i)=>(
                <input key={i} value={names[i] ?? `Player ${i+1}`}
                  onChange={e=>setNames(arr=>arr.map((v,j)=>j===i?e.target.value:v))}
                  style={{width:"100%",background:"#050508",border:`1px solid ${COLORS[i]}55`,borderLeft:`4px solid ${COLORS[i]}`,borderRadius:6,padding:"10px 14px",color:COLORS[i],fontFamily:"'Courier New',monospace",fontSize:14,outline:"none",boxSizing:"border-box"}}
                />
              ))}
            </div>
          </div>

          <button onClick={()=>onStart({n, secs:mins*60, names:names.slice(0,n)})}
            style={{width:"100%",padding:14,borderRadius:12,background:"#FF6B6B",border:"none",color:"#fff",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,letterSpacing:2,cursor:"pointer"}}>
            {hasHistory ? `START ROUND ${roundNum} →` : "START →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ROUND SUMMARY SCREEN ──
function RoundSummary({ roundResult, roundNum, cumulativeScores, players, targetScore, onContinue, gameWinner }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"#050508",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",fontFamily:"'Courier New',monospace",fontWeight:900,padding:"2rem",boxSizing:"border-box",overflowY:"auto"}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{color:"#555",fontSize:11,letterSpacing:4,marginBottom:4}}>ROUND {roundNum} OVER</div>
        </div>

        <div style={{background:"#0a0a14",border:"1px solid #222",borderRadius:16,padding:24,marginBottom:16}}>
          <div style={{color:"#555",fontSize:11,letterSpacing:3,marginBottom:14}}>THIS ROUND</div>
          {roundResult.map((r, i) => (
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:r.color,flexShrink:0}} />
                <span style={{color:r.color,fontWeight:700,fontSize:13}}>{r.name}</span>
                {r.dhappa && <span style={{color:"#FF6B6B",fontSize:10,letterSpacing:1,background:"#FF6B6B22",padding:"2px 6px",borderRadius:4}}>DHAPPA +{DHAPPA_POINTS}</span>}
                {r.isLoser && <span style={{color:"#555",fontSize:10,letterSpacing:1,background:"#ffffff11",padding:"2px 6px",borderRadius:4}}>💀 LOST</span>}
              </div>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <span style={{color:"#555",fontSize:11}}>{r.position === 0 ? "1ST" : r.position === 1 ? "2ND" : r.position === 2 ? "3RD" : `${r.position+1}TH`}</span>
                <span style={{color:r.earned > 0 ? r.color : "#555",fontWeight:900,fontSize:16}}>+{r.earned} pts</span>
              </div>
            </div>
          ))}
        </div>

        <Leaderboard players={players} cumulativeScores={cumulativeScores} roundNum={roundNum} targetScore={targetScore} />

        <button onClick={onContinue} style={{width:"100%",padding:14,borderRadius:12,background:gameWinner?"#FFD93D":"#FF6B6B",border:"none",color:gameWinner?"#000":"#fff",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,letterSpacing:2,cursor:"pointer"}}>
          {gameWinner ? `🏆 ${gameWinner.name} WINS! →` : "NEXT ROUND →"}
        </button>
      </div>
    </div>
  );
}

// ── MAIN APP ──
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

  // Round state
  const [roundResult, setRoundResult] = useState(null);
  const finishOrderRef = useRef([]);
  const dhappaPlayerRef = useRef(null);
  const roundBonusesRef = useRef({});
  const winnerPointsRef = useRef({});
  // Track how many "I WON" calls happened (to award points in sequence)
  const iWonCountRef = useRef(0);

  // Persistent across rounds
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
  const [showGameOver, setShowGameOver] = useState(false);
  const [roundLoser, setRoundLoser] = useState(null);
  const [showRoundLoser, setShowRoundLoser] = useState(false);

  // Tick sound state
  const lastTickedSecRef = useRef(-1);

  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const turnIndicatorRotationRef = useRef(0);
  const turnIndicatorReadyRef = useRef(false);
  const [turnIndicatorRotation, setTurnIndicatorRotation] = useState(0);
  const [centerHovered, setCenterHovered] = useState(false);

  useEffect(() => {
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const startGame = useCallback(({n, secs, names}) => {
    const ps = names.map((name, i) => ({name, color: COLORS[i], dark: DARK[i], vdark: VDARK[i], alive: true, originalIdx: i}));
    setPlayers(ps);
    setTimes(Array(n).fill(secs));
    setActiveIdx(0);
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
    setRoundLoser(null);
    setShowRoundLoser(false);

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
        setShowGameOver(false);
      }
    }

    const startPlayerIdx = Math.floor(Math.random() * n);
    setRoundStartInfo({ roundNum: nextRoundNum, starterName: names[startPlayerIdx], starterColor: COLORS[startPlayerIdx], startPlayerIdx });
    setShowRoundStart(true);

    setConfig({n, secs, names, turnDirection});
    setScreen("game");
  }, [roundNum, allPlayers, turnDirection]);

  const handleRoundStartClose = useCallback(() => {
    setShowRoundStart(false);
    if (roundStartInfo) setActiveIdx(roundStartInfo.startPlayerIdx);
  }, [roundStartInfo]);

  const alivePlayers = players.filter(p => p.alive);
  const aliveCount = alivePlayers.length;

  // Tick sound: plays once per second when active player has ≤10s
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

  // Reset tick tracking on turn change
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
    if (!started || paused || winner || popup) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [started, paused, winner, popup, tick]);

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
    const clockwiseDelta = ((normalizedTarget - normalizedCurrent) + 360) % 360;
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

  // PASS follows the selected table direction.
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
    setShowGameOver(false);
    setRoundLoser(null);
    setShowRoundLoser(false);
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

    const n = totalPlayers;
    const result = [];
    // finalOrder: [first kicked, ..., last kicked / last alive]
    // Winners (I WON) are placed at the END of finalOrder with highest finish positions
    // The very first in finalOrder = loser (position n-1 = 0 pts)
    // Then points go in reverse: positions n-2, n-3, ... awarded as per WIN_POINTS_TABLE

    finalOrder.forEach((globalIdx, eliminationPos) => {
      // eliminationPos 0 = first eliminated = lowest rank = loser
      // eliminationPos n-1 = last = highest rank = first winner
      // last place (loser) always 0
      let basePoints = 0;
      if (eliminationPos === 0) {
        basePoints = 0; // loser
      } else if (winnerPointsRef.current[globalIdx] !== undefined) {
        basePoints = winnerPointsRef.current[globalIdx];
      } else {
        // map to winner points table: finishPos n-1=1st winner gets table[0], n-2 gets table[1], etc.
        // But we want first I WON = best = table[0]
        // finalOrder[n-1] = first I WON (highest), finalOrder[1] = last I WON before loser
        // So winnerRank from top: (n-1 - eliminationPos)
        const winnerRankFromTop = (n - 1) - eliminationPos; // 0 for first winner
        const table = WIN_POINTS_TABLE[n] ?? [5];
        basePoints = table[winnerRankFromTop] ?? 0;
      }

      const dhappaBonus = roundBonusesRef.current[globalIdx] ?? 0;
      const isDhappa = dhappaBonus > 0;
      const earned = basePoints + dhappaBonus;
      result.push({
        globalIdx,
        name: allPlayersSnap[globalIdx].name,
        color: allPlayersSnap[globalIdx].color,
        position: eliminationPos,
        earned,
        dhappa: isDhappa,
        isLoser: globalIdx === loserIdx,
      });
    });

    // Sort highest position first for display
    result.sort((a, b) => b.position - a.position);

    setCumulativeScores(prev => {
      const next = { ...prev };
      result.forEach(r => {
        next[r.globalIdx] = (next[r.globalIdx] ?? 0) + r.earned;
      });
      const winnerEntry = Object.entries(next).find(([, score]) => score >= targetScore);
      if (winnerEntry) {
        const winnerIdx = parseInt(winnerEntry[0]);
        setGameWinner(allPlayersSnap[winnerIdx]);
      }
      return next;
    });

    setRoundResult(result);
    setRoundNum(prev => prev + 1);

    // Show loser popup first, then summary
    if (loserIdx !== null && loserIdx !== undefined && allPlayersSnap[loserIdx]) {
      setRoundLoser(allPlayersSnap[loserIdx]);
      setShowRoundLoser(true);
    } else {
      setScreen("roundSummary");
    }
  }, [targetScore]);

  const kickPlayer = useCallback((globalIdx, reason = "kicked") => {
    setPlayers(prev => {
      const next = prev.map((p, i) => i === globalIdx ? {...p, alive: false} : p);
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
            // If a kick/timeout leaves one player standing, the player who just left is the loser.
            loserIdx = globalIdx;
            fullOrder = [globalIdx, ...previousOrder, lastIdx];
          } else {
            // If a player declares I WON, the remaining player is the loser.
            loserIdx = lastIdx;
            addRoundEvent(lastIdx, "last", 0);
            fullOrder = [lastIdx, ...newOrder];
          }
        } else {
          // kicked player was also the last one = loser
          loserIdx = newOrder[0];
          fullOrder = newOrder;
        }

        finishOrderRef.current = fullOrder;
        setTimeout(() => endRound(fullOrder, dhappaPlayerRef.current, next, config?.n ?? prev.length, loserIdx), 0);
      } else {
        const aliveIdxs = next.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
        const oldAliveIdxs = prev.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
        const kickedPos = oldAliveIdxs.indexOf(globalIdx);
        const nextActivePos = turnDirection === "clockwise"
          ? kickedPos % aliveIdxs.length
          : ((kickedPos - 1) + aliveIdxs.length) % aliveIdxs.length;
        const avoidIdx = reason === "kicked" ? (kickActor ?? curGlobalIdx) : null;
        const shouldSkipCurrent = avoidIdx !== null && aliveIdxs.length > 1 && aliveIdxs[nextActivePos] === avoidIdx;
        const step = turnDirection === "clockwise" ? 1 : -1;
        setActiveIdx(shouldSkipCurrent ? ((nextActivePos + step + aliveIdxs.length) % aliveIdxs.length) : nextActivePos);
      }
      return next;
    });
    setPopup(null);
    setKickActor(null);
    setKickTarget(null);
    setHighlightKick(false);
    setPaused(false);
  }, [endRound, config, turnDirection, kickActor, curGlobalIdx]);

  const handleDhappa = () => {
    setPaused(true);
    setPopup("dhappa");
  };

  // Points for "I WON" = next winner slot. Dhappa bonus is only for kicking someone out.
  const nextIWonPoints = config ? getNextWinnerPoints(iWonCountRef.current, config.n) : 0;

  const handleIWon = () => {
    const dhappaCallerIdx = curGlobalIdx;
    const pts = getNextWinnerPoints(iWonCountRef.current, config?.n ?? 2);
    winnerPointsRef.current = { ...winnerPointsRef.current, [dhappaCallerIdx]: pts };
    iWonCountRef.current += 1;
    addRoundEvent(dhappaCallerIdx, "iwon", pts);

    setPlayers(prev => {
      const next = prev.map((p, i) => i === dhappaCallerIdx ? {...p, alive: false} : p);
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
        const nextActivePos = turnDirection === "clockwise"
          ? kickedPos % aliveIdxs.length
          : ((kickedPos - 1) + aliveIdxs.length) % aliveIdxs.length;
        setActiveIdx(nextActivePos);
      }
      return next;
    });

    setPopup(null);
    setKickActor(null);
    setKickTarget(null);
    setHighlightKick(false);
    setPaused(false);
  };

  const handleKickSomeone = () => {
    setKickActor(curGlobalIdx);
    setKickTarget(null);
    setPopup("kick");
    setHighlightKick(true);
  };

  const handleSelectKick = (globalIdx) => {
    if (globalIdx === kickActor) return;
    setKickTarget(globalIdx);
  };

  const handleConfirmKick = () => {
    if (kickActor === null || kickTarget === null || kickActor === kickTarget) return;
    if (dhappaPlayerRef.current === null) dhappaPlayerRef.current = kickActor;
    addRoundBonus(kickActor, DHAPPA_POINTS);
    addRoundEvent(kickActor, "kick", DHAPPA_POINTS, kickTarget);
    kickPlayer(kickTarget, "kicked");
  };

  const handleCancelDhappa = () => {
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
        turnDirection={turnDirection}
        onTurnDirectionChange={setTurnDirection}
      />
    );
  }

  if (screen === "roundSummary") {
    return (
      <>
        <RoundSummary
          roundResult={roundResult}
          roundNum={roundNum - 1}
          cumulativeScores={cumulativeScores}
          players={allPlayers}
          targetScore={targetScore}
          gameWinner={gameWinner}
          onContinue={() => {
            if (gameWinner) setShowGameOver(true);
            else { setConfig(null); setScreen("setup"); }
          }}
        />
        {showGameOver && (
          <GameOverPopup
            winner={gameWinner}
            cumulativeScores={cumulativeScores}
            players={allPlayers}
            onPlayAgain={() => {
              setShowGameOver(false);
              setGameWinner(null);
              setRoundNum(1);
              setCumulativeScores({});
              setAllPlayers([]);
              setScreen("setup");
            }}
          />
        )}
      </>
    );
  }

  // ── GAME SCREEN ──
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
    <div className="app-container" style={{position:"fixed",inset:0,zIndex:9999,background:"#050508",fontFamily:"'Courier New',monospace",fontWeight:900,userSelect:"none",overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Quantico:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        .clock-view-wrapper { position: relative !important; width: 100% !important; height: ${clockHeight}px !important; }
        .action-dashboard { position: relative !important; height: auto !important; max-height: none !important; }
        .app-container, .app-container * { font-weight: 900 !important; }
        .app-container text { font-weight: 900 !important; }
      `}</style>

      {showRoundStart && roundStartInfo && (
        <RoundStartPopup
          roundNum={roundStartInfo.roundNum}
          starterName={roundStartInfo.starterName}
          starterColor={roundStartInfo.starterColor}
          onClose={handleRoundStartClose}
        />
      )}

      {showRoundLoser && roundLoser && (
        <RoundLoserPopup
          loser={roundLoser}
          onClose={() => { setShowRoundLoser(false); setScreen("roundSummary"); }}
        />
      )}

      {/* Main Clock Area */}
      <div className="clock-view-wrapper" style={{position:"relative",width:"100%",height:clockHeight,overflow:"hidden",background:"#050508"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,zIndex:20,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",boxSizing:"border-box"}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={() => { setPaused(true); setPopup(null); setConfig(null); setScreen("setup"); }} style={{background:"#05050899",border:"2px solid #333",borderRadius:8,color:"#777",padding:"9px 16px",fontFamily:"'Courier New',monospace",fontSize:14,fontWeight:900,cursor:"pointer",letterSpacing:1,backdropFilter:"blur(4px)"}}>← SETUP</button>
            <button onClick={resetGame} style={{background:"#05050899",border:"2px solid #333",borderRadius:8,color:"#FF6B6B",padding:"9px 16px",fontFamily:"'Courier New',monospace",fontSize:14,fontWeight:900,cursor:"pointer",letterSpacing:1,backdropFilter:"blur(4px)"}}>RESET</button>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{color:"#444",fontSize:13,fontWeight:900,letterSpacing:2}}>R{roundNum - 1}</div>
            <div style={{color: paused ? "#FFD93D" : "#FF6B6B", fontSize:14, fontWeight:900, letterSpacing:2}}>
              {!started ? "TAP TO START" : paused ? "PAUSED" : "● LIVE"}
            </div>
          </div>
        </div>

        <svg width="100%" height={clockHeight}
          viewBox={`0 0 ${dimensions.width} ${clockHeight}`}
          ref={svgRef} style={{display:"block"}}>
          <rect x={0} y={0} width={dimensions.width} height={clockHeight} fill="#050508" />

          {alivePlayers.map((player) => {
            // Use originalIdx to fix each player at their starting sector angle
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
            const dispColor = isLow ? "#3a0000" : player.vdark;

            // Name arc path (fixed)
            const halfArc = Math.PI * 0.18;
            const arcMid = midAngle;
            const arcA1 = arcMid - halfArc;
            const arcA2 = arcMid + halfArc;
            const nr = centerR + baseScale * 0.008;
            const sx = cx + nr * Math.cos(arcA1);
            const sy = cy + nr * Math.sin(arcA1);
            const ex = cx + nr * Math.cos(arcA2);
            const ey = cy + nr * Math.sin(arcA2);
            const namePathId = `namepath-${origIdx}`;

            return (
              <g key={globalIdx} onClick={() => {
                if (popup === "kick") { handleSelectKick(globalIdx); return; }
                if (globalIdx === curGlobalIdx && !popup) passToNext(globalIdx);
              }} style={{cursor: popup === "kick" ? "pointer" : globalIdx === curGlobalIdx ? "pointer" : "default"}}>
                <path d={path}
                  fill={`${fillColor}${isKickHighlight ? "dd" : fillAlpha}`}
                  stroke={isActive ? fillColor : "#0f0f20"}
                  strokeWidth={isActive ? 2 : 1}
                  style={{transition:"fill .3s,stroke .3s"}}
                />
                <defs>
                  <path id={namePathId} d={`M ${sx} ${sy} A ${nr} ${nr} 0 0 1 ${ex} ${ey}`} fill="none" />
                </defs>
                <text fontFamily="'Quantico', sans-serif" fontSize={baseScale * 0.024} fontWeight={700} fill="#000000" style={{letterSpacing:"1px"}}>
                  <textPath href={`#${namePathId}`} startOffset="50%" textAnchor="middle">
                    {player.name.toUpperCase()}
                  </textPath>
                </text>
                <g transform={`translate(${tx},${ty}) rotate(${deg})`}>
                  <text textAnchor="middle" dominantBaseline="middle" fontSize={timerFontSize} fontWeight={900} fill={dispColor} stroke={dispColor} strokeWidth={baseScale * 0.0025} paintOrder="stroke fill" fontFamily="'Quantico', cursive" style={{letterSpacing:1}}>
                    {formatTime(t)}
                  </text>
                  {isKickHighlight && (
                    <text textAnchor="middle" dominantBaseline="middle" fontSize={baseScale * 0.022} fill="#FF6B6B" fontFamily="'Courier New',monospace" dy={baseScale * 0.06}>TAP TO KICK</text>
                  )}
                </g>
              </g>
            );
          })}

          {/* Dividers between alive player sectors only */}
          {alivePlayers.map((player) => {
            const origIdx = player.originalIdx;
            const sector = sectorByOrig.get(origIdx);
            if (!sector) return null;
            const angle = sector.angle1;
            const pv = [cx + centerR * Math.cos(angle), cy + centerR * Math.sin(angle)];
            const edgeVert = [cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle)];
            return <line key={`div-${origIdx}`} x1={pv[0]} y1={pv[1]} x2={edgeVert[0]} y2={edgeVert[1]} stroke="#050508" strokeWidth={3} />;
          })}

          {/* Center circle */}
          <circle cx={cx} cy={cy} r={centerR}
            fill={centerHovered ? "#1e1e35" : "#0f0f20"}
            stroke={centerHovered ? "#FF6B6B55" : "none"} strokeWidth={2}
            onClick={handleDhappa}
            onMouseEnter={() => setCenterHovered(true)}
            onMouseLeave={() => setCenterHovered(false)}
            style={{cursor:"pointer", transition:"fill .15s, stroke .15s"}}
          />

          {/* Active player arc indicator */}
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
                style={{transformOrigin:`${cx}px ${cy}px`,transform:`rotate(${turnIndicatorRotation}deg)`,transition:"transform .35s linear"}}
              />
            );
          })()}

          {/* DHAPPA label */}
          <text x={cx} y={cy - dhappaFontSize * 0.08} textAnchor="middle" dominantBaseline="middle"
            fontSize={dhappaFontSize} fontWeight={900}
            textLength={dhappaTextLength}
            lengthAdjust="spacingAndGlyphs"
            fill={centerHovered ? "#ff9999" : "#FF6B6B"}
            stroke={centerHovered ? "#ff9999" : "#FF6B6B"}
            strokeWidth={baseScale * 0.004}
            paintOrder="stroke fill"
            fontFamily="'Courier New',monospace"
            onClick={handleDhappa}
            onMouseEnter={() => setCenterHovered(true)} onMouseLeave={() => setCenterHovered(false)}
            style={{cursor:"pointer",letterSpacing:0,transition:"fill .15s"}}>
            DHAPPA
          </text>
          <text x={cx} y={cy + dhappaFontSize * 0.68} textAnchor="middle" dominantBaseline="middle"
            fontSize={dhappaFontSize * 0.22} fontWeight={900}
            fill={centerHovered ? "#ff9999" : "#FF6B6B"}
            fontFamily="'Courier New',monospace"
            onClick={handleDhappa}
            onMouseEnter={() => setCenterHovered(true)} onMouseLeave={() => setCenterHovered(false)}
            style={{cursor:"pointer",letterSpacing:1,transition:"fill .15s",opacity:0.9}}>
            BONUS +{DHAPPA_POINTS} PTS
          </text>
        </svg>

        {/* DHAPPA choice popup */}
        {popup === "dhappa" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#050508cc",zIndex:100}}>
            <div style={{background:"#0a0a14",border:"2px solid #FF6B6B44",borderRadius:24,padding:40,textAlign:"center",width:360,maxWidth:"90%"}}>
              <div style={{color:"#FF6B6B",fontSize:34,fontWeight:900,letterSpacing:3,marginBottom:6}}>DHAPPA!</div>
              <div style={{color:"#666",fontSize:14,fontWeight:900,letterSpacing:2,marginBottom:24}}>CHOOSE YOUR MOVE</div>

              {/* I WON — shows next winner points (no dhappa bonus) */}
              <button onClick={handleIWon} style={{width:"100%",padding:"20px 0",borderRadius:12,background:"#6BCB7722",border:"2px solid #6BCB77",color:"#6BCB77",fontFamily:"'Courier New',monospace",fontSize:18,fontWeight:900,cursor:"pointer",marginBottom:8,letterSpacing:1}}>
                I WON 🏆
              </button>
              <div style={{color:"#6BCB7799",fontSize:14,fontWeight:900,marginBottom:22,letterSpacing:1}}>
                Awards you: <strong style={{color:"#6BCB77"}}>+{nextIWonPoints} pts</strong>
              </div>

              {/* KICK SOMEONE — awards 3 pts to dhappa caller */}
              <button onClick={handleKickSomeone} style={{width:"100%",padding:"20px 0",borderRadius:12,background:"#FF6B6B22",border:"2px solid #FF6B6B",color:"#FF6B6B",fontFamily:"'Courier New',monospace",fontSize:18,fontWeight:900,cursor:"pointer",marginBottom:8,letterSpacing:1}}>
                KICK SOMEONE 💀
              </button>
              <div style={{color:"#FF6B6B99",fontSize:14,fontWeight:900,marginBottom:22,letterSpacing:1}}>
                Awards you: <strong style={{color:"#FF6B6B"}}>+{DHAPPA_POINTS} pts</strong> · kicked player gets 0
              </div>

              <button onClick={handleCancelDhappa} style={{width:"100%",padding:"14px 0",borderRadius:10,background:"none",border:"2px solid #333",color:"#666",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,cursor:"pointer",letterSpacing:2}}>CANCEL</button>
            </div>
          </div>
        )}

        {popup === "kick" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#050508cc",zIndex:100}}>
            <div style={{background:"#0a0a14",border:"2px solid #FF6B6B44",borderRadius:24,padding:32,textAlign:"center",width:"90%",maxWidth:460}}>
              <div style={{color:"#FF6B6B",fontSize:24,fontWeight:900,letterSpacing:3,marginBottom:8}}>KICK SOMEONE OUT</div>
              <div style={{color:"#666",fontSize:14,fontWeight:900,marginBottom:22,letterSpacing:1}}>Kicker gets +{DHAPPA_POINTS} pts and stays in the game</div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18,textAlign:"left"}}>
                <div>
                  <div style={{color:"#666",fontSize:13,fontWeight:900,letterSpacing:2,marginBottom:10}}>KICKER</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {alivePlayers.map((p) => {
                      const idx = players.indexOf(p);
                      const selected = idx === kickActor;
                      return (
                        <button key={`actor-${idx}`} onClick={() => { setKickActor(idx); if (kickTarget === idx) setKickTarget(null); }}
                          style={{padding:"14px 10px",borderRadius:10,background:selected?`${p.color}22`:"#050508",border:selected?`3px solid ${p.color}`:"2px solid #222",color:selected?p.color:"#888",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,cursor:"pointer"}}>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div style={{color:"#666",fontSize:13,fontWeight:900,letterSpacing:2,marginBottom:10}}>KICKED OUT</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {alivePlayers.map((p) => {
                      const idx = players.indexOf(p);
                      const disabled = idx === kickActor;
                      const selected = idx === kickTarget;
                      return (
                        <button key={`target-${idx}`} onClick={() => !disabled && handleSelectKick(idx)}
                          disabled={disabled}
                          style={{padding:"14px 10px",borderRadius:10,background:selected?`${p.color}22`:"#050508",border:selected?`3px solid ${p.color}`:"2px solid #222",color:disabled?"#333":selected?p.color:"#888",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.55:1}}>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button onClick={handleConfirmKick} disabled={kickActor === null || kickTarget === null || kickActor === kickTarget}
                style={{width:"100%",padding:"18px 0",borderRadius:12,background:kickActor !== null && kickTarget !== null && kickActor !== kickTarget ? "#FF6B6B" : "#221111",border:"none",color:kickActor !== null && kickTarget !== null && kickActor !== kickTarget ? "#fff" : "#553333",fontFamily:"'Courier New',monospace",fontSize:17,fontWeight:900,cursor:kickActor !== null && kickTarget !== null && kickActor !== kickTarget ? "pointer" : "not-allowed",marginBottom:14,letterSpacing:2}}>
                CONFIRM KICK
              </button>
              <button onClick={handleCancelDhappa} style={{width:"100%",padding:"14px 0",borderRadius:10,background:"none",border:"2px solid #333",color:"#666",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,cursor:"pointer",letterSpacing:2}}>CANCEL</button>
            </div>
          </div>
        )}

      </div>

      {/* Action Dashboard */}
      <div className="action-dashboard" style={{position:"relative",background:"#050508",borderTop:"1px solid #111",overflow:"visible",paddingBottom:24}}>
        {/* Buttons first */}
        <div style={{display:"flex",gap:12,padding:"14px 20px 12px",boxSizing:"border-box"}}>
          <button onClick={() => {
            if (!started) { setStarted(true); setPaused(false); return; }
            passToNext(curGlobalIdx);
          }} disabled={!!winner}
            style={{flex:2,padding:"18px 0",borderRadius:14,background:started?`${players[curGlobalIdx]?.color ?? '#FF6B6B'}22`:"#FF6B6B22",border:`3px solid ${players[curGlobalIdx]?.color ?? '#FF6B6B'}`,color:players[curGlobalIdx]?.color ?? '#FF6B6B',fontFamily:"'Courier New',monospace",fontSize:19,fontWeight:900,cursor:"pointer",letterSpacing:2}}>
            {started ? "PASS →" : "START / PASS →"}
          </button>
          <button onClick={() => { if(started) setPaused(p=>!p); }}
            disabled={!started || !!winner}
            style={{flex:1,padding:"18px 0",borderRadius:14,background:paused?"#FFD93D22":"#0a0a14",border:`3px solid ${paused?"#FFD93D":"#222"}`,color:paused?"#FFD93D":"#555",fontFamily:"'Courier New',monospace",fontSize:17,fontWeight:900,cursor:"pointer",letterSpacing:1}}>
            {paused?"▶ GO":"⏸ PAUSE"}
          </button>
        </div>

        {/* Round progress feed */}
        {roundEvents.length > 0 && (
          <div style={{padding:"0 16px"}}>
            <RoundProgress events={roundEvents} players={players} />
          </div>
        )}

        {/* Leaderboard below */}
        {allPlayers.length > 0 && (
          <div style={{padding:"0 16px 16px"}}>
            <Leaderboard
              players={allPlayers}
              cumulativeScores={cumulativeScores}
              roundNum={roundNum - 1}
              targetScore={targetScore}
            />
          </div>
        )}
      </div>
    </div>
  );
}
