export interface PublicJob {
  id: string | number;
  lat: number;
  lng: number;
  blurMeters: number;
  areaText: string;
  type: string;
  completedDate: string;
  berBefore: string;
  berAfter: string;
  annualSaving: number;
  valueIncrease: number;
  co2Reduction: number;
  warmthGain: number;
  bathrooms: number | null;
  beforePhotos: string[];
  afterPhotos: string[];
  consentToDisplay: true;
}

export interface RawJobInternal {
  id: string | number;
  lat: number;
  lng: number;
  address?: string;
  areaText?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  consent_to_display?: boolean;
}
