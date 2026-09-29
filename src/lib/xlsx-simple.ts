// Gera um .xlsx real (uma ou várias abas) SEM dependência externa: ZIP "store" (sem compressão)
// + XML mínimo do OpenXML. Excel, Numbers e Google Sheets abrem normalmente.
// Uso: exportarXlsx('vendas.xlsx', ['Col A','Col B'], [['x', 10], ['y', 2.5]]).
// Várias abas: exportarXlsxAbas('rel.xlsx', [{ nome, cabecalho, linhas }, ...]).

type Celula = string | number | null | undefined;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const utf8 = (s: string) => new TextEncoder().encode(s);

// ZIP sem compressão (method 0) — suficiente e simples.
function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const nome = utf8(f.name);
    const crc = crc32(f.data);
    const lh = new Uint8Array(30 + nome.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true); // hora/data fixas
    lv.setUint32(14, crc, true); lv.setUint32(18, f.data.length, true); lv.setUint32(22, f.data.length, true);
    lv.setUint16(26, nome.length, true); lv.setUint16(28, 0, true);
    lh.set(nome, 30);
    locais.push(lh, f.data);
    const ch = new Uint8Array(46 + nome.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, f.data.length, true); cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, nome.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, offset, true);
    ch.set(nome, 46);
    centrais.push(ch);
    offset += lh.length + f.data.length;
  }
  const cdSize = centrais.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
  const total = offset + cdSize + 22;
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of [...locais, ...centrais, eocd]) { out.set(b, p); p += b.length; }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function colLetra(i: number): string { // 0 → A, 25 → Z, 26 → AA
  let s = ''; let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}
function linhaXml(r: number, valores: Celula[]): string {
  const cells = valores.map((v, i) => {
    const ref = `${colLetra(i)}${r}`;
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
  }).join('');
  return `<row r="${r}">${cells}</row>`;
}

export type AbaXlsx = { nome: string; cabecalho: string[]; linhas: Celula[][] };

function sheetXml(cabecalho: string[], linhas: Celula[][]): string {
  const rows = [linhaXml(1, cabecalho), ...linhas.map((l, i) => linhaXml(i + 2, l))].join('');
  // largura das colunas: proporcional ao maior texto (limite 60)
  const widths = cabecalho.map((h, i) => {
    const max = Math.max(h.length, ...linhas.map((l) => String(l[i] ?? '').length));
    return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(10, max + 2))}" customWidth="1"/>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths}</cols><sheetData>${rows}</sheetData></worksheet>`;
}

// Nome de aba no Excel: até 31 caracteres, sem : \ / ? * [ ] e sem repetir.
function nomesDeAba(nomes: string[]): string[] {
  const usados = new Set<string>();
  return nomes.map((n, i) => {
    let base = (n || `Planilha ${i + 1}`).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || `Planilha ${i + 1}`;
    let nome = base; let k = 2;
    while (usados.has(nome.toLowerCase())) nome = `${base.slice(0, 28)} ${k++}`;
    usados.add(nome.toLowerCase());
    return nome;
  });
}

export function gerarXlsxAbasBytes(abas: AbaXlsx[]): Uint8Array {
  const nomes = nomesDeAba(abas.map((a) => a.nome));
  const sheets = nomes.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  return zipStore([
    { name: '[Content_Types].xml', data: utf8(types) },
    { name: '_rels/.rels', data: utf8(rels) },
    { name: 'xl/workbook.xml', data: utf8(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(wbRels) },
    ...abas.map((a, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: utf8(sheetXml(a.cabecalho, a.linhas)) })),
  ]);
}

export function gerarXlsxBytes(cabecalho: string[], linhas: Celula[][], aba = 'Planilha'): Uint8Array {
  return gerarXlsxAbasBytes([{ nome: aba, cabecalho, linhas }]);
}

function baixar(nomeArquivo: string, zip: Uint8Array) {
  const blob = new Blob([zip.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

// Várias abas num arquivo só (ex.: relatório com Resumo, Por sala, Vendas...).
export function exportarXlsxAbas(nomeArquivo: string, abas: AbaXlsx[]) {
  baixar(nomeArquivo, gerarXlsxAbasBytes(abas));
}

export function exportarXlsx(nomeArquivo: string, cabecalho: string[], linhas: Celula[][], aba = 'Planilha') {
  baixar(nomeArquivo, gerarXlsxBytes(cabecalho, linhas, aba));
}
