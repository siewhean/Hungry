# Hungry AI Video Prompts

## Usage Rule

Use AI video for atmosphere, transitions, kinetic text backgrounds, and generic city or hawker environment texture. Pair the output with real app UI capture and real dish photography whenever the final asset needs concrete product proof.

## Prompt Pack 1: 15-Second Social Hook

**Model suggestion:** `google/veo-3-1-fast`

**Scene prompt:**
```json
{
  "prompt": "Vertical 9:16 social ad for a Singapore dish-first food discovery app. Start with a relatable lunch indecision moment in a modern office district, warm daylight, subtle city movement, no brand logos, then transition into clean premium smartphone UI motion showing dish-first search, nearby local food choices, and a confident final recommendation. Warm paper-toned palette, hungry orange accent, deep navy typography, commercial quality, fast pace, built for silent viewing with space for bold caption overlays. Avoid generic restaurant glamour shots, avoid fake luxury dining, avoid purple tones, avoid exaggerated futuristic effects."
}
```

**Overlay copy sequence:**
- "What should I eat right now?"
- "Most apps start with the wrong search"
- "Hungry starts with the dish"
- "Join the waitlist"

**Kokoro TTS script:**
```json
{
  "prompt": "You know the dish. You just do not know the stall. Hungry helps you search by craving, compare nearby options, and decide faster. Join the waitlist.",
  "voice": "af_nicole"
}
```

## Prompt Pack 2: 30-Second Explainer

**Model suggestion:** `google/veo-3-1-fast`

**Scene 1 prompt:**
```json
{
  "prompt": "Mobile-first explainer opening for a Singapore food app. A person pauses on a busy lunch break, overwhelmed by too many venue choices on a phone, documentary realism, warm local urban atmosphere, high-end commercial editing, space for captions."
}
```

**Scene 2 prompt:**
```json
{
  "prompt": "Transition into a premium smartphone interface for a dish-first food discovery app. Show searching for a specific dish, then filtering by taste profile, then viewing nearby hawker and food-court options with clean metadata. Consumer-tech commercial style, elegant motion design, warm neutral palette, orange and navy accents, realistic UI presentation."
}
```

**Scene 3 prompt:**
```json
{
  "prompt": "Close the explainer with a confident local food decision moment: user walking toward a hawker stall after choosing from a dish-first app, warm evening light, subtle appetite-led food imagery, authentic Singapore food-court atmosphere, commercial quality, no fake brand signage."
}
```

**Kokoro TTS script:**
```json
{
  "prompt": "Choosing what to eat should not take longer than eating it. Hungry is a dish-first food discovery app for Singapore. Search the dish you want, filter by taste, compare nearby options, and head to the right stall with more confidence. Join the waitlist to try it first.",
  "voice": "am_michael"
}
```

**Recommended assembly:**
- Pair AI atmosphere shots with real UI capture from product prototypes
- Keep captions on every beat
- End card must contain the waitlist CTA only

## Prompt Pack 3: Hawker-Side Mini Story

**Model suggestion:** `bytedance/seedance-1-5-pro` or `google/veo-3-1-fast`

**Scene prompt:**
```json
{
  "prompt": "Short documentary-style brand video about local food discovery in Singapore. Focus on authentic hawker-stall atmosphere, hands preparing food, customers scanning options, and a smartphone interface that helps people discover stalls by the dish they crave. Warm, grounded, respectful, useful, not sentimental, not overly glossy, no fake celebrity energy, leave room for captions and CTA overlays."
}
```

**Caption sequence:**
- "Great dishes still get buried"
- "People search for the dish"
- "Hungry helps them find the stall behind it"
- "Register hawker interest"

**Kokoro TTS script:**
```json
{
  "prompt": "Some of the best local food is still too hard to find. Hungry is built to help people search by dish first, then discover the stall behind it with better local context. If you run a stall and want to hear more, register your interest.",
  "voice": "af_nicole"
}
```

## Negative Prompt Guidance

Add these guardrails when the model supports them:
- no purple gradients
- no fake food-delivery branding
- no luxury restaurant styling
- no glossy Silicon Valley office mood
- no futuristic hologram UI
- no fake testimonial scenes
- no made-up store signage that implies real partnerships

## Editing Guidance

- Keep the first 3 seconds legible without audio
- Use on-screen text that can survive a fast scroll
- Do not rely on AI food close-ups as factual product proof
- Composite real app UI and real dish photography into the final cut whenever possible
