export type LocationDraft = {
  address: string
  city?: string
  state?: string
  pincode?: string
  latitude?: number
  longitude?: number
}

type GoogleAddressComponent = {
  long_name: string
  short_name: string
  types: string[]
}

type GoogleGeocodeResult = {
  formatted_address?: string
  address_components?: GoogleAddressComponent[]
}

type GoogleGeocodeResponse = {
  status: string
  error_message?: string
  results?: GoogleGeocodeResult[]
}

type NominatimAddress = {
  house_number?: string
  building?: string
  road?: string
  neighbourhood?: string
  suburb?: string
  village?: string
  town?: string
  city?: string
  city_district?: string
  state_district?: string
  county?: string
  state?: string
  country?: string
  postcode?: string
}

type NominatimResponse = {
  display_name?: string
  address?: NominatimAddress
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

function currentPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Location access is not supported by this browser.'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  })
}

export async function getCurrentCoordinates() {
  const position = await currentPosition()
  return {
    latitude: Number(position.coords.latitude.toFixed(7)),
    longitude: Number(position.coords.longitude.toFixed(7)),
  }
}

function componentValue(components: GoogleAddressComponent[], ...types: string[]) {
  return components.find((component) => types.every((type) => component.types.includes(type)))?.long_name
}

function firstComponentValue(components: GoogleAddressComponent[], typeOptions: string[][]) {
  for (const types of typeOptions) {
    const value = componentValue(components, ...types)
    if (value) return value
  }
  return undefined
}

function uniqueParts(parts: Array<string | undefined>) {
  const seen = new Set<string>()
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => {
      if (!part || seen.has(part.toLowerCase())) return false
      seen.add(part.toLowerCase())
      return true
    })
}

function uniqueLabeledParts(parts: Array<[string, string | undefined]>) {
  const seenValues = new Set<string>()
  return parts
    .map(([label, value]) => [label, value?.trim()] as const)
    .filter((entry): entry is readonly [string, string] => {
      const value = entry[1]
      if (!value) return false
      const normalized = value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
      if (!normalized || seenValues.has(normalized)) return false
      seenValues.add(normalized)
      return true
    })
    .map(([, value]) => value)
}

function fallbackDisplayAddress(displayName?: string) {
  return uniqueParts((displayName ?? '').split(',')).join(', ')
}

function readGoogleAddress(result: GoogleGeocodeResult, latitude: number, longitude: number): LocationDraft {
  const components = result.address_components ?? []
  const houseNumber = componentValue(components, 'street_number')
  const buildingName = firstComponentValue(components, [['premise'], ['establishment']])
  const apartment = componentValue(components, 'subpremise')
  const floor = componentValue(components, 'floor')
  const street = componentValue(components, 'route')
  const locality = firstComponentValue(components, [['sublocality_level_1'], ['sublocality'], ['locality']])
  const area = firstComponentValue(components, [['sublocality_level_2'], ['sublocality_level_1'], ['neighborhood']])
  const colony = firstComponentValue(components, [['sublocality_level_3'], ['neighborhood']])
  const landmark = firstComponentValue(components, [['point_of_interest'], ['establishment']])
  const villageOrTown = firstComponentValue(components, [['locality'], ['postal_town'], ['administrative_area_level_4']])
  const city = firstComponentValue(components, [['locality'], ['postal_town'], ['administrative_area_level_3']])
  const district = firstComponentValue(components, [['administrative_area_level_3'], ['administrative_area_level_2']])
  const state = componentValue(components, 'administrative_area_level_1')
  const country = componentValue(components, 'country')
  const pincode = componentValue(components, 'postal_code')
  const address = uniqueLabeledParts([
    ['House Number', houseNumber],
    ['Building Name', buildingName],
    ['Apartment', apartment],
    ['Floor', floor],
    ['Street', street],
    ['Locality', locality],
    ['Area', area],
    ['Colony', colony],
    ['Landmark', landmark],
    ['Village/Town', villageOrTown],
    ['City', city],
    ['District', district],
    ['State', state],
    ['Country', country],
    ['PIN Code', pincode],
  ]).join(', ') || fallbackDisplayAddress(result.formatted_address)

  return {
    address,
    city: district || city,
    state,
    pincode,
    latitude,
    longitude,
  }
}

function readNominatimAddress(data: NominatimResponse, latitude: number, longitude: number): LocationDraft {
  const source = data.address ?? {}
  const city = source.city_district || source.state_district || source.county || source.city || source.town || source.village || source.suburb
  const address = uniqueLabeledParts([
    ['House Number', source.house_number],
    ['Building Name', source.building],
    ['Street', source.road],
    ['Locality', source.neighbourhood || source.suburb],
    ['Area', source.suburb],
    ['Colony', source.neighbourhood],
    ['Village/Town', source.village || source.town],
    ['City', source.city || source.town],
    ['District', source.city_district || source.state_district || source.county],
    ['State', source.state],
    ['Country', source.country],
    ['PIN Code', source.postcode],
  ]).join(', ') || fallbackDisplayAddress(data.display_name)

  return {
    address,
    city,
    state: source.state,
    pincode: source.postcode,
    latitude,
    longitude,
  }
}

async function getFallbackAddress(latitude: number, longitude: number): Promise<LocationDraft> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    addressdetails: '1',
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Could not read a full address for this location. Please enter the address manually.')
  }

  const data = await response.json() as NominatimResponse
  const location = readNominatimAddress(data, latitude, longitude)
  if (!location.address) {
    throw new Error('Could not read a full address for this location. Please enter the address manually.')
  }
  return location
}

function fullAddressOrFallback(location: LocationDraft, latitude: number, longitude: number): LocationDraft | null {
  if (!location.address || /latitude|longitude/i.test(location.address)) return null
  return {
    ...location,
    latitude,
    longitude,
  }
}

export async function getCurrentLocationAddress(): Promise<LocationDraft> {
  const position = await currentPosition()
  const latitude = Number(position.coords.latitude.toFixed(7))
  const longitude = Number(position.coords.longitude.toFixed(7))

  if (!GOOGLE_MAPS_API_KEY) {
    return getFallbackAddress(latitude, longitude)
  }

  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    key: GOOGLE_MAPS_API_KEY,
    result_type: [
      'street_address',
      'premise',
      'subpremise',
      'point_of_interest',
      'neighborhood',
      'sublocality',
      'locality',
      'postal_code',
    ].join('|'),
  })

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`)
    if (!response.ok) {
      return getFallbackAddress(latitude, longitude)
    }

    const data = await response.json() as GoogleGeocodeResponse
    if (data.status !== 'OK' || !data.results?.length) {
      return getFallbackAddress(latitude, longitude)
    }

    return fullAddressOrFallback(readGoogleAddress(data.results[0], latitude, longitude), latitude, longitude) ?? getFallbackAddress(latitude, longitude)
  } catch {
    return getFallbackAddress(latitude, longitude)
  }
}
