# Comprehensive Research & Architecture Report: AI Gastronomy Engine

This document outlines the foundational research, fascinating biological and psychological phenomena of taste, and the architectural strategy for a highly personalized, AI-driven food recommendation engine. It bridges the gap between biological sensory perception, psychological food behavior, and machine learning architecture, specifically tailored for a food discovery platform featuring diverse local and hawker cuisines.

---

## Phase 1: Gastronomy & Taste Research (Deep Dive)

Taste is not a singular sense but a complex, multisensory integration of gustatory (tongue), olfactory (nose), and somatosensory (texture/temperature/pain) systems, heavily modulated by psychology. Gordon M. Shepherd coined the term **"Neurogastronomy"** to describe how the brain creates the perception of flavor. Flavor is an illusion constructed by the brain using inputs from all five senses.

### 1. Fascinating Factors Influencing Taste Perception

*   **Retronasal Olfaction (The "Back-Door" Smell):** Up to 80% of what we perceive as flavor actually comes from our sense of smell. As we chew, volatile aroma compounds are released and travel up the back of the throat to the nasal cavity.
*   **The Genetics of "Taste Blindness" (Supertasters):** In 1931, chemist Arthur Fox accidentally discovered that some people taste the chemical PTC as intensely bitter, while others taste nothing. This led to the discovery of the *TAS2R38* gene. People with two copies of the "taster" variant have more fungiform papillae (taste buds) and are considered "supertasters." They experience extreme bitterness from foods like broccoli, coffee, and dark chocolate.
*   **Sonic Seasoning (Tasting with Your Ears):** Oxford University research reveals "crossmodal correspondences" where sounds alter taste. High-pitched, tinkling, or "staccato" sounds enhance sweetness, while low-pitched, brassy, or "legato" sounds enhance bitterness. Conversely, loud white noise (like on an airplane) suppresses sweet and salty receptors, which is why airplane food often tastes bland.
*   **Temperature as a Molecular Switch:** The TRPM5 protein in our taste buds is highly sensitive to heat. Warming food generally increases the intensity of sweetness and bitterness (explaining why melted ice cream tastes much sweeter than frozen). Conversely, cold suppresses sweetness but enhances crunchiness and sourness.
*   **Cross-Modal Visual Perception:** The brain "tastes" with the eyes first. The "Bouba/Kiki" effect shows people associate round shapes with sweetness and angular shapes with bitterness/sourness. Color manipulation can completely trick experts; white wine dyed red is frequently described with "red wine" flavor notes (like cherry or oak) because the visual cue overrides the chemical taste.
*   **"Benign Masochism" (Spice & Pain):** Spiciness is not a taste; it triggers TRPV1 heat/pain receptors via capsaicin. Our love for spice is driven by "benign masochism"—the brain realizes the body isn't actually burning, transitioning the initial pain into a thrill-seeking endorphin rush. 

### 2. Flavor Categorization: The Hierarchical Taxonomy

To allow an AI to process complex dishes, we must translate subjective human experiences into a quantifiable Flavor Matrix. Drawing inspiration from the Specialty Coffee Association's Flavor Wheel and Sensory-Directed Flavor Analysis (SDFA), we utilize a 3-Tier Hierarchical Taxonomy.

| Tier 1: Macro-Profile | Tier 2: Aromatic/Textural Sub-Group | Tier 3: Specific Descriptors (Tags) | Example Hawker Dish Mapping |
| :--- | :--- | :--- | :--- |
| **Savory / Umami** | Rich, Fermented, Briny | Soy sauce, Hae Bee Hiam, Mushroom | *Char Kway Teow* (High Umami, High Fat) |
| **Spicy / Heat** | Pungent, Numbing, Lingering | Chili oil, Sichuan Peppercorn, Raw Garlic | *Mala Xiang Guo* (High Heat, Numbing) |
| **Sweet** | Caramelized, Fruity, Floral | Gula Melaka, Coconut, Pandan | *Ondeh Ondeh* (High Sweet, Floral) |
| **Sour / Tangy** | Citric, Fermented, Acetic | Calamansi, Tamarind, Vinegar | *Assam Laksa* (High Tangy, Briny) |
| **Bitter / Astringent** | Herbal, Roasted, Earthy | Bitter gourd, Charred, Strong Tea | *Herbal Mutton Soup* (High Bitter/Herbal) |
| **Mouthfeel / Matrix**| Heavy, Crisp, Viscous | Gelatinous, "Wok Hei", Crispy batter | *Oyster Omelette* (Crisp, Gelatinous) |

*Note: The "Food Matrix" dictates flavor release. A high-fat matrix (like Laksa broth) coats the tongue, creating a lingering "finish," whereas a water-based matrix (like clear Teochew fish soup) provides an immediate, sharp "attack."*

---

## Phase 2: Onboarding & Taste Quiz

To avoid survey fatigue and gather high-signal data, the onboarding quiz uses scenario-based comparative choices ("This or That") rather than sterile Likert scales.

### 1. Dietary Restrictions: The Hard-Filter Logic Gate
Before assessing taste, the AI must establish non-negotiable boundaries. 
*   **Question:** "Before we dig in, are there any hard limits on what you eat?"
*   **Options (Multi-select):** Halal-only, No Beef, No Pork/Lard, Vegetarian, Vegan, Gluten-Free, Peanut Allergy, Shellfish Allergy, None.
*   **AI Logic:** This creates an absolute boolean exclusion filter at the database query level. The AI will *never* score or recommend a dish that violates these tags.

### 2. Scenario-Based Taste Quiz (Psychological Profiling)

*   **Q1: The Heat Threshold (Spicy vs. Savory)**
    *   *Scenario:* "You are ordering a steaming bowl of noodles. What’s your chili strategy?"
    *   *Options:* 
        * A) "None, I want to taste the pure broth." (Low Spice, High Umami bias) 
        * B) "A little sambal on the side." (Moderate Spice) 
        * C) "Drench it in chili oil until it's red." (High Spice/Endorphin seeker)
*   **Q2: The Matrix Preference (Texture & Fat)**
    *   *Scenario:* "When it comes to ultimate comfort food, you prefer your meals to be..."
    *   *Options:* 
        * A) "Rich, creamy, and heavy." (High Lipid/Fat affinity) 
        * B) "Light, clear, and refreshing." (Low Fat, High Acid affinity) 
        * C) "Crispy, crunchy, and fried." (Somatosensory/Texture affinity)
*   **Q3: The Flavor Finish (Sweet vs. Bitter/Astringent)**
    *   *Scenario:* "To wash down a heavy meal, you reach for..."
    *   *Options:* 
        * A) "A sweet, milky Teh Peng or Bandung." (High Sweetness affinity) 
        * B) "A sharp, tangy Lime Juice." (High Acidity/Cleansing affinity) 
        * C) "A strong, bitter Kopi O Kosong." (High Bitterness/Astringency affinity - likely a "taster" or "non-taster" rather than supertaster)

*Output:* This quiz generates a baseline 6-dimensional vector for the user: `[Umami: 0.8, Spice: 0.2, Fat: 0.3, Acid: 0.7, Sweet: 0.4, Bitter: 0.1]`.

---

## Phase 3: AI Recommendation Architecture

### 1. The Tagging Ecosystem
To bridge the gap between our structured taxonomy and organic user behavior, we implement a **User-Generated Taste Tag system**. 
When a user leaves a review, they don't just leave a 1-5 star rating. They are prompted to select 1 to 3 "Vibe & Taste Tags" from our Tier 3 taxonomy (e.g., `Wok Hei`, `Super Spicy`, `Comforting`, `Too Sweet`). 

*   **NLP Parsing:** For free-text reviews, a lightweight NLP model (like a fine-tuned BERT) performs Entity-Level Sentiment Analysis to auto-extract tags (e.g., "The broth was incredibly rich but a bit too salty" -> `+Rich/Fat`, `-Salty`).

### 2. Data Weighting & Implicit Feedback Matrix

The recommendation algorithm (e.g., Collaborative Filtering combined with Content-Based Filtering) predicts a user's affinity for a dish by calculating the cosine similarity between the User's Taste Vector and the Dish's Flavor Vector.

| Data Source | Type | Weight | Decay/Impact Logic |
| :--- | :--- | :--- | :--- |
| **Dietary Restrictions** | Explicit | **Absolute (∞)** | Acts as a strict pre-filter (`WHERE is_halal = true`). |
| **Taste Quiz Baseline** | Explicit | High (Initial) | Sets the starting vector. Weight decays over time as real behavior data accumulates. |
| **5-Star Rating + Positive Tag** | Explicit | Very High | Pulls the user's vector strongly toward the dish's tags. (e.g., User 5-stars a dish tagged `Wok Hei`; User's `Smoky` affinity increases by +0.15). |
| **Saved/Bookmarked Dish** | Implicit | High | Indicates aspirational preference. Pulls vector toward dish traits (+0.10). |
| **1-2 Star Rating + Negative Tag** | Explicit | Very High | Pushes the user's vector away from those traits (e.g., 1-star + `Too Salty` -> User's `Salty` affinity drops by -0.20). |
| **Frequent Photo Clicks (Same Category)**| Implicit | Moderate | e.g., User clicks 5 photos of Laksa in a week. Increases affinity for `Rich/Coconut` matrix (+0.05). |

### 3. System Flow Architecture

The end-to-end AI recommendation flow operates in four continuous stages:

1.  **The Ingestion & Baseline Layer:**
    *   New user completes the Taste Quiz and sets Dietary Restrictions.
    *   System generates `User_Vector_v1` and stores hard-filters in the profile schema.
2.  **The Candidate Generation Layer (The Pre-Filter):**
    *   User opens the app looking for recommendations.
    *   System queries the database for stalls within a 5km radius.
    *   *Hard Filter applied:* Removes all stalls violating the user's dietary restrictions.
3.  **The Scoring & Ranking Layer (The AI Engine):**
    *   The AI calculates the mathematical distance (Cosine Similarity) between the `User_Vector` and the aggregated `Dish_Vectors` (which are defined by the community Taste Tags).
    *   Contextual Bandits apply temporal logic: If it's 8:00 AM, the algorithm slightly penalizes "Heavy/Rich" matrices and boosts "Light/Carb" matrices (like porridge or toast).
    *   Temperature/Weather API logic can optionally be applied (e.g. boosting "Hot Broth" on rainy days).
4.  **The Feedback Loop (Reinforcement Learning):**
    *   User eats at recommended stall and leaves a 4-star review with the tag `Tangy`.
    *   The AI updates the `Dish_Vector` (making the dish slightly more known for being Tangy).
    *   The AI updates the `User_Vector` (increasing the user's known affinity for Tangy foods).
    *   The next time the user opens the app, the Candidate Generation Layer is immediately more accurately tuned to their neurogastronomic profile.
