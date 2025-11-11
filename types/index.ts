export type ShiftType = '5W' | '5C' | 'Night' | 'Swing';

export interface Schedule {
  [date: string]: {
    '5W'?: string;
    '5C'?: string;
    Night?: string;
    Swing?: string;
  };
}

export interface Unavailability {
  [doctor: string]: string[];
}

export interface Holidays {
  [date: string]: string;
}

export interface ShiftChange {
  date: string;
  shift_type: ShiftType;
  from_doctor: string;
  to_doctor: string;
}

export interface ShiftChangeRequest {
  id: number;
  requester_username: string;
  requester_name?: string;
  shifts: ShiftChange[];
  notes?: string;
  status: 'pending' | 'approved' | 'denied';
  submitted_at: string;
  approver_username?: string;
  resolved_at?: string;
}

export const SHIFT_COLORS = {
  '5C': '#FF0000',
  '5W': '#FF8C00',
  'Night': '#0000FF',
  'Swing': '#00AA00',
} as const;