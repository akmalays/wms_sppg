import {fetchWebsiteConfigFromCloud, saveWebsiteConfigToCloud, uploadCmsMedia, type TrayLabelPlacement} from "../db/websiteConfigStorage";

export type TrayTarget = "reguler" | "b3";

export interface TrayPublish {
  target: TrayTarget;
  /** Foto tanpa background sebagai data URL. */
  photo: string;
  /** undefined = letak yang tersimpan tidak disentuh, kecuali fotonya berganti. */
  labels?: TrayLabelPlacement[] | null;
}

// Letak nama bisa berubah berkali-kali untuk satu foto; fotonya cukup diunggah sekali.
const uploaded = new Map<string, string>();

async function uploadPhoto(photo: string): Promise<string> {
  const known = uploaded.get(photo);
  if (known) return known;
  const blob = await (await fetch(photo)).blob();
  const result = await uploadCmsMedia(new File([blob], "nampan.webp", {type: blob.type}), "menu");
  uploaded.set(photo, result.url);
  return result.url;
}

/**
 * Pasang foto ompreng dari modul poster ke halaman menu publik. Config diambil ulang dari cloud lebih dulu agar
 * perubahan CMS orang lain tidak tertimpa; bila gagal dibaca, tidak ada yang disimpan.
 */
export async function publishTrays(items: TrayPublish[]): Promise<void> {
  const urls = await Promise.all(items.map((item) => uploadPhoto(item.photo)));
  const {config, error} = await fetchWebsiteConfigFromCloud();
  if (error) throw new Error(error);
  const menuToday = {...config.menuToday};
  items.forEach((item, i) => {
    const [photoKey, labelsKey] = item.target === "b3" ? (["imageUrlB3", "trayLabelsB3"] as const) : (["imageUrl", "trayLabels"] as const);
    const photoChanged = menuToday[photoKey] !== urls[i];
    menuToday[photoKey] = urls[i];
    if (item.labels !== undefined) menuToday[labelsKey] = item.labels;
    else if (photoChanged) menuToday[labelsKey] = null;
  });
  const saved = await saveWebsiteConfigToCloud({...config, menuToday});
  if (saved.cloudFailed) throw new Error(saved.message);
}
