import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getKitchenCatalogRequest, replaceKitchenCartRequest, type KitchenCatalog, type KitchenOrderDetail } from '../api'
import './KitchenCartEditor.css'

type DraftLine = { key: string; variantId: string; quantity: number; modifierIds: string[]; notes: string }
type CatalogProduct = KitchenCatalog['products'][number]

function money(value: number, currency: string, language: 'fr' | 'en') {
  return new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-GB', { style: 'currency', currency }).format(value)
}

export function KitchenCartEditor({ details, locationId, language, onClose, onSaved }: {
  details: KitchenOrderDetail
  locationId: string
  language: 'fr' | 'en'
  onClose: () => void
  onSaved: () => void
}) {
  const tr = (fr: string, en: string) => language === 'fr' ? fr : en
  const [firstName, setFirstName] = useState(details.order.guestName ?? details.order.customer?.firstName ?? '')
  const [lines, setLines] = useState<DraftLine[]>(() => details.items.map((item) => ({
    key: item.id,
    variantId: item.variantId,
    quantity: item.quantity,
    modifierIds: item.modifiers.map((modifier) => modifier.modifierId),
    notes: item.notes ?? '',
  })))
  const [addProductId, setAddProductId] = useState('')
  const [revision, setRevision] = useState(details.order.updatedAt)
  const orderChanged = details.order.updatedAt !== revision
  const catalog = useQuery({
    queryKey: ['orders', 'kitchen-catalog', locationId],
    queryFn: () => getKitchenCatalogRequest(locationId),
    enabled: Boolean(locationId),
  })
  const products = catalog.data?.products ?? []
  const productFor = (line: DraftLine): CatalogProduct | undefined => products.find((product) => product.variants.some((variant) => variant.id === line.variantId))
  const updateLine = (key: string, change: Partial<DraftLine>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...change } : line))

  const validation = useMemo(() => {
    if (!firstName.trim()) return tr('Renseignez le prénom du client.', 'Enter the customer first name.')
    if (!lines.length) return tr('Le panier doit contenir au moins un article. Pour le vider, annulez la commande.', 'The cart needs at least one item. Cancel the order to empty it.')
    const quantities = new Map<string, number>()
    for (const line of lines) {
      const product = products.find((candidate) => candidate.variants.some((variant) => variant.id === line.variantId))
      const variant = product?.variants.find((candidate) => candidate.id === line.variantId)
      if (!product || !variant?.available) return tr('Un article du panier n’est plus disponible.', 'An item in this cart is no longer available.')
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100) return tr('Vérifiez les quantités.', 'Check the quantities.')
      const combinedQuantity = (quantities.get(line.variantId) ?? 0) + line.quantity
      quantities.set(line.variantId, combinedQuantity)
      if (variant.stock !== -1 && combinedQuantity > variant.stock) return tr('Stock insuffisant pour cette quantité.', 'Insufficient stock for this quantity.')
      for (const group of product.modifierGroups) {
        const count = group.options.filter((option) => line.modifierIds.includes(option.id)).length
        if (count < Math.max(group.minSelect, group.required ? 1 : 0) || count > group.maxSelect) {
          return `${product.name} · ${group.name}: ${tr('choisissez les options requises', 'choose the required options')}.`
        }
      }
    }
    return ''
  }, [firstName, lines, products, language])

  const total = lines.reduce((sum, line) => {
    const product = productFor(line)
    const variant = product?.variants.find((item) => item.id === line.variantId)
    const options = product?.modifierGroups.flatMap((group) => group.options) ?? []
    const optionTotal = options.filter((option) => line.modifierIds.includes(option.id)).reduce((amount, option) => amount + option.price, 0)
    return sum + (Number(variant?.originalPrice ?? variant?.price ?? 0) + optionTotal) * line.quantity
  }, 0)

  const save = useMutation({
    mutationFn: () => replaceKitchenCartRequest(details.order.id, {
      locationId,
      expectedUpdatedAt: revision,
      guestName: firstName.trim(),
      items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity, modifierIds: line.modifierIds, notes: line.notes.trim() || undefined })),
    }),
    onSuccess: (updated) => {
      setRevision(updated.order.updatedAt)
      toast.success(tr('Commande mise à jour. Elle reste à encaisser.', 'Order updated. Payment is still due.'))
      onSaved()
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : tr('Impossible de modifier la commande.', 'Could not update the order.')),
  })

  const addProduct = () => {
    const product = products.find((item) => item.id === addProductId)
    const variant = product?.variants.find((item) => item.available)
    if (!variant) return
    setLines((current) => [...current, { key: crypto.randomUUID(), variantId: variant.id, quantity: 1, modifierIds: [], notes: '' }])
    setAddProductId('')
  }

  return (
    <div className="kitchen-cart-editor">
      <p className="kitchen-cart-editor-hint">{tr('Corrigez le panier avant l’encaissement. Le paiement ne démarre pas en enregistrant.', 'Correct the cart before payment. Saving does not start a payment.')}</p>
      {details.order.customer
        ? <p className="kitchen-cart-editor-hint">{tr('Client', 'Customer')}: <strong>{firstName}</strong></p>
        : <label className="kitchen-cart-editor-name">{tr('Prénom du client', 'Customer first name')}
            <input autoComplete="off" value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={80} />
          </label>}
      {catalog.isLoading && <p>{tr('Chargement de la carte…', 'Loading menu…')}</p>}
      {catalog.isError && <p role="alert">{tr('Impossible de charger la carte.', 'Could not load the menu.')}</p>}

      {catalog.data && lines.map((line, index) => {
        const product = productFor(line)
        const variant = product?.variants.find((item) => item.id === line.variantId)
        return (
          <section className="kitchen-cart-editor-item" key={line.key}>
            <div className="kitchen-cart-editor-item-head">
              <strong>{index + 1}. {product?.name ?? details.items.find((item) => item.id === line.key)?.productName ?? tr('Article indisponible', 'Unavailable item')}</strong>
              <button type="button" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>{tr('Retirer', 'Remove')}</button>
            </div>
            {product && <label>{tr('Format', 'Variant')}
              <select value={line.variantId} onChange={(event) => updateLine(line.key, { variantId: event.target.value })}>
                {product.variants.map((choice) => <option key={choice.id} value={choice.id} disabled={!choice.available}>{choice.label} · {money(Number(choice.originalPrice ?? choice.price), catalog.data.currency, language)}</option>)}
              </select>
            </label>}
            <div className="kitchen-cart-editor-quantity">
              <span>{tr('Quantité', 'Quantity')}</span>
              <button type="button" disabled={line.quantity <= 1} onClick={() => updateLine(line.key, { quantity: line.quantity - 1 })}>−</button>
              <strong>{line.quantity}</strong>
              <button type="button" disabled={line.quantity >= 100 || (variant?.stock !== -1 && line.quantity >= (variant?.stock ?? 0))} onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })}>+</button>
            </div>
            {product?.modifierGroups.map((group) => <fieldset key={group.id}>
              <legend>{group.name}{(group.required || group.minSelect > 0) ? ' *' : ''}</legend>
              <div className="kitchen-cart-editor-options">
                {group.options.map((option) => {
                  const checked = line.modifierIds.includes(option.id)
                  return <label key={option.id} className={checked ? 'is-selected' : ''}>
                    <input type="checkbox" checked={checked} onChange={() => {
                      const groupIds = new Set(group.options.map((item) => item.id))
                      const other = line.modifierIds.filter((id) => !groupIds.has(id))
                      const current = line.modifierIds.filter((id) => groupIds.has(id))
                      const next = checked ? current.filter((id) => id !== option.id)
                        : group.maxSelect === 1 ? [option.id]
                          : current.length < group.maxSelect ? [...current, option.id] : current
                      updateLine(line.key, { modifierIds: [...other, ...next] })
                    }} />
                    {option.name}{option.price ? ` · +${money(option.price, catalog.data.currency, language)}` : ''}
                  </label>
                })}
              </div>
            </fieldset>)}
            <label>{tr('Note pour la préparation', 'Preparation note')}
              <textarea value={line.notes} maxLength={500} onChange={(event) => updateLine(line.key, { notes: event.target.value })} />
            </label>
          </section>
        )
      })}

      {catalog.data && <div className="kitchen-cart-editor-add">
        <select aria-label={tr('Ajouter un produit', 'Add a product')} value={addProductId} onChange={(event) => setAddProductId(event.target.value)}>
          <option value="">{tr('Choisir un produit…', 'Choose a product…')}</option>
          {products.filter((product) => product.variants.some((variant) => variant.available)).map((product) => <option key={product.id} value={product.id}>{product.category} · {product.name}</option>)}
        </select>
        <button type="button" disabled={!addProductId} onClick={addProduct}>+ {tr('Ajouter', 'Add')}</button>
      </div>}
      <div className="kitchen-cart-editor-total"><span>{tr('Nouveau total estimé', 'Estimated new total')}</span><strong>{money(total, details.order.currency, language)}</strong></div>
      {orderChanged && <p className="kitchen-cart-editor-error" role="alert">{tr('La commande a changé. Revenez au détail puis rouvrez le panier.', 'The order changed. Return to the details and reopen the cart.')}</p>}
      {catalog.data && validation && <p className="kitchen-cart-editor-error" role="alert">{validation}</p>}
      <div className="kitchen-cart-editor-actions">
        <button type="button" onClick={onClose}>{tr('Retour', 'Back')}</button>
        <button type="button" className="is-primary" disabled={!catalog.data || Boolean(validation) || orderChanged || save.isPending} onClick={() => save.mutate()}>{save.isPending ? tr('Enregistrement…', 'Saving…') : tr('Enregistrer le panier', 'Save cart')}</button>
      </div>
    </div>
  )
}
