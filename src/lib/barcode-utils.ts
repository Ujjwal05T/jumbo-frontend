/**
 * Barcode Utilities
 * Handles transformation of old barcode format to new format
 */

// Storage for barcode mappings (old -> new)
const jumboMappings = new Map<string, string>();
const setMappings = new Map<string, string>();

// Counters for generating sequential new barcodes
let jumboCounter = 1;
let setCounter = 1;

/**
 * Check if barcode is in new format (JR_xxxxx or SET_xxxxx)
 */
const isNewFormat = (barcode: string | null | undefined): boolean => {
  if (!barcode) return false;
  return barcode.startsWith('JR_') || barcode.startsWith('SET_');
};

/**
 * Pad number with leading zeros to 5 digits
 */
const padNumber = (num: number): string => {
  return num.toString().padStart(5, '0');
};

/**
 * Transform old jumbo barcode format to new format (JR_xxxxx)
 * If already in new format, returns as is
 */
export const transformJumboBarcode = (barcode: string | null | undefined): string | null => {
  if (!barcode) return null;

  // If already in new format, return as is
  if (isNewFormat(barcode)) {
    return barcode;
  }

  // Check if we've already mapped this old barcode
  if (jumboMappings.has(barcode)) {
    return jumboMappings.get(barcode)!;
  }

  // Generate new barcode
  const newBarcode = `JR_${padNumber(jumboCounter)}`;
  jumboMappings.set(barcode, newBarcode);
  jumboCounter++;

  return newBarcode;
};

/**
 * Transform old 118" roll (set) barcode format to new format (SET_xxxxx)
 * If already in new format, returns as is
 * Max 3 sets per jumbo, so cycles through SET_00001, SET_00002, SET_00003
 */
export const transformSetBarcode = (barcode: string | null | undefined): string | null => {
  if (!barcode) return null;

  // If already in new format, return as is
  if (isNewFormat(barcode)) {
    return barcode;
  }

  // Check if we've already mapped this old barcode
  if (setMappings.has(barcode)) {
    return setMappings.get(barcode)!;
  }

  // Generate new barcode (cycle through 1-3)
  const setNumber = ((setCounter - 1) % 3) + 1; // Cycles 1, 2, 3, 1, 2, 3...
  const newBarcode = `SET_${padNumber(setNumber)}`;
  setMappings.set(barcode, newBarcode);
  setCounter++;

  return newBarcode;
};

/**
 * Reset all barcode mappings (useful for testing or when starting fresh)
 */
export const resetBarcodeMappings = (): void => {
  jumboMappings.clear();
  setMappings.clear();
  jumboCounter = 1;
  setCounter = 1;
};

/**
 * Get all current mappings (useful for debugging)
 */
export const getBarcodeMappings = () => {
  return {
    jumbo: Object.fromEntries(jumboMappings),
    set: Object.fromEntries(setMappings),
  };
};
