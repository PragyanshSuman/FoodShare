// Static content pages: shipped with the build, zero runtime cost.
export type ContentPage = { title: string; intro: string; sections: { heading: string; points: string[] }[] };

export const GUIDES: Record<string, ContentPage> = {
  "food-safety": {
    title: "Food-safety guide",
    intro: "Shared food must be as safe as food you'd serve your own family. These rules are enforced when you post, and recipients can report anything that falls short.",
    sections: [
      {
        heading: "What you can share",
        points: [
          "Cooked food that has been held hot (above 60 °C) or chilled (below 5 °C) since cooking.",
          "Bakery items, fruit, vegetables and sealed packaged food within their best-before date.",
          "Packaged food past its best-before (quality) date only if the pack is intact — never past a use-by (safety) date.",
        ],
      },
      {
        heading: "What you must not share",
        points: [
          "Food that has been served on a plate, buffet leftovers left at room temperature over 2 hours, or partially eaten food.",
          "Raw meat, fish or eggs from home kitchens.",
          "Anything with damaged packaging, off smells, mould, or that has been re-frozen after thawing.",
          "Alcohol, medicines or supplements.",
        ],
      },
      {
        heading: "Time limits we enforce",
        points: [
          "Hot-held food: must be eaten within 4 hours of cooking.",
          "Prepared meals at room temperature: within 24 hours; chilled prepared meals: within 48 hours.",
          "Pickup must always end before the food's safe-until time.",
        ],
      },
      {
        heading: "Labelling & allergens",
        points: [
          "Declare all major allergens (gluten, dairy, eggs, nuts, peanuts, soy, fish, shellfish, sesame, mustard).",
          "Mark vegetarian / vegan / egg / non-veg correctly (green/brown dot convention).",
          "Write the cooking time and contents on the container if you can.",
        ],
      },
      {
        heading: "Legal protection",
        points: [
          "India: the FSSAI (Recovery and Distribution of Surplus Food) Regulations, 2019 support good-faith donation; surplus-food distribution agencies should register with FSSAI.",
          "USA: the Bill Emerson Good Samaritan Food Donation Act (as amended by the Food Donation Improvement Act, 2023) protects good-faith donors, including direct donations.",
          "Protection depends on good faith — follow this guide and you are acting in good faith.",
        ],
      },
    ],
  },
  "community-guidelines": {
    title: "Community guidelines",
    intro: "FoodShare works because people show up and treat each other well.",
    sections: [
      {
        heading: "Reserve only what you'll collect",
        points: [
          "Claim limits keep food available for everyone: 2 active / 3 per day for individuals, higher for verified NGOs.",
          "If plans change, cancel — someone else can have it. Three missed pickups pause claiming for 14 days.",
        ],
      },
      {
        heading: "Be honest",
        points: ["Describe food accurately, with real photos.", "Don't resell donated food.", "Surplus sales must be genuinely discounted (at least 30%)."],
      },
      {
        heading: "Be respectful",
        points: ["No harassment, discrimination or pressure in chat.", "Phone numbers are shared only for the pickup — don't use them for anything else."],
      },
      {
        heading: "Moderation",
        points: [
          "Reports are reviewed by people; food-safety reports first.",
          "Three independent food-safety reports pause a listing automatically until reviewed.",
          "Serious or repeated violations lead to suspension.",
        ],
      },
    ],
  },
  "how-it-works": {
    title: "How FoodShare works",
    intro: "From surplus to someone's plate in four steps.",
    sections: [
      { heading: "1. Post", points: ["Donors post food with quantity, diet, allergens, storage and a pickup window.", "Businesses can give verified NGOs a head start (e.g. 30 minutes) before the public sees it."] },
      { heading: "2. Reserve", points: ["Stock is reserved atomically — two people can never get the last portion.", "Paid surplus is held for 15 minutes while the buyer pays.", "Donors can require approval for large pickups; they have an hour to respond."] },
      {
        heading: "3. Hand over",
        points: [
          "The collector shows a 6-digit code; the donor types it to confirm. That's the proof of handover.",
          "Exact home addresses and phone numbers are only revealed once a pickup is confirmed.",
        ],
      },
      {
        heading: "4. Deliver (optional)",
        points: [
          "Recipients who can't travel can request a volunteer. The volunteer shows the pickup code to the donor and enters the recipient's drop code on arrival.",
          "Volunteers earn a stipend from the sponsor-funded Rescue Fund when it has balance.",
        ],
      },
      {
        heading: "Editing a live listing",
        points: ["While people hold reservations you can extend the pickup window, add stock, and update the description or instructions.", "To change anything else, withdraw it — everyone is notified and refunded — and post again."],
      },
    ],
  },
};

export const LEGAL: Record<string, ContentPage> = {
  terms: {
    title: "Terms of use",
    intro: "Template terms — have them reviewed by a lawyer in your jurisdiction before launch.",
    sections: [
      { heading: "The service", points: ["FoodShare connects people and organisations who have surplus food with those who can use it. We are a platform, not a food business; donors are responsible for the food they share."] },
      { heading: "Accounts", points: ["You must give accurate information and be 18+.", "Organisations must hold the licences required to handle or sell food where they operate."] },
      { heading: "Surplus sales", points: ["Verified businesses may sell surplus at a discount. Buyers pay FoodShare, which remits the seller's share after handover, minus commission.", "Refunds: full refund if the seller cancels; buyer cancellations at least 60 minutes before pickup ends are refunded."] },
      { heading: "Conduct & safety", points: ["Follow the food-safety guide and community guidelines. We may remove content and suspend accounts that put people at risk."] },
      { heading: "Liability", points: ["To the extent the law allows, FoodShare is not liable for the condition of food shared between users. Statutory good-samaritan protections apply to donors acting in good faith."] },
    ],
  },
  privacy: {
    title: "Privacy policy",
    intro: "We collect only what is needed to move food safely, and we never sell your data or show ads.",
    sections: [
      { heading: "What we collect", points: ["Account details (name, email, optional phone), your home area if you set it, listings, reservations, messages, and payment records.", "Organisation documents for verification, stored privately and viewed only by our review team."] },
      { heading: "Who sees what", points: ["Individual donors' exact addresses are shown only to confirmed collectors; others see an approximate area (~1 km).", "Phone numbers are shown only between parties with a confirmed pickup."] },
      { heading: "Processors", points: ["Hosting & database, object storage (e.g. Cloudflare R2), email delivery, and payment processors (Razorpay / Stripe). Card details never touch our servers."] },
      { heading: "Your rights", points: ["Download all your data or close your account at any time from Settings (GDPR / India DPDP Act 2023).", "Closing anonymises your profile; donation and payment records are kept as required by law."] },
      { heading: "Retention", points: ["Read notifications are deleted after 90 days; expired sessions and tokens automatically."] },
    ],
  },
};
