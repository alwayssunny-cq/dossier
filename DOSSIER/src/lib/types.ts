export interface Client {
  id: string
  client_id: string
  client_name: string
  email: string | null
  status: string | null
  notion_page_id: string | null
  archetype_code: string | null
  archetype_name: string | null
  archetype_taken_at: string | null
  created_at: string
  updated_at: string
}

export interface DestinationInfo {
  id: string
  notion_page_id: string | null
  destination: string
  meal_cost_local: string | null
  meal_cost_inr: string | null
  coffee_cost_local: string | null
  coffee_cost_inr: string | null
  local_radio: string | null
  local_media: string | null
  updated_at: string
}

export interface DailyBrief {
  id: string
  notion_page_id: string | null
  trip_id: string
  date: string | null
  title: string | null
  body: string | null
  updated_at: string
}

export interface Recommendation {
  id: string
  notion_page_id: string | null
  trip_id: string
  category: string | null
  destination: string | null
  name: string | null
  description: string | null
  timings: string | null
  map_link: string | null
  updated_at: string
}

export interface ConciergeRequest {
  id: string
  trip_id: string
  request_text: string
  status: string
  created_at: string
}

export interface Traveler {
  id: string
  traveler_id: string
  full_name: string
  phone: string | null
  email: string | null
  client_id: string | null
  is_primary: boolean | null
  relationship: string | null
  diet_type: string[] | null
  restrictions: string[] | null
  allergies: string[] | null
  passport_name: string | null
  passport_number: string | null
  nationality: string | null
  date_of_birth: string | null
  notes: string | null
  notion_page_id: string | null
  created_at: string
  updated_at: string
}

export interface Trip {
  id: string
  trip_id: string
  trip_name: string
  client_id: string | null
  destination_country: string | null
  state_county: string | null
  towns_cities: string | null
  start_date: string | null
  end_date: string | null
  status: string | null
  cover_image_url: string | null
  blueprint_version: string | null
  blueprint_confirmed: boolean | null
  notion_page_id: string | null
  dates_destinations_link: string | null
  stay_link_url: string | null
  stay_notion_page_id: string | null
  experience_link: string | null
  reading_date: string | null
  reading_link: string | null
  reading_page_url: string | null
  reading_insights: string | null
  pre_travel_guide: string | null
  drawing_board_url: string | null
  glimpse_link: string | null
  destination_info_id: string | null
  trip_cost: number | null
  amount_paid: number | null
  amount_pending: number | null
  next_payment_date: string | null
  created_at: string
  updated_at: string
}

export interface TripTraveler {
  id: string
  trip_id: string
  traveler_id: string
}

export interface Iteration {
  id: string
  notion_id: string | null
  name: string
  trip_id: string
  notion_page_id: string
  is_current: boolean
  synced_at: string
  created_at: string
}

export interface Experience {
  id: string
  experience_id: string
  trip_id: string
  day_number: number | null
  date: string | null
  location: string | null
  title: string
  description: string | null
  time_of_day: string | null
  duration: string | null
  tags: string[] | null
  cost_indicator: string | null
  image_url: string | null
  image_urls: string[] | null
  meeting_point: string | null
  sort_order: number | null
  status: string | null
  booking_code: string | null
  coupon_url: string | null
  notion_page_id: string | null
  iteration_version: string | null
  is_active_version: boolean | null
  iteration_id: string | null
  is_current: boolean | null
  iteration_num: number | null
  iteration_date: string | null
}

export interface Stay {
  id: string
  stay_id: string
  trip_id: string
  destination: string | null
  property_name: string
  room_type: string | null
  bed_type: string | null
  room_features: string[] | null
  meals: string | null
  meal_preferences: string[] | null
  check_in: string | null
  check_out: string | null
  nights: number | null
  property_price: string | null
  description: string | null
  image_url: string | null
  image_urls: string[] | null
  sort_order: number | null
  status: string | null
  booking_code: string | null
  coupon_url: string | null
  notion_page_id: string | null
  iteration_num: number | null
  iteration_date: string | null
  iteration_version: string | null
  is_active_version: boolean | null
  iteration_id: string | null
  is_current: boolean | null
}

export interface Transfer {
  id: string
  transfer_id: string
  trip_id: string
  transfer_mode: string | null
  transfer_style: string | null
  transfer_purpose: string | null
  from_location: string | null
  to_location: string | null
  date: string | null
  duration: string | null
  carrier: string | null
  amount: string | null
  notes: string | null
  image_url: string | null
  sort_order: number | null
  status: string | null
  booking_code: string | null
  coupon_url: string | null
  notion_page_id: string | null
  iteration_version: string | null
  is_active_version: boolean | null
  iteration_id: string | null
  is_current: boolean | null
  iteration_num: number | null
  iteration_date: string | null
}

export interface Message {
  id: string
  message_id: string
  trip_id: string
  sender: string | null
  sender_name: string | null
  message_type: string | null
  content: string
  timestamp: string
  notion_page_id: string | null
}

export interface Document {
  id: string
  document_id: string
  document_name: string
  traveler_id: string | null
  trip_id: string | null
  linked_experience_id: string | null
  linked_stay_id: string | null
  linked_transfer_id: string | null
  document_type: string | null
  category: string | null
  file_url: string | null
  expiry_date: string | null
  notes: string | null
  notion_page_id: string | null
}

export interface QuotationLineItem {
  id: string
  quotation_id: string
  category: string | null
  description: string
  amount: number | null
  currency: string | null
  notes: string | null
  sort_order: number | null
}

export interface Quotation {
  id: string
  quotation_id: string
  trip_id: string
  version: string | null
  status: string | null
  currency: string | null
  total_amount: number | null
  notes: string | null
  created_at: string
  updated_at: string
  line_items?: QuotationLineItem[]
}

export interface Payment {
  id: string
  payment_id: string
  trip_id: string
  quotation_id: string | null
  direction: string | null
  amount: number
  currency: string | null
  payment_method: string | null
  status: string | null
  payment_date: string
  reference: string | null
  vendor_name: string | null
  notes: string | null
  created_at: string
}

export interface Invoice {
  id: string
  invoice_id: string
  trip_id: string
  quotation_id: string | null
  invoice_number: string | null
  status: string | null
  amount: number | null
  currency: string | null
  issued_date: string | null
  due_date: string | null
  file_url: string | null
  notes: string | null
  created_at: string
}

export interface TripRequest {
  id: string
  client_id: string | null
  destination_ideas: string | null
  start_date: string | null
  end_date: string | null
  travelers_count: number | null
  budget_range: string | null
  the_question: string | null
  additional_notes: string | null
  status: string
  created_at: string
}

export interface NewsletterPost {
  id: string
  post_id: string
  headline: string
  content: string | null
  category: string | null
  image_url: string | null
  published_date: string | null
  status: string | null
  target_audience: string | null
  notion_page_id: string | null
}

export type DatesDestinationRowType = 'Overview' | 'Destination' | 'Activity' | 'Transit'

export interface DatesDestination {
  id: string
  notion_page_id: string | null
  trip_id: string
  row_type: DatesDestinationRowType
  iteration_num: number
  iteration_date: string | null
  sort_order: number
  // Destination
  place: string
  display_name: string | null
  dates_label: string | null
  arrival_date: string | null
  nights: number | null
  duration: string | null
  description: string | null
  atmosphere: string | null
  things_to_do: string | null
  where_you_stay: string | null
  // Transit leg
  from_location: string | null
  to_location: string | null
  travel_time: string | null
  mode: string | null
  // Trip-level narrative
  theme_intro: string | null
  pull_quote: string | null
  what_to_expect: string | null
  what_it_means: string | null
  closing_note: string | null
  sign_off: string | null
  // Imagery — image_urls is the full gallery, image_url the cover
  image_url: string | null
  image_urls: string[] | null
  map_image_url: string | null
  synced_at: string
  created_at: string
}
