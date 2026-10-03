/**
 * LOONIST — Spatial Proximity Clustering Engine
 * Intelligently groups multi-line engineering callouts (dimensions, depth notes,
 * counterbores, and GD&T feature control frames) that sit in close 2D proximity
 * on blueprint sheets into unified characteristic blocks.
 */

export interface RawTextElement {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClusteredCallout {
  combinedText: string;
  lines: string[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  primaryElement: RawTextElement;
  allElements: RawTextElement[];
}

export class SpatialClusteringEngine {
  /**
   * Maximum vertical gap (in points) between adjacent lines to be considered part of the same callout.
   */
  private static readonly MAX_LINE_GAP_FACTOR = 1.8;

  /**
   * Maximum horizontal left-alignment offset (in points).
   */
  private static readonly MAX_ALIGNMENT_OFFSET = 35;

  /**
   * Clusters raw text items into cohesive multi-line callout groups.
   */
  public static clusterTextElements(elements: RawTextElement[]): ClusteredCallout[] {
    if (elements.length === 0) return [];

    // 1. Sort top-to-bottom, then left-to-right
    const sorted = [...elements].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) > 8) {
        return yDiff;
      }
      return a.x - b.x;
    });

    const used = new Set<number>();
    const clusters: ClusteredCallout[] = [];

    for (let i = 0; i < sorted.length; i++) {
      if (used.has(i)) continue;

      const currentGroup: RawTextElement[] = [sorted[i]];
      used.add(i);

      let currentBottom = sorted[i].y + sorted[i].height;
      let currentLeft = sorted[i].x;
      let currentRight = sorted[i].x + sorted[i].width;

      // Scan subsequent elements to see if any should be grouped
      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(j)) continue;

        const candidate = sorted[j];
        const avgHeight = Math.max(12, sorted[i].height);
        const verticalGap = candidate.y - currentBottom;

        // If candidate is too far down vertically, stop scanning this branch
        if (verticalGap > avgHeight * this.MAX_LINE_GAP_FACTOR + 10) {
          // If candidate is significantly below, we can break early if list is sorted by y
          if (candidate.y - currentBottom > 60) {
            break;
          }
          continue;
        }

        // Must be below the current group (not above)
        if (verticalGap < -avgHeight * 0.5) {
          continue;
        }

        // Check horizontal relationship:
        // Either left edges are aligned, or their horizontal spans overlap significantly
        const leftAligned = Math.abs(candidate.x - currentLeft) <= this.MAX_ALIGNMENT_OFFSET;
        const horizontalOverlap =
          Math.max(currentLeft, candidate.x) <= Math.min(currentRight, candidate.x + candidate.width) + 20;

        if (leftAligned || horizontalOverlap) {
          // Check if candidate is a natural companion line:
          // (e.g. depth, counterbore, GD&T frame, note continuation, datum reference, tolerance)
          const isCompanion = this.isCompanionCallout(candidate.text, currentGroup);

          if (isCompanion) {
            currentGroup.push(candidate);
            used.add(j);
            currentBottom = Math.max(currentBottom, candidate.y + candidate.height);
            currentLeft = Math.min(currentLeft, candidate.x);
            currentRight = Math.max(currentRight, candidate.x + candidate.width);
          }
        }
      }

      // Compute bounding box for the cluster
      const minX = Math.min(...currentGroup.map(e => e.x));
      const minY = Math.min(...currentGroup.map(e => e.y));
      const maxX = Math.max(...currentGroup.map(e => e.x + e.width));
      const maxY = Math.max(...currentGroup.map(e => e.y + e.height));

      const lines = currentGroup.map(e => e.text);
      // Join multi-line text with standard aerospace callout delimiter " / "
      const combinedText = lines.join(' / ');

      clusters.push({
        combinedText,
        lines,
        boundingBox: {
          x: Math.round(minX),
          y: Math.round(minY),
          width: Math.round(maxX - minX),
          height: Math.round(maxY - minY)
        },
        primaryElement: currentGroup[0],
        allElements: currentGroup
      });
    }

    return this.reattachDeviationsAboveNominal(clusters);
  }

  /**
   * ISO 286 stacked limit dimensioning often writes the UPPER deviation above the nominal and
   * the lower deviation below it (vs. both below) — e.g. "0" above "Ø10.5" above "-0.08". The
   * forward-only scan above only ever extends a group downward/rightward from its start
   * element, so an upper-deviation line gets visited first (it has the smallest y) and becomes
   * its own permanent singleton before the nominal below it is ever considered — and even
   * array order doesn't reliably put the nominal after it, since the main scan's sort ties y
   * within 8pt and then breaks by x, so a nominal a couple points lower but to the left can
   * start (and get pushed) BEFORE the orphan above it does. This pass finds exactly that shape
   * — a singleton bare "0"/signed-value cluster sitting immediately above a nominal-leading
   * cluster, tightly x-aligned — and re-attaches it as a leading line, symmetric with the
   * "below" case already handled by isCompanionCallout's stacked-limit-pair rule.
   */
  private static reattachDeviationsAboveNominal(clusters: ClusteredCallout[]): ClusteredCallout[] {
    const isOrphanDeviation = (c: ClusteredCallout) =>
      c.lines.length === 1 && (c.lines[0].trim() === '0' || /^[+-]\d+(?:\.\d+)?$/.test(c.lines[0].trim()));
    const isNominalLeading = (c: ClusteredCallout) => /^Ø?\d+(?:\.\d+)?$/.test(c.lines[0].trim());

    // Pass 1: find each orphan's best nominal partner, searching the WHOLE array in both
    // directions (see note above on why array order doesn't track vertical position reliably).
    const orphanToTarget = new Map<number, number>();
    const claimedTargets = new Set<number>();
    for (let i = 0; i < clusters.length; i++) {
      const singleton = clusters[i];
      if (!isOrphanDeviation(singleton)) continue;

      let bestMatch = -1;
      let bestAbsGap = Infinity;
      for (let k = 0; k < clusters.length; k++) {
        if (k === i || claimedTargets.has(k)) continue;
        const target = clusters[k];
        if (!isNominalLeading(target)) continue;

        const gap = target.boundingBox.y - (singleton.boundingBox.y + singleton.boundingBox.height);
        const xAligned =
          Math.abs(target.boundingBox.x - singleton.boundingBox.x) <= this.MAX_ALIGNMENT_OFFSET ||
          Math.max(target.boundingBox.x, singleton.boundingBox.x) <=
            Math.min(target.boundingBox.x + target.boundingBox.width, singleton.boundingBox.x + singleton.boundingBox.width) + 20;

        // Negative gap means the two lines' measured boxes slightly overlap, which is common
        // for tightly stacked limit-deviation text (small font, minimal line spacing) — allow
        // a generous negative tolerance rather than the ~0px one might expect.
        if (gap >= -20 && gap < 20 && xAligned && Math.abs(gap) < bestAbsGap) {
          bestAbsGap = Math.abs(gap);
          bestMatch = k;
        }
      }

      if (bestMatch >= 0) {
        orphanToTarget.set(i, bestMatch);
        claimedTargets.add(bestMatch);
      }
    }

    if (orphanToTarget.size === 0) return clusters;

    // Pass 2: rebuild, skipping consumed orphans and prepending their line onto the target.
    const targetToOrphan = new Map<number, number>();
    for (const [orphanIdx, targetIdx] of orphanToTarget) {
      targetToOrphan.set(targetIdx, orphanIdx);
    }

    const result: ClusteredCallout[] = [];
    for (let k = 0; k < clusters.length; k++) {
      if (orphanToTarget.has(k)) continue; // folded into its target below, not emitted on its own

      const target = clusters[k];
      const orphanIdx = targetToOrphan.get(k);
      if (orphanIdx === undefined) {
        result.push(target);
        continue;
      }

      const singleton = clusters[orphanIdx];
      const lines = [...singleton.lines, ...target.lines];
      result.push({
        combinedText: lines.join(' / '),
        lines,
        boundingBox: {
          x: Math.min(target.boundingBox.x, singleton.boundingBox.x),
          y: Math.min(target.boundingBox.y, singleton.boundingBox.y),
          width:
            Math.max(target.boundingBox.x + target.boundingBox.width, singleton.boundingBox.x + singleton.boundingBox.width) -
            Math.min(target.boundingBox.x, singleton.boundingBox.x),
          height:
            Math.max(target.boundingBox.y + target.boundingBox.height, singleton.boundingBox.y + singleton.boundingBox.height) -
            Math.min(target.boundingBox.y, singleton.boundingBox.y)
        },
        primaryElement: target.primaryElement,
        allElements: [...singleton.allElements, ...target.allElements]
      });
    }

    return result;
  }

  /**
   * Determines if a text snippet is a natural vertical continuation of an engineering callout.
   */
  private static isCompanionCallout(candidateText: string, currentGroup: RawTextElement[]): boolean {
    const t = candidateText.trim();
    const prevText = currentGroup[currentGroup.length - 1].text.trim();

    // 1. ASME Hole sub-features: Depth (↧, DP, DEPTH), Counterbore (⌴, CBORE), Countersink (⌵, CSINK)
    if (
      t.includes('↧') ||
      t.includes('⌴') ||
      t.includes('⌵') ||
      /^(?:DEPTH|DP|THRU|THRU ALL|C'?BORE|C'?SINK)\b/i.test(t)
    ) {
      if (prevText.includes('CHAMFER')) return false;
      return true;
    }

    // 2. Feature Control Frame continuation: begins with or contains GD&T frame syntax
    if (t.startsWith('|') || t.includes('⌖') || t.includes('⌰') || t.includes('⏥') || t.includes('⟂')) {
      return true;
    }

    // 3. Composite GD&T Lower Tier frame: e.g. "| 0.005 | A |"
    if (prevText.includes('|') && t.includes('|')) {
      return true;
    }

    // 4. Multiplier preceding a dimension: line 1 was "4X", line 2 is "Ø .375-16 UNC"
    if (/^\d+\s*[xX]$/.test(prevText)) {
      return true;
    }

    // 5. Basic or Reference Dimension continuation: "[ 1.500" continuation "]"
    if (prevText.startsWith('[') && !prevText.endsWith(']') && t.endsWith(']')) {
      return true;
    }
    if (prevText.startsWith('(') && !prevText.endsWith(')') && t.endsWith(')')) {
      return true;
    }

    // 6. Explicit tolerance on separate line: e.g. "+.005 / -.002" or "± .010". Only a plain
    // numeric nominal (bare, or Ø-prefixed) can own a trailing deviation line — a GD&T frame
    // (datum references like "A B-C B", or a leading frame-symbol glyph) already carries its own
    // tolerance value inside the frame and never takes an external one. Without this guard, a
    // stray deviation line belonging to a DIFFERENT, nearby dimension could get absorbed into an
    // unrelated frame simply because the frame happened to sit closer above it on the sheet.
    if (/^(?:±|\+\/-|\+[0-9]|-[0-9])/.test(t) && /^Ø?\d/.test(prevText)) {
      return true;
    }

    // 7. General notes continuation (indented text under a note number like "1. FINISH ALL OVER")
    if (/^\d+\.\s+[A-Za-z]/.test(prevText) && !/^\d+\./.test(t) && !t.includes('|')) {
      return true;
    }

    // 8. Engineering qualifiers on separate line: e.g. "TYP", "TYPICAL", "4 PLCS", "2 PLACES", "MAX", "MIN", "REF"
    if (/^(?:TYP|TYPICAL|\(?\d+\s*PLCS\)?|\(?\d+\s*PLACES?\)?|MAX|MIN|REF)\b/i.test(t)) {
      return true;
    }

    // 9. Stacked limit/deviation pair (ISO 286 limit dimensioning): a bare nominal number is
    // immediately followed by one or two deviation lines, e.g. nominal "10.5" then "0" then
    // "-0.08" (upper/lower deviation each on their own line, instead of one "+0/-0.08" line).
    // Capped to the group's first two companion lines so a real multi-value dimension chain
    // (several distinct dimensions stacked down a baseline) is never silently merged into one
    // characteristic — only an exact "0" or an explicitly signed number qualifies, which a
    // genuinely separate dimension essentially never is.
    if (
      currentGroup.length <= 2 &&
      /^Ø?\d+(?:\.\d+)?$/.test(prevText) &&
      (t === '0' || /^[+-]\d+(?:\.\d+)?$/.test(t))
    ) {
      return true;
    }

    return false;
  }
}
