// Génère les icônes PNG de la PWA dans public/ (à relancer si le logo change) : node scripts/icons.mjs
// Même dessin que public/favicon.svg : bord en bois, feutre, jeton ambre. Aucune dépendance :
// rendu par sur-échantillonnage 4 × 4 (bords lissés), PNG écrit à la main (zlib + CRC32 de Node).
import { writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

const BG = [0xf5, 0xf1, 0xe9]
const WOOD = [0x6e, 0x44, 0x28]
const FELT = [0x21, 0x70, 0x49]
const CHIP = [0xd4, 0x95, 0x2a]

/**
 * Formes en coordonnées 0..1 (centre 0,5), de l'arrière vers l'avant. `scale` réduit le logo :
 * une icône « maskable » doit tenir dans le cercle central de 80 % (le système la rogne).
 */
function shapes(scale) {
  const s = (v) => v * scale
  return [
    { rx: s(28 / 64), ry: s(22 / 64), color: WOOD },
    { rx: s(23 / 64), ry: s(17 / 64), color: FELT },
    { rx: s(7 / 64), ry: s(7 / 64), color: CHIP },
  ]
}

function render(size, { scale, background }) {
  const SS = 4
  const layers = shapes(scale)
  const rgba = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size - 0.5
          const py = (y + (sy + 0.5) / SS) / size - 0.5
          let color = background
          for (const l of layers) if ((px / l.rx) ** 2 + (py / l.ry) ** 2 <= 1) color = l.color
          if (color) {
            r += color[0]
            g += color[1]
            b += color[2]
            a += 1
          }
        }
      }
      const i = (y * size + x) * 4
      const n = SS * SS
      // Couleur moyenne des échantillons couverts, opacité = part couverte.
      rgba[i] = a ? Math.round(r / a) : 0
      rgba[i + 1] = a ? Math.round(g / a) : 0
      rgba[i + 2] = a ? Math.round(b / a) : 0
      rgba[i + 3] = Math.round((255 * a) / n)
    }
  }
  return png(size, rgba)
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 8 bits par canal
  ihdr[9] = 6 // RGBA
  // Chaque ligne est précédée de son filtre (0 = aucun).
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const out = new URL('../public/', import.meta.url)
const icons = [
  ['pwa-192.png', 192, { scale: 1, background: null }],
  ['pwa-512.png', 512, { scale: 1, background: null }],
  ['pwa-maskable-512.png', 512, { scale: 0.78, background: BG }],
  // iOS ignore la transparence (fond noir) : fond crème plein.
  ['apple-touch-icon.png', 180, { scale: 0.9, background: BG }],
]
for (const [name, size, opts] of icons) {
  writeFileSync(new URL(name, out), render(size, opts))
  console.log(`public/${name}`)
}
