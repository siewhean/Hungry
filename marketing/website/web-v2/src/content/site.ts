export const siteNav = [
  { label: "For Foodies", href: "/for-foodies" },
  { label: "For Merchants", href: "/for-merchants" },
  { label: "About", href: "/#hawker-culture" },
] as const;

export const footerLinks = {
  legal: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Account Deletion", href: "/account/delete" },
  ],
  discover: [
    { label: "For Foodies", href: "/for-foodies" },
    { label: "For Merchants", href: "/for-merchants" },
    { label: "Hawker Culture", href: "/#hawker-culture" },
  ],
  connect: [
    { label: "Merchant Interest", href: "/join-waitlist?audience=merchant" },
    { label: "Join Waitlist", href: "/join-waitlist" },
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
    eyebrow: "Hungry? Don't know where to eat?",
    lines: ["Find your next", "makan place"],
    proof: "Find your favourite food instantly",
    body: "Hungry brings menus, dish photos, reviews, opening hours, and stall details into an app for foodies and merchants.",
    primaryCta: { label: "Join Waitlist", href: "/join-waitlist" },
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
      eyebrow: "Explore local cravings using real food proof",
      description:
        "See what people are eating, compare real dish photos, and check whether a stall is worth the trip before you leave.",
      image: {
        src: "/images/people/maxwell-hawker-centre-diners.jpg",
        alt: "People eating at Maxwell Food Centre in Singapore",
      },
      cta: { label: "Join Waitlist", href: "/join-waitlist" },
    },
    {
      title: "For merchants",
      eyebrow: "Share your stall",
      description:
        "Keep dishes, photos, menus, hours, and profile details visible when nearby diners are deciding what to eat next.",
      image: {
        src: "/images/people/hawker-cooking.jpg",
        alt: "Close-up of a Singapore hawker cooking at a stall",
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
    title: "Your personal local guide",
    description: "",
    cards: [
      {
        title: "Discover nearby food",
        description: "See nearby stalls, restaurants, and dishes without switching between apps.",
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
          "Check clearer hours and live context before making the trip across the neighbourhood.",
        icon: "open",
        variant: "plain",
        image: {
          src: "/images/people/hawker-cooking.jpg",
          alt: "Singapore hawker stall in service for opening-hours discovery",
        },
      },
      {
        title: "See menus before you go",
        description:
          "Browse visual menus with actual dish photos so you know what to order before you queue.",
        icon: "menu",
        variant: "open",
        image: {
          src: "/images/food/dishes-wide.png",
          alt: "Singapore dishes laid out visually for menu browsing",
        },
      },
    ],
  },
  productStory: [
    {
      eyebrow: "Browse",
      title: "Choose with real dish context.",
      description:
        "Nearby dishes, food photos, open status, and stall details sit in one decision view.",
      stat: "Discover",
      src: "/images/screens/foodies-screen.png",
      alt: "Hungry visual foodie discovery interface",
    },
    {
      eyebrow: "Compare",
      title: "Stop jumping between menus and reviews.",
      description:
        "Dish photos, menus, ratings, open status, and saved places stay in one flow.",
      stat: "Shortlist",
      src: "/images/screens/app-showcase.png",
      alt: "Hungry app screens showing discovery and dish details",
    },
    {
      eyebrow: "Operate",
      title: "Keep menu details current.",
      description:
        "Merchants update dishes, prices, photos, and availability from one surface.",
      stat: "Menu",
      src: "/images/screens/menu-management.png",
      alt: "Hungry menu management interface",
    },
    {
      eyebrow: "Stay current",
      title: "Prevent wasted trips.",
      description:
        "Opening-hour tools make closures, rest days, and regular hours easier to trust.",
      stat: "Hours",
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
  community: [
    {
      title: "Dish reviews",
      description: "Feedback stays with the dish, not hidden on a separate page.",
    },
    {
      title: "Local rankings",
      description:
        "Nearby saves and ratings help people compare real options faster.",
    },
    {
      title: "Photo proof",
      description:
        "Actual food photos answer questions a category label cannot.",
    },
  ],
} as const;

export const merchantPage = {
  hero: {
    title: "Make your food easier to choose before customers arrive.",
    description:
      "Hungry helps diners see your dishes, menu, hours, and profile details while they are deciding what to eat nearby.",
    cta: { label: "Register Merchant Interest", href: "/join-waitlist?audience=merchant" },
    secondaryCta: { label: "See merchant tools", href: "#merchant-tools" },
    image: {
      src: "/images/people/hawker-cooking.jpg",
      alt: "Singapore hawker stall owner cooking at the counter",
    },
  },
  benefits: {
    title: "Solve the gaps that lose hungry diners.",
    description:
      "A clear merchant profile gives customers the proof they need before they walk over.",
    items: [
      {
        title: "Show the dish first",
        description:
          "Turn signature dishes into visual reasons to visit, not just a venue name in a list.",
        icon: "visibility",
      },
      {
        title: "Keep stall information accurate",
        description:
          "Keep menus, prices, opening hours, photos, and other stall details current before stale information costs a visit.",
        icon: "menu",
      },
      {
        title: "Help diners know your stall",
        description:
          "Show what you serve, when you are open, where to find you, and why your stall is worth visiting.",
        icon: "hours",
      },
      {
        title: "See what diners care about",
        description:
          "Use dish views, profile interest, and review signals to understand what customers check before visiting.",
        icon: "analytics",
      },
      {
        title: "Customer replies",
        description:
          "Keep review follow-ups and diner questions visible so your team can respond before trust is lost.",
        icon: "replies",
      },
      {
        title: "Promotions",
        description:
          "Highlight seasonal dishes, discounts, or limited-time items when nearby diners are choosing what to eat.",
        icon: "promotions",
      },
    ],
  },
  workflow: {
    eyebrow: "Merchant workflow",
    title: "Make every dish easier to find before a diner arrives.",
    description:
      "Keep menus, hours, and profile details current so customers see what is available today.",
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
        description: "Make opening hours and special closures clearer for diners planning a trip.",
        image: "/images/screens/opening-hours.png",
      },
    ],
  },
  featureProof: {
    title: "Merchant tools for daily customer questions",
    description: "Profile, menu, and opening-hour screens keep customer-facing details current.",
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
    title: "Preview the merchant flow before onboarding.",
    description:
      "Hungry gives stall teams a focused place to manage customer-facing details before diners arrive.",
    items: [
      {
        title: "Dashboard overview",
        description: "See profile readiness, menu status, views, and review tasks in one place.",
      },
      {
        title: "Customer-facing preview",
        description: "Check how your stall and dishes appear to foodies before publishing changes.",
      },
      {
        title: "Operational prompts",
        description: "Spot missing photos, stale hours, and unreplied reviews before they hurt visits.",
      },
    ],
  },
  verification: {
    title: "Verify the stall before it goes live.",
    description:
      "A simple verification journey protects diners and gives merchants a clear path to launch.",
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
        description: "Hungry Console reviews the claim and updates the verification status.",
      },
    ],
  },
  profileMgmt: {
    title: "Keep the business profile accurate.",
    description:
      "Make core stall details clear for diners comparing nearby options.",
    items: [
      {
        title: "Location and hours",
        description: "Maintain outlet address, opening hours, closures, and contact details.",
      },
      {
        title: "Photos and cover image",
        description: "Show a professional first impression with current stall and food images.",
      },
      {
        title: "Profile completeness",
        description: "See what is missing before customers rely on incomplete information.",
      },
    ],
  },
  menuMgmt: {
    title: "Manage dishes without hiding the details diners need.",
    description:
      "Keep dish names, prices, images, categories, and availability ready for discovery.",
    features: [
      {
        title: "Dish catalogue",
        description: "Add and update menu items with descriptions, prices, and images.",
      },
      {
        title: "Availability control",
        description: "Mark dishes active or unavailable so customers do not make wasted trips.",
      },
      {
        title: "Menu preview",
        description: "Review the menu as customers see it before saving changes.",
      },
    ],
  },
  customerInbox: {
    title: "Respond where customer questions arrive.",
    description:
      "Keep review and enquiry follow-up connected to the stall profile.",
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
        description: "Surface urgent feedback so teams can respond quickly.",
      },
    ],
  },
  analytics: {
    title: "Understand what diners view before they visit.",
    description:
      "Use stall, dish, review, and promotion signals to improve the customer journey.",
    metrics: [
      {
        title: "Dish views",
        description: "See which dishes attract attention and which need stronger photos or copy.",
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
      "Create simple promotions that stay tied to real menu items and availability windows.",
    features: [
      {
        title: "Menu item promotions",
        description: "Apply a discount or promotional price to an existing dish.",
      },
      {
        title: "Scheduled visibility",
        description: "Set start and end dates so expired promotions do not appear active.",
      },
      {
        title: "Performance view",
        description: "Compare promotion views with regular menu performance.",
      },
    ],
  },
  aiAssistant: {
    title: "Turn merchant data into practical next steps.",
    description:
      "Rule-based insights help teams act on views, reviews, menu quality, and promotion signals.",
    features: [
      {
        title: "Photo improvement prompts",
        description: "Spot high-view dishes that may need clearer images or descriptions.",
      },
      {
        title: "Review theme detection",
        description: "Highlight repeated customer comments such as wait time or missing details.",
      },
      {
        title: "Weekly summary",
        description: "Summarise views, dish performance, new reviews, and open tasks.",
      },
    ],
  },
  creatorTypes: {
    title: "Different food businesses, same customer problem.",
    description: "People need to know what you serve, when you are open, and why it is worth the trip.",
    items: [
      {
        title: "Hawker stalls",
        description:
          "Show signature dishes clearly so locals can find the stall before they arrive.",
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
        description: "Help diners compare full menus by dish, photo, and availability.",
        image: {
          src: "/images/food/dishes-wide.png",
          alt: "Restaurant dishes presented for discovery",
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
    title: "Ready to make your menu easier to find?",
    description:
      "Join the merchant waitlist and we will follow up when onboarding opens.",
    cta: { label: "Register Merchant Interest", href: "/join-waitlist?audience=merchant" },
  },
} as const;
