import type {AuthResponse} from "../types.ts";
import {useState} from "react";
import {useMutation} from "@tanstack/react-query";
import {register} from "../api.ts";
import { toast } from 'sonner'

type RegisterFormProps = {
    onAuthSuccess: (response: AuthResponse) => void,
}

type RegisterValues = {
    name: string,
    email: string
    password: string
}

export default function RegisterForm({onAuthSuccess}: RegisterFormProps) {
    const [name, setName] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const handleChangeName = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
    };
    const handleChangeEmail = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
    };
    const handleChangePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(e.target.value);
    };
    const registerMutation = useMutation({mutationFn: (vals: RegisterValues) => {
            return register(vals.name, vals.email, vals.password);
        }, onSuccess: (response) => {
            toast.success('Account created successfully')
            onAuthSuccess(response)
        }, onError: (error) => {
            toast.error(error.message)
        }})
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        registerMutation.mutate({name, email, password});
    }


    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <h2 className="text-lg font-semibold text-slate-900">Please fill in the required data:</h2>
            {registerMutation.isError && (
                <p className='rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>{registerMutation.error.message}</p>
            )}
            <label className="block text-sm font-medium text-slate-700">
                Enter name:
                <input className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" required value={name} onChange={handleChangeName} type="text"/>
            </label>
            <label className="block text-sm font-medium text-slate-700">
                Enter email:
                <input className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" required value={email} onChange={handleChangeEmail} type="email"/>
            </label>
            <label className="block text-sm font-medium text-slate-700">
                Enter password:
                <input className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" required value={password} onChange={handleChangePassword} type="password"/>
            </label>
            {registerMutation.isPending && <p className="text-sm text-slate-500">Registering...</p>}
            <button className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500" disabled = {registerMutation.isPending} type='submit'>
                {registerMutation.isPending ? 'Registering...' : 'Register'}
            </button>
        </form>
    )
}


