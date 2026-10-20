/**
 * Tokenizer & Parser CSV Mandiri (RFC 4180).
 * Menangani tanda kutip, koma di dalam kutip, baris baru (CRLF/LF), dan UTF-8 BOM.
 */

export function parseCsvRows(content: string | Buffer, delimiter = ","): string[][] {
  let text = typeof content === "string" ? content : content.toString("utf-8");

  // Hapus UTF-8 BOM bila ada
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i]!;

    if (insideQuotes) {
      if (char === '"') {
        // Cek apakah escaped quote ("")
        if (i + 1 < len && text[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // Tutup kutip
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = "";
        i++;
        continue;
      } else if (char === "\r" || char === "\n") {
        currentRow.push(currentCell.trim());
        currentCell = "";

        // Lewati \r\n jika berpasangan
        if (char === "\r" && i + 1 < len && text[i + 1] === "\n") {
          i += 2;
        } else {
          i++;
        }

        // Simpan baris hanya jika tidak sepenuhnya kosong
        if (currentRow.some((c) => c !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }
  }

  // Sisa sel terakhir setelah loop selesai
  if (currentCell !== "" || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}
