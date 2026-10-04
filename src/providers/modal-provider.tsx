import NiceModal from '@ebay/nice-modal-react'
import { useEffect } from 'react'

import { registerDrawerRegistry } from '@/providers/drawer'
import { registerModalRegistry } from '@/providers/modal'

export default function ModalProvider({ children }: React.PropsWithChildren) {
  useEffect(() => {
    registerModalRegistry()
    registerDrawerRegistry()
  }, [])

  return <NiceModal.Provider>{children}</NiceModal.Provider>
}
