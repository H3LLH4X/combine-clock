import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF9F1C"];
const DARK =   ["#cc2222","#cc9900","#1e8c3a","#1155cc","#7722cc","#cc5500"];
const VDARK =  ["#3a0000","#3a2800","#003a10","#00103a","#1a003a","#3a1500"];

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

function SetupScreen({ onStart }) {
  const [n, setN] = useState(3);
  const [mins, setMins] = useState(5);
  const [names, setNames] = useState(["Player 1","Player 2","Player 3","Player 4","Player 5","Player 6"]);
  return (
    <div style={{width:"100%",height:"100%",background:"#050508",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace",padding:"2rem",boxSizing:"border-box"}}>
      <div style={{width:"100%",maxWidth:440}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:48,letterSpacing:4,color:"#fff",fontWeight:900}}>DHAPPA</div>
          <div style={{color:"#555",fontSize:12,letterSpacing:6,marginTop:4}}>MULTIPLAYER CLOCK</div>
        </div>
        <div style={{background:"#0a0a14",border:"1px solid #222",borderRadius:16,padding:28}}>
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
          <div style={{marginBottom:24}}>
            <div style={{color:"#555",fontSize:11,letterSpacing:3,marginBottom:10}}>NAMES</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {Array.from({length:n},(_,i)=>(
                <input key={i} value={names[i]} onChange={e=>setNames(arr=>arr.map((v,j)=>j===i?e.target.value:v))} style={{background:"#050508",border:`1px solid ${COLORS[i]}55`,borderLeft:`3px solid ${COLORS[i]}`,borderRadius:6,padding:"8px 10px",color:COLORS[i],fontFamily:"'Courier New',monospace",fontSize:13,outline:"none"}} />
              ))}
            </div>
          </div>
          <button onClick={()=>onStart({n,secs:mins*60,names:names.slice(0,n)})} style={{width:"100%",padding:14,borderRadius:12,background:"#FF6B6B",border:"none",color:"#fff",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,letterSpacing:2,cursor:"pointer"}}>START →</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [players, setPlayers] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [times, setTimes] = useState([]);
  const [paused, setPaused] = useState(true);
  const [started, setFalse] = useState(false);

  const [popup, setPopup] = useState(null); 
  const [kickTarget, setKickTarget] = useState(null);
  const [winner, setWinner] = useState(null);
  const [highlightKick, setHighlightKick] = useState(false);
  const intervalRef = useRef(null);
  const svgRef = useRef(null);
  
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const arcRotationRef = useRef(0); 
  const [arcRotation, setArcRotation] = useState(0);
  const [centerHovered, setCenterHovered] = useState(false);

  useEffect(() => {
    const update = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const startGame = useCallback(({n, secs, names}) => {
    const ps = names.map((name, i) => ({name, color: COLORS[i], dark: DARK[i], vdark: VDARK[i], alive: true, originalIdx: i}));
    setPlayers(ps);
    setTimes(Array(n).fill(secs));
    setActiveIdx(0);
    setPaused(true);
    setFalse(false);
    setWinner(null);
    setPopup(null);
    setConfig({n, secs, names});
  }, []);

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
    if (!started) { setFalse(true); setPaused(false); return; }
    if (paused || winner || popup) return;
    const alive = players.reduce((acc, p, i) => p.alive ? [...acc, i] : acc, []);
    if (alive.length <= 1) return;
    const curPos = alive.indexOf(fromGlobal ?? curGlobalIdx);
    const nextPos = (curPos - 1 + alive.length) % alive.length;
    setActiveIdx(nextPos);
  }, [started, paused, winner, popup, players, curGlobalIdx]);

  const kickPlayer = useCallback((globalIdx) => {
    setPlayers(prev => {
      const next = prev.map((p, i) => i === globalIdx ? {...p, alive: false} : p);
      const stillAlive = next.filter(p => p.alive);
      if (stillAlive.length === 1) {
        setWinner(stillAlive[0].name);
        clearInterval(intervalRef.current);
      } else if (stillAlive.length === 0) {
        setWinner("Nobody");
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
  }, []);

  const handleDhappa = () => {
    setPaused(true);
    setPopup("dhappa");
  };

  const handleIWon = () => {
    kickPlayer(curGlobalIdx);
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
    kickPlayer(kickTarget);
  };

  const handleCancelDhappa = () => {
    setPopup(null);
    setHighlightKick(false);
    setKickTarget(null);
    setPaused(false);
  };

  if (!config) return <SetupScreen onStart={startGame} />;

  const cx = dimensions.width / 2;
  const cy = dimensions.height / 2;
  const baseScale = Math.min(dimensions.width, dimensions.height);
  
  const centerR = baseScale * 0.24;
  // Make outer radius massive so it bleeds completely past screens corners smoothly
  const outerR = Math.max(dimensions.width, dimensions.height) * 1.5; 
  const timeR = baseScale * 0.385;

  const n = aliveCount;
  const rotOffset = -Math.PI / 2;

  const dhappaFontSize = (centerR * 2 * 0.95) / 6;
  const timerFontSize = baseScale * (n <= 2 ? 0.19 : n <= 3 ? 0.15 : n <= 4 ? 0.125 : 0.1);

  const polyVerts = getPolygonPoints(cx, cy, centerR, n, rotOffset);

  if (winner) {
    return (
      <div style={{width:"100%",height:"100%",background:"#050508",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Courier New',monospace"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:80,marginBottom:16}}>💀</div>
          <div style={{color:"#555",fontSize:13,letterSpacing:4,marginBottom:8}}>LAST PLAYER STANDING</div>
          <div style={{color:"#fff",fontSize:36,fontWeight:900,letterSpacing:2}}>{winner}</div>
          <div style={{color:"#FF6B6B",fontSize:14,marginTop:8,letterSpacing:2}}>LOST</div>
          <button onClick={()=>setConfig(null)} style={{marginTop:32,background:"#FF6B6B",border:"none",borderRadius:12,color:"#fff",fontFamily:"'Courier New',monospace",fontSize:14,fontWeight:900,padding:"12px 28px",cursor:"pointer",letterSpacing:2}}>PLAY AGAIN</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{width:"100%",height:"100%",background:"#050508",fontFamily:"'Courier New',monospace",userSelect:"none",overflow:"hidden",position:"relative"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Quantico&display=swap');`}</style>

      {/* Main Clock Area */}
      <div style={{position:"absolute",top:0,left:0,width:"100%",height:"calc(100% - 94px)",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,zIndex:20,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",boxSizing:"border-box"}}>
          <button onClick={()=>setConfig(null)} style={{background:"#05050899",border:"1px solid #333",borderRadius:8,color:"#666",padding:"6px 14px",fontFamily:"'Courier New',monospace",fontSize:11,cursor:"pointer",letterSpacing:2,backdropFilter:"blur(4px)"}}>← SETUP</button>
          <div style={{color: paused ? "#FFD93D" : "#FF6B6B", fontSize:11, letterSpacing:3}}>
            {!started ? "TAP TO START" : paused ? "PAUSED" : "● LIVE"}
          </div>
        </div>

        <svg width="100%" height="100%" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} ref={svgRef} style={{display:"block"}}>
          <rect x={0} y={0} width={dimensions.width} height={dimensions.height} fill="#050508" />

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
                  return (
                    <g transform={`translate(${tx},${ty}) rotate(${deg})`}>
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
              <path
                d={`M ${x1a} ${y1a} A ${arcR} ${arcR} 0 0 1 ${x2a} ${y2a}`}
                fill="none"
                stroke={activePlayer.color}
                strokeWidth={baseScale * 0.018}
                strokeLinecap="round"
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: `rotate(${arcRotation}deg)`,
                  transition: "transform .35s cubic-bezier(.4,0,.2,1)",
                }}
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
              return (
                <path key={`namepath-${i}`} id={`namepath-${i}`}
                  d={`M ${sx} ${sy} A ${nr} ${nr} 0 0 1 ${ex} ${ey}`}
                  fill="none" />
              );
            })}
          </defs>
          {alivePlayers.map((player, i) => {
            const globalIdx = players.indexOf(player);
            const isActive = globalIdx === curGlobalIdx;
            const fillColor = player.color;
            return (
              <text key={`name-${i}`} fontFamily="'Courier New',monospace" fontSize={baseScale * 0.022} fontWeight={900} fill={isActive ? "#fff" : fillColor}>
                <textPath href={`#namepath-${i}`} startOffset="50%" textAnchor="middle">
                  {player.name}
                </textPath>
              </text>
            );
          })}

          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={dhappaFontSize} fontWeight={900} fill={centerHovered ? "#ff9999" : "#FF6B6B"} fontFamily="'Courier New',monospace" onClick={handleDhappa} onMouseEnter={() => setCenterHovered(true)} onMouseLeave={() => setCenterHovered(false)} style={{cursor:"pointer",letterSpacing:2,transition:"fill .15s"}}>
            DHAPPA
          </text>
        </svg>

        {popup === "dhappa" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#050508cc"}}>
            <div style={{background:"#0a0a14",border:"1px solid #FF6B6B44",borderRadius:24,padding:36,textAlign:"center",width:280}}>
              <div style={{color:"#FF6B6B",fontSize:28,fontWeight:900,letterSpacing:3,marginBottom:6}}>DHAPPA!</div>
              <div style={{color:"#444",fontSize:12,letterSpacing:2,marginBottom:26}}>CHOOSE YOUR MOVE</div>
              <button onClick={handleIWon} style={{width:"100%",padding:"16px 0",borderRadius:12,background:"#6BCB7722",border:"1px solid #6BCB77",color:"#6BCB77",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,cursor:"pointer",marginBottom:12,letterSpacing:1}}>I WON 🏆</button>
              <button onClick={handleKickSomeone} style={{width:"100%",padding:"16px 0",borderRadius:12,background:"#FF6B6B22",border:"1px solid #FF6B6B",color:"#FF6B6B",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,cursor:"pointer",marginBottom:18,letterSpacing:1}}>KICK SOMEONE 💀</button>
              <button onClick={handleCancelDhappa} style={{width:"100%",padding:"10px 0",borderRadius:10,background:"none",border:"1px solid #333",color:"#555",fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:900,cursor:"pointer",letterSpacing:2}}>CANCEL</button>
            </div>
          </div>
        )}

        {popup === "kick" && (
          <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",background:"#0a0a14",border:"1px solid #FF6B6B44",borderRadius:12,padding:"10px 16px",width:"80%",maxWidth:340,textAlign:"center",zIndex:10}}>
            <div style={{color:"#FF6B6B",fontSize:11,letterSpacing:3,marginBottom:6}}>TAP A PLAYER TO KICK</div>
            <button onClick={handleCancelDhappa} style={{width:"100%",padding:"8px 0",borderRadius:8,background:"none",border:"1px solid #333",color:"#555",fontFamily:"'Courier New',monospace",fontSize:11,fontWeight:900,cursor:"pointer",letterSpacing:2}}>CANCEL</button>
          </div>
        )}

        {popup === "confirmKick" && (
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#050508cc"}}>
            <div style={{background:"#0a0a14",border:"1px solid #FF6B6B44",borderRadius:24,padding:36,textAlign:"center",width:280}}>
              <div style={{color:"#FF6B6B",fontSize:15,fontWeight:900,letterSpacing:2,marginBottom:8}}>KICK OUT</div>
              <div style={{color:"#fff",fontSize:22,fontWeight:900,marginBottom:24}}>{kickTarget !== null ? players[kickTarget]?.name : ""}?</div>
              <button onClick={handleConfirmKick} style={{width:"100%",padding:"16px 0",borderRadius:12,background:"#FF6B6B",border:"none",color:"#fff",fontFamily:"'Courier New',monospace",fontSize:15,fontWeight:900,cursor:"pointer",marginBottom:12}}>CONFIRM 💀</button>
              <button onClick={handleCancelDhappa} style={{width:"100%",padding:"10px 0",borderRadius:10,background:"none",border:"1px solid #333",color:"#555",fontFamily:"'Courier New',monospace",fontSize:12,fontWeight:900,cursor:"pointer",letterSpacing:2}}>CANCEL</button>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Action Dashboard at the base screen layer */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:94,display:"flex",gap:12,padding:"14px 20px 24px",boxSizing:"border-box",background:"#050508",borderTop:"1px solid #111"}}>
        <button onClick={() => {
          if (!started) { setFalse(true); setPaused(false); return; }
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