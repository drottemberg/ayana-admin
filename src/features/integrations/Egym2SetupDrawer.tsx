import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInput } from '@/components/ui/select-input'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import type { Location } from '@/types/location'
import {
  getEgym2GymsRequest,
  getIntegrationSetupRequest,
  previewIntegrationSyncRequest,
  saveEgym2VenueMappingsRequest,
  startIntegrationSyncRequest,
  type CustomerIntegration,
  type ExternalVenue,
  type IntegrationSetup,
  type SyncPreview,
} from './api'

type MappingRow = { locationId: string; externalVenueId: string; network: string }

export function Egym2SetupDrawer({
  customerId, integration, open, startAtPreview = false, fullHistory = false, onOpenChange, onSaved,
}: {
  customerId: string
  integration: CustomerIntegration | null
  open: boolean
  startAtPreview?: boolean
  fullHistory?: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [locations, setLocations] = useState<Location[]>([])
  const [gyms, setGyms] = useState<ExternalVenue[]>([])
  const [rows, setRows] = useState<MappingRow[]>([])
  const [setup, setSetup] = useState<IntegrationSetup | null>(null)
  const [preview, setPreview] = useState<SyncPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !integration) return
    let active = true
    setLoading(true)
    setPreview(null)
    Promise.all([
      getIntegrationSetupRequest(customerId, integration.id),
      getAllLocationsForCustomerRequest(customerId),
      getEgym2GymsRequest(customerId, integration.id),
    ]).then(async ([currentSetup, allLocations, availableGyms]) => {
      if (!active) return
      setSetup(currentSetup)
      setLocations(allLocations)
      setGyms(availableGyms)
      setRows(currentSetup.venueMappings.map((mapping) => ({
        locationId: mapping.locationId,
        externalVenueId: mapping.externalVenueId,
        network: mapping.metadata?.network || availableGyms.find((gym) => gym.id === mapping.externalVenueId)?.network || 'FR_BE',
      })))
      if (startAtPreview && currentSetup.setupCompletedAt) {
        const syncPreview = await previewIntegrationSyncRequest(customerId, integration.id, fullHistory)
        if (active) setPreview(syncPreview)
      }
    }).catch((error) => {
      if (active) toast.error(error instanceof Error ? error.message : 'Could not load EGYM setup.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [customerId, fullHistory, integration?.id, open, startAtPreview])

  const updateRow = (index: number, patch: Partial<MappingRow>) => setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row))
  const addRow = () => setRows((current) => [...current, { locationId: '', externalVenueId: '', network: 'FR_BE' }])
  const saveAndPreview = async () => {
    if (!integration) return
    const valid = rows.filter((row) => row.locationId && row.externalVenueId)
    if (!valid.length) { toast.error('Map at least one Ayana location to an EGYM gym.'); return }
    setSaving(true)
    try {
      const saved = await saveEgym2VenueMappingsRequest(customerId, integration.id, valid)
      setSetup(saved)
      const result = await previewIntegrationSyncRequest(customerId, integration.id, fullHistory)
      setPreview(result)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not prepare EGYM sync.') }
    finally { setSaving(false) }
  }
  const startSync = async () => {
    if (!integration || !preview?.previewId) return
    setSaving(true)
    try {
      const result = await startIntegrationSyncRequest(customerId, integration.id, preview.previewId)
      setPreview(result)
      toast.success(`Sync complete: ${result.counts.created} created, ${result.counts.updated} updated, ${result.counts.cancelled} cancelled.`)
      onSaved()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'EGYM sync failed.') }
    finally { setSaving(false) }
  }

  return <AppDrawer open={open} onOpenChange={onOpenChange} title="Set up EGYM Wellpass portal" description="Connect each Ayana location to its EGYM gym, then review the bookings to import." contentClassName="sm:max-w-3xl">
    {({ containerRef }) => <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {loading ? <p className="text-sm text-muted-foreground">Loading EGYM gyms and current mappings…</p> : null}
        {!preview ? <>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Location and gym mappings</h3>
            <p className="text-sm text-muted-foreground">Choose the EGYM gym for each Ayana location. The API network is required for bookings.</p>
          </div>
          {rows.map((row, index) => <div key={`${row.locationId}-${index}`} className="space-y-3 rounded-lg border p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <SelectInput label="Ayana location" value={row.locationId} onValueChange={(value) => updateRow(index, { locationId: String(value) })} items={locations.map((location) => ({ value: location.id, label: location.name }))} container={containerRef} />
              <SelectInput label="EGYM gym" value={row.externalVenueId} onValueChange={(value) => {
                const gym = gyms.find((candidate) => candidate.id === String(value))
                updateRow(index, { externalVenueId: String(value), network: gym?.network ?? row.network })
              }} items={gyms.map((gym) => ({ value: gym.id, label: `${gym.name} · ${gym.id}` }))} container={containerRef} />
              <label className="grid gap-1.5 text-sm font-medium">Network (optional)<Input value={row.network} onChange={(event) => updateRow(index, { network: event.target.value })} placeholder="FR_BE" /></label>
            </div>
            <div className="flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>Remove mapping</Button></div>
          </div>)}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={addRow}>Add location</Button>
            <Button type="button" onClick={() => void saveAndPreview()} disabled={saving || loading}>{saving ? 'Saving and loading bookings…' : 'Save mappings and preview bookings'}</Button>
          </div>
        </> : <>
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">{preview.applied ? 'Sync complete' : 'Review booking sync'}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{preview.counts.created} new · {preview.counts.updated} updates · {preview.counts.cancelled} cancelled · {preview.counts.skipped} skipped · {preview.counts.usersCreated} users to create</p>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border">
            <div className="grid grid-cols-[100px_1fr_1fr_1fr] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-semibold"><span>Action</span><span>Member</span><span>Location / class</span><span>Starts</span></div>
            {preview.changes.map((change) => <div key={`${change.reservationId}-${change.action}`} className="grid grid-cols-[100px_1fr_1fr_1fr] gap-2 border-b px-3 py-2 text-xs last:border-0"><span>{change.action}</span><span>{change.name}</span><span>{change.location} · {change.className}</span><span>{new Date(change.date).toLocaleString()}</span></div>)}
          </div>
          {preview.skippedDetails.length ? <div className="space-y-2"><h4 className="text-sm font-semibold">Skipped</h4><ul className="space-y-1 text-xs text-muted-foreground">{preview.skippedDetails.map((item, index) => <li key={`${item.scheduleId}-${index}`}>{item.scheduleId}: {item.reason}</li>)}</ul></div> : null}
        </>}
        {setup?.setupCompletedAt ? <p className="text-xs text-muted-foreground">Mappings saved. EGYM bookings sync automatically every minute.</p> : null}
      </div>
      <div className="flex justify-end gap-2 border-t p-5">
        <Button type="button" variant="outline" onClick={() => { if (preview && !preview.applied) setPreview(null); else onOpenChange(false) }}>{preview && !preview.applied ? 'Back to mappings' : 'Close'}</Button>
        {preview && !preview.applied ? <Button type="button" disabled={saving || !preview.previewId} onClick={() => void startSync()}>{saving ? 'Syncing…' : 'Start syncing'}</Button> : null}
      </div>
    </div>}
  </AppDrawer>
}
