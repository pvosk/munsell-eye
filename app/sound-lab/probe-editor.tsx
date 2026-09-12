import { useRef } from "react";
import {
  moveProbePoint,
  clamp,
  type Journey,
  type ColorSample,
} from "./journey";
const wrap = (h: number) => ((h % 360) + 360) % 360;
const xy = (h: number, l: number) =>
  [30 + (wrap(h) / 360) * 540, 210 - clamp(l) * 180].map(
    (v) => Math.round(v * 1000) / 1000,
  );
export function ProbeEditor({
  journey,
  onChange,
  samples,
  progress,
}: {
  journey: Journey;
  onChange: (j: Partial<Journey>) => void;
  samples: ColorSample[];
  progress: number;
}) {
  const svg = useRef<SVGSVGElement>(null),
    drag = useRef<"start" | "land" | "target" | null>(null);
  const p = journey.probe,
    endH = p.hue + p.hueTravel,
    endL = clamp(p.lightness + p.lift, 0.04, 0.96);
  const target =
    journey.outcome === "capture"
      ? { hue: endH, lightness: endL, edge: p.edgeEnd }
      : (journey.target ?? {
          hue: wrap(endH + 25),
          lightness: clamp(endL + 0.1, 0.04, 0.96),
          edge: p.edgeEnd,
        });
  const setPoint = (id: "start" | "land" | "target", h: number, l: number) =>
    onChange(moveProbePoint(journey, id, h, l));
  const move = (x: number, y: number) => {
    const rect = svg.current!.getBoundingClientRect();
    const sx = ((x - rect.left) * 600) / rect.width,
      sy = ((y - rect.top) * 240) / rect.height;
    if (drag.current)
      setPoint(
        drag.current,
        clamp((sx - 30) / 540) * 360,
        clamp((210 - sy) / 180, 0.04, 0.96),
      );
  };
  const marks = [
    {
      id: "start" as const,
      h: p.hue,
      l: p.lightness,
      label: "Start",
      color: "#e7d7a4",
    },
    {
      id: "land" as const,
      h: endH,
      l: endL,
      label: journey.outcome === "capture" ? "Landing + target" : "Landing",
      color: "#9dd9c7",
    },
    ...(journey.outcome === "miss"
      ? [
          {
            id: "target" as const,
            h: target.hue,
            l: target.lightness,
            label: "Target",
            color: "#dda1d2",
          },
        ]
      : []),
  ];
  const current =
    samples[
      Math.min(samples.length - 1, Math.floor(progress * (samples.length - 1)))
    ];
  return (
    <div className="sl-probe-editor">
      <div className="sl-button-row">
        <label className="sl-toggle">
          <input
            type="checkbox"
            checked={journey.outcome === "capture"}
            onChange={(e) =>
              onChange({
                outcome: e.target.checked ? "capture" : "miss",
                target: journey.target ?? {
                  hue: wrap(endH + 25),
                  lightness: clamp(endL + 0.1, 0.04, 0.96),
                  edge: p.edgeEnd,
                },
              })
            }
          />
          Made shot · landing joins target
        </label>
      </div>
      <svg
        ref={svg}
        viewBox="0 0 600 240"
        className="sl-editable-trace"
        aria-label="Editable hue and value shot map"
        onPointerMove={(e) => {
          if (drag.current) move(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <linearGradient id="sl-hue-map">
            {[0, 60, 120, 180, 240, 300, 360].map((h) => (
              <stop
                key={h}
                offset={`${h / 3.6}%`}
                stopColor={`hsl(${h} 65% 45%)`}
              />
            ))}
          </linearGradient>
        </defs>
        <rect
          x="30"
          y="30"
          width="540"
          height="180"
          fill="url(#sl-hue-map)"
          opacity=".15"
          rx="12"
        />
        {[0.25, 0.5, 0.75].map((l) => (
          <line
            key={l}
            x1="30"
            x2="570"
            y1={210 - l * 180}
            y2={210 - l * 180}
            stroke="#ffffff16"
          />
        ))}
        {samples.slice(1).map((c, i) => {
          const a = xy(samples[i].h, samples[i].l),
            b = xy(c.h, c.l);
          return Math.abs(a[0] - b[0]) > 270 ? null : (
            <line
              key={i}
              x1={a[0]}
              y1={a[1]}
              x2={b[0]}
              y2={b[1]}
              stroke={`rgb(${c.rgb.map(Math.round).join(" ")})`}
              strokeWidth="3"
            />
          );
        })}
        {marks.map((m) => {
          const [x, y] = xy(m.h, m.l);
          return (
            <g
              key={m.id}
              role="slider"
              aria-label={`${m.label}: drag hue/value or use arrow keys`}
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={Math.round(wrap(m.h))}
              aria-valuetext={`Hue ${Math.round(wrap(m.h))}, value ${m.l.toFixed(2)}`}
              tabIndex={0}
              onPointerDown={(e) => {
                e.preventDefault();
                drag.current = m.id;
                svg.current!.setPointerCapture(e.pointerId);
              }}
              onKeyDown={(e) => {
                if (
                  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  setPoint(
                    m.id,
                    wrap(
                      m.h +
                        (e.key === "ArrowLeft"
                          ? -3
                          : e.key === "ArrowRight"
                            ? 3
                            : 0),
                    ),
                    clamp(
                      m.l +
                        (e.key === "ArrowUp"
                          ? 0.02
                          : e.key === "ArrowDown"
                            ? -0.02
                            : 0),
                      0.04,
                      0.96,
                    ),
                  );
                }
              }}
              style={{ cursor: "grab" }}
            >
              <circle
                cx={x}
                cy={y}
                r="18"
                fill="#182327"
                stroke={m.color}
                strokeWidth="3"
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fill={m.color}
                fontSize="11"
              >
                {m.id === "start" ? "S" : m.id === "land" ? "L" : "T"}
              </text>
              <text
                x={clamp(x, 65, 520)}
                y={y > 60 ? y - 24 : y + 32}
                fill={m.color}
                textAnchor="middle"
                fontSize="12"
              >
                {m.label}
              </text>
            </g>
          );
        })}
        <circle
          cx={xy(current.h, current.l)[0]}
          cy={xy(current.h, current.l)[1]}
          r="5"
          fill="white"
          pointerEvents="none"
        />
        <text x="30" y="232" fill="#b4c7c4" fontSize="12">
          Hue → · value ↑ · drag S / L / T · hue wraps at the edges
        </text>
      </svg>
      <div className="sl-grid-3">
        {[
          ["Start chroma", p.edge, "edge"],
          ["Landing chroma", p.edgeEnd, "edgeEnd"],
        ].map(([label, value, key]) => (
          <label key={String(key)}>
            {label} · {Math.round(Number(value) * 100)}%
            <input
              type="range"
              min="0"
              max="1"
              step=".01"
              value={Number(value)}
              onChange={(e) =>
                onChange({
                  probe: { ...p, [String(key)]: Number(e.target.value) },
                })
              }
            />
          </label>
        ))}
        {journey.outcome === "miss" && (
          <label>
            Target chroma · {Math.round(target.edge * 100)}%
            <input
              type="range"
              min="0"
              max="1"
              step=".01"
              value={target.edge}
              onChange={(e) =>
                onChange({
                  target: { ...target, edge: Number(e.target.value) },
                })
              }
            />
          </label>
        )}
      </div>
      <p>
        Chroma is a fraction of the sRGB boundary at that hue/value. This is an
        editable audition sketch; Made shot controls capture. Paint traces still
        use the game’s endpoint scoring.
      </p>
    </div>
  );
}
