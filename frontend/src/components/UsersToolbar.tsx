


type UsersToolbarProps = {
    selectedCount: number;
    onBlock: () => void
    onUnblock: () => void
    onDelete: () => void
    onDeleteUnverified: () => void
    isActionPending: boolean
}


export default function UsersToolbar(
    {selectedCount, onBlock, onUnblock, onDelete, onDeleteUnverified, isActionPending}: UsersToolbarProps) {
    return (
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">{selectedCount} selected</span>
            <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45" onClick={onBlock} disabled={!selectedCount || isActionPending} >Block users</button>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45" onClick={onUnblock} disabled={!selectedCount || isActionPending}>Unblock users</button>
            <button className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500" onClick={onDelete} disabled={!selectedCount || isActionPending}>Delete users</button>
            <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500" onClick={onDeleteUnverified} disabled={isActionPending} >Delete unverified users</button>
            </div>
        </div>
    )
}
