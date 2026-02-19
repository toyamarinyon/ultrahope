"use client";

import { useRouter } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";
import { signOut } from "@/lib/auth/auth-client";

type SignOutButtonProps = ComponentPropsWithoutRef<"button">;

export function SignOutButton({ className, ...props }: SignOutButtonProps) {
	const router = useRouter();

	const handleSignOut = async () => {
		await signOut({
			fetchOptions: {
				onSuccess: () => {
					router.push("/");
				},
			},
		});
	};

	return (
		<button
			type="button"
			onClick={handleSignOut}
			className={
				className ??
				"inline-flex items-center justify-center px-4 py-2 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface-hover"
			}
			{...props}
		>
			Sign out
		</button>
	);
}
