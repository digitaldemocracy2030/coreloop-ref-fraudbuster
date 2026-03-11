"use client";

import { type ComponentProps, useId } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type HiddenField = {
	name: string;
	value: string;
};

interface DeleteConfirmButtonProps {
	action: string;
	title: string;
	description: string;
	triggerLabel?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	size?: ComponentProps<typeof Button>["size"];
	hiddenFields?: HiddenField[];
}

export function DeleteConfirmButton({
	action,
	title,
	description,
	triggerLabel = "削除",
	confirmLabel = "削除する",
	cancelLabel = "キャンセル",
	size = "sm",
	hiddenFields = [],
}: DeleteConfirmButtonProps) {
	const formId = useId();

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button type="button" size={size} variant="destructive">
					{triggerLabel}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<form id={formId} action={action} method="post">
					{hiddenFields.map((field) => (
						<input
							key={`${field.name}:${field.value}`}
							type="hidden"
							name={field.name}
							value={field.value}
						/>
					))}
				</form>
				<AlertDialogFooter>
					<AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
					<AlertDialogAction
						form={formId}
						type="submit"
						variant="destructive"
						size={size}
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
