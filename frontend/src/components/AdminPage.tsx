import type {AuthResponseUser} from "../types.ts";
import {useQuery, useMutation, useQueryClient} from "@tanstack/react-query";
import {getUsers, blockUsers, unblockUsers, deleteUsers, deleteUnverifiedUsers, ApiError} from "../api.ts";
import UsersTable from "./UsersTable";
import {useState, useEffect} from "react";
import UsersToolbar from "./UsersToolbar.tsx";
import { toast } from 'sonner'

type AdminPageProps = {
    user: AuthResponseUser
    verificationLink: string | null
    onLogout: () => void
}

export default function AdminPage({user, verificationLink, onLogout}: AdminPageProps) {
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
                <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${verificationLink ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
                    <p className="font-medium">{verificationLink ? 'Email delivery failed for this account.' : 'This account is still unverified.'}</p>
                    <p className="mt-1">{verificationLink ? 'Open the verification link below, then log out and log in again.' : 'Check your inbox and spam folder for the verification email, then log out and log in again.'}</p>
                    {verificationLink && (
                        <a className="mt-3 inline-flex rounded-md border border-amber-300 bg-white px-3 py-2 font-semibold text-amber-900 transition hover:bg-amber-100" href={verificationLink} rel="noreferrer" target="_blank">Open verification link</a>
                    )}
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


