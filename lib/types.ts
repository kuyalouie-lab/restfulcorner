export type Lang = 'en' | 'fil';
export type Role = 'admin' | 'staff';
export type Source = 'direct' | 'airbnb' | 'manual';
export type BookingStatus =
  | 'pending_payment' | 'payment_submitted' | 'confirmed' | 'checked_in' | 'checked_out'
  | 'expired' | 'declined' | 'cancelled' | 'refund_due';
export type Aircon = 'sala' | 'bedroom' | 'both';

export interface Settings {
  base_rate: number;
  base_guests: number;
  extra_guest_fee: number;
  max_guests: number; // [ASSUMPTION] 7 = 2 included + 5 extra
  cleaning_fee: number;
  downpayment_amount: number;
  security_deposit_amount: number; // [ASSUMPTION] 0 = off
  undeclared_penalty: number; // penalty part only; extra_guest_fee is added on top
  hold_hours: number;
  checkin_time: string;
  checkout_time: string;
  pool_limit_per_room: number;
  edit_cutoff_hours: number;
  data_retention_days: number;
  gcash_name: string;
  gcash_number: string;
  gcash_qr_path: string; // data URL in the demo
  owner_email: string;
  owner_mobile: string;
  airbnb_ical_import_url: string;
  ical_export_token: string;
  checkin_checklist: string[];
  checkout_checklist: string[];
}

export interface BookingGuest { id: string; full_name: string; is_booker: boolean; age_group: 'adult' | 'child' | 'infant' }

export interface PriceBreakdown {
  nights: number;
  counted_guests: number;
  nightly_rate: number;
  extra_guests: number;
  room_subtotal: number;
  cleaning_fee: number;
  total: number;
  downpayment: number;
  balance_at_checkin: number;
}

export interface Booking {
  id: string;
  code: string;
  source: Source;
  status: BookingStatus;
  check_in_date: string; // YYYY-MM-DD
  check_out_date: string;
  nights: number;
  declared_guests: number;
  infants: number;
  aircon_choice: Aircon;
  rooms_allowed: 1 | 2;
  price_breakdown: PriceBreakdown | null;
  total_amount: number; // room total (+ extras + penalties are tracked as charges)
  extra_charges: { label: string; amount: number }[]; // penalties, damages, added guests
  booker_name: string;
  booker_mobile: string;
  booker_email: string;
  special_requests: string;
  language: Lang;
  rules_accepted_at: string | null;
  rules_accepted_ip: string | null;
  privacy_consent_at: string | null;
  guest_token: string; // demo stores plain token; production stores hash only
  hold_expires_at: string | null;
  decline_reason: string | null;
  actual_guests: number | null;
  undeclared_guests: number;
  pending_change: { declared_guests: number; names: string[]; requested_at: string } | null;
  cancel_requested_at: string | null;
  guests: BookingGuest[];
  airbnb_payout?: number;
  block_uid?: string;
  created_at: string;
  updated_at: string;
}

export interface GuestId { id: string; booking_id: string; storage_path: string; file_name: string; uploaded_at: string; delete_after: string | null }

export type PaymentType = 'downpayment' | 'balance' | 'penalty' | 'extra_guest' | 'deposit' | 'deposit_refund' | 'refund' | 'airbnb_payout';
export interface Payment {
  id: string; booking_id: string; type: PaymentType; method: 'gcash' | 'cash' | 'airbnb';
  amount: number; reference_no: string; proof_path: string | null; status: 'submitted' | 'verified' | 'rejected';
  reject_reason?: string; recorded_by: string | null; verified_by: string | null; verified_at: string | null; created_at: string;
}

export interface CalendarBlock { id: string; start_date: string; end_date: string; reason: 'maintenance' | 'personal' | 'airbnb'; external_uid: string | null; source: 'manual' | 'airbnb_ical'; summary?: string; converted_booking_id?: string | null }

export interface CheckinRecord { id: string; booking_id: string; actual_guests: number | null; actual_infants: number | null; checklist: Record<string, boolean>; checkout_checklist: Record<string, boolean>; notes: string; checked_in_at: string | null; checked_out_at: string | null; staff_id: string }

export interface Invoice { id: string; booking_id: string; number: string; revision: number; issued_at: string; revised_at: string | null }

export interface MessageLog { id: string; booking_id: string | null; channel: 'email' | 'sms'; template: string; to: string; subject?: string; body: string; status: 'sent' | 'failed' | 'queued'; error: string | null; sent_at: string }

export interface ContentPage { slug: 'rules' | 'faq' | 'expectations' | 'about'; body_en: string; body_fil: string }
export interface Promo { id: string; title_en: string; title_fil: string; body_en: string; body_fil: string; image_path: string; active: boolean; sort: number }
export interface AuditLog { id: string; actor_id: string; action: string; entity: string; entity_id: string; data: unknown; created_at: string }

export interface DB {
  version: number;
  settings: Settings;
  bookings: Booking[];
  guest_ids: GuestId[];
  payments: Payment[];
  calendar_blocks: CalendarBlock[];
  checkin_records: CheckinRecord[];
  invoices: Invoice[];
  message_log: MessageLog[];
  content_pages: ContentPage[];
  promos: Promo[];
  audit_log: AuditLog[];
  sync: { last_synced_at: string | null; last_error: string | null };
  seq: { booking: number; invoice: Record<string, number> };
}
