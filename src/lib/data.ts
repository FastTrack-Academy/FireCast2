import type { FireData } from "./types";

export async function loadFire(id: string, signal?: AbortSignal): Promise<FireData> {
  const response = await fetch(`/data/fires/${id}.json.gz`, { signal });
  if (!response.ok) throw new Error(`Could not load fire data (${response.status}). Please retry.`);
  const buffer = await response.arrayBuffer();
  const magic = new Uint8Array(buffer,0,Math.min(2,buffer.byteLength));
  // Some hosts send a gzip Content-Encoding header and the browser has already
  // unpacked the response. Accept both representations without double decoding.
  if(magic[0]!==0x1f || magic[1]!==0x8b) return JSON.parse(new TextDecoder().decode(buffer));
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unpack the fire archive. Please use a current version of Chrome, Edge, Firefox or Safari.");
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).json();
}

/** RFC-style CSV parser supporting quoted commas, escaped quotes and CRLF. */
export function parseCSV(text: string): Record<string,string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i=0;i<source.length;i++) {
    const char=source[i];
    if (char==='"') {
      if(quoted && source[i+1]==='"') {cell+='"';i++;}
      else quoted=!quoted;
    } else if(char==="," && !quoted) {row.push(cell);cell="";}
    else if((char==="\n"||char==="\r") && !quoted) {
      if(char==="\r"&&source[i+1]==="\n")i++;
      row.push(cell);if(row.some(c=>c.trim()))rows.push(row);row=[];cell="";
    } else cell+=char;
  }
  if(quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(cell);if(row.some(c=>c.trim()))rows.push(row);
  const headers=rows.shift()?.map(h=>h.trim());
  if(!headers?.length || !rows.length) throw new Error("CSV needs a header and at least one observation.");
  if(new Set(headers).size!==headers.length) throw new Error("CSV has duplicate column names.");
  if(rows.length>5000) throw new Error("Please import at most 5,000 observations at a time.");
  return rows.map((values,i)=> {
    if(values.length!==headers.length) throw new Error(`CSV row ${i+2} has ${values.length} fields; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));
  });
}
