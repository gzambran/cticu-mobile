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

export interface WeeklyNotes {
  [weekStartDate: string]: string;
}

export interface User {
  username: string;
  role: string;
  fullName?: string;
}

export const SHIFT_COLORS = {
  '5W': '#FF0000',    // Red
  '5C': '#0000FF',    // Blue
  'Night': '#FFA500', // Orange
  'Swing': '#00AA00', // Green
} as const;

export const DOCTORS = ['CG', 'RV', 'ZZ', 'MO', 'HW', 'NK', 'OE'] as const;
export type Doctor = typeof DOCTORS[number];