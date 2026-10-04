import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type OverlayStepMeta<TData> = {
  title?: ReactNode | ((data: TData) => ReactNode)
  description?: ReactNode | ((data: TData) => ReactNode)
  showHeader?: boolean
  className?: string
  bodyClassName?: string
  footer?: ReactNode | ((data: TData) => ReactNode)
}

export type OverlayStepDefinition<TStepId extends string, TData> = OverlayStepMeta<TData> & {
  id: TStepId
}

type UseOverlayStepsOptions<TStepId extends string, TData> = {
  initialStep: TStepId
  initialData: TData
  steps: readonly OverlayStepDefinition<TStepId, TData>[]
}

export type OverlayStepsController<TStepId extends string, TData> = {
  currentId: TStepId
  current: OverlayStepDefinition<TStepId, TData>
  stack: TStepId[]
  data: TData
  canGoBack: boolean
  setData: (data: TData | ((currentData: TData) => TData)) => void
  patchData: (data: Partial<TData> | ((currentData: TData) => Partial<TData>)) => void
  push: (stepId: TStepId) => void
  replace: (stepId: TStepId) => void
  pop: () => void
  popToRoot: () => void
}

function resolveStepMetaValue<TData>(value: ReactNode | ((data: TData) => ReactNode) | undefined, data: TData) {
  return typeof value === 'function' ? (value as (data: TData) => ReactNode)(data) : value
}

export function getOverlayStepTitle<TData>(step: OverlayStepMeta<TData>, data: TData) {
  return resolveStepMetaValue(step.title, data)
}

export function getOverlayStepDescription<TData>(step: OverlayStepMeta<TData>, data: TData) {
  return resolveStepMetaValue(step.description, data)
}

export function getOverlayStepFooter<TData>(step: OverlayStepMeta<TData>, data: TData) {
  return resolveStepMetaValue(step.footer, data)
}

export function useOverlaySteps<TStepId extends string, TData>({
  initialStep,
  initialData,
  steps,
}: UseOverlayStepsOptions<TStepId, TData>): OverlayStepsController<TStepId, TData> {
  const [stack, setStack] = useState<TStepId[]>([initialStep])
  const [data, setDataState] = useState<TData>(initialData)
  const stepsById = useMemo(() => new Map(steps.map((step) => [step.id, step])), [steps])
  const currentId = stack[stack.length - 1] ?? initialStep
  const current = stepsById.get(currentId) ?? steps[0]

  const setData = useCallback((nextData: TData | ((currentData: TData) => TData)) => {
    setDataState((currentData) =>
      typeof nextData === 'function' ? (nextData as (data: TData) => TData)(currentData) : nextData,
    )
  }, [])

  const patchData = useCallback((nextData: Partial<TData> | ((currentData: TData) => Partial<TData>)) => {
    setDataState((currentData) => {
      const patch =
        typeof nextData === 'function' ? (nextData as (data: TData) => Partial<TData>)(currentData) : nextData

      return { ...currentData, ...patch }
    })
  }, [])

  const push = useCallback((stepId: TStepId) => {
    setStack((currentStack) => [...currentStack, stepId])
  }, [])

  const replace = useCallback((stepId: TStepId) => {
    setStack((currentStack) => [...currentStack.slice(0, -1), stepId])
  }, [])

  const pop = useCallback(() => {
    setStack((currentStack) => (currentStack.length > 1 ? currentStack.slice(0, -1) : currentStack))
  }, [])

  const popToRoot = useCallback(() => {
    setStack((currentStack) => currentStack.slice(0, 1))
  }, [])

  return {
    currentId,
    current,
    stack,
    data,
    canGoBack: stack.length > 1,
    setData,
    patchData,
    push,
    replace,
    pop,
    popToRoot,
  }
}
