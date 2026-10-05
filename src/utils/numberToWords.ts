/**
 * Helper untuk mengonversi angka nominal uang menjadi teks terbilang Bahasa Indonesia
 * Contoh: 9880000 -> Sembilan Juta Delapan Ratus Delapan Puluh Ribu Rupiah
 */
export function angkaTerbilang(angka: number): string {
  const bilangan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima',
    'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ];

  function toWords(n: number): string {
    const num = Math.floor(Math.abs(n));
    if (num < 12) {
      return bilangan[num];
    } else if (num < 20) {
      return toWords(num - 10) + ' Belas';
    } else if (num < 100) {
      const sisa = num % 10;
      return toWords(Math.floor(num / 10)) + ' Puluh' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 200) {
      const sisa = num - 100;
      return 'Seratus' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 1000) {
      const sisa = num % 100;
      return toWords(Math.floor(num / 100)) + ' Ratus' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 2000) {
      const sisa = num - 1000;
      return 'Seribu' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 1000000) {
      const sisa = num % 1000;
      return toWords(Math.floor(num / 1000)) + ' Ribu' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 1000000000) {
      const sisa = num % 1000000;
      return toWords(Math.floor(num / 1000000)) + ' Juta' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 1000000000000) {
      const sisa = num % 1000000000;
      return toWords(Math.floor(num / 1000000000)) + ' Miliar' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else {
      const sisa = num % 1000000000000;
      return toWords(Math.floor(num / 1000000000000)) + ' Triliun' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    }
  }

  if (angka === 0) return 'Nol Rupiah';
  const prefix = angka < 0 ? 'Minus ' : '';
  const result = toWords(angka).trim();
  return `${prefix}${result} Rupiah`;
}
