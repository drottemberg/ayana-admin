import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldGroup } from '@/components/ui/field'
import { FormError } from '@/components/form-error'
import { SelectInput } from '@/components/ui/select-input'
import { updateStaff } from '@/features/users/api'
import { usersQueryKeys } from '@/features/users/query-keys'
import { UserService } from '@/features/users/user-service'
import { StaffRole } from '@/types/membership'
import type { User } from '@/types/user'

type StaffPermissionTabProps = {
  user: User
}

export function StaffPermissionTab({ user }: StaffPermissionTabProps) {
  const queryClient = useQueryClient()
  const [isStaff, setIsStaff] = useState(user.isStaff ?? false)
  const [role, setRole] = useState<StaffRole>(user.staffRole ?? StaffRole.SUPPORT)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const saveStaffPermission = async () => {
    setIsSaving(true)
    setSaveError(null)

    try {
      await updateStaff(String(user.id), { staffRole: role })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.detail(String(user.id)) }),
      ])
      toast.success('Staff permission saved.')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save staff permission.')
    } finally {
      setIsSaving(false)
    }
  }

  const errorMessage = saveError

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-7 py-2">
      <FieldGroup className="gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
          <Checkbox checked={isStaff} onCheckedChange={(checked) => setIsStaff(Boolean(checked))} />
          Staff member
        </label>
        <SelectInput
          label="Staff role"
          required
          disabled={!isStaff}
          items={UserService.staffRoleKeys().map((r) => ({ value: r, label: UserService.staffRoleToString(r) }))}
          value={role}
          onValueChange={(value) => setRole(String(value) as StaffRole)}
        />
      </FieldGroup>

      <div className="mt-auto flex flex-col gap-3 py-6">
        <div className="flex justify-end">
          <Button
            size="lg"
            loading={isSaving}
            disabled={!isStaff || isSaving}
            onClick={() => void saveStaffPermission()}
          >
            Save Staff Permission
          </Button>
        </div>
        <FormError message={errorMessage} />
      </div>
    </div>
  )
}
