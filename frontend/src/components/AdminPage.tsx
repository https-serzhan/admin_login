import type {AuthResponseUser} from "../types.ts";
import {useQuery, useMutation, useQueryClient} from "@tanstack/react-query";
import {getUsers, blockUsers, unblockUsers, deleteUsers, deleteUnverifiedUsers, resendVerificationEmail, ApiError} from "../api.ts";
import UsersTable from "./UsersTable";
import {useState, useEffect} from "react";
import UsersToolbar from "./UsersToolbar.tsx";
import { toast } from 'sonner'

type AdminPageProps = {
    user: AuthResponseUser
    onLogout: () => void
}

export default function AdminPage({user, onLogout}: AdminPageProps) {
    const queryClient = useQueryClient()
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const {data, isLoading, error} = useQuery({
        queryKey: ["users"],
        queryFn: getUsers,
    })
    const users = data ?? [];
    const allSelected = users.length > 0 && users.every(user => selectedIds.includes(user.id))
    function handleMutationSuccess() {
        queryClient.invalidateQueries({ queryKey: ['users'] })
        setSelectedIds([])
        toast.success('Users updated')
    }
    function handleMutationError(error: Error) {
        toast.error(error.message)
    }
    const blockMutation = useMutation({
        mutationFn: blockUsers,
        onSuccess: handleMutationSuccess,
        onError: handleMutationError
    })
    const unblockMutation = useMutation({
        mutationFn: unblockUsers,
        onSuccess: handleMutationSuccess,
        onError: handleMutationError
    })
    const deleteMutation = useMutation({
        mutationFn: deleteUsers,
        onSuccess: handleMutationSuccess,
        onError: handleMutationError
    })
    const deleteUnverifiedMutation = useMutation({
        mutationFn: deleteUnverifiedUsers,
        onSuccess: handleMutationSuccess,
        onError: handleMutationError
    })
    const resendVerificationMutation = useMutation({
        mutationFn: resendVerificationEmail,
        onSuccess: () => {
            toast.success('Verification email sent')
        },
        onError: handleMutationError
    })
    function handleBlock() {
        blockMutation.mutate(selectedIds)
    }

    function handleUnblock() {
        unblockMutation.mutate(selectedIds)
    }

    function handleDelete() {
        deleteMutation.mutate(selectedIds)
    }

    function handleDeleteUnverified() {
        deleteUnverifiedMutation.mutate()
    }
    function handleResendVerification() {
        resendVerificationMutation.mutate()
    }
    const isActionPending =
        blockMutation.isPending ||
        unblockMutation.isPending ||
        deleteMutation.isPending ||
        deleteUnverifiedMutation.isPending;
    useEffect(() => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            onLogout()
        }
    }, [error, onLogout])
    function handleToggleUser(id: number) {
        setSelectedIds(previousIds => {
            if (previousIds.includes(id)) {
                return previousIds.filter(existingId => existingId !== id)
            }
            return [...previousIds, id]
        })
    }
    function handleToggleAll() {
        if (allSelected) {
            setSelectedIds([])
        } else {
            setSelectedIds(users.map(user => user.id))
        }
    }
    if(isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">Loading...</div>;
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">Redirecting to login...</div>
    }

    if (error) return <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-sm font-medium text-red-700">{error.message}</div>;
    return (
        <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
            <header className="mx-auto mb-6 flex max-w-7xl flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-slate-950">Welcome, {user.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                        <p>Email: {user.email}</p>
                        <p>Status: <span className="font-medium capitalize text-slate-700">{user.status}</span></p>
                    </div>
                </div>
                <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50" onClick={onLogout}>Logout</button>
            </header>
            <main className="mx-auto max-w-7xl rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            {user.status === 'unverified' && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    <p className="font-medium">This account is still unverified.</p>
                    <p className="mt-1">Registration is complete. Check your inbox and spam folder for the verification email.</p>
                    <button className="mt-3 rounded-md bg-blue-600 px-3 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500" disabled={resendVerificationMutation.isPending} onClick={handleResendVerification}>
                        {resendVerificationMutation.isPending ? 'Sending...' : 'Resend verification email'}
                    </button>
                </div>
            )}
            <UsersToolbar selectedCount={selectedIds.length} onBlock={handleBlock}
                          onUnblock={handleUnblock}
                          onDelete={handleDelete}
                          onDeleteUnverified={handleDeleteUnverified}
                          isActionPending={isActionPending}/>
            <UsersTable
                users={users}
                selectedIds={selectedIds}
                allSelected = {allSelected}
                onToggleUser={handleToggleUser}
                onToggleAll={handleToggleAll}
            />
            </main>
        </div>
    )
}
