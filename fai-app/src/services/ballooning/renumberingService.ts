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
    const oldToNewMap = new Map<number, number>();
    const subCounterMap = new Map<number, number>();

    // Count occurrences of each old itemNumber
    const countsByOldItem = new Map<number, number>();
    for (const c of characteristics) {
      countsByOldItem.set(c.itemNumber, (countsByOldItem.get(c.itemNumber) || 0) + 1);
    }

    return characteristics.map((char) => {
      let newItemNumber: number;
      if (oldToNewMap.has(char.itemNumber)) {
        newItemNumber = oldToNewMap.get(char.itemNumber)!;
      } else {
        newItemNumber = nextItemNumber++;
        oldToNewMap.set(char.itemNumber, newItemNumber);
      }

      const hasMultipleInGroup = (countsByOldItem.get(char.itemNumber) || 0) > 1;
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
