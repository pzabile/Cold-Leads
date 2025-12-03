export interface Lead {
  id: string;
  fullName: string;
  phoneNumber: string;
  outreachMessage: string;
  sourceFile: string;
  isDuplicate: boolean;
  extractedAt: string;
}

export interface ExtractedData {
  fullName: string;
  phoneNumber: string;
  outreachMessage: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}