import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import sharp from 'sharp';

const OG_IMAGE_PATHS = [
  'home-2026-airport-ranking.png',
  'rankings-all.png',
  'monthly-reports.png',
  'deals-coupons.png',
  'risk-monitor.png',
  'methodology.png',
] as const;

test('core public OG images are committed as 1200x630 PNG assets', async () => {
  for (const filename of OG_IMAGE_PATHS) {
    const imagePath = path.resolve(process.cwd(), 'public', 'og', filename);
    const metadata = await sharp(imagePath).metadata();

    assert.equal(metadata.format, 'png', filename);
    assert.equal(metadata.width, 1200, filename);
    assert.equal(metadata.height, 630, filename);
  }
});
