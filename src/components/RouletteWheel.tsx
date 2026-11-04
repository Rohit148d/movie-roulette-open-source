import { Poster } from "@/components/Poster";

interface RouletteWheelProps {
  spinning: boolean;
  posterUrl: string | null;
  title: string | null;
}

const HOLES = Array.from({ length: 8 }, (_, index) => {
  const angle = (index * Math.PI) / 4;
  return {
    x: 200 + Math.cos(angle) * 118,
    y: 200 + Math.sin(angle) * 118,
  };
});

export function RouletteWheel({ spinning, posterUrl, title }: RouletteWheelProps) {
  return (
    <div className={`reel-stage-art ${spinning ? "is-spinning" : ""}`} aria-hidden="true">
      <div className="reel-glow" />
      <div className="reel-orbit" />
      <div className="reel-orbit reel-orbit-outer" />
      <svg className="reel-art" viewBox="0 0 400 400" role="presentation" focusable="false">
        <defs>
          <radialGradient id="reelMetal" cx="35%" cy="25%" r="85%">
            <stop offset="0%" stopColor="#f7d79b" />
            <stop offset="28%" stopColor="#c4924c" />
            <stop offset="62%" stopColor="#6e4b22" />
            <stop offset="100%" stopColor="#21170c" />
          </radialGradient>
          <radialGradient id="reelInner" cx="40%" cy="35%" r="80%">
            <stop offset="0%" stopColor="#17151a" />
            <stop offset="100%" stopColor="#08080b" />
          </radialGradient>
          <radialGradient id="reelHub" cx="35%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#2a2117" />
            <stop offset="100%" stopColor="#0a0908" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="196" fill="url(#reelMetal)" opacity="0.94" />
        <circle cx="200" cy="200" r="186" fill="#0b0a09" />
        <circle cx="200" cy="200" r="176" fill="url(#reelMetal)" opacity="0.55" />
        <circle cx="200" cy="200" r="166" fill="url(#reelInner)" />
        {HOLES.map((hole, index) => (
          <g key={index}>
            <circle cx={hole.x} cy={hole.y} r="29" fill="#050507" />
            <circle
              cx={hole.x}
              cy={hole.y}
              r="29"
              fill="none"
              stroke="#e8b86d"
              strokeOpacity="0.16"
            />
          </g>
        ))}
        <circle cx="200" cy="200" r="86" fill="url(#reelHub)" stroke="#e8b86d" strokeOpacity="0.28" />
        {Array.from({ length: 60 }, (_, index) => {
          const angle = (index * Math.PI) / 30;
          const x1 = 200 + Math.cos(angle) * 168;
          const y1 = 200 + Math.sin(angle) * 168;
          const x2 = 200 + Math.cos(angle) * 174;
          const y2 = 200 + Math.sin(angle) * 174;
          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#e8b86d"
              strokeOpacity={index % 5 === 0 ? 0.5 : 0.18}
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <div className="reel-hub">
        {posterUrl && title ? (
          <Poster src={posterUrl} title={title} className="reel-hub-poster" />
        ) : (
          <span className="reel-hub-mark">MR</span>
        )}
      </div>
      <div className="reel-spark reel-spark-a" />
      <div className="reel-spark reel-spark-b" />
    </div>
  );
}
