import React from "react";
import {FIELD_INPUT} from "../common/FormDialog";
import {shownLabel, type LabelPlacement} from "./menuPosterDesigns";

// Ganti nama yang tampil di samping ompreng tanpa mengubah daftar hidangan. Nomor bulat kuning sama dengan
// bulatan pangkal panah di pratinjau, jadi petugas tahu kolom mana untuk makanan mana.
export const LabelNameFields: React.FC<{
  idPrefix: string;
  /** Nama asli dari daftar hidangan, per urutan label. */
  texts: string[];
  placements: LabelPlacement[];
  onChange: (next: LabelPlacement[]) => void;
}> = ({idPrefix, texts, placements, onChange}) => {
  const setLabel = (index: number, value: string) =>
    onChange(
      placements.map((p, i) => {
        if (i !== index) return p;
        const {label: _label, labelFor: _labelFor, ...rest} = p;
        return value.trim() ? {...rest, label: value, labelFor: texts[i]} : rest;
      })
    );

  return (
    <fieldset className="mt-3 no-print">
      <legend className="text-xs font-semibold text-slate-800">Nama yang tampil</legend>
      <p className="text-[11px] text-slate-600 mb-2">Kosongkan untuk memakai nama dari daftar hidangan.</p>
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {texts.map((text, i) => {
          const p = placements[i];
          const custom = p && shownLabel(text, p) !== text ? p.label ?? "" : "";
          const id = `${idPrefix}-label-${i}`;
          return (
            <li key={i} className="flex items-center gap-2">
              <label
                htmlFor={id}
                className="w-6 h-6 rounded-full bg-amber-300 text-[11px] font-bold text-slate-900 flex items-center justify-center shrink-0"
              >
                <span className="sr-only">Nama label </span>
                {i + 1}
              </label>
              <input id={id} type="text" value={custom} maxLength={80} placeholder={text} onChange={(e) => setLabel(i, e.target.value)} className={FIELD_INPUT} />
            </li>
          );
        })}
      </ol>
    </fieldset>
  );
};
