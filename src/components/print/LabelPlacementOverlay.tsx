import React, {useRef} from "react";
import type {LabelPlacement} from "./menuPosterDesigns";

// Pegangan yang bisa digeser di atas pratinjau: kotak bernomor untuk nama hidangan, bulatan untuk pangkal panah
// (titik makanan di foto). Bisa dengan mouse, sentuhan, atau tombol panah keyboard (Shift untuk langkah besar).
// view adalah bagian poster yang sedang tampil di bawah overlay.
export const LabelPlacementOverlay: React.FC<{
  view: {x: number; y: number; w: number; h: number};
  texts: string[];
  placements: LabelPlacement[];
  onChange: (next: LabelPlacement[]) => void;
}> = ({view, texts, placements, onChange}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{index: number; part: "label" | "tip"} | null>(null);

  const move = (index: number, part: "label" | "tip", x: number, y: number) => {
    const cx = Math.min(view.x + view.w, Math.max(view.x, Math.round(x)));
    const cy = Math.min(view.y + view.h, Math.max(view.y, Math.round(y)));
    onChange(placements.map((p, i) => (i !== index ? p : part === "label" ? {...p, x: cx, y: cy} : {...p, tipX: cx, tipY: cy})));
  };

  const toPoster = (e: React.PointerEvent) => {
    const rect = boxRef.current!.getBoundingClientRect();
    return [view.x + ((e.clientX - rect.left) / rect.width) * view.w, view.y + ((e.clientY - rect.top) / rect.height) * view.h] as const;
  };

  const handlers = (index: number, part: "label" | "tip") => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = {index, part};
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (drag.current?.index !== index || drag.current.part !== part) return;
      const [x, y] = toPoster(e);
      move(index, part, x, y);
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const step = e.shiftKey ? 60 : 15;
      const d = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]}[e.key];
      if (!d) return;
      e.preventDefault();
      const p = placements[index];
      if (part === "label") move(index, part, p.x + d[0], p.y + d[1]);
      else move(index, part, p.tipX + d[0], p.tipY + d[1]);
    },
  });

  const pos = (x: number, y: number) => ({left: `${((x - view.x) / view.w) * 100}%`, top: `${((y - view.y) / view.h) * 100}%`});

  return (
    <div ref={boxRef} className="absolute inset-0 no-print touch-none select-none">
      {placements.map((p, i) => (
        <React.Fragment key={i}>
          <button
            type="button"
            {...handlers(i, "tip")}
            aria-label={`Pangkal panah ${texts[i]}. Geser ke makanannya, atau pakai tombol panah.`}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 pointer-coarse:w-9 pointer-coarse:h-9 rounded-full bg-amber-300 border-2 border-white shadow cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
            style={pos(p.tipX, p.tipY)}
          >
            <span className="text-[10px] font-bold text-slate-900">{i + 1}</span>
          </button>
          <button
            type="button"
            {...handlers(i, "label")}
            aria-label={`Nama ${texts[i]}. Geser ke tempat yang kosong, atau pakai tombol panah.`}
            className="absolute -translate-x-1/2 -translate-y-1/2 max-w-[30%] px-2 min-h-[28px] pointer-coarse:min-h-[44px] rounded-md bg-white/90 border-2 border-amber-400 text-[11px] font-semibold text-slate-900 truncate shadow cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
            style={pos(p.x, p.y)}
          >
            {i + 1}. {texts[i]}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
