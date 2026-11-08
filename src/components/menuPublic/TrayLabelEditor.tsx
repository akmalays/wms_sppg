import React, { useMemo, useState } from 'react';
import trayImg1 from '../../assets/tray_sample_1.jpg';
import trayCutoutImg from '../../assets/tray_sample_cutout.webp';
import type { WebsiteMenuTodayConfig } from '../../db/websiteConfigStorage';
import { BTN_PRIMARY, BTN_SECONDARY } from '../common/FormDialog';
import { LabelPlacementOverlay } from '../print/LabelPlacementOverlay';
import { LabelNameFields } from '../print/LabelNameFields';
import { AiTrayPointsButton } from '../ai/AiTrayPointsButton';
import { TRAY_STAGE_VIEW, TrayStage, menuDishes, photoPointToStage, resolveTrayLabels, shownTrayLabels, trayLabelTexts } from './TrayStage';

type Target = 'reguler' | 'b3';

// Pratinjau hero halaman publik di CMS: nama hidangan dan panah bisa digeser dengan pegangan yang sama seperti di modul poster.
export const TrayLabelEditor: React.FC<{
  menuToday: WebsiteMenuTodayConfig;
  onChange: (patch: Partial<WebsiteMenuTodayConfig>) => void;
}> = ({ menuToday, onChange }) => {
  const [target, setTarget] = useState<Target>('reguler');
  const [placing, setPlacing] = useState(false);

  const dishes = useMemo(() => menuDishes(menuToday), [menuToday]);
  const hasB3Photo = Boolean(menuToday.imageUrlB3) && dishes.b3.length > 0;
  const active: Target = target === 'b3' && hasB3Photo ? 'b3' : 'reguler';
  const saved = active === 'b3' ? menuToday.trayLabelsB3 : menuToday.trayLabels;
  const labelsKey = active === 'b3' ? 'trayLabelsB3' : 'trayLabels';
  const texts = useMemo(() => trayLabelTexts(active === 'b3' ? dishes.b3 : dishes.regular), [active, dishes]);
  const placements = useMemo(() => resolveTrayLabels(texts, saved), [texts, saved]);
  const shown = useMemo(() => shownTrayLabels(texts, placements), [texts, placements]);
  const savePlacements = (next: typeof placements) => onChange({ [labelsKey]: next.map((p, i) => ({ text: texts[i], ...p })) });
  const photo = active === 'b3'
    ? menuToday.imageUrlB3!
    : !menuToday.imageUrl || menuToday.imageUrl === trayImg1 ? trayCutoutImg : menuToday.imageUrl;

  const tabCls = (on: boolean) => `${on ? BTN_PRIMARY : BTN_SECONDARY}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-slate-800">Nama dan panah di halaman publik</h4>
          <p className="text-[11px] text-slate-600">
            {placing
              ? 'Geser kotak nama ke tempat kosong dan bulatan kuning ke makanannya di foto. Namanya bisa diganti di bawah pratinjau. Klik Simpan di atas agar tampil di halaman publik.'
              : saved
                ? 'Letak nama sudah diatur sendiri.'
                : 'Letak nama mengikuti poster menu.'}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2 min-w-0">
          <AiTrayPointsButton
            photo={photo}
            texts={shown}
            onPoints={(points, natural) => {
              onChange({
                [labelsKey]: placements.map((p, i) => {
                  const point = points[i];
                  if (!point) return { text: texts[i], ...p };
                  const { x, y } = photoPointToStage(point, natural);
                  return { text: texts[i], ...p, tipX: x, tipY: y };
                }),
              });
              setPlacing(true);
            }}
          />
          {saved && (
            <button type="button" onClick={() => onChange({ [labelsKey]: null })} className={BTN_SECONDARY}>
              Kembalikan bawaan
            </button>
          )}
          <button type="button" aria-pressed={placing} disabled={texts.length === 0} onClick={() => setPlacing(v => !v)} className={`${placing ? BTN_PRIMARY : BTN_SECONDARY} disabled:opacity-50`}>
            {placing ? 'Selesai' : 'Atur nama dan letak'}
          </button>
        </div>
      </div>

      {hasB3Photo && (
        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Pilih menu">
          <button type="button" aria-pressed={active === 'reguler'} onClick={() => setTarget('reguler')} className={tabCls(active === 'reguler')}>Menu reguler</button>
          <button type="button" aria-pressed={active === 'b3'} onClick={() => setTarget('b3')} className={tabCls(active === 'b3')}>Menu 3B</button>
          {active === 'b3' && (
            <button type="button" onClick={() => { onChange({ imageUrlB3: '', trayLabelsB3: null }); setTarget('reguler'); }} className={BTN_SECONDARY}>
              Hapus foto 3B
            </button>
          )}
        </div>
      )}

      {placing && (
        <>
          <div className="relative mt-2 rounded-lg bg-[#155e5f] overflow-hidden">
            <TrayStage photo={photo} fallbackPhoto={trayCutoutImg} alt="Pratinjau ompreng di halaman publik" texts={shown} placements={placements} />
            <LabelPlacementOverlay view={TRAY_STAGE_VIEW} texts={shown} placements={placements} onChange={savePlacements} />
          </div>
          <LabelNameFields idPrefix={`cms-${active}`} texts={texts} placements={placements} onChange={savePlacements} />
        </>
      )}
    </div>
  );
};
