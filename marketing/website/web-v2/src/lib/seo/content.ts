import { slugify } from "./slugs";

export type FaqItem = {
  answer: string;
  question: string;
};

export type SeoVenueSummary = {
  address: string;
  name: string;
  slug: string;
  type: "hawker_centre" | "mall_food_court";
};

export type AreaSeoContent = {
  description: string;
  dishSlugs: string[];
  faq: FaqItem[];
  goodFor: string[];
  mrtStation: string;
  name: string;
  relatedAreaSlugs: string[];
  slug: string;
  sourceNote: string;
  summary: string;
  transportNote: string;
  venues: SeoVenueSummary[];
};

export type DishSeoContent = {
  areaSlugs: string[];
  description: string;
  dietaryNotes: string[];
  faq: FaqItem[];
  name: string;
  relatedDishSlugs: string[];
  slug: string;
  sourceNote: string;
  summary: string;
};

export type DishAreaSeoContent = {
  areaSlug: string;
  dishSlug: string;
  faq: FaqItem[];
  sourceNote: string;
  summary: string;
  visibleVenues: SeoVenueSummary[];
};

export type PlaceSeoContent = {
  address: string;
  areaSlug: string;
  description: string;
  dishSlugs: string[];
  faq: FaqItem[];
  name: string;
  nearbyTransport: string;
  relatedPlaceSlugs: string[];
  slug: string;
  sourceNote: string;
  type: "hawker_centre" | "mall_food_court";
};

export type GuideSeoContent = {
  description: string;
  faq: FaqItem[];
  guideType: "tourist" | "dietary" | "budget" | "late_night" | "merchant";
  relatedAreaSlugs: string[];
  relatedDishSlugs: string[];
  sections: { body: string; heading: string }[];
  slug: string;
  sourceNote: string;
  title: string;
};

export const SEO_LAST_UPDATED = "2026-06-07";

const sharedSourceNote =
  "Hungry launch seed based on Singapore area, dish, and place records in this repository. Check current hours, queues, and prices before travelling.";

export const seoDishes: DishSeoContent[] = [
  {
    name: "Chicken Rice",
    slug: "chicken-rice",
    summary:
      "Chicken rice is one of Singapore's most searched comfort dishes, usually built around poached or roasted chicken, fragrant rice, chilli, and soup.",
    description:
      "Use Hungry to compare chicken rice without opening every stall page one by one.",
    areaSlugs: ["chinatown", "orchard", "jurong-east", "bugis", "raffles-place"],
    relatedDishSlugs: ["laksa", "char-kway-teow", "fish-soup"],
    dietaryNotes: ["Often not vegetarian.", "Halal status varies by stall and must be checked."],
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Where is chicken rice commonly searched for in Singapore?",
        answer:
          "Hungry starts with central and commuter areas such as Chinatown, Orchard, Jurong East, Bugis, and Raffles Place.",
      },
      {
        question: "Does Hungry show chicken rice ratings?",
        answer:
          "Ratings are only shown where real review data is available. This SEO page does not invent aggregate ratings.",
      },
    ],
  },
  {
    name: "Laksa",
    slug: "laksa",
    summary:
      "Laksa is a rich noodle dish with coconut gravy, spice, prawns, fish cake, and a strong local flavour.",
    description: "Hungry lets diners start with laksa, then narrow by area.",
    areaSlugs: ["chinatown", "bedok", "bugis", "orchard", "woodlands"],
    relatedDishSlugs: ["fish-soup", "chicken-rice", "yong-tau-foo"],
    dietaryNotes: [
      "Usually seafood-based.",
      "Vegetarian and halal status must be verified by stall.",
    ],
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Is this a list of ranked laksa stalls?",
        answer:
          "No. Hungry avoids ranking claims unless review and source data support them. This page explains the dish and links to relevant area pages.",
      },
      {
        question: "Can Hungry help find laksa nearby?",
        answer:
          "Yes. The app is built around nearby dish search, so laksa can be searched by area.",
      },
    ],
  },
  {
    name: "Char Kway Teow",
    slug: "char-kway-teow",
    summary:
      "Char kway teow is a wok-fried noodle dish commonly associated with smoky wok hei, egg, chives, bean sprouts, and seafood or Chinese sausage depending on stall.",
    description: "Hungry helps users compare char kway teow as a specific dish.",
    areaSlugs: ["chinatown", "serangoon", "bedok", "tampines"],
    relatedDishSlugs: ["chicken-rice", "laksa", "satay"],
    dietaryNotes: ["Usually not vegetarian.", "Ingredients and lard use vary by stall."],
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Does Hungry claim one char kway teow stall is best?",
        answer:
          "No. Public pages avoid unsupported best-stall claims.",
      },
      {
        question: "Why does dish-first search matter?",
        answer:
          "Many diners decide by craving first. Hungry starts from the dish, then shows nearby places.",
      },
    ],
  },
  {
    name: "Fish Soup",
    slug: "fish-soup",
    summary:
      "Fish soup is a common Singapore lunch choice, often searched by office areas, hawker centres, and MRT proximity.",
    description: "Hungry tracks fish soup as a common lunch and comfort-food search.",
    areaSlugs: ["raffles-place", "tanjong-pagar", "jurong-east", "tampines"],
    relatedDishSlugs: ["yong-tau-foo", "chicken-rice", "laksa"],
    dietaryNotes: ["Seafood-based.", "Check stall-specific ingredients for dietary restrictions."],
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Is fish soup usually a lunch search?",
        answer:
          "It is commonly searched around lunch and office areas, but opening status should always be verified before travelling.",
      },
      {
        question: "Does this page include real prices?",
        answer: "Not yet. Price fields are omitted until reliable price data is available.",
      },
    ],
  },
  {
    name: "Yong Tau Foo",
    slug: "yong-tau-foo",
    summary:
      "Yong tau foo is useful for diners who want a more customisable hawker or food-court meal.",
    description:
      "Hungry treats yong tau foo as a configurable dish search, not just a venue search.",
    areaSlugs: ["jurong-east", "tampines", "serangoon", "woodlands"],
    relatedDishSlugs: ["fish-soup", "laksa", "chicken-rice"],
    dietaryNotes: [
      "Ingredients vary widely.",
      "Soup base, sauces, and fried items should be checked by stall.",
    ],
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Why include yong tau foo in Hungry SEO pages?",
        answer:
          "Users often care about nearby availability, ingredients, and customisation.",
      },
      {
        question: "Does Hungry mark vegetarian yong tau foo automatically?",
        answer: "No. Vegetarian claims are only shown when the underlying data supports them.",
      },
    ],
  },
  {
    name: "Satay",
    slug: "satay",
    summary:
      "Satay is a grilled skewer dish often associated with evening meals, supper, and tourist-friendly hawker stops.",
    description: "Hungry connects satay searches to late-night and visitor food guides.",
    areaSlugs: ["raffles-place", "orchard", "chinatown", "serangoon"],
    relatedDishSlugs: ["char-kway-teow", "laksa", "chicken-rice"],
    dietaryNotes: ["Meat and peanut sauce are typical.", "Halal status must be checked by stall."],
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Is satay always available late at night?",
        answer:
          "No. This page does not publish hours unless verified; check current opening status before going.",
      },
      {
        question: "Is satay useful for visitors to Singapore?",
        answer:
          "Yes. Satay is common in first-time hawker food guides, especially for evening meals.",
      },
    ],
  },
];

export const seoPlaces: PlaceSeoContent[] = [
  {
    name: "Maxwell Food Centre",
    slug: "maxwell-food-centre",
    type: "hawker_centre",
    areaSlug: "chinatown",
    address: "1 Kadayanallur Street, Singapore 069184",
    nearbyTransport: "Near Chinatown and Tanjong Pagar",
    dishSlugs: ["chicken-rice", "laksa", "fish-soup"],
    relatedPlaceSlugs: ["chinatown-complex-market-and-food-centre", "lau-pa-sat"],
    description: "A central hawker centre for Chinatown, CBD, and visitor food searches.",
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Does this page publish Maxwell Food Centre opening hours?",
        answer:
          "No. Opening hours are left out until a verified public source is connected.",
      },
      {
        question: "Why is Maxwell included?",
        answer:
          "It is a central hawker centre in Hungry's Singapore food-directory seed data.",
      },
    ],
  },
  {
    name: "Chinatown Complex Market & Food Centre",
    slug: "chinatown-complex-market-and-food-centre",
    type: "hawker_centre",
    areaSlug: "chinatown",
    address: "335 Smith Street, Singapore 050335",
    nearbyTransport: "Near Chinatown MRT",
    dishSlugs: ["char-kway-teow", "chicken-rice", "laksa"],
    relatedPlaceSlugs: ["maxwell-food-centre", "lau-pa-sat"],
    description:
      "A large Chinatown hawker centre tied to central Singapore dish searches.",
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Are stall counts or ratings shown here?",
        answer: "No. This page avoids public counts and ratings unless verified data is available.",
      },
      {
        question: "What can this page help with?",
        answer: "It links Chinatown food searches to dishes and nearby Hungry area pages.",
      },
    ],
  },
  {
    name: "Lau Pa Sat",
    slug: "lau-pa-sat",
    type: "hawker_centre",
    areaSlug: "raffles-place",
    address: "18 Raffles Quay, Singapore 048582",
    nearbyTransport: "Near Raffles Place and Downtown",
    dishSlugs: ["satay", "char-kway-teow", "fish-soup"],
    relatedPlaceSlugs: ["maxwell-food-centre"],
    description:
      "A CBD food landmark for office lunch, visitors, and late-evening searches.",
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Does Hungry claim Lau Pa Sat is open now?",
        answer: "No. Real-time open status is omitted from SEO pages unless live data supports it.",
      },
      {
        question: "Which Hungry area page is related?",
        answer: "The Raffles Place food page is the primary related area page.",
      },
    ],
  },
  {
    name: "Jurong East Hawker Centre",
    slug: "jurong-east-hawker-centre",
    type: "hawker_centre",
    areaSlug: "jurong-east",
    address: "135 Jurong Gateway Road, Singapore 600135",
    nearbyTransport: "Near Jurong East MRT",
    dishSlugs: ["yong-tau-foo", "fish-soup", "chicken-rice"],
    relatedPlaceSlugs: ["koufu-jem"],
    description: "A west-side commuter food stop in Hungry's Jurong East discovery cluster.",
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Is this a ranked hawker-centre page?",
        answer: "No. It is a place page for verified location and related dishes.",
      },
      {
        question: "Can users verify current details?",
        answer:
          "Hungry will show current merchant or community data when those records are available.",
      },
    ],
  },
  {
    name: "Koufu @ JEM",
    slug: "koufu-jem",
    type: "mall_food_court",
    areaSlug: "jurong-east",
    address: "50 Jurong Gateway Road, Singapore 608549",
    nearbyTransport: "Near Jurong East MRT",
    dishSlugs: ["yong-tau-foo", "fish-soup", "chicken-rice"],
    relatedPlaceSlugs: ["jurong-east-hawker-centre"],
    description: "A Jurong East mall food-court page for shoppers and commuters.",
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Does this page include merchant operating hours?",
        answer: "No. Hours are omitted until reliable source data is wired into public pages.",
      },
      {
        question: "Why is this useful for SEO?",
        answer:
          "It connects mall-food searches to Jurong East without unsupported claims.",
      },
    ],
  },
  {
    name: "Food Republic @ Wisma Atria",
    slug: "food-republic-wisma-atria",
    type: "mall_food_court",
    areaSlug: "orchard",
    address: "435 Orchard Road, Singapore 238877",
    nearbyTransport: "Near Orchard MRT",
    dishSlugs: ["chicken-rice", "laksa", "char-kway-teow"],
    relatedPlaceSlugs: ["food-republic-313-somerset"],
    description: "A mall food-court page for Orchard Road food searches.",
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Are restaurant ratings included?",
        answer: "No. Ratings are not emitted until real review data is visible on the page.",
      },
      {
        question: "Which area page is related?",
        answer: "The Orchard food page links related dishes and nearby mall food courts.",
      },
    ],
  },
  {
    name: "Food Republic @ 313@somerset",
    slug: "food-republic-313-somerset",
    type: "mall_food_court",
    areaSlug: "orchard",
    address: "313 Orchard Road, Singapore 238895",
    nearbyTransport: "Near Somerset MRT",
    dishSlugs: ["laksa", "chicken-rice", "satay"],
    relatedPlaceSlugs: ["food-republic-wisma-atria"],
    description: "A Somerset and Orchard food-court page for mall-food searches.",
    sourceNote: sharedSourceNote,
    faq: [
      {
        question: "Does Hungry show live stall availability here?",
        answer: "No. Live availability is omitted unless connected to reliable business data.",
      },
      {
        question: "What should users do before travelling?",
        answer: "Verify current hours, stall availability, and prices before making the trip.",
      },
    ],
  },
];

export const seoAreas: AreaSeoContent[] = [
  {
    name: "Jurong East",
    slug: "jurong-east",
    mrtStation: "Jurong East",
    summary:
      "Jurong East food searches usually involve MRT convenience, mall food courts, commuter lunches, and west-side hawker options.",
    description:
      "Use this Hungry page to start from dishes and nearby food places around Jurong East without unsupported ranking claims.",
    dishSlugs: ["chicken-rice", "fish-soup", "yong-tau-foo"],
    goodFor: ["MRT-linked meals", "shopping-mall food courts", "weekday lunch"],
    transportNote: "Jurong East MRT is the primary transport anchor for this page.",
    relatedAreaSlugs: ["woodlands", "orchard", "tampines"],
    venues: ["jurong-east-hawker-centre", "koufu-jem"].map((slug) => placeToVenue(slug)),
    sourceNote: sharedSourceNote,
    faq: areaFaq("Jurong East", "Jurong East MRT"),
  },
  {
    name: "Orchard",
    slug: "orchard",
    mrtStation: "Orchard",
    summary:
      "Orchard food searches often include mall food courts, restaurants, cafes, and visitor-friendly local dishes near Orchard Road.",
    description:
      "Hungry keeps Orchard searches dish-first, so foodies can compare what to eat before choosing a venue.",
    dishSlugs: ["chicken-rice", "laksa", "char-kway-teow", "satay"],
    goodFor: ["shopping breaks", "visitor-friendly local food", "central cafes and restaurants"],
    transportNote: "Orchard and Somerset MRT stations are the main transport anchors.",
    relatedAreaSlugs: ["chinatown", "bugis", "raffles-place"],
    venues: ["food-republic-wisma-atria", "food-republic-313-somerset"].map((slug) =>
      placeToVenue(slug),
    ),
    sourceNote: sharedSourceNote,
    faq: areaFaq("Orchard", "Orchard MRT"),
  },
  {
    name: "Chinatown",
    slug: "chinatown",
    mrtStation: "Chinatown",
    summary:
      "Chinatown food searches cover hawker centres, heritage streets, visitor routes, and classic Singapore dishes.",
    description:
      "Hungry links Chinatown to nearby hawker centres and dish-level searches without inventing ratings or live hours.",
    dishSlugs: ["chicken-rice", "laksa", "char-kway-teow", "satay"],
    goodFor: ["hawker centres", "visitor food walks", "central Singapore meals"],
    transportNote: "Chinatown MRT is the primary transport anchor.",
    relatedAreaSlugs: ["raffles-place", "tanjong-pagar", "bugis"],
    venues: ["maxwell-food-centre", "chinatown-complex-market-and-food-centre", "lau-pa-sat"].map(
      (slug) => placeToVenue(slug),
    ),
    sourceNote: sharedSourceNote,
    faq: areaFaq("Chinatown", "Chinatown MRT"),
  },
  {
    name: "Tampines",
    slug: "tampines",
    mrtStation: "Tampines",
    summary:
      "Tampines food searches often focus on east-side town-centre meals, hawker options, and family-friendly food courts.",
    description: "Hungry treats Tampines as an east-side area for dish-first search.",
    dishSlugs: ["fish-soup", "yong-tau-foo", "char-kway-teow"],
    goodFor: ["east-side meals", "town-centre dining", "family meals"],
    transportNote: "Tampines MRT is the main transport anchor.",
    relatedAreaSlugs: ["bedok", "serangoon", "jurong-east"],
    venues: [
      {
        name: "Tampines Round Market & Food Centre",
        slug: "tampines-round-market-and-food-centre",
        type: "hawker_centre",
        address: "137 Tampines Street 11, Singapore",
      },
      {
        name: "Tampines mall food courts",
        slug: "tampines-mall-food-courts",
        type: "mall_food_court",
        address: "Tampines Central, Singapore",
      },
    ],
    sourceNote: sharedSourceNote,
    faq: areaFaq("Tampines", "Tampines MRT"),
  },
  {
    name: "Raffles Place",
    slug: "raffles-place",
    mrtStation: "Raffles Place",
    summary:
      "Raffles Place food searches are usually about CBD lunch, after-work meals, and visitor food around the financial district.",
    description:
      "Hungry links Raffles Place searches to lunch dishes, hawker centres, and nearby CBD food places.",
    dishSlugs: ["fish-soup", "satay", "chicken-rice"],
    goodFor: ["office lunch", "CBD meals", "after-work food"],
    transportNote: "Raffles Place MRT is the main transport anchor.",
    relatedAreaSlugs: ["tanjong-pagar", "chinatown", "bugis"],
    venues: ["lau-pa-sat", "maxwell-food-centre"].map((slug) => placeToVenue(slug)),
    sourceNote: sharedSourceNote,
    faq: areaFaq("Raffles Place", "Raffles Place MRT"),
  },
  {
    name: "Bugis",
    slug: "bugis",
    mrtStation: "Bugis",
    summary:
      "Bugis food searches combine mall meals, street-level cafes, nearby hawker areas, and central Singapore shopping routes.",
    description: "Hungry treats Bugis as a central area for dish-first local food search.",
    dishSlugs: ["chicken-rice", "laksa", "char-kway-teow"],
    goodFor: ["shopping breaks", "central local food", "student and visitor meals"],
    transportNote: "Bugis MRT is the main transport anchor.",
    relatedAreaSlugs: ["orchard", "chinatown", "raffles-place"],
    venues: [
      {
        name: "Bugis food courts and hawker streets",
        slug: "bugis-food-courts-and-hawker-streets",
        type: "mall_food_court",
        address: "Bugis, Singapore",
      },
      {
        name: "Albert Centre Market & Food Centre",
        slug: "albert-centre-market-and-food-centre",
        type: "hawker_centre",
        address: "270 Queen Street, Singapore",
      },
    ],
    sourceNote: sharedSourceNote,
    faq: areaFaq("Bugis", "Bugis MRT"),
  },
  {
    name: "Tanjong Pagar",
    slug: "tanjong-pagar",
    mrtStation: "Tanjong Pagar",
    summary:
      "Tanjong Pagar food intent covers CBD lunch, after-work meals, cafes, and nearby hawker centres.",
    description:
      "Hungry connects Tanjong Pagar to CBD lunch and Chinatown-adjacent food searches.",
    dishSlugs: ["fish-soup", "chicken-rice", "satay"],
    goodFor: ["CBD lunch", "after-work meals", "central hawker centres"],
    transportNote: "Tanjong Pagar MRT is the main transport anchor.",
    relatedAreaSlugs: ["raffles-place", "chinatown", "orchard"],
    venues: ["maxwell-food-centre", "lau-pa-sat"].map((slug) => placeToVenue(slug)),
    sourceNote: sharedSourceNote,
    faq: areaFaq("Tanjong Pagar", "Tanjong Pagar MRT"),
  },
  {
    name: "Serangoon",
    slug: "serangoon",
    mrtStation: "Serangoon",
    summary:
      "Serangoon food searches often include neighbourhood hawker food, casual restaurants, and supper around Serangoon Gardens.",
    description:
      "Hungry uses Serangoon as a north-east area cluster for dish-first food discovery.",
    dishSlugs: ["char-kway-teow", "yong-tau-foo", "satay"],
    goodFor: ["neighbourhood meals", "supper", "family dining"],
    transportNote: "Serangoon MRT is the main transport anchor.",
    relatedAreaSlugs: ["tampines", "bedok", "woodlands"],
    venues: [
      {
        name: "Serangoon Gardens Market & Food Centre",
        slug: "serangoon-gardens-market-and-food-centre",
        type: "hawker_centre",
        address: "49A Serangoon Garden Way, Singapore",
      },
      {
        name: "Serangoon town food courts",
        slug: "serangoon-town-food-courts",
        type: "mall_food_court",
        address: "Serangoon Central, Singapore",
      },
    ],
    sourceNote: sharedSourceNote,
    faq: areaFaq("Serangoon", "Serangoon MRT"),
  },
  {
    name: "Bedok",
    slug: "bedok",
    mrtStation: "Bedok",
    summary:
      "Bedok food intent is strongly neighbourhood-led, with east-side hawker centres, town-centre meals, and local dish searches.",
    description: "Hungry connects Bedok food searches to local dishes and nearby east-side areas.",
    dishSlugs: ["laksa", "fish-soup", "char-kway-teow"],
    goodFor: ["east-side hawker food", "neighbourhood meals", "town-centre food courts"],
    transportNote: "Bedok MRT is the main transport anchor.",
    relatedAreaSlugs: ["tampines", "serangoon", "woodlands"],
    venues: [
      {
        name: "Bedok Interchange Hawker Centre",
        slug: "bedok-interchange-hawker-centre",
        type: "hawker_centre",
        address: "Bedok Central, Singapore",
      },
      {
        name: "Bedok town food courts",
        slug: "bedok-town-food-courts",
        type: "mall_food_court",
        address: "Bedok, Singapore",
      },
    ],
    sourceNote: sharedSourceNote,
    faq: areaFaq("Bedok", "Bedok MRT"),
  },
  {
    name: "Woodlands",
    slug: "woodlands",
    mrtStation: "Woodlands",
    summary:
      "Woodlands food searches cover north-side neighbourhood meals, mall food courts, and commuter food around the MRT interchange.",
    description:
      "Hungry includes Woodlands in the first Singapore location cluster for north-side food search.",
    dishSlugs: ["laksa", "yong-tau-foo", "chicken-rice"],
    goodFor: ["north-side meals", "commuter food", "mall food courts"],
    transportNote: "Woodlands MRT is the main transport anchor.",
    relatedAreaSlugs: ["jurong-east", "serangoon", "bedok"],
    venues: [
      {
        name: "Woodlands Centre Road Food Centre",
        slug: "woodlands-centre-road-food-centre",
        type: "hawker_centre",
        address: "11 Woodlands Centre Road, Singapore",
      },
      {
        name: "Woodlands mall food courts",
        slug: "woodlands-mall-food-courts",
        type: "mall_food_court",
        address: "Woodlands, Singapore",
      },
    ],
    sourceNote: sharedSourceNote,
    faq: areaFaq("Woodlands", "Woodlands MRT"),
  },
];

export const dishAreaPages: DishAreaSeoContent[] = seoDishes.flatMap((dish) =>
  dish.areaSlugs.map((areaSlug) => {
    const area = getArea(areaSlug);

    if (!area) {
      throw new Error(`Invalid SEO dish area ${dish.slug}/${areaSlug}`);
    }

    return {
      areaSlug: area.slug,
      dishSlug: dish.slug,
      summary: `${dish.name} is a relevant Hungry dish search around ${area.name}. This page links the dish to nearby places without fake ratings or hours.`,
      visibleVenues: area.venues.slice(0, 2),
      sourceNote: sharedSourceNote,
      faq: [
        {
          question: `Can I use this page for ${dish.name} near ${area.name}?`,
          answer:
            "Yes. It connects the dish, the area, related places, and the Hungry app waitlist.",
        },
        {
          question: "Why are ratings and hours missing?",
          answer:
            "Hungry only shows ratings, review counts, and opening hours when those facts are supported by visible source data.",
        },
      ],
    };
  }),
);

export const seoGuides: GuideSeoContent[] = [
  {
    title: "What to Eat in Singapore: First-Timer Hawker Food Guide",
    slug: "what-to-eat-in-singapore-first-time",
    guideType: "tourist",
    description:
      "A first-timer guide to Singapore food built around dishes, hawker centres, and MRT-friendly planning.",
    relatedAreaSlugs: ["chinatown", "orchard", "raffles-place", "bugis"],
    relatedDishSlugs: ["chicken-rice", "laksa", "char-kway-teow", "satay"],
    sourceNote: sharedSourceNote,
    sections: [
      {
        heading: "Start with dishes, then choose the place",
        body: "A visitor usually knows the dish before knowing the stall. Hungry starts there.",
      },
      {
        heading: "Use MRT and area clues",
        body: "MRT access, weather, queues, and nearby errands all change where people eat in Singapore.",
      },
      {
        heading: "Verify details before travelling",
        body: "Opening hours, stall availability, and prices can change. Hungry does not publish those facts on SEO pages unless the data is visible and reliable.",
      },
    ],
    faq: [
      {
        question: "Is Hungry a delivery app?",
        answer:
          "No. Hungry is for finding food before you go, not ordering delivery.",
      },
      {
        question: "What dishes should first-time visitors search first?",
        answer:
          "Chicken rice, laksa, char kway teow, fish soup, yong tau foo, and satay are useful starting points in Hungry's first content cluster.",
      },
    ],
  },
  {
    title: "Halal Food Discovery in Singapore",
    slug: "halal-food",
    guideType: "dietary",
    description:
      "How Hungry handles halal-friendly food search in Singapore without unsupported certification claims.",
    relatedAreaSlugs: ["orchard", "tampines", "bugis", "woodlands"],
    relatedDishSlugs: ["chicken-rice", "satay", "laksa"],
    sourceNote: sharedSourceNote,
    sections: [
      {
        heading: "Halal claims need source-backed data",
        body: "Hungry should only show halal labels when the stall or data source supports that claim.",
      },
      {
        heading: "Area still matters",
        body: "Users often search for halal food near MRT stations, malls, offices, and family routes.",
      },
      {
        heading: "Dish search helps narrow choices",
        body: "A halal-aware search can start from a dish craving, then narrow to places with certification or merchant data.",
      },
    ],
    faq: [
      {
        question: "Does Hungry automatically mark food as halal?",
        answer: "No. Halal labels should only appear when supported by source or merchant data.",
      },
      {
        question: "Is this page a restaurant directory?",
        answer:
          "Not yet. It explains how Hungry will handle halal food search until verified venue records are connected.",
      },
    ],
  },
  {
    title: "Vegetarian Hawker Food Discovery in Singapore",
    slug: "vegetarian-food",
    guideType: "dietary",
    description:
      "A Singapore vegetarian food page focused on source-backed dietary data and dish-first search.",
    relatedAreaSlugs: ["chinatown", "bugis", "serangoon", "bedok"],
    relatedDishSlugs: ["yong-tau-foo", "fish-soup", "laksa"],
    sourceNote: sharedSourceNote,
    sections: [
      {
        heading: "Dietary data must be precise",
        body: "Vegetarian-friendly claims can depend on stock, sauces, and stall preparation. Hungry should not guess.",
      },
      {
        heading: "Customisable dishes need careful labels",
        body: "Dishes such as yong tau foo can be customisable, but the soup base and preparation still need verification.",
      },
      {
        heading: "Use area pages to narrow the search",
        body: "A useful vegetarian search needs dish, area, and source-backed dietary details.",
      },
    ],
    faq: [
      {
        question: "Does Hungry infer vegetarian status from dish names?",
        answer: "No. Dietary claims should come from merchant, menu, or verified source data.",
      },
      {
        question: "Why is this useful before launch?",
        answer:
          "It explains how Hungry handles dietary trust before full venue records are live.",
      },
    ],
  },
  {
    title: "Singapore Food Under 6 Dollars",
    slug: "food-under-6-dollars",
    guideType: "budget",
    description:
      "A budget-food page for Hungry, with price claims withheld until reliable menu data is connected.",
    relatedAreaSlugs: ["jurong-east", "bedok", "tampines", "woodlands"],
    relatedDishSlugs: ["chicken-rice", "fish-soup", "yong-tau-foo"],
    sourceNote: sharedSourceNote,
    sections: [
      {
        heading: "Budget pages need menu-backed prices",
        body: "Hungry should only index exact price pages when menu data is reliable enough to support them.",
      },
      {
        heading: "Start with hawker centres and food courts",
        body: "Budget searches are strongest around hawker centres, town centres, office areas, and MRT-linked food courts.",
      },
      {
        heading: "Avoid stale price claims",
        body: "Prices change often, so public pages should expose freshness labels and avoid unsupported exact pricing.",
      },
    ],
    faq: [
      {
        question: "Does this page list exact meals under S$6?",
        answer:
          "Not yet. It avoids exact price claims until Hungry has reliable source-backed menu prices.",
      },
      {
        question: "Why create the page now?",
        answer:
          "It sets the quality bar for budget-food pages before exact price data is published.",
      },
    ],
  },
  {
    title: "Late-Night Supper in Singapore",
    slug: "late-night-supper",
    guideType: "late_night",
    description:
      "A late-night Singapore food page that keeps open-now claims out until live hours are connected.",
    relatedAreaSlugs: ["orchard", "serangoon", "raffles-place", "chinatown"],
    relatedDishSlugs: ["satay", "char-kway-teow", "laksa"],
    sourceNote: sharedSourceNote,
    sections: [
      {
        heading: "Late-night pages need live hour confidence",
        body: "Hungry should not claim a place is open late unless operating hours are reliable and visible.",
      },
      {
        heading: "Supper is area-led",
        body: "Useful late-night search combines dish cravings with areas such as Orchard, Serangoon, Raffles Place, and Chinatown.",
      },
      {
        heading: "Use the app for current status",
        body: "The app can combine dish, location, and open status when reliable data exists.",
      },
    ],
    faq: [
      {
        question: "Does this page say which stalls are open now?",
        answer: "No. Open-now claims are omitted until live opening data is connected.",
      },
      {
        question: "Which dishes fit late-night searches?",
        answer:
          "Satay, char kway teow, and laksa are useful starting points in this launch set.",
      },
    ],
  },
];

export function getArea(slug: string) {
  return seoAreas.find((area) => area.slug === slug);
}

export function getDish(slug: string) {
  return seoDishes.find((dish) => dish.slug === slug);
}

export function getPlace(slug: string) {
  return seoPlaces.find((place) => place.slug === slug);
}

export function getGuide(slug: string) {
  return seoGuides.find((guide) => guide.slug === slug);
}

export function guidePath(guide: GuideSeoContent) {
  return `/guides/${guide.slug}`;
}

export function getAreaByMrtStation(station: string) {
  const normalizedStation = slugify(station);
  return seoAreas.find((area) => slugify(area.mrtStation) === normalizedStation);
}

export function getDishAreaPage(areaSlug: string, dishSlug: string) {
  return dishAreaPages.find((page) => page.areaSlug === areaSlug && page.dishSlug === dishSlug);
}

export function getRelatedAreas(area: AreaSeoContent) {
  return area.relatedAreaSlugs.map((slug) => getArea(slug)).filter(Boolean) as AreaSeoContent[];
}

export function getRelatedDishes(slugs: string[]) {
  return slugs.map((slug) => getDish(slug)).filter(Boolean) as DishSeoContent[];
}

export function getRelatedPlaces(place: PlaceSeoContent) {
  return place.relatedPlaceSlugs.map((slug) => getPlace(slug)).filter(Boolean) as PlaceSeoContent[];
}

function placeToVenue(slug: string): SeoVenueSummary {
  const place = seoPlaces.find((item) => item.slug === slug);

  if (!place) {
    throw new Error(`Missing SEO place seed: ${slug}`);
  }

  return {
    address: place.address,
    name: place.name,
    slug: place.slug,
    type: place.type,
  };
}

function areaFaq(areaName: string, mrtStation: string): FaqItem[] {
  return [
    {
      question: `What is ${areaName} useful for on Hungry?`,
      answer: `${areaName} is part of Hungry's first Singapore food set, connecting nearby areas, dishes, and visible places.`,
    },
    {
      question: `Does Hungry show food near ${mrtStation}?`,
      answer: `Yes. The ${mrtStation} page maps the MRT search back to the same area, while avoiding unsupported live-open or ranking claims.`,
    },
  ];
}
