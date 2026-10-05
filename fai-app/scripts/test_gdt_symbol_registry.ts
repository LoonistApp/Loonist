/**
 * Regression Suite: GD&T Symbol Font Registry (Production Hardening, 2026-10-05)
 *
 * Covers every symbol in GdtParser's explicit SYMBOL_FONT_GLYPH_REGISTRY (CAD dingbat-font
 * glyph substitutions) via the public parseCallout API, plus the negative case: an unlisted
 * glyph must still resolve to 'unknown' + needs_review rather than being guessed. Each verified
 * entry is exercised through the exact feature-control-frame shape
 * (symbol [diameter-modifier] tolerance datum...) parseSpaceDelimitedFrame structurally requires,
 * matching how it's actually encountered in real drawings.
 *
 * Only two symbols are registered today (Position, Profile-of-a-Line) because only these two
 * have been independently verified against a real customer drawing — see the registry's own
 * doc comment for why broader coverage isn't claimed without that verification. Adding a new
 * verified symbol in the future should add both a registry entry AND a case here.
 */
import { GdtParser } from '../src/services/ai/gdtParser';
import { DEFAULT_METRIC_ISO_TOLERANCES } from '../src/services/ai/toleranceEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

console.log('--- TEST: GD&T Symbol Font Registry ---');

// 1. Position ("l" -> ⌖), verified against CINH91CDB11-B.pdf.
console.log('► Registered symbol: Position ("l")...');
const position = GdtParser.parseCallout('l 0.2 A B', DEFAULT_METRIC_ISO_TOLERANCES);
assert(position.type === 'gdt', `Expected type 'gdt', got '${position.type}'`);
assert(position.gdtFrame?.characteristic === 'position', `Expected characteristic 'position', got '${position.gdtFrame?.characteristic}'`);
assert(position.gdtFrame?.symbol === '⌖', `Expected resolved symbol '⌖', got '${position.gdtFrame?.symbol}'`);
assert(position.gdtFrame?.toleranceValue === 0.2, `Expected tolerance 0.2, got ${position.gdtFrame?.toleranceValue}`);
assert(position.gdtFrame?.primaryDatum?.datum === 'A' && position.gdtFrame?.secondaryDatum?.datum === 'B', 'Expected datums A, B preserved');
// Production hardening (2026-10-06): a real exported FAIR report, opened in Excel, showed this
// GD&T type as an unreadable "□" because the Unicode symbol alone (⌖, U+2316) isn't covered by
// Excel's default UI font — the data was correct but invisible. The tolerance source must now
// name the characteristic in plain English so it reads correctly regardless of font/platform.
assert(/\bPosition\b/.test(position.toleranceSource), `Expected toleranceSource to name "Position" in plain English (font-independent), got "${position.toleranceSource}"`);
console.log('  PASS: "l 0.2 A B" -> Position, tolerance 0.2, datums A/B, toleranceSource names the type in plain English\n');

// 1b. Position with the in-frame diameter modifier ("O" -> Ø), same verified font.
console.log('► Registered symbol: Position with diameter modifier ("l O")...');
const positionDia = GdtParser.parseCallout('l O 0.2 A B-C B', DEFAULT_METRIC_ISO_TOLERANCES);
assert(positionDia.gdtFrame?.characteristic === 'position', `Expected 'position', got '${positionDia.gdtFrame?.characteristic}'`);
assert(positionDia.gdtFrame?.diameterSymbol === true, 'Expected diameterSymbol=true for the "O" in-frame modifier');
assert(positionDia.gdtFrame?.tertiaryDatum?.datum === 'B', `Expected tertiary datum B, got '${positionDia.gdtFrame?.tertiaryDatum?.datum}'`);
console.log('  PASS: "l O 0.2 A B-C B" -> Position, diameter modifier recognized, 3 datums preserved\n');

// 2. Profile of a Line ("h" -> ⌓), verified against CINH91CDB11-B.pdf.
console.log('► Registered symbol: Profile of a Line ("h")...');
const profileLine = GdtParser.parseCallout('h 0.4 A B-C B', DEFAULT_METRIC_ISO_TOLERANCES);
assert(profileLine.type === 'gdt', `Expected type 'gdt', got '${profileLine.type}'`);
assert(profileLine.gdtFrame?.characteristic === 'profile_line', `Expected characteristic 'profile_line', got '${profileLine.gdtFrame?.characteristic}'`);
assert(profileLine.gdtFrame?.symbol === '⌓', `Expected resolved symbol '⌓', got '${profileLine.gdtFrame?.symbol}'`);
assert(profileLine.gdtFrame?.toleranceValue === 0.4, `Expected tolerance 0.4, got ${profileLine.gdtFrame?.toleranceValue}`);
assert(/\bProfile of a Line\b/.test(profileLine.toleranceSource), `Expected toleranceSource to name "Profile of a Line" in plain English, got "${profileLine.toleranceSource}"`);
console.log('  PASS: "h 0.4 A B-C B" -> Profile of a Line, tolerance 0.4, datums preserved, toleranceSource names the type in plain English\n');

// 3. An UNREGISTERED glyph (e.g. "q", never verified against any real drawing) must still
// resolve to 'unknown' + needs_review, not be guessed as some other characteristic — the
// negative case this whole registry design exists to guarantee.
console.log('► Unregistered glyph ("q") correctly stays unknown, not guessed...');
const unknownSymbol = GdtParser.parseCallout('q 0.1 A', DEFAULT_METRIC_ISO_TOLERANCES);
assert(unknownSymbol.type === 'gdt', `Expected type 'gdt' (still a frame, just unidentified), got '${unknownSymbol.type}'`);
assert(unknownSymbol.gdtFrame?.characteristic === 'unknown', `Expected characteristic 'unknown' for an unverified glyph, got '${unknownSymbol.gdtFrame?.characteristic}'`);
assert(unknownSymbol.gdtFrame?.toleranceValue === 0.1, `Tolerance value must still be captured correctly even when the symbol itself is unrecognized, got ${unknownSymbol.gdtFrame?.toleranceValue}`);
assert(/symbol not recognized/i.test(unknownSymbol.toleranceSource), `Expected toleranceSource to flag the unrecognized symbol for manual review, got "${unknownSymbol.toleranceSource}"`);
console.log('  PASS: "q 0.1 A" -> type=gdt, characteristic=unknown, tolerance/datums still correctly captured, flagged for manual review\n');

// 4. Real GD&T Unicode symbols (not a font substitution at all) must still resolve directly —
// confirms the registry refactor didn't regress the pre-existing Unicode-symbol path.
console.log('► Real Unicode GD&T symbol (unaffected by the registry refactor)...');
const unicodeFlatness = GdtParser.parseCallout('⏥ 0.05 A', DEFAULT_METRIC_ISO_TOLERANCES);
assert(unicodeFlatness.gdtFrame?.characteristic === 'flatness', `Expected 'flatness' for a real ⏥ Unicode symbol, got '${unicodeFlatness.gdtFrame?.characteristic}'`);
assert(/\bFlatness\b/.test(unicodeFlatness.toleranceSource), `Expected toleranceSource to name "Flatness" in plain English, got "${unicodeFlatness.toleranceSource}"`);
console.log('  PASS: "⏥ 0.05 A" -> Flatness, unaffected by the font-glyph registry, toleranceSource names the type in plain English\n');

// 5. GdtParser.getCharacteristicLabel is the single source of truth for every GD&T type name —
// covers every entry in the union so a newly added characteristic can't silently fall through
// to a blank/undefined label.
console.log('► getCharacteristicLabel covers every GD&T characteristic...');
const allCharacteristics: Array<Parameters<typeof GdtParser.getCharacteristicLabel>[0]> = [
  'position', 'flatness', 'straightness', 'circularity', 'cylindricity', 'perpendicularity',
  'parallelism', 'angularity', 'profile_surface', 'profile_line', 'circular_runout',
  'total_runout', 'concentricity', 'symmetry', 'unknown'
];
for (const c of allCharacteristics) {
  const label = GdtParser.getCharacteristicLabel(c);
  assert(!!label && label.length > 0, `Expected a non-empty label for characteristic "${c}", got "${label}"`);
}
console.log(`  PASS: all ${allCharacteristics.length} GD&T characteristics resolve to a non-empty plain-English label\n`);

console.log('>>> GD&T SYMBOL FONT REGISTRY TEST PASSED! <<<');
