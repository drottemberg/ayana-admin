import type { ReactNode } from 'react'
import logoImg from '@/assets/logo.svg'
import { AppModeBadge } from '@/components/app/AppModeBadge'

type AuthLayoutProps = {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const currentYear = new Date().getFullYear()

  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center bg-[var(--color-gray-50)] p-6 md:p-10">
      <div className="flex w-full flex-1 flex-col items-center justify-center">
        <div className="relative mb-10 flex justify-center">
          <img src={logoImg} alt="Logo" />
          <AppModeBadge className="absolute left-[calc(50%+65px)] top-1/2 -translate-y-1/2" />
        </div>

        <div className="mx-auto mb-6 w-full max-w-md">{children}</div>
      </div>

      <footer className="text-body-small flex pb-2 text-center text-[--primary-light]">
        <span>© Gaudier {currentYear}</span>
        <span className="mx-2">|</span>
        <a href="/privacy" className="underline underline-offset-2">
          Privacy & legal
        </a>
        <span className="mx-2">|</span>
        <a href="/contact" className="underline underline-offset-2">
          Contact
        </a>
      </footer>
    </main>
  )
}
