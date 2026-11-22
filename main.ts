// Museum Malam: Mahkota Firaun — program hand-in (Node 22, standard library only).
// Menyalin game/ dan screenshots/ dari samping file ini ke /output (atau
// MAKEFUN_OUTPUT_DIR di luar grader), lalu menulis /output/dossier.json —
// ringkasan yang dibaca juri — dengan library make.fun yang di-vendor.
// Dijalankan dua kali oleh grader; kedua run harus menulis byte yang sama.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Batas scorer (reference/gate.json): hanya text_max_bytes yang membentuk byte;
// yang lain menolak entry yang akan ditolak scorer (lebih dari 4 screenshot
// atau satu di atas 256 KiB; lebih dari 993 file di game/ atau 48 MiB file game
// seluruhnya, atau path di bawah game/ di atas 1000 byte: game/ dihitung di
// samping cap 1000 entri /output sendiri, bersama screenshots/ dan dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
