import { supabase } from './supabaseClient'

/**
 * Security-aware error logging that strips sensitive data
 * and provides context for debugging without exposing user info
 */
function logSupabaseError(label, error, extra = {}) {
  console.error(label, {
    message: error?.message ?? null,
    name: error?.name ?? null,
    code: error?.code ?? null,
    status: error?.status ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    context: error?.context ?? null,
    cause: error?.cause ?? null,
    // Include extra context only for development
    ...(import.meta.env.MODE === 'development' && { extra }),
    raw: import.meta.env.MODE === 'development' ? error : null,
  })
}

/**
 * Validates required input fields
 * @throws {Error} if any required field is missing or invalid
 */
function validateInput(data, requiredFields, label) {
  const missing = requiredFields.filter((field) => !data?.[field])
  if (missing.length > 0) {
    throw new Error(`Invalid ${label}: missing required fields [${missing.join(', ')}]`)
  }
}

function toBookingSlot(booking) {
  return {
    id: booking.slot_id ?? `booking-${booking.id}`,
    service_id: booking.service_id,
    business_id: booking.business_id,
    date: booking.slot_date,
    start_time: booking.slot_start_time,
    end_time: booking.slot_end_time,
    status: booking.status === 'cancelled' ? 'available' : booking.status,
  }
}

/**
 * Authenticates user from current session
 * @returns {Promise<string>} user ID from auth.uid()
 * @throws {Error} if not authenticated
 */
async function requireAuth() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error || !session?.user?.id) {
    throw new Error('Authentication required')
  }
  return session.user.id
}

/**
 * Gets current user's role from public.users table
 * @param {string} userId - user ID from auth
 * @returns {Promise<string>} role ('owner' or 'customer')
 * @throws {Error} if user not found
 */
async function getUserRole(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) {
    logSupabaseError('Failed to fetch user role', error)
    throw new Error('User profile not found')
  }

  return data.role
}

function normalizeUserProfile(profile, authUser) {
  if (!profile && !authUser) return null
  return {
    id: profile?.id ?? authUser?.id,
    email: profile?.email ?? authUser?.email ?? '',
    role: profile?.role ?? authUser?.user_metadata?.role ?? 'customer',
    full_name: authUser?.user_metadata?.full_name ?? authUser?.user_metadata?.name ?? authUser?.email?.split('@')[0] ?? 'User',
    dark_mode: profile?.dark_mode ?? false,
  }
}

async function fetchPublicUserProfile(userId) {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
  if (error) {
    throw error
  }
  return data
}

async function upsertPublicUserProfile({
  userId,
  email,
  role,
}) {
  const payload = {
    id: userId,
    email,
    role,
  }

  const { data, error } = await supabase
    .from('users')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()

  if (error) {
    logSupabaseError('public.users upsert failed', error, { payload })
    throw error
  }

  return data
}

async function ensurePublicUserProfile({
  userId,
  email,
  fullName,
  role,
}) {
  const existingProfile = await fetchPublicUserProfile(userId)
  if (existingProfile) {
    return existingProfile
  }

  try {
    return await upsertPublicUserProfile({
      userId,
      email,
      fullName,
      role,
    })
  } catch (upsertError) {
    logSupabaseError('Direct public.users upsert failed, trying edge function fallback.', upsertError, {
      userId,
      email,
      fullName,
      role,
    })

    const functionBody = {
      id: userId,
      userId,
      email,
      name: fullName,
      fullName,
      role,
    }

    console.info('Invoking createAutoUserInPublic edge function', functionBody)

    const { data: invokeData, error: invokeError } = await supabase.functions.invoke('createAutoUserInPublic', {
      body: functionBody,
    })

    console.info('createAutoUserInPublic edge function response', invokeData)

    if (invokeError) {
      logSupabaseError('createAutoUserInPublic edge function failed', invokeError, {
        functionBody,
        invokeData,
      })
      throw invokeError
    }

    const profileAfterFunction = await fetchPublicUserProfile(userId)
    if (!profileAfterFunction) {
      throw new Error('Profile creation did not complete successfully.')
    }

    return profileAfterFunction
  }
}

async function getBusinessCatalogFromSupabase() {
  const { data: businesses, error: businessesError } = await supabase
    .from('businesses')
    .select('*')
    .order('created_at', { ascending: true })

  if (businessesError) {
    throw businessesError
  }

  if (!businesses || businesses.length === 0) {
    return { business: null, businesses: [], services: [] }
  }

  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: true })

  if (servicesError) {
    throw servicesError
  }

  const { data: availableSlots, error: slotsError } = await supabase
    .from('slots')
    .select('service_id')
    .eq('status', 'available')

  if (slotsError) {
    throw slotsError
  }

  const slotCountByService = availableSlots.reduce((counts, slot) => {
    counts[slot.service_id] = (counts[slot.service_id] ?? 0) + 1
    return counts
  }, {})

  const businessesById = Object.fromEntries(businesses.map((business) => [business.id, business]))

  return {
    business: null,
    businesses,
    services: services.map((service) => ({
      ...service,
      business: businessesById[service.business_id] ?? null,
      business_name: businessesById[service.business_id]?.name ?? 'Business',
      availableSlots: slotCountByService[service.id] ?? 0,
    })),
  }
}

async function getOwnerDashboardFromSupabase(ownerId) {
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (businessError) {
    throw businessError
  }

  if (!business) {
    return { business: null, services: [], appointments: [] }
  }

  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', business.id)

  if (servicesError) {
    throw servicesError
  }

  let bookings = []
  let bookingsError = null

  const bookingsResult = await supabase
    .from('bookings')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  bookings = bookingsResult.data || []
  bookingsError = bookingsResult.error

  if (bookingsError?.code === '42703') {
    const { data: slots, error: slotsError } = await supabase
      .from('slots')
      .select('*')
      .eq('business_id', business.id)

    if (slotsError) {
      throw slotsError
    }

    const slotIds = slots.map((slot) => slot.id)
    if (slotIds.length === 0) {
      return { business, services, appointments: [] }
    }

    const fallbackBookingsResult = await supabase
      .from('bookings')
      .select('*')
      .in('slot_id', slotIds)
      .order('created_at', { ascending: false })

    bookings = fallbackBookingsResult.data || []
    bookingsError = fallbackBookingsResult.error
  }

  if (bookingsError) {
    throw bookingsError
  }

  if (bookings.length === 0) {
    return { business, services, appointments: [] }
  }

  const customerIds = [...new Set(bookings.map((booking) => booking.customer_id))]
  const { data: customers, error: customersError } = customerIds.length
    ? await supabase.from('users').select('*').in('id', customerIds)
    : { data: [], error: null }

  if (customersError) {
    throw customersError
  }

  const servicesById = Object.fromEntries(services.map((service) => [service.id, service]))
  const customersById = Object.fromEntries(customers.map((customer) => [customer.id, customer]))

  return {
    business,
    services,
    appointments: bookings.map((booking) => {
      return {
        ...booking,
        slot: toBookingSlot(booking),
        service: servicesById[booking.service_id],
        customer: customersById[booking.customer_id],
      }
    }),
  }
}

async function getServiceAvailabilityFromSupabase(serviceId) {
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single()

  if (serviceError) {
    throw serviceError
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', service.business_id)
    .single()

  if (businessError) {
    throw businessError
  }

  const { data: slots, error: slotsError } = await supabase
    .from('slots')
    .select('*')
    .eq('service_id', serviceId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (slotsError) {
    throw slotsError
  }

  return { service, business, slots }
}

async function getCustomerBookingsFromSupabase(customerId) {
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (bookingsError) {
    throw bookingsError
  }

  const serviceIds = [...new Set(bookings.map((booking) => booking.service_id))]
  const businessIds = [...new Set(bookings.map((booking) => booking.business_id))]

  const { data: services, error: servicesError } = serviceIds.length
    ? await supabase.from('services').select('*').in('id', serviceIds)
    : { data: [], error: null }

  if (servicesError) {
    throw servicesError
  }

  const { data: businesses, error: businessesError } = businessIds.length
    ? await supabase.from('businesses').select('*').in('id', businessIds)
    : { data: [], error: null }

  if (businessesError) {
    throw businessesError
  }

  const servicesById = Object.fromEntries(services.map((service) => [service.id, service]))
  const businessesById = Object.fromEntries(businesses.map((business) => [business.id, business]))

  return bookings.map((booking) => {
    const slot = toBookingSlot(booking)
    const service = servicesById[booking.service_id]
    return {
      ...booking,
      slot,
      service,
      business: businessesById[booking.business_id],
    }
  })
}

async function getBookingByIdFromSupabase(bookingId) {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (bookingError) {
    throw bookingError
  }

  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('*')
    .eq('id', booking.service_id)
    .single()

  if (serviceError) {
    throw serviceError
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', booking.business_id)
    .single()

  if (businessError) {
    throw businessError
  }

  return { ...booking, slot: toBookingSlot(booking), service, business }
}

async function getAnalyticsFromSupabase(ownerId) {
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', ownerId)
    .single()

  if (businessError) {
    throw businessError
  }

  const { data: analyticsRows, error: analyticsError } = await supabase
    .from('analytics')
    .select('*')
    .eq('business_id', business.id)

  if (analyticsError) {
    throw analyticsError
  }

  const summary = analyticsRows.reduce(
    (accumulator, row) => {
      accumulator.totalBookings += Number(row.total_bookings ?? 0)
      accumulator.confirmedBookings += Number(row.confirmed_bookings ?? 0)
      accumulator.pendingBookings += Number(row.pending_bookings ?? 0)
      accumulator.revenue += Number(row.revenue ?? 0)
      accumulator.serviceMap[row.service_name] =
        (accumulator.serviceMap[row.service_name] ?? 0) + Number(row.total_bookings ?? 0)
      return accumulator
    },
    {
      totalBookings: 0,
      confirmedBookings: 0,
      pendingBookings: 0,
      revenue: 0,
      serviceMap: {},
    },
  )

  return {
    totalBookings: summary.totalBookings,
    confirmedBookings: summary.confirmedBookings,
    pendingBookings: summary.pendingBookings,
    revenue: summary.revenue,
    serviceBreakdown: Object.entries(summary.serviceMap).map(([name, bookings]) => ({
      name,
      bookings,
    })),
  }
}

export async function loginUser(credentials) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })

  if (error) {
    throw error
  }

  const profile = await ensurePublicUserProfile({
    userId: data.user.id,
    email: data.user.email,
    fullName:
      data.user.user_metadata?.full_name ??
      data.user.user_metadata?.name ??
      data.user.email?.split('@')[0] ??
      'User',
    role: data.user.user_metadata?.role ?? 'customer',
  })

  return normalizeUserProfile(profile, data.user)
}

export async function signupUser(input) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        role: input.role,
      },
    },
  })

  if (error) {
    throw error
  }

  if (!data.user) {
    throw new Error('Signup succeeded but no user was returned by Supabase.')
  }

  const profile = await ensurePublicUserProfile({
    userId: data.user.id,
    email: data.user.email,
    fullName: input.fullName,
    role: input.role,
  })

  return normalizeUserProfile(profile, data.user)
}

export async function getBusinessCatalog() {
  return getBusinessCatalogFromSupabase()
}

export async function getOwnerDashboard(ownerId) {
  return getOwnerDashboardFromSupabase(ownerId)
}

/**
 * Creates or updates a business for owner
 * Only one business per owner allowed (enforced by unique constraint)
 * @security owner_id must match authenticated user
 */
export async function saveBusiness(ownerId, input) {
  const userId = await requireAuth()
  if (userId !== ownerId) {
    throw new Error('Not authorized to save business for this owner')
  }

  validateInput(
    input,
    ['name', 'description', 'working_days', 'start_time', 'end_time', 'timezone'],
    'business',
  )

  // Check if business already exists
  const { data: existing, error: existingError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (existingError) {
    logSupabaseError('Failed to check existing business', existingError)
    throw new Error('Failed to save business')
  }

  const payload = {
    owner_id: ownerId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    working_days: Array.isArray(input.working_days) ? input.working_days : [],
    start_time: input.start_time,
    end_time: input.end_time,
    timezone: input.timezone,
  }

  if (existing?.id) {
    // Update existing
    const { data, error } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      logSupabaseError('Failed to update business', error, { payload })
      throw new Error('Failed to update business')
    }

    return data
  } else {
    // Create new
    const { data, error } = await supabase
      .from('businesses')
      .insert([payload])
      .select()
      .single()

    if (error) {
      logSupabaseError('Failed to create business', error, { payload })
      throw new Error('Failed to create business')
    }

    return data
  }
}

/**
 * Creates or updates a service in a business
 * @security business must belong to authenticated owner
 */
export async function saveService(businessId, input) {
  const userId = await requireAuth()
  validateInput(input, ['name', 'duration_mins', 'price'], 'service')

  // Verify owner of business - RLS will also check this
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', businessId)
    .single()

  if (businessError) {
    logSupabaseError('Business not found', businessError)
    throw new Error('Business not found')
  }

  if (business.owner_id !== userId) {
    throw new Error('Not authorized to manage this business')
  }

  const payload = {
    business_id: businessId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    duration_mins: Math.max(15, Math.min(480, input.duration_mins)),
    buffer_mins: Math.max(0, Math.min(120, input.buffer_mins || 0)),
    price: Math.max(0, parseFloat(input.price) || 0),
  }

  if (input.id) {
    // Update existing service
    const { data, error } = await supabase
      .from('services')
      .update(payload)
      .eq('id', input.id)
      .eq('business_id', businessId)
      .select()
      .single()

    if (error) {
      logSupabaseError('Failed to update service', error, { payload })
      if (error.code === '23505') {
        throw new Error('A service with this name already exists for this business')
      }
      throw new Error('Failed to update service')
    }

    return data
  } else {
    // Create new service and generate slots through SQL RPC
    const { data, error } = await supabase.rpc('create_service_with_slots', {
      p_business_id: businessId,
      p_name: payload.name,
      p_description: payload.description,
      p_duration_mins: payload.duration_mins,
      p_buffer_mins: payload.buffer_mins,
      p_price: payload.price,
    })

    if (error) {
      logSupabaseError('Failed to create service', error, { payload })
      if (error.code === '23505') {
        throw new Error('A service with this name already exists for this business')
      }
      throw new Error('Failed to create service')
    }

    return data
  }
}

/**
 * Deletes a service and all associated slots/bookings
 * @security service must belong to authenticated owner
 */
export async function deleteService(serviceId) {
  const userId = await requireAuth()

  // Verify owner through business relationship - RLS will also check
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('business_id')
    .eq('id', serviceId)
    .single()

  if (serviceError) {
    logSupabaseError('Service not found', serviceError)
    throw new Error('Service not found')
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', service.business_id)
    .single()

  if (businessError || business.owner_id !== userId) {
    throw new Error('Not authorized to delete this service')
  }

  const { error } = await supabase.from('services').delete().eq('id', serviceId)

  if (error) {
    logSupabaseError('Failed to delete service', error)
    throw new Error('Failed to delete service')
  }

  return { success: true }
}

export async function getServiceAvailability(serviceId) {
  return getServiceAvailabilityFromSupabase(serviceId)
}

/**
 * Creates a booking for a customer
 * Uses SQL function for atomic transaction
 * @security customer must be authenticated
 */
export async function createBooking(slotId) {
  const userId = await requireAuth()
  const role = await getUserRole(userId)

  if (role !== 'customer') {
    throw new Error('Only customers can create bookings')
  }

  const { data, error } = await supabase.rpc('request_booking', {
    p_slot_id: slotId,
  })

  if (error) {
    logSupabaseError('Failed to create booking', error, { slotId })
    if (error.message?.includes('not available')) {
      throw new Error('This slot is no longer available')
    }
    if (error.message?.includes('not found')) {
      throw new Error('Slot not found')
    }
    throw new Error('Failed to create booking')
  }

  return data
}

/**
 * Updates booking status (owner only)
 * Restores the slot when a booking is cancelled by the owner.
 * @security owner_id must match authenticated owner of business
 */
export async function updateBookingStatus(bookingId, status) {
  const userId = await requireAuth()
  const role = await getUserRole(userId)

  if (role !== 'owner') {
    throw new Error('Only business owners can update booking status')
  }

  if (!['confirmed', 'cancelled'].includes(status)) {
    throw new Error('Invalid booking status')
  }

  const { data, error } = await supabase.rpc('owner_set_booking_status', {
    p_booking_id: bookingId,
    p_status: status,
  })

  if (error) {
    logSupabaseError('Failed to update booking status', error, { bookingId, status })
    if (error.message?.includes('do not own')) {
      throw new Error('Not authorized to manage this booking')
    }
    if (error.message?.includes('not found')) {
      throw new Error('Booking not found')
    }
    throw new Error('Failed to update booking status')
  }

  return data
}

export async function getCustomerBookings(customerId) {
  const userId = await requireAuth()
  // RLS policy enforces that customers can only see their own bookings
  if (userId !== customerId) {
    throw new Error('Not authorized to view these bookings')
  }

  return getCustomerBookingsFromSupabase(customerId)
}

export async function getBookingById(bookingId) {
  const userId = await requireAuth()
  const booking = await getBookingByIdFromSupabase(bookingId)

  // Verify user is either customer or owner
  const isCustomer = booking.customer_id === userId
  const isOwner = booking.business.owner_id === userId

  if (!isCustomer && !isOwner) {
    throw new Error('Not authorized to view this booking')
  }

  return booking
}

export async function getAnalytics(ownerId) {
  const userId = await requireAuth()
  if (userId !== ownerId) {
    throw new Error('Not authorized to view these analytics')
  }

  return getAnalyticsFromSupabase(ownerId)
}

/**
 * Gets current user's profile
 * @security user can only view their own profile (RLS enforced)
 */
export async function getUserProfile(userId) {
  const authUserId = await requireAuth()
  if (authUserId !== userId) {
    throw new Error('Not authorized to view this profile')
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    logSupabaseError('Failed to fetch user profile', error)
    throw new Error('User profile not found')
  }

  return data
}

/**
 * Updates user profile (theme preferences, etc.)
 * @security user can only update their own profile
 */
export async function updateUserProfile(userId, input) {
  const authUserId = await requireAuth()
  if (authUserId !== userId) {
    throw new Error('Not authorized to update this profile')
  }

  const payload = {}
  if (input.dark_mode !== undefined) {
    payload.dark_mode = Boolean(input.dark_mode)
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('No valid fields to update')
  }

  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    logSupabaseError('Failed to update user profile', error, { payload })
    throw new Error('Failed to update profile')
  }

  return data
}

export async function getCurrentSessionUser() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  if (!session?.user) {
    return null
  }

  const profile = await ensurePublicUserProfile({
    userId: session.user.id,
    email: session.user.email,
    fullName:
      session.user.user_metadata?.full_name ??
      session.user.user_metadata?.name ??
      session.user.email?.split('@')[0] ??
      'User',
    role: session.user.user_metadata?.role ?? 'customer',
  })

  return normalizeUserProfile(profile, session.user)
}

export async function logoutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
}
