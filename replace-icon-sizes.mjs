import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function getFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      if (entry !== 'node_modules' && entry !== 'dist') {
        getFiles(fullPath, files);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      if (!fullPath.includes('.test.')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

const files = getFiles('packages/desktop-client/src');

// Pattern 1: width={N} height={N} as direct props on Svg elements
const SVG_DIRECT_PROPS_REGEX = /(<Svg[A-Za-z0-9]+[^>]*?)width=\{(\d+)\}([^>]*?)height=\{(\d+)\}/g;

// Pattern 2: style={{ width: N, height: N }} inline on Svg elements
const SVG_INLINE_STYLE_REGEX = /(<Svg[A-Za-z0-9]+[^>]*?)style=\{\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}\}/g;

// Pattern 3: const iconStyle = { width: N, height: N } named style variables
const NAMED_STYLE_REGEX = /(const\s+\w+\s*=\s*\{[^}]*?)width:\s*(\d+)([^}]*?)height:\s*(\d+)([^}]*?\})/g;

let totalReplacements = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  let modified = content;

  // Handle Pattern 1 - direct props
  modified = modified.replace(SVG_DIRECT_PROPS_REGEX, (match, before, w, middle, h) => {
    if (!before.match(/Svg[A-Za-z]/)) return match;
    if (before.includes('style=') || middle.includes('style=')) {
      console.log(`  ⚠ Skipped (already has style prop): ${file}`);
      console.log(`    ${match.trim()}`);
      return match;
    }
    return `${before}style={{ width: 'var(--icon-size-${w})', height: 'var(--icon-size-${h})' }}${middle}`;
  });

  // Handle Pattern 2 - inline style objects on Svg elements
  modified = modified.replace(SVG_INLINE_STYLE_REGEX, (match, before, w, h) => {
    if (!before.match(/Svg[A-Za-z]/)) return match;
    return `${before}style={{ width: 'var(--icon-size-${w})', height: 'var(--icon-size-${h})' }}`;
  });

  // Handle Pattern 3 - named style variables containing width and height
  // Only replace inside objects that are used with Svg components
  modified = modified.replace(NAMED_STYLE_REGEX, (match, before, w, middle, h, after) => {
    // Only replace if this looks like an icon style (small numbers typical of icon sizes)
    if (parseInt(w) > 50 || parseInt(h) > 50) return match;
    return `${before}width: 'var(--icon-size-${w})'${middle}height: 'var(--icon-size-${h})'${after}`;
  });

  if (modified !== content) {
    writeFileSync(file, modified, 'utf8');
    totalReplacements++;
    console.log(`✓ Updated: ${file}`);
  }
}

console.log(`\nDone. Updated ${totalReplacements} files.`);
console.log(`Any lines marked ⚠ need to be merged manually in VSCode.`);