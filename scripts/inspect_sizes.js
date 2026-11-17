const { chromium } = require('@playwright/test');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const dimensions = await page.evaluate(() => {
    const mockup = document.querySelector('[class*="phoneMockup"]');
    const wrapper = document.querySelector('[class*="deviceWrapper"]');
    const device = document.querySelector('[class*="deviceWrapper"] > [class*="device"]');
    const screen = document.querySelector('[class*="deviceWrapper"] [class*="screen"]:not([class*="screenLayer"])');

    const getDetails = (el, name) => {
      if (!el) return { name, error: 'not found' };
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);
      return {
        name,
        width: rect.width,
        height: rect.height,
        ratio: rect.width / rect.height,
        display: styles.display,
        position: styles.position,
        heightStyle: styles.height,
        widthStyle: styles.width,
        maxHeightStyle: styles.maxHeight,
        maxWidthStyle: styles.maxWidth,
        aspectRatio: styles.aspectRatio,
        flex: styles.flex
      };
    };

    return {
      mockup: getDetails(mockup, 'mockup'),
      wrapper: getDetails(wrapper, 'wrapper'),
      device: getDetails(device, 'device'),
      screen: getDetails(screen, 'screen')
    };
  });

  console.log(JSON.stringify(dimensions, null, 2));
  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
