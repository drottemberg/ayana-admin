import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type AuthFormProps = {
  title: string
  description: string
  className?: string
  children?: React.ReactNode
}

export function AuthForm({ className, title, description, children }: AuthFormProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
