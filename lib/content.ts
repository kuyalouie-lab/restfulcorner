import type { ContentPage, Promo } from './types';

/** Seed content. Items marked <!-- OWNER REVIEW --> need the owner's confirmation. */
export const SEED_CONTENT: ContentPage[] = [
  {
    slug: 'rules',
    body_en: `# House Rules

## Check-in and check-out
- Check-in: **2:00 PM**. Check-out: **12:00 PM** (noon) the next day.
- Overnight stays only. Multi-night stays are welcome.

## Counting guests
- Everyone **2 years old and above** is a counted guest.
- Infants under 2 stay free and don't count toward the price, rooms, or pool limit.
- The number of guests you declare is **final**. Every guest must be named in your booking.

## Rooms and aircon
| Declared guests | Rooms | Aircon |
|---|---|---|
| 1–3 | 1 room (2nd room stays locked) | 1 aircon (sala **or** bedroom, chosen when booking) |
| 4 and above | Both rooms | Both aircons |

## Pool
- Free pool access. Limit: **4 persons per room in use** (1 room = 4, 2 rooms = 8).
- Follow the condo's pool rules and schedule. <!-- OWNER REVIEW: add pool hours -->

## Lobby registration
- **All guests must register at the condo lobby and leave a valid ID.**
- Only names on your guest list can go up to the unit.

## Undeclared guests
- Each undeclared guest = **₱2,500** (₱2,000 penalty + ₱500 extra guest fee), collected on the spot.
- Need to add someone? Add them through your booking link before check-in for only **₱500 per guest per night**.

## Fees and payment
- Cleaning fee: **₱200** per stay.
- **₱1,000 GCash downpayment** holds your dates and is deducted from your total. The balance is paid at check-in (GCash or cash).

## Cancellation <!-- OWNER REVIEW: policy not final -->
- The downpayment is non-refundable.
- If you cancel at least **3 days before check-in**, you may rebook once within 60 days.

## Expectations
The unit is cleaned and sanitized before every stay. It's a lived-in home, not a hotel, so please don't expect perfection. It is spacious enough for your declared group. The owner may decline a booking if expectations don't match what we offer.

## House rules
- No smoking or vaping inside the unit.
- Quiet hours: **10:00 PM – 7:00 AM**. <!-- OWNER REVIEW -->
- No parties or events.
- No pets. <!-- OWNER REVIEW -->
- Guests are liable for any damage or missing items.
- Turn off the aircons and lights when you leave the unit.
`,
    body_fil: `# Mga Patakaran sa Bahay

## Check-in at check-out
- Check-in: **2:00 PM**. Check-out: **12:00 PM** (tanghali) kinabukasan.
- Overnight lang. Puwede ang ilang gabi.

## Pagbilang ng bisita
- Bilang bilang bisita ang lahat ng **2 taong gulang pataas**.
- Libre ang sanggol na wala pang 2 taon at hindi kasama sa presyo, kuwarto, o limit sa pool.
- **Final** ang bilang ng bisitang idineklara mo. Kailangang nakapangalan ang bawat bisita sa booking.

## Kuwarto at aircon
| Idineklarang bisita | Kuwarto | Aircon |
|---|---|---|
| 1–3 | 1 kuwarto (nakakandado ang ika-2) | 1 aircon (sala **o** kuwarto, pipiliin sa booking) |
| 4 pataas | Dalawang kuwarto | Dalawang aircon |

## Pool
- Libreng pool. Limit: **4 na tao bawat kuwartong gamit** (1 kuwarto = 4, 2 kuwarto = 8).
- Sundin ang patakaran at oras ng pool ng condo. <!-- OWNER REVIEW: ilagay ang oras ng pool -->

## Pagpaparehistro sa lobby
- **Lahat ng bisita ay kailangang magparehistro sa lobby ng condo at mag-iwan ng valid ID.**
- Ang mga pangalan lang sa guest list ang makakaakyat sa unit.

## Hindi idineklarang bisita
- Bawat hindi idineklarang bisita = **₱2,500** (₱2,000 multa + ₱500 dagdag na bisita), babayaran agad.
- May idadagdag? Idagdag sa booking link bago mag-check-in sa halagang **₱500 lang bawat bisita bawat gabi**.

## Bayarin
- Cleaning fee: **₱200** bawat stay.
- **₱1,000 GCash downpayment** para ma-reserve ang petsa, ibabawas sa kabuuan. Ang balanse ay babayaran sa check-in (GCash o cash).

## Pagkansela <!-- OWNER REVIEW: hindi pa final -->
- Hindi refundable ang downpayment.
- Kung magkansela ka nang hindi bababa sa **3 araw bago ang check-in**, puwede kang mag-rebook nang isang beses sa loob ng 60 araw.

## Mga inaasahan
Nililinis at sina-sanitize ang unit bago ang bawat stay. Ito ay tahanang tinitirhan, hindi hotel, kaya huwag umasa ng perpekto. Sapat ang laki nito para sa idineklarang grupo. Maaaring tanggihan ng may-ari ang booking kung hindi tugma ang inaasahan sa aming iniaalok.

## Iba pang patakaran
- Bawal manigarilyo o mag-vape sa loob ng unit.
- Quiet hours: **10:00 PM – 7:00 AM**. <!-- OWNER REVIEW -->
- Bawal ang party o event.
- Bawal ang alagang hayop. <!-- OWNER REVIEW -->
- Pananagutan ng bisita ang anumang sira o nawawalang gamit.
- Patayin ang aircon at ilaw kapag aalis sa unit.
`,
  },
  {
    slug: 'faq',
    body_en: `# FAQ

### How many people can stay?
Up to 7 counted guests (2 years old and above). Infants under 2 are free.

### How much is it?
₱2,900 per night for 1–2 guests, plus ₱500 per extra guest per night, plus a ₱200 cleaning fee per stay.

### Why only one room for 3 guests?
Our rate for 1–3 guests includes one room and one aircon. Booking for 4 or more opens both rooms and both aircons.

### How do I pay?
Send the ₱1,000 downpayment via GCash and upload the screenshot on your booking page. Pay the balance at check-in by GCash or cash.

### Is my booking confirmed after I pay?
The owner reviews every booking and confirms it, usually within a few hours. You'll get an email and SMS.

### Can I add guests later?
Yes, through your booking link up to 24 hours before check-in, at ₱500 per guest per night.

### Is there parking? <!-- OWNER REVIEW -->
Please message us on Facebook about parking.

### Do you accept walk-ins?
No. Bookings are by Airbnb or through this site / our Facebook page only.
`,
    body_fil: `# Mga Madalas Itanong

### Ilan ang puwedeng mag-stay?
Hanggang 7 bisita (2 taong gulang pataas). Libre ang sanggol na wala pang 2.

### Magkano?
₱2,900 bawat gabi para sa 1–2 bisita, dagdag na ₱500 bawat sobrang bisita bawat gabi, at ₱200 cleaning fee bawat stay.

### Bakit isang kuwarto lang para sa 3?
Kasama sa presyo ng 1–3 bisita ang isang kuwarto at isang aircon. Kapag 4 pataas, bukas ang dalawang kuwarto at dalawang aircon.

### Paano magbayad?
Ipadala ang ₱1,000 downpayment sa GCash at i-upload ang screenshot sa booking page. Ang balanse ay babayaran sa check-in, GCash o cash.

### Kumpirmado na ba ang booking pagkabayad?
Rerepasuhin ng may-ari ang bawat booking at kukumpirmahin, kadalasan sa loob ng ilang oras. Makakatanggap ka ng email at SMS.

### Puwede bang magdagdag ng bisita?
Oo, sa booking link mo hanggang 24 oras bago mag-check-in, ₱500 bawat bisita bawat gabi.

### May parking ba? <!-- OWNER REVIEW -->
Mag-message sa amin sa Facebook tungkol sa parking.

### Tumatanggap ba ng walk-in?
Hindi. Sa Airbnb o sa site na ito / Facebook page lang ang booking.
`,
  },
  {
    slug: 'expectations',
    body_en: 'The unit is cleaned and sanitized before every stay. It\'s a lived-in home, not a hotel, so please don\'t expect perfection. It is spacious enough for your declared group. The owner may decline a booking if expectations don\'t match what we offer.',
    body_fil: 'Nililinis at sina-sanitize ang unit bago ang bawat stay. Ito ay tahanang tinitirhan, hindi hotel, kaya huwag umasa ng perpekto. Sapat ang laki nito para sa idineklarang grupo. Maaaring tanggihan ng may-ari ang booking kung hindi tugma ang inaasahan sa aming iniaalok.',
  },
  {
    slug: 'about',
    body_en: 'A cozy 2-bedroom staycation in Quezon City, made for families and couples. Two units joined into one, with free pool access.',
    body_fil: 'Isang maaliwalas na 2-bedroom na staycation sa Quezon City para sa pamilya at magkasintahan. Dalawang unit na pinagsama, may libreng pool.',
  },
];

export const SEED_PROMOS: Promo[] = [
  { id: 'p1', title_en: 'Weekday family staycation', title_fil: 'Weekday na family staycation', body_en: 'Book Mon–Thu and enjoy a quieter pool. Perfect for families with kids.', body_fil: 'Mag-book ng Lunes–Huwebes para mas tahimik ang pool. Swak sa pamilyang may bata.', image_path: '', active: true, sort: 1 },
  { id: 'p2', title_en: 'Movie night setup', title_fil: 'Movie night setup', body_en: 'Netflix-ready TV in the sala. Bring your snacks!', body_fil: 'May Netflix-ready na TV sa sala. Magdala ng sitsirya!', image_path: '', active: true, sort: 2 },
];
