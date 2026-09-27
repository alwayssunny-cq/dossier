// ── Deterministic seed → index ────────────────────────────────────────────────

export function seedNum(seed: string, max: number): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0
  return Math.abs(h) % max
}

// ── Curated Unsplash photo library ────────────────────────────────────────────
// Keys are lowercase keywords matched against combined destination strings.
// Arrays hold 1–3 photo IDs; the seed hash picks deterministically.

const PHOTO_MAP: Record<string, string[]> = {
  // India — regions
  nagaland:    ['photo-1595769816263-9b910be24d5f', 'photo-1464822759023-fed622ff2c3b', 'photo-1448375240586-882707db888b'],
  northeast:   ['photo-1464822759023-fed622ff2c3b', 'photo-1448375240586-882707db888b'],
  rajasthan:   ['photo-1524492412937-b28074a5d7da', 'photo-1477120292453-5b14e0dbe06f'],
  kerala:      ['photo-1602216056096-3b40cc0c9944', 'photo-1567157577867-05ccb1388e66'],
  goa:         ['photo-1512343879784-a960bf40e7f2', 'photo-1507525428034-b723cf961d3e'],
  mumbai:      ['photo-1566552881560-0be862a7c445', 'photo-1596422846543-75c6fc197f07'],
  delhi:       ['photo-1587474260584-136574528ed5', 'photo-1524492412937-b28074a5d7da'],
  india:       ['photo-1524492412937-b28074a5d7da', 'photo-1598091383021-15ddea10925d', 'photo-1477120292453-5b14e0dbe06f'],

  // Japan
  kyoto:       ['photo-1493976040374-85c8e12f0c0e', 'photo-1492571350019-22de08371fd3'],
  tokyo:       ['photo-1540959733332-eab4deabeeaf', 'photo-1513407030348-c983a97b98d8'],
  osaka:       ['photo-1540959733332-eab4deabeeaf', 'photo-1493976040374-85c8e12f0c0e'],
  japan:       ['photo-1493976040374-85c8e12f0c0e', 'photo-1528360983277-13d401cdc186', 'photo-1540959733332-eab4deabeeaf'],

  // Southeast Asia
  bali:        ['photo-1537996194471-e657df975ab4', 'photo-1552465011-b4e21bf6e79a'],
  thailand:    ['photo-1520250497591-112f2f40a3f4', 'photo-1562602833-0f4ab2fc46e3'],
  vietnam:     ['photo-1528127269322-539801943592', 'photo-1511707171634-5f897ff02aa9'],
  cambodia:    ['photo-1539650116574-8efeb43e2750', 'photo-1528127269322-539801943592'],
  singapore:   ['photo-1525625293386-3f8f99389edd', 'photo-1563245372-f21724e3856d'],
  indonesia:   ['photo-1537996194471-e657df975ab4', 'photo-1552465011-b4e21bf6e79a'],

  // Italy
  venice:      ['photo-1534430480872-3498386e7856', 'photo-1541101767792-f9b2b1c4f127'],
  amalfi:      ['photo-1533105079780-92b9be482077', 'photo-1555881400-74d7acaacd8b'],
  rome:        ['photo-1515542622106-78bda8ba0e5b', 'photo-1534430480872-3498386e7856'],
  florence:    ['photo-1541373107-4e4b3e9b9b0e', 'photo-1515542622106-78bda8ba0e5b'],
  italy:       ['photo-1534430480872-3498386e7856', 'photo-1533105079780-92b9be482077', 'photo-1515542622106-78bda8ba0e5b'],

  // France
  paris:       ['photo-1499856871958-5b9627545d1a', 'photo-1431274172761-fca41d9af3b6'],
  france:      ['photo-1499856871958-5b9627545d1a', 'photo-1431274172761-fca41d9af3b6'],
  provence:    ['photo-1499856871958-5b9627545d1a', 'photo-1598428489060-04956d9c40c1'],

  // Mediterranean / Greece
  santorini:   ['photo-1570077188670-e3a8d69ac5ff', 'photo-1534430480872-3498386e7856'],
  greece:      ['photo-1570077188670-e3a8d69ac5ff', 'photo-1504512485720-7d83a16ee930'],
  mediterranean: ['photo-1533105079780-92b9be482077', 'photo-1570077188670-e3a8d69ac5ff'],

  // Spain & Portugal
  spain:       ['photo-1543783207-ec64e4d95325', 'photo-1569974948-e8a7e6b98f3f'],
  portugal:    ['photo-1553959645-3bfb2e7e7e2e', 'photo-1543783207-ec64e4d95325'],

  // UK & Ireland
  london:      ['photo-1513635269975-59663e0ac1ad', 'photo-1529655683826-aba9b3e77383'],
  scotland:    ['photo-1506905925346-21bda4d32df4', 'photo-1464822759023-fed622ff2c3b'],
  uk:          ['photo-1513635269975-59663e0ac1ad', 'photo-1506905925346-21bda4d32df4'],

  // Switzerland & Alpine Europe
  switzerland: ['photo-1506905925346-21bda4d32df4', 'photo-1470114716159-e389f8712fda'],
  alps:        ['photo-1506905925346-21bda4d32df4', 'photo-1464822759023-fed622ff2c3b'],

  // Middle East
  jordan:      ['photo-1558618666-fcd25c85cd64', 'photo-1509316785289-025f5b846b35'],
  dubai:       ['photo-1512453979798-5ea266f8880c', 'photo-1555881400-74d7acaacd8b'],
  morocco:     ['photo-1489493887464-892be6d1daae', 'photo-1548017933-a17bc2fce37b'],

  // Africa & Safari
  kenya:       ['photo-1516026672322-bc52d61a55d5', 'photo-1570733577524-3a047079e80d'],
  tanzania:    ['photo-1516026672322-bc52d61a55d5', 'photo-1547471080-7cc2caa01a7e'],
  rwanda:      ['photo-1547471080-7cc2caa01a7e', 'photo-1516026672322-bc52d61a55d5'],
  safari:      ['photo-1516026672322-bc52d61a55d5', 'photo-1547471080-7cc2caa01a7e'],
  africa:      ['photo-1516026672322-bc52d61a55d5', 'photo-1547471080-7cc2caa01a7e'],

  // Islands & Tropical
  maldives:    ['photo-1514282401047-d79a71a590e8', 'photo-1573843981267-be1999ff37cd'],
  mauritius:   ['photo-1560541919-eb5c2da6a5a3', 'photo-1514282401047-d79a71a590e8'],
  caribbean:   ['photo-1507525428034-b723cf961d3e', 'photo-1559494007-9f5847c49d94'],
  maldive:     ['photo-1514282401047-d79a71a590e8', 'photo-1573843981267-be1999ff37cd'],

  // Americas
  peru:        ['photo-1526392060635-9d6019884377', 'photo-1516306580123-e6e52b1b7b5f'],
  mexico:      ['photo-1518638150340-f706e86654de', 'photo-1541101767792-f9b2b1c4f127'],
  patagonia:   ['photo-1508193638397-1c4234db14d8', 'photo-1506905925346-21bda4d32df4'],
  argentina:   ['photo-1508193638397-1c4234db14d8', 'photo-1476514525535-07fb3b4ae5f1'],
  usa:         ['photo-1469474968028-56623f02e42e', 'photo-1506905925346-21bda4d32df4'],

  // Polar / Expedition
  antarctica:  ['photo-1494587351196-bbf5f29cff42', 'photo-1484291470158-b8f8d608850d'],
  arctic:      ['photo-1494587351196-bbf5f29cff42', 'photo-1484291470158-b8f8d608850d'],
  norway:      ['photo-1469474968028-56623f02e42e', 'photo-1506905925346-21bda4d32df4'],
  iceland:     ['photo-1531366936337-7c912a4589a7', 'photo-1464822759023-fed622ff2c3b'],

  // Generic contexts — matched when no specific country
  beach:       ['photo-1507525428034-b723cf961d3e', 'photo-1499678329028-101435549a4e'],
  ocean:       ['photo-1507525428034-b723cf961d3e', 'photo-1499678329028-101435549a4e'],
  mountain:    ['photo-1506905925346-21bda4d32df4', 'photo-1464822759023-fed622ff2c3b'],
  forest:      ['photo-1448375240586-882707db888b', 'photo-1542601906990-b4d3fb778b09'],
  desert:      ['photo-1509316785289-025f5b846b35', 'photo-1535591273668-578e31182c4f'],
  temple:      ['photo-1493976040374-85c8e12f0c0e', 'photo-1524492412937-b28074a5d7da'],
  castle:      ['photo-1513635269975-59663e0ac1ad', 'photo-1543783207-ec64e4d95325'],
  lake:        ['photo-1470114716159-e389f8712fda', 'photo-1506905925346-21bda4d32df4'],
  river:       ['photo-1542601906990-b4d3fb778b09', 'photo-1448375240586-882707db888b'],
  village:     ['photo-1464822759023-fed622ff2c3b', 'photo-1506905925346-21bda4d32df4'],
  city:        ['photo-1476514525535-07fb3b4ae5f1', 'photo-1513635269975-59663e0ac1ad'],
  museum:      ['photo-1565060169194-19fabf63012c', 'photo-1515542622106-78bda8ba0e5b'],
  spa:         ['photo-1520250497591-112f2f40a3f4', 'photo-1537996194471-e657df975ab4'],
  wine:        ['photo-1506377247377-2a5b3b417ebb', 'photo-1499628887764-07ab3a5a81db'],
  food:        ['photo-1414235077428-338989a2e8c0', 'photo-1476224203421-9ac39bcb3327'],
  wellness:    ['photo-1520250497591-112f2f40a3f4', 'photo-1506905925346-21bda4d32df4'],
  train:       ['photo-1474487548417-781cb71495f3', 'photo-1469474968028-56623f02e42e'],
  cruise:      ['photo-1499678329028-101435549a4e', 'photo-1514282401047-d79a71a590e8'],
}

// Final fallback pool — CQ aesthetic: clean aerial, misty, abstract, zero clutter
const FALLBACK_POOL = [
  'photo-1476514525535-07fb3b4ae5f1', // aerial mountains, clouds
  'photo-1469474968028-56623f02e42e', // mountain road, misty
  'photo-1506905925346-21bda4d32df4', // mountain panorama
  'photo-1464822759023-fed622ff2c3b', // misty peaks, muted
  'photo-1448375240586-882707db888b', // forest mist
  'photo-1507525428034-b723cf961d3e', // minimal empty beach
  'photo-1499678329028-101435549a4e', // coastline aerial
  'photo-1542601906990-b4d3fb778b09', // forest path
  'photo-1470114716159-e389f8712fda', // alpine lake
]

function resolvePhotoId(keywords: string, seed: string): string {
  const kw = keywords.toLowerCase()
  for (const [key, ids] of Object.entries(PHOTO_MAP)) {
    if (kw.includes(key)) return ids[seedNum(seed, ids.length)]
  }
  return FALLBACK_POOL[seedNum(seed, FALLBACK_POOL.length)]
}

// ── Public helpers ────────────────────────────────────────────────────────────

/** Destination-aware Unsplash URL. Uses keyword matching then falls back to the curated pool. */
export function destinationImageUrl(
  destination: string | null | undefined,
  stateCounty?: string | null,
  townsCities?: string | null,
  seed?: string,
  width = 1400,
  height = 700,
): string {
  const keywords = [townsCities, stateCounty, destination].filter(Boolean).join(' ')
  const photoSeed = seed ?? keywords ?? 'travel'
  const id = resolvePhotoId(keywords, photoSeed)
  return `https://images.unsplash.com/${id}?w=${width}&h=${height}&auto=format&fit=crop&q=85`
}

/** Experience image: custom first, then destination-aware Unsplash fallback. */
export function experienceImageUrl(
  imageUrl: string | null | undefined,
  imageUrls: string[] | string | null | undefined,
  title: string,
  location: string | null | undefined,
  fallbackCity: string | null | undefined,
): string {
  if (imageUrl) return imageUrl
  const first = Array.isArray(imageUrls) ? imageUrls[0] : imageUrls
  if (first) return first
  const keywords = [title, location, fallbackCity].filter(Boolean).join(' ')
  return destinationImageUrl(fallbackCity, location, title, keywords, 800, 500)
}

/** Stay image: custom first, then destination-aware Unsplash fallback. */
export function stayImageUrl(
  imageUrl: string | null | undefined,
  imageUrls: string[] | string | null | undefined,
  propertyName: string,
  destination: string | null | undefined,
): string {
  if (imageUrl) return imageUrl
  const first = Array.isArray(imageUrls) ? imageUrls[0] : imageUrls
  if (first) return first
  const keywords = [destination, propertyName].filter(Boolean).join(' ')
  return destinationImageUrl(destination, null, null, keywords, 800, 600)
}

/**
 * Is this a link to an image, or to a page that shows one?
 *
 * A cover pasted from a stock site is usually the page — pexels.com/photo/…,
 * unsplash.com/photos/… — which renders as a broken image rather than a
 * photograph. Better to fall through to the journey's own pictures than to
 * show a broken frame.
 */
export function isDirectImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  let u: URL
  try { u = new URL(url) } catch { return false }
  if (/\/(photo|photos|p)\//.test(u.pathname) && /pexels|unsplash|shutterstock|gettyimages/.test(u.hostname)) {
    return false
  }
  return /\.(jpe?g|png|webp|avif|gif)$/i.test(u.pathname)
    || /(images|img|cdn|media)\./i.test(u.hostname)
    || u.hostname.endsWith('amazonaws.com')
    || u.hostname.includes('notion')
}
