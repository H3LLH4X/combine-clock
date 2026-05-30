import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF9F1C"];
const DARK =   ["#cc2222","#cc9900","#1e8c3a","#1155cc","#7722cc","#cc5500"];
const VDARK =  ["#3a0000","#3a2800","#003a10","#00103a","#1a003a","#3a1500"];

const DHAPPA_POINTS = 3;
const DHAPPA_TIMEOUT = 30; // seconds

// Points table: index = winner rank (0=1st, 1=2nd, …), last always 0
const WIN_POINTS_TABLE = {
  6: [5, 3, 2, 1, 0],
  5: [5, 3, 2, 1],
  4: [5, 3, 2],
  3: [5, 3],
  2: [5],
};

function getNextWinnerPoints(winnerCount, totalPlayers) {
  const table = WIN_POINTS_TABLE[totalPlayers] ?? [5];
  return table[winnerCount] ?? 0;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

// IMPACT font stack
const FONT = "'Impact', 'Arial Narrow', Arial, sans-serif";

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
      midAngle: center.angle,
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
  } catch(e) {}
}

// ── LEADERBOARD ──
function Leaderboard({ players, cumulativeScores, roundNum, targetScore }) {
  const sorted = [...players]
    .map((p, i) => ({ ...p, score: cumulativeScores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <div style={{background:"#0a0a14",border:"1px solid #1a1a2e",borderRadius:16,padding:22,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{color:"#666",fontSize:13,fontFamily:FONT,letterSpacing:3}}>LEADERBOARD{roundNum > 0 ? ` · ROUND ${roundNum}` : ""}</div>
        <div style={{color:"#555",fontSize:13,fontFamily:FONT,letterSpacing:2}}>TARGET: <span style={{color:"#FFD93D"}}>{targetScore}</span></div>
      </div>
      {sorted.map((p, i) => {
        const pct = Math.min(p.score / targetScore, 1);
        const isLeading = i === 0 && p.score > 0;
        return (
          <div key={p.name} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:"#444",fontSize:13,fontFamily:FONT,width:16}}>{i+1}</span>
                <div style={{width:8,height:8,borderRadius:"50%",background:p.color,flexShrink:0}}/>
                <span style={{color:p.color,fontSize:16,fontFamily:FONT}}>{p.name}</span>
                {isLeading && <span style={{color:"#FFD93D",fontSize:11,fontFamily:FONT,letterSpacing:2,background:"rgba(255,217,61,0.08)",padding:"3px 7px",borderRadius:4}}>LEAD</span>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{color:p.color,fontFamily:FONT,fontSize:17}}>{p.score}</span>
                <span style={{color:"#444",fontSize:13,fontFamily:FONT}}>/{targetScore}</span>
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

// ── ROUND START POPUP ──
function RoundStartPopup({ roundNum, starterName, starterColor, onClose }) {
  // Use rgba to avoid 8-character hex compatibility issues
  const [r, g, b] = starterColor.match(/\w\w/g).map(x => parseInt(x, 16));

  return (
    <div style={{position:"fixed",inset:0,zIndex:99999,background:"rgba(5,5,8,0.93)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#0a0a14",border:`2px solid rgba(${r},${g},${b},0.4)`,borderRadius:28,padding:44,textAlign:"center",maxWidth:340,width:"90%"}}>
        <div style={{color:"#555",fontSize:12,fontFamily:FONT,letterSpacing:5,marginBottom:10}}>GET READY</div>
        <div style={{fontSize:52,fontFamily:FONT,letterSpacing:2,color:"#fff",marginBottom:4}}>ROUND {roundNum}</div>
        <div style={{color:"#555",fontSize:13,fontFamily:FONT,letterSpacing:3,marginBottom:24}}>STARTS WITH</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:32}}>
          <div style={{width:14,height:14,borderRadius:"50%",background:starterColor}}/>
          <span style={{color:starterColor,fontSize:26,fontFamily:FONT}}>{starterName}</span>
        </div>
        <button onClick={onClose} style={{width:"100%",padding:16,borderRadius:12,background:starterColor,border:"none",color:"#000",fontFamily:FONT,fontSize:18,letterSpacing:2,cursor:"pointer"}}>
          LET'S GO →
        </button>
      </div>
    </div>
  );
}

// ── GAME OVER POPUP ──
function GameOverPopup({ winner, cumulativeScores, players, onPlayAgain }) {
  const sorted = [...players].map((p, i) => ({ ...p, score: cumulativeScores[i] ?? 0 })).sort((a, b) => b.score - a.score);
  const [r, g, b] = winner.color.match(/\w\w/g).map(x => parseInt(x, 16));

  return (
    <div style={{position:"fixed",inset:0,zIndex:99999,background:"rgba(5,5,8,0.93)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT}}>
      <div style={{background:"#0a0a14",border:`2px solid rgba(${r},${g},${b},0.3)`,borderRadius:28,padding:36,textAlign:"center",maxWidth:360,width:"90%"}}>
        <div style={{color:"#FFD93D",fontSize:13,letterSpacing:5,marginBottom:8}}>GAME OVER</div>
        <div style={{color:winner.color,fontSize:36,marginBottom:4}}>{winner.name}</div>
        <div style={{color:"#555",fontSize:13,letterSpacing:3,marginBottom:28}}>WINS THE GAME 🏆</div>
        <div style={{background:"#050508",borderRadius:14,padding:16,marginBottom:24}}>
          {sorted.map((p, i) => (
            <div key={p.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:"#333",fontSize:11,width:16}}>{i+1}</span>
                <div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/>
                <span style={{color:p.color,fontSize:15}}>{p.name}</span>
              </div>
              <span style={{color:p.color,fontSize:15}}>{p.score} pts</span>
            </div>
          ))}
        </div>
        <button onClick={onPlayAgain} style={{width:"100%",padding:14,borderRadius:12,background:"#FF6B6B",border:"none",color:"#fff",fontFamily:FONT,fontSize:17,letterSpacing:2,cursor:"pointer"}}>
          PLAY AGAIN →
        </button>
      </div>
    </div>
  );
}

// ── ROUND SUMMARY ──
function RoundSummary({ roundResult, roundNum, cumulativeScores, players, targetScore, onContinue, gameWinner }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"#050508",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",fontFamily:FONT,padding:"2rem",boxSizing:"border-box",overflowY:"auto"}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{color:"#555",fontSize:13,letterSpacing:4,marginBottom:4}}>ROUND {roundNum} OVER</div>
        </div>

        <Leaderboard players={players} cumulativeScores={cumulativeScores} roundNum={roundNum} targetScore={targetScore} />

        <button onClick={onContinue} style={{width:"100%",padding:16,borderRadius:12,background:gameWinner?"#FFD93D":"#FF6B6B",border:"none",color:gameWinner?"#000":"#fff",fontFamily:FONT,fontSize:17,letterSpacing:2,cursor:"pointer"}}>
          {gameWinner ? `🏆 ${gameWinner.name} WINS! →` : "NEXT ROUND →"}
        </button>
      </div>
    </div>
  );
}

// ── SETUP SCREEN ──
function SetupScreen({ onStart, cumulativeScores, players: existingPlayers, roundNum, targetScore, onTargetChange, turnDirection, onTurnDirectionChange, lastConfig }) {
  const hasHistory = existingPlayers?.length > 0 && roundNum > 1;

  // If returning from a game, pre-fill from lastConfig
  const [n, setN] = useState(lastConfig?.n ?? existingPlayers?.length ?? 3);
  const [mins, setMins] = useState(lastConfig ? Math.round(lastConfig.secs / 60) : 5);
  const [names, setNames] = useState(
    lastConfig?.names ?? existingPlayers?.map(p => p.name) ?? ["Player 1","Player 2","Player 3","Player 4","Player 5","Player 6"]
  );

  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"#050508",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",fontFamily:FONT,padding:"2rem",boxSizing:"border-box",overflowY:"auto"}}>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom: hasHistory ? 16 : 32}}>
          <div style={{fontSize:52,letterSpacing:4,color:"#fff"}}>DHAPPA</div>
          <div style={{color:"#555",fontSize:13,letterSpacing:6,marginTop:4}}>MULTIPLAYER CLOCK</div>
        </div>

        {hasHistory && (
          <Leaderboard players={existingPlayers} cumulativeScores={cumulativeScores} roundNum={roundNum - 1} targetScore={targetScore} />
        )}

        <div style={{background:"#0a0a14",border:"1px solid #222",borderRadius:16,padding:28}}>
          {!hasHistory && (
            <div style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{color:"#555",fontSize:13,letterSpacing:3}}>TARGET SCORE</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="number" min={1} value={targetScore} onChange={e => onTargetChange(Number(e.target.value))}
                  style={{width:60,background:"#050508",border:"1px solid #333",borderRadius:6,padding:"6px 10px",color:"#FFD93D",fontFamily:FONT,fontSize:18,outline:"none",textAlign:"center"}} />
                <span style={{color:"#333",fontSize:12}}>pts</span>
              </div>
            </div>
          )}

          <div style={{marginBottom:20}}>
            <div style={{color:"#555",fontSize:13,letterSpacing:3,marginBottom:10}}>PLAYERS</div>
            <div style={{display:"flex",gap:8}}>
              {[2,3,4,5,6].map(v=>(
                <button key={v} onClick={()=>setN(v)} style={{flex:1,padding:"10px 0",borderRadius:10,border:n===v?`2px solid ${COLORS[v-2]}`:"1px solid #222",background:n===v?`rgba(${parseInt(COLORS[v-2].slice(1,3),16)},${parseInt(COLORS[v-2].slice(3,5),16)},${parseInt(COLORS[v-2].slice(5,7),16)},0.13)`:"#050508",color:n===v?COLORS[v-2]:"#444",fontFamily:FONT,fontSize:17,cursor:"pointer",transition:"all .15s"}}>{v}</button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:20}}>
            <div style={{color:"#555",fontSize:13,letterSpacing:3,marginBottom:10}}>MINUTES PER PLAYER</div>
            <input type="number" min={1} max={60} value={mins} onChange={e=>setMins(Number(e.target.value))}
              style={{width:"100%",background:"#050508",border:"1px solid #222",borderRadius:8,padding:"10px 14px",color:"#fff",fontFamily:FONT,fontSize:20,outline:"none",boxSizing:"border-box"}} />
          </div>

          <div style={{marginBottom:20}}>
            <div style={{color:"#555",fontSize:13,letterSpacing:3,marginBottom:10}}>TURN DIRECTION</div>
            <div style={{display:"flex",gap:8}}>
              {[["clockwise","CLOCKWISE"],["counterclockwise","COUNTER"]].map(([val, lbl]) => (
                <button key={val} onClick={() => onTurnDirectionChange(val)}
                  style={{flex:1,padding:"10px 4px",borderRadius:10,border:turnDirection===val?"2px solid #4D96FF":"1px solid #222",background:turnDirection===val?"rgba(77,150,255,0.13)":"#050508",color:turnDirection===val?"#4D96FF":"#444",fontFamily:FONT,fontSize:13,cursor:"pointer",letterSpacing:1}}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:24}}>
            <div style={{color:"#555",fontSize:13,letterSpacing:3,marginBottom:10}}>NAMES</div>
            <div style={{display:"flex",flexDirection:"column",gap:10,maxHeight:"240px",overflowY:"auto",paddingRight:4}}>
              {Array.from({length:n},(_,i)=>(
                <input key={i} value={names[i] ?? `Player ${i+1}`}
                  onChange={e=>setNames(arr=>arr.map((v,j)=>j===i?e.target.value:v))}
                  style={{width:"100%",background:"#050508",border:`1px solid rgba(${parseInt(COLORS[i].slice(1,3),16)},${parseInt(COLORS[i].slice(3,5),16)},${parseInt(COLORS[i].slice(5,7),16)},0.33)`,borderLeft:`4px solid ${COLORS[i]}`,borderRadius:6,padding:"10px 14px",color:COLORS[i],fontFamily:FONT,fontSize:16,outline:"none",boxSizing:"border-box"}} />
              ))}
            </div>
          </div>

          <button onClick={()=>onStart({n, secs:mins*60, names:names.slice(0,n)})}
            style={{width:"100%",padding:16,borderRadius:12,background:"#FF6B6B",border:"none",color:"#fff",fontFamily:FONT,fontSize:17,letterSpacing:2,cursor:"pointer"}}>
            {hasHistory ? `START ROUND ${roundNum} →` : "START →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──
export default function App() {
  const [screen, setScreen] = useState("setup");
  const [config, setConfig] = useState(null);
  const [lastConfig, setLastConfig] = useState(null); 
  const [players, setPlayers] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [times, setTimes] = useState([]);
  const [paused, setPaused] = useState(true);
  const [started, setStarted] = useState(false);
  const [popup, setPopup] = useState(null);
  const [kickTarget, setKickTarget] = useState(null);
  const [winner, setWinner] = useState(null);
  const [highlightKick, setHighlightKick] = useState(false);
  const intervalRef = useRef(null);
  const svgRef = useRef(null);

  // Dhappa countdown
  const [dhappaCountdown, setDhappaCountdown] = useState(DHAPPA_TIMEOUT);
  const dhappaIntervalRef = useRef(null);
  const dhappaCallerIdxRef = useRef(null);

  // Round state
  const [roundResult, setRoundResult] = useState(null);
  const finishOrderRef = useRef([]);
  const dhappaPlayerRef = useRef(null);
  const roundBonusesRef = useRef({});
  const winnerPointsRef = useRef({});
  const iWonCountRef = useRef(0);

  // Persistent
  const [roundNum, setRoundNum] = useState(1);
  const [targetScore, setTargetScore] = useState(11);
  const [turnDirection, setTurnDirection] = useState("counterclockwise");
  const [cumulativeScores, setCumulativeScores] = useState({});
  const [allPlayers, setAllPlayers] = useState([]);
  const [gameWinner, setGameWinner] = useState(null);
  const [showRoundStart, setShowRoundStart] = useState(false);
  const [roundStartInfo, setRoundStartInfo] = useState(null);
  const [showGameOver, setShowGameOver] = useState(false);

  // Tick sound
  const lastTickedSecRef = useRef(-1);

  const [dimensions, setDimensions] = useState({ width: window.innerWidth || 300, height: window.innerHeight || 600 });
  const turnIndicatorRotationRef = useRef(0);
  const turnIndicatorReadyRef = useRef(false);
  const [turnIndicatorRotation, setTurnIndicatorRotation] = useState(0);
  const [centerHovered, setCenterHovered] = useState(false);

  useEffect(() => {
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── Dhappa timer ──
  const stopDhappaTimer = useCallback(() => {
    clearInterval(dhappaIntervalRef.current);
    dhappaIntervalRef.current = null;
  }, []);

  const startDhappaTimer = useCallback((callerIdx) => {
    dhappaCallerIdxRef.current = callerIdx;
    setDhappaCountdown(DHAPPA_TIMEOUT);
    clearInterval(dhappaIntervalRef.current);
    dhappaIntervalRef.current = setInterval(() => {
      setDhappaCountdown(prev => {
        if (prev <= 1) {
          clearInterval(dhappaIntervalRef.current);
          setPopup(null);
          setHighlightKick(false);
          setKickTarget(null);
          setPaused(false);
          setTimeout(() => {
            if (dhappaCallerIdxRef.current !== null) {
              kickPlayerRef.current(dhappaCallerIdxRef.current, "timeout");
            }
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []); // eslint-disable-line

  // Forward ref for kickPlayer
  const kickPlayerRef = useRef(null);

  const startGame = useCallback(({n, secs, names}) => {
    const ps = names.map((name, i) => ({name, color: COLORS[i], dark: DARK[i], vdark: VDARK[i], alive: true, originalIdx: i}));
    setPlayers(ps);
    setTimes(Array(n).fill(secs));
    setActiveIdx(0);
    setPaused(true);
    setStarted(false);
    setWinner(null);
    setPopup(null);
    setHighlightKick(false);
    setKickTarget(null);
    finishOrderRef.current = [];
    dhappaPlayerRef.current = null;
    roundBonusesRef.current = {};
    winnerPointsRef.current = {};
    iWonCountRef.current = 0;
    setRoundResult(null);
    lastTickedSecRef.current = -1;
    turnIndicatorRotationRef.current = 0;
    turnIndicatorReadyRef.current = false;
    setTurnIndicatorRotation(0);
    stopDhappaTimer();
    setDhappaCountdown(DHAPPA_TIMEOUT);

    const rosterChanged = allPlayers.length !== ps.length || allPlayers.some((p, i) => p.name !== ps[i]?.name);
    const nextRoundNum = rosterChanged ? 1 : roundNum;
    if (allPlayers.length === 0 || rosterChanged) {
      setAllPlayers(ps);
      const initialScores = {};
      ps.forEach((_, i) => { initialScores[i] = 0; });
      setCumulativeScores(initialScores);
      if (rosterChanged) { setRoundNum(1); setGameWinner(null); setShowGameOver(false); }
    }

    setLastConfig({n, secs, names});
    const startPlayerIdx = Math.floor(Math.random() * n);
    setRoundStartInfo({ roundNum: nextRoundNum, starterName: names[startPlayerIdx], starterColor: COLORS[startPlayerIdx], startPlayerIdx });
    setShowRoundStart(true);

    setConfig({n, secs, names, turnDirection});
    setScreen("game");
  }, [roundNum, allPlayers, turnDirection, stopDhappaTimer]);

  const handleRoundStartClose = useCallback(() => {
    setShowRoundStart(false);
    if (roundStartInfo) {
      setActiveIdx(roundStartInfo.startPlayerIdx);
      setStarted(true);
      setPaused(false);
    }
  }, [roundStartInfo]);

  const alivePlayers = players.filter(p => p.alive);
  const aliveCount = alivePlayers.length;

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

  useEffect(() => { lastTickedSecRef.current = -1; }, [activeIdx]);

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
    if (times[curGlobalIdx] <= 0) kickPlayerRef.current?.(curGlobalIdx, "timeout");
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
    stopDhappaTimer();
    setScreen("setup");
    setPlayers([]);
    setActiveIdx(0);
    setTimes([]);
    setPaused(true);
    setStarted(false);
    setPopup(null);
    setKickTarget(null);
    setWinner(null);
    setHighlightKick(false);
    setRoundResult(null);
    setRoundNum(1);
    setCumulativeScores({});
    setAllPlayers([]);
    setGameWinner(null);
    setShowRoundStart(false);
    setRoundStartInfo(null);
    setShowGameOver(false);
    finishOrderRef.current = [];
    dhappaPlayerRef.current = null;
    roundBonusesRef.current = {};
    winnerPointsRef.current = {};
    iWonCountRef.current = 0;
    lastTickedSecRef.current = -1;
    turnIndicatorRotationRef.current = 0;
    turnIndicatorReadyRef.current = false;
    setTurnIndicatorRotation(0);
    setDhappaCountdown(DHAPPA_TIMEOUT);
  }, [stopDhappaTimer]);

  const endRound = useCallback((finalOrder, dhappaIdx, allPlayersSnap, totalPlayers) => {
    void dhappaIdx;
    clearInterval(intervalRef.current);
    stopDhappaTimer();
    const n = totalPlayers;
    const result = [];

    finalOrder.forEach((globalIdx, eliminationPos) => {
      let basePoints = 0;
      if (eliminationPos === 0) {
        basePoints = 0;
      } else if (winnerPointsRef.current[globalIdx] !== undefined) {
        basePoints = winnerPointsRef.current[globalIdx];
      } else {
        const winnerRankFromTop = (n - 1) - eliminationPos;
        const table = WIN_POINTS_TABLE[n] ?? [5];
        basePoints = table[winnerRankFromTop] ?? 0;
      }

      const dhappaBonus = roundBonusesRef.current[globalIdx] ?? 0;
      const earned = basePoints + dhappaBonus;
      result.push({
        globalIdx,
        name: allPlayersSnap[globalIdx].name,
        color: allPlayersSnap[globalIdx].color,
        position: eliminationPos,
        earned,
        dhappa: dhappaBonus > 0,
        isLoser: eliminationPos === 0,
      });
    });

    result.sort((a, b) => b.position - a.position);

    setCumulativeScores(prev => {
      const next = { ...prev };
      result.forEach(r => { next[r.globalIdx] = (next[r.globalIdx] ?? 0) + r.earned; });
      const winnerEntry = Object.entries(next).find(([, score]) => score >= targetScore);
      if (winnerEntry) setGameWinner(allPlayersSnap[parseInt(winnerEntry[0])]);
      return next;
    });

    setRoundResult(result);
    setRoundNum(prev => prev + 1);
    setScreen("roundSummary");
  }, [targetScore, stopDhappaTimer]);

  const kickPlayer = useCallback((globalIdx, reason = "kicked") => {
    stopDhappaTimer();
    setPlayers(prev => {
      const next = prev.map((p, i) => i === globalIdx ? {...p, alive: false} : p);
      const stillAlive = next.filter(p => p.alive);
      const previousOrder = [...finishOrderRef.current];
      const newOrder = [...finishOrderRef.current, globalIdx];
      finishOrderRef.current = newOrder;

      if (stillAlive.length <= 1) {
        let fullOrder = [...newOrder];

        if (stillAlive.length === 1) {
          const lastIdx = next.indexOf(stillAlive[0]);
          if (reason === "kicked" || reason === "timeout") {
            fullOrder = [globalIdx, ...previousOrder, lastIdx];
          } else {
            fullOrder = [lastIdx, ...newOrder];
          }
        }

        finishOrderRef.current = fullOrder;
        setTimeout(() => endRound(fullOrder, dhappaPlayerRef.current, next, config?.n ?? prev.length), 0);
      } else {
        const aliveIdxs = next.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
        const kickerGlobalIdx = reason === "kicked" ? curGlobalIdx : globalIdx;
        const kickerNewPos = aliveIdxs.indexOf(kickerGlobalIdx);
        if (kickerNewPos !== -1) {
          setActiveIdx(kickerNewPos);
        } else {
          setActiveIdx(0);
        }
      }
      return next;
    });
    setPopup(null);
    setKickTarget(null);
    setHighlightKick(false);
    setPaused(false);
  }, [endRound, config, curGlobalIdx, stopDhappaTimer]);

  useEffect(() => { kickPlayerRef.current = kickPlayer; }, [kickPlayer]);

  const handleDhappa = () => {
    if (!started || winner || paused) return;
    setPaused(true);
    setPopup("dhappa");
    startDhappaTimer(curGlobalIdx);
  };

  const nextIWonPoints = config ? getNextWinnerPoints(iWonCountRef.current, config.n) : (lastConfig ? getNextWinnerPoints(iWonCountRef.current, lastConfig.n) : 0);

  const handleIWon = () => {
    stopDhappaTimer();
    const dhappaCallerIdx = curGlobalIdx;
    const pts = getNextWinnerPoints(iWonCountRef.current, config?.n ?? lastConfig?.n ?? 2);
    winnerPointsRef.current = { ...winnerPointsRef.current, [dhappaCallerIdx]: pts };
    iWonCountRef.current += 1;

    setPlayers(prev => {
      const next = prev.map((p, i) => i === dhappaCallerIdx ? {...p, alive: false} : p);
      const stillAlive = next.filter(p => p.alive);
      const newOrder = [...finishOrderRef.current, dhappaCallerIdx];
      finishOrderRef.current = newOrder;

      if (stillAlive.length <= 1) {
        let fullOrder = [...newOrder];
        if (stillAlive.length === 1) {
          const lastIdx = next.indexOf(stillAlive[0]);
          fullOrder = [lastIdx, ...newOrder];
        }
        finishOrderRef.current = fullOrder;
        setTimeout(() => endRound(fullOrder, dhappaCallerIdx, next, config?.n ?? prev.length), 0);
      } else {
        const aliveIdxs = next.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
        const oldAliveIdxs = prev.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
        const kickedPos = oldAliveIdxs.indexOf(dhappaCallerIdx);
        const step = turnDirection === "clockwise" ? 0 : -1;
        const nextActivePos = ((kickedPos + step) + aliveIdxs.length) % aliveIdxs.length;
        setActiveIdx(nextActivePos);
      }
      return next;
    });

    setPopup(null);
    setKickTarget(null);
    setHighlightKick(false);
    setPaused(false);
  };

  const handleKickSomeone = () => {
    setKickTarget(null);
    setPopup("kick");
    setHighlightKick(true);
  };

  const handleSelectKick = (globalIdx) => {
    if (globalIdx === curGlobalIdx) return;
    setKickTarget(globalIdx);
  };

  const handleConfirmKick = () => {
    if (kickTarget === null || kickTarget === curGlobalIdx) return;
    stopDhappaTimer();
    if (dhappaPlayerRef.current === null) dhappaPlayerRef.current = curGlobalIdx;
    roundBonusesRef.current = {
      ...roundBonusesRef.current,
      [curGlobalIdx]: (roundBonusesRef.current[curGlobalIdx] ?? 0) + DHAPPA_POINTS,
    };
    kickPlayer(kickTarget, "kicked");
  };

  const handleCancelDhappa = () => {
    stopDhappaTimer();
    setPopup(null);
    setHighlightKick(false);
    setKickTarget(null);
    setPaused(false);
  };

  // ── SCREENS ──
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
        lastConfig={lastConfig}
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

  // ── GAME SCREEN LAYOUT SAFEGUARDS ──
  if (!config && !lastConfig) return null;

  // Compute safely bound responsive layout metrics
  const w = dimensions.width || window.innerWidth || 300;
  const h = dimensions.height || window.innerHeight || 600;
  const isPortrait = h > w;
  const clockHeight = Math.max(h, isPortrait ? Math.max(w + 140, 560) : 560);
  
  const cx = w / 2;
  const cy = clockHeight / 2;
  const baseScale = Math.min(w, clockHeight);
  
  const centerR = baseScale * 0.24;
  const maxR = baseScale * 0.48; // Maximum circle size (fits safely inside screen, fixes limits drop)
  const timeR = baseScale * 0.385;
  const n = aliveCount;
  
  const dhappaFontSize = centerR * 0.58;
  const dhappaTextLength = centerR * 1.72;
  const timerFontSize = baseScale * (n <= 2 ? 0.21 : n <= 3 ? 0.165 : n <= 4 ? 0.14 : 0.112);

  return (
    <div className="app-container" style={{position:"fixed",inset:0,zIndex:9999,background:"#050508",fontFamily:FONT,userSelect:"none",overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Quantico:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        .clock-view-wrapper { position: relative !important; width: 100% !important; height: ${clockHeight}px !important; }
        .action-dashboard { position: relative !important; }
        * { font-family: 'Impact', 'Arial Narrow', Arial, sans-serif !important; }
        input, button { font-family: 'Impact', 'Arial Narrow', Arial, sans-serif !important; }
      `}</style>

      {showRoundStart && roundStartInfo && (
        <RoundStartPopup
          roundNum={roundStartInfo.roundNum}
          starterName={roundStartInfo.starterName}
          starterColor={roundStartInfo.starterColor}
          onClose={handleRoundStartClose}
        />
      )}

      <div className="clock-view-wrapper" style={{position:"relative",width:"100%",height:clockHeight,overflow:"hidden",background:"#050508"}}>
        {/* Top bar */}
        <div style={{position:"absolute",top:0,left:0,right:0,zIndex:20,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",boxSizing:"border-box"}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={() => { stopDhappaTimer(); setPaused(true); setPopup(null); setConfig(null); setScreen("setup"); }}
              style={{background:"rgba(5,5,8,0.6)",border:"2px solid #333",borderRadius:8,color:"#777",padding:"9px 16px",fontFamily:FONT,fontSize:14,cursor:"pointer",letterSpacing:1,backdropFilter:"blur(4px)"}}>
              ← SETUP
            </button>
            <button onClick={resetGame}
              style={{background:"rgba(5,5,8,0.6)",border:"2px solid #333",borderRadius:8,color:"#FF6B6B",padding:"9px 16px",fontFamily:FONT,fontSize:14,cursor:"pointer",letterSpacing:1,backdropFilter:"blur(4px)"}}>
              RESET
            </button>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{color:"#444",fontSize:13,letterSpacing:2}}>ROUND {roundNum - 1 > 0 ? roundNum - 1 : 1}</div>
            <div style={{color: paused ? "#FFD93D" : "#FF6B6B", fontSize:14, letterSpacing:2}}>
              {!started ? "TAP TO START" : paused ? "PAUSED" : "● LIVE"}
            </div>
          </div>
        </div>

        <svg width="100%" height={clockHeight}
          viewBox={`0 0 ${w} ${clockHeight}`}
          ref={svgRef} style={{display:"block"}}>
          <rect x={0} y={0} width={w} height={clockHeight} fill="#050508" />

          {alivePlayers.map((player) => {
            const globalIdx = players.indexOf(player);
            const origIdx = player.originalIdx;
            const isActive = globalIdx === curGlobalIdx;
            const sector = sectorByOrig.get(origIdx);
            if (!sector) return null;
            const { angle1, angle2, midAngle } = sector;

            const totalSecs = config?.secs ?? lastConfig?.secs ?? 300;
            const t = times[globalIdx] ?? 0;
            const pct = totalSecs > 0 ? t / totalSecs : 1;
            
            // Calculates shrinking radius down to 0 remaining time safely
            const currentR = centerR + (maxR - centerR) * Math.max(pct, 0.005);
            
            const x1 = cx + currentR * Math.cos(angle1);
            const y1 = cy + currentR * Math.sin(angle1);
            const x2 = cx + currentR * Math.cos(angle2);
            const y2 = cy + currentR * Math.sin(angle2);
            const xc1 = cx + centerR * Math.cos(angle1);
            const yc1 = cy + centerR * Math.sin(angle1);
            const xc2 = cx + centerR * Math.cos(angle2);
            const yc2 = cy + centerR * Math.sin(angle2);
            const largeArc = (angle2 - angle1) >= Math.PI ? 1 : 0;
            const path = `M ${xc1} ${yc1} L ${x1} ${y1} A ${currentR} ${currentR} 0 ${largeArc} 1 ${x2} ${y2} L ${xc2} ${yc2} A ${centerR} ${centerR} 0 ${largeArc} 0 ${xc1} ${yc1} Z`;
            
            const isLow = pct < 0.2;
            const fillColor = isLow ? "#FF6B6B" : player.color;
            const isKickHighlight = highlightKick && globalIdx !== curGlobalIdx;
            const isKickSelected = kickTarget === globalIdx;

            const tx = cx + timeR * Math.cos(midAngle);
            const ty = cy + timeR * Math.sin(midAngle);
            const deg = (midAngle * 180 / Math.PI) - 90;
            const dispColor = isLow ? "#3a0000" : player.vdark;

            const halfArc = Math.PI * 0.18;
            const nr = centerR + baseScale * 0.05;
            let arcSx, arcSy, arcEx, arcEy, arcSweep;
            if (turnDirection === "clockwise") {
              arcSx = cx + nr * Math.cos(midAngle - halfArc);
              arcSy = cy + nr * Math.sin(midAngle - halfArc);
              arcEx = cx + nr * Math.cos(midAngle + halfArc);
              arcEy = cy + nr * Math.sin(midAngle + halfArc);
              arcSweep = 1;
            } else {
              arcSx = cx + nr * Math.cos(midAngle + halfArc);
              arcSy = cy + nr * Math.sin(midAngle + halfArc);
              arcEx = cx + nr * Math.cos(midAngle - halfArc);
              arcEy = cy + nr * Math.sin(midAngle - halfArc);
              arcSweep = 0;
            }
            const namePathId = `namepath-${origIdx}`;

            return (
              <g key={globalIdx}
                onClick={() => {
                  if (popup === "kick") { handleSelectKick(globalIdx); return; }
                  if (globalIdx === curGlobalIdx && !popup) passToNext(globalIdx);
                }}
                style={{cursor: popup === "kick" ? (globalIdx !== curGlobalIdx ? "pointer" : "default") : globalIdx === curGlobalIdx ? "pointer" : "default"}}>

                <path d={path}
                  fill={fillColor}
                  fillOpacity={isKickHighlight ? (isKickSelected ? 1 : 0.6) : (isActive ? 1 : 0.8)}
                  stroke={isKickSelected ? "#FF6B6B" : isActive ? fillColor : "#0f0f20"}
                  strokeWidth={isKickSelected ? 4 : isActive ? 2 : 1}
                  style={{transition:"fill-opacity .2s, stroke .2s, d 1s linear"}}
                />

                {isKickHighlight && (
                  <text
                    x={cx + (timeR * 0.62) * Math.cos(midAngle)}
                    y={cy + (timeR * 0.62) * Math.sin(midAngle)}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={baseScale * 0.028}
                    fill={isKickSelected ? "#FF6B6B" : "#ffffff"}
                    fillOpacity={isKickSelected ? 1 : 0.53}
                    fontFamily={FONT}
                    style={{pointerEvents:"none"}}>
                    {isKickSelected ? "✓ KICK" : "TAP TO KICK"}
                  </text>
                )}

                <defs>
                  <path id={namePathId} d={`M ${arcSx} ${arcSy} A ${nr} ${nr} 0 0 ${arcSweep} ${arcEx} ${arcEy}`} fill="none" />
                </defs>
                <text fontFamily={FONT} fontSize={baseScale * 0.04} fill="#ffffff" fontWeight="bold" style={{letterSpacing:"2px"}}>
                  <textPath href={`#${namePathId}`} startOffset="50%" textAnchor="middle">
                    {player.name.toUpperCase()}
                  </textPath>
                </text>

                <g transform={`translate(${tx},${ty}) rotate(${deg})`}>
                  <text textAnchor="middle" dominantBaseline="middle"
                    fontSize={timerFontSize} fill={dispColor}
                    stroke={dispColor} strokeWidth={baseScale * 0.003}
                    paintOrder="stroke fill" fontFamily={FONT}>
                    {formatTime(t)}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Sector dividers extending nicely beyond the circle */}
          {alivePlayers.map((player) => {
            const sector = sectorByOrig.get(player.originalIdx);
            if (!sector) return null;
            const angle = sector.angle1;
            const pv = [cx + centerR * Math.cos(angle), cy + centerR * Math.sin(angle)];
            const ev = [cx + baseScale * 1.5 * Math.cos(angle), cy + baseScale * 1.5 * Math.sin(angle)];
            return <line key={`div-${player.originalIdx}`} x1={pv[0]} y1={pv[1]} x2={ev[0]} y2={ev[1]} stroke="#050508" strokeWidth={3} />;
          })}

          {/* Center circle */}
          <circle cx={cx} cy={cy} r={centerR}
            fill={centerHovered ? "#1e1e35" : "#0f0f20"}
            stroke={centerHovered ? "#FF6B6B" : "none"}
            strokeOpacity={0.33} strokeWidth={2}
            onClick={handleDhappa}
            onMouseEnter={() => setCenterHovered(true)}
            onMouseLeave={() => setCenterHovered(false)}
            style={{cursor:"pointer",transition:"fill .15s"}}
          />

          {/* Arc indicator */}
          {(() => {
            if (!started) return null;
            const ap = players[curGlobalIdx];
            if (!ap) return null;
            const s = sectorByOrig.get(ap.originalIdx);
            if (!s) return null;
            const arcR = centerR - baseScale * 0.012;
            const halfSpanRad = Math.max((s.angle2 - s.angle1) / 2, 0.12);
            const x1a = cx + arcR * Math.cos(-halfSpanRad);
            const y1a = cy + arcR * Math.sin(-halfSpanRad);
            const x2a = cx + arcR * Math.cos(halfSpanRad);
            const y2a = cy + arcR * Math.sin(halfSpanRad);
            const la = halfSpanRad * 2 > Math.PI ? 1 : 0;
            return (
              <path d={`M ${x1a} ${y1a} A ${arcR} ${arcR} 0 ${la} 1 ${x2a} ${y2a}`}
                fill="none" stroke={ap.color} strokeWidth={baseScale * 0.018} strokeLinecap="round"
                style={{transformOrigin:`${cx}px ${cy}px`,transform:`rotate(${turnIndicatorRotation}deg)`,transition:"transform .35s linear"}}
              />
            );
          })()}

          {/* DHAPPA label */}
          <text x={cx} y={cy - dhappaFontSize * 0.08} textAnchor="middle" dominantBaseline="middle"
            fontSize={dhappaFontSize} textLength={dhappaTextLength} lengthAdjust="spacingAndGlyphs"
            fill={centerHovered ? "#ff9999" : "#FF6B6B"}
            stroke={centerHovered ? "#ff9999" : "#FF6B6B"} strokeWidth={baseScale * 0.003}
            paintOrder="stroke fill" fontFamily={FONT}
            onClick={handleDhappa}
            onMouseEnter={() => setCenterHovered(true)} onMouseLeave={() => setCenterHovered(false)}
            style={{cursor:"pointer",transition:"fill .15s"}}>
            DHAPPA
          </text>
          <text x={cx} y={cy + dhappaFontSize * 0.68} textAnchor="middle" dominantBaseline="middle"
            fontSize={dhappaFontSize * 0.22}
            fill={centerHovered ? "#ff9999" : "#FF6B6B"}
            fillOpacity={0.9}
            fontFamily={FONT}
            onClick={handleDhappa}
            onMouseEnter={() => setCenterHovered(true)} onMouseLeave={() => setCenterHovered(false)}
            style={{cursor:"pointer",transition:"fill .15s"}}>
            BONUS +{DHAPPA_POINTS} PTS
          </text>
        </svg>

        {/* ── DHAPPA choice popup ── */}
        {popup === "dhappa" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(5,5,8,0.8)",zIndex:100}}>
            <div style={{background:"#0a0a14",border:"2px solid rgba(255,107,107,0.27)",borderRadius:24,padding:36,textAlign:"center",width:360,maxWidth:"90%"}}>

              <div style={{marginBottom:18}}>
                <div style={{
                  fontSize:54, fontFamily:FONT,
                  color: dhappaCountdown <= 10 ? "#FF6B6B" : "#FFD93D",
                  lineHeight:1, marginBottom:4,
                  transition:"color .3s"
                }}>{dhappaCountdown}</div>
                <div style={{color:"#555",fontSize:12,fontFamily:FONT,letterSpacing:3}}>SECONDS TO DECIDE</div>
                <div style={{height:4,background:"#111",borderRadius:2,marginTop:10,overflow:"hidden"}}>
                  <div style={{
                    height:"100%",
                    width:`${(dhappaCountdown / DHAPPA_TIMEOUT) * 100}%`,
                    background: dhappaCountdown <= 10 ? "#FF6B6B" : "#FFD93D",
                    borderRadius:2,
                    transition:"width 1s linear, background .3s"
                  }}/>
                </div>
              </div>

              <div style={{color:"#FF6B6B",fontSize:30,fontFamily:FONT,letterSpacing:3,marginBottom:6}}>DHAPPA!</div>
              <div style={{color:"#666",fontSize:13,fontFamily:FONT,letterSpacing:2,marginBottom:24}}>CHOOSE YOUR MOVE</div>

              <button onClick={handleIWon} style={{width:"100%",padding:"18px 0",borderRadius:12,background:"rgba(107,203,119,0.13)",border:"2px solid #6BCB77",color:"#6BCB77",fontFamily:FONT,fontSize:18,cursor:"pointer",marginBottom:4,letterSpacing:1}}>
                I WON 🏆
              </button>
              <div style={{color:"rgba(107,203,119,0.6)",fontSize:13,fontFamily:FONT,marginBottom:20,letterSpacing:1}}>
                Awards you: <strong style={{color:"#6BCB77"}}>+{nextIWonPoints} pts</strong>
              </div>

              <button onClick={handleKickSomeone} style={{width:"100%",padding:"18px 0",borderRadius:12,background:"rgba(255,107,107,0.13)",border:"2px solid #FF6B6B",color:"#FF6B6B",fontFamily:FONT,fontSize:18,cursor:"pointer",marginBottom:4,letterSpacing:1}}>
                KICK SOMEONE 💀
              </button>
              <div style={{color:"rgba(255,107,107,0.6)",fontSize:13,fontFamily:FONT,marginBottom:20,letterSpacing:1}}>
                Awards you: <strong style={{color:"#FF6B6B"}}>+{DHAPPA_POINTS} pts</strong>
              </div>

              <button onClick={handleCancelDhappa} style={{width:"100%",padding:"12px 0",borderRadius:10,background:"none",border:"2px solid #333",color:"#666",fontFamily:FONT,fontSize:15,cursor:"pointer",letterSpacing:2}}>CANCEL</button>
            </div>
          </div>
        )}

        {/* ── KICK selection popup ── */}
        {popup === "kick" && (
          <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:100,padding:"16px 20px 24px",background:"linear-gradient(to top, #050508 80%, transparent)",boxSizing:"border-box"}}>

            <div style={{marginBottom:12,textAlign:"center"}}>
              <span style={{
                fontSize:28, fontFamily:FONT,
                color: dhappaCountdown <= 10 ? "#FF6B6B" : "#FFD93D"
              }}>{dhappaCountdown}s</span>
              <span style={{color:"#444",fontSize:12,fontFamily:FONT,letterSpacing:2,marginLeft:8}}>TO DECIDE</span>
              <div style={{height:3,background:"#111",borderRadius:2,marginTop:8,overflow:"hidden"}}>
                <div style={{
                  height:"100%",
                  width:`${(dhappaCountdown / DHAPPA_TIMEOUT) * 100}%`,
                  background: dhappaCountdown <= 10 ? "#FF6B6B" : "#FFD93D",
                  borderRadius:2,
                  transition:"width 1s linear, background .3s"
                }}/>
              </div>
            </div>

            <div style={{color:"#FF6B6B",fontSize:20,fontFamily:FONT,letterSpacing:2,marginBottom:8,textAlign:"center"}}>TAP A PLAYER TO KICK</div>
            <div style={{color:"#555",fontSize:13,fontFamily:FONT,letterSpacing:1,marginBottom:16,textAlign:"center"}}>Kicker gets +{DHAPPA_POINTS} pts · Kicked gets 0 pts</div>

            {kickTarget !== null && (
              <button onClick={handleConfirmKick}
                style={{width:"100%",padding:"16px 0",borderRadius:12,background:"#FF6B6B",border:"none",color:"#fff",fontFamily:FONT,fontSize:18,cursor:"pointer",marginBottom:12,letterSpacing:2}}>
                CONFIRM KICK → {players[kickTarget]?.name}
              </button>
            )}
            <button onClick={handleCancelDhappa}
              style={{width:"100%",padding:"12px 0",borderRadius:10,background:"none",border:"2px solid #333",color:"#666",fontFamily:FONT,fontSize:15,cursor:"pointer",letterSpacing:2}}>
              CANCEL
            </button>
          </div>
        )}
      </div>

      <div className="action-dashboard" style={{position:"relative",background:"#050508",borderTop:"1px solid #111",paddingBottom:24}}>
        <div style={{display:"flex",gap:12,padding:"14px 20px 12px",boxSizing:"border-box"}}>
          <button
            onClick={() => { if (!started) { setStarted(true); setPaused(false); return; } passToNext(curGlobalIdx); }}
            disabled={!!winner || !!popup}
            style={{flex:2,padding:"18px 0",borderRadius:14,background:started?`rgba(${parseInt((players[curGlobalIdx]?.color ?? '#FF6B6B').slice(1,3),16)},${parseInt((players[curGlobalIdx]?.color ?? '#FF6B6B').slice(3,5),16)},${parseInt((players[curGlobalIdx]?.color ?? '#FF6B6B').slice(5,7),16)},0.13)`:"rgba(255,107,107,0.13)",border:`3px solid ${players[curGlobalIdx]?.color ?? '#FF6B6B'}`,color:players[curGlobalIdx]?.color ?? '#FF6B6B',fontFamily:FONT,fontSize:19,cursor: popup ? "default" : "pointer",letterSpacing:2,opacity: popup ? 0.5 : 1}}>
            {started ? "PASS →" : "START / PASS →"}
          </button>
          <button onClick={() => { if(started && !popup) setPaused(p=>!p); }}
            disabled={!started || !!winner}
            style={{flex:1,padding:"18px 0",borderRadius:14,background:paused?"rgba(255,217,61,0.13)":"#0a0a14",border:`3px solid ${paused?"#FFD93D":"#222"}`,color:paused?"#FFD93D":"#555",fontFamily:FONT,fontSize:17,cursor:"pointer",letterSpacing:1}}>
            {paused?"▶ GO":"⏸ PAUSE"}
          </button>
        </div>

        {allPlayers.length > 0 && (
          <div style={{padding:"0 16px 16px"}}>
            <Leaderboard players={allPlayers} cumulativeScores={cumulativeScores} roundNum={roundNum - 1} targetScore={targetScore} />
          </div>
        )}
      </div>
    </div>
  );
}