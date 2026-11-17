export const siteNav = [
  { label: "Discover Food", href: "/for-foodies" },
  { label: "For Business", href: "/for-merchants" },
  { label: "Our Story", href: "/#hawker-culture" },
] as const;

export const footerLinks = {
  legal: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Account Deletion", href: "/account/delete" },
  ],
  discover: [
    { label: "Discover Food", href: "/for-foodies" },
    { label: "For Business", href: "/for-merchants" },
    { label: "Hawker Culture", href: "/#hawker-culture" },
  ],
  connect: [
    { label: "Join Waitlist", href: "/join-waitlist" },
    { label: "Contact", href: "/contact" },
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
    eyebrow: "For hungry days in Singapore",
    lines: ["Know what to eat.", "Before you leave."],
    proof: "Find the dish. Check the stall. Skip the wasted trip.",
    body: "The only app that lets you discover local stalls by their best dishes, check live opening hours, and see the menu—before you leave your seat.",
    primaryCta: { label: "Join Waitlist", href: "/join-waitlist" },
    secondaryCta: { label: "Explore Foodies", href: "/for-foodies" },
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
      eyebrow: "Choose with real dish photos",
      description:
        "See what people are eating, compare dish photos, and decide if a stall is worth the trip.",
      image: {
        src: "/images/people/singapore-yusheng-restaurant-diners.jpg",
        alt: "Families dining at a Singapore restaurant in Suntec City",
      },
      cta: { label: "Explore Foodies", href: "/for-foodies" },
    },
    {
      title: "For merchants",
      eyebrow: "Share your stall",
      description:
        "Keep your dishes, photos, menu, hours, and stall details visible when nearby diners are choosing lunch or dinner.",
      image: {
        src: "/images/people/singapore-hawker-stall-cooking.jpg",
        alt: "Close-up of a hawker cooking food at a Singapore stall",
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
  localGuide: {
    title: "A local guide that starts with food",
    description: "",
    cards: [
      {
        title: "Discover nearby food",
        description: "See nearby stalls, restaurants, and dishes without bouncing between apps.",
        icon: "explore",
        variant: "map",
        image: {
          src: "/images/people/maxwell-hawker-centre-diners.jpg",
          alt: "Diners at a Singapore hawker centre for nearby discovery",
        },
      },
      {
        title: "Find the dish",
        description: "Search by craving, dish name, or local favourite instead of only by venue.",
        icon: "dish",
        variant: "dish",
        image: {
          src: "/images/food/laksa-topdown.png",
          alt: "Close-up top-down bowl of Singapore laksa",
        },
      },
      {
        title: "Know what is open",
        description:
          "Check hours and open status before crossing the neighbourhood.",
        icon: "open",
        variant: "plain",
        image: {
          src: "/images/people/singapore-hawker-stall-cooking.jpg",
          alt: "Singapore hawker stall preparing food during service",
        },
      },
      {
        title: "See menus before you go",
        description:
          "Browse menus with dish photos, prices, and availability before you queue.",
        icon: "menu",
        variant: "open",
        image: {
          src: "/images/screens/menu-management.png",
          alt: "Hungry visual menu screen with dish photos, prices, and availability",
        },
      },
    ],
  },
  productStory: [
    {
      eyebrow: "Discover",
      title: "Start with what is nearby.",
      description:
        "Open Hungry and see nearby dishes, search, popular picks, quick actions, and quick bites in one screen.",
      stat: "Discover",
      src: "",
      alt: "Hungry Discover page shown inside an iPhone 17 frame",
    },
    {
      eyebrow: "Stall details",
      title: "Open the stall before you go.",
      description:
        "Check the address, open status, distance, photos, and signature dishes before you head over.",
      stat: "Stall",
      src: "/images/screens/stall-detail.png",
      alt: "Hungry stall detail page shown inside an iPhone 17 frame",
    },
    {
      eyebrow: "Menu",
      title: "Check the menu.",
      description:
        "See dish photos, names, descriptions, prices, and availability without digging through old menu photos.",
      stat: "Menu",
      src: "/images/screens/dish-detail.png",
      alt: "Hungry dish detail page shown inside an iPhone 17 frame",
    },
    {
      eyebrow: "Reviews",
      title: "Read what others ate.",
      description:
        "Reviews stay tied to dishes, so a good rating comes with the food people actually ordered.",
      stat: "Reviews",
      src: "",
      alt: "Hungry review feed with mock content shown inside an iPhone 17 frame",
    },
  ] satisfies StoryScreen[],
  cultureCards: [
    {
      title: "Hawker stalls",
      description:
        "Everyday favourites show up by dish, not just by stall name.",
      image: {
        src: "/images/food/stalls-restaurants-wide.png",
        alt: "Hawker and restaurant food discovery scene",
      },
    },
    {
      title: "Kopitiam staples",
      description: "Compare quick meals nearby, from kopi runs to late lunches.",
      image: {
        src: "/images/food/laksa-topdown.png",
        alt: "Local noodle dish representing kopitiam food discovery",
      },
    },
    {
      title: "Cafes and bakes",
      description: "Neighbourhood cafes and home-based makers sit beside hawker stalls.",
      image: {
        src: "/images/food/bak-chor-mee-topdown.png",
        alt: "Local noodle dish representing neighbourhood food discovery",
      },
    },
    {
      title: "Restaurants",
      description:
        "Restaurant dishes appear beside hawker favourites, so the choice is about the meal.",
      image: {
        src: "/images/food/dishes-wide.png",
        alt: "Restaurant and dish discovery image collage",
      },
    },
  ],
  community: [
    {
      title: "Dish reviews",
      description: "Feedback stays with the dish.",
    },
    {
      title: "Local rankings",
      description:
        "Nearby saves and ratings make shortlisting less painful.",
    },
    {
      title: "Food photos",
      description:
        "Food photos answer questions that category labels cannot.",
    },
  ],
} as const;

export const merchantPage = {
  hero: {
    title: "Help diners choose your food before they arrive.",
    description:
      "Hungry shows your dishes, menu, hours, and stall details while nearby diners are still deciding where to eat.",
    cta: { label: "Register Merchant Interest", href: "/join-waitlist?audience=merchant" },
    image: {
      src: "/images/people/hawker-cooking.jpg",
      alt: "Singapore hawker stall owner cooking at the counter",
    },
  },
  benefits: {
    title: "Fix the gaps that cost you diners.",
    description:
      "A clear profile answers the questions people ask before they walk over.",
    items: [
      {
        title: "Show the dish first",
        description:
          "Put your signature dishes where people can see them, not behind a stall name.",
        icon: "visibility",
      },
      {
        title: "Keep stall information accurate",
        description:
          "Update menus, prices, hours, photos, and stall details before old information costs a visit.",
        icon: "menu",
      },
      {
        title: "Help diners know your stall",
        description:
          "Show what you serve, when you open, and where to find you.",
        icon: "hours",
      },
      {
        title: "See what diners care about",
        description:
          "See which dishes, photos, and reviews people check before visiting.",
        icon: "analytics",
      },
      {
        title: "Customer replies",
        description:
          "Keep review replies and diner questions together, so your team can respond faster.",
        icon: "replies",
      },
      {
        title: "Promotions",
        description:
          "Show seasonal dishes, discounts, or limited-time items while nearby diners are choosing.",
        icon: "promotions",
      },
    ],
  },
  workflow: {
    eyebrow: "Merchant tools",
    title: "Make each dish easier to find.",
    description:
      "Keep menus, hours, and profile details current, so customers know what is available today.",
    steps: [
      {
        title: "Claim the profile",
        description:
          "Start with the essentials: business name, location, cuisine, and signature dishes.",
        image: "/images/screens/merchant-dashboard.png",
      },
      {
        title: "Keep menus alive",
        description:
          "Update dishes, prices, photos, and availability before customers see old information.",
        image: "/images/screens/menu-management.png",
      },
      {
        title: "Show what is open",
        description: "Keep regular hours and special closures clear.",
        image: "/images/screens/opening-hours.png",
      },
    ],
  },
  featureProof: {
    title: "Tools for the questions diners ask every day",
    description: "Profile, menu, and opening-hour screens keep public details current.",
    items: [
      {
        title: "Profile readiness",
        description: "See missing details before customers do.",
        image: {
          src: "/images/screens/merchant-dashboard.png",
          alt: "Hungry merchant dashboard showing profile readiness",
        },
      },
      {
        title: "Menu control",
        description: "Keep dish photos and menu information current.",
        image: {
          src: "/images/screens/menu-management.png",
          alt: "Hungry merchant menu management screen",
        },
      },
      {
        title: "Opening hours",
        description: "Update regular hours and closure details.",
        image: {
          src: "/images/screens/opening-hours.png",
          alt: "Hungry merchant opening-hours editor",
        },
      },
    ],
  },
  previewFeatures: {
    title: "Preview the merchant tools before onboarding.",
    description:
      "Hungry gives stall teams a clear place to manage the details diners see.",
    items: [
      {
        title: "Dashboard overview",
        description: "See profile readiness, menu status, views, and review tasks together.",
      },
      {
        title: "Customer-facing preview",
        description: "Check how your stall and dishes look before publishing changes.",
      },
      {
        title: "Operational prompts",
        description: "Spot missing photos, stale hours, and unreplied reviews early.",
      },
    ],
  },
  verification: {
    title: "Verify the stall before it goes live.",
    description:
      "Verification keeps fake listings out and gives real merchants a clear launch path.",
    steps: [
      {
        title: "Submit business details",
        description: "Share outlet name, location, contact details, and business type.",
      },
      {
        title: "Upload proof",
        description: "Add licence, storefront, menu, or ownership proof for review.",
      },
      {
        title: "Get reviewed",
        description: "Hungry Console reviews the claim and updates the status.",
      },
    ],
  },
  profileMgmt: {
    title: "Keep the business profile accurate.",
    description:
      "Make the basic stall details easy to trust.",
    items: [
      {
        title: "Location and hours",
        description: "Maintain outlet address, opening hours, closures, and contact details.",
      },
      {
        title: "Photos and cover image",
        description: "Use current stall and food photos, not a blank profile.",
      },
      {
        title: "Profile completeness",
        description: "See missing fields before customers hit them.",
      },
    ],
  },
  menuMgmt: {
    title: "Manage dishes without losing the details.",
    description:
      "Keep dish names, prices, photos, categories, and availability ready for customers.",
    features: [
      {
        title: "Dish catalogue",
        description: "Add and update menu items with descriptions, prices, and images.",
      },
      {
        title: "Availability control",
        description: "Mark dishes active or unavailable before someone makes a wasted trip.",
      },
      {
        title: "Menu preview",
        description: "Review the menu as customers see it before saving.",
      },
    ],
  },
  customerInbox: {
    title: "Respond where customer questions arrive.",
    description:
      "Keep reviews and enquiries tied to the stall profile.",
    features: [
      {
        title: "Unreplied review queue",
        description: "Find reviews that still need a merchant response.",
      },
      {
        title: "Team visibility",
        description: "Let approved team members help manage customer follow-up.",
      },
      {
        title: "Low-rating attention",
        description: "Flag urgent feedback so teams can respond quickly.",
      },
    ],
  },
  analytics: {
    title: "See what diners check before they visit.",
    description:
      "Use stall, dish, review, and promotion data to improve the listing.",
    metrics: [
      {
        title: "Dish views",
        description: "See which dishes get attention and which need better photos or copy.",
      },
      {
        title: "Review trends",
        description: "Track average rating, new reviews, and unreplied feedback.",
      },
      {
        title: "Menu performance",
        description: "Compare views across dishes and categories over time.",
      },
    ],
  },
  promotions: {
    title: "Promote the right item at the right time.",
    description:
      "Create simple promotions tied to real menu items and dates.",
    features: [
      {
        title: "Menu item promotions",
        description: "Apply a discount or promotional price to an existing dish.",
      },
      {
        title: "Scheduled visibility",
        description: "Set start and end dates so expired promotions disappear.",
      },
      {
        title: "Performance view",
        description: "Compare promotion views with regular menu performance.",
      },
    ],
  },
  aiAssistant: {
    title: "Turn merchant data into next steps.",
    description:
      "Rule-based insights point out issues in views, reviews, menu quality, and promotions.",
    features: [
      {
        title: "Photo improvement prompts",
        description: "Spot high-view dishes that need clearer images or descriptions.",
      },
      {
        title: "Review theme detection",
        description: "Highlight repeated comments about wait time, missing details, or service.",
      },
      {
        title: "Weekly summary",
        description: "Summarise views, dish performance, new reviews, and open tasks.",
      },
    ],
  },
  creatorTypes: {
    title: "Different food businesses, same diner questions.",
    description: "People want to know what you serve, when you open, and whether the trip is worth it.",
    items: [
      {
        title: "Hawker stalls",
        description:
          "Show signature dishes clearly so locals can find you before they arrive.",
        image: {
          src: "/images/food/stalls-restaurants-wide.png",
          alt: "Bustling Singapore hawker stall scene",
        },
        size: "large",
      },
      {
        title: "Cafes and bakeries",
        description: "Make coffee, bakes, and brunch items visible when nearby diners search.",
        image: {
          src: "/images/people/restaurant-diner.jpg",
          alt: "Local diners enjoying a warm Singapore restaurant meal",
        },
        size: "wide",
      },
      {
        title: "Restaurants",
        description: "Let diners compare your menu by dish, photo, and availability.",
        image: {
          src: "/images/food/chili-crab-topdown.png",
          alt: "Singapore chilli crab dish for restaurant menu discovery",
        },
        size: "small",
      },
      {
        title: "Home-based",
        description: "Explain what you make and when customers can order it.",
        image: {
          src: "/images/food/dim-sum-topdown.png",
          alt: "Home-based specialty food represented by dim sum",
        },
        size: "small",
      },
    ],
  },
  finalCta: {
    title: "Want diners to find your menu faster?",
    description:
      "Join the merchant waitlist. We will follow up when onboarding opens.",
    cta: { label: "Register Merchant Interest", href: "/join-waitlist?audience=merchant" },
  },
} as const;
