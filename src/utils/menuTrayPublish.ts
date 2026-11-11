import {EMPTY_PORTION_TIER, fetchWebsiteConfigFromCloud, saveWebsiteConfigToCloud, uploadCmsMedia, type PortionTierConfig, type TrayLabelPlacement} from "../db/websiteConfigStorage";
import {isSupabaseConfigured} from "../lib/supabase";
import type {MenuPosterNutrition} from "../types/warehouse";

export type TrayTarget = "reguler" | "b3";

export interface NutritionPublish {
  target: TrayTarget;
  large: MenuPosterNutrition;
  small: MenuPosterNutrition;
}

const withUnit = (value: string | undefined, unit: string) => (value?.trim() ? `${value.trim()} ${unit}` : "");

/** Angka gizi poster (tanpa satuan) ke porsi website. Kolom poster yang kosong ikut kosong, supaya angka menu lama tidak tertinggal. */
export const portionFromPoster = (tier: PortionTierConfig, n: MenuPosterNutrition | undefined): PortionTierConfig => ({
  ...tier,
  targetCalories: withUnit(n?.energy, "kkal"),
  proteinGrams: withUnit(n?.protein, "g"),
  carbGrams: withUnit(n?.carb, "g"),
  fatGrams: withUnit(n?.fat, "g"),
  fiberGrams: withUnit(n?.fiber, "g"),
});

/**
 * Angka gizi poster ke halaman menu publik. Tanggal diperiksa lagi pada config terbaru agar poster tidak mengisi menu
 * hari lain, dan tidak disimpan bila angkanya sudah sama supaya "Diperbarui pukul" tidak berubah hanya karena poster dibuka.
 */
export async function publishPosterNutrition(items: NutritionPublish[], posterDate: string): Promise<void> {
  const {config, error} = await fetchWebsiteConfigFromCloud();
  if (error) throw new Error(error);
  if (!config.menuToday.dateText.toLowerCase().includes(posterDate.toLowerCase())) throw new Error("Halaman menu sudah berganti tanggal.");
  const menuToday = {...config.menuToday};
  items.forEach((item) => {
    const [largeKey, smallKey] = item.target === "b3" ? (["portionLargeB3", "portionSmallB3"] as const) : (["portionLarge", "portionSmall"] as const);
    menuToday[largeKey] = portionFromPoster(menuToday[largeKey] ?? EMPTY_PORTION_TIER, item.large);
    menuToday[smallKey] = portionFromPoster(menuToday[smallKey] ?? EMPTY_PORTION_TIER, item.small);
  });
  if (JSON.stringify(menuToday) === JSON.stringify(config.menuToday)) return;
  const saved = await saveWebsiteConfigToCloud({...config, menuToday});
  if (saved.cloudFailed) throw new Error(saved.message);
}

export interface TrayPublish {
  target: TrayTarget;
  /** Foto tanpa background sebagai data URL. */
  photo: string;
  /** undefined = letak yang tersimpan tidak disentuh, kecuali fotonya berganti. */
  labels?: TrayLabelPlacement[] | null;
  /**
   * Nama hidangan di poster. Ikut menggantikan daftar hidangan halaman publik, supaya hidangan yang ditambahkan
   * belakangan (mis. buah) muncul di sana dan label dari poster cocok dengan namanya.
   */
  dishes?: string[];
}

// Letak nama bisa berubah berkali-kali untuk satu foto; fotonya cukup diunggah sekali. Dipakai bersama oleh
// penyimpanan poster dan pengiriman ke halaman publik.
const uploaded = new Map<string, string>();

/**
 * Foto poster ke storage, mengembalikan alamatnya. Alamat yang sudah http(s) dikembalikan apa adanya.
 * Bila Supabase aktif tapi unggahan gagal, dilempar galat: data URL tidak boleh masuk ke baris database.
 */
export async function uploadPosterPhoto(photo: string): Promise<string> {
  if (/^https?:\/\//.test(photo)) return photo;
  const known = uploaded.get(photo);
  if (known) return known;
  const blob = await (await fetch(photo)).blob();
  const result = await uploadCmsMedia(new File([blob], "nampan.webp", {type: blob.type}), "menu");
  if (!result.isCloudStorage && isSupabaseConfigured()) throw new Error(result.warning || "Foto gagal diunggah ke storage.");
  uploaded.set(photo, result.url);
  return result.url;
}

const uploadPhoto = uploadPosterPhoto;

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
    const dishes = item.dishes?.map((d) => d.trim()).filter(Boolean);
    if (dishes?.length) menuToday[item.target === "b3" ? "menuB3" : "menuTitle"] = dishes.join(", ");
  });
  const saved = await saveWebsiteConfigToCloud({...config, menuToday});
  if (saved.cloudFailed) throw new Error(saved.message);
}
