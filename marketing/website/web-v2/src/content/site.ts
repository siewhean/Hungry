export const siteNav = [
  { label: "For Foodies", href: "/for-foodies" },
  { label: "For Merchants", href: "/for-merchants" },
  { label: "About", href: "/#hawker-culture" },
  { label: "Merchant Portal", href: "/for-merchants#merchant-flow" },
] as const;

export const footerLinks = {
  legal: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
  ],
  discover: [
    { label: "For Foodies", href: "/for-foodies" },
    { label: "For Merchants", href: "/for-merchants" },
    { label: "Hawker Culture", href: "/#hawker-culture" },
  ],
  connect: [
    { label: "Merchant Interest", href: "/for-merchants" },
    { label: "Join Waitlist", href: "/for-foodies" },
    { label: "Contact", href: "mailto:hello@hungry.sg" },
  ],
} as const;

export type ImageAsset = {
  src: string;
  alt: string;
};

export const topDownFoodImages = [
  { src: "/images/food/laksa-topdown.png", alt: "Top-down bowl of Singapore laksa" },
  { src: "/images/food/chicken-rice-topdown.png", alt: "Top-down plate of chicken rice" },
  { src: "/images/food/char-kway-teow-topdown.png", alt: "Top-down plate of char kway teow" },
  { src: "/images/food/bak-chor-mee-topdown.png", alt: "Top-down bowl of bak chor mee" },
  { src: "/images/food/nasi-lemak-topdown.png", alt: "Top-down plate of nasi lemak" },
  { src: "/images/food/hokkien-mee-topdown.png", alt: "Top-down plate of hokkien mee" },
  { src: "/images/food/wanton-mee-topdown.png", alt: "Top-down bowl of wanton mee" },
  { src: "/images/food/prawn-mee-topdown.png", alt: "Top-down bowl of prawn mee" },
  { src: "/images/food/fishball-noodles-topdown.png", alt: "Top-down bowl of fishball noodles" },
  { src: "/images/food/mee-siam-topdown.png", alt: "Top-down bowl of mee siam" },
  { src: "/images/food/mee-rebus-topdown.png", alt: "Top-down bowl of mee rebus" },
  { src: "/images/food/roti-prata-topdown.png", alt: "Top-down plate of roti prata with curry" },
  { src: "/images/food/satay-topdown.png", alt: "Top-down plate of satay" },
  {
    src: "/images/food/carrot-cake-topdown.png",
    alt: "Top-down plate of Singapore fried carrot cake",
  },
  { src: "/images/food/oyster-omelette-topdown.png", alt: "Top-down plate of oyster omelette" },
  { src: "/images/food/nasi-biryani-topdown.png", alt: "Top-down plate of nasi biryani" },
  { src: "/images/food/yong-tau-foo-topdown.png", alt: "Top-down bowl of yong tau foo" },
  { src: "/images/food/fish-soup-topdown.png", alt: "Top-down bowl of sliced fish soup" },
  { src: "/images/food/chili-crab-topdown.png", alt: "Top-down plate of chili crab" },
  { src: "/images/food/popiah-topdown.png", alt: "Top-down plate of popiah" },
  { src: "/images/food/duck-rice-topdown.png", alt: "Top-down plate of roast duck rice" },
  { src: "/images/food/ice-kacang-topdown.png", alt: "Top-down bowl of ice kacang" },
  { src: "/images/food/dim-sum-topdown.png", alt: "Top-down plate of Chinese dim sum" },
  { src: "/images/food/mapo-tofu-topdown.png", alt: "Top-down bowl of mapo tofu" },
  { src: "/images/food/beef-chow-fun-topdown.png", alt: "Top-down plate of beef chow fun" },
  { src: "/images/food/peking-duck-topdown.png", alt: "Top-down plate of Peking duck" },
  { src: "/images/food/bibimbap-topdown.png", alt: "Top-down bowl of Korean bibimbap" },
  { src: "/images/food/kimchi-jjigae-topdown.png", alt: "Top-down bowl of kimchi jjigae" },
  { src: "/images/food/korean-bbq-topdown.png", alt: "Top-down plate of Korean BBQ" },
  { src: "/images/food/tteokbokki-topdown.png", alt: "Top-down bowl of tteokbokki" },
  { src: "/images/food/sushi-set-topdown.png", alt: "Top-down plate of Japanese sushi" },
  { src: "/images/food/ramen-topdown.png", alt: "Top-down bowl of Japanese ramen" },
  { src: "/images/food/katsu-curry-topdown.png", alt: "Top-down plate of Japanese katsu curry" },
  { src: "/images/food/oyakodon-topdown.png", alt: "Top-down bowl of oyakodon" },
  { src: "/images/food/tacos-topdown.png", alt: "Top-down plate of Mexican tacos" },
  { src: "/images/food/burrito-bowl-topdown.png", alt: "Top-down bowl of Mexican burrito bowl" },
] as const satisfies readonly ImageAsset[];

export type StoryScreen = ImageAsset & {
  eyebrow: string;
  title: string;
  description: string;
  stat: string;
};

export const homepage = {
  hero: {
    eyebrow: "Singapore dish-first food discovery",
    lines: ["Discover food around you.", "Get Hungry."],
    proof: "Find the dish. Not just the restaurant.",
    body: "Hungry helps foodies discover nearby dishes, menus, reviews, rankings, and stall information while helping merchants get discovered by people deciding what to eat next.",
    primaryCta: { label: "Join Waitlist", href: "/for-foodies" },
    secondaryCta: { label: "Register Interest", href: "/for-merchants" },
    atmosphere: {
      src: "/images/food/stalls-restaurants-wide.png",
      alt: "Warm local food discovery scene with dishes and stalls",
    },
    appScreens: [
      {
        src: "/images/screens/foodies-screen.png",
        alt: "Hungry foodie discovery screen",
      },
      {
        src: "/images/screens/app-showcase.png",
        alt: "Hungry app mockup showcase",
      },
    ],
    cards: [
      { label: "Chicken rice near Bugis", tone: "orange" },
      { label: "Open now", tone: "green" },
      { label: "Menu available", tone: "cream" },
      { label: "Ranked by foodies", tone: "amber" },
    ],
    foodCards: [topDownFoodImages[0], topDownFoodImages[1], topDownFoodImages[2]],
  },
  audiences: [
    {
      title: "For foodies",
      eyebrow: "Decide faster",
      description:
        "Search by dish, compare actual food photos, and see whether a stall is worth the trip before hunger becomes indecision.",
      image: {
        src: "/images/people/restaurant-diner.jpg",
        alt: "Singaporean diners enjoying a meal in a local restaurant",
      },
      cta: { label: "Join Waitlist", href: "/for-foodies" },
    },
    {
      title: "For merchants",
      eyebrow: "Get found by craving",
      description:
        "Give diners a clear view of your menu, hours, signature dishes, and business details when they are already nearby and hungry.",
      image: {
        src: "/images/people/hawker-cooking.jpg",
        alt: "Singapore hawker-centre stall owner cooking at the counter",
      },
      cta: { label: "Register Interest", href: "/for-merchants" },
    },
  ],
  problems: [
    "Menus are scattered across photos, chats, and old links.",
    "Opening hours are unreliable until someone makes the trip.",
    "Great stalls get missed when discovery starts with venues instead of dishes.",
    "Smaller merchants lack a simple way to show what they actually serve today.",
  ],
  productStory: [
    {
      eyebrow: "Browse",
      title: "See food first, then decide where to go.",
      description:
        "A visual feed gives every dish room to stand out, with local context and enough detail to make a fast decision.",
      stat: "Dish-first",
      src: "/images/screens/foodies-screen.png",
      alt: "Hungry visual foodie discovery interface",
    },
    {
      eyebrow: "Compare",
      title: "Move from craving to shortlist without tab-hopping.",
      description:
        "Menus, ratings, open status, and community proof sit together so the next step feels obvious.",
      stat: "Menus + reviews",
      src: "/images/screens/app-showcase.png",
      alt: "Hungry app screens showing discovery and dish details",
    },
    {
      eyebrow: "Operate",
      title: "Merchants keep the live details fresh.",
      description:
        "Food businesses can update menus, opening hours, and profile details from a simple merchant surface.",
      stat: "Merchant-led",
      src: "/images/screens/menu-management.png",
      alt: "Hungry menu management interface",
    },
    {
      eyebrow: "Stay current",
      title: "Avoid disappointed trips with clearer hours.",
      description:
        "Opening hour tools and live profile states help users know what is open before they leave.",
      stat: "Open now",
      src: "/images/screens/opening-hours.png",
      alt: "Hungry opening hours editor interface",
    },
  ] satisfies StoryScreen[],
  cultureCards: [
    {
      title: "Hawker stalls",
      description:
        "Heritage dishes and everyday favourites surfaced by what people actually crave.",
      image: {
        src: "/images/food/stalls-restaurants-wide.png",
        alt: "Hawker and restaurant food discovery scene",
      },
    },
    {
      title: "Kopitiam staples",
      description: "From kopi runs to late lunches, quick meals become easier to compare nearby.",
      image: {
        src: "/images/food/laksa-topdown.png",
        alt: "Local noodle dish representing kopitiam food discovery",
      },
    },
    {
      title: "Cafes and bakes",
      description: "Neighbourhood cafes and home-based makers can be discovered alongside stalls.",
      image: {
        src: "/images/food/bak-chor-mee-topdown.png",
        alt: "Local noodle dish representing neighbourhood food discovery",
      },
    },
    {
      title: "Restaurants",
      description:
        "Restaurant dishes sit in the same decision flow as hawker favourites and hidden gems.",
      image: {
        src: "/images/food/dishes-wide.png",
        alt: "Restaurant and dish discovery image collage",
      },
    },
  ],
  merchantSteps: [
    {
      title: "Claim the profile",
      description:
        "Start with the essentials: business name, location, cuisine, and signature dishes.",
      image: "/images/screens/merchant-dashboard.png",
    },
    {
      title: "Keep menus alive",
      description:
        "Update dishes, prices, photos, and availability without waiting on a static listing.",
      image: "/images/screens/menu-management.png",
    },
    {
      title: "Show what is open",
      description: "Make opening hours and special closures clearer for diners planning a trip.",
      image: "/images/screens/opening-hours.png",
    },
  ],
  community: [
    {
      title: "Reviews attached to dishes",
      description: "Hungry keeps feedback close to the food people are deciding on.",
    },
    {
      title: "Local rankings",
      description:
        "Neighbourhood discovery becomes more useful when it reflects what nearby foodies save and rate.",
    },
    {
      title: "Photo-led confidence",
      description:
        "A dish photo answers questions faster than a venue name or generic category ever can.",
    },
  ],
} as const;
