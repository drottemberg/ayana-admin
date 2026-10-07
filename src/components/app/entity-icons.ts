import Alert02Icon from '@hugeicons/core-free-icons/Alert02Icon'
import Building01Icon from '@hugeicons/core-free-icons/Building01Icon'
import Calendar01Icon from '@hugeicons/core-free-icons/Calendar01Icon'
import Camera01Icon from '@hugeicons/core-free-icons/Camera01Icon'
import ChartLineData01Icon from '@hugeicons/core-free-icons/ChartLineData01Icon'
import CommandIcon from '@hugeicons/core-free-icons/CommandIcon'
import Coins01Icon from '@hugeicons/core-free-icons/Coins01Icon'
import DeviceAccessIcon from '@hugeicons/core-free-icons/DeviceAccessIcon'
import File02Icon from '@hugeicons/core-free-icons/File02Icon'
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon'
import PackageIcon from '@hugeicons/core-free-icons/PackageIcon'
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon'
import Store01Icon from '@hugeicons/core-free-icons/Store01Icon'
import Structure01Icon from '@hugeicons/core-free-icons/Structure01Icon'
import UserGroup03Icon from '@hugeicons/core-free-icons/UserGroup03Icon'
import type { IconSvgElement } from '@hugeicons/react'

export const EntityIcon = {
  home: Home01Icon,
  devices: DeviceAccessIcon,
  contracts: File02Icon,
  clientContracts: File02Icon,
  stores: Store01Icon,
  locations: Building01Icon,
  media: Calendar01Icon,
  mediaCampaigns: Camera01Icon,
  products: PackageIcon,
  orders: PackageIcon,
  pricingOptions: Coins01Icon,
  classes: Calendar01Icon,
  issues: Alert02Icon,
  commandLogs: CommandIcon,
  data: ChartLineData01Icon,
  planograms: Camera01Icon,
  customers: Building01Icon,
  users: UserGroup03Icon,
  deviceTypes: Settings01Icon,
  groups: Structure01Icon,
} satisfies Record<string, IconSvgElement>

export type EntityIconKey = keyof typeof EntityIcon
