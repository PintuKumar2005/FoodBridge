import { useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, ChevronLeft, LocateFixed, Loader2, ShieldCheck } from 'lucide-react'
import { registerReceiver, type AuthUser, type StoredDocument } from '../api'
import { Field, FormSection, SelectField, UploadBox } from '../components/RegistrationFields'
import { getCurrentCoordinates, getCurrentLocationAddress, type LocationDraft } from '../location'

interface ReceiverRegistrationPageProps {
  onBack: () => void
  onSubmit: (user: AuthUser, tokens?: { accessToken?: string; refreshToken?: string }) => void
}

export default function ReceiverRegistrationPage({ onBack, onSubmit }: ReceiverRegistrationPageProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const lastPincodeRef = useRef('')
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [pincodeAutoFilled, setPincodeAutoFilled] = useState(false)
  const [locationState, setLocationState] = useState<{ address: string; latitude?: number; longitude?: number }>({ address: '' })

  const getRegistrationCoordinates = async () => {
    if (locationState.latitude !== undefined && locationState.longitude !== undefined) {
      return { latitude: locationState.latitude, longitude: locationState.longitude }
    }
    setStatus('Allow location permission so nearby donations can be matched to your organization.')
    return getCurrentCoordinates()
  }

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
      const payload: Record<string, unknown> = Object.fromEntries(formData)
      const coordinates = await getRegistrationCoordinates()
      payload.address = locationState.address
      payload.latitude = String(coordinates.latitude)
      payload.longitude = String(coordinates.longitude)
      payload.documents = {
        registrationCertificate: await getDocument(formData, 'registrationCertificate'),
        organizationIdProof: await getDocument(formData, 'organizationIdProof'),
      }
      const response = await registerReceiver(payload)
      onSubmit(response.user, response)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to register receiver')
    } finally {
      setIsSubmitting(false)
    }
  }

  const applyLocation = (location: LocationDraft, options: { preservePincode?: boolean } = {}) => {
    if (!formRef.current) return

    const setField = (name: string, value?: string) => {
      const control = formRef.current?.elements.namedItem(name)
      if (control instanceof HTMLInputElement && value) control.value = value
    }

    setField('address', location.address)
    setLocationState({
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
    })
    setField('city', location.city)
    setField('state', location.state)
    const pincodeControl = formRef.current.elements.namedItem('pincode')
    const existingPincode = pincodeControl instanceof HTMLInputElement ? pincodeControl.value.replace(/\D/g, '') : ''
    if (!options.preservePincode || existingPincode.length !== 6) {
      setField('pincode', location.pincode)
    }
  }

  const handleUseCurrentLocation = async () => {
    setStatus('')
    setLocationLoading(true)
    try {
      const location = await getCurrentLocationAddress()
      applyLocation(location)
      setPincodeAutoFilled(Boolean(location.city || location.state))
      setStatus('Current location added. Review the address before submitting.')
    } catch (error) {
      setStatus(typeof error === 'object' && error !== null && 'code' in error && error.code === 1
        ? 'Location permission was denied. Please allow location access or enter your address manually.'
        : error instanceof Error ? error.message : 'Could not detect your current location.')
    } finally {
      setLocationLoading(false)
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
              <ShieldCheck size={17} />
              Verified NGO onboarding
            </span>
            <h1 className="premium-display mt-6 text-5xl font-normal leading-tight tracking-tight md:text-6xl">Register as a Food Receiver</h1>
            <p className="mt-5 text-lg leading-8">
              Join our network of orphanages, old age homes, and NGOs to receive food donations from restaurants and hotels.
            </p>
            <div className="mt-8 grid gap-3">
              {['Verified organizations only', 'Donation alerts', 'Safe food handoff support'].map((item) => (
                <p key={item} className="flex items-center gap-3 rounded-2xl bg-white/35 px-4 py-3 font-semibold ring-1 ring-white/50 backdrop-blur dark:bg-white/10 dark:ring-white/10">
                  <CheckCircle2 size={20} />
                  {item}
                </p>
              ))}
            </div>
          </aside>

          <form ref={formRef} onSubmit={handleSubmit} className="registration-form rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-xl shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-slate-900/90 md:p-8">
            <FormSection title="Organization Details">
              <Field label="Organization Name" name="organizationName" placeholder="Hope Care Foundation" required />
              <SelectField label="Organization Type" name="organizationType" options={['Orphanage', 'Old Age Home', 'NGO']} required />
              <Field label="Registration Number" name="registrationNumber" placeholder="NGO/KA/2024/1024" />
            </FormSection>

            <FormSection title="Contact Details">
              <Field label="Contact Person Name" name="contactName" placeholder="Enter full name" required />
              <Field label="Phone Number" name="phone" placeholder="+91 98765 43210" required />
              <Field label="Email Address" name="email" placeholder="receiver@example.org" required type="email" />
            </FormSection>

            <FormSection title="Address">
              <Field
                label="Full Address"
                name="address"
                placeholder="Street, landmark, area"
                required
                wide
                value={locationState.address}
                onChange={(event) => setLocationState((current) => ({ ...current, address: event.currentTarget.value }))}
                action={(
                  <button type="button" onClick={handleUseCurrentLocation} disabled={locationLoading} aria-label="Use current location" className="flex w-12 shrink-0 items-center justify-center text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-60 dark:text-emerald-300 dark:hover:bg-emerald-400/10">
                    {locationLoading ? <Loader2 size={18} className="animate-spin" /> : <LocateFixed size={18} />}
                  </button>
                )}
              />
              <input type="hidden" name="latitude" value={locationState.latitude ?? ''} />
              <input type="hidden" name="longitude" value={locationState.longitude ?? ''} />
              <Field label="District" name="city" placeholder="Bangalore Urban" required readOnly={pincodeAutoFilled} disabled={pincodeLoading} />
              <Field label="State" name="state" placeholder="Karnataka" required readOnly={pincodeAutoFilled} disabled={pincodeLoading} />
              <Field label="Pincode" name="pincode" placeholder="560001" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} onChange={(event) => void handlePincodeChange(event.currentTarget.value)} action={pincodeLoading ? <span className="flex w-12 shrink-0 items-center justify-center text-emerald-600 dark:text-emerald-300"><Loader2 size={18} className="animate-spin" /></span> : undefined} />
            </FormSection>

            <FormSection title="Food Requirements">
              <Field label="Number of Residents" name="numberOfResidents" placeholder="120" />
              <SelectField label="Food Preference" name="foodPreference" options={['Veg', 'Non-Veg', 'Both']} />
              <SelectField label="Can Arrange Pickup?" name="canArrangePickup" options={['Yes', 'No']} />
            </FormSection>

            <FormSection title="Document Upload">
              <UploadBox title="Registration Certificate" name="registrationCertificate" />
              <UploadBox title="Organization ID Proof" name="organizationIdProof" />
            </FormSection>

            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
              <p className="flex items-center gap-2 font-black">
                <CheckCircle2 size={20} />
                Only verified organizations can receive food donations.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full rounded-2xl bg-emerald-400 px-6 py-4 text-base font-black text-emerald-950 shadow-lg shadow-emerald-400/25 transition hover:bg-emerald-300"
            >
              {isSubmitting ? 'Registering...' : 'Register & Verify'}
            </button>
            {status && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{status}</p>}
          </form>
        </div>
      </div>
    </section>
  )
}
