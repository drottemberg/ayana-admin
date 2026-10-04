import type { DataTableCommand } from '@/components/data-table'
import type { ColumnDef } from '@tanstack/react-table'
import type { DataTableAsyncResult, DataTableState } from '@/components/data-table'
import type { DropdownActionItem } from '@/components/ui/dropdown-menu'
import type { PageHeaderProps } from '@/components/ui/page-header'
import { getDevicesRequest } from '@/features/devices/api'
import { devicesQueryKeys } from '@/features/devices/query-keys'
import {
  assignProductDeviceRequest,
  archiveProductRequest,
  deleteProductsRequest,
  setProductStatusRequest,
  unarchiveProductRequest,
} from '@/features/products/api'
import { productsQueryKeys } from '@/features/products/query-keys'
import { queryClient } from '@/lib/query-client'
import { Drawer, DrawerId } from '@/providers/drawer'
import { ModalId, Modals } from '@/providers/modal'
import type { SelectTableRow } from '@/providers/modal-types'
import type { Device } from '@/types/device'
import { ProductStatus, type Product } from '@/types/product'
import type { NavigateFunction } from 'react-router-dom'

export type ProductDetailModule = 'devices'

type ProductDetailActionEntity = 'device' | 'product'

type ProductDetailAction = DropdownActionItem & {
  entity?: ProductDetailActionEntity
}

type ProductModuleAction = {
  label: string
  onClick?: () => void
}

const moduleActionEntity: Record<ProductDetailModule, ProductDetailActionEntity> = {
  devices: 'device',
}

const entitySelectColumns: ColumnDef<SelectTableRow>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'serialNumber', header: 'Serial number' },
  { accessorKey: 'id', header: 'ID' },
]

const toSelectLoader =
  <T extends SelectTableRow>(loader: (state: DataTableState<T>) => Promise<DataTableAsyncResult<T>>) =>
  (state: DataTableState<SelectTableRow>) =>
    loader(state as DataTableState<T>) as Promise<DataTableAsyncResult<SelectTableRow>>

function toDropdownAction({ entity, ...action }: ProductDetailAction): DropdownActionItem {
  void entity
  return action
}

function getSelectedRows(selected: unknown): SelectTableRow[] {
  return Array.isArray(selected) ? selected : []
}

export class ProductService {
  static getStatus(product: Product) {
    if (product.isDeleted) return ProductStatus.DELETED
    if (product.isArchived) return ProductStatus.ARCHIVED
    return product.status ?? ProductStatus.ACTIVE
  }

  static async refreshProducts() {
    await queryClient.invalidateQueries({ queryKey: productsQueryKeys.all })
  }

  static async refreshProductDetail(productId: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productsQueryKeys.detail(productId) }),
      queryClient.invalidateQueries({ queryKey: [...devicesQueryKeys.all, 'product-module', productId] }),
      this.refreshProducts(),
    ])
  }

  static async deleteProducts(products: Product[]) {
    if (!products.length) return false

    const confirmed = await Modals.confirm({
      operation: `destroy ${products.length} product(s)`,
      okButtonProps: { variant: 'destructive' },
    })
    if (!confirmed) return false

    await deleteProductsRequest(products.map((product) => product.id))
    await this.refreshProducts()
    return true
  }

  static async setArchived(product: Product, isArchived: boolean) {
    if (isArchived) {
      await archiveProductRequest(product.id)
    } else {
      await unarchiveProductRequest(product.id)
    }
    await this.refreshProducts()
  }

  static async setEnabled(product: Product, enabled: boolean) {
    await setProductStatusRequest(product.id, enabled ? ProductStatus.ACTIVE : ProductStatus.DISABLED)
    await this.refreshProducts()
  }

  static async assignDevice(product: Product) {
    const selected = await Modals.show(ModalId.SelectTableData, {
      title: 'Assign device',
      queryKey: [...devicesQueryKeys.all, 'select-for-product', product.id],
      loadData: toSelectLoader<Device>((state) => getDevicesRequest(state, { customerId: product.customer.id })),
      columns: entitySelectColumns,
      searchPlaceholder: 'Search by ID, name, serial...',
      searchColumns: ['id', 'name', 'serialNumber'],
      selectionMode: 'single',
      tableKey: 'products.assign-device',
      loadingMessage: 'Loading devices...',
      emptyMessage: 'No devices found.',
      submitLabel: 'Assign',
    })
    const deviceId = getSelectedRows(selected).find((device) => typeof device.id === 'string')?.id
    if (typeof deviceId !== 'string') return

    await assignProductDeviceRequest(product.id, deviceId)
    await this.refreshProductDetail(product.id)
  }

  static getTableActions(products: Product[]): DataTableCommand<Product>[] {
    return [
      {
        label: 'Destroy',
        disabled: !products.length,
        variant: 'destructive',
        onClick: (selectedProducts) => void this.deleteProducts(selectedProducts),
      },
    ]
  }

  static getActions(product: Product): DropdownActionItem[] {
    if (product.isDeleted) return []

    return [
      {
        label: 'Edit',
        onClick: () => Drawer.show(DrawerId.CreateProduct, { product }),
      },
      {
        label: product.isArchived ? 'Unarchive' : 'Archive',
        onClick: () => void this.setArchived(product, !product.isArchived),
      },
      {
        label: 'Destroy',
        variant: 'destructive',
        onClick: () => void this.deleteProducts([product]),
      },
      {
        label: product.status === ProductStatus.DISABLED ? 'Enable' : 'Disable',
        onClick: () => void this.setEnabled(product, product.status === ProductStatus.DISABLED),
      },
    ]
  }

  static getDetailActions(product: Product, navigate?: NavigateFunction): ProductDetailAction[] {
    const isDisabled = product.status === ProductStatus.DISABLED

    return [
      { type: 'label', label: 'Related' },
      { entity: 'device', label: 'Assign device', onClick: () => void this.assignDevice(product) },
      { type: 'separator', key: 'product-separator' },
      { type: 'label', label: 'Product' },
      {
        entity: 'product',
        label: isDisabled ? 'Enable' : 'Disable',
        onClick: () => void this.setEnabled(product, isDisabled),
      },
      {
        entity: 'product',
        label: product.isArchived ? 'Unarchive' : 'Archive',
        onClick: () => void this.setArchived(product, !product.isArchived),
      },
      {
        entity: 'product',
        label: 'Destroy',
        variant: 'destructive',
        onClick: () => {
          void this.deleteProducts([product]).then((deleted) => {
            if (deleted) navigate?.('/products')
          })
        },
      },
    ]
  }

  static getDetailHeaderActions(
    product: Product,
    navigate?: NavigateFunction,
  ): Pick<PageHeaderProps, 'primaryAction' | 'secondaryAction' | 'options'> {
    return {
      options: this.getDetailActions(product, navigate).map(toDropdownAction),
    }
  }

  static getModuleAction(
    product: Product,
    module: ProductDetailModule,
    navigate?: NavigateFunction,
  ): ProductModuleAction | undefined {
    const actionEntity = moduleActionEntity[module]
    const action = this.getDetailActions(product, navigate).find((item) => item.entity === actionEntity)

    return action && 'label' in action && action.type !== 'label'
      ? { label: action.label, onClick: 'onClick' in action ? action.onClick : undefined }
      : undefined
  }
}
