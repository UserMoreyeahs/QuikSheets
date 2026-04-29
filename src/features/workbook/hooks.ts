'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listWorkbooksAction,
  createWorkbookAction,
  renameWorkbookAction,
  deleteWorkbookAction,
  type WorkbookSummary,
} from './actions'

const WORKBOOKS_KEY = ['workbooks'] as const

export function useWorkbooks() {
  return useQuery<WorkbookSummary[]>({
    queryKey: WORKBOOKS_KEY,
    queryFn: () => listWorkbooksAction(),
  })
}

export function useCreateWorkbook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; workspaceId: string }) => createWorkbookAction(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKBOOKS_KEY }),
  })
}

export function useRenameWorkbook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => renameWorkbookAction(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKBOOKS_KEY }),
  })
}

export function useDeleteWorkbook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string }) => deleteWorkbookAction(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKBOOKS_KEY }),
  })
}
