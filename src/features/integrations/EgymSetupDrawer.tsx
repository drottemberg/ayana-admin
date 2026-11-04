import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AppDrawer } from '@/components/app/AppDrawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectInput } from '@/components/ui/select-input'
import { getIntegrationSetupRequest, saveEgymLocationMappingsRequest, type CustomerIntegration, type IntegrationSetup } from './api'

type LocationRow = { locationId: string; clubId: string; referencePrice: string; allowedClassTypeIds: string[] }

export function EgymSetupDrawer({
  customerId, integration, open, onOpenChange, onSaved,
}: {
  customerId: string
  integration: CustomerIntegration | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [setup, setSetup] = useState<IntegrationSetup | null>(null)
  const [rows, setRows] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !integration) return
    let active = true
    setLoading(true)
    getIntegrationSetupRequest(customerId, integration.id).then((result) => {
      if (!active) return
      setSetup(result)
      setRows(result.venueMappings.map((mapping) => ({
        locationId: mapping.locationId,
        clubId: mapping.externalVenueId,
        referencePrice: mapping.metadata?.referencePrice == null ? '' : String(mapping.metadata.referencePrice),
        allowedClassTypeIds: mapping.metadata?.allowedClassTypeIds ?? [],
      })))
    }).catch((error) => {
      if (active) toast.error(error instanceof Error ? error.message : 'Could not load EGYM setup.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [customerId, integration?.id, open])

  const updateRow = (index: number, patch: Partial<LocationRow>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  const save = async () => {
    if (!integration) return
    if (rows.some((row) => !row.locationId || !row.clubId.trim() || !(Number(row.referencePrice) > 0) || !row.allowedClassTypeIds.length)) {
      toast.error('For each location, enter its EGYM club ID and reference price, then choose at least one class.')
      return
    }
    setSaving(true)
    try {
      setSetup(await saveEgymLocationMappingsRequest(customerId, integration.id, rows.map((row) => ({
        ...row,
        referencePrice: Number(row.referencePrice),
      }))))
      toast.success('EGYM setup saved.')
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save EGYM setup.')
    } finally { setSaving(false) }
  }

  return <AppDrawer open={open} onOpenChange={onOpenChange} title="Set up EGYM Wellpass" description="Connect each Ayana location to its EGYM club, set the reference price sent to EGYM, and select the classes that accept Wellpass bookings." contentClassName="sm:max-w-3xl">
    {({ containerRef }) => <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {loading ? <p className="text-sm text-muted-foreground">Loading EGYM setup…</p> : null}
        {!loading && setup ? rows.map((row, index) => {
          const location = setup.locations?.find((item) => item.id === row.locationId)
          const usedLocations = new Set(rows.filter((_, rowIndex) => rowIndex !== index).map((item) => item.locationId))
          return <section key={`${row.locationId || 'new'}-${index}`} className="space-y-4 rounded-lg border border-border p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
              <SelectInput label="Ayana location" value={row.locationId} onValueChange={(value) => updateRow(index, { locationId: String(value), allowedClassTypeIds: [] })} items={(setup.locations ?? []).filter((item) => item.id === row.locationId || !usedLocations.has(item.id)).map((item) => ({ value: item.id, label: item.name }))} placeholder="Select a location" searchable container={containerRef} />
              <label className="grid gap-1.5 text-sm font-medium">EGYM club ID<Input value={row.clubId} onChange={(event) => updateRow(index, { clubId: event.target.value })} placeholder="Club ID" /></label>
              <label className="grid gap-1.5 text-sm font-medium">Reference price<Input type="number" min="0.01" step="0.01" value={row.referencePrice} onChange={(event) => updateRow(index, { referencePrice: event.target.value })} placeholder="35.00" /></label>
              <Button type="button" variant="outline" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>
            </div>
            {location ? <div className="space-y-2 border-t border-border pt-3">
              <h3 className="text-sm font-semibold">Classes available with EGYM</h3>
              {location.classes.length ? location.classes.map((classType) => {
                const checked = row.allowedClassTypeIds.includes(classType.id)
                return <label key={classType.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                  <input type="checkbox" checked={checked} onChange={() => updateRow(index, { allowedClassTypeIds: checked ? row.allowedClassTypeIds.filter((id) => id !== classType.id) : [...row.allowedClassTypeIds, classType.id] })} />
                  <span className="flex-1">{classType.name}</span>
                </label>
              }) : <p className="text-sm text-muted-foreground">No active classes are available for this location.</p>}
            </div> : null}
          </section>
        }) : null}
        {!loading && !(setup?.locations?.length) ? <p className="text-sm text-muted-foreground">No locations are available for this customer.</p> : null}
        {!loading && setup?.locations?.length ? <Button type="button" variant="outline" disabled={rows.length >= setup.locations.length} onClick={() => setRows((current) => [...current, { locationId: '', clubId: '', referencePrice: '', allowedClassTypeIds: [] }])}>Add location</Button> : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button type="button" disabled={loading || saving || !rows.length} onClick={() => void save()}>{saving ? 'Saving…' : 'Save setup'}</Button>
      </div>
    </div>}
  </AppDrawer>
}
