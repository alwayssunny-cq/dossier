// ── CQ Travel Archetype data ─────────────────────────────────────────────────
// Shared between the quiz component (client) and server pages that need to
// display/label a stored result (dashboard, Understand CQ, Understand You).

export interface QuestionOption {
  label: string
  sublabel?: string
  attribution?: string
  value: string
}

export interface Question {
  id: string
  text: string
  options: [QuestionOption, QuestionOption]
}

export interface ArchetypeData {
  name: string
  code: string
  essence: string
  destination: {
    name: string
    country: string
    description: string
    bullets: string[]
    imageUrl: string
    bumpInto: string[]
  }
}

export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'What pace feels most natural to you?',
    options: [
      { label: 'A stroll', sublabel: 'Wandering without a plan, open to the moment', value: 'S' },
      { label: 'A chase', sublabel: 'From first light to dusk, never a moment wasted', value: 'A' },
    ],
  },
  {
    id: 'q2',
    text: 'When you imagine yourself elsewhere, who are you with?',
    options: [
      { label: 'Myself, or someone I can be myself with', value: 'I' },
      { label: 'Locals, strangers, and people with stories to share', value: 'E' },
    ],
  },
  {
    id: 'q3',
    text: 'Which moment pulls at your heart more?',
    options: [
      { label: 'Spending an afternoon by a river that feels older than language', value: 'N' },
      { label: 'Having your fortune told in a centuries-old tradition you don\'t yet understand', value: 'P' },
    ],
  },
  {
    id: 'q4',
    text: 'Pick a quote you feel drawn to.',
    options: [
      {
        label: '"The universe buries strange jewels deep within us all, and then stands back to see if we can find them."',
        attribution: '— Elizabeth Gilbert',
        value: 'X',
      },
      {
        label: '"I\'m in love with places I\'ve never been to and people I\'ve never met."',
        attribution: '— John Green',
        value: 'Z',
      },
    ],
  },
]

export const ARCHETYPES: Record<string, ArchetypeData> = {
  SINX: {
    name: 'The Pilgrim',
    code: 'S · I · N · X',
    essence: 'You seek beauty in simplicity. Moving gently through the world comes naturally to you, and collecting stillness like treasure is the best souvenir you can find.',
    destination: {
      name: 'Yakushima Island',
      country: 'Japan',
      description: 'A UNESCO World Heritage site known for its subtropical climate and ancient cedar forests.',
      bullets: [
        'Home to the "Jomon Sugi," a cedar tree estimated to be between 2,000 and 7,000 years old.',
        'The moss-covered landscapes and misty mountains served as visual inspiration for Studio Ghibli\'s Princess Mononoke.',
      ],
      imageUrl: 'https://images.pexels.com/photos/17772875/pexels-photo-17772875.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Keanu Reeves', 'Yoda'],
    },
  },
  SINZ: {
    name: 'The Arctic Monk',
    code: 'S · I · N · Z',
    essence: 'You\'re rounded and inward as a person, and yet there is a quiet hunger for change in you. You learn, grow and evolve best in spaces that take you to the edge of your safe space, with a little nudge to take a step further out.',
    destination: {
      name: 'Reine',
      country: 'Norway',
      description: 'A quiet, picturesque fishing village located in the Lofoten archipelago.',
      bullets: [
        'Features iconic red fishing huts (rorbuer) set against sharp, granite peaks and crystal-clear Arctic waters.',
        'An ideal spot for witnessing the Northern Lights or experiencing the Midnight Sun.',
      ],
      imageUrl: 'https://images.pexels.com/photos/28903368/pexels-photo-28903368.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Tilda Swinton', 'Walter Mitty'],
    },
  },
  SIPX: {
    name: 'The Curator',
    code: 'S · I · P · X',
    essence: 'To the world, you are a sensitive and soulful person. You value the "patina" of life: memories as much as (or maybe more) than diamonds, and every achievement is merely a stepping stone to your next momentous adventure.',
    destination: {
      name: 'Matera',
      country: 'Italy',
      description: 'One of the oldest continuously inhabited cities in the world, famous for its ancient cave dwellings.',
      bullets: [
        'The "Sassi di Matera" are complex cavern systems carved directly into the limestone hillside.',
        'Its unique, monochromatic stone architecture creates a cinematic atmosphere that feels frozen in time.',
      ],
      imageUrl: 'https://images.pexels.com/photos/36806546/pexels-photo-36806546.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Wes Anderson', 'Hercule Poirot'],
    },
  },
  SIPZ: {
    name: 'The Listener',
    code: 'S · I · P · Z',
    essence: 'You\'re a quiet observer, functioning from a place of emotional strength — yet quietly so. When you travel, you\'re looking beyond what meets the eye and into what feels like a soul encounter with the world.',
    destination: {
      name: 'Tbilisi',
      country: 'Georgia',
      description: 'A city where history and modern creative energy collide.',
      bullets: [
        'Known for its dramatic valley setting, colourful wooden balconies, and ancient sulfur baths.',
        'The city has a thriving underground scene, from hidden wine bars to repurposed Soviet-era spaces turned into design hubs.',
      ],
      imageUrl: 'https://images.pexels.com/photos/9397565/pexels-photo-9397565.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Lana Del Rey', 'Amélie Poulain'],
    },
  },
  SENX: {
    name: 'The Palm Tree',
    code: 'S · E · N · X',
    essence: 'You view the world through a textural lens, as you seek to refuel your inner creative streak through every journey.',
    destination: {
      name: 'Siwa Oasis',
      country: 'Egypt',
      description: 'A remote desert sanctuary near the Libyan border.',
      bullets: [
        'Famous for its unique karsheef architecture — a mix of mud and salt — and its vast groves of olive and palm trees.',
        'Features shimmering turquoise salt lakes and natural springs that offer a sensory contrast to the surrounding Great Sand Sea.',
      ],
      imageUrl: 'https://images.pexels.com/photos/33661271/pexels-photo-33661271.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Zendaya', 'Moana'],
    },
  },
  SENZ: {
    name: 'The Romantic',
    code: 'S · E · N · Z',
    essence: 'When you step out into the world, you experience it through your senses and truly feel the moment. The growth you seek finds its way to you as you move, learn and trail through the world.',
    destination: {
      name: 'Zanzibar',
      country: 'Tanzania',
      description: 'An archipelago off the coast of East Africa with a rich, sensory history.',
      bullets: [
        'The Stone Town district is a labyrinth of narrow alleys, aromatic spice markets, and intricately carved wooden doors.',
        'Its coastline features dramatic tide changes that reveal sprawling sandbars and hidden tidepools.',
      ],
      imageUrl: 'https://images.pexels.com/photos/23877182/pexels-photo-23877182.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Dev Patel', 'Jay Gatsby'],
    },
  },
  SEPX: {
    name: 'The Wandering Artisan',
    code: 'S · E · P · X',
    essence: 'Every destination comes with a map. For you, that map is a bridge that brings you closer to where your feet want to be. You find joy in the little, yet meaningful things — be it a warm 2-minute exchange with the local baker or a friendly wave to your next-door homestay guest.',
    destination: {
      name: 'Essaouira',
      country: 'Morocco',
      description: 'A windswept coastal city known for its laid-back, creative vibe.',
      bullets: [
        'The medina is surrounded by 18th-century seafront ramparts and is filled with art galleries and woodworking shops.',
        'The strong Atlantic winds make it a haven for surfers and musicians, creating a rhythmic, coastal energy.',
      ],
      imageUrl: 'https://images.pexels.com/photos/10727384/pexels-photo-10727384.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Emma Watson', 'Zoë Kravitz'],
    },
  },
  SEPZ: {
    name: 'The Poet',
    code: 'S · E · P · Z',
    essence: 'You\'re an emotionally porous and innately curious human, which means that no experience is out of the realm of your imagination. Challenging the threshold is what brings a trip alive for you, and you know just how to get there.',
    destination: {
      name: 'Ronda',
      country: 'Spain',
      description: 'A dramatic city perched atop a deep gorge in Andalusia.',
      bullets: [
        'The town is split by the El Tajo canyon, connected by the 18th-century "New Bridge" (Puente Nuevo).',
        'Its literary history is deep, having been a favourite retreat for writers like Ernest Hemingway and Orson Welles.',
      ],
      imageUrl: 'https://images.pexels.com/photos/1703311/pexels-photo-1703311.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Sufjan Stevens', 'Timothée Chalamet'],
    },
  },
  AINX: {
    name: 'The Albatross',
    code: 'A · I · N · X',
    essence: 'Your instinct and impulse are your two best friends, leading you through all the adventures you have said yes to. An unplanned detour brings you more joy than a planned dining experience ever will, and that solitude you crave is seasoned with wonder.',
    destination: {
      name: 'La Gomera',
      country: 'Canary Islands, Spain',
      description: 'A rugged, circular island in the Canaries characterised by mist-shrouded laurel forests.',
      bullets: [
        'Features a network of ancient hiking trails that descend from volcanic peaks to secluded black-sand beaches.',
        'Home to "Silbo Gomero," a unique whistled language used to communicate across the island\'s deep ravines.',
      ],
      imageUrl: 'https://images.pexels.com/photos/34957478/pexels-photo-34957478.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Cillian Murphy', 'Robert Pattinson'],
    },
  },
  AINZ: {
    name: 'The Earth Whisperer',
    code: 'A · I · N · Z',
    essence: 'A nonconformist wanderer at heart, travel is a means through which you stay alive. Be it through unconventional routes or intentionally unplanned days, you never miss an opportunity to explore the world with child-like curiosity.',
    destination: {
      name: 'Torres del Paine',
      country: 'Chile',
      description: 'A masterpiece of raw, Patagonian wilderness.',
      bullets: [
        'Defined by its granite towers, massive glaciers, and bright blue icebergs.',
        'The park demands physical endurance, rewarding hikers with some of the most dramatic mountain vistas on the planet.',
      ],
      imageUrl: 'https://images.pexels.com/photos/26382392/pexels-photo-26382392.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['The Dalai Lama', 'Katniss Everdeen'],
    },
  },
  AIPX: {
    name: 'The Unhurried',
    code: 'A · I · P · X',
    essence: 'Time is a long-lost concept when you\'re on the road. Your days are decided by the richness that surrounds you, and your evenings bring a tale of quiet, gentle transformation. You\'re never quite the same again after a journey.',
    destination: {
      name: 'Luang Prabang',
      country: 'Laos',
      description: 'A tranquil city nestled at the confluence of the Mekong and Nam Khan rivers.',
      bullets: [
        'Known for its numerous Buddhist temples and the daily morning alms-giving ritual.',
        'The surrounding area features the multi-tiered Kuang Si Falls and lush jungle paths.',
      ],
      imageUrl: 'https://images.pexels.com/photos/17653315/pexels-photo-17653315.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Benedict Cumberbatch', 'Gandalf'],
    },
  },
  AIPZ: {
    name: 'The Treasure Hunter',
    code: 'A · I · P · Z',
    essence: 'The environment speaks to you and what better way to heighten this beautiful sense than through travel? You are naturally inclined to stories with centre and the emotions that come with it shape you.',
    destination: {
      name: 'Mostar',
      country: 'Bosnia and Herzegovina',
      description: 'A city where history is etched into every stone.',
      bullets: [
        'Famous for the Stari Most (Old Bridge), a reconstructed Ottoman bridge that is the heart of the city\'s identity.',
        'The streets are filled with artisan shops and echoes of a complex, resilient past.',
      ],
      imageUrl: 'https://images.pexels.com/photos/14016479/pexels-photo-14016479.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Tom Hardy', 'Indiana Jones'],
    },
  },
  AENX: {
    name: 'The Driftwood',
    code: 'A · E · N · X',
    essence: 'Life is all about reinvention for you. The new and unknown invite you in, and the creative play of travel — not escape — keeps you charmed and looped in.',
    destination: {
      name: 'Lombok',
      country: 'Indonesia',
      description: 'Bali before discovery — with waterfalls, jungle paths, and kind-hearted strangers along the way.',
      bullets: [
        'Home to the massive Mount Rinjani volcano and pristine, white-sand bays.',
        'The island offers a mix of intense trekking and quiet, hidden waterfalls.',
      ],
      imageUrl: 'https://images.pexels.com/photos/17850921/pexels-photo-17850921.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Harry Styles', 'Jack Sparrow'],
    },
  },
  AENZ: {
    name: 'The Ranger',
    code: 'A · E · N · Z',
    essence: 'You eat intensity for breakfast, and unlike others, intense experiences draw you in. A part of your existence is devoted to finding raw, real, and unforgettable moments — no matter how big or small.',
    destination: {
      name: 'The Azores',
      country: 'Portugal',
      description: 'A mid-Atlantic archipelago of volcanic islands known for its lush, green landscapes.',
      bullets: [
        'Known as the "Hawaii of Europe," featuring crater lakes, thermal springs, and high sea cliffs.',
        'The environment is raw and unpredictable, perfect for whale watching and coastal hiking.',
      ],
      imageUrl: 'https://images.pexels.com/photos/34391381/pexels-photo-34391381.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Lewis Hamilton', 'Lara Croft'],
    },
  },
  AEPX: {
    name: 'The Serendipitous',
    code: 'A · E · P · X',
    essence: 'You derive joy, strength and grounding from collective energy and deep transformation. You\'re every bit an inward explorer as you are outward — all it takes is the right time, place and fellow curious travellers on their feet.',
    destination: {
      name: 'Oaxaca',
      country: 'Mexico',
      description: 'A cultural powerhouse defined by its indigenous roots and vibrant arts.',
      bullets: [
        'Famous for its world-class culinary scene (mezcal and mole) and colourful street festivals.',
        'The city feels lived-in and personal, with bustling markets that are the centre of communal life.',
      ],
      imageUrl: 'https://images.pexels.com/photos/17029908/pexels-photo-17029908.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Pedro Pascal', 'Harry Potter'],
    },
  },
  AEPZ: {
    name: 'The Insatiable',
    code: 'A · E · P · Z',
    essence: 'Do you travel to dissolve, rebuild, and feel awakened? You have an unrivalled appetite for adventures waiting to happen, with strangers you may never see again and through a culture you\'ve never experienced before. Keep the curious hat on, always.',
    destination: {
      name: 'Almaty',
      country: 'Kazakhstan',
      description: 'Sophisticated and snow-dusted, with street art, steppe stories — Almaty attracts those who seek a new, unconventional frontier.',
      bullets: [
        'A blend of post-Soviet architecture, lush green parks, and a thriving modern creative pulse.',
        'Offers immediate access to the Trans-Ili Alatau, with wild mountain ridges and vast steppes.',
      ],
      imageUrl: 'https://images.pexels.com/photos/16980256/pexels-photo-16980256.jpeg?auto=compress&cs=tinysrgb&w=900&h=600&fit=crop',
      bumpInto: ['Anthony Bourdain', 'Julia Child'],
    },
  },
}

/**
 * Given a 4-letter archetype code (e.g. "SINX"), returns an ordered list of
 * InspirationStory `category` values this archetype tends toward, derived
 * from the quiz's own axes:
 *   - pace (S/A)        → Slow Travel / Adventure
 *   - focus (N/P)        → Wellness (nature) / Cultural (people & tradition)
 *   - orientation (I/E)  → (E leans toward shared/Milestone-style moments)
 * Used to lightly re-order recommendation stories toward what a client is
 * more likely to respond to — never to hide anything.
 */
export function archetypeCategoryPrefs(code: string | null | undefined): string[] {
  if (!code || code.length < 3) return []
  const prefs: string[] = []
  if (code[2] === 'N') prefs.push('Wellness')
  if (code[2] === 'P') prefs.push('Cultural')
  if (code[0] === 'S') prefs.push('Slow Travel')
  if (code[0] === 'A') prefs.push('Adventure')
  if (code[1] === 'E') prefs.push('Milestone')
  return prefs
}
