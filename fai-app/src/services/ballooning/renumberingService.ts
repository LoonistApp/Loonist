import type { EngineeringCharacteristic } from '../../types/characteristics';

export class RenumberingService {
  /**
   * Cascade renumbers a list of EngineeringCharacteristics following AS9102 Rev B/C.
   * - Sequential integer itemNumbers: 1, 2, 3...
   * - Preserves and sequentially re-indexes sub-items for multipliers (e.g. 5.1, 5.2).
   * - If all but one sub-item in a group are deleted, collapses cleanly back to a single integer itemNumber.
   */
  public static cascadeRenumber(characteristics: EngineeringCharacteristic[]): EngineeringCharacteristic[] {
    let nextItemNumber = 1;
    const oldToNewMap = new Map<string, number>();
    const subCounterMap = new Map<number, number>();

    // Group by (sheetNumber, itemNumber), not itemNumber alone: a compound sub-item family is
    // always generated from one callout on one sheet, so two characteristics can only be the
    // same family if they also share a sheet. Grouping by itemNumber alone would silently merge
    // unrelated characteristics from different sheets that happen to share an old item number
    // (e.g. after a per-sheet extraction numbering collision) instead of giving them fresh ones.
    const groupKey = (c: EngineeringCharacteristic) => `${c.sheetNumber}|${c.itemNumber}`;

    // Count occurrences of each old (sheet, itemNumber) group
    const countsByOldItem = new Map<string, number>();
    for (const c of characteristics) {
      const key = groupKey(c);
      countsByOldItem.set(key, (countsByOldItem.get(key) || 0) + 1);
    }

    return characteristics.map((char) => {
      const key = groupKey(char);
      let newItemNumber: number;
      if (oldToNewMap.has(key)) {
        newItemNumber = oldToNewMap.get(key)!;
      } else {
        newItemNumber = nextItemNumber++;
        oldToNewMap.set(key, newItemNumber);
      }

      const hasMultipleInGroup = (countsByOldItem.get(key) || 0) > 1;
      let newSubNumber: string | undefined = undefined;

      if (char.subNumber && hasMultipleInGroup) {
        const currentSubIdx = (subCounterMap.get(newItemNumber) || 0) + 1;
        subCounterMap.set(newItemNumber, currentSubIdx);
        newSubNumber = `${newItemNumber}.${currentSubIdx}`;
      } else if (char.subNumber && !hasMultipleInGroup) {
        newSubNumber = undefined;
      }

      return {
        ...char,
        itemNumber: newItemNumber,
        subNumber: newSubNumber
      };
    });
  }

  /**
   * Removes a characteristic by ID and cascade-renumbers the remaining list.
   */
  public static deleteAndRenumber(
    characteristics: EngineeringCharacteristic[],
    deleteId: string
  ): EngineeringCharacteristic[] {
    const remaining = characteristics.filter((c) => c.id !== deleteId);
    return this.cascadeRenumber(remaining);
  }
}
