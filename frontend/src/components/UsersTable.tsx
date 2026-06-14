import type {User} from "../types.ts";

type UsersTableProps = {
    users: User[],
    selectedIds: number[],
    allSelected: boolean,
    onToggleUser: (id: number) => void,
    onToggleAll: () => void,
}

export default function UsersTable({users, selectedIds, allSelected, onToggleUser, onToggleAll}: UsersTableProps) {

    return (
        <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50">
                <tr>
                    <th className="w-12 px-4 py-3"><input className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" type="checkbox" checked={allSelected} onChange={onToggleAll}/></th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Email</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Last Login</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Created at</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {users.map(user => (
                    <tr className="transition hover:bg-slate-50" key={user.id}>
                        <td className="px-4 py-3"><input
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            type="checkbox"
                            checked={selectedIds.includes(user.id)}
                            onChange={() => onToggleUser(user.id)}
                        /></td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{user.name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{user.email}</td>
                        <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${user.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : user.status === 'blocked' ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>{user.status}</span></td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{user.last_login_at || 'Never'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{user.created_at}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        </div>
        </div>
    )
}
