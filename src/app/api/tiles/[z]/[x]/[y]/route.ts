// Vector-tile endpoint backed by the static PMTiles archive.
//
// Mapbox GL JS v3 has no `addProtocol` (that is a MapLibre API), so instead of
// reading PMTiles in the browser we serve standard {z}/{x}/{y} MVT tiles from
// this route. The 33 MB archive is read into memory once and tiles are looked
// up by byte range via pmtiles' own directory logic.
import { PMTiles, type Source, type RangeResponse } from "pmtiles";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export const runtime = "nodejs";

const PMTILES_PATH = join(process.cwd(), "public", "tiles", "wells.pmtiles");

// Load the archive into memory once and serve byte ranges as slices.
let bufPromise: Promise<Buffer> | null = null;
function archive(): Promise<Buffer> {
  if (!bufPromise) bufPromise = readFile(PMTILES_PATH);
  return bufPromise;
}

class BufferSource implements Source {
  getKey() {
    return PMTILES_PATH;
  }
  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    const buf = await archive();
    // Copy into a fresh ArrayBuffer (not the shared/pooled Node Buffer backing).
    const copy = new Uint8Array(Math.min(length, Math.max(0, buf.length - offset)));
    copy.set(buf.subarray(offset, offset + length));
    return { data: copy.buffer };
  }
}

let pmtiles: PMTiles | null = null;
function getPMTiles(): PMTiles {
  if (!pmtiles) pmtiles = new PMTiles(new BufferSource());
  return pmtiles;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await ctx.params;
  const zi = Number.parseInt(z, 10);
  const xi = Number.parseInt(x, 10);
  const yi = Number.parseInt(y.replace(/\.(mvt|pbf)$/, ""), 10);
  if ([zi, xi, yi].some(Number.isNaN)) {
    return new Response("bad tile coordinates", { status: 400 });
  }

  let tile;
  try {
    tile = await getPMTiles().getZxy(zi, xi, yi);
  } catch (err) {
    console.error("tile read failed", err);
    return new Response("tile error", { status: 500 });
  }
  if (!tile) return new Response(null, { status: 204 }); // empty tile

  const body = gzipSync(Buffer.from(tile.data));
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.mapbox-vector-tile",
      "Content-Encoding": "gzip",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
