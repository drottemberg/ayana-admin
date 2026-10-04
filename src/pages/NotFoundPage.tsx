import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <img src="/images/404.webp" alt="Page not found" className="mb-6 h-64 w-auto" />

        <h1 className="text-h2 mb-6 font-semibold">Page Not Found</h1>
        <p className="mb-6 max-w-sm text-muted-foreground">We couldn't find the page you are looking for</p>
        <Button to="/" className="mt-3">
          Back to home page
        </Button>
      </div>
    </main>
  )
}
