import type { CSSProperties } from "react";
const particles = [
  [7,12,3,24,-4],[23,38,2,29,-12],[42,8,3,26,-8],
  [68,25,2,31,-18],[87,13,3,25,-6],[95,47,2,28,-15],
  [12,73,2,30,-9],[34,89,3,27,-21],[55,64,2,32,-17],
  [77,82,3,29,-11],[92,94,2,26,-23],[62,43,2,33,-14],
];
/** Decorative CSS particles: no canvas, animation loop, or layout measurement. */
export function WorkspaceParticles() {
 return <div className="workspace-particles" aria-hidden="true">{particles.map(([x,y,size,duration,delay],index)=><span key={index} style={{left:`${x}%`,top:`${y}%`,width:size,height:size,"--particle-duration":`${duration}s`,"--particle-delay":`${delay}s`} as CSSProperties}/>)}</div>;
}
