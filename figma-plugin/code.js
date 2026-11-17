// Hungry Building Map — Figma Plugin
// Adds a "Building Map Feature" section to the "10 Prototype" page
// with 5 labeled phone frames for each map screen state

(async () => {
  const tenProtoPage = figma.root.children.find(p => p.name === '10 Prototype');
  if (!tenProtoPage) {
    figma.closePlugin('Error: Could not find "10 Prototype" page.');
    return;
  }

  await figma.setCurrentPageAsync(tenProtoPage);

  // Find lowest point of existing content to place new section below
  let maxY = 0;
  for (const node of tenProtoPage.children) {
    const bottom = node.y + node.height;
    if (bottom > maxY) maxY = bottom;
  }
  const startX = 0;
  const startY = maxY + 300;

  // Load fonts
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

  // Map screen states
  const mapScreens = [
    {
      name: 'Main Map View',
      desc: 'Floor plan overview · Stall dots · Floor tabs · Selected stall tooltip',
      stitch: 'b74c55848b2645ce8b732c9f95dbd33b',
      accent: { r: 0.91, g: 0.325, b: 0.118 },
    },
    {
      name: 'Stall Detail Sheet',
      desc: 'Bottom sheet on tap · Photo · Name · Rating · Join Queue CTA',
      stitch: 'd049189a50554bb5813d7ada97bf2cb6',
      accent: { r: 0.18, g: 0.55, b: 0.34 },
    },
    {
      name: 'Section Selector',
      desc: 'Large building divided into colour-coded wings · Section cards',
      stitch: '288cfea744fc47c38fc8299a66e827a0',
      accent: { r: 0.29, g: 0.35, b: 0.78 },
    },
    {
      name: 'Zoomed Floor View',
      desc: 'Zoomed into one section · Readable stall labels · Nearby strip',
      stitch: '2ccdc3ca11524295a2baaa7d1a65b709',
      accent: { r: 0.72, g: 0.42, b: 0.18 },
    },
    {
      name: 'Search on Map',
      desc: 'Search overlay · Highlighted result pins · Result list cards',
      stitch: '770f6c373ee140e28fbd4bccf27c4827',
      accent: { r: 0.16, g: 0.55, b: 0.78 },
    },
  ];

  // Layout
  const PHONE_W = 390;
  const PHONE_H = 844;
  const H_GAP = 80;
  const H_PAD = 80;
  const V_PAD = 80;
  const HEADER_H = 120;
  const LABEL_H = 80;

  const sectionW = H_PAD * 2 + mapScreens.length * PHONE_W + (mapScreens.length - 1) * H_GAP;
  const sectionH = HEADER_H + V_PAD + PHONE_H + LABEL_H + V_PAD;

  const createdIds = [];

  // ── HEADER BANNER ──────────────────────────────────────────────────────────
  const banner = figma.createFrame();
  banner.name = 'Building Map — Feasibility & Design';
  banner.resize(sectionW, 200);
  banner.x = startX;
  banner.y = startY - 260;
  banner.fills = [{ type: 'SOLID', color: { r: 0.05, g: 0.05, b: 0.08 } }];
  banner.cornerRadius = 20;
  tenProtoPage.appendChild(banner);
  createdIds.push(banner.id);

  const titleText = figma.createText();
  titleText.fontName = { family: 'Inter', style: 'Bold' };
  titleText.characters = '🗺  Building Map Feature — Interactive Floor Plan';
  titleText.fontSize = 28;
  titleText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  titleText.x = 48;
  titleText.y = 32;
  banner.appendChild(titleText);

  const subtitleText = figma.createText();
  subtitleText.fontName = { family: 'Inter', style: 'Regular' };
  subtitleText.characters = 'Stack: react-native-svg + react-native-gesture-handler · Geometric SVG floor plans per building · Tap-to-reveal stall details · Works on iOS & Android without paid APIs';
  subtitleText.fontSize = 15;
  subtitleText.fills = [{ type: 'SOLID', color: { r: 0.7, g: 0.7, b: 0.75 } }];
  subtitleText.x = 48;
  subtitleText.y = 80;
  subtitleText.textAutoResize = 'WIDTH_AND_HEIGHT';
  banner.appendChild(subtitleText);

  const feasText = figma.createText();
  feasText.fontName = { family: 'Inter', style: 'Bold' };
  feasText.characters = '✅ FEASIBLE  ·  ⚠️ No open OSM data for SG — use hand-crafted SVG geometry  ·  🔗 Designs at stitch.withgoogle.com/project/11940609752387078506';
  feasText.fontSize = 13;
  feasText.fills = [{ type: 'SOLID', color: { r: 0.91, g: 0.325, b: 0.118 } }];
  feasText.x = 48;
  feasText.y = 140;
  feasText.textAutoResize = 'WIDTH_AND_HEIGHT';
  banner.appendChild(feasText);

  // ── MAIN SECTION ──────────────────────────────────────────────────────────
  const section = figma.createFrame();
  section.name = 'Building Map — 5 Screen States';
  section.resize(sectionW, sectionH);
  section.x = startX;
  section.y = startY;
  section.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.98 } }];
  section.cornerRadius = 24;
  tenProtoPage.appendChild(section);
  createdIds.push(section.id);

  // Section header bar
  const headerBar = figma.createFrame();
  headerBar.name = 'Section Header';
  headerBar.resize(sectionW, HEADER_H);
  headerBar.x = 0;
  headerBar.y = 0;
  headerBar.fills = [{ type: 'SOLID', color: { r: 0.91, g: 0.325, b: 0.118 } }];
  headerBar.cornerRadius = 24;
  section.appendChild(headerBar);

  const headerTitle = figma.createText();
  headerTitle.fontName = { family: 'Inter', style: 'Bold' };
  headerTitle.characters = 'BUILDING MAP  ·  5 INTERACTION STATES';
  headerTitle.fontSize = 22;
  headerTitle.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  headerTitle.x = H_PAD;
  headerTitle.y = 28;
  headerBar.appendChild(headerTitle);

  const headerSub = figma.createText();
  headerSub.fontName = { family: 'Inter', style: 'Regular' };
  headerSub.characters = 'Hawker Centre & Mall Food Court · 390×844 iPhone · react-native-svg · Translatable to device';
  headerSub.fontSize = 14;
  headerSub.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.75 }];
  headerSub.x = H_PAD;
  headerSub.y = 64;
  headerBar.appendChild(headerSub);

  // ── PHONE FRAMES ──────────────────────────────────────────────────────────
  for (let i = 0; i < mapScreens.length; i++) {
    const screen = mapScreens[i];
    const phoneX = H_PAD + i * (PHONE_W + H_GAP);
    const phoneY = HEADER_H + V_PAD;

    // Phone frame
    const phone = figma.createFrame();
    phone.name = screen.name;
    phone.resize(PHONE_W, PHONE_H);
    phone.x = phoneX;
    phone.y = phoneY;
    phone.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.97 } }];
    phone.strokeWeight = 2;
    phone.strokes = [{ type: 'SOLID', color: screen.accent, opacity: 0.4 }];
    phone.cornerRadius = 32;
    section.appendChild(phone);
    createdIds.push(phone.id);

    // Step number badge
    const badge = figma.createEllipse();
    badge.resize(40, 40);
    badge.x = 16;
    badge.y = 16;
    badge.fills = [{ type: 'SOLID', color: screen.accent }];
    phone.appendChild(badge);

    const badgeNum = figma.createText();
    badgeNum.fontName = { family: 'Inter', style: 'Bold' };
    badgeNum.characters = String(i + 1);
    badgeNum.fontSize = 18;
    badgeNum.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    badgeNum.x = 36 - Math.round(badgeNum.width / 2);
    badgeNum.y = 28 - Math.round(badgeNum.height / 2);
    phone.appendChild(badgeNum);

    // Screen name label in center
    const nameLabel = figma.createText();
    nameLabel.fontName = { family: 'Inter', style: 'Bold' };
    nameLabel.characters = screen.name;
    nameLabel.fontSize = 16;
    nameLabel.fills = [{ type: 'SOLID', color: screen.accent }];
    nameLabel.textAlignHorizontal = 'CENTER';
    nameLabel.x = Math.round((PHONE_W - nameLabel.width) / 2);
    nameLabel.y = Math.round(PHONE_H / 2 - 30);
    phone.appendChild(nameLabel);

    // Stitch reference text
    const stitchRef = figma.createText();
    stitchRef.fontName = { family: 'Inter', style: 'Regular' };
    stitchRef.characters = `Stitch ID: ${screen.stitch.slice(0, 8)}…`;
    stitchRef.fontSize = 11;
    stitchRef.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];
    stitchRef.textAlignHorizontal = 'CENTER';
    stitchRef.x = Math.round((PHONE_W - stitchRef.width) / 2);
    stitchRef.y = Math.round(PHONE_H / 2 + 8);
    phone.appendChild(stitchRef);

    // Annotation below phone
    const stepLabel = figma.createFrame();
    stepLabel.name = `Label: ${screen.name}`;
    stepLabel.resize(PHONE_W, LABEL_H - 10);
    stepLabel.x = phoneX;
    stepLabel.y = phoneY + PHONE_H + 16;
    stepLabel.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    stepLabel.cornerRadius = 12;
    stepLabel.strokeWeight = 1;
    stepLabel.strokes = [{ type: 'SOLID', color: { r: 0.88, g: 0.88, b: 0.92 } }];
    section.appendChild(stepLabel);

    const stepName = figma.createText();
    stepName.fontName = { family: 'Inter', style: 'Bold' };
    stepName.characters = screen.name;
    stepName.fontSize = 13;
    stepName.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
    stepName.x = 14;
    stepName.y = 10;
    stepLabel.appendChild(stepName);

    const stepDesc = figma.createText();
    stepDesc.fontName = { family: 'Inter', style: 'Regular' };
    stepDesc.characters = screen.desc;
    stepDesc.fontSize = 11;
    stepDesc.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
    stepDesc.x = 14;
    stepDesc.y = 30;
    stepDesc.textAutoResize = 'WIDTH_AND_HEIGHT';
    stepLabel.appendChild(stepDesc);
  }

  // Scroll viewport to show new content
  figma.viewport.scrollAndZoomIntoView([banner, section]);

  figma.closePlugin(`✅ Building Map section added — 5 screen states + feasibility banner. View full designs at stitch.withgoogle.com/project/11940609752387078506`);
})();
