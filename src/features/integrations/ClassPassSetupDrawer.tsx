import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { SelectInput } from '@/components/ui/select-input'
import { getAllLocationsForCustomerRequest } from '@/features/locations/api'
import { getClassTypesRequest } from '@/features/classes/api'
import type { ClassType } from '@/types/class-type'
import type { Location } from '@/types/location'
import {
  getClassPassClassesRequest,
  getClassPassVenuesRequest,
  getIntegrationSetupRequest,
  previewIntegrationSyncRequest,
  saveIntegrationClassesRequest,
  saveIntegrationVenuesRequest,
  startIntegrationSyncRequest,
  type CustomerIntegration,
  type ExternalClass,
  type ExternalVenue,
  type IntegrationSetup,
  type SyncPreview,
} from './api'

type VenueRow = { locationId: string; externalVenueId: string }
type ClassOptionSet = { external: ExternalClass[]; internal: ClassType[] }

async function getActiveClassTypes(locationId: string) {
  const pageSize = 100
  const allItems: ClassType[] = []
  let pageIndex = 0
  let pageCount = 1
  while (pageIndex < pageCount) {
    const result = await getClassTypesRequest(
      { pagination: { pageIndex, pageSize }, sorting: [], search: '', filters: {} },
      { locationId },
    )
    allItems.push(...result.items)
    pageCount = result.pageCount
    pageIndex += 1
  }
  return allItems.filter((item) => item.isActive)
}

export function ClassPassSetupDrawer({
  customerId,
  integration,
  open,
  startAtPreview = false,
  fullHistory = false,
  onOpenChange,
  onSaved,
}: {
  customerId: string
  integration: CustomerIntegration | null
  open: boolean
  startAtPreview?: boolean
  fullHistory?: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [stage, setStage] = useState<1 | 2 | 3>(1)
  const [locations, setLocations] = useState<Location[]>([])
  const [venues, setVenues] = useState<ExternalVenue[]>([])
  const [setup, setSetup] = useState<IntegrationSetup | null>(null)
  const [venueRows, setVenueRows] = useState<VenueRow[]>([])
  const [classOptions, setClassOptions] = useState<Record<string, ClassOptionSet>>({})
  const [classSelections, setClassSelections] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<SyncPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const title = useMemo(() => stage === 1 ? 'Map locations to ClassPass venues' : stage === 2 ? 'Map ClassPass classes' : 'Review ClassPass sync', [stage])

  useEffect(() => {
    if (!open || !integration) return
    let active = true
    setStage(1)
    setPreview(null)
    setLoading(true)
    Promise.all([
      getIntegrationSetupRequest(customerId, integration.id),
      getAllLocationsForCustomerRequest(customerId),
      getClassPassVenuesRequest(customerId, integration.id),
    ]).then(async ([currentSetup, allLocations, classPassVenues]) => {
      if (!active) return
      setSetup(currentSetup)
      setLocations(allLocations)
      setVenues(classPassVenues)
      setVenueRows(currentSetup.venueMappings.map((mapping) => ({ locationId: mapping.locationId, externalVenueId: mapping.externalVenueId })))
      const selections: Record<string, string> = {}
      currentSetup.venueMappings.forEach((mapping) => mapping.classMappings.forEach((item) => {
        selections[`${mapping.id}:${item.classTypeId}`] = item.externalClassId
      }))
      setClassSelections(selections)
      const optionEntries = await Promise.all(currentSetup.venueMappings.map(async (mapping) => {
        const [external, result] = await Promise.all([
          getClassPassClassesRequest(customerId, integration.id, mapping.id),
          getActiveClassTypes(mapping.locationId),
        ])
        return [mapping.id, { external, internal: result }] as const
      }))
      if (active) {
        setClassOptions(Object.fromEntries(optionEntries))
        if (startAtPreview && currentSetup.setupCompletedAt) {
          const syncPreview = await previewIntegrationSyncRequest(customerId, integration.id, fullHistory)
          if (active) { setPreview(syncPreview); setStage(3) }
        }
      }
    }).catch((error) => {
      if (active) toast.error(error instanceof Error ? error.message : 'Could not load ClassPass setup.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [customerId, fullHistory, integration?.id, open, startAtPreview])

  const addVenueRow = () => setVenueRows((rows) => [...rows, { locationId: '', externalVenueId: '' }])
  const updateVenueRow = (index: number, key: keyof VenueRow, value: string) => {
    setVenueRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row))
  }

  const saveVenues = async () => {
    if (!integration) return
    const validRows = venueRows.filter((row) => row.locationId && row.externalVenueId)
    if (!validRows.length) {
      toast.error('Map at least one location to a ClassPass venue.')
      return
    }
    setSaving(true)
    try {
      const saved = await saveIntegrationVenuesRequest(customerId, integration.id, validRows)
      setSetup(saved)
      const selectionState: Record<string, string> = {}
      const optionEntries = await Promise.all(saved.venueMappings.map(async (mapping) => {
        const [external, internal] = await Promise.all([
          getClassPassClassesRequest(customerId, integration.id, mapping.id),
          getActiveClassTypes(mapping.locationId),
        ])
        mapping.classMappings.forEach((item) => { selectionState[`${mapping.id}:${item.classTypeId}`] = item.externalClassId })
        return [mapping.id, { external, internal }] as const
      }))
      setClassOptions(Object.fromEntries(optionEntries))
      setClassSelections(selectionState)
      setStage(2)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save location mappings.')
    } finally { setSaving(false) }
  }

  const saveClassesAndPreview = async () => {
    if (!integration || !setup) return
    const classes = Object.entries(classSelections).flatMap(([key, externalClassId]) => {
      if (!externalClassId) return []
      const separator = key.indexOf(':')
      const venueMappingId = key.slice(0, separator)
      const classTypeId = key.slice(separator + 1)
      const options = classOptions[venueMappingId]
      if (!options || !options.internal.some((item) => item.id === classTypeId) || !options.external.some((item) => item.id === externalClassId)) return []
      return [{ venueMappingId, classTypeId, externalClassId }]
    })
    setSaving(true)
    try {
      await saveIntegrationClassesRequest(customerId, integration.id, classes)
      const [savedSetup, syncPreview] = await Promise.all([
        getIntegrationSetupRequest(customerId, integration.id),
        previewIntegrationSyncRequest(customerId, integration.id, fullHistory),
      ])
      setSetup(savedSetup)
      setPreview(syncPreview)
      setStage(3)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not preview the ClassPass sync.')
    } finally { setSaving(false) }
  }

  const startSync = async () => {
    if (!integration || !preview?.previewId) return
    setSaving(true)
    try {
      const result = await startIntegrationSyncRequest(customerId, integration.id, preview.previewId)
      setPreview(result)
      toast.success(`Sync complete: ${result.counts.created} created, ${result.counts.updated} updated, ${result.counts.cancelled} cancelled.`)
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ClassPass sync failed.')
    } finally { setSaving(false) }
  }

  const refreshPreview = async () => {
    if (!integration) return
    setSaving(true)
    try {
      setPreview(await previewIntegrationSyncRequest(customerId, integration.id, fullHistory))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not refresh the ClassPass preview.')
    } finally { setSaving(false) }
  }

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} title={title} description="Connect each studio, map its classes, then review the booking changes before syncing." contentClassName="sm:max-w-3xl">
      {({ containerRef }) => (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm">
            {[['1', 'Venues'], ['2', 'Classes'], ['3', 'Sync']].map(([number, label], index) => (
              <div key={number} className={`rounded-full px-3 py-1 ${stage === index + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{number}. {label}</div>
            ))}
          </div>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {loading ? <p className="text-sm text-muted-foreground">Loading integration setup…</p> : null}
            {stage === 1 && !loading ? (
              <>
                <p className="text-sm text-muted-foreground">Choose which ClassPass venue belongs to each Ayana location. You can connect more than one location.</p>
                {venueRows.map((row, index) => {
                  const usedLocations = new Set(venueRows.filter((_, rowIndex) => rowIndex !== index).map((item) => item.locationId))
                  const usedVenues = new Set(venueRows.filter((_, rowIndex) => rowIndex !== index).map((item) => item.externalVenueId))
                  return <div key={index} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                    <SelectInput label="Ayana location" value={row.locationId} onValueChange={(value) => updateVenueRow(index, 'locationId', String(value))} items={locations.filter((item) => !usedLocations.has(item.id)).map((item) => ({ value: item.id, label: item.name ?? item.id }))} placeholder="Select a location" searchable container={containerRef} />
                    <SelectInput label="ClassPass venue" value={row.externalVenueId} onValueChange={(value) => updateVenueRow(index, 'externalVenueId', String(value))} items={venues.filter((item) => !usedVenues.has(item.id)).map((item) => ({ value: item.id, label: `${item.name} · ${item.id}` }))} placeholder="Select a venue" searchable container={containerRef} />
                    <Button type="button" variant="outline" onClick={() => setVenueRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>
                  </div>
                })}
                <Button type="button" variant="outline" onClick={addVenueRow}>Add location</Button>
              </>
            ) : null}
            {stage === 2 && setup ? (
              <>
                <p className="text-sm text-muted-foreground">Map each ClassPass class that should create bookings in Ayana. Leave unrelated ClassPass classes set to “Do not sync”.</p>
                {setup.venueMappings.map((mapping) => {
                  const options = classOptions[mapping.id]
                  return <section key={mapping.id} className="space-y-3 rounded-lg border border-border p-4">
                    <div>
                      <h3 className="font-semibold">{mapping.location.name} ↔ {mapping.externalVenueName}</h3>
                      <p className="text-xs text-muted-foreground">{options?.internal.length ?? 0} Ayana classes · {options?.external.length ?? 0} ClassPass classes available</p>
                    </div>
                    {options?.internal.length ? <div className="grid gap-2 border-t border-border pt-3 text-xs font-medium text-muted-foreground md:grid-cols-[1fr_1fr]">
                      <span>Ayana class</span>
                      <span>ClassPass class</span>
                    </div> : null}
                    {options?.internal.map((classType) => {
                      const key = `${mapping.id}:${classType.id}`
                      const selectedExternalClassId = classSelections[key] ?? ''
                      return <div key={key} className="grid gap-2 border-t border-border pt-3 md:grid-cols-[1fr_1fr] md:items-center">
                        <div className="text-sm font-medium">{classType.name}</div>
                        <SelectInput aria-label={`ClassPass class for ${classType.name}`} value={selectedExternalClassId} onValueChange={(value) => setClassSelections((current) => ({ ...current, [key]: String(value) }))} items={[
                          { value: '', label: 'Do not sync' },
                          ...(options?.external ?? [])
                            .map((externalClass) => ({ value: externalClass.id, label: `${externalClass.name} · ${externalClass.id}` })),
                        ]} placeholder="Choose a ClassPass class" searchable container={containerRef} />
                      </div>
                    })}
                    {!options?.internal.length ? <p className="text-sm text-muted-foreground">No active Ayana classes were found for this location.</p> : null}
                    {!options?.external.length ? <p className="text-sm text-muted-foreground">No ClassPass classes were returned for this venue.</p> : null}
                  </section>
                })}
              </>
            ) : null}
            {stage === 3 && preview ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {[
                    ['Users', preview.counts.usersCreated], ['Create', preview.counts.created], ['Update', preview.counts.updated], ['Cancel', preview.counts.cancelled], ['Delete', preview.counts.deleted], ['Skip', preview.counts.skipped], ['Schedules', preview.counts.schedules],
                  ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-semibold">{value}</div></div>)}
                </div>
                <p className="text-sm text-muted-foreground">{preview.fullResync ? `Full history resync from ${preview.fromDate} through ${preview.throughDate}. Existing matching bookings will be updated.` : preview.firstSync ? 'First sync: full available reservation history.' : `Sync from ${preview.fromDate} (two days before the last sync) through ${preview.throughDate}.`} Only schedules that match an Ayana class session will be imported.</p>
                <div className="max-h-72 overflow-auto rounded-lg border border-border">
                  {preview.changes.length ? preview.changes.map((change) => <div key={`${change.reservationId}:${change.action}`} className="grid gap-1 border-b border-border px-3 py-2 text-sm last:border-b-0 md:grid-cols-[90px_1fr_1.3fr_1fr]">
                    <span className={change.action === 'CREATE' ? 'text-green-700' : change.action === 'CANCEL' ? 'text-destructive' : 'text-amber-700'}>{change.action}</span>
                    <span>{change.name}</span><span>{change.className} · {change.location}</span><span>{change.date || '—'}</span>
                  </div>) : <p className="p-4 text-sm text-muted-foreground">No booking changes were found.</p>}
                </div>
                {preview.skippedDetails.length ? <details className="rounded-lg border border-border p-3 text-sm"><summary className="cursor-pointer font-medium">Skipped schedules ({preview.skippedDetails.length}{preview.counts.skipped > preview.skippedDetails.length ? '+' : ''})</summary><ul className="mt-2 space-y-1 text-muted-foreground">{preview.skippedDetails.map((item, index) => <li key={`${item.scheduleId}:${index}`}>Schedule {item.scheduleId}: {item.reason}</li>)}</ul></details> : null}
                <p className="text-xs text-muted-foreground">{preview.note}</p>
              </>
            ) : null}
          </div>
          <div className="flex justify-between gap-2 border-t border-border p-5">
            <div>{stage > 1 ? <Button type="button" variant="outline" onClick={() => setStage((value) => value === 3 ? 2 : 1)} disabled={saving}>Back</Button> : null}</div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Close</Button>
              {stage === 1 ? <Button type="button" onClick={() => void saveVenues()} disabled={saving || loading}>{saving ? 'Saving…' : 'Save locations and continue'}</Button> : null}
              {stage === 2 ? <Button type="button" onClick={() => void saveClassesAndPreview()} disabled={saving || loading}>{saving ? 'Saving and previewing…' : 'Save setup and preview sync'}</Button> : null}
              {stage === 3 ? <>
                <Button type="button" variant="outline" onClick={() => void refreshPreview()} disabled={saving}>{saving ? 'Refreshing…' : 'Refresh preview'}</Button>
                <Button type="button" onClick={() => void startSync()} disabled={saving || !preview?.previewId}>{saving ? 'Syncing…' : 'Start syncing'}</Button>
              </> : null}
            </div>
          </div>
        </div>
      )}
    </AppDrawer>
  )
}
