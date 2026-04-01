# Booking System SaaS - Implementation Specification

## 1️⃣ Project Overview

**Project Name:** Business Appointment Booking SaaS
**Stack:**

* Frontend: React (Vite JS) + SCSS / Plain CSS
* Routing: React Router (useNavigate / Link)
* Backend & DB: Supabase (serverless)
* Authentication: Supabase Auth (email/password)
* State Management: React hooks/state only (no Redux)
* Styling: Component-based CSS/SCSS
* Advanced tools: None (no caching, Docker, Redis, Kubernetes, etc.)

**Core Idea:**
Create a system where business owners can register a business, create services, manage appointments, and view analytics. Customers can sign up, book appointments, and track booking status. Approval flow is handled per booking.

---

## 2️⃣ Roles & Permissions

### Business Owner

* Register a single business (multi-business locked for premium)
* Create services under the business
* Manage appointments: Approve / Reject / Cancel
* Filter appointments by status: Confirmed / Pending / Cancelled
* Dashboard access: Services list, Analytics, Account settings (password change, dark mode, delete account)

### Customer

* Sign up / Sign in
* Browse business services
* Book appointments (select service + date + available slot)
* View booking status: Pending / Confirmed / Cancelled

---

## 3️⃣ Feature Breakdown

### Business Owner Features

* **Business creation:** Name, description, working days, working hours, time zone
* **Service creation:** Name, duration, optional description
* **Dashboard - Services:** List services, edit/delete
* **Dashboard - Appointments:** Filterable by service/status/date, approve/reject bookings
* **Dashboard - Analytics:** Graphs for bookings, revenue, service popularity
* **Account Settings:** Password change, dark mode toggle, delete account

### Customer Features

* Browse services with slot availability
* Book appointment for available slot (future 30-day limit)
* View booking status
* Sign up / Sign in

---

## 4️⃣ Scheduling Logic

* **Slot Generation:**

  * Pre-generate slots per service based on working days, working hours, service duration, and optional buffer time
  * Store slots in `slots` table:

    ```
    id | business_id | service_id | date | start_time | end_time | status (available/booked/confirmed/cancelled)
    ```
* **Booking Transaction:**

  * Customer selects slot → check availability (`status = available`)
  * Begin transaction:

    1. Insert booking (`status = pending`)
    2. Update slot status (`booked`)
  * Commit transaction
  * Owner approval changes status: Confirmed → slot confirmed, Rejected → slot available
* **Constraints:**

  * No overlapping slots
  * Future booking limit = 30 days
  * Disabled weekdays in UI if business is closed
  * Slots sorted by earliest available

---

## 5️⃣ Database Tables (Supabase)

| Table      | Fields                                                                                            | Notes                               |
| ---------- | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| users      | id, email, password_hash, role (owner/customer), created_at                                       | Supabase Auth linked                |
| businesses | id, owner_id, name, description, working_days (array), start_time, end_time, timezone, created_at | 1 business per owner                |
| services   | id, business_id, name, duration_mins, description, created_at                                     | Each service has independent slots  |
| slots      | id, business_id, service_id, date, start_time, end_time, status                                   | Pre-generated slots                 |
| bookings   | id, slot_id, customer_id, status (pending/confirmed/cancelled), created_at                        | Transactional booking               |
| analytics  | optional derived table                                                                            | Aggregated bookings per service/day |

> RLS policies assumed enabled; agent must write code considering row-level security is active.

---

## 6. Frontend Folder Structure

```
src/
│
├─ components/
│  ├─ Header/Header.jsx + Header.scss
│  ├─ Footer/Footer.jsx + Footer.scss
│  ├─ BusinessCard/BusinessCard.jsx + BusinessCard.scss
│  └─ ... (all components modular)
│
├─ pages/
│  ├─ Login.jsx
│  ├─ Signup.jsx
│  ├─ Dashboard/
│  │   ├─ Dashboard.jsx
│  │   ├─ Services.jsx
│  │   ├─ Analytics.jsx
│  │   └─ Account.jsx
│  ├─ Booking/
│  │   ├─ BookingPage.jsx
│  │   └─ BookingConfirmation.jsx
│
├─ routes/AppRouter.jsx
├─ utils/
│  ├─ supabaseClient.js
│  ├─ slotHelpers.js
│  └─ dateUtils.js
├─ styles/global.scss
└─ App.jsx
```

**Agent Instructions:**

* Component-specific CSS/SCSS must stay inside component folder
* Use React Router for navigation
* SCSS or plain CSS only
* Integration with Supabase via `supabaseClient.js`
* No Redux / caching / advanced tooling

---

## 7. Routing

```
/           -> Home / Landing
/signup     -> Signup
/login      -> Login
/dashboard  -> Owner Dashboard (Services / Analytics / Account)
/booking/:serviceId  -> Customer Booking Page
/booking/confirmation/:bookingId  -> Booking Confirmation Page
```

* Protected routes for role-based access
* Redirect unauthorized users to login

---

## 8. Supabase Integration Rules

* Use environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`)
* Queries must consider RLS enabled
* Booking transaction must be atomic
* Slot generation respects working days, hours, service duration, buffer time
* Analytics endpoints aggregate bookings per service/day

---

## 9. Design & UX Guidelines

* Modern, clean dashboard UI
* Mobile responsive
* Dark/light mode toggle
* Tables with filtering (appointments by status/service/date)
* Slot selection UI disables unavailable days & past dates
* Slots displayed sorted by earliest available

---

## 10. Deliverables for Agent

1. React frontend components + pages
2. Routing via React Router
3. Supabase integration (auth, CRUD, slots, bookings)
4. Transactional booking logic
5. Slot generation helper functions
6. Analytics endpoints (aggregated bookings)
7. Environment-variable driven configuration
8. Clean folder structure ready for deployment
9. Code ready for RLS policies to be applied by client

**Notes:**

* Agent must write modular, clean code considering future integration/deployment
* No caching, advanced tools, or multi-service booking for v1

---

**End of Specification**

