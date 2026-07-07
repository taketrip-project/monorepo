/** Converte um ISO 8601 (UTC ou com offset) para o formato aceito por
 * `<input type="datetime-local">` ("YYYY-MM-DDTHH:mm"), no fuso local do
 * navegador — mesmo fuso que `new Date(valorDoInput)` usa para reconverter. */
export function toDatetimeLocalValue(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}
