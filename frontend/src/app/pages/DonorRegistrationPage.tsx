import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  FileCheck2,
  Loader2,
  MapPin,
  Store,
  Truck,
} from 'lucide-react'
import { registerDonor, type AuthUser, type DonorRegistrationPayload, type StoredDocument } from '../api'
import { Field, FormSection, SelectField } from '../components/RegistrationFields'

function ChoicePill({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
        active
          ? 'border-emerald-400 bg-emerald-100 text-emerald-950 ring-4 ring-emerald-100 dark:bg-emerald-400/20 dark:text-emerald-100 dark:ring-emerald-400/15'
          : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200'
      }`}
    >
      <span className={`h-4 w-4 rounded-full border-2 ${active ? 'border-emerald-400 bg-emerald-400' : 'border-slate-300'}`} />
      {label}
    </button>
  )
}

function DocumentCard({ title, copy, name, required = false }: { title: string; copy: string; name: string; required?: boolean }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 transition hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm dark:bg-emerald-400/20 dark:text-emerald-100">
          <FileCheck2 size={23} />
        </span>
        <div>
          <p className="font-black text-slate-950 dark:text-white">{title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{copy}</p>
          <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-white/10 dark:text-emerald-100 dark:ring-emerald-400/20">
            <input className="sr-only" name={name} type="file" required={required} accept=".pdf,.jpg,.jpeg,.png" />
            Choose document{required ? ' *' : ''}
          </label>
        </div>
      </div>
    </div>
  )
}

interface DonorRegistrationPageProps {
  onBack: () => void
  onSubmit: (user: AuthUser, tokens?: { accessToken?: string; refreshToken?: string }) => void
}

export default function DonorRegistrationPage({ onBack, onSubmit }: DonorRegistrationPageProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const lastPincodeRef = useRef('')
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locating, setLocating] = useState(false)
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [pincodeAutoFilled, setPincodeAutoFilled] = useState(false)
  const [foodType, setFoodType] = useState<DonorRegistrationPayload['foodType']>('Veg')
  const [pickupAvailability, setPickupAvailability] = useState<DonorRegistrationPayload['pickupAvailability']>('NGO Pickup')
  const [locationState, setLocationState] = useState<{ address: string; latitude?: number; longitude?: number }>({ address: '' })

  useEffect(() => {
    const draft = localStorage.getItem('foodbridge-donor-draft')
    if (!draft || !formRef.current) return
    try {
      const values = JSON.parse(draft) as Record<string, string>
      for (const [name, value] of Object.entries(values)) {
        const control = formRef.current.elements.namedItem(name)
        if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) control.value = value
      }
      if (values.address) setLocationState((current) => ({ ...current, address: values.address }))
      if (values.foodType) setFoodType(values.foodType as DonorRegistrationPayload['foodType'])
      if (values.pickupAvailability) setPickupAvailability(values.pickupAvailability as DonorRegistrationPayload['pickupAvailability'])
      setStatus('Saved draft restored. Please re-select document files.')
    } catch {
      localStorage.removeItem('foodbridge-donor-draft')
    }
  }, [])

  const fileToDocument = (file: File): Promise<StoredDocument> => {
    if (file.size > 2 * 1024 * 1024) return Promise.reject(new Error(`${file.name} must be smaller than 2 MB`))
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data: String(reader.result) })
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
      reader.readAsDataURL(file)
    })
  }

  const getDocument = async (formData: FormData, name: string) => {
    const file = formData.get(name)
    return file instanceof File && file.size > 0 ? fileToDocument(file) : undefined
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('')
    setIsSubmitting(true)
    try {
      const formData = new FormData(event.currentTarget)
      const identityProof = await getDocument(formData, 'identityProof')
      if (!identityProof) throw new Error('Identity proof is required')
      const payload: DonorRegistrationPayload = {
        businessName: String(formData.get('businessName') ?? '').trim(),
        businessType: String(formData.get('businessType') ?? ''),
        fssaiLicenseNumber: String(formData.get('fssaiLicenseNumber') ?? '').trim(),
        businessRegistrationNumber: String(formData.get('businessRegistrationNumber') ?? '').trim(),
        ownerName: String(formData.get('ownerName') ?? '').trim(),
        phone: String(formData.get('phone') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim(),
        address: String(formData.get('address') ?? '').trim(),
        city: String(formData.get('city') ?? '').trim(),
        state: String(formData.get('state') ?? '').trim(),
        pincode: String(formData.get('pincode') ?? '').trim(),
        latitude: locationState.latitude,
        longitude: locationState.longitude,
        foodType,
        averageDailySurplus: Number(formData.get('averageDailySurplus')) || undefined,
        pickupAvailability,
        documents: {
          fssaiCertificate: await getDocument(formData, 'fssaiCertificate'),
          businessLicense: await getDocument(formData, 'businessLicense'),
          identityProof,
        },
      }
      const response = await registerDonor(payload)
      localStorage.removeItem('foodbridge-donor-draft')
      onSubmit(response.user, response)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to register donor')
    } finally {
      setIsSubmitting(false)
    }
  }

  const saveDraft = () => {
    if (!formRef.current) return
    const values: Record<string, string> = {}
    new FormData(formRef.current).forEach((value, key) => {
      if (typeof value === 'string') values[key] = value
    })
    values.foodType = foodType
    values.pickupAvailability = pickupAvailability
    localStorage.setItem('foodbridge-donor-draft', JSON.stringify(values))
    setStatus('Draft saved on this device. Document files are not included.')
  }

  const fillAddressFields = (address: Record<string, string>, displayName: string, options: { preservePincode?: boolean } = {}) => {
    if (!formRef.current) return

    const setField = (name: string, value?: string) => {
      const control = formRef.current?.elements.namedItem(name)
      if (control instanceof HTMLInputElement && value) control.value = value
    }

    const city = address.city || address.town || address.village || address.suburb || address.county
    const state = address.state
    const pincode = address.postcode
    const readableAddress = displayName || [
      address.road,
      address.neighbourhood || address.suburb,
      city,
      state,
      pincode,
    ].filter(Boolean).join(', ')

    setField('address', readableAddress)
    setLocationState((current) => ({
      address: readableAddress,
      latitude: current.latitude,
      longitude: current.longitude,
    }))
    setField('city', city)
    setField('state', state)
    const pincodeControl = formRef.current.elements.namedItem('pincode')
    const existingPincode = pincodeControl instanceof HTMLInputElement ? pincodeControl.value.replace(/\D/g, '') : ''
    if (!options.preservePincode || existingPincode.length !== 6) {
      setField('pincode', pincode)
    }
  }

  const handlePincodeChange = async (pincode: string) => {
    const cleanPincode = pincode.replace(/\D/g, '').slice(0, 6)
    const setField = (name: string, value: string) => {
      const control = formRef.current?.elements.namedItem(name)
      if (control instanceof HTMLInputElement) control.value = value
    }

    if (cleanPincode.length !== 6) {
      lastPincodeRef.current = ''
      setPincodeLoading(false)
      if (pincodeAutoFilled) {
        setField('city', '')
        setField('state', '')
        setPincodeAutoFilled(false)
      }
      return
    }

    if (lastPincodeRef.current === cleanPincode) return
    lastPincodeRef.current = cleanPincode

    setStatus('')
    setPincodeLoading(true)
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${cleanPincode}`)
      if (!response.ok) throw new Error('Network error')
      const data = await response.json() as Array<{ Status?: string; Message?: string; PostOffice?: Array<{ District?: string; State?: string }> | null }>
      const result = data[0]
      const postOffice = result?.PostOffice?.[0]
      const currentPincodeControl = formRef.current?.elements.namedItem('pincode')
      const currentPincode = currentPincodeControl instanceof HTMLInputElement ? currentPincodeControl.value.replace(/\D/g, '').slice(0, 6) : ''
      if (currentPincode !== cleanPincode || lastPincodeRef.current !== cleanPincode) return
      if (result?.Status === 'Error') {
        setField('city', '')
        setField('state', '')
        setPincodeAutoFilled(false)
        setStatus('Invalid PIN code.')
        return
      }
      if (!postOffice?.District || !postOffice.State) {
        setField('city', '')
        setField('state', '')
        setPincodeAutoFilled(false)
        setStatus('No location found for this PIN code.')
        return
      }
      setField('city', postOffice.District)
      setField('state', postOffice.State)
      setPincodeAutoFilled(true)
    } catch {
      setField('city', '')
      setField('state', '')
      setPincodeAutoFilled(false)
      setStatus('Could not fetch location details. Please check your network and try again.')
    } finally {
      if (lastPincodeRef.current === cleanPincode) setPincodeLoading(false)
    }
  }

  const fillCurrentLocation = () => {
    setStatus('')
    if (!navigator.geolocation) {
      setStatus('GPS is not available in this browser.')
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=${latitude}&lon=${longitude}`)
          if (!response.ok) throw new Error('Unable to read address from your location.')
          const result = await response.json() as { display_name?: string; address?: Record<string, string> }
          if (!result.display_name) throw new Error('No readable address found for your current location.')
          setLocationState({ address: result.display_name, latitude, longitude })
          fillAddressFields(result.address ?? {}, result.display_name)
          setStatus('Current address filled automatically.')
        } catch (error) {
          setStatus(error instanceof Error ? error.message : 'Unable to fetch address from your location.')
        } finally {
          setLocating(false)
        }
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? 'Location permission was denied. Please allow location access to use this feature.' : 'GPS is unavailable right now. Please try again or enter the address manually.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <section className="premium-page registration-page relative isolate overflow-hidden bg-[linear-gradient(180deg,#F8FAFC_0%,#F0FDF4_52%,#ECFDF5_100%)] px-5 py-12 text-[#111827] dark:bg-[linear-gradient(180deg,#020617_0%,#0B1220_52%,#111827_100%)] dark:text-[#F9FAFB] lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_10%,rgba(22,163,74,.12),transparent_30%),radial-gradient(circle_at_88%_14%,rgba(15,118,110,.09),transparent_28%),radial-gradient(circle_at_66%_6%,rgba(14,165,233,.07),transparent_25%)] dark:bg-[radial-gradient(circle_at_14%_8%,rgba(34,197,94,.10),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(6,182,212,.09),transparent_28%),radial-gradient(circle_at_66%_6%,rgba(99,102,241,.08),transparent_25%)]" />
      <div className="mx-auto max-w-6xl">
        <button onClick={onBack} className="mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/85 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur transition hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:border-emerald-400/30 dark:hover:text-emerald-200">
          <ChevronLeft size={17} />
          Back
        </button>

        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="registration-hero rounded-3xl bg-gradient-to-br from-emerald-100 via-[#16A34A]/40 to-[#0F766E]/50 p-8 text-emerald-950 shadow-2xl shadow-emerald-400/20 dark:from-[#22C55E]/20 dark:via-[#14B8A6]/20 dark:to-[#1F2937] dark:text-[#F9FAFB] lg:sticky lg:top-28 lg:self-start">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/45 px-4 py-2 text-sm font-bold ring-1 ring-white/60 backdrop-blur dark:bg-white/10 dark:ring-white/15">
              <Store size={17} />
              Verified donor onboarding
            </span>
            <h1 className="premium-display mt-6 text-5xl font-normal leading-tight tracking-tight md:text-6xl">Register as a Food Donor</h1>
            <p className="mt-5 text-lg leading-8">
              Join restaurants, hotels, bakeries, and caterers turning surplus food into meaningful meals for communities.
            </p>
            <div className="mt-8 grid gap-3">
              {['Verified donor network', 'Safe food distribution', 'Real-time donation tracking'].map((item) => (
                <p key={item} className="flex items-center gap-3 rounded-2xl bg-white/35 px-4 py-3 font-semibold ring-1 ring-white/50 backdrop-blur dark:bg-white/10 dark:ring-white/10">
                  <CheckCircle2 size={20} />
                  {item}
                </p>
              ))}
            </div>
          </aside>

          <form ref={formRef} onSubmit={handleSubmit} className="registration-form rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-900/90 md:p-8">
            <FormSection title="Business Details">
              <Field label="Business Name *" name="businessName" placeholder="Green Leaf Restaurant" required />
              <SelectField label="Business Type *" name="businessType" options={['Restaurant', 'Hotel', 'Caterer', 'Bakery', 'Event Organizer']} required />
              <Field label="FSSAI License Number" name="fssaiLicenseNumber" placeholder="FSSAI-1234567890" />
              <Field label="Business Registration Number (Optional)" name="businessRegistrationNumber" placeholder="BRN-2024-001" />
            </FormSection>

            <FormSection title="Contact Details">
              <Field label="Owner/Manager Name *" name="ownerName" placeholder="Enter owner or manager name" required />
              <Field label="Mobile Number *" name="phone" placeholder="9876543210" required type="tel" inputMode="tel" pattern="(?:\\+?91[ -]?)?[6-9][0-9]{9}" />
              <Field label="Email Address *" name="email" placeholder="donor@example.com" required type="email" />
            </FormSection>

            <FormSection title="Address Details">
              <Field label="Full Address *" name="address" placeholder="Street, kitchen gate, landmark" required wide value={locationState.address} onChange={(event) => setLocationState({ address: event.currentTarget.value })} action={<button type="button" onClick={fillCurrentLocation} disabled={locating} aria-label="Use current location" className="flex w-12 shrink-0 items-center justify-center text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-400/10">{locating ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}</button>} />
              <input type="hidden" name="latitude" value={locationState.latitude ?? ''} />
              <input type="hidden" name="longitude" value={locationState.longitude ?? ''} />
              <Field label="District *" name="city" placeholder="Bangalore Urban" required readOnly={pincodeAutoFilled} disabled={pincodeLoading} />
              <Field label="State *" name="state" placeholder="Karnataka" required readOnly={pincodeAutoFilled} disabled={pincodeLoading} />
              <Field label="Pincode *" name="pincode" placeholder="560001" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} onChange={(event) => void handlePincodeChange(event.currentTarget.value)} action={pincodeLoading ? <span className="flex w-12 shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-300"><Loader2 size={18} className="animate-spin" /></span> : undefined} />
            </FormSection>

            <FormSection title="Food Donation Details">
              <div className="md:col-span-2">
                <p className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Food Type</p>
                <input type="hidden" name="foodType" value={foodType} />
                <div className="grid gap-3 sm:grid-cols-3">
                  {(['Veg', 'Non-Veg', 'Both'] as const).map((value) => (
                    <ChoicePill key={value} label={value} active={foodType === value} onClick={() => setFoodType(value)} />
                  ))}
                </div>
              </div>
              <Field label="Average Daily Surplus Food (Meals)" name="averageDailySurplus" placeholder="80" type="number" min="1" />
              <div>
                <p className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">Pickup Availability</p>
                <input type="hidden" name="pickupAvailability" value={pickupAvailability} />
                <div className="grid gap-3">
                  {(['NGO Pickup', 'Self Delivery'] as const).map((value) => (
                    <ChoicePill key={value} label={value} active={pickupAvailability === value} onClick={() => setPickupAvailability(value)} />
                  ))}
                </div>
              </div>
            </FormSection>

            <FormSection title="Verification Documents">
              <DocumentCard title="Upload FSSAI Certificate" copy="PDF, JPG or PNG up to 2 MB." name="fssaiCertificate" />
              <DocumentCard title="Upload Business License" copy="PDF, JPG or PNG up to 2 MB." name="businessLicense" />
              <DocumentCard title="Upload Identity Proof" copy="Owner or manager identity proof, up to 2 MB." name="identityProof" required />
            </FormSection>

            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
              <p className="flex items-center gap-2 font-black">
                <CheckCircle2 size={20} />
                Your donor profile will be reviewed for safe food distribution.
              </p>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={saveDraft} className="rounded-2xl border border-slate-200 bg-white px-7 py-4 font-black text-slate-700 shadow-sm transition hover:border-slate-300 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
                Save Draft
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-8 py-4 font-black text-emerald-950 shadow-lg shadow-emerald-400/25 transition hover:bg-emerald-300"
              >
                <Truck size={20} />
                {isSubmitting ? 'Registering...' : 'Register as Donor'}
              </button>
            </div>
            {status && <p aria-live="polite" className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">{status}</p>}
          </form>
        </div>
      </div>
    </section>
  )
}
