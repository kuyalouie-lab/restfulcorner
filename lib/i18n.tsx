'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Lang } from './types';

const en = {
  nav_home: 'Home', nav_avail: 'Availability', nav_rules: 'House Rules', nav_faq: 'FAQ', book_now: 'Book Now',
  hero_title: 'Your restful corner in Quezon City',
  hero_sub: 'A 2-bedroom staycation for families and couples — two units joined into one, with free pool access.',
  from_night: 'from ₱2,900 / night',
  amenities: 'Amenities', pricing: 'Pricing', promos: 'Promos & activities', location: 'Location', gallery: 'Gallery',
  am: ['2 bedrooms', '2 aircons (sala + bedroom)', 'Free pool access', 'Wi-Fi & smart TV', 'Kitchen & dining area', 'Hot shower', 'Condo guard & admin, 24/7'],
  price_note: '₱2,900 per night covers 1–2 guests. +₱500 per extra guest per night. ₱200 cleaning fee per stay. Infants under 2 are free.',
  guests_n: (n: number) => `${n} guest${n > 1 ? 's' : ''}`, per_night: 'per night', one_night_total: '1-night total',
  room_rule_title: 'How rooms & aircons work',
  room_rule_13: '1–3 guests: 1 room + 1 aircon (you choose sala or bedroom). The 2nd room stays locked.',
  room_rule_4: '4+ guests: both rooms and both aircons.',
  pool_rule: 'Pool limit: 4 persons per room in use.',
  directions: 'Open in Google Maps', fb: 'Facebook page', messenger: 'Message us',
  avail_title: 'Availability', available: 'Available', booked: 'Booked', avail_hint: 'Tap an available night to start booking. Each night is from 2:00 PM to 12:00 NN the next day.',
  // booking
  step: 'Step', of: 'of', next: 'Next', back: 'Back', submit: 'Submit booking',
  s_dates: 'Dates', s_guests: 'Guests', s_price: 'Price', s_details: 'Guest details', s_id: 'Valid ID', s_requests: 'Special requests', s_agree: 'Agreements',
  check_in: 'Check-in (2:00 PM)', check_out: 'Check-out (12:00 NN)', nights: 'nights', night: 'night',
  dates_taken: 'Some of these nights are already booked. Please choose other dates.',
  counted_guests: 'Guests 2 years old and above', infants: 'Infants under 2 (free)',
  aircon_choice: 'Which aircon do you want?', aircon_sala: 'Sala aircon', aircon_bedroom: 'Bedroom aircon',
  aircon_note: 'Only 1 room and 1 aircon for 1–3 guests.', both_rooms: 'You get both rooms and both aircons.',
  nightly: 'Nightly rate', cleaning: 'Cleaning fee (once)', total: 'Total', dp_now: 'Downpayment due now (GCash)', bal_checkin: 'Balance due at check-in',
  booker_name: 'Your full name', mobile: 'Mobile number', email: 'Email',
  guest_name: (i: number) => `Guest ${i} full name`, guest_name_hint: 'Every counted guest must be named. Only these names can go up at the lobby.',
  infant_name: (i: number) => `Infant ${i} name (optional)`,
  id_upload: "Upload a photo of the booker's government ID", id_hint: 'JPG, PNG, HEIC or PDF, max 10 MB. Stored privately, deleted 30 days after check-out.',
  requests_label: 'Anything we should know / special requests?', requests_hint: 'Required. Write "none" if nothing.',
  agree_rules: 'I have read the House Rules.',
  agree_penalty: (p: string) => `I understand the declared number of guests is final. Each undeclared guest = ${p} (₱2,000 penalty + ₱500 fee), and all guests must register with a valid ID at the condo lobby.`,
  agree_exp: 'I understand: ',
  agree_privacy: 'I consent to the use of my ID and guest names only for this booking and condo registration (RA 10173, Data Privacy Act). They are deleted 30 days after check-out.',
  read_rules: 'Read House Rules', close: 'Close',
  err: { dates_required: 'Choose your dates.', date_past: 'Check-in cannot be in the past.', min_one_night: 'Minimum 1 night.', guest_count: 'Invalid number of guests.', aircon_required: 'Choose an aircon.', booker_name: 'Enter your name.', mobile: 'Enter a valid PH mobile (09xxxxxxxxx).', email: 'Enter a valid email.', guest_names: 'Enter a full name (first and last) for every guest.', id_required: 'Upload a valid ID.', special_requests: 'This field is required.', agreements: 'Tick all agreement boxes.', dates_taken: 'Those dates were just taken. Please choose others.', spam: 'Error.', file_too_big: 'File is larger than 10 MB.', invalid_link: 'This booking link is invalid.', past_cutoff: 'Changes are closed 24 hours before check-in.', cannot_reduce: 'To reduce guests, please message the owner.', not_editable: 'This booking can no longer be changed.', ref_and_proof_required: 'Enter the GCash reference number and upload the screenshot.', not_awaiting_payment: 'This booking is not awaiting payment.' } as Record<string, string>,
  // payment / manage
  pay_title: 'Pay the downpayment', pay_to: 'Send via GCash to', amount: 'Amount', hold_left: 'Time left to pay', expired_note: 'This hold expired and the dates were released.',
  upload_proof: 'GCash screenshot', ref_no: 'GCash reference number', send_proof: 'Submit payment proof',
  status: 'Status', your_booking: 'Your booking', guest_list: 'Guest list', allotment: 'Room & aircon', amounts: 'Amounts', paid: 'Paid', due: 'Balance due', charges: 'Charges',
  invoice: 'Download invoice', add_guests: 'Add guests / edit names', save_changes: 'Send for approval', request_cancel: 'Request cancellation', cancel_sent: 'Cancellation request sent. The owner will contact you.',
  change_pending: 'Guest change awaiting owner approval', manage_cutoff: 'You can add guests or edit names until 24 hours before check-in.',
  rooms_1: (ac: string) => `1 room · 1 aircon (${ac}) · 2nd room locked`, rooms_2: '2 rooms · 2 aircons', pool_limit: (n: number) => `Pool limit: ${n} persons`,
  st: { pending_payment: 'Waiting for payment', payment_submitted: 'Payment submitted — awaiting owner confirmation', confirmed: 'Confirmed', checked_in: 'Checked in', checked_out: 'Checked out', expired: 'Expired', declined: 'Declined', cancelled: 'Cancelled', refund_due: 'Declined — refund in process' } as Record<string, string>,
  lobby_reminder: 'All guests must register at the condo lobby with a valid ID.',
  sala: 'sala', bedroom: 'bedroom', thanks_submitted: 'Payment proof received! The owner will confirm your booking soon.',
  footer: 'The Restful Corner · Quezon City · No walk-ins',
};
type Dict = typeof en;

const fil: Dict = {
  ...en,
  nav_home: 'Home', nav_avail: 'Bakanteng petsa', nav_rules: 'Patakaran', nav_faq: 'FAQ', book_now: 'Mag-book',
  hero_title: 'Ang iyong pahingahan sa Quezon City',
  hero_sub: 'Isang 2-bedroom na staycation para sa pamilya at magkasintahan — dalawang unit na pinagsama, may libreng pool.',
  from_night: 'mula ₱2,900 / gabi',
  amenities: 'Mga amenity', pricing: 'Presyo', promos: 'Promo at aktibidad', location: 'Lokasyon', gallery: 'Mga larawan',
  am: ['2 kuwarto', '2 aircon (sala + kuwarto)', 'Libreng pool', 'Wi-Fi at smart TV', 'Kusina at kainan', 'Hot shower', 'May guard at admin ang condo, 24/7'],
  price_note: '₱2,900 bawat gabi para sa 1–2 bisita. +₱500 bawat dagdag na bisita bawat gabi. ₱200 cleaning fee bawat stay. Libre ang sanggol na wala pang 2.',
  guests_n: (n: number) => `${n} bisita`, per_night: 'bawat gabi', one_night_total: 'Kabuuan (1 gabi)',
  room_rule_title: 'Paano ang kuwarto at aircon',
  room_rule_13: '1–3 bisita: 1 kuwarto + 1 aircon (pili ka: sala o kuwarto). Nakakandado ang ika-2 kuwarto.',
  room_rule_4: '4 pataas: dalawang kuwarto at dalawang aircon.',
  pool_rule: 'Limit sa pool: 4 na tao bawat kuwartong gamit.',
  directions: 'Buksan sa Google Maps', fb: 'Facebook page', messenger: 'Mag-message',
  avail_title: 'Bakanteng petsa', available: 'Bakante', booked: 'Booked', avail_hint: 'I-tap ang bakanteng gabi para mag-book. Bawat gabi ay mula 2:00 PM hanggang 12:00 NN kinabukasan.',
  step: 'Hakbang', of: 'sa', next: 'Susunod', back: 'Bumalik', submit: 'Ipadala ang booking',
  s_dates: 'Petsa', s_guests: 'Bisita', s_price: 'Presyo', s_details: 'Detalye ng bisita', s_id: 'Valid ID', s_requests: 'Espesyal na hiling', s_agree: 'Mga kasunduan',
  check_in: 'Check-in (2:00 PM)', check_out: 'Check-out (12:00 NN)', nights: 'gabi', night: 'gabi',
  dates_taken: 'May naka-book na sa ilan sa mga gabing ito. Pumili ng ibang petsa.',
  counted_guests: 'Bisitang 2 taong gulang pataas', infants: 'Sanggol na wala pang 2 (libre)',
  aircon_choice: 'Aling aircon ang gusto mo?', aircon_sala: 'Aircon sa sala', aircon_bedroom: 'Aircon sa kuwarto',
  aircon_note: '1 kuwarto at 1 aircon lang para sa 1–3 bisita.', both_rooms: 'Makukuha mo ang dalawang kuwarto at dalawang aircon.',
  nightly: 'Presyo bawat gabi', cleaning: 'Cleaning fee (isang beses)', total: 'Kabuuan', dp_now: 'Downpayment ngayon (GCash)', bal_checkin: 'Balanse sa check-in',
  booker_name: 'Buong pangalan mo', mobile: 'Mobile number', email: 'Email',
  guest_name: (i: number) => `Buong pangalan ng bisita ${i}`, guest_name_hint: 'Kailangang nakapangalan ang bawat bisita. Ang mga pangalang ito lang ang makakaakyat sa lobby.',
  infant_name: (i: number) => `Pangalan ng sanggol ${i} (opsyonal)`,
  id_upload: 'Mag-upload ng larawan ng government ID ng nag-book', id_hint: 'JPG, PNG, HEIC o PDF, max 10 MB. Pribadong nakatago, buburahin 30 araw pagka-check-out.',
  requests_label: 'May dapat ba kaming malaman / espesyal na hiling?', requests_hint: 'Kailangan. Isulat ang "wala" kung wala.',
  agree_rules: 'Nabasa ko ang Patakaran sa Bahay.',
  agree_penalty: (p: string) => `Naiintindihan ko na final ang idineklarang bilang ng bisita. Bawat hindi idineklarang bisita = ${p} (₱2,000 multa + ₱500 fee), at lahat ng bisita ay magpaparehistro gamit ang valid ID sa lobby ng condo.`,
  agree_exp: 'Naiintindihan ko: ',
  agree_privacy: 'Pumapayag ako na gamitin ang aking ID at mga pangalan ng bisita para lang sa booking na ito at pagpaparehistro sa condo (RA 10173, Data Privacy Act). Buburahin ang mga ito 30 araw pagka-check-out.',
  read_rules: 'Basahin ang Patakaran', close: 'Isara',
  err: { dates_required: 'Pumili ng petsa.', date_past: 'Hindi puwedeng lumipas na ang check-in.', min_one_night: 'Minimum 1 gabi.', guest_count: 'Mali ang bilang ng bisita.', aircon_required: 'Pumili ng aircon.', booker_name: 'Ilagay ang pangalan mo.', mobile: 'Maglagay ng tamang PH mobile (09xxxxxxxxx).', email: 'Maglagay ng tamang email.', guest_names: 'Ilagay ang buong pangalan (pangalan at apelyido) ng bawat bisita.', id_required: 'Mag-upload ng valid ID.', special_requests: 'Kailangan ang field na ito.', agreements: 'I-tsek ang lahat ng kasunduan.', dates_taken: 'Kakakuha lang ng mga petsang iyan. Pumili ng iba.', spam: 'Error.', file_too_big: 'Lampas 10 MB ang file.', invalid_link: 'Hindi valid ang booking link na ito.', past_cutoff: 'Sarado na ang pagbabago 24 oras bago ang check-in.', cannot_reduce: 'Para magbawas ng bisita, mag-message sa may-ari.', not_editable: 'Hindi na mababago ang booking na ito.', ref_and_proof_required: 'Ilagay ang GCash reference number at i-upload ang screenshot.', not_awaiting_payment: 'Hindi naghihintay ng bayad ang booking na ito.' },
  pay_title: 'Bayaran ang downpayment', pay_to: 'Ipadala sa GCash ni', amount: 'Halaga', hold_left: 'Natitirang oras para magbayad', expired_note: 'Nag-expire na ang hold at na-release ang petsa.',
  upload_proof: 'Screenshot ng GCash', ref_no: 'GCash reference number', send_proof: 'Ipadala ang proof of payment',
  status: 'Status', your_booking: 'Ang booking mo', guest_list: 'Listahan ng bisita', allotment: 'Kuwarto at aircon', amounts: 'Halaga', paid: 'Bayad na', due: 'Balanse', charges: 'Singil',
  invoice: 'I-download ang invoice', add_guests: 'Magdagdag ng bisita / ayusin ang pangalan', save_changes: 'Ipadala para maaprubahan', request_cancel: 'Humiling ng pagkansela', cancel_sent: 'Naipadala ang hiling. Kokontakin ka ng may-ari.',
  change_pending: 'Naghihintay ng approval ng may-ari ang pagbabago ng bisita', manage_cutoff: 'Puwedeng magdagdag o mag-ayos ng pangalan hanggang 24 oras bago ang check-in.',
  rooms_1: (ac: string) => `1 kuwarto · 1 aircon (${ac}) · nakakandado ang ika-2 kuwarto`, rooms_2: '2 kuwarto · 2 aircon', pool_limit: (n: number) => `Limit sa pool: ${n} tao`,
  st: { pending_payment: 'Naghihintay ng bayad', payment_submitted: 'Naipadala ang bayad — hinihintay ang kumpirmasyon', confirmed: 'Kumpirmado', checked_in: 'Naka-check-in', checked_out: 'Naka-check-out', expired: 'Nag-expire', declined: 'Hindi natanggap', cancelled: 'Kinansela', refund_due: 'Hindi natanggap — ibinabalik ang bayad' },
  lobby_reminder: 'Lahat ng bisita ay magpaparehistro sa lobby ng condo gamit ang valid ID.',
  sala: 'sala', bedroom: 'kuwarto', thanks_submitted: 'Natanggap ang proof of payment! Kukumpirmahin ng may-ari ang booking mo.',
  footer: 'The Restful Corner · Quezon City · Walang walk-in',
};

const DICTS: Record<Lang, Dict> = { en, fil };
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Dict }>({ lang: 'en', setLang: () => {}, t: en });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => {
    try { const l = localStorage.getItem('trc-lang'); if (l === 'fil' || l === 'en') setLangState(l); } catch {}
  }, []);
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem('trc-lang', l); } catch {} document.documentElement.lang = l === 'fil' ? 'fil' : 'en'; };
  return <Ctx.Provider value={{ lang, setLang, t: DICTS[lang] }}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);
