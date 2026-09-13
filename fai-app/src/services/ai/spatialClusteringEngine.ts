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

    return clusters;
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

    // 6. Explicit tolerance on separate line: e.g. "+.005 / -.002" or "± .010"
    if (/^(?:±|\+\/-|\+[0-9]|-[0-9])/.test(t)) {
      return true;
    }

    // 7. General notes continuation (indented text under a note number)
    if (/^\d+\./.test(prevText) && !/^\d+\./.test(t) && !t.includes('|')) {
      return true;
    }

    return false;
  }
}
