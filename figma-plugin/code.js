// Hungry Design Iterations Plugin
// Creates 10 designer style sections with 5 phone frames each on the "10 Prototype" page

(async () => {
  // Find the "10 Prototype" page
  const tenProtoPage = figma.root.children.find(p => p.name === '10 Prototype');
  if (!tenProtoPage) {
    figma.closePlugin('Error: Could not find "10 Prototype" page.');
    return;
  }

  await figma.setCurrentPageAsync(tenProtoPage);

  // Find the rightmost edge of existing content to position new frames
  let maxX = 800;
  for (const node of tenProtoPage.children) {
    const right = node.x + node.width;
    if (right > maxX) maxX = right;
  }
  const startX = maxX + 300;
  const startY = 0;

  // Load fonts
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  // 10 designer style definitions
  const styles = [
    {
      name: 'Brutalist Editorial',
      subtitle: 'High-contrast, blocky type, bold orange accents',
      headerColor: { r: 0.91, g: 0.325, b: 0.118 },   // #E8531E
      bgColor: { r: 0.98, g: 0.97, b: 0.96 },
      phoneColor: { r: 0.91, g: 0.325, b: 0.118 },
      phoneOpacity: 0.08,
    },
    {
      name: 'Dark Neon Cyberpunk',
      subtitle: 'Near-black bg, neon glow highlights, electric accents',
      headerColor: { r: 0.04, g: 0.04, b: 0.12 },
      bgColor: { r: 0.08, g: 0.08, b: 0.16 },
      phoneColor: { r: 0.0, g: 0.9, b: 1.0 },
      phoneOpacity: 0.1,
    },
    {
      name: 'Print Editorial',
      subtitle: 'Newspaper-inspired, ink on paper, editorial serif',
      headerColor: { r: 0.15, g: 0.15, b: 0.15 },
      bgColor: { r: 0.97, g: 0.95, b: 0.9 },
      phoneColor: { r: 0.15, g: 0.15, b: 0.15 },
      phoneOpacity: 0.06,
    },
    {
      name: 'Material You M3',
      subtitle: 'Dynamic color, rounded cards, expressive M3 motion',
      headerColor: { r: 0.39, g: 0.55, b: 0.92 },
      bgColor: { r: 0.94, g: 0.96, b: 1.0 },
      phoneColor: { r: 0.39, g: 0.55, b: 0.92 },
      phoneOpacity: 0.1,
    },
    {
      name: 'Luxury Fine Dining',
      subtitle: 'Gold/cream palette, elegant serif, understated premium',
      headerColor: { r: 0.13, g: 0.10, b: 0.07 },
      bgColor: { r: 0.98, g: 0.96, b: 0.90 },
      phoneColor: { r: 0.72, g: 0.58, b: 0.28 },
      phoneOpacity: 0.12,
    },
    {
      name: 'Zen Minimal Japanese',
      subtitle: 'Generous whitespace, soft grays, warm natural accents',
      headerColor: { r: 0.56, g: 0.52, b: 0.48 },
      bgColor: { r: 0.97, g: 0.96, b: 0.94 },
      phoneColor: { r: 0.56, g: 0.52, b: 0.48 },
      phoneOpacity: 0.08,
    },
    {
      name: 'Glassmorphism',
      subtitle: 'Frosted glass panels, blur layers, translucent depth',
      headerColor: { r: 0.29, g: 0.35, b: 0.60 },
      bgColor: { r: 0.11, g: 0.15, b: 0.24 },
      phoneColor: { r: 0.5, g: 0.65, b: 1.0 },
      phoneOpacity: 0.12,
    },
    {
      name: 'Retro Vintage',
      subtitle: 'Warm amber tones, retro type, nostalgic halftone feel',
      headerColor: { r: 0.72, g: 0.42, b: 0.18 },
      bgColor: { r: 0.99, g: 0.95, b: 0.85 },
      phoneColor: { r: 0.72, g: 0.42, b: 0.18 },
      phoneOpacity: 0.1,
    },
    {
      name: 'Playful Illustrated',
      subtitle: 'Bold rounded shapes, bright colors, friendly characters',
      headerColor: { r: 0.96, g: 0.62, b: 0.13 },
      bgColor: { r: 1.0, g: 0.97, b: 0.88 },
      phoneColor: { r: 0.96, g: 0.62, b: 0.13 },
      phoneOpacity: 0.1,
    },
    {
      name: 'Isometric 3D',
      subtitle: '3D perspective tiles, depth layering, spatial design',
      headerColor: { r: 0.16, g: 0.68, b: 0.62 },
      bgColor: { r: 0.88, g: 0.97, b: 0.96 },
      phoneColor: { r: 0.16, g: 0.68, b: 0.62 },
      phoneOpacity: 0.1,
    },
  ];

  // App screen types
  const screens = [
    'Home Feed',
    'Discover',
    'Stall Detail',
    'Building Layout',
    'Quick Review',
  ];

  // Layout dimensions
  const PHONE_W = 390;
  const PHONE_H = 844;
  const H_GAP = 60;        // gap between phone frames
  const H_PAD = 80;        // horizontal padding inside section
  const V_PAD = 80;        // vertical padding above/below phones
  const HEADER_H = 80;     // height of the colored header bar
  const LABEL_H = 40;      // height of screen label area below phone
  const SECTION_GAP = 100; // vertical gap between sections

  const sectionW = H_PAD * 2 + screens.length * PHONE_W + (screens.length - 1) * H_GAP;
  const sectionH = HEADER_H + V_PAD + PHONE_H + LABEL_H + V_PAD;

  const createdIds = [];

  for (let i = 0; i < styles.length; i++) {
    const style = styles[i];
    const sectionY = startY + i * (sectionH + SECTION_GAP);

    // --- Section container ---
    const section = figma.createFrame();
    section.name = `${i + 1}. ${style.name}`;
    section.resize(sectionW, sectionH);
    section.x = startX;
    section.y = sectionY;
    section.fills = [{ type: 'SOLID', color: style.bgColor }];
    section.cornerRadius = 24;
    section.clipsContent = false;
    tenProtoPage.appendChild(section);
    createdIds.push(section.id);

    // --- Header bar ---
    const header = figma.createFrame();
    header.name = 'Header';
    header.resize(sectionW, HEADER_H);
    header.x = 0;
    header.y = 0;
    header.fills = [{ type: 'SOLID', color: style.headerColor }];
    header.cornerRadius = 24;
    section.appendChild(header);

    // Style number badge
    const badge = figma.createFrame();
    badge.name = 'Badge';
    badge.resize(48, 48);
    badge.x = 24;
    badge.y = (HEADER_H - 48) / 2;
    badge.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.2 }];
    badge.cornerRadius = 24;
    header.appendChild(badge);

    const badgeNum = figma.createText();
    badgeNum.fontName = { family: 'Inter', style: 'Bold' };
    badgeNum.characters = String(i + 1);
    badgeNum.fontSize = 20;
    badgeNum.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    badgeNum.x = (48 - badgeNum.width) / 2;
    badgeNum.y = (48 - badgeNum.height) / 2;
    badge.appendChild(badgeNum);

    // Style name
    const styleNameText = figma.createText();
    styleNameText.fontName = { family: 'Inter', style: 'Bold' };
    styleNameText.characters = style.name.toUpperCase();
    styleNameText.fontSize = 22;
    styleNameText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    styleNameText.x = 88;
    styleNameText.y = 16;
    header.appendChild(styleNameText);

    // Subtitle
    const subtitleText = figma.createText();
    subtitleText.fontName = { family: 'Inter', style: 'Regular' };
    subtitleText.characters = style.subtitle;
    subtitleText.fontSize = 13;
    subtitleText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.75 }];
    subtitleText.x = 88;
    subtitleText.y = 44;
    header.appendChild(subtitleText);

    // --- Phone frames ---
    for (let j = 0; j < screens.length; j++) {
      const phoneX = H_PAD + j * (PHONE_W + H_GAP);
      const phoneY = HEADER_H + V_PAD;

      // Phone outer frame
      const phone = figma.createFrame();
      phone.name = screens[j];
      phone.resize(PHONE_W, PHONE_H);
      phone.x = phoneX;
      phone.y = phoneY;
      phone.fills = [{ type: 'SOLID', color: style.phoneColor, opacity: style.phoneOpacity }];
      phone.strokeWeight = 2;
      phone.strokes = [{ type: 'SOLID', color: style.phoneColor, opacity: 0.3 }];
      phone.cornerRadius = 32;
      section.appendChild(phone);
      createdIds.push(phone.id);

      // Screen label inside phone
      const screenLabel = figma.createText();
      screenLabel.fontName = { family: 'Inter', style: 'Regular' };
      screenLabel.characters = screens[j];
      screenLabel.fontSize = 14;
      screenLabel.fills = [{ type: 'SOLID', color: style.headerColor, opacity: 0.6 }];
      screenLabel.x = Math.round((PHONE_W - screenLabel.width) / 2);
      screenLabel.y = Math.round(PHONE_H / 2 - screenLabel.height / 2);
      phone.appendChild(screenLabel);

      // Column label below phone
      const colLabel = figma.createText();
      colLabel.fontName = { family: 'Inter', style: 'Bold' };
      colLabel.characters = screens[j];
      colLabel.fontSize = 13;
      colLabel.fills = [{ type: 'SOLID', color: style.headerColor }];
      colLabel.x = phoneX + Math.round((PHONE_W - colLabel.width) / 2);
      colLabel.y = phoneY + PHONE_H + 12;
      section.appendChild(colLabel);
    }
  }

  // Zoom to fit the new sections
  figma.viewport.scrollAndZoomIntoView(createdIds.map(id => figma.getNodeById(id)).filter(Boolean));

  figma.closePlugin(`✅ Created ${styles.length} designer style sections with ${screens.length} screens each (${styles.length * screens.length} frames total) on the "10 Prototype" page.`);
})();
