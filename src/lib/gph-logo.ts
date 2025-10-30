// GPH Logo as base64 string
export const GPH_LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAACEsAAAPiCAYAAACNdsEUAAAABGdBTUEAALGOfPtRkwAAACBjSFJNAACHDwAAjA8AAP1SAACBQAAAfXh0U29mdHdhcmUAcGFpbnQubmV0IDQuMi4yMDEwMDAwIDAxMDoyODoxOCAgAAAABJRU5ErkJggg==";

// Get the full base64 data (this is just a placeholder, we need the actual full base64)
export const getGphLogoBase64 = async (): Promise<string> => {
  // Read the actual base64 file
  const response = await fetch('/gph_logo_base64.txt');
  const base64 = await response.text();
  return `data:image/png;base64,${base64}`;
};