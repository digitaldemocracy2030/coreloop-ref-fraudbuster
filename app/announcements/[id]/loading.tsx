import { Skeleton } from "@/components/ui/skeleton";

export default function AnnouncementDetailLoading() {
	return (
		<div className="container py-12 space-y-8">
			<div className="flex items-center gap-2">
				<Skeleton className="h-4 w-12" />
				<Skeleton className="h-4 w-4" />
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-4 w-4" />
				<Skeleton className="h-4 w-48" />
			</div>

			<div className="space-y-4">
				<Skeleton className="h-6 w-20 rounded-full" />
				<Skeleton className="h-10 w-4/5" />
				<Skeleton className="h-5 w-48" />
				<div className="flex gap-2">
					<Skeleton className="h-6 w-16 rounded-full" />
					<Skeleton className="h-6 w-20 rounded-full" />
				</div>
			</div>

			<Skeleton className="h-72 w-full rounded-xl" />
			<Skeleton className="h-10 w-40" />
		</div>
	);
}
