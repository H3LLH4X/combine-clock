import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF9F1C"];
const DARK =   ["#cc2222","#cc9900","#1e8c3a","#1155cc","#7722cc","#cc5500"];
const VDARK =  ["#3a0000","#3a2800","#003a10","#00103a","#1a003a","#3a1500"];

const SERIES_WIN = 11;

// Points awarded by finish position: 1st=5, 2nd=3, 3rd=2, 4th=1, 5th+=0
const POINTS_BY_POSITION = [5, 3, 2, 1, 0];
const DHAPPA_POINTS = 3;

function getPointsForPosition(pos, total) {
  if (total === 2) return pos === 0 ? 5 : 0;
  if (total === 3) return pos === 0 ? 5 : pos === 1 ? 3 : 0;
  return POINTS_BY_POSITION[pos] ?? 0;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}

function getPolygonPoints(cx, cy, r, n, rotOffset = 0) {
  return Array.from({length: n}, (_, i) => {
    const angle = (2 * Math.PI * i / n) + rotOffset;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
}

function SetupScreen({ onStart, seriesScores, playerNames: existingNames }) {
  const [n, setN] = useState(existingNames ? existingNames.length : 3);
  const [mins, setMins] = useState(5);
  const [names, setNames] = useState(
    existingNames
      ? [...existingNames, "Player 4","Player 5","Player 6"].slice(0,6)
      : ["Player 1","Player 2","Player 3","Player 4","Player 5","Player 6"]
  );

  const hasSeries = seriesScores && seriesScores.some(s => s > 0);

  // Rank players by score descending
  const rankedPlayers = existingNames 
    ? existingNames
        .map((name, i) => ({ name, pts: seriesScores[i] ?? 0, idx: i, color: COLORS[i] }))
        .sort((a, b) => b.pts - a.pts)
    : [];

  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"#050508",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",padding:"2rem",boxSizing:"border-box",overflowY:"auto"}}>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:48,letterSpacing:4,color:"#fff",fontWeight:900}}>DHAPPA</div>
          <div style={{color:"#555",fontSize:12,letterSpacing:6,marginTop:4}}>MULTIPLAYER CLOCK</div>
        </div>

        {/* Series scoreboard - Ranked */}
        {hasSeries && (
          <div style={{background:"#0a0a14",border:"1px solid #222",borderRadius:12,padding:"14px 18px",marginBottom:16}}>
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom:14}}>
              <div style={{color:"#555",fontSize:11,letterSpacing:3}}>LEADERBOARD</div>
              <div style={{color:"#FF6B6B",fontSize:11,letterSpacing:2}}>/{SERIES_WIN} TO WIN</div>
            </div>
            
            {rankedPlayers.map((player, rank) => {
              const pct = Math.min(player.pts / SERIES_WIN, 1);
              return (
                <div key={player.idx} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{color:player.color,fontSize:13,fontWeight:700}}>
                      <span style={{opacity: 0.6, marginRight: 6}}>#{rank + 1}</span>
                      {player.name}
                    </span>
                    <span style={{color:player.color,fontSize:13,fontWeight:900}}>{player.pts} pts</span>
                  </div>
                  <div style={{height:4,background:"#111",borderRadius:2}}>
                    <div style={{height:4,width:`${pct*100}%`,background:player.color,borderRadius:2,transition:"width .4s"}} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{background:"#0a0a14",border:"1px solid #222",borderRadius:16,padding:28}}>
          {!hasSeries && (
            <div style={{marginBottom:20}}>
              <div style={{color:"#555",fontSize:11,letterSpacing:3,marginBottom:10}}>PLAYERS</div>
              <div style={{display:"flex",gap:8}}>
                {[2,3,4,5,6].map(v=>(
                  <button key={v} onClick={()=>setN(v)} style={{flex:1,padding:"10px 0",borderRadius:10,border:n===v?`2px solid ${COLORS[v-2]}`:"1px solid #222",background:n===v?`${COLORS[v-2]}22`:"#050508",color:n===v?COLORS[v-2]:"#444",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,cursor:"pointer",transition:"all .15s"}}>{v}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{marginBottom:20}}>
            <div style={{color:"#555",fontSize:11,letterSpacing:3,marginBottom:10}}>MINUTES PER PLAYER</div>
            <input type="number" min={1} max={60} value={mins} onChange={e=>setMins(Number(e.target.value))} style={{width:"100%",background:"#050508",border:"1px solid #222",borderRadius:8,padding:"10px 14px",color:"#fff",fontFamily:"'Courier New',monospace",fontSize:18,outline:"none",boxSizing:"border-box"}} />
          </div>

          {!hasSeries && (
            <div style={{marginBottom:24}}>
              <div style={{color:"#555",fontSize:11,letterSpacing:3,marginBottom:10}}>NAMES</div>
              <div style={{display:"flex", flexDirection:"column", gap:10, maxHeight:"240px", overflowY:"auto", paddingRight:4}}>
                {Array.from({length:n},(_,i)=>(
                  <input
                    key={i}
                    value={names[i]}
                    onChange={e=>setNames(arr=>arr.map((v,j)=>j===i?e.target.value:v))}
                    style={{width:"100%",background:"#050508",border:`1px solid ${COLORS[i]}55`,borderLeft:`4px solid ${COLORS[i]}`,borderRadius:6,padding:"10px 14px",color:COLORS[i],fontFamily:"'Courier New',monospace",fontSize:14,outline:"none",boxSizing:"border-box"}}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>onStart({n: hasSeries ? existingNames.length : n, secs:mins*60, names: hasSeries ? existingNames : names.slice(0,n), newSeries:false})}
              style={{flex:2,padding:14,borderRadius:12,background:"#FF6B6B",border:"none",color:"#fff",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,letterSpacing:2,cursor:"pointer"}}>
              {hasSeries ? "NEXT ROUND →" : "START →"}
            </button>
            {hasSeries && (
              <button onClick={()=>onStart({n, secs:mins*60, names:names.slice(0,n), newSeries:true})}
                style={{flex:1,padding:14,borderRadius:12,background:"none",border:"1px solid #333",color:"#555",fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:900,letterSpacing:1,cursor:"pointer"}}>
                NEW SERIES
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Round summary shown after each round before returning to setup
function RoundSummary({ roundResult, seriesScores, players, onContinue, seriesWinner }) {
  // Sort players dynamically by their new total series scores to reflect updated ranking
  const rankedTotals = players.map((p, i) => ({
    ...p,
    pts: seriesScores[i] ?? 0,
    idx: i
  })).sort((a, b) => b.pts - a.pts);

  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"#050508",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",padding:"2rem",boxSizing:"border-box"}}>
      <div style={{width:"100%",maxWidth:400}}>
        {seriesWinner ? (
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:56,marginBottom:8}}>🏆</div>
            <div style={{color:"#FFD93D",fontSize:13,letterSpacing:4,marginBottom:6}}>SERIES WINNER</div>
            <div style={{color:"#fff",fontSize:34,fontWeight:900,letterSpacing:2}}>{seriesWinner}</div>
          </div>
        ) : (
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{color:"#555",fontSize:11,letterSpacing:4,marginBottom:8}}>ROUND OVER</div>
          </div>
        )}

        <div style={{background:"#0a0a14",border:"1px solid #222",borderRadius:16,padding:24,marginBottom:16}}>
          <div style={{color:"#555",fontSize:11,letterSpacing:3,marginBottom:14}}>THIS ROUND</div>
          {roundResult.map((r, i) => (
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:r.color,flexShrink:0}} />
                <span style={{color:r.color,fontWeight:700,fontSize:13}}>{r.name}</span>
                {r.dhappa && <span style={{color:"#FF6B6B",fontSize:10,letterSpacing:1,background:"#FF6B6B22",padding:"2px 6px",borderRadius:4}}>DHAPPA +{DHAPPA_POINTS}</span>}
              </div>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <span style={{color:"#555",fontSize:11}}>{r.position === 0 ? "1ST" : r.position === 1 ? "2ND" : r.position === 2 ? "3RD" : `${r.position+1}TH`}</span>
                <span style={{color:r.color,fontWeight:900,fontSize:16}}>+{r.earned}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{background:"#0a0a14",border:"1px solid #222",borderRadius:16,padding:24,marginBottom:20}}>
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom:14}}>
            <div style={{color:"#555",fontSize:11,letterSpacing:3}}>LEADERBOARD</div>
            <div style={{color:"#FF6B6B",fontSize:11,letterSpacing:2}}>/{SERIES_WIN}</div>
          </div>
          {rankedTotals.map((p, rank) => {
            const pct = Math.min(p.pts / SERIES_WIN, 1);
            return (
              <div key={p.idx} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:p.color,fontSize:13,fontWeight:700}}>
                    <span style={{opacity: 0.6, marginRight: 6}}>#{rank + 1}</span>
                    {p.name}
                  </span>
                  <span style={{color:p.color,fontWeight:900}}>{p.pts} pts</span>
                </div>
                <div style={{height:5,background:"#111",borderRadius:3}}>
                  <div style={{height:5,width:`${pct*100}%`,background:p.color,borderRadius:3,transition:"width .5s"}} />
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={onContinue} style={{width:"100%",padding:14,borderRadius:12,background:"#FF6B6B",border:"none",color:"#fff",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,letterSpacing:2,cursor:"pointer"}}>
          {seriesWinner ? "NEW SERIES" : "CONTINUE →"}
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
  const [kickTarget, setKickTarget] = useState(null);
  const [winner, setWinner] = useState(null);
  const [highlightKick, setHighlightKick] = useState(false);
  const intervalRef = useRef(null);
  const svgRef = useRef(null);

  // Series state
  const [seriesScores, setSeriesScores] = useState([]); 
  const [seriesPlayerNames, setSeriesPlayerNames] = useState([]); 
  const [roundResult, setRoundResult] = useState(null);  
  const [finishOrder, setFinishOrder] = useState([]); 
  const finishOrderRef = useRef([]); 
  const [dhappaPlayer, setDhappaPlayer] = useState(null); 
  const dhappaPlayerRef = useRef(null);
  const dhappaWinnerRef = useRef(null); 
  const [seriesWinner, setSeriesWinner] = useState(null);

  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const arcRotationRef = useRef(0);
  const [arcRotation, setArcRotation] = useState(0);
  const [centerHovered, setCenterHovered] = useState(false);

  useEffect(() => {
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const startGame = useCallback(({n, secs, names, newSeries}) => {
    const ps = names.map((name, i) => ({name, color: COLORS[i], dark: DARK[i], vdark: VDARK[i], alive: true, originalIdx: i}));
    setPlayers(ps);
    setTimes(Array(n).fill(secs));
    setActiveIdx(0);
    setPaused(true);
    setStarted(false);
    setWinner(null);
    setPopup(null);
    setFinishOrder([]);
    finishOrderRef.current = [];
    setDhappaPlayer(null);
    dhappaPlayerRef.current = null;
    dhappaWinnerRef.current = null;
    setRoundResult(null);
    setSeriesWinner(null);
    arcRotationRef.current = 0;
    setArcRotation(0);

    if (newSeries) {
      setSeriesScores(Array(n).fill(0));
      setSeriesPlayerNames(names);
    } else if (seriesScores.length === 0) {
      setSeriesScores(Array(n).fill(0));
      setSeriesPlayerNames(names);
    }

    setConfig({n, secs, names});
    setScreen("game");
  }, [seriesScores]);

  const alivePlayers = players.filter(p => p.alive);
  const aliveCount = alivePlayers.length;

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

  useEffect(() => {
    if (!started || !players.length) return;
    const alive = players.filter(p => p.alive);
    const n = alive.length;
    if (n === 0) return;
    const alivePos = alive.findIndex((_, i) => aliveIndices[i] === curGlobalIdx || alive[i] === players[curGlobalIdx]);
    if (alivePos === -1) return;
    const sectorDeg = 360 / n;
    const targetDeg = (alivePos + 0.5) * sectorDeg + (-90);
    let current = arcRotationRef.current % 360;
    let delta = ((targetDeg - current) % 360 + 360) % 360;
    if (delta > 180) delta -= 360;
    arcRotationRef.current = arcRotationRef.current + delta;
    setArcRotation(arcRotationRef.current);
  }, [activeIdx, players, started, aliveIndices, curGlobalIdx]);

  useEffect(() => {
    if (!started || !players.length) return;
    if (times[curGlobalIdx] <= 0) {
      kickPlayer(curGlobalIdx);
    }
  }, [times, started, players, curGlobalIdx]);

  const passToNext = useCallback((fromGlobal) => {
    if (!started) { setStarted(true); setPaused(false); return; }
    if (paused || winner || popup) return;
    const alive = players.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
    if (alive.length <= 1) return;
    const curPos = alive.indexOf(fromGlobal ?? curGlobalIdx);
    const nextPos = (curPos - 1 + alive.length) % alive.length;
    setActiveIdx(nextPos);
  }, [started, paused, winner, popup, players, curGlobalIdx]);

  const endRound = useCallback((finalOrder, dhappaIdx, allPlayers, totalPlayers) => {
    clearInterval(intervalRef.current);

    const n = totalPlayers;
    const newScores = [...seriesScores];
    const result = [];

    finalOrder.forEach((globalIdx, eliminationPos) => {
      const finishPos = n - 1 - eliminationPos; 
      const basePoints = getPointsForPosition(finishPos, n);
      const isDhappa = globalIdx === dhappaIdx;
      const dhappaBonus = isDhappa ? DHAPPA_POINTS : 0;
      const earned = basePoints + dhappaBonus;
      newScores[globalIdx] = (newScores[globalIdx] ?? 0) + earned;
      result.push({
        globalIdx,
        name: allPlayers[globalIdx].name,
        color: allPlayers[globalIdx].color,
        position: finishPos,
        earned,
        dhappa: isDhappa,
      });
    });

    result.sort((a, b) => a.position - b.position);

    setSeriesScores(newScores);

    const sw = newScores.findIndex(s => s >= SERIES_WIN);
    const swName = sw !== -1 ? allPlayers[sw].name : null;
    setSeriesWinner(swName);
    setRoundResult(result);
    setScreen("roundSummary");
  }, [seriesScores]);

  const kickPlayer = useCallback((globalIdx) => {
    setPlayers(prev => {
      const next = prev.map((p, i) => i === globalIdx ? {...p, alive: false} : p);
      const stillAlive = next.filter(p => p.alive);
      const newOrder = [...finishOrderRef.current, globalIdx];
      finishOrderRef.current = newOrder;
      setFinishOrder(newOrder);

      if (stillAlive.length <= 1) {
        let fullOrder = [...newOrder];
        if (stillAlive.length === 1) {
          const roundWinnerIdx = next.indexOf(stillAlive[0]);
          fullOrder = [...fullOrder, roundWinnerIdx];
        }
        if (dhappaWinnerRef.current !== null) {
          fullOrder = [...fullOrder, dhappaWinnerRef.current];
        }
        finishOrderRef.current = fullOrder;
        setFinishOrder(fullOrder);
        setTimeout(() => endRound(fullOrder, dhappaPlayerRef.current, next, config?.n ?? prev.length), 0);
      } else {
        const aliveIdxs = next.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
        setActiveIdx(prev2 => Math.min(prev2, aliveIdxs.length - 1));
      }
      return next;
    });
    setPopup(null);
    setKickTarget(null);
    setHighlightKick(false);
    setPaused(false);
  }, [endRound, config]);

  const handleDhappa = () => {
    setPaused(true);
    setPopup("dhappa");
  };

  const handleIWon = () => {
    const dhappaCallerIdx = curGlobalIdx;
    setDhappaPlayer(dhappaCallerIdx);
    dhappaPlayerRef.current = dhappaCallerIdx;

    setPlayers(prev => {
      const next = prev.map((p, i) => i === dhappaCallerIdx ? {...p, alive: false} : p);
      const stillAlive = next.filter(p => p.alive);

      if (stillAlive.length <= 1) {
        const remainingIdx = stillAlive.length === 1 ? next.indexOf(stillAlive[0]) : null;
        const fullOrder = remainingIdx !== null
          ? [...finishOrderRef.current, remainingIdx, dhappaCallerIdx]
          : [...finishOrderRef.current, dhappaCallerIdx];
        finishOrderRef.current = fullOrder;
        setFinishOrder(fullOrder);
        setTimeout(() => endRound(fullOrder, dhappaCallerIdx, next, config?.n ?? prev.length), 0);
      } else {
        dhappaWinnerRef.current = dhappaCallerIdx;
        const aliveIdxs = next.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
        setActiveIdx(prev2 => Math.min(prev2, aliveIdxs.length - 1));
      }
      return next;
    });

    setPopup(null);
    setKickTarget(null);
    setHighlightKick(false);
    setPaused(false);
  };

  const handleKickSomeone = () => {
    setPopup("kick");
    setHighlightKick(true);
  };

  const handleSelectKick = (globalIdx) => {
    if (globalIdx === curGlobalIdx) return;
    setKickTarget(globalIdx);
    setPopup("confirmKick");
  };

  const handleConfirmKick = () => {
    if (dhappaPlayerRef.current === null) {
      setDhappaPlayer(curGlobalIdx);
      dhappaPlayerRef.current = curGlobalIdx;
    }
    kickPlayer(kickTarget);
  };

  const handleCancelDhappa = () => {
    setPopup(null);
    setHighlightKick(false);
    setKickTarget(null);
    setPaused(false);
  };

  if (screen === "setup") {
    return (
      <SetupScreen
        onStart={startGame}
        seriesScores={seriesScores.length > 0 ? seriesScores : null}
        playerNames={seriesPlayerNames.length > 0 ? seriesPlayerNames : null}
      />
    );
  }

  if (screen === "roundSummary") {
    return (
      <RoundSummary
        roundResult={roundResult}
        seriesScores={seriesScores}
        players={players}
        seriesWinner={seriesWinner}
        onContinue={() => {
          if (seriesWinner) {
            setSeriesScores([]);
            setSeriesPlayerNames([]);
            setConfig(null);
            setScreen("setup");
          } else {
            setScreen("setup");
          }
        }}
      />
    );
  }

  // ── GAME SCREEN ──
  const isPortrait = dimensions.height > dimensions.width;
  const cx = dimensions.width / 2;

  const portraitSvgHeight = Math.max(dimensions.height - 94, dimensions.width + 120);
  const cy = isPortrait ? portraitSvgHeight / 2 : dimensions.height / 2;
  // Clean alignment shift down so the clock wheel elements sit perfectly inside the viewport
  const cy = isPortrait ? (dimensions.width / 2) + 60 : dimensions.height / 2;
  const baseScale = Math.min(dimensions.width, dimensions.height);
  
  const centerR = baseScale * 0.24;
  const outerR = Math.max(dimensions.width, dimensions.height) * 2.0;
  const timeR = baseScale * 0.385;

  const n = aliveCount;
  const rotOffset = -Math.PI / 2;
  const dhappaFontSize = (centerR * 2 * 0.95) / 6;
  const timerFontSize = baseScale * (n <= 2 ? 0.19 : n <= 3 ? 0.15 : n <= 4 ? 0.125 : 0.1);
  const polyVerts = getPolygonPoints(cx, cy, centerR, n, rotOffset);

  // Dynamic ranking for the mini leaderboard during the round
  const liveRankedPlayers = [...players]
    .map(p => ({ ...p, pts: seriesScores[p.originalIdx] ?? 0 }))
    .sort((a, b) => b.pts - a.pts);

  // Calculate the portrait SVG size to ensure full backdrop coverage
  const portraitSvgHeight = Math.max(dimensions.height - 94, dimensions.width + 140);

  return (
    <div className="app-container" style={{position:"fixed",inset:0,zIndex:9999,background:"#050508",fontFamily:"'Courier New',monospace",userSelect:"none"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Quantico:ital,wght@0,400;0,700;1,400;1,700&display=swap');
<<<<<<< HEAD
=======
        
        /* Force container height properties to expand dynamically when portrait view overflows */
>>>>>>> parent of ce26a51 (updates 6)
        @media (orientation: portrait) {
          .app-container { overflow-y: auto !important; overflow-x: hidden !important; -webkit-overflow-scrolling: touch; }
          .clock-view-wrapper { position: relative !important; width: 100% !important; height: ${portraitSvgHeight}px !important; }
          .action-dashboard { position: relative !important; height: 100px !important; margin-top: 0 !important; }
        }
      `}</style>

      <div className="clock-view-wrapper" style={{position:"absolute",top:0,left:0,width:"100%",height:"calc(100% - 94px)",overflow:"hidden",background:"#050508"}}>
        {/* Top bar with ranked scores */}
        <div style={{position:"absolute",top:0,left:0,right:0,zIndex:20,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",boxSizing:"border-box"}}>
          <button onClick={()=>setScreen("setup")} style={{background:"#05050899",border:"1px solid #333",borderRadius:8,color:"#666",padding:"6px 14px",fontFamily:"'Courier New',monospace",fontSize:11,cursor:"pointer",letterSpacing:2,backdropFilter:"blur(4px)"}}>← SETUP</button>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            {/* Mini series scores - Ranked */}
            <div style={{display:"flex",gap:6,alignItems:"center", background: "#11111a", padding: "4px 8px", borderRadius: 8}}>
              {liveRankedPlayers.map((p, i) => (
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:p.color, border: i === 0 && p.pts > 0 ? "1px solid #FFD93D" : "none"}} />
                  <span style={{color:p.color,fontSize:9,fontWeight:900}}>{p.pts}</span>
                </div>
              ))}
            </div>
            <div style={{color: paused ? "#FFD93D" : "#FF6B6B", fontSize:11, letterSpacing:3}}>
              {!started ? "TAP TO START" : paused ? "PAUSED" : "● LIVE"}
            </div>
          </div>
        </div>

        <svg width="100%" height={isPortrait ? portraitSvgHeight : "100%"} viewBox={`0 0 ${dimensions.width} ${isPortrait ? portraitSvgHeight : dimensions.height}`} ref={svgRef} style={{display:"block"}}>
          <rect x={0} y={0} width={dimensions.width} height={isPortrait ? portraitSvgHeight : dimensions.height} fill="#050508" />

          {alivePlayers.map((player, i) => {
            const globalIdx = players.indexOf(player);
            const isActive = globalIdx === curGlobalIdx;
            const angle1 = (2 * Math.PI * i / n) + rotOffset;
            const angle2 = (2 * Math.PI * ((i + 1) % n) / n) + rotOffset;
            const x1 = cx + outerR * Math.cos(angle1);
            const y1 = cy + outerR * Math.sin(angle1);
            const x2 = cx + outerR * Math.cos(angle2);
            const y2 = cy + outerR * Math.sin(angle2);
            const xc1 = cx + centerR * Math.cos(angle1);
            const yc1 = cy + centerR * Math.sin(angle1);
            const xc2 = cx + centerR * Math.cos(angle2);
            const yc2 = cy + centerR * Math.sin(angle2);
            const largeArc = (1 / n) > 0.5 ? 1 : 0;
            const path = `M ${xc1} ${yc1} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${xc2} ${yc2} A ${centerR} ${centerR} 0 ${largeArc} 0 ${xc1} ${yc1} Z`;
            const pct = times[globalIdx] / config.secs;
            const isLow = pct < 0.2;
            const fillAlpha = isActive ? "ff" : "cc";
            const fillColor = isLow ? "#FF6B6B" : player.color;
            const isKickHighlight = highlightKick && globalIdx !== curGlobalIdx;
            return (
              <g key={globalIdx} onClick={() => {
                if (popup === "kick") { handleSelectKick(globalIdx); return; }
                if (globalIdx === curGlobalIdx && !popup) passToNext(globalIdx);
              }} style={{cursor: popup === "kick" ? "pointer" : globalIdx === curGlobalIdx ? "pointer" : "default"}}>
                <path d={path} fill={`${fillColor}${isKickHighlight ? "dd" : fillAlpha}`}
                  stroke={isActive ? `${fillColor}` : "#0f0f20"} strokeWidth={isActive ? 2 : 1}
                  style={{transition:"all .3s"}}
                />
                {(() => {
                  let a1 = angle1, a2 = angle2;
                  if (a2 < a1) a2 += 2 * Math.PI;
                  const midAngle = (a1 + a2) / 2;
                  const tx = cx + timeR * Math.cos(midAngle);
                  const ty = cy + timeR * Math.sin(midAngle);
                  const deg = (midAngle * 180 / Math.PI) - 90;
                  const t = times[globalIdx];
                  const dispColor = isLow ? "#3a0000" : player.vdark;
                  const scoreY = -timerFontSize * 0.75;
                  return (
                    <g transform={`translate(${tx},${ty}) rotate(${deg})`}>
                      <text textAnchor="middle" dominantBaseline="middle" fontSize={timerFontSize * 0.38} fontWeight={900} fill={isLow ? "#FF6B6B88" : `${player.color}88`} fontFamily="'Quantico', cursive" dy={scoreY}>
                        {seriesScores[globalIdx] ?? 0} pts
                      </text>
                      <text textAnchor="middle" dominantBaseline="middle" fontSize={timerFontSize} fontWeight={900} fill={dispColor} fontFamily="'Quantico', cursive" style={{letterSpacing:1}}>
                        {formatTime(t)}
                      </text>
                      {isKickHighlight && (
                        <text textAnchor="middle" dominantBaseline="middle" fontSize={baseScale * 0.022} fill="#FF6B6B" fontFamily="'Courier New',monospace" dy={baseScale * 0.06}>TAP TO KICK</text>
                      )}
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {polyVerts.map((pv, i) => {
            const edgeVert = getPolygonPoints(cx, cy, outerR, n, rotOffset)[i];
            return <line key={i} x1={pv[0]} y1={pv[1]} x2={edgeVert[0]} y2={edgeVert[1]} stroke="#050508" strokeWidth={3} />;
          })}

          <circle cx={cx} cy={cy} r={centerR} fill={centerHovered ? "#1e1e35" : "#0f0f20"} stroke={centerHovered ? "#FF6B6B55" : "none"} strokeWidth={2} onClick={handleDhappa} onMouseEnter={() => setCenterHovered(true)} onMouseLeave={() => setCenterHovered(false)} style={{cursor:"pointer", transition:"fill .15s, stroke .15s"}} />

          {(() => {
            if (!started) return null;
            const activePlayer = players[curGlobalIdx];
            if (!activePlayer) return null;
            const arcR = centerR - baseScale * 0.012;
            const halfSpanDeg = (360 / n) / 2 - 5;
            const halfSpanRad = halfSpanDeg * Math.PI / 180;
            const x1a = cx + arcR * Math.cos(-halfSpanRad);
            const y1a = cy + arcR * Math.sin(-halfSpanRad);
            const x2a = cx + arcR * Math.cos(halfSpanRad);
            const y2a = cy + arcR * Math.sin(halfSpanRad);
            return (
              <path d={`M ${x1a} ${y1a} A ${arcR} ${arcR} 0 0 1 ${x2a} ${y2a}`}
                fill="none" stroke={activePlayer.color} strokeWidth={baseScale * 0.018} strokeLinecap="round"
                style={{transformOrigin:`${cx}px ${cy}px`,transform:`rotate(${arcRotation}deg)`,transition:"transform .35s cubic-bezier(.4,0,.2,1)"}}
              />
            );
          })()}

          <defs>
            {alivePlayers.map((player, i) => {
              const a1 = (2 * Math.PI * i / n) + rotOffset;
              const a2 = (2 * Math.PI * ((i + 1) % n) / n) + rotOffset;
              let sa = a1, ea = a2;
              if (ea < sa) ea += 2 * Math.PI;
              const mid = (sa + ea) / 2;
              const halfArc = Math.PI * 0.18;
              const arcA1 = mid - halfArc;
              const arcA2 = mid + halfArc;
              const nr = centerR + baseScale * 0.008;
              const sx = cx + nr * Math.cos(arcA1);
              const sy = cy + nr * Math.sin(arcA1);
              const ex = cx + nr * Math.cos(arcA2);
              const ey = cy + nr * Math.sin(arcA2);
              return <path key={`namepath-${i}`} id={`namepath-${i}`} d={`M ${sx} ${sy} A ${nr} ${nr} 0 0 1 ${ex} ${ey}`} fill="none" />;
            })}
          </defs>

          {alivePlayers.map((player, i) => (
            <text key={`name-${i}`} fontFamily="'Quantico', sans-serif" fontSize={baseScale * 0.024} fontWeight={700} fill="#000000" style={{letterSpacing:"1px"}}>
              <textPath href={`#namepath-${i}`} startOffset="50%" textAnchor="middle">
                {player.name.toUpperCase()}
              </textPath>
            </text>
          ))}

          {/* Dynamic Points text underneath DHAPPA */}
          <text x={cx} y={cy - dhappaFontSize * 0.15} textAnchor="middle" dominantBaseline="middle" fontSize={dhappaFontSize} fontWeight={900} fill={centerHovered ? "#ff9999" : "#FF6B6B"} fontFamily="'Courier New',monospace" onClick={handleDhappa} onMouseEnter={() => setCenterHovered(true)} onMouseLeave={() => setCenterHovered(false)} style={{cursor:"pointer",letterSpacing:2,transition:"fill .15s"}}>
            DHAPPA
          </text>
          <text x={cx} y={cy + dhappaFontSize * 0.85} textAnchor="middle" dominantBaseline="middle" fontSize={dhappaFontSize * 0.3} fontWeight={700} fill={centerHovered ? "#ff9999" : "#FF6B6B"} fontFamily="'Courier New',monospace" onClick={handleDhappa} onMouseEnter={() => setCenterHovered(true)} onMouseLeave={() => setCenterHovered(false)} style={{cursor:"pointer",letterSpacing:1,transition:"fill .15s", opacity: 0.8}}>
            BONUS +{DHAPPA_POINTS} PTS
          </text>
        </svg>

        {popup === "dhappa" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#050508cc",zIndex:100}}>
            <div style={{background:"#0a0a14",border:"1px solid #FF6B6B44",borderRadius:24,padding:36,textAlign:"center",width:300}}>
              <div style={{color:"#FF6B6B",fontSize:28,fontWeight:900,letterSpacing:3,marginBottom:4}}>DHAPPA!</div>
              <div style={{color:"#444",fontSize:11,letterSpacing:2,marginBottom:6}}>CHOOSE YOUR MOVE</div>
              <div style={{color:"#FF6B6B",fontSize:11,marginBottom:22,letterSpacing:1}}>+{DHAPPA_POINTS} pts bonus for calling DHAPPA</div>
              
              <button onClick={handleIWon} style={{width:"100%",padding:"16px 0",borderRadius:12,background:"#6BCB7722",border:"1px solid #6BCB77",color:"#6BCB77",fontFamily:"'Courier New',monospace",fontSize:14,fontWeight:900,cursor:"pointer",marginBottom:12,letterSpacing:1}}>
                I WON 🏆  (+{getPointsForPosition(0, config.n) + DHAPPA_POINTS} pts)
              </button>
              
              <button onClick={handleKickSomeone} style={{width:"100%",padding:"16px 0",borderRadius:12,background:"#FF6B6B22",border:"1px solid #FF6B6B",color:"#FF6B6B",fontFamily:"'Courier New',monospace",fontSize:14,fontWeight:900,cursor:"pointer",marginBottom:18,letterSpacing:1}}>
                KICK SOMEONE 💀  (+{DHAPPA_POINTS} pts)
              </button>
              
              <button onClick={handleCancelDhappa} style={{width:"100%",padding:"10px 0",borderRadius:10,background:"none",border:"1px solid #333",color:"#555",fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:900,cursor:"pointer",letterSpacing:2}}>CANCEL</button>
            </div>
          </div>
        )}

        {popup === "kick" && (
          <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",background:"#0a0a14",border:"1px solid #FF6B6B44",borderRadius:12,padding:"10px 16px",width:"80%",maxWidth:340,textAlign:"center",zIndex:100}}>
            <div style={{color:"#FF6B6B",fontSize:11,letterSpacing:3,marginBottom:6}}>TAP A PLAYER TO KICK (+{DHAPPA_POINTS} PTS)</div>
            <button onClick={handleCancelDhappa} style={{width:"100%",padding:"8px 0",borderRadius:8,background:"none",border:"1px solid #333",color:"#555",fontFamily:"'Courier New',monospace",fontSize:11,fontWeight:900,cursor:"pointer",letterSpacing:2}}>CANCEL</button>
          </div>
        )}

        {popup === "confirmKick" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#050508cc",zIndex:100}}>
            <div style={{background:"#0a0a14",border:"1px solid #FF6B6B44",borderRadius:24,padding:36,textAlign:"center",width:280}}>
              <div style={{color:"#FF6B6B",fontSize:15,fontWeight:900,letterSpacing:2,marginBottom:8}}>KICK OUT</div>
              <div style={{color:"#fff",fontSize:22,fontWeight:900,marginBottom:24}}>{kickTarget !== null ? players[kickTarget]?.name : ""}?</div>
              <button onClick={handleConfirmKick} style={{width:"100%",padding:"16px 0",borderRadius:12,background:"#FF6B6B",border:"none",color:"#fff",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,cursor:"pointer",marginBottom:12}}>CONFIRM 💀</button>
              <button onClick={handleCancelDhappa} style={{width:"100%",padding:"10px 0",borderRadius:10,background:"none",border:"1px solid #333",color:"#555",fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:900,cursor:"pointer",letterSpacing:2}}>CANCEL</button>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Action Dashboard */}
      <div className="action-dashboard" style={{position:"absolute",bottom:0,left:0,right:0,height:94,display:"flex",gap:12,padding:"14px 20px 24px",boxSizing:"border-box",background:"#050508",borderTop:"1px solid #111"}}>
        <button onClick={() => {
          if (!started) { setStarted(true); setPaused(false); return; }
          passToNext(curGlobalIdx);
        }} disabled={!!winner}
          style={{flex:2,padding:"0",borderRadius:14,background: started ? `${players[curGlobalIdx]?.color ?? '#FF6B6B'}22` : "#FF6B6B22",border:`2px solid ${players[curGlobalIdx]?.color ?? '#FF6B6B'}`,color:players[curGlobalIdx]?.color ?? '#FF6B6B',fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,cursor:"pointer",letterSpacing:2}}>
          {started ? "PASS →" : "START / PASS →"}
        </button>
        <button onClick={() => { if(started) setPaused(p=>!p); }}
          disabled={!started || !!winner}
          style={{flex:1,padding:"0",borderRadius:14,background:paused?"#FFD93D22":"#0a0a14",border:`2px solid ${paused?"#FFD93D":"#222"}`,color:paused?"#FFD93D":"#444",fontFamily:"'Courier New',monospace",fontSize:13,fontWeight:900,cursor:"pointer",letterSpacing:1}}>
          {paused?"▶ GO":"⏸ PAUSE"}
        </button>
      </div>
    </div>
  );
}