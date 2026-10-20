import type { Art, Scene } from '../../src/core/types';

// Scenes copied from docs/reference/crumb-hunt-artifact.html (ART, LEVELS).

/** Nearest-neighbour scale of an art to a new width, keeping the aspect ratio. */
export function upscale(a: Art, W: number): Art {
  const w0 = a.rows[0].length;
  const H = Math.round((a.rows.length * W) / w0);
  const rows: string[] = [];
  for (let r = 0; r < H; r++) {
    const src = a.rows[Math.min(a.rows.length - 1, Math.floor((r * a.rows.length) / H))];
    let row = '';
    for (let c = 0; c < W; c++) row += src[Math.min(w0 - 1, Math.floor((c * w0) / W))];
    rows.push(row);
  }
  return { rows, pal: a.pal };
}

export const bridge: Scene = {
  id: 'bridge',
  band: 'medium',
  name: 'Brooklyn Bridge',
  blurb: 'Dusk over the East River. Cables, gothic arches, and a lot of water.',
  lanes: 4, slots: 4, chunk: [9, 20], wait: 0.7,
  rows: [
    "pppppppppppppppppppppppppppp",
    "pppppppppppppppppppppppppppp",
    "pppppppppSSSSSSSSSSppppppppp",
    "ppppppppdssssssssssdpppppppp",
    "ppppppddpsssssssssspddpppppp",
    "kpkpddkpksssssssssspkpddkpkp",
    "kkkdkdkkkSSSSSSSSSSkkkdkdkkk",
    "kkdkkdkkSSSSSSSSSSSSkkdkkdkk",
    "kddkkdkkksskssssksskkkdkkddk",
    "dkdkkdkkkskkksskkkskkkdkkdkd",
    "kodokdkokskkksskkksokodokdko",
    "oodoodooosooossooosooydoodoo",
    "oodoodooosooossooosyyydyydoo",
    "oodoodooosooossooosyyydyydoo",
    "oodoodooosooossooosyyydyydoo",
    "dododddodsooossooosydydydddo",
    "dddddddddddddddddddddddddddd",
    "bbbbbbbbbssssssssssbbbbbbbbb",
    "BbbbbbBBbssssssssssbBBbbbbbB",
    "bbbbbbbbbssssssssssbbybybbbb",
    "bbBBbbbbbssssssssssbbbbBBbbb",
    "bbbbbbbbbssSsssSsssbbybybbbb",
    "bbbbbBBbbsSsssSsssSBBbbbbbBB",
    "bbbbbbbbbSsssSsssSsbbybybbbb",
    "bBBbbbbbBBbbSbbBSbbbbbBBbbbb",
    "bbbbbbbbbbbSbbbSbbbbbybybbbb",
    "bbbbBBbbbbSBBbSbbbSBbbbbbBBb",
    "bbbbbbbbbSbbbSbbbSbbbybybbbb"
  ],
  pal: {"p":"#5b3d8f","k":"#e46a8d","o":"#f6a03d","y":"#ffe066","b":"#1f4e79","B":"#5fa0d0","s":"#c7a77a","S":"#7d5f3c","d":"#23202b"},
};

export const d20: Scene = {
  id: 'd20',
  band: 'hard',
  name: 'Natural 20',
  blurb: 'Every facet walled in by an edge. Only three holding slots.',
  lanes: 4, slots: 3, chunk: [10, 20], wait: 0.95,
  rows: [
    "WwwWwwWwwWwwWwwWwwWwwWwwWw",
    "wwWwwWwwWwwWwwWwwWwwWwwWww",
    "wWffffffffffeeffffffffffwW",
    "WwffffffffeeMeeeffffffffWw",
    "wwffffffeeMMMeLLeeffffffww",
    "wWffffeeMMMMMeLLLLeeffffwW",
    "WwffeeMMMeeeeeeeeeLLeeffWw",
    "wwfeeeeeeLLLeLeMMMeeeeeeww",
    "wWfeLLLLLLLLeLeMMMMMMMDewW",
    "WwfeeLLLLLLeLLLeMMMMMMeeWw",
    "wwfeeLLLnnnnLLnnnnMMMDeeww",
    "wWfeMeLLLLenLLnLenMMMeDewW",
    "WwfeMeLLnnnnLLnLenMMMeDeWw",
    "wwfeMeLLneLLLLnLLnMMDeDeww",
    "wWfeMMeLneLLLLnLLnMMeDDewW",
    "WwfeMMeLnnnnLLnnnneDeDDeWw",
    "wwfeMMMeeLLLLLLLLLeeDDDeww",
    "wWfeMDDeeeeeeeeeeeeeLDDewW",
    "WwfeDeeDeMMMMMMMMLeLeeLeWw",
    "wwfeeDDDDeMMMMMMMeLLLfeeww",
    "wWfffeeDDDeMMMMMeLLffeefwW",
    "WwfffffeeDeMMMMLeLfeefffWw",
    "wwfffffffeeeMMLefeefffffww",
    "wWfffffffffeeMeeefffffffwW",
    "WwwWwwWwwWwwWeeWwwWwwWwwWw",
    "wwWwwWwwWwwWwwWwwWwwWwwWww"
  ],
  pal: {"w":"#8a5a2b","W":"#5e3a19","f":"#1f6e5e","e":"#24123f","L":"#b694f2","M":"#7c4fd0","D":"#4b2a8f","n":"#ffd34d"},
};
