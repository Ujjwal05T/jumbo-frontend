/**
 * QR Code Management Library for NEW FLOW
 * Handles QR code scanning, generation, and weight updates
 */

import { PRODUCTION_ENDPOINTS, createRequestOptions } from './api-config';

// QR Code interfaces
export interface QRScanResult {
  inventory_id: string;
  qr_code: string;
  barcode_id?: string;
  roll_details: {
    width_inches: number;
    weight_kg: number;
    roll_type: string;
    status: string;
    location: string;
  };
  paper_specifications: {
    gsm: number;
    bf: number;
    shade: string;
    paper_type: string;
  } | null;
  production_info: {
    created_at: string;
    created_by: string | null;
  };
  parent_rolls: {
    parent_118_barcode: string | null;
    parent_jumbo_barcode: string | null;
  };
  client_info: {
    client_name: string | null;
  };
  scan_timestamp: string;
}

export interface QRWeightUpdate {
  qr_code: string;
  weight_kg: number;
  location?: string;
  // Note: status is automatically set to 'available' when weight is updated
}

export interface QRWeightUpdateResult {
  inventory_id: string;
  qr_code: string;
  barcode_id?: string;
  weight_update: {
    old_weight_kg: number;
    new_weight_kg: number;
    weight_difference: number;
  };
  current_status: string;
  current_location: string;
  updated_at: string;
  message: string;
}

export interface QRGenerateRequest {
  inventory_id?: string;
}

export interface QRGenerateResult {
  qr_code: string;
  inventory_id?: string;
  roll_info?: {
    width_inches: number;
    roll_type: string;
    status: string;
  };
  generated_at: string;
  message: string;
}

// QR Code API Functions

/**
 * Scan QR code and get roll details
 */
export const scanQRCode = async (qrCode: string): Promise<QRScanResult> => {
  const response = await fetch(
    PRODUCTION_ENDPOINTS.QR_SCAN(qrCode),
    createRequestOptions('GET')
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'QR code not found');
  }

  return response.json();
};

/**
 * Update cut roll weight via QR code scan
 */
export const updateWeightViaQR = async (updateData: QRWeightUpdate): Promise<QRWeightUpdateResult> => {
  const response = await fetch(
    PRODUCTION_ENDPOINTS.UPDATE_WEIGHT,
    createRequestOptions('PUT', updateData)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to update weight');
  }

  return response.json();
};

/**
 * Generate QR code for inventory item
 */
export const generateQRCode = async (request: QRGenerateRequest): Promise<QRGenerateResult> => {
  const response = await fetch(
    PRODUCTION_ENDPOINTS.GENERATE_QR,
    createRequestOptions('POST', request)
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || 'Failed to generate QR code');
  }

  return response.json();
};

// Helper functions

/**
 * Validate QR code format
 */
export const isValidQRCode = (qrCode: string): boolean => {
  // Basic validation for expected QR code format
  return qrCode.length > 0 && /^[A-Za-z0-9_-]+$/.test(qrCode);
};

/**
 * Format weight for display
 */
export const formatWeight = (weightKg: number): string => {
  return `${weightKg.toFixed(2)} kg`;
};

/**
 * Format dimensions for display
 */
export const formatDimensions = (widthInches: number): string => {
  return `${widthInches}"`;
};

/**
 * Get status color for different roll statuses
 */
export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'available':
      return 'green';
    case 'cutting':
      return 'blue';
    case 'in_production':
      return 'orange';
    case 'completed':
      return 'purple';
    case 'damaged':
      return 'red';
    default:
      return 'gray';
  }
};

/**
 * Parse QR code data from camera scan
 */
export const parseQRCodeData = (scanData: string): { qrCode: string; isValid: boolean } => {
  try {
    // Clean up the scan data
    const cleaned = scanData.trim();
    
    // Check if it's a valid format
    if (isValidQRCode(cleaned)) {
      return {
        qrCode: cleaned,
        isValid: true
      };
    }
    
    return {
      qrCode: cleaned,
      isValid: false
    };
  } catch (error) {
    return {
      qrCode: scanData,
      isValid: false
    };
  }
};

/**
 * Calculate weight difference percentage
 */
export const calculateWeightDifference = (oldWeight: number, newWeight: number): {
  difference: number;
  percentage: number;
  isIncrease: boolean;
} => {
  const difference = newWeight - oldWeight;
  const percentage = oldWeight > 0 ? Math.abs(difference / oldWeight) * 100 : 0;
  
  return {
    difference: Math.abs(difference),
    percentage,
    isIncrease: difference > 0
  };
};

/**
 * Get recommended location based on roll status
 */
export const getRecommendedLocation = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'cutting':
      return 'production_floor';
    case 'completed':
      return 'warehouse';
    case 'quality_check':
      return 'quality_control';
    case 'damaged':
      return 'damage_area';
    default:
      return 'warehouse';
  }
};

/**
 * Format QR code for display (show first and last few characters)
 */
export const formatQRCodeDisplay = (qrCode: string): string => {
  if (qrCode.length <= 12) {
    return qrCode;
  }
  
  return `${qrCode.substring(0, 6)}...${qrCode.substring(qrCode.length - 6)}`;
};

/**
 * Validate weight input
 */
export const validateWeight = (weight: number): {
  isValid: boolean;
  message?: string;
} => {
  if (weight <= 0) {
    return {
      isValid: false,
      message: 'Weight must be greater than 0'
    };
  }
  
  if (weight > 1000) {
    return {
      isValid: false,
      message: 'Weight seems too high (>1000kg)'
    };
  }
  
  return {
    isValid: true
  };
};

/**
 * Get paper specification summary from scan result
 */
export const getPaperSpecSummary = (scanResult: QRScanResult): string => {
  if (!scanResult.paper_specifications) {
    return 'Unknown specification';
  }
  
  const { gsm, bf, shade } = scanResult.paper_specifications;
  return `${gsm}gsm, ${bf}bf, ${shade}`;
};

/**
 * Export QR scan data to CSV format
 */
export const exportQRDataToCSV = (scanResults: QRScanResult[]): string => {
  const headers = [
    'QR Code',
    'Width (inches)',
    'Weight (kg)',
    'Status',
    'Location',
    'GSM',
    'BF',
    'Shade',
    'Client Name',
    'Created At',
    'Scan Timestamp'
  ];
  
  const rows = scanResults.map(result => [
    result.qr_code,
    result.roll_details.width_inches.toString(),
    result.roll_details.weight_kg.toString(),
    result.roll_details.status,
    result.roll_details.location,
    result.paper_specifications?.gsm.toString() || '',
    result.paper_specifications?.bf.toString() || '',
    result.paper_specifications?.shade || '',
    result.client_info?.client_name || 'No Client',
    result.production_info.created_at,
    result.scan_timestamp
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  return csvContent;
};