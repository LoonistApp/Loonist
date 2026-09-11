import type { EngineeringCharacteristic } from '../../types/characteristics';

export class MultiplierParser {
  /**
   * Expands a parent characteristic with quantity > 1 into individual sub-characteristics.
   * e.g. Item 4 with 4X expands into 4.1, 4.2, 4.3, 4.4
   */
  public static expandCharacteristic(
    parent: EngineeringCharacteristic
  ): EngineeringCharacteristic[] {
    if (parent.quantity <= 1) {
      return [parent];
    }

    const subItems: EngineeringCharacteristic[] = [];
    for (let i = 1; i <= parent.quantity; i++) {
      subItems.push({
        ...parent,
        id: `${parent.id}-sub-${i}`,
        subNumber: `${parent.itemNumber}.${i}`,
        rawText: `${parent.rawText} [Part ${i} of ${parent.quantity}]`,
        isExpandedMultiplier: true,
        parentCharacteristicId: parent.id,
        // Individual physical features can have slight spatial offsets in CAD
        boundingBox: {
          ...parent.boundingBox,
          y: parent.boundingBox.y + (i - 1) * 20
        }
      });
    }

    return subItems;
  }
}
