import type { Settings } from './types';

/** All business numbers live here (admin can edit them in /admin/settings). */
export const DEFAULT_SETTINGS: Settings = {
  base_rate: 2900,
  base_guests: 2,
  extra_guest_fee: 500,
  max_guests: 7, // [ASSUMPTION] "not more than 5" read as 5 EXTRA guests → 7 total. Change to 5 if owner means 5 total.
  cleaning_fee: 200,
  downpayment_amount: 1000, // [ASSUMPTION] treated as downpayment deducted from total
  security_deposit_amount: 0, // [ASSUMPTION] optional separate deposit, off by default
  undeclared_penalty: 2000, // + extra_guest_fee = ₱2,500 per undeclared guest
  hold_hours: 3,
  checkin_time: '14:00',
  checkout_time: '12:00',
  pool_limit_per_room: 4,
  edit_cutoff_hours: 24,
  data_retention_days: 30,
  gcash_name: 'TRC Owner (DEMO)',
  gcash_number: '0917 000 0000',
  gcash_qr_path: '',
  owner_email: 'owner@example.com',
  owner_mobile: '+639170000000',
  airbnb_ical_import_url: '',
  ical_export_token: 'demo-7f3a9c',
  checkin_checklist: [
    '2nd room locked (1–3 guests only)',
    'Aircon remote handed over',
    'Keys / access cards given',
    'House rules briefed',
    'Photos of unit condition taken',
  ],
  checkout_checklist: ['Keys / cards returned', 'Damage check done', 'Aircons and lights off'],
};
